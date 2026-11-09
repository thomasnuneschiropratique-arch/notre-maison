#!/usr/bin/env python3
"""Assemble les relevés des boutiques en un fichier compact, chargé après le démarrage de l'app.

Usage : build_more.py dossier_des_releves src/data/ikea.json src/data/more.json [atlas.json]
"""
import json, os, re, sys

PREFIX = {"Sklum": "https://www.sklum.com/fr/", "Drawer": "https://www.drawer.fr/", "Miliboo": "https://www.miliboo.com/", None: "https://www.ikea.com/fr/fr/p/"}
KEEP = re.compile(r"^(largeur|profondeur|longueur|hauteur|diamètre|diametre|diam\. abat-jour|largeur abat-jour|hauteur d'abat-jour|largeur/rideau|hauteur de la plante|diamètre du pot|hauteur tête de lit|epaisseur|épaisseur|hauteur totale|hauteur max\.|hauteur coussins dossier inclus)$")
# (largeur min, largeur max, hauteur min, hauteur max) en cm : écarte les fiches mal lues.
BOUNDS = {"canape": (100, 460, 50, 130), "fauteuil": (40, 180, 45, 140), "table-basse": (20, 220, 15, 90), "meuble-tv": (60, 340, 20, 200), "bibliotheque": (20, 320, 40, 260), "table": (60, 400, 55, 115), "chaise": (30, 90, 55, 130), "tabouret": (25, 80, 35, 125), "buffet": (50, 320, 50, 240), "lit": (70, 260, 20, 180), "chevet": (20, 110, 25, 100), "armoire": (40, 400, 80, 280), "commode": (35, 240, 40, 170), "bureau": (60, 280, 50, 160), "siege": (35, 110, 60, 160), "tapis": (40, 500, 0, 10), "suspension": (5, 200, 3, 250), "lampadaire": (10, 120, 80, 260), "lampe": (5, 80, 8, 110), "miroir": (15, 260, 15, 280), "rangement": (20, 300, 20, 240), "table-ext": (50, 400, 40, 115), "chaise-ext": (35, 240, 45, 130)}


def tidy(x):
    d = {k: v for k, v in (x.get("dims") or {}).items() if KEEP.match(k)}
    sub = x["sub"]
    if x.get("brand"):
        if sub in ("lit", "tapis") and "longueur" not in d and "profondeur" in d:
            d["longueur"] = d["profondeur"]
        if sub in ("lampadaire", "lampe", "suspension") and "diamètre" not in d and "largeur" in d:
            d["diamètre"] = d["largeur"]
        b = BOUNDS.get(sub)
        w = d.get("largeur") or d.get("longueur") or d.get("diamètre") or 0
        h = d.get("hauteur", 1)
        if sub in ("miroir",):
            h = d.get("hauteur", 40)
        if b and not (b[0] <= w <= b[1] and b[2] <= h <= b[3]):
            return None
    return d


def main():
    folder, base, out = sys.argv[1:4]
    atlas = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
    known = {x["url"] for x in json.load(open(base, encoding="utf-8"))}
    seen, rows, dropped = set(), [], 0
    for name in ("sklum", "miliboo", "drawer", "ikea"):
        path = os.path.join(folder, f"out_{name}.json")
        if not os.path.exists(path):
            continue
        for x in json.load(open(path, encoding="utf-8")):
            u = x["url"]
            if u in known or u in seen or not x.get("price") or x["sub"] == "facade":
                continue
            seen.add(u)
            if re.search(r"^(t[êe]te de lit|sommier)|\b(lot de|lots de|pack de|ensemble de|set de)\b|^(chaises|tabourets|fauteuils|tables de chevet) ", x["name"], re.I):
                continue
            d = tidy(x)
            if d is None or not d:
                dropped += 1
                continue
            brand = x.get("brand")
            row = {"c": x["cat"], "s": x["sub"], "n": x["name"], "p": x["price"], "d": d, "u": u[len(PREFIX[brand]):]}
            if brand:
                row["b"] = brand
            else:
                row["t"] = x["type"]
            if x.get("color"):
                row["o"] = x["color"]
            rid = (x["slug"] if brand else f"ik-{x['slug']}")
            if rid in atlas:
                row["a"] = atlas[rid]
            rows.append(row)
    rows.sort(key=lambda r: (r["c"], r["s"]))
    json.dump(rows, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("articles :", len(rows), "écartés :", dropped, "taille :", os.path.getsize(out) // 1024, "Ko")


if __name__ == "__main__":
    main()
