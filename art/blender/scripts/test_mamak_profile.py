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
parser.add_argument("--generated",type=Path,default=ROOT/"generated/mamak-maju-v7")
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
site=bpy.data.objects['LM_ENV_MamakMaju']
assert site['lm_version']==PROFILE['version']
for label in ('WindowReveal','ShutterLouvre','CourtyardGrout','DrainBed','CanopyRafter'):
    assert any(g.name.endswith('_'+label) for g in site.vertex_groups), label
festoon=bpy.data.objects['LM_ENV_MamakMaju_Festoon']
for label in ('FestoonPole','FestoonCable','FestoonBulb'):
    assert any(g.name.endswith('_'+label) for g in festoon.vertex_groups), label
checks.append({'test':'version and required authored frontage/atmosphere parts','passed':True})
if PROFILE['version']>=7:
    color=site.data.color_attributes.get('LM_Baked_Occlusion')
    assert color and max(c.color[0] for c in color.data)-min(c.color[0] for c in color.data)>.1
    assert all(.579<=v<=1.001 for c in color.data for v in c.color)
    assert site['lm_vertex_bake']=='cycles-ao-1.25m-v1'
    checks.append({'test':'portable Cycles vertex bake has bounded nonflat linear occlusion','passed':True})
    labels=('TeaSaucer','TeaSurface','MugHandleRail','MugHandleOuter','DhalBowl','DhalSurface','Spoon','RotiFold','TissueBox','TableMenu','MenuPrint','SharingPlate','SharingRoti')
    tables=__import__('json').loads(site['lm_tables_json'])
    for label in labels:
        groups=[g for g in site.vertex_groups if g.name.endswith('_'+label)]
        assert groups,label
        for group in groups:
            verts=[v.co for v in site.data.vertices if any(g.group==group.index for g in v.groups)]
            center=sum(verts,__import__('mathutils').Vector())/len(verts)
            t=min(tables,key=lambda t:(center.x-29-t['x'])**2+(30-center.y-t['z'])**2)
            radius=1.95 if t['id']=='meja-9' else 1.14
            assert all((v.x-29-t['x'])**2+(30-v.y-t['z'])**2<(radius-.08)**2 and 1.14<v.z<1.65 for v in verts),label
    checks.append({'test':'table details remain on physical tabletops and clear playable seats','passed':True})
festoon_ids={g.index for g in festoon.vertex_groups if g.name.endswith(('_FestoonCable','_FestoonBulb'))}
festoon_vertices=[v for v in festoon.data.vertices if any(g.group in festoon_ids for g in v.groups)]
assert festoon_vertices and min(v.co.z for v in festoon_vertices) > 4.45
assert festoon['lm_bulb_count']==18 and festoon['lm_pole_count']==6
checks.append({'test':'festoon cables and bulbs preserve avatar head clearance','passed':True})
import json
layout=json.loads((ROOT.parent.parent/'shared/mamak-streets.json').read_text())
parts={'crates':('DrinkCrateBase','DrinkCrateRail','DrinkCrateEnd','DrinkBottle'),
       'bin':('ServiceBin','BinLid','BinHandle','BinLabel'),
       'wash':('WashStand','WashBasin','BasinInset','WashTapStem','WashTapSpout','SoapBottle','SoapPump')}
for item in layout['serviceProps']:
    ids={g.index for g in site.vertex_groups if any(g.name.endswith('_'+label) for label in parts[item['kind']])}
    vertices=[v for v in site.data.vertices if any(g.group in ids for g in v.groups)]
    assert vertices, item['kind']
    for vertex in vertices:
        assert abs(vertex.co.x-29-item['x']) <= item['hx']+.001, item['kind']
        assert abs(30-vertex.co.y-item['z']) <= item['hz']+.001, item['kind']
checks.append({'test':'service meshes stay inside shared collision footprints','passed':True})
inlay_ids={g.index for g in site.vertex_groups if any(g.name.endswith('_'+name) for name in
    ('CourtyardGrout','AnnexGrout','ThresholdJoint','DrainCrossbar'))}
for polygon in site.data.polygons:
    if any(g.group in inlay_ids for g in site.data.vertices[polygon.vertices[0]].groups):
        assert polygon.normal.z>.999, 'inlay must face upwards'
        assert all(.20 < site.data.vertices[v].co.z < .215 for v in polygon.vertices), 'inlay not flush'
checks.append({'test':'ground inlays face up and remain below paving border','passed':True})
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
