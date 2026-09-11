"""Negative contract tests and adversarial selection/collection export checks."""
import argparse
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from lm_pipeline import ROOT, ASSET, validate_scene, export_collection, write_json, sha256

parser = argparse.ArgumentParser()
parser.add_argument("--generated", type=Path, default=ROOT / "generated")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
source = args.generated.resolve() / f"source/{ASSET}.blend"
results = []


def reopen():
    bpy.ops.wm.open_mainfile(filepath=str(source))
    return bpy.data.objects[ASSET]


def rejects(name, mutate, expected):
    obj = reopen()
    mutate(obj)
    obj.data.update()
    bpy.context.view_layer.update()
    try:
        validate_scene(scale_test=True)
    except ValueError as error:
        if expected not in str(error):
            raise AssertionError(f"{name}: wrong rejection: {error}") from error
    else:
        raise AssertionError(f"Validator accepted {name}")
    results.append({"test": name, "passed": True})


rejects("wrong unit scale", lambda o: setattr(bpy.context.scene.unit_settings, "scale_length", .01), "Units must")
rejects("unapplied scale", lambda o: setattr(o, "scale", (2, 1, 1)), "Apply rotation and scale")
rejects("wrong physical size", lambda o: [setattr(v.co, "x", v.co.x * 2) for v in o.data.vertices], "1 x 1 x 1")
rejects("floating origin", lambda o: setattr(o.location, "z", .2), "rest on Z=0")
rejects("nondeterministic name", lambda o: setattr(o, "name", ASSET + ".001"), "nondeterministic")
rejects("missing UVs", lambda o: o.data.uv_layers.remove(o.data.uv_layers.active), "Missing UVs")
rejects("missing material", lambda o: o.data.materials.clear(), "Missing material slot")
rejects("hidden geometry", lambda o: setattr(o, "hide_render", True), "Hidden export")
rejects("unsupported shader", lambda o: o.data.materials[0].node_tree.nodes.new("ShaderNodeTexNoise"), "Only simple Principled")
rejects("alpha material", lambda o: setattr(o.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Alpha"], "default_value", .5), "Opaque alpha")
rejects("polygon budget", lambda o: setattr(o.modifiers.new("Subdivision", "SUBSURF"), "levels", 4), "Triangle budget")
rejects("lost shared palette", lambda o: setattr(bpy.data.materials["LM_Wood_Warm"], "use_fake_user", False), "Shared palette")


def export_camera(obj):
    camera = bpy.data.objects["LM_PREVIEW_Front_Camera"]
    bpy.data.collections["EXPORT"].objects.link(camera)


rejects("camera inside EXPORT", export_camera, "Unsupported export type")
rejects("external parent", lambda o: setattr(o, "parent", bpy.data.objects["LM_PREVIEW_Ground"]), "Parent outside EXPORT")

reopen()
for obj in bpy.context.selected_objects:
    obj.select_set(False)
outside = bpy.data.objects["LM_PREVIEW_Ground"]
outside.select_set(True)
bpy.context.view_layer.objects.active = outside
bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children["REFERENCE"]
with tempfile.TemporaryDirectory(prefix="lm-export-test-") as directory:
    glb = Path(directory) / "adversarial-selection.glb"
    export_collection(glb, scale_test=True)
    assert sha256(glb) == sha256(args.generated / f"exports/{ASSET}.glb"), "Selection state changed GLB"
results.append({"test": "nested EXPORT only; outside mesh selected and REFERENCE active; identical GLB", "passed": True})
write_json(args.generated / "reports/pipeline-tests.json", {"passed": True, "count": len(results), "tests": results})
print("LM_TESTS_PASS", len(results))
