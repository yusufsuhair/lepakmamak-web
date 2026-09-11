"""V7 lighting derivative: detailed dining furniture at authoritative seats.

Blender -b --python-exit-code 1 --python art/blender/scripts/build_mamak_realism.py -- --build
Blender -b --python-exit-code 1 --python art/blender/scripts/build_mamak_realism.py -- --render
"""
import bpy, bmesh, math, json, random, sys, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'assets/mamak-realism';OUT.mkdir(parents=True,exist_ok=True)
for name in ['textures','renders','reports']:(OUT/name).mkdir(exist_ok=True)
BASE=ROOT/'art/blender/generated/mamak-maju-v7/source/LM_ENV_MamakMaju.blend'
SOURCE=OUT/'mamak-realism.blend'
EXPORT=ROOT/'public/assets/models/environment/LM_ENV_MamakMaju_Realism.glb'
ORIGIN=(-29,0,30);IDS={'meja-1','meja-2','meja-3','meja-4','meja-9'}
TABLES=[t for t in json.loads((ROOT/'shared/tables.json').read_text()) if t['id'] in IDS]
CHAIRS=[c for c in json.loads((ROOT/'shared/chairs.json').read_text()) if c.get('tableId') in IDS]
TABLETOP=json.loads((ROOT/'shared/mamak-tabletop.json').read_text())['realism']
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
RNG=random.Random(91026);CREATED=[];OWNER=''

def coord(x,y,z):return (x-ORIGIN[0],-(z-ORIGIN[2]),y)
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def material(name,hex,rough=.45,metal=0,alpha=1):
    m=bpy.data.materials.new('MR | '+name);m.use_nodes=True
    color=[linear(int(hex[i:i+2],16)/255) for i in (1,3,5)]
    m.diffuse_color=(*color,alpha);p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Alpha'].default_value=alpha
    if alpha<1:m.surface_render_method='DITHERED';m.use_transparency_overlap=False
    return m

def texture(m,name,kind):
    size=512;data=[]
    for y in range(size):
        for x in range(size):
            n=RNG.random()
            if kind=='laminate':
                v=.77+n*.12
                if n>.98:v-=.12
                data.extend((v,v*.97,v*.88,1))
            elif kind=='roti':
                blot=(math.sin(x*.08+math.sin(y*.025)*4)+math.sin(y*.12+math.cos(x*.04)*3))*.5
                t=max(0,min(1,(blot-.1)*.9))
                data.extend((.87-t*.48+n*.05,.60-t*.42+n*.045,.27-t*.22+n*.02,1))
            else:
                # Subtle, real tangent-space microtexture; neutral Z stays near 1.
                data.extend((.5+(n-.5)*.05,.5+(RNG.random()-.5)*.05,1,1))
    im=bpy.data.images.new(name,width=size,height=size)
    if kind=='normal':im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(data);im.update();path=OUT/'textures'/f'{name}.png';im.filepath_raw=str(path);im.file_format='PNG';im.save()
    fresh=bpy.data.images.load(str(path),check_existing=False)
    if kind=='normal':fresh.colorspace_settings.name='Non-Color'
    fresh.reload();fresh.pack()
    nt=m.node_tree;p=nt.nodes.get('Principled BSDF');node=nt.nodes.new('ShaderNodeTexImage');node.image=fresh
    if kind=='normal':
        nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.25;nt.links.new(node.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    else:nt.links.new(node.outputs['Color'],p.inputs['Base Color'])

def finish(o,name,m,bevel=0):
    o.name=name;o.data.materials.append(m);o['mr_owner']=OWNER;o['mr_detail']=True
    # All furniture is in the same export collection; lights never are.
    for col in list(o.users_collection):col.objects.unlink(o)
    bpy.data.collections['EXPORT'].objects.link(o)
    bpy.context.view_layer.objects.active=o
    if bevel:
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=bevel;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
    CREATED.append(o);return o

def box(name,x,y,z,w,h,d,m,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=coord(x,y,z));o=bpy.context.object;o.scale=(w,d,h)
    return finish(o,name,m,min(bevel,w/4,h/4,d/4))

def mesh(name,vs,fs,m):
    me=bpy.data.meshes.new(name);me.from_pydata([coord(*p) for p in vs],[],fs);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);bpy.data.collections['EXPORT'].objects.link(o)
    return finish(o,name,m)

def lathe(name,x,y,z,profile,m,n=48):
    vs=[(x+r*math.cos(a*math.tau/n),y+h,z+r*math.sin(a*math.tau/n)) for r,h in profile for a in range(n)]
    fs=[(j*n+a,j*n+(a+1)%n,(j+1)*n+(a+1)%n,(j+1)*n+a) for j in range(len(profile)-1) for a in range(n)]
    o=mesh(name,vs,fs,m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def tube(name,points,r,m):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=r;c.bevel_resolution=3
    spline=c.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for p,v in zip(spline.bezier_points,points):p.co=coord(*v);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.data.collections['EXPORT'].objects.link(o);return finish(o,name,m)

def uv(o):
    me=o.data;me.update();layer=me.uv_layers.active or me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        axes=sorted(range(3),key=lambda a:abs(p.normal[a]))[:2]
        for li in p.loop_indices:
            v=me.vertices[me.loops[li].vertex_index].co
            layer.data[li].uv=(v[axes[0]]*1.4,v[axes[1]]*1.4)

def strip_old_furniture():
    o=bpy.data.objects['LM_ENV_MamakMaju'];names={v.index:v.name.split('_',3)[-1] for v in o.vertex_groups}
    exact={'TableBase','TableLeg','TableRim','TableTop','TeaCup','TeaFoam','CupHandle','Plate','Roti','TissueBox','Tissue'}
    exact.update({'TeaSaucer','TeaSurface','FoamBubble','MugHandleRail','MugHandleOuter','PlateRim','PlateWell','RotiFold','RotiToast','DhalBowl','DhalSurface','Spoon','TissueSlot','TableMenuBase','TableMenu','MenuPrint','SharingPlate','SharingRoti'})
    prefixes=tuple(c['id'] for c in CHAIRS)+('CustomerReserved',)
    indices={i for i,name in names.items() if name in exact or name.startswith(prefixes)}
    doomed={v.index for v in o.data.vertices if any(g.group in indices for g in v.groups)}
    assert len(doomed)>500,'Expected V6 vertex groups missing; refuse to overlap furniture'
    bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.verts[i] for i in doomed],context='VERTS');bm.to_mesh(o.data);bm.free()
    selected_names={group.name for group in o.vertex_groups if group.index in indices}
    for group in list(o.vertex_groups):
        if group.name in selected_names:o.vertex_groups.remove(group)
    o['lm_realism_version']=2;o['lm_realism_removed_vertices']=len(doomed)
    return len(doomed)

def chair(seat,plastic,rubber):
    global OWNER
    OWNER=seat['id'];x,z,yaw=seat['x'],seat['z'],seat['yaw'];start=len(CREATED)
    # Soft-edged, dished seat. Physical seat plane retained at ~0.66 m for avatars.
    rings=[(.0,.620),(.17,.616),(.29,.630),(.355,.649),(.372,.635),(.37,.600),(.31,.590),(.0,.590)]
    # Superellipse is a rounded rectangle, not a circular stool seat.
    n=48;vs=[]
    for r,h in rings:
        for i in range(n):
            a=i*math.tau/n;cx=math.cos(a);sz=math.sin(a)
            vs.append((x+r*math.copysign(abs(cx)**.5,cx),h,z+r*math.copysign(abs(sz)**.5,sz)))
    fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rings)-1) for i in range(n)]
    o=mesh(OWNER+' | moulded dished seat',vs,fs,plastic)
    for p in o.data.polygons:p.use_smooth=True
    # Splayed legs with real tapered extrusion and underside bracing.
    for dx in [-1,1]:
        for dz in [-1,1]:
            points=[]
            for h,cx,cz,w in [(.20,dx*.344,dz*.345,.026),(.59,dx*.27,dz*.265,.038)]:
                points.extend([(x+cx-w,h,z+cz-w),(x+cx+w,h,z+cz-w),(x+cx+w,h,z+cz+w),(x+cx-w,h,z+cz+w)])
            mesh(OWNER+' | tapered leg',points,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],plastic)
            box(OWNER+' | nonmarking foot',x+dx*.344,.211,z+dz*.345,.063,.030,.063,rubber,.007)
    for dx in [-.245,.245]:box(OWNER+' | underside reinforcement',x+dx,.567,z,.045,.048,.59,plastic,.014)
    # Ergonomic open back: rounded perimeter and curved ventilated vertical slats.
    tube(OWNER+' | curved back surround',[(x-.30,.61,z-.28),(x-.335,.90,z-.37),(x-.315,1.26,z-.405),(x-.21,1.35,z-.425),(x,1.365,z-.435),(x+.21,1.35,z-.425),(x+.315,1.26,z-.405),(x+.335,.90,z-.37),(x+.30,.61,z-.28)],.039,plastic)
    for dx in [-.21,-.105,0,.105,.21]:
        tube(OWNER+' | ventilated flex back',[(x+dx,.68,z-.285),(x+dx,.85,z-.335),(x+dx,1.06,z-.39),(x+dx,1.335,z-.427)],.029,plastic)
    # Local +Z faces the table, matching the authoritative seat yaw.
    c,s=math.cos(yaw),math.sin(yaw)
    for o in CREATED[start:]:
        # Transform world-authored vertices, curves and primitive transforms equally.
        from mathutils import Matrix
        pivot=Vector(coord(x,0,z));o.matrix_world=Matrix.Translation(pivot)@Matrix.Rotation(yaw,4,'Z')@Matrix.Translation(-pivot)@o.matrix_world

def table(t,steel,laminate,rubber,ceramic,tea,glass,foam,bread,tissue):
    global OWNER
    OWNER=t['id'];x,z=t['x'],t['z'];r=1.95 if t['id']=='meja-9' else 1.14
    lathe(OWNER+' | weighted spun pedestal',x,0,z,[(0,.22),(.47,.22),(.57,.245),(.60,.28),(.56,.31),(.35,.33),(.09,.38),(.082,.94),(.16,1.035),(0,1.035)],steel)
    lathe(OWNER+' | rubber pedestal foot',x,0,z,[(0,.20),(.54,.20),(.58,.223),(.57,.245),(0,.245)],rubber)
    lathe(OWNER+' | rolled steel table rim',x,0,z,[(r-.07,1.075),(r-.012,1.075),(r,1.09),(r,1.128),(r-.012,1.144),(r-.07,1.144),(r-.07,1.075)],steel,96)
    lathe(OWNER+' | speckled laminate top',x,0,z,[(0,1.145),(r-.032,1.145),(r-.02,1.138),(r-.025,1.115),(0,1.115)],laminate,96)
    for a in [0,math.pi/2,math.pi,math.pi*1.5]:
        tube(OWNER+' | underside steel spoke',[(x,1.04,z),(x+math.cos(a)*r*.72,1.035,z+math.sin(a)*r*.72)],.019,steel)
    for dx,dz in TABLETOP['cups']:
        cx,cz=x+dx,z+dz
        lathe(OWNER+' | glass teh tarik mug',cx,1.15,cz,[(0,0),(.081,0),(.095,.025),(.10,.27),(.096,.285),(.084,.285),(.081,.05),(0,.043)],glass,40)
        lathe(OWNER+' | tea liquid',cx,1.15,cz,[(0,.044),(.080,.044),(.088,.232),(0,.232)],tea,40)
        lathe(OWNER+' | creamy meniscus',cx,1.15,cz,[(0,.234),(.086,.234),(.086,.243),(0,.243)],foam,40)
        tube(OWNER+' | clear mug handle',[(cx+.094,1.39,cz),(cx+.155,1.375,cz),(cx+.164,1.30,cz),(cx+.11,1.23,cz),(cx+.094,1.25,cz)],.015,glass)
        for k in range(13):
            a=RNG.random()*math.tau;rr=RNG.random()*.067
            lathe(OWNER+' | tea froth bubble',cx+math.cos(a)*rr,1.394,cz+math.sin(a)*rr,[(0,0),(.004,.001),(.004,.004),(0,.005)],foam,8)
    px,pz=x-.25,z-.29
    lathe(OWNER+' | glazed ceramic plate',px,1.15,pz,[(0,.005),(.18,.005),(.25,.02),(.29,.055),(.29,.072),(.27,.079),(.21,.04),(0,.037)],ceramic,64)
    # Irregular folded roti with concentric flaky layers, browned albedo, no food photo.
    for layer in range(3):
        n=64;vs=[(px,1.20+layer*.015,pz)]
        for i in range(n):
            a=i*math.tau/n;rr=.214+RNG.uniform(-.012,.012)
            vs.append((px+math.cos(a)*rr,1.202+layer*.014+math.sin(a*7)*.006,pz+math.sin(a)*rr))
        o=mesh(OWNER+' | flaky roti layer',vs,[(0,i+1,(i+1)%n+1) for i in range(n)],bread)
        for p in o.data.polygons:p.use_smooth=True
    # Shallow curry saucer and reflective spoon bowl with a tapered stem.
    lathe(OWNER+' | curry saucer',x+.31,1.15,z+.36,[(0,.005),(.105,.005),(.13,.06),(.12,.075),(.10,.028),(0,.025)],steel,40)
    lathe(OWNER+' | dhal',x+.31,1.15,z+.36,[(0,.043),(.108,.043),(.11,.05),(0,.05)],tea,40)
    bowl=lathe(OWNER+' | spoon bowl',x+.49,1.166,z+.10,[(0,.0),(.045,.005),(.059,.018),(.055,.026),(.03,.012),(0,.007)],steel,32)
    centre=coord(x+.49,1.166,z+.10)
    for v in bowl.data.vertices:v.co.y=centre[1]+(v.co.y-centre[1])*1.45
    tube(OWNER+' | spoon handle',[(x+.49,1.187,z+.16),(x+.49,1.19,z+.27),(x+.49,1.18,z+.38)],.008,steel)
    box(OWNER+' | tissue holder',x+.12,1.255,z-.60,.27,.21,.15,steel,.018)
    box(OWNER+' | tissue slot',x+.12,1.364,z-.60,.15,.006,.035,rubber,.005)
    mesh(OWNER+' | folded paper tissue',[(x+.04,1.365,z-.60),(x+.20,1.365,z-.60),(x+.23,1.50,z-.575),(x+.12,1.525,z-.615),(x+.045,1.47,z-.585)],[(0,1,2,3,4)],tissue)

def build():
    global OWNER
    if SOURCE.exists():raise RuntimeError('Source already exists; preserve it and choose an explicit maintenance operation')
    bpy.ops.wm.open_mainfile(filepath=str(BASE));removed=strip_old_furniture()
    steel=material('brushed stainless','#a5aeae',.28,.88);plastic=material('deep red moulded polypropylene','#9e292c',.34)
    rubber=material('rubber and recesses','#252722',.91);laminate=material('ivory speckled laminate','#ede7d1',.34)
    ceramic=material('glazed porcelain','#eee9da',.20);glass=material('mug glass','#d8e3df',.08,.05,.24)
    tea=material('teh tarik and dhal','#b98246',.25);foam=material('milk microfoam','#dfbc88',.52)
    bread=material('roti toasted layers','#d4a55c',.82);tissue=material('paper tissue','#f2efdf',.91)
    texture(laminate,'MR_Laminate','laminate');texture(bread,'MR_Roti','roti');texture(steel,'MR_SteelNormal','normal');texture(plastic,'MR_PlasticNormal','normal')
    for t in TABLES:table(t,steel,laminate,rubber,ceramic,tea,glass,foam,bread,tissue)
    for c in CHAIRS:chair(c,plastic,rubber)
    chair({'id':'CustomerReserved','x':-29,'z':46.7,'yaw':math.pi},plastic,rubber)
    # Actual geometry bounds are recorded before batching; metadata isn't a substitute.
    bpy.context.view_layer.update();owners={}
    for o in CREATED:
        if o.type=='MESH':uv(o)
        bounds=[o.matrix_world@Vector(v) for v in o.bound_box]
        entry=owners.setdefault(o['mr_owner'],{'min':[1e9]*3,'max':[-1e9]*3,'parts':0});entry['parts']+=1
        for p in bounds:
            for i,v in enumerate((p.x+ORIGIN[0],p.z,-p.y+ORIGIN[2])):entry['min'][i]=min(entry['min'][i],v);entry['max'][i]=max(entry['max'][i],v)
    for c in CHAIRS:
        b=owners[c['id']];assert abs((b['min'][0]+b['max'][0])/2-c['x'])<.10;assert abs((b['min'][2]+b['max'][2])/2-c['z'])<.10
    s=bpy.context.scene;s['mamak_realism_version']=2;s['scope']='V7 contact shading rebaked with realistic furniture; gameplay unchanged'
    # Never reuse contact shadows baked around the old low-poly furniture.
    site=bpy.data.objects['LM_ENV_MamakMaju'];festoon=bpy.data.objects['LM_ENV_MamakMaju_Festoon']
    for o in [site,festoon]:
        for attr in list(o.data.color_attributes):o.data.color_attributes.remove(attr)
    for m in site.data.materials:
        for node in list(m.node_tree.nodes):
            if node.name.startswith(('LM_Baked_Occlusion','LM_Occlusion_Tint')):m.node_tree.nodes.remove(node)
    sys.path.insert(0,str(ROOT/'art/blender/scripts'))
    from mamak_vertex_bake import bake_site
    bake_site(site,OUT)
    # Existing counter images remain packed; all new textures are fresh packed PNGs.
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    report={'version':2,'base_source_sha256':hashlib.sha256(BASE.read_bytes()).hexdigest(),'tabletop_sha256':hashlib.sha256((ROOT/'shared/mamak-tabletop.json').read_bytes()).hexdigest(),'tables':TABLES,'chairs':CHAIRS,'geometry_bounds':owners,'removed_old_vertices':removed,'detail_objects':len(CREATED),'rebaked_after_furniture':True}
    (OUT/'reports/source.json').write_text(json.dumps(report,indent=2)+'\n');export()

def export():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE));groups={}
    for o in list(bpy.data.collections['EXPORT'].all_objects):
        if not o.get('mr_detail'):continue
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        if o.type=='CURVE':
            # Preserve dense editable curves in .blend; use a smaller web tessellation.
            o.data.resolution_u=4;o.data.bevel_resolution=2;bpy.ops.object.convert(target='MESH');uv(o)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        groups.setdefault(o.data.materials[0].name,[]).append(o)
    for name,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name='LM_MR_'+name.split('|')[-1].strip().replace(' ','_')
        o['mr_detail']=True
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001);bm.to_mesh(o.data);bm.free()
        if not any(n.type=='TEX_IMAGE' for n in o.data.materials[0].node_tree.nodes):
            for layer in list(o.data.uv_layers):o.data.uv_layers.remove(layer)
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.collections['EXPORT'].all_objects:
        o.select_set(True)
        if o.type=='MESH':
            bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Web triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name)
            if not any(n.type=='TEX_IMAGE' for m in o.data.materials for n in m.node_tree.nodes):
                for layer in list(o.data.uv_layers):o.data.uv_layers.remove(layer)
    # Keep palette factors and COLOR_0 separate; legacy MixRGB is not a glTF input.
    for m in bpy.data.materials:
        if m.use_nodes and m.node_tree.nodes.get('LM_Occlusion_Tint'):
            socket=m.node_tree.nodes['Principled BSDF'].inputs['Base Color']
            for link in list(socket.links):m.node_tree.links.remove(link)
    bpy.ops.export_scene.gltf(filepath=str(EXPORT),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_tangents=True,export_extras=True,export_vertex_color='ACTIVE',export_cameras=False,export_lights=False)
    print('MAMAK REALISM EXPORTED',EXPORT.stat().st_size,flush=True)

def render():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE));s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=48;s.cycles.use_denoising=True
    s.render.resolution_x=1400;s.render.resolution_y=1000;s.render.resolution_percentage=100
    cam=s.camera;cam.data.type='PERSP';cam.data.lens=48
    views=[('01-dining-detail',(-26.3,2.6,55.4),(-29,1.0,52)),('02-tabletop',(-27.8,2.45,53.4),(-29,1.2,52)),('03-mamak-courtyard',(-18,12,74),(-29,2.6,43))]
    for name,pos,target in views:
        cam.location=coord(*pos);cam.rotation_euler=(Vector(coord(*target))-cam.location).to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/'renders'/f'{name}.png');bpy.ops.render.render(write_still=True);print('RENDER',name,flush=True)

if __name__=='__main__':
    if '--build' in ARGS:build()
    if '--export' in ARGS:export()
    if '--render' in ARGS:render()
