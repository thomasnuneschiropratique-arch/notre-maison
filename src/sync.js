// Partage entre téléphones : même espace Firebase que Table de saison, sous le code du foyer saisi sur l'appareil.
// La configuration Firebase est publique par nature ; le code du foyer, lui, n'est jamais dans le dépôt.
import { store, dbAll, dbGet, dbPut, dbDel } from './state.js';

const CONFIG = { apiKey: 'AIzaSyCLxmLmSnZpmMZJR9N6RJ6Vw5Mwwlvopfk', authDomain: 'table-de-saison.firebaseapp.com', projectId: 'table-de-saison', storageBucket: 'table-de-saison.firebasestorage.app', messagingSenderId: '829684683330', appId: '1:829684683330:web:0802e420b14e97c468d3db' };
const VERSION = '10.12.2', COLLECTION = 'notre-maison', MAX = 990000, PUSH_DELAY = 2200;
const get = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const put = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* navigation privée */ } };

/** Le code déjà saisi dans Table de saison sur cet appareil, s'il existe. */
export const knownCode = () => get('nm:foyer') || get('tds:foyer');
export const knownName = () => get('nm:me') || get('tds:me');
export const isEnabled = () => !!get('nm:foyer');

const device = get('nm:device') || `d${Math.random().toString(36).slice(2, 10)}`;
put('nm:device', device);

export const sync = { state: 'off', code: '', name: '', col: null, unsub: null, timers: new Map(), hooks: {}, tooBig: false, sent: new Map() };
function setState(state, detail) { sync.state = state; sync.detail = detail; store.emit('sync', { state, detail }); }

function script(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('réseau')); document.head.append(s);
  });
}

async function firebaseCollection(code) {
  const base = `https://www.gstatic.com/firebasejs/${VERSION}`;
  await script(`${base}/firebase-app-compat.js`);
  await Promise.all([script(`${base}/firebase-auth-compat.js`), script(`${base}/firebase-firestore-compat.js`)]);
  if (!window.firebase.apps.length) window.firebase.initializeApp(CONFIG);
  await window.firebase.auth().signInAnonymously();
  return window.firebase.firestore().collection(`foyers/${code}/${COLLECTION}`);
}

/** Ce qui part sur le réseau : si le projet est trop lourd, on laisse de côté les plans importés. */
export function packProject(project) {
  const json = JSON.stringify(project), size = (s) => new TextEncoder().encode(s).length;
  if (size(json) <= MAX) return { json, trimmed: false };
  const light = JSON.parse(json);
  light.levels.forEach((l) => { l.background = null; });
  const small = JSON.stringify(light);
  return size(small) <= MAX ? { json: small, trimmed: true } : null;
}

/** Un plan importé gardé sur cet appareil ne doit pas être effacé par une version allégée. */
function keepBackgrounds(incoming, local) {
  if (!local) return incoming;
  for (const l of incoming.levels) if (!l.background) { const o = local.levels.find((x) => x.id === l.id); if (o?.background) l.background = o.background; }
  return incoming;
}

function busy() { return !!(store.plan?.drag || store.brush || document.activeElement?.matches?.('input,textarea,select')); }

async function push(id) {
  if (!sync.col) return;
  const project = id === store.project?.id ? store.project : await dbGet('projects', id);
  if (!project || sync.sent.get(id) === project.updated) return;
  const packed = packProject(project);
  if (!packed) { if (!sync.tooBig) store.emit('toast', 'Ce projet est trop lourd pour être partagé.'); sync.tooBig = true; return; }
  if (packed.trimmed && !sync.tooBig) { sync.tooBig = true; store.emit('toast', 'Le plan importé reste sur cet appareil : il est trop lourd pour être partagé.'); }
  try {
    setState('sending');
    await sync.col.doc(id).set({ json: packed.json, updated: project.updated, by: device, name: sync.name });
    sync.sent.set(id, project.updated);
    setState('ok');
  } catch (e) { console.warn(e); setState('error', 'Envoi impossible pour le moment.'); }
}

export function queuePush(id) {
  if (!sync.col || !id) return;
  clearTimeout(sync.timers.get(id));
  sync.timers.set(id, setTimeout(() => { sync.timers.delete(id); push(id); }, PUSH_DELAY));
}

const pending = new Map();
let waiting = 0;
function retryLater() { if (!waiting) waiting = setTimeout(() => { waiting = 0; for (const [id, doc] of [...pending]) { pending.delete(id); receive(id, doc); } }, 1500); }

async function receive(id, doc) {
  sync.sent.set(id, doc.updated);
  const local = id === store.project?.id ? store.project : await dbGet('projects', id);
  if (local && local.updated >= doc.updated) { if (local.updated > doc.updated) queuePush(id); return; }
  if (id === store.project?.id && (busy() || store.saveTimer)) { pending.set(id, doc); retryLater(); return; }
  const incoming = keepBackgrounds(JSON.parse(doc.json), local);
  if (doc.name && doc.by !== device) { incoming.by = doc.name; incoming.byAt = incoming.updated; }
  await dbPut('projects', id, incoming);
  if (id === store.project?.id) { sync.hooks.reload?.(incoming); store.emit('toast', doc.name ? `${doc.name} a modifié ce projet.` : 'Projet mis à jour depuis l’autre appareil.'); }
  sync.hooks.listChanged?.();
}

async function dropped(id) {
  if (id === store.project?.id) { sync.hooks.deletedCurrent?.(); return; }
  await dbDel('projects', id);
  sync.hooks.listChanged?.();
}

export function removeShared(id) { if (sync.col) sync.col.doc(id).delete().catch((e) => console.warn(e)); }

/** Se connecte, puis met en commun les projets de cet appareil et ceux déjà partagés. `backend` sert aux essais. */
export async function connect(code, name, hooks, backend = firebaseCollection) {
  sync.hooks = hooks; sync.code = code; sync.name = name;
  setState('connecting');
  try {
    sync.col = await backend(code);
    await sync.col.get();
  } catch (e) {
    console.warn(e); sync.col = null;
    const denied = e?.code === 'permission-denied';
    setState('error', denied ? 'Ce code n’est pas le bon.' : 'Connexion impossible : vérifie le réseau.');
    return false;
  }
  put('nm:foyer', code); put('nm:me', name);
  let first = true;
  sync.unsub = sync.col.onSnapshot((snap) => {
    for (const ch of snap.docChanges()) {
      if (ch.doc.metadata?.hasPendingWrites) continue;
      if (ch.type === 'removed') dropped(ch.doc.id);
      else { const d = ch.doc.data(); if (d.by !== device || first) receive(ch.doc.id, d); }
    }
    if (first) {
      first = false;
      const remote = new Set(snap.docs.map((d) => d.id));
      dbAll('projects').then((all) => all.forEach(({ key }) => { if (!remote.has(key)) queuePush(key); }));
    }
    if (sync.state !== 'sending') setState('ok');
  }, (e) => { console.warn(e); setState('error', e?.code === 'permission-denied' ? 'Ce code n’est pas le bon.' : 'Connexion perdue.'); });
  return true;
}

export function disconnect() {
  sync.unsub?.(); sync.unsub = null; sync.col = null;
  sync.timers.forEach(clearTimeout); sync.timers.clear();
  put('nm:foyer', ''); put('nm:me', '');
  setState('off');
}
