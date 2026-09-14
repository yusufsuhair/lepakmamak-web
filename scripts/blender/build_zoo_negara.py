"""Zoo Negara Mini Lepak, photographic pass: naturalistic habitats, a stone-and-timber gateway under
an attap roof, and elephants, giraffes, zebras, a lion and flamingos in textured coats.

Replaces the zoo half of build_zoo.py (elephant .. zoo()), which also builds LM_ENV_Furniture and is
not touched here: that zoo code is dead once this ships.

What is here (park-local metres, origin at the pad centre, world (-123, -112))
  * a cow-grass lawn with trodden verges, paver visitor paths on the same footprints as world.ts
    with concrete kerbs, and red laterite habitat ground, paled to dust on the savanna
  * habitats fenced along the paths with timber post-and-rail, a green chain-link perimeter that
    stays open between the gateway pylons, rock outcrops and boulders (kit.rock), fallen logs
  * the elephant yard with a mud wallow, the savanna with an umbrella tree, a giraffe hay feeder and
    a termite mound, the lion's rock outcrop and basking ledge, the flamingo pond with a stone rim,
    dark still water (district_textures.water) and reed beds, shrubs and grass clumps as leaf cards
  * signage frames (board, posts and a little attap roof) behind the game's canvas GAJAH, SAVANA
    and KOLAM FLAMINGO signs; the lintel frame behind ZOO NEGARA MINI LEPAK
  * animals lathed along centrelines with coat textures mapped around and along each limb
    (district_kit.limb): elephant hide, reticulated giraffe, zebra stripes that ring body and legs,
    lion fur with a vertex-tinted mane, flamingo plumage; modest rings per limb
  * night (src/district-night.ts): path lamps and gateway lanterns glow and pool warm light

Positions the game reads are kept: the pylon colliders (27.5, +-8, 3.2 x 3.2), the sign planes
(the lintel face stays at x <= 29.0, sign boards sit behind each canvas), the park footprint, and
every animal where world.ts placed it. No collider is added.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_zoo_negara.py

Output: public/assets/models/environment/LM_ENV_Zoo.glb (meshopt), node 'zoo'; report under 'Zoo'
in assets/zoo/manifest.json. Textures are written to assets/zoo/textures (ignored).
"""
import bpy, math, json, sys, random
from pathlib import Path
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
import district_kit as K
from district_kit import grid, quad, strut, tube, paint, limb, frame_of, clump, tuft, cards, _obj, orient
from brand_kit import box, cyl
from build_lrt import loft
import pbr_textures, brand_textures as BT

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/zoo';PUBLIC=ROOT/'public/assets/models/environment'
K.setup('zoo',OUT/'textures',20260915)

LAWN=K.textured('Ground lawn','lawn',.95,4.0,strength=.8)
SOIL=K.textured('Ground soil','soil',.95,4.0,strength=.9)
PAVING=K.textured('Ground paving','paving',.85,1.2,strength=.6,source=BT)
CONCRETE=K.textured('Zoo concrete','acrylic',.9,1.2)
STONE=K.textured('Zoo stone','granite',.85,1.6,strength=1.3,source=pbr_textures)
WOOD=K.textured('Zoo timber','wood',.8,1.0,source=pbr_textures)
THATCH=K.textured('Zoo attap','thatch',.9,1.4,two_sided=True,source=pbr_textures)
WATER=K.textured('Zoo pond water','water',.06,3.0,strength=.35)
LINK=K.masked('Chain link','chainlink',.5,tile=.4,cutoff=.4)
LEAVES=K.masked('Zoo foliage','foliage',.7,cutoff=.5)
PAINTED=K.flat('Painted steel',.5,.15)
HIDE=K.lathe_textured('Elephant hide','hide',.9,strength=1.2)
GIRAFFE=K.lathe_textured('Giraffe coat','giraffe',.8)
ZEBRA=K.lathe_textured('Zebra coat','zebra',.75)
FUR=K.lathe_textured('Lion fur','fur',.9,strength=1.1)
PLUME=K.lathe_textured('Flamingo plumage','feather',.75)
KERATIN=K.flat('Animal keratin',.38)
LAMP=K.glow('lamp','#ffd08a')
POOL=K.wash('lamp')

R=random.Random(20260915)
GREEN_POST='#2f4a3a';TIMBER='#8a6a4c';LATERITE='#dcae90';DUST='#f4e6d2';TAWNY='#dcbd98'

def srgb(h):return K.srgb(h)
def mottle(base,amount=.1,scale=.15,trodden=None):
    b=srgb(base)
    def f(x,z):
        n=1+amount*noise.noise(Vector((x*scale,z*scale,.7)))+amount*.5*noise.noise(Vector((x*scale*4,z*scale*4,3.3)))
        t=trodden(x,z) if trodden else 0
        return tuple(min(1,c*n*(1-.25*t)+ .12*t*w) for c,w in zip(b,(1,.8,.55)))
    return f

def patch(name,cx,cz,rx,rz,y,m,colour,rings=4,n=30,seed=0,wobble=.18):
    """Irregular ground patch: concentric rings with a noisy outline, faces up, vertex colours."""
    verts=[K.pt(cx,y,cz)];cols=[colour(cx,cz)];faces=[]
    for j in range(1,rings+1):
        t=j/rings
        for i in range(n):
            a=2*math.pi*i/n;k=1+wobble*noise.noise(Vector((math.cos(a)*1.3+seed,math.sin(a)*1.3,seed*.7)))*t
            x,z=cx+math.cos(a)*rx*t*k,cz+math.sin(a)*rz*t*k;verts.append(K.pt(x,y,z));cols.append(colour(x,z))
    for i in range(n):faces.append((0,1+i,1+(i+1)%n))
    for j in range(rings-1):
        for i in range(n):
            a=1+j*n+i;b=1+j*n+(i+1)%n;faces.append((a,a+n,b+n,b))
    return orient(_obj(name,verts,faces,m,colours=cols),(0,1,0))

def disc(name,c,rx,ry,m,col,L,axis=(0,0,1),thick=.05,n=8):
    a=Vector(axis).normalized()*thick*.5
    return limb(name,[(c[0]-a.x,c[1]-a.y,c[2]-a.z,rx,ry),(c[0]+a.x,c[1]+a.y,c[2]+a.z,rx,ry)],m,col,n=n,L=L,uv=(.3,.3))

# ================================================================ ground, paths, fences
PATHS=[(0,0,5,57,.19),(0,-25,47,4.5,.2),(0,25,47,4.5,.2),(-21,0,4.5,54,.2),(21,0,4.5,54,.2)]

def near_path(x,z):
    d=min(max(abs(x-px)-pw/2,abs(z-pz)-pd/2) for px,pz,pw,pd,_ in PATHS)
    return max(0.0,1-max(d,0)/2.2)

def ground():
    o=[grid('lawn',-28,28,-31,31,.12,LAWN,mottle('#dfe6cf',.12,.08,near_path),step=2.0)]
    for px,pz,pw,pd,top in PATHS:
        o.append(box('visitor path',px,top-.04,pz,pw,.08,pd,PAVING,'#efe6d6'))
        if pw>pd:
            for s in (-1,1):o.append(box('path kerb',px,top-.02,pz+s*(pd/2+.08),pw+.16,.12,.16,CONCRETE,'#bdb8ad'))
        else:
            for s in (-1,1):o.append(box('path kerb',px+s*(pw/2+.08),top-.02,pz,.16,.12,pd,CONCRETE,'#bdb8ad'))
    o.append(patch('elephant yard',-10.8,-12.6,7.2,9.0,.135,SOIL,mottle(LATERITE,.14,.2),seed=1))
    o.append(patch('savanna dust',10.8,-4,7.2,17.0,.132,SOIL,mottle(DUST,.12,.12),rings=6,seed=2,wobble=.12))
    o.append(patch('lion yard',11.2,19,6.8,3.4,.137,SOIL,mottle('#eed8bf',.12,.2),seed=3))
    o.append(patch('pond margin',-12,14,7.4,5.5,.134,SOIL,mottle('#b39f8a',.1,.3),seed=4,wobble=.1))
    return o

def fence_run(o,a,b,step=2.5,h=1.1):
    """Timber post-and-rail along a habitat edge."""
    L=math.hypot(b[0]-a[0],b[1]-a[1]);k=max(1,round(L/step))
    for i in range(k+1):
        x=a[0]+(b[0]-a[0])*i/k;z=a[1]+(b[1]-a[1])*i/k
        o.append(box('fence post',x,.12+h/2,z,.12,h,.12,WOOD,'#7a5b40'))
    for y in (.5,h-.08):o.append(strut('fence rail',(a[0],y+.12,a[1]),(b[0],y+.12,b[1]),.08,WOOD,TIMBER,h=.05))

def fences():
    o=[]
    for rect in ((-18.5,-2.9,-22.5,-3.2),(-18.5,-2.9,3.2,22.5),(2.9,18.5,-22.5,14.9),(2.9,18.5,15.3,22.5)):
        x0,x1,z0,z1=rect
        for a,b in (((x0,z0),(x1,z0)),((x1,z0),(x1,z1)),((x1,z1),(x0,z1)),((x0,z1),(x0,z0))):fence_run(o,a,b)
    # green chain-link perimeter, open between the gateway pylons
    runs=[((-27.6,-30.6),(27.6,-30.6)),((-27.6,30.6),(27.6,30.6)),((-27.6,-30.6),(-27.6,30.6)),((27.6,-30.6),(27.6,-9.7)),((27.6,9.7),(27.6,30.6))]
    for (ax,az),(bx,bz) in runs:
        L=math.hypot(bx-ax,bz-az);k=max(1,round(L/3))
        for i in range(k+1):
            x=ax+(bx-ax)*i/k;z=az+(bz-az)*i/k
            o.append(cyl('perimeter post',x,.12+.95,z,.035,1.9,PAINTED,GREEN_POST,verts=8))
        o.append(strut('perimeter rail',(ax,2.0,az),(bx,2.0,bz),.045,PAINTED,GREEN_POST))
        o.append(quad('perimeter mesh',[(ax,.16,az),(bx,.16,bz),(bx,1.98,bz),(ax,1.98,az)],LINK,col='#6f8f78'))
    return o

# ================================================================ habitats
def boulder(o,x,z,r,col='#b8a894',squash=.62,seed=0,y=None):
    o.append(K.rock('boulder',x,(y if y is not None else .12)+r*squash*.35,z,r,STONE,col,squash=squash,sub=2,rough=.34,seed=seed,smooth=False))

def log(o,x,z,yaw,L,r=.18):
    c,s=math.cos(yaw),math.sin(yaw)
    pts=[(x+c*L*t,.12+r*.8+.05*math.sin(t*3),z+s*L*t) for t in (0,.35,.7,1)]
    o.append(tube('fallen log',pts,[r,r*.95,r*.85,r*.7],WOOD,'#6d5a48',sides=8))
    m=pts[1];o.append(tube('log branch',[m,(m[0]-s*.5,m[1]+.25,m[2]+c*.5),(m[0]-s*.9,m[1]+.3,m[2]+c*.8)],[r*.5,r*.35,r*.2],WOOD,'#6d5a48',sides=6))

def habitats(V,U,F):
    o=[]
    # elephant yard: boulders along the back, a mud wallow, a shade tree and a log
    for i,(x,z,r) in enumerate(((-17,-21,1.4),(-15.2,-21.6,1.0),(-4.6,-20.8,1.2),(-17.3,-4.8,.9),(-3.9,-5.2,.7))):boulder(o,x,z,r,seed=i)
    o.append(patch('mud wallow',-14.6,-17.2,2.6,1.7,.14,SOIL,mottle('#5b4033',.08,.4),rings=3,seed=5))
    o.append(patch('wallow water',-14.5,-17.2,1.6,1.0,.146,WATER,mottle('#8a8f80',.05,.5),rings=2,seed=6,wobble=.25))
    log(o,-6.5,-17.5,.5,3.2,.22)
    shade_tree(o,V,U,F,-17.2,-9.5,5.6,seed=1)
    # savanna: umbrella tree, hay feeder for the giraffes, termite mound, rocks, dry grass
    shade_tree(o,V,U,F,6.2,-19.5,6.4,seed=2,flat=True)
    o.append(tube('feeder pole',[(16.8,.12,-18.2),(16.8,4.3,-18.2)],.12,WOOD,'#6e5842',sides=8))
    o.append(tube('hay basket',[(16.8,3.55,-18.2),(16.8,4.25,-18.2)],[.42,.55],THATCH,'#c9b27a',sides=10))
    o.append(tube('termite mound',[(15.4,.12,.8),(15.5,.9,.9),(15.3,1.7,.7),(15.4,2.1,.8)],[.9,.62,.3,.08],SOIL,'#c79068',sides=9))
    for i,(x,z,r) in enumerate(((5.2,-6.5,.7),(17.2,4.2,.8),(4.6,12.6,.55))):boulder(o,x,z,r,seed=10+i)
    log(o,8.2,-8.2,-.3,2.4,.16)
    # lion: a rock outcrop with a basking ledge (the ledge top stays at 1.33), a log
    for i,(x,y,z,r,sq) in enumerate(((16.4,.2,20.9,2.2,.72),(14.6,.1,21.6,1.6,.7),(17.8,.1,18.8,1.3,.8),(12.9,.05,21.8,1.1,.6),(18.2,1.3,21.4,1.0,.75))):
        o.append(K.rock('lion rock',x,y+r*sq*.4,z,r,STONE,'#a8998a',squash=sq,sub=2,rough=.36,seed=20+i,smooth=False))
    o.append(K.rock('basking ledge',14.2,.95,19.0,2.3,STONE,'#b4a594',squash=.22,sub=2,rough=.16,seed=31,smooth=False))
    log(o,7.6,17.6,.2,2.6,.17)
    # flamingo pond: stone rim, water, boulders and reed beds
    prof=[(.12,1.04),(.2,1.04),(.26,1.0),(.24,.95),(.16,.93),(.1,.9)]
    from build_klcc import vloft
    ring=lambda h,r:[(-12+6.0*r*math.cos(2*math.pi*i/32),-(14+4.2*r*math.sin(2*math.pi*i/32))) for i in range(32)]
    o.append(paint(vloft('pond rim',[(h,ring(h,r)) for h,r in prof],[STONE]*(len(prof)-1),'zoo'),'#c7bba9'))
    o.append(paint(quad_disc('pond water',-12,.2,14,6.0*.92,4.2*.92,WATER),'#ffffff'))
    for i,(x,z,r) in enumerate(((-17.5,11.8,.8),(-6.6,16.4,.65),(-13.4,18.6,.55),(-9.1,10.2,.6),(-17.9,16.2,.5))):boulder(o,x,z,r,seed=40+i,squash=.55)
    for x,z in ((-17.4,15.3),(-15.4,18.4),(-6.4,13.1),(-8.0,17.8),(-16.9,10.7),(-10.2,18.6),(-6.9,11.2)):
        for k in range(3):tuft(V,U,F,x+R.uniform(-.4,.4),.14,z+R.uniform(-.4,.4),R.uniform(1.0,1.5),R,blades=3)
    for _ in range(46):   # dry grass on the savanna and tussocks along the fences
        x,z=R.uniform(3.5,18),R.uniform(-22,14)
        if math.hypot(x-15.4,z-.8)>1.5:tuft(V,U,F,x,.13,z,R.uniform(.5,.9),R,blades=2)
    for _ in range(30):
        x,z=R.choice([(R.uniform(-18,-3.5),R.uniform(-22,-4)),(R.uniform(-18,-3.5),R.uniform(4,22))])
        if not (-18<x<-6 and 9<z<19):tuft(V,U,F,x,.13,z,R.uniform(.45,.8),R,blades=2)
    return o

def quad_disc(name,cx,y,cz,rx,rz,m,n=32):
    verts=[K.pt(cx,y,cz)]+[K.pt(cx+rx*math.cos(2*math.pi*i/n),y,cz+rz*math.sin(2*math.pi*i/n)) for i in range(n)]
    return orient(_obj(name,verts,[(0,1+i,1+(i+1)%n) for i in range(n)],m),(0,1,0))

def shade_tree(o,V,U,F,x,z,h,seed=0,flat=False):
    """A shade tree: a leaning trunk forking into three limbs under clumps of leaf cards; `flat`
    spreads it into an umbrella crown."""
    T=random.Random(seed);top=(x+T.uniform(-.3,.3),h*.45,z+T.uniform(-.3,.3))
    o.append(tube('tree trunk',[(x,.12,z),(x,h*.2,z),top],[.32,.26,.2],WOOD,'#6b5d50',sides=9))
    spread=3.2 if flat else 2.2
    for k in range(3):
        a=k*2.1+T.uniform(-.3,.3);end=(top[0]+math.cos(a)*spread*.8,h*.78,top[2]+math.sin(a)*spread*.8)
        o.append(tube('tree limb',[top,((top[0]+end[0])/2,h*.66,(top[2]+end[2])/2),end],[.18,.13,.07],WOOD,'#6b5d50',sides=6))
        clump(V,U,F,end[0],h*.86,end[2],1.9 if flat else 1.5,.55 if flat else .9,26,'durian',1.5,T,up_bias=.9)
    clump(V,U,F,top[0],h*.93,top[2],spread,.6 if flat else 1.1,30,'durian',1.6,T,up_bias=.9)

def planting(V,U,F):
    for x,z in ((30.4,-10.4),(30.4,10.4),(24.6,-10.6),(24.6,10.6),(-24.5,-27.5),(-26,0),(24.5,27.5),(-24.5,27.5),(24.8,-27.4),(-1.1,-29.4),(1.4,29.4),(-26.2,-14),(-26.2,14),(25.8,-20),(25.8,20)):
        clump(V,U,F,x,.75,z,1.1,.55,14,'shrub',.95,R,up_bias=.4)
    for x,z in ((-15,-1.4),(13,-.4),(-12,23.6),(-19.8,-2),(19.6,-.6)):
        clump(V,U,F,x+R.uniform(-2.8,2.8),.55,z-.9,.8,.4,8,'shrub',.8,R,up_bias=.4)

# ================================================================ gateway, signs, lamps
def gateway():
    o=[]
    for z in (-8,8):
        o.append(box('pylon plinth',27.5,.12+.25,z,3.3,.5,3.3,CONCRETE,'#b8b2a6',bevel=.04))
        o.append(box('pylon',27.5,.62+2.85,z,3.1,5.7,3.1,STONE,'#c7b8a3',bevel=.03))
        o.append(box('pylon capital',27.5,6.45,z,3.35,.3,3.35,CONCRETE,'#b8b2a6',bevel=.04))
        for s in (-1,1):   # timber pilasters framing each face, a nod to the park's rustic signage
            o.append(box('pylon pilaster',27.5+s*1.58,3.4,z,.12,5.4,.4,WOOD,'#5d4632'))
            o.append(box('pylon pilaster',27.5,3.4,z+s*1.58,.4,5.4,.12,WOOD,'#5d4632'))
    # lintel: front face at x 28.98 so the canvas sign at 29.05 sits clear
    o.append(box('lintel beam',27.5,7.4,0,2.96,2.2,15.2,WOOD,'#6a4f37'))
    for y in (6.52,8.38):o.append(box('sign frame',28.98,y,0,.06,.16,14.44,WOOD,'#3d2c1f'))
    for z in (-7.16,7.16):o.append(box('sign frame',28.98,7.45,z,.06,2.0,.16,WOOD,'#3d2c1f'))
    for z in (-4.5,0,4.5):o.append(box('lintel bracket',27.5,6.2,z,2.7,.24,.5,WOOD,'#5d4632'))
    prof=[(25.0,8.62),(27.5,10.7),(30.0,8.62),(30.0,8.5),(27.5,10.55),(25.0,8.5)]
    o.append(paint(loft('gateway roof',[(-10.4,prof),(10.4,prof)],THATCH,'zoo'),'#e2cfa6'))
    o.append(box('roof ridge',27.5,10.72,0,.36,.16,20.9,WOOD,'#4e3a28'))
    for z in (-10.2,10.2):
        tri=[(25.1,8.6),(27.5,10.58),(29.9,8.6)]
        o.append(paint(loft('gable board',[(z-.04,tri),(z+.04,tri)],WOOD,'zoo'),'#5d4632'))
    o.append(box('roof plate',27.5,8.56,0,5.0,.1,20.2,WOOD,'#5d4632'))
    return o

def signboard(o,sx,sz,w):
    """Timber board, posts and a small attap roof behind a canvas habitat sign facing +z."""
    o.append(box('sign board',sx,2.4,sz-.07,w+.3,1.1,.08,WOOD,'#4e3a28'))
    for s in (-1,1):
        px=sx+s*(w/2+.2)
        o.append(box('sign post',px,1.62,sz-.1,.14,3.0,.14,WOOD,'#5d4632'))
    tri=[(sx-w/2-.55,3.08),(sx,3.55),(sx+w/2+.55,3.08),(sx+w/2+.55,3.0),(sx,3.47),(sx-w/2-.55,3.0)]
    o.append(paint(loft('sign roof',[(sz-.55,tri),(sz+.35,tri)],THATCH,'zoo'),'#e2cfa6'))

def lamps():
    o=[]
    for x,z in ((2.9,-18),(-2.9,-6),(2.9,6),(-2.9,18),(21,-12.5),(-21,12.5),(23.2,-4.6),(23.2,4.6),(-5.6,26.8),(12,23.2)):
        o.append(cyl('lamp post',x,.12+1.8,z,.05,3.6,PAINTED,'#2d3b33',verts=8))
        o.append(cyl('lamp foot',x,.12+.15,z,.12,.3,PAINTED,'#2d3b33',verts=8))
        o.append(K.rock('lamp globe',x,3.95,z,.2,LAMP,'#fff1d8',squash=1.1,sub=2,rough=0,seed=0))
        o.append(cyl('lamp cap',x,4.22,z,.23,.06,PAINTED,'#2d3b33',verts=10))
        c=(x,.22,z);w=7.0
        o.append(quad('lamp pool',[(x-w/2,.215,z+w/2),(x+w/2,.215,z+w/2),(x+w/2,.215,z-w/2),(x-w/2,.215,z-w/2)],POOL,normal=(0,1,0)))
    return o

# ================================================================ animals
def elephant(x,z,s=1.0,yaw=0.0):
    """Asian elephant: arched back, twin-domed head, small ears, a long tapering trunk. At s=1.1 it
    stands about 2.6 m at the shoulder, as the boxes it replaces did."""
    L=frame_of(x,z,yaw,s);o=[];U=(1.5,1.5)
    o.append(limb('elephant body',[(0,1.42,-1.5,.12),(0,1.5,-1.3,.6,.66),(0,1.58,-.86,.9,.98),(0,1.64,-.28,.98,1.06),(0,1.62,.3,.96,1.02),(0,1.62,.8,.84,.92),(0,1.68,1.1,.62,.72)],HIDE,n=14,L=L,uv=U))
    o.append(limb('elephant head',[(0,1.74,.98,.48,.56),(0,1.9,1.24,.6,.7),(0,1.94,1.46,.58,.66),(0,1.78,1.72,.46,.52),(0,1.56,1.9,.28,.3)],HIDE,n=12,L=L,uv=U))
    for side in (-1,1):
        o.append(limb('elephant dome',[(side*.2,2.2,1.28,.08),(side*.22,2.3,1.36,.26),(side*.22,2.3,1.5,.24),(side*.2,2.2,1.6,.08)],HIDE,n=8,L=L,uv=U))
    o.append(limb('elephant trunk',[(0,1.56,1.88,.24),(0,1.28,2.04,.2),(0,.94,2.12,.16),(0,.6,2.1,.13),(0,.34,2.0,.1),(0,.2,1.9,.075),(0,.22,1.78,.06)],HIDE,n=9,L=L,uv=U))
    for side in (-1,1):
        o.append(limb('elephant ear',[(side*.42,1.95,1.22,.26,.32),(side*.58,1.9,1.12,.46,.5),(side*.66,1.84,1.02,.42,.46),(side*.7,1.8,.96,.2,.24)],HIDE,col='#d9d6d2',n=10,L=L,uv=U))
        o.append(disc('elephant eye',(side*.46,1.9,1.5),.05,.05,KERATIN,'#1a1715',L,axis=(side*.9,.1,.42),thick=.05))
        for zz,dx in ((.78,.54),(-1.0,.56)):
            o.append(limb('elephant leg',[(side*dx,1.5,zz,.32,.34),(side*dx,.9,zz,.27,.29),(side*dx,.36,zz,.26,.27),(side*dx,.06,zz,.3,.31),(side*dx,.02,zz,.3,.31)],HIDE,n=10,L=L,uv=U))
            o.append(limb('elephant toenails',[(side*dx,.02,zz+.02,.305,.315),(side*dx,.12,zz+.02,.3,.31)],KERATIN,'#b8ad98',n=10,L=L,uv=U,caps=(False,False)))
        if s>.85:o.append(limb('elephant tusk',[(side*.24,1.46,1.86,.05),(side*.28,1.3,2.08,.04),(side*.3,1.26,2.24,.015)],KERATIN,'#efe6cc',n=6,L=L))
    o.append(limb('elephant tail',[(0,1.44,-1.5,.08),(0,1.04,-1.64,.06),(0,.72,-1.66,.04)],HIDE,n=6,L=L,uv=U))
    o.append(disc('elephant tail tuft',(0,.66,-1.66),.08,.08,KERATIN,'#2a2522',L,axis=(0,1,.2),thick=.14))
    return o

def giraffe(x,z,yaw=0.0,s=1.0):
    L=frame_of(x,z,yaw,s);o=[];U=(1.0,1.0)
    o.append(limb('giraffe body',[(0,1.8,-1.1,.1),(0,1.9,-.9,.44,.5),(0,1.96,-.42,.54,.6),(0,2.04,.14,.58,.62),(0,2.18,.62,.52,.58),(0,2.26,.96,.34,.42)],GIRAFFE,n=12,L=L,uv=U))
    o.append(limb('giraffe neck',[(0,2.28,.82,.36,.42),(0,2.94,1.0,.3,.35),(0,3.62,1.14,.26,.3),(0,4.28,1.24,.23,.27),(0,4.8,1.32,.21,.24)],GIRAFFE,n=10,L=L,uv=U))
    o.append(limb('giraffe head',[(0,4.88,1.3,.2,.23),(0,5.06,1.52,.19,.21),(0,5.02,1.78,.15,.15),(0,4.9,1.95,.1,.1)],GIRAFFE,col='#f0e0c0',n=9,L=L,uv=(.6,.6)))
    o.append(limb('giraffe mane',[(0,2.46,.66,.05,.14),(0,3.07,.83,.05,.13),(0,3.74,.96,.05,.12),(0,4.4,1.06,.05,.1),(0,4.88,1.14,.04,.07)],FUR,'#6b4a2e',n=5,L=L))
    for side in (-1,1):
        o.append(disc('giraffe ear',(side*.22,5.08,1.42),.17,.09,GIRAFFE,'#f2e3c6',L,axis=(side*.9,.3,-.2),thick=.05))
        o.append(disc('giraffe eye',(side*.17,5.04,1.6),.045,.045,KERATIN,'#151210',L,axis=(side*.9,.1,.3),thick=.05))
        o.append(limb('giraffe ossicone',[(side*.1,5.14,1.44,.045),(side*.11,5.34,1.46,.036),(side*.12,5.42,1.47,.06)],FUR,'#4b3322',n=6,L=L))
        for zz in (.62,-.78):
            o.append(limb('giraffe leg',[(side*.42,2.02,zz,.2),(side*.43,1.28,zz,.12),(side*.44,.66,zz,.1),(side*.44,.14,zz,.1)],GIRAFFE,n=8,L=L,uv=(.5,1.0)))
            o.append(limb('giraffe hoof',[(side*.44,.15,zz+.02,.105),(side*.44,.02,zz+.04,.115)],KERATIN,'#2a2420',n=8,L=L))
    o.append(limb('giraffe tail',[(0,1.94,-1.12,.05),(0,1.54,-1.26,.04),(0,1.24,-1.3,.03)],GIRAFFE,n=5,L=L))
    o.append(disc('giraffe tail tuft',(0,1.14,-1.31),.07,.07,KERATIN,'#2a2018',L,axis=(0,1,.2),thick=.18))
    return o

def zebra(x,z,yaw=0.0,s=1.0):
    L=frame_of(x,z,yaw,s);o=[];U=(1.0,1.2)
    spine=[(-.84,.9,.1),(-.68,.95,.3),(-.5,.97,.38),(-.25,.99,.42),(0,1.0,.43),(.25,1.02,.41),(.5,1.04,.36),(.7,1.06,.26),(.82,1.08,.16)]
    o.append(limb('zebra body',[(0,y,zz,r,r*1.08) for zz,y,r in spine],ZEBRA,n=12,L=L,uv=U))
    neck=[(.74,1.1,.25),(.88,1.24,.22),(1.0,1.38,.2),(1.1,1.52,.18),(1.16,1.62,.165)]
    o.append(limb('zebra neck',[(0,y,zz,r,r*1.12) for zz,y,r in neck],ZEBRA,n=10,L=L,uv=U))
    o.append(limb('zebra head',[(0,1.64,1.14,.16,.18),(0,1.63,1.34,.14,.155),(0,1.55,1.52,.11,.115),(0,1.48,1.63,.085,.08)],ZEBRA,n=9,L=L,uv=(.8,.5)))
    o.append(limb('zebra muzzle',[(0,1.49,1.6,.1,.095),(0,1.46,1.7,.085,.08)],KERATIN,'#27211d',n=8,L=L))
    o.append(limb('zebra mane',[(0,1.26,.8,.035,.12),(0,1.38,.92,.035,.11),(0,1.52,1.04,.035,.1),(0,1.66,1.13,.03,.08)],ZEBRA,n=5,L=L,uv=(.2,.25)))
    for side in (-1,1):
        o.append(disc('zebra ear',(side*.12,1.72,1.16),.1,.05,ZEBRA,'#ffffff',L,axis=(side*.7,.6,-.2),thick=.05))
        o.append(disc('zebra eye',(side*.14,1.64,1.3),.04,.04,KERATIN,'#141110',L,axis=(side*.9,.1,.3),thick=.05))
        for zz in (.52,-.58):
            o.append(limb('zebra leg',[(side*.31,1.02,zz,.17),(side*.32,.72,zz,.1),(side*.33,.4,zz,.07),(side*.33,.12,zz,.07)],ZEBRA,n=8,L=L,uv=(.4,.6)))
            o.append(limb('zebra hoof',[(side*.33,.13,zz,.08),(side*.33,.02,zz+.02,.09)],KERATIN,'#1e1a17',n=8,L=L))
    o.append(limb('zebra tail',[(0,1.02,-.84,.05),(0,.76,-.98,.04),(0,.56,-1.03,.03)],ZEBRA,n=5,L=L,uv=(.2,.4)))
    o.append(limb('zebra tail tuft',[(0,.6,-1.02,.05),(0,.44,-1.06,.08),(0,.28,-1.08,.04)],KERATIN,'#191614',n=6,L=L))
    return o

def lion(x,z,yaw=0.0,s=1.0):
    """Male lion standing: a deep chest and shoulders higher than the rump, thick legs on broad
    paws, a mane that swells round the neck and stops short of a face that pushes out of it."""
    L=frame_of(x,z,yaw,s);o=[];MANE='#7a5130';PALE='#f2e2c4'
    o.append(limb('lion body',[(0,.8,-.92,.1,.12),(0,.84,-.76,.28,.32),(0,.86,-.44,.33,.37),(0,.84,-.08,.31,.37),(0,.9,.28,.34,.42),(0,.96,.58,.33,.43),(0,1.0,.8,.22,.3)],FUR,TAWNY,n=12,L=L))
    o.append(limb('lion mane',[(0,1.0,.46,.22,.28),(0,1.06,.64,.44,.5),(0,1.1,.86,.5,.56),(0,1.1,1.02,.42,.47),(0,1.08,1.1,.26,.3)],FUR,MANE,n=14,L=L,uv=(.6,.6),caps=(False,False)))
    o.append(limb('lion head',[(0,1.1,.9,.2,.22),(0,1.13,1.08,.22,.23),(0,1.1,1.24,.19,.18),(0,1.03,1.36,.14,.12)],FUR,TAWNY,n=10,L=L))
    o.append(limb('lion muzzle',[(0,1.0,1.3,.13,.1),(0,.97,1.44,.095,.075)],FUR,PALE,n=8,L=L))
    o.append(disc('lion nose',(0,1.02,1.45),.045,.035,KERATIN,'#3a2622',L,axis=(0,.3,1),thick=.05))
    o.append(limb('lion chin',[(0,.9,1.22,.08,.05),(0,.9,1.36,.06,.04)],FUR,PALE,n=6,L=L))
    for side in (-1,1):
        o.append(disc('lion ear',(side*.15,1.33,1.04),.07,.065,FUR,MANE,L,axis=(0,.2,1),thick=.05))
        o.append(disc('lion eye',(side*.1,1.16,1.3),.028,.024,KERATIN,'#3a2a12',L,axis=(side*.5,.2,.85),thick=.04))
        o.append(limb('lion foreleg',[(side*.2,.92,.64,.14,.17),(side*.21,.58,.7,.105,.12),(side*.2,.24,.72,.085,.095),(side*.2,.08,.74,.1,.11)],FUR,TAWNY,n=8,L=L))
        o.append(limb('lion front paw',[(side*.2,.07,.7,.11,.07),(side*.2,.06,.86,.1,.06)],FUR,TAWNY,n=8,L=L))
        o.append(limb('lion hind leg',[(side*.21,.84,-.6,.17,.21),(side*.22,.52,-.74,.12,.14),(side*.2,.24,-.62,.075,.085),(side*.2,.08,-.64,.095,.1)],FUR,TAWNY,n=8,L=L))
        o.append(limb('lion hind paw',[(side*.2,.07,-.68,.1,.065),(side*.2,.06,-.52,.09,.06)],FUR,TAWNY,n=8,L=L))
    o.append(limb('lion tail',[(0,.84,-.94,.05),(0,.62,-1.14,.04),(0,.42,-1.26,.034),(0,.3,-1.42,.03)],FUR,TAWNY,n=5,L=L))
    o.append(limb('lion tail tuft',[(0,.32,-1.4,.05),(0,.26,-1.52,.07),(0,.22,-1.6,.03)],FUR,'#3f2818',n=6,L=L))
    return o

def flamingo(x,z,yaw=0.0,s=1.0,tuck=False):
    L=frame_of(x,z,yaw,s);o=[];U=(.4,.4)
    o.append(limb('flamingo body',[(0,1.06,-.38,.04),(0,1.13,-.22,.17,.16),(0,1.16,0,.21,.19),(0,1.13,.2,.16,.15),(0,1.08,.33,.07,.065)],PLUME,n=10,L=L,uv=U))
    for side in (-1,1):o.append(disc('flamingo wing',(side*.18,1.17,-.04),.14,.1,PLUME,'#e7a3a8',L,axis=(side,0,-.15),thick=.05))
    o.append(limb('flamingo tail',[(0,1.12,-.36,.06),(0,1.08,-.48,.02)],KERATIN,'#2a1c1c',n=5,L=L))
    o.append(limb('flamingo neck',[(0,1.18,.24,.07),(0,1.44,.34,.06),(0,1.66,.3,.054),(0,1.78,.38,.05)],PLUME,n=7,L=L,uv=U))
    o.append(limb('flamingo head',[(0,1.79,.4,.07),(0,1.78,.54,.058)],PLUME,'#fbe3e0',n=7,L=L,uv=U))
    o.append(limb('flamingo beak',[(0,1.77,.55,.045),(0,1.74,.62,.035)],KERATIN,'#f1e2d0',n=6,L=L))
    o.append(limb('flamingo beak tip',[(0,1.74,.62,.035),(0,1.68,.7,.014)],KERATIN,'#1b1614',n=6,L=L))
    legs=[(-.07,1.02,-.02,.03),(-.07,.54,-.02,.026),(-.07,.2,-.02,.022),(-.07,.03,.02,.03)]
    o.append(limb('flamingo leg',legs,PLUME,'#e8858f',n=6,L=L,uv=U))
    if tuck:o.append(limb('flamingo leg',[(.07,1.0,-.04,.03),(.16,.86,.1,.026),(.06,.78,.22,.028)],PLUME,'#e8858f',n=6,L=L,uv=U))
    else:o.append(limb('flamingo leg',[(-x0,y,z0,r) for (x0,y,z0,r) in legs],PLUME,'#e8858f',n=6,L=L,uv=U))
    return o

def animals():
    o=elephant(-12,-14,1.1,-.22)+elephant(-8,-9,.72,.9)
    o+=giraffe(11,-15,-.4)+giraffe(16,-10,.35)
    o+=zebra(9,3,.4)+zebra(15,6,-.55)+zebra(11,10,.1)
    o+=lion(12,20,.35)
    o+=flamingo(-15,13,.7)+flamingo(-11,15,-1.3,tuck=True)+flamingo(-8,12,2.4)
    return o

# ================================================================ build / export
def zoo():
    V,U,F=[],[],[]
    o=ground()+fences()+habitats(V,U,F)+gateway()+lamps()+animals()
    planting(V,U,F)
    for sx,sz,w in ((-15,-2,5.0),(13,-1,5.0),(-12,23,8.0)):signboard(o,sx,sz,w)
    o.append(cards('zoo foliage',V,U,F,LEAVES))
    return o

if __name__=='__main__':
    root=bpy.data.objects.new('zoo',None);bpy.context.scene.collection.objects.link(root)
    for ob in zoo():
        if ob is not None:ob.parent=root
    K.export(root,PUBLIC/'LM_ENV_Zoo.glb',OUT/'manifest.json','Zoo',{'node':'zoo','origin':[-123,0,-112],'builder':'scripts/blender/build_zoo_negara.py'})
