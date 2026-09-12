import bpy,json,time
from pathlib import Path
out=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(out/'meshy-reference-refined.blend'))
scene=bpy.context.scene;o=bpy.data.objects['Companion • Meshy original geometry'];m=o.data.materials[0]
ns=m.node_tree.nodes;lk=m.node_tree.links
texdir=out/'textures';texdir.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.bake.use_selected_to_active=False;scene.render.bake.use_clear=True;scene.render.bake.margin=12
output=ns['Material Output'];em=ns.new('ShaderNodeEmission');em.inputs['Strength'].default_value=1
lk.new(em.outputs[0],output.inputs[0]);target=ns.new('ShaderNodeTexImage')
images={}
for key,space in [('BASECOLOR','sRGB'),('ROUGHNESS','Non-Color'),('METALLIC','Non-Color'),('NORMAL','Non-Color'),('SKIN_MASK','Non-Color'),('HAIR_MASK','Non-Color')]:
    print('BAKE_START',key,flush=True);start=time.time()
    image=bpy.data.images.new('Refined • '+key,4096,4096,alpha=False,float_buffer=False);image.colorspace_settings.name=space
    image.file_format='PNG';image.filepath_raw=str(texdir/('companion_'+key.lower()+'_4k.png'))
    target.image=image
    for n in ns:n.select=False
    target.select=True;ns.active=target
    lk.new(ns['BAKE_'+key].outputs[0],em.inputs['Color'])
    bpy.ops.object.bake(type='EMIT');image.save();image.pack();images[key]=image
    print('BAKE_DONE',key,round(time.time()-start,1),flush=True)
# Keep the editable procedural refinement as an unused material for future tweaks.
archive=m.copy();archive.name='SOURCE WORKSHOP • editable reference adjustments';archive.use_fake_user=True
arc=archive.node_tree
arc.links.new(arc.nodes['Reference finish'].outputs[0],arc.nodes['Material Output'].inputs[0])
# Final portable PBR material uses baked textures; SSS/aniso masks are optional extras.
ns.clear();output=ns.new('ShaderNodeOutputMaterial');output.location=(650,0)
p=ns.new('ShaderNodeBsdfPrincipled');p.name='Reference-matched finish';p.location=(300,0);p.inputs['IOR'].default_value=1.43
p.inputs['Subsurface Radius'].default_value=(1,.42,.23);p.inputs['Subsurface Scale'].default_value=.035
lk.new(p.outputs[0],output.inputs[0])
for idx,(key,im) in enumerate(images.items()):
    n=ns.new('ShaderNodeTexImage');n.name=key+' • baked 4K';n.label=n.name;n.image=im;n.location=(-650,300-idx*290)
    im.filepath='//textures/'+Path(im.filepath_raw).name
    if key=='BASECOLOR':lk.new(n.outputs['Color'],p.inputs['Base Color'])
    elif key=='ROUGHNESS':lk.new(n.outputs['Color'],p.inputs['Roughness'])
    elif key=='METALLIC':lk.new(n.outputs['Color'],p.inputs['Metallic'])
    elif key=='NORMAL':
        normal=ns.new('ShaderNodeNormalMap');normal.location=(-150,-400);normal.inputs['Strength'].default_value=1;lk.new(n.outputs['Color'],normal.inputs['Color']);lk.new(normal.outputs[0],p.inputs['Normal'])
    else:
        mult=ns.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.location=(-150,-650 if key=='SKIN_MASK' else -900);mult.inputs[1].default_value=.045 if key=='SKIN_MASK' else .16
        lk.new(n.outputs['Color'],mult.inputs[0]);lk.new(mult.outputs[0],p.inputs['Subsurface Weight' if key=='SKIN_MASK' else 'Anisotropic'])
        if key=='HAIR_MASK':
            spec=ns.new('ShaderNodeMapRange');spec.inputs['To Min'].default_value=.5;spec.inputs['To Max'].default_value=.28;lk.new(n.outputs['Color'],spec.inputs['Value']);lk.new(spec.outputs['Result'],p.inputs['Specular IOR Level'])
scene.cycles.samples=32;scene.camera=bpy.data.objects['CAM_Hero'];scene.render.resolution_x=1000;scene.render.resolution_y=1400
scene['texture_pass']='4K UV-preserving baked PBR refinement from lossless Meshy PNGs'
# Save with a clear material preview and packed images for a self-contained source.
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            sp=a.spaces.active;sp.region_3d.view_distance=2.5;sp.region_3d.view_location=(0,0,.85);sp.region_3d.view_rotation=scene.camera.rotation_euler.to_quaternion();sp.shading.type='MATERIAL';sp.clip_end=300
for obj in bpy.data.collections['STUDIO'].objects:obj.hide_set(True)
reference=bpy.data.images.get('APPROVED REFERENCE') or bpy.data.images.load(str(out/'reference/approved-black-tank.png'))
reference.name='APPROVED REFERENCE';reference.use_fake_user=True;reference.pack()
notes=bpy.data.texts.new('READ ME • Meshy texture refinement');notes.write((out/'README.md').read_text())
bpy.ops.wm.save_as_mainfile(filepath=str(out/'meshy-reference-refined.blend'))
scene.render.filepath=str(out/'refined-hero.png');bpy.ops.render.render(write_still=True)
print('BAKING_AND_FINAL_SAVE_COMPLETE',flush=True)
