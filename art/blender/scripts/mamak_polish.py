"""Mamak-only geometry and a small Cycles counter AO/normal atlas.

The six-colour untextured calibration/prop/shop profiles remain unchanged.
"""
import json
import math
from pathlib import Path
import bpy
from lm_pipeline import ROOT, material, write_json, sha256

PROFILE = json.loads((ROOT / "mamak-profile.json").read_text())
COUNTER = "LM_ENV_MamakMaju_Counter"


def add_details(a, steel):
    # Existing collision envelope: counter x -42.5..-35.5, z 36.1..37.9.
    steel.box("BrushedWorktop", -39, 2.02, 37, 7.3, .14, 2.1, 0)
    steel.box("Splashback", -39, 2.19, 36.08, 7.2, .28, .06, 0)
    for x in (-42.25, -40.65, -39.05, -37.45, -35.85):
        a.box("CounterTileJoint", x, .98, 37.931, .025, 1.50, .012, 0)
    for y in (.42, .91, 1.89):
        a.box("CounterTileJoint", -39, y, 37.931, 6.95, .023, .012, 0)
    # Low open trays expose the food instead of putting lids over every dish.
    for i, x in enumerate((-41.8, -40.55, -39.30)):
        steel.box("TrayBase", x, 2.14, 37.35, 1.05, .08, .86, 0)
        for dz in (-.43, .43): steel.box("TrayLip", x, 2.22, 37.35+dz, 1.1, .15, .04, 0)
        for dx in (-.525, .525): steel.box("TrayLip", x+dx, 2.22, 37.35, .04, .15, .86, 0)
        a.box("CurrySurface", x, 2.19, 37.35, .98, .04, .77, (2, 1, 4)[i])
        for j in range(4):
            a.cylinder("LaukPortion", x-.27+(j%2)*.52, 2.25, 37.14+(j//2)*.4,
                       .15, .12, (1, 2, 4)[i], 7, .10)
        steel.box("ServingSpoon", x+.38, 2.31, 37.5, .065, .035, .58, 0)
    for x in (-37.85, -36.45):
        steel.cylinder("CurryPot", x, 2.30, 37, .44, .38, 0, 12)
        a.cylinder("PotLid", x, 2.51, 37, .46, .045, 0, 12, .28)
        a.cylinder("PotKnob", x, 2.57, 37, .09, .09, 2, 8)
        for dx in (-.51,.51): steel.box("PotHandle", x+dx, 2.36, 37, .16, .07, .16, 0)
    # Menu is geometry: legible at the counter, with no extra font download.
    a.box("MenuFrame", -33.9, 2.8, 34.84, 2.6, 3.45, .16, 2)
    a.box("MenuFace", -33.9, 2.8, 34.94, 2.40, 3.25, .055, 3)
    for label, y, height in (("MENU",4.10,.28),("ROTI CANAI",3.53,.18),
                             ("NASI KANDAR",3.03,.18),("TEH TARIK",2.53,.18),
                             ("KOPI O",2.03,.18),("BUKA 24 JAM",1.48,.17)):
        a.text("MenuLettering", label, -33.9, y, 34.975, 2.13, height, 0)
    # Shallow service frames, no new entrances through the solid building.
    for x in (-43.15,-35.0,-33.15,-25.0,-23.15,-15.0):
        a.box("ServiceFrame", x, 2.25, 34.80, .11, 3.18, .15, 2)
    a.box("CanopyGutter", -29, 4.64, 42.04, 31.2, .19, .20, 3)
    a.box("GutterInner", -29, 4.745, 42.04, 31.0, .025, .11, 2)
    for x in (-44.05,-13.95):
        a.cylinder("Downpipe", x, 2.35, 40.05, .055, 4.28, 3, 8)
        for y in (.70,2.1,3.5): a.box("PipeBracket", x, y, 40.05, .19, .07, .15, 3)
    # Small highlights at the tea station keep its silhouette readable.
    for i in range(4):
        x=-18.0+i*.48
        for layer in range(3): a.cylinder("CleanPlateStack",x,1.97+layer*.035,34.98,.19,.03,0,12)
    for x in (-17.8,-16.9):
        a.cylinder("CondimentBottle",x,2.15,35.06,.10,.35,1,8,.075)
        a.cylinder("BottleCap",x,2.35,35.06,.08,.045,0,8)


def make_counter(author):
    mesh=bpy.data.meshes.new(COUNTER+"_Mesh")
    mesh.from_pydata(author.vertices,[],author.faces)
    mesh.update()
    mat=material(PROFILE["counter_material"],"#B2BDB8",roughness=.43,metallic=.72)
    mat.use_fake_user=True
    mesh.materials.append(mat)
    obj=bpy.data.objects.new(COUNTER,mesh)
    bpy.data.collections["EXPORT"].objects.link(obj)
    for i,(name,start,count) in enumerate(author.parts):
        obj.vertex_groups.new(name=f"LM_PART_{i:03d}_{name}").add(list(range(start,start+count)),1,"REPLACE")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    # A single chamfer gives the actual silhouette an edge. The finer bevel is baked.
    bevel=obj.modifiers.new("LM_Counter_Silhouette","BEVEL")
    bevel.width=.012
    bevel.segments=1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    triangulate=obj.modifiers.new("LM_Counter_Triangulate","TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.025,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj["lm_asset_id"]=COUNTER
    obj["lm_bake_profile"]="cycles-counter-ao-normal-v1"
    return obj


def bake_counter(obj, output):
    config=PROFILE["bake"]
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=config["samples"]
    scene.cycles.seed=config["seed"]
    scene.cycles.use_adaptive_sampling=False
    scene.render.bake.margin=config["margin"]
    scene.render.bake.use_selected_to_active=False
    scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    mat=obj.data.materials[0]
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    bsdf=nodes["Principled BSDF"]
    output_node=next(n for n in nodes if n.type=="OUTPUT_MATERIAL")
    images={}
    for kind in ("AO","Normal"):
        img=bpy.data.images.new(f"LM_TEX_Counter_{kind}",width=config["resolution"],height=config["resolution"],alpha=False)
        img.colorspace_settings.name="Non-Color"
        node=nodes.new("ShaderNodeTexImage")
        node.name=f"LM_Baked_{kind}"
        node.image=img
        node.location=(-620,0 if kind=="AO" else -260)
        nodes.active=node
        if kind=="AO":
            ao=nodes.new("ShaderNodeAmbientOcclusion")
            ao.inputs["Distance"].default_value=config["ao_distance_m"]
            ao.samples=16
            emission=nodes.new("ShaderNodeEmission")
            links.new(ao.outputs["AO"],emission.inputs["Color"])
            links.new(emission.outputs[0],output_node.inputs["Surface"])
            bpy.ops.object.bake(type="EMIT")
            nodes.remove(ao)
            nodes.remove(emission)
            links.new(bsdf.outputs["BSDF"],output_node.inputs["Surface"])
        else:
            bevel=nodes.new("ShaderNodeBevel")
            bevel.inputs["Radius"].default_value=config["normal_bevel_m"]
            bevel.samples=8
            links.new(bevel.outputs["Normal"],bsdf.inputs["Normal"])
            bpy.ops.object.bake(type="NORMAL",normal_space="TANGENT")
            nodes.remove(bevel)
        target=Path(output)/"textures"/(img.name+".png")
        target.parent.mkdir(parents=True,exist_ok=True)
        img.filepath_raw=str(target)
        img.file_format="PNG"
        img.save()
        img.pack()
        pixels=list(img.pixels)
        values=[pixels[i] for i in range(0,len(pixels),4)]
        if max(values)-min(values) < .1:
            raise ValueError(f"Bake contains no useful variation: {kind}")
        images[kind]={"file":target.name,"sha256":sha256(target),"size":list(img.size),
                      "red_range":[min(values),max(values)]}
    # Exporter-recognised occlusion socket, separate from base colour/direct light.
    group=bpy.data.node_groups.new("glTF Material Output","ShaderNodeTree")
    group.interface.new_socket(name="Occlusion",in_out="INPUT",socket_type="NodeSocketFloat")
    group.nodes.new("NodeGroupInput")
    gltf=nodes.new("ShaderNodeGroup")
    gltf.node_tree=group
    links.new(nodes["LM_Baked_AO"].outputs["Color"],gltf.inputs["Occlusion"])
    normal=nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value=.6
    links.new(nodes["LM_Baked_Normal"].outputs["Color"],normal.inputs["Color"])
    links.new(normal.outputs["Normal"],bsdf.inputs["Normal"])
    # EEVEE preview uses normal shading; Three.js additionally applies glTF occlusion.
    scene.render.engine="BLENDER_EEVEE"
    write_json(Path(output)/"reports/baking.json",{"passed":True,"engine":"CYCLES","device":"CPU",
        "profile":config,"images":images,"direct_lighting_baked":False})
    return images
