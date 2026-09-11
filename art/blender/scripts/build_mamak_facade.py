"""Independent, additive Mamak façade kit. Never rewrites the full-site source.

Blender -b --python-exit-code 1 --python art/blender/scripts/build_mamak_facade.py -- --out /fresh/output
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lm_pipeline import setup_template, export_collection, save_source, write_json, sha256, point_at

ROOT = Path(__file__).resolve().parents[3]
ASSET = 'LM_ENV_MamakFacade'
ORIGIN = (-29, 3.555, 30)
BUDGET = dict(max_triangles=12000, max_materials=4, max_meshes=6,
              max_draw_calls=6, max_glb_bytes=700000, max_textures=0)
PARTS = []


def coord(x, y, z):
    return (x + 29, 30 - z, y - ORIGIN[1])


def finish(obj, name, mat, bevel=0, lamp=False):
    obj.name = 'LM_Facade_' + name
    obj.data.materials.append(bpy.data.materials[mat])
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    bpy.data.collections['EXPORT'].objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if obj.type != 'MESH':
        bpy.ops.object.convert(target='MESH')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bevel:
        mod = obj.modifiers.new('Edge', 'BEVEL')
        mod.width, mod.segments = bevel, 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj['lm_lamp'] = lamp
    PARTS.append(obj)
    obj.select_set(False)
    return obj


def box(name, x, y, z, w, h, d, mat='LM_Metal_Dark', bevel=.015, lamp=False):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_cube_add(size=1, location=coord(x, y, z))
    obj = bpy.context.object
    obj.scale = (w, d, h)
    return finish(obj, name, mat, min(bevel, min(w, h, d) / 4), lamp)


def label(name, text, x, y, z, width, height):
    bpy.ops.object.select_all(action='DESELECT')
    curve = bpy.data.curves.new('LM_Facade_' + name, 'FONT')
    curve.body, curve.align_x, curve.align_y = text, 'CENTER', 'CENTER'
    curve.resolution_u, curve.extrude, curve.bevel_depth = 2, 0, 0
    obj = bpy.data.objects.new('LM_Facade_' + name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location, obj.rotation_euler = coord(x, y, z), (math.pi / 2, 0, 0)
    bpy.context.view_layer.update()
    bounds = list(obj.bound_box)
    scale = min(width / (max(p[0] for p in bounds)-min(p[0] for p in bounds)),
                height / (max(p[1] for p in bounds)-min(p[1] for p in bounds)))
    obj.scale = (scale, scale, scale)
    finish(obj, name, 'LM_Wall_Cream')


def build():
    scene = setup_template()
    # Existing sign text ends at world z=42.50. Frame stays outside its face.
    for y in (3.60, 4.86):
        box('SignRail', -29, y, 42.54, 18.30, .09, .16, 'LM_Wood_Warm')
    for x in (-38.10, -19.90):
        box('SignStile', x, 4.23, 42.54, .09, 1.26, .16, 'LM_Wood_Warm')
    box('SignCap', -29, 4.96, 42.47, 18.52, .07, .45)
    for x, text in ((-41.65, 'ROTI CANAI'), (-16.35, 'TEH TARIK')):
        box('PlaqueRim', x, 4.23, 42.48, 4.10, 1.12, .20, 'LM_Wood_Warm')
        box('PlaqueFace', x, 4.23, 42.60, 3.94, .97, .08, 'LM_Leaf_Green')
        label('PlaqueTitle', text, x, 4.40, 42.66, 3.5, .30)
        label('PlaqueSubtitle', 'BUKA 24 JAM', x, 4.04, 42.66, 2.5, .18)
    # Gutter behind signs; vertical drops stay against existing building columns,
    # never inside the courtyard. Everything is above player head height.
    box('Gutter', -29, 4.70, 42.18, 31.4, .14, .23)
    for x in (-44.55, -13.45):
        box('AwningEndCap', x, 4.61, 38.35, .10, .19, 7.90, 'LM_Wood_Warm')
    for x in (-44, -34, -24, -14):
        box('PillarCapital', x, 8.67, 34.88, .66, .21, .38, 'LM_Wood_Warm')
        box('PillarBand', x, 5.39, 34.86, .48, .11, .30, 'LM_Wood_Warm')
    for x in (-39, -29, -19):
        box('WindowHood', x, 8.02, 34.98, 5.42, .10, .64, 'LM_Wood_Warm')
        for sx in (-2.30, 2.30):
            for y in (6.00, 6.36, 6.72, 7.08, 7.44, 7.80):
                box('ShutterSlat', x+sx, y, 34.86, .28, .13, .13, 'LM_Leaf_Green', .007)
    # Four batched light housings plus isolated diffusers, no exported point lights.
    for x in (-41.65, -34, -24, -16.35):
        box('LampBracket', x, 5.00, 42.14, .10, .64, .14)
        box('LampArm', x, 5.30, 42.42, .10, .08, .58)
        box('LampHood', x, 5.20, 42.68, .64, .16, .39)
        box('LampLens', x, 5.105, 42.68, .51, .028, .28, 'LM_Wall_Cream', .005, True)
    # Join per material/behaviour: at most five draws, source parts remain vertex groups.
    batches = {}
    for obj in PARTS:
        batches.setdefault((obj.data.materials[0].name, bool(obj['lm_lamp'])), []).append(obj)
    for (mat, lamp), selected in sorted(batches.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in selected:
            obj.vertex_groups.new(name=obj.name).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
            obj.select_set(True)
        bpy.context.view_layer.objects.active = selected[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = ASSET + ('_Lamps' if lamp else '_' + mat.removeprefix('LM_'))
        obj.data.name = obj.name + '_Mesh'
        layer = obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
        for polygon in obj.data.polygons:
            axes = sorted(range(3), key=lambda a: abs(polygon.normal[a]))[:2]
            for li in polygon.loop_indices:
                v = obj.data.vertices[obj.data.loops[li].vertex_index].co
                layer.data[li].uv = (v[axes[0]], v[axes[1]])
        obj['lm_origin_world'] = list(ORIGIN)
        obj['lm_version'] = 1
        obj['lm_collision'] = 'none; overhead additive detail only'
        obj['lm_lamp_count'] = 4 if lamp else 0
        assert min(v.co.z + ORIGIN[1] for v in obj.data.vertices) > 3.5
    return scene


def context_and_cameras(scene):
    source = ROOT/'assets/mamak-realism/mamak-realism.blend'
    with bpy.data.libraries.load(str(source), link=False) as (data, target):
        target.collections = ['EXPORT']
    for collection in target.collections:
        collection.name = 'LM_REFERENCE_AcceptedMamak'
        instance = bpy.data.objects.new('LM_REFERENCE_MamakInstance', None)
        instance.instance_type = 'COLLECTION'
        instance.instance_collection = collection
        instance.location.z = -ORIGIN[1]
        bpy.data.collections['REFERENCE'].objects.link(instance)
    bpy.data.objects['LM_PREVIEW_Ground'].location.z = -ORIGIN[1]
    scene.render.engine = 'CYCLES'
    scene.cycles.device, scene.cycles.samples, scene.cycles.seed = 'CPU', 24, 17
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1200, 800
    for obj in bpy.data.collections['LIGHTING_PREVIEW'].objects:
        if obj.type == 'LIGHT':
            obj.data.energy *= 80
            obj.data.size = 18
            obj.location *= 8
            point_at(obj, coord(-29, 4, 40))
    views = {'Front': ((-29, 8, 71), (-29, 5, 38), 37),
             'Iso': ((-5, 16, 65), (-29, 4, 38), 39),
             'Right': ((-12, 8, 55), (-21, 4.5, 40), 21)}
    for name, (eye, target, scale) in views.items():
        camera = bpy.data.objects[f'LM_PREVIEW_{name}_Camera']
        camera.location = coord(*eye)
        camera.data.ortho_scale = scale
        point_at(camera, coord(*target))
    scene.camera = bpy.data.objects['LM_PREVIEW_Iso_Camera']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--source', type=Path, help='Re-export an edited source without rebuilding geometry')
    parser.add_argument('--skip-renders', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.out.mkdir(parents=True, exist_ok=False)
    if args.source:
        bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
        scene = bpy.context.scene
    else:
        scene = build()
    glb = args.out/(ASSET+'.glb')
    result = export_collection(glb, budget_overrides=BUDGET)
    write_json(args.out/'validation.json', result)
    if not args.source:
        context_and_cameras(scene)
    save_source(args.out/(ASSET+'.blend'))
    write_json(args.out/'manifest.json', dict(asset=ASSET, version=1, origin_world=list(ORIGIN),
        glb_sha256=sha256(glb), source_sha256=sha256(args.out/(ASSET+'.blend')),
        baseline_sha256=sha256(ROOT/'public/assets/models/environment/LM_ENV_MamakMaju_Realism.glb'),
        placement=dict(x=-29,y=ORIGIN[1],z=30,yaw=0,scale=1), collision='none', lamp_count=4,
        minimum_world_height=3.5, budgets=BUDGET))
    if not args.skip_renders:
        for view in ('Front','Iso','Right'):
            scene.camera = bpy.data.objects[f'LM_PREVIEW_{view}_Camera']
            scene.render.filepath = str(args.out/(view.lower()+'.png'))
            bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
