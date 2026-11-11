// Transforme le plan (centimètres) en scène 3D (mètres) : murs percés, sols, plafonds, menuiseries, toiture.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wallCorners, dot, sub, analyzeLevel, pointInPolygon } from './geometry.js';
import { getMaterial, solid, glass, wood, blackMetal, chrome, texturedMaterial } from './materials.js';

const M = 0.01;

class QuadBatch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  /** Quadrilatère 3D avec normale explicite et UV en mètres. */
  quad(a, b, c, d, n, uvs) {
    const i = this.pos.length / 3;
    for (const p of [a, b, c, d]) this.pos.push(p[0], p[1], p[2]);
    for (let k = 0; k < 4; k++) this.nor.push(n[0], n[1], n[2]);
    for (const u of uvs) this.uv.push(u[0], u[1]);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
  get empty() { return this.idx.length === 0; }
}

function meshOf(batch, mat, ud) {
  const m = new THREE.Mesh(batch.geometry(), mat);
  m.castShadow = m.receiveShadow = true;
  Object.assign(m.userData, ud);
  return m;
}

function box(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

const plaster = () => solid('#ecebe6', 0.9);
const skirting = () => solid('#f1f0ec', 0.5);

/** Segments verticaux du mur entre u0 et u1, découpés autour des ouvertures. */
function columns(u0, u1, openings) {
  const res = [];
  let u = u0;
  for (const o of openings) {
    const a = Math.max(u0, o.t - o.width / 2), b = Math.min(u1, o.t + o.width / 2);
    if (b <= u0 || a >= u1) continue;
    if (a > u) res.push({ a: u, b: a, o: null });
    res.push({ a, b, o });
    u = b;
  }
  if (u < u1) res.push({ a: u, b: u1, o: null });
  return res;
}

function buildWall(group, level, wall, corners, analysis, rooms, baseY, H, project, opts) {
  const A = level.nodes[wall.a], B_ = level.nodes[wall.b];
  const L = Math.hypot(B_.x - A.x, B_.y - A.y);
  if (L < 1) return;
  const dir = { x: (B_.x - A.x) / L, y: (B_.y - A.y) / L };
  const nor = { x: -dir.y, y: dir.x };
  const half = wall.thickness / 2;
  const openings = [...wall.openings].sort((p, q) => p.t - q.t);
  const wg = new THREE.Group();
  wg.userData = { kind: 'wallGroup', wallId: wall.id, normal: new THREE.Vector3(nor.x, 0, nor.y), center: new THREE.Vector3((A.x + B_.x) * M / 2, 0, (A.y + B_.y) * M / 2) };
  group.add(wg);

  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? 1 : -1;
    const start = side === 'L' ? corners.aL : corners.aR;
    const end = side === 'L' ? corners.bL : corners.bR;
    const uS = dot(sub(start, A), dir), uE = dot(sub(end, A), dir);
    const roomIdx = analysis.sideRoom.get(`${wall.id}:${side}`);
    const exterior = roomIdx === undefined;
    const room = exterior ? null : rooms[roomIdx];
    const matId = wall[`mat${side}`] || (exterior ? project.style.facade : room?.paint || 'paint_blanc');
    const b = new QuadBatch();
    const skirt = new QuadBatch();
    const off = (u) => [(A.x + dir.x * u + nor.x * half * sign) * M, (A.y + dir.y * u + nor.y * half * sign) * M];
    const n = [nor.x * sign, 0, nor.y * sign];
    const add = (u0, u1, v0, v1) => {
      if (u1 - u0 < 0.01 || v1 - v0 < 0.01) return;
      const [x0, z0] = off(u0), [x1, z1] = off(u1);
      const y0 = baseY + v0 * M, y1 = baseY + v1 * M;
      const uvA = [u0 * M, v0 * M], uvB = [u1 * M, v0 * M], uvC = [u1 * M, v1 * M], uvD = [u0 * M, v1 * M];
      const p0 = [x0, y0, z0], p1 = [x1, y0, z1], p2 = [x1, y1, z1], p3 = [x0, y1, z0];
      if (sign > 0) b.quad(p0, p1, p2, p3, n, [uvA, uvB, uvC, uvD]);
      else b.quad(p1, p0, p3, p2, n, [uvB, uvA, uvD, uvC]);
    };
    for (const c of columns(uS, uE, openings)) {
      if (!c.o) add(c.a, c.b, 0, H);
      else {
        add(c.a, c.b, 0, Math.min(c.o.sill, H));
        add(c.a, c.b, Math.min(c.o.sill + c.o.height, H), H);
      }
    }
    if (exterior && opts.slabAbove && !opts.cutHeight) add(uS, uE, H, H + opts.slabAbove);
    // Corniche et panneaux moulurés, dans la matière du mur.
    if (!exterior && room?.moulding && room.moulding !== 'none' && H > 200) {
      const relief = new QuadBatch();
      const strip = (u0, u1, v0, v1, out) => {
        const [x0, z0] = off(u0), [x1, z1] = off(u1), ox = nor.x * sign * out * M, oz = nor.y * sign * out * M, y0 = baseY + v0 * M, y1 = baseY + v1 * M;
        const P0 = [x0 + ox, y0, z0 + oz], P1 = [x1 + ox, y0, z1 + oz], P2 = [x1 + ox, y1, z1 + oz], P3 = [x0 + ox, y1, z0 + oz];
        const a = [u0 * M, v0 * M], b2 = [u1 * M, v0 * M], c2 = [u1 * M, v1 * M], d2 = [u0 * M, v1 * M];
        if (sign > 0) relief.quad(P0, P1, P2, P3, n, [a, b2, c2, d2]); else relief.quad(P1, P0, P3, P2, n, [b2, a, d2, c2]);
      };
      strip(uS, uE, H - 16, H, 3); strip(uS, uE, H - 22, H - 16, 1.6);
      if (room.moulding === 'panels') for (const c of columns(uS + 8, uE - 8, openings)) {
        const len = c.b - c.a;
        if (c.o || len < 60) continue;
        const count = Math.max(1, Math.round(len / 130)), each = len / count, top = H - 44, low = 34, w0 = 4;
        for (let i = 0; i < count; i++) {
          const x0 = c.a + i * each + 8, x1 = c.a + (i + 1) * each - 8;
          strip(x0, x1, low, low + w0, 1.3); strip(x0, x1, top - w0, top, 1.3); strip(x0, x0 + w0, low + w0, top - w0, 1.3); strip(x1 - w0, x1, low + w0, top - w0, 1.3);
        }
      }
      if (!relief.empty) wg.add(meshOf(relief, getMaterial(matId), { kind: 'wall', wallId: wall.id, side, exterior, roomId: room?.id }));
    }
    if (!b.empty) wg.add(meshOf(b, getMaterial(matId), { kind: 'wall', wallId: wall.id, side, exterior, roomId: room?.id }));

    // Plinthes intérieures
    if (!exterior && H > 30) {
      const sh = 7, st = 1.2;
      for (const c of columns(uS + 0.3, uE - 0.3, openings)) {
        if (c.o && c.o.sill < sh) continue;
        const [x0, z0] = off(c.a), [x1, z1] = off(c.b);
        const ox = (nor.x * sign * st) * M, oz = (nor.y * sign * st) * M;
        const y0 = baseY, y1 = baseY + sh * M;
        const p0 = [x0 + ox, y0, z0 + oz], p1 = [x1 + ox, y0, z1 + oz], p2 = [x1 + ox, y1, z1 + oz], p3 = [x0 + ox, y1, z0 + oz];
        const uvz = [[0, 0], [0, 0], [0, 0], [0, 0]];
        if (sign > 0) skirt.quad(p0, p1, p2, p3, n, uvz); else skirt.quad(p1, p0, p3, p2, n, uvz);
        const q0 = [x0, y1, z0], q1 = [x1, y1, z1];
        if (sign > 0) skirt.quad(q0, p3, p2, q1, [0, 1, 0], uvz); else skirt.quad(p3, q0, q1, p2, [0, 1, 0], uvz);
      }
      if (!skirt.empty) wg.add(meshOf(skirt, skirting(), { kind: 'skirting' }));
    }
  }

  const extL = analysis.sideRoom.get(`${wall.id}:L`) === undefined, extR = analysis.sideRoom.get(`${wall.id}:R`) === undefined;
  if (extL !== extR) wg.userData.outward = new THREE.Vector3(nor.x * (extL ? 1 : -1), 0, nor.y * (extL ? 1 : -1));

  // Tableaux d'ouvertures, dessus du mur et extrémités libres
  const caps = new QuadBatch();
  const P = (u, s) => [(A.x + dir.x * u + nor.x * half * s) * M, (A.y + dir.y * u + nor.y * half * s) * M];
  for (const o of openings) {
    const u0 = o.t - o.width / 2, u1 = o.t + o.width / 2;
    const v0 = baseY + o.sill * M, v1 = baseY + Math.min(o.sill + o.height, H) * M;
    const [ax, az] = P(u0, 1), [bx, bz] = P(u0, -1), [cx, cz] = P(u1, 1), [dx, dz] = P(u1, -1);
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const d = [dir.x, 0, dir.y], md = [-dir.x, 0, -dir.y];
    caps.quad([ax, v0, az], [bx, v0, bz], [bx, v1, bz], [ax, v1, az], d, uv);
    caps.quad([dx, v0, dz], [cx, v0, cz], [cx, v1, cz], [dx, v1, dz], md, uv);
    caps.quad([ax, v1, az], [bx, v1, bz], [dx, v1, dz], [cx, v1, cz], [0, -1, 0], uv);
    if (o.sill > 0) caps.quad([ax, v0, az], [cx, v0, cz], [dx, v0, dz], [bx, v0, bz], [0, 1, 0], uv);
  }
  const top = baseY + H * M;
  const c = corners, uv0 = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const pt = (p) => [p.x * M, top, p.y * M];
  caps.quad(pt(c.aL), pt(c.bL), pt(c.bR), pt(c.aR), [0, 1, 0], uv0);
  if (!caps.empty) wg.add(meshOf(caps, plaster(), { kind: 'wallCap', wallId: wall.id }));

  // Côté extérieur du mur, pour poser volets et appuis dehors : +1 côté gauche, -1 côté droit.
  const outSide = analysis.sideRoom.get(`${wall.id}:L`) === undefined ? 1 : analysis.sideRoom.get(`${wall.id}:R`) === undefined ? -1 : 0;
  for (const o of openings) buildOpening(wg, wall, o, A, dir, nor, baseY, project, H, outSide);
}

function buildOpening(parent, wall, o, A, dir, nor, baseY, project, H, outSide = 0) {
  const g = new THREE.Group();
  const cx = (A.x + dir.x * o.t) * M, cz = (A.y + dir.y * o.t) * M;
  g.position.set(cx, baseY + o.sill * M, cz);
  g.rotation.y = -Math.atan2(dir.y, dir.x);
  g.userData = { kind: 'opening', wallId: wall.id, openingId: o.id };
  parent.add(g);
  const w = o.width * M, h = Math.min(o.height, H - o.sill) * M, t = wall.thickness * M;
  const joinery = solid(o.color || project.style.joinery, 0.42, 0.05);
  const fw = 0.055;

  if (o.type === 'passage') return;
  if (o.type === 'arch') {
    // Arc en plein cintre : les écoinçons remplissent le haut de l'ouverture.
    // `stone` : arcade en pierre, les écoinçons prennent la matière de la façade.
    const R = Math.min(w / 2, h * 0.6), plaster = o.stone ? getMaterial(o.stone).clone() : solid('#f1ece1', 0.72);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(-w / 2, R + 0.002); shape.lineTo(w / 2, R + 0.002); shape.lineTo(w / 2, 0); shape.absarc(0, 0, w / 2 - 0.001, 0, Math.PI, false);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t + 0.012, bevelEnabled: false, curveSegments: 28 });
    geo.translate(0, h - R, -(t + 0.012) / 2);
    const m = new THREE.Mesh(geo, plaster); m.castShadow = m.receiveShadow = true; m.userData = { kind: 'opening', wallId: wall.id, openingId: o.id }; g.add(m);
    return;
  }
  if (o.type === 'garage') {
    const fd = t + 0.012;
    box(g, fw, h, fd, joinery, -w / 2 + fw / 2, h / 2, 0); box(g, fw, h, fd, joinery, w / 2 - fw / 2, h / 2, 0); box(g, w, fw, fd, joinery, 0, h - fw / 2, 0);
    // Lames en bois foncé, séparées par un joint sombre : de loin, la porte garde son relief au lieu d'un aplat noir.
    const n = Math.round(h / 0.5), slat = wood('noyer', '#8a7464'), groove = solid('#141414', 0.9);
    box(g, w - fw * 2, h - fw, 0.02, groove, 0, (h - fw) / 2, t * 0.2 - 0.03);
    for (let i = 0; i < n; i++) { const p = box(g, w - fw * 2 - 0.01, (h - fw) / n - 0.025, 0.05, slat, 0, ((i + 0.5) * (h - fw)) / n, t * 0.2); p.userData = { kind: 'opening', wallId: wall.id, openingId: o.id }; }
    return;
  }
  if (o.type === 'double' || (o.type === 'entry' && o.leaves === 2)) {
    const fd = t + 0.012, isEntry = o.type === 'entry', frame = isEntry ? joinery : solid('#f1f0ec', 0.45);
    box(g, fw, h, fd, frame, -w / 2 + fw / 2, h / 2, 0); box(g, fw, h, fd, frame, w / 2 - fw / 2, h / 2, 0); box(g, w, fw, fd, frame, 0, h - fw / 2, 0);
    const lw = (w - fw * 2) / 2 - 0.004, lh = h - fw - 0.008, mat = isEntry ? joinery : solid('#f4f3ef', 0.4);
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(s * (w / 2 - fw), 0, t / 2 - 0.02);
      hinge.rotation.y = -s * ((o.open ?? 0) * Math.PI) / 180 * -1;
      g.add(hinge);
      const leaf = box(hinge, lw, lh, 0.04, mat, -s * lw / 2, lh / 2 + 0.006, 0);
      leaf.userData = { kind: 'opening', wallId: wall.id, openingId: o.id };
      if (o.glazed) box(hinge, lw * 0.7, lh * 0.72, 0.042, glass(), -s * lw / 2, lh * 0.52, 0);
      box(hinge, 0.018, 0.2, 0.05, isEntry ? chrome() : blackMetal(), -s * (lw - 0.06), 1.02, 0.03);
    }
    return;
  }
  if (o.type === 'door' || o.type === 'entry' || o.type === 'sliding-door' || o.type === 'pocket') {
    const isEntry = o.type === 'entry';
    const frame = isEntry ? joinery : solid('#f1f0ec', 0.45);
    const fd = t + 0.012;
    box(g, fw, h, fd, frame, -w / 2 + fw / 2, h / 2, 0);
    box(g, fw, h, fd, frame, w / 2 - fw / 2, h / 2, 0);
    box(g, w, fw, fd, frame, 0, h - fw / 2, 0);
    const leafW = w - fw * 2, leafH = h - fw - 0.008;
    const leafMat = isEntry ? joinery : o.finish === 'bois' ? wood('chene') : solid('#f4f3ef', 0.4);
    if (o.type === 'pocket') {
      const leaf = box(g, leafW, leafH, 0.035, leafMat, o.open ? leafW * 0.8 : 0, leafH / 2 + 0.006, 0);
      leaf.userData = { kind: 'opening', wallId: wall.id, openingId: o.id };
      return;
    }
    if (o.type === 'sliding-door') {
      const leaf = box(g, leafW, leafH, 0.035, leafMat, o.open ? leafW * 0.9 : 0, leafH / 2 + 0.006, t / 2 + 0.04);
      leaf.userData = { kind: 'opening', wallId: wall.id, openingId: o.id };
      box(g, leafW * 2 + 0.1, 0.03, 0.04, blackMetal(), leafW * 0.45, h + 0.02, t / 2 + 0.04);
      return;
    }
    const hinge = new THREE.Group();
    const flipX = o.hinge === 'right' ? -1 : 1, flipZ = o.flip ? -1 : 1;
    hinge.position.set(flipX * (-leafW / 2), 0, flipZ * (t / 2 - 0.02));
    hinge.rotation.y = -flipX * flipZ * ((o.open ?? 0) * Math.PI) / 180;
    g.add(hinge);
    const leaf = box(hinge, leafW, leafH, 0.04, leafMat, flipX * leafW / 2, leafH / 2 + 0.006, 0);
    leaf.userData = { kind: 'opening', wallId: wall.id, openingId: o.id };
    if (o.glazed) box(hinge, leafW * 0.6, leafH * 0.55, 0.042, glass(), flipX * leafW / 2, leafH * 0.62, 0);
    const handleX = flipX * (leafW - 0.07);
    for (const s of [-1, 1]) {
      box(hinge, 0.13, 0.018, 0.018, isEntry ? chrome() : blackMetal(), handleX - flipX * 0.05, 1.02, s * 0.05);
      box(hinge, 0.018, 0.018, 0.05, isEntry ? chrome() : blackMetal(), handleX, 1.02, s * 0.033);
    }
    return;
  }

  // Fenêtres et baies
  const depth = 0.07, zOff = o.flip ? -t * 0.2 : t * 0.2;
  box(g, fw, h, depth, joinery, -w / 2 + fw / 2, h / 2, zOff);
  box(g, fw, h, depth, joinery, w / 2 - fw / 2, h / 2, zOff);
  box(g, w, fw, depth, joinery, 0, h - fw / 2, zOff);
  box(g, w, fw, depth, joinery, 0, fw / 2, zOff);
  const grid = o.type === 'glasswall' || o.type === 'atelier';
  const leaves = o.type === 'window1' ? 1 : o.type === 'fixed' ? Math.max(1, Math.round(o.width / 180)) : o.type === 'bay' ? Math.max(2, Math.round(o.width / 120)) : grid ? Math.max(1, Math.round(o.width / (o.type === 'atelier' ? 60 : 130))) : 2;
  const innerW = w - fw * 2, leafW = innerW / leaves;
  const pf = grid ? 0.03 : 0.045;
  if (o.type === 'atelier') { const bars = Math.max(1, Math.round(h / 0.55) - 1); for (let j = 1; j <= bars; j++) box(g, innerW, 0.022, 0.03, joinery, 0, (j * h) / (bars + 1), zOff); }
  for (let i = 0; i < leaves; i++) {
    // Baie ouverte : un vantail sur deux est glissé derrière son voisin.
    const x = -innerW / 2 + leafW / 2 + i * leafW - (o.opened && o.type === 'bay' && i % 2 ? leafW * 0.93 : 0);
    const slide = o.type === 'bay' ? (i % 2 ? 0.02 : -0.02) : 0;
    box(g, pf, h - 2 * fw, 0.04, joinery, x - leafW / 2 + pf / 2, h / 2, zOff + slide);
    box(g, pf, h - 2 * fw, 0.04, joinery, x + leafW / 2 - pf / 2, h / 2, zOff + slide);
    box(g, leafW, pf, 0.04, joinery, x, fw + pf / 2, zOff + slide);
    box(g, leafW, pf, 0.04, joinery, x, h - fw - pf / 2, zOff + slide);
    const pane = box(g, leafW - pf * 2, h - 2 * fw - pf * 2, 0.006, glass(), x, h / 2, zOff + slide);
    pane.castShadow = false;
    pane.userData = { kind: 'opening', wallId: wall.id, openingId: o.id };
    // Petits bois des fenêtres anglaises : un seul maillage par ouverture.
    if (o.muntins) {
      const [cols, rows] = o.muntins, inW = leafW - pf * 2, inH = h - 2 * fw - pf * 2, z = zOff + slide + 0.012, parts = [];
      for (let j = 1; j < cols; j++) parts.push(new THREE.BoxGeometry(0.022, inH, 0.026).translate(x - inW / 2 + (j * inW) / cols, h / 2, z));
      for (let j = 1; j < rows; j++) parts.push(new THREE.BoxGeometry(inW, 0.022, 0.026).translate(x, fw + pf + (j * inH) / rows, z));
      if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), joinery); m.castShadow = true; g.add(m); parts.forEach((p) => p.dispose()); }
    }
  }
  if (o.sill > 0) box(g, w + 0.06, 0.03, t * 0.55, solid('#d8d4cb', 0.7), 0, -0.015, o.flip ? -t * 0.42 : t * 0.42);
  if (o.shutter) box(g, w, 0.18, 0.16, joinery, 0, h - 0.0, o.flip ? -t * 0.62 : t * 0.62);
  // Volets battants en bois, ouverts contre la façade : planches verticales et barres horizontales.
  if (o.shutters) {
    const side = outSide || (o.flip ? -1 : 1), z = side * (t / 2 + 0.025), sw = w / 2, panel = solid(o.shutters, 0.62), bar = solid(o.shutters, 0.5);
    for (const k of [-1, 1]) {
      const x = k * (w / 2 + sw / 2 + 0.02);
      box(g, sw, h, 0.035, panel, x, h / 2, z);
      for (let i = 1; i < Math.max(3, Math.round(sw / 0.13)); i++) box(g, 0.006, h - 0.04, 0.038, solid('#000000', 0.9), x - sw / 2 + (i * sw) / Math.max(3, Math.round(sw / 0.13)), h / 2, z);
      for (const v of [0.18, 0.5, 0.82]) box(g, sw - 0.04, 0.07, 0.05, bar, x, h * v, z + side * 0.012);
    }
  }
}

function floorGeometry(poly, holes = []) {
  const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x * M, p.y * M)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x * M, p.y * M))));
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setXYZ(i, x, 0, y);
    nor.setXYZ(i, 0, 1, 0);
  }
  // ShapeGeometry tourne dans le sens XY : on retourne les faces pour qu'elles regardent vers le haut.
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return g;
}

function flipped(geo) {
  const g = geo.clone();
  const nor = g.attributes.normal;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, -1, 0);
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return g;
}

export function stairVoids(lower, stairDefs) {
  const out = [];
  for (const it of lower?.items || []) {
    const def = stairDefs(it.cat);
    if (!def || def.model?.type !== 'stairs') continue;
    const w = (it.w ?? def.w) / 2, d = (it.d ?? def.d) / 2;
    const r = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    const straight = !def.model.p?.shape || def.model.p.shape === 'straight';
    const f = (def.model.p?.flight || 0) * 50;
    // La trémie s'ouvre dès que la marche passe sous les 2,05 m de hauteur libre, quelle que soit la hauteur sous plafond.
    const H = lower.height || 260, rise = H + (lower.slab ?? 22), need = Math.max(0, (H - 205) / rise);
    const endStraight = Math.min(d, Math.max(d * 0.2, d * (1 - 2 * need)));
    const endQuarter = Math.min(d, Math.max(d * 0.2, d - (need / 0.76) * (2 * d - 2 * f)));
    const shape = def.model.p?.quarter ? [[-w - 3, -d - 3], [-w - 3, endQuarter], [-w + f * 2 + 3, endQuarter], [-w + f * 2 + 3, -d + f * 2 + 3], [w + 3, -d + f * 2 + 3], [w + 3, -d - 3]] : [[-w - 3, -d - 3], [-w - 3, straight ? endStraight : d + 3], [w + 3, straight ? endStraight : d + 3], [w + 3, -d - 3]];
    out.push(shape.map(([x, y]) => ({ x: it.x + x * c - y * s, y: it.y + x * s + y * c })));
  }
  return out;
}

/** Centre d'une trémie, en ne gardant que sa partie principale (la volée la plus large). */
function voidCenter(v) {
  let A = 0, cx = 0, cy = 0;
  v.forEach((p, i) => { const q = v[(i + 1) % v.length], f = p.x * q.y - q.x * p.y; A += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f; });
  return A ? { x: cx / (3 * A), y: cy / (3 * A) } : v[0];
}

/** Une trémie qui déborde dans l'épaisseur d'un mur est ramenée dans la pièce, sinon le découpage du sol se brouille. */
function clampVoid(v, poly) {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y), x0 = Math.min(...xs) + 1, x1 = Math.max(...xs) - 1, y0 = Math.min(...ys) + 1, y1 = Math.max(...ys) - 1;
  return v.map((p) => ({ x: Math.min(x1, Math.max(x0, p.x)), y: Math.min(y1, Math.max(y0, p.y)) }));
}

/** Construit un niveau entier. Renvoie un groupe avec walls / floors / ceilings distincts. */
export function buildLevel(project, level, index, analysis, baseY, opts) {
  const root = new THREE.Group();
  root.userData.levelId = level.id;
  const H = opts.cutHeight ? Math.min(opts.cutHeight, level.height) : level.height;
  const corners = wallCorners(level, analysis);
  const walls = new THREE.Group(); walls.name = 'walls';
  const floors = new THREE.Group(); floors.name = 'floors';
  const ceilings = new THREE.Group(); ceilings.name = 'ceilings';
  root.add(walls, floors, ceilings);

  const wallOpts = { ...opts, slabAbove: project.levels[index + 1] ? level.slab : 0 };
  // Un toit supplémentaire peut couvrir une partie plus basse : garage, appentis.
  const zones = (project.roofs || []).filter((z) => z.level === level.id && ((z.wallH > 0 && z.wallH !== level.height) || z.vault));
  const inZone = (p, z) => p.x >= z.x0 - 1 && p.x <= z.x1 + 1 && p.y >= z.y0 - 1 && p.y <= z.y1 + 1;
  // Plus bas (garage, appentis) : seuls les murs propres au volume descendent. Plus haut (séjour cathédrale) : tous ses murs montent.
  const wallHeight = (w) => {
    const sides = ['L', 'R'].map((s) => analysis.sideRoom.get(`${w.id}:${s}`));
    for (const z of zones) {
      if (!(z.wallH > 0) || !inZone(level.nodes[w.a], z) || !inZone(level.nodes[w.b], z)) continue;
      const inside = sides.map((i) => i !== undefined && inZone(analysis.rooms[i].center, z));
      if (z.wallH < level.height && sides.every((i, k) => i === undefined || inside[k])) return Math.min(H, z.wallH);
      if (z.wallH > level.height && inside.some(Boolean)) return opts.cutHeight ? H : z.wallH;
    }
    return H;
  };
  // Un mur sous son propre toit (garage, véranda, séjour cathédrale) n'a pas d'étage au-dessus : pas de bandeau de dalle, sinon il dépasse du toit.
  const ownRoof = (project.roofs || []).filter((z) => z.level === level.id);
  const underOwnRoof = (w) => ownRoof.some((z) => inZone(level.nodes[w.a], z) && inZone(level.nodes[w.b], z));
  for (const w of analysis.walls) {
    const c = corners.get(w.id);
    if (c) buildWall(walls, level, w, c, analysis, level.rooms, baseY, wallHeight(w), project, underOwnRoof(w) ? { ...wallOpts, slabAbove: 0 } : wallOpts);
  }
  if (opts.groundAt && index <= (project.entry || 0)) buildFoundation(walls, level, index, project, analysis, corners, baseY, opts);

  const lowerLevel = project.levels[index - 1];
  const voids = opts.stairVoids(lowerLevel);
  const ceilingVoids = opts.stairVoids(level);
  analysis.rooms.forEach((r, i) => {
    const info = level.rooms[i];
    if (!info) return;
    // Une trémie appartient à la pièce qui contient son centre : un escalier collé aux murs a ses coins dans l'épaisseur du mur.
    const insideVoids = voids.filter((v) => opts.inside(voidCenter(v), r.poly)).map((v) => clampVoid(v, r.poly));
    const fg = floorGeometry(r.poly, insideVoids);
    const f = new THREE.Mesh(fg, getMaterial(info.floor));
    f.position.y = baseY + 0.001;
    f.receiveShadow = true;
    f.userData = { kind: 'floor', roomId: info.id };
    floors.add(f);

    const insideCeil = ceilingVoids.filter((v) => opts.inside(voidCenter(v), r.poly)).map((v) => clampVoid(v, r.poly));
    const zone = zones.find((z) => inZone(r.center, z));
    if (zone?.vault) return;
    // Oculus : le plafond s'ouvre en cercle sous le puits de lumière du toit.
    const ceilHoles = info.oculus ? [...insideCeil, Array.from({ length: 32 }, (_, k) => ({ x: info.oculus.x + Math.cos((k / 32) * Math.PI * 2) * info.oculus.r, y: info.oculus.y + Math.sin((k / 32) * Math.PI * 2) * info.oculus.r }))] : insideCeil;
    const cg = flipped(floorGeometry(r.poly, ceilHoles));
    const c = new THREE.Mesh(cg, getMaterial(info.ceiling || 'paint_blanc'));
    c.position.y = baseY + ((zone?.wallH > 0 ? zone.wallH : 0) || level.height) * M;
    c.castShadow = true; c.receiveShadow = true;
    c.userData = { kind: 'ceiling', roomId: info.id };
    ceilings.add(c);

    if (index === 0) {
      const under = new THREE.Mesh(floorGeometry(r.poly), solid('#8f8c85', 0.95));
      under.position.y = baseY - 0.02; floors.add(under);
    }
  });
  // Plancher au-dessus d'un volume en double hauteur (passerelle, mezzanine) : on voit son dessous et ses rives depuis le bas.
  if (lowerLevel) {
    const slabT = (lowerLevel.slab ?? 22) * M, open = (project.roofs || []).filter((z) => z.level === lowerLevel.id && z.vault && z.wallH > lowerLevel.height);
    const vault = (p) => open.some((z) => p.x > z.x0 && p.x < z.x1 && p.y > z.y0 && p.y < z.y1);
    // Couvert par une pièce du dessous qui a un plafond ? Sinon (double hauteur, porte-à-faux, abri voiture), le dessous se voit.
    const lowerRooms = analyzeLevel(lowerLevel).rooms, covered = (q) => !vault(q) && lowerRooms.some((lr) => pointInPolygon(q, lr.poly));
    analysis.rooms.forEach((r, i) => {
      if (!level.rooms[i]) return;
      const c = r.center, probes = [c, ...r.poly.map((v) => { const dx = c.x - v.x, dy = c.y - v.y, L = Math.hypot(dx, dy) || 1; return { x: v.x + (dx / L) * 20, y: v.y + (dy / L) * 20 }; })];
      if (probes.every(covered)) return;
      const holes = voids.filter((v) => opts.inside(voidCenter(v), r.poly)).map((v) => clampVoid(v, r.poly));
      const bottom = new THREE.Mesh(flipped(floorGeometry(r.poly, holes)), solid('#e9e4da', 0.85));
      bottom.position.y = baseY - slabT + 0.015; bottom.receiveShadow = true; bottom.userData = { kind: 'slabUnder' }; floors.add(bottom);
      const band = new QuadBatch();
      r.poly.forEach((a, k) => { const b = r.poly[(k + 1) % r.poly.length], len = Math.hypot(b.x - a.x, b.y - a.y) * M; if (len < 0.01) return; band.quad([a.x * M, baseY - slabT, a.y * M], [b.x * M, baseY - slabT, b.y * M], [b.x * M, baseY, b.y * M], [a.x * M, baseY, a.y * M], [-(b.y - a.y) * M / len, 0, (b.x - a.x) * M / len], [[0, 0], [len, 0], [len, slabT], [0, slabT]]); });
      const bm = meshOf(band, solid('#e9e4da', 0.85).clone(), { kind: 'slabEdge' }); bm.material.side = THREE.DoubleSide; floors.add(bm);
    });
  }
  // Trémie : l'épaisseur du plancher habille le tour de l'escalier, sinon on voit le vide entre plafond et sol de l'étage.
  if (lowerLevel && voids.length) {
    const slab = (lowerLevel.slab ?? 22) * M, y0 = baseY - slab - 0.012, y1 = baseY + 0.004, sides = new QuadBatch();
    for (const v of voids) v.forEach((a, k) => {
      const b = v[(k + 1) % v.length], len = Math.hypot(b.x - a.x, b.y - a.y) * M; if (len < 0.01) return;
      const n = [-(b.y - a.y) * M / len, 0, (b.x - a.x) * M / len];
      sides.quad([a.x * M, y0, a.y * M], [b.x * M, y0, b.y * M], [b.x * M, y1, b.y * M], [a.x * M, y1, a.y * M], n, [[0, 0], [len, 0], [len, slab], [0, slab]]);
    });
    if (!sides.empty) { const m = meshOf(sides, plaster(), { kind: 'stairwell' }); m.material = m.material.clone(); m.material.side = THREE.DoubleSide; floors.add(m); }
  }
  return root;
}

/** Soubassement : sur un terrain en pente, le mur descend jusqu'au sol. */
function buildFoundation(parent, level, index, project, analysis, corners, baseY, opts) {
  const lower = project.levels[index - 1];
  const b = new QuadBatch();
  for (const w of analysis.walls) {
    const extL = analysis.sideRoom.get(`${w.id}:L`) === undefined, extR = analysis.sideRoom.get(`${w.id}:R`) === undefined;
    if (extL === extR) continue;
    const A = level.nodes[w.a], B_ = level.nodes[w.b], L = Math.hypot(B_.x - A.x, B_.y - A.y);
    if (L < 1) continue;
    const mid = { x: (A.x + B_.x) / 2, y: (A.y + B_.y) / 2 };
    if (lower && opts.coveredBy(lower, mid)) continue;
    // Volume posé sur pilotis au-dessus du vide : pas de mur qui descend jusqu'au sol.
    if (w.piles) continue;
    const dir = { x: (B_.x - A.x) / L, y: (B_.y - A.y) / L }, nor = { x: -dir.y, y: dir.x }, sign = extL ? 1 : -1;
    const c = corners.get(w.id); if (!c) continue;
    const s0 = extL ? c.aL : c.aR, s1 = extL ? c.bL : c.bR;
    let lowest = Infinity;
    const n = Math.max(2, Math.ceil(L / 50));
    for (let i = 0; i <= n; i++) lowest = Math.min(lowest, opts.groundAt(s0.x + ((s1.x - s0.x) * i) / n, s0.y + ((s1.y - s0.y) * i) / n));
    if (lowest >= baseY - 0.005) continue;
    const y0 = lowest - 0.4, y1 = baseY, X = (p) => p.x * M, Z = (p) => p.y * M, len = L * M, hh = y1 - y0;
    const p0 = [X(s0), y0, Z(s0)], p1 = [X(s1), y0, Z(s1)], p2 = [X(s1), y1, Z(s1)], p3 = [X(s0), y1, Z(s0)], ng = [nor.x * sign, 0, nor.y * sign];
    if (sign > 0) b.quad(p0, p1, p2, p3, ng, [[0, 0], [len, 0], [len, hh], [0, hh]]);
    else b.quad(p1, p0, p3, p2, ng, [[len, 0], [0, 0], [0, hh], [len, hh]]);
  }
  if (!b.empty) parent.add(meshOf(b, getMaterial(project.style.facade), { kind: 'foundation' }));
}

function footprintBounds(level) {
  const ids = new Set(level.walls.flatMap((w) => [w.a, w.b]));
  const xs = [], ys = [];
  for (const id of ids) { xs.push(level.nodes[id].x); ys.push(level.nodes[id].y); }
  if (!xs.length) return null;
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** Toiture calée sur l'emprise du dernier niveau (terrasse, 1 pan, 2 pans ou 4 pans). */
export function buildRoof(project, level, baseY, zone) {
  const g = new THREE.Group();
  g.name = 'roof';
  const b = zone || footprintBounds(level);
  const roof = zone || project.roof;
  if (!b || roof.type === 'none') return g;
  const maxT = Math.max(...level.walls.map((w) => w.thickness), 20) / 2;
  const facade = getMaterial(project.style.facade);
  const tile = getMaterial(project.style.roof);
  const eaveMat = solid('#e9e6df', 0.6);
  const top = baseY;

  // Disque : grande dalle ronde en porte-à-faux, percée d'un oculus vitré au centre.
  if (roof.type === 'disc') {
    const cx = ((b.x0 + b.x1) / 2) * M, cz = ((b.y0 + b.y1) / 2) * M, R = ((b.x1 - b.x0) / 2 + maxT + (roof.overhang ?? 100)) * M, th = (roof.thick ?? 36) * M, oc = (roof.oculus || 0) * M;
    const shape = new THREE.Shape(); shape.absarc(0, 0, R, 0, Math.PI * 2, false);
    if (oc > 0) { const h = new THREE.Path(); h.absarc(0, 0, oc, 0, Math.PI * 2, true); shape.holes.push(h); }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false, curveSegments: 72 }); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, solid('#f2f0eb', 0.5)); m.position.set(cx, top + 0.012, cz); m.castShadow = m.receiveShadow = true; g.add(m);
    if (oc > 0) { const gl = new THREE.Mesh(new THREE.CircleGeometry(oc, 48).rotateX(-Math.PI / 2), glass()); gl.position.set(cx, top + th + 0.02, cz); g.add(gl); box(g, 0.01, 0.01, 0.01, eaveMat, cx, top, cz); }
    g.traverse((o) => { o.userData.kind = 'roof'; });
    return g;
  }
  // Dalle contemporaine : plaque blanche fine qui déborde largement, éventuellement végétalisée.
  if (roof.type === 'slab') {
    const ov = roof.overhang ?? 120, o = { n: roof.ovN ?? ov, s: roof.ovS ?? ov, e: roof.ovE ?? ov, w: roof.ovW ?? ov };
    const x0 = (b.x0 - maxT - o.w) * M, x1 = (b.x1 + maxT + o.e) * M, z0 = (b.y0 - maxT - o.n) * M, z1 = (b.y1 + maxT + o.s) * M, th = (roof.thick ?? 32) * M;
    const white = solid('#f3f1ec', 0.55);
    box(g, x1 - x0, th, z1 - z0, white, (x0 + x1) / 2, top + th / 2 + 0.012, (z0 + z1) / 2);
    if (roof.green) {
      const inset = 0.5, grass = texturedMaterial('sparse_grass', 1.6, { tint: '#a9c07f', gain: 1.7 });
      const gm = box(g, x1 - x0 - inset * 2, 0.06, z1 - z0 - inset * 2, grass, (x0 + x1) / 2, top + th + 0.042, (z0 + z1) / 2), uv = gm.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (z1 - z0));
    }
    g.traverse((m) => { m.userData.kind = 'roof'; });
    return g;
  }

  if (roof.type === 'flat') {
    const x0 = (b.x0 - maxT) * M, x1 = (b.x1 + maxT) * M, z0 = (b.y0 - maxT) * M, z1 = (b.y1 + maxT) * M;
    const w = x1 - x0, d = z1 - z0;
    box(g, w, 0.22, d, solid('#a9a69e', 0.9), (x0 + x1) / 2, top + 0.11, (z0 + z1) / 2);
    const h = 0.5, t = 0.2;
    box(g, w, h, t, facade, (x0 + x1) / 2, top + h / 2 + 0.1, z0 + t / 2);
    box(g, w, h, t, facade, (x0 + x1) / 2, top + h / 2 + 0.1, z1 - t / 2);
    box(g, t, h, d, facade, x0 + t / 2, top + h / 2 + 0.1, (z0 + z1) / 2);
    box(g, t, h, d, facade, x1 - t / 2, top + h / 2 + 0.1, (z0 + z1) / 2);
    g.traverse((m) => { m.userData.kind = 'roof'; });
    return g;
  }

  const ov = roof.overhang;
  const alongX = roof.ridge === 'x' || (roof.ridge === 'auto' && b.x1 - b.x0 >= b.y1 - b.y0);
  // Repère local : s le long du faîtage, t en travers.
  const cutS0 = zone?.endCut || zone?.endA, cutS1 = zone?.endCut || zone?.endB, s0 = (alongX ? b.x0 : b.y0) - (cutS0 ? 0 : maxT), s1 = (alongX ? b.x1 : b.y1) + (cutS1 ? 0 : maxT);
  // Un pignon qui croise le toit principal ne doit jamais descendre dans les pièces : pas de débord sur ses côtés.
  // `flushA` : seul le côté bas ou gauche s'arrête contre un mur voisin.
  // Sans débord, le toit va quand même jusqu'à la face extérieure du mur : sinon le haut du mur dépasse au-dessus de la gouttière.
  const ovT = zone?.flush ? 0 : ov, tM = maxT, ovA = zone?.flushA ? 0 : ovT, ovB = zone?.flushB ? 0 : ovT;
  const t0 = (alongX ? b.y0 : b.x0) - tM, t1 = (alongX ? b.y1 : b.x1) + tM;
  const slope = Math.tan((roof.pitch * Math.PI) / 180);
  const P = (s, t, y) => (alongX ? [s * M, y, t * M] : [t * M, y, s * M]);
  const half = (t1 - t0) / 2, tm = (t0 + t1) / 2;
  // Un toit sans débord est juste au-dessus du plafond, sans se confondre avec lui.
  const lift = zone?.flush || zone?.flushA || zone?.flushB ? 0.05 : 0, ridgeY = top + (half + ovT) * slope * M + lift;
  const eaveY = top - ovT * slope * M + lift, eaveA = top - ovA * slope * M + lift, eaveB = top - ovB * slope * M + lift;
  const sA = s0 - (cutS0 ? 0 : ov), sB = s1 + (cutS1 ? 0 : ov), tA = t0 - ovA, tB = t1 + ovB;
  const hipIn = roof.type === 'hip' ? half + ovT : 0;
  const rA = sA + hipIn, rB = sB - hipIn;
  const roofB = new QuadBatch(), gable = new QuadBatch();

  const addPlane = (p0, p1, p2, p3) => {
    const a = new THREE.Vector3(...p1).sub(new THREE.Vector3(...p0));
    const b2 = new THREE.Vector3(...p3).sub(new THREE.Vector3(...p0));
    let n = a.clone().cross(b2);
    if (n.lengthSq() < 1e-9) n = new THREE.Vector3(...p2).sub(new THREE.Vector3(...p0)).cross(b2);
    n.normalize();
    if (n.y < 0) { [p1, p3] = [p3, p1]; n.negate(); }
    const lenU = new THREE.Vector3(...p1).distanceTo(new THREE.Vector3(...p0));
    const lenV = new THREE.Vector3(...p3).distanceTo(new THREE.Vector3(...p0));
    roofB.quad(p0, p1, p2, p3, [n.x, n.y, n.z], [[0, 0], [lenU, 0], [lenU, lenV], [0, lenV]]);
  };

  if (roof.type === 'butterfly') {
    // Toit papillon : deux pans qui remontent vers les façades, noue au milieu, bandeau vitré entre le haut des murs et le toit.
    const valley = top + 0.08, hAt = (t) => valley + Math.abs(t - tm) * slope * M, tA0 = t0 - ovT, tB0 = t1 + ovT;
    addPlane(P(sA, tA0, hAt(tA0)), P(sB, tA0, hAt(tA0)), P(sB, tm, valley), P(sA, tm, valley));
    addPlane(P(sA, tm, valley), P(sB, tm, valley), P(sB, tB0, hAt(tB0)), P(sA, tB0, hAt(tB0)));
    for (const s of [s0, s1]) {
      const n = alongX ? [s === s0 ? -1 : 1, 0, 0] : [0, 0, s === s0 ? -1 : 1];
      gable.quad(P(s, t0, top), P(s, tm, top), P(s, tm, valley), P(s, t0, hAt(t0)), n, [[0, 0], [half * M, 0], [half * M, 0.08], [0, hAt(t0) - top]]);
      gable.quad(P(s, tm, top), P(s, t1, top), P(s, t1, hAt(t1)), P(s, tm, valley), n, [[0, 0], [half * M, 0], [half * M, hAt(t1) - top], [0, 0.08]]);
    }
    const clear = new QuadBatch(), frame = blackMetal();
    for (const t of [t0, t1]) {
      const y1 = hAt(t) - 0.02, n = alongX ? [0, 0, t === t0 ? -1 : 1] : [t === t0 ? -1 : 1, 0, 0];
      clear.quad(P(s0, t, top), P(s1, t, top), P(s1, t, y1), P(s0, t, y1), n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      const k = Math.max(2, Math.round((s1 - s0) / 120));
      for (let i = 0; i <= k; i++) { const s = s0 + ((s1 - s0) * i) / k, q = P(s, t, (top + y1) / 2); box(g, alongX ? 0.05 : 0.06, y1 - top, alongX ? 0.06 : 0.05, frame, q[0], q[1], q[2]); }
    }
    const cm = new THREE.Mesh(clear.geometry(), glass()); cm.userData.kind = 'roofGlass'; g.add(cm);
  } else if (roof.type === 'mono') {
    const highY = top + (t1 - t0 + ov) * slope * M;
    addPlane(P(sA, tA, highY), P(sB, tA, highY), P(sB, tB, eaveY), P(sA, tB, eaveY));
    for (const s of [s0, s1]) {
      gable.quad(P(s, t0, top), P(s, t1, top), P(s, t1, top), P(s, t0, top + (t1 - t0) * slope * M), alongX ? [s === s0 ? -1 : 1, 0, 0] : [0, 0, s === s0 ? -1 : 1], [[0, 0], [(t1 - t0) * M, 0], [(t1 - t0) * M, 0], [0, (t1 - t0) * slope * M]]);
    }
    box(g, 0.01, 0.01, 0.01, eaveMat, 0, top, 0);
  } else {
    addPlane(P(sA, tA, eaveA), P(sB, tA, eaveA), P(rB, tm, ridgeY), P(rA, tm, ridgeY));
    addPlane(P(sB, tB, eaveB), P(sA, tB, eaveB), P(rA, tm, ridgeY), P(rB, tm, ridgeY));
    if (roof.type === 'hip') {
      addPlane(P(sA, tA, eaveY), P(sA, tA, eaveY), P(rA, tm, ridgeY), P(sA, tB, eaveY));
      addPlane(P(sB, tB, eaveY), P(sB, tB, eaveY), P(rB, tm, ridgeY), P(sB, tA, eaveY));
    } else {
      const peak = top + half * slope * M;
      for (const s of [s0, s1]) {
        const n = alongX ? [s === s0 ? -1 : 1, 0, 0] : [0, 0, s === s0 ? -1 : 1];
        const a = P(s, t0, top), b2 = P(s, t1, top), c = P(s, tm, peak);
        const uv = [[0, 0], [(t1 - t0) * M, 0], [(t1 - t0) * M / 2, peak - top], [(t1 - t0) * M / 2, peak - top]];
        const ab = new THREE.Vector3(...b2).sub(new THREE.Vector3(...a)), ac = new THREE.Vector3(...c).sub(new THREE.Vector3(...a));
        const flip = ab.cross(ac).dot(new THREE.Vector3(...n)) < 0;
        if (flip) gable.quad(b2, a, c, c, n, [uv[1], uv[0], uv[2], uv[3]]); else gable.quad(a, b2, c, c, n, uv);
      }
    }
  }
  const rm = new THREE.Mesh(roofB.geometry(), tile.clone());
  rm.material.side = THREE.DoubleSide;
  rm.castShadow = rm.receiveShadow = true;
  g.add(rm);
  // Plafond cathédrale : l'intérieur du toit est habillé de bois.
  if (zone?.vault) {
    const lining = new THREE.Mesh(rm.geometry, getMaterial(zone.lining || 'wall_noyer').clone());
    lining.material.side = THREE.BackSide;
    lining.position.y = -0.04;
    lining.receiveShadow = true;
    g.add(lining);
  }
  if (!gable.empty) {
    const gm = new THREE.Mesh(gable.geometry(), facade.clone());
    // Dehors, la façade ; dedans (séjour cathédrale), un enduit clair au lieu de la pierre extérieure.
    gm.material.side = zone?.vault && roof.type !== 'butterfly' ? THREE.FrontSide : THREE.DoubleSide;
    gm.castShadow = gm.receiveShadow = true;
    g.add(gm);
    if (zone?.vault && roof.type !== 'butterfly') { const inner = new THREE.Mesh(gm.geometry, solid('#ece6da', 0.85).clone()); inner.material.side = THREE.BackSide; inner.receiveShadow = true; g.add(inner); }
  }
  g.traverse((m) => { m.userData.kind = 'roof'; });
  return g;
}
