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
WARM=mat('Pendant light',(1,.92,.75),.4,emit=3);MENU=mat('Menu board',(.97,.97,.97),.4,emit=.6);SKY=mat('ZUS light blue',(.45,.62,.92),.5)

def text(body,x,y,z,size,m,depth=.04,align='CENTER',font=None):
    bpy.ops.object.text_add(location=pt(x,y,z));o=bpy.context.object;o.data.body=body;o.data.size=size;o.data.extrude=depth/2
    o.data.align_x=align;o.data.align_y='CENTER';o.rotation_euler=(math.pi/2,0,0)
    if font:o.data.font=font
    bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.name='text '+body;o.data.materials.append(m);o['asset']=T;return o

def diagonal(x0,y0,x1,y1,w,z,thick,m):
    dx,dy=x1-x0,y1-y0;l=math.hypot(dx,dy);nx,ny=-dy/l*w/2,dx/l*w/2
    prof=[(x0+nx,y0+ny),(x1+nx,y1+ny),(x1-nx,y1-ny),(x0-nx,y0-ny)]
    return loft('diagonal',[(z,prof),(z+thick,prof)],m,T,closed=True)

def shop():
    o=[];font=None
    for candidate in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Helvetica.ttc']:
        try:font=bpy.data.fonts.load(candidate);break
        except Exception:pass
    # body: upper floor white render, ground floor recessed 3 m behind the glass line
    o.append(box('upper floor',0,8.4,0,W,6.8,D,RENDER,T,.04))
    o.append(box('cornice',0,11.05,0,W+.4,.3,D+.5,WHITE,T,.03));o.append(box('roof trim',0,11.3,0,W+.15,.2,D+.2,NAVY,T,.02))
    o.append(box('parapet',0,11.6,-5.8,W,.32,.2,WHITE,T,.02))
    o.append(box('ground rear',0,2.5,-1.5,W,5,9,RENDER,T,.04))          # z -6 .. 3
    for xx in (-W/2+.5,W/2-.5):o.append(box('side wall',xx,2.5,4.5,1,5,3,RENDER,T,.03))
    o.append(box('slab',0,5.0,4.5,W,.4,3.2,WHITE,T,.02))
    # upper windows with navy frames
    for xx in (-6.5,0,6.5):
        o.append(box('window frame',xx,8.4,D/2+.02,3.2,2.6,.1,NAVY,T,0));o.append(box('window',xx,8.4,D/2+.05,2.9,2.3,.04,GLASS,T,0))
        o.append(box('sill',xx,7.05,D/2+.12,3.4,.12,.3,WHITE,T,0))
    # navy fascia with the white 55-degree diagonal and the wordmark
    o.append(box('fascia',0,5.9,D/2+.05,W,1.9,.3,NAVY,T,.02))
    o.append(diagonal(-9.2,5.0,-7.9,6.8,.14,D/2+.2,.03,WHITE))
    o.append(diagonal(7.9,5.0,9.2,6.8,.14,D/2+.2,.03,WHITE))
    o.append(text('ZUS',-2.9,5.95,D/2+.22,1.35,WHITE,.06,font=font))
    o.append(text('COFFEE',3.0,5.9,D/2+.22,.95,WHITE,.05,font=font))
    o.append(cyl('logo disc',-6.6,5.9,D/2+.24,.62,.06,WHITE,T,axis='z',verts=32))
    o.append(cyl('logo ring',-6.6,5.9,D/2+.27,.5,.04,NAVY,T,axis='z',verts=32))
    o.append(cyl('logo cup',-6.6,5.75,D/2+.30,.22,.03,WHITE,T,axis='z',verts=20))
    o.append(box('logo steam',-6.6,6.12,D/2+.30,.06,.28,.03,WHITE,T,0))
    # glass frontage on the z=6 line: black frames, tall panes, double door, navy door band
    for xx in (-9.0,-4.5,0,4.5,9.0):o.append(box('mullion',xx,2.5,D/2-.05,.12,5,.14,BLACK,T,0))
    o.append(box('head frame',0,4.85,D/2-.05,W,.14,.14,BLACK,T,0));o.append(box('sill frame',0,.12,D/2-.05,W,.24,.14,BLACK,T,0))
    for xx in (-6.75,6.75):o.append(box('pane',xx,2.5,D/2-.05,4.3,4.6,.04,GLASS,T,0))
    for xx in (-2.25,2.25):o.append(box('pane',xx,2.5,D/2-.05,4.3,4.6,.04,GLASS,T,0))
    for xx in (-1.05,1.05):o.append(box('door frame',xx,1.2,D/2-.03,.08,2.4,.1,BLACK,T,0));o.append(box('door handle',xx*.85,1.1,D/2+.05,.05,.7,.05,STEEL,T,0))
    o.append(box('door band',0,2.55,D/2-.02,2.3,.14,.08,NAVY,T,0))
    o.append(box('open sign',3.0,1.0,D/2+.03,1.2,.5,.04,NAVY,T,0))
    # interior: terrazzo floor, timber slat ceiling, navy back wall, menu boards, counter
    o.append(box('floor',0,.03,4.5,W-2,.06,3,FLOOR,T,0))
    for i in range(14):o.append(box('slat',-8.2+i*1.26,4.75,4.5,.12,.12,2.9,OAK,T,0))
    o.append(box('back wall',0,2.5,3.05,W-2,4.9,.1,NAVY,T,0))
    for xx in (-4.2,0,4.2):
        o.append(box('menu board',xx,3.6,3.12,3.6,1.5,.04,MENU,T,0))
        for k in range(5):o.append(box('menu line',xx-.3,4.15-k*.26,3.15,2.2 if k%2 else 1.6,.06,.02,NAVY,T,0))
        o.append(box('menu price',xx+1.3,4.15,3.15,.5,.06,.02,SKY,T,0))
    o.append(box('counter front',0,.55,4.6,9,1.1,.9,OAK,T,.03));o.append(box('counter band',0,.95,5.06,9.05,.12,.02,NAVY,T,0))
    o.append(box('counter top',0,1.13,4.6,9.2,.08,1.0,WHITE,T,.01))
    o.append(box('espresso machine',-2.4,1.5,4.4,1.5,.7,.6,STEEL,T,.03));o.append(box('machine top',-2.4,1.9,4.4,1.55,.1,.65,NAVY,T,.02))
    o.append(box('grinder',-1.2,1.55,4.4,.3,.8,.3,BLACK,T,.02))
    for j in range(5):
        o.append(cyl('cup',.6+j*.42,1.3,4.5,.12,.28,WHITE,T,verts=10));o.append(cyl('lid',.6+j*.42,1.46,4.5,.13,.04,NAVY,T,verts=10))
    o.append(box('pickup shelf',3.8,1.55,3.3,3.0,.06,.4,OAK,T,0));o.append(box('pickup sign',3.8,2.0,3.2,1.6,.3,.03,NAVY,T,0))
    o.append(box('pastry case',3.2,1.5,4.6,2.2,.6,.8,GLASS,T,0))
    for xx in (-2.4,1.5,4.5):
        for zz in (3.6,5.4):o.append(cyl('pendant shade',xx,3.1,zz,.18,.22,WARM,T,verts=12));o.append(cyl('pendant',xx,3.9,zz,.02,1.6,BLACK,T,verts=6))
    # window bar and blue chairs by the glass, both ends
    for s in (-1,1):
        o.append(box('window bar',s*6.8,.95,5.4,3.6,.06,.45,OAK,T,0))
        for k in (-1,0,1):
            xx=s*6.8+k*1.1
            o.append(box('chair seat',xx,.5,4.7,.42,.06,.42,SKY,T,.01));o.append(box('chair back',xx,.75,4.5,.42,.5,.05,SKY,T,.01))
            for cx,cz in ((-.17,-.17),(.17,-.17),(-.17,.17),(.17,.17)):o.append(cyl('chair leg',xx+cx,.25,4.7+cz,.015,.5,BLACK,T,verts=5))
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
    for name,(eye,at) in {'street':((14,5,22),(0,4,6)),'front':((0,3,18),(0,3,5)),'inside':((-3,2.2,9),(0,2,4))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'zus.blend'))
