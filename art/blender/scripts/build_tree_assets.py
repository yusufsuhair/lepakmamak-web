"""Deterministic, opaque low-poly trees for LepakMamak's Three.js world.

Now builds only the compact Mamak courtyard palm. The city rain tree and coconut palm moved to
the photographic, textured pipeline in scripts/blender/build_trees.py (foliage version 5).

Each family is authored independently, saved as an editable .blend, exported from
EXPORT only and rendered from four review angles.  Geometry is intentionally
texture-free so repeated trees remain cheap and predictable on mobile GPUs.
"""
import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
import bmesh
from mathutils import Vector

from build_mamak_asset import Author, ORIGIN, PALETTE, CREAM, WOOD, GREEN
from lm_pipeline import setup_template, save_source, export_collection, render_previews, point_at, write_json, sha256


BUDGET = {
    "max_triangles": 1800,
    "max_materials": 3,
    "max_draw_calls": 3,
    "max_glb_bytes": 131072,
    "allow_double_sided_materials": ["LM_Leaf_Green"],
}


class TreeAuthor(Author):
    """Local-origin variant of the proven merged Mamak mesh author."""

    def add(self, name, points, faces, material, closed=True):
        super().add(name, [(x + ORIGIN[0], y, z + ORIGIN[2]) for x, y, z in points], faces, material, closed)

    def ico(self, name, x, y, z, rx, ry, rz, material=GREEN, subdivisions=1):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1)
        bm.verts.ensure_lookup_table()
        bm.verts.index_update()
        self.add(name,
                 [(x + v.co.x * rx, y + v.co.y * ry, z + v.co.z * rz) for v in bm.verts],
                 [tuple(v.index for v in face.verts) for face in bm.faces], material)
        bm.free()

    def branch(self, name, start, end, radius_start, radius_end, material=WOOD, segments=7):
        """Tapered faceted branch between arbitrary points, merged into the asset."""
        a, b = Vector(start), Vector(end)
        direction = (b - a).normalized()
        reference = Vector((0, 1, 0)) if abs(direction.y) < .92 else Vector((1, 0, 0))
        u = direction.cross(reference).normalized()
        v = direction.cross(u).normalized()
        points = []
        for centre, radius in ((a, radius_start), (b, radius_end)):
            for index in range(segments):
                angle = index * math.tau / segments
                p = centre + (u * math.cos(angle) + v * math.sin(angle)) * radius
                points.append(tuple(p))
        faces = [tuple(range(segments - 1, -1, -1)), tuple(range(segments, segments * 2))]
        faces.extend((i, (i + 1) % segments, (i + 1) % segments + segments, i + segments)
                     for i in range(segments))
        # The basis can flip winding for some directions. Geometry remains closed and
        # normals are recalculated by Blender, so skip Author's signed-volume assertion.
        self.add(name, points, faces, material, closed=False)

    def finish_tree(self, name, family):
        mesh = bpy.data.meshes.new(name + "_Mesh")
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update(calc_edges=True)
        for material in PALETTE:
            mesh.materials.append(bpy.data.materials[material])
        for polygon, material in zip(mesh.polygons, self.materials):
            polygon.material_index = material
            polygon.use_smooth = False
        uv = mesh.uv_layers.new(name="UVMap")
        for polygon in mesh.polygons:
            axes = sorted(range(3), key=lambda axis: abs(polygon.normal[axis]))[:2]
            for loop_index in polygon.loop_indices:
                vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (vertex[axes[0]], vertex[axes[1]])
        obj = bpy.data.objects.new(name, mesh)
        bpy.data.collections["EXPORT"].objects.link(obj)
        for index, (part, start, count) in enumerate(self.parts):
            obj.vertex_groups.new(name=f"LM_PART_{index:03d}_{part}").add(
                list(range(start, start + count)), 1, "REPLACE")
        obj["lm_asset_id"] = name
        obj["lm_family"] = family
        obj["lm_foliage_version"] = 4
        obj["lm_origin"] = "base center, meters, Blender -Y / glTF +Z forward"
        obj["lm_part_count"] = len(self.parts)
        return obj


def mamak_palm(a):
    """Compact courtyard palm: dense crown, narrower reach and warmer trunk rings."""
    for index in range(6):
        y = .51 + index * 1.02
        radius = .235 - index * .018
        a.cylinder("Trunk", .045 * index, y, 0, radius, 1.02, WOOD, 8, max(radius - .015, .12))
        a.cylinder("TrunkRing", .045 * index, y + .47, 0, radius + .012, .055, CREAM, 8)
    crown = (.27, 6.62, 0)
    a.ico("CrownSheath", *crown, .39, .52, .39, GREEN)
    for frond in range(9):
        angle = frond * math.tau / 9 + .10 * math.sin(frond * 2.7)
        c, s = math.cos(angle), math.sin(angle)
        previous = (.27, 6.84, 0)
        for segment in range(6):
            t = (segment + 1) / 7
            distance = .20 + (3.05 + .38 * math.sin(frond * 1.7)) * t
            current = (.27 + distance * c,
                       6.84 + math.sin(t * math.pi) * (.34 + .08 * (frond % 3)) - t * (1.0 + .1 * (frond % 3)),
                       distance * s)
            a.branch("Rachis", previous, current, .038, .026, GREEN, 5)
            tangent = Vector((-s, 0, c))
            root = Vector(current)
            length = .68 + .18 * math.sin(t * math.pi)
            for side in (-1, 1):
                tip = root + Vector((c, -.10 - .08 * t, s)) * length + tangent * side * .14
                mid = root.lerp(tip, .54) + Vector((0, .055, 0))
                half = .085 + .018 * math.sin(t * math.pi)
                points = [tuple(root), tuple(mid + tangent * half), tuple(tip), tuple(mid - tangent * half)]
                a.add("Leaflet", points, [(0, 1, 2), (0, 2, 3)], GREEN, False)
            previous = current
    for x, z in ((.10, .27), (.40, .19), (.25, -.25)):
        a.ico("Coconut", x, 6.38, z, .20, .25, .20, WOOD)


BUILDERS = {
    "LM_PROP_PalmMamak": ("mamak-courtyard-palm", mamak_palm),
}


def frame_preview(obj):
    bpy.context.view_layer.update()
    dims = obj.dimensions
    target = (0, 0, dims.z * .48)
    size = max(dims) * 1.42
    for angle, position in {
        "Iso": (size, -size, size * .75),
        "Front": (0, -size, dims.z * .52),
        "Right": (size, 0, dims.z * .52),
        "Top": (0, 0, size),
    }.items():
        camera = bpy.data.objects[f"LM_PREVIEW_{angle}_Camera"]
        camera.location = position
        camera.data.ortho_scale = size
        point_at(camera, target)
    for name, position, energy in (("Key", (7, -9, 13), 1700), ("Fill", (-7, -4, 8), 900), ("Rim", (1, 8, 11), 1300)):
        light = bpy.data.objects[f"LM_PREVIEW_{name}"]
        light.location = position
        light.data.energy = energy
        light.data.size = 6
        point_at(light, target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--asset", choices=tuple(BUILDERS))
    parser.add_argument("--skip-renders", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    output = args.output.resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError("Use an empty output directory")
    output.mkdir(parents=True, exist_ok=True)
    chosen = [args.asset] if args.asset else list(BUILDERS)
    results = {}
    for name in chosen:
        family, builder = BUILDERS[name]
        setup_template()
        bpy.data.materials["LM_Leaf_Green"].use_backface_culling = "Palm" not in name
        author = TreeAuthor()
        builder(author)
        obj = author.finish_tree(name, family)
        frame_preview(obj)
        source = output / "source" / f"{name}.blend"
        save_source(source)
        bpy.ops.wm.open_mainfile(filepath=str(source))
        results[name] = export_collection(output / "exports" / f"{name}.glb", budget_overrides=BUDGET)
        results[name]["source_sha256"] = sha256(source)
        if not args.skip_renders:
            render_previews(output / "previews", asset_name=name)
    write_json(output / "reports" / "validation.json", results)


if __name__ == "__main__":
    main()
