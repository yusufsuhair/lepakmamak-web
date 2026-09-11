"""Blender 5.2 LTS static web-asset contract. No third-party Python packages."""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "config.json").read_text())
ASSET = CONFIG["asset_name"]


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require_version():
    if list(bpy.app.version[:2]) != CONFIG["blender_version"]:
        raise RuntimeError(f"Requires Blender 5.2 LTS; found {bpy.app.version_string}")


def linear_rgba(hex_color):
    rgb = [int(hex_color.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb) + (1.0,)


def material(name, color, roughness=0.8, metallic=0.0, shared=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_fake_user = shared
    mat.diffuse_color = linear_rgba(color)
    mat.use_backface_culling = True
    mat.node_tree.nodes.clear()
    bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "Principled BSDF"
    bsdf.inputs["Base Color"].default_value = mat.diffuse_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = 1.0
    output = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (320, 0)
    mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def link_object(name, data, collection):
    obj = bpy.data.objects.new(name, data)
    bpy.data.collections[collection].objects.link(obj)
    return obj


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_template():
    require_version()
    # This function is called only in a separate --background process.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "LM_SCENE_WebAsset"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.system_rotation = "DEGREES"
    scene.render.fps = 30
    scene.frame_start = scene.frame_end = 1
    scene.frame_set(1)
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = CONFIG["preview"]["samples"]
    scene.render.resolution_x = scene.render.resolution_y = CONFIG["preview"]["resolution"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.render.dither_intensity = 0
    # Blender otherwise embeds date, render duration and absolute .blend paths in PNGs.
    for prop in scene.render.bl_rna.properties:
        if prop.identifier.startswith("use_stamp") and prop.type == "BOOLEAN":
            setattr(scene.render, prop.identifier, False)
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene["lm_pipeline_version"] = CONFIG["pipeline_version"]
    scene["lm_coordinates"] = "meters; Blender +Z up, -Y forward => glTF +Y up, +Z forward"
    for name in CONFIG["collections"]:
        scene.collection.children.link(bpy.data.collections.new(name))
    for name, props in CONFIG["palette"].items():
        material(name, props["hex"], props["roughness"], props["metallic"], shared=True)

    world = bpy.data.worlds.new("LM_WORLD_Preview")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.22, 0.25, 0.3, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
    scene.world = world
    for name, location, energy, size in [
        ("Key", (3, -4, 6), 450, 4),
        ("Fill", (-4, -1, 3), 180, 5),
        ("Rim", (1, 4, 5), 300, 3),
    ]:
        data = bpy.data.lights.new(f"LM_PREVIEW_{name}_Light", "AREA")
        data.energy, data.shape, data.size = energy, "DISK", size
        obj = link_object(f"LM_PREVIEW_{name}", data, "LIGHTING_PREVIEW")
        obj.location = location
        point_at(obj, (0, 0, 0.5))
    cameras = {
        "Iso": (2.6, -3.6, 2.6), "Front": (0, -5, 0.5),
        "Right": (5, 0, 0.5), "Top": (0, 0, 6),
    }
    for name, location in cameras.items():
        data = bpy.data.cameras.new(f"LM_PREVIEW_{name}_CameraData")
        data.type, data.ortho_scale = "ORTHO", 2.6
        data.clip_start, data.clip_end = 0.01, 100
        obj = link_object(f"LM_PREVIEW_{name}_Camera", data, "LIGHTING_PREVIEW")
        obj.location = location
        point_at(obj, (0, 0, 0.5))
    scene.camera = bpy.data.objects["LM_PREVIEW_Iso_Camera"]
    floor_mat = material("LM_PREVIEW_Ground", "#D9DCE0")
    mesh = bpy.data.meshes.new("LM_PREVIEW_Ground_Mesh")
    mesh.from_pydata([(-200, -200, -0.006), (200, -200, -0.006), (200, 200, -0.006), (-200, 200, -0.006)], [], [(0, 1, 2, 3)])
    floor = link_object("LM_PREVIEW_Ground", mesh, "LIGHTING_PREVIEW")
    floor.data.materials.append(floor_mat)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children["EXPORT"]
    # Save an immediately useful camera-framed workspace.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.clip_start = 0.01
    bpy.context.preferences.filepaths.save_version = 0
    return scene


def make_scale_asset():
    # Geometry is baked around a base-center origin; all object transforms identity.
    vertices = [(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0),
                (-.5, -.5, 1), (.5, -.5, 1), (.5, .5, 1), (-.5, .5, 1)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh = bpy.data.meshes.new(f"{ASSET}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = link_object(ASSET, mesh, "EXPORT")
    for name in ("LM_Wall_Cream", "LM_Leaf_Green", "LM_Plastic_Red"):
        mesh.materials.append(bpy.data.materials[name])
    uv = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        polygon.material_index = 1 if polygon.index == 2 else 2 if polygon.index == 3 else 0
        for index, loop_index in enumerate(polygon.loop_indices):
            uv.data[loop_index].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][index]
    obj["lm_asset_id"] = ASSET
    obj["lm_dimensions_m"] = [1.0, 1.0, 1.0]
    obj["lm_forward"] = "Blender -Y / glTF +Z: green face; +X: red face"
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.context.view_layer.update()
    # A nested export collection exercises recursive collection filtering.
    nested = bpy.data.collections.new("LM_EXPORT_Geometry")
    bpy.data.collections["EXPORT"].children.link(nested)
    bpy.data.collections["EXPORT"].objects.unlink(obj)
    nested.objects.link(obj)
    return obj


def add_scale_guides():
    ink = material("LM_PREVIEW_Ink", "#4C5B65")
    def line(name, points, radius=.002):
        curve = bpy.data.curves.new(f"LM_GUIDE_{name}_Curve", "CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth, curve.bevel_resolution = radius, 0
        spline = curve.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for point, coordinate in zip(spline.points, points):
            point.co = (*coordinate, 1)
        obj = link_object(f"LM_GUIDE_{name}", curve, "REFERENCE")
        curve.materials.append(ink)
        return obj
    line("MeterX", [(-.5, -.73, .002), (.5, -.73, .002)])
    for index in range(11):
        x = -.5 + index / 10
        length = .06 if index % 5 == 0 else .03
        line(f"Tick{index:02d}", [(x, -.73 - length, .002), (x, -.73 + length, .002)])
    text = bpy.data.curves.new("LM_GUIDE_MeterLabel_Text", "FONT")
    text.body, text.align_x, text.size = "1 m / 10 cm ticks", "CENTER", .095
    label = link_object("LM_GUIDE_MeterLabel", text, "REFERENCE")
    label.location = (0, -.98, .003)
    text.materials.append(ink)
    guide = link_object("LM_GUIDE_CollisionBounds", None, "COLLISION_GUIDES")
    guide.empty_display_type = "CUBE"
    guide.empty_display_size = .5
    guide.location.z = .5
    guide.hide_render = True


def validate_scene(scale_test=False, allow_empty=False):
    """Fail closed for the initial opaque, unrigged, untextured static-mesh profile."""
    require_version()
    errors = []
    def check(condition, message):
        if not condition:
            errors.append(message)
    scene = bpy.context.scene
    check(scene.unit_settings.system == "METRIC" and scene.unit_settings.length_unit == "METERS" and scene.unit_settings.scale_length == 1, "Units must be metric, meters, scale 1")
    check(set(CONFIG["collections"]).issubset(c.name for c in scene.collection.children), "Missing required top-level collections")
    check(all(name in bpy.data.materials and bpy.data.materials[name].use_fake_user for name in CONFIG["palette"]), "Shared palette must be preserved with fake users")
    collection = bpy.data.collections.get("EXPORT")
    objects = sorted(collection.all_objects, key=lambda obj: obj.name) if collection else []
    check(bool(objects) or allow_empty, "EXPORT collection is empty")
    materials, triangles, mesh_count = set(), 0, 0
    bounds = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        check(bool(re.fullmatch(r"LM_[A-Za-z0-9_]+", obj.name)), f"Invalid or nondeterministic object name: {obj.name}")
        check(obj.type in {"MESH", "EMPTY"}, f"Unsupported export type: {obj.name} ({obj.type})")
        check(not obj.hide_render and obj.visible_get(), f"Hidden export object: {obj.name}")
        check(obj.parent is None or obj.parent in objects, f"Parent outside EXPORT: {obj.name}")
        check(not obj.constraints and not obj.animation_data, f"Animation/constraints require a separate profile: {obj.name}")
        check(all(abs(s - 1) < 1e-6 for s in obj.scale) and all(abs(r) < 1e-6 for r in obj.rotation_euler) and obj.rotation_mode == "XYZ", f"Apply rotation and scale: {obj.name}")
        check(all(math.isfinite(v) for row in obj.matrix_world for v in row), f"Nonfinite transform: {obj.name}")
        if obj.type != "MESH":
            check(obj.instance_type == "NONE", f"Collection instances require realization: {obj.name}")
            continue
        mesh_count += 1
        check(bool(re.fullmatch(r"LM_[A-Za-z0-9_]+", obj.data.name)), f"Invalid mesh name: {obj.data.name}")
        check(obj.data.shape_keys is None, f"Shape keys require a separate profile: {obj.name}")
        check(bool(obj.data.uv_layers.active), f"Missing UVs: {obj.name}")
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
            check(len(mesh.loop_triangles) > 0, f"Empty geometry: {obj.name}")
            check(all(t.area > 1e-10 for t in mesh.loop_triangles), f"Degenerate triangles: {obj.name}")
            check(bool(mesh.uv_layers.active), f"Missing UVs: {obj.name}")
            if mesh.uv_layers.active:
                check(all(math.isfinite(v) for uv in mesh.uv_layers.active.data for v in uv.uv), f"Nonfinite UVs: {obj.name}")
            check(all(math.isfinite(c) for v in mesh.vertices for c in v.co), f"Nonfinite vertices: {obj.name}")
            check(all(p.material_index < len(mesh.materials) and mesh.materials[p.material_index] is not None for p in mesh.polygons), f"Missing material slot: {obj.name}")
            for p in mesh.polygons:
                if p.material_index < len(mesh.materials) and mesh.materials[p.material_index]:
                    materials.add(mesh.materials[p.material_index].name)
            bounds.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    for name in sorted(materials):
        mat = bpy.data.materials[name]
        check(name in CONFIG["palette"], f"Material is not in shared palette: {name}")
        check(mat.use_nodes, f"Material requires nodes: {name}")
        if not mat.use_nodes:
            continue
        nodes = list(mat.node_tree.nodes)
        bsdfs = [n for n in nodes if n.type == "BSDF_PRINCIPLED"]
        check(len(nodes) == 2 and len(bsdfs) == 1 and any(n.type == "OUTPUT_MATERIAL" for n in nodes), f"Only simple Principled BSDF + Output supported: {name}")
        if len(bsdfs) == 1:
            bsdf = bsdfs[0]
            check(bsdf.inputs["Alpha"].default_value == 1 and bsdf.inputs["Base Color"].default_value[3] == 1, f"Opaque alpha required: {name}")
            check(bsdf.inputs["Transmission Weight"].default_value == 0, f"Transmission not in mobile profile: {name}")
            check(len(mat.node_tree.links) == 1 and any(l.from_node == bsdf and l.to_node.type == "OUTPUT_MATERIAL" and l.to_socket.name == "Surface" for l in mat.node_tree.links), f"Invalid surface connection: {name}")
        check(mat.use_backface_culling, f"Single-sided material required: {name}")
    budget = CONFIG["budgets"]
    check(triangles <= budget["max_triangles"], "Triangle budget exceeded")
    check(mesh_count <= budget["max_meshes"], "Mesh budget exceeded")
    check(mesh_count > 0 or allow_empty, "EXPORT requires at least one mesh")
    check(len(materials) <= budget["max_materials"], "Material budget exceeded")
    bbox = None
    if bounds:
        minimum = [min(p[i] for p in bounds) for i in range(3)]
        maximum = [max(p[i] for p in bounds) for i in range(3)]
        bbox = {"min": minimum, "max": maximum, "size": [maximum[i] - minimum[i] for i in range(3)]}
        check(abs(minimum[2]) < 1e-5, "Asset must rest on Z=0")
        if scale_test:
            check(len(objects) == 1 and objects[0].name == ASSET, "Scale test must contain exactly the named cube")
            check(all(abs(n - 1) < 1e-5 for n in bbox["size"]), "Scale test must measure exactly 1 x 1 x 1 meters")
            check(all(abs(n) < 1e-5 for n in objects[0].matrix_world.translation), "Scale-test origin must be at world zero")
            check(all(abs(minimum[i] + .5) < 1e-5 for i in (0, 1)), "Scale-test origin must be base-center")
    result = {"passed": not errors, "errors": errors, "blender_version": bpy.app.version_string,
              "objects": [obj.name for obj in objects], "mesh_count": mesh_count,
              "triangles": triangles, "materials": sorted(materials), "bounds_blender_m": bbox,
              "budgets": budget, "profile": "scale-test" if scale_test else "static-palette"}
    if errors:
        raise ValueError(json.dumps(result, indent=2))
    return result


def export_collection(path, scale_test=False):
    result = validate_scene(scale_test=scale_test)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise ValueError(f"Output already exists: {path}")
    # Export and verify in staging; failed exports never become accepted artifacts.
    with tempfile.TemporaryDirectory(prefix=".staging-", dir=path.parent) as directory:
        staged = Path(directory) / path.name
        result = _export_validated(staged, result)
        staged.replace(path)
    return result


def _export_validated(path, result):
    # Named collection filtering includes descendants; selection and active UI state are irrelevant.
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", collection="EXPORT",
        use_selection=False, use_active_collection=False, export_yup=True,
        export_apply=True, export_texcoords=True, export_normals=True,
        export_materials="EXPORT", export_cameras=False, export_lights=False,
        export_animations=False, export_extras=True, export_attributes=False,
        export_draco_mesh_compression_enable=False)
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data)
    if (magic, version, length) != (0x46546C67, 2, len(data)):
        raise ValueError("Invalid GLB header")
    chunk_size, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("GLB JSON chunk missing")
    document = json.loads(data[20:20 + chunk_size])
    exported_names = sorted(node["name"] for node in document.get("nodes", []))
    if exported_names != result["objects"]:
        raise ValueError(f"EXPORT collection boundary mismatch: {exported_names}")
    if document.get("cameras") or document.get("animations") or document.get("skins") or document.get("textures") or "KHR_lights_punctual" in document.get("extensionsUsed", []):
        raise ValueError("Unexpected camera/light/animation/skin/texture in static GLB")
    if len(data) > CONFIG["budgets"]["max_glb_bytes"]:
        raise ValueError("GLB byte budget exceeded")
    primitives = sum(len(document["meshes"][node["mesh"]]["primitives"]) for node in document.get("nodes", []) if "mesh" in node)
    if primitives > CONFIG["budgets"]["max_draw_calls"]:
        raise ValueError("GLB draw-call budget exceeded")
    result["glb"] = {"bytes": len(data), "sha256": sha256(path), "nodes": exported_names,
                     "primitives": primitives}
    return result


def render_previews(output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    for angle in ("Iso", "Front", "Right", "Top"):
        scene.camera = bpy.data.objects[f"LM_PREVIEW_{angle}_Camera"]
        scene.render.filepath = str(output / f"{ASSET}_{angle.lower()}.png")
        bpy.ops.render.render(write_still=True)
    scene.camera = bpy.data.objects["LM_PREVIEW_Iso_Camera"]


def save_source(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path), check_existing=False, compress=True)
