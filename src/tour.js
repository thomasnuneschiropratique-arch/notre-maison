// Visite guidée au premier lancement : quelques bulles posées sur les vrais boutons.
const KEY = 'nm-tour';
export const tourSeen = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };

const steps = (narrow) => [
  { sel: '#rail', title: 'Dessine ta maison', text: 'Trace des pièces et des murs, ajoute portes et fenêtres. « Groupe » sélectionne la maison ou une partie pour la déplacer.' },
  { sel: narrow ? '#bottomnav [data-n="catalog"]' : '#tabs [data-k="catalog"]', title: 'Meuble-la', text: 'Plus de 400 vrais meubles, avec leurs prix et le lien pour les acheter. Le filtre « Son style » est en tête.' },
  { sel: narrow ? '#bottomnav [data-n="3d"]' : '#viewSeg [data-v="3d"]', title: 'Promène-toi dedans', text: 'Passe en 3D pour voir la maison de dehors, ou entre en mode Visite. Le bouton Photo crée une image réaliste.' },
  { sel: narrow ? '#bottomnav [data-n="budget"]' : '#tabs [data-k="budget"]', title: 'Suis le budget', text: 'Tout est compté : terrain, taxes, travaux, meubles. Il se met à jour à chaque changement.' },
  { sel: narrow ? '#bottomnav [data-n="more"]' : '#tabs [data-k="terrain"]', title: 'Terrain et projets', text: narrow ? 'Dans « Plus » : le relief, ta parcelle, la liste d’achats, le plan en PDF et le partage entre vos téléphones.' : 'Ici et dans les onglets voisins : le relief, ta parcelle, la liste d’achats, le plan en PDF et le partage entre vos téléphones.' },
  { sel: '#undo', title: 'Rien n’est définitif', text: 'Cette flèche annule ta dernière action. Essaie tout ce que tu veux !' },
];

export function startTour() {
  const steps_ = () => steps(matchMedia('(max-width: 820px)').matches);
  document.querySelector('.tour')?.remove();
  let list = steps_();
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = '<div class="tourhole"></div><div class="tourbox" role="dialog" aria-live="polite"><small></small><h3></h3><p></p><div class="touracts"><button class="skip">Passer</button><button class="next"></button></div></div>';
  document.body.append(root);
  const hole = root.querySelector('.tourhole'), box = root.querySelector('.tourbox');
  let i = 0;
  const place = () => {
    list = steps_();
    const step = list[i], el = document.querySelector(step.sel), r = el?.getBoundingClientRect();
    if (!r || !r.width) { if (i < list.length - 1) { i++; place(); } else end(); return; }
    Object.assign(hole.style, { left: `${r.left - 5}px`, top: `${r.top - 5}px`, width: `${r.width + 10}px`, height: `${r.height + 10}px` });
    box.querySelector('small').textContent = `${i + 1} sur ${list.length}`;
    box.querySelector('h3').textContent = step.title;
    box.querySelector('p').textContent = step.text;
    box.querySelector('.next').textContent = i === list.length - 1 ? 'C’est parti' : 'Suivant';
    const b = box.getBoundingClientRect(), gap = 14, below = r.bottom + gap + b.height < innerHeight;
    box.style.top = `${below ? r.bottom + gap : Math.max(10, r.top - gap - b.height)}px`;
    box.style.left = `${Math.max(10, Math.min(innerWidth - b.width - 10, r.left + r.width / 2 - b.width / 2))}px`;
  };
  const end = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* navigation privée */ }
    removeEventListener('resize', place);
    root.remove();
  };
  box.querySelector('.skip').onclick = end;
  box.querySelector('.next').onclick = () => { if (i === list.length - 1) end(); else { i++; place(); } };
  addEventListener('resize', place);
  place();
}
