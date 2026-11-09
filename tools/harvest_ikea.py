#!/usr/bin/env python3
"""Relève nom, prix et dimensions de produits IKEA France à partir des fiches publiques.

Respecte robots.txt (seules des pages /p/ sont lues), s'identifie honnêtement et
attend entre chaque page. Usage : harvest_ikea.py urls.txt sortie.json
"""
import json, os, re, sys, time, urllib.request, html, collections

UA = "MaisonCatalogue/1.0 (projet personnel)"
DELAY = 1.2

# (catégorie, sous-catégorie, expression sur l'adresse, maximum, maximum par gamme)
RULES = [
 ("salon","canape",r"/(ektorp|kivik|soederhamn|vimle|friheten|landskrona|uppland|klippan|glostad|jaettebo|kungsviken|hyltarp|paerup|barslov)-canape-(2|3|d-angle|dangle|convertible)",26,3),
 ("salon","fauteuil",r"/(poaeng|strandmon|ekenaeset|kivik|ektorp|muren|tullsta|koarp|vedbo|gubbarp|hemlingby)-(fauteuil|fauteuil-a-oreilles)",12,2),
 ("salon","table-basse",r"/(lack|listerby|vittsjoe|stockholm|hemnes|borgeby|kragsta|tofteryd|jakobsfors|gladom|lunnarp|bergshult|vihals)-(table-basse|table-d-appoint|table-gigogne|tables-gigognes|plateau)",14,2),
 ("salon","meuble-tv",r"/(besta|lack|hemnes|brimnes|stockholm|vihals|tonstad)-(banc-tv|meuble-tv|combinaison-meuble-tv)",12,2),
 ("salon","bibliotheque",r"/(billy|kallax|hemnes|ivar|lommarp|baggebo|fjaelkinge|mackis|tonstad)-(bibliotheque|etagere)",16,3),
 ("repas","table",r"/(lisabo|ekedalen|moerbylanga|melltorp|ingatorp|skogsta|voxloev|nordviken|tarsele|sandsberg|bjursta|strandtorp|norden|danderyd|vihals)-table",16,2),
 ("repas","chaise",r"/(odger|stefan|lisabo|ingolf|teodores|adde|karlpetter|tobias|voxloev|skansnaes|krylbo|bergmund|lidas|gunde|ekedalen|nordviken)-chaise",16,1),
 ("repas","buffet",r"/(hemnes|idanaes|stockholm|tonstad|ivar|lommarp|havsta|vihals)-(buffet|vaisselier)",8,2),
 ("repas","tabouret",r"/(nilsove|franklin|henriksdal|stig|kullaberg|bosse|marius)-(tabouret-de-bar|tabouret)",5,1),
 ("chambre","lit",r"/(malm|hemnes|slattum|songesand|neiden|brimnes|idanaes|tufjord|tarva|nordli|vevelstad|gursken|utaker|sagesund|kleppstad|bjoerksnaes)-(cadre-de-lit|cadre-lit|lit)",20,3),
 ("chambre","matelas",r"/(valevag|akreham|vesteroey|vestmarka|morgedal|aobo|agotnes|aebygda|hafslo)-matelas",7,1),
 ("chambre","chevet",r"/(malm|hemnes|kullen|nordli|tonstad|songesand|idanaes|knarrevik|gursken|brimnes|rast)-(table-de-chevet|chevet|commode-2-tiroirs)",10,1),
 ("chambre","armoire",r"/(pax|kleppstad|brimnes|rakkestad|hauga|songesand|idanaes|tonstad|vihals|gursken|bjoerksnaes)-(armoire|penderie|combinaison-armoire|armoire-penderie)",16,3),
 ("chambre","commode",r"/(malm|hemnes|nordli|kullen|idanaes|songesand|tonstad|hauga|vihals|rast)-commode",14,2),
 ("bureau","bureau",r"/(micke|alex|lagkapten|trotten|bekant|mittzon|tonstad|hemnes|linnmon|idanaes|vihals|fredde|uppspel)-(bureau|table-bureau|bureau-assis)",12,2),
 ("bureau","siege",r"/(markus|matchspel|flintan|skruvsta|millberget|hattefjaell|odger|renberget|loberget)-(chaise-de-bureau|siege|chaise-pivotante|chaise)",7,1),
 ("cuisine","meuble",r"/metod-(element-bas|el-bas|structure-element-bas|element-mural|armoire|structure-armoire)",12,12),
 ("cuisine","facade",r"/(voxtorp|askersund|enkoeping|axstad|bodbyn|kungsbacka|nickebo|ringhult|vallstena|upplov|havstorp)-porte",10,1),
 ("cuisine","plan",r"/(saeljan|karlby|mollekulla|ekbacken|barkaboda|pinnarp|hasslarp|skogsaa)-plan-de-travail",7,1),
 ("cuisine","evier",r"/(havsen|norrsjoen|boholmen|hillesjoen|kilsviken|langviken|bredskaer)-evier",5,1),
 ("cuisine","electro",r"/(mattradition|anrattad|livsgnista|lagan|tillreda|forkylning|kylig|medelniva|finslipad|matalskare|hogklassig|lovande|nyttig|varmare|bejublad|smaklig|kulinarisk|tronsmo|ugnsmastare|mittbit)-(four|table-de-cuisson|table-induction|hotte|refrigerateur|congelateur|lave-vaisselle|micro-ondes|table-cuisson|refrigerateur-congelateur)",12,2),
 ("cuisine","ilot",r"/(stenstorp|groenlid|bror|kungsfors|vadholma|tornviken|bekvaem|forhoja|udden)-(ilot|desserte|table-bar)",5,1),
 ("sdb","meuble-vasque",r"/(enhet|godmorgon|hemnes|lillangen|haverdal|skatsjoen|tvaellen|nysjoen|fullen|angsjoen|sanjon)-(.*)?(meuble-lavabo|meuble-vasque|mble-lavabo)",10,2),
 ("sdb","miroir-sdb",r"/(enhet|godmorgon|lillangen|storjorm|hemnes|nysjoen)-(meuble-a-miroir|armoire-a-glace|meuble-sdb)",6,1),
 ("sdb","rangement-sdb",r"/(hemnes|lillangen|enhet|fullen|bathroom|ronnskar|vesken|hjalmaren|baskar)-(colonne|armoire|etagere|porte-serviette|porte-serviettes)",7,1),
 ("deco","tapis",r"/(stoense|langsted|vindum|ullevi|blaekaer|tiphede|lohals|vedbaek|torrild|hampen|lindknud|kollund|rodalm|finnerup)-tapis",12,1),
 ("deco","rideau",r"/(ritva|hilja|majgull|vilborg|sanela|hannalill|annakajsa|lill|bymott|tibast|mjoellspira|dytag|rosenmanad)-(rideaux|rideau|voilage)",8,1),
 ("deco","suspension",r"/(ranarp|hektogram|regolit|foto|nymane|araglas|vidja|hektar|skottorp|rismal|solklint|misterhult|navlinge|knixhult|lauters|fado|bumerang|tagarp|barlast|pilgrim|tolja|solhetta|ormanas|varmblixt)-(suspension|lampe-suspension)",12,1),
 ("deco","lampadaire",r"/(hektar|nymane|lauters|vidja|tagarp|rodflik|regolit|ranarp|skottorp|misterhult|hektogram|stockholm|ekenaeset|hasselbo|hektar|barometer)-lampadaire",8,1),
 ("deco","lampe",r"/(fado|lauters|tertial|nymane|ranarp|hektar|varmblixt|solklint|pilgrim|skottorp|grimso|isjakt|tvarhand|kallsjo)-(lampe-de-table|lampe-a-poser|lampe-de-bureau)",7,1),
 ("deco","miroir",r"/(lindbyn|nissedal|ikornnes|hovet|stockholm|songe|kolja|storjorm|hemnes|vaggstol|hemnes)-miroir",7,1),
 ("deco","cadre",r"/(ribba|hovsta|knoppang|lomviken|silverhojden|ramsborg|silverhoejden)-cadre",5,1),
 ("deco","plante",r"/(fejka|zamioculcas|ficus-lyrata|monstera|dracaena|strelitzia|kentia|chamaedorea|sansevieria|ficus-benjamina|phoenix|aglaonema|spathiphyllum|schefflera)-(plante|plante-artificielle|plante-en-pot)",8,1),
 ("deco","coussin",r"/(gurli|sanela|fjaedermott|gullklocka|kransborre|hilda|krokrot|sandfjaerd)-housse-de-coussin",4,1),
 ("deco","vase",r"/(rossling|vilja|konstfull|berakna|hoppfull|vardefull|tillsammans)-vase",4,1),
 ("entree","rangement",r"/(hemnes|trones|stall|bissa|portis|ivar|nordkisa|kornsjoe|tjusig|hejne|mackapaer|skoghall)-(armoire-a-chaussures|meuble-a-chaussures|rangement-chaussures|banc|porte-manteau|portant|portemanteau)",10,2),
 ("enfant","lit-enfant",r"/(smastad|sniglar|kura|gulliver|sundvik|slaekt|nordli|vitval|myllra|busunge|tuffing)-(lit|lit-mezzanine|lit-superpose|lit-bebe|lit-enfant|lit-evolutif|lit-gigogne)",8,1),
 ("enfant","rangement-enfant",r"/(trofast|smastad|flisat|stuva|platsa|busunge)-(combinaison|rangement|commode|bureau|armoire)",6,1),
 ("exterieur","table-ext",r"/(applaro|askholmen|naemmaroe|tarnoe|sjaelland|lacko|grillskaer|segeroe|bondholmen|klasen)-(table|table-de-jardin|barbecue|table-pliante)",8,1),
 ("exterieur","chaise-ext",r"/(applaro|askholmen|naemmaroe|tarnoe|sjaelland|lacko|bondholmen|froesoen|kungsholmen|segeroe|kuddarna|torparoe|gullholmen)-(chaise|canape|fauteuil|chaise-longue|transat|banc)",10,1),
]

COLORS = {
 "blanc":"#eeece6","blanche":"#eeece6","blanchi":"#d8cdb9","noir":"#23221f","brun-noir":"#2f251e","anthracite":"#3b3d3f",
 "gris-fonce":"#54565a","gris-clair":"#b4b4b0","gris":"#8d8e8c","beige":"#c9b89e","creme":"#e3d9c3","chene":"#b8925f",
 "noyer":"#6b4a32","pin":"#c9a26a","bambou":"#c9ad78","frene":"#c7a67b","bleu":"#3d5168","vert":"#67745a","rouge":"#8a3a2e",
 "rose":"#cfa79b","jaune":"#d4ab4a","orange":"#c6793c","brun":"#6a4c35","teinte-blanc":"#ded8cc",
}

def color(slug):
    for k in ["brun-noir","teinte-blanc","gris-fonce","gris-clair","anthracite","blanchi","blanc","noir","noyer","chene","frene","bambou","beige","creme","gris","bleu","vert","rouge","rose","jaune","orange","brun","pin"]:
        if re.search(r"(^|-)"+k+r"(-|$)", slug):
            return COLORS[k]
    return None

def select(urls):
    out, seen = [], set()
    scale = int(os.environ.get("SCALE", "1"))
    for cat, sub, rx, cap, per in RULES:
        cap, per = cap * scale, per * scale
        rx_c = re.compile(rx)
        n, by = 0, collections.Counter()
        for u in sorted(urls):
            if n >= cap: break
            if u in seen: continue
            m = rx_c.search(u)
            if not m: continue
            serie = m.group(1)
            if by[serie] >= per: continue
            by[serie] += 1; n += 1; seen.add(u)
            out.append((cat, sub, u))
    return out

def cm(v):
    m = re.match(r"([\d.,]+)\s*(cm|m|mm)", v or "")
    if not m: return None
    n = float(m.group(1).replace(",", "."))
    return n * {"cm":1, "m":100, "mm":0.1}[m.group(2)]

def parse(page, cat, sub, url):
    name = re.search(r'data-product-name="([^"]+)"', page)
    price = re.search(r'data-product-price="([\d.]+)"', page)
    typ = re.search(r'"typeName":"([^"]+)"', page)
    if not name or not price: return None
    dims = {}
    for mes, lab in re.findall(r'\{"measure":"([^"]+)","name":"([^"]+)","type":"\d+"\}', page):
        lab = html.unescape(lab).lower(); v = cm(mes)
        if v is None or lab in dims: continue
        dims[lab] = v
    def first(*keys):
        for k in keys:
            for lab, v in dims.items():
                if lab == k or lab.startswith(k): return v
    w = first("largeur","longueur","diamètre","diametre")
    d = first("profondeur","largeur du lit","diamètre","diametre")
    h = first("hauteur totale","hauteur")
    slug = url.rstrip("/").split("/")[-1]
    return {
      "cat":cat,"sub":sub,"name":html.unescape(name.group(1)),
      "type":html.unescape(typ.group(1)) if typ else sub,
      "price":float(price.group(1)),"w":w,"d":d,"h":h,
      "dims":dims,"color":color(slug),"url":url,"slug":slug,
    }

def main():
    urls = [l.strip() for l in open(sys.argv[1]) if l.strip()]
    todo = select(urls)
    print("à relever :", len(todo), flush=True)
    res, fails = [], 0
    import os
    known = {r["url"]: r for r in json.load(open(sys.argv[2]))} if os.path.exists(sys.argv[2]) else {}
    for i, (cat, sub, u) in enumerate(todo):
        if u in known:
            res.append(known[u]); continue
        try:
            req = urllib.request.Request(u, headers={"User-Agent":UA,"Accept-Language":"fr-FR"})
            with urllib.request.urlopen(req, timeout=25) as r:
                page = r.read().decode("utf8", "replace")
            p = parse(page, cat, sub, u)
            if p: res.append(p)
            else: fails += 1
        except Exception as e:
            fails += 1
            print("échec", u, e, flush=True)
            if "403" in str(e) or "429" in str(e):
                print("Accès refusé : arrêt du relevé.", flush=True)
                break
        if i % 25 == 0:
            print(i, "ok:", len(res), "échecs:", fails, flush=True)
            json.dump(res, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
        time.sleep(DELAY)
    json.dump(res, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
    print("FINI", len(res), "échecs:", fails, flush=True)

if __name__ == "__main__":
    main()
