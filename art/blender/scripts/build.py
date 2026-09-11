"""Build only into a fresh directory; never overwrite hand-edited Blender sources."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from lm_pipeline import (ROOT, ASSET, setup_template, make_scale_asset, add_scale_guides,
                         save_source, validate_scene, export_collection, render_previews, write_json, sha256)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "generated")
    parser.add_argument("--skip-renders", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    output = args.output.resolve()
    if output.exists() and any(output.iterdir()):
        raise RuntimeError(f"Output is nonempty: {output}. Use a fresh --output to preserve sources.")
    output.mkdir(parents=True, exist_ok=True)
    setup_template()
    template_result = validate_scene(allow_empty=True)
    template = output / "templates/lepakmamak-web-template.blend"
    save_source(template)
    # Reopen the actual saved template before using it.
    bpy.ops.wm.open_mainfile(filepath=str(template))
    validate_scene(allow_empty=True)
    make_scale_asset()
    add_scale_guides()
    source = output / f"source/{ASSET}.blend"
    save_source(source)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    result = export_collection(output / f"exports/{ASSET}.glb", scale_test=True)
    if not args.skip_renders:
        render_previews(output / "previews")
    write_json(output / "reports/validation.json", {"template": template_result, "asset": result})
    write_json(output / "reports/manifest.json", {
        "blender_version": bpy.app.version_string,
        "blender_build_hash": bpy.app.build_hash.decode(),
        "config_sha256": sha256(ROOT / "config.json"),
        "scripts": {p.name: sha256(p) for p in sorted((ROOT / "scripts").glob("*.py"))},
        "artifacts": {str(p.relative_to(output)): sha256(p) for p in sorted(output.rglob("*")) if p.is_file() and "reports" not in p.relative_to(output).parts},
    })
    print("LM_PIPELINE_PASS", result)


if __name__ == "__main__":
    main()
