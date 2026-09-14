"""Shared Blender kit for the photographic districts: build_kampung.py, build_zoo_negara.py and
build_courts.py. It sits on brand_kit (near-white PBR textures x linear vertex colour, joined by
material) and adds what the districts need on top:

  * alpha-tested cards (leaf atlas, chain link, netting, kerawang) exported as glTF MASK
  * 'Night glow <kind>' / 'Night wash <kind>' materials, the contract with src/district-night.ts
  * 'Ground ...' surfaces: subdivided grids with per-vertex colour (wear, zones, trampled earth)
  * ribbons for painted lines, lathed limbs with their own UVs (animals), leaf-card clumps
  * export: join by material, WebP images, meshopt, and a report with triangles, draws (one per
    primitive) and raw / meshopt / brotli bytes

Game coordinates in, metres, y up; pt() mirrors z into Blender, so faces listed +x then +z face
down (see pbr_kit). Every object carries a 'Color' attribute before joining (glTF clamps at 1).
"""
import bpy, bmesh, math, json, subprocess
import numpy as np
from pathlib import Path
from mathutils import Vector
from build_lrt import pt, join
import pbr_kit as kit
import brand_kit as BK
from brand_kit import paint, srgb
import district_textures as DT

ROOT=Path(__file__).resolve().parents[2]

def setup(tag,textures_dir,seed):
    BK.setup(tag,textures_dir,seed)
    for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)

def textured(name,kind,rough,tile,strength=1.0,two_sided=False,source=DT,metal=0.0):
    m=kit.pbr(name,kind,'#ffffff',rough,tile,strength=strength,two_sided=two_sided,source=source)
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=metal
    return m

def flat(name,rough=.5,metal=0.0,two_sided=False):return BK.flat(name,rough,metal,two_sided)

def lathe_textured(name,kind,rough,strength=1.0,source=DT):
    """A tiled PBR material whose UVs the builder writes itself (animal coats): no 'tile', so
    brand_kit.finalize leaves the UVs alone, and keep_uv so export keeps them."""
    m=textured(name,kind,rough,1.0,strength,source=source);del m['tile'];m['keep_uv']=True;return m

def _rgba(name,arr,data=False):
    h,w=arr.shape[:2]
    if arr.shape[-1]==3:arr=np.concatenate([arr,np.ones((h,w,1))],-1)
    tmp=bpy.data.images.new(name+'_src',w,h,alpha=True);tmp.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    path=kit.OUT/f'{name}.png';tmp.filepath_raw=str(path);tmp.file_format='PNG';tmp.save();bpy.data.images.remove(tmp)
    im=bpy.data.images.load(str(path),check_existing=False);im.name=name
    if data:im.colorspace_settings.name='Non-Color'
    im.pack();return im

MASKS={}
def masked(name,kind,rough,tile=None,cutoff=.5,strength=1.0):
    """Alpha-tested, double-sided card material from an RGBA generator. tile=None keeps the
    builder's own UVs (leaf atlas cells, kerawang panels); a tile in metres gets world UVs."""
    if kind not in MASKS:
        c,n=getattr(DT,kind)()
        MASKS[kind]=(_rgba(kind+'_color',c),_rgba(kind+'_normal',n,True))
    col,nrm=MASKS[kind]
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF']
    tc=nt.nodes.new('ShaderNodeTexImage');tc.image=col;nt.links.new(tc.outputs['Color'],p.inputs['Base Color'])
    less=nt.nodes.new('ShaderNodeMath');less.operation='LESS_THAN';less.inputs[1].default_value=cutoff
    nt.links.new(tc.outputs['Alpha'],less.inputs[0])
    keep=nt.nodes.new('ShaderNodeMath');keep.operation='SUBTRACT';keep.inputs[0].default_value=1
    nt.links.new(less.outputs['Value'],keep.inputs[1]);nt.links.new(keep.outputs['Value'],p.inputs['Alpha'])
    tn=nt.nodes.new('ShaderNodeTexImage');tn.image=nrm;nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=strength
    nt.links.new(tn.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    p.inputs['Roughness'].default_value=rough;m.use_backface_culling=False
    if tile:m['tile']=tile
    else:m['keep_uv']=True
    return m

def glow(kind,colour,rough=.35):
    """'Night glow <kind>': emission 1 of `colour` so the exporter writes it; the runtime sets the
    intensity (0 by day). Base colour white x vertex colour, so a lens still reads by day."""
    m,p=BK._principled(f'Night glow {kind}',rough)
    p.inputs['Emission Color'].default_value=(*srgb(colour),1);p.inputs['Emission Strength'].default_value=1.0
    return m

def wash(kind):
    """'Night wash <kind>': a pool of light image as emission over black; 0..1 UVs per plane."""
    m,p=BK._principled(f'Night wash {kind}',1.0);im=kit.image('wash',DT.wash());nt=m.node_tree
    p.inputs['Base Color'].default_value=(0,0,0,1)
    tx=nt.nodes.new('ShaderNodeTexImage');tx.image=im;nt.links.new(tx.outputs['Color'],p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value=1.0;m['keep_uv']=True
    return m

# ------------------------------------------------------------------ geometry
def _obj(name,verts,faces,m,uvs=None,colours=None,smooth=False,closed=False):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    if closed:
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free();me.update()
    for f in me.polygons:f.use_smooth=smooth
    if uvs is not None:
        uv=me.uv_layers.new(name='UVMap')
        for li,loop in enumerate(me.loops):uv.data[li].uv=uvs[loop.vertex_index]
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);me.materials.append(m);ob['asset']=BK.T
    attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT')
    for k in range(len(verts)):
        c=colours[k] if colours else (1,1,1)
        attr.data[k].color=(min(1,c[0]),min(1,c[1]),min(1,c[2]),1)
    me.color_attributes.active_color=attr
    return ob

def grid(name,x0,x1,z0,z1,y,m,colour,step=.5,height=None):
    """Upward-facing ground grid over a rect; colour(x,z) and height(x,z) per vertex (linear)."""
    nx=max(1,round((x1-x0)/step));nz=max(1,round((z1-z0)/step));verts=[];cols=[]
    for j in range(nz+1):
        for i in range(nx+1):
            x=x0+(x1-x0)*i/nx;z=z0+(z1-z0)*j/nz
            verts.append(pt(x,y+(height(x,z) if height else 0),z));cols.append(colour(x,z))
    faces=[(j*(nx+1)+i,(j+1)*(nx+1)+i,(j+1)*(nx+1)+i+1,j*(nx+1)+i+1) for j in range(nz) for i in range(nx)]
    ob=_obj(name,verts,faces,m,colours=cols)
    return orient(ob,(0,1,0))

def orient(ob,n):
    """Turn every face of an open mesh toward game direction n."""
    bn=Vector((n[0],-n[2],n[1]));bm=bmesh.new();bm.from_mesh(ob.data);bm.normal_update()
    flip=[f for f in bm.faces if f.normal.dot(bn)<0]
    if flip:bmesh.ops.reverse_faces(bm,faces=flip)
    bm.to_mesh(ob.data);bm.free();ob.data.update();return ob

def ribbon(name,path,w,y,m,col='#ffffff',closed=False):
    """Flat painted line along game (x,z) points, facing up."""
    k=len(path);left=[];right=[]
    for i,(x,z) in enumerate(path):
        a=path[(i-1)%k] if closed else path[max(i-1,0)];b=path[(i+1)%k] if closed else path[min(i+1,k-1)]
        tx,tz=b[0]-a[0],b[1]-a[1];L=math.hypot(tx,tz) or 1;ox,oz=-tz/L*w/2,tx/L*w/2
        left.append(pt(x+ox,y,z+oz));right.append(pt(x-ox,y,z-oz))
    if closed:left.append(left[0]);right.append(right[0])
    n=len(left)
    faces=[(i,i+1,n+i+1,n+i) for i in range(n-1)]
    return paint(orient(_obj(name,left+right,faces,m),(0,1,0)),col)

def quad(name,corners,m,uvs=((0,0),(1,0),(1,1),(0,1)),col='#ffffff',normal=None):
    """Four game-space corners with explicit UVs (wash planes, cards, nets, fences)."""
    ob=_obj(name,[pt(*c) for c in corners],[(0,1,2,3)],m,uvs=list(uvs))
    if normal:orient(ob,normal)
    return paint(ob,col)

def strut(name,p0,p1,w,m,col='#ffffff',h=None):
    o=kit.strut(name,p0,p1,w,m,h)
    if o is None:return None
    bpy.context.view_layer.update();return paint(o,col)

def tube(name,points,radius,m,col='#ffffff',sides=6):
    return paint(kit.tube(name,points,radius,m,sides),col)

def rock(name,x,y,z,r,m,col='#ffffff',squash=.7,sub=2,rough=.28,seed=0,smooth=True):
    """kit.rock; smooth=False keeps the facets, which read as broken stone rather than a pebble."""
    o=kit.rock(name,x,y,z,r,m,squash,sub,rough,seed);bpy.context.view_layer.update()
    for f in o.data.polygons:f.use_smooth=smooth
    return paint(o,col)

def limb(name,path,m,col='#ffffff',n=8,L=None,uv=(1.0,1.0),caps=(True,True),smooth=True):
    """Lathe along a centreline: path [(x,y,z,r)] or [(x,y,z,rx,ry)] in a local frame, L(p)->game.
    UVs: u around the ring in metres / uv[0] (a whole number of wraps), v along in metres / uv[1],
    so a coat texture keeps its scale on a body, a neck and a leg alike."""
    L=L or (lambda p:p)
    P=[Vector(p[:3]) for p in path];R=[(p[3],p[3] if len(p)<5 else p[4]) for p in path]
    verts=[];faces=[];uvs=[];u=None;along=0.0
    circ=2*math.pi*max(max(r) for r in R);wraps=max(1,round(circ/uv[0]))
    for i,c in enumerate(P):
        t=P[min(i+1,len(P)-1)]-P[max(i-1,0)];t=t.normalized() if t.length>1e-6 else Vector((0,0,1))
        if u is None:
            ref=Vector((0,1,0)) if abs(t.y)<.9 else Vector((0,0,1));u=t.cross(ref).normalized()
        else:
            u=u-t*u.dot(t);u=u.normalized() if u.length>1e-5 else t.cross(Vector((0,0,1))).normalized()
        v=t.cross(u).normalized();rx,ry=R[i]
        if i:along+=(P[i]-P[i-1]).length
        for k in range(n+1):
            a=2*math.pi*k/n;q=c+u*(rx*math.cos(a))+v*(ry*math.sin(a))
            verts.append(pt(*L((q.x,q.y,q.z))));uvs.append((wraps*k/n,along/uv[1]))
    ring=n+1
    for s in range(len(P)-1):
        for k in range(n):
            a=s*ring+k;faces.append((a,a+1,a+1+ring,a+ring))
    if caps[0]:faces.append(tuple(range(n-1,-1,-1)))
    if caps[1]:faces.append(tuple((len(P)-1)*ring+k for k in range(n)))
    ob=_obj(name,verts,faces,m,uvs=uvs,smooth=smooth)
    # outward normals: the ring winding depends on the frame, so check one side face
    me=ob.data;me.update();f=me.polygons[0];c0=Vector(pt(*L(tuple(P[0]))));c1=Vector(pt(*L(tuple(P[1]))))
    if (f.center-(c0+c1)/2).dot(f.normal)<0:
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.reverse_faces(bm,faces=bm.faces[:]);bm.to_mesh(me);bm.free();me.update()
    for p in me.polygons:p.use_smooth=smooth and len(p.vertices)==4
    return paint(ob,col)

def frame_of(x=0.0,z=0.0,yaw=0.0,s=1.0):
    """Local -> game transform: uniform scale, the game's own yaw about y, then offset."""
    c,sn=math.cos(yaw),math.sin(yaw)
    return lambda p:(x+(p[0]*c+p[2]*sn)*s,p[1]*s,z+(-p[0]*sn+p[2]*c)*s)

def card(verts,uvs,faces,build):
    """Accumulate leaf-card quads into (verts, uvs, faces) lists of one mesh."""
    b=len(verts);verts.extend(build[0]);uvs.extend(build[1]);faces.extend(tuple(b+i for i in f) for f in build[2])

CELL={'durian':(0,0),'rambutan':(1,0),'shrub':(0,1),'grass':(1,1)}
def clump(V,U,F,cx,cy,cz,rx,ry,count,cell,size,R,up_bias=.5,centre=None):
    """Leaf-card clump (game coords): `count` random-facing square cards of one atlas cell scattered
    in an ellipsoid, faces tilted to the sky so the crown reads closed from above."""
    col,row=CELL[cell];ins=.004;u0,u1=col/2+ins,(col+1)/2-ins;v1,v0=1-row/2-ins,1-(row+1)/2+ins
    for _ in range(count):
        d=Vector((R.gauss(0,1),R.gauss(0,1),R.gauss(0,1))).normalized()
        if d.y<-.3 and R.random()<.5:d.y=-d.y
        p=Vector((cx,cy,cz))+Vector((d.x*rx,d.y*ry,d.z*rx))*R.uniform(.45,1.0)
        f=(d+Vector((0,1,0))*max(0,d.y)*up_bias+Vector((R.gauss(0,.5),R.gauss(0,.5),R.gauss(0,.5)))).normalized()
        a=f.orthogonal().normalized();roll=R.uniform(0,6.28);a=a*math.cos(roll)+f.cross(a)*math.sin(roll);b=f.cross(a)
        h=size*R.uniform(.8,1.2)/2
        cs=[p-a*h-b*h,p+a*h-b*h,p+a*h+b*h,p-a*h+b*h]
        card(V,U,F,([pt(*c) for c in cs],[(u0,v0),(u1,v0),(u1,v1),(u0,v1)],[(0,1,2,3)]))

def tuft(V,U,F,x,y,z,size,R,cell='grass',blades=3):
    """Crossed vertical cards of a base-at-bottom atlas cell (grass, reeds)."""
    col,row=CELL[cell];ins=.004;u0,u1=col/2+ins,(col+1)/2-ins;v1,v0=1-row/2-ins,1-(row+1)/2+ins
    spin=R.uniform(0,math.pi);h=size*R.uniform(.8,1.2)
    for k in range(blades):
        a=spin+k*math.pi/blades;dx,dz=math.cos(a)*h/2,math.sin(a)*h/2
        cs=[(x-dx,y,z-dz),(x+dx,y,z+dz),(x+dx,y+h,z+dz),(x-dx,y+h,z-dz)]
        card(V,U,F,([pt(*c) for c in cs],[(u0,v0),(u1,v0),(u1,v1),(u0,v1)],[(0,1,2,3)]))

def cards(name,V,U,F,m):
    if not F:return None
    return _obj(name,V,F,m,uvs=U)

# ------------------------------------------------------------------ export
def export(root,path,manifest,key,extra=None):
    """Join by material, export WebP GLB, meshopt it, and merge a report into manifest[key]."""
    bpy.context.view_layer.update()
    for ob in [c for c in root.children if c.type=='MESH']:
        mats=[m for m in ob.data.materials if m]
        if mats and all('tile' in m for m in mats):BK.uv_world(ob)
    batches={}
    for ob in [c for c in root.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for k,objs in batches.items():
        mats=[m for m in objs[0].data.materials if m]
        j=join(objs,f'{root.name} | {" + ".join(k)}')
        if not any(('tile' in m) or m.get('keep_uv') for m in mats):
            for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    kids=[c for c in root.children if c.type=='MESH']
    for c in kids:c.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
        export_image_format='WEBP',export_image_quality=82,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    raw=path.stat().st_size
    subprocess.run(['node','scripts/blender/compress-glb.mjs',str(path.relative_to(ROOT))],cwd=ROOT,check=True)
    data=path.read_bytes()
    tris=0;draws=0;mats=set()
    for c in kids:
        c.data.calc_loop_triangles();tris+=len(c.data.loop_triangles)
        used={p.material_index for p in c.data.polygons};draws+=len(used);mats|={c.data.materials[i].name for i in used}
    brotli=int(subprocess.run(['node','-e',"const z=require('zlib'),fs=require('fs');console.log(z.brotliCompressSync(fs.readFileSync(process.argv[1])).length)",str(path)],capture_output=True,text=True,check=True).stdout.strip())
    report={'asset':path.stem,'triangles':tris,'draws':draws,'bytes':{'raw':raw,'meshopt':len(data),'brotli':brotli},
            'materials':sorted(mats),'textures':sorted(kit.IMAGES)+sorted(k+'_color' for k in MASKS)}
    if extra:report.update(extra)
    out=json.loads(manifest.read_text()) if manifest.exists() else {}
    out[key]=report;manifest.write_text(json.dumps(out,indent=2)+'\n')
    print('DISTRICT EXPORT',key,json.dumps(report),flush=True)
    return report
