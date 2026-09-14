"""Saloma Link (Pintasan Saloma) at (55,-125), photographic pass: the sirih-junjung (betel-leaf)
canopy as a white steel diagrid tube of curved diamond members over a steel box-girder deck,
granite pavers down the middle with walk-on fritted glass panels either side, a frameless glass
balustrade under a continuous timber handrail with an LED strip beneath it, tapered concrete piers
and both stair approaches.

Night (src/saloma.ts): the diagrid material is the light show. Its members carry no emission in the
file; the runtime animates an emissive colour wave along the bridge in the shader (reduced motion:
a still gradient). 'Saloma deck glow' (handrail LEDs, fascia line, springing uplights) is lit at
night only.

Every gameplay number comes from src/bridge.ts (deck top 4.44, walk half width 2.2, six steps of
.58 from 24.8), so this is skin only: walking height, collision and the game's own SALOMA LINK
sign are untouched. The fifth pier the flat build drew at x=77 stood in the traffic lanes of the
x=76 road with no collider; the girder now spans the road clear. The four piers left stand where
world.ts puts their colliders.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_saloma.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Saloma.glb

Output: public/assets/models/environment/LM_ENV_Saloma.glb, node 'saloma' at the deck origin.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,join
import pbr_kit as kit
from pbr_kit import pbr,uv_metres,mesh,tube,strut
import landmark_textures as LX

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/saloma'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
T='saloma'
kit.setup(T,OUT/'textures',20260914)

# --- numbers that must agree with src/bridge.ts; changing them desyncs walking from the mesh
DECK_TOP=4.44;DECK_HALF=24;WALK_HALF=2.2
STEPS=6;STEP_RISE=.58;STEP_RUN=1.15;STEP_TOP_Y=3.875;RAMP_START=24.8
PIERS=[-22,-11,0,11]          # world x 33, 44, 55, 66: the piers world.ts gives colliders
SIGN=(0,6.05,-2.72,10)        # the game's canvas SALOMA LINK sign: x, y, z, width

def metal(m,v):
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=v;return m
# painted steel reads as a clean white at any distance a player sees it from: flat, so the members
# share vertices and carry no UVs
DIAGRID=metal(kit.hmat('Saloma diagrid','#f4f5f3',.32),.15)
STEEL=metal(kit.hmat('Saloma steel','#dcdfe0',.38),.2)
PAVE=pbr('Saloma walkway','paving','#ffffff',.8,1.2,source=LX)
FRIT=pbr('Saloma glass deck','frit','#ffffff',.14,.3,source=LX)
INOX=metal(pbr('Saloma stainless','brushed','#ffffff',.3,1.0,source=LX),.75)
TIMBER=pbr('Saloma timber handrail','wood','#b9814c',.5,.9)
CONC=pbr('Saloma concrete','concrete','#f2efe8',.9,3.0,source=LX)
GLASS=mat('Saloma balustrade glass',kit.srgb('#c7dcdc'),.04,alpha=.2,two_sided=True)
GLOW=mat('Saloma deck glow',kit.srgb('#ffdcaa'),.4,emit=2.0)

# ------------------------------------------------------------------ helpers
def prism_x(name,profile,x0,x1,m):
    """Extrude a closed (z,y) profile along game x."""
    n=len(profile);verts=[pt(x,y,z) for x in (x0,x1) for z,y in profile]
    faces=[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]+[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    return mesh(name,verts,faces,m,smooth=False,closed=True)

def prism_z(name,profile,z0,z1,m):
    """Extrude a closed (x,y) profile along game z."""
    n=len(profile);verts=[pt(x,y,z) for z in (z0,z1) for x,y in profile]
    faces=[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]+[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    return mesh(name,verts,faces,m,smooth=False,closed=True)

def column(name,x,z,y0,y1,r0,r1,m,sides=8):
    """Tapered faceted column from radius r0 at y0 to r1 at y1."""
    verts=[pt(x+r*math.cos(2*math.pi*(k+.5)/sides),y,z+r*math.sin(2*math.pi*(k+.5)/sides)) for y,r in ((y0,r0),(y1,r1)) for k in range(sides)]
    faces=[(k,(k+1)%sides,sides+(k+1)%sides,sides+k) for k in range(sides)]+[tuple(range(sides)),tuple(range(2*sides-1,sides-1,-1))]
    return mesh(name,verts,faces,m,smooth=True,closed=True)

def rod(name,points,r,m,sides=6):
    """Open tube through game points: the diagrid's ends meet at nodes, so no caps."""
    from mathutils import Vector
    P=[Vector(pt(*p)) for p in points];verts=[];faces=[]
    for i,p in enumerate(P):
        d=(P[min(i+1,len(P)-1)]-P[max(i-1,0)]).normalized();a=d.orthogonal().normalized();b=d.cross(a)
        verts+=[p+(a*math.cos(2*math.pi*k/sides)+b*math.sin(2*math.pi*k/sides))*r for k in range(sides)]
    faces=[(i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k) for i in range(len(P)-1) for k in range(sides)]
    return mesh(name,verts,faces,m,smooth=True,closed=False)

def quad(name,corners,m):
    return mesh(name,[pt(*c) for c in corners],[(0,1,2,3)],m,smooth=False)

# ------------------------------------------------------------------ canopy: the sirih-junjung diagrid
BAYS=18;X0=-21.0;BAY=42.0/BAYS;K=8
SPRING=DECK_TOP-.06;HALF_SPAN=2.64

def section(x):
    """Ridge height and half span of the pointed arch at x: tallest mid-span, easing lower toward
    the leaf tips over the last 7.5 m."""
    t=min(1.0,max(0.0,(21.0-abs(x))/7.5));t=t*t*(3-2*t)
    return 3.4+1.05*t,HALF_SPAN

def surf(u,s):
    """Canopy point at bay coordinate u (0..BAYS) and s across (-1 south spring, 0 ridge, 1 north).
    Each half is a circular arc centred beyond the axis, so the two meet in a pointed ridge."""
    x=X0+u*BAY;H,W=section(x)
    R=(H*H+W*W)/(2*W);c=W-R;phi=(1-abs(s))*math.acos(-c/R)
    return (x,SPRING+R*math.sin(phi),math.copysign(c+R*math.cos(phi),s if s else 1))

def canopy():
    o=[]
    for i in range(BAYS):
        for k in range(K):
            s0=-1+2*k/K;s1=s0+2/K;mid=surf(i+.5,(s0+s1)/2)
            # two families of curved members cross at every bay centre: the diamonds
            o.append(rod('diagrid',[surf(i,s0),mid,surf(i+1,s1)],.05,DIAGRID))
            o.append(rod('diagrid',[surf(i,s1),mid,surf(i+1,s0)],.05,DIAGRID))
    for s in (-1,1):
        o.append(tube('spring beam',[surf(u/2,s) for u in range(2*BAYS+1)],.085,STEEL,sides=8))
        for i in range(BAYS+1):
            x,y,z=surf(i,s)
            o.append(box('base shoe',x,y+.02,z,.26,.08,.2,INOX,T,0))
            o.append(box('springing uplight',x,y+.07,z-s*.12,.1,.03,.06,GLOW,T,0))
    o.append(tube('ridge chord',[surf(u/2,0) for u in range(2*BAYS+1)],.065,STEEL,sides=8))
    for i in range(0,BAYS+1,3):
        o.append(tube('arch rib',[surf(i,-1+j/8) for j in range(17)],.06,STEEL,sides=8))
    # leaf tips: the lattice gathers to a point past the last bay and flicks up into a spike
    for end,sign in ((0,-1),(BAYS,1)):
        tip=(sign*23.7,SPRING+2.55,0)
        for j in range(K+1):
            p=surf(end,-1+2*j/K);bend=((p[0]+tip[0])/2,(p[1]+tip[1])/2+.25*(1-abs(-1+2*j/K)),(p[2]+tip[2])/2*.9)
            o.append(rod('leaf tip',[p,bend,tip],.045,DIAGRID))
        o.append(tube('tip spike',[tip,(sign*25.3,SPRING+3.35,0)],[.075,.02],STEEL,sides=6))
    # the game's sign hangs on two stainless brackets off the north side of the lattice
    sx,sy,sz,sw=SIGN
    for x in (sx-sw*.38,sx+sw*.38):
        o.append(strut('sign bracket',(x,sy,sz+.03),(x,sy,surf((x-X0)/BAY,-.84)[2]),.05,INOX))
    return [p for p in o if p]

# ------------------------------------------------------------------ deck
def deck():
    o=[]
    # steel box girder: flat top under the walkway, a rounded fascia and a sloping soffit
    half=[(0,4.36),(2.62,4.36),(2.72,4.30),(2.76,4.16),(2.70,3.98),(1.85,3.55),(0,3.55)]
    ring=half+[(-z,y) for z,y in reversed(half[1:-1])]
    o.append(prism_x('box girder',ring,-DECK_HALF,DECK_HALF,STEEL))
    o.append(box('fascia light',0,4.0,2.73,2*DECK_HALF-.4,.03,.03,GLOW,T,0))
    o.append(box('fascia light',0,4.0,-2.73,2*DECK_HALF-.4,.03,.03,GLOW,T,0))
    L=2*DECK_HALF-.8
    o.append(box('walkway pavers',0,4.40,0,L,.08,2.5,PAVE,T,0))
    for s in (-1,1):
        o.append(box('glass deck',0,4.40,s*1.735,L,.08,.97,FRIT,T,0))
        for i in range(32):
            o.append(box('glass deck frame',-L/2+i*L/31,4.443,s*1.735,.05,.012,.97,INOX,T,0))
        o.append(box('glass deck edge',0,4.443,s*1.25,L,.012,.04,INOX,T,0))
        o.append(box('balustrade shoe',0,4.50,s*2.30,L,.2,.14,INOX,T,0))
        n=31
        for i in range(n):
            x=-L/2+(i+.5)*L/n
            o.append(box('balustrade glass',x,5.06,s*2.30,L/n-.03,1.0,.025,GLASS,T,0))
    return o

def handrails():
    """One continuous timber rail per side: down the east stair, across the deck, down the west."""
    o=[]
    def rail_y(ax):return 4.875-(ax-RAMP_START)*STEP_RISE/STEP_RUN
    top=5.60;xs=[31.3,RAMP_START]
    path=[(x,rail_y(x)) for x in xs]+[(23.9,top),(-23.9,top)]+[(-x,rail_y(x)) for x in reversed(xs)]
    for s in (-1,1):
        z=s*2.30
        o.append(tube('handrail',[(x,y,z) for x,y in path],.048,TIMBER,sides=8))
        o.append(tube('handrail light',[(x,y-.065,z-s*.035) for x,y in path],.012,GLOW,sides=4))
    return o

def piers():
    o=[]
    for bx in PIERS:
        for s in (-1,1):
            z=s*2.15
            o.append(column('pier',bx,z,0,3.22,.2,.29,CONC))
            o.append(box('pier plinth',bx,.05,z,.8,.1,.8,CONC,T,.02))
        o.append(prism_x('pier head',[(-2.5,3.55),(2.5,3.55),(2.5,3.42),(2.1,3.2),(-2.1,3.2),(-2.5,3.42)],bx-.34,bx+.34,CONC))
        o.append(box('bearing',bx,3.58,0,.5,.06,3.2,INOX,T,0))
    return o

def approaches():
    o=[]
    for s in (-1,1):
        # stepped concrete stair body, its treads 5 cm below the pavers laid on top
        prof=[(s*24.0,3.825),(s*24.225,3.825)]
        for i in range(STEPS):
            x0=RAMP_START+i*STEP_RUN-STEP_RUN/2;x1=x0+STEP_RUN;y=STEP_TOP_Y-i*STEP_RISE-.05
            prof+=[(s*x0,y),(s*x1,y)]
        prof+=[(s*31.225,.45),(s*24.0,3.35)]
        if s<0:prof=prof[::-1]
        # drop repeated points where one tread's end meets the next tread's start at the same x
        clean=[p for i,p in enumerate(prof) if i==0 or (abs(p[0]-prof[i-1][0])>1e-6 or abs(p[1]-prof[i-1][1])>1e-6)]
        o.append(prism_z('stair body',clean,-2.45,2.45,CONC))
        for i in range(STEPS):
            ax=RAMP_START+i*STEP_RUN;y=STEP_TOP_Y-i*STEP_RISE
            o.append(box('stair tread',s*ax,y-.025,0,STEP_RUN,.05,4.9,PAVE,T,0))
            o.append(box('stair nosing',s*(ax+STEP_RUN/2-.03),y-.02,0,.06,.045,4.9,INOX,T,0))
            for side in (-1,1):
                z=side*2.30;x0=s*(ax-STEP_RUN/2);x1=s*(ax+STEP_RUN/2)
                def ry(x):return 4.875-(abs(x)-RAMP_START)*STEP_RISE/STEP_RUN-.08
                o.append(quad('stair glass',[(x0,y,z),(x1,y,z),(x1,ry(x1),z),(x0,ry(x0),z)],GLASS))
                o.append(box('stair shoe',s*ax,y+.06,z,STEP_RUN,.12,.12,INOX,T,0))
        lx=s*(RAMP_START+(STEPS-1)*STEP_RUN+1.7)
        o.append(box('landing',lx,.15,0,2.6,.3,5.2,CONC,T,.02))
        o.append(box('landing pavers',lx,.325,0,2.5,.05,5.0,PAVE,T,0))
    return o

# ------------------------------------------------------------------ build / export
def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    for ob in deck()+handrails()+piers()+approaches()+canopy():
        ob.parent=e;uv_metres(ob)
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'saloma | {" + ".join(key)}')
        # vertices in the bridge's own frame: the runtime light show reads positions along the span
        bpy.ops.object.select_all(action='DESELECT');j.select_set(True);bpy.context.view_layer.objects.active=j
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        if not any('tile' in m for m in j.data.materials if m):
            for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Saloma.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
        export_image_format='WEBP',export_image_quality=82)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    report={'asset':'LM_ENV_Saloma','origin':[55,0,-125],'span':[2*DECK_HALF,5.52],'deckTop':DECK_TOP,'steps':STEPS,
            'piers':[55+p for p in PIERS],'canopy':{'bays':BAYS,'divisions':K,'members':2*BAYS*K},
            'textures':sorted(kit.IMAGES),'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('SALOMA WEB EXPORT',json.dumps(report),flush=True)

if __name__=='__main__':
    e=build();export(e)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'saloma.blend'))
