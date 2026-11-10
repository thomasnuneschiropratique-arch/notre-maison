// Dev : contrôle complet d'une maison modèle. (await import('/tools/fullcheck.js?'+Date.now())).run('mas')
import { prep } from '/tools/inspect.js';
import { check } from '/tools/headroom.js';
import { roofScan } from '/tools/shots.js';
import { audit } from '/tools/audit_house.js';
export async function run(id) {
  await prep(id);
  const { store } = window.__maison;
  const hr = (await check()).map((s) => `${s.stair} : ${s.bad} points trop bas${s.worst[0] ? ` (pire ${s.worst[0].clear} m, ${s.worst[0].kind})` : ''}`);
  const roofs = await roofScan();
  const au = audit(store), o = {};
  for (const k in au) if (!/^liens|overlaps|roomsWithoutWindow|openingHigh/.test(k) && Array.isArray(au[k]) && au[k].length) o[k] = au[k];
  return { id, stairs: hr, roofs, audit: o };
}
