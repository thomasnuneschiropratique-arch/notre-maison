// Bibliothèque de matières : données seules (noms, prix, textures), sans moteur 3D, pour un démarrage léger.
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
  { id: 'dalle_pierre', name: 'Grandes dalles de pierre', t: 'large_sandstone_blocks', s: 3, price: 85, buy: 'dalle pierre naturelle' },
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
  { id: 'wall_noyer', name: 'Lambris noyer', t: 'american_walnut_veneer', s: 2, tint: '#d7a877', gain: 1.15, price: 70, buy: 'lambris noyer' },
  { id: 'wall_pierre_blonde', name: 'Pierre blonde', t: 'rustic_stone_wall', s: 1.8, tint: '#f1e4cf', gain: 1.35, price: 90, buy: 'parement pierre naturelle' },
  { id: 'wall_marbre_vert', name: 'Marbre vert', t: 'marble_01', s: 2.5, tint: '#4f6b52', price: 140, buy: 'marbre vert' },
  { id: 'wall_bois', name: 'Lambris chêne', t: 'oak_veneer_01', s: 2, price: 45, buy: 'lambris chêne' },
];

export const FACADES = [
  { id: 'facade_enduit', name: 'Enduit blanc cassé', t: 'plastered_wall', s: 3, tint: '#efe9dc', price: 45 },
  { id: 'facade_ton_pierre', name: 'Enduit ton pierre', t: 'plastered_wall', s: 3, tint: '#d9c8ab', price: 45 },
  { id: 'facade_ocre', name: 'Enduit ocre', t: 'plastered_wall', s: 3, tint: '#cfa873', price: 45 },
  { id: 'facade_gris', name: 'Enduit gris', t: 'plastered_wall', s: 3, tint: '#a7a6a1', price: 45 },
  { id: 'facade_brique', name: 'Brique rouge toulousaine', t: 'red_brick_03', s: 2, price: 110 },
  { id: 'facade_pierre_blonde', name: 'Pierre blonde appareillée', t: 'white_sandstone_bricks', s: 3.2, tint: '#f6ead6', gain: 2.2, price: 175 },
  { id: 'facade_brique_blonde', name: 'Brique blonde', t: 'yellow_bricks', s: 2, price: 130 },
  { id: 'facade_pierre', name: 'Pierre', t: 'stone_wall', s: 3, price: 150 },
  { id: 'facade_bois', name: 'Bardage bois', t: 'weathered_planks', s: 2.4, price: 85 },
  { id: 'facade_beton', name: 'Béton brut', t: 'concrete_tile_facade', s: 4, price: 90 },
  { id: 'facade_travertin', name: 'Travertin en grands panneaux', t: 'large_sandstone_blocks', s: 3.4, tint: '#f6eee2', gain: 2.6, price: 230 },
];

export const ROOFS = [
  { id: 'roof_terracotta', name: 'Tuile canal terre cuite', t: 'clay_roof_tiles', s: 2.2 },
  { id: 'roof_terracotta2', name: 'Tuile romane', t: 'clay_roof_tiles_02', s: 2.2 },
  { id: 'roof_tile', name: 'Tuile brune', t: 'roof_tiles', s: 2.2 },
  { id: 'roof_ardoise', name: 'Ardoise', t: 'roof_slates_02', s: 2.2, tint: '#6b7077', gain: 0.8 },
  { id: 'roof_grey', name: 'Tuile grise', t: 'grey_roof_tiles', s: 2.2 },
];

export const GROUNDS = [
  { id: 'grass', name: 'Pelouse', t: 'sparse_grass', s: 3.5, tint: '#93d858', gain: 2.3 },
  { id: 'gravel', name: 'Gravier', t: 'gravelly_sand', s: 3, tint: '#cfcabf' },
  { id: 'forest', name: 'Sous-bois', t: 'forrest_ground_01', s: 4 },
  { id: 'prairie', name: 'Prairie', t: 'sparse_grass', s: 3.5, tint: '#c6cf72', gain: 1.5 },
  { id: 'terre', name: 'Terre', t: 'brown_mud_dry', s: 4 },
  { id: 'roche', name: 'Roche', t: 'rocky_terrain_02', s: 5 },
  { id: 'sable', name: 'Sable', t: 'coast_sand_01', s: 4 },
  { id: 'sec', name: 'Sol sec', t: 'dry_ground_01', s: 4 },
  { id: 'neige', name: 'Neige', t: 'snow_02', s: 4 },
];

export const FABRICS = [
  { id: 'lin', name: 'Lin', t: 'rough_linen', s: 0.5 }, { id: 'velours', name: 'Velours', t: 'velour_velvet', s: 0.5 },
  { id: 'cuir', name: 'Cuir', t: 'fabric_leather_02', s: 0.6 }, { id: 'bouclette', name: 'Bouclette', t: 'wool_boucle', s: 0.3 }, { id: 'toile', name: 'Toile', t: 'denim_fabric', s: 0.4 },
];

export const WOODS = { chene: 'oak_veneer_02', clair: 'white_oak_veneer', noyer: 'mocha_oak_veneer', noir: 'black_oak_veneer', gris: 'grey_oak_veneer_01', pin: 'plywood' };

const ALL = [...FLOORS, ...WALL_FINISHES, ...FACADES, ...ROOFS, ...GROUNDS];
export const materialInfo = (id) => ALL.find((m) => m.id === id) || PAINTS.find((m) => m.id === id);
export const buyLinks = (label) => [{ shop: 'Leroy Merlin', url: lm(label) }, { shop: 'Castorama', url: casto(label) }];
