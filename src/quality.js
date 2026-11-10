// Niveau de qualité selon l'appareil : les écrans tactiles et les machines à peu de mémoire reçoivent des ressources légères.
// Le réglage « Affichage » de Projets peut forcer le mode léger ou le mode complet sur cet appareil.
const coarse = matchMedia('(pointer: coarse)').matches;
let pref = '';
try { pref = localStorage.getItem('nm:quality') || ''; } catch { /* navigation privée */ }
export const QUALITY_PREF = pref === 'light' || pref === 'full' ? pref : 'auto';
const autoLow = coarse || (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 4);
export const AUTO_LOW = autoLow;
export const LOW = QUALITY_PREF === 'light' ? true : QUALITY_PREF === 'full' ? false : autoLow;
/** Téléphone : pas d'effets d'image. Le mode léger les retire aussi sur ordinateur. */
export const isPhone = () => QUALITY_PREF === 'light' || (QUALITY_PREF !== 'full' && coarse && Math.min(innerWidth, innerHeight) < 820);
export function setQuality(v) { try { if (v === 'auto') localStorage.removeItem('nm:quality'); else localStorage.setItem('nm:quality', v); } catch { /* navigation privée */ } }
