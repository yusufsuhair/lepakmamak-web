"""Kampung Durian Runtuh, photographic pass: the Upin & Ipin village at world (122,-132), authored in
village-local metres so the GLB drops straight onto the durian-village.ts group.

What is here
  * five rumah kampung on timber tiang and concrete footings: vertical papan walls in each house's
    colour, weathered and peeling back to grey timber (district_textures.papan), tingkap with
    jerejak balusters and louvred shutters swung open, kerawang fretwork over doors and windows and
    in the tebar layar gables, bumbung panjang roofs of attap or rusting zinc with carved fascia
    boards and a tunjuk langit finial, an open serambi with balustrades, and tangga batu: concrete
    steps with patterned tile risers and scrolled cheek walls
  * a swept halaman of pale laterite round the houses and along the paths, cow grass elsewhere
  * four durian trees (tall trunks, bronze-backed leaves, spiky fruit) and three rambutan trees
    heavy with red fruit, shrubs and grass as leaf cards
  * the timber pintu gerbang, the swing, raised vegetable beds, trestle tables and benches, the
    cement badminton court with a knotted net, Opah's washing line, a second line of batik sarongs,
    the rattan laundry basket, the bike track, a kapcai at the warung, a blue water tank on its
    stand, tempayan jars at the stairs
  * night (src/district-night.ts): lit windows and doorways, a bulb on every serambi and warm pools

Footprints, colliders and every coordinate the residents route around match durian-village.ts:
house boxes, entrances on +z, the gate posts, swing posts, tables, benches, trees, court posts,
washing line (wire at y=2.35) and basket. The game keeps drawing its canvas signs on top (village
name, house labels, badminton sign), so nothing of this sits between a sign and the yard.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_kampung.py

Output: public/assets/models/environment/LM_ENV_Kampung.glb (meshopt), node 'kampung' at the
village origin; report under 'Kampung' in assets/kampung/manifest.json (textures: assets/kampung/textures).
"""
import bpy, math, json, sys, random
from pathlib import Path
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
import district_kit as K
from district_kit import grid, quad, strut, tube, paint, clump, tuft, cards, _obj, orient
from brand_kit import box, cyl
from build_lrt import loft
import pbr_textures, shoplot_textures as ST

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/kampung';PUBLIC=ROOT/'public/assets/models/environment'
K.setup('kampung',OUT/'textures',20260916)

LAWN=K.textured('Ground lawn','lawn',.95,4.0,strength=.8)
HALAMAN=K.textured('Ground halaman','halaman',.95,4.0,strength=.9)
PAPAN=K.textured('Kampung papan','papan',.82,2.4,strength=.9)
TIMBER=K.textured('Kampung timber','wood',.8,1.0,source=pbr_textures)
CONCRETE=K.textured('Kampung concrete','acrylic',.92,1.2)
BATIK=K.textured('Kampung batik','batik',.85,1.0,two_sided=True)
ZINC=K.lathe_textured('Kampung zinc','zinc',.6,source=ST);ZINC.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.3
ATTAP=K.lathe_textured('Kampung attap','thatch',.92,source=pbr_textures);ATTAP.use_backface_culling=False
KERAWANG=K.masked('Kampung kerawang','kerawang',.75,cutoff=.5)
LEAVES=K.masked('Kampung foliage','foliage',.7,cutoff=.5)
NET=K.masked('Net cord','netting',.85,cutoff=.45)
PAINTED=K.flat('Kampung painted',.45,.1)
WINDOW=K.glow('window','#ffb766',rough=.9)
LAMP=K.glow('lamp','#ffd08a')
POOL=K.wash('lamp')

R=random.Random(20260916)
FLOOR=1.50;WALLTOP=4.30
WALLS={'#bc9157':'#d2ab7c','#8aab80':'#98bf8a','#edc766':'#f3cf68','#e5a681':'#efad84','#b3c092':'#c3d49e'}  # game hex -> papan paint
TRIM={'#bc9157':'#f2ead8','#8aab80':'#f0ecdc','#edc766':'#2f5b4c','#e5a681':'#f2ead8','#b3c092':'#7a3b2e'}
ROOF={'#bc9157':('attap','#d7c49c'),'#8aab80':('zinc','#b9b6ae'),'#edc766':('zinc','#a8574a'),'#e5a681':('zinc','#4f7a8a'),'#b3c092':('zinc','#c4c0b6')}
DARKWOOD='#6d5238';WOOD='#9a7a58'

def lin(h):return K.srgb(h)

# ---------------------------------------------------------------- ground
PATHS=[(0,8,51,5),(0,0,5,37)]
def near(x,z,rects,pad):
    d=min(max(abs(x-cx)-w/2,abs(z-cz)-dd/2) for cx,cz,w,dd in rects)
    return max(0.0,1-max(d,0)/pad)

HOUSES=[(-16,-11,12,9,'#bc9157',3,3),(16,-11,12,9,'#8aab80',3,3),(0,-12,12,10,'#edc766',3,3),(-19,1,10,6,'#e5a681',3,2),(20,1,10,6,'#b3c092',3,2)]

def ground(V,U,F):
    o=[]
    trod=lambda x,z:near(x,z,PATHS+[(h[0],h[1]+h[3]/2+1.5,h[2]+2,h[3]+4) for h in HOUSES],3.0)
    base=lin('#e2e8d0')
    def lawn(x,z):
        n=1+.12*noise.noise(Vector((x*.08,z*.08,.7)))+.06*noise.noise(Vector((x*.4,z*.4,3.3)));t=trod(x,z)
        return tuple(min(1,c*n*(1-.3*t)+.15*t*w) for c,w in zip(base,(1,.85,.55)))
    o.append(grid('kampung lawn',-28,28,-20,20,.1,LAWN,lawn,step=2.0))
    sand=lin('#fbf2e6')
    def swept(x,z):
        n=1+.08*noise.noise(Vector((x*.15,z*.15,1.9)))+.05*noise.noise(Vector((x*.6,z*.6,5.1)))
        return tuple(min(1,c*n) for c in sand)
    # the halaman: swept earth round each house, spilling out along the stairs, and the two paths
    for x,z,w,d,*_ in HOUSES:
        o.append(blob('halaman',x,z+1.2,w/2+2.6,d/2+3.6,.115,HALAMAN,swept,seed=x*.3+z))
    o.append(strip('path east-west',-25.5,25.5,5.5,10.5,.12,HALAMAN,swept,axis='x'))
    o.append(strip('path north-south',-2.5,2.5,-18.5,18.5,.121,HALAMAN,swept,axis='z'))
    o.append(blob('gate forecourt',0,17.5,6.5,2.6,.119,HALAMAN,swept,seed=9))
    # bike track: two rings on the exact ellipse the cyclists ride
    ring=lambda rx,rz,y:[(18+rx*math.cos(2*math.pi*i/40),-(16.8+rz*math.sin(2*math.pi*i/40))) for i in range(40)]
    from build_klcc import vloft
    o.append(paint(vloft('bike track',[(.125,ring(5.6,2.55,0)),(.125,ring(3.8,.75,0))],[HALAMAN],'kampung',cap=False),'#e9d7c0'))
    o.append(paint(vloft('bike rut',[(.128,ring(4.95,1.9,0)),(.128,ring(4.45,1.4,0))],[HALAMAN],'kampung',cap=False),'#b89f86'))
    for ob in o[-2:]:orient(ob,(0,1,0))
    # grass tussocks along the pad edge, shrubs by the houses
    for _ in range(70):
        x,z=R.choice([(R.uniform(-27.5,27.5),R.uniform(-19.8,-18.8)),(R.uniform(-27.5,27.5),R.uniform(18.8,19.8)),(R.uniform(-27.8,-26.8),R.uniform(-19,19)),(R.uniform(26.8,27.8),R.uniform(-19,19))])
        if abs(x)>6.5 or z<0:tuft(V,U,F,x,.1,z,R.uniform(.35,.7),R,blades=2)
    for x,z in ((-23.2,-6),(-8.8,-6.2),(8.8,-6.2),(23.2,-6),(-24.8,4.6),(-13.2,4.6),(13.8,4.6),(25.6,3.8),(-6.9,-7.3),(6.9,-7.3)):
        clump(V,U,F,x,.55,z,.85,.45,10,'shrub',.8,R,up_bias=.4)
    return o

def blob(name,cx,cz,rx,rz,y,m,colour,rings=4,n=28,seed=0,wobble=.14):
    verts=[K.pt(cx,y,cz)];cols=[colour(cx,cz)];faces=[]
    for j in range(1,rings+1):
        t=j/rings
        for i in range(n):
            a=2*math.pi*i/n;k=1+wobble*noise.noise(Vector((math.cos(a)*1.4+seed,math.sin(a)*1.4,seed*.37)))*t
            # superellipse: squarer than an ellipse, so the yard hugs a rectangular house
            c,s=math.cos(a),math.sin(a);e=.5
            x=cx+rx*t*k*math.copysign(abs(c)**e,c);z=cz+rz*t*k*math.copysign(abs(s)**e,s)
            verts.append(K.pt(x,y,z));cols.append(colour(x,z))
    for i in range(n):faces.append((0,1+i,1+(i+1)%n))
    for j in range(rings-1):
        for i in range(n):
            a=1+j*n+i;b=1+j*n+(i+1)%n;faces.append((a,a+n,b+n,b))
    return orient(_obj(name,verts,faces,m,colours=cols),(0,1,0))

def strip(name,x0,x1,z0,z1,y,m,colour,axis='x',step=1.0):
    """A path with ragged, noise-bitten edges across its width."""
    L0,L1,W0,W1=(x0,x1,z0,z1) if axis=='x' else (z0,z1,x0,x1)
    n=max(2,round((L1-L0)/step));verts=[];cols=[];faces=[]
    for i in range(n+1):
        a=L0+(L1-L0)*i/n
        for j,w in enumerate((W0,(W0+W1)/2,W1)):
            e=(0 if j==1 else .45*noise.noise(Vector((a*.35,j*3.1,.9))))*(1 if j==2 else -1)
            b=w+e;x,z=(a,b) if axis=='x' else (b,a)
            verts.append(K.pt(x,y,z));cols.append(colour(x,z))
    for i in range(n):
        for j in range(2):
            p=i*3+j;faces.append((p,p+3,p+4,p+1))
    return orient(_obj(name,verts,faces,m,colours=cols),(0,1,0))

# ---------------------------------------------------------------- rumah kampung
def roof(o,name,x,z0,z1,half,ey,ry,m,col,t=.12,tile=2.0):
    """Bumbung panjang: two slopes from eave (ey at x +-half) to ridge (ry) running z0..z1, with
    their own UVs: u along the ridge, v down the slope, so zinc ridges and attap courses run the
    right way. A thin underside and gable edges close it."""
    sl=math.hypot(half,ry-ey)
    for s in (-1,1):
        top=[(x+s*half,ey,z0),(x,ry,z0),(x,ry,z1),(x+s*half,ey,z1)]
        uv=[(z0/tile,sl/tile),(z0/tile,0),(z1/tile,0),(z1/tile,sl/tile)]
        ob=_obj(name,[K.pt(*p) for p in top],[(0,1,2,3)],m,uvs=uv);orient(ob,(s*(ry-ey),half,0));o.append(paint(ob,col))
        under=[(p[0],p[1]-t,p[2]) for p in top]
        ob=_obj(name+' underside',[K.pt(*p) for p in under],[(0,1,2,3)],m,uvs=uv);orient(ob,(-s*(ry-ey),-half,0));o.append(paint(ob,[c*.55 for c in lin(col)]))

def house(o,V,U,F,x,z,w,d,colour,nx,nz):
    hw,hd=w/2,d/2;fz=z+hd;wall=WALLS[colour];trim=TRIM[colour];kind,roofcol=ROOF[colour]
    # tiang on concrete footings
    xs=[x-hw+.9+i*(w-1.8)/(nx-1) for i in range(nx)];zs=[z-hd+.9+i*(d-1.8)/(nz-1) for i in range(nz)]
    for px in xs:
        for pz in zs:
            o.append(box('footing',px,.22,pz,.5,.3,.5,CONCRETE,'#d6d0c4',bevel=.03))
            o.append(box('tiang',px,.37+(FLOOR-.37)/2,pz,.22,FLOOR-.37,.22,TIMBER,DARKWOOD))
    o.append(box('floor bearer',x,FLOOR-.2,z,w+.2,.14,.2,TIMBER,DARKWOOD))
    o.append(box('floor deck',x,FLOOR-.07,z,w+.4,.14,d+.4,TIMBER,WOOD))
    for s in (-1,1):
        o.append(box('papan pemeleh',x+s*(hw+.21),FLOOR-.24,z,.06,.22,d+.44,PAPAN,trim))
        o.append(box('papan pemeleh',x,FLOOR-.24,z-hd-.21,w+.44,.22,.06,PAPAN,trim))
    # walls, corner posts, sill and wall plate
    H=WALLTOP-FLOOR
    o.append(box('wall',x,FLOOR+H/2,z,w,H,d,PAPAN,wall))
    for sx in (-1,1):
        for sz in (-1,1):o.append(box('corner post',x+sx*hw,FLOOR+H/2,z+sz*hd,.18,H,.18,TIMBER,DARKWOOD))
    o.append(box('sill',x,FLOOR+.08,z,w+.12,.14,d+.12,TIMBER,DARKWOOD))
    o.append(box('wall plate',x,WALLTOP-.1,z,w+.14,.2,d+.14,TIMBER,DARKWOOD))
    # front: doorway (lit inside at night), open leaves, kerawang fanlight under the sign line
    dw,dh=1.5,1.8
    o.append(box('doorway',x,FLOOR+dh/2,fz+.005,dw,dh,.02,WINDOW,'#2a211a'))
    for s in (-1,1):
        o.append(box('door leaf',x+s*(dw/2+.02),FLOOR+dh/2,fz+.36,.06,dh-.06,.7,PAPAN,trim))
        o.append(box('door jamb',x+s*(dw/2+.06),FLOOR+dh/2+.1,fz+.04,.12,dh+.2,.1,TIMBER,DARKWOOD))
    o.append(box('door head',x,FLOOR+dh+.06,fz+.04,dw+.36,.12,.1,TIMBER,DARKWOOD))
    kerawang(o,x,FLOOR+dh+.29,fz+.02,dw+.1,.34,(0,0,1))
    o.append(box('fanlight glow',x,FLOOR+dh+.29,fz-.01,dw,.3,.02,WINDOW,'#2a211a'))
    wins=[x-w*.3,x+w*.3]
    for px in wins:tingkap(o,px,fz,trim,(0,0,1))
    for s in (-1,1):tingkap(o,x+s*hw,z-hd*.3,trim,(s,0,0))
    # roof
    ov=.95;half=hw+ov;ey=WALLTOP-.02;rise=max(w*.36,3.8);ry=WALLTOP+rise
    zb,zf=z-hd-.95,fz+1.6
    if kind=='attap':roof(o,'attap roof',x,zb,zf,half,ey,ry,ATTAP,roofcol,t=.16,tile=1.5)
    else:roof(o,'zinc roof',x,zb,zf,half,ey,ry,ZINC,roofcol,t=.06,tile=2.0)
    o.append(strut('ridge cap',(x,ry+.03,zb-.05),(x,ry+.03,zf+.05),.28 if kind=='attap' else .2,TIMBER if kind=='attap' else ZINC_CAP,DARKWOOD if kind=='attap' else roofcol,h=.1))
    for gz,sgn in ((zf,1),(zb,-1)):
        for s in (-1,1):   # papan pemeleh along each rake, with a sulur bayung scroll at the eave
            o.append(strut('fascia board',(x+s*(half+.05),ey-.1,gz),(x,ry+.05,gz),.26,TIMBER,trim,h=.05))
            o.append(K.rock('sulur bayung',x+s*(half+.12),ey-.22,gz,.13,TIMBER,trim,squash=1.6,sub=1,rough=.1,seed=1))
        o.append(tube('tunjuk langit',[(x,ry+.02,gz),(x,ry+.55,gz+sgn*.1),(x,ry+.8,gz+sgn*.2)],[.06,.045,.02],TIMBER,trim,sides=6))
    # tebar layar gables (inset from the fascia) with a kerawang vent under the apex
    for gz,face in ((fz,1),(z-hd,-1)):
        tri=[(x-hw+.05,WALLTOP),(x,ry-.18),(x+hw-.05,WALLTOP)]
        o.append(paint(loft('tebar layar',[(gz-face*.02,tri),(gz+face*.04,tri)],PAPAN,'kampung'),wall))
        vy=WALLTOP+rise*.38
        kerawang(o,x,vy,gz+face*.05,w*.3,rise*.34,(0,0,face))
        o.append(box('gable vent glow',x,vy,gz-face*.02,w*.28,rise*.3,.02,WINDOW,'#2a211a'))
    # serambi: deck, posts, balusters either side of the stair opening, and a bulb
    vd=2.1;vz=fz+vd/2
    for px in (x-hw+.35,x-1.35,x+1.35,x+hw-.35):
        o.append(box('serambi footing',px,.22,fz+vd-.25,.4,.3,.4,CONCRETE,'#d6d0c4',bevel=.03))
        o.append(box('serambi post',px,.37+(FLOOR-.37)/2,fz+vd-.25,.18,FLOOR-.37,.18,TIMBER,DARKWOOD))
    o.append(box('serambi deck',x,FLOOR-.07,vz,w+.4,.14,vd,TIMBER,WOOD))
    o.append(box('serambi skirt',x,FLOOR-.26,fz+vd,w+.4,.24,.06,PAPAN,trim))
    rw=hw-1.35
    for s in (-1,1):
        cx=x+s*(1.35+rw/2)
        for y in (FLOOR+.95,FLOOR+.2):o.append(box('rail',cx,y,fz+vd-.1,rw+.2,.08,.1,TIMBER,trim))
        for i in range(max(2,int(rw/.18))):
            bx=cx-rw/2+.09+i*(rw-.18)/max(1,int(rw/.18)-1)
            o.append(cyl('jerejak',bx,FLOOR+.58,fz+vd-.1,.028,.7,TIMBER,trim,verts=6))
        o.append(box('rail newel',x+s*1.35,FLOOR+.55,fz+vd-.1,.14,1.1,.14,TIMBER,DARKWOOD))
        o.append(box('side rail',x+s*(hw+.1),FLOOR+.95,vz,.1,.08,vd,TIMBER,trim))
    o.append(K.rock('serambi bulb',x+hw*.55,3.34,fz+.2,.07,LAMP,'#fff3dc',squash=1.2,sub=1,rough=0))
    o.append(box('bulb holder',x+hw*.55,3.5,fz+.1,.06,.12,.12,TIMBER,DARKWOOD))
    o.append(quad('serambi pool',[(x-4,.13,fz+vd+3.6),(x+4,.13,fz+vd+3.6),(x+4,.13,fz-.6),(x-4,.13,fz-.6)],POOL,normal=(0,1,0)))
    # tangga batu: four concrete steps, patterned tile risers, scrolled cheek walls
    sw=2.3;run=.34;z0=fz+vd
    for k in range(1,5):
        top=FLOOR-k*.3;za,zb2=z0+(k-1)*run,z0+k*run
        o.append(box('step',x,top/2,(za+zb2)/2,sw,top,run,CONCRETE,'#e7e1d4'))
        riser(o,x,sw,top,za)
    for s in (-1,1):
        cx=x+s*(sw/2+.1)
        sec=lambda zz,h:(zz,[(cx-.1,0),(cx+.1,0),(cx+.1,h),(cx-.1,h)])
        o.append(paint(loft('tangga cheek',[sec(z0-.02,FLOOR+.85),sec(z0+4*run,.95),sec(z0+4*run+.25,.95)],CONCRETE,'kampung'),'#f0ebe0'))
        o.append(cyl('tangga scroll',cx,1.0,z0+4*run+.13,.17,.14,CONCRETE,'#f0ebe0',axis='x',verts=14))
    tempayan(o,x+sw/2+.55,z0+4*run-.2)
    return o

ZINC_CAP=K.flat('Kampung zinc cap',.5,.3)

def riser(o,x,sw,top,z,deck=False):
    """A tile riser face on the front of a step (0.3 m tall), UVs in metres / 0.6 m tile."""
    y0=top-(.24 if deck else .3);c=[(x-sw/2,y0,z),(x+sw/2,y0,z),(x+sw/2,top,z),(x-sw/2,top,z)]
    uv=[((x-sw/2)/.6,y0/.6),((x+sw/2)/.6,y0/.6),((x+sw/2)/.6,top/.6),((x-sw/2)/.6,top/.6)]
    ob=_obj('riser tiles',[K.pt(*p) for p in c],[(0,1,2,3)],TILES_UV,uvs=uv);orient(ob,(0,0,1));o.append(paint(ob))

TILES_UV=K.lathe_textured('Kampung riser tiles','tiles',.35,strength=.6)

def kerawang(o,x,y,z,w,h,normal):
    nx,_,nz=normal
    if abs(nz)>0:c=[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)]
    else:c=[(x,y-h/2,z-w/2),(x,y-h/2,z+w/2),(x,y+h/2,z+w/2),(x,y+h/2,z-w/2)]
    o.append(quad('kerawang',c,KERAWANG,uvs=((0,0),(max(1,round(w/h)),0),(max(1,round(w/h)),1),(0,1)),col='#b08560',normal=normal))

def tingkap(o,cx,cz,trim,normal):
    """Tall Malay window on a wall facing `normal`: dark (lit at night) opening, jerejak across the
    lower half, a kerawang panel above, and two louvred shutters swung open against the wall."""
    nx,_,nz=normal;ww,wh=1.1,1.3;y=FLOOR+.45+wh/2
    def at(a,d):return (cx+a*abs(nz)+d*nx,cz+a*abs(nx)+d*nz)   # a along the wall, d out of it
    def bx(name,a,yy,d,sa,sy,sd,m,col):
        px,pz=at(a,d);o.append(box(name,px,yy,pz,sa if nz else sd,sy,sd if nz else sa,m,col))
    bx('window opening',0,y,.005,ww,wh,.02,WINDOW,'#2a211a')
    for s in (-1,1):bx('window jamb',s*(ww/2+.05),y,.04,.1,wh+.1,.08,TIMBER,DARKWOOD)
    bx('window sill',0,y-wh/2-.05,.08,ww+.3,.08,.16,TIMBER,DARKWOOD)
    bx('window head',0,y+wh/2+.05,.05,ww+.24,.1,.1,TIMBER,DARKWOOD)
    for i in range(6):
        px,pz=at(-ww/2+.1+i*(ww-.2)/5,.05);o.append(cyl('jerejak',px,y-wh/4,pz,.022,wh/2,TIMBER,trim,verts=6))
    bx('jerejak rail',0,y,.05,ww,.05,.06,TIMBER,trim)
    px,pz=at(0,.02);kerawang(o,px,y+wh/2+.24,pz,ww+.1,.3,normal)
    for s in (-1,1):
        bx('shutter',s*(ww/2+.3),y,.06,.52,wh,.04,PAPAN,trim)
        for i in range(5):bx('shutter louvre',s*(ww/2+.3),y-wh/2+.18+i*(wh-.36)/4,.1,.42,.05,.04,TIMBER,trim)

def tempayan(o,x,z):
    """Glazed clay water jar with a dipper, at the foot of the stairs."""
    o.append(K.rock('tempayan',x,.45,z,.36,PAINTED,'#6b3b22',squash=1.2,sub=2,rough=.02))
    o.append(cyl('tempayan lip',x,.88,z,.2,.06,PAINTED,'#5a311c',verts=12))
    o.append(cyl('tempayan water',x,.9,z,.17,.01,PAINTED,'#3e4a44',verts=12))

# ---------------------------------------------------------------- trees
def durian(o,V,U,F,x,z,seed):
    """Durio zibethinus: a tall straight trunk, near-horizontal branches from half height, a narrow
    oval crown of bronze-backed leaves, spiky fruit hanging on the branches."""
    T=random.Random(seed);H=10.5+T.uniform(-.8,.8)
    o.append(tube('durian trunk',[(x,.08,z),(x+.1,H*.4,z-.05),(x+.05,H*.8,z+.08),(x,H,z)],[.3,.24,.16,.08],TIMBER,'#7d5f48',sides=9))
    for k in range(7):
        a=k*2.4+T.uniform(-.3,.3);y=H*(.38+.08*k);L=2.4-.22*k
        end=(x+math.cos(a)*L,y+.5,z+math.sin(a)*L)
        o.append(tube('durian branch',[(x,y,z),((x+end[0])/2,y+.35,(z+end[2])/2),end],[.09,.06,.03],TIMBER,'#7d5f48',sides=5))
        clump(V,U,F,end[0],end[1]+.2,end[2],1.25,.8,16,'durian',1.3,T,up_bias=.6)
        if k<4:
            for f in range(2):
                fx,fz=x+math.cos(a)*L*(.45+.2*f),z+math.sin(a)*L*(.45+.2*f)
                o.append(K.rock('durian fruit',fx,y+.05,fz,.17,PAINTED,'#5f5a2c',squash=1.15,sub=1,rough=.55,seed=k*3+f,smooth=False))
                o.append(strut('fruit stalk',(fx,y+.35,fz),(fx,y+.2,fz),.02,TIMBER,'#5a4632'))
    clump(V,U,F,x,H*.85,z,1.7,2.6,40,'durian',1.4,T,up_bias=.5)
    clump(V,U,F,x,H*.62,z,2.2,1.6,24,'durian',1.4,T,up_bias=.5)

def rambutan(o,V,U,F,x,z,seed):
    """Nephelium lappaceum: short trunk, low spreading limbs, a dense dome crown with red fruit."""
    T=random.Random(seed);H=5.6
    o.append(tube('rambutan trunk',[(x,.08,z),(x,1.4,z),(x+.2,2.1,z)],[.22,.18,.14],TIMBER,'#6e5846',sides=8))
    for k in range(4):
        a=k*1.57+T.uniform(-.3,.3);end=(x+math.cos(a)*1.8,3.6,z+math.sin(a)*1.8)
        o.append(tube('rambutan limb',[(x+.2,2.0,z),((x+end[0])/2,2.9,(z+end[2])/2),end],[.12,.08,.04],TIMBER,'#6e5846',sides=6))
        clump(V,U,F,end[0],3.9,end[2],1.3,.9,18,'rambutan',1.2,T,up_bias=.7)
    clump(V,U,F,x,4.6,z,1.9,1.1,30,'rambutan',1.3,T,up_bias=.7)

# ---------------------------------------------------------------- the yard
def gerbang(o):
    """Timber pintu gerbang: posts on their colliders at x=+-5, z=18; the sign board sits behind the
    canvas KAMPUNG DURIAN RUNTUH (z 18.22, y 4.45-5.55) and the attap roof clears it."""
    for s in (-1,1):
        px=s*5
        o.append(box('gerbang footing',px,.2,18,.8,.4,.8,CONCRETE,'#d6d0c4',bevel=.04))
        o.append(box('gerbang post',px,2.75,18,.36,4.7,.36,TIMBER,DARKWOOD))
        o.append(box('gerbang post cap',px,5.2,18,.52,.2,.52,TIMBER,'#5a4632'))
        o.append(strut('gerbang brace',(s*4.8,3.4,18),(s*4.1,4.15,18),.12,TIMBER,DARKWOOD,h=.14))
    o.append(box('gerbang board',0,5.0,18,11,1.5,.3,PAPAN,'#2f5a45'))
    for y in (4.2,5.8):o.append(box('gerbang rail',0,y,18.02,11.4,.14,.36,TIMBER,DARKWOOD))
    roof(o,'gerbang attap',0,17.0,19.0,6.3,6.1,7.1,ATTAP,'#d7c49c',t=.14,tile=1.5)
    o.append(strut('gerbang ridge',(0,7.13,16.95),(0,7.13,19.05),.26,TIMBER,'#5a4632',h=.1))
    kerawang(o,0,6.45,18.02,3.2,.5,(0,0,1))

def yard(o,V,U,F):
    # swing (buaian): posts on their colliders at x=-22 and -17, z=15
    for px in (-22,-17):
        o.append(box('swing footing',px,.14,15,.44,.2,.44,CONCRETE,'#d6d0c4'))
        for s in (-1,1):o.append(strut('swing leg',(px,.1,15+s*.9),(px,2.05,15),.14,TIMBER,DARKWOOD))
    o.append(strut('swing beam',(-22.2,2.05,15),(-16.8,2.05,15),.18,TIMBER,DARKWOOD))
    for px in (-20.5,-18.5):
        for s in (-1,1):o.append(strut('swing rope',(px+s*.35,2.0,15),(px+s*.35,.72,15),.025,TIMBER,'#c9b48a'))
        o.append(box('swing seat',px,.68,15,.9,.06,.34,TIMBER,WOOD))
    # raised vegetable beds with sayur
    for bx in (13,16,19):
        for bz in (-18,-16):
            for s in (-1,1):
                o.append(box('bed board',bx+s*.97,.28,bz,.06,.34,1.4,TIMBER,DARKWOOD))
                o.append(box('bed board',bx,.28,bz+s*.67,2.0,.34,.06,TIMBER,DARKWOOD))
            o.append(box('bed soil',bx,.36,bz,1.88,.12,1.28,HALAMAN,'#6f5846'))
            for dx in (-.55,0,.55):
                for dz in (-.3,.3):clump(V,U,F,bx+dx,.62,bz+dz,.22,.18,4,'shrub',.45,R,up_bias=.8)
    # trestle tables inside their 2.2 x 1.4 colliders, benches inside 3 x .7
    for tx in (14,21):
        for i in range(5):o.append(box('table plank',tx,.9,12-.56+i*.28,2.2,.05,.25,TIMBER,WOOD))
        for s in (-1,1):
            for dz in (-.5,.5):o.append(strut('table leg',(tx+s*.9,.1,12+dz),(tx+s*.8,.88,12+dz*.6),.08,TIMBER,DARKWOOD))
            o.append(box('table rail',tx+s*.82,.72,12,.06,.08,1.1,TIMBER,DARKWOOD))
    for bx in (-6,6):
        for i in range(3):o.append(box('bench slat',bx,.52,17-.22+i*.22,2.9,.05,.18,TIMBER,WOOD))
        for s in (-1,1):
            o.append(box('bench leg',bx+s*1.2,.26,17,.1,.5,.6,TIMBER,DARKWOOD))
    # badminton court: cement slab painted green, same lines, same post and net heights
    o.append(box('court slab',0,.15,9,8,.1,14,CONCRETE,'#6f9a86',bevel=.03))
    W=.05
    for lx in (-3.5,3.5):o.append(box('court line',lx,.203,9,W,.006,13,CONCRETE,'#f3efe2'))
    for lz in (2.5,7,11,15.5):o.append(box('court line',0,.203,lz,7+W,.006,W,CONCRETE,'#f3efe2'))
    for lz in (4.75,13.25):o.append(box('court line',0,.203,lz,W,.006,4.5,CONCRETE,'#f3efe2'))
    for px in (-3.8,3.8):
        o.append(box('post base',px,.24,9,.3,.08,.3,CONCRETE,'#c7c1b4'))
        o.append(cyl('net post',px,1.0,9,.04,1.6,PAINTED,'#e9e4d2',verts=10))
    o.append(quad('badminton net',[(-3.75,.95,9),(3.75,.95,9),(3.75,1.68,9),(-3.75,1.68,9)],NET,uvs=((-3.75/.2,.95/.2),(3.75/.2,.95/.2),(3.75/.2,1.68/.2),(-3.75/.2,1.68/.2)),col='#f1efe6'))
    o.append(box('net tape',0,1.72,9,7.6,.06,.02,PAINTED,'#f7f3e6'))
    # Opah's washing line: the wire stays at y=2.35 so the pegged towels still grip it
    for px in (-13,-7):
        o.append(box('line footing',px,.14,-2.5,.3,.12,.3,CONCRETE,'#d6d0c4'))
        o.append(box('line post',px,1.3,-2.5,.1,2.4,.1,TIMBER,DARKWOOD))
        for s in (-1,1):o.append(strut('fork',(px,2.28,-2.5),(px,2.6,-2.5-s*.22),.06,TIMBER,DARKWOOD))
    o.append(strut('washing line',(-13,2.35,-2.5),(-7,2.35,-2.5),.018,PAINTED,'#e4dfd0'))
    # a second line of batik sarongs behind Rumah Opah
    for px in (-20.5,-12.5):
        o.append(box('batik line post',px,1.1,-18.3,.09,2.0,.09,TIMBER,DARKWOOD))
    sag=lambda t:2.08-.12*math.sin(math.pi*t)
    o.append(tube('batik line',[(-20.5+8*t,sag(t),-18.3) for t in (0,.25,.5,.75,1)],.012,PAINTED,'#e4dfd0',sides=4))
    for i,(t0,t1,col) in enumerate(((.06,.24,'#ffffff'),(.28,.46,'#c9e0f0'),(.52,.7,'#f5d2b0'),(.75,.93,'#d8f0c8'))):
        xa,xb=-20.5+8*t0,-20.5+8*t1;h=1.05+.08*i
        c=[(xa,sag(t0)-h,-18.3+.02*i),(xb,sag(t1)-h+.03,-18.3+.02*i),(xb,sag(t1),-18.3),(xa,sag(t0),-18.3)]
        uv=[(xa,sag(t0)-h),(xb,sag(t1)-h),(xb,sag(t1)),(xa,sag(t0))]
        o.append(paint(_obj('batik sarong',[K.pt(*p) for p in c],[(0,1,2,3)],BATIK_UV,uvs=uv),col))
        for xp in (xa+.05,xb-.05):o.append(box('peg',xp,sag((xp+20.5)/8)-.02,-18.28,.03,.08,.03,PAINTED,'#c4442e'))
    # rattan laundry basket on its collider
    from build_klcc import vloft
    rect=lambda cx,cz,w,d:[(cx-w/2,cz-d/2),(cx+w/2,cz-d/2),(cx+w/2,cz+d/2),(cx-w/2,cz+d/2)]
    o.append(paint(vloft('basket',[(.1,rect(-11,3.7,.68,.5)),(.56,rect(-11,3.7,.82,.62))],[ATTAP_WALL],'kampung',cap=False),'#caa26c'))
    o.append(box('basket base',-11,.12,-3.7,.68,.05,.5,TIMBER,'#b58c5a'))
    o.append(box('basket rim',-11,.57,-3.7,.86,.05,.66,TIMBER,'#8f6a42'))
    o.append(box('folded cloth',-11,.6,-3.7,.6,.12,.42,BATIK,'#f2ece0'))
    # water tank on a timber stand beside Rumah Opah
    tx,tz=-25.3,-9.2
    for sx in (-1,1):
        for sz in (-1,1):o.append(box('tank stand leg',tx+sx*.55,1.05,tz+sz*.55,.14,1.9,.14,TIMBER,DARKWOOD))
    o.append(box('tank platform',tx,2.05,tz,1.4,.1,1.4,TIMBER,WOOD))
    o.append(cyl('water tank',tx,2.72,tz,.58,1.24,PAINTED,'#2e63a8',verts=20))
    o.append(cyl('tank lid',tx,3.38,tz,.28,.08,PAINTED,'#27548e',verts=14))
    for k in range(3):o.append(cyl('tank rib',tx,2.35+k*.35,tz,.6,.04,PAINTED,'#2a5a98',verts=20))
    o.append(tube('tank pipe',[(tx+.55,2.3,tz),(tx+1.2,2.3,tz),(tx+1.2,.3,tz)],.03,PAINTED,'#d9d6cc',sides=6))
    kapcai(o,26.6,7.2,.9)
    for x,z,sd in ((-25,-17,1),(25,-17,2),(-25,16,3),(25,16,4)):durian(o,V,U,F,x,z,sd)
    for x,z,sd in ((8.4,-19,5),(-8.4,-19,6),(-26.8,-5.0,7)):rambutan(o,V,U,F,x,z,sd)
    # slim posts under the game's floating BADMINTON PETANG sign (x +-3.5, y 2.48-3.13, z 1.7)
    for sx in (-1,1):o.append(box('sign post',sx*3.62,1.62,1.66,.08,3.0,.08,TIMBER,DARKWOOD))
    o.append(box('sign rail',0,3.17,1.66,7.36,.07,.06,TIMBER,DARKWOOD))

ATTAP_WALL=K.textured('Kampung rattan','thatch',.9,.4,two_sided=True,source=pbr_textures)
BATIK_UV=K.lathe_textured('Kampung batik sarong','batik',.85);BATIK_UV.use_backface_culling=False

def kapcai(o,x,z,yaw):
    """A Honda Cub-style kapcai parked at the warung: tyres, spoked hubs, leg shield, red body,
    black seat, chrome handlebar with a headlamp and a wire basket."""
    L=K.frame_of(x,z,yaw,1.0)
    def P(a,b,c):return L((a,b,c))
    for wz in (-.62,.62):
        c=P(0,.3,wz)
        bpy.ops.mesh.primitive_torus_add(location=K.pt(*c),major_radius=.26,minor_radius=.055,major_segments=18,minor_segments=6,rotation=(0,math.pi/2,0))
        t=bpy.context.object;t.rotation_euler.z=yaw;t.name='tyre';t.data.materials.append(PAINTED);t['asset']='kampung';o.append(paint(t,'#1c1c1c'))
        o.append(strut('hub',P(-.06,.3,wz),P(.06,.3,wz),.16,PAINTED,'#b9bcbc'))
    o.append(strut('fork',P(0,.3,.62),P(0,.95,.42),.05,PAINTED,'#a9acac'))
    o.append(strut('rear swingarm',P(0,.3,-.62),P(0,.42,-.05),.06,PAINTED,'#2a2a2a'))
    o.append(strut('leg shield',P(0,.36,.28),P(0,.92,.36),.42,PAINTED,'#e8e2d2',h=.12))
    o.append(strut('underbone',P(0,.4,.25),P(0,.56,-.3),.14,PAINTED,'#a8322a'))
    o.append(strut('body cover',P(0,.52,-.2),P(0,.62,-.72),.34,PAINTED,'#b7362c',h=.32))
    o.append(strut('seat',P(0,.84,-.05),P(0,.84,-.62),.28,PAINTED,'#1e1e1e',h=.08))
    o.append(strut('handlebar stem',P(0,.95,.42),P(0,1.1,.36),.05,PAINTED,'#b9bcbc'))
    o.append(strut('handlebar',P(-.32,1.1,.34),P(.32,1.1,.34),.03,PAINTED,'#c7caca'))
    o.append(strut('headlamp',P(0,1.02,.46),P(0,1.02,.56),.14,PAINTED,'#e9e4c8'))
    o.append(strut('front mudguard',P(0,.58,.5),P(0,.52,.8),.14,PAINTED,'#b7362c',h=.04))
    o.append(strut('basket',P(0,.98,.62),P(0,.98,.88),.3,PAINTED,'#3a3a3a',h=.2))
    o.append(strut('side stand',P(.12,.3,-.1),P(.26,.02,-.05),.025,PAINTED,'#2a2a2a'))

# ---------------------------------------------------------------- build
def village():
    V,U,F=[],[],[]
    o=ground(V,U,F)
    for x,z,w,d,col,nx,nz in HOUSES:house(o,V,U,F,x,z,w,d,col,nx,nz)
    gerbang(o);yard(o,V,U,F)
    o.append(cards('kampung foliage',V,U,F,LEAVES))
    return [ob for ob in o if ob is not None]

if __name__=='__main__':
    root=bpy.data.objects.new('kampung',None);bpy.context.scene.collection.objects.link(root)
    for ob in village():ob.parent=root
    K.export(root,PUBLIC/'LM_ENV_Kampung.glb',OUT/'manifest.json','Kampung',{'origin':[122,0,-132]})
