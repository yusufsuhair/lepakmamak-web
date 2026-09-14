"""KFC and McDonald's drive-throughs at (105,60) and (129,60), photographic pass.

KFC in its Malaysian outlet language: white render box, the red-and-white stripe feature at the
lane corner, a red brand band with the roundel and red-lit letters, a glazed front onto red
booths, a counter under lit menu boards and a stainless kitchen, the bucket up on a pole sign.
McDonald's in the current look: charcoal panel box, timber slats on the McCafe wing, the yellow
brow blade carrying the arches over the roof, a white wordmark, a red and yellow pole sign.

Both lanes: textured asphalt between painted kerbs, flat arrows and DRIVE THRU painted on the
lane, a clearance bar at the entry, a canopied order point with lit menu boards and a speaker
post, and a pickup window in the lane-side wall under its own awning with the counter behind it.

Contract with src/world.ts driveThrough(), unchanged: body 14 x 12 at x = -laneSide*2.5 with its
street face at z +6 (the only collider), the lane at x = laneSide*8 kept clear, the pole sign
beside the road. The game clears its own boxes and canvas signs when this arrives, so the
lettering here is geometry. Night: 'Night ...' materials are driven by src/brands.ts.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_fastfood.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_DriveThrough.glb

Output: public/assets/models/environment/LM_ENV_DriveThrough.glb, nodes 'kfc' and 'mcd'.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt, join, loft
import brand_kit as BK
from brand_kit import box, cyl, plate, disc, ring, text, card, ground_quad, arrow

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/fastfood'
PUBLIC=ROOT/'public/assets/models/environment'
BK.setup('fastfood',OUT/'textures',20260916)

L=BK.Lib()
ASPH=BK.textured('Asphalt','asphalt',.9,3.0,strength=.8)
PAVE=BK.textured('Paving','paving',.78,1.2,strength=.6)
SLATS=BK.textured('Timber slats','slats',.62,1.2,strength=.7)

KFC_RED='#e4002b';DEEP_RED='#a3081c';WHITE='#f5f4f0';CREAM='#ece6da';CHAR='#38393b';BLACK='#141516'
MCD_YELLOW='#ffbc0d';MCD_RED='#db0007';STEEL='#c7cacc';CONC='#c9c6be';GREEN='#3d6b35'

def frustum(name,cx,cz,base,top,r0,r1,m,col,n=24):
    """Vertical tapered tube: radius r0 at y=base, r1 at y=top (the bucket)."""
    verts=[];faces=[]
    for y,r in ((base,r0),(top,r1)):
        for i in range(n):a=2*math.pi*i/n;verts.append(pt(cx+r*math.cos(a),y,cz+r*math.sin(a)))
    for i in range(n):faces.append((i,(i+1)%n,n+(i+1)%n,n+i))
    faces.append(tuple(range(n))[::-1]);faces.append(tuple(n+i for i in range(n)))
    return BK.paint(BK.kit.mesh(name,verts,faces,m,closed=True),col)

def arch_stroke(cx,cy,base,r_out,r_in,n=14):
    pts=[(cx-r_out,base)]
    for i in range(n+1):a=math.pi*(1-i/n);pts.append((cx+r_out*math.cos(a),cy+r_out*math.sin(a)))
    pts.append((cx+r_out,base));pts.append((cx+r_in,base))
    for i in range(n+1):a=math.pi*(i/n);pts.append((cx+r_in*math.cos(a),cy+r_in*math.sin(a)))
    pts.append((cx-r_in,base))
    return pts

def arches(x,base,z,height,thick,m=None,col=MCD_YELLOW):
    """The M: two arch strokes that meet in the middle."""
    r_out=height*.42;r_in=r_out*.55;cy=base+height-r_out
    parts=[loft('arch',[(z,[(x+px,py) for px,py in arch_stroke(s*r_out,cy,base,r_out,r_in)]),(z+thick,[(x+px,py) for px,py in arch_stroke(s*r_out,cy,base,r_out,r_in)])],m or L.SIGN,'fastfood',closed=True) for s in (-1,1)]
    return BK.paint(join(parts,'arches'),col)

def shell(ls,wall_m,wall_col,trim_col):
    """The 14 x 12 x 8.4 body as walls round a real ground-floor room, with the pickup window cut
    into the lane-side wall. Returns the parts and the x of the lane-side wall face."""
    o=[];bx=-ls*2.5;far=bx-ls*7;near=bx+ls*7
    o.append(box('rear wall',bx,4.2,-5.85,14,8.4,.3,wall_m,wall_col,0,grime=.4))
    o.append(box('far wall',far+ls*.15,4.2,0,.3,8.4,12,wall_m,wall_col,0,grime=.4))
    # lane-side wall, with the pickup opening at z -5.6..-4.2, y 1.0..2.4
    nx=near-ls*.15
    o.append(box('lane wall',nx,4.2,.9,.3,8.4,10.2,wall_m,wall_col,0,grime=.4))
    o.append(box('lane wall',nx,.5,-4.9,.3,1.0,1.4,wall_m,wall_col,0,grime=.4))
    o.append(box('lane wall',nx,5.4,-4.9,.3,6.0,1.4,wall_m,wall_col,0,grime=.4))
    o.append(box('lane wall',nx,4.2,-5.8,.3,8.4,.4,wall_m,wall_col,0))
    o.append(box('pickup glass',nx,1.7,-4.9,.04,1.4,1.4,L.GLASS))
    o+=BK.frame('pickup frame',nx+ls*.16,1.7,-4.9,1.4,1.4,.08,.06,L.METAL,'#2c2e30',plane='x')
    o.append(box('pickup sill',nx+ls*.3,1.02,-4.9,.5,.06,1.6,L.METAL,STEEL,.01))
    o.append(box('pickup counter',nx-ls*.6,1.0,-4.9,.9,1.0,1.6,L.METAL,STEEL,.01))
    o.append(ground_quad('pickup pool',near+ls*1.8,.08,-4.9,4,4,L.WASH))
    o.append(box('plinth',bx,.25,0,14.08,.5,12.08,L.PANEL,'#595b5d',0))
    o.append(box('roof',bx,8.3,0,14,.2,12,L.PANEL,'#8a8c8e',0))
    for zz,w,d in ((6.05,14.3,.3),(-6.05,14.3,.3)):o.append(box('parapet cap',bx,8.5,zz,w,.2,d,L.METAL,trim_col,.01))
    for xx in (far,near):o.append(box('parapet cap',xx,8.5,0,.3,.2,12.4,L.METAL,trim_col,.01))
    o.append(box('floor',bx,.52,0,13.4,.04,11.4,L.TILES))
    o.append(box('ceiling',bx,4.15,0,13.4,.1,11.4,L.LED,'#8f9395',0))
    for dx in (-4.5,-1.5,1.5,4.5):
        for z in (-3.5,.5,4.0):o.append(box('ceiling light',bx+dx,4.09,z,1.2,.03,.5,L.LED,'#ffffff',0))
    o.append(ground_quad('dining pool',bx,.55,2.5,12,7,L.WASH))
    # interior lining in the LED material at a low vertex colour: a lit room by day and at night
    o.append(box('lining rear',bx,2.35,-5.68,13.3,3.7,.04,L.LED,'#6f6d68',0))
    o.append(box('lining side',far+ls*.32,2.35,0,.04,3.7,11.3,L.LED,'#6f6d68',0))
    o.append(box('lining side',near-ls*.32,2.35,.78,.04,3.7,9.74,L.LED,'#6f6d68',0))   # stops short of the pickup window
    for dx,dz in ((-3.5,-2),(3.5,-2)):
        o.append(box('roof plant',bx+dx,8.8,dz,2.2,.8,1.4,L.PANEL,'#d6d8d9',.02))
        o.append(cyl('fan',bx+dx,9.21,dz,.45,.02,L.PLASTIC,'#2b2d2f',verts=16))
    return o,bx,near

def interior(ls,bx,menu,seat_col,counter_col):
    """Counter under lit menu boards, stainless kitchen behind, seating by the windows."""
    o=[];cx=bx-ls*1.0
    o.append(box('counter',cx,1.05,-2.4,8.0,1.1,.8,L.PANEL,counter_col,.02))
    o.append(box('counter top',cx,1.63,-2.4,8.2,.06,.95,L.METAL,STEEL,.01))
    for k in range(3):o.append(box('pos',cx-2.5+k*2.5,1.85,-2.5,.35,.35,.3,L.PLASTIC,BLACK,.02))
    for k,dx in enumerate((-1.9,1.9)):
        o.append(box('menu frame',cx+dx,3.3,-3.6,3.9,1.1,.08,L.PLASTIC,BLACK,0))
        o.append(card('menu board',cx+dx,3.3,-3.55,3.7,1.0,L.menu(menu),'+z'))
    for dx in (-3,-1,1,3):
        o.append(box('fryer',cx+dx,1.2,-4.8,1.6,1.3,1.1,L.METAL,STEEL,.02))
        o.append(box('hood',cx+dx,3.6,-5.1,1.8,.6,1.2,L.METAL,'#a9adb0',.02))
    o.append(card('back shelves',cx,2.2,-5.68,6,1.2,L.SHELVES,'+z',u_repeat=5))
    for k,dx in enumerate((-5.2,-2.2,.8,3.8)):
        x=bx-ls*dx*.9
        o.append(box('table',x,1.25,4.2,1.3,.06,.8,L.PANEL,'#efece6',.01))
        o.append(box('table leg',x,.88,4.2,.08,.7,.08,L.METAL,CHAR,0))
        for s in (-1,1):
            o.append(box('bench seat',x+s*.95,.95,4.2,.5,.12,1.5,L.PLASTIC,seat_col,.03))
            o.append(box('bench back',x+s*1.2,1.4,4.2,.12,.9,1.5,L.PLASTIC,seat_col,.03))
        o.append(cyl('pendant',x,3.2,4.2,.18,.2,L.LED,'#ffe2b0',verts=12))
        o.append(box('pendant cord',x,3.7,4.2,.01,.9,.01,L.PLASTIC,BLACK,0))
    return o

def lane(tag,ls,canopy_col,trim_col,menu):
    """Drive-thru lane: asphalt between kerbs, painted arrows and DRIVE THRU, clearance bar at the
    entry, canopied order point with menu boards and speaker, lit at night."""
    o=[];lx=ls*8
    o.append(box('lane',lx,.045,0,5.5,.05,23,ASPH,'#ffffff',0))
    for s in (-1,1):
        o.append(box('lane kerb',lx+s*2.85,.12,0,.25,.2,23,L.PANEL,CONC,.03,grime=.3))
        for k in range(12):o.append(box('kerb paint',lx+s*2.85,.225,-11+k*2,.27,.006,1.0,L.PLASTIC,MCD_YELLOW if k%2 else BLACK,0))
    for z in (7.5,-1.0,-8.5):o.append(arrow('lane arrow',lx,.073,z,2.4,1.0,L.PLASTIC,'#f2efe4','-z'))
    o.append(text('DRIVE THRU',lx,.073,4.2,.55,L.PLASTIC,'#f2efe4',depth=.004,facing='up',width=3.6))
    for z in (-11.4,11.4):o.append(box('lane edge line',lx,.072,z,5.4,.004,.14,L.PLASTIC,'#f2efe4',0))
    # clearance bar at the entry
    for s in (-1,1):o.append(cyl('clearance post',lx+s*2.7,1.95,9.6,.08,3.9,L.METAL,STEEL,verts=10))
    for k in range(7):o.append(box('clearance stripe',lx-2.4+k*.8,3.9,9.6,.8,.16,.16,L.SIGN,MCD_YELLOW if k%2 else BLACK,0))
    o.append(box('clearance sign',lx,3.55,9.6,1.4,.4,.05,L.SIGN,WHITE,0))
    o.append(text('2.2 m',lx,3.55,9.64,.24,L.SIGN,BLACK,depth=.02))
    # order point
    ox=ls*4.85;face='+x' if ls>0 else '-x'
    o.append(box('order canopy',ls*6.6,3.6,1.2,4.6,.22,4.6,L.PANEL,canopy_col,.03))
    o.append(box('order canopy fascia',ls*6.6,3.6,1.2,4.7,.32,4.7,L.SIGN,canopy_col,.02))
    o.append(box('order canopy soffit',ls*6.6,3.46,1.2,4.4,.02,4.4,L.LED,'#a3a7a9',0))
    for z in (0,2.4):o.append(cyl('canopy downlight',ls*7.4,3.44,z,.12,.02,L.LED,'#ffffff',verts=12))
    o.append(ground_quad('order pool',lx,.08,1.2,5,5,L.WASH))
    for dz in (-.8,3.2):o.append(BK.paint(BK.kit.strut('canopy tie',(ls*4.5,5.2,dz),(ls*8.7,3.72,dz),.05,L.METAL),STEEL))
    o.append(box('menu plinth',ox,.35,1.6,.5,.5,2.0,L.PANEL,CONC,.02))
    o.append(box('menu housing',ox,1.8,1.6,.3,2.4,1.9,L.PANEL,CHAR,.02))
    for k,y in enumerate((2.35,1.55)):o.append(card('lane menu',ox+ls*.16,y,1.6,1.6,.8,L.menu(menu),face))
    o.append(box('menu header',ox+ls*.02,3.1,1.6,.34,.3,1.95,L.SIGN,canopy_col,.01))
    o.append(cyl('speaker post',ox,.9,-.4,.06,1.8,L.METAL,STEEL,verts=8))
    o.append(box('speaker',ox,1.55,-.4,.2,.45,.35,L.PLASTIC,CHAR,.02))
    o.append(box('order display',ox+ls*.105,1.62,-.4,.01,.18,.26,L.SIGN,'#9fd8ff',0))
    o.append(box('pickup awning',ls*5.3,2.95,-4.9,1.9,.12,2.6,L.SIGN,canopy_col,.02))
    o.append(text('PICK UP',ls*4.51,2.62,-4.9,.22,L.SIGN,WHITE,depth=.02,facing=face))
    return o

def kfc():
    ls=1;o,bx,near=shell(ls,L.RENDER,WHITE,'#d9d9d6')
    o+=interior(ls,bx,'kfc',KFC_RED,WHITE)
    f=6.0
    # street face: pilaster, glazing, entrance portal, stripe feature at the lane corner
    o.append(box('pilaster',bx-6.75,2.1,f,.5,4.2,.3,L.RENDER,WHITE,0))
    o.append(box('sill wall',bx-2.35,.3,f,8.3,.6,.3,L.PANEL,'#595b5d',0))
    o.append(box('glazing',bx-2.35,2.35,f,8.3,3.5,.04,L.GLASS))
    for k in range(5):o.append(box('mullion',bx-6.5+k*2.075,2.35,f+.03,.08,3.5,.1,L.METAL,'#2c2e30',0))
    o.append(box('window head',bx-2.35,4.13,f+.03,8.4,.06,.12,L.METAL,'#2c2e30',0))
    ex=bx+3.0
    o.append(box('door glass',ex,1.6,f,2.2,3.0,.04,L.GLASS))
    o.append(box('door rail',ex,1.6,f+.03,.06,3.0,.06,L.METAL,'#2c2e30',0))
    o+=BK.frame('portal',ex,1.7,f+.18,2.2,3.2,.3,.36,L.PANEL,KFC_RED)
    o.append(box('above door',ex,3.8,f,2.2,.8,.3,L.RENDER,WHITE,0))
    o.append(box('upper face',bx-1.2,6.3,f,11.6,4.2,.3,L.RENDER,WHITE,0,grime=.2))
    sx=bx+5.8
    o.append(box('stripe panel',sx,4.2,f+.02,2.4,8.4,.34,L.PANEL,WHITE,.01))
    for k in range(3):o.append(box('stripe',sx-.8+k*.8,4.2,f+.2,.4,8.4,.04,L.PANEL,KFC_RED,0))
    o.append(box('brand band',bx-1.2,5.45,f+.2,11.6,1.8,.12,L.SIGN,KFC_RED,.02))
    rx=bx-5.6
    o.append(disc('roundel',rx,5.45,.85,f+.26,.05,L.SIGN,WHITE))
    o.append(disc('roundel red',rx,5.45,.72,f+.31,.03,L.SIGN,KFC_RED))
    o.append(text('KFC',rx,5.45,f+.35,.46,L.SIGN,WHITE,depth=.03))
    o.append(text('KFC',bx,5.45,f+.27,1.4,L.SIGN,WHITE,depth=.12))
    o.append(box('canopy over glazing',bx-2.35,4.35,f+.6,8.6,.12,1.2,L.LED,'#8e9294',.01))
    for dx in (-5.5,-2.35,.8):o.append(cyl('glazing downlight',bx+dx,4.28,f+.8,.1,.02,L.LED,'#ffffff',verts=10))
    o.append(ground_quad('front pool',bx-1,.06,f+1.8,13,3.5,L.WASH))
    # lane-side lettering
    o.append(box('lane side band',near+.02,6.1,0,.12,1.3,9.0,L.SIGN,KFC_RED,.01))
    o.append(text('DRIVE THRU',near+.1,6.1,0,.72,L.SIGN,WHITE,depth=.05,facing='+x'))
    # apron, planters, bucket on its pole sign
    o.append(box('apron',bx,.02,f+1.4,14.6,.04,2.8,PAVE,'#ffffff',0))
    for dx in (-6.4,-3.6):
        o.append(box('planter',bx+dx,.4,8.7,2.2,.8,1.0,L.PANEL,CONC,.04,grime=.3))
        o.append(box('shrub',bx+dx,.95,8.7,1.9,.4,.8,L.PLASTIC,GREEN,.15))
    px,pz=bx-8.4,9.4
    o.append(cyl('sign pole',px,5.0,pz,.26,10,L.PANEL,KFC_RED,verts=16))
    o.append(box('sign base',px,.4,pz,1.2,.8,1.2,L.PANEL,CONC,.03))
    o.append(frustum('bucket',px,pz,10.0,12.6,1.3,1.7,L.SIGN,WHITE))
    for i in range(0,16,2):
        a=2*math.pi*(i+.5)/16;r=1.52
        o.append(box('bucket stripe',px+r*math.cos(a),11.3,pz+r*math.sin(a),.5,2.62,.06,L.SIGN,KFC_RED,0,ry=math.atan2(-math.cos(a),-math.sin(a))))
    o.append(frustum('bucket rim',px,pz,12.6,12.9,1.72,1.8,L.SIGN,KFC_RED));o.append(frustum('bucket foot',px,pz,9.85,10.05,1.25,1.3,L.SIGN,KFC_RED))
    o.append(disc('bucket roundel',px,11.35,.78,pz+1.62,.05,L.SIGN,WHITE));o.append(disc('bucket roundel red',px,11.35,.64,pz+1.67,.03,L.SIGN,KFC_RED))
    o.append(text('KFC',px,11.35,pz+1.71,.44,L.SIGN,WHITE,depth=.03))
    o.append(box('drive thru plate',px,8.0,pz+.3,2.6,.7,.12,L.SIGN,KFC_RED,.02))
    o.append(text('DRIVE THRU',px,8.0,pz+.37,.3,L.SIGN,WHITE,depth=.03))
    o.append(ground_quad('pole pool',px,.06,pz,3,3,L.WASH))
    return o+lane('kfc',ls,KFC_RED,DEEP_RED,'kfc')

def mcd():
    ls=-1;o,bx,near=shell(ls,L.PANEL,'#5a5d61','#2a2b2d')
    o+=interior(ls,bx,'mcd','#b5813f','#3a3b3d')
    f=6.0
    # brow blade at the lane corner, carrying the arches over the roof
    cx=bx+ls*5.9
    o.append(box('brow blade',cx,5.6,f+.05,2.2,11.2,.5,L.PANEL,MCD_YELLOW,.04))
    o.append(box('brow return',near+ls*.15,5.6,5.4,.3,11.2,1.6,L.PANEL,MCD_YELLOW,.04))
    o.append(arches(cx,9.0,f+.1,2.9,.45))
    ex=bx+ls*3.6
    o.append(box('door glass',ex,1.6,f,2.4,3.0,.04,L.GLASS))
    o.append(box('door rail',ex,1.6,f+.03,.06,3.0,.06,L.METAL,'#2c2e30',0))
    o+=BK.frame('door frame',ex,1.6,f+.04,2.4,3.0,.1,.1,L.METAL,'#2c2e30')
    o.append(box('above door',ex,3.7,f,2.4,1.0,.3,L.PANEL,'#5a5d61',0))
    o.append(box('entrance canopy',ex,3.9,f+1.0,3.2,.16,2.0,L.PANEL,'#2a2b2d',.02))
    o.append(box('canopy lip',ex,3.84,f+1.98,3.2,.1,.08,L.SIGN,MCD_YELLOW,0))
    o.append(cyl('canopy downlight',ex,3.8,f+1.0,.12,.02,L.LED,'#ffffff',verts=12))
    wx0,wx1=bx+ls*2.3,bx-ls*2.9
    wc=(wx0+wx1)/2;ww=abs(wx1-wx0)
    o.append(box('sill wall',wc,.3,f,ww,.6,.3,L.PANEL,'#2a2b2d',0))
    o.append(box('glazing',wc,2.35,f,ww,3.5,.04,L.GLASS))
    for k in range(4):o.append(box('mullion',wx0-ls*k*ww/3,2.35,f+.03,.08,3.5,.1,L.METAL,'#1f2022',0))
    o.append(box('upper face',bx-ls*.1,6.3,f,9.8,4.2,.3,L.PANEL,'#5a5d61',0))
    o.append(box('eyebrow',wc,4.7,f+.2,ww+.4,.9,.18,L.SIGN,'#2a2b2d',.02))
    o.append(text("McDonald's",wc,4.72,f+.3,.6,L.SIGN,WHITE,depth=.06,width=ww-.6))
    # McCafe wing: timber slats, its own window and lettering
    mx=bx-ls*5.0
    o.append(box('mccafe slats',mx,4.2,f+.02,4.0,8.4,.34,SLATS,'#ffffff',0))
    o.append(box('mccafe window',mx,1.9,f+.2,2.6,2.6,.04,L.GLASS))
    o+=BK.frame('mccafe frame',mx,1.9,f+.22,2.6,2.6,.1,.06,L.METAL,'#1f2022')
    o.append(box('mccafe band',mx,6.7,f+.22,3.6,.8,.1,L.SIGN,'#3a2a20',.01))
    o.append(text('McCafe',mx,6.72,f+.28,.4,L.SIGN,WHITE,depth=.03))
    o.append(arches(mx,7.35,f+.2,.7,.05))
    o.append(ground_quad('front pool',bx,.06,f+1.8,13,3.5,L.WASH))
    o.append(box('lane side band',near-.02,6.1,0,.12,1.3,9.0,L.SIGN,'#2a2b2d',.01))
    o.append(text('Drive-Thru',near-.1,6.1,0,.72,L.SIGN,MCD_YELLOW,depth=.05,facing='-x'))
    o.append(box('apron',bx,.02,f+1.4,14.6,.04,2.8,PAVE,'#ffffff',0))
    # outdoor tables in front of the McCafe wing
    for dx in (-1.2,1.2):
        x=mx+dx
        o.append(cyl('table top',x,.76,8.5,.5,.05,L.PANEL,WHITE,verts=20));o.append(cyl('table leg',x,.4,8.5,.05,.7,L.METAL,CHAR,verts=8))
        for s in (-1,1):o.append(box('seat',x+s*.9,.45,8.5,.42,.06,.42,L.PLASTIC,MCD_RED,.01))
    # pole sign: red panel, arches both faces, Drive-Thru plate
    px,pz=bx-ls*8.4,9.6
    o.append(cyl('pole',px,5.0,pz,.22,10,L.PANEL,CHAR,verts=16));o.append(box('pole base',px,.4,pz,1.2,.8,1.2,L.PANEL,CONC,.03))
    o.append(box('sign panel',px,10.6,pz,3.2,3.4,.36,L.SIGN,MCD_RED,.1))
    o.append(arches(px,9.4,pz+.19,2.4,.12));o.append(arches(px,9.4,pz-.31,2.4,.12))
    o.append(box('drive thru plate',px,8.35,pz,2.6,.6,.3,L.SIGN,MCD_YELLOW,.03))
    o.append(text('Drive-Thru',px,8.35,pz+.16,.28,L.SIGN,BLACK,depth=.02))
    o.append(ground_quad('pole pool',px,.06,pz,3,3,L.WASH))
    return o+lane('mcd',ls,MCD_YELLOW,CHAR,'mcd')

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    roots=[]
    for tag,maker in (('kfc',kfc),('mcd',mcd)):
        root=bpy.data.objects.new(tag,None);s.collection.objects.link(root);BK.finalize(root,maker());roots.append(root)
    return roots

if __name__=='__main__':
    roots=build();path=PUBLIC/'LM_ENV_DriveThrough.glb'
    report=BK.export(roots,path,{'asset':'LM_ENV_DriveThrough','origins':{'kfc':[105,0,60],'mcd':[129,0,60]},
        'body':{'size':[14,8.4,12],'x':'-laneSide*2.5'},'lane':{'x':'laneSide*8','width':5.5,'length':23}})
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('FASTFOOD WEB EXPORT',json.dumps(report),flush=True)
