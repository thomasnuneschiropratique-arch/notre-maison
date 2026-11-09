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

/** Grande maison à l'américaine. Le nord (haut du plan) est l'arrivée, le sud le jardin. */
function houseManor() {
  const p = newProject('Maison anglaise');
  p.style = { facade: 'facade_pierre_blonde', roof: 'roof_ardoise', joinery: '#1c1d1f' };
  p.roof = { type: 'none', pitch: 45, overhang: 35, ridge: 'auto' };
  p.site.env = 'campagne';
  const G_ = (id) => getItem(id);
  const outline = (lv, pts, t) => pts.forEach(([x, y], i) => { const [X, Y] = pts[(i + 1) % pts.length]; wallLine(lv, x, y, X, Y, t); });

  // ——— Rez-de-chaussée ———
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 300; g.slab = 30;
  outline(g, [[750, 0], [900, 0], [900, -200], [1250, -200], [1250, 0], [1400, 0], [1400, -150], [2000, -150], [2000, 0], [2600, 0], [2600, -700], [3500, -700], [3500, 0], [3200, 0], [3200, 1250], [2600, 1250], [2600, 1100], [750, 1100], [750, 1200], [0, 1200], [0, 300], [750, 300]], 35);
  partition(g, 750, 300, 750, 1100, 15);
  partition(g, 750, 250, 1400, 250, 12); partition(g, 900, 0, 900, 250, 12); partition(g, 1250, 0, 1250, 250, 12); partition(g, 750, 0, 750, 300, 35);
  partition(g, 1400, 0, 1400, 1100, 15);
  partition(g, 1400, 500, 2600, 500, 15); partition(g, 2000, 500, 2000, 1100, 15); partition(g, 2000, 0, 2000, 500, 12); partition(g, 2300, 0, 2300, 500, 12);
  partition(g, 2600, 0, 2600, 1100, 15); partition(g, 2600, 500, 3200, 500, 15); partition(g, 2600, 0, 3200, 0, 20);

  // Entrée sous le porche, puis portes vitrées vers le hall : on sait qu'on est arrivé.
  open(g, 1075, -200, 'entry', 200, 260, 0, { name: "Porte d'entrée double", leaves: 2, glazed: true });
  open(g, 900, -100, 'window2', 90, 180, 60, ANGLAISE); open(g, 1250, -100, 'window2', 90, 180, 60, ANGLAISE);
  open(g, 1075, 250, 'double', 200, 250, 0, { name: 'Double porte du hall', glazed: true });
  open(g, 900, 125, 'door', 83, 215, 0); open(g, 1250, 125, 'door', 73, 215, 0);
  open(g, 825, 0, 'window2', 90, 150, 90, ANGLAISE); open(g, 1325, 0, 'window1', 60, 90, 130, { name: 'Petite fenêtre' });
  // Le salon, à une porte du hall.
  open(g, 0, 400, 'window2', 150, 540, 40, HAUTE_ANGLAISE); open(g, 0, 1100, 'window2', 150, 540, 40, HAUTE_ANGLAISE);
  open(g, 375, 1200, 'bay', 560, 420, 0, BAIE_ANGLAISE); open(g, 200, 300, 'window2', 180, 460, 50, HAUTE_ANGLAISE); open(g, 550, 300, 'window2', 180, 460, 50, HAUTE_ANGLAISE);
  open(g, 750, 720, 'double', 240, 280, 0, { name: 'Double porte du salon' });
  // Salle à manger et cuisine, l'une à côté de l'autre, ouvertes sur la terrasse.
  open(g, 1400, 800, 'double', 220, 270, 0, { name: 'Double porte' }); open(g, 2000, 800, 'passage', 260, 265, 0, { name: 'Grand passage' });
  open(g, 1075, 1100, 'window2', 280, 265, 0, PORTE_ANGLAISE); open(g, 1700, 1100, 'bay', 380, 265, 0, BAIE_ANGLAISE);
  open(g, 2270, 1100, 'bay', 340, 115, 105, { name: 'Passe-plat ouvert sur la terrasse', muntins: [1, 1] }); open(g, 2525, 1100, 'window2', 110, 250, 0, { name: 'Porte-fenêtre', muntins: [1, 5] });
  // Pièce modulable (bureau, jeux, future chambre) et sa salle de bain, salle de sport, service.
  open(g, 1400, 375, 'double', 180, 240, 0, { name: 'Double porte' }); open(g, 1700, -150, 'window2', 340, 230, 40, ANGLAISE); open(g, 2000, 250, 'door', 83, 215, 0); open(g, 2150, 0, 'window2', 100, 130, 110, ANGLAISE);
  open(g, 2450, 500, 'door', 83, 215, 0); open(g, 2450, 0, 'window2', 110, 130, 100, ANGLAISE); open(g, 2600, 250, 'door', 83, 215, 0); open(g, 2900, 500, 'double', 160, 230, 0, { name: 'Double porte' }); open(g, 2800, 0, 'door', 93, 215, 0); open(g, 3200, 250, 'window2', 180, 140, 100, ANGLAISE);
  open(g, 2900, 1250, 'window2', 380, 265, 0, PORTE_ANGLAISE); open(g, 3200, 850, 'window2', 340, 240, 30, ANGLAISE); open(g, 2600, 1175, 'window1', 80, 220, 30, ANGLAISE); 
  for (const x of [2830, 3270]) open(g, x, -700, 'garage', 340, 240, 0, { name: 'Porte de garage' });
  open(g, 3500, -350, 'window2', 180, 140, 100, ANGLAISE);

  const oak = 'oak_light', stone = 'dalle_pierre', warm = 'paint_wimborne', lin = 'paint_lin';
  setRoom(g, 375, 750, 'salon', 'Grand salon', { floor: 'dark_planks', paint: warm });
  setRoom(g, 1075, 40, 'entree', 'Entrée', { floor: stone, paint: 'wall_noyer', moulding: 'crown' });
  setRoom(g, 825, 125, 'dressing', 'Penderie', { floor: stone, paint: lin });
  setRoom(g, 1325, 125, 'wc', 'WC', { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(g, 1075, 950, 'couloir', 'Hall', { floor: stone, paint: warm, moulding: 'panels' });
  setRoom(g, 1700, 800, 'repas', 'Salle à manger', { floor: 'herringbone', paint: 'paint_setting', moulding: 'panels' });
  setRoom(g, 2300, 800, 'cuisine', 'Cuisine', { floor: oak, paint: lin, moulding: 'crown' });
  setRoom(g, 1700, 175, 'bureau', 'Bureau, jeux ou chambre', { floor: oak, paint: 'paint_mizzle', moulding: 'panels' });
  setRoom(g, 2150, 250, 'douche', "Salle d'eau", { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(g, 2450, 250, 'cellier', 'Cellier', { floor: stone, paint: lin });
  setRoom(g, 2900, 250, 'buanderie', 'Buanderie', { floor: stone, paint: 'wall_bois' });
  setRoom(g, 2900, 850, 'piece', 'Salle de sport', { floor: oak, paint: 'wall_bois' });
  setRoom(g, 3050, -350, 'garage', 'Garage', { floor: 'concrete_floor', paint: 'paint_skimming' });
  clad(g, 375, 750, 'wall_pierre_blonde', 'o');
  clad(g, 2300, 800, 'wall_noyer', 'ne');

  // ——— Étage ———
  const u = newLevel('Étage', 280);
  rect(u, 750, 0, 3200, 1100, 30);
  partition(u, 1500, 0, 1500, 1100); partition(u, 750, 760, 1500, 760); partition(u, 1500, 420, 2500, 420); partition(u, 1500, 620, 2500, 620);
  partition(u, 2500, 0, 2500, 1100); partition(u, 2500, 420, 3200, 420); partition(u, 2850, 0, 2850, 420);
  partition(u, 2000, 620, 2000, 1100); partition(u, 1900, 0, 1900, 420); partition(u, 2100, 0, 2100, 420);
  open(u, 1125, 1100, 'window2', 340, 220, 40, ANGLAISE); open(u, 1750, 1100, 'window2', 280, 220, 40, ANGLAISE); open(u, 2250, 1100, 'window2', 280, 220, 40, ANGLAISE); open(u, 2850, 1100, 'bay', 460, 235, 0, BAIE_ANGLAISE);
  open(u, 1075, 0, 'window2', 240, 220, 40, ANGLAISE); open(u, 1700, 0, 'window2', 150, 130, 100, ANGLAISE); open(u, 2000, 0, 'window1', 60, 80, 140, { name: 'Petite fenêtre' }); open(u, 2300, 0, 'window2', 150, 130, 100, ANGLAISE); open(u, 2675, 0, 'window2', 150, 150, 90, ANGLAISE); open(u, 3025, 0, 'window2', 200, 150, 90, ANGLAISE); open(u, 3200, 760, 'window2', 300, 215, 40, ANGLAISE); open(u, 750, 930, 'window2', 180, 200, 60, ANGLAISE);
  open(u, 1500, 520, 'passage', 170, 235, 0, { name: 'Passage' }); open(u, 1125, 760, 'door', 93, 215, 0); open(u, 1750, 620, 'door', 93, 215, 0); open(u, 2250, 620, 'door', 93, 215, 0); open(u, 1700, 420, 'door', 83, 215, 0); open(u, 2000, 420, 'door', 73, 215, 0); open(u, 2300, 420, 'door', 83, 215, 0); open(u, 2500, 520, 'double', 170, 230, 0, { name: 'Double porte de la suite' }); open(u, 2675, 420, 'passage', 120, 225, 0, { name: 'Passage' }); open(u, 3025, 420, 'pocket', 110, 225, 0, { name: 'Porte à galandage' });
  setRoom(u, 1125, 300, 'couloir', 'Palier', { floor: 'dark_planks', paint: warm, moulding: 'panels' });
  setRoom(u, 2000, 520, 'couloir', 'Couloir', { floor: 'dark_planks', paint: warm, moulding: 'crown' });
  setRoom(u, 1125, 930, 'chambre', 'Chambre 4', { floor: oak, paint: 'paint_mizzle', moulding: 'panels' });
  setRoom(u, 1750, 860, 'chambre', 'Chambre 3', { floor: oak, paint: 'paint_skimming', moulding: 'panels' });
  setRoom(u, 2250, 860, 'enfant', 'Chambre 2 (bébé)', { floor: oak, paint: 'paint_all_white', moulding: 'panels' });
  setRoom(u, 1700, 210, 'douche', "Salle d'eau", { floor: 'tile_marble', paint: lin });
  setRoom(u, 2000, 210, 'wc', 'WC', { floor: stone, paint: lin });
  setRoom(u, 2300, 210, 'dressing', 'Lingerie', { floor: oak, paint: lin });
  setRoom(u, 2850, 760, 'parentale', 'Suite parentale', { floor: 'dark_planks', paint: 'wall_noyer', moulding: 'panels' });
  setRoom(u, 2675, 210, 'dressing', 'Dressing', { floor: 'dark_planks', paint: 'wall_noyer', moulding: 'crown' });
  setRoom(u, 3025, 210, 'sdb', 'Salle de bain parentale', { floor: stone, paint: 'wall_pierre_blonde' });

  // ——— Mobilier ———
  const sofa = pick('canape', ['bouclé.*(pablian|shirina|eracli)', 'bouclé', 'lin', 'chenille'], (i) => i.w >= 200 && i.w <= 290 && i.d <= 110);
  const arm = pick('fauteuil', ['bouclé', 'noyer', 'velours']), rug = pick('tapis', ['jute', 'sisal', 'laine'], (i) => Math.max(i.w, i.d) >= 220);
  const low = pick('table-basse', ['noyer', 'bois foncé'], (i) => i.w >= 100), buffet = pick('buffet', ['noyer', 'bois foncé'], (i) => i.w >= 150) || pick('buffet', ['chêne']);
  const lamp = pick('lampe', ['céramique', 'lin']), floorLamp = pick('lampadaire', ['lin', 'bois']), pendant = pick('suspension', ['laiton', 'dor', 'raphia']), plant = pick('plante', ['ficus', 'plante']);
  const curtain = pick('rideau', ['']), ring = named('Lustre couronne noir'), chevet = pick('chevet', ['noyer', 'bois foncé', 'manguier']), bench = pick('rangement', ['banc']), unit = G_('g-meuble-meuble-bas-60-cm');
  const bed = pick('lit', ['velours', 'bouclé', 'tissu'], (i) => i.w >= 175 && i.w <= 215) || pick('lit', [], (i) => i.w >= 155), wc = G_('g-wc-wc-suspendu-avec-b-ti-support'), tub = G_('g-baignoire-baignoire-180-80'), shower = G_('g-douche-douche-l-italienne-140-90');
  const vanity = pick('meuble-vasque', ['double', 'chêne'], (i) => i.w >= 100) || pick('meuble-vasque', []), mirror = pick('miroir', ['bois', 'dor']), robe = pick('armoire', ['noyer', 'bois foncé', 'chêne'], (i) => i.w >= 90 && i.w <= 200);
  const cream = '#e8dfcf', bronze = '#4a3426', top = (d) => d?.h ?? 75, chair = pick('chaise', ['cannage', 'rotin', 'chêne']), stool = pick('tabouret', ['bois', 'cannage', 'tissu']);

  // Salon, autour de la cheminée.
  place(g, named('Cheminée monumentale pierre et noyer'), 42, 750, 270, { w: 400, h: 680, d: 80 });
  place(g, rug, 370, 750, 90, { w: 420, d: 520 }); place(g, sofa, 610, 750, 90); place(g, sofa, 370, 470, 0); place(g, sofa, 370, 1030, 180);
  place(g, low, 370, 750, 90); place(g, ring, 370, 750, 0, { z: 400, w: 240, d: 240, h: 300 });
  place(g, plant, 80, 1140, 0); place(g, floorLamp, 690, 360, 0); place(g, plant, 690, 1140, 0);
  drapes(g, curtain, 375, 1200, 's', 560, 420, cream); drapes(g, curtain, 200, 300, 'n', 180, 510, cream); drapes(g, curtain, 550, 300, 'n', 180, 510, cream);
  // Entrée fermée, penderie, banc ; puis le hall et le grand escalier.
  place(g, bench, 1075, 30, 0); place(g, mirror, 1075, 8, 0); place(g, robe, 785, 125, 270); place(g, wc, 1325, 215, 180);
  place(g, named('Grand escalier américain en U'), 1075, 515, 180);
  place(g, buffet, 800, 950, 270); place(g, lamp, 800, 950, 0, { z: top(buffet) }); place(g, ring, 1075, 950, 0, { z: 180, w: 150, d: 150, h: 118 }); place(g, plant, 1350, 1050, 0); place(g, rug, 1075, 930, 0, { w: 300, d: 240 });
  // Salle à manger.
  const table = pick('table', ['chêne.*(220|230|240)', 'noyer.*200', 'noyer', 'chêne'], (i) => i.w >= 200);
  place(g, rug, 1700, 800, 0, { w: 380, d: 300 }); place(g, table, 1700, 800, 0, { w: 280, d: 105 });
  for (const x of [1580, 1660, 1740, 1820]) { place(g, chair, x, 725, 0); place(g, chair, x, 875, 180); }
  place(g, pendant, 1620, 800, 0); place(g, pendant, 1780, 800, 0); place(g, buffet, 1700, 543, 0); place(g, lamp, 1620, 543, 0, { z: top(buffet) });
  drapes(g, curtain, 1700, 1100, 's', 380, 265, cream);
  // Cuisine en U, grand îlot, passe-plat sur la terrasse.
  for (const x of [2060, 2120, 2180, 2240]) place(g, unit, x, 540, 0);
  for (let i = 0; i < 7; i++) place(g, unit, 2555, 600 + i * 60, 90);
  for (let i = 0; i < 6; i++) place(g, unit, 2110 + i * 60, 1060, 180);
  place(g, G_('g-electro-plaque-induction-60-cm'), 2150, 540, 0, { z: 88 }); place(g, G_('g-electro-hotte-murale-60-cm'), 2150, 525, 0); place(g, G_('g-electro-r-frig-rateur-combin-60-cm'), 2555, 1030, 90); place(g, G_('g-electro-lave-vaisselle-60-cm'), 2240, 540, 0);
  place(g, G_('g-ilot--lot-central-180-90'), 2290, 760, 0, { w: 340, d: 125 });
  for (const x of [2160, 2225, 2290, 2355, 2420]) place(g, stool, x, 850, 180);
  for (const x of [2190, 2290, 2390]) place(g, pendant, x, 760, 0);
  // Pièce modulable, salle d'eau, sport, service, garage.
  place(g, rug, 1700, 200, 0, { w: 340, d: 240 }); place(g, pick('bureau', ['noyer', 'bois']), 1700, -60, 0, { w: 180 }); place(g, pick('siege', ['cuir', 'tissu']), 1700, 10, 180); place(g, sofa, 1700, 440, 180); place(g, pick('bibliotheque', ['noyer', 'bois']), 1450, 180, 270);
  place(g, shower, 2150, 60, 0); place(g, vanity, 2255, 240, 90); place(g, wc, 2050, 440, 270);
  place(g, G_('g-sport-rangement-halt-res'), 2900, 545, 0, { w: 300 }); place(g, G_('g-sport-banc-de-musculation-r-glable'), 2800, 880, 0); place(g, G_('g-sport-banc-de-musculation-r-glable'), 3050, 880, 0); place(g, G_('g-sport-tapis-de-course'), 3120, 620, 90); place(g, plant, 2650, 1200, 0);
  place(g, G_('g-electro-lave-linge-60-cm'), 3130, 60, 90); place(g, G_('g-electro-s-che-linge-60-cm'), 3130, 130, 90); place(g, unit, 3130, 200, 90); place(g, unit, 3130, 330, 90);
  place(g, named('Voiture de sport rouge'), 2830, -400, 0);

  // Étage.
  place(u, named('Garde-corps bois classique'), 885, 515, 90, { w: 460 }); place(u, named('Garde-corps bois classique'), 1265, 515, 90, { w: 460 }); place(u, named('Garde-corps bois classique'), 1075, 748, 0, { w: 380 }); place(u, named('Garde-corps bois classique'), 1170, 282, 0, { w: 190 });
  place(u, buffet, 815, 200, 270); place(u, lamp, 815, 200, 0, { z: top(buffet) }); place(u, plant, 1440, 60, 0);
  // Suite parentale.
  place(u, rug, 2880, 760, 0, { w: 420, d: 320 }); place(u, bed, 3085, 760, 90); place(u, chevet, 3150, 625, 90); place(u, chevet, 3150, 895, 90); place(u, lamp, 3150, 625, 0, { z: top(chevet) }); place(u, lamp, 3150, 895, 0, { z: top(chevet) });
  place(u, bench, 2870, 760, 90); place(u, pendant, 2880, 760, 0); place(u, arm, 2570, 1010, 135); place(u, arm, 2570, 860, 60); drapes(u, curtain, 2850, 1100, 's', 460, 270, bronze);
  for (const x of [2560, 2680, 2790]) place(u, robe, x, 45, 0); place(u, bench, 2675, 300, 0);
  place(u, tub, 3025, 60, 0); place(u, vanity, 3160, 240, 90, { w: 200 }); place(u, shower, 2930, 340, 0); place(u, mirror, 3180, 240, 90);
  // Chambres.
  const kid = pick('lit-enfant', ['']) || bed;
  [[1125, 930, 1240, 'n'], [1750, 860, 1640, 's'], [2250, 860, 2140, 's']].forEach(([cx, cy, x], i) => {
    const b = i === 2 ? kid : bed;
    place(u, rug, x + 120, cy, 90, { w: 240, d: 340 }); place(u, b, x - 20 + (i === 0 ? 220 : 0), cy, i === 0 ? 90 : 270); void cx;
  });
  for (const [x, y] of [[1460, 1060], [1540, 660], [2040, 660]]) place(u, chevet, x, y, 0);
  drapes(u, curtain, 1125, 1100, 's', 340, 250, cream); drapes(u, curtain, 1750, 1100, 's', 280, 250, cream); drapes(u, curtain, 2250, 1100, 's', 280, 250, cream);
  place(u, shower, 1800, 80, 0); place(u, vanity, 1540, 210, 270); place(u, wc, 2000, 45, 0);
  for (const x of [2190, 2410]) place(u, robe, x, 45, 0);

  // ——— Dehors ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), slab = G_('g-terrasse-terrasse-pierre'), tree = G_('g-plantation-arbre'), hedge = allItems().find((i) => i.name === 'Haie (3 m)'), ball = named('Buis taillé en boule'), post = named('Poteau en pierre');
  const lounge = pick('chaise-ext', ['canapé', 'fauteuil', 'lounge']), sun = pick('chaise-ext', ['transat', 'bain de soleil', 'longue']), outChair = pick('chaise-ext', ['chaise', 'fauteuil']);
  // Porche à colonnes.
  out(slab, 1075, -360, 0, { w: 460, d: 320 }); for (const x of [880, 1270]) { out(post, x, -505, 0, { h: 300 }); out(post, x, -225, 0, { h: 300 }); }
  for (const x of [790, 1360]) out(ball, x, -260, 0);
  // Terrasse couverte, côté cuisine.
  out(slab, 2000, 1425, 0, { w: 1200, d: 650 }); for (let i = 0; i <= 3; i++) out(post, 1420 + i * 390, 1730, 0); out(post, 2580, 1400, 0);
  out(named('Cheminée d’extérieur en pierre'), 2560, 1425, 90, { w: 240, h: 320, d: 70 }); out(named('Cuisine d’été en pierre 4 m'), 1600, 1150, 0, { w: 320 });
  for (const x of [2160, 2260, 2360]) out(stool, x, 1160, 180);
  out(rug, 2230, 1490, 0, { w: 380, d: 300, color: '#c9bda8' }); out(lounge, 2390, 1490, 90); out(lounge, 2230, 1370, 0); out(lounge, 2230, 1620, 180); out(lounge, 2070, 1490, 270); out(low, 2230, 1490, 0);
  out(pick('table-ext', ['chêne', 'bois', '']), 1620, 1490, 0, { w: 240, d: 95 }); for (const x of [1530, 1620, 1710]) { out(outChair, x, 1420, 0); out(outChair, x, 1560, 180); }
  // Piscine et jardin.
  out(slab, 1400, 2350, 0, { w: 3800, d: 1250 }); out(slab, 620, 1430, 0, { w: 1560, d: 460 });
  out(named('Piscine 8 × 4'), 1400, 2500, 0, { w: 1250, d: 500, z: 10 });
  for (const x of [720, 950, 1850, 2080]) out(sun, x, 2080, 0); for (const x of [835, 1965]) out(named('Parasol en toile'), x, 2030, 0);
  out(slab, -900, 2000, 0, { w: 560, d: 560 }); out(named('Foyer rond d’extérieur'), -900, 2000, 0); for (const [x, y, r] of [[-900, 1820, 0], [-900, 2180, 180], [-1080, 2000, 270], [-720, 2000, 90]]) out(lounge, x, y, r);
  for (let i = 0; i < 15; i++) out(hedge, -1400 + i * 300, 3200, 0);
  // Devant : allée d'arbres, cour, buis.
  for (const y of [-2500, -3200, -3900, -4600, -5300]) { out(tree, 500, y, 0); out(tree, 1650, y, 0); }
  for (const x of [120, 400, 680, 1440, 1980, 2300]) out(ball, x, x < 750 ? 240 : -220, 0);
  for (let i = 0; i < 7; i++) { out(hedge, -1100 + i * 300, -2100, 0); out(hedge, 1500 + i * 300, -2100, 0); }
  out(post, 780, -2100, 0, { w: 70, d: 70, h: 260 }); out(post, 1370, -2100, 0, { w: 70, d: 70, h: 260 });
  for (const [x, y] of [[-1900, -800], [-2100, 900], [-2000, 2600], [4300, -900], [4500, 900], [4300, 2600], [2400, 3700], [-200, 3700], [-2200, -3400], [3800, -3700]]) out(tree, x, y, 0);

  p.levels.push(u);
  p.entry = 0;
  syncRooms(g); syncRooms(u);

  const R = (lv, x0, y0, x1, y1, type, ridge, pitch, extra = {}) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type, pitch, overhang: 35, ridge, wallH: 0, ...extra });
  p.roofs = [
    R(u, 750, 0, 3200, 1100, 'gable', 'x', 45), R(u, 800, 0, 1350, 1100, 'gable', 'y', 45), R(u, 2500, 0, 3200, 1100, 'gable', 'y', 45),
    R(g, 0, 300, 750, 1200, 'gable', 'x', 42, { wallH: 680, vault: true }),
    R(g, 860, -520, 1290, 0, 'gable', 'y', 45), R(g, 1400, -150, 2000, 0, 'gable', 'y', 45),
    R(g, 2600, 1100, 3200, 1250, 'gable', 'y', 42), R(g, 2600, -700, 3500, 0, 'gable', 'y', 42, { wallH: 270 }),
    R(g, 1400, 1100, 2600, 1750, 'gable', 'x', 24, { vault: true, lining: 'wall_bois' }),
  ];

  shapeTerrain(p, 'flat', {});
  const m = ensureTerrain(p), half = (T_N - 1) / 2, cx = 1400, cy = -600;
  p.site.terrain.cx = cx; p.site.terrain.cy = cy; m.cx = cx; m.cy = cy;
  const gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + cx, y = (j - half) * 100 + cy;
    if ((x >= 825 && x <= 1325 && y <= -2100) || (x >= 100 && x <= 3700 && y >= -2100 && y <= -560 && !(x > 2600 && y > -760))) m.p[j * T_N + i] = gravel;
  }
  commitTerrain(p);
  p.site.altitude = 0;
  p.site.parcel = { pts: [{ x: -2600, y: -6200 }, { x: 5000, y: -6200 }, { x: 5000, y: 3900 }, { x: -2600, y: 3900 }] };
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
