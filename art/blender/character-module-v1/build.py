"""Author and export Blender modular characters using approved V2 faces."""
import bpy, os, json, math, random
from mathutils import Vector, Matrix
from math import sin,cos,pi
ROOT=os.path.abspath('.');OUT=ROOT+'/art/blender/generated/character-module-v1';PUBLIC=ROOT+'/public/assets/models/characters'
# Reuse the actual approved sculpt, without re-running its review scene or exports.
scope={};exec(open(ROOT+'/art/blender/character-revamp-v2/build.py').read().split('\nmodels=[]')[0],scope)
uv,mesh,curve,mat,person=[scope[x] for x in ['uv','mesh','curve','mat','person']]
SKIN,HAIR,CLOTH=scope['skin'],scope['hair'],scope['scarf']
STYLE=json.load(open(ROOT+'/shared/character-styles.json'))['styles']
SCALE=.9
PIVOTS={'body':(0,0,0),'head':(0,0,0),'style':(0,0,0),'leftLeg':(-.153,0,.846),'rightLeg':(.153,0,.846),'leftUpperArm':(-.2925,0,1.224),'leftForearm':(-.2925,0,1.224),'rightUpperArm':(.2925,0,1.224),'rightForearm':(.2925,0,1.224)}
BUDGET={'body':900,'head':5000,'leftLeg':750,'rightLeg':750,'leftUpperArm':350,'rightUpperArm':350,'leftForearm':500,'rightForearm':500,'style':2200}
manifest={'version':'character-module-v1','scale':SCALE,'pivots':{k:[v[0],v[2],-v[1]] for k,v in PIVOTS.items()},'assets':{}}
# Shared material semantics: palette channels remain editable at runtime; fixed colours are vertex-baked.
mats={}
for channel in ['skin','shirt','trousers','hair','tudung','fixed']:
 m=mat('LM_'+channel,'#ffffff',.57 if channel=='skin' else .68 if channel in ['shirt','trousers','tudung'] else .43)
 if channel=='fixed':
  vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';m.node_tree.links.new(vc.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 mats[channel]=m

def newcol(name):
 c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);scope['COL']=c;return c

def classify(o,sk):
 n=o.name
 if n.startswith(('Hair','Bob','Hijab')):return None
 world=o.matrix_world@o.data.vertices[0].co if o.type=='MESH' and o.data.vertices else o.matrix_world.translation
 center=o.matrix_world@(sum((Vector(p) for p in o.bound_box),Vector())/8)
 side='left' if center.x<0 else 'right'
 if n.startswith(('Face','Eye','Nose','Mouth','Ear','Neck')):role='head'
 elif n.startswith(('Sneaker','Trousers')):role=side+'Leg'
 elif n.startswith(('Arm','Hand')):role=side+'Forearm'
 elif n.startswith('Tee | tailored short sleeve'):role=side+'UpperArm'
 else:role='body'
 original=o.data.materials[0] if o.data.materials else None
 channel='skin' if original==sk else 'shirt' if original in [scope['orange'],scope['green'],scope['cream']] else 'trousers' if original in [scope['sand'],scope['denim'],scope['dark']] else 'fixed'
 return role,channel

def export_parts(col,key,sk=None,style=False):
 bpy.context.view_layer.update();groups={}
 for obj in list(col.objects):
  if obj.type not in ['MESH','CURVE']:continue
  # Fine strands are represented by sculpted grooves in the web silhouette, not hundreds of draw calls.
  if obj.name.startswith(('Hair | individually','Face | individual brow','Hand | finger')):continue
  category=('style','hair' if style=='hair' else 'tudung') if style else classify(obj,sk)
  if not category:continue
  role,channel=category
  deps=bpy.context.evaluated_depsgraph_get();me=bpy.data.meshes.new_from_object(obj.evaluated_get(deps),depsgraph=deps)
  world=obj.matrix_world.copy()
  for v in me.vertices:v.co=(world@v.co)*SCALE-Vector(PIVOTS[role])
  if channel=='fixed':
   colors=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
   for poly in me.polygons:
    material=obj.data.materials[min(poly.material_index,len(obj.data.materials)-1)] if obj.data.materials else None
    rgb=material.diffuse_color[:] if material else (1,1,1,1)
    for li in poly.loop_indices:colors.data[li].color=rgb
  me.materials.clear();me.materials.append(mats[channel]);
  for poly in me.polygons:poly.material_index=0;poly.use_smooth=True
  ob=bpy.data.objects.new(role+'__'+channel,me);bpy.context.scene.collection.objects.link(ob);groups.setdefault((role,channel),[]).append(ob)
 exports=[]
 for (role,channel),objects in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=role+'__'+channel
  bpy.ops.object.modifier_add(type='TRIANGULATE');bpy.ops.object.modifier_apply(modifier=o.modifiers[-1].name)
  limit=BUDGET[role]*(.72 if channel=='skin' and role=='head' else .28 if role=='head' else 1)
  count=len(o.data.polygons)
  if count>limit:
   mod=o.modifiers.new('Web triangle budget','DECIMATE');mod.ratio=limit/count;bpy.ops.object.modifier_apply(modifier=mod.name)
  # Asset vertices carry palette-independent colours. No Blender-only procedural node is required in game.
  exports.append(o)
 bpy.ops.object.select_all(action='DESELECT')
 for o in exports:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=PUBLIC+'/'+key+'.glb',export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
 triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in exports)
 manifest['assets'][key]={'file':key+'.glb','triangles':triangles,'drawCalls':len(exports),'bytes':os.path.getsize(PUBLIC+'/'+key+'.glb')}
 for o in exports:bpy.data.objects.remove(o,do_unlink=True)
 col.hide_render=True;col.hide_viewport=True

for female in [False,True]:
 sk=scope['skin2'] if female else SKIN
 root,col=person('SOURCE | '+('female' if female else 'male'),sk,scope['green'] if female else scope['orange'],scope['denim'] if female else scope['sand'],bob=female)
 export_parts(col,'base-female' if female else 'base-male',sk)

# A fitted sculpted cap with parametrised fringe, crown volume, sides and back.
def cap(style):
 # Shaved buzz uses separate close stubble, allowing the scalp to remain visible.
 if style=='buzz':
  vs=[];fs=[];count=270
  for k in range(count):
   a=k*2.399963;end=1.25+.45*(1-cos(a));p=.035+math.sqrt((k+.5)/count)*end
   x=.428*sin(p)*sin(a);y=-.342*sin(p)*cos(a)+.018;z=1.97+.466*cos(p);n=len(vs)
   vs.extend([(x+.014,y,z),(x-.014,y,z),(x,y+.014,z),(x,y-.014,z),(x,y,z+.011),(x,y,z-.011)])
   fs.extend([tuple(n+j for j in f) for f in [(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)]])
  mesh('Hair | buzz stubble',vs,fs,HAIR,0)
  return
 N=64;R=20;vs=[];fs=[]
 female=style in ['bob','lob','long-straight','long-wavy','long-layered','curtain-bangs','wolf-cut','pixie','ponytail','low-ponytail','bun','braid']
 for i in range(R+1):
  t=i/R
  for j in range(N):
   a=2*pi*j/N
   front=max(0,cos(a));back=max(0,-cos(a));side=abs(sin(a))
   end=1.13+.4*(1-cos(a));vol=.018
   if style in ['buzz','crew']:end=1.25+.48*(1-cos(a));vol=-.002 if style=='buzz' else .013
   if style in ['undercut','quiff','pompadour','curly-top']:end=.97+.29*(1-cos(a));vol=.025
   if style=='french-crop':end=1.24+.26*(1-cos(a))+.035*sin(a*10)*front
   if style in ['side-part','comb-over']:end=1.04+.48*(1-cos(a))+.15*sin(a)*front
   if style=='comb-over':vol=.045;end+=.10*sin(a)*front
   if style=='curtains':end=1.23+.34*(1-cos(a))-.30*math.exp(-(sin(a)/.27)**2)*front
   if style=='pixie':end=1.03+.56*(1-cos(a))+.10*sin(a)*front
   if style in ['bob','lob','long-straight','long-wavy','long-layered','curtain-bangs','wolf-cut']:
    end=1.05+.96*(1-cos(a))
    if style in ['curtain-bangs','wolf-cut']:end+=.20*front-.29*math.exp(-(sin(a)/.22)**2)*front
   if style in ['ponytail','low-ponytail','bun','braid']:end=.89+.52*(1-cos(a))
   if style=='mullet':end=1.07+.4*(1-cos(a))+.9*back
   p=.008+t*end;sw=a+(.25 if style in ['side-part','comb-over','pixie'] else .10)*sin(p)
   gro=.003*sin(a*(22 if style!='buzz' else 55)+p*7)*sin(p)
   x=(.434+vol+gro)*sin(p)*sin(sw);y=-(.344+vol+gro)*sin(p)*cos(sw)+.018;z=1.97+(.472+vol+gro)*cos(p)
   if style in ['quiff','pompadour']:z+= (.065 if style=='quiff' else .09)*front*sin(p)**2
   if style=='crew':z+=.032*sin(p)
   vs.append((x,y,z))
 for i in range(R):
  for j in range(N):k=i*N+j;l=i*N+(j+1)%N;fs.append((k,l,l+N,k+N))
 ob=mesh('Hair | '+style,vs,fs,HAIR,1);mod=ob.modifiers.new('Hair thickness','SOLIDIFY');mod.thickness=.014
 # Long styles extend below the cap as a continuous open-front curtain of hair.
 lengths={'lob':1.39,'long-straight':1.13,'long-wavy':1.14,'long-layered':1.24,'curtain-bangs':1.29,'wolf-cut':1.38,'mullet':1.42}
 if style in lengths:
  vs=[];fs=[];L=18;N=56
  for i in range(L+1):
   t=i/L
   for j in range(N+1):
    opening=2.05 if style=='mullet' else .98
    a=opening+(2*pi-2*opening)*j/N
    wave=(.025*sin(t*9+a*3) if style in ['long-wavy','wolf-cut'] else .004*sin(a*25))
    radius=.413+.045*sin(t*pi)+wave
    x=radius*sin(a);y=-.315*cos(a)+.045+wave;z=2.11-(2.11-lengths[style])*t
    if style in ['long-layered','wolf-cut']:z+=.09*t*abs(sin(a*3))
    vs.append((x,y,z))
  for i in range(L):
   for j in range(N):a=i*(N+1)+j;fs.append((a,a+1,a+N+2,a+N+1))
  ob=mesh('Hair | flowing length '+style,vs,fs,HAIR,1);ob.modifiers.new('Hair body','SOLIDIFY').thickness=.025
 if style in ['undercut','quiff','pompadour','curly-top']:
  # Close-cropped underlayer reads clearly against the longer top.
  ob=uv('Hair | cropped sides',(0,.026,1.965),(.433,.35,.46),HAIR,32,24)
  # Remove front face area; this is scalp at the sides/back only.
  import bmesh
  bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z<-.10 or f.calc_center_median().y<-.14],context='FACES');bm.to_mesh(ob.data);bm.free()
 if style in ['quiff','pompadour']:
  if style=='quiff':
   uv('Hair | swept quiff',(-.07,-.10,2.365),(.28,.25,.155),HAIR,40,24)
  else:
   uv('Hair | pompadour crown',(0,-.065,2.385),(.335,.29,.205),HAIR,40,24)
 if style=='curly-top':
  rng=random.Random(70)
  for k in range(34):
   a=k*2.399;r=.32*math.sqrt((k+.5)/34);x=r*cos(a);y=r*sin(a)*.77
   uv('Hair | defined curl',(x,y,2.33+.12*(1-r/.35)),(.082,.075,.076),HAIR,16,12)
 if style in ['ponytail','low-ponytail','braid','bun']:
  high=style in ['ponytail','bun'];z=2.18 if high else 1.86
  uv('Hair | tied crown',(0,.335,z),(.14,.13,.14),HAIR,24,16)
  if style=='bun':
   uv('Hair | round bun',(0,.405,2.31),(.18,.15,.17),HAIR,24,16)
  elif style=='braid':
   for k in range(9):uv('Hair | woven braid',((-.038 if k%2 else .038),.405,1.84-k*.077),(.071,.075,.082),HAIR,16,12)
  else:
   points=[(0,.38,z),(0,.51,z-.12),(.035,.51,z-.34),(.08,.46,z-.62)]
   curve('Hair | ponytail volume',points,.10,HAIR)
   for s in [-1,1]:curve('Hair | ponytail lock',[(x+s*.035,y-.03,zz+.015) for x,y,zz in points],.026,HAIR)

# Each tudung has its own silhouette, opening, drape and fold construction.
def tudung(style):
 N=64;R=24;vs=[];fs=[]
 for i in range(R+1):
  t=1.00+(pi-1.015)*i/R
  for j in range(N):
   a=2*pi*j/N;f=.005*sin(9*a+3*t)*sin(t)
   if style=='ruffle':f+=.012*sin(a*18)*math.exp(-i/3)
   vs.append(((.486+f)*sin(t)*sin(a),-.395*cos(t)+.01,1.975+(.565+f)*sin(t)*cos(a)))
 for i in range(R):
  for j in range(N):a=i*N+j;b=i*N+(j+1)%N;fs.append((a,b,b+N,a+N))
 hood=mesh('Hijab | fitted '+style,vs,fs,CLOTH,1);hood.modifiers.new('Cloth thickness','SOLIDIFY').thickness=.009
 if style=='turban':
  # Trim the lower hood; wrap bands and knot distinguish a turban from a full drape.
  import bmesh
  bm=bmesh.new();bm.from_mesh(hood.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z<1.90],context='FACES');bm.to_mesh(hood.data);bm.free()
  for k in range(4):curve('Hijab | turban wrap',[(.45*sin(a),-.32*cos(a),2.09+k*.067+.025*cos(a*2)) for a in [2*pi*j/48 for j in range(49)]],.027,CLOTH)
  uv('Hijab | turban knot',(.08,-.265,2.32),(.085,.047,.055),CLOTH,24,16)
  return
 ends={'short':1.26,'long':.99,'shawl':1.18,'bawal':1.17,'satin':1.13,'instant':1.20,'duck-luxe':1.07,'ruffle':1.24,'bawal-labuh':.94,'shawl-loose':1.02,'sport':1.31}
 bottom=ends[style];N=64;R=20;vs=[];fs=[]
 for i in range(R+1):
  t=i/R
  for j in range(N):
   a=2*pi*j/N;f=.010*sin(a*9+t*4)*sin(pi*t)
   width=.23+(.23 if style not in ['sport','instant'] else .14)*sin(pi*t/2)
   depth=.20+.058*sin(pi*t/2)
   z=1.68-(1.68-bottom)*t
   if style in ['bawal','bawal-labuh']:z+=.15*t*abs(sin(a))
   if style in ['shawl','satin','duck-luxe','shawl-loose']:z+=.10*t*sin(a)
   if style=='ruffle':z+=.02*t*sin(a*18)
   vs.append(((width+f)*sin(a),-(depth+f)*cos(a),z))
 for i in range(R):
  for j in range(N):a=i*N+j;b=i*N+(j+1)%N;fs.append((a,b,b+N,a+N))
 ob=mesh('Hijab | shaped drape '+style,vs,fs,CLOTH,1);ob.modifiers.new('Drape thickness','SOLIDIFY').thickness=.009
 if style in ['shawl','satin','duck-luxe','shawl-loose']:
  # Diagonal overlapping panel, extending past the shoulder on the loose shawl.
  vs=[];fs=[];N=20;R=12
  for i in range(R+1):
   t=i/R
   for j in range(N+1):
    u=j/N;x=-.31+.63*u+.07*t;z=1.58-.30*t-.18*u*t
    y=-.242-.025*sin(pi*u)*sin(pi*t)+.008*sin(5*pi*u+t)
    if style=='shawl-loose':x+=.07*u;z-=.12*t
    vs.append((x,y,z))
  for i in range(R):
   for j in range(N):a=i*(N+1)+j;fs.append((a,a+1,a+N+2,a+N+1))
  mesh('Hijab | overlapping shawl panel',vs,fs,CLOTH,1)
 if style in ['bawal','bawal-labuh','duck-luxe']:uv('Hijab | brooch',(.02,-.218,1.58),(.022,.01,.022),CLOTH,16,12)
 if style=='instant':curve('Hijab | structured awning',[(.407*sin(a),-.22,1.975+.48*cos(a)) for a in [-pi/2+pi*j/32 for j in range(33)]],.017,CLOTH)

for definition in STYLE:
 key=definition['kind']+'-'+definition['id'];col=newcol('SOURCE | '+key)
 (cap if definition['kind']=='hair' else tudung)(definition['id'])
 export_parts(col,key,style=definition['kind'])
# Persist full editable sources. Optimised GLBs are separate, reproducible exports.
bpy.context.scene['asset_version']='character-module-v1'
bpy.context.scene['purpose']='Approved V2 face, modular palette channels and browser-budget exports; source collections retained.'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/source/character-module-v1.blend')
json.dump(manifest,open(PUBLIC+'/manifest.json','w'),indent=2)
print('MODULE COMPLETE',len(manifest['assets']))
