// Budget tout compris : terrain, taxes, études, construction lot par lot, finitions, meubles, extérieurs, imprévus.
// Les quantités viennent du plan. Prix TTC, relevés en novembre 2026 ; `est` = aucune source fiable trouvée, estimation à confirmer.
import { getItem, itemPrice } from './catalog.js';
import { materialInfo } from './materials-data.js';
import { pointInPolygon, dist } from './geometry.js';
import { terrainOf, heightAt, levelBase } from './terrain.js';
import { isDoorType } from './catalog.js';

export const BUDGET_DEFAULTS = {
  gamme: 'standard', mode: 'constructeur', terrain: 0, terrainArea: 600, vendeur: 'particulier',
  commune: 5, dept: 2.5, assainissement: 'collectif', imprevus: 10, over: {}, off: {},
  loan: { apport: 0, taux: 0, duree: 25, assurance: 0.3 },
};
export const budgetSettings = (p) => ({ ...BUDGET_DEFAULTS, ...(p.budget || {}), over: p.budget?.over || {}, off: p.budget?.off || {}, loan: { ...BUDGET_DEFAULTS.loan, ...(p.budget?.loan || {}) } });

export const GAMMES = [['eco', 'Économique'], ['standard', 'Standard'], ['haut', 'Haut de gamme']];
export const MODES = [['constructeur', 'Constructeur (contrat CCMI)'], ['architecte', 'Architecte'], ['moe', "Maître d'œuvre"], ['artisans', 'Artisans en direct']];
const TIER = { eco: 0, standard: 1, haut: 2 };
/** Taxe d'aménagement 2026, hors Île-de-France. */
const TA_VALEUR = 892, TA_PISCINE = 251, TAP = 0.004;
export const MARKET = { low: 1500, high: 2500 };

const POSE = (id) => {
  if (/herringbone|rect_parquet|diag_parquet/.test(id)) return 70;
  if (/oak|dark_planks/.test(id)) return 50;
  if (/laminate/.test(id)) return 55;
  if (/mosaic/.test(id)) return 70;
  if (id === 'concrete_floor') return 85;
  if (id === 'carpet') return 18;
  if (id === 'deck_wood') return 35;
  if (id === 'pavers') return 40;
  return 48;
};

const roomOf = (a, lv, it) => a.rooms.findIndex((r) => pointInPolygon({ x: it.x, y: it.y }, r.poly));

/** Mesure la maison sur le plan. */
export function measure(project, analyze) {
  const relief = terrainOf(project);
  const m = { buried: 0, deblai: 0, hab: 0, taxable: 0, emprise: 0, etage: 0, facade: 0, cloisons: 0, plafonds: 0, perimetre: 0, roof: 0, openings: [], floors: new Map(), paint: 0, plafondPaint: 0, wallFinishes: new Map(), facades: new Map(), rooms: new Map(), sdbTiled: 0 };
  project.levels.forEach((lv, li) => {
    const a = analyze(lv), h = lv.height / 100;
    a.rooms.forEach((r, i) => {
      const info = lv.rooms[i]; if (!info) return;
      const open = info.type === 'terrasse';
      if (!['garage', 'terrasse'].includes(info.type)) m.hab += r.area;
      if (!open) { m.taxable += r.area; m.plafonds += r.area; m.plafondPaint += r.area; }
      m.rooms.set(info.type, (m.rooms.get(info.type) || 0) + 1);
      m.floors.set(info.floor, (m.floors.get(info.floor) || 0) + r.area);
      if (li === 0) m.emprise += r.grossArea; else m.etage += r.grossArea;
      if (['sdb', 'douche'].includes(info.type) && !/^wall_/.test(info.paint)) m.sdbTiled += 1;
    });
    for (const w of a.walls) {
      const A = lv.nodes[w.a], B = lv.nodes[w.b], len = dist(A, B) / 100;
      const hole = w.openings.reduce((t, o) => t + (o.width * o.height) / 1e4, 0);
      const net = Math.max(0, len * h - hole);
      const left = a.sideRoom.get(`${w.id}:L`), right = a.sideRoom.get(`${w.id}:R`);
      const exterior = (left === undefined) !== (right === undefined);
      if (exterior) {
        m.facade += net; m.perimetre += len;
        if (relief) { const g = heightAt(relief, (A.x + B.x) / 2, (A.y + B.y) / 2) - levelBase(project, li); m.buried += len * Math.max(0, Math.min(h, g)); }
      } else m.cloisons += net;
      for (const [idx, side] of [[left, 'L'], [right, 'R']]) {
        const mat = w[`mat${side}`];
        if (idx === undefined) {
          if (exterior) { const f = mat || project.style.facade; m.facades.set(f, (m.facades.get(f) || 0) + net); }
          continue;
        }
        const finish = mat || lv.rooms[idx]?.paint;
        if (/^(wall_|facade_)/.test(finish || '')) m.wallFinishes.set(finish, (m.wallFinishes.get(finish) || 0) + net);
        else m.paint += net;
      }
      for (const o of w.openings) m.openings.push({ ...o, exterior });
    }
  });
  if (relief) {
    const lv0 = project.levels[0], a0 = analyze(lv0), base0 = levelBase(project, 0);
    for (const r of a0.rooms) m.deblai += r.grossArea * Math.max(0, heightAt(relief, r.center.x, r.center.y) - base0 + 0.4);
  }
  const top = project.levels.at(-1), xs = Object.values(top.nodes).map((n) => n.x), ys = Object.values(top.nodes).map((n) => n.y);
  if (xs.length && project.roof.type !== 'none') {
    const ov = project.roof.type === 'flat' ? 0 : project.roof.overhang;
    const W = (Math.max(...xs) - Math.min(...xs) + 2 * ov) / 100, D = (Math.max(...ys) - Math.min(...ys) + 2 * ov) / 100;
    const rad = (project.roof.pitch * Math.PI) / 180;
    m.roof = project.roof.type === 'flat' ? W * D : (W * D) / Math.cos(rad);
    if (project.roof.type === 'gable') { const s = Math.min(W, D) - (2 * ov) / 100; const tri = (s * s * Math.tan(rad)) / 4; m.facade += 2 * tri; m.facades.set(project.style.facade, (m.facades.get(project.style.facade) || 0) + 2 * tri); }
  }
  for (const z of project.roofs || []) {
    const ov = z.type === 'flat' ? 0 : z.overhang, W = (z.x1 - z.x0 + 2 * ov) / 100, D = (z.y1 - z.y0 + 2 * ov) / 100;
    m.roof += z.type === 'flat' ? W * D : (W * D) / Math.cos((z.pitch * Math.PI) / 180);
  }
  return m;
}

function furniture(project, analyze) {
  const lines = [];
  const placed = { types: {}, subs: {} };
  project.levels.forEach((lv) => {
    const a = analyze(lv);
    for (const it of lv.items) {
      const def = getItem(it.cat); if (!def) continue;
      const i = roomOf(a, lv, it);
      lines.push({ it, def, room: lv.rooms[i]?.name || 'Extérieur', level: lv.name, price: itemPrice(it, def) });
      const t = def.model?.type || def.sub; placed.types[t] = (placed.types[t] || 0) + 1; placed.subs[def.sub] = (placed.subs[def.sub] || 0) + 1;
    }
  });
  return { lines, placed };
}

function compute(project, s, analyze) {
  const m = measure(project, analyze);
  const { lines: items, placed } = furniture(project, analyze);
  const T = TIER[s.gamme] ?? 1;
  const pick = (v) => (Array.isArray(v) ? v[T] : v);
  const groups = [];
  const G = (id, title) => { const g = { id, title, lines: [], items: [], total: 0 }; groups.push(g); return g; };
  const add = (g, key, label, qty, unit, price, opt = {}) => {
    if (!(qty > 0)) return;
    const raw = Math.round(qty * pick(price));
    const o = s.over[key];
    const off = !!s.off[key];
    const amount = o != null ? Number(o) : raw;
    g.lines.push({ key, label, qty, unit, price: pick(price), raw, amount: off ? 0 : amount, off, over: o != null, est: !!opt.est, plan: !!opt.plan, note: opt.note });
  };
  const sumItems = (f) => items.filter(f).reduce((t, l) => t + l.price, 0);
  const finalize = (g) => { g.total = g.lines.reduce((t, l) => t + l.amount, 0) + g.items.reduce((t, l) => t + l.price, 0); return g.total; };

  // ——— Terrain ———
  const terrain = G('terrain', 'Terrain');
  add(terrain, 'terrain', 'Prix du terrain', 1, 'forfait', s.terrain, { note: 'À renseigner ci-dessus.' });
  const pctNot = s.vendeur === 'particulier' ? 0.075 : 0.025;
  add(terrain, 'notaire', `Frais de notaire (${s.vendeur === 'particulier' ? 'vendeur particulier' : 'lotisseur'})`, s.terrain, '€', pctNot, { note: 'Environ 7 à 8 % chez un particulier, 2 à 3 % si le vendeur est assujetti à la TVA.' });
  add(terrain, 'bornage', 'Bornage par un géomètre', 1, 'forfait', [900, 1200, 1500], { est: true });
  add(terrain, 'sol', 'Étude de sol G1 + G2', 1, 'forfait', [1200, 1800, 3000], { note: 'Plus cher sur terrain argileux ou en pente.' });

  // ——— Gros œuvre ———
  const go = G('grosoeuvre', 'Gros œuvre et toiture');
  add(go, 'fondations', 'Terrassement et fondations', m.emprise, 'm²', [110, 150, 220], { plan: true });
  add(go, 'deblai', 'Terrassement en pente et évacuation des terres', m.deblai, 'm³', [28, 42, 65], { plan: true, est: true });
  add(go, 'enterre', 'Murs enterrés : étanchéité et drainage', m.buried, 'm²', [90, 130, 200], { plan: true, est: true });
  add(go, 'dalle', 'Dalle isolée du rez-de-chaussée', m.emprise, 'm²', [70, 90, 130], { plan: true, est: true });
  add(go, 'murs', 'Murs extérieurs porteurs', m.facade, 'm²', [130, 170, 260], { plan: true });
  add(go, 'etage', "Plancher d'étage", m.etage, 'm²', [110, 140, 200], { plan: true, est: true });
  add(go, 'toit', project.roof.type === 'flat' ? 'Toit-terrasse étanché' : 'Charpente, couverture, gouttières', m.roof, 'm²', [120, 150, 230], { plan: true });
  for (const [id, area] of m.facades) { const f = materialInfo(id); if (f?.price) add(go, `facade:${id}`, `Façade : ${f.name}`, area, 'm²', f.price, { plan: true, est: true }); }
  const stairs = items.filter((l) => l.def.cat === 'structure'); go.items.push(...stairs);

  // ——— Menuiseries ———
  const men = G('menuiseries', 'Fenêtres, portes, volets');
  const K = [0.75, 1, 1.4][T];
  const count = (f) => m.openings.filter(f);
  const isPF = (o) => o.type === 'window2' && o.height >= 200;
  const n1 = count((o) => o.type === 'window1' && o.exterior), n2 = count((o) => o.type === 'window2' && !isPF(o) && o.exterior), pf = count((o) => isPF(o) && o.exterior), fixe = count((o) => o.type === 'fixed' && o.exterior), baies = count((o) => o.type === 'bay' && o.exterior), entree = count((o) => o.type === 'entry');
  add(men, 'fen1', 'Fenêtres 1 vantail, posées', n1.length, 'u', 650 * K, { plan: true });
  add(men, 'fen2', 'Fenêtres 2 vantaux, posées', n2.length, 'u', 1150 * K, { plan: true });
  add(men, 'pf', 'Portes-fenêtres, posées', pf.length, 'u', 2100 * K, { plan: true });
  add(men, 'fixe', 'Fenêtres fixes, posées', fixe.length, 'u', 500 * K, { plan: true });
  add(men, 'baie', 'Baies vitrées coulissantes, posées', baies.reduce((t, o) => t + o.width / 280, 0), 'baie de 2,80 m', 2600 * K, { plan: true });
  const vitre = (o) => ['glasswall', 'atelier'].includes(o.type);
  add(men, 'vitre', 'Murs vitrés et verrières, posés', count(vitre).reduce((t, o) => t + (o.width * o.height) / 1e4, 0), 'm²', [550, 750, 1200], { plan: true, est: true });
  add(men, 'garage', 'Portes de garage motorisées, posées', count((o) => o.type === 'garage').reduce((t, o) => t + o.width / 240, 0), 'porte de 2,40 m', [1100, 1800, 3500], { plan: true, est: true });
  add(men, 'pdouble', 'Portes doubles, posées', count((o) => o.type === 'double').length, 'u', [500, 750, 1300], { plan: true, est: true });
  add(men, 'pgal', 'Portes à galandage, posées', count((o) => o.type === 'pocket').length, 'u', [650, 900, 1500], { plan: true, est: true });
  add(men, 'entree', "Porte d'entrée, posée", entree.length, 'u', [1800, 2500, 4200], { plan: true, est: true });
  add(men, 'pservice', 'Portes de service, posées', count((o) => o.type === 'door' && o.exterior).length, 'u', [900, 1200, 1800], { plan: true, est: true });
  add(men, 'pint', 'Portes intérieures, posées', count((o) => o.type === 'door' && !o.exterior).length, 'u', [250, 350, 600], { plan: true, est: true });
  add(men, 'pcoul', 'Portes coulissantes, posées', count((o) => o.type === 'sliding-door').length, 'u', [500, 650, 1100], { plan: true, est: true });
  add(men, 'volets', 'Volets roulants électriques, posés', count((o) => o.shutter).length, 'u', [800, 1000, 1300], { plan: true, note: 'Coche « Volet roulant » sur chaque fenêtre concernée.' });

  // ——— Isolation et cloisons ———
  const so = G('secondoeuvre', 'Isolation, plâtrerie, cloisons');
  add(so, 'isomur', 'Isolation et doublage des murs extérieurs', m.facade, 'm²', [45, 60, 95], { plan: true });
  add(so, 'plafond', 'Plafonds isolés', m.plafonds, 'm²', [50, 65, 95], { plan: true });
  add(so, 'cloison', 'Cloisons intérieures', m.cloisons, 'm²', [45, 55, 80], { plan: true });

  // ——— Technique ———
  const tech = G('technique', 'Électricité, plomberie, chauffage');
  add(tech, 'elec', 'Électricité complète', m.hab, 'm²', [90, 110, 160], { plan: true });
  add(tech, 'plomb', 'Plomberie et évacuations', m.hab, 'm²', [55, 70, 110], { plan: true, est: true });
  add(tech, 'chauf', 'Pompe à chaleur air-eau et émetteurs', m.hab, 'm²', [110, 150, 210], { plan: true, note: 'PAC : 80 à 130 €/m² posée, plus plancher chauffant ou radiateurs.' });
  add(tech, 'vmc', T === 0 ? 'VMC simple flux, posée' : 'VMC double flux, posée', 1, 'forfait', [1500, 4000, 6000]);
  add(tech, 'ecs', 'Chauffe-eau thermodynamique', 1, 'forfait', [2500, 3300, 5000]);

  // ——— Finitions ———
  const fin = G('finitions', 'Sols, peintures, revêtements');
  add(fin, 'chape', 'Chape', m.hab, 'm²', [20, 25, 35], { plan: true, est: true });
  for (const [id, area] of m.floors) { const f = materialInfo(id); if (f?.price) { const unit = f.price * 1.1 + POSE(id); add(fin, `sol:${id}`, `Sol : ${f.name}, fourni et posé`, area, 'm²', unit, { plan: true, note: `${f.price} €/m² + 10 % de chutes + pose.` }); } }
  add(fin, 'peinture', 'Peinture des murs, fournie et posée', m.paint, 'm²', [22, 32, 50], { plan: true, est: true });
  add(fin, 'peintplaf', 'Peinture des plafonds, fournie et posée', m.plafondPaint, 'm²', [22, 32, 50], { plan: true, est: true });
  for (const [id, area] of m.wallFinishes) { const f = materialInfo(id); if (f?.price) add(fin, `mur:${id}`, `Mur : ${f.name}, fourni et posé`, area, 'm²', f.price * 1.1 + 50, { plan: true, est: true }); }
  add(fin, 'faience', 'Faïence douche et baignoire', m.sdbTiled * 8, 'm²', [60, 85, 130], { plan: true, est: true, note: '8 m² par salle d’eau.' });

  // ——— Raccordements ———
  const vrd = G('raccordements', 'Raccordements et réseaux');
  add(vrd, 'relec', 'Raccordement électrique', 1, 'forfait', 2500, { note: 'Selon la distance au réseau : devis Enedis.' });
  add(vrd, 'reau', "Raccordement à l'eau", 1, 'forfait', 1200);
  if (s.assainissement === 'collectif') add(vrd, 'egout', "Tout-à-l'égout et participation (PFAC)", 1, 'forfait', 4000, { est: true });
  else add(vrd, 'micro', 'Assainissement individuel (micro-station)', 1, 'forfait', 10000, { est: true });
  add(vrd, 'telecom', 'Fibre et télécom', 1, 'forfait', 400, { est: true });
  add(vrd, 'tranchees', 'Tranchées, regards, eaux pluviales', 1, 'forfait', [3000, 5000, 9000], { est: true });
  add(vrd, 'chantier', 'Eau et électricité de chantier', 1, 'forfait', 500, { est: true });

  // ——— Cuisine et sanitaires ———
  const eq = G('equipements', 'Cuisine et salles de bain');
  eq.items.push(...items.filter((l) => ['cuisine', 'sdb', 'buanderie'].includes(l.def.cat)));
  add(eq, 'posecuis', 'Pose de la cuisine', 1, 'forfait', [800, 1500, 3000], { est: true });

  // ——— Mobilier ———
  const meu = G('mobilier', 'Meubles, déco, luminaires');
  meu.items.push(...items.filter((l) => !['cuisine', 'sdb', 'buanderie', 'structure', 'exterieur'].includes(l.def.cat)));
  add(meu, 'livraison', 'Livraison et montage des meubles', meu.items.reduce((t, l) => t + l.price, 0), '€', 0.04, { est: true });

  // ——— Ce qui n'est pas encore placé ———
  const miss = G('aprevoir', 'À prévoir : pas encore placé sur le plan');
  const R = (k) => m.rooms.get(k) || 0;
  const P = (...keys) => keys.reduce((t, k) => t + (placed.types[k] || 0) + (placed.subs[k] || 0), 0);
  const need = (key, label, wanted, have, price, opt) => add(miss, `m:${key}`, label, Math.max(0, wanted - have), 'u', price, { est: true, ...opt });
  const bedrooms = R('chambre') + R('parentale') + R('enfant');
  need('lit', 'Lits', bedrooms, P('lit', 'lit-enfant'), [200, 400, 900]);
  need('matelas', 'Matelas', bedrooms, P('matelas'), [200, 400, 900]);
  need('armoire', 'Armoires ou dressings', bedrooms, P('armoire'), [250, 500, 1500]);
  need('canape', 'Canapé', (R('salon') + R('sejour') > 0 ? 1 : 0), P('canape'), [450, 800, 2000]);
  need('table', 'Table à manger', 1, P('table'), [200, 500, 1200]);
  need('chaise', 'Chaises', 6, P('chaise'), [50, 130, 250]);
  need('frigo', 'Réfrigérateur', 1, P('fridge'), [450, 649, 1200]);
  need('four', 'Four', 1, P('oven', 'kitchenTall'), [300, 549, 1000]);
  need('plaque', 'Plaque de cuisson', 1, P('hob'), [250, 399, 900]);
  need('hotte', 'Hotte', 1, P('hood'), [150, 279, 700]);
  need('lv', 'Lave-vaisselle', 1, P('dishwasher'), [380, 549, 950]);
  need('ll', 'Lave-linge', 1, P('washer'), [350, 499, 900]);
  if (!P('kitchenBase', 'kitchenWall', 'island', 'sinkUnit')) add(miss, 'm:cuisine', 'Meubles de cuisine et plan de travail', 1, 'forfait', [5000, 9000, 18000], { est: true });
  need('wc', 'WC', R('wc') + (R('wc') ? 0 : Math.min(1, R('sdb') + R('douche'))), P('wc'), [200, 349, 800]);
  need('vasque', 'Meubles vasque', R('sdb') + R('douche'), P('vanity'), [200, 400, 1100]);
  need('douche', 'Douches ou baignoires', R('sdb') + R('douche'), P('shower', 'bathtub'), [400, 620, 1500]);
  need('rideaux', 'Rideaux ou stores', m.openings.filter((o) => o.exterior && !isDoorType(o.type)).length, P('rideau', 'curtain'), [30, 60, 120]);
  need('lum', 'Luminaires', [...m.rooms.values()].reduce((t, n) => t + n, 0), P('suspension', 'lampadaire', 'lampe', 'pendant', 'floorLamp', 'tableLamp'), [30, 60, 150]);
  add(miss, 'm:maison', 'Linge, vaisselle, petit équipement', 1, 'forfait', [1500, 3000, 6000], { est: true });

  // ——— Extérieurs ———
  const ext = G('exterieurs', 'Extérieurs');
  ext.items.push(...items.filter((l) => l.def.cat === 'exterieur'));
  const perim = 4 * Math.sqrt(s.terrainArea || 0);
  const haies = items.filter((l) => ['hedge', 'fence'].includes(l.def.model?.type)).reduce((t, l) => t + (l.it.w ?? l.def.w) / 100, 0);
  add(ext, 'cloture', 'Clôture grillage rigide, posée', Math.max(0, perim - 5 - haies), 'ml', [45, 75, 150], { note: 'Selon la taille du terrain, moins les haies et palissades placées.' });
  add(ext, 'portail', 'Portail motorisé et portillon, posés', 1, 'forfait', [1500, 3000, 5500]);
  add(ext, 'allee', 'Allée et stationnement', 30, 'm²', [30, 60, 110], { est: true });
  if (!items.some((l) => l.def.sub === 'terrasse') && !R('terrasse')) add(ext, 'terrasse', 'Terrasse, posée', 20, 'm²', [80, 130, 200], { est: true });
  add(ext, 'gazon', 'Terre végétale et engazonnement', Math.max(0, (s.terrainArea || 0) - m.emprise - 80), 'm²', [3, 6, 12], { est: true });
  if (!items.some((l) => l.def.sub === 'plantation')) add(ext, 'plants', 'Plantations', 1, 'forfait', [300, 800, 2000], { est: true });

  // ——— Sous-total travaux, puis ce qui en dépend ———
  [go, men, so, tech, fin].forEach(finalize);
  const travaux = go.total + men.total + so.total + tech.total + fin.total;
  [terrain, vrd, eq, meu, miss, ext].forEach(finalize);

  const etu = G('etudes', 'Études, assurances, démarches');
  if (s.mode === 'architecte') add(etu, 'archi', 'Architecte, mission complète', travaux, '€', [0.08, 0.11, 0.15]);
  if (s.mode === 'moe') add(etu, 'moe', "Maître d'œuvre", travaux, '€', [0.06, 0.08, 0.1], { est: true });
  if (s.mode === 'artisans') add(etu, 'plans', 'Plans et dossier de permis', 1, 'forfait', [1500, 2200, 3500], { est: true });
  if (m.taxable > 150 && s.mode !== 'architecte') add(etu, 'archiPC', 'Architecte pour le permis (obligatoire au-delà de 150 m²)', travaux, '€', [0.02, 0.03, 0.05], { est: true });
  add(etu, 'do', 'Assurance dommages-ouvrage', travaux, '€', [0.02, 0.025, 0.04], { note: 'Souvent 2 900 à 7 500 € pour une maison standard. À vérifier : parfois incluse par le constructeur.' });
  add(etu, 're2020', 'Étude thermique et attestations RE2020', 1, 'forfait', [800, 1200, 1800], { est: true });
  add(etu, 'perm', "Test d'étanchéité à l'air", 1, 'forfait', 350, { est: true });
  add(etu, 'implant', 'Implantation par un géomètre', 1, 'forfait', 500, { est: true });
  add(etu, 'consuel', 'Attestation Consuel', 1, 'forfait', 200, { est: true });
  finalize(etu);

  const tax = G('taxes', "Taxes d'urbanisme");
  const baseTA = Math.min(m.taxable, 100) * (TA_VALEUR / 2) + Math.max(0, m.taxable - 100) * TA_VALEUR;
  const poolArea = items.filter((l) => l.def.sub === 'piscine').reduce((t, l) => t + ((l.it.w ?? l.def.w) * (l.it.d ?? l.def.d)) / 1e4, 0);
  const base = baseTA + poolArea * TA_PISCINE;
  add(tax, 'ta', `Taxe d'aménagement (${String(s.commune + s.dept).replace('.', ',')} %)`, base, '€', (s.commune + s.dept) / 100, { plan: true, note: '892 €/m² en 2026, moitié pour les 100 premiers m². Le taux dépend de la commune : 5 % au plus en général, jusqu’à 20 % dans certains secteurs. À confirmer en mairie.' });
  add(tax, 'tap', "Taxe d'archéologie préventive (0,40 %)", base, '€', TAP, { plan: true });
  finalize(tax);

  const emm = G('emmenagement', 'Emménagement');
  add(emm, 'dem', 'Déménagement', 1, 'forfait', [800, 1500, 3000], { est: true });
  finalize(emm);

  const imp = G('imprevus', 'Imprévus');
  const baseImp = travaux + vrd.total + ext.total + eq.lines.reduce((t, l) => t + l.amount, 0);
  add(imp, 'imprevus', `Marge pour imprévus (${s.imprevus} %)`, baseImp, '€', s.imprevus / 100);
  finalize(imp);

  const order = [terrain, etu, tax, vrd, go, men, so, tech, fin, eq, meu, miss, ext, emm, imp];
  const total = order.reduce((t, g) => t + g.total, 0);

  // ——— Crédit, facultatif ———
  let credit = null;
  if (s.loan.taux > 0) {
    const fin2 = G('credit', 'Crédit immobilier');
    const capital = Math.max(0, total - s.loan.apport);
    add(fin2, 'dossier', 'Frais de dossier', 1, 'forfait', 1000);
    add(fin2, 'garantie', 'Garantie du prêt (caution)', capital, '€', 0.013, { note: 'Souvent autour de 1 à 1,5 % du capital.' });
    const n = s.loan.duree * 12, i = s.loan.taux / 100 / 12;
    const mens = (capital * i) / (1 - (1 + i) ** -n);
    const interets = mens * n - capital;
    const assur = (capital * (s.loan.assurance / 100) * n) / 12;
    add(fin2, 'interets', `Intérêts sur ${s.loan.duree} ans`, 1, 'total', Math.round(interets));
    add(fin2, 'assurance', 'Assurance emprunteur', 1, 'total', Math.round(assur));
    finalize(fin2);
    order.push(fin2);
    credit = { capital, mensualite: mens + assur / n, total: fin2.total };
  }

  const bought = items.filter((l) => l.it.bought).reduce((t, l) => t + l.price, 0);
  return { groups: order.filter((g) => g.lines.length || g.items.length), total, items, m, travaux, perM2: m.hab ? (travaux + vrd.total * 0 + etu.lines.filter((l) => l.key === 'do').reduce((t, l) => t + l.amount, 0)) / m.hab : 0, bought, remaining: total + (credit?.total || 0) - bought, credit, sumItems, hasTerrain: s.terrain > 0 };
}

/** Budget pour la gamme choisie, avec la fourchette économique / haut de gamme. */
export function fullBudget(store) {
  const p = store.project, s = budgetSettings(p), analyze = (lv) => store.analysis(lv);
  const res = compute(p, s, analyze);
  res.settings = s;
  res.low = compute(p, { ...s, gamme: 'eco' }, analyze).total;
  res.high = compute(p, { ...s, gamme: 'haut' }, analyze).total;
  return res;
}

export const BUDGET_SOURCES = [
  ['Coût de construction au m²', 'https://www.travaux.com/construction-renovation-maison/guide-des-prix/construction'],
  ['Prix par intervenant', 'https://plan-ideal.fr/prix-dune-maison-neuve-au-m%C2%B2-reperes-fiables-pour-construire/'],
  ['Prix par lot (simulation)', 'https://info.fr/construction-maison/'],
  ["Taxe d'aménagement 2026", 'https://www.economie.gouv.fr/particuliers/taxe-amenagement'],
  ["Taxe d'archéologie 2026", 'https://www.dirinon.fr/wp-content/uploads/Flyer_TU_2026_Sud-Finistere.pdf'],
  ['Frais de notaire sur un terrain', 'https://www.construires.fr/dmto-terrain-a-batir-regime-tva-vente-par-assujetti-vs-particulier/'],
  ['Étude de sol G2', 'https://abctravaux.org/prix-etude-de-sol-g2/'],
  ['Dommages-ouvrage', 'https://reassurez-moi.fr/guide/assurance-dommages-ouvrage/prix'],
  ["Honoraires d'architecte", 'https://www.construires.fr/plans-architecte-permis-de-construire/'],
  ['Fenêtres posées', 'https://www.lamaisonsaintgobain.fr/guides-travaux/menuiseries-exterieures/prix-fenetre-double-vitrage'],
  ['Volets roulants', 'https://www.lamaisonsaintgobain.fr/guides-travaux/menuiseries-exterieures/prix-volet-roulant-electrique'],
  ['Parquet posé', 'https://www.lamaisonsaintgobain.fr/guides-travaux/amenagement-interieur/prix-pose-parquet'],
  ['Carrelage posé', 'https://abctravaux.org/prix-travaux-au-m2/'],
  ['Pompe à chaleur', 'https://www.hellowatt.fr/pompe-a-chaleur/pompe-chaleur-air-eau/prix-pompe-chaleur-air-eau'],
  ['VMC double flux', 'https://www.prix-travaux-m2.com/prix-vmc-double-flux.php'],
  ['Raccordement électrique', 'https://www.papernest.com/energie/raccordement-electricite/'],
  ["Raccordement à l'eau", 'https://www.kelwatt.fr/eau/demenagement/raccordement-eau-potable'],
  ['Clôtures', 'https://www.habitatpresto.com/mag/menuiserie/portail-portillon/prix-cloture-rigide'],
  ['Garantie de prêt', 'https://reassurez-moi.fr/guide/pret-immobilier/frais-de-garantie'],
];
