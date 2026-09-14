"""Basket Lepak and Pickleball Lepak, the two public courts behind Pantai Senja, photographic pass.

What is here
  * acrylic hard courts on a concrete slab: blue playing areas, green surrounds and key/kitchen,
    the coating's grit, squeegee arcs, scuffs and ball marks (district_textures.acrylic), with
    vertex-colour wear where play concentrates (under the rims, the free-throw lanes, the kitchen)
  * painted lines at the dimensions below (shared/*.json for everything the server reads)
  * basketball: goose-neck hoops on padded posts, white boards with the red target square, rims and
    knotted string nets, chain-link ball-stop screens behind both baselines, four floodlight poles,
    concrete-and-timber spectator benches and bins outside the apron
  * pickleball: sagging net on round posts with tape and centre strap, courtside benches, the
    ball-stop screen behind the far baseline, four floodlight poles, and the posts and frame that
    carry the game's canvas PICKLEBALL LEPAK sign
  * night (src/district-night.ts): floodlight lenses glow and additive pools of light fall on the
    courts, only after dark

Gameplay geometry is unchanged: rim centre y=3.05 at z=+-hoopOffset with the 'Rim orange'
material tests look for, the goose-neck post on its world.solids collider at z=+-12.2, the
pickleball net on its collider line (z=0, posts at x=+-3.4, top 1.00 m sagging from 1.075), the
16 x 26 and 12 x 20 aprons, and both sidelines left open. No collider is added; the canvas signs
stay the game's.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_courts.py

Output: public/assets/models/environment/LM_ENV_{Basketball,Pickleball}.glb (meshopt), report in
assets/courts/manifest.json. Textures are written to assets/courts/textures (ignored).
"""
import bpy, math, json, sys, random
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import district_kit as K
from district_kit import grid, ribbon, quad, strut, tube, paint
from brand_kit import box, cyl
import pbr_textures, ground_textures as GT
from mathutils import noise, Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/courts';PUBLIC=ROOT/'public/assets/models/environment'
BASKET=json.loads((ROOT/'shared/basketball.json').read_text());PICKLE=json.loads((ROOT/'shared/pickleball.json').read_text())
K.setup('courts',OUT/'textures',20260914)

ACRYLIC=K.textured('Ground acrylic','acrylic',.78,3.0,strength=.5)
SLAB=K.textured('Court concrete','acrylic',.92,1.2)   # the coating's grit reads as cast concrete; no second texture set
STEEL=K.flat('Galvanised steel',.38,.55)
PAINTED=K.flat('Painted steel',.5,.15)
BOARD=K.flat('Backboard',.28)
RIM=K.flat('Rim orange',.4,.35)
LINK=K.masked('Chain link','chainlink',.42,tile=.4,cutoff=.4)
NET=K.masked('Net cord','netting',.85,cutoff=.45)
TIMBER=K.textured('Bench timber','wood',.72,.9,source=pbr_textures)
LENS=K.glow('floodlight','#f4f7ff')
POOL=K.wash('floodlight')

BLUE,GREEN,KEYGREEN,KITCHEN='#2c5f8e','#3d7653','#467f5a','#4f8a67'
LINE='#f4f3ec';NAVY='#20324a';RED='#b63a2e';GREY='#3b4043';ORANGE='#e0692e'
Y0=.18;YL=.19   # acrylic top (the ball rests at .25) and the line paint above it

def hexlin(h):return K.srgb(h)
def worn(base,spots,amount=.35):
    """Per-vertex colour: the zone colour, mottled, lightened and greyed where play wears it."""
    b=hexlin(base)
    def f(x,z):
        w=sum(math.exp(-((x-sx)**2+(z-sz)**2)/(r*r))*k for sx,sz,r,k in spots)
        n=1+.07*noise.noise(Vector((x*.19,z*.19,1.3)))+.03*noise.noise(Vector((x*.9,z*.9,4.1)))
        w=min(1,w*(.8+.4*noise.noise(Vector((x*.6,z*.6,2.2)))))
        grey=sum(b)/3*1.3
        return tuple((c*(1-w*amount)+grey*w*amount)*n*1.05 for c in b)
    return f

def rects_minus(x0,x1,z0,z1,hx0,hx1,hz0,hz1):
    """A rect with one inner rect cut out, as four rects."""
    return [(x0,x1,z0,hz0),(x0,x1,hz1,z1),(x0,hx0,hz0,hz1),(hx1,x1,hz0,hz1)]

def zones(o,name,parts,colour):
    for x0,x1,z0,z1 in parts:
        if x1-x0>1e-3 and z1-z0>1e-3:o.append(grid(name,x0,x1,z0,z1,Y0,ACRYLIC,colour))

def line(o,a,b,w):
    """Straight line extended by half its width so corners close."""
    dx,dz=b[0]-a[0],b[1]-a[1];L=math.hypot(dx,dz);ex,ez=dx/L*w/2,dz/L*w/2
    o.append(ribbon('line',[(a[0]-ex,a[1]-ez),(b[0]+ex,b[1]+ez)],w,YL,ACRYLIC,LINE))

def arc(cx,cz,r,a0,a1,n=28):return [(cx+r*math.cos(a0+(a1-a0)*i/n),cz+r*math.sin(a0+(a1-a0)*i/n)) for i in range(n+1)]

def slab(o,w,d):
    o.append(box('court slab',0,Y0/2-.003,0,w+.3,Y0-.006,d+.3,SLAB,'#d8d4ca',bevel=.02))

def screen(o,z,half,top,posts,poles):
    """Chain-link ball stop: galvanised posts and rails, the mesh on its own card, and floodlight
    poles standing in for the end posts."""
    for i in range(posts):
        x=-half+2*half*i/(posts-1)
        if poles and i in (0,posts-1):continue
        o.append(cyl('screen post',x,(Y0+top)/2,z,.045,top-Y0,STEEL,'#c9cfcf',verts=8))
    for y in (Y0+.12,Y0+(top-Y0)*.55,top-.04):o.append(strut('screen rail',(-half,y,z),(half,y,z),.045,STEEL,'#c9cfcf'))
    o.append(quad('chain link',[(-half,Y0+.08,z),(half,Y0+.08,z),(half,top,z),(-half,top,z)],LINK,col='#e2e6e4',normal=(0,0,1)))

def floodlight(o,x,z,height,aim):
    """Tapered steel pole on a base plate, a crossarm and two LED flood heads tilted at `aim`."""
    o.append(box('pole base plate',x,Y0+.03,z,.5,.06,.5,STEEL,'#b9bfbf'))
    o.append(tube('floodlight pole',[(x,Y0,z),(x,height*.5,z),(x,height,z)],[.11,.085,.06],STEEL,'#c3c9c9',sides=10))
    ax,az=aim[0]-x,aim[1]-z;L=math.hypot(ax,az);ax,az=ax/L,az/L;sx,sz=-az,ax
    top=height+.1
    o.append(strut('crossarm',(x-sx*.75,top,z-sz*.75),(x+sx*.75,top,z+sz*.75),.07,STEEL,'#c3c9c9'))
    for s in (-.55,.55):
        hx,hz=x+sx*s+ax*.12,z+sz*s+az*.12
        d=Vector((aim[0]-hx,Y0-top,aim[1]-hz)).normalized()
        c=Vector((hx,top-.18,hz))
        o.append(strut('flood bracket',(x+sx*s,top,z+sz*s),tuple(c),.04,STEEL,'#9ea4a4'))
        o.append(strut('flood housing',tuple(c-d*.06),tuple(c+d*.06),.52,PAINTED,GREY,h=.4))
        o.append(strut('flood lens',tuple(c+d*.06),tuple(c+d*.075),.46,LENS,'#e9eef2',h=.34))

def pool(o,cx,cz,w,d):
    o.append(quad('floodlight pool',[(cx-w/2,YL+.012,cz+d/2),(cx+w/2,YL+.012,cz+d/2),(cx+w/2,YL+.012,cz-d/2),(cx-w/2,YL+.012,cz-d/2)],POOL,normal=(0,1,0)))

def bench(o,x,z,facing,length=2.2):
    """Park bench: two cast concrete legs, four timber seat slats and a two-slat back."""
    c=math.cos(facing);s=math.sin(facing)     # facing: direction the sitter looks, in the x/z plane
    def P(u,v):return (x+u*c-v*s,z+u*s+v*c)   # u across the bench (toward the view), v along it
    for v in (-length/2+.2,length/2-.2):
        lx,lz=P(-.05,v);o.append(box('bench leg',lx,.22,lz,.42 if abs(c)>.5 else .12,.44,.12 if abs(c)>.5 else .42,SLAB,'#cfcac0'))
    for i in range(4):
        u=.16-i*.11;a=P(u,-length/2);b=P(u,length/2)
        o.append(strut('bench slat',(a[0],.47,a[1]),(b[0],.47,b[1]),.09,TIMBER,'#b3875a',h=.035))
    for i in range(2):
        a=P(-.28,-length/2);b=P(-.28,length/2);y=.66+i*.16
        o.append(strut('bench back slat',(a[0],y,a[1]),(b[0],y,b[1]),.12,TIMBER,'#b3875a',h=.035))
    for v in (-length/2+.2,length/2-.2):
        a=P(-.2,v);b=P(-.3,v);o.append(strut('bench back post',(a[0],.44,a[1]),(b[0],.9,b[1]),.06,PAINTED,GREY))

def bin_(o,x,z):
    """Green tong sampah with a flip lid, on a short post."""
    o.append(cyl('bin',x,.52,z,.24,.72,PAINTED,'#2f6b3c',verts=14))
    o.append(cyl('bin lid',x,.91,z,.26,.06,PAINTED,'#27562f',verts=14))
    o.append(cyl('bin foot',x,.1,z,.2,.2,SLAB,'#bdb9b0',verts=10))

# ---------------------------------------------------------------- basketball
HOOP=BASKET['hoopOffset'];BOARDZ=11.2;POSTZ=12.2;RIMY=3.05

def hoop(o,s):
    zp=s*POSTZ;zb=s*BOARDZ;zr=s*HOOP
    o.append(box('post footing',0,Y0+.05,zp,.9,.1,.9,SLAB,'#c6c1b7',bevel=.02))
    o.append(box('post padding',0,Y0+.95,zp,.46,1.7,.46,PAINTED,NAVY,bevel=.05))
    o.append(cyl('post shaft',0,1.83,zp,.1,3.3,STEEL,'#d0d5d5',verts=12))
    curve=[(0,3.41+.54*math.sin(i/4*math.pi/2),zp-s*.80*(1-math.cos(i/4*math.pi/2))) for i in range(5)]
    o.append(tube('goose neck',curve,.085,STEEL,'#d0d5d5',sides=10))
    neck=curve[-1]
    for sx in (-1,1):o.append(strut('board arm',(sx*.08,neck[1]-.02,neck[2]),(sx*.6,3.82,zb+s*.04),.07,STEEL,'#c6cbcb'))
    o.append(strut('board brace',(0,3.2,zb+s*.05),(0,2.7,zp-s*.06),.07,STEEL,'#c6cbcb'))
    o.append(box('backboard',0,3.6,zb,1.8,1.15,.05,BOARD,'#f2f1ec'))
    fz=zb-s*.028
    for sx in (-1,1):o.append(box('board border',sx*.875,3.6,fz,.05,1.15,.006,PAINTED,RED))
    for yy in (3.05,4.15):o.append(box('board border',0,yy,fz,1.8,.05,.006,PAINTED,RED))
    for sx in (-1,1):o.append(box('target square',sx*.295,3.3,fz-s*.001,.05,.45,.006,PAINTED,RED))
    for yy in (3.1,3.5):o.append(box('target square',0,yy,fz-s*.001,.64,.05,.006,PAINTED,RED))
    o.append(box('board edge pad',0,3.02,zb,1.84,.07,.1,PAINTED,NAVY,bevel=.02))
    o.append(box('rim bracket',0,RIMY-.01,(zb+zr)/2+s*.1675,.2,.06,abs(zb-zr)-.39,RIM,ORANGE))
    bpy.ops.mesh.primitive_torus_add(location=K.pt(0,RIMY,zr),major_radius=.375,minor_radius=.02,major_segments=28,minor_segments=6)
    rim=bpy.context.object;rim.name='rim';rim.data.materials.append(RIM);rim['asset']='courts'
    for f in rim.data.polygons:f.use_smooth=True
    o.append(paint(rim,ORANGE))
    for k in range(10):   # the hooks the net hangs from, under the rim
        a=2*math.pi*k/10;o.append(box('net hook',.375*math.cos(a),RIMY-.035,zr+.375*math.sin(a),.02,.05,.02,RIM,ORANGE))
    # the net: an open cone of knotted cord (diamond mesh from the UVs), narrowing and flaring slightly
    N,M=16,5;verts=[];uvs=[];faces=[]
    for j in range(M+1):
        t=j/M;r=.36-.17*t+.02*t*t;y=RIMY-.03-.5*t
        for i in range(N+1):
            a=2*math.pi*i/N;verts.append(K.pt(r*math.cos(a),y,zr+r*math.sin(a)));uvs.append((i/4,j/4))
    faces=[(j*(N+1)+i,j*(N+1)+i+1,(j+1)*(N+1)+i+1,(j+1)*(N+1)+i) for j in range(M) for i in range(N)]
    o.append(paint(K._obj('hoop net',verts,faces,NET,uvs=uvs),'#f5f3ea'))

def basketball():
    o=[];hx,hz=BASKET['halfWidth'],BASKET['halfLength']
    slab(o,16,26)
    spots=[(0,s*8.2,3.2,.75) for s in (-1,1)]+[(0,s*10.2,1.6,.6) for s in (-1,1)]+[(0,0,2.2,.35)]
    zones(o,'court surround',rects_minus(-8,8,-13,13,-hx,hx,-hz,hz),worn(GREEN,[],.2))
    parts=[(-hx,hx,-6.6,6.6)]+[p for s in (-1,1) for p in ((-hx,-2.4,*sorted((s*6.6,s*hz))),(2.4,hx,*sorted((s*6.6,s*hz))))]
    zones(o,'court blue',parts,worn(BLUE,spots))
    for s in (-1,1):zones(o,'key paint',[(-2.4,2.4,*sorted((s*6.6,s*hz)))],worn(KEYGREEN,spots))
    W=.08;e=hx-W/2;f=hz-W/2
    for a,b in (((-e,-f),(e,-f)),((e,-f),(e,f)),((e,f),(-e,f)),((-e,f),(-e,-f)),((-e,0),(e,0))):line(o,a,b,W)
    o.append(ribbon('centre circle',arc(0,0,1.8,0,2*math.pi,40)[:-1],W,YL,ACRYLIC,LINE,closed=True))
    for s in (-1,1):
        for a,b in (((2.4,s*f),(2.4,s*6.6)),((-2.4,s*f),(-2.4,s*6.6)),((-2.4,s*6.6),(2.4,s*6.6))):line(o,a,b,W)
        o.append(ribbon('free throw circle',arc(0,s*6.6,1.8,0,2*math.pi,36)[:-1],W,YL,ACRYLIC,LINE,closed=True))
        dz=math.sqrt(6.75**2-6.6**2);a0=math.atan2(dz,6.6)
        three=arc(0,s*HOOP,6.75,a0,math.pi-a0) if s<0 else arc(0,s*HOOP,6.75,-a0,-(math.pi-a0))
        o.append(ribbon('three point',[(6.6,s*f)]+three+[(-6.6,s*f)],W,YL,ACRYLIC,LINE))
        nc=arc(0,s*HOOP,1.25,0,math.pi,14) if s<0 else arc(0,s*HOOP,1.25,0,-math.pi,14)
        o.append(ribbon('no charge arc',nc,W*.8,YL,ACRYLIC,LINE))
        for k in (1,2,3):line(o,(-2.4-.02,s*(6.6+k*.95)),(-2.4-.18,s*(6.6+k*.95)),W*.7);line(o,(2.4+.02,s*(6.6+k*.95)),(2.4+.18,s*(6.6+k*.95)),W*.7)
        hoop(o,s)
        screen(o,s*12.85,7.8,3.6,5,True)
        for x in (-7.8,7.8):floodlight(o,x,s*12.85,8.5,(x*.3,s*5.5))
        for x in (-7.8,7.8):pool(o,x*.35,s*6.2,10,14)
        for x in (-1,1):
            bench(o,x*9.7,s*4.6,math.pi if x>0 else 0)
        bin_(o,s*9.8,-s*.4)
    return o

# ---------------------------------------------------------------- pickleball
def pnet(o):
    def top(x):return 1.00+.075*(abs(x)/3.4)**2
    xs=[-3.34+6.68*i/20 for i in range(21)];bottom=.26
    verts=[];uvs=[];faces=[]
    for i,x in enumerate(xs):
        verts+= [K.pt(x,bottom,0),K.pt(x,top(x)-.05,0)];uvs+=[(x/.25,bottom/.25),(x/.25,(top(x)-.05)/.25)]
    for i in range(20):faces.append((2*i,2*i+2,2*i+3,2*i+1))
    o.append(paint(K._obj('pickleball net',verts,faces,NET,uvs=uvs),'#1d2a26'))
    prof=[(x,top(x)) for x in xs]+[(x,top(x)-.055) for x in reversed(xs)]
    from build_lrt import loft
    o.append(paint(loft('net tape',[(-.014,prof),(.014,prof)],PAINTED,'courts'),'#f2f1ea'))
    o.append(strut('net bottom cord',(-3.34,bottom,0),(3.34,bottom,0),.012,PAINTED,'#1d2a26'))
    o.append(box('centre strap',0,(bottom+1.0)/2,0,.05,1.0-bottom,.018,PAINTED,'#f2f1ea'))
    for sx in (-1,1):
        o.append(box('post sleeve',sx*3.4,Y0+.01,0,.16,.02,.16,STEEL,'#aeb4b4'))
        o.append(cyl('net post',sx*3.4,(Y0+1.1)/2,0,.04,1.1-Y0,PAINTED,'#27463a',verts=12))
        o.append(cyl('post cap',sx*3.4,1.11,0,.05,.03,PAINTED,'#27463a',verts=12))
        o.append(strut('net tension cord',(sx*3.34,top(3.3)-.03,0),(sx*3.4,1.05,0),.012,PAINTED,'#1d2a26'))

def pickleball():
    o=[];hx,hz=PICKLE['halfWidth'],PICKLE['halfLength'];aw,al=PICKLE['apronWidth'],PICKLE['apronLength'];kz=2.13
    slab(o,aw*2,al*2)
    spots=[(0,s*1.2,2.0,.5) for s in (-1,1)]+[(sx*1.5,s*6.4,1.1,.6) for s in (-1,1) for sx in (-1,1)]
    zones(o,'court surround',rects_minus(-aw,aw,-al,al,-hx,hx,-hz,hz),worn(GREEN,[],.2))
    zones(o,'court blue',[(-hx,hx,-hz,-kz),(-hx,hx,kz,hz)],worn(BLUE,spots))
    zones(o,'kitchen',[(-hx,hx,-kz,kz)],worn(KITCHEN,spots))
    W=.05;e=hx-W/2;f=hz-W/2
    for a,b in (((-e,-f),(e,-f)),((e,-f),(e,f)),((e,f),(-e,f)),((-e,f),(-e,-f))):line(o,a,b,W)
    for s in (-1,1):
        line(o,(-e,s*kz),(e,s*kz),W);line(o,(0,s*kz),(0,s*f),W)
    pnet(o)
    for sx in (-1,1):bench(o,sx*5.25,0,math.pi if sx>0 else 0,1.9)
    bin_(o,5.4,-3.2)
    screen(o,9.5,5.7,3.0,4,True)
    for s in (-1,1):
        for x in (-5.7,5.7):floodlight(o,x,s*9.5,7.0,(x*.25,s*3.2))
        for x in (-5.7,5.7):pool(o,x*.3,s*4.2,6.5,9)
    # the posts and frame that carry the game's canvas sign (a 7 x 1.75 plane at y=3, z=-10.2)
    for sx in (-1,1):
        o.append(box('sign post',sx*3.62,2.0,-10.2,.1,3.9,.1,PAINTED,'#2e4c40'))
        o.append(cyl('sign post cap',sx*3.62,3.97,-10.2,.07,.04,PAINTED,'#2e4c40',verts=8))
    for y in (2.08,3.92):o.append(box('sign frame',0,y,-10.2,7.34,.08,.06,PAINTED,'#2e4c40'))
    for sx in (-1,1):o.append(box('sign frame',sx*3.54,3.0,-10.2,.08,1.92,.06,PAINTED,'#2e4c40'))
    return o

# ---------------------------------------------------------------- build / export
def build(name,fn):
    root=bpy.data.objects.new(name.lower(),None);bpy.context.scene.collection.objects.link(root)
    for ob in fn():
        if ob is not None:ob.parent=root
    return root

if __name__=='__main__':
    for name,fn in (('Basketball',basketball),('Pickleball',pickleball)):
        root=build(name,fn)
        K.export(root,PUBLIC/f'LM_ENV_{name}.glb',OUT/'manifest.json',name)
        for c in list(root.children):bpy.data.objects.remove(c,do_unlink=True)
        bpy.data.objects.remove(root,do_unlink=True)
