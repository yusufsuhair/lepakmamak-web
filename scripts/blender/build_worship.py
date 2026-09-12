"""The four worship landmarks: Masjid Kampung Maju (onion domes, arcade, two minarets),
Gereja Harapan (gabled nave, bell tower, spire), Kuil Seri Harmoni (six-tier gopuram,
striped compound wall, pillared mandapam) and Tokong Harmoni (two-tier hip roofs, red
columns, lanterns, incense urn). Same footprints and collision boxes as the procedural
landmarks in world.ts; the game keeps drawing its own name signs on top.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_worship.py -- --no-render

Output: public/assets/models/environment/LM_ENV_{Masjid,Church,HinduTemple,ChineseTemple}.glb
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import vloft,sphere

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/worship'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []

PLAZA=mat('Plaza stone',(.87,.83,.72),.9);CREAM=mat('Wall cream',(.95,.91,.83),.8);TEAL=mat('Dome teal',(.26,.55,.48),.45)
GOLD=mat('Gold trim',(.84,.74,.46),.35);MINARET=mat('Minaret cream',(.94,.90,.80),.75);DOOR=mat('Door teal',(.22,.43,.40),.6)
DARK=mat('Doorway dark',(.13,.11,.10),.8);GLASS=mat('Window glass',(.53,.65,.71),.15)
BLUE=mat('Church blue',(.31,.49,.60),.5);CHURCH=mat('Church cream',(.95,.92,.85),.8);BELL=mat('Bell bronze',(.65,.50,.28),.4)
SAND=mat('Temple sandstone',(.93,.77,.65),.85);MAROON=mat('Temple maroon',(.68,.40,.49),.6);RED=mat('Temple red',(.75,.25,.22),.6)
WHITE=mat('Stripe white',(.96,.95,.90),.8);T1=mat('Gopuram teal',(.41,.67,.65),.6);T2=mat('Gopuram rose',(.85,.54,.57),.6);T3=mat('Gopuram ochre',(.81,.69,.40),.6)
FIG=mat('Gopuram figure',(.93,.81,.49),.5);PILLAR=mat('Pillar rose',(.74,.40,.46),.6)
CRED=mat('Tokong red',(.69,.24,.20),.55);TILE=mat('Roof tile green',(.32,.42,.38),.6);EAVE=mat('Eave red',(.68,.29,.22),.55)
LANTERN=mat('Lantern red',(.85,.33,.25),.4,emit=.6);BRONZE=mat('Urn bronze',(.60,.47,.34),.5);STONE=mat('Grey stone',(.62,.62,.58),.9)
TIMBER=mat('Dark timber',(.36,.24,.16),.7)

def circle(cx,cz,r,n=16):return [(cx+r*math.cos(2*math.pi*i/n),cz+r*math.sin(2*math.pi*i/n)) for i in range(n)]
def rect(cx,cz,w,d):return [(cx-w/2,cz-d/2),(cx+w/2,cz-d/2),(cx+w/2,cz+d/2),(cx-w/2,cz+d/2)]

def onion(name,x,y,z,R,H,m,tag,n=20):
    prof=[(0,.86),(.10,.97),(.24,1.0),(.40,.95),(.55,.82),(.70,.60),(.82,.37),(.92,.17),(1,.03)]
    o=vloft(name,[(y+t*H,circle(x,-z,R*r,n)) for t,r in prof],[m]*(len(prof)-1),tag)
    return o

def hip(name,x,y0,y1,z,w0,d0,w1,d1,m,tag):
    """Hip roof between two rectangles."""
    return vloft(name,[(y0,rect(x,-z,w0,d0)),(y1,rect(x,-z,w1,d1))],[m],tag)

def arch_band(name,x,y,z,r,t,depth,m,tag,n=12):
    """Round arch head from springing line y: outer radius r+t, inner r, thickness depth along z."""
    outer=[((r+t)*math.cos(math.pi*i/n),(r+t)*math.sin(math.pi*i/n)) for i in range(n+1)]
    inner=[(r*math.cos(math.pi*i/n),r*math.sin(math.pi*i/n)) for i in range(n,-1,-1)]
    prof=[(x+px,y+py) for px,py in outer+inner]
    return loft(name,[(z-depth/2,prof),(z+depth/2,prof)],m,tag)

def arch_panel(name,x,y0,z,w,h,depth,m,tag,n=10):
    """Flat panel with a round top: width w, straight height h, plus the half circle."""
    r=w/2;prof=[(x-r,y0),(x+r,y0)]+[(x+r*math.cos(math.pi*i/n),y0+h+r*math.sin(math.pi*i/n)) for i in range(n+1)]
    return loft(name,[(z-depth/2,prof),(z+depth/2,prof)],m,tag)

def crescent(name,x,y,z,r,m,tag,n=14):
    a=math.radians(55.4);outer=[(r*math.cos(t),r*math.sin(t)) for t in [a+(2*math.pi-2*a)*i/n for i in range(n+1)]]
    b=math.radians(78.4);inner=[(.4*r+.84*r*math.cos(t),.84*r*math.sin(t)) for t in [(2*math.pi-b)-(2*math.pi-2*b)*i/n for i in range(n+1)]]
    prof=[(x+px,y+py) for px,py in outer+inner]
    o=loft(name,[(z-.06,prof),(z+.06,prof)],m,tag);return o

def finial(o,x,y,z,tag,h=1.4,ball=.22):
    o.append(cyl('finial rod',x,y+h/2,z,.07,h,GOLD,tag,verts=8));o.append(sphere('finial ball',x,y+h,z,ball,GOLD,tag))

# ------------------------------------------------------------------ masjid
def masjid(T):
    o=[box('plaza',0,.12,3,38,.24,28,PLAZA,T,.02)]
    o.append(box('prayer hall',0,3,0,25,6,15,CREAM,T,.04))
    o.append(box('cornice',0,6.1,0,25.6,.35,15.6,GOLD,T,.02))
    o.append(box('parapet',0,6.5,0,25.2,.5,15.2,CREAM,T,.03))
    for xx in (-12.4,12.4):
        for zz in (-7.4,7.4):o.append(box('pilaster',xx,3,zz,.7,6.2,.7,MINARET,T,.03))
    # front arcade: verandah roof above the sign, columns and round arches
    o.append(box('verandah roof',0,6.0,9,27,.3,3.6,CREAM,T,.03))
    o.append(box('verandah fascia',0,5.75,10.75,27,.2,.12,GOLD,T,0))
    cols=[-12,-7.8,-3.6,3.6,7.8,12]
    for xx in cols:
        o.append(cyl('column',xx,2.9,10.4,.32,5.7,MINARET,T,verts=10));o.append(box('capital',xx,5.65,10.4,.8,.25,.8,GOLD,T,.02))
    for i in range(len(cols)-1):
        cx=(cols[i]+cols[i+1])/2;r=(cols[i+1]-cols[i])/2-.32
        if abs(cx)>1.5:o.append(arch_band('arch',cx,3.6,10.4,r,.3,.5,CREAM,T))
    o.append(arch_band('portal arch',0,2.0,10.4,3.28,.38,.6,GOLD,T))
    # doorways in the hall's front wall
    for xx in (-5,0,5):o.append(arch_panel('doorway',xx,0,7.53,2.4,2.6,.1,DOOR,T))
    for xx in (-9.5,9.5):o.append(arch_panel('window',xx,1.4,7.53,1.4,1.8,.1,GLASS,T))
    for zz in (-4,0,4):
        for s in (-1,1):o.append(arch_panel('side window',s*12.52,1.4,zz,1.4,1.8,.1,GLASS,T) if False else box('side window',s*12.53,2.6,zz,.08,2.4,1.4,GLASS,T,0))
    # main dome on its drum, corner cupolas
    o.append(cyl('drum',0,6.7,0,5.6,.8,CREAM,T,verts=24));o.append(cyl('drum band',0,7.15,0,5.75,.25,GOLD,T,verts=24))
    o.append(onion('main dome',0,7.2,0,5.4,5.8,TEAL,T,n=24))
    finial(o,0,13.0,0,T,h=1.2,ball=.2);o.append(cyl('crescent stem',0,14.35,0,.05,.5,GOLD,T,verts=6))
    c=crescent('crescent',0,14.9,0,.55,GOLD,T);c.rotation_euler.y=0;o.append(c)
    for xx in (-11,11):
        for zz in (-6,6):
            o.append(cyl('cupola drum',xx,6.9,zz,1.0,.5,CREAM,T,verts=12));o.append(onion('cupola',xx,7.1,zz,.95,1.3,TEAL,T,n=12));finial(o,xx,8.35,zz,T,h=.6,ball=.1)
    # minarets: plinth, octagonal shaft, three balconies, cupola
    for xx in (-15,15):
        o.append(box('minaret plinth',xx,.5,0,2.5,1,2.5,MINARET,T,.04))
        o.append(cyl('minaret shaft',xx,6.5,0,1.15,11,MINARET,T,verts=8))
        for yy in (3,8,11.5):
            o.append(cyl('balcony',xx,yy,0,1.6,.35,GOLD,T,verts=10));o.append(cyl('balcony rail',xx,yy+.45,0,1.55,.55,CREAM,T,verts=10))
        o.append(cyl('minaret drum',xx,12.3,0,1.3,.6,CREAM,T,verts=10));o.append(onion('minaret cupola',xx,12.6,0,1.45,2.0,TEAL,T,n=12));finial(o,xx,14.55,0,T,h=1.0,ball=.14)
    # ablution trough and planters on the plaza
    o.append(box('ablution',-14,.5,12,4,.5,1.2,STONE,T,.03))
    for xx in (-9,9):o.append(box('planter',xx,.45,15.5,2.2,.5,1.2,STONE,T,.03));o.append(sphere('shrub',xx,1.0,15.5,.75,TEAL,T))
    return o

# ------------------------------------------------------------------ church
def church(T):
    o=[box('plaza',0,.12,3,20,.24,28,PLAZA,T,.02)]
    o.append(box('nave',0,6,0,15,12,15,CHURCH,T,.04))
    o.append(box('plinth',0,.3,0,15.4,.6,15.4,STONE,T,.02))
    # gabled roof over the nave, overhanging the walls
    prof=[(-8.2,11.6),(8.2,11.6),(8.2,12.1),(0,16.8),(-8.2,12.1)]
    o.append(loft('nave roof',[(-8.2,prof),(6.9,prof)],BLUE,T))
    o.append(box('ridge',0,16.85,-.65,.3,.25,15.1,GOLD,T,0))
    # bell tower with louvres, pyramidal spire and cross
    o.append(box('bell tower',0,13,-1,6,14,7,CHURCH,T,.04))
    o.append(box('tower cornice',0,20.1,-1,6.5,.35,7.5,BLUE,T,.02))
    for s in (-1,1):
        o.append(box('louvre',s*3.02,17.5,-1,.08,2.4,2,TIMBER,T,0));o.append(box('louvre',0,17.5,-1+s*3.52,2,2.4,.08,TIMBER,T,0))
    o.append(cyl('bell',0,17.4,-1,.55,.9,BELL,T,verts=10))
    o.append(vloft('spire',[(20.3,rect(0,1,6.4,7.4)),(26.2,rect(0,1,.3,.3))],[BLUE],T))
    o.append(box('cross',0,27.6,-1,.3,2.6,.3,GOLD,T,0));o.append(box('cross arm',0,28.3,-1,1.7,.3,.3,GOLD,T,0))
    # front: three arched windows, rose window, arched door and steps
    for xx in (-5,0,5):
        if xx==0:o.append(arch_panel('door',0,0,7.53,2.6,3.0,.1,TIMBER,T))
        else:o.append(arch_panel('window',xx,2.6,7.53,1.9,3.2,.1,GLASS,T))
    o.append(cyl('rose window',0,13.6,7.53,1.5,.1,GLASS,T,axis='z',verts=16));o.append(cyl('rose frame',0,13.6,7.51,1.7,.08,BLUE,T,axis='z',verts=16))
    for zz in (-4.5,-1,2.5):
        for s in (-1,1):o.append(box('side window',s*7.53,4.8,zz,.08,3.4,1.5,GLASS,T,0))
    o.append(box('steps',0,.4,8.4,5,.3,1.6,STONE,T,.02));o.append(box('steps',0,.2,9.2,5.6,.3,1.6,STONE,T,.02))
    for s in (-1,1):o.append(box('buttress',s*7.9,3,3,.7,6,1.2,CHURCH,T,.03));o.append(box('buttress',s*7.9,3,-4,.7,6,1.2,CHURCH,T,.03))
    for xx in (-7,7):o.append(box('planter',xx,.45,12,2,.5,1.2,STONE,T,.03));o.append(sphere('shrub',xx,1.0,12,.7,TEAL,T))
    return o

# ------------------------------------------------------------------ hindu temple
def hindu(T):
    o=[box('plaza',0,.12,3,20,.24,28,PLAZA,T,.02)]
    o.append(box('hall',0,3,0,15,6,15,SAND,T,.04))
    o.append(box('platform',0,6.2,0,16.5,.5,16.5,MAROON,T,.03))
    # red and white stripes on the compound wall faces
    for i in range(7):
        xx=-6.4+i*2.13
        o.append(box('stripe',xx,2.8,7.54,1.0,5.4,.06,RED,T,0))
        o.append(box('stripe',xx,2.8,-7.54,1.0,5.4,.06,RED,T,0))
    for i in range(7):
        zz=-6.4+i*2.13
        for s in (-1,1):o.append(box('stripe',s*7.54,2.8,zz,.06,5.4,1.0,RED,T,0))
    o.append(box('wall band',0,5.75,0,15.2,.35,15.2,WHITE,T,.02))
    # six-tier gopuram over the entrance, barrel vault and kalasam finials
    for tier in range(6):
        w=8-tier*.85;y=6.5+tier*1.05;d=max(2.8,w*.6)
        o.append(box('tier',0,y,4,w,1,d,[T1,T2,T3][tier%3],T,.03))
        o.append(box('tier cornice',0,y+.5,4,w+.5,.18,d+.5,FIG,T,.02))
        k=max(3,int(w/1.5))
        for j in range(k):
            xx=-w/2+.7+(w-1.4)*j/max(1,k-1)
            o.append(cyl('figure',xx,y+.1,4+d/2+.12,.16,.55,FIG,T,verts=6));o.append(sphere('figure head',xx,y+.45,4+d/2+.12,.19,FIG,T))
    o.append(cyl('barrel vault',0,12.85,4,1.15,2.9,T2,T,axis='x',verts=12))
    for xx in (-1.1,0,1.1):o.append(cyl('kalasam',xx,13.7,4,.1,1.0,GOLD,T,verts=6));o.append(sphere('kalasam pot',xx,14.2,4,.3,GOLD,T))
    # entrance, mandapam roof above the sign, pillars
    o.append(arch_panel('gateway',0,0,7.53,2.6,2.8,.1,DARK,T))
    o.append(box('mandapam roof',0,6.0,9,17,.3,3.4,SAND,T,.03));o.append(box('mandapam fascia',0,5.72,10.6,17,.22,.14,RED,T,0))
    for xx in (-7,-3.5,3.5,7):
        o.append(cyl('pillar',xx,2.9,10.2,.32,5.7,PILLAR,T,verts=10));o.append(cyl('pillar cap',xx,5.7,10.2,.5,.25,GOLD,T,verts=10))
    o.append(box('steps',0,.4,12.2,6,.3,1.4,STONE,T,.02));o.append(box('steps',0,.2,13,6.6,.3,1.4,STONE,T,.02))
    for xx in (-6,6):o.append(cyl('dwajasthambam',xx,3.2,13,.22,6.4,GOLD,T,verts=8));o.append(sphere('dwaja top',xx,6.5,13,.3,GOLD,T))
    return o

# ------------------------------------------------------------------ chinese temple
def chinese(T):
    o=[box('plaza',0,.12,3,20,.24,28,PLAZA,T,.02)]
    o.append(box('hall',0,2.6,0,13,5.2,11.5,CRED,T,.04))
    o.append(box('plinth',0,.3,0,13.6,.6,12,STONE,T,.02))
    o.append(arch_panel('doorway',0,0,5.78,2.8,2.4,.1,DARK,T));o.append(box('door frame',0,2.1,5.8,3.4,4.2,.15,GOLD,T,.02))
    for xx in (-4.2,4.2):o.append(box('lattice window',xx,2.8,5.79,2.0,1.6,.08,GOLD,T,0))
    for xx in (-6.5,6.5):
        for zz in (-6.5,7.5):o.append(cyl('column',xx,3,zz,.35,6,CRED,T,verts=12));o.append(box('column base',xx,.35,zz,1,.3,1,STONE,T,.02))
    for zz in (-6.5,7.5):o.append(box('lintel',0,5.95,zz,14,.4,.4,CRED,T,.02))
    for xx in (-6.5,6.5):o.append(box('lintel',xx,5.95,.5,.4,.4,14,CRED,T,.02))
    # two-tier hip roofs with eave boards, ridge and upturned ends
    for tier,(y0,y1,w0,d0,w1) in enumerate(((6.2,8.7,19,15.5,9),(8.9,11.3,13.5,10,5.5))):
        o.append(hip('roof',0,y0,y1,.5,w0,d0,w1,.6,TILE,T))
        o.append(hip('eave board',0,y0-.3,y0,.5,w0+.3,d0+.3,w0,d0,EAVE,T))
        o.append(box('ridge',0,y1+.15,.5,w1+1.2,.3,.5,TILE,T,.02))
        for s in (-1,1):o.append(cyl('ridge end',s*(w1/2+.7),y1+.6,.5,.3,.9,GOLD,T,verts=8))
        for s in (-1,1):
            for c in (-1,1):o.append(sphere('eave tip',s*(w0/2-.05),y0+.05,.5+c*(d0/2-.05),.26,GOLD,T))
    o.append(sphere('ridge pearl',0,11.9,.5,.4,LANTERN,T))
    for xx in (-5,5):
        o.append(cyl('lantern cord',xx,4.9,8,.04,1.0,GOLD,T,verts=6));s=sphere('lantern',xx,3.9,8,.58,LANTERN,T);s.scale.z=1.2;o.append(s);o.append(cyl('tassel',xx,3.05,8,.05,.5,GOLD,T,verts=6))
    # incense urn, stone lions and steps
    o.append(cyl('urn',0,.75,11,.8,1.1,BRONZE,T,verts=14));o.append(cyl('urn rim',0,1.3,11,1.0,.18,BRONZE,T,verts=14))
    for a in (0,120,240):o.append(cyl('urn leg',.6*math.cos(math.radians(a)),.15,11+.6*math.sin(math.radians(a)),.1,.3,BRONZE,T,verts=6))
    for i in range(5):o.append(cyl('incense',-.4+i*.2,1.75,11+(i%2)*.2,.02,.9,GOLD,T,verts=4))
    for s in (-1,1):
        o.append(box('lion plinth',s*4.5,.45,10,1.0,.5,1.4,STONE,T,.02));o.append(box('lion body',s*4.5,1.05,10.1,.7,.7,1.1,STONE,T,.06));o.append(sphere('lion head',s*4.5,1.65,9.7,.4,STONE,T))
    o.append(box('steps',0,.4,7.4,6,.3,1.4,STONE,T,.02));o.append(box('steps',0,.2,8.2,6.6,.3,1.4,STONE,T,.02))
    return o

SITES={'Masjid':masjid,'Church':church,'HinduTemple':hindu,'ChineseTemple':chinese}

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    roots={}
    for name,fn in SITES.items():
        e=bpy.data.objects.new(name.lower(),None);s.collection.objects.link(e)
        for ob in fn(name.lower()):ob.parent=e
        roots[name]=e
    return roots

def export(roots):
    report={}
    for name,e in roots.items():
        batches={}
        for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            j=join(objs,f'{name} | {" + ".join(key)}')
            for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
        bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
        for c in e.children:c.select_set(True)
        path=PUBLIC/f'LM_ENV_{name}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False,export_extras=False)
        tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
        report[name]={'asset':f'LM_ENV_{name}','triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('WORSHIP WEB EXPORT',json.dumps(report),flush=True)

def render(roots):
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1400;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=400,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=30
    from mathutils import Vector
    for name,e in roots.items():
        for other in roots.values():other.hide_render=other is not e
        for c in e.children:c.hide_render=False
        for other in roots.values():
            if other is not e:
                for c in other.children:c.hide_render=True
        eye,at=((-26,14,34),(0,6,0)) if name!='Masjid' else ((-34,16,40),(0,6,0))
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name.lower()}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    roots=build();export(roots)
    if '--no-render' not in ARGS:render(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'worship.blend'))
