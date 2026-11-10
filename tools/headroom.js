// Dev : vérifie la hauteur libre au-dessus de chaque marche. (await import('/tools/headroom.js?'+Date.now())).check()
// Pour chaque escalier, on suit son emprise par pas de 15 cm : hauteur de la marche, puis ce qui se trouve au-dessus (plancher, plafond, poutre).
import * as T from '/node_modules/.vite/deps/three.js';
import { getItem } from '/src/catalog.js';

export async function check(minClear = 2.0) {
  const { store, view: v } = window.__maison, rc = new T.Raycaster(), out = [];
  v.applyVisibility?.(); v.scene.updateMatrixWorld(true);
  const house = v.house, items = v.items;
  for (const [li, lv] of store.project.levels.entries()) for (const it of lv.items) {
    const def = getItem(it.cat); if (def?.model?.type !== 'stairs') continue;
    const obj = v.itemObjs.get(it.id); if (!obj) continue;
    const w = (it.w ?? def.w) / 2, d = (it.d ?? def.d) / 2, r = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    const bad = [];
    let n = 0;
    for (let y = -d + 8; y < d; y += 15) for (let x = -w + 8; x < w; x += 15) {
      const X = (it.x + x * c - y * s) / 100, Z = (it.y + x * s + y * c) / 100;
      rc.set(new T.Vector3(X, v.baseOf(li) + 6, Z), new T.Vector3(0, -1, 0));
      const hit = rc.intersectObject(obj, true)[0]; if (!hit) continue;
      n++;
      const tread = hit.point.y;
      rc.set(new T.Vector3(X, tread + 0.02, Z), new T.Vector3(0, 1, 0)); rc.far = minClear;
      const up = rc.intersectObjects([house], true).filter((h) => { for (let p = h.object; p; p = p.parent) if (!p.visible) return false; return true; })[0];
      rc.far = Infinity;
      if (up) bad.push({ x: Math.round(x), y: Math.round(y), tread: +(tread - v.baseOf(li)).toFixed(2), clear: +(up.point.y - tread).toFixed(2), kind: up.object.userData.kind || up.object.parent?.name, chain: (() => { const c = []; for (let q = up.object; q && c.length < 4; q = q.parent) c.push(q.userData.kind || q.name || q.type); return c.join('<'); })(), at: [Math.round(up.point.x * 100), Math.round(up.point.z * 100)], h: +(up.point.y - v.baseOf(li)).toFixed(2) });
    }
    out.push({ level: lv.name, stair: def.name, at: [Math.round(it.x), Math.round(it.y), it.rot], samples: n, bad: bad.length, worst: bad.sort((a, b) => a.clear - b.clear).slice(0, 6) });
  }
  return out;
}
