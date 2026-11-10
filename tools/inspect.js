// Dev : charge une maison modèle et prépare la visite. (await import('/tools/inspect.js?'+Date.now())).prep('manoir')
import * as T from '/node_modules/.vite/deps/three.js';
import { TEMPLATES } from '/src/templates.js';
import { loadMore, getItem } from '/src/catalog.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function prep(id, preset = 'walk') {
  document.querySelector('.modal #mkeep')?.click(); document.querySelector('.modal #rLater')?.click();
  await loadMore();
  const { store, plan } = window.__maison, p = TEMPLATES.find((t) => t.id === id).make();
  store.levelIndex = 0; store.load(p); plan.fitted = false; plan.fit();
  if (document.querySelector('#viewLayer').classList.contains('hidden')) [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '3D')?.click();
  await sleep(6500);
  if (document.querySelector('#panel').classList.contains('open')) document.querySelector('[aria-label="Masquer ou afficher le panneau"]').click();
  for (const s of ['#sunbar', '#navpad']) document.querySelector(s).style.display = 'none';
  await sleep(600);
  const v = window.__maison.view; v.resize();
  document.querySelector(`#presetSeg [data-p=${preset}]`).click(); await sleep(1500);
  const stairs = p.levels[0].items.filter((i) => getItem(i.cat)?.model?.type === 'stairs');
  window.__climb = async (lx, ly, yaw, pitch = 0, k = 0) => {
    const it = stairs[k], r = (it.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    v.camera.position.x = (it.x + lx * c - ly * s) / 100; v.camera.position.z = (it.y + lx * s + ly * c) / 100;
    v.yaw = yaw; v.pitch = pitch; for (let i = 0; i < 40; i++) v.updateWalkHeight(0.1); v.applyLook(); v.invalidate(); await sleep(2500);
    return +v.camera.position.y.toFixed(2);
  };
  window.__orbitTo = async (px, py, pz, tx, ty, tz) => { document.querySelector('#presetSeg [data-p=exterior]').click(); await sleep(500); v.camera.position.set(px, py, pz); v.controls.target.set(tx, ty, tz); v.controls.update(); v.invalidate(); await sleep(3000); };
  window.__doll = async (lvl, px, py, pz, tx, ty, tz) => { document.querySelector('#presetSeg [data-p=dollhouse]').click(); store.setLevel(lvl); await sleep(1200); v.camera.position.set(px, py, pz); v.controls.target.set(tx, ty, tz); v.controls.update(); v.onCameraMove(); v.invalidate(); await sleep(3500); };
  return { stairs: stairs.map((i) => [i.x, i.y, i.rot]) };
}
