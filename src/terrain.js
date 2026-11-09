// Relief du terrain : grille de hauteurs modifiable, formes prêtes, pinceaux. Données seules, sans moteur 3D.
export const T_SIZE = 120, T_N = 121; // 120 m de côté, un point par mètre

const enc = (typed) => {
  const b = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
  return btoa(s);
};
const dec = (str, Type) => {
  const s = atob(str), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return new Type(b.buffer);
};

const memo = new WeakMap();

/** Hauteurs décodées (cm) ; `null` si le terrain est resté plat. */
export function terrainOf(project) {
  const t = project.site?.terrain;
  if (!t) return null;
  let m = memo.get(t);
  if (!m || m.src !== t.h) {
    m = { src: t.h, h: dec(t.h, Int16Array), p: t.p ? dec(t.p, Uint8Array) : new Uint8Array(T_N * T_N), cx: t.cx, cy: t.cy };
    memo.set(t, m);
  }
  return m;
}

/** Crée le terrain au besoin, centré sur la maison. */
export function ensureTerrain(project) {
  if (!project.site.terrain) {
    const pts = project.levels.flatMap((l) => Object.values(l.nodes));
    const c = pts.length ? { x: (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2, y: (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2 } : { x: 0, y: 0 };
    project.site.terrain = { cx: Math.round(c.x), cy: Math.round(c.y), h: enc(new Int16Array(T_N * T_N)) };
  }
  return terrainOf(project);
}

/** Enregistre dans le projet ce que les pinceaux ont modifié. */
export function commitTerrain(project) {
  const t = project.site.terrain, m = terrainOf(project);
  t.h = enc(m.h); m.src = t.h;
  if (m.p.some((v) => v)) t.p = enc(m.p); else delete t.p;
}

/** Hauteur du terrain en mètres à un point du plan (cm). */
export function heightAt(m, x, y) {
  if (!m) return 0;
  const half = (T_N - 1) / 2;
  const gx = Math.max(0, Math.min(T_N - 1.001, (x - m.cx) / 100 + half)), gy = Math.max(0, Math.min(T_N - 1.001, (y - m.cy) / 100 + half));
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const h = m.h, a = h[j * T_N + i], b = h[j * T_N + i + 1], c = h[(j + 1) * T_N + i], d = h[(j + 1) * T_N + i + 1];
  return (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy) / 100;
}

const fract = (x) => x - Math.floor(x);
const rnd = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), f = smooth(x - i), g = smooth(y - j);
  return (rnd(i, j) * (1 - f) + rnd(i + 1, j) * f) * (1 - g) + (rnd(i, j + 1) * (1 - f) + rnd(i + 1, j + 1) * f) * g;
}
export function fbm(x, y, octaves = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < octaves; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2; } return s; }

export const TERRAIN_SHAPES = [
  ['flat', 'Plat'], ['gentle', 'Pente douce'], ['slope', 'Pente marquée'], ['steep', 'Forte pente'], ['hilltop', 'Sommet de colline'], ['ridge', 'Crête'], ['valley', 'Fond de vallée'], ['terraces', 'Restanques'], ['natural', 'Relief naturel'], ['cliff', 'Bord de falaise'],
];
export const SLOPE_DEFAULT = { gentle: 10, slope: 22, steep: 38, cliff: 8, terraces: 25 };
export const DIRECTIONS = [['0', 'Nord'], ['45', 'Nord-est'], ['90', 'Est'], ['135', 'Sud-est'], ['180', 'Sud'], ['225', 'Sud-ouest'], ['270', 'Ouest'], ['315', 'Nord-ouest']];

/** Remplace le relief par une forme type ; `dir` indique où descend la pente (0 = nord, 90 = est). */
export function shapeTerrain(project, kind, { dir = 180, pct } = {}) {
  const m = ensureTerrain(project), half = (T_N - 1) / 2;
  const rad = (dir * Math.PI) / 180, dx = Math.sin(rad), dy = -Math.cos(rad);
  const p = (pct ?? SLOPE_DEFAULT[kind] ?? 20) / 100;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = i - half, y = j - half, along = x * dx + y * dy, r = Math.hypot(x, y);
    let v = 0;
    if (kind === 'gentle' || kind === 'slope' || kind === 'steep') v = -along * p + (fbm(x * 0.04 + 7, y * 0.04) - 0.47) * 1.2;
    if (kind === 'hilltop') v = 14 * Math.exp(-(r * r) / (2 * 34 * 34)) - 14;
    if (kind === 'ridge') { const across = -x * dy + y * dx; v = 10 * Math.exp(-(across * across) / (2 * 22 * 22)) - 10 - along * 0.03; }
    if (kind === 'valley') v = Math.min(14, (r * r) / 260);
    if (kind === 'terraces') { const step = 3.2, run = step / p; v = -Math.round(along / run) * step + -(along - Math.round(along / run) * run) * 0.05; }
    if (kind === 'natural') v = (fbm(x * 0.035 + 3, y * 0.035 + 9, 5) - 0.47) * 12;
    if (kind === 'cliff') { const e = along - 18; v = -along * p - 16 * smooth(Math.max(0, Math.min(1, e / 7))); }
    m.h[j * T_N + i] = Math.round(v * 100);
  }
  commitTerrain(project);
}

export const BRUSHES = [['raise', 'Monter'], ['lower', 'Creuser'], ['smooth', 'Lisser'], ['flatten', 'Aplatir'], ['paint', 'Peindre']];

/** Un coup de pinceau au point (cm). `target` fixe la hauteur à atteindre pour « Aplatir ». */
export function applyBrush(m, x, y, { mode, radius, strength, target, ground }) {
  const half = (T_N - 1) / 2, cx = (x - m.cx) / 100 + half, cy = (y - m.cy) / 100 + half;
  const r = Math.ceil(radius), s = strength;
  const orig = mode === 'smooth' ? m.h.slice() : null;
  for (let j = Math.max(0, Math.floor(cy) - r); j <= Math.min(T_N - 1, Math.ceil(cy) + r); j++) {
    for (let i = Math.max(0, Math.floor(cx) - r); i <= Math.min(T_N - 1, Math.ceil(cx) + r); i++) {
      const d = Math.hypot(i - cx, j - cy) / radius;
      if (d >= 1) continue;
      const w = smooth(1 - d), k = j * T_N + i;
      if (mode === 'raise') m.h[k] += 18 * s * w;
      if (mode === 'lower') m.h[k] -= 18 * s * w;
      if (mode === 'flatten') m.h[k] += (target * 100 - m.h[k]) * Math.min(1, 0.4 * s * w);
      if (mode === 'paint' && d < 0.85) m.p[k] = ground + 1;
      if (mode === 'smooth' && i > 0 && j > 0 && i < T_N - 1 && j < T_N - 1) {
        const avg = (orig[k - 1] + orig[k + 1] + orig[k - T_N] + orig[k + T_N] + orig[k]) / 5;
        m.h[k] += (avg - m.h[k]) * Math.min(1, 0.7 * s * w);
      }
    }
  }
}

/** Altitude du sol du niveau d'entrée, et bases de chaque niveau (m). */
export function levelBase(project, index) {
  const lv = project.levels, e = project.entry || 0;
  let y = (project.site.altitude || 0) + 0.05;
  if (index >= e) for (let i = e; i < index; i++) y += (lv[i].height + lv[i].slab) / 100;
  else for (let i = index; i < e; i++) y -= (lv[i].height + lv[i].slab) / 100;
  return y;
}

function outline(project, level) {
  return level.walls.flatMap((w) => {
    const a = level.nodes[w.a], b = level.nodes[w.b]; if (!a || !b) return [];
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 100));
    return Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }));
  });
}

/** Pose le niveau d'entrée juste au-dessus du point le plus haut du terrain sous la maison. */
export function seatHouse(project) {
  const m = terrainOf(project); if (!m) return;
  const level = project.levels[project.entry || 0], pts = outline(project, level);
  if (pts.length) project.site.altitude = Math.round(Math.max(...pts.map((p) => heightAt(m, p.x, p.y))) * 100) / 100;
}

/** Point le plus haut du terrain sous le niveau d'entrée (m), ou null sans terrain. */
export function groundTop(project) {
  const m = terrainOf(project); if (!m) return null;
  const pts = outline(project, project.levels[project.entry || 0]);
  return pts.length ? Math.max(...pts.map((p) => heightAt(m, p.x, p.y))) : null;
}

/** Aplanit le terrain autour de la maison à la hauteur `alt` (m), en raccordant sur `margin` mètres. */
export function flattenAround(project, alt, margin = 5) {
  const m = ensureTerrain(project), half = (T_N - 1) / 2, level = project.levels[project.entry || 0], pts = outline(project, level);
  if (!pts.length) return;
  for (let j = 0; j < T_N; j++) for (let i = 0; i < T_N; i++) {
    const x = (i - half) * 100 + m.cx, y = (j - half) * 100 + m.cy;
    let d = Infinity;
    for (const p of pts) d = Math.min(d, Math.hypot(p.x - x, p.y - y) / 100);
    if (d >= margin) continue;
    const w = smooth(1 - d / margin), k = j * T_N + i;
    m.h[k] += (alt * 100 - m.h[k]) * w;
  }
  commitTerrain(project);
}

export const ENVIRONMENTS = [
  { id: 'campagne', name: 'Campagne', far: '#7f9358', hills: 28, trees: 260, tree: '#4c6a35' },
  { id: 'foret', name: 'Forêt', far: '#46603a', hills: 34, trees: 900, tree: '#34512c' },
  { id: 'montagne', name: 'Montagne', far: '#74806a', hills: 320, trees: 420, tree: '#3c5634', snow: true },
  { id: 'mer', name: 'Bord de mer', far: '#a59d78', hills: 12, trees: 90, tree: '#5b7040', sea: -38 },
  { id: 'lac', name: 'Bord de lac', far: '#708a50', hills: 46, trees: 300, tree: '#476537', lake: true, sea: -16 },
  { id: 'garrigue', name: 'Garrigue', far: '#a89c70', hills: 44, trees: 200, tree: '#6d7a4a' },
  { id: 'ville', name: 'Ville', far: '#8d8b80', hills: 6, trees: 60, tree: '#4c6a35', city: true },
  { id: 'neige', name: 'Sous la neige', far: '#eef0f2', hills: 90, trees: 260, tree: '#59685a' },
  { id: 'plaine', name: 'Plaine dégagée', far: '#94a463', hills: 3, trees: 30, tree: '#4c6a35' },
];
export const environmentOf = (project) => ENVIRONMENTS.find((e) => e.id === project.site.env) || ENVIRONMENTS[0];
