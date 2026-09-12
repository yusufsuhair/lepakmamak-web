"""Busking pitch for the PETRONAS forecourt frontage (and the Rembayung pitch, which
reuses the same set): plank stage riser with a lit front edge, two combo amps carrying PA
top boxes, a cajon, a tripod mic stand with a boom, cabling and a coiled lead, an open
guitar case with tips, timber posts flanking the game's own canvas sign, and seven
cross-legged spectators on tikar mats.

Static scenery only. The buskers, the fan holding a camera and the waving fans are
animated createPerson rigs that stay in the game, and the game keeps drawing its own
canvas sign between those posts, so no wording is baked in here. Footprints match
the colliders in src/busking.ts: amps at x=+/-2, deck top at y=0.08, mats at the seated
crowd positions, nothing south of the deck's z=-1.8 back edge.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_busking.py

Output: public/assets/models/environment/LM_ENV_Busking.glb, node 'busking' at the pitch origin.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,join,finish,rounded
from build_klcc import vloft

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/busking'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='busking'

# One material is one draw call after the export batches by material, so the palette stays
# tight: the deck frame tone doubles as the sign posts, the grille cloth doubles as cabling.
DECK=mat('Stage plank',(.57,.44,.31),.85);FRAME=mat('Stage frame',(.36,.27,.19),.8)
LED=mat('Stage LED',(1,.74,.38),.35,emit=2.2)
AMP=mat('Amp tolex',(.15,.22,.20),.7);GRILLE=mat('Amp grille',(.08,.11,.11),.75)
METAL=mat('Hardware steel',(.56,.59,.58),.4)
DRUM=mat('Cajon birch',(.84,.70,.47),.6);TAPA=mat('Cajon tapa',(.54,.38,.21),.55)
CASE=mat('Case shell',(.26,.22,.18),.65);LINING=mat('Case lining',(.84,.73,.44),.8)
MATA=mat('Tikar straw',(.83,.65,.36),.85);MATB=mat('Tikar green',(.33,.48,.43),.85)
SKIN=mat('Crowd skin',(.73,.51,.34),.6);TROUSERS=mat('Crowd trousers',(.55,.52,.41),.7)
HAIR=mat('Crowd hair',(.13,.17,.17),.45);TUDUNG=mat('Crowd tudung',(.30,.55,.50),.6)
SHIRTS=[mat('Crowd shirt coral',(.84,.43,.33),.7),mat('Crowd shirt slate',(.36,.53,.60),.7),mat('Crowd shirt ochre',(.84,.67,.32),.7)]

def lowsphere(name,x,y,z,r,m,sy=1,sz=1,seg=10,ring=6):
    """Cheap smooth-shaded ball; the crowd is repeated so the segment counts stay low."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=ring,radius=r,location=pt(x,y,z))
    o=bpy.context.object;o.scale=(1,sz,sy);finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=True
    return o

def seg(name,p0,p1,r,m,verts=6):
    """Cylinder between two game-space points: cables, tripod legs, boom arms."""
    from mathutils import Vector
    a=Vector(pt(*p0));b=Vector(pt(*p1));d=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o

def cable(name,points,r,m):
    return [seg(name,points[i],points[i+1],r,m) for i in range(len(points)-1)]

def part(name,ox,oz,yaw,lx,ly,lz,w,h,d,m,rx=0,ry=0):
    """Box placed in a figure-local frame (+z is the figure's facing) then yawed into place.
    Blender XYZ euler is Rz*Ry*Rx, so rx pitches in the figure's own frame."""
    c,s=math.cos(yaw),math.sin(yaw)
    bpy.ops.mesh.primitive_cube_add(size=1,location=pt(ox+lx*c+lz*s,ly,oz-lx*s+lz*c))
    o=bpy.context.object;o.scale=(w,d,h);o.rotation_euler=(rx,0,yaw+ry)
    return finish(o,name,m,T)

def lball(name,ox,oz,yaw,lx,ly,lz,r,m,sy=1,sz=1,seg_=10,ring=6):
    c,s=math.cos(yaw),math.sin(yaw)
    o=lowsphere(name,ox+lx*c+lz*s,ly,oz-lx*s+lz*c,r,m,sy,sz,seg_,ring)
    o.rotation_euler.z=yaw;return o

# ------------------------------------------------------------------ stage riser
def stage():
    o=[]
    # Nine planks along x with open joints showing the dark base below; deck top stays at
    # y=0.08. One tone for all of them: alternating tones read as a zebra from the crowd.
    for i in range(9):
        o.append(box('plank',0,.04,-1.61+i*.40,4.9,.08,.38,DECK,T,0))
    o.append(box('deck base',0,.015,0,4.94,.03,3.56,FRAME,T,0))
    for zz in (-1.775,1.775):o.append(box('deck lip',0,.05,zz,5,.10,.05,FRAME,T,.015))
    for xx in (-2.475,2.475):o.append(box('deck lip',xx,.05,0,.05,.10,3.6,FRAME,T,.015))
    # Strip light glued to the outside of the front lip: the scene only has two real lights.
    o.append(box('edge light',0,.055,1.806,4.6,.03,.012,LED,T,0))
    for xx in (-1.9,-.6,.6,1.9):o.append(box('edge light clip',xx,.055,1.8,.06,.05,.02,METAL,T,0))
    return o

# Everything on the riser is measured from the deck surface, not the ground: the first
# render had the tripod feet and the amp plinths buried inside the planks.
TOP=.08

# ------------------------------------------------------------------ amps and PA tops
def amp(x):
    z=.1;o=[]
    o.append(box('amp plinth',x,TOP+.05,z,.67,.10,.57,GRILLE,T,.01))
    o.append(box('amp cabinet',x,TOP+.49,z,.65,.78,.55,AMP,T,.025))
    o.append(box('amp top',x,TOP+.905,z,.67,.05,.57,AMP,T,.015))
    o.append(box('amp handle',x,TOP+.97,z,.24,.04,.09,METAL,T,.01))
    for s in (-1,1):o.append(box('amp handle mount',x+s*.11,TOP+.94,z,.03,.06,.07,METAL,T,0))
    # Grille cloth in front of a tolex surround, two cones with dust caps.
    o.append(box('amp grille',x,TOP+.46,z+.269,.55,.60,.02,GRILLE,T,0))
    for y in (TOP+.30,TOP+.62):
        o.append(cyl('amp cone',x,y,z+.281,.135,.015,GRILLE,T,axis='z',verts=12))
        o.append(cyl('amp dust cap',x,y,z+.29,.045,.015,AMP,T,axis='z',verts=10))
    o.append(box('amp panel',x,TOP+.82,z+.273,.58,.13,.03,METAL,T,0))
    for i in range(4):o.append(cyl('amp knob',x-.21+i*.14,TOP+.82,z+.30,.022,.035,GRILLE,T,axis='z',verts=8))
    o.append(box('amp pilot',x+.255,TOP+.82,z+.292,.03,.03,.015,LED,T,0))
    for s in (-1,1):
        for zz in (z-.25,z+.25):o.append(box('amp corner',x+s*.31,TOP+.88,zz,.05,.05,.05,METAL,T,0))
    # PA top box, tilted down so it throws at the seated crowd.
    o.append(box('pa box',x,TOP+1.14,z-.02,.50,.40,.34,AMP,T,.02,rx=.14))
    o.append(box('pa grille',x,TOP+1.14,z+.15,.42,.32,.02,GRILLE,T,0,rx=.14))
    o.append(cyl('pa cone',x,TOP+1.12,z+.163,.10,.015,GRILLE,T,axis='z',verts=10))
    o.append(box('pa handle',x-.26,TOP+1.14,z-.02,.03,.12,.16,METAL,T,0,rx=.14))
    return o

# ------------------------------------------------------------------ cajon
def cajon():
    x,z=1.05,-.05;o=[]
    o.append(box('cajon body',x,TOP+.385,z,.60,.67,.58,DRUM,T,.02))
    o.append(box('cajon tapa',x,TOP+.40,z+.295,.56,.60,.02,TAPA,T,0))
    for s in (-1,1):o.append(box('cajon tapa screw',x+s*.25,TOP+.69,z+.30,.03,.03,.012,METAL,T,0))
    o.append(box('cajon top',x,TOP+.74,z,.62,.04,.60,TAPA,T,.01))
    o.append(cyl('cajon port',x,TOP+.40,z-.291,.10,.02,GRILLE,T,axis='z',verts=12))
    for sx in (-1,1):
        for sz in (-1,1):o.append(cyl('cajon foot',x+sx*.24,TOP+.025,z+sz*.23,.04,.05,GRILLE,T,verts=8))
    return o

# ------------------------------------------------------------------ mic stand
def mic():
    x,z=-.7,1.0;o=[]
    o.append(cyl('mic hub',x,TOP+.10,z,.075,.12,METAL,T,verts=10))
    for a in (150,270,30):
        r=math.radians(a);tip=(x+.30*math.cos(r),TOP+.025,z+.30*math.sin(r))
        o.append(seg('mic leg',(x,TOP+.11,z),tip,.022,METAL))
        o.append(cyl('mic foot',tip[0],TOP+.02,tip[2],.035,.03,GRILLE,T,verts=8))
    o.append(cyl('mic pole',x,TOP+.55,z,.023,.86,METAL,T,verts=10))
    o.append(cyl('mic clutch',x,TOP+.99,z,.032,.09,GRILLE,T,verts=10))
    o.append(cyl('mic pole upper',x,TOP+1.16,z,.017,.34,METAL,T,verts=8))
    o.append(seg('mic boom',(x,TOP+1.31,z),(x,TOP+1.62,.46),.016,METAL))
    o.append(cyl('mic boom clutch',x,TOP+1.31,z-.02,.03,.07,GRILLE,T,axis='z',verts=8))
    o.append(seg('mic body',(x,TOP+1.62,.47),(x,TOP+1.63,.35),.028,GRILLE))
    o.append(lowsphere('mic grille',x,TOP+1.63,.33,.042,METAL))
    return o

# ------------------------------------------------------------------ open guitar case
CASE_X,CASE_Z,CASE_L,CASE_W=-.10,1.28,1.05,.44
def guitar_case():
    o=[];cx,cz=CASE_X,-CASE_Z;hl,hw=CASE_L/2,CASE_W/2
    shell=rounded([(cx-hl,cz-hw,.11),(cx+hl,cz-hw,.11),(cx+hl,cz+hw,.11),(cx-hl,cz+hw,.11)],4)
    inner=rounded([(cx-hl+.07,cz-hw+.07,.09),(cx+hl-.07,cz-hw+.07,.09),(cx+hl-.07,cz+hw-.07,.09),(cx-hl+.07,cz+hw-.07,.09)],4)
    o.append(vloft('case shell',[(.085,shell),(.20,shell)],[CASE],T))
    o.append(vloft('case lining',[(.205,inner),(.215,inner)],[LINING],T))
    # Lid swung up and back over the stage, away from the game's sign at z=1.65. Hinged at
    # (y=.19, z=CASE_Z-.22) and leaned 1.0 rad: steeper than that with a pale inner face
    # and the case read as an open laptop, so the lining here is felt rather than plush.
    o.append(box('case lid',CASE_X,.375,CASE_Z-.339,CASE_L,.03,CASE_W,CASE,T,.01,rx=1.0))
    o.append(box('case lid lining',CASE_X,.393,CASE_Z-.328,CASE_L-.10,.012,CASE_W-.09,TAPA,T,0,rx=1.0))
    for s in (-1,1):o.append(box('case latch',CASE_X+s*.34,.195,CASE_Z+.215,.09,.05,.03,METAL,T,0))
    o.append(box('case handle',CASE_X,.215,CASE_Z-.225,.22,.04,.05,METAL,T,.01))
    for dx,dz in ([(-.28,.02),(-.14,-.07),(.02,.05),(.16,-.04),(.30,.03),(.24,.08)]):
        o.append(cyl('tip coin',CASE_X+dx,.222,CASE_Z+dz,.036,.008,METAL,T,verts=8))
    o.append(box('tip note',CASE_X-.05,.221,CASE_Z+.12,.22,.004,.11,MATB,T,0))
    return o

# ------------------------------------------------------------------ banner frame
def banner():
    """Two timber posts BEHIND the game's canvas sign at (0,0.6,1.65), 2.0 x 0.5, just
    outside its width. No rails: any horizontal bar across the stage front read as a
    handrail in the previews, which is exactly the kind of thing a sign frame must not do."""
    o=[]
    for x in (-1.07,1.07):o.append(box('banner post',x,.51,1.70,.05,.86,.05,FRAME,T,.012))
    for x in (-1.07,1.07):o.append(box('banner foot',x,.105,1.70,.20,.05,.20,GRILLE,T,0))
    return o

# ------------------------------------------------------------------ cabling
def cables():
    o=[]
    o+=cable('mic lead',[(-2.05,.115,.36),(-1.72,.10,.60),(-1.35,.10,.80),(-1.02,.11,.93),(-.72,.14,.99)],.018,GRILLE)
    o+=cable('pa lead',[(-2.0,.135,-.19),(-1.6,.10,-.62),(-1.0,.10,-.95),(-.3,.10,-1.05)],.018,GRILLE)
    o+=cable('amp link',[(2.0,.135,-.19),(1.62,.10,-.66),(1.1,.10,-1.0),(.55,.10,-1.08)],.018,GRILLE)
    o+=cable('power lead',[(2.1,.11,.36),(2.32,.10,.9),(2.38,.10,1.45)],.018,GRILLE)
    bpy.ops.mesh.primitive_torus_add(location=pt(.05,.115,-1.28),major_radius=.21,minor_radius=.022,major_segments=12,minor_segments=4)
    coil=bpy.context.object;finish(coil,'cable coil',GRILLE,T)
    for f in coil.data.polygons:f.use_smooth=True
    o.append(coil)
    o.append(box('gaffer tape',-.3,.09,-1.05,.12,.02,.16,MATB,T,0))
    return o

# ------------------------------------------------------------------ seated crowd
SEATED=[(-4.6,2.8),(-3.2,3.9),(-1.6,4.5),(0,4.65),(1.7,4.45),(3.3,3.8),(4.7,2.7)]
def spectator(i,x,z):
    """Cross-legged on a tikar, facing the stage exactly as the rigs did. Plain boxes only:
    a beveled cube costs about eight times a plain one and this is the repeated prop."""
    yaw=math.atan2(-x,-z);shirt=SHIRTS[i%len(SHIRTS)];o=[]
    o.append(box('tikar',x,.025,z,1.15,.05,.82,MATA if i%2 else MATB,T,0))
    o.append(box('tikar border',x,.052,z,1.15,.006,.72,MATB if i%2 else MATA,T,0))
    # Hips carry the torso's own width so the stack reads as one body, and the folded legs
    # stay inside the mat instead of poking out as separate blocks.
    o.append(part('crowd hips',x,z,yaw,0,.19,-.02,.50,.20,.40,TROUSERS))
    for s in (-1,1):
        o.append(part('crowd shin',x,z,yaw,s*.09,.115,.21,.40,.13,.16,TROUSERS,ry=s*.55))
        o.append(part('crowd foot',x,z,yaw,-s*.13,.10,.13,.14,.10,.20,SKIN,ry=s*.55))
    o.append(part('crowd torso',x,z,yaw,0,.52,-.01,.46,.48,.29,shirt))
    o.append(part('crowd shoulders',x,z,yaw,0,.73,-.01,.50,.10,.29,shirt))
    o.append(part('crowd neck',x,z,yaw,0,.79,0,.12,.07,.12,SKIN))
    for s in (-1,1):
        o.append(part('crowd upper arm',x,z,yaw,s*.27,.58,.01,.12,.28,.15,shirt,rx=.16))
        o.append(part('crowd forearm',x,z,yaw,s*.26,.33,.15,.11,.26,.13,SKIN,rx=-.95))
    o.append(lball('crowd head',x,z,yaw,0,.95,.01,.185,SKIN,sy=1.06,sz=.94))
    if i in (1,4):
        o.append(lball('crowd tudung',x,z,yaw,0,.955,-.01,.205,TUDUNG,sy=1.06,sz=.98))
        o.append(part('crowd tudung drape',x,z,yaw,0,.80,-.12,.30,.30,.09,TUDUNG))
    elif i==6:
        o.append(part('crowd songkok',x,z,yaw,0,1.12,.01,.30,.13,.28,HAIR))
    else:
        # Hair is one squashed dome, like the game's own fallback head covering. A
        # separate nape box read as a hard slab stuck to the back of a round head.
        o.append(lball('crowd hair',x,z,yaw,0,.99,-.015,.196,HAIR,sy=.72))
    return o

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    o=stage()+cajon()+mic()+guitar_case()+banner()+cables()
    for x in (-2,2):o+=amp(x)
    for i,(x,z) in enumerate(SEATED):o+=spectator(i,x,z)
    for ob in o:ob.parent=e
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'busking | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Busking.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_Busking','origins':[[-31,0,86],[-116,0,119]],'footprint':[5,3.6],
            'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('BUSKING WEB EXPORT',json.dumps(report),flush=True)

def render():
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(en for en in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if en in engines)
    s.render.resolution_x=1600;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun);sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=120,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=35
    from mathutils import Vector
    for name,(eye,at) in {'front':((0,4.2,13),(0,.9,1.2)),'stage':((-3.4,1.9,4.6),(-.3,.8,.6)),
                          'amp':((2.9,1.3,2.5),(2,.7,.2)),'crowd':((-6.2,2.4,7.6),(-1,.6,3.6)),
                          'seat':((-.9,1.35,6.6),(0,.6,4.65))}.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    e=build();export(e)
    if '--no-render' not in ARGS:render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'busking.blend'))
