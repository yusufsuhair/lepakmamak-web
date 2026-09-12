"""Editable Blender look-development samples; approval only, not game integration."""
import bpy, math, os, json, random
from mathutils import Vector
from math import sin, cos, pi
random.seed(19)
OUT=os.path.abspath('art/blender/generated/character-revamp-v2')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in bpy.data.materials: bpy.data.materials.remove(d)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1800;scene.render.resolution_y=1150;scene.render.resolution_percentage=100
scene.world.color=(.22,.22,.22)
scene.view_settings.view_transform='AgX'
COL=None

def rgb(h):
 h=h.lstrip('#');v=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v)+(1,)
def mat(name,h,rough=.5,cloth=False,skin=False,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=rgb(h);m.use_nodes=True;n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Base Color'].default_value=rgb(h);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if skin:p.inputs['Subsurface Weight'].default_value=.085;p.inputs['Subsurface Radius'].default_value=(1,.43,.23)
 if cloth:p.inputs['Sheen Weight'].default_value=.23
 if cloth or skin:
  tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=210 if cloth else 150;tex.inputs['Detail'].default_value=2
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.24 if cloth else .12;bump.inputs['Distance'].default_value=.0013 if cloth else .0007
  m.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 return m
skin=mat('Skin | warm tan + subsurface','#b98157',.48,skin=True)
skin2=mat('Skin | warm + subsurface','#cf986c',.48,skin=True)
skin3=mat('Skin | brown + subsurface','#8b583d',.48,skin=True)
white=mat('Eyes | warm ivory','#fff6e4',.24);iris=mat('Eyes | rich brown','#302017',.3);pupil=mat('Eyes | pupil','#100b09',.19)
hair=mat('Hair | espresso','#202c2b',.45);hairhi=mat('Hair | fine warm strands','#303933',.46)
brown=mat('Hair | chocolate','#654331',.46);browhi=mat('Hair | caramel strand','#735441',.46)
orange=mat('Cotton | original orange','#ef734c',.69,True);green=mat('Cotton | original sage','#62876b',.68,True);cream=mat('Cotton | original cream','#eee2c6',.68,True)
sand=mat('Twill | original sand','#c7be9c',.73,True);denim=mat('Denim | original blue','#436485',.74,True);dark=mat('Twill | original charcoal','#253a40',.7,True)
scarf=mat('Hijab | original short teal','#4d8b80',.62,True);scarfedge=mat('Hijab | seam highlight','#659c8f',.63,True)
sole=mat('Sneaker | warm rubber','#e9e1cd',.6);suede=mat('Sneaker | ivory canvas','#f6efd7',.75,True);trim=mat('Sneaker | forest trim','#27403c',.48)
gold=mat('Brushed champagne hardware','#c8a25d',.3,metal=.72)

def link(o,name,m):
 o.name=name
 if COL:
  for c in list(o.users_collection):c.objects.unlink(o)
  COL.objects.link(o)
 if m:o.data.materials.append(m)
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o

def uv(name,pos,scale,m,seg=48,rings=32):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=pos);o=bpy.context.object;o.scale=scale;return link(o,name,m)
def mesh(name,verts,faces,m,sub=1):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);(COL or scene.collection).objects.link(o);me.materials.append(m)
 for p in me.polygons:p.use_smooth=True
 if sub:mod=o.modifiers.new('Surface smoothing','SUBSURF');mod.levels=sub;mod.render_levels=sub
 return o

def curve(name,pts,r,m):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=16;cu.bevel_depth=r;cu.bevel_resolution=1 if name.startswith('Hair | individually') else 3
 if name.startswith('Hair | individually'):cu.resolution_u=3
 sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for b,p in zip(sp.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,cu);(COL or scene.collection).objects.link(ob);cu.materials.append(m);return ob

def loft(name,rings,m,N=48,fold=0):
 verts=[]
 for z,rx,ry,cy in rings:
  for j in range(N):
   a=2*pi*j/N;r=1+fold*sin(a*9+z*8)*sin(pi*(z-rings[0][0])/(rings[-1][0]-rings[0][0]))
   verts.append((rx*cos(a)*r,cy+ry*sin(a)*r,z))
 faces=[tuple(range(N-1,-1,-1))]
 for i in range(len(rings)-1):
  for j in range(N):a=i*N+j;b=i*N+(j+1)%N;faces.append((a,b,b+N,a+N))
 faces.append(tuple((len(rings)-1)*N+j for j in range(N)))
 return mesh(name,verts,faces,m,2)

def segment(name,a,b,r1,r2,m):
 mid=(Vector(a)+Vector(b))/2;o=uv(name,mid,(r1,r2,(Vector(a)-Vector(b)).length/2+r1*.35),m,32,20);o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector(b).__sub__(Vector(a)).to_track_quat('Z','Y');return o

def haircap(bob,hm,hi):
 N=96;R=36;verts=[];faces=[]
 def point(a,t,extra=0):
  end=(1.12+.43*(1-cos(a))) if not bob else (1.12+.98*(1-cos(a)))
  p=.008+t*end
  sweep=a+.13*sin(p)
  groove=.004*sin(a*36+p*7)*sin(p)
  return ((.445+groove+extra)*sin(p)*sin(sweep),-(.352+groove+extra)*sin(p)*cos(sweep)+.018,1.99+(.485+groove+extra)*cos(p))
 for i in range(R+1):
  for j in range(N):verts.append(point(2*pi*j/N,i/R))
 for i in range(R):
  for j in range(N):k=i*N+j;l=i*N+(j+1)%N;faces.append((k,l,l+N,k+N))
 ob=mesh('Hair | shaped continuous hairstyle',verts,faces,hm,1)
 sol=ob.modifiers.new('Hair volume','SOLIDIFY');sol.thickness=.022
 for k in range(180):
  a=2*pi*k/180
  curve('Hair | individually combed strand', [point(a,.07+.92*q/20,.0017) for q in range(21)], .00085,hi if k%5==0 else hm)

def hijab():
 N=88;R=30;verts=[];faces=[]
 for i in range(R+1):
  t=1.00+(pi-1.015)*i/R
  for j in range(N):
   a=2*pi*j/N;f=.006*sin(9*a+3*t)*sin(t)
   verts.append(((.486+f)*sin(t)*sin(a),-.395*cos(t)+.01,1.975+(.565+f)*sin(t)*cos(a)))
 for i in range(R):
  for j in range(N):k=i*N+j;l=i*N+(j+1)%N;faces.append((k,l,l+N,k+N))
 ob=mesh('Hijab | fitted face opening and hood',verts,faces,scarf,1);sol=ob.modifiers.new('Woven fabric thickness','SOLIDIFY');sol.thickness=.012
 curve('Hijab | stitched opening',[(.486*sin(1)*sin(a),-.395*cos(1)-.001,1.975+.565*sin(1)*cos(a)) for a in [j*2*pi/90 for j in range(91)]],.009,scarfedge)
 loft('Hijab | shoulder drape',[(1.21,.35,.22,0),(1.24,.44,.27,0),(1.35,.48,.265,0),(1.48,.40,.23,.025),(1.62,.27,.205,.035),(1.65,.20,.19,.04)],scarf,fold=.07)
 # Broad fabric folds are part of the draped surface, not separate cords.
 verts=[];faces=[];N=36;R=24
 for i in range(R+1):
  t=i/R;z=1.245+.34*t
  width=.36*(1-t)+.23*t
  for j in range(N+1):
   u=j/N;x=(u*2-1)*width+.04*t
   y=-.255+.055*t-.025*sin(pi*u)*sin(pi*t)+.010*sin(5*pi*u+3*t)*sin(pi*t)
   verts.append((x,y-.013,z+.025*sin(pi*u)))
 for i in range(R):
  for j in range(N):a=i*(N+1)+j;faces.append((a,a+1,a+N+2,a+N+1))
 patch=mesh('Hijab | softly folded front panel',verts,faces,scarf,1)
 sol=patch.modifiers.new('Fabric thickness','SOLIDIFY');sol.thickness=.008
 uv('Hijab | discreet gold pin',(.28,-.223,1.57),(.018,.008,.018),gold,24,16)

def person(name,sk,shirt,pants,bob=False,covered=False):
 global COL
 COL=bpy.data.collections.new(name);scene.collection.children.link(COL)
 width=.305 if not bob and not covered else .285
 loft('Cotton tee | tailored body',[(.86,width*.95,.19,0),(.89,width,.195,0),(1.03,width*.98,.197,0),(1.27,width*1.02,.185,0),(1.42,width*.94,.155,.005),(1.46,.145,.12,0),(1.48,.125,.115,0)],shirt,fold=.017)
 # Neck, collar piping, small stitched chest emblem.
 uv('Neck',(0,0,1.53),(.135,.123,.17),sk)
 curve('Tee | ribbed crew neck',[(.13*cos(a),.112*sin(a),1.474) for a in [j*2*pi/64 for j in range(65)]],.018,shirt)
 curve('Tee | stitched hem',[(width*cos(a),.193*sin(a),.9) for a in [j*2*pi/64 for j in range(65)]],.003,shirt)
 for s in [-1,1]:
  x=s*.17
  leg=loft('Trousers | tapered leg',[(.2,.115,.12,0),(.23,.126,.131,0),(.40,.126,.134,0),(.65,.139,.143,0),(.89,.145,.15,0),(.94,.139,.144,0)],pants,fold=.016);leg.location.x=x
  curve('Trousers | outer stitched seam',[(x+s*.126,-.01,.25),(x+s*.127,-.025,.5),(x+s*.14,-.018,.85)],.0025,pants)
  uv('Sneaker | rubber sole',(x,-.063,.075),(.151,.244,.066),sole)
  uv('Sneaker | canvas upper',(x,-.067,.143),(.139,.224,.092),suede)
  uv('Sneaker | toe bumper',(x,-.226,.117),(.126,.065,.046),sole)
  curve('Sneaker | contrast heel trim',[(x-.12,.055,.149),(x,.12,.16),(x+.12,.055,.149)],.012,trim)
  for k in range(4):curve('Sneaker | cotton laces',[(x-.06,-.055-k*.027,.218-k*.006),(x,-.066-k*.027,.228-k*.006),(x+.06,-.055-k*.027,.218-k*.006)],.006,sole)
  a=(s*.325,0,1.36);b=(s*.42,-.01,1.15);c=(s*.475,-.035,.91)
  sleeve=loft('Tee | tailored short sleeve',[(0,.109,.121,0),(.014,.115,.129,0),(.17,.135,.143,0),(.23,.105,.115,0)],shirt);sleeve.location=b;sleeve.rotation_mode='QUATERNION';sleeve.rotation_quaternion=(Vector(a)-Vector(b)).to_track_quat('Z','Y')
  segment('Arm | forearm',b,c,.084,.09,sk)
  uv('Hand | palm',(s*.478,-.038,.845),(.087,.063,.103),sk)
  uv('Hand | thumb',(s*.422,-.075,.86),(.038,.04,.062),sk,32,20)
  for k in range(3):curve('Hand | finger crease',[(s*(.461+k*.021),-.096,.825),(s*(.461+k*.021),-.098,.80)],.0017,sk)
 # Three distinct Malay character designs, with softer cheeks and natural almond eyes.
 # These are art-direction parameters for fictional individuals, not an ethnicity classifier.
 female=bob or covered
 cheek=.013 if bob else .023 if covered else .017
 jaw=.12 if bob else .085 if covered else .065
 nose_w=.071 if bob else .079 if covered else .083
 def gauss(x,z,cx,cz,sx,sz):return math.exp(-((x-cx)/sx)**2-((z-cz)/sz)**2)
 def front(x,z):
  nz=(z-1.97)/.458
  w=1 if nz>-.25 else 1-jaw*((-nz-.25)/.75)
  surface=-.337*math.sqrt(max(.01,1-(x/(.427*w))**2-nz*nz))
  surface-=cheek*(gauss(x,z,.225,1.90,.135,.12)+gauss(x,z,-.225,1.90,.135,.12))
  surface-=.025*gauss(x,z,0,1.84,.17,.12)
  surface-=.033*gauss(x,z,0,1.998,.044,.13)
  surface-=.078*gauss(x,z,0,1.925,nose_w,.055)
  surface-=.026*(gauss(x,z,.066,1.912,.031,.031)+gauss(x,z,-.066,1.912,.031,.031))
  return surface
 ob=uv('Face | continuous sculpt with nose cheeks and jaw',(0,0,1.97),(1,1,1),sk,192,144)
 for v in ob.data.vertices:
  x,y,z=v.co;w=1 if z>-.25 else 1-jaw*((-z-.25)/.75)
  px=x*.427*w;pz=z*.458
  if y<0:py=front(px,pz+1.97)
  else:py=y*.337
  v.co=(px,py,pz)
 # Warm matte skin, avoiding the polished doll finish of V1.
 sk.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.57
 browmat=brown if bob else hair
 for side in [-1,1]:
  uv('Ear',(side*.412,.012,1.943),(.061,.044,.092),sk)
  ear=mat(name+f' | inner ear {side}','#955e43' if sk==skin3 else '#b57956',.65,skin=True)
  uv('Ear | inner fold',(side*.449,-.013,1.947),(.018,.022,.047),ear,32,20)
  cx=side*(.165 if not covered else .17);cz=2.014 if not bob else 2.018
  ew=.097 if female else .101;eh=.047 if female else .043;tilt=side*(.010 if female else .006)
  def bounds(u):
   shape=max(0,1-u*u)**.72
   return -eh*.73*shape+tilt*u,eh*shape+tilt*u
  def eye_y(dx,dz):
   u=dx/ew;lo,hi=bounds(u)
   v=(dz-lo)/max(.0001,hi-lo)
   return front(cx+dx,cz+dz)-.005-.019*max(0,1-u*u)*max(0,sin(pi*v))
  verts=[];faces=[];N=64;R=20
  for i in range(N+1):
   u=-1+2*i/N;lo,hi=bounds(u)
   for j in range(R+1):
    dz=lo+(hi-lo)*j/R;dx=u*ew;verts.append((cx+dx,eye_y(dx,dz),cz+dz))
  for i in range(N):
   for j in range(R):a=i*(R+1)+j;faces.append((a,a+R+1,a+R+2,a+1))
  mesh('Eye | almond shaped sclera',verts,faces,white,0)
  # Iris and pupil are clipped by the almond eyelids, eliminating a googly-eye silhouette.
  def eye_disk(label,radius,material,offset):
   vs=[];fs=[];S=80;R=12
   for ring in range(R+1):
    r=radius*ring/R
    for j in range(S):
     a=2*pi*j/S;dx=r*cos(a);dz=r*sin(a)
     lo,hi=bounds(dx/ew);dz=max(lo+.0006,min(hi-.0006,dz))
     vs.append((cx+dx,eye_y(dx,dz)-offset,cz+dz))
   for ring in range(R):
    for j in range(S):a=ring*S+j;b=ring*S+(j+1)%S;fs.append((a,a+S,b+S,b))
   mesh(label,vs,fs,material,0)
  eye_disk('Eye | dark brown iris',.043,iris,.003)
  eye_disk('Eye | pupil',.023,pupil,.006)
  uv('Eye | small catchlight',(cx-.012,eye_y(-.012,.014)-.008,cz+.014),(.006,.002,.005),white,24,16)
  for upper in [True,False]:
   pts=[]
   for j in range(33):
    u=-1+2*j/32;lo,hi=bounds(u);dz=hi if upper else lo;dx=ew*u
    pts.append((cx+dx,front(cx+dx,cz+dz)-.006,cz+dz))
   curve('Eye | upper lid' if upper else 'Eye | lower lid',pts,.008 if upper else .005,sk)
   if upper:curve('Eye | restrained lash line',[(x,y-.004,z-.002) for x,y,z in pts],.0024,browmat)
  # Natural brows taper at the ends and stay close to the forehead surface.
  vs=[];fs=[]
  for j in range(33):
   t=j/32;x=cx+side*(-.085+.18*t);z=2.105+(.020 if female else .014)*sin(pi*t)-.006*t
   width=(.009 if female else .014)*sin(pi*t)**.5+.001
   for dz in [-width,width]:vs.append((x,front(x,z+dz)-.005,z+dz))
  for j in range(32):a=j*2;fs.append((a,a+1,a+3,a+2))
  mesh('Face | tapered natural eyebrow',vs,fs,browmat,1)
  for j in range(24):
   t=.04+.92*j/23;x=cx+side*(-.085+.18*t);z=2.105+(.020 if female else .014)*sin(pi*t)-.006*t
   curve('Face | individual brow hair',[(x,front(x,z)-.007,z-.002),(x+side*.004,front(x,z+.006)-.007,z+.006)],.00065,browmat)
 # Tiny nostril recess cues sit beneath the integrated nose wings.
 nostril=mat(name+' | nostril shadow','#593b30' if sk!=skin3 else '#3d291f',.8)
 for side in [-1,1]:
  x=side*.051;z=1.902
  uv('Nose | subtle nostril',(x,front(x,z)-.001,z),(.012,.003,.005),nostril,32,16)
 lip=mat(name+' | natural warm lips','#9f624d' if sk==skin else '#b47b63' if sk==skin2 else '#81503e',.62,skin=True)
 crease=mat(name+' | lip seam','#72432e' if sk!=skin3 else '#512f25',.72)
 mw=.117 if bob else .123 if covered else .12
 def mouth_line(u):return 1.801+.011*abs(u)**1.5
 for upper in [True,False]:
  vs=[];fs=[];N=64;R=10
  for i in range(N+1):
   u=-1+2*i/N;x=u*mw;base=mouth_line(u)
   shape=max(0,1-u*u)**.8
   h=(.013+.006*math.exp(-((abs(u)-.27)/.16)**2))*shape if upper else -.019*shape
   for j in range(R+1):
    t=j/R;z=base+h*t;y=front(x,z)-.002-.009*sin(pi*t)*shape
    vs.append((x,y,z))
  for i in range(N):
   for j in range(R):a=i*(R+1)+j;fs.append((a,a+R+1,a+R+2,a+1))
  mesh('Mouth | cupid bow upper lip' if upper else 'Mouth | full soft lower lip',vs,fs,lip,0)
 curve('Mouth | gentle closed smile',[(u*mw,front(u*mw,mouth_line(u))-.004,mouth_line(u)) for u in [-1+2*j/40 for j in range(41)]],.0018,crease)
 if covered:hijab()
 else:haircap(bob,brown if bob else hair,browhi if bob else hairhi)
 # Empty root keeps the sample modular and makes Three.js replacement straightforward later.
 root=bpy.data.objects.new(name,None);COL.objects.link(root)
 for o in list(COL.objects):
  if o!=root:o.parent=root
 return root,COL

models=[]
models.append(person('01 | Default orange',skin,orange,sand))
models.append(person('02 | Bob sage',skin2,green,denim,bob=True))
models.append(person('03 | Tudung pendek teal',skin3,cream,dark,covered=True))
# Save and export each editable sample in local coordinates before arranging the review stage.
for model_index,(root,col) in enumerate(models):
 bpy.ops.object.select_all(action='DESELECT')
 for o in col.objects:o.select_set(True)
 slug=['male-short','female-bob','female-tudung-short'][model_index]
 bpy.ops.export_scene.gltf(filepath=f'{OUT}/exports/{slug}.glb',export_format='GLB',use_selection=True,export_apply=True)
for i,(root,col) in enumerate(models):root.location.x=(i-1)*1.8;root.rotation_euler.z=[-.10,.08,.1][i]
COL=None
floor=mat('Studio | warm sand','#d5cec0',.8)
bpy.ops.mesh.primitive_plane_add(size=200);link(bpy.context.object,'Studio floor',floor)
def area(name,pos,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key | large softbox',(-3,-4,6),500,5,(1,.88,.76));area('Fill | cool softbox',(4,-2,3.5),220,4,(.78,.89,1));area('Rim | warm overhead',(0,3,5),750,3,(1,.90,.76))
bpy.ops.object.camera_add(location=(.55,-12,3.6));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.25))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.3;scene.camera=cam;cam.data.lens=65
scene.render.image_settings.file_format='PNG'
scene['Review status']='LOOK DEVELOPMENT ONLY — await Yusuf approval. Unrigged; procedural detail has not been baked for web.'
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/source/character-revamp-v2.blend')
scene.render.filepath=f'{OUT}/renders/lineup.png';bpy.ops.render.render(write_still=True)
# Close-up shows actual mesh / materials rather than a generated concept image.
cam.location=(.15,-8,2.5);cam.rotation_euler=(Vector((0,0,1.93))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=5.6;scene.render.resolution_x=1800;scene.render.resolution_y=700
scene.render.filepath=f'{OUT}/renders/faces.png';bpy.ops.render.render(write_still=True)
print('CHARACTER REVAMP RENDER COMPLETE')
