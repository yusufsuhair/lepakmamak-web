"""Pantai Senja beach props: the kelapa segar stall, two slung rope hammocks between
sturdy coconut posts, the promenade sign frame and lamp posts, the four beach tables with
their chairs and parasols, the three sun loungers and the fire ring.

Skin only. The sea, its travelling waves and the breaking crests stay procedural in
src/beach.ts, and every gameplay number here is read from the game rather than retyped:
chair and table positions come from shared/chairs.json and shared/tables.json, the hammock
and sunbed anchors from BEACH_REST_SPOTS (mirrored in REST below, rest heights 1.1 and .62),
and the stall/table/fire colliders in beach.ts are untouched.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_beach.py

Output: public/assets/models/environment/LM_ENV_Beach.glb, node 'beach' in world coordinates.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import vloft,sphere

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/beach'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='beach'

TABLES=json.loads((ROOT/'shared/tables.json').read_text())
CHAIRS=json.loads((ROOT/'shared/chairs.json').read_text())
PANTAI=[t for t in TABLES if t['id'].startswith('pantai-')]
# --- mirrors src/beach.ts: hammock cloth centre must stay at the rest height (1.1) and the
# lounger deck under the .62 sunbed pose must stay where the procedural boxes had it.
HAMMOCKS=[(101,148),(148,147)]
SUNBEDS=[119,130,142];SUNBED_Z=148
STALL=(98,137)                     # collider x 96..100, z 136.15..137.85
SIGN=(98,132);SIGN_POSTS=[94,102]  # the game draws PANTAI SENJA across x 93.5..102.5
FIRE=(125,148);LAMPS=[104,146];LAMP_Z=144

def srgb(h):
    """Game hex -> linear base colour, so the GLB matches the procedural fallback."""
    h=h.lstrip('#');c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
def hmat(name,hexcolor,rough=.6,**kw):return mat(name,srgb(hexcolor),rough,**kw)

POST=hmat('Coconut post','#7b5c3c',.72);POST_D=hmat('Post lashing','#5b4028',.78)
TIMBER=hmat('Beach timber','#8a6c48',.8);FRAMEBOARD=hmat('Sign frame','#245e58',.6)
TOP=hmat('Table top','#d6ab75',.62);GROOVE=hmat('Table plank groove','#a87c4d',.75)
LEG=hmat('Table leg','#765839',.7);CHAIR=hmat('Chair teal','#387f82',.55)
STALL_G=hmat('Stall green','#648a47',.62);COUNTER=hmat('Counter timber','#c99c64',.6)
STALLP=hmat('Stall post','#987049',.7)
THATCH=hmat('Attap thatch','#b39b62',.85);THATCH2=hmat('Attap shade','#8f7748',.88)
NUT=hmat('Green coconut','#97ac49',.5);FLESH=hmat('Coconut flesh','#f4ecd8',.55)
STRAW=hmat('Drinking straw','#e0574f',.4)
CLOTH=hmat('Hammock cloth','#d77991',.78,two_sided=True)
CLOTH2=hmat('Hammock stripe','#f6e6d2',.78,two_sided=True)
ROPE=hmat('Hammock rope','#d5bd8e',.85)
CUSHION=hmat('Lounger cushion','#e9ddc0',.7);LOUNGER=hmat('Lounger frame','#c7aa7a',.65)
TOWEL=hmat('Beach towel','#4f9ec4',.75)
PARASOL=hmat('Parasol canvas','#f1b663',.7,two_sided=True)
PARASOL2=hmat('Parasol band','#f3ece0',.7,two_sided=True)
STONE=hmat('Fire ring stone','#8a7f6c',.92);ASH=hmat('Fire pit ash','#6f6455',.95)
CHARRED=hmat('Charred log','#4a3a2d',.85);EMBER=mat('Ember',srgb('#ff7a2f'),.5,emit=2.4)
GLOBE=mat('Lantern globe',srgb('#ffdf99'),.35,emit=2.6);METAL=hmat('Lamp metal','#5c5346',.5)
COOLER=hmat('Cooler box','#d9dfe2',.5)

def strut(name,p0,p1,w,m,h=None):
    """Square member between two game-space points (rope, brace, log)."""
    a=Vector(pt(*p0));b=Vector(pt(*p1));d=b-a;L=d.length
    if L<1e-5:return None
    bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2)
    o=bpy.context.object;o.scale=(w,h or w,L)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(o,name,m,T)

def ico(name,x,y,z,r,m,squash=1.0,sub=2):
    """Cheap round prop: 80 tris, never bevelled. Coconuts and stones are the repeat case."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=r,location=pt(x,y,z))
    o=bpy.context.object;o.scale=(1,1,squash)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=True
    return o

def yaw_box(name,cx,cz,yaw,dx,y,dz,w,h,d,m):
    """Box placed in a furniture-local frame turned by the game yaw (chairs come from JSON)."""
    c,s=math.cos(yaw),math.sin(yaw)
    o=box(name,cx+dx*c+dz*s,y,cz-dx*s+dz*c,w,h,d,m,T,0)
    o.rotation_euler.z=yaw;return o

def canopy(name,x,z,r,apex,rim,mats,n=24,gores=8,sag=.17,scallop=.05):
    """Gored parasol canopy: the fabric sags and scallops between the ribs, and alternate
    gores take the second material. vloft cannot do this — its heights are per ring."""
    ts=[.06,.22,.45,.70,.88,1.0];verts=[]
    for t in ts:
        for i in range(n):
            a=2*math.pi*i/n;s=math.sin(math.pi*((i*gores/n)%1.0))
            rad=r*t*(1-scallop*s);y=apex-(apex-rim)*t**1.7-sag*t*t*s
            verts.append(pt(x+rad*math.cos(a),y,z+rad*math.sin(a)))
    faces=[];index=[]
    for sec in range(len(ts)-1):
        for i in range(n):
            a=sec*n+i;b=sec*n+(i+1)%n;faces.append((a,b,b+n,a+n));index.append(int(i*gores/n)%2)
    faces.append(tuple(range(n)));index.append(0)
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob)
    for m in mats:ob.data.materials.append(m)
    for f,mi in zip(mesh.polygons,index):f.material_index=mi;f.use_smooth=True
    ob['asset']=T;return ob

# ---------------------------------------------------------------- promenade sign + lamps
def promenade():
    """Frame around the game's PANTAI SENJA canvas sign: the plane stays clear at z=132."""
    o=[];x0,z=SIGN[0],SIGN[1];zb=z-.2   # frame sits behind the double-sided sign plane
    for x in SIGN_POSTS:
        o.append(box('sign post',x,2.45,zb,.24,4.9,.22,POST,T,.02))
        o.append(box('post cap',x,4.95,zb,.34,.1,.32,POST_D,T,.02))
        for y in (1.5,3.0):o.append(box('post lashing',x,y,zb,.27,.09,.25,POST_D,T,0))
    for y,h in ((4.64,.26),(2.5,.2)):o.append(box('sign rail',x0,y,zb,9.6,h,.16,FRAMEBOARD,T,.02))
    for x in (93.6,102.4):o.append(box('sign stile',x,3.58,zb,.18,2.0,.14,FRAMEBOARD,T,.02))
    o.append(box('sign cap board',x0,5.06,zb+.1,9.9,.09,1.05,THATCH,T,0))
    o.append(box('sign cap drip',x0,4.99,zb+.6,9.9,.14,.1,THATCH2,T,0))
    for x in SIGN_POSTS:
        o.append(strut('sign brace',(x+(1.4 if x<x0 else -1.4),3.0,zb),(x,4.4,zb),.1,POST))
    return o

def lamp(x):
    z=LAMP_Z;o=[]
    o.append(cyl('lamp post',x,1.7,z,.08,3.4,POST,T,verts=10))
    o.append(box('lamp post foot',x,.09,z,.4,.18,.4,POST_D,T,.03))
    o.append(cyl('lamp collar',x,3.42,z,.11,.12,METAL,T,verts=10))
    o.append(sphere('lantern globe',x,3.6,z,.23,GLOBE,T))
    o.append(cyl('lantern cap',x,3.84,z,.2,.08,METAL,T,verts=12))
    o.append(cyl('lantern finial',x,3.93,z,.04,.14,METAL,T,verts=6))
    return o

# ---------------------------------------------------------------- kelapa segar stall
def stall():
    """Lean-to attap roof, plank counter, coconuts. The KELAPA SEGAR · RM5 canvas sign
    hangs at y2.45/z137.75 (top ~2.89), so the front eave stays above it."""
    x0,z0=STALL;o=[]
    front,back=z0+.92,z0-.6          # front posts stand clear of the counter top (ends z+.85)
    for x in (x0-1.7,x0+1.7):
        o.append(box('stall post',x,1.75,back,.16,3.5,.16,STALLP,T,.02))
        o.append(box('stall post',x,1.56,front,.16,3.12,.16,STALLP,T,.02))
        o.append(strut('stall knee brace',(x,2.7,front),(x,2.95,front-.6),.09,STALLP))
    # counter: painted green carcass, timber battens, kick rail and a served top with a lip
    o.append(box('counter carcass',x0,.52,z0,3.66,1.02,1.22,STALL_G,T,.02))
    for x in [x0-1.74+i*.7 for i in range(6)]:o.append(box('counter batten',x,.56,z0+.63,.12,.94,.06,COUNTER,T,0))
    o.append(box('counter kick rail',x0,.1,z0+.63,3.7,.18,.08,COUNTER,T,0))
    o.append(box('counter top rail',x0,1.04,z0+.63,3.7,.1,.08,COUNTER,T,0))
    o.append(box('counter top',x0,1.14,z0,4.0,.12,1.7,COUNTER,T,.02))
    o.append(box('counter lip',x0,1.05,z0+.84,4.0,.1,.07,COUNTER,T,0))
    o.append(box('counter shelf',x0,.62,z0-.2,3.4,.06,.8,COUNTER,T,0))
    # lean-to attap roof, laid in overlapping courses from the high back to the low front
    def course(z1,z2,y1,y2,thick,m,name):
        prof=lambda y:[(x0-2.3,y),(x0+2.3,y),(x0+2.3,y-thick),(x0-2.3,y-thick)]
        return loft(name,[(z1,prof(y1)),(z2,prof(y2))],m,T)
    slope=lambda z:3.6-.235*(z-(z0-1.1))
    o.append(course(z0-1.2,z0+1.25,slope(z0-1.2),slope(z0+1.25),.1,THATCH,'attap deck'))
    for i in range(6):
        z1=z0-1.25+i*.42;z2=z1+.54     # overlapping attap courses, each one lipped over the last
        o.append(course(z1,z2,slope(z1)+.19,slope(z2)+.11,.09,THATCH if i%2 else THATCH2,'attap course'))
    o.append(box('eave fascia',x0,slope(z0+1.25)+.02,z0+1.29,4.7,.16,.1,THATCH2,T,0))
    o.append(box('ridge cap',x0,slope(z0-1.2)+.13,z0-1.2,4.7,.13,.22,THATCH2,T,0))
    for x in (x0-2.5,x0+2.5):
        o.append(strut('roof purlin',(x,slope(z0-1.15),z0-1.15),(x,slope(z0+1.2),z0+1.2),.08,STALLP))
    # back of house: coconut shelf, cooler and a bulb hanging where players can see it
    o.append(box('nut shelf',x0,2.3,back+.18,3.3,.07,.44,STALLP,T,0))
    for x in (x0-1.62,x0+1.62):o.append(strut('shelf bracket',(x,2.26,back+.36),(x,2.6,back+.02),.07,STALLP))
    for i in range(5):o.append(ico('shelf coconut',x0-1.2+i*.6,2.54,back+.18,.21,NUT,.92))
    o.append(box('cooler box',x0+1.1,.28,back+.35,.62,.56,.44,COOLER,T,.04))
    o.append(box('cooler lid',x0+1.1,.59,back+.35,.66,.07,.48,STALL_G,T,.02))
    # the six coconuts the game had on the counter, plus two opened with straws
    for i in range(6):o.append(ico('counter coconut',x0-1.3+i*.5,1.42,z0-.1,.25,NUT,.9))
    for s in (-1,1):
        cx=x0+s*1.35
        o.append(ico('opened coconut',cx,1.42,z0+.42,.25,NUT,.88))
        o.append(cyl('coconut cut',cx,1.63,z0+.42,.13,.03,FLESH,T,verts=10))
        o.append(strut('straw',(cx,1.6,z0+.42),(cx+s*.14,2.06,z0+.5),.022,STRAW))
    return o

# ---------------------------------------------------------------- rope hammocks
def hammock(x,z):
    """Cloth ends are lifted by clew fans, so the sag is real: top surface 1.06 at the
    centre, right under the 1.1 hammock rest pose."""
    o=[];left,right=x-3.2,x+3.2
    for px in (left,right):
        o.append(cyl('hammock post',px,1.62,z,.15,3.24,POST,T,verts=12))
        o.append(cyl('post cap',px,3.28,z,.19,.12,POST_D,T,verts=12))
        o.append(box('post footing',px,.1,z,.5,.2,.5,POST_D,T,.03))
        for y in (1.05,2.28):o.append(cyl('post lashing',px,y,z,.17,.1,ROPE,T,verts=12))
        o.append(strut('post stay',(px+(-1.0 if px<x else 1.0),.3,z),(px,1.9,z),.1,POST))
    xa,xb=left+.9,right-.9
    curve=lambda t:1.72-.66*math.sin(math.pi*t)
    n=16;xs=[xa+(xb-xa)*i/n for i in range(n+1)];ys=[curve(i/n) for i in range(n+1)]
    outline=[(xs[i],ys[i]) for i in range(n+1)]+[(xs[i],ys[i]-.04) for i in range(n,-1,-1)]
    stripes=7;w=1.4          # wide enough to cradle a player lying across the cloth
    for i in range(stripes):
        z1=z-w/2+w*i/stripes;z2=z-w/2+w*(i+1)/stripes
        m=CLOTH if i%2==0 else CLOTH2
        o.append(loft('hammock cloth',[(z1,outline),(z2,outline)],m,T,closed=True,caps=(i==0,i==stripes-1)))
    for s in (-1,1):                                   # selvedge rope along both long edges
        zr=z+s*(w/2+.03)
        for i in range(n):o.append(strut('selvedge rope',(xs[i],ys[i]+.03,zr),(xs[i+1],ys[i+1]+.03,zr),.05,ROPE))
    for end,px,knot in ((xa,left,left+.34),(xb,right,right-.34)):
        ky=2.02
        for k in range(7):
            zc=z-w/2+w*k/6
            o.append(strut('clew rope',(end,curve(0)+.01,zc),(knot,ky,z),.035,ROPE))
        o.append(strut('hanging rope',(knot,ky,z),(px,2.3,z),.07,ROPE))
        o.append(ico('clew knot',knot,ky,z,.1,ROPE,.9,sub=1))
    return o

# ---------------------------------------------------------------- sun loungers
def lounger(x,towel=False):
    z=SUNBED_Z;o=[];deck=.425   # deck top matches the procedural mattress the .62 pose used
    for s in (-1,1):
        o.append(box('lounger rail',x+s*.46,deck-.06,z-.5,.07,.1,1.85,LOUNGER,T,0))
        for dz in (-1.3,.3):
            o.append(box('lounger leg',x+s*.42,deck/2-.02,z+dz,.07,deck-.04,.07,LOUNGER,T,0))
    for dz in (-1.3,.3):o.append(box('lounger stretcher',x,.12,z+dz,.86,.06,.06,LOUNGER,T,0))
    for i in range(8):o.append(box('deck slat',x,deck-.02,z-1.4+i*.245,.9,.05,.18,CUSHION,T,0))
    # backrest hinged at the seaward end, rising at 55 degrees and leaning out over +z:
    # rx is the negative of the angle from horizontal, so the slat depth follows the panel.
    A=.96;hz=z+.36;up,out=math.sin(A),math.cos(A)
    for i in range(4):
        r=.16+i*.245
        o.append(box('back slat',x,deck-.03+r*up,hz+r*out,.9,.05,.18,CUSHION,T,0,rx=-A))
    for s in (-1,1):
        o.append(box('back rail',x+s*.46,deck-.06+.48*up,hz+.48*out,.07,.1,1.05,LOUNGER,T,0,rx=-A))
        o.append(strut('back prop',(x+s*.42,deck-.1,hz-.02),(x+s*.42,deck-.08+.95*up,hz+.95*out),.06,LOUNGER))
    if towel:
        o.append(box('folded towel',x,deck+.05,z-.9,.7,.07,.46,TOWEL,T,0))
        o.append(box('folded towel',x,deck+.11,z-.9,.66,.06,.42,CUSHION,T,0))
    return o

# ---------------------------------------------------------------- tables, chairs, parasols
def table(t):
    """Plank-top round table. Radius, top height and the centre leg match beach.ts."""
    x,z=t['x'],t['z'];big=len([c for c in CHAIRS if c['tableId']==t['id']])==9
    r=1.95 if big else 1.14;o=[]
    o.append(cyl('table top',x,1.02,z,r,.16,TOP,T,verts=24))
    o.append(cyl('table rim',x,1.0,z,r+.035,.1,GROOVE,T,verts=24))
    for d in [k*.42 for k in range(-int(r/.42),int(r/.42)+1)]:
        half=math.sqrt(max(r*r-d*d,0))-.06
        if half>.1:o.append(box('plank groove',x,1.104,z+d,2*half,.012,.05,GROOVE,T,0))
    o.append(cyl('table column',x,.5,z,.17,1.0,LEG,T,verts=12))
    feet=3 if not big else 4
    for k in range(feet):
        a=2*math.pi*k/feet+.3;fx,fz=x+math.cos(a)*r*.62,z+math.sin(a)*r*.62
        o.append(strut('table foot',(x,.12,z),(fx,.08,fz),.13,LEG))
        if big:o.append(cyl('outer leg',fx,.5,fz,.08,1.0,LEG,T,verts=8))
    o.append(cyl('table foot pad',x,.06,z,.42,.12,LEG,T,verts=12))
    return o

def chair(seat):
    x,z,yaw=seat['x'],seat['z'],seat['yaw'];o=[]
    o.append(yaw_box('chair seat',x,z,yaw,0,.6,0,.74,.09,.74,CHAIR))
    for dx in (-.3,.3):
        for dz in (-.3,.3):o.append(yaw_box('chair leg',x,z,yaw,dx,.3,dz,.07,.6,.07,LEG))
        o.append(yaw_box('chair stretcher',x,z,yaw,dx,.2,0,.05,.05,.62,LEG))
        o.append(yaw_box('chair back post',x,z,yaw,dx*1.03,.98,-.34,.07,.78,.07,CHAIR))
    for y in (.78,1.03,1.28):o.append(yaw_box('chair back slat',x,z,yaw,0,y,-.34,.62,.15,.05,CHAIR))
    o.append(yaw_box('chair back rail',x,z,yaw,0,1.37,-.34,.76,.08,.08,CHAIR))
    return o

def parasol(x,z):
    """Gored canvas over the small tables; ribs read from underneath where players sit."""
    o=[cyl('parasol pole',x,2.0,z,.055,4.0,POST,T,verts=10)]
    o.append(canopy('parasol canopy',x,z,2.58,4.38,3.58,[PARASOL,PARASOL2]))
    o.append(cyl('parasol hub',x,4.06,z,.1,.22,POST_D,T,verts=10))
    for k in range(8):
        a=2*math.pi*k/8
        o.append(strut('parasol rib',(x,4.0,z),(x+2.5*math.cos(a),3.6,z+2.5*math.sin(a)),.04,POST_D))
    o.append(cyl('parasol finial',x,4.5,z,.05,.2,POST_D,T,verts=6))
    return o

# ---------------------------------------------------------------- fire ring
def fire_ring():
    x,z=FIRE;o=[cyl('fire pit ash',x,.07,z,.62,.14,ASH,T,verts=14)]
    for k in range(9):
        a=2*math.pi*k/9
        o.append(ico('ring stone',x+.55*math.cos(a),.19,z+.55*math.sin(a),.24,STONE,.8))
    for k in range(3):
        a=2*math.pi*k/3+.4
        o.append(strut('log',(x+.5*math.cos(a),.13,z+.5*math.sin(a)),(x-.18*math.cos(a),.3,z-.18*math.sin(a)),.11,CHARRED))
    for k in range(3):
        a=2*math.pi*k/3+1.6
        o.append(ico('ember',x+.22*math.cos(a),.16,z+.22*math.sin(a),.08,EMBER,.7,sub=1))
    return o

# ---------------------------------------------------------------- build / export
def props():
    o=promenade()+stall()+fire_ring()
    for x in LAMPS:o+=lamp(x)
    for x,z in HAMMOCKS:o+=hammock(x,z)
    for i,x in enumerate(SUNBEDS):o+=lounger(x,towel=i==1)
    for t in PANTAI:
        o+=table(t)
        if len([c for c in CHAIRS if c['tableId']==t['id']])==4:o+=parasol(t['x'],t['z'])
    for seat in CHAIRS:
        if seat['tableId'].startswith('pantai-'):o+=chair(seat)
    return [p for p in o if p]

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    for ob in props():ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'beach | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Beach.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_Beach','origin':[0,0,0],'props':['kelapa stall','2 rope hammocks','4 tables',
        f'{len([c for c in CHAIRS if c["tableId"].startswith("pantai-")])} chairs','2 parasols','3 loungers',
        'fire ring','promenade sign frame','2 lamp posts'],
        'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('BEACH WEB EXPORT',json.dumps(report),flush=True)

def render():
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1600;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.58,.72,.88,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun)
    sun.data.energy=4.5;sun.rotation_euler=(math.radians(52),math.radians(14),math.radians(-40))
    bpy.ops.mesh.primitive_plane_add(size=200,location=pt(124,0,142));bpy.context.object.data.materials.append(hmat('Sand','#edd3a0',.95))
    bpy.ops.mesh.primitive_plane_add(size=120,location=pt(124,.18,215));bpy.context.object.data.materials.append(hmat('Preview sea','#329ca4',.3))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=32
    views={'stall':((97,3.4,144),(98,1.9,137.4)),'hammock':((104.5,2.6,153),(101,1.5,148)),
           'tables':((130,5.5,149),(123,1.6,137.5)),'lounger':((133,2.6,153),(130,.8,148)),
           'sign':((100,5.2,146),(98,3.2,132)),'parasol':((114,2.6,143),(110,3.4,147)),
           'overview':((112,15,166),(124,1,142))}
    for name,(eye,at) in views.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'beach.blend'))
