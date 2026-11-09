// Sélection de plusieurs éléments à la fois : la maison entière, un niveau, des pièces ou une zone.
import { store, uid } from './state.js';
import { dist, interiorPoint, itemCorners, pointInPolygon } from './geometry.js';
import { getItem } from './catalog.js';
import { terrainOf, groundTop, T_N } from './terrain.js';

export const isGroup = (s) => s?.type === 'group';
export const newGroup = () => ({ type: 'group', parts: {}, detach: false });
const part = (sel, level) => (sel.parts[level.id] ||= { nodes: new Set(), items: new Set() });
export const isEmptyGroup = (sel) => Object.values(sel.parts).every((t) => !t.nodes.size && !t.items.size);

export function addRect(sel, level, r) {
  const t = part(sel, level), inside = (p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
  for (const [id, n] of Object.entries(level.nodes)) if (inside(n)) t.nodes.add(id);
  for (const it of level.items) if (inside(it)) t.items.add(it.id);
}

/** Les arbres et ce qui est loin des murs appartiennent au jardin, pas à la maison. */
function gardenItems(level) {
  const pts = Object.values(level.nodes); if (!pts.length) return new Set();
  const M = 300, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) - M, x1 = Math.max(...xs) + M, y0 = Math.min(...ys) - M, y1 = Math.max(...ys) + M;
  return new Set(level.items.filter((it) => getItem(it.cat)?.sub === 'plantation' || it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1).map((it) => it.id));
}

export function addLevel(sel, level) {
  const t = part(sel, level), garden = gardenItems(level);
  Object.keys(level.nodes).forEach((id) => t.nodes.add(id));
  level.items.forEach((it) => { if (!garden.has(it.id)) t.items.add(it.id); });
}

export function addHouse(sel, project) { project.levels.forEach((l) => addLevel(sel, l)); }

/** Ajoute le jardin des niveaux dont tous les murs sont déjà sélectionnés. */
export function addGarden(sel, project) {
  for (const level of project.levels) {
    const t = sel.parts[level.id];
    if (t && isWhole(level, t)) level.items.forEach((it) => t.items.add(it.id));
  }
}

/** Ajoute aux autres niveaux ce qui se trouve à l'aplomb de la sélection. */
export function addSameSpot(sel, project) {
  const b = bounds(project, sel); if (!b) return;
  const r = { x0: b.x0 - 1, y0: b.y0 - 1, x1: b.x1 + 1, y1: b.y1 + 1 };
  project.levels.forEach((l) => addRect(sel, l, r));
}

export function toggleItem(sel, level, id) {
  const t = part(sel, level);
  if (t.items.has(id)) t.items.delete(id); else t.items.add(id);
}

export function toggleNodes(sel, level, ids) {
  const t = part(sel, level), all = ids.every((id) => t.nodes.has(id));
  ids.forEach((id) => (all ? t.nodes.delete(id) : t.nodes.add(id)));
}

/** Une pièce touchée : ses murs et tout ce qu'elle contient. */
export function toggleRoom(sel, level, index) {
  const a = store.analysis(level), room = a.rooms[index]; if (!room) return;
  const t = part(sel, level), nodes = new Set(room.nodeIds);
  for (const [id, n] of Object.entries(level.nodes)) if (pointInPolygon(n, room.poly)) nodes.add(id);
  const items = level.items.filter((it) => pointInPolygon(it, room.poly)).map((it) => it.id);
  if (![...nodes].every((id) => t.nodes.has(id)) || !items.every((id) => t.items.has(id))) {
    nodes.forEach((id) => t.nodes.add(id)); items.forEach((id) => t.items.add(id));
    return;
  }
  // On retire la pièce sans abîmer une pièce voisine restée sélectionnée.
  const keep = new Set();
  a.rooms.forEach((r, j) => { if (j !== index && r.nodeIds.every((id) => t.nodes.has(id))) r.nodeIds.forEach((id) => keep.add(id)); });
  nodes.forEach((id) => { if (!keep.has(id)) t.nodes.delete(id); });
  items.forEach((id) => t.items.delete(id));
}

export function bounds(project, sel) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
  for (const level of project.levels) {
    const t = sel.parts[level.id]; if (!t) continue;
    for (const id of t.nodes) if (level.nodes[id]) grow(level.nodes[id]);
    for (const it of level.items) {
      if (!t.items.has(it.id)) continue;
      const def = getItem(it.cat);
      if (def) itemCorners(it, def).forEach(grow); else grow(it);
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

function isWhole(level, t) {
  return !!t && Object.keys(level.nodes).every((id) => t.nodes.has(id));
}
const isHouse = (project, sel) => project.levels.every((l) => isWhole(l, sel.parts[l.id]) || (!Object.keys(l.nodes).length && !l.items.length));

export function stats(project, sel) {
  const out = { walls: 0, rooms: 0, items: 0, levels: 0, border: 0, garden: 0, house: isHouse(project, sel) };
  for (const level of project.levels) {
    const t = sel.parts[level.id]; if (!t || (!t.nodes.size && !t.items.size)) continue;
    out.levels++;
    out.items += t.items.size;
    if (isWhole(level, t) && Object.keys(level.nodes).length) out.garden += level.items.filter((it) => !t.items.has(it.id)).length;
    for (const w of level.walls) {
      const n = Number(t.nodes.has(w.a)) + Number(t.nodes.has(w.b));
      if (n === 2) out.walls++; else if (n === 1) out.border++;
    }
    out.rooms += store.analysis(level).rooms.filter((r) => r.nodeIds.every((id) => t.nodes.has(id))).length;
  }
  return out;
}

/** Les murs à cheval restent sur place : on leur donne leur propre extrémité. */
function detach(level, t) {
  const clones = {};
  for (const w of level.walls) {
    if (t.nodes.has(w.a) && t.nodes.has(w.b)) continue;
    for (const end of ['a', 'b']) {
      const id = w[end];
      if (!t.nodes.has(id)) continue;
      if (!clones[id]) { clones[id] = uid('n'); level.nodes[clones[id]] = { ...level.nodes[id] }; }
      w[end] = clones[id];
    }
  }
}

/** Mémorise le point de départ d'un déplacement. À appeler après store.snapshot(). */
export function capture(project, sel) {
  const levels = [], house = isHouse(project, sel), box = bounds(project, sel);
  const top0 = house ? groundTop(project) : null;
  for (const level of project.levels) {
    const t = sel.parts[level.id];
    if (!t || (!t.nodes.size && !t.items.size)) continue;
    const rooms = store.analysis(level).rooms.map((r, i) => ({ room: level.rooms[i], loop: r.nodeIds, all: r.nodeIds.every((id) => t.nodes.has(id)), x: level.rooms[i]?.x, y: level.rooms[i]?.y }))
      .filter((r) => r.room && r.loop.some((id) => t.nodes.has(id)));
    const whole = isWhole(level, t);
    if (sel.detach) detach(level, t);
    levels.push({
      level, t, rooms, whole,
      nodes: [...t.nodes].filter((id) => level.nodes[id]).map((id) => ({ id, x: level.nodes[id].x, y: level.nodes[id].y })),
      items: level.items.filter((it) => t.items.has(it.id)).map((it) => ({ it, x: it.x, y: it.y, rot: it.rot || 0 })),
      half: level.walls.filter((w) => t.nodes.has(w.a) !== t.nodes.has(w.b) && w.openings.length).map((w) => ({ w, aMoved: t.nodes.has(w.a), L0: dist(level.nodes[w.a], level.nodes[w.b]), ts: w.openings.map((o) => o.t) })),
      bg: whole && level.background ? { x: level.background.x, y: level.background.y } : null,
    });
  }
  return { project, sel, levels, house, box, top0, alt0: project.site.altitude || 0, detach: sel.detach };
}

/** Applique une transformation à partir du point de départ mémorisé. */
export function apply(session, fn, turn = 0) {
  for (const L of session.levels) {
    const lv = L.level;
    for (const n of L.nodes) Object.assign(lv.nodes[n.id], fn(n));
    for (const i of L.items) { Object.assign(i.it, fn(i)); if (turn) i.it.rot = (((i.rot + turn) % 360) + 360) % 360; }
    if (L.bg && !turn) Object.assign(lv.background, fn(L.bg));
    // Sur un mur qui s'allonge, une fenêtre garde sa distance à l'extrémité qui ne bouge pas.
    for (const h of L.half) {
      const L1 = dist(lv.nodes[h.w.a], lv.nodes[h.w.b]);
      h.w.openings.forEach((o, j) => {
        const t = h.ts[j] + (h.aMoved ? L1 - h.L0 : 0);
        o.t = L1 >= o.width + 4 ? Math.round(Math.max(o.width / 2 + 2, Math.min(L1 - o.width / 2 - 2, t))) : L1 / 2;
      });
    }
    for (const r of L.rooms) {
      if (r.all) Object.assign(r.room, fn(r));
      else if (!session.detach) Object.assign(r.room, (({ x, y }) => ({ x, y }))(interiorPoint(r.loop.map((id) => lv.nodes[id]))));
    }
  }
}

function removeOrphans(level) {
  const used = new Set(level.walls.flatMap((w) => [w.a, w.b]));
  for (const id of Object.keys(level.nodes)) if (!used.has(id)) delete level.nodes[id];
}

/** Un angle posé sur un angle voisin fusionne avec lui, pour que les pièces se raccordent. */
function mergeTouching(L) {
  const lv = L.level, moved = new Set(L.nodes.map((n) => n.id)), fixed = Object.entries(lv.nodes).filter(([id]) => !moved.has(id));
  let merged = false;
  for (const id of moved) {
    const n = lv.nodes[id], hit = fixed.find(([, f]) => dist(f, n) <= 3);
    if (!hit) continue;
    for (const w of lv.walls) { if (w.a === id) w.a = hit[0]; if (w.b === id) w.b = hit[0]; }
    delete lv.nodes[id];
    merged = true;
  }
  if (!merged) return;
  const seen = new Map();
  lv.walls = lv.walls.filter((w) => {
    if (w.a === w.b) return false;
    const k = [w.a, w.b].sort().join('|'), first = seen.get(k);
    if (!first) { seen.set(k, w); return true; }
    const len = dist(lv.nodes[w.a], lv.nodes[w.b]);
    for (const o of w.openings) {
      const t = first.a === w.a ? o.t : len - o.t;
      if (!first.openings.some((f) => Math.abs(f.t - t) < (f.width + o.width) / 2)) first.openings.push({ ...o, t });
    }
    return false;
  });
}

/** Termine le déplacement : raccords, relief sous la maison, sélection à jour. */
export function finish(session) {
  const { project, sel } = session;
  for (const L of session.levels) {
    if (session.detach) removeOrphans(L.level);
    else if (!L.whole) mergeTouching(L);
  }
  if (session.house && session.top0 !== null) {
    const top1 = groundTop(project);
    if (top1 !== null) project.site.altitude = Math.round((session.alt0 + top1 - session.top0) * 100) / 100;
  }
  for (const level of project.levels) {
    const t = sel.parts[level.id]; if (!t) continue;
    for (const id of [...t.nodes]) if (!level.nodes[id]) t.nodes.delete(id);
  }
}

/** Empêche de sortir du terrain ; ne bride rien si la sélection en dépasse déjà. */
export function clampMove(project, box, dx, dy) {
  const m = terrainOf(project);
  if (!m || !box) return { dx, dy, limited: false };
  const H = (T_N - 1) * 50 - 300;
  const fit = (v, a, b, c) => (a < c - H || b > c + H ? v : Math.max(c - H - a, Math.min(c + H - b, v)));
  const x = fit(dx, box.x0, box.x1, m.cx), y = fit(dy, box.y0, box.y1, m.cy);
  return { dx: x, dy: y, limited: x !== dx || y !== dy };
}

export function moveBy(project, sel, dx, dy) {
  const s = capture(project, sel), m = clampMove(project, s.box, dx, dy);
  apply(s, (p) => ({ x: p.x + m.dx, y: p.y + m.dy }));
  finish(s);
  return m;
}

export function rotate(project, sel, deg) {
  const s = capture(project, sel); if (!s.box) return;
  const cx = Math.round((s.box.x0 + s.box.x1) / 10) * 5, cy = Math.round((s.box.y0 + s.box.y1) / 10) * 5;
  const r = (deg * Math.PI) / 180, c = Math.round(Math.cos(r) * 1e9) / 1e9, n = Math.round(Math.sin(r) * 1e9) / 1e9;
  const tenth = (v) => Math.round(v * 10) / 10;
  apply(s, (p) => ({ x: tenth(cx + (p.x - cx) * c - (p.y - cy) * n), y: tenth(cy + (p.x - cx) * n + (p.y - cy) * c) }), deg);
  finish(s);
}

/** Copie la sélection juste à côté et renvoie la nouvelle sélection. */
export function duplicate(project, sel) {
  const box = bounds(project, sel), out = newGroup(), m = terrainOf(project);
  if (!box) return out;
  let dx = Math.ceil((box.x1 - box.x0 + 100) / 5) * 5;
  if (m && box.x1 + dx > m.cx + (T_N - 1) * 50 - 300) dx = -dx;
  for (const level of project.levels) {
    const t = sel.parts[level.id]; if (!t) continue;
    const seeds = store.analysis(level).rooms.map((r, i) => (r.nodeIds.every((id) => t.nodes.has(id)) ? level.rooms[i] : null)).filter(Boolean);
    const copy = part(out, level), map = {};
    const nodeCopy = (id) => {
      if (!map[id]) { map[id] = uid('n'); level.nodes[map[id]] = { x: level.nodes[id].x + dx, y: level.nodes[id].y }; copy.nodes.add(map[id]); }
      return map[id];
    };
    for (const w of [...level.walls]) {
      if (t.nodes.has(w.a) && t.nodes.has(w.b)) level.walls.push({ ...w, id: uid('w'), a: nodeCopy(w.a), b: nodeCopy(w.b), openings: w.openings.map((o) => ({ ...o, id: uid('o') })) });
    }
    for (const it of [...level.items]) {
      if (!t.items.has(it.id)) continue;
      const id = uid('it');
      level.items.push({ ...it, id, x: it.x + dx });
      copy.items.add(id);
    }
    for (const r of seeds) level.rooms.push({ ...r, id: uid('r'), x: r.x + dx });
  }
  return out;
}

export function remove(project, sel) {
  for (const level of project.levels) {
    const t = sel.parts[level.id]; if (!t) continue;
    level.walls = level.walls.filter((w) => !(t.nodes.has(w.a) && t.nodes.has(w.b)));
    level.items = level.items.filter((it) => !t.items.has(it.id));
    removeOrphans(level);
  }
}
