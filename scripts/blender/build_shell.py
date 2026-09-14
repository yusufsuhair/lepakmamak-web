"""Shell forecourt at (33,103), photographic pass, next to the PETRONAS station.

The Malaysian Shell look: a yellow canopy fascia with a red lower band and the pecten on every
face, a white panelled soffit with LED luminaires, two columns rising out of the pump islands,
slim two-sided dispensers with a red crown, product-coloured nozzles and looped hoses, a jointed
concrete fuelling slab with fuel and oil stains, drain channel and painted arrows, and the Shell
Select shop behind a red lightbox fascia with a glazed front onto lit, stocked shelves. The pylon
carries the pecten and product swatches. Nothing is a downloaded logo: the pecten is geometry.

Contract with the game (src/world.ts shellStation), unchanged by this model:
  * colliders: shop x +-10, z 3..11; pump islands 2 x 2.6 at x +-7, z -4 (the columns stand
    inside them); pylon 2.5 x 1 at (11,-9). Arrival at the pad origin stays clear.
  * the game's canvas signs stay on top: SHELL SELECT (0,5.2) and deli2go (-6.5,4.4) on the shop
    fascia whose face is at z 2.96, SHELL (11,7) and 95 . 97 (11,4.8) on the pylon's street face
    at z -9.5. So none of that wording is baked here.
  * night: materials named 'Night ...' are driven by src/brands.ts (see brand_kit.py).

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_shell.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Shell.glb

Output: public/assets/models/environment/LM_ENV_Shell.glb, node 'shell' at the pad origin.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt, join
import brand_kit as BK
from brand_kit import box, cyl, plate, disc, text, card, ground_quad, arrow, hose, paint

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/shell'
PUBLIC=ROOT/'public/assets/models/environment'
T='shell'
BK.setup(T,OUT/'textures',20260915)

L=BK.Lib()
FORE=BK.textured('Forecourt concrete','forecourt',.8,6.0,strength=.7)
ASPH=BK.textured('Asphalt','asphalt',.9,3.0,strength=.8)
PAVE=BK.textured('Paving','paving',.78,1.2,strength=.6)

YELLOW='#fbce07';RED='#dd1d21';WHITE='#f3f3f1';GREY='#c3c6c8';DARK='#2a2d30';BLACK='#141516'
STEEL='#c9ccce';CONC='#c9c6be'

def place(ob,x,y,z,facing='+z'):
    """Move an object built at the origin facing +z to (x,y,z), turned to `facing`."""
    ob.location=pt(x,y,z);ob.rotation_euler.z={'+z':0,'-z':math.pi,'+x':math.pi/2,'-x':-math.pi/2}[facing]
    return ob

def pecten(R,material=None):
    """The pecten, built at the origin facing +z: red outline, yellow shell with a scalloped top,
    seven red grooves fanning from the hinge, red base. One object; place() puts it on a face."""
    m=material or L.SIGN
    def outline(k,dy=0):
        pts=[]
        for i in range(29):
            a=math.pi*i/28;bump=1-.045*abs(math.sin(a*7))
            pts.append((k*R*bump*math.cos(a),k*R*.92*bump*math.sin(a)+.1*R+dy))
        pts+=[(-k*.72*R,-.38*R),(-k*.5*R,-.62*R),(-k*.42*R,-.8*R*k),(k*.42*R,-.8*R*k),(k*.5*R,-.62*R),(k*.72*R,-.38*R)]
        return [(px,py) for px,py in pts][::-1]
    parts=[plate('pecten outline',outline(1.12),0,.03,m,RED),plate('pecten shell',outline(1.0),.03,.02,m,YELLOW)]
    hinge=(0,-.66*R)
    for k in range(7):
        a=math.radians(28+k*124/6);tip=(R*.86*math.cos(a),R*.8*math.sin(a)+.1*R);w=.045*R
        dx,dy=tip[0]-hinge[0],tip[1]-hinge[1];l=math.hypot(dx,dy);nx,ny=-dy/l*w,dx/l*w
        parts.append(plate('pecten groove',[(hinge[0]+nx*.4,hinge[1]+ny*.4),(tip[0]+nx,tip[1]+ny),(tip[0]-nx,tip[1]-ny),(hinge[0]-nx*.4,hinge[1]-ny*.4)],.05,.012,m,RED))
    parts.append(plate('pecten base',[(-.44*R,-.8*R),(.44*R,-.8*R),(.4*R,-.62*R),(-.4*R,-.62*R)],.05,.012,m,RED))
    return join(parts,'pecten')

# ------------------------------------------------------------------ ground
def ground():
    o=[]
    o.append(box('asphalt pad',0,.03,0,25,.06,25,ASPH,'#ffffff',0))
    o.append(box('fuelling slab',0,.08,-4.25,23,.05,12.5,FORE,'#ffffff',0))
    o.append(box('shop walkway',0,.13,2.95,21,.26,1.3,PAVE,'#ffffff',.02))
    o.append(box('walkway kerb',0,.13,2.28,21.1,.26,.14,L.PANEL,CONC,.02))
    for x in range(-10,11,2):o.append(box('kerb paint',x+.5,.262,2.28,1.0,.006,.16,L.PLASTIC,YELLOW,0))
    # precast kerbs on three sides; the street (north) side stays open for entry and exit
    for s in (-1,1):o.append(box('side kerb',s*12.35,.12,0,.3,.24,25,L.PANEL,CONC,.03,grime=.2))
    o.append(box('rear kerb',0,.12,12.35,25,.24,.3,L.PANEL,CONC,.03,grime=.2))
    # trench drain across the mouth of the forecourt
    o.append(box('drain channel',0,.1,-10.75,23,.012,.34,L.METAL,'#3a3c3e',0))
    for i in range(46):o.append(box('drain grate bar',-11.25+i*.5,.112,-10.75,.05,.012,.32,L.METAL,'#7c8084',0))
    # markings: entry and exit arrows, stop bars at the islands, a hatched no-parking box at the pylon
    for x,d in ((-3.6,'+z'),(3.6,'-z'),(-10.3,'+z'),(10.3,'-z')):o.append(arrow('lane arrow',x,.107,-8.2,2.2,.9,L.PLASTIC,'#f2efe4',d))
    for s in (-1,1):
        for z in (-7.9,-.1):o.append(box('stop bar',s*7,.106,z,2.6,.004,.14,L.PLASTIC,'#f2efe4',0))
    o.append(box('hatch box',9.2,.106,-7.2,3.6,.004,.12,L.PLASTIC,YELLOW,0));o.append(box('hatch box',9.2,.106,-5.0,3.6,.004,.12,L.PLASTIC,YELLOW,0))
    for i in range(4):o.append(box('hatch',8.3+i*.6,.106,-6.1,.1,.004,2.2,L.PLASTIC,YELLOW,0,ry=.6))
    return o

# ------------------------------------------------------------------ canopy
def canopy():
    o=[];x0,x1,z0,z1=-9,9,-9.5,-.5;cx,cz=0,-5;w,d=x1-x0,z1-z0
    o.append(box('canopy roof',cx,5.9,cz,w,.2,d,L.PANEL,GREY,.02))
    # the soffit takes the LED material at a low vertex colour: lit from within by day, bright at night
    o.append(box('soffit',cx,4.86,cz,w-.2,.06,d-.2,L.LED,'#a9adaf',0))
    # fascia: yellow lightbox with the red band along its foot, all four faces
    for name,px,pz,fw,fd in (('fascia N',cx,z0,w+.3,.14),('fascia S',cx,z1,w+.3,.14),('fascia W',x0,cz,.14,d+.3),('fascia E',x1,cz,.14,d+.3)):
        o.append(box(name+' yellow',px,5.4,pz,fw,.9,fd,L.SIGN,YELLOW,.01))
        o.append(box(name+' red',px,4.83,pz,fw+.02,.3,fd+.02,L.SIGN,RED,.01))
        o.append(box(name+' cap',px,5.9,pz,fw+.04,.06,fd+.04,L.METAL,STEEL,0))
    for f,(px,pz) in (('-z',(0,z0-.08)),('+z',(0,z1+.08)),('-x',(x0-.08,cz)),('+x',(x1+.08,cz))):
        o.append(place(pecten(.36),px,5.36,pz,f))
    # luminaires over the lanes, each in a black trim, and the column heads
    for x in (-5.5,0,5.5):
        for z in (-7.4,-2.6):
            o.append(box('luminaire trim',x,4.82,z,1.3,.04,.8,L.PLASTIC,BLACK,0))
            o.append(box('luminaire',x,4.8,z,1.14,.03,.64,L.LED,'#ffffff',0))
            o.append(ground_quad('night pool',x,.12,z+.4,7.5,6.5,L.WASH))
    for s in (-1,1):
        x=s*7
        o.append(box('column',x,2.6,-4,.46,4.6,.46,L.PANEL,GREY,.02))
        o.append(box('column base plate',x,.29,-4,.62,.06,.62,L.METAL,STEEL,.01))
        o.append(box('column red band',x,1.3,-4,.48,.12,.48,L.PLASTIC,RED,0))
        o.append(box('extinguisher box',x+s*.28,1.25,-4,.1,.7,.34,L.PLASTIC,RED,.01))
        o.append(box('rain pipe',x-s*.26,2.6,-4.15,.08,4.6,.08,L.METAL,'#8d9296',0))
    return o

# ------------------------------------------------------------------ pump islands
def dispenser(ix,zz):
    """Two-sided dispenser standing on an island at x=ix; faces +x and -x."""
    o=[]
    o.append(box('dispenser plinth',ix,.34,zz,.62,.18,1.06,L.METAL,'#6d7174',.02))
    o.append(box('dispenser cabinet',ix,.95,zz,.5,1.05,1.0,L.PANEL,'#e9e9e7',.02))
    o.append(box('dispenser head',ix,1.72,zz,.54,.5,1.02,L.PANEL,'#d7d9da',.02))
    o.append(box('dispenser crown',ix,2.2,zz,.56,.42,1.04,L.SIGN,RED,.02))
    o.append(box('crown yellow',ix,2.0,zz,.57,.07,1.05,L.SIGN,YELLOW,0))
    o.append(box('crown cap',ix,2.43,zz,.6,.04,1.08,L.METAL,STEEL,0))
    for s in (-1,1):
        fx=ix+s*.28;face='+x' if s>0 else '-x'
        o.append(box('display glass',fx,1.76,zz,.012,.36,.86,L.PLASTIC,'#101214',0))
        o.append(box('display',fx+s*.004,1.83,zz-.18,.01,.16,.34,L.SIGN,'#8fd0c4',0))
        o.append(box('litres display',fx+s*.004,1.66,zz-.18,.01,.08,.3,L.SIGN,'#8fd0c4',0))
        o.append(box('card reader',fx+s*.006,1.7,zz+.24,.02,.2,.2,L.METAL,'#55595c',.004))
        for r in range(3):
            for c in range(3):o.append(box('key',fx+s*.012,1.64+r*.045,zz+.12+c*.045-.045,.01,.03,.03,L.METAL,'#b8bcbf',0))
        o.append(place(pecten(.12),fx+s*.01,2.2,zz,face))
        # product swatches and nozzles: FuelSave 95 yellow, V-Power 97 red
        for k,(col,dz) in enumerate(((YELLOW,-.3),(RED,.3))):
            o.append(box('product band',fx+s*.004,1.28,zz+dz,.01,.14,.36,L.PLASTIC,col,0))
            o.append(box('nozzle boot',fx+s*.07,1.02,zz+dz,.12,.3,.2,L.PLASTIC,'#1d1f21',.01))
            o.append(box('nozzle grip',fx+s*.14,1.12,zz+dz,.07,.24,.1,L.PLASTIC,col,.01))
            o.append(box('nozzle spout',fx+s*.1,.98,zz+dz,.05,.05,.22,L.METAL,STEEL,0))
            hx=ix+s*.3
            o.append(hose('hose',[(hx,2.02,zz+dz*1.5),(hx+s*.16,1.75,zz+dz*1.6),(hx+s*.3,1.0,zz+dz*1.5),(hx+s*.26,.62,zz+dz*1.1),(hx+s*.18,.85,zz+dz),(hx+s*.14,1.08,zz+dz)],.022,L.RUBBER))
    return o

def island(ix):
    o=[];cz=-4
    o.append(box('island',ix,.17,cz,1.5,.2,5.6,FORE,'#e6e3dc',.08))
    o.append(box('island kerb',ix,.14,cz,1.62,.16,5.72,L.PANEL,CONC,.05))
    for s in (-1,1):
        zc=cz+s*3.05
        for k in range(5):o.append(box('island nose stripe',ix-.6+k*.3,.28,zc,.15,.01,.5,L.PLASTIC,YELLOW if k%2==0 else BLACK,0))
        for dx in (-.45,.45):
            o.append(cyl('bollard',ix+dx,.8,cz+s*2.55,.08,1.1,L.METAL,STEEL,verts=12))
            o.append(cyl('bollard band',ix+dx,1.1,cz+s*2.55,.085,.14,L.PLASTIC,YELLOW,verts=12))
    for zz in (-5.15,-2.85):o+=dispenser(ix,zz)
    o.append(cyl('squeegee bucket',ix+.55,.5,cz+.8,.17,.44,L.PLASTIC,'#1d6f3a',verts=12))
    o.append(box('squeegee handle',ix+.55,.95,cz+.8,.03,.55,.03,L.METAL,STEEL,0))
    o.append(cyl('bin',ix-.55,.52,cz-.8,.2,.5,L.PLASTIC,'#8b9094',verts=14))
    o.append(cyl('bin lid',ix-.55,.8,cz-.8,.22,.06,L.PLASTIC,RED,verts=14))
    return o

# ------------------------------------------------------------------ Shell Select shop
def shop():
    o=[];front=3.3;back=11;h=4.9
    o.append(box('shop back wall',0,h/2+.26,back-.15,20,h,.3,L.RENDER,WHITE,.02,grime=.5))
    for s in (-1,1):
        o.append(box('shop side wall',s*9.85,h/2+.26,(front+back)/2,.3,h,back-front,L.RENDER,WHITE,.02,grime=.5))
        o.append(box('front pilaster',s*9.55,h/2+.26,front+.1,.6,h,.5,L.PANEL,GREY,.02))
    o.append(box('shop slab',0,.2,(front+back)/2,20,.14,back-front,L.TILES,'#ffffff',0))
    o.append(box('shop roof',0,h+.35,(front+back)/2+.1,20.4,.3,back-front+.4,L.PANEL,GREY,.02))
    o.append(box('ceiling',0,3.95,(front+back)/2,19.4,.08,back-front-.3,L.LED,'#9fa3a5',0))
    for x in (-6,-2,2,6):
        for z in (5.4,8.6):o.append(box('ceiling light',x,3.9,z,2.4,.03,.26,L.LED,'#ffffff',0))
    # red lightbox fascia over the walkway; the game's SHELL SELECT and deli2go signs sit on it
    o.append(box('fascia',0,5.05,3.1,20.6,2.0,.3,L.SIGN,RED,.02))
    o.append(box('fascia yellow cap',0,6.15,3.12,20.6,.22,.34,L.SIGN,YELLOW,.01))
    o.append(box('fascia soffit',0,4.07,3.4,20.6,.06,.9,L.LED,'#8e9294',0))
    for x in (-8,-4,0,4,8):o.append(cyl('downlight',x,4.03,3.5,.09,.02,L.LED,'#ffffff',verts=12))
    for s in (-1,1):o.append(place(pecten(.62),s*8.8,5.12,2.94,'-z'))
    # glazed front: anodised frame, transom, sliding doors, manifestation band
    o.append(box('glazing',0,2.1,front,18.4,3.5,.03,L.GLASS,'#ffffff',0))
    o.append(box('glazing head',0,3.9,front,18.6,.14,.14,L.METAL,DARK,0))
    o.append(box('glazing sill',0,.36,front,18.6,.1,.16,L.METAL,DARK,0))
    for x in (-9.2,-6.8,-4.4,-2.0,.8,4.6,7.0,9.2):o.append(box('mullion',x,2.1,front,.08,3.5,.12,L.METAL,DARK,0))
    o.append(box('transom',0,3.2,front,18.4,.07,.1,L.METAL,DARK,0))
    o.append(box('manifestation',0,1.35,front-.02,18.3,.08,.005,L.PLASTIC,'#e7e9ea',0))
    for x in (1.75,3.65):o.append(box('door rail',x,2.1,front-.08,.05,3.0,.05,L.METAL,DARK,0))
    o.append(box('door mat',2.7,.28,front+.5,2.4,.02,1.0,L.RUBBER,'#2d2f31',0))
    o.append(ground_quad('shopfront pool',0,.275,2.6,16,3.2,L.WASH))
    for x in (-5,5):o.append(ground_quad('shop floor pool',x,.28,7,9,6.5,L.WASH))
    # interior: back-wall shelving, two gondolas, drinks chillers, counter and a coffee bar
    o.append(box('back shelving',0,1.45,back-.55,18,2.5,.5,L.PANEL,'#dcdedf',0))
    o.append(card('back shelves',0,1.45,back-.81,17.6,2.3,L.SHELVES,'-z',u_repeat=14.6))
    for z in (6.2,8.4):
        o.append(box('gondola',-2.2,.92,z,8.4,1.45,.7,L.PANEL,'#dcdedf',.01))
        o.append(card('gondola shelves',-2.2,.95,z-.36,8.2,1.3,L.SHELVES,'-z',u_repeat=6.8))
        o.append(card('gondola shelves',-2.2,.95,z+.36,8.2,1.3,L.SHELVES,'+z',u_repeat=6.8))
        o.append(box('gondola header',-2.2,1.78,z,8.4,.24,.74,L.SIGN,RED,.01))
    o.append(box('chiller',-9.3,1.35,7.4,.8,2.3,6.4,L.PANEL,'#e0e1e2',0))
    o.append(card('chiller shelves',-8.89,1.3,7.4,6.2,2.0,L.SHELVES,'+x',u_repeat=5.2))
    o.append(box('chiller doors',-8.86,1.3,7.4,.03,2.1,6.3,L.GLASS,'#ffffff',0))
    o.append(box('chiller header',-8.85,2.55,7.4,.06,.25,6.3,L.SIGN,YELLOW,0))
    o.append(box('counter',6.4,.8,5.1,4.2,1.1,.8,L.PANEL,RED,.02))
    o.append(box('counter top',6.4,1.38,5.1,4.4,.06,.95,L.METAL,'#d8dadb',.01))
    o.append(box('register',5.6,1.55,5.1,.4,.3,.35,L.PLASTIC,BLACK,.02))
    o.append(box('cigarette cabinet',6.4,2.3,6.1,4.0,1.4,.3,L.PANEL,'#2a2d30',.01))
    o.append(box('coffee bar',-6.4,.8,4.4,4.0,1.1,.7,L.PANEL,'#6b4a33',.02))
    o.append(box('coffee top',-6.4,1.38,4.4,4.2,.06,.85,L.PANEL,WHITE,.01))
    o.append(box('coffee machine',-7.2,1.66,4.5,.8,.5,.5,L.METAL,STEEL,.02))
    o.append(box('coffee board',-6.4,2.8,4.0,3.2,.8,.05,L.SIGN,'#7a2020',.01))
    # roof plant and the LPG cage against the east wall
    for x in (-5,5):
        o.append(box('condenser',x,h+.9,8.5,1.8,.9,.8,L.PANEL,'#dadcdd',.03))
        o.append(cyl('condenser fan',x,h+.9,8.08,.32,.04,L.PLASTIC,'#3a3d40',axis='z',verts=16))
    o.append(box('lpg cage frame',10.55,.9,6.5,.9,1.6,2.4,L.METAL,'#5f6a6f',.02))
    for i in range(4):o.append(cyl('lpg cylinder',10.55,.62,5.6+i*.6,.17,.9,L.PLASTIC,'#1f5fb0' if i%2 else '#d8342c',verts=12))
    for i in range(9):o.append(box('cage bar',11.02,.9,5.35+i*.29,.03,1.6,.03,L.METAL,'#8a9498',0))
    return o

# ------------------------------------------------------------------ pylon
def pylon():
    o=[];px,pz=11,-9
    o.append(box('pylon base',px,.3,pz,2.9,.6,1.3,L.PANEL,CONC,.03,grime=.4))
    o.append(box('pylon body',px,5.2,pz,2.5,9.6,1.0,L.PANEL,'#dfe1e2',.03))
    for s,f in ((-1,'-z'),(1,'+z')):
        fz=pz+s*.5
        # faces stop 25 mm proud of the body so the game's canvas SHELL and 95 . 97 (40-50 mm) stay on top
        o.append(box('pecten panel',px,8.75,fz+s*.0125,2.3,2.1,.025,L.SIGN,WHITE,0))
        o.append(place(pecten(.78),px,8.75,fz+s*.03,f))
        o.append(box('name band',px,7.0,fz+s*.0125,2.3,.75,.025,L.SIGN,RED,0))
        o.append(box('price panel',px,4.8,fz+s*.0125,2.3,.95,.025,L.PANEL,WHITE,0))
        o.append(box('price frame',px,4.8,fz+s*.0075,2.42,1.07,.015,L.SIGN,YELLOW,0))
        for k,col in enumerate((YELLOW,RED,'#2b8a3e')):o.append(box('product swatch',px-.8+k*.8,3.7,fz+s*.0125,.7,.5,.025,L.SIGN,col,0))
        o.append(box('pylon foot band',px,1.2,fz+s*.0075,2.52,.5,.015,L.SIGN,RED,0))
    o.append(box('pylon cap',px,10.05,pz,2.6,.1,1.1,L.METAL,STEEL,.01))
    o.append(ground_quad('pylon pool',px,.09,pz-1.8,4,3,L.WASH))
    # air and water unit on the west edge
    o.append(box('air unit',-11.3,.85,-6.2,.7,1.5,.5,L.PANEL,YELLOW,.03))
    o.append(box('air unit head',-11.3,1.72,-6.2,.74,.26,.54,L.PANEL,RED,.02))
    o.append(cyl('air gauge',-11.3,1.25,-6.46,.12,.03,L.METAL,STEEL,axis='z',verts=16))
    o.append(hose('air hose',[(-11.05,1.0,-6.46),(-10.8,.7,-6.7),(-10.85,.35,-6.5),(-11.05,.6,-6.46)],.018,L.RUBBER))
    return o

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    root=bpy.data.objects.new(T,None);s.collection.objects.link(root)
    BK.finalize(root,ground()+canopy()+island(-7)+island(7)+shop()+pylon())
    return root

if __name__=='__main__':
    root=build();path=PUBLIC/'LM_ENV_Shell.glb'
    report=BK.export([root],path,{'asset':'LM_ENV_Shell','origin':[33,0,103],'footprint':[25,25],
        'colliders':{'shop':[0,7,20,8],'pumps':[[-7,-4,2,2.6],[7,-4,2,2.6]],'pylon':[11,-9,2.5,1]},
        'canvas_signs':['SHELL SELECT','deli2go','SHELL','95 · 97']})
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('SHELL WEB EXPORT',json.dumps(report),flush=True)
