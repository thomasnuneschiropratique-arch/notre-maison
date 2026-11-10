// Terrain en 3D : relief découpé sous la maison, sol peint, paysage jusqu'à l'horizon.
import * as THREE from 'three';
import { getMaterial } from './materials.js';
import { getItem } from './catalog.js';
import { GROUNDS, materialInfo } from './materials-data.js';
import { T_N, T_SIZE, terrainOf, heightAt, environmentOf, fbm } from './terrain.js';
import { pointInPolygon } from './geometry.js';
import { LOW } from './quality.js';
import { buildMeadow, birdFlock, distantTrees } from './foliage.js';

const M = 0.01;
const wet = () => new THREE.MeshStandardMaterial({ color: '#2f5f78', roughness: 0.07, metalness: 0.15 });

/** Coupe un triangle (x, y, z) par la droite qui porte un segment du plan. */
function splitByLine(tri, a, b, out) {
  const side = (v) => (b.x - a.x) * (v[2] - a.y) - (b.y - a.y) * (v[0] - a.x);
  const s = tri.map(side);
  if (s.every((v) => v >= -1e-6) || s.every((v) => v <= 1e-6)) { out.push(tri); return; }
  const onA = [], onB = [];
  for (let i = 0; i < 3; i++) {
    const p = tri[i], q = tri[(i + 1) % 3], sp = s[i], sq = s[(i + 1) % 3];
    if (sp >= 0) onA.push(p); else onB.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq), c = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      onA.push(c); onB.push(c);
    }
  }
  for (const f of [onA, onB]) for (let i = 1; i + 1 < f.length; i++) out.push([f[0], f[i], f[i + 1]]);
}

function nearGeometry(m, polys) {
  const half = (T_N - 1) / 2, pos = [], nor = [], uv = [];
  const edges = [];
  for (const poly of polys) for (let i = 0; i < poly.length; i++) edges.push([poly[i], poly[(i + 1) % poly.length]]);
  const box = polys.length ? { x0: Math.min(...polys.flat().map((p) => p.x)) / 100, x1: Math.max(...polys.flat().map((p) => p.x)) / 100, y0: Math.min(...polys.flat().map((p) => p.y)) / 100, y1: Math.max(...polys.flat().map((p) => p.y)) / 100 } : null;
  const cx = m ? m.cx * M : 0, cy = m ? m.cy * M : 0;
  const H = (x, z) => heightAt(m, x * 100, z * 100);
  const emit = (t) => {
    for (const v of t) {
      pos.push(v[0], v[1], v[2]);
      const e = 0.5, dx = H(v[0] + e, v[2]) - H(v[0] - e, v[2]), dz = H(v[0], v[2] + e) - H(v[0], v[2] - e);
      const l = Math.hypot(dx, 2 * e, dz);
      nor.push(-dx / l, (2 * e) / l, -dz / l);
      uv.push(v[0], v[2]);
    }
  };
  const inside = (x, z) => polys.some((p) => pointInPolygon({ x: x * 100, y: z * 100 }, p));
  for (let j = 0; j < T_N - 1; j++) for (let i = 0; i < T_N - 1; i++) {
    const x0 = i - half + cx, x1 = x0 + 1, z0 = j - half + cy, z1 = z0 + 1;
    const a = [x0, H(x0, z0), z0], b = [x1, H(x1, z0), z0], c = [x1, H(x1, z1), z1], d = [x0, H(x0, z1), z1];
    const tris = [[a, c, b], [a, d, c]];
    if (box && x1 >= box.x0 && x0 <= box.x1 && z1 >= box.y0 && z0 <= box.y1) {
      let list = tris;
      for (const [p, q] of edges) {
        if (Math.max(p.x, q.x) * M < x0 || Math.min(p.x, q.x) * M > x1 || Math.max(p.y, q.y) * M < z0 || Math.min(p.y, q.y) * M > z1) continue;
        const next = [];
        for (const t of list) splitByLine(t, { x: p.x * M, y: p.y * M }, { x: q.x * M, y: q.y * M }, next);
        list = next;
      }
      for (const t of list) if (!inside((t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][2] + t[1][2] + t[2][2]) / 3)) emit(t);
    } else for (const t of tris) emit(t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Paysage : la pente se prolonge, puis les collines de l'environnement prennent le relais. */
function landscape(m, env) {
  const cx = m ? m.cx * M : 0, cy = m ? m.cy * M : 0, lim = T_SIZE / 2;
  const clampH = (x, z) => heightAt(m, Math.max(cx - lim, Math.min(cx + lim, x)) * 100, Math.max(cy - lim, Math.min(cy + lim, z)) * 100);
  return (x, z) => {
    const ex = Math.max(cx - lim, Math.min(cx + lim, x)), ez = Math.max(cy - lim, Math.min(cy + lim, z));
    const d = Math.hypot(x - ex, z - ez);
    const nx = d ? (x - ex) / d : 0, nz = d ? (z - ez) / d : 0;
    const base = clampH(x, z), grad = base - clampH(ex - nx * 8, ez - nz * 8);
    // La pente continue sur ~150 m puis s'adoucit.
    const run = 150 * (1 - Math.exp(-d / 150));
    const ramp = Math.min(1, d / 260);
    const r = Math.hypot(x - cx, z - cy);
    const far = (fbm(x * 0.0022 + 11, z * 0.0022 + 4, 5) - 0.42) * env.hills * ramp * (env.id === 'montagne' ? Math.min(1, r / 900) * 2.2 : 1);
    let h = base + (grad / 8) * run + far;
    if (env.sea !== undefined) {
      const shore = Math.min(1, Math.max(0, (r - 140) / 200));
      const toSea = env.lake ? fbm(x * 0.004 + 3, z * 0.004 + 8, 3) > 0.46 : (z - cy) > -40 + (fbm(x * 0.003, 2, 3) - 0.5) * 160;
      if (toSea) h = h * (1 - shore) + (env.sea - 8) * shore;
    }
    return h;
  };
}

function farGeometry(hAt, env, cx, cz) {
  // Même finesse partout : une grille plus grossière faisait remonter de grands triangles verts à travers les dallages.
  const step = 40, R = 2400, inner = T_SIZE / 2 - 3;
  const pos = [], col = [], idx = [];
  const n = Math.round((2 * R) / step) + 1, base = new THREE.Color(env.far).multiplyScalar(0.44), field = new THREE.Color(env.far).lerp(new THREE.Color('#b09a5e'), 0.5).multiplyScalar(0.5), rock = new THREE.Color('#6b685f'), snow = new THREE.Color('#f2f4f6'), haze = new THREE.Color('#b4c3d0');
  const c = new THREE.Color();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = cx - R + i * step, z = cz - R + j * step, under = Math.abs(x - cx) < inner + 2 && Math.abs(z - cz) < inner + 2, y = hAt(x, z) - (under ? 4 : 0);
    // Sous le terrain détaillé, le paysage lointain s'enfonce : il ne traverse jamais la maison, même avec une grille grossière.
    pos.push(x, y, z);
    c.copy(base).lerp(field, Math.max(0, Math.min(1, (fbm(x * 0.012 + 5, z * 0.012, 3) - 0.42) * 7))).multiplyScalar(0.8 + fbm(x * 0.05, z * 0.05, 2) * 0.45);
    if (env.snow) { if (y > 170) c.lerp(snow, Math.min(1, (y - 170) / 50)); else if (y > 90) c.lerp(rock, (y - 90) / 80); }
    // Perspective atmosphérique : plus c'est loin, plus la couleur tire vers le ciel.
    c.lerp(haze, Math.min(0.72, Math.hypot(x - cx, z - cz) / 2600));
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const x = cx - R + i * step, z = cz - R + j * step;
    if (x >= cx - inner && x + step <= cx + inner && z >= cz - inner && z + step <= cz + inner) continue;
    const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Arbres et bâtiments lointains, fondus en une seule pièce. */
function scatter(hAt, env, cx, cz) {
  const pos = [], nor = [], col = [], idx = [];
  const add = (geo, m, color) => {
    const start = pos.length / 3, g = geo.clone().applyMatrix4(m), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(color.r, color.g, color.b); }
    for (const i of g.index.array) idx.push(start + i);
    g.dispose();
  };
  const cone = new THREE.ConeGeometry(1, 1, 7, 1), blob = new THREE.IcosahedronGeometry(1, 2), cube = new THREE.BoxGeometry(1, 1, 1);
  // Silhouette irrégulière et facettes : au loin, ça se lit comme un feuillage.
  { const q = blob.attributes.position; for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), z = q.getZ(i), k = 1 + 0.16 * Math.sin(7 * x + 3) * Math.sin(6 * y + 1) * Math.sin(8 * z + 2) + 0.07 * Math.sin(17 * x + y * 13); q.setXYZ(i, x * k, y * k, z * k); } blob.computeVertexNormals(); }
  if (!blob.index) blob.setIndex([...Array(blob.attributes.position.count).keys()]);
  const mat = new THREE.Matrix4(), c = new THREE.Color();
  let seed = 3;
  const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const count = Math.round(env.trees * (LOW ? 0.4 : 1)), leafy = [];
  for (let i = 0; i < count; i++) {
    const a = R() * Math.PI * 2, r = 85 + R() ** 1.4 * 900, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = hAt(x, z);
    if (env.sea !== undefined && y < env.sea + 1) continue;
    const h = 7 + R() * 11, w = h * (0.28 + R() * 0.16);
    c.set(env.tree).multiplyScalar(0.75 + R() * 0.5).lerp(new THREE.Color('#b4c3d0'), Math.min(0.42, r / 2200));
    if (env.id === 'neige') c.lerp(new THREE.Color('#ffffff'), 0.45);
    if (env.id === 'foret' || env.id === 'montagne') add(cone, mat.compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w)), c);
    else leafy.push({ x, y: y - 0.3, z, w: w * 2.4, h: h * 1.1, color: c.clone().multiplyScalar(3.4) });
  }
  if (env.city) for (let i = 0; i < (LOW ? 240 : 620); i++) {
    const a = R() * Math.PI * 2, r = 90 + R() * 800, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const w = 8 + R() * 14, d = 8 + R() * 14, h = 5 + R() ** 3 * 34;
    c.set(R() > 0.5 ? '#d9d2c4' : '#b9aa96').multiplyScalar(0.8 + R() * 0.3);
    add(cube, mat.compose(new THREE.Vector3(x, hAt(x, z) + h / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 0.5), new THREE.Vector3(w, h, d)), c);
  }
  if (!pos.length) return { leafy };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return { geo: g, leafy };
}

const images = new Map();
function image(t) {
  if (!images.has(t)) images.set(t, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `./${LOW ? 'textures-s' : 'textures'}/${t}/diff.webp`; }));
  return images.get(t);
}

/** Sol peint : assemble les matières selon le masque dessiné au pinceau. */
async function bakeGround(project, m) {
  const size = LOW ? 1024 : 2048, pxm = size / T_SIZE;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const baseInfo = materialInfo(project.site.ground) || GROUNDS[0];
  const fillWith = async (target, info) => {
    const img = await image(info.t), tile = document.createElement('canvas'), s = Math.max(8, Math.round(info.s * pxm));
    tile.width = tile.height = s;
    const t = tile.getContext('2d');
    t.drawImage(img, 0, 0, s, s);
    if (info.tint) { t.globalCompositeOperation = 'multiply'; t.fillStyle = info.tint; t.fillRect(0, 0, s, s); }
    target.fillStyle = target.createPattern(tile, 'repeat');
    target.fillRect(0, 0, size, size);
  };
  await fillWith(ctx, baseInfo);
  const used = [...new Set(m.p)].filter((v) => v);
  for (const v of used) {
    const info = GROUNDS[v - 1]; if (!info) continue;
    const layer = document.createElement('canvas'); layer.width = layer.height = size;
    const l = layer.getContext('2d');
    await fillWith(l, info);
    const mask = document.createElement('canvas'); mask.width = mask.height = T_N;
    const mc = mask.getContext('2d'), im = mc.createImageData(T_N, T_N);
    for (let k = 0; k < m.p.length; k++) im.data[k * 4 + 3] = m.p[k] === v ? 255 : 0;
    mc.putImageData(im, 0, 0);
    l.globalCompositeOperation = 'destination-in';
    l.imageSmoothingEnabled = true;
    l.drawImage(mask, 0, 0, size, size);
    ctx.drawImage(layer, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  tex.repeat.set(1 / T_SIZE, 1 / T_SIZE);
  const half = T_SIZE / 2, cx = m.cx * M, cy = m.cy * M;
  tex.offset.set((half - cx) / T_SIZE, (half - cy) / T_SIZE);
  tex.flipY = false;
  const mat = getMaterial(project.site.ground).clone();
  mat.map = tex; mat.color.setScalar(Math.min(baseInfo.gain || 1, 1.6)); mat.needsUpdate = true;
  return mat;
}

/** Terrasses et piscines : pas d'herbe dessus. */
function outdoorSlabs(project) {
  const out = [];
  for (const l of project.levels) for (const it of l.items) {
    const def = getItem(it.cat); if (!def || !['terrasse', 'piscine'].includes(def.sub)) continue;
    const a = (it.rot || 0) % 180 === 90, w = (a ? it.d ?? def.d : it.w ?? def.w) / 2 + 8, d = (a ? it.w ?? def.w : it.d ?? def.d) / 2 + 8;
    out.push([Math.round(it.x - w), Math.round(it.y - d), Math.round(it.x + w), Math.round(it.y + d)]);
  }
  return out;
}

export class TerrainView {
  group = new THREE.Group(); near = null; far = null; extras = []; sig = ''; farSig = '';
  constructor(scene, onChange) { this.scene = scene; this.onChange = onChange; scene.add(this.group); this.group.name = 'terrain'; }

  /** `polys` : pièces à ne pas recouvrir de terre. */
  update(project, polys, force) {
    const m = terrainOf(project), env = environmentOf(project);
    const slabs = outdoorSlabs(project), sig = `${JSON.stringify(polys)}|${project.site.ground}|${JSON.stringify(slabs)}`;
    const stamp = m?.src ?? 'plat';
    const farSig = `${env.id}|${stamp}`;
    if (force || sig !== this.sig || stamp !== this.stamp) {
      this.sig = sig; this.stamp = stamp;
      this.rebuildNear(project, m, polys);
      this.rebuildMeadow(project, m, polys, slabs);
    }
    if (farSig !== this.farSig) { this.farSig = farSig; this.rebuildFar(m, env); }
  }

  rebuildNear(project, m, polys) {
    const old = this.near;
    const geo = nearGeometry(m, polys);
    const mesh = new THREE.Mesh(geo, getMaterial(project.site.ground));
    mesh.receiveShadow = true; mesh.castShadow = true; mesh.userData.kind = 'ground';
    this.group.add(mesh); this.near = mesh;
    if (old) { this.group.remove(old); old.geometry.dispose(); }
    const token = (this.bakeToken = (this.bakeToken || 0) + 1);
    if (m && m.p.some((v) => v)) bakeGround(project, m).then((mat) => { if (token === this.bakeToken && this.near === mesh) { mesh.material = mat; this.onChange?.(); } }).catch(() => {});
  }

  /** Herbe, fleurs et oiseaux, seulement sur un jardin engazonné. */
  rebuildMeadow(project, m, polys, slabs) {
    if (this.meadow) { this.group.remove(this.meadow); this.meadow.traverse((o) => o.geometry?.dispose()); this.meadow.children.forEach((o) => o.dispose?.()); this.meadow = null; }
    if (!m || !/herbe|grass|pelouse/i.test(`${project.site.ground} ${materialInfo(project.site.ground)?.name || ''}`)) return;
    const cx = m.cx * M, cz = m.cy * M, half = (T_N - 1) / 2;
    const accept = (dx, dz) => {
      const x = cx + dx, z = cz + dz, gx = Math.round(dx + half), gz = Math.round(dz + half);
      if (gx < 0 || gz < 0 || gx >= T_N || gz >= T_N || m.p[gz * T_N + gx]) return null;
      const X = x * 100, Y = z * 100;
      if (slabs.some((s) => X > s[0] && X < s[2] && Y > s[1] && Y < s[3])) return null;
      if (polys.some((p) => pointInPolygon({ x: X, y: Y }, p))) return null;
      return { x, y: heightAt(m, X, Y), z };
    };
    this.meadow = buildMeadow(accept);
    this.group.add(this.meadow);
    if (!this.birds) { this.birds = birdFlock(0, 0); this.group.add(this.birds); }
    this.birds.position.set(cx, 0, cz);
  }

  rebuildFar(m, env) {
    for (const e of this.extras) { this.group.remove(e); e.geometry.dispose(); }
    this.extras = [];
    const cx = m ? m.cx * M : 0, cz = m ? m.cy * M : 0, hAt = landscape(m, env);
    const mk = (geo, mat) => { const x = new THREE.Mesh(geo, mat); x.receiveShadow = false; x.userData.kind = 'landscape'; this.group.add(x); this.extras.push(x); return x; };
    this.vmat ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    mk(farGeometry((x, z) => hAt(x, z) - 0.35, env, cx, cz), this.vmat);
    const s = scatter(hAt, env, cx, cz);
    if (s.geo) mk(s.geo, this.vmat);
    if (s.leafy.length) for (const t of distantTrees(s.leafy)) { this.group.add(t); this.extras.push(t); }
    if (env.sea !== undefined) { const w = mk(new THREE.PlaneGeometry(6000, 6000), wet()); w.rotation.x = -Math.PI / 2; w.position.set(cx, env.sea, cz); }
    this.onChange?.();
  }
}
