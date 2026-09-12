"""Watsons health-and-beauty shoplot at (-56,-40): the real Malaysian look - Watsons teal
fascia with the white wordmark and pharmacy cross, a full-height glass frontage, a bright
white interior with wall bays, gondola aisles, cosmetics island and a pharmacy counter.
Same 19 x 11 x 12 body, ground origin and +z street face as the generic shop it replaces.
The shop loader hides the whole procedural fallback, so all lettering is geometry here.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_watsons.py -- --no-render

Output: public/assets/models/shops/LM_SHOP_Watsons.glb (root node LM_SHOP_Watsons).
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/watsons'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/shops'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='watsons';W,D,H=19,12,11
F=D/2  # street face z

TEAL=mat('Watsons teal',(.00,.56,.50),.42);DEEP=mat('Watsons deep teal',(.02,.36,.33),.5)
WHITE=mat('Watsons white',(.97,.98,.96),.45);RENDER=mat('Upper render',(.90,.89,.84),.85)
GLASS=mat('Shopfront glass',(.72,.82,.86),.08,alpha=.22,two_sided=True);BLACK=mat('Frame black',(.09,.09,.10),.5)
FLOOR=mat('Store floor',(.88,.88,.86),.55);SHELF=mat('Shelf white',(.94,.94,.92),.6)
STRIP=mat('Ceiling strip',(1,.98,.92),.4,emit=2.6);CROSSLIT=mat('Pharmacy cross',(.96,1,.98),.4,emit=1.6)
PINK=mat('Product pink',(.94,.66,.70),.5);MINT=mat('Product mint',(.52,.80,.74),.5)
LEMON=mat('Product lemon',(.95,.84,.45),.5);CORAL=mat('Product coral',(.93,.52,.42),.5)
LILAC=mat('Product lilac',(.72,.66,.87),.5);CREAM=mat('Product cream',(.96,.94,.86),.5)
STEEL=mat('Counter steel',(.70,.71,.73),.35);TIMBER=mat('Counter timber',(.76,.61,.42),.6)
POSTER=mat('Promo poster',(.98,.42,.52),.45);POSTER2=mat('Promo poster teal',(.10,.62,.60),.45)
PALETTE=[MINT,PINK,LEMON,CREAM,CORAL,LILAC]

def text(body,x,y,z,size,m,depth=.04,align='CENTER',font=None,spacing=1.0,res=3):
    bpy.ops.object.text_add(location=pt(x,y,z));o=bpy.context.object;o.data.body=body;o.data.size=size;o.data.extrude=depth/2
    o.data.align_x=align;o.data.align_y='CENTER';o.data.resolution_u=res;o.data.space_character=spacing
    o.rotation_euler=(math.pi/2,0,0)
    if font:o.data.font=font
    bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.name='text '+body;o.data.materials.append(m);o['asset']=T;return o

def cross(name,x,y,z,size,thick,m,depth=.06):
    """Pharmacy cross as one plate: arm width = size/3."""
    a=size/2;b=size/6
    prof=[(x-b,y-a),(x+b,y-a),(x+b,y-b),(x+a,y-b),(x+a,y+b),(x+b,y+b),
          (x+b,y+a),(x-b,y+a),(x-b,y+b),(x-a,y+b),(x-a,y-b),(x-b,y-b)]
    return loft(name,[(z,prof),(z+depth,prof)],m,T,closed=True)

def bay(o,x,z,w,facing,tiers=4,y0=.55,step=.9):
    """Wall shelving bay: back panel plus shelves of boxed product. facing = +1 faces +z."""
    o.append(box('bay back',x,y0+tiers*step/2-.2,z,w,tiers*step+.5,.1,SHELF,T,0))
    for t in range(tiers):
        y=y0+t*step
        o.append(box('shelf',x,y,z+facing*.28,w,.07,.56,SHELF,T,0))
        n=max(2,int(w/.62))
        for i in range(n):
            px=x-w/2+.31+(w-.62)*i/max(1,n-1)
            o.append(box('product',px,y+.28,z+facing*.3,.42,.5,.34,PALETTE[(i+t)%len(PALETTE)],T,0))

def gondola(o,z,y0=.35,tiers=3,step=.82):
    """Double sided island aisle running across the shop."""
    o.append(box('gondola base',0,.22,z,13.6,.44,1.15,SHELF,T,.03))
    o.append(box('gondola spine',0,y0+tiers*step/2,z,13.6,tiers*step+.3,.14,SHELF,T,0))
    for side in (-1,1):
        for t in range(tiers):
            y=y0+.25+t*step
            o.append(box('shelf',0,y,z+side*.34,13.6,.06,.52,SHELF,T,0))
            for i in range(11):
                px=-6.6+i*13.2/10
                o.append(box('product',px,y+.26,z+side*.36,.66,.46,.3,PALETTE[(i+t+(0 if side<0 else 3))%len(PALETTE)],T,0))

def shop():
    o=[];font=None
    for candidate in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf','/System/Library/Fonts/Helvetica.ttc']:
        try:font=bpy.data.fonts.load(candidate);break
        except Exception:pass
    # ---- upper floors: render wall with two window bands and a teal string course
    o.append(box('upper floor',0,8.3,0,W,5.4,D,RENDER,T,.04))
    o.append(box('string course',0,5.72,0,W+.3,.28,D+.3,TEAL,T,.02))
    o.append(box('parapet',0,11.1,0,W+.45,.4,D+.45,RENDER,T,.03))
    o.append(box('parapet cap',0,11.34,0,W+.55,.14,D+.55,TEAL,T,.02))
    for y in (6.9,9.2):
        for i in range(5):
            x=-7.2+i*3.6
            o.append(box('window surround',x,y,F+.02,2.92,1.92,.12,WHITE,T,.02))
            o.append(box('upper window',x,y,F+.08,2.5,1.5,.08,GLASS,T,0))
            o.append(box('window mullion',x,y,F+.09,.09,1.5,.09,WHITE,T,0))
            o.append(box('window sill',x,y-1.04,F+.1,3.12,.16,.34,WHITE,T,.02))
    for s in (-1,1):
        o.append(box('pilaster',s*(W/2-.35),8.3,F-.2,.7,5.4,.5,RENDER,T,.03))
    # ---- ground floor as an open-front room, so the interior reads through the glass
    o.append(box('store floor',0,.07,-.2,W-.5,.14,D-.5,FLOOR,T,0))
    o.append(box('store ceiling',0,4.34,-.2,W-.5,.22,D-.5,WHITE,T,0))
    for s in (-1,1):o.append(box('store wall',s*(W/2-.18),2.2,-.2,.36,4.4,D-.5,WHITE,T,0))
    o.append(box('store back wall',0,2.2,-(F-.18),W-.5,4.4,.36,WHITE,T,0))
    for z in (-4.4,-1.8,.8,3.4):
        o.append(box('ceiling strip',0,4.18,z,15.5,.09,.34,STRIP,T,0))
    # ---- fascia: teal band, deep base line, wordmark, pharmacy cross
    o.append(box('fascia',0,5.0,F+.12,W,1.3,.36,TEAL,T,.03))
    o.append(box('fascia base',0,4.36,F+.14,W,.16,.4,DEEP,T,0))
    o.append(text('Watsons',-1.1,5.02,F+.31,1.02,WHITE,.09,font=font))
    o.append(cross('fascia cross',7.5,5.0,F+.31,.92,.3,WHITE))
    o.append(box('plinth band',0,.42,F+.02,W-.6,.5,.12,DEEP,T,0))
    o.append(text('HEALTH  ·  BEAUTY  ·  PHARMACY',0,.42,F+.1,.29,WHITE,.03,font=font,spacing=1.25,res=2))
    # ---- glazed frontage with a central sliding entrance
    for x0,x1 in ((-8.55,-1.85),(1.85,8.55)):
        o.append(box('shop glass',(x0+x1)/2,2.3,F-.02,x1-x0,4.0,.07,GLASS,T,0))
        o.append(box('glass head',(x0+x1)/2,4.25,F-.02,x1-x0,.2,.16,WHITE,T,0))
        for k in range(3):
            o.append(box('mullion',x0+(x1-x0)*k/2,2.3,F,.1,4.0,.13,WHITE,T,0))
        o.append(box('mullion',x1,2.3,F,.1,4.0,.13,WHITE,T,0))
    o.append(box('window poster',-5.2,1.5,F-.1,3.0,1.9,.06,POSTER,T,0))
    o.append(box('window poster',5.2,1.5,F-.1,3.0,1.9,.06,POSTER2,T,0))
    for s in (-1,1):o.append(box('entrance jamb',s*1.9,2.15,F-.02,.34,4.3,.24,WHITE,T,.02))
    o.append(box('entrance head',0,4.2,F-.02,4.14,.42,.24,WHITE,T,.02))
    for s in (-1,1):
        o.append(box('sliding door',s*.92,1.95,F-.04,1.72,3.6,.07,GLASS,T,0))
        o.append(box('door stile',s*1.76,1.95,F-.02,.14,3.6,.12,BLACK,T,0))
    o.append(box('door header',0,3.9,F-.04,3.6,.3,.14,TEAL,T,0))
    o.append(box('threshold',0,.09,F-.3,3.9,.18,1.0,STEEL,T,.02))
    # ---- canopy over the pavement, teal soffit
    o.append(box('canopy',0,4.3,F+1.2,W+.2,.16,2.4,WHITE,T,.02))
    o.append(box('canopy soffit',0,4.2,F+1.2,W-.2,.06,2.2,TEAL,T,0))
    for s in (-1,1):o.append(cyl('canopy tie',s*7.6,4.72,F+.55,.05,1.2,STEEL,T,axis='z',verts=6))
    # ---- interior fit-out
    for z in (-4.6,-2.3,0):gondola(o,z)
    for s in (-1,1):
        for z in (-4.6,-2.6,-.6,1.4):
            b=box('bay back',s*8.35,2.0,z,.1,4.0,1.9,SHELF,T,0);o.append(b)
            for t in range(4):
                y=.62+t*.9
                o.append(box('shelf',s*8.05,y,z,.56,.07,1.9,SHELF,T,0))
                for i in range(3):
                    o.append(box('product',s*8.03,y+.28,z-.62+i*.62,.34,.5,.42,PALETTE[(i+t+(0 if s<0 else 2))%len(PALETTE)],T,0))
    # cosmetics island near the entrance
    o.append(cyl('island base',0,.4,3.9,1.5,.8,TIMBER,T,verts=16))
    o.append(cyl('island top',0,.85,3.9,1.6,.12,WHITE,T,verts=16))
    for i in range(8):
        a=2*math.pi*i/8
        o.append(box('tester',1.05*math.cos(a),1.06,3.9+1.05*math.sin(a),.2,.3,.2,PALETTE[i%len(PALETTE)],T,0))
    # pharmacy counter at the back, with a lit cross above it
    o.append(box('pharmacy counter',-4.6,.6,-4.9,6.4,1.2,.9,TIMBER,T,.03))
    o.append(box('counter top',-4.6,1.24,-4.9,6.6,.1,1.0,WHITE,T,.02))
    o.append(box('dispensary',-4.6,2.6,-5.55,6.4,2.6,.5,SHELF,T,.02))
    for t in range(3):
        for i in range(6):o.append(box('medicine',-7.2+i*1.05,1.7+t*.72,-5.35,.85,.5,.34,PALETTE[(i+t)%len(PALETTE)],T,0))
    o.append(cross('pharmacy cross',-4.6,3.75,-5.2,1.15,.34,CROSSLIT))
    # checkout counter by the door
    o.append(box('checkout',5.4,.55,-1.0,4.4,1.1,1.1,WHITE,T,.03))
    o.append(box('checkout top',5.4,1.16,-1.0,4.6,.1,1.2,TIMBER,T,.02))
    o.append(box('register',6.6,1.45,-1.0,.7,.5,.5,BLACK,T,.03))
    o.append(box('basket stack',3.0,.75,1.6,.7,1.5,.9,MINT,T,.04))
    # pavement: promo A-board and two bollards
    for s,m in ((-1,POSTER),(1,POSTER2)):
        for side in (-1,1):
            p=box('a-board',s*6.2+side*.14,.62,F+1.9,1.15,1.25,.07,m,T,0);p.rotation_euler.x=side*.16;o.append(p)
    for x in (-8.2,8.2):o.append(cyl('bollard',x,.45,F+2.2,.12,.9,STEEL,T,verts=10))
    return o

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new('LM_SHOP_Watsons',None);s.collection.objects.link(e)
    for ob in shop():
        if ob is not None:ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'watsons | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_SHOP_Watsons.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_SHOP_Watsons','origin':[-56,0,-40],'body':[W,H,D],'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('WATSONS WEB EXPORT',json.dumps(report),flush=True)

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
    for name,(eye,at) in {'street':((13,4.5,20),(-1,4,6)),'front':((0,4.2,19),(0,4.2,4)),'inside':((4.6,2.5,4.6),(-4.6,1.8,-4.8))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'watsons.blend'))
