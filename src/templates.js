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

export const TEMPLATES = [
  { id: 'hill', name: 'Maison sur la colline', desc: 'Salon et cuisine en haut, chambres en dessous avec vue sur la vallée', make: houseHillside },
  { id: 'single', name: 'Plain-pied meublé', desc: '126 m², 3 chambres, déjà aménagé', make: houseSinglestorey },
  { id: 'two', name: 'Maison à étage', desc: '2 niveaux, 88 m² au sol, avec escalier', make: houseTwoStorey },
  { id: 'empty', name: 'Page blanche', desc: 'Partir de zéro ou d’un plan importé', make: () => newProject('Notre maison') },
];
void store;
