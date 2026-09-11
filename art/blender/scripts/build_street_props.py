"""Reusable, opaque street props for the Mamak neighbourhood. No external fonts/textures."""
import argparse
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
import bmesh
from build_mamak_asset import Author, ORIGIN, PALETTE, CREAM, WOOD, METAL, GREEN, TILE
from lm_pipeline import ROOT, setup_template, save_source, export_collection, render_previews, point_at, write_json, sha256

BUDGET = {"max_triangles": 1200, "max_materials": 3, "max_draw_calls": 3, "max_glb_bytes": 98304}


class PropAuthor(Author):
    def add(self, name, points, faces, material, closed=True):
        # Reuse the proven geometry author while giving each reusable prop a local origin.
        super().add(name, [(x+ORIGIN[0],y,z+ORIGIN[2]) for x,y,z in points], faces, material, closed)

    def ico(self, name, x,y,z, rx,ry,rz, material):
        bm=bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1)
        bm.verts.ensure_lookup_table()
        bm.verts.index_update()
        self.add(name, [(x+v.co.x*rx,y+v.co.y*ry,z+v.co.z*rz) for v in bm.verts],
                 [tuple(v.index for v in f.verts) for f in bm.faces], material)
        bm.free()

    def finish_prop(self, name):
        mesh=bpy.data.meshes.new(name+"_Mesh")
        mesh.from_pydata(self.vertices,[],self.faces)
        for material in PALETTE: mesh.materials.append(bpy.data.materials[material])
        for face,material in zip(mesh.polygons,self.materials): face.material_index=material
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
        obj["lm_origin"]="base center, meters, Blender -Y / glTF +Z forward"
        obj["lm_part_count"]=len(self.parts)
        return obj


def palm(a):
    # Tapered ringed trunk and faceted closed fronds: underside stays visible without alpha.
    for i in range(7):
        a.cylinder("Trunk",.045*i,.5+i*.9,0,.23-i*.013,1.0,WOOD,8,.215-i*.013)
        a.cylinder("TrunkRing",.045*i,.88+i*.9,0,.242-i*.013,.065,CREAM,8)
    a.ico("Crown",.27,6.7,0,.4,.55,.4,GREEN)
    for index in range(8):
        angle=index*math.tau/8 + .10*math.sin(index*2.7)
        c,s=math.cos(angle),math.sin(angle)
        points=[]
        for j in range(7):
            t=j/6
            distance=.15+(3.5+.55*math.sin(index*1.7))*t
            height=6.85+math.sin(t*math.pi)*(.65+.20*(index%3))-t*(1.1+.18*(index%3))
            width=.018+math.sin(t*math.pi)*(.30+.06*(index%3))
            # Rings around the X-directed frond, rotated around vertical Y.
            for lateral,dy in ((-width,-.025),(width,-.025),(width,.025),(-width,.025)):
                points.append((.27+distance*c-lateral*s,height+dy,distance*s+lateral*c))
        faces=[(3,2,1,0),(24,25,26,27)]
        for j in range(6):
            for k in range(4): faces.append((j*4+k,j*4+(k+1)%4,(j+1)*4+(k+1)%4,(j+1)*4+k))
        # Ring ordering makes the local X direction negative; reverse to outward winding.
        a.add("Frond",points,[tuple(reversed(f)) for f in faces],GREEN)
    for x,z in ((.10,.27),(.4,.19),(.25,-.25)): a.ico("Coconut",x,6.48,z,.20,.25,.20,WOOD)


def bench(a):
    for x in (-.88,.88):
        for z in (-.23,.23): a.box("Foot",x,.25,z,.09,.50,.10,METAL)
        a.box("SeatSupport",x,.44,0,.09,.09,.72,METAL)
        a.box("BackSupport",x,.83,-.27,.09,.85,.09,METAL)
        a.box("ArmPost",x,.73,.25,.075,.38,.075,METAL)
        a.box("Armrest",x,.93,0,.14,.08,.72,WOOD)
    for z in (-.24,0,.24): a.box("SeatSlat",0,.55,z,2.4,.10,.20,WOOD)
    for y in (.83,1.04,1.25): a.box("BackSlat",0,y,-.30,2.4,.16,.09,WOOD)
    for x in (-.85,.85):
        for y in (.83,1.25): a.box("Bolt",x,y,-.247,.045,.045,.01,METAL)


def street_lamp(a):
    a.cylinder("Plinth",0,.12,0,.19,.24,METAL,8)
    a.cylinder("Pole",0,2.76,0,.13,5.28,METAL,8,.09)
    a.cylinder("Collar",0,.68,0,.15,.08,CREAM,8)
    a.box("Head",.85,5.30,0,1.70,.24,.52,METAL)
    a.box("Diffuser",.85,5.165,0,1.46,.03,.40,CREAM)
    a.box("SwitchPlate",0,1.22,.135,.12,.23,.035,CREAM)
    a.box("Switch",0,1.23,.161,.05,.08,.02,METAL)


def planter(a):
    a.box("Base",0,.07,0,1.84,.14,1.84,WOOD)
    a.box("Body",0,.50,0,1.96,.72,1.96,WOOD)
    a.box("Soil",0,.83,0,1.70,.07,1.70,WOOD)
    for side in (-1,1):
        a.box("RimX",side*.94,.89,0,.12,.14,2,CREAM)
        a.box("RimZ",0,.89,side*.94,1.76,.14,.12,CREAM)
    # Layered tropical leaves have a directional silhouette instead of three balls.
    for i in range(9):
        angle=i*2.39996
        radius=.24+.10*(i%3)
        x,z=math.cos(angle)*radius,math.sin(angle)*radius
        a.ico('BroadLeaf',x,1.25+.12*(i%4),z,.19,.42+.08*(i%3),.31,GREEN)


BUILDERS={"LM_PROP_PalmMamak":palm,"LM_PROP_BenchMamak":bench,"LM_PROP_StreetLamp":street_lamp,"LM_PROP_PlanterMamak":planter}


def frame_preview(obj):
    dims=obj.dimensions
    target=(0,0,dims.z*.48)
    size=max(dims)*1.55
    for angle,position in {"Iso":(size,-size,size*.75),"Front":(0,-size,dims.z*.55),"Right":(size,0,dims.z*.55),"Top":(0,0,size)}.items():
        camera=bpy.data.objects[f"LM_PREVIEW_{angle}_Camera"]
        camera.location=position
        camera.data.ortho_scale=size
        point_at(camera,target)
    for name,position,energy in [("Key",(6,-8,12),1800),("Fill",(-7,-4,8),1000),("Rim",(0,8,10),1500)]:
        light=bpy.data.objects[f"LM_PREVIEW_{name}"]
        light.location=position
        light.data.energy=energy
        light.data.size=6
        point_at(light,target)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--skip-renders",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    output=args.output.resolve()
    if output.exists() and any(output.iterdir()): raise ValueError("Use an empty output directory")
    output.mkdir(parents=True,exist_ok=True)
    results={}
    for name,builder in BUILDERS.items():
        setup_template()
        a=PropAuthor()
        builder(a)
        obj=a.finish_prop(name)
        if name=="LM_PROP_StreetLamp": obj["lm_head_anchor_m"]=[.85,5.3,0]
        if name=="LM_PROP_BenchMamak": obj["lm_role"]="decorative street bench; no player seat IDs"
        bpy.context.view_layer.update()
        frame_preview(obj)
        source=output/"source"/(name+".blend")
        save_source(source)
        bpy.ops.wm.open_mainfile(filepath=str(source))
        results[name]=export_collection(output/"exports"/(name+".glb"),budget_overrides=BUDGET)
        results[name]["source_sha256"]=sha256(source)
        if not args.skip_renders: render_previews(output/"previews",asset_name=name)
    write_json(output/"reports/validation.json",results)
    write_json(output/"reports/manifest.json",{
        "blender_version":bpy.app.version_string,"script_sha256":sha256(Path(__file__)),
        "author_sha256":sha256(ROOT/"scripts/build_mamak_asset.py"),"pipeline_sha256":sha256(ROOT/"scripts/lm_pipeline.py"),
        "config_sha256":sha256(ROOT/"config.json"),
        "assets":{name:result["glb"]["sha256"] for name,result in results.items()}})
    print("LM_STREET_PROPS_PASS",{name:(r["triangles"],r["glb"]["bytes"],r["glb"]["primitives"]) for name,r in results.items()})


if __name__=="__main__": main()
