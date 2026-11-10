import './style.css';
import { store, newLevel, addNode, addWall, dbAll, dbGet, dbPut, dbDel, uid, ROOM_TYPES, roomType } from './state.js';
import { Plan2D } from './plan2d.js';
import { allItems, getItem, CATEGORIES, subLabel, purchaseLinks, OPENINGS, setCustom, catalogStats, isHerStyle, isDoorType, loadMore, needsMore } from './catalog.js';
import { ensureTerrain, commitTerrain, shapeTerrain, seatHouse, flattenAround, applyBrush, heightAt, TERRAIN_SHAPES, SLOPE_DEFAULT, DIRECTIONS, BRUSHES, ENVIRONMENTS } from './terrain.js';
import { FLOORS, PAINTS, WALL_FINISHES, FACADES, ROOFS, GROUNDS, materialInfo, buyLinks } from './materials-data.js';
import { TEMPLATES, MANOR_VERSION, windowsOf, facing, boxOf } from './templates.js';
import { runChecks, surfaces } from './advice.js';
import { fullBudget, budgetSettings, GAMMES, MODES, MARKET, BUDGET_SOURCES } from './budget.js';
import { dist, analyzeLevel, itemCorners, pointInPolygon, sunPosition } from './geometry.js';
import { parcelOf, parcelArea, checkParcel, setbackOf, metres } from './parcel.js';
import { tourSeen, startTour } from './tour.js';
import { QUALITY_PREF, AUTO_LOW, setQuality } from './quality.js';
import { sync, connect, disconnect, queuePush, removeShared, knownCode, knownName, isEnabled } from './sync.js';
import { isGroup, newGroup, isEmptyGroup, addLevel, addHouse, addGarden, addSameSpot, stats as groupStats, moveBy, rotate as rotateGroup, duplicate as duplicateGroup } from './group.js';
const SUN_DAYS = [[172, '21 juin'], [264, '21 sept.'], [355, '21 déc.'], [80, '21 mars'], ['today', 'Aujourd’hui'], [15, 'Mi-janvier'], [46, 'Mi-février'], [105, 'Mi-avril'], [135, 'Mi-mai'], [196, 'Mi-juillet'], [227, 'Mi-août'], [288, 'Mi-octobre'], [319, 'Mi-novembre']];

const ICONS = {
  select: '<path d="M5 3l14 8-6 2-2 6z"/>', zone: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M12 8v8M8 12h8"/>', wall: '<path d="M3 7h18M3 12h18M3 17h18M9 7v5M15 12v5M6 12v5M18 7v5"/>', room: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 12h6"/>',
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
        <button data-t="zone">${icon('zone')}Groupe</button>
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
        <button class="sunmore" id="sunMore" aria-label="Plus de réglages">⋯</button>
        <div class="row2"><select class="chip" id="sunDay" aria-label="Date">${SUN_DAYS.map(([d, l]) => `<option value="${d}" ${d === 172 ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="chip" id="sunPlay" title="Faire défiler la journée">▶ Journée</button><button class="chip on" id="lamps">Lampes</button><button class="chip" id="abBtn" title="Garder la vue pour comparer après un changement">Avant / après</button><span style="flex:1"></span><span>Exposition</span><input type="range" id="expo" min="0.4" max="2.4" step="0.05" value="1" style="width:96px"/></div>
      </div>
      <div class="navpad" id="navpad"><button data-n="left" aria-label="Aller à gauche">◄</button><button data-n="up" aria-label="Avancer">▲</button><button data-n="down" aria-label="Reculer">▼</button><button data-n="right" aria-label="Aller à droite">►</button><button data-n="turnL" aria-label="Tourner à gauche">↺</button><button data-n="turnR" aria-label="Tourner à droite">↻</button><button data-n="tiltU" aria-label="Regarder plus du dessus">⤒</button><button data-n="tiltD" aria-label="Regarder plus de face">⤓</button><button data-n="in" aria-label="Zoomer">+</button><button data-n="out" aria-label="Dézoomer">−</button></div>
      <div class="ab hidden" id="abView"><img id="abImg" alt="Avant"/><div class="abhandle" id="abHandle"><i></i></div><span class="abl l">Avant</span><span class="abl r">Après</span>
        <div class="abbar"><button class="chip" id="abNew">Nouvel avant</button><button class="chip on" id="abClose">Fermer</button></div></div>
      <div class="measpill hidden" id="measPill"></div>
      <div class="loadpill hidden" id="loadPill"><i></i><span></span></div>
      <div class="walkgo hidden" id="walkgo"><select id="walkRoom" aria-label="Aller dans une pièce"></select><button class="chip abwalk" id="abWalk">Avant / après</button><button class="chip measwalk" id="measWalk">Mesurer</button></div>
      <div class="joy hidden" id="joy"><i></i></div>
      <div class="photoHud hidden" id="photoHud">
        <div style="display:flex;justify-content:space-between;gap:10px"><b id="phTitle">Préparation…</b><small id="phCount"></small></div>
        <div class="bar"><i id="phBar"></i></div>
        <div class="acts"><button class="pri" id="phSave">Enregistrer l'image</button><button id="phClose">Terminer</button></div>
      </div>
    </div>
    <div class="selbar hidden" id="selbar"></div>
    <div class="brushbar hidden" id="brushbar"></div>
    <button class="paneltoggle" id="panelToggle" title="Masquer ou afficher le panneau" aria-label="Masquer ou afficher le panneau">›</button>
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
let view = null, viewLoading = null, thumbs = null;
window.__maison = { store, plan, get view() { return view; } };

/** Le moteur 3D n'est téléchargé qu'au moment où on en a besoin. */
function loadView() {
  viewLoading ||= import('./view3d.js').then(({ View3D }) => { view = new View3D($('#view')); return view; }).catch((e) => { viewLoading = null; throw e; });
  return viewLoading;
}
async function customThumb(def, img) {
  if (!thumbs) { const { ThumbRenderer } = await import('./thumbs.js'); thumbs ||= new ThumbRenderer(); }
  thumbs.request(def, img);
}

const narrow = () => matchMedia('(max-width: 820px)').matches;
const TABS = [['catalog', 'Meubles'], ['style', 'Style'], ['terrain', 'Terrain'], ['budget', 'Budget'], ['shopping', 'Achats'], ['measures', 'Mesures'], ['advice', 'Conseils'], ['photos', 'Photos'], ['projects', 'Projets']];
const ui = { view: 'plan', tab: 'catalog', cat: 'anna', sub: null, q: '', sort: 'pop', detail: null, panelOpen: !narrow() };

function toast(t) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = 'toast';
  const undo = typeof t === 'object' && t.undo;
  el.textContent = typeof t === 'object' ? t.text : t;
  if (undo) { const b = document.createElement('button'); b.textContent = 'Annuler'; b.onclick = () => { store.undo(); el.remove(); }; el.append(b); }
  const act = typeof t === 'object' && t.action;
  if (act) { const b = document.createElement('button'); b.textContent = act.label; b.onclick = () => { el.remove(); act.fn(); }; el.append(b); }
  document.body.append(el);
  setTimeout(() => el.remove(), act ? 7000 : undo ? 5000 : 2800);
}
store.addEventListener('toast', (e) => toast(e.detail));
// Caler un plan importé : on mesure un mur connu, puis on indique sa vraie longueur.
store.addEventListener('measured', (e) => {
  const { a, b } = e.detail, len = Math.hypot(b.x - a.x, b.y - a.y);
  toast({ text: `Trait de ${(len / 100).toFixed(2).replace('.', ',')} m.`, action: { label: 'Caler le plan dessus', fn: () => {
    const v = prompt('Longueur réelle de ce trait, en mètres ?', (len / 100).toFixed(2).replace('.', ','));
    const real = Number(String(v || '').replace(',', '.')) * 100;
    if (!real || real < 20) return;
    const f = real / len;
    live(() => { const bg = store.level.background; if (!bg) return; bg.scale *= f; bg.x = a.x - (a.x - bg.x) * f; bg.y = a.y - (a.y - bg.y) * f; });
    plan.measure = null; plan.draw();
    toast('Plan calé à la bonne échelle.');
    if (ui.tab === 'style') render();
  } } });
});
// Après une mise à jour de l'app, un ancien morceau peut avoir disparu : on recharge une seule fois.
addEventListener('vite:preloadError', () => { if (!sessionStorage.getItem('nm-reloaded')) { sessionStorage.setItem('nm-reloaded', '1'); location.reload(); } });
store.addEventListener('save-error', () => toast('Sauvegarde impossible sur cet appareil.'));

async function setView(v) {
  $('#abView')?.classList.add('hidden'); $('#viewLayer')?.classList.remove('comparing');
  ui.view = v;
  $('#planLayer').classList.toggle('hidden', v !== 'plan');
  $('#viewLayer').classList.toggle('hidden', v !== '3d');
  syncChrome();
  if (v === 'plan') { view?.setActive(false); plan.resize(); return; }
  if (!view) {
    showPill('Préparation de la 3D…');
    try { await loadView(); }
    catch (e) {
      console.error(e); hidePill();
      toast('La 3D n’a pas pu se charger. Vérifie ta connexion et réessaie.');
      setView('plan');
      return;
    }
    hidePill();
    if (ui.view !== '3d') return;
  }
  view.env.sky = ui.sky;
  view.setActive(true);
  if (!ui.framed) { view.frame(); ui.framed = true; }
}

function showPill(text) { const p = $('#loadPill'); p.classList.remove('hidden'); p.lastElementChild.textContent = text; }
function hidePill() { $('#loadPill').classList.add('hidden'); }
store.addEventListener('loading', (e) => {
  if (e.detail && e.detail.loaded < e.detail.total) showPill(`Chargement ${e.detail.loaded} / ${e.detail.total}`);
  else hidePill();
});

function setPanel(open) { ui.panelOpen = open; $('#panel').classList.toggle('open', open); syncChrome(); }
$('#panelToggle').onclick = () => {
  const hide = $('.work').classList.toggle('nopanel');
  $('#panelToggle').textContent = hide ? '‹' : '›';
};
function openTab(t) { ui.tab = t; ui.detail = null; if (store.selection) store.selection = null; setPanel(true); render(); }

function syncChrome() {
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === ui.view));
  document.querySelectorAll('#bottomnav button').forEach((b) => {
    const n = b.dataset.n;
    const on = ui.panelOpen ? (n === ui.tab || (n === 'more' && ['style', 'terrain', 'shopping', 'measures', 'advice', 'photos', 'projects', 'more'].includes(ui.tab))) : n === ui.view;
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
  if (e.target.value === 'up') {
    store.mutate((p) => { const e0 = p.entry || 0; p.levels.push(newLevel(`Étage ${p.levels.length - e0}`, 250)); });
    store.setLevel(store.project.levels.length - 1); fillLevels(); plan.fitted = false; plan.fit(); return;
  }
  if (e.target.value === 'down') {
    addLevelBelow(); store.setLevel(0); fillLevels(); plan.fitted = false; plan.fit();
    toast('Niveau créé sous le précédent, avec le même contour. Ajoute ses cloisons, puis un escalier.');
    return;
  }
  store.setLevel(Number(e.target.value));
  plan.fitted = false; plan.fit();
};

/** Ajoute un niveau sous tous les autres, avec le même contour extérieur. */
function addLevelBelow() {
  store.mutate((p) => {
    const e = p.entry || 0, ref = p.levels[0], a = store.analysis(ref);
    const n = newLevel(e > 0 ? 'Sous-sol' : 'Rez-de-jardin', 250);
    for (const w of a.walls) {
      if ((a.sideRoom.get(`${w.id}:L`) === undefined) === (a.sideRoom.get(`${w.id}:R`) === undefined)) continue;
      const A = ref.nodes[w.a], B = ref.nodes[w.b];
      addWall(n, addNode(n, A.x, A.y), addNode(n, B.x, B.y), w.thickness);
    }
    p.levels.unshift(n);
    p.entry = e + 1;
    store.levelIndex += 1;
  });
}

function fillLevels() {
  const lv = store.project.levels;
  $('#level').innerHTML = '<option value="up">+ Ajouter un étage au-dessus</option>' + lv.map((l, i) => [i, l]).reverse().map(([i, l]) => `<option value="${i}" ${i === store.levelIndex ? 'selected' : ''}>${esc(l.name)}</option>`).join('') + '<option value="down">+ Ajouter un niveau en dessous</option>';
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
    const groups = [...new Set(OPENINGS.map((o) => o.group))];
    pop.innerHTML = `<div class="popcustom"><b>Sur mesure</b><div class="row"><label>L<input id="ocW" type="number" value="400"/></label><label>H<input id="ocH" type="number" value="225"/></label><label>Allège<input id="ocS" type="number" value="0"/></label></div><select id="ocT">${OPENING_TYPES.map(([k, l]) => `<option value="${k}" ${k === 'bay' ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><button id="ocGo" class="btn pri block">Placer sur un mur</button></div>${groups.map((g) => `<h4>${g}</h4>${OPENINGS.map((o, i) => (o.group === g ? `<button data-i="${i}">${esc(o.name)} <span class="muted small">${(o.width / 100).toFixed(2).replace('.', ',')} × ${(o.height / 100).toFixed(2).replace('.', ',')} m</span></button>` : '')).join('')}`).join('')}`;
    pop.classList.remove('hidden');
    return;
  }
  plan.setTool(t);
};
const OPENING_TYPES = [['bay', 'Baie coulissante'], ['glasswall', 'Mur vitré'], ['atelier', 'Verrière atelier'], ['window1', 'Fenêtre 1 vantail'], ['window2', 'Fenêtre 2 vantaux'], ['fixed', 'Fenêtre fixe'], ['door', 'Porte'], ['double', 'Porte double'], ['sliding-door', 'Porte coulissante'], ['pocket', 'Porte à galandage'], ['entry', "Porte d'entrée"], ['garage', 'Porte de garage'], ['passage', 'Passage ouvert'], ['arch', 'Arche']];
$('#openPop').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'ocGo') {
    const P = $('#openPop'), type = $('#ocT', P).value;
    plan.setTool('opening', { type, name: OPENING_TYPES.find((t) => t[0] === type)[1], width: Math.max(30, Number($('#ocW', P).value) || 100), height: Math.max(30, Number($('#ocH', P).value) || 200), sill: Math.max(0, Number($('#ocS', P).value) || 0) });
    P.classList.add('hidden');
    return;
  }
  plan.setTool('opening', OPENINGS[Number(b.dataset.i)]);
  $('#openPop').classList.add('hidden');
};
const HINTS = { parcel: 'Touche chaque coin du terrain, puis le premier pour fermer.', roof: 'Fais glisser sur la partie à couvrir.', wall: 'Touche pour poser chaque angle. Double-touche pour finir.', room: 'Fais glisser pour tracer une pièce rectangulaire.', opening: 'Touche un mur pour y placer l’ouverture.', measure: 'Fais glisser entre deux points.' };
store.addEventListener('tool', (e) => {
  const h = $('#hint'), txt = HINTS[e.detail];
  h.classList.toggle('hidden', !txt && e.detail !== 'zone');
  h.classList.toggle('multi', e.detail === 'zone');
  if (e.detail === 'zone') {
    const levels = store.project.levels.length > 1;
    h.innerHTML = `<span>Encadre ce que tu veux déplacer, ou touche des pièces.</span><button id="zLevel">${levels ? 'Ce niveau' : 'Toute la maison'}</button>${levels ? '<button id="zHouse">Toute la maison</button>' : ''}<button id="hintEnd">Terminer</button>`;
    $('#zLevel').onclick = () => selectAll(!levels);
    if (levels) $('#zHouse').onclick = () => selectAll(true);
    $('#hintEnd').onclick = () => { store.select(null); plan.setTool('select'); };
  } else if (txt) { h.innerHTML = `<span>${txt}</span><button id="hintEnd">Terminer</button>`; $('#hintEnd').onclick = () => plan.setTool('select'); }
  syncChrome();
});

// ——— Commandes 3D ———
$('#presetSeg').onclick = (e) => { const p = e.target.dataset.p; if (p) setPreset(p); };
function setPreset(p) {
  view.setPreset(p);
  document.querySelectorAll('#presetSeg button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
  const walk = p === 'walk';
  $('#walkgo').classList.toggle('hidden', !walk);
  const touch = matchMedia('(pointer: coarse)').matches;
  $('#joy').classList.toggle('hidden', !walk || !touch);
  $('#viewLayer').classList.toggle('walking', walk);
  $('#navpad').classList.toggle('hidden', walk);
  if (walk) {
    fillWalkRooms();
    if (!ui.walkHint) { ui.walkHint = true; toast(touch ? 'Le pad avance et tourne d’un seul doigt. Glisse ailleurs pour regarder, touche le sol pour t’y rendre.' : 'Clique une fois : le regard suit ta souris ou ton pavé. Maintiens le clic ou Z pour avancer, Maj pour courir, Échap pour reprendre la main.'); }
  }
}
function fillWalkRooms() {
  const lv = store.level;
  $('#walkRoom').innerHTML = '<option value="">Aller dans…</option>' + lv.rooms.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
}
$('#walkRoom').onchange = (e) => { const r = store.level.rooms.find((x) => x.id === e.target.value); if (r) view.startWalk(r); e.target.value = ''; };
const fmtHour = (h) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
function updateSun() { const h = Number($('#hour').value); $('#hourV').textContent = fmtHour(h); view.setEnv({ hour: h, day: sunDay() }); }
function sunDay() { const v = $('#sunDay').value; if (v !== 'today') return Number(v); const n = new Date(); return Math.round((n - new Date(n.getFullYear(), 0, 0)) / 864e5); }
$('#hour').oninput = () => { stopPlay(); updateSun(); };
$('#sunDay').onchange = updateSun;
// La journée défile de 6 h à 22 h en une quinzaine de secondes.
let playing = 0;
function stopPlay() { if (!playing) return; cancelAnimationFrame(playing); playing = 0; $('#sunPlay').textContent = '▶ Journée'; }
$('#sunPlay').onclick = () => {
  if (playing) { stopPlay(); return; }
  const el = $('#hour'); let h = Number(el.value) >= 21.5 ? 6 : Math.max(6, Number(el.value)), last = 0;
  $('#sunPlay').textContent = '■ Arrêter';
  const step = (t) => {
    if (last && t - last < 90) { playing = requestAnimationFrame(step); return; }
    const dt = last ? (t - last) / 1000 : 0; last = t;
    h = Math.min(22, h + dt * 1.05); el.value = h; updateSun();
    if (h >= 22) { playing = 0; $('#sunPlay').textContent = '▶ Journée'; return; }
    playing = requestAnimationFrame(step);
  };
  playing = requestAnimationFrame(step);
};
$('#lamps').onclick = (e) => { view.env.lamps = !view.env.lamps; e.target.classList.toggle('on', view.env.lamps); view.updateLamps(); };
$('#expo').oninput = (e) => view.setEnv({ exposure: Number(e.target.value) });
$('#hourV').textContent = fmtHour(15);
// ——— Avant / après : on garde une image, on change un meuble, puis on compare au même endroit ———
const ab = { before: null, pose: null, x: 0.5 };
function abLabel() { for (const b of [$('#abBtn'), $('#abWalk')]) { b.textContent = ab.before ? 'Comparer' : 'Avant / après'; b.classList.toggle('on', !!ab.before); } }
function abKeep() {
  ab.before = view.grab(); ab.pose = view.pose(); ab.size = [view.renderer.domElement.clientWidth, view.renderer.domElement.clientHeight];
  abLabel();
  toast('Vue « avant » gardée. Change un meuble, une couleur, un sol… puis touche « Comparer ».');
}
async function abShow() {
  const pz = ab.pose;
  if (pz.level !== store.levelIndex) { store.setLevel(pz.level); fillLevels(); }
  if (pz.preset !== view.preset) setPreset(pz.preset);
  view.setPose(pz);
  await new Promise((r) => setTimeout(r, 700));
  view.setPose(pz);
  $('#abImg').src = ab.before;
  ab.x = 0.5; abPlace();
  $('#abView').classList.remove('hidden'); $('#viewLayer').classList.add('comparing');
  const c = view.renderer.domElement;
  if (Math.abs(c.clientWidth - ab.size[0]) > 4 || Math.abs(c.clientHeight - ab.size[1]) > 4) toast('La fenêtre a changé de taille : l’image « avant » est un peu déformée.');
}
function abPlace() { $('#abImg').style.clipPath = `inset(0 ${(1 - ab.x) * 100}% 0 0)`; $('#abHandle').style.left = `${ab.x * 100}%`; }
$('#abBtn').onclick = $('#abWalk').onclick = () => { if (ab.before) abShow(); else abKeep(); };
const abHide = () => { $('#abView').classList.add('hidden'); $('#viewLayer').classList.remove('comparing'); };
$('#abClose').onclick = abHide;
$('#abNew').onclick = () => { abHide(); ab.before = null; abLabel(); requestAnimationFrame(() => abKeep()); };
$('#abView').onpointerdown = (e) => {
  if (e.target.closest('.abbar')) return;
  const box = $('#abView').getBoundingClientRect();
  const move = (ev) => { ab.x = Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)); abPlace(); };
  move(e);
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
};
$('#sunMore').onclick = () => $('#sunbar').classList.toggle('more');

// Barre de commandes des vues 3D : maintenir un bouton pour continuer.
const NAV = { left: { pan: [-1, 0] }, right: { pan: [1, 0] }, up: { pan: [0, 1] }, down: { pan: [0, -1] }, turnL: { turn: 1 }, turnR: { turn: -1 }, tiltU: { tilt: -1 }, tiltD: { tilt: 1 }, in: { zoom: 0.985 }, out: { zoom: 1.015 } };
let navTimer = 0;
const navStop = () => { clearInterval(navTimer); navTimer = 0; };
$('#navpad').addEventListener('pointerdown', (e) => { const a = NAV[e.target.closest('[data-n]')?.dataset.n]; if (!a || !view) return; e.preventDefault(); navStop(); view.nudge(a); navTimer = setInterval(() => view.nudge(a), 28); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('#navpad').addEventListener(ev, navStop);

// Joystick de déplacement (tactile)
const joy = $('#joy'), knob = joy.firstElementChild;
const joyMove = (e) => {
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  const d = Math.hypot(dx, dy), max = 38;
  if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  view.move.f = -dy / max; view.move.t = -dx / max;
};
joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', (e) => { if (joy.hasPointerCapture(e.pointerId)) joyMove(e); });
const joyEnd = () => { knob.style.transform = ''; view.move.f = view.move.t = 0; };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

// ——— Mode photo ———
// Le bouton Photo propose deux images : comme à l'écran, ou de nuit avec toutes les lampes allumées.
$('#photoBtn').onclick = (e) => {
  e.stopPropagation();
  const old = $('#photoMenu'); if (old) { old.remove(); return; }
  const m = document.createElement('div'); m.className = 'photomenu'; m.id = 'photoMenu';
  m.innerHTML = '<button data-ph="now"><b>Photo comme à l’écran</b><span>Heure et date choisies</span></button><button data-ph="night"><b>Photo de soirée</b><span>Juste après le coucher du soleil, lampes allumées</span></button>';
  $('#v3bar').append(m);
  m.onclick = (ev) => { const b = ev.target.closest('[data-ph]'); if (!b) return; m.remove(); takePhoto(b.dataset.ph === 'night'); };
  setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off); } }), 0);
};
/** L'« heure bleue » du jour choisi : juste après le coucher, le ciel éclaire encore et les lampes brillent. */
function blueHour() {
  const { lat, lon } = store.project.site, day = sunDay();
  for (let h = 16; h <= 23; h += 0.05) {
    const summer = day > 86 && day < 300, alt = (sunPosition(lat, lon, day, h - (summer ? 2 : 1)).altitude * 180) / Math.PI;
    if (alt < -2.5) return Math.round(h * 4) / 4;
  }
  return 22;
}
async function takePhoto(night) {
  if (night) {
    ui.nightPrev = { hour: $('#hour').value, lamps: view.env.lamps, exposure: view.env.exposure };
    $('#hour').value = blueHour(); updateSun();
    view.env.lamps = true; $('#lamps').classList.add('on'); view.updateLamps();
    view.setEnv({ exposure: Math.max(1.5, view.env.exposure) });
    await new Promise((r) => setTimeout(r, 900));
  }
  const hud = $('#photoHud');
  hud.classList.remove('hidden'); $('#sunbar').classList.add('hidden'); $('#v3bar').classList.add('hidden');
  $('#walkgo').classList.add('hidden'); $('#joy').classList.add('hidden');
  $('#phTitle').textContent = 'Préparation de la scène…'; $('#phCount').textContent = ''; $('#phBar').style.width = '0';
  // Garde l'écran allumé pendant le calcul, quand l'appareil le permet.
  try { ui.wake = await navigator.wakeLock?.request('screen'); } catch { /* facultatif */ }
  const started = { at: 0, s: 0 };
  try {
    await view.startPhoto({
      target: matchMedia('(pointer: coarse)').matches ? 150 : 300,
      onProgress: (s, t) => {
        if (s >= 1 && !started.at) { started.at = performance.now(); started.s = s; }
        const rate = started.at && s > started.s + 2 ? (s - started.s) / ((performance.now() - started.at) / 1000) : 0;
        const left = rate ? Math.max(0, (t - s) / rate) : 0;
        $('#phTitle').textContent = s >= t ? 'Image terminée' : 'Rendu photoréaliste en cours';
        $('#phCount').textContent = `${Math.floor(s)} / ${t}${s < t && rate ? ` · encore ${left < 60 ? 'moins d’une minute' : `≈ ${Math.ceil(left / 60)} min`}` : ''}`;
        $('#phBar').style.width = `${Math.min(100, (s / t) * 100)}%`;
      },
    });
  } catch (err) {
    console.error(err);
    closePhoto();
    toast('Le mode photo ne fonctionne pas sur cet appareil. Ouvre le projet sur un ordinateur.');
  }
};
store.addEventListener('photo-lost', () => { closePhoto(); toast('L’appareil a manqué de mémoire pour le mode photo. Essaie sur un ordinateur.'); });
function closePhoto() {
  ui.wake?.release?.(); ui.wake = null;
  view.stopPhoto();
  if (ui.nightPrev) {
    const pv = ui.nightPrev; ui.nightPrev = null;
    $('#hour').value = pv.hour; view.env.lamps = pv.lamps; $('#lamps').classList.toggle('on', pv.lamps); view.updateLamps();
    view.setEnv({ exposure: pv.exposure }); updateSun();
  }
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
  else ({ catalog: renderCatalog, style: renderStyle, terrain: renderTerrain, budget: renderBudget, shopping: renderShopping, measures: renderMeasures, advice: renderAdvice, photos: renderPhotos, projects: renderProjects, more: renderMore }[ui.tab] || renderCatalog)(body);
  syncChrome();
}
$('#tabs').onclick = (e) => { const k = e.target.dataset.k; if (k) openTab(k); };

// Les vignettes du grand catalogue sont regroupées par planches : très peu de fichiers à télécharger.
const ATLAS = { cell: 160, cols: 8 }, sheets = new Map();
function sheet(n) {
  if (!sheets.has(n)) {
    const im = new Image(); im.src = `./thumbs/p/atlas-${n}.webp`;
    sheets.set(n, im.decode().then(() => im));
    if (sheets.size > 4) sheets.delete(sheets.keys().next().value);
  }
  return sheets.get(n);
}
async function atlasThumb(def, img) {
  const [n, i] = def.thumb, { cell, cols } = ATLAS;
  try {
    const s = await sheet(n), c = document.createElement('canvas');
    c.width = c.height = cell;
    c.getContext('2d').drawImage(s, (i % cols) * cell, Math.floor(i / cols) * cell, cell, cell, 0, 0, cell, cell);
    img.src = c.toDataURL('image/webp', 0.86);
  } catch { sheets.delete(n); customThumb(def, img); }
}

function thumbOf(def, img) {
  img.decoding = 'async';
  if (def.thumb) { atlasThumb(def, img); return; }
  if (def.model?.kind === 'ph') img.src = `./thumbs/${def.model.id}.webp`;
  else if (def.cat === 'perso') customThumb(def, img);
  else if (def.model?.kind === 'proc') {
    img.onerror = () => { img.onerror = null; customThumb(def, img); };
    img.src = `./thumbs/p/${def.id}.webp`;
  }
}

function fillThumbs(root) {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { io.unobserve(en.target); const def = getItem(en.target.dataset.th); if (def) thumbOf(def, en.target); }
  }, { root: $('#pbody'), rootMargin: '400px' });
  root.querySelectorAll('img[data-th]:not([data-o])').forEach((i) => { i.dataset.o = '1'; io.observe(i); });
}

// ——— Coups de cœur : chacun met un cœur, l'appli montre ce que vous aimez tous les deux ———
function myName() {
  let n = knownName(); try { n ||= localStorage.getItem('nm:heart') || ''; } catch { /* navigation privée */ }
  if (!n) { n = (prompt('Ton prénom, pour signer tes coups de cœur ?') || '').trim(); if (n) try { localStorage.setItem('nm:heart', n); } catch { /* navigation privée */ } }
  return n;
}
const likesOf = (id) => store.project?.likes?.[id] || [];
function toggleLike(id) {
  const me = myName(); if (!me) return false;
  store.snapshot();
  const all = store.project.likes ||= {}, cur = all[id] || [];
  all[id] = cur.includes(me) ? cur.filter((x) => x !== me) : [...cur, me];
  if (!all[id].length) delete all[id];
  store.commit({ rebuild: false });
  return true;
}
const heartHtml = (id) => { const l = likesOf(id), me = knownName() || (() => { try { return localStorage.getItem('nm:heart') || ''; } catch { return ''; } })(), on = l.includes(me);
  return `<button class="heart ${on ? 'on' : ''} ${l.length > 1 ? 'both' : ''}" data-heart="${esc(id)}" aria-label="Coup de cœur" title="${l.length ? esc(l.join(' et ')) : 'Coup de cœur'}">${on || l.length ? '♥' : '♡'}${l.length > 1 ? `<b>${l.length}</b>` : ''}</button>`; };
const inCat = (i) => (ui.cat === 'anna' ? isHerStyle(i) : ui.cat === 'likes' ? likesOf(i.id).length > 0 : i.cat === ui.cat);

function filteredItems() {
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(ui.q.trim());
  let list = allItems();
  if (q) { const words = q.split(/\s+/); list = list.filter((i) => { const t = norm(`${i.name} ${i.label} ${subLabel(i.sub)} ${i.brand}`); return words.every((w) => t.includes(w)); }); }
  else {
    list = list.filter(inCat);
    if (ui.sub) list = list.filter((i) => i.sub === ui.sub);
    if (ui.cat === 'likes') list = [...list].sort((a, b) => likesOf(b.id).length - likesOf(a.id).length);
  }
  if (ui.sort === 'asc') list = [...list].sort((a, b) => a.price - b.price);
  if (ui.sort === 'desc') list = [...list].sort((a, b) => b.price - a.price);
  return list;
}

function renderCatalog(body) {
  const subs = [...new Set(allItems().filter(inCat).map((i) => i.sub))];
  const likes = store.project?.likes || {}, nLikes = Object.keys(likes).length, nBoth = Object.values(likes).filter((l) => l.length > 1).length;
  const stats = catalogStats();
  body.innerHTML = `
    <input class="search" id="q" placeholder="Rechercher parmi ${stats.total} articles" value="${esc(ui.q)}"/>
    <div class="chips" id="cats">${nLikes || ui.cat === 'likes' ? `<button class="chip ${ui.cat === 'likes' ? 'on' : ''}" data-c="likes">♥ Coups de cœur${nLikes ? ` (${nLikes})` : ''}</button>` : ''}${CATEGORIES.filter(([k]) => k !== 'perso' || allItems().some((i) => i.cat === 'perso')).map(([k, l]) => `<button class="chip ${ui.cat === k ? 'on' : ''}" data-c="${k}">${l}</button>`).join('')}</div>
    ${!ui.q && subs.length > 1 ? `<div class="chips" id="subs"><button class="chip ${!ui.sub ? 'on' : ''}" data-s="">Tout</button>${subs.map((s) => `<button class="chip ${ui.sub === s ? 'on' : ''}" data-s="${s}">${subLabel(s)}</button>`).join('')}</div>` : ''}
    ${ui.cat === 'likes' && !ui.q ? `<p class="muted small" style="margin-top:8px">${nLikes ? `${nBoth ? `<b>${nBoth} meuble${nBoth > 1 ? 's' : ''} que vous aimez tous les deux</b>, en premier. ` : ''}Touche ♡ sur un meuble pour l’ajouter.` : 'Touche ♡ sur un meuble pour l’ajouter à vos coups de cœur.'} Avec le partage activé, ceux de l’autre arrivent ici aussi.</p>` : ''}
    <div id="gridWrap"></div>
    <div class="btnrow"><button class="btn block" id="addCustom">+ Ajouter un meuble trouvé en ligne</button></div>`;
  const PAGE = 40;
  const cardHtml = (i) => `<div class="card" role="button" tabindex="0" data-id="${esc(i.id)}" ${narrow() ? '' : 'draggable="true"'}><img class="th" data-th="${esc(i.id)}" alt=""/><button class="add" data-add="${esc(i.id)}" aria-label="Placer ${esc(i.name)}" title="Placer sur le plan">+</button>${heartHtml(i.id)}<div class="b"><div class="n">${esc(i.name)}</div><div class="l">${esc(i.label)}</div><div class="p"><span>${i.brand === 'IKEA' || i.brand === 'Générique' ? '' : `${esc(i.brand)} · `}${Math.round(i.w)}×${Math.round(i.d)}</span><b>${i.approx ? '≈ ' : ''}${euro(i.price)}</b></div></div></div>`;
  let list = [], shown = 0, more = null;
  const drawGrid = (keep = 0) => {
    list = filteredItems(); shown = 0;
    more?.disconnect();
    const wrap = $('#gridWrap', body);
    wrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px" class="small muted"><span>${list.length} article${list.length > 1 ? 's' : ''}</span><select id="sort" style="border:0;background:none;color:var(--soft)"><option value="pop" ${ui.sort === 'pop' ? 'selected' : ''}>Par défaut</option><option value="asc" ${ui.sort === 'asc' ? 'selected' : ''}>Prix croissant</option><option value="desc" ${ui.sort === 'desc' ? 'selected' : ''}>Prix décroissant</option></select></div>
    <div class="grid"></div><div id="moreItems" style="height:1px"></div>`;
    const grid = wrap.querySelector('.grid');
    const append = (n) => {
      const chunk = list.slice(shown, shown + n);
      grid.insertAdjacentHTML('beforeend', chunk.map(cardHtml).join(''));
      shown += chunk.length;
      fillThumbs(grid);
      if (shown >= list.length) more?.disconnect();
    };
    append(Math.max(PAGE, keep));
    if (shown < list.length) {
      more = new IntersectionObserver((en) => { if (en[0].isIntersecting) append(PAGE); }, { root: $('#pbody'), rootMargin: '500px' });
      more.observe($('#moreItems', wrap));
    }
    $('#sort', wrap).onchange = (e) => { ui.sort = e.target.value; drawGrid(); };
    grid.onclick = (e) => {
      const add = e.target.closest('[data-add]');
      if (add) { placeItem(getItem(add.dataset.add)); return; }
      const h = e.target.closest('[data-heart]');
      if (h) { if (toggleLike(h.dataset.heart)) h.outerHTML = heartHtml(h.dataset.heart); return; }
      const c = e.target.closest('.card');
      if (c) { ui.catScroll = $('#pbody').scrollTop; ui.catShown = shown; ui.detail = c.dataset.id; render(); $('#pbody').scrollTop = 0; }
    };
    grid.ondragstart = (e) => { const c = e.target.closest('.card'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'copy'; } };
  };
  drawGrid(ui.catShown || 0);
  ui.catShown = 0;
  let typing;
  $('#q', body).oninput = (e) => { ui.q = e.target.value; clearTimeout(typing); typing = setTimeout(() => drawGrid(), 120); };
  $('#cats', body).onclick = (e) => { const c = e.target.dataset.c; if (c) { ui.cat = c; ui.sub = null; ui.q = ''; ui.catScroll = 0; render(); } };
  const subsEl = $('#subs', body);
  if (subsEl) subsEl.onclick = (e) => { if (e.target.dataset.s !== undefined) { ui.sub = e.target.dataset.s || null; ui.catScroll = 0; render(); } };
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
    <div style="position:relative"><img class="hero" id="hero" alt=""/><span id="dheart">${heartHtml(def.id)}</span></div>
    <h2 class="t" style="margin-top:12px">${esc(def.name)}</h2>
    ${likesOf(def.id).length ? `<div class="muted small">♥ ${esc(likesOf(def.id).join(' et '))}</div>` : ''}
    <div class="muted">${esc(def.label)}${def.brand !== 'Générique' ? ` · ${esc(def.brand)}` : ''}</div>
    <div class="price">${def.approx ? '≈ ' : ''}${euro(def.price)}</div>
    <div class="muted small" style="margin-top:6px">L ${Math.round(def.w)} × P ${Math.round(def.d)} × H ${Math.round(def.h)} cm</div>
    <div class="btnrow"><button class="btn pri block" id="place">${def.sub === 'escalier' ? 'Escalier qui monte depuis ce niveau' : `Placer dans ${esc(placeTarget())}`}</button>${def.sub === 'escalier' ? '<button class="btn pri block" id="placeDown">Escalier qui descend depuis ce niveau</button>' : ''}</div>
    ${buyBlock(def)}`;
  const pd = $('#placeDown', body); if (pd) pd.onclick = () => placeItem(def, null, { down: true });
  thumbOf(def, $('#hero', body));
  $('#back', body).onclick = () => { ui.detail = null; render(); $('#pbody').scrollTop = ui.catScroll || 0; };
  $('#place', body).onclick = () => placeItem(def, null, { down: false });
  $('#dheart', body).onclick = () => { if (toggleLike(def.id)) { const top = $('#pbody').scrollTop; render(); $('#pbody').scrollTop = top; } };
}

function placeTarget() { return store.level.name.toLowerCase().startsWith('rez') ? 'le plan' : store.level.name; }

function placeItem(def, at, opts = {}) {
  const c = at || (ui.view === 'plan' ? plan.center() : centerOfView());
  const id = uid('it');
  if (def.sub === 'escalier') {
    const hasUp = store.levelIndex < store.project.levels.length - 1, hasDown = store.levelIndex > 0;
    const down = opts.down ?? (!hasUp && hasDown);
    if (down) {
      if (!hasDown) addLevelBelow();
      // Un escalier appartient au niveau d'où il part vers le haut : il se pose donc sur le niveau du bas.
      store.mutate((p) => { p.levels[store.levelIndex - 1].items.push({ id, cat: def.id, x: Math.round(c.x), y: Math.round(c.y), rot: 0 }); });
      fillLevels();
      ui.detail = null; if (narrow()) setPanel(false); render();
      toast(hasDown ? 'Escalier posé. Touche-le sur le plan pour le déplacer.' : 'Niveau du bas créé et escalier posé. Touche-le sur le plan pour le déplacer.');
      return;
    }
    if (!hasUp) toast('Il n’y a pas encore d’étage au-dessus : ajoute-le dans le menu des niveaux.');
  }
  store.mutate((p, lv) => { lv.items.push({ id, cat: def.id, x: Math.round(c.x), y: Math.round(c.y), rot: 0 }); });
  const wasDetail = ui.detail;
  ui.detail = null;
  store.select({ type: 'item', id });
  if (narrow()) setPanel(false);
  if (!wasDetail) ui.detail = null;
  toast(`${def.name} placé. Fais-le glisser à sa place.`);
}

// Glisser un meuble du catalogue vers le plan ou la 3D (ordinateur).
for (const [sel, pos] of [['#plan', (e) => { const r = $('#plan').getBoundingClientRect(); return plan.toWorld(e.clientX - r.left, e.clientY - r.top); }], ['#view', (e) => view?.floorPoint(e.clientX, e.clientY)]]) {
  const el = $(sel);
  el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  el.addEventListener('drop', (e) => { e.preventDefault(); const def = getItem(e.dataTransfer.getData('text/plain')); const p = pos(e); if (def && p) placeItem(def, { x: p.x, y: p.y }); });
}

// ——— Actions rapides sur la sélection ———
function selectAll(house) {
  const g = newGroup();
  if (house) addHouse(g, store.project); else addLevel(g, store.level);
  if (isEmptyGroup(g)) { toast('Il n’y a encore rien à sélectionner.'); return; }
  store.select(g);
  toast('Fais glisser le cadre pour déplacer le tout.');
}
function rotateSel(deg = 90) {
  const g = store.selection;
  if (isGroup(g)) { store.mutate((p) => rotateGroup(p, g, deg)); render(); return; }
  rotateOne();
}
function dupSel() {
  const g = store.selection;
  if (!isGroup(g)) { dupOne(); return; }
  let copy;
  store.mutate((p) => { copy = duplicateGroup(p, g); });
  store.select(copy);
  toast({ text: 'Copie posée juste à côté.', undo: true });
}
function rotateOne() { const s = store.selection, it = s?.type === 'item' && store.level.items.find((i) => i.id === s.id); if (it) { live(() => { it.rot = ((it.rot || 0) + 90) % 360; }); render(); } }
function dupOne() { const s = store.selection, it = s?.type === 'item' && store.level.items.find((i) => i.id === s.id); if (!it) return; const id = uid('it'); store.mutate((p, lv) => lv.items.push({ ...it, id, x: it.x + 30, y: it.y + 30 })); store.select({ type: 'item', id }); }

function renderSelbar() {
  const bar = $('#selbar'), s = store.selection;
  $('#hint').classList.toggle('behind', !!s);
  if (!s || !narrow()) { bar.classList.add('hidden'); $('#viewLayer').classList.remove('selecting'); return; }
  const lv = store.level;
  let name = 'Sélection', acts = '';
  if (s.type === 'group') { const st = groupStats(store.project, s); name = st.house ? 'Maison' : groupTitle(st); acts = '<button data-a="rot">Tourner</button><button data-a="dup">Copier</button><button data-a="del">Suppr.</button><button data-a="more" class="pri">Détails</button>'; }
  else if (s.type === 'item') { const it = lv.items.find((i) => i.id === s.id); name = getItem(it?.cat)?.name || 'Meuble'; acts = '<button data-a="rot">Tourner</button><button data-a="dup">Dupliquer</button><button data-a="del">Retirer</button><button data-a="more" class="pri">Détails</button>'; }
  else if (s.type === 'room') { name = lv.rooms.find((r) => r.id === s.id)?.name || 'Pièce'; acts = '<button data-a="more" class="pri">Modifier</button>'; }
  else if (s.type === 'wall') { name = 'Mur'; acts = '<button data-a="del">Supprimer</button><button data-a="more" class="pri">Modifier</button>'; }
  else if (s.type === 'opening') { name = lv.walls.find((w) => w.id === s.wallId)?.openings.find((o) => o.id === s.id)?.name || 'Ouverture'; acts = '<button data-a="del">Retirer</button><button data-a="more" class="pri">Modifier</button>'; }
  else { name = 'Angle de mur'; acts = '<button data-a="del">Supprimer</button>'; }
  bar.innerHTML = `<div class="nm">${esc(name)}</div><div class="ac">${acts}<button data-a="x" aria-label="Désélectionner">${icon('close')}</button></div>`;
  bar.classList.remove('hidden');
  $('#viewLayer').classList.add('selecting');
}
$('#selbar').onclick = (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
  if (a === 'rot') rotateSel(90);
  if (a === 'dup') dupSel();
  if (a === 'del') plan.deleteSelection();
  if (a === 'more') setPanel(true);
  if (a === 'x') closeSel();
};

// Raccourcis clavier sur ordinateur
addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  const s = store.selection, it = s?.type === 'item' && store.level.items.find((i) => i.id === s.id), g = isGroup(s);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && ui.view === 'plan') { e.preventDefault(); selectAll(false); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') { if (it || g) { e.preventDefault(); dupSel(); } return; }
  if (e.metaKey || e.ctrlKey || (!it && !g) || view?.mode === 'walk') return;
  if (e.key.toLowerCase() === 'r') rotateSel(90);
  const step = e.shiftKey ? 1 : 5, delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (delta && g) { e.preventDefault(); store.mutate((p) => moveBy(p, s, delta[0], delta[1])); return; }
  if (delta) { e.preventDefault(); live(() => { it.x += delta[0]; it.y += delta[1]; }); }
});

function centerOfView() {
  const t = view.mode === 'walk' ? { x: view.camera.position.x * 100 + -Math.sin(view.yaw) * 150, z: view.camera.position.z * 100 + -Math.cos(view.yaw) * 150 } : { x: view.controls.target.x * 100, z: view.controls.target.z * 100 };
  return { x: t.x, y: t.z };
}

function renderSelection(body, s) {
  const lv = store.level;
  if (s.type === 'group') return groupPanel(body, s);
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

const countOf = (n, one, many) => (n ? `${n} ${n > 1 ? many : one}` : '');
function groupSummary(st) {
  return [countOf(st.rooms, 'pièce', 'pièces'), countOf(st.walls, 'mur', 'murs'), countOf(st.items, 'meuble', 'meubles'), st.levels > 1 ? `${st.levels} niveaux` : ''].filter(Boolean).join(' · ') || 'Angles de murs';
}
function groupTitle(st) {
  if (st.house) return 'Toute la maison';
  return st.rooms ? countOf(st.rooms, 'pièce', 'pièces') : countOf(st.walls + st.items, 'élément', 'éléments') || 'Sélection';
}

function groupPanel(body, s) {
  const st = groupStats(store.project, s), several = store.project.levels.length > 1;
  body.innerHTML = `${header(groupTitle(st), groupSummary(st))}
    <div class="note">Fais glisser le cadre sur le plan pour tout déplacer.${st.house ? ' Le terrain ne bouge pas : la maison se repose sur le relief à son nouvel emplacement.' : ''}</div>
    <h3 class="s">Déplacer précisément (cm)</h3>
    <div class="dims"><div><label>Vers la droite</label><input type="number" id="gx" step="5" value="0"/></div><div><label>Vers le bas</label><input type="number" id="gy" step="5" value="0"/></div><div><label>&nbsp;</label><button class="btn pri block" id="gmove">Déplacer</button></div></div>
    <h3 class="s">Tourner autour du centre</h3>
    <div class="btnrow" id="gturn"><button class="btn" data-r="-90">−90°</button><button class="btn" data-r="-15">−15°</button><button class="btn" data-r="15">+15°</button><button class="btn" data-r="90">+90°</button></div>
    ${st.border ? `<h3 class="s">Murs reliés au reste de la maison</h3><div class="chips wrap" id="gdetach"><button class="chip ${s.detach ? '' : 'on'}" data-d="0">Ils s’allongent</button><button class="chip ${s.detach ? 'on' : ''}" data-d="1">Ils restent en place</button></div>` : ''}
    <h3 class="s">Étendre la sélection</h3>
    <div class="btnrow">${several ? '<button class="btn" id="gsame">Ajouter les autres niveaux à cet endroit</button><button class="btn" id="glevel">Tout ce niveau</button>' : ''}<button class="btn" id="ghouse">Toute la maison</button>${st.garden ? `<button class="btn" id="ggarden">Ajouter le jardin (${st.garden})</button>` : ''}</div>
    <div class="btnrow"><button class="btn" id="gdup">${icon('copy')}Copier à côté</button><button class="btn danger" id="gdel">${icon('trash')}Supprimer</button></div>`;
  $('#closeSel', body).onclick = closeSel;
  $('#gmove', body).onclick = () => {
    const dx = Number($('#gx', body).value) || 0, dy = Number($('#gy', body).value) || 0;
    if (!dx && !dy) return;
    let m;
    store.mutate((p) => { m = moveBy(p, s, dx, dy); });
    if (m?.limited) toast('Arrêté au bord du terrain.');
    render();
  };
  $('#gturn', body).onclick = (e) => { const r = Number(e.target.closest('[data-r]')?.dataset.r); if (r) rotateSel(r); };
  const det = $('#gdetach', body);
  if (det) det.onclick = (e) => { const d = e.target.closest('[data-d]')?.dataset.d; if (d !== undefined) { s.detach = d === '1'; render(); } };
  const same = $('#gsame', body), lvl = $('#glevel', body);
  if (same) same.onclick = () => { addSameSpot(s, store.project); store.select(s); };
  if (lvl) lvl.onclick = () => selectAll(false);
  $('#ghouse', body).onclick = () => selectAll(true);
  const garden = $('#ggarden', body);
  if (garden) garden.onclick = () => { addGarden(s, store.project); store.select(s); };
  $('#gdup', body).onclick = dupSel;
  $('#gdel', body).onclick = () => plan.deleteSelection();
}

function itemPanel(body, it) {
  if (!it) return closeSel();
  const def = getItem(it.cat);
  const w = it.w ?? def.w, d = it.d ?? def.d, h = it.h ?? def.h;
  const canColor = ['sofa', 'armchair', 'rug', 'curtain', 'stripedLounger', 'vintageParasol'].includes(def.model?.type);
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
  $('#rot90', body).onclick = rotateSel;
  $('#del', body).onclick = () => plan.deleteSelection();
  $('#bought', body).onchange = (e) => live(() => { it.bought = e.target.checked; });
  $('#dup', body).onclick = dupSel;
}

function swatchRow(list, cur, kind) {
  return `<div class="swatches">${list.map((m) => `<button class="swatch ${cur === m.id ? 'on' : ''}" data-m="${m.id}" data-kind="${kind}" title="${esc(m.name)}" style="${m.hex ? `background:${m.hex}` : `background-image:url(./thumbs/t_${m.t}.webp)`}"></button>`).join('')}</div>`;
}

function roomZone(r) {
  const lv = store.level;
  return (store.project.roofs || []).find((z) => z.level === lv.id && (z.room === r.id || (r.x >= z.x0 && r.x <= z.x1 && r.y >= z.y0 && r.y <= z.y1 && (z.wallH > 0 || z.vault))));
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
    <h3 class="s">Volume de la pièce</h3>
    <div class="field"><label>Hauteur sous plafond (cm)</label><input type="number" id="rh" step="10" placeholder="${store.level.height}" value="${roomZone(r)?.wallH || ''}"/></div>
    <div class="field"><label>Plafond cathédrale en bois</label><input type="checkbox" id="rv" ${roomZone(r)?.vault ? 'checked' : ''} style="width:22px;height:22px;justify-self:end"/></div>
    <div class="btnrow"><button class="btn block" id="rcurt">Poser des rideaux à toutes les fenêtres</button></div>
    <div class="field wide"><label>Moulures</label><select id="mould">${[['none', 'Aucune'], ['crown', 'Corniche au plafond'], ['panels', 'Corniche et panneaux moulurés']].map(([k, l]) => `<option value="${k}" ${(r.moulding || 'none') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="note">Les couleurs de marque sont des teintes approchées : un écran ne remplace pas un échantillon.</div>`;
  void part;
  $('#closeSel', body).onclick = closeSel;
  $('#nm', body).onchange = (e) => live(() => { r.name = e.target.value; });
  $('#mould', body).onchange = (e) => live(() => { r.moulding = e.target.value; });
  const applyVolume = () => live(() => {
    const h = Number($('#rh', body).value) || 0, v = $('#rv', body).checked, p = store.project;
    let z = roomZone(r);
    if (!h && !v) { if (z) p.roofs = p.roofs.filter((q) => q !== z); return; }
    if (!z) { const b = boxOf(store.level, r.name); z = { id: uid('z'), level: store.level.id, ...b, type: 'gable', pitch: 38, overhang: 30, ridge: 'auto', wallH: 0, room: r.id }; (p.roofs ||= []).push(z); }
    z.wallH = h; z.vault = v;
  });
  $('#rh', body).onchange = applyVolume; $('#rv', body).onchange = applyVolume;
  $('#rcurt', body).onclick = () => {
    const def = allItems().find((i) => i.sub === 'rideau'), wins = windowsOf(store.level, r.name);
    if (!def || !wins.length) { toast('Aucune fenêtre à habiller dans cette pièce.'); return; }
    store.mutate((p, lv) => { for (const c of wins) for (const k of [-1, 1]) { const along = { x: c.n.y, y: -c.n.x }, d = c.w / 2 + 34; lv.items.push({ id: uid('it'), cat: def.id, x: c.x + along.x * k * d + c.n.x * (c.t + 12), y: c.y + along.y * k * d + c.n.y * (c.t + 12), rot: facing(c.n), w: 70, h: c.top, color: '#e8dfcf' }); } });
    toast({ text: `${wins.length * 2} rideaux posés. Touche-les pour changer leur couleur.`, undo: true });
  };
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
  const isWin = !isDoorType(o.type);
  const lv0 = store.level, wallLen = dist(lv0.nodes[w.a], lv0.nodes[w.b]);
  body.innerHTML = `${header(o.name || 'Ouverture', `${o.width} × ${o.height} cm`)}
    <div class="field wide" style="margin-top:8px"><label>Type</label><select id="otype">${OPENING_TYPES.map(([k, l]) => `<option value="${k}" ${k === o.type ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="chips" id="owidths">${[90, 120, 180, 240, 300, 400, 500, 600].filter((x) => x <= wallLen - 8).map((x) => `<button class="chip ${o.width === x ? 'on' : ''}" data-w="${x}">${(x / 100).toFixed(1).replace('.', ',')} m</button>`).join('')}<button class="chip" data-full="1">Toute hauteur</button></div>
    <div class="field"><label>Distance à l’angle (cm)</label><input type="number" id="pos" value="${Math.round(o.t - o.width / 2)}"/></div>
    <div class="dims" style="margin-top:12px"><div><label>Largeur</label><input type="number" id="width" value="${o.width}"/></div><div><label>Hauteur</label><input type="number" id="height" value="${o.height}"/></div><div><label>Allège</label><input type="number" id="sill" value="${o.sill}"/></div></div>
    ${isDoor ? `<div class="field"><label>Ouverture (°)</label><input type="number" id="open" min="0" max="110" step="5" value="${o.open ?? 0}"/></div>
    <div class="btnrow"><button class="btn" id="flip">Inverser le sens</button><button class="btn" id="hinge">Changer le côté</button></div>` : ''}
    <div class="field"><label>Couleur</label><input type="color" id="col" value="${o.color || store.project.style.joinery}" style="height:36px;padding:2px"/></div>
    ${o.type === 'bay' ? `<div class="field" style="margin-top:8px"><label>Baie ouverte</label><input type="checkbox" id="bayOpen" ${o.opened ? 'checked' : ''} style="width:22px;height:22px;justify-self:end"/></div>` : ''}
    ${isWin ? `<div class="dims" style="margin-top:8px"><div><label>Petits bois : colonnes</label><input type="number" min="1" max="8" id="mc" value="${o.muntins?.[0] ?? 1}"/></div><div><label>Rangées</label><input type="number" min="1" max="12" id="mr" value="${o.muntins?.[1] ?? 1}"/></div><div></div></div>` : ''}
    ${isWin ? `<div class="field"><label>Volet roulant</label><input type="checkbox" id="sh" ${o.shutter ? 'checked' : ''} style="width:22px;height:22px;justify-self:end"/></div>` : ''}
    <div class="btnrow"><button class="btn danger block" id="del">${icon('trash')}Retirer</button></div>
    <h3 class="s">Où l'acheter</h3>${buyLinks(o.type === 'garage' ? 'porte de garage' : isDoor ? 'bloc porte' : isWin ? 'fenêtre aluminium' : 'porte coulissante').map((l) => `<a class="buy" href="${esc(l.url)}" target="_blank" rel="noopener"><span>${esc(l.shop)}</span>${icon('ext')}</a>`).join('')}`;
  $('#closeSel', body).onclick = closeSel;
  const clampOpening = () => { o.width = Math.min(o.width, wallLen - 8); o.t = Math.max(o.width / 2 + 4, Math.min(wallLen - o.width / 2 - 4, o.t)); };
  for (const k of ['width', 'height', 'sill', 'open']) { const el = $(`#${k}`, body); if (el) el.onchange = (e) => { live(() => { o[k] = Number(e.target.value); clampOpening(); }); render(); }; }
  $('#pos', body).onchange = (e) => { live(() => { o.t = Number(e.target.value) + o.width / 2; clampOpening(); }); render(); };
  $('#otype', body).onchange = (e) => { live(() => { o.type = e.target.value; o.name = OPENING_TYPES.find((t) => t[0] === o.type)[1]; }); render(); };
  $('#owidths', body).onclick = (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    live(() => { if (b.dataset.w) o.width = Number(b.dataset.w); if (b.dataset.full) { o.sill = 0; o.height = store.level.height - 8; } clampOpening(); });
    render();
  };
  $('#col', body).onchange = (e) => live(() => { o.color = e.target.value; });
  const fl = $('#flip', body); if (fl) fl.onclick = () => live(() => { o.flip = !o.flip; });
  const hg = $('#hinge', body); if (hg) hg.onclick = () => live(() => { o.hinge = o.hinge === 'right' ? 'left' : 'right'; });
  { const el = $('#bayOpen', body); if (el) el.onchange = () => live(() => { o.opened = el.checked; }); }
  for (const k of ['mc', 'mr']) { const el = $(`#${k}`, body); if (el) el.onchange = () => live(() => { const c = Math.max(1, Number($('#mc', body).value) || 1), r = Math.max(1, Number($('#mr', body).value) || 1); o.muntins = c === 1 && r === 1 ? undefined : [c, r]; }); }
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
    <h3 class="s">Toits supplémentaires</h3>
    <div id="roofs">${(p.roofs || []).map((z, i) => `<div class="card2" data-z="${i}"><div class="head"><span>Toit ${i + 1} · ${esc(p.levels.find((l) => l.id === z.level)?.name || '')}</span><button class="iconbtn" data-del aria-label="Supprimer ce toit">${icon('trash')}</button></div>
      <div class="field"><label>Forme</label><select data-f="type">${[['gable', '2 pans'], ['hip', '4 pans'], ['mono', 'Monopente'], ['flat', 'Toit-terrasse']].map(([k, l]) => `<option value="${k}" ${z.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Faîtage</label><select data-f="ridge">${[['auto', 'Automatique'], ['x', 'Horizontal sur le plan'], ['y', 'Vertical sur le plan']].map(([k, l]) => `<option value="${k}" ${z.ridge === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Pente (°)</label><input type="number" data-f="pitch" min="5" max="60" value="${z.pitch}"/></div>
      <div class="field"><label>Débord (cm)</label><input type="number" data-f="overhang" value="${z.overhang}"/></div>
      <div class="field"><label>Murs dessous (cm)</label><input type="number" data-f="wallH" min="0" placeholder="Hauteur du niveau" value="${z.wallH || ''}"/></div>
      <div class="field"><label>Arrêté net contre l’étage (sans débord)</label><input type="checkbox" data-f="tight" ${z.flush && z.endCut ? 'checked' : ''} style="width:22px;height:22px;justify-self:end"/></div>
      <div class="field"><label>Plafond cathédrale en bois</label><input type="checkbox" data-f="vault" ${z.vault ? 'checked' : ''} style="width:22px;height:22px;justify-self:end"/></div>
      ${z.vault ? `<div class="field"><label>Bois du plafond</label><select data-f="lining">${[['wall_noyer', 'Noyer'], ['wall_bois', 'Chêne']].map(([k, l]) => `<option value="${k}" ${(z.lining || 'wall_noyer') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}</div>`).join('')}</div>
    <div class="btnrow"><button class="btn block" id="addRoof">+ Dessiner un toit sur le plan</button></div>
    <p class="muted small" style="margin-top:6px">Pour un garage, une avancée ou la partie du bas qui dépasse de l’étage. Indique une hauteur de murs plus faible pour un volume bas, ou beaucoup plus grande pour un séjour de 6 m ou plus. Si plusieurs toits couvrent toute la maison, règle la forme du toit principal sur « Aucune ».</p>
    ${swatchRow(ROOFS, p.style.roof, 'roof')}<div class="matname">${esc(materialInfo(p.style.roof)?.name)}</div>
    <div class="field"><label>Menuiseries</label><input type="color" id="joi" value="${p.style.joinery}" style="height:36px;padding:2px"/></div>
    <h3 class="s">Terrain</h3>${swatchRow(GROUNDS, p.site.ground, 'ground')}
    <h3 class="s">Emplacement et ensoleillement</h3>
    <div class="field wide"><label>Adresse du terrain</label><div style="display:flex;gap:6px"><input id="addr" placeholder="12 chemin des Vignes, Albi" value="${esc(p.site.address || '')}" style="flex:1"/><button class="btn" id="addrGo">Placer</button></div></div>
    <div class="field"><label>Latitude</label><input type="number" step="0.0001" id="lat" value="${p.site.lat}"/></div>
    <div class="field"><label>Longitude</label><input type="number" step="0.0001" id="lon" value="${p.site.lon}"/></div>
    <div class="field"><label>Orientation du nord (°)</label><input type="number" id="north" value="${p.site.north}"/></div>
    <p class="note">Réglé par défaut sur la périphérie de Toulouse. Tape l’adresse du terrain et touche « Placer ». L’orientation du nord se lit sur la flèche N du plan : 0 si le nord est en haut, 90 s’il est à droite. Dans la vue 3D, choisis une date (21 décembre, 21 juin…) et une heure, ou touche « Journée » pour voir le soleil passer dans chaque pièce.</p>
    <h3 class="s">${esc(lv.name)}</h3>
    <div class="field wide"><label>Nom</label><input id="lvn" value="${esc(lv.name)}"/></div>
    <div class="field"><label>Hauteur sous plafond (cm)</label><input type="number" id="lvh" value="${lv.height}"/></div>
    ${p.levels.length > 1 ? '<div class="btnrow"><button class="btn danger block" id="lvdel">Supprimer cet étage</button></div>' : ''}
    <h3 class="s">Plan de l'architecte</h3>
    <p class="muted small">Importe la photo d'un plan, ou photographie un croquis fait à la main, et décalque les murs par-dessus.</p>
    <div class="btnrow"><label class="btn">Importer une image<input type="file" id="bg" accept="image/*" hidden/></label><label class="btn">Photographier un croquis<input type="file" id="sketch" accept="image/*" capture="environment" hidden/></label></div>
    ${lv.background ? '<p class="note">Pour le mettre à la bonne échelle : prends l’outil Mesure, trace le long d’un mur dont tu connais la longueur, puis touche « Caler le plan dessus ».</p>' : ''}
    ${lv.background ? `<div class="field"><label>Largeur réelle du plan (m)</label><input type="number" step="0.1" id="bgw" value="${((lv.background.width * lv.background.scale) / 100).toFixed(1)}"/></div>
    <div class="field"><label>Opacité</label><input type="range" min="0.1" max="1" step="0.05" id="bgo" value="${lv.background.opacity}"/></div><div class="btnrow"><button class="btn danger block" id="bgx">Retirer le plan</button></div>` : ''}`;
  body.querySelectorAll('.swatch').forEach((b) => { b.onclick = () => { live(() => {
    const k = b.dataset.kind, m = b.dataset.m;
    if (k === 'facade') p.style.facade = m; if (k === 'roof') p.style.roof = m; if (k === 'ground') p.site.ground = m;
  }); render(); }; });
  const bind = (id, fn) => { const el = $(`#${id}`, body); if (el) el.onchange = (e) => { live(() => fn(e.target.value)); if (id === 'lvn') fillLevels(); }; };
  $('#addRoof', body).onclick = () => { plan.setTool('roof'); setView('plan'); if (narrow()) setPanel(false); };
  $('#roofs', body).onchange = (e) => {
    const f = e.target.dataset.f, z = p.roofs[Number(e.target.closest('[data-z]').dataset.z)];
    if (f === 'tight' && z) { live(() => { z.flush = z.endCut = e.target.checked; }); return; }
    if (f && z) live(() => { z[f] = f === 'vault' ? e.target.checked : ['type', 'ridge', 'lining'].includes(f) ? e.target.value : Number(e.target.value) || 0; });
  };
  $('#roofs', body).onclick = (e) => {
    if (!e.target.closest('[data-del]')) return;
    const i = Number(e.target.closest('[data-z]').dataset.z);
    store.mutate(() => p.roofs.splice(i, 1));
    render();
    toast({ text: 'Toit retiré.', undo: true });
  };
  bind('roofT', (v) => { p.roof.type = v; }); bind('pitch', (v) => { p.roof.pitch = Number(v); }); bind('ov', (v) => { p.roof.overhang = Number(v); });
  bind('joi', (v) => { p.style.joinery = v; }); bind('lat', (v) => { p.site.lat = Number(v); }); bind('lon', (v) => { p.site.lon = Number(v); }); bind('north', (v) => { p.site.north = Number(v); });
  const addrGo = $('#addrGo', body);
  if (addrGo) addrGo.onclick = async () => {
    const q = $('#addr', body).value.trim(); if (q.length < 4) { toast('Tape l’adresse du terrain.'); return; }
    addrGo.disabled = true;
    try {
      const r = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&limit=1`).then((x) => x.json());
      const f = r.features?.[0];
      if (!f) { toast('Adresse introuvable.'); return; }
      const [lon, lat] = f.geometry.coordinates;
      live(() => { p.site.lat = Math.round(lat * 1e4) / 1e4; p.site.lon = Math.round(lon * 1e4) / 1e4; p.site.address = f.properties.label; });
      render(); toast(`Placé : ${f.properties.label}`);
    } catch { toast('Recherche impossible : vérifie la connexion.'); } finally { addrGo.disabled = false; }
  };
  bind('lvn', (v) => { lv.name = v; }); bind('lvh', (v) => { lv.height = Number(v); });
  bind('bgw', (v) => { lv.background.scale = (Number(v) * 100) / lv.background.width; });
  bind('bgo', (v) => { lv.background.opacity = Number(v); });
  const ld = $('#lvdel', body);
  if (ld) ld.onclick = () => {
    store.mutate((pr) => { pr.levels.splice(store.levelIndex, 1); });
    store.setLevel(Math.max(0, store.levelIndex - 1));
    fillLevels(); plan.fitted = false; plan.fit();
    toast({ text: 'Étage supprimé.', undo: true });
    render();
  };
  const x = $('#bgx', body); if (x) x.onclick = () => { live(() => { lv.background = null; }); render(); };
  const importBg = async (f, sketch) => {
    if (!f) return;
    let img;
    try { img = await createImageBitmap(f); } catch { toast('Cette image ne peut pas être ouverte.'); return; }
    const k = Math.min(1, (sketch ? 1400 : 1800) / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    if (sketch) cleanSketch(g, c.width, c.height);
    const src = sketch ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.78);
    const w0 = plan.toWorld(plan.w * 0.1, plan.h * 0.1);
    live(() => { lv.background = { src, x: w0.x, y: w0.y, scale: 1200 / c.width, width: c.width, opacity: sketch ? 0.85 : 0.5 }; });
    setView('plan'); render();
    toast(sketch ? 'Croquis posé sous le plan. Cale-le avec l’outil Mesure sur un mur connu.' : 'Indique maintenant la largeur réelle du plan, ou cale-le avec l’outil Mesure.');
  };
  $('#bg', body).onchange = (e) => importBg(e.target.files[0], false);
  $('#sketch', body).onchange = (e) => importBg(e.target.files[0], true);
}

/** Croquis sur papier : le papier devient transparent, les traits restent foncés, même sous une lumière inégale. */
function cleanSketch(g, w, h) {
  const d = g.getImageData(0, 0, w, h), px = d.data, n = w * h, lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2];
  // Teinte du papier autour de chaque point (grille grossière), pour gommer les ombres de la photo.
  const cell = Math.max(16, Math.round(Math.max(w, h) / 24)), gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), paper = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const vals = [];
    for (let y = gy * cell; y < Math.min(h, (gy + 1) * cell); y += 3) for (let x = gx * cell; x < Math.min(w, (gx + 1) * cell); x += 3) vals.push(lum[y * w + x]);
    vals.sort((a, b) => a - b); paper[gy * gw + gx] = vals[Math.floor(vals.length * 0.8)] || 255;
  }
  const at = (x, y) => { const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5)), fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    return (paper[y0 * gw + x0] * (1 - tx) + paper[y0 * gw + x1] * tx) * (1 - ty) + (paper[y1 * gw + x0] * (1 - tx) + paper[y1 * gw + x1] * tx) * ty; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, ink = Math.min(1, Math.max(0, (1 - lum[i] / Math.max(40, at(x, y)) - 0.12) * 3.2));
    px[i * 4] = 38; px[i * 4 + 1] = 35; px[i * 4 + 2] = 30; px[i * 4 + 3] = Math.round(ink * 255);
  }
  g.putImageData(d, 0, 0);
}

const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString('fr-FR');
function setBudget(fn) {
  const body = $('#pbody'), top = body.scrollTop;
  store.snapshot();
  store.project.budget = budgetSettings(store.project);
  fn(store.project.budget);
  store.commit({ rebuild: false });
  render();
  body.scrollTop = top;
}

function budgetLine(l) {
  const qty = l.unit === '€' ? '' : l.unit === 'forfait' ? 'Forfait' : `${fmt1(l.qty)} ${l.unit} × ${euro(l.price)}`;
  const tags = `${l.plan ? '<em class="tag plan">d’après le plan</em>' : ''}${l.over ? '<em class="tag dev">ton montant</em>' : l.est ? '<em class="tag est">estimation</em>' : ''}`;
  return `<div class="bl ${l.off ? 'off' : ''}"><input type="checkbox" data-on="${esc(l.key)}" ${l.off ? '' : 'checked'} aria-label="Compter cette ligne"/><div class="m"><b>${esc(l.label)}</b><span>${[qty, l.note].filter(Boolean).map(esc).join(' · ')}</span><div>${tags}</div></div><input class="amt" type="number" inputmode="numeric" data-amt="${esc(l.key)}" value="${l.off ? Math.round(l.raw) : Math.round(l.amount)}" aria-label="Montant"/>${l.over ? `<button class="rs" data-reset="${esc(l.key)}" title="Revenir au calcul">↺</button>` : ''}</div>`;
}

// ——— Terrain ———
function endBrush() { store.brush = null; $('#brushbar').classList.add('hidden'); plan.draw(); if (ui.tab === 'terrain') render(); }
function startBrush(mode) {
  store.brush = { mode, radius: ui.bRadius, strength: ui.bStrength, ground: ui.bGround };
  const lbl = BRUSHES.find((b) => b[0] === mode)[1];
  const bar = $('#brushbar');
  bar.innerHTML = `<span>${lbl} : ${matchMedia('(pointer: coarse)').matches ? 'glisse le doigt' : 'clique et glisse'} sur le terrain</span><button id="brushEnd">Terminer</button>`;
  bar.classList.remove('hidden');
  $('#brushEnd').onclick = endBrush;
  if (narrow()) setPanel(false);
}
Object.assign(ui, { tShape: 'slope', tDir: 180, tPct: 22, bRadius: 5, bStrength: 1, bGround: 0, sky: 'auto' });
store.brushStroke = {
  m: null,
  one(p) { applyBrush(this.m, p.x, p.y, { ...store.brush, target: this.target }); store.emit('terrain-live'); },
  begin(p) { store.snapshot(); this.m = ensureTerrain(store.project); this.target = heightAt(this.m, p.x, p.y); this.last = p; this.one(p); },
  at(p) {
    if (!this.m) return;
    const d = Math.hypot(p.x - this.last.x, p.y - this.last.y), step = store.brush.radius * 40;
    if (d < step * 0.25) return;
    const n = Math.min(8, Math.ceil(d / step));
    for (let i = 1; i <= n; i++) this.one({ x: this.last.x + ((p.x - this.last.x) * i) / n, y: this.last.y + ((p.y - this.last.y) * i) / n });
    this.last = p;
  },
  end() { if (!this.m) return; this.m = null; commitTerrain(store.project); store.commit(); },
};

function parcelBlock(p) {
  const info = checkParcel(p);
  if (!info) return `<h3 class="s">Ma parcelle</h3>
    <p class="muted small">Trace les limites de ton terrain pour vérifier les distances avec les voisins.</p>
    <div class="dims"><div><label>Largeur (m)</label><input type="number" id="pw" value="25"/></div><div><label>Profondeur (m)</label><input type="number" id="pd" value="30"/></div><div><label>&nbsp;</label><button class="btn block" id="prect">Rectangle</button></div></div>
    <div class="btnrow"><button class="btn pri block" id="pdraw">Dessiner sur le plan, coin par coin</button></div>`;
  return `<h3 class="s">Ma parcelle</h3>
    <div class="price">${Math.round(info.area).toLocaleString('fr-FR')} m²</div>
    <div class="field"><label>Distance aux limites (m)</label><input type="number" step="0.5" min="0" id="pset" placeholder="${metres(setbackOf(p))}" value="${Number.isFinite(p.site.parcel.setback) ? p.site.parcel.setback / 100 : ''}"/></div>
    <div class="note">${info.outside ? '<b>Un mur sort de la parcelle.</b> ' : ''}${info.issues.length ? `<b>${info.issues.length} limite${info.issues.length > 1 ? 's' : ''} trop proche${info.issues.length > 1 ? 's' : ''}</b>, en rouge sur le plan. ` : info.outside ? '' : 'Les distances sont respectées. '}Par défaut : la moitié de la hauteur de la maison, 3 m au moins. C’est la règle générale, sans PLU : celui de ta commune prime et peut autoriser de construire en limite.</div>
    <div class="btnrow"><button class="btn" id="pedit">Déplacer les coins</button><button class="btn danger" id="pclear">Effacer</button></div>`;
}

function bindParcel(body, p, redo) {
  const go = () => { setView('plan'); if (narrow()) setPanel(false); };
  const on = (id, fn) => { const el = $(`#${id}`, body); if (el) el.onclick = fn; };
  on('pdraw', () => { plan.setTool('parcel'); go(); });
  on('pedit', () => { plan.setTool('parcel'); plan.fitted = false; plan.fit(); go(); });
  on('pclear', () => { live(() => { delete p.site.parcel; }); redo(); toast({ text: 'Parcelle effacée.', undo: true }); });
  on('prect', () => {
    const W = Number($('#pw', body).value) * 100, D = Number($('#pd', body).value) * 100;
    if (!(W >= 300 && D >= 300)) { toast('Indique au moins 3 m de chaque côté.'); return; }
    const n = Object.values(store.level.nodes), xs = n.map((q) => q.x), ys = n.map((q) => q.y);
    const cx = n.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0, cy = n.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    const x0 = Math.round((cx - W / 2) / 5) * 5, y0 = Math.round((cy - D / 2) / 5) * 5;
    live(() => { p.site.parcel = { pts: [{ x: x0, y: y0 }, { x: x0 + W, y: y0 }, { x: x0 + W, y: y0 + D }, { x: x0, y: y0 + D }] }; });
    plan.fitted = false; plan.fit();
    redo();
  });
  const set = $('#pset', body);
  if (set) set.onchange = (e) => { live(() => { const v = e.target.value; if (v === '') delete p.site.parcel.setback; else p.site.parcel.setback = Number(v) * 100; }); redo(); };
}

// ——— Liste d'achats ———
function shoppingData() {
  const shops = new Map();
  for (const l of fullBudget(store).items) {
    if (!(l.price > 0) || l.def.cat === 'structure') continue;
    const name = l.def.brand === 'Générique' ? 'À choisir (modèles types)' : l.def.brand;
    if (!shops.has(name)) shops.set(name, new Map());
    const list = shops.get(name), k = l.def.id;
    if (!list.has(k)) list.set(k, { def: l.def, its: [], rooms: new Set(), total: 0 });
    const row = list.get(k);
    row.its.push(l.it); row.rooms.add(l.room); row.total += l.price;
  }
  return [...shops].map(([name, list]) => { const rows = [...list.values()]; return { name, rows, total: rows.reduce((t, r) => t + r.total, 0), left: rows.reduce((t, r) => t + r.total * (r.its.filter((i) => !i.bought).length / r.its.length), 0) }; }).sort((a, b) => b.total - a.total);
}

// ——— Achats en deux temps : ce qu'il faut pour emménager, ce qui peut attendre ———
const LATER_BY_DEFAULT = ['deco', 'objets', 'exterieur'];
// Ce qui se construit (terrasse, piscine, allées) se fait avant d'emménager, même dehors.
const BUILT = ['terrasse', 'piscine', 'cloture', 'marches', 'soutenement', 'poteau', 'pergola', 'cheminee'];
const defaultStage = (def) => (LATER_BY_DEFAULT.includes(def.cat) && !BUILT.includes(def.sub) ? 'later' : 'now');
const stageOf = (def) => store.project?.stages?.[def.id] || defaultStage(def);
const STAGE_LABEL = { now: 'Emménagement', later: 'Plus tard' };
function stageTotals(shops) {
  const t = { now: { total: 0, left: 0 }, later: { total: 0, left: 0 } };
  for (const g of shops) for (const r of g.rows) { const k = stageOf(r.def), left = r.total * (r.its.filter((i) => !i.bought).length / r.its.length); t[k].total += r.total; t[k].left += left; }
  return t;
}

function shoppingText(shops) {
  return shops.map((g) => `${g.name} (${euro(g.left)} restants)\n${g.rows.filter((r) => r.its.some((i) => !i.bought)).map((r) => `- ${r.its.length > 1 ? `${r.its.length} × ` : ''}${r.def.name} : ${euro(r.total)}${stageOf(r.def) === 'later' ? ' (plus tard)' : ''}${r.def.url ? ` ${r.def.url}` : ''}`).join('\n')}`).join('\n\n');
}

function renderShopping(body) {
  const all = shoppingData();
  ui.shopAll ??= true; ui.shopStage ??= '';
  const st = stageTotals(all);
  // Filtre par étape : on garde seulement les lignes de cette étape, magasin par magasin.
  const shops = (ui.shopStage ? all.map((g) => { const rows = g.rows.filter((r) => stageOf(r.def) === ui.shopStage); return { ...g, rows, total: rows.reduce((t, r) => t + r.total, 0), left: rows.reduce((t, r) => t + r.total * (r.its.filter((i) => !i.bought).length / r.its.length), 0) }; }).filter((g) => g.rows.length) : all);
  const total = shops.reduce((t, g) => t + g.total, 0), left = shops.reduce((t, g) => t + g.left, 0);
  body.innerHTML = `<h2 class="t">Liste d’achats</h2>
    <div class="price">${euro(left)} <span class="muted small">restent à acheter sur ${euro(total)}</span></div>
    ${all.length ? `<div class="stages"><button class="stg ${ui.shopStage === 'now' ? 'on' : ''}" data-stage="now"><b>Emménagement</b><span>${euro(st.now.left)} à acheter</span><small>sur ${euro(st.now.total)}</small></button><button class="stg ${ui.shopStage === 'later' ? 'on' : ''}" data-stage="later"><b>Plus tard</b><span>${euro(st.later.left)} à acheter</span><small>sur ${euro(st.later.total)}</small></button></div>
    <p class="muted small">Touche une étape pour ne voir qu’elle. Sur chaque ligne, « Plus tard » ou « Emménagement » la fait changer d’étape. Par défaut, la déco, les objets et le mobilier d’extérieur attendent ; la terrasse et la piscine se font avant.</p>` : ''}
    ${shops.length ? `<div class="chips wrap" id="shopF"><button class="chip ${ui.shopAll ? 'on' : ''}" data-all="1">Tout</button><button class="chip ${ui.shopAll ? '' : 'on'}" data-all="0">À acheter</button></div>
    <div class="btnrow"><button class="btn block" id="shopShare">${icon('copy')}Envoyer la liste</button></div>
    ${shops.map((g) => `<div class="shop"><h4><span>${esc(g.name)}</span><span>${euro(g.total)}</span></h4>${g.rows.filter((r) => ui.shopAll || r.its.some((i) => !i.bought)).map((r) => { const done = r.its.every((i) => i.bought), link = purchaseLinks(r.def)[0]; return `<label class="shopline ${done ? 'done' : ''}"><input type="checkbox" data-id="${esc(r.def.id)}" ${done ? 'checked' : ''}/><span class="nm">${r.its.length > 1 ? `${r.its.length} × ` : ''}${esc(r.def.name)}<small>${esc([...r.rooms].join(', '))} · ${r.def.approx ? '≈ ' : ''}${euro(r.total)}</small><button class="stagebtn ${stageOf(r.def)}" data-stg="${esc(r.def.id)}">${STAGE_LABEL[stageOf(r.def)]}</button></span>${link ? `<a href="${esc(link.url)}" target="_blank" rel="noopener">Voir</a>` : '<span></span>'}</label>`; }).join('')}</div>`).join('')}
    <div class="note">Prix relevés à titre indicatif : vérifie-les avant d’acheter. Une case cochée compte comme « déjà acheté » dans le budget.</div>` : '<p class="muted" style="margin-top:12px">Place des meubles sur le plan : ils apparaîtront ici, magasin par magasin.</p>'}`;
  body.querySelectorAll('[data-stage]').forEach((b) => { b.onclick = () => { ui.shopStage = ui.shopStage === b.dataset.stage ? '' : b.dataset.stage; render(); }; });
  body.querySelectorAll('[data-stg]').forEach((b) => { b.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const def = getItem(b.dataset.stg), t = $('#pbody').scrollTop, next = stageOf(def) === 'now' ? 'later' : 'now';
    live(() => { const m = store.project.stages ||= {}; if (next === defaultStage(def)) delete m[def.id]; else m[def.id] = next; });
    render(); $('#pbody').scrollTop = t;
  }; });
  const f = $('#shopF', body);
  if (!f) return;
  f.onclick = (e) => { const a = e.target.dataset.all; if (a !== undefined) { ui.shopAll = a === '1'; render(); } };
  body.querySelectorAll('input[data-id]').forEach((c) => { c.onchange = () => {
    const t = $('#pbody').scrollTop;
    live(() => { store.project.levels.forEach((l) => l.items.forEach((it) => { if (it.cat === c.dataset.id) it.bought = c.checked; })); });
    render(); $('#pbody').scrollTop = t;
  }; });
  $('#shopShare', body).onclick = async () => {
    const text = `Notre Maison : liste d’achats\n\n${shoppingText(shops)}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* partage annulé */ } }
    try { await navigator.clipboard.writeText(text); toast('Liste copiée.'); } catch { toast('Copie impossible sur cet appareil.'); }
  };
}

// ——— Comparer deux versions ———
function projectFacts(p) {
  setCustom(p.custom);
  const st = { project: p, analysis: (l) => analyzeLevel(l) };
  try {
    const b = fullBudget(st), s = surfaces(st);
    const rooms = p.levels.flatMap((l) => l.rooms);
    const glass = p.levels.flatMap((l) => l.walls.flatMap((w) => w.openings)).filter((o) => !isDoorType(o.type)).reduce((t, o) => t + (o.width * o.height) / 10000, 0);
    const furn = b.items.reduce((t, l) => t + l.price, 0);
    return [['Surface habitable', s.habitable, 'm²'], ['Pièces', rooms.length, ''], ['Chambres', rooms.filter((r) => ['chambre', 'parentale', 'enfant'].includes(r.type)).length, ''], ['Niveaux', p.levels.length, ''], ['Surface vitrée', glass, 'm²'], ['Meubles et déco', furn, '€'], ['Construction au m²', b.perM2, '€'], ['Budget total', b.total, '€']];
  } finally { setCustom(store.project.custom); }
}

function drawMini(canvas, project) {
  const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  const c = canvas.getContext('2d'), level = project.levels[project.entry || 0], pts = Object.values(level.nodes);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!pts.length) return;
  const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((r.width - 20) / (x1 - x0 || 1), (r.height - 20) / (y1 - y0 || 1));
  const X = (x) => r.width / 2 + (x - (x0 + x1) / 2) * k, Y = (y) => r.height / 2 + (y - (y0 + y1) / 2) * k;
  const a = analyzeLevel(level);
  c.fillStyle = '#fff';
  for (const room of a.rooms) { c.beginPath(); room.poly.forEach((q, i) => (i ? c.lineTo(X(q.x), Y(q.y)) : c.moveTo(X(q.x), Y(q.y)))); c.closePath(); c.fill(); }
  c.strokeStyle = '#26231e'; c.lineCap = 'square';
  for (const w of a.walls) { c.lineWidth = Math.max(1.5, w.thickness * k); c.beginPath(); c.moveTo(X(level.nodes[w.a].x), Y(level.nodes[w.a].y)); c.lineTo(X(level.nodes[w.b].x), Y(level.nodes[w.b].y)); c.stroke(); }
  c.fillStyle = '#26231e'; c.font = '600 10.5px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  a.rooms.forEach((room, i) => { if (level.rooms[i] && room.grossArea * 10000 * k * k > 2600) c.fillText(level.rooms[i].name, X(room.center.x), Y(room.center.y)); });
}

async function compareDialog() {
  await store.save();
  const list = (await dbAll('projects')).map((x) => x.value).sort((a, b) => b.updated - a.updated);
  if (list.length < 2) { toast('Crée d’abord une deuxième version.'); return; }
  const m = document.createElement('div'); m.className = 'modal';
  const opts = (sel) => list.map((p) => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const other = list.find((p) => p.id !== store.project.id).id;
  m.innerHTML = `<div class="box wide"><h2 class="t">Comparer deux versions</h2>
    <div class="cmp"><div><select id="cA">${opts(store.project.id)}</select><canvas id="pA"></canvas></div><div><select id="cB">${opts(other)}</select><canvas id="pB"></canvas></div></div>
    <div id="cT"></div><div class="btnrow"><button class="btn pri block" id="cX">Fermer</button></div></div>`;
  document.body.append(m);
  const fmt = (v, u) => (u === '€' ? euro(v) : `${u === 'm²' ? v.toFixed(1).replace('.', ',') : Math.round(v)}${u ? ` ${u}` : ''}`);
  const show = () => {
    const A = list.find((p) => p.id === $('#cA', m).value), B = list.find((p) => p.id === $('#cB', m).value);
    drawMini($('#pA', m), A); drawMini($('#pB', m), B);
    const fa = projectFacts(A), fb = projectFacts(B);
    $('#cT', m).innerHTML = `<table class="cmptable"><tr><th></th><th>Gauche</th><th>Droite</th><th>Écart</th></tr>${fa.map(([l, v, u], i) => { const d = fb[i][1] - v; return `<tr><td>${esc(l)}</td><td>${fmt(v, u)}</td><td>${fmt(fb[i][1], u)}</td><td>${Math.abs(d) < 0.05 ? '=' : `${d > 0 ? '+' : '−'} ${fmt(Math.abs(d), u)}`}</td></tr>`; }).join('')}</table>`;
  };
  $('#cA', m).onchange = show; $('#cB', m).onchange = show;
  $('#cX', m).onclick = () => m.remove();
  show();
}

async function shareFile(file) {
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: file.name }); return; } catch { /* partage annulé */ } }
  downloadBlob(file, file.name);
}

// ——— Partage entre téléphones ———
const syncHooks = {
  reload(p) { setCustom(p.custom); store.load(p); fillLevels(); render(); },
  listChanged() { if (ui.tab === 'projects' && !store.selection) render(); },
  async deletedCurrent() {
    const others = (await dbAll('projects')).filter((x) => x.key !== store.project.id).map((x) => x.value).sort((a, b) => b.updated - a.updated);
    await dbDel('projects', store.project.id);
    openProject(others[0] || TEMPLATES[0].make());
    render();
    toast('Ce projet a été supprimé sur l’autre appareil.');
  },
};
const SYNC_LABEL = { off: 'Non partagé', connecting: 'Connexion…', sending: 'Envoi…', ok: 'Partagé, à jour', error: 'Problème de partage' };
store.addEventListener('sync', () => {
  const el = $('#syncState');
  if (el) { el.className = `syncstate ${sync.state}`; el.lastElementChild.textContent = sync.detail || SYNC_LABEL[sync.state]; }
});

function syncBlock() {
  if (sync.state !== 'off' && sync.col) return `<div class="syncstate ${sync.state}" id="syncState"><i></i><span>${esc(sync.detail || SYNC_LABEL[sync.state])}</span></div>
    <p class="muted small">Tous tes projets sont communs avec les appareils connectés au même foyer. La dernière modification enregistrée l’emporte : évitez de changer la même maison au même moment.</p>
    <p class="muted small">Pour vérifier : déplace un meuble sur un téléphone, il bouge sur l’autre en quelques secondes, avec ton prénom affiché.</p>
    <div class="btnrow"><button class="btn" id="syncOff">Arrêter sur cet appareil</button></div>`;
  return `<p class="muted small">Le même code du foyer que dans Table de saison, sur chaque téléphone. Tes projets deviennent communs, et chaque changement arrive chez l’autre.</p>
    ${sync.state === 'error' ? `<div class="syncstate error" id="syncState"><i></i><span>${esc(sync.detail || '')}</span></div>` : '<div id="syncState" hidden><i></i><span></span></div>'}
    <div class="field wide"><label>Code du foyer</label><input id="syncCode" autocomplete="off" autocapitalize="none" value="${esc(knownCode())}"/></div>
    <div class="field wide"><label>Ton prénom</label><input id="syncName" autocomplete="off" value="${esc(knownName())}"/></div>
    <div class="btnrow"><button class="btn pri block" id="syncOn">Activer le partage</button></div>`;
}

function bindSync(body) {
  const on = $('#syncOn', body), off = $('#syncOff', body);
  if (off) off.onclick = () => { disconnect(); render(); toast('Partage arrêté sur cet appareil. Tes projets restent ici.'); };
  if (on) on.onclick = async () => {
    const code = $('#syncCode', body).value.trim(), name = $('#syncName', body).value.trim();
    if (!code || !name) { toast('Indique le code du foyer et ton prénom.'); return; }
    on.disabled = true; on.textContent = 'Connexion…';
    await store.save();
    const ok = await connect(code, name, syncHooks);
    render();
    if (ok) toast('Partage activé.');
  };
}

// ——— Cet appareil : affichage et installation ———
let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
addEventListener('appinstalled', () => { installPrompt = null; toast('Notre Maison est sur l’écran d’accueil.'); });
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function deviceBlock() {
  const auto = AUTO_LOW ? 'léger' : 'complet';
  const opt = (v, l) => `<option value="${v}" ${QUALITY_PREF === v ? 'selected' : ''}>${l}</option>`;
  return `<h3 class="s">Affichage sur cet appareil</h3>
  <div class="field wide"><label>Qualité de la 3D</label><select id="quality">${opt('auto', `Automatique (ici : ${auto})`)}${opt('light', 'Léger : plus fluide, moins de détails')}${opt('full', 'Complet : le plus beau, plus lourd')}</select></div>
  <p class="muted small">Le mode léger retire les reflets, la lumière des fenêtres et les objets lointains. Utile sur un téléphone ou un ordinateur ancien.</p>
  ${installed() ? '' : `<h3 class="s">Installer sur l’écran d’accueil</h3>
  <p class="muted small">L’appli s’ouvre alors en plein écran, comme une vraie appli, et plus vite.</p>
  <div class="btnrow"><button class="btn block" id="install">Installer Notre Maison</button></div>`}`;
}

function installHelp() {
  const m = document.createElement('div'); m.className = 'modal';
  const steps = isIOS()
    ? ['Ouvre ce lien dans <b>Safari</b>.', 'Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut).', 'Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.']
    : ['Ouvre ce lien dans <b>Chrome</b>.', 'Touche le menu <b>⋮</b> en haut à droite.', 'Choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.'];
  m.innerHTML = `<div class="box"><h2 class="t">Installer sur l’écran d’accueil</h2><ol class="small" style="padding-left:20px;line-height:1.6">${steps.map((x) => `<li>${x}</li>`).join('')}</ol>
  <p class="muted small">Sur ordinateur, Chrome et Edge proposent aussi d’installer l’appli depuis la barre d’adresse.</p>
  <div class="btnrow"><button class="btn pri block" id="ix">Compris</button></div></div>`;
  document.body.append(m);
  $('#ix', m).onclick = () => m.remove();
}

function bindDevice(body) {
  const q = $('#quality', body), ins = $('#install', body);
  if (q) q.onchange = async () => {
    setQuality(q.value);
    await store.save();
    toast('Réglage enregistré, l’appli redémarre…');
    setTimeout(() => location.reload(), 600);
  };
  if (ins) ins.onclick = async () => {
    if (installPrompt) { installPrompt.prompt(); const r = await installPrompt.userChoice.catch(() => null); installPrompt = null; if (r?.outcome === 'accepted') render(); return; }
    installHelp();
  };
}

function renderTerrain(body) {
  const p = store.project, slopeKinds = Object.keys(SLOPE_DEFAULT), cur = p.site.env || 'campagne';
  body.innerHTML = `
    <h2 class="t">Terrain et paysage</h2>
    ${parcelBlock(p)}
    <h3 class="s">Paysage autour</h3>
    <div class="chips wrap" id="envs">${ENVIRONMENTS.map((e) => `<button class="chip ${e.id === cur ? 'on' : ''}" data-e="${e.id}">${esc(e.name)}</button>`).join('')}</div>
    <h3 class="s">Forme du terrain</h3>
    <div class="chips wrap" id="shapes">${TERRAIN_SHAPES.map(([k, l]) => `<button class="chip ${k === ui.tShape ? 'on' : ''}" data-k="${k}">${esc(l)}</button>`).join('')}</div>
    <div class="field wide"><label>Descend vers</label><select id="tdir">${DIRECTIONS.map(([k, l]) => `<option value="${k}" ${Number(k) === ui.tDir ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    ${slopeKinds.includes(ui.tShape) ? `<div class="field"><label>Pente : <b id="tpctv">${ui.tPct} %</b></label><input type="range" id="tpct" min="3" max="60" value="${ui.tPct}"/></div>` : ''}
    <div class="btnrow"><button class="btn pri block" id="tapply">Appliquer cette forme</button></div>
    <h3 class="s">Modeler à la main</h3>
    <div class="chips wrap" id="brushes">${BRUSHES.map(([k, l]) => `<button class="chip ${store.brush?.mode === k ? 'on' : ''}" data-b="${k}">${esc(l)}</button>`).join('')}</div>
    <div class="field"><label>Taille du pinceau : <b id="brv">${ui.bRadius} m</b></label><input type="range" id="brad" min="1" max="20" value="${ui.bRadius}"/></div>
    <div class="field"><label>Force</label><input type="range" id="bstr" min="0.2" max="3" step="0.1" value="${ui.bStrength}"/></div>
    <h3 class="s">Sol${store.brush?.mode === 'paint' ? ' à peindre' : ''}</h3>
    <div class="swatches">${GROUNDS.map((g, i) => `<button class="swatch ${(store.brush?.mode === 'paint' ? ui.bGround === i : p.site.ground === g.id) ? 'on' : ''}" data-g="${i}" title="${esc(g.name)}" style="background-image:url(./thumbs/t_${g.t}.webp)"></button>`).join('')}</div>
    <p class="muted small" style="margin-top:6px">Touche un sol pour couvrir tout le terrain, ou choisis « Peindre » pour dessiner des zones.</p>
    <h3 class="s">Position de la maison</h3>
    <div class="field"><label>Altitude du niveau d’entrée (m)</label><input type="number" step="0.1" id="alt" value="${p.site.altitude || 0}"/></div>
    <div class="btnrow"><button class="btn" id="seat">Poser sur le terrain</button><button class="btn" id="flat">Aplanir autour</button></div>
    <h3 class="s">Ciel</h3>
    <div class="field wide"><label>Ambiance</label><select id="tsky">${[['auto', 'Selon l’heure'], ['matin', 'Matin'], ['midi', 'Plein soleil'], ['soir', 'Coucher de soleil'], ['couvert', 'Couvert'], ['nuit', 'Nuit']].map(([k, l]) => `<option value="${k}" ${k === ui.sky ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="note">Sur une pente, le mur s’adapte seul et un niveau en dessous sort du terrain du côté bas. Ajoute-le depuis le menu des niveaux, en haut.</div>`;
  const redo = () => { const t = $('#pbody').scrollTop; render(); $('#pbody').scrollTop = t; };
  bindParcel(body, p, redo);
  $('#envs', body).onclick = (e) => { const k = e.target.dataset.e; if (k) { live(() => { p.site.env = k; if (k === 'neige') p.site.ground = 'neige'; }); redo(); } };
  $('#shapes', body).onclick = (e) => { const k = e.target.dataset.k; if (k) { ui.tShape = k; if (SLOPE_DEFAULT[k]) ui.tPct = SLOPE_DEFAULT[k]; redo(); } };
  $('#tdir', body).onchange = (e) => { ui.tDir = Number(e.target.value); };
  const pc = $('#tpct', body); if (pc) pc.oninput = (e) => { ui.tPct = Number(e.target.value); $('#tpctv', body).textContent = `${ui.tPct} %`; };
  $('#tapply', body).onclick = () => { live(() => { shapeTerrain(p, ui.tShape, { dir: ui.tDir, pct: ui.tPct }); seatHouse(p); }); plan.contourSrc = null; toast('Terrain modifié. Tout reste annulable.'); redo(); };
  $('#brushes', body).onclick = (e) => { const k = e.target.dataset.b; if (!k) return; if (store.brush?.mode === k) endBrush(); else { startBrush(k); redo(); } };
  $('#brad', body).oninput = (e) => { ui.bRadius = Number(e.target.value); $('#brv', body).textContent = `${ui.bRadius} m`; if (store.brush) store.brush.radius = ui.bRadius; };
  $('#bstr', body).oninput = (e) => { ui.bStrength = Number(e.target.value); if (store.brush) store.brush.strength = ui.bStrength; };
  body.querySelectorAll('.swatch[data-g]').forEach((b) => { b.onclick = () => {
    const i = Number(b.dataset.g);
    if (store.brush?.mode === 'paint') { ui.bGround = i; store.brush.ground = i; redo(); return; }
    live(() => { p.site.ground = GROUNDS[i].id; if (p.site.terrain) { const m = ensureTerrain(p); m.p.fill(0); commitTerrain(p); } });
    redo();
  }; });
  $('#alt', body).onchange = (e) => live(() => { p.site.altitude = Number(e.target.value) || 0; });
  $('#seat', body).onclick = () => { if (!p.site.terrain) { toast('Le terrain est plat : rien à ajuster.'); return; } live(() => seatHouse(p)); redo(); };
  $('#flat', body).onclick = () => { live(() => flattenAround(p, (p.site.altitude || 0))); plan.contourSrc = null; toast('Terrain aplani autour de la maison.'); redo(); };
  $('#tsky', body).onchange = (e) => { ui.sky = e.target.value; view?.setEnv({ sky: ui.sky }); };
}

function renderBudget(body) {
  const b = fullBudget(store), s = b.settings, inside = b.perM2 >= MARKET.low && b.perM2 <= MARKET.high;
  ui.openGroups ||= new Set(['mobilier']);
  const opt = (list, cur) => list.map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
  body.innerHTML = `
    <h2 class="t">Budget tout compris</h2>
    <div class="bigtotal"><span>${b.hasTerrain ? 'Coût total du projet' : 'Coût total, hors prix du terrain'}</span><b>${euro(b.total)}</b><small>De ${euro(b.low)} en économique à ${euro(b.high)} en haut de gamme</small></div>
    ${b.hasTerrain ? '' : '<div class="check warn"><b>Indique le prix du terrain</b><span>Le terrain et ses frais de notaire ne sont pas comptés tant qu’il n’est pas renseigné.</span></div>'}
    ${b.bought ? `<div class="total"><span class="muted">Déjà acheté</span><b>${euro(b.bought)}</b></div><div class="total"><span class="muted">Reste à payer</span><b>${euro(b.remaining)}</b></div>` : ''}
    <div class="note">Construction seule : <b>${euro(b.perM2)}/m²</b> habitable pour ${fmt1(b.m.hab)} m². ${b.m.hab ? (inside ? `Dans la fourchette française de ${euro(MARKET.low)} à ${euro(MARKET.high)}/m².` : `Hors de la fourchette française habituelle (${euro(MARKET.low)} à ${euro(MARKET.high)}/m²) : vérifie les lignes ci-dessous.`) : ''}</div>
    <h3 class="s">Ton projet</h3>
    <div class="seg gamme" id="gamme">${GAMMES.map(([k, l]) => `<button data-g="${k}" class="${k === s.gamme ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="field wide"><label>Réalisation</label><select data-s="mode">${opt(MODES, s.mode)}</select></div>
    <div class="field"><label>Prix du terrain (€)</label><input type="number" inputmode="numeric" data-n="terrain" value="${s.terrain || ''}" placeholder="À renseigner"/></div>
    <div class="field"><label>Surface du terrain (m²)</label><input type="number" inputmode="numeric" data-n="terrainArea" value="${s.terrainArea}"/></div>
    <div class="field wide"><label>Vendeur</label><select data-s="vendeur">${opt([['particulier', 'Un particulier'], ['pro', 'Un lotisseur']], s.vendeur)}</select></div>
    <div class="field wide"><label>Égouts</label><select data-s="assainissement">${opt([['collectif', 'Tout-à-l’égout'], ['individuel', 'Assainissement individuel']], s.assainissement)}</select></div>
    <div class="field"><label>Taxe, part commune (%)</label><input type="number" step="0.5" data-n="commune" value="${s.commune}"/></div>
    <div class="field"><label>Taxe, part département (%)</label><input type="number" step="0.5" data-n="dept" value="${s.dept}"/></div>
    <div class="field"><label>Imprévus (%)</label><input type="number" step="1" data-n="imprevus" value="${s.imprevus}"/></div>
    <h3 class="s">Détail</h3>
    <p class="muted small" style="margin:0 0 8px">Remplace n’importe quel montant par ton devis. Décoche ce que tu ne veux pas compter.</p>
    ${b.groups.map((g) => `<details class="bg" data-g="${g.id}" ${ui.openGroups.has(g.id) ? 'open' : ''}><summary><span>${esc(g.title)}</span><b>${euro(g.total)}</b></summary>
      ${g.lines.map(budgetLine).join('')}
      ${g.items.map((l) => `<div class="line"><input type="checkbox" data-b="${l.it.id}" ${l.it.bought ? 'checked' : ''} style="width:20px;height:20px" aria-label="Acheté"/><img data-th="${esc(l.def.id)}" alt=""/><div class="m"><b>${esc(l.def.name)}</b><span>${esc(l.room)} · ${esc(l.def.label)}</span></div><div class="r"><a href="${esc(purchaseLinks(l.def)[0]?.url || '#')}" target="_blank" rel="noopener">${l.def.approx ? '≈ ' : ''}${euro(l.price)}</a></div></div>`).join('')}
    </details>`).join('')}
    <h3 class="s">Si vous empruntez</h3>
    <div class="field"><label>Apport (€)</label><input type="number" inputmode="numeric" data-l="apport" value="${s.loan.apport || ''}"/></div>
    <div class="field"><label>Taux du prêt (%)</label><input type="number" step="0.05" data-l="taux" value="${s.loan.taux || ''}" placeholder="Ex. offre bancaire"/></div>
    <div class="field"><label>Durée (ans)</label><input type="number" data-l="duree" value="${s.loan.duree}"/></div>
    <div class="field"><label>Assurance (% par an)</label><input type="number" step="0.05" data-l="assurance" value="${s.loan.assurance}"/></div>
    ${b.credit ? `<div class="total"><span class="muted">Mensualité, assurance comprise</span><b>${euro(b.credit.mensualite)}</b></div><div class="total"><span class="muted">Coût du crédit</span><b>${euro(b.credit.total)}</b></div><div class="note">Calcul simple à taux fixe, sans les intérêts intercalaires pendant le chantier. Seule une offre de prêt fait foi.</div>` : ''}
    <div class="btnrow"><button class="btn block" id="csv">Exporter tout le budget</button></div>
    <div class="note">Prix TTC relevés en novembre 2026, à titre indicatif : les écarts entre artisans et régions sont importants. Les lignes « estimation » n’ont pas de source publique fiable. Seuls des devis font foi. Hors aides, frais de garde-meubles et taxe foncière.</div>
    <details class="bg"><summary><span>Sources des prix</span></summary><ul class="src">${BUDGET_SOURCES.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul></details>`;
  fillThumbs(body);
  body.querySelectorAll('details[data-g]').forEach((d) => { d.ontoggle = () => { if (d.open) ui.openGroups.add(d.dataset.g); else ui.openGroups.delete(d.dataset.g); }; });
  $('#gamme', body).onclick = (e) => { const g = e.target.dataset.g; if (g) setBudget((c) => { c.gamme = g; }); };
  body.querySelectorAll('[data-s]').forEach((el) => { el.onchange = () => setBudget((c) => { c[el.dataset.s] = el.value; }); });
  body.querySelectorAll('[data-n]').forEach((el) => { el.onchange = () => setBudget((c) => { c[el.dataset.n] = Math.max(0, Number(el.value) || 0); }); });
  body.querySelectorAll('[data-l]').forEach((el) => { el.onchange = () => setBudget((c) => { c.loan = { ...c.loan, [el.dataset.l]: Math.max(0, Number(el.value) || 0) }; }); });
  body.querySelectorAll('[data-on]').forEach((el) => { el.onchange = () => setBudget((c) => { if (el.checked) delete c.off[el.dataset.on]; else c.off[el.dataset.on] = true; }); });
  body.querySelectorAll('[data-amt]').forEach((el) => { el.onchange = () => setBudget((c) => { c.over[el.dataset.amt] = Math.max(0, Number(el.value) || 0); delete c.off[el.dataset.amt]; }); });
  body.querySelectorAll('[data-reset]').forEach((el) => { el.onclick = () => setBudget((c) => { delete c.over[el.dataset.reset]; }); });
  body.querySelectorAll('[data-b]').forEach((c) => { c.onchange = () => { for (const lv of store.project.levels) { const it = lv.items.find((i) => i.id === c.dataset.b); if (it) { store.snapshot(); it.bought = c.checked; store.commit({ rebuild: false }); } } }; });
  $('#csv', body).onclick = () => {
    const rows = [['Poste', 'Détail', 'Quantité', 'Unité', 'Prix unitaire', 'Montant', 'Base', 'Acheté', 'Lien']];
    for (const g of b.groups) {
      for (const l of g.lines) if (!l.off) rows.push([g.title, l.label, l.unit === '€' ? '' : fmt1(l.qty), l.unit === '€' ? '' : l.unit, l.unit === '€' ? '' : Math.round(l.price), Math.round(l.amount), l.over ? 'Mon montant' : l.est ? 'Estimation' : 'Prix marché', '', '']);
      for (const l of g.items) rows.push([g.title, `${l.def.name} (${l.room})`, 1, 'u', Math.round(l.price), Math.round(l.price), l.def.approx ? 'Prix indicatif' : 'Fiche produit', l.it.bought ? 'oui' : 'non', purchaseLinks(l.def)[0]?.url || '']);
    }
    rows.push(['TOTAL', '', '', '', '', Math.round(b.total + (b.credit?.total || 0)), '', '', '']);
    downloadBlob(new Blob(['﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' }), 'budget-maison.csv');
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
  body.innerHTML = `<h2 class="t">Projets</h2><p class="muted small">Crée plusieurs versions pour comparer vos idées.</p><div style="margin-top:10px">${list.map((p) => `<div class="proj ${p.id === store.project.id ? 'on' : ''}"><button class="m" data-open="${p.id}"><b>${esc(p.name)}</b><div class="muted small">Modifié le ${new Date(p.updated).toLocaleDateString('fr-FR')} à ${new Date(p.updated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${p.by && p.byAt === p.updated ? ` par ${esc(p.by)}` : ''}${p.tplVersion ? ' · dernière version' : ''}</div></button><button class="iconbtn" data-copy="${p.id}" title="Dupliquer">${icon('copy')}</button><button class="iconbtn" data-del="${p.id}" title="Supprimer">${icon('trash')}</button></div>`).join('')}</div>
  <div class="btnrow"><button class="btn pri block" id="new">Nouveau projet</button></div>
  <div class="btnrow"><button class="btn" id="cmp">Comparer deux versions</button><button class="btn" id="pdf">Plan coté en PDF</button></div>
  <div class="btnrow"><button class="btn block" id="dossierP">Dossier complet en PDF</button></div>
  <h3 class="s">Partager entre vos téléphones</h3>
  ${syncBlock()}
  ${deviceBlock()}
  <h3 class="s">Passer d'un appareil à l'autre</h3>
  <p class="muted small">Envoie le fichier du projet à ton autre appareil, puis ouvre-le ici.</p>
  <div class="btnrow"><button class="btn" id="exp">Envoyer ce projet</button><label class="btn">Ouvrir un fichier<input type="file" id="imp" accept=".json,.maison,application/json" hidden/></label></div>
  <div class="field wide" style="margin-top:12px"><label>Nom</label><input id="pname" value="${esc(store.project.name)}"/></div>
  <div class="btnrow"><button class="btn block" id="tourAgain">Revoir la visite guidée</button></div>
  <h3 class="s">Crédits</h3><p class="muted small">Modèles scannés, ciels et matières : Poly Haven (CC0). Prix et dimensions : fiches produits publiques. Les marques citées appartiennent à leurs propriétaires ; aucun partenariat.</p>`;
  $('#new', body).onclick = templatePicker;
  $('#cmp', body).onclick = compareDialog;
  $('#pdf', body).onclick = async () => {
    await store.save();
    const { planPdf } = await import('./planpdf.js');
    const blob = planPdf(store.project);
    if (!blob) { toast('Trace d’abord des murs.'); return; }
    await shareFile(new File([blob], `${store.project.name} - plan.pdf`, { type: 'application/pdf' }));
  };
  $('#dossierP', body).onclick = (e) => makeDossier(e.currentTarget);
  $('#tourAgain', body).onclick = () => { if (narrow()) setPanel(false); startTour(); };
  bindSync(body);
  bindDevice(body);
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
    if (c) { await store.save(); const p = await dbGet('projects', c.dataset.copy); const n = { ...p, id: uid('P'), name: `${p.name} (version 2)`, updated: Date.now() }; await dbPut('projects', n.id, n); queuePush(n.id); render(); }
    if (d && d.dataset.del !== store.project.id && confirm('Supprimer définitivement ce projet ?')) { await dbDel('projects', d.dataset.del); removeShared(d.dataset.del); render(); }
  };
}

// ——— Fiche des pièces : les mesures utiles en magasin ———
function segPointDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Écart entre deux contours fermés : 0 s'ils se touchent ou se chevauchent. */
function polyGap(A, B) {
  if (A.some((p) => pointInPolygon(p, B)) || B.some((p) => pointInPolygon(p, A))) return 0;
  let m = Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) m = Math.min(m, segPointDist(p, Q[i], Q[(i + 1) % Q.length]));
  return m;
}
/** « Cama - Lit coffre en velours côtelé 180x200cm » devient « lit coffre en velours ». */
function shortName(name) {
  let w = name.replace(/^[^-–]{1,20}\s[-–]\s/, '').split(/[,(]|\s\d/)[0].trim().split(/\s+/).slice(0, 4);
  while (w.length > 1 && /^(de|du|des|et|en|à|au|aux|avec|la|le|les|pour|sur|jusqu’au|jusqu'au|d'|l')$/i.test(w[w.length - 1])) w.pop();
  const t = w.join(' ');
  return t.charAt(0).toLowerCase() + t.slice(1);
}
const isObstacle = (it, def) => def && !def.ceiling && !def.wall && def.cat !== 'structure' && (it.z ?? def.z ?? 0) < 60 && (def.h ?? 0) >= 25 && def.model?.type !== 'rug' && def.sub !== 'tapis';
const cmTxt = (v) => `${Math.round(v)} cm`;
const mTxt = (v) => `${(v / 100).toFixed(2).replace('.', ',')} m`;

function roomSheets() {
  const out = [];
  store.project.levels.forEach((lv) => {
    const a = store.analysis(lv);
    a.rooms.forEach((r, i) => {
      const info = lv.rooms[i]; if (!info) return;
      const walls = r.wallIds.map((id) => lv.walls.find((w) => w.id === id)).filter(Boolean);
      const th = walls.length ? walls.reduce((t, w) => t + w.thickness, 0) / walls.length : 20;
      const xs = r.poly.map((q) => q.x), ys = r.poly.map((q) => q.y);
      const L = Math.max(...xs) - Math.min(...xs) - th, l = Math.max(...ys) - Math.min(...ys) - th;
      const rect = r.poly.length === 4 && Math.abs(r.area * 10000 - L * l) / (L * l) < 0.08;
      const doors = [], wins = [];
      for (const w of walls) for (const o of w.openings) (isDoorType(o.type) ? doors : wins).push(o.width);
      const light = daylight(lv, a, i, r);
      const items = lv.items.filter((it) => pointInPolygon({ x: it.x, y: it.y }, r.poly)).map((it) => ({ it, def: getItem(it.cat) })).filter((x) => x.def);
      const obs = items.filter((x) => isObstacle(x.it, x.def)).map((x) => ({ ...x, poly: itemCorners(x.it, x.def) }));
      const used = obs.reduce((t, x) => t + ((x.it.w ?? x.def.w) * (x.it.d ?? x.def.d)) / 10000, 0);
      const free = Math.max(0, r.area - used);
      // Passage le plus étroit : entre deux meubles, ou entre un meuble et un mur (on ignore ce qui est collé).
      let narrow = null;
      // Contre un mur, moins de 45 cm n'est pas un passage mais un simple recul : on l'ignore.
      const consider = (g, what, min) => { if (g >= min && g < 120 && (!narrow || g < narrow.g)) narrow = { g, what }; };
      const nm = (d) => shortName(d.name);
      // Seuls les gros meubles forment des passages : chaises, tabourets, plantes et guéridons se déplacent.
      const big = obs.filter((x) => ((x.it.w ?? x.def.w) * (x.it.d ?? x.def.d)) / 10000 >= 0.3 && Math.min(x.it.w ?? x.def.w, x.it.d ?? x.def.d) >= 35);
      for (let x = 0; x < big.length; x++) {
        for (let y = x + 1; y < big.length; y++) consider(polyGap(big[x].poly, big[y].poly), `${nm(big[x].def)} et ${nm(big[y].def)}`, 25);
        const toWall = Math.min(...big[x].poly.flatMap((p) => r.poly.map((q, k) => segPointDist(p, q, r.poly[(k + 1) % r.poly.length])))) - th / 2;
        consider(toWall, `${nm(big[x].def)} et le mur`, 45);
      }
      out.push({ level: lv.name, name: info.name, light, area: r.area, L: Math.max(L, l), l: Math.min(L, l), rect, height: lv.height, doors, wins, items, obs, free, used, narrow });
    });
  });
  return out;
}

// Lumière du jour : surface vitrée vers l'extérieur rapportée au sol, pondérée par l'orientation.
const COMPASS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
function daylight(lv, a, i, r) {
  const north = ((store.project.site?.north || 0) * Math.PI) / 180, N = { x: Math.sin(north), y: -Math.cos(north) }, E = { x: Math.cos(north), y: Math.sin(north) };
  let eff = 0, glass = 0;
  const dirs = new Map();
  for (const w of lv.walls) for (const [s, o] of [['L', 'R'], ['R', 'L']]) {
    if (a.sideRoom.get(`${w.id}:${s}`) !== i || a.sideRoom.has(`${w.id}:${o}`)) continue;
    const A = lv.nodes[w.a], B = lv.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    // Normale vers l'extérieur de la pièce.
    let n = { x: -(B.y - A.y) / L, y: (B.x - A.x) / L }; if (s === 'L') n = { x: -n.x, y: -n.y };
    const mid = { x: (A.x + B.x) / 2 + n.x * 30, y: (A.y + B.y) / 2 + n.y * 30 };
    if (pointInPolygon(mid, r.poly)) n = { x: -n.x, y: -n.y };
    const az = ((Math.atan2(n.x * E.x + n.y * E.y, n.x * N.x + n.y * N.y) * 180) / Math.PI + 360) % 360;
    const f = az > 112 && az < 248 ? 1 : az > 45 && az < 315 ? 0.8 : 0.55;
    for (const op of w.openings) {
      if (isDoorType(op.type) && !op.glazed) continue;
      const m2 = (op.width * op.height) / 10000;
      glass += m2; eff += m2 * f;
      const d = COMPASS[Math.round(az / 45) % 8]; dirs.set(d, (dirs.get(d) || 0) + m2);
    }
  }
  const ratio = r.area ? eff / r.area : 0;
  const [label, cls] = ratio >= 0.25 ? ['Très lumineuse', 'ok'] : ratio >= 0.15 ? ['Lumineuse', 'ok'] : ratio >= 0.08 ? ['Correcte', 'mid'] : ['Sombre', 'bad'];
  return { glass, ratio, label, cls, dirs: [...dirs].sort((x, y) => y[1] - x[1]).map(([d]) => d) };
}

function sheetText(r) {
  const lines = [`${r.name} (${r.level})`, `${r.rect ? '' : 'Environ '}${mTxt(r.L)} × ${mTxt(r.l)}, ${r.area.toFixed(1).replace('.', ',')} m², hauteur ${cmTxt(r.height)}`];
  lines.push(`Lumière du jour : ${r.light.label.toLowerCase()}${r.light.glass ? ` (${r.light.glass.toFixed(1).replace('.', ',')} m² vitrés, ${r.light.dirs.join(', ')})` : ', aucune fenêtre'}`);
  if (r.doors.length) lines.push(`Portes : ${r.doors.map(cmTxt).join(', ')}`);
  if (r.wins.length) lines.push(`Fenêtres : ${r.wins.map(cmTxt).join(', ')}`);
  if (r.obs.length) lines.push(`Place libre au sol : ${r.free.toFixed(1).replace('.', ',')} m² (${Math.round((r.free / r.area) * 100)} %)`);
  if (r.narrow) lines.push(`Passage le plus étroit : ${cmTxt(r.narrow.g)}, entre ${r.narrow.what}`);
  if (r.items.length) lines.push(`Meubles : ${r.items.map((x) => `${x.def.name} ${Math.round(x.it.w ?? x.def.w)}×${Math.round(x.it.d ?? x.def.d)}`).join(', ')}`);
  return lines.join('\n');
}

// ——— Dossier PDF : tout le projet en un fichier, pour un artisan ou la banque ———
async function makeDossier(btn) {
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = 'Préparation du dossier…'; }
  try {
    await store.save();
    const p = store.project, b = fullBudget(store), su = surfaces(store), rooms = roomSheets();
    const shops = shoppingData(), st = stageTotals(shops), rows = { now: [], later: [] };
    for (const g of shops) for (const r of g.rows) rows[stageOf(r.def)].push([`${r.its.length > 1 ? `${r.its.length} × ` : ''}${r.def.name}`, [...r.rooms].join(', '), euro(r.total), r.total]);
    for (const k of ['now', 'later']) rows[k].sort((x, y) => y[3] - x[3]);
    const furn = b.items.reduce((t, l) => t + l.price, 0);
    const all = p.levels.flatMap((l) => l.rooms);
    const facts = [['Surface habitable', `${su.habitable.toFixed(0)} m²`], ['Pièces', String(all.length)], ['Chambres', String(all.filter((r) => ['chambre', 'parentale', 'enfant'].includes(r.type)).length)], ['Niveaux', String(p.levels.length)], ['Budget total estimé', euro(b.total)], ['Dont meubles et déco', euro(furn)]];
    const { dossierPdf, pdfImage } = await import('./planpdf.js');
    const saved = (await dbAll('renders')).map((x) => x.value).filter((x) => x.project === p.id).sort((x, y) => y.date - x.date).slice(0, 5);
    const photos = [];
    for (const r of saved) { try { photos.push(await pdfImage(r.blob)); } catch { /* photo illisible */ } }
    if (!photos.length && ui.view === '3d') { try { photos.push(await pdfImage(await (await fetch(view.grab())).blob())); } catch { /* vue indisponible */ } }
    const blob = dossierPdf(p, { facts, address: p.site.address || '', rooms, photos, budget: { lines: [['Budget total estimé', euro(b.total)], ['Construction au m²', euro(b.perM2)], ['Meubles et déco', euro(furn)]], stages: st, rows } });
    await shareFile(new File([blob], `${p.name} - dossier.pdf`, { type: 'application/pdf' }));
    if (!saved.length) toast(photos.length ? 'Astuce : les photos enregistrées en mode Photo rendent le dossier plus beau.' : 'Astuce : enregistre une ou deux photos en mode Photo, elles iront dans le dossier.');
  } catch (e) { console.error(e); toast('Le dossier n’a pas pu être créé.'); } finally { if (btn) { btn.disabled = false; btn.innerHTML = label; } }
}

function renderMeasures(body) {
  const rooms = roomSheets();
  const tag = (g) => (g < 70 ? 'bad' : g < 90 ? 'mid' : 'ok');
  body.innerHTML = `<h2 class="t">Fiche des pièces</h2>
    <p class="muted small">Les mesures intérieures de chaque pièce, prises sur le plan. Les passages : 90 cm est confortable, 70 cm est un minimum. La lumière du jour compte les vitrages sur l’extérieur : le sud compte plein, l’est et l’ouest un peu moins, le nord encore moins.</p>
    ${(() => { const dark = rooms.filter((r) => r.light.cls === 'bad' && /salon|séjour|chambre|bureau|cuisine|manger|suite/i.test(r.name)); return dark.length ? `<div class="note">Pièces de vie un peu sombres : ${dark.map((r) => esc(r.name)).join(', ')}. Une fenêtre de plus ou une baie plus large changerait tout.</div>` : ''; })()}
    ${rooms.length ? `<div class="btnrow"><button class="btn block" id="dossier">${icon('copy')}Dossier PDF du projet</button></div>` : ''}
    ${rooms.length ? `<div class="btnrow"><button class="btn block" id="sheetShare">${icon('copy')}Envoyer la fiche</button></div>` : '<p class="muted" style="margin-top:12px">Trace des pièces sur le plan : leurs mesures apparaîtront ici.</p>'}
    ${rooms.map((r, k) => `<div class="sheet"><h4><span>${esc(r.name)}</span><span class="muted small">${esc(r.level)}</span></h4>
      <div class="kv"><span>Dimensions</span><b>${r.rect ? '' : '≈ '}${mTxt(r.L)} × ${mTxt(r.l)}</b></div>
      <div class="kv"><span>Surface</span><b>${r.area.toFixed(1).replace('.', ',')} m²</b></div>
      <div class="kv"><span>Hauteur sous plafond</span><b>${cmTxt(r.height)}</b></div>
      <div class="kv"><span>Lumière du jour</span><b class="pass ${r.light.cls}">${r.light.label}</b></div><div class="lightbar"><i style="width:${Math.min(100, (r.light.ratio / 0.3) * 100)}%"></i></div><div class="muted small" style="text-align:right">${r.light.glass ? `${r.light.glass.toFixed(1).replace('.', ',')} m² vitrés · ${esc(r.light.dirs.join(', '))}` : 'aucune fenêtre sur l’extérieur'}</div>
      ${r.doors.length ? `<div class="kv"><span>Porte${r.doors.length > 1 ? 's' : ''}</span><b>${r.doors.map(cmTxt).join(' · ')}</b></div>` : ''}
      ${r.wins.length ? `<div class="kv"><span>Fenêtre${r.wins.length > 1 ? 's' : ''}</span><b>${r.wins.map(cmTxt).join(' · ')}</b></div>` : ''}
      ${r.obs.length ? `<div class="kv"><span>Place libre au sol</span><b>${r.free.toFixed(1).replace('.', ',')} m² · ${Math.round((r.free / r.area) * 100)} %</b></div>` : ''}
      ${r.narrow ? `<div class="kv"><span>Passage le plus étroit</span><b class="pass ${tag(r.narrow.g)}">${cmTxt(r.narrow.g)}</b></div><div class="muted small" style="text-align:right">entre ${esc(r.narrow.what)}</div>` : ''}
      ${r.items.length ? `<details><summary class="small">${r.items.length} meuble${r.items.length > 1 ? 's' : ''}</summary><div class="small">${r.items.map((x) => `<div class="kv"><span>${esc(x.def.name)}</span><span>${Math.round(x.it.w ?? x.def.w)} × ${Math.round(x.it.d ?? x.def.d)} × ${Math.round(x.def.h)} cm</span></div>`).join('')}</div></details>` : ''}
      <div class="btnrow"><button class="btn" data-sheet="${k}">Envoyer cette pièce</button></div></div>`).join('')}`;
  const send = async (text) => {
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* partage annulé */ } }
    try { await navigator.clipboard.writeText(text); toast('Fiche copiée.'); } catch { toast('Copie impossible sur cet appareil.'); }
  };
  const dos = $('#dossier', body); if (dos) dos.onclick = () => makeDossier(dos);
  const all = $('#sheetShare', body);
  if (all) all.onclick = () => send(`${store.project.name} : fiche des pièces\n\n${rooms.map(sheetText).join('\n\n')}`);
  body.querySelectorAll('[data-sheet]').forEach((b) => { b.onclick = () => send(sheetText(rooms[Number(b.dataset.sheet)])); });
}

function renderMore(body) {
  body.innerHTML = `<h2 class="t">Plus</h2>${[['shopping', 'Liste d’achats', 'Tous les meubles, magasin par magasin'], ['measures', 'Fiche des pièces', 'Dimensions, place libre, passages : à emporter en magasin'], ['terrain', 'Terrain et paysage', 'Parcelle, pente, relief, environnement'], ['style', 'Style de la maison', 'Façade, toiture, plan importé'], ['advice', 'Conseils', 'Règles et confort'], ['photos', 'Photos', 'Images photoréalistes'], ['projects', 'Projets', 'Versions, comparaison, plan PDF, partage']].map(([k, a, b]) => `<button class="tpl" data-k="${k}"><b>${a}</b><span class="muted small">${b}</span></button>`).join('')}`;
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
    await loadMore().catch(() => {});
    openProject(TEMPLATES.find((t) => t.id === b.dataset.t).make());
    await store.save();
    m.remove(); render();
  }; });
}

/** Une ancienne copie de la maison anglaise ne se met pas à jour seule : on propose la dernière, sans rien effacer. */
function offerLatestManor(p) {
  const key = `nm-manor-seen-${MANOR_VERSION}`;
  let seen = false;
  try { seen = !!localStorage.getItem(key); } catch { /* navigation privée */ }
  if (seen || p.name !== 'Maison anglaise' || (p.tplVersion || 0) >= MANOR_VERSION) return false;
  const remember = () => { try { localStorage.setItem(key, '1'); } catch { /* navigation privée */ } };
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><h2 class="t">Nouvelle version de la maison</h2><p class="muted small">Vous regardez une ancienne copie. La dernière version a la Ferrari et la Porsche au garage, un rendu plus réaliste et le jardin vivant. Votre copie actuelle reste enregistrée dans Projets.</p><div class="btnrow"><button class="btn" id="mkeep">Garder celle-ci</button><button class="btn pri" id="mlatest">Ouvrir la nouvelle</button></div></div>`;
  document.body.append(m);
  $('#mkeep', m).onclick = () => { remember(); m.remove(); };
  $('#mlatest', m).onclick = async () => {
    remember();
    await store.save();
    await loadMore().catch(() => {});
    openProject(TEMPLATES.find((t) => t.id === 'manoir').make());
    await store.save();
    m.remove(); fillLevels(); render();
  };
  return true;
}

function openProject(p) {
  // Les projets créés avec l'ancien réglage par défaut passent sur Toulouse.
  if (p.site?.city === 'Albi') Object.assign(p.site, { lat: 43.6, lon: 1.44, city: 'Périphérie de Toulouse' });
  setCustom(p.custom);
  store.levelIndex = 0;
  store.load(p);
  plan.fitted = false; plan.fit();
  ui.framed = false;
  fillLevels();
  if (ui.view === '3d' && view) { view.rebuild(); view.frame(); ui.framed = true; }
}

// ——— Événements du magasin ———
// ——— Mesures en Visite : toucher un mur, un meuble ou une ouverture affiche ses dimensions ———
/** Distance le long d'une direction jusqu'au premier mur rencontré (en cm), en ignorant certains murs. */
function castToWall(lv, from, dir, skip) {
  let best = null;
  for (const w of lv.walls) {
    if (w.id === skip) continue;
    const A = lv.nodes[w.a], B = lv.nodes[w.b], ex = B.x - A.x, ey = B.y - A.y, den = dir.x * ey - dir.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((A.x - from.x) * ey - (A.y - from.y) * ex) / den, u = ((A.x - from.x) * dir.y - (A.y - from.y) * dir.x) / den;
    if (t > 3 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, w };
  }
  return best;
}
const mFmt = (cm) => `${(cm / 100).toFixed(2).replace('.', ',')} m`;
function measureInWalk() {
  const pill = $('#measPill'), sel = store.selection, lv = store.level;
  const hide = () => { pill.classList.add('hidden'); view.clearMeasure(); };
  if (view.mode !== 'walk' || ui.view !== '3d' || !sel) { hide(); return; }
  const base = view.baseOf(store.levelIndex), hit = view.lastHit, here = hit && { x: hit.x / 0.01, y: hit.z / 0.01 };
  let text = '';
  if (sel.type === 'wall') {
    const w = lv.walls.find((x) => x.id === sel.id); if (!w || !here) { hide(); return; }
    const A = lv.nodes[w.a], B = lv.nodes[w.b], L = Math.hypot(B.x - A.x, B.y - A.y);
    let n = { x: -(B.y - A.y) / L, y: (B.x - A.x) / L };
    const cam = { x: view.camera.position.x / 0.01, y: view.camera.position.z / 0.01 };
    if ((cam.x - here.x) * n.x + (cam.y - here.y) * n.y < 0) n = { x: -n.x, y: -n.y };
    const f = castToWall(lv, here, n, w.id);
    text = `<b>Mur : ${mFmt(L)}</b> de long`;
    if (f) { const d = f.t - f.w.thickness / 2; text += ` · <b>${mFmt(d)}</b> jusqu’au mur d’en face`; view.showMeasure(here, { x: here.x + n.x * d, y: here.y + n.y * d }, Math.max(base + 0.3, hit.y)); }
    else view.clearMeasure();
  } else if (sel.type === 'item') {
    const it = lv.items.find((x) => x.id === sel.id), def = it && getItem(it.cat); if (!def) { hide(); return; }
    const W = it.w ?? def.w, D = it.d ?? def.d, H = it.h ?? def.h, r = ((it.rot || 0) * Math.PI) / 180, fr = { x: -Math.sin(r), y: Math.cos(r) };
    text = `<b>${esc(def.name)}</b> · ${Math.round(W)} × ${Math.round(D)} × ${Math.round(H)} cm`;
    const f = def.ceiling || def.wall ? null : castToWall(lv, { x: it.x, y: it.y }, fr);
    if (f) {
      const d = f.t - D / 2 - f.w.thickness / 2, a = { x: it.x + fr.x * (D / 2), y: it.y + fr.y * (D / 2) };
      if (d > 5) { text += ` · <b>${mFmt(d)}</b> devant, jusqu’au mur`; view.showMeasure(a, { x: a.x + fr.x * d, y: a.y + fr.y * d }, base + 0.25); } else view.clearMeasure();
    } else view.clearMeasure();
  } else if (sel.type === 'opening') {
    const w = lv.walls.find((x) => x.id === sel.wallId), o = w?.openings.find((x) => x.id === sel.id); if (!o) { hide(); return; }
    text = `<b>${isDoorType(o.type) ? 'Passage' : 'Fenêtre'} : ${Math.round(o.width)} × ${Math.round(o.height)} cm</b>${o.sill ? ` · allège ${Math.round(o.sill)} cm` : ''}`;
    view.clearMeasure();
  } else if (sel.type === 'room') {
    const i = lv.rooms.findIndex((x) => x.id === sel.id), r = store.analysis(lv).rooms[i];
    if (!r) { hide(); return; }
    text = `<b>${esc(lv.rooms[i].name)}</b> · ${r.area.toFixed(1).replace('.', ',')} m² · hauteur ${Math.round(lv.height)} cm`;
    view.clearMeasure();
  } else { hide(); return; }
  pill.innerHTML = text; pill.classList.remove('hidden');
}
function setMeasureMode(on) {
  view.measureMode = on; $('#measWalk').classList.toggle('on', on); $('#measWalk').textContent = on ? 'Mesurer : activé' : 'Mesurer';
  if (on) { if (document.pointerLockElement) document.exitPointerLock(); view.hoverLook = false; toast('Touche un mur, un meuble ou une fenêtre pour voir ses mesures.'); }
  else { store.select(null); $('#measPill').classList.add('hidden'); view.clearMeasure(); }
}
$('#measWalk').onclick = () => setMeasureMode(!view.measureMode);
store.addEventListener('walk', (e) => { if (!e.detail) { if (view.measureMode) setMeasureMode(false); $('#measPill').classList.add('hidden'); view.clearMeasure(); } });

store.addEventListener('select', () => {
  measureInWalk();
  ui.detail = null;
  renderSelbar();
  if (narrow() && !store.selection && ui.panelOpen && ui.selPanel) setPanel(false);
  ui.selPanel = !!store.selection;
  render();
});
store.addEventListener('change', () => {
  syncChrome();
  if (['budget', 'advice'].includes(ui.tab) && !store.selection && !$('#pbody').contains(document.activeElement)) { const t = $('#pbody').scrollTop; render(); $('#pbody').scrollTop = t; }
  $('#saved').textContent = 'Enregistrement…';
});
store.addEventListener('saved', () => { $('#saved').textContent = 'Enregistré'; queuePush(store.project.id); });
store.addEventListener('roof-added', () => { ui.tab = 'style'; ui.detail = null; setPanel(true); render(); toast('Toit ajouté : règle sa forme ici.'); });
store.addEventListener('parcel-set', () => { ui.tab = 'terrain'; ui.detail = null; setPanel(true); render(); });
// La surface de la parcelle alimente le budget, tant qu'on ne la modifie pas à la main.
store.addEventListener('change', () => {
  const p = store.project, m = parcelOf(p); if (!m) return;
  const a = Math.round(parcelArea(m));
  if (m.area !== a) { m.area = a; p.budget = { ...p.budget, terrainArea: a }; }
});
store.addEventListener('project', fillLevels);
store.addEventListener('level', () => { fillLevels(); render(); });

// ——— Démarrage ———
(async function boot() {
  let project;
  try {
    const id = localStorage.getItem('nm-current');
    if (id) project = await dbGet('projects', id);
  } catch (e) { console.warn(e); }
  if (!project) project = TEMPLATES.find((t) => t.id === 'hill').make();
  const more = loadMore().then(() => {
    setCustom(store.project?.custom);
    if (['catalog'].includes(ui.tab) && !store.selection && !ui.detail && !$('#pbody').contains(document.activeElement)) render();
  }).catch((e) => console.warn(e));
  if (needsMore(project)) await more;
  openProject(project);
  store.save();
  document.querySelectorAll('#presetSeg button')[0].classList.add('on');
  setPanel(!narrow());
  setView('plan');
  render();
  document.getElementById('splash')?.remove();
  offerLatestManor(store.project);
  // Évite que l'appareil efface le projet en cas de manque de place.
  navigator.storage?.persist?.().catch(() => {});
  if (isEnabled()) connect(knownCode(), knownName(), syncHooks);
  if (!tourSeen()) setTimeout(() => { if (!document.querySelector('.modal')) startTour(); }, 700);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  // Prépare la 3D en arrière-plan une fois l'app affichée, sauf en mode économie de données.
  if (!navigator.connection?.saveData) (window.requestIdleCallback || setTimeout)(() => import('./view3d.js').catch(() => {}), { timeout: 4000 });
})();

// Enregistre sans attendre quand l'app passe en arrière-plan ou se ferme.
addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });
