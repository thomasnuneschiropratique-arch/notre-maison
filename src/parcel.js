// La vraie parcelle : ses limites, sa surface et les distances à respecter avec les voisins.
import { dist, polygonArea, pointInPolygon, projectOnSegment } from './geometry.js';

export const parcelOf = (project) => (project.site.parcel?.pts?.length >= 3 ? project.site.parcel : null);
export const parcelArea = (parcel) => Math.abs(polygonArea(parcel.pts)) / 10000;

/** Hauteur de la maison au-dessus du niveau d'entrée, jusqu'en haut des murs (cm). */
function eaveHeight(project) {
  const e = project.entry || 0;
  return project.levels.slice(e).reduce((t, l, i, a) => t + l.height + (i < a.length - 1 ? l.slab : 0), 0);
}

/** Distance minimale aux limites (cm) : réglage du projet, sinon règle générale (la moitié de la hauteur, 3 m au moins). */
export function setbackOf(project) {
  const p = parcelOf(project);
  if (Number.isFinite(p?.setback)) return p.setback;
  return Math.max(300, eaveHeight(project) / 2);
}

/** Contour décalé vers l'intérieur de `d` cm, pour dessiner la zone constructible. */
export function insetPolygon(pts, d) {
  const n = pts.length, sign = polygonArea(pts) > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const u = unit(a, p), v = unit(p, b);
    const nu = { x: -u.y * sign, y: u.x * sign }, nv = { x: -v.y * sign, y: v.x * sign };
    const m = { x: nu.x + nv.x, y: nu.y + nv.y }, k = 1 + nu.x * nv.x + nu.y * nv.y;
    if (k < 0.15) return { x: p.x + nu.x * d, y: p.y + nu.y * d };
    return { x: p.x + (m.x * d) / k, y: p.y + (m.y * d) / k };
  });
}
function unit(a, b) { const l = dist(a, b) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; }

/** Pour chaque limite trop proche de la maison : où, de combien, et si un mur sort de la parcelle. */
export function checkParcel(project) {
  const parcel = parcelOf(project);
  if (!parcel) return null;
  const need = setbackOf(project), pts = parcel.pts, closest = pts.map(() => null);
  let outside = 0;
  const seen = (edge, d, from, to) => { if (!closest[edge] || d < closest[edge].d) closest[edge] = { edge, d, from, to }; };
  for (const level of project.levels) {
    for (const w of level.walls) {
      const a = level.nodes[w.a], b = level.nodes[w.b], half = w.thickness / 2;
      for (const n of [a, b]) {
        if (!pointInPolygon(n, pts)) outside++;
        pts.forEach((q, i) => { const r = projectOnSegment(n, q, pts[(i + 1) % pts.length]); seen(i, r.d - half, n, r.point); });
      }
      // Un angle de la parcelle peut être plus près d'un mur que ne le sont les extrémités du mur.
      pts.forEach((q, i) => {
        const r = projectOnSegment(q, a, b);
        seen(i, r.d - half, r.point, q);
        seen((i - 1 + pts.length) % pts.length, r.d - half, r.point, q);
      });
    }
  }
  const issues = closest.filter((c) => c && c.d < need - 0.5);
  return { area: parcelArea(parcel), need, closest, issues, outside };
}

export const metres = (cm) => `${(cm / 100).toFixed(2).replace('.', ',')} m`;
