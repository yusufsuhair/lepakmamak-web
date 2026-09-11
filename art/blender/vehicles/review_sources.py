"""Verify editable/export collections and render every saved vehicle studio scene."""
import argparse,json,sys
from pathlib import Path
import bpy
p=argparse.ArgumentParser();p.add_argument('--directory',type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=a.directory.resolve();reports=[]
for source in sorted((root/'source').glob('*.blend')):
 bpy.ops.wm.open_mainfile(filepath=str(source))
 authored=bpy.data.collections['SOURCE'];export=bpy.data.collections['EXPORT']
 assert authored.hide_render and len(authored.objects)>60
 assert all(o.type in ['MESH','EMPTY'] for o in export.objects)
 wheels=[]
 for name in ['wheel_FL','wheel_FR','wheel_RL','wheel_RR']:
  o=export.objects[name];assert o.parent.name==name.replace('wheel_','steer_')
  assert o.location.length<.00001
  wheels.append(list(o.matrix_world.translation))
 assert len({tuple(round(v,3) for v in pos) for pos in wheels})==4
 assert export.objects.get('chassis')
 scene=bpy.context.scene;scene.cycles.samples=16
 preview=root/'previews'/f'{source.stem}.png';scene.render.filepath=str(preview)
 if not preview.exists() or preview.stat().st_mtime<source.stat().st_mtime:
  bpy.ops.render.render(write_still=True)
 reports.append(dict(style=source.stem,sourceObjects=len(authored.objects),exportObjects=len(export.objects),wheelCenters=wheels))
 (root/'reports'/'editable-verification.json').write_text(json.dumps(reports,indent=2)+'\n')
 print('REVIEW_COMPLETE',source.stem,flush=True)
