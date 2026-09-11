"""Detailed PETRONAS forecourt. Game coordinates in metres, Blender Z up.

Blender -b --factory-startup --python scripts/blender/build_petronas.py -- --no-render
Blender -b assets/petronas/petronas.blend --python scripts/blender/build_petronas.py -- --render-only
"""
import bpy, math, json, random, sys
from pathlib import Path
from mathutils import Vector, Matrix, noise

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/petronas'; OUT.mkdir(parents=True,exist_ok=True)
for directory in ['renders','textures']: (OUT/directory).mkdir(exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
RNG=random.Random(310112)
def pt(x,y,z): return (x,-z,y)
def mat(name,color,rough=.45,metal=0,emit=0,alpha=1):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,alpha);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal;p.inputs['Alpha'].default_value=alpha
    if emit:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
    if alpha<1:m.surface_render_method='DITHERED';m.use_transparency_overlap=False
    return m

def textured_concrete():
    m=mat('PBR | jointed pale forecourt concrete',(.46,.47,.45),.86)
    size=512;pixels=[];rough=[]
    for yy in range(size):
        for xx in range(size):
            u,v=xx/size,yy/size
            n=noise.multi_fractal(Vector((u*34,v*34,3)),1,2,3)
            fine=RNG.random();value=.53+(n-.5)*.045+(fine-.5)*.055
            if fine>.985:value-=.1
            pixels.extend((value*1.03,value*1.025,value,1))
            r=.77+fine*.15;rough.extend((r,r,r,1))
    nt=m.node_tree;p=nt.nodes.get('Principled BSDF')
    for name,data,socket in [('Concrete_BaseColor',pixels,'Base Color'),('Concrete_Roughness',rough,'Roughness')]:
        im=bpy.data.images.new(name,width=size,height=size)
        if socket=='Roughness':im.colorspace_settings.name='Non-Color'
        im.pixels.foreach_set(data);im.update()
        im.filepath_raw=str(OUT/'textures'/f'{name}.png');im.file_format='PNG';im.save();im.pack()
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im;nt.links.new(tex.outputs['Color'],p.inputs[socket])
    return m

def uv_world(ob,scale=3):
    mesh=ob.data;mesh.update();uv=mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        axes=sorted(range(3),key=lambda a:abs(face.normal[a]))[:2]
        for li in face.loop_indices:
            c=ob.matrix_world@mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv=(c[axes[0]]/scale,c[axes[1]]/scale)

def finish(ob,name,material,bevel=0):
    ob.name=name;ob.data.materials.append(material)
    bpy.context.view_layer.objects.active=ob
    if bevel:
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        mod=ob.modifiers.new('Manufactured edge radii','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    ob['asset']='PETRONAS';return ob

def box(name,x,y,z,w,h,d,m,bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pt(x,y,z));o=bpy.context.object;o.scale=(w,d,h)
    finish(o,name,m,min(bevel,w*.2,h*.2,d*.2));uv_world(o);return o

def cylinder(name,x,y,z,r,h,m,vertices=20,axis=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=pt(x,y,z));o=bpy.context.object
    if axis=='front':o.rotation_euler.x=math.pi/2
    finish(o,name,m)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o

def line(name,points,r,m):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;c.resolution_u=10
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):p.co=pt(*co);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.context.scene.collection.objects.link(o);c.materials.append(m);o['asset']='PETRONAS';return o

def label(name,body,x,y,z,width,height,m,back=False):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.align_x='CENTER';c.align_y='CENTER';c.size=1;c.extrude=.004;c.bevel_depth=.001;c.resolution_u=3
    o=bpy.data.objects.new(name,c);bpy.context.scene.collection.objects.link(o);o.location=pt(x,y,z)
    o.rotation_euler=(math.pi/2,0,0 if back else math.pi)
    c.materials.append(m);bpy.context.view_layer.update()
    bounds=o.bound_box;s=min(width/max(max(v[0] for v in bounds)-min(v[0] for v in bounds),.001),height/max(max(v[1] for v in bounds)-min(v[1] for v in bounds),.001))
    o.scale=(s,s,s);o['asset']='PETRONAS';return o

def image_sign(name,x,y,z,w,h,material):
    verts=[pt(x+w/2,y-h/2,z),pt(x-w/2,y-h/2,z),pt(x-w/2,y+h/2,z),pt(x+w/2,y+h/2,z)]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[(0,1,2,3)]);me.materials.append(material)
    uv=me.uv_layers.new(name='UVMap')
    for li,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[li].uv=co
    o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);o['asset']='PETRONAS';return o

def area(name,x,y,z,power,size,color,target=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.location=pt(x,y,z)
    o.rotation_euler=(Vector(pt(*(target or (x,0,z))))-o.location).to_track_quat('-Z','Y').to_euler();return o

def build():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    s=bpy.context.scene;s.unit_settings.system='METRIC';s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=48;s.cycles.use_denoising=True
    s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
    white=mat('Porcelain white powdercoat',(.83,.86,.85),.29,.35)
    turquoise=mat('PETRONAS teal enamel',(.001,.36,.32),.25,.22)
    teal_dark=mat('Deep teal folded aluminium',(.008,.11,.105),.32,.35)
    steel=mat('Brushed stainless steel',(.39,.43,.45),.27,.87)
    black=mat('Rubber and black polymer',(.012,.018,.019),.69)
    asphalt=mat('Fine asphalt',(.068,.078,.083),.95)
    concrete=textured_concrete()
    joint=mat('Expansion joint sealant',(.055,.059,.053),.97)
    yellow=mat('Safety yellow',(.88,.56,.005),.42)
    red=mat('Fire extinguisher red',(.51,.018,.009),.28,.35)
    blue=mat('Diesel blue',(.013,.11,.38),.38)
    pale=mat('Warm shop wall',(.64,.65,.60),.8)
    glass=mat('Low iron storefront glass',(.22,.39,.40),.11,.15,alpha=.19)
    led=mat('Neutral white illuminated lettering',(.94,.99,1),.25,emit=2)
    warm=mat('Mesra warm luminaires',(1,.65,.3),.4,emit=3)
    screen=mat('LCD sage backlight',(.43,.57,.43),.44,emit=.2)
    green=mat('Plant foliage',(.036,.17,.045),.72)
    soil=mat('Potting soil',(.055,.037,.022),1)
    wood=mat('Cafe oak finish',(.34,.17,.055),.55)
    logo=mat('Official PETRONAS transparent logo',(1,1,1),.3,emit=1.2)
    p=logo.node_tree.nodes.get('Principled BSDF');tex=logo.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(OUT/'references/official-logo.png'));tex.image.pack()
    for out,socket in [('Color','Base Color'),('Color','Emission Color'),('Alpha','Alpha')]:logo.node_tree.links.new(tex.outputs[out],p.inputs[socket])
    logo.surface_render_method='DITHERED'

    # Existing 58 x 52 m site and gameplay obstructions are preserved.
    box('Forecourt asphalt apron',0,-.045,0,58,.09,52,asphalt,0)
    box('Concrete fuelling apron',0,.055,-8,40,.08,26,concrete,.03)
    for x in range(-20,21,5):box('Saw cut vertical joint',x,.098,-8,.012,.003,26,joint,0)
    for z in range(-21,6,4):box('Saw cut horizontal joint',0,.098,z,40,.003,.012,joint,0)
    for z in [-21.4,6]:
        box('Storm drain channel',0,.09,z,39,.03,.24,black,0)
        for x in range(-78,79):box('Drain grate',x*.245,.113,z,.027,.018,.23,steel,0)
    for x in [-23,23]:
        for z in [-15,-1,14]:
            box('Apron lane marking',x,.006,z,.14,.006,6,white,0)
    for x in [-11,0,11]:
        # Lane directional arrows, with actual flat arrowheads.
        box('Drive through arrow shaft',x,.10,-18.5,.18,.008,1.15,white,0)
        me=bpy.data.meshes.new('Arrowhead');me.from_pydata([pt(x-.55,.106,-18.1),pt(x+.55,.106,-18.1),pt(x,.106,-17.25)],[],[(0,1,2)])
        o=bpy.data.objects.new('Lane arrow',me);s.collection.objects.link(o);o.data.materials.append(white);o['asset']='PETRONAS'
    for x in [-15,-10,-5,5,10,15]:
        box('Shop parking separator',x,.007,8,.10,.006,4,white,0)
        box('Wheel stop',x-2.5,.16,9.8,1.8,.25,.22,joint,.05)
        for dx in [-.62,.62]:box('Reflective wheel stop end',x-2.5+dx,.285,9.8,.3,.012,.23,yellow,0)

    # Shop is a shell so genuine shelving is visible through the glazed frontage.
    box('Shop slab and accessible apron',0,.12,17,37,.22,16,concrete,.06)
    for x in [-17.9,17.9]:box('Mesra sidewall',x,3.25,18,.2,6.5,14,pale,.03)
    box('Mesra rear wall',0,3.25,24.9,36,6.5,.2,pale,.03)
    box('Shop roof with parapet',0,6.65,18,37,.3,14.6,white,.05)
    for x in [-18.35,18.35]:box('Parapet capping',x,6.92,18,.25,.25,14.6,teal_dark)
    box('Rear parapet',0,6.92,25.16,37,.25,.24,teal_dark)
    box('Mesra continuous fascia',0,5.7,10.95,36.3,1.65,.35,turquoise,.04)
    box('Mesra fascia top reveal',0,6.5,10.74,36.4,.08,.08,steel,.008)
    label('Mesra illuminated name','KEDAI MESRA',0,5.7,10.73,14,1,led)
    label('Mesra shop hours','24 JAM',-13.9,5.72,10.73,3,.44,led)
    label('Mesra coffee sign','KOPI & ROTI',13.4,5.72,10.73,4,.44,led)
    for x in [-15.3,-10.9,-6.5,6.5,10.9,15.3]:
        box('Front glazing',x,2.66,10.97,4.27,4.3,.025,glass,0)
        for dx in [-2.18,2.18]:box('Anodised window mullion',x+dx,2.66,10.91,.07,4.43,.11,steel,.005)
        box('Transom bar',x,4.28,10.9,4.3,.045,.12,steel,.004)
        box('Glazing sill',x,.49,10.9,4.4,.09,.2,teal_dark)
        box('Window safety manifestation',x,1.45,10.93,4.2,.045,.003,white,0)
    box('Entrance top aluminium',0,4.83,10.9,8.5,.18,.18,steel)
    for x in [-2.05,2.05]:
        box('Sliding entry leaf',x,2.63,10.85,4.0,4.2,.025,glass,0)
        for dx in [-1.97,1.97]:box('Door extrusion',x+dx,2.63,10.79,.045,4.2,.09,steel,.003)
        line('Pull handle',[(x,1.2,10.69),(x,1.65,10.69)],.02,steel)
    box('Entrance black mat',0,.246,11.6,5,.018,1.0,black,.01)
    for x in [-7,0,7]:
        for z in [15,20]:
            box('Shop ceiling luminaire',x,6.46,z,3,.02,.22,led,0)
            area('Shop diffuse lighting',x,5.7,z,160,3,(1,.87,.69))
    packs=[mat('Retail pack '+str(i),c,.52) for i,c in enumerate([(.5,.07,.025),(.08,.24,.43),(.62,.43,.055),(.15,.36,.1),(.52,.42,.26),(.52,.09,.25)])]
    for x in [-12,-6,6,12]:
        box('Gondola base',x,.45,18,2.5,.35,5,teal_dark)
        for y in [.75,1.3,1.85]:
            box('Gondola shelf',x,y,18,2.5,.045,4.9,white,.01)
            for dx in [-.75,0,.75]:
                for z in [16.0,16.5,17,17.5,18,18.5,19,19.5,20]:
                    box('Retail package',x+dx,y+.18,z,.3,.34,.23,packs[RNG.randrange(6)],.02)
    for x in [-12,-8,-4,0,4,8]:
        box('Refrigerated cabinet',x,1.7,23.8,3.7,2.9,1.6,teal_dark)
        for dx in [-1.2,0,1.2]:
            box('Chiller glass',x+dx,1.72,22.97,1.12,2.55,.018,glass,0)
            box('Chiller handle',x+dx-.43,1.68,22.89,.035,.8,.05,steel)
            for y in [.65,1.2,1.75,2.3]:
                box('Chiller shelf',x+dx,y,23.23,1.1,.035,.48,white)
                for k in [-.32,0,.32]:cylinder('Drinks bottle',x+dx+k,y+.17,23.12,.105,.3,packs[RNG.randrange(6)],10)
    box('Cafe counter base',13.1,.9,14.6,6,1.3,1.5,wood,.045)
    box('Cafe quartz worktop',13.1,1.58,14.6,6.2,.12,1.7,white,.03)
    box('Espresso machine',12.4,1.92,14.6,1,.6,.65,steel,.05)
    box('Cash register',15,1.82,14.4,.55,.45,.38,black,.03)
    label('Cafe menu','KOPI   |   TEH   |   ROTI',12.8,3.25,20.8,6,.4,led)

    # Flush metal soffit, roof ribs, layered fascia, four authentic slender supports.
    box('Canopy insulated roof',0,6.49,-9,38,.42,19,white,.07)
    for z in [-18.58,.58]:
        box('PETRONAS canopy fascia',0,6.38,z,38.24,.76,.22,turquoise,.035)
        box('Fascia shadow reveal',0,5.99,z,38.2,.055,.24,teal_dark,.008)
        box('Fascia silver coping',0,6.79,z,38.4,.08,.28,steel,.012)
    for x in [-19.08,19.08]:
        box('Return fascia',x,6.38,-9,.22,.76,19,turquoise,.035)
        box('Return coping',x,6.79,-9,.28,.08,19.2,steel,.012)
    label('Canopy raised PETRONAS lettering','PETRONAS',0,6.36,-18.728,10,.51,led)
    image_sign('Official canopy emblem',13.8,6.37,-18.737,1.8,.688,logo)
    for x in [-16,16]:
        for z in [-15,-3]:
            box('Column baseplate',x,.17,z,.53,.14,.53,steel,.025)
            box('Powdercoated canopy column',x,3.12,z,.46,6.0,.46,white,.035)
            box('Column teal band',x,4.5,z-.24,.48,.84,.027,turquoise,.01)
            for dx in [-.18,.18]:
                for dz in [-.18,.18]:cylinder('Column anchor bolt',x+dx,.255,z+dz,.034,.035,steel,6)
    for x in range(-18,19,2):box('Soffit panel joint',x,6.269,-9,.014,.008,18.7,joint,0)
    for z in range(-18,1,2):box('Soffit cross joint',0,6.267,z,37.8,.008,.009,joint,0)
    for x in range(-18,19):box('Standing seam roof rib',x,6.731,-9,.032,.065,18.8,white,.008)
    for x in [-11,0,11]:
        for z in [-14,-5]:
            box('Recessed luminaire black surround',x,6.25,z,.94,.035,.64,black,.015)
            box('Diffused LED light panel',x,6.225,z,.82,.027,.52,led,.015)
            area('Forecourt downlight',x,6.13,z,520,2,(.83,.94,1))
    for x in [-18.5,18.5]:line('Rainwater downpipe',[(x,6.2,-2),(x,5.6,-2),(x,.3,-2)],.065,white)

    # Six dispensers; each carries two hoses, display, keypad and payment slot.
    for ii,x in enumerate([-11,0,11]):
        box('Raised oval-edge pump island',x,.22,-9,5.5,.25,2.25,concrete,.12)
        for dx in [-2.42,2.42]:
            box('Yellow island end',x+dx,.23,-9,.37,.27,2.17,yellow,.08)
            for dz in [-.77,.77]:
                cylinder('Stainless impact bollard',x+dx,.62,-9+dz,.09,.98,steel)
                cylinder('Bollard safety reflector',x+dx,.88,-9+dz,.092,.12,yellow)
        for jj,z in enumerate([-9.65,-8.35]):
            number=ii*2+jj+1
            box(f'Pump {number:02d} plinth',x,.39,z,1.56,.26,.7,teal_dark,.055)
            box(f'Pump {number:02d} dispenser housing',x,1.53,z,1.53,2.12,.65,white,.065)
            box('Teal dispenser head',x,2.57,z,1.6,.36,.70,turquoise,.045)
            box('Lower service panel',x,.82,z-.334,1.27,.72,.015,teal_dark,.01)
            for dx in [-.55,.55]:
                for y in [.52,1.11]:cylinder('Service panel screw',x+dx,y,z-.348,.018,.008,steel,6,'front')
            box('Payment fascia',x,1.78,z-.335,1.31,.89,.02,black,.025)
            box('LCD display',x+.2,2.02,z-.352,.73,.33,.008,screen,.008)
            label('LCD sale reset','0.00',x+.2,2.06,z-.36,.59,.15,black)
            label('LCD litres reset','0.000 L',x+.2,1.93,z-.36,.57,.075,black)
            box('Card reader slot',x-.40,1.63,z-.37,.30,.055,.04,steel,.006)
            box('Contactless pad',x-.4,1.87,z-.36,.28,.19,.012,steel,.015)
            for row in range(4):
                for col in range(3):box('Payment keypad button',x+.05+col*.095,1.76-row*.077,z-.368,.069,.051,.018,steel,.006)
            label('Pump bay ID',f'{number:02d}',x,2.60,z-.365,.5,.23,led)
            label('Fuel product band','PRIMAX',x,.84,z-.35,.92,.19,white)
            label('Pump payment label','SETEL   /   MESRA',x,.59,z-.352,.93,.08,white)
            for side,product in [(-1,yellow),(1,turquoise if jj==0 else blue)]:
                # Looped rubber hose and metallic nozzle spout are geometry, not painted props.
                hx=x+side*.85
                line('Flexible fuel hose',[(hx,2.15,z),(hx+side*.30,1.65,z+.12),(hx+side*.32,.62,z+.1),(hx+side*.17,.48,z-.18),(hx,.75,z-.42),(hx,1.33,z-.40)],.026,black)
                box('Nozzle cradle',hx,1.39,z-.34,.18,.46,.16,black,.025)
                nozzle=box('Colour coded nozzle handle',hx,1.49,z-.455,.115,.29,.19,product,.035);nozzle.rotation_euler.y=side*.20
                line('Nozzle trigger guard',[(hx-.055,1.53,z-.56),(hx-.07,1.29,z-.57),(hx+.06,1.3,z-.57),(hx+.06,1.51,z-.56)],.013,steel)
                line('Aluminium nozzle spout',[(hx,1.64,z-.46),(hx,1.81,z-.43),(hx,1.88,z-.25)],.024,steel)
        cylinder('Fire extinguisher bottle',x+1.8,.59,-9,.115,.55,red)
        cylinder('Extinguisher valve',x+1.8,.91,-9,.045,.12,steel)
        box('Extinguisher handle',x+1.8,1,-9,.17,.04,.05,black)
        label('Pump island number',f'{ii*2+1}  /  {ii*2+2}',x,5.23,-9.38,1.0,.34,white)
        box('Suspended island ID panel',x,5.22,-9.34,1.35,.63,.08,turquoise,.04)
        line('Hanging ID cable',[(x-.48,5.54,-9.34),(x-.48,6.24,-9.34)],.012,steel)
        line('Hanging ID cable',[(x+.48,5.54,-9.34),(x+.48,6.24,-9.34)],.012,steel)

    # Monolith, labelled by fuel grade rather than invented current prices.
    box('Pylon footing',23,.15,-24,3.8,.3,1.1,concrete,.08)
    box('Pylon white aluminium monolith',23,5.57,-24,3.75,10.7,1.0,white,.08)
    box('Pylon brand panel',23,9.14,-24.52,3.66,3.24,.065,turquoise,.015)
    image_sign('Official pylon brand',23,9.23,-24.559,3.32,1.268,logo)
    for index,text in enumerate(['RON 95','RON 97','DIESEL']):
        y=6.57-index*1.1
        box('Fuel grade module',23,y,-24.537,3.35,.87,.025,teal_dark,.018)
        label('Illuminated grade',text,23,y,-24.56,2.6,.39,led)
    label('Pylon Mesra','mesra',23,2.63,-24.545,2.8,.7,turquoise)
    label('Pylon hours','24 JAM',23,1.42,-24.546,2.2,.36,teal_dark)
    for z in [-24.58,-23.42]:box('Pylon base reveal',23,.6,z,3.5,.035,.03,teal_dark,.004)

    # Service details stay inside the existing shop collision footprint.
    for x in [-17.55,17.55]:
        cylinder('Rainwater pipe at shop',x,3.27,24.6,.067,6.4,white)
    for x in [-13,13]:
        box('Roof AC condenser',x,7.13,20,2.2,.68,1.4,white,.05)
        for k in range(12):box('Condenser louvre',x-.9+k*.165,7.16,19.287,.045,.45,.025,steel,.002)
        for dx in [-.53,.53]:cylinder('Roof fan grille',x+dx,7.489,20,.41,.017,black,28)
    for x in [-16,16]:
        box('Planter pot',x,.61,12.4,.8,.8,.8,concrete,.08)
        box('Planter soil',x,1.01,12.4,.67,.025,.67,soil,.04)
        for k in range(9):
            a=k*math.tau/9
            line('Tropical leaf stem',[(x,1,12.4),(x+math.cos(a)*.2,1.7,12.4+math.sin(a)*.2),(x+math.cos(a)*.4,1.9,12.4+math.sin(a)*.4)],.04,green)
    s['asset']='LM_ENV_Petronas';s['world_origin']=(-31,0,112)
    s['scope']='Detailed reconstruction of the existing fictional game station; not a surveyed real station.'
    # Studio environment stays out of web export.
    ground=box('RENDER ONLY | surroundings',0,-.15,0,240,.12,240,asphalt,0);ground['asset']='STUDIO'
    world=bpy.data.worlds.new('Kuala Lumpur daylight');s.world=world;world.use_nodes=True
    sky=world.node_tree.nodes.new('ShaderNodeTexSky');sky.sky_type='MULTIPLE_SCATTERING';sky.sun_elevation=math.radians(23);sky.sun_rotation=math.radians(135);sky.sun_intensity=.8
    world.node_tree.links.new(sky.outputs['Color'],world.node_tree.nodes.get('Background').inputs['Color']);world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.35
    bpy.ops.object.camera_add(location=pt(48,15,-57));cam=bpy.context.object;cam.name='Camera | exterior hero';cam.data.lens=38
    cam.rotation_euler=(Vector(pt(0,3.3,-1))-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam
    polish();repack_textures()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'petronas.blend'))
    print('PETRONAS SOURCE SAVED',len(s.objects),flush=True)
    export_web()

def polish():
    s=bpy.context.scene
    # Existing V1 sources already carry the original polish pass. Migrate those files
    # straight to the contextual V2 details without duplicating their old geometry.
    if s.get('detail_polish'):
        if s.get('detail_polish_version',0)<2:polish_v2()
        return
    # Scale text using its local font bounds, never the font's unrotated dimensions.
    sizes={'Mesra illuminated name':(14,1),'Mesra shop hours':(3,.44),'Mesra coffee sign':(4,.44),'Cafe menu':(6,.4),
        'Canopy raised PETRONAS lettering':(10,.57),'LCD sale reset':(.59,.15),'LCD litres reset':(.57,.075),
        'Pump bay ID':(.5,.23),'Fuel product band':(.92,.19),'Pump payment label':(.93,.08),'Pump island number':(1,.34),
        'Illuminated grade':(2.6,.39),'Pylon Mesra':(2.8,.7),'Pylon hours':(2.2,.36)}
    for o in s.objects:
        if o.type=='FONT' and o.name.split('.')[0] in sizes:
            width,height=sizes[o.name.split('.')[0]];b=o.bound_box
            sc=min(width/max(max(v[0] for v in b)-min(v[0] for v in b),.001),height/max(max(v[1] for v in b)-min(v[1] for v in b),.001));o.scale=(sc,sc,sc)
    # Back-to-back dispensers face their respective drive lanes.
    bpy.context.view_layer.update()
    for o in list(s.objects):
        if o.get('asset')!='PETRONAS' or o.type not in {'FONT','CURVE','MESH'}:continue
        points=[o.matrix_world@Vector(v) for v in o.bound_box];center=sum(points,Vector())/8
        x,z,y=center.x,-center.y,center.z
        if .34<y<2.95 and abs(z+8.35)<.57:
            for px in [-11,0,11]:
                if abs(x-px)<1.3:
                    pivot=Vector(pt(px,0,-8.35));o.matrix_world=Matrix.Translation(pivot)@Matrix.Rotation(math.pi,4,'Z')@Matrix.Translation(-pivot)@o.matrix_world;break
    m=bpy.data.materials['PBR | jointed pale forecourt concrete'];nt=m.node_tree;p=nt.nodes.get('Principled BSDF')
    size=512;rng=random.Random(11);rough=[];normal=[]
    for i in range(size*size):
        r=.78+rng.random()*.14;rough.extend((r,r,r,1));normal.extend((.5+(rng.random()-.5)*.085,.5+(rng.random()-.5)*.085,1,1))
    for name,data in [('Concrete_Roughness',rough),('Concrete_Normal',normal)]:
        im=bpy.data.images.get(name) or bpy.data.images.new(name,width=size,height=size)
        im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(data);im.update()
        im.filepath_raw=str(OUT/'textures'/f'{name}.png');im.file_format='PNG';im.save();im.pack()
        if name.endswith('Normal'):
            tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im;nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.32
            nt.links.new(tex.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    teal=mat('Teal under fascia light',(.001,.38,.26),.35,emit=1.5)
    for z in [-18.43,.43]:box('Continuous teal underlight',0,6.045,z,37.8,.028,.06,teal,.008)
    steel=bpy.data.materials['Brushed stainless steel']
    for i in range(187):box('Fine extruded soffit rib',-18.6+i*.2,6.253,-9,.013,.014,18.6,steel,0)
    stain=mat('Subtle forecourt tyre and fuel marks',(.02,.025,.019),.83,alpha=.08)
    for x in [-14,-8,-3,3,8,14]:
        for z in [-11,-7]:
            vs=[pt(x+math.cos(a*math.tau/12)*rng.uniform(.30,.7),.102,z+math.sin(a*math.tau/12)*rng.uniform(.2,.55)) for a in range(12)]
            me=bpy.data.meshes.new('Forecourt wear');me.from_pydata(vs,[],[tuple(range(12))]);o=bpy.data.objects.new('Forecourt wear',me);s.collection.objects.link(o);me.materials.append(stain);o['asset']='PETRONAS'
    # Soft grazing light records the stainless finish in the close-up camera.
    area('Pump photographic fill',5,5,-16,280,5,(.86,.94,1),target=(0,1.5,-9))
    s['detail_polish']=1
    polish_v2()

def polish_v2():
    """Add the small operational details that make the forecourt read as lived-in.

    The first PETRONAS pass established the shell, pumps and shop. This pass stays within
    that same material palette and collision envelope, adding the pedestrian/service edge,
    trolley bay, waste sorting, CCTV and safety markings visible from the Mamak approach.
    It is intentionally geometry-only so the compressed web export remains portable.
    """
    s=bpy.context.scene
    if s.get('detail_polish_version',0)>=2:return
    white=bpy.data.materials['Porcelain white powdercoat']
    turquoise=bpy.data.materials['PETRONAS teal enamel']
    teal_dark=bpy.data.materials['Deep teal folded aluminium']
    steel=bpy.data.materials['Brushed stainless steel']
    black=bpy.data.materials['Rubber and black polymer']
    concrete=bpy.data.materials['PBR | jointed pale forecourt concrete']
    yellow=bpy.data.materials['Safety yellow']
    red=bpy.data.materials['Fire extinguisher red']
    led=bpy.data.materials['Neutral white illuminated lettering']
    green=bpy.data.materials['Plant foliage']

    # Customer service cabinet at the shop-side edge: compressed air, water and a looped
    # hose are common petrol-station details and give the otherwise empty apron a scale cue.
    box('Air water station body',-17.0,.96,7.15,1.18,1.82,.68,teal_dark,.055)
    box('Air water station face',-17.0,1.48,6.79,1.02,.62,.035,turquoise,.018)
    box('Air water station lower plinth',-17.0,.24,7.15,1.28,.16,.74,white,.025)
    cylinder('Air pressure gauge',-17.0,1.82,6.75,.16,.055,steel,24,'front')
    cylinder('Air pressure gauge bezel',-17.0,1.82,6.71,.19,.018,black,24,'front')
    line('Air service hose',[(-16.72,1.35,6.84),(-16.35,1.08,6.62),(-16.32,.55,6.46),(-16.72,.42,6.30),(-16.85,.83,6.44)],.024,black)
    box('Air hose nozzle cradle',-16.82,1.10,6.27,.14,.30,.16,black,.02)
    box('Air hose nozzle',-16.82,1.27,6.19,.10,.20,.12,steel,.02)

    # A compact waste-sorting island keeps the shop frontage grounded and gives the camera
    # a readable scale reference without inventing brand copy or signage.
    for index,(x,body,accent,text) in enumerate([
        (15.00,teal_dark,turquoise,'RECYCLE'),(16.08,black,yellow,'GENERAL'),(17.16,teal_dark,green,'BOTTLES')]):
        box('Waste sorting bin body',x,.62,8.28,.82,1.12,.72,body,.055)
        box('Waste sorting bin lid',x,1.21,8.28,.86,.12,.76,accent,.035)
        box('Waste sorting bin foot',x,.10,8.28,.88,.12,.78,steel,.02)
        # Accent-colour lids carry the sorting cue; avoiding font meshes keeps the shared
        # forecourt export within its measured triangle envelope.
    box('Waste sorting island curb',16.08,.18,8.28,3.12,.10,.90,concrete,.03)

    # Stainless trolley corral with two nested carts, positioned to the left of the entrance
    # so it reads in both the hero render and the Mamak-facing gameplay camera.
    for x in [-13.85,-11.25]:
        cylinder('Trolley corral post',x,.98,8.62,.045,1.70,steel,12)
        cylinder('Trolley corral foot',x,.14,8.62,.13,.10,steel,16)
    line('Trolley corral top rail',[(-13.85,1.72,8.62),(-11.25,1.72,8.62)],.045,steel)
    line('Trolley corral lower rail',[(-13.85,.64,8.62),(-11.25,.64,8.62)],.032,steel)
    for x in [-13.42,-12.32]:
        box('Shopping trolley basket',x,.95,8.22,.82,.55,.95,steel,.025)
        box('Shopping trolley handle',x,1.36,7.68,.85,.10,.10,black,.02)
        line('Shopping trolley frame',[(x-.39,.53,7.75),(x-.39,.53,8.68),(x+.39,.53,8.68),(x+.39,.53,7.75)],.022,steel)
        for dx in [-.30,.30]:
            cylinder('Shopping trolley wheel',x+dx,.23,7.78,.095,.08,black,12,'front')

    # Tactile pedestrian approach and a short zebra crossing connect the apron to the Mesra
    # threshold; raised dots are deliberately sparse so they stay below the export budget.
    for x in [-12,-10,-8,-6,-4,-2,0,2,4,6,8,10,12]:
        box('Pedestrian tactile strip',x,.19,8.95,1.38,.028,.20,yellow,0)
        for dx in [-.38,.38]:cylinder('Tactile raised dot',x+dx,.225,8.95,.045,.035,yellow,10)
    for x in [-5.0,-3.3,-1.6,.1,1.8,3.5,5.2]:
        box('Pedestrian crossing stripe',x,.185,10.05,1.18,.022,.38,white,0)

    # Low guard rails keep the entry path legible around the forecourt edge. The rails are
    # decorative only; gameplay collision remains the authoritative world layout.
    for x in [-8.9,8.9]:
        cylinder('Pedestrian guardrail post',x,.73,9.20,.05,1.20,steel,12)
        cylinder('Pedestrian guardrail foot',x,.14,9.20,.14,.10,steel,16)
    line('Pedestrian guardrail top',[(-8.9,1.25,9.20),(-4.5,1.25,9.20),(-4.5,1.25,10.15)],.045,steel)
    line('Pedestrian guardrail top',[ (8.9,1.25,9.20),(4.5,1.25,9.20),(4.5,1.25,10.15)],.045,steel)

    # Emergency-stop cabinet on the right pump island and bilingual safety copy; no invented
    # fuel prices are introduced.
    box('Emergency stop cabinet',17.0,1.18,-1.20,.72,1.35,.20,red,.035)
    box('Emergency stop face',17.0,1.37,-1.32,.58,.62,.025,white,.012)
    cylinder('Emergency stop button',17.0,1.46,-1.35,.14,.065,red,20,'front')
    box('Fire action placard',16.0,2.20,-1.36,.82,.55,.028,white,.008)

    # CCTV heads and rainwater scuppers provide small vertical accents under the otherwise
    # uninterrupted canopy; their dark housings remain visible at night without real lights.
    for x in [-17.2,17.2]:
        cylinder('CCTV support pole',x,4.15,.38,.055,7.90,steel,12)
        box('CCTV camera housing',x,8.02,.20,.38,.22,.58,black,.035)
        cylinder('CCTV lens',x,8.03,-.11,.095,.045,steel,16,'front')
        box('CCTV sun hood',x,8.17,-.18,.32,.055,.46,black,.015)
    for x in [-14,-7,0,7,14]:
        box('Canopy rainwater scupper',x,6.33,.70,.46,.15,.30,steel,.025)
        box('Canopy gutter strap',x,6.11,.66,.08,.38,.07,teal_dark,.008)

    # Yellow island noses already carry the safety colour; these short black bars add the
    # alternating hazard rhythm seen on real forecourts while using the existing polymer.
    for x in [-11,0,11]:
        for side in [-1,1]:
            for offset in [-.63,0,.63]:
                stripe=box('Pump island hazard stripe',x+side*2.43,.405,-9+offset,.06,.035,.31,black,0)
                stripe.rotation_euler.y=side*.48

    s['detail_polish_version']=2
    s['detail_features']=['air-water-service','waste-sorting','trolley-corral','tactile-crossing','guardrails','safety-cabinet','cctv','canopy-scupper','island-hazard-stripes']

def repack_textures():
    # Reload saved PNGs as fresh file images: repacking a previously packed
    # generated image can retain its stale (black) buffer in the .blend.
    for name in ['Concrete_BaseColor','Concrete_Roughness','Concrete_Normal']:
        im=bpy.data.images.load(str(OUT/'textures'/f'{name}.png'),check_existing=False)
        if name!='Concrete_BaseColor':im.colorspace_settings.name='Non-Color'
        im.reload();im.pack()
        for m in bpy.data.materials:
            if not m.use_nodes:continue
            for node in m.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image and node.image.name.split('.')[0]==name:node.image=im
        print('PACKED TEXTURE',name,list(im.pixels[:4]),flush=True)

def export_web():
    bpy.ops.object.select_all(action='DESELECT')
    meshes=[]
    for ob in list(bpy.context.scene.objects):
        if ob.get('asset')!='PETRONAS':continue
        if ob.type in {'CURVE','FONT'}:
            bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)
        if ob.type=='MESH':meshes.append(ob)
    # Join by material for a small, predictable number of GPU draw calls.
    batches={}
    for ob in meshes:batches.setdefault(ob.data.materials[0].name,[]).append(ob)
    outputs=[]
    for name,objects in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name='PETRONAS | '+name
        if not any(node.type=='TEX_IMAGE' for node in o.data.materials[0].node_tree.nodes):
            for uv in list(o.data.uv_layers):o.data.uv_layers.remove(uv)
        outputs.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in outputs:ob.select_set(True)
    path=PUBLIC/'LM_ENV_Petronas.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_tangents=True,export_cameras=False,export_lights=False)
    triangles=sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in outputs)
    report={'asset':'LM_ENV_Petronas','origin':[-31,0,112],'footprint':[58,52],'pumps':6,'materials':len(outputs),'triangles':triangles,'bytes':path.stat().st_size,'signs':['PETRONAS','KEDAI MESRA','RON 95','RON 97','DIESEL'],'detail_polish_version':bpy.context.scene.get('detail_polish_version',1),'detail_features':bpy.context.scene.get('detail_features',[]),'source':'assets/petronas/petronas.blend'}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PETRONAS WEB EXPORT',json.dumps(report),flush=True)

def render():
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'petronas.blend'));s=bpy.context.scene
    s.render.resolution_x=1400;s.render.resolution_y=1000;s.cycles.samples=32
    views=[('01-day-exterior',(48,10,-67),(0,3,-1),38,False),('02-night-exterior',(48,10,-67),(0,3,-1),38,True),('03-pump-detail',(3.6,2.5,-14.1),(0,1.6,-9.7),48,False),('04-mesra-front',(-28,6,-7),(0,3,15),40,False)]
    for name,pos,target,lens,night in views:
        if '--single' in ARGS and name!='01-day-exterior':continue
        if '--view' in ARGS and not name.startswith(ARGS[ARGS.index('--view')+1]):continue
        s.camera.location=pt(*pos);s.camera.rotation_euler=(Vector(pt(*target))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.lens=lens
        bg=s.world.node_tree.nodes.get('Background');sky=s.world.node_tree.nodes.get('Sky Texture')
        sky.sun_elevation=math.radians(-5 if night else 23);bg.inputs['Strength'].default_value=.2 if night else .35
        s.render.filepath=str(OUT/'renders'/f'{name}.png');bpy.ops.render.render(write_still=True)
        print('RENDER COMPLETE',name,flush=True)

if __name__=='__main__':
    if '--repack' in ARGS:
        bpy.ops.wm.open_mainfile(filepath=str(OUT/'petronas.blend'));repack_textures();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'petronas.blend'));export_web()
    elif '--polish' in ARGS:
        bpy.ops.wm.open_mainfile(filepath=str(OUT/'petronas.blend'));polish();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'petronas.blend'));export_web()
    elif '--export-only' in ARGS:
        bpy.ops.wm.open_mainfile(filepath=str(OUT/'petronas.blend'));export_web()
    elif '--render-only' not in ARGS:build()
    if '--no-render' not in ARGS:render()
