// Vérifications de bon sens : réglementation française courante, confort, circulation. Indicatif, ne remplace pas un architecte.
import { getItem, isDoorType } from './catalog.js';
import { terrainOf, heightAt, levelBase } from './terrain.js';
import { itemCorners, pointInPolygon, dist } from './geometry.js';

const round1 = (n) => n.toFixed(1).replace('.', ',');

export function surfaces(store) {
  const out = { byLevel: [], habitable: 0, plancher: 0, emprise: 0 };
  store.project.levels.forEach((lv, i) => {
    const a = store.analysis(lv);
    const hab = a.rooms.reduce((s, r, j) => s + (['garage', 'terrasse'].includes(lv.rooms[j]?.type) ? 0 : r.area), 0);
    const gross = a.rooms.reduce((s, r) => s + r.grossArea, 0);
    out.byLevel.push({ name: lv.name, hab, gross, rooms: a.rooms.length });
    out.habitable += hab; out.plancher += hab;
    if (i === 0) out.emprise = gross;
  });
  return out;
}

export function runChecks(store) {
  const res = [];
  const add = (level, title, text) => res.push({ level, title, text });
  const s = surfaces(store);
  const project = store.project;

  if (s.plancher > 150) add('warn', 'Architecte obligatoire', `Avec environ ${Math.round(s.plancher)} m² de surface de plancher, le seuil de 150 m² est dépassé : le recours à un architecte est obligatoire pour le permis de construire.`);
  else if (s.plancher > 0) add('ok', 'Sous le seuil des 150 m²', `Environ ${Math.round(s.plancher)} m² de surface de plancher : l’architecte n’est pas obligatoire pour un particulier.`);

  project.levels.forEach((lv) => {
    const a = store.analysis(lv);
    const types = lv.rooms.map((r) => r.type);
    a.rooms.forEach((r, i) => {
      const info = lv.rooms[i]; if (!info) return;
      if (['chambre', 'parentale', 'enfant', 'sejour', 'salon'].includes(info.type)) {
        if (r.area < 9) add('warn', `${info.name} trop petite`, `${round1(r.area)} m² : une pièce principale doit faire au moins 9 m² pour répondre aux critères du logement décent.`);
        const hasWindow = lv.walls.some((w) => r.wallIds.includes(w.id) && w.openings.some((o) => !isDoorType(o.type)));
        if (!hasWindow) add('warn', `${info.name} sans fenêtre`, 'Une pièce principale a besoin d’un éclairement naturel direct.');
        else {
          const glazing = lv.walls.filter((w) => r.wallIds.includes(w.id)).flatMap((w) => w.openings).filter((o) => !isDoorType(o.type)).reduce((t, o) => t + (o.width * o.height) / 10000, 0);
          if (glazing / r.area < 1 / 6) add('info', `${info.name} : peu de vitrage`, `${round1(glazing)} m² vitrés pour ${round1(r.area)} m². Viser au moins 1/6 de la surface (exigence RE2020 sur l’ensemble du logement).`);
        }
      }
      if (info.type === 'couloir') {
        const pts = r.poly; const w = Math.min(Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)));
        if (w < 90) add('warn', 'Couloir étroit', `${Math.round(w)} cm : prévoir au moins 90 cm de passage.`);
      }
    });
    if (lv === project.levels[0]) {
      if (a.rooms.length && !types.some((t) => ['sdb', 'douche'].includes(t)) && !project.levels.some((l) => l.rooms.some((r) => ['sdb', 'douche'].includes(r.type)))) add('warn', 'Pas de salle de bain', 'Nomme une pièce « Salle de bain » ou « Salle d’eau ».');
      if (a.rooms.length && !project.levels.some((l) => l.rooms.some((r) => r.type === 'wc' || r.type === 'sdb'))) add('warn', 'Pas de WC', 'Un WC est indispensable, idéalement séparé de la cuisine et de l’entrée.');
    }
    // Portes : largeur utile, accessibilité
    for (const w of lv.walls) for (const o of w.openings) {
      if (o.type === 'door' && o.width < 73) add('info', 'Porte étroite', `Une porte de ${o.width} cm est juste. 83 cm permet le passage d’un fauteuil roulant et des meubles.`);
    }
    // Mobilier hors des murs ou trop près d’une porte
    for (const it of lv.items) {
      const def = getItem(it.cat); if (!def || def.ceiling || def.wall) continue;
      const corners = itemCorners(it, def);
      const inRoom = a.rooms.some((r) => pointInPolygon({ x: it.x, y: it.y }, r.poly));
      if (!inRoom && def.cat !== 'exterieur' && def.cat !== 'structure') add('info', `${def.name} hors des pièces`, 'Ce meuble semble posé à l’extérieur des murs.');
      for (const wl of lv.walls) for (const o of wl.openings) {
        if (!['door', 'entry'].includes(o.type)) continue;
        const A = lv.nodes[wl.a], B = lv.nodes[wl.b], L = dist(A, B);
        const c = { x: A.x + ((B.x - A.x) * o.t) / L, y: A.y + ((B.y - A.y) * o.t) / L };
        if (corners.some((p) => dist(p, c) < 45)) add('warn', `${def.name} bloque une porte`, 'Il reste moins de 45 cm devant cette porte.');
      }
      if (def.model?.type === 'bed') {
        const room = a.rooms.find((r) => pointInPolygon({ x: it.x, y: it.y }, r.poly));
        if (room && (def.w ?? 0) * (def.d ?? 0) / 10000 / room.area > 0.5) add('info', `${def.name} : circulation`, 'Le lit occupe plus de la moitié de la pièce. Garder 60 cm de chaque côté si possible.');
      }
    }
  });

  if (project.levels.length > 1 && !project.levels.some((l) => l.items.some((it) => getItem(it.cat)?.sub === 'escalier'))) add('warn', 'Pas d’escalier', 'Plusieurs niveaux sans escalier : place-en un dans le catalogue, rubrique Structure.');
  const relief = terrainOf(project);
  if (relief) project.levels.forEach((lv, i) => {
    const base = levelBase(project, i), an = store.analysis(lv);
    for (const w of lv.walls.filter((x) => (an.sideRoom.get(`${x.id}:L`) === undefined) !== (an.sideRoom.get(`${x.id}:R`) === undefined))) for (const o of w.openings) {
      const a = lv.nodes[w.a], b = lv.nodes[w.b], L = dist(a, b), g = heightAt(relief, a.x + ((b.x - a.x) * o.t) / L, a.y + ((b.y - a.y) * o.t) / L);
      if (g > base + (o.sill + o.height) * 0.01 - 0.05) add('warn', `${lv.name} : ouverture enterrée`, 'Le terrain recouvre cette ouverture. Déplace-la, creuse le terrain ou monte la maison.');
    }
  });

  const rooms = project.levels.flatMap((l) => l.rooms);
  if (rooms.length === 0) add('info', 'Plan vide', 'Trace une première pièce pour obtenir des conseils.');
  res.sort((a, b) => ({ warn: 0, info: 1, ok: 2 }[a.level] - { warn: 0, info: 1, ok: 2 }[b.level]));
  return res;
}
