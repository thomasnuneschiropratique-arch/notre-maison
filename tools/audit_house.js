// Contrôle d'une maison dans le navigateur, sur le serveur de dev : (await import('/tools/audit_house.js')).audit(store)
import { getItem } from '/src/catalog.js';
import { itemCorners, segmentsCross, pointInPolygon, analyzeLevel } from '/src/geometry.js';

const SIZE = { canape: [150, 460, 60, 130], fauteuil: [55, 130, 60, 125], chaise: [35, 75, 70, 110], tabouret: [28, 70, 40, 115], lit: [85, 240, 25, 170], chevet: [30, 90, 35, 90], armoire: [50, 400, 150, 300], table: [70, 400, 70, 80] };

export function audit(store) {
  const p = store.project, out = { unreachable: [], crossWall: [], wallArt: [], overlaps: [], sizes: [], roomsWithoutWindow: [] };
  p.levels.forEach((lv, li) => {
    const a = analyzeLevel(lv), name = (i) => lv.rooms[i]?.name ?? '?';
    // Circulation : on part du hall ou du palier, on suit les passages au sol.
    const links = a.rooms.map(() => new Set());
    for (const w of lv.walls) { const l = a.sideRoom.get(`${w.id}:L`), r = a.sideRoom.get(`${w.id}:R`); if (l !== undefined && r !== undefined && w.openings.some((o) => o.sill < 10)) { links[l].add(r); links[r].add(l); } }
    const start = Math.max(0, lv.rooms.findIndex((r) => ['Hall', 'Palier', 'Entrée'].includes(r.name))), seen = new Set([start]), todo = [start];
    while (todo.length) for (const n of links[todo.pop()]) if (!seen.has(n)) { seen.add(n); todo.push(n); }
    a.rooms.forEach((r, i) => { if (!seen.has(i)) out.unreachable.push(`${lv.name} : ${name(i)}`); });
    out[`liens ${lv.name}`] = a.rooms.map((r, i) => `${name(i)} → ${[...links[i]].map(name).join(', ')}`);
    a.rooms.forEach((r, i) => { const has = lv.walls.some((w) => r.wallIds.includes(w.id) && w.openings.some((o) => !['door', 'double', 'passage', 'arch', 'pocket'].includes(o.type))); if (!has) out.roomsWithoutWindow.push(`${lv.name} : ${name(i)}`); });
    for (const it of lv.items) {
      const def = getItem(it.cat); if (!def) { out.overlaps.push(`inconnu ${it.cat}`); continue; }
      const label = `${lv.name} : ${def.name.slice(0, 34)}`, w = it.w ?? def.w, d = it.d ?? def.d, h = it.h ?? def.h, flatOrHung = def.wall || def.ceiling || def.sub === 'tapis' || def.sub === 'art' || def.sub === 'rideau' || (it.z ?? 0) > 20;
      const lim = SIZE[def.sub];
      if (lim && (Math.max(w, d) < lim[0] || Math.max(w, d) > lim[1] || h < lim[2] || h > lim[3])) out.sizes.push(`${label} ${Math.round(w)}×${Math.round(d)}×${Math.round(h)}`);
      if (def.cat === 'exterieur' || def.sub === 'poteau' || def.sub === 'escalier' || def.sub === 'garde-corps') continue;
      if (!flatOrHung) {
        const c = itemCorners(it, def);
        for (const wl of lv.walls) { const A = lv.nodes[wl.a], B = lv.nodes[wl.b]; let crosses = false; for (let k = 0; k < 4; k++) if (segmentsCross(c[k], c[(k + 1) % 4], A, B)) crosses = true; if (crosses && !wl.openings.some((o) => o.type === 'bay' || o.type === 'window2')) { out.crossWall.push(`${label} @${Math.round(it.x)},${Math.round(it.y)}`); break; } }
      }
      if (def.sub !== 'rideau' && (def.wall || def.sub === 'art' || def.sub === 'miroir')) {
        let best = 1e9, wallHit = null, tt = 0;
        for (const wl of lv.walls) { const A = lv.nodes[wl.a], B = lv.nodes[wl.b], L = Math.hypot(B.x - A.x, B.y - A.y), t = Math.max(0, Math.min(L, ((it.x - A.x) * (B.x - A.x) + (it.y - A.y) * (B.y - A.y)) / L)), px = A.x + ((B.x - A.x) * t) / L, py = A.y + ((B.y - A.y) * t) / L, dd = Math.hypot(it.x - px, it.y - py); if (dd < best) { best = dd; wallHit = wl; tt = t; } }
        const hit = wallHit?.openings.find((o) => Math.abs(o.t - tt) < o.width / 2 + w / 2);
        if (best > wallHit.thickness / 2 + 12 || hit) out.wallArt.push(`${label} à ${Math.round(best)} cm${hit ? ` sur ${hit.type}` : ''}`);
      }
    }
    // Chevauchements de grands meubles posés au sol.
    const big = lv.items.map((it) => ({ it, def: getItem(it.cat) })).filter(({ it, def }) => def && !def.wall && !def.ceiling && !['tapis', 'art', 'rideau', 'terrasse', 'piscine', 'plantation', 'poteau', 'escalier', 'garde-corps', 'coussin', 'vase', 'lampe'].includes(def.sub) && !(it.z > 20));
    for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
      const A = itemCorners(big[i].it, big[i].def), B = itemCorners(big[j].it, big[j].def), xa = A.map((q) => q.x), ya = A.map((q) => q.y), xb = B.map((q) => q.x), yb = B.map((q) => q.y);
      const ox = Math.min(Math.max(...xa), Math.max(...xb)) - Math.max(Math.min(...xa), Math.min(...xb)), oy = Math.min(Math.max(...ya), Math.max(...yb)) - Math.max(Math.min(...ya), Math.min(...yb));
      if (ox > 4 && oy > 4) out.overlaps.push(`${lv.name} : ${big[i].def.name.slice(0, 24)} × ${big[j].def.name.slice(0, 24)} (${Math.round(ox)}×${Math.round(oy)})`);
    }
    // Ouvertures : hors du mur, à cheval sur un angle, ou l'une sur l'autre.
    const junction = (w, n) => lv.walls.some((o) => o !== w && (o.a === n || o.b === n));
    for (const w of lv.walls) {
      const A = lv.nodes[w.a], B = lv.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y);
      const sorted = [...w.openings].sort((p, q) => p.t - q.t);
      sorted.forEach((o, i) => {
        const x = Math.round(A.x + ((B.x - A.x) * o.t) / L), y = Math.round(A.y + ((B.y - A.y) * o.t) / L), tag = `${lv.name} : ${o.name || o.type} ${Math.round(o.width)} @${x},${y}`;
        if (o.t - o.width / 2 < 12 || o.t + o.width / 2 > L - 12) (out.openingEnds ||= []).push(`${tag} (mur ${Math.round(L)}, t ${Math.round(o.t)})`);
        if (i && sorted[i - 1].t + sorted[i - 1].width / 2 > o.t - o.width / 2 + 2) (out.openingOverlap ||= []).push(tag);
        if (o.sill + o.height > lv.height - 2) (out.openingHigh ||= []).push(`${tag} haut ${o.sill + o.height} / ${lv.height}`);
      });
      void junction;
    }
    // Meubles qui bouchent un passage (zone d'un mètre devant chaque porte ou arche).
    for (const w of lv.walls) for (const o of w.openings) {
      if (o.sill > 10) continue;
      const A = lv.nodes[w.a], B = lv.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, px = A.x + ux * o.t, py = A.y + uy * o.t, nx = -uy, ny = ux;
      for (const it of lv.items) {
        const def = getItem(it.cat); if (!def || def.wall || def.ceiling || (it.z ?? 0) > 20 || ['tapis', 'art', 'rideau', 'terrasse', 'piscine', 'plantation', 'poteau', 'garde-corps'].includes(def.sub) || def.cat === 'exterieur') continue;
        const C = itemCorners(it, def);
        const hit = [1, -1].some((sgn) => C.some((q) => { const dx = q.x - px, dy = q.y - py, along = dx * ux + dy * uy, depth = (dx * nx + dy * ny) * sgn; return Math.abs(along) < Math.max(35, o.width / 2 - 10) && depth > 0 && depth < 70; }));
        if (hit) (out.blockedDoors ||= []).push(`${lv.name} : ${o.name || o.type} @${Math.round(px)},${Math.round(py)} gêné par ${def.name.slice(0, 30)}`);
      }
    }
    void li; void pointInPolygon;
  });
  return out;
}
