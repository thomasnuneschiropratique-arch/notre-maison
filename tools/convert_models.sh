#!/bin/bash
# Convertit les .gltf bruts en .glb légers (textures WebP, géométrie simplifiée).
RAW="$1"; OUT="$2"; mkdir -p "$OUT"
cvt() { a="$1"; [ -s "$OUT/$a.glb" ] && exit 0; npx gltf-transform optimize "$RAW/$a/$a.gltf" "$OUT/$a.glb" --compress false --instance false --texture-compress webp --texture-size 1024 --simplify true --simplify-error 0.0012 --flatten false >/dev/null 2>&1 || echo "KO $a"; }
export -f cvt; export RAW OUT
ls "$RAW" | grep -v models.json | xargs -P 6 -I{} bash -c 'cvt {}'
