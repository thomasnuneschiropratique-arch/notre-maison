// Voitures : carrosserie lissée à partir de vraies cotes, vitres transparentes, habitacle, jantes et freins.
// Longueur en Z, capot vers +Z, sol à y = 0.
import * as THREE from 'three';
import { solid, chrome, fabric } from './materials.js';
import { LOW } from './quality.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Courbe douce passant par des points (z, valeur), z croissant. */
function curve(keys) {
  const n = keys.length, m = keys.map((k, i) => {
    if (i === 0) return (keys[1][1] - k[1]) / (keys[1][0] - k[0]);
    if (i === n - 1) return (k[1] - keys[i - 1][1]) / (k[0] - keys[i - 1][0]);
    return (keys[i + 1][1] - keys[i - 1][1]) / (keys[i + 1][0] - keys[i - 1][0]);
  });
  return (z) => {
    if (z <= keys[0][0]) return keys[0][1];
    if (z >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (z > keys[i + 1][0]) i++;
    const h = keys[i + 1][0] - keys[i][0], t = (z - keys[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * keys[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * keys[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}

const SPECS = {
  ferrari: {
    L: 4.66, zF: 1.42, zR: -1.3, R: 0.345, tireF: 0.245, tireR: 0.285, track: 0.8,
    top: [[-2.33, 0.8], [-2.12, 0.93], [-1.6, 0.99], [-0.95, 1.16], [-0.35, 1.28], [0.05, 1.3], [0.45, 1.21], [0.98, 0.95], [1.4, 0.84], [1.9, 0.73], [2.2, 0.62], [2.33, 0.5]],
    belt: [[-2.33, 0.78], [-2, 0.9], [-1.4, 0.94], [-0.4, 0.87], [0.4, 0.83], [1, 0.84], [1.6, 0.8], [2.1, 0.68], [2.33, 0.5]],
    hw: [[-2.33, 0.76], [-2.05, 0.93], [-1.35, 0.985], [-0.4, 0.93], [0.3, 0.92], [1.35, 0.975], [1.9, 0.92], [2.2, 0.78], [2.33, 0.6]],
    low: [[-2.33, 0.3], [-1.9, 0.2], [0, 0.15], [2, 0.14], [2.33, 0.2]],
    cabF: [0.6, 1.08], cabR: [-1.9, -1.1], cabHalf: 0.66,
    glass: { base: 0.98, top: 0.08, sideF: 0.68, sideR: -0.72, rearA: -0.5, rearB: -1.62 },
    doors: [0.72, -0.62], caliper: '#e6b800', rim: '#cfd1d4',
  },
  911: {
    L: 4.52, zF: 1.31, zR: -1.14, R: 0.34, tireF: 0.235, tireR: 0.295, track: 0.76,
    top: [[-2.26, 0.78], [-2.05, 0.93], [-1.75, 1], [-1, 1.16], [-0.35, 1.28], [0, 1.3], [0.35, 1.24], [0.82, 0.98], [1.1, 0.83], [1.6, 0.73], [2, 0.66], [2.26, 0.5]],
    belt: [[-2.26, 0.76], [-2, 0.92], [-1.4, 0.97], [-0.5, 0.85], [0.5, 0.83], [1.1, 0.89], [1.6, 0.91], [1.95, 0.84], [2.2, 0.62], [2.26, 0.5]],
    hw: [[-2.26, 0.7], [-2, 0.9], [-1.45, 0.925], [-0.4, 0.86], [0.5, 0.85], [1.4, 0.9], [1.9, 0.88], [2.15, 0.72], [2.26, 0.55]],
    low: [[-2.26, 0.3], [-1.9, 0.2], [0, 0.16], [2, 0.15], [2.26, 0.22]],
    cabF: [0.45, 0.92], cabR: [-1.95, -0.95], cabHalf: 0.63,
    glass: { base: 0.84, top: 0.06, sideF: 0.56, sideR: -0.7, rearA: -0.5, rearB: -1.45 },
    doors: [0.58, -0.56], caliper: '#b01818', rim: '#54565a',
  },
};

const NV = 26;

/** Forme de la carrosserie : position d'un point selon sa place sur la longueur et autour de la section. */
function bodyFn(spec) {
  const top = curve(spec.top), belt = curve(spec.belt), hw = curve(spec.hw), low = curve(spec.low), H = spec.L / 2;
  const arch = (z) => {
    let a = 0;
    for (const w of [spec.zF, spec.zR]) { const r = spec.R + 0.05, d = Math.abs(z - w); if (d < r) a = Math.max(a, spec.R + Math.sqrt(r * r - d * d)); }
    return a;
  };
  return (z, v, side) => {
    const dist = H - Math.abs(z), k = dist < 0.12 ? Math.sqrt(clamp(1 - ((0.12 - dist) / 0.12) ** 2, 0.0004)) : 1;
    let b = belt(z), t = top(z), lo = Math.max(low(z), arch(z));
    const mid = (b + lo) / 2;
    b = mid + (b - mid) * k; t = mid + (t - mid) * k; lo = mid + (lo - mid) * k;
    const W = hw(z) * k, cab = ss(spec.cabF[1], spec.cabF[0], z) * ss(spec.cabR[0], spec.cabR[1], z);
    let x, y;
    if (v <= 0.5) {
      const s = v / 0.5;
      x = W * (0.9 + 0.1 * Math.sin((s * Math.PI) / 2));
      y = lo + (b - lo) * s;
    } else {
      const u = (v - 0.5) / 0.5, th = (u * Math.PI) / 2, e = 0.6 + (0.3 - 0.6) * cab, X = W + (spec.cabHalf * k - W) * cab * ss(0, 0.12, u);
      x = X * Math.pow(Math.max(0, Math.cos(th)), e);
      y = b + (t - b) * Math.pow(Math.sin(th), cab > 0.5 ? 1.2 : 0.9);
    }
    return [side * x, y, z];
  };
}

function bodyGeometry(spec, f) {
  const NZ = LOW ? 110 : 230, pos = [], uv = [], idx = [], H = spec.L / 2, cols = NV * 2 + 1;
  for (let i = 0; i <= NZ; i++) {
    // Plus de points aux extrémités, où la forme se referme.
    const s = i / NZ, z = -H * Math.cos(Math.PI * s) * 0.5 + (-H + 2 * H * s) * 0.5;
    for (let j = 0; j < cols; j++) {
      const side = j <= NV ? 1 : -1, v = j <= NV ? j / NV : (2 * NV - j) / NV, p = f(z, v, side);
      pos.push(...p); uv.push((z + H) / (2 * H), v);
    }
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Dessine vitres, ouvrants, bas de caisse et grilles, dans le repère longueur × tour de section. */
function paintMaps(spec, color) {
  const W = LOW ? 1024 : 2048, Hp = W / 2, H = spec.L / 2, X = (z) => ((z + H) / (2 * H)) * W, Y = (v) => (1 - v) * Hp;
  const body = document.createElement('canvas'), mask = document.createElement('canvas');
  body.width = mask.width = W; body.height = mask.height = Hp;
  const c = body.getContext('2d'), m = mask.getContext('2d');
  c.fillStyle = color; c.fillRect(0, 0, W, Hp);
  m.fillStyle = '#000'; m.fillRect(0, 0, W, Hp);
  const G = spec.glass;
  const shapes = [
    // Pare-brise.
    [[G.base, 0.66], [G.top + 0.34, 0.74], [G.top, 0.88], [G.top, 1], [G.base, 1]],
    // Vitre latérale, le long du montant.
    [[G.sideF, 0.575], [G.sideF - 0.14, 0.66], [G.top + 0.2, 0.78], [G.top - 0.16, 0.815], [G.sideR + 0.3, 0.8], [G.sideR, 0.66], [G.sideR + 0.1, 0.575]],
    // Lunette arrière.
    [[G.rearA, 0.9], [G.rearA - 0.1, 1], [G.rearB, 1], [G.rearB + 0.12, 0.9]],
  ];
  const trace = (ctx, pts) => { ctx.beginPath(); pts.forEach(([z, v], i) => (i ? ctx.lineTo(X(z), Y(v)) : ctx.moveTo(X(z), Y(v)))); ctx.closePath(); };
  // Joints en caoutchouc autour des vitres.
  c.strokeStyle = '#0a0a0b'; c.lineWidth = W / 300; c.lineJoin = 'round';
  for (const s of shapes) { trace(c, s); c.stroke(); }
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
  for (const s of shapes) { trace(c, s); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  m.fillStyle = '#fff';
  for (const s of shapes) { trace(m, s); m.fill(); }
  // Lignes d'ouvrants.
  c.strokeStyle = 'rgba(8,8,9,.92)'; c.lineWidth = W / 900;
  const line = (pts) => { c.beginPath(); pts.forEach(([z, v], i) => (i ? c.lineTo(X(z), Y(v)) : c.moveTo(X(z), Y(v)))); c.stroke(); };
  const [dF, dR] = spec.doors;
  line([[dF, 0.56], [dF + 0.02, 0.32], [dF - 0.04, 0.1], [dR + 0.05, 0.1], [dR, 0.32], [dR, 0.56]]);
  const hoodB = G.base + 0.06, nose = H - 0.3;
  line([[hoodB, 0.7], [hoodB, 1]]); line([[hoodB, 0.7], [(hoodB + nose) / 2, 0.68], [nose, 0.74], [nose + 0.04, 1]]);
  const tail = -H + 0.3, deck = G.rearB - 0.08;
  line([[deck, 0.82], [deck, 1]]); line([[deck, 0.82], [tail, 0.8], [tail - 0.04, 1]]);
  // Poignée de porte et bas de caisse noir.
  c.fillStyle = 'rgba(14,14,15,.75)'; c.fillRect(X(dR + 0.2), Y(0.5), X(dR + 0.36) - X(dR + 0.2), Hp * 0.008);
  c.fillStyle = '#101012'; c.fillRect(0, Y(0.05), W, Hp);
  const body3 = new THREE.CanvasTexture(body), maskT = new THREE.CanvasTexture(mask);
  body3.colorSpace = THREE.SRGBColorSpace; body3.anisotropy = maskT.anisotropy = 8;
  return { map: body3, alpha: maskT };
}

const part = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
const box = (g, w, h, d, mat, x, y, z) => part(g, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z);

/** Roue complète : pneu à flanc arrondi, jante à cinq branches, disque et étrier. */
function wheel(spec, width, side) {
  const g = new THREE.Group(), R = spec.R, tire = solid('#141416', 0.92), rimM = solid(spec.rim, 0.26, 0.9), disc = solid('#8d8f93', 0.42, 0.95), inner = solid('#1a1b1d', 0.7, 0.4), w = width / 2;
  const prof = [[R * 0.7, -w], [R * 0.9, -w * 1.02], [R * 0.985, -w * 0.72], [R, -w * 0.3], [R, w * 0.3], [R * 0.985, w * 0.72], [R * 0.9, w * 1.02], [R * 0.7, w]].map(([r, y]) => new THREE.Vector2(r, y));
  const t = new THREE.Mesh(new THREE.LatheGeometry(prof, 44), tire); t.castShadow = true; g.add(t);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.71, R * 0.71, width * 0.98, 40, 1, true), inner); g.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.7, 0.012, 10, 48), rimM); lip.rotation.x = Math.PI / 2; lip.position.y = w * 0.98; g.add(lip);
  const dsk = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.03, 32), disc); dsk.position.y = -w * 0.15; g.add(dsk);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.11), solid(spec.caliper, 0.4, 0.1)); cal.position.set(R * 0.42, w * 0.08, -R * 0.2); g.add(cal);
  const spoke = new THREE.Shape(), r0 = R * 0.14, r1 = R * 0.7;
  spoke.moveTo(r0, -0.03); spoke.bezierCurveTo(r0 + 0.06, -0.018, r1 - 0.07, -0.022, r1, -0.05); spoke.lineTo(r1, 0.05); spoke.bezierCurveTo(r1 - 0.07, 0.022, r0 + 0.06, 0.018, r0, 0.03); spoke.closePath();
  const sg = new THREE.ExtrudeGeometry(spoke, { depth: 0.03, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 2, curveSegments: 6 });
  sg.rotateX(Math.PI / 2);
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(sg, rimM); s.rotation.y = (i * Math.PI * 2) / 5; s.position.y = w * 0.92; s.castShadow = true; g.add(s); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.17, R * 0.19, 0.04, 24), rimM); hub.position.y = w * 0.92; g.add(hub);
  g.rotation.z = -side * Math.PI / 2;
  return g;
}

const cache = new Map();

export function carModel(p) {
  const model = p.model === '911' ? '911' : 'ferrari', spec = SPECS[model], color = p.paint || (model === '911' ? '#6b3f24' : '#a50d0d'), g = new THREE.Group();
  const key = `${model}|${color}`;
  let shared = cache.get(key);
  if (!shared) {
    const f = bodyFn(spec), geo = bodyGeometry(spec, f), { map, alpha } = paintMaps(spec, color);
    shared = {
      f, geo,
      paint: new THREE.MeshPhysicalMaterial({ map, alphaTest: 0.5, metalness: model === '911' ? 0.35 : 0.2, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide }),
      liner: new THREE.MeshStandardMaterial({ map, color: '#0b0b0d', alphaTest: 0.5, roughness: 0.9, side: THREE.BackSide }),
      glassM: new THREE.MeshPhysicalMaterial({ color: '#10161a', alphaMap: alpha, transparent: true, opacity: 0.74, roughness: 0.04, metalness: 0.1, clearcoat: 1, depthWrite: false, envMapIntensity: 1.6 }),
    };
    cache.set(key, shared);
  }
  const { f, geo, paint, liner, glassM } = shared, H = spec.L / 2;
  const body = new THREE.Mesh(geo, paint); body.castShadow = true; g.add(body);
  const inner = new THREE.Mesh(geo, liner); inner.scale.set(0.992, 0.998, 0.998); g.add(inner);
  const gl = new THREE.Mesh(geo, glassM); gl.userData.noAO = true; gl.renderOrder = 2; g.add(gl);

  // Soubassement et passages de roues.
  const black = solid('#0d0d0e', 0.85);
  box(g, spec.track * 2 - 0.34, 0.24, spec.L - 0.72, black, 0, 0.12, 0);

  for (const [z, width] of [[spec.zF, spec.tireF], [spec.zR, spec.tireR]]) for (const s of [-1, 1]) {
    const hwHere = f(z, 0.42, 1)[0], w = wheel(spec, width, s); w.position.set(s * (hwHere - width / 2 - 0.015), spec.R, z); g.add(w);
  }

  // Habitacle : tout reste sous le toit et derrière les vitres.
  const leather = fabric(model === '911' ? '#a8834f' : '#c7ad84', 'lin'), dash = solid('#141415', 0.62), seatZ = -0.2;
  box(g, 1.2, 0.04, 1.5, solid('#1c1a18', 0.95), 0, 0.36, -0.05);
  for (const s of [-1, 1]) {
    box(g, 0.44, 0.12, 0.48, leather, s * 0.33, 0.4, seatZ);
    const back = box(g, 0.42, 0.56, 0.11, leather, s * 0.33, 0.48, seatZ - 0.27); back.rotation.x = -0.2;
    box(g, 0.22, 0.14, 0.08, leather, s * 0.33, 1.02, seatZ - 0.42);
  }
  const dz = spec.glass.sideF - 0.08;
  box(g, 1.14, 0.2, 0.3, dash, 0, 0.6, dz);
  box(g, 0.14, 0.2, 0.8, dash, 0, 0.4, dz - 0.5);
  const wheelS = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.017, 10, 36), solid('#111112', 0.5)); wheelS.position.set(-0.33, 0.78, dz - 0.26); wheelS.rotation.x = -0.28; g.add(wheelS);

  // Rétroviseurs.
  for (const s of [-1, 1]) {
    const z = spec.glass.sideF - 0.04, base = f(z, 0.52, s), m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), paint); m.scale.set(1, 0.62, 0.62); m.position.set(base[0] + s * 0.14, base[1] + 0.13, z); m.castShadow = true; g.add(m);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.05), black); st.position.set(base[0] + s * 0.05, base[1] + 0.09, z); g.add(st);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.08, 18), solid('#d9dde0', 0.04, 1)); face.scale.set(1, 0.58, 1); face.position.set(base[0] + s * 0.14, base[1] + 0.13, z - 0.062); face.rotation.y = Math.PI; g.add(face);
  }

  // Feux, prises d'air, échappements.
  const lens = new THREE.MeshPhysicalMaterial({ color: '#dfe6ec', roughness: 0.05, metalness: 0.6, clearcoat: 1 }), drl = solid('#e9edf0', 0.2, 0.7), red = new THREE.MeshPhysicalMaterial({ color: '#8a0c10', roughness: 0.12, clearcoat: 1 });
  const zEye = H - 0.34, eyeX = (s) => s * f(zEye, 0.6, 1)[0] * 0.78, eyeY = f(zEye, 0.66, 1)[1];
  for (const s of [-1, 1]) {
    if (model === '911') {
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.115, 28, 20), lens); bowl.scale.set(1, 1, 0.52); bowl.position.set(eyeX(s), eyeY + 0.02, zEye + 0.1); bowl.rotation.x = -0.42; g.add(bowl);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.009, 10, 40), drl); ring.position.set(eyeX(s), eyeY + 0.02, zEye + 0.155); ring.rotation.x = -0.42; g.add(ring);
    } else {
      const bar = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12), lens); bar.scale.set(1, 0.17, 0.42); bar.position.set(eyeX(s), eyeY - 0.03, zEye + 0.09); bar.rotation.y = s * 0.38; bar.rotation.x = -0.25; g.add(bar);
      const strip = box(g, 0.28, 0.01, 0.012, drl, eyeX(s), eyeY - 0.045, zEye + 0.165); strip.rotation.y = s * 0.38;
    }
  }
  const mouth = solid('#0c0c0d', 0.55), oval = (rx, ry, rz, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14), mat); m.scale.set(rx, ry, rz); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  oval(model === '911' ? 0.4 : 0.5, 0.085, 0.05, 0, 0.33, H - 0.035, mouth);
  oval(0.55, 0.11, 0.05, 0, 0.3, -H + 0.04, mouth);
  if (model === '911') {
    box(g, f(-H + 0.1, 0.4, 1)[0] * 1.72, 0.04, 0.03, red, 0, 0.8, -H + 0.05);
  } else {
    for (const s of [-1, 1]) for (const k of [0.45, 0.74]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 28), red); t.rotation.x = Math.PI / 2; t.position.set(s * k * 0.86, 0.72, -H + 0.04); g.add(t);
    }
  }
  const pipe = chrome();
  for (const s of [-1, 1]) for (const k of model === '911' ? [0.24] : [0.2, 0.34]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 22), pipe); e.rotation.x = Math.PI / 2; e.position.set(s * k, 0.3, -H + 0.07); g.add(e); }

  // Adapte à la taille demandée dans l'application.
  if (p.w && p.d) g.scale.set(p.w / (f(-1.3, 0.45, 1)[0] * 2.02), (p.h || 1.3) / 1.3, p.d / spec.L);
  return g;
}
