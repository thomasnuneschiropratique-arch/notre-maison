// Éditeur de plan 2D : souris et tactile (pincer pour zoomer, deux doigts pour se déplacer).
import { store, addNode, addWall, splitWall, uid } from './state.js';
import { projectOnSegment, dist, itemCorners, wallCorners, polygonCentroid } from './geometry.js';
import { getItem, OPENINGS } from './catalog.js';
import { terrainOf, T_N } from './terrain.js';
import { parcelOf, checkParcel, insetPolygon, metres } from './parcel.js';
import { isGroup, newGroup, isEmptyGroup, addRect, toggleItem, toggleNodes, toggleRoom, bounds, capture, apply, finish, clampMove, remove } from './group.js';

const INK = '#26231e', ACCENT = '#b5532f', SOFT = 'rgba(38,35,30,.5)';

/** Marches d'un escalier à quart tournant, vues de dessus. */
function quarterTreads(c, w, d, f) {
  for (let y = -d / 2 + f; y < d / 2; y += 26) { c.moveTo(-w / 2, y); c.lineTo(-w / 2 + f, y); }
  for (let x = -w / 2 + f; x < w / 2; x += 26) { c.moveTo(x, -d / 2); c.lineTo(x, -d / 2 + f); }
  c.moveTo(-w / 2, -d / 2); c.lineTo(-w / 2 + f, -d / 2 + f);
}

export class Plan2D {
  tool = 'select'; view = { x: 0, y: 0, k: 0.9 }; pointers = new Map(); draft = null; drag = null; openingPreset = OPENINGS[0]; hover = null;
  wallThickness = 20; bgImages = new Map();

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('dblclick', () => this.finishDraft());
    // Pavé tactile : deux doigts déplacent le plan, pincer zoome. Molette : zoom.
    let padSeen = false;
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaX !== 0) padSeen = true;
      if (padSeen && !e.ctrlKey) { this.view.x -= e.deltaX; this.view.y -= e.deltaY; this.draw(); return; }
      this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e));
    for (const ev of ['change', 'select', 'level', 'project']) store.addEventListener(ev, () => this.draw());
    store.addEventListener('terrain-live', () => { this.contourSrc = null; this.draw(); });
    canvas.addEventListener('pointerleave', () => { if (store.brush) { this.brushPos = null; this.draw(); } });
    this.resize();
  }

  resize() {
    const p = this.canvas.parentElement.getBoundingClientRect();
    if (!p.width || !p.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = p.width * dpr; this.canvas.height = p.height * dpr;
    this.canvas.style.width = `${p.width}px`; this.canvas.style.height = `${p.height}px`;
    this.dpr = dpr; this.w = p.width; this.h = p.height;
    if (!this.fitted) { this.fit(); }
    this.paint();
  }

  fit() {
    if (!store.project || !this.w) return;
    const lv = store.level;
    // On cadre la maison ; le terrain ne sert que tant que rien n'est dessiné.
    const nodes = Object.values(lv.nodes), pts = nodes.length ? nodes : parcelOf(store.project)?.pts || [];
    if (!pts.length) { this.view = { x: this.w / 2, y: this.h / 2, k: 0.6 }; return; }
    this.fitted = true;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // La barre d'outils couvre un bord du plan : on cadre dans la place qui reste.
    let left = 0, top = 0;
    try { const r = document.querySelector('.rail')?.getBoundingClientRect(), c = this.canvas.getBoundingClientRect(); if (r?.width) { if (r.height > r.width) left = Math.max(0, r.right - c.left); else top = Math.max(0, r.bottom - c.top); } } catch { /* sans barre */ }
    const W = this.w - left, Hh = this.h - top;
    const k = Math.min((W - 60) / (x1 - x0 + 60), (Hh - 100) / (y1 - y0 + 60), 1.6);
    this.view = { k, x: left + W / 2 - ((x0 + x1) / 2) * k, y: top + Hh / 2 - ((y0 + y1) / 2) * k };
    this.draw();
  }

  toWorld(sx, sy) { return { x: (sx - this.view.x) / this.view.k, y: (sy - this.view.y) / this.view.k }; }
  toScreen(p) { return { x: p.x * this.view.k + this.view.x, y: p.y * this.view.k + this.view.y }; }
  zoomAt(sx, sy, f) {
    const k = Math.max(0.12, Math.min(5, this.view.k * f));
    const w = this.toWorld(sx, sy);
    this.view.k = k; this.view.x = sx - w.x * k; this.view.y = sy - w.y * k;
    this.draw();
  }

  setTool(t, preset) {
    this.finishDraft();
    if (this.tool === 'parcel' && this.parcelDraft?.length >= 3) this.closeParcel();
    this.parcelDraft = null;
    this.tool = t;
    if (preset) this.openingPreset = preset;
    this.canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
    store.emit('tool', t);
    this.draw();
  }

  key(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'Escape') { if (this.draft) this.finishDraft(); else { this.setTool('select'); store.select(null); } }
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.selection) { this.deleteSelection(); e.preventDefault(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.shiftKey ? store.redo() : store.undo(); e.preventDefault(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { store.redo(); e.preventDefault(); }
  }

  deleteSelection() {
    const s = store.selection; if (!s) return;
    if (isGroup(s)) {
      store.mutate((p) => remove(p, s));
      store.select(null);
      store.emit('toast', { text: 'Sélection supprimée.', undo: true });
      return;
    }
    store.mutate((p, lv) => {
      if (s.type === 'item') lv.items = lv.items.filter((i) => i.id !== s.id);
      if (s.type === 'wall') lv.walls = lv.walls.filter((w) => w.id !== s.id);
      if (s.type === 'opening') { const w = lv.walls.find((x) => x.id === s.wallId); if (w) w.openings = w.openings.filter((o) => o.id !== s.id); }
      if (s.type === 'node') { lv.walls = lv.walls.filter((w) => w.a !== s.id && w.b !== s.id); delete lv.nodes[s.id]; }
      cleanOrphans(lv);
    });
    store.select(null);
    store.emit('toast', { text: 'Supprimé.', undo: true });
  }

  // Aimantation : nœud existant, mur existant, alignement, puis grille.
  snap(p, opts = {}) {
    const lv = store.level;
    const tol = 14 / this.view.k;
    let best = null, bestD = tol;
    for (const [id, n] of Object.entries(lv.nodes)) {
      if (id === opts.ignore) continue;
      const d = dist(n, p);
      if (d < bestD) { best = { x: n.x, y: n.y, node: id }; bestD = d; }
    }
    if (best) return best;
    for (const w of lv.walls) {
      if (opts.ignore && (w.a === opts.ignore || w.b === opts.ignore)) continue;
      const r = projectOnSegment(p, lv.nodes[w.a], lv.nodes[w.b]);
      if (r.d < tol * 0.8 && r.t > 0.01 && r.t < 0.99) return { x: r.point.x, y: r.point.y, wall: w };
    }
    const g = opts.grid ?? 5;
    let x = Math.round(p.x / g) * g, y = Math.round(p.y / g) * g, guide = null;
    const from = opts.from;
    if (from) {
      if (Math.abs(p.x - from.x) < tol) { x = from.x; guide = 'v'; }
      if (Math.abs(p.y - from.y) < tol) { y = from.y; guide = 'h'; }
    }
    if (!opts.noAlign) for (const n of Object.values(lv.nodes)) {
      if (from && n === from) continue;
      if (Math.abs(p.x - n.x) < tol * 0.6) x = n.x;
      if (Math.abs(p.y - n.y) < tol * 0.6) y = n.y;
    }
    return { x, y, guide };
  }

  pos(e) { const r = this.canvas.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }

  down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    const { sx, sy } = this.pos(e);
    this.pointers.set(e.pointerId, { sx, sy });
    if (this.pointers.size === 2) {
      if (this.drag?.type === 'brush') store.brushStroke.end();
      if (this.drag?.type === 'group' && this.drag.began) { if (this.drag.session) finish(this.drag.session); store.commit({ rebuild: true }); }
      this.drag = null; this.pressMoved = true;
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), cx: (a.sx + b.sx) / 2, cy: (a.sy + b.sy) / 2 };
      return;
    }
    this.press = { sx, sy, t: performance.now() };
    this.pressMoved = false;
    const p = this.toWorld(sx, sy);
    if (store.brush) { this.drag = { type: 'brush' }; this.brushPos = p; store.brushStroke.begin(p); this.draw(); return; }
    this.touch = e.pointerType === 'touch';
    if (this.tool === 'zone' || (this.tool === 'select' && e.shiftKey)) this.beginZone(p, e.shiftKey);
    else if (this.tool === 'select') { if (this.overGroup(p)) this.drag = { type: 'group', p0: p }; else this.beginSelectDrag(p, sx, sy); }
    else this.drag = { type: 'pan', vx: this.view.x, vy: this.view.y, sx, sy, passive: true };
    if (this.tool === 'room') this.drag = { type: 'room', a: this.snap(p), b: this.snap(p) };
    if (this.tool === 'roof') this.drag = { type: 'roofZone', a: this.snap(p), b: this.snap(p) };
    if (this.tool === 'parcel') { const i = this.parcelCorner(p); if (i >= 0) this.drag = { type: 'parcelPt', i }; }
    if (this.tool === 'measure') this.drag = { type: 'measure', a: this.snap(p), b: this.snap(p) };
    this.draw();
  }

  hitTest(p) {
    const lv = store.level, tol = (this.touch ? 20 : 12) / this.view.k;
    const sel = store.selection;
    if (sel?.type === 'item') {
      const it = lv.items.find((i) => i.id === sel.id);
      const h = it && this.rotateHandle(it);
      if (h && dist(p, h) < tol * 1.5) return { type: 'rotate', item: it };
    }
    for (const w of lv.walls) for (const o of w.openings) {
      const a = lv.nodes[w.a], b = lv.nodes[w.b], L = dist(a, b);
      const c = { x: a.x + ((b.x - a.x) * o.t) / L, y: a.y + ((b.y - a.y) * o.t) / L };
      const r = projectOnSegment(p, a, b);
      if (Math.abs(r.t * L - o.t) < o.width / 2 + 3 && r.d < w.thickness / 2 + tol * 0.5) return { type: 'opening', wall: w, opening: o, c };
    }
    for (const [id, n] of Object.entries(lv.nodes)) if (dist(n, p) < tol) return { type: 'node', id };
    const below = store.project.levels[store.levelIndex - 1];
    for (const it of below?.items || []) {
      const def = getItem(it.cat); if (def?.sub !== 'escalier') continue;
      const r = (-(it.rot || 0) * Math.PI) / 180, dx = p.x - it.x, dy = p.y - it.y;
      if (Math.abs(dx * Math.cos(r) - dy * Math.sin(r)) <= (it.w ?? def.w) / 2 && Math.abs(dx * Math.sin(r) + dy * Math.cos(r)) <= (it.d ?? def.d) / 2) return { type: 'stairBelow', item: it };
    }
    const sorted = [...lv.items].reverse();
    for (const it of sorted) {
      const def = getItem(it.cat); if (!def) continue;
      const r = (-(it.rot || 0) * Math.PI) / 180;
      const dx = p.x - it.x, dy = p.y - it.y;
      const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
      if (Math.abs(lx) <= (it.w ?? def.w) / 2 && Math.abs(ly) <= (it.d ?? def.d) / 2) return { type: 'item', item: it };
    }
    for (const w of lv.walls) {
      const r = projectOnSegment(p, lv.nodes[w.a], lv.nodes[w.b]);
      if (r.d < Math.max(w.thickness / 2, tol * 0.6)) return { type: 'wall', wall: w, r };
    }
    const analysis = store.analysis();
    for (let i = 0; i < analysis.rooms.length; i++) {
      if (pointInPoly(p, analysis.rooms[i].poly)) return { type: 'room', room: lv.rooms[i] };
    }
    return null;
  }

  rotateHandle(it) {
    const def = getItem(it.cat); if (!def) return null;
    const r = ((it.rot || 0) * Math.PI) / 180, l = (it.d ?? def.d) / 2 + 26 / this.view.k;
    return { x: it.x + Math.sin(r) * l, y: it.y - Math.cos(r) * l };
  }

  beginSelectDrag(p, sx, sy) {
    const hit = this.hitTest(p);
    if (!hit) { this.drag = { type: 'pan', vx: this.view.x, vy: this.view.y, sx, sy, deselect: true }; return; }
    const lv = store.level;
    if (hit.type === 'stairBelow') { store.setLevel(store.levelIndex - 1); store.select({ type: 'item', id: hit.item.id }); store.emit('toast', 'Niveau du bas : c’est ici que l’escalier se déplace.'); return; }
    if (hit.type === 'rotate') { this.drag = { type: 'rotate', item: hit.item, snapped: false }; return; }
    // Au doigt, un élément doit d'abord être sélectionné : déplacer la vue ne bouge jamais un mur par erreur.
    if (hit.type === 'room' || (this.touch && !isSelected(hit))) { this.drag = { type: 'pan', vx: this.view.x, vy: this.view.y, sx, sy, tapHit: hit }; return; }
    if (hit.type === 'node') { store.select({ type: 'node', id: hit.id }); this.drag = { type: 'node', id: hit.id, start: { ...lv.nodes[hit.id] } }; return; }
    if (hit.type === 'opening') { store.select({ type: 'opening', id: hit.opening.id, wallId: hit.wall.id }); this.drag = { type: 'opening', wall: hit.wall, opening: hit.opening }; return; }
    if (hit.type === 'item') { store.select({ type: 'item', id: hit.item.id }); this.drag = { type: 'item', item: hit.item, ox: p.x - hit.item.x, oy: p.y - hit.item.y }; return; }
    if (hit.type === 'wall') {
      store.select({ type: 'wall', id: hit.wall.id });
      const a = lv.nodes[hit.wall.a], b = lv.nodes[hit.wall.b];
      this.drag = { type: 'wall', wall: hit.wall, a: { ...a }, b: { ...b }, p0: p };
      return;
    }
  }

  beginOnce() { if (!this.drag.began) { store.snapshot(); this.drag.began = true; } }

  // ——— Sélection de plusieurs éléments ———
  overGroup(p) {
    const s = store.selection; if (!isGroup(s)) return false;
    const b = bounds(store.project, s), m = 10 / this.view.k;
    return !!b && p.x >= b.x0 - m && p.x <= b.x1 + m && p.y >= b.y0 - m && p.y <= b.y1 + m;
  }

  beginZone(p, add) {
    if (!add && this.overGroup(p)) { this.drag = { type: 'group', p0: p }; return; }
    this.drag = { type: 'zone', a: p, b: p, add };
  }

  finishZone(d) {
    const sel = d.add && isGroup(store.selection) ? store.selection : newGroup();
    addRect(sel, store.level, { x0: Math.min(d.a.x, d.b.x), x1: Math.max(d.a.x, d.b.x), y0: Math.min(d.a.y, d.b.y), y1: Math.max(d.a.y, d.b.y) });
    if (isEmptyGroup(sel)) { store.select(null); store.emit('toast', 'Rien dans ce cadre : englobe des angles de murs ou le centre des meubles.'); return; }
    store.select(sel);
  }

  /** Une touche sur un élément l'ajoute à la sélection, une seconde touche l'en retire. */
  zoneTap(p, add) {
    const hit = this.hitTest(p);
    if (!hit || hit.type === 'stairBelow' || hit.type === 'rotate') { if (!add) store.select(null); return; }
    const lv = store.level, sel = isGroup(store.selection) ? store.selection : newGroup();
    if (hit.type === 'item') toggleItem(sel, lv, hit.item.id);
    if (hit.type === 'room') toggleRoom(sel, lv, lv.rooms.indexOf(hit.room));
    if (hit.type === 'wall' || hit.type === 'opening') toggleNodes(sel, lv, [hit.wall.a, hit.wall.b]);
    if (hit.type === 'node') toggleNodes(sel, lv, [hit.id]);
    store.select(isEmptyGroup(sel) ? null : sel);
  }

  move(e) {
    const { sx, sy } = this.pos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { sx, sy });
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.sx - b.sx, a.sy - b.sy), cx = (a.sx + b.sx) / 2, cy = (a.sy + b.sy) / 2;
      this.view.x += cx - this.pinch.cx; this.view.y += cy - this.pinch.cy;
      this.zoomAt(cx, cy, d / this.pinch.d);
      this.pinch = { d, cx, cy };
      return;
    }
    const p = this.toWorld(sx, sy);
    if (store.brush) { this.brushPos = p; if (this.drag?.type === 'brush') store.brushStroke.at(p); else this.draw(); return; }
    if (this.press && Math.hypot(sx - this.press.sx, sy - this.press.sy) > 5) this.pressMoved = true;
    if (this.tool === 'wall' && e.pointerType !== 'touch') {
      this.hover = this.snap(p, { from: this.draft?.pts.at(-1) });
      this.draw();
    }
    if (this.tool === 'wall' && e.pointerType === 'touch' && this.pointers.size === 1 && this.draft) {
      this.hover = this.snap(p, { from: this.draft.pts.at(-1) });
      this.draw();
      return;
    }
    if (['door', 'opening'].includes(this.tool)) { this.hover = this.openingAt(p); this.draw(); }
    const d = this.drag;
    if (!d && e.pointerType === 'mouse' && isGroup(store.selection)) this.canvas.style.cursor = this.overGroup(p) ? 'move' : this.tool === 'select' ? 'default' : 'crosshair';
    if (!d || !this.pressMoved) return;
    const lv = store.level;
    if (d.type === 'pan') { this.view.x = d.vx + sx - d.sx; this.view.y = d.vy + sy - d.sy; this.draw(); return; }
    if (d.type === 'room' || d.type === 'roofZone' || d.type === 'measure') { d.b = this.snap(p, { from: d.a }); this.draw(); return; }
    if (d.type === 'zone') { d.b = p; this.draw(); return; }
    this.beginOnce();
    if (d.type === 'group') {
      d.session ||= capture(store.project, store.selection);
      const m = clampMove(store.project, d.session.box, Math.round((p.x - d.p0.x) / 5) * 5, Math.round((p.y - d.p0.y) / 5) * 5);
      d.delta = m;
      apply(d.session, (q) => ({ x: q.x + m.dx, y: q.y + m.dy }));
    } else if (d.type === 'node') {
      const s = this.snap(p, { ignore: d.id, from: d.start });
      lv.nodes[d.id].x = s.x; lv.nodes[d.id].y = s.y; d.snapNode = s.node;
    } else if (d.type === 'wall') {
      const dx = p.x - d.p0.x, dy = p.y - d.p0.y;
      const L = dist(d.a, d.b), nx = -(d.b.y - d.a.y) / L, ny = (d.b.x - d.a.x) / L;
      const m = Math.round((dx * nx + dy * ny) / 5) * 5;
      Object.assign(lv.nodes[d.wall.a], { x: d.a.x + nx * m, y: d.a.y + ny * m });
      Object.assign(lv.nodes[d.wall.b], { x: d.b.x + nx * m, y: d.b.y + ny * m });
    } else if (d.type === 'opening') {
      const a = lv.nodes[d.wall.a], b = lv.nodes[d.wall.b], L = dist(a, b);
      const r = projectOnSegment(p, a, b);
      d.opening.t = Math.round(Math.max(d.opening.width / 2 + 2, Math.min(L - d.opening.width / 2 - 2, r.t * L)));
    } else if (d.type === 'item') {
      this.moveItem(d.item, p.x - d.ox, p.y - d.oy);
    } else if (d.type === 'parcelPt') {
      store.project.site.parcel.pts[d.i] = { x: Math.round(p.x / 5) * 5, y: Math.round(p.y / 5) * 5 };
    } else if (d.type === 'rotate') {
      let a = (Math.atan2(p.x - d.item.x, -(p.y - d.item.y)) * 180) / Math.PI;
      a = Math.round(a / 15) * 15;
      d.item.rot = (a + 360) % 360;
    }
    this.draw();
    store.emit('live', { type: d.type });
  }

  /** Déplace un meuble ; s'il s'approche d'un mur, il s'y plaque et s'aligne. */
  moveItem(item, x, y) {
    const lv = store.level, def = getItem(item.cat);
    const dd = (item.d ?? def.d) / 2;
    let nx = Math.round(x), ny = Math.round(y);
    for (const w of lv.walls) {
      const a = lv.nodes[w.a], b = lv.nodes[w.b];
      const r = projectOnSegment({ x: nx, y: ny }, a, b);
      const need = w.thickness / 2 + dd;
      if (r.t > 0.02 && r.t < 0.98 && r.d < need + 12 && r.d > need - 25) {
        const vx = (nx - r.point.x) / (r.d || 1), vy = (ny - r.point.y) / (r.d || 1);
        nx = r.point.x + vx * (need + 0.5); ny = r.point.y + vy * (need + 0.5);
        if (def.wall) item.rot = ((Math.atan2(vx, -vy) * 180) / Math.PI + 180 + 360) % 360;
        break;
      }
    }
    item.x = nx; item.y = ny;
    if (def.onSurface) {
      const under = lv.items.find((o) => {
        if (o === item) return false;
        const od = getItem(o.cat); if (!od || od.wall || od.ceiling || od.onSurface) return false;
        const r = (-(o.rot || 0) * Math.PI) / 180, dx = nx - o.x, dy = ny - o.y;
        return Math.abs(dx * Math.cos(r) - dy * Math.sin(r)) <= (o.w ?? od.w) / 2 && Math.abs(dx * Math.sin(r) + dy * Math.cos(r)) <= (o.d ?? od.d) / 2;
      });
      item.z = under ? (under.h ?? getItem(under.cat).h) : 0;
    }
  }

  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size) return;
    const { sx, sy } = this.pos(e);
    const p = this.toWorld(sx, sy);
    const tap = !this.pressMoved;
    const d = this.drag; this.drag = null;
    const lv = store.level;
    if (d?.type === 'brush') { store.brushStroke.end(); return; }
    if (d?.type === 'room') { this.finishRoom(d); this.draw(); return; }
    if (d?.type === 'roofZone') { this.finishRoof(d); this.draw(); return; }
    if (d?.type === 'measure') { this.measure = tap ? null : d; this.draw(); if (!tap && lv.background && Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) > 20) store.emit('measured', d); return; }
    if (d?.type === 'zone') { if (tap) this.zoneTap(p, d.add); else this.finishZone(d); this.draw(); return; }
    if (d?.began) {
      if (d.type === 'node' && d.snapNode && d.snapNode !== d.id) mergeNodes(lv, d.id, d.snapNode);
      if (d.type === 'group' && d.session) finish(d.session);
      store.commit({ rebuild: true });
      if (d.type === 'group') {
        store.emit('select');
        if (d.delta?.limited) store.emit('toast', 'Arrêté au bord du terrain.');
      }
      return;
    }
    if (d?.type === 'group' && tap) {
      if (this.tool === 'zone') this.zoneTap(p, false);
      else { const hit = this.hitTest(p); store.select(hit && hit.type !== 'stairBelow' && hit.type !== 'rotate' ? selectionOf(hit) : null); }
      this.draw();
      return;
    }
    if (tap) {
      if (d?.deselect) store.select(null);
      if (d?.tapHit) store.select(selectionOf(d.tapHit));
      if (this.tool === 'wall') this.wallClick(p);
      if (this.tool === 'parcel') this.parcelTap(p);
      if (this.tool === 'door' || this.tool === 'opening') this.placeOpening(p);
    }
    this.draw();
  }

  // ——— Toits supplémentaires et parcelle ———
  finishRoof(d) {
    const x0 = Math.min(d.a.x, d.b.x), x1 = Math.max(d.a.x, d.b.x), y0 = Math.min(d.a.y, d.b.y), y1 = Math.max(d.a.y, d.b.y);
    if (x1 - x0 < 60 || y1 - y0 < 60) { store.emit('toast', 'Fais glisser pour couvrir la partie à couvrir.'); return; }
    store.mutate((pr, lv) => { (pr.roofs ||= []).push({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type: 'gable', pitch: pr.roof.pitch || 30, overhang: 30, ridge: 'auto', wallH: 0 }); });
    this.setTool('select');
    store.emit('roof-added');
  }

  parcelCorner(p) {
    const m = parcelOf(store.project); if (!m) return -1;
    const tol = (this.touch ? 24 : 12) / this.view.k;
    return m.pts.findIndex((q) => dist(q, p) < tol);
  }

  parcelTap(p) {
    const m = parcelOf(store.project), q = { x: Math.round(p.x / 5) * 5, y: Math.round(p.y / 5) * 5 }, tol = (this.touch ? 24 : 12) / this.view.k;
    if (m) {
      if (this.parcelCorner(p) >= 0) return;
      const i = m.pts.findIndex((a, j) => projectOnSegment(p, a, m.pts[(j + 1) % m.pts.length]).d < tol);
      if (i >= 0) store.mutate((pr) => pr.site.parcel.pts.splice(i + 1, 0, q));
      return;
    }
    this.parcelDraft ||= [];
    if (this.parcelDraft.length >= 3 && dist(p, this.parcelDraft[0]) < tol) { this.closeParcel(); this.setTool('select'); return; }
    this.parcelDraft.push(q);
    this.draw();
  }

  closeParcel() {
    const pts = this.parcelDraft;
    this.parcelDraft = null;
    store.mutate((pr) => { pr.site.parcel = { ...pr.site.parcel, pts }; });
    store.emit('parcel-set');
  }

  wallClick(p) {
    const lv = store.level;
    const from = this.draft?.pts.at(-1);
    const s = this.snap(p, { from });
    if (!this.draft) { this.draft = { pts: [s] }; this.draw(); return; }
    const last = this.draft.pts.at(-1);
    if (dist(s, last) < 5) { this.finishDraft(); return; }
    store.snapshot();
    this.addWallBetween(last, s);
    this.draft.pts.push(s);
    const closed = s.node && this.draft.pts.length > 2 && s.node === this.draft.pts[0].resolved;
    store.commit();
    if (closed) this.finishDraft();
    void lv;
  }

  resolveEnd(s) {
    const lv = store.level;
    if (s.node) { s.resolved = s.node; return s.node; }
    if (s.wall && lv.walls.includes(s.wall)) { s.resolved = splitWall(lv, s.wall, s.x, s.y); return s.resolved; }
    s.resolved = addNode(lv, s.x, s.y);
    return s.resolved;
  }

  addWallBetween(a, b) {
    const lv = store.level;
    const ia = a.resolved && lv.nodes[a.resolved] ? a.resolved : this.resolveEnd(a);
    const ib = this.resolveEnd(b);
    addWall(lv, ia, ib, this.wallThickness);
  }

  finishDraft() { if (this.draft) { this.draft = null; this.hover = null; this.draw(); } }

  finishRoom(d) {
    const x0 = Math.min(d.a.x, d.b.x), x1 = Math.max(d.a.x, d.b.x), y0 = Math.min(d.a.y, d.b.y), y1 = Math.max(d.a.y, d.b.y);
    if (x1 - x0 < 30 || y1 - y0 < 30) return;
    store.mutate((pr, lv) => {
      const ids = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => addNode(lv, x, y));
      ids.forEach((id, i) => addWall(lv, id, ids[(i + 1) % 4], this.wallThickness));
    });
  }

  openingAt(p) {
    const lv = store.level, tol = 40 / this.view.k;
    let best = null;
    for (const w of lv.walls) {
      const a = lv.nodes[w.a], b = lv.nodes[w.b], L = dist(a, b);
      const r = projectOnSegment(p, a, b);
      if (r.d < tol && (!best || r.d < best.d)) {
        const hw = this.openingPreset.width / 2;
        best = { wall: w, L, t: Math.round(L > 2 * hw + 8 ? Math.max(hw + 4, Math.min(L - hw - 4, r.t * L)) : L / 2), d: r.d, fits: L > 2 * hw + 8 };
      }
    }
    return best;
  }

  /** Position libre la plus proche sur le mur, ou null. */
  freeSpot(wall, L, wanted, width, others) {
    const hw = width / 2, min = hw + 4, max = L - hw - 4;
    const ok = (t) => t >= min && t <= max && !others.some((o) => Math.abs(o.t - t) < (o.width + width) / 2 + 3);
    const cand = [wanted, min, max, ...others.flatMap((o) => [o.t - (o.width + width) / 2 - 4, o.t + (o.width + width) / 2 + 4])].filter(ok);
    if (!cand.length) return null;
    return Math.round(cand.reduce((b, t) => (Math.abs(t - wanted) < Math.abs(b - wanted) ? t : b)));
  }

  placeOpening(p) {
    const h = this.openingAt(p);
    if (!h) { store.emit('toast', 'Touche un mur pour y placer cette ouverture.'); return; }
    const preset = this.openingPreset, lv = store.level;
    const m = (v) => (v / 100).toFixed(2).replace('.', ',');
    if (!h.fits) { store.emit('toast', `Ce mur fait ${m(h.L)} m : trop court pour ${m(preset.width)} m. Choisis un mur plus long ou allonge-le.`); return; }
    let t = this.freeSpot(h.wall, h.L, h.t, preset.width, h.wall.openings), replaced = [];
    if (t === null) {
      // Plus de place : la nouvelle ouverture remplace celles qui la gênent.
      replaced = h.wall.openings.filter((o) => Math.abs(o.t - h.t) < (o.width + preset.width) / 2 + 3);
      t = this.freeSpot(h.wall, h.L, h.t, preset.width, h.wall.openings.filter((o) => !replaced.includes(o)));
      if (t === null) { store.emit('toast', 'Pas assez de place sur ce mur, même en retirant l’ouverture touchée.'); return; }
    }
    const id = uid('o');
    const height = preset.full ? Math.max(preset.height, lv.height - 8) : Math.min(preset.height, lv.height - preset.sill);
    store.mutate(() => { h.wall.openings = h.wall.openings.filter((o) => !replaced.includes(o)); h.wall.openings.push({ id, type: preset.type, name: preset.name, width: preset.width, height, sill: preset.sill, t, open: preset.type === 'door' ? 20 : 0, glazed: preset.glazed, leaves: preset.leaves, muntins: preset.muntins }); });
    if (replaced.length) store.emit('toast', { text: 'L’ouverture a remplacé celle qui gênait.', undo: true });
    store.select({ type: 'opening', id, wallId: h.wall.id });
    this.setTool('select');
  }

  center() { return this.toWorld(this.w / 2, this.h / 2); }

  // ——— Dessin ———
  /** Regroupe les demandes : au plus un dessin par image. */
  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); });
  }

  paint() {
    if (!store.project || !this.w) return;
    const c = this.ctx, lv = store.level, { k, x, y } = this.view;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#f7f4ee'; c.fillRect(0, 0, this.w, this.h);
    this.drawBackground(lv);
    this.drawGrid();
    c.save(); c.translate(x, y); c.scale(k, k);
    this.drawContours();
    this.drawParcel();
    const analysis = store.analysis(lv);
    const lower = store.project.levels[store.levelIndex - 1], upper = store.project.levels[store.levelIndex + 1];
    if (lower) this.drawGhost(lower);
    if (upper) this.drawGhost(upper);
    this.drawRooms(lv, analysis);
    for (const it of lv.items) this.drawItem(it);
    this.drawWalls(lv, analysis);
    if (lower) for (const it of lower.items) if (getItem(it.cat)?.sub === 'escalier') this.drawStairBelow(it);
    this.drawRoofZones(lv);
    this.drawDraft();
    this.drawSelection(lv);
    if (store.brush && this.brushPos) { c.strokeStyle = ACCENT; c.lineWidth = 2 / k; c.setLineDash([8 / k, 6 / k]); c.beginPath(); c.arc(this.brushPos.x, this.brushPos.y, store.brush.radius * 100, 0, 7); c.stroke(); c.setLineDash([]); }
    c.restore();
    this.drawRoomLabels(lv, analysis);
    this.drawDimensions(lv);
    this.drawOverlayText();
  }

  drawBackground(lv) {
    const bg = lv.background; if (!bg) return;
    let img = this.bgImages.get(bg.src);
    if (!img) { img = new Image(); img.onload = () => this.draw(); img.src = bg.src; this.bgImages.set(bg.src, img); }
    if (!img.complete) return;
    const c = this.ctx, p = this.toScreen({ x: bg.x, y: bg.y });
    c.globalAlpha = bg.opacity ?? 0.5;
    c.drawImage(img, p.x, p.y, img.width * bg.scale * this.view.k, img.height * bg.scale * this.view.k);
    c.globalAlpha = 1;
  }

  drawParcel() {
    const c = this.ctx, k = this.view.k, m = parcelOf(store.project), d = this.parcelDraft;
    if (d?.length) {
      c.strokeStyle = ACCENT; c.fillStyle = ACCENT; c.lineWidth = 2 / k; c.setLineDash([]);
      c.beginPath(); d.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
      d.forEach((p) => { c.beginPath(); c.arc(p.x, p.y, 6 / k, 0, 7); c.fill(); });
    }
    if (!m) return;
    const path = (pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); };
    path(m.pts); c.fillStyle = 'rgba(122,150,86,.07)'; c.fill();
    c.strokeStyle = '#3f6b33'; c.lineWidth = 2.2 / k; c.setLineDash([12 / k, 6 / k]); c.stroke();
    const info = checkParcel(store.project);
    path(insetPolygon(m.pts, info.need)); c.strokeStyle = 'rgba(181,83,47,.75)'; c.lineWidth = 1.2 / k; c.setLineDash([5 / k, 5 / k]); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#c0392b'; c.lineWidth = 2 / k;
    for (const q of info.issues) { c.beginPath(); c.moveTo(q.from.x, q.from.y); c.lineTo(q.to.x, q.to.y); c.stroke(); }
    if (this.tool === 'parcel') { c.fillStyle = '#3f6b33'; for (const p of m.pts) { c.beginPath(); c.arc(p.x, p.y, 7 / k, 0, 7); c.fill(); } }
  }

  drawRoofZones(lv) {
    const c = this.ctx, k = this.view.k;
    if (this.drag?.type === 'roofZone') { const { a, b } = this.drag; c.fillStyle = 'rgba(122,70,40,.16)'; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
    c.strokeStyle = 'rgba(122,70,40,.8)'; c.lineWidth = 1.4 / k; c.setLineDash([9 / k, 4 / k]);
    for (const z of store.project.roofs || []) if (z.level === lv.id) c.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    c.setLineDash([]);
  }

  /** Courbes de niveau : une ligne par mètre de dénivelé, plus marquée tous les 5 m. */
  drawContours() {
    const m = terrainOf(store.project); if (!m) return;
    const c = this.ctx;
    if (this.contourSrc !== m.src || !this.contours) {
      this.contourSrc = m.src;
      const thin = new Path2D(), bold = new Path2D(), half = (T_N - 1) / 2, h = m.h;
      const X = (i) => (i - half) * 100 + m.cx, Y = (j) => (j - half) * 100 + m.cy;
      for (let j = 0; j < T_N - 1; j++) for (let i = 0; i < T_N - 1; i++) {
        const a = h[j * T_N + i], b = h[j * T_N + i + 1], e = h[(j + 1) * T_N + i + 1], d = h[(j + 1) * T_N + i];
        const lo = Math.ceil(Math.min(a, b, e, d) / 100), hi = Math.floor(Math.max(a, b, e, d) / 100);
        for (let v = lo; v <= hi; v++) {
          const L = v * 100, pts = [];
          const edge = (p, q, x0, y0, x1, y1) => { if ((p < L) !== (q < L)) { const t = (L - p) / (q - p); pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); } };
          edge(a, b, X(i), Y(j), X(i + 1), Y(j)); edge(b, e, X(i + 1), Y(j), X(i + 1), Y(j + 1)); edge(e, d, X(i + 1), Y(j + 1), X(i), Y(j + 1)); edge(d, a, X(i), Y(j + 1), X(i), Y(j));
          if (pts.length >= 2) { const P = v % 5 === 0 ? bold : thin; P.moveTo(pts[0][0], pts[0][1]); P.lineTo(pts[1][0], pts[1][1]); if (pts.length === 4) { P.moveTo(pts[2][0], pts[2][1]); P.lineTo(pts[3][0], pts[3][1]); } }
        }
      }
      this.contours = { thin, bold };
    }
    const k = this.view.k;
    c.strokeStyle = 'rgba(122,98,64,.28)'; c.lineWidth = 0.8 / k; c.stroke(this.contours.thin);
    c.strokeStyle = 'rgba(122,98,64,.5)'; c.lineWidth = 1.5 / k; c.stroke(this.contours.bold);
  }

  /** Rappelle sur le plan du haut l'escalier qui descend. */
  drawStairBelow(it) {
    const def = getItem(it.cat), c = this.ctx, w = it.w ?? def.w, d = it.d ?? def.d, k = this.view.k;
    c.save(); c.translate(it.x, it.y); c.rotate(((it.rot || 0) * Math.PI) / 180);
    c.fillStyle = 'rgba(181,83,47,.1)'; c.strokeStyle = ACCENT; c.lineWidth = 1.2 / k; c.setLineDash([6 / k, 4 / k]);
    c.fillRect(-w / 2, -d / 2, w, d); c.strokeRect(-w / 2, -d / 2, w, d); c.setLineDash([]);
    if (def.model?.p?.quarter) { c.beginPath(); quarterTreads(c, w, d, (def.model.p.flight || 1.15) * 100); c.stroke(); }
    else if (!def.model?.p?.shape || def.model.p.shape === 'straight') { const n = Math.round(d / 25); c.beginPath(); for (let i = 1; i < n; i++) { c.moveTo(-w / 2, -d / 2 + (i * d) / n); c.lineTo(w / 2, -d / 2 + (i * d) / n); } c.stroke(); }
    c.restore();
    const p = this.toScreen(it);
    void p;
  }

  drawGrid() {
    const c = this.ctx, { k, x, y } = this.view;
    const step = k > 0.5 ? 50 : k > 0.2 ? 100 : 500;
    const major = step * (step === 50 ? 2 : 5);
    c.lineWidth = 1;
    const x0 = Math.floor(-x / k / step) * step, y0 = Math.floor(-y / k / step) * step;
    for (let wx = x0; wx * k + x < this.w; wx += step) {
      c.strokeStyle = wx % major === 0 ? 'rgba(38,35,30,.09)' : 'rgba(38,35,30,.04)';
      c.beginPath(); c.moveTo(Math.round(wx * k + x) + 0.5, 0); c.lineTo(Math.round(wx * k + x) + 0.5, this.h); c.stroke();
    }
    for (let wy = y0; wy * k + y < this.h; wy += step) {
      c.strokeStyle = wy % major === 0 ? 'rgba(38,35,30,.09)' : 'rgba(38,35,30,.04)';
      c.beginPath(); c.moveTo(0, Math.round(wy * k + y) + 0.5); c.lineTo(this.w, Math.round(wy * k + y) + 0.5); c.stroke();
    }
  }

  drawGhost(level) {
    const c = this.ctx;
    c.strokeStyle = 'rgba(38,35,30,.15)'; c.lineWidth = 12;
    for (const w of level.walls) { const a = level.nodes[w.a], b = level.nodes[w.b]; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  }

  drawRooms(lv, analysis) {
    const c = this.ctx, sel = store.selection, g = isGroup(sel) ? sel.parts[lv.id] : null;
    analysis.rooms.forEach((r, i) => {
      const info = lv.rooms[i];
      c.beginPath(); r.poly.forEach((p, j) => (j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath();
      c.fillStyle = (sel?.type === 'room' && sel.id === info?.id) || (g && r.nodeIds.every((id) => g.nodes.has(id))) ? 'rgba(181,83,47,.14)' : '#fffdf8';
      c.fill();
    });
  }

  drawWalls(lv, analysis) {
    const c = this.ctx, corners = wallCorners(lv, analysis), sel = store.selection, g = isGroup(sel) ? sel.parts[lv.id] : null;
    for (const w of analysis.walls) {
      const q = corners.get(w.id); if (!q) continue;
      c.beginPath(); c.moveTo(q.aL.x, q.aL.y); c.lineTo(q.bL.x, q.bL.y); c.lineTo(q.bR.x, q.bR.y); c.lineTo(q.aR.x, q.aR.y); c.closePath();
      c.fillStyle = (sel?.type === 'wall' && sel.id === w.id) || (g?.nodes.has(w.a) && g.nodes.has(w.b)) ? ACCENT : INK;
      c.fill();
    }
    for (const w of analysis.walls) for (const o of w.openings) this.drawOpening(lv, w, o);
  }

  drawOpening(lv, w, o, ghost) {
    const c = this.ctx, a = lv.nodes[w.a], b = lv.nodes[w.b], L = dist(a, b);
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy, ny = ux;
    const cx = a.x + ux * o.t, cy = a.y + uy * o.t, hw = o.width / 2, ht = w.thickness / 2 + 0.5;
    c.save(); c.translate(cx, cy); c.transform(ux, uy, nx, ny, 0, 0);
    const selected = store.selection?.type === 'opening' && store.selection.id === o.id;
    c.fillStyle = '#fffdf8'; c.fillRect(-hw, -ht, o.width, ht * 2);
    const col = ghost ? ACCENT : selected ? ACCENT : INK;
    c.strokeStyle = col; c.lineWidth = 1.6 / Math.max(this.view.k, 0.5);
    if (o.type === 'passage' || o.type === 'arch') {
      c.setLineDash([3, 4]); c.beginPath(); c.moveTo(-hw, -ht); c.lineTo(hw, -ht); c.moveTo(-hw, ht); c.lineTo(hw, ht); c.stroke(); c.setLineDash([]);
    } else if (o.type === 'garage') {
      c.setLineDash([8, 5]); c.strokeRect(-hw, -ht * 0.5, o.width, ht); c.setLineDash([]);
    } else if (o.type === 'double' || (o.type === 'entry' && o.leaves === 2)) {
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * hw, ht); c.lineTo(s * hw, ht + hw); c.stroke(); c.setLineDash([4, 4]); c.beginPath(); c.arc(s * hw, ht, hw, s > 0 ? Math.PI : 0, Math.PI / 2, s > 0); c.stroke(); c.setLineDash([]); }
    } else if (o.type === 'pocket') {
      c.strokeRect(-hw, -ht * 0.25, o.width, ht * 0.5);
    } else if (o.type === 'door' || o.type === 'entry') {
      const dirX = o.hinge === 'right' ? -1 : 1, dirY = o.flip ? -1 : 1;
      const hx = -dirX * hw, hy = dirY * ht;
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx, hy + dirY * o.width); c.stroke();
      c.setLineDash([4, 4]);
      c.beginPath(); c.arc(hx, hy, o.width, dirY > 0 ? (dirX > 0 ? Math.PI / 2 : Math.PI / 2) : -Math.PI / 2, dirY > 0 ? (dirX > 0 ? 0 : Math.PI) : (dirX > 0 ? 0 : Math.PI), (dirY > 0) === (dirX > 0)); c.stroke();
      c.setLineDash([]);
    } else if (o.type === 'sliding-door') {
      c.strokeRect(-hw, -ht * 0.3, o.width, ht * 0.6);
      c.beginPath(); c.moveTo(-hw, ht + 4); c.lineTo(hw * 1.8, ht + 4); c.stroke();
    } else {
      c.strokeRect(-hw, -ht, o.width, ht * 2);
      c.beginPath(); c.moveTo(-hw, 0); c.lineTo(hw, 0); c.stroke();
      c.beginPath(); c.moveTo(-hw, -ht * 0.4); c.lineTo(hw, -ht * 0.4); c.stroke();
    }
    c.restore();
  }

  drawItem(it) {
    const def = getItem(it.cat); if (!def) return;
    const c = this.ctx, w = it.w ?? def.w, d = it.d ?? def.d;
    const selected = (store.selection?.type === 'item' && store.selection.id === it.id) || (isGroup(store.selection) && store.selection.parts[store.level.id]?.items.has(it.id));
    c.save(); c.translate(it.x, it.y); c.rotate(((it.rot || 0) * Math.PI) / 180);
    const col = it.color || def.color || '#d9d0c0';
    c.fillStyle = col + (col.length === 7 ? 'cc' : ''); c.strokeStyle = selected ? ACCENT : 'rgba(38,35,30,.65)';
    c.lineWidth = (selected ? 2.4 : 1) / Math.max(this.view.k, 0.4);
    const tree = def.model?.type === 'tree';
    if (tree) c.fillStyle = 'rgba(146,172,112,.38)';
    const round = def.model?.p?.round || tree;
    c.beginPath();
    if (round) c.arc(0, 0, w / 2, 0, Math.PI * 2); else c.rect(-w / 2, -d / 2, w, d);
    c.fill(); c.stroke();
    this.drawGlyph(def, w, d);
    c.restore();
  }

  drawGlyph(def, w, d) {
    const c = this.ctx, t = def.model?.type, sub = def.sub;
    c.strokeStyle = 'rgba(38,35,30,.5)'; c.lineWidth = 0.8 / Math.max(this.view.k, 0.4);
    const L = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    if (t === 'bed') {
      const n = w > 120 ? 2 : 1, pw = (w - 16) / n - 4;
      for (let i = 0; i < n; i++) c.strokeRect(-w / 2 + 8 + i * (pw + 8), -d / 2 + 8, pw, 34);
      L(-w / 2, -d / 2 + 62, w / 2, -d / 2 + 62);
    } else if (t === 'sofa' || sub === 'canape') {
      c.strokeRect(-w / 2 + 3, -d / 2 + 3, w - 6, d * 0.24);
      const seats = def.model?.p?.seats || 3;
      for (let i = 1; i < seats; i++) L(-w / 2 + (i * w) / seats, -d / 2 + d * 0.27, -w / 2 + (i * w) / seats, d / 2);
    } else if (t === 'bathtub') {
      c.beginPath(); c.roundRect(-w / 2 + 7, -d / 2 + 7, w - 14, d - 14, 18); c.stroke();
    } else if (t === 'shower') {
      L(-w / 2, -d / 2, w / 2, d / 2); L(w / 2, -d / 2, -w / 2, d / 2);
    } else if (t === 'wc') {
      c.beginPath(); c.ellipse(0, 7, w * 0.36, d * 0.34, 0, 0, Math.PI * 2); c.stroke();
    } else if (t === 'sinkUnit' || t === 'vanity') {
      c.beginPath(); c.roundRect(-w * 0.3, -d * 0.28, w * 0.6, d * 0.56, 6); c.stroke();
    } else if (t === 'hob') {
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc((x * w) / 4, (y * d) / 4, Math.min(w, d) * 0.15, 0, Math.PI * 2); c.stroke(); }
    } else if (t === 'stairs' && def.model?.p?.quarter) {
      c.beginPath(); quarterTreads(c, w, d, (def.model.p.flight || 1.15) * 100); c.stroke();
    } else if (t === 'stairs') {
      const n = Math.round(d / 25);
      for (let i = 1; i < n; i++) L(-w / 2, -d / 2 + (i * d) / n, w / 2, -d / 2 + (i * d) / n);
      c.fillStyle = ACCENT; c.beginPath(); c.moveTo(0, -d / 2 + 6); c.lineTo(9, -d / 2 + 24); c.lineTo(-9, -d / 2 + 24); c.fill();
    } else if (t === 'wardrobe') {
      L(-w / 2, 0, w / 2, 0);
      const n = def.model?.p?.doors || 2;
      for (let i = 0; i < n; i++) L(-w / 2 + (i * w) / n, d / 2, -w / 2 + ((i + 0.5) * w) / n, d / 2 - 12);
    } else if (sub === 'plante') {
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; L(0, 0, (Math.cos(a) * w) / 2.2, (Math.sin(a) * d) / 2.2); }
    }
  }

  drawDraft() {
    const c = this.ctx, d = this.draft;
    if (d) {
      c.strokeStyle = ACCENT; c.lineWidth = this.wallThickness; c.globalAlpha = 0.5; c.lineCap = 'butt';
      const pts = d.pts, h = this.hover;
      c.beginPath(); c.moveTo(pts.at(-1).x, pts.at(-1).y);
      if (h) { c.lineTo(h.x, h.y); c.stroke(); }
      c.globalAlpha = 1;
      if (h) {
        c.fillStyle = ACCENT; c.beginPath(); c.arc(h.x, h.y, 5 / this.view.k, 0, 7); c.fill();
      }
    } else if (this.tool === 'wall' && this.hover) {
      c.fillStyle = ACCENT; c.beginPath(); c.arc(this.hover.x, this.hover.y, 5 / this.view.k, 0, 7); c.fill();
    }
    if (this.drag?.type === 'room') {
      const { a, b } = this.drag;
      c.fillStyle = 'rgba(181,83,47,.16)'; c.strokeStyle = ACCENT; c.lineWidth = 2 / this.view.k;
      c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    if (this.drag?.type === 'zone') {
      const { a, b } = this.drag, k = this.view.k;
      c.fillStyle = 'rgba(181,83,47,.1)'; c.strokeStyle = ACCENT; c.lineWidth = 1.5 / k; c.setLineDash([7 / k, 5 / k]);
      c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); c.setLineDash([]);
    }
    const m = this.drag?.type === 'measure' ? this.drag : this.measure;
    if (m) {
      c.strokeStyle = ACCENT; c.lineWidth = 2 / this.view.k; c.setLineDash([6 / this.view.k, 5 / this.view.k]);
      c.beginPath(); c.moveTo(m.a.x, m.a.y); c.lineTo(m.b.x, m.b.y); c.stroke(); c.setLineDash([]);
    }
    if (['door', 'opening'].includes(this.tool) && this.hover?.wall) {
      this.drawOpening(store.level, this.hover.wall, { ...this.openingPreset, t: this.hover.t }, true);
    }
  }

  drawSelection(lv) {
    const c = this.ctx, s = store.selection;
    if (s?.type === 'item') {
      const it = lv.items.find((i) => i.id === s.id), h = it && this.rotateHandle(it);
      if (h) {
        c.strokeStyle = ACCENT; c.lineWidth = 1.5 / this.view.k; c.beginPath(); c.moveTo(it.x, it.y); c.lineTo(h.x, h.y); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(h.x, h.y, 9 / this.view.k, 0, 7); c.fill(); c.stroke();
      }
    }
    if (s?.type === 'node' && lv.nodes[s.id]) {
      const n = lv.nodes[s.id]; c.fillStyle = ACCENT; c.beginPath(); c.arc(n.x, n.y, 8 / this.view.k, 0, 7); c.fill();
    }
    if ((this.tool === 'select' || this.tool === 'zone') && this.view.k > 0.35) {
      c.fillStyle = '#fffdf8'; c.strokeStyle = 'rgba(38,35,30,.5)'; c.lineWidth = 1 / this.view.k;
      for (const n of Object.values(lv.nodes)) { c.beginPath(); c.arc(n.x, n.y, 3.6 / this.view.k, 0, 7); c.fill(); c.stroke(); }
    }
    if (isGroup(s)) this.drawGroupFrame(lv, s);
  }

  /** Cadre pointillé autour de la sélection, avec une poignée de déplacement au centre. */
  drawGroupFrame(lv, s) {
    const c = this.ctx, k = this.view.k, b = bounds(store.project, s), g = s.parts[lv.id];
    if (!b) return;
    if (g) { c.fillStyle = ACCENT; for (const id of g.nodes) { const n = lv.nodes[id]; if (n) { c.beginPath(); c.arc(n.x, n.y, 4.5 / k, 0, 7); c.fill(); } } }
    const m = 10 / k;
    c.strokeStyle = ACCENT; c.lineWidth = 1.5 / k; c.setLineDash([7 / k, 5 / k]);
    c.strokeRect(b.x0 - m, b.y0 - m, b.x1 - b.x0 + m * 2, b.y1 - b.y0 + m * 2); c.setLineDash([]);
    const x = (b.x0 + b.x1) / 2, y = (b.y0 + b.y1) / 2, r = 16 / k, a = 9 / k, h = 3.5 / k;
    c.fillStyle = ACCENT; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.8 / k; c.beginPath();
    for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ex = x + u * a, ey = y + v * a;
      c.moveTo(x, y); c.lineTo(ex, ey);
      c.moveTo(ex - u * h - v * h, ey - v * h + u * h); c.lineTo(ex, ey); c.lineTo(ex - u * h + v * h, ey - v * h - u * h);
    }
    c.stroke();
  }

  drawRoomLabels(lv, analysis) {
    const c = this.ctx;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    analysis.rooms.forEach((r, i) => {
      const info = lv.rooms[i]; if (!info) return;
      const p = this.toScreen(r.center);
      if (this.view.k < 0.07) return;
      // Le nom tient dans la pièce : plus petit, sur deux lignes, ou raccourci.
      const xs = r.poly.map((q) => q.x), ys = r.poly.map((q) => q.y), room = (Math.max(...xs) - Math.min(...xs)) * this.view.k - 10, tall = (Math.max(...ys) - Math.min(...ys)) * this.view.k;
      if (room < 24) return;
      let size = 12.5, lines = [info.name];
      const font = (s) => { c.font = `600 ${s}px ui-sans-serif, -apple-system, system-ui, sans-serif`; };
      font(size);
      while (size > 9 && c.measureText(info.name).width > room) font((size -= 0.5));
      if (c.measureText(info.name).width > room) {
        const cut = info.name.includes(', ') ? info.name.indexOf(', ') + 1 : info.name.lastIndexOf(' ', Math.ceil(info.name.length / 2) + 4);
        if (cut > 0) lines = [info.name.slice(0, cut).trim(), info.name.slice(cut).trim()];
        // Toujours trop large : le premier mot seul, sinon rien plutôt qu'un nom coupé.
        if (lines.some((l) => c.measureText(l).width > room)) { const w = info.name.split(/[ ,]/)[0]; if (c.measureText(w).width > room) return; lines = [w]; }
      }
      const lh = size + 2, top = p.y - 8 - ((lines.length - 1) * lh) / 2;
      c.fillStyle = INK;
      lines.forEach((l, k) => c.fillText(l, p.x, top + k * lh));
      c.font = '11.5px ui-sans-serif, -apple-system, system-ui, sans-serif';
      if (tall > 34 + lines.length * lh && c.measureText('00,0 m²').width < room) { c.fillStyle = SOFT; c.fillText(`${r.area.toFixed(1).replace('.', ',')} m²`, p.x, top + lines.length * lh + 2); }
    });
  }

  pill(text, x, y, color = ACCENT) {
    const c = this.ctx;
    c.font = '600 11.5px ui-sans-serif, -apple-system, system-ui, sans-serif';
    const w = c.measureText(text).width + 12;
    c.fillStyle = color; c.beginPath(); c.roundRect(x - w / 2, y - 10, w, 20, 10); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 0.5);
  }

  drawDimensions(lv) {
    const c = this.ctx, s = store.selection;
    if (this.view.k > 0.45) {
      c.font = '10.5px ui-sans-serif, -apple-system, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const w of lv.walls) {
        const a = lv.nodes[w.a], b = lv.nodes[w.b], L = dist(a, b);
        if (L < 60) continue;
        const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
        const mid = { x: (a.x + b.x) / 2 + nx * (w.thickness / 2 + 13 / this.view.k), y: (a.y + b.y) / 2 + ny * (w.thickness / 2 + 13 / this.view.k) };
        const p = this.toScreen(mid);
        let ang = Math.atan2(b.y - a.y, b.x - a.x); if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;
        c.save(); c.translate(p.x, p.y); c.rotate(ang);
        c.fillStyle = 'rgba(38,35,30,.62)'; c.fillText(`${(L / 100).toFixed(2).replace('.', ',')}`, 0, 0); c.restore();
      }
    }
    if (s?.type === 'wall') {
      const w = lv.walls.find((x) => x.id === s.id);
      if (w) { const a = lv.nodes[w.a], b = lv.nodes[w.b]; const p = this.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); this.pill(`${(dist(a, b) / 100).toFixed(2).replace('.', ',')} m`, p.x, p.y); }
    }
    const parcel = checkParcel(store.project);
    if (parcel && this.view.k > 0.08) {
      const pts = store.project.site.parcel.pts;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 11px ui-sans-serif, -apple-system, system-ui, sans-serif';
      pts.forEach((a, i) => {
        const b = pts[(i + 1) % pts.length], p = this.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        this.pill(`${i + 1} · ${metres(dist(a, b))}`, p.x, p.y, '#3f6b33');
      });
      for (const q of parcel.issues) { const p = this.toScreen({ x: (q.from.x + q.to.x) / 2, y: (q.from.y + q.to.y) / 2 }); this.pill(metres(Math.max(0, q.d)), p.x, p.y, '#c0392b'); }
    }
    if (this.drag?.type === 'group' && this.drag.delta) {
      const { dx, dy } = this.drag.delta, b = bounds(store.project, store.selection);
      const f = (v) => `${(Math.abs(v) / 100).toFixed(2).replace('.', ',')} m`;
      const txt = [dx ? `${dx > 0 ? '→' : '←'} ${f(dx)}` : '', dy ? `${dy > 0 ? '↓' : '↑'} ${f(dy)}` : ''].filter(Boolean).join('  ');
      if (b && txt) { const p = this.toScreen({ x: (b.x0 + b.x1) / 2, y: b.y0 }); this.pill(txt, p.x, Math.max(16, p.y - 24)); }
    }
    if (this.draft && this.hover) {
      const last = this.draft.pts.at(-1), p = this.toScreen({ x: (last.x + this.hover.x) / 2, y: (last.y + this.hover.y) / 2 });
      this.pill(`${(dist(last, this.hover) / 100).toFixed(2).replace('.', ',')} m`, p.x, p.y - 22);
    }
    if (this.drag?.type === 'room') {
      const { a, b } = this.drag, p = this.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const W = Math.abs(a.x - b.x) / 100, H = Math.abs(a.y - b.y) / 100;
      this.pill(`${W.toFixed(2).replace('.', ',')} × ${H.toFixed(2).replace('.', ',')} m · ${(W * H).toFixed(1).replace('.', ',')} m²`, p.x, p.y);
    }
    const m = this.drag?.type === 'measure' ? this.drag : this.measure;
    if (m) { const p = this.toScreen({ x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2 }); this.pill(`${(dist(m.a, m.b) / 100).toFixed(2).replace('.', ',')} m`, p.x, p.y - 16); }
    void polygonCentroid;
  }

  drawOverlayText() {
    const lv = store.level, c0 = this.ctx;
    // Flèche du nord, en bas à droite : elle suit l'orientation réglée dans Style.
    const n = ((store.project.site?.north || 0) * Math.PI) / 180, cx = this.w - 34, cy = this.h - 40;
    c0.save(); c0.translate(cx, cy); c0.rotate(n);
    c0.fillStyle = 'rgba(255,253,248,.85)'; c0.beginPath(); c0.arc(0, 0, 17, 0, 7); c0.fill();
    c0.fillStyle = ACCENT; c0.beginPath(); c0.moveTo(0, -13); c0.lineTo(6, 6); c0.lineTo(0, 2); c0.lineTo(-6, 6); c0.closePath(); c0.fill();
    c0.restore();
    c0.fillStyle = ACCENT; c0.font = '600 11px ui-sans-serif, -apple-system, system-ui, sans-serif'; c0.textAlign = 'center'; c0.textBaseline = 'middle';
    c0.fillText('N', cx + Math.sin(n) * 26, cy - Math.cos(n) * 26);
    if (Object.keys(lv.nodes).length) return;
    const c = this.ctx;
    c.fillStyle = SOFT; c.font = '15px ui-sans-serif, -apple-system, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Commence par tracer une pièce avec l’outil « Pièce »', this.w / 2, this.h / 2);
  }
}

function isSelected(hit) {
  const s = store.selection; if (!s) return false;
  if (hit.type === 'item') return s.type === 'item' && s.id === hit.item.id;
  if (hit.type === 'wall') return s.type === 'wall' && s.id === hit.wall.id;
  if (hit.type === 'opening') return s.type === 'opening' && s.id === hit.opening.id;
  if (hit.type === 'node') return s.type === 'node' && s.id === hit.id;
  return false;
}

function selectionOf(hit) {
  if (hit.type === 'item') return { type: 'item', id: hit.item.id };
  if (hit.type === 'wall') return { type: 'wall', id: hit.wall.id };
  if (hit.type === 'opening') return { type: 'opening', id: hit.opening.id, wallId: hit.wall.id };
  if (hit.type === 'node') return { type: 'node', id: hit.id };
  return { type: 'room', id: hit.room.id };
}

function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function cleanOrphans(lv) {
  const used = new Set(lv.walls.flatMap((w) => [w.a, w.b]));
  for (const id of Object.keys(lv.nodes)) if (!used.has(id)) delete lv.nodes[id];
}

function mergeNodes(lv, from, to) {
  for (const w of lv.walls) { if (w.a === from) w.a = to; if (w.b === from) w.b = to; }
  lv.walls = lv.walls.filter((w) => w.a !== w.b);
  delete lv.nodes[from];
}
