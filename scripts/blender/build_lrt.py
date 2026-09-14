"""Shared Blender helpers for Lepak venue builds, and the entry point for the Rapid KL LRT.

Helpers (imported by pbr_kit.py and most build_*.py scripts; keep their names, signatures and
behaviour): pt, mat, finish, box, cyl, rounded, loft, sweep, join. Importing this module has no
side effects: no materials, no directories.

Running it builds the photographic LRT (scripts/blender/lrt_models.py, textures in lrt_textures.py):

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_lrt.py
node scripts/blender/compress-glb.mjs public/assets/models/lrt/LM_LRT_Train.glb   (and Station, Viaduct)

Outputs (public/assets/models/lrt):
  LM_LRT_Train.glb    nodes: cab (nose at +z), mid. Children roof, door_{P|N}_{1|2}_{a|b}
  LM_LRT_Station.glb  node: station. Track along z at x=0, platform on +x, ground at y=0
  LM_LRT_Viaduct.glb  nodes: girder (3 m along z, rail top at y=11), pier (ground to y=9.4)
"""
import bpy, math, json, sys
from pathlib import Path
def pt(x,y,z): return (x,-z,y)

MATS={}
def mat(name,color,rough=.5,alpha=1,emit=0,two_sided=False):
    if name in MATS:return MATS[name]
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,alpha);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=0;p.inputs['Alpha'].default_value=alpha
    if emit:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
    if alpha<1:m.surface_render_method='BLENDED';m.use_transparency_overlap=True
    m.use_backface_culling=not two_sided
    MATS[name]=m;return m

def finish(ob,name,m,tag,bevel=0):
    ob.name=name;ob.data.materials.append(m);ob['asset']=tag
    bpy.context.view_layer.objects.active=ob
    if bevel:
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        mod=ob.modifiers.new('edge','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

def box(name,x,y,z,w,h,d,m,tag,bevel=.02,rx=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pt(x,y,z));o=bpy.context.object;o.scale=(w,d,h)
    if rx:o.rotation_euler.x=rx
    return finish(o,name,m,tag,min(bevel,w*.25,h*.25,d*.25))

def cyl(name,x,y,z,r,h,m,tag,axis='y',verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=h,location=pt(x,y,z));o=bpy.context.object
    if axis=='x':o.rotation_euler.y=math.pi/2
    if axis=='z':o.rotation_euler.x=math.pi/2
    finish(o,name,m,tag)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o

def rounded(corners,n=4):
    """Rounded polygon from (x,y,radius) corners listed counter-clockwise."""
    pts=[];k=len(corners)
    for i,(x,y,r) in enumerate(corners):
        px,py,_=corners[i-1];nx,ny,_=corners[(i+1)%k]
        if r<=0:pts.append((x,y));continue
        d1=(px-x,py-y);d2=(nx-x,ny-y);l1=math.hypot(*d1);l2=math.hypot(*d2);d1=(d1[0]/l1,d1[1]/l1);d2=(d2[0]/l2,d2[1]/l2)
        ang=math.acos(max(-1,min(1,d1[0]*d2[0]+d1[1]*d2[1])));bis=(d1[0]+d2[0],d1[1]+d2[1]);bl=math.hypot(*bis);bis=(bis[0]/bl,bis[1]/bl)
        cx,cy=x+bis[0]*r/math.sin(ang/2),y+bis[1]*r/math.sin(ang/2);t=r/math.tan(ang/2)
        a1=(x+d1[0]*t,y+d1[1]*t);a2=(x+d2[0]*t,y+d2[1]*t)
        s0=math.atan2(a1[1]-cy,a1[0]-cx);s1=math.atan2(a2[1]-cy,a2[0]-cx);dd=(s1-s0+math.pi)%(2*math.pi)-math.pi
        for j in range(n+1):a=s0+dd*j/n;pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return pts

def loft(name,sections,m,tag,closed=True,caps=(True,True),smooth=False):
    """sections: [(z,[(x,y),...]),...] with equal point counts; faces between consecutive rings."""
    verts=[];faces=[];n=len(sections[0][1])
    for z,prof in sections:
        assert len(prof)==n,name
        for x,y in prof:verts.append(pt(x,y,z))
    span=n if closed else n-1
    for s in range(len(sections)-1):
        for i in range(span):
            a=s*n+i;b=s*n+(i+1)%n;c=(s+1)*n+(i+1)%n;d=(s+1)*n+i;faces.append((a,b,c,d))
    if closed:
        if caps[0]:faces.append(tuple(range(n)))
        if caps[1]:faces.append(tuple((len(sections)-1)*n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(m);ob['asset']=tag
    for f in mesh.polygons:f.use_smooth=smooth
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def sweep(name,profile,z0,z1,m,tag,closed=True,smooth=False):return loft(name,[(z0,profile),(z1,profile)],m,tag,closed,smooth=smooth)

def join(objects,name,keep=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    if keep:o['keep']=keep
    return o


if __name__=='__main__':
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    import lrt_models
    lrt_models.main(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
