"""KFC and McDonald's drive-throughs for the pair at (105,60) and (129,60).

KFC follows the Malaysian outlet language: red roof canopy and window coping, the
red-and-white striped "tent" fascia that echoes the Colonel's suit, and a scaled-up
chicken bucket on the roof as the landmark beacon. McDonald's is the modern neutral
box with the golden arches on the roof and on a tall pole sign, red base band and a
McCafe wing. Both keep the 14 x 12 body, the lane at x = laneSide*8 and the street
face at z = +6 that world.ts already collides against and signposts.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_fastfood.py -- --no-render

Output: public/assets/models/environment/LM_ENV_DriveThrough.glb, nodes 'kfc' and 'mcd'.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join
from build_zus import text,ring,disc

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/fastfood'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []

RED=mat('KFC red',(.72,.06,.09),.42);WHITE=mat('Outlet white',(.94,.94,.92),.5);CREAM=mat('Outlet cream',(.90,.87,.79),.7)
YELLOW=mat('Arches yellow',(.99,.76,.03),.35);DARKRED=mat('Deep red',(.55,.05,.07),.45)
CHAR=mat('Charcoal cladding',(.20,.20,.21),.7);WOOD=mat('Timber panel',(.52,.35,.19),.65)
GLASS=mat('Outlet glass',(.62,.74,.84),.09,alpha=.30,two_sided=True);BLACK=mat('Frame black',(.09,.09,.10),.5)
ASPHALT=mat('Lane asphalt',(.28,.29,.28),.95);PAINT=mat('Lane paint',(.93,.88,.45),.6);KERB=mat('Kerb',(.76,.76,.72),.85)
STEEL=mat('Steel post',(.55,.56,.58),.4);SCREEN=mat('Menu screen',(.06,.07,.09),.3)
LIT=mat('Menu glow',(1,.93,.72),.4,emit=1.8);LAMP=mat('Canopy light',(1,.96,.88),.4,emit=2.6)
ROOFM=mat('Roof deck',(.62,.62,.60),.9);GREEN=mat('Planter green',(.24,.40,.22),.8)

def frustum(name,cx,cz,base,top,r0,r1,m,tag,n=28,smooth=True):
    """Vertical tapered tube: radius r0 at y=base, r1 at y=top."""
    verts=[];faces=[]
    for y,r in ((base,r0),(top,r1)):
        for i in range(n):
            a=2*math.pi*i/n;verts.append(pt(cx+r*math.cos(a),y,cz+r*math.sin(a)))
    for i in range(n):faces.append((i,(i+1)%n,n+(i+1)%n,n+i))
    faces.append(tuple(range(n))[::-1]);faces.append(tuple(n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob);ob.data.materials.append(m);ob['asset']=tag
    for f in mesh.polygons:f.use_smooth=smooth
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def arch_stroke(cx,cy,base,r_out,r_in,n=16):
    """One leg of the golden arches: a semicircular stroke on two straight legs."""
    pts=[(cx-r_out,base)]
    for i in range(n+1):a=math.pi*(1-i/n);pts.append((cx+r_out*math.cos(a),cy+r_out*math.sin(a)))
    pts.append((cx+r_out,base));pts.append((cx+r_in,base))
    for i in range(n+1):a=math.pi*(i/n);pts.append((cx+r_in*math.cos(a),cy+r_in*math.sin(a)))
    pts.append((cx-r_in,base))
    return pts

def arches(x,base,z,height,m,tag,thick=.18):
    """The M: two strokes that meet in the middle, four units wide for `height` tall."""
    r_out=height*.42;r_in=r_out*.55;cy=base+height-r_out
    parts=[]
    for side in (-1,1):
        prof=[(x+px,py) for px,py in arch_stroke(side*r_out,cy,base,r_out,r_in)]
        parts.append(loft('arch',[(z,prof),(z+thick,prof)],m,tag,closed=True))
    return join(parts,'arches')

def lane(g,tag,lane_side,canopy_material,post_material):
    """Shared drive-thru lane: kerbed asphalt, order bay, pickup window canopy."""
    lx=lane_side*8;o=[]
    o.append(box('lane',lx,.035,0,5.5,.07,23,ASPHALT,tag,0))
    for dz in range(-9,10,4):o.append(box('lane dash',lx,.08,dz,.16,.03,1.8,PAINT,tag,0))
    for s in (-1,1):o.append(box('lane kerb',lx+s*2.85,.12,0,.25,.16,23,KERB,tag,.02))
    # order bay: canopy on two posts, big menu board and a speaker post
    ox=lx-lane_side*2.5
    o.append(box('order canopy',ox+lane_side*.6,3.5,1.3,4.4,.22,4.2,canopy_material,tag,.04))
    o.append(box('order canopy trim',ox+lane_side*.6,3.32,1.3,4.5,.14,4.3,post_material,tag,.02))
    for dz in (-.5,3.0):o.append(cyl('canopy post',ox+lane_side*2.3,1.75,dz,.09,3.5,STEEL,tag,verts=10))
    o.append(box('menu board back',ox,1.55,1.3,1.6,3.1,.9,BLACK,tag,.03))
    for dz in (-.42,.42):
        o.append(box('menu screen',ox-lane_side*.47,1.95,1.3+dz,.06,1.6,.74,SCREEN,tag,0))
        o.append(box('menu glow',ox-lane_side*.5,1.95,1.3+dz,.02,1.4,.62,LIT,tag,0))
    o.append(cyl('speaker post',ox-lane_side*1.1,1.1,-1.6,.06,2.2,STEEL,tag,verts=8))
    o.append(box('speaker',ox-lane_side*1.1,2.25,-1.6,.34,.42,.3,BLACK,tag,.03))
    o.append(cyl('clearance bar',lx,3.9,5.6,.06,5.6,post_material,tag,axis='x',verts=8))
    for s in (-1,1):o.append(cyl('clearance post',lx+s*2.7,1.95,5.6,.08,3.9,STEEL,tag,verts=8))
    # pickup window bay on the building side of the lane
    px=lx-lane_side*4.9
    o.append(box('pickup canopy',px,3.4,-5.0,2.6,.2,3.6,canopy_material,tag,.03))
    o.append(box('pickup window',px-lane_side*.05,1.9,-5.0,.12,1.6,1.8,GLASS,tag,0))
    o.append(box('pickup frame',px-lane_side*.02,1.9,-5.0,.1,1.8,2.0,BLACK,tag,0))
    for dz in (-6.6,-3.4):o.append(cyl('pickup light',px+lane_side*.5,3.26,dz,.12,.05,LAMP,tag,verts=10))
    for ob in o:ob.parent=None
    return o

def kfc():
    tag='kfc';lane_side=1;bx=-lane_side*2.5;o=[]
    # body: cream walls on a red plinth, red roof coping, deep red parapet
    o.append(box('body',bx,4.2,0,14,8.4,12,CREAM,tag,.05))
    o.append(box('plinth',bx,.35,0,14.1,.7,12.1,RED,tag,.03))
    o.append(box('roof coping',bx,8.55,0,14.5,.3,12.5,RED,tag,.03))
    o.append(box('roof deck',bx,8.3,0,13.4,.2,11.4,ROOFM,tag,.02))
    for dz in (-3,2):o.append(box('roof plant',bx-4,8.7,dz,2.2,.6,1.6,ROOFM,tag,.04))
    # striped tent fascia: alternating red and white bands under the coping
    for i in range(14):
        o.append(box('stripe',bx-6.5+i,7.55,6.08,.5,1.5,.14,RED if i%2 else WHITE,tag,0))
    o.append(box('fascia rail',bx,6.76,6.1,14.2,.16,.2,RED,tag,0))
    # the game paints its own KFC nameplate at y=5.68 z=6.18; this is the lit panel behind it
    o.append(box('name panel',bx,5.68,6.04,14.2,1.35,.16,RED,tag,.02))
    o.append(box('name glow',bx,5.68,6.13,13.6,1.1,.04,DARKRED,tag,0))
    # glazing and entrance
    for wx in (-4,0,4):
        o.append(box('window',bx+wx,2.4,6.08,3.5,3.6,.1,GLASS,tag,0))
        o.append(box('window coping',bx+wx,4.3,6.14,3.7,.22,.22,RED,tag,0))
        for mx in (-1.1,1.1):o.append(box('mullion',bx+wx+mx,2.4,6.12,.09,3.6,.12,BLACK,tag,0))
    o.append(box('entrance',bx+lane_side*5.4,2.25,6.1,2.2,2.2,.16,GLASS,tag,0))
    o.append(box('entrance frame',bx+lane_side*5.4,2.25,6.14,2.4,2.4,.12,RED,tag,0))
    o.append(box('entrance canopy',bx+lane_side*5.4,4.7,6.9,3.2,.18,1.8,RED,tag,.03))
    for s in (-1,1):o.append(cyl('canopy tie',bx+lane_side*5.4+s*1.3,5.3,6.55,.04,1.2,STEEL,tag,verts=6))
    # rooftop bucket beacon: tapered white tub, red stripes, lid and a roundel
    bcx,bcz=bx-3.6,-.5
    o.append(frustum('bucket',bcx,bcz,8.7,11.5,1.35,1.75,WHITE,tag))
    for i in range(12):
        a=2*math.pi*i/12
        if i%2:continue
        o.append(box('bucket stripe',bcx+1.48*math.cos(a),10.1,bcz+1.48*math.sin(a),.3,2.4,.3,RED,tag,0))
    o.append(frustum('bucket rim',bcx,bcz,11.5,11.75,1.75,1.82,RED,tag))
    o.append(frustum('bucket base',bcx,bcz,8.55,8.75,1.3,1.35,RED,tag))
    o.append(disc(bcx,10.3,.86,bcz+1.5,.05,RED))
    o.append(disc(bcx,10.3,.72,bcz+1.54,.05,WHITE))
    o.append(disc(bcx,10.42,.30,bcz+1.58,.04,RED))
    o.append(cyl('bucket post',bcx,8.5,bcz,.3,.6,STEEL,tag,verts=12))
    # forecourt planters
    for dx in (-6.2,6.2):
        o.append(box('planter',bx+dx,.35,8.4,2.2,.7,1.2,KERB,tag,.04));o.append(box('shrub',bx+dx,.85,8.4,1.9,.45,.95,GREEN,tag,.12))
    return o+lane(None,tag,lane_side,RED,DARKRED)

def mcd():
    tag='mcd';lane_side=-1;bx=-lane_side*2.5;o=[]
    # body: charcoal cladding with a timber wing and the red base band
    o.append(box('body',bx,4.2,0,14,8.4,12,CHAR,tag,.05))
    o.append(box('timber wing',bx-lane_side*4.6,3.2,6.02,4.4,6.4,.2,WOOD,tag,.03))
    o.append(box('base band',bx,.45,0,14.1,.9,12.1,DARKRED,tag,.03))
    o.append(box('roof coping',bx,8.55,0,14.5,.3,12.5,WHITE,tag,.03))
    o.append(box('roof deck',bx,8.3,0,13.4,.2,11.4,ROOFM,tag,.02))
    for dz in (-3,2):o.append(box('roof plant',bx+4,8.7,dz,2.2,.6,1.6,ROOFM,tag,.04))
    # the game paints its own McDONALD'S nameplate at y=5.68 z=6.18; this is the panel behind
    o.append(box('name panel',bx,5.68,6.04,14.2,1.35,.16,CHAR,tag,.02))
    o.append(box('name rule',bx,4.94,6.12,14.2,.1,.06,YELLOW,tag,0))
    # golden arches: on the roof, and again on a tall pole sign by the road
    o.append(arches(bx+3.6,8.7,-.35,2.9,YELLOW,tag,.7))
    o.append(cyl('pole',bx-lane_side*7.6,5.0,9.6,.22,10,CHAR,tag,verts=14))
    o.append(box('pole base',bx-lane_side*7.6,.4,9.6,1.4,.8,1.4,DARKRED,tag,.04))
    o.append(arches(bx-lane_side*7.6,9.2,9.42,2.8,YELLOW,tag,.36))
    # glazing, entrance and the McCafe end
    for wx in (-3.5,.5):
        o.append(box('window',bx+wx,2.6,6.08,4.0,4.0,.1,GLASS,tag,0))
        for mx in (-1.3,1.3):o.append(box('mullion',bx+wx+mx,2.6,6.12,.09,4.0,.12,BLACK,tag,0))
    o.append(box('window head',bx-1.5,4.72,6.13,8.4,.18,.2,YELLOW,tag,0))
    o.append(box('entrance',bx+lane_side*5.4,2.25,6.1,2.2,2.2,.16,GLASS,tag,0))
    o.append(box('entrance frame',bx+lane_side*5.4,2.25,6.14,2.4,2.4,.12,YELLOW,tag,0))
    o.append(box('entrance canopy',bx+lane_side*5.4,4.8,7.0,3.4,.2,2.0,CHAR,tag,.03))
    o.append(box('canopy edge',bx+lane_side*5.4,4.66,7.95,3.4,.14,.14,YELLOW,tag,0))
    o.append(box('mccafe band',bx-lane_side*4.6,6.5,6.16,4.0,.7,.1,DARKRED,tag,.02))
    for s in (-1,1):o.append(cyl('canopy tie',bx+lane_side*5.4+s*1.4,5.4,6.6,.04,1.2,STEEL,tag,verts=6))
    # outdoor seating under the timber wing
    for dx in (-5.6,-2.6):
        o.append(cyl('table top',bx+dx,.76,8.6,.5,.06,WHITE,tag,verts=18));o.append(cyl('table leg',bx+dx,.4,8.6,.05,.7,CHAR,tag,verts=8))
        for s in (-1,1):o.append(box('seat',bx+dx+s*.9,.44,8.6,.42,.06,.42,DARKRED,tag,.01))
    return o+lane(None,tag,lane_side,YELLOW,DARKRED)

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    empties={}
    for tag,maker in (('kfc',kfc),('mcd',mcd)):
        e=bpy.data.objects.new(tag,None);s.collection.objects.link(e);empties[tag]=e
        for ob in maker():ob.parent=e
    return empties

def export(empties):
    report={}
    for tag,e in empties.items():
        batches={}
        for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            j=join(objs,f'{tag} | {" + ".join(key)}')
            for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT')
    for tag,e in empties.items():
        e.select_set(True)
        for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_DriveThrough.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    for tag,e in empties.items():
        report[tag]={'triangles':sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH'),'draws':len(e.children)}
    report['bytes']=path.stat().st_size
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('FASTFOOD WEB EXPORT',json.dumps(report),flush=True)

def render(empties):
    s=bpy.context.scene
    empties['mcd'].location=pt(24,0,0)
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1600;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(52),math.radians(15),math.radians(200))
    bpy.ops.mesh.primitive_plane_add(size=300,location=(0,0,-.02));bpy.context.object.data.materials.append(mat('Ground',(.34,.38,.31),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=32
    from mathutils import Vector
    for name,(eye,at) in {'kfc':((-16,7,26),(-2,4,2)),'mcd':((40,7,26),(26,4,2)),'pair':((12,16,44),(12,5,0)),'lane':((16,4,-16),(6,3,0))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    empties=build();export(empties)
    if '--no-render' not in ARGS:render(empties)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'fastfood.blend'))
