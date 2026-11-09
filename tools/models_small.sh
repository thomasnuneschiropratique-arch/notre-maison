#!/bin/bash
# Crée une version légère des modèles 3D pour les téléphones (textures 512, géométrie simplifiée).
cd "$(dirname "$0")/.." || exit 1
OUT=public/models-s; mkdir -p "$OUT"
cvt() { a="$1"; [ -s "$OUT/$a" ] && exit 0; npx gltf-transform optimize "public/models/$a" "$OUT/$a" --compress false --instance false --texture-compress webp --texture-size 512 --simplify true --simplify-error 0.004 --flatten false >/dev/null 2>&1 || echo "KO $a"; }
export -f cvt; export OUT
ls public/models | grep '\.glb$' | xargs -P 6 -I{} bash -c 'cvt {}'
du -sh public/models public/models-s
