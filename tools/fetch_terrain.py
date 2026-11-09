#!/usr/bin/env python3
"""Télécharge des matières de sol libres de droits (Poly Haven, CC0) pour le terrain."""
import json, os, urllib.request
UA = "MaisonCatalogue/1.0 (projet personnel)"
ROOT = os.path.join(os.path.dirname(__file__), "..")
TEX = ["brown_mud_dry", "rocky_terrain_02", "coast_sand_01", "snow_02", "dry_ground_01"]
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60) as r: return r.read()
def save(u, p):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(get(u))
for a in TEX:
    i = json.loads(get(f"https://api.polyhaven.com/files/{a}"))
    d = os.path.join(ROOT, "public/textures", a)
    save(i["Diffuse"]["1k"]["jpg"]["url"], os.path.join(d, "diff.jpg"))
    save(i["nor_gl"]["1k"]["jpg"]["url"], os.path.join(d, "nor.jpg"))
    r = i.get("Rough", {}).get("1k", {}).get("jpg") or i["arm"]["1k"]["jpg"]
    save(r["url"], os.path.join(d, "rough.jpg"))
    save(f"https://cdn.polyhaven.com/asset_img/thumbs/{a}.png?width=128&height=128", os.path.join(ROOT, "public/thumbs", "t_" + a + ".png"))
    print("ok", a, flush=True)
