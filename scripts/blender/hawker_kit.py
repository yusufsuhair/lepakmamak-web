"""Helpers shared by the hawker gerai (build_stalls.py) and the busking pitch (build_busking.py).

Both sets are painted with vertex colours over near-white PBR textures (hawker_textures.py), so a
material is one draw however many colours it carries. Importing this module creates nothing.

  vc(ob, colour)        fill the 'Color' attribute; hex strings are sRGB, tuples are linear
  lathe(...)            surface of revolution with outward faces (vessels, stools, jars)
  quad(...)             flat decal with 0..1 UVs, facing up (puddles, light pools)
  alpha_mat / glow_mat  a texture carrying its own alpha, and a texture that is its own emission
  export(root, path)    batch by material, keep UVs only where a texture needs them, write the GLB
"""
import bpy, bmesh, math
from mathutils import Vector
from build_lrt import pt
import pbr_kit as kit

def lin(c):
    return kit.srgb(c) if isinstance(c,str) else tuple(c)

def vc(ob,c):
    """Paint every vertex of ob one linear colour (glTF COLOR_0 clamps at 1)."""
    me=ob.data;c=lin(c)
    a=me.color_attributes.get('Color') or me.color_attributes.new('Color','FLOAT_COLOR','POINT')
    for d in a.data:d.color=(*c,1)
    me.color_attributes.active_color=a
    return ob

def _flip(ob,wrong):
    bm=bmesh.new();bm.from_mesh(ob.data);bm.faces.ensure_lookup_table();bm.normal_update()
    for f in bm.faces:
        if wrong(f):f.normal_flip()
    bm.to_mesh(ob.data);bm.free();ob.data.update()

def lathe(name,cx,cz,prof,m,n=16,cap_bottom=False,cap_top=False,smooth=True,inward=False):
    """prof [(y, r), ...] in game units. The first strip is taken as outside and faces outward (or
    toward the axis with inward=True); the rest follow its winding, so a profile that climbs the
    outside and comes back down the inside is a vessel with a wall. A bottom cap on the first
    ring faces down, a top cap on the last up."""
    verts=[];faces=[]
    for y,r in prof:
        for i in range(n):
            a=2*math.pi*i/n;verts.append(pt(cx+r*math.cos(a),y,cz+r*math.sin(a)))
    for s in range(len(prof)-1):
        for i in range(n):
            a=s*n+i;b=s*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    strips=len(faces)
    if cap_bottom:faces.append(tuple(range(n)))
    if cap_top:faces.append(tuple((len(prof)-1)*n+i for i in range(n)))
    ob=kit.mesh(name,verts,faces,m,smooth=smooth)
    me=ob.data;me.update()
    p0=me.polygons[0];c=p0.center   # profiles never start with a flat strip
    flip=(p0.normal.dot(Vector((c.x-cx,c.y+cz,0)))<0)!=inward
    def wrong(f):
        if f.index<strips:return flip
        want=-1 if (cap_bottom and f.index==strips) else 1
        return f.normal.z*want<0
    _flip(ob,wrong)
    for f in me.polygons:f.use_smooth=smooth and f.index<strips
    return ob

def face_up(ob):
    _flip(ob,lambda f:f.normal.z<0);return ob

def quad(name,x,y,z,w,d,m,yaw=0.0):
    """Horizontal decal centred on (x, y, z), w along x and d along z before the yaw, UVs 0..1."""
    c,s=math.cos(yaw),math.sin(yaw);verts=[]
    for u,v in ((0,0),(1,0),(1,1),(0,1)):
        lx,lz=(u-.5)*w,(v-.5)*d;verts.append(pt(x+lx*c-lz*s,y,z+lx*s+lz*c))
    ob=kit.mesh(name,verts,[(0,1,2,3)],m,smooth=False);face_up(ob)
    uv=ob.data.uv_layers.new(name='UVMap')
    for li,(u,v) in enumerate(((0,0),(1,0),(1,1),(0,1))):uv.data[li].uv=(u,v)
    return ob

def rgba_image(name,arr):
    """kit.image() writes RGB, which drops an alpha channel; this keeps it."""
    if name in kit.IMAGES:return kit.IMAGES[name]
    import numpy as np
    h,w=arr.shape[:2];tmp=bpy.data.images.new(name+'_src',w,h,alpha=True)
    tmp.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    path=kit.OUT/f'{name}.png';tmp.filepath_raw=str(path);tmp.file_format='PNG';tmp.save();bpy.data.images.remove(tmp)
    im=bpy.data.images.load(str(path),check_existing=False);im.name=name;im.alpha_mode='STRAIGHT'
    im.pack();kit.IMAGES[name]=im;return im

def _tex(nt,image):
    t=nt.nodes.new('ShaderNodeTexImage');t.image=image;return t

def alpha_mat(name,image,rough):
    """Base colour and alpha both from one RGBA image: exports as alphaMode BLEND."""
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF'];t=_tex(nt,image)
    nt.links.new(t.outputs['Color'],p.inputs['Base Color']);nt.links.new(t.outputs['Alpha'],p.inputs['Alpha'])
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=0
    m.surface_render_method='BLENDED';m['uv']=True;return m

def glow_mat(name,image):
    """A greyscale image that is both base colour and emission; the runtime turns it additive."""
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF'];t=_tex(nt,image)
    nt.links.new(t.outputs['Color'],p.inputs['Base Color']);nt.links.new(t.outputs['Color'],p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value=1.0;p.inputs['Roughness'].default_value=1
    m.use_backface_culling=False;m['uv']=True;return m

def metallic(m,v):
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=v;return m

def export(root,path,tag):
    """Join the children by material into one mesh each and write the GLB with vertex colours."""
    batches={}
    for ob in [c for c in root.children if c.type=='MESH']:
        if not ob.data.color_attributes:vc(ob,(1,1,1))
        batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    from build_lrt import join
    for key,objs in batches.items():
        j=join(objs,f'{tag} | {" + ".join(key)}')
        if not any(('tile' in m or 'uv' in m) for m in j.data.materials if m):
            for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for c in root.children:c.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
        export_image_format='WEBP',export_image_quality=82,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    meshes=[c for c in root.children if c.type=='MESH']
    return {'triangles':sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in meshes),'draws':len(meshes),
            'materials':sorted(k[0] for k in batches),'textures':sorted(kit.IMAGES),'bytes':path.stat().st_size}
