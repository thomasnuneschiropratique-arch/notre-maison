// Catalogue : produits réels relevés sur les fiches IKEA France + équipements génériques avec liens de recherche.
import ikea from './data/ikea.json';

const q = encodeURIComponent;
export const SHOPS = {
  ikea: (s) => `https://www.ikea.com/fr/fr/search/?q=${q(s)}`,
  mdm: (s) => `https://www.maisonsdumonde.com/FR/fr/search/${q(s)}?realQuery=${q(s)}`,
  redoute: (s) => `https://www.laredoute.fr/psrch/psrch.aspx?kwrd=${q(s)}`,
  leroy: (s) => `https://www.leroymerlin.fr/recherche=${q(s)}`,
  casto: (s) => `https://www.castorama.fr/search?term=${q(s)}`,
  boulanger: (s) => `https://www.boulanger.com/resultats?tr=${q(s)}`,
  google: (s) => `https://www.google.com/search?tbm=shop&q=${q(s)}`,
  // Ces boutiques n'ont pas d'adresse de recherche vérifiable : on passe par une recherche limitée à leur site.
  sklum: (s) => `https://www.google.com/search?q=${q(`${s} site:sklum.com/fr`)}`,
  kave: (s) => `https://www.google.com/search?q=${q(`${s} site:kavehome.com/fr`)}`,
  westwing: (s) => `https://www.google.com/search?q=${q(`${s} site:westwing.fr`)}`,
  miliboo: (s) => `https://www.google.com/search?q=${q(`${s} site:miliboo.com`)}`,
  bobochic: (s) => `https://www.google.com/search?q=${q(`${s} site:bobochicparis.com`)}`,
  leboncoin: (s) => `https://www.leboncoin.fr/recherche?text=${q(s)}`,
};
const SHOP_NAMES = { ikea: 'IKEA', mdm: 'Maisons du Monde', redoute: 'La Redoute', leroy: 'Leroy Merlin', casto: 'Castorama', boulanger: 'Boulanger', sklum: 'Sklum', kave: 'Kave Home', westwing: 'Westwing', miliboo: 'Miliboo', bobochic: 'Bobochic', google: 'Comparer les prix', leboncoin: "D'occasion (Leboncoin)" };

export const CATEGORIES = [
  ['anna', 'Son style'], ['salon', 'Salon'], ['repas', 'Repas'], ['chambre', 'Chambre'], ['cuisine', 'Cuisine'], ['sdb', 'Salle de bain'], ['bureau', 'Bureau'],
  ['deco', 'Déco & luminaires'], ['entree', 'Entrée'], ['enfant', 'Enfant'], ['buanderie', 'Buanderie'], ['exterieur', 'Extérieur'], ['structure', 'Structure'], ['objets', 'Objets'], ['perso', 'Mes ajouts'],
];

const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (arr, s) => arr[hash(s) % arr.length];

function normalizeDims(x) {
  const D = x.dims || {};
  const g = (...keys) => {
    for (const k of keys) if (D[k] != null) return D[k];
    for (const k of keys) for (const l in D) if (l.startsWith(`${k} `) && !/(accoudoir|assise|matelas|table|coussin|plateau|espace|pied|fil)/.test(l)) return D[l];
    return undefined;
  };
  const prof = g('profondeur'), larg = g('largeur'), long = g('longueur'), diam = g('diamètre', 'diametre');
  let w, d;
  const isBed = ['lit', 'lit-enfant', 'matelas'].includes(x.sub);
  if (diam && !larg && !long) { w = d = diam; }
  else if (isBed) { w = Math.min(larg ?? 160, long ?? 200); d = Math.max(larg ?? 160, long ?? 200); }
  else if (prof != null) { w = larg ?? long; d = prof; }
  else if (larg != null && long != null) { w = Math.max(larg, long); d = Math.min(larg, long); }
  else { w = larg ?? long; d = x.d; }
  const h = D['hauteur tête de lit'] ?? g('hauteur totale', 'hauteur', 'hauteur max.') ?? g('epaisseur', 'épaisseur') ?? D['hauteur coussins dossier inclus'];
  return { w, d, h };
}

const DEFAULTS = { canape: [210, 90, 85], fauteuil: [80, 85, 95], 'table-basse': [90, 55, 45], 'meuble-tv': [160, 40, 55], bibliotheque: [80, 30, 200], table: [160, 90, 75], chaise: [45, 50, 85], buffet: [160, 45, 85], tabouret: [40, 40, 75], lit: [165, 210, 95], matelas: [160, 200, 22], chevet: [45, 40, 55], armoire: [100, 58, 200], commode: [80, 48, 80], bureau: [120, 60, 75], siege: [60, 60, 100], meuble: [60, 60, 88], plan: [186, 63, 4], evier: [80, 60, 88], electro: [60, 60, 88], ilot: [120, 60, 90], 'meuble-vasque': [80, 45, 65], 'miroir-sdb': [60, 17, 75], 'rangement-sdb': [40, 30, 170], tapis: [200, 300, 1], rideau: [145, 10, 250], suspension: [40, 40, 30], lampadaire: [36, 36, 155], lampe: [26, 26, 42], miroir: [60, 3, 130], cadre: [50, 3, 70], plante: [40, 40, 120], coussin: [50, 15, 50], vase: [15, 15, 30], rangement: [80, 30, 90], 'lit-enfant': [97, 207, 90], 'rangement-enfant': [90, 44, 90], 'table-ext': [140, 80, 75], 'chaise-ext': [55, 55, 85] };

function modelFor(x, w, d, h) {
  const type = (x.type || '').toLowerCase();
  const slug = x.slug || '';
  const round = /ronde?|rond|diam/.test(type + slug) || (w === d && x.sub === 'table');
  const woodLike = /chene|noyer|pin|bambou|frene|acacia|bois|hetre/.test(slug);
  const proc = (t, p = {}) => ({ kind: 'proc', type: t, p, slug, color: x.color });
  const ph = (id) => ({ kind: 'ph', id });
  switch (x.sub) {
    case 'canape': {
      const seats = /(\d) places?/.exec(type)?.[1];
      const chaise = /meridienne|méridienne|angle/.test(type + slug) ? 'right' : null;
      const kind = /cuir/.test(slug) ? 'cuir' : /velours|djuparp/.test(slug) ? 'velours' : 'lin';
      return proc('sofa', { seats: chaise ? 3 : Number(seats) || Math.max(2, Math.round(w / 70)), chaise, kind, color: x.color || '#b7ab98' });
    }
    case 'fauteuil':
      if (/poaeng/.test(slug)) return ph('modern_arm_chair_01');
      if (/strandmon/.test(slug)) return ph('ArmChair_01');
      return proc('armchair', { color: x.color || '#b7ab98', kind: /cuir/.test(slug) ? 'cuir' : 'lin' });
    case 'table-basse':
      if (round) return ph('coffee_table_round_01');
      if (woodLike) return ph(w / d > 1.6 ? 'modern_coffee_table_01' : 'modern_coffee_table_02');
      return proc('table', { legMat: null });
    case 'meuble-tv': return proc('tvBench');
    case 'bibliotheque': {
      const grid = /kallax/.test(slug);
      const c = grid ? Math.max(1, Math.round(w / 38)) : Math.max(1, Math.round(w / 80));
      return proc('bookcase', { cols: c, rows: grid ? Math.max(1, Math.round(h / 38)) : Math.max(2, Math.round(h / 36)) });
    }
    case 'table':
      if (round) return woodLike ? ph('round_wooden_table_02') : proc('table', { round: true });
      return woodLike ? ph('wooden_table_02') : proc('table');
    case 'chaise':
      if (/blanc/.test(slug)) return ph('painted_wooden_chair_01');
      if (/noir|anthracite/.test(slug) && !woodLike) return ph('dining_chair_02');
      return proc('chair', {});
    case 'buffet': return proc('drawers', { cols: Math.max(2, Math.round(w / 45)), rows: 1, legs: 0.1 });
    case 'tabouret': return /bar/.test(type) ? ph('bar_chair_round_01') : ph('metal_stool_02');
    case 'lit': case 'lit-enfant': return proc('bed', { upholstered: /matelass|tissu/.test(type + slug), headColor: x.color, bedColor: '#ece7dd' });
    case 'matelas': return proc('mattress');
    case 'chevet': return proc('drawers', { rows: 2, legs: 0.08 });
    case 'commode': return proc('drawers', { cols: w > 100 ? 2 : 1, rows: Math.max(2, Math.round(h / 26)) });
    case 'armoire': return proc('wardrobe', { doors: Math.max(1, Math.round(w / 50)), sliding: /coulissant/.test(type + slug), withMirror: /miroir/.test(type + slug) });
    case 'bureau': return proc('desk', { drawersOn: /tiroir|micke|alex/.test(type + slug) });
    case 'siege': return proc('officeChair', { color: x.color || '#3b3d3f' });
    case 'meuble':
      if (/mural/.test(type + slug)) return proc('kitchenWall', {});
      if (/armoire/.test(type + slug)) return proc('kitchenTall', {});
      return proc('kitchenBase', {});
    case 'plan': return proc('worktop', {});
    case 'evier': return proc('sinkUnit', {});
    case 'electro':
      if (/four/.test(type)) return proc('oven', {});
      if (/hotte/.test(type)) return proc('hood', {});
      if (/cuisson|induction/.test(type)) return proc('hob', {});
      if (/lave-vaisselle/.test(type)) return proc('dishwasher', {});
      return proc('fridge', {});
    case 'ilot': return proc('island', {});
    case 'meuble-vasque': return proc('vanity', { wall: /suspendu|enhet|godmorgon/.test(type + slug) });
    case 'miroir-sdb': return proc('mirrorCabinet', {});
    case 'rangement-sdb': return /porte-serviette/.test(type + slug) ? proc('towelRadiator', {}) : proc('bookcase', { rows: 5, books: false });
    case 'tapis': return proc('rug', { round, color: x.color || '#c9b89e' });
    case 'rideau': return proc('curtain', { color: x.color || '#e4dccd', sheer: /voilage/.test(type + slug) });
    case 'suspension': return proc('pendant', { shade: /papier|regolit/.test(slug) ? 'paper' : 'dome', color: x.color || '#1f2022' });
    case 'lampadaire': return proc('floorLamp', {});
    case 'lampe': return proc('tableLamp', {});
    case 'miroir': return proc('mirrorWall', { round: round || /rond/.test(slug) });
    case 'cadre': return proc('picture', { art: hash(slug) % 3, frameColor: x.color || '#20201f' });
    case 'plante': return ph(pick(['potted_plant_01', 'potted_plant_02', 'potted_plant_04'], slug));
    case 'coussin': return ph('throw_pillows_01');
    case 'vase': return ph(pick(['ceramic_vase_01', 'ceramic_vase_02', 'ceramic_vase_03'], slug));
    case 'rangement':
      if (/banc/.test(type)) return ph('painted_wooden_bench');
      return proc('drawers', { rows: 2, cols: w > 100 ? 2 : 1 });
    case 'rangement-enfant': return proc('bookcase', { cols: Math.max(1, Math.round(w / 45)), rows: 3, books: false });
    case 'table-ext': return ph(w > 160 ? 'wooden_picnic_table' : 'round_wooden_table_02');
    case 'chaise-ext': return ph('painted_wooden_chair_01');
  }
  return proc('slab', {});
}

const PLACEMENT = { 'miroir-sdb': { wall: true, z: 120 }, miroir: { wall: true, z: 60 }, cadre: { wall: true, z: 130 }, rideau: { wall: true, z: 0 }, suspension: { ceiling: true } };
const GENERIC_QUERY = (x) => `${x.type} ${x.w ? `${Math.round(x.w)} cm` : ''}`.trim();

function fromIkea(x, i) {
  const n = normalizeDims(x);
  const [dw, dd, dh] = DEFAULTS[x.sub] || [80, 50, 80];
  let w = n.w || dw, d = n.d || dd, h = n.h || dh;
  const D = x.dims || {};
  if (['lampadaire', 'lampe', 'suspension'].includes(x.sub)) {
    w = d = D['diam. abat-jour'] ?? D['largeur abat-jour'] ?? D['diamètre'] ?? dw;
    h = D.hauteur ?? D['hauteur totale'] ?? D['hauteur max.'] ?? D["hauteur d'abat-jour"] ?? dh;
  }
  if (x.sub === 'rideau') { w = Math.min(D['largeur/rideau'] ?? D.largeur ?? dw, 300); h = D.longueur ?? dh; }
  if (x.sub === 'plante') { h = D['hauteur de la plante'] ?? D.hauteur ?? dh; w = d = Math.max((D['diamètre du pot'] ?? 18) * 2.4, 35); }
  if (x.sub === 'tapis') { w = Math.min(D.largeur ?? dw, D.longueur ?? dd); d = Math.max(D.largeur ?? dw, D.longueur ?? dd); h = 1; }
  if (x.sub === 'miroir' || x.sub === 'cadre') { d = 3; }
  if (x.sub === 'rideau') { d = 10; }
  const id = `ik-${x.slug}`;
  return {
    id, name: `${x.name}`, label: x.type, brand: 'IKEA', cat: x.cat, sub: x.sub, w, d, h, price: x.price, color: x.color, url: x.url,
    model: modelFor(x, w, d, h), query: GENERIC_QUERY({ type: x.type, w }), ...(PLACEMENT[x.sub] || {}),
  };
}

// Équipements non vendus chez IKEA ou objets de décoration : prix indicatifs, liens vers une recherche.
const G = (cat, sub, name, w, d, h, price, model, shops, extra = {}) => ({ id: `g-${sub}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, label: extra.label || sub, brand: 'Générique', cat, sub, w, d, h, price, model, query: extra.query || name, shops, approx: true, ...extra });
const P = (type, p = {}) => ({ kind: 'proc', type, p, color: p.color });
const H = (id) => ({ kind: 'ph', id });
const BTP = ['leroy', 'casto'];
const ELEC = ['boulanger', 'google'];
const DECO = ['sklum', 'mdm', 'kave', 'westwing', 'google'];

const GENERIC = [
  G('sdb', 'baignoire', 'Baignoire acrylique 170 × 75', 170, 75, 56, 249, P('bathtub'), BTP, { query: 'baignoire 170x75' }),
  G('sdb', 'baignoire', 'Baignoire 180 × 80', 180, 80, 58, 349, P('bathtub'), BTP, { query: 'baignoire 180x80' }),
  G('sdb', 'douche', "Douche à l'italienne 120 × 80", 120, 80, 200, 620, P('shower'), BTP, { query: 'paroi douche italienne 120' }),
  G('sdb', 'douche', "Douche à l'italienne 140 × 90", 140, 90, 200, 780, P('shower'), BTP, { query: 'paroi douche italienne 140' }),
  G('sdb', 'douche', 'Douche 90 × 90', 90, 90, 200, 480, P('shower'), BTP, { query: 'receveur douche 90x90 paroi' }),
  G('sdb', 'wc', 'WC suspendu avec bâti-support', 38, 60, 100, 349, P('wc'), BTP, { query: 'wc suspendu bati support' }),
  G('sdb', 'radiateur', 'Sèche-serviettes 50 × 120', 50, 8, 120, 219, P('towelRadiator'), BTP, { query: 'sèche serviettes électrique', wall: true, z: 0 }),
  G('sdb', 'miroir', 'Miroir rond 70 cm', 70, 3, 70, 89, P('mirrorWall', { round: true }), DECO, { query: 'miroir rond 70 cm', wall: true, z: 120 }),
  G('cuisine', 'electro', 'Réfrigérateur combiné 60 cm', 60, 65, 185, 649, P('fridge'), ELEC, { query: 'réfrigérateur combiné 60 cm' }),
  G('cuisine', 'electro', 'Réfrigérateur américain 90 cm', 91, 70, 178, 1199, P('fridge'), ELEC, { query: 'réfrigérateur américain' }),
  G('cuisine', 'electro', 'Four encastrable', 60, 60, 88, 549, P('oven'), ELEC, { query: 'four encastrable pyrolyse' }),
  G('cuisine', 'electro', 'Plaque induction 60 cm', 60, 60, 88, 399, P('hob'), ELEC, { query: 'plaque induction 60 cm' }),
  G('cuisine', 'electro', 'Hotte murale 60 cm', 60, 45, 60, 279, P('hood'), ELEC, { query: 'hotte murale 60 cm', wall: true, z: 160 }),
  G('cuisine', 'electro', 'Lave-vaisselle 60 cm', 60, 60, 88, 549, P('dishwasher'), ELEC, { query: 'lave-vaisselle encastrable 60 cm' }),
  G('cuisine', 'meuble', 'Évier inox sur meuble 80 cm', 80, 60, 88, 299, P('sinkUnit', { woodKind: 'clair' }), BTP, { query: 'évier inox meuble 80' }),
  G('cuisine', 'meuble', 'Meuble bas 60 cm', 60, 60, 88, 149, P('kitchenBase', { woodKind: 'clair', drawersRows: 3 }), BTP, { query: 'meuble bas cuisine 60' }),
  G('cuisine', 'meuble', 'Meuble bas 80 cm', 80, 60, 88, 179, P('kitchenBase', { woodKind: 'clair' }), BTP, { query: 'meuble bas cuisine 80' }),
  G('cuisine', 'meuble', 'Meuble haut 60 cm', 60, 37, 72, 99, P('kitchenWall', { woodKind: 'clair' }), BTP, { query: 'meuble haut cuisine 60', wall: true, z: 145 }),
  G('cuisine', 'meuble', 'Colonne four 60 cm', 60, 60, 215, 389, P('kitchenTall', { oven: true, woodKind: 'clair' }), BTP, { query: 'colonne four cuisine' }),
  G('cuisine', 'ilot', 'Îlot central 180 × 90', 180, 90, 90, 790, P('island', { woodKind: 'clair' }), BTP, { query: 'îlot central cuisine' }),
  G('buanderie', 'electro', 'Lave-linge 60 cm', 60, 60, 85, 499, P('washer'), ELEC, { query: 'lave-linge 60 cm' }),
  G('buanderie', 'electro', 'Sèche-linge 60 cm', 60, 60, 85, 549, P('washer'), ELEC, { query: 'sèche-linge pompe à chaleur' }),
  G('salon', 'tv', 'Téléviseur 55 pouces', 123, 24, 80, 549, P('tv', { w: 1.23, h: 0.71 }), ELEC, { query: 'téléviseur 55 pouces OLED', onSurface: true }),
  G('salon', 'tv', 'Téléviseur 65 pouces', 145, 28, 92, 899, P('tv', { w: 1.45, h: 0.83 }), ELEC, { query: 'téléviseur 65 pouces OLED', onSurface: true }),
  G('salon', 'canape', 'Canapé Chesterfield noir', 181, 82, 71, 1490, H('sofa_02'), DECO, { query: 'canapé chesterfield cuir noir', scanned: true }),
  G('salon', 'canape', 'Canapé de style Louis XV', 157, 66, 80, 1290, H('Sofa_01'), DECO, { query: 'canapé style louis XV', scanned: true }),
  G('salon', 'canape', 'Grand canapé baroque', 273, 92, 112, 1690, H('sofa_03'), DECO, { query: 'canapé baroque', scanned: true }),
  G('salon', 'fauteuil', 'Fauteuil cuir et chêne', 82, 99, 102, 390, H('modern_arm_chair_01'), DECO, { query: 'fauteuil cuir bois', scanned: true }),
  G('salon', 'fauteuil', 'Fauteuil classique', 85, 77, 107, 490, H('ArmChair_01'), DECO, { query: 'fauteuil style classique', scanned: true }),
  G('salon', 'fauteuil', 'Fauteuil lounge années 50', 100, 119, 117, 690, H('mid_century_lounge_chair'), DECO, { query: 'fauteuil lounge vintage', scanned: true }),
  G('salon', 'fauteuil', 'Pouf', 88, 62, 62, 189, H('Ottoman_01'), DECO, { query: 'pouf ottoman', scanned: true }),
  G('salon', 'table-basse', 'Table basse industrielle', 78, 76, 64, 229, H('industrial_coffee_table'), DECO, { query: 'table basse industrielle', scanned: true }),
  G('salon', 'table-basse', 'Table basse ronde bois', 130, 130, 49, 349, H('coffee_table_round_01'), DECO, { query: 'table basse ronde bois', scanned: true }),
  G('salon', 'table-basse', 'Bout de canapé', 38, 38, 76, 99, H('side_table_tall_01'), DECO, { query: 'bout de canapé', scanned: true }),
  G('salon', 'cheminee', 'Poêle à bois de masse', 117, 133, 236, 6900, H('scandinavian_masonry_heater'), ['google'], { query: 'poêle de masse', scanned: true }),
  G('repas', 'table', 'Grande table de ferme', 225, 139, 88, 1190, H('dining_table'), DECO, { query: 'table de ferme bois 220', scanned: true }),
  G('repas', 'table', 'Table ronde bistrot', 80, 80, 75, 249, H('round_wooden_table_02'), DECO, { query: 'table ronde bistrot', scanned: true }),
  G('repas', 'chaise', 'Chaise capitonnée', 43, 58, 97, 129, H('dining_chair_02'), DECO, { query: 'chaise capitonnée', scanned: true }),
  G('repas', 'chaise', 'Chaise bois sculpté', 58, 60, 103, 139, H('gallinera_chair'), DECO, { query: 'chaise bois sculpté', scanned: true }),
  G('repas', 'buffet', 'Enfilade bois 244 cm', 244, 52, 68, 990, H('modern_wooden_cabinet'), DECO, { query: 'enfilade bois', scanned: true }),
  G('repas', 'buffet', 'Buffet vintage', 119, 62, 118, 590, H('painted_wooden_cabinet'), DECO, { query: 'buffet vintage bois', scanned: true }),
  G('bureau', 'bureau', 'Bureau métal et bois 200', 200, 95, 79, 590, H('metal_office_desk'), DECO, { query: 'bureau métal bois', scanned: true }),
  G('chambre', 'chevet', 'Chevet classique', 57, 42, 70, 159, H('ClassicNightstand_01'), DECO, { query: 'chevet classique bois', scanned: true }),
  G('chambre', 'lit', 'Lit de repos vintage', 197, 85, 113, 690, H('vintage_day_bed'), DECO, { query: 'lit de repos daybed', scanned: true }),
  G('deco', 'bibliotheque', 'Étagère bois 108 cm', 108, 37, 156, 249, H('wooden_display_shelves_01'), DECO, { query: 'étagère bois', scanned: true }),
  G('deco', 'suspension', 'Suspension design', 43, 43, 95, 129, H('modern_ceiling_lamp_01'), DECO, { query: 'suspension design', scanned: true, ceiling: true }),
  G('deco', 'suspension', 'Suspension industrielle', 55, 55, 135, 119, H('hanging_industrial_lamp'), DECO, { query: 'suspension industrielle', scanned: true, ceiling: true }),
  G('deco', 'suspension', 'Lustre', 75, 80, 80, 349, H('Chandelier_01'), DECO, { query: 'lustre', scanned: true, ceiling: true }),
  G('deco', 'suspension', 'Ventilateur de plafond', 146, 146, 52, 229, H('ceiling_fan'), ['leroy', 'google'], { query: 'ventilateur de plafond', scanned: true, ceiling: true }),
  G('deco', 'plante', 'Grande plante en pot', 59, 64, 135, 69, H('potted_plant_01'), DECO, { query: 'grande plante en pot', scanned: true }),
  G('deco', 'plante', 'Plante moyenne', 70, 66, 84, 45, H('potted_plant_02'), DECO, { query: 'plante en pot', scanned: true }),
  G('deco', 'plante', 'Petite plante', 17, 19, 27, 15, H('potted_plant_04'), DECO, { query: 'petite plante', scanned: true }),
  G('deco', 'cadre', 'Cadre mural 59 × 84', 59, 3, 84, 39, H('hanging_picture_frame_01'), DECO, { query: 'cadre mural', scanned: true, wall: true, z: 110 }),
  G('deco', 'cadre', 'Cadre paysage 75 × 50', 75, 3, 50, 39, H('hanging_picture_frame_02'), DECO, { query: 'cadre photo mural', scanned: true, wall: true, z: 130 }),
  G('deco', 'miroir', 'Miroir doré ornementé', 49, 3, 74, 119, H('ornate_mirror_01'), DECO, { query: 'miroir doré ornementé', scanned: true, wall: true, z: 110 }),
  G('deco', 'objet', 'Horloge murale', 32, 5, 32, 45, H('wall_clock'), DECO, { query: 'horloge murale', scanned: true, wall: true, z: 180 }),
  G('objets', 'objet', 'Vase céramique', 20, 21, 40, 35, H('ceramic_vase_01'), DECO, { query: 'vase céramique', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Vase ancien', 26, 26, 44, 49, H('antique_ceramic_vase_01'), DECO, { query: 'vase ancien céramique', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Vase laiton', 23, 23, 69, 69, H('brass_vase_01'), DECO, { query: 'vase laiton', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Panier en osier', 37, 27, 22, 29, H('wicker_basket_02'), DECO, { query: 'panier osier', scanned: true }),
  G('objets', 'objet', 'Coupe en bois', 31, 31, 9, 25, H('wooden_bowl_01'), DECO, { query: 'coupe en bois', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Service à thé', 92, 48, 16, 59, H('tea_set_01'), DECO, { query: 'service à thé', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Encyclopédies', 55, 16, 24, 40, H('book_encyclopedia_set_01'), ['leboncoin', 'google'], { query: 'livres anciens lot', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Coussins', 102, 63, 45, 39, H('throw_pillows_01'), DECO, { query: 'coussins décoratifs', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Horloge de cheminée', 48, 25, 16, 79, H('mantel_clock_01'), DECO, { query: 'horloge à poser', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Statue de chat', 15, 25, 28, 39, H('concrete_cat_statue'), DECO, { query: 'statue chat béton', scanned: true, onSurface: true }),
  G('objets', 'objet', 'Buste en marbre', 27, 30, 51, 129, H('marble_bust_01'), DECO, { query: 'buste marbre déco', scanned: true, onSurface: true }),
  G('structure', 'escalier', 'Escalier droit (2,80 m)', 90, 320, 280, 2400, P('stairs', { woodKind: 'chene' }), BTP, { query: 'escalier droit bois', noColor: true }),
  G('structure', 'escalier', 'Escalier droit compact', 80, 260, 260, 1490, P('stairs', { woodKind: 'chene' }), BTP, { query: 'escalier droit compact' }),
  G('structure', 'escalier', 'Escalier sans contremarche', 90, 320, 280, 3200, P('stairs', { woodKind: 'chene', open: true }), BTP, { query: 'escalier droit bois sans contremarche' }),
  G('structure', 'escalier', 'Escalier métal et bois', 90, 320, 280, 4500, P('stairs', { woodKind: 'chene', open: true, rail: 'metal' }), BTP, { query: 'escalier métal bois limon central' }),
  G('structure', 'escalier', 'Escalier béton', 100, 320, 280, 5500, P('stairs', { stone: true }), BTP, { query: 'escalier béton sur mesure' }),
  G('structure', 'escalier', 'Escalier garde-corps verre', 100, 320, 280, 6900, P('stairs', { woodKind: 'chene', open: true, rail: 'glass' }), BTP, { query: 'escalier garde-corps verre' }),
  G('structure', 'escalier', 'Escalier quart tournant', 190, 300, 280, 3500, P('stairs', { woodKind: 'chene', shape: 'L' }), BTP, { query: 'escalier quart tournant' }),
  G('structure', 'escalier', 'Escalier en U', 200, 260, 280, 4800, P('stairs', { woodKind: 'chene', shape: 'U' }), BTP, { query: 'escalier deux quarts tournants' }),
  G('structure', 'escalier', 'Colimaçon 1,60 m', 160, 160, 280, 2900, P('stairs', { woodKind: 'chene', shape: 'spiral' }), BTP, { query: 'escalier colimaçon 160' }),
  G('structure', 'escalier', 'Colimaçon compact 1,20 m', 120, 120, 280, 1900, P('stairs', { shape: 'spiral', metal: true }), BTP, { query: 'escalier colimaçon 120 métal' }),
  G('structure', 'balcon', 'Balcon garde-corps verre 4 m', 400, 150, 110, 5200, P('balcony', { rail: 'glass' }), BTP, { query: 'balcon garde-corps verre', priceBy: 'area' }),
  G('structure', 'balcon', 'Balcon métal 3 m', 300, 120, 110, 3100, P('balcony', { rail: 'metal' }), BTP, { query: 'balcon métal', priceBy: 'area' }),
  G('structure', 'balcon', 'Terrasse sur pilotis 6 × 3 m', 600, 300, 110, 9800, P('balcony', { rail: 'glass', stilts: true, woodKind: 'chene' }), BTP, { query: 'terrasse sur pilotis', priceBy: 'area' }),
  G('structure', 'balcon', 'Terrasse suspendue bois 4 × 2 m', 400, 200, 110, 4900, P('balcony', { rail: 'metal', stilts: true, woodKind: 'chene' }), BTP, { query: 'terrasse bois surélevée', priceBy: 'area' }),
  G('structure', 'garde-corps', 'Garde-corps verre 2 m', 200, 6, 105, 760, P('railing', { rail: 'glass' }), BTP, { query: 'garde-corps verre', priceBy: 'length', wall: true }),
  G('structure', 'garde-corps', 'Garde-corps métal 2 m', 200, 6, 105, 340, P('railing', { rail: 'metal' }), BTP, { query: 'garde-corps métal', priceBy: 'length', wall: true }),
  G('exterieur', 'soutenement', 'Mur de soutènement pierre 3 m', 300, 40, 120, 1500, P('retaining', { kind: 'stone' }), BTP, { query: 'mur de soutènement pierre', priceBy: 'length' }),
  G('exterieur', 'soutenement', 'Mur de soutènement béton 3 m', 300, 25, 150, 1200, P('retaining', {}), BTP, { query: 'mur de soutènement béton', priceBy: 'length' }),
  G('exterieur', 'soutenement', 'Gabions 2 m', 200, 50, 100, 520, P('retaining', { kind: 'gabion' }), BTP, { query: 'mur gabion', priceBy: 'length' }),
  G('exterieur', 'marches', 'Marches extérieures 1,20 m', 120, 200, 100, 650, P('stairs', { stone: true, noRail: true }), BTP, { query: 'escalier extérieur pierre' }),
  G('exterieur', 'terrasse', 'Terrasse bois', 400, 300, 12, 1800, P('slab', { woodKind: 'chene' }), BTP, { query: 'lame terrasse bois', priceBy: 'area' }),
  G('exterieur', 'pergola', 'Pergola aluminium 4 × 3', 400, 300, 250, 2490, P('pergola'), ['leroy', 'casto', 'google'], { query: 'pergola aluminium 4x3', priceBy: 'area' }),
  G('exterieur', 'piscine', 'Piscine 8 × 4', 800, 400, 10, 28000, P('pool'), ['google'], { query: 'piscine enterrée 8x4', priceBy: 'area' }),
  G('exterieur', 'plantation', 'Haie (3 m)', 300, 60, 170, 180, P('hedge'), BTP, { query: 'haie arbustes', priceBy: 'length' }),
  G('exterieur', 'plantation', 'Arbre', 340, 340, 500, 149, P('tree'), BTP, { query: 'arbre de jardin' }),
  G('exterieur', 'cloture', 'Palissade bois (2,50 m)', 250, 5, 150, 149, P('fence'), BTP, { query: 'palissade bois', priceBy: 'length' }),
  G('exterieur', 'mobilier', 'Salon de jardin 2 places', 78, 183, 86, 349, H('outdoor_table_chair_set_01'), DECO, { query: 'salon de jardin', scanned: true }),
  G('exterieur', 'mobilier', 'Table de pique-nique', 224, 302, 75, 399, H('wooden_picnic_table'), BTP, { query: 'table pique-nique bois', scanned: true }),
  G('exterieur', 'mobilier', 'Banc en bois peint', 116, 50, 89, 189, H('painted_wooden_bench'), DECO, { query: 'banc jardin bois', scanned: true }),
];

// Marques au style d'Anna : fiches réelles repérées en novembre 2026.
const BOUCLE = (color) => P('sofa', { seats: 3, kind: 'bouclette', color });
const BR = (brand, cat, sub, name, label, w, d, h, price, model, url, extra = {}) => ({ id: `b-${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), brand, cat, sub, name, label, w, d, h, price, model, url, query: extra.query || label, ...extra });
const BRANDS = [
  BR('Maisons du Monde', 'salon', 'canape', 'Wallas', 'Canapé 3 places bouclette blanche', 230, 98, 73, 489.99, BOUCLE('#ece6d6'), 'https://www.maisonsdumonde.com/FR/fr/p/canape-3-places-tissu-bouclette-blanc-wallas-bouclette-M23014015.htm', { query: 'canapé bouclette 3 places' }),
  BR('Maisons du Monde', 'salon', 'canape', 'Wave', 'Canapé organique 3 places bouclette', 232, 97, 68, 499.99, BOUCLE('#e4dccd'), 'https://www.maisonsdumonde.com/FR/fr/p/canape-virgule-organique-3-places-en-tissu-bouclette-wave-M24009975.htm', { query: 'canapé organique bouclette' }),
  BR('Maisons du Monde', 'salon', 'canape', 'Milano', 'Canapé cosy rond 3 places bouclette', 210, 85, 85, 399.99, BOUCLE('#efe9dc'), 'https://www.maisonsdumonde.com/FR/fr/p/canape-3-places-cosy-rond-tissu-bouclettes-blanches-milano-M23079364.htm', { query: 'canapé rond bouclette' }),
  BR('Sklum', 'salon', 'canape', 'Eracli', 'Canapé 3 places bouclé', 225, 86, 75, 439.95, BOUCLE('#ece6d6'), 'https://www.sklum.com/fr/acheter-canape-3-places/158700-canape-3-places-eracli-en-peau-de-mouton.html', { query: 'canapé bouclé 3 places' }),
  BR('Sklum', 'salon', 'canape', 'Shirina', 'Canapé 3 places bouclé beige', 230, 100, 67, 739.95, BOUCLE('#c9b89e'), 'https://www.sklum.com/fr/acheter-canape-3-places/198288-canape-3-places-shirina-en-tissu-boucle.html', { query: 'canapé bouclé beige' }),
  BR('Sklum', 'salon', 'canape', 'Yervin', 'Canapé 3 places aluminium et bouclé', 190, 84, 71, 419.95, BOUCLE('#e0d7c6'), 'https://www.sklum.com/fr/acheter-canape-3-places/173684-canape-3-places-en-aluminium-et-tissu-boucle-yervin.html', { query: 'canapé bouclé aluminium' }),
  BR('Sklum', 'salon', 'canape', 'Cardea', 'Canapé modulaire 3 pièces bouclé', 288, 96, 68, 1269.85, P('sofa', { seats: 3, kind: 'bouclette', color: '#d8cdb9' }), 'https://www.sklum.com/fr/acheter-canapes-modulables-3-places/191482-canape-modulaire-3-pieces-en-tissu-boucle-cardea.html', { query: 'canapé modulaire bouclé' }),
  BR('Sklum', 'salon', 'canape', 'Famara', 'Canapé 3 places rotin et acacia', 195, 82, 84, 449.95, P('sofa', { seats: 3, kind: 'lin', color: '#d8cdb9' }), 'https://www.sklum.com/fr/acheter-canape-3-places/180665-canape-3-places-en-rotin-et-bois-d-acacia-famara.html', { query: 'canapé rotin acacia' }),
  BR('Miliboo', 'salon', 'canape', 'Oslo 3 places', 'Canapé scandinave gris clair et bois', 179, 80, 81, 479.99, P('sofa', { seats: 3, color: '#b4b4b0' }), 'https://www.miliboo.com/canape-scandinave-3-places-gris-clair-pieds-bois-oslo-40650.html', { query: 'canapé scandinave 3 places' }),
  BR('Miliboo', 'salon', 'canape', 'Pure', 'Canapé scandinave 3 places', 190, 76, 80, 359.99, P('sofa', { seats: 3, color: '#b4b4b0' }), 'https://www.miliboo.com/canape-scandinave-3-places-gris-bois-pure-48747.html', { query: 'canapé scandinave gris' }),
  BR('Miliboo', 'salon', 'canape', 'Moon', 'Canapé scandinave 2 places beige', 123, 69, 80, 319.99, P('sofa', { seats: 2, color: '#c9b89e' }), 'https://www.miliboo.com/canape-scandinave-2-places-beige-moon-47524.html', { query: 'canapé 2 places beige' }),
  BR('Maisons du Monde', 'salon', 'table-basse', 'Ratane', 'Table basse ronde manguier et rotin', 70, 70, 43, 239.2, H('coffee_table_round_01'), 'https://www.maisonsdumonde.com/FR/fr/p/table-basse-ronde-en-bois-de-manguier-massif-et-rotin-beige-l70-ratane-220032.htm', { query: 'table basse ronde rotin' }),
  BR('Maisons du Monde', 'repas', 'table', 'Rhonda', 'Table ronde en chêne, 8 personnes', 150, 150, 75, 897, H('round_wooden_table_02'), 'https://www.maisonsdumonde.com/FR/fr/p/table-ronde-en-chene-rhonda-M22178913.htm', { query: 'table ronde chêne', note: 'Vendu par un partenaire de Maisons du Monde.' }),
  BR('Kave Home', 'repas', 'table', 'Cosgrove', 'Table 180 × 85 rotin et bois', 180, 85, 75, 355, H('wooden_table_02'), 'https://kavehome.com/fr/fr/tables-fixes/table-cosgrove-180x85-cm-en-rotin-naturel-et-bois', { query: 'table rotin bois' }),
  BR('Maisons du Monde', 'repas', 'chaise', 'Esta', 'Chaise frêne et cannage', 45, 49, 86, 139, P('chair', { woodKind: 'chene' }), 'https://www.maisonsdumonde.com/FR/fr/p/chaise-en-bois-de-frene-cannage-en-rotin-esta-219774.htm', { query: 'chaise cannage' }),
  BR('Maisons du Monde', 'repas', 'chaise', 'Santa Fe', 'Chaise chêne et cannage', 52, 57, 85, 219, P('chair', { woodKind: 'clair' }), 'https://www.maisonsdumonde.com/FR/fr/p/chaise-en-chene-et-cannage-santa-fe-219071.htm', { query: 'chaise chêne cannage' }),
  BR('Sklum', 'repas', 'chaise', 'Lali', 'Chaise frêne et rotin', 45, 50, 82, 174.95, P('chair', { woodKind: 'noyer' }), 'https://www.sklum.com/fr/acheter-chaises-salle-a-manger/118271-chaise-de-salle-a-manger-en-bois-de-style-lali.html', { query: 'chaise frêne rotin' }),
  BR('Sklum', 'repas', 'chaise', 'Tento', 'Chaise en rotin', 46.5, 67, 82.5, 189.95, P('chair', { woodKind: 'chene' }), 'https://www.sklum.com/fr/acheter-chaises-salle-a-manger/107177-chaise-de-salle-a-manger-en-rotin-style-tento.html', { query: 'chaise rotin' }),
  BR('Miliboo', 'repas', 'chaise', 'Walford', 'Chaise bois clair et noir', 52, 50, 75, 86.95, P('chair', { woodKind: 'clair' }), 'https://www.miliboo.com/chaise-bois-clair-et-pu-noir-design-scandinave-japonais-walford-40335.html', { query: 'chaise scandinave bois clair', id: 'b-miliboo-walford-lot-de-2', note: 'Vendue par lot de 2 à 173,89 € : le prix indiqué est celui d’une chaise.' }),
  BR('Maisons du Monde', 'repas', 'buffet', 'Bornéo', 'Buffet 2 portes cannage rotin', 95, 40, 120, 499, P('wardrobe', { doors: 2, woodKind: 'chene' }), 'https://www.maisonsdumonde.com/FR/fr/p/buffet-2-portes-cannage-en-rotin-borneo-229777.htm', { query: 'buffet cannage rotin' }),
  BR('Maisons du Monde', 'repas', 'buffet', 'Himalaya', 'Buffet manguier sculpté L90', 90, 40, 90, 479, P('wardrobe', { doors: 2, woodKind: 'noyer' }), 'https://www.maisonsdumonde.com/FR/fr/p/buffet-2-portes-en-bois-de-manguier-massif-sculpte-l90-himalaya-186069.htm', { query: 'buffet manguier' }),
];

const SUB_LABELS = { canape: 'Canapés', fauteuil: 'Fauteuils', 'table-basse': 'Tables basses', 'meuble-tv': 'Meubles TV', bibliotheque: 'Bibliothèques', table: 'Tables', chaise: 'Chaises', buffet: 'Buffets', tabouret: 'Tabourets', lit: 'Lits', matelas: 'Matelas', chevet: 'Chevets', armoire: 'Armoires', commode: 'Commodes', bureau: 'Bureaux', siege: 'Sièges', meuble: 'Meubles', plan: 'Plans de travail', evier: 'Éviers', electro: 'Électroménager', ilot: 'Îlots', 'meuble-vasque': 'Meubles vasque', 'miroir-sdb': 'Armoires miroir', 'rangement-sdb': 'Rangements', tapis: 'Tapis', rideau: 'Rideaux', suspension: 'Suspensions', lampadaire: 'Lampadaires', lampe: 'Lampes', miroir: 'Miroirs', cadre: 'Cadres', plante: 'Plantes', coussin: 'Coussins', vase: 'Vases', rangement: 'Rangements', baignoire: 'Baignoires', douche: 'Douches', wc: 'WC', radiateur: 'Radiateurs', tv: 'Téléviseurs', objet: 'Objets', 'lit-enfant': 'Lits enfant', 'rangement-enfant': 'Rangements', 'table-ext': 'Tables', 'chaise-ext': 'Assises', escalier: 'Escaliers', terrasse: 'Terrasses', pergola: 'Pergolas', piscine: 'Piscines', plantation: 'Plantations', cloture: 'Clôtures', mobilier: 'Mobilier', cheminee: 'Chauffage', balcon: 'Balcons et terrasses', 'garde-corps': 'Garde-corps', soutenement: 'Soutènements', marches: 'Marches' };
export const subLabel = (s) => SUB_LABELS[s] || s;

const ikeaItems = ikea.filter((x) => x.sub !== 'facade' && x.price > 0).map(fromIkea);
let items = [...BRANDS, ...ikeaItems, ...GENERIC];
const seen = new Set();
items = items.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));

let custom = [];
const byId = new Map(items.map((i) => [i.id, i]));
export function setCustom(list) {
  custom = list || [];
  for (const c of custom) byId.set(c.id, c);
}
export const allItems = () => [...items, ...custom];
export const getItem = (id) => byId.get(id);
/** Prix d'un article posé : une terrasse, une haie ou une clôture suit sa taille réelle. */
export function itemPrice(it, def) {
  const p = def.price || 0;
  if (def.priceBy === 'area') return p * (((it.w ?? def.w) * (it.d ?? def.d)) / (def.w * def.d));
  if (def.priceBy === 'length') return p * ((it.w ?? def.w) / def.w);
  return p;
}
export const catalogStats = () => ({ ikea: ikeaItems.length, total: items.length });
export const isHerStyle = (i) => !['IKEA', 'Générique'].includes(i.brand) && i.cat !== 'perso';

/** Liens d'achat : la fiche produit exacte en premier, puis des recherches d'équivalents. */
export function purchaseLinks(item) {
  const out = [];
  if (item.url) out.push({ label: `Voir sur ${item.brand === 'Générique' ? 'la boutique' : item.brand}`, url: item.url, primary: true });
  const similar = item.shops || (item.cat === 'cuisine' || item.cat === 'sdb' ? ['leroy', 'casto', 'mdm', 'google'] : ['sklum', 'mdm', 'kave', 'westwing', 'miliboo', 'google', 'leboncoin']);
  const list = similar.filter((s) => SHOP_NAMES[s] !== item.brand);
  list.forEach((s, i) => out.push({ label: SHOP_NAMES[s], url: SHOPS[s](item.query || item.name), primary: !item.url && i === 0 }));
  if (!item.url && !similar.includes('leboncoin') && item.price < 3000) out.push({ label: SHOP_NAMES.leboncoin, url: SHOPS.leboncoin(item.query || item.name) });
  return out;
}

export const DOOR_TYPES = ['door', 'entry', 'sliding-door', 'pocket', 'double', 'garage', 'passage'];
export const isDoorType = (t) => DOOR_TYPES.includes(t);

const D = (name, width, height = 204, extra = {}) => ({ group: 'Portes', type: 'door', name, width, height, sill: 0, ...extra });
const W = (name, width, height, sill, type = 'window2', extra = {}) => ({ group: 'Fenêtres', type, name, width, height, sill, ...extra });
const B_ = (name, width, height = 215, extra = {}) => ({ group: 'Baies vitrées', type: 'bay', name, width, height, sill: 0, ...extra });

export const OPENINGS = [
  B_('Porte-fenêtre', 140, 215, { type: 'window2' }),
  B_('Baie 2,40 m', 240), B_('Baie 2,80 m', 280), B_('Baie 3 m', 300), B_('Grande baie 4 m', 400), B_('Grande baie 5 m', 500), B_('Très grande baie 6 m', 600),
  B_('Baie toute hauteur 3 m', 300, 245, { full: true }), B_('Baie toute hauteur 5 m', 500, 245, { full: true }),
  B_('Mur vitré 4 m', 400, 245, { type: 'glasswall', full: true }), B_('Mur vitré 6 m', 600, 245, { type: 'glasswall', full: true }),
  D('Porte intérieure 73', 73), D('Porte intérieure 83', 83), D('Porte large 93', 93), D('Porte vitrée', 83, 204, { glazed: true }),
  D('Porte double', 146, 204, { type: 'double' }), D('Porte double vitrée', 166, 215, { type: 'double', glazed: true }),
  D('Porte coulissante', 83, 204, { type: 'sliding-door' }), D('Porte à galandage', 83, 204, { type: 'pocket' }),
  D("Porte d'entrée", 100, 215, { type: 'entry' }), D("Grande porte d'entrée", 125, 225, { type: 'entry' }), D("Porte d'entrée double", 160, 225, { type: 'entry', leaves: 2 }),
  D('Passage ouvert', 120, 215, { type: 'passage' }), D('Grand passage', 240, 225, { type: 'passage' }),
  D('Porte de garage 2,40 m', 240, 200, { type: 'garage' }), D('Porte de garage 3 m', 300, 215, { type: 'garage' }), D('Porte de garage double 5 m', 500, 215, { type: 'garage' }),
  W('Fenêtre 1 vantail', 60, 115, 100, 'window1'), W('Petite fenêtre', 45, 60, 130, 'window1'), W('Fenêtre 2 vantaux', 120, 135, 90), W('Fenêtre 2 vantaux large', 140, 135, 90), W('Fenêtre 3 vantaux', 180, 135, 90, 'bay'),
  W('Fenêtre haute', 200, 50, 190, 'fixed'), W('Bandeau vitré', 300, 60, 150, 'glasswall'), W('Fenêtre fixe', 100, 100, 110, 'fixed'), W('Fenêtre carrée', 60, 60, 120, 'fixed'),
  W('Verrière atelier', 200, 150, 90, 'atelier'), W('Verrière toute hauteur', 240, 215, 0, 'atelier'),
];
