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

def font():
    for candidate in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Helvetica.ttc']:
        try:return bpy.data.fonts.load(candidate)
        except Exception:pass

def lane(tag,lane_side,canopy_material,trim_material,letter_material,dual=False):
    """Drive-thru lane: kerbed asphalt, canopied order bay with lit menu boards, speaker post,
    clearance bar and a canopied pickup window. Lettering is baked, not painted by the game."""
    lx=lane_side*8;o=[];f=font()
    o.append(box('lane',lx,.035,0,5.5,.07,23,ASPHALT,tag,0))
    for dz in range(-9,10,4):o.append(box('lane dash',lx,.08,dz,.16,.03,1.8,PAINT,tag,0))
    for s in (-1,1):o.append(box('lane kerb',lx+s*2.85,.12,0,.25,.16,23,KERB,tag,.02))
    o.append(box('lane arrow',lx,.085,8.5,.5,.02,1.6,PAINT,tag,0))
    ox=lx-lane_side*2.5
    o.append(box('order canopy',ox+lane_side*.9,3.55,1.3,5.0,.24,4.4,canopy_material,tag,.04))
    o.append(box('order canopy trim',ox+lane_side*.9,3.36,1.3,5.1,.14,4.5,trim_material,tag,.02))
    o.append(text('DRIVE THRU',ox+lane_side*.9,3.55,3.52,.42,letter_material,.05,font=f))
    for dz in (-.6,3.2):o.append(cyl('canopy post',ox+lane_side*2.9,1.75,dz,.09,3.5,STEEL,tag,verts=10))
    boards=(-.9,.9) if dual else (0,)
    for k,dx in enumerate(boards):
        bxo=ox+dx*lane_side*0
        o.append(box('menu board back',ox,1.55,1.3+dx*1.2,1.6,3.1,.9,BLACK,tag,.03))
    for dz in (-.42,.42):
        o.append(box('menu screen',ox-lane_side*.47,1.95,1.3+dz,.06,1.6,.74,SCREEN,tag,0))
        o.append(box('menu glow',ox-lane_side*.5,1.95,1.3+dz,.02,1.4,.62,LIT,tag,0))
    o.append(text('ORDER HERE',ox-lane_side*.52,3.0,1.3,.16,letter_material,.02,font=f))
    o.append(cyl('speaker post',ox-lane_side*1.1,1.1,-1.6,.06,2.2,STEEL,tag,verts=8))
    o.append(box('speaker',ox-lane_side*1.1,2.25,-1.6,.34,.42,.3,BLACK,tag,.03))
    o.append(cyl('clearance bar',lx,3.9,9.0,.06,5.6,trim_material,tag,axis='x',verts=8))
    o.append(box('clearance sign',lx,3.9,9.0,1.6,.36,.06,canopy_material,tag,0))
    o.append(text('2.2 m',lx,3.9,9.04,.2,letter_material,.02,font=f))
    for s in (-1,1):o.append(cyl('clearance post',lx+s*2.7,1.95,9.0,.08,3.9,STEEL,tag,verts=8))
    px=lx-lane_side*4.9
    o.append(box('pickup canopy',px,3.4,-5.0,2.8,.2,3.8,canopy_material,tag,.03))
    o.append(box('pickup window',px-lane_side*.05,1.9,-5.0,.12,1.6,1.8,GLASS,tag,0))
    o.append(box('pickup frame',px-lane_side*.02,1.9,-5.0,.1,1.8,2.0,BLACK,tag,0))
    o.append(text('PICK UP',px+lane_side*.02,2.95,-5.0,.16,letter_material,.02,font=f))
    for dz in (-6.6,-3.4):o.append(cyl('pickup light',px+lane_side*.6,3.26,dz,.12,.05,LAMP,tag,verts=10))
    return o

def kfc():
    """Malaysian KFC drive-thru: white box, red 3D letters, red stripe wall, Colonel band with
    the roundel, red drive-thru canopy, and the bucket up on a pole sign by the road."""
    tag='kfc';ls=1;bx=-ls*2.5;o=[];f=font()
    o.append(box('body',bx,4.2,0,14,8.4,12,WHITE,tag,.05))
    o.append(box('plinth',bx,.3,0,14.1,.6,12.1,CHAR,tag,.03))
    o.append(box('parapet',bx,8.6,0,14.3,.4,12.3,WHITE,tag,.03))
    o.append(box('roof deck',bx,8.3,0,13.4,.2,11.4,ROOFM,tag,.02))
    for dz in (-3,2):o.append(box('roof plant',bx-4,8.7,dz,2.2,.6,1.6,ROOFM,tag,.04))
    # red stripe wall on the lane side of the frontage
    sx=bx+ls*4.8
    o.append(box('stripe wall',sx,4.5,6.05,4.2,7.8,.16,WHITE,tag,.02))
    for i in range(7):o.append(box('stripe',sx-1.8+i*.6,4.5,6.14,.3,7.8,.04,RED,tag,0))
    # Colonel band: red strip across the frontage with the roundel and the wordmark beside it
    o.append(box('brand band',bx-ls*2.0,6.3,6.06,9.6,1.7,.2,RED,tag,.02))
    rx=bx-ls*5.3
    o.append(disc(rx,6.3,.78,6.17,.06,WHITE));o.append(disc(rx,6.3,.64,6.24,.03,RED));o.append(disc(rx,6.3,.5,6.28,.03,WHITE))
    o.append(text('KFC',rx,6.3,6.32,.42,RED,.03,font=f))
    o.append(text('KFC',bx-ls*1.2,6.3,6.17,1.35,WHITE,.22,font=f))
    # glazing with bronze frames under the band, red portal at the entrance
    for wx in (-4.6,-1.4,1.8):
        o.append(box('window',bx+wx,2.75,6.08,2.9,3.9,.1,GLASS,tag,0))
        for mx in (-1.45,1.45):o.append(box('mullion',bx+wx+mx,2.75,6.12,.1,3.9,.14,BLACK,tag,0))
    o.append(box('window head',bx-ls*1.4,4.8,6.12,9.8,.16,.18,BLACK,tag,0))
    ex=bx+ls*4.8
    o.append(box('entrance glass',ex,1.3,6.1,2.0,2.4,.12,GLASS,tag,0))
    o.append(box('portal',ex,1.45,6.2,2.5,2.9,.3,RED,tag,.03))
    o.append(box('portal void',ex,1.3,6.36,2.0,2.4,.04,GLASS,tag,0))
    # bucket on a red pole sign by the road
    pxs,pzs=bx-ls*8.4,9.4
    o.append(cyl('sign pole',pxs,5.0,pzs,.28,10,RED,tag,verts=14))
    o.append(box('sign base',pxs,.35,pzs,1.3,.7,1.3,CHAR,tag,.03))
    o.append(frustum('bucket',pxs,pzs,10.0,12.6,1.3,1.7,WHITE,tag))
    for i in range(0,12,2):
        a=2*math.pi*i/12;o.append(box('bucket stripe',pxs+1.42*math.cos(a),11.3,pzs+1.42*math.sin(a),.3,2.3,.3,RED,tag,0))
    o.append(frustum('bucket rim',pxs,pzs,12.6,12.9,1.7,1.78,RED,tag));o.append(frustum('bucket foot',pxs,pzs,9.85,10.05,1.25,1.3,RED,tag))
    o.append(disc(pxs,11.4,.8,pzs+1.48,.05,RED));o.append(disc(pxs,11.4,.66,pzs+1.52,.04,WHITE));o.append(text('KFC',pxs,11.4,pzs+1.56,.45,RED,.03,font=f))
    o.append(box('drive thru plate',pxs,8.0,pzs+.3,2.4,.7,.1,RED,tag,.02));o.append(text('DRIVE THRU',pxs,8.0,pzs+.37,.28,WHITE,.03,font=f))
    for dx in (-6.4,-3.2):o.append(box('planter',bx+dx,.35,8.6,2.0,.7,1.1,KERB,tag,.04));o.append(box('shrub',bx+dx,.85,8.6,1.7,.45,.85,GREEN,tag,.12))
    return o+lane(tag,ls,RED,DARKRED,WHITE)

def mcd():
    """Malaysian McDonald's drive-thru: charcoal box, yellow corner brow with the arches on the
    roof edge, red McDonald's wordmark, McCafe wing, yellow Drive-Thru canopy and dual boards."""
    tag='mcd';ls=-1;bx=-ls*2.5;o=[];f=font()
    o.append(box('body',bx,4.2,0,14,8.4,12,CHAR,tag,.05))
    o.append(box('plinth',bx,.3,0,14.1,.6,12.1,BLACK,tag,.03))
    o.append(box('roof coping',bx,8.55,0,14.4,.3,12.4,CHAR,tag,.03));o.append(box('roof deck',bx,8.3,0,13.4,.2,11.4,ROOFM,tag,.02))
    for dz in (-3,2):o.append(box('roof plant',bx+4,8.7,dz,2.2,.6,1.6,ROOFM,tag,.04))
    # yellow corner brow: a tall blade at the lane-side corner carrying the arches above the roof
    cx=bx+ls*6.4
    o.append(box('brow blade',cx,5.6,6.1,2.2,11.2,.5,YELLOW,tag,.04))
    o.append(box('brow return',cx+ls*.85,5.6,3.0,.5,11.2,6.6,YELLOW,tag,.04))
    o.append(arches(cx-ls*.1,9.0,6.2,2.9,YELLOW,tag,.5))
    # wordmark on a white eyebrow band, McCafe wing on the other end
    o.append(box('eyebrow',bx-ls*1.0,5.35,6.1,9.4,.9,.24,WHITE,tag,.02))
    o.append(text("McDonald's",bx-ls*1.0,5.35,6.24,.62,RED,.08,font=f))
    o.append(arches(bx-ls*5.0,4.95,6.26,.8,YELLOW,tag,.06))
    o.append(box('mccafe wing',bx-ls*5.0,3.2,6.06,3.8,6.4,.2,WOOD,tag,.03))
    o.append(box('mccafe band',bx-ls*5.0,6.7,6.18,3.6,.7,.08,DARKRED,tag,.02))
    o.append(text('McCafe',bx-ls*5.0,6.7,6.24,.36,WHITE,.03,font=f))
    for wx in (-1.7,1.7):
        o.append(box('window',bx+ls*1.0+wx,2.65,6.08,3.2,4.0,.1,GLASS,tag,0))
        for mx in (-1.6,1.6):o.append(box('mullion',bx+ls*1.0+wx+mx,2.65,6.12,.1,4.0,.14,BLACK,tag,0))
    o.append(box('window head',bx+ls*1.0,4.72,6.13,6.9,.16,.2,BLACK,tag,0))
    o.append(box('cafe window',bx-ls*5.0,2.0,6.1,2.6,2.6,.1,GLASS,tag,0))
    ex=bx+ls*4.6
    o.append(box('entrance glass',ex,1.3,6.1,2.0,2.4,.12,GLASS,tag,0));o.append(box('entrance frame',ex,1.3,6.14,2.2,2.6,.1,BLACK,tag,0))
    o.append(box('entrance canopy',ex,3.9,7.0,3.2,.16,2.0,CHAR,tag,.03));o.append(box('canopy lip',ex,3.82,7.95,3.2,.1,.12,YELLOW,tag,0))
    for s in (-1,1):o.append(cyl('canopy tie',ex+s*1.3,4.5,6.6,.04,1.2,STEEL,tag,verts=6))
    # tall pole sign: red rounded panel with the arches and Drive-Thru
    pxs,pzs=bx-ls*8.4,9.6
    o.append(cyl('pole',pxs,5.0,pzs,.22,10,CHAR,tag,verts=14));o.append(box('pole base',pxs,.35,pzs,1.3,.7,1.3,BLACK,tag,.03))
    o.append(box('sign panel',pxs,10.6,pzs,3.2,3.4,.36,DARKRED,tag,.12))
    o.append(arches(pxs,9.4,pzs+.19,2.4,YELLOW,tag,.14));o.append(arches(pxs,9.4,pzs-.33,2.4,YELLOW,tag,.14))
    o.append(box('drive thru plate',pxs,8.35,pzs,2.6,.6,.3,YELLOW,tag,.03));o.append(text('Drive-Thru',pxs,8.35,pzs+.16,.28,BLACK,.02,font=f))
    for dx in (-5.6,-2.6):
        o.append(cyl('table top',bx+dx,.76,8.6,.5,.06,WHITE,tag,verts=18));o.append(cyl('table leg',bx+dx,.4,8.6,.05,.7,CHAR,tag,verts=8))
        for s in (-1,1):o.append(box('seat',bx+dx+s*.9,.44,8.6,.42,.06,.42,DARKRED,tag,.01))
    return o+lane(tag,ls,YELLOW,CHAR,BLACK,dual=True)

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
    for name,(eye,at) in {'kfc':((-18,6,24),(-3,5,3)),'mcd':((44,6,24),(27,5,3)),'pair':((12,16,44),(12,5,0)),'lane':((16,4,-16),(6,3,0))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    empties=build();export(empties)
    if '--no-render' not in ARGS:render(empties)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'fastfood.blend'))
