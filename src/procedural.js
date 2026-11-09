// Meubles paramétriques : générés aux dimensions exactes du produit. Origine au sol, largeur en X, façade vers +Z, unités en mètres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { solid, fabric, wood, glass, mirror, ceramic, chrome, blackMetal, brass, emissive, finishFromColor, texturedMaterial } from './materials.js';
import { carModel } from './cars.js';
import { leafyTree, cypressTree, parasolPine, clippedShrub, flowerBed, poolWaterMaterial, flames } from './foliage.js';

/** UV en mètres par projection sur l'axe dominant, pour que les textures gardent leur échelle réelle. */
function uvMeters(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
    else if (ax >= az) { uv[i * 2] = p.getZ(i); uv[i * 2 + 1] = p.getY(i); }
    else { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getY(i); }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(uvMeters(geo), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Boîte posée : (x, z) centre, y = bas de la boîte. */
function B(g, w, h, d, mat, x, y, z, r = 0.002) {
  const seg = r > 0.015 ? 4 : 1;
  const geo = r > 0 && Math.min(w, h, d) > r * 2.2 ? new RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d);
  const m = mesh(geo, mat, x, y + h / 2, z);
  g.add(m);
  return m;
}

function C(g, r1, r2, h, mat, x, y, z, seg = 24) {
  const m = mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y + h / 2, z);
  g.add(m);
  return m;
}

function S(g, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = mesh(new THREE.SphereGeometry(r, 24, 16), mat, x, y, z);
  m.scale.set(sx, sy, sz);
  g.add(m);
  return m;
}

const handleBar = (g, x, y, z, len, vertical, mat = blackMetal()) => {
  const m = B(g, vertical ? 0.012 : len, vertical ? len : 0.012, 0.012, mat, x, y, z + 0.02);
  return m;
};

function drawerFronts(g, { w, h, z, y0, cols, rows, finish, gap = 0.004, handle = 'bar' }) {
  const cw = (w - gap * (cols + 1)) / cols, rh = (h - gap * (rows + 1)) / rows;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = -w / 2 + gap + cw / 2 + c * (cw + gap);
    const y = y0 + gap + r * (rh + gap);
    B(g, cw, rh, 0.018, finish, x, y, z);
    if (handle === 'bar') handleBar(g, x, y + rh * 0.68, z, Math.min(cw * 0.3, 0.16));
    if (handle === 'knob') S(g, 0.014, brass(), x, y + rh / 2, z + 0.024);
  }
}

// ——— Séjour ———
function sofa(p) {
  const g = new THREE.Group();
  const { w, d, h = 0.84, color = '#b7ab98', kind = 'lin', chaise = null, seats = 3 } = p;
  const mat = fabric(color, kind);
  const legH = 0.09, seatH = 0.2, baseH = 0.16, arm = Math.min(0.2, w * 0.1), back = 0.2;
  const coreD = chaise ? Math.min(d * 0.62, 1) : d;
  const zCore = -d / 2 + coreD / 2;
  const legMat = chaise ? blackMetal() : wood('noyer');
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(g, 0.022, 0.016, legH, legMat, lx * (w / 2 - 0.08), 0, zCore + lz * (coreD / 2 - 0.08), 12);
  B(g, w, baseH, coreD, mat, 0, legH, zCore, 0.03);
  B(g, w - 0.02, h - legH, back, mat, 0, legH, zCore - coreD / 2 + back / 2, 0.05);
  const armH = h * 0.74 - legH;
  for (const sx of [-1, 1]) B(g, arm, armH, coreD, mat, sx * (w / 2 - arm / 2), legH, zCore, 0.05);
  const n = Math.max(1, seats), inner = w - 2 * arm, sw = inner / n, sd = coreD - back - 0.01;
  const top = legH + baseH;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + sw / 2 + i * sw;
    B(g, sw - 0.012, seatH, sd, mat, x, top - 0.02, zCore - coreD / 2 + back + sd / 2, 0.055);
    const c = B(g, sw - 0.03, 0.42, 0.17, mat, x, top + seatH - 0.05, zCore - coreD / 2 + back + 0.07, 0.07);
    c.rotation.x = -0.14;
  }
  if (chaise) {
    const sign = chaise === 'left' ? -1 : 1;
    const cw = Math.min(0.95, w * 0.36), cd = d - coreD + 0.25;
    const x = sign * (w / 2 - cw / 2), z = d / 2 - cd / 2;
    B(g, cw, baseH, cd, mat, x, legH, z, 0.03);
    B(g, cw - 0.03, seatH, cd - 0.02, mat, x, top - 0.02, z, 0.055);
    for (const lx of [-1, 1]) C(g, 0.022, 0.016, legH, legMat, x + lx * (cw / 2 - 0.08), 0, d / 2 - 0.08, 12);
  }
  const accents = ['#a8927a', '#e8e0d0', '#6d6a5c'];
  [-1, 1].forEach((sx, i) => {
    const m = B(g, 0.44, 0.44, 0.14, fabric(accents[i], 'velours'), sx * (inner / 2 - 0.28), top + seatH - 0.03, zCore - coreD / 2 + back + 0.21, 0.065);
    m.rotation.x = -0.28; m.rotation.z = sx * 0.1;
  });
  return g;
}

function armchair(p) { return sofa({ ...p, seats: 1, chaise: null }); }

function tvBench(p) {
  const g = new THREE.Group();
  const { w, d, h, finish } = p;
  const leg = Math.min(0.1, h * 0.2);
  B(g, w, 0.03, d, finish, 0, h - 0.03, 0);
  B(g, w, 0.03, d, finish, 0, leg, 0);
  for (const sx of [-1, 1]) B(g, 0.03, h - leg, d, finish, sx * (w / 2 - 0.015), leg, 0);
  B(g, w - 0.04, h - leg, 0.012, finish, 0, leg, -d / 2 + 0.006);
  const cols = Math.max(2, Math.round(w / 0.6));
  drawerFronts(g, { w: w - 0.06, h: h - leg - 0.06, z: d / 2 - 0.012, y0: leg + 0.03, cols, rows: 1, finish, handle: 'bar' });
  for (const lx of [-1, 1]) for (const lz of [-1, 1]) C(g, 0.016, 0.012, leg, blackMetal(), lx * (w / 2 - 0.08), 0, lz * (d / 2 - 0.05), 10);
  return g;
}

function tv(p) {
  const g = new THREE.Group();
  const { w = 1.23, h = 0.71 } = p;
  B(g, w, h, 0.03, solid('#111214', 0.3, 0.3), 0, 0.12, 0, 0.004);
  B(g, w - 0.012, h - 0.012, 0.002, solid('#07080a', 0.05, 0.4), 0, 0.126, 0.016);
  B(g, 0.32, 0.012, 0.2, blackMetal(), 0, 0, 0);
  B(g, 0.05, 0.12, 0.03, blackMetal(), 0, 0.012, -0.01);
  return g;
}

function bookcase(p) {
  const g = new THREE.Group();
  const { w, d, h, finish, rows = 5, cols = 1, books = true } = p;
  const t = 0.02;
  for (const sx of [-1, 1]) B(g, t, h, d, finish, sx * (w / 2 - t / 2), 0, 0);
  B(g, w, t, d, finish, 0, h - t, 0);
  B(g, w, t, d, finish, 0, 0.06, 0);
  B(g, w - 2 * t, h - 0.06, 0.005, finish, 0, 0.06, -d / 2 + 0.003);
  for (let c = 1; c < cols; c++) B(g, t, h - 0.08, d, finish, -w / 2 + (c * w) / cols, 0.06, 0);
  const rh = (h - 0.08) / rows;
  const palette = ['#7a3f2a', '#2f3e4d', '#c9b89e', '#5b6a55', '#b08d57', '#d9d3c7', '#8a3a2e', '#3b3d3f'];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < rows; r++) {
    const y = 0.08 + r * rh;
    if (r > 0) B(g, w - 2 * t, t, d - 0.01, finish, 0, y, 0);
    if (!books) continue;
    for (let c = 0; c < cols; c++) {
      const left = -w / 2 + t + (c * (w - t)) / cols, right = left + (w - t) / cols - t;
      let x = left + 0.01;
      const limit = left + (right - left) * (0.45 + rnd() * 0.5);
      while (x < limit) {
        const bw = 0.018 + rnd() * 0.03, bh = Math.min(rh - 0.05, 0.17 + rnd() * 0.12), bd = Math.min(d - 0.05, 0.14 + rnd() * 0.06);
        B(g, bw, bh, bd, solid(palette[Math.floor(rnd() * palette.length)], 0.8), x + bw / 2, y + t, -d / 2 + bd / 2 + 0.03);
        x += bw + 0.002;
      }
    }
  }
  return g;
}

// ——— Repas ———
function table(p) {
  const g = new THREE.Group();
  const { w, d, h, finish, round, legMat } = p;
  const top = 0.03, lm = legMat || finish;
  if (round) {
    C(g, w / 2, w / 2, top, finish, 0, h - top, 0, 48);
    C(g, 0.05, 0.07, h - top - 0.02, lm, 0, 0.02, 0);
    C(g, w * 0.28, w * 0.3, 0.02, lm, 0, 0, 0, 36);
  } else {
    B(g, w, top, d, finish, 0, h - top, 0, 0.004);
    B(g, w - 0.14, 0.06, d - 0.14, finish, 0, h - top - 0.06, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const m = C(g, 0.022, 0.016, h - top, lm, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07), 16);
      m.rotation.z = sx * 0.03; m.rotation.x = -sz * 0.03;
    }
  }
  return g;
}

function chair(p) {
  const g = new THREE.Group();
  const { w = 0.45, d = 0.5, h = 0.85, finish, color } = p;
  const seatY = 0.45, seatMat = color ? fabric(color, 'lin') : finish;
  B(g, w, 0.04, d - 0.04, seatMat, 0, seatY, 0.02, 0.012);
  const slat = B(g, w * 0.9, 0.14, 0.018, finish, 0, h - 0.17, -d / 2 + 0.03, 0.008);
  slat.rotation.x = -0.08;
  B(g, w * 0.86, 0.045, 0.016, finish, 0, seatY + 0.14, -d / 2 + 0.03, 0.006);
  for (const sx of [-1, 1]) {
    C(g, 0.016, 0.012, seatY, finish, sx * (w / 2 - 0.035), 0, d / 2 - 0.05, 10);
    C(g, 0.016, 0.012, h, finish, sx * (w / 2 - 0.035), 0, -d / 2 + 0.03, 10);
  }
  return g;
}

function barStool(p) {
  const g = new THREE.Group();
  const { w = 0.4, h = 0.75, finish } = p;
  C(g, w / 2, w / 2, 0.035, finish, 0, h - 0.035, 0, 32);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = C(g, 0.013, 0.013, h, blackMetal(), Math.cos(a) * w * 0.36, 0, Math.sin(a) * w * 0.36, 10);
    leg.rotation.z = Math.cos(a) * 0.08; leg.rotation.x = -Math.sin(a) * 0.08;
  }
  return g;
}

// ——— Chambre ———
function bed(p) {
  const g = new THREE.Group();
  const { w, d, h = 1, finish, color = '#ece7dd', upholstered, headColor } = p;
  const frameH = 0.32, slatsY = 0.22, mattress = 0.2;
  const headMat = upholstered ? fabric(headColor || '#b7ab98', 'lin') : finish;
  const rail = 0.03;
  for (const sx of [-1, 1]) B(g, rail, frameH - 0.08, d - 0.06, finish, sx * (w / 2 - rail / 2), 0.08, 0.02);
  B(g, w, frameH - 0.08, rail, finish, 0, 0.08, d / 2 - rail / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.05, 0.08, 0.05, finish, sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.05));
  B(g, w - 0.01, Math.max(h, 0.5), 0.05, headMat, 0, 0, -d / 2 + 0.025, upholstered ? 0.02 : 0.003);
  const mw = w - rail * 2 - 0.01, md = d - 0.12;
  B(g, mw, mattress, md, solid('#f1eee7', 0.95), 0, slatsY, 0.03, 0.05);
  const top = slatsY + mattress;
  B(g, mw + 0.08, 0.1, md * 0.72, fabric(color, 'lin'), 0, top - 0.035, 0.03 + md * 0.13, 0.05);
  B(g, mw + 0.07, 0.03, md * 0.2, fabric('#e8e2d6', 'lin'), 0, top + 0.05, -md * 0.1, 0.012);
  const nP = mw > 1.2 ? 2 : 1;
  for (let i = 0; i < nP; i++) {
    const x = nP === 1 ? 0 : (i ? 1 : -1) * mw * 0.25;
    const a = S(g, 0.32, fabric('#f4f1ea', 'lin'), x, top + 0.09, -md / 2 + 0.26, 1, 0.3, 0.68);
    a.rotation.x = -0.32;
    const b = S(g, 0.25, fabric('#b87c5c', 'velours'), x * 0.75, top + 0.1, -md / 2 + 0.42, 0.95, 0.34, 0.5);
    b.rotation.x = -0.5;
  }
  const throwM = B(g, mw + 0.1, 0.02, 0.42, fabric('#7f8976', 'lin'), 0, top + 0.06, md / 2 - 0.22, 0.008);
  throwM.rotation.x = 0.01;
  return g;
}

function mattressOnly(p) {
  const g = new THREE.Group();
  B(g, p.w, p.h, p.d, solid('#f1eee7', 0.95), 0, 0, 0, 0.05);
  return g;
}

function drawers(p) {
  const g = new THREE.Group();
  const { w, d, h, finish, cols = 1, rows = 3, handle = 'bar', legs = 0.06 } = p;
  B(g, w, h - legs, d - 0.02, finish, 0, legs, -0.01);
  drawerFronts(g, { w, h: h - legs - 0.02, z: d / 2 - 0.018, y0: legs + 0.01, cols, rows, finish, handle });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.04, legs, 0.04, finish, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.06));
  return g;
}

function wardrobe(p) {
  const g = new THREE.Group();
  const { w, d, h, finish, doors = 2, sliding = false, withMirror = false } = p;
  B(g, w, h - 0.05, d - 0.03, finish, 0, 0.05, -0.015);
  B(g, w - 0.03, 0.05, d - 0.08, solid('#2b2a28', 0.7), 0, 0, -0.03);
  const n = Math.max(1, doors), gap = 0.004, dw = (w - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + gap + dw / 2 + i * (dw + gap);
    const zz = sliding && i % 2 ? d / 2 - 0.042 : d / 2 - 0.022;
    const isM = withMirror && i % 2 === 0;
    B(g, dw, h - 0.07, 0.018, isM ? mirror() : finish, x, 0.055, zz);
    if (!isM) {
      const side = i % 2 === 0 ? 1 : -1;
      handleBar(g, x + side * (dw / 2 - 0.05), 0.95, zz, 0.18, true);
    }
  }
  return g;
}

function desk(p) {
  const g = new THREE.Group();
  const { w, d, h, finish, drawersOn = true } = p;
  B(g, w, 0.03, d, finish, 0, h - 0.03, 0, 0.003);
  const legM = blackMetal();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.03, h - 0.03, 0.03, legM, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05));
  if (drawersOn) {
    const dh = Math.min(0.62, h - 0.1);
    B(g, 0.36, dh, d - 0.08, finish, w / 2 - 0.22, h - 0.03 - dh, 0);
    const before = g.children.length;
    drawerFronts(g, { w: 0.36, h: dh, z: 0, y0: h - 0.03 - dh, cols: 1, rows: 3, finish });
    g.children.slice(before).forEach((m) => { m.position.x += w / 2 - 0.22; m.position.z += d / 2 - 0.058; });
  }
  return g;
}

function officeChair(p) {
  const g = new THREE.Group();
  const { color = '#3b3d3f' } = p;
  const f = fabric(color, 'toile');
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5;
    const arm = B(g, 0.3, 0.025, 0.04, blackMetal(), Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15);
    arm.rotation.y = -a;
    S(g, 0.025, blackMetal(), Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3);
  }
  C(g, 0.025, 0.03, 0.36, chrome(), 0, 0.08, 0, 14);
  B(g, 0.48, 0.07, 0.46, f, 0, 0.44, 0.02, 0.03);
  const b = B(g, 0.44, 0.58, 0.05, f, 0, 0.56, -0.23, 0.02);
  b.rotation.x = -0.1;
  return g;
}

// ——— Cuisine ———
function kitchenBase(p) {
  const g = new THREE.Group();
  const { w = 0.6, d = 0.6, h = 0.88, facade, worktop, drawersRows = 0, handle = 'bar', noTop } = p;
  B(g, w, 0.08, d - 0.08, solid('#2b2a28', 0.7), 0, 0, -0.03);
  B(g, w, h - 0.12, d - 0.02, solid('#e8e6e1', 0.6), 0, 0.08, -0.01);
  const fH = h - 0.13;
  const doors = w > 0.65 ? 2 : 1;
  drawerFronts(g, { w, h: fH, z: d / 2 - 0.02, y0: 0.08, cols: drawersRows ? 1 : doors, rows: drawersRows || 1, finish: facade, handle });
  if (!noTop) B(g, w, 0.04, d + 0.02, worktop, 0, h - 0.04, 0.01, 0.002);
  return g;
}

function kitchenWall(p) {
  const g = new THREE.Group();
  const { w = 0.6, d = 0.37, h = 0.8, facade, handle = 'bar', z0 = 0 } = p;
  B(g, w, h, d - 0.02, solid('#e8e6e1', 0.6), 0, z0, -0.01);
  drawerFronts(g, { w, h, z: d / 2 - 0.02, y0: z0, cols: w > 0.65 ? 2 : 1, rows: 1, finish: facade, handle });
  return g;
}

function kitchenTall(p) {
  const g = new THREE.Group();
  const { w = 0.6, d = 0.6, h = 2.1, facade, oven } = p;
  B(g, w, 0.08, d - 0.08, solid('#2b2a28', 0.7), 0, 0, -0.03);
  B(g, w, h - 0.08, d - 0.02, solid('#e8e6e1', 0.6), 0, 0.08, -0.01);
  if (oven) {
    drawerFronts(g, { w, h: 0.72, z: d / 2 - 0.02, y0: 0.08, cols: 1, rows: 2, finish: facade });
    addOvenFront(g, w, 0.82, d / 2 - 0.016);
    drawerFronts(g, { w, h: h - 1.46, z: d / 2 - 0.02, y0: 1.44, cols: 1, rows: 1, finish: facade });
  } else {
    drawerFronts(g, { w, h: h - 0.09, z: d / 2 - 0.02, y0: 0.08, cols: 1, rows: 1, finish: facade });
  }
  return g;
}

function addOvenFront(g, w, y, z) {
  const inox = solid('#c9cbcd', 0.28, 0.95);
  B(g, w - 0.01, 0.6, 0.02, inox, 0, y, z);
  B(g, w - 0.08, 0.38, 0.006, solid('#0d0e10', 0.06, 0.3), 0, y + 0.06, z + 0.012);
  B(g, w - 0.12, 0.02, 0.03, chrome(), 0, y + 0.48, z + 0.03, 0.006);
  B(g, 0.12, 0.03, 0.004, solid('#050608', 0.1), 0, y + 0.54, z + 0.012);
}

function oven(p) {
  const g = kitchenBase({ ...p, drawersRows: 1 });
  addOvenFront(g, p.w ?? 0.6, 0.2, (p.d ?? 0.6) / 2 - 0.012);
  return g;
}

function sinkUnit(p) {
  const g = kitchenBase(p);
  const { w = 0.8, d = 0.6, h = 0.88 } = p;
  const inox = solid('#c6c8ca', 0.3, 1);
  B(g, w * 0.72, 0.006, d * 0.72, inox, 0, h - 0.002, 0.01);
  B(g, w * 0.6, 0.004, d * 0.56, solid('#6f7173', 0.5, 1), 0, h + 0.003, 0.01);
  C(g, 0.016, 0.02, 0.26, chrome(), 0, h, -d * 0.29, 14);
  const beak = C(g, 0.01, 0.01, 0.2, chrome(), 0, h + 0.25, -d * 0.2, 12);
  beak.rotation.x = Math.PI / 2;
  return g;
}

function hob(p) {
  const g = kitchenBase({ ...p, drawersRows: 2 });
  const { w = 0.6, d = 0.6, h = 0.88 } = p;
  B(g, w - 0.04, 0.006, d - 0.08, solid('#08090b', 0.08, 0.1), 0, h, 0.01, 0.002);
  for (const [x, z] of [[-0.14, -0.13], [0.14, -0.13], [-0.14, 0.12], [0.14, 0.12]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.08, 40), solid('#6d6e70', 0.3));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, h + 0.0075, z + 0.01); g.add(ring);
  }
  return g;
}

function hood(p) {
  const g = new THREE.Group();
  const { w = 0.6, d = 0.45 } = p;
  const inox = solid('#c6c8ca', 0.3, 1);
  B(g, w, 0.05, d, inox, 0, 0, 0);
  B(g, 0.26, 0.55, 0.26, inox, 0, 0.05, -d / 2 + 0.14);
  return g;
}

function fridge(p) {
  const g = new THREE.Group();
  const { w = 0.6, d = 0.65, h = 1.85 } = p;
  const inox = solid('#c9cbcd', 0.26, 0.9);
  B(g, w, h - 0.03, d - 0.04, solid('#b6b7b7', 0.6, 0.3), 0, 0.03, -0.02, 0.01);
  B(g, w, h * 0.3, 0.05, inox, 0, 0.03, d / 2 - 0.026, 0.012);
  B(g, w, h * 0.68, 0.05, inox, 0, 0.04 + h * 0.31, d / 2 - 0.026, 0.012);
  B(g, 0.02, 0.32, 0.03, chrome(), -w / 2 + 0.05, h * 0.36, d / 2 + 0.01);
  B(g, 0.02, 0.2, 0.03, chrome(), -w / 2 + 0.05, h * 0.09, d / 2 + 0.01);
  return g;
}

function dishwasher(p) {
  const g = kitchenBase({ ...p, drawersRows: 1 });
  return g;
}

function washer(p) {
  const g = new THREE.Group();
  const { w = 0.6, d = 0.6, h = 0.85 } = p;
  B(g, w, h, d, solid('#f2f1ee', 0.25), 0, 0, 0, 0.012);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 16, 48), solid('#c8c9ca', 0.25, 0.8));
  r.position.set(0, h * 0.48, d / 2 + 0.01); g.add(r);
  const v = new THREE.Mesh(new THREE.CircleGeometry(0.18, 40), solid('#14171a', 0.05, 0.2));
  v.position.set(0, h * 0.48, d / 2 + 0.012); g.add(v);
  B(g, w - 0.08, 0.1, 0.006, solid('#d9d8d4', 0.3), 0, h - 0.13, d / 2);
  return g;
}

function worktop(p) {
  const g = new THREE.Group();
  B(g, p.w, 0.04, p.d, p.finish, 0, (p.y ?? 0.88) - 0.04, 0, 0.002);
  return g;
}

function island(p) {
  const g = new THREE.Group();
  const { w, d, h = 0.9, facade, worktop: top } = p;
  B(g, w - 0.1, h - 0.04, d - 0.3, facade, 0, 0, -0.12);
  B(g, w, 0.04, d, top, 0, h - 0.04, 0, 0.003);
  return g;
}

// ——— Salle de bain ———
function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function bathtub(p) {
  const g = new THREE.Group();
  const { w = 1.7, d = 0.75, h = 0.56 } = p;
  const cer = ceramic();
  B(g, w, h - 0.03, d, cer, 0, 0, 0, 0.02);
  const rim = roundedRect(w, d, 0.06);
  const inner = roundedRect(w - 0.16, d - 0.16, 0.14);
  rim.holes.push(new THREE.Path(inner.getPoints(16)));
  const geo = new THREE.ExtrudeGeometry(rim, { depth: 0.03, bevelEnabled: false, curveSegments: 16 });
  const top = new THREE.Mesh(geo, cer);
  top.rotation.x = -Math.PI / 2; top.position.y = h - 0.03; top.castShadow = top.receiveShadow = true;
  g.add(top);
  const basin = new THREE.Mesh(new THREE.ShapeGeometry(inner, 16), solid('#dfe2e3', 0.12));
  basin.rotation.x = -Math.PI / 2; basin.position.y = h + 0.0005; g.add(basin);
  C(g, 0.012, 0.012, 0.22, chrome(), w / 2 - 0.05, h, 0, 12);
  const sp = C(g, 0.01, 0.01, 0.14, chrome(), w / 2 - 0.1, h + 0.2, 0, 12);
  sp.rotation.z = Math.PI / 2;
  return g;
}

function shower(p) {
  const g = new THREE.Group();
  const { w = 1.2, d = 0.8, h = 2 } = p;
  B(g, w, 0.04, d, ceramic(), 0, 0, 0, 0.01);
  B(g, w * 0.14, 0.003, 0.12, solid('#9a9c9d', 0.3, 1), 0, 0.04, 0);
  const gl = glass();
  B(g, 0.008, h, d * 0.92, gl, w / 2 - 0.01, 0.04, 0.01);
  B(g, w * 0.55, h, 0.008, gl, w * 0.18, 0.04, d / 2 - 0.01);
  const b = blackMetal();
  B(g, 0.02, 0.02, d, b, w / 2 - 0.01, h + 0.03, 0);
  B(g, 0.02, 0.02, w, b, -w / 2 + 0.01, 1.95, -d / 2 + 0.02).rotation.y = Math.PI / 2;
  C(g, 0.012, 0.012, 2, chrome(), 0, 0.05, -d / 2 + 0.05, 12);
  C(g, 0.13, 0.13, 0.012, chrome(), 0, 2.02, -d / 2 + 0.2, 36);
  const arm = C(g, 0.008, 0.008, 0.16, chrome(), 0, 2.05, -d / 2 + 0.13, 10);
  arm.rotation.x = Math.PI / 2;
  return g;
}

function vanity(p) {
  const g = new THREE.Group();
  const { w, d, h = 0.85, finish, wall = true } = p;
  const base = wall ? 0.28 : 0.02;
  B(g, w, h - 0.05 - base, d - 0.02, finish, 0, base, -0.01);
  drawerFronts(g, { w, h: h - 0.06 - base, z: d / 2 - 0.02, y0: base, cols: w > 0.9 ? 2 : 1, rows: 2, finish });
  B(g, w + 0.01, 0.05, d, ceramic(), 0, h - 0.05, 0, 0.012);
  B(g, w * 0.62, 0.002, d * 0.58, solid('#e2e5e6', 0.1), 0, h, 0.02);
  C(g, 0.016, 0.02, 0.18, chrome(), 0, h, -d * 0.34, 14);
  const beak = C(g, 0.009, 0.009, 0.13, chrome(), 0, h + 0.17, -d * 0.26, 12);
  beak.rotation.x = Math.PI / 2;
  return g;
}

function wc(p) {
  const g = new THREE.Group();
  const cer = ceramic();
  B(g, 0.38, 0.8, 0.16, solid('#efece6', 0.5), 0, 0.42, -0.26, 0.01);
  B(g, 0.2, 0.012, 0.1, chrome(), 0, 1.0, -0.17);
  S(g, 0.2, cer, 0, 0.32, 0, 0.92, 0.42, 1.36);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.028, 12, 40), cer);
  seat.rotation.x = Math.PI / 2; seat.scale.set(1, 1.4, 0.5); seat.position.set(0, 0.405, 0.02); seat.castShadow = true; g.add(seat);
  S(g, 0.17, solid('#dcdfdf', 0.15), 0, 0.395, 0.02, 0.86, 0.03, 1.3);
  return g;
}

function towelRadiator(p) {
  const g = new THREE.Group();
  const { w = 0.5, h = 1.2, y = 0.3 } = p;
  const mat = solid('#ecebe7', 0.3, 0.2);
  for (const sx of [-1, 1]) C(g, 0.015, 0.015, h, mat, sx * (w / 2 - 0.02), y, 0, 12);
  for (let i = 0; i < 16; i++) { const r = C(g, 0.011, 0.011, w - 0.04, mat, 0, y + 0.04 + i * ((h - 0.08) / 15), 0, 10); r.rotation.z = Math.PI / 2; r.position.y = y + 0.04 + i * ((h - 0.08) / 15); }
  B(g, w * 0.6, 0.48, 0.03, fabric('#c9b89e', 'toile'), 0, y + h * 0.42, 0.03, 0.01);
  return g;
}

function mirrorWall(p) {
  const g = new THREE.Group();
  const { w = 0.7, h = 1.6, round, frame = true } = p;
  if (round) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 56), mirror());
    c.position.set(0, h / 2, 0.012); g.add(c);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.009, 12, 64), brass());
    ring.position.set(0, h / 2, 0.012); g.add(ring);
  } else {
    if (frame) B(g, w, h, 0.02, blackMetal(), 0, 0, 0);
    B(g, w - 0.03, h - 0.03, 0.004, mirror(), 0, 0.015, 0.011);
  }
  return g;
}

function mirrorCabinet(p) {
  const g = new THREE.Group();
  const { w, d = 0.17, h = 0.75 } = p;
  B(g, w, h, d - 0.01, solid('#efece6', 0.5), 0, 0, -0.005);
  const n = w > 0.5 ? 2 : 1;
  for (let i = 0; i < n; i++) B(g, w / n - 0.004, h - 0.004, 0.012, mirror(), -w / 2 + (w / n) * (i + 0.5), 0.002, d / 2 - 0.004);
  return g;
}

// ——— Textiles et luminaires ———
function rug(p) {
  const g = new THREE.Group();
  const { w, d, color = '#c9b89e', round } = p;
  const mat = fabric(color, 'toile');
  if (round) {
    const m = mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.012, 64), mat, 0, 0.006, 0);
    g.add(m);
  } else B(g, w, 0.012, d, mat, 0, 0, 0, 0.004);
  return g;
}

function curtain(p) {
  const g = new THREE.Group();
  const { w = 1.5, h = 2.5, color = '#e4dccd', sheer } = p;
  const segs = Math.round(w * 40);
  const geo = new THREE.PlaneGeometry(w, h, segs, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const fold = 0.04 * Math.sin(x * 22) + 0.012 * Math.sin(x * 57 + 1.4);
    pos.setZ(i, fold * (0.7 + 0.3 * (1 - (y + h / 2) / h)));
  }
  geo.computeVertexNormals();
  const mat = fabric(color, 'lin').clone();
  mat.side = THREE.DoubleSide;
  if (sheer) { mat.transparent = true; mat.opacity = 0.62; }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, h / 2, 0.07); m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  const rod = C(g, 0.011, 0.011, w + 0.2, blackMetal(), 0, h + 0.01, 0.07, 12);
  rod.rotation.z = Math.PI / 2; rod.position.y = h + 0.02;
  return g;
}

function lampMark(g, x, y, z, intensity, color = '#ffd9a8') { (g.userData.lights ||= []).push({ x, y, z, intensity, color }); }

function pendant(p) {
  const g = new THREE.Group();
  const { w = 0.4, h = 0.3, drop = 0.6, shade = 'dome', color = '#1f2022' } = p;
  const mat = shade === 'paper' ? solid('#f2ece0', 0.9, 0, { emissive: new THREE.Color('#ffdcae'), emissiveIntensity: 1.1 }) : solid(color, 0.5, 0.3, { side: THREE.DoubleSide });
  const top = -0.02, bot = top - drop;
  C(g, 0.0035, 0.0035, drop, blackMetal(), 0, bot, 0, 8);
  if (shade === 'paper') S(g, w / 2, mat, 0, bot - w * 0.4, 0, 1, 0.84, 1);
  else {
    const geo = new THREE.SphereGeometry(w / 2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.y = bot - h * 0.8; m.scale.y = (h / (w / 2)) * 0.9; m.castShadow = true; g.add(m);
    S(g, 0.04, emissive('#ffdcae', 8), 0, bot - h * 0.65, 0);
  }
  lampMark(g, 0, bot - w * 0.45, 0, 18);
  g.userData.ceiling = true;
  return g;
}

function floorLamp(p) {
  const g = new THREE.Group();
  const { h = 1.55, w = 0.36 } = p;
  C(g, 0.13, 0.135, 0.02, blackMetal(), 0, 0, 0, 36);
  C(g, 0.008, 0.008, h - 0.2, blackMetal(), 0, 0.02, 0, 10);
  const shade = solid('#ede4d3', 0.95, 0, { side: THREE.DoubleSide, emissive: new THREE.Color('#ffd5a3'), emissiveIntensity: 0.95 });
  const geo = new THREE.CylinderGeometry(w * 0.42, w / 2, 0.26, 40, 1, true);
  const m = new THREE.Mesh(geo, shade); m.position.y = h - 0.13; m.castShadow = true; g.add(m);
  lampMark(g, 0, h - 0.13, 0, 9);
  return g;
}

function tableLamp(p) {
  const g = new THREE.Group();
  const { h = 0.42, w = 0.26 } = p;
  const base = S(g, 0.08, solid('#a8927a', 0.35), 0, 0.09, 0, 1, 1.15, 1);
  base.castShadow = true;
  C(g, 0.008, 0.008, h - 0.3, brass(), 0, 0.17, 0, 10);
  const shade = solid('#ede4d3', 0.95, 0, { side: THREE.DoubleSide, emissive: new THREE.Color('#ffd5a3'), emissiveIntensity: 0.9 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.4, w / 2, h * 0.42, 36, 1, true), shade);
  m.position.y = h * 0.78; m.castShadow = true; g.add(m);
  lampMark(g, 0, h * 0.78, 0, 3.5);
  return g;
}

function picture(p) {
  const g = new THREE.Group();
  const { w = 0.5, h = 0.7, art = 0, frameColor = '#20201f' } = p;
  B(g, w, h, 0.025, solid(frameColor, 0.45), 0, 0, 0);
  B(g, w - 0.03, h - 0.03, 0.004, solid('#f4f1ea', 0.9), 0, 0.015, 0.012);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 340;
  const c = cv.getContext('2d');
  const pal = [['#e8e0d0', '#b5532f', '#2f3e4d', '#c99a4d'], ['#efe7d8', '#59655a', '#c9764f', '#1f2022'], ['#d9cfbd', '#3b4f5e', '#b58a80', '#ece6d6']][art % 3];
  c.fillStyle = pal[0]; c.fillRect(0, 0, 256, 340);
  c.fillStyle = pal[1]; c.beginPath(); c.arc(120, 130, 78, 0, Math.PI * 2); c.fill();
  c.fillStyle = pal[2]; c.beginPath(); c.moveTo(0, 340); c.bezierCurveTo(70, 180, 160, 330, 256, 200); c.lineTo(256, 340); c.fill();
  c.fillStyle = pal[3]; c.fillRect(160, 40, 60, 90);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const art3 = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.72, h * 0.72), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  art3.position.set(0, h / 2, 0.0145);
  g.add(art3);
  return g;
}

// ——— Structure et extérieur ———
/** Grand escalier américain en U : marches noyer, contremarches blanches, balustres tournés. */
function classicStairs(p) {
  const g = new THREE.Group(), { w = 3.8, d = 4.6, h = 3.3 } = p, n = Math.round(h / 0.175), rise = h / n, f = Math.min(1.35, w / 2 - 0.2);
  const walnut = walnutMat(), white = solid('#f1ece2', 0.5), nA = Math.floor((n - 1) / 2), nB = n - 1 - nA, land = 1.35, lenA = d - land, runA = lenA / nA, runB = lenA / nB;
  const xA = -w / 2 + f / 2, xB = w / 2 - f / 2;
  const step = (x, z, sx, sz, i, depthAxis) => {
    B(g, sx, 0.045, sz, walnut, x, rise * (i + 1) - 0.045, z, 0.008);
    if (depthAxis > 0) B(g, sx - 0.01, rise - 0.045, 0.02, white, x, rise * i, z + sz / 2 - 0.04); else B(g, sx - 0.01, rise - 0.045, 0.02, white, x, rise * i, z - sz / 2 + 0.04);
  };
  for (let i = 0; i < nA; i++) step(xA, d / 2 - runA * (i + 0.5), f, runA + 0.02, i, 1);
  B(g, w, 0.05, land, walnut, 0, rise * (nA + 1) - 0.05, -d / 2 + land / 2, 0.008);
  for (let i = 0; i < nB; i++) step(xB, -d / 2 + land + runB * (i + 0.5), f, runB + 0.02, nA + 1 + i, -1);
  // Limons et dessous blancs.
  const slope = (x, z0, z1, y0, y1, sx) => { const len = Math.hypot(z1 - z0, y1 - y0), s = B(g, sx, 0.3, len, white, x, 0, (z0 + z1) / 2, 0); s.position.y = (y0 + y1) / 2 - 0.15; s.rotation.x = Math.atan2(y1 - y0, z0 - z1) * (z1 < z0 ? 1 : 1); return s; };
  slope(xA + f / 2 + 0.03, d / 2, -d / 2 + land, 0, rise * nA, 0.06); slope(xA - f / 2 - 0.03, d / 2, -d / 2 + land, 0, rise * nA, 0.06);
  slope(xB - f / 2 - 0.03, -d / 2 + land, d / 2, rise * (nA + 1), h, 0.06); slope(xB + f / 2 + 0.03, -d / 2 + land, d / 2, rise * (nA + 1), h, 0.06);
  const soffit = (x, z0, z1, y0, y1) => { const len = Math.hypot(z1 - z0, y1 - y0), m = B(g, f + 0.08, 0.03, len, white, x, 0, (z0 + z1) / 2, 0); m.position.y = (y0 + y1) / 2 - 0.26; m.rotation.x = Math.atan2(y1 - y0, z0 - z1); };
  soffit(xA, d / 2, -d / 2 + land, 0, rise * nA); soffit(xB, -d / 2 + land, d / 2, rise * (nA + 1), h);
  B(g, w, 0.25, land, white, 0, rise * (nA + 1) - 0.3, -d / 2 + land / 2, 0);
  const metal = blackMetal(), gl = glass(), R = (a, b2) => railRun(g, a, b2, 0.95, 'classic', metal, gl);
  R([xA + f / 2 + 0.03, 0, d / 2], [xA + f / 2 + 0.03, rise * nA, -d / 2 + land]);
  R([xB - f / 2 - 0.03, rise * (nA + 1), -d / 2 + land], [xB - f / 2 - 0.03, h, d / 2]);
  R([xA + f / 2 + 0.03, rise * (nA + 1), -d / 2 + land], [xB - f / 2 - 0.03, rise * (nA + 1), -d / 2 + land]);
  for (const [x, y, z] of [[xA + f / 2 + 0.03, 0, d / 2], [xA + f / 2 + 0.03, rise * nA, -d / 2 + land], [xB - f / 2 - 0.03, rise * (nA + 1), -d / 2 + land], [xB - f / 2 - 0.03, h, d / 2]]) { B(g, 0.11, 1.12, 0.11, white, x, y, z, 0.01); B(g, 0.15, 0.05, 0.15, walnut, x, y + 1.12, z, 0.01); }
  return g;
}

/** Escalier américain à quart tournant : on arrive en haut face au palier, jamais face à un mur. */
function classicQuarter(p) {
  const g = new THREE.Group(), { w = 2.4, d = 4.65, h = 3.65, flight: f = 1.15 } = p, n = Math.round(h / 0.18), rise = h / n, walnut = walnutMat(), white = solid('#f1ece2', 0.5), lenA = d - f, runLen = w - f;
  const nA = Math.round(((n - 1) * lenA) / (lenA + runLen)), nB = n - 1 - nA, runA = lenA / nA, runB = runLen / nB, xA = -w / 2 + f / 2, zB = -d / 2 + f / 2;
  for (let i = 0; i < nA; i++) { const z = d / 2 - runA * (i + 0.5); B(g, f, 0.045, runA + 0.025, walnut, xA, rise * (i + 1) - 0.045, z, 0.008); B(g, f - 0.01, rise - 0.045, 0.02, white, xA, rise * i, z + runA / 2 - 0.03); }
  B(g, f, 0.05, f, walnut, xA, rise * (nA + 1) - 0.05, zB, 0.008); B(g, f, rise * (nA + 1) - 0.05, 0.03, white, xA, 0, -d / 2 + 0.015); B(g, 0.03, rise * (nA + 1) - 0.05, f, white, -w / 2 + 0.015, 0, zB);
  for (let i = 0; i < nB; i++) { const x = -w / 2 + f + runB * (i + 0.5); B(g, runB + 0.025, 0.045, f, walnut, x, rise * (nA + 2 + i) - 0.045, zB, 0.008); B(g, 0.02, rise - 0.045, f - 0.01, white, x - runB / 2 + 0.03, rise * (nA + 1 + i), zB); }
  const sideX = xA + f / 2 + 0.02, shape = new THREE.Shape(), topA = rise * nA; shape.moveTo(-d / 2 + f, 0); shape.lineTo(d / 2, 0); shape.lineTo(d / 2, 0.02); shape.lineTo(-d / 2 + f, topA); shape.lineTo(-d / 2 + f, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }); geo.rotateY(-Math.PI / 2); geo.translate(sideX, 0, 0); const side = new THREE.Mesh(geo, white); side.castShadow = side.receiveShadow = true; g.add(side);
  const under = new THREE.Shape(); under.moveTo(-w / 2 + f, 0); under.lineTo(w / 2, 0); under.lineTo(w / 2, h); under.lineTo(-w / 2 + f, rise * (nA + 1)); under.lineTo(-w / 2 + f, 0);
  const u2 = new THREE.ExtrudeGeometry(under, { depth: 0.04, bevelEnabled: false }); u2.translate(0, 0, -d / 2 + f + 0.0); const m2 = new THREE.Mesh(u2, white); m2.castShadow = m2.receiveShadow = true; g.add(m2);
  // Le dessous de la volée haute est fermé : on ne voit jamais les marches par-dessous.
  B(g, 0.03, h - 0.02, f, white, w / 2 - 0.015, 0, zB);
  const metal = blackMetal(), gl = glass();
  railRun(g, [sideX, 0.02, d / 2], [sideX, topA, -d / 2 + f + 0.02], 0.95, 'classic', metal, gl);
  railRun(g, [sideX, rise * (nA + 1), -d / 2 + f + 0.02], [w / 2, h, -d / 2 + f + 0.02], 0.95, 'classic', metal, gl);
  for (const [x, y, z] of [[sideX, 0, d / 2 - 0.02], [sideX, topA, -d / 2 + f + 0.02], [w / 2 - 0.02, h, -d / 2 + f + 0.02]]) { B(g, 0.12, 1.15, 0.12, white, x, y, z, 0.012); B(g, 0.17, 0.06, 0.17, walnut, x, y + 1.15, z, 0.012); }
  return g;
}

/** Méridienne de lecture, assise bouclée et têtière arrondie. */
function daybed(p) {
  const g = new THREE.Group(), { w = 2, d = 0.82, h = 0.78 } = p, cloth = fabric('#d7cdb9', 'bouclette'), wd = walnutMat();
  B(g, w, 0.12, d, wd, 0, 0.14, 0, 0.012); for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) C(g, 0.022, 0.016, 0.14, wd, x * (w / 2 - 0.08), 0, z * (d / 2 - 0.08), 10);
  B(g, w - 0.04, 0.2, d - 0.04, cloth, 0, 0.26, 0, 0.06); B(g, 0.26, h - 0.3, d - 0.04, cloth, -w / 2 + 0.15, 0.3, 0, 0.1);
  const bolster = mesh(new THREE.CylinderGeometry(0.11, 0.11, d - 0.1, 22), cloth, -w / 2 + 0.38, 0.56, 0); bolster.rotation.x = Math.PI / 2; g.add(bolster);
  return g;
}

/** Volée droite américaine le long d'un mur : le dessous est fermé par un soubassement, on ne peut pas passer dessous. */
function classicStraight(p) {
  const g = new THREE.Group(), { w = 1.15, d = 4.6, h = 3.6, side: railSide = 1 } = p, n = Math.round(h / 0.18), rise = h / n, run = d / n, walnut = walnutMat(), white = solid('#f1ece2', 0.5), open = railSide * (w / 2 - 0.02);
  for (let i = 0; i < n; i++) { const z = d / 2 - run * (i + 0.5); B(g, w, 0.045, run + 0.025, walnut, 0, rise * (i + 1) - 0.045, z, 0.008); B(g, w - 0.01, rise - 0.045, 0.02, white, 0, rise * i, z + run / 2 - 0.03); }
  // Soubassement plein côté hall, suivant la pente, avec moulures.
  const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(d / 2, 0.02); shape.lineTo(-d / 2, h - 0.02); shape.lineTo(-d / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }); geo.rotateY(-Math.PI / 2); geo.translate(open + 0.02, 0, 0);
  const side = new THREE.Mesh(geo, white); side.castShadow = side.receiveShadow = true; g.add(side);
  for (let i = 0; i < 4; i++) { const zc = -d / 2 + d * (i + 0.5) / 4, top = h * (0.5 - zc / d) - 0.55; if (top > 0.4) B(g, 0.012, top, d / 4 - 0.16, solid('#e4dccd', 0.5), open + railSide * 0.045, 0.14, zc, 0); }
  const metal = blackMetal(), gl = glass();
  railRun(g, [open + 0.02, 0.02, d / 2], [open + 0.02, h, -d / 2], 0.95, 'classic', metal, gl);
  B(g, 0.12, 1.15, 0.12, white, open + 0.02, 0, d / 2 - 0.02, 0.012); B(g, 0.17, 0.06, 0.17, walnut, open + 0.02, 1.15, d / 2 - 0.02, 0.012);
  return g;
}

function railRun(g, a, b, h, kind, metal, gl) {
  if (kind === 'classic') {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz);
    if (len < 0.02) return;
    const white = solid('#f1ece2', 0.5), hand = B(g, 0.075, 0.06, len, walnutMat(), (a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2, 0.02);
    hand.position.y = (a[1] + b[1]) / 2 + h; hand.rotation.order = 'YXZ'; hand.rotation.y = Math.atan2(dx, dz); hand.rotation.x = -Math.atan2(dy, flat);
    const n = Math.max(1, Math.round(len / 0.13));
    for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + dx * t, y = a[1] + dy * t, z = a[2] + dz * t; C(g, 0.016, 0.022, h, white, x, y, z, 8); }
    return;
  }
  // Portion de garde-corps entre deux points (x, y, z).
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz);
  if (len < 0.02) return;
  const mid = (o) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + o, (a[2] + b[2]) / 2];
  const ry = Math.atan2(dx, dz), rx = -Math.atan2(dy, flat);
  const bar = (w, t, y) => { const [x, yy, z] = mid(y); const m = B(g, w, t, len, metal, x, 0, z); m.position.y = yy; m.rotation.order = 'YXZ'; m.rotation.y = ry; m.rotation.x = rx; return m; };
  bar(0.03, 0.03, h);
  if (kind === 'glass') { const [x, yy, z] = mid(h / 2); const m = B(g, 0.012, h - 0.03, len, gl, x, 0, z); m.position.y = yy; m.rotation.order = 'YXZ'; m.rotation.y = ry; m.rotation.x = rx; m.castShadow = false; }
  else { const n = Math.max(1, Math.round(len / 0.14)); for (let i = 0; i <= n; i++) { const t = i / n; B(g, 0.012, h, 0.012, metal, a[0] + dx * t, a[1] + dy * t, a[2] + dz * t); } }
}

/** Escaliers : droit, quart tournant, en U, colimaçon ; bois, métal, béton ; toujours à la bonne hauteur. */
function stairs(p) {
  const g = new THREE.Group();
  const { w = 0.9, d = 3, h = 2.8, finish, shape = 'straight', open: openRiser, rail = 'metal', stone, noRail, metal: allMetal, classic } = p;
  if (p.quarter) return classicQuarter(p);
  if (classic) return shape === 'straight' ? classicStraight(p) : classicStairs(p);
  const metal = blackMetal(), gl = glass();
  const tread = stone ? solid('#b9b5ab', 0.85) : allMetal ? metal : finish;
  const n = Math.max(3, Math.round(h / 0.18)), rise = h / n, th = stone ? 0.14 : 0.04;
  const step = (x, z, sx, sz, i) => { B(g, sx, stone ? rise : th, sz, tread, x, stone ? rise * i : rise * (i + 1) - th, z, 0.004); if (!openRiser && !stone) B(g, Math.max(sx, sz) === sx ? sx : 0.02, rise, Math.max(sx, sz) === sx ? 0.02 : sz, solid('#efeee9', 0.5), x, rise * i, z); };
  const R = (a, b) => { if (!noRail) railRun(g, a, b, 0.92, rail, metal, gl); };
  if (shape === 'spiral') {
    const r = Math.min(w, d) / 2, turn = (Math.PI * 2 * 1.1) / n;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h + 1, 12), metal); pole.position.y = (h + 1) / 2; pole.castShadow = true; g.add(pole);
    let prev = null;
    for (let i = 0; i < n; i++) {
      const a = i * turn, wedge = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 8, 1, false, a, turn * 1.08), tread);
      wedge.position.y = rise * (i + 1) - 0.02; wedge.castShadow = wedge.receiveShadow = true; g.add(wedge);
      const e = [Math.sin(a + turn / 2) * r * 0.97, rise * (i + 1), Math.cos(a + turn / 2) * r * 0.97];
      if (prev) R(prev, e);
      prev = e;
    }
    return g;
  }
  if (shape === 'L' || shape === 'U') {
    const f = Math.min(0.95, shape === 'U' ? w / 2 - 0.04 : w * 0.5), lenA = d - f;
    const nA = shape === 'U' ? Math.floor((n - 1) / 2) : Math.round(((n - 1) * lenA) / (lenA + (w - f)));
    const nB = n - 1 - nA, runA = lenA / nA, xA = -w / 2 + f / 2;
    for (let i = 0; i < nA; i++) step(xA, d / 2 - runA * (i + 0.5), f, runA + 0.02, i);
    R([xA + f / 2, 0, d / 2], [xA + f / 2, rise * nA, -d / 2 + f]);
    if (shape === 'L') {
      step(xA, -d / 2 + f / 2, f, f, nA);
      const runB = (w - f) / nB, zB = -d / 2 + f / 2;
      for (let i = 0; i < nB; i++) step(xA + f / 2 + runB * (i + 0.5), zB, runB + 0.02, f, nA + 1 + i);
      R([xA - f / 2, rise * nA, -d / 2], [w / 2, rise * n, -d / 2]);
    } else {
      step(0, -d / 2 + f / 2, w, f, nA);
      const runB = lenA / nB, xB = w / 2 - f / 2;
      for (let i = 0; i < nB; i++) step(xB, -d / 2 + f + runB * (i + 0.5), f, runB + 0.02, nA + 1 + i);
      R([xB - f / 2, rise * (nA + 1), -d / 2 + f], [xB - f / 2, rise * n, d / 2]);
    }
    return g;
  }
  const run = d / n;
  for (let i = 0; i < n; i++) step(0, d / 2 - run * (i + 0.5), w, run + 0.03, i);
  if (!stone) for (const sx of [-1, 1]) {
    const len = Math.hypot(h, d), s = B(g, 0.03, 0.22, len, metal, sx * (w / 2 + 0.015), 0, 0);
    s.position.y = h / 2 - 0.02; s.rotation.x = Math.atan2(h, d);
  }
  for (const sx of [-1, 1]) R([sx * (w / 2 + 0.015), 0, d / 2], [sx * (w / 2 + 0.015), h, -d / 2]);
  return g;
}

/** Balcon ou terrasse surélevée ; `drop` donne la longueur des poteaux jusqu'au sol. */
function balcony(p) {
  const g = new THREE.Group();
  const { w = 4, d = 1.5, finish, rail = 'glass', stilts, drop = 0 } = p;
  const metal = blackMetal(), gl = glass(), floor = stilts ? finish : solid('#c9c5bb', 0.8);
  B(g, w, 0.14, d, floor, 0, -0.14, 0);
  if (stilts && drop > 0.05) {
    const nx = Math.max(2, Math.round(w / 2.2) + 1), nz = Math.max(2, Math.round(d / 2.2) + 1);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) B(g, 0.1, drop, 0.1, metal, -w / 2 + 0.1 + (i * (w - 0.2)) / (nx - 1), -drop - 0.14, -d / 2 + 0.1 + (j * (d - 0.2)) / (nz - 1));
  }
  const H = 1.02, a = [-w / 2, 0, -d / 2], b = [w / 2, 0, -d / 2], c = [w / 2, 0, d / 2], e = [-w / 2, 0, d / 2];
  railRun(g, a, e, H, rail, metal, gl); railRun(g, e, c, H, rail, metal, gl); railRun(g, c, b, H, rail, metal, gl);
  return g;
}

function railing(p) {
  const g = new THREE.Group(), { w = 2, h = 1.05, rail = 'glass' } = p;
  railRun(g, [-w / 2, 0, 0], [w / 2, 0, 0], h, rail, blackMetal(), glass());
  return g;
}

function retaining(p) {
  const g = new THREE.Group(), { w = 3, d = 0.3, h = 1.2, kind } = p;
  const mat = kind === 'stone' ? texturedMaterial('stone_wall', 3) : kind === 'gabion' ? texturedMaterial('stone_wall', 1.2) : solid('#a6a39b', 0.92);
  B(g, w, h + 0.6, d, mat, 0, -0.6, 0);
  return g;
}

function slab(p) {
  const g = new THREE.Group();
  B(g, p.w, p.h, p.d, p.finish, 0, 0, 0);
  return g;
}

function pergola(p) {
  const g = new THREE.Group();
  const { w = 4, d = 3, h = 2.5 } = p;
  const m = blackMetal();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.1, h, 0.1, m, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05));
  for (const sz of [-1, 1]) B(g, w, 0.15, 0.06, m, 0, h - 0.15, sz * (d / 2 - 0.05));
  for (const sx of [-1, 1]) B(g, 0.06, 0.15, d, m, sx * (w / 2 - 0.05), h - 0.15, 0);
  const n = Math.round(d / 0.18);
  for (let i = 0; i <= n; i++) B(g, w - 0.1, 0.1, 0.03, m, 0, h - 0.04, -d / 2 + (i * d) / n);
  return g;
}

/** Masse de feuillage : sphère irrégulière, moins lisse qu'une boule. */
function leafBlob(g, mat, x, y, z, sx, sy, sz, seed) {
  const geo = new THREE.IcosahedronGeometry(1, 5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i), b = pos.getY(i), c = pos.getZ(i);
    const n = Math.sin(a * 9 + seed) * Math.cos(b * 11 + seed * 2) * Math.sin(c * 8 - seed) * 0.13 + Math.sin(a * 23 + c * 19 + seed) * 0.05;
    pos.setXYZ(i, a * (1 + n), b * (1 + n), c * (1 + n));
    // Normale lissée : le feuillage ne montre plus de facettes.
    geo.attributes.normal.setXYZ(i, a, b, c);
  }
  const m = mesh(geo, mat, x, y, z);
  m.scale.set(sx, sy, sz);
  g.add(m);
}

function hedge(p) {
  const g = new THREE.Group(), { w = 3, d = 0.6, h = 1.6 } = p, n = Math.max(1, Math.round(w / 2.4));
  for (let i = 0; i < n; i++) { const s = clippedShrub({ w: w / n + 0.02, d, h }); s.position.x = -w / 2 + (i + 0.5) * (w / n); g.add(s); }
  return g;
}

function tree(p) { return leafyTree(p); }

function fence(p) {
  const g = new THREE.Group();
  const { w = 2.5, h = 1.5 } = p;
  const m = wood('gris');
  const n = Math.round(w / 0.14);
  for (let i = 0; i < n; i++) B(g, 0.11, h, 0.02, m, -w / 2 + (i + 0.5) * (w / n), 0.03, 0);
  for (const sy of [0.3, h - 0.25]) B(g, w, 0.07, 0.03, m, 0, sy, -0.025);
  return g;
}

function pool(p) {
  const g = new THREE.Group();
  const { w = 8, d = 4 } = p;
  const stone = texturedMaterial('concrete_tiles', 1.5, { tint: '#d9d3c7' });
  for (const sz of [-1, 1]) B(g, w + 0.8, 0.06, 0.4, stone, 0, 0, sz * (d / 2 + 0.2));
  for (const sx of [-1, 1]) B(g, 0.4, 0.06, d, stone, sx * (w / 2 + 0.2), 0, 0);
  B(g, w, 0.01, d, poolWaterMaterial(), 0, 0.03, 0, 0);
  return g;
}

const stoneMat = () => texturedMaterial('rustic_stone_wall', 1.8, { tint: '#f1e4cf', gain: 1.35 });
const walnutMat = () => texturedMaterial('american_walnut_veneer', 2, { tint: '#d7a877', gain: 1.15 });

/** Cheminée monumentale : masse de pierre, panneau de noyer, foyer allumé. */
function fireplace(p) {
  const g = new THREE.Group(), { w = 4.2, h = 7, d = 0.9, outdoor } = p;
  const stone = stoneMat(), soot = solid('#17161a', 0.92), fw = Math.min(w * 0.68, 2.6), fh = outdoor ? 0.75 : 0.62, sill = 0.42;
  B(g, w, sill, d, stone, 0, 0, 0);
  B(g, (w - fw) / 2, fh, d, stone, -(w + fw) / 4, sill, 0); B(g, (w - fw) / 2, fh, d, stone, (w + fw) / 4, sill, 0);
  B(g, w, h - sill - fh, d, stone, 0, sill + fh, 0);
  B(g, fw, fh, 0.08, soot, 0, sill, -d / 2 + 0.06, 0); B(g, 0.03, fh, d - 0.1, soot, -fw / 2 + 0.02, sill, 0, 0); B(g, 0.03, fh, d - 0.1, soot, fw / 2 - 0.02, sill, 0, 0);
  B(g, fw + 0.36, 0.08, d + 0.14, solid('#23211f', 0.55), 0, sill - 0.08, 0.08, 0);
  B(g, fw + 0.2, 0.14, d + 0.05, solid('#1b1a1c', 0.6), 0, sill + fh, 0.03, 0);
  const fl = flames(fw * 0.84, fh * 0.8); fl.position.set(0, sill + 0.08, 0.06); g.add(fl);
  const emb = emissive('#ff5a14', 0.7), log = solid('#241710', 0.95);
  for (let i = 0; i < 5; i++) { const m = mesh(new THREE.CylinderGeometry(0.05, 0.06, fw * 0.3, 10), log, -fw * 0.28 + i * fw * 0.14, sill + 0.08 + (i % 2) * 0.05, 0.08 + (i % 2) * 0.05); m.rotation.z = Math.PI / 2 + (i % 3) * 0.12; g.add(m); }
  B(g, fw * 0.76, 0.03, 0.26, emb, 0, sill + 0.02, 0.08, 0);
  B(g, fw * 0.8, 0.09, 0.2, solid('#2a1a12', 0.9), 0, sill, 0.1, 0.03);
  if (!outdoor && h > 3.2) { const pw = w * 0.56; B(g, pw, h - 1.9, 0.05, walnutMat(), 0, 1.75, d / 2 + 0.01); }
  return g;
}

/** Cuisine d'été : meuble en pierre, plan sombre, plancha et évier. */
function outdoorKitchen(p) {
  const g = new THREE.Group(), { w = 4, d = 0.75, h = 0.92 } = p;
  B(g, w, h - 0.05, d, stoneMat(), 0, 0, 0);
  B(g, w + 0.06, 0.05, d + 0.06, solid('#2c2b2a', 0.35), 0, h - 0.05, 0);
  B(g, 1, 0.09, d * 0.72, chrome(), -w * 0.2, h, 0.02); for (let i = 0; i < 5; i++) B(g, 0.9, 0.008, 0.012, solid('#1d1d1f', 0.5), -w * 0.2, h + 0.09, -d * 0.24 + i * d * 0.12, 0);
  B(g, 0.55, 0.012, d * 0.5, chrome(), w * 0.25, h, 0.02);
  const tap = C(g, 0.012, 0.012, 0.3, chrome(), w * 0.25, h, -d * 0.3, 10); void tap;
  for (let i = 0; i < 4; i++) B(g, w / 4.4, h * 0.58, 0.02, walnutMat(), -w * 0.375 + i * w * 0.25, h * 0.16, d / 2 + 0.008);
  return g;
}

/** Foyer rond d'extérieur. */
function firepit(p) {
  const g = new THREE.Group(), { w = 1.3, h = 0.42 } = p;
  C(g, w / 2, w / 2 * 0.82, h, solid('#cfc8ba', 0.85), 0, 0, 0, 40);
  C(g, w / 2 * 0.8, w / 2 * 0.8, 0.02, solid('#222', 0.9), 0, h, 0, 32);
  const fire = emissive('#ff8b3a', 3.4);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; S(g, 0.08, fire, Math.cos(a) * w * 0.18, h + 0.12 + (i % 2) * 0.04, Math.sin(a) * w * 0.18, 1, 2.2, 1); }
  return g;
}

function column(p) {
  const g = new THREE.Group(), { w = 0.4, d = 0.4, h = 3.2 } = p, stone = p.wood ? walnutMat() : texturedMaterial('white_sandstone_bricks', 3.2, { tint: '#f6ead6', gain: 2.2 });
  B(g, w * 1.25, 0.28, d * 1.25, stone, 0, 0, 0); B(g, w, h - 0.48, d, stone, 0, 0.28, 0); B(g, w * 1.25, 0.2, d * 1.25, stone, 0, h - 0.2, 0);
  return g;
}

function ringChandelier(p) {
  const g = new THREE.Group(), { w = 2.2, h = 3 } = p, r = w / 2, metal = blackMetal(), glow = emissive('#ffd9a3', 3);
  const ring = mesh(new THREE.TorusGeometry(r, 0.03, 10, 64), metal, 0, 0.1, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; const x = Math.cos(a) * r, z = Math.sin(a) * r; C(g, 0.012, 0.012, 0.16, metal, x, 0.12, z, 8); S(g, 0.04, glow, x, 0.33, z, 1, 1.4, 1); }
  for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.283, x = Math.cos(a) * r, z = Math.sin(a) * r, L = Math.hypot(r, h - 0.1); const rod = mesh(new THREE.CylinderGeometry(0.008, 0.008, L, 6), metal, x / 2, 0.1 + (h - 0.1) / 2, z / 2); rod.lookAt(new THREE.Vector3(0, h, 0)); rod.rotateX(Math.PI / 2); g.add(rod); }
  return g;
}

function parasol(p) {
  const g = new THREE.Group(), { w = 2.8, h = 2.7 } = p, cloth = fabric('#e9e2d2', 'lin').clone(); cloth.side = THREE.DoubleSide;
  C(g, 0.022, 0.022, h, wood('chene'), 0, 0, 0, 10);
  const roof = mesh(new THREE.ConeGeometry(w / 2, 0.55, 8, 1, true), cloth, 0, h - 0.16, 0); g.add(roof);
  C(g, 0.26, 0.3, 0.07, solid('#3a3a3a', 0.7), 0, 0, 0, 20);
  return g;
}

function topiary(p) { const { w = 0.9, h = 0.9 } = p; return clippedShrub({ w, d: w, h, ball: true }); }

/** Voiture de sport rouge, silhouette basse à moteur central. Longueur en Z, capot vers +Z. */
function sportsCar(p) { return carModel(p); }

function canvasMap(W, H, draw) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  draw(cv.getContext('2d'), W, H);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const brushRnd = (s) => () => (s = (s * 48271) % 2147483647) / 2147483647;

/** Grand tableau encadré : encre sur fond sable, tapisserie de forêt, ou abstrait terreux. */
function bigArt(p) {
  const g = new THREE.Group(), { w = 1.6, h = 1.8, style = 'ink', frameColor = '#1c1a18' } = p, rnd = brushRnd(style.length * 977 + Math.round(w * 100));
  const map = canvasMap(512, Math.round((512 * h) / w), (c, W, H) => {
    if (style === 'tapestry') {
      c.fillStyle = '#2c3528'; c.fillRect(0, 0, W, H); c.fillStyle = '#c4b184'; c.fillRect(0, H * 0.45, W, H * 0.2);
      for (let i = 0; i < 900; i++) { c.fillStyle = ['#23301f', '#3d4d2e', '#596338', '#8a7a45', '#1b2419'][Math.floor(rnd() * 5)]; const x = rnd() * W, y = rnd() * H * (rnd() > 0.3 ? 0.62 : 1); c.beginPath(); c.ellipse(x, y, 5 + rnd() * 22, 4 + rnd() * 15, rnd() * 3, 0, 7); c.fill(); }
      c.strokeStyle = '#2a1e14'; c.lineWidth = 16; c.beginPath(); c.moveTo(W * 0.35, H); c.bezierCurveTo(W * 0.3, H * 0.7, W * 0.42, H * 0.5, W * 0.36, H * 0.25); c.stroke();
    } else if (style === 'earth') {
      c.fillStyle = '#d9c7a6'; c.fillRect(0, 0, W, H);
      for (const [col, y0] of [['#7e4a2a', 0.15], ['#b07a45', 0.4], ['#3a2f27', 0.68]]) { c.fillStyle = col; c.beginPath(); c.moveTo(0, H * y0); for (let x = 0; x <= W; x += 24) c.lineTo(x, H * y0 + Math.sin(x * 0.02 + y0 * 9) * 40 + rnd() * 14); c.lineTo(W, H * (y0 + 0.2)); c.lineTo(0, H * (y0 + 0.22)); c.fill(); }
    } else {
      c.fillStyle = '#c9ad85'; c.fillRect(0, 0, W, H); c.strokeStyle = '#17130f'; c.lineCap = 'round';
      const branch = (x, y, a, l, t) => { if (l < 14) return; const X = x + Math.cos(a) * l, Y = y + Math.sin(a) * l; c.lineWidth = t; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + X) / 2 + rnd() * 26 - 13, (y + Y) / 2 + rnd() * 26 - 13, X, Y); c.stroke(); branch(X, Y, a + 0.3 + rnd() * 0.7, l * 0.74, t * 0.72); branch(X, Y, a - 0.3 - rnd() * 0.7, l * 0.68, t * 0.68); };
      branch(W * 0.5, H, -1.57, H * 0.26, 24); branch(0, H * 0.45, -0.1, W * 0.22, 18); branch(W, H * 0.3, 3.0, W * 0.22, 16);
    }
  });
  B(g, w + 0.08, h + 0.08, 0.05, solid(frameColor, 0.4), 0, -0.04, 0);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: 0.92 }));
  art.position.set(0, h / 2, 0.028); art.receiveShadow = true; g.add(art);
  return g;
}

/** Bibliothèque sur mesure jusqu'au plafond, garnie de livres et d'objets. */
function libraryWall(p) {
  const g = new THREE.Group(), { w = 3, h = 2.8, d = 0.38, clothes } = p, wd = walnutMat(), bays = Math.max(1, Math.round(w / 0.95)), bw = w / bays, shelves = Math.max(3, Math.round(h / 0.42)), sh = (h - 0.72) / shelves, rnd = brushRnd(Math.round(w * 137 + h * 71));
  B(g, w, h, 0.02, wd, 0, 0, -d / 2 + 0.01); B(g, w, 0.08, d, wd, 0, h - 0.08, 0); B(g, w, 0.72, d, wd, 0, 0, 0);
  for (let i = 0; i <= bays; i++) B(g, 0.035, h, d, wd, -w / 2 + i * bw, 0, 0);
  for (let i = 0; i < bays; i++) { const cx = -w / 2 + (i + 0.5) * bw; B(g, 0.012, 0.11, 0.012, brass(), cx - 0.05, 0.42, d / 2 + 0.01); B(g, 0.012, 0.11, 0.012, brass(), cx + 0.05, 0.42, d / 2 + 0.01); B(g, 0.01, 0.62, 0.006, solid('#2e1f15', 0.6), cx, 0.05, d / 2 + 0.002, 0); }
  const parts = [], colors = ['#7b2e23', '#2f3c33', '#c9b28d', '#1f2a3a', '#8a6236', '#e8dfcc', '#3b2b20', '#a68a58', '#5a6b5d'], color = new THREE.Color();
  const add = (geo, hex) => { color.set(hex); const n = geo.attributes.position.count, cols = new Float32Array(n * 3); for (let k = 0; k < n; k++) { cols[k * 3] = color.r; cols[k * 3 + 1] = color.g; cols[k * 3 + 2] = color.b; } geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.deleteAttribute('uv'); parts.push(geo); };
  for (let i = 0; i < bays; i++) for (let j = 0; j < shelves; j++) {
    const y = 0.72 + j * sh; B(g, bw, 0.028, d, wd, -w / 2 + (i + 0.5) * bw, y + sh - 0.014, 0);
    if (clothes) continue;
    let x = -w / 2 + i * bw + 0.05; const end = x + bw - 0.1, stopAt = rnd() > 0.72 ? x + bw * (0.35 + rnd() * 0.3) : end;
    while (x < stopAt) { const t = 0.022 + rnd() * 0.035, tall = sh * (0.55 + rnd() * 0.3), dp = 0.16 + rnd() * 0.08; add(new THREE.BoxGeometry(t, tall, dp).translate(x + t / 2, y + tall / 2, 0.02), colors[Math.floor(rnd() * colors.length)]); x += t + 0.002; }
  }
  if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 })); m.castShadow = m.receiveShadow = true; g.add(m); parts.forEach((q) => q.dispose()); }
  return g;
}

/** Dressing en noyer : penderies garnies, étagères, tiroirs à poignées laiton. */
function dressingWall(p) {
  const g = new THREE.Group(), { w = 3, h = 2.6, d = 0.6 } = p, wd = walnutMat(), bays = Math.max(1, Math.round(w / 1.05)), bw = w / bays, rnd = brushRnd(Math.round(w * 311));
  B(g, w, h, 0.02, wd, 0, 0, -d / 2 + 0.01); B(g, w, 0.07, d, wd, 0, h - 0.07, 0); B(g, w, 0.08, d, wd, 0, 0, 0);
  const tones = ['#ece6d8', '#2b2a2c', '#7c6a55', '#b8a78d', '#39465a', '#d9d2c2'];
  for (let i = 0; i <= bays; i++) B(g, 0.03, h, d, wd, -w / 2 + i * bw, 0, 0);
  for (let i = 0; i < bays; i++) {
    const cx = -w / 2 + (i + 0.5) * bw;
    if (i % 3 === 2) { for (let j = 0; j < 3; j++) { B(g, bw - 0.05, 0.22, d - 0.05, wd, cx, 0.1 + j * 0.24, 0.02); B(g, 0.2, 0.014, 0.018, brass(), cx, 0.2 + j * 0.24, d / 2 + 0.01); } for (let j = 0; j < 4; j++) { B(g, bw, 0.025, d, wd, cx, 0.86 + j * 0.42, 0); B(g, 0.28, 0.2, 0.26, solid(tones[(i + j) % tones.length], 0.8), cx, 0.885 + j * 0.42, 0, 0.01); } continue; }
    B(g, bw - 0.04, 0.025, d, wd, cx, h - 0.42, 0); const rod = C(g, 0.012, 0.012, bw - 0.05, brass(), cx, h - 0.54, 0, 10); rod.rotation.z = Math.PI / 2;
    for (let k = 0; k < 9; k++) { const x = cx - bw / 2 + 0.08 + (k * (bw - 0.16)) / 8, long = 0.8 + rnd() * 0.65; B(g, 0.05, long, 0.4, fabric(tones[Math.floor(rnd() * tones.length)], 'lin'), x, h - 0.56 - long, 0, 0.012); }
  }
  return g;
}

/** Table de ferme en bois massif, plateau épais et piétement en poutres. */
function solidTable(p) {
  const g = new THREE.Group(), { w = 3.2, d = 1.1, h = 0.76 } = p, wd = texturedMaterial('american_walnut_veneer', 1.4, { tint: '#e0a56b', gain: 1.35 });
  B(g, w, 0.09, d, wd, 0, h - 0.09, 0, 0.012);
  for (const s of [-1, 1]) { B(g, 0.14, h - 0.09, d * 0.74, wd, s * w * 0.34, 0, 0, 0.01); B(g, 0.22, 0.06, d * 0.84, wd, s * w * 0.34, 0, 0, 0.01); }
  B(g, w * 0.68, 0.1, 0.09, wd, 0, 0.28, 0, 0.008);
  return g;
}

/** Vase garni de branches feuillues. */
function branchVase(p) {
  const g = new THREE.Group(), { w = 0.45, h = 0.85 } = p, r = w * 0.32, rnd = brushRnd(Math.round(h * 991 + w * 53)), leaf = solid('#536b3c', 0.8), wood_ = solid('#4f3a28', 0.8), body = ceramic('#d9d2c4');
  S(g, r, body, 0, r * 1.05, 0, 1, 1.1, 1);
  C(g, r * 0.32, r * 0.4, r * 0.5, body, 0, r * 2.05, 0, 16);
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, lean = 0.1 + rnd() * 0.3, L = h * (0.55 + rnd() * 0.3), m = mesh(new THREE.CylinderGeometry(0.004, 0.006, L, 5), wood_, Math.cos(a) * L * lean * 0.5, r * 2.2 + L * 0.45, Math.sin(a) * L * lean * 0.5); m.rotation.z = -Math.cos(a) * lean; m.rotation.x = Math.sin(a) * lean; g.add(m); for (let k = 0; k < 14; k++) { const t = 0.3 + k * 0.05, q = S(g, 0.012 + rnd() * 0.012, leaf, Math.cos(a) * L * lean * t + (rnd() - 0.5) * 0.09, r * 2.2 + L * t * 0.95 + (rnd() - 0.5) * 0.05, Math.sin(a) * L * lean * t + (rnd() - 0.5) * 0.09, 1.9, 0.35, 0.8); q.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); } }
  return g;
}

/** Série de coussins posés sur un canapé. */
function cushionSet(p) {
  const g = new THREE.Group(), { w = 2, colors = ['#d7c8ad', '#7a4a2c', '#e8dfcf'] } = p, n = Math.max(2, Math.round(w / 0.42));
  for (let i = 0; i < n; i++) { const s = (i % 2 ? 0.42 : 0.5), m = B(g, s, s, 0.14, fabric(colors[i % colors.length], 'lin'), -w / 2 + ((i + 0.5) * w) / n, 0, 0, 0.055); m.rotation.x = -0.3; m.rotation.z = i % 2 ? 0.08 : -0.06; }
  return g;
}

function sconce(p) {
  const g = new THREE.Group(), { h = 0.6 } = p;
  B(g, 0.07, h, 0.03, brass(), 0, 0, 0, 0.01); B(g, 0.05, h - 0.06, 0.02, emissive('#ffd9a3', 2.6), 0, 0.03, 0.018, 0.008);
  return g;
}

function domePendant(p) {
  const g = new THREE.Group(), { w = 0.6, h = 0.9 } = p, metal = brass();
  const dome = mesh(new THREE.SphereGeometry(w / 2, 28, 12, 0, 6.3, 0, 1.45), metal.clone(), 0, 0.02, 0); dome.material.side = THREE.DoubleSide; g.add(dome);
  S(g, 0.05, emissive('#ffe2b8', 4), 0, 0.03, 0); C(g, 0.006, 0.006, h, metal, 0, w / 2, 0, 8);
  return g;
}

let marbleCache = null;
/** Marbre calacatta viola : grands blocs clairs cernés de veines lie-de-vin. */
const marbleMat = () => {
  if (marbleCache) return marbleCache;
  const rnd = brushRnd(4441);
  const map = canvasMap(1024, 1024, (c, W, H) => {
    c.fillStyle = '#f0e9e0'; c.fillRect(0, 0, W, H);
    const pts = Array.from({ length: 34 }, () => [rnd() * W, rnd() * H]);
    c.lineJoin = 'round';
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const [ax, ay] = pts[i], [bx, by] = pts[j], d = Math.hypot(ax - bx, ay - by);
      if (d > 260) continue;
      c.strokeStyle = ['#4a2230', '#6c3440', '#2d1a22', '#8c6a68'][Math.floor(rnd() * 4)]; c.globalAlpha = 0.55 + rnd() * 0.4; c.lineWidth = 1 + rnd() * rnd() * 16;
      c.beginPath(); c.moveTo(ax, ay); let x = ax, y = ay; for (let k = 1; k < 8; k++) { x = ax + ((bx - ax) * k) / 8 + (rnd() - 0.5) * 34; y = ay + ((by - ay) * k) / 8 + (rnd() - 0.5) * 34; c.lineTo(x, y); } c.lineTo(bx, by); c.stroke();
    }
    c.globalAlpha = 1;
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(0.6, 0.6);
  marbleCache = new THREE.MeshStandardMaterial({ map, roughness: 0.2 });
  return marbleCache;
};
const brassBar = (g, x, y, z, len, vertical) => B(g, vertical ? 0.018 : len, vertical ? len : 0.018, 0.022, brass(), x, y, z);

/** Linéaire de cuisine sur mesure : noyer sombre, plan en marbre, poignées laiton. */
function cabinetRun(p) {
  const g = new THREE.Group(), { w = 4, d = 0.62, h = 0.92, upper, gap = 0, splash } = p, wd = walnutMat(), n = Math.max(1, Math.round(w / 0.6)), ew = w / n;
  B(g, w, 0.1, d - 0.08, solid('#17130f', 0.8), 0, 0, -0.04);
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * ew; B(g, ew - 0.008, h - 0.14, d - 0.03, wd, x, 0.1, 0); B(g, ew - 0.13, h - 0.3, 0.012, wd, x, 0.17, d / 2 - 0.008); brassBar(g, x, h - 0.2, d / 2 + 0.008, 0.2); }
  B(g, w + 0.03, 0.05, d + 0.04, marbleMat(), 0, h - 0.04, 0, 0.012);
  if (splash) B(g, w, 0.72, 0.03, marbleMat(), 0, h + 0.01, -d / 2 + 0.02);
  if (upper) {
    B(g, w, 1.46 - 0.92, 0.02, marbleMat(), 0, h + 0.01, -d / 2 + 0.01);
    const uh = 0.92, left = (w - gap) / 2;
    for (const s of [-1, 1]) { if (left <= 0.1) continue; const cx = s * (gap / 2 + left / 2), un = Math.max(1, Math.round(left / 0.6)), uw = left / un; for (let i = 0; i < un; i++) { const x = cx - left / 2 + (i + 0.5) * uw; B(g, uw - 0.008, uh, 0.36, wd, x, 1.46, -d / 2 + 0.18); B(g, uw - 0.12, uh - 0.14, 0.012, solid('#b9b6a8', 0.25, 0.2), x, 1.53, -d / 2 + 0.365); brassBar(g, x + uw / 2 - 0.06, 1.6, -d / 2 + 0.385, 0.34, true); } }
  }
  return g;
}

/** Colonnes de cuisine toute hauteur, longues poignées en laiton. */
function tallCabinets(p) {
  const g = new THREE.Group(), { w = 3, d = 0.65, h = 2.75 } = p, wd = walnutMat(), n = Math.max(1, Math.round(w / 0.75)), ew = w / n;
  B(g, w, 0.1, d - 0.08, solid('#17130f', 0.8), 0, 0, -0.04);
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * ew; B(g, ew - 0.008, h - 0.1, d, wd, x, 0.1, 0); B(g, ew - 0.14, h - 0.34, 0.012, wd, x, 0.22, d / 2 + 0.002); brassBar(g, x + (i % 2 ? -1 : 1) * (ew / 2 - 0.07), 0.55, d / 2 + 0.014, 1.5, true); }
  B(g, w + 0.06, 0.09, d + 0.06, wd, 0, h, 0);
  return g;
}

/** Îlot en noyer et grand plateau de marbre, côté assises dégagé. */
function marbleIsland(p) {
  const g = new THREE.Group(), { w = 3, d = 1.2, h = 0.94 } = p, wd = walnutMat(), n = Math.max(2, Math.round(w / 0.7));
  B(g, w - 0.1, h - 0.06, d - 0.32, wd, 0, 0, -0.1);
  for (let i = 0; i < n; i++) { const x = -w / 2 + 0.05 + (i + 0.5) * ((w - 0.1) / n); B(g, (w - 0.1) / n - 0.1, h - 0.3, 0.012, wd, x, 0.12, -0.1 - (d - 0.32) / 2 - 0.004); brassBar(g, x, h - 0.2, -0.1 - (d - 0.32) / 2 - 0.016, 0.2); }
  B(g, w + 0.05, 0.07, d, marbleMat(), 0, h - 0.07, 0, 0.02);
  B(g, 0.5, 0.012, 0.38, solid('#2a2a2c', 0.35, 0.4), -w * 0.22, h, -0.1, 0); const tap = mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 20, Math.PI), brass(), -w * 0.22, h + 0.2, -0.32); g.add(tap); C(g, 0.012, 0.012, 0.2, brass(), -w * 0.22 + 0.1, h, -0.32, 8);
  return g;
}

/** Piano de cuisson noir et laiton, crédence de marbre et hotte en plâtre. */
function rangeHood(p) {
  const g = new THREE.Group(), { w = 1.3, d = 0.65, h = 2.9 } = p, plaster = solid('#e9e2d4', 0.92), dark = solid('#17171b', 0.4, 0.3);
  B(g, w, 0.9, d, dark, 0, 0.02, 0, 0.012); B(g, w * 0.86, 0.46, 0.02, solid('#0d0d10', 0.25, 0.4), 0, 0.14, d / 2); brassBar(g, 0, 0.66, d / 2 + 0.03, w * 0.8);
  for (let i = 0; i < 6; i++) C(g, 0.022, 0.022, 0.03, brass(), -w * 0.34 + i * w * 0.136, 0.77, d / 2 + 0.02, 12).rotation.x = Math.PI / 2;
  B(g, w + 0.02, 0.03, d, solid('#101013', 0.3, 0.3), 0, 0.92, 0);
  B(g, w + 0.5, 0.72, 0.03, marbleMat(), 0, 0.95, -d / 2 + 0.02);
  B(g, w + 0.42, 0.42, d * 0.92, plaster, 0, 1.72, -d * 0.04, 0.02);
  const s = new THREE.Shape(); s.moveTo(-(w + 0.42) / 2, 0); s.lineTo((w + 0.42) / 2, 0); s.bezierCurveTo((w + 0.42) / 2, 0.35, w * 0.3, 0.42, w * 0.3, h - 2.14); s.lineTo(-w * 0.3, h - 2.14); s.bezierCurveTo(-w * 0.3, 0.42, -(w + 0.42) / 2, 0.35, -(w + 0.42) / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d * 0.72, bevelEnabled: false, curveSegments: 16 }); geo.translate(0, 2.14, -d / 2 + 0.03);
  const m = new THREE.Mesh(geo, plaster); m.castShadow = m.receiveShadow = true; g.add(m);
  return g;
}

/** Table ronde sur pied en plâtre, comme dans les grands halls. */
function pedestalTable(p) {
  const g = new THREE.Group(), { w = 1.4, h = 0.8 } = p, plaster = solid('#ece6da', 0.9);
  C(g, w * 0.26, w * 0.34, h - 0.08, plaster, 0, 0, 0, 40); C(g, w / 2, w / 2, 0.08, plaster, 0, h - 0.08, 0, 56);
  return g;
}

/** Grande jarre en terre cuite et brassée de fleurs. */
function urnBouquet(p) {
  const g = new THREE.Group(), { w = 0.5, h = 1.1 } = p, clay = solid('#a8714c', 0.85), rnd = brushRnd(8123), r = w * 0.42, bloom = solid('#f3ede0', 0.8), green = solid('#8b9a58', 0.8), stem = solid('#5a4632', 0.8);
  S(g, r, clay, 0, r * 1.15, 0, 1, 1.25, 1); C(g, r * 0.5, r * 0.6, r * 0.32, clay, 0, r * 2.2, 0, 24);
  for (let i = 0; i < 10; i++) S(g, r * 0.3, green, Math.cos(i * 0.63) * r * 0.5, r * 2.55, Math.sin(i * 0.63) * r * 0.5);
  for (let i = 0; i < 12; i++) { const a = rnd() * 6.28, lean = 0.25 + rnd() * 0.5, L = h * (0.4 + rnd() * 0.25), bx = Math.cos(a) * L * lean, bz = Math.sin(a) * L * lean, m = mesh(new THREE.CylinderGeometry(0.005, 0.008, L, 5), stem, bx / 2, r * 2.5 + L * 0.45, bz / 2); m.rotation.z = -Math.cos(a) * lean; m.rotation.x = Math.sin(a) * lean; g.add(m); for (let k = 0; k < 8; k++) { const t = 0.45 + k * 0.08; S(g, 0.03 + rnd() * 0.03, bloom, bx * t + (rnd() - 0.5) * 0.1, r * 2.5 + L * 0.9 * t + (rnd() - 0.5) * 0.08, bz * t + (rnd() - 0.5) * 0.1); } }
  return g;
}

/** Lanterne de cuisine en verre et laiton. */
function lantern(p) {
  const g = new THREE.Group(), { w = 0.42, h = 1.1 } = p, metal = brass(), hw = w / 2, body = 0.62;
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { B(g, 0.016, body, 0.016, metal, x * hw, 0, z * hw); }
  B(g, w + 0.03, 0.02, w + 0.03, metal, 0, 0, 0); const cap = C(g, 0.03, hw * 1.45, 0.16, metal, 0, body, 0, 4); cap.rotation.y = Math.PI / 4;
  const pane = glass(); B(g, w, body, 0.004, pane, 0, 0, hw); B(g, w, body, 0.004, pane, 0, 0, -hw); B(g, 0.004, body, w, pane, hw, 0, 0); B(g, 0.004, body, w, pane, -hw, 0, 0);
  S(g, 0.05, emissive('#ffe2b8', 3.5), 0, body * 0.5, 0); C(g, 0.006, 0.006, Math.max(0.1, h - body - 0.16), metal, 0, body + 0.16, 0, 6);
  return g;
}

/** Vasque monobloc en marbre, suspendue. */
function marbleBlockVanity(p) {
  const g = new THREE.Group(), { w = 1.3, d = 0.48, h = 0.88 } = p;
  B(g, w, 0.42, d, marbleMat(), 0, h - 0.42, 0, 0.004); B(g, w * 0.5, 0.012, d * 0.55, solid('#e7dfd5', 0.2), 0, h, 0.02);
  B(g, 0.03, 0.2, 0.03, solid('#16161a', 0.3, 0.5), 0, h, -d / 2 + 0.05); B(g, 0.02, 0.02, 0.15, solid('#16161a', 0.3, 0.5), 0, h + 0.2, -d / 2 + 0.11);
  return g;
}

/** Buffet en noyer à portes cintrées et poignées laiton. */
function walnutSideboard(p) {
  const g = new THREE.Group(), { w = 2.1, d = 0.48, h = 0.84 } = p, wd = walnutMat(), n = Math.max(2, Math.round(w / 0.5)), ew = (w - 0.06) / n, dark = solid('#2c1d13', 0.7);
  B(g, w, h - 0.1, d, wd, 0, 0.1, 0, 0.006); B(g, w + 0.04, 0.035, d + 0.03, wd, 0, h, 0, 0.008); B(g, w - 0.04, 0.1, d - 0.06, dark, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.03 + ew * (i + 0.5), pw = ew - 0.07, ph = h - 0.34, sh = new THREE.Shape(), r = pw / 2;
    sh.moveTo(-r, 0); sh.lineTo(r, 0); sh.lineTo(r, ph - r); sh.absarc(0, ph - r, r, 0, Math.PI, false); sh.lineTo(-r, 0);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 16 }), dark); m.position.set(x, 0.2, d / 2 - 0.004); g.add(m);
    B(g, 0.012, 0.09, 0.02, brass(), x + (i % 2 ? -1 : 1) * (ew / 2 - 0.03), 0.42, d / 2 + 0.008);
  }
  return g;
}

/** Baignoire îlot ovale et sa colonne de robinetterie. */
function ovalTub(p) {
  const g = new THREE.Group(), { w = 1.8, d = 0.85, h = 0.58 } = p, white = ceramic('#f4f1ea');
  const body = C(g, 0.5, 0.42, h, white, 0, 0, 0, 48); body.scale.set(w, 1, d);
  const rim = mesh(new THREE.TorusGeometry(0.47, 0.04, 12, 48), white, 0, h, 0); rim.rotation.x = Math.PI / 2; rim.scale.set(w, d, 1); g.add(rim);
  const water = C(g, 0.45, 0.45, 0.005, solid('#dce7e6', 0.08), 0, h - 0.1, 0, 40); water.scale.set(w, 1, d);
  C(g, 0.016, 0.016, 1.05, brass(), w / 2 + 0.12, 0, 0, 10); B(g, 0.26, 0.02, 0.024, brass(), w / 2 - 0.0, 1.04, 0);
  return g;
}

/** Meuble vasque double en noyer, plateau de pierre, robinets muraux laiton. */
function stoneVanity(p) {
  const g = new THREE.Group(), { w = 2.2, d = 0.55, h = 0.86 } = p, wd = walnutMat(), stone = texturedMaterial('large_sandstone_blocks', 1.2, { tint: '#e9dfca', gain: 1.3 });
  B(g, w, h - 0.26, d - 0.03, wd, 0, 0.18, 0, 0.006);
  for (const s of [-1, 1]) for (let j = 0; j < 2; j++) { B(g, w / 2 - 0.06, (h - 0.3) / 2 - 0.02, 0.012, wd, s * w / 4, 0.2 + j * ((h - 0.3) / 2), d / 2 - 0.012); B(g, 0.2, 0.014, 0.02, brass(), s * w / 4, 0.42 + j * ((h - 0.3) / 2), d / 2 + 0.005); }
  B(g, w + 0.04, 0.08, d + 0.03, stone, 0, h - 0.08, 0, 0.01);
  for (const s of [-1, 1]) { const b = C(g, 0.21, 0.17, 0.02, ceramic('#efeae0'), s * w / 4, h, 0, 32); b.scale.set(1.15, 1, 0.82); B(g, 0.02, 0.02, 0.2, brass(), s * w / 4, h + 0.26, -d / 2 + 0.1); }
  return g;
}

/** Bain de soleil vintage : structure en bois, matelas à rayures. */
function stripedLounger(p) {
  const g = new THREE.Group(), { w = 0.7, d = 1.95, color = '#e7b52e' } = p;
  const map = canvasMap(256, 64, (c, W, H) => { const n = 8; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#f6f1e3' : color; c.fillRect((i * W) / n, 0, W / n + 1, H); } });
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1, 1);
  const cloth = new THREE.MeshStandardMaterial({ map, roughness: 0.9 }), frame = wood('chene');
  const seat = d * 0.68, back = d - seat, y = 0.3;
  const pad = (L) => new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.1, L, 1, 1, 1), cloth);
  const a = pad(seat); a.position.set(0, y + 0.05, d / 2 - seat / 2); a.castShadow = a.receiveShadow = true; g.add(a);
  B(g, w, 0.04, seat, frame, 0, y - 0.04, d / 2 - seat / 2);
  const hinge = new THREE.Group(); hinge.position.set(0, y + 0.02, -d / 2 + back); hinge.rotation.x = 0.62; g.add(hinge);
  const b2 = pad(back); b2.position.set(0, 0.05, -back / 2); b2.castShadow = true; hinge.add(b2);
  B(hinge, w, 0.04, back, frame, 0, -0.04, -back / 2);
  for (const sz of [0.82, 0.1]) for (const sx of [-1, 1]) B(g, 0.05, y - 0.04, 0.05, frame, sx * (w / 2 - 0.05), 0, (d / 2) * sz);
  return g;
}

function vintageParasol(p) {
  const g = new THREE.Group(), { w = 2.8, h = 2.7, color = '#e7b52e' } = p;
  const map = canvasMap(512, 32, (c, W, H) => { const n = 16; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#f6f1e3' : color; c.fillRect((i * W) / n, 0, W / n + 1, H); } });
  const cloth = new THREE.MeshStandardMaterial({ map, roughness: 0.92, side: THREE.DoubleSide });
  C(g, 0.024, 0.03, h, wood('chene'), 0, 0, 0, 10);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w / 2, 0.62, 16, 1, true), cloth); roof.position.y = h - 0.18; roof.castShadow = true; g.add(roof);
  const fringe = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.14, 16, 1, true), cloth); fringe.position.y = h - 0.56; g.add(fringe);
  S(g, 0.05, wood('chene'), 0, h + 0.15, 0);
  C(g, 0.3, 0.34, 0.08, solid('#d4cbb8', 0.8), 0, 0, 0, 24);
  return g;
}

function cypress(p) { return cypressTree(p); }

function umbrellaPine(p) { return parasolPine(p); }

export const PROC = {
  sofa, armchair, tvBench, tv, bookcase, table, chair, barStool, bed, mattress: mattressOnly, drawers, wardrobe, desk, officeChair,
  kitchenBase, kitchenWall, kitchenTall, oven, sinkUnit, hob, hood, fridge, dishwasher, washer, worktop, island,
  bathtub, shower, vanity, wc, towelRadiator, mirrorWall, mirrorCabinet, rug, curtain, pendant, floorLamp, tableLamp, picture,
  stairs, slab, pergola, hedge, tree, fence, pool, balcony, railing, retaining,
  flowerBed, daybed, walnutSideboard, pedestalTable, urnBouquet, lantern, marbleBlockVanity,
  fireplace, outdoorKitchen, firepit, column, ringChandelier, parasol, topiary, sportsCar,
  bigArt, libraryWall, dressingWall, solidTable, branchVase, cushionSet, sconce, domePendant, cabinetRun, tallCabinets, marbleIsland, rangeHood, ovalTub, stoneVanity, stripedLounger, vintageParasol, cypress, umbrellaPine,
};

/** Résout les finitions décrites dans le catalogue, puis construit le meuble. */
export function buildProc(spec, size, color) {
  const fn = PROC[spec.type];
  if (!fn) return new THREE.Group();
  const p = { ...spec.p, ...size };
  const finish = spec.p?.woodKind ? wood(spec.p.woodKind) : finishFromColor(color || spec.color, spec.slug || '');
  p.finish = finish; p.facade = p.facade || finish;
  p.worktop = p.worktop || wood('chene');
  if (color && ['sofa', 'armchair', 'rug', 'curtain', 'stripedLounger', 'vintageParasol'].includes(spec.type)) p.color = color;
  if (spec.p?.bedColor) p.color = spec.p.bedColor;
  return fn(p);
}
