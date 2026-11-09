// Calcule les planches de vignettes du grand catalogue. À lancer dans le navigateur, sur le serveur de dev :
// (await import('/tools/atlas_dev.js')).buildAtlas(), puis build_more.py avec atlas-map.
import { getItem, loadMore } from '/src/catalog.js';
import { ThumbRenderer } from '/src/thumbs.js';
import rows from '/src/data/more.json';

const CELL = 160, COLS = 8, PER = COLS * COLS, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHORT = { Sklum: 'sk', Drawer: 'dr', Miliboo: 'mi' };
const send = (id, body) => fetch(`/__thumb?id=${id}`, { method: 'POST', body });

export async function buildAtlas() {
  await loadMore();
  const defs = rows.map((r) => {
    const tail = r.u.replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
    return getItem(r.b ? `${SHORT[r.b]}-${tail}` : `ik-${tail}`);
  }).filter((d) => d?.model?.kind === 'proc');
  const tr = new ThumbRenderer();
  tr.init(CELL);
  const status = window.__atlas = { total: defs.length, done: 0, sheets: 0, phase: 'textures' };
  // Premier passage : charge les matières, pour que le second soit net.
  const seen = new Set();
  for (const d of defs) { const k = JSON.stringify(d.model); if (!seen.has(k)) { seen.add(k); tr.draw(d); } if (seen.size % 40 === 0) await sleep(0); }
  for (let i = 0; i < 300 && tr.loading; i++) await sleep(100);
  await sleep(500);
  status.phase = 'planches';
  const map = {}, sheet = document.createElement('canvas');
  sheet.width = sheet.height = CELL * COLS;
  const c = sheet.getContext('2d');
  const flush = async (n) => {
    const blob = await new Promise((res) => sheet.toBlob(res, 'image/webp', 0.78));
    await send(`atlas-${n}`, blob);
    c.clearRect(0, 0, sheet.width, sheet.height);
    status.sheets = n + 1;
  };
  for (let i = 0; i < defs.length; i++) {
    const n = Math.floor(i / PER), cell = i % PER;
    tr.draw(defs[i]);
    c.drawImage(tr.r.domElement, (cell % COLS) * CELL, Math.floor(cell / COLS) * CELL, CELL, CELL);
    map[defs[i].id] = [n, cell];
    status.done = i + 1;
    if (cell === PER - 1) await flush(n);
    else if (i % 12 === 0) await sleep(0);
  }
  if (defs.length % PER) await flush(Math.floor(defs.length / PER));
  await send('atlas-map', new Blob([JSON.stringify(map)]));
  status.phase = 'fini';
  return status;
}
