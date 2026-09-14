"""Three of the worship landmarks, photographic pass: Gereja Harapan (a colonial Gothic revival church
in the manner of St Mary's Cathedral), Kuil Seri Harmoni (a South Indian temple in the manner of Sri
Mahamariamman, with its gopuram) and Tokong Harmoni (a Hokkien temple in the manner of Thean Hou and
Sin Sze Si Ya). Masjid Kampung Maju has its own build: scripts/blender/build_masjid.py.

Local frame for each site: +z is the entrance, the plaza is x +-10, z -11..17 with its top at y .24,
and the collider world.ts keeps is x +-9, z +-8. The canvas name signs stay the game's; these models
only frame them (church 0,9.3,7.72 12 x .9; kuil 0,5.2,8 12 x .8; tokong 0,5.1,8 11 x .8), so nothing
here stands in front of a sign.

  * Gereja Harapan: lime-rendered nave with stepped buttresses and stained-glass lancets, an engaged
    west tower rising from the facade to a louvred belfry, battlements, pinnacles and a slate spire
    with its cross; timber doors under a glazed tympanum; slate roof; a laterite path between lawns
    and ixora hedges, lamp posts.
  * Kuil Seri Harmoni: a five-tier gopuram whose storeys are painted stucco (deities, dancers and
    guardians in niches, kapota cornices, parapets of shrines: worship_textures.gopuram) on battered
    faces, with corner kutas, sala shrines, a barrel-vault crown and seven gold kalasam; a real
    entrance passage with teak doors studded in brass, bells and a mango-leaf thoranam; a pillared
    mandapam with painted columns and marigold garlands, the kavi-striped sanctum and its vimana,
    nandi on the parapet corners, a kolam at the steps and brass oil lamps.
  * Tokong Harmoni: red lacquer columns (the two inner ones wound with gilt dragons) and a studded red
    door on a granite platform; a double roof of jade-green glazed barrel tiles, the lower one hipped
    with lifted corners, the upper a gable with a swallowtail ridge carrying two jian nian dragons
    and a flaming pearl, phoenixes on the hips; painted and gilded beams on bracket sets; a gilt name
    board behind the game's sign; lanterns under every eave and on a line over the court; stone
    guardian lions; a bronze incense burner (node 'joss_smoke' marks where src/worship.ts starts the
    smoke).
  * night: materials named 'Night ...' are the contract with src/worship.ts. Glass, lattice, lamps,
    lanterns, doorway cards and the pearl emit only at night (flames a little by day); 'Night flood'
    materials take their own colour map as warm floodlight; 'Night wash warm' planes become additive
    uplight and are hidden by day.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_worship.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Church.glb   (and HinduTemple, ChineseTemple)

Output: public/assets/models/environment/LM_ENV_{Church,HinduTemple,ChineseTemple}.glb, nodes 'church',
'hindutemple', 'chinesetemple' at the landmark origin.
"""
import bpy, bmesh, math, json, sys, random
from pathlib import Path
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,cyl,join,finish,box as lrt_box

import pbr_kit as kit
from pbr_kit import srgb,hmat,pbr,mesh
import worship_textures as WT

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/worship'; (OUT/'textures').mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
T='worship'
kit.setup(T,OUT/'textures',20260915)

# ------------------------------------------------------------------ materials
def P(name,kind,tint,rough,tile,**kw):return pbr(name,kind,tint,rough,tile,source=WT,**kw)
def explicit(m):
    """UVs written by hand (metres or 0..1 over a panel), not box-projected: keep the tile for us."""
    m['tex_m']=m['tile'];del m['tile'];m['keep_uv']=True;return m
def metal(m,v):m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=v;return m
def emissive(m,image=None,color=None):
    """Emission the runtime scales (strength 1 here so the exporter writes it; worship.ts sets 0 by day)."""
    nt=m.node_tree;p=nt.nodes['Principled BSDF']
    if image is not None:
        tx=nt.nodes.new('ShaderNodeTexImage');tx.image=image;nt.links.new(tx.outputs['Color'],p.inputs['Emission Color'])
    else:p.inputs['Emission Color'].default_value=(*srgb(color),1)
    p.inputs['Emission Strength'].default_value=1.0
    return m
def flat_textured(name,image,rough=.9,emit=False):
    """A colour image on explicit UVs without a normal map: doorway cards and washes."""
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF']
    tx=nt.nodes.new('ShaderNodeTexImage');tx.image=image;nt.links.new(tx.outputs['Color'],p.inputs['Base Color'])
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=0
    if emit:emissive(m,image)
    m['keep_uv']=True;m.use_backface_culling=True
    return m

# shared by all three
PLAZA=P('Plaza granite','granite_tiles','#eeeae2',.3,2.4)
GRANITE=P('Granite dark','granite_tiles','#8e8a84',.34,2.4)
GOLD=metal(P('Gold leaf','gold_leaf','#fff2c8',.32,.4),.18)
BRASS=metal(P('Brass','bronze','#e0b774',.35,.5),.35)
WASH=flat_textured('Night wash warm',kit.image('wash',WT.wash()))
GLOW=flat_textured('Night glow interior',kit.image('glow_card',WT.glow_card()),emit=True)
IRON=hmat('Painted iron','#2a2b2a',.55)
LAMP=emissive(hmat('Night lantern','#f4e7c6',.35),color='#ffc27a')
HEDGE=P('Ixora hedge','foliage','#ffffff',.7,1.1)
# church
RENDER=P('Render white','lime_render','#ffffff',.86,3.0)
STONE=P('Limestone','limestone','#ffffff',.7,1.2)
SLATE=explicit(P('Slate roof','slate','#ffffff',.55,1.5))
GLASS=explicit(emissive(P('Night glow stained glass','stained_glass','#5a5a5a',.18,1.0),kit.texset('stained_glass',WT)[0]))
TEAK=P('Dark oak door','teak','#6d4a33',.6,1.2)
LOUVRE=P('Belfry louvre','louvre','#ffffff',.7,.6)
PATH=P('Laterite path','paving','#ffffff',.85,1.2)
LAWN=P('Lawn','lawn','#ffffff',.95,2.0)
FASCIA=hmat('White fascia','#e9e6dc',.6)
# kuil
STUCCO=P('Night flood stucco','limestone','#fbeacb',.8,1.2)
TRIM=P('Night flood trim','limestone','#e98a3c',.75,1.2)
VAULT=P('Night flood vault','limestone','#d1503a',.7,1.2)
GOP=explicit(P('Night flood gopuram','gopuram','#ffffff',.72,1.0,strength=1.2))
PILLAR=explicit(P('Painted pillar','pillar','#ffffff',.7,1.0))
STRIPES=P('Kavi stripes','stripes','#ffffff',.85,1.8)
FLOOR=P('Temple floor','granite_tiles','#d8cbb4',.28,2.4)
TDOOR=P('Temple door','temple_door','#ffffff',.55,.6)
MARIGOLD=P('Marigold','marigold','#ffffff',.8,.3)
LEAF=hmat('Mango leaf','#3f7d2c',.6,two_sided=True)
FLAME=emissive(hmat('Night lamp flame','#ffb347',.4),color='#ffa040')
KOLAM=explicit(P('Kolam on granite','kolam_plaza','#ffffff',.3,2.4))
# tokong
TILES=explicit(P('Glazed roof tiles','roof_tiles','#ffffff',.32,1.2))
EAVES=explicit(P('Eave tile ends','eave_ends','#ffffff',.35,.6))
LACQUER=P('Red lacquer','lacquer','#ffffff',.42,.8)
BEAM=explicit(P('Carved beam','carved_beam','#ffffff',.5,3.2))
JIAN=P('Jian nian','jiannian','#ffffff',.3,.3)
RDOOR=P('Red door','lacquer_door','#ffffff',.42,.6)
LATTICE=emissive(P('Night glow lattice','lattice','#ffffff',.55,.6),kit.image('lattice_glow',WT.lattice_glow()))
CREAM=P('Cream render','lime_render','#f1e3c4',.85,3.0)
RIDGE=P('Glazed ridge','glaze','#3f8a5b',.3,.6)
SOFFIT=hmat('Painted soffit','#2d5f5a',.7)
LION=P('Granite lion','granite','#c9c4b8',.8,1.0)
BRONZE=metal(P('Bronze','bronze','#ffffff',.45,.5,two_sided=True),.3)
ASH=hmat('Incense ash','#6b665d',.95)
STICK=hmat('Joss stick','#b8322a',.7)
LANTERN=emissive(hmat('Night lantern red','#c62a20',.45),color='#ff2a14')
PEARL=emissive(hmat('Night pearl','#e0502a',.35),color='#ff7a30')
TEAL=hmat('Bracket teal','#2f7f73',.6)
BOARD=hmat('Black lacquer board','#1c1a18',.4)

# ------------------------------------------------------------------ geometry helpers (after build_masjid.py)
def box(name,x,y,z,w,h,d,m,bevel=0,rx=0):
    return lrt_box(name,x,y,z,w,h,d,m,T,bevel if min(w,h,d)>=.3 and max(w,h,d)>=1.2 else 0,rx)

def facing(ox,oz,nx,nz,y0=0.0):
    """Frame on a wall face: s runs to the viewer's right, y up, d out of the wall along (nx,nz)."""
    rx,rz=nz,-nx
    return lambda s,y,d:(ox+rx*s+nx*d,y0+y,oz+rz*s+nz*d)

def orient(ob,n):
    """Turn every face of a flat or open mesh toward the game-space direction n."""
    bn=Vector((n[0],-n[2],n[1]));bm=bmesh.new();bm.from_mesh(ob.data);bm.normal_update()
    flip=[f for f in bm.faces if f.normal.dot(bn)<0]
    if flip:bmesh.ops.reverse_faces(bm,faces=flip)
    bm.to_mesh(ob.data);bm.free();ob.data.update();return ob

def uvs(ob,per_vertex):
    """Explicit UVs, one (u,v) per vertex index."""
    me=ob.data;uv=me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
    for li,loop in enumerate(me.loops):uv.data[li].uv=per_vertex[loop.vertex_index]
    return ob

def arch(a,R,n=7):
    """Two-centred pointed arch of half-span a and rise R: left springing -> apex -> right springing."""
    rho=(a*a+R*R)/(2*a);cx=a-rho;phi=math.atan2(R,rho-a)
    right=[(cx+rho*math.cos(phi*i/n),rho*math.sin(phi*i/n)) for i in range(n+1)]
    return [(-x,y) for x,y in right]+[(x,y) for x,y in right[::-1][1:]]

def opening(a,h,R,n=5):
    return [(-a,-h)]+arch(a,R,n)+[(a,-h)]

def extrude(name,prof,F,d0,d1,m):
    n=len(prof);verts=[pt(*F(s,y,d0)) for s,y in prof]+[pt(*F(s,y,d1)) for s,y in prof]
    faces=[(k,(k+1)%n,n+(k+1)%n,n+k) for k in range(n)]+[tuple(range(n))[::-1],tuple(range(n,2*n))]
    return mesh(name,verts,faces,m,smooth=False,closed=True)

def frame(name,path,width,F,d0,d1,m):
    """Moulding swept along an open outline: `width` outward, d0..d1 deep."""
    n=len(path);norms=[]
    for i in range(n):
        p0=path[max(i-1,0)];p1=path[min(i+1,n-1)];tx,ty=p1[0]-p0[0],p1[1]-p0[1];l=math.hypot(tx,ty) or 1
        nx,ny=-ty/l,tx/l
        if 0<i<n-1:
            a0=path[i-1];a1=path[i];ex,ey=a1[0]-a0[0],a1[1]-a0[1];el=math.hypot(ex,ey) or 1
            k=max(.35,abs(nx*(-ey/el)+ny*(ex/el)));nx,ny=nx/k,ny/k
        norms.append((nx,ny))
    verts=[]
    for (s,y),(nx,ny) in zip(path,norms):
        for ss,yy,d in ((s,y,d1),(s+nx*width,y+ny*width,d1),(s+nx*width,y+ny*width,d0),(s,y,d0)):verts.append(pt(*F(ss,yy,d)))
    faces=[]
    for i in range(n-1):
        a,b=4*i,4*(i+1);faces+=[(a+k,a+(k+1)%4,b+(k+1)%4,b+k) for k in range(4)]
    faces+=[(0,1,2,3),(4*(n-1)+3,4*(n-1)+2,4*(n-1)+1,4*(n-1))]
    return mesh(name,verts,faces,m,smooth=False,closed=True)

def panel(name,prof,F,d,m,normal,uv=None):
    """Flat polygon in a wall frame; uv(s,y) gives explicit UVs from the outline coordinates."""
    ob=mesh(name,[pt(*F(s,y,d)) for s,y in prof],[tuple(range(len(prof)))],m,smooth=False)
    orient(ob,normal)
    if uv:uvs(ob,[uv(s,y) for s,y in prof])
    return ob

def unit_uv(prof):
    """0..1 over the outline's bounding box (glass, cards)."""
    s0=min(s for s,_ in prof);s1=max(s for s,_ in prof);y0=min(y for _,y in prof);y1=max(y for _,y in prof)
    return lambda s,y:((s-s0)/(s1-s0),(y-y0)/(y1-y0))

def revolve(name,prof,cx,cz,m,segs=16,urep=None,vlen=None,closed=False,smooth=True):
    """Surface of revolution through (r,y) points, faces outward (seam duplicated for UVs)."""
    verts=[];uvl=[];arc=[0.0]
    for j in range(1,len(prof)):arc.append(arc[-1]+math.hypot(prof[j][0]-prof[j-1][0],prof[j][1]-prof[j-1][1]))
    for j,(r,y) in enumerate(prof):
        for i in range(segs+1):
            t=2*math.pi*i/segs;verts.append(pt(cx+r*math.cos(t),y,cz+r*math.sin(t)));uvl.append((i/segs*(urep or 1),arc[j]/(vlen or 1)))
    W=segs+1;faces=[];rings=len(prof)
    for j in range(rings if closed else rings-1):
        for i in range(segs):
            k=(j+1)%rings;a,b,c,d=j*W+i,j*W+i+1,k*W+i+1,k*W+i
            if prof[k][0]<1e-6:faces.append((a,d,b))
            elif prof[j][0]<1e-6:faces.append((a,d,c))
            else:faces.append((a,d,c,b))
    ob=mesh(name,verts,faces,m,smooth=smooth)
    rc=sum(r for r,_ in prof)/len(prof) if closed else 0.0;yc=sum(y for _,y in prof)/len(prof)
    bm=bmesh.new();bm.from_mesh(ob.data);bm.normal_update();flip=[]
    for f in bm.faces:
        c=f.calc_center_median();dx,dy=c.x-cx,c.y+cz;d=math.hypot(dx,dy) or 1
        ref=Vector((cx+dx/d*rc,-cz+dy/d*rc,yc if closed else c.z))
        if f.normal.dot(c-ref)<0:flip.append(f)
    if flip:bmesh.ops.reverse_faces(bm,faces=flip)
    bm.to_mesh(ob.data);bm.free();ob.data.update()
    if urep:uvs(ob,uvl)
    return ob

def prism(name,cx,cz,r,y0,y1,sides,m,rot=None):
    rot=math.pi/sides if rot is None else rot
    ring=[(cx+r*math.cos(rot+2*math.pi*k/sides),cz+r*math.sin(rot+2*math.pi*k/sides)) for k in range(sides)]
    verts=[pt(x,y0,z) for x,z in ring]+[pt(x,y1,z) for x,z in ring];n=sides
    faces=[(k,(k+1)%n,n+(k+1)%n,n+k) for k in range(n)]+[tuple(range(n)),tuple(range(n,2*n))]
    return mesh(name,verts,faces,m,smooth=False,closed=True)

def pyramid(name,cx,cz,hw,hd,y0,y1,m):
    verts=[pt(cx-hw,y0,cz-hd),pt(cx+hw,y0,cz-hd),pt(cx+hw,y0,cz+hd),pt(cx-hw,y0,cz+hd),pt(cx,y1,cz)]
    return mesh(name,verts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,1,2,3)],m,smooth=False,closed=True)

def wall(name,F,s0,s1,y0,y1,m,normal,step=.9,top=None):
    """A wall face as a grid (vertex grime needs somewhere to live). top(s) clips a gable."""
    nx=max(1,round((s1-s0)/step));ny=max(1,round((y1-y0)/step));verts=[]
    for j in range(ny+1):
        for i in range(nx+1):
            s=s0+(s1-s0)*i/nx;yt=y1 if top is None else min(y1,top(s));verts.append(pt(*F(s,y0+(yt-y0)*j/ny,0)))
    faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
    return orient(mesh(name,verts,faces,m,smooth=False),normal)

def cone(name,x,y,z,r1,r2,h,m,verts=8):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=h,location=pt(x,y,z))
    o=bpy.context.object;finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o

def ellipsoid(name,x,y,z,rx,ry,rz,m,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=pt(x,y,z))
    o=bpy.context.object;o.scale=(rx,rz,ry);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=True
    return o

def catenary(a,b,sag,n=9):
    return [(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-sag*4*t*(1-t),a[2]+(b[2]-a[2])*t) for t in [i/(n-1) for i in range(n)]]

def wash(o,F,s,y0,w,h,normal,d=.03):
    """Night uplight plane: u across, v up; the fixture sits at the bottom."""
    prof=[(s-w/2,0),(s+w/2,0),(s+w/2,h),(s-w/2,h)]
    ob=mesh('uplight wash',[pt(*F(px,y0+py,d)) for px,py in prof],[(0,1,2,3)],WASH,smooth=False)
    orient(ob,normal);uvs(ob,[(0,0),(1,0),(1,1),(0,1)]);o.append(ob)
    fx,fy,fz=F(s,y0+.05,.12);o.append(box('uplight fixture',fx,fy,fz,.22,.1,.18,IRON))

def cross_mark(o,x,y,z,h,m,th=.1):
    """A plain Latin cross, arms at two-thirds height."""
    o.append(box('cross',x,y+h/2,z,h*.12,h,th,m));o.append(box('cross arm',x,y+h*.68,z,h*.62,h*.12,th,m))

# ------------------------------------------------------------------ church: Gereja Harapan
NX,NZ0,NZ1,WALL1=6.4,-7.8,7.6,10.2     # nave half-width, rear and front wall planes, wall top
RIDGE_Y,EAVE_X,EAVE_Y=17.0,6.9,10.1
TX,TZ0=2.6,2.8                         # engaged tower: x +-2.6, z 2.8..7.6
def roof_y(x):return EAVE_Y+(EAVE_X-abs(x))*(RIDGE_Y-EAVE_Y)/EAVE_X

def lancet(o,F,normal,s,sill,a,h,R,fw=.14,depth=.14,mullions=0):
    prof=opening(a,h,R);F2=lambda ss,yy,d:F(s+ss,sill+h+yy,d)
    o.append(panel('stained glass',prof,F2,.012,GLASS,normal,unit_uv(prof)))
    o.append(frame('window surround',prof,fw,F2,0,depth,STONE))
    o.append(extrude('window sill',[(-a-fw-.06,-h-.12),(a+fw+.06,-h-.12),(a+fw+.06,-h),(-a-fw-.06,-h)],F2,0,depth+.08,STONE))
    for k in range(mullions):
        ms=-a+2*a*(k+1)/(mullions+1)
        o.append(extrude('mullion',[(ms-.05,-h),(ms+.05,-h),(ms+.05,.2),(ms-.05,.2)],F2,.0,.1,STONE))

def buttress(o,F,s,depth0,w,y0,y1,normal):
    """Two-stage buttress with sloped stone weatherings, standing out of a wall frame."""
    ym=y0+(y1-y0)*.55
    for (ya,yb,dp) in ((y0,ym,depth0),(ym,y1,depth0*.62)):
        x,_,z=F(s,0,dp/2);o.append(box('buttress',x,(ya+yb)/2,z,w if normal[2] else dp,yb-ya,dp if normal[2] else w,RENDER));o[-1]['ledges']=[yb]
        # sloped stone weathering: a prism across the buttress width
        cap=[(0,yb),(dp+.04,yb),(0,yb+(dp+.04)*.9)]
        verts=[];faces=[]
        for ss in (-w/2-.03,w/2+.03):
            for dd,yy in cap:verts.append(pt(*F(s+ss,yy,dd)))
        faces=[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]
        o.append(mesh('weathering cap',verts,faces,STONE,smooth=False,closed=True))

def pinnacle(o,x,z,y0,h,r=.24):
    o.append(box('pinnacle shaft',x,y0+h*.55/2,z,r*2,h*.55,r*2,STONE))
    o.append(pyramid('pinnacle spirelet',x,z,r*1.05,r*1.05,y0+h*.55,y0+h,STONE))
    o.append(kit.ico('pinnacle knop',x,y0+h+.08,z,.09,STONE,1.0,1))

def church():
    o=[box('plaza',0,.12,3,20,.24,28,PLAZA)]
    # garden: laterite path between lawns bordered by ixora, flower beds along the flanks
    o.append(box('path',0,.255,12.6,3.0,.03,8.8,PATH))
    for sx in (-1,1):
        o.append(box('lawn',sx*5.9,.29,12.7,7.4,.1,8.0,LAWN))
        o.append(box('lawn kerb',sx*5.9,.27,12.7,7.6,.06,8.2,GRANITE))
        o.append(box('ixora hedge',sx*2.1,.62,12.9,.55,.58,7.2,HEDGE,.12))
        o.append(box('ixora hedge',sx*9.35,.62,12.7,.55,.58,7.6,HEDGE,.12))
        o.append(box('flank bed',sx*8.4,.29,-1.0,2.6,.1,13.0,LAWN))
        for z in (-6.5,-2.5,1.5,5.5):o.append(ellipsoid('shrub',sx*8.7,.75,z,.55,.5,.55,HEDGE))
        # lamp posts by the path
        o.append(box('lamp plinth',sx*1.9,.4,16.85,.36,.32,.36,GRANITE))
        o.append(cyl('lamp post',sx*1.9,1.95,16.85,.06,2.8,IRON,T,verts=8))
        o.append(prism('lamp lantern',sx*1.9,16.85,.17,3.35,3.8,6,LAMP))
        o.append(cone('lamp cap',sx*1.9,3.93,16.85,.24,.02,.26,IRON,6))
    # plinth and steps
    o.append(box('plinth',0,.52,-.1,13.3,.56,15.9,GRANITE,.02))
    for i,(z,d,top) in enumerate(((8.55,.9,.52),(8.15,.7,.8))):o.append(box('step',0,top-.14,z,4.4-i*.4,.28,d,GRANITE,.02))
    front=facing(0,NZ1,0,1);rear=facing(0,NZ0,0,-1);east=facing(-NX,0,-1,0);west=facing(NX,0,1,0)
    # nave walls (front stops at the tower, which carries its own face above the nave wall)
    o.append(wall('nave wall',front,-NX,NX,.8,WALL1,RENDER,(0,0,1)));o[-1]['ledges']=[8.55]
    for F,n in ((east,(-1,0,0)),(west,(1,0,0))):o.append(wall('nave wall',F,NZ0,NZ1,.8,WALL1,RENDER,n));o[-1]['ledges']=[WALL1]
    o.append(wall('nave wall',rear,-NX,NX,.8,WALL1,RENDER,(0,0,-1)));o[-1]['ledges']=[WALL1]
    # gables: rear full, front beside the tower
    o.append(wall('rear gable',rear,-NX,NX,WALL1,RIDGE_Y,RENDER,(0,0,-1),top=lambda s:roof_y(s)-.1))
    for sx in (-1,1):
        s0,s1=(TX,NX) if sx>0 else (-NX,-TX)
        o.append(wall('front gable',front,s0,s1,WALL1,roof_y(TX),RENDER,(0,0,1),top=lambda s:roof_y(s)-.1))
        a=(TX,roof_y(TX)+.05,NZ1+.12);b=(NX+.35,EAVE_Y+.05-.35,NZ1+.12)
        o.append(kit.strut('gable coping',(sx*a[0],a[1],a[2]),(sx*b[0],b[1],b[2]),.36,STONE,.22))
    # string courses and the sign frame (the canvas sign sits at z 7.72, y 8.85..9.75)
    o.append(box('string course',0,8.45,NZ1+.07,2*NX+.1,.18,.14,STONE))
    o.append(box('sign frame',0,9.3,NZ1+.04,12.6,1.3,.08,STONE))
    o.append(box('wall head',0,WALL1-.08,NZ1+.05,2*NX+.1,.16,.1,STONE))
    for F,n in ((east,(-1,0,0)),(west,(1,0,0))):
        x,_,z=F(0,0,.07);o.append(box('eaves course',x,WALL1-.1,-.1,.14,.2,NZ1-NZ0+.1,STONE))
    # doorway: timber doors under a glazed tympanum, deep moulded surround
    a,h,R=1.2,2.9,1.55;sill=.8;F2=lambda s,y,d:front(s,sill+h+y,d)
    o.append(panel('door leaves',[(-a,-h),(a,-h),(a,0),(-a,0)],F2,.02,TEAK,(0,0,1)))
    o.append(panel('tympanum glass',arch(a,R),F2,.02,GLASS,(0,0,1),unit_uv(arch(a,R))))
    o.append(box('transom',0,sill+h,NZ1+.06,2*a,.12,.1,STONE))
    o.append(frame('door surround',opening(a,h,R),.3,F2,0,.3,STONE))
    o.append(frame('door hood mould',[(x,y) for x,y in arch(a+.3,R+.3)],.12,lambda s,y,d:F2(s,y,d),0,.4,STONE))
    o.append(box('door meeting stile',0,sill+h/2,NZ1+.05,.08,h,.06,TEAK))
    for sx in (-1,1):
        for y in (1.5,2.6,3.4):o.append(box('strap hinge',sx*.7,y,NZ1+.06,.95,.07,.03,IRON))
        o.append(box('door lamp bracket',sx*1.9,4.5,NZ1+.22,.06,.06,.4,IRON))
        o.append(prism('door lamp',sx*1.9,NZ1+.42,.14,4.1,4.55,6,LAMP))
    for sx in (-1,1):lancet(o,front,(0,0,1),sx*4.1,2.4,.48,2.4,.8)
    # angle buttresses at the front corners (tops stay under the sign's lower edge)
    for sx in (-1,1):
        buttress(o,front,sx*5.85,.85,.7,.8,7.6,(0,0,1))
        buttress(o,facing(sx*NX,7.05,sx,0),0,.85,.7,.8,7.6,(sx,0,0))
        pinnacle(o,sx*6.3,7.3,WALL1,2.2)
    # side walls: four bays of lancets between buttresses
    for sx,F,n in ((-1,east,(-1,0,0)),(1,west,(1,0,0))):
        for z in (-7.35,-3.55,.3,4.05):buttress(o,F,-z*sx if sx>0 else z,.9,.7,.8,7.4,n)
        for z in (-5.45,-1.6,2.2,5.6):lancet(o,F,n,-z if sx>0 else z,3.0,.55,3.0,.85)
        x,_,_=F(0,0,.14);o.append(box('eaves fascia',sx*(EAVE_X+.02),EAVE_Y-.08,-.1,.1,.26,NZ1-NZ0+.9,FASCIA))
        o.append(box('gutter',sx*(EAVE_X+.1),EAVE_Y-.22,-.1,.16,.12,NZ1-NZ0+.9,IRON))
    lancet(o,rear,(0,0,-1),0,4.0,.9,3.8,1.2,mullions=1)
    lancet(o,rear,(0,0,-1),0,11.0,.45,1.6,.7)
    for sx in (-1,1):buttress(o,rear,sx*4.2,.8,.7,.8,7.2,(0,0,-1))
    # slate roof: two planes with explicit UVs (u along the ridge, v up the slope from the eave)
    tile=SLATE['tex_m'];slope=math.hypot(EAVE_X,RIDGE_Y-EAVE_Y)
    for sx in (-1,1):
        zs=(NZ0-.45,TZ0+.02,NZ1+.05)
        for za,zb,xin in ((zs[0],zs[1],0.0),(zs[1],zs[2],TX)):
            x_top=xin;y_top=roof_y(x_top)
            q=[(sx*EAVE_X,EAVE_Y,za),(sx*EAVE_X,EAVE_Y,zb),(sx*x_top,y_top,zb),(sx*x_top,y_top,za)]
            ob=mesh('roof slates',[pt(*p) for p in q],[(0,1,2,3)],SLATE,smooth=False);orient(ob,(sx*(RIDGE_Y-EAVE_Y),EAVE_X,0))
            uvs(ob,[(p[2]/tile,(EAVE_X-abs(p[0]))/EAVE_X*slope/tile) for p in q]);o.append(ob)
            under=mesh('roof soffit',[pt(p[0],p[1]-.12,p[2]) for p in q],[(0,1,2,3)],FASCIA,smooth=False);orient(under,(-sx,-1,0));o.append(under)
    o.append(box('ridge',0,RIDGE_Y+.06,(NZ0-.45+TZ0)/2,.34,.16,TZ0-NZ0+.45,IRON))
    for sx in (-1,1):   # verges along the rear gable
        o.append(kit.strut('verge',(0,RIDGE_Y+.02,NZ0-.45),(sx*(EAVE_X+.05),EAVE_Y-.03,NZ0-.45),.14,FASCIA,.26))
    # tower above the nave wall
    ty0,ty1=WALL1,21.5;tfront=facing(0,NZ1,0,1);tback=facing(0,TZ0,0,-1)
    o.append(wall('tower wall',tfront,-TX,TX,ty0,ty1,RENDER,(0,0,1)));o[-1]['ledges']=[21.5,17.25]
    o.append(wall('tower wall',tback,-TX,TX,roof_y(TX)-.3,ty1,RENDER,(0,0,-1)));o[-1]['ledges']=[21.5,17.25]
    for sx in (-1,1):o.append(wall('tower wall',facing(sx*TX,(TZ0+NZ1)/2,sx,0),-2.4,2.4,roof_y(TX)-.3,ty1,RENDER,(sx,0,0)));o[-1]['ledges']=[21.5,17.25]
    tc=(TZ0+NZ1)/2
    for sx in (-1,1):
        for zz in (TZ0,NZ1):o.append(box('tower pilaster',sx*(TX+.05),(ty1+10.35)/2,zz+(.05 if zz==NZ1 else -.05),.4,ty1-10.35,.4,STONE))
    lancet(o,tfront,(0,0,1),0,10.75,1.05,2.7,1.45,mullions=2)
    for y in (17.2,21.2):o.append(box('tower string course',0,y,tc,2*TX+.32,.2,NZ1-TZ0+.32,STONE))
    for F,n in ((tfront,(0,0,1)),(tback,(0,0,-1)),(facing(TX,tc,1,0),(1,0,0)),(facing(-TX,tc,-1,0),(-1,0,0))):
        prof=opening(.62,1.55,.85);F2=lambda s,y,d,F=F:F(s,17.5+1.55+y,d)
        o.append(panel('belfry louvre',prof,F2,.015,LOUVRE,n,lambda s,y:(s/.6,y/.6)))
        o.append(frame('belfry surround',prof,.13,F2,0,.14,STONE))
    # battlements, corner pinnacles, octagonal slate spire and its cross
    for sx,sz,w,d in ((0,1,2*TX+.3,.25),(0,-1,2*TX+.3,.25),(1,0,.25,NZ1-TZ0+.3),(-1,0,.25,NZ1-TZ0+.3)):
        x=sx*(TX+.02);z=tc+sz*((NZ1-TZ0)/2+.02)
        o.append(box('parapet',x,21.75,z,w,.5,d,STONE))
        k=5;span=w if w>1 else d
        for i in range(k):
            off=-span/2+span*(i+.5)/k
            o.append(box('merlon',x+(off if w>1 else 0),22.2,z+(off if d>1 else 0),(.36 if w>1 else .25),.4,(.25 if w>1 else .36),STONE))
    for sx in (-1,1):
        for zz in (TZ0-.05,NZ1+.05):pinnacle(o,sx*(TX+.05),zz,21.5,2.6,.22)
    prof=[(2.05,21.5),(1.72,23.0),(.2,31.4),(0,31.6)]
    ob=revolve('spire',prof,0,tc,SLATE,8,urep=8*2.05*.765/SLATE['tex_m'],vlen=SLATE['tex_m'],smooth=False);o.append(ob)
    o.append(kit.ico('spire knop',0,31.62,tc,.14,GOLD,1.0,1))
    cross_mark(o,0,31.7,tc,1.9,GOLD,.1)
    cross_mark(o,0,roof_y(0)+.1,NZ0-.35,1.1,STONE,.14)
    # night: stained glass glows (materials), uplight on the facade and the tower
    for sx in (-1,1):wash(o,front,sx*4.1,.8,2.2,7.4,(0,0,1),d=.2)
    wash(o,tfront,0,WALL1+.25,3.0,10.5,(0,0,1),d=.3)
    return o

# ------------------------------------------------------------------ kuil: Kuil Seri Harmoni
GZ=5.1;BASE_TOP=6.0;TIER_H=2.1;TIERS=5
def tier_hw(i):return 6.0-.55*i,2.45-.25*i

def storey(o,cz,hw,hd,hwt,hdt,y0,h,band):
    """A battered storey: four leaning faces of painted stucco meeting at the corners. u runs in 4 m
    tiles from each face's left corner (so a pilaster sits on every corner), v into the band's half."""
    off=.5 if band==0 else 0.0;y1=y0+h
    faces=(((-hw,y0,cz+hd),(hw,y0,cz+hd),(hwt,y1,cz+hdt),(-hwt,y1,cz+hdt),hw,hwt,(0,.15,1)),
           ((hw,y0,cz-hd),(-hw,y0,cz-hd),(-hwt,y1,cz-hdt),(hwt,y1,cz-hdt),hw,hwt,(0,.15,-1)),
           ((hw,y0,cz+hd),(hw,y0,cz-hd),(hwt,y1,cz-hdt),(hwt,y1,cz+hdt),hd,hdt,(1,.15,0)),
           ((-hw,y0,cz-hd),(-hw,y0,cz+hd),(-hwt,y1,cz+hdt),(-hwt,y1,cz-hdt),hd,hdt,(-1,.15,0)))
    for bl,br,tr,tl,wb,wt,n in faces:
        ob=mesh('storey face',[pt(*bl),pt(*br),pt(*tr),pt(*tl)],[(0,1,2,3)],GOP,smooth=False);orient(ob,n)
        uvs(ob,[(0,off),(2*wb/4,off),((wb+wt)/4,off+.5),((wb-wt)/4,off+.5)]);o.append(ob)

def kalasam(o,x,y,z,s=1.0,m=None):
    prof=[(0,0),(.2,0),(.27,.1),(.24,.24),(.12,.33),(.15,.44),(.09,.54),(.12,.64),(.05,.86),(0,1.12)]
    o.append(revolve('kalasam',[(r*s,y+v*s) for r,v in prof],x,z,m or GOLD,10,smooth=True))

def bell(o,x,y,z,s=1.0):
    prof=[(0,0),(.05,0),(.07,-.05),(.09,-.16),(.13,-.25),(.02,-.25)]
    o.append(revolve('bell',[(r*s,y+v*s) for r,v in prof],x,z,BRASS,10))
    o.append(cyl('bell clapper',x,y-.26*s,z,.025*s,.06*s,BRASS,T,verts=6))

def oil_lamp(o,x,z,h=1.5):
    """Kuthu vilakku: a brass standing lamp with a dish of five wicks."""
    o.append(revolve('lamp stand',[(0,.24),(.28,.24),(.22,.32),(.05,.4),(.04,h-.3),(.1,h-.25),(.04,h-.2),(.05,h-.1),(.28,h-.05),(.26,h),(0,h)],x,z,BRASS,10))
    for k in range(5):
        t=2*math.pi*k/5;o.append(cone('lamp flame',x+.2*math.cos(t),h+.07,z+.2*math.sin(t),.035,.0,.13,FLAME,5))
    o.append(kit.ico('lamp finial',x,h+.35,z,.07,BRASS,1.0,1))
    o.append(cyl('lamp rod',x,h+.17,z,.02,.3,BRASS,T,verts=6))

def garland(o,a,b,sag,r=.065):
    o.append(kit.tube('marigold garland',catenary(a,b,sag),r,MARIGOLD,6))

def nandi(o,x,y,z,yaw):
    """Seated bull on the parapet corner, white-painted stucco."""
    c,s=math.cos(yaw),math.sin(yaw);L=lambda f,u:(x+c*f-s*u,z+s*f+c*u)   # f forward, u sideways
    bx,bz=L(0,0);o.append(ellipsoid('nandi body',bx,y+.32,bz,.34 if abs(c)<.5 else .55,.3,.55 if abs(c)<.5 else .34,STUCCO))
    hx,hz=L(.1,0);o.append(ellipsoid('nandi hump',hx,y+.6,hz,.18,.16,.18,STUCCO))
    hx,hz=L(.55,0);o.append(ellipsoid('nandi head',hx,y+.66,hz,.17,.2,.17,STUCCO))
    for u in (-1,1):
        px,pz=L(.52,u*.15);o.append(cone('nandi horn',px,y+.93,pz,.05,.0,.18,GOLD,5))
    px,pz=L(.35,0);o.append(ellipsoid('nandi garland',px,y+.45,pz,.16,.08,.16,MARIGOLD))

def hindu():
    o=[box('plaza',0,.12,3,20,.24,28,PLAZA)]
    ok=kit.mesh('kolam',[pt(x,.252,z) for x,z in ((-1.2,10.4),(1.2,10.4),(1.2,12.8),(-1.2,12.8))],[(0,1,2,3)],KOLAM,smooth=False)
    orient(ok,(0,1,0));uvs(ok,[(0,1),(1,1),(1,0),(0,0)]);o.append(ok)
    for sx in (-1,1):oil_lamp(o,sx*2.9,9.6)
    # ---- mandapam: plinth, floor, painted pillars, roof, parapet with nandi
    o.append(box('mandapam plinth',0,.62,-2.6,15.4,.76,10.6,GRANITE,.03))
    o.append(box('plinth roll',0,.62,-2.6,15.6,.2,10.8,GRANITE,.02))
    o.append(box('mandapam floor',0,1.01,-2.62,15.0,.03,10.3,FLOOR))
    pillars=[(sx*7.2,z) for sx in (-1,1) for z in (-7.3,-4.95,-2.6,-.25,2.1)]+[(x,-7.3) for x in (-4.3,-1.45,1.45,4.3)]
    for px,pz in pillars:
        hw=.25;quad=[]
        for k,(nx,nz) in enumerate(((0,1),(1,0),(0,-1),(-1,0))):
            F=facing(px+nx*hw,pz+nz*hw,nx,nz)
            o.append(panel('pillar face',[(-hw,1.02),(hw,1.02),(hw,5.62),(-hw,5.62)],F,0,PILLAR,(nx,0,nz),lambda s,y:((s+.25)/.5,(y-1.02)/4.6)))
        o.append(box('pillar corbel',px,5.74,pz,.9,.24,.9,TRIM))
        o.append(box('pillar base',px,1.12,pz,.62,.2,.62,GRANITE))
    for sx in (-1,1):o.append(box('architrave',sx*7.2,6.02,-2.6,.6,.36,10.3,TRIM))
    o.append(box('architrave',0,6.02,-7.3,15.0,.36,.6,TRIM))
    o.append(box('mandapam roof',0,6.45,-2.6,15.5,.5,10.8,STUCCO,.02))
    o.append(box('roof soffit band',0,6.18,-2.6,15.55,.1,10.85,TRIM))
    # parapet: painted cornice-and-shrines band outside, plain stucco inside
    for F,n,s0,s1,cx,cz,w,d in ((facing(-7.75,-2.6,-1,0),(-1,0,0),-5.4,5.4,-7.66,-2.6,.2,10.8),(facing(7.75,-2.6,1,0),(1,0,0),-5.4,5.4,7.66,-2.6,.2,10.8),(facing(0,-8.0,0,-1),(0,0,-1),-7.75,7.75,0,-7.91,15.5,.2)):
        o.append(box('parapet',cx,7.1,cz,w,.8,d,STUCCO))
        o.append(panel('parapet band',[(s0,6.7),(s1,6.7),(s1,7.5),(s0,7.5)],F,.03,GOP,n,lambda s,y,s0=s0:((s-s0)/4.9,.5*((1.45+(y-6.7)/.8*.65)/TIER_H))))
    for x,z,yaw in ((-7.1,-7.35,math.pi*.75),(7.1,-7.35,math.pi*.25),(-7.1,1.9,-math.pi*.75),(7.1,1.9,-math.pi*.25)):nandi(o,x,7.5,z,yaw+math.pi)
    # marigold swags between the corbels
    for sx in (-1,1):
        for za,zb in ((-7.3,-4.95),(-4.95,-2.6),(-2.6,-.25),(-.25,2.1)):garland(o,(sx*7.52,5.62,za),(sx*7.52,5.62,zb),.42)
    for xa,xb in ((-7.2,-4.3),(-4.3,-1.45),(-1.45,1.45),(1.45,4.3),(4.3,7.2)):garland(o,(xa,5.62,-7.62),(xb,5.62,-7.62),.42)
    # sanctum with kavi stripes, its lit doorway, lamps and a bell
    o.append(box('sanctum',0,3.63,-4.7,5.8,5.22,5.2,STRIPES))
    sF=facing(0,-2.1,0,1)
    prof=[(-.75,0),(.75,0),(.75,2.5),(-.75,2.5)]
    o.append(panel('sanctum doorway',prof,lambda s,y,d:sF(s,1.02+y,d),.01,GLOW,(0,0,1),unit_uv(prof)))
    o.append(frame('sanctum door frame',[(-.75,0),(-.75,2.5),(.75,2.5),(.75,0)],.22,lambda s,y,d:sF(s,1.02+y,d),0,.18,GRANITE))
    for sx in (-1,1):oil_lamp(o,sx*1.35,-1.5,1.2)
    bell(o,0,3.9,-1.8,1.4);o.append(cyl('bell chain',0,5.0,-1.8,.012,2.2,BRASS,T,verts=4))
    # vimana over the sanctum
    vz=-4.7;hw,hd=2.55,2.3
    storey(o,vz,hw,hd,hw-.25,hd-.25,6.7,TIER_H,1)
    o.append(box('vimana cornice',0,6.7+1.555,vz,2*hw+.3,.21,2*hd+.3,TRIM,.02))
    o.append(box('vimana top',0,8.84,vz,2*hw-.4,.08,2*hd-.4,TRIM))
    o.append(prism('vimana griva',0,vz,1.45,8.8,9.45,8,TRIM))
    o.append(revolve('vimana dome',[(1.55,9.45),(1.95,9.8),(1.95,10.25),(1.6,10.85),(.9,11.3),(.3,11.45),(0,11.47)],0,vz,VAULT,8,smooth=False))
    kalasam(o,0,11.42,vz,1.35)
    # ---- gopuram base: moulded plinth, painted stucco with pilasters and deity niches, a real passage
    o.append(box('gopuram plinth',0,.62,GZ,12.8,.76,5.4,GRANITE,.03))
    o.append(box('plinth roll',0,.66,GZ,13.0,.18,5.6,GRANITE,.02))
    front=facing(0,GZ+2.5,0,1)
    for s0,s1 in ((-6.2,-1.3),(1.3,6.2)):o.append(wall('gopuram base',front,s0,s1,1.0,5.6,STUCCO,(0,0,1)))
    o.append(wall('gopuram lintel',front,-1.3,1.3,4.4,5.6,STUCCO,(0,0,1)))
    for sx in (-1,1):
        o.append(wall('gopuram base',facing(sx*6.2,GZ,sx,0),-2.5,2.5,1.0,5.6,STRIPES,(sx,0,0)))
        for s in (2.25,4.25,6.05):o.append(box('base pilaster',sx*s,3.3,GZ+2.58,.36,4.6,.16,STUCCO))
        # niches with deities lifted from the storey texture (band 0, niches 1 and 2)
        cx=sx*3.25;prof=[(-.75,0),(.75,0),(.75,2.7),(-.75,2.7)]
        u0=.25 if sx<0 else .5
        o.append(panel('base niche',prof,lambda s,y,d,cx=cx:front(cx+s,1.55+y,d),.02,GOP,(0,0,1),lambda s,y,u0=u0:(u0+(s+.75)/1.5*.25,.5+(.16+y/2.7*1.25)/TIER_H*.5)))
        o.append(frame('niche frame',[(-.75,0),(-.75,2.7),(.75,2.7),(.75,0)],.1,lambda s,y,d,cx=cx:front(cx+s,1.55+y,d),0,.12,TRIM))
    o.append(wall('gopuram base',facing(0,GZ-2.5,0,-1),-6.2,6.2,1.0,5.6,STRIPES,(0,0,-1)))
    # passage: reveals, ceiling, floor, lit inner doorway, doors swung back, bells, thoranam, garland
    for sx in (-1,1):o.append(wall('passage reveal',facing(sx*1.3,GZ+.7,-sx,0),-1.8,1.8,1.0,4.4,STUCCO,(-sx,0,0)))
    o.append(box('passage ceiling',0,4.46,GZ+.7,2.62,.12,3.6,TRIM))
    o.append(box('passage floor',0,1.01,GZ+.7,2.6,.04,3.6,FLOOR))
    inner=[(-1.3,0),(1.3,0),(1.3,3.4),(-1.3,3.4)]
    o.append(panel('passage glow',inner,lambda s,y,d:facing(0,GZ-1.1,0,1)(s,1.0+y,d),0,GLOW,(0,0,1),unit_uv(inner)))
    for sx in (-1,1):o.append(box('door leaf',sx*1.22,2.68,GZ+1.3,.12,3.3,1.25,TDOOR))
    o.append(frame('door frame',[(-1.3,-3.4),(-1.3,0),(1.3,0),(1.3,-3.4)],.32,lambda s,y,d:front(s,4.4+y,d),0,.3,GRANITE))
    o.append(box('bell bar',0,4.28,GZ+2.3,2.5,.05,.05,BRASS))
    for x in (-.8,-.4,0,.4,.8):bell(o,x,4.22,GZ+2.3,.8 if x else 1.0)
    for k in range(13):
        x=-1.5+3.0*k/12;leaf=[pt(x-.07,4.72,GZ+2.84),pt(x+.07,4.72,GZ+2.84),pt(x,4.3-.06*(k%2),GZ+2.86)]
        ob=kit.mesh('mango leaf',leaf,[(0,1,2)],LEAF,smooth=False);orient(ob,(0,0,1));o.append(ob)
    o.append(box('thoranam cord',0,4.73,GZ+2.84,3.1,.03,.03,BRASS))
    garland(o,(-1.75,4.65,GZ+2.98),(1.75,4.65,GZ+2.98),.5,.07)
    for sx in (-1,1):o.append(kit.tube('garland drop',[(sx*1.75,4.65,GZ+2.98),(sx*1.75,3.7,GZ+2.98)],.06,MARIGOLD,6))
    # steps up to the passage
    o.append(box('step',0,.43,GZ+3.45,5.2,.38,.9,GRANITE,.02));o.append(box('step',0,.81,GZ+2.85,4.6,.38,.5,GRANITE,.02))
    # cornice over the sign and the platform the storeys stand on
    o.append(box('base cornice',0,5.8,GZ,12.9,.4,5.5,TRIM,.03))
    o.append(box('storey platform',0,6.15,GZ,12.3,.3,5.0,STUCCO,.02))
    # ---- five storeys
    y0=6.3
    for i in range(TIERS):
        hw,hd=tier_hw(i);hwt,hdt=hw-.3,hd-.12;band=i%2;yb=y0+i*TIER_H
        storey(o,GZ,hw,hd,hwt,hdt,yb,TIER_H,band)
        k=1.45/TIER_H;cw,cd=hw-.3*k+.22,hd-.12*k+.22
        o.append(box('kapota cornice',0,yb+1.555,GZ,2*cw-.12,.21,2*cd-.12,TRIM,.03))
        o.append(box('storey ledge',0,yb+TIER_H+.03,GZ,2*hwt+.1,.06,2*hdt+.1,TRIM))
        for sx in (-1,1):
            for sz in (-1,1):
                cx,cz=sx*(hwt-.12),GZ+sz*(hdt-.12)
                o.append(box('kuta',cx,yb+TIER_H+.28,cz,.42,.45,.42,TRIM))
                o.append(revolve('kuta dome',[(.26,yb+TIER_H+.5),(.3,yb+TIER_H+.62),(.2,yb+TIER_H+.8),(0,yb+TIER_H+.9)],cx,cz,VAULT,8))
                o.append(cone('kuta finial',cx,yb+TIER_H+1.0,cz,.05,.0,.22,GOLD,6))
    # crown: griva, barrel vault with horseshoe gable arches, seven kalasam
    yc=y0+TIERS*TIER_H;hw,hd=tier_hw(TIERS-1);hwt,hdt=hw-.3,hd-.12
    o.append(box('crown griva',0,yc+.3,GZ,2*hwt-.2,.6,2*hdt-.1,STUCCO))
    R=1.25;arc=[(-R*math.cos(math.pi*j/12),R*math.sin(math.pi*j/12)*1.12) for j in range(13)]
    o.append(extrude('barrel vault',[(z,y) for z,y in arc],lambda s,y,d:(d,yc+.6+y,GZ+s),-(hwt-.25),hwt-.25,VAULT))
    for sx in (-1,1):
        F=lambda s,y,d,sx=sx:(sx*(hwt-.25)+sx*d,yc+.6+y,GZ-sx*s)
        horse=[(R*1.15*math.cos(a),R*1.15*math.sin(a)*1.1) for a in [math.radians(-20+220*j/14) for j in range(15)]]
        o.append(frame('kudu arch',horse,.22,F,0,.18,GOLD))
        o.append(cyl('kirtimukha',sx*(hwt-.18),yc+1.1,GZ,.38,.1,TRIM,T,axis='x',verts=12))
    for j in range(7):kalasam(o,-2.7+j*.9,yc+.6+R*1.12-.05,GZ,1.0)
    # night: uplight on the gopuram base (the storeys are floodlit by their materials)
    for sx in (-1,1):wash(o,front,sx*4.2,1.0,2.4,4.6,(0,0,1),d=.2)
    return o

# ------------------------------------------------------------------ tokong: Tokong Harmoni
def concave(t,k=1.5):return 1-(1-t)**k

def roof_plane(o,name,top_a,top_b,eave_a,eave_b,y_top,y_eave,lift,out,nu=14,nv=7,under=True):
    """A curved Chinese roof plane between a top edge and an eave edge (game-space (x,z) pairs),
    concave in section (steep at the top, flat at the eave) with the eave corners lifted. Explicit UVs:
    u along the eave in metres, v up the slope in metres. Returns the eave edge points."""
    verts=[];uvl=[];eave=[]
    tile=TILES['tex_m'];slope=math.hypot(math.hypot(eave_a[0]-top_a[0],eave_a[1]-top_a[1]),y_top-y_eave)
    L=math.hypot(eave_b[0]-eave_a[0],eave_b[1]-eave_a[1])
    for j in range(nv+1):
        t=j/nv
        for i in range(nu+1):
            s=i/nu;a=(top_a[0]+(top_b[0]-top_a[0])*s,top_a[1]+(top_b[1]-top_a[1])*s);b=(eave_a[0]+(eave_b[0]-eave_a[0])*s,eave_a[1]+(eave_b[1]-eave_a[1])*s)
            w=abs(2*s-1)**3;y=y_top-(y_top-y_eave)*concave(t)+lift*w*t**2
            x=a[0]+(b[0]-a[0])*t;z=a[1]+(b[1]-a[1])*t
            verts.append((x,y,z));uvl.append((s*L/tile,(1-t)*slope/tile))
            if j==nv:eave.append((x,y,z))
    faces=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)]
    ob=mesh(name,[pt(*v) for v in verts],faces,TILES,smooth=True)
    orient(ob,(out[0],1.2,out[1]));uvs(ob,uvl);o.append(ob)
    if under:
        ub=mesh(name+' soffit',[pt(x,y-.16,z) for x,y,z in verts],faces,SOFFIT,smooth=True);orient(ub,(-out[0],-1.2,-out[1]));o.append(ub)
    return eave

def eave_strip(o,pts,out,h=.3):
    """Tile ends along an eave, facing out, UV u along in metres."""
    verts=[];uvl=[];acc=0.0
    for i,(x,y,z) in enumerate(pts):
        if i:acc+=math.dist(pts[i-1],pts[i])
        verts+=[pt(x,y-h,z),pt(x,y+.02,z)];uvl+=[(acc/.6,0),(acc/.6,1)]
    faces=[(2*i,2*i+2,2*i+3,2*i+1) for i in range(len(pts)-1)]
    ob=mesh('eave tile ends',verts,faces,EAVES,smooth=False);orient(ob,(out[0],-.15,out[1]));uvs(ob,uvl);o.append(ob)

def lantern(o,x,y,z,s=1.0,hang=None):
    o.append(ellipsoid('lantern',x,y,z,.3*s,.36*s,.3*s,LANTERN,2))
    for dy in (.34,-.34):o.append(cyl('lantern cap',x,y+dy*s,z,.13*s,.07*s,GOLD,T,verts=8))
    o.append(cyl('lantern tassel',x,y-.55*s,z,.035*s,.3*s,LANTERN,T,verts=5))
    top=y+.38*s;hang=hang or top+.25
    o.append(cyl('lantern cord',x,(top+hang)/2,z,.012,hang-top,IRON,T,verts=4))

def lion(o,x,z,sx):
    """Stone guardian lion (shi) sitting up on its plinth: a big square head ringed with mane curls,
    open mouth, a curled chest, forelegs straight, a ball under one paw (the male, sx<0) or a cub."""
    o.append(box('lion plinth',x,.62,z,.95,.76,1.25,GRANITE,.03))
    o.append(box('lion plinth cap',x,1.04,z,1.05,.08,1.35,LION))
    o.append(ellipsoid('lion haunch',x,1.36,z-.22,.4,.3,.42,LION))
    o.append(ellipsoid('lion chest',x,1.7,z+.05,.3,.45,.28,LION))
    for u in (-1,1):
        o.append(cyl('lion foreleg',x+u*.17,1.36,z+.3,.08,.56,LION,T,verts=8))
        o.append(ellipsoid('lion paw',x+u*.17,1.12,z+.38,.1,.06,.13,LION))
    for k in range(3):o.append(kit.ico('chest curl',x+(k-1)*.14,1.72,z+.3,.07,LION,1.0,1))
    hy,hz=2.22,z+.16
    o.append(box('lion head',x,hy,hz,.52,.46,.42,LION,.08))
    for k in range(10):
        t=math.pi*(k/9)*1.25-math.pi*.125
        o.append(kit.ico('mane curl',x+.33*math.cos(t),hy-.02+.3*math.sin(t),hz-.08,.1,LION,1.0,1))
    for k in range(4):o.append(kit.ico('mane curl',x+(k-1.5)*.17,hy-.28,hz-.12,.09,LION,1.0,1))
    o.append(box('lion brow',x,hy+.1,hz+.22,.46,.08,.08,LION))
    for u in (-1,1):o.append(kit.ico('lion eye',x+u*.12,hy+.03,hz+.22,.05,LION,1.0,1))
    o.append(box('lion nose',x,hy-.06,hz+.25,.16,.1,.1,LION))
    o.append(ellipsoid('lion mouth',x,hy-.17,hz+.2,.14,.06,.04,IRON))
    o.append(box('lion jaw',x,hy-.24,hz+.18,.34,.06,.12,LION))
    if sx<0:o.append(kit.ico('embroidered ball',x+.2,1.2,z+.45,.15,LION,1.0,2))
    else:o.append(ellipsoid('cub',x+.2,1.2,z+.42,.12,.14,.16,LION))

def dragon(o,x0,x1,y,z,m):
    """A jian nian dragon along the ridge: undulating body from tail (x0) to head (x1)."""
    pts=[];n=16
    for i in range(n):
        t=i/(n-1);pts.append((x0+(x1-x0)*t,y+.28*math.sin(t*math.pi*3.2)+.12*t,z+.12*math.sin(t*math.pi*2)))
    rad=[.05+.1*math.sin(min(1,i/(n-1)*1.4)*math.pi*.5) for i in range(n)]
    o.append(kit.tube('dragon body',pts,rad,m,6))
    hx,hy,hz=pts[-1];d=1 if x1>x0 else -1
    o.append(box('dragon head',hx+d*.12,hy+.08,hz,.34,.24,.24,m))
    o.append(box('dragon snout',hx+d*.34,hy+.02,hz,.2,.12,.18,m))
    for u in (-1,1):o.append(kit.strut('dragon horn',(hx,hy+.18,hz+u*.08),(hx-d*.3,hy+.45,hz+u*.14),.04,GOLD))
    for i in (4,9):
        px,py,pz=pts[i]
        for u in (-1,1):o.append(kit.strut('dragon leg',(px,py,pz),(px+d*.1,py-.25,pz+u*.14),.05,m))
    for i in range(1,n-2,2):
        px,py,pz=pts[i];o.append(cone('dragon fin',px,py+rad[i]+.06,pz,.06,0,.16,GOLD,4))

def phoenix(o,x,y,z,dx,dz):
    """Stylised phoenix riding a roof corner: body, crest and a fanned tail up and back."""
    o.append(ellipsoid('phoenix body',x,y+.2,z,.16,.14,.16,JIAN))
    o.append(kit.strut('phoenix neck',(x,y+.25,z),(x+dx*.22,y+.55,z+dz*.22),.07,JIAN))
    o.append(kit.ico('phoenix head',x+dx*.24,y+.6,z+dz*.24,.08,JIAN,1.0,1))
    for k in (-1,0,1):
        o.append(kit.strut('phoenix tail',(x,y+.2,z),(x-dx*.45+dz*k*.2,y+.75+(.1 if k==0 else 0),z-dz*.45-dx*k*.2),.05,JIAN))

def chinese():
    o=[box('plaza',0,.12,3,20,.24,28,PLAZA)]
    # platform and steps
    o.append(box('platform',0,.54,.2,14.8,.6,15.6,GRANITE,.03))
    o.append(box('platform kerb',0,.82,.2,15.0,.06,15.8,LION))
    for i,(z,d,top) in enumerate(((8.95,.8,.54),(8.5,.5,.84))):o.append(box('step',0,top-.15,z,5.0-i*.4,.3,d if i==0 else .6,GRANITE,.02))
    # hall walls: cream render over a granite dado on the sides and back, red lacquer front under the porch
    HX,HZ0,HZ1=6.2,-6.2,5.4
    for sx in (-1,1):
        F=facing(sx*HX,-.4,sx,0);n=(sx,0,0)
        o.append(wall('hall wall',F,-5.8,5.8,1.6,5.0,CREAM,n));o[-1]['ledges']=[5.0]
        o.append(box('dado',sx*(HX+.02),1.22,-.4,.08,.76,11.6,GRANITE))
        o.append(panel('side beam',[(-5.8,5.0),(5.8,5.0),(5.8,5.75),(-5.8,5.75)],F,.02,BEAM,n,lambda s,y:((s+5.8)/3.2,(y-5.0)/.8)))
        o.append(box('frieze board',sx*(HX+.01),6.55,-.4,.06,1.6,11.7,LACQUER))
        # a round lattice window in each side
        ring=[(math.cos(2*math.pi*k/20)*.95,3.25+math.sin(2*math.pi*k/20)*.95) for k in range(21)]
        o.append(panel('moon window',ring[:-1],F,.02,LATTICE,n,lambda s,y:(s/.6,y/.6)))
        o.append(frame('moon window ring',ring,.14,F,0,.1,GOLD))
    F=facing(0,HZ0,0,-1)
    o.append(wall('hall wall',F,-HX,HX,1.6,5.0,CREAM,(0,0,-1)));o[-1]['ledges']=[5.0]
    o.append(box('dado',0,1.22,HZ0-.02,12.4,.76,.08,GRANITE))
    o.append(panel('rear beam',[(-HX,5.0),(HX,5.0),(HX,5.75),(-HX,5.75)],F,.02,BEAM,(0,0,-1),lambda s,y:((s+HX)/3.2,(y-5.0)/.8)))
    o.append(box('frieze board',0,6.55,HZ0-.01,12.5,1.6,.06,LACQUER))
    for sx in (-1,1):
        for zz in (HZ0,HZ1):o.append(cyl('corner column',sx*HX,4.1,zz,.3,6.6,LACQUER,T,verts=12))
    # front facade: studded red door opening on the lit hall, lattice windows and transom, couplet boards
    fF=facing(0,HZ1,0,1)
    o.append(wall('facade',fF,-HX,HX,.84,7.5,LACQUER,(0,0,1)))
    door=[(-1.35,0),(1.35,0),(1.35,3.3),(-1.35,3.3)]
    o.append(panel('doorway',door,lambda s,y,d:fF(s,.84+y,d),.02,GLOW,(0,0,1),unit_uv(door)))
    for sx in (-1,1):o.append(box('door leaf folded back',sx*2.05,2.47,HZ1+.06,1.3,3.25,.08,RDOOR))
    o.append(frame('door frame',[(-1.35,0),(-1.35,3.3),(1.35,3.3),(1.35,0)],.18,lambda s,y,d:fF(s,.84+y,d),0,.16,GOLD))
    tr=[(-1.35,0),(1.35,0),(1.35,.85),(-1.35,.85)]
    o.append(panel('transom lattice',tr,lambda s,y,d:fF(s,4.4+y,d),.02,LATTICE,(0,0,1),lambda s,y:(s/.6,y/.6)))
    o.append(frame('transom frame',[(-1.35,0),(-1.35,.85),(1.35,.85),(1.35,0)],.1,lambda s,y,d:fF(s,4.4+y,d),0,.1,GOLD))
    for sx in (-1,1):
        win=[(-1.0,0),(1.0,0),(1.0,2.2),(-1.0,2.2)]
        o.append(panel('lattice window',win,lambda s,y,d,sx=sx:fF(sx*3.9+s,1.9+y,d),.02,LATTICE,(0,0,1),lambda s,y:(s/.6,y/.6)))
        o.append(frame('window frame',[(-1.0,0),(-1.0,2.2),(1.0,2.2),(1.0,0)],.14,lambda s,y,d,sx=sx:fF(sx*3.9+s,1.9+y,d),0,.12,GOLD))
        dado=[(-1.0,0),(1.0,0),(1.0,.8),(-1.0,.8)]
        o.append(panel('carved dado panel',dado,lambda s,y,d,sx=sx:fF(sx*3.9+s,.95+y,d),.03,BEAM,(0,0,1),lambda s,y:((s+1.0)/3.2,y/.8)))
    # porch: columns (the inner pair wound with gilt dragons), carved beam, bracket sets, ceiling
    PZ=7.35
    for x in (-6.6,-2.5,2.5,6.6):
        o.append(cyl('porch column',x,3.3,PZ,.28,4.9,LACQUER,T,verts=12))
        o.append(revolve('column base',[(.42,.84),(.45,1.0),(.36,1.2),(.3,1.3)],x,PZ,LION,12))
        o.append(cyl('column collar',x,5.62,PZ,.31,.14,GOLD,T,verts=12))
        if abs(x)<3:
            helix=[(x+.33*math.cos(t),1.4+t*.23,PZ+.33*math.sin(t)) for t in [k*.35 for k in range(40)]]
            o.append(kit.tube('column dragon',helix,[.06+.05*math.sin(min(1,k/39*1.5)*math.pi*.5) for k in range(40)],GOLD,6))
            hx,hy,hz=helix[-1];o.append(box('column dragon head',hx,hy+.06,hz+.1,.22,.18,.3,GOLD))
    for x in (-6.6,6.6):o.append(box('porch side beam',x,6.05,(HZ1+PZ)/2,.3,.6,2.3,LACQUER))
    bF=facing(0,PZ+.18,0,1);beam=[(-7.0,5.75),(7.0,5.75),(7.0,6.35),(-7.0,6.35)]
    o.append(box('porch beam',0,6.05,PZ,14.0,.6,.34,LACQUER))
    o.append(panel('porch beam paint',beam,bF,.002,BEAM,(0,0,1),lambda s,y:((s+7)/3.2,(y-5.75)/.6)))
    for k in range(18):
        x=-6.8+k*.8;o.append(box('bracket',x,6.49,PZ,.3,.24,.46,TEAL));o.append(box('bracket cap',x,6.64,PZ,.44,.06,.56,GOLD))
    o.append(box('porch ceiling',0,6.68,(HZ1+7.5)/2,14.0,.06,7.5-HZ1,SOFFIT))
    # gilt name board behind the canvas sign (0, 5.1, 8, 11 x .8), hung from the beam
    o.append(box('name board frame',0,5.1,7.9,11.6,1.2,.06,GOLD))
    o.append(box('name board',0,5.1,7.94,11.2,.95,.04,BOARD))
    for sx in (-1,1):o.append(kit.strut('board hanger',(sx*4.8,5.72,7.9),(sx*4.8,5.76,PZ+.18),.04,GOLD))
    # lower roof: four hipped planes round the clerestory, corners lifted
    CX,CZ0,CZ1,Y_TOP=5.0,-5.0,4.2,8.3
    EX,EZ0,EZ1,Y_EAVE,LIFT=7.9,-7.9,8.25,6.8,.55
    planes=(('front',(-CX,CZ1),(CX,CZ1),(-EX,EZ1),(EX,EZ1),(0,1)),('back',(CX,CZ0),(-CX,CZ0),(EX,EZ0),(-EX,EZ0),(0,-1)),
            ('east',(CX,CZ1),(CX,CZ0),(EX,EZ1),(EX,EZ0),(1,0)),('west',(-CX,CZ0),(-CX,CZ1),(-EX,EZ0),(-EX,EZ1),(-1,0)))
    for name,ta,tb,ea,eb,out in planes:
        eave=roof_plane(o,'lower roof',ta,tb,ea,eb,Y_TOP,Y_EAVE,LIFT,out)
        eave_strip(o,eave,out)
    for sx in (-1,1):
        for sz,(zt,ze) in ((1,(CZ1,EZ1)),(-1,(CZ0,EZ0))):
            hip=[(sx*(CX+(EX-CX)*t),Y_TOP-(Y_TOP-Y_EAVE)*concave(t)+LIFT*t*t+.1,zt+(ze-zt)*t) for t in [k/7 for k in range(8)]]
            hip.append((hip[-1][0]+sx*.35,hip[-1][1]+.45,hip[-1][2]+sz*.35))
            o.append(kit.tube('hip ridge',hip,.12,RIDGE,6))
            px,py,pz=hip[-3];phoenix(o,px,py,pz,sx*.7,sz*.7)
    # clerestory: red lacquer with a painted beam band under the upper eaves
    for sx in (-1,1):
        F=facing(sx*CX,(CZ0+CZ1)/2,sx,0)
        o.append(wall('clerestory',F,-(CZ1-CZ0)/2,(CZ1-CZ0)/2,7.3,9.0,LACQUER,(sx,0,0)))
        o.append(panel('clerestory beam',[(-4.6,8.3),(4.6,8.3),(4.6,8.9),(-4.6,8.9)],F,.02,BEAM,(sx,0,0),lambda s,y:((s+4.6)/3.2,(y-8.3)/.6)))
    for sz,zz in ((1,CZ1),(-1,CZ0)):
        F=facing(0,zz,0,sz)
        o.append(wall('clerestory',F,-CX,CX,7.4,8.85,LACQUER,(0,0,sz)))
        o.append(panel('clerestory beam',[(-CX,8.3),(CX,8.3),(CX,8.82),(-CX,8.82)],F,.02,BEAM,(0,0,sz),lambda s,y:((s+CX)/3.2,(y-8.3)/.6)))
    # upper gable roof with the swallowtail ridge
    RZ,RY,UY,UX,ULIFT=(CZ0+CZ1)/2,11.2,8.62,6.7,.5
    for sz,ze in ((1,RZ+6.0),(-1,RZ-6.0)):
        ta,tb=((-UX,RZ),(UX,RZ)) if sz>0 else ((UX,RZ),(-UX,RZ))
        ea,eb=((-UX,ze),(UX,ze)) if sz>0 else ((UX,ze),(-UX,ze))
        eave=roof_plane(o,'upper roof',ta,tb,ea,eb,RY,UY,ULIFT,(0,sz),nu=16,nv=8)
        eave_strip(o,eave,(0,sz))
    for sx in (-1,1):
        # gable end wall following the concave roof section, gilt disc emblem, barge ridges
        sect=[(RZ+sz*6.0*t,RY-(RY-UY)*concave(t)-.2) for sz in (1,) for t in [k/8 for k in range(9)]]
        back=[(RZ-6.0*t,RY-(RY-UY)*concave(t)-.2) for t in [k/8 for k in range(9)]]
        outline=[(z,y) for z,y in back[::-1] if y>9.0-1e-6]+[(z,y) for z,y in sect[1:] if y>9.0-1e-6]
        zs=[z for z,_ in outline];outline=[(min(zs),9.0)]+outline+[(max(zs),9.0)]
        F=facing(sx*CX,RZ,sx,0)
        o.append(panel('gable end',[(-(z-RZ) if sx>0 else (z-RZ),y) for z,y in outline],F,.0,CREAM,(sx,0,0)))
        o.append(cyl('gable emblem',sx*(CX+.06),10.35,RZ,.42,.08,GOLD,T,axis='x',verts=16))
        o.append(cyl('gable emblem boss',sx*(CX+.1),10.35,RZ,.2,.08,LACQUER,T,axis='x',verts=12))
        for sz in (1,-1):
            barge=[(sx*(UX+.02),RY-(RY-UY)*concave(t)+ULIFT*t*t+.12,RZ+sz*6.0*t) for t in [k/8 for k in range(9)]]
            barge.append((barge[-1][0],barge[-1][1]+.35,barge[-1][2]+sz*.3))
            o.append(kit.tube('barge ridge',barge,.12,RIDGE,6))
    ridge=[];n=17
    for i in range(n):
        x=-6.9+13.8*i/(n-1);ridge.append((x,RY+.3+max(0,abs(x)-5.2)**2*.3,RZ))
    o.append(kit.tube('main ridge',ridge,[.28]*n,RIDGE,6))
    o.append(box('ridge cap',0,RY+.62,RZ,10.2,.1,.5,RIDGE))
    for sx in (-1,1):
        tip=ridge[-1] if sx>0 else ridge[0]
        for u in (-1,1):o.append(kit.strut('swallowtail',tip,(tip[0]+sx*.7,tip[1]+.55,RZ+u*.3),.13,JIAN,.08))
        dragon(o,sx*4.6,sx*1.0,RY+.95,RZ,JIAN)
    o.append(box('pearl stand',0,RY+.85,RZ,.5,.4,.4,JIAN))
    o.append(kit.ico('flaming pearl',0,RY+1.35,RZ,.3,PEARL,1.0,2))
    for k in (-1,0,1):o.append(cone('pearl flame',k*.18,RY+1.72+(.1 if k==0 else 0),RZ,.09,0,.45,GOLD,5))
    # lanterns under the eaves and on a line over the court
    for sx in (-1,1):
        for z in (-5.6,-2.8,0,2.8,5.6):lantern(o,sx*7.25,5.6,z,.9,6.8)
    for x in (-3.6,-1.2,1.2,3.6):lantern(o,x,5.6,-7.3,.9,6.8)
    for sx in (-1,1):lantern(o,sx*7.2,5.4,PZ+.25,1.0,6.8)
    for sx in (-1,1):
        o.append(cyl('lantern pole',sx*8.6,2.35,14.6,.07,4.2,IRON,T,verts=8))
        o.append(box('pole foot',sx*8.6,.34,14.6,.4,.2,.4,GRANITE))
    line=catenary((-8.6,4.35,14.6),(8.6,4.35,14.6),.55,9)
    o.append(kit.tube('lantern line',line,.015,IRON,4))
    for p in line[1:-1]:lantern(o,p[0],p[1]-.62,p[2],.75)
    # incense burner (ding) and the guardian lions
    bz=11.6
    o.append(revolve('burner body',[(.0,.9),(.55,.92),(.78,1.1),(.85,1.35),(.8,1.55),(.95,1.62),(.98,1.7),(.82,1.72),(.0,1.6)],0,bz,BRONZE,18,closed=False))
    o.append(orient(revolve('burner ash',[(.84,1.64),(0,1.64)],0,bz,ASH,18),(0,1,0)))
    for k in range(3):
        t=2*math.pi*k/3+math.pi/2;o.append(kit.strut('burner leg',(.5*math.cos(t),.24,bz+.5*math.sin(t)),(.45*math.cos(t),1.0,bz+.45*math.sin(t)),.14,BRONZE))
    for sx in (-1,1):
        o.append(box('burner handle',sx*.9,1.95,bz,.08,.5,.12,BRONZE));o.append(box('burner handle top',sx*.9,2.18,bz,.08,.08,.5,BRONZE))
        for zz in (-.22,.22):o.append(box('burner handle post',sx*.9,1.95,bz+zz,.08,.5,.08,BRONZE))
    R_=random.Random(7)
    for k in range(18):
        a=R_.random()*6.28;r=R_.random()*.55;x=r*math.cos(a);z=bz+r*math.sin(a)
        o.append(kit.strut('joss stick',(x,1.62,z),(x+R_.uniform(-.06,.06),1.95+R_.random()*.2,z+R_.uniform(-.06,.06)),.014,STICK))
    smoke=bpy.data.objects.new('joss_smoke',None);bpy.context.scene.collection.objects.link(smoke);smoke.location=pt(0,2.4,bz);o.append(smoke)
    for sx in (-1,1):lion(o,sx*3.6,9.9,sx)
    # night uplight on the facade
    for sx in (-1,1):wash(o,fF,sx*3.9,.84,2.6,5.2,(0,0,1),d=.3)
    return o

SITES={'Church':church,'HinduTemple':hindu,'ChineseTemple':chinese}

# ------------------------------------------------------------------ grime, UVs, build, export
def uv_world(ob):
    """Real-world box UVs in world space, u along the wall, v up; floors take x/z."""
    me=ob.data;mw=ob.matrix_world;nm=mw.to_3x3().inverted_safe().transposed()
    uv=me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        mm=me.materials[f.material_index];tile=mm['tile'];n=(nm@f.normal).normalized()
        for li in f.loop_indices:
            c=mw@me.vertices[me.loops[li].vertex_index].co
            if abs(n.z)>=max(abs(n.x),abs(n.y)):u,v=c.x,c.y
            elif abs(n.x)>abs(n.y):u,v=(c.y if n.x>0 else -c.y),c.z
            else:u,v=(-c.x if n.y>0 else c.x),c.z
            uv.data[li].uv=(u/tile,v/tile)

def grime(ob):
    """Linear vertex colour: splash-back at the foot, streaks under ledges, broad unevenness (1 = clean)."""
    me=ob.data;mw=ob.matrix_world;ledges=list(ob.get('ledges',[]))
    attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT')
    for k,v in enumerate(me.vertices):
        c=mw@v.co;x,y,z=c.x,c.z,-c.y
        g=1-.2*max(0.0,1-(y-.8)/1.3)**2
        for top in ledges:
            d=top-y
            if 0<=d<3.6:
                s=noise.noise(Vector((x*.9+z*.9,top*3.1,.37)))+.35*noise.noise(Vector((x*3.1+z*3.1,top,1.7)))
                g*=1-.16*min(1.0,max(0.0,s+.15)*1.6)*(1-d/3.6)**1.5
        g*=1+.03*noise.noise(Vector((x*.23,y*.31,z*.23)))
        g=min(1.0,g);attr.data[k].color=(g,g*.99,g*.975,1)
    me.color_attributes.active_color=attr

GRIMED={'Render white','Cream render'}
def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    roots={}
    for name,fn in SITES.items():
        e=bpy.data.objects.new(name.lower(),None);s.collection.objects.link(e)
        items=[p for p in fn() if p]
        bpy.context.view_layer.update()
        for ob in items:
            ob.parent=e
            if ob.type!='MESH':continue
            mats=[m for m in ob.data.materials if m]
            if mats and all('tile' in m for m in mats):uv_world(ob)
            if mats and mats[0].name in GRIMED:grime(ob)
        roots[name]=e
    return roots

def export(roots):
    report={}
    for name,e in roots.items():
        batches={}
        for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            mats=[m for m in objs[0].data.materials if m]
            if any(o.data.color_attributes for o in objs):
                for ob in objs:
                    if not ob.data.color_attributes:
                        a=ob.data.color_attributes.new('Color','FLOAT_COLOR','POINT')
                        for d in a.data:d.color=(1,1,1,1)
                        ob.data.color_attributes.active_color=a
            j=join(objs,f'{name} | {" + ".join(key)}')
            if not any(('tile' in m) or m.get('keep_uv') for m in mats):
                for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
        bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
        for c in e.children:c.select_set(True)
        path=PUBLIC/f'LM_ENV_{name}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
            export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
            export_image_format='WEBP',export_image_quality=82,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
        meshes=[c for c in e.children if c.type=='MESH']
        tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in meshes)
        images=sorted({n.image.name for c in meshes for m in c.data.materials if m for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image})
        report[name]={'asset':f'LM_ENV_{name}','triangles':tris,'draws':len(meshes),'bytes':path.stat().st_size,
            'night_materials':sorted({m.name for c in meshes for m in c.data.materials if m and m.name.startswith('Night')}),'textures':images}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('WORSHIP WEB EXPORT',json.dumps({k:{kk:v[kk] for kk in ('triangles','draws','bytes')} for k,v in report.items()}),flush=True)

if __name__=='__main__':
    roots=build();export(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'worship.blend'))
