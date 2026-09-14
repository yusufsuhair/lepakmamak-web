"""Generic Kuala Lumpur shophouses (kedai dua tingkat), photographic pass: a modular kit that
src/shoplots.ts assembles into every generic shop()/retail() row in src/world.ts that is not a
branded GLB (those stay with shared/mamak-shops.json).

The kit is one unit bay of a 1970s-80s two-storey shophouse row, 6.5 m wide, in the building frame
world.ts uses (x across, y up, front face on z = +6, back on z = -6, centre on the ground):
  * frame     the bay itself: five-foot-way on a 55 cm plinth in red quarry tiles, half columns with
              bases and capitals at each party wall (two bays make one column), exposed soffit
              beams, the fascia beam that carries the game's canvas signboard, upper floor with two
              openings, sills, hoods, shallow pilasters, stepped cornice, parapet with a raised
              panel and coping, zinc roof behind it, back wall with gutter and downpipe, the shop
              interior shell (lit ceiling tubes, atlas back wall), pendant lamp, downpipe, conduit
  * upper_*   what fills the two openings: aluminium casements with steel grilles and an air-con
              condenser; timber louvred shutters with a flower pot; sliding windows behind a box
              grille with a laundry pole
  * front_*   the shopfront in the arcade: shutters rolled up (open) or an aluminium glass front
  * props_*   per trade, two variants: kopitiam tables and stools, grocery crates and sacks,
              hardware buckets, brooms and a ladder, laundry machines, standing fans and cartons
  * awning    a zinc canopy on brackets with a painted valance, per bay
  * end_l/_r  the plain party wall at each end of a row, with the corner column, drainpipe, meter
              box, and caps for every moulding that projects past the front face
  * sign, sign_cap_l/_r  the aluminium lightbox behind the canvas sign (1 m long, stretched)

Contract with src/shoplots.ts (node extras, exported with export_extras):
  node  lm_class   wall | trim | base | shade | soffit | interior | accent | signbg | joinery | grille | glass | fixed
                   the runtime multiplies the vertex colour by the building's colour for that class
        lm_window  0/1 on window glass, so each window can be lit on its own at night
  material  tile   texture size in metres: the runtime projects those UVs in world space, so the
                   render and tiles flow across bays and buildings; materials without it keep UVs
  Material names starting 'Night' emit only at night.
Colliders, map footprints and the canvas signs stay in world.ts. Heights are shared constants below.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_shoplots.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Shoplots.glb
"""
import bpy, math, json, sys, random
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt
import pbr_kit as kit
from pbr_kit import srgb
import shoplot_textures as ST

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/shoplots'; (OUT/'textures').mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
T='shoplots'
kit.setup(T,OUT/'textures',20260915)

# ------------------------------------------------------------------ dimensions (shared with src/shoplots.ts)
U=6.5; H=U/2                       # authored bay width; the runtime stretches it to fit the row
FRONT,BACK=6.0,-6.0
PL=.55                             # five-foot-way floor
NOSE=6.28                          # front edge of the plinth
SHOP_Z=3.8                         # shopfront line
INT_Z=-.6                          # interior back wall
SOFFIT=3.3
SIGN0,SIGN1=3.34,4.70              # lightbox, around the canvas sign (world.ts: y 3.96 / 4.02)
LEDGE=4.72
SILL,HEAD=5.55,7.75
WINS=((-1.6,1.9),(1.6,1.9))        # window centre x, width
CORNICE=8.55;PARAPET=9.0;COPE0,COPE1=10.6,10.85
ROOF_F,ROOF_B=(5.68,10.15),(-6.3,8.3)
BACK_TOP=8.34                      # the roof crosses the back wall here
JAMB=2.9                           # shop opening half width
OPEN_TOP=2.95

# ------------------------------------------------------------------ materials
def P(name,kind,tint,rough,tile,**kw):return kit.pbr(name,kind,tint,rough,tile,source=ST,**kw)
RENDER=P('Shoplot render','render','#ffffff',.9,3.0,strength=.8)
TILES=P('Shoplot five-foot-way tiles','tiles','#ffffff',.62,1.2)
SHUTTER=P('Shoplot roller shutter','shutter','#ffffff',.42,1.0)
ZINC=P('Shoplot zinc','zinc','#ffffff',.55,2.0)
for m in (SHUTTER,ZINC):m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.45

def plain(name,rough=.55,metal=0.0,alpha=1.0,emit=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value=(1,1,1,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if alpha<1:p.inputs['Alpha'].default_value=alpha;m.surface_render_method='BLENDED'
    if emit:p.inputs['Emission Color'].default_value=(*srgb(emit),1);p.inputs['Emission Strength'].default_value=1.0
    return m

def atlas_mat(name,image,rough,emit=False):
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF']
    tx=nt.nodes.new('ShaderNodeTexImage');tx.image=image;nt.links.new(tx.outputs['Color'],p.inputs['Base Color'])
    if emit:nt.links.new(tx.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=1.0
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=0
    return m

FIX=plain('Shoplot fixtures',.5,.15)
ATLAS=kit.image('atlas',ST.atlas())
INTERIOR=atlas_mat('Night shop interior',ATLAS,.9,emit=True)
WINDOW=atlas_mat('Night window glass',ATLAS,.14,emit=True)
GLASS=plain('Shoplot shopfront glass',.05,0,alpha=.28)
LAMP=plain('Night lamp',.4,0,emit='#fff2d6')
WASH=atlas_mat('Night wash',kit.image('wash',ST.wash()),1.0)

def C(h):return srgb(h)
WHITE=(1,1,1)
ALU=C('#b9bcb8');BRONZE=C('#5e5040');GALV=C('#8f9496');DARK=C('#2d3031');PVC=C('#9c9e98');RUST=C('#6b4a36')
TERRA=C('#a4583a');SOIL=C('#3b2c21');LEAF=C('#4b7a34');LEAF2=C('#6b9a3c');MARBLE=C('#e9e6de')
WOOD=C('#8a6440');RED=C('#b8322a');BLUE=C('#2f5f9e');YELLOW=C('#e2b12c');GREEN=C('#3f8a4f');CREAM=C('#e8e0cc')

# ------------------------------------------------------------------ geometry buckets (game space)
class Geo:
    def __init__(s,m):s.m=m;s.v=[];s.f=[];s.uv=[];s.col=[];s.smooth=[]
B={};PIECE=['frame']
def bucket(cls,m):
    key=(PIECE[0],cls,m.name)
    if key not in B:B[key]=Geo(m)
    return B[key]

def sub(a,b):return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def dot(a,b):return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def newell(pts):
    n=[0.0,0.0,0.0]
    for i,a in enumerate(pts):
        b=pts[(i+1)%len(pts)]
        n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1])
    return n

def proj(p,n,tile):
    """World box projection; src/shoplots.ts computes exactly this after placing each bay."""
    ax=max(range(3),key=lambda i:abs(n[i]))
    if ax==1:return (p[0]/tile,-p[2]/tile)
    if ax==0:return ((-p[2] if n[0]>0 else p[2])/tile,p[1]/tile)
    return ((p[0] if n[2]>0 else -p[0])/tile,p[1]/tile)

def poly(cls,m,pts,n,col=WHITE,uv=None,smooth=False):
    pts=list(pts);uv=list(uv) if uv else None
    if dot(newell(pts),n)<0:
        pts.reverse()
        if uv:uv.reverse()
    g=bucket(cls,m);base=len(g.v);g.v.extend(pts);g.f.append(tuple(range(base,base+len(pts))))
    tile=m.get('tile',1.0)
    g.uv.append(uv or [proj(p,n,tile) for p in pts]);g.col.append([col]*len(pts));g.smooth.append(smooth)

def cube(cls,m,x0,x1,y0,y1,z0,z1,col=WHITE,skip=''):
    if x1<x0:x0,x1=x1,x0
    if 'l' not in skip:poly(cls,m,[(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0)],(-1,0,0),col)
    if 'r' not in skip:poly(cls,m,[(x1,y0,z0),(x1,y0,z1),(x1,y1,z1),(x1,y1,z0)],(1,0,0),col)
    if 'd' not in skip:poly(cls,m,[(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)],(0,-1,0),col)
    if 'u' not in skip:poly(cls,m,[(x0,y1,z0),(x1,y1,z0),(x1,y1,z1),(x0,y1,z1)],(0,1,0),col)
    if 'b' not in skip:poly(cls,m,[(x0,y0,z0),(x0,y1,z0),(x1,y1,z0),(x1,y0,z0)],(0,0,-1),col)
    if 'f' not in skip:poly(cls,m,[(x0,y0,z1),(x0,y1,z1),(x1,y1,z1),(x1,y0,z1)],(0,0,1),col)

def rz(cls,m,x0,x1,y0,y1,z,nz,col=WHITE,uv=None):
    poly(cls,m,[(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z)],(0,0,nz),col,uv)
def rx(cls,m,x,z0,z1,y0,y1,nx,col=WHITE,uv=None):
    poly(cls,m,[(x,y0,z0),(x,y0,z1),(x,y1,z1),(x,y1,z0)],(nx,0,0),col,uv)
def ry(cls,m,x0,x1,z0,z1,y,ny,col=WHITE,uv=None):
    poly(cls,m,[(x0,y,z0),(x1,y,z0),(x1,y,z1),(x0,y,z1)],(0,ny,0),col,uv)

def ext_x(cls,m,x0,x1,prof,col=WHITE):
    """Profile of (z, y) points from the lower wall contact, out, up, back to the wall; extruded
    along x with open ends (the next bay, or an end cap, closes them)."""
    for (z0,y0),(z1,y1) in zip(prof,prof[1:]):
        dz,dy=z1-z0,y1-y0
        if abs(dz)+abs(dy)<1e-6:continue
        poly(cls,m,[(x0,y0,z0),(x1,y0,z0),(x1,y1,z1),(x0,y1,z1)],(0,-dz,dy),col)

def cap(cls,m,x,prof,nx,col=WHITE):
    poly(cls,m,[(x,y,z) for z,y in prof],(nx,0,0),col)

def obox(cls,m,c,ax,half,col=WHITE,skip=()):
    """Oriented box: centre, three unit axes (u, v, w), half sizes; `skip` drops both faces of an axis."""
    corners={}
    for i in (-1,1):
        for j in (-1,1):
            for k in (-1,1):
                corners[(i,j,k)]=tuple(c[t]+ax[0][t]*half[0]*i+ax[1][t]*half[1]*j+ax[2][t]*half[2]*k for t in range(3))
    for a in range(3):
        if a in skip:continue
        for s in (-1,1):
            idx=[(i,j,k) for i in (-1,1) for j in (-1,1) for k in (-1,1) if (i,j,k)[a]==s]
            quad=[idx[0],idx[1],idx[3],idx[2]]
            poly(cls,m,[corners[q] for q in quad],tuple(ax[a][t]*s for t in range(3)),col)

def bar(cls,m,a,b,t,col=WHITE,side=(1,0,0)):
    """Square member between two points, open ended; `side` picks the roll."""
    u=norm(sub(b,a));w=norm(cross(u,side));v=cross(w,u)
    obox(cls,m,tuple((a[i]+b[i])/2 for i in range(3)),[u,v,w],(math.dist(a,b)/2,t/2,t/2),col,skip=(0,))

def norm(v):
    l=math.sqrt(dot(v,v)) or 1;return (v[0]/l,v[1]/l,v[2]/l)
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])

def tube(cls,m,points,r,col=WHITE,sides=6,caps=False):
    g=bucket(cls,m);rings=[]
    for i,p in enumerate(points):
        d=norm(sub(points[min(i+1,len(points)-1)],points[max(i-1,0)]))
        a=norm(cross(d,(0,1,0) if abs(d[1])<.9 else (1,0,0)));b=cross(d,a);ring=[]
        for k in range(sides):
            t=2*math.pi*k/sides;ring.append(tuple(p[j]+(a[j]*math.cos(t)+b[j]*math.sin(t))*r for j in range(3)))
        rings.append(ring)
    for i in range(len(rings)-1):
        for k in range(sides):
            q=[rings[i][k],rings[i][(k+1)%sides],rings[i+1][(k+1)%sides],rings[i+1][k]]
            mid=tuple((q[0][j]+q[1][j]+q[2][j]+q[3][j])/4 for j in range(3))
            ctr=tuple((points[i][j]+points[i+1][j])/2 for j in range(3))
            poly(cls,m,q,sub(mid,ctr),col,smooth=True)
    if caps:
        for i,sgn in ((0,-1),(len(points)-1,1)):
            d=norm(sub(points[min(i+1,len(points)-1)],points[max(i-1,0)]))
            poly(cls,m,rings[i],tuple(d[j]*sgn for j in range(3)),col)

def cyl(cls,m,x,z,y0,y1,r,col=WHITE,sides=10,top=True,bottom=False,r1=None):
    r1=r if r1 is None else r1;ring=lambda y,rr:[(x+rr*math.cos(2*math.pi*k/sides),y,z+rr*math.sin(2*math.pi*k/sides)) for k in range(sides)]
    a,b=ring(y0,r),ring(y1,r1)
    for k in range(sides):
        q=[a[k],a[(k+1)%sides],b[(k+1)%sides],b[k]];t=2*math.pi*(k+.5)/sides
        poly(cls,m,q,(math.cos(t),(r-r1)/max(y1-y0,1e-3),math.sin(t)),col,smooth=True)
    if top:poly(cls,m,b,(0,1,0),col)
    if bottom:poly(cls,m,a,(0,-1,0),col)

def disc_z(cls,m,x,y,z,r,nz,col,sides=14):
    poly(cls,m,[(x+r*math.cos(2*math.pi*k/sides),y+r*math.sin(2*math.pi*k/sides),z) for k in range(sides)],(0,0,nz),col)
def disc_x(cls,m,x,y,z,r,nx,col,sides=14):
    poly(cls,m,[(x,y+r*math.sin(2*math.pi*k/sides),z+r*math.cos(2*math.pi*k/sides)) for k in range(sides)],(nx,0,0),col)

def leaf(m,base,yaw,pitch,length,width,col):
    """A double-sided blade from base, pointing along yaw (about y) and pitched up."""
    d=(math.sin(yaw)*math.cos(pitch),math.sin(pitch),math.cos(yaw)*math.cos(pitch));side=(math.cos(yaw),0,-math.sin(yaw))
    tip=tuple(base[i]+d[i]*length for i in range(3));mid=tuple(base[i]+d[i]*length*.45 for i in range(3))
    pts=[base,tuple(mid[i]+side[i]*width for i in range(3)),tip,tuple(mid[i]-side[i]*width for i in range(3))]
    n=norm(cross(side,d))
    poly('fixed',m,pts,n,col);poly('fixed',m,pts,tuple(-v for v in n),col)

def plant(x,y,z,rng,size=1.0):
    cyl('fixed',FIX,x,z,y,y+.36*size,.2*size,TERRA,8,top=False,r1=.25*size)
    poly('fixed',FIX,[(x+.23*size*math.cos(2*math.pi*k/8),y+.33*size,z+.23*size*math.sin(2*math.pi*k/8)) for k in range(8)],(0,1,0),SOIL)
    for i in range(7):
        leaf(FIX,(x,y+.33*size,z),rng.random()*6.28,rng.uniform(.5,1.2),rng.uniform(.4,.75)*size,rng.uniform(.06,.1)*size,LEAF if i%2 else LEAF2)

# ------------------------------------------------------------------ frame: the bay
def frame():
    PIECE[0]='frame'
    # upper front wall with two openings, one face from the soffit to the cornice
    xs=[-H]+[e for c,w in WINS for e in (c-w/2,c+w/2)]+[H]
    rz('wall',RENDER,-H,H,SOFFIT,SILL,FRONT,1);rz('wall',RENDER,-H,H,HEAD,CORNICE+.02,FRONT,1)
    for a,b in zip(xs[0::2],xs[1::2]):rz('wall',RENDER,a,b,SILL,HEAD,FRONT,1)
    for c,w in WINS:
        x0,x1=c-w/2,c+w/2
        rx('wall',RENDER,x0,5.75,FRONT,SILL,HEAD,1);rx('wall',RENDER,x1,5.75,FRONT,SILL,HEAD,-1)
        ry('wall',RENDER,x0,x1,5.75,FRONT,HEAD,-1)
        cube('trim',RENDER,x0-.12,x1+.12,SILL-.1,SILL,5.75,6.12,skip='b')                 # sill
        cube('trim',RENDER,x0-.24,x1+.24,HEAD+.08,HEAD+.22,FRONT,6.34,skip='b')           # hood
    # shallow pilasters at the party walls, half on each bay
    for s in (-1,1):
        xa,xb=s*H,s*(H-.24)
        rz('trim',RENDER,xa,xb,LEDGE+.16,CORNICE,6.06,1);rx('trim',RENDER,xb,FRONT,6.06,LEDGE+.16,CORNICE,-s)
    # fascia ledge above the lightbox, stepped cornice, parapet, raised panel, coping
    ext_x('trim',RENDER,-H,H,[(FRONT,LEDGE),(6.12,LEDGE+.02),(6.12,LEDGE+.12),(FRONT,LEDGE+.16)])
    ext_x('trim',RENDER,-H,H,CORNICE_PROF)
    rz('wall',RENDER,-H,H,PARAPET,COPE0,FRONT,1)
    for y0,y1 in ((9.25,9.35),(10.25,10.35)):cube('trim',RENDER,-2.6,2.6,y0,y1,FRONT,6.04,skip='b')
    for x0 in (-2.6,2.5):cube('trim',RENDER,x0,x0+.1,9.35,10.25,FRONT,6.04,skip='bud')
    ext_x('trim',RENDER,-H,H,COPING_PROF)
    rz('wall',RENDER,-H,H,9.9,COPE0,5.68,-1)                                             # parapet back, above the roof
    # zinc roof behind the parapet, gutter and downpipe at the back
    (zf,yf),(zb,yb)=ROOF_F,ROOF_B
    poly('fixed',ZINC,[(-H,yf,zf),(H,yf,zf),(H,yb,zb),(-H,yb,zb)],(0,1,-.15))
    poly('fixed',ZINC,[(-H,BACK_TOP-.02,BACK),(H,BACK_TOP-.02,BACK),(H,yb-.02,zb),(-H,yb-.02,zb)],(0,-1,0))
    cube('fixed',FIX,-H,H,yb-.18,yb-.02,-6.48,-6.3,GALV,skip='lr')
    tube('fixed',FIX,[(2.6,yb-.1,-6.4),(2.6,yb-.4,-6.12),(2.6,.05,-6.12)],.055,PVC)
    # back wall: a door with a grille gate, two small windows, an exhaust fan, a rear zinc canopy
    rz('wall',RENDER,-H,H,0,BACK_TOP,BACK,-1)
    cube('fixed',FIX,.9,2.1,.05,2.25,BACK-.03,BACK,DARK,skip='f')
    for k,(x0,x1,y0,y1) in enumerate(((-2.2,-.8,1.3,2.3),(-2.0,-.6,5.6,6.7))):
        rz(f'glass:{2+k}',WINDOW,x0,x1,y0,y1,BACK-.02,-1,uv=[(0,.25),(.25,.25),(.25,.5),(0,.5)])
        for a,b in ((x0-.05,x0),(x1,x1+.05)):cube('fixed',FIX,a,b,y0-.05,y1+.05,BACK-.06,BACK,ALU,skip='f')
        for a,b in ((y0-.05,y0),(y1,y1+.05)):cube('fixed',FIX,x0,x1,a,b,BACK-.06,BACK,ALU,skip='flr')
        cube('fixed',FIX,(x0+x1)/2-.02,(x0+x1)/2+.02,y0,y1,BACK-.05,BACK,ALU,skip='fud')
        cube('trim',RENDER,x0-.1,x1+.1,y0-.13,y0-.05,BACK-.14,BACK,skip='f')
        if k==0:
            for i in range(6):cube('grille',FIX,x0+.1+i*.24,x0+.13+i*.24,y0-.05,y1+.05,BACK-.12,BACK-.09,skip='f')
    for i in range(7):cube('grille',FIX,.95+i*.18,.98+i*.18,.05,2.25,BACK-.07,BACK-.04,skip='f')
    disc_z('fixed',FIX,1.2,4.2,BACK-.02,.22,-1,C('#c9c9c2'))
    poly('fixed',ZINC,[(-.2,2.75,BACK),(2.8,2.75,BACK),(2.8,2.45,-7.1),(-.2,2.45,-7.1)],(0,1,-.2))
    poly('fixed',ZINC,[(-.2,2.73,BACK),(2.8,2.73,BACK),(2.8,2.43,-7.1),(-.2,2.43,-7.1)],(0,-1,0))
    # arcade: floor, nosing, half columns, soffit beams, soffit
    ry('fixed',TILES,-H,H,SHOP_Z,NOSE,PL,1)
    rz('base',RENDER,-H,H,0,PL,NOSE,1)
    for s in (-1,1):
        xa,xb=s*H,s*(H-.3)
        cube('wall',RENDER,xa,xb,PL,SOFFIT,5.45,FRONT,skip=('r' if s>0 else 'l')+'du')
        cube('base',RENDER,xa,s*(H-.35),PL,PL+.35,5.4,6.05,skip=('r' if s>0 else 'l')+'d')
        cube('trim',RENDER,xa,s*(H-.35),SOFFIT-.2,SOFFIT,5.4,6.05,skip=('r' if s>0 else 'l')+'u')
        cube('soffit',RENDER,xa,s*(H-.15),SOFFIT-.3,SOFFIT,SHOP_Z,5.45,skip=('r' if s>0 else 'l')+'ubf')
    ry('soffit',RENDER,-H,H,SHOP_Z,FRONT,SOFFIT,-1)
    # shopfront wall: stubs, transom, reveals
    for s in (-1,1):rz('shade',RENDER,s*H,s*JAMB,PL,SOFFIT,SHOP_Z,1);rx('shade',RENDER,s*JAMB,3.6,SHOP_Z,PL,OPEN_TOP,-s)
    rz('shade',RENDER,-JAMB,JAMB,OPEN_TOP,SOFFIT,SHOP_Z,1);ry('shade',RENDER,-JAMB,JAMB,3.6,SHOP_Z,OPEN_TOP,-1)
    # interior shell: tiled floor, off-white ceiling, the atlas on the back and side walls
    ry('fixed',TILES,-JAMB,JAMB,INT_Z,3.6,PL,1);ry('interior',RENDER,-JAMB,JAMB,INT_Z,3.6,3.15,-1)
    cu=lambda x:(x+JAMB)/(2*JAMB)*.5;cv=lambda y:.75+(y-PL)/(3.15-PL)*.25
    rz('fixed',INTERIOR,-JAMB,JAMB,PL,3.15,INT_Z,1,uv=[(cu(-JAMB),cv(PL)),(cu(JAMB),cv(PL)),(cu(JAMB),cv(3.15)),(cu(-JAMB),cv(3.15))])
    for s in (-1,1):
        u0,u1=(0,.16) if s<0 else (.5,.34)
        rx('fixed',INTERIOR,s*JAMB,INT_Z,3.6,PL,3.15,-s,uv=[(u0,cv(PL)),(u1,cv(PL)),(u1,cv(3.15)),(u0,cv(3.15))])
    for x in (-1.4,1.4):
        cube('fixed',FIX,x-.65,x+.65,3.07,3.15,1.5,1.66,WHITE,skip='u');cube('fixed',LAMP,x-.6,x+.6,3.03,3.07,1.54,1.62,skip='u')
    ry('fixed',WASH,-2.8,2.8,SHOP_Z-.3,FRONT+.1,PL+.012,1,uv=[(.08,.5),(.92,.5),(.92,.98),(.08,.98)])
    # pendant lamp over the five-foot-way and its pool of light on the tiles
    cube('fixed',FIX,-.008,.008,2.75,SOFFIT,4.87,4.89,DARK)
    cyl('fixed',FIX,0,4.88,2.55,2.78,.2,DARK,10,top=True,bottom=True,r1=.05)
    cube('fixed',LAMP,-.05,.05,2.5,2.6,4.83,4.93)
    ry('fixed',WASH,-1.9,1.9,3.85,6.25,PL+.01,1,uv=[(0,0),(1,0),(1,1),(0,1)])
    ry('fixed',WASH,-1.5,1.5,SHOP_Z+.02,5.98,SOFFIT-.006,-1,uv=[(0,.1),(1,.1),(1,.9),(0,.9)])
    # downpipe from a rainwater head under the coping, conduit under the cornice
    cube('fixed',FIX,-3.02,-2.74,10.2,10.5,FRONT,6.22,PVC,skip='b')
    tube('fixed',FIX,[(-2.88,10.2,6.12),(-2.88,5.0,6.12),(-2.88,4.9,6.02)],.05,PVC)
    tube('fixed',FIX,[(-H,8.38,6.04),(H,8.38,6.04)],.022,PVC,5)
    tube('fixed',FIX,[(2.95,8.38,6.04),(2.95,5.2,6.04)],.022,PVC,5)
    cube('fixed',FIX,2.8,3.1,4.95,5.3,FRONT,6.1,C('#c7c6bd'),skip='b')

CORNICE_PROF=[(FRONT,CORNICE),(6.06,CORNICE),(6.06,CORNICE+.1),(6.14,CORNICE+.15),(6.14,CORNICE+.23),(6.24,CORNICE+.29),(6.24,PARAPET),(FRONT,PARAPET)]
COPING_PROF=[(FRONT,COPE0),(6.1,COPE0),(6.1,COPE1),(5.62,COPE1),(5.62,COPE0),(5.68,COPE0)]
# Profiles run from the front contact, out, over and back, so ext_x's normals face outward.

# ------------------------------------------------------------------ upper floor variants
def window_glass(i,c,w,z):
    x0,x1=c-w/2,c+w/2
    rz(f'glass:{i}',WINDOW,x0,x1,SILL,HEAD,z,1,uv=[(0,.25),(.25,.25),(.25,.5),(0,.5)])

def frame_bars(cls,c,w,z0,z1,col,t=.05,mullions=(),transoms=()):
    x0,x1=c-w/2,c+w/2
    for a,b in ((x0,x0+t),(x1-t,x1)):cube(cls,FIX,a,b,SILL,HEAD,z0,z1,col,skip='b')
    for a,b in ((SILL,SILL+t),(HEAD-t,HEAD)):cube(cls,FIX,x0+t,x1-t,a,b,z0,z1,col,skip='blr')
    for mx in mullions:cube(cls,FIX,mx-t/2,mx+t/2,SILL+t,HEAD-t,z0,z1,col,skip='bud')
    for ty in transoms:cube(cls,FIX,x0+t,x1-t,ty-t/2,ty+t/2,z0,z1,col,skip='blr')

def grille(c,w,z,pattern):
    x0,x1=c-w/2-.05,c+w/2+.05;t=.022
    for a,b in ((x0,x0+.04),(x1-.04,x1)):cube('grille',FIX,a,b,SILL-.02,HEAD+.02,z,z+.04,skip='b')
    for a in (SILL-.02,HEAD-.02):cube('grille',FIX,x0,x1,a,a+.04,z,z+.04,skip='b')
    n=6
    for k in range(1,n):
        x=x0+(x1-x0)*k/n;cube('grille',FIX,x-t/2,x+t/2,SILL,HEAD,z+.01,z+.03,skip='bud')
    for y in (SILL+.75,SILL+1.45):cube('grille',FIX,x0,x1,y-t/2,y+t/2,z+.005,z+.035,skip='blr')
    if pattern:   # a sunrise of diagonal bars in the lower panel, the classic 70s grille
        cx,cy=c,SILL+.02
        for a in (.35,.8,1.25,1.9,2.35,2.8):
            d=(math.cos(a),math.sin(a),0);L=min(.95/abs(d[0]) if abs(d[0])>.01 else 9,.72/d[1])
            mid=(cx+d[0]*L/2,cy+d[1]*L/2,z+.02)
            obox('grille',FIX,mid,[d,(-d[1],d[0],0),(0,0,1)],(L/2,t/2,t/2),skip=(0,))

def condenser(x,y,z,struts=False):
    """Outdoor air-con unit on angle brackets: body, fan grille, pipes into the wall, a drain."""
    w,h,d=.82,.5,.3
    cube('fixed',FIX,x-w/2,x+w/2,y,y+h,z,z+d,C('#d9d8d0'),skip='b')
    disc_z('fixed',FIX,x-.1,y+h/2,z+d+.004,.21,1,DARK,16)
    for k in range(4):cube('fixed',FIX,x-.31,x+.11,y+.12+k*.1,y+.13+k*.1,z+d+.005,z+d+.015,C('#9a9a94'),skip='b')
    for s in (-1,1):
        cube('fixed',FIX,x+s*.3-.02,x+s*.3+.02,y-.04,y,FRONT,z+d,RUST,skip='b')
        if struts:bar('fixed',FIX,(x+s*.3,y-.45,FRONT),(x+s*.3,y-.02,z+d-.03),.03,RUST)
    px=x+w/2+.35
    tube('fixed',FIX,[(x+w/2,y+.2,z+.1),(px,y+.2,z+.1),(px,y+.6,FRONT+.03),(px,HEAD-.3,FRONT+.03),(px,HEAD-.3,FRONT-.05)],.03,CREAM,6)
    tube('fixed',FIX,[(x-w/2+.08,y,z+.15),(x-w/2+.08,max(LEDGE+.18,y-.5),z+.15)],.012,PVC,5)

def upper_casement():
    PIECE[0]='upper_casement'
    for i,(c,w) in enumerate(WINS):
        window_glass(i,c,w,5.8)
        frame_bars('fixed',c,w,5.78,5.86,BRONZE,mullions=(c,),transoms=(HEAD-.55,))
        grille(c,w,6.02,pattern=True)
    condenser(1.6,4.91,6.05)

def upper_louvre():
    PIECE[0]='upper_louvre'
    rng=random.Random(7)
    for i,(c,w) in enumerate(WINS):
        window_glass(i,c,w,5.78)
        frame_bars('joinery',c,w,5.76,5.83,WHITE,t=.07,mullions=(c,))
        # louvred leaves: the left one closed in the opening, the right one swung open square to the wall
        leaves=[('closed',c-w/4)] if i==0 else [('open',c+w/2)]
        if i==1:leaves.append(('closed',c-w/4))
        for kind,at in leaves:
            lw=w/2-.02
            if kind=='closed':
                o,u,wv=(at,0,5.93),(1,0,0),(0,0,1)
            else:
                o,u,wv=(at+.03,0,FRONT+lw/2+.02),(0,0,1),(-1,0,0)
            ctr=lambda a,y,b:(o[0]+u[0]*a+wv[0]*b,y,o[2]+u[2]*a+wv[2]*b)
            for a in (-lw/2+.035,lw/2-.035):obox('joinery',FIX,ctr(a,(SILL+HEAD)/2,0),[u,(0,1,0),wv],(.035,(HEAD-SILL)/2,.022))
            for y in (SILL+.04,HEAD-.04,(SILL+HEAD)/2):obox('joinery',FIX,ctr(0,y,0),[u,(0,1,0),wv],(lw/2-.07,.04,.022))
            tilt=norm((wv[0]*.9,1,wv[2]*.9));third=cross(u,tilt)
            for k in range(16):
                y=SILL+.14+k*(HEAD-SILL-.28)/15
                obox('joinery',FIX,ctr(0,y,0),[u,tilt,third],(lw/2-.07,.05,.004),skip=(0,1))
    plant(-1.6,SILL,5.93,rng,.55)

def upper_sliding():
    PIECE[0]='upper_sliding'
    rng=random.Random(11)
    for i,(c,w) in enumerate(WINS):
        window_glass(i,c,w,5.8)
        frame_bars('fixed',c,w,5.78,5.86,ALU,t=.055,mullions=(c-.02,c+.02))
        # box grille: a cage bolted to the wall, bars on the front and sides, a sloping zinc hood
        x0,x1,zf=c-w/2-.12,c+w/2+.12,6.42
        for x in (x0,x1):
            cube('grille',FIX,x-.02,x+.02,SILL-.12,HEAD+.1,FRONT,zf,skip='b')
            for k in range(1,4):cube('grille',FIX,x-.01,x+.01,SILL-.12,HEAD+.1,FRONT+k*.1,FRONT+k*.1+.02,skip='bud')
        for y in (SILL-.12,HEAD+.08):cube('grille',FIX,x0,x1,y,y+.03,FRONT,zf,skip='b')
        for k in range(12):
            x=x0+(x1-x0)*(k+.5)/12;cube('grille',FIX,x-.01,x+.01,SILL-.12,HEAD+.1,zf-.02,zf,skip='bud')
        cube('grille',FIX,x0,x1,SILL-.12,SILL-.1,FRONT,zf,skip='b')
        poly('fixed',ZINC,[(x0-.05,HEAD+.36,FRONT),(x1+.05,HEAD+.36,FRONT),(x1+.05,HEAD+.12,zf+.1),(x0-.05,HEAD+.12,zf+.1)],(0,1,.5))
        poly('fixed',ZINC,[(x0-.05,HEAD+.34,FRONT),(x1+.05,HEAD+.34,FRONT),(x1+.05,HEAD+.1,zf+.1),(x0-.05,HEAD+.1,zf+.1)],(0,-1,-.5))
        if i==0:plant(c-.4,SILL-.1,6.2,rng,.5);cube('fixed',FIX,c+.1,c+.5,SILL-.1,SILL+.25,6.0,6.3,C('#4b6fa8'))
    # a laundry pole out of the right window with three pieces of washing
    tube('fixed',FIX,[(1.2,HEAD-.25,6.0),(1.2,HEAD-.05,7.35)],.02,C('#b89a60'),5,caps=True)
    for k,(col,ln) in enumerate(((C('#d8d4c8'),.55),(C('#b5433b'),.7),(C('#3f6aa0'),.45))):
        zz=6.55+k*.26;yy=HEAD-.2+.15*(zz-6)/1.35
        rx('fixed',FIX,1.2,zz-.11,zz+.11,yy-ln,yy,1,col);rx('fixed',FIX,1.2,zz-.11,zz+.11,yy-ln,yy,-1,col)
    condenser(1.6,4.91,6.02)

# ------------------------------------------------------------------ shopfronts
def shutter_box():
    cube('fixed',FIX,-JAMB,JAMB,2.72,OPEN_TOP,3.62,3.95,GALV,skip='lru')
    rz('fixed',SHUTTER,-JAMB+.05,JAMB-.05,2.52,2.72,3.72,1)
    cube('fixed',FIX,-JAMB+.05,JAMB-.05,2.49,2.54,3.7,3.76,C('#7d8284'),skip='lr')
    for s in (-1,1):cube('fixed',FIX,s*JAMB,s*(JAMB-.06),PL,2.72,3.62,3.74,GALV,skip='u'+('r' if s>0 else 'l'))

def front_open():
    PIECE[0]='front_open';shutter_box()

def front_glazed():
    PIECE[0]='front_glazed';shutter_box()
    z0,z1=3.64,3.72;t=.05
    for a,b in ((-JAMB+.06,-JAMB+.12),(JAMB-.12,JAMB-.06),(-1.02,-.96),(.96,1.02),(-.03,.03)):cube('fixed',FIX,a,b,PL,2.49,z0,z1,ALU,skip='bu')
    for a,b in ((PL,PL+.14),(2.18,2.24),(2.43,2.49)):cube('fixed',FIX,-JAMB+.12,JAMB-.12,a,b,z0,z1,ALU,skip='blr')
    for x0,x1,y0,y1 in ((-JAMB+.12,-1.02,PL+.14,2.43),(1.02,JAMB-.12,PL+.14,2.43),(-.96,-.03,PL+.14,2.18),(.03,.96,PL+.14,2.18),(-.96,.96,2.24,2.43)):
        rz('fixed',GLASS,x0,x1,y0,y1,3.68,1)
    for x in (-.14,.14):cube('fixed',FIX,x-.015,x+.015,1.1,1.9,z1,z1+.06,C('#d6d8d8'),skip='b')
    cube('fixed',FIX,-JAMB+.12,JAMB-.12,PL,PL+.01,z0-.3,z0,C('#3a3c3a'),skip='d')

# ------------------------------------------------------------------ props per trade
def stool(x,z,col,y=PL):
    cyl('fixed',FIX,x,z,y,y+.42,.12,col,6,top=False,r1=.15);cyl('fixed',FIX,x,z,y+.42,y+.46,.17,col,8)

def table(x,z,y=PL):
    cyl('fixed',FIX,x,z,y,y+.03,.24,DARK,8);cyl('fixed',FIX,x,z,y+.03,y+.7,.035,DARK,5,top=False)
    cyl('fixed',FIX,x,z,y+.7,y+.74,.4,MARBLE,12,bottom=True)

def crate(x,z,y,col,fill):
    cube('fixed',FIX,x-.25,x+.25,y,y+.26,z-.18,z+.18,col,skip='d')
    rng=random.Random(int(x*100+z*10))
    for k in range(4):
        px,pz=x+rng.uniform(-.16,.16),z+rng.uniform(-.09,.09)
        cube('fixed',FIX,px-.06,px+.06,y+.24,y+.33,pz-.06,pz+.06,fill,skip='d')

def props_eatery(v):
    PIECE[0]=f'props_eatery_{v}';rng=random.Random(100+v)
    tx=-1.3 if v==0 else 1.1
    table(tx,4.75)
    for a in (.4,2.3,4.2):stool(tx+math.cos(a+v)*.62,4.75+math.sin(a+v)*.55,RED if a<2 else BLUE)
    table(1.4 if v==0 else -1.2,2.3);table(-1.5 if v==0 else 1.5,.9)
    for x,z in ((1.4,1.7),(2.0,2.4),(-1.5,1.5),(-2.1,.8)):stool(x if v==0 else -x,z,BLUE if v else RED)
    cube('fixed',FIX,1.7 if v==0 else -2.5,2.5 if v==0 else -1.7,PL,PL+1.0,-.4,.4,C('#c5c8c9'),skip='d')
    cube('fixed',FIX,-2.6 if v==0 else 2.0,-2.0 if v==0 else 2.6,PL,PL+1.85,-.5,.15,C('#a52c26'),skip='d')
    rz('fixed',FIX,-2.52 if v==0 else 2.08,-2.08 if v==0 else 2.52,PL+.2,PL+1.7,.152,1,C('#1d2328'))
    cyl('fixed',FIX,0,1.6,2.95,3.15,.06,WHITE,8)
    for a in range(3):
        d=(math.cos(a*2.09+v),0,math.sin(a*2.09+v));obox('fixed',FIX,(d[0]*.42,2.96,1.6+d[2]*.42),[d,(0,1,0),(-d[2],0,d[0])],(.36,.008,.06),WHITE)
    plant(2.55 if v==0 else -2.55,PL,5.0,rng,.9)

def props_market(v):
    PIECE[0]=f'props_market_{v}';rng=random.Random(200+v)
    sx=-1 if v==0 else 1
    cube('fixed',FIX,sx*2.5,sx*.1,PL,PL+.45,4.0,4.95,WOOD,skip='d')
    for k,fill in enumerate((C('#e0782c'),C('#7bab3a'),C('#e6c43a'),C('#c2352b'))):
        crate(sx*(2.15-k*.6),4.47,PL+.45,(C('#2f6fb0'),C('#3a9a4a'),C('#d9452e'),C('#2f6fb0'))[k],fill)
    for k in range(3):
        for j in range(2 if k<2 else 1):cube('fixed',FIX,-sx*(1.2+k*.5)-.22,-sx*(1.2+k*.5)+.22,PL+j*.3,PL+j*.3+.3,4.2,4.75,C('#d9cfae'),skip='d')
    for x in (-2.3,2.3):
        cube('fixed',FIX,x-.4,x+.4,PL,PL+2.1,.2,3.2,C('#cfccc4'),skip='d'+('l' if x<0 else 'r'))
        for y in (.8,1.35,1.9):
            for k in range(6):cube('fixed',FIX,x-.42,x+.42,PL+y,PL+y+.24,.3+k*.48,.62+k*.48,C(rng.choice(['#c94c3c','#e3b84a','#4f86b5','#f0ece0','#6aa35c'])),skip='dbf'+('l' if x<0 else 'r'))
    cube('fixed',FIX,-.7,.7,PL,PL+1.0,2.7,3.2,C('#8a6a4a'),skip='d')
    plant(sx*-2.6,PL,5.1,rng,.8)

def props_diy(v):
    PIECE[0]=f'props_diy_{v}';rng=random.Random(300+v)
    sx=-1 if v==0 else 1
    for k in range(3):
        col=(RED,BLUE,YELLOW,GREEN)[(k+v)%4]
        for j in range(4):cyl('fixed',FIX,sx*(2.4-k*.5),4.4,PL+j*.1,PL+j*.1+.3,.14,col,8,top=(j==3),r1=.18)
    for k in range(3):   # brooms leaning on the shutter jamb
        bx=-sx*(2.6-k*.16)
        bar('fixed',FIX,(bx+sx*.35,PL+.1,4.15),(bx,PL+1.5,3.86),.024,C('#c9a15a'))
        cube('fixed',FIX,bx+sx*.35-.14,bx+sx*.35+.14,PL,PL+.12,4.1,4.2,(RED,GREEN,YELLOW)[k],skip='d')
    for s in (-.22,.22):bar('fixed',FIX,(sx*.8+s,PL,4.62),(sx*.8+s,PL+2.1,4.02),.035,ALU)   # a stepladder
    for k in range(6):
        t=(k+.7)/7;bar('fixed',FIX,(sx*.8-.22,PL+2.1*t,4.62-.6*t),(sx*.8+.22,PL+2.1*t,4.62-.6*t),.028,ALU,side=(0,1,0))
    for x in (-1.9,1.9):
        cube('fixed',FIX,x-.5,x+.5,PL,PL+1.6,.3,3.0,C('#d8d8d4'),skip='d'+('l' if x<0 else 'r'))
        for y in (.5,1.0,1.45):
            for k in range(5):cube('fixed',FIX,x-.52,x+.52,PL+y,PL+y+.28,.4+k*.5,.8+k*.5,C(rng.choice(['#e9b929','#263f4a','#d86b3e','#f3f1ea','#4a7fb8'])),skip='dbf'+('l' if x<0 else 'r'))
    plant(-sx*2.6,PL,5.15,rng,.7)

def props_laundry(v):
    PIECE[0]=f'props_laundry_{v}';rng=random.Random(400+v)
    s=-1 if v==0 else 1
    for k in range(4):
        z=-.1+k*.85;x=s*2.45
        for j,y in enumerate((PL,PL+.92)):
            if j==1 and k==3:continue
            cube('fixed',FIX,x-.36,x+.36,y,y+.9,z-.4,z+.4,C('#e4e6e6'),skip='d'+('r' if s>0 else 'l'))
            disc_x('fixed',FIX,x-s*.365,y+.45,z,.24,-s,C('#2a3440'),10)
            cube('fixed',FIX,x-s*.37,x-s*.36,y+.78,y+.86,z-.3,z+.3,C('#3b4146'),skip='')
    cube('fixed',FIX,-s*1.6,-s*.4,PL+.78,PL+.82,1.0,2.2,C('#e8e8e2'))
    for dx in (-.55,.55):
        for dz in (-.55,.55):cube('fixed',FIX,-s*1.0+dx-.02,-s*1.0+dx+.02,PL,PL+.78,1.6+dz-.02,1.6+dz+.02,DARK,skip='ud')
    for x in (-1.0,-.35):
        cube('fixed',FIX,s*x-.22,s*x+.22,PL+.42,PL+.46,4.6,5.0,C('#2f78b8'))
        cube('fixed',FIX,s*x-.22,s*x+.22,PL+.46,PL+.9,4.96,5.0,C('#2f78b8'))
        for dx in (-.2,.2):cube('fixed',FIX,s*x+dx-.015,s*x+dx+.015,PL,PL+.42,4.62,4.98,DARK,skip='ud')
    cube('fixed',FIX,-s*2.5,-s*1.8,PL,PL+1.8,2.7,3.4,C('#c8342c'),skip='d')
    plant(s*2.55,PL,5.1,rng,.85)

def props_electric(v):
    PIECE[0]=f'props_electric_{v}';rng=random.Random(500+v)
    s=-1 if v==0 else 1
    for k in range(3):
        x=s*(2.3-k*.62);z=4.55+(k%2)*.25
        cyl('fixed',FIX,x,z,PL,PL+.04,.2,C('#e8e8e4'),12);cyl('fixed',FIX,x,z,PL+.04,PL+1.1,.02,C('#cfcfca'),6,top=False)
        cyl('fixed',FIX,x,z-.05,PL+1.1,PL+1.12,.05,C('#e8e8e4'),8)
        disc_z('fixed',FIX,x,PL+1.22,z+.07,.24,1,C('#dfe6ea'),10);disc_z('fixed',FIX,x,PL+1.22,z+.06,.24,-1,C('#dfe6ea'),10)
        disc_z('fixed',FIX,x,PL+1.22,z+.08,.05,1,(C('#3d7fc4'),C('#d94a3a'),C('#39a26a'))[k],10)
    for k in range(4):
        for j in range(3-k%2):cube('fixed',FIX,-s*(1.0+k*.45)-.2,-s*(1.0+k*.45)+.2,PL+j*.32,PL+j*.32+.32,4.1,4.7,C('#b58c5a' if (j+k)%3 else '#d7c7a2'),skip='d')
    for x in (-2.2,2.2):
        cube('fixed',FIX,x-.6,x+.6,PL,PL+2.0,.2,2.8,C('#dcdad2'),skip='d'+('l' if x<0 else 'r'))
        for y in (.3,.95,1.6):
            for k in range(4):cube('fixed',FIX,x-.62,x+.62,PL+y,PL+y+.5,.3+k*.62,.84+k*.62,C(rng.choice(['#2b2f33','#b58c5a','#f1efe8','#3d6fa8'])),skip='dbf'+('l' if x<0 else 'r'))
    plant(-s*2.6,PL,5.2,rng,.75)

# ------------------------------------------------------------------ awning, ends, lightbox
def awning():
    PIECE[0]='awning'
    y0,y1,z0,z1=SOFFIT-.02,2.98,FRONT,7.55
    poly('fixed',ZINC,[(-H,y0,z0),(H,y0,z0),(H,y1,z1),(-H,y1,z1)],(0,1,.2))
    poly('fixed',ZINC,[(-H,y0-.02,z0),(H,y0-.02,z0),(H,y1-.02,z1),(-H,y1-.02,z1)],(0,-1,-.2))
    cube('accent',FIX,-H,H,y1-.22,y1+.04,z1,z1+.03,skip='lrb')
    rz('accent',FIX,-H,H,y1-.22,y1+.04,z1-.005,-1)
    for x in (-2.4,2.4):
        bar('fixed',FIX,(x,y0-.06,z0),(x,y1-.06,z1-.05),.05,GALV)
        bar('fixed',FIX,(x,y0-.75,z0),(x,(y0+y1)/2-.08,(z0+z1)/2),.035,GALV)

def end(side):
    """Plain party wall closing a row at x = 0 (the runtime puts it at side * W / 2); the wall
    thickens inward, toward -side."""
    PIECE[0]='end_l' if side<0 else 'end_r'
    inn=-side
    X=lambda d:inn*d
    top=[(FRONT,COPE0),(5.6,COPE0),(5.6,10.3),(BACK,8.5)]
    outer=[(BACK,0),(SHOP_Z,0),(SHOP_Z,SOFFIT),(FRONT,SOFFIT)]+top
    poly('wall',RENDER,[(0,y,z) for z,y in outer],(side,0,0))
    # sloping top of the wall, and the back edge
    for (za,ya),(zb,yb) in zip(top,top[1:]):
        poly('trim',RENDER,[(0,ya,za),(0,yb,zb),(X(.3),yb,zb),(X(.3),ya,za)],(0,-(zb-za),yb-ya))
    rz('wall',RENDER,0,X(.3),BACK_TOP,8.5,BACK,-1)
    # corner column, deeper and a little proud of the bay's own half column
    cube('wall',RENDER,0,X(.5),PL,SOFFIT,5.4,6.05,skip='du')
    cube('base',RENDER,0,X(.55),PL,PL+.4,5.35,6.1,skip='d')
    cube('trim',RENDER,0,X(.55),SOFFIT-.22,SOFFIT,5.35,6.1)
    # caps for everything that projects past the front face
    cap('base',RENDER,0,[(SHOP_Z,0),(NOSE,0),(NOSE,PL),(SHOP_Z,PL)],side)
    cap('trim',RENDER,0,[(FRONT,LEDGE),(6.12,LEDGE+.02),(6.12,LEDGE+.12),(FRONT,LEDGE+.16)],side)
    cap('trim',RENDER,0,[(FRONT,LEDGE+.16),(6.06,LEDGE+.16),(6.06,CORNICE),(FRONT,CORNICE)],side)
    cap('trim',RENDER,0,CORNICE_PROF,side)
    cap('trim',RENDER,0,[(5.62,COPE0),(6.1,COPE0),(6.1,COPE1),(5.62,COPE1)],side)
    # drainpipe, meter box with conduit, a louvred bathroom vent
    zz=-5.4
    tube('fixed',FIX,[(side*.07,8.6,zz),(side*.07,.05,zz)],.055,PVC)
    cube('fixed',FIX,0,side*.2,1.0,1.7,1.2,1.75,C('#d2d0c4'),skip='l' if side>0 else 'r')
    tube('fixed',FIX,[(side*.05,1.7,1.47),(side*.05,3.9,1.47),(side*.05,4.1,1.2),(side*.05,4.1,-2.0)],.025,PVC,5)
    cube('fixed',FIX,0,side*.04,6.2,6.9,-2.2,-1.6,C('#6f7270'),skip='l' if side>0 else 'r')
    for k in range(6):cube('fixed',FIX,0,side*.06,6.25+k*.11,6.3+k*.11,-2.17,-1.63,C('#d8d6cc'),skip='l' if side>0 else 'r')
    # an upstairs side window toward the back
    z0,z1,y0,y1=-4.6,-3.4,5.9,7.1
    rx('glass:4',WINDOW,side*.02,z0,z1,y0,y1,side,uv=[(0,.25),(.25,.25),(.25,.5),(0,.5)])
    for a,b in ((z0-.05,z0),(z1,z1+.05)):cube('fixed',FIX,0,side*.06,y0-.05,y1+.05,a,b,ALU,skip='l' if side>0 else 'r')
    for a,b in ((y0-.05,y0),(y1,y1+.05)):cube('fixed',FIX,0,side*.06,a,b,z0,z1,ALU,skip=('l' if side>0 else 'r')+'bf')
    cube('trim',RENDER,0,side*.14,y0-.13,y0-.05,z0-.1,z1+.1,skip='l' if side>0 else 'r')

def sign():
    PIECE[0]='sign'
    rz('signbg',FIX,-.5,.5,SIGN0,SIGN1,6.16,1)
    ry('signbg',FIX,-.5,.5,FRONT,6.24,SIGN1,1);ry('signbg',FIX,-.5,.5,FRONT,6.24,SIGN0,-1)
    for y0,y1 in ((SIGN0,SIGN0+.05),(SIGN1-.05,SIGN1)):
        rz('fixed',FIX,-.5,.5,y0,y1,6.24,1,ALU)
        ry('fixed',FIX,-.5,.5,6.16,6.24,y1 if y0==SIGN0 else y0,1 if y0==SIGN0 else -1,ALU)
    PIECE[0]='sign_cap_l';_sign_cap(-1)
    PIECE[0]='sign_cap_r';_sign_cap(1)

def _sign_cap(side):
    inn=-side
    rx('fixed',FIX,0,FRONT,6.24,SIGN0,SIGN1,side,ALU)
    rz('fixed',FIX,0,inn*.05,SIGN0,SIGN1,6.24,1,ALU)
    rx('fixed',FIX,inn*.05,6.16,6.24,SIGN0+.05,SIGN1-.05,inn,ALU)

# ------------------------------------------------------------------ objects and export
def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    frame();upper_casement();upper_louvre();upper_sliding();front_open();front_glazed()
    for v in (0,1):props_eatery(v);props_market(v);props_diy(v);props_laundry(v);props_electric(v)
    awning();end(-1);end(1);sign()
    root=bpy.data.objects.new(T,None);s.collection.objects.link(root)
    empties={};stats={}
    for (piece,cls,mname),g in B.items():
        m=g.m
        if piece not in empties:
            e=bpy.data.objects.new(piece,None);s.collection.objects.link(e);e.parent=root;empties[piece]=e
        me=bpy.data.meshes.new(f'{piece} {cls} {mname}')
        me.from_pydata([pt(*p) for p in g.v],[],g.f);me.update()
        uv=me.uv_layers.new(name='UVMap');col=me.color_attributes.new('Color','FLOAT_COLOR','CORNER')
        li=0
        for fi,poly_ in enumerate(me.polygons):
            poly_.use_smooth=g.smooth[fi]
            for k in range(poly_.loop_total):
                uv.data[poly_.loop_start+k].uv=g.uv[fi][k];col.data[poly_.loop_start+k].color=(*g.col[fi][k],1)
        me.color_attributes.active_color=col
        name=f'{piece}~{cls.replace(":","")}~{mname}'
        ob=bpy.data.objects.new(name,me);s.collection.objects.link(ob);ob.parent=empties[piece];me.materials.append(m)
        ob['lm_class']=cls.split(':')[0]
        if ':' in cls:ob['lm_window']=int(cls.split(':')[1])
        tris=sum(len(p.vertices)-2 for p in me.polygons)
        st=stats.setdefault(piece,{'triangles':0,'meshes':0});st['triangles']+=tris;st['meshes']+=1
    return root,stats

def export(root,stats):
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for c in root.children_recursive:c.select_set(True)
    path=PUBLIC/'LM_ENV_Shoplots.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=True,
        export_image_format='WEBP',export_image_quality=82,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    mats=sorted({k[2] for k in B})
    report={'asset':'LM_ENV_Shoplots','bay_width':U,'pieces':stats,'materials':mats,
        'heights':{'plinth':PL,'soffit':SOFFIT,'sign':[SIGN0,SIGN1],'sill':SILL,'head':HEAD,'cornice':CORNICE,'coping':COPE1},
        'textures':sorted(kit.IMAGES),'bytes':path.stat().st_size}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('SHOPLOTS WEB EXPORT',json.dumps(report),flush=True)

if __name__=='__main__':
    root,stats=build();export(root,stats)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'shoplots.blend'))
