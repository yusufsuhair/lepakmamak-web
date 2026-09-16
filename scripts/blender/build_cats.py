"""Build the authored LepakMamak companion cat rig.

The web client keeps a procedural fallback, but this GLB is the source of truth
for the higher-detail cat silhouette and the named animation pivots.
"""
import bpy
import math
import os
from mathutils import Vector


bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT = bpy.data.objects.new("LM_PET_Cat_Rig", None)
bpy.context.scene.collection.objects.link(ROOT)
ROOT["lm_pet_version"] = "cats-v1"
ROOT["lm_pet_actions"] = "walk,lie,play,jump,stretch,ear-flick,tail-curl"


def make_material(name, color, roughness=0.78, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if "Specular IOR Level" in principled.inputs:
        principled.inputs["Specular IOR Level"].default_value = 0.32
    return material


FUR = make_material("LM_PET_Fur", (0.69, 0.32, 0.12), 0.88)
FUR_DARK = make_material("LM_PET_Fur_Dark", (0.18, 0.08, 0.04), 0.9)
BELLY = make_material("LM_PET_Belly", (0.94, 0.74, 0.52), 0.92)
EAR = make_material("LM_PET_Ear", (0.89, 0.40, 0.37), 0.9)
EYE = make_material("LM_PET_Eye", (0.025, 0.018, 0.012), 0.12)
EYE_HIGHLIGHT = make_material("LM_PET_Eye_Highlight", (1.0, 0.98, 0.87), 0.08)
NOSE = make_material("LM_PET_Nose", (0.67, 0.20, 0.22), 0.42)
PAW = make_material("LM_PET_Paw", (0.76, 0.30, 0.32), 0.9)
WHISKER = make_material("LM_PET_Whisker", (0.94, 0.9, 0.78), 0.7)


def empty(name, location=(0.0, 0.0, 0.0), parent=ROOT):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.parent = parent
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    return obj


def finish_mesh(obj, material):
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.parent = ROOT
    obj.data.set_sharp_from_angle(angle=math.radians(45)) if hasattr(obj.data, "set_sharp_from_angle") else None
    return obj


def sphere(name, parent, location, scale, material, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def capsule(name, parent, location, radius, depth, material, rotation=(0, 0, 0), vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    bevel = obj.modifiers.new("soft edges", "BEVEL")
    bevel.width = radius * 0.72
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj


def cone(name, parent, location, radius, depth, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=radius, radius2=radius * 0.18, depth=depth, location=(0, 0, 0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def whisker(name, parent, location, rotation):
    return capsule(name, parent, location, 0.006, 0.30, WHISKER, rotation, 12)


body = empty("pet-body", (0.0, 0.47, 0.0))
chest = empty("pet-chest", (0.0, 0.53, 0.19), body)
head = empty("pet-head", (0.0, 0.92, 0.31))
neck = empty("pet-neck", (0.0, 0.65, 0.25), body)
tail = empty("pet-tail-base", (0.0, 0.48, -0.38), body)
tail_mid = empty("pet-tail-mid", (0.0, 0.14, -0.16), tail)
tail_tip = empty("pet-tail-tip", (0.0, 0.06, -0.15), tail_mid)

sphere("pet-body-shell", body, (0.0, 0.0, 0.0), (0.29, 0.27, 0.44), FUR, 40, 24)
sphere("pet-belly", body, (0.0, 0.02, 0.22), (0.235, 0.21, 0.25), BELLY, 32, 20)
sphere("pet-chest-fluff", chest, (0.0, 0.0, 0.0), (0.205, 0.22, 0.19), BELLY, 32, 20)
sphere("pet-neck-fur", neck, (0.0, 0.0, 0.0), (0.22, 0.20, 0.20), FUR, 32, 20)

sphere("pet-head-shell", head, (0.0, 0.0, 0.0), (0.31, 0.28, 0.27), FUR, 40, 24)
sphere("pet-cheek-l", head, (-0.13, -0.04, 0.20), (0.15, 0.14, 0.14), BELLY, 28, 18)
sphere("pet-cheek-r", head, (0.13, -0.04, 0.20), (0.15, 0.14, 0.14), BELLY, 28, 18)
sphere("pet-nose", head, (0.0, -0.01, 0.37), (0.045, 0.035, 0.035), NOSE, 24, 16)

for side, label in ((-1, "l"), (1, "r")):
    sphere(f"pet-eye-{label}", head, (side * 0.115, 0.075, 0.278), (0.047, 0.052, 0.026), EYE, 24, 16)
    sphere(f"pet-eye-glint-{label}", head, (side * 0.102, 0.101, 0.299), (0.012, 0.014, 0.008), EYE_HIGHLIGHT, 16, 12)
    ear = empty(f"pet-ear-{label}", (side * 0.18, 0.21, 0.0), head)
    cone(f"pet-ear-shell-{label}", ear, (0.0, 0.0, 0.0), 0.14, 0.31, FUR, (0.0, 0.0, side * -0.18))
    cone(f"pet-ear-inner-{label}", ear, (0.0, -0.01, 0.026), 0.07, 0.18, EAR, (0.0, 0.0, side * -0.18))
    whisker(f"pet-whisker-upper-{label}", head, (side * 0.15, -0.03, 0.28), (0.0, side * 0.35, side * 0.18))
    whisker(f"pet-whisker-lower-{label}", head, (side * 0.15, -0.09, 0.27), (0.0, side * 0.30, side * -0.18))

for x, x_label in ((-1, "l"), (1, "r")):
    for z, z_label in ((-1, "b"), (1, "f")):
        leg = empty(f"pet-leg-{z_label}{x_label}", (x * 0.18, 0.25, z * 0.26), body)
        capsule(f"pet-leg-shin-{z_label}{x_label}", leg, (0.0, -0.16, 0.0), 0.065, 0.31, FUR, rotation=(0.0, 0.0, 0.0), vertices=18)
        paw = empty(f"pet-paw-{z_label}{x_label}", (0.0, -0.32, 0.05), leg)
        sphere(f"pet-paw-shell-{z_label}{x_label}", paw, (0.0, 0.0, 0.0), (0.10, 0.055, 0.14), BELLY, 24, 16)
        sphere(f"pet-paw-pad-{z_label}{x_label}", paw, (0.0, -0.035, 0.085), (0.045, 0.012, 0.058), PAW, 20, 14)

for parent, name, location, scale, rotation in (
    (tail, "pet-tail-segment-base", (0.0, 0.0, -0.06), (0.085, 0.10, 0.18), (0.30, 0.0, 0.0)),
    (tail_mid, "pet-tail-segment-mid", (0.0, 0.0, -0.06), (0.075, 0.09, 0.16), (0.52, 0.0, 0.0)),
    (tail_tip, "pet-tail-segment-tip", (0.0, 0.0, -0.055), (0.062, 0.075, 0.13), (0.72, 0.0, 0.0)),
):
    sphere(name, parent, location, scale, FUR, 28, 18).rotation_euler = rotation

# Keep the exported file free of Blender-only helpers and lights.
for obj in list(bpy.context.scene.objects):
    if obj.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.context.view_layer.objects.active = ROOT
ROOT.select_set(True)
for obj in bpy.context.selected_objects:
    if obj != ROOT:
        obj.select_set(False)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.world = bpy.data.worlds.new("LM_PET_World")
scene.world.color = (0.03, 0.06, 0.05)
scene["lm_pet_asset"] = "LepakMamak hyper-detail companion cat"

output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "public", "assets", "models", "pets")
blend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "pets")
os.makedirs(output_dir, exist_ok=True)
os.makedirs(blend_dir, exist_ok=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, "LM_PET_Cats.blend"))
bpy.ops.export_scene.gltf(filepath=os.path.join(output_dir, "LM_PET_Cats.glb"), export_format="GLB", export_materials="EXPORT", use_selection=False)
print("Exported authored cat rig to", output_dir)
