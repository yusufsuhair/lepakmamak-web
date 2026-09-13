"""Pantai Senja, photographic pass: a shaped sand terrain that runs under the sea, PBR materials
on every prop, and the planting, rock and tide litter of a real Malaysian beach.

What is here
  * terrain: dry sand with low hummocks, a damp-to-wet foreshore that slopes under the water
    and a seabed out to z 180, vertex-painted for trampled patches, the tide line and depth
  * props (positions unchanged): kelapa segar stall, two rope hammocks, promenade sign frame,
    lamp posts, the four tables with chairs and parasols, sun loungers, fire ring, boardwalk
  * dressing: pandan laut clumps, tapak kuda (beach morning glory) runners and beach grass
    along the back edge, granite boulders at both ends, driftwood, husks, dry fronds, seaweed
    and shells along the wrack line, and the red no-swimming flag
  * textures: procedural and tileable (beach_textures.py), embedded as WebP; the runtime sea's
    water normal and foam lace go to public/assets/textures/beach/

Gameplay numbers are read or mirrored, never invented: chairs and tables come from
shared/chairs.json and shared/tables.json, the rest anchors mirror BEACH_REST_SPOTS, and the
shore profile below is mirrored in src/beach.ts (SHORE) so the sea meets this sand exactly.
Colliders stay in beach.ts. No wording is baked: the canvas signs stay the game's.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_beach.py

Output: public/assets/models/environment/LM_ENV_Beach.glb, node 'beach' in world coordinates.
"""
import bpy, bmesh, math, json, sys, random
import numpy as np
from pathlib import Path
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import sphere
import pbr_textures as TX
import pbr_kit as kit
from pbr_kit import srgb,hmat,pbr,uv_metres,strut,ico,mesh,tube,rock

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/beach'; (OUT/'textures').mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
RUNTIME=ROOT/'public/assets/textures/beach'; RUNTIME.mkdir(parents=True,exist_ok=True)
T='beach'
kit.setup(T,OUT/'textures',20260913)
RNG=kit.RNG   # one stream shared with the kit, so a rebuild reproduces the shipped UVs and props

TABLES=json.loads((ROOT/'shared/tables.json').read_text())
CHAIRS=json.loads((ROOT/'shared/chairs.json').read_text())
PANTAI=[t for t in TABLES if t['id'].startswith('pantai-')]
SEATS=[c for c in CHAIRS if c['tableId'].startswith('pantai-')]
# --- mirrors src/beach.ts: hammock cloth centre stays at the 1.1 rest height and the lounger
# deck under the .62 sunbed pose.
HAMMOCKS=[(101,148),(148,147)]
SUNBEDS=[119,130,142];SUNBED_Z=148
STALL=(98,137)                     # collider x 96..100, z 136.15..137.85
SIGN=(98,132);SIGN_POSTS=[94,102]  # the game draws PANTAI SENJA across x 93.5..102.5
FIRE=(125,148);LAMPS=[104,146];LAMP_Z=144
# coconut palms (x, z, height, lean toward the sea): the fallback palm() calls in beach.ts stand here
PALMS=[(98,145,8.2,.28),(149,133,9.0,.18),(102,137,7.4,.22),(154.2,140.5,8.6,.34),(90.5,147.5,7.8,.3)]
# --- mirrors SHORE in src/beach.ts: dry sand top, the foreshore slope and the nearshore floor.
# The still-water line (SEA_Y) crosses the slope at z ~152, where the old sand box ended.
SAND_Y,FORE0,FORE1,NEAR_Y,SEA_Y=.02,150.3,153.3,-.035,-.012
WEST,EAST,HEDGE_Z=87.5,156.25,157.6   # the city's boundary hedges bound the dry beach

# ------------------------------------------------------------------ images and PBR materials

# wood: one weathered grain, many finishes
POST=pbr('Coconut post','bark','#b89a80',.85,1.0)
TIMBER=pbr('Beach timber','wood','#9a7a58',.8,.9)
TOP=pbr('Table top','wood','#d9b287',.62,.9)
GROOVE=pbr('Table plank groove','wood','#8f6a45',.8,.9)
LEG=pbr('Table leg','wood','#7a5a3c',.72,.9)
CHAIR=pbr('Chair teal','wood','#3f8c8d',.55,.7)
STALL_G=pbr('Stall green','wood','#6e9650',.62,.9)
COUNTER=pbr('Counter timber','wood','#caa070',.6,.9)
STALLP=pbr('Stall post','wood','#a07a52',.72,.9)
FRAMEBOARD=pbr('Sign frame','wood','#2f6b64',.6,.9)
LOUNGER=pbr('Lounger frame','wood','#cdb088',.65,.9)
DECK=pbr('Boardwalk plank','wood','#b39571',.78,1.2)
JOIST=pbr('Boardwalk joist','wood','#6b5238',.85,1.2)
DRIFT=pbr('Driftwood','wood','#b6ada1',.9,1.1,strength=1.6)
CHARRED=pbr('Charred log','wood','#3d3129',.9,.8,strength=1.4)
POST_D=pbr('Post lashing','wood','#5b4028',.8,.6)
THATCH=pbr('Attap thatch','thatch','#e4cfa8',.88,1.5,two_sided=True)
THATCH2=pbr('Attap shade','thatch','#b9a07a',.9,1.5,two_sided=True)
CLOTH=pbr('Hammock cloth','fabric','#d77991',.85,.35,two_sided=True)
CLOTH2=pbr('Hammock stripe','fabric','#f4e6d4',.85,.35,two_sided=True)
ROPE=pbr('Hammock rope','fabric','#cdb68a',.9,.12,strength=2)
CUSHION=pbr('Lounger slat','wood','#eadfca',.62,.9)
TOWEL=pbr('Beach towel','fabric','#4f9ec4',.9,.3)
PARASOL=pbr('Parasol canvas','fabric','#f1b663',.8,.5,two_sided=True)
PARASOL2=pbr('Parasol band','fabric','#f3ece0',.8,.5,two_sided=True)
STONE=pbr('Fire ring stone','granite','#a39a8c',.9,.6)
GRANITE=pbr('Granite boulder','granite','#ffffff',.8,1.6,strength=1.3)
ASH=pbr('Fire pit ash','sand','#4a4541',.95,2.0)
DRY_SAND=pbr('Dry sand','sand','#ffffff',.93,4.0,normal_scale=.58)
WET_SAND=pbr('Wet sand','sand','#ffffff',.42,4.0,strength=.55,normal_scale=.58)
# flat finishes where a texture would not read
NUT=hmat('Green coconut','#8aa343',.45);HUSK=hmat('Coconut husk','#8d6b47',.95)
FLESH=hmat('Coconut flesh','#f4ecd8',.55);STRAW=hmat('Drinking straw','#e0574f',.4)
EMBER=mat('Ember',srgb('#ff7a2f'),.5,emit=2.4);GLOBE=mat('Lantern globe',srgb('#ffdf99'),.35,emit=2.6)
METAL=hmat('Lamp metal','#4f473d',.45);COOLER=hmat('Cooler box','#d9dfe2',.45)
LEAF=hmat('Pandan leaf','#4f7a33',.55,two_sided=True);LEAF_OLD=hmat('Pandan leaf yellowed','#a8a052',.7,two_sided=True)
VINE=hmat('Tapak kuda leaf','#4d8a3a',.5,two_sided=True);BLOOM=hmat('Tapak kuda flower','#b04c9c',.6,two_sided=True)
GRASS=hmat('Beach grass','#8c9a52',.8,two_sided=True);FROND=hmat('Dry frond','#9b7b4e',.9,two_sided=True)
PALM_TRUNK=pbr('Palm trunk','bark','#a8988a',.9,1.2)
FROND_NEW=hmat('Palm frond young','#5d8a2e',.55,two_sided=True);FROND_MID=hmat('Palm frond','#476f26',.6,two_sided=True)
FROND_OLD=hmat('Palm frond old','#8d9440',.7,two_sided=True);FROND_DEAD=hmat('Palm frond dead','#8a6c45',.9,two_sided=True)
KELP=hmat('Seaweed','#6b5f34',.5,two_sided=True);SHELL=hmat('Shell','#eee3d2',.5);SHELL2=hmat('Shell pink','#d9a79a',.5)
CRATE=hmat('Plastic crate','#2f66b3',.5);FLAG=hmat('Warning flag','#d23a2c',.8,two_sided=True)

# ------------------------------------------------------------------ small geometry helpers

def yaw_box(name,cx,cz,yaw,dx,y,dz,w,h,d,m,bevel=0):
    """Box in a furniture-local frame turned by the game yaw (chairs come from JSON)."""
    c,s=math.cos(yaw),math.sin(yaw)
    o=box(name,cx+dx*c+dz*s,y,cz-dx*s+dz*c,w,h,d,m,T,bevel)
    o.rotation_euler.z=yaw;return o

def canopy(name,x,z,r,apex,rim,mats,n=24,gores=8,sag=.17,scallop=.05):
    """Gored parasol canopy: fabric sags and scallops between the ribs; alternate gores swap."""
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
    return mesh(name,verts,faces,None,mats=mats,index=index)

# ------------------------------------------------------------------ keep-outs for dressing
KEEP=[(c['x'],c['z'],.75) for c in SEATS]
KEEP+=[(t['x'],t['z'],2.3 if len([c for c in SEATS if c['tableId']==t['id']])==9 else 1.5) for t in PANTAI]
KEEP+=[(t['arrivalX'],t['arrivalZ'],.9) for t in PANTAI]
for x in SUNBEDS:KEEP+=[(x,147.4,1.2),(x,149.2,1.0),(x,150.7,.9)]
for x,z in HAMMOCKS:KEEP+=[(x+d,z,1.0) for d in (-3.6,-2.4,-1.2,0,1.2,2.4,3.6)]+[(x,z+2.7,1.0)]
KEEP+=[(*FIRE,1.4),(*STALL,2.8),(98,134.8,1.2),(89,142,2.4)]+[(x,LAMP_Z,.6) for x in LAMPS]
KEEP+=[(x,z,.9) for x,z,_,_ in PALMS]+[(x,SIGN[1],.6) for x in SIGN_POSTS]
def clear(x,z,r=0):return all(math.hypot(x-kx,z-kz)>kr+r for kx,kz,kr in KEEP) and not (81<x<99.5 and 130<z<134)

def smooth(t):t=min(max(t,0.0),1.0);return t*t*(3-2*t)
def north_edge(x):return 130.45+.45*noise.noise(Vector((x*.13,.5,2.2)))

def ground(x,z):
    """Sand height (game y). Dry hummocks fade out before the foreshore; the rims sink into the
    city ground so no edge shows; the seabed stays above the city slab (-.05) until z 159."""
    if z<FORE0:
        rim=min(smooth((z-north_edge(x))/2.2),smooth((x-WEST)/2.5),smooth((EAST-x)/1.2))
        bump=max(0.0,noise.noise(Vector((x*.085,z*.085,.7))))*.04*(1-smooth((z-145.5)/4))
        return .004+(SAND_Y-.004+bump)*rim
    if z<FORE1:return SAND_Y+(NEAR_Y-SAND_Y)*smooth((z-FORE0)/(FORE1-FORE0))
    if z<159:return NEAR_Y+noise.noise(Vector((x*.21,z*.35,3.1)))*.006*smooth((z-FORE1)/1.5)*(1-smooth(z-158))
    if z<161:return NEAR_Y+(-.115-NEAR_Y)*smooth((z-159)/2)
    if z<170:return -.115
    return -.115-(z-170)*.08

TRAMPLE=[(t['x'],t['z'],3.4,.13) for t in PANTAI]+[(98,139.2,3.2,.16),(125,148,2.6,.2),(113,137,1.6,.1),(126,137,1.6,.1),(141,137,1.6,.1),(89,142,3,.1)]
def tint(x,z):
    """Linear vertex colour multiplying the sand texture: mottling, trampled patches, the tide
    line, and the damp -> wet -> submerged gradient toward the sea."""
    # baseline .9 leaves headroom: glTF vertex colours clamp at 1
    m=.9*(1+.09*noise.noise(Vector((x*.05,z*.05,5.5)))+.045*noise.noise(Vector((x*.23,z*.23,8.1))))
    for cx,cz,r,k in TRAMPLE:
        d=math.hypot(x-cx,z-cz)
        if d<r:m*=1-k*(1-d/r)**2
    if z<134:m*=1+.04*(1-smooth((z-131)/3))
    m*=1-.12*math.exp(-((z-150.0-.25*noise.noise(Vector((x*.3,1.1,4))))/.22)**2)   # wrack line
    m*=float(np.interp(z,[149.2,150.3,151.2,152.2,154,160],[1,.86,.7,.58,.5,.4]))
    r=float(np.interp(z,[152,156,162],[1,.93,.86]));b=float(np.interp(z,[152,156,162],[1,.97,.94]))
    return (m*r,m,m*b)

def terrain():
    zs=[None]+list(np.arange(131,150,1.0))+list(np.arange(150,154.01,.25))+list(np.arange(154.5,160.1,.5))+list(np.arange(162,181,2.0))
    WET_ROW=zs.index(151.25)   # the high-swash mark: the dry/wet material seam wanders along this row
    xs=[74,77,80,83,86]+list(np.arange(WEST,EAST+.01,1.25))+[158.5,161,163.5,166,168.5,171,174]
    verts=[];cols=[];grid={}
    for j,z0 in enumerate(zs):
        for i,x in enumerate(xs):
            z=north_edge(x) if z0 is None else float(z0)
            if j==WET_ROW:z+=.16*noise.noise(Vector((x*.21,7.7,1.3)))+.06*math.sin(x*.9)
            grid[i,j]=len(verts);verts.append(pt(x,ground(x,z),z));cols.append(tint(x,z))
    faces=[];index=[]
    for j in range(len(zs)-1):
        cz=zs[j+1]-.3 if zs[j] is None else (zs[j]+zs[j+1])/2
        for i in range(len(xs)-1):
            if cz<HEDGE_Z and not (WEST<(xs[i]+xs[i+1])/2<EAST):continue
            # counter-clockwise seen from above (+x then +z is clockwise in Blender's -y), so it faces up
            faces.append((grid[i,j+1],grid[i+1,j+1],grid[i+1,j],grid[i,j]));index.append(1 if j>=WET_ROW else 0)
    ob=mesh('sand terrain',verts,faces,None,mats=[DRY_SAND,WET_SAND],index=index)
    me=ob.data;attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT')
    for k,c in enumerate(cols):attr.data[k].color=(*c,1)
    me.color_attributes.active_color=attr
    uv=me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        for li in f.loop_indices:
            v=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(v.x/4,v.y/4)
    ob['terrain']=True;return [ob]

def fringe(x0,x1,z,y,m,drop=.16):
    """The ragged hem of an attap course: frond tips hanging unevenly below the lower edge."""
    R=random.Random(int(x0*31+z*17));verts=[];faces=[];x=x0
    while x<x1-.02:
        w=R.uniform(.05,.11);d=drop*R.uniform(.45,1.25);b=len(verts);lean=R.uniform(-.03,.03)
        verts+=[pt(x,y+.01,z),pt(min(x+w,x1),y+.01,z),pt(x+w*.5+lean,y-d,z+R.uniform(.0,.05))]
        faces.append((b,b+1,b+2));x+=w*R.uniform(.55,.9)
    return mesh('attap fringe',verts,faces,m,smooth=False)

# ------------------------------------------------------------------ promenade, sign, lamps
def boardwalk():
    """The timber approach from the road, planked across its width with gaps between boards."""
    o=[box('boardwalk bearer',90,.05,z,18,.1,.18,JOIST,T,0) for z in (130.75,132,133.25)]
    for x in np.arange(81.25,99,.62):
        o.append(box('boardwalk plank',float(x),.125,132+RNG.uniform(-.03,.03),.52+RNG.uniform(-.02,.02),.05,3.0,DECK,T,0))
    for x in (81,99.2):o.append(box('boardwalk edge',x,.09,132,.14,.18,3.1,JOIST,T,.01))
    return o

def promenade():
    """Frame around the game's PANTAI SENJA canvas sign: the plane stays clear at z=132."""
    o=[];x0,z=SIGN[0],SIGN[1];zb=z-.2
    for x in SIGN_POSTS:
        o.append(cyl('sign post',x,2.45,zb,.14,4.9,POST,T,verts=12))
        o.append(box('post cap',x,4.95,zb,.34,.1,.32,POST_D,T,.02))
        for y in (1.5,3.0):o.append(cyl('post lashing',x,y,zb,.155,.1,ROPE,T,verts=12))
    for y,h in ((4.64,.26),(2.5,.2)):o.append(box('sign rail',x0,y,zb,9.6,h,.16,FRAMEBOARD,T,.02))
    for x in (93.6,102.4):o.append(box('sign stile',x,3.58,zb,.18,2.0,.14,FRAMEBOARD,T,.02))
    o.append(box('sign cap board',x0,5.06,zb+.1,9.9,.09,1.05,THATCH,T,0))
    o.append(box('sign cap drip',x0,4.99,zb+.6,9.9,.14,.1,THATCH2,T,0))
    o.append(fringe(x0-4.95,x0+4.95,zb+.66,4.93,THATCH2,.2))
    for x in SIGN_POSTS:
        o.append(strut('sign brace',(x+(1.4 if x<x0 else -1.4),3.0,zb),(x,4.4,zb),.1,POST))
    return o

def lamp(x):
    z=LAMP_Z;o=[]
    o.append(cyl('lamp post',x,1.7,z,.085,3.4,POST,T,verts=10))
    o.append(box('lamp post foot',x,.09,z,.4,.18,.4,POST_D,T,.03))
    o.append(cyl('lamp collar',x,3.42,z,.11,.12,METAL,T,verts=10))
    o.append(sphere('lantern globe',x,3.6,z,.23,GLOBE,T))
    o.append(cyl('lantern cap',x,3.84,z,.2,.08,METAL,T,verts=12))
    o.append(cyl('lantern finial',x,3.93,z,.04,.14,METAL,T,verts=6))
    return o

# ------------------------------------------------------------------ kelapa segar stall
def stall():
    """Lean-to attap roof, plank counter, coconuts. The KELAPA SEGAR · RM5 canvas sign hangs at
    y2.45/z137.75 (top ~2.89), so the front eave stays above it."""
    x0,z0=STALL;o=[]
    front,back=z0+.92,z0-.6
    for x in (x0-1.7,x0+1.7):
        o.append(box('stall post',x,1.75,back,.16,3.5,.16,STALLP,T,.02))
        o.append(box('stall post',x,1.56,front,.16,3.12,.16,STALLP,T,.02))
        o.append(strut('stall knee brace',(x,2.7,front),(x,2.95,front-.6),.09,STALLP))
    o.append(box('counter carcass',x0,.52,z0,3.66,1.02,1.22,STALL_G,T,.02))
    for x in [x0-1.74+i*.7 for i in range(6)]:o.append(box('counter batten',x,.56,z0+.63,.12,.94,.06,COUNTER,T,.01))
    o.append(box('counter kick rail',x0,.1,z0+.63,3.7,.18,.08,COUNTER,T,.01))
    o.append(box('counter top rail',x0,1.04,z0+.63,3.7,.1,.08,COUNTER,T,.01))
    o.append(box('counter top',x0,1.14,z0,4.0,.12,1.7,COUNTER,T,.02))
    o.append(box('counter lip',x0,1.05,z0+.84,4.0,.1,.07,COUNTER,T,.01))
    o.append(box('counter shelf',x0,.62,z0-.2,3.4,.06,.8,COUNTER,T,0))
    def course(z1,z2,y1,y2,thick,m,name):
        prof=lambda y:[(x0-2.3,y),(x0+2.3,y),(x0+2.3,y-thick),(x0-2.3,y-thick)]
        o.append(fringe(x0-2.3,x0+2.3,z2,y2-thick,m))
        return loft(name,[(z1,prof(y1)),(z2,prof(y2))],m,T)
    slope=lambda z:3.6-.235*(z-(z0-1.1))
    o.append(course(z0-1.2,z0+1.25,slope(z0-1.2),slope(z0+1.25),.1,THATCH,'attap deck'))
    for i in range(6):
        z1=z0-1.25+i*.42;z2=z1+.54
        o.append(course(z1,z2,slope(z1)+.19,slope(z2)+.11,.09,THATCH if i%2 else THATCH2,'attap course'))
    o.append(box('eave fascia',x0,slope(z0+1.25)+.02,z0+1.29,4.7,.16,.1,THATCH2,T,0))
    o.append(box('ridge cap',x0,slope(z0-1.2)+.13,z0-1.2,4.7,.13,.22,THATCH2,T,0))
    for x in (x0-2.5,x0+2.5):
        o.append(strut('roof purlin',(x,slope(z0-1.15),z0-1.15),(x,slope(z0+1.2),z0+1.2),.08,STALLP))
    o.append(box('nut shelf',x0,2.3,back+.18,3.3,.07,.44,STALLP,T,0))
    for x in (x0-1.62,x0+1.62):o.append(strut('shelf bracket',(x,2.26,back+.36),(x,2.6,back+.02),.07,STALLP))
    for i in range(5):o.append(ico('shelf coconut',x0-1.2+i*.6,2.54,back+.18,.21,NUT,.92))
    o.append(box('cooler box',x0+1.1,.28,back+.35,.62,.56,.44,COOLER,T,.04))
    o.append(box('cooler lid',x0+1.1,.59,back+.35,.66,.07,.48,CRATE,T,.02))
    for i in range(6):o.append(ico('counter coconut',x0-1.3+i*.5,1.42,z0-.1,.25,NUT,.9))
    for s in (-1,1):
        cx=x0+s*1.35
        o.append(ico('opened coconut',cx,1.42,z0+.42,.25,NUT,.88))
        o.append(cyl('coconut cut',cx,1.63,z0+.42,.13,.03,FLESH,T,verts=10))
        o.append(strut('straw',(cx,1.6,z0+.42),(cx+s*.14,2.06,z0+.5),.022,STRAW))
    # stock on the sand beside the stall: a heap of young coconuts, a crate, a chopping stump
    for i in range(14):
        hx,hz=x0+2.6+RNG.uniform(-.55,.55),z0-.2+RNG.uniform(-.5,.5)
        o.append(ico('coconut heap',hx,.22+.16*(i%3==0),hz,.24,NUT if i%4 else HUSK,.9))
    o.append(box('plastic crate',x0-2.55,.2,z0-.3,.55,.4,.4,CRATE,T,.03))
    o.append(cyl('chopping stump',x0-2.5,.26,z0+.55,.24,.52,TIMBER,T,verts=12))
    return o

# ------------------------------------------------------------------ rope hammocks
def hammock(x,z):
    """Cloth ends are lifted by clew fans, so the sag is real: top surface 1.06 at the centre,
    right under the 1.1 hammock rest pose."""
    o=[];left,right=x-3.2,x+3.2
    for px in (left,right):
        o.append(cyl('hammock post',px,1.62,z,.15,3.24,POST,T,verts=12))
        o.append(cyl('post cap',px,3.28,z,.18,.1,POST_D,T,verts=12))
        for y in (1.05,2.28):o.append(cyl('post lashing',px,y,z,.165,.1,ROPE,T,verts=12))
        o.append(strut('post stay',(px+(-1.0 if px<x else 1.0),.02,z),(px,1.9,z),.1,POST))
    xa,xb=left+.9,right-.9
    curve=lambda t:1.72-.66*math.sin(math.pi*t)
    n=16;xs=[xa+(xb-xa)*i/n for i in range(n+1)];ys=[curve(i/n) for i in range(n+1)]
    outline=[(xs[i],ys[i]) for i in range(n+1)]+[(xs[i],ys[i]-.04) for i in range(n,-1,-1)]
    stripes=7;w=1.4
    for i in range(stripes):
        z1=z-w/2+w*i/stripes;z2=z-w/2+w*(i+1)/stripes
        o.append(loft('hammock cloth',[(z1,outline),(z2,outline)],CLOTH if i%2==0 else CLOTH2,T,closed=True,caps=(i==0,i==stripes-1)))
    for s in (-1,1):
        zr=z+s*(w/2+.03)
        o.append(tube('selvedge rope',[(xs[i],ys[i]+.03,zr) for i in range(n+1)],.028,ROPE,sides=5))
    for end,px,knot in ((xa,left,left+.34),(xb,right,right-.34)):
        ky=2.02
        for k in range(7):
            zc=z-w/2+w*k/6
            o.append(strut('clew rope',(end,curve(0)+.01,zc),(knot,ky,z),.03,ROPE))
        o.append(tube('hanging rope',[(knot,ky,z),((knot+px)/2,2.14,z),(px,2.3,z)],.035,ROPE,sides=5))
        o.append(ico('clew knot',knot,ky,z,.09,ROPE,.9,sub=1))
    return o

# ------------------------------------------------------------------ sun loungers
def lounger(x,towel=False):
    z=SUNBED_Z;o=[];deck=.425   # deck top matches the procedural mattress the .62 pose used
    for s in (-1,1):
        o.append(box('lounger rail',x+s*.46,deck-.06,z-.5,.07,.1,1.85,LOUNGER,T,0))
        for dz in (-1.3,.3):
            o.append(box('lounger leg',x+s*.42,deck/2-.02,z+dz,.07,deck-.04,.07,LOUNGER,T,0))
    for dz in (-1.3,.3):o.append(box('lounger stretcher',x,.12,z+dz,.86,.06,.06,LOUNGER,T,0))
    for i in range(8):o.append(box('deck slat',x,deck-.02,z-1.4+i*.245,.9,.05,.18,CUSHION,T,0))
    # backrest hinged at the seaward end, rising at 55 degrees and leaning out over +z
    A=.96;hz=z+.36;up,out=math.sin(A),math.cos(A)
    for i in range(4):
        r=.16+i*.245
        o.append(box('back slat',x,deck-.03+r*up,hz+r*out,.9,.05,.18,CUSHION,T,0,rx=-A))
    for s in (-1,1):
        o.append(box('back rail',x+s*.46,deck-.06+.48*up,hz+.48*out,.07,.1,1.05,LOUNGER,T,0,rx=-A))
        o.append(strut('back prop',(x+s*.42,deck-.1,hz-.02),(x+s*.42,deck-.08+.95*up,hz+.95*out),.06,LOUNGER))
    if towel:
        o.append(box('folded towel',x,deck+.05,z-.9,.7,.07,.46,TOWEL,T,.02))
        o.append(box('folded towel',x,deck+.11,z-.9,.66,.06,.42,CLOTH2,T,.02))
    return o

# ------------------------------------------------------------------ tables, chairs, parasols
def table(t):
    """Plank-top round table. Radius, top height and the centre leg match beach.ts."""
    x,z=t['x'],t['z'];big=len([c for c in SEATS if c['tableId']==t['id']])==9
    r=1.95 if big else 1.14;o=[]
    o.append(cyl('table top',x,1.02,z,r,.16,TOP,T,verts=32))
    o.append(cyl('table rim',x,1.0,z,r+.035,.1,GROOVE,T,verts=32))
    for d in [k*.42 for k in range(-int(r/.42),int(r/.42)+1)]:
        half=math.sqrt(max(r*r-d*d,0))-.06
        if half>.1:o.append(box('plank groove',x,1.103,z+d,2*half,.012,.035,GROOVE,T,0))
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
    o=[cyl('parasol pole',x,2.0,z,.05,4.0,TIMBER,T,verts=10)]
    o.append(canopy('parasol canopy',x,z,2.58,4.38,3.58,[PARASOL,PARASOL2]))
    o.append(cyl('parasol hub',x,4.06,z,.1,.22,POST_D,T,verts=10))
    for k in range(8):
        a=2*math.pi*k/8
        o.append(strut('parasol rib',(x,4.0,z),(x+2.5*math.cos(a),3.6,z+2.5*math.sin(a)),.035,POST_D))
    o.append(cyl('parasol finial',x,4.5,z,.05,.2,POST_D,T,verts=6))
    return o

# ------------------------------------------------------------------ rocks and the fire ring

def fire_ring():
    x,z=FIRE;o=[cyl('fire pit ash',x,.05,z,.62,.08,ASH,T,verts=16)]
    for k in range(10):
        a=2*math.pi*k/10+RNG.uniform(-.1,.1)
        o.append(rock('ring stone',x+.62*math.cos(a),.12,z+.62*math.sin(a),.2+RNG.uniform(-.03,.04),STONE,.75,rough=.22,seed=k))
    for k in range(3):
        a=2*math.pi*k/3+.4
        o.append(tube('log',[(x+.55*math.cos(a),.12,z+.55*math.sin(a)),(x+.2*math.cos(a),.2,z+.2*math.sin(a)),(x-.12*math.cos(a),.32,z-.12*math.sin(a))],[.1,.09,.07],CHARRED,sides=7))
    for k in range(4):
        a=2*math.pi*k/4+1.6
        o.append(ico('ember',x+.2*math.cos(a),.13,z+.2*math.sin(a),.08,EMBER,.6,sub=1))
    return o

# ------------------------------------------------------------------ planting
def pandan(x,z,size=1.0,seed=0):
    """Pandan laut (Pandanus odoratissimus): stilt roots into a leaning trunk that forks into
    spiralling rosettes of long, drooping, keeled strap leaves."""
    R=random.Random(seed);o=[];lean=R.uniform(-.4,.4)
    top=(x+lean,1.7*size,z+R.uniform(-.3,.3))
    o.append(tube('pandan trunk',[(x,.55*size,z),((x+top[0])/2,1.1*size,(z+top[2])/2),top],[.1*size,.085*size,.07*size],POST,sides=7))
    for k in range(6):   # prop roots
        a=2*math.pi*k/6+R.uniform(-.2,.2);d=R.uniform(.45,.7)*size
        o.append(tube('pandan root',[(x+math.cos(a)*d,0,z+math.sin(a)*d),(x+math.cos(a)*d*.6,.35*size,z+math.sin(a)*d*.6),(x+math.cos(a)*.08,.7*size,z+math.sin(a)*.08)],[.035,.03,.03],POST,sides=5))
    heads=[top,(top[0]+.55*size,1.35*size,top[2]-.25),(top[0]-.45*size,1.25*size,top[2]+.3)]
    for hx,hy,hz in heads:
        if (hx,hy,hz)!=top:o.append(tube('pandan branch',[top,(hx,hy,hz)],.05*size,POST,sides=5))
        for i in range(14):   # one rosette of keeled leaves
            a=i*2.4+R.uniform(-.1,.1);L=R.uniform(.9,1.35)*size;rise=R.uniform(.25,.75);w=.075*size
            verts=[];faces=[]
            for s in range(6):
                t=s/5;r=L*t;y=hy+rise*t*1.4-(t**2)*L*.95
                cx,cz=hx+math.cos(a)*r,hz+math.sin(a)*r;nx,nz=-math.sin(a),math.cos(a);ww=w*(1-t*.85)
                verts+=[pt(cx+nx*ww,y,cz+nz*ww),pt(cx,y+.02,cz),pt(cx-nx*ww,y,cz-nz*ww)]
            for s in range(5):
                b=s*3;faces+=[(b,b+1,b+4,b+3),(b+1,b+2,b+5,b+4)]
            o.append(mesh('pandan leaf',verts,faces,LEAF_OLD if R.random()<.18 else LEAF))
    return o

def tapak_kuda(x,z,runners=5,seed=0):
    """Beach morning glory: runners creeping over the sand, bilobed leaves along them and a few
    purple trumpet flowers."""
    R=random.Random(seed);o=[];leaves=[];lf=[];blooms=[];bf=[]
    for k in range(runners):
        a=R.random()*6.28;L=R.uniform(1.6,3.2);pts=[];cx,cz=x,z
        for s in range(9):
            a+=R.uniform(-.35,.35);cx+=math.cos(a)*L/8;cz+=math.sin(a)*L/8;pts.append((cx,ground(cx,cz)+.015,cz))
        o.append(tube('vine runner',pts,.012,VINE,sides=4))
        for px,py,pz in pts[1:]:
            for side in (-1,1):
                la=a+side*R.uniform(.5,2.3);ln=R.uniform(.14,.26);up=R.uniform(.02,.1)
                px,pz=px+R.uniform(-.06,.06),pz+R.uniform(-.06,.06)
                ex,ez=px+math.cos(la)*ln,pz+math.sin(la)*ln;nx,nz=-math.sin(la)*ln*.55,math.cos(la)*ln*.55
                b=len(leaves)   # broad leaf folded along its midrib: stalk, two lobes, tip
                leaves+=[pt(px,py,pz),pt(px+(ex-px)*.45+nx,py+up,pz+(ez-pz)*.45+nz),pt(ex,py+up*1.2,ez),pt(px+(ex-px)*.45-nx,py+up,pz+(ez-pz)*.45-nz)]
                lf+=[(b,b+1,b+2),(b,b+2,b+3)]
            if R.random()<.22:
                b=len(blooms);r=.06;fy=py+.06
                blooms.append(pt(px,py,pz))
                for q in range(5):blooms.append(pt(px+math.cos(q*1.256)*r,fy,pz+math.sin(q*1.256)*r))
                bf+=[(b,b+1+q,b+1+(q+1)%5) for q in range(5)]
    o.append(mesh('tapak kuda leaves',leaves,lf,VINE))
    if blooms:o.append(mesh('tapak kuda flowers',blooms,bf,BLOOM,smooth=False))
    return o

def grass_tuft(x,z,seed=0):
    R=random.Random(seed);verts=[];faces=[];y0=ground(x,z)
    for k in range(14):
        a=R.random()*6.28;h=R.uniform(.25,.55);lean=R.uniform(.05,.25);w=.012
        bx,bz=x+R.uniform(-.08,.08),z+R.uniform(-.08,.08);nx,nz=-math.sin(a)*w,math.cos(a)*w;b=len(verts)
        verts+=[pt(bx+nx,y0,bz+nz),pt(bx-nx,y0,bz-nz),pt(bx+math.cos(a)*lean*.5,y0+h*.6,bz+math.sin(a)*lean*.5),pt(bx+math.cos(a)*lean,y0+h,bz+math.sin(a)*lean)]
        faces+=[(b,b+1,b+2),(b,b+2,b+3)]
    return mesh('beach grass',verts,faces,GRASS)

def frond(x,z,yaw,length=3.2,seed=0):
    """A fallen, dried coconut frond lying on the sand: curved rachis, drooping leaflets."""
    R=random.Random(seed);o=[];pts=[]
    for s in range(8):
        t=s/7;px,pz=x+math.cos(yaw)*length*t,z+math.sin(yaw)*length*t
        pts.append((px,ground(px,pz)+.05*math.sin(t*3.1)+.02,pz))
    o.append(tube('frond rachis',pts,[.04*(1-s/9) for s in range(8)],FROND,sides=4))
    verts=[];faces=[]
    for s in range(1,8):
        px,py,pz=pts[s];L=.55*(1-abs(s/7-.45))+.15
        for side in (-1,1):
            a=yaw+side*R.uniform(.9,1.3);ex,ez=px+math.cos(a)*L,pz+math.sin(a)*L;b=len(verts)
            verts+=[pt(px,py,pz),pt(ex,ground(ex,ez)+.012,ez),pt(px+math.cos(yaw)*.1,py,pz+math.sin(yaw)*.1)]
            faces.append((b,b+1,b+2))
    o.append(mesh('frond leaflets',verts,faces,FROND));return o

def coconut_palm(x,z,height,lean,seed=0):
    """Cocos nucifera as it grows on a beach: a swollen bole, a slender ringed trunk bowing toward
    the light over the sea, a crown of arching pinnate fronds (young ones upright, old ones yellowed
    and drooping, dead ones hanging against the trunk) and a bunch of nuts beneath."""
    R=random.Random(seed*7+1);o=[];heading=math.pi/2+R.uniform(-.6,.6)   # +z is the sea
    dx,dz=math.cos(heading),math.sin(heading);pts=[];rs=[]
    for s in range(11):
        t=s/10;bow=lean*height*(t**1.6)
        pts.append((x+dx*bow,height*t,z+dz*bow));rs.append(.2*(1-t)*.45+.13+.1*max(0,.15-t)/.15)
    o.append(tube('palm trunk',pts,rs,PALM_TRUNK,sides=9))
    top=Vector(pts[-1]);tip=(top-Vector(pts[-2])).normalized()
    o.append(tube('palm crown shaft',[pts[-1],tuple(top+tip*.45)],[.15,.11],FROND_OLD,sides=7))
    crown=top+tip*.35
    for k in range(9):   # nuts clustered under the crown
        a=k*2.4;r=.26+.06*(k%2);ny=crown.y-.25-.12*(k%3)
        o.append(ico('palm coconut',crown.x+math.cos(a)*r,ny,crown.z+math.sin(a)*r,.13,NUT if k%3 else HUSK,.95,sub=1))
    leaves={FROND_NEW:([],[]),FROND_MID:([],[]),FROND_OLD:([],[]),FROND_DEAD:([],[])}
    fronds=15
    for f in range(fronds):
        age=f/(fronds-1)                                   # 0 young and upright .. 1 old and drooping
        a=f*2.39996+R.uniform(-.15,.15);hx,hz=math.cos(a),math.sin(a)
        elev=math.radians(55-95*age+R.uniform(-8,8));L=R.uniform(3.2,4.1)*(1-.15*abs(age-.45))
        m=FROND_NEW if age<.2 else FROND_OLD if age>.85 else FROND_MID
        dead=f>=fronds-2
        if dead:m=FROND_DEAD;elev=math.radians(-72);L*=.8
        rachis=[]
        for s in range(9):
            t=s/8;d=L*t;drop=(.9 if not dead else .1)*L*t*t*(.35+.65*age)
            rachis.append(crown+Vector((hx*d*math.cos(elev),d*math.sin(elev)-drop,hz*d*math.cos(elev))))
        verts,faces=leaves[m]
        # the rachis itself, as a thin two-sided ribbon
        for s in range(8):
            b=len(verts);p0,p1=rachis[s],rachis[s+1];w=.035*(1-s/8)
            side=Vector((-hz,0,hx))*w
            verts+=[p0+side,p0-side,p1-side,p1+side];faces.append((b,b+1,b+2,b+3))
        pairs=22
        for q in range(pairs):
            t=.12+.86*q/(pairs-1);si=min(int(t*8),7);u=t*8-si;base=rachis[si].lerp(rachis[si+1],u)
            along=(rachis[si+1]-rachis[si]).normalized();across=Vector((-hz,0,hx))
            ll=(.35+.75*math.sin(math.pi*min(1,t*1.05)))*(.55 if dead else 1)
            for sgn in (-1,1):
                hang=math.radians(35+25*age+R.uniform(-6,6)) if not dead else math.radians(80)
                dirv=(across*sgn*math.cos(hang)+Vector((0,-1,0))*math.sin(hang)+along*.45).normalized()
                tipp=base+dirv*ll;wv=along*.045
                b=len(verts);verts+=[base-wv,base+wv,base.lerp(tipp,.55)+wv*.8+Vector((0,-.04,0)),tipp]
                faces+=[(b,b+1,b+2),(b,b+2,b+3)]
    for m,(verts,faces) in leaves.items():
        if faces:o.append(mesh('palm fronds',[tuple((v.x,-v.z,v.y)) for v in verts],faces,m))
    return o

def driftwood(x,z,yaw,length,seed=0):
    R=random.Random(seed);pts=[];rs=[]
    for s in range(6):
        t=s/5;px,pz=x+math.cos(yaw)*length*t+math.sin(yaw)*.25*math.sin(t*2.5),z+math.sin(yaw)*length*t
        pts.append((px,ground(px,pz)+.1-.02*t,pz));rs.append((.13-.05*t)*R.uniform(.9,1.1))
    mid=pts[2]
    return [tube('driftwood log',pts,rs,DRIFT,sides=8),
            tube('driftwood branch',[mid,(mid[0]+.4,mid[1]+.18,mid[2]-.35),(mid[0]+.75,mid[1]+.22,mid[2]-.5)],[.06,.04,.025],DRIFT,sides=5)]

def dressing():
    o=[];R=random.Random(5)
    for i,(x,z,s) in enumerate([(92.3,137.6,1.0),(154.6,136.2,1.15),(152.9,131.9,.8)]):o+=pandan(x,z,s,seed=i+3)
    for x,z in [(104.5,131.3),(116,131.6),(129,131.2),(145,131.8),(151,134.6),(96.5,131.1),(155,145)]:
        o+=tapak_kuda(x,z,seed=int(x*z)%97)
    placed=0
    for _ in range(400):
        if placed>=34:break
        x,z=R.uniform(WEST+1,EAST-.5),R.uniform(130.8,134.2) if R.random()<.8 else R.uniform(134,150)
        if (z<134 or x<93 or x>151) and clear(x,z,.3):o.append(grass_tuft(x,z,seed=placed));placed+=1
    # granite boulders at both ends, half buried and running out under the water
    for i,(x,z,r,sq) in enumerate([(154.3,151.6,1.25,.62),(156.1,153.9,1.9,.7),(153.2,155.6,.9,.6),(157.4,150.3,.8,.7),(151.9,153.2,.45,.6),
                                    (90.2,153.1,1.4,.62),(92.6,155.4,.95,.6),(88.6,151.2,.7,.66)]):
        o.append(rock('granite boulder',x,ground(x,z)-r*sq*.28,z,r,GRANITE,sq,sub=3,seed=i))
    # the wrack line: driftwood, dry fronds, husks, seaweed and shells where the tide turned
    for i,(x,z,yaw,L) in enumerate([(113.5,150.2,.15,2.6),(135.6,150.0,-.2,1.9),(92.6,149.8,.4,2.2)]):
        o+=driftwood(x,z,yaw,L,seed=i)
    for i,(x,z,yaw) in enumerate([(97.2,143.1,2.4),(150.1,135.8,4.0),(152.1,142.6,1.9)]):o+=frond(x,z,yaw,seed=i)
    husks=0
    for _ in range(600):
        if husks>=14:break
        x,z=R.uniform(WEST+2,EAST-1),R.uniform(149.6,150.8) if R.random()<.6 else R.uniform(139,149)
        if clear(x,z,.3):
            husks+=1;h=ico('coconut husk',x,ground(x,z)+.1,z,.17,HUSK,.72);h.scale=(1.35,1,1);h.rotation_euler.z=R.random()*6.28
    kelp=[];kf=[];shells=[];sf=[];shells2=[];sf2=[]
    for _ in range(900):
        x,z=R.uniform(WEST+1,EAST-1),150.0+R.gauss(0,.28)
        if not clear(x,z,.1):continue
        if len(kf)<150 and R.random()<.5:   # seaweed lies in tangled clumps, not single strands
            for strand in range(5):
                a=R.random()*6.28;L=R.uniform(.2,.5);b=len(kelp);cx,cz=x+R.uniform(-.2,.2),z+R.uniform(-.15,.15);y=ground(cx,cz)+.006
                for s in range(4):
                    t=s/3;bend=a+math.sin(t*4+strand)*.6;px,pz=cx+math.cos(bend)*L*t,cz+math.sin(bend)*L*t;w=.045*(1-t*.5);nx,nz=-math.sin(bend)*w,math.cos(bend)*w
                    kelp+=[pt(px+nx,y+.004*s,pz+nz),pt(px-nx,y+.004*s,pz-nz)]
                kf+=[(b+2*s,b+2*s+1,b+2*s+3,b+2*s+2) for s in range(3)]
        if len(sf)+len(sf2)<150:
            r=R.uniform(.03,.06);y=ground(x,z);a=R.random()*6.28
            tgt,tf=(shells,sf) if R.random()<.7 else (shells2,sf2);b=len(tgt)
            tgt+=[pt(x+math.cos(a)*r,y,z+math.sin(a)*r),pt(x+math.cos(a+2.1)*r,y,z+math.sin(a+2.1)*r),pt(x+math.cos(a+4.2)*r,y,z+math.sin(a+4.2)*r),pt(x,y+r*.7,z)]
            tf+=[(b,b+1,b+3),(b+1,b+2,b+3),(b+2,b,b+3)]
    o.append(mesh('seaweed',kelp,kf,KELP))
    o.append(mesh('shells',shells,sf,SHELL,smooth=False,closed=True));o.append(mesh('shells pink',shells2,sf2,SHELL2,smooth=False,closed=True))
    for i,(px,pz,h,lean) in enumerate(PALMS):o+=coconut_palm(px,pz,h,lean,seed=i)
    for px,pz,_,_ in PALMS:   # nuts dropped under each palm
        for k in range(3):
            a=R.random()*6.28;d=R.uniform(.9,1.8);x,z=px+math.cos(a)*d,pz+math.sin(a)*d
            o.append(ico('fallen coconut',x,ground(x,z)+.15,z,.19,HUSK if k else NUT,.85,sub=1))
    # the red no-swimming flag by the east rocks, as on every Malaysian public beach
    o.append(cyl('flag pole',155.2,2.1,149.2,.04,4.2,METAL,T,verts=8))
    wave=[(155.24+i*.18,3.95-.02*math.sin(i*1.3)) for i in range(7)]
    cloth=wave+[(px,py-.75) for px,py in wave[::-1]]
    o.append(loft('warning flag',[(149.19,cloth),(149.21,cloth)],FLAG,T))
    return o

# ------------------------------------------------------------------ build / export
def props():
    o=terrain()+boardwalk()+promenade()+stall()+fire_ring()+dressing()
    for x in LAMPS:o+=lamp(x)
    for x,z in HAMMOCKS:o+=hammock(x,z)
    for i,x in enumerate(SUNBEDS):o+=lounger(x,towel=i==1)
    for t in PANTAI:
        o+=table(t)
        if len([c for c in SEATS if c['tableId']==t['id']])==4:o+=parasol(t['x'],t['z'])
    for seat in SEATS:o+=chair(seat)
    return [p for p in o if p]

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    for ob in props():
        ob.parent=e
        if not ob.get('terrain'):uv_metres(ob)
    return e

def runtime_textures():
    """Water normal and foam lace for the procedural sea in src/beach.ts."""
    for name,arr in (('water-normal',TX.water_normal()),('foam',np.stack([TX.foam()]*3,-1))):
        h,w=arr.shape[:2];im=bpy.data.images.new(name,w,h);im.colorspace_settings.name='Non-Color'
        im.pixels.foreach_set(np.flipud(np.concatenate([arr,np.ones((h,w,1))],-1)).astype(np.float32).ravel())
        im.file_format='WEBP';im.save(filepath=str(RUNTIME/f'{name}.webp'),quality=90)

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:
        key=tuple(m.name for m in ob.data.materials)+(('terrain',) if ob.get('terrain') else ())
        batches.setdefault(key,[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,'beach | sand terrain' if 'terrain' in key else f'beach | {" + ".join(key)}')
        if not any('tile' in m for m in j.data.materials if m):
            for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Beach.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
        export_image_format='WEBP',export_image_quality=82,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_Beach','origin':[0,0,0],'shore':{'sandY':SAND_Y,'foreshore':[FORE0,FORE1],'nearY':NEAR_Y,'seaY':SEA_Y},
        'props':['sand terrain to z 180','boardwalk','kelapa stall','2 rope hammocks','4 tables',f'{len(SEATS)} chairs','2 parasols',
        '3 loungers','fire ring','promenade sign frame','2 lamp posts','3 pandan laut','7 tapak kuda patches','beach grass',
        '8 granite boulders','driftwood, fronds, husks, seaweed and shells','no-swimming flag'],
        'textures':sorted(kit.IMAGES),'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('BEACH WEB EXPORT',json.dumps(report),flush=True)

if __name__=='__main__':
    e=build();export(e);runtime_textures()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'beach.blend'))
