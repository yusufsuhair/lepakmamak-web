"""Checks native reconstruction and the actual serialized glTF interchange file."""
import bpy
import json
import math
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/rembayung'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'rembayung.blend'))
scene=bpy.context.scene
meshes=[o for o in scene.objects if o.type=='MESH']
assert len(meshes)>100
assert len([o for o in scene.objects if o.type=='CAMERA'])==4
assert scene.unit_settings.system=='METRIC'
assert any(i.packed_file for i in bpy.data.images if 'wordmark' in i.name)
assert all(math.isfinite(c) for o in meshes for v in o.data.vertices for c in v.co)
assert all(len(o.data.polygons)>0 for o in meshes)
assert not any(o.location.z < -10 for o in meshes), 'Prototype leaked below site'
required=['Standing seam','Glazing','Central tree','Tables','Warm architectural']
assert all(any(n.lower() in c.name.lower() for c in scene.collection.children) for n in required)
raw=(OUT/'rembayung.glb').read_bytes()
magic,version,total=struct.unpack_from('<4sII',raw)
assert (magic,version,total)==(b'glTF',2,len(raw))
size,kind=struct.unpack_from('<II',raw,12)
assert kind==0x4E4F534A
doc=json.loads(raw[20:20+size])
assert doc['asset']['version']=='2.0'
assert len(doc['meshes'])>20
assert not any('uri' in b for b in doc['buffers']), 'GLB must be self contained'
assert all('bufferView' in i for i in doc.get('images',[]))
assert 'KHR_materials_transmission' in doc.get('extensionsUsed',[])
assert any('wordmark' in m.get('name','') and m.get('alphaMode') in ['BLEND','MASK'] for m in doc['materials'])
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
report={'native_mesh_objects':len(meshes),'glb_meshes':len(doc['meshes']),'glb_unique_triangles':triangles,'glb_bytes':len(raw),'embedded_images':len(doc.get('images',[])),'status':'PASS'}
# Round-trip import catches serialization failures beyond the header checks.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'rembayung.glb'))
assert len([o for o in bpy.context.scene.objects if o.type=='MESH'])>=len(meshes)
print('GLB ROUND-TRIP IMPORT PASS')
report['glb_round_trip_import']='PASS'
report['renders']={}
for filename,expected in [('01-exterior-night',(1400,1100)),('02-interior-rear',(1200,1400)),('03-interior-front',(1200,1400)),('04-exterior-aerial',(1400,1100))]:
    data=(OUT/'renders'/f'{filename}.png').read_bytes()
    assert data[:8]==b'\x89PNG\r\n\x1a\n'
    actual=struct.unpack_from('>II',data,16)
    assert actual==expected,(filename,actual,expected)
    report['renders'][filename]=list(actual)
(OUT/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
