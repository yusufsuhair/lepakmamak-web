"""Wet Deck · Sky Dining, the rooftop venue on the hotel at (-106,44,37): a vaulted
ceiling of pale ribs with four blue emissive ribbons, a warm-backlit bar with its
back-bar bottle wall, navy banquettes with magenta cushions, the broad shallow pool
steps, travertine deck slabs that leave the recessed basin untouched, a glass
balustrade round the north edge, the rooftop lift vestibule and its street-level
lift lobby down at ground level.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_skydining.py

Output: public/assets/models/environment/LM_ENV_SkyDining.glb, node 'skydining'.
Coordinates are game metres local to the SKY root (deck top y=0, street y=-44).

The pool basin is load bearing: the four deck slabs below leave a real void at
x -10..10, z -14..-6 so swimmers stay visible. The numbers are copied verbatim from
src/sky-dining.ts; the water surface and basin floor stay procedural in the runtime.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,sweep,join

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/skydining'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='skydining'
STREET=-44.0   # local y of the city pavement

# One material is one draw call, so near-identical tones share a slot on purpose.
TRAV=mat('Deck travertine',(.74,.69,.64),.68);TEAK=mat('Deck teak',(.46,.33,.22),.62)
KERB=mat('Pool tile',(.28,.49,.60),.35);STEP=mat('Pool step',(.53,.66,.76),.45)
HOTEL=mat('Hotel crown',(.14,.19,.28),.75);HOTEL2=mat('Crown band',(.20,.27,.36),.6)
CEIL=mat('Lounge navy',(.12,.15,.23),.74);RIB=mat('Ceiling rib',(.80,.78,.80),.5)
COL=mat('Lounge column',(.72,.66,.71),.45)
GLASS=mat('Balustrade glass',(.62,.84,.93),.08,alpha=.22,two_sided=True)
STEEL=mat('Brushed steel',(.68,.70,.73),.32);DARK=mat('Dark metal',(.09,.09,.11),.55)
BARBODY=mat('Bar joinery',(.18,.17,.26),.52);BARTOP=mat('Bar terrazzo',(.87,.83,.75),.4)
NAVY=mat('Banquette navy',(.10,.14,.26),.78)
MAGENTA=mat('Cushion magenta',(.65,.23,.50),.72);PLUM=mat('Cushion plum',(.45,.38,.70),.72)
POT=mat('Planter slate',(.15,.24,.27),.7);LEAF=mat('Planter leaf',(.27,.43,.41),.6)
SEAT=mat('Chair shell',(.31,.23,.37),.68);LEG=mat('Warm tan trim',(.74,.66,.49),.42)
BOT1=mat('Bottle green',(.40,.75,.67),.25,alpha=.75,two_sided=True)
BOT3=mat('Bottle amber',(.87,.72,.40),.25,alpha=.75,two_sided=True)
BLUE=mat('Strand blue',(.10,.42,1.0),.3,emit=1.5)
PINK=mat('Strand magenta',(.88,.10,.92),.3,emit=1.4)
GOLD=mat('Warm strip',(1,.70,.34),.3,emit=1.2)
LAMP=mat('Ceiling lamp',(1,.95,.85),.4,emit=1.8)
COPING=TRAV;WALL=CEIL;NAVY2=NAVY;SEATB=SEAT;PED=LEG;TABLE=BARBODY
DECK_LIFT=HOTEL;BACKLIT=GOLD;BOT2=BOT1;STOOL=PLUM

def rbox(name,cx,cz,yaw,lx,y,lz,w,h,d,m,bev=0):
    """Box at (lx,y,lz) inside a group standing at (cx,cz) turned by game yaw."""
    s,c=math.sin(yaw),math.cos(yaw)
    o=box(name,cx+lx*c+lz*s,y,cz-lx*s+lz*c,w,h,d,m,T,bev);o.rotation_euler.z=yaw;return o

def arc_band(cx,cy,rx,ry,band,n=16):
    """Half-arc band profile in (x,y): outer arc springing at cy, then back inside."""
    outer=[(cx+rx*math.cos(math.pi*i/n),cy+ry*math.sin(math.pi*i/n)) for i in range(n+1)]
    inner=[(cx+(rx-band)*math.cos(math.pi*i/n),cy+(ry-band)*math.sin(math.pi*i/n)) for i in range(n+1)]
    return outer+inner[::-1]

# ---------------------------------------------------------------- hotel crown + deck
def crown():
    o=[]
    # the hotel top the deck sits on: same 34 x 30 mass, y -6 .. -2.2
    o.append(box('crown mass',0,-4.1,0,34,3.8,30,HOTEL,T,.06))
    for y in (-5.4,-4.1,-2.8):
        o.append(box('crown glazing',0,y,0,34.2,.62,30.2,HOTEL2,T,0))
    o.append(box('crown cornice',0,-2.05,0,35.4,.3,31.4,HOTEL2,T,.04))
    for s in (-1,1):
        o.append(box('crown pilaster',s*16.6,-4.1,0,.8,3.6,30.4,HOTEL,T,.04))
        o.append(box('crown pilaster',0,-4.1,s*14.6,34.4,3.6,.8,HOTEL,T,.04))
    return o

def deck():
    """Four slabs leaving the recessed basin at x -10..10, z -14..-6. Verbatim footprints."""
    o=[]
    slabs=((0,5,36,22),(-14,-10,8,8),(14,-10,8,8),(0,-15,36,2))
    for i,(x,z,w,d) in enumerate(slabs):
        o.append(box(f'deck slab {i}',x,-.3,z,w,.6,d,TRAV,T,.04))
        o.append(box(f'deck fascia {i}',x,-.62,z,w-.1,.06,d-.1,COPING,T,0))
    # teak inlay strips over the main lounge-side slab, and across the two pool wings
    for j in range(17):
        o.append(box('deck strip',0,.012,-5.4+j*1.28,35.2,.024,.12,TEAK,T,0))
    for s in (-1,1):
        for j in range(6):
            o.append(box('deck strip',s*14,.012,-13.6+j*1.28,7.4,.024,.12,TEAK,T,0))
    # stone coping round the basin rim, and the reproduced pool kerbs
    for s in (-1,1):
        o.append(box('basin coping',s*10.2,.02,-10,.5,.08,8.6,COPING,T,0))
        o.append(box('basin coping',0,.02,-10+s*4.3,20.4,.08,.5,COPING,T,0))
        o.append(box('pool kerb',s*9.2,-.5,-10,.35,1.5,8.5,KERB,T,0))
        o.append(box('pool kerb',0,-.5,-10+s*4.2,18.5,1.5,.35,KERB,T,0))
        o.append(box('pool edge light',0,.03,-10+s*4.2,18.5,.07,.14,PINK,T,0))
    # broad shallow steps into the shallow end, treads and risers
    for i in range(4):
        y=-.15-i*.34;z=-6.05-i*.65
        o.append(box('pool tread',0,y,z,3.8,.3,.75,STEP,T,0))
        o.append(box('tread nose',0,y+.16,z-.36,3.9,.05,.1,COPING,T,0))
        for s in (-1,1):o.append(box('step cheek',s*2.05,y-.05,z,.3,.5,.8,STEP,T,0))
    return o

def balustrade():
    """Glass edge on all four sides with a warm top rail: colliders already match."""
    o=[]
    for s in (-1,1):
        o.append(box('edge glass',s*17.7,.8,0,.12,1.6,32,GLASS,T,0))
        o.append(box('edge rail',s*17.7,1.63,0,.17,.09,32,GOLD,T,0))
        o.append(box('edge shoe',s*17.7,.08,0,.3,.16,32,STEEL,T,0))
        o.append(box('deck cove',s*17.45,.05,0,.1,.06,31.6,BLUE,T,0))
        o.append(box('edge glass',0,.8,s*15.7,36,1.6,.12,GLASS,T,0))
        o.append(box('edge rail',0,1.63,s*15.7,36,.09,.17,GOLD,T,0))
        o.append(box('edge shoe',0,.08,s*15.7,36,.16,.3,STEEL,T,0))
        o.append(box('deck cove',0,.05,s*15.45,35.6,.06,.1,BLUE,T,0))
        for z in range(-16,17,4):o.append(box('edge post',s*17.7,.82,z,.16,1.7,.16,STEEL,T,0))
        for x in range(-18,19,4):o.append(box('edge post',x,.82,s*15.7,.16,1.7,.16,STEEL,T,0))
    return o

# ---------------------------------------------------------------- lounge shell
def lounge():
    o=[]
    # dark panelled back wall with vertical fluting behind the venue sign
    o.append(box('back wall',0,2.6,15.5,36,5.2,.15,WALL,T,.03))
    for j in range(30):
        o.append(box('wall flute',-17.4+j*1.2,2.6,15.38,.34,5.0,.1,CEIL,T,0))
    o.append(box('sign panel',0,3.7,15.32,15.4,1.9,.1,DARK,T,0))
    o.append(box('sign shelf',0,2.68,15.25,15.4,.08,.24,GOLD,T,0))
    # side glazing with mullions
    for s in (-1,1):
        o.append(box('lounge glass',s*17.5,2.6,9,.12,5.2,13,GLASS,T,0))
        for z in (2.8,5.4,9,12.6,15.2):o.append(box('lounge mullion',s*17.5,2.6,z,.2,5.2,.16,STEEL,T,0))
        for y in (.1,5.1):o.append(box('lounge transom',s*17.5,y,9,.22,.16,13,STEEL,T,0))
    # vaulted ceiling: a pale shell, five structural ribs, four blue emissive ribbons
    o.append(box('back soffit',0,5.15,14.5,35,.22,2.2,CEIL,T,.03))
    o.append(box('soffit cove',0,5.0,13.44,34.6,.08,.14,GOLD,T,0))
    for z in (4.0,9.0,14.0):
        o.append(sweep('ceiling rib',arc_band(0,4.86,17.1,.36,.18),z-.09,z+.09,RIB,T))
    for z in (5.6,8.0,10.4,12.8):
        o.append(sweep('ceiling ribbon',arc_band(0,4.82,16.9,.34,.12),z-.06,z+.06,BLUE,T))
    for s in (-1,1):o.append(box('ceiling valance',s*17.2,4.98,9,.34,.4,13.2,CEIL,T,.03))
    o.append(box('front fascia',0,5.0,2.35,35.4,.34,.25,CEIL,T,.03))
    o.append(box('front cove',0,4.8,2.42,35,.08,.14,GOLD,T,0))
    for x in (-12,-4,4,12):
        for z in (4.2,10.2):o.append(cyl('downlight',x,5.2,z,.14,.05,LAMP,T,verts=10))
    # hanging strands in front of the back wall, the venue's signature curtain
    o.append(box('strand track',0,5.18,15.25,35,.12,.16,DARK,T,0))
    for i in range(52):
        x=-17+i*34/51
        o.append(box('strand',x,3.8,15.25,.035,2.7,.035,BLUE if i%3 else PINK,T,0))
    # four slender fluted columns on the lounge front line
    for x in (-16,-8,8,16):
        o.append(cyl('column',x,2.6,3,.13,5.2,COL,T,verts=12))
        o.append(box('column base',x,.09,3,.4,.18,.4,STEEL,T,0))
        o.append(box('column cap',x,5.1,3,.36,.14,.36,STEEL,T,0))
    return o

def bar():
    """Counter at z=3 facing the lounge, back-bar bottle wall backlit warm on the pool side."""
    o=[]
    o.append(box('bar body',0,.6,3,12,1.2,2.4,BARBODY,T,.04))
    o.append(box('bar top',0,1.27,3,12.5,.18,2.8,BARTOP,T,.03))
    o.append(box('bar nosing',0,1.15,4.42,12.5,.1,.1,GOLD,T,0))
    o.append(box('bar kick',0,.15,1.57,11.8,.15,.08,GOLD,T,0))
    o.append(box('bar plinth',0,.07,3,12.2,.14,2.6,DARK,T,0))
    for j in range(9):
        x=-5+j*1.25
        o.append(cyl('counter bottle',x,1.61,3,.085,.5,(BOT1,BOT2,BOT3)[j%3],T,verts=6))
        o.append(cyl('bottle neck',x,1.92,3,.03,.14,(BOT1,BOT2,BOT3)[j%3],T,verts=6))
        # stools on the lounge side
        o.append(cyl('stool seat',x,.6,5.3,.33,.14,STOOL,T,verts=12))
        o.append(cyl('stool column',x,.3,5.3,.05,.6,LEG,T,verts=8))
        o.append(cyl('stool foot',x,.03,5.3,.24,.05,DARK,T,verts=12))
    # back bar: base cabinet, warm backlit panel, three shelves of bottles
    o.append(box('back bar base',0,.45,1.35,12,.9,.5,BARBODY,T,.03))
    o.append(box('back bar counter',0,.94,1.35,12.2,.08,.6,BARTOP,T,0))
    o.append(box('back bar glow',0,2.05,1.20,11.6,2.1,.06,BACKLIT,T,0))
    for y in (.96,3.14):o.append(box('back bar frame',0,y,1.17,12,.14,.1,DARK,T,0))
    for x in (-5.87,5.87):o.append(box('back bar frame',x,2.05,1.17,.26,2.3,.1,DARK,T,0))
    for k,y in enumerate((1.32,1.86,2.4)):
        o.append(box('back bar shelf',0,y,1.38,11.6,.06,.34,STEEL,T,0))
        for j in range(8):
            x=-4.9+j*1.4
            o.append(cyl('shelf bottle',x,y+.24,1.38,.075,.42,(BOT1,BOT2,BOT3)[(j+k)%3],T,verts=6))
    return o

def banquettes():
    o=[]
    for x in (-11,0,11):
        o.append(box('banquette base',x,.45,13.4,7,.65,1.7,NAVY,T,.04))
        o.append(box('banquette back',x,1.05,14.15,7,1,.25,NAVY2,T,.04))
        o.append(box('banquette piping',x,.79,12.58,7,.08,.12,GOLD,T,0))
        o.append(box('banquette plinth',x,.06,13.4,6.8,.12,1.6,DARK,T,0))
        for j,dx in enumerate((-2,0,2)):
            o.append(box('cushion',x+dx,.9,13.7,1,.75,.25,MAGENTA if j%2 else PLUM,T,0))
        for dx in (-3.2,3.2):o.append(box('banquette arm',x+dx,.72,13.4,.3,.55,1.7,NAVY2,T,0))
    return o

def planters():
    o=[]
    for x in (-16,16):
        for z in (-14,-5):
            o.append(box('planter',x,.45,z,1.25,.9,1.25,POT,T,.05))
            o.append(box('planter rim',x,.93,z,1.33,.1,1.33,COPING,T,0))
            o.append(box('planter soil',x,.88,z,1.05,.06,1.05,DARK,T,0))
            for j in range(5):
                leaf=box('planter leaf',x+math.sin(j*1.3)*.3,1.2,z+math.cos(j*1.3)*.3,.16,1.3,.5,LEAF,T,0)
                leaf.rotation_euler.y=-math.sin(j)*.35
                o.append(leaf)
    return o

def furniture():
    """Rooftop tables and their 37 chairs, read from the shared seating data."""
    o=[]
    tables=[t for t in json.loads((ROOT/'shared/tables.json').read_text()) if t['id'].startswith('sky-')]
    chairs=json.loads((ROOT/'shared/chairs.json').read_text())
    for t in tables:
        x,z=t['x']+106,t['z']-37
        large=t['id']=='sky-7'
        if large:
            o.append(cyl('table top',x,.9,z,1.9,.15,TABLE,T,verts=28))
            o.append(cyl('table rim',x,.82,z,1.92,.05,PED,T,verts=28))
        else:
            o.append(box('table top',x,.9,z,2.2,.15,2.2,TABLE,T,.04))
            o.append(box('table rim',x,.81,z,2.24,.05,2.24,PED,T,0))
        o.append(cyl('table pedestal',x,.43,z,.13,.85,PED,T,verts=12))
        o.append(cyl('table foot',x,.05,z,.45 if not large else .6,.1,DARK,T,verts=14))
        o.append(box('table lamp',x,1.06,z,.18,.24,.18,PINK,T,0))
        for c in chairs:
            if c.get('tableId')!=t['id']:continue
            cx,cz,yaw=c['x']+106,c['z']-37,c['yaw']
            rbox('chair seat',cx,cz,yaw,0,.5,0,.85,.18,.85,SEAT)
            rbox('chair back',cx,cz,yaw,0,.96,-.38,.9,.85,.15,SEATB)
            rbox('chair skirt',cx,cz,yaw,0,.41,0,.78,.08,.78,SEATB)
            for dx in (-.32,.32):
                for dz in (-.32,.32):rbox('chair leg',cx,cz,yaw,dx,.25,dz,.06,.5,.06,LEG)
    return o

def dj():
    o=[]
    o.append(box('dj desk',-14,1,5.5,3.3,.28,1.2,DARK,T,.03))
    o.append(box('dj fascia',-14,.65,5.5,3.1,.7,1.1,BARBODY,T,.03))
    o.append(box('dj light',-14,.28,4.92,3.0,.08,.1,PINK,T,0))
    for x in (-14.8,-13.2):
        o.append(cyl('deck platter',x,1.17,5.5,.38,.04,STEEL,T,verts=18))
        o.append(cyl('platter spindle',x,1.21,5.5,.04,.05,DARK,T,verts=8))
    o.append(box('mixer',-14,1.17,5.5,.55,.06,.5,DARK,T,0))
    for x in (-16.3,-11.7):
        o.append(box('speaker',x,.8,5.5,.7,1.6,.65,DARK,T,.03))
        for y in (.45,1.2):o.append(cyl('speaker cone',x,y,5.18,.22,.05,BARBODY,T,axis='z',verts=14))
        o.append(box('speaker light',x,1.58,5.18,.5,.05,.06,BLUE,T,0))
    return o

def lift_vestibule():
    """Open-fronted cabin at (14,12): back wall on z=13.4 where the collider is, front clear."""
    o=[]
    o.append(box('vestibule floor',14,.05,12,3.8,.14,3,STEEL,T,0))
    o.append(box('vestibule back',14,1.6,13.4,3.8,3.2,.2,DECK_LIFT,T,.04))
    for s in (-1,1):o.append(box('vestibule side',14+s*1.8,1.6,12.05,.2,3.2,2.9,DECK_LIFT,T,.04))
    o.append(box('vestibule roof',14,3.3,12,4.1,.2,3.3,DECK_LIFT,T,.04))
    o.append(box('vestibule ceiling light',14,3.14,12,3.0,.06,2.1,LAMP,T,0))
    o.append(box('vestibule head',14,2.95,10.6,4.1,.5,.3,DECK_LIFT,T,.03))
    o.append(box('vestibule head light',14,2.66,10.55,3.6,.08,.14,GOLD,T,0))
    for s in (-1,1):o.append(box('lift door',14+s*.5,1.15,13.26,.98,2.3,.06,STEEL,T,0))
    o.append(box('lift door seam',14,1.15,13.22,.05,2.3,.04,DARK,T,0))
    o.append(box('lift architrave',14,2.39,13.2,2.5,.14,.07,GOLD,T,0))
    for s in (-1,1):o.append(box('lift architrave',14+s*1.18,1.18,13.2,.14,2.36,.07,GOLD,T,0))
    o.append(box('lift threshold',14,.05,13.2,2.5,.06,.07,DARK,T,0))
    o.append(box('call plate',15.4,1.2,13.22,.3,.5,.06,DARK,T,0))
    o.append(box('call button',15.4,1.2,13.17,.12,.12,.05,GOLD,T,0))
    o.append(box('floor indicator',14,2.6,13.2,.9,.22,.06,BLUE,T,0))
    return o

def street_lobby():
    """Ground-level lift lobby at local (12, STREET, 20): doors face +z, under the sign."""
    o=[];y0=STREET
    o.append(box('lobby pad',12,y0+.04,20.2,4.6,.1,2.6,COPING,T,0))
    o.append(box('lobby core',12,y0+1.6,19.55,3.4,3.2,1.1,DECK_LIFT,T,.04))
    for s in (-1,1):o.append(box('lobby jamb',12+s*1.5,y0+1.6,20.35,.4,3.2,.5,DECK_LIFT,T,.03))
    o.append(box('lobby lintel',12,y0+3.0,20.35,3.4,.4,.5,DECK_LIFT,T,.03))
    o.append(box('lobby canopy',12,y0+3.32,20.95,4.4,.18,1.9,DECK_LIFT,T,.03))
    o.append(box('canopy soffit light',12,y0+3.2,20.95,3.6,.06,1.4,GOLD,T,0))
    for s in (-1,1):o.append(box('lobby door',12+s*.62,y0+1.45,20.5,1.2,2.9,.08,STEEL,T,0))
    o.append(box('lobby architrave',12,y0+3.02,20.56,2.7,.14,.06,GOLD,T,0))
    for s in (-1,1):o.append(box('lobby architrave',12+s*1.28,y0+1.5,20.56,.14,3.05,.06,GOLD,T,0))
    o.append(box('lobby glazing',12,y0+1.9,20.54,2.2,1.7,.04,GLASS,T,0))
    o.append(box('lobby sign back',12,y0+3.7,20.72,5.4,1.0,.1,DARK,T,0))
    o.append(box('lobby sign trim',12,y0+4.24,20.72,5.4,.1,.14,GOLD,T,0))
    o.append(box('lobby sign trim',12,y0+3.16,20.72,5.4,.1,.14,GOLD,T,0))
    o.append(box('lobby threshold',12,y0+.1,20.5,2.8,.06,.5,DARK,T,0))
    return o

# ---------------------------------------------------------------- build / export
def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    for stage in (crown,deck,balustrade,lounge,bar,banquettes,planters,furniture,dj,lift_vestibule,street_lobby):stage()
    # primitive_*_add lands in the active collection, loft() in the scene collection: sweep both.
    for ob in [o for o in s.objects if o.type=='MESH']:ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'skydining | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_SkyDining.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_SkyDining','origin':[-106,44,37],'deck':[36,32],'basin':{'x':[-10,10],'z':[-14,-6]},
            'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('SKYDINING WEB EXPORT',json.dumps(report),flush=True)

def render():
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1600;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True
    bg=w.node_tree.nodes['Background']
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun)
    sun.rotation_euler=(math.radians(52),math.radians(18),math.radians(-30))
    # stand-in water so the basin reads as a pool in the preview (not exported)
    bpy.ops.mesh.primitive_cube_add(size=1,location=pt(0,-.18,-10));water=bpy.context.object;water.scale=(18,8,.06)
    water.data.materials.append(mat('Preview water',(.30,.20,.55),.18,emit=.4))
    bpy.ops.mesh.primitive_cube_add(size=1,location=pt(0,-1.8,-10));floorp=bpy.context.object;floorp.scale=(18,8,.25)
    floorp.data.materials.append(mat('Preview basin',(.14,.42,.52),.5))
    bpy.ops.mesh.primitive_plane_add(size=600,location=(0,0,STREET-.02));bpy.context.object.data.materials.append(mat('Ground',(.24,.25,.24),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam
    from mathutils import Vector
    day={'deck':((-30,22,-40),(0,1,2),30),'pool':((0,7,-30),(0,-.5,-6),26),
         'lounge':((-15,2.6,7.5),(6,1.5,13.8),20),'bar':((-1,1.9,8.2),(0,1.5,2.6),26),
         'street':((16,-40.5,30),(12,-42.4,20.5),30),'vestibule':((9,2.6,4),(14.4,1.4,12.6),26)}
    def shoot(views,tag=''):
        for name,(eye,at,lens) in views.items():
            cam.data.lens=lens;cam.location=pt(*eye)
            d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
            s.render.filepath=str(OUT/f'preview-{tag}{name}.png');bpy.ops.render.render(write_still=True)
    bg.inputs[0].default_value=(.55,.7,.9,1);bg.inputs[1].default_value=1.0;sun.data.energy=4
    shoot(day)
    # night pass: the emissive strips and the strand curtain are the whole look after dark
    bg.inputs[0].default_value=(.03,.04,.09,1);bg.inputs[1].default_value=.5;sun.data.energy=.12
    shoot({'lounge':((-15,2.6,7.5),(6,1.5,13.8),20),'deck':((-26,14,-34),(0,1,4),28)},'night-')

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'skydining.blend'))
