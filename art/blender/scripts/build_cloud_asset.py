"""Smooth cumulus source/GLB plus a Cycles alpha card for mobile sky instancing."""
import argparse
import sys
import struct
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from lm_pipeline import setup_template, save_source, export_collection, render_previews, write_json, sha256, point_at

ASSET = 'LM_SKY_Cumulus'
BUDGET = dict(max_triangles=1500, max_materials=1, max_meshes=1, max_draw_calls=1, max_glb_bytes=131072, max_textures=0)


def render_cloud_card(obj,output):
    scene=bpy.context.scene
    volume=obj.copy();volume.data=obj.data.copy();volume.name='LM_REFERENCE_CloudVolume'
    bpy.data.collections['REFERENCE'].objects.link(volume)
    mat=bpy.data.materials.new('LM_REFERENCE_CloudVolumeMaterial');mat.use_nodes=True
    nodes=mat.node_tree.nodes;nodes.clear()
    out=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeVolumePrincipled')
    shader.inputs['Color'].default_value=(1,1,1,1);shader.inputs['Anisotropy'].default_value=.25
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=4;noise.inputs['Detail'].default_value=3
    density=nodes.new('ShaderNodeMath');density.operation='MULTIPLY';density.inputs[1].default_value=.7
    mat.node_tree.links.new(noise.outputs['Fac'],density.inputs[0])
    mat.node_tree.links.new(density.outputs[0],shader.inputs['Density'])
    mat.node_tree.links.new(shader.outputs['Volume'],out.inputs['Volume'])
    volume.data.materials.clear();volume.data.materials.append(mat);volume.hide_render=True
    data=bpy.data.cameras.new('LM_PREVIEW_CloudCard_CameraData');data.type='ORTHO';data.ortho_scale=12
    camera=bpy.data.objects.new('LM_PREVIEW_CloudCard_Camera',data)
    bpy.data.collections['LIGHTING_PREVIEW'].objects.link(camera)
    camera.location=(0,-20,2.15);point_at(camera,(0,0,2.15))
    source=output/'source'/f'{ASSET}.blend';save_source(source)
    for item in scene.objects:
        if item.type in {'MESH','FONT','LIGHT'}: item.hide_render=True
    volume.hide_render=False
    key=bpy.data.objects['LM_PREVIEW_Key'];key.hide_render=False;key.location=(-5,-7,10)
    key.data.energy=14000;key.data.size=9;point_at(key,(0,0,2))
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=1.2
    scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.device='CPU'
    scene.cycles.samples=48;scene.cycles.seed=17;scene.cycles.use_adaptive_sampling=False
    scene.render.resolution_x=512;scene.render.resolution_y=256;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    path=output/'textures'/f'{ASSET}.png';path.parent.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    # Cycles adds render-time/path text even with use_stamp disabled. Drop text-only
    # ancillary chunks; retain compressed pixels, alpha, colour profile and their CRCs.
    raw=path.read_bytes();stable=[raw[:8]];offset=8
    while offset<len(raw):
        length=struct.unpack_from('>I',raw,offset)[0];end=offset+length+12
        if raw[offset+4:offset+8] not in {b'tEXt',b'zTXt',b'iTXt'}: stable.append(raw[offset:end])
        offset=end
    path.write_bytes(b''.join(stable))
    bpy.ops.wm.open_mainfile(filepath=str(source))
    image=bpy.data.images.load(str(path));image.name='LM_TEX_CloudCard';image.pack();image.use_fake_user=True
    save_source(source)
    return source,path


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    output=args.output.resolve()
    if output.exists() and any(output.iterdir()): raise RuntimeError('Use a fresh output directory')
    output.mkdir(parents=True,exist_ok=True)
    setup_template()
    chunks=[]
    # Overlapping puffs are unioned into one continuous silhouette, not exported spheres.
    for x,y,z,sx,sy,sz in [(-3.1,0,1.05,2.1,1.4,1.15),(-.8,0,1.65,2.4,1.7,1.7),
                          (1.45,.05,1.1,2.25,1.45,1.2),(3.3,0,.8,1.6,1.1,.8),
                          (-.25,.15,2.45,1.65,1.45,1.8),(1.7,-.5,1.8,1.15,1.1,1.3)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(x,y,z))
        obj=bpy.context.object
        obj.scale=(sx,sy,sz)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        chunks.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in chunks: obj.select_set(True)
    bpy.context.view_layer.objects.active=chunks[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=ASSET
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    remesh=obj.modifiers.new('LM_Cloud_Union','REMESH')
    remesh.mode='VOXEL'; remesh.voxel_size=.15; remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=obj.modifiers.new('LM_Cloud_Soften','SMOOTH'); smooth.factor=1.3; smooth.iterations=4
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    obj.data.calc_loop_triangles()
    decimate=obj.modifiers.new('LM_Cloud_Mobile','DECIMATE')
    decimate.ratio=min(1,1350/len(obj.data.loop_triangles))
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    # Base at zero, centered around X/Y origin, one Blender unit = one metre.
    base=min(v.co.z for v in obj.data.vertices)
    for v in obj.data.vertices: v.co.z-=base
    for face in obj.data.polygons: face.use_smooth=True
    obj.data.name=ASSET+'_Mesh'
    obj.data.materials.clear(); obj.data.materials.append(bpy.data.materials['LM_Wall_Cream'])
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(); bpy.ops.object.mode_set(mode='OBJECT')
    for collection in list(obj.users_collection): collection.objects.unlink(obj)
    bpy.data.collections['EXPORT'].objects.link(obj)
    obj['lm_asset_id']=ASSET; obj['lm_version']=1; obj['lm_usage']='distant sky, no collisions or shadows'
    for angle,location in {'Iso':(11,-14,8),'Front':(0,-18,3),'Right':(18,0,4),'Top':(0,0,20)}.items():
        camera=bpy.data.objects[f'LM_PREVIEW_{angle}_Camera']; camera.location=location
        camera.data.ortho_scale=13; point_at(camera,(0,0,1.8))
    source,card=render_cloud_card(obj,output)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    result=export_collection(output/'exports'/f'{ASSET}.glb',budget_overrides=BUDGET)
    render_previews(output/'previews',asset_name=ASSET)
    write_json(output/'reports/validation.json',result)
    write_json(output/'reports/manifest.json',dict(asset=ASSET,version=1,source_sha256=sha256(source),
        script_sha256=sha256(Path(__file__)),glb_sha256=result['glb']['sha256'],card_sha256=sha256(card)))
    print('LM_CLOUD_PASS',result)


if __name__=='__main__': main()
