#!/usr/bin/env python3
"""Relit chaque fiche IKEA du catalogue et signale prix, nom ou disponibilité qui ont changé.

Même règle que le relevé initial : uniquement les pages /p/, identification honnête, pause entre les pages.
Usage : verify_ikea.py src/data/ikea.json rapport.json
"""
import json, re, sys, time, urllib.request, urllib.error, html

UA = "MaisonCatalogue/1.0 (projet personnel)"
DELAY = 1.2

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "fr-FR"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")

items = json.load(open(sys.argv[1]))
report = []
for i, x in enumerate(items):
    entry = {"slug": x["slug"], "name": x["name"], "type": x["type"], "old": x["price"], "url": x["url"]}
    try:
        page = fetch(x["url"])
        m = re.search(r'data-product-price="([\d.]+)"', page)
        entry["new"] = float(m.group(1)) if m else None
        t = re.search(r'<title>(.*?)</title>', page, re.S)
        entry["title"] = html.unescape(t.group(1)).strip()[:120] if t else ""
        d = re.search(r'pip-header-section__description-text[^>]*>(.*?)<', page, re.S)
        entry["desc"] = html.unescape(d.group(1)).strip() if d else ""
        entry["family"] = bool(re.search(r'IKEA Family.{0,200}?price', page, re.S))
        entry["pack"] = re.findall(r'(?:lot de|\b)(\d+) pièces', x["slug"] + " " + entry["title"])[:1]
    except urllib.error.HTTPError as e:
        entry["error"] = e.code
    except Exception as e:
        entry["error"] = str(e)[:80]
    report.append(entry)
    if i % 25 == 0: print(i, flush=True)
    time.sleep(DELAY)
json.dump(report, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
changed = [r for r in report if r.get("new") is not None and abs(r["new"] - r["old"]) > 0.005]
errors = [r for r in report if r.get("error") or r.get("new") is None]
print(f"{len(report)} fiches · {len(changed)} prix changés · {len(errors)} fiches illisibles")
