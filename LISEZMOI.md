# Notre Maison

Application web (téléphone et ordinateur) pour dessiner une maison, l'aménager, la visiter en 3D et trouver où acheter les meubles.

- `npm run dev` non utilisé : lancer `npx vite` pour développer, `npx vite build` pour générer `docs/` (site statique).
- `tools/harvest_ikea.py` : relève prix et dimensions sur les fiches publiques IKEA France. À relancer pour actualiser les prix.
- `tools/fetch_assets.py` et `tools/convert_models.sh` : téléchargent et compressent les ressources Poly Haven (CC0).

Les aperçus 3D sont des modèles proches aux dimensions du produit, pas les modèles officiels des marques.
