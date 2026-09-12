"""Saloma Link (Pintasan Saloma) at (55,-125): the real bridge's sirih-junjung canopy as a
true diamond diagrid that tapers to a leaf tip at each end, over a walkway with a glazed
balustrade, tapered piers and both stair approaches. Every gameplay number comes from
src/bridge.ts (deck top 4.44, walk half width 2.2, six steps of .58 from 24.8), so this is
skin only: walking height, collision and the game's own SALOMA LINK sign are untouched.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_saloma.py -- --no-render

Output: public/assets/models/environment/LM_ENV_Saloma.glb, node 'saloma' at the deck origin.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import vloft

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/saloma'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='saloma'

# --- numbers that must agree with src/bridge.ts; changing them desyncs walking from the mesh
DECK_TOP=4.44;DECK_HALF=24;WALK_HALF=2.2
STEPS=6;STEP_RISE=.58;STEP_RUN=1.15;STEP_TOP_Y=3.875;RAMP_START=24.8
PIERS=[-22,-11,0,11,22]

CONCRETE=mat('Bridge concrete',(.85,.84,.77),.88);WALK=mat('Walkway surface',(.27,.43,.41),.8)
KERB=mat('Deck kerb',(.78,.77,.70),.85);RAIL=mat('Handrail steel',(.45,.55,.52),.4)
GLASS=mat('Balustrade glass',(.62,.80,.80),.1,alpha=.3,two_sided=True)
LATTICE=mat('Canopy lattice',(.55,.89,.82),.35,emit=.35)
CHORD=mat('Canopy chord',(.31,.83,.76),.3,emit=.8)
PIER=mat('Pier concrete',(.80,.79,.73),.9);SOFFIT=mat('Deck soffit',(.66,.65,.60),.9)

def rect(cx,cz,w,d):return [(cx-w/2,cz-d/2),(cx+w/2,cz-d/2),(cx+w/2,cz+d/2),(cx-w/2,cz+d/2)]

def strut(name,p0,p1,w,m,h=None):
    """Square member between two game-space points."""
    a=Vector(pt(*p0));b=Vector(pt(*p1));d=b-a;L=d.length
    if L<1e-5:return None
    bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2)
    o=bpy.context.object;o.scale=(w,h or w,L)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(o,name,m,T)

# --- canopy geometry: a pointed arch whose height and width taper toward each leaf tip
BAYS=14;BAY=3.0;K=6                      # 14 bays of 3 m, six divisions per arch
X0=-BAYS*BAY/2                            # canopy runs -21 .. +21
def taper(x):return min(1.0,max(.30,(21.0-abs(x))/6.0))
def node(i,k):
    x=X0+i*BAY;s=-1+2*k/K;t=taper(x)
    y=DECK_TOP+.35+4.26*t*(1-abs(s)**.85)
    z=2.52*(.62+.38*t)*s
    return (x,y,z)

def canopy():
    o=[]
    for i in range(BAYS):
        for k in range(K):
            # the two diagonal families are what make the diamonds
            o.append(strut('lattice',node(i,k),node(i+1,k+1),.11,LATTICE))
            o.append(strut('lattice',node(i,k+1),node(i+1,k),.11,LATTICE))
        o.append(strut('ridge chord',node(i,K//2),node(i+1,K//2),.17,CHORD))
        for k in (0,K):o.append(strut('edge chord',node(i,k),node(i+1,k),.16,CHORD))
    for i in (0,3,7,11,14):
        for k in range(K):o.append(strut('rib',node(i,k),node(i,k+1),.14,CHORD))
    # leaf tips: the lattice closes to a point just past the last bay
    for end,sign in ((0,-1),(BAYS,1)):
        tip=(X0+end*BAY+sign*2.4,DECK_TOP+2.80,0)
        for k in range(K+1):o.append(strut('leaf tip',node(end,k),tip,.10,CHORD))
        o.append(strut('tip spike',tip,(tip[0]+sign*1.5,DECK_TOP+3.55,0),.09,CHORD))
    return [p for p in o if p]

def deck():
    o=[]
    o.append(box('deck slab',0,4.0,0,2*DECK_HALF,.65,5.2,CONCRETE,T,.04))
    o.append(box('deck soffit rib',0,3.6,0,2*DECK_HALF,.2,3.4,SOFFIT,T,.03))
    o.append(box('walkway surface',0,4.38,0,2*DECK_HALF-2,.12,2*WALK_HALF+.05,WALK,T,0))
    for s in (-1,1):
        o.append(box('kerb',0,4.42,s*(WALK_HALF+.12),2*DECK_HALF-2,.2,.24,KERB,T,.02))
        # glazed balustrade: posts, glass infill and a capping handrail
        o.append(box('balustrade glass',0,5.0,s*2.3,2*DECK_HALF-1,1.05,.05,GLASS,T,0))
        o.append(cyl('handrail',0,5.62,s*2.3,.055,2*DECK_HALF-1,RAIL,T,axis='x',verts=8))
        o.append(box('rail foot',0,4.44,s*2.3,2*DECK_HALF-1,.12,.14,RAIL,T,0))
        for i in range(17):
            x=-24+i*3
            o.append(box('rail post',x,5.05,s*2.3,.09,1.3,.11,RAIL,T,0))
    return o

def piers():
    o=[]
    for bx in PIERS:
        for s in (-1,1):
            z=s*2.15
            # tapered pier: wider at the cap than the ground, so it reads as a column
            o.append(vloft('pier',[(0.0,rect(bx,-z,.34,.34)),(3.62,rect(bx,-z,.46,.46))],[PIER],T))
            o.append(box('pier cap',bx,3.72,z,.62,.22,.62,PIER,T,.03))
        o.append(box('cross brace',bx,3.3,0,.34,.26,4.3,PIER,T,.03))
    return o

def approaches():
    o=[]
    for s in (-1,1):
        for step in range(STEPS):
            x=s*(RAMP_START+step*STEP_RUN);y=STEP_TOP_Y-.225-step*STEP_RISE
            o.append(box('step',x,y,0,2.4,.45,5.2,CONCRETE,T,.03))
            for side in (-1,1):
                o.append(box('step cheek',x,y+.42,side*2.45,2.4,.4,.3,KERB,T,.02))
                o.append(cyl('step rail',x,y+1.28,side*2.35,.05,2.45,RAIL,T,axis='x',verts=8))
                o.append(box('step post',x,y+.85,side*2.35,.09,1.0,.11,RAIL,T,0))
        # a landing pad where the stair meets the pavement
        x=s*(RAMP_START+(STEPS-1)*STEP_RUN+1.7)
        o.append(box('landing',x,.18,0,2.6,.36,5.2,CONCRETE,T,.03))
    return o

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    for ob in deck()+piers()+approaches()+canopy():ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'saloma | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Saloma.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_Saloma','origin':[55,0,-125],'span':[2*DECK_HALF,5.2],'deckTop':DECK_TOP,
            'steps':STEPS,'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('SALOMA WEB EXPORT',json.dumps(report),flush=True)

def render():
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1600;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=300,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=30
    for name,(eye,at) in {'side':((-8,12,42),(0,6,0)),'along':((0,5.6,26),(0,6.2,-2)),'end':((34,8,22),(6,6,0)),'deck':((-14,5.6,3.2),(16,5.4,0))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'saloma.blend'))
