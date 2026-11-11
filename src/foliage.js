// Végétation vivante : grappes de feuilles découpées, herbe, fleurs et eau, animées par un vent commun.
import * as THREE from 'three';
import { LOW } from './quality.js';

export const windU = { value: 0 };
const moving = [];

/** Avance le vent et l'eau. */
export function tickLife(t) {
  windU.value = t;
  for (const f of moving) f(t);
}

let seed = 91;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;

function canvasTex(size, draw, alpha = true) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  if (!alpha) { c.fillStyle = '#000'; c.fillRect(0, 0, size, size); }
  draw(c, size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** Bouquet de feuilles dessiné, avec des trous pour laisser passer le ciel. */
function leafAtlas(palette, shape = 'leaf') {
  return canvasTex(LOW ? 192 : 320, (c, S) => {
    const n = shape === 'needle' ? 240 : shape === 'scale' ? 190 : 120;
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, r = Math.sqrt(rnd()) * S * 0.46, x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r, l = S * (shape === 'needle' ? 0.13 : shape === 'scale' ? 0.05 : 0.075), rot = rnd() * 6.28;
      c.save(); c.translate(x, y); c.rotate(rot);
      c.fillStyle = palette[Math.floor(rnd() * palette.length)];
      c.beginPath();
      if (shape === 'needle') c.ellipse(0, 0, l, S * 0.0045, 0, 0, 6.28);
      else if (shape === 'scale') c.ellipse(0, 0, l * 0.5, l * 0.9, 0, 0, 6.28);
      else { c.moveTo(-l, 0); c.quadraticCurveTo(0, -l * 0.62, l, 0); c.quadraticCurveTo(0, l * 0.62, -l, 0); }
      c.fill();
      c.restore();
    }
  });
}

const swayVertex = (amp) => (shader) => {
  shader.uniforms.uWind = windU;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
    { vec4 wp0 = modelMatrix * vec4(0., 0., 0., 1.); float ph = wp0.x * .37 + wp0.z * .29; float hh = max(position.y, 0.);
      float big = sin(uWind * 1.1 + ph) * .6 + sin(uWind * 2.3 + ph * 1.7) * .4;
      float flutter = sin(uWind * 6.5 + position.x * 7. + position.z * 5. + ph);
      transformed.x += (big * hh * hh * ${amp.toFixed(4)}) + flutter * .012 * step(.4, hh);
      transformed.z += (cos(uWind * .9 + ph) * hh * hh * ${(amp * 0.7).toFixed(4)}) + flutter * .009 * step(.4, hh); }`);
};

const mats = new Map();
function leafMat(key, palette, shape, amp = 0.0016) {
  if (mats.has(key)) return mats.get(key);
  const m = new THREE.MeshStandardMaterial({ map: leafAtlas(palette, shape), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.72 });
  m.onBeforeCompile = swayVertex(amp);
  m.customProgramCacheKey = () => `leaf${amp}`;
  mats.set(key, m);
  return m;
}

/** Nuage de grappes réparti sur des ellipsoïdes ; les normales partent du centre pour donner du volume. */
function cloudGeometry(lobes, count, size) {
  const n = Math.round(count * (LOW ? 0.4 : 1)), pos = new Float32Array(n * 12), nor = new Float32Array(n * 12), uv = new Float32Array(n * 8), idx = new Uint32Array(n * 6);
  const totals = lobes.map((l) => l.rx * l.rz + l.ry * (l.rx + l.rz) * 0.5), sum = totals.reduce((a, b) => a + b, 0);
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), N = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    let pick = rnd() * sum, l = lobes[0];
    for (let k = 0; k < lobes.length; k++) { pick -= totals[k]; if (pick <= 0) { l = lobes[k]; break; } }
    const th = rnd() * 6.283, cz = rnd() * 2 - 1, st = Math.sqrt(1 - cz * cz), depth = 0.72 + rnd() * 0.3;
    v.set(Math.cos(th) * st * l.rx * depth + l.x, cz * l.ry * depth + l.y, Math.sin(th) * st * l.rz * depth + l.z);
    N.set(Math.cos(th) * st / l.rx, cz / l.ry, Math.sin(th) * st / l.rz).normalize();
    const s = size * (0.7 + rnd() * 0.6);
    a.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(N).normalize(); b.crossVectors(N, a).normalize();
    // Grappes un peu inclinées, jamais parfaitement face à la surface.
    a.addScaledVector(up, (rnd() - 0.5) * 0.5).normalize();
    for (let c = 0; c < 4; c++) {
      const sx = c === 0 || c === 3 ? -1 : 1, sy = c < 2 ? -1 : 1, o = i * 12 + c * 3;
      pos[o] = v.x + (a.x * sx + b.x * sy) * s * 0.5; pos[o + 1] = v.y + (a.y * sx + b.y * sy) * s * 0.5; pos[o + 2] = v.z + (a.z * sx + b.z * sy) * s * 0.5;
      const nx = N.x + (a.x * sx + b.x * sy) * 0.35, ny = N.y + (a.y * sx + b.y * sy) * 0.35 + 0.25, nz = N.z + (a.z * sx + b.z * sy) * 0.35, ln = Math.hypot(nx, ny, nz);
      nor[o] = nx / ln; nor[o + 1] = ny / ln; nor[o + 2] = nz / ln;
      uv[i * 8 + c * 2] = sx > 0 ? 1 : 0; uv[i * 8 + c * 2 + 1] = sy > 0 ? 1 : 0;
    }
    const b0 = i * 4; idx.set([b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const geos = new Map();
const once = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };

function leafMesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.noAO = true; return m; }

const bark = () => { if (!mats.has('bark')) mats.set('bark', new THREE.MeshStandardMaterial({ color: '#5a4a3b', roughness: 0.95 })); return mats.get('bark'); };

function branch(g, x0, y0, z0, x1, y1, z1, r0, r1) {
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), L = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 9), bark());
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); m.castShadow = true; g.add(m);
}

const OAK = ['#3f5d2a', '#4f7134', '#5e8440', '#37502a', '#6f9448'];
const CYP = ['#33502b', '#3e5f33', '#47693a', '#2b4426'];
const PINE = ['#3a5a2e', '#47693a', '#55763e', '#2f4b28'];
const BOX = ['#3d5a2b', '#4b6e34', '#577b3c', '#32492a'];

/** Feuillu : tronc, charpentières, couronne en plusieurs masses. */
export function leafyTree({ w = 3.4, h = 5 }) {
  const g = new THREE.Group(), lobes = once('oakL', () => { const out = []; for (let i = 0; i < 11; i++) { const a = rnd() * 6.28, r = rnd() * 0.32; out.push({ x: Math.cos(a) * r, y: 0.62 + rnd() * 0.26, z: Math.sin(a) * r, rx: 0.2 + rnd() * 0.12, ry: 0.13 + rnd() * 0.09, rz: 0.2 + rnd() * 0.12 }); } return out; });
  const trunk = h * 0.46, r = Math.max(0.1, w * 0.05);
  branch(g, 0, 0, 0, 0, trunk, 0, r * 1.3, r * 0.75);
  for (let i = 0; i < 5; i++) { const a = (i * 6.28) / 5 + 0.4; branch(g, 0, trunk * 0.92, 0, Math.cos(a) * w * 0.3, h * (0.68 + (i % 2) * 0.1), Math.sin(a) * w * 0.3, r * 0.5, r * 0.14); }
  const geo = once('oak', () => cloudGeometry(lobes.map((l) => ({ x: l.x, y: l.y, z: l.z, rx: l.rx, ry: l.ry, rz: l.rz })), 1500, 0.2));
  const m = leafMesh(geo, leafMat('oak', OAK, 'leaf')); m.scale.set(w, h, w); g.add(m);
  return g;
}

const OLIVE = ['#76845e', '#8a976f', '#6a7853', '#9ba57f', '#5f6d4b'];

/** Olivier : tronc court et tortueux qui se divise bas, feuillage argenté en masses claires. */
export function oliveTree({ w = 4.5, h = 4.5 }) {
  const g = new THREE.Group(), r = Math.max(0.12, w * 0.045);
  const lobes = once('oliveL', () => { const out = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28 + rnd() * 0.5, d = 0.18 + rnd() * 0.2; out.push({ x: Math.cos(a) * d, y: 0.6 + rnd() * 0.22, z: Math.sin(a) * d, rx: 0.17 + rnd() * 0.08, ry: 0.11 + rnd() * 0.06, rz: 0.17 + rnd() * 0.08 }); } return out; });
  branch(g, 0, 0, 0, 0.12 * w, h * 0.22, 0.05 * w, r * 1.5, r * 1.1);
  for (let i = 0; i < 4; i++) { const a = (i * 6.28) / 4 + 0.7, mx = 0.12 * w + Math.cos(a) * w * 0.12, mz = 0.05 * w + Math.sin(a) * w * 0.12; branch(g, 0.12 * w, h * 0.22, 0.05 * w, mx, h * 0.42, mz, r * 0.75, r * 0.5); branch(g, mx, h * 0.42, mz, Math.cos(a) * w * 0.3, h * 0.62, Math.sin(a) * w * 0.3, r * 0.5, r * 0.15); }
  const geo = once('olive', () => cloudGeometry(lobes, 1400, 0.16));
  const m = leafMesh(geo, leafMat('olive', OLIVE, 'leaf')); m.scale.set(w, h, w); g.add(m);
  return g;
}

const PALM = ['#4c6b2e', '#5a7a34', '#3f5a28', '#6a8a3e'];
/** Palmier : stipe annelé légèrement courbé, palmes arquées en éventail. */
export function palmTree({ w = 4, h = 9 }) {
  const g = new THREE.Group(), segs = 6, lean = 0.06 * h;
  let px = 0, py = 0;
  for (let i = 0; i < segs; i++) { const t0 = i / segs, t1 = (i + 1) / segs, x0 = lean * t0 * t0, x1 = lean * t1 * t1; branch(g, x0, h * 0.86 * t0, 0, x1, h * 0.86 * t1, 0, 0.2 - 0.07 * t0, 0.2 - 0.07 * t1); px = x1; py = h * 0.86 * t1; }
  const frond = once('frondGeo', () => { const s = new THREE.PlaneGeometry(1, 0.32, 8, 1); const p = s.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.5; p.setZ(i, -x * x * 0.55); p.setY(i, p.getY(i) * (1 - x * 0.75)); } s.translate(0, 0, 0); s.computeVertexNormals(); return s; });
  const mat = once('frondMat', () => new THREE.MeshStandardMaterial({ map: leafAtlas(PALM, 'needle'), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.75 }));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, m = new THREE.Mesh(frond, mat), L = w * (0.5 + 0.12 * Math.sin(i * 2.3));
    m.scale.set(L, L, L); m.position.set(px, py, 0); m.rotation.set(0, -a, 0); m.rotateZ(0.25 + 0.15 * Math.cos(i)); m.translateX(L / 2);
    m.castShadow = true; m.userData.noAO = true; g.add(m);
  }
  return g;
}

/** Cyprès de Provence, élancé et dense. */
export function cypressTree({ w = 1.1, h = 8 }) {
  const g = new THREE.Group();
  const geo = once('cyp', () => cloudGeometry([{ x: 0, y: 0.5, z: 0, rx: 0.5, ry: 0.5, rz: 0.5 }, { x: 0, y: 0.32, z: 0, rx: 0.5, ry: 0.28, rz: 0.5 }, { x: 0, y: 0.82, z: 0, rx: 0.3, ry: 0.17, rz: 0.3 }], 1500, 0.2));
  const core = new THREE.Mesh(once('cypCore', () => new THREE.SphereGeometry(0.5, 12, 16)), solidDark('#1a2a18')); core.scale.set(w * 0.82, h * 0.9, w * 0.82); core.position.y = h * 0.5; core.castShadow = true; g.add(core);
  const m = leafMesh(geo, leafMat('cyp', CYP, 'scale', 0.0007)); m.scale.set(w, h, w); g.add(m);
  branch(g, 0, 0, 0, 0, h * 0.14, 0, 0.11, 0.08);
  return g;
}

function solidDark(c) { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 1 })); return mats.get(c); }

/** Pin parasol : long fût nu et couronne plate. */
export function parasolPine({ w = 10, h = 12 }) {
  const g = new THREE.Group();
  branch(g, 0, 0, 0, 0.05 * w * 0.2, h * 0.76, 0, 0.42, 0.22);
  for (let i = 0; i < 7; i++) { const a = (i * 6.28) / 7; branch(g, 0, h * 0.72, 0, Math.cos(a) * w * 0.34, h * 0.87, Math.sin(a) * w * 0.34, 0.17, 0.05); }
  const lobes = once('pineL', () => { const o = [{ x: 0, y: 0.9, z: 0, rx: 0.44, ry: 0.065, rz: 0.44 }]; for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = 0.1 + rnd() * 0.3; o.push({ x: Math.cos(a) * r, y: 0.87 + rnd() * 0.06, z: Math.sin(a) * r, rx: 0.14 + rnd() * 0.1, ry: 0.04 + rnd() * 0.025, rz: 0.14 + rnd() * 0.1 }); } return o; });
  const geo = once('pine', () => cloudGeometry(lobes, 1500, 0.11));
  const m = leafMesh(geo, leafMat('pine', PINE, 'needle', 0.0007)); m.scale.set(w, h, w); g.add(m);
  return g;
}

/** Masse taillée : haie ou boule de buis, avec un cœur sombre pour rester bien dense. */
export function clippedShrub({ w = 1, d = 1, h = 1, ball = false }) {
  const g = new THREE.Group(), core = new THREE.Mesh(ball ? once('ballC', () => new THREE.SphereGeometry(0.5, 14, 10)) : once('boxC', () => new THREE.BoxGeometry(1, 1, 1)), solidDark('#2c4224'));
  core.scale.set(w * 0.92, h * 0.92, d * 0.92); core.position.y = h / 2; core.castShadow = true; g.add(core);
  const geo = once(ball ? 'ball' : 'hedge', () => cloudGeometry(ball ? [{ x: 0, y: 0.5, z: 0, rx: 0.5, ry: 0.5, rz: 0.5 }] : [{ x: 0, y: 0.5, z: 0.5, rx: 0.5, ry: 0.5, rz: 0.06 }, { x: 0, y: 0.5, z: -0.5, rx: 0.5, ry: 0.5, rz: 0.06 }, { x: 0, y: 1, z: 0, rx: 0.5, ry: 0.06, rz: 0.5 }, { x: 0.5, y: 0.5, z: 0, rx: 0.06, ry: 0.5, rz: 0.5 }, { x: -0.5, y: 0.5, z: 0, rx: 0.06, ry: 0.5, rz: 0.5 }], ball ? 420 : 1500, ball ? 0.28 : 0.2));
  const m = leafMesh(geo, leafMat('box', BOX, 'scale', 0.0003)); m.scale.set(w, h, d); g.add(m);
  return g;
}

/** Massif : touffes vertes piquées de fleurs. */
export function flowerBed({ w = 3, d = 0.7, h = 0.6, flower = 'lavande' }) {
  const g = new THREE.Group(), kind = flower === 'rose' ? 'rose' : 'lav';
  const geo = once(`bed${kind}`, () => { const o = []; for (let i = 0; i < 14; i++) o.push({ x: -0.5 + (i + 0.5) / 14, y: 0.5, z: (rnd() - 0.5) * 0.4, rx: 0.1, ry: 0.5, rz: 0.3 }); return cloudGeometry(o, 900, 0.09); });
  if (!mats.has(`bed${kind}`)) {
    const tx = canvasTex(256, (c, S) => {
      for (let i = 0; i < 90; i++) { c.strokeStyle = ['#4d6b3a', '#5d7d45', '#3f5a31'][i % 3]; c.lineWidth = 1.6; const x = S / 2 + (rnd() - 0.5) * S * 0.8; c.beginPath(); c.moveTo(x, S); c.quadraticCurveTo(x + (rnd() - 0.5) * 30, S * 0.5, x + (rnd() - 0.5) * 50, S * 0.25); c.stroke(); }
      for (let i = 0; i < (kind === 'rose' ? 26 : 60); i++) { const x = S * (0.08 + rnd() * 0.84), y = S * (0.06 + rnd() * 0.42); c.fillStyle = kind === 'rose' ? ['#d9849a', '#f2b7c2', '#c9506f', '#f6e4d8'][i % 4] : ['#7a5fb0', '#8d73c4', '#6a4fa0'][i % 3]; c.beginPath(); if (kind === 'rose') c.arc(x, y, S * 0.04, 0, 6.28); else c.ellipse(x, y, S * 0.012, S * 0.05, 0, 0, 6.28); c.fill(); }
    });
    const m = new THREE.MeshStandardMaterial({ map: tx, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
    m.onBeforeCompile = swayVertex(0.05); m.customProgramCacheKey = () => 'bed';
    mats.set(`bed${kind}`, m);
  }
  const m = leafMesh(geo, mats.get(`bed${kind}`)); m.scale.set(w, h, d); g.add(m);
  return g;
}

/** Arbres lointains : de vrais volumes de feuilles, sans détail inutile. */
export function distantTrees(list) {
  const lobes = [{ x: 0, y: 0.62, z: 0, rx: 0.5, ry: 0.36, rz: 0.5 }, { x: 0.18, y: 0.82, z: -0.1, rx: 0.3, ry: 0.2, rz: 0.3 }, { x: -0.2, y: 0.42, z: 0.15, rx: 0.32, ry: 0.22, rz: 0.32 }];
  const m = new THREE.InstancedMesh(cloudGeometry(lobes, LOW ? 120 : 170, 0.34), leafMat('oak', OAK, 'leaf'), list.length), o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.rotation.y = rnd() * 6.283; o.scale.set(t.w, t.h, t.w); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(t.color)); });
  m.frustumCulled = false; m.userData.noAO = true; m.userData.kind = 'landscape';
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.09, 1, 6).translate(0, 0.5, 0), bark(), list.length);
  list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.rotation.y = 0; o.scale.set(t.w * 0.6, t.h * 0.55, t.w * 0.6); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix); });
  trunks.frustumCulled = false; trunks.userData.kind = 'landscape';
  return [m, trunks];
}

/** Eau : petites vagues en mouvement, mosaïque au fond, reflets de lumière qui dansent. */
export function poolWaterMaterial() {
  if (mats.has('water')) return mats.get('water');
  const S = 512, normal = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d'), im = c.createImageData(S, S), waves = [[3, 1, 1], [1, 4, 0.8], [6, 3, 0.45], [5, -7, 0.3], [11, 5, 0.18], [-9, 13, 0.12]].map(([a, b, k]) => [a, b, k, rnd() * 6.28]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let dx = 0, dy = 0;
      for (const [a, b, k, p] of waves) { const c0 = Math.cos(((a * x + b * y) / S) * 6.283 + p) * k; dx += c0 * a; dy += c0 * b; }
      const i = (y * S + x) * 4; im.data[i] = 128 + dx * 9; im.data[i + 1] = 128 + dy * 9; im.data[i + 2] = 255; im.data[i + 3] = 255;
    }
    c.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.6, 0.9);
    return t;
  })();
  // Mosaïque de 2,5 cm répétée sur tout le bassin (les coordonnées de texture sont en mètres).
  const tile = canvasTex(512, (c, Z) => {
    c.fillStyle = '#3ea6bb'; c.fillRect(0, 0, Z, Z);
    const n = 80, q = Z / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const k = rnd(); if (k < 0.25) { c.fillStyle = k < 0.12 ? 'rgba(20,90,115,.18)' : 'rgba(150,225,235,.16)'; c.fillRect(x * q, y * q, q, q); } }
    c.strokeStyle = 'rgba(235,250,250,.22)'; c.lineWidth = 1;
    for (let i = 0; i <= n; i++) { const p = i * q; c.beginPath(); c.moveTo(p, 0); c.lineTo(p, Z); c.moveTo(0, p); c.lineTo(Z, p); c.stroke(); }
  }, false);
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(0.5, 0.5);
  const caustic = canvasTex(512, (c, Z) => {
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2.2;
    for (let i = 0; i < 90; i++) { const x = rnd() * Z, y = rnd() * Z; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 70, x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 90, x + (rnd() - 0.5) * 110, y + (rnd() - 0.5) * 110); c.stroke(); }
  }, false);
  caustic.wrapS = caustic.wrapT = THREE.RepeatWrapping; caustic.repeat.set(2.4, 1.2);
  const m = new THREE.MeshPhysicalMaterial({ map: tile, normalMap: normal, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#7fd6e2', emissiveMap: caustic, emissiveIntensity: 0.22, envMapIntensity: 1.25 });
  m.normalScale.set(0.2, 0.2);
  moving.push((t) => { normal.offset.set(t * 0.012, t * 0.008); caustic.offset.set(-t * 0.02, t * 0.014); });
  mats.set('water', m);
  return m;
}

/** Herbe et fleurs des champs : touffes instanciées, posées seulement sur la pelouse. */
export function buildMeadow(accept) {
  const group = new THREE.Group(), blades = LOW ? 5000 : 42000, flowers = LOW ? 400 : 3200;
  const tuft = () => {
    // Touffe plus haute que large : de près, on lit des brins, pas des rubans.
    const a = new THREE.PlaneGeometry(0.22, 0.28, 1, 1); a.translate(0, 0.14, 0);
    const b = a.clone().rotateY(1.05), c = a.clone().rotateY(-1.05), parts = [a, b, c], pos = [], uv = [], idx = [];
    let off = 0;
    for (const p of parts) { pos.push(...p.attributes.position.array); uv.push(...p.attributes.uv.array); idx.push(...Array.from(p.index.array, (i) => i + off)); off += p.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx);
    return g;
  };
  const instanced = (mat, n, sizeA, sizeB, tint, radius) => {
    const m = new THREE.InstancedMesh(tuft(), mat, n), o = new THREE.Object3D(), c = new THREE.Color();
    let k = 0;
    for (let tries = 0; k < n && tries < n * 8; tries++) {
      const r = radius * Math.pow(rnd(), 0.72), a = rnd() * 6.283, s = accept(r * Math.cos(a), r * Math.sin(a));
      if (s === null) continue;
      o.position.set(s.x, s.y - 0.01, s.z); o.rotation.y = rnd() * 6.283; const e = sizeA + rnd() * (sizeB - sizeA); o.scale.set(e, e * (0.8 + rnd() * 0.5), e); o.updateMatrix();
      m.setMatrixAt(k, o.matrix); m.setColorAt(k, c.set(tint[Math.floor(rnd() * tint.length)]).multiplyScalar(0.92 + rnd() * 0.16)); k++;
    }
    m.count = k; m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false; m.userData.noAO = true; m.userData.kind = 'landscape';
    group.add(m);
  };
  if (!mats.has('grass')) {
    // Brins fins, plus sombres au pied qu'à la pointe : la touffe a du volume au lieu d'un aplat clair.
    const tx = canvasTex(LOW ? 256 : 512, (c, S) => {
      const k = S / 256;
      for (let i = 0; i < 230; i++) {
        const x = rnd() * S, top = S * (0.04 + rnd() * 0.5), g = c.createLinearGradient(0, S, 0, top), tip = ['#ffffff', '#eef5df', '#dde8c6'][i % 3];
        g.addColorStop(0, '#7d8a6a'); g.addColorStop(0.55, tip); g.addColorStop(1, tip);
        c.strokeStyle = g; c.lineWidth = (0.9 + rnd() * 1.3) * k; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, S); c.quadraticCurveTo(x + (rnd() - 0.5) * 8 * k, S * 0.55, x + (rnd() - 0.5) * 22 * k, top); c.stroke();
      }
    });
    const g = new THREE.MeshStandardMaterial({ map: tx, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.92 });
    g.onBeforeCompile = instancedSway; g.customProgramCacheKey = () => 'grass';
    mats.set('grass', g);
    const fx = canvasTex(256, (c, S) => { for (let i = 0; i < 18; i++) { const x = S * (0.12 + rnd() * 0.76), y = S * (0.08 + rnd() * 0.5); c.strokeStyle = '#6f8c4e'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, S); c.lineTo(x + (rnd() - 0.5) * 16, y); c.stroke(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, S * 0.03, 0, 6.28); c.fill(); c.fillStyle = '#f0c63c'; c.beginPath(); c.arc(x, y, S * 0.012, 0, 6.28); c.fill(); } });
    const f = new THREE.MeshStandardMaterial({ map: fx, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 });
    f.onBeforeCompile = instancedSway; f.customProgramCacheKey = () => 'grass';
    mats.set('flowers', f);
  }
  instanced(mats.get('grass'), blades, 0.8, 1.35, ['#6f9447', '#7da04e', '#638640', '#8cad58', '#98b462'], 46);
  instanced(mats.get('flowers'), flowers, 0.9, 1.3, ['#ffffff', '#fff2c9', '#e9d4f0', '#f7c5c5', '#f4a53b'], 46);
  return group;
}

function instancedSway(shader) {
  shader.uniforms.uWind = windU;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
    { vec2 w = instanceMatrix[3].xz; float gust = sin(uWind * 1.4 + w.x * .22 + w.y * .17) * .55 + sin(uWind * 3.1 + w.x * .9 - w.y * .6) * .25; float hh = position.y * position.y * 6.; transformed.x += gust * hh * .3; transformed.z += gust * hh * .18;
      /* Au loin, le gazon du sol suffit : l'image reste nette. */
      transformed *= 1. - smoothstep(14., 38., distance(cameraPosition, instanceMatrix[3].xyz)); }`);
}

/** Vol d'oiseaux qui tourne lentement au-dessus du terrain. */
export function birdFlock(cx, cz) {
  const n = LOW ? 5 : 11, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0.34, 0, 0.02, 0, 0, -0.12, 0, 0, 0.12, 0, 0, -0.12, -0.34, 0, 0.02], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  const mat = new THREE.MeshStandardMaterial({ color: '#23272b', roughness: 0.9, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windU;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
      { float id = instanceMatrix[3].y; transformed.y += abs(position.x) * sin(uWind * 9. + id * 11.) * 1.1; }`);
  };
  mat.customProgramCacheKey = () => 'bird';
  const m = new THREE.InstancedMesh(g, mat, n), o = new THREE.Object3D();
  m.frustumCulled = false; m.userData.noAO = true; m.userData.kind = 'landscape';
  const place = (t) => {
    for (let i = 0; i < n; i++) {
      const a = t * 0.09 + i * 0.14, r = 46 + Math.sin(i * 3.3) * 8;
      o.position.set(cx + Math.cos(a) * r, 26 + Math.sin(i * 2.1) * 3 + Math.sin(t * 0.4 + i) * 0.8, cz + Math.sin(a) * r);
      o.rotation.y = -a; o.scale.setScalar(1.6); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  };
  place(0);
  moving.push(place);
  return m;
}

/** Flammes en voile lumineux, derrière des bûches. */
export function flames(width, height) {
  const g = new THREE.Group();
  if (!mats.has('flame')) {
    const tx = canvasTex(256, (c, S) => {
      for (let i = 0; i < 26; i++) {
        const x = S * (0.15 + rnd() * 0.7), h = S * (0.35 + rnd() * 0.5), w = S * (0.05 + rnd() * 0.08), gr = c.createLinearGradient(0, S, 0, S - h);
        gr.addColorStop(0, 'rgba(255,214,120,.95)'); gr.addColorStop(0.35, 'rgba(255,130,30,.85)'); gr.addColorStop(0.8, 'rgba(210,50,5,.42)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
        c.fillStyle = gr; c.beginPath(); c.moveTo(x - w, S); c.bezierCurveTo(x - w * 1.2, S - h * 0.5, x + (rnd() - 0.5) * w, S - h * 0.7, x + (rnd() - 0.5) * w * 2, S - h); c.bezierCurveTo(x + w * 0.6, S - h * 0.6, x + w * 1.2, S - h * 0.3, x + w, S); c.fill();
      }
    });
    mats.set('flame', new THREE.MeshBasicMaterial({ map: tx, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  }
  for (const [z, s] of [[0, 1], [-0.07, 0.86], [0.06, 0.92]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(width * s, height * s), mats.get('flame')); m.position.set((z * 3), (height * s) / 2, z); m.userData.noAO = true; g.add(m); }
  return g;
}
