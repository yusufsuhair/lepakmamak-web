"""Original editable vehicle fleet. Blender +Z up/-Y forward -> game +Y up/+Z forward.
Run blender --background --python ... -- --output <fresh-directory> [--only myvi].
Meshes are authored in game metres via coord(); no downloaded model/texture assets.
"""
import argparse, json, math, sys, hashlib
from pathlib import Path
import bpy, bmesh
import numpy as np
from mathutils import Vector
from math import sin, cos, pi, sqrt
sys.path.insert(0, str(Path(__file__).resolve().parent))
import vehicle_textures as VT

P = argparse.ArgumentParser()
P.add_argument('--output', type=Path, required=True)
P.add_argument('--only')
P.add_argument('--skip-render', action='store_true')
a = P.parse_args(sys.argv[sys.argv.index('--')+1:])
OUT = a.output.resolve()
if OUT.exists(): raise RuntimeError('Choose a fresh output directory to preserve editable sources')
for d in ['source','exports','previews','textures','reports']: (OUT/d).mkdir(parents=True,exist_ok=True)
# Dimensions guide the silhouette, with original approximations for unnamed legacy styles.
SPECS = {
 'axia': dict(name='Perodua Axia AV', l=3.76,w=1.665,h=1.505,wb=2.525,r=.285,color='41bac2',kind='hatch'),
 'myvi': dict(name='Perodua Myvi AV',l=3.895,w=1.735,h=1.515,wb=2.5,r=.302,color='bf263b',kind='hatch'),
 'emas': dict(name='Proton e.MAS 7',l=4.615,w=1.901,h=1.67,wb=2.75,r=.36,color='718f89',kind='ev'),
 'avanza': dict(name='Toyota Avanza',l=4.395,w=1.73,h=1.70,wb=2.75,r=.325,color='889bab',kind='mpv'),
 'vellfire': dict(name='Toyota Vellfire',l=4.995,w=1.85,h=1.935,wb=3.0,r=.355,color='201e29',kind='van'),
 'suv': dict(name='Lepak SUV',l=4.48,w=1.86,h=1.69,wb=2.67,r=.365,color='375d72',kind='suv'),
 'sport': dict(name='Lepak GT Coupe',l=4.38,w=1.86,h=1.30,wb=2.57,r=.335,color='e6b04a',kind='coupe'),
 'ferrari': dict(name='Ferrari inspired berlinetta',l=4.56,w=1.95,h=1.21,wb=2.65,r=.345,color='c90918',kind='super'),
 'lamborghini': dict(name='Lamborghini Aventador SVJ',l=4.943,w=2.098,h=1.136,wb=2.7,r=.355,color='74952d',kind='svj'),
 'model-y': dict(name='Tesla Model Y',l=4.79,w=1.92,h=1.624,wb=2.89,r=.36,color='e2e7e9',kind='fastback'),
 'cybertruck': dict(name='Tesla Cybertruck',l=5.683,w=2.032,h=1.79,wb=3.635,r=.438,color='a1a6ad',kind='truck'),
 'police': dict(name='Polis Malaysia Patrol',l=4.48,w=1.86,h=1.69,wb=2.67,r=.365,color='edf1f3',kind='suv'),
 'f1': dict(name='Lepak Formula',l=5.15,w=2.0,h=1.12,wb=3.15,r=.36,color='088c82',kind='formula'),
}
# Plates come from the shared atlas: Malaysian-style strings that can never be a real registration.
for _style,_spec in SPECS.items():_spec['plate']=VT.PLATES.get(_style,'')

def coord(p): return (p[0],-p[2],p[1])
def rgba(s):
 c=[int(s[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c)+(1,)
def mat(name,c,rough=.4,metal=0,coat=0,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=rgba(c);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=rgba(c)
 b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
 # Coat roughness only where there is a coat: any value writes KHR_materials_clearcoat, which makes
 # three build a MeshPhysicalMaterial for trims and lamps that have no clearcoat at all.
 if coat:b.inputs['Coat Weight'].default_value=coat;b.inputs['Coat Roughness'].default_value=.16
 if emission: b.inputs['Emission Color'].default_value=rgba(c);b.inputs['Emission Strength'].default_value=emission
 return m

def tex(name,kind,n=128):
 im=bpy.data.images.new(name,width=n,height=n,alpha=False)
 pix=[]
 for y in range(n):
  for x in range(n):
   v=.38+.008*sin(y*2.31)+.004*sin(y*.61+x*.05);pix.extend([v,v,v,1])
 im.pixels.foreach_set(pix);im.filepath_raw=str(OUT/'textures'/f'{name}.png');im.file_format='PNG';im.save();im.pack()
 return im

# ------------------------------------------------------------------ shared detail atlas (V3)
RUNTIME_TEXTURES=Path(__file__).resolve().parents[3]/'public/assets/textures/vehicles'
ATLAS_FILES={'color':'atlas-color','normal':'atlas-normal','orm':'atlas-orm','flake':'paint-flake'}
def write_shared_textures():
 """Generate once per build: PNG review copies beside the sources, WebP runtime copies in public/.
 The GLBs only carry 4 px stand-ins (see placeholders()); the game loads these files once."""
 RUNTIME_TEXTURES.mkdir(parents=True,exist_ok=True)
 color,normal,orm=VT.build()
 for key,arr,data,quality in [('color',color,False,92),('normal',normal,True,94),('orm',orm,True,94),('flake',VT.flake(),True,95)]:
  h,w=arr.shape[:2];im=bpy.data.images.new(ATLAS_FILES[key],w,h)
  if data:im.colorspace_settings.name='Non-Color'
  im.pixels.foreach_set(np.flipud(np.concatenate([arr,np.ones((h,w,1))],-1)).astype(np.float32).ravel())
  im.file_format='WEBP';im.save(filepath=str(RUNTIME_TEXTURES/f'{ATLAS_FILES[key]}.webp'),quality=quality)
  im.file_format='PNG';im.save(filepath=str(OUT/'textures'/f'{ATLAS_FILES[key]}.png'));bpy.data.images.remove(im)

def shared_image(key):
 im=bpy.data.images.load(str(OUT/'textures'/f'{ATLAS_FILES[key]}.png'),check_existing=True);im.name='LM_VEH_'+ATLAS_FILES[key]
 if key!='color':im.colorspace_settings.name='Non-Color'
 im.pack();return im

def atlas_material():
 m=bpy.data.materials.new('Vehicle detail atlas');m.use_nodes=True;nt=m.node_tree;b=nt.nodes['Principled BSDF']
 col=nt.nodes.new('ShaderNodeTexImage');col.image=shared_image('color');nt.links.new(col.outputs['Color'],b.inputs['Base Color'])
 orm=nt.nodes.new('ShaderNodeTexImage');orm.image=shared_image('orm');sep=nt.nodes.new('ShaderNodeSeparateColor')
 nt.links.new(orm.outputs['Color'],sep.inputs['Color']);nt.links.new(sep.outputs['Green'],b.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],b.inputs['Metallic'])
 image_node(m,shared_image('normal'),'Normal');nt.nodes['Normal Map'].inputs['Strength'].default_value=1
 return m

def placeholders(swap):
 """Swap every shared image for a 4 px stand-in around the glTF export (swap=True), then back.
 The export keeps texture references and UVs; the runtime replaces the stand-ins by material name."""
 for m in bpy.data.materials:
  if not m.node_tree:continue
  for node in m.node_tree.nodes:
   if node.type!='TEX_IMAGE' or not node.image:continue
   if swap and node.image.name.startswith('LM_VEH_'):
    stub=bpy.data.images.get('STUB_'+node.image.name) or bpy.data.images.new('STUB_'+node.image.name,4,4)
    stub['original']=node.image.name;stub.pack();node.image=stub
   elif not swap and node.image.name.startswith('STUB_'):node.image=bpy.data.images[node.image['original']]

def atlas_pass(style,s):
 """Give every trim/alloy/tyre/plate/badge part UVs into the shared atlas and ONE material, and
 map lamp and paint UVs, so the export joins each chassis and wheel into few draw calls."""
 ATLAS=atlas_material();keys={m.name:k for k,m in M.items()}
 # Boolean arch cuts leave the cutter's trim faces on the painted shell: give them their own object,
 # or the join files them under paint and they cost an extra draw per car.
 for o in [o for o in bpy.context.scene.objects if o.type=='MESH' and len({p.material_index for p in o.data.polygons})>1]:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
 for o in bpy.context.scene.objects:
  if o.type=='MESH' and len(o.data.materials)>1 and o.data.polygons:
   used=o.data.materials[o.data.polygons[0].material_index];o.data.materials.clear();o.data.materials.append(used)
   o.data.polygons.foreach_set('material_index',[0]*len(o.data.polygons))
 lamp_cells={'white':'white','blueled':'white','red':'red','indicatorL':'amber','indicatorR':'amber','reverse':'reverse'}
 flat_alias={'caliper':'caliper_red' if s['kind'] in ['super','svj','coupe','formula'] else 'caliper'}
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH' or not o.data.materials:continue
  key=keys.get(o.data.materials[0].name)
  if key in ['glass',None]:continue
  me=o.data;uvl=me.uv_layers.active or me.uv_layers.new(name='UVMap');mw=o.matrix_world;rot=mw.to_3x3()
  game=[(p.x,p.z,-p.y) for p in (mw@v.co for v in me.vertices)]
  lo=[min(g[i] for g in game) for i in range(3)];hi=[max(g[i] for g in game) for i in range(3)];ext=[max(hi[i]-lo[i],1e-6) for i in range(3)]
  if key=='paint':
   # Continuous, seam-free metric UVs for the flake: u along the car (skewed by x), v up and round.
   for li,loop in enumerate(me.loops):
    x,y,z=game[loop.vertex_index];uvl.data[li].uv=(z+.5*x,y+abs(x))
   continue
  if key in lamp_cells:
   a,b=sorted(range(3),key=lambda i:-ext[i])[:2]
   rect=(*VT.LAMPS[lamp_cells[key]],VT.CELL,VT.CELL)
   for li,loop in enumerate(me.loops):
    g=game[loop.vertex_index];uvl.data[li].uv=VT.uv(rect,.08+.84*(g[a]-lo[a])/ext[a],.08+.84*(g[b]-lo[b])/ext[b])
   continue
  base=flat_alias.get(key,key)
  if o.name.startswith('Inset optical reflector well'):base='gunmetal'   # chrome reflector behind the lens
  if base not in VT.FLAT:base='trim'
  rect=o.get('atlas_rect');face=o.get('atlas_face');n=VT.TYRE_U
  for poly in me.polygons:
   nrm=rot@poly.normal;nrm=(nrm.x,nrm.z,-nrm.y)
   ids=[me.loops[li].vertex_index for li in poly.loop_indices]
   for li,vi in zip(poly.loop_indices,ids):
    g=game[vi];value=VT.flat_uv(base)
    if rect and {'front':nrm[2]>.7,'rear':nrm[2]<-.7,'right':nrm[0]>.7,'left':nrm[0]<-.7}[face]:
     t=(g[1]-lo[1])/ext[1]
     s_=((g[0]-lo[0])/ext[0] if face=='front' else (hi[0]-g[0])/ext[0] if face=='rear' else (hi[2]-g[2])/ext[2] if face=='right' else (g[2]-lo[2])/ext[2])
     value=VT.uv(tuple(rect),s_,t)
    elif o.name.startswith('Tyre shoulder and tread') and style!='f1':
     ring=48;j=vi//ring;k=vi%ring;ks=[i%ring for i in ids];js=[i//ring for i in ids]
     if k==0 and max(ks)==ring-1:k=ring          # close the loop without a smeared seam face
     if j==0 and max(js)==len(n)-1:j=len(n)-1    # the hidden inner barrel face
     value=VT.uv(VT.TYRE,n[j],.01+.98*k/ring)
    elif o.name.startswith('Brushed brake rotor') and abs(nrm[0])>.7:
     cy,cz=(lo[1]+hi[1])/2,(lo[2]+hi[2])/2;R=max(ext[1],ext[2])/2
     value=VT.uv(VT.DISC,.5+(g[2]-cz)/R*.49,.5+(g[1]-cy)/R*.49)
    uvl.data[li].uv=value
  for i in range(len(me.materials)):me.materials[i]=ATLAS

def image_node(m,im,socket):
 nodes=m.node_tree.nodes;links=m.node_tree.links;b=nodes.get('Principled BSDF')
 t=nodes.new('ShaderNodeTexImage');t.image=im
 if socket=='Normal':
  t.image.colorspace_settings.name='Non-Color';normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.45
  links.new(t.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],b.inputs['Normal'])
 else:
  if socket=='Roughness':t.image.colorspace_settings.name='Non-Color'
  links.new(t.outputs['Color'],b.inputs[socket])

def mesh(name,verts,faces,m,smooth=False):
 data=bpy.data.meshes.new(name);data.from_pydata([coord(p) for p in verts],[],faces);data.update()
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(m)
 # Metric planar UVs, replaced by cylindrical UVs for tyre tread.
 uv=data.uv_layers.new(name='UVMap')
 for poly in data.polygons:
  poly.use_smooth=smooth
  for li in poly.loop_indices:
   p=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(p.x*3+p.y*.25,p.z*3+p.y*.25)
 return o

def bevel(o,width=.025,segments=3):
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=width;mod.segments=segments
 bpy.ops.object.modifier_apply(modifier=mod.name)
 # Weighted normals keep broad panels smooth without inflating the silhouette.
 mod=o.modifiers.new('Panel normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=30
 bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def box(name,p,size,m,b=.015):
 x,y,z=p;u,v,w=[s/2 for s in size]
 vs=[(x+sx*u,y+sy*v,z+sz*w) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 o=mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],m)
 return bevel(o,min(b,min(size)*.4),3) if b else o

def path(name,pts,r,m):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=r;cu.bevel_resolution=1
 sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for p,v in zip(sp.points,pts):p.co=(*coord(v),1)
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);cu.materials.append(m)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
 return o

def cyl(name,p,r,depth,m,axis='x',n=40):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=coord(p))
 o=bpy.context.object;o.name=name
 if axis=='x':o.rotation_euler[1]=pi/2
 elif axis=='z':o.rotation_euler[0]=pi/2
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
 o.select_set(False);return o

def label(name,text,p,width,height,m,face='front',depth=.012):
 """A thin atlas-textured plate instead of extruded font geometry: registration plates, POLIS and
 the Formula number keep their characters; any other badge text becomes a generic chrome bar."""
 cell=(VT.plate_cell(next(k for k,v in VT.PLATES.items() if v==text)) if text in VT.PLATES.values()
  else VT.BADGES['polis' if text=='POLIS' else 'roundel' if text=='63' else 'emblem' if not text else 'bar'])
 size=(width,height,depth) if face in ['front','rear'] else (depth,height,width)
 o=box(name,p,size,m,min(.004,depth*.3));o['atlas_rect']=cell;o['atlas_face']=face
 return o

def quad(name,pts,m):return mesh(name,pts,[(0,1,2,3)],m)

def glazing(name,pts,m,axis=2,direction=1):
 vs=[];fs=[];n=24 if axis==0 else 8
 for j in range(n+1):
  v=j/n
  for i in range(n+1):
   u=i/n;p=[(1-v)*((1-u)*pts[0][k]+u*pts[1][k])+v*((1-u)*pts[3][k]+u*pts[2][k]) for k in range(3)]
   p[axis] += direction*.026*sin(pi*u)*sin(pi*v);vs.append(p)
 for j in range(n):
  for i in range(n):
   k=j*(n+1)+i;fs.append((k,k+1,k+n+2,k+n+1))
 o=mesh(name,vs,fs,m,True)
 return o

def wheel(style,s,side,z,front):
 r=s['r'];x=side*(s['w']/2-.07);y=r+.012
 pivot=bpy.data.objects.new(('wheel_F' if front else 'wheel_R')+('R' if side>0 else 'L'),None);bpy.context.collection.objects.link(pivot);pivot.location=coord((x,y,z));pivot['wheelRadius']=r
 before=set(bpy.context.scene.objects)
 # Revolved shoulder/sidewall, centred on X so runtime wheel.rotation.x is valid.
 profile=[(-.105,r*.70),(-.13,r*.78),(-.132,r*.9),(-.10,r*.98),(-.065,r),(.065,r),(.10,r*.98),(.132,r*.9),(.13,r*.78),(.105,r*.70)]
 vs=[];fs=[];n=48
 for dx,rad in profile:
  for k in range(n):t=2*pi*k/n;vs.append((x+dx,y+rad*cos(t),z+rad*sin(t)))
 for j in range(len(profile)):
  for k in range(n):fs.append((j*n+k,j*n+(k+1)%n,((j+1)%len(profile))*n+(k+1)%n,((j+1)%len(profile))*n+k))
 tyre=mesh('Tyre shoulder and tread',vs,fs,M['rubber'],True)
 for poly in tyre.data.polygons:
  for li in poly.loop_indices:
   vi=tyre.data.loops[li].vertex_index;tyre.data.uv_layers.active.data[li].uv=(vi//n/(len(profile)-1),vi%n/n*4)
 barrel=cyl('Forged rim barrel',(x,y,z),r*.71,.22,M['darkmetal'])
 # Open the outboard end so the drilled rotor and caliper read between the spokes.
 bm=bmesh.new();bm.from_mesh(barrel.data)
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if len(f.verts)>4 and f.normal.x*side>.5],context='FACES_ONLY')
 bm.to_mesh(barrel.data);bm.free()
 cyl('Brushed brake rotor',(x+side*.103,y,z),r*.60,.012,M['metal'])
 cyl('Wheel centre lock',(x+side*.147,y,z),r*.17,.035,M['metal'])
 for k in range(10 if style!='cybertruck' else 7):
  t=2*pi*k/(10 if style!='cybertruck' else 7)
  radial=[(x+side*.141,y+rad*cos(t+off),z+rad*sin(t+off)) for rad,off in [(r*.18,-.10),(r*.68,-.055),(r*.68,.10),(r*.18,.20)]]
  quad('Machined split spoke',radial,M['metal'] if style!='cybertruck' else M['darkmetal'])
 for k in range(5):
  t=2*pi*k/5;cyl('Lug',(x+side*.17,y+r*.115*cos(t),z+r*.115*sin(t)),.018,.014,M['darkmetal'],n=8)
 for o in set(bpy.context.scene.objects)-before:
  mw=o.matrix_world.copy();o.parent=pivot;o.matrix_world=mw
 # Calipers stay fixed as the wheels turn.
 box('Brake caliper',(x+side*.09,y+r*.27,z+r*.4),(.09,r*.45,r*.23),M['caliper'])
 # Sidewall embossed line and rim lip.
 for rad,rr,ma in [(r*.73,.009,M['metal']),(r*.91,.003,M['rubber'])]:
  pts=[(x+side*.137,y+rad*cos(t*2*pi/48),z+rad*sin(t*2*pi/48)) for t in range(49)]
  o=path('Rim lip' if ma==M['metal'] else 'Sidewall ring',pts,rr,ma);mw=o.matrix_world.copy();o.parent=pivot;o.matrix_world=mw
 return pivot

def body_shell(s):
 l,w,h=s['l'],s['w'],s['h'];belt=h*(.63 if s['kind'] not in ['super','svj','coupe'] else .62)
 verts=[];faces=[];n=40
 # Longitudinal sculpted sections: taper the nose/tail, crown hood and chamfer sills.
 for i in range(n+1):
  t=-1+2*i/n;z=t*l/2;end=max(0,(abs(t)-.73)/.27)
  width=w/2*(1-.065*end**2);top=belt-.025*end**2
  sport=s['kind'] in ['svj','super','coupe']
  bulge=max(math.exp(-((z-az)/.49)**2) for az in [-s['wb']/2,s['wb']/2])*(.16 if sport else .015)
  shoulder=top+bulge
  section=[(-width*.84,.22),(-width,.34),(-width,shoulder-.08),(-width*.94,shoulder),(-width*.58,top+.025),(0,top+.04),(width*.58,top+.025),(width*.94,shoulder),(width,shoulder-.08),(width,.34),(width*.84,.22)]
  verts += [(x,y,z) for x,y in section]
  if i:
   for j in range(11):faces.append(((i-1)*11+j,(i-1)*11+(j+1)%11,i*11+(j+1)%11,i*11+j))
 faces += [tuple(reversed(range(11))),tuple(n*11+j for j in range(11))]
 o=mesh('Sculpted monocoque',verts,faces,M['paint'],True)
 bpy.context.view_layer.objects.active=o
 if s['kind']!='truck':
  sub=o.modifiers.new('Continuous body curvature','SUBSURF');sub.levels=1
  bpy.ops.object.modifier_apply(modifier=sub.name)
 # Actual open wheel arches, not black discs painted onto a closed body.
 for z in [-s['wb']/2,s['wb']/2]:
  for side in [-1,1]:
   cut=cyl('Fender cutter',(side*w/2,s['r']+.012,z),s['r']+.054,.48,M['trim'],n=48)
   bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Wheel arch aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
   bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
 bevel(o,.012,2)
 return belt

def cabin(s,belt):
 l,w,h=s['l'],s['w'],s['h'];kind=s['kind'];sport=kind in ['coupe','super','svj']
 if kind=='truck': stations=[(-l*.41,belt+.1,w*.43),(-.35,h-.025,w*.41),(l*.14,h-.025,w*.40),(l*.34,belt+.01,w*.44)]
 elif kind=='van':stations=[(-l*.44,belt+.04,w*.45),(-l*.36,h-.02,w*.43),(l*.15,h-.02,w*.43),(l*.34,belt+.02,w*.45)]
 elif sport:stations=[(-l*.24,belt+.02,w*.43),(-l*.12,h-.015,w*.35),(l*.035,h-.015,w*.34),(l*.23,belt+.01,w*.43)]
 else:stations=[(-l*(.35 if kind=='fastback' else .43),belt+.02,w*.44),(-l*(.34 if kind=='hatch' else .28),h-.025,w*.40),(l*.06,h-.025,w*.39),(l*.27,belt+.01,w*.44)]
 if kind=='truck':stations=[(-l*.29,belt+.12,w*.44),(-l*.025,h-.025,w*.40),(l*.02,h-.025,w*.40),(l*.34,belt+.01,w*.44)]
 back,rb,rf,front=stations
 # Tapered roof section; rear/windscreen are separate panels with bordered glazing.
 verts=[]
 for z,y,x in stations:verts += [(-x,belt,z),(-x,y-.035,z),(-x*.88,y,z),(x*.88,y,z),(x,y-.035,z),(x,belt,z)]
 faces=[]
 for i in range(3):
  for j in range(5):faces.append((i*6+j,i*6+j+1,(i+1)*6+j+1,(i+1)*6+j))
 faces += [(0,1,2,3,4,5),(18,23,22,21,20,19)]
 roof=mesh('Cabin painted pillars and crown',verts,faces,M['paint'],kind not in ['svj','truck']);bevel(roof,.018,3)
 for side in [-1,1]:
  pts=[(side*(back[2]+.006),belt+.035,back[0]+.08),(side*(front[2]+.006),belt+.035,front[0]-.09),(side*(rf[2]+.008),rf[1]-.06,rf[0]-.025),(side*(rb[2]+.008),rb[1]-.06,rb[0]+.045)]
  if side<0:pts.reverse()
  glazing('Solar tinted side glazing',pts,M['glass'],0,side)
  path('Window seal',pts+[pts[0]],.012,M['trim'])
  # Mirrors have a painted cap, lower black mount, reflective face and repeater strip.
  mx=side*(w/2+.065);mz=front[0]-.18;my=belt+.10
  box('Mirror mount',(side*w/2,my-.01,mz),(.16,.065,.12),M['trim'])
  box('Painted mirror cap',(mx,my,mz),(.22,.115,.21),M['paint'],.035)
  box('Mirror reflective face',(mx,my,mz-.112),(.17,.072,.012),M['metal'],.018)
  box('Mirror indicator',(mx,my-.012,mz+.107),(.16,.018,.008),M['white'])
 for rear,lower,upper in [(False,front,rf),(True,back,rb)]:
  zz=.013*(-1 if rear else 1)
  pts=[(-lower[2]*.89,belt+.055,lower[0]+zz), (lower[2]*.89,belt+.055,lower[0]+zz),(upper[2]*.87,upper[1]-.004,upper[0]+zz),(-upper[2]*.87,upper[1]-.004,upper[0]+zz)]
  if rear:pts.reverse()
  glazing('Rear windshield' if rear else 'Front windshield',pts,M['glass'],2,-1 if rear else 1);path('Bonded windscreen surround',pts+[pts[0]],.012,M['trim'])
 # Roof glass where appropriate; no glass block extending through the interior.
 if kind in ['ev','fastback']:
  box('Panoramic glass roof',(0,h+.001,(rb[0]+rf[0])/2),(w*.65,.015,(rf[0]-rb[0])*.84),M['glass'],.006)
 # Dark detailed interior visible at glancing angles, including Malaysian RHD steering.
 box('Dashboard',(0,belt-.03,front[0]-.20),(w*.77,.14,.28),M['trim'],.045)
 for side in [-1,1]:
  box('Front seat cushion',(side*.35,.47,-.1),(.47,.13,.48),M['leather'],.05)
  box('Front seat back',(side*.35,.70,-.37),(.47,.47,.13),M['leather'],.045)
  box('Head restraint',(side*.35,.97,-.38),(.23,.19,.10),M['leather'],.035)
 if not sport:box('Rear bench',(0,.55,-.9),(w*.7,.22,.5),M['leather'],.05)
 sy=min(belt+.03,h-.22)
 path('Right hand drive steering',[(.35+.135*cos(t*2*pi/32),sy+.135*sin(t*2*pi/32),front[0]-.36) for t in range(33)],.018,M['trim'])
 box('Steering spoke',(.35,sy,front[0]-.36),(.23,.035,.04),M['metal'])
 box('Infotainment',(0,belt+.065,front[0]-.27),(.27,.17,.015),M['glass'])
 return stations

def trim_and_lights(style,s,belt,stations):
 l,w,h=s['l'],s['w'],s['h'];kind=s['kind'];sport=kind in ['super','svj','coupe'];z=l/2
 for side in [-1,1]:
  x=side*(w/2+.004)
  box('Rocker aero sill',(x,.27,0),(.065,.10,s['wb']*.66),M['carbon'] if sport else M['trim'])
  for dz in ([-.25] if sport else [-.20,.71]):
   path('Door shut line',[(x,.36,dz),(x,belt-.11,dz),(x*.955,belt+.012,dz)],.004,M['trim'])
  path('Shoulder crease',[(x*.94,belt+.003,-l*.4),(x,belt-.016,0),(x*.94,belt-.02,l*.39)],.006,M['paint'])
  for dz in ([-.02] if sport else [-.77,.31]):box('Flush door handle' if kind in ['ev','truck','fastback'] else 'Door handle',(x,belt-.1,dz),(.025,.032,.17),M['darkmetal'] if kind in ['ev','truck','fastback'] else M['metal'])
  # Painted fender arch edge tracks actual openings.
  for az in [-s['wb']/2,s['wb']/2]:
   rr=s['r']+.058
   pts=[(side*w/2,s['r']+.012+rr*sin(t*pi/30),az+rr*cos(t*pi/30)) for t in range(31)]
   path('Fender arch lip',pts,.017 if kind in ['suv','truck'] else .008,M['trim'] if kind in ['suv','truck'] else M['paint'])
  # Segmented headlight housing/lens, under a slender brow.
  lx=side*w*.32;ly=belt-.10
  if style in ['myvi','axia']:
   # Swept outer corner and lower chrome optical blade follow Perodua's fascia.
   inner=side*w*.18;outer=side*w*.455
   pts=[(inner,belt-.09,z+.014),(outer,belt-.025,z-.002),(outer,belt-.095,z+.012),(inner,belt-.17,z+.021)]
   if side<0:pts.reverse()
   quad('Swept headlamp lens',pts,M['glass'])
   path('Swept white light guide',[(inner,belt-.085,z+.026),(outer,belt-.019,z+.015)],.012,M['white'])
   path('Chrome lamp blade',[(inner,belt-.169,z+.028),(outer,belt-.095,z+.019)],.006,M['metal'])
   for f in [.29,.38]:cyl('LED projector',(side*w*f,belt-.095,z+.023),.028,.008,M['white'],axis='z',n=20)
  elif kind!='truck':
   box('Headlamp smoked housing',(lx,ly,z-.012),(w*.25,.085 if not sport else .065,.04),M['trim'],.03)
   if kind=='svj':
    for offset in [-.09,.055]:
     path('SVJ Y signature',[(lx+offset,ly+.029,z+.019),(lx+offset+.042,ly,z+.019),(lx+offset+.018,ly-.035,z+.019)],.011,M['white'])
   else:
    box('LED daytime signature',(lx,ly+.02,z+.018),(w*.23,.022,.012),M['white'],.007)
    for dx in [-.08,.06]:cyl('Projector optic',(lx+dx,ly-.018,z+.016),.024,.008,M['white'],axis='z',n=16)
  tailY=belt-.055
  if kind!='truck':box('Rear smoked housing',(side*w*.34,tailY,-z+.012),(w*.25,.12,.07),M['trim'],.025)
  if style=='myvi':
   path('Myvi rear L LED',[(side*w*.43,tailY-.18,-z-.025),(side*w*.43,tailY+.035,-z-.025),(side*w*.25,tailY+.035,-z-.025)],.025,M['red'])
   box('Myvi vertical DRL',(side*w*.40,belt-.28,z+.012),(.025,.18,.014),M['white'])
  elif kind=='svj':
   for dx in [-.10,0,.10]:path('Rear Y LED',[(side*w*.34+dx-.028,tailY+.025,-z-.03),(side*w*.34+dx,tailY,-z-.03),(side*w*.34+dx+.025,tailY+.025,-z-.03)],.012,M['red'])
  elif kind!='truck':box('Rear LED lens',(side*w*.34,tailY,-z-.032),(w*.22,.035,.013),M['red'],.008)
  box('Bumper reflector',(side*w*.37,.38,-z-.015),(.14,.025,.015),M['red'])
  if kind not in ['ev','fastback','truck']:
   box('Front corner intake',(side*w*.36,.45,z-.005),(w*.19,.15,.055),M['trim'],.022)
   for dy in [-.035,.025]:box('Intake louvre',(side*w*.36,.45+dy,z+.026),(w*.15,.012,.02),M['darkmetal'],.005)
 if not sport and kind!='truck':
  box('Rear roof spoiler',(0,h-.025,stations[1][0]-.035),(w*.82,.035,.19),M['paint'])
 # Closed EV face or grille-specific treatment.
 if style in ['myvi','axia']:
  quad('Perodua trapezoid grille',[(-w*.30,.38,z+.038),(w*.30,.38,z+.038),(w*.215,belt-.17,z+.038),(-w*.215,belt-.17,z+.038)],M['trim'])
  for i in range(7):box('Grille horizontal mesh',(0,.41+i*.041,z+.047),(w*(.55-i*.018),.009,.008),M['darkmetal'],.002)
  box('Perodua chrome grille brow',(0,belt-.148,z+.047),(w*.40,.022,.016),M['metal'])
 elif kind=='svj':
  for side in [-1,1]:
   quad('SVJ hexagonal front duct',[(side*.24,.30,z+.035),(side*.85,.32,z+.035),(side*.77,.52,z+.035),(side*.34,.51,z+.035)],M['carbon'])
  box('SVJ nose bridge',(0,.51,z+.03),(.29,.075,.05),M['paint'])
 elif kind in ['ev','fastback','truck']:
  box('EV lower cooling intake',(0,.36,z-.015),(w*.65,.1,.055),M['trim'])
  if kind=='ev':
   box('Connected rear light bar',(0,belt-.03,-z-.038),(w*.71,.027,.014),M['red'])
   label('Proton rear lettering','P R O T O N',(0,belt-.14,-z-.04),.56,.045,M['metal'],'rear')
 else:
  gh=.50 if kind=='van' else .23
  box('Recessed grille',(0,belt-.25,z+.004),(w*.55,gh,.065),M['trim'],.026)
  if kind=='van':
   for i in range(8):box('Vellfire chrome grille',(0,belt-.46+i*.057,z+.042),(w*.56,.022,.03),M['metal'],.006)
  else:
   for i in range(9):box('Grille fin',((i-4)*w*.054,belt-.25,z+.041),(.009,gh*.85,.015),M['darkmetal'],.003)
   if style in ['axia','myvi','avanza','suv','police']:box('Grille chrome bridge',(0,belt-.135,z+.04),(w*.49,.025,.02),M['metal'])
 box('Front lower splitter',(0,.235,z-.035),(w*.88,.05,.15),M['carbon'] if sport else M['trim'])
 box('Rear diffuser',(0,.255,-z+.035),(w*.82,.115,.18),M['carbon'] if sport else M['trim'])
 if sport:
  for x in [-.6,-.3,0,.3,.6]:box('Diffuser strake',(x,.23,-z-.01),(.018,.14,.24),M['carbon'])
  for side in [-1,1]:
   # Side air ducts have a triangular contour instead of rectangular stickers.
   x=side*(w/2+.013)
   quad('Side intake',[(x,.36,-.52),(x,belt-.015,-.74),(x,belt-.025,-.20),(x,.48,-.10)],M['carbon'])
   for dx in [-.05,.05]:cyl('Polished exhaust tip',(side*.35+dx,.43,-z-.06),.045,.13,M['metal'],axis='z',n=24)
 if s['plate']:
  for rear in [False,True]:
   pz=(-1 if rear else 1)*(z+.065)
   label('Malaysian registration plate',s['plate'],(0,.47,pz),.51,.115,M['plate'],'rear' if rear else 'front',.022)
 # Compact marque/model identification at rear, not replacing the registration plate.
 badge={'myvi':'MYVI','axia':'AXIA','emas':'e.MAS 7','avanza':'AVANZA','vellfire':'VELLFIRE','lamborghini':'SVJ','model-y':'T E S L A','cybertruck':'CYBERTRUCK','sport':'GT','ferrari':'FERRARI','suv':'LEPAK','police':'POLIS'}[style]
 label('Model badge',badge,(w*.25,belt-.14,-z-.045),.35,.045,M['metal'],'rear')
 if style in ['myvi','axia']:
  # Generic oval chrome emblem at the front: a shape, never a manufacturer mark.
  label('Front emblem','',(0,belt-.115,z+.062),.12,.07,M['metal'],'front')
 if style=='lamborghini':
  box('SVJ carbon rear wing',(0,h-.025,-l*.37),(1.88,.045,.34),M['carbon'],.009)
  for side in [-1,1]:
   box('SVJ wing support',(side*.49,.91,-l*.36),(.038,.34,.11),M['carbon'])
   box('SVJ wing endplate',(side*.91,h-.005,-l*.37),(.035,.115,.39),M['carbon'])
  for i in range(7):box('Engine cover louvre',(0,belt+.065,-l*.19-i*.09),(w*.5,.016,.043),M['carbon'],.003)
  path('Bonnet central crease',[(0,belt+.042,l*.25),(0,belt-.04,l*.46)],.006,M['trim'])
 if style=='cybertruck':
  # Faceted stainless cargo sides, tonneau roll slats and full-width front/rear bars.
  box('Cybertruck front light bar',(0,belt+.013,z+.043),(w*.93,.035,.022),M['white'])
  box('Cybertruck rear light bar',(0,belt+.01,-z-.045),(w*.94,.03,.022),M['red'])
  box('Tonneau cargo bed',(0,belt+.04,-l*.32),(w*.87,.04,l*.27),M['trim'])
  for i in range(22):box('Tonneau rib',(0,belt+.064,-l*.45+i*l*.012),(w*.85,.014,.018),M['darkmetal'],.003)
  for side in [-1,1]:
   quad('Stainless sail panel',[(side*w*.475,belt,-l*.49),(side*w*.46,belt+.02,-l*.08),(side*w*.40,h-.04,-l*.025),(side*w*.46,belt+.12,-l*.44)],M['paint'])
 if style=='police':
  for side in [-1,1]:
   box('Police blue side stripe',(side*(w/2+.014),belt-.16,0),(.018,.22,1.95),M['blue'])
   label('Police door marking','POLIS',(side*(w/2+.026),belt-.13,.03),.70,.15,M['blue'],'right' if side>0 else 'left')
  box('Lightbar mount',(0,h+.045,0),(1.10,.07,.23),M['trim'])
  box('Emergency blue light',(-.29,h+.12,0),(.48,.105,.21),M['blueled'])
  box('Emergency red light',(.29,h+.12,0),(.48,.105,.21),M['red'])

def formula(s):
 l,w,h=s['l'],s['w'],s['h']
 # Tapered nose with swept front wing, sidepods, rear wing and exposed suspension.
 vs=[]
 for z,y,ww in [(-2.1,.56,.26),(-1.2,.72,.46),(-.35,.64,.43),(.35,.5,.31),(1.9,.30,.13),(2.36,.27,.10)]:
  vs += [(-ww,.25,z),(-ww,y,z),(ww,y,z),(ww,.25,z)]
 fs=[]
 for i in range(5):
  for j in range(4):fs.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
 fs += [(0,3,2,1),(20,21,22,23)]
 bevel(mesh('Formula tapered chassis',vs,fs,M['paint'],True),.03)
 box('Carbon floor',(0,.21,-.30),(1.52,.065,2.9),M['carbon'])
 for side in [-1,1]:
  box('Sidepod',(side*.55,.48,-.68),(.46,.35,1.42),M['paint'],.12)
  box('Radiator inlet',(side*.55,.53,.048),(.34,.16,.012),M['trim'])
  for z in [-s['wb']/2,s['wb']/2]:
   for yy in [.28,.47]:
    path('Suspension wishbone',[(side*.24,yy,z-.25),(side*.89,.36,z),(side*.24,yy,z+.25)],.014,M['carbon'])
  for z,y in [(2.2,.25),(-2.12,.91)]:
   box('Wing endplate',(side*.91,y,z),(.027,.27,.45),M['carbon'])
 for dz in [-.11,0,.11]:box('Front multi element wing',(0,.24+dz*.25,2.19+dz),(1.87,.028,.10),M['carbon'])
 for yy,zz in [(.88,-2.1),(1.0,-2.14)]:box('Rear multi element wing',(0,yy,zz),(1.82,.045,.25),M['carbon'])
 path('Halo arch',[(-.31,.76,-.57),(-.30,1.06,-.32),(0,1.09,.02),(.30,1.06,-.32),(.31,.76,-.57)],.027,M['carbon'])
 path('Halo centre strut',[(0,.59,.15),(0,1.09,.02)],.025,M['carbon'])
 box('Cockpit opening',(0,.66,-.47),(.45,.10,.74),M['trim'],.075)
 box('Cockpit seat back',(0,.76,-.72),(.30,.28,.10),M['leather'],.04)
 for side in [-1,1]:box('Rear wing pylon',(side*.25,.70,-2.08),(.045,.51,.10),M['carbon'])
 label('Formula number','63',(0,.36,2.50),.15,.085,M['whiteletter'])


# The second pass supplies distinct longitudinal profiles and open, curved cabins.
# Keep this entry point and the hand-edit/export workflow stable.
exec(compile((Path(__file__).parent/'realism.py').read_text(), 'realism.py', 'exec'))

reports=[]
write_shared_textures()
for style,s in SPECS.items():
 if a.only and style not in a.only.split(','):continue
 bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 M={
 'paint':mat('Automotive clearcoat',s['color'],.28,.32,1),
 'trim':mat('Satin black trim','10151b',.46),
 'glass':mat('Solar glass','0d1519',.05),
 'rubber':mat('Tyre rubber','171a1c',.78),
 'metal':mat('Machined aluminium','b3bec5',.26,.9),
 'darkmetal':mat('Graphite alloy','30343b',.32,.75),
 'carbon':mat('Carbon twill','252831',.34,.32,.65),
 'leather':mat('Charcoal upholstery','26272a',.73),
 'white':mat('White LED optics','dcefff',.21,.1,0,1.6),
 'red':mat('Red LED optics','b90716',.24,.2,0,1.5),
 'plate':mat('Black registration plate','050608',.48),
 'whiteletter':mat('White lettering','eeeeed',.5),
 'caliper':mat('Brake caliper','a91522' if s['kind'] in ['svj','super','coupe'] else '42474a',.43,.3),
 'blue':mat('Police blue','093d87',.33,.25,.5),
 'blueled':mat('Police blue LED','126cfe',.24,0,0,2),
 'indicatorL':mat('Indicator left','ff970a',.22,.1,0,0),
 'indicatorR':mat('Indicator right','ff970a',.22,.1,0,0),
 'reverse':mat('Reverse optics','d4d9db',.25,.1),
 'lens':mat('Optical lens','50616a',.12,.2,.8),
 }
 if style!='cybertruck':image_node(M['paint'],shared_image('flake'),'Normal');M['paint'].node_tree.nodes['Normal Map'].inputs['Strength'].default_value=.2
 for key in ['white','red','indicatorL','indicatorR','reverse','blueled']:
  # Lamps sample the atlas lens cells; the runtime also uses them as emissive maps.
  image_node(M[key],shared_image('color'),'Base Color')
 if style=='cybertruck':
  M['paint'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.92
  M['paint'].node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.05
  image_node(M['paint'],tex('Brushed_steel_roughness','steel'),'Roughness')
 if s['kind']=='formula':formula(s)
 else:
  belt=body_shell(s);stations=cabin(s,belt);trim_and_lights(style,s,belt,stations)
 pivots=[]
 for side in [-1,1]:
  for front in [False,True]:pivots.append(wheel(style,s,side,s['wb']/2*(1 if front else -1),front))
 bpy.context.view_layer.update();finish_panels(s);atlas_pass(style,s)
 # Body and calipers can move with suspension independently of rolling axles.
 chassis=bpy.data.objects.new('chassis',None);scene.collection.objects.link(chassis)
 for o in list(scene.objects):
  if o!=chassis and o.parent is None and o not in pivots:
   mw=o.matrix_world.copy();o.parent=chassis;o.matrix_world=mw
 for pivot in pivots:
  steer=bpy.data.objects.new(pivot.name.replace('wheel_','steer_'),None);scene.collection.objects.link(steer)
  steer.location=pivot.location.copy();pivot.parent=steer;pivot.location=(0,0,0)
 # Retain all independently editable authored components in SOURCE; merged export is a copy.
 bpy.context.view_layer.update()
 authored=list(scene.objects)
 export=bpy.data.collections.new('EXPORT');scene.collection.children.link(export)
 source=bpy.data.collections.new('SOURCE');scene.collection.children.link(source)
 for o in authored:
  for col in list(o.users_collection):col.objects.unlink(o)
  source.objects.link(o)
 copies={}
 for o in authored:
  c=o.copy()
  if o.data:c.data=o.data.copy()
  export.objects.link(c);copies[o]=c
 for o,c in copies.items():
  if o.parent:c.parent=copies[o.parent]
 # Hide authored geometry while joining export; source retained inside the .blend.
 source.hide_viewport=True;source.hide_render=True
 for o in authored:o.hide_set(True)
 # Join only export meshes.
 buckets={}
 for o in copies.values():
  if o.type=='MESH':buckets.setdefault((o.parent.name if o.parent else 'body',o.data.materials[0].name),[]).append(o)
 for (parent,ma),objs in buckets.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name=parent+'__'+ma
 for o in copies.values():
  try:
   if o.type=='EMPTY':o.name=o.name.split('.')[0]
  except ReferenceError:pass
 # Blender names are globally unique; hidden source pivots must not steal exported names.
 for o in authored:
  if o.type=='EMPTY':o.name='SOURCE_'+o.name
 for o in export.objects:
  if o.type=='EMPTY':o.name=o.name.split('.')[0]
 bpy.ops.object.select_all(action='DESELECT')
 for o in export.objects:o.select_set(True)
 triangles=0
 for o in export.objects:
  if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
 glb=OUT/'exports'/f'{style}.glb'
 placeholders(True)
 bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=True,export_normals=True)
 # Preview studio exists only in the editable .blend, never in runtime GLBs.
 scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
 scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.view_settings.view_transform='AgX'
 world=bpy.data.worlds.new('Studio daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.29,.36,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45;scene.world=world
 ground=box('PREVIEW studio floor',(0,-.035,0),(200,.05,200),mat('Studio floor','454951',.55))
 for name,loc,energy,size in [('Key',(3,5,4),1600,5),('Rim',(-4,4,-2),2100,5),('Front',(1,3,6),1200,4)]:
  data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='RECTANGLE';data.size=size;data.size_y=2
  o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=coord(loc);o.rotation_euler=(Vector(coord((0,.7,0)))-o.location).to_track_quat('-Z','Y').to_euler()
 camd=bpy.data.cameras.new('Preview');cam=bpy.data.objects.new('Preview',camd);scene.collection.objects.link(cam);cam.location=coord((7.3,4.1,8.4));cam.rotation_euler=(Vector(coord((0,.65,0)))-cam.location).to_track_quat('-Z','Y').to_euler();camd.type='ORTHO';camd.ortho_scale=7.7;scene.camera=cam
 placeholders(False)
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/f'{style}.blend'),compress=True)
 if not a.skip_render:
  scene.render.filepath=str(OUT/'previews'/f'{style}.png');bpy.ops.render.render(write_still=True)
 report=dict(style=style,**s,triangles=triangles,bytes=glb.stat().st_size,sha256=hashlib.sha256(glb.read_bytes()).hexdigest())
 reports.append(report);(OUT/'reports'/'manifest.json').write_text(json.dumps(reports,indent=2)+'\n')
 print('VEHICLE_COMPLETE',json.dumps(report),flush=True)
