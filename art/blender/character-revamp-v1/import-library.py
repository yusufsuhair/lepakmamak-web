import bpy, os, json
from mathutils import Vector
ROOT=os.path.abspath('art/blender/generated/character-revamp-v1')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
records=json.load(open(ROOT+'/references/inventory.json'))['definitions']
for i,d in enumerate(records):
 before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=ROOT+'/references/'+d['id']+'.glb')
 created=set(bpy.data.objects)-before
 col=bpy.data.collections.new(d['id']);bpy.context.scene.collection.children.link(col)
 for obj in created:
  for c in list(obj.users_collection):c.objects.unlink(obj)
  col.objects.link(obj)
  if obj.parent is None:obj.location+=Vector(((i%8)*1.4,(i//8)*3.2,0))
bpy.context.scene['Provenance']='Exact original Three.js createPerson/applyAppearance exports. See references/inventory.json for source revision, colours and NPC call sites.'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/source/original-avatar-library.blend')
print('Imported all 24 original avatar combinations')
