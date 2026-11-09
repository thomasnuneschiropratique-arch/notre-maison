// Bibliothèque de matières : sols, murs, façades, toitures, tissus — avec textures PBR (CC0, Poly Haven).
import * as THREE from 'three';

const q = encodeURIComponent;
const lm = (s) => `https://www.leroymerlin.fr/recherche=${q(s)}`;
const casto = (s) => `https://www.castorama.fr/search?term=${q(s)}`;

// t : dossier de texture · s : taille réelle d'une répétition (m) · price : ordre de grandeur €/m²
export const FLOORS = [
  { id: 'oak_natural', name: 'Parquet chêne naturel', t: 'wood_floor', s: 2.2, price: 46, buy: 'parquet contrecollé chêne naturel' },
  { id: 'oak_light', name: 'Parquet chêne clair', t: 'oak_wood_planks', s: 2.2, price: 52, buy: 'parquet contrecollé chêne clair' },
  { id: 'herringbone', name: 'Point de Hongrie', t: 'herringbone_parquet', s: 1.6, price: 78, buy: 'parquet point de hongrie chêne' },
  { id: 'rect_parquet', name: 'Parquet à bâtons', t: 'rectangular_parquet', s: 1.6, price: 64, buy: 'parquet bâton rompu chêne' },
  { id: 'diag_parquet', name: 'Parquet en diagonale', t: 'diagonal_parquet', s: 1.6, price: 70, buy: 'parquet chêne' },
  { id: 'dark_planks', name: 'Parquet foncé', t: 'dark_wooden_planks', s: 2.4, price: 55, buy: 'parquet chêne fumé' },
  { id: 'laminate_a', name: 'Stratifié clair', t: 'laminate_floor_02', s: 2.4, price: 15, buy: 'sol stratifié chêne clair' },
  { id: 'laminate_b', name: 'Stratifié gris', t: 'laminate_floor_03', s: 2.4, price: 15, buy: 'sol stratifié gris' },
  { id: 'tile_grey_large', name: 'Grand carrelage gris', t: 'large_grey_tiles', s: 2.4, price: 32, buy: 'carrelage grand format gris' },
  { id: 'tile_grey', name: 'Carrelage gris', t: 'grey_tiles', s: 1.6, price: 26, buy: 'carrelage sol gris' },
  { id: 'tile_marble', name: 'Carrelage effet marbre', t: 'marble_tiles', s: 1.6, price: 42, buy: 'carrelage effet marbre blanc' },
  { id: 'mosaic_marble', name: 'Mosaïque de marbre', t: 'marble_mosaic_tiles', s: 0.8, price: 69, buy: 'mosaïque marbre' },
  { id: 'marble', name: 'Marbre', t: 'marble_01', s: 2.5, price: 95, buy: 'dalle marbre' },
  { id: 'tile_terracotta', name: 'Tomettes en terre cuite', t: 'terracotta_floor_tiles', s: 1.4, price: 45, buy: 'tomette terre cuite' },
  { id: 'tile_cement', name: 'Carreaux de ciment', t: 'floor_tiles_06', s: 1.2, price: 58, buy: 'carreau de ciment' },
  { id: 'tile_08', name: 'Carrelage à motif', t: 'floor_tiles_08', s: 1.2, price: 38, buy: 'carrelage motif' },
  { id: 'terrazzo', name: 'Terrazzo', t: 'terrazzo_tiles', s: 1.6, price: 62, buy: 'carrelage terrazzo' },
  { id: 'concrete_floor', name: 'Béton ciré', t: 'concrete_floor_02', s: 3, price: 40, buy: 'béton ciré sol' },
  { id: 'concrete_tiles', name: 'Dalles de béton', t: 'concrete_tiles', s: 2, price: 30, buy: 'carrelage effet béton' },
  { id: 'carpet', name: 'Moquette', t: 'dirty_carpet', s: 1.5, price: 18, buy: 'moquette' },
  { id: 'deck_wood', name: 'Terrasse bois', t: 'wood_floor_deck', s: 2.4, price: 50, buy: 'lame de terrasse bois' },
  { id: 'pavers', name: 'Pavés extérieurs', t: 'square_pavers', s: 1.8, price: 35, buy: 'dalle terrasse pavé' },
];

// Couleurs de peinture : teintes approchées de nuanciers réels, à confirmer sur échantillon.
export const PAINTS = [
  { id: 'paint_blanc', name: 'Blanc pur', brand: 'Standard', hex: '#f3f1ec' },
  { id: 'paint_all_white', name: 'All White', brand: 'Farrow & Ball', hex: '#f1ece1' },
  { id: 'paint_wimborne', name: 'Wimborne White', brand: 'Farrow & Ball', hex: '#ece6d6' },
  { id: 'paint_skimming', name: 'Skimming Stone', brand: 'Farrow & Ball', hex: '#d6cfc3' },
  { id: 'paint_elephant', name: "Elephant's Breath", brand: 'Farrow & Ball', hex: '#b9ad9d' },
  { id: 'paint_setting', name: 'Setting Plaster', brand: 'Farrow & Ball', hex: '#dcbba8' },
  { id: 'paint_sulking', name: 'Sulking Room Pink', brand: 'Farrow & Ball', hex: '#b58a80' },
  { id: 'paint_mizzle', name: 'Mizzle', brand: 'Farrow & Ball', hex: '#a3a795' },
  { id: 'paint_green_smoke', name: 'Green Smoke', brand: 'Farrow & Ball', hex: '#6a7468' },
  { id: 'paint_stiffkey', name: 'Stiffkey Blue', brand: 'Farrow & Ball', hex: '#3b4f5e' },
  { id: 'paint_hague', name: 'Hague Blue', brand: 'Farrow & Ball', hex: '#2b3a44' },
  { id: 'paint_railings', name: 'Railings', brand: 'Farrow & Ball', hex: '#3b3e42' },
  { id: 'paint_lin', name: 'Lin clair', brand: 'Nuancier courant', hex: '#e2d8c6' },
  { id: 'paint_argile', name: 'Argile', brand: 'Nuancier courant', hex: '#c7a68c' },
  { id: 'paint_terracotta', name: 'Terracotta', brand: 'Nuancier courant', hex: '#b5694a' },
  { id: 'paint_ocre', name: 'Ocre', brand: 'Nuancier courant', hex: '#c99a4d' },
  { id: 'paint_sauge', name: 'Vert sauge', brand: 'Nuancier courant', hex: '#9aa58d' },
  { id: 'paint_foret', name: 'Vert forêt', brand: 'Nuancier courant', hex: '#3f4f43' },
  { id: 'paint_gris_perle', name: 'Gris perle', brand: 'Nuancier courant', hex: '#c9c9c4' },
  { id: 'paint_anthracite', name: 'Anthracite', brand: 'Nuancier courant', hex: '#44474a' },
];

export const WALL_FINISHES = [
  { id: 'wall_beton', name: 'Béton ciré mural', t: 'concrete_floor_02', s: 3, price: 40, buy: 'béton ciré mur' },
  { id: 'wall_chaux', name: 'Enduit à la chaux', t: 'clay_plaster', s: 2.5, price: 28, buy: 'enduit chaux décoratif' },
  { id: 'wall_argile', name: 'Enduit argile', t: 'patterned_clay_plaster', s: 2.5, price: 32, buy: 'enduit argile' },
  { id: 'wall_brique', name: 'Brique foraine', t: 'red_brick_03', s: 2, price: 55, buy: 'plaquette de parement brique' },
  { id: 'wall_brique2', name: 'Brique ancienne', t: 'brick_wall_001', s: 2, price: 55, buy: 'parement brique ancienne' },
  { id: 'wall_pierre', name: 'Pierre apparente', t: 'stone_wall', s: 3, price: 75, buy: 'parement pierre naturelle' },
  { id: 'wall_marbre', name: 'Faïence effet marbre', t: 'marble_tiles', s: 1.6, price: 42, buy: 'faïence effet marbre' },
  { id: 'wall_mosaique', name: 'Mosaïque', t: 'marble_mosaic_tiles', s: 0.8, price: 69, buy: 'mosaïque salle de bain' },
  { id: 'wall_carrelage', name: 'Carrelage gris', t: 'grey_tiles', s: 1.6, price: 26, buy: 'faïence grise' },
  { id: 'wall_bois', name: 'Lambris chêne', t: 'oak_veneer_01', s: 2, price: 45, buy: 'lambris chêne' },
];

export const FACADES = [
  { id: 'facade_enduit', name: 'Enduit blanc cassé', t: 'plastered_wall', s: 3, tint: '#efe9dc', price: 45 },
  { id: 'facade_ton_pierre', name: 'Enduit ton pierre', t: 'plastered_wall', s: 3, tint: '#d9c8ab', price: 45 },
  { id: 'facade_ocre', name: 'Enduit ocre', t: 'plastered_wall', s: 3, tint: '#cfa873', price: 45 },
  { id: 'facade_gris', name: 'Enduit gris', t: 'plastered_wall', s: 3, tint: '#a7a6a1', price: 45 },
  { id: 'facade_brique', name: 'Brique rouge d\'Albi', t: 'red_brick_03', s: 2, price: 110 },
  { id: 'facade_pierre', name: 'Pierre', t: 'stone_wall', s: 3, price: 150 },
  { id: 'facade_bois', name: 'Bardage bois', t: 'weathered_planks', s: 2.4, price: 85 },
  { id: 'facade_beton', name: 'Béton brut', t: 'concrete_tile_facade', s: 4, price: 90 },
];

export const ROOFS = [
  { id: 'roof_terracotta', name: 'Tuile canal terre cuite', t: 'clay_roof_tiles', s: 2.2 },
  { id: 'roof_terracotta2', name: 'Tuile romane', t: 'clay_roof_tiles_02', s: 2.2 },
  { id: 'roof_tile', name: 'Tuile brune', t: 'roof_tiles', s: 2.2 },
  { id: 'roof_grey', name: 'Tuile grise', t: 'grey_roof_tiles', s: 2.2 },
];

export const GROUNDS = [
  { id: 'grass', name: 'Pelouse', t: 'sparse_grass', s: 3.5, tint: '#a9c978' },
  { id: 'gravel', name: 'Gravier', t: 'gravelly_sand', s: 3 },
  { id: 'forest', name: 'Sous-bois', t: 'forrest_ground_01', s: 4 },
];

export const FABRICS = [
  { id: 'lin', name: 'Lin', t: 'rough_linen', s: 0.5 }, { id: 'velours', name: 'Velours', t: 'velour_velvet', s: 0.5 },
  { id: 'cuir', name: 'Cuir', t: 'fabric_leather_02', s: 0.6 }, { id: 'bouclette', name: 'Bouclette', t: 'wool_boucle', s: 0.3 }, { id: 'toile', name: 'Toile', t: 'denim_fabric', s: 0.4 },
];

export const WOODS = { chene: 'oak_veneer_02', clair: 'white_oak_veneer', noyer: 'mocha_oak_veneer', noir: 'black_oak_veneer', gris: 'grey_oak_veneer_01', pin: 'plywood' };

const ALL = [...FLOORS, ...WALL_FINISHES, ...FACADES, ...ROOFS, ...GROUNDS];
export const materialInfo = (id) => ALL.find((m) => m.id === id) || PAINTS.find((m) => m.id === id);
export const buyLinks = (label) => [{ shop: 'Leroy Merlin', url: lm(label) }, { shop: 'Castorama', url: casto(label) }];

const loader = new THREE.TextureLoader();
const texCache = new Map();
let anisotropy = 4;
let onTexture = () => {};
export function configureTextures(a, cb) { anisotropy = a; onTexture = cb; }

function loadTex(dir, name, srgb) {
  const key = `${dir}/${name}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = loader.load(`./textures/${key}.jpg`, () => onTexture(), undefined, () => {});
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function scaled(tex, s) {
  const c = tex.clone();
  c.repeat.set(1 / s, 1 / s);
  c.needsUpdate = true;
  return c;
}

const matCache = new Map();

/** Matière texturée : l'UV des maillages est en mètres, `s` règle l'échelle. */
export function texturedMaterial(dir, s, opts = {}) {
  const key = `${dir}|${s}|${opts.tint || ''}|${opts.roughness ?? ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: scaled(loadTex(dir, 'diff', true), s),
    normalMap: scaled(loadTex(dir, 'nor', false), s),
    roughnessMap: scaled(loadTex(dir, 'rough', false), s),
    roughness: opts.roughness ?? 1,
    metalness: 0,
    color: opts.tint ? new THREE.Color(opts.tint) : 0xffffff,
  });
  m.normalScale.set(0.7, 0.7);
  matCache.set(key, m);
  return m;
}

export function getMaterial(id) {
  if (matCache.has(id)) return matCache.get(id);
  const info = materialInfo(id);
  let m;
  if (info?.hex) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(info.hex), roughness: 0.82, metalness: 0 });
    matCache.set(id, m);
  } else if (info?.t) {
    m = texturedMaterial(info.t, info.s, { tint: info.tint });
  } else {
    m = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
  }
  return m;
}

export function solid(color, roughness = 0.6, metalness = 0, extra = {}) {
  const key = `solid|${color}|${roughness}|${metalness}|${JSON.stringify(extra)}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness, ...extra });
  matCache.set(key, m);
  return m;
}

export function fabric(color, kind = 'lin') {
  const key = `fabric|${color}|${kind}`;
  if (matCache.has(key)) return matCache.get(key);
  const f = FABRICS.find((x) => x.id === kind) || FABRICS[0];
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: 1, metalness: 0,
    normalMap: scaled(loadTex(f.t, 'nor', false), f.s),
    roughnessMap: scaled(loadTex(f.t, 'rough', false), f.s),
  });
  m.normalScale.set(0.9, 0.9);
  matCache.set(key, m);
  return m;
}

export function wood(kind = 'chene', tint) {
  const key = `wood|${kind}|${tint || ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const dir = WOODS[kind] || WOODS.chene;
  const m = new THREE.MeshStandardMaterial({
    map: scaled(loadTex(dir, 'diff', true), 0.9),
    normalMap: scaled(loadTex(dir, 'nor', false), 0.9),
    roughnessMap: scaled(loadTex(dir, 'rough', false), 0.9),
    roughness: 0.85,
    color: tint ? new THREE.Color(tint) : 0xffffff,
  });
  m.normalScale.set(0.35, 0.35);
  matCache.set(key, m);
  return m;
}

export const glass = () => {
  if (matCache.has('glass')) return matCache.get('glass');
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, ior: 1.5, thickness: 0.005, transparent: true, opacity: 0.18, envMapIntensity: 1.4 });
  matCache.set('glass', m);
  return m;
};

export const mirror = () => {
  if (matCache.has('mirror')) return matCache.get('mirror');
  const m = new THREE.MeshStandardMaterial({ color: 0xf2f4f4, roughness: 0.02, metalness: 1 });
  matCache.set('mirror', m);
  return m;
};

export const ceramic = () => solid('#f5f4f0', 0.08, 0);
export const chrome = () => solid('#d9dadb', 0.12, 1);
export const blackMetal = () => solid('#1f2022', 0.42, 0.85);
export const brass = () => solid('#b08d57', 0.3, 1);

export function emissive(color = '#ffe2b8', intensity = 6) {
  return solid('#ffffff', 0.5, 0, { emissive: new THREE.Color(color), emissiveIntensity: intensity });
}

/** Détermine une matière plausible d'après la couleur relevée sur la fiche produit. */
export function finishFromColor(hex, slug = '') {
  if (/chene|hetre/.test(slug)) return wood(/blanchi/.test(slug) ? 'clair' : 'chene');
  if (/noyer/.test(slug)) return wood('noyer');
  if (/pin|bambou|acacia|frene|bois/.test(slug)) return wood('chene', /teinte-blanc/.test(slug) ? '#efe9dd' : undefined);
  if (/brun-noir/.test(slug)) return wood('noir');
  return solid(hex || '#e9e6df', 0.45);
}
