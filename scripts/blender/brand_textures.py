"""Procedural, tileable textures for the branded stops: the Shell forecourt, the KFC and
McDonald's drive-throughs and the seven LM_SHOP shoplots (build_shell.py, build_fastfood.py,
build_shops.py).

Built on the spectral primitives in pbr_textures.py, so every tiled field wraps by construction.
Colour images hold sRGB; normals are OpenGL tangent space. Tiled generators return
(colour, normal) for pbr_kit.texset. Most surfaces are near white on purpose: the builders tint
them per object with vertex colours, so one painted-panel material serves every brand colour.
Nothing is photographed or downloaded; there are no logos in here, only surfaces.
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, worley_edges, rgb

def _uv(n,m=None):
    v,u=np.mgrid[0:n,0:(m or n)]
    return u/(m or n),v/n

def _smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)

def _grid(coord,period,width):
    """Periodic line mask along one pixel axis: 1 on a line `width` px wide every `period` px."""
    d=np.abs(((coord+period/2)%period)-period/2)
    return 1-_smooth(width*.5,width*.5+1.2,d)

def _half(a):
    """2x2 box downsample: normal maps hold broad relief, so half size costs nothing visible and
    WebP stops spending bytes on per-pixel grain."""
    return (a[0::2,0::2]+a[1::2,0::2]+a[0::2,1::2]+a[1::2,1::2])/4

def _blobs(n,count,seed,r0,r1,wobble=.35):
    """Wrapped soft blobs with ragged edges, radius r0..r1 px. Returns (coverage 0..1, rim 0..1)."""
    r=np.random.default_rng(seed);yy,xx=np.mgrid[0:n,0:n].astype(np.float32)
    edge=fractal(n,1.6,seed+1)-.5;cover=np.zeros((n,n),np.float32);rim=np.zeros((n,n),np.float32)
    for _ in range(count):
        cx,cy=r.random(2)*n;rad=r0+(r1-r0)*r.random()**1.6;sx=.6+.8*r.random()
        dx=xx-cx;dx-=n*np.round(dx/n);dy=yy-cy;dy-=n*np.round(dy/n)
        d=np.sqrt((dx*sx)**2+(dy/sx)**2)/rad+edge*wobble
        cover=np.maximum(cover,(1-_smooth(.75,1.0,d))*(.55+.45*r.random()))
        rim=np.maximum(rim,np.exp(-((d-.92)/.06)**2))
    return cover,rim

# ------------------------------------------------------------------------------ ground
def forecourt(n=1024):
    """Fuelling-apron concrete on a 6 m tile: 3 m slabs with saw-cut joints, a slightly different
    tone per slab, trowel mottling and aggregate, fuel and oil stains with darker rims where they
    dried, drips, and faint tyre polish along v (the direction cars pull in)."""
    u,v=_uv(n);yy,xx=np.mgrid[0:n,0:n]
    slab=(np.floor(u*2)+2*np.floor(v*2)).astype(int);tone=np.array([1.0,.975,.985,1.012])[slab]
    mott=fractal(n,2.3,301)*.6+fractal(n,1.5,302)*.4
    grain=white(n,303);agg=blur(white(n,304),1)
    col=rgb((.69,.68,.65),tone*(.97+(mott-.5)*.10+(agg-.5)*.07))
    col[grain>.992]*=.78;col[grain<.006]=col[grain<.006]*.9+.08
    # Stains are thresholded noise, not discs: diffuse where fuel spread, crisp where it pooled,
    # thickest in the bands along v where cars stand at the pumps.
    bands=_smooth(.35,.75,fractal(n,1.0,308,stretch=(1,5)))
    field=fractal(n,1.9,305)+(fractal(n,2.8,306)-.5)*.35
    stain=_smooth(.56,.74,field*(.82+.3*bands))
    pooled=_smooth(.70,.72,field*(.82+.3*bands))*stain
    drip,_=_blobs(n,70,307,2.5,9,.9)
    tyre=_smooth(.55,.9,fractal(n,1.2,309,stretch=(18,1)))*_smooth(.3,.7,fractal(n,2.2,310))
    dark=1-stain*.22-pooled*.14-drip*bands*.28-tyre*.08
    col*=dark[...,None];col[...,2]*=1-stain*.04          # oil reads a touch warm
    joint=np.maximum(_grid(xx,n/2,2.2),_grid(yy,n/2,2.2))
    col*=(1-joint*.45)[...,None]
    height=blur(mott*.5+agg*.2-joint*1.2-(grain>.992)*.5,2)
    return np.clip(col,0,1),_half(normal_from_height(height,n/320))

def asphalt(n=512):
    """Drive-thru lane asphalt on a 3 m tile: dark binder, pale aggregate, worn lighter patches,
    an oil line where cars idle. Height is the stone texture."""
    stones=blur(white(n,311),1);big=_smooth(.62,.72,blur(white(n,312),2))
    wear=fractal(n,2.2,313);oil=_smooth(.6,.95,fractal(n,1.1,314,stretch=(1,14)))
    u,_=_uv(n);lane=np.exp(-((u-.5)/.09)**2)
    col=rgb((.25,.25,.255),.82+(wear-.5)*.25+(stones-.5)*.35+big*.55)
    col*=(1-lane*oil*.35)[...,None]
    return np.clip(col,0,1),_half(normal_from_height(blur(stones*.4+big*.9,2),n/160))

def paving(n=512):
    """Pale concrete pavers, 200 x 100 mm in a stretcher bond on a 1.2 m tile, for the walkways."""
    yy,xx=np.mgrid[0:n,0:n];rows=6*2;ph=n/rows;pw=ph*2
    row=(yy//ph).astype(int);off=(row%2)*pw/2
    joint=np.maximum(_grid(yy,ph,2),_grid(xx+off,pw,2))
    r=np.random.default_rng(321).random((rows,64));brick=((xx+off)//pw).astype(int)%64
    tone=.9+.1*r[row%rows,brick]
    col=rgb((.74,.72,.68),tone*(.96+(fractal(n,2,322)-.5)*.12))*(1-joint*.45)[...,None]
    return np.clip(col,0,1),_half(normal_from_height(blur(-joint+fractal(n,2.4,323)*.2,1),n/200))

def workshop_floor(n=512):
    """Bengkel floor on a 4 m tile: bare trowelled concrete, heavy engine-oil and grease stains."""
    mott=fractal(n,2.1,331);grain=blur(white(n,332),1)
    col=rgb((.56,.55,.52),.95+(mott-.5)*.16+(grain-.5)*.08)
    field=fractal(n,1.8,333)+(fractal(n,2.6,335)-.5)*.4
    stain=_smooth(.5,.7,field);drip,_=_blobs(n,80,334,2,8,.9)
    col*=(1-stain*.45-_smooth(.66,.69,field)*.15-drip*.35)[...,None]
    return np.clip(col,0,1),_half(normal_from_height(blur(mott*.4+grain*.2,2),n/300))

# ------------------------------------------------------------------------------ walls and panels
def panel(n=512):
    """Powder-coated aluminium composite cladding on a 2.4 m tile: 1.2 m panels with 10 mm
    recessed joints, an orange-peel finish and faint weathering. Near white: tinted per object."""
    yy,xx=np.mgrid[0:n,0:n];joint=np.maximum(_grid(xx,n/2,2.4),_grid(yy,n/2,2.4))
    peel=blur(white(n,341),2);mott=fractal(n,2.4,342);streak=fractal(n,1.1,343,stretch=(1,12))
    col=rgb((.95,.95,.94),.99+(mott-.5)*.05-_smooth(.6,.95,streak)*.05-joint*.16)
    return np.clip(col,0,1),_half(normal_from_height(blur(peel*.15-joint*.7,1),n/260))

def render(n=512):
    """Painted cement render on a 3 m tile: trowel mottling, rain streaks that come and go,
    pitting. The builders add splash-back grime with vertex colour."""
    mott=fractal(n,2.1,351)*.6+fractal(n,1.4,352)*.4
    streak=fractal(n,1.1,353,stretch=(1,16));patch=_smooth(.45,.8,fractal(n,2.4,354))
    grain=blur(white(n,355),2);pits=white(n,356)>.997
    col=rgb((.95,.945,.925),.985+(mott-.5)*.06-_smooth(.6,.92,streak)*patch*.09+(grain-.5)*.03)
    col[pits]*=.86
    return np.clip(col,0,1),_half(normal_from_height(blur(grain*.3+mott*.5-pits*.5,2),n/300))

def tiles(n=512):
    """Porcelain floor tiles, 600 mm with 3 mm grout on a 1.2 m tile, a shade apart per tile."""
    yy,xx=np.mgrid[0:n,0:n];grout=np.maximum(_grid(xx,n/2,2),_grid(yy,n/2,2))
    t=(np.floor(xx/(n/2))+2*np.floor(yy/(n/2))).astype(int);tone=np.array([1,.97,.985,1.01])[t]
    speck=blur(white(n,361),1)
    col=rgb((.88,.87,.84),tone*(.97+(speck-.5)*.08+(fractal(n,2.4,362)-.5)*.05))*(1-grout*.3)[...,None]
    return np.clip(col,0,1),normal_from_height(-grout,n/220)

def brushed(n=256):
    """Brushed stainless on a 0.5 m tile, grain along u; tinted dark for anodised frames."""
    s=fractal(n,1.5,371,stretch=(40,1))*.7+blur(white(n,372),1)*.3
    col=rgb((.80,.81,.82),.9+(s-.5)*.22)
    return np.clip(col,0,1),normal_from_height(s*.3,n/200)

def slats(n=512):
    """Timber-look slat cladding on a 1.2 m tile: 16 vertical boards with dark shadow gaps and
    grain along v."""
    u,v=_uv(n);board=(u*16)%1;gap=1-_smooth(.0,.06,board)*_smooth(1.0,.9,board)
    grain=fractal(n,1.8,381,stretch=(1,14))*.7+fractal(n,1.2,382,stretch=(1,40))*.3
    per=np.random.default_rng(383).random(16)[(u*16).astype(int)%16]
    col=rgb((.74,.54,.34),(.82+per*.2+(grain-.5)*.3)*(1-gap*.75))
    return np.clip(col,0,1),normal_from_height(grain*.3-gap*1.4,n/180)

def shutter(n=256):
    """Galvanised roller shutter slats on a 0.5 m tile: seven rounded slats per tile, zinc
    spangle mottling, grime settling in the grooves. Slats run along u."""
    _,v=_uv(n);s=(v*7)%1;prof=np.sin(s*np.pi)**.5
    col=rgb((.70,.72,.73),(.82+(fractal(n,2,391)-.5)*.2+blur(white(n,392),1)*.06)*(.72+.28*prof))
    return np.clip(col,0,1),normal_from_height(prof*1.2,n/60)

def zinc(n=256):
    """Corrugated zinc sheet on a 0.8 m tile, ridges along v, with rust bleeding down from the laps."""
    u,v=_uv(n);prof=np.sin(u*2*np.pi*10)*.5+.5
    rust=_smooth(.62,.85,fractal(n,1.4,401,stretch=(1,8)))*_smooth(.5,1,v)
    col=rgb((.72,.73,.72),.86+prof*.1+(fractal(n,2,402)-.5)*.14)
    col=col*(1-rust[...,None]*.45)+rust[...,None]*np.array([.33,.18,.08])*.45
    return np.clip(col,0,1),normal_from_height(prof*1.5,n/50)

# ------------------------------------------------------------------------------ store fittings
PACKS=[(.83,.18,.15),(.95,.72,.12),(.14,.42,.74),(.12,.55,.33),(.93,.93,.90),(.62,.12,.42),
       (.98,.5,.1),(.2,.2,.22),(.55,.78,.88),(.85,.35,.55),(.4,.25,.15),(.7,.85,.3)]

def products(n=512):
    """Stocked shelving, tiling along u (1.2 m) and covering four shelves along v: packets, bottles
    and boxes of mixed widths with lighter label bands and top shadows, a grey price rail with
    tags under each row, a dark back panel. Used as colour and as night emission."""
    rng=np.random.default_rng(411);col=np.zeros((n,n,3))+np.array([.16,.17,.18]);height=np.zeros((n,n))
    rows=4;rh=n//rows
    for row in range(rows):
        top=row*rh;rail=int(rh*.12);base=top+rh-rail
        col[base:top+rh]=np.array([.78,.79,.8]);height[base:top+rh]=.8
        x=0
        while x<n:
            w=int(rng.integers(10,34));h=int(rh*(.5+.38*rng.random()));c=np.array(PACKS[rng.integers(len(PACKS))])
            bottle=rng.random()<.25;xs=np.arange(x,x+w)%n;y0=base-h
            for i,px in enumerate(xs[1:-1]):
                t=i/max(w-3,1);shade=.78+.3*np.sin(t*np.pi)
                yh=y0+(int(h*.25*(1-np.sin(t*np.pi)**.3)) if bottle else 0)
                col[yh:base,px]=c*shade
                lb=yh+int((base-yh)*.35);col[lb:lb+max(2,(base-yh)//6),px]=np.clip(c*1.4+.25,0,1)*shade
                col[yh:yh+2,px]*=.6;height[yh:base,px]=.5+.2*np.sin(t*np.pi)
            x+=w
        for tx in range(0,n,int(n/9)):col[base+2:base+rail-2,tx+4:tx+18]=np.array([.98,.95,.55])
    col*=(.94+.12*fractal(n,2.2,412))[...,None]
    return np.clip(col,0,1),_half(normal_from_height(blur(height,1),n/120))

def menu(kind,n=512):
    """A drive-thru or counter menu board, 2:1. Three panels, each a hero food 'photo' drawn with
    ellipses over pseudo-text bars (no real words, no prices). Colour only; the runtime lights it.
    Works in pixels (x across, y down) so round things stay round."""
    h=n//2;yy,xx=np.mgrid[0:h,0:n].astype(np.float32);rng=np.random.default_rng({'kfc':421,'mcd':422,'zus':423}[kind])
    bg=np.array({'kfc':(.66,.05,.07),'mcd':(.12,.12,.13),'zus':(.07,.13,.40)}[kind])
    ink=np.array({'kfc':(1,1,1),'mcd':(1,.78,.1),'zus':(.95,.96,1)}[kind])
    photo_bg=np.array({'kfc':(.96,.92,.84),'mcd':(.27,.24,.21),'zus':(.88,.90,.95)}[kind])
    col=np.zeros((h,n,3))+bg*.8
    def ell(cx,cy,rx,ry):return ((xx-cx)/rx)**2+((yy-cy)/ry)**2<1
    pw=n/3
    for p in range(3):
        x0=p*pw+6;x1=(p+1)*pw-6;cx=(x0+x1)/2
        col[8:h-8,int(x0):int(x1)]=bg
        col[8:34,int(x0):int(x1)]=ink if kind!='mcd' else (.85,.1,.1)
        col[42:140,int(x0)+8:int(x1)-8]=photo_bg;cy=92
        if kind=='kfc':
            col[ell(cx,cy+28,50,14)]=(.78,.08,.08)
            for _ in range(11):
                col[ell(cx+(rng.random()-.5)*80,cy+(rng.random()-.6)*44,11+9*rng.random(),9+6*rng.random())]=np.array((.74,.44,.15))*(.8+.35*rng.random())
        elif kind=='mcd':
            col[ell(cx,cy-12,46,26)]=(.80,.47,.16);col[ell(cx,cy+2,50,7)]=(.36,.62,.18)
            col[ell(cx,cy+10,48,9)]=(.32,.15,.07);col[ell(cx,cy+18,42,5)]=(.98,.72,.12);col[ell(cx,cy+26,44,10)]=(.74,.43,.15)
        else:
            col[ell(cx,cy+5,22,40)&(yy>cy-28)]=(.97,.97,.98);col[(abs(xx-cx)<26)&(abs(yy-(cy-30))<5)]=(.08,.14,.42)
        for k in range(6):
            y=152+k*16;w=.45+.45*rng.random()
            col[int(y):int(y)+6,int(x0)+10:int(x0+10+(x1-x0-20)*w)]=ink*.95
    return np.clip(col,0,1)

def wash(n=128):
    """A pool of light on the ground under a canopy luminaire. Greyscale; the runtime adds it."""
    u,v=_uv(n);d=np.sqrt((u-.5)**2+(v-.5)**2)*2
    c=np.exp(-d*d*2.4)*(1-_smooth(.8,1,d))
    return np.clip(np.stack([c]*3,-1)/c.max(),0,1)
