import bpy,os,json,math
from mathutils import Vector
ROOT=os.path.abspath('.');OUT=ROOT+'/art/blender/generated/character-module-v1/review';PUB=ROOT+'/public/assets';styles=json.load(open(ROOT+'/shared/character-styles.json'))['styles']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100;scene.render.film_transparent=False;scene.world.color=(.32,.32,.32);scene.view_settings.view_transform='AgX'
def color(h):
 v=[int(h[i:i+2],16)/255 for i in (1,3,5)];return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v)+(1,)
def load(key):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=PUB+'/models/characters/'+key+'.glb');return list(set(bpy.data.objects)-before)
def tint(obs,colors):
 for o in obs:
  if o.type!='MESH':continue
  for i,m in enumerate(o.data.materials):
   channel=m.name.split('.')[0].replace('LM_','')
   if channel in colors:
    m=m.copy();o.data.materials[i]=m;m.diffuse_color=color(colors[channel]);m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color(colors[channel])
def light(loc,power,size):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler()
light((-2,-3,4),220,3);light((2,-2,3),130,3);light((0,2,3),230,2)
bpy.ops.object.camera_add(location=(.9,-4,2.10));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.77))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.20;scene.camera=cam
bases={}
for gender in ['male','female']:
 obs=load('base-'+gender)
 for o in obs:o.hide_render=not o.name.startswith('head__')
 tint(obs,{'skin':'#b98157' if gender=='male' else '#cf986c'});bases[gender]=obs
for d in styles:
 gender='male' if d['category']=='male' else 'female'
 for g,obs in bases.items():
  for o in obs:o.hide_render=g!=gender or not o.name.startswith('head__')
 target=1.58 if d['kind']=='tudung' else 1.70
 cam.data.ortho_scale=1.52 if d['kind']=='tudung' else 1.40
 cam.location=(3.7,-3.1,2.1) if d['id'] in ['ponytail','low-ponytail','braid','bun'] else (.9,-4,2.1)
 cam.rotation_euler=(Vector((0,0,target))-cam.location).to_track_quat('-Z','Y').to_euler()
 obs=load(d['kind']+'-'+d['id']);tint(obs,{'hair':'#202c2b','tudung':d.get('color','#4d8b80')})
 scene.render.filepath=PUB+'/characters/thumbs/'+d['kind']+'-'+d['id']+'.png';bpy.ops.render.render(write_still=True)
 for o in obs:bpy.data.objects.remove(o,do_unlink=True)
print('THUMBNAILS COMPLETE',len(styles))
