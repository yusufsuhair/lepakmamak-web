"""Procedural, tileable PBR textures for Pantai Senja, generated with numpy inside Blender.

Every field is synthesised in Fourier space (random phase, shaped amplitude), so it wraps
seamlessly by construction; normal maps are finite differences with np.roll, which wrap too.
Nothing is photographed or downloaded, and fixed seeds make a rebuild reproduce the same set.

Colour images hold sRGB values (Blender byte images take pixels in their own colour space);
normal maps are tangent-space OpenGL (+Y up), which is what glTF expects.
"""
import numpy as np

def _freq(n):
    fx=np.fft.fftfreq(n)[None,:];fy=np.fft.fftfreq(n)[:,None]
    return fx,fy,np.sqrt(fx*fx+fy*fy)

def _norm(a):
    a=a-a.min();return a/max(a.max(),1e-9)

def fractal(n,beta,seed,stretch=(1,1)):
    """1/f^beta noise in 0..1. stretch=(su,sv) squeezes the spectrum so features run along u."""
    r=np.random.default_rng(seed);fx,fy,_=_freq(n)
    f=np.sqrt((fx*stretch[0])**2+(fy*stretch[1])**2);f[0,0]=1
    amp=f**(-beta);amp[0,0]=0
    return _norm(np.real(np.fft.ifft2(amp*np.exp(2j*np.pi*r.random((n,n))))))

def band(n,wavelength,seed,angle,spread=.35,width=.25):
    """Band-limited directional noise: sinuous, bifurcating crests of a given wavelength (px)
    running perpendicular to `angle` — the spectrum of wind ripples in sand."""
    r=np.random.default_rng(seed);fx,fy,f=_freq(n);f0=1/wavelength
    theta=np.arctan2(fy,fx);d=np.angle(np.exp(1j*(theta-angle)));d=np.minimum(abs(d),np.pi-abs(d))
    amp=np.exp(-((f-f0)/(f0*width))**2)*np.exp(-(d/spread)**2);amp[0,0]=0
    return np.real(np.fft.ifft2(amp*np.exp(2j*np.pi*r.random((n,n)))))

def white(n,seed):return np.random.default_rng(seed).random((n,n))

def blur(a,passes=1):
    for _ in range(passes):a=(a*4+np.roll(a,1,0)+np.roll(a,-1,0)+np.roll(a,1,1)+np.roll(a,-1,1))/8
    return a

def normal_from_height(h,strength):
    """Wrapped central differences -> OpenGL tangent normal in 0..1 RGB (row 0 = top, v up)."""
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*strength;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*strength
    l=np.sqrt(dx*dx+dy*dy+1)
    return np.stack([(-dx/l)*.5+.5,(dy/l)*.5+.5,(1/l)*.5+.5],-1)

def worley_edges(n,points,seed):
    """Periodic Voronoi F2-F1: small values on the walls between cells (bubbles, cracks)."""
    r=np.random.default_rng(seed);p=r.random((points,2))*n
    yy,xx=np.mgrid[0:n,0:n].astype(np.float32);f1=np.full((n,n),1e9,np.float32);f2=f1.copy()
    for px,py in p:
        dx=np.abs(xx-px);dx=np.minimum(dx,n-dx);dy=np.abs(yy-py);dy=np.minimum(dy,n-dy)
        d=np.sqrt(dx*dx+dy*dy);f2=np.where(d<f1,f1,np.minimum(f2,d));f1=np.minimum(f1,d)
    return f2-f1

def footprints(n,seed,count=26):
    """Soft, wrapped heel-and-toe dimples in pairs, walking in random directions: the churn of
    a public beach. Returned as depth 0..1."""
    r=np.random.default_rng(seed);yy,xx=np.mgrid[0:n,0:n].astype(np.float32);d=np.zeros((n,n),np.float32)
    foot=n/4*.27                                       # a 27 cm foot on the 4 m tile
    for _ in range(count):
        cx,cy=r.random(2)*n;a=r.random()*2*np.pi;ca,sa=np.cos(a),np.sin(a)
        for side,step in ((-1,0),(1,.5)):
            px=cx+ca*step*foot*2.2-sa*side*foot*.25;py=cy+sa*step*foot*2.2+ca*side*foot*.25
            dx=xx-px;dx-=n*np.round(dx/n);dy=yy-py;dy-=n*np.round(dy/n)
            u=(dx*ca+dy*sa)/(foot*.5);w=(-dx*sa+dy*ca)/(foot*.2)
            d=np.maximum(d,np.exp(-(u*u+w*w)**1.5)*(.6+.4*r.random()))
    return blur(d,2)

def rgb(base,variation):
    """sRGB base triple times a variation field around 1 -> HxWx3."""
    return np.stack([variation*c for c in base],-1)

# ------------------------------------------------------------------------------ materials
def sand(n=768):
    """Dry Malaysian beach sand on a 4 m tile. Colour: cream quartz with dark heavy-mineral and
    white shell grit, patchy mottling. Height: ~11 cm wind ripples that survive in patches,
    churned hollows where people walk, and grain."""
    mott=fractal(n,1.6,11)*.6+fractal(n,2.4,12)*.4
    grain=white(n,13);grit=white(n,14)
    col=rgb((.95,.885,.76),.9+(mott-.5)*.2+(blur(grain,1)-.5)*.22)
    col[grit>.978]*=np.array([.62,.6,.57])
    shell=grit<.03;col[shell]=col[shell]*1.12+.04
    col[(grit>.03)&(grit<.036)]=[.93,.78,.74]
    ripple=band(n,n/36,15,angle=.35)                # 36 crests across the 4 m tile
    ripple=np.sign(ripple)*np.abs(ripple/np.abs(ripple).max())**.7
    mask=np.clip((fractal(n,2.6,16)-.38)*3.2,0,1)
    height=ripple*mask*.38+fractal(n,2.2,17)*.35+blur(grain,1)*.18-footprints(n,18)*.5
    col*=(.93+.07*_norm(ripple*mask))[...,None]
    return np.clip(col,0,1),normal_from_height(height,n/256*1.1)

def wood(n=512):
    """Weathered timber, grain along u. Light and desaturated: each material tints it by factor."""
    fibre=fractal(n,1.9,21,stretch=(9,1))*.6+fractal(n,1.2,24,stretch=(30,1))*.4
    rings=np.sin(np.mgrid[0:n,0:n][0]/n*2*np.pi*23+fibre*14)
    cracks=np.clip((fractal(n,1.2,22,stretch=(40,1))-.83)*9,0,1)
    col=rgb((.86,.80,.72),.82+(fibre-.5)*.22+rings*.035-cracks*.35+(white(n,23)-.5)*.04)
    return np.clip(col,0,1),normal_from_height(fibre*.6+rings*.08-cracks*.9,n/64)

def bark(n=512):
    """Coconut trunk: leaf-scar rings across u (the trunk's length) and coarse fibre."""
    u=np.mgrid[0:n,0:n][1]/n
    fibre=fractal(n,1.7,31,stretch=(1,7))
    rings=np.abs(np.sin((u+fractal(n,2.4,32)*.06)*np.pi*14))**6
    col=rgb((.60,.52,.43),.78+(fibre-.5)*.35-rings*.14+(white(n,33)-.5)*.06)
    return np.clip(col,0,1),normal_from_height(fibre*.6-rings*.4,n/48)

def thatch(n=384):
    """Attap (nipah frond) panels: fibrous blades along u, overlapping courses along v."""
    blades=fractal(n,1.4,41,stretch=(14,1))*.5+fractal(n,.9,43,stretch=(25,1))*.5
    ragged=fractal(n,1.3,44,stretch=(1,4))*.12   # frond tips hang unevenly over the course below
    lap=np.clip(((np.mgrid[0:n,0:n][0]/n*6+ragged)%1.0)*1.6,0,1)**.6
    col=rgb((.74,.62,.40),.55+(blades-.5)*.55+lap*.35+(white(n,42)-.5)*.05)
    return np.clip(col,0,1),normal_from_height(blades*.7+lap*.9,n/40)

def fabric(n=256):
    """Plain-weave canvas: warp/weft checker with slub. Near white; tinted by factor."""
    yy,xx=np.mgrid[0:n,0:n]/n;k=2*np.pi*48
    weave=np.sin(xx*k)*np.sin(yy*k)
    slub=fractal(n,1.5,51,stretch=(1,6))*.5+fractal(n,1.5,52,stretch=(6,1))*.5
    col=rgb((.97,.96,.94),.92+weave*.03+(slub-.5)*.1)
    return np.clip(col,0,1),normal_from_height(weave*.5+slub*.3,n/40)

def granite(n=384):
    """Weathered granite: salt-and-pepper grains, mottles, tide staining and cracks."""
    mott=fractal(n,2.0,61);g=white(n,62)
    col=rgb((.80,.77,.72),.78+(mott-.5)*.3)
    col[g>.93]*=np.array([.35,.34,.33]);col[g<.05]*=1.25
    col[(g>.5)&(g<.53)]*=np.array([1.08,.96,.9])
    col*=(1-np.clip((fractal(n,2.3,63)-.62)*3,0,1)*.35)[...,None]
    cracks=np.clip(1-worley_edges(n,7,64)/2.0,0,1)**3*np.clip((fractal(n,1.8,66)-.4)*3,0,1)
    col*=(1-cracks*.3)[...,None]
    return np.clip(col,0,1),normal_from_height(fractal(n,2.2,65)*.8-cracks*.5+blur(g,1)*.12,n/60)

def water_normal(n=512):
    """Capillary chop for the runtime sea: two crossing band spectra over a broad swell."""
    h=band(n,n/7,71,.2,spread=.9,width=.6)+band(n,n/13,72,1.4,spread=.8,width=.5)*.6
    h=h/np.abs(h).max()+(fractal(n,2.6,73)-.5)*.02
    return normal_from_height(h,n/90)

def foam(n=512):
    """White water, tiling along u only. v runs across a foam strip from its leading edge
    (v=0: the solid breaking lip, pitted with holes) back through dense lace that thins out into
    scattered bubble rafts (v=1). Greyscale 0..1, used as an alpha map."""
    walls=np.clip(1-worley_edges(n,160,81)/4.0,0,1)**1.4
    coarse=np.clip(1-worley_edges(n,28,82)/9,0,1)**2
    patches=fractal(n,1.8,83)
    v=(1-np.arange(n)/n)[:,None]                       # image row 0 is v=1 once flipped on load
    lip=np.clip(1.25-v/.13,0,1)*(.8+.2*patches)
    lace=np.clip((walls*.9+coarse*.6)*(1.15-v)*np.clip((patches-.25+(.6-v))*2.2,0,1),0,1)
    ragged=np.clip((patches-.5)*.3,-.1,.1)            # the lip's back edge is torn, not ruled
    lip*=np.clip((.2+ragged-v)/.08,0,1)
    return np.clip(np.maximum(lip,lace),0,1)
