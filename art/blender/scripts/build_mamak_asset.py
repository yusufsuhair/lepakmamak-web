"""Build the first real LepakMamak environment asset from simple authored primitives."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from lm_pipeline import (ROOT, setup_template, save_source, validate_scene,
                         export_collection, render_previews, write_json, sha256, point_at)


ASSET = "LM_ENV_MamakMaju"


def cuboid(vertices, faces, materials, x, y, z, width, height, depth, material_index):
    """Append a cuboid using game-friendly arguments: x, vertical, depth."""
    base = len(vertices)
    hx, hy, hz = width / 2, height / 2, depth / 2
    # Blender is Z-up. The script's second argument is vertical while the third is depth;
    # swapping those coordinates here keeps the authoring calls easy to read.
    vertices.extend([
        (x - hx, z - hz, y - hy), (x + hx, z - hz, y - hy),
        (x + hx, z + hz, y - hy), (x - hx, z + hz, y - hy),
        (x - hx, z - hz, y + hy), (x + hx, z - hz, y + hy),
        (x + hx, z + hz, y + hy), (x - hx, z + hz, y + hy),
    ])
    for face in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
                 (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        faces.append((tuple(base + index for index in face), material_index))


def build_mesh():
    vertices, faces = [], []
    # The proportions fit the existing Mamak Maju footprint: 30 m wide, 12 m deep.
    WALL, ROOF, WOOD, METAL = range(4)
    cuboid(vertices, faces, None, 0, .12, -1.5, 30.8, .24, 11.6, WALL)  # paving floor
    cuboid(vertices, faces, None, 0, 4.55, -5.15, 30, 8.9, .55, WALL)  # rear wall
    cuboid(vertices, faces, None, -14.7, 4.55, -1.5, .6, 8.9, 11.6, WALL)
    cuboid(vertices, faces, None, 14.7, 4.55, -1.5, .6, 8.9, 11.6, WALL)
    cuboid(vertices, faces, None, 0, 8.95, -1.5, 31.2, .35, 12.2, WOOD)  # eave
    cuboid(vertices, faces, None, 0, 9.5, -1.5, 30.3, .45, 11.4, ROOF)
    cuboid(vertices, faces, None, 0, 9.84, -1.5, 8, .22, 11.1, WOOD)  # ridge highlight

    # Open service front: dark windows, a serving counter and a broad green fascia.
    cuboid(vertices, faces, None, 0, 7.55, .9, 27.5, 2.2, .12, METAL)
    cuboid(vertices, faces, None, -9.2, 7.55, 1.02, .18, 2.2, .18, WOOD)
    cuboid(vertices, faces, None, 0, 7.55, 1.02, .18, 2.2, .18, WOOD)
    cuboid(vertices, faces, None, 9.2, 7.55, 1.02, .18, 2.2, .18, WOOD)
    cuboid(vertices, faces, None, 0, 5.45, 1.0, 29.4, .9, .16, WOOD)
    cuboid(vertices, faces, None, 0, 4.78, .65, 18.8, .14, .16, ROOF)
    cuboid(vertices, faces, None, 0, 4.45, .55, 20.5, 1.4, .22, METAL)  # fascia/sign panel
    cuboid(vertices, faces, None, 0, 1.65, 1.5, 17, 1.8, 1.15, WOOD)
    cuboid(vertices, faces, None, 0, 2.6, 2.06, 17.4, .12, 1.25, ROOF)

    # Alternating canopy strips give the silhouette seen in the existing world.
    for index, x in enumerate(range(-13, 14, 3)):
        cuboid(vertices, faces, None, x, 6.25, 2.15, 1.95, .16, 3.0, ROOF if index % 2 == 0 else WALL)
        cuboid(vertices, faces, None, x, 5.55, 3.53, 1.95, .72, .12, ROOF if index % 2 == 0 else WALL)
    for x in (-13.5, 13.5):
        cuboid(vertices, faces, None, x, 3.4, 2.4, .25, 6.6, .25, WOOD)

    # Three front tables and red plastic chairs make the asset read as a social place.
    for table_x in (-10, 0, 10):
        cuboid(vertices, faces, None, table_x, 1.28, 5.0, 4.2, .18, 2.0, WOOD)
        cuboid(vertices, faces, None, table_x, .65, 5.0, .18, 1.25, .18, METAL)
        for chair_x, chair_z in ((table_x - 2.6, 5), (table_x + 2.6, 5), (table_x, 7.1)):
            cuboid(vertices, faces, None, chair_x, .72, chair_z, 1.25, .16, 1.25, ROOF)
            cuboid(vertices, faces, None, chair_x, 1.36, chair_z + .5, 1.25, 1.0, .14, ROOF)
            cuboid(vertices, faces, None, chair_x, .35, chair_z, .12, .7, .12, METAL)

    # Warm sign blocks, lanterns and small planters keep the front readable at game distance.
    cuboid(vertices, faces, None, 0, 5.02, 1.18, 20.5, 1.6, .18, WOOD)
    cuboid(vertices, faces, None, -11, 3.45, 1.22, 1.1, 1.2, .16, ROOF)
    cuboid(vertices, faces, None, 11, 3.45, 1.22, 1.1, 1.2, .16, ROOF)
    for x in (-12.5, 12.5):
        cuboid(vertices, faces, None, x, .58, 4.0, 1.1, 1.0, 1.1, WOOD)
        cuboid(vertices, faces, None, x, 1.35, 4.0, .7, .4, .7, WALL)

    mesh = bpy.data.meshes.new(f"{ASSET}_Mesh")
    mesh.from_pydata(vertices, [], [face for face, _ in faces])
    # Authoring calls use positive depth for the service side, while the web contract
    # defines Blender -Y as forward so glTF/Three.js receives +Z forward. Mirror the mesh
    # into that canonical orientation and repair the winding before export.
    for vertex in mesh.vertices:
        vertex.co.y *= -1
    mesh.flip_normals()
    mesh.update()
    obj = bpy.data.objects.new(ASSET, mesh)
    bpy.data.collections["EXPORT"].objects.link(obj)
    for name in ("LM_Wall_Cream", "LM_Roof_Red", "LM_Wood_Warm", "LM_Metal_Dark"):
        mesh.materials.append(bpy.data.materials[name])
    for polygon, (_, material_index) in zip(mesh.polygons, faces):
        polygon.material_index = material_index
    uv = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            uv.data[loop_index].uv = (0, 0)
    obj["lm_asset_id"] = ASSET
    obj["lm_footprint_m"] = [30.8, 11.6]
    obj["lm_forward"] = "Blender -Y / glTF +Z: open service front"
    # Match the scale-test collection topology, so collection filtering is exercised here too.
    nested = bpy.data.collections.new("LM_EXPORT_Geometry")
    bpy.data.collections["EXPORT"].children.link(nested)
    bpy.data.collections["EXPORT"].objects.unlink(obj)
    nested.objects.link(obj)
    return obj


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--skip-renders", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    output = args.output.resolve()
    if output.exists() and any(output.iterdir()):
        raise RuntimeError(f"Output is nonempty: {output}")
    output.mkdir(parents=True, exist_ok=True)
    setup_template()
    build_mesh()
    source = output / "source" / f"{ASSET}.blend"
    save_source(source)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    # The environment facade is larger than a one-prop calibration asset. It still remains
    # deliberately small for mobile: 1,000 evaluated triangles, four draws and 128 KiB.
    result = export_collection(output / "exports" / f"{ASSET}.glb", budget_overrides={"max_glb_bytes": 131072})
    if not args.skip_renders:
        scene = bpy.context.scene
        targets = {"Iso": (34, -44, 28), "Front": (0, -46, 5), "Right": (46, 0, 5), "Top": (0, 0, 46)}
        for angle, location in targets.items():
            camera = bpy.data.objects[f"LM_PREVIEW_{angle}_Camera"]
            camera.location = location
            camera.data.ortho_scale = 40
            point_at(camera, (0, 0, 4))
        for name, (location, energy) in {"Key": ((20, -30, 25), 3000), "Fill": ((-20, -12, 14), 1800), "Rim": ((0, 24, 18), 2200)}.items():
            light = bpy.data.objects[f"LM_PREVIEW_{name}"]
            light.location = location
            light.data.energy = energy
            point_at(light, (0, 0, 3))
        render_previews(output / "previews", asset_name=ASSET)
    write_json(output / "reports" / "validation.json", result)
    write_json(output / "reports" / "manifest.json", {
        "asset": ASSET, "blender_version": bpy.app.version_string,
        "config_sha256": sha256(ROOT / "config.json"),
        "script_sha256": sha256(Path(__file__)), "glb_sha256": result["glb"]["sha256"],
    })
    print("LM_MAMAK_ASSET_PASS", result)


if __name__ == "__main__":
    main()
