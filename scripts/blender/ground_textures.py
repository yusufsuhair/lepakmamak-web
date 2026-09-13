"""Procedural, tileable ground textures for the city streets (roads, pavements, kerbs, verges)
and the seawall. Built on the spectral primitives in pbr_textures.py, so every field wraps.

Each generator returns (colour, normal): colour is sRGB 0..1 HxWx3 with row 0 at the top,
normal is an OpenGL tangent normal in 0..1 RGB. The runtime shader in src/ground.ts samples
them in world space at the tile sizes given in each docstring, so a texel is a real size.
"""
import numpy as np
from pbr_textures import fractal,white,blur,normal_from_height,worley_edges,rgb,_freq,_norm

def oriented(n,beta,seed,angle,ratio):
    """1/f^beta noise whose features run along `angle` (radians in image space), `ratio` long."""
    r=np.random.default_rng(seed);fx,fy,_=_freq(n)
    fu=fx*np.cos(angle)+fy*np.sin(angle);fv=-fx*np.sin(angle)+fy*np.cos(angle)
    f=np.sqrt((fu*ratio)**2+fv**2);f[0,0]=1;amp=f**(-beta);amp[0,0]=0
    return _norm(np.real(np.fft.ifft2(amp*np.exp(2j*np.pi*r.random((n,n))))))

def contour(field,level,px):
    """Meandering lines `px` pixels wide where a smooth field crosses `level`: cracks, sealant
    runs. Dividing by the wrapped gradient keeps the width even where the field is flat."""
    gx=(np.roll(field,-1,1)-np.roll(field,1,1))*.5;gy=(np.roll(field,-1,0)-np.roll(field,1,0))*.5
    return np.clip(1-np.abs(field-level)/np.maximum(np.sqrt(gx*gx+gy*gy),1e-6)/px,0,1)

def highpass(a,k):
    """Drop structure larger than tile/k (keeping the mean), so a tile has nothing big enough to
    read as a repeat from the air."""
    F=np.fft.fft2(a);_,_,f=_freq(a.shape[0]);F[(f*a.shape[0]<k)&(f>0)]=0
    return _norm(np.real(np.fft.ifft2(F)))

def half(a):
    """2x2 box downsample (normal maps ship at half the colour resolution)."""
    return (a[0::2,0::2]+a[1::2,0::2]+a[0::2,1::2]+a[1::2,1::2])/4

def lerp(a,b,t):return a+(b-a)*t[...,None]

# ------------------------------------------------------------------------------ asphalt
def asphalt(n=1024):
    """Worn Malaysian premix asphalt on a 7 m tile. Binder oxidised to mid grey with exposed
    granite chips and voids, ravelled mottling, a network of hairline cracks in patches, and
    the black bitumen crack-sealant squiggles JKR crews leave behind."""
    chips=blur(white(n,101),1);grain=white(n,102)
    mott=fractal(n,1.7,103)*.55+fractal(n,2.5,104)*.45
    ravel=np.clip((fractal(n,2.1,105)-.52)*3,0,1)                  # binder worn off, chips stand out
    stone=np.clip((chips-.66+ravel*.06)*9,0,1);void=np.clip((.33-chips)*9,0,1)
    base=np.array([.385,.385,.38])
    col=rgb(base,.86+(mott-.5)*.26+(grain-.5)*.07)
    col=lerp(col,np.array([.60,.595,.58])*(.84+.3*grain)[...,None],stone*(.5+.4*ravel))
    col*=(1-void*.42)[...,None]
    # hairline cracks: block cracking in patches plus long wandering lines
    cells=worley_edges(n,90,106);block=np.clip(1-cells/1.1,0,1)**2*np.clip((fractal(n,2.2,107)-.62)*6,0,1)
    long=contour(fractal(n,2.0,108,stretch=(1,3)),.5,1.1)*np.clip((fractal(n,1.8,109)-.42)*4,0,1)
    crack=np.clip(block+long,0,1)
    col*=(1-crack*.6)[...,None]
    # sealant: 2-3 cm glossy black runs poured along the worst cracks
    seal=contour(fractal(n,2.1,110,stretch=(3,1)),.5,2.6)*np.clip((fractal(n,2.0,111)-.6)*6,0,1)
    col=lerp(col,np.array([.075,.075,.075]),np.clip(seal*1.4,0,1)*.9)
    height=chips*.35+stone*.4-void*.5-crack*.9+seal*.25+mott*.2
    return np.clip(col,0,1),half(normal_from_height(height,n/170))

# ------------------------------------------------------------------------------ pavers
def pavers(n=1024,units=40):
    """Interlocking 200 x 100 mm concrete pavers in a 90 degree herringbone on a 4 m tile: sun-
    faded grey with the odd replaced or tinted block, sand-and-grime joints, black mould blotches
    of a humid pavement, chipped arrises and a few sunken blocks."""
    k=np.arange(n)+.5;px=(k/n*units)[None,:].repeat(n,0);py=(k/n*units)[:,None].repeat(n,1)
    cx=np.floor(px).astype(int);cy=np.floor(py).astype(int);fx=px-cx;fy=py-cy
    s=(cx+cy)%4;horiz=s<2
    ox=np.where(horiz,cx-s,cx);oy=np.where(horiz,cy,cy-(s-2))
    lx=np.where(horiz,fx+s,fx);ly=np.where(horiz,fy,fy+(s-2))
    w=np.where(horiz,2.,1.);h=np.where(horiz,1.,2.)
    edge=np.minimum.reduce([lx,w-lx,ly,h-ly])                       # distance to the block edge (units)
    rng=np.random.default_rng(121);tone=rng.random((units,units));kind=rng.random((units,units));sink=rng.random((units,units))
    bi=(ox%units,oy%units);t=tone[bi[1],bi[0]];kd=kind[bi[1],bi[0]];sk=sink[bi[1],bi[0]]
    mott=fractal(n,1.9,122);grain=white(n,123)
    col=rgb((.62,.605,.575),.86+(t-.5)*.17+(mott-.5)*.12+(grain-.5)*.06)
    col=np.where((kd<.035)[...,None],col*np.array([.76,.75,.73]),col)          # darker replacements
    col=np.where(((kd>.035)&(kd<.05))[...,None],col*np.array([1.02,.92,.85]),col)# faded tinted block
    bevel=np.clip(edge/.09,0,1)**.7
    joint=np.clip(1-edge/.045,0,1)
    mould=np.clip((fractal(n,2.3,124)-.6)*3.2,0,1)*(.55+.45*fractal(n,1.2,125))
    col*=(1-mould*.3)[...,None]
    grime=np.clip((fractal(n,2.6,126)-.4)*1.6,0,1)
    col=lerp(col,np.array([.30,.29,.26]),np.clip(joint*(.75+.25*grime)+(1-bevel)*.25,0,1))
    chip=np.clip((white(n,127)-.985)*60,0,1)*(1-bevel)
    col=lerp(col,np.array([.70,.69,.66]),chip)
    height=bevel*.9-joint*.4-(sk>.93)*.25+(grain-.5)*.08+mott*.1
    return np.clip(col,0,1),half(normal_from_height(height,n/150))

# ------------------------------------------------------------------------------ concrete
def concrete(n=512):
    """Cast concrete for kerb stones, drain edges and the seawall on a 2 m tile: grey, broom-
    textured, pitted with air pores, dirt settled in the low spots, rain streaks and mould."""
    mott=fractal(n,1.9,131);broom=oriented(n,1.1,132,0,10);grain=white(n,133)
    pores=np.clip((blur(white(n,134),1)-.72)*8,0,1)
    streak=oriented(n,1.2,135,np.pi/2,30)
    col=rgb((.70,.695,.67),.88+(mott-.5)*.2+(broom-.5)*.06+(grain-.5)*.05)
    col*=(1-np.clip((streak-.6)*4,0,1)*.12)[...,None]
    col*=(1-np.clip((fractal(n,1.2,136)-.6)*3,0,1)*.1)[...,None]
    col*=(1-pores*.45)[...,None]
    height=broom*.25+mott*.3-pores*.6+(grain-.5)*.1
    return np.clip(col,0,1),normal_from_height(height,n/110)

# ------------------------------------------------------------------------------ grass
def grass(n=1024):
    """Cow grass verge (Axonopus, the broad-bladed carpet grass of every Malaysian roadside) on a
    4 m tile: short blades matted into clumps with scorched single blades. Anything larger than
    a clump (dry blotches, trodden laterite) is laid out by the shader in world space, so the
    tile never shows a repeat."""
    blades=np.zeros((n,n))
    for i in range(6):blades=np.maximum(blades,oriented(n,1.0,141+i,i*np.pi/6+.2,2.6))
    blades=highpass(blades,6);clump=highpass(fractal(n,1.1,149),6)
    v=np.clip((blades-.45)*2.2+(clump-.5)*1.2+.45,0,1)
    green=lerp(np.stack([np.full((n,n),.15),np.full((n,n),.22),np.full((n,n),.08)],-1),np.array([.42,.54,.24]),v)
    straw=lerp(np.stack([np.full((n,n),.33),np.full((n,n),.30),np.full((n,n),.16)],-1),np.array([.72,.65,.40]),v)
    dry=np.clip((fractal(n,.9,150)-.62)*4,0,1)                     # single scorched blades, no big blotches:
    col=lerp(green,straw,dry*.7)                                    # the shader lays those out across the city
    height=v*.9+clump*.3
    return np.clip(col,0,1),half(normal_from_height(height,n/200))

def hedge(n=512,leaves=2600):
    """Clipped kemuning / ficus boundary hedge on a 1.5 m tile: thousands of small glossy leaves
    stacked at random depths, sunlit outer leaves over dark interior gaps, the odd yellowed or
    new pale leaf. Leaves are stamped in wrapped windows, so the tile repeats seamlessly."""
    r=np.random.default_rng(171);depth=np.full((n,n),-1.0);shade=np.zeros((n,n));tint=np.zeros((n,n))
    for _ in range(leaves):
        cx,cy=r.random(2)*n;L=r.uniform(9,16);W=L*r.uniform(.45,.6);a=r.random()*np.pi;z=r.random()
        R=int(L)+2;xs=(np.arange(int(cx)-R,int(cx)+R+1))%n;ys=(np.arange(int(cy)-R,int(cy)+R+1))%n
        dx=(np.arange(int(cx)-R,int(cx)+R+1)-cx)[None,:];dy=(np.arange(int(cy)-R,int(cy)+R+1)-cy)[:,None]
        u=(dx*np.cos(a)+dy*np.sin(a))/L;v=(-dx*np.sin(a)+dy*np.cos(a))/W
        d=u*u+v*v;inside=d<1
        win=np.ix_(ys,xs);old=depth[win];take=inside&(z>old)
        depth[win]=np.where(take,z,old)
        shade[win]=np.where(take,(1-d)**.5*.6+.4-np.abs(v)*.15,shade[win])
        tint[win]=np.where(take,r.random(),tint[win])
    gap=depth<0;z=np.clip(depth,0,1)
    base=np.array([.20,.33,.12])*(.45+.75*z)[...,None]*(.75+.35*shade)[...,None]
    base=np.where((tint>.94)[...,None],base*np.array([1.5,1.3,.7]),base)        # yellowing leaves
    base=np.where((tint<.05)[...,None],base*np.array([1.35,1.35,1.1]),base)     # new growth
    col=np.where(gap[...,None],np.array([.03,.05,.02]),base)
    height=np.where(gap,-.3,z*.8+shade*.35)
    return np.clip(col,0,1),normal_from_height(blur(height,1),n/90)

def macro(n=512):
    """Three independent low-frequency fields (non-colour) the shader reads at tens of metres
    per tile to break repetition: R tone, G stains, B dry/wear patches."""
    return np.stack([fractal(n,2.2,161),fractal(n,1.5,162),fractal(n,2.6,163)],-1)
