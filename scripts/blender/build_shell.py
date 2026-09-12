"""Malaysian Shell forecourt (Shell Select shop, red/yellow/white canopy, pumps, pecten
pylon) for the corner at (33,103), next to PETRONAS. Same footprint and collision boxes as
the procedural station in world.ts; the game keeps drawing its own text signs on top.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_shell.py -- --no-render

Output: public/assets/models/environment/LM_ENV_Shell.glb, node 'shell' at the pad origin.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/shell'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='shell'

YELLOW=mat('Shell yellow',(.98,.78,.02),.4);RED=mat('Shell red',(.83,.09,.09),.42);WHITE=mat('Shell white',(.95,.95,.93),.45)
GREY=mat('Shell grey',(.55,.56,.55),.8);ASPHALT=mat('Forecourt asphalt',(.30,.31,.30),.95);CURB=mat('Forecourt curb',(.78,.78,.74),.85)
PAINT=mat('Lane paint',(.92,.92,.88),.6);GLASS=mat('Storefront glass',(.45,.62,.72),.1,alpha=.45,two_sided=True)
DARK=mat('Pump dark',(.12,.12,.13),.6);SCREEN=mat('Pump screen',(.08,.2,.35),.3,emit=1.5);LAMP=mat('Canopy light',(1,.98,.92),.4,emit=3)
STEEL=mat('Brushed steel',(.62,.63,.65),.4);SHADOW=mat('Pecten red',(.80,.06,.06),.4);ROOFM=mat('Shop roof',(.70,.70,.68),.9)

def bar(p0,p1,w):
    """Thin rectangle from p0 to p1 as 4 (x,y) points."""
    dx,dy=p1[0]-p0[0],p1[1]-p0[1];l=math.hypot(dx,dy);nx,ny=-dy/l*w/2,dx/l*w/2
    return [(p0[0]+nx,p0[1]+ny),(p1[0]+nx,p1[1]+ny),(p1[0]-nx,p1[1]-ny),(p0[0]-nx,p0[1]-ny)]

def pecten(x,y,z,R,facing=1):
    """Stylised scallop: yellow shell with red ribs on a red backing. facing=+1 faces +z."""
    def outline(r):
        pts=[]
        for i in range(37):
            a=math.pi*i/36;rr=r*(1-.045*math.sin(7*a)**2);pts.append((rr*math.cos(a),rr*math.sin(a)))
        pts+=[(-.62*r,-.55*r),(-.28*r,-.78*r),(.28*r,-.78*r),(.62*r,-.55*r)]
        return pts
    def flat(name,shape,dz,thick,m):
        prof=[(x+px,y+py) for px,py in shape]
        return [loft(name,[(z+dz,prof),(z+dz+thick*facing,prof)],m,T,closed=True)]
    parts=flat('pecten backing',outline(R*1.13),0,.04,SHADOW)+flat('pecten shell',outline(R),.04*facing,.03,YELLOW)
    hinge=(0,-.6*R)
    for k in range(7):
        a=math.radians(22+k*136/6);tip=(R*.93*math.cos(a),R*.93*math.sin(a))
        parts+=flat('pecten rib',bar(hinge,tip,.05*R),.07*facing,.02,SHADOW)
    parts+=flat('pecten arc',[(px*.5,py*.5) for px,py in outline(R)][:37]+[(0,-.3*R)],.07*facing,.02,SHADOW)
    parts+=flat('pecten inner',[(px*.42,py*.42) for px,py in outline(R)][:37]+[(0,-.25*R)],.09*facing,.02,YELLOW)
    return join(parts,'pecten')

def station():
    o=[]
    # pad, curbs and paint
    o.append(box('pad',0,.04,0,25,.08,25,ASPHALT,T,0))
    for zz in (-12.3,12.3):o.append(box('curb',0,.12,zz,25,.16,.4,CURB,T,.02))
    for xx in (-12.3,12.3):o.append(box('curb',xx,.12,0,.4,.16,25,CURB,T,.02))
    for xx in (-7,7):
        for zz in (-9.5,1.5):o.append(box('stop line',xx,.085,zz,4,.01,.16,PAINT,T,0))
        for zz in (-7.5,-5.2,-2.8,-.5):o.append(box('lane dash',xx-2.6,.085,zz,.16,.01,1.2,PAINT,T,0));o.append(box('lane dash',xx+2.6,.085,zz,.16,.01,1.2,PAINT,T,0))
    # canopy over the pumps: deck, lit soffit, tri-colour fascia, columns with bumper bands
    o.append(box('canopy deck',0,5.15,-4,18,.55,10,WHITE,T,.04))
    o.append(box('canopy fascia',0,5.15,-4,18.3,1.1,10.3,WHITE,T,.03))
    o.append(box('fascia red',0,5.62,-4,18.36,.16,10.36,RED,T,0))
    o.append(box('fascia yellow',0,4.72,-4,18.36,.28,10.36,YELLOW,T,0))
    for xx in (-6,0,6):
        for zz in (-6.5,-1.5):o.append(box('soffit light',xx,4.58,zz,1.6,.04,.5,LAMP,T,0))
    for xx in (-7,7):
        for zz in (-8.2,.2):
            o.append(cyl('column',xx,2.5,zz,.22,5,WHITE,T,verts=14))
            o.append(cyl('column bumper',xx,.9,zz,.26,.5,RED,T,verts=14));o.append(cyl('column bumper',xx,.45,zz,.26,.4,YELLOW,T,verts=14))
    for s,zz in ((-1,-9.16),(1,1.16)):o.append(pecten(0,5.15,zz,.42,facing=s))
    # pump islands with two dispensers each
    for xx in (-7,7):
        o.append(box('island',xx,.18,-4,1.6,.28,5.2,CURB,T,.03))
        for zz in (-6.3,-1.7):o.append(cyl('bollard',xx,.6,zz,.09,.9,YELLOW,T,verts=10))
        for zz in (-4.9,-3.1):
            o.append(box('pump body',xx,1.3,zz,.9,2.1,.7,WHITE,T,.03))
            o.append(box('pump base',xx,.4,zz,.95,.3,.75,GREY,T,.02))
            o.append(box('pump crown',xx,2.5,zz,.95,.3,.75,RED,T,.02))
            o.append(box('pump yellow',xx,2.28,zz,.92,.14,.72,YELLOW,T,0))
            for s in (-1,1):
                o.append(box('pump screen',xx+s*.46,1.75,zz,.02,.4,.5,SCREEN,T,0))
                o.append(box('nozzle boot',xx+s*.47,1.05,zz-.18,.06,.5,.16,DARK,T,0));o.append(box('nozzle boot',xx+s*.47,1.05,zz+.18,.06,.5,.16,DARK,T,0))
                o.append(box('nozzle',xx+s*.5,1.32,zz-.18,.1,.16,.12,RED,T,0));o.append(box('nozzle',xx+s*.5,1.32,zz+.18,.1,.16,.12,YELLOW,T,0))
                o.append(cyl('hose',xx+s*.52,1.85,zz,.025,.9,DARK,T,verts=6))
    # Shell Select shop: white box, grey plinth, glass front, red fascia, roof plant
    o.append(box('shop',0,3.1,7.6,20,6.2,6.8,WHITE,T,.04))
    o.append(box('shop plinth',0,.3,7.55,20.1,.6,6.9,GREY,T,.02))
    o.append(box('shop fascia',0,5.55,3.75,20.2,1.3,.4,RED,T,.02))
    o.append(box('shop fascia band',0,4.85,3.75,20.2,.14,.42,YELLOW,T,0))
    o.append(box('shop parapet',0,6.35,7.6,20.4,.3,7.2,YELLOW,T,.02))
    o.append(box('storefront glass',0,2.55,3.62,17.5,3.6,.06,GLASS,T,0))
    for xx in (-8.8,-4.4,0,4.4,8.8):o.append(box('mullion',xx,2.55,3.62,.1,3.6,.1,DARK,T,0))
    o.append(box('door frame',0,1.45,3.6,2.2,2.3,.12,DARK,T,0))
    o.append(box('shop awning',0,4.2,3.2,19,.1,1.2,WHITE,T,0))
    for zz in (6,9):o.append(box('roof aircon',-5,6.75,zz,2,.5,1.4,ROOFM,T,.03));o.append(box('roof aircon',6,6.75,zz,2,.5,1.4,ROOFM,T,.03))
    o.append(pecten(-8.6,5.55,3.57,.5,facing=-1))
    o.append(pecten(8.6,5.55,3.57,.5,facing=-1))
    for xx in (-9.3,9.3):o.append(box('side pilaster',xx,3.1,3.9,.5,6.2,.5,WHITE,T,.02))
    # pylon: white monolith, pecten crown, price board, red base
    o.append(box('pylon',11,5,-9,2.5,10,1,WHITE,T,.04))
    o.append(box('pylon base',11,.4,-9,2.7,.8,1.2,RED,T,.02))
    o.append(box('pylon crown',11,10.15,-9,2.6,.3,1.1,RED,T,.02))
    o.append(pecten(11,8.7,-9.5,.85,facing=-1));o.append(pecten(11,8.7,-8.5,.85,facing=1))
    o.append(box('price board',11,4.8,-9.525,2.1,1.9,.04,WHITE,T,0))
    o.append(box('price board edge',11,4.8,-9.49,2.2,2,.04,YELLOW,T,0))
    # air and water bay, bins
    o.append(box('air water unit',-11,.9,-10.5,.8,1.6,.6,YELLOW,T,.03));o.append(box('air water top',-11,1.8,-10.5,.85,.2,.65,RED,T,.02))
    for xx in (-9.2,9.2):o.append(cyl('bin',xx,.5,2.6,.28,1,GREY,T,verts=10));o.append(cyl('bin lid',xx,1.03,2.6,.3,.08,RED,T,verts=10))
    return o

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    for ob in station():ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'shell | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Shell.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_Shell','origin':[33,0,103],'footprint':[25,25],'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('SHELL WEB EXPORT',json.dumps(report),flush=True)

def render():
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1600;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=30
    from mathutils import Vector
    for name,(eye,at) in {'front':((-18,7,-28),(0,3,0)),'pylon':((22,5,-22),(6,4,-4)),'shop':((6,4,-6),(0,3,6))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'shell.blend'))
