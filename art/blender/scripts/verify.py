"""Host-Python entry point: build, test, validate, and compare a clean rebuild."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--blender", default=os.environ.get("BLENDER_BIN", "/Applications/Blender.app/Contents/MacOS/Blender"))
    parser.add_argument("--generated", type=Path, default=ROOT / "generated")
    args = parser.parse_args()
    generated = args.generated.resolve()
    blender = [args.blender, "--background", "--factory-startup", "--python-exit-code", "1", "--python"]

    def run_blender(script, *arguments):
        subprocess.run([*blender, str(ROOT / "scripts" / script), "--", *map(str, arguments)], check=True)

    if not generated.exists() or not any(generated.iterdir()):
        run_blender("build.py", "--output", generated)
    manifest = json.loads((generated / "reports/manifest.json").read_text())
    if manifest["config_sha256"] != digest(ROOT / "config.json") or manifest["scripts"] != {p.name: digest(p) for p in sorted((ROOT / "scripts").glob("*.py"))}:
        raise RuntimeError("Generated files came from different scripts/config. Use a fresh --generated output.")
    for name, expected in manifest["artifacts"].items():
        if digest(generated / name) != expected:
            raise RuntimeError(f"Artifact changed since generation: {name}. Preserve edits and use a fresh --generated output.")
    source_hashes = {str(p.relative_to(generated)): digest(p) for p in generated.rglob("*.blend")}
    run_blender("test_pipeline.py", "--generated", generated)
    asset_name = json.loads((ROOT / "config.json").read_text())["asset_name"]
    glb = generated / f"exports/{asset_name}.glb"
    subprocess.run(["node", str(ROOT / "tools/validate-glb.mjs"), str(glb), str(generated / "reports")], check=True)
    with tempfile.TemporaryDirectory(prefix="lm-reproducibility-") as directory:
        rebuilt = Path(directory) / "rebuilt"
        run_blender("build.py", "--output", rebuilt)
        same_glb = digest(glb) == digest(rebuilt / f"exports/{asset_name}.glb")
        if not same_glb:
            raise RuntimeError("Clean rebuild changed GLB bytes")
        previews = {p.name: digest(p) == digest(rebuilt / "previews" / p.name) for p in sorted((generated / "previews").glob(f"{asset_name}_*.png"))}
    if not all(digest(generated / name) == expected for name, expected in source_hashes.items()):
        raise RuntimeError("Verification changed saved Blender sources")
    report = {
        "passed": True, "identical_glb_on_clean_rebuild": same_glb,
        "glb_sha256": digest(glb), "saved_sources_unchanged": True,
        "preview_png_byte_matches": previews,
        "note": "GLB byte reproducibility is checked on this Blender build. PNG equality is observational; GPU/driver changes can alter previews. .blend binaries are preserved, not required to be byte-identical across builds.",
    }
    (generated / "reports/reproducibility.json").write_text(json.dumps(report, indent=2) + "\n")
    print("LM_VERIFY_PASS", json.dumps(report))


if __name__ == "__main__":
    main()
