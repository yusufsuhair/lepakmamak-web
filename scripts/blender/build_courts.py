"""Basket Lepak and Pickleball Lepak, the two small sports venues behind Pantai Senja.

Basketball keeps the exact hoop geometry the server scores against: rim centre at
y=3.05 on z=+-hoopOffset (10.5), goose-neck post at z=+-12.2 where world.solids has
its collider. Everything else is new: a proper fan-shaped backboard with its painted
square, a rim bracket, a real knotted net, base padding and a ball-stop screen behind
each baseline. Pickleball gets a sagging net with tape and posts, full line markings,
courtside benches and one ball-stop screen behind the far baseline.

Both courts stay inside their existing aprons (16 x 26 and 12 x 20) and add nothing on
the sidelines, so no collider moves and the approach paths stay clear. The game keeps
drawing its own canvas wording on top.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_courts.py

Output: public/assets/models/environment/LM_ENV_{Basketball,Pickleball}.glb
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import vloft,sphere

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/courts'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []

def srgb(code):
    """glTF baseColorFactor is linear, so a hex the game uses has to be decoded, not pasted.
    Every colour below is the exact hex the procedural fallback paints, so the swap does not flash."""
    v=[int(code[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in v)

APRON=mat('Court apron green',srgb('#3f7765'),.92)
SURFACE=mat('Court terracotta',srgb('#ba7253'),.88)
KEY=mat('Court key teal',srgb('#356d78'),.85)
LINE=mat('Court line cream',srgb('#ffeed4'),.7)
BOARD=mat('Backboard white',srgb('#f1ead8'),.45)
TRIM=mat('Backboard trim',srgb('#cb6646'),.5)
RIM=mat('Rim orange',srgb('#eb7840'),.35)
NET=mat('Net cord cream',srgb('#fff5dd'),.75)
POST=mat('Hoop post slate',srgb('#344847'),.55)
PAD=mat('Post padding',srgb('#8f2f2a'),.75)
FENCE=mat('Fence galvanised',srgb('#9aa3a0'),.45)
MESH=mat('Fence mesh',srgb('#aeb6b2'),.5)

APRON2=mat('Pickle apron green',srgb('#477e6b'),.92)
BLUE=mat('Pickle blue',srgb('#3277a0'),.8)
ORANGE=mat('Pickle clay',srgb('#b7764c'),.8)
KITCHEN=mat('Pickle kitchen',srgb('#72a492'),.8)
WHITE=mat('Pickle line white',srgb('#fff2d3'),.65)
TAPE=mat('Net tape white',srgb('#fff5d7'),.6)
CORD=mat('Net cord dark',srgb('#253e39'),.8)
PPOST=mat('Net post cream',srgb('#e9e3ce'),.5)
BENCH=mat('Bench timber',srgb('#8a5a30'),.7)
BFRAME=mat('Bench frame',srgb('#4a5751'),.5)
SIGNPOST=mat('Sign post green',srgb('#344c41'),.7)

# ---------------------------------------------------------------- small helpers
def circle(cx,cz,r,n=32):
    return [(cx+r*math.cos(2*math.pi*i/n),cz+r*math.sin(2*math.pi*i/n)) for i in range(n)]

def arcpts(cx,cz,r,a0,a1,n=20):
    return [(cx+r*math.cos(a0+(a1-a0)*i/n),cz+r*math.sin(a0+(a1-a0)*i/n)) for i in range(n+1)]

def stripe(name,path,w,y,m,tag,closed=False):
    """Flat painted ribbon along a game-space (x,z) centre line. Two triangles a segment,
    upward facing, so court markings cost a fraction of what extruded boxes would."""
    pts=list(path)
    k=len(pts)
    if closed:pts=pts+[pts[0]]
    n=len(pts)
    left=[];right=[]
    for i,(x,z) in enumerate(pts):
        if closed:px,pz=pts[(i-1)%k];nx2,nz2=pts[(i+1)%k]
        elif i==0:px,pz=x,z;nx2,nz2=pts[1]
        elif i==n-1:px,pz=pts[-2];nx2,nz2=x,z
        else:px,pz=pts[i-1];nx2,nz2=pts[i+1]
        tx,tz=nx2-px,nz2-pz;L=math.hypot(tx,tz) or 1.0
        ox,oz=-tz/L*w/2,tx/L*w/2
        left.append((x+ox,z+oz));right.append((x-ox,z-oz))
    verts=[pt(px,y,pz) for px,pz in left]+[pt(px,y,pz) for px,pz in right]
    faces=[(i,i+1,n+i+1,n+i) for i in range(n-1)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(m);ob['asset']=tag
    return ob

def strut(name,p0,p1,w,m,tag,h=None):
    """Plain square member between two game-space points. No bevel: these repeat."""
    a=Vector(pt(*p0));b=Vector(pt(*p1));d=b-a;L=d.length
    if L<1e-5:return None
    bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2)
    o=bpy.context.object;o.scale=(w,h or w,L)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(o,name,m,tag)

def torus(name,x,y,z,major,minor,m,tag,mj=20,mn=6):
    bpy.ops.mesh.primitive_torus_add(location=pt(x,y,z),major_radius=major,minor_radius=minor,
        major_segments=mj,minor_segments=mn,rotation=(0,0,0))
    o=bpy.context.object;finish(o,name,m,tag)
    for f in o.data.polygons:f.use_smooth=True
    return o

def screen(o,tag,z,halfwidth,top,posts,verticals,rails,y0=.12):
    """Ball-stop screen: galvanised posts, rails and a wire grid. Plain members and flat
    caps only - a sphere cap costs more than the post it sits on, and these repeat."""
    for i in range(posts):
        x=-halfwidth+2*halfwidth*i/(posts-1)
        o.append(cyl('screen post',x,(y0+top)/2,z,.065,top-y0,FENCE,tag,verts=8))
        o.append(cyl('screen cap',x,top+.03,z,.08,.06,FENCE,tag,verts=8))
    for i in range(rails):
        y=y0+.35+(top-y0-.5)*i/(rails-1)
        o.append(box('screen rail',0,y,z,halfwidth*2,.055,.055,FENCE,tag,0))
    # the grid needs both directions or it reads as a railing, not a ball stop
    for i in range(verticals):
        x=-halfwidth+.4+(halfwidth*2-.8)*i/(verticals-1)
        o.append(box('screen wire',x,(y0+top-.06)/2,z,.022,top-.06-y0,.022,MESH,tag,0))
    rows=max(3,int((top-y0)/.45))
    for i in range(rows):
        y=y0+.2+(top-y0-.35)*i/(rows-1)
        o.append(box('screen wire',0,y,z,halfwidth*2-.8,.022,.022,MESH,tag,0))

# ---------------------------------------------------------------- basketball
HOOP=10.5      # shared/basketball.json hoopOffset: the server's shot target
BOARDZ=11.2    # backboard plane, as the procedural fallback has it
POSTZ=12.2     # world.solids collider for the goose-neck post: must not move
RIMY=3.05      # the server's scoring height

def hoop(o,tag,s):
    zp=s*POSTZ;zb=s*BOARDZ;zr=s*HOOP
    # footing, padded base and the vertical shaft
    o.append(box('post footing',0,.21,zp,1.5,.18,1.5,POST,tag,.03))
    o.append(box('base padding',0,1.1,zp,.66,1.6,.66,PAD,tag,.06))
    o.append(box('padding band',0,1.88,zp,.72,.1,.72,POST,tag,0))
    o.append(cyl('post shaft',0,1.78,zp,.115,3.26,POST,tag,verts=10))
    # goose-neck: a quarter turn forward from the top of the shaft, topping out BELOW the
    # board's top edge so it stays hidden behind the board instead of lumping over it
    curve=[(0,3.41+.54*math.sin(i/4*math.pi/2),zp-s*.80*(1-math.cos(i/4*math.pi/2))) for i in range(5)]
    for i in range(4):o.append(strut('goose neck',curve[i],curve[i+1],.16,POST,tag))
    neck=curve[-1]
    # a yoke onto the back of the board and a brace from under it back to the shaft
    for sx in (-1,1):
        o.append(strut('board arm',(sx*.08,neck[1]-.02,neck[2]),(sx*.60,3.82,zb+s*.055),.10,POST,tag))
    o.append(strut('board brace',(0,3.20,zb+s*.07),(0,2.70,zp-s*.06),.10,POST,tag))
    # backboard: white panel, orange perimeter frame, padded bottom edge
    o.append(box('backboard',0,3.60,zb,1.80,1.15,.08,BOARD,tag,0))
    for sx in (-1,1):o.append(box('board frame',sx*.885,3.60,zb,.09,1.19,.10,TRIM,tag,0))
    o.append(box('board frame',0,4.185,zb,1.86,.09,.10,TRIM,tag,0))
    o.append(box('board padding',0,3.055,zb,1.86,.10,.12,TRIM,tag,0))
    # the painted square: a hollow outline standing just off the court-facing face
    fz=zb-s*.055
    for sx in (-1,1):o.append(box('square side',sx*.295,3.30,fz,.045,.50,.012,TRIM,tag,0))
    for yy,hh in ((3.075,.045),(3.525,.045)):o.append(box('square rail',0,yy,fz,.635,hh,.012,TRIM,tag,0))
    # rim on its bracket, then the net
    # bracket bridges board face to the rim's near edge only, so nothing juts into the hoop
    o.append(box('rim bracket',0,RIMY,(zb+zr)/2+s*.1675,.26,.055,abs(zb-zr)-.415,RIM,tag,0))
    o.append(torus('rim',0,RIMY,zr,.375,.032,RIM,tag))
    # net: 12 cords tapering off the rim with three knot rings taken from the same
    # interpolation, so the rings actually sit on the cords instead of floating inside them
    N=12
    def cord(i,t):
        a=2*math.pi*i/N;r=.355+(.205-.355)*t
        return (r*math.cos(a),(RIMY-.02)+(2.50-(RIMY-.02))*t,zr+r*math.sin(a))
    for i in range(N):
        o.append(strut('net cord',cord(i,0),cord(i,1),.020,NET,tag))
        for t in (.30,.58,.85):o.append(strut('net knot',cord(i,t),cord(i+1,t),.014,NET,tag))

def basketball(tag='basketball'):
    o=[box('apron',0,.06,0,16,.12,26,APRON,tag,.04)]
    o.append(box('court surface',0,.15,0,14,.06,24,SURFACE,tag,.02))
    for s in (-1,1):o.append(box('key paint',0,.185,s*9.25,4.8,.01,5.3,KEY,tag,0))
    Y=.196
    o.append(stripe('boundary',[(6.9,-11.9),(6.9,11.9),(-6.9,11.9),(-6.9,-11.9)],.10,Y,LINE,tag,closed=True))
    o.append(stripe('centre line',[(-6.9,0),(6.9,0)],.10,Y,LINE,tag))
    o.append(stripe('centre circle',circle(0,0,1.8),.10,Y,LINE,tag,closed=True))
    for s in (-1,1):
        o.append(stripe('key outline',[(2.4,s*11.9),(2.4,s*6.6),(-2.4,s*6.6),(-2.4,s*11.9)],.10,Y,LINE,tag))
        o.append(stripe('free throw circle',circle(0,s*6.6,1.8),.10,Y,LINE,tag,closed=True))
        # three point line: 6.75 m about the rim, the server's own 3-point radius
        dz=math.sqrt(6.75**2-6.6**2);a=math.atan2(dz,6.6)
        if s<0:band=arcpts(0,-HOOP,6.75,a,math.pi-a,22)
        else:band=arcpts(0,HOOP,6.75,-a,-(math.pi-a),22)
        o.append(stripe('three point',[(6.6,s*11.9)]+band+[(-6.6,s*11.9)],.10,Y,LINE,tag))
        hoop(o,tag,s)
        screen(o,tag,s*12.85,7.8,3.55,5,15,3)
    return o

# ---------------------------------------------------------------- pickleball
def pnet(o,tag):
    def top(x):return 1.00+.075*(abs(x)/3.4)**2          # catenary-ish sag toward the centre
    xs=[-3.4+6.8*i/16 for i in range(17)]
    prof=[(x,top(x)) for x in xs]+[(x,top(x)-.065) for x in reversed(xs)]
    o.append(loft('net tape',[(-.022,prof),(.022,prof)],TAPE,tag))
    for x in [-3.30+6.60*i/22 for i in range(23)]:
        o.append(strut('net cord',(x,top(x)-.065,0),(x,.20,0),.016,CORD,tag))
    for y in (.32,.51,.70,.87):
        o.append(strut('net row',(-3.34,y,0),(3.34,y,0),.015,CORD,tag))
    for sx in (-1,1):
        o.append(box('post base',sx*3.4,.17,0,.34,.1,.34,PPOST,tag,0))
        o.append(cyl('net post',sx*3.4,.70,0,.058,1.12,PPOST,tag,verts=10))
        o.append(sphere('post cap',sx*3.4,1.26,0,.062,PPOST,tag))

def bench(o,tag,sx):
    x=sx*5.25
    o.append(box('bench seat',x,.47,0,.48,.07,1.9,BENCH,tag,0))
    o.append(box('bench back',x+sx*.20,.76,0,.07,.46,1.9,BENCH,tag,0))
    for sz in (-1,1):
        o.append(box('bench leg',x-sx*.16,.29,sz*.72,.06,.34,.06,BFRAME,tag,0))
        o.append(box('bench leg',x+sx*.16,.29,sz*.72,.06,.34,.06,BFRAME,tag,0))
        o.append(box('bench rail',x,.13,sz*.72,.46,.06,.06,BFRAME,tag,0))

def pickleball(tag='pickleball'):
    o=[box('apron',0,.06,0,12,.12,20,APRON2,tag,.04)]
    o.append(box('blue half',0,.15,-3.35,6.1,.06,6.7,BLUE,tag,.02))
    o.append(box('clay half',0,.15,3.35,6.1,.06,6.7,ORANGE,tag,.02))
    o.append(box('kitchen',0,.19,0,6.1,.02,4.26,KITCHEN,tag,0))
    Y=.208
    for sx in (-1,1):o.append(stripe('sideline',[(sx*3.05,-6.7),(sx*3.05,6.7)],.07,Y,WHITE,tag))
    for sz in (-1,1):
        o.append(stripe('baseline',[(-3.05,sz*6.7),(3.05,sz*6.7)],.07,Y,WHITE,tag))
        o.append(stripe('kitchen line',[(-3.05,sz*2.13),(3.05,sz*2.13)],.07,Y,WHITE,tag))
        o.append(stripe('centre service',[(0,sz*2.13),(0,sz*6.7)],.07,Y,WHITE,tag))
    pnet(o,tag)
    for sx in (-1,1):bench(o,tag,sx)
    screen(o,tag,9.5,5.7,2.35,4,12,2)
    # the game's canvas name sign is a MeshBasicMaterial and survives the swap, but its
    # posts do not: carry them here or the sign is left hanging in the air
    for sx in (-1,1):o.append(box('sign post',sx*3,1.5,-10.2,.1,3,.1,SIGNPOST,tag,0))
    return o

# ---------------------------------------------------------------- build / export
COURTS={'Basketball':basketball,'Pickleball':pickleball}

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    roots={}
    for name,fn in COURTS.items():
        e=bpy.data.objects.new(name.lower(),None);s.collection.objects.link(e)
        for ob in fn():ob.parent=e
        roots[name]=e
    return roots

def export(roots):
    report={}
    for name,e in roots.items():
        batches={}
        for ob in [c for c in e.children if c.type=='MESH']:
            batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            j=join(objs,f'{name} | {" + ".join(key)}')
            for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
        bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
        for c in e.children:c.select_set(True)
        path=PUBLIC/f'LM_ENV_{name}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
            export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
        tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
        report[name]={'asset':f'LM_ENV_{name}','triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print('COURTS WEB EXPORT',json.dumps(report),flush=True)

def render(roots):
    s=bpy.context.scene
    roots['Pickleball'].location=pt(34,0,0)
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1500;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun)
    sun.data.energy=4.5;sun.rotation_euler=(math.radians(50),math.radians(16),math.radians(-40))
    bpy.ops.mesh.primitive_plane_add(size=300,location=(0,0,-.02))
    bpy.context.object.data.materials.append(mat('Ground',(.33,.39,.30),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=34
    shots={'basketball':((-15,13,-26),(0,3,-6)),'hoop':((-4.5,4.2,-4.5),(0,3.2,-10.6)),
           'net':((1.6,3.3,-8.2),(0,3.0,-11.4)),'pickleball':((20,11,-20),(34,1,0)),
           'pickle-net':((27,2.2,-5.5),(34,.9,0)),'pair':((10,26,-38),(16,1,0)),
           'lines':((0,34,.01),(0,0,0)),'pickle-lines':((34,26,.01),(34,0,0))}
    for name,(eye,at) in shots.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    roots=build();export(roots)
    if '--no-render' not in ARGS:render(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'courts.blend'))
