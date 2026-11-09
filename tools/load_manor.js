// Dev : recharge la maison anglaise et renvoie surfaces et contrôle. (await import('/tools/load_manor.js?'+Date.now())).run()
import { TEMPLATES, boxOf } from '/src/templates.js';
import { loadMore } from '/src/catalog.js';
import { analyzeLevel } from '/src/geometry.js';
import { audit } from '/tools/audit_house.js';
export async function run(level = 0) {
  await loadMore?.();
  const { store, plan } = window.__maison, p = TEMPLATES.find((t) => t.id === 'manoir').make();
  store.levelIndex = level; store.load(p); plan.fitted = false; plan.fit();
  const rooms = p.levels.map((l) => { const a = analyzeLevel(l); return { lv: l.name, total: Math.round(a.rooms.reduce((s, r) => s + r.area, 0)), rooms: a.rooms.map((r, i) => { const b = boxOf(l, l.rooms[i].name); return `${l.rooms[i].name} ${Math.round(r.area)} m² (${b.x0},${b.y0})-(${b.x1},${b.y1})`; }) }; });
  const au = audit(store); delete au['liens Rez-de-chaussée']; delete au['liens Étage'];
  return { rooms, au };
}
