"""PETRONAS Twin Towers for the KLCC podium at (0,0,-122), photographic pass.

  * towers: the eight-point star plan with a round lobe in each notch, a stainless sunshade
    ribbon on every floor over blue-green laminated glass, the real setbacks (levels 60, 73, 82
    and 85 of 88) each with a crown rim, three stepped crown tiers above the roof, and the
    pinnacle: finned drum, ring stack, ring ball, spire, mast ball and needle
  * skybridge: the double-decker at levels 41-42 on its two-hinged inverted-V arch legs
  * Suria podiums: granite, glass curtain walls with stainless fins, cantilevered entrance canopies
  * materials: one curtain-wall texture set (klcc_textures.py) laid out in world metres so floors
    meet the ribbons and a mullion sits on every star point; brushed stainless; granite from
    pbr_textures.py. The curtain wall's emissive texture is a night mask (lit interiors, floodlit
    steel) that src/klcc.ts switches with the weather's night.

Gameplay numbers are kept, not invented: the roof is KLCC_LIFT_TOP (76.5, src/world.ts), the lift
shafts stand clear of every mesh (checked below and in tests/klcc-towers.spec.ts), and the
podiums stay inside their 21 x 24 collision boxes below head height. The lifts stay procedural.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_klcc.py

Output: public/assets/models/environment/LM_ENV_KLCC.glb, node 'klcc' at the pad origin.
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,join,finish

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/klcc'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
T='klcc'

TOWER_X=22;FLOOR=1.75;BASE=3;FLOORS=42
# (first floor, square half-width): the real setbacks at levels 60, 73, 82 and 85 of 88.
TIERS=[(0,6.56),(28,5.6),(34,4.7),(39,3.9)]
ROOF=BASE+FLOORS*FLOOR                       # 76.5 = KLCC_LIFT_TOP, where the lift stops
LIFT_Z=14.2                                  # shafts at world z -107.8, x = +-TOWER_X
CROWN=[(3.25,2,1.25),(2.65,2,1.1),(2.05,2,1.0)]   # (half-width, floors, floor height) above the roof
RIB_OUT,RIB_RISE=.3,.14                     # sunshade ribbon: projection and sloped top
PANE=.78                                     # curtain-wall module round the plan, metres

def star(a,k=2):
    """Eight-point star (two squares) with a round bay in each notch, counter-clockwise."""
    R=a*math.sqrt(2);rc=.30*a;N=(a,a*(math.sqrt(2)-1));pts=[]
    for i in range(8):
        c,s=math.cos(i*math.pi/4),math.sin(i*math.pi/4)
        rot=lambda x,y:(x*c-y*s,x*s+y*c)
        pts.append(rot(R,0))
        for j in range(k+2):
            ang=math.radians(-45+135*j/(k+1));pts.append(rot(N[0]+rc*math.cos(ang),N[1]+rc*math.sin(ang)))
    return pts

def vloft(name,sections,mats,tag,cap=True):
    """Vertical loft: sections [(height,[(x,y)...])], mats one material per strip. Profile y is game -z."""
    verts=[];faces=[];n=len(sections[0][1])
    for h,prof in sections:
        assert len(prof)==n,name
        for x,y in prof:verts.append((x,y,h))
    for s in range(len(sections)-1):
        for i in range(n):
            a=s*n+i;b=s*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    if cap:faces.append(tuple((len(sections)-1)*n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob)
    order=[];
    for m in mats+[mats[-1]]:
        if m not in order:order.append(m)
    for m in order:ob.data.materials.append(m)
    strips=len(sections)-1
    for f in ob.data.polygons:
        strip=min(f.index//n,strips-1);f.material_index=order.index(mats[strip] if f.index<strips*n else mats[-1])
        f.use_smooth=f.index<strips*n
    ob['asset']=tag;return ob

def sphere(name,x,y,z,r,m,tag,segments=18,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=r,location=pt(x,y,z));o=bpy.context.object
    finish(o,name,m,tag)
    for f in o.data.polygons:f.use_smooth=True
    return o

# ------------------------------------------------------------------ materials (built in build())
FACADE=STEEL=PINNACLE=STONE=None

def materials():
    global FACADE,STEEL,PINNACLE,STONE
    import pbr_kit as kit, klcc_textures as KT
    kit.setup(T,OUT/'textures',20260914)
    STEEL=kit.pbr('KLCC stainless','stainless','#ffffff',.3,2.0,source=KT)
    PINNACLE=kit.pbr('KLCC pinnacle steel','stainless','#ffffff',.24,1.2,source=KT)
    for m in (STEEL,PINNACLE):m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=1
    STONE=kit.pbr('KLCC podium granite','cladding','#ffffff',.42,2.4,source=KT)
    col,nrm,orm,night=KT.curtain_wall()
    night=(night[0::2,0::2]+night[1::2,0::2]+night[0::2,1::2]+night[1::2,1::2])/4
    FACADE=bpy.data.materials.new('KLCC curtain wall');FACADE.use_nodes=True;FACADE.use_backface_culling=True;nt=FACADE.node_tree;p=nt.nodes['Principled BSDF']
    def tex(name,arr,data):
        n=nt.nodes.new('ShaderNodeTexImage');n.image=kit.image(name,arr,data);return n
    nt.links.new(tex('curtain_color',col,False).outputs['Color'],p.inputs['Base Color'])
    sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(tex('curtain_orm',orm,True).outputs['Color'],sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'],p.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
    nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(tex('curtain_normal',nrm,True).outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    nt.links.new(tex('curtain_night',night,False).outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=1
    FACADE['panes']=KT.PANES;FACADE['floors']=KT.FLOORS

# ------------------------------------------------------------------ towers
def plan(a,k=3):
    """star() with every point's position along its sector: tips at whole numbers 0..8, so a
    mullion can land on each point. The first tip repeats at 8 to close the UV seam."""
    R=a*math.sqrt(2);rc=.30*a;N=(a,a*(math.sqrt(2)-1));out=[]
    sector=[(R,0)]+[(N[0]+rc*math.cos(math.radians(-45+135*j/(k+1))),N[1]+rc*math.sin(math.radians(-45+135*j/(k+1)))) for j in range(k+2)]
    path=sector+[(a,a)];d=[0]
    for p,q in zip(path,path[1:]):d.append(d[-1]+math.dist(p,q))
    for i in range(8):
        c,s=math.cos(i*math.pi/4),math.sin(i*math.pi/4)
        for (x,y),dd in zip(sector,d):out.append((x*c-y*s,x*s+y*c,i+dd/d[-1]))
    out.append((out[0][0],out[0][1],8.0))
    return out,d[-1]

def ring_loft(name,cx,rings,k=3):
    """Rings [(height, half-width, floor coordinate, material of the strip up to the next ring)].
    Curtain-wall strips take u in panes (whole panes per sector) and v in floors, so the texture
    meets the ribbons; steel strips take metres along the ring and along the profile."""
    n=len(plan(1,k)[0]);verts=[];faces=[];mats=[];uvs=[];dist=0.0
    for h,a,_,_ in rings:verts+=[(cx+x,y,h) for x,y,_ in plan(a,k)[0]]
    panes=lambda a:max(2,round(plan(a,k)[1]/PANE))
    for r in range(len(rings)-1):
        (h0,a0,f0,m),(h1,a1,f1,_)=rings[r],rings[r+1];step=math.hypot(h1-h0,a1-a0)
        s=plan(1,k)[0];L=plan((a0+a1)/2,k)[1]/STEEL['tile']
        for i in range(n-1):
            faces.append((r*n+i,r*n+i+1,(r+1)*n+i+1,(r+1)*n+i));mats.append(m)
            if m is FACADE:
                P,F=FACADE['panes'],FACADE['floors']
                uvs.append([(s[i][2]*panes(a0)/P,f0/F),(s[i+1][2]*panes(a0)/P,f0/F),(s[i+1][2]*panes(a1)/P,f1/F),(s[i][2]*panes(a1)/P,f1/F)])
            else:
                v0,v1=dist/m['tile'],(dist+step)/m['tile']
                uvs.append([(s[i][2]*L,v0),(s[i+1][2]*L,v0),(s[i+1][2]*L,v1),(s[i][2]*L,v1)])
        dist+=step
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);ob['asset']=T
    order=list(dict.fromkeys(mats))
    for m in order:me.materials.append(m)
    uv=me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        f.material_index=order.index(mats[f.index]);f.use_smooth=True
        for li,co in zip(f.loop_indices,uvs[f.index]):uv.data[li].uv=co
    me.set_sharp_from_angle(angle=math.radians(38))   # lobes smooth; star points and ribbon edges sharp
    ob['uv']=True;return ob

def floors(rings,h,a,count,fh,fc):
    """Append `count` floors: ribbon (steel) then glass, starting on a floor line."""
    for j in range(count):
        rings+=[(h,a+RIB_OUT,fc,STEEL),(h+RIB_RISE,a,fc+RIB_RISE/fh,FACADE),(h+fh,a,fc+1,STEEL)]
        h+=fh;fc+=1
    return h,fc

def rim(name,cx,h,a,k=3):
    """Crown rim round a tier's top edge: a closed stainless band standing on the setback ledge."""
    ao,ai=a+RIB_OUT+.04,a-.05
    return ring_loft(name,cx,[(h-.03,ai,0,STEEL),(h-.03,ao,0,STEEL),(h+.55,ao,0,STEEL),(h+.55,ai,0,STEEL),(h-.03,ai,0,None)],k)

def tower(cx):
    o=[];rings=[(BASE-.05,TIERS[0][1],0,STEEL)];h,fc=BASE,0
    edges=[]
    for t,(first,a) in enumerate(TIERS):
        last=TIERS[t+1][0] if t+1<len(TIERS) else FLOORS
        h,fc=floors(rings,h,a,last-first,FLOOR,fc);edges.append((h,a))
    assert abs(h-ROOF)<1e-6
    for a,count,fh in CROWN:
        h,fc=floors(rings,h,a,count,fh,fc);edges.append((h,a))
    rings+=[(h,CROWN[-1][0]+RIB_OUT,fc,STEEL),(h+.35,.9,fc,None)]
    o.append(ring_loft('tower body',cx,rings))
    for eh,ea in edges[:-1]:o.append(rim('crown rim',cx,eh,ea))
    return o+pinnacle(cx,h+.35)

def cone(name,x,y0,y1,r0,r1,m,verts=12):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r0,radius2=r1,depth=y1-y0,location=pt(x,(y0+y1)/2,0));o=bpy.context.object
    finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o

def pinnacle(cx,base):
    """Finned drum, a stack of shrinking rings, the ring ball, spire with collars, mast ball and
    needle, topping out at 103.5."""
    from pbr_kit import tube
    o=[];P=PINNACLE
    o.append(cyl('pinnacle drum',cx,base+.7,0,1.35,1.8,P,T,verts=24));top=base+1.6
    for i in range(16):   # a crown of pointed fins round the drum, taller on the star's axes
        a=i*math.pi/8;h=2.6 if i%2==0 else 2.0;fin=cone('drum spike',0,base-.1,base-.1+h,.16,.01,P,4)
        fin.scale=(1.6,.35,1);fin.rotation_euler.z=a;fin.location=pt(cx+math.cos(a)*1.42,base-.1+h/2,-math.sin(a)*1.42)
        o.append(fin)
    o.append(cone('ring core',cx,top,top+4.8,.62,.34,P))
    for i in range(12):o.append(cyl('pinnacle ring',cx,top+.22+i*.385,0,1.2-i*.042,.15,P,T,verts=20))
    ball=top+4.6+1.5
    for lat in (-60,-40,-20,0,20,40,60):
        o.append(cyl('ring ball ring',cx,ball+1.5*math.sin(math.radians(lat)),0,1.5*math.cos(math.radians(lat)),.13,P,T,verts=22))
    for i in range(8):
        az=i*math.pi/4
        o.append(tube('ring ball rib',[(cx+1.47*math.cos(math.radians(l))*math.cos(az),ball+1.47*math.sin(math.radians(l)),-1.47*math.cos(math.radians(l))*math.sin(az)) for l in range(-70,71,20)],.035,P,sides=4))
    o.append(cone('spire',cx,ball-1.6,101.0,.42,.1,P))
    for y,r in ((94.2,.56),(96.2,.46),(98.0,.36)):o.append(cyl('spire collar',cx,y,0,r,.3,P,T,verts=14))
    o.append(sphere('mast ball',cx,99.5,0,.3,P,T,12,8))
    o.append(cone('needle',cx,101.0,103.44,.07,.025,P,8))
    o.append(sphere('needle tip',cx,103.44,0,.06,P,T,8,6))
    return o

# ------------------------------------------------------------------ skybridge
def bridge():
    from pbr_kit import tube
    o=[];face=TOWER_X-TIERS[0][1];L=2*face+.4   # reaches into the star point either side
    glass=box('bridge glazing',0,39.25,0,L,2.7,3.5,FACADE,T,0);uv_facade(glass,37.9,2.7);o.append(glass)
    o.append(box('bridge underbeam',0,37.72,0,L,.36,3.9,STEEL,T,.03))
    o.append(box('bridge roof',0,40.76,0,L+.2,.32,4.1,STEEL,T,.03))
    o.append(box('bridge deck band',0,39.28,0,L,.14,3.62,STEEL,T,.01))
    for s in (-1,1):
        for i in range(12):o.append(box('bridge fin',-face+1.2+i*(2*face-2.4)/11,39.25,s*1.8,.12,2.7,.16,STEEL,T,0))
    # two-hinged arch: a straight leg from a hinge at level 29 on each tower, meeting under mid-span
    lo=(TOWER_X-TIERS[0][1]*math.sqrt(2)+.05,BASE+14*FLOOR);hi=(1.0,37.3)   # hinge on the star point
    for s in (-1,1):
        o.append(tube('arch leg',[(s*lo[0],lo[1],0),(s*hi[0],hi[1],0)],[.4,.3],STEEL,sides=12))
        o.append(sphere('arch hinge',s*lo[0],lo[1],0,.52,STEEL,T,14,8))
        o.append(box('hinge bracket',s*(lo[0]+.4),lo[1],0,.9,1.3,1.1,STEEL,T,.04))
    o.append(box('arch node',0,37.3,0,2.8,.55,1.0,STEEL,T,.05))
    return o

# ------------------------------------------------------------------ podiums
def uv_facade(ob,y0,floor_h):
    """Curtain-wall UVs on a box: u in panes along each wall, v in floors from y0, with the
    tangent frame matching the face normal (no mirrored faces)."""
    import mathutils
    bpy.context.view_layer.update();ob['uv']=True
    me=ob.data;me.update();mw=ob.matrix_world;uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    P,F=FACADE['panes'],FACADE['floors']
    for f in me.polygons:
        nw=(mw.to_3x3()@f.normal).normalized()
        tan=mathutils.Vector((0,0,1)).cross(nw)
        if tan.length<.5:tan=mathutils.Vector((1,0,0))
        for li in f.loop_indices:
            c=mw@me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv=(c.dot(tan)/(PANE*1.3*P),(c.z-y0)/floor_h/F)

def podium(cx):
    o=[];W,D=21,24
    o.append(box('podium core',cx,1.25,0,W-.3,2.5,D-.3,STONE,T,0))
    o.append(box('podium plinth',cx,.18,0,W+.1,.36,D+.1,STONE,T,.03))
    o.append(box('podium cornice',cx,2.72,0,W+.2,.56,D+.2,STONE,T,.04))
    o.append(box('cornice fascia',cx,2.47,0,W+.24,.08,D+.24,STEEL,T,0))
    walls=[('south',cx,11.9,W-2.6,'x'),('east',cx+10.4,0,D-2.8,'z'),('west',cx-10.4,0,D-2.8,'z')]
    for name,x,z,span,axis in walls:
        w,d=(span,.1) if axis=='x' else (.1,span)
        g=box(f'podium glass {name}',x,1.4,z,w,2.08,d,FACADE,T,0);uv_facade(g,.36,2.08);o.append(g)
        for i in range(int(span/3.2)+1):
            p=-span/2+i*span/int(span/3.2)
            fx,fz=(x+p,z+.08) if axis=='x' else (x+math.copysign(.08,x-cx),z+p)
            o.append(box('podium fin',fx,1.4,fz,.09 if axis=='x' else .2,2.08,.2 if axis=='x' else .09,STEEL,T,0))
    for sx in (-1,1):
        for sz in (-1,1):o.append(box('podium pilaster',cx+sx*9.9,1.4,sz*11.4,1.4,2.08,1.4,STONE,T,0))
    # cantilevered entrance canopies either side of the lift (its base is 4.1 m wide), no columns
    # outside the collision box
    for side in (-1,1):
        ex=cx+side*6
        o.append(box('entrance canopy',ex,2.37,13.05,4.4,.14,2.3,STEEL,T,.02))
        o.append(box('canopy fascia',ex,2.32,14.16,4.4,.2,.08,STEEL,T,0))
        for dx in (-1.9,1.9):o.append(box('door frame',ex+dx,1.25,12.0,.14,2.2,.16,STEEL,T,0))
        o.append(box('door head',ex,2.3,12.0,3.94,.14,.16,STEEL,T,0))
    return o

# ------------------------------------------------------------------ build and export
def build():
    from pbr_kit import uv_metres
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    materials()
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    parts=bridge()
    for cx in (-TOWER_X,TOWER_X):parts+=podium(cx)+tower(cx)
    for ob in parts:
        ob.parent=e
        if not ob.get('uv'):uv_metres(ob)
    return e

def check_lifts(ob):
    """No vertex of the set inside a lift shaft or the rooftop platform and its rails."""
    mw=ob.matrix_world
    for v in ob.data.vertices:
        x,y,z=(mw@v.co)[0],(mw@v.co)[2],-(mw@v.co)[1]
        for lx in (-TOWER_X,TOWER_X):
            assert not(abs(x-lx)<1.75 and abs(z-LIFT_Z)<1.75 and y<ROOF+2.8),('lift shaft',x,y,z)
            assert not(abs(x-lx)<3.7 and abs(z-LIFT_Z)<3.7 and ROOF-.3<y<ROOF+2.8),('lift platform',x,y,z)

def export(e):
    j=join([c for c in e.children if c.type=='MESH'],'klcc | twin towers')
    check_lifts(j)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True);j.select_set(True)
    path=PUBLIC/'LM_ENV_KLCC.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
        export_image_format='WEBP',export_image_quality=84)
    tris=sum(len(p.vertices)-2 for p in j.data.polygons)
    report={'asset':'LM_ENV_KLCC','origin':[0,0,-122],'towers':[[-TOWER_X,0],[TOWER_X,0]],'roof':ROOF,'height':103.5,
        'materials':[m.name for m in j.data.materials],'textures':sorted(__import__('pbr_kit').IMAGES),
        'triangles':tris,'bytes':path.stat().st_size,'draws':len(j.data.materials)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('KLCC WEB EXPORT',json.dumps(report),flush=True)

if __name__=='__main__':
    e=build();export(e)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'klcc.blend'))
