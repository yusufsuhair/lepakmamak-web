"""The city's static street furniture: LM_ENV_Furniture.glb.

The boundary hedges (clipped kemuning on a concrete planter kerb) and the seawall with its granite
rock armour where the city meets the sea are built here, plus the photographic street furniture from
furniture_models.py - the two Jalur Gemilang flags, the street-sign frames, the courtyard bunting, the
KLCC plaza fountain, traffic signals at every junction, LRT feeder bus shelters and crossing bollards.
Skin only - no collision box, seat or coordinate moves. Everything carries PBR textures (pbr_kit),
embedded as WebP.

Zoo Negara Mini used to be built here too; it now has its own builder, build_zoo_negara.py.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_zoo.py -- --no-render
  then node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Furniture.glb

Output (public/assets/models/environment):
  LM_ENV_Furniture.glb node 'furniture', origin at the world origin (absolute coordinates)
"""
import bpy, bmesh, math, json, sys, random
from pathlib import Path
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import vloft,sphere
import pbr_kit as kit
import ground_textures as GT
import furniture_models as FM

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/zoo'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ONLY=[a.split('=',1)[1] for a in ARGS if a.startswith('--only=')]   # e.g. --only=Furniture
F='furniture'
HEDGE_PROFILE=[(-1.38,0),(1.38,0),(1.5,1.3),(1.34,1.95),(.75,2.2),(-.75,2.2),(-1.34,1.95),(-1.5,1.3)]

# ---------------------------------------------------------------- materials
# furniture
kit.setup('furniture',ROOT/'assets/ground/textures',20260914)
HEDGE=kit.pbr('Hedge leaves','hedge','#e8eedf',.72,1.5,strength=1.3,source=GT)
HEDGEB=kit.pbr('Hedge planter kerb','concrete','#bdbab2',.9,2.0,source=GT)
SEAWALL=kit.pbr('Seawall concrete','concrete','#d8d5cc',.9,2.0,source=GT)
ARMOUR=kit.pbr('Armour granite','granite','#a7abad',.86,1.6,strength=1.4)

# ---------------------------------------------------------------- lathe helpers

def shell(name,verts,faces,m,tag,smooth,strips,n,caps):
    """Mesh from ring verts. Winding is built outward, so no normal repair pass is needed."""
    mats=list(m) if isinstance(m,(list,tuple)) else [m]*max(strips,1)
    order=[]
    for mm in mats:
        if mm not in order:order.append(mm)
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob)
    for mm in order:ob.data.materials.append(mm)
    side=strips*n
    for f in me.polygons:
        if f.index<side:f.material_index=order.index(mats[f.index//n]);f.use_smooth=smooth
        else:f.material_index=order.index(mats[0] if caps[0] and f.index==side else mats[-1]);f.use_smooth=False
    ob['asset']=tag;return ob

def run(name,axis,fixed,a0,a1,profile,m,tag,step=6.0,vary=None,smooth=False):
    """Long extrusion along a world axis with a per-station profile. profile: [(across,y)].

    axis 'z' runs along +z with across = +x; axis 'x' runs along +x with across = -z, which
    is what keeps the ring winding (and therefore the normals) facing outward in both cases.
    """
    n=len(profile);verts=[];faces=[];mats=[]
    count=max(2,int(round(abs(a1-a0)/step))+1)
    for i in range(count):
        t=i/(count-1);station=a0+(a1-a0)*t
        prof=vary(station,profile) if vary else profile
        for across,y in prof:
            if axis=='z':verts.append(pt(fixed+across,y,station))
            else:verts.append(pt(station,y,fixed-across))
        if i:mats.append(m[i%len(m)] if isinstance(m,(list,tuple)) else m)
    for s in range(count-1):
        for k in range(n):
            a=s*n+k;b=s*n+(k+1)%n;faces.append((a,b,b+n,a+n))
    faces.append(tuple(range(n-1,-1,-1)));faces.append(tuple((count-1)*n+k for k in range(n)))
    return shell(name,verts,faces,mats if isinstance(m,(list,tuple)) else m,tag,smooth,count-1,n,(True,True))

def ellipse(cx,cy,rx,ry,n=20):
    """Counter-clockwise in Blender XY, which is what vloft needs for outward normals."""
    return [(cx+rx*math.cos(2*math.pi*i/n),cy+ry*math.sin(2*math.pi*i/n)) for i in range(n)]

def lathe(name,x,z,profile,m,tag,n=20):
    """Revolve a cross-section around a vertical axis. profile: [(height,radius)] walked from
    the outside, over the top and back down the inside, which is the order that keeps every
    face pointing out of the solid."""
    return vloft(name,[(h,ellipse(x,-z,r,r,n)) for h,r in profile],[m]*(len(profile)-1),tag)

# ================================================================ hedges and seawall

def hedge_vary(station,profile):
    """Uneven clipping: the crown dips and bulges along the run instead of a regular scallop."""
    k=.92+.06*noise.noise(Vector((station*.21,.5,1.7)))+.03*noise.noise(Vector((station*.7,2.5,.3)))
    wide=.95+.05*noise.noise(Vector((station*.33,4.1,2.2)))
    return [(a*wide,y*k) for a,y in profile]

def leafy(ob):
    """Clumps of lighter and darker growth, and the shaded, sparser foot of the hedge."""
    me=ob.data;attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT')
    for v in me.vertices:
        c=.9*(.84+.16*noise.noise(Vector((v.co.x*.35,v.co.y*.35,v.co.z*.6))))*(.62+.38*min(v.co.z/1.2,1))
        attr.data[v.index].color=(c,c,c,1)
    me.color_attributes.active_color=attr
    return ob

# Where the city meets the sea the hedge gives way to a Malaysian coastal bund: a battered
# concrete seawall with a coping, cast in 6 m panels, its sea face armoured with granite rock.
# The south edge runs the whole way (the sea is behind it from x -157.5 to the beach); on the
# east edge the wall takes over beside Pantai Senja and ends in a rock head at the waterline,
# where the beach's own boulders already sit. Across is measured inward (toward the city).
SEAWALL_FIXED=156;SEAWALL_EAST_FROM=125.5;SEAWALL_EAST_TO=150.0
WALL_PROFILE=[(-.30,-.55),(.85,-.55),(.85,.98),(.92,.98),(.92,1.08),(.86,1.14),(.26,1.14),(.20,1.08),(.20,.98),(.27,.98)]

def hedges():
    """Boundary hedges with a scalloped top; the two greens alternate so it reads clumpy. They
    stop at the seawall's city face on the south edge and where the beach wall begins."""
    o=[];inner=SEAWALL_FIXED-.8
    o.append(leafy(run('boundary hedge','z',-156,-157.5,inner,HEDGE_PROFILE,HEDGE,F,vary=hedge_vary,step=2.25,smooth=True)))
    o.append(box('hedge base',-156,.10,(inner-157.5)/2,3.1,.2,inner+157.5,HEDGEB,F,0))
    o.append(leafy(run('boundary hedge','z',156,-157.5,SEAWALL_EAST_FROM+.4,HEDGE_PROFILE,HEDGE,F,vary=hedge_vary,step=2.25,smooth=True)))
    o.append(box('hedge base',156,.10,(SEAWALL_EAST_FROM+.4-157.5)/2,3.1,.2,SEAWALL_EAST_FROM+.4+157.5,HEDGEB,F,0))
    o.append(leafy(run('boundary hedge','x',-156,-157.5,157.5,HEDGE_PROFILE,HEDGE,F,vary=hedge_vary,step=2.25,smooth=True)))
    o.append(box('hedge base',0,.10,-156,315,.2,3.1,HEDGEB,F,0))
    return o

def armour(rocks,x,y,z,r,R):
    """One angular granite armour stone: a tumbled, noise-pushed icosahedron, flat shaded like
    quarried rock and vertex-tinted wet and weedy below the tide mark. Faces wholly under the
    city ground are dropped: they could never be seen."""
    o=kit.rock('armour stone',x,y,z,r,ARMOUR,squash=R.uniform(.7,.95),sub=1,rough=.3,seed=R.randint(0,999))
    o.scale=(R.uniform(.9,1.35),R.uniform(.8,1.15),R.uniform(.85,1.0))
    o.rotation_euler=(R.uniform(-.6,.6),R.uniform(-.6,.6),R.uniform(0,6.28))
    mw=o.matrix_basis.copy();me=o.data;bm=bmesh.new();bm.from_mesh(me)
    floor=-.06 if z<159 else -.14
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if all((mw@v.co).z<floor for v in f.verts)],context='FACES')
    bm.to_mesh(me);bm.free();me.update()
    attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT');tone=R.uniform(.72,1.0)
    for v in me.vertices:
        wet=1-min(max(((mw@v.co).z-.02)/.32,0),1)
        c=.9*tone*(1-.55*wet)
        attr.data[v.index].color=(c*(1-.18*wet),c*(1-.04*wet),c*(1-.3*wet),1)
    me.color_attributes.active_color=attr
    for f in me.polygons:f.use_smooth=False
    rocks.append(o)

def weather(ob,paint=1.0):
    """Splash and grime darken a wall toward its foot (linear vertex colour, .9 headroom).
    `paint` scales it, so joint sealant can ride on the wall's own material."""
    me=ob.data;attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT');mw=ob.matrix_basis
    for v in me.vertices:
        t=min(max(((mw@v.co).z+.1)/1.1,0),1);c=.9*(.7+.3*t*t)*paint
        attr.data[v.index].color=(c,c,c*.98,1)
    me.color_attributes.active_color=attr
    return ob

def seawall():
    o=[];R=random.Random(20260914)
    o.append(weather(run('seawall','x',SEAWALL_FIXED,-157.5,97.0,WALL_PROFILE,SEAWALL,F,step=6.0)))
    # east: across runs +x (outward) on a z run, so mirror the profile and keep its winding
    east=[(-a,y) for a,y in WALL_PROFILE][::-1]
    o.append(weather(run('seawall','z',SEAWALL_FIXED,SEAWALL_EAST_FROM,SEAWALL_EAST_TO,east,SEAWALL,F,step=6.0)))
    # expansion joints every 6 m on the city face: the wall's own material, vertex-painted black,
    # so the joints, the wall and the end pier share one draw
    for x in [x0*6.0-157.5 for x0 in range(1,43)]:
        o.append(weather(box('seawall joint',x,.5,SEAWALL_FIXED-.86,.035,1.0,.03,SEAWALL,F,0),.12))
    for z in [SEAWALL_EAST_FROM+6*k for k in range(1,5)]:
        o.append(weather(box('seawall joint',SEAWALL_FIXED-.86,.5,z,.03,1.0,.035,SEAWALL,F,0),.12))
    o.append(weather(box('seawall pier',SEAWALL_FIXED-.35,.7,SEAWALL_EAST_FROM,1.5,1.4,.9,SEAWALL,F,.03)))
    # rock armour along the whole south face: two packed rows and a looser toe
    rocks=[]
    for row,(z0,y0,r0,r1,step,keep) in enumerate([(156.95,.3,.6,.9,1.1,1),(158.1,.0,.65,1.0,1.25,1),(159.25,-.22,.5,.8,1.5,.7)]):
        x=-157.2+R.uniform(0,step)
        while x<97.5-row*.8:
            if R.random()<keep:armour(rocks,x,y0+R.uniform(-.08,.1),z0+R.uniform(-.3,.3),R.uniform(r0,r1),R)
            x+=step*R.uniform(.8,1.15)
    # the rock head that closes the east wall at the waterline
    for i in range(34):
        z=R.uniform(SEAWALL_EAST_TO-4,160.5);x=SEAWALL_FIXED+R.uniform(.1,2.8)+max(0,z-156)*.25
        armour(rocks,x,.35-max(0,z-SEAWALL_EAST_TO)*.06+R.uniform(-.1,.1),z,R.uniform(.55,.95),R)
    return o+rocks

def furniture():
    return FM.furniture(F)+hedges()+seawall()

# ================================================================ build / export
SETS={'Furniture':('furniture',furniture)}

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    roots={}
    for name,(node,fn) in SETS.items():
        if ONLY and name not in ONLY:continue
        e=bpy.data.objects.new(node,None);s.collection.objects.link(e)
        for ob in fn():
            ob.parent=e
            if 'uv' not in ob:kit.uv_metres(ob)   # furniture_models.py lays its own UVs
        roots[name]=e
    return roots

def export(roots):
    report={}
    for name,e in roots.items():
        batches={}
        for ob in [c for c in e.children if c.type=='MESH']:
            batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            j=join(objs,f'{name} | {" + ".join(key)}')
            if not any('tile' in m or 'keep_uv' in m for m in j.data.materials if m):
                for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
        bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
        for c in e.children_recursive:c.select_set(True)   # prototypes keep their meshes under an empty
        path=PUBLIC/f'LM_ENV_{name}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
            export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
            export_image_format='WEBP',export_image_quality=82,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
        tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children_recursive if c.type=='MESH')
        report[name]={'asset':f'LM_ENV_{name}','node':e.name,'triangles':tris,'bytes':path.stat().st_size,
                      'draws':len([c for c in e.children_recursive if c.type=='MESH'])}
    if 'Furniture' in report:report['Furniture']['origin']=[0,0,0]
    manifest=OUT/'manifest.json';report={**(json.loads(manifest.read_text()) if manifest.exists() else {}),**report}
    manifest.write_text(json.dumps(report,indent=2)+'\n')
    print('ZOO WEB EXPORT',json.dumps(report),flush=True)

def render(roots):
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1500;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun)
    sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=500,location=(0,0,-.02));bpy.context.object.data.materials.append(mat('Preview ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=42
    views={
      'flag':('Furniture',(-19,6.0,63),(-12.6,6.6,54)),
      'bunting':('Furniture',(-30,7.0,60),(-29,6.2,49)),
      'fountain':('Furniture',(11,3.4,-79),(19,.9,-87)),
      'signpost':('Furniture',(-7,3.4,22),(-11,3.3,14)),
      'hedge':('Furniture',(-148,6,22),(-156,1.4,-8)),
    }
    for label,(which,eye,at) in views.items():
        for nm,e in roots.items():
            for c in e.children:c.hide_render=nm!=which
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{label}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    roots=build();export(roots)
    if '--no-render' not in ARGS:render(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'zoo.blend'))
