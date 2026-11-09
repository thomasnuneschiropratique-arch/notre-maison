#!/usr/bin/env python3
"""Télécharge depuis Poly Haven (licence CC0) les modèles, ciels et matières de l'application."""
import json, os, sys, urllib.request, concurrent.futures as cf

UA = "MaisonCatalogue/1.0 (projet personnel)"
ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = sys.argv[1]  # dossier temporaire pour les .gltf bruts

MODELS = """ArmChair_01 GreenChair_01 Ottoman_01 Rockingchair_01 Sofa_01 sofa_02 sofa_03 mid_century_lounge_chair modern_arm_chair_01
dining_chair_02 gallinera_chair painted_wooden_chair_01 bar_chair_round_01 metal_stool_02 folding_wooden_stool
CoffeeTable_01 coffee_table_round_01 modern_coffee_table_01 modern_coffee_table_02 industrial_coffee_table side_table_01 side_table_tall_01 small_wooden_table_01 gallinera_table
dining_table round_wooden_table_01 round_wooden_table_02 wooden_table_02 WoodenTable_01 metal_office_desk SchoolDesk_01
ClassicConsole_01 ClassicNightstand_01 painted_wooden_nightstand modern_wooden_cabinet drawer_cabinet painted_wooden_cabinet vintage_wooden_drawer_01 GothicCommode_01
Shelf_01 wooden_display_shelves_01 steel_frame_shelves_03 painted_wooden_shelves vintage_cabinet_01
vintage_day_bed old_bed_frame throw_pillows_01
potted_plant_01 potted_plant_02 potted_plant_04
modern_ceiling_lamp_01 hanging_industrial_lamp Chandelier_01 lantern_chandelier_01 ceiling_fan industrial_wall_lamp industrial_pipe_lamp
ceramic_vase_01 ceramic_vase_02 ceramic_vase_03 ceramic_vase_04 antique_ceramic_vase_01 brass_vase_01 wicker_basket_02 wooden_bowl_01
hanging_picture_frame_01 hanging_picture_frame_02 hanging_picture_frame_03 fancy_picture_frame_01 standing_picture_frame_01 ornate_mirror_01 wall_clock mantel_clock_01
book_encyclopedia_set_01 tea_set_01 jug_01 concrete_cat_statue marble_bust_01 alarm_clock_01
television_02 electric_stove scandinavian_masonry_heater outdoor_table_chair_set_01 wooden_picnic_table painted_wooden_bench""".split()

HDRIS = {"matin":"kloofendal_48d_partly_cloudy_puresky","midi":"qwantani_noon_puresky","couvert":"kloppenheim_06_puresky","soir":"qwantani_dusk_2_puresky","nuit":"moonless_golf"}

TEX = """wood_floor laminate_floor_02 laminate_floor_03 herringbone_parquet dark_wooden_planks wood_floor_deck
marble_01 marble_tiles marble_mosaic_tiles terracotta_floor_tiles rectangular_parquet diagonal_parquet oak_wood_planks white_oak_veneer oak_veneer_02 mocha_oak_veneer black_oak_veneer grey_oak_veneer_01 velour_velvet wool_boucle bamboo_veneer denim_fabric clay_plaster concrete_tiles square_pavers concrete_pavers clay_roof_tiles concrete_tile_facade large_grey_tiles floor_tiles_06 floor_tiles_08 grey_tiles patterned_clay_plaster concrete_floor_02 terrazzo_tiles beige_wall_001 white_plaster_02
plastered_wall painted_plaster_wall stone_wall red_brick_03 brick_wall_001 wood_cabinet_worn_long oak_veneer_01 plywood fabric_leather_02 rough_linen dirty_carpet
roof_tiles clay_roof_tiles_02 grey_roof_tiles sparse_grass forrest_ground_01 aerial_grass_rock gravelly_sand cobblestone_floor_08 weathered_planks""".split()

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent":UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def save(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = get(url)
    with open(path, "wb") as f: f.write(data)

def model(a):
    info = json.loads(get(f"https://api.polyhaven.com/files/{a}"))
    g = info["gltf"]["1k"]["gltf"]
    d = os.path.join(RAW, a)
    save(g["url"], os.path.join(d, a + ".gltf"))
    for rel, v in g["include"].items():
        save(v["url"], os.path.join(d, rel))
    save(f"https://cdn.polyhaven.com/asset_img/thumbs/{a}.png?width=256&height=256", os.path.join(ROOT, "public/thumbs", a + ".png"))
    return a

def hdri(kv):
    name, a = kv
    info = json.loads(get(f"https://api.polyhaven.com/files/{a}"))
    save(info["hdri"]["1k"]["hdr"]["url"], os.path.join(ROOT, "public/hdri", name + ".hdr"))
    return a

def tex(a):
    info = json.loads(get(f"https://api.polyhaven.com/files/{a}"))
    d = os.path.join(ROOT, "public/textures", a)
    save(info["Diffuse"]["1k"]["jpg"]["url"], os.path.join(d, "diff.jpg"))
    nor = info.get("nor_gl", {}).get("1k", {}).get("jpg")
    if nor: save(nor["url"], os.path.join(d, "nor.jpg"))
    r = info.get("Rough", {}).get("1k", {}).get("jpg") or info.get("arm", {}).get("1k", {}).get("jpg")
    if r: save(r["url"], os.path.join(d, "rough.jpg"))
    save(f"https://cdn.polyhaven.com/asset_img/thumbs/{a}.png?width=128&height=128", os.path.join(ROOT, "public/thumbs", "t_" + a + ".png"))
    return a

def run(fn, items, label):
    ok, ko = [], []
    with cf.ThreadPoolExecutor(4) as ex:
        futs = {ex.submit(fn, i): i for i in items}
        for f in cf.as_completed(futs):
            try: ok.append(f.result())
            except Exception as e: ko.append(f"{futs[f]}: {e}")
    print(label, "ok:", len(ok), "ko:", ko, flush=True)
    return ok

m = run(model, MODELS, "modèles")
run(hdri, list(HDRIS.items()), "ciels")
run(tex, TEX, "matières")
json.dump(sorted(m), open(os.path.join(RAW, "models.json"), "w"))
