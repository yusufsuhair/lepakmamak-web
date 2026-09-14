"""Busking pitch for the PETRONAS forecourt frontage (and the Rembayung pitch, which reuses the same
set), photographic pass: a plank riser with a lit front lip, two combo amps under PA tops, a monitor
wedge, a cajon with its own short mic, the boom mic, an open guitar case with tips, an acrylic tip box
of ringgit notes, an extension reel and power board with the leads taped down, a gig bag and a
keyboard case, a goalpost truss with two PAR cans and fairy lights, timber posts flanking the game's
canvas sign, seven cross-legged spectators on tikar mats and a few spare plastic stools behind them.

Static scenery only. The buskers, the fan holding a camera and the waving fans are animated
createPerson rigs that stay in the game, and the game keeps drawing its own canvas sign between those
posts, so no wording is baked in here. Footprints match the colliders in src/busking.ts: amps at
x=+/-2, a 3 cm plank deck (top y=0.125) on the 9 cm paving, mats at the seated crowd positions, nothing south of the deck's z=-1.8
back edge. Materials whose names begin 'Night' are lamps src/stalls.ts lightHawker() drives:
fairy lights and the LED lip glow brighter after dark, the PAR lenses switch on, and the 'Night wash'
pools and 'Night beam' cones are drawn only at night.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_busking.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Busking.glb

Output: public/assets/models/environment/LM_ENV_Busking.glb, node 'busking' at the pitch origin.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from mathutils import Vector
from build_lrt import pt,mat,box,cyl,finish,rounded
from build_klcc import vloft
import pbr_kit as kit
from pbr_kit import srgb,uv_metres,strut,tube
import hawker_textures as HT
from hawker_kit import vc,lathe,quad,glow_mat,metallic,export

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/busking'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
T='busking'
kit.setup(T,OUT/'textures',20260915)
RNG=kit.RNG

# ------------------------------------------------------------------ materials: one draw each
WOOD=kit.pbr('Busk wood','wood_small','#ffffff',.78,.9,source=HT)
TOLEX=kit.pbr('Busk tolex','tolex','#ffffff',.72,.25,source=HT)
FABRIC=kit.pbr('Busk fabric','fabric','#ffffff',.9,.3,two_sided=True)
METAL=metallic(kit.pbr('Busk metal','steel','#ffffff',.36,.6,source=HT),.4)
PLASTIC=kit.pbr('Busk plastic','plastic','#ffffff',.5,.5,source=HT)
TIKAR=kit.pbr('Busk tikar','tikar','#ffffff',.9,.6,source=HT)
ACRYLIC=mat('Busk acrylic',(.9,.95,.97),.03,alpha=.2,two_sided=True)
LED=mat('Night LED',srgb('#ffbe6e'),.35,emit=1)
FAIRY=mat('Night fairy',srgb('#ffd08a'),.35,emit=1)
PAR=mat('Night par',srgb('#ffe6b8'),.2,emit=1)
WASH=glow_mat('Night wash',kit.image('wash',HT.wash()))
BEAM=glow_mat('Night beam',kit.image('beam',HT.beam()))

DECK_C='#b08a64';FRAME_C='#5e4631';AMP_C='#26302e';GRILLE_C='#1a1f1f';BLACK='#161616';CHROME='#d0d3d2'
SKIN='#b98256';TROUSERS='#8c826a';HAIR='#1d2222';TUDUNG='#4f8f84';SHIRTS=['#d36a52','#5f889a','#d6a94e']
MAT_A='#d9b77a';MAT_B='#c7a061';BAND_A='#b3392f';BAND_B='#2f6f57'

O=[]
def add(ob,c='#ffffff'):
    vc(ob,c)
    if any('tile' in m for m in ob.data.materials if m):uv_metres(ob)
    O.append(ob);return ob
def B(name,x,y,z,w,h,d,m,c='#ffffff',bevel=0,rx=0,ry=0):
    ob=box(name,x,y,z,w,h,d,m,T,bevel,rx)
    if ry:ob.rotation_euler.z=ry
    return add(ob,c)
def C(name,x,y,z,r,h,m,c='#ffffff',verts=12,axis='y'):return add(cyl(name,x,y,z,r,h,m,T,axis=axis,verts=verts),c)
def L(name,x,z,prof,m,c='#ffffff',n=14,**kw):return add(lathe(name,x,z,prof,m,n,**kw),c)
def S(name,p0,p1,w,m,c='#ffffff',h=None):
    ob=strut(name,p0,p1,w,m,h);return add(ob,c) if ob else None
def U(name,points,r,m,c='#ffffff',sides=6):return add(tube(name,points,r,m,sides),c)

def lowsphere(name,x,y,z,r,m,c,sy=1,sz=1,seg=10,ring=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=ring,radius=r,location=pt(x,y,z))
    o=bpy.context.object;o.scale=(1,sz,sy);finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=True
    return add(o,c)

# ------------------------------------------------------------------ stage riser
# Both pitches stand on paving about 9 cm proud of the road (the PETRONAS fuelling apron, the
# Rembayung forecourt): a deck at the old .08 was buried under it. A 3 cm plank mat on the paving
# keeps the guitarist rig (feet at .12) standing on the boards and the cajon top where the drummer sits.
TOP=.125
GROUND=.09
def stage():
    # Nine planks with open joints over a dark base. Each plank its own
    # tone, as boards from one yard are never the same.
    for i in range(9):
        k=.9+.1*((i*7)%5)/4
        B('plank',0,TOP-.02,-1.61+i*.40,4.9,.04,.38,WOOD,tuple(v*k for v in srgb(DECK_C)))
    B('deck base',0,TOP-.05,0,4.94,.03,3.56,WOOD,'#3a2c20')
    for zz in (-1.775,1.775):B('deck lip',0,TOP-.04,zz,5,.1,.05,WOOD,FRAME_C)
    for xx in (-2.475,2.475):B('deck lip',xx,TOP-.04,0,.05,.1,3.6,WOOD,FRAME_C)
    B('edge light',0,TOP-.04,1.806,4.6,.022,.012,LED)
    for xx in (-1.9,-.6,.6,1.9):B('edge light clip',xx,TOP-.04,1.803,.05,.045,.018,METAL,CHROME)
    # gaffer tape crosses where the leads run and the setlist taped by the mic
    for x,z,a in ((-.3,-1.05,.3),(1.2,-.95,-.4),(-1.45,.62,.8),(2.2,.9,.2)):B('gaffer tape',x,TOP+.002,z,.08,.004,.2,FABRIC,'#2a2a2a',ry=a)
    B('setlist',-1.0,TOP+.003,1.28,.21,.004,.3,PLASTIC,'#f2efe6',ry=.25)

# ------------------------------------------------------------------ amps, PA tops, wedge
def amp(x):
    z=.1
    B('amp plinth',x,TOP+.05,z,.67,.10,.57,TOLEX,BLACK,.01)
    B('amp cabinet',x,TOP+.49,z,.65,.78,.55,TOLEX,AMP_C,.025)
    B('amp top',x,TOP+.905,z,.67,.05,.57,TOLEX,AMP_C,.015)
    B('amp handle',x,TOP+.97,z,.24,.04,.09,PLASTIC,BLACK,.01)
    for s in (-1,1):B('amp handle mount',x+s*.11,TOP+.94,z,.03,.06,.07,METAL,CHROME)
    B('amp grille',x,TOP+.46,z+.269,.55,.60,.02,FABRIC,GRILLE_C)
    B('amp piping',x,TOP+.77,z+.275,.57,.012,.012,PLASTIC,'#cfc6a8')
    B('amp panel',x,TOP+.82,z+.273,.58,.1,.03,METAL,'#a9aba6')
    for i in range(5):C('amp knob',x-.22+i*.1,TOP+.82,z+.3,.02,.035,PLASTIC,BLACK,8,axis='z')
    B('amp pilot',x+.255,TOP+.82,z+.292,.025,.025,.012,LED)
    for s in (-1,1):
        for zz in (z-.25,z+.25):B('amp corner',x+s*.31,TOP+.88,zz,.05,.05,.05,METAL,CHROME)
    # PA top on a pole mount, tilted down at the crowd
    B('pa box',x,TOP+1.14,z-.02,.50,.40,.34,TOLEX,AMP_C,.02,rx=.14)
    B('pa grille',x,TOP+1.14,z+.15,.44,.34,.02,METAL,'#3a3f3f',rx=.14)
    C('pa horn',x,TOP+1.22,z+.165,.06,.02,PLASTIC,BLACK,10,axis='z')
    C('pa cone',x,TOP+1.08,z+.165,.1,.02,PLASTIC,BLACK,12,axis='z')

def wedge():
    """Floor monitor at the front of the deck, throwing back at the guitarist."""
    x,z=-1.55,1.28;lo,hi=TOP+.1,TOP+.34
    verts=[pt(x+sx,y,z+sz) for sx in (-.28,.28) for sz,y in ((-.2,TOP),(.2,TOP),(.2,hi),(-.2,lo))]
    add(kit.mesh('wedge body',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],TOLEX,smooth=False,closed=True),AMP_C)
    a=math.atan2(hi-lo,.4);ny,nz=math.cos(a)*.012,-math.sin(a)*.012
    grille=[pt(x+sx,y+ny,z+sz+nz) for sx,sz,y in ((-.23,-.15,lo+.03),(.23,-.15,lo+.03),(.23,.14,hi-.03),(-.23,.14,hi-.03))]
    g=kit.mesh('wedge grille',grille,[(0,1,2,3)],METAL,smooth=False);add(g,'#3a3f3f')
    from hawker_kit import face_up;face_up(g)

# ------------------------------------------------------------------ cajon and its mic
def cajon():
    x,z=1.05,-.05
    B('cajon body',x,TOP+.34,z,.60,.62,.58,WOOD,'#d8b98a',.02)
    B('cajon tapa',x,TOP+.35,z+.295,.56,.56,.02,WOOD,'#8a5f35')
    for s in (-1,1):
        for y in (TOP+.1,TOP+.6):B('tapa screw',x+s*.25,y,z+.307,.025,.025,.01,METAL,CHROME)
    B('cajon seat pad',x,TOP+.665,z,.58,.03,.56,FABRIC,BLACK,.01)
    C('cajon port',x,TOP+.35,z-.291,.10,.02,PLASTIC,'#241a12',12,axis='z')
    for sx in (-1,1):
        for sz in (-1,1):C('cajon foot',x+sx*.24,TOP+.02,z+sz*.23,.04,.04,PLASTIC,BLACK,8)
    # short straight stand with the mic pointed at the port side
    mx,mz=1.62,-.55
    C('cajon mic base',mx,TOP+.01,mz,.13,.02,METAL,BLACK,14)
    C('cajon mic pole',mx,TOP+.25,mz,.012,.48,METAL,CHROME,8)
    S('cajon mic',(mx,TOP+.5,mz),(mx-.14,TOP+.44,mz+.12),.032,PLASTIC,BLACK)

# ------------------------------------------------------------------ boom mic
def mic():
    x,z=-.7,1.0
    C('mic hub',x,TOP+.10,z,.05,.12,METAL,BLACK,10)
    for a in (150,270,30):
        r=math.radians(a);tip=(x+.30*math.cos(r),TOP+.02,z+.30*math.sin(r))
        S('mic leg',(x,TOP+.11,z),tip,.02,METAL,BLACK)
        C('mic foot',tip[0],TOP+.015,tip[2],.028,.03,PLASTIC,BLACK,8)
    C('mic pole',x,TOP+.55,z,.02,.86,METAL,CHROME,10)
    C('mic clutch',x,TOP+.99,z,.03,.09,PLASTIC,BLACK,10)
    C('mic pole upper',x,TOP+1.16,z,.015,.34,METAL,CHROME,8)
    S('mic boom',(x,TOP+1.31,z),(x,TOP+1.62,.46),.022,METAL,BLACK)
    S('mic body',(x,TOP+1.62,.47),(x,TOP+1.63,.35),.04,PLASTIC,BLACK)
    lowsphere('mic grille',x,TOP+1.63,.33,.042,METAL,CHROME)
    U('mic lead',[(x,TOP+1.6,.5),(x+.02,TOP+1.2,.62),(x,TOP+.4,.9),(x-.1,TOP+.02,.98)],.01,PLASTIC,BLACK,5)

# ------------------------------------------------------------------ guitar case, tip box, gear bags
CASE_X,CASE_Z,CASE_L,CASE_W=-.10,1.28,1.05,.44
def guitar_case():
    cx,cz=CASE_X,-CASE_Z;hl,hw=CASE_L/2,CASE_W/2
    shell=rounded([(cx-hl,cz-hw,.11),(cx+hl,cz-hw,.11),(cx+hl,cz+hw,.11),(cx-hl,cz+hw,.11)],4)
    inner=rounded([(cx-hl+.07,cz-hw+.07,.09),(cx+hl-.07,cz-hw+.07,.09),(cx+hl-.07,cz+hw-.07,.09),(cx-hl+.07,cz+hw-.07,.09)],4)
    add(vloft('case shell',[(TOP+.005,shell),(TOP+.12,shell)],[TOLEX],T),'#2b2420')
    add(vloft('case lining',[(TOP+.125,inner),(TOP+.135,inner)],[FABRIC],T),'#8e2c3a')
    B('case lid',CASE_X,TOP+.295,CASE_Z-.339,CASE_L,.03,CASE_W,TOLEX,'#2b2420',.01,rx=1.0)
    B('case lid lining',CASE_X,TOP+.313,CASE_Z-.328,CASE_L-.10,.012,CASE_W-.09,FABRIC,'#7a2532',rx=1.0)
    for s in (-1,1):B('case latch',CASE_X+s*.34,TOP+.115,CASE_Z+.215,.08,.04,.025,METAL,CHROME)
    B('case handle',CASE_X,TOP+.135,CASE_Z-.225,.22,.04,.05,PLASTIC,BLACK,.01)
    for dx,dz in ((-.28,.02),(-.14,-.07),(.02,.05),(.16,-.04),(.30,.03),(.24,.08)):
        C('tip coin',CASE_X+dx,TOP+.142,CASE_Z+dz,.013,.004,METAL,'#c9b27a',10)
    for dx,dz,a,c in ((-.05,.1,.3,'#3f6fb5'),(.12,-.02,-.5,'#4e9a5a'),(-.22,-.06,1.2,'#3f6fb5')):
        B('tip note',CASE_X+dx,TOP+.139,CASE_Z+dz,.14,.003,.07,PLASTIC,c,ry=a)

def tip_box():
    """Clear acrylic box on the lip with a slot, half full of RM1, RM5 and RM10 notes."""
    x,z=.78,1.36
    B('tip box',x,TOP+.14,z,.26,.28,.2,ACRYLIC)
    B('tip box lid',x,TOP+.285,z,.27,.012,.21,PLASTIC,'#1c1c1c')
    for i,c in enumerate(('#3f6fb5','#4e9a5a','#c0473e','#3f6fb5','#4e9a5a','#3f6fb5')):
        B('tip box note',x+((i*5)%3-1)*.05,TOP+.03+i*.018,z+((i*3)%3-1)*.035,.14,.012,.07,PLASTIC,c,ry=i*.7)

def gear():
    # keyboard soft case along the back of the deck, a gig bag leaning on the left tower
    B('keyboard case',.1,TOP+.08,-1.42,1.3,.14,.36,FABRIC,'#202224',.04)
    B('keyboard case zip',.1,TOP+.155,-1.42,1.2,.01,.02,METAL,CHROME)
    gx,gz=-1.95,-1.25
    bag=box('gig bag',gx,.62,gz,.38,1.08,.12,FABRIC,T,.04);bag.rotation_euler.y=-.22;add(bag,'#1d2426')
    bag2=box('gig bag body',gx+.04,.36,gz+.01,.46,.5,.16,FABRIC,T,.06);bag2.rotation_euler.y=-.22;add(bag2,'#1d2426')

# ------------------------------------------------------------------ power: reel, board, leads
def power():
    rx,rz=-1.55,-1.02
    L('reel flange',rx,rz,[(TOP,.2),(TOP+.03,.2)],PLASTIC,'#e1782b',n=16,cap_top=True)
    L('reel drum',rx,rz,[(TOP+.03,.11),(TOP+.2,.11)],PLASTIC,'#262626',n=14)
    L('reel flange',rx,rz,[(TOP+.2,.2),(TOP+.23,.2)],PLASTIC,'#e1782b',n=16,cap_top=True,cap_bottom=True)
    C('reel socket',rx+.08,TOP+.25,rz,.05,.04,PLASTIC,'#f3f1ea',10)
    S('reel handle',(rx,TOP+.23,rz),(rx,TOP+.42,rz),.03,PLASTIC,'#e1782b')
    B('reel grip',rx,TOP+.43,rz,.16,.04,.04,PLASTIC,'#262626')
    B('power board',-.9,TOP+.025,-1.12,.42,.045,.09,PLASTIC,'#f1efe8',.01)
    for i in range(4):B('plug',-1.05+i*.1,TOP+.065,-1.12,.05,.04,.05,PLASTIC,BLACK)
    lead=lambda name,pts:U(name,pts,.012,PLASTIC,BLACK,5)
    lead('reel lead',[(rx+.12,TOP+.2,rz),(-1.3,TOP+.01,-1.1),(-1.12,TOP+.03,-1.12)])
    lead('amp lead',[(-1.05,TOP+.07,-1.1),(-1.6,TOP+.01,-.55),(-2.0,TOP+.15,-.2)])
    lead('amp lead',[(-.95,TOP+.07,-1.1),(.2,TOP+.01,-1.2),(1.3,TOP+.01,-.95),(2.0,TOP+.15,-.2)])
    lead('wedge lead',[(-.85,TOP+.07,-1.1),(-1.2,TOP+.01,-.2),(-1.5,TOP+.01,.6),(-1.55,TOP+.05,1.05)])
    lead('reel feed',[(rx-.12,TOP+.1,rz),(-2.1,TOP+.01,-1.45),(-2.45,.1,-1.72),(-2.7,.01,-1.78)])
    bpy.ops.mesh.primitive_torus_add(location=pt(.62,TOP+.02,-1.02),major_radius=.2,minor_radius=.014,major_segments=14,minor_segments=4)
    coil=bpy.context.object;finish(coil,'cable coil',PLASTIC,T)
    for f in coil.data.polygons:f.use_smooth=True
    add(coil,BLACK)

# ------------------------------------------------------------------ truss, PAR cans, fairy lights
TZ=-1.55;TX=2.3;TH=3.0;TW=.22
def truss_run(p0,p1,axis_len):
    """Box truss between two corners: four chords and zig-zag lacing on each face."""
    a=Vector(p0);b=Vector(p1);d=(b-a).normalized();up=Vector((0,1,0)) if abs(d.y)<.9 else Vector((1,0,0))
    s1=d.cross(up).normalized()*TW/2;s2=d.cross(s1).normalized()*TW/2
    corners=[s1+s2,s1-s2,-s1-s2,-s1+s2]
    for c in corners:S('truss chord',tuple(a+c),tuple(b+c),.028,METAL,CHROME)
    steps=max(2,round(axis_len/.28))
    for f in range(4):
        c0,c1=corners[f],corners[(f+1)%4]
        for i in range(steps):
            t0,t1=i/steps,(i+1)/steps
            S('truss lacing',tuple(a+(b-a)*t0+(c0 if i%2 else c1)),tuple(a+(b-a)*t1+(c1 if i%2 else c0)),.014,METAL,CHROME)

def truss():
    for x in (-TX,TX):
        truss_run((x,TOP+.02,TZ),(x,TH,TZ),TH)
        B('truss base plate',x,TOP+.008,TZ,.5,.016,.5,METAL,'#6a6d6c')
        for k in range(4):
            a=k*math.pi/2+math.pi/4;C('base bolt',x+.21*math.cos(a),TOP+.02,TZ+.21*math.sin(a),.015,.012,METAL,CHROME,6)
        B('truss top block',x,TH+.05,TZ,TW+.06,TW+.06,TW+.06,METAL,CHROME)
    truss_run((-TX,TH+.05,TZ),(TX,TH+.05,TZ),2*TX)

PARS=[(-1.1,(-.7,TOP,.55)),(1.15,(1.05,TOP,.45))]
def par_cans():
    for x,(tx,ty,tz) in PARS:
        lens=Vector((x,TH-.32,TZ+.12));target=Vector((tx,ty,tz));d=(target-lens).normalized()
        S('par clamp',(x,TH-.08,TZ),(x,TH-.16,TZ),.05,METAL,BLACK)
        S('par yoke',(x-.14,TH-.16,TZ),(x+.14,TH-.16,TZ),.025,METAL,BLACK)
        for s in (-1,1):S('par yoke arm',(x+s*.14,TH-.16,TZ),(x+s*.14,TH-.3,TZ+.04),.022,METAL,BLACK)
        body_back=lens-d*.3
        U('par can',[tuple(body_back),tuple(lens-d*.12),tuple(lens)],[.07,.1,.105],METAL,'#1b1b1b',12)
        # lens disc facing the target
        bpy.ops.mesh.primitive_cylinder_add(vertices=14,radius=.085,depth=.01,location=tuple(Vector(pt(*lens))+Vector(pt(*d))*.015))
        o=bpy.context.object;o.rotation_euler=Vector(pt(*d)).to_track_quat('Z','Y').to_euler();finish(o,'par lens',PAR,T);add(o)
        beam(lens+d*.03,target)
        o=quad('stage pool',tx,TOP+.004,tz,1.7,1.5,WASH);add(o)

def beam(apex,target):
    """Open cone from the lens to the deck with v running down it (the beam texture fades along v)."""
    n=14;axis=(target-apex);L_=axis.length;d=axis.normalized()
    u=d.orthogonal().normalized();w=d.cross(u).normalized();verts=[];faces=[];r0,r1=.08,.62
    for ring,(p,r) in enumerate(((apex,r0),(apex+axis*.92,r1))):
        for i in range(n+1):
            a=2*math.pi*i/n;verts.append(pt(*(p+(u*math.cos(a)+w*math.sin(a))*r)))
    for i in range(n):faces.append((i,i+1,n+1+i+1,n+1+i))
    ob=kit.mesh('par beam',verts,faces,BEAM,smooth=True)
    uv=ob.data.uv_layers.new(name='UVMap')
    for f in ob.data.polygons:
        for li in f.loop_indices:
            vi=ob.data.loops[li].vertex_index;uv.data[li].uv=((vi%(n+1))/n,1-(vi//(n+1)))
    add(ob)

def fairy_lights():
    """Warm bulbs on dark flex: three swags under the top truss and a spiral down each tower."""
    bulbs=[]
    def string(points,count):
        U('fairy flex',points,.006,PLASTIC,BLACK,4)
        seg=[(Vector(points[i]),Vector(points[i+1])) for i in range(len(points)-1)]
        lengths=[(b-a).length for a,b in seg];total=sum(lengths)
        for k in range(count):
            t=(k+.5)/count*total
            for (a,b),l in zip(seg,lengths):
                if t<=l:bulbs.append(a+(b-a)*(t/l));break
                t-=l
    for i in range(3):
        x0=-TX+i*2*TX/3;x1=x0+2*TX/3;pts=[]
        for k in range(9):
            t=k/8;pts.append((x0+(x1-x0)*t,TH-.1-.32*math.sin(math.pi*t),TZ+.16))
        string(pts,9)
    for x in (-TX,TX):
        pts=[(x+.17*math.cos(k*.7),TH-.1-k*(TH-.5)/24,TZ+.17*math.sin(k*.7)) for k in range(25)]
        string(pts,16)
    # each bulb an 8-triangle drop: at 4 cm nobody can count the facets, and it emits anyway
    verts=[];faces=[]
    for p in bulbs:
        b=len(verts);r=.022;y=p.y-.03
        verts+=[pt(p.x,y+.03,p.z),pt(p.x+r,y,p.z),pt(p.x,y,p.z+r),pt(p.x-r,y,p.z),pt(p.x,y,p.z-r),pt(p.x,y-.03,p.z)]
        faces+=[(b,b+1+k,b+1+(k+1)%4) for k in range(4)]+[(b+5,b+1+(k+1)%4,b+1+k) for k in range(4)]
    add(kit.mesh('fairy bulbs',verts,faces,FAIRY,smooth=False,closed=True))

# ------------------------------------------------------------------ banner posts
def banner():
    """Two timber posts BEHIND the game's canvas sign at (0,0.6,1.65), 2.0 x 0.5, just outside its
    width. No rails: a horizontal bar across the stage front read as a handrail."""
    for x in (-1.07,1.07):
        B('banner post',x,TOP+.43,1.70,.05,.86,.05,WOOD,FRAME_C,.012)
        B('banner foot',x,TOP+.025,1.70,.2,.05,.2,METAL,'#3a3c3b')

# ------------------------------------------------------------------ seated crowd and stools
SEATED=[(-4.6,2.8),(-3.2,3.9),(-1.6,4.5),(0,4.65),(1.7,4.45),(3.3,3.8),(4.7,2.7)]
def part(name,ox,oz,yaw,lx,ly,lz,w,h,d,m,c,rx=0,ry=0,bevel=0):
    cs,sn=math.cos(yaw),math.sin(yaw)
    ob=box(name,ox+lx*cs+lz*sn,ly+GROUND,oz-lx*sn+lz*cs,w,h,d,m,T,bevel)
    ob.rotation_euler=(rx,0,yaw+ry);return add(ob,c)

def lball(name,ox,oz,yaw,lx,ly,lz,r,m,c,sy=1,sz=1):
    cs,sn=math.cos(yaw),math.sin(yaw)
    o=lowsphere(name,ox+lx*cs+lz*sn,ly+GROUND,oz-lx*sn+lz*cs,r,m,c,sy,sz);o.rotation_euler.z=yaw;return o

def spectator(i,x,z):
    """Cross-legged on a tikar, facing the stage exactly as the rigs did."""
    yaw=math.atan2(-x,-z);shirt=SHIRTS[i%len(SHIRTS)];skin=('#b98256','#8d5b3a','#d1a07a')[i%3]
    B('tikar',x,GROUND+.01,z,1.15,.02,.82,TIKAR,MAT_A if i%2 else MAT_B)
    for s in (-1,1):B('tikar band',x,GROUND+.021,z+s*.3,1.15,.004,.06,TIKAR,BAND_A if i%2 else BAND_B)
    part('crowd hips',x,z,yaw,0,.19,-.02,.50,.20,.40,FABRIC,TROUSERS)
    for s in (-1,1):
        part('crowd shin',x,z,yaw,s*.09,.115,.21,.40,.13,.16,FABRIC,TROUSERS,ry=s*.55)
        part('crowd foot',x,z,yaw,-s*.13,.10,.13,.14,.10,.20,PLASTIC,skin,ry=s*.55)
    part('crowd torso',x,z,yaw,0,.52,-.01,.46,.48,.29,FABRIC,shirt)
    part('crowd shoulders',x,z,yaw,0,.73,-.01,.50,.10,.29,FABRIC,shirt)
    part('crowd neck',x,z,yaw,0,.79,0,.12,.07,.12,PLASTIC,skin)
    for s in (-1,1):
        part('crowd upper arm',x,z,yaw,s*.27,.58,.01,.12,.28,.15,FABRIC,shirt,rx=.16)
        part('crowd forearm',x,z,yaw,s*.26,.33,.15,.11,.26,.13,PLASTIC,skin,rx=-.95)
    lball('crowd head',x,z,yaw,0,.95,.01,.185,PLASTIC,skin,sy=1.06,sz=.94)
    if i in (1,4):
        lball('crowd tudung',x,z,yaw,0,.955,-.01,.205,FABRIC,TUDUNG,sy=1.06,sz=.98)
        part('crowd tudung drape',x,z,yaw,0,.80,-.12,.30,.30,.09,FABRIC,TUDUNG)
    elif i==6:
        part('crowd songkok',x,z,yaw,0,1.12,.01,.30,.13,.28,FABRIC,'#141414')
    else:
        lball('crowd hair',x,z,yaw,0,.99,-.015,.196,PLASTIC,HAIR,sy=.72)

def stools():
    """Spare kopitiam stools behind the mats, for whoever stays for the next song."""
    for x,z,c in ((-4.3,4.25,'#c42a26'),(4.4,3.85,'#2658a8'),(.85,3.72,'#2f8a4a')):
        g=GROUND
        L('stool skirt',x,z,[(g+.2,.2),(g+.36,.158),(g+.42,.152)],PLASTIC,c,n=12)
        for k in range(4):
            a=k*math.pi/2+math.pi/4;S('stool leg',(x+math.cos(a)*.15,g+.22,z+math.sin(a)*.15),(x+math.cos(a)*.2,g,z+math.sin(a)*.2),.05,PLASTIC,c,h=.03)
        L('stool seat',x,z,[(g+.41,.168),(g+.44,.172),(g+.45,.165)],PLASTIC,c,n=12,cap_top=True)
        C('stool handle hole',x,g+.452,z,.035,.006,PLASTIC,'#202020',10)

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    stage();cajon();mic();guitar_case();tip_box();gear();power();wedge();banner();truss();par_cans();fairy_lights();stools()
    for x in (-2,2):amp(x)
    for i,(x,z) in enumerate(SEATED):spectator(i,x,z)
    for ob in O:ob.parent=e
    return e

if __name__=='__main__':
    e=build()
    path=PUBLIC/'LM_ENV_Busking.glb'
    report={'asset':'LM_ENV_Busking','origins':[[-31,0,86],[-116,0,119]],'footprint':[5,3.6],'truss':{'x':TX,'z':TZ,'height':TH},**export(e,path,T)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('BUSKING WEB EXPORT',json.dumps(report),flush=True)
