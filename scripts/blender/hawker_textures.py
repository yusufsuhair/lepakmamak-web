"""Procedural textures for the hawker gerai (build_stalls.py) and the busking pitch (build_busking.py).

Built on the spectral primitives in pbr_textures.py, so every tiled field wraps by construction.
Colour images hold sRGB, normals are OpenGL tangent space, row 0 is the top of the image. Most
sets are near white on purpose: the builders paint vertex colours, so one texture serves every
finish of its kind and each kind costs a single draw.

  steel    brushed stainless for counters, cabinets and the truss: grain along u, wipe marks,
           fine scratches and a grease bloom (0.6 m tile)
  paint    painted sheet and ply with chipped edges, rust pin-holes and hand grime (1 m tile)
  canvas   awning canvas: slub, dried rain tide marks and soot (1 m tile)
  plastic  moulded polypropylene: sink marks and scuffs (0.5 m tile)
  batter   fried food and kuih surfaces: craggy crumb with dark specks (0.25 m tile)
  pad      the worn slab under a stall: broom marks, grease blooms and two oil-tin
           rings (3 m tile)
  puddle   one wet patch with a drying rim (not tiled); the alpha is the wetness
  tolex    amp vinyl: pebbled grain, scuffed pale on the corners (0.25 m tile)
  tikar    woven mengkuang mat: 3 cm twill strands, sun-bleached in patches (0.6 m tile)
  wash     a soft pool of lamp light, greyscale, added at night
  beam     a stage-light cone unrolled: bright at the lamp, fading to nothing along v
  wood_small  pbr_textures.wood at 256 for small props
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, worley_edges, rgb, wood

def _smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)

def _lerp(a,b,t):return a+(np.asarray(b)-a)*t[...,None]

def _uv(n):
    v,u=np.mgrid[0:n,0:n]/n;return u,v

# ------------------------------------------------------------------------------ metals
def steel(n=512):
    """Brushed stainless, grain along u. Wiped arcs where a cloth goes round, a haze of grease,
    scratches across the grain from pots dragged over it."""
    u,v=_uv(n)
    grain=fractal(n,1.2,501,stretch=(70,1))*.7+fractal(n,1.8,502,stretch=(10,1))*.3
    wipe=np.abs(np.sin((u*3+fractal(n,2.2,503)*.8)*np.pi*2+v*6))
    haze=_smooth(.45,.9,fractal(n,1.9,504))
    scratch=np.clip((fractal(n,.9,505,stretch=(1,60))-.86)*9,0,1)+np.clip((fractal(n,.9,506,stretch=(50,4))-.9)*8,0,1)
    col=rgb((.86,.87,.87),.9+(grain-.5)*.2+wipe*.025-haze*.14+scratch*.08)
    col=_lerp(col,(.78,.74,.66),haze*.18)
    return np.clip(col,0,1),normal_from_height(grain*.5-scratch*.4,n/200)

def paint(n=512):
    """Enamel on sheet steel and plywood, near white. Chips down to dark primer along a noisy
    edge mask, rust pin-holes, and a greasy darkening where hands and pots rub."""
    mott=fractal(n,2.0,511);grain=blur(white(n,512),1)
    col=rgb((.93,.925,.91),.95+(mott-.5)*.08+(grain-.5)*.04)
    chips=_smooth(.8,.84,fractal(n,1.3,513)*.7+fractal(n,.6,514)*.3)
    col=_lerp(col,(.36,.34,.31),chips*.85)
    pins=np.clip((blur(white(n,515),2)-.7)*9,0,1)*_smooth(.65,.9,fractal(n,1.6,516))
    col=_lerp(col,(.42,.26,.16),pins*.35)
    rub=_smooth(.55,.95,fractal(n,.9,517));col*=(1-rub*.06)[...,None]
    height=blur(-chips*.8-pins*.4+mott*.1,1)
    return np.clip(col,0,1),normal_from_height(height,n/160)

# ------------------------------------------------------------------------------ fabric and plastic
def canvas(n=256):
    """Awning canvas, near white: slub along the threads, tide marks where rain dried and soot.
    The weave itself is below a texel at play distance, so it lives in the normal map only."""
    u,v=_uv(n);k=2*np.pi*64
    weave=np.sin(u*k)*np.sin(v*k)
    slub=fractal(n,1.5,521,stretch=(1,8))*.5+fractal(n,1.5,522,stretch=(8,1))*.5
    tide=np.clip(1-worley_edges(n,6,523)/2.5,0,1)**4*_smooth(.45,.7,fractal(n,1.7,524))
    soot=_smooth(.5,.95,fractal(n,1.6,525))
    col=rgb((.96,.95,.92),.94+(slub-.5)*.08-tide*.12-soot*.06)
    col=_lerp(col,(.80,.76,.66),soot*.3)
    return np.clip(col,0,1),normal_from_height(weave*.25+slub*.4,n/40)

def plastic(n=256):
    """Polypropylene stools, crates and basins, near white: faint flow lines, sink marks, scuffs."""
    flow=fractal(n,1.6,531,stretch=(1,5));sink=fractal(n,2.6,532)
    scuff=np.clip((fractal(n,.8,533,stretch=(20,1))-.82)*6,0,1)
    col=rgb((.95,.95,.95),.95+(flow-.5)*.06-scuff*.12+(sink-.5)*.04)
    return np.clip(col,0,1),normal_from_height(sink*.5+flow*.2-scuff*.3,n/90)

def batter(n=256):
    """Deep-fried batter: craggy crumbs, caramelised ridges, dark specks. Golden, so a vertex
    colour near white keeps it fried and a pale one turns it into steamed kuih."""
    crag=np.clip(1-worley_edges(n,70,541)/5.5,0,1)**1.5;lump=fractal(n,2.0,542);speck=white(n,543)
    col=rgb((.93,.72,.40),.82+crag*.28+(lump-.5)*.2)
    col[speck>.985]*=np.array([.45,.32,.2])
    return np.clip(col,0,1),normal_from_height(crag*.9+lump*.5,n/40)

# ------------------------------------------------------------------------------ ground
def pad(n=256):
    """The worn slab a gerai stands on, 3 m tile: broom-finished concrete gone grey-brown, blooms
    of fryer grease, two rings where oil tins stood, and dirt in the low spots."""
    u,v=_uv(n);mott=fractal(n,1.9,551);grain=blur(white(n,552),1)
    broom=fractal(n,1.1,553,stretch=(1,14));pores=np.clip((blur(white(n,554),1)-.7)*6,0,1)
    col=rgb((.60,.58,.54),.88+(mott-.5)*.26+(broom-.5)*.07+(grain-.5)*.05)
    grease=_smooth(.55,.92,fractal(n,2.3,555)*.75+fractal(n,1.2,556)*.25)
    col=_lerp(col,(.26,.24,.21),grease*.5)
    r=np.random.default_rng(557)
    for _ in range(2):   # oil tin rings: a darker circle with a crisp edge
        cx,cy,rad=r.random(),r.random(),r.uniform(.03,.045)
        dx=(u-cx+.5)%1-.5;dy=(v-cy+.5)%1-.5;d=np.hypot(dx,dy)
        col*=(1-(_smooth(rad+.004,rad,d)*.08+np.exp(-((d-rad)/.003)**2)*.12))[...,None]
    col*=(1-pores*.25)[...,None]
    height=blur(broom*.25+mott*.3-pores*.4,1)
    return np.clip(col,0,1),normal_from_height(height,n/120)

def wood_small():
    """pbr_textures.wood at 256: props are small, and the 512 set costs twice the bytes for no visible grain."""
    return wood(256)

def puddle(n=256):
    """RGBA, not tiled: dark wet colour, alpha the wetness. A ragged pool that feathers into a
    damp rim, with a few satellite drops."""
    u,v=_uv(n);d=np.hypot(u-.5,v-.5)*2
    edge=fractal(n,1.8,561)*.35+fractal(n,1.1,562)*.15
    wet=_smooth(.95,.55,d+edge-.25)
    drops=_smooth(.86,.9,fractal(n,2.8,563))*_smooth(1.05,.7,d)
    a=np.clip(np.maximum(wet,drops*.8),0,1)
    col=rgb((.20,.21,.22),.9+(fractal(n,2.0,564)-.5)*.2)
    return np.concatenate([np.clip(col,0,1),(a*.92)[...,None]],-1)

# ------------------------------------------------------------------------------ busking
def tolex(n=256):
    """Pebbled amp vinyl, near white (tinted dark): leathery cells and pale scuffs."""
    cells=np.clip(worley_edges(n,260,571)/3.2,0,1);mott=fractal(n,1.8,572)
    scuff=_smooth(.72,.95,fractal(n,1.4,573))
    col=rgb((.9,.9,.9),.8+cells*.2+(mott-.5)*.1+scuff*.35)
    return np.clip(col,0,1),normal_from_height(cells*.8,n/70)

def tikar(n=256):
    """Woven mengkuang: 2/2 twill of 3 cm strands, each strand its own straw tone, bleached
    patches where the sun sits. Near white: the builder paints the coloured bands."""
    u,v=_uv(n);k=20   # 3 cm strands across the 0.6 m tile
    iu=np.floor(u*k).astype(int);iv=np.floor(v*k).astype(int)
    over=((iu+iv)//2)%2==0
    fu=(u*k)%1;fv=(v*k)%1
    along=np.where(over,fu,fv);across=np.where(over,fv,fu)
    shade=np.sin(across*np.pi)**.5*(.85+.15*np.sin(along*np.pi))
    tone=np.random.default_rng(581).random((k,k))
    strand=np.where(over,tone[iu%k,(iv//2)%k],tone[(iu//2)%k,iv%k])
    fibre=fractal(n,1.2,582,stretch=(30,1))
    col=rgb((.96,.88,.70),.72+shade*.26+(strand-.5)*.14+(fibre-.5)*.06)
    col=_lerp(col,(1,.97,.9),_smooth(.6,.9,fractal(n,1.6,583))*.3)
    return np.clip(col,0,1),normal_from_height(shade*1.2,n/60)

def wash(n=128):
    """A pool of lamp light, greyscale; the runtime adds it over black."""
    u,v=_uv(n);d=np.hypot(u-.5,v-.5)*2
    c=np.exp(-d*d*2.6)*(1-_smooth(.75,1,d))
    return np.clip(np.stack([c]*3,-1)/c.max(),0,1)

def beam(n=64):
    """A light cone unrolled round its axis: v=0 at the lamp, v=1 at the floor, dust streaks in it."""
    u,v=_uv(n)
    along=(1-v)**1.6*_smooth(0,.08,v)
    dust=.8+.2*fractal(n,1.4,591,stretch=(1,6))
    c=np.clip(along*dust,0,1)
    return np.stack([c]*3,-1)
