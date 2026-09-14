"""Procedural textures for the generic two-storey shophouse kit (scripts/blender/build_shoplots.py).

Built on the spectral primitives in pbr_textures.py, so every tiled field wraps by construction.
Colour images hold sRGB, normals are OpenGL tangent space, row 0 is the top of the image.

  render   painted cement render on a 3 m tile: faded paint, patch repaints, hairline cracks. Near
           white; the runtime tints it with each building's colour and lays rain streaks and algae
           over it in world space (src/shoplots.ts), so nothing large repeats with the tile.
  tiles    the five-foot-way: 15 cm red quarry tiles on a 1.2 m tile, a few cracked or replaced
  shutter  galvanised roller shutter slats on a 1 m tile
  zinc     corrugated zinc roofing on a 2 m tile, rusting in patches
  atlas    1024 x 1024, not tiled. Top half: four 512 x 256 shop interiors seen through the
           shopfronts (kopitiam, grocery shelves, laundry machines, hardware). Bottom half: eight
           256 x 256 upper-floor windows (curtains, blinds, dark rooms). The runtime moves UVs
           between cells, and the same image is the night emission.
  wash     a soft light pool for the night lamp planes
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, worley_edges, rgb

def _smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)

def _lerp(a,b,t):return a+(np.asarray(b)-a)*t[...,None]

def _half(a):return (a[0::2,0::2]+a[1::2,0::2]+a[0::2,1::2]+a[1::2,1::2])/4

def _cells(n,count,seed):
    v,u=np.mgrid[0:n,0:n]/n;r=np.random.default_rng(seed).random((count,count,4))
    iu=(u*count).astype(int)%count;iv=(v*count).astype(int)%count
    return r[iv,iu],(u*count)%1,(v*count)%1

# ------------------------------------------------------------------------------ tiled surfaces
def render(n=1024):
    """Painted cement render, 3 m tile. Old emulsion chalked unevenly, rectangular touch-up
    patches a shade off, roller marks, hairline map cracks, the odd spall. Height: fine sand
    render grain and crack edges."""
    mott=fractal(n,2.0,301)*.6+fractal(n,1.3,302)*.4
    grain=blur(white(n,303),1)
    col=rgb((.955,.95,.93),.975+(mott-.5)*.07+(grain-.5)*.05)
    # touch-up patches: soft-edged rectangles a little brighter or duller than the wall
    r=np.random.default_rng(304);v,u=np.mgrid[0:n,0:n]/n
    for _ in range(9):
        cx,cy,w,h=r.random(),r.random(),r.uniform(.05,.22),r.uniform(.04,.16);k=r.uniform(-.045,.04)
        dx=np.abs((u-cx+.5)%1-.5);dy=np.abs((v-cy+.5)%1-.5)
        m=_smooth(.004,0,np.maximum(dx-w/2,dy-h/2))*(.7+.3*fractal(n,1.5,305))
        col*=(1+k*m)[...,None]
    roller=fractal(n,1.2,306,stretch=(1,14))
    col*=(1+(roller-.5)*.025)[...,None]
    cracks=np.clip(1-worley_edges(n,14,307)/1.1,0,1)**6*_smooth(.55,.75,fractal(n,1.7,308))
    col*=(1-cracks*.22)[...,None]
    spall=_smooth(.25,.6,blur((white(n,309)>.99985).astype(float),4)*60)*_smooth(.4,.7,fractal(n,2.4,310))
    col=_lerp(col,(.66,.65,.62),spall*.6)
    height=grain*.5+mott*.25-cracks*.7-spall*.9
    return np.clip(col,0,1),_half(normal_from_height(height,n/260))

def tiles(n=1024):
    """Five-foot-way floor, 1.2 m tile: 15 cm unglazed red quarry tiles (eight across) with 5 mm
    cement joints. Each tile has its own firing tone; about one in fourteen is a grey cement
    patch or a buff replacement, some are cracked, grime sits in the joints and pits."""
    cell,fu,fv=_cells(n,8,321);grain=blur(white(n,322),1);mott=fractal(n,2.2,323)
    tone=.84+cell[...,0]*.26
    col=rgb((.50,.27,.20),tone+(mott-.5)*.12+(grain-.5)*.08)
    buff=cell[...,1]>.972;grey=cell[...,1]<.03
    col=np.where(buff[...,None],rgb((.66,.52,.38),.9+(grain-.5)*.1+(mott-.5)*.1),col)
    col=np.where(grey[...,None],rgb((.52,.51,.48),.9+(grain-.5)*.12),col)
    wear=_smooth(.35,.8,fractal(n,1.6,324));col=_lerp(col,(.62,.42,.34),wear*.18)
    edge=np.minimum(np.minimum(fu,1-fu),np.minimum(fv,1-fv))*n/8
    joint=_smooth(3.2,1.6,edge);bevel=_smooth(0,6,edge)
    col=_lerp(col,(.33,.31,.28),joint*.92)
    crack=np.clip(1-np.abs(fractal(n,2.8,325)-.5)*140,0,1)*(cell[...,2]>.86)
    col*=(1-crack*.45)[...,None]
    dirt=_smooth(.55,.95,fractal(n,1.4,326));col*=(1-dirt*.22)[...,None]
    height=bevel*.5-joint*.8+(grain-.5)*.15-crack*.4
    return np.clip(col,0,1),_half(normal_from_height(height,n/140))

def shutter(n=512):
    """Galvanised roller shutter on a 1 m tile: 13 slats with a raised lobe and a hinge curl
    each (u across the opening, v up), zinc spangle, grime in the curls, rust spots."""
    v=np.mgrid[0:n,0:n][0]/n;phase=(v*13)%1
    lobe=np.sin(np.clip(phase/.78,0,1)*np.pi)**.6;curl=_smooth(.78,.86,phase)*_smooth(1,.9,phase)
    prof=lobe*.8+curl*1.1
    spangle=blur(white(n,331),2);mott=fractal(n,1.8,332,stretch=(4,1))
    col=rgb((.64,.655,.66),.93+(spangle-.5)*.12+(mott-.5)*.14+lobe[...,None][...,0]*.06)
    col*=(1-_smooth(.72,.78,phase)*.35)[...,None]
    scratch=np.clip((fractal(n,1.0,333,stretch=(40,1))-.8)*6,0,1);col*=(1+scratch*.12)[...,None]
    rust=_smooth(.72,.9,fractal(n,2.1,334))*_smooth(.5,.7,fractal(n,1.2,335))
    col=_lerp(col,(.45,.27,.15),rust*.55)
    return np.clip(col,0,1),normal_from_height(prof*.9+spangle*.05,n/70)

def zinc(n=512):
    """Corrugated zinc on a 2 m tile: 26 corrugations across u (a 76 mm pitch), laps every
    metre along v, galvanising gone dull, orange-brown rust in patches that runs downslope (v)."""
    u=np.mgrid[0:n,0:n][1]/n;v=np.mgrid[0:n,0:n][0]/n
    wave=np.sin(u*2*np.pi*26)
    lap=_smooth(0,.012,np.abs(((v*2)%1)-.5)-.488)
    mott=fractal(n,1.9,341);streak=fractal(n,1.1,342,stretch=(1,18))
    col=rgb((.60,.61,.60),.88+(mott-.5)*.2+wave[...,None][...,0]*.05+(streak-.5)*.12)
    rust=_smooth(.55,.95,fractal(n,1.6,343)*.6+streak*.5)
    col=_lerp(col,np.array([.5,.36,.25])*(.85+.3*mott)[...,None],rust*.5)
    col*=(1-lap*.3)[...,None]
    return np.clip(col,0,1),normal_from_height(wave*1.4+lap*.6+mott*.2,n/60)

# ------------------------------------------------------------------------------ painted atlas
class Paint:
    """A tiny raster painter in cell pixels (x right, y down)."""
    def __init__(self,h,w,seed):
        self.c=np.zeros((h,w,3));self.h,self.w=h,w;self.r=np.random.default_rng(seed)
        self.y,self.x=np.mgrid[0:h,0:w]
    def rect(self,x0,y0,x1,y1,col,shade=0.0):
        x0,x1=int(max(0,x0)),int(min(self.w,x1));y0,y1=int(max(0,y0)),int(min(self.h,y1))
        if x1<=x0 or y1<=y0:return
        g=np.linspace(1+shade,1-shade,y1-y0)[:,None,None]
        self.c[y0:y1,x0:x1]=np.asarray(col)*g
    def disc(self,cx,cy,r,col,ring=None):
        d=np.hypot(self.x-cx,self.y-cy);m=d<r
        self.c[m]=col
        if ring is not None:self.c[(d<r)&(d>r*.78)]=ring
    def grain(self,amount=.06,seed=1):
        g=np.random.default_rng(seed).random((self.h,self.w));g=(g+np.roll(g,1,0)+np.roll(g,1,1))/3
        self.c*=(1+(g-.5)*amount)[...,None]
    def light(self,top=1.15,bottom=.8):
        self.c*=np.linspace(top,bottom,self.h)[:,None,None]

def _kopitiam(p):
    H,W=p.h,p.w
    p.rect(0,0,W,H,(.72,.80,.70))                               # pale green emulsion
    for x in range(0,W,14):p.rect(x,int(H*.52),x+13,H,(.90,.90,.86))  # white wall tiles to 1.2 m
    for y in range(int(H*.52),H,14):p.rect(0,y,W,y+1,(.66,.66,.62))
    for x in range(0,W,14):p.rect(x,int(H*.52),x+1,H,(.66,.66,.62))
    p.rect(40,34,200,92,(.13,.25,.19))                          # menu board with chalk rows
    for row in range(5):
        for col in range(2):
            y=44+row*9;x=50+col*76;p.rect(x,y,x+p.r.integers(30,62),y+4,(.88,.86,.72))
    p.disc(262,38,11,(.95,.94,.9),ring=(.3,.2,.15))           # clock
    p.rect(300,20,338,70,(.93,.92,.85));p.rect(304,26,334,40,(.75,.18,.14))  # calendar
    p.rect(22,142,250,H,(.72,.73,.74),.08)                      # stainless drinks counter
    p.rect(22,136,250,146,(.86,.87,.88))
    p.rect(40,108,150,138,(.45,.55,.58),.1)                     # glass cabinet with cakes
    for i in range(6):p.rect(46+i*17,124,58+i*17,134,(.85,.62,.3))
    p.rect(380,64,452,H,(.62,.1,.1),.05)                        # drinks fridge
    p.rect(388,74,444,200,(.18,.2,.24))
    for shelf in range(5):
        y=82+shelf*24;p.rect(390,y+14,442,y+16,(.7,.7,.72))
        for i in range(6):p.rect(392+i*8,y,398+i*8,y+14,[(.9,.4,.2),(.3,.6,.3),(.9,.85,.3),(.8,.2,.2)][(i+shelf)%4])
    p.rect(462,80,512,H,(.12,.1,.09))                           # kitchen doorway
    p.rect(300,150,340,H,(.55,.38,.24))                         # tables and stools inside
    p.rect(270,168,370,176,(.93,.93,.9))
    for x in (282,352):p.rect(x-8,196,x+8,214,(.75,.18,.15))

def _grocery(p):
    H,W=p.h,p.w
    p.rect(0,0,W,H,(.86,.85,.80))
    p.rect(0,0,W,22,(.25,.45,.62))                              # blank header strips
    for x0,x1 in ((0,230),(282,W)):
        for tier in range(5):
            y=34+tier*42
            p.rect(x0,y+36,x1,y+41,(.78,.78,.76))
            x=x0+2
            while x<x1-4:
                w=int(p.r.integers(8,22));h=int(p.r.integers(16,34))
                col=np.array([(.85,.25,.2),(.95,.75,.2),(.25,.55,.3),(.2,.4,.75),(.95,.95,.9),(.6,.3,.55),(.9,.5,.2)][p.r.integers(0,7)])
                p.rect(x,y+36-h,x+w-1,y+36,col*p.r.uniform(.7,1.05),.12);x+=w
    p.rect(230,26,282,H,(.30,.30,.28))                          # aisle into the back
    for tier in range(5):p.rect(236,40+tier*36,276,44+tier*36,(.45,.44,.42))
    p.rect(8,176,120,H,(.55,.4,.28),.05);p.rect(20,160,70,178,(.2,.2,.22))   # counter and till
    for i in range(8):p.rect(330+i*20,214,346+i*20,238,(.55,.42,.25))       # rice sacks
    p.rect(320,238,W,H,(.62,.6,.55))

def _laundry(p):
    H,W=p.h,p.w
    p.rect(0,0,W,H,(.80,.88,.92))
    for y in range(0,H,12):p.rect(0,y,W,y+1,(.72,.80,.84))
    p.rect(20,18,120,70,(.95,.95,.92));p.rect(28,26,112,32,(.2,.35,.6))       # price notice
    for i in range(6):p.rect(28,38+i*5,28+p.r.integers(40,80),40+i*5,(.35,.35,.38))
    for col in range(6):
        x=150+col*60
        for row,y0 in enumerate((20,122)):
            p.rect(x,y0,x+56,y0+96,(.86,.87,.88),.1)
            p.rect(x+4,y0+4,x+52,y0+16,(.25,.26,.28))
            p.rect(x+30,y0+7,x+46,y0+13,(.35,.85,.45) if (col+row)%3 else (.9,.3,.2))
            p.disc(x+28,y0+58,20,(.12,.15,.2),ring=(.62,.64,.66))
            p.disc(x+22,y0+52,6,(.35,.42,.5))
    p.rect(0,226,W,H,(.55,.56,.55))
    p.rect(24,150,120,160,(.9,.9,.88));p.rect(30,160,36,226,(.4,.4,.42));p.rect(108,160,114,226,(.4,.4,.42))
    p.rect(40,120,90,150,(.35,.55,.85),.1)                       # a basket of clothes

def _hardware(p):
    H,W=p.h,p.w
    p.rect(0,0,W,H,(.80,.76,.66))
    p.rect(10,20,190,150,(.62,.48,.32))                          # pegboard with tools
    for yy in range(26,150,8):
        for xx in range(16,190,8):p.c[yy,xx]*=.6
    for i in range(18):
        x=int(p.r.integers(20,176));y=int(p.r.integers(28,120));w=int(p.r.integers(4,12));h=int(p.r.integers(14,36))
        p.rect(x,y,x+w,y+h,[(.15,.15,.16),(.8,.2,.15),(.95,.75,.1),(.2,.35,.6)][i%4])
    for tier in range(4):                                        # boxed goods
        y=26+tier*50;p.rect(206,y+44,W,y+48,(.45,.45,.47))
        x=208
        while x<W-6:
            w=int(p.r.integers(16,40));h=int(p.r.integers(20,42))
            col=[(.66,.5,.32),(.72,.58,.38),(.9,.9,.88),(.25,.4,.7),(.85,.25,.2)][int(p.r.integers(0,5))]
            p.rect(x,y+44-h,x+w-2,y+44,np.array(col)*p.r.uniform(.8,1.05),.1);x+=w
    for i in range(9):                                           # paint tins and buckets on the floor
        x=20+i*20;p.rect(x,210,x+16,236,[(.95,.95,.92),(.2,.5,.8),(.9,.3,.2)][i%3],.15)
    p.rect(0,236,W,H,(.5,.48,.45))
    for x in (60,140):p.disc(x,178,16,(.75,.77,.8),ring=(.4,.42,.45))       # hanging fans

def _window(p,kind):
    H,W=p.h,p.w
    sky=np.linspace(.62,.2,H)[:,None,None]*np.array([.62,.72,.8])
    if kind=='curtain-floral' or kind=='curtain-plain' or kind=='curtain-maroon':
        base={'curtain-floral':(.86,.8,.66),'curtain-plain':(.45,.58,.72),'curtain-maroon':(.5,.2,.2)}[kind]
        folds=.8+.2*np.sin(p.x/W*np.pi*14+np.sin(p.y/H*3)*.6)
        p.c[:]=np.asarray(base)*folds[...,None]
        if kind=='curtain-floral':
            for _ in range(40):p.disc(p.r.integers(0,W),p.r.integers(0,H),p.r.integers(3,7),(.8,.45,.45))
        gap=int(W*p.r.uniform(.38,.55));p.rect(gap-8,0,gap+8,H,(.08,.08,.09))
    elif kind=='blinds':
        p.c[:]=(.9,.9,.86)
        for x in range(0,W,16):p.rect(x,0,x+2,H,(.7,.7,.68))
        p.rect(0,int(H*.75),W,H,(.1,.1,.11))
    elif kind=='dark':
        p.c[:]=(.1,.1,.11);p.rect(0,0,W,20,(.25,.24,.22))
        p.rect(W*.3,26,W*.7,32,(.9,.9,.85))                      # fluorescent tube
        p.rect(W*.45,60,W*.55,64,(.2,.2,.2));p.rect(W*.2,62,W*.8,65,(.18,.18,.18))  # ceiling fan
    elif kind=='frosted':
        p.c[:]=(.78,.8,.78)
        for y in range(0,H,32):p.rect(0,y,W,y+3,(.7,.72,.7))
    elif kind=='boxes':   # a dim store room: a wardrobe, a shelf of cartons, a hanging shirt
        p.c[:]=(.16,.15,.14);p.rect(0,0,W,24,(.22,.21,.19))
        p.rect(18,40,120,H,(.33,.24,.17),.15);p.rect(66,40,70,H,(.2,.15,.1))
        p.rect(150,120,W,126,(.3,.29,.27))
        for i in range(4):p.rect(152+i*25,84,172+i*25,120,(.46,.36,.24),.12)
        p.rect(170,150,214,230,(.35,.45,.6),.1);p.rect(188,142,196,150,(.25,.25,.26))
    elif kind=='newspaper':
        p.c[:]=(.82,.8,.72)
        for y in range(8,H,10):
            for x in range(8,W,70):p.rect(x,y,x+int(p.r.integers(30,62)),y+4,(.4,.4,.4))
    p.c[:]=p.c*.72+sky*.28*np.linspace(1,.2,H)[:,None,None]      # daylight reflection, strongest high up

def atlas(n=1024):
    img=np.zeros((n,n,3))
    for i,fn in enumerate((_kopitiam,_grocery,_laundry,_hardware)):
        p=Paint(256,512,400+i);fn(p);p.light(.95,.7);p.grain(.08,410+i)
        r,c=divmod(i,2);img[r*256:(r+1)*256,c*512:(c+1)*512]=p.c
    kinds=('curtain-floral','blinds','dark','curtain-plain','frosted','curtain-maroon','boxes','newspaper')
    for i,k in enumerate(kinds):
        p=Paint(256,256,420+i);_window(p,k);p.grain(.06,430+i)
        r,c=divmod(i,4);img[512+r*256:512+(r+1)*256,c*256:(c+1)*256]=p.c
    return np.clip(img,0,1)

def wash(n=256):
    """Warm pool of lamp light: bright centre, long soft falloff, alpha carried in the colour."""
    v,u=np.mgrid[0:n,0:n]/n-.5;d=np.hypot(u,v)*2
    a=np.clip(1-d,0,1)**2.2
    return np.stack([a,a,a],-1)
