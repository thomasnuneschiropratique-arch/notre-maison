import './style.css';
import { store, newLevel, dbAll, dbGet, dbPut, dbDel, uid, ROOM_TYPES, roomType } from './state.js';
import { Plan2D } from './plan2d.js';
import { View3D, ThumbRenderer } from './view3d.js';
import { allItems, getItem, CATEGORIES, subLabel, purchaseLinks, OPENINGS, setCustom, catalogStats, isHerStyle } from './catalog.js';
import { FLOORS, PAINTS, WALL_FINISHES, FACADES, ROOFS, GROUNDS, materialInfo, buyLinks } from './materials.js';
import { TEMPLATES } from './templates.js';
import { runChecks, budget, surfaces } from './advice.js';
import { dist } from './geometry.js';

const ICONS = {
  select: '<path d="M5 3l14 8-6 2-2 6z"/>', wall: '<path d="M3 7h18M3 12h18M3 17h18M9 7v5M15 12v5M6 12v5M18 7v5"/>', room: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 12h6"/>',
  door: '<path d="M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M3 21h18"/><circle cx="14.5" cy="12" r=".6"/>', measure: '<path d="M3 16l13-13 5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 010 10h-3"/>', redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 000 10h3"/>',
  plan: '<path d="M4 4h16v16H4zM4 12h7V4M11 20v-4h9"/>', cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>', sofa: '<path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3"/><path d="M3 13a2 2 0 014 0v2h10v-2a2 2 0 014 0v5H3zM6 18v2M18 18v2"/>', euro: '<path d="M17 6a7 7 0 100 12M4 10h10M4 14h9"/>', more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>', fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const euro = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const $ = (s, r = document) => r.querySelector(s);

document.getElementById('app').innerHTML = `
<header class="top">
  <div class="brand">Notre <em>Maison</em></div>
  <button class="projname" id="projName"></button>
  <div class="spacer"></div>
  <span class="saved" id="saved"></span>
  <div class="levels"><select id="level" aria-label="Niveau"></select></div>
  <button class="iconbtn" id="undo" title="Annuler">${icon('undo')}</button>
  <button class="iconbtn" id="redo" title="Rétablir">${icon('redo')}</button>
  <div class="seg" id="viewSeg"><button data-v="plan">Plan</button><button data-v="3d">3D</button></div>
</header>
<div class="work">
  <div class="stage" id="stage">
    <div class="layer" id="planLayer"><canvas id="plan"></canvas>
      <div class="rail" id="rail">
        <button data-t="select">${icon('select')}Choisir</button>
        <button data-t="room">${icon('room')}Pièce</button>
        <button data-t="wall">${icon('wall')}Mur</button>
        <button data-t="door">${icon('door')}Ouvrir</button>
        <button data-t="measure">${icon('measure')}Mesure</button>
        <button data-t="fit">${icon('fit')}Cadrer</button>
      </div>
      <div class="popover hidden" id="openPop"></div>
      <div class="hint hidden" id="hint"></div>
    </div>
    <div class="layer hidden" id="viewLayer"><canvas id="view"></canvas>
      <div class="v3bar" id="v3bar">
        <div class="seg" id="presetSeg"><button data-p="dollhouse">Maquette</button><button data-p="cut">Coupe</button><button data-p="exterior">Dehors</button><button data-p="walk">Visite</button></div>
        <button class="photobtn" id="photoBtn">${icon('camera')}Photo</button>
      </div>
      <div class="sunbar" id="sunbar">
        <span class="lbl">Heure</span><input type="range" id="hour" min="5" max="23" step="0.25" value="15"/><span class="val" id="hourV"></span>
        <div class="row2"><button class="chip" id="season">Été</button><button class="chip on" id="lamps">Lampes</button><span style="flex:1"></span><span>Exposition</span><input type="range" id="expo" min="0.4" max="2.4" step="0.05" value="1" style="width:96px"/></div>
      </div>
      <div class="walkgo hidden" id="walkgo"><select id="walkRoom" aria-label="Aller dans une pièce"></select></div>
      <div class="joy hidden" id="joy"><i></i></div>
      <div class="photoHud hidden" id="photoHud">
        <div style="display:flex;justify-content:space-between;gap:10px"><b id="phTitle">Préparation…</b><small id="phCount"></small></div>
        <div class="bar"><i id="phBar"></i></div>
        <div class="acts"><button class="pri" id="phSave">Enregistrer l'image</button><button id="phClose">Terminer</button></div>
      </div>
    </div>
  </div>
  <aside class="panel" id="panel">
    <button class="grabber" id="grabber" aria-label="Fermer le panneau"></button>
    <nav class="tabs" id="tabs"></nav>
    <div class="pbody" id="pbody"></div>
  </aside>
</div>
<nav class="bottomnav" id="bottomnav">
  <button data-n="plan">${icon('plan')}Plan</button>
  <button data-n="3d">${icon('cube')}3D</button>
  <button data-n="catalog">${icon('sofa')}Meubles</button>
  <button data-n="budget">${icon('euro')}Budget</button>
  <button data-n="more">${icon('more')}Plus</button>
</nav>`;

const plan = new Plan2D($('#plan'));
store.plan = plan;
const view = new View3D($('#view'));
const thumbs = new ThumbRenderer();
window.__maison = { store, view, plan };

const narrow = () => matchMedia('(max-width: 820px)').matches;
const TABS = [['catalog', 'Meubles'], ['style', 'Style'], ['budget', 'Budget'], ['advice', 'Conseils'], ['photos', 'Photos'], ['projects', 'Projets']];
const ui = { view: 'plan', tab: 'catalog', cat: 'anna', sub: null, q: '', sort: 'pop', detail: null, panelOpen: !narrow(), summer: true };

function toast(t) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.append(el);
  setTimeout(() => el.remove(), 2800);
}
store.addEventListener('toast', (e) => toast(e.detail));
store.addEventListener('save-error', () => toast('Sauvegarde impossible sur cet appareil.'));

function setView(v) {
  ui.view = v;
  $('#planLayer').classList.toggle('hidden', v !== 'plan');
  $('#viewLayer').classList.toggle('hidden', v !== '3d');
  view.setActive(v === '3d');
  if (v === 'plan') { plan.resize(); }
  if (v === '3d' && !ui.framed) { view.frame(); ui.framed = true; }
  syncChrome();
}

function setPanel(open) { ui.panelOpen = open; $('#panel').classList.toggle('open', open); syncChrome(); }
function openTab(t) { ui.tab = t; ui.detail = null; if (store.selection) store.selection = null; setPanel(true); render(); }

function syncChrome() {
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === ui.view));
  document.querySelectorAll('#bottomnav button').forEach((b) => {
    const n = b.dataset.n;
    const on = ui.panelOpen ? (n === ui.tab || (n === 'more' && ['style', 'advice', 'photos', 'projects', 'more'].includes(ui.tab))) : n === ui.view;
    b.classList.toggle('on', on);
  });
  document.querySelectorAll('#rail button').forEach((b) => b.classList.toggle('on', b.dataset.t === plan.tool || (b.dataset.t === 'door' && plan.tool === 'opening')));
  $('#undo').disabled = !store.undoStack.length; $('#redo').disabled = !store.redoStack.length;
}

// ——— Barres ———
$('#viewSeg').onclick = (e) => { if (e.target.dataset.v) setView(e.target.dataset.v); };
$('#undo').onclick = () => store.undo();
$('#redo').onclick = () => store.redo();
$('#grabber').onclick = () => setPanel(false);
$('#projName').onclick = () => openTab('projects');
$('#bottomnav').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const n = b.dataset.n;
  if (n === 'plan' || n === '3d') { setPanel(false); setView(n); return; }
  if (ui.panelOpen && ui.tab === n && !store.selection) { setPanel(false); return; }
  store.selection = null; ui.detail = null; ui.tab = n; setPanel(true); render();
};
$('#level').onchange = (e) => {
  if (e.target.value === 'add') {
    store.mutate((p) => { const n = newLevel(`Étage ${p.levels.length}`, 250); p.levels.push(n); });
    store.setLevel(store.project.levels.length - 1); fillLevels(); return;
  }
  store.setLevel(Number(e.target.value));
  plan.fitted = false; plan.fit();
};

function fillLevels() {
  $('#level').innerHTML = store.project.levels.map((l, i) => `<option value="${i}" ${i === store.levelIndex ? 'selected' : ''}>${esc(l.name)}</option>`).join('') + '<option value="add">+ Ajouter un étage</option>';
  $('#projName').textContent = store.project.name;
  document.title = `${store.project.name} — Notre Maison`;
}

$('#rail').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const t = b.dataset.t;
  $('#openPop').classList.add('hidden');
  if (t === 'fit') { plan.fitted = false; plan.fit(); return; }
  if (t === 'door') {
    const pop = $('#openPop');
    pop.innerHTML = OPENINGS.map((o, i) => `<button data-i="${i}">${esc(o.name)} <span class="muted small">${o.width} cm</span></button>`).join('');
    pop.classList.remove('hidden');
    return;
  }
  plan.setTool(t);
};
$('#openPop').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  plan.setTool('opening', OPENINGS[Number(b.dataset.i)]);
  $('#openPop').classList.add('hidden');
};
const HINTS = { wall: 'Touche pour poser chaque angle. Double-touche pour finir.', room: 'Fais glisser pour tracer une pièce rectangulaire.', opening: 'Touche un mur pour y placer l’ouverture.', measure: 'Fais glisser entre deux points.' };
store.addEventListener('tool', (e) => {
  const h = $('#hint'), txt = HINTS[e.detail];
  h.classList.toggle('hidden', !txt);
  if (txt) { h.innerHTML = `<span>${txt}</span><button id="hintEnd">Terminer</button>`; $('#hintEnd').onclick = () => plan.setTool('select'); }
  syncChrome();
});

// ——— Commandes 3D ———
$('#presetSeg').onclick = (e) => { const p = e.target.dataset.p; if (p) setPreset(p); };
function setPreset(p) {
  view.setPreset(p);
  document.querySelectorAll('#presetSeg button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
  const walk = p === 'walk';
  $('#walkgo').classList.toggle('hidden', !walk);
  $('#joy').classList.toggle('hidden', !walk || !matchMedia('(pointer: coarse)').matches);
  if (walk) fillWalkRooms();
}
function fillWalkRooms() {
  const lv = store.level;
  $('#walkRoom').innerHTML = '<option value="">Aller dans…</option>' + lv.rooms.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
}
$('#walkRoom').onchange = (e) => { const r = store.level.rooms.find((x) => x.id === e.target.value); if (r) view.startWalk(r); e.target.value = ''; };
const fmtHour = (h) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
function updateSun() { const h = Number($('#hour').value); $('#hourV').textContent = fmtHour(h); view.setEnv({ hour: h, day: ui.summer ? 172 : 355 }); }
$('#hour').oninput = updateSun;
$('#season').onclick = () => { ui.summer = !ui.summer; $('#season').textContent = ui.summer ? 'Été' : 'Hiver'; updateSun(); };
$('#lamps').onclick = (e) => { view.env.lamps = !view.env.lamps; e.target.classList.toggle('on', view.env.lamps); view.updateLamps(); };
$('#expo').oninput = (e) => view.setEnv({ exposure: Number(e.target.value) });
$('#hourV').textContent = fmtHour(15);

// Joystick de déplacement (tactile)
const joy = $('#joy'), knob = joy.firstElementChild;
const joyMove = (e) => {
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  const d = Math.hypot(dx, dy), max = 38;
  if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  view.move.f = -dy / max; view.move.s = dx / max;
};
joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', (e) => { if (joy.hasPointerCapture(e.pointerId)) joyMove(e); });
const joyEnd = () => { knob.style.transform = ''; view.move.f = view.move.s = 0; };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

// ——— Mode photo ———
$('#photoBtn').onclick = async () => {
  const hud = $('#photoHud');
  hud.classList.remove('hidden'); $('#sunbar').classList.add('hidden'); $('#v3bar').classList.add('hidden');
  $('#walkgo').classList.add('hidden'); $('#joy').classList.add('hidden');
  $('#phTitle').textContent = 'Préparation de la scène…'; $('#phCount').textContent = ''; $('#phBar').style.width = '0';
  try {
    await view.startPhoto({
      onProgress: (s, t) => {
        $('#phTitle').textContent = s >= t ? 'Image terminée' : 'Rendu photoréaliste en cours';
        $('#phCount').textContent = `${Math.floor(s)} / ${t} passes`;
        $('#phBar').style.width = `${Math.min(100, (s / t) * 100)}%`;
      },
    });
  } catch (err) {
    console.error(err);
    closePhoto();
    toast('Le mode photo ne fonctionne pas sur cet appareil. Ouvre le projet sur un ordinateur.');
  }
};
function closePhoto() {
  view.stopPhoto();
  $('#photoHud').classList.add('hidden'); $('#sunbar').classList.remove('hidden'); $('#v3bar').classList.remove('hidden');
  if (view.preset === 'walk') { $('#walkgo').classList.remove('hidden'); $('#joy').classList.toggle('hidden', !matchMedia('(pointer: coarse)').matches); }
}
$('#phClose').onclick = closePhoto;
$('#phSave').onclick = async () => {
  const blob = await view.capturePhoto();
  if (!blob) return;
  const id = uid('ph');
  await dbPut('renders', id, { blob, project: store.project.id, name: store.project.name, date: Date.now() });
  downloadBlob(blob, `${store.project.name} - rendu.jpg`);
  toast('Image enregistrée dans « Photos ».');
};

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ——— Panneau ———
function render() {
  const body = $('#pbody');
  const sel = store.selection;
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-k="${k}" class="${ui.tab === k && !sel && !ui.detail ? 'on' : ''}">${l}</button>`).join('');
  if (sel) renderSelection(body, sel);
  else if (ui.detail) renderDetail(body, ui.detail);
  else ({ catalog: renderCatalog, style: renderStyle, budget: renderBudget, advice: renderAdvice, photos: renderPhotos, projects: renderProjects, more: renderMore }[ui.tab] || renderCatalog)(body);
  syncChrome();
}
$('#tabs').onclick = (e) => { const k = e.target.dataset.k; if (k) openTab(k); };

function thumbOf(def, img) {
  if (def.model?.kind === 'ph') img.src = `./thumbs/${def.model.id}.png`;
  else if (def.model?.kind === 'proc') thumbs.request(def, img);
}

function fillThumbs(root) {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { io.unobserve(en.target); const def = getItem(en.target.dataset.th); if (def) thumbOf(def, en.target); }
  }, { root: $('#pbody'), rootMargin: '300px' });
  root.querySelectorAll('img[data-th]').forEach((i) => io.observe(i));
}

function filteredItems() {
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(ui.q.trim());
  let list = allItems();
  if (q) list = list.filter((i) => norm(`${i.name} ${i.label} ${subLabel(i.sub)} ${i.brand}`).includes(q));
  else {
    list = list.filter((i) => (ui.cat === 'anna' ? isHerStyle(i) : i.cat === ui.cat));
    if (ui.sub) list = list.filter((i) => i.sub === ui.sub);
  }
  if (ui.sort === 'asc') list = [...list].sort((a, b) => a.price - b.price);
  if (ui.sort === 'desc') list = [...list].sort((a, b) => b.price - a.price);
  return list;
}

function renderCatalog(body) {
  const subs = [...new Set(allItems().filter((i) => (ui.cat === 'anna' ? isHerStyle(i) : i.cat === ui.cat)).map((i) => i.sub))];
  const stats = catalogStats();
  body.innerHTML = `
    <input class="search" id="q" placeholder="Rechercher parmi ${stats.total} articles" value="${esc(ui.q)}"/>
    <div class="chips" id="cats">${CATEGORIES.filter(([k]) => k !== 'perso' || allItems().some((i) => i.cat === 'perso')).map(([k, l]) => `<button class="chip ${ui.cat === k ? 'on' : ''}" data-c="${k}">${l}</button>`).join('')}</div>
    ${!ui.q && subs.length > 1 ? `<div class="chips" id="subs"><button class="chip ${!ui.sub ? 'on' : ''}" data-s="">Tout</button>${subs.map((s) => `<button class="chip ${ui.sub === s ? 'on' : ''}" data-s="${s}">${subLabel(s)}</button>`).join('')}</div>` : ''}
    <div id="gridWrap"></div>
    <div class="btnrow"><button class="btn block" id="addCustom">+ Ajouter un meuble trouvé en ligne</button></div>`;
  const drawGrid = () => {
    const list = filteredItems();
    const wrap = $('#gridWrap', body);
    wrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px" class="small muted"><span>${list.length} article${list.length > 1 ? 's' : ''}</span><select id="sort" style="border:0;background:none;color:var(--soft)"><option value="pop" ${ui.sort === 'pop' ? 'selected' : ''}>Par défaut</option><option value="asc" ${ui.sort === 'asc' ? 'selected' : ''}>Prix croissant</option><option value="desc" ${ui.sort === 'desc' ? 'selected' : ''}>Prix décroissant</option></select></div>
    <div class="grid">${list.map((i) => `<button class="card" data-id="${esc(i.id)}"><img class="th" data-th="${esc(i.id)}" alt=""/><div class="b"><div class="n">${esc(i.name)}</div><div class="l">${esc(i.label)}</div><div class="p"><span>${i.brand === 'IKEA' || i.brand === 'Générique' ? '' : `${esc(i.brand)} · `}${Math.round(i.w)}×${Math.round(i.d)}</span><b>${i.approx ? '≈ ' : ''}${euro(i.price)}</b></div></div></button>`).join('')}</div>`;
    $('#sort', wrap).onchange = (e) => { ui.sort = e.target.value; drawGrid(); };
    wrap.querySelector('.grid').onclick = (e) => { const c = e.target.closest('.card'); if (c) { ui.detail = c.dataset.id; render(); $('#pbody').scrollTop = 0; } };
    fillThumbs(wrap);
  };
  drawGrid();
  $('#q', body).oninput = (e) => { ui.q = e.target.value; drawGrid(); };
  $('#cats', body).onclick = (e) => { const c = e.target.dataset.c; if (c) { ui.cat = c; ui.sub = null; ui.q = ''; render(); } };
  const subsEl = $('#subs', body);
  if (subsEl) subsEl.onclick = (e) => { if (e.target.dataset.s !== undefined) { ui.sub = e.target.dataset.s || null; render(); } };
  $('#addCustom', body).onclick = customForm;
}

function buyBlock(def) {
  const links = purchaseLinks(def);
  const exact = !!def.url;
  return `<h3 class="s">Où l'acheter</h3>${links.map((l) => `<a class="buy ${l.primary ? 'pri' : ''}" href="${esc(l.url)}" target="_blank" rel="noopener"><span>${esc(l.label)}</span>${icon('ext')}</a>`).join('')}
  <div class="note">${exact ? `Prix et dimensions relevés sur la fiche produit en novembre 2026. Vérifie le prix avant d’acheter. L’aperçu 3D est un modèle proche, aux dimensions du produit : la vraie photo est sur la fiche.${def.dimsApprox ? ' Dimensions à confirmer sur la fiche.' : ''}${def.note ? ` ${def.note}` : ''}` : 'Article type, prix indicatif. Les liens ouvrent une recherche d’équivalents dans chaque boutique.'}</div>`;
}

function renderDetail(body, id) {
  const def = getItem(id); if (!def) { ui.detail = null; return render(); }
  body.innerHTML = `
    <button class="btn" id="back" style="margin-bottom:10px">← Retour</button>
    <img class="hero" id="hero" alt=""/>
    <h2 class="t" style="margin-top:12px">${esc(def.name)}</h2>
    <div class="muted">${esc(def.label)}${def.brand !== 'Générique' ? ` · ${esc(def.brand)}` : ''}</div>
    <div class="price">${def.approx ? '≈ ' : ''}${euro(def.price)}</div>
    <div class="muted small" style="margin-top:6px">L ${Math.round(def.w)} × P ${Math.round(def.d)} × H ${Math.round(def.h)} cm</div>
    <div class="btnrow"><button class="btn pri block" id="place">Placer dans ${esc(placeTarget())}</button></div>
    ${buyBlock(def)}`;
  thumbOf(def, $('#hero', body));
  $('#back', body).onclick = () => { ui.detail = null; render(); };
  $('#place', body).onclick = () => placeItem(def);
}

function placeTarget() { return store.level.name.toLowerCase().startsWith('rez') ? 'le plan' : store.level.name; }

function placeItem(def) {
  const c = ui.view === 'plan' ? plan.center() : centerOfView();
  const id = uid('it');
  store.mutate((p, lv) => { lv.items.push({ id, cat: def.id, x: Math.round(c.x), y: Math.round(c.y), rot: 0 }); });
  ui.detail = null;
  store.select({ type: 'item', id });
  if (narrow()) setPanel(false);
  toast(`${def.name} placé. Fais-le glisser à sa place.`);
}

function centerOfView() {
  const t = view.mode === 'walk' ? { x: view.camera.position.x * 100 + -Math.sin(view.yaw) * 150, z: view.camera.position.z * 100 + -Math.cos(view.yaw) * 150 } : { x: view.controls.target.x * 100, z: view.controls.target.z * 100 };
  return { x: t.x, y: t.z };
}

function renderSelection(body, s) {
  const lv = store.level;
  if (s.type === 'item') return itemPanel(body, lv.items.find((i) => i.id === s.id));
  if (s.type === 'room') { const i = lv.rooms.findIndex((r) => r.id === s.id); return roomPanel(body, lv.rooms[i], i, s.part); }
  if (s.type === 'wall') return wallPanel(body, lv.walls.find((w) => w.id === s.id), s);
  if (s.type === 'opening') { const w = lv.walls.find((x) => x.id === s.wallId); return openingPanel(body, w, w?.openings.find((o) => o.id === s.id)); }
  if (s.type === 'node') {
    body.innerHTML = `<h2 class="t">Angle de mur</h2><p class="muted">Fais-le glisser pour déformer les murs reliés.</p><button class="btn danger block" id="del">${icon('trash')}Supprimer cet angle</button>`;
    $('#del', body).onclick = () => plan.deleteSelection();
  }
}

const closeSel = () => { store.select(null); if (narrow()) setPanel(false); };
function header(title, sub) { return `<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><h2 class="t">${esc(title)}</h2><div class="muted small">${esc(sub || '')}</div></div><button class="iconbtn" id="closeSel" aria-label="Fermer">${icon('close')}</button></div>`; }
function live(fn) { store.snapshot(); fn(); store.commit(); }

function itemPanel(body, it) {
  if (!it) return closeSel();
  const def = getItem(it.cat);
  const w = it.w ?? def.w, d = it.d ?? def.d, h = it.h ?? def.h;
  const canColor = ['sofa', 'armchair', 'rug', 'curtain'].includes(def.model?.type);
  body.innerHTML = `${header(def.name, def.label)}
    <img class="hero" id="hero" alt="" style="margin-top:10px"/>
    <div class="price">${def.approx ? '≈ ' : ''}${euro(def.price)}</div>
    <h3 class="s">Dimensions (cm)</h3>
    <div class="dims"><div><label>Largeur</label><input type="number" id="w" value="${Math.round(w)}"/></div><div><label>Profondeur</label><input type="number" id="d" value="${Math.round(d)}"/></div><div><label>Hauteur</label><input type="number" id="h" value="${Math.round(h)}"/></div></div>
    <div class="field"><label>Rotation</label><input type="number" id="rot" step="15" value="${Math.round(it.rot || 0)}"/></div>
    <div class="field"><label>Hauteur du sol (cm)</label><input type="number" id="z" value="${Math.round(it.z ?? def.z ?? 0)}"/></div>
    ${canColor ? `<div class="field"><label>Couleur</label><input type="color" id="col" value="${it.color || def.color || def.model?.p?.color || '#b7ab98'}" style="height:36px;padding:2px"/></div>` : ''}
    <div class="btnrow"><button class="btn" id="dup">${icon('copy')}Dupliquer</button><button class="btn" id="rot90">Tourner 90°</button><button class="btn danger" id="del">${icon('trash')}Retirer</button></div>
    ${buyBlock(def)}
    <div class="field" style="margin-top:8px"><label>Déjà acheté</label><input type="checkbox" id="bought" ${it.bought ? 'checked' : ''} style="width:22px;height:22px;justify-self:end"/></div>`;
  thumbOf(def, $('#hero', body));
  $('#closeSel', body).onclick = closeSel;
  for (const k of ['w', 'd', 'h', 'z', 'rot']) $(`#${k}`, body).onchange = (e) => live(() => { it[k] = Number(e.target.value); });
  const col = $('#col', body); if (col) col.onchange = (e) => live(() => { it.color = e.target.value; });
  $('#rot90', body).onclick = () => live(() => { it.rot = ((it.rot || 0) + 90) % 360; render(); });
  $('#del', body).onclick = () => plan.deleteSelection();
  $('#bought', body).onchange = (e) => live(() => { it.bought = e.target.checked; });
  $('#dup', body).onclick = () => { const id = uid('it'); store.mutate((p, lv) => lv.items.push({ ...it, id, x: it.x + 30, y: it.y + 30 })); store.select({ type: 'item', id }); };
}

function swatchRow(list, cur, kind) {
  return `<div class="swatches">${list.map((m) => `<button class="swatch ${cur === m.id ? 'on' : ''}" data-m="${m.id}" data-kind="${kind}" title="${esc(m.name)}" style="${m.hex ? `background:${m.hex}` : `background-image:url(./thumbs/t_${m.t}.png)`}"></button>`).join('')}</div>`;
}

function roomPanel(body, r, index, part) {
  if (!r) return closeSel();
  const a = store.analysis();
  const info = a.rooms[index];
  const floor = materialInfo(r.floor);
  body.innerHTML = `${header(r.name, `${info ? info.area.toFixed(1).replace('.', ',') : '–'} m² · périmètre ${info ? info.perimeter.toFixed(1).replace('.', ',') : '–'} m`)}
    <div class="field wide"><label>Nom</label><input id="nm" value="${esc(r.name)}"/></div>
    <div class="field wide"><label>Type</label><select id="ty">${ROOM_TYPES.map((t) => `<option value="${t[0]}" ${t[0] === r.type ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></div>
    <h3 class="s">Sol</h3>${swatchRow(FLOORS, r.floor, 'floor')}<div class="matname">${esc(floor?.name || '')}${floor?.price ? ` · env. ${floor.price} €/m²` : ''}</div>
    ${floor?.buy ? buyLinks(floor.buy).map((l) => `<a class="buy" href="${esc(l.url)}" target="_blank" rel="noopener"><span>${esc(l.shop)}</span>${icon('ext')}</a>`).join('') : ''}
    <h3 class="s">Murs de la pièce</h3>${swatchRow(PAINTS, r.paint, 'paint')}<div class="matname">${esc(materialInfo(r.paint)?.name || '')}${materialInfo(r.paint)?.brand ? ` · ${esc(materialInfo(r.paint).brand)}` : ''}</div>
    <h3 class="s">Revêtements muraux</h3>${swatchRow(WALL_FINISHES, r.paint, 'paint')}
    <h3 class="s">Plafond</h3>${swatchRow(PAINTS.slice(0, 6), r.ceiling, 'ceiling')}
    <div class="note">Les couleurs de marque sont des teintes approchées : un écran ne remplace pas un échantillon.</div>`;
  void part;
  $('#closeSel', body).onclick = closeSel;
  $('#nm', body).onchange = (e) => live(() => { r.name = e.target.value; });
  $('#ty', body).onchange = (e) => live(() => { r.type = e.target.value; r.name = roomType(r.type)[1]; render(); });
  body.querySelectorAll('.swatch').forEach((b) => { b.onclick = () => { live(() => {
    r[b.dataset.kind] = b.dataset.m;
    if (b.dataset.kind === 'paint') for (const w of store.level.walls) { if (a.rooms[index].wallIds.includes(w.id)) { const sL = a.sideRoom.get(`${w.id}:L`), sR = a.sideRoom.get(`${w.id}:R`); if (sL === index) delete w.matL; if (sR === index) delete w.matR; } }
  }); render(); }; });
}

function wallPanel(body, w, s) {
  if (!w) return closeSel();
  const lv = store.level, L = dist(lv.nodes[w.a], lv.nodes[w.b]);
  const side = s.side;
  body.innerHTML = `${header('Mur', `${(L / 100).toFixed(2).replace('.', ',')} m de long`)}
    <div class="field"><label>Longueur (cm)</label><input type="number" id="len" value="${Math.round(L)}"/></div>
    <div class="field"><label>Épaisseur (cm)</label><input type="number" id="th" value="${w.thickness}"/></div>
    ${side ? `<h3 class="s">Ce côté du mur</h3>${swatchRow(PAINTS, w[`mat${side}`], 'mat')}<h3 class="s">Revêtements</h3>${swatchRow([...WALL_FINISHES, ...FACADES], w[`mat${side}`], 'mat')}` : '<p class="muted small" style="margin-top:12px">En 3D, touche un mur pour changer la couleur d’un seul côté.</p>'}
    <div class="btnrow"><button class="btn danger block" id="del">${icon('trash')}Supprimer ce mur</button></div>`;
  $('#closeSel', body).onclick = closeSel;
  $('#th', body).onchange = (e) => live(() => { w.thickness = Math.max(5, Number(e.target.value)); });
  $('#len', body).onchange = (e) => live(() => {
    const a = lv.nodes[w.a], b = lv.nodes[w.b], cur = dist(a, b), n = Math.max(30, Number(e.target.value));
    b.x = a.x + ((b.x - a.x) / cur) * n; b.y = a.y + ((b.y - a.y) / cur) * n;
  });
  $('#del', body).onclick = () => plan.deleteSelection();
  body.querySelectorAll('.swatch').forEach((b) => { b.onclick = () => { live(() => { w[`mat${side}`] = b.dataset.m; }); render(); }; });
}

function openingPanel(body, w, o) {
  if (!o) return closeSel();
  const isDoor = ['door', 'entry'].includes(o.type);
  const isWin = !['door', 'entry', 'sliding-door'].includes(o.type);
  body.innerHTML = `${header(o.name || 'Ouverture', `${o.width} × ${o.height} cm`)}
    <div class="dims" style="margin-top:12px"><div><label>Largeur</label><input type="number" id="width" value="${o.width}"/></div><div><label>Hauteur</label><input type="number" id="height" value="${o.height}"/></div><div><label>Allège</label><input type="number" id="sill" value="${o.sill}"/></div></div>
    ${isDoor ? `<div class="field"><label>Ouverture (°)</label><input type="number" id="open" min="0" max="110" step="5" value="${o.open ?? 0}"/></div>
    <div class="btnrow"><button class="btn" id="flip">Inverser le sens</button><button class="btn" id="hinge">Changer le côté</button></div>` : ''}
    <div class="field"><label>Couleur</label><input type="color" id="col" value="${o.color || store.project.style.joinery}" style="height:36px;padding:2px"/></div>
    ${isWin ? `<div class="field"><label>Volet roulant</label><input type="checkbox" id="sh" ${o.shutter ? 'checked' : ''} style="width:22px;height:22px;justify-self:end"/></div>` : ''}
    <div class="btnrow"><button class="btn danger block" id="del">${icon('trash')}Retirer</button></div>
    <h3 class="s">Où l'acheter</h3>${buyLinks(isDoor ? 'bloc porte' : isWin ? 'fenêtre aluminium' : 'porte coulissante').map((l) => `<a class="buy" href="${esc(l.url)}" target="_blank" rel="noopener"><span>${esc(l.shop)}</span>${icon('ext')}</a>`).join('')}`;
  $('#closeSel', body).onclick = closeSel;
  for (const k of ['width', 'height', 'sill', 'open']) { const el = $(`#${k}`, body); if (el) el.onchange = (e) => live(() => { o[k] = Number(e.target.value); }); }
  $('#col', body).onchange = (e) => live(() => { o.color = e.target.value; });
  const fl = $('#flip', body); if (fl) fl.onclick = () => live(() => { o.flip = !o.flip; });
  const hg = $('#hinge', body); if (hg) hg.onclick = () => live(() => { o.hinge = o.hinge === 'right' ? 'left' : 'right'; });
  const sh = $('#sh', body); if (sh) sh.onchange = (e) => live(() => { o.shutter = e.target.checked; });
  $('#del', body).onclick = () => plan.deleteSelection();
}

function renderStyle(body) {
  const p = store.project, lv = store.level;
  body.innerHTML = `
    <h2 class="t">Style de la maison</h2>
    <h3 class="s">Façade</h3>${swatchRow(FACADES, p.style.facade, 'facade')}<div class="matname">${esc(materialInfo(p.style.facade)?.name)}</div>
    <h3 class="s">Toiture</h3>
    <div class="field"><label>Forme</label><select id="roofT">${[['gable', '2 pans'], ['hip', '4 pans'], ['mono', 'Monopente'], ['flat', 'Toit-terrasse'], ['none', 'Aucune']].map(([k, l]) => `<option value="${k}" ${p.roof.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label>Pente (°)</label><input type="number" id="pitch" min="5" max="60" value="${p.roof.pitch}"/></div>
    <div class="field"><label>Débord (cm)</label><input type="number" id="ov" value="${p.roof.overhang}"/></div>
    ${swatchRow(ROOFS, p.style.roof, 'roof')}<div class="matname">${esc(materialInfo(p.style.roof)?.name)}</div>
    <div class="field"><label>Menuiseries</label><input type="color" id="joi" value="${p.style.joinery}" style="height:36px;padding:2px"/></div>
    <h3 class="s">Terrain</h3>${swatchRow(GROUNDS, p.site.ground, 'ground')}
    <h3 class="s">Emplacement et ensoleillement</h3>
    <div class="field"><label>Latitude</label><input type="number" step="0.01" id="lat" value="${p.site.lat}"/></div>
    <div class="field"><label>Longitude</label><input type="number" step="0.01" id="lon" value="${p.site.lon}"/></div>
    <div class="field"><label>Orientation du nord (°)</label><input type="number" id="north" value="${p.site.north}"/></div>
    <p class="note">Réglé par défaut sur Albi. Le soleil de la vue 3D suit sa position réelle à cet endroit : tu peux vérifier quelle pièce est éclairée le matin ou le soir.</p>
    <h3 class="s">${esc(lv.name)}</h3>
    <div class="field wide"><label>Nom</label><input id="lvn" value="${esc(lv.name)}"/></div>
    <div class="field"><label>Hauteur sous plafond (cm)</label><input type="number" id="lvh" value="${lv.height}"/></div>
    <h3 class="s">Plan de l'architecte</h3>
    <p class="muted small">Importe la photo d'un plan et décalque les murs par-dessus.</p>
    <div class="btnrow"><label class="btn block">Importer une image<input type="file" id="bg" accept="image/*" hidden/></label></div>
    ${lv.background ? `<div class="field"><label>Largeur réelle du plan (m)</label><input type="number" step="0.1" id="bgw" value="${((lv.background.width * lv.background.scale) / 100).toFixed(1)}"/></div>
    <div class="field"><label>Opacité</label><input type="range" min="0.1" max="1" step="0.05" id="bgo" value="${lv.background.opacity}"/></div><div class="btnrow"><button class="btn danger block" id="bgx">Retirer le plan</button></div>` : ''}`;
  body.querySelectorAll('.swatch').forEach((b) => { b.onclick = () => { live(() => {
    const k = b.dataset.kind, m = b.dataset.m;
    if (k === 'facade') p.style.facade = m; if (k === 'roof') p.style.roof = m; if (k === 'ground') p.site.ground = m;
  }); render(); }; });
  const bind = (id, fn) => { const el = $(`#${id}`, body); if (el) el.onchange = (e) => { live(() => fn(e.target.value)); if (id === 'lvn') fillLevels(); }; };
  bind('roofT', (v) => { p.roof.type = v; }); bind('pitch', (v) => { p.roof.pitch = Number(v); }); bind('ov', (v) => { p.roof.overhang = Number(v); });
  bind('joi', (v) => { p.style.joinery = v; }); bind('lat', (v) => { p.site.lat = Number(v); }); bind('lon', (v) => { p.site.lon = Number(v); }); bind('north', (v) => { p.site.north = Number(v); });
  bind('lvn', (v) => { lv.name = v; }); bind('lvh', (v) => { lv.height = Number(v); });
  bind('bgw', (v) => { lv.background.scale = (Number(v) * 100) / lv.background.width; });
  bind('bgo', (v) => { lv.background.opacity = Number(v); });
  const x = $('#bgx', body); if (x) x.onclick = () => { live(() => { lv.background = null; }); render(); };
  $('#bg', body).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = await createImageBitmap(f);
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const src = c.toDataURL('image/jpeg', 0.78);
    const w0 = plan.toWorld(plan.w * 0.1, plan.h * 0.1);
    live(() => { lv.background = { src, x: w0.x, y: w0.y, scale: 1200 / c.width, width: c.width, opacity: 0.5 }; });
    setView('plan'); render();
    toast('Indique maintenant la largeur réelle du plan.');
  };
}

function renderBudget(body) {
  const b = budget(store), s = surfaces(store);
  const rooms = new Map();
  for (const l of b.lines) { if (!rooms.has(l.room)) rooms.set(l.room, []); rooms.get(l.room).push(l); }
  body.innerHTML = `
    <h2 class="t">Budget</h2>
    <div class="total"><span class="muted">Mobilier restant à acheter</span><b>${euro(b.furn)}</b></div>
    <div class="total"><span class="muted">Sols (fournitures)</span><b>${euro(b.finTotal)}</b></div>
    <div class="total"><span class="muted">Surface habitable</span><b>${s.habitable.toFixed(0)} m²</b></div>
    <div class="note">Construction, ordre de grandeur en France : ${euro(b.build.low)} à ${euro(b.build.high)} hors terrain (1 700 à 2 600 €/m²). À confirmer par des devis.</div>
    ${[...rooms].map(([name, list]) => `<h3 class="s">${esc(name)} · ${euro(list.reduce((t, l) => t + l.price, 0))}</h3>${list.map((l) => `<div class="line"><input type="checkbox" data-b="${l.it.id}" ${l.it.bought ? 'checked' : ''} style="width:20px;height:20px" aria-label="Acheté"/><img data-th="${esc(l.def.id)}" alt=""/><div class="m"><b>${esc(l.def.name)}</b><span>${esc(l.def.label)}</span></div><div class="r"><a href="${esc(purchaseLinks(l.def)[0]?.url || '#')}" target="_blank" rel="noopener">${euro(l.price)}</a></div></div>`).join('')}`).join('') || '<p class="muted" style="margin-top:14px">Place des meubles pour construire le budget.</p>'}
    ${b.finishes.length ? `<h3 class="s">Sols</h3>${b.finishes.map((f) => `<div class="line"><div class="m"><b>${esc(f.name)}</b><span>${f.area.toFixed(1).replace('.', ',')} m²</span></div><div class="r">${euro(f.price)}</div></div>`).join('')}` : ''}
    <div class="btnrow"><button class="btn block" id="csv">Exporter la liste d'achats</button></div>`;
  fillThumbs(body);
  body.querySelectorAll('[data-b]').forEach((c) => { c.onchange = () => { for (const lv of store.project.levels) { const it = lv.items.find((i) => i.id === c.dataset.b); if (it) { live(() => { it.bought = c.checked; }); } } render(); }; });
  $('#csv', body).onclick = () => {
    const rows = [['Pièce', 'Article', 'Type', 'Prix', 'Acheté', 'Lien'], ...b.lines.map((l) => [l.room, l.def.name, l.def.label, Math.round(l.price), l.it.bought ? 'oui' : 'non', purchaseLinks(l.def)[0]?.url || ''])];
    downloadBlob(new Blob(['﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' }), 'liste-achats.csv');
  };
}

function renderAdvice(body) {
  const list = runChecks(store);
  body.innerHTML = `<h2 class="t">Conseils</h2><p class="muted small">Repères de confort et règles françaises courantes. Ils ne remplacent ni un architecte ni le PLU de la commune.</p>${list.map((c) => `<div class="check ${c.level}"><b>${esc(c.title)}</b><span>${esc(c.text)}</span></div>`).join('')}`;
}

async function renderPhotos(body) {
  body.innerHTML = '<h2 class="t">Photos</h2><p class="muted small">Tes images photoréalistes. En 3D, choisis un point de vue puis touche « Photo ».</p><div class="renders" id="rs"></div>';
  const all = (await dbAll('renders')).filter((r) => r.value.project === store.project.id).reverse();
  const box = $('#rs', body);
  if (!all.length) { box.outerHTML = '<p class="muted" style="margin-top:14px">Aucune image pour l’instant.</p>'; return; }
  box.innerHTML = all.map((r) => `<div><img src="${URL.createObjectURL(r.value.blob)}" alt="Rendu de la maison"/><div class="btnrow"><button class="btn" data-dl="${r.key}">Télécharger</button><button class="btn danger" data-rm="${r.key}">${icon('trash')}</button></div></div>`).join('');
  box.onclick = async (e) => {
    const dl = e.target.closest('[data-dl]'), rm = e.target.closest('[data-rm]');
    if (dl) { const r = await dbGet('renders', dl.dataset.dl); downloadBlob(r.blob, 'rendu.jpg'); }
    if (rm) { await dbDel('renders', rm.dataset.rm); render(); }
  };
}

async function renderProjects(body) {
  const list = (await dbAll('projects')).map((x) => x.value).sort((a, b) => b.updated - a.updated);
  body.innerHTML = `<h2 class="t">Projets</h2><p class="muted small">Crée plusieurs versions pour comparer vos idées.</p><div style="margin-top:10px">${list.map((p) => `<div class="proj ${p.id === store.project.id ? 'on' : ''}"><button class="m" data-open="${p.id}"><b>${esc(p.name)}</b><div class="muted small">Modifié le ${new Date(p.updated).toLocaleDateString('fr-FR')}</div></button><button class="iconbtn" data-copy="${p.id}" title="Dupliquer">${icon('copy')}</button><button class="iconbtn" data-del="${p.id}" title="Supprimer">${icon('trash')}</button></div>`).join('')}</div>
  <div class="btnrow"><button class="btn pri block" id="new">Nouveau projet</button></div>
  <h3 class="s">Passer d'un appareil à l'autre</h3>
  <p class="muted small">Envoie le fichier du projet à ton autre appareil, puis ouvre-le ici.</p>
  <div class="btnrow"><button class="btn" id="exp">Envoyer ce projet</button><label class="btn">Ouvrir un fichier<input type="file" id="imp" accept=".json,.maison,application/json" hidden/></label></div>
  <div class="field wide" style="margin-top:12px"><label>Nom</label><input id="pname" value="${esc(store.project.name)}"/></div>
  <h3 class="s">Crédits</h3><p class="muted small">Modèles scannés, ciels et matières : Poly Haven (CC0). Prix et dimensions : fiches produits publiques. Les marques citées appartiennent à leurs propriétaires ; aucun partenariat.</p>`;
  $('#new', body).onclick = templatePicker;
  $('#pname', body).onchange = (e) => { live(() => { store.project.name = e.target.value; }); fillLevels(); };
  $('#exp', body).onclick = async () => {
    const name = `${store.project.name}.maison.json`;
    const file = new File([JSON.stringify(store.project)], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: store.project.name }); return; } catch { /* partage annulé */ } }
    downloadBlob(file, name);
  };
  $('#imp', body).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (!p.levels || !p.site) throw new Error('format');
      await store.save();
      openProject(p); await store.save(); render();
      toast('Projet ouvert.');
    } catch { toast('Ce fichier n’est pas un projet Notre Maison.'); }
  };
  body.onclick = async (e) => {
    const o = e.target.closest('[data-open]'), c = e.target.closest('[data-copy]'), d = e.target.closest('[data-del]');
    if (o) { await store.save(); openProject(await dbGet('projects', o.dataset.open)); render(); }
    if (c) { await store.save(); const p = await dbGet('projects', c.dataset.copy); const n = { ...p, id: uid('P'), name: `${p.name} (version 2)`, updated: Date.now() }; await dbPut('projects', n.id, n); render(); }
    if (d && d.dataset.del !== store.project.id && confirm('Supprimer définitivement ce projet ?')) { await dbDel('projects', d.dataset.del); render(); }
  };
}

function renderMore(body) {
  body.innerHTML = `<h2 class="t">Plus</h2>${[['style', 'Style de la maison', 'Façade, toiture, terrain, plan importé'], ['advice', 'Conseils', 'Règles et confort'], ['photos', 'Photos', 'Images photoréalistes'], ['projects', 'Projets', 'Versions, passer d’un appareil à l’autre']].map(([k, a, b]) => `<button class="tpl" data-k="${k}"><b>${a}</b><span class="muted small">${b}</span></button>`).join('')}`;
  body.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => openTab(b.dataset.k); });
}

function customForm() {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><h2 class="t">Ajouter un meuble trouvé en ligne</h2><p class="muted small">Colle le lien et recopie les dimensions de la fiche.</p>
  <div class="field wide"><label>Nom</label><input id="cn" placeholder="Canapé Lazare"/></div>
  <div class="field wide"><label>Lien</label><input id="cu" type="url" placeholder="https://…"/></div>
  <div class="field wide"><label>Boutique</label><input id="cb" placeholder="AM.PM"/></div>
  <div class="field wide"><label>Forme 3D</label><select id="ct">${[['sofa', 'Canapé'], ['bed', 'Lit'], ['table', 'Table'], ['chair', 'Chaise'], ['drawers', 'Commode'], ['wardrobe', 'Armoire'], ['bookcase', 'Bibliothèque'], ['tvBench', 'Meuble TV'], ['rug', 'Tapis'], ['floorLamp', 'Lampadaire'], ['pendant', 'Suspension']].map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
  <div class="dims" style="margin:8px 0"><div><label>Largeur cm</label><input id="cw" type="number" value="200"/></div><div><label>Profondeur</label><input id="cd" type="number" value="90"/></div><div><label>Hauteur</label><input id="ch" type="number" value="80"/></div></div>
  <div class="field"><label>Prix (€)</label><input id="cp" type="number" value="0"/></div>
  <div class="field"><label>Couleur</label><input id="cc" type="color" value="#b7ab98" style="height:36px;padding:2px"/></div>
  <div class="btnrow"><button class="btn" id="cx">Annuler</button><button class="btn pri" id="ok">Ajouter</button></div></div>`;
  document.body.append(m);
  $('#cx', m).onclick = () => m.remove();
  $('#ok', m).onclick = () => {
    const url = $('#cu', m).value.trim();
    if (url && !/^https?:\/\//i.test(url)) { toast('Le lien doit commencer par https://'); return; }
    const type = $('#ct', m).value, color = $('#cc', m).value;
    const item = { id: uid('c'), name: $('#cn', m).value || 'Mon meuble', label: $('#ct', m).selectedOptions[0].textContent, brand: $('#cb', m).value || 'Boutique', cat: 'perso', sub: 'perso', w: Number($('#cw', m).value), d: Number($('#cd', m).value), h: Number($('#ch', m).value), price: Number($('#cp', m).value), color, url: url || undefined, query: $('#cn', m).value, model: { kind: 'proc', type, p: { color, seats: 3, cols: 2, rows: 3, doors: 2 }, color } };
    store.mutate((p) => { p.custom = [...(p.custom || []), item]; });
    setCustom(store.project.custom);
    ui.cat = 'perso'; ui.sub = null; ui.q = '';
    m.remove(); render();
  };
}

function templatePicker() {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><h2 class="t">Nouvelle maison</h2><p class="muted small">Par où commencer ?</p>${TEMPLATES.map((t) => `<button class="tpl" data-t="${t.id}"><b>${t.name}</b><span class="muted small">${t.desc}</span></button>`).join('')}<div class="btnrow"><button class="btn" id="mx">Annuler</button></div></div>`;
  document.body.append(m);
  $('#mx', m).onclick = () => m.remove();
  m.querySelectorAll('[data-t]').forEach((b) => { b.onclick = async () => {
    await store.save();
    openProject(TEMPLATES.find((t) => t.id === b.dataset.t).make());
    await store.save();
    m.remove(); render();
  }; });
}

function openProject(p) {
  setCustom(p.custom);
  store.levelIndex = 0;
  store.load(p);
  plan.fitted = false; plan.fit();
  ui.framed = false;
  fillLevels();
  if (ui.view === '3d') { view.rebuild(); view.frame(); ui.framed = true; }
}

// ——— Événements du magasin ———
store.addEventListener('select', () => {
  ui.detail = null;
  if (store.selection && narrow() && store.selection.type !== 'node') setPanel(true);
  render();
});
store.addEventListener('change', () => {
  syncChrome();
  if (['budget', 'advice'].includes(ui.tab) && !store.selection) render();
  $('#saved').textContent = 'Enregistrement…';
});
store.addEventListener('saved', () => { $('#saved').textContent = 'Enregistré'; });
store.addEventListener('project', fillLevels);
store.addEventListener('level', () => { fillLevels(); render(); });

// ——— Démarrage ———
(async function boot() {
  let project;
  try {
    const id = localStorage.getItem('nm-current');
    if (id) project = await dbGet('projects', id);
  } catch (e) { console.warn(e); }
  if (!project) project = TEMPLATES[0].make();
  openProject(project);
  store.save();
  document.querySelectorAll('#presetSeg button')[0].classList.add('on');
  setPanel(!narrow());
  setView('plan');
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
