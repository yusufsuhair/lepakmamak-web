"""Shared kit for photographic Blender venues: procedural PBR materials with real-world UVs,
and the small mesh builders that go with them. First written for Pantai Senja (build_beach.py).

    import pbr_kit as kit
    kit.setup('venue', OUT/'textures', seed)          # asset tag, where texture PNGs go, RNG seed
    SAND=kit.pbr('Dry sand','sand','#ffffff',.93,4.0) # generator name, tint, roughness, tile (m)

Textures come from pbr_textures.py (or any module passed as `source`, so a venue can keep its
own generators). Every generated image is written as PNG and re-loaded before packing: packing
a generated buffer directly can export as black. The glTF exporter turns the tint into
baseColorFactor, so one grain texture serves many finishes.

Traps this kit already handles (see the notes on each function):
  * pt(x,y,z)=(x,-z,y) mirrors z, so pydata faces listed +x then +z face DOWN; mesh(closed=True)
    recalculates normals for solids, open grids must list faces (i,j+1),(i+1,j+1),(i+1,j),(i,j)
  * glTF vertex colours clamp at 1 and are linear: keep a ~0.9 baseline, square darkening
"""
import bpy, bmesh, math, random
import numpy as np
from mathutils import Vector, noise
from build_lrt import pt,mat,finish
import pbr_textures

T='asset';OUT=None;RNG=random.Random(0)
IMAGES={};SETS={}

def setup(tag,textures_dir,seed):
    """Name the asset tag objects carry, where texture PNGs are written, and seed the RNG that
    uv offsets and helpers draw from (so rebuilds are reproducible)."""
    global T,OUT,RNG
    T=tag;OUT=textures_dir;OUT.mkdir(parents=True,exist_ok=True);RNG=random.Random(seed)

def srgb(h):
    """Game hex -> linear colour."""
    h=h.lstrip('#');c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
def hmat(name,hexcolor,rough=.6,**kw):return mat(name,srgb(hexcolor),rough,**kw)

def image(name,arr,data=False):
    """Write the array as PNG under assets/beach/textures and pack a freshly loaded copy:
    repacking a generated buffer can leave a stale black image in the export."""
    if name in IMAGES:return IMAGES[name]
    h,w=arr.shape[:2]
    if arr.shape[-1]==3:arr=np.concatenate([arr,np.ones((h,w,1))],-1)
    tmp=bpy.data.images.new(name+'_src',w,h);tmp.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    path=OUT/f'{name}.png';tmp.filepath_raw=str(path);tmp.file_format='PNG';tmp.save();bpy.data.images.remove(tmp)
    im=bpy.data.images.load(str(path),check_existing=False);im.name=name
    if data:im.colorspace_settings.name='Non-Color'
    im.pack();IMAGES[name]=im;return im

def texset(kind,source=None):
    if kind not in SETS:
        c,n=getattr(source or pbr_textures,kind)();SETS[kind]=(image(kind+'_color',c),image(kind+'_normal',n,True))
    return SETS[kind]

def pbr(name,kind,tint,rough,tile,strength=1.0,two_sided=False,normal_scale=1.0,source=None):
    """Texture x tint (exported as baseColorFactor) with a normal map. `tile` is the texture's
    size in metres; uv_metres() reads it so every object gets a real-world scale."""
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF']
    col,nrm=texset(kind,source)
    tc=nt.nodes.new('ShaderNodeTexImage');tc.image=col
    mix=nt.nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs['Factor'].default_value=1
    nt.links.new(tc.outputs['Color'],mix.inputs['A']);mix.inputs['B'].default_value=(*srgb(tint),1)
    nt.links.new(mix.outputs['Result'],p.inputs['Base Color'])
    tn=nt.nodes.new('ShaderNodeTexImage');tn.image=nrm
    if normal_scale!=1.0:   # a second tiling for the normal breaks up visible repeats (KHR_texture_transform)
        uv=nt.nodes.new('ShaderNodeUVMap');mp=nt.nodes.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(normal_scale,normal_scale,1)
        nt.links.new(uv.outputs['UV'],mp.inputs['Vector']);nt.links.new(mp.outputs['Vector'],tn.inputs['Vector'])
    nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=strength
    nt.links.new(tn.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=0
    m.use_backface_culling=not two_sided;m['tile']=tile
    return m

def uv_metres(ob):
    """Box-project each face in the object's own frame, in metres / texture tile, with u along
    the object's longest axis so wood grain and trunk rings follow the member."""
    tiles=[m['tile'] for m in ob.data.materials if m and 'tile' in m]
    if not tiles or not ob.data.vertices:return
    me=ob.data;tile=tiles[0];s=[abs(v) for v in ob.scale];co=[v.co for v in me.vertices]
    ext=[(max(c[i] for c in co)-min(c[i] for c in co))*s[i] for i in range(3)]
    long=max(range(3),key=lambda i:ext[i]);off=(RNG.random()*7,RNG.random()*7)
    uv=me.uv_layers.new(name='UVMap') if not me.uv_layers else me.uv_layers[0]
    for f in me.polygons:
        a=max(range(3),key=lambda i:abs(f.normal[i]));axes=[i for i in range(3) if i!=a]
        u_ax=long if long in axes else axes[0];v_ax=axes[1] if axes[0]==u_ax else axes[0]
        for li in f.loop_indices:
            c=co[me.loops[li].vertex_index]
            uv.data[li].uv=(c[u_ax]*s[u_ax]/tile+off[0],c[v_ax]*s[v_ax]/tile+off[1])

def strut(name,p0,p1,w,m,h=None):
    """Square member between two game-space points (brace, rope, rib)."""
    a=Vector(pt(*p0));b=Vector(pt(*p1));d=b-a;L=d.length
    if L<1e-5:return None
    bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2)
    o=bpy.context.object;o.scale=(w,h or w,L)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(o,name,m,T)

def ico(name,x,y,z,r,m,squash=1.0,sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=r,location=pt(x,y,z))
    o=bpy.context.object;o.scale=(1,1,squash)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=True
    return o

def mesh(name,verts,faces,m,smooth=True,mats=None,index=None,closed=False):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    if closed:   # solids get outward normals whatever order their faces were listed in
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free();me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob)
    for mm in (mats or [m]):ob.data.materials.append(mm)
    for i,f in enumerate(me.polygons):
        f.use_smooth=smooth
        if index:f.material_index=index[i]
    ob['asset']=T;return ob

def tube(name,points,radius,m,sides=6):
    """Tube through game-space points; radius is one number or one per point."""
    rs=radius if isinstance(radius,(list,tuple)) else [radius]*len(points)
    P=[Vector(pt(*p)) for p in points];verts=[];faces=[]
    for i,p in enumerate(P):
        d=(P[min(i+1,len(P)-1)]-P[max(i-1,0)]).normalized()
        a=d.orthogonal().normalized();b=d.cross(a)
        for k in range(sides):
            t=2*math.pi*k/sides;verts.append(p+(a*math.cos(t)+b*math.sin(t))*rs[i])
    for i in range(len(P)-1):
        for k in range(sides):faces.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
    faces.append(tuple(range(sides))[::-1]);faces.append(tuple((len(P)-1)*sides+k for k in range(sides)))
    return mesh(name,verts,faces,m,closed=True)

def rock(name,x,y,z,r,m,squash=.7,sub=2,rough=.28,seed=0):
    """Rounded boulder: an icosphere pushed out by two octaves of 3D noise, then flattened."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=(0,0,0))
    o=bpy.context.object;k=seed*1.37+x*.1
    for v in o.data.vertices:
        c=v.co.normalized();d=1+rough*noise.noise(c*1.6+Vector((k,k*.5,3)))+rough*.4*noise.noise(c*4.1+Vector((k,1,k)))
        v.co=Vector((c.x*d*r,c.y*d*r,c.z*d*r*squash))
    o.location=pt(x,y,z);o.rotation_euler.z=RNG.random()*6.28
    finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=True
    return o
