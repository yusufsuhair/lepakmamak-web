"""Re-export an edited source using the same validation and EXPORT-only contract."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from lm_pipeline import export_collection, write_json

parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--scale-test", action="store_true")
parser.add_argument("--profile", choices=["static", "mamak-v3", "mamak-v4", "mamak-v5"], default="static")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
if args.output.suffix.lower() != ".glb" or args.output.exists():
    raise RuntimeError("Use a new .glb output path; existing files are preserved")
bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
options={}
if args.profile in {"mamak-v3", "mamak-v4", "mamak-v5"}:
    if args.scale_test: raise ValueError("Scale test and Mamak profile are mutually exclusive")
    from mamak_polish import PROFILE
    options={"budget_overrides":PROFILE["budgets"],"texture_profile":{
        "material":PROFILE["counter_material"],"resolution":PROFILE["bake"]["resolution"]}}
result = export_collection(args.output.resolve(), scale_test=args.scale_test, **options)
write_json(args.output.with_suffix(".validation.json"), result)
print("LM_EXPORT_PASS", result)
