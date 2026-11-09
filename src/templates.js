// Maisons de départ, modifiables.
import { newProject, newLevel, addNode, addWall, uid, syncRooms, store } from './state.js';
import { allItems, getItem } from './catalog.js';
import { ensureTerrain, commitTerrain, shapeTerrain, T_N } from './terrain.js';
import { GROUNDS } from './materials-data.js';

const GROUND_GRAVEL = GROUNDS.findIndex((g) => g.id === 'gravel');

function rect(lv, x0, y0, x1, y1, t = 25) {
  const ids = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => addNode(lv, x, y));
  return ids.map((id, i) => addWall(lv, id, ids[(i + 1) % 4], t));
}

function wallLine(lv, x0, y0, x1, y1, t = 10) {
  // Découpe en tronçons sur les nœuds existants pour conserver un graphe propre.
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const stops = [[0, x0, y0], [L, x1, y1]];
  for (const n of Object.values(lv.nodes)) {
    const s = ((n.x - x0) * dx + (n.y - y0) * dy) / L;
    const d = Math.abs((n.x - x0) * dy - (n.y - y0) * dx) / L;
    if (d < 1 && s > 1 && s < L - 1) stops.push([s, n.x, n.y]);
  }
  stops.sort((a, b) => a[0] - b[0]);
  const walls = [];
  for (let i = 0; i < stops.length - 1; i++) walls.push(addWall(lv, addNode(lv, stops[i][1], stops[i][2]), addNode(lv, stops[i + 1][1], stops[i + 1][2]), t));
  return walls;
}

/** Insère un nœud sur les murs traversés, pour que les cloisons s'accrochent aux murs porteurs. */
function splitAt(lv, x, y) {
  for (const w of [...lv.walls]) {
    const a = lv.nodes[w.a], b = lv.nodes[w.b], L = Math.hypot(b.x - a.x, b.y - a.y);
    const s = ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / L;
    const d = Math.abs((x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x)) / L;
    if (d < 1 && s > 1 && s < L - 1) {
      const id = addNode(lv, x, y, 1);
      const w2 = { ...w, id: uid('w'), a: id, b: w.b, openings: w.openings.filter((o) => o.t >= s).map((o) => ({ ...o, t: o.t - s })) };
      w.openings = w.openings.filter((o) => o.t < s);
      w.b = id;
      lv.walls.push(w2);
      return id;
    }
  }
  return addNode(lv, x, y, 1);
}

function partition(lv, x0, y0, x1, y1, t = 10) {
  splitAt(lv, x0, y0); splitAt(lv, x1, y1);
  return wallLine(lv, x0, y0, x1, y1, t);
}

/** Pose une ouverture sur le mur qui passe par (x, y). */
function open(lv, x, y, type, width, height, sill, extra = {}) {
  for (const w of lv.walls) {
    const a = lv.nodes[w.a], b = lv.nodes[w.b], L = Math.hypot(b.x - a.x, b.y - a.y);
    const t = ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / L;
    const d = Math.abs((x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x)) / L;
    if (d < 2 && t > width / 2 && t < L - width / 2) { w.openings.push({ id: uid('o'), type, width, height, sill, t, open: type === 'door' ? 25 : 0, ...extra }); return; }
  }
  console.warn('Ouverture non posée', x, y, type, width);
}

function setRoom(lv, x, y, type, name, patch = {}) {
  const a = syncRooms(lv);
  a.rooms.forEach((r, i) => {
    let inside = false;
    const poly = r.poly;
    for (let m = 0, n = poly.length - 1; m < poly.length; n = m++) {
      if ((poly[m].y > y) !== (poly[n].y > y) && x < ((poly[n].x - poly[m].x) * (y - poly[m].y)) / (poly[n].y - poly[m].y) + poly[m].x) inside = !inside;
    }
    if (inside) Object.assign(lv.rooms[i], { type, name }, patch);
  });
}

function find(sub, pred = () => true) { return allItems().find((i) => i.sub === sub && pred(i)); }
function place(lv, def, x, y, rot = 0, extra = {}) { if (def) lv.items.push({ id: uid('it'), cat: def.id, x, y, rot, ...extra }); }

function houseSinglestorey() {
  const p = newProject('Plain-pied lumineux');
  const lv = p.levels[0];
  rect(lv, 0, 0, 1400, 900);
  partition(lv, 800, 0, 800, 520);
  partition(lv, 800, 520, 1400, 520);
  partition(lv, 1100, 0, 1100, 520);
  partition(lv, 0, 560, 480, 560);
  partition(lv, 480, 560, 480, 900);
  partition(lv, 480, 700, 800, 700);
  partition(lv, 800, 520, 800, 900);
  partition(lv, 640, 700, 640, 900);

  open(lv, 400, 0, 'bay', 320, 215, 0);
  open(lv, 0, 300, 'window2', 140, 215, 0);
  open(lv, 950, 0, 'window2', 120, 135, 90);
  open(lv, 1250, 0, 'window2', 120, 135, 90);
  open(lv, 1400, 700, 'window2', 120, 135, 90);
  open(lv, 1100, 900, 'window2', 120, 135, 90);
  open(lv, 240, 900, 'window2', 120, 135, 90);
  open(lv, 0, 730, 'window1', 60, 115, 100);
  open(lv, 560, 900, 'window1', 60, 75, 150);
  open(lv, 730, 900, 'entry', 100, 215, 0);
  open(lv, 480, 630, 'door', 83, 204, 0);
  open(lv, 560, 700, 'door', 73, 204, 0);
  open(lv, 800, 610, 'door', 83, 204, 0);
  open(lv, 950, 520, 'door', 83, 204, 0);
  open(lv, 1250, 520, 'door', 83, 204, 0);

  setRoom(lv, 300, 300, 'sejour', 'Séjour-cuisine', { floor: 'oak_natural', paint: 'paint_wimborne' });
  setRoom(lv, 950, 250, 'chambre', 'Chambre 2');
  setRoom(lv, 1250, 250, 'chambre', 'Chambre 3');
  setRoom(lv, 1100, 700, 'parentale', 'Suite parentale', { paint: 'paint_skimming' });
  setRoom(lv, 240, 730, 'sdb', 'Salle de bain', { floor: 'tile_marble' });
  setRoom(lv, 560, 800, 'wc', 'WC', { floor: 'tile_grey_large' });
  setRoom(lv, 720, 800, 'entree', 'Entrée', { floor: 'tile_terracotta' });

  const sofa = getItem('b-maisons-du-monde-wallas') || find('canape');
  place(lv, sofa, 400, 400, 180);
  place(lv, getItem('b-maisons-du-monde-ratane') || find('table-basse'), 400, 265, 0);
  place(lv, find('tapis', (i) => i.w >= 190), 400, 310, 0);
  place(lv, find('meuble-tv', (i) => i.h < 80), 400, 40, 0);
  place(lv, getItem('g-tv-t-l-viseur-55-pouces'), 400, 40, 0, { z: 56 });
  const table = getItem('b-maisons-du-monde-rhonda') || find('table');
  const chair = getItem('b-maisons-du-monde-esta') || find('chaise');
  place(lv, table, 640, 320, 0);
  for (const [dx, dy, r] of [[-105, 0, 270], [105, 0, 90], [0, -105, 0], [0, 105, 180]]) place(lv, chair, 640 + dx, 320 + dy, r);
  place(lv, getItem('b-maisons-du-monde-born-o'), 765, 90, 270);
  place(lv, getItem('g-deco-grande-plante-en-pot') || find('plante'), 60, 60);
  place(lv, find('suspension'), 640, 320);
  place(lv, find('lampadaire'), 170, 480);

  const bed = find('lit', (i) => i.w >= 160 && i.w < 185);
  place(lv, bed, 1100, 618, 0);
  place(lv, find('chevet'), 980, 555, 0); place(lv, find('chevet'), 1220, 555, 0);
  place(lv, find('armoire', (i) => i.w >= 100), 880, 840, 180);
  place(lv, bed, 950, 120, 0);
  place(lv, find('commode'), 950, 490, 180);
  place(lv, find('bureau'), 1250, 60, 0);
  place(lv, find('lit', (i) => i.w < 150) || bed, 1300, 400, 180);

  place(lv, getItem('g-baignoire-baignoire-acrylique-170-75'), 95, 610, 0);
  place(lv, find('meuble-vasque'), 340, 860, 180);
  place(lv, getItem('g-wc-wc-suspendu-avec-b-ti-support'), 560, 860, 180);

  // Jardin : ce qu'on voit par les fenêtres compte autant que l'intérieur.
  place(lv, getItem('g-terrasse-terrasse-bois'), 400, -170);
  for (const [x, y] of [[-420, -520], [260, -880], [1120, -640], [1800, 120], [1760, 880], [-620, 620], [420, 1420], [1240, 1320]]) place(lv, getItem('g-plantation-arbre'), x, y, x % 90);
  for (const x of [-300, 0, 300, 600, 900, 1200, 1500]) place(lv, getItem('g-plantation-haie-3-m-'), x, -760);
  for (const y of [-540, -240, 60, 360, 660, 960]) place(lv, getItem('g-plantation-haie-3-m-'), -640, y, 90);
  place(lv, find('rideau', (i) => i.w < 200), 90, 22, 0);
  place(lv, find('rideau', (i) => i.w < 200), 710, 22, 0);
  return p;
}

function houseTwoStorey() {
  const p = newProject('Maison à étage');
  p.roof.pitch = 35;
  const rdc = p.levels[0];
  rect(rdc, 0, 0, 1100, 800);
  partition(rdc, 700, 0, 700, 800);
  partition(rdc, 700, 450, 1100, 450);
  partition(rdc, 900, 450, 900, 800);
  open(rdc, 350, 0, 'bay', 320, 215, 0);
  open(rdc, 900, 0, 'window2', 120, 135, 90);
  open(rdc, 300, 800, 'entry', 100, 215, 0);
  open(rdc, 0, 400, 'window2', 140, 215, 0);
  open(rdc, 1100, 650, 'window1', 60, 75, 150);
  open(rdc, 1100, 250, 'window2', 120, 135, 90);
  open(rdc, 700, 620, 'door', 83, 204, 0);
  open(rdc, 800, 450, 'door', 83, 204, 0);
  open(rdc, 900, 620, 'door', 73, 204, 0);
  setRoom(rdc, 300, 300, 'sejour', 'Pièce de vie');
  setRoom(rdc, 900, 200, 'cuisine', 'Cuisine', { floor: 'tile_grey_large' });
  setRoom(rdc, 800, 620, 'buanderie', 'Cellier');
  setRoom(rdc, 1000, 620, 'wc', 'WC');
  place(rdc, getItem('g-escalier-escalier-droit-2-80-m-'), 640, 620, 0);
  place(rdc, find('canape', (i) => /3 places/.test(i.label)) || find('canape'), 320, 420, 0);
  place(rdc, find('table-basse'), 320, 290, 0);

  const up = newLevel('Étage', 250);
  rect(up, 0, 0, 1100, 800);
  partition(up, 700, 0, 700, 800);
  partition(up, 0, 400, 590, 400);
  partition(up, 700, 450, 1100, 450);
  open(up, 300, 0, 'window2', 140, 135, 90);
  open(up, 300, 800, 'window2', 140, 135, 90);
  open(up, 900, 0, 'window2', 120, 135, 90);
  open(up, 900, 800, 'window1', 60, 75, 150);
  open(up, 500, 400, 'door', 83, 204, 0);
  open(up, 700, 200, 'door', 83, 204, 0);
  setRoom(up, 300, 200, 'parentale', 'Chambre parentale');
  setRoom(up, 300, 600, 'chambre', 'Chambre');
  setRoom(up, 900, 225, 'chambre', 'Chambre');
  setRoom(up, 900, 620, 'sdb', 'Salle de bain', { floor: 'tile_marble' });
  p.levels.push(up);
  return p;
}

/** Maison à flanc de colline : on entre en haut, les chambres sont en dessous et regardent la vallée. */
function houseHillside() {
  const p = newProject('Maison sur la colline');
  p.roof.type = 'mono'; p.roof.pitch = 8; p.style.facade = 'facade_enduit'; p.site.env = 'campagne';
  const top = p.levels[0];
  top.name = 'Rez-de-chaussée';
  rect(top, 0, 0, 1200, 800);
  partition(top, 600, 0, 600, 800);
  partition(top, 0, 300, 600, 300);
  open(top, 300, 0, 'entry', 110, 225, 0, { name: "Porte d'entrée" });
  open(top, 900, 800, 'bay', 500, 240, 0, { name: 'Grande baie 5 m' });
  open(top, 300, 800, 'bay', 300, 240, 0, { name: 'Baie 3 m' });
  open(top, 1200, 400, 'bay', 300, 240, 0, { name: 'Baie 3 m' });
  open(top, 900, 0, 'window2', 120, 135, 90);
  open(top, 600, 550, 'passage', 240, 225, 0, { name: 'Grand passage' });
  open(top, 530, 300, 'door', 93, 204, 0);
  setRoom(top, 300, 150, 'entree', 'Entrée', { floor: 'tile_terracotta' });
  setRoom(top, 300, 550, 'cuisine', 'Cuisine', { floor: 'oak_natural' });
  setRoom(top, 900, 400, 'salon', 'Salon', { floor: 'oak_natural', paint: 'paint_wimborne' });
  place(top, getItem('b-maisons-du-monde-wallas') || find('canape'), 900, 480, 0);
  place(top, find('tapis', (i) => i.w >= 190), 900, 610, 0);
  place(top, getItem('b-maisons-du-monde-ratane') || find('table-basse'), 900, 610, 0);
  place(top, getItem('g-ilot--lot-central-180-90'), 300, 560, 0);
  for (let i = 0; i < 4; i++) place(top, getItem('g-meuble-meuble-bas-60-cm'), 60 + i * 60, 345, 0);
  place(top, getItem('g-electro-r-frig-rateur-combin-60-cm'), 320, 345, 0);
  place(top, getItem('g-electro-lave-vaisselle-60-cm'), 380, 345, 0);
  place(top, getItem('g-electro-plaque-induction-60-cm'), 120, 345, 0, { z: 88 });
  place(top, getItem('g-electro-hotte-murale-60-cm'), 120, 335, 0);
  place(top, find('suspension'), 300, 560);
  place(top, getItem('g-balcon-balcon-garde-corps-verre-4-m') , 900, 890, 0, { w: 560, d: 150 });

  const low = newLevel('Rez-de-jardin', 250);
  rect(low, 0, 0, 1200, 800);
  partition(low, 0, 300, 1200, 300);
  partition(low, 400, 300, 400, 800);
  partition(low, 800, 300, 800, 800);
  partition(low, 800, 0, 800, 300);
  open(low, 200, 800, 'bay', 300, 235, 0, { name: 'Baie 3 m' });
  open(low, 600, 800, 'bay', 300, 235, 0, { name: 'Baie 3 m' });
  open(low, 1000, 800, 'bay', 300, 235, 0, { name: 'Baie 3 m' });
  open(low, 200, 300, 'door', 83, 204, 0); open(low, 600, 300, 'door', 83, 204, 0); open(low, 1000, 300, 'door', 83, 204, 0); open(low, 800, 150, 'door', 83, 204, 0);
  setRoom(low, 400, 150, 'couloir', 'Dégagement');
  setRoom(low, 1000, 150, 'sdb', 'Salle de bain', { floor: 'tile_marble' });
  setRoom(low, 200, 550, 'parentale', 'Suite parentale', { paint: 'paint_skimming' });
  setRoom(low, 600, 550, 'chambre', 'Chambre 2');
  setRoom(low, 1000, 550, 'chambre', 'Chambre 3');
  const bed = find('lit', (i) => i.w >= 160 && i.w < 185);
  place(low, bed, 200, 415, 0); place(low, bed, 600, 415, 0); place(low, find('lit', (i) => i.w < 150) || bed, 1000, 415, 0);
  place(low, getItem('g-douche-douche-l-italienne-120-80'), 1100, 60, 0);
  place(low, find('meuble-vasque'), 950, 40, 0);
  place(low, getItem('g-wc-wc-suspendu-avec-b-ti-support'), 860, 260, 180);
  place(low, getItem('g-escalier-escalier-sans-contremarche'), 300, 150, 90);

  p.levels.unshift(low);
  p.entry = 1;
  syncRooms(top); syncRooms(low);

  // Pente vers le sud : au nord on entre de plain-pied, au sud le niveau du bas s'ouvre sur le paysage.
  shapeTerrain(p, 'slope', { dir: 180, pct: 34 });
  const m = ensureTerrain(p), half = (T_N - 1) / 2;
  p.site.terrain.cx = 600; p.site.terrain.cy = 0; m.cx = 600; m.cy = 0;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const y = j - half, base = -y * 0.34 + (Math.sin(i * 0.11) * 0.25);
    // Jardin plat devant les chambres, puis la colline reprend.
    let v = base;
    if (y > 8) v = -2.72 - Math.max(0, y - 16) * 0.3;
    else if (y > 7.2) v = -2.72 + (8 - y) * 0.2;
    m.h[j * T_N + i] = Math.round(v * 100);
  }
  commitTerrain(p);
  p.site.altitude = 0;
  for (const [x, y] of [[-900, 2400], [2100, 2100], [-400, 3400], [1500, 3200], [-1600, -700], [2600, -500]]) place(top, getItem('g-plantation-arbre'), x, y, 0);
  return p;
}


const smooth01 = (t) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };

/** Revêt les murs d'une pièce ; `side` limite à un côté : n, s, e ou o. */
function clad(lv, x, y, mat, sides = 'nseo') {
  const a = syncRooms(lv);
  const i = a.rooms.findIndex((r) => {
    let inside = false;
    for (let m = 0, n = r.poly.length - 1; m < r.poly.length; n = m++) if ((r.poly[m].y > y) !== (r.poly[n].y > y) && x < ((r.poly[n].x - r.poly[m].x) * (y - r.poly[m].y)) / (r.poly[n].y - r.poly[m].y) + r.poly[m].x) inside = !inside;
    return inside;
  });
  if (i < 0) return;
  for (const w of lv.walls) for (const side of ['L', 'R']) {
    if (a.sideRoom.get(`${w.id}:${side}`) !== i) continue;
    const A = lv.nodes[w.a], B = lv.nodes[w.b], mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const dir = Math.abs(A.x - B.x) > Math.abs(A.y - B.y) ? (my < y ? 'n' : 's') : (mx < x ? 'o' : 'e');
    if (sides.includes(dir)) w[`mat${side}`] = mat;
  }
}

const ANGLAISE = { name: 'Fenêtre anglaise', muntins: [2, 4] };
const HAUTE_ANGLAISE = { name: 'Haute fenêtre anglaise', muntins: [3, 10] };
const PORTE_ANGLAISE = { name: 'Porte-fenêtre anglaise', muntins: [2, 5] };
const BAIE_ANGLAISE = { name: 'Grande baie anglaise', muntins: [2, 5] };

/** Choisit dans le catalogue, en préférant les modèles qui collent au style des photos. */
function pick(sub, words, test = () => true) {
  const list = allItems().filter((i) => i.sub === sub && test(i));
  for (const w of words) { const hit = list.find((i) => new RegExp(w, 'i').test(`${i.name}`) && i.brand !== 'IKEA'); if (hit) return hit; }
  return list[0];
}
const named = (name) => allItems().find((i) => i.name === name);

/** Paire de rideaux de part et d'autre d'une fenêtre. `side` : mur n, s, e ou o, vu depuis la pièce. */
function drapes(lv, def, x, y, side, width, height, color) {
  if (!def) return;
  const rot = { n: 0, s: 180, e: 90, o: 270 }[side], along = side === 'n' || side === 's', off = 30, inset = { n: 24, s: -24, e: -24, o: 24 }[side], w = 80;
  for (const k of [-1, 1]) place(lv, def, along ? x + k * (width / 2 + off) : x + inset, along ? y + inset : y + k * (width / 2 + off), rot, { w, h: height, color });
}

export function boxOf(lv, name) {
  const a = syncRooms(lv), i = lv.rooms.findIndex((r) => r.name === name), poly = a.rooms[i].poly, xs = poly.map((q) => q.x), ys = poly.map((q) => q.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
export const facing = (n) => (((Math.atan2(-n.x, n.y) * 180) / Math.PI) + 360) % 360;
const spanMid = (s) => ({ x: (s.ax + s.bx) / 2, y: (s.ay + s.by) / 2 });

function roomWalls(lv, name) {
  const a = syncRooms(lv), i = lv.rooms.findIndex((r) => r.name === name), c = a.rooms[i].center, out = [];
  for (const w of lv.walls) for (const s of ['L', 'R']) {
    if (a.sideRoom.get(`${w.id}:${s}`) !== i) continue;
    const A = lv.nodes[w.a], B = lv.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
    let n = { x: -uy, y: ux }; if (s === 'R') n = { x: -n.x, y: -n.y };
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, side = Math.abs(ux) > Math.abs(uy) ? (my < c.y ? 'n' : 's') : (mx < c.x ? 'o' : 'e');
    out.push({ w, A, L, ux, uy, n, side });
  }
  return out;
}

/** Pans de mur libres d'une pièce sur un côté, du plus large au plus étroit. */
function spansOf(lv, name, side, margin = 16) {
  const spans = [];
  for (const { w, A, L, ux, uy, n, side: s } of roomWalls(lv, name)) {
    if (s !== side) continue;
    const cuts = w.openings.map((o) => [o.t - o.width / 2 - margin, o.t + o.width / 2 + margin]).sort((p, q) => p[0] - q[0]);
    let from = 22;
    for (const [c0, c1] of [...cuts, [L - 22, L]]) { if (c0 - from > 40) spans.push({ ax: A.x + ux * from, ay: A.y + uy * from, bx: A.x + ux * c0, by: A.y + uy * c0, len: c0 - from, n, t: w.thickness / 2 }); from = Math.max(from, c1); }
  }
  return spans.sort((p, q) => q.len - p.len);
}

export function windowsOf(lv, name, all = false) {
  const out = [];
  for (const { w, A, ux, uy, n } of roomWalls(lv, name)) for (const o of w.openings) {
    if (!['window2', 'bay', 'fixed'].includes(o.type) || (!all && (o.sill > 90 || o.width < 100))) continue;
    out.push({ x: A.x + ux * o.t, y: A.y + uy * o.t, n, t: w.thickness / 2, w: o.width, sill: o.sill, top: o.sill + o.height + 24 });
  }
  return out;
}

/** Écarte tout ce qui se trouve au-delà d'une ligne : murs, ouvertures, meubles, toits. */
function stretch(p, axis, at, delta) {
  const K = axis, past = (v) => v > at;
  for (const lv of p.levels) {
    const spots = lv.walls.map((w) => { const a = lv.nodes[w.a], b = lv.nodes[w.b], L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return w.openings.map((o) => ({ o, x: a.x + ((b.x - a.x) * o.t) / L, y: a.y + ((b.y - a.y) * o.t) / L })); });
    for (const n of Object.values(lv.nodes)) if (past(n[K])) n[K] += delta;
    lv.walls.forEach((w, i) => { const a = lv.nodes[w.a]; spots[i].forEach((s) => { if (past(s[K])) s[K] += delta; s.o.t = Math.hypot(s.x - a.x, s.y - a.y); }); });
    for (const it of lv.items) {
      const def = getItem(it.cat), half = (K === 'x' ? it.w ?? def?.w : it.d ?? def?.d) / 2;
      if (def?.name === 'Terrasse pierre' && it[K] - half < at && it[K] + half > at) { if (K === 'x') it.w += delta; else it.d += delta; it[K] += delta / 2; }
      else if (past(it[K])) it[K] += delta;
    }
    for (const r of lv.rooms) if (past(r[K])) r[K] += delta;
  }
  for (const z of p.roofs || []) { const lo = `${K}0`, hi = `${K}1`; if (z[lo] > at) z[lo] += delta; if (z[hi] > at) z[hi] += delta; }
}

/** Grande maison à l'américaine. Le nord (haut du plan) est l'arrivée, le sud le jardin. */
function houseManor() {
  const p = newProject('Maison anglaise');
  p.style = { facade: 'facade_pierre_blonde', roof: 'roof_ardoise', joinery: '#1c1d1f' };
  p.roof = { type: 'none', pitch: 45, overhang: 35, ridge: 'auto' };
  p.site.env = 'campagne';
  const G_ = (id) => getItem(id);
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });
  const arch = (lv, x, y, w, h) => open(lv, x, y, 'arch', w, h, 0, { name: 'Arche' });

  // ——— Rez-de-chaussée ———
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 335; g.slab = 30;
  outline(g, [[750, 0], [2150, 0], [2150, -210], [2950, -210], [2950, 440], [3200, 440], [3200, 1180], [2800, 1180], [2800, 1100], [1350, 1100], [1350, 900], [750, 900], [750, 1200], [0, 1200], [0, 300], [750, 300]], 35);
  partition(g, 750, 300, 750, 900, 15); partition(g, 750, 250, 940, 250, 12); partition(g, 1160, 250, 1350, 250, 12); partition(g, 940, 0, 940, 250, 12); partition(g, 1160, 0, 1160, 250, 12);
  partition(g, 1350, 0, 1350, 900, 15); partition(g, 1850, 0, 1850, 440, 12); partition(g, 2150, 0, 2150, 440, 20); partition(g, 1350, 440, 2950, 440, 15); partition(g, 1350, 570, 2800, 570, 15); partition(g, 2800, 440, 2800, 1100, 15); partition(g, 1900, 570, 1900, 1100, 15); partition(g, 2500, 570, 2500, 1100, 15);

  // Arrivée.
  open(g, 1050, 0, 'entry', 180, 260, 0, { name: "Porte d'entrée double", leaves: 2, glazed: true });
  open(g, 825, 0, 'window2', 90, 150, 90, ANGLAISE); open(g, 1240, 0, 'window1', 60, 90, 130, { name: 'Petite fenêtre' });
  open(g, 845, 250, 'door', 83, 215, 0); open(g, 1215, 250, 'door', 73, 215, 0);
  // Les pièces de vie communiquent par de grandes arches.
  arch(g, 750, 480, 280, 320); arch(g, 1350, 495, 84, 250); arch(g, 1350, 760, 240, 315); arch(g, 1900, 850, 300, 315); arch(g, 2500, 1025, 120, 250);
  open(g, 1035, 900, 'fixed', 420, 90, 225, { name: 'Imposte', muntins: [3, 2] });
  open(g, 0, 400, 'window2', 150, 540, 40, HAUTE_ANGLAISE); open(g, 0, 1100, 'window2', 150, 540, 40, HAUTE_ANGLAISE); open(g, 325, 1200, 'bay', 560, 420, 0, BAIE_ANGLAISE); open(g, 200, 300, 'window2', 180, 460, 50, HAUTE_ANGLAISE); open(g, 550, 300, 'window2', 180, 460, 50, HAUTE_ANGLAISE); open(g, 750, 1050, 'window2', 180, 420, 40, HAUTE_ANGLAISE);
  open(g, 1675, 1100, 'bay', 380, 265, 0, { ...BAIE_ANGLAISE, opened: true }); open(g, 2130, 1100, 'bay', 340, 115, 105, { name: 'Passe-plat ouvert sur la terrasse', muntins: [1, 1] }); open(g, 2410, 1100, 'window2', 120, 250, 0, { name: 'Porte-fenêtre', muntins: [1, 5] }); open(g, 2650, 1100, 'window2', 120, 130, 110, ANGLAISE);
  // Pièces fermées.
  open(g, 1350, 345, 'double', 160, 230, 0, { name: 'Double porte' }); open(g, 1550, 0, 'window2', 280, 220, 50, ANGLAISE); open(g, 1850, 220, 'door', 83, 215, 0); open(g, 2000, 0, 'window2', 100, 130, 110, ANGLAISE); open(g, 2000, 440, 'door', 83, 215, 0);
  open(g, 2550, 440, 'door', 93, 215, 0); open(g, 2600, 570, 'door', 83, 215, 0); open(g, 2800, 495, 'door', 84, 215, 0);
  open(g, 2970, 1180, 'window2', 280, 265, 0, PORTE_ANGLAISE); open(g, 3200, 800, 'window2', 320, 240, 30, ANGLAISE); open(g, 3105, 440, 'window2', 130, 120, 120, ANGLAISE);
  for (const x of [2350, 2750]) open(g, x, -210, 'garage', 300, 235, 0, { name: 'Porte de garage' });

  const oak = 'oak_light', stone = 'dalle_pierre', warm = 'paint_wimborne', lin = 'paint_lin';
  setRoom(g, 375, 750, 'salon', 'Grand salon', { floor: 'oak_natural', paint: warm });
  setRoom(g, 845, 125, 'dressing', 'Penderie', { floor: oak, paint: 'wall_noyer' });
  setRoom(g, 1255, 125, 'wc', 'WC', { floor: 'marble', paint: 'wall_noyer', moulding: 'panels' });
  setRoom(g, 1050, 500, 'entree', 'Hall', { floor: 'herringbone', paint: warm, moulding: 'panels' });
  setRoom(g, 2000, 505, 'couloir', 'Couloir', { floor: 'oak_natural', paint: warm, moulding: 'panels' });
  setRoom(g, 1625, 835, 'repas', 'Salle à manger', { floor: 'oak_natural', paint: 'paint_skimming', moulding: 'panels' });
  setRoom(g, 2200, 835, 'cuisine', 'Cuisine', { floor: 'oak_natural', paint: 'paint_wimborne', moulding: 'crown' });
  setRoom(g, 2650, 835, 'buanderie', 'Arrière-cuisine', { floor: stone, paint: 'wall_bois' });
  setRoom(g, 1600, 220, 'bureau', 'Bureau, jeux ou chambre', { floor: oak, paint: 'paint_green_smoke', moulding: 'panels' });
  setRoom(g, 2000, 220, 'douche', "Salle d'eau", { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(g, 3000, 800, 'piece', 'Salle de sport', { floor: oak, paint: 'wall_bois' });
  setRoom(g, 2550, 115, 'garage', 'Garage', { floor: 'concrete_floor', paint: 'paint_skimming' });
  clad(g, 375, 750, 'wall_pierre_blonde', 'o');

  // ——— Mobilier et décoration ———
  const N = named, sofa = pick('canape', ['bouclé.*(pablian|shirina|eracli)', 'bouclé', 'lin', 'chenille'], (i) => i.w >= 200 && i.w <= 290 && i.d <= 110);
  const arm = pick('fauteuil', ['bouclé', 'noyer', 'velours']), arm2 = pick('fauteuil', ['bois', 'teck', 'cannage', 'cuir']) || arm, rug = pick('tapis', ['laine', 'jute', 'sisal'], (i) => Math.max(i.w, i.d) >= 220);
  const low = pick('table-basse', ['noyer', 'bois foncé'], (i) => i.w >= 100), side = pick('table-basse', ['appoint', 'rond', 'bois'], (i) => i.w <= 70), buffet = N('Buffet noyer à portes cintrées');
  const lamp = pick('lampe', ['céramique', 'lin']), plant = pick('plante', ['ficus', 'plante']), curtain = pick('rideau', ['']), ring = N('Lustre couronne noir'), chevet = pick('chevet', ['noyer', 'bois foncé', 'manguier']), bench = pick('rangement', ['banc']);
  const bed = pick('lit', ['velours', 'bouclé', 'tissu'], (i) => i.w >= 175 && i.w <= 215) || pick('lit', [], (i) => i.w >= 155), wc = G_('g-wc-wc-suspendu-avec-b-ti-support'), shower = G_('g-douche-douche-l-italienne-140-90'), mirror = pick('miroir', ['bois', 'dor']);
  const chair = pick('chaise', ['cannage', 'rotin', 'chêne']), stool = pick('tabouret', ['bois', 'cannage', 'tissu']), dome = N('Suspension dôme en laiton'), vase = N('Vase et branches feuillues'), cush = N('Série de coussins'), books = N('Bibliothèque sur mesure jusqu’au plafond'), sconce_ = N('Applique laiton'), cream = '#e8dfcf', bronze = '#4a3426', top = (d) => d?.h ?? 75;
  const art = (lv, x, y, name, rot, w, h, z) => place(lv, N(name), x, y, rot, { w, h, z });
  const INK = 'Grand tableau encre sur toile', TAP = 'Tapisserie de forêt', EARTH = 'Grande toile terre et ocre';
  const pillows = (lv, x, y, rot, w, colors) => place(lv, cush, x, y, rot, { w, z: 44, ...(colors ? {} : {}) });

  // Entrée et penderie.
  place(g, N('Dressing sur mesure en noyer'), 845, 40, 0, { w: 170, h: 280, d: 55 }); place(g, N('Vasque monobloc en marbre'), 1240, 32, 0, { w: 120 }); place(g, wc, 1320, 150, 90);
  // Hall : grand escalier, bibliothèques de part et d'autre de la porte-fenêtre, fauteuils au fond.
  // Arrière-cuisine et buanderie, reliées à la cuisine.
  place(g, G_('g-electro-lave-linge-60-cm'), 2760, 605, 90); place(g, G_('g-electro-s-che-linge-60-cm'), 2760, 725, 90); place(g, N('Linéaire noyer et marbre'), 2755, 860, 90, { w: 200 }); place(g, books, 2525, 720, 270, { w: 120, h: 280 }); place(g, plant, 2740, 1060, 0);
  // Pièce modulable, salle d'eau, sport, garage.
  place(g, books, 1372, 105, 270, { w: 150, h: 280 }); place(g, rug, 1550, 220, 0, { w: 300, d: 220 }); place(g, N('Table en noyer massif'), 1550, 90, 0, { w: 200, d: 85 }); place(g, pick('siege', ['cuir', 'tissu']), 1550, 150, 180);
  place(g, sofa, 1550, 372, 180); pillows(g, 1550, 395, 180, 180);
  place(g, shower, 2070, 75, 0); place(g, N('Double vasque noyer et pierre'), 2112, 260, 90, { w: 150 }); place(g, wc, 1890, 80, 270);
  place(g, G_('g-sport-rangement-halt-res'), 3050, 480, 0, { w: 220 }); place(g, G_('g-sport-banc-de-musculation-r-glable'), 2960, 830, 0); place(g, G_('g-sport-tapis-de-course'), 3110, 650, 0); place(g, rug, 3000, 830, 0, { w: 240, d: 300, color: '#3a3733' });
  place(g, N('Ferrari rouge'), 2350, 110, 180); place(g, N('Porsche 911 marron'), 2750, 110, 180);
  for (const x of [2350, 2520, 2750]) place(g, N('Suspension dôme en laiton'), x, 110, 0, { h: 80 });

  // ——— Dehors ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), slab = G_('g-terrasse-terrasse-pierre'), hedge = allItems().find((i) => i.name === 'Haie (3 m)'), ball = N('Buis taillé en boule'), post = N('Poteau en pierre'), pine = N('Pin parasol'), cyp = N('Cyprès'), oakT = G_('g-plantation-arbre'), sun = N('Bain de soleil rayé jaune'), par = N('Parasol vintage rayé');
  const lounge = pick('chaise-ext', ['canapé', 'fauteuil', 'lounge']), outChair = pick('chaise-ext', ['chaise', 'fauteuil']);
  // Grand porche couvert, avec ses fauteuils.
  out(slab, 1200, -190, 0, { w: 1000, d: 380 }); for (const x of [760, 947, 1135, 1352, 1540]) out(post, x, -365, 0, { h: 295 });
  for (const [x, y] of [[810, -160], [960, -160]]) out(lounge, x, y, 180); out(side, 885, -150, 0); for (const [x, y] of [[1330, -160], [1480, -160]]) out(lounge, x, y, 180); out(side, 1405, -150, 0); for (const x of [700, 1720, 2090]) out(ball, x, -60, 0);
  // Terrasse couverte, côté cuisine.
  out(slab, 1925, 1425, 0, { w: 1150, d: 650 }); for (const x of [1365, 1815, 2165, 2485]) out(post, x, 1730, 0); out(post, 2480, 1400, 0);
  out(N('Cheminée d’extérieur en pierre'), 2465, 1450, 90, { w: 240, h: 320, d: 70 }); out(N('Cuisine d’été en pierre 4 m'), 2130, 1150, 0, { w: 320 });
  for (const x of [2060, 2130, 2198]) out(stool, x, 1232, 180);
  out(rug, 2140, 1500, 0, { w: 360, d: 280, color: '#c9bda8' }); out(lounge, 2290, 1500, 90); out(lounge, 2140, 1390, 0); out(lounge, 2140, 1620, 180); out(lounge, 1990, 1500, 270); out(low, 2140, 1500, 0);
  out(N('Table en noyer massif'), 1560, 1490, 0, { w: 220, d: 90 }); for (const x of [1480, 1560, 1740]) { out(outChair, x, 1425, 0); out(outChair, x, 1555, 180); } out(vase, 1560, 1490, 0, { z: 76 });
  // Patio entre le salon et la terrasse.
  out(slab, 1050, 1150, 0, { w: 600, d: 500 }); out(plant, 830, 960, 0); out(plant, 1270, 960, 0);
  // Piscine, bains de soleil rayés, parasols vintage, foyer.
  out(slab, 1300, 2300, 0, { w: 3700, d: 1200 }); out(slab, 400, 1420, 0, { w: 1150, d: 460 });
  out(N('Piscine 8 × 4'), 1300, 2450, 0, { w: 1250, d: 500, z: 10 });
  for (const x of [620, 800, 1000, 1600, 1800, 1980]) out(sun, x, 2040, 0, { z: 10 }); for (const x of [710, 1890]) out(par, x, 1960, 0, { z: 10 });
  out(slab, -1000, 2050, 0, { w: 560, d: 560 }); out(N('Foyer rond d’extérieur'), -1000, 2050, 0); for (const [x, y, r] of [[-1000, 1870, 0], [-1000, 2230, 180], [-1180, 2050, 270], [-820, 2050, 90]]) out(lounge, x, y, r);
  for (let i = 0; i < 13; i++) out(cyp, -500 + i * 300, 3080, 0);
  for (const [x, y] of [[-1700, 800], [3900, 1900], [-1500, 2900], [3500, -1900], [-1600, -1700]]) out(pine, x, y, 0);
  for (const [x, y] of [[3900, 400], [-2000, 2000]]) out(oakT, x, y, 0);
  // Devant : allée de cyprès, cour, haies et grille.
  for (const y of [-2500, -3000, -3500, -4000, -4500, -5000, -5500]) { out(cyp, 620, y, 0); out(cyp, 1480, y, 0); }
  for (let i = 0; i < 7; i++) { out(hedge, -1050 + i * 300, -2100, 0); out(hedge, 1450 + i * 300, -2100, 0); }
  out(post, 800, -2100, 0, { w: 70, d: 70, h: 260 }); out(post, 1300, -2100, 0, { w: 70, d: 70, h: 260 });
  out(N('Conduit de cheminée en pierre'), -60, 700, 0, { w: 150, d: 70, h: 1500 });

  p.entry = 0;
  syncRooms(g);

  const R = (lv, x0, y0, x1, y1, type, ridge, pitch, extra = {}) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type, pitch, overhang: 35, ridge, wallH: 0, ...extra });
  p.roofs = [
    R(g, 0, 300, 750, 1200, 'gable', 'x', 42, { wallH: 720, vault: true }),
    R(g, 750, -380, 1650, 0, 'gable', 'x', 24, { vault: true, lining: 'wall_bois', flushB: true }), R(g, 880, -440, 1220, 0, 'gable', 'y', 30, { endB: true }),
    R(g, 2800, 440, 3200, 1180, 'gable', 'y', 42, { flushA: true, endA: true }), 
    R(g, 1350, 1100, 2500, 1750, 'gable', 'x', 24, { vault: true, lining: 'wall_bois', flushA: true }),
  ];

  // De l'air entre les zones : on élargit les pièces sur des lignes qui ne coupent aucun meuble.
  for (const [at, delta] of [[3000, -60], [2650, -50], [2200, 30], [1620, -100], [1300, -30], [430, -100]]) stretch(p, 'x', at, delta);
  for (const [at, delta] of [[650, -50], [520, -20], [150, -60]]) stretch(p, 'y', at, delta);
  p.levels.forEach(syncRooms);

  // ——— Étage, tracé sur le plan définitif du rez-de-chaussée ———
  const Hb0 = boxOf(g, 'Hall'), Kb0 = boxOf(g, 'Cuisine'), xL = Hb0.x0, xH = Hb0.x1, yH = Hb0.y1, yS = Kb0.y1, xR = xH + 1150, yC0 = 400, yC1 = 540, yE = 430;
  const u = newLevel('Étage', 290);
  outline(u, [[xL, 0], [xR, 0], [xR, yS], [xH, yS], [xH, yH], [xL, yH]], 30);
  partition(u, xH, 0, xH, yH); partition(u, xH, yC0, xH + 720, yC0); partition(u, xH, yC1, xH + 720, yC1); partition(u, xH + 720, 0, xH + 720, yS); partition(u, xH + 720, yE, xR, yE); partition(u, xH + 360, yC1, xH + 360, yS);
  for (const x of [400, 600]) partition(u, xH + x, 0, xH + x, yC0); partition(u, xH + 890, 0, xH + 890, yE); partition(u, xH + 600, 200, xH + 720, 200);
  open(u, (xL + xH) / 2, 0, 'window2', 280, 185, 90, ANGLAISE); open(u, xH + 180, yS, 'window2', 220, 220, 40, ANGLAISE); open(u, xH + 540, yS, 'window2', 220, 220, 40, ANGLAISE); open(u, xH + 935, yS, 'bay', 300, 235, 0, BAIE_ANGLAISE); open(u, xH + 200, 0, 'window2', 220, 200, 60, ANGLAISE); open(u, xH + 500, 0, 'window2', 100, 120, 110, ANGLAISE); open(u, xH + 660, 0, 'window1', 60, 80, 140, { name: 'Petite fenêtre' }); open(u, xH + 805, 0, 'window2', 100, 130, 100, ANGLAISE); open(u, xH + 1020, 0, 'window2', 150, 150, 90, ANGLAISE);
  arch(u, xH, (yC0 + yC1) / 2, 110, 235); open(u, xH + 200, yC0, 'door', 93, 215, 0); open(u, xH + 500, yC0, 'door', 83, 215, 0); open(u, xH + 660, yC0, 'door', 73, 215, 0); open(u, xH + 600, 150, 'door', 73, 215, 0); open(u, xH + 180, yC1, 'door', 93, 215, 0); open(u, xH + 540, yC1, 'door', 93, 215, 0); open(u, xH + 720, 485, 'door', 86, 225, 0, { name: 'Porte de la suite' }); arch(u, xH + 833, yE, 84, 230); open(u, xH + 1020, yE, 'pocket', 100, 225, 0, { name: 'Porte à galandage' });
  setRoom(u, xL + 200, 200, 'couloir', 'Palier', { floor: 'oak_natural', paint: warm, moulding: 'panels' });
  setRoom(u, xH + 300, (yC0 + yC1) / 2, 'couloir', 'Couloir', { floor: 'oak_natural', paint: warm, moulding: 'crown' });
  setRoom(u, xH + 200, 200, 'chambre', 'Chambre 4', { floor: oak, paint: 'paint_mizzle', moulding: 'panels' });
  setRoom(u, xH + 180, yC1 + 200, 'chambre', 'Chambre 3', { floor: oak, paint: 'paint_skimming', moulding: 'panels' });
  setRoom(u, xH + 540, yC1 + 200, 'enfant', 'Chambre 2 (bébé)', { floor: oak, paint: 'paint_all_white', moulding: 'panels' });
  setRoom(u, xH + 500, 200, 'douche', "Salle d'eau", { floor: 'tile_marble', paint: lin });
  setRoom(u, xH + 660, 300, 'wc', 'WC', { floor: 'tile_marble', paint: lin });
  setRoom(u, xH + 660, 100, 'cellier', 'Lingerie', { floor: 'tile_marble', paint: lin });
  setRoom(u, xH + 935, yE + 280, 'parentale', 'Suite parentale', { floor: 'oak_natural', paint: 'wall_noyer', moulding: 'panels' });
  setRoom(u, xH + 805, 200, 'dressing', 'Dressing', { floor: 'oak_natural', paint: 'wall_noyer', moulding: 'crown' });
  setRoom(u, xH + 1020, 200, 'sdb', 'Salle de bain parentale', { floor: stone, paint: 'wall_pierre_blonde' });
  p.levels.push(u); p.entry = 0; syncRooms(u);
  const R2 = (x0, y0, x1, y1, type, ridge, pitch, extra = {}) => ({ id: uid('z'), level: u.id, x0, y0, x1, y1, type, pitch, overhang: 35, ridge, wallH: 0, ...extra });
  p.roofs.push(R2(xL, 0, xR, yS, 'gable', 'x', 45), R2(xL + 60, 0, xH - 60, 300, 'gable', 'y', 45, { flush: true }), R2(xH + 720, 0, xR, yS, 'gable', 'y', 45, { flush: true }));
  const Ar = boxOf(g, 'Arrière-cuisine');
  const GB = boxOf(g, 'Garage'), lowRoof = (x0, y0, x1, y1, ridge, extra) => ({ id: uid('z'), level: g.id, x0, y0, x1, y1, type: 'gable', pitch: 42, overhang: 30, ridge, wallH: 0, ...extra });
  // Les toits du bas s'arrêtent net contre les murs de l'étage : rien ne traverse les pièces du haut.
  p.roofs.push(lowRoof(xR, boxOf(g, 'Couloir').y0, Ar.x1, yS, 'x', { endCut: true, flushA: true }), lowRoof(GB.x0, GB.y0, xR, 0, 'x', { flush: true, endCut: true }), lowRoof(xR, GB.y0, GB.x1, GB.y1, 'y', { flush: true, endB: true }));

  // Étage : palier avec grande bibliothèque et méridienne devant la fenêtre.
  const Pa = boxOf(u, 'Palier');
  place(u, books, Pa.x0 + 34, Pa.y0 + 280, 270, { w: 500, h: 285, d: 38 });
  place(u, N('Méridienne en bouclette'), (Pa.x0 + Pa.x1) / 2, 62, 0); place(u, cush, (Pa.x0 + Pa.x1) / 2 + 60, 40, 0, { w: 110, z: 44 }); place(u, side, (Pa.x0 + Pa.x1) / 2 + 125, 75, 0); place(u, lamp, (Pa.x0 + Pa.x1) / 2 + 125, 75, 0, { z: top(side) }); place(u, rug, (Pa.x0 + Pa.x1) / 2, 150, 0, { w: 280, d: 180 });
  // Suite parentale, plus intime.
  const Sb = boxOf(u, 'Suite parentale'), scy = (Sb.y0 + Sb.y1) / 2 - 10;
  place(u, rug, Sb.x1 - 200, scy, 0, { w: 260, d: 280 }); place(u, bed, Sb.x1 - 120, scy, 90); place(u, cush, Sb.x1 - 62, scy, 90, { w: 165, z: 62 }); place(u, chevet, Sb.x1 - 40, scy - 125, 90); place(u, chevet, Sb.x1 - 40, scy + 125, 90); place(u, lamp, Sb.x1 - 40, scy - 125, 0, { z: top(chevet) }); place(u, lamp, Sb.x1 - 40, scy + 125, 0, { z: top(chevet) }); place(u, bench, Sb.x1 - 275, scy, 90); place(u, arm, Sb.x0 + 60, Sb.y1 - 70, 135); place(u, dome, Sb.x1 - 200, scy, 0, { h: 90 });
  // Dressing bois, salle de bain en pierre.
  const Db = boxOf(u, 'Dressing'), Bb = boxOf(u, 'Salle de bain parentale');
  place(u, N('Dressing sur mesure en noyer'), Db.x0 + 30, (Db.y0 + Db.y1) / 2, 270, { w: Db.y1 - Db.y0 - 35, h: 275, d: 55 });
  place(u, N('Baignoire îlot ovale'), (Bb.x0 + Bb.x1) / 2, Bb.y0 + 62, 0, { w: 170, d: 78 }); place(u, N('Double vasque noyer et pierre'), Bb.x1 - 32, Bb.y0 + 240, 90, { w: 130 }); place(u, wc, Bb.x0 + 35, Bb.y0 + 300, 270);
  // Chambres.
  for (const [n, b] of [['Chambre 3', bed], ['Chambre 2 (bébé)', pick('lit-enfant', ['']) || bed]]) { const q = boxOf(u, n), y = (q.y0 + q.y1) / 2 + 25, x = q.x1 - 120; place(u, rug, x - 90, y, 90, { w: 220, d: 280 }); place(u, b, x, y, 90); place(u, cush, x + 58, y, 90, { w: 120, z: 62 }); place(u, chevet, q.x1 - 40, q.y0 + 50, 90); place(u, lamp, q.x1 - 40, q.y0 + 50, 0, { z: top(chevet) }); }
  const C4 = boxOf(u, 'Chambre 4'), c4y = (C4.y0 + C4.y1) / 2; place(u, rug, C4.x1 - 200, c4y, 0, { w: 220, d: 200 }); place(u, bed, C4.x1 - 120, c4y, 90); place(u, cush, C4.x1 - 62, c4y, 90, { w: 130, z: 62 }); place(u, chevet, C4.x1 - 38, c4y - 125, 90);
  const Se = boxOf(u, "Salle d'eau"); place(u, shower, (Se.x0 + Se.x1) / 2, Se.y0 + 55, 0, { w: 100, d: 90 }); place(u, N('Double vasque noyer et pierre'), Se.x0 + 30, Se.y0 + 250, 270, { w: 100 }); const Wc = boxOf(u, 'WC'); place(u, wc, (Wc.x0 + Wc.x1) / 2, Wc.y0 + 40, 0);
  // Couloir du bas : tapis de passage, console et lumières douces.
  const Co = boxOf(g, 'Couloir'), cy0 = (Co.y0 + Co.y1) / 2; for (const k of [0.3, 0.68]) place(g, rug, Co.x0 + (Co.x1 - Co.x0) * k, cy0, 90, { w: 90, d: 320, color: '#8a7a68' });

  // ——— Compositions posées sur les vrais murs, une fois le plan définitif ———
  const hang = (lv, room, side, name, w, h, z) => { const sp = spansOf(lv, room, side)[0]; if (!sp) return null; const W = Math.min(w, sp.len - 30), H = (h * W) / w, c = spanMid(sp); place(lv, N(name), c.x + sp.n.x * (sp.t + 2), c.y + sp.n.y * (sp.t + 2), facing(sp.n), { w: W, h: H, z: z ?? 150 - H / 2 }); return sp; };
  const compose = (lv, room, side, furn, name, w, h, lamps = true, extra = {}) => {
    const sp = spansOf(lv, room, side)[0]; if (!sp || !furn) return;
    const c = spanMid(sp), F = extra.w ? Math.min(extra.w, sp.len - 20) : Math.min(furn.w, sp.len - 20), ft = furn.h ?? 75, off = sp.t + (furn.d ?? 45) / 2 + 3, x = c.x + sp.n.x * off, y = c.y + sp.n.y * off, along = { x: sp.n.y, y: -sp.n.x };
    place(lv, furn, x, y, facing(sp.n), { w: F });
    if (name) { const W = Math.min(w, F + 30), H = (h * W) / w; place(lv, N(name), c.x + sp.n.x * (sp.t + 2), c.y + sp.n.y * (sp.t + 2), facing(sp.n), { w: W, h: H, z: ft + 32 }); }
    if (lamps) for (const k of [-1, 1]) place(lv, lamp, x + along.x * k * (F / 2 - 24), y + along.y * k * (F / 2 - 24), 0, { z: ft });
    place(lv, vase, x, y, 0, { z: ft, w: 30, d: 30, h: 60 });
  };
  const curtains = (lv, room, color) => { for (const c of windowsOf(lv, room)) for (const k of [-1, 1]) { const along = { x: c.n.y, y: -c.n.x }, d = c.w / 2 + 34; place(lv, curtain, c.x + along.x * k * d + c.n.x * (c.t + 12), c.y + along.y * k * d + c.n.y * (c.t + 12), facing(c.n), { w: 70, h: c.top, color }); } };

  // Salon : la cheminée au centre du haut mur, canapés face à face, fauteuils.
  const S = boxOf(g, 'Grand salon'), sy = (S.y0 + S.y1) / 2, sx = S.x0 + (S.x1 - S.x0) * 0.46;
  place(g, N('Cheminée monumentale pierre et noyer'), S.x0 + 42, sy, 270, { w: 400, h: 760, d: 80 });
  place(g, rug, sx, sy, 90, { w: 450, d: 570 }); place(g, low, sx, sy, 90, { w: 130, d: 70 }); place(g, vase, sx, sy, 0, { z: top(low), w: 32, d: 32, h: 60 });
  place(g, sofa, sx, sy - 255, 0); place(g, sofa, sx, sy + 255, 180); place(g, cush, sx, sy - 285, 0, { w: 200, z: 44 }); place(g, cush, sx, sy + 285, 180, { w: 200, z: 44 });
  place(g, arm, sx + 245, sy - 95, 90); place(g, arm, sx + 245, sy + 95, 90); place(g, side, sx + 250, sy, 0); place(g, lamp, sx + 250, sy, 0, { z: top(side) });
  place(g, ring, sx, sy, 0, { z: 420, w: 240, d: 240, h: 320 });
  place(g, plant, S.x0 + 55, S.y0 + 55, 0);
  compose(g, 'Grand salon', 'e', buffet, EARTH, 190, 130); curtains(g, 'Grand salon', cream);

  // Hall : table ronde et brassée de fleurs, tapis, deux tabourets, console et grand tableau.
  const Hb = boxOf(g, 'Hall'), hx = (Hb.x0 + Hb.x1) / 2, hy = Hb.y0 + 330;
  place(g, rug, hx, hy, 0, { w: 280, d: 240, color: '#b7a282' }); place(g, N('Table piédestal en plâtre'), hx, hy, 0); place(g, N('Grande jarre et branches fleuries'), hx, hy, 0, { z: 80 });
  place(g, stool, hx - 115, hy + 60, 45); place(g, stool, hx + 115, hy - 60, 225); place(g, ring, hx, hy, 0, { z: 215, w: 150, d: 150, h: 118 });
  hang(g, 'Hall', 'n', TAP, 90, 130);

  // Salle à manger : grande table de bois massif, murs moulurés, buffet et tableau.
  const D = boxOf(g, 'Salle à manger'), dx = (D.x0 + D.x1) / 2, dy = (D.y0 + D.y1) / 2 + 30;
  place(g, rug, dx, dy, 0, { w: 440, d: 320 }); place(g, N('Table en noyer massif'), dx, dy, 0, { w: 270, d: 105 });
  for (const k of [-1.2, -0.4, 0.4, 1.2]) { place(g, chair, dx + k * 80, dy - 85, 0); place(g, chair, dx + k * 80, dy + 85, 180); }
  for (const k of [-1, 1]) place(g, vase, dx + k * 90, dy, 0, { z: 76, w: 32, d: 32, h: 66 });
  place(g, ring, dx, dy, 0, { z: 205, w: 180, d: 180, h: 128 });
  compose(g, 'Salle à manger', 'n', buffet, INK, 200, 130); curtains(g, 'Salle à manger', cream);

  // Cuisine en U : noyer, marbre, hotte en plâtre, colonnes, grand îlot.
  const K = boxOf(g, 'Cuisine'), kx = (K.x0 + K.x1) / 2, runW = K.x1 - K.x0 - 90;
  place(g, N('Linéaire noyer et marbre avec crédence'), kx - 15, K.y0 + 40, 0, { w: runW });
  place(g, N('Piano de cuisson et hotte habillée'), kx, K.y0 + 44, 0, { w: 130, h: 300 });
  place(g, N('Colonnes noyer et laiton'), K.x1 - 42, K.y0 + 205, 90, { w: 220, h: 300 });
  const island = K.y0 + 225; place(g, N('Îlot noyer et marbre'), kx - 30, island, 0, { w: 340, d: 120 });
  for (const k of [-2, -1, 0, 1, 2]) place(g, stool, kx - 30 + k * 66, island + 82, 180);
  for (const k of [-1, 1]) place(g, N('Lanterne laiton et verre'), kx - 30 + k * 95, island, 0, { h: 150 });
  place(g, vase, kx + 90, island - 15, 0, { z: 94, w: 30, d: 30, h: 60 });
  const pass = windowsOf(g, 'Cuisine', true).find((c) => c.sill > 90);
  if (pass) place(g, N('Linéaire noyer et marbre'), pass.x + pass.n.x * 38, pass.y + pass.n.y * 38, facing(pass.n), { w: pass.w + 40, d: 45 });

  // Art et rideaux des autres pièces.
  hang(g, 'Couloir', 'n', INK, 150, 100); hang(g, 'Couloir', 's', EARTH, 150, 100); hang(g, 'Bureau, jeux ou chambre', 'e', EARTH, 160, 110); hang(g, 'WC', 'o', INK, 80, 100, 115);
  hang(g, 'Salle de sport', 'o', EARTH, 200, 130); curtains(g, 'Bureau, jeux ou chambre', cream);
  hang(u, 'Suite parentale', 'e', EARTH, 170, 100, 160); curtains(u, 'Suite parentale', bronze);
  hang(u, 'Chambre 3', 'e', EARTH, 130, 90, 155); hang(u, 'Chambre 2 (bébé)', 'e', INK, 110, 90, 155); hang(u, 'Chambre 4', 'o', TAP, 100, 130); hang(u, 'Couloir', 'n', EARTH, 120, 90); hang(u, 'Palier', 'e', TAP, 120, 160);
  for (const r of ['Chambre 3', 'Chambre 2 (bébé)', 'Chambre 4']) curtains(u, r, cream);
  const rail2 = N('Garde-corps bois classique'), SQ = N('Escalier américain quart tournant'), stx = Hb.x1 - 105 - SQ.d / 2, sty = Hb.y1 - SQ.w / 2 - 2;
  place(g, SQ, stx, sty, 270);
  const ry = sty + SQ.w / 2 - 115, xw = stx - SQ.d / 2 + 115, xe = stx + SQ.d * 0.1;
  place(u, rail2, (xw + xe) / 2, ry - 4, 0, { w: xe - xw });
  place(u, rail2, xe, ry + 57, 90, { w: 115 });

  shapeTerrain(p, 'flat', {});
  const m = ensureTerrain(p), half = (T_N - 1) / 2, cx = 1300, cy = -600;
  p.site.terrain.cx = cx; p.site.terrain.cy = cy; m.cx = cx; m.cy = cy;
  const gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + cx, y = (j - half) * 100 + cy;
    if ((x >= 800 && x <= 1300 && y <= -2100) || (x >= 100 && x <= 3300 && y >= -2100 && y <= -560)) m.p[j * T_N + i] = gravel;
  }
  // Relief : le terrain de la maison reste plat, puis ondule et remonte en coteaux autour.
  const keep = [[-1500, -1100, 3800, 3250], [550, -6700, 1550, -1000], [50, -2200, 3350, -500]];
  const ease = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + cx, y = (j - half) * 100 + cy;
    let d = 1e9;
    for (const [x0, y0, x1, y1] of keep) d = Math.min(d, Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1)));
    const roll = 240 * Math.sin(x / 1900 + 0.7) * Math.cos(y / 2300) + 140 * Math.sin(x / 900 + y / 1300) + 90 * Math.sin(y / 640 - x / 1100);
    m.h[j * T_N + i] = Math.round(ease((d - 150) / 2000) * (roll + 130 + Math.max(0, d - 800) * 0.13));
  }
  commitTerrain(p);
  p.site.altitude = 0;
  // Bosquets dans le terrain et sur les coteaux.
  let sd = 4177;
  const rr = () => (sd = (sd * 48271) % 2147483647) / 2147483647;
  const free = (x, y) => !keep.some(([x0, y0, x1, y1]) => x > x0 - 180 && x < x1 + 180 && y > y0 - 180 && y < y1 + 180);
  const oakItem = G_('g-plantation-arbre'), pin = N('Pin parasol'), cypres = N('Cyprès');
  for (let n = 0, tries = 0; n < 62 && tries < 900; tries++) {
    const x = -4300 + rr() * 11200, y = -6300 + rr() * 11400;
    if (!free(x, y)) continue;
    const k = rr(), s = 0.75 + rr() * 0.7;
    if (k < 0.62) place(g, oakItem, x, y, 0, { w: Math.round(620 * s), d: Math.round(620 * s), h: Math.round(880 * s) });
    else if (k < 0.8) place(g, pin, x, y, 0, { w: Math.round(820 * s), d: Math.round(820 * s), h: Math.round(1000 * s) });
    else place(g, cypres, x, y, 0, { h: Math.round(800 * s), w: Math.round(115 * s), d: Math.round(115 * s) });
    n++;
  }
  // Fleurs le long de la maison.
  const lav = N('Massif de lavande'), rosier = N('Massif de rosiers');
  place(g, lav, 325, 190, 0, { w: 540 }); place(g, rosier, 1690, -40, 0, { w: 400 }); place(g, lav, 2935, 720, 90, { w: 620 });
  p.site.parcel = { pts: [{ x: -2500, y: -6200 }, { x: 4800, y: -6200 }, { x: 4800, y: 3800 }, { x: -2500, y: 3800 }] };
  return p;
}

export const TEMPLATES = [
  { id: 'manoir', name: 'Maison anglaise, 5 chambres', desc: 'Grande maison à l’américaine : porche, grand escalier, salon cathédrale, terrasse couverte et piscine', make: houseManor },
  { id: 'hill', name: 'Maison sur la colline', desc: 'Salon et cuisine en haut, chambres en dessous avec vue sur la vallée', make: houseHillside },
  { id: 'single', name: 'Plain-pied meublé', desc: '126 m², 3 chambres, déjà aménagé', make: houseSinglestorey },
  { id: 'two', name: 'Maison à étage', desc: '2 niveaux, 88 m² au sol, avec escalier', make: houseTwoStorey },
  { id: 'empty', name: 'Page blanche', desc: 'Partir de zéro ou d’un plan importé', make: () => newProject('Notre maison') },
];
void store;
