// État du projet : données, historique, sauvegarde locale.
import { analyzeLevel, pointInPolygon, dist } from './geometry.js';

let counter = 0;
export const uid = (p = 'i') => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

export const ROOM_TYPES = [
  ['salon', 'Salon', 'oak_natural', 'paint_blanc'], ['sejour', 'Séjour', 'oak_natural', 'paint_blanc'],
  ['cuisine', 'Cuisine', 'tile_grey_large', 'paint_blanc'], ['repas', 'Salle à manger', 'oak_natural', 'paint_blanc'],
  ['chambre', 'Chambre', 'oak_natural', 'paint_blanc'], ['parentale', 'Suite parentale', 'oak_natural', 'paint_blanc'],
  ['enfant', 'Chambre enfant', 'oak_natural', 'paint_blanc'], ['bureau', 'Bureau', 'oak_natural', 'paint_blanc'],
  ['sdb', 'Salle de bain', 'tile_marble', 'paint_blanc'], ['douche', "Salle d'eau", 'tile_marble', 'paint_blanc'],
  ['wc', 'WC', 'tile_grey_large', 'paint_blanc'], ['entree', 'Entrée', 'tile_terracotta', 'paint_blanc'],
  ['couloir', 'Couloir', 'oak_natural', 'paint_blanc'], ['cellier', 'Cellier', 'concrete_floor', 'paint_blanc'],
  ['buanderie', 'Buanderie', 'concrete_floor', 'paint_blanc'], ['dressing', 'Dressing', 'oak_natural', 'paint_blanc'],
  ['garage', 'Garage', 'concrete_floor', 'paint_blanc'], ['terrasse', 'Terrasse couverte', 'deck_wood', 'paint_blanc'],
  ['piece', 'Pièce', 'oak_natural', 'paint_blanc'],
];
export const roomType = (id) => ROOM_TYPES.find((r) => r[0] === id) || ROOM_TYPES[ROOM_TYPES.length - 1];

export function newLevel(name = 'Rez-de-chaussée', height = 260) {
  return { id: uid('L'), name, height, slab: 22, nodes: {}, walls: [], rooms: [], items: [], background: null };
}

export function newProject(name = 'Notre maison') {
  return {
    v: 1, id: uid('P'), name, updated: Date.now(),
    site: { lat: 43.93, lon: 2.15, north: 0, ground: 'grass', city: 'Albi' },
    style: { facade: 'facade_enduit', roof: 'roof_terracotta', joinery: '#3b3f43' },
    roof: { type: 'gable', pitch: 32, overhang: 45, ridge: 'auto' },
    levels: [newLevel()],
    custom: [],
    cameras: [],
  };
}

export function addNode(level, x, y, snap = 3) {
  for (const [id, n] of Object.entries(level.nodes)) if (dist(n, { x, y }) <= snap) return id;
  const id = uid('n');
  level.nodes[id] = { x, y };
  return id;
}

export function addWall(level, a, b, thickness, extra = {}) {
  if (a === b) return null;
  const dup = level.walls.find((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  if (dup) return dup;
  const w = { id: uid('w'), a, b, thickness, openings: [], ...extra };
  level.walls.push(w);
  return w;
}

/** Coupe un mur en un point et reporte les ouvertures sur les deux tronçons. */
export function splitWall(level, wall, x, y) {
  const a = level.nodes[wall.a], b = level.nodes[wall.b];
  const L = dist(a, b);
  const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const t = (x - a.x) * ux + (y - a.y) * uy;
  const id = addNode(level, a.x + ux * t, a.y + uy * t, 1);
  if (id === wall.a || id === wall.b) return id;
  const w2 = { ...wall, id: uid('w'), a: id, b: wall.b, openings: [] };
  const keep = [];
  for (const o of wall.openings) {
    if (o.t < t) keep.push(o);
    else w2.openings.push({ ...o, t: o.t - t });
  }
  wall.openings = keep;
  wall.b = id;
  level.walls.push(w2);
  return id;
}

/** Remet en cohérence la liste des pièces nommées après une modification des murs. */
export function syncRooms(level) {
  const analysis = analyzeLevel(level);
  const old = level.rooms || [];
  const used = new Set();
  const next = analysis.rooms.map((r) => {
    let seed = old.find((s) => !used.has(s) && pointInPolygon(s, r.poly));
    if (!seed) {
      let best = null, bestD = 150;
      for (const s of old) {
        if (used.has(s)) continue;
        const d = dist(s, r.center);
        if (d < bestD) { best = s; bestD = d; }
      }
      seed = best;
    }
    if (seed) used.add(seed);
    const type = seed?.type || 'piece';
    const rt = roomType(type);
    return {
      id: seed?.id || uid('r'), x: r.center.x, y: r.center.y, type,
      name: seed?.name || rt[1],
      floor: seed?.floor || rt[2], paint: seed?.paint || rt[3], ceiling: seed?.ceiling || 'paint_blanc',
      lightOn: seed?.lightOn ?? true,
    };
  });
  level.rooms = next;
  return analysis;
}

// ——— Stockage local (IndexedDB) ———
const DB = 'notre-maison';
function open() {
  return new Promise((res, rej) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => { q.result.createObjectStore('projects'); q.result.createObjectStore('renders'); q.result.createObjectStore('blobs'); };
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r?.result);
    t.onerror = () => rej(t.error);
  });
}
export const dbPut = (s, k, v) => tx(s, 'readwrite', (o) => o.put(v, k));
export const dbGet = async (s, k) => { const db = await open(); return new Promise((res, rej) => { const q = db.transaction(s).objectStore(s).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
export const dbDel = (s, k) => tx(s, 'readwrite', (o) => o.delete(k));
export const dbAll = async (s) => {
  const db = await open();
  return new Promise((res, rej) => {
    const q = db.transaction(s).objectStore(s).openCursor();
    const out = [];
    q.onsuccess = () => { const c = q.result; if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } else res(out); };
    q.onerror = () => rej(q.error);
  });
};

// ——— Magasin central ———
class Store extends EventTarget {
  project = null; levelIndex = 0; selection = null; undoStack = []; redoStack = [];
  saveTimer = null; analysisCache = new Map();

  get level() { return this.project.levels[this.levelIndex]; }

  load(p) {
    this.project = p;
    this.levelIndex = Math.min(this.levelIndex, p.levels.length - 1);
    this.undoStack = []; this.redoStack = []; this.selection = null;
    p.levels.forEach(syncRooms);
    this.emit('project');
    this.emit('change', { rebuild: true });
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  analysis(level = this.level) { return analyzeLevel(level); }

  /** Enregistre l'état AVANT une action, pour pouvoir l'annuler. */
  snapshot() {
    this.undoStack.push(JSON.stringify(this.project));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
  }

  commit(detail = { rebuild: true }) {
    this.project.levels.forEach(syncRooms);
    this.project.updated = Date.now();
    this.emit('change', detail);
    this.queueSave();
  }

  mutate(fn, detail) { this.snapshot(); fn(this.project, this.level); this.commit(detail); }

  queueSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 500);
  }
  async save() {
    try {
      await dbPut('projects', this.project.id, JSON.parse(JSON.stringify(this.project)));
      localStorage.setItem('nm-current', this.project.id);
      this.emit('saved');
    } catch (e) { console.error('Sauvegarde impossible', e); this.emit('save-error', e); }
  }

  undo() { if (!this.undoStack.length) return; this.redoStack.push(JSON.stringify(this.project)); this.restore(this.undoStack.pop()); }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(JSON.stringify(this.project)); this.restore(this.redoStack.pop()); }
  restore(json) {
    this.project = JSON.parse(json);
    this.levelIndex = Math.min(this.levelIndex, this.project.levels.length - 1);
    this.selection = null;
    this.emit('select');
    this.emit('project');
    this.commit();
  }

  select(sel) { this.selection = sel; this.emit('select'); }
  setLevel(i) { this.levelIndex = i; this.selection = null; this.emit('select'); this.emit('level'); }
}

export const store = new Store();
