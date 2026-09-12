import bpy,json,numpy as np
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
p=next((out/'source').rglob('*.fbx'));bpy.ops.import_scene.fbx(filepath=str(p))
report={'objects':[],'materials':[],'images':[]}
for o in bpy.context.scene.objects:
    report['objects'].append({'name':o.name,'type':o.type,'location':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale),'dimensions':list(o.dimensions),'verts':len(o.data.vertices) if o.type=='MESH' else 0,'faces':len(o.data.polygons) if o.type=='MESH' else 0,'uvs':[u.name for u in o.data.uv_layers] if o.type=='MESH' else [],'materials':[m.name for m in o.data.materials] if o.type=='MESH' else []})
for m in bpy.data.materials:
    report['materials'].append({'name':m.name,'nodes':[{'name':n.name,'type':n.type,'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None} for n in m.node_tree.nodes] if m.use_nodes else [],'links':[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in m.node_tree.links] if m.use_nodes else []})
for im in bpy.data.images:report['images'].append({'name':im.name,'size':list(im.size),'path':im.filepath,'colorspace':im.colorspace_settings.name})
(out/'inspection.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'imported-original.blend'))
