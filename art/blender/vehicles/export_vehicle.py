"""Rebuild EXPORT from hand-edited SOURCE in one vehicle .blend, into a fresh GLB.
blender -b --python export_vehicle.py -- --source car.blend --output new/car.glb
Then pack/validate with the fleet tooling before publishing a replacement.
"""
import argparse,sys
from pathlib import Path
import bpy
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
if a.output.exists() or a.output.suffix!='.glb':raise RuntimeError('Use a fresh .glb output path')
bpy.ops.wm.open_mainfile(filepath=str(a.source.resolve()))
source=bpy.data.collections.get('SOURCE');export=bpy.data.collections.get('EXPORT')
if source is None or export is None:raise RuntimeError('Expected SOURCE and EXPORT collections')
for o in list(export.objects):bpy.data.objects.remove(o,do_unlink=True)
source.hide_viewport=False
bpy.context.view_layer.update()
copies={}
for o in source.objects:
 c=o.copy()
 if o.data:c.data=o.data.copy()
 c.hide_viewport=False;c.hide_render=False;export.objects.link(c);c.hide_set(False);copies[o]=c
for o,c in copies.items():
 if o.parent:c.parent=copies[o.parent]
 if c.type=='EMPTY':c.name=o.name.removeprefix('SOURCE_').split('.')[0]
source.hide_viewport=True
buckets={}
for o in copies.values():
 if o.type=='MESH':buckets.setdefault((o.parent.name if o.parent else 'body',o.data.materials[0].name),[]).append(o)
for (parent,ma),objects in buckets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=parent+'__'+ma
bpy.ops.object.select_all(action='DESELECT')
for o in export.objects:o.select_set(True)
# Shared atlas images (LM_VEH_*) ship once in public/assets/textures/vehicles; the GLB keeps 4 px stand-ins.
for m in bpy.data.materials:
 for node in (m.node_tree.nodes if m.node_tree else []):
  if node.type=='TEX_IMAGE' and node.image and node.image.name.startswith('LM_VEH_'):
   stub=bpy.data.images.get('STUB_'+node.image.name) or bpy.data.images.new('STUB_'+node.image.name,4,4);stub.pack();node.image=stub
a.output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(a.output.resolve()),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=True,export_normals=True)
