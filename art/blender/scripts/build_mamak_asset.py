"""Author the complete Mamak Maju site from authoritative game seating coordinates."""
import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from mathutils import Vector
from lm_pipeline import ROOT, setup_template, save_source, export_collection, render_previews, write_json, sha256, point_at

ASSET = "LM_ENV_MamakMaju"
SIGN_TEXT = "MAMAK MAJU"
ORIGIN = (-29, 0, 30)
TABLE_IDS = {"meja-1", "meja-2", "meja-3", "meja-4", "meja-9"}
GAME_ROOT = ROOT.parents[1]
PALETTE = ("LM_Wall_Cream", "LM_Roof_Red", "LM_Wood_Warm", "LM_Metal_Dark", "LM_Leaf_Green", "LM_Plastic_Red")
CREAM, TILE, WOOD, METAL, GREEN, RED = range(6)


class Author:
    def __init__(self):
        self.vertices, self.faces, self.materials, self.parts = [], [], [], []

    def add(self, name, points, faces, material, closed=True):
        # Rotation, not reflection: world +Y up/+Z forward -> Blender +Z up/-Y forward.
        points = [(x - ORIGIN[0], -(z - ORIGIN[2]), y) for x, y, z in points]
        if closed:
            volume = sum(Vector(points[f[0]]).dot(Vector(points[f[i]]).cross(Vector(points[f[i + 1]]))) / 6
                         for f in faces for i in range(1, len(f) - 1))
            assert volume > 1e-9, f"Inward or empty solid: {name} ({volume})"
        start = len(self.vertices)
        self.vertices.extend(points)
        self.faces.extend(tuple(start + i for i in face) for face in faces)
        self.materials.extend([material] * len(faces))
        self.parts.append((name, start, len(points)))

    def box(self, name, x, y, z, w, h, d, material, yaw=0):
        local = [(-w/2,-h/2,-d/2),(w/2,-h/2,-d/2),(w/2,-h/2,d/2),(-w/2,-h/2,d/2),
                 (-w/2,h/2,-d/2),(w/2,h/2,-d/2),(w/2,h/2,d/2),(-w/2,h/2,d/2)]
        c, s = math.cos(yaw), math.sin(yaw)
        points = [(x + px*c + pz*s, y + py, z - px*s + pz*c) for px,py,pz in local]
        self.add(name, points, [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)], material)

    def cylinder(self, name, x, y, z, radius, height, material, segments=12, top_radius=None):
        top_radius = radius if top_radius is None else top_radius
        points = [(x + math.cos(i*math.tau/segments)*r, y + dy, z + math.sin(i*math.tau/segments)*r)
                  for r,dy in ((radius,-height/2),(top_radius,height/2)) for i in range(segments)]
        faces = [tuple(range(segments)), tuple(range(2*segments-1,segments-1,-1))]
        faces.extend((i, i+segments, (i+1)%segments+segments, (i+1)%segments) for i in range(segments))
        self.add(name, points, faces, material)

    def text(self, name, label, x, y, z, width, height, material=CREAM):
        curve = bpy.data.curves.new(name, "FONT")
        curve.body, curve.resolution_u, curve.fill_mode = label, 2, "BOTH"
        obj = bpy.data.objects.new(name, curve)
        bpy.context.scene.collection.objects.link(obj)
        bpy.context.view_layer.update()
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        lo = [min(v.co[i] for v in mesh.vertices) for i in (0,1)]
        hi = [max(v.co[i] for v in mesh.vertices) for i in (0,1)]
        scale = min(width/(hi[0]-lo[0]), height/(hi[1]-lo[1]))
        self.add(name, [(x+(v.co.x-(lo[0]+hi[0])/2)*scale, y+(v.co.y-(lo[1]+hi[1])/2)*scale, z)
                        for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons], material, closed=False)
        bpy.data.meshes.remove(mesh)
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.curves.remove(curve)

    def finish(self, tables, chairs):
        mesh = bpy.data.meshes.new(f"{ASSET}_Mesh")
        mesh.from_pydata(self.vertices, [], self.faces)
        for name in PALETTE: mesh.materials.append(bpy.data.materials[name])
        for polygon, material in zip(mesh.polygons, self.materials): polygon.material_index = material
        uv = mesh.uv_layers.new(name="UVMap")
        for polygon in mesh.polygons:
            axes = sorted(range(3), key=lambda axis: abs(polygon.normal[axis]))[:2]
            for index in polygon.loop_indices:
                v = mesh.vertices[mesh.loops[index].vertex_index].co
                uv.data[index].uv = (v[axes[0]], v[axes[1]])
        obj = bpy.data.objects.new(ASSET, mesh)
        nested = bpy.data.collections.new("LM_EXPORT_Geometry")
        bpy.data.collections["EXPORT"].children.link(nested)
        nested.objects.link(obj)
        # Independently selectable parts survive in the editable source without extra draws.
        for i, (name, start, count) in enumerate(self.parts):
            obj.vertex_groups.new(name=f"LM_PART_{i:03d}_{name}").add(list(range(start,start+count)), 1, "REPLACE")
        obj["lm_asset_id"], obj["lm_sign_text"] = ASSET, SIGN_TEXT
        obj["lm_version"] = 3
        obj["lm_origin_world"] = list(ORIGIN)
        obj["lm_tables_json"] = json.dumps([{k:t[k] for k in ("id","x","z")} for t in tables], sort_keys=True)
        obj["lm_chairs_json"] = json.dumps([{k:c[k] for k in ("id","x","z","yaw","tableId")} for c in chairs], sort_keys=True)
        obj["lm_part_count"] = len(self.parts)
        return obj


def chair(a, seat, prefix):
    x,z,yaw = seat["x"],seat["z"],seat["yaw"]
    # Avatar forward is +Z; the back is behind the avatar at local -Z.
    def box(part, dx, y, dz, w, h, d, mat=RED):
        c,s = math.cos(yaw), math.sin(yaw)
        a.box(prefix+part, x+dx*c+dz*s, y, z-dx*s+dz*c, w,h,d,mat,yaw)
    box("Seat",0,.60,0,.76,.12,.76)
    for dx in (-.29,.29):
        for dz in (-.29,.29): box("Leg",dx,.36,dz,.07,.48,.07,TILE)
    for dx in (-.31,.31): box("BackPost",dx,1.0,-.33,.08,.78,.08)
    box("BackTop",0,1.35,-.33,.7,.13,.09)
    for dx in (-.17,0,.17): box("BackSlat",dx,1.06,-.33,.10,.48,.07)


def build_site():
    tables = [t for t in json.loads((GAME_ROOT/"shared/tables.json").read_text()) if t["id"] in TABLE_IDS]
    chairs = [c for c in json.loads((GAME_ROOT/"shared/chairs.json").read_text()) if c["tableId"] in TABLE_IDS]
    a = Author()
    a.box("Courtyard",-29,.10,41,37,.20,30,CREAM)
    a.box("BigTablePaving",-34,.10,60.75,15,.20,9.5,CREAM)
    for x in (-46.9,-11.1): a.box("PavingBorder",x,.215,41,.18,.03,30,WOOD)
    for z in (43,48,53): a.box("PavingJoint",-29,.203,z,35.5,.006,.035,WOOD)
    # Building and counter match the existing collision solids.
    a.box("Building",-29,4.4,30,30,8.8,9,CREAM)
    a.box("Plinth",-29,.55,34.55,30,1.1,.1,GREEN)
    a.box("RoofEave",-29,8.94,30,31.2,.28,10.4,WOOD)
    a.box("Roof",-29,9.26,30,30.8,.36,10,TILE)
    a.box("RoofRidge",-29,9.73,30,30.8,.44,.36,TILE)
    for x in range(-44,-13,2): a.box("RoofSeam",x,9.47,30,.08,.06,10,WOOD)
    for x in (-44,-34,-24,-14): a.box("FacadePillar",x,4.4,34.65,.3,8.8,.3,WOOD)
    for x in (-39,-29,-19):
        a.box("WindowFrame",x,6.85,34.66,5,2.5,.18,WOOD)
        a.box("Window",x,6.85,34.77,4.72,2.25,.06,GREEN)
        a.box("Mullion",x,6.85,34.82,.12,2.3,.05,CREAM)
        a.box("WindowRail",x,6.85,34.82,4.75,.1,.05,CREAM)
        a.box("Sill",x,5.57,34.85,5.2,.15,.46,WOOD)
    a.text("Open24Hours","RESTORAN  /  BUKA 24 JAM",-29,8.35,34.82,23,.40,WOOD)
    for x in (-39,-29,-19):
        a.box("ServiceBay",x,2.2,34.68,8.2,3,.12,METAL)
        for y in (1.15,2.85): a.box("ServiceShelf",x,y,34.80,7.8,.10,.24,WOOD)
        for j in range(5): a.cylinder("ShelfJar",x-2.6+j*1.25,3.1,34.93,.16,.40,CREAM,8)
    # Continuous stripes and a branded courtyard-facing canopy.
    for i in range(20):
        x = -43.82+i*1.56
        color = GREEN if i%2 == 0 else CREAM
        a.box("CanopyStripe",x,4.55,38.35,1.56,.16,7.7,color)
        a.box("CanopyValance",x,4.23,42.22,1.56,.50,.14,color)
    for x in (-44,-14):
        a.box("CanopyPost",x,2.15,40,.30,4.1,.30,WOOD)
        a.box("PostFoot",x,.42,40,.48,.42,.48,GREEN)
    a.box("NameFrame",-29,4.23,42.33,17.8,1.12,.20,WOOD)
    a.box("NameBoard",-29,4.23,42.45,17.4,.90,.08,GREEN)
    a.text("MamakName",SIGN_TEXT,-29,4.23,42.50,15.6,.68)
    a.text("MenuHeading","ROTI CANAI   /   TEH TARIK   /   NASI KANDAR",-29,5.08,34.86,26,.36,WOOD)
    a.box("Counter",-39,1.05,37,7,1.8,1.8,GREEN)
    a.box("CounterTrim",-39,.75,37.92,6.65,.12,.05,WOOD)
    a.text("CounterLabel","NASI KANDAR",-39,1.35,37.93,5.8,.38)
    a.box("TeaShelf",-18.7,1.85,34.94,5.8,.14,.5,WOOD)
    for x in (-20.5,-19.3):
        a.cylinder("TeaUrn",x,2.44,35.0,.43,1.0,METAL,12)
        a.cylinder("UrnLid",x,2.97,35.0,.46,.08,CREAM,12)
        a.box("UrnTap",x,2.15,35.46,.08,.12,.19,WOOD)
    a.text("TeaLabel","TEH TARIK",-18.7,3.65,34.85,5.8,.38)
    for t in tables:
        x,z = t["x"],t["z"]
        radius=1.95 if t["id"] == "meja-9" else 1.14
        a.cylinder("TableBase",x,.27,z,.6,.14,METAL,12)
        a.cylinder("TableLeg",x,.64,z,.13,.70,METAL,12)
        a.cylinder("TableRim",x,1.05,z,radius,.14,WOOD,24)
        a.cylinder("TableTop",x,1.13,z,radius-.035,.025,CREAM,24)
        for dx,dz in ((.38,.12),(-.40,-.20)):
            a.cylinder("TeaCup",x+dx,1.29,z+dz,.105,.28,WOOD,10)
            a.cylinder("TeaFoam",x+dx,1.435,z+dz,.10,.008,CREAM,10)
            a.box("CupHandle",x+dx+.12,1.28,z+dz,.10,.12,.05,WOOD)
        a.cylinder("Plate",x-.25,1.16,z+.35,.27,.04,CREAM,12)
        a.cylinder("Roti",x-.25,1.19,z+.35,.19,.025,WOOD,10)
        a.box("TissueBox",x+.23,1.26,z-.35,.34,.22,.23,GREEN)
        a.box("Tissue",x+.23,1.40,z-.35,.20,.07,.02,CREAM)
    for seat in chairs: chair(a,seat,seat["id"])
    chair(a,{"x":-29,"z":46.7,"yaw":math.pi},"CustomerReserved")
    for x in (-40,-29,-18):
        a.cylinder("LampStem",x,4.12,40,.025,.60,METAL,8)
        a.cylinder("LampShade",x,3.79,40,.30,.16,WOOD,12,.08)
        a.cylinder("LampDiffuser",x,3.70,40,.22,.035,CREAM,12)
        a.cylinder("FanHub",x,4.23,36.1,.16,.35,METAL,8)
        for angle in (0,math.tau/3,2*math.tau/3):
            a.box("FanBlade",x+math.sin(angle)*.42,4.08,36.1+math.cos(angle)*.42,.16,.04,.75,WOOD,angle)
    for x in (-44,-14):
        a.cylinder("Planter",x,.59,40,.35,.70,TILE,10,.43)
        a.cylinder("Soil",x,.95,40,.37,.025,WOOD,10)
        for i in range(5):
            angle=i*math.tau/5
            a.cylinder("PlantLeaf",x+math.sin(angle)*.15,1.25+(i%2)*.12,40+math.cos(angle)*.15,.10,.6,GREEN,5,.025)
    a.box("WelcomeBoard",-18.5,1.45,43.3,3.4,1.5,.14,GREEN)
    for x in (-20,-17): a.box("WelcomeLeg",x,.67,43.3,.10,1.34,.12,WOOD)
    a.text("WelcomeTitle","LEPAK SINI",-18.5,1.65,43.39,3.0,.37)
    a.text("WelcomeCaption","MAKAN / BORAK / MAIN",-18.5,1.08,43.39,2.9,.18)
    from mamak_polish import add_details, make_counter
    steel=Author()
    add_details(a,steel)
    obj=a.finish(tables,chairs)
    return obj, make_counter(steel)


def preview_setup():
    for angle,location in {"Iso":(35,-50,32),"Front":(0,-65,12),"Right":(58,-14,20),"Top":(0,-13,65)}.items():
        camera=bpy.data.objects[f"LM_PREVIEW_{angle}_Camera"]
        camera.location=location
        camera.data.ortho_scale=54 if angle in {"Iso","Top"} else 44
        point_at(camera,(0,-13,3))
    for name,location,energy,size in [("Key",(5,-25,35),18000,18),("Fill",(-25,-12,22),11000,16),("Rim",(0,15,30),14000,14)]:
        light=bpy.data.objects[f"LM_PREVIEW_{name}"]
        light.location=location
        light.data.energy,light.data.size=energy,size
        point_at(light,(0,-10,0))
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.65
    bpy.context.scene.camera=bpy.data.objects["LM_PREVIEW_Iso_Camera"]
    data=bpy.data.cameras.new("LM_PREVIEW_Counter_CameraData")
    data.type,data.lens="PERSP",28
    camera=bpy.data.objects.new("LM_PREVIEW_Counter_Camera",data)
    bpy.data.collections["LIGHTING_PREVIEW"].objects.link(camera)
    camera.location=(-5.5,-10.8,3.6)
    point_at(camera,(-10,-7,2.15))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--skip-renders",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    output=args.output.resolve()
    if output.exists() and any(output.iterdir()): raise RuntimeError(f"Output is nonempty: {output}")
    output.mkdir(parents=True,exist_ok=True)
    setup_template()
    from mamak_polish import PROFILE, bake_counter
    for name,roughness in PROFILE["roughness"].items():
        bpy.data.materials[name].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=roughness
    obj,counter=build_site()
    bake_counter(counter,output)
    preview_setup()
    source=output/"source"/f"{ASSET}.blend"
    save_source(source)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    result=export_collection(output/"exports"/f"{ASSET}.glb",budget_overrides=PROFILE["budgets"],
        texture_profile={"material":PROFILE["counter_material"],"resolution":PROFILE["bake"]["resolution"]})
    if not args.skip_renders:
        render_previews(output/"previews",asset_name=ASSET)
        bpy.context.scene.camera=bpy.data.objects["LM_PREVIEW_Counter_Camera"]
        bpy.context.scene.render.filepath=str(output/"previews"/"counter-close.png")
        bpy.ops.render.render(write_still=True)
        bpy.context.scene.camera=bpy.data.objects["LM_PREVIEW_Iso_Camera"]
    write_json(output/"reports"/"validation.json",result)
    write_json(output/"reports"/"manifest.json",{
        "asset":ASSET,"version":3,"blender_version":bpy.app.version_string,
        "profile_sha256":sha256(ROOT/"mamak-profile.json"),
        "polish_sha256":sha256(ROOT/"scripts/mamak_polish.py"),
        "config_sha256":sha256(ROOT/"config.json"),"script_sha256":sha256(Path(__file__)),
        "pipeline_sha256":sha256(ROOT/"scripts/lm_pipeline.py"),
        "tables_sha256":sha256(GAME_ROOT/"shared/tables.json"),"chairs_sha256":sha256(GAME_ROOT/"shared/chairs.json"),
        "source_sha256":sha256(source),"glb_sha256":result["glb"]["sha256"]})
    print("LM_MAMAK_ASSET_PASS",result)


if __name__ == "__main__": main()
