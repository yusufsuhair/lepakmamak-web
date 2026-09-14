"""Wet Deck · Sky Dining, the rooftop venue on the hotel at (-106,44,37), photographic pass: an
infinity-edge pool in 25 mm glass mosaic that spills over a knife edge into a catch gutter on the
KLCC side, teak decking with travertine coping, sun loungers under two fabric cabanas, a frameless
glass balustrade with brushed steel caps and a warm LED cove, a walnut bar with a backlit onyx back
bar and three shelves of bottles, planters, the navy lounge with its blue hanging strands, the
rooftop lift vestibule and the street-level lift lobby.

Night (src/sky-dining.ts): materials whose names end in 'glow' light at night only; 'Strand' and
'Backlit' materials glow a little by day and fully at night; the pool mosaic picks up underwater
light and moving caustics. The water surface itself stays procedural in the runtime.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_skydining.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_SkyDining.glb

Output: public/assets/models/environment/LM_ENV_SkyDining.glb, node 'skydining' with a child node
'ceiling' (lounge roof, ribs, ribbons, downlights) that the runtime hides while you are up there,
the way the procedural roof was hidden. Coordinates are game metres local to the SKY root (deck top
y=0, street y=-44).

Load bearing, copied from src/sky-dining.ts and shared/: the four deck slab footprints that leave
the basin void at x -10..10, z -14..-6 (swimmers stay visible), the pool at x -9..9 z -14..-6,
balustrade lines x=+-17.7 and z=+-15.7, bar (0,3) 12.5 x 2.8, planters at (+-16, -14 | -5), DJ desk
(-14,5.5), vestibule back wall z=13.4 at x=14, the street lobby under the WET DECK sign at
(12,-44,20), and every table and chair from shared/tables.json and shared/chairs.json.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,sweep,join
import pbr_kit as kit
from pbr_kit import pbr,uv_metres,mesh,ico
import landmark_textures as LX

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/skydining'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
T='skydining'
kit.setup(T,OUT/'textures',20260915)
STREET=-44.0   # local y of the city pavement
WATER=-.12     # still water line; the north knife edge sits exactly here
FLOOR=-1.675   # basin floor, where the procedural basin top was

def metal(m,v):
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=v;return m
TEAK=pbr('Deck teak','teak','#ffffff',.62,2.0,source=LX)
TRAV=pbr('Travertine','travertine','#ffffff',.45,1.2,source=LX)
MOSAIC=pbr('Pool mosaic','mosaic','#ffffff',.2,.5,source=LX)
CROWN=pbr('Crown concrete','concrete','#7a818a',.8,3.0,source=LX)
INOX=metal(pbr('Brushed steel','brushed','#ffffff',.3,1.0,source=LX),.75)
WALNUT=pbr('Walnut joinery','wood','#5d3d29',.45,.9)
NAVY=pbr('Upholstery navy','fabric','#27365c',.9,.35)
ACCENT=pbr('Cushion magenta','fabric','#b8508e',.88,.35)
CANVAS=pbr('Cabana canvas','fabric','#f3eee4',.85,.5,two_sided=True)
CURTAIN=metal(kit.hmat('Crown curtain wall','#1d2c3a',.12),.35)
GLASS=mat('Balustrade glass',kit.srgb('#b9d6de'),.04,alpha=.2,two_sided=True)
DARK=kit.hmat('Dark metal','#1a1b20',.5)
WALL=kit.hmat('Lounge navy','#151c30',.78)
RIB=kit.hmat('Ceiling rib','#dcd6d0',.5)
LEAF=kit.hmat('Planter leaf','#3f6e3d',.6,two_sided=True)
LEAF2=LEAF
BOTTLE_A=kit.hmat('Bottle amber','#b77a2c',.12)
BOTTLE_G=kit.hmat('Bottle green','#4a8a70',.12)
WARM=mat('Warm glow',kit.srgb('#ffd29a'),.4,emit=2.2)          # night only
POOL_LIGHT=mat('Pool light glow',kit.srgb('#9eeaff'),.3,emit=3.0)
def backlit(name,tint,strength):
    """Stone lit from behind: the travertine drawing drives the emission, so the veins show."""
    m=pbr(name,'travertine',tint,.35,1.2,source=LX);nt=m.node_tree;p=nt.nodes['Principled BSDF']
    tex=next(n for n in nt.nodes if n.type=='TEX_IMAGE' and n.image.name.endswith('_color'))
    nt.links.new(tex.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=strength
    return m
BACKLIT=backlit('Backlit onyx','#ffc98c',1.4)   # dim by day
BLUE=mat('Strand blue',kit.srgb('#3a86ff'),.3,emit=1.6)
PINK=mat('Strand magenta',kit.srgb('#e040ff'),.3,emit=1.4)

CEILING=[]   # objects that belong to the hideable 'ceiling' node

def rbox(name,cx,cz,yaw,lx,y,lz,w,h,d,m,bev=0,rx=0):
    """Box at (lx,y,lz) inside a group standing at (cx,cz) turned by game yaw."""
    s,c=math.sin(yaw),math.cos(yaw)
    o=box(name,cx+lx*c+lz*s,y,cz-lx*s+lz*c,w,h,d,m,T,bev,rx);o.rotation_euler.z=yaw;return o

def quad(name,corners,m):
    return mesh(name,[pt(*c) for c in corners],[(0,1,2,3)],m,smooth=False)

def blade(name,x,y,z,yaw,length,width,lean,m,n=4):
    """A strap leaf: a two-sided ribbon rising from (x,y,z) and arching outward along yaw."""
    out=(math.sin(yaw),math.cos(yaw));side=(math.cos(yaw),-math.sin(yaw));verts=[];faces=[]
    px,py,ds=0.0,0.0,length/n
    for i in range(n+1):
        t=i/n;w=width*math.sin(math.pi*(.12+.8*t))*(1-.7*t)
        cx,cz=x+out[0]*px,z+out[1]*px
        verts+=[pt(cx-side[0]*w/2,y+py,cz-side[1]*w/2),pt(cx+side[0]*w/2,y+py,cz+side[1]*w/2)]
        a=lean*(t+.5/n)*1.4;px+=math.sin(a)*ds;py+=math.cos(a)*ds
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(n)]
    return mesh(name,verts,faces,m,smooth=True)

def arc_band(cx,cy,rx,ry,band,n=16):
    """Half-arc band profile in (x,y): outer arc springing at cy, then back inside."""
    outer=[(cx+rx*math.cos(math.pi*i/n),cy+ry*math.sin(math.pi*i/n)) for i in range(n+1)]
    inner=[(cx+(rx-band)*math.cos(math.pi*i/n),cy+(ry-band)*math.sin(math.pi*i/n)) for i in range(n+1)]
    return outer+inner[::-1]

# ---------------------------------------------------------------- hotel crown + deck
def crown():
    o=[]
    o.append(box('crown mass',0,-4.1,0,33.6,3.8,29.6,CROWN,T,0))
    for y in (-5.1,-3.3):
        o.append(box('crown glazing',0,y,0,34,1.1,30,CURTAIN,T,0))
    o.append(box('crown cornice',0,-2.1,0,35.2,.2,31.2,CROWN,T,0))
    # the deck edge band closes the gap between the crown and the slabs, so the basin never shows
    for s in (-1,1):
        o.append(box('deck band',s*17.85,-1.2,0,.3,1.8,32,CROWN,T,0))
        o.append(box('deck band',0,-1.2,s*15.85,35.4,1.8,.3,CROWN,T,0))
        o.append(box('band light glow',s*18.02,-.9,0,.03,.04,31.6,WARM,T,0))
        o.append(box('band light glow',0,-.9,s*16.02,35.6,.04,.03,WARM,T,0))
    return o

def deck():
    """The four verbatim slabs, teak outdoors, travertine inside the lounge and round the pool."""
    o=[]
    for i,(x,z,w,d) in enumerate(((0,5,36,22),(-14,-10,8,8),(14,-10,8,8))):
        o.append(box(f'deck slab {i}',x,-.33,z,w,.54,d,CROWN,T,0))
    # north slab: travertine walk behind the catch gutter that runs along the knife edge
    o.append(box('north slab',0,-.33,-15.3,36,.54,1.4,CROWN,T,0))
    for s in (-1,1):o.append(box('north slab',s*13.5,-.33,-14.3,9,.54,.6,CROWN,T,0))
    o.append(box('north walk',0,-.02,-15.3,36,.04,1.4,TRAV,T,0))
    for s in (-1,1):o.append(box('north walk',s*13.5,-.02,-14.3,9,.04,.6,TRAV,T,0))
    o.append(box('gutter floor',0,-.52,-14.3,18,.06,.5,MOSAIC,T,0))
    o.append(box('gutter back',0,-.28,-14.58,18,.52,.06,MOSAIC,T,0))
    # the north basin wall rises from the floor to the still-water line: the knife edge
    o.append(box('knife edge',0,(WATER+FLOOR-.04)/2,-14.05,18.2,WATER-FLOOR+.04,.1,MOSAIC,T,0))
    # teak outdoors: south of the lounge front and over the two wings
    o.append(box('deck teak',0,-.02,-1.8,36,.04,8.4,TEAK,T,0))
    for s in (-1,1):o.append(box('deck teak',s*14.5,-.02,-10,7,.04,8,TEAK,T,0))
    o.append(box('lounge floor',0,-.02,9.2,36,.04,13.6,TRAV,T,0))
    # coping: flush travertine lips on the three deck-level sides of the basin
    for s in (-1,1):o.append(box('pool coping',s*9.5,-.015,-10,1.0,.05,8,TRAV,T,0))
    for s in (-1,1):o.append(box('pool coping',s*5.95,-.015,-5.7,8.1,.05,.6,TRAV,T,0))
    # recessed warm LED dots along the coping
    for s in (-1,1):
        for z in (-13,-11,-9,-7):o.append(box('coping light glow',s*9.9,.012,z,.06,.01,.06,WARM,T,0))
    return o

def basin():
    """Mosaic basin under the procedural water: floor, tiled walls, the broad steps and lights."""
    o=[]
    o.append(box('basin floor',0,FLOOR-.06,-10,18,.12,8,MOSAIC,T,0))
    for s in (-1,1):o.append(box('basin wall',s*9.05,(FLOOR-.04)/2,-10,.1,-FLOOR+.04,8,MOSAIC,T,0))
    for s in (-1,1):o.append(box('basin wall',s*5.95,(FLOOR-.04)/2,-6.05,8.1,-FLOOR+.04,.1,MOSAIC,T,0))
    for i in range(4):
        y=-i*.34-.01;z=-6.05-i*.65
        o.append(box('pool tread',0,y-.17,z+.1,3.8,.34,.85,MOSAIC,T,0))
        o.append(box('tread nosing',0,y-.012,z-.3,3.8,.024,.05,INOX,T,0))
    for s in (-1,1):
        for z in (-12.4,-9.6):o.append(cyl('pool lamp glow',s*8.98,-.9,z,.13,.03,POOL_LIGHT,T,axis='x',verts=12))
    for x in (-6,6):o.append(cyl('pool lamp glow',x,-.9,-6.08,.13,.03,POOL_LIGHT,T,axis='z',verts=12))
    return o

def balustrade():
    """Frameless glass on all four collider lines, brushed steel caps and shoes, LED cove."""
    o=[]
    def run(axis,fixed,a0,a1):
        n=max(1,round((a1-a0)/1.8));step=(a1-a0)/n
        for i in range(n):
            c=a0+(i+.5)*step
            if axis=='z':o.append(box('balustrade glass',fixed,.72,c,.024,1.2,step-.025,GLASS,T,0))
            else:o.append(box('balustrade glass',c,.72,fixed,step-.025,1.2,.024,GLASS,T,0))
        mid=(a0+a1)/2;L=a1-a0
        dims=lambda w,h,t:(t,h,L) if axis=='z' else (L,h,t)
        at=lambda y:(fixed,y,mid) if axis=='z' else (mid,y,fixed)
        o.append(box('glass cap',*at(1.345),*dims(0,.05,.07),INOX,T,.01))
        o.append(box('glass shoe',*at(.07),*dims(0,.14,.12),INOX,T,0))
        inward=-.1 if fixed>0 else .1
        x,y,z=at(.015)
        o.append(box('cove glow',x+(inward if axis=='z' else 0),y,z+(inward if axis=='x' else 0),*dims(0,.02,.03),WARM,T,0))
    for s in (-1,1):
        run('z',s*17.7,-16,16)
        run('x',s*15.7,-18,18)
    return o

# ---------------------------------------------------------------- pool deck furniture
def lounger(x):
    """Teak lounger facing the pool: feet at z -5.25, backrest raised toward the lounge."""
    o=[];z0,z1=-5.3,-3.4;A=math.radians(42)
    for s in (-1,1):
        o.append(box('lounger rail',x+s*.33,.3,(z0+z1)/2,.06,.08,z1-z0,TEAK,T,0))
        for z in (z0+.1,z1-.1):o.append(box('lounger leg',x+s*.3,.14,z,.06,.28,.06,INOX,T,0))
    for i in range(9):o.append(box('lounger slat',x,.35,z0+.08+i*.14,.64,.03,.1,TEAK,T,0))
    o.append(box('lounger cushion',x,.41,z0+.66,.62,.08,1.26,CANVAS,T,0))
    hz=z0+1.3;up,out=math.sin(A),math.cos(A)
    o.append(box('lounger back',x,.37+.36*up,hz+.36*out,.64,.06,.72,TEAK,T,0,rx=-A))
    o.append(box('back cushion',x,.43+.36*up,hz+.33*out,.6,.07,.68,CANVAS,T,.02,rx=-A))
    o.append(box('folded towel',x,.47,z0+.35,.5,.05,.34,ACCENT,T,0))
    return o

def cabana(cx):
    """Four teak posts, a pitched canvas roof with valances, drapes tied back at each post."""
    o=[];x0,x1,z0,z1=cx-2.0,cx+2.0,-5.75,-2.85;top=2.6
    for x in (x0,x1):
        for z in (z0,z1):
            o.append(box('cabana post',x,top/2,z,.1,top,.1,TEAK,T,0))
            # drape: a canvas ribbon hung inside the post, gathered at the tie-back, flaring head and foot
            ix=.07 if x==x0 else -.07;dz=1 if z==z0 else -1
            prof=[(top-.05,.28),(1.2,.06),(.04,.22)]
            ribbon=[pt(x+ix,y,z+dz*.05) for y,_ in prof]+[pt(x+ix,y,z+dz*(.05+w)) for y,w in prof]
            o.append(mesh('cabana drape',ribbon,[(0,1,4,3),(1,2,5,4)],CANVAS,smooth=True))
    for z in (z0,z1):o.append(box('cabana beam',cx,top,z,4.1,.12,.1,TEAK,T,0))
    for x in (x0,x1):o.append(box('cabana beam',x,top,(z0+z1)/2,.1,.12,3.0,TEAK,T,.01))
    ridge=top+.55;e=.18
    for s in (-1,1):
        zo=z0-e if s<0 else z1+e;zm=(z0+z1)/2
        o.append(quad('cabana roof',[(x0-e,top+.02,zo),(x1+e,top+.02,zo),(x1+e,ridge,zm),(x0-e,ridge,zm)],CANVAS))
        o.append(quad('cabana valance',[(x0-e,top+.02,zo),(x1+e,top+.02,zo),(x1+e,top-.26,zo),(x0-e,top-.26,zo)],CANVAS))
    for x in (x0-e,x1+e):
        o.append(mesh('cabana gable',[pt(x,top+.02,z0-e),pt(x,top+.02,z1+e),pt(x,ridge,(z0+z1)/2)],[(0,1,2)],CANVAS,smooth=False))
    o.append(box('cabana ridge',cx,ridge+.02,(z0+z1)/2,4.4,.06,.06,TEAK,T,0))
    return o

def planters():
    o=[]
    for x in (-16,16):
        for z in (-14,-5):
            o.append(box('planter',x,.45,z,1.25,.9,1.25,CROWN,T,0))
            o.append(box('planter rim',x,.92,z,1.33,.06,1.33,TRAV,T,0))
            o.append(box('planter soil',x,.88,z,1.12,.04,1.12,DARK,T,0))
            for j in range(12):
                a=j*2.39996
                o.append(blade('planter leaf',x+math.cos(a)*.12,.9,z+math.sin(a)*.12,a,.95+.35*((j*7)%5)/4,.2,.45+.5*((j*3)%4)/3,LEAF))
            for j in range(4):
                a=j*1.57+.6
                o.append(ico('planter shrub',x+math.cos(a)*.38,1.02,z+math.sin(a)*.38,.2,LEAF2,.8,sub=1))
            o.append(box('planter uplight glow',x+(.7 if x<0 else -.7),.02,z,.08,.02,.08,WARM,T,0))
    return o

# ---------------------------------------------------------------- lounge shell
def lounge():
    o=[]
    o.append(box('back wall',0,2.6,15.5,36,5.2,.15,WALL,T,0))
    for j in range(18):o.append(box('wall fluting',-17+j*2.0,2.6,15.4,1.2,5.0,.06,WALNUT,T,0))
    o.append(box('sign panel',0,3.7,15.32,15.4,1.9,.08,DARK,T,0))
    o.append(box('sign shelf glow',0,2.7,15.24,15.4,.04,.2,WARM,T,0))
    for s in (-1,1):
        o.append(box('lounge glass',s*17.5,2.6,9,.05,5.2,13,GLASS,T,0))
        for z in (2.6,5.4,9,12.6,15.4):o.append(box('lounge mullion',s*17.5,2.6,z,.1,5.2,.1,INOX,T,0))
        o.append(box('lounge sill',s*17.5,.06,9,.14,.12,13,INOX,T,0))
    # hanging strands in front of the back wall, the venue's signature curtain
    o.append(box('strand track',0,5.08,15.25,35,.08,.12,DARK,T,0))
    for i in range(52):
        x=-17+i*34/51;h=2.3+.4*math.sin(i*.9)
        o.append(box('strand',x,5.04-h/2,15.25,.03,h,.03,PINK if i%3==0 else BLUE,T,0))
    for x in (-16,-8,8,16):
        o.append(cyl('column',x,2.6,3,.12,5.2,RIB,T,verts=12))
        o.append(cyl('column base',x,.06,3,.2,.12,INOX,T,verts=12))
    return o

def ceiling():
    """The lounge roof and everything on its underside: hidden by the runtime while visiting."""
    o=[]
    o.append(box('lounge roof',0,5.42,9,36,.26,14,CROWN,T,0))
    o.append(box('roof coping',0,5.58,2.1,36.2,.08,.3,INOX,T,0))
    o.append(box('back soffit',0,5.18,14.5,35,.22,2.2,WALL,T,0))
    o.append(box('soffit cove glow',0,5.02,13.44,34.6,.04,.1,WARM,T,0))
    for z in (4.0,9.0,14.0):
        o.append(sweep('ceiling rib',arc_band(0,4.9,17.1,.34,.16),z-.08,z+.08,RIB,T))
    for z in (5.6,8.0,10.4,12.8):
        o.append(sweep('ceiling ribbon',arc_band(0,4.86,16.9,.32,.1),z-.05,z+.05,BLUE,T))
    for s in (-1,1):o.append(box('ceiling valance',s*17.2,5.0,9,.3,.38,13.2,WALL,T,0))
    o.append(box('front fascia',0,5.1,2.35,35.6,.36,.22,WALL,T,0))
    o.append(box('front cove glow',0,4.9,2.46,35,.04,.1,WARM,T,0))
    for x in (-13,-8.7,-4.3,4.3,8.7,13):
        for z in (6.2,11.2):o.append(cyl('downlight glow',x,5.29,z,.1,.02,WARM,T,verts=10))
    for ob in o:CEILING.append(ob)
    return o

def bar():
    """Walnut counter at z=3 facing the lounge, backlit onyx back bar on the pool side of it."""
    o=[]
    o.append(box('bar body',0,.62,3,12,1.1,2.4,WALNUT,T,0))
    for j in range(47):o.append(box('bar fluting',-5.75+j*.25,.62,4.22,.12,1.0,.05,WALNUT,T,0))
    o.append(box('bar top',0,1.23,3,12.5,.1,2.8,TRAV,T,0))
    o.append(box('bar under glow',0,1.14,4.35,12.2,.03,.04,WARM,T,0))
    o.append(box('bar plinth',0,.05,3,12.1,.1,2.5,INOX,T,0))
    o.append(cyl('foot rail',0,.26,4.62,.03,11.8,INOX,T,axis='x',verts=8))
    for j in range(9):
        x=-5+j*1.25
        m=(BOTTLE_A,BOTTLE_G)[j%2]
        o.append(cyl('counter bottle',x+.2,1.44,2.6,.045,.32,m,T,verts=8))
        o.append(cyl('bottle neck',x+.2,1.66,2.6,.016,.12,m,T,verts=6))
        o.append(cyl('stool seat',x,.78,5.3,.21,.08,NAVY,T,verts=14))
        o.append(cyl('stool column',x,.4,5.3,.03,.76,INOX,T,verts=8))
        o.append(cyl('stool ring',x,.3,5.3,.17,.02,INOX,T,verts=14))
        o.append(cyl('stool foot',x,.015,5.3,.2,.03,INOX,T,verts=14))
    # back bar: walnut base cabinet, backlit onyx panel, three glass shelves of bottles
    o.append(box('back bar base',0,.45,1.35,12,.9,.5,WALNUT,T,0))
    o.append(box('back bar counter',0,.93,1.35,12.2,.06,.6,TRAV,T,0))
    o.append(box('backlit onyx',0,2.05,1.16,11.6,2.1,.02,BACKLIT,T,0))
    o.append(box('back bar rear',0,2.05,1.1,12,2.3,.06,WALNUT,T,0))
    for y in (.98,3.14):o.append(box('back bar frame',0,y,1.12,12,.1,.08,DARK,T,0))
    for x in (-5.85,5.85):o.append(box('back bar frame',x,2.05,1.12,.2,2.3,.08,DARK,T,0))
    for k,y in enumerate((1.4,1.95,2.5)):
        o.append(box('back bar shelf',0,y,1.3,11.4,.03,.3,INOX,T,0))
        for j in range(14):
            x=-5.3+j*.815;h=.26+.08*((j*7+k*3)%3)
            m=(BOTTLE_A,BOTTLE_G)[(j+k)%2]
            o.append(cyl('shelf bottle',x,y+.015+h/2,1.3,.045,h,m,T,verts=8))
            o.append(cyl('bottle neck',x,y+.015+h+.05,1.3,.015,.1,m,T,verts=6))
    for x in (-4.5,-1.5,1.5,4.5):
        o.append(cyl('pendant cord',x,4.05,3,.006,1.9,DARK,T,verts=4))
        o.append(ico('pendant globe glow',x,3.0,3,.17,WARM,1.0,sub=2))
    return o

def banquettes():
    o=[]
    for x in (-11,0,11):
        o.append(box('banquette base',x,.24,13.4,7,.44,1.7,NAVY,T,0))
        o.append(box('banquette seat',x,.52,13.3,6.9,.14,1.5,NAVY,T,.05))
        o.append(box('banquette back',x,1.05,14.15,7,1,.25,NAVY,T,.05))
        o.append(box('banquette plinth',x,.03,13.4,6.8,.06,1.6,INOX,T,0))
        for j,dx in enumerate((-2.2,-.7,.7,2.2)):
            o.append(box('cushion',x+dx,.84,13.92,.9,.55,.18,ACCENT if j%2 else NAVY,T,.06))
        for dx in (-3.45,3.45):o.append(box('banquette arm',x+dx,.62,13.4,.14,.5,1.7,WALNUT,T,0))
    return o

def furniture():
    """Rooftop tables and their 37 chairs, read from the shared seating data."""
    o=[]
    tables=[t for t in json.loads((ROOT/'shared/tables.json').read_text()) if t['id'].startswith('sky-')]
    chairs=json.loads((ROOT/'shared/chairs.json').read_text())
    for t in tables:
        x,z=t['x']+106,t['z']-37
        large=t['id']=='sky-7'
        if large:
            o.append(cyl('table top',x,.9,z,1.9,.06,WALNUT,T,verts=36))
            o.append(cyl('table edge',x,.85,z,1.86,.05,INOX,T,verts=36))
        else:
            o.append(box('table top',x,.9,z,2.2,.06,2.2,TRAV,T,0))
            o.append(box('table apron',x,.84,z,2.0,.08,2.0,WALNUT,T,0))
        o.append(cyl('table pedestal',x,.43,z,.07,.8,INOX,T,verts=12))
        o.append(cyl('table foot',x,.02,z,.45 if not large else .62,.04,INOX,T,verts=16))
        o.append(cyl('table candle glow',x,.99,z,.06,.12,WARM,T,verts=10))
        o.append(cyl('candle glass',x,.99,z,.085,.14,GLASS,T,verts=10))
        for c in chairs:
            if c.get('tableId')!=t['id']:continue
            cx,cz,yaw=c['x']+106,c['z']-37,c['yaw']
            # a club dining chair: upholstered seat and back between two walnut side panels
            rbox('chair seat',cx,cz,yaw,0,.5,.02,.62,.14,.64,NAVY)
            rbox('chair back',cx,cz,yaw,0,.88,-.3,.62,.66,.12,NAVY)
            for dx in (-.35,.35):rbox('chair side',cx,cz,yaw,dx,.36,-.02,.07,.72,.7,WALNUT)
    return o

def dj():
    o=[]
    o.append(box('dj desk',-14,1,5.5,3.3,.08,1.2,WALNUT,T,0))
    o.append(box('dj fascia',-14,.52,5.5,3.2,.96,1.1,DARK,T,0))
    o.append(box('dj fascia glow',-14,.3,4.94,3.0,.04,.04,PINK,T,0))
    for x in (-14.8,-13.2):
        o.append(cyl('deck platter',x,1.07,5.5,.36,.04,INOX,T,verts=20))
        o.append(cyl('platter mat',x,1.1,5.5,.33,.01,DARK,T,verts=20))
    o.append(box('mixer',-14,1.08,5.5,.5,.06,.46,DARK,T,0))
    for x in (-16.3,-11.7):
        o.append(box('speaker',x,.8,5.5,.7,1.6,.65,DARK,T,0))
        for y in (.45,1.2):o.append(cyl('speaker cone',x,y,5.17,.22,.02,INOX,T,axis='z',verts=16))
    return o

def lift_vestibule():
    """Open-fronted cabin at (14,12): back wall on z=13.4 where the collider is, front clear."""
    o=[]
    o.append(box('vestibule floor',14,.02,12,3.8,.04,3,TRAV,T,0))
    o.append(box('vestibule back',14,1.6,13.4,3.8,3.2,.2,CURTAIN,T,0))
    for s in (-1,1):o.append(box('vestibule side',14+s*1.8,1.6,12.05,.2,3.2,2.9,WALNUT,T,0))
    o.append(box('vestibule roof',14,3.3,12,4.1,.2,3.3,DARK,T,0))
    o.append(box('vestibule light glow',14,3.19,12,3.0,.02,2.1,WARM,T,0))
    o.append(box('vestibule head',14,2.95,10.6,4.1,.5,.3,DARK,T,0))
    for s in (-1,1):o.append(box('lift door',14+s*.5,1.15,13.27,.98,2.3,.04,INOX,T,0))
    o.append(box('lift architrave',14,2.36,13.24,2.4,.1,.06,INOX,T,0))
    for s in (-1,1):o.append(box('lift architrave',14+s*1.15,1.18,13.24,.1,2.36,.06,INOX,T,0))
    o.append(box('call plate',15.4,1.2,13.26,.14,.3,.03,INOX,T,0))
    o.append(box('call button glow',15.4,1.2,13.24,.06,.06,.02,WARM,T,0))
    o.append(box('floor indicator',14,2.62,13.25,.9,.18,.03,BLUE,T,0))
    return o

def street_lobby():
    """Ground-level lift lobby at local (12, STREET, 20): doors face +z, under the sign."""
    o=[];y0=STREET
    o.append(box('lobby pad',12,y0+.03,20.2,4.6,.06,2.6,TRAV,T,0))
    o.append(box('lobby core',12,y0+1.6,19.55,3.4,3.2,1.1,CURTAIN,T,0))
    for s in (-1,1):o.append(box('lobby jamb',12+s*1.5,y0+1.6,20.35,.4,3.2,.5,WALNUT,T,0))
    o.append(box('lobby lintel',12,y0+3.0,20.35,3.4,.4,.5,WALNUT,T,0))
    o.append(box('lobby canopy',12,y0+3.32,20.95,4.4,.14,1.9,INOX,T,0))
    o.append(box('canopy soffit glow',12,y0+3.24,20.95,3.6,.02,1.4,WARM,T,0))
    for s in (-1,1):o.append(box('lobby door',12+s*.62,y0+1.45,20.5,1.2,2.9,.05,GLASS,T,0))
    for s in (-1,1):o.append(box('door pull',12+s*.12,y0+1.1,20.56,.03,.9,.03,INOX,T,0))
    o.append(box('lobby architrave',12,y0+2.94,20.56,2.7,.08,.06,INOX,T,0))
    for s in (-1,1):o.append(box('lobby architrave',12+s*1.28,y0+1.5,20.56,.08,2.95,.06,INOX,T,0))
    o.append(box('lobby sign back',12,y0+3.7,20.72,5.4,1.0,.08,DARK,T,0))
    o.append(box('lobby threshold',12,y0+.07,20.5,2.8,.02,.5,INOX,T,0))
    for s in (-1,1):
        o.append(box('lobby planter',12+s*2.1,y0+.35,21.2,.6,.7,.6,CROWN,T,0))
        o.append(ico('lobby shrub',12+s*2.1,y0+.95,21.2,.36,LEAF,.9,sub=1))
    return o

# ---------------------------------------------------------------- build / export
def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    ceil=bpy.data.objects.new('ceiling',None);s.collection.objects.link(ceil);ceil.parent=e
    for stage in (crown,deck,basin,balustrade,planters,lounge,ceiling,bar,banquettes,furniture,dj,lift_vestibule,street_lobby):stage()
    for x in (-8.4,-5.6,5.6,8.4):lounger(x)
    for x in (-7,7):cabana(x)
    # primitive_*_add lands in the active collection, mesh() in the scene collection: sweep both.
    overhead={o.as_pointer() for o in CEILING}
    for ob in [o for o in s.objects if o.type=='MESH']:
        ob.parent=ceil if ob.as_pointer() in overhead else e
        uv_metres(ob)
    return e,ceil

def export(e,ceil):
    for parent,tag in ((e,'skydining'),(ceil,'ceiling')):
        batches={}
        for ob in [c for c in parent.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            j=join(objs,f'{tag} | {" + ".join(key)}')
            if not any('tile' in m for m in j.data.materials if m):
                for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [e,ceil]+list(e.children)+list(ceil.children):ob.select_set(True)
    path=PUBLIC/'LM_ENV_SkyDining.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
        export_image_format='WEBP',export_image_quality=82)
    meshes=[c for c in list(e.children)+list(ceil.children) if c.type=='MESH']
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in meshes)
    report={'asset':'LM_ENV_SkyDining','origin':[-106,44,37],'deck':[36,32],'basin':{'x':[-10,10],'z':[-14,-6]},
            'pool':{'x':[-9,9],'z':[-14,-6],'water':WATER,'floor':FLOOR,'infinityEdge':'north, z=-14'},
            'textures':sorted(kit.IMAGES),'triangles':tris,'bytes':path.stat().st_size,'draws':len(meshes)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('SKYDINING WEB EXPORT',json.dumps(report),flush=True)

if __name__=='__main__':
    e,ceil=build();export(e,ceil)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'skydining.blend'))
