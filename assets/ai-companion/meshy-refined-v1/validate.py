import bpy,json,numpy as np,hashlib
from pathlib import Path
out=Path(__file__).resolve().parent

def geometry(o):
    me=o.data
    xyz=np.empty(len(me.vertices)*3,dtype=np.float32);me.vertices.foreach_get('co',xyz)
    uv=np.empty(len(me.uv_layers.active.data)*2,dtype=np.float32);me.uv_layers.active.data.foreach_get('uv',uv)
    assert np.isfinite(xyz).all() and np.isfinite(uv).all()
    return {'vertices':len(me.vertices),'triangles':len(me.polygons),'position_sha256':hashlib.sha256(xyz.tobytes()).hexdigest(),'uv_sha256':hashlib.sha256(uv.tobytes()).hexdigest(),'bounds_min_m':xyz.reshape(-1,3).min(axis=0).tolist(),'bounds_max_m':xyz.reshape(-1,3).max(axis=0).tolist()}
bpy.ops.wm.open_mainfile(filepath=str(out/'comparison-baseline.blend'));baseline=geometry(bpy.data.objects['Mesh_0'])
bpy.ops.wm.open_mainfile(filepath=str(out/'meshy-reference-refined.blend'));o=bpy.data.objects['Companion • Meshy original geometry'];final=geometry(o)
assert final==baseline,'Geometry or UV changed during material refinement'
height=final['bounds_max_m'][2]-final['bounds_min_m'][2];assert abs(height-1.7)<.00001,height
textures=[]
for n in o.data.materials[0].node_tree.nodes:
    if n.type!='TEX_IMAGE':continue
    im=n.image;assert im and im.packed_file, n.name
    assert list(im.size)==[4096,4096],im.name
    path=out/'textures'/Path(im.filepath).name;assert path.is_file(),str(path)
    textures.append({'name':im.name,'file':path.name,'size':list(im.size),'colorspace':im.colorspace_settings.name,'packed':True,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
assert len(textures)==6,len(textures)
assert bpy.context.scene.unit_settings.scale_length==1
result={'status':'PASS','blender':bpy.app.version_string,'source':'meshy-reference-refined.blend','geometry_and_uv_match_normalized_source':True,'geometry':final,'height_m':height,'textures':textures,'reference_packed':bool(bpy.data.images.get('APPROVED REFERENCE').packed_file),'limitations':['No handbag in supplied mesh','Generated eye/hair/jewelry geometry artifacts remain','No new photographic detail invented by 4K baking']}
(out/'validation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2),flush=True)

# Render the reopened packed file to validate the assigned baked material.
scene=bpy.context.scene;scene.camera=bpy.data.objects['CAM_Front'];scene.cycles.samples=24
scene.render.resolution_x=750;scene.render.resolution_y=1100
scene.render.filepath=str(out/'after-front-baked.png');bpy.ops.render.render(write_still=True)
print('REOPENED_BAKED_RENDER_COMPLETE',flush=True)
