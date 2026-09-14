"""The seven branded shoplots of the mamak neighbourhood, photographic pass (shared/mamak-shops.json):
ZUS Coffee, Watsons, 7-Eleven, FamilyMart, KK Super Mart, Bengkel Azlan and Warung Kak Ana.

Every one is a two-storey Malaysian shoplot on the registry's footprint (width x 11 x 12, ground
origin, street face at z +6): painted render with splash-back grime, upper windows with aluminium
frames and air-conditioner condensers on brackets, a cornice and parapet with the water tank
behind it, and a ground floor that is a real room behind the glass: tiled floor, lit ceiling,
stocked shelving, counters and fittings, so the shop reads as open and at night glows from inside.
Each front is the brand's own in its recognisable colours and shapes, all geometry: ZUS navy and
white, Watsons teal with the cross, the 7-Eleven stripes and plaque, FamilyMart green, white and
blue, KK red, a working bengkel behind roller shutters with a two-post lift, tyres and oil stains,
and a warung with a zinc awning over its bain-marie of lauk. No downloaded logos.

The game keeps its colliders, map footprint, ZUS pavement tables and chairs, and hides the whole
procedural fallback when a GLB arrives (src/mamak-shops.ts), so all lettering is baked here.
Night: 'Night ...' materials are driven by src/brands.ts (see brand_kit.py).

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_shops.py [-- LM_SHOP_Watsons ...]
for f in public/assets/models/shops/LM_SHOP_*.glb; do node scripts/blender/compress-glb.mjs $f; done

Output: public/assets/models/shops/LM_SHOP_<Name>.glb, one root node named for the asset.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt, join, loft, rounded
import brand_kit as BK
from brand_kit import box, cyl, plate, disc, ring, text, card, ground_quad, frame

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/shops'
PUBLIC=ROOT/'public/assets/models/shops'
SHOPS={s['asset']:s for s in json.loads((ROOT/'shared/mamak-shops.json').read_text())}
ONLY=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
BK.setup('shops',OUT/'textures',20260917)

L=BK.Lib()
X={}
def SHUTTER():return X.setdefault('shutter',BK.textured('Roller shutter','shutter',.55,.5,metal=.35,strength=.8))
def WORKSHOP():return X.setdefault('workshop',BK.textured('Workshop floor','workshop_floor',.7,4.0,strength=.6))
def ZINC():return X.setdefault('zinc',BK.textured('Zinc sheet','zinc',.5,.8,metal=.3,strength=.9,two_sided=True))

WHITE='#f6f5f1';ALU='#d9dbdc';DARK='#2b2d30';BLACK='#141516';STEEL='#c7cacc';LINING='#77756f'

# ------------------------------------------------------------------ the shoplot
def shoplot(o,w,wall,trim,windows=3,frame_col=ALU,ac=(0,2),lining=LINING):
    """Walls, upper facade, cornice, parapet, roof and the ground-floor room (z 0..5.8)."""
    hw=w/2;LINING=lining
    for s in (-1,1):o.append(box('party wall',s*(hw-.15),5.6,0,.3,11.2,12,L.RENDER,wall,0,grime=.5))
    o.append(box('rear wall',0,5.6,-5.85,w-.6,11.2,.3,L.RENDER,wall,0,grime=.4))
    o.append(box('roof',0,10.5,0,w-.6,.2,11.4,L.PANEL,'#8b8d8f',0))
    # the room behind the glass: tiles, lit ceiling, lined walls that glow a little at night
    o.append(box('floor',0,.08,2.9,w-.6,.16,5.8,L.TILES))
    o.append(box('ceiling',0,3.9,2.9,w-.6,.1,5.8,L.LED,'#8f9395',0))
    o.append(box('room back',0,2.0,.1,w-.6,3.8,.2,L.LED,LINING,0))
    for s in (-1,1):o.append(box('room side',s*(hw-.32),2.0,2.9,.04,3.8,5.8,L.LED,LINING,0))
    o.append(box('store room',0,2.0,-2.9,w-.6,3.8,5.8,L.RENDER,wall,0))
    o.append(ground_quad('room pool',0,.17,3.4,w-2,5,L.WASH))
    o.append(ground_quad('pavement pool',0,.03,7.6,w,3.6,L.WASH))
    # beam and upper storey
    o.append(box('first floor beam',0,4.35,5.85,w,.9,.3,L.PANEL,trim,0))
    o.append(box('upper wall',0,7.6,5.85,w,5.6,.3,L.RENDER,wall,0,grime=.15))
    pitch=w/windows
    for i in range(windows):
        x=-hw+pitch*(i+.5)
        o.append(box('upper glass',x,7.7,6.02,2.6,1.9,.03,L.DARKGLASS))
        o+=frame('upper frame',x,7.7,6.04,2.6,1.9,.08,.08,L.METAL,frame_col)
        o.append(box('upper mullion',x,7.7,6.04,.06,1.9,.07,L.METAL,frame_col))
        o.append(box('upper transom',x,8.2,6.04,2.6,.05,.07,L.METAL,frame_col))
        o.append(box('sill',x,6.64,6.12,2.9,.08,.3,L.PANEL,WHITE,.01))
        if i==1:   # someone's upstairs: a curtained room that glows warm after dark
            o.append(box('upstairs room',x,7.7,6.006,2.5,1.8,.012,L.LED,'#4a3c2c'))
        if i in ac:
            ax=x+.6
            o.append(box('ac condenser',ax,6.0,6.35,1.0,.62,.45,L.PANEL,'#e7e7e2',.02))
            o.append(cyl('ac fan',ax-.15,6.0,6.58,.22,.02,L.PLASTIC,'#3b3d40',axis='z',verts=16))
            for dx in (-.35,.35):o.append(box('ac bracket',ax+dx,5.66,6.3,.04,.05,.6,L.METAL,'#5c6064'))
            o.append(box('ac pipe',ax+.52,6.4,6.1,.04,.9,.04,L.PLASTIC,'#efefe9'))
    o.append(box('cornice',0,10.6,6.05,w+.2,.18,.5,L.PANEL,trim,.02))
    o.append(box('parapet',0,11.0,5.85,w,.65,.3,L.RENDER,wall,0))
    o.append(box('parapet cap',0,11.38,5.85,w+.1,.1,.42,L.PANEL,trim,.01))
    o.append(box('downpipe',hw-.25,5.6,6.1,.12,11.0,.12,L.PLASTIC,'#d8d6cf'))
    o.append(cyl('water tank',-hw+2.4,11.3,-3.2,.8,1.4,L.PLASTIC,'#2f5f9c',verts=16))
    o.append(box('tank stand',-hw+2.4,10.7,-3.2,1.8,.2,1.8,L.METAL,'#6b6f73'))
    return o

def glazed_front(o,w,frame_col,door=(0,2.2),head=3.85,panes=2.3):
    """Full-width glazing at z 5.8 with an anodised frame, mullions and a sliding door."""
    hw=w/2-.3;dx,dw=door
    o.append(box('shop glass',0,(head+.2)/2,5.8,w-.6,head-.2,.04,L.GLASS))
    o.append(box('glass head',0,head,5.84,w-.6,.12,.14,L.METAL,frame_col))
    o.append(box('glass sill',0,.2,5.84,w-.6,.1,.14,L.METAL,frame_col))
    n=max(2,round((w-.6)/panes))
    for k in range(n+1):
        x=-hw+k*(w-.6)/n
        if abs(x-dx)<dw/2+.2:continue
        o.append(box('mullion',x,(head+.2)/2,5.84,.08,head-.2,.12,L.METAL,frame_col))
    for s in (-1,1):o.append(box('door jamb',dx+s*dw/2,(head+.2)/2,5.84,.1,head-.2,.14,L.METAL,frame_col))
    o.append(box('door transom',dx,3.05,5.84,dw,.08,.12,L.METAL,frame_col))
    o.append(box('door meeting rail',dx,1.6,5.86,.05,2.8,.05,L.METAL,frame_col))
    for s in (-1,1):o.append(box('door handle',dx+s*.12,1.3,5.9,.03,.5,.03,L.METAL,STEEL))
    o.append(box('door mat',dx,.17,5.3,dw,.02,.8,L.RUBBER,'#2d2f31'))

def canopy(o,w,col='#ffffff',soffit='#8e9294',depth=1.4,y=3.95):
    o.append(box('canopy',0,y,6+depth/2,w,.14,depth,L.PANEL,col,.01))
    o.append(box('canopy soffit',0,y-.08,6+depth/2,w-.1,.02,depth-.1,L.LED,soffit))
    for k in range(int(w//3)):o.append(cyl('downlight',-w/2+1.5+k*3,y-.1,6+depth*.55,.08,.02,L.LED,'#ffffff',verts=10))

def fascia(o,w,col,y0=4.0,y1=5.35,depth=.36,z=6.0):
    """A projecting lightbox signboard across the front."""
    o.append(box('fascia',0,(y0+y1)/2,z+depth/2,w,y1-y0,depth,L.SIGN,col,.02))
    return z+depth

def shelving(o,w,header,gondolas=2):
    """Convenience-store fit-out: stocked back wall, gondolas, a chiller along one side wall."""
    hw=w/2-.35
    o.append(box('wall shelving',0,1.3,.5,w-1.4,2.3,.6,L.PANEL,'#dcdedf'))
    o.append(card('wall stock',0,1.3,.81,w-1.6,2.1,L.SHELVES,'+z',u_repeat=(w-1.6)/1.2))
    o.append(box('wall header',0,2.7,.82,w-1.4,.35,.04,L.SIGN,header))
    for k in range(gondolas):
        z=2.0+k*1.6;gw=w*.36
        for s in (-1,1):
            gx=s*w*.2
            o.append(box('gondola',gx,.85,z,gw,1.4,.6,L.PANEL,'#dcdedf',.01))
            o.append(card('gondola stock',gx,.85,z+.31,gw-.2,1.25,L.SHELVES,'+z',u_repeat=(gw-.2)/1.2))
            o.append(card('gondola stock',gx,.85,z-.31,gw-.2,1.25,L.SHELVES,'-z',u_repeat=(gw-.2)/1.2))
            o.append(box('gondola header',gx,1.65,z,gw,.22,.64,L.SIGN,header))
    o.append(box('chiller',-hw+.35,1.3,3.2,.7,2.4,4.0,L.PANEL,'#e2e3e4'))
    o.append(card('chiller stock',-hw+.71,1.25,3.2,3.8,2.0,L.SHELVES,'+x',u_repeat=3.2))
    o.append(box('chiller doors',-hw+.73,1.25,3.2,.03,2.1,3.9,L.GLASS))

def counter(o,x,z,w,col,top=STEEL):
    o.append(box('counter',x,.62,z,w,.95,.7,L.PANEL,col,.02))
    o.append(box('counter top',x,1.12,z,w+.1,.05,.8,L.METAL,top,.01))
    o.append(box('register',x-w*.25,1.32,z,.4,.34,.34,L.PLASTIC,BLACK,.02))

# ------------------------------------------------------------------ brands
def zus(shop):
    """ZUS Coffee: navy band with the italic white wordmark, a white round-cornered surround on the
    glazing, the navy medallion panel, timber and white counter under a lit menu, blue chairs."""
    o=[];w=shop['width'];NAVY='#1b31a0';DEEP='#101d63';SKY='#7d9be0'
    shoplot(o,w,'#eef0f4',NAVY,frame_col=NAVY)
    z=fascia(o,w,NAVY,4.0,5.45)
    o.append(text('ZUS COFFEE',-1.2,4.72,z+.01,1.05,L.SIGN,WHITE,depth=.08,kind='italic',width=w-6))
    o.append(box('fascia underline',0,4.06,z,w,.06,.03,L.SIGN,SKY))
    # glazing behind a white surround with rounded top corners, navy medallion panel to the right
    x0,x1=-w/2+.3,3.7
    o.append(box('shop glass',(x0+x1)/2,1.95,5.8,x1-x0,3.6,.04,L.GLASS))
    o.append(box('surround top',(x0+x1)/2,3.78,5.95,x1-x0,.35,.3,L.PANEL,WHITE,.02))
    for x in (x0+.17,x1-.17):o.append(box('surround side',x,1.95,5.95,.35,3.9,.3,L.PANEL,WHITE,.02))
    for x,s in ((x0+.35,1),(x1-.35,-1)):   # rounded inner corners of the surround
        quarter=[(x,3.6),(x,3.0)]+[(x+s*(.6-.6*math.cos(a*math.pi/12)),3.0+.6*math.sin(a*math.pi/12)) for a in range(7)][1:]
        o.append(plate('surround corner',quarter if s<0 else quarter[::-1],5.8,.3,L.PANEL,WHITE))
    for k in range(1,4):o.append(box('mullion',x0+k*(x1-x0)/4,1.9,5.84,.06,3.4,.08,L.METAL,WHITE))
    o.append(box('door rail',-1.0,1.6,5.86,.05,2.8,.05,L.METAL,WHITE))
    o.append(box('medallion panel',(x1+w/2-.3)/2,1.98,5.95,w/2-.3-x1,3.95,.3,L.PANEL,NAVY,.02))
    mx=(x1+w/2-.3)/2
    o.append(ring('medallion ring',mx,2.1,1.2,1.04,6.11,.04,L.SIGN,WHITE))
    o.append(ring('medallion inner ring',mx,2.1,.9,.86,6.11,.03,L.SIGN,WHITE))
    o.append(text('ZUS',mx,2.12,6.13,.62,L.SIGN,WHITE,depth=.05,kind='italic'))
    o.append(text('COFFEE',mx,1.58,6.13,.16,L.SIGN,WHITE,depth=.02,spacing=1.4))
    o.append(box('pavement step',0,.08,6.1,w,.16,.3,L.PANEL,'#cfcdc6'))
    # inside: timber-fronted counter, espresso machine, cups, menu boards, pendants, blue chairs
    o.append(box('counter',-2.5,.62,1.9,8.0,.95,.8,L.PANEL,'#b98b5c',.02))
    o.append(box('counter top',-2.5,1.12,1.9,8.2,.06,.9,L.PANEL,WHITE,.01))
    o.append(box('espresso machine',-5.0,1.45,1.8,1.3,.6,.55,L.METAL,STEEL,.03))
    o.append(box('machine crown',-5.0,1.8,1.8,1.35,.08,.6,L.PLASTIC,NAVY))
    for k in range(6):
        o.append(cyl('cup',-3.6+k*.32,1.28,2.05,.08,.24,L.PLASTIC,WHITE,verts=10))
        o.append(cyl('lid',-3.6+k*.32,1.42,2.05,.085,.03,L.PLASTIC,NAVY,verts=10))
    o.append(box('pastry case',0,1.4,1.9,2.2,.55,.7,L.GLASS))
    for k in range(3):o.append(card('menu',-6.2+k*3.1,2.95,.21,2.8,1.4,L.menu('zus'),'+z'))
    o.append(box('menu wall',-3.1,2.95,.2,9.6,1.7,.02,L.PANEL,DEEP))
    for x in (-6.5,-3.5,-.5,2.5):
        o.append(cyl('pendant',x,3.3,3.6,.2,.16,L.LED,'#ffe2b0',verts=14));o.append(box('pendant cord',x,3.62,3.6,.01,.5,.01,L.PLASTIC,BLACK))
    for tx in (-6.5,-3.5,-.5,2.3):
        o.append(cyl('table',tx,.92,4.3,.45,.05,L.PANEL,WHITE,verts=18));o.append(cyl('table leg',tx,.54,4.3,.04,.72,L.METAL,DARK,verts=8))
        for s in (-1,1):
            o.append(box('chair seat',tx+s*.72,.62,4.3,.42,.05,.42,L.PLASTIC,NAVY,.01))
            o.append(box('chair back',tx+s*.93,.9,4.3,.05,.5,.42,L.PLASTIC,NAVY,.01))
    o.append(box('right wall',w/2-.33,2.0,2.9,.03,3.8,5.6,L.LED,'#2a3570'))
    canopy(o,w,NAVY,'#56608f',1.0,4.0)
    return o

def watsons(shop):
    """Watsons: teal lightbox with the lowercase white wordmark and the pharmacy cross, glazed front
    with sliding doors, a bright white store of wall bays, gondolas and a pharmacy counter."""
    o=[];w=shop['width'];TEAL='#00a58f';DEEP='#087565'
    shoplot(o,w,'#e9eae4',TEAL,frame_col=WHITE)
    z=fascia(o,w,TEAL,4.0,5.45)
    o.append(text('watsons',-.9,4.74,z+.01,1.15,L.SIGN,WHITE,depth=.08,kind='rounded',width=w-7))
    cx=w/2-1.6;a,b=.5,.17
    o.append(plate('cross',[(cx-b,4.72-a),(cx+b,4.72-a),(cx+b,4.72-b),(cx+a,4.72-b),(cx+a,4.72+b),(cx+b,4.72+b),(cx+b,4.72+a),(cx-b,4.72+a),(cx-b,4.72+b),(cx-a,4.72+b),(cx-a,4.72-b),(cx-b,4.72-b)][::-1],z,.06,L.SIGN,WHITE))
    glazed_front(o,w,WHITE,door=(0,3.2))
    o.append(box('door header',0,3.45,5.9,3.3,.35,.08,L.SIGN,TEAL))
    o.append(box('sill band',0,.45,5.9,w-.6,.5,.06,L.PANEL,DEEP))
    o.append(text('HEALTH  ·  BEAUTY  ·  PHARMACY',-4.8,.45,5.94,.2,L.SIGN,WHITE,depth=.02,width=5.2))
    o.append(text('HEALTH  ·  BEAUTY  ·  PHARMACY',4.8,.45,5.94,.2,L.SIGN,WHITE,depth=.02,width=5.2))
    for s in (-1,1):o.append(box('window poster',s*5.5,1.7,5.7,2.6,1.6,.03,L.SIGN,'#f2a4b3' if s<0 else '#8fd6ca'))
    shelving(o,w,TEAL)
    o.append(box('pharmacy counter',4.8,.62,1.5,4.2,.95,.7,L.PANEL,'#c9a57a',.02))
    o.append(box('pharmacy top',4.8,1.12,1.5,4.3,.05,.8,L.PANEL,WHITE))
    o.append(plate('pharmacy cross',[(4.8-.12,3.0-.36),(4.8+.12,3.0-.36),(4.8+.12,3.0-.12),(4.8+.36,3.0-.12),(4.8+.36,3.0+.12),(4.8+.12,3.0+.12),(4.8+.12,3.0+.36),(4.8-.12,3.0+.36),(4.8-.12,3.0+.12),(4.8-.36,3.0+.12),(4.8-.36,3.0-.12),(4.8-.12,3.0-.12)][::-1],.84,.04,L.SIGN,'#39d18a'))
    counter(o,-4.2,4.6,2.6,WHITE)
    o.append(cyl('beauty island',1.8,.45,4.4,.9,.8,L.PANEL,'#d9b48b',verts=18));o.append(cyl('island top',1.8,.88,4.4,.95,.06,L.PANEL,WHITE,verts=18))
    canopy(o,w,WHITE,'#7fbfb4',1.3)
    return o

def seven(shop):
    """7-Eleven: white fascia over the orange, red and green stripes, the logo plaque with its big
    7, glazed front onto shelves, the Slurpee machine and a 7CAFE counter."""
    o=[];w=shop['width'];GREEN='#008061';ORANGE='#f58220';RED='#ee2e24'
    shoplot(o,w,'#f2f0e8',GREEN,frame_col=ALU)
    z=fascia(o,w,WHITE,4.55,5.5)
    for y,col in ((4.43,ORANGE),(4.23,RED),(4.03,GREEN)):o.append(box('stripe',0,y,6.18,w,.2,.36,L.SIGN,col))
    px=-w/2+1.7
    o.append(box('plaque',px,4.75,z+.06,2.2,2.2,.12,L.SIGN,WHITE,.05))
    o.append(box('plaque edge',px,4.75,z+.03,2.36,2.36,.06,L.SIGN,GREEN,.04))
    o.append(text('7',px+.08,4.82,z+.13,2.3,L.SIGN,GREEN,depth=.04))
    o.append(text('7',px+.02,4.84,z+.17,2.05,L.SIGN,ORANGE,depth=.04))
    o.append(box('plaque band',px,4.5,z+.2,2.1,.42,.02,L.SIGN,WHITE))
    o.append(text('ELEVEn',px,4.5,z+.22,.36,L.SIGN,RED,depth=.03,width=1.9))
    o.append(text('7-ELEVEN',1.2,5.02,z+.01,.62,L.SIGN,GREEN,depth=.06,width=w-7))
    glazed_front(o,w,ALU,door=(-1.0,2.3))
    o.append(text('OPEN 24 HOURS',-1.0,3.45,5.9,.2,L.SIGN,GREEN,depth=.02))
    shelving(o,w,GREEN)
    # Slurpee machine by the window, 7CAFE coffee counter, Fresh to Go chiller
    sx=w/2-2.6
    o.append(box('slurpee cabinet',sx,.8,4.9,2.4,1.2,.6,L.PANEL,WHITE,.02))
    for k,col in enumerate(('#e0413c','#3aa0dd','#8b5fc0','#f2c230')):
        o.append(box('slurpee tank',sx-.84+k*.56,1.75,4.95,.44,.7,.4,L.SIGN,col,.03))
    o.append(box('slurpee header',sx,2.35,4.9,2.4,.4,.5,L.SIGN,GREEN,.02))
    o.append(text('SLURPEE',sx,2.35,5.16,.24,L.SIGN,WHITE,depth=.02))
    counter(o,-w/2+3.0,4.6,2.8,'#3b2a20',STEEL)
    o.append(box('cafe header',-w/2+3.0,2.5,4.95,2.8,.45,.06,L.SIGN,'#3b2a20'))
    o.append(text('7CAFE',-w/2+3.0,2.5,5.0,.28,L.SIGN,ORANGE,depth=.02))
    canopy(o,w,WHITE,'#8e9294',1.2)
    return o

def family(shop):
    """FamilyMart: white fascia with the green and blue wordmark over green, white and blue
    stripes, glazed front, shelves, and the Sofuto soft-serve counter."""
    o=[];w=shop['width'];GREEN='#159447';BLUE='#1674be'
    shoplot(o,w,'#f4f4ec',GREEN,windows=4,ac=(1,3))
    z=fascia(o,w,WHITE,4.6,5.55)
    for y,col in ((4.48,GREEN),(4.28,WHITE),(4.08,BLUE)):o.append(box('stripe',0,y,6.18,w,.2,.36,L.SIGN,col))
    o.append(text('Family',.35,5.07,z+.01,.8,L.SIGN,GREEN,depth=.07,align='RIGHT'))
    o.append(text('Mart',.38,5.07,z+.01,.8,L.SIGN,BLUE,depth=.07,align='LEFT'))
    glazed_front(o,w,ALU,door=(2.5,2.4))
    shelving(o,w,BLUE)
    counter(o,-w/2+3.2,4.6,3.2,WHITE)
    o.append(box('sofuto machine',w/2-2.2,1.55,4.8,1.1,.9,.6,L.METAL,STEEL,.03))
    o.append(box('sofuto board',w/2-2.2,2.6,5.0,1.8,.55,.06,L.SIGN,GREEN,.01))
    o.append(text('SOFUTO',w/2-2.2,2.6,5.05,.26,L.SIGN,WHITE,depth=.02))
    o.append(box('sofuto counter',w/2-2.2,.62,4.8,2.2,.95,.7,L.PANEL,BLUE,.02))
    canopy(o,w,WHITE,'#8e9294',1.2)
    return o

def market(shop):
    """KK Super Mart: red lightbox with white lettering and a yellow keyline, glazed front, shelves."""
    o=[];w=shop['width'];RED='#c92536';YELLOW='#f5c21b'
    shoplot(o,w,'#f1ece1',RED,ac=(1,))
    z=fascia(o,w,RED,4.0,5.45)
    o.append(text('KK SUPER MART',0,4.76,z+.01,.82,L.SIGN,WHITE,depth=.07,width=w-3))
    o.append(box('keyline',0,4.12,z+.005,w-.6,.07,.02,L.SIGN,YELLOW))
    glazed_front(o,w,ALU,door=(3.2,2.3))
    o.append(box('sill band',0,.45,5.9,w-.6,.5,.06,L.PANEL,RED))
    o.append(text('BARANGAN KEPERLUAN HARIAN',-2.5,.45,5.94,.22,L.SIGN,WHITE,depth=.02,width=8))
    shelving(o,w,RED)
    counter(o,-w/2+3,4.6,3.0,RED)
    for k in range(3):o.append(box('basket',w/2-2.2,.3+k*.2,5.0,.55,.2,.4,L.PLASTIC,RED,.02))
    canopy(o,w,WHITE,'#8e9294',1.2)
    return o

def workshop(shop):
    """Bengkel Azlan: painted signboard lit by gooseneck lamps, one bay open under its rolled
    shutter and one half down, an oil-stained floor with a two-post lift, tyre stacks and racks,
    tool chest, drums, compressor and workbench under fluorescent tubes."""
    o=[];w=shop['width'];ORANGE='#e07b1f';GREY='#3f4448';FL=WORKSHOP();SH=SHUTTER()
    hw=w/2
    for s in (-1,1):o.append(box('party wall',s*(hw-.15),5.6,0,.3,11.2,12,L.RENDER,'#e6dccb',0,grime=.8))
    o.append(box('rear wall',0,5.6,-5.85,w-.6,11.2,.3,L.RENDER,'#e6dccb',0,grime=.6))
    o.append(box('roof',0,10.5,0,w-.6,.2,11.4,L.PANEL,'#8b8d8f',0))
    o.append(box('workshop floor',0,.06,2.9,w-.6,.12,5.8,FL))
    o.append(box('apron',0,.02,7.2,w,.04,2.4,FL))
    o.append(box('ceiling',0,3.95,2.9,w-.6,.1,5.8,L.PANEL,'#6b6d6f',0))
    o.append(box('back wall',0,2.0,.1,w-.6,3.8,.2,L.RENDER,'#d9cfbd',0,grime=.9))
    for s in (-1,1):o.append(box('bay side',s*(hw-.32),2.0,2.9,.04,3.8,5.8,L.RENDER,'#d9cfbd',0,grime=.9))
    o.append(box('store room',0,2.0,-2.9,w-.6,3.8,5.8,L.RENDER,'#e6dccb',0))
    for x in (-5,0,5):o.append(box('tube light',x,3.86,3.0,1.2,.05,.1,L.LED,'#ffffff'))
    o.append(ground_quad('bay pool',-2,.13,3.2,12,5,L.WASH));o.append(ground_quad('apron pool',0,.05,7.4,w,3,L.WASH))
    # front: pier between bays, shutter boxes, left bay open, right bay half down
    o.append(box('pier',3.0,2.0,5.9,.6,4.0,.3,L.RENDER,'#e6dccb',0,grime=.9))
    o.append(box('shutter box',-2.95,3.75,5.85,11.9,.5,.5,L.METAL,'#8f969b'))
    o.append(box('shutter box',6.15,3.75,5.85,5.7,.5,.5,L.METAL,'#8f969b'))
    o.append(box('rolled shutter',-2.95,3.52,5.95,11.8,.12,.05,SH))
    o.append(box('half shutter',6.15,2.55,5.9,5.6,2.0,.05,SH,'#e8e8e8'))
    o.append(box('shutter bottom bar',6.15,1.55,5.93,5.6,.08,.08,L.METAL,'#5c6064'))
    for x in (-8.85,2.65,3.35,8.85):o.append(box('shutter guide',x,1.9,5.92,.1,3.6,.12,L.METAL,'#7d8387'))
    # upper storey and signboard
    o.append(box('first floor beam',0,4.35,5.85,w,.9,.3,L.PANEL,GREY,0))
    o.append(box('upper wall',0,7.6,5.85,w,5.6,.3,L.RENDER,'#e6dccb',0,grime=.4))
    for i,x in enumerate((-6,0,6)):
        o.append(box('upper glass',x,7.7,6.02,2.6,1.9,.03,L.DARKGLASS))
        o+=frame('upper frame',x,7.7,6.04,2.6,1.9,.08,.08,L.METAL,'#b0b3b5')
        o.append(box('window grille',x,7.7,6.1,2.6,.05,.04,L.METAL,'#4a4e52'))
        for k in range(6):o.append(box('grille bar',x-1.1+k*.44,7.7,6.1,.03,1.9,.03,L.METAL,'#4a4e52'))
        o.append(box('sill',x,6.64,6.12,2.9,.08,.3,L.PANEL,WHITE,.01))
    o.append(box('ac condenser',6.6,6.0,6.35,1.0,.62,.45,L.PANEL,'#dcdcd6',.02))
    o.append(cyl('ac fan',6.45,6.0,6.58,.22,.02,L.PLASTIC,'#3b3d40',axis='z',verts=16))
    o.append(box('cornice',0,10.6,6.05,w+.2,.18,.5,L.PANEL,GREY,.02))
    o.append(box('parapet',0,11.0,5.85,w,.65,.3,L.RENDER,'#e6dccb',0,grime=.3))
    o.append(box('parapet cap',0,11.38,5.85,w+.1,.1,.42,L.PANEL,GREY,.01))
    o.append(box('signboard',0,4.75,6.25,w-.8,1.45,.14,L.PANEL,ORANGE,.02))
    o.append(box('signboard frame',0,4.75,6.18,w-.6,1.6,.06,L.METAL,GREY))
    o.append(text('BENGKEL AZLAN',0,4.95,6.33,.7,L.PANEL,'#23262a',depth=.03,width=w-3))
    o.append(text('SERVIS  ·  TAYAR  ·  MINYAK',0,4.3,6.33,.28,L.PANEL,WHITE,depth=.02,width=w-6))
    for x in (-5.5,0,5.5):
        o.append(BK.paint(BK.kit.strut('lamp arm',(x,5.7,6.3),(x,5.9,6.9),.04,L.METAL),GREY))
        o.append(box('lamp head',x,5.85,6.95,.3,.12,.22,L.LED,'#fff3d6'))
        o.append(card('sign wash',x,4.85,6.37,7.0,2.8,L.WASH,'+z'))
    # two-post lift in the open bay with its arms swung out
    for s in (-1,1):
        o.append(box('lift post',-3+s*1.7,1.8,2.6,.32,3.5,.42,L.PANEL,'#2f63b5',.02))
        o.append(box('lift carriage',-3+s*1.7,.9,2.8,.4,.35,.5,L.METAL,'#5c6064'))
        for dz in (-.7,.7):o.append(BK.paint(BK.kit.strut('lift arm',(-3+s*1.55,.8,2.8),(-3+s*.6,.8,2.8+dz*1.4),.12,L.METAL),'#5c6064'))
    o.append(box('lift crossbar',-3,3.6,2.6,3.8,.16,.3,L.PANEL,'#2f63b5'))
    # tyres: stacks by the pier and a rack on the left wall
    def tyre(x,y,z,axis='y'):
        o.append(cyl('tyre',x,y,z,.33,.22,L.RUBBER,'#1b1c1e',axis=axis,verts=12))
        o.append(cyl('rim',x,y,z,.19,.23,L.METAL,'#9aa0a5',axis=axis,verts=8))
    for k in range(5):tyre(1.8,.25+k*.23,4.9)
    for k in range(4):tyre(1.1,.25+k*.23,5.25)
    o.append(box('tyre rack',-8.2,1.6,2.8,.5,2.9,3.6,L.METAL,'#5f666b'))
    for r in range(3):
        for k in range(5):tyre(-8.2,.7+r*.95,1.35+k*.72,axis='z')
    # tool chest, workbench, drums, compressor, hose reel, posters
    o.append(box('tool chest',4.2,.85,1.0,1.6,1.5,.7,L.PANEL,'#c8202a',.02))
    for k in range(5):o.append(box('drawer line',4.2,.3+k*.28,1.36,1.5,.02,.02,L.METAL,'#d9dcde'))
    o.append(box('workbench',6.8,.95,.8,3.0,.08,.9,L.PANEL,'#6b4a2f'))
    for dx in (-1.35,1.35):o.append(box('bench leg',6.8+dx,.47,.8,.08,.9,.8,L.METAL,DARK))
    o.append(box('vice',5.8,1.1,.8,.3,.22,.25,L.METAL,'#3e5fa8'))
    o.append(box('pegboard',6.8,2.2,.22,3.0,1.2,.03,L.PANEL,'#b8a27c'))
    for k in range(7):o.append(box('tool',5.6+k*.4,2.2,.25,.06,.5,.03,L.METAL,'#6d7378'))
    for k,col in enumerate(('#1f4fa0','#1f4fa0','#b5292a')):o.append(cyl('oil drum',7.6-k*.65,.5,4.6,.3,.9,L.PLASTIC,col,verts=16))
    o.append(cyl('compressor tank',-6.2,.55,.9,.3,1.3,L.PANEL,'#c8202a',axis='x',verts=14))
    o.append(box('compressor motor',-6.2,1.0,.9,.6,.4,.4,L.METAL,DARK))
    o.append(cyl('hose reel',-4.8,2.2,.3,.35,.15,L.PLASTIC,'#d9a21b',axis='z',verts=16))
    for k,col in enumerate(('#e6c34a','#d94a3a')):o.append(box('poster',-1+k*1.1,2.4,.22,.8,1.0,.02,L.PLASTIC,col))
    o.append(cyl('water tank',-hw+2.4,11.3,-3.2,.8,1.4,L.PLASTIC,'#2f5f9c',verts=16))
    return o

def warung(shop):
    """Warung Kak Ana: green lightbox, a zinc awning on brackets over the pavement, the shutter rolled
    up over an open front, a stainless bain-marie of lauk behind a sneeze guard, a kitchen of big
    pots, plastic tables and stools, ceiling fans and a drinks fridge."""
    o=[];w=shop['width'];GREEN='#2f7a4a';RED='#c8322b';YELLOW='#f2c230';hw=w/2;Z=ZINC()
    shoplot(o,w,'#efe6d2',GREEN,frame_col='#b9bcbe',ac=(2,),lining='#7d705c')
    z=fascia(o,w,GREEN,4.0,5.45)
    o.append(text('WARUNG KAK ANA',0,4.8,z+.01,.8,L.SIGN,WHITE,depth=.07,width=w-3))
    o.append(text('NASI LEMAK  ·  MEE GORENG  ·  KUIH',0,4.22,z+.01,.26,L.SIGN,YELLOW,depth=.02,width=w-5))
    o.append(box('shutter box',0,3.72,5.85,w-.6,.36,.4,L.METAL,'#8f969b'))
    for x in (-hw+.4,hw-.4):o.append(box('shutter guide',x,1.9,5.9,.1,3.5,.12,L.METAL,'#7d8387'))
    # zinc awning on brackets
    aw=[(-hw,3.9,6.1),(hw,3.9,6.1),(hw,3.45,8.3),(-hw,3.45,8.3)]
    me=bpy.data.meshes.new('awning');me.from_pydata([pt(*p) for p in aw],[],[(0,1,2,3)]);me.update()
    ob=bpy.data.objects.new('zinc awning',me);bpy.context.scene.collection.objects.link(ob);me.materials.append(Z);ob['asset']='shops';BK.paint(ob);o.append(ob)
    for x in (-hw+.45,hw-.45):o.append(BK.paint(BK.kit.strut('awning rod',(x,5.7,6.05),(x,3.5,8.2),.05,L.METAL),'#4f5458'))
    o.append(box('awning gutter',0,3.42,8.32,w,.1,.12,L.METAL,'#9aa0a4'))
    for x in (-5,1,7):o.append(box('awning tube',x,3.55,7.3,1.2,.05,.08,L.LED,'#ffffff'))
    # bain-marie with trays of lauk, sneeze guard, rice cooker
    bx=-4.0
    o.append(box('bain marie',bx,.62,4.9,6.2,.95,1.0,L.METAL,STEEL,.02))
    o.append(box('bain marie top',bx,1.12,4.9,6.3,.05,1.1,L.METAL,'#aab0b4'))
    lauk=('#7a3a1c','#c8322b','#3f7a2e','#e3a21a','#b0703a','#f1e2b8','#5a2a14','#d9531e','#4f8a3a','#caa05a')
    for k in range(10):o.append(box('lauk tray',bx-2.6+(k%5)*1.3,1.17,4.62+(k//5)*.55,1.1,.06,.46,L.PLASTIC,lauk[k]))
    o.append(box('sneeze guard',bx,1.55,5.45,6.2,.7,.03,L.GLASS))
    o.append(cyl('rice pot',bx+3.6,1.4,4.9,.35,.5,L.METAL,STEEL,verts=16))
    # kitchen along the back wall: tiles, stove, big pots, menu banner
    o.append(box('kitchen tiles',-4,1.5,.22,8,1.6,.02,L.TILES,'#ffffff'))
    o.append(box('stove',-4,.5,.6,6,1.0,.7,L.METAL,'#5d6266',.02))
    for k in range(4):o.append(cyl('periuk',-6.3+k*1.5,1.25,.62,.38,.5,L.METAL,'#c3c7ca',verts=16))
    o.append(box('menu banner',3.5,3.0,.22,6.5,.9,.02,L.SIGN,YELLOW))
    o.append(text('NASI CAMPUR · ROTI · TEH TARIK',3.5,3.0,.24,.26,L.SIGN,RED,depth=.02,width=6))
    # tables and stools, fans, drinks fridge
    for tx,tz,col in ((1.0,3.2,RED),(4.0,3.2,'#2f5fa8'),(7.0,3.2,RED),(2.5,1.6,'#2f5fa8'),(5.5,1.6,RED)):
        o.append(box('table top',tx,.76,tz,1.0,.04,.8,L.PLASTIC,col,.02))
        for dx in (-.42,.42):
            for dz in (-.32,.32):o.append(box('table leg',tx+dx,.38,tz+dz,.04,.74,.04,L.PLASTIC,col))
        for dz in (-.7,.7):o.append(cyl('stool',tx,.23,tz+dz,.17,.45,L.PLASTIC,'#2f5fa8' if col==RED else RED,verts=10))
    for x in (-4,3.5):
        o.append(box('fan rod',x,3.6,3.2,.03,.5,.03,L.METAL,DARK))
        for a in (0,2.09,4.19):o.append(box('fan blade',x+math.cos(a)*.45,3.35,3.2+math.sin(a)*.45,.9,.02,.14,L.PLASTIC,'#e9e5da',ry=a))
    o.append(box('drinks fridge',hw-.8,1.1,4.6,.9,2.0,1.1,L.PANEL,'#c8322b',.02))
    o.append(card('fridge stock',hw-1.26,1.05,4.6,.95,1.7,L.SHELVES,'-x',u_repeat=.8))
    o.append(box('fridge door',hw-1.27,1.05,4.6,.03,1.75,1.0,L.GLASS))
    for x in (-5,0,5):o.append(box('tube light',x,3.84,2.9,1.2,.05,.1,L.LED,'#ffffff'))
    return o

BUILDERS={'zus':zus,'watsons':watsons,'seven':seven,'family':family,'market':market,'workshop':workshop,'warung':warung}

def build(asset):
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    shop=SHOPS[asset];root=bpy.data.objects.new(asset,None);s.collection.objects.link(root)
    BK.finalize(root,[ob for ob in BUILDERS[shop['kind']](shop) if ob is not None])
    return root,shop

if __name__=='__main__':
    reports={}
    for asset in SHOPS:
        if ONLY and asset not in ONLY:continue
        root,shop=build(asset);path=PUBLIC/f'{asset}.glb'
        r=BK.export([root],path,{'asset':asset,'origin':[shop['x'],0,shop['z']],'body':[shop['width'],11,shop['depth']]})
        reports[asset]=r;print('SHOP WEB EXPORT',asset,r['nodes'][asset]['triangles'],r['nodes'][asset]['draws'],r['bytes'],flush=True)
    OUT.mkdir(parents=True,exist_ok=True)
    old=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else {}
    old.update(reports);(OUT/'manifest.json').write_text(json.dumps(old,indent=2)+'\n')
