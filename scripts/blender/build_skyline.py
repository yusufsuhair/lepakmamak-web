"""The KL skyline pack, photographic pass: The Exchange 106 at TRX, Merdeka 118, Menara KL and the
four named city towers (UOB, HSBC, the DAP Pusat Komuniti and Hotel Mahkota).

  * Exchange 106: a rounded-corner square shaft of silver-blue glass with a fine vertical fin on every
    bay, easing into an obelisk crown behind a glass parapet, its fins lit at night
  * Merdeka 118: the faceted crystal. Rings of twelve alternately twisted, so every storey band is
    cut into triangles that catch the sky differently, with a frame on every facet edge (the LED
    lines at night), glass cut into songket diamonds, a tapering crown and the long spire
  * Menara KL: a smooth tapering concrete shaft, the head as one surface of revolution (the
    lozenge-tiled glazed underside, the observation deck leaning out, the revolving restaurant
    leaning in, a crown of pointed arches round the roof dome) and the antenna with its collars
  * city towers: each its own commercial language on the old footprints: UOB a chamfered unitised
    curtain wall with a rooftop screen, HSBC a granite grid of punched windows with proud pilasters
    and cornices, the Pusat Komuniti tropical-modern concrete with a sunshade ledge per floor, Hotel
    Mahkota cream precast with a stepped gold crown
  * materials: facade texture sets from skyline_textures.py laid out in world metres (whole bays per
    face or ring, v in floors), each with a night mask that src/skyline.ts turns into lit windows and
    floodlit frames; brushed aluminium, podium granite and Menara KL concrete from the same module.
    Aviation lights are empties named aviation_light, which the runtime turns into night glows.

Gameplay is untouched: origins, footprints, colliders and map entries stay in world.ts. Below head
height every mesh stays inside its collision box (the old flagpoles excepted), and no mesh stands in
front of the game's own canvas name signs; both are asserted here.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_skyline.py

Output: public/assets/models/environment/LM_ENV_{TRX,Merdeka118,KLTower,Tower*}.glb, then
node scripts/blender/compress-glb.mjs on each.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,box,cyl,join
import pbr_kit as kit
import skyline_textures as ST

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/skyline'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
TAU=2*math.pi

# ------------------------------------------------------------------ materials
def half(a):
    return (a[0::2,0::2]+a[1::2,0::2]+a[0::2,1::2]+a[1::2,1::2])/4

def half_normal(a):
    import numpy as np
    v=half(a)*2-1;return v/np.linalg.norm(v,axis=-1,keepdims=True)*.5+.5

FAC={}
def facade(name,gen,layout,band=False,small=False):
    """Curtain-wall material: colour, ORM (G roughness, B metal), normal and the night mask as the
    emissive texture. Images are named for the generator, so materials on one generator share them.
    small halves the normal map, for the mid-rise towers whose relief is a flat grid."""
    if gen not in FAC:
        col,nrm,orm,night=getattr(ST,gen)()
        FAC[gen]=(kit.image(gen+'_color',col),kit.image(gen+'_normal',half_normal(nrm) if small else nrm,True),kit.image(gen+'_orm',half(orm),True),kit.image(gen+'_night',half(night)))
    c,n,o,e=FAC[gen]
    m=bpy.data.materials.new(name);m.use_nodes=True;m.use_backface_culling=True;nt=m.node_tree;p=nt.nodes['Principled BSDF']
    def tex(img):
        t=nt.nodes.new('ShaderNodeTexImage');t.image=img;return t
    nt.links.new(tex(c).outputs['Color'],p.inputs['Base Color'])
    sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(tex(o).outputs['Color'],sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'],p.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
    nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(tex(n).outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    nt.links.new(tex(e).outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=1
    m['bay']=layout['bay'];m['cols']=layout['cols'];m['vlen']=layout['rows']*layout['floor'];m['band']=band
    return m

def metallic(m,v=1.0):
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=v;return m

def materials():
    global STONE,METAL,CONC,TRX_WALL,TRX_CROWN,M118_WALL,M118_FRAME,M118_SPIRE,POD,DECK,MAST,UOB,HSBC,DAP,HOTEL,GOLD
    kit.setup('skyline',OUT/'textures',20260914)
    STONE=kit.pbr('Skyline podium granite','stone','#ffffff',.45,2.4,source=ST)
    METAL=metallic(kit.pbr('Skyline aluminium','metal','#ffffff',.32,2.0,source=ST))
    CONC=kit.pbr('KL Tower concrete','concrete','#ffffff',.82,4.0,source=ST)
    TRX_WALL=facade('TRX curtain wall','trx_wall',dict(ST.TRX,bay=ST.TRX['pane']))
    TRX_CROWN=facade('TRX crown','trx_wall',dict(ST.TRX,bay=ST.TRX['pane']))
    M118_WALL=facade('Merdeka 118 curtain wall','m118_wall',dict(ST.M118,bay=ST.M118['pane']))
    M118_FRAME=metallic(kit.pbr('Merdeka 118 facet frame','metal','#aab6ba',.35,2.0,source=ST))
    M118_SPIRE=metallic(kit.pbr('Merdeka 118 spire','metal','#ffffff',.22,2.0,source=ST))
    POD=facade('KL Tower pod','klt_pod',dict(bay=.55,cols=ST.POD['cols'],rows=1,floor=4.4))
    DECK=facade('KL Tower deck glass','klt_deck',dict(bay=.9,cols=ST.DECK['cols'],rows=1,floor=1),band=True)
    MAST=metallic(kit.pbr('KL Tower mast','metal','#f4f4f0',.35,2.0,source=ST))
    CITY=dict(ST.CITY)
    UOB=facade('UOB curtain wall','office_ribbon',CITY,small=True)
    HSBC=facade('HSBC granite wall','granite_punched',CITY,small=True)
    DAP=facade('Pusat Komuniti wall','civic_concrete',CITY,small=True)
    HOTEL=facade('Hotel Mahkota wall','hotel_precast',CITY,small=True)
    GOLD=metallic(kit.hmat('Hotel Mahkota gold','#c9a24f',.3),.7)

# ------------------------------------------------------------------ mesh builders
def surface(name,tag,verts,faces,fm,fuv,smooth=True,sharp=None):
    """Mesh from Blender-space verts with a material and loop UVs per face, in the order given."""
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);ob['asset']=tag;ob['uv']=True
    order=list(dict.fromkeys(fm))
    for m in order:me.materials.append(m)
    uv=me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        f.material_index=order.index(fm[f.index]);f.use_smooth=smooth
        for li,co in zip(f.loop_indices,fuv[f.index]):uv.data[li].uv=co
    if sharp:me.set_sharp_from_angle(angle=math.radians(sharp))
    return ob

def runs(mats):
    """For each strip, the first and last strip of the run of equal materials it belongs to."""
    out=[]
    for j,m in enumerate(mats):
        j0=j
        while j0>0 and mats[j0-1] is m:j0-=1
        j1=j
        while j1+1<len(mats) and mats[j1+1] is m:j1+=1
        out.append((j0,j1))
    return out

def lathe(name,tag,prof,segs=24,sharp=35):
    """Surface of revolution round the local axis. prof: [(r, y, material of the strip up to the next
    point)], listed from the bottom up along the outer skin, so every strip faces outward (a strip that
    steps out faces down, one that steps in faces up). Facade materials take whole bays round the widest
    ring of their run and v along the profile in floors (0..1 across a band); tiled ones take metres."""
    W=segs+1;verts=[];faces=[];fm=[];fuv=[];arc=[0.0]
    for (r0,y0,_),(r1,y1,_) in zip(prof,prof[1:]):arc.append(arc[-1]+math.hypot(r1-r0,y1-y0))
    for r,y,_ in prof:
        for i in range(W):verts.append((r*math.cos(TAU*i/segs),r*math.sin(TAU*i/segs),y))
    mats=[p[2] for p in prof[:-1]]
    for j,(m,(j0,j1)) in enumerate(zip(mats,runs(mats))):
        if m is None:continue
        rref=max(prof[k][0] for k in range(j0,j1+2))
        if 'bay' in m:
            us=max(1,round(TAU*rref/m['bay']))/m['cols']
            V=(lambda k:(arc[k]-arc[j0])/(arc[j1+1]-arc[j0])) if m['band'] else (lambda k:arc[k]/m['vlen'])
        else:
            tile=m.get('tile',4.0);us=max(1,round(TAU*rref/tile));V=lambda k,tile=tile:arc[k]/tile
        for i in range(segs):
            a=j*W+i;faces.append((a,a+1,a+1+W,a+W));fm.append(m)
            fuv.append([(i/segs*us,V(j)),((i+1)/segs*us,V(j)),((i+1)/segs*us,V(j+1)),(i/segs*us,V(j+1))])
    return surface(name,tag,verts,faces,fm,fuv,True,sharp)

def loft(name,tag,rings,y0=0.0,cap=None,sharp=30):
    """Vertical loft of closed counter-clockwise plans (Blender x, y) with equal point counts: rings
    [(height, plan, material of the strip up to the next ring)]. Facade strips take whole bays on each
    plan edge (counted on the run's first ring, so mullions converge as a shaft tapers) and v in
    floors from y0; the top ring can be capped."""
    M=len(rings[0][1]);W=M+1;verts=[];faces=[];fm=[];fuv=[]
    for y,plan,_ in rings:
        for k in range(W):x,yy=plan[k%M];verts.append((x,yy,y))
    mats=[r[2] for r in rings[:-1]]
    for j,(m,(j0,j1)) in enumerate(zip(mats,runs(mats))):
        if m is None:continue
        ref=rings[j0][1];L=[math.dist(ref[k],ref[(k+1)%M]) for k in range(M)];U=[0.0]
        tile=m.get('tile',4.0)
        for l in L:U.append(U[-1]+(max(1,round(l/m['bay']))/m['cols'] if 'bay' in m else l/tile))
        V=(lambda y:(y-y0)/m['vlen']) if 'bay' in m else (lambda y:y/tile)
        for k in range(M):
            a=j*W+k;faces.append((a,a+1,a+1+W,a+W));fm.append(m)
            fuv.append([(U[k],V(rings[j][0])),(U[k+1],V(rings[j][0])),(U[k+1],V(rings[j+1][0])),(U[k],V(rings[j+1][0]))])
    if cap:
        top=len(rings)-1;faces.append(tuple(top*W+k for k in range(M)));fm.append(cap)
        t=cap.get('tile',4.0);fuv.append([(verts[top*W+k][0]/t,verts[top*W+k][1]/t) for k in range(M)])
    return surface(name,tag,verts,faces,fm,fuv,True,sharp)

def rounded(a,k,seg=4):
    """Square of half-width a with corner radius k*a, counter-clockwise from the east face."""
    r=a*k;c=a-r;pts=[]
    for q in range(4):
        cx,cy=c*(1 if q in (0,3) else -1),c*(1 if q in (0,1) else -1)
        for s in range(seg+1):
            t=q*math.pi/2+s*math.pi/2/seg;pts.append((cx+r*math.cos(t),cy+r*math.sin(t)))
    return pts

def chamfer(ax,ay,c):
    return [(ax,-ay+c),(ax,ay-c),(ax-c,ay),(-ax+c,ay),(-ax,ay-c),(-ax,-ay+c),(-ax+c,-ay),(ax-c,-ay)]

def wall(name,tag,x,y,z,w,h,d,m,y0):
    """Unbevelled box with facade UVs: whole bays across each wall, starting on its left edge (as seen
    from outside), v in floors from y0."""
    ob=box(name,x,y,z,w,h,d,m,tag,0);bpy.context.view_layer.update()
    me=ob.data;mw=ob.matrix_world;uv=me.uv_layers[0];ob['uv']=True
    for f in me.polygons:
        n=(mw.to_3x3()@f.normal).normalized();cs=[mw@me.vertices[me.loops[li].vertex_index].co for li in f.loop_indices]
        if abs(n.z)>.5:
            for li,c in zip(f.loop_indices,cs):uv.data[li].uv=(c.x/m['vlen'],c.y/m['vlen'])
            continue
        tan=Vector((0,0,1)).cross(n).normalized();ds=[c.dot(tan) for c in cs];lo,W=min(ds),max(max(ds)-min(ds),1e-6)
        us=max(1,round(W/m['bay']))/m['cols']
        for li,c,dd in zip(f.loop_indices,cs,ds):uv.data[li].uv=((dd-lo)/W*us,(c.z-y0)/m['vlen'])
    return ob

def ribbon_edges(name,tag,verts,faces,m,width,lift):
    """A flat strip on every edge of a faceted shell, lifted off the glass along the edge's mean normal."""
    edges={}
    for f in faces:
        P=[Vector(verts[i]) for i in f];n=(P[1]-P[0]).cross(P[2]-P[0]).normalized()
        for a,b in zip(f,f[1:]+f[:1]):edges.setdefault(tuple(sorted((a,b))),Vector()).__iadd__(n)
    rv=[];rf=[]
    for (a,b),n in edges.items():
        n=n.normalized();p0,p1=Vector(verts[a])+n*lift,Vector(verts[b])+n*lift;s=(p1-p0).cross(n).normalized()*width/2
        i=len(rv);rv+=[p0-s,p0+s,p1+s,p1-s];rf.append((i,i+1,i+2,i+3))
    ob=surface(name,tag,[tuple(v) for v in rv],rf,[m]*len(rf),[[(0,0)]*4]*len(rf),False);ob['uv']=False
    return ob

def light(tag,x,y,z):
    """An aviation light: an empty the runtime gives a red night glow."""
    e=bpy.data.objects.new('aviation_light',None);bpy.context.scene.collection.objects.link(e);e.location=pt(x,y,z);e['asset']=tag
    return e

# ------------------------------------------------------------------ The Exchange 106 at TRX
def trx(T):
    o=[]
    o.append(box('podium',0,3,0,18,6,18,STONE,T,.05))
    o.append(box('podium cornice',0,6.15,0,18.4,.3,18.4,METAL,T,.03))
    o.append(wall('lobby glass south',T,0,3.1,9.03,15,4.4,.1,TRX_WALL,.9))
    o.append(wall('lobby glass east',T,9.03,3.1,0,.1,4.4,13,TRX_WALL,.9))
    o.append(box('entrance canopy',0,5.4,10.2,9,.25,2.6,METAL,T,.03))
    # (height, half-width, corner radius / half-width): a straight shaft, then a crown that curves in
    # a straight shaft, then an obelisk crown easing in to a flat roof behind a glass parapet
    shaft=[(6.3,7.1,.24),(40,6.95,.24)]
    crown=[(68,6.7,.25),(78,6.36,.26),(86,5.72,.27),(92,4.84,.28),(96.5,3.94,.29),(98.5,3.48,.3)]
    rings=[(y,rounded(a,k),TRX_WALL) for y,a,k in shaft]+[(y,rounded(a,k),TRX_CROWN) for y,a,k in crown]
    o.append(loft('tower',T,rings,y0=6.3,cap=METAL,sharp=25))
    o.append(loft('crown parapet',T,[(98.5,rounded(3.48,.3),TRX_CROWN),(100.2,rounded(3.4,.3),None)],y0=6.3))
    return o+[light(T,3.1,100.4,-3.1),light(T,-3.1,100.4,3.1)]

# ------------------------------------------------------------------ Merdeka 118
def merdeka(T):
    o=[]
    o.append(box('podium',0,3,0,17,6,17,STONE,T,.05))
    o.append(box('podium cornice',0,6.15,0,17.4,.3,17.4,STONE,T,.03))
    o.append(wall('lobby glass south',T,0,3.1,8.53,14,4.4,.1,M118_WALL,.9))
    o.append(wall('lobby glass east',T,8.53,3.1,0,.1,4.4,12,M118_WALL,.9))
    o.append(box('entrance canopy',0,5.4,9.7,8.5,.25,2.4,STONE,T,.03))
    # the crystal: rings of N, each twisted half a facet against the one below
    N=12;TIERS=14;ROOF=100.0
    ys=[6.3+i*(ROOF-6.3)/TIERS for i in range(TIERS+1)]+[106.5,112.0]
    rad=[7.7*(1-.6*((y-6.3)/(ROOF-6.3))**1.35) for y in ys[:TIERS+1]]+[2.0,1.1]
    verts=[];rings=[]
    for i,(y,r) in enumerate(zip(ys,rad)):
        ph=(i%2)*math.pi/N;rings.append((len(verts),ph))
        for k in range(N):verts.append((r*math.cos(ph+TAU*k/N),r*math.sin(ph+TAU*k/N),y))
    faces=[]
    for i in range(len(ys)-1):
        a0,pa=rings[i];b0,pb=rings[i+1]
        for k in range(N):
            A,A1,B,B1=a0+k,a0+(k+1)%N,b0+k,b0+(k+1)%N
            if pb>pa:faces+=[(A,A1,B),(A1,B1,B)]      # B sits between A and A1
            else:faces+=[(A,A1,B1),(A,B1,B)]          # B1 sits between A and A1
    faces.append(tuple(rings[-1][0]+k for k in range(N)))
    # every facet faces away from the axis (the cap faces up)
    for fi,f in enumerate(faces):
        P=[Vector(verts[i]) for i in f];n=(P[1]-P[0]).cross(P[2]-P[0]);c=sum(P,Vector())/len(P)
        if (len(f)==N and n.z<0) or (len(f)<N and n.x*c.x+n.y*c.y<0):faces[fi]=f[::-1]
    bays=round(TAU*rad[0]/M118_WALL['bay'])
    fuv=[]
    for f in faces:
        th=[math.atan2(verts[i][1],verts[i][0])%TAU for i in f]
        th=[t+TAU if t<th[0]-math.pi else t-TAU if t>th[0]+math.pi else t for t in th]
        fuv.append([(t/TAU*bays/M118_WALL['cols'],(verts[i][2]-6.3)/M118_WALL['vlen']) for t,i in zip(th,f)])
    o.append(surface('tower',T,verts,faces,[M118_WALL]*(len(faces)-1)+[M118_SPIRE],fuv,False))
    o.append(ribbon_edges('facet frame',T,verts,faces[:-1],M118_FRAME,.1,.04))
    # the spire: a tapering needle with three collars
    o.append(lathe('spire',T,[(1.14,111.9,M118_SPIRE),(.92,120,M118_SPIRE),(1.06,120.05,M118_SPIRE),(1.06,120.6,M118_SPIRE),(.84,120.65,M118_SPIRE),
        (.56,130,M118_SPIRE),(.72,130.05,M118_SPIRE),(.72,130.5,M118_SPIRE),(.52,130.55,M118_SPIRE),(.27,137.5,M118_SPIRE),(.37,137.55,M118_SPIRE),
        (.37,137.9,M118_SPIRE),(.21,137.95,M118_SPIRE),(.09,141.5,M118_SPIRE),(.02,142.0,None)],12))
    return o+[light(T,0,142.2,0),light(T,0,112.6,0)]

# ------------------------------------------------------------------ Menara KL
def kltower(T):
    o=[];C,P,D,Mm=CONC,POD,DECK,MAST
    o.append(lathe('base',T,[(5.6,0,C),(5.6,.9,D),(5.6,3.5,C),(5.95,3.55,C),(5.95,4.3,C),(2.5,4.35,None)],28))
    o.append(box('entrance canopy',0,3.3,6.6,5.2,.3,2.4,C,T,.03))
    head=[(2.36,4.3,C),(2.12,20,C),(1.86,38,C),(1.62,52,C),(1.5,61.5,P),
        (2.0,63.4,P),(3.2,65.0,P),(4.6,66.4,P),(5.7,67.7,P),(6.3,69.0,C),                 # glazed underside
        (6.55,69.05,C),(6.55,69.55,C),(6.4,69.6,D),(6.9,71.8,C),                           # observation deck
        (7.15,71.85,C),(7.15,72.35,C),(6.85,72.4,D),(6.45,74.5,C),                         # revolving restaurant
        (6.7,74.55,C),(6.7,75.0,C),(6.2,75.1,P),(5.2,76.6,P),(4.25,77.5,None)]             # roof tiles up to the arch crown
    o.append(lathe('shaft and head',T,head,32))
    # a crown of pointed arches round the roof dome
    K=48;verts=[];faces=[];fuv=[]
    for k in range(K+1):
        t=TAU*k/K;verts.append((4.25*math.cos(t),4.25*math.sin(t),77.45))
    for k in range(K+1):
        t=TAU*k/K;verts.append((3.86*math.cos(t),3.86*math.sin(t),79.3 if k%2==0 else 78.75))
    for k in range(K):
        a=k;faces.append((a,a+1,a+K+2,a+K+1));fuv.append([(k/10,0),((k+1)/10,0),((k+1)/10,.5),(k/10,.5)])
    arches=surface('arch crown',T,verts,faces,[C]*K,fuv,False);arches['uv']=False;o.append(arches)
    o.append(lathe('roof dome',T,[(3.84,77.7,P),(3.3,79.6,P),(2.3,80.8,C),(1.05,81.6,C),(.62,81.9,None)],24))
    o.append(lathe('antenna',T,[(.62,81.8,Mm),(.55,85,Mm),(.92,85.05,Mm),(.92,85.6,Mm),(.46,85.65,Mm),(.4,90,Mm),(.72,90.05,Mm),
        (.72,90.5,Mm),(.3,90.55,Mm),(.24,94.5,Mm),(.12,97.8,Mm),(.02,98.6,None)],12))
    return o+[light(T,0,98.8,0),light(T,0,90.8,0),light(T,0,85.9,0)]

# ------------------------------------------------------------------ the four city towers
def roof_plant(T,w,d,H):
    return [box('roof plant',-w*.2,H+1.7,d*.15,w*.34,1.6,d*.3,STONE,T,.04),box('lift overrun',w*.22,H+2.2,-d*.12,w*.26,2.6,d*.26,STONE,T,.04)]

def uob(T,w,d,H,accent):
    o=[box('plinth',0,2.1,0,w,4.2,d,STONE,T,.04),wall('lobby glass',T,0,2.0,d/2+.03,w-3,3.4,.1,UOB,.3),
       box('entrance canopy',0,3.9,d/2+1.3,w*.55,.22,2.6,METAL,T,.03),box('plinth cap',0,4.3,0,w+.3,.2,d+.3,METAL,T,.02)]
    o.append(loft('tower',T,[(4.4,chamfer(w/2,d/2,1.1),UOB),(H,chamfer(w/2,d/2,1.1),None)],y0=4.4))
    o.append(loft('parapet',T,[(H,chamfer(w/2+.25,d/2+.25,1.1),accent),(H+.9,chamfer(w/2+.25,d/2+.25,1.1),None)],cap=STONE))
    o+=roof_plant(T,w,d,H+.8)
    for sx in (-1,1):o.append(box('roof screen',sx*w*.3,H+2.3,0,.12,2.8,d*.62,METAL,T,0))
    for sz in (-1,1):o.append(box('roof screen',0,H+2.3,sz*d*.31,w*.6,2.8,.12,METAL,T,0))
    for s in (-1,1):o.append(cyl('flagpole',w/2+1.1,4.5,s*3.2,.09,8.8,METAL,T,verts=8))
    return o

def hsbc(T,w,d,H,accent):
    o=[wall('tower',T,0,H/2,0,w,H,d,HSBC,1.4)]        # eight floors of 3.2 from the plinth to the roof
    o.append(box('plinth',0,.7,0,w+.2,1.4,d+.2,STONE,T,.03))
    for y in (4.6,H-3.2):o.append(box('cornice',0,y,0,w+.5,.34,d+.5,METAL if y>6 else STONE,T,.03))
    for sx in (-1,1):
        for sz in (-1,1):o.append(box('pilaster',sx*(w/2-.3),H/2,sz*(d/2-.3),.8,H,.8,STONE,T,.03))
    o.append(box('entrance canopy',0,4.1,d/2+1.2,w*.5,.24,2.4,METAL,T,.03))
    o.append(box('parapet',0,H+.45,0,w+.5,.9,d+.5,accent,T,.03))
    o+=roof_plant(T,w,d,H+.8)
    for s in (-1,1):o.append(cyl('flagpole',w/2+1.1,4.5,s*3.2,.09,8.8,METAL,T,verts=8))
    return o

def dap(T,w,d,H,accent):
    o=[box('base',0,2.2,0,w,4.4,d,STONE,T,.04),wall('tower',T,0,(H+4.4)/2,0,w-.4,H-4.4,d-.4,DAP,4.4)]
    y=4.4
    while y<H-.5:
        o.append(box('sunshade ledge',0,y,0,w+.7,.22,d+.7,STONE,T,.02));y+=3.2
    o.append(box('civic awning',0,4.1,d/2+1.9,w*.8,.2,1.7,accent,T,.02))
    o.append(box('parapet',0,H+.45,0,w+.5,.9,d+.5,accent,T,.03))
    for i in range(6):o.append(box('pergola beam',-w*.3+i*w*.12,H+2.6,0,.18,.18,d*.6,METAL,T,0))
    for sx in (-1,1):
        for sz in (-1,1):o.append(box('pergola post',sx*w*.3,H+1.8,sz*d*.28,.18,1.7,.18,METAL,T,0))
    o.append(cyl('flagpole',w/2+1.1,6.0,-4.7,.08,11.8,METAL,T,verts=8))
    o.append(box('flag',w/2+1.85,10.8,-4.7,1.5,.95,.06,accent,T,0))
    return o

def mahkota(T,w,d,H,accent):
    o=[box('podium',0,2.5,0,w,5,d,STONE,T,.04),wall('tower',T,0,(H+5)/2,0,w-.6,H-5,d-.6,HOTEL,5)]
    for sx in (-1,1):
        for sz in (-1,1):o.append(box('pilaster',sx*(w/2-.45),(H+5)/2,sz*(d/2-.45),.9,H-5,.9,STONE,T,.03))
    for y in (5.1,H-.2):o.append(box('band',0,y,0,w+.2,.4,d+.2,STONE,T,.03))
    o.append(box('porte cochere',0,4.2,d/2+2.6,w*.7,.3,3.2,GOLD,T,.03))
    o.append(box('parapet',0,H+.45,0,w+.5,.9,d+.5,accent,T,.03))
    o.append(box('crown',0,H+2.0,0,9,2.2,9,GOLD,T,.05))
    o.append(box('crown step',0,H+3.7,0,6.2,1.2,6.2,GOLD,T,.04))
    o.append(loft('crown roof',T,[(H+4.3,chamfer(3.1,3.1,.01),GOLD),(H+7.6,chamfer(.25,.25,.01),None)]))
    o.append(cyl('finial',0,H+8.4,0,.09,1.6,GOLD,T,verts=8))
    for s in (-1,1):o.append(cyl('hotel pole',w/2+1.2,3.6,s*4.6,.08,7.2,GOLD,T,verts=8))
    return o

# name: (builder, origin, footprint (w, d) or None, name signs as (x face, y0, y1, half-width along z))
SITES={
 'TRX':          (trx,     [105,0,-95], (18,18), [(-9.08,3.3,5.1,3.5)]),
 'Merdeka118':   (merdeka, [129,0,-95], (17,17), [(-8.58,3.575,5.025,5.5)]),
 'KLTower':      (kltower, [-104,0,-145], None, []),
 'TowerUOB':     (lambda T:uob(T,16,17,30,kit.hmat('UOB accent','#b52e35',.5)),      [-127,0,-37], (16,17), [(8.42,26.25,27.75,4.5)]),
 'TowerHSBC':    (lambda T:hsbc(T,16,17,27,kit.hmat('HSBC accent','#d33b3e',.5)),    [-106,0,-37], (16,17), [(8.42,23.25,24.75,4.5)]),
 'TowerDAP':     (lambda T:dap(T,16,17,22,kit.hmat('DAP accent','#c62e34',.5)),      [-127,0,37],  (16,17), [(8.42,18.25,19.75,4.5),(8.43,3.8,4.6,5)]),
 'TowerMahkota': (lambda T:mahkota(T,17,17,38,kit.hmat('Mahkota accent','#a5813e',.5)),[-106,0,37], (17,17), [(8.92,34.25,35.75,5.5)]),
}
POLES=('flagpole','hotel pole','flag')

def check(name,objs):
    """Below head height inside the collision box; nothing in front of a name sign."""
    _,_,foot,signs=SITES[name]
    for ob in objs:
        if ob.type!='MESH' or ob.name.split('.')[0] in POLES:continue
        mw=ob.matrix_world
        for v in ob.data.vertices:
            c=mw@v.co;x,y,z=c.x,c.z,-c.y
            if foot:assert not(y<2.2 and (abs(x)>foot[0]/2+.12 or abs(z)>foot[1]/2+.12)),(name,ob.name,'outside footprint',x,y,z)
            for sx,y0,y1,hz in signs:
                assert not(y0<y<y1 and abs(z)<hz and (x<sx+.04 if sx<0 else x>sx-.04)),(name,ob.name,'in front of sign',x,y,z)

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    materials();roots={}
    for name,(fn,_,_,_) in SITES.items():
        T=name.lower();e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
        parts=fn(T);bpy.context.view_layer.update();check(name,parts)
        for ob in parts:
            ob.parent=e
            if ob.type=='MESH' and not ob.get('uv'):kit.uv_metres(ob)
        roots[name]=e
    return roots

def export(roots):
    report={}
    for name,e in roots.items():
        meshes=[c for c in e.children if c.type=='MESH'];j=join(meshes,name);j.parent=e
        bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
        for c in e.children:c.select_set(True)
        path=PUBLIC/f'LM_ENV_{name}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,
            export_cameras=False,export_lights=False,export_extras=False,export_image_format='WEBP',export_image_quality=84)
        images=sorted({n.image.name for m in j.data.materials if m and m.node_tree for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image})
        report[name]={'asset':f'LM_ENV_{name}','origin':SITES[name][1],'triangles':sum(len(p.vertices)-2 for p in j.data.polygons),
            'draws':len(j.data.materials),'materials':[m.name for m in j.data.materials],'textures':images,'bytes':path.stat().st_size,
            'height':round(max((j.matrix_world@v.co).z for v in j.data.vertices),2)}
    total={'triangles':sum(r['triangles'] for r in report.values()),'draws':sum(r['draws'] for r in report.values()),'bytes':sum(r['bytes'] for r in report.values())}
    (OUT/'manifest.json').write_text(json.dumps({'towers':report,'total':total},indent=2)+'\n')
    print('SKYLINE WEB EXPORT',json.dumps({'total':total,'towers':{k:(v['triangles'],v['draws'],v['bytes']) for k,v in report.items()}}),flush=True)

if __name__=='__main__':
    roots=build();export(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'skyline.blend'))
