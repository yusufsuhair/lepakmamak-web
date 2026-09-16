"""Shared, lightweight cat rig. Breed proportions and coat palettes are set by the client."""
import bpy
import math
import os

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0

def material(name, color, roughness=.85):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    return mat

fur = material('Fur', (.6, .33, .12))
cream = material('Cream', (.85, .72, .52))
pink = material('Pink', (.55, .22, .23))
eye = material('Iris', (.3, .5, .23), .23)
black = material('Pupil', (.012, .018, .021), .25)
white = material('Glint', (.98, .97, .9), .12)

# Author in game coordinates (Y up, +Z forward), then convert to Blender Z up.
def xyz(value):
    x, y, z = value
    return (x, -z, y)

def pivot(name, parent=None, position=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = xyz(position)
    return obj

def ellipsoid(name, parent, position, size, mat, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = xyz(position)
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj

def ear_mesh(name, parent, width, height, depth, mat):
    vertices = [(-width, 0, -depth), (width, 0, -depth), (0, height, 0), (-width, 0, depth), (width, 0, depth)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([xyz(v) for v in vertices], [], [(0,1,2),(3,2,4),(0,2,3),(1,4,2),(0,3,4,1)])
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    bevel = obj.modifiers.new('Soft ear edges', 'BEVEL')
    bevel.width = .014
    bevel.segments = 2
    return obj

root = pivot('LM_PET_Cat_Rig')
root['lm_pet_version'] = 'cats-v2'
body = pivot('pet-body', root, (0, .47, 0))
ellipsoid('pet-body-shell', body, (0, 0, -.03), (.24, .25, .43), fur, 28, 16)
ellipsoid('pet-chest', body, (0, .025, .24), (.21, .23, .2), cream)
ellipsoid('pet-belly', body, (0, -.13, 0), (.19, .1, .32), cream)
head = pivot('pet-head', root, (0, .78, .38))
ellipsoid('pet-head-shell', head, (0, 0, 0), (.23, .22, .2), fur, 28, 16)
for side, label in [(-1, 'l'), (1, 'r')]:
    ellipsoid('pet-cheek-'+label, head, (side*.08, -.075, .17), (.085, .065, .065), cream)
    iris = pivot('pet-eye-'+label, head, (side*.103, .018, .171))
    ellipsoid('pet-eye-iris-'+label, iris, (0,0,0), (.058,.062,.035), eye)
    ellipsoid('pet-eye-pupil-'+label, iris, (0,0,.028), (.019,.049,.012), black, 16, 10)
    ellipsoid('pet-eye-glint-'+label, iris, (-.015,.025,.039), (.012,.014,.008), white, 12, 8)
    ear = pivot('pet-ear-'+label, head, (side*.14, .14, -.015))
    ear_mesh('pet-ear-shell-'+label, ear, .093, .20, .045, fur)
    inner = ear_mesh('pet-ear-inner-'+label, ear, .052, .135, .006, pink)
    inner.location = xyz((0,.02,.047))
    tuft = ear_mesh('pet-ear-tuft-'+label, ear, .02, .075, .013, fur)
    tuft.location = xyz((0,.15,0))
    for i in range(3):
        whisker = ellipsoid(f'pet-whisker-{label}-{i}', head, (side*.17,-.07+i*.023,.203), (.12,.003,.003), cream, 12, 6)
        whisker.rotation_euler.y = side*(i-1)*.12
ellipsoid('pet-nose', head, (0,-.045,.229), (.028,.021,.016), pink, 16, 10)
for x, side in [(-.16,'l'),(.16,'r')]:
    for z, end in [(-.27,'b'),(.25,'f')]:
        leg = pivot('pet-leg-'+end+side, root, (x,.4,z))
        ellipsoid('pet-leg-shin-'+end+side, leg, (0,-.15,0), (.069,.19,.078), fur)
        ellipsoid('pet-paw-shell-'+end+side, leg, (0,-.34,.033), (.079,.055,.108), cream)
tail = pivot('pet-tail-base', root, (0,.51,-.37))
curve = bpy.data.curves.new('Cat tail', 'CURVE')
curve.dimensions = '3D'
curve.bevel_depth = .054
curve.bevel_resolution = 3
curve.resolution_u = 10
spline = curve.splines.new('BEZIER')
spline.bezier_points.add(4)
for i, point in enumerate(spline.bezier_points):
    point.co = xyz((0,.03+i*.058,-i*.12))
    point.handle_left_type = point.handle_right_type = 'AUTO'
    point.radius = 1-i*.13
tail_mesh = bpy.data.objects.new('pet-tail-segment',curve)
bpy.context.scene.collection.objects.link(tail_mesh)
tail_mesh.parent = tail
curve.materials.append(fur)
bpy.ops.object.select_all(action='DESELECT')
tail_mesh.select_set(True)
bpy.context.view_layer.objects.active = tail_mesh
bpy.ops.object.convert(target='MESH')
ellipsoid('pet-tail-segment-tip',tail,(0,.262,-.48),(.026,.026,.026),fur,12,8)
# Reusable fur silhouette pieces; hidden for short-haired breeds in the client.
for side in [-1,1]:
    ellipsoid(f'pet-ruff-{side}-0', body, (side*.15, .015, .25), (.105,.23,.19), fur)
    ellipsoid(f'pet-fluff-{side}-0', body, (side*.19,-.015,-.13), (.10,.20,.30), fur)

base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
blend_dir = os.path.join(base,'assets','pets')
output_dir = os.path.join(base,'public','assets','models','pets')
os.makedirs(blend_dir, exist_ok=True)
os.makedirs(output_dir, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir,'LM_PET_Cats.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(output_dir,'LM_PET_Cats.glb'), export_format='GLB', export_yup=True, export_extras=True)
print('Exported cats-v2 shared breed rig')
