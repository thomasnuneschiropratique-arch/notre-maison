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

/** Grande maison anglaise inspirée des photos. Le nord est le côté de l'arrivée, le sud celui du jardin. */
function houseManor() {
  const p = newProject('Maison anglaise');
  p.style = { facade: 'facade_pierre_blonde', roof: 'roof_ardoise', joinery: '#1c1d1f' };
  p.roof = { type: 'none', pitch: 45, overhang: 35, ridge: 'auto' };
  p.site.env = 'campagne';
  const G_ = (id) => getItem(id);

  // ——— Rez-de-chaussée : réception, cuisine, salle de sport, garages ———
  const g = p.levels[0];
  g.name = 'Rez-de-chaussée'; g.height = 320; g.slab = 30;
  rect(g, 0, 0, 3800, 1200, 35);
  splitAt(g, 0, 200); splitAt(g, 800, 1200); splitAt(g, 3000, 0);
  // Aile du grand salon, au bout de la maison.
  wallLine(g, 0, 200, -1000, 200, 40); wallLine(g, -1000, 200, -1000, 1400, 40); wallLine(g, -1000, 1400, 0, 1400, 40); wallLine(g, 0, 1400, 0, 1200, 40);
  // Véranda, salle de jeux.
  wallLine(g, 800, 1200, 800, 1700, 30); wallLine(g, 800, 1700, 0, 1700, 30); wallLine(g, 0, 1700, 0, 1400, 30);
  // Garage trois voitures, en retour sur la cour.
  wallLine(g, 3000, 0, 3000, -800, 35); wallLine(g, 3000, -800, 4000, -800, 35); wallLine(g, 4000, -800, 4000, 0, 35); wallLine(g, 4000, 0, 3800, 0, 35);

  for (const x of [800, 1300, 2000, 3000]) partition(g, x, 0, x, 1200, 15);
  partition(g, 0, 480, 800, 480); partition(g, 0, 700, 800, 700);
  partition(g, 1300, 500, 2000, 500); partition(g, 1550, 0, 1550, 500); partition(g, 1300, 250, 1550, 250);
  partition(g, 2000, 300, 3000, 300); partition(g, 2600, 0, 2600, 300);
  partition(g, 3000, 400, 3800, 400); partition(g, 3400, 0, 3400, 400);

  // Façade d'arrivée.
  open(g, 1050, 0, 'entry', 240, 290, 0, { name: "Porte d'entrée double", leaves: 2, glazed: true });
  open(g, 400, 0, 'window2', 300, 240, 50, ANGLAISE); open(g, 1425, 0, 'window2', 120, 200, 70, ANGLAISE); open(g, 1775, 0, 'window2', 90, 150, 110, ANGLAISE); open(g, 2300, 0, 'window2', 240, 200, 90, ANGLAISE);
  for (const x of [3180, 3500, 3820]) open(g, x, -800, 'garage', 270, 245, 0, { name: 'Porte de garage' });
  open(g, 4000, -400, 'window2', 180, 150, 110, ANGLAISE);
  // Mur de la cheminée : hautes fenêtres de part et d'autre.
  open(g, -1000, 365, 'window2', 190, 640, 40, HAUTE_ANGLAISE); open(g, -1000, 1235, 'window2', 190, 640, 40, HAUTE_ANGLAISE);
  open(g, -500, 1400, 'bay', 780, 500, 0, BAIE_ANGLAISE);
  open(g, -750, 200, 'window2', 240, 520, 50, HAUTE_ANGLAISE); open(g, -250, 200, 'window2', 240, 520, 50, HAUTE_ANGLAISE);
  // Côté jardin.
  open(g, 1050, 1200, 'window2', 300, 290, 0, PORTE_ANGLAISE); open(g, 1650, 1200, 'bay', 480, 280, 0, BAIE_ANGLAISE);
  open(g, 2170, 1200, 'window2', 180, 270, 0, PORTE_ANGLAISE); open(g, 2620, 1200, 'bay', 560, 115, 105, { name: 'Passe-plat ouvert sur la terrasse', muntins: [1, 1] });
  open(g, 3400, 1200, 'bay', 560, 275, 0, BAIE_ANGLAISE); open(g, 3800, 800, 'window2', 340, 250, 30, ANGLAISE);
  // Véranda.
  open(g, 400, 1700, 'window2', 300, 280, 0, PORTE_ANGLAISE); open(g, 120, 1700, 'window2', 180, 260, 30, ANGLAISE); open(g, 680, 1700, 'window2', 180, 260, 30, ANGLAISE);
  open(g, 0, 1550, 'window2', 220, 260, 30, ANGLAISE); open(g, 800, 1320, 'window2', 180, 260, 30, ANGLAISE); open(g, 800, 1570, 'window2', 180, 260, 30, ANGLAISE);
  // Circulations : le salon est au calme, au bout d'une galerie.
  open(g, 800, 590, 'passage', 180, 280, 0, { name: 'Passage' }); open(g, 0, 590, 'double', 220, 290, 0, { name: 'Double porte du salon' });
  open(g, 800, 240, 'double', 180, 240, 0, { name: 'Double porte' }); open(g, 400, 700, 'double', 200, 240, 0, { name: 'Double porte' }); open(g, 400, 1200, 'passage', 520, 280, 0, { name: 'Passage véranda' });
  open(g, 1300, 850, 'double', 240, 280, 0, { name: 'Double porte' }); open(g, 2000, 850, 'double', 200, 260, 0, { name: 'Double porte' });
  open(g, 1300, 125, 'door', 93, 215, 0); open(g, 1300, 375, 'door', 83, 215, 0); open(g, 1775, 500, 'door', 83, 215, 0);
  open(g, 2300, 300, 'passage', 180, 240, 0, { name: 'Passage' }); open(g, 2600, 150, 'door', 83, 215, 0); open(g, 3000, 150, 'door', 83, 215, 0); open(g, 3400, 200, 'door', 93, 215, 0); open(g, 3600, 0, 'door', 93, 215, 0); open(g, 3600, 400, 'double', 180, 230, 0, { name: 'Double porte' });

  const oak = 'oak_light', stone = 'dalle_pierre', warm = 'paint_wimborne', lin = 'paint_lin';
  setRoom(g, -500, 800, 'salon', 'Grand salon', { floor: 'dark_planks', paint: warm });
  setRoom(g, 400, 240, 'bureau', 'Bureau', { floor: 'herringbone', paint: 'wall_noyer', moulding: 'panels' });
  setRoom(g, 400, 590, 'couloir', 'Galerie', { floor: oak, paint: warm, moulding: 'panels' });
  setRoom(g, 400, 950, 'piece', 'Bibliothèque', { floor: oak, paint: 'paint_all_white', moulding: 'panels' });
  setRoom(g, 400, 1450, 'enfant', 'Salle de jeux véranda', { floor: oak, paint: 'paint_all_white' });
  setRoom(g, 1050, 600, 'entree', 'Grand hall', { floor: stone, paint: warm, moulding: 'panels' });
  setRoom(g, 1425, 125, 'entree', 'Vestiaire', { floor: stone, paint: 'wall_noyer' });
  setRoom(g, 1425, 375, 'wc', 'WC invités', { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(g, 1775, 250, 'cellier', 'Cave à vin', { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(g, 1650, 850, 'repas', 'Salle à manger', { floor: 'herringbone', paint: 'paint_setting', moulding: 'panels' });
  setRoom(g, 2500, 750, 'cuisine', 'Cuisine', { floor: oak, paint: lin, moulding: 'crown' });
  setRoom(g, 2300, 150, 'cellier', 'Arrière-cuisine', { floor: oak, paint: 'wall_noyer' });
  setRoom(g, 2800, 150, 'cellier', 'Cellier', { floor: stone, paint: lin });
  setRoom(g, 3200, 200, 'buanderie', 'Buanderie', { floor: stone, paint: 'wall_bois' });
  setRoom(g, 3600, 200, 'entree', 'Entrée de service', { floor: stone, paint: lin });
  setRoom(g, 3400, 800, 'piece', 'Salle de sport', { floor: oak, paint: 'wall_bois' });
  setRoom(g, 3500, -400, 'garage', 'Garage', { floor: 'concrete_floor', paint: 'paint_skimming' });
  clad(g, -500, 800, 'wall_pierre_blonde', 'o');
  clad(g, 2500, 750, 'wall_noyer', 'neo');

  // ——— Étage : la suite et toutes les chambres sur le même niveau ———
  const u = newLevel('Étage', 290);
  rect(u, 0, 0, 3000, 1200, 30);
  partition(u, 750, 0, 750, 1200); partition(u, 0, 500, 750, 500);
  partition(u, 750, 400, 3000, 400); partition(u, 750, 650, 3000, 650);
  for (const x of [1150, 1800, 2400]) partition(u, x, 650, x, 1200);
  for (const x of [1300, 1900, 2400]) partition(u, x, 0, x, 400);
  open(u, 375, 1200, 'bay', 480, 240, 0, BAIE_ANGLAISE); open(u, 950, 1200, 'window2', 180, 200, 60, ANGLAISE);
  for (const x of [1475, 2100, 2700]) open(u, x, 1200, 'window2', 300, 220, 40, ANGLAISE);
  open(u, 375, 0, 'window2', 320, 180, 80, ANGLAISE); open(u, 1025, 0, 'window2', 260, 220, 40, ANGLAISE); open(u, 1600, 0, 'window2', 260, 200, 60, ANGLAISE); open(u, 2150, 0, 'window2', 130, 130, 110, ANGLAISE); open(u, 2700, 0, 'window2', 180, 150, 90, ANGLAISE); open(u, 3000, 925, 'window2', 220, 200, 60, ANGLAISE);
  open(u, 1025, 400, 'passage', 360, 250, 0, { name: 'Passage' }); open(u, 750, 525, 'double', 180, 235, 0, { name: 'Double porte de la suite' }); open(u, 750, 925, 'passage', 160, 235, 0, { name: 'Passage' }); open(u, 375, 500, 'pocket', 120, 225, 0, { name: 'Porte à galandage' });
  open(u, 1475, 650, 'door', 93, 215, 0); open(u, 2100, 650, 'door', 93, 215, 0); open(u, 2700, 650, 'door', 93, 215, 0); open(u, 1600, 400, 'door', 93, 215, 0); open(u, 2150, 400, 'door', 83, 215, 0); open(u, 2700, 400, 'door', 83, 215, 0);
  setRoom(u, 375, 850, 'parentale', 'Suite parentale', { floor: 'dark_planks', paint: 'wall_noyer', moulding: 'panels' });
  setRoom(u, 375, 250, 'sdb', 'Salle de bain parentale', { floor: stone, paint: 'wall_pierre_blonde' });
  setRoom(u, 950, 925, 'dressing', 'Dressing', { floor: 'dark_planks', paint: 'wall_noyer', moulding: 'crown' });
  setRoom(u, 1475, 925, 'enfant', 'Chambre 2 (bébé)', { floor: oak, paint: 'paint_all_white', moulding: 'panels' });
  setRoom(u, 2100, 925, 'chambre', 'Chambre 3', { floor: oak, paint: 'paint_skimming', moulding: 'panels' });
  setRoom(u, 2700, 925, 'chambre', 'Chambre 4', { floor: oak, paint: 'paint_setting', moulding: 'panels' });
  setRoom(u, 1600, 200, 'chambre', 'Chambre 5', { floor: oak, paint: 'paint_mizzle', moulding: 'panels' });
  setRoom(u, 2150, 200, 'sdb', 'Salle de bain enfants', { floor: 'tile_marble', paint: lin });
  setRoom(u, 2700, 200, 'sdb', 'Salle de bain invités', { floor: 'tile_marble', paint: lin });
  setRoom(u, 1025, 200, 'couloir', 'Palier', { floor: 'dark_planks', paint: warm, moulding: 'panels' });
  setRoom(u, 1900, 525, 'couloir', 'Galerie des chambres', { floor: 'dark_planks', paint: warm, moulding: 'panels' });

  // ——— Mobilier ———
  const sofa = pick('canape', ['bouclé.*(pablian|shirina|eracli)', 'bouclé', 'lin', 'chenille'], (i) => i.w >= 230 && i.w <= 320 && i.d <= 110);
  const arm = pick('fauteuil', ['bouclé', 'noyer', 'velours']), rug = pick('tapis', ['jute', 'sisal', 'laine'], (i) => Math.max(i.w, i.d) >= 220);
  const low = pick('table-basse', ['noyer', 'bois foncé'], (i) => i.w >= 110), buffet = pick('buffet', ['noyer', 'bois foncé'], (i) => i.w >= 150) || pick('buffet', ['chêne']);
  const lamp = pick('lampe', ['céramique', 'lin']), floorLamp = pick('lampadaire', ['lin', 'bois']), pendant = pick('suspension', ['laiton', 'dor', 'raphia']), plant = pick('plante', ['ficus', 'plante']);
  const curtain = pick('rideau', ['']), ring = named('Lustre couronne noir'), chevet = pick('chevet', ['noyer', 'bois foncé', 'manguier']), bench = pick('rangement', ['banc']);
  const bed = pick('lit', ['velours', 'bouclé', 'tissu'], (i) => i.w >= 175 && i.w <= 215) || pick('lit', [], (i) => i.w >= 155), wc = G_('g-wc-wc-suspendu-avec-b-ti-support'), tub = G_('g-baignoire-baignoire-180-80'), shower = G_('g-douche-douche-l-italienne-140-90');
  const vanity = pick('meuble-vasque', ['double', 'chêne'], (i) => i.w >= 100) || pick('meuble-vasque', []), mirror = pick('miroir', ['bois', 'dor']), picture = pick('cadre', ['']);
  const bronze = '#4a3426', cream = '#e8dfcf';

  // Grand salon, tourné vers la cheminée.
  place(g, named('Cheminée monumentale pierre et noyer'), -950, 800, 270, { w: 460, h: 760, d: 90 });
  place(g, rug, -560, 800, 90, { w: 520, d: 620 });
  place(g, sofa, -230, 800, 90); place(g, sofa, -560, 470, 0); place(g, sofa, -560, 1130, 180);
  place(g, low, -560, 800, 90); place(g, ring, -560, 800, 0, { z: 430, w: 300, d: 300, h: 330 });
  place(g, buffet, -65, 800, 90); place(g, lamp, -65, 690, 0, { z: buffet?.h ?? 75 }); place(g, lamp, -65, 910, 0, { z: buffet?.h ?? 75 });
  place(g, plant, -920, 260, 0); place(g, plant, -60, 1340, 0); place(g, floorLamp, -60, 260, 0); place(g, arm, -820, 1130, 225);
  drapes(g, curtain, -500, 1400, 's', 780, 500, cream); drapes(g, curtain, -750, 200, 'n', 240, 580, cream); drapes(g, curtain, -250, 200, 'n', 240, 580, cream);

  // Salle à manger et cuisine américaine, séparées du reste par de vraies portes.
  const table = pick('table', ['chêne.*(220|230|240)', 'noyer.*200', 'noyer', 'chêne'], (i) => i.w >= 200), chair = pick('chaise', ['cannage', 'rotin', 'chêne']);
  place(g, rug, 1650, 850, 0, { w: 460, d: 340 }); place(g, table, 1650, 850, 0, { w: 320, d: 110 });
  for (const x of [1510, 1603, 1697, 1790]) { place(g, chair, x, 770, 0); place(g, chair, x, 930, 180); }
  place(g, ring, 1650, 850, 0, { z: 200, w: 200, d: 200, h: 118 }); place(g, buffet, 1530, 545, 0); place(g, lamp, 1450, 545, 0, { z: buffet?.h ?? 75 }); place(g, lamp, 1610, 545, 0, { z: buffet?.h ?? 75 });
  drapes(g, curtain, 1650, 1200, 's', 480, 270, cream);
  const unit = G_('g-meuble-meuble-bas-60-cm');
  for (let i = 0; i < 15; i++) place(g, unit, 2060 + i * 60, 345, 0);
  for (let i = 0; i < 8; i++) place(g, unit, 2955, 440 + i * 60, 90);
  for (let i = 0; i < 4; i++) place(g, unit, 2045, 440 + i * 60, 270);
  place(g, G_('g-electro-plaque-induction-60-cm'), 2500, 345, 0, { z: 88 }); place(g, G_('g-electro-hotte-murale-60-cm'), 2500, 330, 0);
  place(g, G_('g-electro-r-frig-rateur-combin-60-cm'), 2955, 930, 90); place(g, G_('g-electro-lave-vaisselle-60-cm'), 2240, 345, 0);
  place(g, G_('g-ilot--lot-central-180-90'), 2500, 700, 0, { w: 520, d: 150 });
  const stool = pick('tabouret', ['bois', 'cannage', 'tissu']);
  for (const x of [2300, 2380, 2460, 2540, 2620, 2700]) place(g, stool, x, 800, 180);
  for (const x of [2340, 2500, 2660]) place(g, pendant, x, 700, 0);

  // Bureau, galerie, hall, salle de jeux, sport.
  place(g, rug, 400, 260, 0, { w: 400, d: 260 }); place(g, pick('bureau', ['noyer', 'bois']), 400, 170, 0, { w: 220, d: 95 }); place(g, pick('siege', ['cuir', 'tissu']), 400, 245, 180);
  for (const x of [120, 260]) place(g, pick('bibliotheque', ['noyer', 'bois']), x, 450, 180); place(g, arm, 680, 400, 225); place(g, floorLamp, 730, 310, 0);
  place(g, bench, 400, 505, 0); place(g, picture, 400, 490, 0); place(g, plant, 760, 650, 0);
  place(g, buffet, 860, 900, 270); place(g, lamp, 860, 900, 0, { z: buffet?.h ?? 75 }); place(g, mirror, 815, 900, 270); place(g, ring, 1050, 650, 0, { z: 180, w: 180, d: 180, h: 138 }); place(g, plant, 860, 60, 0); place(g, bench, 1240, 1110, 90);
  place(g, G_('g-escalier-escalier-sans-contremarche'), 1050, 310, 0);
  place(g, rug, 400, 950, 0, { w: 480, d: 340 }); place(g, pick('rangement-enfant', ['']), 60, 950, 270); place(g, pick('rangement-enfant', ['']), 740, 950, 90);
  place(g, arm, 150, 1500, 90); place(g, arm, 150, 1320, 90); place(g, low, 300, 1410, 0); place(g, plant, 740, 1640, 0); place(g, plant, 60, 1640, 0);
  place(g, G_('g-sport-rangement-halt-res'), 3400, 445, 0, { w: 320 }); place(g, G_('g-sport-banc-de-musculation-r-glable'), 3250, 760, 0); place(g, G_('g-sport-banc-de-musculation-r-glable'), 3550, 760, 0); place(g, G_('g-sport-tapis-de-course'), 3700, 980, 90); place(g, plant, 3060, 1140, 0);
  place(g, wc, 1425, 290, 0); place(g, G_('g-electro-lave-linge-60-cm'), 3080, 345, 180); place(g, G_('g-electro-s-che-linge-60-cm'), 3150, 345, 180); place(g, unit, 3220, 345, 180); place(g, unit, 3290, 345, 180);
  place(g, named('Voiture de sport rouge'), 3180, -470, 0);

  // Étage : suite parentale, dressing, salle de bain.
  place(u, rug, 290, 850, 90, { w: 400, d: 520 }); place(u, bed, 130, 850, 270); place(u, chevet, 55, 720, 270); place(u, chevet, 55, 980, 270);
  place(u, lamp, 55, 720, 0, { z: chevet?.h ?? 50 }); place(u, lamp, 55, 980, 0, { z: chevet?.h ?? 50 }); place(u, bench, 310, 850, 90); place(u, pendant, 290, 850, 0);
  place(u, arm, 560, 1090, 200); place(u, arm, 660, 1000, 250); drapes(u, curtain, 375, 1200, 's', 480, 275, bronze);
  const robe = pick('armoire', ['noyer', 'bois foncé', 'chêne'], (i) => i.w >= 90 && i.w <= 200);
  for (const y of [720, 860, 1000, 1130]) { place(u, robe, 1115, y, 90); } place(u, bench, 900, 925, 90);
  place(u, tub, 375, 90, 0); place(u, vanity, 55, 280, 270, { w: 240 }); place(u, shower, 640, 130, 0); place(u, wc, 700, 400, 90); place(u, mirror, 25, 280, 270);

  // Quatre autres chambres, avec tête de lit contre le mur et grandes fenêtres habillées.
  const kid = pick('lit-enfant', ['']) || bed;
  [[1475, 1680, kid], [2100, 2280, bed], [2700, 2880, bed]].forEach(([win, x, b]) => {
    place(u, rug, x - 170, 925, 90, { w: 280, d: 380 }); place(u, b, x, 925, 90); place(u, chevet, x + 55, 795, 90); place(u, chevet, x + 55, 1055, 90);
    place(u, lamp, x + 55, 795, 0, { z: chevet?.h ?? 50 }); place(u, arm, x - 420, 1110, 135); drapes(u, curtain, win, 1200, 's', 300, 255, cream);
  });
  place(u, rug, 1600, 220, 0, { w: 280, d: 240 }); place(u, bed, 1780, 200, 90); place(u, chevet, 1855, 70, 90); drapes(u, curtain, 1600, 0, 'n', 260, 250, cream);
  place(u, tub, 2150, 60, 0); place(u, vanity, 1950, 250, 270); place(u, wc, 2350, 300, 90); place(u, shower, 2700, 70, 0); place(u, vanity, 2450, 250, 270); place(u, wc, 2950, 300, 90);
  place(u, buffet, 1360, 428, 0); place(u, lamp, 1360, 428, 0, { z: buffet?.h ?? 75 }); place(u, plant, 2950, 600, 0);

  // ——— Dehors, comme un second salon ———
  const out = (d, x, y, rot, extra) => place(g, d, x, y, rot, extra), slab = G_('g-terrasse-terrasse-pierre'), tree = G_('g-plantation-arbre'), hedge = allItems().find((i) => i.name === 'Haie (3 m)'), ball = named('Buis taillé en boule'), post = named('Poteau en pierre');
  const lounge = pick('chaise-ext', ['canapé', 'fauteuil', 'lounge']), sun = pick('chaise-ext', ['transat', 'bain de soleil', 'longue']);
  out(slab, 2150, 1550, 0, { w: 1700, d: 700 }); // Terrasse couverte
  out(slab, 1300, 2500, 0, { w: 4400, d: 1500 }); out(slab, -500, 1680, 0, { w: 1000, d: 500 });
  for (let i = 0; i <= 4; i++) out(post, 1320 + i * 415, 1880, 0);
  for (const y of [1320, 1600]) { out(post, 1320, y, 0); out(post, 2980, y, 0); }
  out(named('Cuisine d’été en pierre 4 m'), 1720, 1250, 0); out(named('Cheminée d’extérieur en pierre'), 2960, 1540, 90, { w: 260, h: 340, d: 75 });
  for (const x of [2510, 2620, 2730]) out(stool, x, 1270, 180);
  out(pick('table-ext', ['chêne', 'bois', '']), 1700, 1640, 0, { w: 280, d: 100 }); for (const x of [1600, 1700, 1800]) { out(pick('chaise-ext', ['chaise', 'fauteuil']), x, 1560, 0); out(pick('chaise-ext', ['chaise', 'fauteuil']), x, 1720, 180); }
  out(rug, 2500, 1560, 0, { w: 460, d: 340, color: '#c9bda8' }); out(lounge, 2680, 1560, 90); out(lounge, 2500, 1420, 0); out(lounge, 2500, 1700, 180); out(lounge, 2320, 1560, 270); out(low, 2500, 1560, 0);
  // Piscine, bains de soleil, foyer.
  out(named('Piscine 8 × 4'), 1300, 2650, 0, { w: 1500, d: 600, z: 10 });
  for (const x of [780, 1040, 1560, 1820]) out(sun, x, 2240, 0);
  for (const x of [910, 1690]) out(named('Parasol en toile'), x, 2190, 0);
  out(slab, -1000, 2300, 0, { w: 620, d: 620 }); out(named('Foyer rond d’extérieur'), -1000, 2300, 0);
  for (const [x, y, r] of [[-1000, 2100, 0], [-1000, 2500, 180], [-1200, 2300, 270], [-800, 2300, 90]]) out(lounge, x, y, r);
  for (let i = 0; i < 16; i++) out(hedge, -1800 + i * 300, 3500, 0);
  // Le devant : grille, grande allée d'arbres, cour d'honneur et buis le long de la façade.
  for (const y of [-2300, -3000, -3700, -4400, -5100]) { out(tree, 480, y, 0); out(tree, 1620, y, 0); }
  for (const x of [-100, 250, 620, 1480, 1820, 2200, 2600]) out(ball, x, -60, 0);
  for (let i = 0; i < 9; i++) { out(hedge, -1100 + i * 300, -1900, 0); out(hedge, 1500 + i * 300, -1900, 0); }
  out(post, 780, -1900, 0, { w: 70, d: 70, h: 260 }); out(post, 1320, -1900, 0, { w: 70, d: 70, h: 260 });
  for (const [x, y] of [[-2100, -900], [-2300, 800], [-2200, 2700], [4900, -1000], [5000, 900], [4800, 2800], [2600, 3900], [-400, 3900], [-2400, -3200], [4000, -3600]]) out(tree, x, y, 0);

  p.levels.push(u);
  p.entry = 0;
  syncRooms(g); syncRooms(u);

  // Toitures : pignons d'ardoise, salon cathédrale, terrasse couverte.
  const R = (lv, x0, y0, x1, y1, type, ridge, pitch, extra = {}) => ({ id: uid('z'), level: lv.id, x0, y0, x1, y1, type, pitch, overhang: 35, ridge, wallH: 0, ...extra });
  p.roofs = [
    R(u, 0, 0, 3000, 1200, 'gable', 'x', 45), R(u, 800, 0, 1300, 1200, 'gable', 'y', 45), R(u, 2400, 0, 3000, 1200, 'gable', 'y', 45),
    R(g, -1000, 200, 0, 1400, 'gable', 'x', 40, { wallH: 760, vault: true }),
    R(g, 3000, 0, 3800, 1200, 'gable', 'x', 42), R(g, 3000, -800, 4000, 0, 'gable', 'y', 42, { wallH: 290 }),
    R(g, 0, 1200, 800, 1700, 'hip', 'auto', 38), R(g, 1300, 1200, 3000, 1900, 'gable', 'x', 24, { vault: true, lining: 'wall_bois' }),
  ];

  // Terrain plat, allée de gravier jusqu'à la cour d'honneur, parcelle en retrait de la rue.
  shapeTerrain(p, 'flat', {});
  const m = ensureTerrain(p), half = (T_N - 1) / 2, cx = 1400, cy = -400;
  p.site.terrain.cx = cx; p.site.terrain.cy = cy; m.cx = cx; m.cy = cy;
  const gravel = GROUND_GRAVEL + 1;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + cx, y = (j - half) * 100 + cy;
    const drive = x >= 800 && x <= 1300 && y <= -1800, court = x >= -300 && x <= 4300 && y >= -1800 && y <= -30 && !(x > 3000 && y > -800);
    if (drive || court) m.p[j * T_N + i] = gravel;
  }
  commitTerrain(p);
  p.site.altitude = 0;
  p.site.parcel = { pts: [{ x: -2800, y: -5800 }, { x: 5600, y: -5800 }, { x: 5600, y: 4200 }, { x: -2800, y: 4200 }] };
  return p;
}

export const TEMPLATES = [
  { id: 'manoir', name: 'Maison anglaise, 5 chambres', desc: 'Très grande maison : salon cathédrale, cuisine américaine, terrasse couverte, piscine, allée et garages', make: houseManor },
  { id: 'hill', name: 'Maison sur la colline', desc: 'Salon et cuisine en haut, chambres en dessous avec vue sur la vallée', make: houseHillside },
  { id: 'single', name: 'Plain-pied meublé', desc: '126 m², 3 chambres, déjà aménagé', make: houseSinglestorey },
  { id: 'two', name: 'Maison à étage', desc: '2 niveaux, 88 m² au sol, avec escalier', make: houseTwoStorey },
  { id: 'empty', name: 'Page blanche', desc: 'Partir de zéro ou d’un plan importé', make: () => newProject('Notre maison') },
];
void store;
