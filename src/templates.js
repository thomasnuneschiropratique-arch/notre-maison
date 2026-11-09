// Maisons de départ, modifiables.
import { newProject, newLevel, addNode, addWall, uid, syncRooms, store } from './state.js';
import { allItems, getItem } from './catalog.js';
import { ensureTerrain, commitTerrain, shapeTerrain, T_N } from './terrain.js';

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
const PORTE_ANGLAISE = { name: 'Porte-fenêtre anglaise', muntins: [2, 5] };
const BAIE_ANGLAISE = { name: 'Grande baie anglaise', muntins: [2, 4] };

function shell(lv) {
  rect(lv, 0, 0, 1800, 1100, 30);
  splitAt(lv, 0, 300);
  wallLine(lv, 0, 300, -500, 300, 30); wallLine(lv, -500, 300, -500, 1100, 30); wallLine(lv, -500, 1100, 0, 1100, 30);
}

/** Choisit dans le catalogue, en préférant les modèles qui collent au style des photos. */
function pick(sub, words, test = () => true) {
  const list = allItems().filter((i) => i.sub === sub && test(i));
  for (const w of words) { const hit = list.find((i) => new RegExp(w, 'i').test(`${i.name}`) && i.brand !== 'IKEA'); if (hit) return hit; }
  return list[0];
}

function furnishManor(top, low) {
  const G_ = (id) => getItem(id);
  const couch = pick('canape', ['bouclé.*(cardea|shirina|pablian)', 'bouclé', 'lin', 'chenille'], (i) => i.w >= 230 && i.w <= 320 && i.d <= 110);
  const lamp = pick('lampe', ['céramique', 'lin']), chevet = pick('chevet', ['noyer', 'bois foncé', 'manguier', 'bois']);
  const walnutTable = pick('table-basse', ['noyer', 'bois foncé', 'chêne'], (i) => i.w >= 100), big = (i) => i.w >= 200;
  const rugL = pick('tapis', ['jute', 'sisal', 'laine', 'beige'], (i) => Math.max(i.w, i.d) >= 220) || pick('tapis', ['beige']);
  const bed180 = pick('lit', ['velours.*180', 'bouclé.*180', 'tissu.*180', 'chenille.*180', 'tissu', 'velours'], (i) => i.w >= 175 && i.w <= 215), bed160 = pick('lit', ['tissu', 'velours', 'bois'], (i) => i.w >= 155 && i.w <= 195);
  const pendant = pick('suspension', ['laiton', 'dor', 'raphia', 'lin']), floorLamp = pick('lampadaire', ['lin', 'bois', 'arc']);
  const plant = pick('plante', ['monstera', 'ficus', 'plante']);
  const wc = G_('g-wc-wc-suspendu-avec-b-ti-support'), shower = G_('g-douche-douche-l-italienne-140-90'), tub = G_('g-baignoire-baignoire-180-80'), vanity = pick('meuble-vasque', ['double', 'chêne', 'bois'], (i) => i.w >= 100) || pick('meuble-vasque', []);

  // Grand séjour : canapé face à la vue, autour d'un grand tapis.
  place(top, couch, 400, 650, 0); place(top, rugL, 400, 790, 90, { w: 300, d: 400 });
  place(top, walnutTable, 400, 800, 0);
  const arm = pick('fauteuil', ['noyer', 'bois foncé', 'bouclé', 'velours']);
  place(top, arm, 170, 800, 270); place(top, arm, 630, 800, 90);
  const console_ = pick('buffet', ['noyer', 'bois foncé', 'chêne', 'rotin'], (i) => i.w >= 160);
  place(top, console_, 400, 435, 0); place(top, lamp, 310, 435, 0, { z: console_?.h ?? 75 }); place(top, lamp, 490, 435, 0, { z: console_?.h ?? 75 });
  place(top, floorLamp, 80, 480, 0); place(top, plant, 745, 1050, 0); place(top, pendant, 400, 790, 0);

  // Salle à manger.
  const table = pick('table', ['chêne.*(220|230|240)', 'noyer.*200', 'chêne', 'noyer'], big), chair = pick('chaise', ['cannage', 'rotin', 'bouclé', 'chêne']);
  place(top, table, 1025, 750, 90);
  for (const y of [640, 713, 787, 860]) { place(top, chair, 945, y, 270); place(top, chair, 1105, y, 90); }
  place(top, console_, 1025, 435, 0); place(top, pendant, 1025, 750, 0);

  // Cuisine, côté mur en noyer.
  for (let i = 0; i < 8; i++) place(top, G_('g-meuble-meuble-bas-60-cm'), 1310 + i * 60, 445, 0);
  place(top, G_('g-electro-r-frig-rateur-combin-60-cm'), 1770, 445, 0); place(top, G_('g-electro-lave-vaisselle-60-cm'), 1370, 445, 0);
  place(top, G_('g-electro-plaque-induction-60-cm'), 1525, 445, 0, { z: 88 }); place(top, G_('g-electro-hotte-murale-60-cm'), 1525, 435, 0);
  place(top, G_('g-ilot--lot-central-180-90'), 1525, 770, 0);
  const stool = pick('tabouret', ['cannage', 'bois', 'tissu']);
  for (const x of [1450, 1525, 1600]) { place(top, stool, x, 850, 180); place(top, pendant, x, 770, 0); }

  // Bureau, entrée, chambre 5, salle de sport.
  const desk = pick('bureau', ['noyer', 'bois', 'chêne']);
  place(top, desk, 200, 150, 0); place(top, pick('siege', ['cuir', 'tissu']) || arm, 200, 215, 180);
  place(top, pick('bibliotheque', ['noyer', 'bois']), 355, 110, 90); place(top, rugL, 200, 280, 0, { w: 200, d: 160 });
  place(top, wc, 475, 35, 0); place(top, pick('rangement', ['banc', 'vestiaire', 'chaussures']), 475, 370, 180);
  place(top, pick('rangement', ['banc', 'bois']), 595, 210, 270); place(top, pick('miroir', ['bois', 'dor']), 940, 90, 90); place(top, plant, 905, 50, 0);
  place(top, bed160, 1690, 200, 90); place(top, chevet, 1755, 80, 90); place(top, chevet, 1755, 320, 90);
  place(top, G_('g-sport-banc-de-musculation-r-glable'), -250, 720, 90); place(top, G_('g-sport-rangement-halt-res'), -250, 345, 0); place(top, G_('g-sport-tapis-de-course'), -430, 620, 0);

  // Suite parentale, dressing, salle de bain.
  place(low, bed180, 340, 625, 0); place(low, chevet, 215, 535, 0); place(low, chevet, 465, 535, 0);
  place(low, lamp, 215, 535, 0, { z: chevet?.h ?? 50 }); place(low, lamp, 465, 535, 0, { z: chevet?.h ?? 50 });
  place(low, rugL, 340, 760, 90, { w: 280, d: 380 }); place(low, pick('rangement', ['banc']), 340, 790, 0); place(low, pendant, 340, 700, 0); place(low, arm, 110, 1000, 315);
  const robe = pick('armoire', ['noyer', 'bois foncé', 'chêne', 'bois'], (i) => i.w >= 90 && i.w <= 200);
  for (const x of [640, 750, 860]) place(low, robe, x, 530, 0);
  place(low, pick('rangement', ['banc']), 750, 700, 0);
  place(low, tub, 750, 1045, 0); place(low, vanity, 930, 950, 90); place(low, shower, 625, 860, 0); place(low, wc, 585, 1030, 270);

  // Chambres sur le même niveau que la suite, salle de bain enfants, salle de jeux.
  const small = pick('lit-enfant', ['évolutif', 'lit']) || bed160;
  place(low, small, 1150, 620, 0); place(low, bed160, 1422, 660, 0); place(low, bed160, 1700, 660, 0);
  place(low, tub, 600, 50, 0); place(low, vanity, 440, 190, 270); place(low, wc, 770, 120, 90); place(low, wc, 875, 35, 0);
  place(low, G_('g-electro-lave-linge-60-cm'), 1400, 45, 0); place(low, G_('g-electro-s-che-linge-60-cm'), 1465, 45, 0); place(low, G_('g-meuble-meuble-bas-60-cm'), 1530, 45, 0); place(low, G_('g-meuble-meuble-bas-60-cm'), 1590, 45, 0);
  place(low, rugL, -250, 720, 0, { w: 300, d: 420 }); place(low, pick('rangement-enfant', ['']), -460, 760, 270); place(low, pick('coussin', ['']), -250, 720, 0);
  place(low, plant, -440, 360, 0);

  // Jardin : terrasse en pierre et piscine devant le niveau bas.
  place(low, G_('g-terrasse-terrasse-pierre'), 900, 1400, 0, { w: 2000, d: 500 });
  place(low, G_('g-piscine-piscine-8-4'), 900, 1960, 0, { w: 1200, d: 500 });
  const lounge = pick('chaise-ext', ['transat', 'bain de soleil', 'chaise longue']);
  for (const x of [400, 620, 1180, 1400]) place(low, lounge, x, 1620, 180);
  for (const [x, y] of [[-1000, 2300], [2800, 1800], [-1500, 900], [3000, 400], [300, 2900], [1700, 3100], [-800, -900], [2600, -800]]) place(low, G_('g-plantation-arbre'), x, y, 0);
}

/** Maison anglaise inspirée des photos : pierre blonde, ardoise, petits bois noirs, 5 chambres. */
function houseManor() {
  const p = newProject('Maison anglaise');
  p.style = { facade: 'facade_pierre_blonde', roof: 'roof_ardoise', joinery: '#1f2022' };
  p.roof = { type: 'none', pitch: 42, overhang: 30, ridge: 'auto' };
  p.site.env = 'campagne';

  // ——— Niveau d'entrée : réception, cuisine, bureau, salle de sport, chambre d'amis ———
  const top = p.levels[0];
  top.name = 'Rez-de-chaussée'; top.height = 300;
  shell(top);
  partition(top, 0, 400, 1800, 400);
  partition(top, 400, 0, 400, 400); partition(top, 550, 0, 550, 400); partition(top, 400, 200, 550, 200);
  partition(top, 950, 0, 950, 400); partition(top, 1300, 0, 1300, 400);
  partition(top, 800, 400, 800, 1100); partition(top, 1250, 400, 1250, 1100);
  open(top, 750, 0, 'entry', 190, 250, 0, { name: "Porte d'entrée double", leaves: 2, glazed: true });
  open(top, 200, 0, 'window2', 160, 210, 60, ANGLAISE); open(top, 1125, 0, 'window2', 120, 210, 60, ANGLAISE); open(top, 1550, 0, 'window2', 160, 210, 60, ANGLAISE);
  open(top, 475, 0, 'window1', 60, 90, 130, { name: 'Petite fenêtre' });
  open(top, 400, 1100, 'bay', 480, 270, 0, BAIE_ANGLAISE); open(top, 1025, 1100, 'bay', 320, 270, 0, BAIE_ANGLAISE); open(top, 1525, 1100, 'bay', 320, 270, 0, BAIE_ANGLAISE);
  open(top, 1800, 750, 'window2', 240, 220, 70, ANGLAISE); open(top, 1800, 200, 'window2', 160, 210, 60, ANGLAISE);
  open(top, -250, 1100, 'window2', 300, 265, 15, PORTE_ANGLAISE); open(top, -500, 500, 'window2', 240, 240, 40, ANGLAISE); open(top, -500, 880, 'window2', 240, 240, 40, ANGLAISE);
  open(top, 675, 400, 'passage', 200, 260, 0, { name: 'Passage' }); open(top, 950, 200, 'passage', 180, 250, 0, { name: 'Passage' });
  open(top, 1100, 400, 'passage', 220, 260, 0, { name: 'Passage' }); open(top, 800, 750, 'passage', 420, 265, 0, { name: 'Grand passage' }); open(top, 1250, 750, 'passage', 420, 265, 0, { name: 'Grand passage' });
  open(top, 250, 400, 'door', 93, 215, 0); open(top, 550, 100, 'door', 73, 204, 0); open(top, 550, 300, 'passage', 110, 215, 0, { name: 'Passage' });
  open(top, 1300, 200, 'door', 93, 215, 0); open(top, 0, 750, 'double', 180, 230, 0, { name: 'Double porte' });
  setRoom(top, 200, 200, 'bureau', 'Bureau', { floor: 'herringbone', paint: 'paint_green_smoke' });
  setRoom(top, 475, 100, 'wc', 'WC', { floor: 'dalle_pierre' });
  setRoom(top, 475, 300, 'entree', 'Vestiaire', { floor: 'dalle_pierre' });
  setRoom(top, 750, 200, 'entree', 'Entrée', { floor: 'dalle_pierre', paint: 'paint_wimborne' });
  setRoom(top, 1125, 200, 'couloir', 'Hall', { floor: 'dalle_pierre', paint: 'paint_wimborne' });
  setRoom(top, 1550, 200, 'chambre', 'Chambre 5', { floor: 'oak_natural', paint: 'paint_skimming' });
  setRoom(top, 400, 750, 'salon', 'Grand séjour', { floor: 'oak_light', paint: 'paint_wimborne' });
  setRoom(top, 1025, 750, 'repas', 'Salle à manger', { floor: 'oak_light', paint: 'paint_wimborne' });
  setRoom(top, 1525, 750, 'cuisine', 'Cuisine', { floor: 'dark_planks', paint: 'paint_lin' });
  setRoom(top, -250, 700, 'piece', 'Salle de sport', { floor: 'oak_natural', paint: 'paint_all_white' });
  clad(top, 400, 750, 'wall_pierre_blonde', 'n');
  clad(top, 1525, 750, 'wall_noyer', 'n');
  clad(top, 200, 200, 'wall_noyer', 'o');

  // ——— Niveau jardin : suite, trois chambres, salle de jeux véranda ———
  const low = newLevel('Rez-de-jardin', 270);
  shell(low);
  partition(low, 0, 350, 1800, 350); partition(low, 0, 500, 1800, 500);
  partition(low, 550, 500, 550, 1100); partition(low, 950, 500, 950, 1100); partition(low, 550, 800, 950, 800);
  partition(low, 1235, 500, 1235, 1100); partition(low, 1520, 500, 1520, 1100);
  partition(low, 400, 0, 400, 350); partition(low, 800, 0, 800, 350); partition(low, 950, 0, 950, 350); partition(low, 1300, 0, 1300, 350);
  open(low, 275, 1100, 'bay', 420, 245, 0, BAIE_ANGLAISE); open(low, 750, 1100, 'window2', 200, 215, 35, ANGLAISE);
  open(low, 1092, 1100, 'window2', 200, 230, 15, PORTE_ANGLAISE); open(low, 1377, 1100, 'window2', 200, 230, 15, PORTE_ANGLAISE); open(low, 1660, 1100, 'window2', 200, 230, 15, PORTE_ANGLAISE);
  open(low, -250, 1100, 'window2', 300, 245, 0, PORTE_ANGLAISE); open(low, -500, 480, 'window2', 210, 235, 15, ANGLAISE); open(low, -500, 730, 'window2', 170, 245, 0, PORTE_ANGLAISE); open(low, -500, 975, 'window2', 210, 235, 15, ANGLAISE);
  open(low, 1125, 350, 'passage', 220, 230, 0, { name: 'Passage' });
  open(low, 200, 350, 'door', 83, 204, 0); open(low, 600, 350, 'door', 83, 204, 0); open(low, 875, 350, 'door', 73, 204, 0); open(low, 1500, 350, 'door', 83, 204, 0);
  open(low, 90, 500, 'door', 93, 215, 0); open(low, 992, 500, 'door', 73, 204, 0); open(low, 1277, 500, 'door', 73, 204, 0); open(low, 1562, 500, 'door', 73, 204, 0);
  open(low, 550, 650, 'passage', 120, 215, 0, { name: 'Passage' }); open(low, 750, 800, 'pocket', 90, 210, 0, { name: 'Porte à galandage' });
  open(low, 0, 425, 'double', 130, 215, 0, { name: 'Double porte' });
  setRoom(low, 200, 175, 'cellier', 'Cave et technique');
  setRoom(low, 600, 175, 'sdb', 'Salle de bain enfants', { floor: 'tile_marble', paint: 'paint_lin' });
  setRoom(low, 875, 175, 'wc', 'WC', { floor: 'dalle_pierre' });
  setRoom(low, 1125, 175, 'couloir', 'Hall', { floor: 'dalle_pierre', paint: 'paint_wimborne' });
  setRoom(low, 1550, 175, 'buanderie', 'Buanderie', { floor: 'dark_planks', paint: 'paint_lin' });
  setRoom(low, 900, 425, 'couloir', 'Couloir des chambres', { floor: 'oak_natural', paint: 'paint_wimborne' });
  setRoom(low, 275, 800, 'parentale', 'Suite parentale', { floor: 'oak_natural', paint: 'paint_lin' });
  setRoom(low, 750, 650, 'dressing', 'Dressing', { floor: 'dark_planks', paint: 'paint_lin' });
  setRoom(low, 750, 950, 'sdb', 'Salle de bain parentale', { floor: 'dalle_pierre', paint: 'paint_lin' });
  setRoom(low, 1092, 800, 'enfant', 'Chambre 2 (bébé)', { floor: 'oak_light', paint: 'paint_wimborne' });
  setRoom(low, 1377, 800, 'chambre', 'Chambre 3', { floor: 'oak_light', paint: 'paint_wimborne' });
  setRoom(low, 1660, 800, 'chambre', 'Chambre 4', { floor: 'oak_light', paint: 'paint_wimborne' });
  setRoom(low, -250, 700, 'piece', 'Salle de jeux véranda', { floor: 'oak_light', paint: 'paint_all_white' });
  clad(low, 275, 800, 'wall_noyer', 'n');
  clad(low, 750, 650, 'wall_noyer', 'nse');
  clad(low, 750, 950, 'wall_pierre_blonde', 'neo');
  clad(low, 1550, 175, 'wall_bois', 'nse');
  place(low, getItem('g-escalier-escalier-sans-contremarche'), 1125, 175, 90);

  p.levels.unshift(low);
  p.entry = 1;
  furnishManor(top, low);
  syncRooms(top); syncRooms(low);
  // Toit d'ardoise à grands pignons, comme sur les photos : corps principal, pignon sud, aile.
  const R = (x0, y0, x1, y1, type, ridge, pitch = 42) => ({ id: uid('z'), level: top.id, x0, y0, x1, y1, type, pitch, overhang: 30, ridge, wallH: 0 });
  p.roofs = [R(0, 0, 1800, 1100, 'gable', 'x'), R(1250, 0, 1800, 1100, 'gable', 'y'), R(-500, 300, 0, 1100, 'hip', 'y', 32)];

  // Terrain : on entre de plain-pied au nord, le niveau jardin s'ouvre au sud et à l'ouest.
  shapeTerrain(p, 'gentle', { dir: 180, pct: 10 });
  const m = ensureTerrain(p), half = (T_N - 1) / 2, cx = 900, cy = 550;
  p.site.terrain.cx = cx; p.site.terrain.cy = cy; m.cx = cx; m.cy = cy;
  const low0 = -2.87;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = i - half + cx / 100, y = j - half + cy / 100;
    let v = Math.max(low0, -Math.max(0, y) * 0.265);
    if (y > 11.5) v = low0 - Math.max(0, y - 34) * 0.06;
    const west = smooth01((-x - 5.2) / 1.2) * smooth01((y - 0.5) / 2.2);
    v += (low0 - v) * west;
    m.h[j * T_N + i] = Math.round(v * 100);
  }
  commitTerrain(p);
  p.site.altitude = 0;
  return p;
}

export const TEMPLATES = [
  { id: 'manoir', name: 'Maison anglaise, 5 chambres', desc: 'Pierre blonde, ardoise, fenêtres à petits bois, salle de sport et véranda', make: houseManor },
  { id: 'hill', name: 'Maison sur la colline', desc: 'Salon et cuisine en haut, chambres en dessous avec vue sur la vallée', make: houseHillside },
  { id: 'single', name: 'Plain-pied meublé', desc: '126 m², 3 chambres, déjà aménagé', make: houseSinglestorey },
  { id: 'two', name: 'Maison à étage', desc: '2 niveaux, 88 m² au sol, avec escalier', make: houseTwoStorey },
  { id: 'empty', name: 'Page blanche', desc: 'Partir de zéro ou d’un plan importé', make: () => newProject('Notre maison') },
];
void store;
