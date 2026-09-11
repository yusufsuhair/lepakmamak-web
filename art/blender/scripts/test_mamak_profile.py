"""Fail-closed tests for the opt-in textured counter profile and export isolation."""
import argparse
import sys
import tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from lm_pipeline import ROOT, validate_scene, export_collection, sha256, write_json
from mamak_polish import PROFILE, COUNTER

parser=argparse.ArgumentParser()
parser.add_argument("--generated",type=Path,default=ROOT/"generated/mamak-maju-v3")
args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
source=args.generated/"source/LM_ENV_MamakMaju.blend"
before=sha256(source)
texture={"material":PROFILE["counter_material"],"resolution":PROFILE["bake"]["resolution"]}
checks=[]

def reopen():
    bpy.ops.wm.open_mainfile(filepath=str(source))
    return bpy.data.objects[COUNTER]

def rejects(label,mutate,expected,profile=texture):
    obj=reopen()
    mutate(obj)
    try:
        validate_scene(budget_overrides=PROFILE["budgets"],texture_profile=profile)
    except ValueError as error:
        assert expected in str(error),str(error)
    else:
        raise AssertionError(f"Accepted {label}")
    checks.append({"test":label,"passed":True})

rejects("textures require explicit profile",lambda o:None,"Material is not in shared palette",None)
rejects("wrong texture colour space",lambda o:setattr(o.data.materials[0].node_tree.nodes['LM_Baked_AO'].image.colorspace_settings,'name','sRGB'),"Non-Color")
rejects("wrong texture dimensions",lambda o:o.data.materials[0].node_tree.nodes['LM_Baked_AO'].image.scale(1024,1024),"Texture dimensions")
rejects("unexpected procedural shader",lambda o:o.data.materials[0].node_tree.nodes.new('ShaderNodeTexNoise'),"Unexpected baked material graph")
rejects("alpha steel",lambda o:setattr(o.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Alpha'],'default_value',.5),"Opaque alpha")
def wrong_ao(obj):
    mat=obj.data.materials[0]
    mat.node_tree.links.new(mat.node_tree.nodes['LM_Baked_AO'].outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
rejects("AO cannot darken base colour",wrong_ao,"Baked direct lighting")
obj=reopen()
assert all(0<=value<=1 for uv in obj.data.uv_layers.active.data for value in uv.uv)
for item in bpy.context.selected_objects:item.select_set(False)
floor=bpy.data.objects['LM_PREVIEW_Ground']
floor.select_set(True)
bpy.context.view_layer.objects.active=floor
with tempfile.TemporaryDirectory(prefix='lm-counter-export-test-') as temporary:
    export=Path(temporary)/'isolated.glb'
    export_collection(export,budget_overrides=PROFILE['budgets'],texture_profile=texture)
    assert sha256(export)==sha256(args.generated/'exports/LM_ENV_MamakMaju.glb')
assert bpy.data.objects['LM_ENV_MamakMaju'].data.uv_layers.active, 'export removed source UVs'
assert sha256(source)==before, 'source was modified'
checks.append({'test':'normalised UVs; packed source; export isolation; source preservation; identical GLB','passed':True})
write_json(args.generated/'reports/profile-tests.json',{'passed':True,'count':len(checks),'tests':checks})
print('LM_MAMAK_PROFILE_TESTS_PASS',len(checks))
