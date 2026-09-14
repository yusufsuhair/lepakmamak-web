"""The two street hawker gerai from shared/stalls.json, photographic pass.

Each gerai is a steel-framed counter on the slab it has worn into the verge: painted apron in the
stall's colour, brushed stainless top, an open back shelf for stock, a pallet for the hawker to
stand on (the vendor rig stands at y .12, z -1.4), hanging bulbs and fluorescent tubes, and the
empty frame the game's canvas name board hangs in.

  Pisang Goreng Mak Cik   corrugated zinc roof on painted posts, a kuali of oil on a wok burner fed
                          by an LPG cylinder, a glass food cabinet of pisang goreng, keledek and
                          cucur, batter basin and a banana bunch, and a charcoal satay trough at
                          the side with skewers over glowing coals
  Air Balang Pak Din      striped canvas awning, three balang jars with brass taps and ice, the
                          teh tarik kettle on its burner, a cup sealer, air bungkus hanging on a
                          string, a cooler, and a folding table of nasi lemak and kuih
  both                    plastic stools, sauce bottles, crates, oil tins, grease-stained slab
                          with puddles

The wok flame, the satay smoke and the kettle steam are runtime effects in src/stalls.ts, placed on
the anchors this script writes to assets/stalls/manifest.json. Materials whose names begin
'Night' are lamps the runtime brightens after dark ('Night wash' pools are only drawn then).
Nothing moves the gameplay: colliders, the vendor anchor and the canvas boards stay in stalls.ts,
and no lettering is baked.

Authored in absolute game coordinates, so the GLB drops in at the world origin.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_stalls.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Stalls.glb

Output: public/assets/models/environment/LM_ENV_Stalls.glb, root node 'stalls'.
"""
import bpy, math, json, sys, random
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft
from build_klcc import sphere
import pbr_kit as kit
from pbr_kit import srgb,uv_metres,strut,tube
import hawker_textures as HT
import shoplot_textures as ST
from hawker_kit import vc,lathe,quad,alpha_mat,glow_mat,metallic,face_up,export,rgba_image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/stalls'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
T='stalls'
kit.setup(T,OUT/'textures',20260914)
RNG=kit.RNG
STALLS=json.loads((ROOT/'shared/stalls.json').read_text())

# ------------------------------------------------------------------ materials: one draw each
def P(name,kind,rough,tile,source=HT,**kw):return kit.pbr(name,kind,'#ffffff',rough,tile,source=source,**kw)
STEEL=metallic(P('Stall steel','steel',.32,.6),.35)
PAINT=P('Stall paint','paint',.55,1.0)
CANVAS=P('Stall canvas','canvas',.85,1.0,two_sided=True)
ZINC=metallic(P('Stall zinc','zinc',.5,2.0,source=ST),.4)
PLASTIC=P('Stall plastic','plastic',.42,.5)
FOOD=P('Stall fried food','batter',.62,.25,strength=1.3)
WOOD=P('Stall wood','wood_small',.72,.8)
SLAB=P('Stall slab','pad',.92,3.0)
IRON=mat('Stall iron',(1,1,1),.62)
LIQUID=mat('Stall liquid',(1,1,1),.1)
GLASS=mat('Stall glass',(.86,.93,.94),.04,alpha=.24,two_sided=True)
PUDDLE=alpha_mat('Stall puddle',rgba_image('puddle',HT.puddle()),.06)
TUBE=mat('Night tube',srgb('#eaf6ff'),.3,emit=1)
BULB=mat('Night bulb',srgb('#ffd29a'),.3,emit=1)
EMBER=mat('Night ember',srgb('#ff6a22'),.6,emit=1)
WASH=glow_mat('Night wash',kit.image('wash',HT.wash()))

# colours (sRGB hex, painted as vertex colours)
GALV='#b9bdbd';DARK='#2a2b2c';BLACK='#141414';RUBBER='#1d1d1e';CAST='#262422'
RED='#c42a26';BLUE='#2658a8';GREEN='#2f8a4a';YELLOW='#e9b925';WHITE='#ffffff';CREAM='#efe6cf'
KRAFT='#b98a57';PAPER='#ede6d3';LEAF='#4d7a2c';RATTAN='#b58a52';BAMBOO='#d8bb7c'
OIL='#b4741c';CHILLI='#8c1410';SOY='#1e120b';SYRUP='#8e2440';BATTER_RAW='#e8cf86'

def hexmix(a,b,t):
    a,b=srgb(a),srgb(b);return tuple(x+(y-x)*t for x,y in zip(a,b))
def shade(c,k):return tuple(v*k for v in (srgb(c) if isinstance(c,str) else c))

def item_col(item):return item['color']
def food_col(item):return hexmix(item['color'],'#ffffff',.5)   # the batter texture is golden already

# ------------------------------------------------------------------ builders in a stall's frame
class Stall:
    """Local frame of one gerai: +x along the counter, +z toward the customers."""
    def __init__(self,s):
        self.s=s;self.X=s['x'];self.Z=s['z'];self.o=[]
        self.paint=s['color'];self.trim=shade(s['color'],.42)
    def add(self,ob,c=WHITE):
        vc(ob,c)
        if any('tile' in m for m in ob.data.materials if m):uv_metres(ob)
        self.o.append(ob);return ob
    def B(self,name,x,y,z,w,h,d,m,c=WHITE,bevel=0,rx=0,ry=0):
        ob=box(name,self.X+x,y,self.Z+z,w,h,d,m,T,bevel,rx)
        if ry:ob.rotation_euler.z=ry
        return self.add(ob,c)
    def C(self,name,x,y,z,r,h,m,c=WHITE,verts=12,axis='y'):
        return self.add(cyl(name,self.X+x,y,self.Z+z,r,h,m,T,axis=axis,verts=verts),c)
    def L(self,name,x,z,prof,m,c=WHITE,n=16,**kw):
        return self.add(lathe(name,self.X+x,self.Z+z,prof,m,n,**kw),c)
    def S(self,name,p0,p1,w,m,c=WHITE,h=None):
        ob=strut(name,(self.X+p0[0],p0[1],self.Z+p0[2]),(self.X+p1[0],p1[1],self.Z+p1[2]),w,m,h)
        return self.add(ob,c) if ob else None
    def U(self,name,points,r,m,c=WHITE,sides=6):
        return self.add(tube(name,[(self.X+x,y,self.Z+z) for x,y,z in points],r,m,sides),c)
    def Q(self,name,x,y,z,w,d,m,yaw=0,c=WHITE):
        return self.add(quad(name,self.X+x,y,self.Z+z,w,d,m,yaw),c)
    def ball(self,name,x,y,z,r,m,c=WHITE,seg=8,rings=5):
        return self.add(sphere(name,self.X+x,y,self.Z+z,r,m,T,seg,rings),c)
    def lump(self,name,x,y,z,r,m,c=WHITE):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=r,location=pt(self.X+x,y,self.Z+z))
        ob=bpy.context.object
        for v in ob.data.vertices:v.co*=RNG.uniform(.72,1.18)
        ob.scale=(RNG.uniform(.8,1.25),RNG.uniform(.8,1.25),RNG.uniform(.55,.8));ob.rotation_euler.z=RNG.random()*6.3
        from build_lrt import finish
        finish(ob,name,m,T);return self.add(ob,c)

# ------------------------------------------------------------------ slab, puddles, pallet
def ground(st,wet):
    """The worn slab: a chipped rounded rectangle 6.4 x 4.8 m, 12 mm proud of the verge."""
    X,Z=st.X,st.Z;n=48;verts=[pt(X,.012,Z)];R=random.Random(int(X*7+Z))
    for i in range(n):
        a=2*math.pi*i/n;c,s=math.cos(a),math.sin(a)
        k=(abs(c)**7+abs(s)**7)**(-1/7)*(1+R.uniform(-.035,.02)*(1+2*(R.random()<.15)))   # squarish edge, chipped
        verts.append(pt(X+3.2*c*k,.012,Z+.2+2.4*s*k))
    ob=kit.mesh('stall slab',verts,[(0,1+i,1+(i+1)%n) for i in range(n)],SLAB,smooth=False);face_up(ob)
    # the edge ring is a hair lower so the slab sinks into the grass instead of standing on it
    for v in ob.data.vertices[1:]:v.co.z=.004
    st.add(ob,'#c9c3b8')
    for x,z,w,yaw in wet:st.Q('puddle',x,.016,z,w,w*RNG.uniform(.6,.9),PUDDLE,yaw)
    # the hawker's pallet, under the vendor anchor
    for i in range(5):st.B('pallet board',-.36+i*.18,.105,-1.4,.14,.02,.9,WOOD,'#a88f6c')
    for x in (-.38,0,.38):st.B('pallet block',x,.05,-1.4,.1,.09,.84,WOOD,'#8a7152')

# ------------------------------------------------------------------ counter, frame, board
def counter(st):
    """Steel-framed counter: painted apron and cheeks, stainless top with a splash lip, open back
    with a stock shelf. Collision in stalls.ts is x +-2, z +-.8."""
    p,t=st.paint,st.trim
    st.B('apron',0,.8,.70,3.9,.92,.04,PAINT,p)
    st.B('apron rail',0,1.27,.72,3.94,.06,.08,PAINT,t)
    st.B('kick plate',0,.2,.71,3.9,.38,.05,STEEL,GALV)
    for x in (-1.93,1.93):st.B('cheek',x,.8,0,.04,.92,1.4,PAINT,p)
    for x in (-1.95,1.95):
        for z in (-.7,.7):st.B('counter leg',x,.62,z,.05,1.24,.05,STEEL,GALV)
    st.B('stock shelf',0,.42,-.08,3.82,.03,1.28,STEEL,GALV)
    st.B('shelf lip',0,.46,-.72,3.82,.06,.03,STEEL,GALV)
    st.B('serving top',0,1.34,0,4.02,.08,1.58,STEEL,WHITE)
    st.B('splash lip',0,1.47,-.77,4.02,.18,.03,STEEL,WHITE)
    st.B('top nosing',0,1.3,.8,4.02,.08,.03,STEEL,WHITE)
    for x in (-1.93,1.93):
        for z in (-.7,.7):st.C('rubber foot',x,.02,z,.04,.04,IRON,RUBBER,8)

def board(st):
    """Frame for the game's canvas board (3.9 x .8 at y 2.6, z .8): backing, bezel, lamp hood."""
    p,t=st.paint,st.trim
    st.B('board backing',0,2.6,.7,4.06,.86,.06,PAINT,p)
    for y in (3.06,2.14):st.B('board bezel',0,y,.76,4.14,.08,.1,PAINT,t)
    for x in (-2.03,2.03):st.B('board bezel',x,2.6,.76,.08,1.0,.1,PAINT,t)
    st.B('board lamp hood',0,3.2,.86,3.0,.04,.16,STEEL,GALV)
    st.B('board lamp tube',0,3.16,.88,2.8,.035,.035,TUBE)
    for x in (-1.2,0,1.2):st.B('lamp bracket',x,3.14,.78,.03,.1,.12,STEEL,GALV)

def posts(st,front_top,back_top):
    """Four painted steel posts on base plates, rails and the drop cord for the tube."""
    t=st.trim
    for x in (-1.97,1.97):
        st.B('post',x,front_top/2,.76,.06,front_top,.06,PAINT,t)
        st.B('post',x,back_top/2,-.76,.06,back_top,.06,PAINT,t)
        for z in (-.76,.76):st.B('base plate',x,.01,z,.16,.02,.16,STEEL,GALV)
        st.B('side rail',x,back_top-.05,0,.05,.05,1.58,PAINT,t)
    st.B('front rail',0,front_top-.05,.76,3.98,.05,.05,PAINT,t)
    st.B('back rail',0,back_top-.05,-.76,3.98,.05,.05,PAINT,t)
    # fluorescent batten on chains from a cross bar, over the hawker's side of the counter
    top=min(front_top,back_top)-.05;y=top-.32
    st.B('tube cross bar',0,top,-.35,3.98,.04,.04,PAINT,t)
    st.B('tube batten',0,y+.03,-.35,1.3,.04,.07,STEEL,GALV)
    st.B('tube',0,y-.01,-.35,1.22,.028,.028,TUBE)
    for x in (-.55,.55):st.B('tube chain',x,(y+top)/2,-.35,.012,top-y,.012,IRON,DARK)

def bulbs(st,cord_top):
    """Bare bulbs in tin shades on long cords over the customers, low enough to read from above."""
    for x in (-1.05,1.05):
        st.B('lamp cord',x,(cord_top+2.19)/2,1.2,.012,cord_top-2.19,.012,IRON,BLACK)
        st.L('lamp shade',x,1.2,[(2.03,.24),(2.12,.16),(2.2,.07),(2.22,.02)],PAINT,'#3a5a52',n=14,cap_top=True)
        st.L('lamp shade inside',x,1.2,[(2.025,.235),(2.11,.155),(2.2,.065)],STEEL,'#e4e2da',n=14,inward=True)
        st.ball('bulb',x,1.96,1.2,.07,BULB,seg=10,rings=6)
        st.C('bulb holder',x,2.06,1.2,.028,.08,IRON,BLACK,8)

def stools(st,spots):
    """Kopitiam plastic stools: flared skirt with a rolled seat."""
    for x,z,c in spots:
        # four splayed legs under a skirt that stops short of the ground, like the real mould
        st.L('stool skirt',x,z,[(.2,.2),(.36,.158),(.42,.152)],PLASTIC,c,n=14,cap_bottom=False)
        for k in range(4):
            a=k*math.pi/2+math.pi/4
            st.S('stool leg',(x+math.cos(a)*.15,.22,z+math.sin(a)*.15),(x+math.cos(a)*.2,0,z+math.sin(a)*.2),.05,PLASTIC,c,h=.03)
        st.L('stool seat',x,z,[(.41,.168),(.44,.172),(.45,.165)],PLASTIC,shade(c,1.05),n=14,cap_top=True)
        st.C('stool handle hole',x,.452,z,.035,.006,IRON,shade(c,.25),10)

def crate(st,x,y,z,c,yaw=0):
    st.B('crate',x,y+.15,z,.6,.3,.42,PLASTIC,c,ry=yaw)
    st.B('crate slot shadow',x,y+.24,z,.52,.06,.43,IRON,shade(c,.4),ry=yaw)

def gas(st,x,z,c=RED):
    """14 kg LPG cylinder with a guard ring, valve, regulator and a hose up to the burner."""
    st.L('gas cylinder',x,z,[(.46,.165),(.5,.185),(.98,.185),(1.06,.15),(1.1,.07)],PAINT,c,n=16,cap_top=True)
    st.L('gas foot ring',x,z,[(.44,.17),(.52,.17)],STEEL,GALV,n=16)
    st.L('gas guard',x,z,[(1.1,.1),(1.2,.1)],STEEL,GALV,n=12)
    st.C('gas valve',x,1.16,z,.03,.1,STEEL,'#a38a4a',8)
    st.B('regulator',x,1.24,z,.1,.06,.1,IRON,'#5a5d5e')

def oil_tin(st,x,z,y=.44):
    st.B('oil tin',x,y+.18,z,.24,.36,.24,STEEL,'#c8c1a8',bevel=.008)
    st.C('tin spout',x+.07,y+.38,z+.06,.02,.04,STEEL,'#9a9486',8)

def sauces(st,x,z,cols):
    st.B('condiment tray',x,1.415,z,.6,.05,.24,STEEL,GALV)
    for i,c in enumerate(cols):
        st.C('sauce bottle',x-.2+i*.2,1.55,z,.045,.24,PLASTIC,c,8)
        st.C('sauce nozzle',x-.2+i*.2,1.69,z,.018,.05,PLASTIC,WHITE if c!=WHITE else RED,6)

# ------------------------------------------------------------------ pisang goreng
WOK=(1.22,-.05);SATAY=(2.42,-.6);GRILL_Y=.9
def zinc_roof(st):
    """Mono-pitch zinc from a front eave at 3.52 down to 3.02 at the back, on painted purlins."""
    z0,z1,y0,y1=1.6,-1.72,3.52,3.02
    slope=lambda z:y1+(y0-y1)*(z-z1)/(z0-z1)
    X,Z=st.X,st.Z
    prof=lambda y:[(X-2.35,y),(X+2.35,y),(X+2.35,y+.018),(X-2.35,y+.018)]
    st.add(loft('zinc roof',[(Z+z1,prof(y1)),(Z+z0,prof(y0))],ZINC,T),'#ffffff')
    # corrugated eave strips so the sheet edge reads in silhouette
    for z in (z0,z1):
        wave=[(X-2.35+i*.0755,slope(z)+.016+.016*math.sin(i*math.pi/2)) for i in range(63)]
        edge=wave+[(px,py-.022) for px,py in wave[::-1]]
        st.add(loft('zinc edge',[(Z+z-.01,edge),(Z+z+.01,edge)],ZINC,T),'#d0d2d0')
    for x in (-1.97,0,1.97):st.S('rafter',(x,slope(z1+.08)-.04,z1+.08),(x,slope(z0-.08)-.04,z0-.08),.05,PAINT,st.trim)
    for z in (-1.1,0,1.1):st.B('purlin',0,slope(z)-.02,z,4.5,.035,.05,PAINT,st.trim)
    st.B('fascia',0,slope(z0)-.07,z0+.02,4.72,.12,.025,PAINT,st.paint)
    # a rolled blue tarp tied under the back eave for the afternoon rain
    st.C('rolled tarp',0,y1-.12,z1+.1,.07,4.3,CANVAS,'#2b5f9e',10,axis='x')
    for x in (-1.6,0,1.6):st.C('tarp tie',x,y1-.12,z1+.1,.075,.03,IRON,'#e0d6b8',10,axis='x')

def cabinet(st):
    """Glass food cabinet on the customer half of the counter: stainless frame, sloped front glass,
    a glass shelf and trays of the three goreng inside."""
    x0,x1,z0,z1,y0=-1.95,-.08,-.12,.72,1.38
    cx,w=(x0+x1)/2,x1-x0
    st.B('cabinet base',cx,y0+.02,(z0+z1)/2,w,.04,z1-z0,STEEL,WHITE)
    for x in (x0+.02,x1-.02):
        st.B('cabinet post',x,y0+.34,z0+.02,.03,.64,.03,STEEL,WHITE)
        st.B('cabinet post',x,y0+.2,z1-.02,.03,.36,.03,STEEL,WHITE)
        st.S('cabinet slope rail',(x,y0+.38,z1-.02),(x,y0+.66,z0+.3),.025,STEEL,WHITE)
        st.B('cabinet top rail',x,y0+.66,(z0+z0+.3)/2,.03,.03,.34,STEEL,WHITE)
        side=[pt(st.X+x,y,st.Z+z) for y,z in ((y0+.04,z1-.02),(y0+.38,z1-.02),(y0+.66,z0+.3),(y0+.66,z0+.02),(y0+.04,z0+.02))]
        st.add(kit.mesh('cabinet side glass',side,[(0,1,2,3,4)],GLASS,smooth=False))
    st.B('cabinet roof',cx,y0+.66,z0+.15,w,.02,.32,STEEL,WHITE)
    # sloped front glass from the front sill up to the roof
    X,Z=st.X,st.Z;a=math.atan2(.28,z1-z0-.3);L=math.hypot(.28,z1-z0-.32)
    g=box('cabinet front glass',X+cx,y0+.52,Z+(z1+z0+.3)/2,w-.05,L,.008,GLASS,T,0);g.rotation_euler.x=-(math.pi/2-a)
    st.add(g)
    st.B('cabinet front sill',cx,y0+.38,z1-.02,w,.03,.03,STEEL,WHITE)
    st.B('cabinet front glass low',cx,y0+.2,z1-.02,w-.05,.34,.008,GLASS)
    st.B('cabinet shelf',cx,y0+.35,z0+.28,w-.08,.012,.5,GLASS)
    for i,x in enumerate((x0+.38,x0+.95,x0+1.52)):
        st.B('cabinet sliding door',x,y0+.34,z0+.01,.55,.6,.008,GLASS)
    items=st.s['items']
    for i,item in enumerate(items):
        tx=x0+.33+i*.61
        st.B('goreng tray',tx,y0+.065,.3,.56,.03,.66,STEEL,'#c9c9c4')
        st.B('tray paper',tx,y0+.085,.3,.5,.008,.6,PAINT,PAPER)
        for j in range(8):
            gx=tx-.17+(j%3)*.17+RNG.uniform(-.02,.02);gz=.08+(j//3)*.19+RNG.uniform(-.02,.02)
            if item['id']=='cucur':st.lump('cucur',gx,y0+.13,gz,.07,FOOD,food_col(item))
            elif item['id']=='keledek-goreng':st.B('keledek',gx,y0+.12,gz,.15,.045,.08,FOOD,food_col(item),ry=RNG.uniform(-.6,.6))
            else:st.B('pisang goreng',gx,y0+.12,gz,.07,.05,.19,FOOD,food_col(item),ry=RNG.uniform(-.5,.5))
    # second tier: more pisang on a paper-lined tray and folded paper bags
    st.B('shelf tray',x0+.5,y0+.37,z0+.3,.7,.02,.4,STEEL,'#c9c9c4')
    for j in range(6):st.B('pisang goreng',x0+.28+(j%3)*.2,y0+.41,z0+.2+(j//3)*.2,.07,.05,.19,FOOD,food_col(items[0]),ry=RNG.uniform(-.4,.4))
    for i in range(6):st.B('paper bag',x0+1.35,y0+.365+i*.012,z0+.3,.42,.01,.3,PAINT,KRAFT,ry=.05*i)

def fryer(st):
    """Kuali of oil on a ring burner, fritters in the oil, a wire drainer tray and the skimmer."""
    wx,wz=WOK;items=st.s['items'];top=1.38
    # pot ring on three legs over a low burner head, so the flame shows in the gap under the kuali
    st.L('pot ring',wx,wz,[(1.53,.25),(1.57,.235)],IRON,CAST,n=16)
    for i in range(3):
        a=i*2.094+.5;st.S('burner leg',(wx+.31*math.cos(a),top,wz+.31*math.sin(a)),(wx+.245*math.cos(a),1.56,wz+.245*math.sin(a)),.035,IRON,CAST)
    st.L('burner head',wx,wz,[(top,.12),(top+.06,.105),(top+.08,.07)],IRON,'#403a33',n=12,cap_top=True)
    # the kuali: outside up to the rim, then back down the inside to a bottom that faces up
    k=.08
    st.L('kuali',wx,wz,[(1.5+k,.1),(1.55+k,.26),(1.64+k,.42),(1.76+k,.54),(1.78+k,.55),(1.74+k,.52),(1.63+k,.4),(1.54+k,.24),(1.52+k,.08)],
         IRON,'#1b1b1c',n=20,cap_bottom=True,cap_top=True)
    for x in (-.6,.6):st.B('kuali ear',wx+x,1.76+k,wz,.12,.03,.18,IRON,'#1b1b1c')
    st.L('frying oil',wx,wz,[(1.655+k,.405),(1.665+k,.415)],LIQUID,OIL,n=20,cap_top=True)
    for i in range(6):
        a=i*1.05+.3;r=.2+.08*(i%2)
        st.B('frying fritter',wx+math.cos(a)*r,1.675+k,wz+math.sin(a)*r,.07,.04,.18,FOOD,hexmix(item_col(items[0]),'#ffffff',.7),ry=a)
    # drainer: wire rack over a tray on the customer side of the wok
    dz=wz+.6
    st.B('drainer tray',wx,top+.03,dz,.9,.05,.3,STEEL,'#b8b8b2')
    for i in range(8):st.B('drainer wire',wx-.42+i*.12,top+.07,dz,.008,.008,.3,STEEL,'#9a9a95')
    for i in range(4):st.B('drained fritter',wx-.3+i*.2,top+.1,dz+RNG.uniform(-.04,.04),.07,.05,.18,FOOD,food_col(items[0]),ry=RNG.uniform(-.4,.4))
    st.U('skimmer handle',[(wx-.95,1.94,wz-.25),(wx-.55,1.88,wz-.1),(wx-.28,1.8,wz)],.012,WOOD,'#7a5a3a',5)
    st.L('skimmer mesh',wx-.22,wz+.03,[(1.77,.12),(1.78,.13)],STEEL,'#9d9d98',n=12,cap_top=True)

def goreng_prep(st):
    """Behind the cabinet: batter basin, banana bunch, paper and the sauces."""
    top=1.38
    st.L('batter basin',.42,-.42,[(top,.16),(top+.14,.25),(top+.15,.26),(top+.13,.24),(top+.02,.14)],PLASTIC,'#d9dcdc',n=18,cap_bottom=True,cap_top=True)
    st.L('batter',.42,-.42,[(top+.105,.225),(top+.11,.23)],LIQUID,BATTER_RAW,n=18,cap_top=True)
    st.U('batter ladle',[(.42,top+.11,-.42),(.52,top+.2,-.5),(.6,top+.34,-.6)],.012,STEEL,GALV,5)
    # pisang raja bunch on a chopping board
    st.B('chopping board',-.35,top+.02,-.5,.5,.04,.34,WOOD,'#c49a6a')
    for j in range(7):
        bx=-.5+j*.05;pts=[(bx,top+.05,-.44),(bx+.02,top+.1,-.52),(bx,top+.12,-.62)]
        st.U('banana',pts,[.024,.028,.016],PLASTIC,'#e5c341' if j%3 else '#d6b43a',6)
    st.B('banana crown',-.35,top+.12,-.42,.34,.05,.05,PLASTIC,'#6b6a2c')
    sauces(st,-1.55,-.55,(CHILLI,SOY,'#e06a1b'))

def goreng_stock(st):
    gas(st,1.3,-.28)
    st.U('gas hose',[(1.3,1.24,-.28),(1.42,1.3,-.5),(1.36,1.42,-.66),(1.25,1.47,-.3)],.014,IRON,'#222222',5)
    oil_tin(st,.8,-.3);oil_tin(st,.5,-.3)
    for i,x in enumerate((-.25,-.65)):st.B('flour sack',x,.58,-.3,.34,.28,.26,PAINT,'#ece6d6',bevel=.03,ry=.1*i)
    crate(st,-1.35,.44,-.3,BLUE);crate(st,-1.35,.74,-.3,GREEN,.08)

def satay(st):
    """Charcoal trough on folding legs beside the counter, skewers across it, a woven fan."""
    sx,sz=SATAY;y=GRILL_Y;L,W=1.1,.28
    st.B('trough floor',sx,y-.12,sz,W,.02,L,STEEL,'#6a6560')
    for dx in (-1,1):st.B('trough side',sx+dx*W/2,y-.05,sz,.02,.16,L,STEEL,'#5b5650')
    for dz in (-1,1):st.B('trough end',sx,y-.05,sz+dz*L/2,W,.16,.02,STEEL,'#5b5650')
    for dx in (-1,1):
        for dz in (-1,1):st.S('grill leg',(sx+dx*.1,y-.13,sz+dz*.45),(sx+dx*.16,0,sz+dz*.52),.025,STEEL,'#4d4a46')
    st.S('grill brace',(sx-.14,.25,sz-.5),(sx-.14,.25,sz+.5),.018,STEEL,'#4d4a46')
    for i in range(34):
        cx,cz=sx+RNG.uniform(-.1,.1),sz+RNG.uniform(-.5,.5)
        hot=RNG.random()<.55
        st.lump('charcoal',cx,y-.07+RNG.uniform(0,.03),cz,.035,EMBER if hot else IRON,WHITE if hot else '#1e1c1b')
    st.B('ash bed',sx,y-.1,sz,W-.03,.02,L-.03,PAINT,'#8a8580')
    for z in (sz-.4,sz,sz+.4):st.B('grill bar',sx,y+.035,z,W+.04,.012,.012,IRON,'#2c2a28')
    for i in range(16):
        z=sz-.45+i*.06
        st.B('skewer',sx+.05,y+.05,z,.52,.008,.008,WOOD,BAMBOO)
        for k in range(4):st.B('satay meat',sx-.02+k*.045,y+.06,z,.04,.022,.03,FOOD,'#c98f5e' if i%3 else '#d49a62')
    # kuah kacang waiting at the end of the counter
    st.B('satay tray',1.84,1.405,.5,.3,.03,.3,STEEL,'#b6b6b0')
    st.C('kuah kacang',1.84,1.45,.5,.1,.06,LIQUID,'#9b5a22',12)
    fan=box('kipas',st.X+sx-.3,.55,st.Z+sz-.1,.02,.3,.24,WOOD,T,0);fan.rotation_euler.y=.35;st.add(fan,'#c9a56b')

# ------------------------------------------------------------------ air balang
def canvas_roof(st):
    """Striped canvas on a steel frame: ridge at 3.45, eaves at 3.10, a shallow scalloped valance
    so the name board below it stays readable from the third-person camera."""
    X,Z=st.X,st.Z;p=st.paint
    for x in (-1.97,1.97):
        st.S('rafter',(x,3.1,-1.45),(x,3.45,0),.04,PAINT,st.trim);st.S('rafter',(x,3.45,0),(x,3.1,1.45),.04,PAINT,st.trim)
    st.B('ridge pole',0,3.47,0,4.3,.045,.045,PAINT,st.trim)
    sag=lambda x:-.05*abs(math.sin(math.pi*(x+2.1)/2.1))
    for i in range(8):
        x0,x1=-2.1+i*.525,-2.1+(i+1)*.525;c=p if i%2 else CREAM
        prof=lambda y:[(X+x0,y+sag(x0)),(X+x1,y+sag(x1)),(X+x1,y+sag(x1)+.02),(X+x0,y+sag(x0)+.02)]
        st.add(loft('awning stripe',[(Z+z,prof(y)) for z,y in ((-1.45,3.10),(-.78,3.36),(0,3.45),(.78,3.36),(1.45,3.10))],CANVAS,T),c)
        hem=[(X+x0,3.02),(X+(x0+x1)/2,2.93),(X+x1,3.02),(X+x1,3.12),(X+x0,3.12)]
        st.add(loft('awning valance',[(Z+1.45,hem),(Z+1.47,hem)],CANVAS,T),c)
        back=[(X+x0,3.0),(X+x1,3.0),(X+x1,3.12),(X+x0,3.12)]
        st.add(loft('awning back skirt',[(Z-1.47,back),(Z-1.45,back)],CANVAS,T),c)
    for z in (-1.45,1.45):st.B('eave bar',0,3.1,z,4.25,.03,.03,STEEL,GALV)

def balang_jars(st):
    """Three balang with brass taps, ice in the drink, stainless lids and a ladle."""
    top=1.38
    for i,item in enumerate(st.s['items']):
        x=-1.5+i*1.1;z=-.02
        st.B('jar stand',x,top+.03,z,.74,.06,.74,STEEL,WHITE)
        st.L('balang glass',x,z,[(1.44,.27),(1.5,.34),(1.62,.36),(1.72,.35),(1.79,.29),(1.8,.28),(1.78,.27),(1.71,.335),(1.61,.345),(1.5,.325),(1.455,.255)],
             GLASS,WHITE,n=20,cap_bottom=True)
        st.L('balang drink',x,z,[(1.46,.25),(1.51,.315),(1.62,.335),(1.66,.33)],LIQUID,item_col(item),n=20,cap_bottom=True,cap_top=True)
        for k in range(5):
            st.B('ice cube',x+RNG.uniform(-.18,.18),1.665,z+RNG.uniform(-.18,.18),.07,.05,.07,GLASS,WHITE,ry=RNG.uniform(0,1.5))
        st.L('brass base ring',x,z,[(1.455,.3),(1.5,.305)],STEEL,'#c49a3c',n=20)
        st.L('brass neck ring',x,z,[(1.76,.31),(1.795,.305)],STEEL,'#c49a3c',n=20)
        st.L('balang lid',x,z,[(1.79,.3),(1.83,.28),(1.86,.14),(1.87,.04)],STEEL,WHITE,n=16,cap_top=True)
        st.C('lid knob',x,1.89,z,.03,.04,PLASTIC,'#222222',8)
        st.B('tap body',x,1.55,z+.37,.07,.08,.12,STEEL,'#c49a3c')
        st.C('tap spout',x,1.49,z+.42,.018,.1,STEEL,'#c49a3c',8)
        st.B('tap lever',x,1.62,z+.36,.02,.1,.02,STEEL,'#c49a3c')
        st.B('drip tray',x,top+.075,z+.42,.2,.02,.12,STEEL,'#b0b0aa')
    st.U('ladle',[(-.95,1.97,-.2),(-.9,1.85,-.12),(-.88,1.72,-.1)],.01,STEEL,GALV,5)

def kettle(st):
    """Teh tarik end: kettle on a single ring burner, pull mugs, cup stack and the sealer."""
    bx,bz=1.62,-.1;top=1.38
    st.L('ring burner',bx,bz,[(top,.22),(top+.07,.2)],IRON,CAST,n=14,cap_top=True)
    st.L('kettle',bx,bz,[(1.46,.1),(1.5,.19),(1.7,.215),(1.8,.17),(1.84,.1)],STEEL,'#dcdcd6',n=16,cap_bottom=True,cap_top=True)
    st.C('kettle knob',bx,1.87,bz,.025,.05,PLASTIC,'#222222',8)
    st.U('kettle spout',[(bx-.18,1.58,bz),(bx-.3,1.68,bz),(bx-.36,1.78,bz)],[.03,.022,.016],STEEL,'#dcdcd6',8)
    st.U('kettle handle',[(bx+.12,1.82,bz-.1),(bx+.18,1.98,bz),(bx+.12,1.82,bz+.1)],.012,IRON,BLACK,5)
    for k,x in enumerate((1.12,1.3)):
        st.L('pull mug',x,-.55,[(top,.07),(top+.2,.08),(top+.19,.075),(top+.01,.065)],STEEL,'#c8c8c2',n=12,cap_bottom=True,cap_top=True)
    for i in range(7):st.L('cup stack',.98,.5,[(top+.01+i*.03,.04),(top+.12+i*.03,.055),(top+.115+i*.03,.05)],PLASTIC,'#f2f2ee',n=10)
    # cup sealer: box body, film roll and lever
    sx,sz=1.55,.5
    st.B('sealer body',sx,top+.2,sz,.22,.4,.26,PAINT,'#e7e3da',bevel=.02)
    st.B('sealer mouth',sx,top+.12,sz+.06,.16,.1,.16,IRON,DARK)
    st.C('sealer film',sx,top+.43,sz-.05,.05,.18,PLASTIC,'#e6d7a8',10,axis='x')
    st.S('sealer lever',(sx+.12,top+.36,sz),(sx+.12,top+.52,sz+.22),.02,IRON,RED)
    st.C('straw jar',1.22,top+.12,.54,.06,.22,GLASS,WHITE,10)
    for i in range(6):st.S('straw',(1.2+.01*i,top+.05,.54),(1.18+.02*i,top+.34,.52+.01*i),.008,PLASTIC,(RED,YELLOW,GREEN,BLUE)[i%4])

def bungkus(st):
    """Air bungkus: drinks tied in plastic bags on a string along the left end of the awning."""
    st.S('bag string',(-1.99,2.15,-.6),(-1.99,2.15,.6),.008,IRON,'#e8e2d0')
    for i,item in enumerate(st.s['items']*2):
        z=-.45+i*.17
        st.S('bag knot',(-1.99,2.15,z),(-1.99,2.0,z),.01,GLASS)
        st.L('air bungkus',-1.99,z,[(1.84,.018),(1.87,.045),(1.915,.05),(1.93,.04)],LIQUID,item_col(item),n=8,cap_bottom=True,cap_top=True)
        st.L('bungkus bag',-1.99,z,[(1.835,.024),(1.87,.056),(1.94,.058),(2.0,.012)],GLASS,WHITE,n=8,cap_bottom=True)
        st.S('bag straw',(-1.99,1.93,z),(-1.97,2.04,z+.015),.006,PLASTIC,RED)

def balang_stock(st):
    gas(st,1.6,-.28,BLUE)
    st.U('gas hose',[(1.6,1.24,-.28),(1.7,1.3,-.55),(1.72,1.42,-.3)],.014,IRON,'#222222',5)
    st.B('ice box',.2,.66,-.28,.7,.44,.44,PLASTIC,'#e9edf0',bevel=.03)
    st.B('ice box lid',.2,.9,-.28,.72,.06,.46,PLASTIC,BLUE,bevel=.02)
    oil_tin(st,-.45,-.3)
    for i in range(3):st.B('syrup bottle',-.95+i*.14,.62,-.3,.1,.36,.1,PLASTIC,(SYRUP,'#d9b23a','#6e8a2a')[i],bevel=.02)
    crate(st,-1.5,.44,-.3,RED)
    # a big cooler and a crate of bottles beside the stall
    st.B('cooler',2.45,.3,-.3,.62,.56,.44,PLASTIC,'#d8dde2',bevel=.04)
    st.B('cooler lid',2.45,.61,-.3,.66,.08,.48,PLASTIC,RED,bevel=.03)
    st.B('cooler handle',2.45,.4,-.07,.3,.04,.03,PLASTIC,'#8a8a8a')

def kuih_table(st):
    """Folding table beside the counter: nasi lemak bungkus in a basket, kuih under a clear cover."""
    tx,tz=-3.15,-.25;top=.74
    st.B('table top',tx,top,tz,.9,.03,.66,PLASTIC,'#2a64b0',bevel=.01)
    for dx in (-1,1):
        st.S('table leg',(tx+dx*.38,top-.02,tz-.26),(tx+dx*.4,0,tz+.26),.025,STEEL,GALV)
        st.S('table leg',(tx+dx*.38,top-.02,tz+.26),(tx+dx*.4,0,tz-.26),.025,STEEL,GALV)
    st.L('rattan basket',tx-.2,tz,[(top+.02,.14),(top+.13,.2),(top+.14,.21),(top+.12,.19),(top+.03,.12)],WOOD,RATTAN,n=14,cap_bottom=True,cap_top=True)
    for k in range(7):
        a=k*.9;r=.1 if k else 0
        px,pz=tx-.2+math.cos(a)*r,tz+math.sin(a)*r
        st.L('nasi lemak bungkus',px,pz,[(top+.12,.075),(top+.2,.01)],PLASTIC,LEAF if k%3 else KRAFT,n=4,cap_bottom=True)
    st.B('kuih tray',tx+.22,top+.03,tz,.38,.03,.5,STEEL,'#c2c2bc')
    colours=('#d44d7c','#f0e9d8','#3f9a52','#e2b344','#7b4a2c','#5aa06a')
    for j in range(12):
        st.B('kuih',tx+.1+(j%3)*.12,top+.07,tz-.19+(j//3)*.13,.1,.05,.1,PLASTIC,colours[j%6])
    st.B('kuih cover',tx+.22,top+.13,tz,.4,.18,.52,GLASS)

# ------------------------------------------------------------------ night pools
def pools(st,front):
    """Additive warm pools on the slab and the counter; drawn only at night."""
    st.Q('light pool',0,.02,1.4,5.6,4.2,WASH)
    st.Q('light pool counter',0,1.43,.1,4.4,1.9,WASH)

# ------------------------------------------------------------------ build / export
ANCHORS={}
def stall(s):
    st=Stall(s)
    counter(st);board(st)
    if s['id']=='pisang-goreng':
        ground(st,[(1.7,1.45,1.1,.4),(2.9,-.3,.9,1.2),(-.9,-1.9,1.3,2.2)])
        posts(st,3.35,3.12);zinc_roof(st);bulbs(st,3.43)
        cabinet(st);fryer(st);goreng_prep(st);goreng_stock(st);satay(st)
        stools(st,[(-1.3,1.78,RED),(0,1.85,BLUE),(1.3,1.78,RED)])
        ANCHORS[s['id']]={'flame':[s['x']+WOK[0],1.46,s['z']+WOK[1]],'smoke':[s['x']+SATAY[0],GRILL_Y+.06,s['z']+SATAY[1]],'embers':True}
    else:
        ground(st,[(2.5,-1.0,1.2,.7),(-.4,1.6,.8,2.0),(-2.4,-1.5,1.0,.3)])
        posts(st,3.28,3.28);canvas_roof(st);bulbs(st,3.2)
        balang_jars(st);kettle(st);bungkus(st);balang_stock(st);kuih_table(st)
        stools(st,[(-1.3,1.78,GREEN),(0,1.85,RED),(1.3,1.78,BLUE)])
        ANCHORS[s['id']]={'steam':[s['x']+1.62-.37,1.8,s['z']-.1]}
    pools(st,True)
    for x,z in ((-2.38,.62),):   # blank chalk A-board on the kerb: marks are lines, never letters
        for dx in (-.24,.24):st.S('a-board leg',(x+dx,1.9,z),(x+dx*1.05,0,z+.25),.05,WOOD,'#7a5a3a')
        st.B('a-board slate',x,1.36,z+.07,.62,.95,.035,IRON,'#1f2b25',rx=-.13)
        st.B('a-board frame',x,1.36,z+.05,.7,1.03,.03,WOOD,'#8a6a44',rx=-.13)
        for i in range(4):st.B('chalk line',x,1.62-i*.2,z+.105+i*.026,.4-.06*(i%2),.03,.006,PAINT,'#e8e8df',rx=-.13)
    return st.o

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    for item in STALLS:
        for ob in stall(item):ob.parent=e
    return e

if __name__=='__main__':
    e=build()
    path=PUBLIC/'LM_ENV_Stalls.glb'
    report={'asset':'LM_ENV_Stalls','stalls':[{'id':s['id'],'x':s['x'],'z':s['z']} for s in STALLS],'anchors':ANCHORS,**export(e,path,T)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('STALLS WEB EXPORT',json.dumps(report),flush=True)
