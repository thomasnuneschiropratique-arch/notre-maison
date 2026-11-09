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

function boxOf(lv, name) {
  const a = syncRooms(lv), i = lv.rooms.findIndex((r) => r.name === name), poly = a.rooms[i].poly, xs = poly.map((q) => q.x), ys = poly.map((q) => q.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
const facing = (n) => (((Math.atan2(-n.x, n.y) * 180) / Math.PI) + 360) % 360;
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

function windowsOf(lv, name, all = false) {
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
  open(g, 1050, 0, 'entry', 200, 260, 0, { name: "Porte d'entrée double", leaves: 2, glazed: true });
  open(g, 825, 0, 'window2', 90, 150, 90, ANGLAISE); open(g, 1255, 0, 'window1', 60, 90, 130, { name: 'Petite fenêtre' });
  open(g, 845, 250, 'door', 83, 215, 0); open(g, 1255, 250, 'door', 73, 215, 0);
  // Les pièces de vie communiquent par de grandes arches.
  arch(g, 750, 480, 280, 320); arch(g, 1350, 505, 115, 250); arch(g, 1350, 695, 240, 315); arch(g, 1900, 835, 320, 315); arch(g, 2500, 900, 140, 250);
  open(g, 1050, 900, 'fixed', 420, 90, 225, { name: 'Imposte', muntins: [3, 2] });
  open(g, 0, 400, 'window2', 150, 540, 40, HAUTE_ANGLAISE); open(g, 0, 1100, 'window2', 150, 540, 40, HAUTE_ANGLAISE); open(g, 375, 1200, 'bay', 560, 420, 0, BAIE_ANGLAISE); open(g, 200, 300, 'window2', 180, 460, 50, HAUTE_ANGLAISE); open(g, 550, 300, 'window2', 180, 460, 50, HAUTE_ANGLAISE); open(g, 750, 1050, 'window2', 180, 420, 40, HAUTE_ANGLAISE);
  open(g, 1625, 1100, 'bay', 380, 265, 0, BAIE_ANGLAISE); open(g, 2130, 1100, 'bay', 340, 115, 105, { name: 'Passe-plat ouvert sur la terrasse', muntins: [1, 1] }); open(g, 2410, 1100, 'window2', 120, 250, 0, { name: 'Porte-fenêtre', muntins: [1, 5] }); open(g, 2650, 1100, 'window2', 120, 130, 110, ANGLAISE);
  // Pièces fermées.
  open(g, 1350, 345, 'double', 160, 230, 0, { name: 'Double porte' }); open(g, 1600, 0, 'window2', 280, 220, 50, ANGLAISE); open(g, 1850, 220, 'door', 83, 215, 0); open(g, 2000, 0, 'window2', 100, 130, 110, ANGLAISE); open(g, 2000, 440, 'door', 83, 215, 0);
  open(g, 2550, 440, 'door', 93, 215, 0); open(g, 2650, 570, 'door', 83, 215, 0); open(g, 2800, 505, 'door', 90, 215, 0);
  open(g, 3000, 1180, 'window2', 300, 265, 0, PORTE_ANGLAISE); open(g, 3200, 800, 'window2', 320, 240, 30, ANGLAISE); open(g, 3070, 440, 'window2', 150, 120, 120, ANGLAISE);
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

  // ——— Étage ———
  const u = newLevel('Étage', 290);
  outline(u, [[750, 0], [2800, 0], [2800, 1100], [1350, 1100], [1350, 900], [750, 900]], 30);
  partition(u, 1100, 0, 1100, 450); partition(u, 1100, 450, 1350, 450); partition(u, 1350, 450, 1350, 900); partition(u, 1350, 450, 2200, 450); partition(u, 1350, 640, 2200, 640); partition(u, 2200, 0, 2200, 1100); partition(u, 2200, 450, 2800, 450); partition(u, 2450, 0, 2450, 450); partition(u, 1800, 640, 1800, 1100); partition(u, 1850, 0, 1850, 450); partition(u, 2050, 0, 2050, 450);
  open(u, 925, 0, 'window2', 220, 220, 40, ANGLAISE);  open(u, 1575, 1100, 'window2', 260, 220, 40, ANGLAISE); open(u, 2000, 1100, 'window2', 240, 220, 40, ANGLAISE); open(u, 2500, 1100, 'bay', 440, 235, 0, BAIE_ANGLAISE); open(u, 1600, 0, 'window2', 240, 200, 60, ANGLAISE); open(u, 1950, 0, 'window2', 110, 120, 110, ANGLAISE); open(u, 2125, 0, 'window1', 60, 80, 140, { name: 'Petite fenêtre' }); open(u, 2625, 0, 'window2', 300, 170, 80, ANGLAISE); open(u, 2325, 0, 'window2', 120, 140, 90, ANGLAISE);
  arch(u, 1350, 545, 170, 235); open(u, 1600, 450, 'door', 93, 215, 0); open(u, 1950, 450, 'door', 83, 215, 0); open(u, 2125, 450, 'door', 73, 215, 0); open(u, 1575, 640, 'door', 93, 215, 0); open(u, 2000, 640, 'door', 93, 215, 0); open(u, 2200, 545, 'double', 160, 230, 0, { name: 'Double porte de la suite' }); arch(u, 2325, 450, 130, 230); open(u, 2625, 450, 'pocket', 120, 225, 0, { name: 'Porte à galandage' });
  setRoom(u, 900, 300, 'couloir', 'Palier', { floor: 'dark_planks', paint: warm, moulding: 'panels' });
  setRoom(u, 1800, 545, 'couloir', 'Couloir', { floor: 'dark_planks', paint: warm, moulding: 'crown' });
  setRoom(u, 1600, 225, 'chambre', 'Chambre 4', { floor: oak, paint: 'paint_mizzle', moulding: 'panels' });
  setRoom(u, 1575, 870, 'chambre', 'Chambre 3', { floor: oak, paint: 'paint_skimming', moulding: 'panels' });
  setRoom(u, 2000, 870, 'enfant', 'Chambre 2 (bébé)', { floor: oak, paint: 'paint_all_white', moulding: 'panels' });
  setRoom(u, 1950, 225, 'douche', "Salle d'eau", { floor: 'tile_marble', paint: lin });
  setRoom(u, 2125, 225, 'wc', 'WC', { floor: stone, paint: lin });
  setRoom(u, 2500, 775, 'parentale', 'Suite parentale', { floor: 'dark_planks', paint: 'wall_noyer', moulding: 'panels' });
  setRoom(u, 2325, 225, 'dressing', 'Dressing', { floor: 'dark_planks', paint: 'wall_noyer', moulding: 'crown' });
  setRoom(u, 2625, 225, 'sdb', 'Salle de bain parentale', { floor: stone, paint: 'wall_pierre_blonde' });

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
  place(g, N('Dressing sur mesure en noyer'), 845, 40, 0, { w: 170, h: 280, d: 55 }); place(g, N('Vasque monobloc en marbre'), 1255, 32, 0, { w: 130 }); place(g, wc, 1320, 150, 90);
  // Hall : grand escalier, bibliothèques de part et d'autre de la porte-fenêtre, fauteuils au fond.
  place(g, N('Escalier américain droit (rampe à gauche)'), 1122, 840, 90);
  // Arrière-cuisine et buanderie, reliées à la cuisine.
  place(g, G_('g-electro-lave-linge-60-cm'), 2760, 620, 90); place(g, G_('g-electro-s-che-linge-60-cm'), 2760, 690, 90); place(g, N('Linéaire noyer et marbre'), 2755, 860, 90, { w: 200 }); place(g, books, 2525, 960, 270, { w: 120, h: 280 }); place(g, plant, 2740, 1060, 0);
  // Pièce modulable, salle d'eau, sport, garage.
  place(g, books, 1372, 170, 270, { w: 240, h: 280 }); place(g, rug, 1620, 220, 0, { w: 300, d: 220 }); place(g, N('Table en noyer massif'), 1620, 90, 0, { w: 200, d: 85 }); place(g, pick('siege', ['cuir', 'tissu']), 1620, 150, 180);
  place(g, sofa, 1620, 372, 180); pillows(g, 1620, 395, 180, 180);
  place(g, shower, 2070, 75, 0); place(g, N('Double vasque noyer et pierre'), 2112, 260, 90, { w: 150 }); place(g, wc, 1890, 80, 270);
  place(g, G_('g-sport-rangement-halt-res'), 3000, 480, 0, { w: 280 }); place(g, G_('g-sport-banc-de-musculation-r-glable'), 2960, 830, 0); place(g, G_('g-sport-tapis-de-course'), 3110, 650, 0); place(g, rug, 3000, 830, 0, { w: 240, d: 300, color: '#3a3733' }); place(g, plant, 3155, 1130, 0);
  place(g, N('Voiture de sport rouge'), 2350, 110, 180);

  // Étage : palier.
  const rail = N('Garde-corps bois classique');
  place(u, books, 790, 450, 270, { w: 300, h: 280 }); place(u, arm, 860, 180, 90); place(u, rug, 925, 200, 0, { w: 220, d: 180 });
  // Suite parentale.
  place(u, rug, 2460, 790, 0, { w: 320, d: 300 }); place(u, bed, 2670, 775, 90); pillows(u, 2725, 775, 90, 170); place(u, chevet, 2765, 640, 90); place(u, chevet, 2765, 910, 90); place(u, lamp, 2765, 640, 0, { z: top(chevet) }); place(u, lamp, 2765, 910, 0, { z: top(chevet) });
  place(u, bench, 2510, 775, 90); place(u, ring, 2470, 775, 0, { z: 180, w: 120, d: 120, h: 98 }); place(u, arm, 2280, 1020, 135); place(u, arm2, 2280, 870, 60); place(u, side, 2270, 945, 0); place(u, plant, 2750, 1060, 0);
  // Dressing bois, salle de bain en pierre.
  place(u, N('Dressing sur mesure en noyer'), 2325, 38, 0, { w: 230, h: 275 }); place(u, N('Dressing sur mesure en noyer'), 2234, 250, 270, { w: 180, h: 275, d: 50 }); place(u, bench, 2340, 245, 0); place(u, rug, 2345, 300, 0, { w: 180, d: 200, color: '#b9a98e' });
  place(u, N('Baignoire îlot ovale'), 2625, 110, 0); place(u, N('Double vasque noyer et pierre'), 2770, 300, 90, { w: 200 }); place(u, shower, 2520, 380, 0, { w: 110 }); place(u, plant, 2765, 60, 0); place(u, side, 2492, 110, 0); place(u, dome, 2625, 110, 0, { h: 100 });
  // Chambres.
  const kid = pick('lit-enfant', ['']) || bed;
  [[1670, 870, bed, 1575, EARTH], [2075, 870, kid, 2000, INK]].forEach(([x, y, b, win, a]) => { place(u, rug, x - 130, y, 90, { w: 240, d: 300 }); place(u, b, x, y, 90); pillows(u, x + 60, y, 90, 130); place(u, chevet, x + 90, 700, 90); place(u, lamp, x + 90, 700, 0, { z: top(chevet) }); });
  place(u, rug, 1600, 240, 0, { w: 260, d: 230 }); place(u, bed, 1725, 225, 90); pillows(u, 1775, 225, 90, 150); place(u, chevet, 1805, 90, 90); place(u, lamp, 1805, 90, 0, { z: top(chevet) }); place(u, arm, 1440, 90, 135);
  place(u, shower, 1950, 80, 0, { w: 110 }); place(u, N('Double vasque noyer et pierre'), 1950, 415, 180, { w: 130 }); place(u, wc, 2125, 45, 0);

  // ——— Dehors ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), slab = G_('g-terrasse-terrasse-pierre'), hedge = allItems().find((i) => i.name === 'Haie (3 m)'), ball = N('Buis taillé en boule'), post = N('Poteau en pierre'), pine = N('Pin parasol'), cyp = N('Cyprès'), oakT = G_('g-plantation-arbre'), sun = N('Bain de soleil rayé jaune'), par = N('Parasol vintage rayé');
  const lounge = pick('chaise-ext', ['canapé', 'fauteuil', 'lounge']), outChair = pick('chaise-ext', ['chaise', 'fauteuil']);
  // Grand porche couvert, avec ses fauteuils.
  out(slab, 1200, -190, 0, { w: 1000, d: 380 }); for (let i = 0; i <= 4; i++) out(post, 760 + i * 220, -365, 0, { h: 295 });
  for (const [x, y] of [[810, -160], [960, -160]]) out(lounge, x, y, 180); out(side, 885, -150, 0); for (const [x, y] of [[1400, -160], [1550, -160]]) out(lounge, x, y, 180); out(side, 1475, -150, 0); for (const x of [700, 1720, 2090]) out(ball, x, -60, 0);
  // Terrasse couverte, côté cuisine.
  out(slab, 1925, 1425, 0, { w: 1150, d: 650 }); for (let i = 0; i <= 3; i++) out(post, 1370 + i * 375, 1730, 0); out(post, 2480, 1400, 0);
  out(N('Cheminée d’extérieur en pierre'), 2465, 1450, 90, { w: 240, h: 320, d: 70 }); out(N('Cuisine d’été en pierre 4 m'), 1560, 1150, 0, { w: 320 });
  for (const x of [2040, 2130, 2220]) out(stool, x, 1160, 180);
  out(rug, 2140, 1500, 0, { w: 360, d: 280, color: '#c9bda8' }); out(lounge, 2290, 1500, 90); out(lounge, 2140, 1390, 0); out(lounge, 2140, 1620, 180); out(lounge, 1990, 1500, 270); out(low, 2140, 1500, 0);
  out(N('Table en noyer massif'), 1560, 1490, 0, { w: 220, d: 90 }); for (const x of [1480, 1560, 1640]) { out(outChair, x, 1425, 0); out(outChair, x, 1555, 180); } out(vase, 1560, 1490, 0, { z: 76 });
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
  out(post, -60, 700, 0, { w: 150, d: 70, h: 1500 });

  p.levels.push(u);
  p.entry = 0;
  syncRooms(g); syncRooms(u);

  const R = (lv, x0, y0, x1, y1, type, ridge, pitch, extra = {}) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type, pitch, overhang: 35, ridge, wallH: 0, ...extra });
  p.roofs = [
    R(u, 750, 0, 2800, 1100, 'gable', 'x', 45), R(u, 800, 0, 1300, 900, 'gable', 'y', 45), R(u, 2200, 0, 2800, 1100, 'gable', 'y', 45),
    R(g, 0, 300, 750, 1200, 'gable', 'x', 42, { wallH: 720, vault: true }),
    R(g, 750, -380, 1650, 0, 'gable', 'x', 24, { vault: true, lining: 'wall_bois' }), R(g, 880, -440, 1220, 0, 'gable', 'y', 45),
    R(g, 2800, 440, 3200, 1180, 'gable', 'y', 42), R(g, 2150, -210, 2950, 440, 'gable', 'y', 42, { wallH: 270 }),
    R(g, 1350, 1100, 2500, 1750, 'gable', 'x', 24, { vault: true, lining: 'wall_bois' }),
  ];

  // De l'air entre les zones : on élargit les pièces sur des lignes qui ne coupent aucun meuble.
  for (const [at, delta] of [[2470, 60], [1930, 60], [1880, 60], [1400, 60], [600, 60], [170, 40]]) stretch(p, 'x', at, delta);
  for (const [at, delta] of [[700, 40], [505, 30]]) stretch(p, 'y', at, delta);
  p.levels.forEach(syncRooms);

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
  place(g, plant, S.x0 + 80, S.y1 - 60, 0); place(g, plant, S.x1 - 70, S.y0 + 60, 0);
  compose(g, 'Grand salon', 'e', buffet, EARTH, 190, 130); curtains(g, 'Grand salon', cream);

  // Hall : table ronde et brassée de fleurs, tapis, deux tabourets, console et grand tableau.
  const Hb = boxOf(g, 'Hall'), hx = (Hb.x0 + Hb.x1) / 2, hy = 560;
  place(g, rug, hx, hy, 0, { w: 330, d: 300, color: '#b7a282' }); place(g, N('Table piédestal en plâtre'), hx, hy, 0); place(g, N('Grande jarre et branches fleuries'), hx, hy, 0, { z: 80 });
  place(g, stool, hx - 115, hy + 60, 45); place(g, stool, hx + 115, hy - 60, 225); place(g, ring, hx, hy, 0, { z: 215, w: 150, d: 150, h: 118 });
  compose(g, 'Hall', 'o', bench, TAP, 110, 150, false);

  // Salle à manger : grande table de bois massif, murs moulurés, buffet et tableau.
  const D = boxOf(g, 'Salle à manger'), dx = (D.x0 + D.x1) / 2, dy = (D.y0 + D.y1) / 2 + 30;
  place(g, rug, dx, dy, 0, { w: 440, d: 320 }); place(g, N('Table en noyer massif'), dx, dy, 0, { w: 320, d: 110 });
  for (const k of [-1.5, -0.5, 0.5, 1.5]) { place(g, chair, dx + k * 80, dy - 85, 0); place(g, chair, dx + k * 80, dy + 85, 180); }
  for (const k of [-1, 1]) place(g, vase, dx + k * 90, dy, 0, { z: 76, w: 32, d: 32, h: 66 });
  place(g, ring, dx, dy, 0, { z: 205, w: 180, d: 180, h: 128 }); place(g, plant, D.x1 - 55, D.y1 - 55, 0);
  compose(g, 'Salle à manger', 'n', buffet, INK, 200, 130); curtains(g, 'Salle à manger', cream);

  // Cuisine en U : noyer, marbre, hotte en plâtre, colonnes, grand îlot.
  const K = boxOf(g, 'Cuisine'), kx = (K.x0 + K.x1) / 2, runW = K.x1 - K.x0 - 90;
  place(g, N('Linéaire noyer et marbre avec crédence'), kx - 15, K.y0 + 40, 0, { w: runW });
  place(g, N('Piano de cuisson et hotte habillée'), kx, K.y0 + 44, 0, { w: 130, h: 300 });
  place(g, N('Colonnes noyer et laiton'), K.x1 - 42, K.y0 + 260, 90, { w: 220, h: 300 });
  const island = K.y0 + 245; place(g, N('Îlot noyer et marbre'), kx - 30, island, 0, { w: 340, d: 130 });
  for (const k of [-2, -1, 0, 1, 2]) place(g, stool, kx - 30 + k * 66, island + 95, 180);
  for (const k of [-1, 1]) place(g, N('Lanterne laiton et verre'), kx - 30 + k * 95, island, 0, { h: 150 });
  place(g, vase, kx + 90, island - 15, 0, { z: 94, w: 30, d: 30, h: 60 });
  const pass = windowsOf(g, 'Cuisine', true).find((c) => c.sill > 90);
  if (pass) place(g, N('Linéaire noyer et marbre'), pass.x + pass.n.x * 46, pass.y + pass.n.y * 46, facing(pass.n), { w: pass.w + 40 });
  place(g, plant, K.x0 + 55, K.y1 - 55, 0);

  // Art et rideaux des autres pièces.
  hang(g, 'Couloir', 'n', INK, 120, 90); hang(g, 'Bureau, jeux ou chambre', 'e', EARTH, 160, 110); hang(g, 'WC', 'o', INK, 80, 100, 115);
  hang(g, 'Salle de sport', 'o', EARTH, 200, 130); curtains(g, 'Bureau, jeux ou chambre', cream);
  hang(u, 'Suite parentale', 'e', EARTH, 170, 100, 160); hang(u, 'Suite parentale', 'o', INK, 140, 170); curtains(u, 'Suite parentale', bronze);
  hang(u, 'Chambre 3', 'e', EARTH, 130, 90, 155); hang(u, 'Chambre 2 (bébé)', 'e', INK, 110, 90, 155); hang(u, 'Chambre 4', 'o', TAP, 100, 130); hang(u, 'Couloir', 'n', EARTH, 120, 90); hang(u, 'Palier', 'n', TAP, 120, 160);
  for (const r of ['Chambre 3', 'Chambre 2 (bébé)', 'Chambre 4']) curtains(u, r, cream);
  const rail2 = N('Garde-corps bois classique'), st = g.items.find((i) => i.cat === N('Escalier américain droit (rampe à gauche)').id);
  place(u, rail2, st.x - 10, st.y - 62, 0, { w: 300 }); place(u, rail2, st.x - 160, st.y, 90, { w: 115 });

  shapeTerrain(p, 'flat', {});
  const m = ensureTerrain(p), half = (T_N - 1) / 2, cx = 1300, cy = -600;
  p.site.terrain.cx = cx; p.site.terrain.cy = cy; m.cx = cx; m.cy = cy;
  const gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + cx, y = (j - half) * 100 + cy;
    if ((x >= 800 && x <= 1300 && y <= -2100) || (x >= 100 && x <= 3300 && y >= -2100 && y <= -560)) m.p[j * T_N + i] = gravel;
  }
  commitTerrain(p);
  p.site.altitude = 0;
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
