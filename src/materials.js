// Matières 3D : sols, murs, façades, toitures, tissus — avec textures PBR (CC0, Poly Haven).
import * as THREE from 'three';
import { FABRICS, WOODS, materialInfo } from './materials-data.js';
import { LOW } from './quality.js';

export * from './materials-data.js';

const loader = new THREE.TextureLoader();
const texCache = new Map();
let anisotropy = 4;
let onTexture = () => {};
export function configureTextures(a, cb) { anisotropy = a; onTexture = cb; }

function loadTex(dir, name, srgb) {
  const key = `${dir}/${name}`;
  if (texCache.has(key)) return texCache.get(key);
  const url = `./${LOW ? 'textures-s' : 'textures'}/${key}.webp`;
  const ready = () => { for (const c of t.userData.clones || []) c.needsUpdate = true; t.userData.clones = null; onTexture(); };
  const retry = (n) => loader.load(url, (r) => { t.image = r.image; t.needsUpdate = true; ready(); }, undefined, () => { if (n < 3) setTimeout(() => retry(n + 1), 1200 * n); });
  const t = loader.load(url, ready, undefined, () => setTimeout(() => retry(1), 1200));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function scaled(tex, s) {
  const c = tex.clone();
  c.repeat.set(1 / s, 1 / s);
  // Image pas encore arrivée : la copie sera prévenue au chargement, sans avertissement à chaque image.
  if (tex.image?.width) c.needsUpdate = true; else (tex.userData.clones ||= []).push(c);
  return c;
}

const matCache = new Map();

/** Matière texturée : l'UV des maillages est en mètres, `s` règle l'échelle. */
export function texturedMaterial(dir, s, opts = {}) {
  const key = `${dir}|${s}|${opts.tint || ''}|${opts.roughness ?? ''}|${opts.gain ?? ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: scaled(loadTex(dir, 'diff', true), s),
    normalMap: scaled(loadTex(dir, 'nor', false), s),
    roughnessMap: LOW ? null : scaled(loadTex(dir, 'rough', false), s),
    roughness: opts.roughness ?? (LOW ? 0.8 : 1),
    metalness: 0,
    color: opts.tint ? new THREE.Color(opts.tint).multiplyScalar(opts.gain ?? 1) : 0xffffff,
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
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(info.hex), roughness: 0.78, metalness: 0, normalMap: scaled(loadTex('clay_plaster', 'nor', false), 1.4) });
    // Un enduit peint n'est jamais parfaitement lisse : ce léger grain accroche la lumière rasante.
    m.normalScale.set(0.14, 0.14);
    matCache.set(id, m);
  } else if (info?.t) {
    m = texturedMaterial(info.t, info.s, { tint: info.tint, gain: info.gain });
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
    roughnessMap: LOW ? null : scaled(loadTex(f.t, 'rough', false), f.s),
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
    roughnessMap: LOW ? null : scaled(loadTex(dir, 'rough', false), 0.9),
    roughness: LOW ? 0.7 : 0.85,
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
