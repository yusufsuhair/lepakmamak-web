"""Rapid KL style LRT for the Lepak loop: Kelana Jaya line Innovia-style train,
elevated side-platform station with the arched white roof, and the segmental box
girder viaduct on single piers. Game coordinates (metres, Y up) in, GLB (Y up) out.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_lrt.py -- --no-render

Outputs (public/assets/models/lrt):
  LM_LRT_Train.glb    nodes: cab (nose at +z), mid. Children roof, door_{P|N}_{1|2}_{a|b}
  LM_LRT_Station.glb  node: station. Track along z at x=0, platform on +x, ground at y=0
  LM_LRT_Viaduct.glb  nodes: girder (3 m along z, rail top at y=11), pier (ground to y=9.4)
"""
import bpy, math, json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/lrt'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/lrt'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
RAIL=11.0
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

WHITE=mat('Body white',(.90,.91,.92),.42);RED=mat('Rapid red',(.72,.04,.07),.45);NAVY=mat('Rapid navy',(.03,.09,.32),.5)
GLASS=mat('Tinted glass',(.05,.09,.13),.15,alpha=.86,two_sided=True);SKY_GLASS=mat('Windscreen glass',(.55,.72,.85),.12,alpha=.38,two_sided=True)
DARK=mat('Underframe',(.11,.12,.13),.8);STEEL=mat('Bogie steel',(.28,.29,.31),.7);WHEEL=mat('Wheel',(.18,.18,.19),.55)
FLOOR=mat('Coach floor',(.33,.36,.40),.85);SEAT=mat('Seat blue',(.09,.19,.48),.75);POLE=mat('Handrail yellow',(.93,.73,.10),.35)
LAMP=mat('Cabin light',(1,.97,.9),.4,emit=2.5);HEAD=mat('Headlight',(1,.98,.92),.2,emit=4);TAIL=mat('Tail light',(.9,.08,.08),.2,emit=3)
DISPLAY=mat('Destination display',(.05,.05,.06),.4);ORANGE=mat('LED amber',(1,.55,.1),.4,emit=3)
CONCRETE=mat('Platform concrete',(.66,.67,.65),.9);CONC2=mat('Viaduct concrete',(.60,.62,.60),.9);TACTILE=mat('Tactile yellow',(.95,.78,.15),.7)
ROOF=mat('Station roof',(.93,.93,.91),.55,two_sided=True);RIB=mat('Roof steel',(.36,.44,.52),.55);COLUMN=mat('Column steel',(.30,.37,.45),.6)
CLAD=mat('Station cladding',(.15,.25,.50),.6);TRIM=mat('Station trim',(.88,.90,.92),.5);BENCH=mat('Bench stainless',(.70,.72,.74),.35)
RAILM=mat('Rail steel',(.42,.43,.45),.5);PLATE=mat('LIM reaction plate',(.68,.70,.72),.5);THIRD=mat('Third rail',(.30,.30,.32),.6)

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

# ---------------------------------------------------------------- train
def body_profile(w=3.8,y0=.5,y1=3.95,rt=.78,rb=.16):
    return rounded([(-w/2,y0,rb),(w/2,y0,rb),(w/2,y1,rt),(-w/2,y1,rt)],5)

def split_profile(prof,y_split=3.15):
    """Closed body ring -> (walls: open profile down one side, under, up the other; roof: the arc over the top)."""
    n=len(prof)
    li=min((i for i in range(n) if prof[i][0]<0),key=lambda i:abs(prof[i][1]-y_split))
    ri=min((i for i in range(n) if prof[i][0]>0),key=lambda i:abs(prof[i][1]-y_split))
    a=[prof[(ri+k)%n] for k in range((li-ri)%n+1)];b=[prof[(li+k)%n] for k in range((ri-li)%n+1)]
    walls,roof=(a,b) if sum(p[1] for p in a)/len(a)<sum(p[1] for p in b)/len(b) else (b,a)
    return walls,roof

def coach(tag,cab):
    """One 11.5 m coach at the origin, +z forward. Floor at y=.85, roof top ~3.95, width 3.8."""
    L=5.75;objs=[];keep=[]
    full=body_profile();walls,roofp=split_profile(full)
    objs.append(loft('shell',[(-L,walls),(L,walls)],WHITE,tag,closed=False,smooth=True))
    roof=loft('roof shell',[(-L-.02,roofp),(L+.02,roofp)],WHITE,tag,closed=False,smooth=True)
    roof_parts=[roof]
    for z in (-2.6,2.6):roof_parts.append(box('aircon',0,4.1,z,2.4,.34,2.2,TRIM,tag,.06))
    roof_parts.append(box('roof gutter',0,3.98,0,3.0,.05,11.4,TRIM,tag,.01))
    for x in (-.55,.55):roof_parts.append(box('cabin light',x,3.05,0,.14,.03,10.6,LAMP,tag,0))
    keep.append(join(roof_parts,'roof',keep='roof'))
    # end walls, gangways, floor, underframe
    for z in (-L,L):objs.append(box('end wall',0,1.85,z*.995,3.5,2.6,.12,TRIM,tag,.02))
    objs.append(box('floor',0,.82,0,3.6,.06,11.4,FLOOR,tag,0))
    objs.append(box('underframe',0,.32,0,3.3,.36,11.2,DARK,tag,.04))
    objs.append(box('skirt L',-1.83,.42,0,.06,.28,11.0,WHITE,tag,.01));objs.append(box('skirt R',1.83,.42,0,.06,.28,11.0,WHITE,tag,.01))
    for z in (-4.1,4.1):
        objs.append(box('bogie frame',0,.28,z,2.9,.22,2.4,STEEL,tag,.03))
        for x in (-.95,.95):
            for dz in (-.85,.85):objs.append(cyl('wheel',x,.34,z+dz,.34,.12,WHEEL,tag,axis='x',verts=18))
            objs.append(box('axle box',x*1.25,.34,z,.25,.3,2.0,STEEL,tag,.03))
        objs.append(box('LIM motor',0,.22,z,1.0,.14,2.2,STEEL,tag,.02))
    objs.append(box('collector shoe',-1.5,.36,-3.2,.16,.08,.5,STEEL,tag,0))
    # livery: red band under the windows, navy pin stripe, both sides full length
    for s in (-1,1):
        objs.append(box('red band',s*1.905,1.55,0,.02,.36,11.5,RED,tag,0))
        objs.append(box('navy stripe',s*1.905,1.30,0,.02,.07,11.5,NAVY,tag,0))
        for z in (-4.75,-1.5,1.5,4.75):
            w=1.7 if abs(z)>3 else 1.9
            objs.append(box('window frame',s*1.9,2.58,z,.06,1.52,w+.08,DARK,tag,0))
            objs.append(box('window',s*1.915,2.58,z,.02,1.42,w,GLASS,tag,0))
        # doors: 2 double leaves per side at z=+-3, platform side is P (+x)
        for i,z in enumerate((-3,3)):
            for part,letter in ((-1,'a'),(1,'b')):
                leaf=box('leaf',s*1.9,2.25,z+part*.42,.11,2.55,.8,WHITE,tag,.01)
                glass=box('leaf glass',s*1.96,2.6,z+part*.42,.02,1.05,.5,GLASS,tag,0)
                red=box('leaf red',s*1.96,1.55,z+part*.42,.02,.36,.8,RED,tag,0)
                navy=box('leaf navy',s*1.96,1.30,z+part*.42,.02,.07,.8,NAVY,tag,0)
                door=join([leaf,glass,red,navy],f"door_{'P' if s>0 else 'N'}_{i+1}_{letter}",keep='door')
                keep.append(door)
            objs.append(box('door head',s*1.905,3.58,z,.02,.16,1.8,DARK,tag,0))
    # interior: longitudinal seats, stanchions, grab rails
    for s in (-1,1):
        for z0,z1 in ((-5.45,-4.05),(-1.95,1.95),(4.05,5.45)):
            zc,zl=(z0+z1)/2,z1-z0
            objs.append(box('seat',s*1.45,1.2,zc,.6,.14,zl,SEAT,tag,.03))
            objs.append(box('seat back',s*1.72,1.55,zc,.12,.6,zl,SEAT,tag,.03))
            objs.append(box('seat plinth',s*1.45,1.0,zc,.5,.3,zl-.1,DARK,tag,.02))
        objs.append(cyl('grab rail',s*1.1,2.95,0,.025,10.8,POLE,tag,axis='z',verts=8))
    for z in (-4.1,-1.0,1.0,4.1):objs.append(cyl('stanchion',0,2.0,z,.03,2.3,POLE,tag,verts=8))
    for z in (-3,3):
        for s in (-1,1):objs.append(cyl('door post',s*.75,2.0,z,.025,2.3,POLE,tag,verts=8))
    if not cab:
        objs.append(box('gangway',0,1.85,L+.4,1.7,2.3,.75,DARK,tag,.03))
        objs.append(box('gangway',0,1.85,-L-.4,1.7,2.3,.75,DARK,tag,.03))
    else:
        # Innovia-style nose: body ring tapering to a rounded cap, big raked windscreen, red mask
        nose=[(L,full),(L+.42,body_profile(3.62,.55,3.8,.72,.16)),(L+.78,body_profile(3.05,.62,3.3,.6,.18)),(L+.95,body_profile(2.3,.75,2.55,.5,.2))]
        objs.append(loft('nose',nose,WHITE,tag,closed=True,caps=(False,True),smooth=True))
        objs.append(box('windscreen',0,2.72,L+.74,2.35,1.15,.06,GLASS,tag,0,rx=.34))
        objs.append(box('red mask',0,1.85,L+.9,2.3,.42,.08,RED,tag,.02))
        objs.append(box('destination display',0,3.45,L+.56,1.6,.28,.08,DISPLAY,tag,0))
        for s in (-1,1):
            objs.append(box('headlight',s*.85,1.4,L+.9,.34,.16,.06,HEAD,tag,0))
            objs.append(box('tail light',s*1.0,1.1,L+.88,.2,.1,.06,TAIL,tag,0))
        objs.append(box('coupler',0,.55,L+.95,.4,.2,.5,DARK,tag,.02))
        objs.append(box('gangway',0,1.85,-L-.4,1.7,2.3,.75,DARK,tag,.03))
        objs.append(box('cab wall',0,1.85,L-1.1,3.5,2.6,.08,TRIM,tag,.02))
    return objs+keep

# ---------------------------------------------------------------- station
def station():
    tag='station';o=[]
    T=RAIL+.8  # platform top level = coach floor
    o.append(box('platform slab',4.9,T-.45,0,5.5,.9,59,CONCRETE,tag,.04))
    o.append(box('platform coping',2.3,T-.02,0,.4,.06,59,TRIM,tag,.01))
    o.append(box('tactile strip',2.85,T+.015,0,.5,.03,58,TACTILE,tag,0))
    o.append(box('edge line',3.2,T+.012,0,.1,.02,58,TRIM,tag,0))
    o.append(box('platform fascia',2.16,T-.55,0,.06,.7,59,CLAD,tag,0))
    o.append(box('slab beam',4.9,T-1.2,0,2.6,.6,59,CONC2,tag,.04))
    for z in (-18,18):o.append(box('platform column',4.9,(T-1.5)/2,z,1.4,T-1.5,1.4,CONC2,tag,.05))
    # arched roof over the platform, ribs and steel columns; spring line 3.2 m above the platform
    cx,cy,rx,ry=4.9,T+3.2,3.6,2.1
    def arc(rx,ry,n=18):return [(cx+rx*math.cos(math.pi*i/n),cy+ry*math.sin(math.pi*i/n)) for i in range(n+1)]
    outer=arc(rx,ry);inner=arc(rx-.12,ry-.12)
    o.append(loft('roof shell',[(-30.5,outer+inner[::-1]),(30.5,outer+inner[::-1])],ROOF,tag,closed=True,smooth=True))
    o.append(box('roof skylight',cx,cy+ry+.02,0,1.4,.04,60,SKY_GLASS,tag,0))
    for z in range(-30,31,6):
        ro=arc(rx-.13,ry-.13,14);ri=arc(rx-.33,ry-.33,14)
        o.append(sweep('roof rib',ro+ri[::-1],z-.09,z+.09,RIB,tag))
    o.append(box('roof purlin',cx,cy+ry-.3,0,.12,.12,61,RIB,tag,0))
    for z in (-27,-15,0,15,27):
        for x in (cx+rx-.25,cx-rx+.25):
            o.append(cyl('column',x,(T+cy)/2,z,.17,cy-T,COLUMN,tag,verts=14))
            o.append(box('column base',x,T+.08,z,.5,.16,.5,COLUMN,tag,.02))
    for x in (cx+rx-.25,cx-rx+.25):o.append(cyl('eave beam',x,cy-.05,0,.14,60,COLUMN,tag,axis='z',verts=10))
    # outer windscreen glazing between the columns
    for z0,z1 in ((-27,-15),(-15,0),(0,15),(15,27)):
        zc=(z0+z1)/2;zl=z1-z0-.5
        fx=cx+rx-.25
        o.append(box('windscreen glass',fx,T+1.3,zc,.03,2.3,zl-.2,SKY_GLASS,tag,0))
        for y in (T+.1,T+2.5):o.append(box('windscreen rail',fx,y,zc,.08,.1,zl,NAVY,tag,0))
        for dz in (-zl/2,zl/2):o.append(box('windscreen mullion',fx,T+1.3,zc+dz,.08,2.5,.1,NAVY,tag,0))
    # furniture: benches, bins, hanging LED boards, station name sign frame at (4.9, RAIL+3.1)
    for z in (-21,-9,9,21):
        o.append(box('bench',6.6,T+.45,z,.45,.06,1.8,BENCH,tag,.01))
        o.append(box('bench back',6.8,T+.7,z,.05,.45,1.8,BENCH,tag,.01))
        for dz in (-.8,.8):o.append(box('bench leg',6.6,T+.2,z+dz,.4,.4,.06,BENCH,tag,0))
        o.append(cyl('bin',7.3,T+.4,z+1.6,.2,.8,COLUMN,tag,verts=10))
    for z in (-12,12):
        o.append(box('LED board',4.9,T+2.6,z,.16,.4,2.2,DISPLAY,tag,.01))
        for s in (-1,1):o.append(box('LED text',4.9+s*.085,T+2.6,z,.01,.14,2.0,ORANGE,tag,0))
        for dz in (-.9,.9):o.append(cyl('LED rod',4.9,T+3.0,z+dz,.02,.5,COLUMN,tag,verts=6))
    sy=RAIL+3.1
    o.append(box('sign bar',4.9,sy+.5,0,.08,.06,5.7,TRIM,tag,0));o.append(box('sign bar',4.9,sy-.5,0,.08,.06,5.7,TRIM,tag,0))
    for dz in (-2.82,2.82):o.append(box('sign bar',4.9,sy,dz,.08,1.06,.06,TRIM,tag,0));o.append(cyl('sign rod',4.9,sy+.85,dz,.02,.7,COLUMN,tag,verts=6))
    # link bridge to the stair tower and the tower itself (collision box lives in lrt.ts)
    o.append(box('bridge deck',9.15,T-.1,0,3.1,.2,3.0,CONCRETE,tag,.02))
    for z in (-1.45,1.45):o.append(box('bridge rail',9.15,T+.55,z,3.0,1.1,.06,NAVY,tag,0))
    o.append(box('bridge roof',9.15,T+2.5,0,3.4,.12,3.6,ROOF,tag,.02))
    for x in (7.9,10.5):
        for z in (-1.6,1.6):o.append(cyl('bridge post',x,T+1.25,z,.06,2.5,COLUMN,tag,verts=8))
    o.append(box('stair tower',11.8,(RAIL+.8)/2,0,2.3,RAIL+.8,3.5,CLAD,tag,.04))
    o.append(box('tower band',11.8,4.0,0,2.36,.3,3.56,TRIM,tag,0));o.append(box('tower band',11.8,8.0,0,2.36,.3,3.56,TRIM,tag,0))
    o.append(box('tower roof',11.8,RAIL+.95,0,2.9,.25,4.1,ROOF,tag,.03))
    o.append(box('tower glass',10.62,1.25,0,.05,2.4,1.8,SKY_GLASS,tag,0))
    o.append(box('tower glass strip',10.62,7.0,0,.05,8.0,.8,SKY_GLASS,tag,0))
    o.append(box('entrance canopy',10.2,3.4,0,1.0,.1,3.0,TRIM,tag,.01))
    # ground totem behind the ground-level sign the game draws at (9, 3.8)
    for dz in (-3.3,3.3):o.append(box('totem post',9,1.6,dz,.24,3.2,.24,NAVY,tag,.02))
    o.append(box('totem board',9,3.8,0,.16,1.4,7.4,NAVY,tag,.02))
    o.append(box('totem cap',9,4.55,0,.2,.1,7.5,RED,tag,0))
    return o

# ---------------------------------------------------------------- viaduct
def girder():
    tag='girder';o=[];top=RAIL-.1
    prof=[(-2.3,top),(2.3,top),(1.3,top-1.5),(-1.3,top-1.5)]
    o.append(sweep('box girder',prof,-1.5,1.5,CONC2,tag))
    for s in (-1,1):o.append(box('parapet',s*2.15,top+.25,0,.3,.5,3.0,CONC2,tag,.02))
    o.append(box('deck cable trough',-1.85,top+.06,0,.3,.12,3.0,STEEL,tag,0))
    for s in (-1,1):
        o.append(box('rail plinth',s*.95,top+.04,0,.5,.08,3.0,CONC2,tag,0))
        o.append(box('rail foot',s*.95,top+.1,0,.15,.04,3.0,RAILM,tag,0))
        o.append(box('rail head',s*.95,top+.16,0,.07,.1,3.0,RAILM,tag,0))
    o.append(box('LIM reaction plate',0,top+.11,0,1.0,.05,3.0,PLATE,tag,0))
    o.append(box('third rail',-1.45,top+.19,0,.1,.1,3.0,THIRD,tag,0))
    o.append(box('third rail insulator',-1.45,top+.1,0,.12,.1,.2,DARK,tag,0))
    return o

def pier():
    tag='pier';o=[]
    o.append(box('footing',0,.15,0,2.4,.3,2.0,CONC2,tag,.03))
    o.append(loft('column',[(-.6,[(-.8,.3),(.8,.3),(.8,8.6),(-.8,8.6)]),(.6,[(-.8,.3),(.8,.3),(.8,8.6),(-.8,8.6)])],CONC2,tag))
    cap=[(-1.7,9.4),(1.7,9.4),(1.2,8.6),(-1.2,8.6)]
    o.append(sweep('pier head',cap,-.65,.65,CONC2,tag))
    for s in (-1,1):o.append(box('bearing',s*1.1,9.42,0,.5,.06,.6,STEEL,tag,0))
    return o

# ---------------------------------------------------------------- build / export
def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    parts={'cab':coach('cab',True),'mid':coach('mid',False),'station':station(),'girder':girder(),'pier':pier()}
    empties={}
    for tag,objs in parts.items():
        e=bpy.data.objects.new(tag,None);s.collection.objects.link(e);empties[tag]=e
        for ob in objs:ob.parent=e
    return empties

def export(empties):
    files={'LM_LRT_Train.glb':['cab','mid'],'LM_LRT_Station.glb':['station'],'LM_LRT_Viaduct.glb':['girder','pier']}
    report={}
    for tag,e in empties.items():
        e.location=(0,0,0)
        batches={}
        for ob in [c for c in e.children if c.type=='MESH' and not c.get('keep')]:
            batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            join(objs,f'{tag} | {" + ".join(key)}')
        for ob in e.children:
            if ob.type=='MESH':
                for uv in list(ob.data.uv_layers):ob.data.uv_layers.remove(uv)
    for name,tags in files.items():
        bpy.ops.object.select_all(action='DESELECT')
        for tag in tags:
            empties[tag].select_set(True)
            for c in empties[tag].children:c.select_set(True)
        path=PUBLIC/name
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
        tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for tag in tags for c in empties[tag].children if c.type=='MESH')
        report[name]={'nodes':tags,'triangles':tris,'bytes':path.stat().st_size,'draws':sum(len(empties[t].children) for t in tags)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print('LRT WEB EXPORT',json.dumps(report),flush=True)

def render(empties):
    """Preview: a station with a 4-coach train alongside, on the viaduct."""
    s=bpy.context.scene
    def place(tag,x,y,z,yaw=0):
        e=empties[tag];bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
        for c in e.children:c.select_set(True)
        bpy.ops.object.duplicate();n=[o for o in bpy.context.selected_objects if o.type=='EMPTY'][0]
        n.location=pt(x,y,z);n.rotation_euler.z=yaw;return n
    for i in range(4):place('cab' if i in(0,3) else 'mid',0,RAIL,18-i*12,math.pi if i==3 else 0)
    for z in range(-60,63,3):place('girder',0,0,z)
    for z in (-48,-24,0,24,48):place('pier',0,0,z)
    place('station',0,0,0)
    for e in empties.values():e.location=(0,0,-900)  # move the masters out of shot
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next((e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines))
    s.render.resolution_x=1600;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1);w.node_tree.nodes['Background'].inputs[1].default_value=1.0
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=400,location=(0,0,0));ground=bpy.context.object;ground.data.materials.append(mat('Ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=32
    views={'platform':((30,22,-42),(4,12,0)),'nose':((-14,14,34),(0,11,10)),'aerial':((-40,45,-70),(0,8,0)),'ground':((26,4,-30),(6,6,0))}
    from mathutils import Vector
    for name,(eye,at) in views.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    empties=build();export(empties)
    if '--no-render' not in ARGS:render(empties)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'lrt.blend'))
