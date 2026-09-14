"""Procedural textures for the city's street furniture (furniture_models.py), numpy in Blender.

Tiling surfaces (galvanised steel, powder coat, terrazzo) are near white or near grey and tinted per
object with linear vertex colour, so one draw carries a black signal housing and a green bin lid.
Pictures (the flag, road signs, signal lenses, the LED lamp lens) are explicit-UV atlases.

Colour images hold sRGB values; normal maps are OpenGL tangent space (kit.image flips rows, so
row 0 of every array here is the TOP of the image, v=1).
"""
import math
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, rgb

def _smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)

def _cells(n,count,seed):
    """Periodic Voronoi: nearest-cell id and F2-F1 edge distance (px)."""
    r=np.random.default_rng(seed);p=r.random((count,2))*n
    yy,xx=np.mgrid[0:n,0:n].astype(np.float32);f1=np.full((n,n),1e9,np.float32);f2=f1.copy();ids=np.zeros((n,n),np.int32)
    for k,(px,py) in enumerate(p):
        dx=np.abs(xx-px);dx=np.minimum(dx,n-dx);dy=np.abs(yy-py);dy=np.minimum(dy,n-dy)
        d=np.sqrt(dx*dx+dy*dy);closer=d<f1
        f2=np.where(closer,f1,np.minimum(f2,d));ids=np.where(closer,k,ids);f1=np.minimum(f1,d)
    return ids,f2-f1

def _half(a):return (a[0::2,0::2]+a[1::2,0::2]+a[0::2,1::2]+a[1::2,1::2])/4

# ------------------------------------------------------------------------------ tiling metals
def galvanised(n=512):
    """Hot-dip galvanised steel on a 0.6 m tile: zinc spangle crystals a shade apart, dull oxide
    mottling, faint drawn streaks along u and pin-point white-rust. Light grey: poles, arms, frames.
    Rust at the base is vertex colour, placed by height on each object."""
    ids,edge=_cells(n,260,501)
    tone=np.random.default_rng(502).random(260)[ids]
    mott=fractal(n,2.2,503);streak=fractal(n,1.2,504,stretch=(24,1));speck=white(n,505)
    col=rgb((.74,.755,.76),.9+(tone-.5)*.07+(mott-.5)*.16+(streak-.5)*.06-_smooth(1.5,0,edge)*.03)
    col[speck>.9975]=col[speck>.9975]*.8+.16
    height=tone*.25-_smooth(1.2,0,edge)*.5+mott*.2+streak*.1
    return np.clip(col,0,1),_half(normal_from_height(blur(height,1),n/420))

def powder(n=512):
    """Powder-coated / painted steel on a 0.5 m tile: orange peel, dust settling, a few paint chips
    showing grey primer. Near white: signal housings go black, bins and shelters take their paint."""
    peel=blur(white(n,511),3);mott=fractal(n,2.3,512);dust=fractal(n,1.6,513)
    chips=_smooth(.86,.9,fractal(n,1.1,514)*.7+white(n,515)*.3)
    col=rgb((.93,.93,.92),.97+(mott-.5)*.05+(peel-.5)*.04+_smooth(.55,.9,dust)*.05)
    col=col*(1-chips[...,None])+np.array([.55,.56,.56])*chips[...,None]
    return np.clip(col,0,1),_half(normal_from_height(blur(peel*.5-chips*.8,1),n/320))

def terrazzo(n=512):
    """Polished precast terrazzo for the fountain coping and plinths, on a 1.2 m tile: cement matrix
    with scattered granite and marble chips."""
    base=fractal(n,2.2,531);chips=np.zeros((n,n));r=np.random.default_rng(532)
    ids,edge=_cells(n,900,533);size=r.random(900);tone=r.random(900)
    inside=(edge>(1-size[ids])*4)
    shade=np.where(tone[ids]<.25,.55,np.where(tone[ids]<.6,.92,1.08))
    col=rgb((.83,.81,.77),.95+(base-.5)*.1)
    col=np.where(inside[...,None],col*shade[...,None],col)
    return np.clip(col,0,1),_half(normal_from_height(blur(inside*.1+base*.2,1),n/400))

def galvanised_lamp():
    """The lamp GLB's own copy at half size: a 5 m pole never shows 512 px of spangle."""
    c,n=galvanised(512);return _half(c),_half(n)

def mosaic(n=256):
    """Glass mosaic tiles lining the fountain basin, 25 mm on a 0.8 m tile: blues a shade apart,
    pale grout."""
    k=32;yy,xx=np.mgrid[0:n,0:n]/n*k;fx,fy=xx%1,yy%1
    grout=np.maximum(_smooth(.1,0,np.minimum(fx,1-fx)),_smooth(.1,0,np.minimum(fy,1-fy)))
    ids=(np.floor(xx)+np.floor(yy)*k).astype(int)%(k*k);tone=np.random.default_rng(571).random(k*k)[ids]
    col=np.stack([.18+tone*.12,.48+tone*.14,.62+tone*.12],-1)
    col=col*(1-grout[...,None])+np.array([.82,.84,.80])*grout[...,None]
    return np.clip(col,0,1),_half(normal_from_height(-grout,n/80))

# ------------------------------------------------------------------------------ text
FONT='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
_FONT=None

def text_mask(body,h_px,ss=3):
    """Coverage mask (rows top-down) of `body` set in Arial Bold, cap height about h_px: a Blender
    text object turned into triangles and rasterised with supersampling (no PIL in Blender)."""
    import bpy,bmesh
    global _FONT
    if _FONT is None:
        try:_FONT=bpy.data.fonts.load(FONT)
        except Exception:_FONT=False
    cu=bpy.data.curves.new('tx','FONT');cu.body=body;cu.size=1.0;cu.resolution_u=4
    if _FONT:cu.font=_FONT
    ob=bpy.data.objects.new('tx',cu);bpy.context.scene.collection.objects.link(ob)
    dg=bpy.context.evaluated_depsgraph_get();me=bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.triangulate(bm,faces=bm.faces)
    tris=[[(v.co.x,v.co.y) for v in f.verts] for f in bm.faces];bm.free()
    bpy.data.objects.remove(ob);bpy.data.curves.remove(cu);bpy.data.meshes.remove(me)
    xs=[p[0] for t in tris for p in t];ys=[p[1] for t in tris for p in t]
    x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
    scale=h_px*ss/.72                     # Arial cap height is ~0.72 em
    W=int(math.ceil((x1-x0)*scale))+2;H=int(math.ceil((y1-y0)*scale))+2
    W+=(-W)%ss;H+=(-H)%ss
    m=np.zeros((H,W),np.float32)
    for t in tris:
        P=[((x-x0)*scale+1,(y1-y)*scale+1) for x,y in t]
        bx0=max(int(min(p[0] for p in P)),0);bx1=min(int(max(p[0] for p in P))+1,W)
        by0=max(int(min(p[1] for p in P)),0);by1=min(int(max(p[1] for p in P))+1,H)
        if bx1<=bx0 or by1<=by0:continue
        yy,xx=np.mgrid[by0:by1,bx0:bx1]+.5
        (ax,ay),(bx,by),(cx,cy)=P
        d1=(xx-bx)*(ay-by)-(ax-bx)*(yy-by);d2=(xx-cx)*(by-cy)-(bx-cx)*(yy-cy);d3=(xx-ax)*(cy-ay)-(cx-ax)*(yy-ay)
        inside=~(((d1<0)|(d2<0)|(d3<0))&((d1>0)|(d2>0)|(d3>0)))
        m[by0:by1,bx0:bx1]=np.maximum(m[by0:by1,bx0:bx1],inside)
    return m.reshape(H//ss,ss,W//ss,ss).mean(axis=(1,3))

def stamp(img,mask,x,y,color,anchor='c'):
    """Paint an sRGB colour through a mask at pixel (x,y): anchor 'c' centre, 'l' left-middle."""
    h,w=mask.shape;x0=int(round(x-(w/2 if anchor=='c' else 0)));y0=int(round(y-h/2))
    H,W=img.shape[:2];sx0=max(0,-x0);sy0=max(0,-y0);x0c=max(0,x0);y0c=max(0,y0)
    x1=min(W,x0+w);y1=min(H,y0+h)
    if x1<=x0c or y1<=y0c:return
    a=mask[sy0:sy0+(y1-y0c),sx0:sx0+(x1-x0c)][...,None]
    img[y0c:y1,x0c:x1]=img[y0c:y1,x0c:x1]*(1-a)+np.array(color)*a

def _sdf_rrect(X,Y,x0,x1,y0,y1,r):
    cx,cy=(x0+x1)/2,(y0+y1)/2;hx,hy=(x1-x0)/2-r,(y1-y0)/2-r
    qx=np.abs(X-cx)-hx;qy=np.abs(Y-cy)-hy
    return np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)-r

def _fill(img,sdf,color,aa=1.0):
    a=np.clip(.5-sdf/aa,0,1)[...,None];img[:]=img*(1-a)+np.array(color)*a

def _poly_mask(X,Y,P):
    """Even-odd point in polygon over pixel grids; P in pixels."""
    inside=np.zeros(X.shape,bool);n=len(P)
    for i in range(n):
        (xa,ya),(xb,yb)=P[i],P[(i+1)%n]
        cond=((ya>Y)!=(yb>Y))&(X<(xb-xa)*(Y-ya)/((yb-ya) if yb!=ya else 1e-9)+xa)
        inside^=cond
    return inside

def _aa_poly(h,w,P,ss=4):
    Y,X=np.mgrid[0:h*ss,0:w*ss]+.5
    m=_poly_mask(X,Y,[(x*ss,y*ss) for x,y in P]).astype(np.float32)
    return m.reshape(h,ss,w,ss).mean(axis=(1,3))

# ------------------------------------------------------------------------------ cloth
RED=(.80,.0,.0);WHITE=(.98,.98,.97);NAVY=(.0,.0,.40);YELLOW=(1.0,.80,.0)
def _weave(h,w,seed,k=150):
    yy,xx=np.mgrid[0:h,0:w]/max(h,w)
    return np.sin(xx*2*np.pi*k)*np.sin(yy*2*np.pi*k)*.5+(fractal(max(h,w),1.5,seed)[:h,:w]-.5)

def cloth(w=1024,h=1024):
    """Flag cloth atlas. Top half (v .5..1): the Jalur Gemilang, 1:2, fourteen red and white
    stripes, navy canton over eight of them with the yellow crescent and fourteen-point star.
    Bottom half: four pennant swatches (red, yellow, navy, white), u 0..1 in quarters, hem at
    the top of each. Printed polyester: weave, a soft crease field."""
    img=np.zeros((h,w,3));fh=h//2
    flag=img[:fh]
    stripe=(np.arange(fh)*14//fh)%2
    flag[:]=np.where(stripe[:,None,None]==0,np.array(RED),np.array(WHITE))
    cw,ch=w//2,int(round(fh*8/14))
    flag[:ch,:cw]=NAVY
    ss=4;Y,X=np.mgrid[0:ch*ss,0:cw*ss]+.5;X/=ss;Y/=ss
    R=ch*.40;cx=cw*.36;cy=ch*.5
    moon=((X-cx)**2+(Y-cy)**2<R*R)&~((X-cx-ch*.12)**2+(Y-cy)**2<(ch*.345)**2)
    moon=moon.astype(np.float32).reshape(ch,ss,cw,ss).mean(axis=(1,3))
    sx,sy,ro,ri=cw*.70,ch*.5,ch*.33,ch*.33*.46
    P=[(sx+(ro if i%2==0 else ri)*math.sin(i*math.pi/14),sy-(ro if i%2==0 else ri)*math.cos(i*math.pi/14)) for i in range(28)]
    star=_aa_poly(ch,cw,P)
    a=np.maximum(moon,star)[...,None];flag[:ch,:cw]=flag[:ch,:cw]*(1-a)+np.array(YELLOW)*a
    crease=blur(fractal(1024,2.6,541,stretch=(1,2.5))[:fh,:w],2)
    img[:fh]*=(.9+(crease-.5)*.16+_weave(fh,w,542)*.05)[...,None]
    sw=w//4;cols=[(.82,.08,.08),(1.0,.78,.05),(.04,.10,.45),(.97,.97,.95)]
    for i,c in enumerate(cols):
        img[fh:,i*sw:(i+1)*sw]=c
    hem=np.zeros(h-fh);hem[:int((h-fh)*.07)]=1
    img[fh:]*=(1-hem[:,None,None]*.12)
    img[fh:]*=(.92+_weave(h-fh,w,543)*.06)[...,None]
    height=np.zeros((h,w));height[:fh]=crease*.8
    return np.clip(img,0,1),normal_from_height(blur(height,1),6)

# ------------------------------------------------------------------------------ road signs
SIGN_BLUE=(.05,.26,.60);ALU=(.78,.79,.80)

def _walker(h_px):
    """A walking pedestrian pictogram as a polygon list in a unit box (0..1, y down)."""
    head=[(.56+.09*math.cos(a),.12+.09*math.sin(a)) for a in np.linspace(0,2*math.pi,18,endpoint=False)]
    body=[(.50,.24),(.64,.24),(.72,.52),(.62,.54),(.58,.40),(.56,.58),(.74,.78),(.70,.98),(.60,.98),(.62,.82),(.48,.66),(.38,.98),(.26,.98),(.40,.62),(.44,.40),(.36,.50),(.28,.46)]
    return [head,body]

def signs(n=1024):
    """Road sign atlas, printed retro-reflective sheeting on aluminium (see SIGN_UV):
      bus       blue plate: white bus pictogram and HENTIAN BAS
      route     white route board: blue HENTIAN BAS header, route chips, timetable lines
      advert    shelter lightbox poster: generic tropical drink advert, no brand
    """
    img=np.ones((n,n,3))*np.array(ALU)
    Y,X=np.mgrid[0:n,0:n]+.5
    q=n/1024
    # bus stop plate: (384..1024, 0..384)
    x0=388*q;x1=n-4*q
    _fill(img,_sdf_rrect(X,Y,x0,x1,4*q,380*q,22*q),(.97,.97,.97),1.2)
    _fill(img,_sdf_rrect(X,Y,x0+14*q,x1-14*q,18*q,366*q,14*q),SIGN_BLUE,1.2)
    bus=_sdf_rrect(X,Y,x0+180*q,x0+452*q,52*q,196*q,22*q);_fill(img,bus,(.98,.98,.98),1.2)
    for k in range(4):_fill(img,_sdf_rrect(X,Y,x0+200*q+k*62*q,x0+248*q+k*62*q,72*q,122*q,6*q),SIGN_BLUE,1.0)
    for wx in (x0+230*q,x0+400*q):
        d=np.hypot(X-wx,Y-200*q)-22*q;_fill(img,d,(.98,.98,.98),1.2);_fill(img,np.hypot(X-wx,Y-200*q)-10*q,SIGN_BLUE,1.0)
    stamp(img,text_mask('HENTIAN BAS',64*q),(x0+x1)/2,300*q,(.98,.98,.98))
    # route board: (0..384, 384..1024) portrait
    rx0,rx1,ry0,ry1=4*q,380*q,388*q,n-4*q
    _fill(img,_sdf_rrect(X,Y,rx0,rx1,ry0,ry1,10*q),(.95,.95,.93),1.2)
    _fill(img,_sdf_rrect(X,Y,rx0,rx1,ry0,ry0+92*q,10*q),SIGN_BLUE,1.2)
    stamp(img,text_mask('HENTIAN BAS',36*q),(rx0+rx1)/2,ry0+46*q,(.98,.98,.98))
    chips=[('T401',(.83,.13,.15)),('300',(.05,.45,.75)),('651',(.95,.62,.08)),('580',(.20,.55,.25))]
    for i,(label,c) in enumerate(chips):
        cy=ry0+140*q+i*96*q
        _fill(img,_sdf_rrect(X,Y,rx0+18*q,rx0+150*q,cy-30*q,cy+30*q,12*q),c,1.1)
        stamp(img,text_mask(label,28*q),rx0+84*q,cy,(.98,.98,.98))
        r=np.random.default_rng(550+i)
        for j in range(3):
            ly=cy-20*q+j*20*q;L=(120+r.random()*90)*q
            _fill(img,_sdf_rrect(X,Y,rx0+170*q,rx0+170*q+L,ly-4*q,ly+4*q,3*q),(.35,.37,.40),1.0)
    for j in range(6):
        ly=ry0+540*q+j*14*q
        _fill(img,_sdf_rrect(X,Y,rx0+24*q,rx1-40*q-(j%3)*30*q,ly-3*q,ly+3*q,2*q),(.55,.56,.58),1.0)
    # advert poster: (384..1024, 384..1024) square, lightbox
    ax0,ax1,ay0,ay1=388*q,n-4*q,388*q,n-4*q
    g=np.clip((Y-ay0)/(ay1-ay0),0,1)
    sky=np.stack([.98-.35*g,.72-.25*g,.30+.1*g],-1)
    inside=(X>ax0)&(X<ax1)&(Y>ay0)&(Y<ay1)
    img[inside]=sky[inside]
    glass=_sdf_rrect(X,Y,ax0+200*q,ax0+330*q,ay0+170*q,ay0+520*q,26*q);_fill(img,glass,(.93,.95,.96),1.2)
    _fill(img,_sdf_rrect(X,Y,ax0+212*q,ax0+318*q,ay0+260*q,ay0+508*q,18*q),(.55,.30,.14),1.2)
    for k in range(7):
        d=np.hypot(X-(ax0+250*q+(k%3)*28*q),Y-(ay0+300*q+k*26*q))-9*q;_fill(img,d,(.95,.92,.85),1.0)
    stamp(img,text_mask('SEGAR!',70*q),ax0+470*q,ay0+220*q,(.98,.98,.98))
    stamp(img,text_mask('SEJUK SELALU',30*q),ax0+470*q,ay0+300*q,(.25,.12,.05))
    _fill(img,_sdf_rrect(X,Y,ax0+30*q,ax1-30*q,ay1-70*q,ay1-40*q,8*q),(.98,.98,.97),1.0)
    grit=blur(white(n,561),1)
    img*=(.97+(grit-.5)*.05)[...,None]
    return np.clip(img,0,1)

SIGN_UV={'bus':(.375,.625,1.0,1.0),'route':(0,0,.375,.625),'advert':(.375,0,1.0,.625)}

# ------------------------------------------------------------------------------ signals and lamp
def signal(n=512):
    """Traffic signal lens atlas (baseColor and emission), 4x4 cells of 128 px, row 0 at the top:
      row 0  lit red, amber, green balls        row 1  lit red man, green man, countdown '12'
      row 2  unlit red, amber, green balls      row 3  unlit man, unlit countdown
    Lit lenses are LED clusters behind a clear diffuser, painted saturated because emission
    multiplies this image; unlit lenses are dark tinted glass with a sky highlight."""
    img=np.zeros((n,n,3))+.02;c=n//4
    Y,X=np.mgrid[0:c,0:c]+.5;R=c*.44
    d=np.hypot(X-c/2,Y-c/2)
    leds=(np.sin(X/c*2*np.pi*11)**2*np.sin(Y/c*2*np.pi*11)**2)
    lens=np.clip((R-d)/1.2,0,1)[...,None];rim=np.clip(1-np.abs(d-R-2)/2.5,0,1)[...,None]*.22
    shine=np.clip(1-np.hypot(X-c*.38,Y-c*.32)/(c*.16),0,1)[...,None]**2
    def put(r,k,cell):img[r*c:(r+1)*c,k*c:(k+1)*c]=np.clip(cell,0,1)
    for k,(lit,dim) in enumerate([((1.0,.10,.05),(.16,.03,.02)),((1.0,.55,.02),(.18,.10,.02)),((.05,1.0,.55),(.02,.12,.07))]):
        glow=((.55+.45*leds)*(1-.35*(d/R)**2))[...,None]
        put(0,k,np.array(lit)*glow*lens+(1-lens)*.03+rim)
        put(2,k,np.array(dim)*(.8+.2*leds[...,None])*lens+shine*lens*.35+(1-lens)*.03+rim)
    stand=[[(.56+.09*math.cos(a),.12+.09*math.sin(a)) for a in np.linspace(0,2*math.pi,16,endpoint=False)],
           [(.42,.24),(.70,.24),(.74,.56),(.66,.56),(.64,.98),(.53,.98),(.56,.62),(.52,.62),(.49,.98),(.38,.98),(.36,.56),(.30,.56)]]
    def figure(polys,col):
        cell=np.zeros((c,c,3))+.02;m=np.zeros((c,c))
        for poly in polys:m=np.maximum(m,_aa_poly(c,c,[(c*.2+x*c*.6,c*.1+y*c*.8) for x,y in poly]))
        return cell+np.array(col)[None,None,:]*m[...,None]*(.6+.4*leds[...,None])
    put(1,0,figure(stand,(1.0,.12,.06)));put(1,1,figure(_walker(1),(.1,1.0,.5)))
    put(3,0,figure(stand,(.07,.05,.05)))
    digits=text_mask('12',c*.5)
    for r,col in ((1,(1.0,.35,.05)),(3,(.06,.04,.03))):
        cell=np.zeros((c,c,3))+.02;stamp(cell,digits,c/2,c/2,col);cell*=(.55+.45*leds[...,None]) if r==1 else 1;put(r,2 if r==1 else 1,cell)
    return np.clip(img,0,1)

def signal_uv(row,col):
    """(u0,v0,u1,v1) of an atlas cell; kit.image flips rows, so row 0 is the top (v 1)."""
    return (col/4,1-(row+1)/4,(col+1)/4,1-row/4)

def led_lens(w=256,h=128):
    """Underside of an LED road lantern: 3 rows of 12 LED modules, each a bright die under a small
    TIR optic, on a dark diffuser frame. Used as baseColor and (at runtime) emission."""
    img=np.zeros((h,w,3))+np.array((.05,.055,.06))
    Y,X=np.mgrid[0:h,0:w]+.5
    for r in range(3):
        for k in range(12):
            cx=w*(.08+k*.84/11);cy=h*(.25+r*.25)
            d=np.hypot(X-cx,Y-cy)
            optic=np.clip(1-d/(h*.1),0,1)**1.5;die=np.clip(1-d/(h*.035),0,1)
            img+=np.array((.55,.52,.46))[None,None,:]*(optic*.45+die)[...,None]
    edge=_sdf_rrect(X,Y,4,w-4,4,h-4,10);img*=np.clip(-edge/3,0,1)[...,None]*.9+.1
    return np.clip(img,0,1)
