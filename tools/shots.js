// Dev : place la caméra de visite. (await import('/tools/shots.js')).setup(); await __go(niveau, x, y, cap, inclinaison)
export function setup() {
  document.querySelector('#presetSeg [data-p=walk]').click();
  const v = window.__maison.view;
  window.__go = async (lvl, x, y, yaw, pitch = 0, wait = 1600) => {
    window.__maison.store.setLevel(lvl);
    await new Promise((r) => setTimeout(r, 300));
    const Y = v.baseOf(lvl) + 1.62;
    v.camera.position.set(x / 100, Y, y / 100); v.walkY = Y; v.yaw = yaw; v.pitch = pitch; v.applyLook(); v.applyVisibility(); v.invalidate();
    await new Promise((r) => setTimeout(r, wait));
    return { room: v.roomKey, interior: v.interior, exp: +v.exposureNow.toFixed(2), probes: v.probes.size };
  };
  window.__orbit = async (px, py, pz, tx, ty, tz, wait = 2200) => {
    document.querySelector('#presetSeg [data-p=exterior]').click();
    await new Promise((r) => setTimeout(r, 500));
    v.camera.position.set(px, py, pz); v.controls.target.set(tx, ty, tz); v.controls.update(); v.invalidate();
    await new Promise((r) => setTimeout(r, wait));
  };
}

/** Cherche un morceau de toit qui descendrait dans une pièce, sur une grille de points. */
export async function roofScan() {
  const T = await import('/node_modules/.vite/deps/three.js'), G = await import('/src/geometry.js'), { store, view: v } = window.__maison, rc = new T.Raycaster(), out = {};
  for (let li = 0; li < store.project.levels.length; li++) {
    store.setLevel(li); await new Promise((r) => setTimeout(r, 400));
    const lv = store.project.levels[li], a = store.analysis(lv);
    a.rooms.forEach((r, i) => {
      const xs = r.poly.map((p) => p.x), ys = r.poly.map((p) => p.y);
      for (let x = Math.min(...xs) + 12; x < Math.max(...xs); x += 25) for (let y = Math.min(...ys) + 12; y < Math.max(...ys); y += 25) {
        if (!G.pointInPolygon({ x, y }, r.poly)) continue;
        rc.set(new T.Vector3(x / 100, v.baseOf(li) + 1.2, y / 100), new T.Vector3(0, 1, 0));
        const hits = rc.intersectObjects(v.house.children, true).filter((h) => h.object.visible);
        const c = hits.findIndex((h) => h.object.userData.kind === 'ceiling'), q = hits.findIndex((h) => h.object.userData.kind === 'roof');
        if (c >= 0 && q >= 0 && q < c) { const n = `${lv.name} : ${lv.rooms[i].name}`; (out[n] ||= []).push([Math.round(x), Math.round(y)]); }
      }
    });
  }
  for (const k in out) out[k] = `${out[k].length} : ${out[k].slice(0, 3).join(' | ')}`;
  return out;
}
