// Vue 3D temps réel, visite à pied et rendu photoréaliste progressif.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { store } from './state.js';
import { buildLevel, buildRoof, stairVoids } from './build.js';
import { buildProc } from './procedural.js';
import { getItem } from './catalog.js';
import { getMaterial, configureTextures, materialInfo, glass } from './materials.js';
import { isPhone, LOW } from './quality.js';
import { TerrainView } from './terrain3d.js';
import { terrainOf, heightAt, levelBase } from './terrain.js';
import { sunPosition, pointInPolygon, segmentsCross } from './geometry.js';

const M = 0.01;
// Orientation des modèles scannés : rotation (degrés) pour que la façade regarde vers +Z.
const FACING = { wooden_display_shelves_01: 90 };

const LAMP_POOL = isPhone() ? 3 : 6;
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

/** Regroupe les pièces d'un meuble par matière : beaucoup moins de travail pour la carte graphique. */
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), groups = new Map();
  root.traverse((m) => {
    if (!m.isMesh || Array.isArray(m.material) || m.material.vertexColors) return;
    const rel = inv.clone().multiply(m.matrixWorld);
    if (rel.determinant() <= 0) return;
    const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ m, rel });
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const parts = list.map(({ m, rel }) => {
      const g = m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      g.morphAttributes = {};
      return g.applyMatrix4(rel);
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (!merged) continue;
    const first = list[0].m, mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
    for (const { m } of list) { m.geometry.dispose(); m.removeFromParent(); }
    root.add(mesh);
  }
  return root;
}

function disposeItem(obj) {
  if (obj.userData.ownGeometry) obj.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
}

const stubGeo = new THREE.BoxGeometry(1, 1, 1);
const stubMat = new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.9, transparent: true, opacity: 0.55 });

export class View3D {
  mode = 'orbit'; preset = 'dollhouse'; itemObjs = new Map(); gltfCache = new Map(); envs = new Map(); active = false; needsRender = true;
  env = { hour: 15, day: 172, sky: 'auto', exposure: 1, lamps: true, walls: 'auto' };
  move = { f: 0, s: 0 }; photo = null;

  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(devicePixelRatio, isPhone() ? 1.5 : 2));
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    configureTextures(Math.min(LOW ? 4 : 8, r.capabilities.getMaxAnisotropy()), () => this.invalidate(false));
    canvas.addEventListener('webglcontextlost', () => { if (this.photo) store.emit('photo-lost'); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false; this.dirty = true;
      if (this.active) this.rebuild();
      store.emit('toast', 'La 3D a été rechargée.');
    });
    const mgr = THREE.DefaultLoadingManager;
    mgr.onProgress = (url, loaded, total) => { this.pending = total - loaded; store.emit('loading', { loaded, total }); };
    mgr.onLoad = () => { this.pending = 0; store.emit('loading', null); this.invalidate(false); };

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.08, 6000);
    this.camera.position.set(14, 13, 16);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495; this.controls.minDistance = 1.2; this.controls.maxDistance = 90;
    this.controls.addEventListener('change', () => this.onCameraMove());

    this.house = new THREE.Group(); this.items = new THREE.Group(); this.lampLights = new THREE.Group();
    this.scene.add(this.house, this.items, this.lampLights);
    this.scene.background = new THREE.Color('#d5e1ec');
    this.wallGroups = [];
    // Un nombre fixe de lampes évite de recompiler tous les matériaux quand un luminaire arrive.
    this.setLampCount(LAMP_POOL);

    this.sun = new THREE.DirectionalLight('#fff1dd', 3.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(isPhone() ? 2048 : 4096, isPhone() ? 2048 : 4096);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.025; this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#dfe8f2', '#b5a48d', 0.25);
    this.scene.add(this.hemi);

    this.terrain = new TerrainView(this.scene, () => this.invalidate(false));

    this.selBox = new THREE.Box3Helper(new THREE.Box3(), '#b5532f');
    this.selBox.visible = false; this.selBox.userData.helper = true;
    this.scene.add(this.selBox);

    this.ray = new THREE.Raycaster();
    this.bindPointer();
    this.bindWalkKeys();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    store.addEventListener('change', (e) => this.onChange(e.detail));
    store.addEventListener('live', () => { if (this.active) this.syncItems(); });
    store.addEventListener('select', () => this.updateSelection());
    store.addEventListener('level', () => this.applyVisibility());
    store.addEventListener('terrain-live', () => this.terrainLive());

    this.setupComposer();
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setupComposer() {
    if (isPhone()) return;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1, scale: 1.25, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());
  }

  invalidate(shadows = true) {
    this.needsRender = true; this.needsPhotoReset = true;
    if (shadows) this.renderer.shadowMap.needsUpdate = true;
  }

  setLampCount(n) {
    while (this.lampLights.children.length < n) this.lampLights.add(new THREE.PointLight('#ffd9a8', 0, 12, 2));
    while (this.lampLights.children.length > n) this.lampLights.remove(this.lampLights.children.at(-1));
  }

  setActive(a) { this.active = a; if (a) { this.resize(); this.applyAll(); } else this.stopPhoto(); }
  applyAll() { if (this.dirty !== false) this.rebuild(); this.invalidate(); }

  resize() {
    const p = this.canvas.parentElement.getBoundingClientRect();
    if (!p.width || !p.height) return;
    this.renderer.setSize(p.width, p.height, false);
    this.canvas.style.width = `${p.width}px`; this.canvas.style.height = `${p.height}px`;
    this.camera.aspect = p.width / p.height; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(p.width, p.height); }
    this.invalidate(false);
  }

  onChange(detail) {
    if (detail?.rebuild === false) return;
    this.dirty = true;
    if (!this.active) return;
    clearTimeout(this.rebuildT);
    this.rebuildT = setTimeout(() => this.rebuild(), 30);
  }

  baseOf(index) { return levelBase(store.project, index); }

  groundY(x, y) { return heightAt(terrainOf(store.project), x, y); }

  /** Pièces au contact du sol : la terre ne doit pas les traverser. */
  /** Limites de la parcelle, posées sur le relief. */
  drawParcel(p) {
    if (this.parcelLine) { this.scene.remove(this.parcelLine); this.parcelLine.geometry.dispose(); this.parcelLine = null; }
    const pts = p.site.parcel?.pts; if (!pts || pts.length < 3) return;
    const v = [];
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 100));
      for (let k = 0; k <= n; k++) { const x = a.x + ((b.x - a.x) * k) / n, y = a.y + ((b.y - a.y) * k) / n; v.push(x * M, this.groundY(x, y) + 0.12, y * M); }
    });
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    this.parcelLine = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#f06a2a' }));
    this.scene.add(this.parcelLine);
  }

  footprints() {
    const p = store.project, e = p.entry || 0;
    return p.levels.slice(0, e + 1).flatMap((lv) => store.analysis(lv).rooms.map((r) => r.poly.map((q) => ({ x: q.x, y: q.y }))));
  }

  terrainLive() {
    if (!this.active || this.terrainBusy) return;
    this.terrainBusy = setTimeout(() => {
      this.terrainBusy = 0;
      this.terrain.rebuildNear(store.project, terrainOf(store.project), this.footprints());
      this.invalidate();
    }, LOW ? 160 : 90);
  }

  rebuild() {
    const p = store.project; if (!p) return;
    this.dirty = false;
    disposeTree(this.house);
    this.house.clear();
    const defs = (id) => getItem(id);
    const opts = {
      cutHeight: this.preset === 'cut' ? 110 : null,
      stairVoids: (lv) => stairVoids(lv, defs),
      inside: pointInPolygon,
      groundAt: (x, y) => this.groundY(x, y),
      coveredBy: (lower, q) => store.analysis(lower).rooms.some((r) => pointInPolygon(q, r.poly)) || lower.walls.some((w) => { const a = lower.nodes[w.a], b = lower.nodes[w.b], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, t = Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / (L * L))); return Math.hypot(a.x + (b.x - a.x) * t - q.x, a.y + (b.y - a.y) * t - q.y) < 8; }),
    };
    p.levels.forEach((lv, i) => {
      const a = store.analysis(lv);
      const g = buildLevel(p, lv, i, a, this.baseOf(i), opts);
      g.userData.index = i;
      this.house.add(g);
    });
    const top = p.levels.length - 1, tl = p.levels[top];
    const roof = buildRoof(p, tl, this.baseOf(top) + tl.height * M);
    this.house.add(roof);
    this.roof = roof;
    for (const z of p.roofs || []) {
      const i = p.levels.findIndex((l) => l.id === z.level);
      if (i >= 0) this.house.add(buildRoof(p, p.levels[i], this.baseOf(i) + (z.wallH > 0 ? Math.min(z.wallH, p.levels[i].height) : p.levels[i].height) * M, z));
    }
    this.drawParcel(p);
    this.wallGroups = [];
    this.house.traverse((o) => { if (o.userData.kind === 'wallGroup') this.wallGroups.push(o); });

    this.terrain.update(p, this.footprints());
    this.syncItems();
    this.fitShadow();
    this.applyVisibility();
    this.applyLighting();
    this.invalidate();
  }

  bounds() {
    const b = new THREE.Box3();
    store.project.levels.forEach((lv, i) => { const y = this.baseOf(i); for (const n of Object.values(lv.nodes)) { b.expandByPoint(new THREE.Vector3(n.x * M, y, n.y * M)); b.expandByPoint(new THREE.Vector3(n.x * M, y + lv.height * M, n.y * M)); } });
    if (b.isEmpty()) { const y = this.baseOf(0); b.set(new THREE.Vector3(-5, y, -5), new THREE.Vector3(5, y + 3, 5)); }
    return b;
  }

  fitShadow() {
    const b = this.bounds(), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() * 0.75 + 4;
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -r; cam.right = cam.top = r; cam.near = 1; cam.far = 90;
    cam.updateProjectionMatrix();
    this.sun.target.position.copy(c);
    this.center = c; this.radius = r;
  }

  frame() {
    const b = this.bounds(), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const d = Math.max(s.x, s.z, 7) * 1.25 + 3;
    this.controls.target.set(c.x, b.min.y + 0.6, c.z);
    this.camera.position.set(c.x + d * 0.62, b.min.y + Math.max(s.y, 3) + d * 0.72, c.z + d * 0.86);
    this.controls.update();
    this.invalidate();
  }

  // ——— Lumière ———
  skyFor(alt) {
    const s = this.env.sky;
    if (s !== 'auto') return s;
    const deg = (alt * 180) / Math.PI;
    if (deg < -4) return 'nuit';
    if (deg < 14) return 'soir';
    if (deg < 40) return 'matin';
    return 'midi';
  }

  async loadSky(name) {
    if (this.envs.has(name)) return this.envs.get(name);
    const pr = (async () => {
      let tex;
      for (let n = 0; ; n++) {
        try { tex = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(`./hdri/${name}.hdr`); break; }
        catch (e) { if (n >= 2) throw e; await wait(1200 * (n + 1)); }
      }
      tex.mapping = THREE.EquirectangularReflectionMapping;
      // Repère l'azimut du soleil dans l'image pour pouvoir le caler sur la position réelle.
      const { data, width, height } = tex.image;
      let best = 0, bx = 0;
      for (let y = 0; y < height / 2; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4, v = data[i] + data[i + 1] + data[i + 2];
        if (v > best) { best = v; bx = x; }
      }
      // Le disque solaire de l'image est écrêté : le soleil vient de la lumière directionnelle, calée sur sa vraie position.
      for (let i = 0; i < data.length; i += 4) {
        const m = Math.max(data[i], data[i + 1], data[i + 2]);
        if (m > 14) { const k = 14 / m; data[i] *= k; data[i + 1] *= k; data[i + 2] *= k; }
      }
      // Beaucoup de téléphones ne filtrent pas les images en précision complète : on passe en demi-précision.
      if (!this.renderer.extensions.has('OES_texture_float_linear')) {
        const half = new Uint16Array(data.length);
        for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(data[i], 65000));
        tex.image.data = half; tex.type = THREE.HalfFloatType;
      }
      tex.needsUpdate = true;
      return { tex, sunU: bx / width };
    })();
    pr.catch(() => this.envs.delete(name));
    this.envs.set(name, pr);
    return pr;
  }

  async applyLighting() {
    const p = store.project; if (!p) return;
    const { lat, lon, north } = p.site;
    // Heure légale française approchée : UTC+1 en hiver, UTC+2 en été.
    const summer = this.env.day > 86 && this.env.day < 300;
    const utc = this.env.hour - (summer ? 2 : 1);
    const sp = sunPosition(lat, lon, this.env.day, utc);
    const northRad = (north * Math.PI) / 180;
    const az = sp.azimuth + northRad;
    const alt = sp.altitude;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
    this.sunDir = dir;
    const name = this.skyFor(alt);
    const day = THREE.MathUtils.smoothstep(alt, -0.06, 0.2);
    const interior = this.mode === 'walk';
    // Le soleil s'applique tout de suite ; le ciel suit dès qu'il est téléchargé.
    this.applySky(name, dir, interior);
    this.sun.intensity = name === 'couvert' ? 0.5 : 3.9 * day;
    this.sun.color.setHSL(0.09, 0.8 - 0.55 * day, 0.86);
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 44);
    this.sun.castShadow = day > 0.01;
    this.hemi.intensity = (interior ? 0.5 : 0.22) + (this.scene.environment ? 0 : 0.9);
    this.nightFactor = 1 - day;
    this.updateLamps();
    this.renderer.toneMappingExposure = 1.05 * this.env.exposure * (interior ? 1.35 : 1);
    this.invalidate();
  }

  async applySky(name, dir, interior) {
    const token = (this.skyToken = (this.skyToken || 0) + 1);
    let sky;
    try { sky = await this.loadSky(name); } catch (e) { console.warn('Ciel indisponible', e); return; }
    if (token !== this.skyToken) return;
    // Rotation du ciel pour que le soleil de l'image coïncide avec le vrai soleil.
    const hdriAngle = (sky.sunU - 0.5) * Math.PI * 2;
    const wanted = Math.atan2(dir.x, dir.z);
    const rotY = name === 'nuit' ? 0 : wanted - (-hdriAngle + Math.PI / 2);
    const first = !this.scene.environment;
    this.scene.environment = sky.tex; this.scene.background = sky.tex;
    this.scene.environmentRotation.set(0, rotY, 0); this.scene.backgroundRotation.set(0, rotY, 0);
    this.scene.environmentIntensity = name === 'nuit' ? 0.45 : interior ? 0.55 : 0.6;
    this.scene.backgroundIntensity = 1;
    if (first) this.hemi.intensity -= 0.9;
    this.invalidate(false);
  }

  setEnv(patch) { Object.assign(this.env, patch); this.applyLighting(); }

  updateLamps() { this.lampsDirty = true; this.needsRender = true; }

  applyLamps() {
    this.lampsDirty = false;
    const limit = this.photo ? 40 : LAMP_POOL;
    this.setLampCount(limit);
    const list = [];
    const camPos = this.camera.position;
    if (this.env.lamps) for (const obj of this.itemObjs.values()) {
      if (!obj.visible) continue;
      obj.traverse((m) => {
        for (const l of m.userData.lights || []) {
          const v = m.localToWorld(new THREE.Vector3(l.x, l.y, l.z));
          list.push({ v, l, d: v.distanceToSquared(camPos) });
        }
      });
    }
    list.sort((a, b) => a.d - b.d);
    this.lampLights.children.forEach((pl, i) => {
      const e = list[i];
      pl.intensity = e ? e.l.intensity * (0.35 + 0.65 * (this.nightFactor ?? 0)) : 0;
      if (e) { pl.color.set(e.l.color); pl.position.copy(e.v); }
    });
    this.invalidate(false);
  }

  // ——— Mobilier ———
  async loadScanned(id) {
    if (!this.gltfCache.has(id)) {
      const url = `./${LOW ? 'models-s' : 'models'}/${id}.glb`;
      const pr = (async () => {
        for (let n = 0; ; n++) {
          try { return await new GLTFLoader().loadAsync(url); }
          catch (e) { if (n >= 2) throw e; await wait(1200 * (n + 1)); }
        }
      })();
      // Un échec passager ne doit pas priver ce meuble de son modèle jusqu'au prochain démarrage.
      pr.catch(() => this.gltfCache.delete(id));
      this.gltfCache.set(id, pr);
    }
    const g = await this.gltfCache.get(id);
    return g.scene.clone(true);
  }

  /** Hauteur totale d'un escalier : du sol de son niveau au sol du niveau suivant. */
  stairHeight(li) { const lv = store.project.levels[li]; return (lv.height + lv.slab) * M; }

  async makeObject(it, def, li, drop) {
    const size = { w: (it.w ?? def.w) * M, d: (it.d ?? def.d) * M, h: (it.h ?? def.h) * M };
    if (def.sub === 'escalier') size.h = this.stairHeight(li);
    if (def.sub === 'balcon') size.drop = drop;
    const root = new THREE.Group();
    root.userData = { kind: 'item', id: it.id };
    if (def.model?.kind === 'ph') {
      const model = await this.loadScanned(def.model.id);
      const holder = new THREE.Group();
      holder.add(model);
      model.rotation.y = ((FACING[def.model.id] || 0) * Math.PI) / 180;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model), s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      holder.scale.set(size.w / s.x, size.h / s.y, size.d / s.z);
      model.position.set(-c.x, -box.min.y, -c.z);
      holder.traverse((m) => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
      if (def.ceiling) holder.position.y = -size.h;
      root.add(holder);
      if (/lamp|chandelier/i.test(def.model.id) || def.sub === 'suspension') (root.userData.lights ||= []).push({ x: 0, y: size.h * 0.4 - size.h, z: 0, intensity: 18, color: '#ffd9a8' });
    } else {
      const obj = buildProc({ ...def.model, color: def.model?.color }, def.model?.type === 'tv' ? {} : size, it.color);
      mergeStatic(obj);
      root.add(obj);
      root.userData.ownGeometry = true;
      if (obj.userData.lights) root.userData.lights = obj.userData.lights;
    }
    return root;
  }

  itemY(it, def, levelIndex) {
    const lv = store.project.levels[levelIndex];
    if (def.ceiling) return this.baseOf(levelIndex) + lv.height * M;
    // Un arbre, une haie ou une clôture suivent le relief, sauf dans une pièce (terrasse couverte).
    if (def.cat === 'exterieur' && !store.analysis(lv).rooms.some((r) => pointInPolygon({ x: it.x, y: it.y }, r.poly))) return this.groundY(it.x, it.y) + (it.z ?? def.z ?? 0) * M;
    return this.baseOf(levelIndex) + (it.z ?? def.z ?? 0) * M;
  }

  syncItems() {
    const p = store.project; if (!p) return;
    const seen = new Set();
    p.levels.forEach((lv, li) => {
      for (const it of lv.items) {
        const def = getItem(it.cat); if (!def) continue;
        seen.add(it.id);
        const drop = def.sub === 'balcon' ? Math.max(0, Math.round((this.baseOf(li) - this.groundY(it.x, it.y)) * 20) / 20) : 0;
        const sig = `${it.cat}|${it.w}|${it.d}|${it.h}|${it.color}|${drop}|${def.sub === 'escalier' ? this.stairHeight(li) : ''}`;
        const place = (obj) => {
          obj.position.set(it.x * M, this.itemY(it, def, li), it.y * M);
          obj.rotation.y = (-(it.rot || 0) * Math.PI) / 180;
          obj.userData.level = li;
          obj.visible = this.levelVisible(li);
        };
        let obj = this.itemObjs.get(it.id);
        if (obj && obj.userData.sig === sig) { place(obj); continue; }
        if (obj && obj.userData.loading === sig) { continue; }
        if (obj) { this.items.remove(obj); disposeItem(obj); this.itemObjs.delete(it.id); }
        // Un volume clair tient la place du meuble le temps qu'il arrive.
        const stub = new THREE.Group();
        stub.userData = { kind: 'item', id: it.id, loading: sig, sig: null };
        if (def.model?.kind === 'ph') {
          const box = new THREE.Mesh(stubGeo, stubMat), W = (it.w ?? def.w) * M, H = (it.h ?? def.h) * M, D = (it.d ?? def.d) * M;
          box.scale.set(W, H, D); box.position.y = def.ceiling ? -H / 2 : H / 2;
          stub.add(box);
        }
        this.itemObjs.set(it.id, stub);
        this.items.add(stub);
        place(stub);
        this.makeObject(it, def, li, drop).then((real) => {
          if (this.itemObjs.get(it.id) !== stub) return;
          this.items.remove(stub);
          real.userData.sig = sig;
          real.userData.id = it.id; real.userData.kind = 'item';
          this.itemObjs.set(it.id, real);
          this.items.add(real);
          place(real);
          real.updateMatrixWorld(true);
          this.updateSelection();
          this.updateLamps();
          this.invalidate();
        }).catch((e) => { stub.userData.loading = null; console.warn('Modèle indisponible', def.id, e); });
      }
    });
    for (const [id, obj] of this.itemObjs) if (!seen.has(id)) { this.items.remove(obj); disposeItem(obj); this.itemObjs.delete(id); }
    this.updateSelection();
    this.invalidate();
  }

  updateSelection() {
    const s = store.selection;
    const obj = s?.type === 'item' ? this.itemObjs.get(s.id) : null;
    this.selBox.visible = !!obj && !this.photo;
    if (obj) { this.selBox.box.setFromObject(obj); }
    this.invalidate();
  }

  // ——— Vues ———
  levelVisible(i) {
    if (this.mode === 'walk' || this.preset === 'exterior') return true;
    return i <= store.levelIndex;
  }

  setPreset(p) {
    const prev = this.preset;
    this.preset = p;
    if (p === 'walk') { this.startWalk(); }
    else { if (this.mode === 'walk') this.stopWalk(); }
    if ((prev === 'cut') !== (p === 'cut')) this.rebuild(); else this.applyVisibility();
    this.applyLighting();
  }

  applyVisibility() {
    const showRoof = this.preset === 'exterior';
    const walk = this.mode === 'walk';
    const ceilings = walk || showRoof;
    for (const g of this.house.children) {
      if (g.name === 'roof') { g.visible = showRoof; continue; }
      const i = g.userData.index;
      g.visible = this.levelVisible(i);
      const c = g.getObjectByName('ceilings');
      if (c) c.visible = ceilings || i < (this.levelTopVisible() ?? 0);
    }
    for (const o of this.itemObjs.values()) o.visible = this.levelVisible(o.userData.level ?? 0);
    this.updateWallHiding();
    this.updateLamps();
    // Pour voir un niveau enterré depuis la maquette, on écarte la terre.
    if (this.terrain.near) this.terrain.near.visible = !(this.mode === 'orbit' && this.preset !== 'exterior' && store.levelIndex < (store.project.entry || 0));
    this.invalidate();
  }

  levelTopVisible() { return this.preset === 'exterior' || this.mode === 'walk' ? store.project.levels.length : store.levelIndex; }

  updateWallHiding() {
    const hide = this.mode === 'orbit' && this.preset === 'dollhouse' && this.env.walls === 'auto';
    const cam = this.camera.position;
    let changed = false;
    for (const o of this.wallGroups) {
      let vis = true;
      if (hide && o.userData.outward) {
        const dx = cam.x - o.userData.center.x, dz = cam.z - o.userData.center.z;
        vis = dx * o.userData.outward.x + dz * o.userData.outward.z < 0.1;
      }
      if (o.visible !== vis) { o.visible = vis; changed = true; }
    }
    if (changed) this.invalidate();
  }

  onCameraMove() {
    this.needsRender = true;
    if (this.photo) { this.needsPhotoReset = true; }
    if (this.mode === 'orbit' && store.project) {
      const min = this.groundY(this.camera.position.x / M, this.camera.position.z / M) + 0.6;
      if (this.camera.position.y < min) this.camera.position.y = min;
    }
    this.updateWallHiding();
  }

  // ——— Visite à pied ———
  startWalk(spot) {
    this.mode = 'walk';
    this.controls.enabled = false;
    const lv = store.level;
    const li = store.levelIndex;
    let pos = spot;
    if (!pos) {
      const a = store.analysis(lv);
      const best = a.rooms.reduce((m, r) => (!m || r.area > m.area ? r : m), null);
      pos = best ? best.center : { x: 0, y: 0 };
    }
    this.camera.position.set(pos.x * M, this.baseOf(li) + 1.62, pos.y * M);
    this.walkY = this.camera.position.y;
    this.yaw = this.yaw ?? 0; this.pitch = 0;
    this.camera.rotation.order = 'YXZ';
    this.applyLook();
    this.applyVisibility();
    this.applyLighting();
    store.emit('walk', true);
  }

  stopWalk() {
    this.mode = 'orbit';
    this.controls.enabled = true;
    this.frame();
    store.emit('walk', false);
  }

  applyLook() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.onCameraMove();
  }

  bindWalkKeys() {
    const map = { z: ['f', 1], w: ['f', 1], s: ['f', -1], q: ['s', -1], a: ['s', -1], d: ['s', 1], arrowup: ['f', 1], arrowdown: ['f', -1], arrowleft: ['s', -1], arrowright: ['s', 1] };
    const on = (e, v) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || this.mode !== 'walk') return;
      const m = map[e.key.toLowerCase()];
      if (m) { this.move[m[0]] = v ? m[1] : 0; e.preventDefault(); }
    };
    addEventListener('keydown', (e) => on(e, true));
    addEventListener('keyup', (e) => on(e, false));
  }

  /** Hauteur des yeux : sol de la pièce, terrain dehors, ou marches de l'escalier. */
  updateWalkHeight(dt) {
    const p = store.project, li = store.levelIndex, x = this.camera.position.x / M, y = this.camera.position.z / M;
    const onStair = (lv, level) => {
      for (const it of lv?.items || []) {
        const def = getItem(it.cat); if (def?.sub !== 'escalier') continue;
        const r = (-(it.rot || 0) * Math.PI) / 180, dx = x - it.x, dy = y - it.y, lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
        const w = (it.w ?? def.w) / 2, d = (it.d ?? def.d) / 2;
        if (Math.abs(lx) <= w && Math.abs(ly) <= d) return { t: (d - ly) / (2 * d), level };
      }
      return null;
    };
    const st = onStair(p.levels[li], li) || (li > 0 ? onStair(p.levels[li - 1], li - 1) : null);
    let target;
    if (st) {
      target = this.baseOf(st.level) + st.t * this.stairHeight(st.level) + 1.62;
      const want = st.t > 0.86 ? st.level + 1 : st.t < 0.14 ? st.level : li;
      if (want !== li && p.levels[want]) store.setLevel(want);
    } else {
      const inside = store.analysis(p.levels[li]).rooms.some((r) => pointInPolygon({ x, y }, r.poly));
      target = (inside ? this.baseOf(li) : Math.max(this.groundY(x, y), this.baseOf(li) - 30)) + 1.62;
    }
    this.walkY = this.walkY === undefined ? target : THREE.MathUtils.damp(this.walkY, target, 12, dt);
    if (Math.abs(this.camera.position.y - this.walkY) > 0.002) { this.camera.position.y = this.walkY; this.needsRender = true; }
  }

  stepWalk(dt) {
    this.updateWalkHeight(dt);
    const { f, s } = this.move;
    if (!f && !s) return;
    const sp = 2.1 * dt;
    const dx = (Math.sin(this.yaw) * -f + Math.cos(this.yaw) * s) * sp;
    const dz = (Math.cos(this.yaw) * -f - Math.sin(this.yaw) * s) * sp;
    const from = { x: this.camera.position.x / M, y: this.camera.position.z / M };
    const to = { x: from.x + (dx / M) * 3, y: from.y + (dz / M) * 3 };
    const lv = store.project.levels[store.levelIndex];
    let blocked = false;
    for (const w of lv.walls) {
      const a = lv.nodes[w.a], b = lv.nodes[w.b];
      if (!segmentsCross(from, to, a, b)) continue;
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const denom = ((b.x - a.x) * (to.y - from.y) - (b.y - a.y) * (to.x - from.x)) || 1;
      const t = ((from.x - a.x) * (to.y - from.y) - (from.y - a.y) * (to.x - from.x)) / denom;
      const passable = w.openings.some((o) => o.sill < 10 && Math.abs(t * L - o.t) < o.width / 2 - 12);
      if (!passable) { blocked = true; break; }
    }
    if (!blocked) { this.camera.position.x += dx; this.camera.position.z += dz; this.onCameraMove(); }
  }

  // ——— Pointeur ———
  bindPointer() {
    const c = this.canvas;
    let press = null;
    const terrainPoint = (e) => {
      this.setRay(e);
      const o = this.ray.ray.origin, v = this.ray.ray.direction;
      for (let t = 0; t < 400; t += 0.25) {
        const x = o.x + v.x * t, y = o.y + v.y * t, z = o.z + v.z * t;
        if (y <= this.groundY(x / M, z / M)) return { x: x / M, y: z / M };
      }
      return null;
    };
    c.addEventListener('pointerdown', (e) => {
      if (store.brush && this.mode === 'orbit') {
        const p0 = terrainPoint(e);
        if (p0) { this.controls.enabled = false; c.setPointerCapture(e.pointerId); press = { brush: true }; store.brushStroke.begin(p0); }
        return;
      }
      press = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      if (this.mode === 'walk') { press.yaw = this.yaw; press.pitch = this.pitch; c.setPointerCapture(e.pointerId); return; }
      const sel = store.selection;
      if (sel?.type === 'item') {
        const hit = this.pick(e);
        if (hit?.kind === 'item' && hit.id === sel.id) {
          this.controls.enabled = false;
          const it = store.level.items.find((i) => i.id === sel.id);
          if (it) {
            const y = this.baseOf(store.levelIndex);
            this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
            const p0 = this.planePoint(e);
            press.item = it; press.ox = p0 ? p0.x / M - it.x : 0; press.oy = p0 ? p0.z / M - it.y : 0;
            c.setPointerCapture(e.pointerId);
          }
        }
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!press) return;
      if (press.brush) { const q = terrainPoint(e); if (q) store.brushStroke.at(q); return; }
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5) press.moved = true;
      if (this.mode === 'walk' && press.yaw !== undefined) {
        this.yaw = press.yaw - (e.clientX - press.x) * 0.0042;
        this.pitch = Math.max(-1.3, Math.min(1.3, press.pitch - (e.clientY - press.y) * 0.0042));
        this.applyLook();
        return;
      }
      if (press.item && press.moved) {
        if (!press.began) { store.snapshot(); press.began = true; }
        const p = this.planePoint(e);
        if (p && store.plan) store.plan.moveItem(press.item, p.x / M - press.ox, p.z / M - press.oy);
        this.syncItems();
      }
    });
    const end = (e) => {
      if (!press) return;
      this.controls.enabled = this.mode === 'orbit';
      if (press.brush) { press = null; store.brushStroke.end(); return; }
      if (press.began) store.commit({ rebuild: false });
      else if (!press.moved) this.tap(e);
      press = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => { if (press?.brush) store.brushStroke.end(); press = null; this.controls.enabled = this.mode === 'orbit'; });
  }

  /** Point du sol sous un point de l'écran : sert à déposer un meuble en 3D. */
  floorPoint(clientX, clientY) {
    this.setRay({ clientX, clientY });
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.baseOf(store.levelIndex));
    const p = this.ray.ray.intersectPlane(plane, new THREE.Vector3());
    return p ? { x: p.x / M, y: p.z / M } : null;
  }

  planePoint(e) {
    this.setRay(e);
    return this.ray.ray.intersectPlane(this.dragPlane, new THREE.Vector3());
  }
  setRay(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
  }

  pick(e) {
    this.setRay(e);
    const list = [this.items, this.house];
    const hits = this.ray.intersectObjects(list, true);
    for (const h of hits) {
      let o = h.object, vis = true;
      for (let p = o; p; p = p.parent) if (!p.visible) vis = false;
      if (!vis || o.material?.transmission > 0) continue;
      this.lastHit = h.point;
      while (o) {
        if (o.userData.kind === 'item') return { kind: 'item', id: o.userData.id };
        if (['wall', 'floor', 'ceiling', 'opening'].includes(o.userData.kind)) return { ...o.userData };
        o = o.parent;
      }
      return null;
    }
    return null;
  }

  tap(e) {
    const hit = this.pick(e);
    if (!hit) { store.select(null); return; }
    if (this.mode === 'walk' && hit.kind === 'floor' && !store.selection) {
      this.camera.position.x = this.lastHit.x; this.camera.position.z = this.lastHit.z;
      this.onCameraMove();
      return;
    }
    if (hit.kind === 'item') store.select({ type: 'item', id: hit.id });
    else if (hit.kind === 'floor') store.select({ type: 'room', id: hit.roomId, part: 'floor' });
    else if (hit.kind === 'ceiling') store.select({ type: 'room', id: hit.roomId, part: 'ceiling' });
    else if (hit.kind === 'wall') store.select({ type: 'wall', id: hit.wallId, side: hit.side, roomId: hit.roomId });
    else if (hit.kind === 'opening') store.select({ type: 'opening', id: hit.openingId, wallId: hit.wallId });
  }

  // ——— Boucle ———
  loop(t) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000); this.last = t;
    if (!this.active) return;
    if (this.mode === 'orbit') this.controls.update();
    else this.stepWalk(dt);
    if (this.lost) return;
    if (this.lampsDirty) this.applyLamps();
    if (this.photo) { this.photoFrame(); return; }
    if (this.needsRender) {
      // En mouvement : image directe, fluide. À l'arrêt : image finale avec les ombres de contact.
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
      this.finalPending = !!this.composer;
      this.lastChange = t;
      this.watchSpeed(t);
    } else if (this.finalPending && t - this.lastChange > 180) {
      this.finalPending = false;
      this.composer.render();
    } else this.speedPrev = 0;
  }

  /** Si l'appareil peine pendant les déplacements, on baisse un peu la définition. */
  watchSpeed(t) {
    const dt = this.speedPrev ? t - this.speedPrev : 0;
    this.speedPrev = t;
    if (!dt || dt > 250 || this.pending) return;
    this.speedAvg = (this.speedAvg ?? dt) * 0.92 + dt * 0.08;
    const pr = this.renderer.getPixelRatio();
    if (this.speedAvg > 42 && pr > 1 && t - (this.speedDrop || 0) > 2500) {
      this.speedDrop = t; this.speedAvg = 30;
      this.renderer.setPixelRatio(Math.max(1, pr - 0.25));
      this.resize();
    }
  }

  // ——— Mode photo : tracé de chemins progressif ———
  async startPhoto({ onProgress, onReady, target = 300, quality = 'high' } = {}) {
    this.stopPhoto();
    this.selBox.visible = false;
    const gl = this.renderer.getContext();
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float');
    const { WebGLPathTracer, DenoiseMaterial } = await import('three-gpu-pathtracer');
    const glassMat = glass();
    const saved = { op: glassMat.opacity, tr: glassMat.transparent };
    glassMat.opacity = 1; glassMat.transparent = false;

    const pt = new WebGLPathTracer(this.renderer);
    pt.bounces = quality === 'high' ? 6 : 4;
    pt.transmissiveBounces = 6;
    pt.filterGlossyFactor = 1;
    pt.renderScale = isPhone() ? 0.6 : 1;
    pt.tiles.set(isPhone() ? 3 : 2, isPhone() ? 3 : 2);
    pt.minSamples = 1; pt.fadeDuration = 0; pt.renderDelay = 0;
    pt.dynamicLowRes = false; pt.rasterizeScene = true;
    pt.multipleImportanceSampling = true;
    pt.textureSize.set(1024, 1024);

    const denoise = new FullScreenQuad(new DenoiseMaterial({ map: null, blending: THREE.NoBlending, premultipliedAlpha: this.renderer.getContextAttributes().premultipliedAlpha }));
    denoise.material.sigma = 5; denoise.material.kSigma = 1.2;
    pt.renderToCanvasCallback = (rt, renderer) => {
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      denoise.material.map = rt.texture;
      // Lissage fort au début, puis de plus en plus léger pour garder les détails.
      denoise.material.threshold = Math.max(0.02, Math.min(0.16, 0.5 / Math.sqrt(pt.samples + 1)));
      denoise.render(renderer);
      renderer.autoClear = auto;
    };

    this.photo = { pt, target, onProgress, saved, denoise };
    this.applyLamps();
    await new Promise((r) => setTimeout(r, 40));
    this.scene.updateMatrixWorld(true);
    pt.setScene(this.scene, this.camera);
    onReady?.(1);
    this.camera.updateMatrixWorld();
    pt.updateCamera();
    this.needsPhotoReset = false;
  }

  photoFrame() {
    const ph = this.photo;
    if (ph.pt.isCompiling) { ph.pt.renderSample(); return; }
    if (this.needsPhotoReset) { this.needsPhotoReset = false; this.camera.updateMatrixWorld(); ph.pt.updateCamera(); }
    if (ph.pt.samples < ph.target) ph.pt.renderSample();
    ph.onProgress?.(ph.pt.samples, ph.target);
  }

  capturePhoto() {
    if (!this.photo) return Promise.resolve(null);
    const ph = this.photo;
    return new Promise((res) => {
      ph.pt.renderSample();
      this.canvas.toBlob((b) => res(b), 'image/jpeg', 0.94);
    });
  }

  stopPhoto() {
    if (!this.photo) return;
    const { pt, saved, denoise } = this.photo;
    const g = glass();
    g.opacity = saved.op; g.transparent = saved.tr;
    pt.dispose(); denoise.dispose?.();
    this.photo = null;
    this.renderer.setRenderTarget(null);
    this.updateSelection();
    this.applyLamps();
    this.resize();
    this.invalidate();
  }

  /** Coupe la façade côté caméra quand elle est dehors, pour voir l'intérieur en photo. */
  snapshot() {
    return { pos: this.camera.position.toArray(), target: this.controls.target.toArray(), yaw: this.yaw, pitch: this.pitch, mode: this.mode };
  }
}

function disposeTree(root) {
  root.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
}
