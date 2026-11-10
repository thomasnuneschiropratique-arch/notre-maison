// Dev : meubles qui traversent le plafond ou masquent une fenêtre. (await import('/tools/fitcheck.js?'+Date.now())).fit()
import { getItem } from '/src/catalog.js';
import { analyzeLevel, pointInPolygon, itemCorners } from '/src/geometry.js';
export function fit() {
  const p = window.__maison.store.project, out = { plafond: [], fenetre: [], sol: [] };
  p.levels.forEach((lv, li) => {
    const a = analyzeLevel(lv), zones = (p.roofs || []).filter((z) => z.level === lv.id && z.wallH > 0);
    for (const it of lv.items) {
      const def = getItem(it.cat); if (!def || def.cat === 'exterieur' || def.cat === 'structure' || def.sub === 'voiture') continue;
      const ri = a.rooms.findIndex((r) => pointInPolygon({ x: it.x, y: it.y }, r.poly)); if (ri < 0) continue;
      const z = it.z ?? def.z ?? 0, h = it.h ?? def.h, zone = zones.find((q) => it.x >= q.x0 && it.x <= q.x1 && it.y >= q.y0 && it.y <= q.y1);
      const H = zone ? zone.wallH : lv.height;
      if (def.ceiling) { if (z < 0 || h > H - 190) out.plafond.push(`${lv.name} ${lv.rooms[ri].name} : ${def.name} descend à ${Math.round(H - h)} cm du sol`); continue; }
      if (z + h > H + 1 && !zone?.vault) out.plafond.push(`${lv.name} ${lv.rooms[ri].name} : ${def.name} ${Math.round(z + h)} > ${H}`);
      if (z < -1) out.sol.push(`${lv.name} : ${def.name} z ${z}`);
      // Grand meuble devant une fenêtre ou une porte-fenêtre.
      if (h < 100 || def.sub === 'rideau' || def.wall || def.sub === 'plante') continue;
      const c = itemCorners(it, def);
      for (const w of lv.walls) for (const o of w.openings) {
        if (!['window2', 'bay', 'fixed', 'window1', 'glasswall'].includes(o.type) || o.sill >= z + h) continue;
        const A = lv.nodes[w.a], B = lv.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
        const near = c.some((q) => { const t = (q.x - A.x) * ux + (q.y - A.y) * uy, d = Math.abs((q.x - A.x) * uy - (q.y - A.y) * ux); return d < w.thickness / 2 + 30 && t > o.t - o.width / 2 + 5 && t < o.t + o.width / 2 - 5; });
        if (near) out.fenetre.push(`${lv.name} ${lv.rooms[ri].name} : ${def.name} devant ${o.name || o.type} ${o.width}`);
      }
    }
  });
  return out;
}
