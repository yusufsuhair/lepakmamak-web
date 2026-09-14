"""Procedural, tileable textures for Gereja Harapan, Kuil Seri Harmoni and Tokong Harmoni
(scripts/blender/build_worship.py).

Built on the spectral primitives in pbr_textures.py (and the masjid's granite, glaze and wash, so
the four worship sites share a plaza and a night look). Colour images hold sRGB with row 0 at the
top; normals are OpenGL tangent space. Generators return (colour, normal) for pbr_kit.texset; the
few that are not tiled surfaces (kolam, wash) return one array.

Sculpture is painted, not modelled: the gopuram's deities, the painted pillars and the carved beams
are signed-distance shapes rendered into a height field, so their relief comes from the normal map
and a baked occlusion term, and the geometry stays a few thousand triangles.
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, worley_edges, rgb, wood, granite
import masjid_textures
from masjid_textures import granite_tiles, glaze, wash   # shared with Masjid Kampung Maju

def half(a):
    """2x2 box downsample: grain-scale normals ship at half the colour resolution (WebP stops
    spending bytes on per-pixel noise; the relief that reads at game distance survives)."""
    return (a[0::2,0::2]+a[1::2,0::2]+a[0::2,1::2]+a[1::2,1::2])/4

def foliage():
    c,n=masjid_textures.foliage();return c,half(n)

def _smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)

def field(h,w,beta,seed,stretch=(1,1)):
    """Tileable 1/f^beta noise of any shape, isotropic in pixels, 0..1."""
    r=np.random.default_rng(seed);m=max(h,w)
    fy=np.fft.fftfreq(h)[:,None]*h/m;fx=np.fft.fftfreq(w)[None,:]*w/m
    f=np.sqrt((fx*m*stretch[0])**2+(fy*m*stretch[1])**2);f[0,0]=1
    amp=f**(-beta);amp[0,0]=0
    a=np.real(np.fft.ifft2(amp*np.exp(2j*np.pi*r.random((h,w)))));a-=a.min()
    return a/max(a.max(),1e-9)

def wide_blur(a,sigma):
    """Wrapped gaussian of sigma pixels (FFT), for occlusion and soft glows."""
    h,w=a.shape;fy=np.fft.fftfreq(h)[:,None];fx=np.fft.fftfreq(w)[None,:]
    return np.real(np.fft.ifft2(np.fft.fft2(a)*np.exp(-2*(np.pi*sigma)**2*(fx*fx+fy*fy))))

def occlusion(height,sigma,k):
    """Cavity darkening: how far a texel sits below its neighbourhood."""
    return np.clip((wide_blur(height,sigma)-height)*k,0,1)

def _grid(h,w,sx,sy):
    """Texel centres in metres: x to the right over sx, y up over sy (row 0 is the top)."""
    rows,cols=np.mgrid[0:h,0:w].astype(np.float32)
    return (cols+.5)/w*sx,(h-rows-.5)/h*sy

def _cellrand(ix,iy,seed,k=0):
    """Stable 0..1 per integer cell."""
    s=np.sin(ix*12.9898+iy*78.233+seed*37.719+k*4.1)*43758.5453
    return s-np.floor(s)

def _hex(h):
    h=h.lstrip('#');return np.array([int(h[i:i+2],16)/255 for i in (0,2,4)])

# ------------------------------------------------------------------------------ sdf primitives
def sd_circle(X,Y,cx,cy,r):return np.hypot(X-cx,Y-cy)-r
def sd_ellipse(X,Y,cx,cy,rx,ry):return (np.hypot((X-cx)/rx,(Y-cy)/ry)-1)*min(rx,ry)
def sd_ring(X,Y,cx,cy,r,t):return np.abs(np.hypot(X-cx,Y-cy)-r)-t
def sd_box(X,Y,cx,cy,hx,hy):
    qx,qy=np.abs(X-cx)-hx,np.abs(Y-cy)-hy
    return np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)
def sd_capsule(X,Y,ax,ay,bx,by,r):
    px,py=X-ax,Y-ay;dx,dy=bx-ax,by-ay;t=np.clip((px*dx+py*dy)/(dx*dx+dy*dy+1e-9),0,1)
    return np.hypot(px-dx*t,py-dy*t)-r
def sd_limb(X,Y,pts,r):
    return np.minimum.reduce([sd_capsule(X,Y,*pts[i],*pts[i+1],r) for i in range(len(pts)-1)])
def sd_trap(X,Y,cx,y0,y1,w0,w1):
    """Vertical trapezoid: half width w0 at y0 tapering to w1 at y1."""
    t=np.clip((Y-y0)/(y1-y0),0,1)
    return np.maximum(np.abs(X-cx)-(w0+(w1-w0)*t),np.maximum(y0-Y,Y-y1))

class Relief:
    """Colour + height canvas. paint() lays a shape over what is there: its colour replaces the
    old one inside (anti-aliased over a texel), its height is lift plus a rounded bulge."""
    def __init__(s,h,w,colour,height=0.0):
        s.col=np.zeros((h,w,3))+colour;s.h=np.zeros((h,w))+height
    def paint(s,win,d,colour,lift=0.0,bulge=0.0,soft=.02,px=.004):
        a=np.clip(.5-d/px,0,1)
        if not a.any():return
        prof=lift+bulge*np.sqrt(np.clip(-d/soft,0,1))
        c=s.col[win];hh=s.h[win]
        s.col[win]=c*(1-a[...,None])+np.asarray(colour)*a[...,None]
        s.h[win]=hh*(1-a)+np.maximum(hh,prof)*a

# ------------------------------------------------------------------------------ shared finishes
def gold_leaf(n=256):
    """Gilding on a 0.4 m tile: leaf laid in 8 cm squares whose seams catch a little, burnished
    highs and rubbed-through bole (red ground) at a few edges."""
    X,Y=_grid(n,n,.4,.4);fu=(X/.08)%1;fv=(Y/.08)%1;ix=np.floor(X/.08);iy=np.floor(Y/.08)
    tone=_cellrand(ix,iy,11)
    seam=1-_smooth(.0,.05,np.minimum(np.minimum(fu,1-fu),np.minimum(fv,1-fv)))
    mott=fractal(n,2.2,12);rub=_smooth(.72,.9,fractal(n,1.6,13))
    col=rgb((.93,.74,.36),.9+(tone-.5)*.08+(mott-.5)*.12-seam*.06)
    col=col*(1-rub[...,None]*.35)+_hex('#8a3b22')*rub[...,None]*.35
    return np.clip(col,0,1),normal_from_height(seam*.4+mott*.2,n/60)

def bronze(n=256):
    """Cast bronze, 0.5 m tile: dark warm metal, casting pits, verdigris creeping out of hollows
    and a handled shine where hands and incense ash rub it."""
    mott=fractal(n,2.0,21);fine=fractal(n,2.8,22);pits=white(n,23)>.985
    patina=_smooth(.58,.8,fractal(n,1.7,24))
    col=rgb((.52,.38,.22),.85+(mott-.5)*.3+(fine-.5)*.1)
    col=col*(1-patina[...,None]*.6)+_hex('#4f8a72')*patina[...,None]*.6
    col[pits]*=.6
    return np.clip(col,0,1),normal_from_height(mott*.5+fine*.25-pits*.6,n/60)

def teak(n=512):
    """Oiled teak, grain along u (1.2 m tile); tinted per use (church doors dark, temple doors warm)."""
    c,nm=wood(n);return np.clip(c*np.array([1.0,.86,.7]),0,1),nm

def lime_render(n=512):
    """Colonial lime render on a 3 m tile, painted white: trowel waves, tropical weathering in
    grey-green blotches where the paint holds damp, faint streaks, hairline crazing. The rain
    streaks under ledges are vertex colour (build_worship.grime), so this stays tile-neutral."""
    mott=fractal(n,2.0,31)*.6+fractal(n,1.3,32)*.4;grain=blur(white(n,33),2)
    streak=fractal(n,1.1,34,stretch=(1,14));damp=_smooth(.6,.9,fractal(n,1.5,35))
    col=rgb((.95,.945,.925),.985+(mott-.5)*.05+(grain-.5)*.03-_smooth(.55,.95,streak)*.05)
    col=col*(1-damp[...,None]*.07)+_hex('#9a9a90')*damp[...,None]*.07
    craze=np.clip(1-worley_edges(n,24,36)/1.1,0,1)**6*_smooth(.55,.8,fractal(n,1.7,37))
    col*=(1-craze*.12)[...,None]
    return np.clip(col,0,1),half(normal_from_height(grain*.3+mott*.5-craze*.5,n/260))

def limestone(n=512):
    """Dressed pale stone for mouldings, copings, sills and buttress weatherings (1.2 m tile):
    fine sandy grain, shell flecks, soft soot in patches."""
    grain=blur(white(n,41),1);mott=fractal(n,2.2,42);soot=_smooth(.62,.92,fractal(n,1.4,43))
    col=rgb((.88,.85,.78),.95+(grain-.5)*.08+(mott-.5)*.08)
    col*=(1-soot*.18)[...,None]
    col[white(n,44)>.993]*=1.06
    return np.clip(col,0,1),half(normal_from_height(blur(grain,1)*.3+mott*.3,n/120))

def stripes(n=512):
    """Kavi stripes of a South Indian temple wall on a 1.8 m tile: six vertical 30 cm bands,
    red-ochre and lime white, brushed on over render, the ochre fading where the sun hits."""
    X,Y=_grid(n,n,1.8,1.8);band=np.floor(X/.3)%2
    col,nm=lime_render(n)
    fade=fractal(n,1.4,51,stretch=(1,3));brush=fractal(n,1.2,52,stretch=(1,20))
    ochre=_hex('#b5462e')*(.9+(fade-.5)*.25+(brush-.5)*.1)[...,None]
    edge=_smooth(0,.006,np.abs(((X+.15)%.3)-.15)-.0)
    m=(band*edge)[...,None]
    return np.clip(col*(1-m)+ochre*col*m*1.02,0,1),nm

# ------------------------------------------------------------------------------ gopuram
PAINT={'blue':'#3d6fc2','green':'#3f9a5c','red':'#d45a36','gold':'#e6b73c','flesh':'#e7a987','white':'#f1ede2','indigo':'#4b4aa0','teal':'#2f9c9a'}
GARMENT=['#c9302c','#e3a124','#2f8f4e','#7a3c94','#d8662a','#2b6cb0']

def _figure(R,win,X,Y,kind,rng,sc=1.0):
    """One painted stucco deity, dancer or guardian; (X,Y) metres from the pedestal centre, sc its
    scale (1 is a 1 m figure in a main niche, attendants and shrine figures are smaller)."""
    skin=_hex(PAINT[rng.choice(['blue','green','red','gold','flesh','white','indigo','teal'])])
    cloth=_hex(rng.choice(GARMENT));gold=_hex('#f0c24a');crown=_hex('#f4cf5a');halo=_hex('#e8b33a')
    X=X/sc;Y=Y/sc;px=.004/sc
    def P(d,c,l,b,s=.03):R.paint(win,d,c,l,b,s,px)
    def head(x,y,r,tall):
        P(sd_circle(X,Y,x,y,r),skin,.68,.4,r)
        for e in (-1,1):P(sd_circle(X,Y,x+e*r*.38,y+r*.1,r*.16),_hex('#1d1a2a'),.8,.05)
        P(sd_ellipse(X,Y,x,y-r*.5,r*.25,r*.1),_hex('#b02a2a'),.8,.05)
        P(sd_trap(X,Y,x,y+r*.55,y+r*.55+tall,r*.95,r*.3),crown,.85,.35,r)
        P(sd_box(X,Y,x,y+r*.6,r*1.05,r*.16),gold,.9,.15)
        for e in (-1,1):P(sd_circle(X,Y,x+e*r*1.02,y-r*.25,r*.22),gold,.85,.2)
    def jewel(x,y,w):
        P(np.maximum(sd_ring(X,Y,x,y+w*.4,w,w*.14),Y-(y+w*.4)),gold,.8,.15)
    if kind=='standing':
        P(sd_ring(X,Y,0,.80,.2,.02),halo,.25,.08)
        for a in np.linspace(.2,2.94,11):P(sd_circle(X,Y,.2*np.cos(a),.8+.2*np.sin(a),.022),_hex('#f08a2a'),.28,.1)
        P(sd_ellipse(X,Y,0,-.01,.22,.055),_hex('#e2627a'),.2,.25)
        P(np.minimum(sd_capsule(X,Y,-.055,.04,-.05,.40,.05),sd_capsule(X,Y,.055,.04,.05,.40,.05)),skin,.35,.4)
        for e in (-1,1):P(sd_ellipse(X,Y,e*.07,.02,.05,.02),skin,.4,.3)
        P(sd_trap(X,Y,0,.18,.49,.14,.1),cloth,.45,.4)
        P(sd_trap(X,Y,0,.18,.49,.03,.02),gold,.55,.1)
        for s in (-1,1):
            P(sd_limb(X,Y,[(s*.08,.64),(s*.17,.52),(s*.16,.41)],.032),skin,.5,.35)
            P(sd_circle(X,Y,s*.16,.39,.03),skin,.55,.3)
            P(sd_limb(X,Y,[(s*.08,.66),(s*.19,.68),(s*.21,.79)],.03),skin,.45,.35)
            P(sd_circle(X,Y,s*.21,.84,.042),gold,.6,.35)
            P(sd_box(X,Y,s*.2,.73,.035,.012),gold,.6,.1)
        P(sd_ellipse(X,Y,0,.57,.1,.12),skin,.55,.5)
        P(sd_ellipse(X,Y,0,.67,.14,.045),skin,.55,.4)
        P(sd_box(X,Y,0,.475,.11,.025),gold,.7,.2)
        jewel(0,.6,.06)
        head(0,.78,.065,.17)
    elif kind=='seated':
        P(np.minimum(sd_box(X,Y,0,.33,.22,.28),sd_circle(X,Y,0,.6,.22)),_hex('#c3463a'),.18,.05)
        P(sd_ring(X,Y,0,.58,.22,.02),halo,.3,.08)
        P(sd_ellipse(X,Y,0,.0,.28,.06),_hex('#e2627a'),.25,.3)
        for a in np.linspace(0,np.pi,9):P(sd_ellipse(X,Y,.25*np.cos(a),.02+.02*np.sin(a),.035,.045),_hex('#f3a0b0'),.3,.3)
        P(sd_ellipse(X,Y,0,.12,.23,.075),cloth,.4,.45)
        for e in (-1,1):P(sd_ellipse(X,Y,e*.16,.1,.05,.03),skin,.5,.3)
        for s in (-1,1):
            P(sd_limb(X,Y,[(s*.09,.4),(s*.18,.27),(s*.13,.17)],.033),skin,.5,.35)
            P(sd_limb(X,Y,[(s*.09,.42),(s*.2,.45),(s*.22,.58)],.03),skin,.45,.35)
            P(sd_circle(X,Y,s*.22,.63,.04),gold,.6,.35)
        P(sd_ellipse(X,Y,0,.32,.1,.13),skin,.55,.5)
        P(sd_ellipse(X,Y,0,.42,.14,.045),skin,.55,.4)
        jewel(0,.35,.06)
        head(0,.53,.068,.18)
    elif kind=='dancer':
        P(sd_ring(X,Y,.02,.52,.34,.016),halo,.25,.06)
        for a in np.linspace(0,np.pi,11):P(sd_circle(X,Y,.02+.34*np.cos(a),.52+.34*np.sin(a),.035),_hex('#f08a2a'),.28,.12)
        P(sd_capsule(X,Y,-.02,.05,.0,.42,.048),skin,.35,.4)
        P(sd_ellipse(X,Y,-.04,.03,.055,.02),skin,.4,.3)
        P(sd_limb(X,Y,[(.03,.40),(.18,.31),(.11,.18)],.045),skin,.35,.4)
        P(sd_trap(X,Y,.0,.33,.51,.15,.09),cloth,.45,.4)
        for s in (-1,1):
            P(sd_limb(X,Y,[(.02+s*.08,.63),(.02+s*.21,.68),(.02+s*.29,.62)],.03),skin,.5,.35)
            P(sd_circle(X,Y,.02+s*.3,.61,.03),gold,.6,.3)
            P(sd_limb(X,Y,[(.02+s*.08,.6),(.02+s*.16,.49),(.02+s*.2,.43)],.028),skin,.45,.35)
        P(sd_ellipse(X,Y,.02,.55,.095,.11),skin,.55,.5)
        jewel(.02,.58,.055)
        head(.04,.75,.063,.15)
    else:  # guardian (dvarapala) leaning on his mace
        P(np.minimum(sd_capsule(X,Y,-.09,.04,-.11,.36,.06),sd_capsule(X,Y,.09,.04,.11,.36,.06)),skin,.35,.4)
        P(sd_trap(X,Y,0,.2,.47,.19,.14),cloth,.45,.4)
        P(sd_capsule(X,Y,.22,.02,.2,.58,.04),_hex('#8b5a2b'),.5,.35)
        P(sd_ellipse(X,Y,.2,.6,.065,.075),gold,.55,.4)
        P(sd_ellipse(X,Y,0,.55,.14,.14),skin,.55,.5)
        P(sd_limb(X,Y,[(.11,.64),(.2,.56)],.038),skin,.6,.35)
        P(sd_limb(X,Y,[(-.11,.64),(-.22,.73),(-.21,.84)],.035),skin,.6,.35)
        P(sd_box(X,Y,0,.44,.14,.03),gold,.7,.2)
        jewel(0,.6,.07)
        head(0,.79,.075,.22)

def gopuram(n=1024):
    """Painted stucco of a gopuram storey, two variants stacked (top half and bottom half of the
    image) so alternate tiers differ. Each half is one storey 2.1 m tall and 4 m of wall across:
    base mouldings, four niches between pilasters, each with a deity, dancer or guardian under a
    cusped torana arch, the rolled kapota cornice, and a parapet of barrel-roofed sala shrines and
    domed kutas with gold finials. Colours are the enamel-bright paint of Malaysian temples."""
    H=n//2;W=n;rng=np.random.default_rng(61)
    col=np.zeros((n,n,3));hgt=np.zeros((n,n))
    grounds=[('#8fc6d8','#f1b8b0','#f3dc86'),('#a9d6a0','#f5dc8c','#c9b6e6')]
    kinds=[['standing','seated','guardian','dancer'],['dancer','standing','seated','guardian']]
    for band in (0,1):
        R=Relief(H,W,_hex(grounds[band][0]),.35)
        X,Y=_grid(H,W,4.0,2.1);full=(slice(None),slice(None))
        wall,niche,alt=[_hex(c) for c in grounds[band]]
        # base mouldings
        R.paint(full,sd_box(X,Y,2,.025,2.1,.025),_hex('#b43a2c'),.5,.1)
        R.paint(full,sd_box(X,Y,2,.08,2.1,.03),_hex('#f3e6bf'),.55,.25,.03)
        R.paint(full,sd_box(X,Y,2,.135,2.1,.022),_hex('#2c6fb0'),.45,.1)
        for k in range(5):   # pilasters at every metre (k=4 wraps onto k=0)
            x=float(k);R.paint(full,sd_box(X,Y,x,.8,.075,.64),_hex('#f4e8c6'),.55,.12,.03)
            R.paint(full,sd_box(X,Y,x,.8,.03,.62),_hex('#d65a3a'),.6,.05)
            R.paint(full,sd_box(X,Y,x,1.40,.1,.05),_hex('#e8b33a'),.65,.2)
            R.paint(full,sd_box(X,Y,x,.2,.1,.04),_hex('#e8b33a'),.62,.2)
        for k in range(4):
            cx=k+.5;c0,c1=int((cx-.5)/4*W),int((cx+.5)/4*W);win=(slice(None),slice(c0,c1))
            x,y=X[win],Y[win]
            # recessed niche with a cusped torana arch on colonnettes
            R.paint(win,np.maximum(sd_box(x,y,cx,.72,.34,.52),-sd_box(x,y,cx,.72,.36,.56)*0-1),niche*.92,.0,.0)
            arch=np.minimum(sd_box(x,y,cx,.62,.34,.42),sd_circle(x,y,cx,1.04,.34))
            R.paint(win,arch,niche,.02,.0)
            R.paint(win,np.maximum(sd_ring(x,y,cx,1.04,.36,.03),.96-y),_hex('#e9b43b'),.5,.2)
            for s in (-1,1):
                ax,ay=cx+s*.36,1.04;R.paint(win,sd_circle(x,y,ax,ay-.02,.05),_hex('#2e8a64'),.5,.3)   # makara ends
            R.paint(win,sd_circle(x,y,cx,1.43,.06),_hex('#d65a3a'),.55,.35)                     # kirtimukha boss
            for s_ in (-1,1):_figure(R,win,x-cx-s_*.25,y-.2,'standing',rng,.4)    # attendants behind
            _figure(R,win,x-cx,y-.22,kinds[band][k],rng,.86)
        # kapota cornice: a rolled drip moulding with little kudu arches
        roll=sd_box(X,Y,2,1.555,2.1,.1)
        R.paint(full,roll,_hex('#e9953a'),.55,.45,.1)
        R.paint(full,sd_box(X,Y,2,1.47,2.1,.014),_hex('#b03a2c'),.95,.05)
        for k in range(16):
            kx=k*.25+.125;R.paint(full,np.maximum(sd_ring(X,Y,kx,1.56,.07,.014),1.52-Y),_hex('#f7e7b5'),1.0,.12)
        # parapet (hara): sala shrines over the niches, kutas over the pilasters
        R.paint(full,sd_box(X,Y,2,1.68,2.1,.02),_hex('#3a78b5'),.6,.1)
        R.paint(full,sd_box(X,Y,2,1.88,2.1,.2),alt*.72,.15,.0)
        for k in range(4):
            cx=k+.5
            R.paint(full,sd_box(X,Y,cx,1.78,.24,.08),alt,.45,.2)
            R.paint(full,np.maximum(sd_ellipse(X,Y,cx,1.86,.25,.13),1.86-Y),_hex('#d6553a'),.55,.35,.06)
            _figure(R,full,X-cx,Y-1.715,'seated',rng,.2)
            for s in (-.14,0,.14):R.paint(full,sd_trap(X,Y,cx+s,1.98,2.07,.022,.004),_hex('#f0c24a'),.7,.3)
        for k in range(5):
            x=float(k);R.paint(full,sd_box(X,Y,x,1.76,.1,.07),_hex('#f4e8c6'),.45,.2)
            R.paint(full,np.maximum(sd_circle(X,Y,x,1.86,.1),1.83-Y),_hex('#3f9a5c'),.55,.4,.05)
            R.paint(full,sd_trap(X,Y,x,1.95,2.07,.03,.004),_hex('#f0c24a'),.7,.3)
        rows=slice(band*H,(band+1)*H);col[rows]=R.col;hgt[rows]=R.h
    occ=occlusion(hgt,7,2.4);fade=field(n,n,1.6,62);grain=blur(white(n,63),1)
    col=col*(1-occ[...,None]*.55)*(.9+(fade-.5)*.14+(grain-.5)*.06)[...,None]
    dirt=_smooth(.55,.9,field(n,n,1.2,64,stretch=(1,6)))
    col*=(1-dirt*.1)[...,None]
    return np.clip(col,0,1),normal_from_height(hgt+grain*.02,n/90)

def pillar(n=512):
    """One face of a painted mandapam pillar (0.5 m wide, 4.6 m tall, explicit UVs): a moulded
    base, painted panels of lotus medallions and creeper scrolls between beaded bands, a kalasa
    capital and a drooping lotus-bud bracket. 256 texels across and 1024 up."""
    h,w=n*2,n//2;X,Y=_grid(h,w,.5,4.6);full=(slice(None),slice(None))
    R=Relief(h,w,_hex('#f2e6c8'),.3)
    bands=[(.0,.55,'#9c8f80',.1),(.55,.72,'#c43b2e',.3),(2.05,2.3,'#2f8f7c',.3),(3.55,3.75,'#c43b2e',.3),(3.75,4.15,'#e7b63c',.45),(4.15,4.6,'#d65a3a',.35)]
    for y0,y1,c,l in bands:R.paint(full,sd_box(X,Y,.25,(y0+y1)/2,.3,(y1-y0)/2),_hex(c),l,.12,.05)
    for y in (.62,2.18,3.65):
        for k in range(6):R.paint(full,sd_circle(X,Y,.04+k*.084,y,.028),_hex('#f4d26a'),.5,.2)
    for y0,y1,bg in ((.72,2.05,'#f6efdc'),(2.3,3.55,'#3a70b8')):   # panels
        R.paint(full,sd_box(X,Y,.25,(y0+y1)/2,.2,(y1-y0)/2-.04),_hex(bg),.2,.02)
        cy=(y0+y1)/2
        for a in np.linspace(0,2*np.pi,8,endpoint=False):
            R.paint(full,sd_ellipse(X,Y,.25+.09*np.cos(a),cy+.09*np.sin(a),.05,.05),_hex('#e2627a' if bg=='#f6efdc' else '#f4d26a'),.35,.3)
        R.paint(full,sd_circle(X,Y,.25,cy,.05),_hex('#f0c24a'),.45,.35)
        vine=np.abs(X-.25-.08*np.sin((Y-y0)*9))-.012
        m=np.maximum(vine,np.maximum(y0+.05-Y,Y-(cy-.16)));R.paint(full,m,_hex('#2f8f4e'),.3,.1)
        m=np.maximum(np.abs(X-.25+.08*np.sin((Y-y0)*9))-.012,np.maximum(cy+.16-Y,Y-(y1-.05)));R.paint(full,m,_hex('#2f8f4e'),.3,.1)
        for k in range(5):
            yy=y0+.12+k*.16
            if abs(yy-cy)>.18:R.paint(full,sd_circle(X,Y,.25+.08*np.sin((yy-y0)*9)+.05,yy,.026),_hex('#e5813a'),.35,.3)
    R.paint(full,sd_ellipse(X,Y,.25,3.95,.22,.16),_hex('#f0c24a'),.55,.45,.08)          # kalasa capital
    R.paint(full,sd_ellipse(X,Y,.25,4.28,.14,.1),_hex('#e2627a'),.55,.35,.06)          # lotus bud
    for k in range(5):R.paint(full,sd_ellipse(X,Y,.05+k*.1,.5,.045,.06),_hex('#b7a998'),.2,.2)
    occ=occlusion(R.h,4,2.5);grain=blur(white(h,71)[:h,:w] if h==w else np.random.default_rng(71).random((h,w)),1)
    col=R.col*(1-occ[...,None]*.5)*(.93+(grain-.5)*.07)[...,None]
    return np.clip(col,0,1),normal_from_height(R.h,w/40)

def kolam(n=512):
    """Kolam at the temple entrance, 2.4 m across (RGBA, alpha-clipped): a white rice-flour line
    loop woven round a 9 x 9 dot grid, with a coloured-powder lotus at its heart in magenta,
    marigold orange, turmeric yellow and leaf green."""
    X,Y=_grid(n,n,2.4,2.4);x=X-1.2;y=Y-1.2;px=2.4/n
    a=np.zeros((n,n));col=np.zeros((n,n,3))+_hex('#f7f3ea')
    def lay(d,c,w=px):
        m=np.clip(.5-d/w,0,1);col[:]=col*(1-m[...,None])+_hex(c)*m[...,None];a[:]=np.maximum(a,m)
    s=.24   # dot pitch
    r=np.hypot(x,y);diamond=np.abs(x)+np.abs(y)
    inside=diamond<1.12
    # woven loops: circles round each dot plus diagonals between them
    gx=(x/s+.5)%1-.5;gy=(y/s+.5)%1-.5
    loop=np.abs(np.hypot(gx,gy)-.33)*s-.009
    diag=np.minimum(np.abs(((x+y)/s)%1-.5),np.abs(((x-y)/s)%1-.5))*s*.707-.008
    lines=np.where(inside,np.minimum(loop,np.maximum(diag,.18-r)),1)
    lay(np.maximum(lines,diamond-1.12),'#fbf8f0')
    lay(np.abs(diamond-1.16)-.012,'#fbf8f0')
    dots=np.hypot(gx,gy)*s-.02;lay(np.where(inside,dots,1),'#fbf8f0')
    # coloured centre
    th=np.arctan2(y,x)
    lay(r-.52,'#2f8f4e');lay(r-.42-.07*np.cos(th*8),'#f2b51c')
    lay(r-.33-.08*np.abs(np.cos(th*4)),'#e0306e')
    lay(r-.2-.05*np.cos(th*8),'#f07a1a');lay(r-.08,'#fbf8f0')
    for k in range(8):
        t=k*np.pi/4;lay(sd_circle(x,y,.62*np.cos(t),.62*np.sin(t),.05),'#e0306e');lay(sd_circle(x,y,.62*np.cos(t),.62*np.sin(t),.02),'#f2b51c')
    powder=blur(white(n,81),1)
    a=a*np.clip(.75+(powder-.5)*1.2+(fractal(n,1.8,82)-.5)*.4,0,1)
    return np.concatenate([np.clip(col*(.94+(powder-.5)*.1)[...,None],0,1),a[...,None]],-1)

def marigold(n=256):
    """Marigold garland strung tight, 0.3 m tile: frilly orange and yellow heads packed in rows."""
    X,Y=_grid(n,n,.3,.3);R=Relief(n,n,_hex('#6b3a12'),.0);full=(slice(None),slice(None))
    rng=np.random.default_rng(91)
    for i in range(6):
        for j in range(6):
            cx=(i+.5)*.05+(j%2)*.025;cy=(j+.5)*.05;c='#f28c1c' if (i+j)%3 else '#f6c02a'
            for ox in (-.3,0,.3):
                for oy in (-.3,0,.3):
                    th=np.arctan2(Y-cy-oy,X-cx-ox)
                    d=np.hypot(X-cx-ox,Y-cy-oy)-(.03+.004*np.cos(th*11+rng.random()*6))
                    R.paint(full,d,_hex(c)*(.85+.3*rng.random()),.2,.8,.03,.0012)
    frill=blur(white(n,92),1)
    col=R.col*(1-occlusion(R.h,3,2)[...,None]*.5)*(.85+.3*frill)[...,None]
    return np.clip(col,0,1),normal_from_height(R.h+frill*.15,n/30)

def studded(n=512,ground='teak'):
    """Temple door leaves on a 0.6 m tile: planks behind a grid of domed bosses on 15 cm centres
    and flat straps every 60 cm. ground='teak' (brass on oiled teak) or 'lacquer' (gilt on red)."""
    X,Y=_grid(n,n,.6,.6);full=(slice(None),slice(None))
    if ground=='teak':base,_=wood(n);base=base*np.array([.78,.6,.42]);metal=_hex('#c9a04a')
    else:base=lacquer(n)[0];metal=_hex('#e8bb4a')
    R=Relief(n,n,0,.0);R.col=base.copy()
    R.paint(full,sd_box(X,Y,.3,.02,.31,.022),metal*.9,.25,.05)
    for i in range(4):
        for j in range(4):
            cx,cy=i*.15+.075,j*.15+.075
            if j!=0 or True:R.paint(full,sd_circle(X,Y,cx,cy,.028),metal,.2,.8,.028)
    plank=1-_smooth(0,.004,np.abs(((X+.1)%.2)-.1))
    col=R.col*(1-plank[...,None]*.35)*(1-occlusion(R.h,4,2)[...,None]*.4)
    return np.clip(col,0,1),normal_from_height(R.h-plank*.08,n/40)

def temple_door():return studded(512,'teak')
def lacquer_door():return studded(512,'lacquer')

# ------------------------------------------------------------------------------ chinese temple
def lacquer(n=256):
    """Red lacquer on timber (0.8 m tile): deep vermilion over black, brush drag, fine crackle
    where the sun has aged it, and a little wear to dark at the arrises."""
    crack=np.clip(1-worley_edges(n,60,101)/1.2,0,1)**4*_smooth(.45,.8,fractal(n,1.5,102))
    drag=fractal(n,1.2,103,stretch=(1,18));mott=fractal(n,2.0,104)
    col=rgb((.63,.12,.09),.92+(drag-.5)*.12+(mott-.5)*.1-crack*.35)
    return np.clip(col,0,1),normal_from_height(drag*.2-crack*.5,n/60)

def roof_tiles(n=1024):
    """Glazed Chinese roof on a 1.2 m tile: eight rows of convex cover tiles (tongwa) over the
    concave pan channels, six 20 cm courses per tile each lapping the one below. u runs along the
    eave, v up the slope. Jade-green glaze, glossier on the crowns, a shadow under every lap, dirt
    run down the channels and a few replaced tiles in a fresher green."""
    X,Y=_grid(n,n,1.2,1.2);p=.15;ph=(X%p)/p;course=(Y%.2)/.2
    ix=np.floor(X/p);iy=np.floor(Y/.2)
    q=np.abs(ph-.5)/.3;cover=np.clip(1-q*q,0,1);pan=np.clip((np.abs(ph-.5)-.3)/.2,0,1)
    crown=np.sqrt(cover)
    hgt=np.where(cover>0,.5+.5*crown,-.3*(1-pan))+(1-course)*.22
    tone=_cellrand(ix,iy,111);fresh=_cellrand(ix,iy,112)>.95
    g=np.stack([.20+.05*tone,.43+.08*tone,.33+.05*tone],-1)
    g[fresh]=g[fresh]*np.array([.85,1.12,1.0])+.02
    col=np.where((cover>0)[...,None],g*(.7+.45*crown[...,None])+np.array([.1,.12,.1])*(crown**8)[...,None],g*(.42+.18*pan[...,None]))
    lap=_smooth(.0,.12,course);col*=(.55+.45*lap)[...,None]
    dirt=_smooth(.45,.9,field(n,n,1.1,113,stretch=(1,25)))*(1-crown)
    col=col*(1-dirt[...,None]*.3)+_hex('#3a3a2c')*dirt[...,None]*.12
    return np.clip(col,0,1),normal_from_height(hgt,n/70)

def eave_ends(n=256):
    """The eave's edge on a 0.6 m by 0.3 m strip: round glazed end caps (wadang) with a boss, and
    pointed drip tiles between them, over the shadow under the tiles."""
    h=n//2;X,Y=_grid(h,n,.6,.3);R=Relief(h,n,_hex('#1d2019'),0.);full=(slice(None),slice(None))
    for k in range(5):
        cx=k*.15;R.paint(full,sd_trap(X,Y,cx+.075,.02,.2,.012,.055),_hex('#2f6a47'),.4,.3)
        R.paint(full,sd_circle(X,Y,cx,.19,.07),_hex('#2c6644'),.5,.35,.05)
        R.paint(full,sd_ring(X,Y,cx,.19,.05,.006),_hex('#3f8a5c'),.9,.05)
        R.paint(full,sd_circle(X,Y,cx,.19,.02),_hex('#e2b545'),.95,.2)
    R.paint(full,sd_box(X,Y,.3,.285,.31,.016),_hex('#27573c'),.4,.2)
    col=R.col*(1-occlusion(R.h,3,2)[...,None]*.4)
    return np.clip(col,0,1),normal_from_height(R.h,n/40)

def carved_beam(n=1024):
    """Painted and gilded lintel on a 3.2 m by 0.8 m tile (explicit v across the beam): a long
    cartouche of gilt cloud scrolls on vermilion between banded ends of malachite green and
    azurite blue with gold outlines, over a red ground."""
    h=n//4;X,Y=_grid(h,n,3.2,.8);full=(slice(None),slice(None))
    R=Relief(h,n,_hex('#a61f19'),.2)
    for cx in (.0,3.2):   # banded ends (wrap)
        R.paint(full,sd_box(X,Y,cx,.4,.62,.33),_hex('#2f8a6a'),.3,.05)
        for k,c in enumerate(('#2b5fa8','#f2c14a','#2f8a6a','#2b5fa8')):
            R.paint(full,sd_box(X,Y,cx,.4,.5-k*.1,.28-k*.05),_hex(c),.32+k*.02,.05)
        R.paint(full,sd_circle(X,Y,cx,.4,.12),_hex('#f2c14a'),.5,.3)
        R.paint(full,sd_circle(X,Y,cx,.4,.06),_hex('#c8322a'),.55,.2)
    cart=np.maximum(np.abs(X-1.6)+np.abs(Y-.4)*2.2-1.05,np.abs(Y-.4)-.3)
    R.paint(full,cart,_hex('#8e1a15'),.18,.0)
    R.paint(full,np.abs(cart)-.012,_hex('#f2c14a'),.45,.1)
    rng=np.random.default_rng(121)
    for k in range(11):   # cloud scrolls: spirals of gilt relief
        cx=.75+k*.17;cy=.4+.1*np.sin(k*1.7)
        th=np.arctan2(Y-cy,X-cx);r=np.hypot(X-cx,Y-cy)
        spiral=np.abs(((r/.018-th/(2*np.pi))%1)-.5)*.018-.004
        d=np.maximum(spiral,r-.075-.01*rng.random());d=np.maximum(d,cart+.03)
        R.paint(full,d,_hex('#f0c04a'),.42,.12,.01,.003)
    R.paint(full,sd_box(X,Y,1.6,.03,1.7,.03),_hex('#f2c14a'),.5,.2)
    R.paint(full,sd_box(X,Y,1.6,.77,1.7,.03),_hex('#f2c14a'),.5,.2)
    grain=np.random.default_rng(122).random((h,n))
    col=R.col*(1-occlusion(R.h,3,2)[...,None]*.45)*(.94+(blur(grain,1)-.5)*.08)[...,None]
    return np.clip(col,0,1),normal_from_height(R.h,n/160)

def jiannian(n=256):
    """Jian nian: ridge dragons and phoenixes clad in cut porcelain shards, 0.3 m tile; jade,
    turquoise, yellow, orange, white and cobalt pieces in dark mortar, each shard tilted."""
    rng=np.random.default_rng(131);pts=rng.random((70,2))*n
    yy,xx=np.mgrid[0:n,0:n].astype(np.float32);f1=np.full((n,n),1e9);f2=f1.copy();idx=np.zeros((n,n),int)
    for i,(px,py) in enumerate(pts):
        dx=np.abs(xx-px);dx=np.minimum(dx,n-dx);dy=np.abs(yy-py);dy=np.minimum(dy,n-dy);d=np.hypot(dx,dy)
        f2=np.where(d<f1,f1,np.minimum(f2,d));idx=np.where(d<f1,i,idx);f1=np.minimum(f1,d)
    pal=np.array([_hex(c) for c in ('#2f9a6a','#35b4b0','#f2c33a','#e8742a','#f1efe6','#2b56a8','#3f8a3a','#d8402e')])
    col=pal[rng.integers(0,len(pal),70)][idx]*(.85+.3*rng.random(70)[idx])[...,None]
    grout=1-_smooth(1.0,2.6,f2-f1);col=col*(1-grout[...,None])+_hex('#3b3a33')*grout[...,None]
    bulge=np.sqrt(np.clip(f2-f1,0,12)/12)
    return np.clip(col,0,1),normal_from_height(bulge*.6-grout*.4,n/40)

def lattice(n=512):
    """Carved window lattice on a 0.6 m tile: a gilt 'wan' key-fret of interlocking bars over red
    frames, the dark hall behind showing through."""
    X,Y=_grid(n,n,.6,.6);R=Relief(n,n,_hex('#1b1411'),.0);full=(slice(None),slice(None))
    gx=(X/.1)%1;gy=(Y/.1)%1;ix=np.floor(X/.1);iy=np.floor(Y/.1)
    t=.14
    bar=np.minimum(np.abs(gx-.5),np.abs(gy-.5))
    alt=(_cellrand(ix,iy,141)>.5)
    hook=np.where(alt,np.maximum(np.abs(gx-.5)-.5,np.abs(gy-.15)-t/2),np.maximum(np.abs(gy-.5)-.5,np.abs(gx-.85)-t/2))
    d=np.minimum(bar-t/2,hook)*.1
    R.paint(full,d,_hex('#b8312a'),.5,.3,.006,.0012)
    R.paint(full,np.maximum(d,-(bar-t/4)*.1),_hex('#e0b146'),.6,.3,.006,.0012)
    R.paint(full,np.minimum(np.abs(X%.6-.3)-.29,np.abs(Y%.6-.3)-.29)*-1-.0,_hex('#9a241e'),.6,.2)
    return np.clip(R.col*(1-occlusion(R.h,3,1.5)[...,None]*.4),0,1),normal_from_height(R.h,n/30)

# ------------------------------------------------------------------------------ church
def slate(n=1024):
    """Welsh-style slates on a 1.5 m tile: five 30 cm slates across and six 25 cm courses, each
    course broken half a slate, blue-grey with a slate-to-slate tone, a few rust-brown or pale
    replacement slates, lichen and the dark gap and thick tail under every lap."""
    X,Y=_grid(n,n,1.5,1.5);row=np.floor(Y/.25);xs=X+(row%2)*.15
    ix=np.floor(xs/.3)%5;fu=(xs%.3)/.3;fv=(Y%.25)/.25
    tone=_cellrand(ix,row,151);odd=_cellrand(ix,row,152)
    base=np.stack([.33+.07*tone,.37+.07*tone,.42+.07*tone],-1)
    base[odd>.95]=base[odd>.95]*np.array([1.18,1.05,.9])
    base[(odd>.9)&(odd<=.95)]*=1.2
    grain=fractal(n,2.2,153);lichen=_smooth(.74,.93,fractal(n,2.0,154))*_smooth(.3,.0,fv)
    gap=1-_smooth(.0,.02,np.minimum(fu,1-fu))
    tail=1-_smooth(.0,.1,fv)
    col=base*(.9+(grain-.5)*.2)[...,None]*(1-gap*.55)[...,None]*(1-tail*.3)[...,None]
    col=col*(1-lichen[...,None]*.3)+_hex('#a7a27d')*lichen[...,None]*.3
    hgt=(1-fv)*.35+grain*.1-gap*.6
    return np.clip(col,0,1),normal_from_height(hgt,n/140)

def stained_glass(n=512):
    """A lancet light over explicit UVs (u across, v up the opening): leaded quarries of pale amber
    and green in diagonal lattice, a cobalt border with ruby squares, and roundels of ruby, gold
    and blue with a small gold cross in the upper one. Doubles as the night emission."""
    X,Y=_grid(n*2,n,1.0,2.0);x=X-.5
    col=np.zeros((n*2,n,3))
    q=((X*6+Y*6)%1,(X*6-Y*6)%1);qi=np.floor(X*6+Y*6)+7*np.floor(X*6-Y*6)
    pale=np.where((_cellrand(qi,0,161)>.5)[...,None],_hex('#e6c878'),_hex('#b9d39a'))
    col[:]=pale*(.8+.35*_cellrand(qi,1,162))[...,None]
    lead=np.minimum(np.minimum(q[0],1-q[0]),np.minimum(q[1],1-q[1]))<.05
    border=(np.abs(x)>.36)|(Y<.08)
    col[border]=_hex('#2446a8');sq=border&((np.floor(Y*10)%2)==0)&(np.abs(x)>.4);col[sq]=_hex('#b3202a')
    rings=[(1.55,'#b3202a'),(1.0,'#2a8a5a'),(.45,'#d8a132')]
    for cy,c in rings:
        r=np.hypot(x,Y-cy);col[r<.24]=_hex('#2446a8');col[r<.2]=_hex(c)
        petal=np.hypot(x,Y-cy)<.12+.05*np.cos(np.arctan2(Y-cy,x)*4);col[petal&(r<.2)]=_hex('#f1d27a')
    cross=(np.abs(x)<.02)&(np.abs(Y-1.55)<.13)|(np.abs(Y-1.6)<.02)&(np.abs(x)<.08)
    col[cross]=_hex('#fbe7a0')
    ringlead=np.zeros_like(X,bool)
    for cy,_ in rings:ringlead|=np.abs(np.hypot(x,Y-cy)-.2)<.012;ringlead|=np.abs(np.hypot(x,Y-cy)-.24)<.012
    alllead=(lead&~border&(np.min([np.hypot(x,Y-cy) for cy,_ in rings],0)>.24))|ringlead|(np.abs(np.abs(x)-.36)<.012)
    col[alllead]=_hex('#1a1a1c')
    streak=fractal(n,1.4,163)
    col=col*(.85+.25*np.kron(streak[:n,:n],np.ones((2,1))))[...,None] if False else col*(.88+.2*field(n*2,n,1.4,163))[...,None]
    hgt=(~alllead).astype(float)*.3+field(n*2,n,2.4,164)*.2
    return np.clip(col,0,1),normal_from_height(hgt,n/30)

def louvre(n=256):
    """Belfry louvres on a 0.6 m tile: seven painted timber blades per tile angled down, dark void
    between, paint worn to grey timber along the lower lip."""
    X,Y=_grid(n,n,.6,.6);ph=(Y/.6*7)%1
    blade=_smooth(.0,.08,ph)*_smooth(1.0,.72,ph)
    wear=_smooth(.6,.9,fractal(n,1.6,171))*(ph<.25)
    col=_hex('#e9e4d6')*(.55+.45*ph)[...,None]
    col=col*(1-wear[...,None]*.4)+_hex('#7c756a')*wear[...,None]*.4
    col*=(.15+.85*blade)[...,None]
    return np.clip(col,0,1),normal_from_height(ph*blade*.8,n/20)

def paving(n=512):
    """Laterite-red clay paviors for the church path, 1.2 m tile: 20 x 10 cm bricks in herringbone
    with sand joints, a scatter of darker overburnt ones and moss in the joints."""
    X,Y=_grid(n,n,1.2,1.2);a=(X+Y)/.1;b=(X-Y)/.1
    ia=np.floor(a);ib=np.floor(b/2+(ia%2)*.5)
    fu=a%1;fv=((b/2+(ia%2)*.5)%1)
    tone=_cellrand(ia,ib,181)
    col=np.stack([.55+.12*tone,.28+.06*tone,.2+.04*tone],-1)
    dark=_cellrand(ia,ib,182)>.88;col[dark]*=.7
    joint=np.minimum(np.minimum(fu,1-fu),np.minimum(fv,1-fv)*2)
    j=1-_smooth(.0,.08,joint);moss=_smooth(.5,.8,fractal(n,1.8,183))*j
    col=col*(1-j[...,None]*.5)+_hex('#9c9178')*j[...,None]*.5
    col=col*(1-moss[...,None]*.5)+_hex('#4c5a2e')*moss[...,None]*.5
    col*=(.92+.16*fractal(n,2.2,184))[...,None]
    return np.clip(col,0,1),half(normal_from_height(-j*.8+fractal(n,2.4,185)*.2,n/100))

def lawn(n=512):
    """Clipped cow grass for the church garden, 2 m tile (the ground's grass at half size)."""
    import ground_textures
    return ground_textures.grass(n)

# ------------------------------------------------------------------------------ night
def glow_card(n=256):
    """What an open door shows at night: a warm lamp-lit interior falling off to the edges.
    Used as colour and emission on the doorway cards of all three buildings."""
    X,Y=_grid(n,n,1,1)
    g=np.exp(-((X-.5)/.42)**2-((Y-.55)/.55)**2)
    col=np.stack([.16+.8*g,.1+.55*g,.05+.28*g],-1)
    col[Y<.12]*=.55
    return np.clip(col*(.92+.16*fractal(n,2.0,191))[...,None],0,1)

def lattice_glow(n=256):
    """Emission mask for the lattice: lamplight in the gaps of the fret, none on the bars."""
    c,_=lattice(n*2);dark=np.clip(1-c.max(-1)/.12,0,1);dark=(dark[0::2,0::2]+dark[1::2,0::2]+dark[0::2,1::2]+dark[1::2,1::2])/4
    return np.clip(dark[...,None]*np.array([1.0,.62,.3]),0,1)

def kolam_plaza(n=768):
    """The kolam laid on the plaza itself: Blender's WebP export drops alpha, so instead of an
    alpha-clipped decal the powder is composited over the plaza granite (same 2.4 m tile and tint)
    rolled to the quad's place (x -1.2..1.2, z 10.4..12.8 on a tile anchored at the site origin),
    and the quad draws opaque with no seam."""
    g,nm=granite_tiles(n)
    lin=lambda c:np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
    srgb=lambda c:np.where(c<=.0031308,c*12.92,1.055*np.clip(c,0,None)**(1/2.4)-.055)
    g=srgb(lin(g)*lin(_hex('#eeeae2')))
    shift=(round(n*(12.8/2.4%1)),n//2)
    g=np.roll(g,shift,(0,1));nm=np.roll(nm,shift,(0,1))
    k=kolam(n);a=k[...,3:]
    return np.clip(g*(1-a)+k[...,:3]*a,0,1),nm
