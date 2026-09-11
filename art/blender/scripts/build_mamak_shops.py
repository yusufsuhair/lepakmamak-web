"""Six deterministic Malaysian shopfronts sharing the Mamak scale/material pipeline."""
import argparse
import json
import math
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from build_street_props import PropAuthor
from lm_pipeline import ROOT, CONFIG, setup_template, save_source, export_collection, render_previews, point_at, write_json, sha256

GAME_ROOT=ROOT.parents[1]
PROFILE=json.loads((ROOT/"shop-profile.json").read_text())
CONFIG["palette"].update(PROFILE["palette"])
PALETTE=tuple(CONFIG["palette"])
CREAM,TILE,WOOD,METAL,LEAF,PLASTIC,WHITE,BLUE,GREEN,RED,ORANGE,GLASS=range(len(PALETTE))
SHOPS=json.loads((GAME_ROOT/"shared/mamak-shops.json").read_text())


class ShopAuthor(PropAuthor):
    def disc(self,name,x,y,z,radius,depth,material,segments=16):
        points=[(x+math.cos(i*math.tau/segments)*radius,y+math.sin(i*math.tau/segments)*radius,z+dz)
                for dz in (-depth/2,depth/2) for i in range(segments)]
        faces=[tuple(range(segments-1,-1,-1)),tuple(range(segments,2*segments))]
        faces.extend((i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments))
        self.add(name,points,faces,material)

    def finish_shop(self,shop):
        name=shop["asset"]
        mesh=bpy.data.meshes.new(name+"_Mesh")
        mesh.from_pydata(self.vertices,[],self.faces)
        for mat in PALETTE: mesh.materials.append(bpy.data.materials[mat])
        for face,mat in zip(mesh.polygons,self.materials): face.material_index=mat
        uv=mesh.uv_layers.new(name="UVMap")
        for face in mesh.polygons:
            axes=sorted(range(3),key=lambda axis:abs(face.normal[axis]))[:2]
            for index in face.loop_indices:
                v=mesh.vertices[mesh.loops[index].vertex_index].co
                uv.data[index].uv=(v[axes[0]],v[axes[1]])
        obj=bpy.data.objects.new(name,mesh)
        bpy.data.collections["EXPORT"].objects.link(obj)
        for i,(part,start,count) in enumerate(self.parts):
            obj.vertex_groups.new(name=f"LM_PART_{i:03d}_{part}").add(list(range(start,start+count)),1,"REPLACE")
        obj["lm_asset_id"]=name
        obj["lm_shop_label"]=shop["label"]
        obj["lm_body_size_m"]=[shop["width"],11,shop["depth"]]
        obj["lm_world_position"]=[shop["x"],0,shop["z"]]
        obj["lm_part_count"]=len(self.parts)
        obj["lm_role"]="opaque exterior facade; existing gameplay/collision stays authoritative"
        return obj


def base(a,shop,accent):
    w=shop["width"]
    a.box("Body",0,5.5,0,w,11,12,WHITE)
    a.box("Plinth",0,.28,6.045,w,.56,.09,accent)
    a.box("Cornice",0,11.05,0,w+.4,.3,12.5,WHITE)
    a.box("RoofTrim",0,11.28,0,w+.15,.16,12.2,accent)
    a.box("Parapet",0,11.52,-5.8,w,.48,.20,WHITE)
    for x in (-w/2+.12,w/2-.12):
        a.box("Pilaster",x,5.55,6.10,.25,11.1,.2,WHITE)
        a.box("Capital",x,10.95,6.20,.45,.30,.35,accent)
    for x in (-w*.30,0,w*.30):
        a.box("WindowFrame",x,8.1,6.08,w*.235,2.65,.15,accent)
        a.box("Window",x,8.1,6.175,w*.215,2.42,.04,GLASS)
        a.box("Mullion",x,8.1,6.215,.10,2.42,.04,WHITE)
        a.box("WindowRail",x,8.1,6.215,w*.215,.10,.04,WHITE)
        a.box("WindowSill",x,6.74,6.25,w*.25,.14,.48,WHITE)
    a.box("FacadeBand",0,6.35,6.11,w,.20,.24,accent)
    a.box("LowerWindow",0,1.83,6.075,w-1,3.05,.13,GLASS)
    # Opaque stylised glazing avoids transparent material sorting and extra passes.
    for x in (-w*.38,-w*.22,-1.2,1.2,w*.22,w*.38): a.box("ShopMullion",x,1.8,6.18,.085,3.0,.085,WHITE)
    a.box("Door",0,1.55,6.19,2.2,3.0,.08,GLASS)
    for x in (-1.1,0,1.1): a.box("DoorFrame",x,1.55,6.25,.08,3.0,.06,WHITE)
    for x in (-.16,.16): a.box("DoorHandle",x,1.5,6.30,.045,.42,.07,METAL)
    a.box("FasciaFrame",0,5.03,6.15,w-.25,1.55,.24,WHITE)
    a.box("Fascia",0,5.03,6.30,w-.6,1.30,.07,accent)
    a.text("ShopName",shop["label"],0,5.05,6.35,w-1.4,.83,WHITE)
    a.box("Awning",0,3.62,7.08,w+.05,.14,2.18,accent)
    a.box("Valance",0,3.40,8.16,w+.05,.35,.12,accent)
    a.box("ValanceTrim",0,3.20,8.16,w+.05,.06,.13,WHITE)
    # Upper-storey air conditioner with a faceted grille.
    a.box("ACUnit",w/2-1.45,6.18,6.36,1.55,.65,.55,WHITE)
    for x in range(5): a.box("ACGrille",w/2-2.03+x*.18,6.18,6.655,.06,.4,.025,accent)


def shelf(a,x,width,accent):
    for y in (.70,1.40,2.10):
        a.box("Shelf",x,y,6.22,width,.09,.22,WHITE)
        for j in range(5):
            a.box("Product",x-width*.37+j*width*.185,y+.25,6.23,width*.12,.40,.18,accent if j%2 else WHITE)


def workshop(a,shop):
    w=shop["width"]
    a.box("GarageBay",-1.0,1.85,6.23,w-5,3.10,.12,METAL)
    for y in (2.50,2.75,3.0,3.25): a.box("RollerSlat",-1.0,y,6.32,w-5,.17,.06,WHITE)
    for x in (-5.4,-4.1):
        for y in (.63,1.68):
            a.disc("Tyre",x,y,6.30,.47,.18,METAL,12)
            a.disc("WheelRim",x,y,6.405,.25,.02,WHITE,12)
            a.disc("Hub",x,y,6.425,.08,.02,METAL,8)
    a.box("ToolCabinet",2.5,1.00,6.29,2.3,1.8,.16,ORANGE)
    for y in (.45,.8,1.15,1.5):
        a.box("Drawer",2.5,y,6.39,2.05,.035,.025,METAL)
        a.box("DrawerHandle",2.5,y+.12,6.42,.55,.035,.02,WHITE)
    a.text("Services","SERVIS / TAYAR / MINYAK",0,4.04,6.34,w-2,.31,ORANGE)


def seven(a,shop):
    w=shop["width"]
    for y,color in ((4.26,GREEN),(4.06,ORANGE),(3.86,RED)):
        a.box("BrandStripe",0,y,6.37,w,.16,.09,color)
    for y,color in ((3.58,GREEN),(3.39,ORANGE),(3.21,RED)):
        a.box("AwningStripe",0,y,8.24,w,.15,.08,color)
    a.box("FreshPanel",-4.9,1.70,6.29,5.7,2.50,.14,GREEN)
    a.text("FreshLabel","FRESH TO GO",-4.9,2.42,6.375,5.2,.37,WHITE)
    a.text("CafeLabel","7CAFE",-4.9,1.80,6.375,4.2,.58,ORANGE)
    a.text("SnacksLabel","KOPI / SNEK",-4.9,1.12,6.375,4.7,.28,WHITE)
    for j in range(4):
        x=3.1+j*1.06
        a.box("SlurpeeMachine",x,1.44,6.28,.77,1.7,.18,WHITE)
        a.box("SlurpeeTank",x,1.68,6.39,.59,.75,.06,RED if j%2 else ORANGE)
        a.box("SlurpeeTap",x,1.13,6.45,.07,.18,.05,METAL)
    a.text("SlurpeeLabel","SLURPEE",4.7,2.72,6.37,4.7,.38,GREEN)


def warung(a,shop):
    w=shop["width"]
    for x in (-w*.32,w*.32):
        a.box("ServiceBay",x,1.9,6.20,5.8,2.65,.13,METAL)
        a.box("Counter",x,1.14,6.31,5.6,1.1,.20,WOOD)
        a.box("CounterTop",x,1.76,6.37,5.9,.12,.28,WHITE)
        for j in range(4):
            a.cylinder("FoodPot",x-1.9+j*1.22,2.00,6.27,.32,.33,WOOD,10)
            a.cylinder("PotLid",x-1.9+j*1.22,2.19,6.27,.34,.05,WHITE,10)
    a.text("Menu","NASI LEMAK / MEE GORENG / KUIH",0,4.04,6.36,w-1.8,.31,WOOD)
    for i in range(12):
        if i%2==0: a.box("CanopyStripe",-w/2+w/24+i*w/12,3.70,7.08,w/12,.025,2.18,WHITE)


def zus(a,shop):
    w=shop["width"]
    a.box("CoffeeBay",-4.6,1.8,6.22,6.2,2.85,.12,BLUE)
    a.box("Counter",-4.6,1.1,6.31,5.8,1.4,.16,BLUE)
    a.box("CounterTop",-4.6,1.83,6.38,5.9,.09,.25,WHITE)
    a.box("EspressoMachine",-5.8,2.24,6.36,1.6,.70,.20,METAL)
    for x in (-6.15,-5.55): a.box("CoffeeSpout",x,1.94,6.50,.06,.18,.05,WHITE)
    for j in range(4):
        a.cylinder("CoffeeCup",-4.5+j*.47,2.04,6.37,.14,.30,WHITE,10)
        a.cylinder("CupLid",-4.5+j*.47,2.205,6.37,.15,.035,BLUE,10)
    a.box("PastryDisplay",4.8,1.72,6.26,5.4,1.75,.17,WHITE)
    for y in (1.08,1.69,2.3):
        a.box("PastryShelf",4.8,y,6.38,5.1,.08,.15,BLUE)
        for j in range(4): a.box("Pastry",3.0+j*1.18,y+.20,6.38,.78,.26,.13,CREAM)
    a.text("CoffeeMenu","KOPI / LATTE / PASTRI",0,4.04,6.36,w-1.7,.31,BLUE)


def family(a,shop):
    w=shop["width"]
    for y,color in ((4.16,GREEN),(3.96,WHITE),(3.76,BLUE)):
        a.box("BrandStripe",0,y,6.39,w,.16,.09,color)
    for y,color in ((3.58,GREEN),(3.39,WHITE),(3.21,BLUE)):
        a.box("AwningStripe",0,y,8.24,w,.15,.08,color)
    shelf(a,-w*.28,w*.34,GREEN)
    shelf(a,w*.28,w*.34,BLUE)
    a.text("Sofuto","SOFUTO",w*.38,2.81,6.39,3.7,.33,BLUE)


def market(a,shop):
    w=shop["width"]
    shelf(a,-w*.28,w*.34,RED)
    shelf(a,w*.28,w*.34,CREAM)
    a.text("Convenience","BARANGAN KEPERLUAN HARIAN",0,4.04,6.36,w-1.8,.31,RED)


BUILDERS={"workshop":(workshop,ORANGE),"seven":(seven,GREEN),"warung":(warung,GREEN),"zus":(zus,BLUE),"family":(family,GREEN),"market":(market,RED)}


def preview_setup(w):
    for angle,location in {"Iso":(23,-30,20),"Front":(0,-32,6.0),"Right":(32,0,6),"Top":(0,0,34)}.items():
        camera=bpy.data.objects[f"LM_PREVIEW_{angle}_Camera"]
        camera.location=location
        camera.data.ortho_scale=max(w*1.55,25)
        point_at(camera,(0,-.8,5))
    for name,location,energy in [("Key",(12,-20,26),10000),("Fill",(-20,-10,18),6000),("Rim",(0,16,25),8000)]:
        light=bpy.data.objects[f"LM_PREVIEW_{name}"]
        light.location=location
        light.data.energy=energy
        light.data.size=12
        point_at(light,(0,0,4))
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.6


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--skip-renders",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    output=args.output.resolve()
    if output.exists() and any(output.iterdir()): raise ValueError("Use an empty output directory")
    output.mkdir(parents=True,exist_ok=True)
    results={}
    for shop in SHOPS:
        setup_template()
        a=ShopAuthor()
        builder,accent=BUILDERS[shop["kind"]]
        base(a,shop,accent)
        builder(a,shop)
        a.finish_shop(shop)
        preview_setup(shop["width"])
        source=output/"source"/(shop["asset"]+".blend")
        save_source(source)
        bpy.ops.wm.open_mainfile(filepath=str(source))
        result=export_collection(output/"exports"/(shop["asset"]+".glb"),budget_overrides=PROFILE["budgets"])
        result["source_sha256"]=sha256(source)
        results[shop["asset"]]=result
        if not args.skip_renders: render_previews(output/"previews",asset_name=shop["asset"])
    write_json(output/"reports/validation.json",results)
    write_json(output/"reports/manifest.json",{
        "blender_version":bpy.app.version_string,"script_sha256":sha256(Path(__file__)),
        "author_sha256":sha256(ROOT/"scripts/build_mamak_asset.py"),"prop_author_sha256":sha256(ROOT/"scripts/build_street_props.py"),
        "pipeline_sha256":sha256(ROOT/"scripts/lm_pipeline.py"),"config_sha256":sha256(ROOT/"config.json"),
        "profile_sha256":sha256(ROOT/"shop-profile.json"),"layout_sha256":sha256(GAME_ROOT/"shared/mamak-shops.json"),
        "assets":{name:r["glb"]["sha256"] for name,r in results.items()}})
    print("LM_SHOPS_PASS",{name:(r["triangles"],r["glb"]["bytes"],r["glb"]["primitives"]) for name,r in results.items()})


if __name__=="__main__": main()
