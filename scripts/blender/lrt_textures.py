"""Procedural textures for the Rapid KL LRT (scripts/blender/lrt_models.py), in the pbr_textures.py
style: numpy, fixed seeds, colour as sRGB, normals as OpenGL tangent space, row 0 = top of image.

Most of these are not tiles but laid-out sheets: the geometry puts its UVs where the drawing is.
The layouts (profiles, atlas rectangles) live here so the drawing and the mesh cannot drift apart.

  girder()   precast segmental box girder, unwrapped round its cross-section; three segment
             variants side by side, one per 3 m column, which src/lrt.ts picks per instance
  pier()     T-pier column and hammerhead, u round the grooved plan, v up the height
  track()    rails, fastening plinths, LIM reaction plate, power rails, walkway grating, bearings
  platform() platform floor across its width: coping, yellow edge line, tactile strip, tiles
  roof()     curved station roof: standing-seam top, perforated soffit with LED lines
  cladding() stair tower facade, perforated screen, Rapid KL fascia bands, totem
  innovia()  the Innovia Mark II coach atlas: livery, nose, doors, interior, running gear
"""
import math
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, rgb

def arcs(points):
    s=[0.0]
    for a,b in zip(points,points[1:]):s.append(s[-1]+math.dist(a,b))
    return s

# ------------------------------------------------------------------ shared layouts
RAIL=11.0
# Girder cross-section, right half from the deck centre line round to the soffit centre (x, y).
GIRDER=[(0,10.76),(1.98,10.76),(2.00,11.64),(2.08,11.72),(2.30,11.72),(2.30,10.64),(2.22,10.56),
        (1.30,10.30),(1.02,9.52),(0.90,9.40),(0,9.40)]
GIRDER_S=arcs(GIRDER)
GIRDER_TEX=9.0            # metres the girder sheet covers in u (3 variants x 3 m) and in v (profile)
# Pier column plan (x across the track, z along it): chamfered 1.6 x 1.2 with a groove on every face.
_Q=[(.75,.12),(.80,.12),(.80,.50),(.70,.60),(.12,.60),(.12,.55)]
def _plan():
    q1=_Q                                                   # +x groove centre side .. +z groove
    q2=[(-x,z) for x,z in reversed(_Q)]                     # mirror in x
    q3=[(-x,-z) for x,z in _Q]                              # mirror both
    q4=[(x,-z) for x,z in reversed(_Q)]
    return q1+q2+q3+q4
PIER_PLAN=_plan()
PIER_S=arcs(PIER_PLAN+[PIER_PLAN[0]])
PIER_U,PIER_V=PIER_S[-1],10.0     # the column uses u 0..PIER_U; the hammerhead and footing the other half
# Track sheet bands (v0, v1) and what each spans across.
TRACK_BANDS={'rail':(.00,.16),'plinth':(.18,.34),'plate':(.36,.50),'power':(.52,.66),'walk':(.68,.84),'bearing':(.86,1.0)}
# Platform floor: u along the platform (3 m tile), v across from the edge (x=2.1) out to 8.1.
PLATFORM_EDGE,PLATFORM_U,PLATFORM_V=2.1,3.0,6.0
# Station roof: u across the curve (top sheet in the left half, soffit in the right), v along (6 m).
ROOF_ARC,ROOF_V=9.0,6.0
# Stair tower sheet: u round the tower (starting at the -x corner, z=-1.75, going +z), v up.
TOWER_W,TOWER_D,TOWER_H=2.3,3.5,11.8
CLAD_U,CLAD_V=12.0,16.0
# Innovia atlas rectangles in pixels (col0, row0, cols, rows) on a 1024 sheet, and their scale.
TRAIN_N=1024
WALL=(3,0,817,444,120)        # |z| 0..6.83 across, y 4.0 down to .3
ROOF_R=(3,450,817,171,90)     # |z| across, |x| 0..1.9 down
FRONT=(827,0,197,420,103)     # |x| 0..1.9 across, y 4.0 down to 0
DOOR=(827,424,93,320,116)     # leaf outer edge .. meeting edge, y 3.55 down to .88
LINING=(3,626,697,270,120)    # |z| 0..5.83, y 3.2 down to .95
FLOOR=(3,900,501,124,72)      # |z| 0..7.0, |x| 0..1.72
SEAT=(508,900,192,124,120)
CEIL=(704,626,116,398,61)     # |x| 0..1.9 across, |z| 0..6.5 down
SWATCH=(924,424,100,600)      # stacked cells of 60 px
SWATCHES=['under','bogie','wheel','pole','rubber','aircon','white','grey','display','seatframe']
def swatch_uv(name):
    c0,r0,w,h=SWATCH;k=SWATCHES.index(name);return ((c0+w/2)/TRAIN_N,1-(r0+30+60*k)/TRAIN_N)

# ------------------------------------------------------------------ helpers
def _grid(h,w):
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    return (xx+.5)/w,(yy+.5)/h

def _sdf_box(X,Y,x0,x1,y0,y1,r=0.0):
    cx,cy=(x0+x1)/2,(y0+y1)/2;hx,hy=(x1-x0)/2-r,(y1-y0)/2-r
    qx=np.abs(X-cx)-hx;qy=np.abs(Y-cy)-hy
    return np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)-r

def rect(X,Y,x0,x1,y0,y1,r=0.0,px=.01):
    """Anti-aliased rounded rectangle coverage in metric coordinates (px = one pixel in metres)."""
    return np.clip(.5-_sdf_box(X,Y,x0,x1,y0,y1,r)/px,0,1)

def paint(col,m,c):
    m=m[...,None];col[:]=col*(1-m)+np.asarray(c,np.float32)*m

def field(h,w,beta,seed,stretch=(1,1)):
    n=max(h,w);return fractal(n,beta,seed,stretch)[:h,:w]

def smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)

# ------------------------------------------------------------------ girder
def girder(n=1024):
    """Precast segmental box girder. u: 9 m = three 3 m segments cast on different days (tone per
    segment, epoxy joint at each end); v: 9 m of cross-section from the deck centre to the soffit.
    Rain runs off the parapet coping down the outer face, drips from the drip nose and creeps under
    the cantilever, streaks the webs from the haunch; joints leach white; algae sits where it stays
    wet. Returns colour, normal."""
    U,V=_grid(n,n);U=U*GIRDER_TEX;S=(1-V)*GIRDER_TEX        # row 0 is the top of the image: S=9, v=1
    s=GIRDER_S
    seg=np.floor(U/3).astype(int)%3
    tone=np.array([1.0,1.045,.955])[seg];warm=np.array([0,.012,-.008])[seg]
    mott=fractal(n,1.8,301);fine=fractal(n,2.5,302);grain=white(n,303)
    col=rgb((.73,.725,.70),tone*(.9+(mott-.5)*.2+(fine-.5)*.07+(blur(grain,1)-.5)*.06))
    col[...,0]+=warm;col[...,2]-=warm
    # distance below where water starts on each face, and how far its streaks run
    d=np.full((n,n),9.0);L=np.full((n,n),1.0);streaky=np.zeros((n,n))
    def zone(a,b,start,length,k):
        m=(S>=s[a])&(S<s[b]);d[m]=np.abs(S[m]-start);L[m]=length;streaky[m]=k
    zone(1,2,s[2],.5,.5)             # parapet inner face, from the coping down
    zone(4,5,s[4],1.0,1.0)           # outer face, from the coping down
    zone(5,6,s[5],.3,1.0)            # drip nose
    zone(6,7,s[6],.45,.9)            # cantilever underside, creeping in from the drip
    zone(7,8,s[7],.75,.8)            # web, from the haunch down
    vs=fractal(n,1.05,304,stretch=(1,28));lenvar=fractal(n,1.2,305,stretch=(1,400))
    streak=np.clip((vs-.5)*3.2,0,1)*np.exp(-d/(L*(.5+lenvar)))*streaky
    dirt=np.array([.43,.41,.37])
    col=col*(1-.55*streak[...,None])+dirt*.55*streak[...,None]
    # drip nose and the first hand-width under it stay dark
    wet=smooth(s[7],s[6],S)*((S>s[5])&(S<s[7]))
    algae=np.clip((fractal(n,1.6,306)-.55)*3.5,0,1)
    green=np.array([.30,.33,.29])
    k=np.clip(wet*.7+algae*((S>s[4]+.6)&(S<s[7]))*.45+algae*((S>s[2])&(S<s[4]))*.6,0,.85)
    col=col*(1-k[...,None])+green*k[...,None]
    # soffit: shaded, mottled, with damp bands under every joint
    jd=np.abs(((U+1.5)%3)-1.5)
    soff=(S>=s[8])
    col[soff]*=(.9-(fractal(n,1.4,307)[soff]-.5)*.12)[...,None]
    col[soff]*=(1-.22*np.exp(-(jd[soff]/.22)**2))[...,None]
    # deck top: brake dust along the rails, oil in the middle
    deck=S<s[1];x=S
    dust=np.exp(-((x-.95)/.32)**2)*.35+np.exp(-(x/.25)**2)*.2
    col[deck]=col[deck]*(1-dust[deck][...,None])+np.array([.40,.36,.31])*dust[deck][...,None]
    col[deck]*=.9
    # joints: dark epoxy line, white leaching below it on the faces that see weather
    joint=np.exp(-(jd/.009)**2)
    face=((S>s[4])&(S<s[6]))|((S>s[7])&(S<s[8]))
    leach=np.exp(-(jd/.05)**2)*np.exp(-np.maximum(S-np.where(S<s[6],s[4],s[7]),0)/.5)*face*np.clip((fractal(n,1.3,308,stretch=(1,10))-.35)*2,0,1)
    col=col*(1-.45*leach[...,None])+np.array([.86,.86,.83])*.45*leach[...,None]
    col*=(1-.55*joint)[...,None]
    # a lifting insert on the web of each segment, pinprick pores
    tu=np.abs(((U-1.5)%3)-1.5);holes=np.clip(1-np.hypot(tu,S-(s[7]+.4))/.02,0,1)
    col*=(1-.35*holes)[...,None]
    pores=(white(n,310)>.992).astype(np.float32)
    col*=(1-.18*pores)[...,None]
    height=-joint*1.2-holes*.6+blur(mott,2)*.25
    return np.clip(col,0,1),normal_from_height(height,n/170)

# ------------------------------------------------------------------ pier
def pier(n=1024):
    """Pier column and hammerhead: u 0..PIER_U (left half) round the grooved column plan, the right
    half for the hammerhead and footing; v up 10 m. Streaks run down from the bearing shelf and from
    under the flare, splash-back and algae climb from the ground, lift joints every 2.5 m, grooves
    stay damp."""
    h=w=n;U,V=_grid(n,n);Uu=U*2*PIER_U;Y=(1-V)*PIER_V
    def f(beta,seed,stretch=(1,1)):return fractal(n,beta,seed,stretch)
    mott=f(1.8,321);fine=f(2.5,322);grain=white(n,323)
    col=rgb((.74,.735,.71),.9+(mott-.5)*.2+(fine-.5)*.08+(blur(grain,1)-.5)*.05)
    vs=f(1.0,324,(1,14));lenvar=f(1.1,325,(1,200))
    top=np.where(Y>7.4,9.2,7.4)                               # streaks start at the shelf or under the flare
    dd=np.maximum(top-Y,0)
    streak=np.clip((vs-.48)*3,0,1)*np.exp(-dd/(1.6*(.4+lenvar)))
    col=col*(1-.5*streak[...,None])+np.array([.42,.40,.36])*.5*streak[...,None]
    # flare underside stays dark
    col*=(1-.18*smooth(7.2,7.9,Y)*smooth(9.3,8.4,Y))[...,None]
    # grooves: damp, darker, algae
    g=np.zeros((h,w));grooves=[]
    P=PIER_PLAN+[PIER_PLAN[0]]
    for i in range(len(PIER_PLAN)):
        (x0,z0),(x1,z1)=P[i],P[i+1]
        if (abs(x0)==.75 and abs(x1)==.75) or (abs(z0)==.55 and abs(z1)==.55):grooves.append((PIER_S[i],PIER_S[i+1]))
    for a,b in grooves:g=np.maximum(g,rect(Uu,Y,a-.06,b+.06,-1,7.5,0,.01))
    col=col*(1-.22*g[...,None])+np.array([.36,.39,.34])*.22*g[...,None]
    # foot: splash-back, soil, algae
    foot=np.exp(-np.maximum(Y-.05,0)/.55)*(.7+.3*f(1.5,326))
    col=col*(1-.45*foot[...,None])+np.array([.36,.34,.29])*.45*foot[...,None]
    alg=np.clip((f(1.6,327)-.5)*3,0,1)*np.exp(-Y/1.4)*.5
    col=col*(1-alg[...,None])+np.array([.27,.31,.25])*alg[...,None]
    # lift joints and tie holes
    lift=np.zeros((h,w))
    for y in (2.5,5.0):lift=np.maximum(lift,np.exp(-((Y-y)/.008)**2))
    tu=np.abs(((Uu-.72)%1.44)-.72);holes=np.zeros((h,w))
    for y in (1.25,3.75,6.25):holes=np.maximum(holes,np.clip(1-np.hypot(tu,Y-y)/.018,0,1))
    col*=(1-.35*lift-.35*holes)[...,None]
    pores=(white(n,328)>.992).astype(np.float32);col*=(1-.18*pores)[...,None]
    height=-lift*1.0-holes*.6+blur(mott,2)*.25
    return np.clip(col,0,1),normal_from_height(height,n/180)

# ------------------------------------------------------------------ track
def track(n=512):
    """Deck equipment sheet: u along 3 m of track (tiles with the girder), bands in v (TRACK_BANDS).
    Returns colour, normal, ORM (G roughness, B metal)."""
    U,V=_grid(n,n);Z=U*3.0;v=1-V
    col=np.zeros((n,n,3),np.float32)+.5;rough=np.full((n,n),.6);metal=np.zeros((n,n));height=np.zeros((n,n))
    grain=white(n,341);mott=fractal(n,1.7,342);streakU=fractal(n,1.1,343,stretch=(30,1))
    def band(name):
        a,b=TRACK_BANDS[name];m=(v>=a)&(v<b);return m,(v-a)/(b-a)
    # rail: t across the unwrapped profile, 0 foot edge .. .5 head top .. 1 other foot edge
    m,t=band('rail')
    head=np.exp(-((t-.5)/.07)**2)
    rust=rgb((.40,.29,.21),.85+(mott-.5)*.3+(grain-.5)*.1)
    steel=rgb((.66,.66,.64),.92+(streakU-.5)*.15)
    c=rust*(1-head[...,None])+steel*head[...,None]
    contact=np.exp(-((t-.5)/.025)**2);c=c*(1-.25*contact[...,None])+np.array([.82,.82,.80])*.25*contact[...,None]
    col[m]=c[m];rough[m]=(.75-.5*head)[m];metal[m]=(.3+.6*head)[m];height[m]=head[m]*.5
    # plinth: concrete with a fastening every 0.75 m (base plate, pad, two clips)
    m,t=band('plinth')
    conc=rgb((.62,.61,.58),.9+(mott-.5)*.25+(grain-.5)*.08)
    fz=np.abs(((Z)%.75)-.375)
    plate=rect(fz,t,-.2,.2,.3,.7,.02,.004)
    clip=np.maximum(rect(fz,t,-.05,.05,.26,.38,.02,.004),rect(fz,t,-.05,.05,.62,.74,.02,.004))
    c=conc.copy();paint(c,plate,(.16,.16,.17));paint(c,clip,(.55,.52,.18))
    col[m]=c[m];rough[m]=np.where(plate>.5,.55,.9)[m];metal[m]=(clip*.6)[m];height[m]=(plate*.4+clip*.6)[m]
    # LIM reaction plate: aluminium cap, bolt rows, a joint at the segment end, dark back iron sides
    m,t=band('plate')
    alu=rgb((.74,.75,.76),.9+(streakU-.5)*.18+(grain-.5)*.05)
    side=(t<.18)|(t>.82)
    bolts=np.zeros((n,n))
    for tv in (.25,.75):bolts=np.maximum(bolts,np.clip(1-np.hypot(np.abs(((Z)%.5)-.25),(t-tv)*.3)/.012,0,1))
    joint=np.exp(-(np.minimum(Z,3-Z)/.01)**2)
    c=np.where(side[...,None],rgb((.22,.22,.23),.9+(mott-.5)*.2),alu)
    c*=(1-.5*joint-.3*bolts)[...,None]
    col[m]=c[m];rough[m]=np.where(side,.7,.35)[m];metal[m]=np.where(side,.5,.9)[m];height[m]=(bolts*.5-joint)[m]
    # power rail: steel conductor (t<.35), pale fibreglass cover (.35..1) with a warning strip
    m,t=band('power')
    cover=rgb((.86,.82,.66),.92+(mott-.5)*.12)
    cond=rgb((.38,.38,.40),.9+(streakU-.5)*.2)
    c=np.where((t<.35)[...,None],cond,cover)
    warn=((t>.55)&(t<.65))&((np.floor(Z/.25)%2)==0)
    c[warn]=np.array([.82,.14,.12])
    ins=rect(np.abs(((Z)%1.5)-.75),t,-.06,.06,-.1,.35,.01,.004)
    paint(c,ins,(.46,.34,.24))
    col[m]=c[m];rough[m]=np.where(t<.35,.45,.6)[m];metal[m]=np.where(t<.35,.8,0)[m];height[m]=ins[m]*.4
    # walkway: galvanised grating over a concrete trough edge
    m,t=band('walk')
    gx=np.abs(((Z)%.035)-.0175)<.004;gy=np.abs(((t*.7)%.1)-.05)<.006
    galv=rgb((.60,.62,.62),.9+(mott-.5)*.25+(grain-.5)*.1)
    c=galv.copy();hole=~(gx|gy);c[hole]*=.28
    edge=(t<.08)|(t>.92);c[edge]=rgb((.60,.59,.56),.9+(mott-.5)*.2)[edge]
    col[m]=c[m];rough[m]=np.where(hole,.9,.5)[m];metal[m]=np.where(hole|edge,0,.7)[m];height[m]=np.where(hole,-.6,0)[m]
    # bearing (u<.5): layered elastomer between steel plates; downpipe (u>.5): dark grey uPVC
    m,t=band('bearing')
    layers=(np.sin(t*np.pi*9)>.55)
    bear=np.where(layers[...,None],rgb((.52,.52,.5),.95+(grain-.5)*.1),rgb((.10,.10,.11),.9+(mott-.5)*.2))
    pipe=rgb((.30,.31,.32),.9+(fractal(n,1.0,344,stretch=(1,20))-.5)*.2)
    c=np.where((U<.5)[...,None],bear,pipe)
    col[m]=c[m];rough[m]=np.where(U<.5,.8,.55)[m];height[m]=(layers*.3*(U<.5))[m]
    orm=np.stack([np.ones((n,n)),rough,metal],-1)
    return np.clip(col,0,1),normal_from_height(blur(height,1),n/120),orm

# ------------------------------------------------------------------ station
def platform(w=512,h=1024):
    """Platform floor: u 3 m along the platform (tiles), v 6 m across from the edge. Granite coping
    with the yellow edge line, the tactile warning strip behind the platform gates, then 600 mm
    homogeneous tiles worn lighter where people queue at the doors."""
    U,V=_grid(h,w);Z=U*PLATFORM_U;X=(1-V)*PLATFORM_V
    n=h;mott=fractal(n,1.7,361)[:, ::2];grain=white(n,362)[:, ::2]
    tiles=rgb((.64,.63,.60),.92+(mott-.5)*.14+(blur(grain,1)-.5)*.12)
    tz=np.floor(Z/.6);tx=np.floor((X-.9)/.6)
    ttone=np.random.default_rng(363).random((64,64))[(tx.astype(int)%64),(tz.astype(int)%64)]
    tiles*=(.96+ttone*.06)[...,None]
    grout=np.maximum(np.exp(-((np.abs(((Z)%.6)-.3)-.3)/.004)**2),np.exp(-((np.abs(((X-.9)%.6)-.3)-.3)/.004)**2))
    tiles*=(1-.35*grout)[...,None]
    col=tiles.copy()
    coping=X<.42
    col[coping]=rgb((.38,.38,.37),.9+(mott-.5)*.2+(grain-.5)*.15)[coping]
    edge=(X>.02)&(X<.12);col[edge]=rgb((.93,.76,.12),.95+(mott-.5)*.1)[edge]
    # tactile warning strip (raised domes) .55..1.0 m from the edge
    strip=(X>.5)&(X<.9)
    dz=np.abs(((Z)%.075)-.0375);dx=np.abs(((X-.5)%.075)-.0375);dome=np.clip(1-np.hypot(dz,dx)/.017,0,1)
    col[strip]=rgb((.92,.74,.14),.94+(mott-.5)*.1-dome*.1)[strip]
    wear=np.clip((fractal(n,1.5,364)[:, ::2]-.5)*2,0,1)*np.exp(-np.maximum(X-1.0,0)/1.2)*.12
    col=col*(1-wear[...,None])+np.array([.72,.71,.69])*wear[...,None]
    height=np.where(strip,dome*.8,0)-grout*.5
    height=height-(np.abs(X-.42)<.01)*.4
    return np.clip(col,0,1),normal_from_height(height,h/140)

def roof(n=1024):
    """Station roof sheet. u<.5: standing-seam aluminium on top, seams every 0.5 m along the length,
    dirt collecting towards the gutters. u>.5: perforated aluminium soffit panels (1.2 x 1.5 m) with an
    LED line under every rib. v: 6 m along. Returns colour, normal, night emission."""
    U,V=_grid(n,n);Z=(1-V)*ROOF_V;top=U<.5;A=np.where(top,U*2,U*2-1)*ROOF_ARC
    mott=fractal(n,1.7,381);grain=white(n,382);streak=fractal(n,1.1,383,stretch=(1,30))
    seam=np.exp(-((np.abs((Z%.5)-.25)-.25)/.012)**2)
    gutter=np.exp(-A/.9)+np.exp(-(ROOF_ARC-.6-A).clip(0)/.9)
    sheet=rgb((.80,.81,.80),.92+(mott-.5)*.12+(streak-.5)*.1-gutter*.18)
    sheet*=(1-.2*seam)[...,None]
    pz=np.abs((Z%1.5)-.75);pa=np.abs((A%1.2)-.6)
    joint=np.maximum(np.exp(-((pz-.75)/.01)**2),np.exp(-((pa-.6)/.01)**2))
    perf=((np.sin(Z*2*np.pi/.02)*np.sin(A*2*np.pi/.02))>.3).astype(np.float32)
    soffit=rgb((.72,.73,.74),.94+(mott-.5)*.08-perf*.05)
    soffit*=(1-.5*joint)[...,None]
    led=np.exp(-((np.abs((Z%3.0)-1.5))/.035)**2)*(A>.4)*(A<ROOF_ARC-.9)
    soffit=soffit*(1-led[...,None])+np.array([.95,.95,.92])*led[...,None]
    col=np.where(top[...,None],sheet,soffit)
    height=np.where(top,seam*1.2,-joint*.8)
    emis=np.zeros((n,n,3));emis[~top]=(np.array([.88,.84,.72])*led[...,None])[~top]
    return np.clip(col,0,1),normal_from_height(height,n/160),np.clip(emis,0,1)

def cladding(n=1024):
    """Stair tower and station screens sheet: u 12 m round the tower (TOWER_W/TOWER_D faces from the
    -x face), v 12 m up. The -x face is a glass curtain wall over the stair flights with glass doors at
    the foot; the others are perforated aluminium with a glazed slot; Rapid KL red and blue bands run
    round the top. The last metre of u (11..12) is the platform screen and fascia strip.
    Returns colour, normal, ORM, night emission."""
    U,V=_grid(n,n);Uu=U*CLAD_U;Y=(1-V)*CLAD_V
    mott=fractal(n,1.6,401);grain=white(n,402)
    W,D=TOWER_W,TOWER_D
    edges=[0,D,D+W,2*D+W,2*D+2*W]                         # -x face, +z face, +x face, -z face
    col=np.zeros((n,n,3),np.float32);rough=np.full((n,n),.45);metal=np.full((n,n),.6);height=np.zeros((n,n));emis=np.zeros((n,n,3))
    perf=((np.sin(Uu*2*np.pi/.025)*np.sin(Y*2*np.pi/.025))>.2).astype(np.float32)
    panel=rgb((.78,.79,.80),.93+(mott-.5)*.08-perf*.06)
    pj=np.maximum(np.exp(-((np.abs((Uu%1.2)-.6)-.6)/.008)**2),np.exp(-((np.abs((Y%1.5)-.75)-.75)/.008)**2))
    panel*=(1-.4*pj)[...,None]
    col[:]=panel;height[:]=-pj*.6+perf*.03
    # glass curtain wall on the -x face: mullions 1.15 m, transoms 2 m, stairs behind
    gm=(Uu<D)
    lu=Uu;mull=np.exp(-((np.abs((lu%1.1667)-.583)-.583)/.02)**2);tran=np.exp(-((np.abs((Y%2.0)-1.0)-1.0)/.02)**2)
    frame=np.maximum(mull,tran)
    # stair flights: zig-zag landings every 3 m, each flight a lighter diagonal band
    ph=(Y%3.0)/3.0;flight=np.abs(((lu/D)-np.where((np.floor(Y/3.0)%2)==0,ph,1-ph)))<.06
    inside=np.where(flight,.30,.16)+(Y%3.0<.12)*.12
    glass=np.stack([inside*.8,inside*.95,inside*1.1],-1)+(1-Y/12)[...,None]*.04
    glass+=np.clip((fractal(n,1.4,403)-.5)*.1,0,1)[...,None]
    glassc=glass*(1-frame[...,None])+np.array([.28,.30,.33])*frame[...,None]
    col[gm]=glassc[gm];rough[gm]=np.where(frame,.4,.06)[gm];metal[gm]=np.where(frame,.7,.2)[gm];height[gm]=(frame*.6)[gm]
    lit=(np.where(flight,.55,.28)+(Y%3.0<.15)*.35)*(1-frame)
    emis[gm]=(np.array([.80,.76,.64])*lit[...,None])[gm]
    # glass doors at the foot of the -x face
    door=gm&(Y<2.4)&(np.abs(Uu-D/2)<.9)
    col[door]=np.array([.10,.12,.14]);emis[door]=(np.array([.8,.76,.64])*(.18+.2*np.clip((2.4-Y[door])/2.4,0,1))[...,None])
    doorframe=door&((np.abs(np.abs(Uu-D/2)-.45)<.03)|(Y>2.3));col[doorframe]=np.array([.30,.32,.34]);emis[doorframe]=0
    # glazed slot on the +x face and the +-z faces
    for a,b in ((edges[1]+W/2-.35,edges[1]+W/2+.35),(edges[2]+D/2-.4,edges[2]+D/2+.4),(edges[3]+W/2-.35,edges[3]+W/2+.35)):
        sl=(Uu>a)&(Uu<b)&(Y>1.0)&(Y<10.6)
        col[sl]=np.array([.12,.15,.18])+(Y[sl]%3.0<.1)[...,None]*.08;rough[sl]=.08;metal[sl]=.2
        emis[sl]=(np.array([.80,.76,.64])*(.22+(Y[sl]%3.0<.15)*.4)[...,None])
    # red and blue bands round the top, a white band under them
    band=lambda y0,y1:(Y>y0)&(Y<y1)&(Uu<edges[4])
    col[band(14.45,15.0)]=rgb((.80,.08,.14),.95+(mott-.5)*.08)[band(14.45,15.0)]
    col[band(14.3,14.45)]=np.array([.93,.94,.94]);col[band(14.0,14.3)]=rgb((.10,.22,.52),.95+(mott-.5)*.08)[band(14.0,14.3)]
    m=band(14.0,15.0);rough[m]=.35;metal[m]=.1
    # plinth at the foot
    foot=(Y<.45)&(Uu<edges[4]);col[foot]=rgb((.40,.40,.39),.9+(mott-.5)*.2)[foot];rough[foot]=.85;metal[foot]=0
    # strip u 11.6..12: fascia (y 0..1.2: red over white over blue), screen panel (y 1.2..4)
    s=Uu>=edges[4]
    fy=Y
    fas=np.where((fy<.5)[...,None],rgb((.80,.08,.14),.95+(mott-.5)*.06),np.where((fy<.65)[...,None],np.array([.93,.94,.94]),rgb((.10,.22,.52),.95+(mott-.5)*.06)))
    sc=(fy>=1.2)
    both=np.where(sc[...,None],panel,fas)
    col[s]=both[s];rough[s]=np.where(sc,.45,.35)[s];metal[s]=np.where(sc,.6,.1)[s]
    # navy totem and its red cap: y 4..6 of the strip
    tot=s&(fy>=4)&(fy<6);col[tot]=rgb((.05,.12,.30),.95+(mott-.5)*.06)[tot];rough[tot]=.4;metal[tot]=.2
    cap=s&(fy>=6)&(fy<6.4);col[cap]=np.array([.80,.08,.14])
    # LED passenger information display: y 7..8 of the strip, amber dot rows on black
    dsp=s&(fy>=7)&(fy<8);col[dsp]=np.array([.02,.02,.025]);rough[dsp]=.25;metal[dsp]=0
    rows=dsp&((np.abs(((fy-7)%.33)-.165))<.06)&(np.sin(Y*2*np.pi/.03)>0)&(fractal(n,1.0,404,stretch=(1,40))>.42)
    col[rows]=np.array([1,.55,.08]);emis[rows]=np.array([1,.55,.08])
    orm=np.stack([np.ones((n,n)),rough,metal],-1)
    return np.clip(col,0,1),normal_from_height(blur(height,1),n/150),orm,np.clip(emis,0,1)

def concrete(n=512):
    """Cast in-situ station concrete on a 3 m tile: board-marked lifts, mottling, soft rain streaks."""
    mott=fractal(n,1.8,421);fine=fractal(n,2.5,422);grain=white(n,423);vs=fractal(n,1.1,424,stretch=(1,20))
    col=rgb((.63,.625,.60),.9+(mott-.5)*.3+(fine-.5)*.08+(blur(grain,1)-.5)*.06)
    st=np.clip((vs-.5)*3,0,1)*.35;col=col*(1-st[...,None])+np.array([.45,.43,.39])*st[...,None]
    pores=np.clip((blur(white(n,425),1)-.74)*7,0,1);col*=(1-.25*pores)[...,None]
    yy=(np.mgrid[0:n,0:n][0]+.5)/n;lift=np.exp(-((np.abs((yy*3%1.0)-.5)-.5)/.004)**2)
    col*=(1-.25*lift)[...,None]
    return np.clip(col,0,1),normal_from_height(blur(mott,2)*.3-lift*.6,n/120)

def wash(n=128):
    """Night light pool for the platform: brightest under the fixture line (v=.5), fading to the sides."""
    U,V=_grid(n,n);a=np.exp(-((V-.5)/.28)**2)*(.75+.25*np.cos((U-.5)*2*np.pi)**2)
    return np.clip(np.stack([a,a*.93,a*.8],-1),0,1)

# ------------------------------------------------------------------ Innovia atlas
def _region(rect_):
    c0,r0,w,h=rect_[:4];return (slice(r0,r0+h),slice(c0,c0+w)),w,h

def innovia():
    """Bombardier Innovia Mark II coach atlas (TRAIN_N square, layout constants above). White body,
    a continuous dark tinted window band with the interior just showing through, the Rapid KL red
    band and blue pin line under it, a glossy black nose mask round the raked windscreen, LED head
    and tail clusters. Returns colour, normal, ORM (G roughness, B metal) and emission (headlamps,
    tail lamps and the destination display carry through the day; saloon light only at night)."""
    N=TRAIN_N
    col=np.zeros((N,N,3),np.float32)+.5;rough=np.full((N,N),.5,np.float32);metal=np.zeros((N,N),np.float32)
    height=np.zeros((N,N),np.float32);emis=np.zeros((N,N,3),np.float32)
    big=fractal(N,1.6,501);grain=white(N,502);dirt=fractal(N,1.2,503,stretch=(1,12))
    WHITE=(.93,.935,.93);RED=(.80,.07,.13);BLUE=(.08,.20,.52);BLACK=(.035,.04,.05);SKIRT=(.34,.36,.38)
    def put(rect_,layer_col,layer_rough,layer_metal,layer_h=None,layer_e=None):
        (sl),w,h=_region(rect_)
        col[sl]=layer_col;rough[sl]=layer_rough;metal[sl]=layer_metal
        if layer_h is not None:height[sl]=layer_h
        if layer_e is not None:emis[sl]=layer_e

    def glass_band(Y,px,interior=True):
        """Tinted glazing with the saloon behind it: seat backs, a grab rail, the ceiling light."""
        g=np.zeros(Y.shape+(3,),np.float32)+np.array(BLACK)
        refl=np.clip((Y-1.9)/1.4,0,1)
        g+=np.stack([refl*.05,refl*.07,refl*.09],-1)
        if interior:
            hint=np.clip((2.25-Y)/.02,0,1)*np.clip((Y-1.85)/.02,0,1)*.035+np.exp(-((Y-3.05)/.05)**2)*.06+np.exp(-((Y-2.72)/.012)**2)*.03
            g+=hint[...,None]*np.array([1,.98,.9])
        return g

    # ---------------- body side: |z| across, y down
    c0,r0,w,h,pxm=WALL;(sl),_,_=_region(WALL)
    Zc,Yc=_grid(h,w);Z=Zc*w/pxm;Y=4.0-Yc*h/pxm;px=1/pxm
    c=np.zeros((h,w,3),np.float32)+np.array(WHITE)
    c*=(.97+(big[sl]-.5)*.05)[...,None]
    r=np.full((h,w),.32,np.float32);m=np.zeros((h,w),np.float32);hh=np.zeros((h,w),np.float32);e=np.zeros((h,w,3),np.float32)
    skirt=Y<.68;c[skirt]=np.array(SKIRT)*(.9+dirt[sl][skirt][...,None]*.2);r[skirt]=.6
    paint(c,rect(Z,Y,-9,9,1.30,1.37,0,px),BLUE)
    paint(c,rect(Z,Y,-9,9,1.45,1.80,0,px),RED)
    # window band: panes |z| .06..2.02 and 4.0..5.52, black pillars in between so it reads continuous
    band=rect(Z,Y,-9,5.62,1.88,3.30,.12,px)
    gl=glass_band(Y,px)
    paint(c,band,BLACK)
    panes=np.maximum(rect(Z,Y,.06,2.02,1.95,3.23,.1,px),rect(Z,Y,4.0,5.52,1.95,3.23,.1,px))
    c=c*(1-panes[...,None])+gl*panes[...,None]
    r=r*(1-band)+.12*band;r=r*(1-panes)+.05*panes
    hh+=band*.2-panes*.25+(rect(Z,Y,.06,2.02,1.95,3.23,.1,px*3)-panes)*.3
    glow=.26+.55*np.exp(-((Y-3.08)/.07)**2)-.12*(Y<2.25)
    e+=(panes*glow)[...,None]*np.array([.95,.9,.78])
    # doorway behind the leaves: saloon floor and far wall, lit at night
    dw=rect(Z,Y,2.18,3.82,.95,3.55,.05,px)
    inner=np.where((Y<1.0)[...,None],np.array([.16,.17,.18]),np.array([.20,.21,.22])*(.75+.35*np.clip((Y-1)/2.4,0,1))[...,None])
    inner=inner*(1-.45*((np.abs(Z-3)<.5)&(Y>1.05)&(Y<1.5)))[...,None]
    c=c*(1-dw[...,None])+inner*dw[...,None];r=r*(1-dw)+.7*dw
    e+=(dw*(.3+.4*np.exp(-((Y-3.4)/.1)**2)))[...,None]*np.array([.95,.9,.78])
    surround=np.clip(rect(Z,Y,2.13,3.87,.92,3.60,.07,px)-dw,0,1);paint(c,surround,(.22,.23,.24))
    hh+=surround*.4-dw*.5
    # door indicator lamp above each doorway, panel seams, a roof gutter line
    lamp=rect(Z,Y,2.9,3.1,3.66,3.72,.02,px);paint(c,lamp,(1,.55,.1));e+=lamp[...,None]*np.array([1,.55,.1])
    seams=np.maximum.reduce([np.exp(-((Y-y)/.006)**2) for y in (.70,1.42,3.40)])
    seams=np.maximum(seams,np.exp(-((Z-5.7)/.006)**2)*(Y>.7))
    c*=(1-.25*seams)[...,None];hh-=seams*.6
    # nose side (|z| 5.75..6.83): black mask sweeps round from the front, red chevron runs out
    ns=Z>5.75
    paint(c,rect(Z,Y,5.9,9,1.9,3.75,.3,px)*ns,BLACK);r=np.where(ns&(rect(Z,Y,5.9,9,1.9,3.75,.3,px)>.5),.08,r)
    # grime along the skirt and under the windows
    g=np.clip(dirt[sl]-.35,0,1)*np.exp(-np.maximum(Y-.7,0)/.5)*.25
    c=c*(1-g[...,None])+np.array([.45,.44,.42])*g[...,None]
    col[sl]=c;rough[sl]=r;metal[sl]=m;height[sl]=hh;emis[sl]=e

    # ---------------- roof: |z| across, |x| down
    c0,r0,w,h,pxm=ROOF_R;(sl),_,_=_region(ROOF_R)
    Zc,Yc=_grid(h,w);Z=Zc*w/pxm;X=Yc*h/pxm;px=1/pxm
    c=rgb((.86,.87,.87),.95+(big[sl]-.5)*.06-np.clip(dirt[sl]-.5,0,1)*.2)
    walk=rect(Z,X,-9,9,-.3,.3,0,px)*.06;c*=(1-walk)[...,None]
    ribs=np.exp(-((np.abs((Z%.25)-.125)-.125)/.01)**2)*(X<1.2)*.15;c*=(1-ribs)[...,None]
    col[sl]=c;rough[sl]=.45;metal[sl]=0;height[sl]=ribs*2

    # ---------------- front: |x| across, y down
    c0,r0,w,h,pxm=FRONT;(sl),_,_=_region(FRONT)
    Xc,Yc=_grid(h,w);X=Xc*w/pxm;Y=4.0-Yc*h/pxm;px=1/pxm
    c=np.zeros((h,w,3),np.float32)+np.array(WHITE);c*=(.97+(big[sl]-.5)*.05)[...,None]
    r=np.full((h,w),.3,np.float32);hh=np.zeros((h,w),np.float32);e=np.zeros((h,w,3),np.float32)
    c[Y<.62]=np.array(SKIRT);r[Y<.62]=.6
    mask=rect(X,Y,-1.62,1.62,1.92,3.78,.38,px)
    paint(c,mask,BLACK);r=r*(1-mask)+.1*mask
    ws=rect(X,Y,-1.28,1.28,2.42,3.28,.14,px)
    wsg=glass_band(Y,px,interior=False)+np.array([.02,.03,.05])
    c=c*(1-ws[...,None])+wsg*ws[...,None];r=r*(1-ws)+.04*ws;hh+=mask*.2-ws*.2
    disp=rect(X,Y,-.72,.72,3.35,3.56,.03,px);paint(c,disp,(.02,.02,.02))
    dots=disp*((np.sin(X*2*np.pi/.03)*np.sin(Y*2*np.pi/.03))>.2)*(np.abs(Y-3.455)<.06)*(np.abs(X)<.6)
    e+=dots[...,None]*np.array([1,.55,.08]);paint(c,dots,(1,.55,.08))
    # red chevron under the mask and the blue pin line under it
    chev=np.clip(rect(X,Y,-1.9,1.9,1.45,1.86,0,px)*(Y>1.86-(1.6-np.abs(X))*.35),0,1)
    paint(c,chev,RED)
    paint(c,rect(X,Y,-1.9,1.9,1.30,1.37,0,px),BLUE)
    # head and tail clusters
    hous=rect(X,Y,.82,1.52,.98,1.26,.08,px);paint(c,hous,(.06,.06,.07));hh-=hous*.3
    for xc in (.95,1.12):
        led=np.clip(1-np.hypot(X-xc,Y-1.12)/.055,0,1)**.6;paint(c,led,(1,1,.98));e+=led[...,None]*np.array([1,1,.98])
    tail=rect(X,Y,1.26,1.46,1.05,1.19,.04,px);paint(c,tail,(.95,.1,.08));e+=tail[...,None]*np.array([1,.08,.06])
    anti=rect(X,Y,-1.9,1.9,.45,.72,.02,px);paint(c,anti,(.18,.19,.2));r=r*(1-anti)+.6*anti
    g=np.clip(dirt[sl]-.4,0,1)*np.exp(-np.maximum(Y-.7,0)/.4)*.3;c=c*(1-g[...,None])+np.array([.42,.41,.40])*g[...,None]
    col[sl]=c;rough[sl]=r;metal[sl]=0;height[sl]=hh;emis[sl]=e

    # ---------------- door leaf: outer edge .. meeting edge, y down
    c0,r0,w,h,pxm=DOOR;(sl),_,_=_region(DOOR)
    Uc,Yc=_grid(h,w);Uq=Uc*w/pxm;Y=3.55-Yc*h/pxm;px=1/pxm
    c=np.zeros((h,w,3),np.float32)+np.array(WHITE);r=np.full((h,w),.32,np.float32);hh=np.zeros((h,w),np.float32);e=np.zeros((h,w,3),np.float32)
    paint(c,rect(Uq,Y,-9,9,1.30,1.37,0,px),BLUE);paint(c,rect(Uq,Y,-9,9,1.45,1.80,0,px),RED)
    win=rect(Uq,Y,.12,.7,1.95,3.23,.08,px)
    wg=glass_band(Y,px)
    c=c*(1-win[...,None])+wg*win[...,None];r=r*(1-win)+.05*win
    e+=(win*(.26+.55*np.exp(-((Y-3.08)/.07)**2)-.12*(Y<2.25)))[...,None]*np.array([.95,.9,.78])
    seal=rect(Uq,Y,.75,.9,-9,9,0,px);paint(c,seal,(.05,.05,.05));r=r*(1-seal)+.8*seal
    hh+=seal*-.5-win*.25
    col[sl]=c;rough[sl]=r;metal[sl]=0;height[sl]=hh;emis[sl]=e

    # ---------------- saloon lining: |z| across, y down
    c0,r0,w,h,pxm=LINING;(sl),_,_=_region(LINING)
    Zc,Yc=_grid(h,w);Z=Zc*w/pxm;Y=3.2-Yc*h/pxm;px=1/pxm
    c=rgb((.84,.85,.84),.96+(big[sl]-.5)*.04)
    win=np.maximum(rect(Z,Y,.06,2.02,1.95,3.1,.1,px),rect(Z,Y,4.0,5.52,1.95,3.1,.1,px))
    sky=np.stack([.30+(Y-1.9)*.12,.36+(Y-1.9)*.12,.42+(Y-1.9)*.12],-1)
    c=c*(1-win[...,None])+sky*win[...,None]
    dw=rect(Z,Y,2.18,3.82,.9,3.55,.05,px);paint(c,dw,(.28,.30,.32))
    low=Y<1.55;c[low]*=.82
    ads=np.maximum(rect(Z,Y,.3,1.8,2.95,3.12,.01,px),rect(Z,Y,4.2,5.3,2.95,3.12,.01,px))
    paint(c,ads,(.93,.9,.82))
    col[sl]=c;rough[sl]=np.where(win>.5,.1,.55);metal[sl]=0;height[sl]=-win*.2;emis[sl]=c*.3*np.array([1,.97,.88])

    # ---------------- floor: |z| across, |x| down
    c0,r0,w,h,pxm=FLOOR;(sl),_,_=_region(FLOOR)
    Zc,Yc=_grid(h,w);Z=Zc*w/pxm;X=Yc*h/pxm;px=1/pxm
    speck=(grain[sl]>.93)*.08-(grain[sl]<.05)*.06
    c=rgb((.46,.48,.50),.95+(big[sl]-.5)*.06+speck)
    yel=rect(Z,X,2.18,3.82,1.52,1.72,0,px);paint(c,yel,(.85,.66,.1))
    aisle=rect(Z,X,-9,9,-.6,.6,0,px)*.05;c=c*(1+aisle[...,None])
    col[sl]=c;rough[sl]=.85;metal[sl]=0;height[sl]=(grain[sl]-.5)*.1;emis[sl]=c*.35*np.array([1,.97,.88])

    # ---------------- seat moquette
    (sl),w,h=_region(SEAT)
    wv=np.sin(np.mgrid[0:h,0:w][1]*.9)*np.sin(np.mgrid[0:h,0:w][0]*.9)
    col[sl]=rgb((.10,.24,.55),.9+wv*.05+(grain[sl]-.5)*.12);rough[sl]=.9;height[sl]=wv*.2;emis[sl]=col[sl]*.3

    # ---------------- ceiling: |x| across, |z| down; two LED lines
    c0,r0,w,h,pxm=CEIL;(sl),_,_=_region(CEIL)
    Xc,Zc=_grid(h,w);X=Xc*w/pxm;Z=Zc*h/pxm;px=1/pxm
    c=rgb((.90,.91,.90),.97+(big[sl]-.5)*.03)
    led=rect(X,Z,.47,.63,-9,9,.02,px);paint(c,led,(.98,.97,.92))
    col[sl]=c;rough[sl]=.6;emis[sl]=led[...,None]*np.array([.88,.86,.78])

    # ---------------- swatches
    c0,r0,w,h=SWATCH
    tones={'under':((.16,.16,.17),.75,.3),'bogie':((.24,.25,.27),.6,.6),'wheel':((.42,.42,.43),.45,.9),'pole':((.93,.72,.12),.35,.3),
           'rubber':((.07,.07,.08),.85,0),'aircon':((.70,.72,.73),.5,.3),'white':(WHITE,.32,0),'grey':((.62,.64,.65),.55,0),
           'display':((.03,.03,.035),.3,0),'seatframe':((.66,.68,.70),.35,.8)}
    for k,name in enumerate(SWATCHES):
        rr=slice(r0+60*k,r0+60*k+60);cc=slice(c0,c0+w);base,ro,me=tones[name]
        col[rr,cc]=np.array(base)*(.92+(big[rr,cc]-.5)*.2+(dirt[rr,cc]-.5)*.15)[...,None];rough[rr,cc]=ro;metal[rr,cc]=me

    for c0,r0,w,h,*_ in (WALL,ROOF_R,FRONT,DOOR,LINING,FLOOR,SEAT,CEIL):
        for a in (col,rough,metal,height,emis):
            a[r0:r0+h,max(c0-3,0):c0]=a[r0:r0+h,c0:c0+1];a[r0:r0+h,c0+w:min(c0+w+3,N)]=a[r0:r0+h,c0+w-1:c0+w]
            x0,x1=max(c0-3,0),min(c0+w+3,N)
            a[max(r0-3,0):r0,x0:x1]=a[r0:r0+1,x0:x1];a[r0+h:min(r0+h+3,N),x0:x1]=a[r0+h-1:r0+h,x0:x1]
    orm=np.stack([np.ones((N,N),np.float32),rough,metal],-1)
    return np.clip(col,0,1),normal_from_height(blur(height,1),N/200),orm,np.clip(emis,0,1)
