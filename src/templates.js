// Maisons de départ, modifiables.
import { newProject, newLevel, addNode, addWall, uid, syncRooms, store } from './state.js';
import { allItems, getItem } from './catalog.js';
import { ensureTerrain, commitTerrain, shapeTerrain, heightAt, T_N } from './terrain.js';
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
  const a = syncRooms(lv), i = lv.rooms.findIndex((r) => r.name === name);
  if (i < 0) throw new Error(`Pièce introuvable : ${name} (${lv.name} : ${lv.rooms.map((r) => r.name).join(', ')})`);
  const poly = a.rooms[i].poly, xs = poly.map((q) => q.x), ys = poly.map((q) => q.y);
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

/** À augmenter à chaque refonte : les anciennes copies enregistrées proposent alors la nouvelle version. */
export const MANOR_VERSION = 2;

/** Grande maison à l'américaine. Le nord (haut du plan) est l'arrivée, le sud le jardin. */
function houseManor(opts = {}) {
  // `roomy` : la même maison avec un peu plus de volume (pièces plus grandes, plafonds plus hauts).
  const roomy = !!opts.roomy, U = (v) => (roomy ? Math.round(v * 1.07) : v);
  const p = newProject(roomy ? 'Maison anglaise – plus d’espace' : 'Maison anglaise');
  if (roomy) p.variant = 'roomy';
  p.tplVersion = MANOR_VERSION;
  p.style = { facade: 'facade_pierre_blonde', roof: 'roof_ardoise', joinery: '#1c1d1f' };
  p.roof = { type: 'none', pitch: 45, overhang: 35, ridge: 'auto' };
  p.site.env = 'campagne';
  const G_ = (id) => getItem(id);
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });
  const arch = (lv, x, y, w, h) => open(lv, x, y, 'arch', w, h, 0, { name: 'Arche' });

  // ——— Rez-de-chaussée ———
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = roomy ? 350 : 335; g.slab = 30;
  outline(g, [[750, 0], [2150, 0], [2150, -210], [2950, -210], [2950, 440], [3200, 440], [3200, 1180], [2800, 1180], [2800, 1100], [1350, 1100], [1350, 900], [750, 900], [750, 1200], [0, 1200], [0, 300], [750, 300]], 35);
  partition(g, 750, 300, 750, 900, 15); partition(g, 750, 250, 940, 250, 12); partition(g, 1160, 250, 1350, 250, 12); partition(g, 940, 0, 940, 250, 12); partition(g, 1160, 0, 1160, 250, 12);
  partition(g, 1350, 0, 1350, 900, 15); partition(g, 1850, 0, 1850, 440, 12); partition(g, 2150, 0, 2150, 440, 20); partition(g, 1350, 440, 2950, 440, 15); partition(g, 1350, 570, 2800, 570, 15); partition(g, 2800, 440, 2800, 1100, 15); partition(g, 1900, 570, 1900, 1100, 15); partition(g, 2500, 570, 2500, 1100, 15);

  // Arrivée.
  open(g, 1050, 0, 'entry', 180, 260, 0, { name: "Porte d'entrée double", leaves: 2, glazed: true });
  open(g, 825, 0, 'window2', 90, 150, 90, ANGLAISE); open(g, 1240, 0, 'window1', 60, 90, 130, { name: 'Petite fenêtre' });
  open(g, 845, 250, 'door', 83, 215, 0); open(g, 1215, 250, 'door', 73, 215, 0);
  // Les pièces de vie communiquent par de grandes arches.
  arch(g, 750, 480, 280, 320); arch(g, 1350, 495, 84, 250); arch(g, 1350, 760, 240, 315); arch(g, 1900, 850, 300, 315); arch(g, 2500, 1025, 120, 250);
  // L'imposte reste au-dessus du bas de l'escalier : le palier intermédiaire ne doit pas la couper.
  open(g, roomy ? 1200 : 1140, 900, 'fixed', 190, 90, roomy ? 240 : 225, { name: 'Imposte', muntins: [2, 2] });
  open(g, 0, 400, 'window2', 150, 540, 40, HAUTE_ANGLAISE); open(g, 0, 1100, 'window2', 150, 540, 40, HAUTE_ANGLAISE); open(g, 325, 1200, 'bay', 560, 420, 0, BAIE_ANGLAISE); open(g, 200, 300, 'window2', 180, 460, 50, HAUTE_ANGLAISE); open(g, 550, 300, 'window2', 180, 460, 50, HAUTE_ANGLAISE); open(g, 750, 1050, 'window2', 180, 420, 40, HAUTE_ANGLAISE);
  open(g, 1675, 1100, 'bay', 380, 265, 0, { ...BAIE_ANGLAISE, opened: true }); open(g, 2130, 1100, 'bay', 340, 115, 105, { name: 'Passe-plat ouvert sur la terrasse', muntins: [1, 1] }); open(g, 2410, 1100, 'window2', 120, 250, 0, { name: 'Porte-fenêtre', muntins: [1, 5] }); open(g, 2650, 1100, 'window2', 120, 130, 110, ANGLAISE);
  // Pièces fermées.
  open(g, 1350, 345, 'double', 160, 230, 0, { name: 'Double porte' }); open(g, 1550, 0, 'window2', 280, 220, 50, ANGLAISE); open(g, 1850, 220, 'door', 83, 215, 0); open(g, 1925, 0, 'window2', 90, 130, 110, ANGLAISE); open(g, 2000, 440, 'door', 83, 215, 0);
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
  // Rien devant les fenêtres : rangement contre le mur aveugle, tapis de course au milieu.
  place(g, G_('g-sport-rangement-halt-res'), 2832, 830, 90, { w: 220 }); place(g, G_('g-sport-banc-de-musculation-r-glable'), 3010, 930, 0); place(g, G_('g-sport-tapis-de-course'), 3010, 640, 90); place(g, rug, 3010, 930, 0, { w: 240, d: 220, color: '#3a3733' });
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
    R(g, 0, 300, 750, 1200, 'gable', 'x', 42, { wallH: roomy ? 760 : 720, vault: true }),
    R(g, 750, -380, 1650, 0, 'gable', 'x', 24, { vault: true, lining: 'wall_bois', flushB: true }), R(g, 880, -440, 1220, 0, 'gable', 'y', 30, { endB: true }),
    R(g, 2800, 440, 3200, 1180, 'gable', 'y', 42, { flushA: true, endA: true }), 
    R(g, 1350, 1100, 2500, 1750, 'gable', 'x', 24, { vault: true, lining: 'wall_bois', flushA: true }),
  ];

  // De l'air entre les zones : on élargit les pièces sur des lignes qui ne coupent aucun meuble.
  // Version plus spacieuse : on resserre deux fois moins.
  const tighten = (d) => (roomy && d < 0 ? Math.round(d * 0.45) : d);
  for (const [at, delta] of [[3000, -60], [2650, -50], [2200, 30], [1620, -100], [1300, -30], [430, -100]]) stretch(p, 'x', at, tighten(delta));
  for (const [at, delta] of [[650, -50], [520, -20], [150, -60]]) stretch(p, 'y', at, tighten(delta));
  p.levels.forEach(syncRooms);

  // ——— Étage, tracé sur le plan définitif du rez-de-chaussée ———
  const Hb0 = boxOf(g, 'Hall'), Kb0 = boxOf(g, 'Cuisine'), xL = Hb0.x0, xH = Hb0.x1, yH = Hb0.y1, yS = Kb0.y1, xR = xH + U(1150), yC0 = 400, yC1 = 540, yE = 430;
  const u = newLevel('Étage', roomy ? 305 : 290);
  outline(u, [[xL, 0], [xR, 0], [xR, yS], [xH, yS], [xH, yH], [xL, yH]], 30);
  partition(u, xH, 0, xH, yH); partition(u, xH, yC0, xH + U(720), yC0); partition(u, xH, yC1, xH + U(720), yC1); partition(u, xH + U(720), 0, xH + U(720), yS); partition(u, xH + U(720), yE, xR, yE); partition(u, xH + U(360), yC1, xH + U(360), yS);
  for (const x of [400, 600]) partition(u, xH + U(x), 0, xH + U(x), yC0); partition(u, xH + U(890), 0, xH + U(890), yE); partition(u, xH + U(600), 200, xH + U(720), 200);
  open(u, (xL + xH) / 2, 0, 'window2', 280, 185, 90, ANGLAISE); open(u, xH + U(180), yS, 'window2', 220, 220, 40, ANGLAISE); open(u, xH + U(540), yS, 'window2', 220, 220, 40, ANGLAISE); open(u, xH + U(935), yS, 'bay', 300, 235, 0, BAIE_ANGLAISE); open(u, xH + U(200), 0, 'window2', 220, 200, 60, ANGLAISE); open(u, xH + U(500), 0, 'window2', 100, 120, 110, ANGLAISE); open(u, xH + U(660), 0, 'window1', 60, 80, 140, { name: 'Petite fenêtre' }); open(u, xH + U(805), 0, 'window2', 100, 130, 100, ANGLAISE); open(u, xH + U(1020), 0, 'window2', 150, 150, 90, ANGLAISE);
  arch(u, xH, (yC0 + yC1) / 2, 110, 235); open(u, xH + U(200), yC0, 'door', 93, 215, 0); open(u, xH + U(500), yC0, 'door', 83, 215, 0); open(u, xH + U(660), yC0, 'door', 73, 215, 0); open(u, xH + U(600), 150, 'door', 73, 215, 0); open(u, xH + U(180), yC1, 'door', 93, 215, 0); open(u, xH + U(540), yC1, 'door', 93, 215, 0); open(u, xH + U(720), 485, 'door', 86, 225, 0, { name: 'Porte de la suite' }); arch(u, xH + U(833), yE, 84, 230); open(u, xH + U(1020), yE, 'pocket', 100, 225, 0, { name: 'Porte à galandage' });
  setRoom(u, xL + 200, 200, 'couloir', 'Palier', { floor: 'oak_natural', paint: warm, moulding: 'panels' });
  setRoom(u, xH + U(300), (yC0 + yC1) / 2, 'couloir', 'Couloir', { floor: 'oak_natural', paint: warm, moulding: 'crown' });
  setRoom(u, xH + U(200), 200, 'chambre', 'Chambre 4', { floor: oak, paint: 'paint_mizzle', moulding: 'panels' });
  setRoom(u, xH + U(180), yC1 + 200, 'chambre', 'Chambre 3', { floor: oak, paint: 'paint_skimming', moulding: 'panels' });
  setRoom(u, xH + U(540), yC1 + 200, 'enfant', 'Chambre 2 (bébé)', { floor: oak, paint: 'paint_all_white', moulding: 'panels' });
  setRoom(u, xH + U(500), 200, 'douche', "Salle d'eau", { floor: 'tile_marble', paint: lin });
  setRoom(u, xH + U(660), 300, 'wc', 'WC', { floor: 'tile_marble', paint: lin });
  setRoom(u, xH + U(660), 100, 'cellier', 'Lingerie', { floor: 'tile_marble', paint: lin });
  setRoom(u, xH + U(935), yE + 280, 'parentale', 'Suite parentale', { floor: 'oak_natural', paint: 'wall_noyer', moulding: 'panels' });
  setRoom(u, xH + U(805), 200, 'dressing', 'Dressing', { floor: 'oak_natural', paint: 'wall_noyer', moulding: 'crown' });
  setRoom(u, xH + U(1020), 200, 'sdb', 'Salle de bain parentale', { floor: stone, paint: 'wall_pierre_blonde' });
  p.levels.push(u); p.entry = 0; syncRooms(u);
  const R2 = (x0, y0, x1, y1, type, ridge, pitch, extra = {}) => ({ id: uid('z'), level: u.id, x0, y0, x1, y1, type, pitch, overhang: 35, ridge, wallH: 0, ...extra });
  p.roofs.push(R2(xL, 0, xR, yS, 'gable', 'x', 45), R2(xL + 60, 0, xH - 60, 300, 'gable', 'y', 45, { flush: true }), R2(xH + U(720), 0, xR, yS, 'gable', 'y', 45, { flush: true }));
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
  place(u, N('Dressing sur mesure en noyer'), Db.x0 + 30, (Db.y0 + Db.y1) / 2 + 45, 270, { w: Db.y1 - Db.y0 - 125, h: 275, d: 55 });
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
  // Dans la version plus grande, la porte du fond tombe près du tabouret : on inverse la diagonale.
  if (roomy) { place(g, stool, hx - 115, hy - 60, 135); place(g, stool, hx + 115, hy + 60, 315); } else { place(g, stool, hx - 115, hy + 60, 45); place(g, stool, hx + 115, hy - 60, 225); } place(g, ring, hx, hy, 0, { z: 215, w: 150, d: 150, h: 118 });
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
  const ry = sty + SQ.w / 2 - 115, xw = stx - SQ.d / 2 + 115, xe = stx + SQ.d * 0.2 + 3;
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

// ——— Outils communs aux maisons d'architecte : meubles du style d'Anna, pièces meublées à partir de leurs murs ———
function kit() {
  const N = named, G_ = getItem;
  return {
    N, G_,
    sofa: pick('canape', ['bouclé.*(pablian|shirina|eracli)', 'bouclé', 'lin', 'chenille'], (i) => i.w >= 200 && i.w <= 290 && i.d <= 110),
    arm: pick('fauteuil', ['bouclé', 'noyer', 'velours']), rug: pick('tapis', ['laine', 'jute', 'sisal'], (i) => Math.max(i.w, i.d) >= 220),
    low: pick('table-basse', ['noyer', 'bois foncé'], (i) => i.w >= 100), side: pick('table-basse', ['appoint', 'rond', 'bois'], (i) => i.w <= 70),
    buffet: N('Buffet noyer à portes cintrées'), lamp: pick('lampe', ['céramique', 'lin']), plant: pick('plante', ['ficus', 'plante']), curtain: pick('rideau', ['']),
    ring: N('Lustre couronne noir'), chevet: pick('chevet', ['noyer', 'bois foncé', 'manguier']), bench: pick('rangement', ['banc']),
    bed: pick('lit', ['velours', 'bouclé', 'tissu'], (i) => i.w >= 175 && i.w <= 215) || pick('lit', [], (i) => i.w >= 155),
    wc: G_('g-wc-wc-suspendu-avec-b-ti-support'), shower: G_('g-douche-douche-l-italienne-140-90'),
    chair: pick('chaise', ['cannage', 'rotin', 'chêne']), stool: pick('tabouret', ['bois', 'cannage', 'tissu']),
    dome: N('Suspension dôme en laiton'), vase: N('Vase et branches feuillues'), cush: N('Série de coussins'), books: N('Bibliothèque sur mesure jusqu’au plafond'),
    lounge: pick('chaise-ext', ['canapé', 'fauteuil', 'lounge']), outChair: pick('chaise-ext', ['chaise', 'fauteuil']),
    INK: 'Grand tableau encre sur toile', TAP: 'Tapisserie de forêt', EARTH: 'Grande toile terre et ocre', cream: '#e8dfcf', bronze: '#4a3426',
    top: (d) => d?.h ?? 75,
  };
}
const INWARD = { n: { x: 0, y: 1 }, s: { x: 0, y: -1 }, o: { x: 1, y: 0 }, e: { x: -1, y: 0 } };
/** Milieu d'un côté de la pièce (axe des murs) et normale vers l'intérieur. */
function sideOf(B, side) {
  const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
  return { p: { n: { x: cx, y: B.y0 }, s: { x: cx, y: B.y1 }, o: { x: B.x0, y: cy }, e: { x: B.x1, y: cy } }[side], n: INWARD[side], len: side === 'n' || side === 's' ? B.x1 - B.x0 : B.y1 - B.y0, depth: side === 'n' || side === 's' ? B.y1 - B.y0 : B.x1 - B.x0 };
}
const at = (p, n, d, al, a = 0) => ({ x: p.x + n.x * d + (al ? al.x * a : 0), y: p.y + n.y * d + (al ? al.y * a : 0) });
/** Revêt la face extérieure des murs dont le milieu passe le test (façades mixtes pierre et enduit). */
function outerFacade(lv, test, mat) {
  const a = syncRooms(lv);
  for (const w of lv.walls) {
    const A = lv.nodes[w.a], B = lv.nodes[w.b];
    if (!test((A.x + B.x) / 2, (A.y + B.y) / 2)) continue;
    for (const s of ['L', 'R']) if (a.sideRoom.get(`${w.id}:${s}`) === undefined) w[`mat${s}`] = mat;
  }
}
/** Pose un meuble contre le plus long pan de mur libre de la pièce (sans porte ni fenêtre). */
function againstWall(lv, room, def, extra = {}) {
  if (!def) return;
  const sp = ['n', 's', 'e', 'o'].flatMap((sd) => spansOf(lv, room, sd)).sort((a, b) => b.len - a.len)[0]; if (!sp) return;
  const c = spanMid(sp), d = extra.d ?? def.d ?? 40, off = sp.t + d / 2 + 3;
  place(lv, def, c.x + sp.n.x * off, c.y + sp.n.y * off, facing(sp.n), { ...extra, w: Math.min(extra.w ?? def.w, sp.len - 20) });
}
function hangArt(K, lv, room, side, name, w, h, z) {
  const sp = spansOf(lv, room, side)[0]; if (!sp) return;
  const W = Math.min(w, sp.len - 30), H = (h * W) / w, c = spanMid(sp);
  place(lv, K.N(name), c.x + sp.n.x * (sp.t + 2), c.y + sp.n.y * (sp.t + 2), facing(sp.n), { w: W, h: H, z: z ?? 150 - H / 2 });
}
function composeWall(K, lv, room, side, furn, art, aw, ah) {
  const sp = spansOf(lv, room, side)[0]; if (!sp || !furn) return;
  const c = spanMid(sp), F = Math.min(furn.w, sp.len - 20), ft = furn.h ?? 75, off = sp.t + (furn.d ?? 45) / 2 + 3, x = c.x + sp.n.x * off, y = c.y + sp.n.y * off, al = { x: sp.n.y, y: -sp.n.x };
  place(lv, furn, x, y, facing(sp.n), { w: F });
  if (art) { const W = Math.min(aw, F + 30), H = (ah * W) / aw; place(lv, K.N(art), c.x + sp.n.x * (sp.t + 2), c.y + sp.n.y * (sp.t + 2), facing(sp.n), { w: W, h: H, z: ft + 32 }); }
  for (const k of [-1, 1]) place(lv, K.lamp, x + al.x * k * (F / 2 - 24), y + al.y * k * (F / 2 - 24), 0, { z: ft });
  place(lv, K.vase, x, y, 0, { z: ft, w: 30, d: 30, h: 60 });
}
function curtainsFor(K, lv, room, color) {
  for (const c of windowsOf(lv, room)) for (const k of [-1, 1]) { const al = { x: c.n.y, y: -c.n.x }, d = c.w / 2 + 34; place(lv, K.curtain, c.x + al.x * k * d + c.n.x * (c.t + 12), c.y + al.y * k * d + c.n.y * (c.t + 12), facing(c.n), { w: 70, h: c.top, color }); }
}
/** Salon : cheminée sur un mur, canapés face à face, fauteuils face au feu. */
function furnishSalon(K, lv, name, fireSide, fireH, ringZ) {
  const B = boxOf(lv, name), S = sideOf(B, fireSide), n = S.n, al = { x: n.y, y: -n.x };
  place(lv, K.N('Cheminée monumentale pierre et noyer'), S.p.x + n.x * 42, S.p.y + n.y * 42, facing(n), { w: 360, h: fireH, d: 80 });
  const C = at(S.p, n, Math.min(S.depth * 0.48, 380));
  place(lv, K.rug, C.x, C.y, facing(n), { w: Math.min(450, S.len - 120), d: Math.min(570, S.depth - 160) });
  place(lv, K.low, C.x, C.y, facing(n), { w: 130, d: 70 }); place(lv, K.vase, C.x, C.y, 0, { z: K.top(K.low), w: 32, d: 32, h: 60 });
  for (const k of [-1, 1]) { const q = at(C, al, k * 255); place(lv, K.sofa, q.x, q.y, facing({ x: -al.x * k, y: -al.y * k })); const c2 = at(C, al, k * 285); place(lv, K.cush, c2.x, c2.y, facing({ x: -al.x * k, y: -al.y * k }), { w: 200, z: 44 }); }
  for (const k of [-1, 1]) { const q = at(C, n, 245, al, k * 95); place(lv, K.arm, q.x, q.y, facing({ x: -n.x, y: -n.y })); }
  const sd = at(C, n, 250); place(lv, K.side, sd.x, sd.y, 0); place(lv, K.lamp, sd.x, sd.y, 0, { z: K.top(K.side) });
  place(lv, K.ring, C.x, C.y, 0, { z: ringZ, w: 240, d: 240, h: 320 });
  place(lv, K.plant, B.x0 + 60, B.y0 + 60, 0);
}
function furnishDining(K, lv, name) {
  const B = boxOf(lv, name), dx = (B.x0 + B.x1) / 2, dy = (B.y0 + B.y1) / 2, wide = B.x1 - B.x0 >= B.y1 - B.y0, rot = wide ? 0 : 90;
  place(lv, K.rug, dx, dy, rot, { w: 440, d: 320 }); place(lv, K.N('Table en noyer massif'), dx, dy, rot, { w: 270, d: 105 });
  for (const k of [-1.2, -0.4, 0.4, 1.2]) {
    if (wide) { place(lv, K.chair, dx + k * 80, dy - 85, 0); place(lv, K.chair, dx + k * 80, dy + 85, 180); }
    else { place(lv, K.chair, dx - 85, dy + k * 80, 270); place(lv, K.chair, dx + 85, dy + k * 80, 90); }
  }
  for (const k of [-1, 1]) place(lv, K.vase, wide ? dx + k * 90 : dx, wide ? dy : dy + k * 90, 0, { z: 76, w: 32, d: 32, h: 66 });
  place(lv, K.ring, dx, dy, 0, { z: Math.min(205, lv.height - 138), w: 180, d: 180, h: 128 });
}
/** Cuisine en U, mur du fond au nord : linéaire, piano et hotte, colonnes, grand îlot de 5 places. */
function furnishKitchen(K, lv, name) {
  const B = boxOf(lv, name), kx = (B.x0 + B.x1) / 2, runW = B.x1 - B.x0 - 90;
  place(lv, K.N('Linéaire noyer et marbre avec crédence'), kx - 15, B.y0 + 40, 0, { w: runW });
  place(lv, K.N('Piano de cuisson et hotte habillée'), kx, B.y0 + 44, 0, { w: 130, h: Math.min(300, lv.height - 10) });
  place(lv, K.N('Colonnes noyer et laiton'), B.x1 - 42, B.y0 + 205, 90, { w: 220, h: Math.min(300, lv.height - 10) });
  const isl = B.y0 + 222; place(lv, K.N('Îlot noyer et marbre'), kx - 30, isl, 0, { w: 320, d: 115 });
  for (const k of [-2, -1, 0, 1, 2]) place(lv, K.stool, kx - 30 + k * 62, isl + 80, 180);
  for (const k of [-1, 1]) place(lv, K.N('Lanterne laiton et verre'), kx - 30 + k * 95, isl, 0, { h: Math.min(150, lv.height - 180) });
  place(lv, K.vase, kx + 80, isl - 15, 0, { z: 94, w: 30, d: 30, h: 60 });
}
function furnishBedroom(K, lv, name, head, suite, shift = 0) {
  const B = boxOf(lv, name), S0 = sideOf(B, head), n = S0.n, al = { x: n.y, y: -n.x }, rot = facing(n), bed = K.bed, S = { ...S0, p: at(S0.p, al, shift) };
  const c = at(S.p, n, 120); place(lv, K.rug, at(S.p, n, 210).x, at(S.p, n, 210).y, rot, { w: 260, d: 280 }); place(lv, bed, c.x, c.y, rot);
  const cu = at(S.p, n, 62); place(lv, K.cush, cu.x, cu.y, rot, { w: 165, z: 62 });
  for (const k of [-1, 1]) { const q = at(S.p, n, 40, al, k * 125); place(lv, K.chevet, q.x, q.y, rot); place(lv, K.lamp, q.x, q.y, 0, { z: K.top(K.chevet) }); }
  if (suite) { const b = at(S.p, n, 270); place(lv, K.bench, b.x, b.y, rot); const dm = at(S.p, n, 180); place(lv, K.dome, dm.x, dm.y, 0, { h: Math.min(90, lv.height - 200) }); }
  else { const dm = at(S.p, n, 180); place(lv, K.dome, dm.x, dm.y, 0, { h: 70 }); }
}
function furnishShower(K, lv, name) {
  const B = boxOf(lv, name), cy = (B.y0 + B.y1) / 2;
  place(lv, K.shower, B.x0 + 78, B.y0 + 60, 0, { w: 120, d: 90 });
  place(lv, K.N('Double vasque noyer et pierre'), B.x1 - 32, cy + 30, 90, { w: Math.min(140, B.y1 - B.y0 - 200) });
  place(lv, K.wc, B.x0 + 38, B.y1 - 75, 270);
}
function furnishBath(K, lv, name) {
  const B = boxOf(lv, name);
  place(lv, K.N('Baignoire îlot ovale'), (B.x0 + B.x1) / 2, B.y0 + 62, 0, { w: 170, d: 78 });
  place(lv, K.N('Double vasque noyer et pierre'), B.x1 - 32, B.y0 + 245, 90, { w: 140 });
  place(lv, K.wc, B.x0 + 36, B.y1 - 80, 270);
}
function furnishWC(K, lv, name) {
  const B = boxOf(lv, name), cx = (B.x0 + B.x1) / 2;
  place(lv, K.wc, cx, B.y0 + 40, 0);
  place(lv, K.N('Vasque monobloc en marbre'), B.x1 - 28, B.y0 + 190, 90, { w: 70, d: 40 });
}
function furnishOffice(K, lv, name) {
  const B = boxOf(lv, name), cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
  place(lv, K.books, B.x0 + 32, cy, 270, { w: Math.min(260, B.y1 - B.y0 - 80), h: Math.min(280, lv.height - 15) });
  place(lv, K.rug, cx + 20, cy, 0, { w: 280, d: 220 }); place(lv, K.N('Table en noyer massif'), cx + 20, B.y0 + 100, 0, { w: 190, d: 85 }); place(lv, pick('siege', ['cuir', 'tissu']), cx + 20, B.y0 + 160, 180);
  place(lv, K.sofa, cx + 20, B.y1 - 62, 180); place(lv, K.cush, cx + 20, B.y1 - 40, 180, { w: 180, z: 44 });
}
function furnishGym(K, lv, name) {
  const B = boxOf(lv, name), cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
  againstWall(lv, name, K.G_('g-sport-rangement-halt-res'), { w: 200 });
  place(lv, K.rug, cx - 90, cy + 30, 0, { w: 220, d: 260, color: '#3a3733' }); place(lv, K.G_('g-sport-banc-de-musculation-r-glable'), cx - 90, cy + 30, 0);
  place(lv, K.G_('g-sport-tapis-de-course'), cx + 60, cy + 10, 90);
}
function furnishGarage(K, lv, name) {
  const B = boxOf(lv, name), y = B.y1 - 265, q = (B.x1 - B.x0) / 4;
  place(lv, K.N('Ferrari rouge'), B.x0 + q, y, 180); place(lv, K.N('Porsche 911 marron'), B.x1 - q, y, 180);
  for (const x of [B.x0 + q, B.x1 - q]) place(lv, K.dome, x, y, 0, { h: 80 });
}
/** Escalier quart tournant le long du mur sud du hall, rampe autour de la trémie à l'étage. */
function grandStair(K, g, u, hall) {
  const Hb = boxOf(g, hall), SQ = K.N('Escalier américain quart tournant'), rail = K.N('Garde-corps bois classique');
  const stx = Hb.x1 - 105 - SQ.d / 2, sty = Hb.y1 - SQ.w / 2 - 2;
  place(g, SQ, stx, sty, 270);
  const ry = sty + SQ.w / 2 - 115, xw = stx - SQ.d / 2 + 115, xe = stx + SQ.d * 0.2 + 3;
  place(u, rail, (xw + xe) / 2, ry - 4, 0, { w: xe - xw }); place(u, rail, xe, ry + 57, 90, { w: 115 });
}
/** Terrain : plateforme plate autour de la maison, restanques qui descendent au sud, colline au nord. */
function hillSite(p, cx, cy, keep, steps, rise) {
  shapeTerrain(p, 'flat', {});
  const m = ensureTerrain(p), half = (T_N - 1) / 2;
  p.site.terrain.cx = cx; p.site.terrain.cy = cy; m.cx = cx; m.cy = cy;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + cx, y = (j - half) * 100 + cy;
    let h = 0;
    for (const [y0, dh] of steps) if (y > y0) h = dh;
    const d = Math.hypot(Math.max(keep[0] - x, 0, x - keep[2]), Math.max(keep[1] - y, 0, y - keep[3]));
    const roll = 140 * Math.sin(x / 1700 + 0.4) + 90 * Math.sin(y / 900 - x / 1300);
    if (y < keep[1]) h = smooth01((keep[1] - y - 200) / 2600) * rise + smooth01((d - 300) / 2000) * roll;
    else if (d > 300) h += smooth01((d - 300) / 2500) * roll * 0.6;
    m.h[j * T_N + i] = Math.round(h);
  }
  commitTerrain(p);
  p.site.altitude = 0;
}

/** Mas provençal : pierre et enduit blanc, tuiles canal, volets bois, arcades sur la piscine, oliviers et restanques. */
function houseMas() {
  const p = newProject('Mas provençal');
  p.style = { facade: 'facade_pierre', roof: 'roof_terracotta', joinery: '#4a3a2c' };
  p.roof = { type: 'none', pitch: 30, overhang: 40, ridge: 'auto' };
  p.site.env = 'campagne';
  const K = kit(), N = K.N, SH = '#6e5a46', WIN = { name: 'Fenêtre à petits carreaux', muntins: [2, 3], shutters: SH }, FR = { name: 'Porte-fenêtre à petits carreaux', muntins: [2, 4], shutters: SH };
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 310; g.slab = 25;
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });
  outline(g, [[0, 0], [2400, 0], [2400, -300], [3000, -300], [3000, 800], [2400, 800], [2400, 1000], [0, 1000]], 45);
  partition(g, 700, 0, 700, 1000, 25); partition(g, 1300, 0, 1300, 1000, 15); partition(g, 700, 600, 1300, 600, 15);
  partition(g, 1300, 450, 2400, 450, 15); partition(g, 1300, 570, 2400, 570, 15); partition(g, 2400, 0, 2400, 800, 25);
  partition(g, 1450, 0, 1450, 450, 12); partition(g, 1750, 0, 1750, 450, 12); partition(g, 2000, 570, 2000, 1000, 12); partition(g, 2400, 330, 3000, 330, 20);
  // Loggia à arcades, côté piscine.
  wallLine(g, 1300, 1000, 1300, 1350, 40); wallLine(g, 1300, 1350, 2100, 1350, 40); wallLine(g, 2100, 1350, 2100, 1000, 40);
  const ARC = { name: 'Arcade en pierre', stone: 'facade_pierre' };
  for (const x of [1433, 1700, 1967]) open(g, x, 1350, 'arch', 210, 280, 0, ARC);
  open(g, 2100, 1175, 'arch', 200, 270, 0, ARC);
  // Arrivée et circulations.
  open(g, 1000, 0, 'entry', 180, 260, 0, { name: "Porte d'entrée double", leaves: 2, color: '#5a4332' });
  open(g, 700, 200, 'arch', 160, 260, 0, { name: 'Arche' }); open(g, 700, 800, 'arch', 220, 270, 0, { name: 'Arche' });
  open(g, 1300, 510, 'arch', 84, 240, 0, { name: 'Arche' }); open(g, 1300, 820, 'arch', 220, 260, 0, { name: 'Arche' });
  open(g, 1375, 450, 'door', 73, 215, 0); open(g, 1600, 450, 'door', 83, 215, 0); open(g, 2050, 450, 'door', 93, 215, 0); open(g, 2200, 570, 'door', 83, 215, 0); open(g, 2000, 700, 'door', 83, 215, 0);
  open(g, 2400, 510, 'door', 93, 215, 0); open(g, 2700, 330, 'door', 83, 215, 0);
  for (const x of [2560, 2840]) open(g, x, -300, 'garage', 240, 230, 0, { name: 'Porte de garage', color: '#5a4332' });
  // Fenêtres à volets.
  open(g, 0, 170, 'window2', 120, 220, 60, WIN); open(g, 0, 830, 'window2', 120, 220, 60, WIN); open(g, 350, 0, 'window2', 120, 160, 100, WIN);
  open(g, 230, 1000, 'window2', 150, 245, 0, FR); open(g, 520, 1000, 'window2', 150, 245, 0, FR);
  open(g, 1000, 1000, 'window2', 150, 245, 0, FR); open(g, 820, 0, 'window2', 70, 120, 110, WIN);
  open(g, 1450, 1000, 'window2', 140, 245, 0, FR); open(g, 1700, 1000, 'window2', 140, 245, 0, FR); open(g, 1900, 1000, 'window2', 120, 245, 0, FR);
  open(g, 2200, 1000, 'window2', 110, 140, 100, WIN); open(g, 1690, 0, 'window2', 90, 120, 110, WIN); open(g, 2075, 0, 'window2', 150, 160, 90, WIN);
  open(g, 3000, 560, 'window2', 150, 160, 90, WIN); open(g, 2700, 800, 'window2', 200, 245, 0, FR); open(g, 3000, 50, 'window2', 90, 120, 110, WIN);
  const oak = 'oak_light', tc = 'tile_terracotta', lime = 'paint_lin', white = 'paint_all_white';
  setRoom(g, 350, 500, 'salon', 'Grand salon', { floor: 'oak_natural', paint: lime });
  setRoom(g, 1000, 300, 'entree', 'Hall', { floor: tc, paint: lime });
  setRoom(g, 1000, 800, 'repas', 'Salle à manger', { floor: tc, paint: white });
  setRoom(g, 1375, 225, 'wc', 'WC', { floor: tc, paint: 'wall_pierre_blonde' });
  setRoom(g, 1600, 225, 'douche', "Salle d'eau", { floor: 'tile_marble', paint: lime });
  setRoom(g, 2075, 225, 'bureau', 'Bureau, jeux ou chambre', { floor: oak, paint: 'paint_green_smoke' });
  setRoom(g, 1850, 510, 'couloir', 'Couloir', { floor: tc, paint: lime });
  setRoom(g, 1650, 785, 'cuisine', 'Cuisine', { floor: tc, paint: white });
  setRoom(g, 2200, 785, 'buanderie', 'Arrière-cuisine', { floor: tc, paint: lime });
  setRoom(g, 2700, 0, 'garage', 'Garage', { floor: 'concrete_floor', paint: 'paint_skimming' });
  setRoom(g, 2700, 560, 'piece', 'Salle de sport', { floor: oak, paint: 'wall_bois' });
  setRoom(g, 1700, 1175, 'terrasse', 'Loggia', { floor: tc, paint: 'wall_pierre_blonde' });
  clad(g, 350, 500, 'wall_pierre_blonde', 'o');
  p.entry = 0; syncRooms(g);

  // ——— Étage : les quatre chambres au même niveau, la suite au bout ———
  const u = newLevel('Étage', 280);
  outline(u, [[700, 0], [2400, 0], [2400, 1000], [700, 1000]], 40);
  partition(u, 1300, 0, 1300, 1000, 15); partition(u, 700, 600, 1300, 600, 15); partition(u, 1300, 450, 1950, 450, 12); partition(u, 1300, 570, 1950, 570, 12);
  partition(u, 1950, 450, 1950, 1000, 15); partition(u, 1950, 450, 2400, 450, 12); partition(u, 2100, 0, 2100, 450, 15); partition(u, 1550, 0, 1550, 450, 12); partition(u, 1700, 0, 1700, 450, 12); partition(u, 1650, 570, 1650, 1000, 12);
  open(u, 1300, 510, 'arch', 84, 230, 0, { name: 'Arche' }); open(u, 1248, 600, 'door', 73, 215, 0);
  open(u, 1425, 450, 'door', 83, 215, 0); open(u, 1625, 450, 'door', 73, 215, 0); open(u, 1850, 450, 'door', 83, 215, 0); open(u, 1475, 570, 'door', 83, 215, 0);
  open(u, 1950, 510, 'door', 86, 225, 0, { name: 'Porte de la suite' }); open(u, 1950, 800, 'door', 83, 215, 0); open(u, 2250, 450, 'pocket', 100, 220, 0, { name: 'Porte à galandage' });
  open(u, 1000, 0, 'window2', 160, 180, 70, WIN); open(u, 850, 1000, 'window2', 130, 225, 0, FR); open(u, 1150, 1000, 'window2', 110, 150, 80, WIN);
  open(u, 1475, 1000, 'window2', 130, 225, 0, FR); open(u, 1800, 1000, 'window2', 110, 150, 80, WIN);
  open(u, 2100, 1000, 'window2', 140, 225, 0, FR); open(u, 2300, 1000, 'window2', 110, 150, 80, WIN); open(u, 2400, 720, 'window2', 120, 150, 80, WIN);
  open(u, 1475, 0, 'window2', 70, 120, 100, WIN); open(u, 1900, 0, 'window2', 120, 140, 90, WIN); open(u, 2250, 0, 'window2', 100, 130, 100, WIN);
  setRoom(u, 1000, 300, 'couloir', 'Palier', { floor: 'oak_natural', paint: lime });
  setRoom(u, 1000, 800, 'enfant', 'Chambre 2 (bébé)', { floor: oak, paint: 'paint_all_white' });
  setRoom(u, 1625, 510, 'couloir', 'Couloir', { floor: 'oak_natural', paint: lime });
  setRoom(u, 1425, 225, 'douche', "Salle d'eau", { floor: 'tile_marble', paint: lime });
  setRoom(u, 1625, 225, 'wc', 'WC', { floor: 'tile_marble', paint: lime });
  setRoom(u, 1900, 225, 'chambre', 'Chambre 3', { floor: oak, paint: 'paint_skimming' });
  setRoom(u, 1475, 785, 'chambre', 'Chambre 4', { floor: oak, paint: 'paint_mizzle' });
  setRoom(u, 1800, 785, 'dressing', 'Dressing', { floor: 'oak_natural', paint: 'wall_noyer' });
  setRoom(u, 2175, 725, 'parentale', 'Suite parentale', { floor: 'oak_natural', paint: lime });
  setRoom(u, 2250, 225, 'sdb', 'Salle de bain parentale', { floor: 'tile_marble', paint: 'wall_pierre_blonde' });
  p.levels.push(u); syncRooms(u);
  outerFacade(g, (x, y) => x > 2400, 'facade_enduit');

  const R = (lv, x0, y0, x1, y1, type, ridge, pitch, extra = {}) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type, pitch, overhang: 40, ridge, wallH: 0, ...extra });
  p.roofs = [
    R(u, 700, 0, 2400, 1000, 'gable', 'x', 30),
    R(g, 0, 0, 700, 1000, 'gable', 'x', 30, { wallH: 560, vault: true, lining: 'wall_bois', endB: true }),
    R(g, 2400, -300, 3000, 800, 'gable', 'y', 28, { flushA: true }),
    R(g, 1300, 1000, 2100, 1350, 'flat', 'x', 0),
  ];

  // ——— Meubles ———
  furnishSalon(K, g, 'Grand salon', 'o', 520, 380); curtainsFor(K, g, 'Grand salon', K.cream); composeWall(K, g, 'Grand salon', 'n', K.buffet, K.EARTH, 190, 130);
  place(g, N('Dressing sur mesure en noyer'), 800, 42, 0, { w: 170, h: 260, d: 55 });
  const Hb = boxOf(g, 'Hall'); place(g, N('Table piédestal en plâtre'), (Hb.x0 + Hb.x1) / 2 + 40, Hb.y0 + 190, 0); place(g, N('Grande jarre et branches fleuries'), (Hb.x0 + Hb.x1) / 2 + 40, Hb.y0 + 190, 0, { z: 80 });
  place(g, K.ring, (Hb.x0 + Hb.x1) / 2, Hb.y0 + 250, 0, { z: g.height - 128, w: 150, d: 150, h: 118 });
  grandStair(K, g, u, 'Hall');
  furnishDining(K, g, 'Salle à manger'); curtainsFor(K, g, 'Salle à manger', K.cream);
  furnishKitchen(K, g, 'Cuisine');
  const Ar = boxOf(g, 'Arrière-cuisine'); place(g, K.G_('g-electro-lave-linge-60-cm'), Ar.x1 - 40, Ar.y0 + 60, 90); place(g, K.G_('g-electro-s-che-linge-60-cm'), Ar.x1 - 40, Ar.y0 + 125, 90); place(g, N('Linéaire noyer et marbre'), Ar.x1 - 35, Ar.y0 + 290, 90, { w: 200 });
  furnishWC(K, g, 'WC'); furnishShower(K, g, "Salle d'eau"); furnishOffice(K, g, 'Bureau, jeux ou chambre'); furnishGym(K, g, 'Salle de sport'); furnishGarage(K, g, 'Garage');
  hangArt(K, g, 'Couloir', 'n', K.INK, 150, 100); hangArt(K, g, 'Salle de sport', 'o', K.EARTH, 200, 130);
  const Pa = boxOf(u, 'Palier'); place(u, K.books, Pa.x0 + 34, Pa.y0 + 250, 270, { w: 420, h: 265, d: 38 });
  place(u, N('Méridienne en bouclette'), (Pa.x0 + Pa.x1) / 2, 62, 0); place(u, K.rug, (Pa.x0 + Pa.x1) / 2, 150, 0, { w: 260, d: 170 });
  furnishBedroom(K, u, 'Chambre 2 (bébé)', 'o'); furnishBedroom(K, u, 'Chambre 3', 'e'); furnishBedroom(K, u, 'Chambre 4', 'o'); furnishBedroom(K, u, 'Suite parentale', 'e', true);
  const Db = boxOf(u, 'Dressing'); place(u, N('Dressing sur mesure en noyer'), Db.x0 + 30, (Db.y0 + Db.y1) / 2, 270, { w: Db.y1 - Db.y0 - 40, h: 260, d: 55 });
  furnishShower(K, u, "Salle d'eau"); furnishWC(K, u, 'WC'); furnishBath(K, u, 'Salle de bain parentale');
  for (const r of ['Chambre 2 (bébé)', 'Chambre 3', 'Chambre 4', 'Suite parentale']) curtainsFor(K, u, r, K.cream);
  hangArt(K, u, 'Suite parentale', 'o', K.EARTH, 170, 100, 160);

  // ——— Dehors : loggia, piscine, oliviers, lavandes et restanques ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), slab = K.G_('g-terrasse-terrasse-pierre'), olive = N('Olivier'), cyp = N('Cyprès'), lav = N('Massif de lavande'), wallS = N('Mur de soutènement pierre 3 m'), steps = N('Marches extérieures 1,20 m');
  out(N('Cheminée d’extérieur en pierre'), 1345, 1175, 90, { w: 220, h: 300, d: 60 }); out(N('Table en noyer massif'), 1720, 1175, 0, { w: 260, d: 95 });
  for (const x of [1630, 1720, 1810]) { out(K.outChair, x, 1110, 0); out(K.outChair, x, 1240, 180); }
  out(N('Pergola à lames en bois'), 2350, 1200, 0, { w: 500, d: 380, h: 290 }); out(N('Cuisine d’été en pierre 4 m'), 2350, 1050, 0, { w: 320 });
  out(K.rug, 2350, 1250, 0, { w: 300, d: 200, color: '#c9bda8' }); out(K.lounge, 2240, 1260, 90); out(K.lounge, 2460, 1260, 270);
  out(slab, 1300, 1700, 0, { w: 2900, d: 700 }); out(slab, -200, 1300, 0, { w: 1200, d: 500 });
  out(N('Piscine 8 × 4'), 1700, 1850, 0, { w: 1200, d: 500, z: 10 });
  for (const x of [1250, 1450, 1950, 2150]) out(N('Bain de soleil teck et matelas blanc'), x, 2200, 0, { z: 10 });
  out(slab, 1500, 2230, 0, { w: 1800, d: 260 });
  for (const x of [-300, 600, 2900, 3600]) out(olive, x, 1900, 0, { w: 480, d: 480, h: 450 });
  for (let i = 0; i < 9; i++) out(wallS, -600 + i * 600, 2550, 0, { w: 600, h: 140 });
  out(steps, 1500, 2600, 0, { w: 160 });
  for (let i = 0; i < 9; i++) out(wallS, -600 + i * 600, 3450, 0, { w: 600, h: 140 });
  for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) out(olive, -300 + i * 650 + (r % 2) * 300, 2900 + r * 330 + (r > 1 ? 330 : 0), 0, { w: 420, d: 420, h: 400 });
  for (let i = 0; i < 6; i++) out(lav, -400 + i * 320, 1580, 0, { w: 300 });
  for (const x of [-500, 3500]) for (const y of [300, 900]) out(cyp, x, y, 0);
  // Cour d'arrivée en gravier, allée de cyprès et oliviers en pots.
  for (const y of [-1800, -2400, -3000, -3600, -4200]) { out(cyp, 700, y, 0); out(cyp, 1300, y, 0); }
  for (const [x, y] of [[300, -400], [1700, -500], [-400, -900]]) out(olive, x, y, 0, { w: 520, d: 520, h: 470 });
  for (const x of [450, 1550]) out(lav, x, -120, 0, { w: 400 });
  out(N('Conduit de cheminée en pierre'), -62, 500, 90, { w: 150, d: 70, h: 1050 });

  hillSite(p, 1300, -600, [-1500, -1400, 4000, 2500], [[2550, -140], [3450, -280]], 900);
  const m = ensureTerrain(p), half = (T_N - 1) / 2, gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) { const x = (i - half) * 100 + 1300, y = (j - half) * 100 - 600; if ((x >= 800 && x <= 1200 && y <= -1300) || (x >= -200 && x <= 3200 && y >= -1300 && y <= -350)) m.p[j * T_N + i] = gravel; }
  commitTerrain(p);
  p.site.parcel = { pts: [{ x: -3000, y: -5500 }, { x: 5000, y: -5500 }, { x: 5000, y: 4500 }, { x: -3000, y: 4500 }] };
  return p;
}

/** Villa contemporaine : volumes en travertin, grandes dalles blanches en porte-à-faux, baies toute hauteur, piscine à débordement. */
function houseVilla() {
  const p = newProject('Villa contemporaine');
  p.style = { facade: 'facade_travertin', roof: 'roof_grey', joinery: '#2b2b2c' };
  p.roof = { type: 'none', pitch: 0, overhang: 0, ridge: 'auto' };
  p.site.env = 'campagne';
  const K = kit(), N = K.N, GLASS = { name: 'Baie coulissante toute hauteur' }, SLOT = { name: 'Bandeau vitré' };
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 330; g.slab = 30;
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });
  outline(g, [[0, 0], [2150, 0], [2150, -200], [2700, -200], [2700, 1000], [0, 1000]], 30);
  partition(g, 700, 0, 700, 1000, 20); partition(g, 1300, 0, 1300, 1000, 15); partition(g, 700, 600, 1300, 600, 15);
  partition(g, 1300, 450, 2700, 450, 15); partition(g, 1300, 570, 2700, 570, 15); partition(g, 1450, 0, 1450, 450, 12); partition(g, 1750, 0, 1750, 450, 12); partition(g, 2150, 0, 2150, 450, 15); partition(g, 2050, 570, 2050, 1000, 12);
  open(g, 1000, 0, 'entry', 140, 290, 0, { name: "Porte d'entrée pivotante", color: '#2b2b2c' });
  open(g, 700, 150, 'passage', 140, 260, 0); open(g, 700, 800, 'passage', 260, 280, 0); open(g, 1300, 510, 'passage', 84, 240, 0); open(g, 1300, 800, 'passage', 300, 280, 0);
  open(g, 1375, 450, 'door', 73, 220, 0); open(g, 1600, 450, 'door', 83, 220, 0); open(g, 1950, 450, 'door', 93, 220, 0); open(g, 2425, 450, 'door', 93, 220, 0); open(g, 2300, 570, 'door', 93, 220, 0); open(g, 1700, 570, 'door', 83, 220, 0);
  for (const x of [2290, 2560]) open(g, x, -200, 'garage', 240, 240, 0, { name: 'Porte de garage', color: '#2b2b2c' });
  // Séjour en double hauteur : vitré sur le jardin et à l'ouest, grand mur plein en travertin pour la cheminée.
  open(g, 175, 1000, 'bay', 300, 600, 0, GLASS); open(g, 525, 1000, 'bay', 300, 600, 0, GLASS); open(g, 0, 500, 'fixed', 560, 600, 0, { name: 'Vitrage fixe toute hauteur' });
  open(g, 1000, 1000, 'bay', 480, 300, 0, GLASS); open(g, 1675, 1000, 'bay', 620, 300, 0, GLASS); open(g, 2375, 1000, 'bay', 520, 300, 0, GLASS); open(g, 2700, 785, 'bay', 300, 300, 0, GLASS);
  open(g, 1220, 0, 'fixed', 60, 280, 10, SLOT); open(g, 1600, 0, 'fixed', 180, 50, 220, SLOT); open(g, 1950, 0, 'fixed', 300, 70, 170, SLOT); open(g, 2700, 120, 'fixed', 60, 230, 20, SLOT);
  const sand = 'dalle_pierre', white = 'paint_all_white', lin = 'paint_lin';
  setRoom(g, 350, 500, 'salon', 'Grand salon', { floor: sand, paint: white });
  setRoom(g, 1000, 300, 'entree', 'Entrée', { floor: sand, paint: white });
  setRoom(g, 1000, 800, 'repas', 'Salle à manger', { floor: sand, paint: white });
  setRoom(g, 1375, 225, 'wc', 'WC', { floor: sand, paint: 'wall_pierre_blonde' });
  setRoom(g, 1600, 225, 'douche', "Salle d'eau", { floor: sand, paint: lin });
  setRoom(g, 1950, 225, 'bureau', 'Bureau, jeux ou chambre', { floor: 'oak_light', paint: lin });
  setRoom(g, 2000, 510, 'couloir', 'Couloir', { floor: sand, paint: white });
  setRoom(g, 1675, 785, 'cuisine', 'Cuisine', { floor: sand, paint: white });
  setRoom(g, 2375, 785, 'piece', 'Salle de sport', { floor: 'oak_light', paint: 'wall_bois' });
  setRoom(g, 2425, 100, 'garage', 'Garage', { floor: 'concrete_floor', paint: 'paint_skimming' });
  clad(g, 350, 500, 'wall_pierre_blonde', 'n');
  p.entry = 0; syncRooms(g);

  // ——— Étage : chambres et suite, le toit du garage devient une terrasse ———
  const u = newLevel('Étage', 300); u.slab = 30;
  outline(u, [[700, 0], [2400, 0], [2400, 1000], [700, 1000]], 30);
  partition(u, 1300, 0, 1300, 1000, 15); partition(u, 700, 600, 1300, 600, 15); partition(u, 1300, 450, 1950, 450, 12); partition(u, 1300, 570, 1950, 570, 12);
  partition(u, 1950, 450, 1950, 1000, 15); partition(u, 1950, 450, 2400, 450, 12); partition(u, 2100, 0, 2100, 450, 15); partition(u, 1550, 0, 1550, 450, 12); partition(u, 1700, 0, 1700, 450, 12); partition(u, 1650, 570, 1650, 1000, 12);
  open(u, 1300, 510, 'passage', 84, 240, 0); open(u, 780, 600, 'door', 83, 225, 0);
  open(u, 1425, 450, 'door', 83, 225, 0); open(u, 1625, 450, 'door', 73, 225, 0); open(u, 1850, 450, 'door', 83, 225, 0); open(u, 1475, 570, 'door', 83, 225, 0);
  open(u, 1950, 510, 'door', 86, 235, 0, { name: 'Porte de la suite' }); open(u, 1950, 800, 'door', 83, 225, 0); open(u, 2250, 450, 'pocket', 100, 230, 0, { name: 'Porte à galandage' });
  open(u, 1000, 1000, 'bay', 300, 270, 0, GLASS); open(u, 1475, 1000, 'bay', 250, 270, 0, GLASS); open(u, 2175, 1000, 'bay', 360, 270, 0, GLASS); open(u, 2400, 905, 'bay', 150, 270, 0, { name: 'Porte-fenêtre sur la terrasse' });
  open(u, 1000, 0, 'fixed', 360, 70, 180, SLOT); open(u, 1460, 0, 'fixed', 120, 50, 215, SLOT); open(u, 1900, 0, 'fixed', 260, 120, 100, SLOT); open(u, 2250, 0, 'fixed', 200, 60, 190, SLOT); open(u, 1800, 1000, 'fixed', 120, 270, 0, SLOT);
  setRoom(u, 1000, 300, 'couloir', 'Palier', { floor: 'oak_light', paint: white });
  setRoom(u, 1000, 800, 'enfant', 'Chambre 2 (bébé)', { floor: 'oak_light', paint: white });
  setRoom(u, 1625, 510, 'couloir', 'Couloir', { floor: 'oak_light', paint: white });
  setRoom(u, 1425, 225, 'douche', "Salle d'eau", { floor: sand, paint: lin });
  setRoom(u, 1625, 225, 'wc', 'WC', { floor: sand, paint: lin });
  setRoom(u, 1900, 225, 'chambre', 'Chambre 3', { floor: 'oak_light', paint: lin });
  setRoom(u, 1475, 785, 'chambre', 'Chambre 4', { floor: 'oak_light', paint: 'paint_skimming' });
  setRoom(u, 1800, 785, 'dressing', 'Dressing', { floor: 'oak_light', paint: 'wall_bois' });
  setRoom(u, 2175, 725, 'parentale', 'Suite parentale', { floor: 'oak_light', paint: lin });
  setRoom(u, 2250, 225, 'sdb', 'Salle de bain parentale', { floor: sand, paint: 'wall_pierre_blonde' });
  p.levels.push(u); syncRooms(u);
  // Le mur de l'étage qui domine le séjour en double hauteur est vu de l'intérieur : enduit blanc, pas de pierre de façade.
  outerFacade(u, (x) => Math.abs(x - 700) < 1, 'paint_all_white');

  const Z = (lv, x0, y0, x1, y1, extra) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type: 'slab', pitch: 0, overhang: 60, ridge: 'x', wallH: 0, ...extra });
  p.roofs = [
    Z(u, 700, 0, 2400, 1000, { ovS: 230, ovN: 70, ovE: 40, ovW: 120, green: true }),
    Z(g, 0, 0, 700, 1000, { wallH: 630, ovS: 260, ovW: 160, ovN: 70, ovE: -16 }),
    Z(g, 2150, -200, 2700, 0, { ovS: 0, ovW: 50, ovN: 90, ovE: 60 }),
    Z(g, 2400, 0, 2700, 1000, { ovN: 0, ovW: 0, ovE: 60, ovS: 230 }),
  ];

  // ——— Meubles ———
  furnishSalon(K, g, 'Grand salon', 'n', 600, 290); composeWall(K, g, 'Grand salon', 'e', K.buffet, K.EARTH, 190, 130);
  const Eb = boxOf(g, 'Entrée'); place(g, N('Dressing sur mesure en noyer'), Eb.x0 + 110, Eb.y0 + 34, 0, { w: 170, h: 280, d: 55 });
  place(g, N('Table piédestal en plâtre'), (Eb.x0 + Eb.x1) / 2 + 60, Eb.y0 + 200, 0); place(g, N('Grande jarre et branches fleuries'), (Eb.x0 + Eb.x1) / 2 + 60, Eb.y0 + 200, 0, { z: 80 });
  // Escalier droit à garde-corps de verre le long du mur sud de l'entrée ; il arrive à l'est, face au couloir.
  const ST = N('Escalier garde-corps verre'), sx = 1000, sy = 600 - 7 - 50;
  place(g, ST, sx, sy, 90, { w: 100, d: 320 });
  const rail = N('Garde-corps verre 2 m'), H = g.height, need = (H - 205) / (H + g.slab), vx = sx - 160 * (1 - 2 * need) - 3;
  place(u, rail, (vx + sx + 163) / 2, sy - 52, 0, { w: sx + 163 - vx }); place(u, rail, vx - 2, sy, 90, { w: 104 });
  furnishDining(K, g, 'Salle à manger'); furnishKitchen(K, g, 'Cuisine');
  furnishWC(K, g, 'WC'); furnishShower(K, g, "Salle d'eau"); furnishOffice(K, g, 'Bureau, jeux ou chambre'); furnishGym(K, g, 'Salle de sport'); furnishGarage(K, g, 'Garage');
  hangArt(K, g, 'Couloir', 'n', K.INK, 150, 100); hangArt(K, g, 'Salle de sport', 'o', K.EARTH, 200, 130);
  const Pa = boxOf(u, 'Palier'); place(u, K.books, Pa.x0 + 34, Pa.y0 + 230, 270, { w: 380, h: 285, d: 38 });
  place(u, N('Méridienne en bouclette'), (Pa.x0 + Pa.x1) / 2, 62, 0); place(u, K.rug, (Pa.x0 + Pa.x1) / 2, 160, 0, { w: 260, d: 170 });
  furnishBedroom(K, u, 'Chambre 2 (bébé)', 'e'); furnishBedroom(K, u, 'Chambre 3', 'e'); furnishBedroom(K, u, 'Chambre 4', 'o'); furnishBedroom(K, u, 'Suite parentale', 'e', true, -50);
  const Db = boxOf(u, 'Dressing'); place(u, N('Dressing sur mesure en noyer'), Db.x0 + 30, (Db.y0 + Db.y1) / 2, 270, { w: Db.y1 - Db.y0 - 40, h: 270, d: 55 });
  furnishShower(K, u, "Salle d'eau"); furnishWC(K, u, 'WC'); furnishBath(K, u, 'Salle de bain parentale');
  for (const r of ['Chambre 2 (bébé)', 'Chambre 4', 'Suite parentale']) curtainsFor(K, u, r, K.cream);
  // Terrasse de la suite sur le toit du garage et de la salle de sport.
  const rf = N('Garde-corps verre 2 m');
  for (let i = 0; i < 5; i++) place(u, rf, 2690, 100 + i * 200, 90, { w: 200 });
  place(u, rf, 2550, 990, 0, { w: 290 }); place(u, N('Bain de soleil teck et matelas blanc'), 2560, 500, 0); place(u, K.plant, 2600, 120, 0);

  // ——— Dehors : grande terrasse en travertin, pergola à lames, piscine à débordement sur la vallée ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), slab = K.G_('g-terrasse-terrasse-pierre'), olive = N('Olivier'), cyp = N('Cyprès'), lav = N('Massif de lavande');
  out(slab, 1250, 1350, 0, { w: 3100, d: 700 }); out(slab, 1100, 1900, 0, { w: 2600, d: 400 });
  out(N('Pergola à lames en bois'), 1850, 1230, 0, { w: 1100, d: 440, h: 300 }); out(N('Cuisine d’été en pierre 4 m'), 2200, 1080, 0, { w: 320 });
  out(N('Table en noyer massif'), 1550, 1250, 0, { w: 280, d: 100 }); for (const x of [1440, 1550, 1660]) { out(K.outChair, x, 1180, 0); out(K.outChair, x, 1320, 180); }
  out(K.rug, 600, 1350, 0, { w: 380, d: 280, color: '#d8cfbf' }); out(K.lounge, 600, 1230, 0); out(K.lounge, 600, 1470, 180); out(K.lounge, 440, 1350, 90); out(K.low, 600, 1350, 0);
  out(N('Foyer rond d’extérieur'), 2500, 1420, 0);
  out(N('Piscine à débordement 14 × 4'), 1150, 1650, 0, { w: 1500, d: 400, z: 10 });
  for (const x of [500, 700, 900, 1500, 1700]) out(N('Bain de soleil teck et matelas blanc'), x, 1950, 180, { z: 10 });
  for (const x of [-350, 2900]) for (const y of [1200, 1800]) out(olive, x, y, 0, { w: 480, d: 480, h: 450 });
  for (let i = 0; i < 6; i++) out(lav, 300 + i * 350, 2150, 0, { w: 320 });
  for (let i = 0; i < 9; i++) out(N('Mur de soutènement pierre 3 m'), -800 + i * 600, 2300, 0, { w: 600, h: 160 });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) out(olive, -500 + i * 700 + (r % 2) * 350, 2700 + r * 450, 0, { w: 420, d: 420, h: 400 });
  // Arrivée : cour minérale, oliviers et alignement de cyprès.
  for (const [x, y] of [[300, -500], [1600, -600], [-400, -300]]) out(olive, x, y, 0, { w: 520, d: 520, h: 470 });
  for (const y of [-1800, -2400, -3000, -3600]) { out(cyp, 2250, y, 0); out(cyp, 2650, y, 0); }
  for (const x of [400, 1300]) out(lav, x, -110, 0, { w: 450 });

  hillSite(p, 1300, -600, [-1500, -1300, 4000, 2250], [[2300, -160], [3600, -420]], 1100);
  const m = ensureTerrain(p), half = (T_N - 1) / 2, gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) { const x = (i - half) * 100 + 1300, y = (j - half) * 100 - 600; if ((x >= 2150 && x <= 2750 && y <= -250) || (x >= -200 && x <= 3000 && y >= -1300 && y <= -250)) m.p[j * T_N + i] = gravel; }
  commitTerrain(p);
  p.site.parcel = { pts: [{ x: -3000, y: -5500 }, { x: 5000, y: -5500 }, { x: 5000, y: 4500 }, { x: -3000, y: 4500 }] };
  return p;
}

const byName = (re) => allItems().find((i) => re.test(i.name) && i.brand !== 'IKEA') || allItems().find((i) => re.test(i.name));
/** Garde-corps de verre posé par tronçons de 2 m le long d'un segment. */
function glassRail(lv, x0, y0, x1, y1) {
  const rail = named('Garde-corps verre 2 m'), L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 200)), rot = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? 0 : 90;
  for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; place(lv, rail, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rot, { w: L / n }); }
}

/** Maison à patio : un U autour d'une cour plantée et de son bassin, galerie vitrée en bas, galerie-bibliothèque en haut. */
function housePatio() {
  const p = newProject('Maison à patio');
  p.style = { facade: 'facade_enduit', roof: 'roof_grey', joinery: '#6b5a48' };
  p.roof = { type: 'none', pitch: 0, overhang: 0, ridge: 'auto' };
  p.site.env = 'campagne';
  const K = kit(), N = K.N, GL = { name: 'Baie coulissante sur le patio' }, BAND = { name: 'Bandeau vitré' };
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 300; g.slab = 30;
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });
  outline(g, [[0, 0], [2800, 0], [2800, 1800], [2100, 1800], [2100, 800], [700, 800], [700, 1800], [0, 1800]], 30);
  partition(g, 700, 0, 700, 800, 15); partition(g, 0, 800, 700, 800, 15); partition(g, 700, 550, 2800, 550, 15); partition(g, 2100, 800, 2800, 800, 15);
  partition(g, 1200, 0, 1200, 550, 12); partition(g, 1400, 0, 1400, 550, 12); partition(g, 1200, 250, 1400, 250, 10); partition(g, 2100, 0, 2100, 550, 15);
  partition(g, 0, 1450, 700, 1450, 15); partition(g, 2100, 1250, 2800, 1250, 12); partition(g, 2100, 1500, 2800, 1500, 15);
  open(g, 1120, 0, 'entry', 120, 260, 0, { name: "Porte d'entrée en chêne", color: '#8a6a4a' }); open(g, 2450, 0, 'garage', 500, 240, 0, { name: 'Porte de garage', color: '#6b5a48' });
  open(g, 350, 0, 'fixed', 420, 60, 165, BAND); open(g, 0, 570, 'bay', 260, 240, 0, GL); open(g, 700, 675, 'passage', 120, 240, 0); open(g, 350, 800, 'double', 166, 230, 0, { name: 'Porte double vitrée', glazed: true });
  open(g, 950, 550, 'passage', 200, 250, 0); open(g, 1200, 125, 'door', 73, 215, 0); open(g, 1300, 550, 'door', 73, 215, 0); open(g, 1750, 550, 'door', 83, 215, 0); open(g, 2450, 550, 'door', 93, 215, 0); open(g, 2100, 300, 'door', 83, 215, 0);
  for (const x of [950, 1400, 1850]) open(g, x, 800, 'bay', 420, 260, 0, GL);
  open(g, 2450, 800, 'door', 93, 215, 0); open(g, 1700, 0, 'fixed', 300, 60, 175, BAND);
  open(g, 700, 1125, 'bay', 500, 260, 0, GL); open(g, 0, 950, 'fixed', 100, 240, 10, BAND); open(g, 0, 1300, 'fixed', 100, 240, 10, BAND); open(g, 350, 1450, 'door', 83, 215, 0);
  open(g, 700, 1625, 'bay', 250, 240, 0, GL); open(g, 350, 1800, 'window2', 200, 150, 80, { name: 'Fenêtre' });
  open(g, 2100, 1025, 'bay', 300, 250, 0, GL); open(g, 2800, 1025, 'fixed', 200, 100, 120, BAND); open(g, 2450, 1250, 'door', 83, 215, 0); open(g, 2800, 1375, 'fixed', 120, 60, 170, BAND);
  open(g, 2450, 1500, 'door', 83, 215, 0); open(g, 2100, 1650, 'passage', 250, 260, 0); open(g, 2450, 1800, 'passage', 500, 260, 0);
  const oak = 'oak_light', stone = 'dalle_pierre', lin = 'paint_lin', white = 'paint_all_white';
  setRoom(g, 350, 400, 'cuisine', 'Cuisine et repas', { floor: oak, paint: white });
  setRoom(g, 950, 275, 'entree', 'Entrée', { floor: stone, paint: white });
  setRoom(g, 1300, 125, 'dressing', 'Vestiaire', { floor: oak, paint: 'wall_bois' });
  setRoom(g, 1300, 400, 'wc', 'WC', { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(g, 1750, 275, 'buanderie', 'Buanderie', { floor: stone, paint: lin });
  setRoom(g, 2450, 275, 'garage', 'Garage', { floor: 'concrete_floor', paint: 'paint_skimming' });
  setRoom(g, 1400, 675, 'couloir', 'Galerie', { floor: stone, paint: white });
  setRoom(g, 350, 1125, 'salon', 'Salon', { floor: oak, paint: lin });
  setRoom(g, 350, 1625, 'bureau', 'Bureau', { floor: oak, paint: 'paint_green_smoke' });
  setRoom(g, 2450, 1025, 'piece', 'Salle de sport', { floor: oak, paint: 'wall_bois' });
  setRoom(g, 2450, 1375, 'douche', 'Spa et salle d’eau', { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(g, 2450, 1650, 'terrasse', 'Pool house', { floor: stone, paint: 'wall_bois' });
  p.entry = 0; syncRooms(g);

  // ——— Étage : une barre en bois, galerie-bibliothèque au nord, chambres tournées vers le patio ———
  const u = newLevel('Étage', 280); u.slab = 30;
  outline(u, [[0, 0], [2100, 0], [2100, 800], [0, 800]], 25);
  partition(u, 0, 300, 2100, 300, 15); partition(u, 450, 0, 450, 300, 15); partition(u, 450, 300, 450, 800, 15); partition(u, 1950, 0, 1950, 300, 12);
  for (const x of [750, 1150, 1550, 1800]) partition(u, x, 300, x, 800, 12);
  open(u, 450, 150, 'door', 83, 215, 0); open(u, 225, 300, 'door', 83, 215, 0); open(u, 450, 550, 'door', 83, 215, 0);
  open(u, 950, 300, 'door', 83, 215, 0); open(u, 1350, 300, 'door', 83, 215, 0); open(u, 1735, 300, 'door', 73, 215, 0); open(u, 1875, 300, 'door', 83, 215, 0); open(u, 1950, 150, 'door', 73, 215, 0);
  open(u, 225, 800, 'bay', 300, 230, 0, { name: 'Baie sur la terrasse' }); open(u, 600, 800, 'fixed', 150, 120, 100, BAND);
  open(u, 950, 800, 'window2', 220, 200, 40, { name: 'Fenêtre sur le patio' }); open(u, 1350, 800, 'window2', 220, 200, 40, { name: 'Fenêtre sur le patio' }); open(u, 1675, 800, 'fixed', 120, 100, 120, BAND); open(u, 1950, 800, 'window2', 160, 200, 40, { name: 'Fenêtre sur le patio' });
  open(u, 2100, 700, 'bay', 140, 230, 0, { name: 'Baie sur la terrasse' }); open(u, 0, 550, 'fixed', 120, 200, 40, BAND);
  open(u, 750, 0, 'fixed', 300, 70, 170, BAND); open(u, 1350, 0, 'fixed', 500, 70, 170, BAND); open(u, 225, 0, 'fixed', 150, 60, 180, BAND);
  setRoom(u, 225, 150, 'dressing', 'Dressing', { floor: oak, paint: 'wall_bois' });
  setRoom(u, 1150, 150, 'couloir', 'Galerie-bibliothèque', { floor: oak, paint: lin });
  setRoom(u, 2025, 150, 'wc', 'WC', { floor: stone, paint: lin });
  setRoom(u, 225, 550, 'parentale', 'Suite parentale', { floor: oak, paint: lin });
  setRoom(u, 600, 550, 'sdb', 'Salle de bain parentale', { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(u, 950, 550, 'chambre', 'Chambre 2', { floor: oak, paint: white });
  setRoom(u, 1350, 550, 'enfant', 'Chambre 3 (bébé)', { floor: oak, paint: white });
  setRoom(u, 1675, 550, 'sdb', 'Salle de bain', { floor: stone, paint: lin });
  setRoom(u, 1950, 550, 'chambre', 'Chambre 4', { floor: oak, paint: 'paint_skimming' });
  p.levels.push(u); syncRooms(u);
  outerFacade(u, () => true, 'facade_bois');
  const Z = (lv, x0, y0, x1, y1, extra) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type: 'slab', pitch: 0, overhang: 60, ridge: 'x', wallH: 0, thick: 26, ...extra });
  p.roofs = [Z(u, 0, 0, 2100, 800, { ovN: 60, ovS: 120, ovW: 80, ovE: 60, green: true }), Z(g, 2100, 0, 2800, 800, { ovW: -15, ovN: 50, ovE: 50, ovS: 0 }), Z(g, 2100, 800, 2800, 1800, { ovN: 0, ovW: 40, ovE: 50, ovS: 80 }), Z(g, 0, 800, 700, 1800, { ovN: -15, ovE: 40, ovW: 50, ovS: 80 })];

  // ——— Mobilier japandi : chêne clair, rotin, lin, travertin ———
  const corner = byName(/Canapé d'angle modulaire 4 pièces avec méridienne droite/) || K.sofa, soma = byName(/^Soma - Table basse ovale/) || K.low, rattanArm = byName(/Fauteuil en bois d'acacia et rotin/) || K.arm;
  const roundT = byName(/Table à manger ronde en bois clair chêne D137/), cane = byName(/Chaise en tissu effet velours texturé beige, bois clair et cannage/) || K.chair, haiko = byName(/Suspension en coton écru et cannage rotin/) || K.dome, millor = byName(/Buffet scandinave finition bois clair chêne 3 portes/) || K.buffet;
  // Cuisine linéaire sous le bandeau vitré, îlot face au jardin, table ronde près de la baie.
  place(g, N('Linéaire noyer et marbre avec crédence'), 350, 42, 0, { w: 620 }); place(g, N('Colonnes noyer et laiton'), 42, 230, 90, { w: 200, h: 290 });
  place(g, N('Îlot noyer et marbre'), 380, 250, 0, { w: 300, d: 110 }); for (const k of [-1, 0, 1]) place(g, K.stool, 380 + k * 70, 330, 180);
  place(g, roundT, 250, 560, 0, { w: 137, d: 137 }); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; place(g, cane, 250 + Math.sin(a) * 92, 560 - Math.cos(a) * 92, (k * 60 + 180) % 360); }
  place(g, haiko, 250, 560, 0, { h: 60 }); place(g, millor, 560, 760, 180);
  // Salon : poêle contre le mur aveugle, canapé d'angle face au patio, fauteuils en rotin.
  place(g, N('Poêle à bois de masse'), 80, 1125, 90); place(g, corner, 380, 1180, 270); place(g, soma, 300, 1150, 0); place(g, K.rug, 330, 1150, 0, { w: 300, d: 360 });
  for (const y of [960, 1340]) place(g, rattanArm, 170, y, y < 1100 ? 160 : 20); place(g, haiko, 300, 1150, 0, { h: 60 }); place(g, K.plant, 80, 1400, 0);
  furnishOffice(K, g, 'Bureau'); furnishGym(K, g, 'Salle de sport'); furnishShower(K, g, 'Spa et salle d’eau'); furnishWC(K, g, 'WC');
  place(g, N('Dressing sur mesure en noyer'), 1300, 40, 0, { w: 170, h: 260, d: 50 }); place(g, K.G_('g-electro-lave-linge-60-cm'), 2060, 60, 90); place(g, K.G_('g-electro-s-che-linge-60-cm'), 2060, 125, 90); place(g, N('Linéaire noyer et marbre'), 1750, 40, 0, { w: 300 });
  furnishGarage(K, g, 'Garage');
  // Galerie : bancs bas et pots le long des baies.
  for (const x of [1180, 1620]) place(g, K.bench, x, 598, 180); for (const x of [1450, 1950]) place(g, K.plant, x, 600, 0);
  // Escalier de verre le long du mur nord de l'entrée ; il arrive dans la galerie-bibliothèque.
  const ST = N('Escalier garde-corps verre'); place(g, ST, 880, 70, 270, { w: 100, d: 320 });
  const need = (g.height - 205) / (g.height + g.slab), vEnd = 880 + 160 * (1 - 2 * need) + 3;
  glassRail(u, 717, 124, vEnd, 124); glassRail(u, vEnd + 2, 18, vEnd + 2, 124);
  // Étage.
  furnishBedroom(K, u, 'Suite parentale', 'n', true); furnishBedroom(K, u, 'Chambre 2', 'n'); furnishBedroom(K, u, 'Chambre 3 (bébé)', 'n'); furnishBedroom(K, u, 'Chambre 4', 'o');
  furnishBath(K, u, 'Salle de bain parentale'); furnishShower(K, u, 'Salle de bain'); furnishWC(K, u, 'WC');
  const Dd = boxOf(u, 'Dressing'); place(u, N('Dressing sur mesure en noyer'), (Dd.x0 + Dd.x1) / 2, Dd.y0 + 35, 0, { w: Dd.x1 - Dd.x0 - 60, h: 260, d: 55 });
  for (const x of [1150, 1650]) place(u, K.books, x, 34, 0, { w: 320, h: 160, d: 38 });
  for (const x of [1300, 1720]) place(u, rattanArm, x, 190, 0); place(u, K.rug, 1500, 170, 0, { w: 360, d: 180 });
  for (const r of ['Suite parentale', 'Chambre 2', 'Chambre 3 (bébé)', 'Chambre 4']) curtainsFor(K, u, r, K.cream);
  // Toits-terrasses : sur le salon pour la suite, sur le garage et l'aile est pour la chambre 4.
  glassRail(u, 12, 820, 12, 1790); glassRail(u, 12, 1790, 690, 1790); glassRail(u, 690, 820, 690, 1790);
  glassRail(u, 2112, 12, 2790, 12); glassRail(u, 2790, 12, 2790, 1790); glassRail(u, 2112, 1790, 2790, 1790); glassRail(u, 2112, 810, 2112, 1790);
  for (const [x, y] of [[250, 1100], [400, 1100], [2400, 300], [2550, 300]]) place(u, N('Bain de soleil teck et matelas blanc'), x, y, 0);
  place(u, K.plant, 600, 1700, 0); place(u, K.plant, 2700, 1700, 0);

  // ——— Le patio : bassin, olivier, dallage, et le jardin ouvert au sud ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), olive = N('Olivier'), lav = N('Massif de lavande'), cyp = N('Cyprès');
  out(K.G_('g-terrasse-terrasse-pierre'), 1400, 1300, 0, { w: 1380, d: 1000 });
  out(N('Piscine 8 × 4'), 1400, 1450, 0, { w: 1000, d: 320, z: 12 });
  out(olive, 960, 1000, 0, { w: 480, d: 480, h: 450, z: 12 }); out(olive, 1850, 1060, 0, { w: 380, d: 380, h: 380, z: 12 });
  for (const x of [1150, 1650]) out(N('Bain de soleil teck et matelas blanc'), x, 1700, 180, { z: 12 });
  out(K.lounge, 2300, 1620, 90); out(K.lounge, 2600, 1620, 270); out(K.low, 2450, 1620, 0); out(N('Cuisine d’été en pierre 4 m'), 2450, 1540, 0, { w: 260 });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) out(olive, -400 + i * 700 + (r % 2) * 350, 2400 + r * 500, 0, { w: 420, d: 420, h: 400 });
  for (let i = 0; i < 6; i++) out(lav, 200 + i * 450, 2050, 0, { w: 380 });
  for (const y of [-1800, -2400, -3000, -3600]) { out(cyp, 2250, y, 0); out(cyp, 2650, y, 0); }
  for (const [x, y] of [[300, -500], [1600, -600]]) out(olive, x, y, 0, { w: 520, d: 520, h: 470 });

  hillSite(p, 1400, -500, [-1500, -1300, 4200, 2200], [[3000, -150]], 900);
  const m = ensureTerrain(p), half = (T_N - 1) / 2, gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) { const x = (i - half) * 100 + 1400, y = (j - half) * 100 - 500; if ((x >= 2150 && x <= 2750 && y <= -250) || (x >= -200 && x <= 3000 && y >= -1300 && y <= -250)) m.p[j * T_N + i] = gravel; }
  commitTerrain(p);
  p.site.parcel = { pts: [{ x: -3000, y: -5500 }, { x: 5500, y: -5500 }, { x: 5500, y: 4500 }, { x: -3000, y: 4500 }] };
  return p;
}

/** Mid-century moderne : pavillon sous toit papillon et bandeau vitré, boîte blanche de chambres en porte-à-faux sur l'abri voiture, claustra, piscine haricot. */
function houseMidCentury() {
  const p = newProject('Maison mid-century');
  p.style = { facade: 'facade_bois', roof: 'roof_grey', joinery: '#2a2622' };
  p.roof = { type: 'none', pitch: 0, overhang: 0, ridge: 'auto' };
  p.site.env = 'campagne';
  const K = kit(), N = K.N, GL = { name: 'Baie toute hauteur' }, BAND = { name: 'Bandeau vitré' };
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 290; g.slab = 25;
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });
  outline(g, [[0, 0], [2400, 0], [2400, 900], [0, 900]], 25);
  partition(g, 1100, 0, 1100, 900, 40); partition(g, 1600, 0, 1600, 900, 20); partition(g, 1600, 550, 2000, 550, 15); partition(g, 2000, 400, 2400, 400, 15); partition(g, 2000, 0, 2000, 400, 15); partition(g, 2000, 400, 2000, 550, 15); partition(g, 2000, 550, 2000, 900, 15); partition(g, 1800, 550, 1800, 900, 12);
  // Pavillon : vitré au jardin, mur de pierre au cœur, petites ouvertures côté rue (la lumière vient du bandeau haut).
  open(g, 275, 900, 'bay', 480, 270, 0, GL); open(g, 825, 900, 'bay', 480, 270, 0, GL); open(g, 1350, 900, 'bay', 400, 270, 0, GL); open(g, 0, 450, 'fixed', 600, 270, 0, GL);
  open(g, 1350, 0, 'fixed', 300, 60, 165, BAND); open(g, 550, 0, 'fixed', 500, 50, 210, BAND);
  open(g, 1100, 760, 'passage', 220, 250, 0); open(g, 1600, 300, 'passage', 140, 240, 0);
  // Bloc d'entrée : on arrive par l'abri voiture, sous le porte-à-faux.
  open(g, 2400, 300, 'entry', 110, 250, 0, { name: "Porte d'entrée bleu canard", color: '#1f6f73' }); open(g, 2400, 120, 'fixed', 60, 230, 10, BAND);
  open(g, 2000, 300, 'door', 83, 215, 0); open(g, 2200, 400, 'door', 83, 215, 0); open(g, 1700, 550, 'door', 73, 215, 0); open(g, 1900, 550, 'door', 73, 215, 0);
  open(g, 1800, 0, 'fixed', 250, 110, 110, BAND); open(g, 2200, 900, 'bay', 300, 250, 0, GL); open(g, 2400, 725, 'bay', 220, 250, 0, GL); open(g, 1900, 900, 'fixed', 100, 60, 170, BAND);
  const tz = 'terrazzo', white = 'paint_all_white';
  setRoom(g, 550, 450, 'salon', 'Séjour', { floor: tz, paint: white });
  setRoom(g, 1350, 450, 'cuisine', 'Cuisine et repas', { floor: tz, paint: white });
  setRoom(g, 1800, 275, 'bureau', 'Bureau-bibliothèque', { floor: 'oak_natural', paint: 'wall_noyer' });
  setRoom(g, 1700, 725, 'wc', 'WC', { floor: tz, paint: 'paint_green_smoke' });
  setRoom(g, 1900, 725, 'douche', "Salle d'eau", { floor: tz, paint: white });
  setRoom(g, 2200, 200, 'entree', 'Entrée', { floor: tz, paint: white });
  setRoom(g, 2200, 650, 'piece', 'Salle de sport', { floor: 'oak_light', paint: white });
  clad(g, 550, 450, 'facade_pierre', 'e'); clad(g, 1350, 450, 'facade_pierre', 'o');
  p.entry = 0; syncRooms(g);
  outerFacade(g, (x) => x < 1, 'facade_pierre');

  // ——— Étage : la boîte blanche des chambres, posée en travers et lancée au-dessus de l'abri voiture ———
  const u = newLevel('Étage', 270); u.slab = 25;
  outline(u, [[1600, 0], [3300, 0], [3300, 900], [1600, 900]], 25);
  partition(u, 1600, 200, 2850, 200, 15); for (const x of [1950, 2300, 2650]) partition(u, x, 200, x, 900, 12); partition(u, 2850, 0, 2850, 900, 15); partition(u, 2650, 600, 2850, 600, 10); partition(u, 2850, 550, 3300, 550, 12);
  for (const x of [1775, 2125, 2475]) open(u, x, 200, 'door', 83, 215, 0); open(u, 2750, 200, 'door', 73, 215, 0); open(u, 2750, 600, 'door', 73, 215, 0); open(u, 2850, 100, 'door', 86, 225, 0, { name: 'Porte de la suite' }); open(u, 3075, 550, 'door', 83, 215, 0);
  for (const x of [1775, 2125, 2475]) open(u, x, 900, 'window2', 240, 200, 40, { name: 'Fenêtre en bande' });
  open(u, 3300, 300, 'bay', 300, 240, 0, { name: 'Baie d’angle' }); open(u, 3075, 900, 'fixed', 200, 70, 160, BAND); open(u, 2750, 900, 'fixed', 120, 60, 170, BAND);
  open(u, 2200, 0, 'fixed', 900, 50, 190, BAND); open(u, 3075, 0, 'window2', 240, 180, 60, { name: 'Fenêtre' });
  setRoom(u, 2200, 100, 'couloir', 'Couloir', { floor: 'oak_natural', paint: 'wall_noyer' });
  setRoom(u, 1775, 550, 'chambre', 'Chambre 2', { floor: 'oak_natural', paint: white });
  setRoom(u, 2125, 550, 'enfant', 'Chambre 3 (bébé)', { floor: 'oak_natural', paint: white });
  setRoom(u, 2475, 550, 'chambre', 'Chambre 4', { floor: 'oak_natural', paint: 'paint_skimming' });
  setRoom(u, 2750, 400, 'sdb', 'Salle de bain', { floor: tz, paint: white });
  setRoom(u, 2750, 750, 'wc', 'WC', { floor: tz, paint: 'paint_green_smoke' });
  setRoom(u, 3075, 275, 'parentale', 'Suite parentale', { floor: 'oak_natural', paint: white });
  setRoom(u, 3075, 725, 'sdb', 'Salle de bain parentale', { floor: tz, paint: 'wall_pierre_blonde' });
  p.levels.push(u); syncRooms(u);
  outerFacade(u, () => true, 'facade_enduit');
  p.roofs = [
    { id: uid('z'), level: g.id, x0: 0, y0: 0, x1: 1600, y1: 900, type: 'butterfly', pitch: 9, overhang: 70, ridge: 'x', wallH: 0, vault: true, lining: 'wall_noyer', endB: true },
    { id: uid('z'), level: u.id, x0: 1600, y0: 0, x1: 3300, y1: 900, type: 'slab', pitch: 0, overhang: 45, ovW: 20, thick: 22, ridge: 'x', wallH: 0 },
  ];

  // ——— Mobilier années 50 : noyer, teck, cuir, velours moutarde, laiton ———
  const huxley = byName(/Fauteuil pivotant en cuir marron et métal noir HUXLEY/) || K.arm, sumba = byName(/Fauteuil lounge en bois teck massif et corde tressée SUMBA/) || K.arm, arc = byName(/^Arc - Lampadaire design/);
  const enfilade = byName(/Buffet vintage finition bois noyer 4 portes L180 cm MILLOR/) || K.buffet, oval = byName(/Table de salle à manger ovale 220 x 110 cm Luceida/) || N('Table en noyer massif'), prisma = byName(/Chaise scandinave blanche et bois clair massif PRISMA/) || K.chair, corola = byName(/Suspension design en métal acier gris chromé D40 cm COROLA/) || K.dome;
  // Séjour : cheminée sur le mur de pierre, canapé moutarde face au feu, fauteuils cuir et teck, lampadaire arc.
  place(g, N('Cheminée monumentale pierre et noyer'), 1050, 330, 90, { w: 280, h: 280, d: 60 });
  place(g, K.rug, 680, 330, 90, { w: 360, d: 300, color: '#b5652f' }); place(g, K.sofa, 470, 330, 270, { color: '#c9952f' }); place(g, K.low, 680, 330, 90, { w: 120, d: 65 });
  place(g, huxley, 820, 150, 120); place(g, huxley, 820, 510, 60); place(g, sumba, 300, 700, 120); place(g, arc, 360, 140, 0); place(g, enfilade, 600, 40, 0); place(g, K.plant, 60, 60, 0); place(g, K.plant, 1050, 600, 0);
  // Cuisine-repas : linéaire côté rue, îlot, table ovale près de la baie.
  place(g, N('Linéaire noyer et marbre avec crédence'), 1350, 40, 0, { w: 440 }); place(g, N('Îlot noyer et marbre'), 1350, 270, 0, { w: 260, d: 100 }); for (const k of [-1, 0, 1]) place(g, K.stool, 1350 + k * 70, 345, 180);
  place(g, oval, 1350, 650, 90, { w: 220, d: 110 }); for (const k of [-1, 0, 1]) { place(g, prisma, 1280, 650 + k * 65, 90); place(g, prisma, 1420, 650 + k * 65, 270); } place(g, corola, 1350, 650, 0, { h: 90 });
  // Bureau-bibliothèque en noyer, salle d'eau, WC, sport.
  place(g, K.books, 1800, 32, 0, { w: 330, h: 270, d: 38 }); place(g, huxley, 1700, 150, 135); place(g, K.N('Table en noyer massif'), 1800, 250, 0, { w: 160, d: 75 }); place(g, pick('siege', ['cuir', 'tissu']), 1800, 310, 180);
  furnishShower(K, g, "Salle d'eau"); place(g, K.wc, 1700, 862, 180); place(g, N('Vasque monobloc en marbre'), 1772, 690, 90, { w: 70, d: 40 }); furnishGym(K, g, 'Salle de sport');
  place(g, N('Dressing sur mesure en noyer'), 2200, 372, 180, { w: 160, h: 250, d: 50 });
  // Escalier de verre le long du mur nord de l'entrée, il arrive à l'ouest du couloir.
  place(g, N('Escalier garde-corps verre'), 2170, 67, 270, { w: 100, d: 320 });
  const need = (g.height - 205) / (g.height + g.slab), vEnd = 2170 + 160 * (1 - 2 * need) + 3;
  glassRail(u, 2007, 120, vEnd, 120); glassRail(u, vEnd + 2, 16, vEnd + 2, 120);
  // Chambres.
  furnishBedroom(K, u, 'Chambre 2', 'o'); furnishBedroom(K, u, 'Chambre 3 (bébé)', 'o'); furnishBedroom(K, u, 'Chambre 4', 'o'); furnishBedroom(K, u, 'Suite parentale', 'o', true, -60);
  place(u, K.shower, 2728, 262, 0, { w: 120, d: 90 }); place(u, N('Double vasque noyer et pierre'), 2818, 440, 90, { w: 120 }); place(u, K.wc, 2750, 862, 180); place(u, N('Vasque monobloc en marbre'), 2822, 700, 90, { w: 60, d: 38 }); furnishBath(K, u, 'Salle de bain parentale');
  for (const r of ['Chambre 2', 'Chambre 3 (bébé)', 'Chambre 4']) curtainsFor(K, u, r, '#d8b25a');
  curtainsFor(K, u, 'Suite parentale', K.cream);

  // ——— Dehors : abri voiture, claustra, terrasse et piscine haricot ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), slab = K.G_('g-terrasse-terrasse-pierre'), pine = N('Pin parasol'), ball = N('Buis taillé en boule'), cyp = N('Cyprès');
  out(slab, 2850, 450, 0, { w: 900, d: 900 }); out(N('Ferrari rouge'), 2700, 470, 0); out(N('Porsche 911 marron'), 3050, 470, 0);
  for (const [x, y] of [[3285, 15], [3285, 885]]) out(N('Poteau acier noir'), x, y, 0, { h: 290 });
  out(N('Mur de claustra en béton'), 2700, -260, 0, { w: 600, h: 220 }); out(N('Mur de claustra en béton'), 3000, 1160, 0, { w: 600, h: 220 });
  out(slab, 800, 1150, 0, { w: 1800, d: 500 }); out(N('Piscine haricot'), 850, 1750, 0, { w: 1000, d: 500, z: 10 });
  for (const [x, y, r] of [[250, 1300, 200], [450, 1300, 180], [1500, 1350, 160]]) out(N('Bain de soleil teck et matelas blanc'), x, y, r, { z: 10 });
  out(sumba, 1300, 1100, 200); out(sumba, 1450, 1100, 160); out(K.side, 1375, 1050, 0);
  for (const [x, y] of [[-600, 1400], [2100, 2300], [-800, -500], [3900, 1800]]) out(pine, x, y, 0);
  for (const [x, y] of [[300, -120], [900, -120], [1500, -120], [2000, 1000], [-100, 1000]]) out(ball, x, y, 0);
  for (const y of [-1600, -2200, -2800]) { out(cyp, 2500, y, 0); out(cyp, 3100, y, 0); }

  hillSite(p, 1500, -500, [-1500, -1300, 4500, 2600], [], 700);
  const m = ensureTerrain(p), half = (T_N - 1) / 2, gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) { const x = (i - half) * 100 + 1500, y = (j - half) * 100 - 500; if (x >= 2400 && x <= 3300 && y <= 0) m.p[j * T_N + i] = gravel; }
  commitTerrain(p);
  p.site.parcel = { pts: [{ x: -3000, y: -5500 }, { x: 6000, y: -5500 }, { x: 6000, y: 4500 }, { x: -3000, y: 4500 }] };
  return p;
}

/** Grange contemporaine : bardage noir, nef ouverte jusqu'à la charpente, passerelle qui relie les deux ailes de nuit. */
function houseBarn() {
  const p = newProject('Grange contemporaine');
  p.style = { facade: 'facade_bois_noir', roof: 'roof_grey', joinery: '#1b1b1b' };
  p.roof = { type: 'none', pitch: 38, overhang: 30, ridge: 'x' };
  p.site.env = 'campagne';
  const K = kit(), N = K.N, ATL = { name: 'Fenêtre atelier', muntins: [2, 3] }, GL = { name: 'Verrière toute hauteur', muntins: [2, 6] };
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 320; g.slab = 25;
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });
  outline(g, [[0, 0], [3000, 0], [3000, 950], [0, 950]], 30);
  partition(g, 800, 0, 800, 950, 30); partition(g, 2100, 0, 2100, 950, 30); partition(g, 0, 500, 800, 500, 15); partition(g, 400, 0, 400, 500, 12);
  partition(g, 2400, 0, 2400, 950, 15); partition(g, 2100, 600, 2400, 600, 12); partition(g, 2400, 600, 3000, 600, 15); partition(g, 2100, 350, 2400, 350, 12);
  // La nef : grande porte vitrée au nord, verrière toute hauteur au sud.
  open(g, 1300, 0, 'entry', 200, 300, 0, { name: "Porte d'entrée vitrée", leaves: 2, glazed: true, color: '#1b1b1b' });
  for (const x of [1050, 1450, 1850]) open(g, x, 950, 'window2', 360, 560, 0, GL);
  open(g, 1800, 0, 'window2', 200, 120, 130, ATL);
  // Passages de la passerelle à travers les pignons intérieurs, au niveau de l'étage.
  open(g, 800, 130, 'passage', 160, 240, 345); open(g, 2100, 130, 'passage', 160, 240, 345);
  open(g, 800, 400, 'door', 83, 215, 0); open(g, 800, 725, 'double', 146, 225, 0, { name: 'Porte double vitrée', glazed: true }); open(g, 400, 250, 'door', 83, 215, 0);
  open(g, 2100, 475, 'door', 73, 215, 0); open(g, 2100, 775, 'door', 83, 215, 0); open(g, 2400, 175, 'door', 83, 215, 0); open(g, 2700, 600, 'door', 83, 215, 0); open(g, 2400, 775, 'door', 83, 215, 0);
  open(g, 2700, 0, 'garage', 480, 250, 0, { name: 'Porte de garage', color: '#1b1b1b' });
  open(g, 0, 250, 'window2', 180, 180, 80, ATL); open(g, 600, 0, 'window2', 160, 150, 90, ATL); open(g, 400, 950, 'window2', 320, 250, 0, GL); open(g, 0, 725, 'window2', 180, 200, 60, ATL); open(g, 2700, 950, 'window2', 160, 150, 90, ATL); open(g, 3000, 775, 'window2', 120, 120, 100, ATL);
  const cc = 'concrete_floor', oak = 'oak_natural', white = 'paint_all_white';
  setRoom(g, 1450, 475, 'salon', 'Nef', { floor: cc, paint: white });
  setRoom(g, 200, 250, 'bureau', 'Bureau', { floor: oak, paint: 'wall_noyer' });
  setRoom(g, 600, 250, 'piece', 'Salle de jeux', { floor: oak, paint: white });
  setRoom(g, 400, 725, 'piece', 'Salle de sport', { floor: oak, paint: 'wall_bois' });
  setRoom(g, 2250, 175, 'buanderie', 'Cellier', { floor: cc, paint: white });
  setRoom(g, 2250, 475, 'wc', 'WC', { floor: cc, paint: 'paint_green_smoke' });
  setRoom(g, 2250, 775, 'douche', "Salle d'eau", { floor: cc, paint: white });
  setRoom(g, 2700, 300, 'garage', 'Garage', { floor: 'concrete_floor', paint: 'paint_skimming' });
  setRoom(g, 2700, 775, 'buanderie', 'Buanderie', { floor: cc, paint: white });
  p.entry = 0; syncRooms(g);

  // ——— Étage : deux ailes de nuit aux pignons, reliées par une passerelle qui traverse la nef ———
  const u = newLevel('Étage', 280); u.slab = 25;
  outline(u, [[0, 0], [780, 0], [780, 950], [0, 950]], 20);
  outline(u, [[2120, 0], [3000, 0], [3000, 950], [2120, 950]], 20);
  partition(u, 780, 30, 2120, 30, 10); partition(u, 780, 230, 2120, 230, 10);
  partition(u, 0, 400, 780, 400, 15); partition(u, 430, 0, 430, 400, 12); partition(u, 430, 400, 430, 950, 12); partition(u, 430, 600, 780, 600, 10);
  partition(u, 2120, 230, 3000, 230, 12); partition(u, 2450, 230, 2450, 950, 12); partition(u, 2700, 230, 2700, 950, 12); partition(u, 2450, 430, 2700, 430, 10);
  open(u, 780, 130, 'passage', 160, 240, 0); open(u, 2120, 130, 'passage', 160, 240, 0);
  open(u, 1000, 230, 'passage', 120, 240, 0); for (const [x, w] of [[1300, 360], [1700, 360], [1990, 160]]) open(u, x, 230, 'passage', w, 240, 0);
  open(u, 430, 200, 'door', 83, 215, 0); open(u, 605, 400, 'door', 83, 215, 0); open(u, 430, 500, 'door', 83, 215, 0); open(u, 605, 600, 'door', 73, 215, 0);
  open(u, 2275, 230, 'door', 83, 215, 0); open(u, 2575, 230, 'door', 73, 215, 0); open(u, 2575, 430, 'door', 73, 215, 0); open(u, 2850, 230, 'door', 83, 215, 0);
  open(u, 0, 675, 'window2', 220, 220, 30, ATL); open(u, 0, 200, 'window2', 160, 170, 60, ATL); open(u, 225, 950, 'window2', 200, 200, 40, ATL); open(u, 605, 950, 'fixed', 120, 80, 120, ATL); open(u, 225, 0, 'window2', 150, 150, 70, ATL); open(u, 605, 0, 'fixed', 160, 70, 150, ATL);
  open(u, 2275, 950, 'window2', 200, 200, 40, ATL); open(u, 2575, 950, 'fixed', 120, 80, 120, ATL); open(u, 2850, 950, 'window2', 160, 200, 40, ATL); open(u, 3000, 590, 'window2', 200, 220, 30, ATL); open(u, 2560, 0, 'fixed', 400, 70, 150, ATL);
  setRoom(u, 215, 200, 'chambre', 'Chambre 4', { floor: oak, paint: white });
  setRoom(u, 605, 200, 'couloir', 'Palier', { floor: oak, paint: white });
  setRoom(u, 215, 675, 'parentale', 'Suite parentale', { floor: oak, paint: white });
  setRoom(u, 605, 500, 'dressing', 'Dressing', { floor: oak, paint: 'wall_noyer' });
  setRoom(u, 605, 775, 'sdb', 'Salle de bain parentale', { floor: 'tile_cement', paint: white });
  setRoom(u, 1450, 130, 'couloir', 'Passerelle', { floor: oak, paint: white });
  setRoom(u, 2560, 115, 'couloir', 'Couloir', { floor: oak, paint: white });
  setRoom(u, 2275, 590, 'chambre', 'Chambre 2', { floor: oak, paint: white });
  setRoom(u, 2575, 330, 'wc', 'WC', { floor: 'tile_cement', paint: white });
  setRoom(u, 2575, 690, 'sdb', 'Salle de bain', { floor: 'tile_cement', paint: white });
  setRoom(u, 2850, 590, 'enfant', 'Chambre 3 (bébé)', { floor: oak, paint: white });
  p.levels.push(u); syncRooms(u);
  outerFacade(u, (x, y) => (x > 770 && x < 790) || (x > 2110 && x < 2130) || (x > 790 && x < 2110 && y > 20 && y < 240), 'paint_all_white');
  const R = (lv, x0, x1, extra) => ({ id: uid('z'), level: lv.id, x0, y0: 0, x1, y1: 950, type: 'gable', pitch: 38, overhang: 30, ridge: 'x', wallH: 0, ...extra });
  p.roofs = [R(u, 0, 780, { endB: true }), R(g, 800, 2100, { wallH: 625, vault: true, lining: 'wall_bois', endA: true, endB: true }), R(u, 2120, 3000, { endA: true })];

  // ——— Mobilier loft : béton ciré, cuir cognac, velours kaki, métal noir ———
  const huxley = byName(/Fauteuil pivotant en cuir marron et métal noir HUXLEY/) || K.arm, klem = byName(/Fauteuil pivotant en tissu velours côtelé vert kaki et métal noir KLEM/) || K.arm;
  const briane = byName(/Chaise design noire en tissu velours et métal BRIANE/) || K.chair, corola = byName(/Suspension design en métal acier gris chromé D40 cm COROLA/) || K.dome, soleni = byName(/Soleni - Table basse effet travertin/) || K.low;
  // Le bloc de cheminée en pierre se dresse seul au milieu de la nef, jusqu'à la charpente.
  place(g, N('Cheminée monumentale pierre et noyer'), 1570, 540, 0, { w: 300, h: 620, d: 90 });
  place(g, K.rug, 1570, 740, 0, { w: 360, d: 280, color: '#8a6a52' }); place(g, K.sofa, 1570, 880, 180, { color: '#7a5236' }); place(g, soleni, 1570, 720, 0);
  place(g, huxley, 1365, 700, 60); place(g, klem, 1780, 700, 300); place(g, K.plant, 2050, 300, 0);
  // Cuisine sous la passerelle, îlot dans la hauteur, grande table de ferme et ses suspensions.
  place(g, N('Linéaire noyer et marbre avec crédence'), 1745, 42, 0, { w: 590 }); place(g, N('Îlot noyer et marbre'), 1650, 330, 0, { w: 360, d: 110 }); for (const k of [-2, -1, 0, 1, 2]) place(g, K.stool, 1650 + k * 66, 405, 180);
  place(g, N('Table en noyer massif'), 1090, 720, 0, { w: 300, d: 105 }); for (const k of [-1.5, -0.5, 0.5, 1.5]) { place(g, briane, 1090 + k * 72, 635, 0); place(g, briane, 1090 + k * 72, 805, 180); }
  for (const k of [-1, 0, 1]) place(g, corola, 1090 + k * 100, 720, 0, { h: 160 });
  // Escalier sculptural posé dans la nef : il monte droit vers la passerelle.
  place(g, N('Escalier métal et bois'), 1000, 392, 0, { w: 100, d: 320 });
  glassRail(u, 1120, 232, 1480, 232); glassRail(u, 1520, 232, 1880, 232); glassRail(u, 1910, 232, 2070, 232); glassRail(u, 830, 232, 940, 232);
  furnishOffice(K, g, 'Bureau'); furnishGym(K, g, 'Salle de sport'); furnishShower(K, g, "Salle d'eau"); furnishWC(K, g, 'WC'); furnishGarage(K, g, 'Garage');
  const Bu = boxOf(g, 'Buanderie'); place(g, K.G_('g-electro-lave-linge-60-cm'), Bu.x0 + 60, Bu.y0 + 40, 0); place(g, K.G_('g-electro-s-che-linge-60-cm'), Bu.x0 + 125, Bu.y0 + 40, 0); place(g, N('Linéaire noyer et marbre'), Bu.x0 + 330, Bu.y0 + 40, 0, { w: 220 });
  const Sj = boxOf(g, 'Salle de jeux'); place(g, K.rug, (Sj.x0 + Sj.x1) / 2, (Sj.y0 + Sj.y1) / 2, 0, { w: 240, d: 200, color: '#c9b48c' }); place(g, K.books, (Sj.x0 + Sj.x1) / 2, Sj.y0 + 32, 0, { w: 300, h: 160, d: 38 }); place(g, K.sofa, (Sj.x0 + Sj.x1) / 2, Sj.y1 - 60, 180, { color: '#5f6f52' });
  // Étage.
  furnishBedroom(K, u, 'Suite parentale', 'o', true); furnishBedroom(K, u, 'Chambre 4', 'o'); furnishBedroom(K, u, 'Chambre 2', 'o'); furnishBedroom(K, u, 'Chambre 3 (bébé)', 'e');
  const Dr = boxOf(u, 'Dressing'); place(u, N('Dressing sur mesure en noyer'), Dr.x1 - 30, (Dr.y0 + Dr.y1) / 2, 90, { w: Dr.y1 - Dr.y0 - 40, h: 250, d: 55 });
  furnishBath(K, u, 'Salle de bain parentale'); place(u, K.shower, 2575, 760, 0, { w: 160, d: 90 }); place(u, N('Double vasque noyer et pierre'), 2575, 905, 180, { w: 140 }); place(u, K.wc, 2662, 330, 90); place(u, N('Vasque monobloc en marbre'), 2488, 330, 270, { w: 60, d: 38 });
  const Pa = boxOf(u, 'Palier'); place(u, K.books, Pa.x0 + 30, (Pa.y0 + Pa.y1) / 2, 270, { w: 300, h: 240, d: 38 }); place(u, huxley, Pa.x0 + 200, Pa.y0 + 120, 225);
  for (const r of ['Suite parentale', 'Chambre 4', 'Chambre 2', 'Chambre 3 (bébé)']) curtainsFor(K, u, r, '#cfc6b6');

  // ——— Dehors : prairie, vergers, terrasse en bois devant la verrière ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), deck = K.G_('g-terrasse-terrasse-bois'), olive = N('Olivier'), oakT = K.G_('g-plantation-arbre');
  out(deck, 1450, 1250, 0, { w: 1600, d: 600 }); out(N('Table en noyer massif'), 1100, 1250, 0, { w: 260, d: 95 }); for (const k of [-1, 0, 1]) { out(K.outChair, 1100 + k * 85, 1180, 0); out(K.outChair, 1100 + k * 85, 1320, 180); }
  out(N('Foyer rond d’extérieur'), 1900, 1300, 0); for (const [x, y, r] of [[1900, 1120, 0], [1900, 1480, 180], [2080, 1300, 270]]) out(K.lounge, x, y, r);
  out(N('Piscine 8 × 4'), 1450, 2100, 0, { w: 1400, d: 350, z: 10 }); out(K.G_('g-terrasse-terrasse-pierre'), 1450, 2100, 0, { w: 1800, d: 700 });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) out(oakT, -1200 + i * 650 + (r % 2) * 300, 2900 + r * 600, 0, { w: 560, d: 560, h: 700 });
  for (const [x, y] of [[-500, 500], [3600, 300], [3500, 1500]]) out(olive, x, y, 0, { w: 480, d: 480, h: 450 });

  hillSite(p, 1500, -500, [-1500, -1300, 4500, 2700], [], 800);
  const m = ensureTerrain(p), half = (T_N - 1) / 2, gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) { const x = (i - half) * 100 + 1500, y = (j - half) * 100 - 500; if ((x >= 2400 && x <= 3000 && y <= -50) || (x >= 600 && x <= 3200 && y >= -900 && y <= -50)) m.p[j * T_N + i] = gravel; }
  commitTerrain(p);
  p.site.parcel = { pts: [{ x: -3000, y: -5500 }, { x: 6000, y: -5500 }, { x: 6000, y: 4500 }, { x: -3000, y: 4500 }] };
  return p;
}

// ——— Géométrie courbe : polygones réguliers et cordes, pour des pièces rondes ———
const RAD = Math.PI / 180;
const ringPts = (cx, cy, r, n, a0) => Array.from({ length: n }, (_, k) => [Math.round((cx + r * Math.cos((a0 + (k * 360) / n) * RAD)) * 10) / 10, Math.round((cy + r * Math.sin((a0 + (k * 360) / n) * RAD)) * 10) / 10]);
/** Points où une ligne horizontale (axe 1) ou verticale (axe 0) coupe un polygone. */
function cutPoly(pts, axis, v) {
  const out = [];
  pts.forEach((a, k) => { const b = pts[(k + 1) % pts.length]; if ((a[axis] - v) * (b[axis] - v) < 0) { const t = (v - a[axis]) / (b[axis] - a[axis]), q = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; q[axis] = v; out.push(q); } });
  return out.sort((p, q) => p[1 - axis] - q[1 - axis]);
}
const edgeMid = (cx, cy, r, n, angle) => [cx + r * Math.cos((Math.PI) / n) * Math.cos(angle * RAD), cy + r * Math.cos((Math.PI) / n) * Math.sin(angle * RAD)];

/** Villa des Disques : six volumes ronds reliés par des passerelles de verre ; le grand salon, rond et en double hauteur, s'avance au-dessus de la crique. */
function houseDiscs() {
  const p = newProject('Villa des Disques');
  p.style = { facade: 'facade_enduit', roof: 'roof_grey', joinery: '#c9c6bf' };
  p.roof = { type: 'none', pitch: 0, overhang: 0, ridge: 'auto' };
  p.site.env = 'mer';
  const K = kit(), N = K.N, GLASS = { name: 'Vitrage courbe' };
  const mar = 'marble', walnut = 'wall_noyer', white = 'paint_all_white', oak = 'oak_natural';
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 300; g.slab = 25;
  const u = newLevel('Étage', 280); u.slab = 25;
  const r1 = (v) => Math.round(v * 10) / 10, nrm = (a) => ((a % 360) + 360) % 360;
  const pol = (c, r, a) => [r1(c.x + r * Math.cos(a * RAD)), r1(c.y + r * Math.sin(a * RAD))];
  const mid = (f) => [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2];
  /** Disque à n facettes ; chaque raccord (passerelle, porte) devient une facette droite de la largeur voulue. */
  const ring = (c, r, n, joins = []) => {
    const step = 360 / n, cuts = joins.map((j) => { const da = Math.asin((j.hw ?? 100) / r) / RAD; return { a: j.a, u: j.a - da, v: j.a + da }; });
    const near = (a) => cuts.some((q) => { const d = nrm(a - q.u); return d < q.v - q.u + 2 || d > 358; });
    const angs = [];
    for (let k = 0; k < n; k++) { const a = step / 2 + k * step; if (!near(a)) angs.push(nrm(a)); }
    cuts.forEach((q) => angs.push(nrm(q.u), nrm(q.v)));
    angs.sort((x, y) => x - y);
    const facet = {}; cuts.forEach((q) => { facet[q.a] = [pol(c, r, q.u), pol(c, r, q.v)]; });
    return { c, r, pts: angs.map((a) => pol(c, r, a)), facet };
  };
  const chain = (lv, pts, t, extra, closed = true) => pts.forEach(([x, y], k) => { if (!closed && k === pts.length - 1) return; const [X, Y] = pts[(k + 1) % pts.length]; for (const w of wallLine(lv, x, y, X, Y, t)) Object.assign(w, extra || {}); });
  /** Passerelle droite entre deux facettes qui se font face. */
  const bridge = (lv, P, Q, t = 20) => {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), [q0, q1] = d(P[0], Q[0]) + d(P[1], Q[1]) <= d(P[0], Q[1]) + d(P[1], Q[0]) ? Q : [Q[1], Q[0]];
    for (const [a, b] of [[P[0], q0], [P[1], q1]]) for (const w of wallLine(lv, a[0], a[1], b[0], b[1], t)) w.piles = true;
  };
  /** Baie sur le tronçon de mur qui passe par (x, y), à la largeur de ce tronçon. */
  const fit = (lv, x, y, type, sill, h, extra = GLASS, maxW = 600, margin = 16) => {
    for (const w of lv.walls) {
      const A = lv.nodes[w.a], B = lv.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y);
      const t = ((x - A.x) * (B.x - A.x) + (y - A.y) * (B.y - A.y)) / L, d = Math.abs((x - A.x) * (B.y - A.y) - (y - A.y) * (B.x - A.x)) / L;
      if (d > 2 || t <= 0 || t >= L) continue;
      const width = Math.min(maxW, L - margin);
      if (width >= 45 && !w.openings.length) w.openings.push({ id: uid('o'), type, width, height: h, sill, t: L / 2, open: 0, ...extra });
      return;
    }
  };
  /** Vitre les facettes d'un disque dont l'angle passe le test (les raccords, plus larges, sont laissés aux passages). */
  const glaze = (lv, D, test, sill, h, extra = GLASS) => D.pts.forEach((a, k) => {
    const b = D.pts[(k + 1) % D.pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ang = nrm(Math.atan2(my - D.c.y, mx - D.c.x) / RAD);
    if (L < 150 && test(ang)) fit(lv, mx, my, 'fixed', sill, h, extra);
  });
  const way = (lv, f, w = 160, h = 260, extra = {}) => { const [x, y] = mid(f); open(lv, x, y, 'passage', w, h, 0, extra); };
  const between = (a, lo, hi) => (lo <= hi ? a >= lo && a <= hi : a >= lo || a <= hi);

  // ——— Rez-de-chaussée : au sud le salon rond au-dessus du vide, la cuisine et le bureau ; au nord l'entrée, le sport et les voitures ———
  const S = ring({ x: 0, y: 300 }, 750, 48, [{ a: 180 }, { a: 0 }, { a: 270 }, { a: 90, hw: 200 }]);
  const Kd = ring({ x: -1550, y: 300 }, 500, 32, [{ a: 0 }]), Od = ring({ x: 1550, y: 300 }, 500, 32, [{ a: 180 }]);
  const E = ring({ x: 0, y: -1450 }, 420, 24, [{ a: 90 }, { a: 180 }, { a: 0 }, { a: 270, hw: 110 }]);
  const F = ring({ x: -1500, y: -1450 }, 450, 24, [{ a: 0 }]), C = ring({ x: 1550, y: -1450 }, 550, 32, [{ a: 180 }, { a: 270, hw: 170 }]);
  chain(g, S.pts, 30, { piles: true }); for (const D of [Kd, Od, E, F, C]) chain(g, D.pts, 28);
  bridge(g, Kd.facet[0], S.facet[180]); bridge(g, S.facet[0], Od.facet[180]); bridge(g, E.facet[90], S.facet[270]); bridge(g, F.facet[0], E.facet[180]); bridge(g, E.facet[0], C.facet[180]);
  // Bureau : salle d'eau et buanderie derrière, côté terre.
  { const top = cutPoly(Od.pts, 0, 1550)[0]; partition(g, 1550, 180, 1550, top[1], 12); const ch = cutPoly(Od.pts, 1, 180); partition(g, ch[0][0], 180, ch[1][0], 180, 15); }
  // Entrée : un sas entre le WC et le vestiaire, puis la rotonde et son escalier hélicoïdal.
  { const [a, b] = E.facet[270], L = a[0] < b[0] ? a : b, R = a[0] < b[0] ? b : a; partition(g, L[0], -1600, L[0], L[1], 12); partition(g, R[0], -1600, R[0], R[1], 12); const ch = cutPoly(E.pts, 1, -1600); partition(g, ch[0][0], -1600, ch[1][0], -1600, 15); }
  // Passages des passerelles ; ceux du salon s'ouvrent aussi à l'étage, où passent les passerelles hautes.
  const UP = { upper: { sill: 325, height: 245 } };
  way(g, Kd.facet[0]); way(g, S.facet[180], 160, 260, UP); way(g, S.facet[0], 160, 260, UP); way(g, Od.facet[180]); way(g, E.facet[90]); way(g, S.facet[270], 160, 260, UP);
  way(g, F.facet[0]); way(g, E.facet[180]); way(g, E.facet[0]); way(g, C.facet[180]);
  { const [x, y] = mid(E.facet[270]); open(g, x, y, 'entry', 150, 270, 0, { name: "Porte d'entrée pivotante", color: '#d8d5ce' }); }
  { const [x, y] = mid(C.facet[270]); open(g, x, y, 'garage', 300, 250, 0, { name: 'Porte de garage', color: '#d8d5ce' }); }
  { const [x, y] = mid(S.facet[90]); open(g, x, y, 'bay', 380, 690, 0, { name: 'Baie coulissante sur la terrasse' }); }
  open(g, 0, -1600, 'passage', 180, 270, 0); open(g, -260, -1600, 'door', 73, 215, 0); open(g, 260, -1600, 'door', 83, 215, 0);
  open(g, 1150, 180, 'door', 83, 215, 0); open(g, 1950, 180, 'door', 83, 215, 0);
  // Verre : le salon vitré toute hauteur face à la mer, plus bas sous la bibliothèque ; ailleurs selon la pièce.
  glaze(g, S, (a) => between(a, 15, 165), 12, 690); glaze(g, S, (a) => !between(a, 15, 165) && !between(a, 298, 338), 12, 250);
  glaze(g, Kd, (a) => between(a, 15, 170), 12, 275); glaze(g, Kd, (a) => between(a, 170, 232) || between(a, 308, 345), 95, 180);
  glaze(g, Od, (a) => between(a, 10, 165), 12, 275); glaze(g, Od, (a) => between(a, 200, 340), 175, 80);
  glaze(g, E, (a) => between(a, 20, 165) || between(a, 195, 235) || between(a, 305, 345), 12, 275); glaze(g, E, (a) => between(a, 236, 304), 185, 60);
  glaze(g, F, (a) => !between(a, 330, 30) && !between(a, 245, 295), 12, 275); glaze(g, C, (a) => between(a, 300, 240), 12, 270);
  for (const [P, Q] of [[Kd.facet[0], S.facet[180]], [S.facet[0], Od.facet[180]], [E.facet[90], S.facet[270]], [F.facet[0], E.facet[180]], [E.facet[0], C.facet[180]]]) for (const k of [0, 1]) {
    const a = P[k], b = Math.abs(Q[0][0] - a[0]) < 1 || Math.abs(Q[0][1] - a[1]) < 1 ? Q[0] : Q[1]; fit(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 'fixed', 5, 270, GLASS, 600, 30);
  }
  setRoom(g, 0, 300, 'salon', 'Grand salon', { floor: mar, paint: white });
  setRoom(g, -1550, 300, 'cuisine', 'Cuisine et salle à manger', { floor: mar, paint: white });
  setRoom(g, 1550, 500, 'bureau', 'Bureau-bibliothèque', { floor: oak, paint: walnut });
  setRoom(g, 1400, 0, 'douche', "Salle d'eau", { floor: mar, paint: 'wall_pierre_blonde' });
  setRoom(g, 1700, 0, 'piece', 'Buanderie', { floor: 'tile_cement', paint: white });
  setRoom(g, 0, -1400, 'entree', 'Rotonde', { floor: mar, paint: white });
  setRoom(g, 0, -1730, 'entree', "Sas d'entrée", { floor: mar, paint: walnut });
  setRoom(g, -250, -1700, 'wc', 'WC', { floor: mar, paint: walnut });
  setRoom(g, 250, -1700, 'dressing', 'Vestiaire', { floor: mar, paint: walnut });
  setRoom(g, -1500, -1450, 'piece', 'Salle de sport', { floor: 'oak_light', paint: white });
  setRoom(g, 1550, -1450, 'garage', 'Galerie des voitures', { floor: 'concrete_floor', paint: white });
  setRoom(g, -900, 300, 'couloir', 'Passerelle ouest', { floor: mar, paint: white });
  setRoom(g, 900, 300, 'couloir', 'Passerelle est', { floor: mar, paint: white });
  setRoom(g, 0, -740, 'couloir', 'Galerie de la mer', { floor: mar, paint: white });
  setRoom(g, -730, -1450, 'couloir', 'Galerie du sport', { floor: mar, paint: white });
  setRoom(g, 710, -1450, 'couloir', 'Galerie du garage', { floor: mar, paint: white });
  p.entry = 0; syncRooms(g);

  // ——— Étage : la suite à l'ouest, trois chambres à l'est, la salle de jeux au nord, reliées par une bibliothèque en anneau suspendue dans le salon ———
  const K2 = ring(Kd.c, 500, 32, [{ a: 0 }]), O2 = ring(Od.c, 500, 32, [{ a: 180 }]), E2 = ring(E.c, 420, 24, [{ a: 90 }]);
  const Mo = ring(S.c, 720, 48, [{ a: 180 }, { a: 270 }, { a: 0 }]), RI = 520, A0 = 165, A1 = 375;
  const unw = (a) => (a < A0 ? a + 360 : a);
  const outer = [pol(S.c, 720, A0), ...Mo.pts.filter(([x, y]) => { const a = unw(nrm(Math.atan2(y - S.c.y, x - S.c.x) / RAD)); return a > A0 + 1 && a < A1 - 1; }).sort(([x, y], [X, Y]) => unw(nrm(Math.atan2(y - S.c.y, x - S.c.x) / RAD)) - unw(nrm(Math.atan2(Y - S.c.y, X - S.c.x) / RAD))), pol(S.c, 720, A1)];
  const inner = []; for (let a = A1; a >= A0 - 0.01; a -= 30) inner.push(pol(S.c, RI, a));
  chain(u, outer, 12, null, false); chain(u, [outer[outer.length - 1], inner[0]], 12, null, false); chain(u, inner, 6, null, false); chain(u, [inner[inner.length - 1], outer[0]], 12, null, false);
  for (const D of [K2, O2, E2]) chain(u, D.pts, 25);
  bridge(u, E2.facet[90], Mo.facet[270]); bridge(u, K2.facet[0], Mo.facet[180]); bridge(u, Mo.facet[0], O2.facet[180]);
  // Bord intérieur de l'anneau : des lames fines et un garde-corps de verre, tout est ouvert sur le salon.
  inner.forEach((a, k) => { if (k === inner.length - 1) return; const b = inner[k + 1]; fit(u, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 'passage', 0, 280, {}, 600, 10); });
  // Suite : antichambre-dressing, chambre face à la mer, salle de bain, chambre de bébé.
  { const top = cutPoly(K2.pts, 0, -1400)[0]; partition(u, -1400, 420, -1400, top[1], 12); const ch = cutPoly(K2.pts, 1, 420); partition(u, ch[0][0], 420, ch[1][0], 420, 15); const w = cutPoly(K2.pts, 1, 100)[0]; partition(u, w[0], 100, -1400, 100, 12); }
  // Aile des enfants : couloir central, deux chambres côté terre, une côté mer, salle de bain et WC.
  { const [a, b] = O2.facet[180], lo = a[1] < b[1] ? a : b, hi = a[1] < b[1] ? b : a;
    const top = cutPoly(O2.pts, 0, 1550)[0]; partition(u, 1550, 200, 1550, top[1], 12);
    for (const x of [1650, 1850]) partition(u, x, 400, x, cutPoly(O2.pts, 0, x)[1][1], 12);
    const e1 = cutPoly(O2.pts, 1, lo[1]).pop(), e2 = cutPoly(O2.pts, 1, hi[1]).pop(); partition(u, lo[0], lo[1], e1[0], lo[1], 12); partition(u, hi[0], hi[1], e2[0], hi[1], 12); }
  way(u, K2.facet[0], 160, 240); way(u, Mo.facet[180], 160, 240); way(u, Mo.facet[0], 160, 240); way(u, O2.facet[180], 160, 240); way(u, E2.facet[90], 160, 240); way(u, Mo.facet[270], 160, 240);
  open(u, -1232, 420, 'door', 83, 215, 0); open(u, -1400, -10, 'door', 83, 215, 0); open(u, -1400, 300, 'door', 83, 215, 0);
  open(u, 1300, 200, 'door', 83, 215, 0); open(u, 1800, 200, 'door', 83, 215, 0); open(u, 1350, 400, 'door', 83, 215, 0); open(u, 1750, 400, 'door', 73, 215, 0); open(u, 1945, 400, 'door', 73, 215, 0);
  glaze(u, K2, (a) => between(a, 25, 165), 12, 245); glaze(u, K2, (a) => between(a, 166, 200), 60, 170); glaze(u, K2, (a) => between(a, 201, 260), 160, 80);
  glaze(u, O2, (a) => between(a, 80, 165), 12, 245); glaze(u, O2, (a) => between(a, 15, 50), 150, 90); glaze(u, O2, (a) => between(a, 200, 340), 60, 170); glaze(u, O2, (a) => between(a, 341, 14), 12, 245);
  glaze(u, E2, () => true, 12, 245);
  for (const [P, Q] of [[E2.facet[90], Mo.facet[270]], [K2.facet[0], Mo.facet[180]], [Mo.facet[0], O2.facet[180]]]) for (const k of [0, 1]) {
    const a = P[k], b = Math.abs(Q[0][0] - a[0]) < 1 || Math.abs(Q[0][1] - a[1]) < 1 ? Q[0] : Q[1]; fit(u, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 'fixed', 5, 250, GLASS, 600, 30);
  }
  setRoom(u, ...pol(S.c, 620, 270), 'piece', 'Bibliothèque suspendue', { floor: 'oak_natural', paint: walnut, open: true });
  setRoom(u, -1550, 620, 'parentale', 'Suite parentale', { floor: oak, paint: white });
  setRoom(u, -1230, 150, 'dressing', 'Antichambre-dressing', { floor: oak, paint: walnut });
  setRoom(u, -1700, -50, 'sdb', 'Salle de bain parentale', { floor: mar, paint: 'wall_pierre_blonde' });
  setRoom(u, -1700, 260, 'enfant', 'Chambre 5 (bébé)', { floor: oak, paint: white });
  setRoom(u, 1550, 300, 'couloir', 'Couloir des chambres', { floor: oak, paint: white });
  setRoom(u, 1300, 0, 'chambre', 'Chambre 2', { floor: oak, paint: white });
  setRoom(u, 1800, 0, 'chambre', 'Chambre 3', { floor: oak, paint: white });
  setRoom(u, 1350, 600, 'chambre', 'Chambre 4', { floor: oak, paint: white });
  setRoom(u, 1750, 600, 'sdb', 'Salle de bain', { floor: mar, paint: white });
  setRoom(u, 1930, 500, 'wc', 'WC', { floor: mar, paint: walnut });
  setRoom(u, 0, -1450, 'enfant', 'Palier et salle de jeux', { floor: oak, paint: white, oculus: { x: 0, y: -1450, r: 110 } });
  setRoom(u, 0, -760, 'couloir', 'Passerelle haute', { floor: oak, paint: white });
  setRoom(u, -900, 300, 'couloir', 'Passerelle de la suite', { floor: oak, paint: white });
  setRoom(u, 900, 300, 'couloir', 'Passerelle des enfants', { floor: oak, paint: white });
  p.levels.push(u); syncRooms(u);

  // ——— Toits : grands disques débordants, le salon sous un disque percé d'un oculus et doublé de noyer ———
  const disc = (lv, D, extra) => ({ id: uid('z'), level: lv.id, x0: D.c.x - D.r, y0: D.c.y - D.r, x1: D.c.x + D.r, y1: D.c.y + D.r, type: 'disc', pitch: 0, overhang: 100, ridge: 'x', wallH: 0, ...extra });
  const slabZ = (lv, x0, y0, x1, y1, wallH, ends) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type: 'slab', pitch: 0, overhang: 25, ridge: 'x', wallH, thick: 22, ...ends });
  const xF = F.facet[0][0][0], xEw = E.facet[180][0][0], xEe = E.facet[0][0][0], xC = C.facet[180][0][0], yE2 = E2.facet[90][0][1], yM = Mo.facet[270][0][1];
  p.roofs = [
    disc(g, S, { wallH: 720, vault: true, lining: walnut, oculus: 210, overhang: 260, thick: 50 }),
    disc(u, K2, { overhang: 160, thick: 40 }), disc(u, O2, { overhang: 160, thick: 40 }), disc(u, E2, { overhang: 140, oculus: 110, thick: 38 }),
    disc(g, F, { overhang: 130, thick: 36 }), disc(g, C, { overhang: 150, thick: 36 }),
    slabZ(g, xF, -1550, xEw, -1350, 280, { ovW: -15, ovE: -15 }), slabZ(g, xEe, -1550, xC, -1350, 280, { ovW: -15, ovE: -15 }),
    slabZ(u, -100, yE2, 100, yM, 255, { ovN: -15, ovS: -15 }), slabZ(u, K2.facet[0][0][0], 200, Mo.facet[180][0][0], 400, 255, { ovW: -15, ovE: -15 }), slabZ(u, Mo.facet[0][0][0], 200, O2.facet[180][0][0], 400, 255, { ovW: -15, ovE: -15 }),
  ];

  // ——— Intérieur ———
  const huxley = byName(/Fauteuil pivotant en cuir marron et métal noir HUXLEY/) || K.arm, arc = byName(/^Arc - Lampadaire design/), sasso = byName(/Table basse design en marbre blanc et métal noir/) || K.low;
  const rock = N('Rocher décoratif'), roundT = byName(/Table à manger ronde en bois clair chêne D137/) || N('Table en noyer massif');
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra);
  /** Pièce en arc : l'objet garde le cadre serré de son secteur, le centre de l'arc est passé à la forme. */
  const arcItem = (lv, def, c, q, extra = {}) => {
    const ro = q.r1 ?? q.r, ri = q.r0 ?? 0, a0 = q.a0 ?? 0, a1 = q.a1 ?? 360, xs = [], ys = [];
    for (let a = a0; a <= a1 + 0.01; a += 2) for (const r of [ri, ro]) { xs.push(r * Math.cos(a * RAD)); ys.push(r * Math.sin(a * RAD)); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const pm = Object.fromEntries(Object.entries(q).map(([k, v]) => [k, /^r\d?$/.test(k) ? v / 100 : v]));
    place(lv, def, c.x + cx, c.y + cy, 0, { w: Math.round(x1 - x0), d: Math.round(y1 - y0), ...extra, p: { ...pm, ac: [-cx / 100, -cy / 100] } });
  };
  // Grand salon : une estrade ronde sous l'oculus, le canapé courbe tourné vers la mer, la cheminée de pierre, le bar rond sous la bibliothèque.
  arcItem(g, N('Estrade circulaire en marbre'), S.c, { r: 360, steps: 2, rise: 0.15, run: 0.35 }, { h: 30 });
  place(g, N('Canapé courbe en bouclette'), 0, 380, 0, { w: 480, d: 260, z: 30 }); place(g, K.rug, 0, 540, 0, { w: 300, d: 180, color: '#b9ab96', z: 30 }); place(g, sasso, 0, 545, 0, { z: 30 });
  place(g, huxley, -440, 560, 120); place(g, huxley, 440, 560, 240); place(g, arc, -390, 420, 0);
  place(g, N('Cheminée cylindrique habillée de noyer'), ...pol(S.c, 540, 150), 330, { w: 190, h: 690, p: { stone: true } });
  arcItem(g, N('Bar rond en noyer et marbre'), { x: 430, y: -120 }, { r: 170, a0: 125, a1: 235 }); for (const a of [150, 180, 210]) place(g, K.stool, 430 + 205 * Math.cos(a * RAD), -120 + 205 * Math.sin(a * RAD), facing({ x: Math.cos(a * RAD), y: Math.sin(a * RAD) }));
  place(g, K.plant, 600, 600, 0, { h: 220 }); place(g, K.plant, -640, 40, 0, { h: 200 });
  // Coin lecture sous la bibliothèque : deux fauteuils face à face, un guéridon.
  { const a = 222, c = pol(S.c, 610, a), t = { x: -Math.sin(a * RAD), y: Math.cos(a * RAD) };
    place(g, K.rug, ...c, (a + 90) % 360, { w: 240, d: 170 }); place(g, K.arm, c[0] + t.x * 78, c[1] + t.y * 78, facing({ x: -t.x, y: -t.y })); place(g, K.arm, c[0] - t.x * 78, c[1] - t.y * 78, facing(t)); place(g, K.side, ...c, 0); }
  for (const [x, y, w] of [[420, 720, 150], [560, 460, 110], [-300, 840, 130], [-650, 100, 100]]) place(g, rock, x, y, (x * 7 + 360) % 360, { w, d: w * 0.75, h: w * 0.55 });
  // Cuisine : linéaire contre le mur nord, îlot, table ronde dans l'arrondi vitré face à la mer.
  place(g, N('Linéaire noyer et marbre avec crédence'), -1550, -85, 0, { w: 470 }); place(g, N('Îlot noyer et marbre'), -1550, 140, 0, { w: 300, d: 110 }); for (const k of [-2, -1, 0, 1, 2]) place(g, K.stool, -1550 + k * 58, 225, 180);
  place(g, roundT, -1580, 540, 0, { w: 160, d: 160 }); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; place(g, K.chair, -1580 + Math.sin(a) * 105, 540 - Math.cos(a) * 105, (k * 60 + 180) % 360); }
  place(g, K.dome, -1580, 540, 0, { h: 70 }); place(g, K.plant, -1950, 300, 0);
  // Bureau-bibliothèque face à la mer, salle d'eau et buanderie derrière.
  place(g, K.books, 1350, 207, 0, { w: 280, h: 270, d: 38 }); place(g, K.books, 1750, 207, 0, { w: 280, h: 270, d: 38 });
  place(g, N('Table en noyer massif'), 1560, 520, 0, { w: 200, d: 90 }); place(g, pick('siege', ['cuir', 'tissu']), 1560, 450, 0); place(g, huxley, 1830, 380, 250); place(g, huxley, 1290, 430, 110); place(g, rock, 1850, 610, 40, { w: 110, d: 80, h: 60 });
  place(g, K.shower, 1330, 40, 0, { w: 120, d: 90 }); place(g, N('Double vasque noyer et pierre'), 1450, 147, 180, { w: 100 }); place(g, K.wc, 1516, -20, 90);
  for (const x of [1700, 1765]) place(g, N('Lave-linge 60 cm'), x, 140, 180);
  // Entrée : l'escalier hélicoïdal au centre de la rotonde, sous l'oculus du disque de l'étage ; WC et vestiaire de part et d'autre du sas.
  place(g, N('Colimaçon 1,60 m'), 0, -1450, 0); place(g, K.plant, -280, -1230, 0); place(g, K.plant, 280, -1230, 0);
  place(g, K.wc, -200, -1760, 0); place(g, N('Vasque monobloc en marbre'), -134, -1660, 90, { w: 50, d: 36 });
  place(g, pick('armoire', ['noyer', 'chêne', 'bois']), 146, -1700, 270, { w: 100 });
  // Galerie des voitures et salle de sport.
  place(g, N('Ferrari rouge'), 1420, -1430, 180); place(g, N('Porsche 911 marron'), 1690, -1430, 180);
  for (const x of [-1730, -1630]) place(g, N('Tapis de course'), x, -1330, 90); place(g, N('Banc de musculation réglable'), -1400, -1600, 0); place(g, K.rug, -1450, -1520, 0, { w: 260, d: 240, color: '#3a3733' }); place(g, N('Rangement haltères'), -1500, -1850, 0); place(g, K.plant, -1230, -1700, 0);
  // Bibliothèque suspendue : rayonnages sur tout l'anneau, fauteuils de lecture, garde-corps de verre côté vide.
  const rail = named('Garde-corps verre 2 m');
  inner.forEach((a, k) => { if (k === inner.length - 1) return; const b = inner[k + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, n = { x: (mx - S.c.x) / RI, y: (my - S.c.y) / RI }; place(u, rail, mx + n.x * 8, my + n.y * 8, facing(n), { w: Math.hypot(b[0] - a[0], b[1] - a[1]) - 16 }); });
  outer.forEach((a, k) => {
    if (k === outer.length - 1) return; const b = outer[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ang = nrm(Math.atan2(my - S.c.y, mx - S.c.x) / RAD);
    if (L > 150 || L < 40) return; const n = { x: -(mx - S.c.x) / 720, y: -(my - S.c.y) / 720 }; place(u, K.books, mx + n.x * 25, my + n.y * 25, facing(n), { w: L - 8, h: 270, d: 34 }); void ang;
  });
  for (const a of [220, 320]) { const [x, y] = pol(S.c, 665, a), n = { x: -Math.cos(a * RAD), y: -Math.sin(a * RAD) }; place(u, huxley, x, y, facing(n)); place(u, arc, ...pol(S.c, 670, a + 9), 0); }
  // Suite : lit face à la mer, baignoire îlot, double vasque ; bébé à côté.
  place(u, K.rug, -1550, 640, 0, { w: 260, d: 240 }); place(u, K.bed, -1550, 540, 0); place(u, K.cush, -1550, 482, 0, { w: 165, z: 62 });
  for (const dx of [-125, 125]) { place(u, K.chevet, -1550 + dx, 458, 0); place(u, K.lamp, -1550 + dx, 458, 0, { z: K.top(K.chevet) }); }
  place(u, huxley, -1800, 560, 120);
  place(u, N('Baignoire îlot ovale'), -1720, -20, 90, { w: 170, d: 78 }); place(u, N('Double vasque noyer et pierre'), -1431, -110, 90, { w: 90 });
  { const a = -40, n = { x: -Math.cos(a * RAD), y: -Math.sin(a * RAD) }, [x, y] = pol(K2.c, 440, a); place(u, N('Dressing sur mesure en noyer'), x, y, facing(n), { w: 180, d: 60, h: 250 }); }
  place(u, pick('lit-enfant', ['bébé', 'cododo', 'bois']) || K.bed, -1820, 260, 90); place(u, K.rug, -1680, 260, 0, { w: 160, d: 200 });
  // Chambres des enfants, salle de bain et WC.
  for (const [x, y, r] of [[1440, 20, 90], [1660, 20, 270], [1540, 600, 90]]) { place(u, K.bed, x, y, r); place(u, K.rug, x + (r === 90 ? -50 : 50), y, 0, { w: 220, d: 200 }); }
  place(u, K.shower, 1715, 680, 180, { w: 100, d: 90 }); place(u, N('Double vasque noyer et pierre'), 1681, 520, 270, { w: 100 }); place(u, K.wc, 1900, 520, 180);
  place(u, K.rug, -170, -1450, 0, { w: 180, d: 280, color: '#cbbfa8' }); place(u, K.sofa, -300, -1450, 270); place(u, K.plant, 300, -1290, 0); place(u, K.plant, 300, -1610, 0);
  glassRail(u, -86, -1536, 86, -1536); glassRail(u, -86, -1536, -86, -1364); glassRail(u, 86, -1536, 86, -1430);

  // ——— Dehors : terrasse suspendue en arc et sa piscine, pilotis inclinés, parvis rond et sculpture ———
  arcItem(g, N('Terrasse suspendue en arc'), S.c, { r0: 762, r1: 1120, a0: 18, a1: 162 }, { h: 35, fixed: true });
  arcItem(g, N('Piscine en arc'), S.c, { r0: 920, r1: 1070, a0: 52, a1: 128 }, { h: 10, fixed: true });
  for (const a of [32, 42, 138, 148]) { const [x, y] = pol(S.c, 950, a); out(N('Bain de soleil teck et matelas blanc'), x, y, facing({ x: -Math.cos(a * RAD), y: -Math.sin(a * RAD) }), { z: 1, fixed: true }); }
  arcItem(g, N('Estrade circulaire en marbre'), { x: 400, y: -2650 }, { r: 700, steps: 1, rise: 0.03, run: 0.3, paver: true }, { h: 3 });
  out(N('Sculpture en bronze'), 400, -2650, 0, { w: 260, h: 340, z: 3 });
  const palmT = N('Palmier'), cyp = N('Cyprès'), olive = N('Olivier');
  for (let k = 0; k < 8; k++) { const a = k * 45 + 22.5; out(palmT, 400 + 820 * Math.cos(a * RAD), -2650 + 820 * Math.sin(a * RAD), 0, { h: 820 + (k % 3) * 120 }); }
  for (const y of [-2300, -2900, -3500, -4100]) { out(cyp, 2600, y, 0); out(cyp, 3100, y, 0); }
  for (const [x, y] of [[-2400, -700], [-900, -2200], [2500, -500], [-2600, 400], [2650, 450], [-650, -300], [650, -320]]) out(olive, x, y, (x % 90 + 90) % 90);
  for (const [x, y, w] of [[-2900, 500, 220], [2900, 550, 200], [-2300, 750, 260], [2300, 780, 240], [-700, -2300, 180]]) out(rock, x, y, (x * 3 + 720) % 360, { w, d: w * 0.8, h: w * 0.5 });

  // Crique : plateau de la maison, falaise de près de 30 m qui s'enroule sous le salon et plonge dans la mer.
  shapeTerrain(p, 'flat', {});
  const m = ensureTerrain(p), half = (T_N - 1) / 2, cx = 0, cy = -600;
  p.site.terrain.cx = cx; p.site.terrain.cy = cy; m.cx = cx; m.cy = cy;
  const gravel = GROUND_GRAVEL + 1, edgeAt = (x) => Math.min(1250, -480 + 0.0009 * x * x) + 40 * Math.sin(x / 500) + 90 * Math.sin(x / 1900 + 1);
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + cx, y = (j - half) * 100 + cy, d = y - edgeAt(x);
    let h = 0;
    if (d > 0) h = Math.max(-4600, -smooth01(d / 450) * 2800 - Math.max(0, d - 450) * 1.1);
    if (y < -3400) h = smooth01((-3400 - y) / 2500) * 800;
    m.h[j * T_N + i] = Math.round(h);
    if (d > 40) m.p[j * T_N + i] = gravel;
  }
  commitTerrain(p);
  p.site.altitude = 0;
  // Pilotis inclinés en peigne : tous penchés vers la falaise, ils partent de l'éboulis et viennent cueillir le bord du salon et de la terrasse.
  const tilt = 22, tan = Math.tan(tilt * RAD);
  for (const [r, list] of [[690, [50, 90, 130]], [1080, [34, 62, 90, 118, 146]]]) for (const a of list) {
    const [x, y] = pol(S.c, r, a), top = -36, ground = (h) => heightAt(m, x, y - tan * h) * 100;
    if (ground(0) > -150) continue;
    let lo = 50, hi = 5000; for (let k = 0; k < 40; k++) { const h = (lo + hi) / 2; if (ground(h) + h > top) hi = h; else lo = h; }
    const h = Math.round(lo);
    out(N('Pilotis incliné en béton'), x, y, 0, { z: Math.round(top - h), h, w: 70, d: Math.round(70 + tan * h), p: { tilt }, fixed: true });
  }
  // Côte : seules les pièces entièrement posées sur le plateau découpent le terrain, les passerelles au bord du vide le laissent entier.
  p.site.cliff = true;
  p.site.parcel = { pts: [{ x: -5000, y: -5500 }, { x: 5000, y: -5500 }, { x: 5000, y: 3000 }, { x: -5000, y: 3000 }] };
  return p;
}

/** Villa Belle Époque de la Riviera : enduit ocre, toit à la Mansart en ardoise et lucarnes, tour belvédère à balustrade, jardin en terrasses face à la mer. */
function houseRiviera() {
  const p = newProject('Villa Belle Époque');
  p.style = { facade: 'facade_ocre_jaune', roof: 'roof_ardoise', joinery: '#ece9e2', trim: '#efe6d3', cornice: true, quoins: true };
  p.roof = { type: 'none', pitch: 30, overhang: 0, ridge: 'auto' };
  p.site.env = 'mer';
  const K = kit(), N = K.N, SH = '#6f8576';
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });
  const SHELL = [[0, 0], [2400, 0], [2400, 500], [3050, 500], [3050, 1250], [2400, 1250], [2400, 1150], [0, 1150]];
  const TOWER = [[2400, 500], [3050, 500], [3050, 1250], [2400, 1250]];
  // Fenêtres : encadrement en pierre claire, persiennes vert-de-gris ; les plus nobles ont une petite corniche.
  const WIN = { name: 'Fenêtre à la française', muntins: [2, 4], surround: true, shutters: SH, louvres: true };
  const FR = { name: 'Porte-fenêtre à la française', muntins: [2, 5], surround: true, shutters: SH, louvres: true };
  const FRC = { ...FR, surround: 'cornice' }, WINC = { ...WIN, surround: 'cornice' };
  const SMALL = { name: 'Petite fenêtre', muntins: [1, 2], surround: true };
  const SOUTH = [200, 550, 875, 1200, 1525, 1850, 2200];

  // ——— Rez-de-chaussée : un grand séjour ouvert de la cour à la mer, cuisine, repas, hall et salon d'un seul tenant ———
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 330; g.slab = 30;
  outline(g, SHELL, 45);
  partition(g, 2400, 500, 2400, 1150, 30);
  // Seul bloc fermé : WC, vestiaire et salle de sport, côté cour.
  partition(g, 1650, 500, 2400, 500, 20); partition(g, 1650, 0, 1650, 500, 20);
  partition(g, 1900, 0, 1900, 500, 15); partition(g, 1650, 220, 1900, 220, 10);
  // Mur-cheminée entre le séjour et le salon-bibliothèque : deux grands passages de part et d'autre des foyers adossés.
  partition(g, 1650, 500, 1650, 1150, 25);
  // Côté cour (nord) : porte d'entrée vitrée, cuisine, WC, salle de sport.
  open(g, 1450, 0, 'entry', 170, 290, 0, { name: "Porte d'entrée vitrée", leaves: 2, glazed: true, color: '#3e4d45', surround: 'cornice' });
  for (const x of [200, 560]) open(g, x, 0, 'window2', 120, 175, 105, WIN);
  open(g, 1080, 0, 'window2', 120, 175, 105, { ...WIN, name: 'Fenêtre aux persiennes closes', closed: true });
  open(g, 1775, 0, 'window1', 60, 90, 150, SMALL); open(g, 2150, 0, 'window2', 120, 200, 80, WIN);
  // Côté mer (sud) : sept portes-fenêtres, celles du salon couronnées d'une corniche.
  for (const x of [200, 550, 1850, 2200]) open(g, x, 1150, 'window2', 130, 270, 0, FR);
  for (const x of [875, 1200, 1525]) open(g, x, 1150, 'window2', 130, 270, 0, FRC);
  open(g, 0, 250, 'window2', 120, 175, 105, WIN); open(g, 0, 880, 'window2', 120, 220, 60, WIN); open(g, 2400, 250, 'window2', 120, 200, 80, WIN);
  open(g, 2725, 1250, 'window2', 140, 280, 0, FRC); open(g, 3050, 875, 'window2', 140, 280, 0, FRC); open(g, 2725, 500, 'window2', 120, 200, 80, WIN);
  // Circulations : grands passages toute hauteur, portes seulement pour les pièces de service.
  const WIDE = { name: 'Grand passage' };
  open(g, 1650, 613, 'passage', 200, 300, 0, WIDE); open(g, 1650, 1037, 'passage', 200, 300, 0, WIDE);
  open(g, 2400, 825, 'passage', 260, 300, 0, { name: 'Passage du jardin d’hiver' });
  open(g, 1650, 360, 'door', 83, 225, 0); open(g, 1775, 220, 'door', 73, 215, 0); open(g, 1900, 360, 'door', 83, 225, 0);
  const herring = 'herringbone', lime = 'paint_wimborne', panels = { moulding: 'panels' };
  setRoom(g, 1000, 700, 'salon', 'Grand séjour', { floor: 'marble', paint: 'paint_all_white', ...panels });
  setRoom(g, 1775, 110, 'wc', 'WC', { floor: 'marble', paint: 'paint_setting' });
  setRoom(g, 1775, 360, 'dressing', 'Vestiaire', { floor: 'marble', paint: lime });
  setRoom(g, 2150, 250, 'piece', 'Salle de sport', { floor: 'oak_natural', paint: 'paint_skimming' });
  setRoom(g, 2025, 825, 'salon', 'Salon bibliothèque', { floor: herring, paint: 'paint_hague', ...panels });
  setRoom(g, 2725, 875, 'piece', 'Jardin d’hiver', { floor: 'marble', paint: 'paint_all_white' });
  p.entry = 0; syncRooms(g);

  // ——— Étage : un palier-salon lumineux au centre, ouvert sur la mer ; chambres dans les deux ailes ———
  const u = newLevel('Étage', 300); u.slab = 25;
  outline(u, SHELL, 45);
  partition(u, 2400, 500, 2400, 1150, 30);
  for (const [x0, x1] of [[0, 750], [1650, 2400]]) { partition(u, x0, 500, x1, 500, 15); partition(u, x0, 650, x1, 650, 15); }
  partition(u, 750, 0, 750, 1150, 15); partition(u, 1650, 0, 1650, 1150, 15);
  partition(u, 450, 0, 450, 500, 12); partition(u, 1950, 650, 1950, 1150, 12);
  const UW = { ...WIN, muntins: [2, 3] };
  for (const [x, w, h, s, o] of [[200, 120, 185, 55, UW], [650, 80, 120, 120, SMALL], [1080, 120, 170, 70, UW], [1450, 120, 170, 70, UW], [1775, 120, 185, 55, UW], [2150, 120, 185, 55, UW]]) open(u, x, 0, 'window2', w, h, s, o);
  // Côté mer : portes-fenêtres sur balconnets en fer forgé.
  const UFR = { ...FR, name: 'Porte-fenêtre sur balconnet', muntins: [2, 4] };
  for (const x of SOUTH) open(u, x, 1150, 'window2', 120, 240, 0, UFR);
  open(u, 0, 250, 'window2', 120, 185, 55, UW); open(u, 0, 575, 'window1', 60, 120, 100, SMALL); open(u, 0, 880, 'window2', 120, 185, 55, UW); open(u, 2400, 250, 'window2', 120, 185, 55, UW);
  for (const [x, y] of [[2725, 1250], [3050, 875], [2725, 500]]) open(u, x, y, 'window2', 120, 160, 80, UW);
  open(u, 750, 575, 'passage', 120, 240, 0, WIDE); open(u, 1650, 575, 'passage', 120, 240, 0, WIDE);
  open(u, 225, 500, 'door', 83, 215, 0); open(u, 600, 500, 'door', 83, 215, 0); open(u, 375, 650, 'door', 83, 215, 0);
  open(u, 1775, 500, 'door', 83, 215, 0); open(u, 2150, 650, 'door', 86, 225, 0, { name: 'Porte de la suite' });
  open(u, 1950, 760, 'door', 83, 215, 0); open(u, 2400, 575, 'door', 83, 215, 0, { name: 'Porte de la tour' });
  setRoom(u, 225, 250, 'chambre', 'Chambre 3', { floor: herring, paint: 'paint_skimming' });
  setRoom(u, 600, 250, 'sdb', 'Salle de bain', { floor: 'marble', paint: 'wall_marbre' });
  setRoom(u, 375, 575, 'couloir', 'Dégagement ouest', { floor: herring, paint: lime });
  setRoom(u, 375, 900, 'chambre', 'Chambre 2', { floor: herring, paint: 'paint_setting' });
  setRoom(u, 1200, 600, 'couloir', 'Palier', { floor: herring, paint: 'paint_all_white', ...panels });
  setRoom(u, 2025, 250, 'chambre', 'Chambre 4', { floor: herring, paint: 'paint_mizzle' });
  setRoom(u, 2025, 575, 'couloir', 'Dégagement est', { floor: herring, paint: lime });
  setRoom(u, 1800, 900, 'sdb', 'Salle de bain parentale', { floor: 'marble', paint: 'wall_marbre' });
  setRoom(u, 2175, 900, 'parentale', 'Suite parentale', { floor: herring, paint: lime, ...panels });
  setRoom(u, 2725, 875, 'bureau', 'Bureau de la tour', { floor: herring, paint: 'paint_green_smoke' });
  p.levels.push(u); syncRooms(u);

  // ——— La tour : bibliothèque puis belvédère vitré sur les quatre côtés ———
  const t3 = newLevel('Tour', 290); t3.slab = 25;
  outline(t3, TOWER, 45);
  for (const [x, y] of [[2725, 1250], [3050, 875], [2725, 500]]) open(t3, x, y, 'window2', 110, 175, 70, UW);
  setRoom(t3, 2725, 875, 'bureau', 'Bibliothèque de la tour', { floor: herring, paint: 'wall_noyer' });
  p.levels.push(t3); syncRooms(t3);
  const t4 = newLevel('Belvédère', 300);
  outline(t4, TOWER, 45);
  const BW = { name: 'Fenêtre du belvédère', muntins: [2, 4], surround: 'cornice' };
  for (const x of [2610, 2840]) { open(t4, x, 1250, 'window2', 100, 200, 40, BW); open(t4, x, 500, 'window2', 100, 200, 40, BW); }
  for (const y of [760, 990]) { open(t4, 3050, y, 'window2', 100, 200, 40, BW); open(t4, 2400, y, 'window2', 100, 200, 40, BW); }
  setRoom(t4, 2725, 875, 'salon', 'Belvédère', { floor: herring, paint: 'paint_all_white' });
  p.levels.push(t4); syncRooms(t4);

  // ——— Toits : Mansart en ardoise sur le corps de logis, terrasse à balustrade au sommet de la tour ———
  const R = (lv, x0, y0, x1, y1, type, ridge, pitch, extra = {}) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type, pitch, overhang: 0, ridge, wallH: 0, ...extra });
  const alt = (list) => list.map((at, i) => ({ at, kind: i % 2 ? 'seg' : 'tri' }));
  p.roofs = [
    R(u, 0, 0, 2400, 1150, 'mansard', 'x', 8, { brisH: 230, brisPitch: 74, dormers: [
      ...alt(SOUTH).map((d) => ({ ...d, side: 's', w: 100, h: 140 })),
      ...alt([200, 560, 1080, 1450, 1775, 2150]).map((d) => ({ ...d, side: 'n', w: 95, h: 135 })),
      { side: 'w', at: 575, w: 95, h: 135, kind: 'seg' }, { side: 'e', at: 250, w: 95, h: 135, kind: 'seg' },
    ], chimneys: [{ x: 1650, y: 900, rot: 90 }, { x: 750, y: 250, rot: 90 }] }),
    R(t4, 2400, 500, 3050, 1250, 'flat', 'x', 0, { balustrade: true }),
  ];

  // ——— Meubles du rez-de-chaussée : un seul grand volume, des zones dessinées par les tapis et la lumière ———
  const lustre = N('Lustre'), mantel = N('Cheminée en marbre blanc et trumeau');
  const hang = (lv, x, y) => place(lv, lustre, x, y, 0, { w: 110, d: 110, h: 105 });
  place(g, N('Escalier américain droit'), 993, 82, 90);
  // Hall : une table ronde sculpturale dans l'axe de la porte, sous un lustre.
  place(g, N('Table piédestal en plâtre'), 1380, 300, 0); place(g, N('Grande jarre et branches fleuries'), 1380, 300, 0, { z: 80 });
  hang(g, 1380, 300); place(g, K.plant, 1600, 455, 0);
  // Salon : canapé face à la cheminée de marbre, deux fauteuils en vis-à-vis, console derrière le canapé.
  place(g, mantel, 1614, 825, 90);
  place(g, K.rug, 1300, 825, 0, { w: 440, d: 340 }); place(g, K.low, 1310, 825, 90, { w: 130, d: 70 }); place(g, K.vase, 1310, 825, 0, { z: K.top(K.low), w: 30, d: 30, h: 55 });
  place(g, K.sofa, 1060, 825, 270); place(g, K.cush, 1040, 825, 270, { w: 200, z: 44 });
  const cons = K.N('Buffet noyer à portes cintrées'); place(g, cons, 960, 825, 90, { w: 200, d: 45 }); for (const k of [-1, 1]) place(g, K.lamp, 960, 825 + k * 75, 0, { z: K.top(cons) });
  place(g, K.arm, 1330, 645, 0); place(g, K.arm, 1330, 1005, 180);
  place(g, K.side, 1420, 645, 0); place(g, K.lamp, 1420, 645, 0, { z: K.top(K.side) });
  hang(g, 1300, 825);
  // Repas : grande table de noyer pour dix, suspension couronne, enfilade basse contre le mur ouest.
  place(g, K.rug, 380, 830, 0, { w: 460, d: 330 }); place(g, N('Table en noyer massif'), 380, 830, 0, { w: 280, d: 105 });
  for (const k of [-1.5, -0.5, 0.5, 1.5]) { place(g, K.chair, 380 + k * 66, 745, 0); place(g, K.chair, 380 + k * 66, 915, 180); }
  for (const k of [-1, 1]) place(g, K.chair, 380 + k * 175, 830, k > 0 ? 90 : 270);
  for (const k of [-1, 1]) place(g, K.vase, 380 + k * 80, 830, 0, { z: 76, w: 30, d: 30, h: 62 });
  place(g, K.ring, 380, 830, 0, { z: 205, w: 200, d: 200, h: 125 });
  place(g, K.buffet, 47, 1040, 270, { w: 150 });
  // Cuisine ouverte : linéaire sous les fenêtres, piano entre les deux, colonnes à l'ouest, îlot de quatre places tourné vers la mer.
  place(g, N('Linéaire noyer et marbre'), 197, 55, 0, { w: 244 }); place(g, N('Linéaire noyer et marbre'), 557, 55, 0, { w: 232 });
  place(g, N('Piano de cuisson et hotte habillée'), 380, 56, 0, { w: 120, h: 300 });
  place(g, N('Colonnes noyer et laiton'), 56, 435, 270, { w: 220, h: 300 });
  place(g, N('Îlot noyer et marbre'), 400, 290, 0, { w: 300, d: 110 });
  for (const k of [-1.5, -0.5, 0.5, 1.5]) place(g, K.stool, 400 + k * 64, 375, 180);
  for (const k of [-1, 1]) place(g, N('Lanterne laiton et verre'), 400 + k * 80, 290, 0, { h: 140 });
  curtainsFor(K, g, 'Grand séjour', K.cream);
  // Salon-bibliothèque : bleu profond, livres sur tout un mur, l'autre face de la cheminée.
  place(g, mantel, 1686, 825, 270);
  place(g, K.books, 2025, 530, 0, { w: 600, h: 300, d: 38 });
  place(g, K.rug, 1990, 825, 0, { w: 380, d: 320 }); place(g, K.low, 1980, 825, 90, { w: 120, d: 65 });
  place(g, K.sofa, 2120, 825, 90); place(g, K.cush, 2140, 825, 90, { w: 200, z: 44 });
  place(g, K.arm, 1980, 670, 0); place(g, K.arm, 1980, 990, 180);
  hang(g, 1990, 825); curtainsFor(K, g, 'Salon bibliothèque', K.cream);
  // Services.
  place(g, K.wc, 1777, 62, 0); place(g, N('Vasque monobloc en marbre'), 1867, 130, 90, { w: 60, d: 40 });
  place(g, N('Dressing sur mesure en noyer'), 1776, 462, 180, { w: 200, h: 260, d: 55 });
  furnishGym(K, g, 'Salle de sport');
  // Jardin d'hiver : rotin, plantes, table ronde.
  const rattan = pick('fauteuil', ['rotin', 'cannage', 'bouclé']);
  place(g, K.rug, 2740, 900, 0, { w: 300, d: 300, color: '#d8ccb4' }); place(g, N('Table basse ronde bois'), 2740, 900, 0);
  place(g, K.sofa, 2725, 590, 0); place(g, rattan, 2600, 1040, 160); place(g, rattan, 2880, 1040, 200);
  for (const [x, y] of [[2985, 565], [2985, 1185], [2470, 1185]]) place(g, K.plant, x, y, 0);

  // ——— Meubles de l'étage ———
  const rail = N('Garde-corps bois classique'), iron = N('Garde-corps métal 2 m');
  place(u, rail, 1073, 145, 0, { w: 305 }); place(u, rail, 920, 84, 90, { w: 122 });
  // Palier-salon : deux murs de livres face à face, un salon de lecture tourné vers les trois portes-fenêtres.
  for (const [x, rot] of [[778, 270], [1622, 90]]) { place(u, K.books, x, 260, rot, { w: 420, h: 280, d: 38 }); place(u, K.books, x, 905, rot, { w: 420, h: 280, d: 38 }); }
  place(u, K.rug, 1200, 900, 0, { w: 400, d: 300 }); place(u, K.low, 1200, 920, 0, { w: 120, d: 65 });
  place(u, K.sofa, 1200, 770, 0); place(u, K.cush, 1200, 750, 0, { w: 200, z: 44 });
  place(u, K.arm, 1010, 930, 270); place(u, K.arm, 1390, 930, 90);
  place(u, lustre, 1200, 880, 0, { w: 100, d: 100, h: 95 });
  furnishBedroom(K, u, 'Chambre 3', 'e'); furnishBedroom(K, u, 'Chambre 4', 'o'); furnishBedroom(K, u, 'Chambre 2', 'e');
  furnishBedroom(K, u, 'Suite parentale', 'e', true);
  place(u, N('Dressing sur mesure en noyer'), 1984, 980, 270, { w: 280, h: 260, d: 55 });
  furnishShower(K, u, 'Salle de bain');
  // Salle de bain de la suite : baignoire îlot, double vasque, WC.
  place(u, N('Baignoire îlot ovale'), 1775, 720, 0, { w: 170, d: 78 });
  place(u, N('Double vasque noyer et pierre'), 1912, 905, 90, { w: 140 });
  place(u, K.wc, 1693, 1047, 270);
  for (const r of ['Chambre 2', 'Chambre 3', 'Chambre 4', 'Suite parentale', 'Palier']) curtainsFor(K, u, r, K.cream);
  for (const x of SOUTH) place(u, N('Balcon métal 3 m'), x, 1198, 0, { w: 160, d: 50, z: 0.5 });
  // Bureau de la tour, puis bibliothèque et belvédère, reliés par deux escaliers en colimaçon.
  const spiral = N('Colimaçon 1,60 m');
  place(u, spiral, 2940, 612, 90);
  place(u, N('Table en noyer massif'), 2700, 1085, 0, { w: 170, d: 80 }); place(u, pick('siege', ['cuir', 'tissu']), 2700, 1015, 0);
  place(u, K.books, 2435, 940, 270, { w: 420, h: 280, d: 38 }); place(u, K.rug, 2700, 960, 0, { w: 260, d: 200 });
  place(t3, iron, 2982, 695, 0, { w: 84 }); place(t3, iron, 2857, 568, 90, { w: 86 });
  place(t3, spiral, 2940, 1138, 180);
  place(t3, K.books, 2443, 875, 270, { w: 640, h: 280, d: 38 });
  place(t3, K.rug, 2650, 875, 0, { w: 260, d: 240 }); place(t3, K.arm, 2620, 780, 270); place(t3, K.arm, 2620, 970, 270);
  place(t3, K.side, 2620, 875, 0); place(t3, K.lamp, 2620, 875, 0, { z: K.top(K.side) });
  place(t4, iron, 2982, 1055, 0, { w: 84 }); place(t4, iron, 2857, 1162, 90, { w: 120 });
  place(t4, K.rug, 2690, 820, 0, { w: 300, d: 240 }); place(t4, K.sofa, 2690, 720, 0); place(t4, K.arm, 2560, 960, 20); place(t4, K.arm, 2800, 960, 340);
  place(t4, K.plant, 2465, 565, 0); place(t4, K.plant, 2465, 1185, 0);

  // ——— Dehors : terrasse dallée, long bassin, balustrade sur la restanque, oliveraie en contrebas ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), slab = N('Terrasse pierre');
  out(slab, 1039, 1412, 0, { w: 2678, d: 475 }); out(slab, 2864, 1462, 0, { w: 972, d: 375 }); out(slab, 3212, 887, 0, { w: 275, d: 775 });
  out(N('Piscine 8 × 4'), 1200, 2150, 0, { w: 1500, d: 350, z: 2 });
  for (const x of [650, 900, 1500, 1750]) out(N('Bain de soleil teck et matelas blanc'), x, 2470, 0, { z: 1 });
  out(N('Parasol en toile'), 1200, 2470, 0);
  for (const x of [700, 1000, 1400, 1700]) out(N('Massif de rosiers'), x, 1770, 0, { w: 260 });
  const tile = (def, x0, x1, y, extra, max = 300) => { const n = Math.ceil((x1 - x0) / max), w = (x1 - x0) / n; for (let i = 0; i < n; i++) out(def, x0 + w * (i + 0.5), y, 0, { ...extra, w }); };
  const balus = N('Balustrade en pierre 3 m'), wallS = N('Mur de soutènement pierre 3 m');
  tile(balus, -2100, 1128, 2740, { fixed: true, z: -5 }); tile(balus, 1292, 4500, 2740, { fixed: true, z: -5 });
  tile(wallS, -4500, 1140, 2755, { fixed: true, z: -355, h: 355, d: 110 }); tile(wallS, 1280, 7500, 2755, { fixed: true, z: -355, h: 355, d: 110 });
  out(N('Marches extérieures 1,20 m'), 1210, 2980, 0, { fixed: true, z: -355, h: 350, d: 560, w: 120, p: { solid: true } });
  for (const x of [-1500, -900, -300, 300, 2100, 2700, 3300, 3900]) out(N('Massif de lavande'), x, 2900, 0, { w: 300 });
  const olive = N('Olivier'), cyp = N('Cyprès'), palm = N('Palmier'), pine = N('Pin parasol');
  for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) { const x = -1700 + i * 750 + (r % 2) * 375; if (Math.abs(x - 1210) > 300) out(olive, x, 3250 + r * 420, (i * 37) % 360, { w: 420, d: 420, h: 400 }); }
  out(pine, -2300, 3500, 0); out(pine, 4700, 3400, 0); out(pine, 5200, 1500, 0);
  out(cyp, 3330, 1350, 0, { w: 150, d: 150, h: 1500 }); out(cyp, 3470, 1550, 0, { w: 130, d: 130, h: 1250 }); out(cyp, -330, 1350, 0, { w: 140, d: 140, h: 1300 });
  out(palm, -1000, 1900, 0, { h: 1050 }); out(palm, 3900, 2200, 0, { h: 1150 }); out(olive, -1300, 2350, 0, { w: 520, d: 520, h: 470 }); out(olive, 3600, 900, 0, { w: 480, d: 480, h: 450 });
  for (const x of [375, 1062, 1337, 2025]) out(N('Buis taillé en boule'), x, 1215, 0, { w: 70, d: 70, h: 80 });
  // Terrasse : table pour dîner dehors sous un parasol.
  out(N('Table en noyer massif'), 2700, 1500, 0, { w: 220, d: 95 }); for (const k of [-1, 0, 1]) { out(K.outChair, 2700 + k * 72, 1425, 0); out(K.outChair, 2700 + k * 72, 1575, 180); }
  out(N('Parasol en toile'), 2700, 1500, 0);
  // Cour d'arrivée en gravier, palmiers, buis devant la porte et allée de cyprès.
  for (const x of [850, 2050]) out(palm, x, -700, 0, { h: 950 });
  for (const x of [1320, 1580]) out(N('Buis taillé en boule'), x, -95, 0, { w: 70, d: 70, h: 80 });
  place(g, N('Marquise en verre et fer forgé'), 1450, -83, 180, { z: 312, w: 250, d: 115, h: 60 });
  for (const y of [-2000, -2600, -3200, -3800, -4400]) { out(cyp, 1150, y, 0); out(cyp, 1750, y, 0); }
  out(olive, -700, -900, 0, { w: 520, d: 520, h: 470 }); out(olive, 3400, -800, 0, { w: 520, d: 520, h: 470 });

  // Terrain : cour et maison sur un replat, colline derrière, restanque de 3,5 m puis la pente jusqu'à la mer.
  shapeTerrain(p, 'flat', {});
  const m = ensureTerrain(p), half = (T_N - 1) / 2, cx = 1500, cy = 1500;
  p.site.terrain.cx = cx; p.site.terrain.cy = cy; m.cx = cx; m.cy = cy;
  const gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + cx, y = (j - half) * 100 + cy;
    let h = 0;
    if (y < -1900) h = smooth01((-1900 - y) / 2600) * (1300 + 160 * Math.sin(x / 1300));
    else if (y > 2760) h = -350 - Math.max(0, y - 3900) * 0.5 - (y > 3900 ? 60 * Math.sin(x / 900) * smooth01((y - 3900) / 800) : 0);
    m.h[j * T_N + i] = Math.round(h);
    if ((y >= -1700 && y <= -60 && x >= -900 && x <= 3700) || (y < -1700 && x >= 1300 && x <= 1600)) m.p[j * T_N + i] = gravel;
  }
  commitTerrain(p);
  p.site.altitude = 0;
  p.site.parcel = { pts: [{ x: -3500, y: -4500 }, { x: 6500, y: -4500 }, { x: 6500, y: 4200 }, { x: -3500, y: 4200 }] };
  return p;
}

export const TEMPLATES = [
  { id: 'manoir', name: 'Maison anglaise, 5 chambres', desc: 'Grande maison à l’américaine : porche, grand escalier, salon cathédrale, terrasse couverte et piscine', make: () => houseManor() },
  { id: 'manoir-plus', name: 'Maison anglaise, un peu plus d’espace', desc: 'La même maison avec des pièces plus grandes et des plafonds plus hauts, pour comparer', make: () => houseManor({ roomy: true }) },
  { id: 'mas', name: 'Mas provençal, 4 chambres', desc: 'Pierre et enduit blanc, tuiles canal, volets bois, arcades sur la piscine, oliviers et restanques', make: houseMas },
  { id: 'villa', name: 'Villa contemporaine, 4 chambres', desc: 'Travertin, grandes dalles blanches en porte-à-faux, baies toute hauteur, pergola à lames et piscine à débordement', make: houseVilla },
  { id: 'patio', name: 'Maison à patio, 4 chambres', desc: 'Un U autour d’une cour plantée et de son bassin, galerie vitrée, galerie-bibliothèque à l’étage, toits-terrasses, esprit japandi', make: housePatio },
  { id: 'midcentury', name: 'Maison mid-century, 4 chambres', desc: 'Pavillon sous toit papillon et bandeau vitré, boîte blanche en porte-à-faux sur l’abri voiture, claustra, terrazzo, noyer et piscine haricot', make: houseMidCentury },
  { id: 'barn', name: 'Grange contemporaine, 4 chambres', desc: 'Bardage noir, nef ouverte jusqu’à la charpente, cheminée monolithe, passerelle entre les deux ailes de nuit, esprit loft', make: houseBarn },
  { id: 'riviera', name: 'Villa Belle Époque, 4 chambres', desc: 'Villa de la Riviera face à la mer : enduit ocre, toit à la Mansart et lucarnes, tour belvédère à balustrade ; dedans, un grand séjour ouvert avec cuisine, un salon-bibliothèque, un palier-salon sur la mer, long bassin et jardin en terrasses', make: houseRiviera },
  { id: 'disques', name: 'Villa des Disques, 5 chambres', desc: 'Six disques blancs reliés par des passerelles de verre au bord d’une crique : salon rond en double hauteur au-dessus du vide, bibliothèque suspendue en anneau, terrasse et piscine en arc, pilotis inclinés', make: houseDiscs },
  { id: 'hill', name: 'Maison sur la colline', desc: 'Salon et cuisine en haut, chambres en dessous avec vue sur la vallée', make: houseHillside },
  { id: 'single', name: 'Plain-pied meublé', desc: '126 m², 3 chambres, déjà aménagé', make: houseSinglestorey },
  { id: 'two', name: 'Maison à étage', desc: '2 niveaux, 88 m² au sol, avec escalier', make: houseTwoStorey },
  { id: 'empty', name: 'Page blanche', desc: 'Partir de zéro ou d’un plan importé', make: () => newProject('Notre maison') },
];
void store;
