"""Build a game-specific export from the preserved detailed Blender source.

No render-stage scenery, lamps or cameras; small repeating floor texture; reduced
foliage / chair weaving; material batches; collision bounds from authored furniture.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/models/environment'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/rembayung/rembayung.blend'))
scene=bpy.context.scene
profile={'version':1,'origin':{'x':-136,'y':.12,'z':125},'width':18,'depth':34,'eave':7.5,'ridge':14.1,
         'mezzanineHeight':4.06,'furniture':[],'asset':'/assets/models/environment/LM_ENV_Rembayung.glb?v=rembayung-v1'}

for ob in list(scene.objects):
    if ob.name.startswith(('Dining table','Dining chair')):
        bounds=[ob.matrix_world@Vector(v) for v in ob.bound_box]
        mins=[min(v[i] for v in bounds) for i in range(3)]
        maxs=[max(v[i] for v in bounds) for i in range(3)]
        profile['furniture'].append({'id':ob.name,'x':round((mins[0]+maxs[0])/2,4),'d':round((mins[1]+maxs[1])/2,4),
                                    'hx':round((maxs[0]-mins[0])/2,4),'hd':round((maxs[1]-mins[1])/2,4),
                                    'floor':4.06 if mins[2]>3 else 0,'top':round(maxs[2],4)})
    if ob.type!='MESH' or any(c.name.startswith('11 |') for c in ob.users_collection) or ob.name.startswith('Table settings'):
        bpy.data.objects.remove(ob,do_unlink=True)

# Strip procedural render-only shading to portable PBR, retaining the actual logo.
for mat in list(bpy.data.materials):
    if not mat.use_nodes:continue
    p=mat.node_tree.nodes.get('Principled BSDF')
    if not p:continue
    is_logo='wordmark' in mat.name
    if not is_logo:
        for link in list(mat.node_tree.links):
            if link.to_node==p and link.to_socket.name in ['Base Color','Normal']:
                mat.node_tree.links.remove(link)
    if 'architectural glass' in mat.name:
        # One transparent pass, no refraction render targets in the city renderer.
        p.inputs['Transmission Weight'].default_value=0
        p.inputs['Alpha'].default_value=.10
        p.inputs['Base Color'].default_value=(.28,.40,.42,1)
        p.inputs['Roughness'].default_value=.22
    if 'timber ceiling' in mat.name:
        p.inputs['Base Color'].default_value=(.44,.22,.065,1)
        p.inputs['Emission Color'].default_value=(.30,.10,.016,1)
        p.inputs['Emission Strength'].default_value=.35
    if 'Honey brown' in mat.name:p.inputs['Base Color'].default_value=(.30,.12,.028,1)
    if 'Polished wood' in mat.name:p.inputs['Base Color'].default_value=(.43,.19,.048,1)
    if 'Natural timber' in mat.name:p.inputs['Base Color'].default_value=(.55,.33,.12,1)
    if 'plaster' in mat.name:p.inputs['Base Color'].default_value=(.75,.73,.66,1)
    if 'concrete' in mat.name:p.inputs['Base Color'].default_value=(.33,.36,.33,1)

# Replace thousands of separate tile boxes with three UV-mapped floor bands.
old=bpy.data.objects.get('Floor slab, concrete walkways & individual terracotta tiles')
bpy.data.objects.remove(old,do_unlink=True)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,17,-.18))
slab=bpy.context.object;slab.name='Foundation and concrete aisles';slab.dimensions=(18,34,.32)
slab.data.materials.append(bpy.data.materials['Mottled polished concrete'])

size=256;pixels=[];rng=random.Random(34018)
tile_colors=[(.60,.29,.16),(.63,.31,.18),(.58,.26,.14),(.65,.32,.18)]
for y in range(size):
    for x in range(size):
        if x%128<2 or y%128<2:c=(.73,.64,.48)
        else:
            noise=rng.uniform(-.018,.018);c=tuple(v+noise for v in tile_colors[(x//128)+2*(y//128)])
        pixels.extend((*c,1))
image=bpy.data.images.new('Rembayung terracotta repeat',width=size,height=size)
image.pixels.foreach_set(pixels);image.pack()
mat=bpy.data.materials.new('Terracotta tile · web texture');mat.use_nodes=True
p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.66
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
mat.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
verts=[];faces=[]
for a,b in [(-9,-4.65),(-3,3),(4.65,9)]:
    k=len(verts);verts.extend([(a,0,.001),(b,0,.001),(b,29.15,.001),(a,29.15,.001)]);faces.append((k,k+1,k+2,k+3))
mesh=bpy.data.meshes.new('Terracotta strips');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat)
uv=mesh.uv_layers.new(name='Tiled UV')
for poly in mesh.polygons:
    for li in poly.loop_indices:
        v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x/.9,v.y/.89)
ob=bpy.data.objects.new('Terracotta strips',mesh);scene.collection.objects.link(ob)

# Reduce tiny botanical and weaving geometry once per shared source mesh.
seen=set()
for ob in list(scene.objects):
    if ob.type!='MESH' or ob.data in seen:continue
    seen.add(ob.data)
    ratio=.34 if 'Central indoor tree' in ob.name else .55 if 'Tropical broadleaf' in ob.name else .32 if 'Dining chair' in ob.name else .65 if 'Timber pergolas' in ob.name else 1
    if ratio<1:
        print('REDUCING',ob.name,flush=True)
        linked=[o for o in scene.objects if o.type=='MESH' and o.data==ob.data]
        ob.data=ob.data.copy()
        mod=ob.modifiers.new('Web detail reduction','DECIMATE');mod.ratio=ratio
        bpy.context.view_layer.objects.active=ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
        reduced=ob.data
        seen.add(reduced)
        for other in linked:other.data=reduced
        ob.modifiers.clear()

# Collapse opaque batches by material; keep UVs for signage and floor.
batches={}
for ob in list(scene.objects):
    if ob.type!='MESH':continue
    # Keep shared chair meshes as GLB instances, then instance their draws in Three.js.
    if ob.name.startswith('Dining chair'):continue
    mesh=ob.data;matrix=ob.matrix_world.copy()
    uv=mesh.uv_layers.active
    for poly in mesh.polygons:
        material=mesh.materials[poly.material_index]
        group=batches.setdefault(material.name,{'material':material,'v':[],'f':[],'uv':[]})
        face=[];coords=[]
        for li in poly.loop_indices:
            face.append(len(group['v']));group['v'].append(tuple(matrix@mesh.vertices[mesh.loops[li].vertex_index].co))
            coords.append(tuple(uv.data[li].uv) if uv else (0,0))
        group['f'].append(face);group['uv'].append(coords)
    bpy.data.objects.remove(ob,do_unlink=True)

for name,data in batches.items():
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(data['v'],[],data['f']);mesh.materials.append(data['material'])
    uv=mesh.uv_layers.new(name='UVMap')
    for poly,coords in zip(mesh.polygons,data['uv']):
        for li,coord in zip(poly.loop_indices,coords):uv.data[li].uv=coord
    ob=bpy.data.objects.new('Rembayung | '+name,mesh);scene.collection.objects.link(ob)
    ob['source']='Rembayung photographic reconstruction'
    ob['lm_version']=1
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'LM_ENV_Rembayung.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
profile['materialBatches']=len(batches)
(ROOT/'shared/rembayung.json').write_text(json.dumps(profile,indent=2)+'\n')
print('REMBAYUNG WEB EXPORT COMPLETE',len(batches),'material batches')
