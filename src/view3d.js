// Vue 3D temps réel, visite à pied et rendu photoréaliste progressif.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WebGLPathTracer, DenoiseMaterial } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { store } from './state.js';
import { buildLevel, buildRoof, stairVoids } from './build.js';
import { buildProc } from './procedural.js';
import { getItem } from './catalog.js';
import { getMaterial, configureTextures, materialInfo, glass } from './materials.js';
import { sunPosition, pointInPolygon, segmentsCross } from './geometry.js';

const M = 0.01;
// Orientation des modèles scannés : rotation (degrés) pour que la façade regarde vers +Z.
const FACING = { wooden_display_shelves_01: 90 };

const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820;

export class View3D {
  mode = 'orbit'; preset = 'dollhouse'; itemObjs = new Map(); gltfCache = new Map(); envs = new Map(); active = false; needsRender = true;
  env = { hour: 15, day: 172, sky: 'auto', exposure: 1, lamps: true, walls: 'auto' };
  move = { f: 0, s: 0 }; photo = null;

  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(devicePixelRatio, isPhone() ? 1.5 : 2));
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    configureTextures(Math.min(8, r.capabilities.getMaxAnisotropy()), () => this.invalidate());

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.05, 900);
    this.camera.position.set(14, 13, 16);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495; this.controls.minDistance = 1.2; this.controls.maxDistance = 90;
    this.controls.addEventListener('change', () => this.onCameraMove());

    this.house = new THREE.Group(); this.items = new THREE.Group(); this.lampLights = new THREE.Group();
    this.scene.add(this.house, this.items, this.lampLights);

    this.sun = new THREE.DirectionalLight('#fff1dd', 3.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(isPhone() ? 2048 : 4096, isPhone() ? 2048 : 4096);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.025; this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#dfe8f2', '#b5a48d', 0.25);
    this.scene.add(this.hemi);

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.MeshStandardMaterial({ color: '#7d8b5a' }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.03; this.ground.receiveShadow = true;
    this.ground.userData.kind = 'ground';
    // UV en mètres pour garder l'échelle de la texture
    const gp = this.ground.geometry.attributes.position, guv = this.ground.geometry.attributes.uv;
    for (let i = 0; i < gp.count; i++) guv.setXY(i, gp.getX(i), gp.getY(i));
    this.scene.add(this.ground);

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

  invalidate() { this.needsRender = true; this.needsPhotoReset = true; }

  setActive(a) { this.active = a; if (a) { this.resize(); this.applyAll(); } else this.stopPhoto(); }
  applyAll() { if (this.dirty !== false) this.rebuild(); this.invalidate(); }

  resize() {
    const p = this.canvas.parentElement.getBoundingClientRect();
    if (!p.width || !p.height) return;
    this.renderer.setSize(p.width, p.height, false);
    this.canvas.style.width = `${p.width}px`; this.canvas.style.height = `${p.height}px`;
    this.camera.aspect = p.width / p.height; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(p.width, p.height); }
    this.invalidate();
  }

  onChange(detail) {
    this.dirty = true;
    if (!this.active) return;
    clearTimeout(this.rebuildT);
    this.rebuildT = setTimeout(() => this.rebuild(), 30);
    void detail;
  }

  baseOf(index) {
    let y = 0.05;
    const lv = store.project.levels;
    for (let i = 0; i < index; i++) y += (lv[i].height + lv[i].slab) * M;
    return y;
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

    const g = materialInfo(p.site.ground);
    if (g) { this.ground.material = getMaterial(p.site.ground); }
    this.syncItems();
    this.fitShadow();
    this.applyVisibility();
    this.applyLighting();
    this.invalidate();
  }

  bounds() {
    const b = new THREE.Box3();
    for (const lv of store.project.levels) for (const n of Object.values(lv.nodes)) { b.expandByPoint(new THREE.Vector3(n.x * M, 0, n.y * M)); b.expandByPoint(new THREE.Vector3(n.x * M, 3, n.y * M)); }
    if (b.isEmpty()) b.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
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
    this.controls.target.set(c.x, 0.6, c.z);
    this.camera.position.set(c.x + d * 0.62, Math.max(s.y, 3) + d * 0.72, c.z + d * 0.86);
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
      const tex = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(`./hdri/${name}.hdr`);
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
      tex.needsUpdate = true;
      return { tex, sunU: bx / width };
    })();
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
    const sky = await this.loadSky(name);
    if (this.currentSky !== name) { this.currentSky = name; }
    // Rotation du ciel pour que le soleil de l'image coïncide avec le vrai soleil.
    const hdriAngle = (sky.sunU - 0.5) * Math.PI * 2;
    const wanted = Math.atan2(dir.x, dir.z);
    const rotY = name === 'nuit' ? 0 : wanted - (-hdriAngle + Math.PI / 2);
    this.scene.environment = sky.tex; this.scene.background = sky.tex;
    this.scene.environmentRotation.set(0, rotY, 0); this.scene.backgroundRotation.set(0, rotY, 0);
    const day = THREE.MathUtils.smoothstep(alt, -0.06, 0.2);
    const interior = this.mode === 'walk';
    this.scene.environmentIntensity = name === 'nuit' ? 0.45 : interior ? 0.55 : 0.6;
    this.scene.backgroundIntensity = 1;
    this.sun.intensity = name === 'couvert' ? 0.5 : 3.9 * day;
    this.sun.color.setHSL(0.09, 0.8 - 0.55 * day, 0.86);
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 44);
    this.sun.castShadow = day > 0.01;
    this.hemi.intensity = interior ? 0.5 : 0.22;
    this.nightFactor = 1 - day;
    this.updateLamps();
    this.renderer.toneMappingExposure = 1.05 * this.env.exposure * (interior ? 1.35 : 1);
    this.invalidate();
  }

  setEnv(patch) { Object.assign(this.env, patch); this.applyLighting(); }

  updateLamps() {
    this.lampLights.clear();
    if (!this.env.lamps) { this.invalidate(); return; }
    const limit = this.photo ? 40 : isPhone() ? 3 : 8;
    const list = [];
    const camPos = this.camera.position;
    for (const obj of this.itemObjs.values()) {
      if (!obj.visible) continue;
      obj.traverse((m) => {
        for (const l of m.userData.lights || []) {
          const v = m.localToWorld(new THREE.Vector3(l.x, l.y, l.z));
          list.push({ v, l, d: v.distanceToSquared(camPos) });
        }
      });
    }
    list.sort((a, b) => a.d - b.d);
    for (const { v, l } of list.slice(0, limit)) {
      const pl = new THREE.PointLight(l.color, l.intensity * (0.35 + 0.65 * (this.nightFactor ?? 0)), 12, 2);
      pl.position.copy(v);
      this.lampLights.add(pl);
    }
    this.invalidate();
  }

  // ——— Mobilier ———
  async loadScanned(id) {
    if (!this.gltfCache.has(id)) this.gltfCache.set(id, new GLTFLoader().loadAsync(`./models/${id}.glb`));
    const g = await this.gltfCache.get(id);
    return g.scene.clone(true);
  }

  async makeObject(it, def) {
    const size = { w: (it.w ?? def.w) * M, d: (it.d ?? def.d) * M, h: (it.h ?? def.h) * M };
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
      root.add(obj);
      if (obj.userData.lights) root.userData.lights = obj.userData.lights;
    }
    return root;
  }

  itemY(it, def, levelIndex) {
    const lv = store.project.levels[levelIndex];
    if (def.ceiling) return this.baseOf(levelIndex) + lv.height * M;
    return this.baseOf(levelIndex) + (it.z ?? def.z ?? 0) * M;
  }

  syncItems() {
    const p = store.project; if (!p) return;
    const seen = new Set();
    p.levels.forEach((lv, li) => {
      for (const it of lv.items) {
        const def = getItem(it.cat); if (!def) continue;
        seen.add(it.id);
        const sig = `${it.cat}|${it.w}|${it.d}|${it.h}|${it.color}`;
        const place = (obj) => {
          obj.position.set(it.x * M, this.itemY(it, def, li), it.y * M);
          obj.rotation.y = (-(it.rot || 0) * Math.PI) / 180;
          obj.userData.level = li;
          obj.visible = this.levelVisible(li);
        };
        let obj = this.itemObjs.get(it.id);
        if (obj && obj.userData.sig === sig) { place(obj); continue; }
        if (obj && obj.userData.loading === sig) { continue; }
        if (obj) { this.items.remove(obj); this.itemObjs.delete(it.id); }
        const stub = new THREE.Group();
        stub.userData = { kind: 'item', id: it.id, loading: sig, sig: null };
        this.itemObjs.set(it.id, stub);
        this.items.add(stub);
        this.makeObject(it, def).then((real) => {
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
        }).catch((e) => console.warn('Modèle indisponible', def.id, e));
      }
    });
    for (const [id, obj] of this.itemObjs) if (!seen.has(id)) { this.items.remove(obj); this.itemObjs.delete(id); }
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
    this.invalidate();
  }

  levelTopVisible() { return this.preset === 'exterior' || this.mode === 'walk' ? store.project.levels.length : store.levelIndex; }

  updateWallHiding() {
    const hide = this.mode === 'orbit' && this.preset === 'dollhouse' && this.env.walls === 'auto';
    const cam = this.camera.position;
    let changed = false;
    this.house.traverse((o) => {
      if (o.userData.kind !== 'wallGroup') return;
      let vis = true;
      if (hide && o.userData.outward) {
        const dx = cam.x - o.userData.center.x, dz = cam.z - o.userData.center.z;
        vis = dx * o.userData.outward.x + dz * o.userData.outward.z < 0.1;
      }
      if (o.visible !== vis) { o.visible = vis; changed = true; }
    });
    if (changed) this.invalidate();
  }

  onCameraMove() {
    this.needsRender = true;
    if (this.photo) { this.needsPhotoReset = true; }
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

  stepWalk(dt) {
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
    c.addEventListener('pointerdown', (e) => {
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
      if (press.began) store.commit({ rebuild: false });
      else if (!press.moved) this.tap(e);
      press = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => { press = null; this.controls.enabled = this.mode === 'orbit'; });
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
    if (this.photo) { this.photoFrame(); return; }
    if (!this.needsRender) return;
    this.needsRender = false;
    if (this.composer && this.mode !== 'none') {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ——— Mode photo : tracé de chemins progressif ———
  async startPhoto({ onProgress, onReady, target = 300, quality = 'high' } = {}) {
    this.stopPhoto();
    this.selBox.visible = false;
    const gl = this.renderer.getContext();
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float');
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
    this.updateLamps();
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
    this.updateLamps();
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

/** Aperçus des meubles paramétriques, calculés une fois puis gardés en mémoire. */
export class ThumbRenderer {
  cache = new Map(); queue = []; busy = false;
  constructor() {
    this.r = null;
    this.stale = [];
    // Une vignette dessinée avant la fin du chargement de ses matières est refaite ensuite.
    THREE.DefaultLoadingManager.onStart = () => { this.loading = true; };
    THREE.DefaultLoadingManager.onLoad = () => {
      this.loading = false;
      const again = this.stale; this.stale = [];
      for (const j of again) { this.cache.delete(j.def.id); if (j.el.isConnected) this.queue.push(j); }
      this.pump();
    };
  }
  init() {
    if (this.r) return;
    const c = document.createElement('canvas');
    this.r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.setSize(192, 192, false); this.r.toneMapping = THREE.AgXToneMapping; this.r.toneMappingExposure = 1.3;
    this.scene = new THREE.Scene();
    const key = new THREE.DirectionalLight('#fff', 3.2); key.position.set(3, 6, 5);
    const fill = new THREE.HemisphereLight('#ffffff', '#c9c2b6', 2.2);
    this.scene.add(key, fill);
    this.cam = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
  }
  request(def, el) {
    const k = def.id;
    if (this.cache.has(k)) { el.src = this.cache.get(k); return; }
    this.queue.push({ def, el });
    this.pump();
  }
  pump() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    const run = () => {
      const job = this.queue.shift();
      if (job) { if (job.el.isConnected) this.render(job.def, job.el); }
      if (this.queue.length) setTimeout(run, 12); else this.busy = false;
    };
    setTimeout(run, 12);
  }
  render(def, el) {
    this.init();
    const size = { w: def.w * M, d: def.d * M, h: def.h * M };
    const obj = buildProc({ ...def.model, color: def.model?.color }, def.model?.type === 'tv' ? {} : size, undefined);
    this.scene.add(obj);
    const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2 || 1;
    const d = r / Math.sin(THREE.MathUtils.degToRad(13)) * 1.05;
    const flat = def.model?.type === 'rug';
    this.cam.position.set(c.x + d * 0.55, c.y + d * (flat ? 0.8 : 0.42), c.z + d * 0.72);
    this.cam.lookAt(c);
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.cache.set(def.id, url);
    el.src = url;
    if (this.loading) this.stale.push({ def, el });
    this.scene.remove(obj);
    obj.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  }
}
