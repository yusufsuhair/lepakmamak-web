"""The KL skyline pack: Exchange 106 at TRX, Merdeka 118 with its diamond facet cladding,
Menara KL with the Sri Angkasa tuber head, and the four named city towers (UOB, HSBC, the
Pusat Komuniti and Hotel Mahkota). These are read as silhouettes from across the map, so
the work goes into taper, crown and spire plus banding that survives distance, not interiors.

Every footprint, height and origin matches the boxes in world.ts, so collision, the map
footprints and the game's own canvas name signs are untouched.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_skyline.py -- --no-render

Output: public/assets/models/environment/LM_ENV_{TRX,Merdeka118,KLTower,Tower*}.glb
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import vloft,sphere

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/skyline'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []

PODIUM=mat('Podium stone',(.84,.82,.74),.85);LOBBY=mat('Lobby glass',(.45,.62,.72),.12,alpha=.42,two_sided=True)
CANOPY=mat('Entrance canopy',(.86,.87,.83),.5);DARKTRIM=mat('Dark trim',(.16,.25,.24),.6)
TRX_GLASS=mat('TRX glass',(.38,.55,.55),.18);TRX_FIN=mat('TRX fin',(.72,.83,.80),.35)
TRX_CROWN=mat('TRX crown glass',(.62,.78,.74),.15,emit=.35)
M118_GLASS=mat('118 glass',(.47,.60,.60),.18);M118_FACET=mat('118 facet',(.79,.86,.82),.3)
M118_SPIRE=mat('118 spire',(.85,.85,.79),.35)
KLT_SHAFT=mat('KL Tower concrete',(.80,.79,.70),.8);KLT_POD=mat('KL Tower pod',(.72,.73,.63),.7)
KLT_GLASS=mat('KL Tower glass',(.36,.52,.50),.15);KLT_MUQ=mat('KL Tower muqarnas',(.40,.53,.48),.4)
KLT_MAST=mat('KL Tower mast',(.84,.83,.72),.4)
OFFICE=mat('Office wall',(.78,.81,.79),.8);HOTEL=mat('Hotel wall',(.89,.85,.74),.8)
SPANDREL=mat('Spandrel band',(.60,.66,.64),.6);HOTEL_BAND=mat('Hotel band',(.72,.65,.52),.6)
CURTAIN=mat('Curtain glass',(.42,.56,.58),.16);HOTEL_GLASS=mat('Hotel glass',(.55,.58,.52),.2)
PLANT=mat('Roof plant',(.66,.67,.63),.9);FLAG=mat('Flagpole',(.86,.85,.78),.4)
RED=mat('Civic red',(.84,.24,.26),.5);GOLD=mat('Hotel gold',(.73,.58,.32),.35)

def prism(name,sections,m,tag,cap=True):
    return vloft(name,sections,[m]*(len(sections)-1),tag,cap)

def poly(r,n,rot=0.0):
    return [(r*math.cos(rot+2*math.pi*i/n),r*math.sin(rot+2*math.pi*i/n)) for i in range(n)]

def chamfer(a,c):
    """Chamfered square half-width a, corner cut c, counter-clockwise."""
    return [(a-c,-a),(a,-a+c),(a,a-c),(a-c,a),(-a+c,a),(-a,a-c),(-a,-a+c),(-a+c,-a)]

def ring(name,y,h,prof_fn,m,tag,out=.12):
    """A proud spandrel band: the profile pushed out slightly, between y and y+h."""
    return prism(name,[(y,prof_fn(out)),(y+h,prof_fn(out))],m,tag,cap=False)

def strut(name,p0,p1,w,m,tag):
    a=Vector(pt(*p0));b=Vector(pt(*p1));d=b-a;L=d.length
    if L<1e-5:return None
    bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2)
    o=bpy.context.object;o.scale=(w,w,L)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(o,name,m,tag)

# ------------------------------------------------------------------ Exchange 106 at TRX
def trx(T):
    o=[];TOP=67.0
    o.append(box('podium',0,3,0,18,6,18,PODIUM,T,.05))
    o.append(box('podium cornice',0,6.15,0,18.4,.3,18.4,CANOPY,T,.03))
    o.append(box('lobby glass',0,3.4,9.02,15,4.6,.08,LOBBY,T,0))
    o.append(box('entrance canopy',0,5.4,10.2,9,.25,2.6,CANOPY,T,.03))
    # tapering chamfered shaft: four bands, the plan shrinking with height
    bands=[(6.0,7.5,1.5),(22.0,7.1,1.45),(40.0,6.5,1.35),(56.0,5.6,1.2),(TOP,4.7,1.0)]
    o.append(prism('tower',[(y,chamfer(a,c)) for y,a,c in bands],TRX_GLASS,T))
    def prof_at(y):
        for i in range(len(bands)-1):
            y0,a0,c0=bands[i];y1,a1,c1=bands[i+1]
            if y0<=y<=y1:
                t=(y-y0)/(y1-y0)
                return a0+(a1-a0)*t,c0+(c1-c0)*t
        return bands[-1][1],bands[-1][2]
    # floor banding, the detail that still reads from across the map
    for k in range(16):
        y=7.0+k*3.8;a,c=prof_at(y)
        o.append(ring('floor band',y,.34,lambda out,a=a,c=c:chamfer(a+out,c),TRX_FIN,T))
    # corner fins follow the taper on all four chamfers
    for i in range(4):
        ang=math.pi/4+i*math.pi/2
        for y0,y1 in ((6.0,22.0),(22.0,40.0),(40.0,56.0),(56.0,TOP)):
            a0,_=prof_at(y0);a1,_=prof_at(y1);r0=a0*1.30;r1=a1*1.30
            o.append(strut('corner fin',(r0*math.cos(ang),y0,-r0*math.sin(ang)),
                                        (r1*math.cos(ang),y1,-r1*math.sin(ang)),.26,TRX_FIN,T))
    # crystalline crown: eight glass planes leaning in to a lantern, then the mast
    a,_=prof_at(TOP)
    o.append(prism('crown',[(TOP,poly(a*1.30,8,math.pi/8)),(TOP+7.0,poly(a*.78,8,math.pi/8)),
                            (TOP+11.5,poly(a*.30,8,math.pi/8))],TRX_CROWN,T))
    for i in range(8):
        ang=math.pi/8+i*math.pi/4
        o.append(strut('crown rib',(a*1.30*math.cos(ang),TOP,-a*1.30*math.sin(ang)),
                                   (a*.30*math.cos(ang),TOP+11.5,-a*.30*math.sin(ang)),.19,TRX_FIN,T))
    o.append(cyl('mast',0,TOP+13.5,0,.22,4.5,TRX_FIN,T,verts=8))
    o.append(cyl('mast upper',0,TOP+18.5,0,.11,6.0,TRX_FIN,T,verts=6))
    return [p for p in o if p]

# ------------------------------------------------------------------ Merdeka 118
def merdeka(T):
    o=[];TOP=78.0;N=12
    o.append(box('podium',0,3,0,17,6,17,PODIUM,T,.05))
    o.append(box('podium cornice',0,6.15,0,17.4,.3,17.4,CANOPY,T,.03))
    o.append(box('lobby glass',0,3.4,8.52,14,4.6,.08,LOBBY,T,0))
    o.append(box('entrance canopy',0,5.4,9.7,8.5,.25,2.4,CANOPY,T,.03))
    # the tower tapers the whole way up; radius drives both shell and facets
    def r_at(y):
        t=(y-6.0)/(TOP-6.0)
        return 8.1*(1-.72*t**1.08)
    levels=[6.0+i*(TOP-6.0)/9 for i in range(10)]
    o.append(prism('tower',[(y,poly(r_at(y),N)) for y in levels],M118_GLASS,T))
    # the signature: a diamond facet grid over the whole shell
    def node(i,k):
        y=levels[i];r=r_at(y)*1.035;a=2*math.pi*k/N
        return (r*math.cos(a),y,-r*math.sin(a))
    for i in range(len(levels)-1):
        for k in range(N):
            o.append(strut('facet',node(i,k),node(i+1,(k+1)%N),.15,M118_FACET,T))
            o.append(strut('facet',node(i,(k+1)%N),node(i+1,k),.15,M118_FACET,T))
    for i in range(len(levels)):
        for k in range(N):o.append(strut('facet ring',node(i,k),node(i,(k+1)%N),.13,M118_FACET,T))
    # tapering crown and the vertical spire (the real one does not lean)
    o.append(prism('crown',[(TOP,poly(r_at(TOP),N)),(TOP+6.0,poly(r_at(TOP)*.52,N))],M118_FACET,T))
    o.append(prism('spire base',[(TOP+6.0,poly(r_at(TOP)*.52,8)),(TOP+13.0,poly(.55,8))],M118_SPIRE,T))
    o.append(cyl('spire',0,TOP+20.0,0,.30,14.0,M118_SPIRE,T,verts=8))
    o.append(cyl('spire upper',0,TOP+31.0,0,.13,8.0,M118_SPIRE,T,verts=6))
    o.append(sphere('spire tip',0,TOP+35.4,0,.26,M118_SPIRE,T))
    return [p for p in o if p]

# ------------------------------------------------------------------ Menara KL
def kltower(T):
    o=[];HEAD=68.0
    o.append(cyl('base building',0,2.2,0,5.4,4.4,PODIUM,T,verts=14))
    o.append(cyl('base cornice',0,4.5,0,5.7,.3,CANOPY,T,verts=14))
    # tapering concrete shaft with shallow flutes
    o.append(prism('shaft',[(4.0,poly(2.30,16)),(24.0,poly(1.85,16)),(46.0,poly(1.52,16)),(HEAD,poly(1.30,16))],KLT_SHAFT,T))
    for i in range(8):
        ang=2*math.pi*i/8
        o.append(strut('flute',(2.32*math.cos(ang),4.0,-2.32*math.sin(ang)),
                               (1.32*math.cos(ang),HEAD,-1.32*math.sin(ang)),.14,KLT_POD,T))
    # Sri Angkasa head: flared underside, glazed observation drum, upper deck
    o.append(prism('head underside',[(HEAD-1.0,poly(1.45,20)),(HEAD+2.2,poly(4.6,20)),(HEAD+3.4,poly(6.2,20))],KLT_POD,T))
    o.append(prism('observation glass',[(HEAD+3.4,poly(6.2,20)),(HEAD+6.0,poly(6.2,20))],KLT_GLASS,T,cap=False))
    for i in range(20):
        ang=2*math.pi*i/20
        o.append(strut('head mullion',(6.25*math.cos(ang),HEAD+3.4,-6.25*math.sin(ang)),
                                      (6.25*math.cos(ang),HEAD+6.0,-6.25*math.sin(ang)),.12,KLT_POD,T))
    o.append(prism('head balcony',[(HEAD+6.0,poly(6.5,20)),(HEAD+6.5,poly(6.5,20)),(HEAD+6.9,poly(4.9,20))],KLT_POD,T))
    # the muqarnas collar: a ring of pointed arch facets, the head's real signature
    for i in range(20):
        ang=2*math.pi*i/20;nx,nz=math.cos(ang),math.sin(ang)
        o.append(strut('muqarnas',(4.9*nx,HEAD+6.9,-4.9*nz),(3.5*nx,HEAD+9.4,-3.5*nz),.30,KLT_MUQ,T))
    o.append(prism('upper deck',[(HEAD+9.4,poly(3.6,20)),(HEAD+11.2,poly(3.0,20)),(HEAD+12.2,poly(2.1,20))],KLT_POD,T))
    # antenna
    o.append(cyl('mast',0,HEAD+16.0,0,.42,8.0,KLT_MAST,T,verts=10))
    o.append(cyl('mast mid',0,HEAD+23.0,0,.24,7.0,KLT_MAST,T,verts=8))
    o.append(cyl('mast upper',0,HEAD+30.0,0,.11,8.0,KLT_MAST,T,verts=6))
    return [p for p in o if p]

# ------------------------------------------------------------------ the four named towers
def city_tower(T,w,d,height,kind,accent_rgb):
    """Curtain-walled block: glazed lobby, banded floors, accent parapet, roof plant."""
    o=[];hotel=kind=='hotel'
    wall=HOTEL if hotel else OFFICE;band=HOTEL_BAND if hotel else SPANDREL;glazing=HOTEL_GLASS if hotel else CURTAIN
    ACCENT=mat(f'Accent {kind} {accent_rgb}',accent_rgb,.5)
    o.append(box('core',0,height/2,0,w-1.2,height,d-1.2,wall,T,.05))
    # ground floor: darker plinth and a glazed lobby on the street face
    o.append(box('plinth',0,1.7,0,w,3.4,d,DARKTRIM,T,.04))
    o.append(box('lobby glass',0,1.8,d/2+.03,w-2.4,3.0,.08,LOBBY,T,0))
    o.append(box('entrance canopy',0,3.5,d/2+1.3,w*.55,.22,2.6,CANOPY,T,.03))
    o.append(box('plinth cap',0,3.55,0,w+.3,.3,d+.3,CANOPY,T,.02))
    # curtain wall: a spandrel band per floor with recessed glazing between
    y=3.9
    while y+2.6<height-1.2:
        o.append(box('spandrel',0,y,0,w,.55,d,band,T,.03))
        for s in (-1,1):
            o.append(box('glazing',0,y+1.5,s*(d/2-.06),w-1.0,1.9,.1,glazing,T,0))
            o.append(box('glazing',s*(w/2-.06),y+1.5,0,.1,1.9,d-1.0,glazing,T,0))
        y+=3.2
    o.append(box('top spandrel',0,y,0,w,.55,d,band,T,.03))
    # corner pilasters tie the bands together
    for sx in (-1,1):
        for sz in (-1,1):o.append(box('pilaster',sx*(w/2-.18),height/2+1.7,sz*(d/2-.18),.5,height-3.4,.5,wall,T,.03))
    # roof deck first, then everything stands on it: a gap here leaves the crown floating
    o.append(box('roof deck',0,height+.1,0,w-.8,.2,d-.8,PLANT,T,.02))
    # accent parapet, matching the colour the map legend uses for this block
    o.append(box('parapet',0,height+.45,0,w+.5,.9,d+.5,ACCENT,T,.03))
    o.append(box('roof plant',-w*.2,height+1.0,d*.15,w*.34,1.6,d*.3,PLANT,T,.04))
    o.append(box('lift overrun',w*.22,height+1.5,-d*.12,w*.26,2.6,d*.26,PLANT,T,.04))
    for i in range(3):o.append(cyl('roof duct',-w*.2+i*1.1,height+2.25,d*.15,.26,.9,PLANT,T,verts=8))
    if kind=='bank':
        for s in (-1,1):o.append(cyl('flagpole',w/2+1.1,4.5,s*3.2,.09,8.8,FLAG,T,verts=8))
    if kind=='civic':
        o.append(cyl('flagpole',w/2+1.1,6.0,-4.7,.08,11.8,FLAG,T,verts=8))
        o.append(box('flag',w/2+1.85,10.8,-4.7,1.5,.95,.06,RED,T,0))
        o.append(box('civic awning',0,4.1,d/2+1.9,w*.8,.2,1.7,RED,T,.02))
    if kind=='hotel':
        o.append(box('crown',0,height+1.2,0,7,2.0,7,GOLD,T,.05))
        o.append(box('crown cap',0,height+2.55,0,4.4,.7,4.4,GOLD,T,.04))
        for s in (-1,1):o.append(cyl('hotel pole',w/2+1.2,3.6,s*4.6,.08,7.2,GOLD,T,verts=8))
        o.append(box('porte cochere',0,3.8,d/2+2.6,w*.7,.3,3.2,GOLD,T,.03))
    return o

SITES={
 'TRX':          (trx,          [105,0,-95]),
 'Merdeka118':   (merdeka,      [129,0,-95]),
 'KLTower':      (kltower,      [-104,0,-145]),
 'TowerUOB':     (lambda T:city_tower(T,16,17,30,'bank',(.71,.18,.21)),  [-127,0,-37]),
 'TowerHSBC':    (lambda T:city_tower(T,16,17,27,'bank',(.83,.23,.24)),  [-106,0,-37]),
 'TowerDAP':     (lambda T:city_tower(T,16,17,22,'civic',(.78,.18,.20)), [-127,0,37]),
 'TowerMahkota': (lambda T:city_tower(T,17,17,38,'hotel',(.65,.51,.24)), [-106,0,37]),
}

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    roots={}
    for name,(fn,_) in SITES.items():
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
        report[name]={'asset':f'LM_ENV_{name}','origin':SITES[name][1],'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    total={'triangles':sum(r['triangles'] for r in report.values()),'bytes':sum(r['bytes'] for r in report.values())}
    (OUT/'manifest.json').write_text(json.dumps({'towers':report,'total':total},indent=2)+'\n')
    print('SKYLINE WEB EXPORT',json.dumps({'total':total,'towers':{k:(v['triangles'],v['bytes'],v['draws']) for k,v in report.items()}}),flush=True)

def render(roots):
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1100;s.render.resolution_y=1400;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=600,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=34
    from mathutils import Vector as V
    shots={'TRX':((-52,52,62),(0,46,0)),'Merdeka118':((-58,66,74),(0,62,0)),'KLTower':((-46,58,56),(0,56,0)),
           'TowerUOB':((-34,9,50),(0,24,0)),'TowerDAP':((-30,8,44),(0,18,0)),'TowerMahkota':((-38,10,56),(0,30,0))}
    for name,e in roots.items():
        if name not in shots:continue
        for other in roots.values():
            for c in other.children:c.hide_render=other is not e
        eye,at=shots[name]
        cam.location=pt(*eye);d=V(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name.lower()}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    roots=build();export(roots)
    if '--no-render' not in ARGS:render(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'skyline.blend'))
