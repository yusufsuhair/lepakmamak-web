"""The two street hawker pushcarts from shared/stalls.json, authored as real Malaysian
gerai: a painted plywood cart on wheels with an open service shelf, a stainless serving
top, a striped canvas awning with a scalloped valance on four steel posts, a hanging
tin-shade bulb, the cooking end (sunken wok in hot oil for Pisang Goreng Mak Cik, kettle
on a burner plus three glass balang for Air Balang Pak Din), a gas bottle on the shelf,
condiment tray, stacked bowls and cups, plastic stools out front and an empty price
board frame. No lettering is baked: the stall name and the price board wording stay the
game's canvas text, drawn on top of this mesh (src/stalls.ts).

Authored in absolute game coordinates, so the GLB drops in at the world origin.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_stalls.py

Output: public/assets/models/environment/LM_ENV_Stalls.glb, root node 'stalls'.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join
from build_klcc import vloft,sphere

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/stalls'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='stalls'
STALLS=json.loads((ROOT/'shared/stalls.json').read_text())

def hexcol(h):
    """#rrggbb (sRGB) -> linear base colour."""
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in (int(h[i:i+2],16)/255 for i in (1,3,5)))

def shade(c,k):return tuple(max(0,min(1,v*k)) for v in c)

CANVAS=mat('Stall canvas',(.93,.91,.83),.72);PLY=mat('Stall plywood',(.55,.40,.26),.75)
STEEL=mat('Stall stainless',(.70,.72,.74),.32);TUBE=mat('Stall post steel',(.56,.58,.60),.45)
DARK=mat('Stall shadow ply',(.10,.10,.11),.8);IRON=mat('Stall cast iron',(.06,.06,.07),.55)
WOK=mat('Stall wok iron',(.07,.07,.08),.5,two_sided=True)  # you look down into it, so both faces
OIL=mat('Stall frying oil',(.55,.32,.06),.20);GAS=mat('Stall gas bottle',(.52,.05,.05),.5)
GASGREY=mat('Stall regulator',(.32,.33,.34),.5);GLASS=mat('Stall balang glass',(.82,.88,.90),.08,alpha=.42,two_sided=True)
BRASS=mat('Stall brass tap',(.62,.45,.11),.28);CHALK=mat('Stall chalk board',(.05,.09,.07),.7)
CHALKLINE=mat('Stall chalk line',(.88,.89,.84),.8);BULB=mat('Stall bulb',(1,.86,.56),.3,emit=5)
SHADEMAT=mat('Stall bulb shade',(.30,.26,.21),.5,two_sided=True);CORD=mat('Stall lamp cord',(.09,.09,.10),.6)
STRIP=mat('Stall sign strip',(1,.95,.78),.35,emit=1.6)
STOOL_A=mat('Stall stool red',(.60,.06,.07),.55);STOOL_B=mat('Stall stool blue',(.06,.16,.42),.55)
CRATE=mat('Stall crate',(.05,.30,.16),.6);TUB=mat('Stall plastic tub',(.72,.72,.70),.55)
WATER=mat('Stall ice water',(.70,.84,.88),.15,alpha=.55,two_sided=True)
CERAMIC=mat('Stall bowl',(.88,.88,.85),.35);CUP=mat('Stall cup',(.90,.91,.92),.4)
SAUCE_A=mat('Stall sauce chilli',(.48,.03,.03),.4);SAUCE_B=mat('Stall sauce soy',(.06,.05,.04),.4)
SAUCE_C=mat('Stall sauce syrup',(.55,.14,.28),.4);FOIL=mat('Stall foil tray',(.62,.63,.64),.4)
PAPER=mat('Stall paper',(.86,.83,.74),.8)

def ring(cx,cz,r,n=16):
    """Circle as a vloft profile: profile points are (x, -z)."""
    return [(cx+r*math.cos(i*math.tau/n),-(cz+r*math.sin(i*math.tau/n))) for i in range(n)]

def cone(name,cx,cz,y0,r0,y1,r1,m,n=12,cap=True):
    """Vertical truncated cone, y0 below y1. vloft is the vertical loft; loft would lie it flat."""
    return vloft(name,[(y0,ring(cx,cz,r0,n)),(y1,ring(cx,cz,r1,n))],[m],T,cap=cap)

def bowl_out(name,cx,cz,rings,m,n=16):
    """Open-topped vessel built bottom-up so the outside faces out; fill it to hide the inside."""
    return vloft(name,[(y,ring(cx,cz,r,n)) for y,r in rings],[m]*(len(rings)-1),T,cap=False)

# ------------------------------------------------------------------ the cart
def cart(s,paint,trim):
    """Pushcart body, awning, posts, lamp and price-board frame. Local x/z about (s.x, s.z),
    +z is the customer side. Collision in stalls.ts is x +-2, z +-.8 about the origin."""
    X,Z=s['x'],s['z'];o=[]
    def B(name,x,y,z,w,h,d,m,bevel=.015):return box(name,X+x,y,Z+z,w,h,d,m,T,bevel)
    def C(name,x,y,z,r,h,m,verts=12,axis='y'):return cyl(name,X+x,y,Z+z,r,h,m,T,axis=axis,verts=verts)
    # carcass: painted front apron, end cheeks, low back kick panel, open service shelf
    o.append(B('cart front',0,.82,.60,3.80,1.02,.10,paint))
    o.append(B('cart front rail',0,1.26,.60,3.86,.10,.14,trim,.01))
    o.append(B('cart kick rail',0,.36,.60,3.80,.12,.13,trim,.01))
    for x in (-1.85,1.85):o.append(B('cart cheek',x,.82,0,.10,1.02,1.30,paint))
    o.append(B('cart back panel',0,.60,-.60,3.70,.58,.08,paint))
    o.append(B('service shelf',0,.34,-.05,3.60,.05,1.05,PLY,.01))
    o.append(B('shelf lip',0,.40,-.58,3.60,.08,.04,PLY,0))
    for x in (-1.6,1.6):
        for z in (-.5,.5):o.append(C('cart leg',x,.16,z,.045,.32,TUBE,8))
    for x in (-1.45,1.45):
        o.append(C('cart wheel',x,.24,-.5,.24,.09,IRON,14,axis='x'))
        o.append(C('wheel hub',x,.24,-.5,.07,.12,TUBE,8,axis='x'))
    o.append(C('push handle',1.98,1.05,0,.028,1.10,TUBE,8,axis='z'))
    for z in (-.45,.45):o.append(C('handle arm',1.94,1.05,z,.028,.20,TUBE,8,axis='x'))
    # serving top with a raised splash lip at the back
    o.append(B('serving top',0,1.34,0,4.00,.10,1.55,STEEL,.02))
    o.append(B('splash lip',0,1.50,-.74,4.00,.22,.06,STEEL,.01))
    o.append(B('top front edge',0,1.30,.80,4.00,.05,.06,STEEL,0))
    # four posts and the frame the awning sits on
    for x in (-1.85,1.85):
        for z in (-.72,.72):o.append(C('awning post',x,1.78,z,.035,3.05,TUBE,8))
    for z in (-.72,.72):o.append(B('awning rail',0,3.26,z,3.86,.055,.055,TUBE,0))
    for x in (-1.85,1.85):o.append(B('awning rail',x,3.26,0,.055,.055,1.50,TUBE,0))
    o.append(B('awning ridge',0,3.50,0,4.20,.06,.06,TUBE,0))
    # striped canvas awning: loft runs along the game z axis, so each stripe is one loft
    for i in range(8):
        x0,x1=-2.10+i*.525,-2.10+(i+1)*.525
        m=paint if i%2 else CANVAS
        prof=lambda y:[(X+x0,y),(X+x1,y),(X+x1,y+.05),(X+x0,y+.05)]
        o.append(loft('awning stripe',[(Z+z,prof(y)) for z,y in ((-1.45,3.10),(-.78,3.36),(0,3.45),(.78,3.36),(1.45,3.10))],m,T))
        # Scalloped hem, pointing down between the stripes. Kept shallow on purpose: a deep
        # valance hangs in front of the canvas name sign (y 2.2-3.0 at z .80) and hides the
        # wording from the third-person camera.
        hem=[(X+x0,3.02),(X+(x0+x1)/2,2.93),(X+x1,3.02),(X+x1,3.14),(X+x0,3.14)]
        o.append(loft('awning valance',[(Z+1.44,hem),(Z+1.48,hem)],m,T))
        back=[(X+x0,3.00),(X+x1,3.00),(X+x1,3.14),(X+x0,3.14)]
        o.append(loft('awning back skirt',[(Z-1.48,back),(Z-1.44,back)],m,T))
    # hanging bulb in a tin shade: the scene has only two real lights, so this one is emissive
    # Behind the sign board, or under it, the bulb was hidden from the third-person camera
    # looking down at the stall. It hangs off the awning's front edge, over the customers.
    # Low on a long cord: level with the board it covered the canvas name text, and behind
    # the board it was invisible from above.
    for x in (-1.05,1.05):
        o.append(C('lamp cord',x,2.69,1.20,.008,1.00,CORD,4))
        o.append(cone('lamp shade',X+x,Z+1.20,2.02,.23,2.19,.07,SHADEMAT,12))
        o.append(sphere('bulb',X+x,1.95,Z+1.20,.072,BULB,T))
        o.append(B('bulb collar',x,2.06,1.20,.05,.10,.05,TUBE,0))
    # price board: an empty frame sized to the game's canvas sign (3.9 x .8 at y 2.60, z .80).
    # A taller backing hangs low enough to crop the balang jars behind it.
    o.append(B('board backing',0,2.60,.70,4.06,.86,.09,paint))
    o.append(B('board bezel',0,3.07,.76,4.14,.09,.11,trim,.01))
    o.append(B('board bezel',0,2.13,.76,4.14,.09,.11,trim,.01))
    for x in (-2.02,2.02):o.append(B('board bezel',x,2.60,.76,.10,1.00,.11,trim,.01))
    o.append(B('board lamp hood',0,3.24,.86,3.00,.05,.16,TUBE,0))
    o.append(B('board lamp strip',0,3.18,.86,2.90,.05,.07,STRIP,0))
    # chalk A-board on the kerb, blank: chalk marks are geometry lines, never letters
    for x in (-2.62,-2.14):o.append(B('chalk leg',x,.95,.62,.07,1.90,.07,PLY,.01))
    o.append(B('chalk board',-2.38,1.36,.62,.62,1.00,.05,CHALK,.01))
    o.append(B('chalk frame',-2.38,1.36,.58,.70,1.08,.04,PLY,.01))
    for i in range(4):o.append(B('chalk line',-2.38,1.66-i*.22,.653,.40-.06*(i%2),.035,.01,CHALKLINE,0))
    # three plastic stools out front, past the counter collider
    for i,x in enumerate((-1.30,0,1.30)):
        m=STOOL_A if i%2==0 else STOOL_B
        o.append(cone('stool body',X+x,Z+1.78,.03,.215,.44,.155,m,10,cap=False))
        o.append(C('stool seat',x,.465,1.78,.175,.05,m,12))
        o.append(C('stool ring',x,.22,1.78,.19,.03,m,10))
    # crates and a tub where the procedural cooler stood, off the walkable side
    for i in range(2):o.append(B('crate',2.22,.24+i*.34,-.30,.66,.32,.50,CRATE,.01))
    o.append(cone('plastic tub',X+2.22,Z-.30,.92,.26,1.20,.31,TUB,10,cap=False))
    o.append(C('tub water',2.22,1.16,-.30,.29,.03,WATER,10))
    o.append(B('bin bag hook',1.90,1.00,.66,.05,.05,.05,TUBE,0))
    return o

def shelf_stock(s,o):
    """Gas bottle feeding the burner, plus stock under the counter."""
    X,Z=s['x'],s['z']
    o.append(cyl('gas bottle',X+1.28,.67,Z-.28,.185,.60,GAS,T,verts=12))
    o.append(cone('gas shoulder',X+1.28,Z-.28,.97,.185,1.06,.09,GAS,12))
    o.append(cyl('gas valve',X+1.28,1.10,Z-.28,.035,.10,GASGREY,T,verts=8))
    o.append(cyl('gas regulator',X+1.28,1.17,Z-.28,.065,.06,GASGREY,T,verts=8))
    o.append(cyl('gas hose',X+1.28,1.24,Z-.20,.018,.20,GASGREY,T,axis='z',verts=6))
    for i in range(2):o.append(box('stock crate',X-1.30,.44+i*.30,Z-.20,.62,.28,.44,CRATE,T,.01))
    for i in range(3):o.append(cyl('stock bottle',X-1.55+i*.25,.80,Z-.20,.055,.30,SAUCE_C,T,verts=6))
    o.append(box('paper stack',X-.10,.42,Z-.20,.50,.11,.36,PAPER,T,0))

def counter_kit(s,o,sauces):
    """Condiment tray, stacked bowls, cups and cutlery: repeated small props, bevel 0."""
    X,Z=s['x'],s['z'];top=1.39
    o.append(box('condiment tray',X+.22,top+.03,Z+.50,.52,.06,.28,FOIL,T,0))
    for i,m in enumerate(sauces):
        o.append(cyl('sauce bottle',X+.03+i*.19,top+.20,Z+.50,.048,.28,m,T,verts=6))
        o.append(cyl('sauce cap',X+.03+i*.19,top+.36,Z+.50,.036,.04,DARK,T,verts=6))
    for j,(bx,bz) in enumerate(((.02,-.38),(.36,-.38))):
        for i in range(4):o.append(cyl('bowl stack',X+bx,top+.035+i*.055,Z+bz,.115-.004*i,.055,CERAMIC,T,verts=10))
    for i in range(5):o.append(cyl('cup stack',X+.52,top+.05+i*.075,Z+.46,.052,.12,CUP,T,verts=8))
    o.append(cyl('cutlery jar',X-.16,top+.13,Z-.34,.065,.20,TUB,T,verts=8))
    for i in range(5):o.append(box('cutlery',X-.19+.015*i,top+.30,Z-.34,.012,.22,.012,STEEL,T,0))
    o.append(box('tissue box',X+.62,top+.06,Z-.30,.22,.10,.14,PAPER,T,0))

# ------------------------------------------------------------------ pisang goreng
def fryer(s,o):
    X,Z=s['x'],s['z'];items=s['items'];top=1.39
    wx,wz=1.22,-.05
    # The wok stands on its burner on the counter. Sunk level with the serving top, the
    # slab swallowed the bowl and a collar box lay across its mouth: a dark sliver, no wok.
    o.append(cyl('burner base',X+wx,1.44,Z+wz,.30,.10,IRON,T,verts=12))
    o.append(cone('burner ring',X+wx,Z+wz,1.49,.30,1.56,.22,IRON,12,cap=False))
    o.append(bowl_out('wok',X+wx,Z+wz,((1.46,.14),(1.55,.33),(1.66,.47),(1.76,.55)),WOK))
    # A cylinder for the rim is a solid disc: it lidded the wok and hid the oil. Flared ring.
    o.append(cone('wok rim',X+wx,Z+wz,1.76,.55,1.80,.60,WOK,16,cap=False))
    o.append(cyl('frying oil',X+wx,1.68,Z+wz,.46,.03,OIL,T,verts=16))
    for x in (-.62,.62):o.append(box('wok ear',X+wx+x,1.79,Z+wz,.10,.04,.20,IRON,T,0))
    # fritters half-sunk in the oil, rotated for variety; plain cubes, no bevel
    hot=mat(f"Stall item {items[0]['id']}",hexcol(items[0]['color']),.55)
    for i in range(5):
        a=i*1.26
        f=box('frying fritter',X+wx+math.cos(a)*.24,1.70,Z+wz+math.sin(a)*.22,.15,.06,.09,hot,T,0)
        f.rotation_euler.z=a;o.append(f)
    # wire drainer over a foil tray, with the skimmer resting across it
    o.append(box('drainer tray',X+wx,1.43,Z+wz+.62,.96,.07,.32,FOIL,T,0))
    for i in range(7):o.append(box('drainer bar',X+wx-.42+i*.14,1.48,Z+wz+.62,.02,.02,.32,STEEL,T,0))
    for i in range(3):o.append(box('drained fritter',X+wx-.22+i*.22,1.53,Z+wz+.60,.15,.06,.09,hot,T,0))
    o.append(cyl('skimmer handle',X+wx-.30,1.84,Z+wz+.34,.014,.62,PLY,T,verts=6,axis='z'))
    o.append(cyl('skimmer mesh',X+wx-.30,1.82,Z+wz-.04,.13,.02,STEEL,T,verts=12))
    # a dark rubber mat: without it the serving top is one unbroken pale sheet
    o.append(box('counter mat',X-.96,1.393,Z+.02,2.00,.012,.72,DARK,T,0))
    # three trays of finished goreng along the counter, one per item
    for i,item in enumerate(items):
        m=mat(f"Stall item {item['id']}",hexcol(item['color']),.55)
        tx=-1.62+i*.66
        o.append(box('goreng tray',X+tx,top+.03,Z+.02,.60,.06,.62,FOIL,T,0))
        o.append(box('tray liner',X+tx,top+.07,Z+.02,.54,.02,.56,PAPER,T,0))
        for j in range(6):
            f=box('goreng',X+tx-.17+(j%3)*.17,top+.13+(j//3)*.07,Z-.12+(j//3)*.24,.16,.07,.12,m,T,0)
            f.rotation_euler.z=.5*(1 if j%2 else -1);o.append(f)
    o.append(box('price peg',X+.02,top+.40,Z+.02,.18,.12,.01,PAPER,T,0))

# ------------------------------------------------------------------ air balang
def balang(s,o):
    X,Z=s['x'],s['z'];items=s['items'];top=1.39
    for i,item in enumerate(items):
        m=mat(f"Stall item {item['id']}",hexcol(item['color']),.25)
        x=-1.50+i*1.10
        o.append(box('jar stand',X+x,top+.03,Z-.02,.74,.06,.74,STEEL,T,0))
        # A half-metre jar, with brass rings and a real tap. Taller and the sign board at
        # z .70 cuts its head off from any camera above eye level; at alpha .26 the glass
        # read as nothing and the jar looked like a drum of colour.
        o.append(bowl_out('balang jar',X+x,Z-.02,((1.45,.28),(1.51,.345),(1.71,.355),(1.79,.29)),GLASS))
        o.append(cyl('balang drink',X+x,1.59,Z-.02,.325,.26,m,T,verts=16))
        o.append(cyl('balang base ring',X+x,1.48,Z-.02,.295,.05,BRASS,T,verts=16))
        o.append(cyl('balang neck ring',X+x,1.78,Z-.02,.305,.04,BRASS,T,verts=16))
        o.append(cone('balang lid',X+x,Z-.02,1.80,.30,1.86,.12,STEEL,12))
        o.append(cyl('lid knob',X+x,1.88,Z-.02,.035,.05,STEEL,T,verts=8))
        o.append(box('balang tap',X+x,1.56,Z+.36,.09,.11,.22,BRASS,T,0))
        o.append(cyl('tap spout',X+x,1.46,Z+.44,.022,.14,BRASS,T,verts=6))
        o.append(cyl('tap lever',X+x,1.66,Z+.36,.014,.12,BRASS,T,verts=6))
    # teh tarik end: kettle on a single burner, pull cups, straw jar
    bx=1.62
    o.append(cyl('burner ring',X+bx,1.43,Z-.10,.24,.06,IRON,T,verts=12))
    for i in range(3):
        arm=box('burner arm',X+bx,1.47,Z-.10,.44,.02,.06,IRON,T,0);arm.rotation_euler.z=i*1.05;o.append(arm)
    o.append(bowl_out('kettle',X+bx,Z-.10,((1.48,.09),(1.55,.20),(1.78,.22),(1.86,.16)),STEEL))
    o.append(cyl('kettle lid',X+bx,1.88,Z-.10,.175,.035,STEEL,T,verts=12))
    o.append(cyl('kettle knob',X+bx,1.92,Z-.10,.028,.05,STEEL,T,verts=6))
    o.append(cyl('kettle spout',X+bx-.26,1.74,Z-.10,.028,.26,STEEL,T,verts=6,axis='x'))
    o.append(box('kettle handle',X+bx,2.02,Z-.10,.28,.025,.025,TUBE,T,0))
    for z in (-.22,.02):o.append(box('kettle handle arm',X+bx+.13,1.95,Z+z,.025,.16,.025,TUBE,T,0))
    o.append(cyl('straw jar',X+.98,top+.14,Z+.48,.075,.22,TUB,T,verts=8))
    for i in range(6):o.append(box('straw',X+.95+.02*i,top+.34,Z+.48,.012,.26,.012,SAUCE_C,T,0))
    o.append(box('ice box',X-.18,.60,Z-.30,.62,.46,.40,TUB,T,.01))
    o.append(box('ice box lid',X-.18,.85,Z-.30,.66,.05,.44,STEEL,T,0))

# ------------------------------------------------------------------ build / export
def stall(s):
    paint=mat(f"Stall paint {s['id']}",hexcol(s['color']),.5)
    trim=mat(f"Stall trim {s['id']}",shade(hexcol(s['color']),.45),.55)
    o=cart(s,paint,trim);shelf_stock(s,o)
    if s['id']=='air-balang':
        counter_kit(s,o,(SAUCE_C,SAUCE_A,SAUCE_B));balang(s,o)
    else:
        counter_kit(s,o,(SAUCE_A,SAUCE_B,SAUCE_C));fryer(s,o)
    return o

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new('stalls',None);s.collection.objects.link(e)
    for item in STALLS:
        for ob in stall(item):ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'stalls | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Stalls.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_Stalls','stalls':[{'id':s['id'],'x':s['x'],'z':s['z']} for s in STALLS],
            'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('STALLS WEB EXPORT',json.dumps(report),flush=True)

def render():
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1500;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(52),math.radians(14),math.radians(150))
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Stall ground',(.30,.32,.29),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam
    from mathutils import Vector
    goreng=next(x for x in STALLS if x['id']=='pisang-goreng');drinks=next(x for x in STALLS if x['id']=='air-balang')
    views={
        'goreng':(((goreng['x']+5.2,3.6,goreng['z']+6.4),(goreng['x'],1.9,goreng['z'])),32),
        'goreng-counter':(((goreng['x']+1.5,1.95,goreng['z']+2.5),(goreng['x']+1.15,1.5,goreng['z'])),40),
        'balang':(((drinks['x']-5.0,3.4,drinks['z']+6.6),(drinks['x'],1.9,drinks['z'])),32),
        'balang-counter':(((drinks['x']-.7,1.85,drinks['z']+2.6),(drinks['x']-.4,1.6,drinks['z'])),42),
        'street':(((goreng['x']+9,4.6,goreng['z']+9),((goreng['x']+drinks['x'])/2,2.0,(goreng['z']+drinks['z'])/2)),24),
        'back':(((goreng['x']-3.5,2.8,goreng['z']-5.5),(goreng['x'],1.4,goreng['z'])),32),
    }
    for name,((eye,at),lens) in views.items():
        cam.data.lens=lens;cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'stalls.blend'))
