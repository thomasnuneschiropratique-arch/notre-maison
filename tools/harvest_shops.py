#!/usr/bin/env python3
"""Relève nom, prix et dimensions de meubles sur les fiches publiques de boutiques qui l'autorisent.

Respecte robots.txt, s'identifie honnêtement, attend entre chaque page et s'arrête au premier refus.
Usage : harvest_shops.py sklum|miliboo|drawer urls.txt sortie.json [limite]
"""
import collections, gzip, html, json, os, re, sys, time, urllib.request

UA = "MaisonCatalogue/1.0 (projet personnel)"
DELAY = float(os.environ.get("DELAY", "1.5"))
CAPF = float(os.environ.get("CAPF", "1"))
BAD = r"(^|-)(lot|lots|pack|packs|ensemble|ensembles|housse|housses|coussin|coussins|element|elements|module|modules|pied|pieds|abat-jour|noel|kit|set|inclinable|electrique|relax|releveur)(-|$)"

# (expression sur l'adresse, catégorie, sous-catégorie, maximum)
SKLUM = [
 (r"/acheter-canape-[23]-places/|/acheter-canapes-modulables-[2345]-places/", "salon", "canape", 110),
 (r"/acheter-fauteuils/", "salon", "fauteuil", 70),
 (r"/acheter-tables-basses-et-d-appoints/", "salon", "table-basse", 70),
 (r"/acheter-tables-d-appoint/", "salon", "table-basse", 30),
 (r"/acheter-meubles-tv/", "salon", "meuble-tv", 44),
 (r"/acheter-etageres/", "salon", "bibliotheque", 38),
 (r"/acheter-tables-salle-a-manger/", "repas", "table", 90),
 (r"/acheter-chaises-salle-a-manger/", "repas", "chaise", 120),
 (r"/acheter-tabourets-hauts/", "repas", "tabouret", 60),
 (r"/acheter-buffet/", "repas", "buffet", 41),
 (r"/acheter-lits/", "chambre", "lit", 22),
 (r"/acheter-tables-de-chevet/", "chambre", "chevet", 60),
 (r"/acheter-armoires/", "chambre", "armoire", 45),
 (r"/acheter-chiffonnier/", "chambre", "commode", 23),
 (r"/acheter-bureau/", "bureau", "bureau", 15),
 (r"/acheter-tapis-salon/", "deco", "tapis", 47),
 (r"/acheter-suspension/", "deco", "suspension", 80),
 (r"/acheter-lampe-de-table/", "deco", "lampe", 70),
 (r"/acheter-miroirs-de-mur/", "deco", "miroir", 45),
 (r"/acheter-meuble-d-entree/", "entree", "rangement", 35),
 (r"/acheter-tables-de-salle-a-manger-de-jardin/", "exterieur", "table-ext", 60),
 (r"/acheter-chaises-jardin/|/acheter-fauteuils-d-exterieur/|/acheter-transat/", "exterieur", "chaise-ext", 90),
]
DRAWER = [
 (r"/canape-droit/|/canape-convertible/|/canape-modulable/|/canape-d-angle/", "salon", "canape", 80),
 (r"/fauteuil-design/|/fauteuil-de-table/", "salon", "fauteuil", 45),
 (r"/table-basse/|/table-d-appoint-design/", "salon", "table-basse", 70),
 (r"/meuble-tv/", "salon", "meuble-tv", 40),
 (r"/etagere-sur-pieds/|/bibliotheque/", "salon", "bibliotheque", 14),
 (r"/table-design/", "repas", "table", 60),
 (r"/chaise-design/", "repas", "chaise", 45),
 (r"/tabouret-bar/", "repas", "tabouret", 30),
 (r"/buffet-design/|/vaisselier/", "repas", "buffet", 45),
 (r"/lit-design/|/lit-coffre/", "chambre", "lit", 35),
 (r"/table-de-chevet/", "chambre", "chevet", 25),
 (r"/armoire/", "chambre", "armoire", 21),
 (r"/commode/", "chambre", "commode", 15),
 (r"/table-de-bureau/", "bureau", "bureau", 12),
 (r"/tapis/", "deco", "tapis", 40),
 (r"/luminaire-suspension/", "deco", "suspension", 20),
 (r"/lampadaire-design/", "deco", "lampadaire", 14),
 (r"/lampe-poser/", "deco", "lampe", 18),
 (r"/miroir-design/", "deco", "miroir", 20),
 (r"/meuble-a-chaussures/|/banc-design/", "entree", "rangement", 25),
]
MILIBOO = [
 (r"\.com/(canape|banquette)-", "salon", "canape", 60),
 (r"\.com/fauteuil-(?!de-bureau)", "salon", "fauteuil", 40),
 (r"\.com/(table-basse|tables-basses|table-d-appoint|bout-de-canape)", "salon", "table-basse", 45),
 (r"\.com/meuble-tv", "salon", "meuble-tv", 25),
 (r"\.com/(bibliotheque|etagere)", "salon", "bibliotheque", 20),
 (r"\.com/table-(a-manger|extensible|ronde|repas|design|de-cuisine)", "repas", "table", 45),
 (r"\.com/chaises?-(?!de-bureau)", "repas", "chaise", 60),
 (r"\.com/tabourets?-de-bar", "repas", "tabouret", 30),
 (r"\.com/buffet", "repas", "buffet", 25),
 (r"\.com/(lit|tete-de-lit)-", "chambre", "lit", 25),
 (r"\.com/(table-de-chevet|chevet)", "chambre", "chevet", 20),
 (r"\.com/commode", "chambre", "commode", 15),
 (r"\.com/(bureau)-", "bureau", "bureau", 25),
 (r"\.com/(fauteuil|chaise)-de-bureau", "bureau", "siege", 20),
 (r"\.com/suspension", "deco", "suspension", 25),
 (r"\.com/lampadaire", "deco", "lampadaire", 15),
 (r"\.com/(lampe|baladeuse)", "deco", "lampe", 15),
 (r"\.com/tapis", "deco", "tapis", 20),
 (r"\.com/miroir", "deco", "miroir", 15),
 (r"\.com/(banc|meuble-a-chaussures|porte-manteau)", "entree", "rangement", 15),
]
SHOPS = {"sklum": ("Sklum", SKLUM), "drawer": ("Drawer", DRAWER), "miliboo": ("Miliboo", MILIBOO)}

COLORS = [("brun-noir", "#2f251e"), ("anthracite", "#3b3d3f"), ("gris-fonce", "#54565a"), ("gris-clair", "#b4b4b0"), ("terracotta", "#b5694a"), ("terre-cuite", "#b5694a"), ("boucle", "#e6dfd2"), ("bouclette", "#e6dfd2"), ("ivoire", "#e9e2d2"), ("creme", "#e3d9c3"), ("ecru", "#e3d9c3"), ("lin", "#d5cab6"), ("taupe", "#a39383"), ("sable", "#d4c4a6"), ("beige", "#c9b89e"), ("blanc", "#eeece6"), ("blanche", "#eeece6"), ("noir", "#23221f"), ("noire", "#23221f"), ("noyer", "#6b4a32"), ("chene", "#b8925f"), ("acacia", "#a67c4e"), ("manguier", "#a67c4e"), ("rotin", "#c7a877"), ("rotin-naturel", "#c7a877"), ("cannage", "#c7a877"), ("bambou", "#c9ad78"), ("frene", "#c7a67b"), ("pin", "#c9a26a"), ("teck", "#a9794a"), ("gris", "#8d8e8c"), ("bleu", "#3d5168"), ("vert", "#67745a"), ("kaki", "#6a6c4c"), ("moutarde", "#c79a35"), ("jaune", "#d4ab4a"), ("rouille", "#a4552f"), ("orange", "#c6793c"), ("rose", "#cfa79b"), ("rouge", "#8a3a2e"), ("brun", "#6a4c35"), ("marron", "#6a4c35"), ("dore", "#b3944f"), ("laiton", "#b3944f")]


def fold(s):
    s = s.lower()
    for a, b in zip("àâäéèêëîïôöùûüç", "aaaeeeeiioouuuc"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def color_of(*texts):
    t = "-" + "-".join(fold(x) for x in texts if x) + "-"
    for k, v in COLORS:
        if f"-{k}-" in t:
            return v
    return None


def select(urls, rules):
    out, seen = [], set()
    urls = sorted(urls, key=lambda u: -int((re.search(r"/(\d+)-[^/]*\.html$", u) or re.search(r"-(\d+)\.html$", u) or [0, 0])[1]))
    for rx, cat, sub, cap in rules:
        n, fam = 0, collections.Counter()
        cap = max(4, int(cap * CAPF))
        for u in urls:
            if n >= cap:
                break
            if u in seen or not re.search(rx, u):
                continue
            slug = u.rstrip("/").split("/")[-1].replace(".html", "")
            if re.search(BAD, slug):
                continue
            key = re.sub(r"^\d+-|-\d+$", "", slug).split("-")[-1]
            if fam[key] >= 3:
                continue
            fam[key] += 1
            n += 1
            seen.add(u)
            out.append((cat, sub, u))
    return out


def number(s):
    return float(s.replace(",", "."))


def dims_of(text):
    """Cherche les dimensions du produit lui-même, jamais celles du colis ou de l'assise."""
    d = {}
    m = re.search(r"Dimensions totales\s*:\s*([^:]{3,70}?)\s*cm", text)
    if m:
        toks = re.findall(r"([LPHDØ])\s*\.?\s*([\d.,]+)(?:\s*-\s*([\d.,]+))?", m.group(1))
        wd = [number(t[2] or t[1]) for t in toks if t[0] in "LP"]
        if wd:
            d["largeur"] = wd[0]
        if len(wd) > 1:
            d["profondeur"] = wd[1]
        for t in toks:
            if t[0] == "H":
                d["hauteur"] = number(t[2] or t[1])
            if t[0] in "DØ":
                d["diamètre"] = number(t[1])
    for lab, key in (("Largeur", "largeur"), ("Profondeur", "profondeur"), ("Longueur", "longueur"), ("Hauteur", "hauteur"), ("Diamètre", "diamètre")):
        if key in d:
            continue
        m = re.search(rf"\b{lab}(?: totale| max\.?| maximale)?\s*:?\s*([\d]+(?:[.,]\d+)?)\s*cm", text)
        if m:
            d[key] = number(m.group(1))
    return d


def parse(page, cat, sub, url, brand):
    ld = None
    for j in re.findall(r"<script[^>]*ld\+json[^>]*>(.*?)</script>", page, re.S):
        if '"Product"' in j or '"ProductGroup"' in j:
            ld = j
            break
    name = re.search(r'"name"\s*:\s*"((?:[^"\\]|\\.)+)"', ld) if ld else None
    name = json.loads(f'"{name.group(1)}"') if name else None
    if not name:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
        name = re.sub(r"\s+", " ", re.sub("<[^>]+>", " ", m.group(1))).strip() if m else None
    prices = [float(v) for v in re.findall(r'"price"\s*:\s*"?([\d]+(?:\.\d+)?)', ld or "")]
    if not prices:
        prices = [float(v) for v in re.findall(r'itemprop="price"\s+content="([\d.]+)"', page)]
    if not name or not prices:
        return None
    if ld and "InStock" not in ld and "OutOfStock" in ld:
        return None
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", page, flags=re.S)
    text = html.unescape(re.sub(r"\s+", " ", re.sub("<[^>]+>", " ", text)))
    d = dims_of(text)
    if not (d.get("largeur") or d.get("longueur") or d.get("diamètre")) or not d.get("hauteur") and sub not in ("tapis", "miroir"):
        return None
    if any(v <= 0 or v > 700 for v in d.values()):
        return None
    slug = url.rstrip("/").split("/")[-1].replace(".html", "")
    name = html.unescape(name).strip()
    return {"cat": cat, "sub": sub, "brand": brand, "name": name, "type": name.lower(), "price": min(prices), "dims": d, "color": color_of(*(re.findall(r'"color"\s*:\s*"([^"]+)"', ld or "")[:1]), slug, name), "url": url, "slug": fold(brand)[:2] + "-" + slug}


def main():
    shop, in_, out_ = sys.argv[1:4]
    limit = int(sys.argv[4]) if len(sys.argv) > 4 else 10 ** 9
    brand, rules = SHOPS[shop]
    urls = [l.strip() for l in open(in_) if l.strip()]
    todo = select(urls, rules)[:limit]
    print("à relever :", len(todo), flush=True)
    known = {r["url"]: r for r in json.load(open(out_))} if os.path.exists(out_) else {}
    res, fails = [], 0
    for i, (cat, sub, u) in enumerate(todo):
        if u in known:
            res.append(known[u])
            continue
        try:
            req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "fr-FR", "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=30) as r:
                b = r.read()
            if b[:2] == b"\x1f\x8b":
                b = gzip.decompress(b)
            try:
                page = b.decode("utf8")
            except UnicodeDecodeError:
                page = b.decode("cp1252", "replace")
            p = parse(page, cat, sub, u, brand)
            if p:
                res.append(p)
            else:
                fails += 1
        except Exception as e:
            fails += 1
            print("échec", u, e, flush=True)
            if "403" in str(e) or "429" in str(e):
                print("Accès refusé : arrêt du relevé.", flush=True)
                break
        if i % 40 == 0:
            print(i, "ok:", len(res), "sans données:", fails, flush=True)
            json.dump(res, open(out_, "w"), ensure_ascii=False, indent=0)
        time.sleep(DELAY)
    json.dump(res, open(out_, "w"), ensure_ascii=False, indent=0)
    print("FINI", len(res), "sans données:", fails, flush=True)


if __name__ == "__main__":
    main()
