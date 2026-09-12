import bpy,math,json,numpy as np
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(out/'imported-original.blend'))
scene=bpy.context.scene;o=bpy.data.objects['Mesh_0']
xyz=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',xyz);xyz=xyz.reshape(-1,3)
lo=xyz.min(axis=0);hi=xyz.max(axis=0);scale=1.7/(hi[2]-lo[2])
o.scale*=scale;o.location.z=-lo[2]*scale;o.location.x=-(lo[0]+hi[0])*.5*scale
bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for p in o.data.polygons:p.use_smooth=True
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
studio=bpy.data.collections.new('STUDIO');scene.collection.children.link(studio)
def move(obj):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    studio.objects.link(obj)
def aim(obj,p):obj.rotation_euler=(Vector(p)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,size,col):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=col
    ob=bpy.data.objects.new(name,d);studio.objects.link(ob);ob.location=loc;aim(ob,(0,0,.9))
area('Large key',(-3,-4,4),380,3,(1,.95,.90));area('Fill',(3,-3,2.5),200,3,(.88,.94,1));area('Rim',(1,2.7,3.2),420,2.5,(1,.94,.87))
world=bpy.data.worlds.new('Neutral studio');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.235,.25,1);world.node_tree.nodes['Background'].inputs[1].default_value=.4
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002));floor=bpy.context.object;floor.name='Studio floor';move(floor)
m=bpy.data.materials.new('Warm grey floor');m.diffuse_color=(.23,.215,.2,1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.23,.215,.2,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.85;floor.data.materials.append(m)
def camera(name,loc,target,scale):
    d=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,d);studio.objects.link(ob);ob.location=loc;aim(ob,target);d.type='ORTHO';d.ortho_scale=scale;d.clip_end=300;return ob
front=camera('CAM_Front',(0,-6,1.5),(0,0,.87),1.94)
back=camera('CAM_Back',(0,6,1.5),(0,0,.87),1.94)
hero=camera('CAM_Hero',(1.9,-6,2.0),(0,0,.87),1.95)
face=camera('CAM_Face',(.15,-5,1.55),(0,0,1.47),.55)
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.resolution_x=750;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.camera=front
bpy.ops.wm.save_as_mainfile(filepath=str(out/'comparison-baseline.blend'))
for cam,name in [(front,'before-front.png'),(back,'before-back.png')]:
    scene.camera=cam;scene.render.filepath=str(out/name);bpy.ops.render.render(write_still=True)
print('BASELINE_DONE',flush=True)
