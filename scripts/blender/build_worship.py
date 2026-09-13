"""Three of the worship landmarks: Gereja Harapan (gabled nave, bell tower, spire), Kuil Seri
Harmoni (six-tier gopuram, striped compound wall, pillared mandapam) and Tokong Harmoni (two-tier
hip roofs, red columns, lanterns, incense urn). Same footprints and collision boxes as the
procedural landmarks in world.ts; the game keeps drawing its own name signs on top.
Masjid Kampung Maju has its own photographic build: scripts/blender/build_masjid.py.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_worship.py -- --no-render

Output: public/assets/models/environment/LM_ENV_{Church,HinduTemple,ChineseTemple}.glb
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

PLAZA=mat('Plaza stone',(.87,.83,.72),.9);TEAL=mat('Dome teal',(.26,.55,.48),.45)
GOLD=mat('Gold trim',(.84,.74,.46),.35)
DARK=mat('Doorway dark',(.13,.11,.10),.8);GLASS=mat('Window glass',(.53,.65,.71),.15)
BLUE=mat('Church blue',(.31,.49,.60),.5);CHURCH=mat('Church cream',(.95,.92,.85),.8);BELL=mat('Bell bronze',(.65,.50,.28),.4)
SAND=mat('Temple sandstone',(.93,.77,.65),.85);MAROON=mat('Temple maroon',(.68,.40,.49),.6);RED=mat('Temple red',(.75,.25,.22),.6)
WHITE=mat('Stripe white',(.96,.95,.90),.8);T1=mat('Gopuram teal',(.41,.67,.65),.6);T2=mat('Gopuram rose',(.85,.54,.57),.6);T3=mat('Gopuram ochre',(.81,.69,.40),.6)
FIG=mat('Gopuram figure',(.93,.81,.49),.5);PILLAR=mat('Pillar rose',(.74,.40,.46),.6)
CRED=mat('Tokong red',(.69,.24,.20),.55);TILE=mat('Roof tile green',(.32,.42,.38),.6);EAVE=mat('Eave red',(.68,.29,.22),.55)
LANTERN=mat('Lantern red',(.85,.33,.25),.4,emit=.6);BRONZE=mat('Urn bronze',(.60,.47,.34),.5);STONE=mat('Grey stone',(.62,.62,.58),.9)
TIMBER=mat('Dark timber',(.36,.24,.16),.7)

def rect(cx,cz,w,d):return [(cx-w/2,cz-d/2),(cx+w/2,cz-d/2),(cx+w/2,cz+d/2),(cx-w/2,cz+d/2)]

def hip(name,x,y0,y1,z,w0,d0,w1,d1,m,tag):
    """Hip roof between two rectangles."""
    return vloft(name,[(y0,rect(x,-z,w0,d0)),(y1,rect(x,-z,w1,d1))],[m],tag)

def arch_panel(name,x,y0,z,w,h,depth,m,tag,n=10):
    """Flat panel with a round top: width w, straight height h, plus the half circle."""
    r=w/2;prof=[(x-r,y0),(x+r,y0)]+[(x+r*math.cos(math.pi*i/n),y0+h+r*math.sin(math.pi*i/n)) for i in range(n+1)]
    return loft(name,[(z-depth/2,prof),(z+depth/2,prof)],m,tag)

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

SITES={'Church':church,'HinduTemple':hindu,'ChineseTemple':chinese}

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
        eye,at=(-26,14,34),(0,6,0)
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name.lower()}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    roots=build();export(roots)
    if '--no-render' not in ARGS:render(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'worship.blend'))
