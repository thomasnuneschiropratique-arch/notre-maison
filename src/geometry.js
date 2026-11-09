// Géométrie du plan : unités en centimètres, repère x → droite, y → bas.

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };
export const perp = (a) => ({ x: -a.y, y: a.x });

export function projectOnSegment(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab) || 1;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  const point = add(a, mul(ab, t));
  return { t, point, d: dist(p, point) };
}

export function lineIntersect(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-6) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}

export function segmentsCross(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9) return false;
  const t = cross(sub(c, a), s) / den;
  const u = cross(sub(c, a), r) / den;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

export function polygonArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(poly) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f; cy += (p.y + q.y) * f; a += f;
  }
  if (Math.abs(a) < 1e-6) return poly[0];
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Un point garanti à l'intérieur (le centroïde peut tomber dehors pour une pièce en L). */
export function interiorPoint(poly) {
  const c = polygonCentroid(poly);
  if (pointInPolygon(c, poly)) return c;
  const ys = poly.map((p) => p.y);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2 + 0.37;
  const xs = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
  }
  xs.sort((m, n) => m - n);
  return xs.length >= 2 ? { x: (xs[0] + xs[1]) / 2, y } : c;
}

/** Retire les allers-retours d'un contour (mur en cul-de-sac dans une pièce). */
function cleanLoop(ids) {
  const out = [...ids];
  let changed = true;
  while (changed && out.length > 2) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const prev = out[(i - 1 + out.length) % out.length];
      const next = out[(i + 1) % out.length];
      if (prev === next) {
        out.splice(i, 1);
        out.splice(out.indexOf(next), 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}

/**
 * Analyse un niveau : pour chaque nœud, trie les demi-arêtes et en déduit
 * les pièces (faces du graphe) et le côté intérieur/extérieur de chaque mur.
 */
export function analyzeLevel(level) {
  const nodes = level.nodes;
  const out = new Map();
  const walls = level.walls.filter((w) => nodes[w.a] && nodes[w.b] && w.a !== w.b);
  for (const w of walls) {
    for (const [from, to, side] of [[w.a, w.b, 'L'], [w.b, w.a, 'R']]) {
      const a = nodes[from], b = nodes[to];
      if (!out.has(from)) out.set(from, []);
      out.get(from).push({ wall: w, from, to, side, angle: Math.atan2(b.y - a.y, b.x - a.x) });
    }
  }
  for (const list of out.values()) list.sort((p, q) => p.angle - q.angle);

  const key = (h) => `${h.from}>${h.to}>${h.wall.id}`;
  const visited = new Set();
  const faces = [];
  const nextEdge = (h) => {
    const list = out.get(h.to);
    const i = list.findIndex((e) => e.wall === h.wall && e.to === h.from);
    return list[(i - 1 + list.length) % list.length];
  };

  for (const list of out.values()) {
    for (const start of list) {
      if (visited.has(key(start))) continue;
      const loop = [];
      let h = start, guard = 0;
      while (!visited.has(key(h)) && guard++ < 5000) {
        visited.add(key(h));
        loop.push(h);
        h = nextEdge(h);
      }
      faces.push(loop);
    }
  }

  const rooms = [];
  const sideRoom = new Map(); // `${wall.id}:${side}` → index de pièce
  for (const loop of faces) {
    const ids = cleanLoop(loop.map((h) => h.from));
    if (ids.length < 3) continue;
    const poly = ids.map((id) => nodes[id]);
    const area = polygonArea(poly);
    if (area <= 100) continue; // face extérieure (aire négative) ou dégénérée
    const idx = rooms.length;
    let inner = area;
    const seen = new Set();
    for (const h of loop) {
      sideRoom.set(`${h.wall.id}:${h.side}`, idx);
      if (!seen.has(h.wall.id)) {
        seen.add(h.wall.id);
        inner -= (dist(nodes[h.from], nodes[h.to]) * h.wall.thickness) / 2;
      }
    }
    rooms.push({ poly, area: Math.max(inner, 0) / 10000, grossArea: area / 10000, perimeter: poly.reduce((s, p, i) => s + dist(p, poly[(i + 1) % poly.length]), 0) / 100, wallIds: [...seen], nodeIds: ids, center: interiorPoint(poly) });
  }
  return { rooms, sideRoom, walls, out };
}

/** Calcule les 4 coins (joints en onglet) de chaque mur à partir des nœuds partagés. */
export function wallCorners(level, analysis) {
  const { walls, out } = analysis;
  const nodes = level.nodes;
  const ends = new Map(); // `${node}:${wall}` → { left, right } vu depuis le nœud
  for (const [nodeId, list] of out) {
    const n = nodes[nodeId];
    const info = list.map((h) => {
      const dir = norm(sub(nodes[h.to], n));
      return { h, dir, half: h.wall.thickness / 2, nl: perp(dir) };
    });
    info.forEach((e) => {
      e.leftPt = add(n, mul(e.nl, e.half));
      e.rightPt = add(n, mul(e.nl, -e.half));
    });
    if (info.length > 1) {
      for (let i = 0; i < info.length; i++) {
        const cur = info[i], nxt = info[(i + 1) % info.length];
        const pL = add(n, mul(cur.nl, cur.half));
        const pR = add(n, mul(nxt.nl, -nxt.half));
        const c = lineIntersect(pL, cur.dir, pR, nxt.dir);
        const max = Math.max(cur.half, nxt.half) * 4;
        if (c && dist(c, n) < max && dot(sub(c, n), cur.dir) > -max) {
          cur.leftPt = c;
          nxt.rightPt = c;
        }
      }
    }
    for (const e of info) ends.set(`${nodeId}:${e.h.wall.id}:${e.h.to}`, { left: e.leftPt, right: e.rightPt });
  }
  const res = new Map();
  for (const w of walls) {
    const A = ends.get(`${w.a}:${w.id}:${w.b}`);
    const B = ends.get(`${w.b}:${w.id}:${w.a}`);
    if (A && B) res.set(w.id, { aL: A.left, bL: B.right, aR: A.right, bR: B.left });
  }
  return res;
}

export function wallFrame(level, wall) {
  const a = level.nodes[wall.a], b = level.nodes[wall.b];
  const dir = norm(sub(b, a));
  return { a, b, dir, n: perp(dir), length: dist(a, b) };
}

export function itemCorners(item, def) {
  const r = ((item.rot || 0) * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const w = (item.w ?? def.w) / 2, d = (item.d ?? def.d) / 2;
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([x, y]) => ({ x: item.x + x * c - y * s, y: item.y + x * s + y * c }));
}

/** Position du soleil (azimut depuis le nord vers l'est, altitude) — formules astronomiques usuelles. */
export function sunPosition(lat, lon, dayOfYear, hourUTC) {
  const rad = Math.PI / 180;
  const g = (2 * Math.PI * (dayOfYear - 1 + (hourUTC - 12) / 24)) / 365;
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hourUTC * 60 + eqTime + 4 * lon;
  const ha = (tst / 4 - 180) * rad;
  const phi = lat * rad;
  const sinAlt = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const altitude = Math.asin(sinAlt);
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI;
  return { altitude, azimuth: az };
}
