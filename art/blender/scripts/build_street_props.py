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


def _double_sided_blade(a, name, points):
    """A thin, pointed leaf blade with a visible underside and no alpha texture."""
    faces=[(0,1,2),(0,2,3),(2,1,0),(3,2,0)]
    a.add(name,points,faces,GREEN,closed=False)


def _double_sided_polygon(a, name, points):
    """Triangulate a convex leaf outline and retain its underside."""
    faces=[]
    for index in range(1,len(points)-1):
        faces.extend(((0,index,index+1),(index+1,index,0)))
    a.add(name,points,faces,GREEN,closed=False)


def _leaflet(a, angle, root, length, width, droop, side):
    """Build one lanceolate palm leaflet in the radial/tangential frame."""
    c,s=math.cos(angle),math.sin(angle)
    tangent=(-s,c)
    # Hold each leaflet on a slight upright fold. A purely horizontal blade
    # disappears edge-on from player-height courtyard cameras.
    across=(tangent[0]*.34,.94,tangent[1]*.34)
    rx,ry,rz=root
    # Opposite leaflets leave the rachis at a slight alternating angle, like a real frond.
    spread=side*.08
    tip=(rx+(length*c+spread*tangent[0]),ry-droop,rz+(length*s+spread*tangent[1]))
    mid=(rx+(length*.52*c+spread*.55*tangent[0]),ry-droop*.45,rz+(length*.52*s+spread*.55*tangent[1]))
    half=width*.5
    points=[(rx+side*across[0]*half,ry+side*across[1]*half,rz+side*across[2]*half),
            (mid[0]-across[0]*half,mid[1]-across[1]*half,mid[2]-across[2]*half),tip,
            (mid[0]+across[0]*half,mid[1]+across[1]*half,mid[2]+across[2]*half)]
    _double_sided_blade(a,"PalmLeaflet",points)


def palm(a):
    # A compact, pinnate tropical palm: ringed tapered trunk, crown sheath, curved rachises
    # and alternating pointed leaflets. Everything is opaque and batched into three palette
    # materials, so the silhouette reads at street distance without alpha sorting.
    for i in range(6):
        y=.51+i*1.02; radius=.235-i*.018
        a.cylinder("Trunk",.045*i,y,0,radius,1.02,WOOD,8,max(radius-.015,.12))
        a.cylinder("TrunkRing",.045*i,y+.47,0,radius+.012,.055,CREAM,8)
    a.ico("CrownSheath",.27,6.62,0,.39,.52,.39,GREEN)
    for index in range(8):
        angle=index*math.tau/8+.10*math.sin(index*2.7)
        c,s=math.cos(angle),math.sin(angle)
        # Five paired leaflets along each curved rachis. A narrow double-sided strip keeps
        # the centreline readable where the leaflets overlap at player viewing distance.
        previous=(.27,6.84,0)
        for segment in range(7):
            t=(segment+1)/8
            distance=.20+(3.20+.48*math.sin(index*1.7))*t
            height=6.84+math.sin(t*math.pi)*(.35+.12*(index%3))-t*(1.05+.13*(index%3))
            current=(.27+distance*c,height,distance*s)
            tangent=(-s,c);across=(tangent[0]*.34,.94,tangent[1]*.34);half=.022
            _double_sided_blade(a,"PalmRachis",[
                (previous[0]-across[0]*half,previous[1]-.018-across[1]*half,previous[2]-across[2]*half),
                (current[0]-across[0]*half,current[1]-.018-across[1]*half,current[2]-across[2]*half),
                (current[0]+across[0]*half,current[1]+.018+across[1]*half,current[2]+across[2]*half),
                (previous[0]+across[0]*half,previous[1]+.018+across[1]*half,previous[2]+across[2]*half)])
            leaf_length=(.72+.18*math.sin(t*math.pi))*(1-.10*(index%2))
            leaf_width=.135+.035*math.sin(t*math.pi)
            _leaflet(a,angle, current, leaf_length, leaf_width, .10+.10*t, -1)
            _leaflet(a,angle, current, leaf_length*.92, leaf_width*.94, .12+.08*t, 1)
            previous=current
        # Two upright spear leaves fill the crown centre and stop the palm reading as a fan.
        if index<2:
            _leaflet(a,angle,previous,1.10,.16,.02,-1)
            _leaflet(a,angle,previous,1.04,.15,.04,1)
    for x,z in ((.10,.27),(.4,.19),(.25,-.25)): a.ico("Coconut",x,6.38,z,.20,.25,.20,WOOD)


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


def planter(a):
    # A kiln-coloured planter with a slightly inset soil tray, four feet and a double rim.
    a.box("Base",0,.07,0,1.84,.14,1.84,WOOD)
    a.box("Body",0,.50,0,1.96,.72,1.96,WOOD)
    a.box("BodyBand",0,.78,0,2.00,.07,2.00,WOOD)
    a.box("Soil",0,.83,0,1.70,.07,1.70,WOOD)
    for side in (-1,1):
        a.box("RimX",side*.94,.89,0,.12,.14,2,CREAM)
        a.box("RimZ",0,.89,side*.94,1.76,.14,.12,CREAM)
    for x,z in ((-.72,-.72),(.72,-.72),(-.72,.72),(.72,.72)):
        a.box("DrainageFoot",x,.19,z,.18,.24,.18,WOOD)
    # Stems and pointed broadleaf blades replace the old cluster of faceted balls. The blades
    # are duplicated back-to-back so they hold up from either side of the courtyard.
    for i in range(14):
        angle=i*2.39996+.17*math.sin(i*1.31)
        radius=.18+.055*(i%4);x,z=math.cos(angle)*radius,math.sin(angle)*radius
        height=1.17+.105*(i%5);length=.34+.105*((i*3)%7)/6
        a.cylinder("LeafStem",x,(.99+height)*.5,z,.018,height-.99,GREEN,6,.012)
        c,s=math.cos(angle),math.sin(angle);tangent=(-s,c);across=(tangent[0]*.35,.94,tangent[1]*.35)
        root=(x,height,z);tip=(x+c*length,height+.06+.04*(i%3),z+s*length)
        q1=(x+c*length*.30,height+.025,z+s*length*.30)
        q2=(x+c*length*.66,height+.045,z+s*length*.66)
        half=.075+.015*(i%3)
        _double_sided_polygon(a,"BroadLeaf",[
            (root[0]-.02*across[0],root[1]-.02*across[1],root[2]-.02*across[2]),
            (q1[0]-across[0]*half*.72,q1[1]-across[1]*half*.72,q1[2]-across[2]*half*.72),
            (q2[0]-across[0]*half,q2[1]-across[1]*half,q2[2]-across[2]*half),tip,
            (q2[0]+across[0]*half,q2[1]+across[1]*half,q2[2]+across[2]*half),
            (q1[0]+across[0]*half*.72,q1[1]+across[1]*half*.72,q1[2]+across[2]*half*.72)])
    # A few folded leaflets sit inside the stems, giving the planter volume when viewed
    # from the side and preventing the outer blades from reading as floating cards.
    for i in range(6):
        angle=i*math.tau/6+.35;radius=.12+.08*(i%2)
        a.ico("LeafCluster",math.cos(angle)*radius,1.24+.08*(i%3),math.sin(angle)*radius,.15,.27,.12,GREEN)
    # Six small soil pebbles break the perfectly flat top without introducing a texture.
    for i in range(6):
        angle=i*math.tau/6+.2;radius=.48+.05*(i%2)
        a.ico("SoilPebble",math.cos(angle)*radius, .93, math.sin(angle)*radius,.055,.035,.045,WOOD)


# LM_PROP_StreetLamp is now the photographic DBKL lamp: scripts/blender/furniture_models.py.
BUILDERS={"LM_PROP_PalmMamak":palm,"LM_PROP_BenchMamak":bench,"LM_PROP_PlanterMamak":planter}


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
        if name in ("LM_PROP_PalmMamak","LM_PROP_PlanterMamak"):
            obj["lm_foliage_version"]=3
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
