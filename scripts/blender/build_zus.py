"""ZUS Coffee shoplot at (27,58): the real Malaysian look - ZUS navy and white, a
full-height glass frontage, light timber counter and slat ceiling, white menu boards
on a navy back wall, the 55-degree diagonal "Z" line across the fascia, blue chairs.
Same 19 x 12 body, ground origin and +z street face as the generic shop it replaces.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_zus.py -- --no-render

Output: public/assets/models/shops/LM_SHOP_ZusCoffee.glb (root node LM_SHOP_ZusCoffee).
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/zus'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/shops'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='zus';W,D=19,12

NAVY=mat('ZUS navy',(.05,.11,.40),.45);WHITE=mat('ZUS white',(.94,.95,.97),.5);OAK=mat('Light oak',(.78,.62,.40),.6)
GLASS=mat('Shopfront glass',(.72,.80,.88),.08,alpha=.22,two_sided=True);BLACK=mat('Frame black',(.08,.08,.09),.5)
RENDER=mat('Upper render',(.90,.90,.88),.85);FLOOR=mat('Terrazzo floor',(.80,.80,.78),.7);STEEL=mat('Espresso steel',(.70,.71,.73),.3)
WARM=mat('Pendant light',(1,.92,.75),.4,emit=3);MENU=mat('Menu board',(.97,.97,.97),.4,emit=.6);SKY=mat('ZUS light blue',(.45,.62,.92),.5);GREY=mat('Chair grey',(.62,.63,.66),.6)

def text(body,x,y,z,size,m,depth=.04,align='CENTER',font=None):
    bpy.ops.object.text_add(location=pt(x,y,z));o=bpy.context.object;o.data.body=body;o.data.size=size;o.data.extrude=depth/2
    o.data.align_x=align;o.data.align_y='CENTER';o.rotation_euler=(math.pi/2,0,0)
    if font:o.data.font=font
    bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.name='text '+body;o.data.materials.append(m);o['asset']=T;return o

def diagonal(x0,y0,x1,y1,w,z,thick,m):
    dx,dy=x1-x0,y1-y0;l=math.hypot(dx,dy);nx,ny=-dy/l*w/2,dx/l*w/2
    prof=[(x0+nx,y0+ny),(x1+nx,y1+ny),(x1-nx,y1-ny),(x0-nx,y0-ny)]
    return loft('diagonal',[(z,prof),(z+thick,prof)],m,T,closed=True)

def ring(cx,cy,r_out,r_in,z,thick,m,n=48):
    outer=[(cx+r_out*math.cos(2*math.pi*i/n),cy+r_out*math.sin(2*math.pi*i/n)) for i in range(n)]
    inner=[(cx+r_in*math.cos(2*math.pi*i/n),cy+r_in*math.sin(2*math.pi*i/n)) for i in range(n)][::-1]
    prof=outer+inner
    return loft('ring',[(z,prof),(z+thick,prof)],m,T,closed=True)

def disc(cx,cy,r,z,thick,m,n=48):
    prof=[(cx+r*math.cos(2*math.pi*i/n),cy+r*math.sin(2*math.pi*i/n)) for i in range(n)]
    return loft('disc',[(z,prof),(z+thick,prof)],m,T,closed=True)

def arch_frame(x0,x1,y0,y1,band,radius,z,thick,m):
    """Thick white surround with rounded top corners, open at the floor."""
    from build_lrt import rounded
    outer=rounded([(x0,y0,0),(x1,y0,0),(x1,y1,radius),(x0,y1,radius)],10)
    inner=rounded([(x0+band,y0,0),(x1-band,y0,0),(x1-band,y1-band,max(radius-band,.05)),(x0+band,y1-band,max(radius-band,.05))],10)
    prof=outer+inner[::-1]
    return loft('arch frame',[(z,prof),(z+thick,prof)],m,T,closed=True)

def medallion(cx,cy,R,z,facing=1):
    """ZUS style round emblem: white ring, navy disc, white shepherd-and-cup silhouette."""
    parts=[disc(cx,cy,R,z,.03*facing,WHITE),disc(cx,cy,R*.86,z+.03*facing,.03*facing,NAVY)]
    parts.append(disc(cx+R*.1,cy+R*.3,R*.2,z+.03*facing,.03*facing,WHITE,24))
    body=[(cx-R*.42,cy-R*.5),(cx+R*.38,cy-R*.5),(cx+R*.22,cy+R*.12),(cx-R*.1,cy+R*.2),(cx-R*.5,cy-R*.1)]
    parts.append(loft('cloak',[(z+.03*facing,body),(z+.06*facing,body)],WHITE,T,closed=True))
    parts.append(disc(cx+R*.42,cy-R*.32,R*.13,z+.03*facing,.03*facing,WHITE,16))
    return join(parts,'medallion')

def sweep_x(name,profile_zy,x0,x1,m,smooth=True):
    """Closed (z,y) profile extruded along x."""
    verts=[];faces=[];n=len(profile_zy)
    for xx in (x0,x1):
        for zz,yy in profile_zy:verts.append(pt(xx,yy,zz))
    for i in range(n):faces.append((i,(i+1)%n,n+(i+1)%n,n+i))
    faces.append(tuple(range(n))[::-1]);faces.append(tuple(n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob);ob.data.materials.append(m);ob['asset']=T
    for f in mesh.polygons:f.use_smooth=smooth
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def shop():
    o=[];font=None
    for candidate in ['/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf','/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Helvetica.ttc']:
        try:font=bpy.data.fonts.load(candidate);break
        except Exception:pass
    F=D/2   # street face z
    # body: upper floor white render; ground floor is a 5 m deep open-front room
    o.append(box('upper floor',0,8.4,0,W,6.8,D,RENDER,T,.04))
    o.append(box('cornice',0,11.05,0,W+.4,.3,D+.5,WHITE,T,.03));o.append(box('roof trim',0,11.3,0,W+.15,.2,D+.2,NAVY,T,.02))
    o.append(box('parapet',0,11.6,-5.8,W,.32,.2,WHITE,T,.02))
    o.append(box('ground rear',0,2.5,-2.5,W,5,7,RENDER,T,.04))          # z -6 .. 1
    for xx in (-6.5,0,6.5):
        o.append(box('window frame',xx,8.4,F+.02,3.2,2.6,.1,NAVY,T,0));o.append(box('window',xx,8.4,F+.05,2.9,2.3,.04,GLASS,T,0))
        o.append(box('sill',xx,7.05,F+.12,3.4,.12,.3,WHITE,T,0))
    # navy top band with the big slanted white wordmark over a light-blue halo
    o.append(box('top band',0,5.55,F+.05,W,1.5,.3,NAVY,T,.02))
    o.append(text('ZUS COFFEE',0,5.55,F+.21,1.33,SKY,.03,font=font))
    o.append(text('ZUS COFFEE',0,5.55,F+.25,1.3,WHITE,.08,font=font))
    # right navy panel with the medallion and a white curved blade beside it
    o.append(box('navy panel',6.75,2.4,F-.15,5.5,4.8,.3,NAVY,T,.02))
    o.append(medallion(7.3,2.6,1.35,F+.02))
    o.append(box('white blade',4.7,2.45,F+.05,.6,3.7,.06,WHITE,T,.02))
    # open front: thick white surround with rounded top corners, dark threshold band
    o.append(arch_frame(-9.5,4.0,0,4.85,.55,1.1,F-.3,.6,WHITE))
    o.append(box('threshold',-2.75,.02,F-.1,13.4,.04,.6,BLACK,T,0))
    # interior room: light tile floor, dark ceiling with spotlights, white walls
    o.append(box('floor',-2.75,.03,3.5,13.4,.06,5,FLOOR,T,0))
    o.append(box('ceiling',-2.75,4.9,3.5,13.4,.2,5,BLACK,T,0))
    for xx in (-8,-5.5,-3,-.5,2):
        for zz in (2.2,4.6):o.append(cyl('spot',xx,4.78,zz,.1,.04,WARM,T,verts=10))
    o.append(box('back wall',-2.75,2.5,1.05,13.4,4.8,.1,RENDER,T,0))
    o.append(box('left wall',-9.45,2.5,3.5,.1,4.8,5,WHITE,T,0));o.append(box('right wall',3.95,2.5,3.5,.1,4.8,5,NAVY,T,0))
    # white curved canopy over the counter carrying three round ZUS signs
    arc=[(1.05+2.2*math.cos(math.pi/2*i/12),3.0+1.9*math.sin(math.pi/2*i/12)) for i in range(13)]
    o.append(sweep_x('canopy',arc+[(zz,yy-.16) for zz,yy in arc][::-1],-7.6,1.6,WHITE))
    for xx in (-6.0,-3.0,0.0):
        o.append(cyl('sign rod',xx,4.5,3.7,.015,.8,BLACK,T,verts=6))
        o.append(disc(xx,3.55,.55,3.68,.05,WHITE));o.append(disc(xx,3.55,.47,3.73,.03,NAVY))
        o.append(text('ZUS',xx,3.55,3.77,.34,WHITE,.02,font=font))
    # counter: white with a curved end, pastry case, cups; digital menu screen on the left wall
    o.append(box('counter',-3.0,.55,2.2,8.0,1.1,1.0,WHITE,T,.03));o.append(cyl('counter curve',1.0,.55,2.2,.5,1.1,WHITE,T,verts=20))
    o.append(box('counter top',-2.9,1.12,2.2,8.4,.06,1.1,FLOOR,T,.01))
    o.append(box('espresso machine',-5.5,1.5,2.0,1.4,.7,.6,STEEL,T,.03));o.append(box('machine top',-5.5,1.9,2.0,1.45,.1,.65,NAVY,T,.02))
    o.append(box('pastry case',-1.5,1.45,2.2,2.4,.6,.8,GLASS,T,0))
    for j in range(5):o.append(cyl('cup',-3.9+j*.35,1.28,2.3,.1,.26,WHITE,T,verts=10));o.append(cyl('lid',-3.9+j*.35,1.43,2.3,.11,.04,NAVY,T,verts=10))
    o.append(box('menu screen',-9.36,2.9,3.6,.06,1.6,2.6,SKY,T,0));o.append(box('screen frame',-9.39,2.9,3.6,.05,1.75,2.75,BLACK,T,0))
    o.append(box('poster stand',2.6,1.0,5.0,.9,1.6,.06,SKY,T,0));o.append(box('poster frame',2.6,1.0,5.02,1.0,1.7,.04,WHITE,T,0))
    # tables and chairs in the room
    for tx,tz in ((-7.5,4.6),(-5.2,4.6),(-2.9,4.6),(-.6,4.6)):
        o.append(cyl('table top',tx,.75,tz,.45,.05,WHITE,T,verts=20));o.append(cyl('table leg',tx,.4,tz,.04,.7,BLACK,T,verts=8));o.append(cyl('table foot',tx,.03,tz,.25,.05,BLACK,T,verts=12))
        for cx in (-.7,.7):
            o.append(box('chair seat',tx+cx,.45,tz,.4,.05,.4,GREY,T,.01));o.append(box('chair back',tx+cx*1.4,.7,tz,.05,.45,.4,GREY,T,.01))
            for lx,lz in ((-.15,-.15),(.15,-.15),(-.15,.15),(.15,.15)):o.append(cyl('chair leg',tx+cx+lx,.22,tz+lz,.012,.44,BLACK,T,verts=5))
    return o

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new('LM_SHOP_ZusCoffee',None);s.collection.objects.link(e)
    for ob in shop():ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'zus | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_SHOP_ZusCoffee.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_SHOP_ZusCoffee','origin':[27,0,58],'body':[W,11,D],'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('ZUS WEB EXPORT',json.dumps(report),flush=True)

def render():
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1600;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(150))
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=30
    from mathutils import Vector
    for name,(eye,at) in {'street':((12,4,20),(-1,3.5,6)),'front':((-2,3,17),(-2,3,4)),'inside':((-1,2.6,9.5),(-3.5,2.8,2.5))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'zus.blend'))
