"""City ground textures: worn asphalt, herringbone pavers, kerb concrete, cow-grass verge and a
macro variation field, written as WebP for the world-space ground shader in src/ground.ts.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_ground.py

Outputs public/assets/textures/ground/<name>-color.webp (sRGB) and <name>-normal.webp
(Non-Color), plus macro.webp. PNG copies for review go to assets/ground/textures/ (ignored).
Bump GROUND_TEXTURES in src/ground.ts after a rebuild.
"""
import bpy, sys, json
import numpy as np
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import ground_textures as GT

ROOT=Path(__file__).resolve().parents[2]
RUNTIME=ROOT/'public/assets/textures/ground';RUNTIME.mkdir(parents=True,exist_ok=True)
REVIEW=ROOT/'assets/ground/textures';REVIEW.mkdir(parents=True,exist_ok=True)

def save(name,arr,data,quality):
    h,w=arr.shape[:2];im=bpy.data.images.new(name,w,h)
    if data:im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(np.flipud(np.concatenate([arr,np.ones((h,w,1))],-1)).astype(np.float32).ravel())
    im.file_format='WEBP';im.save(filepath=str(RUNTIME/f'{name}.webp'),quality=quality)
    im.file_format='PNG';im.save(filepath=str(REVIEW/f'{name}.png'))
    bpy.data.images.remove(im)

report={}
only=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for kind,size in (('asphalt',1024),('pavers',1024),('concrete',512),('grass',1024)):
    if only and kind not in only:continue
    col,nrm=getattr(GT,kind)(size)
    save(f'{kind}-color',col,False,86);save(f'{kind}-normal',nrm,True,90)
if not only or 'macro' in only:save('macro',GT.macro(512),True,90)
for f in sorted(RUNTIME.glob('*.webp')):report[f.name]=f.stat().st_size
print('GROUND TEXTURES',json.dumps(report),flush=True)
