"""Procedural, tileable textures for Masjid Kampung Maju (scripts/blender/build_masjid.py).

Built on the spectral primitives in pbr_textures.py, so every field wraps by construction.
Colour images hold sRGB; normals are OpenGL tangent space. Generators return (colour, normal)
for pbr_kit.texset; the few that are not tiled surfaces (wash, glow) return one array.

Polished stone and glaze get nearly flat normals on purpose: their relief is only joints and
tile tilt, and a flat map costs almost nothing once it is WebP.
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, worley_edges, rgb

def _uv(n):
    v,u=np.mgrid[0:n,0:n]/n
    return u,v

def _smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)

def _cells(n,count,seed):
    """Per-cell random values on a count x count grid, plus the fractional position in the cell."""
    u,v=_uv(n);r=np.random.default_rng(seed).random((count,count,4))
    iu=(u*count).astype(int)%count;iv=(v*count).astype(int)%count
    return r[iv,iu],(u*count)%1,(v*count)%1

def _star_sdf(px,py,a):
    """Eight-point star (two squares, tips at a*sqrt2): negative inside."""
    d1=np.maximum(abs(px),abs(py))-a
    d2=np.maximum(abs(px+py),abs(px-py))/np.sqrt(2)-a
    return np.minimum(d1,d2)

def _wrap(x):return (x+.5)%1-.5

def star_and_cross(n,periods=1):
    """The classic star-and-cross tiling: 8-point stars on the lattice whose axis tips touch, and
    the cross-shaped gaps between them. Returns (star sdf, cross-centre distance) in period units."""
    u,v=_uv(n);u=u*periods;v=v*periods
    sx,sy=_wrap(u),_wrap(v)                      # stars at integer lattice points
    star=_star_sdf(sx,sy,.354)
    cx,cy=_wrap(u+.5),_wrap(v+.5)                # crosses centred between them
    return star,np.maximum(abs(cx),abs(cy)),np.minimum(abs(cx),abs(cy))

# ------------------------------------------------------------------------------ walls and stone
def render(n=512):
    """White-painted cement render on a 2.5 m tile: trowel mottling, faint vertical rain streaks
    that come and go in patches, pitting, hairline cracks. Height is a fine roughcast."""
    mott=fractal(n,2.1,101)*.6+fractal(n,1.4,102)*.4
    streak=fractal(n,1.1,103,stretch=(1,16));patch=_smooth(.45,.8,fractal(n,2.4,104))
    grain=blur(white(n,105),2);pits=white(n,106)>.997
    col=rgb((.955,.95,.935),.985+(mott-.5)*.045-_smooth(.6,.92,streak)*patch*.06+(grain-.5)*.025)
    col[pits]*=.88
    cracks=np.clip(1-worley_edges(n,9,107)/1.2,0,1)**5*_smooth(.7,.85,fractal(n,1.6,108))
    col*=(1-cracks*.1)[...,None]
    height=blur(grain,1)*.35+fractal(n,2.0,109)*.5-cracks*.4-pits*.5
    return np.clip(col,0,1),normal_from_height(height,n/300)

def _veins(n,seed,k=3,sharp=.018):
    u,v=_uv(n);turb=fractal(n,1.9,seed)*5.5+fractal(n,1.2,seed+1)*1.6
    return np.exp(-np.sin(2*np.pi*(u*1+v*k)+turb)**2/sharp)

def marble(n=512):
    """Honed white marble on a 1.6 m tile: cloudy grey drifts and fine veins. Nearly flat normal."""
    clouds=fractal(n,2.3,121);veins=_veins(n,122)*.8+_veins(n,124,2,.006)*.5
    col=rgb((.945,.94,.925),.97+(clouds-.5)*.08-veins*.16)
    col-=(veins*.02)[...,None]*np.array([0,.2,.5])            # veins read cool grey
    return np.clip(col,0,1),normal_from_height(-veins*.15+clouds*.1,n/260)

def marble_tiles(n=512):
    """The serambi floor: 60 cm polished marble slabs (two across a 1.2 m tile), each cut from a
    different part of the block, 2 mm joints."""
    col,_=marble(n);cell,fu,fv=_cells(n,2,131)
    col=np.roll(col,(n//5,n//3),(0,1))*.5+col*.5
    col*=(.965+cell[...,0]*.05)[...,None]
    joint=np.minimum(np.minimum(fu,1-fu),np.minimum(fv,1-fv))*n/2
    j=np.clip(1-joint/1.3,0,1)
    col*=(1-j*.35)[...,None]
    return np.clip(col,0,1),normal_from_height(-j*.8,n/180)

def granite_tiles(n=768):
    """Polished granite pavers, 60 cm (four across a 2.4 m tile): salt-and-pepper grain, tone
    varying slab to slab, 3 mm joints with a little dirt in them. Tinted per use."""
    cell,fu,fv=_cells(n,4,141);g=blur(white(n,142),1);g2=white(n,143)
    col=rgb((.80,.785,.755),.96+(fractal(n,2.2,144)-.5)*.08+(cell[...,0]-.5)*.07)
    col[g2>.965]*=np.array([.42,.41,.40]);col[g2<.03]*=np.array([1.08,1.06,1.04])
    col[(g2>.40)&(g2<.43)]*=np.array([1.05,.97,.93])
    col*=(1+(g-.5)*.06)[...,None]
    joint=np.minimum(np.minimum(fu,1-fu),np.minimum(fv,1-fv))*n/4
    j=np.clip(1-joint/1.6,0,1);col*=(1-j*.45)[...,None]
    dirt=_smooth(.6,.95,fractal(n,1.6,145));col*=(1-dirt*.05)[...,None]
    return np.clip(col,0,1),normal_from_height(-j*.9,n/200)

# ------------------------------------------------------------------------------ glazed tiles
def glaze(n=256):
    """Plain glazed ceramic tiles, 8 across the tile: near-white so each material tints it (the
    upper dome teal, frieze bands green, the wuduk wall pale). Per-tile tone and a slight tilt."""
    cell,fu,fv=_cells(n,8,151)
    col=rgb((.9,.9,.9),.95+(cell[...,0]-.5)*.1+(fractal(n,2.0,152)-.5)*.04)
    joint=np.minimum(np.minimum(fu,1-fu),np.minimum(fv,1-fv))*n/8
    j=np.clip(1-joint/1.4,0,1);col=col*(1-j[...,None]*.4)+j[...,None]*.25
    tilt=(cell[...,1]-.5)*fu*.6+(cell[...,2]-.5)*fv*.6
    return np.clip(col,0,1),normal_from_height(tilt-j*.9,n/90)

def girih(n=1024):
    """Glazed dome tiles: the star-and-cross pattern of Malaysian and Persian domes, in deep
    teal-blue, turquoise and cream strapwork with gold points, laid as cut glazed mosaic (small
    tiles with grout lines and a slight tilt each). Two stars across the 1024 tile."""
    star,cross,cross_min=star_and_cross(n,2)
    deep=np.array([.08,.29,.43]);teal=np.array([.10,.45,.50]);turq=np.array([.29,.66,.68])
    cream=np.array([.91,.89,.80]);gold=np.array([.80,.62,.27])
    col=np.ones((n,n,3))*deep
    inside=star<0;col[inside]=teal
    inner=star<-.11;col[inner]=turq
    core=_star_sdf(_wrap(_uv(n)[0]*2),_wrap(_uv(n)[1]*2),.07)<0;col[core]=cream
    arm=(cross_min<.035)&(cross<.18);col[arm]=turq                 # the cross in the gap
    col[(cross<.04)]=gold
    line=abs(star)<.012;col[line]=cream
    col[abs(star+.11)<.006]=gold
    # glazed mosaic: 24 small tiles across the image, grout, tone and a tilt per tile
    cell,fu,fv=_cells(n,24,161)
    col*=(.94+cell[...,0]*.1)[...,None]
    col*=(1+(fractal(n,2.2,162)-.5)*.06)[...,None]
    joint=np.minimum(np.minimum(fu,1-fu),np.minimum(fv,1-fv))*n/24
    j=np.clip(1-joint/1.5,0,1);col=col*(1-j[...,None]*.35)+j[...,None]*np.array([.30,.32,.30])*.35
    col*=(1-_smooth(.7,1,fractal(n,1.3,163,stretch=(1,10)))*.08)[...,None]   # weathering streaks
    tilt=(cell[...,1]-.5)*fu+(cell[...,2]-.5)*fv
    height=tilt*.5-j*.8+line*.15
    return np.clip(col,0,1),normal_from_height(height,n/260)

def _jali_solid(n):
    """Strapwork, star bosses, cross centres and the fill between: about 55% stone, as cast."""
    star,cross,cross_min=star_and_cross(n,2)
    return ((abs(star)<.07)|(star<-.17)|(cross<.09)|((cross_min>.16)&(star>0))).astype(float)

def jali(n=512):
    """Pierced geometric screen (jali) on a 50 cm tile: star-and-cross strapwork in cast white
    stone, two repeats across. The openings show a dim interior, so no alpha is needed; the same
    openings glow at night through jali_glow."""
    solid=_jali_solid(n)
    h=blur(solid,3)
    col=rgb((.93,.92,.88),.95+(fractal(n,2.0,171)-.5)*.06)
    hole=1-_smooth(.35,.65,h)
    dark=np.array([.11,.14,.12])+np.array([.05,.05,.02])*fractal(n,2.4,172)[...,None]
    col=col*(1-hole[...,None])+dark*hole[...,None]
    col*=(.8+.2*_smooth(.3,.9,h))[...,None]
    return np.clip(col,0,1),normal_from_height(h,n/40)

def jali_glow(n=256):
    """Emissive mask for jali: warm lamplight in the openings, brightest mid-panel."""
    hole=1-_smooth(.35,.65,blur(_jali_solid(n),2))
    return np.clip(hole[...,None]*np.array([1.0,.74,.40]),0,1)

def interior(n=256):
    """What an open door of the prayer hall shows: a lit cream hall with an arcade, a chandelier
    and the red prayer carpet with its gold rows. One image, used as colour and night emission."""
    u,v=_uv(n);y=1-v                                         # y up
    col=np.zeros((n,n,3))+np.array([.70,.58,.42])
    col=col*(.55+.45*_smooth(.2,.75,y))[...,None]            # lit walls above, dimmer low
    arch=(abs(((u*3)%1)-.5)<.30)&(y>.30)&(y<.62+.10*np.cos(((u*3)%1-.5)*np.pi*1.8))
    col[arch]*=.55
    col[y>.80]=np.array([.22,.16,.11])
    glow=np.exp(-(((u-.5)/.10)**2+((y-.76)/.07)**2));col+=glow[...,None]*np.array([.9,.75,.45])
    carpet=y<.26;col[carpet]=np.array([.42,.09,.09])*(.75+.25*_smooth(0,.26,y[carpet]))[...,None]
    rows=carpet&(abs(((y*18)%1)-.5)<.07);col[rows]=np.array([.62,.46,.18])
    return np.clip(col*(.92+.16*fractal(n,2.0,181))[...,None],0,1)

def foliage(n=512):
    """Clipped ixora hedge on a 0.8 m tile: a dense skin of small glossy leaves, darker in the gaps,
    with the round red flower heads that make ixora the hedge of every Malaysian compound."""
    r=np.random.default_rng(191);tone=fractal(n,1.8,194)
    col=np.zeros((n,n,3))+np.array([.07,.12,.05]);height=np.zeros((n,n))
    def splat(cx,cy,half,inside,colour,top):
        k=np.arange(-half,half+1);ys=(int(cy)+k)%n;xs=(int(cx)+k)%n;ix=np.ix_(ys,xs)
        dy,dx=np.meshgrid(k+int(cy)-cy,k+int(cx)-cx,indexing='ij');m,shade=inside(dx,dy)
        c=col[ix];hh=height[ix];c[m]=colour*shade[m][:,None];hh[m]=top+shade[m]*.3;col[ix]=c;height[ix]=hh
    L,W=22,8
    for i in range(1500):   # overlapping pointed-oval leaves, a lighter midrib, each at its own angle
        cx,cy=r.random(2)*n;a=r.random()*np.pi;ca,sa=np.cos(a),np.sin(a)
        g=np.array([.27,.45,.19])*(.62+.55*r.random())*(.85+.3*tone[int(cy),int(cx)])
        def leaf(dx,dy,ca=ca,sa=sa):
            u=(dx*ca+dy*sa)/L;v=(-dx*sa+dy*ca)/W
            m=abs(v)<np.clip(1-u*u,0,1)**.7
            return m,.8+.25*(1-abs(v))-.15*u
        splat(cx,cy,L,leaf,g,i/1500)
    heads=np.random.default_rng(198)
    for k in range(12):     # ixora heads, one per jittered cell so they never line up: domes of red florets
        hx,hy=(np.array([k%4,k//4])+.2+.6*heads.random(2))*np.array([n/4,n/3])
        for _ in range(55):
            a=r.random()*6.28;d=np.sqrt(r.random())*30;fx,fy=hx+np.cos(a)*d,hy+np.sin(a)*d
            red=np.array([.88,.22,.12])*(.75+.3*r.random())
            splat(fx,fy,5,lambda dx,dy:((dx*dx+dy*dy)<20,.9+.1*np.cos(np.arctan2(dy,dx)*4)),red,1.2+(1-d/30)*.4)
    return np.clip(col,0,1),normal_from_height(blur(height,1),n/90)

def wash(n=128):
    """Uplight cone for night washes: bright where the fixture sits (v=0), spreading and fading up
    the wall. Greyscale; the runtime adds it."""
    u,v=_uv(n);y=1-v
    width=.10+.34*y
    c=np.exp(-((u-.5)/width)**2*2.2)*(1-y)**1.35*_smooth(0,.05,y)
    c+=np.exp(-(((u-.5)/.06)**2+(y/.05)**2))*.5
    return np.clip(np.stack([c]*3,-1)/c.max(),0,1)

def wood_small():
    import pbr_textures
    return pbr_textures.wood(256)
