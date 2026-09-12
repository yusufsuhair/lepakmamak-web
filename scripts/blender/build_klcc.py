"""PETRONAS Twin Towers for the KLCC podium at (0,0,-122): eight-point star plans with
round bays, a steel band every floor, the four real setbacks, ring-ball pinnacles, the
two-storey skybridge on its arch legs, and the two Suria podiums. Same podium footprints
and collision boxes as the procedural towers in world.ts; the lifts stay procedural.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_klcc.py -- --no-render

Output: public/assets/models/environment/LM_ENV_KLCC.glb, node 'klcc' at the pad origin.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,join,finish

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/klcc'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='klcc'

GLASS=mat('Tower glass',(.40,.56,.60),.22);STEEL=mat('Tower steel',(.80,.83,.80),.36);SHADE=mat('Sunshade steel',(.88,.90,.87),.3)
CROWN=mat('Pinnacle steel',(.84,.87,.84),.3);MAST=mat('Mast',(.75,.78,.76),.4)
PODIUM=mat('Podium stone',(.78,.80,.73),.85);PLINTH=mat('Podium plinth',(.62,.64,.60),.9);LOBBY=mat('Lobby glass',(.45,.62,.72),.1,alpha=.45,two_sided=True)
CANOPY=mat('Entrance canopy',(.86,.88,.84),.4);DARK=mat('Mullion',(.14,.15,.16),.6)
BRIDGE=mat('Bridge steel',(.82,.85,.82),.35);BRIDGE_GLASS=mat('Bridge glass',(.50,.68,.74),.12,alpha=.5,two_sided=True)

TOWER_X=22;FLOOR=1.75;BASE=3;FLOORS=42
# (first floor, square half-width): the real setbacks at levels 60, 73, 82 and 85 of 88.
TIERS=[(0,6.56),(28,5.6),(34,4.7),(39,3.9)]
LEDGE_EVERY=6

def star(a,k=2):
    """Eight-point star (two squares) with a round bay in each notch, counter-clockwise."""
    R=a*math.sqrt(2);rc=.30*a;N=(a,a*(math.sqrt(2)-1));pts=[]
    for i in range(8):
        c,s=math.cos(i*math.pi/4),math.sin(i*math.pi/4)
        rot=lambda x,y:(x*c-y*s,x*s+y*c)
        pts.append(rot(R,0))
        for j in range(k+2):
            ang=math.radians(-45+135*j/(k+1));pts.append(rot(N[0]+rc*math.cos(ang),N[1]+rc*math.sin(ang)))
    return pts

def vloft(name,sections,mats,tag,cap=True):
    """Vertical loft: sections [(height,[(x,y)...])], mats one material per strip. Profile y is game -z."""
    verts=[];faces=[];n=len(sections[0][1])
    for h,prof in sections:
        assert len(prof)==n,name
        for x,y in prof:verts.append((x,y,h))
    for s in range(len(sections)-1):
        for i in range(n):
            a=s*n+i;b=s*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    if cap:faces.append(tuple((len(sections)-1)*n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob)
    order=[];
    for m in mats+[mats[-1]]:
        if m not in order:order.append(m)
    for m in order:ob.data.materials.append(m)
    strips=len(sections)-1
    for f in ob.data.polygons:
        strip=min(f.index//n,strips-1);f.material_index=order.index(mats[strip] if f.index<strips*n else mats[-1])
        f.use_smooth=f.index<strips*n
    ob['asset']=tag;return ob

def sphere(name,x,y,z,r,m,tag):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18,ring_count=10,radius=r,location=pt(x,y,z));o=bpy.context.object
    finish(o,name,m,tag)
    for f in o.data.polygons:f.use_smooth=True
    return o

def tower(cx):
    o=[];sections=[];mats=[]
    def add(h,a,m=None):
        sections.append((h+0,[(cx+x,y) for x,y in star(a)]))
        if m is not None:mats.append(m)
    tier=0
    for f in range(FLOORS):
        while tier+1<len(TIERS) and f>=TIERS[tier+1][0]:
            # setback: a flat ledge steps in to the next tier's plan
            tier+=1;add(BASE+f*FLOOR,TIERS[tier][1],SHADE)
        a=TIERS[tier][1];y=BASE+f*FLOOR
        if f==0:add(y,a,GLASS)
        add(y+1.35,a,STEEL)
        if f%LEDGE_EVERY==LEDGE_EVERY-1 and f<FLOORS-1:
            # projecting sunshade ring: out, up, back in
            add(y+1.35,a+.3,SHADE);add(y+FLOOR,a+.3,SHADE);add(y+FLOOR,a,GLASS)
        else:
            add(y+FLOOR,a,GLASS if f<FLOORS-1 else STEEL)
    top=BASE+FLOORS*FLOOR
    # stepped crown tapering the star plan up toward the ring ball
    add(top,TIERS[-1][1],SHADE);add(top+1.0,3.25,STEEL);add(top+2.0,3.25,SHADE);add(top+2.9,2.55,STEEL);add(top+3.7,2.55)
    o.append(vloft('tower body',sections,mats,T))
    # crown: drum, ring ball, ribbed pinnacle, spire, mast
    o.append(cyl('crown drum',cx,top+4.2,0,2.3,1.2,CROWN,T,verts=24))
    o.append(sphere('ring ball',cx,top+6.9,0,2.55,CROWN,T))
    o.append(cyl('ball band',cx,top+6.9,0,2.7,.32,SHADE,T,verts=24))
    for i in range(11):
        r=2.2-i*.13;y=top+9.7+i*.72
        o.append(cyl('pinnacle ring',cx,y,0,r,.4,CROWN,T,verts=20));o.append(cyl('pinnacle ring core',cx,y+.36,0,r-.3,.32,MAST,T,verts=20))
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.95,radius2=.12,depth=5.6,location=pt(cx,top+20.5,0));spire=bpy.context.object;finish(spire,'spire',CROWN,T)
    for f in spire.data.polygons:f.use_smooth=len(f.vertices)==4
    o.append(spire)
    o.append(cyl('mast',cx,top+24.8,0,.13,3.6,MAST,T,verts=8))
    o.append(sphere('mast tip',cx,top+26.7,0,.26,MAST,T))
    # corner mullions up the first tier make the star read at ground level
    for i in range(8):
        a=i*math.pi/4;R=TIERS[0][1]*math.sqrt(2)-.05
        o.append(box('corner mullion',cx+math.cos(a)*R,BASE+TIERS[1][0]*FLOOR/2,-math.sin(a)*R,.16,TIERS[1][0]*FLOOR,.16,SHADE,T,0))
    return o

def podium(cx):
    o=[]
    # 21 x 24 footprint, 3 tall, matching the collision box; stone plinth and cornice
    o.append(box('podium',cx,1.55,0,21,2.9,24,PODIUM,T,.05))
    o.append(box('podium plinth',cx,.2,0,21.3,.4,24.3,PLINTH,T,.03))
    o.append(box('podium cornice',cx,3.05,0,21.6,.3,24.6,CANOPY,T,.03))
    # glazed lobby band on the south (park) face and both sides
    o.append(box('lobby glass',cx,1.7,12.03,17,2.2,.06,LOBBY,T,0))
    for xx in (-8.5,-4.25,0,4.25,8.5):o.append(box('lobby mullion',cx+xx,1.7,12.05,.12,2.2,.12,DARK,T,0))
    for s in (-1,1):
        o.append(box('lobby glass',cx+s*10.53,1.7,0,.06,2.2,18,LOBBY,T,0))
        for zz in (-6,-2,2,6):o.append(box('lobby mullion',cx+s*10.55,1.7,zz,.12,2.2,.12,DARK,T,0))
    # entrance canopy over the doors, on slim columns, well above head height
    o.append(box('entrance canopy',cx,3.4,13.2,9,.22,2.6,CANOPY,T,.03))
    for xx in (-4,4):o.append(cyl('canopy column',cx+xx,1.7,14.2,.1,3.4,SHADE,T,verts=8))
    o.append(box('door frame',cx,1.3,12.0,3,2.4,.2,DARK,T,0))
    return o

def bridge():
    o=[]
    face=TOWER_X-TIERS[0][1]  # flat tower face the bridge meets
    L=2*face+.4
    o.append(box('bridge floor',0,38.05,0,L,.3,3.8,BRIDGE,T,.03))
    o.append(box('bridge mid floor',0,39.35,0,L,.2,3.8,BRIDGE,T,.02))
    o.append(box('bridge roof',0,40.45,0,L+.4,.3,4.2,BRIDGE,T,.03))
    for s in (-1,1):
        o.append(box('bridge glass',0,39.25,s*1.85,L,2.2,.05,BRIDGE_GLASS,T,0))
        for i in range(13):o.append(box('bridge mullion',-face+i*2*face/12,39.25,s*1.88,.1,2.2,.12,BRIDGE,T,0))
    # two-hinged arch: legs from level 29 on each tower up to the bridge centre
    lo=(face+.3,BASE+14*FLOOR);hi=(1.1,37.75)
    for s in (-1,1):
        dx,dy=(hi[0]-lo[0]),(hi[1]-lo[1]);length=math.hypot(dx,dy)
        leg=box('arch leg',s*(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,0,.7,length,.9,BRIDGE,T,.03)
        leg.rotation_euler.y=s*math.atan2(dx,dy);o.append(leg)
        o.append(sphere('arch hinge',s*lo[0],lo[1],0,.65,SHADE,T))
    o.append(box('arch crown',0,37.55,0,3.4,.5,1.2,BRIDGE,T,.03))
    return o

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    parts=[]
    for cx in (-TOWER_X,TOWER_X):parts+=podium(cx)+tower(cx)
    parts+=bridge()
    for ob in parts:ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'klcc | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_KLCC.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_KLCC','origin':[0,0,-122],'towers':[[-TOWER_X,0],[TOWER_X,0]],'height':BASE+FLOORS*FLOOR+27,'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('KLCC WEB EXPORT',json.dumps(report),flush=True)

def render():
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1200;s.render.resolution_y=1500;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=400,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=28
    from mathutils import Vector
    for name,(eye,at) in {'full':((-70,45,120),(0,50,0)),'bridge':((-14,30,40),(0,40,0)),'base':((-30,6,40),(-10,8,0)),'crown':((-8,88,26),(-22,88,0))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'klcc.blend'))
