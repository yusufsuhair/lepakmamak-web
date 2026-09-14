"""Photographic Rapid KL Kelana Jaya line for the Lepak loop (run through build_lrt.py).

  * viaduct: precast segmental box girder with parapets, drip nose, haunches and soffit, carrying
    direct-fixation rails on plinths, the LIM reaction plate, the paired power rails under their
    cover board, a walkway grating and a cable trough; grooved T-piers with a flared hammerhead,
    elastomeric bearings and a downpipe. One girder sheet holds three segment variants; src/lrt.ts
    picks one per instance so 190 instances do not repeat.
  * station: side platform with granite coping, yellow edge line, tactile strip and half-height
    platform gates at the train doors, a curved standing-seam roof on steel ribs with LED lines in
    the perforated soffit, perforated screens, Rapid KL red/white/blue fascias, the stair tower with
    its glazed stairwell, the link bridge and the ground totem.
  * train: Innovia Mark II coach from one 1024 atlas: white body, continuous tinted window band with
    the saloon showing through, red band and blue pin line, glossy black nose mask, LED head and
    tail clusters, lining, floor, seats, poles, bogies with LIM motors and collector shoes.
  * night: emissive maps carry headlamps, tail lamps and displays (always) and saloon light, stair
    well glow and roof LEDs (night only); 'LRT night wash' is additive light on the platform.

Kept from the flat build (gameplay and the loader depend on them): rail top y=11 on the track line,
platform top 11.8 at x 2.1..7.65 with its columns at x=4.9 z=+-18, the stair tower footprint at
x=11.8 (2.3 x 3.5), the sign frame at (4.9, 14.1) and totem at (9, 3.8) behind the game's labels,
coach floor .85 above the rail, walls inside |x|<1.96, door and roof node names, pier footprint
inside +-.8.
"""
import bpy, bmesh, math, json
import numpy as np
from pathlib import Path
from mathutils import Vector
from build_lrt import pt, mat, box, cyl, rounded, join
import pbr_kit as kit
import lrt_textures as LT

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/lrt';OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/lrt';PUBLIC.mkdir(parents=True,exist_ok=True)
RAIL=LT.RAIL;TOP=RAIL+.8          # platform top = coach floor
N=LT.TRAIN_N

# ------------------------------------------------------------------ mesh helpers
def G(v):return Vector((v.x,v.z,-v.y))            # Blender -> game

def newell(P):
    n=Vector((0,0,0))
    for i,a in enumerate(P):
        b=P[(i+1)%len(P)];n.x+=(a.y-b.y)*(a.z+b.z);n.y+=(a.z-b.z)*(a.x+b.x);n.z+=(a.x-b.x)*(a.y+b.y)
    return n

def polys(name,items,m,tag,smooth=False,sharp=35):
    """items: [(game points, uvs, outward hint or None)]. Each face turns to face its hint."""
    verts=[];faces=[];uvs=[]
    for P,U,out in items:
        P=[Vector(p) for p in P];U=list(U)
        if out is not None and newell(P).dot(Vector(out))<0:P.reverse();U.reverse()
        faces.append(tuple(range(len(verts),len(verts)+len(P))));verts+=[pt(*p) for p in P];uvs.append(U)
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    uv=me.uv_layers.new(name='UVMap')
    for poly,U in zip(me.polygons,uvs):
        for li,c in zip(poly.loop_indices,U):uv.data[li].uv=c
    if smooth:
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5);bm.to_mesh(me);bm.free()
    for f in me.polygons:f.use_smooth=smooth
    if smooth:me.set_sharp_from_angle(angle=math.radians(sharp))
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob)
    me.materials.append(m);ob['asset']=tag;ob['uv']=True
    return ob

def prism(name,ring,s0,s1,m,tag,uv,axis='z',t_end=None,caps=False,cap_uv=None,closed=True,smooth=False):
    """Extrude a cross-section ring [(a,b,t)] along the axis from s0 to s1: (a,b)=(x,y) along z,
    (x,z) along y. uv(t,s)->(u,v). Side faces face out of the ring whatever its winding."""
    n=len(ring);area=sum(ring[i][0]*ring[(i+1)%n][1]-ring[(i+1)%n][0]*ring[i][1] for i in range(n))
    sg=1 if area>0 else -1
    P=(lambda a,b,s:(a,b,s)) if axis=='z' else (lambda a,b,s:(a,s,b))
    O=(lambda na,nb:(na,nb,0)) if axis=='z' else (lambda na,nb:(na,0,nb))
    items=[]
    for i in range(n if closed else n-1):
        a0,b0,t0=ring[i];a1,b1,t1=ring[(i+1)%n]
        if closed and i==n-1:t1=ring[0][2] if t_end is None else t_end
        items.append(([P(a0,b0,s0),P(a1,b1,s0),P(a1,b1,s1),P(a0,b0,s1)],[uv(t0,s0),uv(t1,s0),uv(t1,s1),uv(t0,s1)],O((b1-b0)*sg,-(a1-a0)*sg)))
    if caps:
        for s,k in ((s0,-1),(s1,1)):
            items.append(([P(a,b,s) for a,b,_ in ring],[(cap_uv or (lambda a,b:uv(ring[0][2],s)))(a,b) for a,b,_ in ring],(0,0,k) if axis=='z' else (0,k,0)))
    return polys(name,items,m,tag,smooth)

def uv_by(ob,fn):
    """Per-loop UVs from fn(game position, game normal) for primitives built by box()/cyl()."""
    bpy.context.view_layer.update()
    me=ob.data;mw=ob.matrix_world.copy();nm=mw.inverted().transposed().to_3x3()
    uv=me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        nrm=G((nm@f.normal).normalized())
        for li in f.loop_indices:uv.data[li].uv=fn(G(mw@me.vertices[me.loops[li].vertex_index].co),nrm)
    ob['uv']=True;return ob

def px(col,row):return (col/N,1-row/N)

# ------------------------------------------------------------------ materials
M={}
def half(a):
    h=(a[0::2,0::2]+a[1::2,0::2]+a[0::2,1::2]+a[1::2,1::2])/4
    return h
def atlas_mat(name,prefix,col,nrm,orm=None,emis=None,rough=.5,metal=0.0,two_sided=False,normal_half=False):
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF']
    def tex(tn,arr,data):
        t=nt.nodes.new('ShaderNodeTexImage');t.image=kit.image(tn,arr,data);return t
    nt.links.new(tex(prefix+'_color',col,False).outputs['Color'],p.inputs['Base Color'])
    if normal_half:
        nrm=half(nrm*2-1);nrm=nrm/np.linalg.norm(nrm,axis=-1,keepdims=True)*.5+.5
    nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(tex(prefix+'_normal',nrm,True).outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    if orm is not None:
        sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(tex(prefix+'_orm',orm,True).outputs['Color'],sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'],p.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
    else:
        p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emis is not None:   # half resolution is plenty for light
        e=half(emis)
        nt.links.new(tex(prefix+'_emission',e,False).outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=1
    m.use_backface_culling=not two_sided
    return m

def materials():
    kit.setup('lrt',OUT/'textures',20260914)
    M['girder']=atlas_mat('LRT girder concrete','girder',*LT.girder(),rough=.92,normal_half=True)
    M['pier']=atlas_mat('LRT pier concrete','pier',*LT.pier(),rough=.92,normal_half=True)
    c,n,o=LT.track();M['track']=atlas_mat('LRT track','track',c,n,o)
    M['conc']=kit.pbr('LRT station concrete','concrete','#ffffff',.9,3.0,source=LT)
    M['floor']=atlas_mat('LRT platform floor','platform',*LT.platform(),rough=.55,normal_half=True)
    c,n,e=LT.roof();M['roof']=atlas_mat('LRT station roof','roof',c,n,None,e,rough=.42,metal=.35,normal_half=True)
    c,n,o,e=LT.cladding();M['clad']=atlas_mat('LRT station cladding','cladding',c,n,o,e,normal_half=True)
    M['steel']=kit.hmat('LRT station steel','#c9d0d4',.36);M['steel'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.55
    M['glass']=mat('LRT station glass',kit.srgb('#9fbac6'),.06,alpha=.3,two_sided=True)
    w=bpy.data.materials.new('LRT night wash');w.use_nodes=True;nt=w.node_tree;p=nt.nodes['Principled BSDF']
    t=nt.nodes.new('ShaderNodeTexImage');t.image=kit.image('wash',LT.wash());nt.links.new(t.outputs['Color'],p.inputs['Base Color'])
    M['wash']=w
    c,n,o,e=LT.innovia();M['train']=atlas_mat('LRT Innovia','innovia',c,n,o,e)

# ------------------------------------------------------------------ viaduct
def girder():
    tag='girder';o=[]
    R=[(x,y,s) for (x,y),s in zip(LT.GIRDER,LT.GIRDER_S)]
    ring=R+[(-x,y,s) for x,y,s in reversed(R[1:-1])]
    G9=LT.GIRDER_TEX
    o.append(prism('box girder',ring,-1.5,1.5,M['girder'],tag,lambda t,z:((z+1.5)/G9,t/G9),caps=True,
        cap_uv=lambda a,b:(1.5/G9,6.6/G9)))
    T=M['track'];B=LT.TRACK_BANDS
    def band(name,span=(0,1)):
        a,b=B[name];return lambda t,z:((z+1.5)/3,a+(span[0]+min(max(t,0),1)*(span[1]-span[0]))*(b-a))
    rail=[(-.07,10.87),(.07,10.87),(.07,10.885),(.012,10.90),(.012,10.965),(.035,10.972),(.035,11.0),(-.035,11.0),(-.035,10.972),(-.012,10.965),(-.012,10.90),(-.07,10.885)]
    ts=LT.arcs(rail+[rail[0]]);tot=ts[-1];head=(ts[6]+ts[7])/2/tot
    for s in (-1,1):
        cx=s*.7175
        # t mapped so the middle of the head top lands on the band's bright centre (.5)
        o.append(prism('rail',[(cx+x,y,.5+(ts[i]/tot-head)) for i,(x,y) in enumerate(rail)],-1.5,1.5,T,tag,band('rail'),t_end=.5+(1-head)))
        o.append(prism('rail plinth',[(cx-.21,10.76,0),(cx+.21,10.76,0),(cx+.21,10.87,.2),(cx-.21,10.87,.8)],-1.5,1.5,T,tag,band('plinth'),t_end=1))
    o.append(prism('LIM reaction plate',[(-.16,10.76,0),(.16,10.76,0),(.16,10.93,.1),(.225,10.93,.18),(.225,10.97,.22),(-.225,10.97,.78),(-.225,10.93,.82),(-.16,10.93,.9)],-1.5,1.5,T,tag,band('plate'),t_end=1))
    for x in (-1.35,-1.55):
        o.append(prism('conductor rail',[(x-.035,10.97,0),(x+.035,10.97,.1),(x+.035,11.06,.2),(x-.035,11.06,.3)],-1.5,1.5,T,tag,band('power'),t_end=.35))
        for z in (-.75,.75):
            b=box('insulator',x,10.865,z,.1,.21,.12,T,tag,0);uv_by(b,lambda p,nn:((p.z+1.5)/3,B['power'][0]+.1*(B['power'][1]-B['power'][0])));o.append(b)
    o.append(prism('power rail cover',[(-1.64,10.98,.36),(-1.62,10.98,.4),(-1.62,11.10,.5),(-1.28,11.10,.95),(-1.28,11.12,.97),(-1.64,11.12,.99)],-1.5,1.5,T,tag,band('power'),t_end=1))
    o.append(prism('walkway',[(1.18,10.76,0),(1.94,10.76,0),(1.94,10.95,.06),(1.18,10.95,.94)],-1.5,1.5,T,tag,band('walk'),t_end=1))
    o.append(prism('cable trough',[(-1.96,10.76,0),(-1.70,10.76,0),(-1.70,10.92,.03),(-1.96,10.92,.05)],-1.5,1.5,T,tag,band('walk'),t_end=.07))
    return o

def pier():
    tag='pier';o=[];PU=2*LT.PIER_U;V=LT.PIER_V
    col=[(x,z,t) for (x,z),t in zip(LT.PIER_PLAN,LT.PIER_S)]
    o.append(prism('pier column',col,.12,7.6,M['pier'],tag,lambda t,y:(t/PU,y/V),axis='y',t_end=LT.PIER_S[-1]))
    def head(p,n):
        if abs(n.y)>.7:return (.5+(p.x+1.9)/PU*.3,p.y/V)
        return (.5+(p.x+1.9)/PU if abs(n.z)>.6 else .5+(4.7+p.z)/PU,p.y/V)
    # hammerhead: flared profile across the track, extruded along it
    half=[(.8,7.45),(.83,7.85),(.92,8.22),(1.08,8.55),(1.32,8.82),(1.58,8.98),(1.78,9.04),(1.78,9.2)]
    prof=[(x,y,0) for x,y in half]+[(-x,y,0) for x,y in reversed(half)]
    hd=prism('pier head',prof,-.7,.7,M['pier'],tag,lambda t,z:(0,0),caps=True);uv_by(hd,head);o.append(hd)
    foot=[(1.1,-.9),(1.1,.9),(-1.1,.9),(-1.1,-.9)]
    ft=prism('pile cap',[(x,z,0) for x,z in foot],-.05,.16,M['pier'],tag,lambda t,y:(0,0),axis='y',caps=True);uv_by(ft,head);o.append(ft)
    T=M['track'];a,b=LT.TRACK_BANDS['bearing']
    for s in (-1,1):
        pl=box('bearing plinth',s*.8,9.23,0,.7,.06,.6,M['pier'],tag,0);uv_by(pl,head);o.append(pl)
        br=box('bearing',s*.8,9.33,0,.5,.14,.45,T,tag,0)
        uv_by(br,lambda p,n:(.1+(p.x-s*.8+.25)*.6+(p.z+.225)*.3,a+(p.y-9.26)/.14*(b-a)*.98));o.append(br)
    pipe=kit.tube('downpipe',[(0,9.42,.84),(0,7.35,.84),(0,7.05,.72),(0,.5,.72),(0,.3,.62)],.075,T,sides=8)
    uv_by(pipe,lambda p,n:(.75+n.x*.2,a+(.2+p.y/10*.75)*(b-a)));o.append(pipe)
    for y in (1.6,4.2,6.6):
        st=box('pipe strap',0,y,.74,.24,.05,.14,T,tag,0);uv_by(st,lambda p,n:(.6,a+.1*(b-a)));o.append(st)
    return o

# ------------------------------------------------------------------ station
def bezier(t,P):
    u=1-t;return tuple(u*u*u*P[0][i]+3*u*u*t*P[1][i]+3*u*t*t*P[2][i]+t*t*t*P[3][i] for i in range(2))

ROOF_CTRL=[(1.55,TOP+3.55),(3.3,TOP+5.75),(6.9,TOP+5.45),(9.3,TOP+3.8)]
def roof_curve(k=20):
    pts=[bezier(i/k,ROOF_CTRL) for i in range(k+1)];s=LT.arcs(pts)
    assert s[-1]<LT.ROOF_ARC-.1,s[-1]
    nrm=[]
    for i in range(len(pts)):
        a=pts[max(i-1,0)];b=pts[min(i+1,len(pts)-1)];dx,dy=b[0]-a[0],b[1]-a[1];l=math.hypot(dx,dy);nrm.append((-dy/l,dx/l))
    return pts,s,nrm

def roof_height(x):
    pts,_,_=roof_curve(60)
    for a,b in zip(pts,pts[1:]):
        if a[0]<=x<=b[0]:return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])
    return pts[-1][1]

def clad_strip(y0,y1):
    """UV in the cladding sheet's 0.4 m strip (fascia, totem, display bands) at heights y0..y1."""
    return lambda p,n:(11.8/LT.CLAD_U,(y0+y1)/2/LT.CLAD_V)

def station():
    tag='station';o=[]
    C,FL,RF,CL,ST,GL=M['conc'],M['floor'],M['roof'],M['clad'],M['steel'],M['glass']
    floor_uv=lambda p,n:(p.z/LT.PLATFORM_U,max(p.x-LT.PLATFORM_EDGE,0)/LT.PLATFORM_V if n.y>.7 else .01)
    # platform deck and structure (column footprints are the game's colliders)
    o.append(box('platform slab',4.9,TOP-.5,0,5.5,.88,59,C,tag,.03))
    o.append(uv_by(box('platform floor',4.875,TOP-.03,0,5.55,.06,59,FL,tag,0),floor_uv))
    o.append(uv_by(box('platform fascia',2.12,TOP-.42,0,.06,.66,59,CL,tag,0),lambda p,n:((11.8)/LT.CLAD_U,(.66+(p.y-TOP+.75)*.7)/LT.CLAD_V)))
    o.append(box('slab beam',4.9,TOP-1.2,0,2.6,.6,59,C,tag,.04))
    for z in (-18,18):
        o.append(box('platform column',4.9,(TOP-1.5)/2,z,1.4,TOP-1.5,1.4,C,tag,.05))
        o.append(box('column capital',4.9,TOP-1.7,z,2.6,.5,2.2,C,tag,.04))
    # half-height platform gates: openings at the eight train doors
    doors=[-21,-15,-9,-3,3,9,15,21];spans=[];z=-26.0
    for d in doors:spans.append((z,d-1.1));z=d+1.1
    spans.append((z,26.0))
    for z0,z1 in spans:
        zc,zl=(z0+z1)/2,z1-z0
        o.append(box('gate glass',2.45,TOP+.78,zc,.02,1.12,zl-.36,GL,tag,0))
        o.append(uv_by(box('gate top rail',2.45,TOP+1.42,zc,.1,.08,zl,CL,tag,0),clad_strip(.1,.4)))
        for e,k in ((z0,1),(z1,-1)):
            if abs(e)<25.9:o.append(uv_by(box('gate housing',2.45,TOP+.72,e+k*.2,.2,1.44,.4,CL,tag,0),lambda p,n:((6.4)/LT.CLAD_U,(1.2+(p.y-TOP)*.8)/LT.CLAD_V)))
            else:o.append(box('gate post',2.45,TOP+.72,e,.08,1.44,.08,ST,tag,0))
    # roof: curved standing-seam sheet on fish-belly steel ribs, columns either side of the platform
    pts,arc,nrm=roof_curve();th=.16;ZR=30.5;A=LT.ROOF_ARC;RV=LT.ROOF_V;items=[]
    top=[(x+nx*th,y+ny*th) for (x,y),(nx,ny) in zip(pts,nrm)]
    for i in range(len(pts)-1):
        (x0,y0),(x1,y1)=pts[i],pts[i+1];(tx0,ty0),(tx1,ty1)=top[i],top[i+1];nx,ny=nrm[i]
        items.append(([(x0,y0,-ZR),(x1,y1,-ZR),(x1,y1,ZR),(x0,y0,ZR)],[(.5+arc[i]/A*.5,-ZR/RV),(.5+arc[i+1]/A*.5,-ZR/RV),(.5+arc[i+1]/A*.5,ZR/RV),(.5+arc[i]/A*.5,ZR/RV)],(-nx,-ny,0)))
        items.append(([(tx0,ty0,-ZR),(tx1,ty1,-ZR),(tx1,ty1,ZR),(tx0,ty0,ZR)],[(arc[i]/A*.5,-ZR/RV),(arc[i+1]/A*.5,-ZR/RV),(arc[i+1]/A*.5,ZR/RV),(arc[i]/A*.5,ZR/RV)],(nx,ny,0)))
    for z,k in ((-ZR,-1),(ZR,1)):
        ring=[(x,y,z) for x,y in pts]+[(x,y,z) for x,y in reversed(top)]
        items.append((ring,[(.01,.5)]*len(ring),(0,0,k)))
    for i,k in ((0,-1),(-1,1)):
        (x,y),(tx,ty)=pts[i],top[i];items.append(([(x,y,-ZR),(tx,ty,-ZR),(tx,ty,ZR),(x,y,ZR)],[(.01,0),(.01,.1),(.01,.1),(.01,0)],(k,0,0)))
    o.append(polys('roof sheet',items,RF,tag,smooth=True,sharp=40))
    for zr in range(-27,28,6):
        it=[];dep=lambda t:.1+.3*math.sin(math.pi*t)
        low=[(x-nx*dep(i/(len(pts)-1)),y-ny*dep(i/(len(pts)-1))) for i,((x,y),(nx,ny)) in enumerate(zip(pts,nrm))]
        for i in range(len(pts)-1):
            (x0,y0),(x1,y1)=pts[i],pts[i+1];(lx0,ly0),(lx1,ly1)=low[i],low[i+1]
            it.append(([(lx0,ly0,zr-.08),(lx1,ly1,zr-.08),(lx1,ly1,zr+.08),(lx0,ly0,zr+.08)],[(0,0)]*4,(-nrm[i][0],-nrm[i][1],0)))
            for e,k in ((zr-.08,-1),(zr+.08,1)):it.append(([(x0,y0,e),(x1,y1,e),(lx1,ly1,e),(lx0,ly0,e)],[(0,0)]*4,(0,0,k)))
        o.append(polys('roof rib',it,ST,tag))
    o.append(box('eave gutter',1.52,TOP+3.47,0,.18,.16,61,ST,tag,0))
    o.append(uv_by(box('eave fascia',1.45,TOP+3.62,0,.05,.3,61,CL,tag,0),lambda p,n:(11.8/LT.CLAD_U,(.25+(p.y-TOP-3.47)*3.2)/LT.CLAD_V)))
    o.append(box('outer gutter',9.3,TOP+3.72,0,.2,.18,61,ST,tag,0))
    for x,zs in ((3.3,(-24,-12,0,12,24)),(7.35,(-24,-12,-2.1,2.1,12,24))):
        h=roof_height(x)-TOP
        for z in zs:
            o.append(cyl('roof column',x,TOP+h/2,z,.13,h,ST,tag,verts=12))
            o.append(cyl('column base',x,TOP+.08,z,.22,.16,ST,tag,verts=12))
            o.append(box('column head',x,TOP+h-.15,z,.34,.3,.34,ST,tag,.02))
    # outer screen on the platform's back edge: perforated panels, glass over them, gap for the bridge
    for z0,z1 in ((-29.4,-1.6),(1.6,29.4)):
        k=int(round((z1-z0)/1.2))
        for i in range(k):
            a=z0+i*(z1-z0)/k;b=a+(z1-z0)/k;u0=5.85/LT.CLAD_U;u1=7.05/LT.CLAD_U;v0=.5/LT.CLAD_V;v1=1.6/LT.CLAD_V
            q=[(7.62,TOP,a),(7.62,TOP,b),(7.62,TOP+1.1,b),(7.62,TOP+1.1,a)];uvq=[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]
            o.append(polys('screen panel',[(q,uvq,(1,0,0)),(q,uvq,(-1,0,0))],CL,tag))
        zc,zl=(z0+z1)/2,z1-z0
        o.append(box('screen glass',7.62,TOP+1.9,zc,.02,1.5,zl,GL,tag,0))
        o.append(box('screen rail',7.62,TOP+2.68,zc,.08,.08,zl,ST,tag,0))
        o.append(box('screen rail',7.62,TOP+1.12,zc,.08,.06,zl,ST,tag,0))
        for i in range(k+1):
            tall=i%3==0;o.append(box('screen mullion',7.62,TOP+(1.35 if tall else .55),z0+i*(z1-z0)/k,.06,2.7 if tall else 1.1,.06,ST,tag,0))
    # furniture: benches, bins, LED passenger information displays, the sign frame for the name label
    for z in (-19.5,-7.5,7.5,19.5):
        o.append(box('bench seat',6.55,TOP+.45,z,.45,.05,1.8,ST,tag,0))
        o.append(box('bench back',6.8,TOP+.72,z,.05,.45,1.8,ST,tag,0))
        for dz in (-.8,.8):o.append(box('bench leg',6.6,TOP+.22,z+dz,.4,.44,.06,ST,tag,0))
        o.append(cyl('bin',7.1,TOP+.45,z+1.5,.2,.9,ST,tag,verts=10))
    dsp=lambda p,n:((11.8)/LT.CLAD_U,(7.5+(p.y-TOP-2.6)*2)/LT.CLAD_V) if abs(n.x)>.7 else ((11.8)/LT.CLAD_U,3.0/LT.CLAD_V)
    for z in (-12,12):
        o.append(box('display housing',4.9,TOP+2.6,z,.18,.5,2.3,ST,tag,0))
        for s in (-1,1):o.append(uv_by(box('display face',4.9+s*.095,TOP+2.6,z,.01,.36,2.1,CL,tag,0),dsp))
        for dz in (-.9,.9):o.append(cyl('display rod',4.9,(TOP+2.85+roof_height(4.9))/2,z+dz,.02,roof_height(4.9)-TOP-2.85,ST,tag,verts=6))
    sy=RAIL+3.1
    for y in (sy+.47,sy-.47):o.append(box('sign bar',4.9,y,0,.08,.06,5.7,ST,tag,0))
    for dz in (-2.82,2.82):
        o.append(box('sign bar',4.9,sy,dz,.08,1.0,.06,ST,tag,0))
        o.append(cyl('sign rod',4.9,(sy+.5+roof_height(4.9))/2,dz,.02,roof_height(4.9)-sy-.5,ST,tag,verts=6))
    # link bridge to the stair tower
    o.append(uv_by(box('bridge floor',9.15,TOP-.03,0,3.1,.06,3.0,FL,tag,0),floor_uv))
    o.append(box('bridge deck',9.15,TOP-.25,0,3.1,.38,3.0,C,tag,.02))
    for z in (-1.45,1.45):
        o.append(box('bridge glass',9.15,TOP+1.2,z,3.0,2.2,.02,GL,tag,0))
        o.append(box('bridge rail',9.15,TOP+1.02,z,3.0,.05,.06,ST,tag,0))
        o.append(box('bridge kick',9.15,TOP+.1,z,3.0,.2,.08,ST,tag,0))
        for x in (7.8,9.15,10.5):o.append(box('bridge post',x,TOP+1.2,z,.08,2.4,.08,ST,tag,0))
    br=box('bridge roof',9.1,TOP+2.5,0,3.4,.12,3.5,RF,tag,.02);uv_by(br,lambda p,n:((p.x-7.4)/LT.ROOF_ARC*.5 if n.y>0 else .5+(p.x-7.4)/LT.ROOF_ARC*.5,p.z/LT.ROOF_V));o.append(br)
    # stair tower: glazed stairwell over the entrance on the -x face, perforated metal elsewhere
    x0,x1,zh=11.8-LT.TOWER_W/2,11.8+LT.TOWER_W/2,LT.TOWER_D/2;H=TOP+3.2
    W,D=LT.TOWER_W,LT.TOWER_D
    def tower_uv(p,n):
        if n.y>.7 or n.y<-.7:return (.5/LT.CLAD_U,.2/LT.CLAD_V)
        if n.x<-.7:t=p.z+zh
        elif n.z>.7:t=D+(p.x-x0)
        elif n.x>.7:t=D+W+(zh-p.z)
        else:t=2*D+W+(x1-p.x)
        return (t/LT.CLAD_U,p.y/LT.CLAD_V)
    o.append(uv_by(box('stair tower',11.8,H/2,0,W,H,D,CL,tag,0),tower_uv))
    tr=box('tower roof',11.8,H+.12,0,W+.4,.24,D+.4,RF,tag,.03);uv_by(tr,lambda p,n:((p.x-10)/LT.ROOF_ARC*.5,p.z/LT.ROOF_V));o.append(tr)
    o.append(uv_by(box('entrance canopy',10.15,3.35,0,1.0,.14,3.2,CL,tag,0),lambda p,n:(11.8/LT.CLAD_U,.25/LT.CLAD_V)))
    # ground totem behind the name label the game draws at (9, 3.8)
    navy=lambda p,n:(11.8/LT.CLAD_U,5.0/LT.CLAD_V);red=lambda p,n:(11.8/LT.CLAD_U,6.2/LT.CLAD_V)
    # an open frame: the label (7 x 1.1 at x=9) fills it and reads from both sides
    for dz in (-3.62,3.62):o.append(uv_by(box('totem post',9,2.3,dz,.24,4.6,.24,CL,tag,.02),navy))
    o.append(uv_by(box('totem rail',9,3.14,0,.2,.18,7.3,CL,tag,.02),navy))
    o.append(uv_by(box('totem head',9,4.46,0,.2,.2,7.3,CL,tag,.02),navy))
    o.append(uv_by(box('totem cap',9,4.62,0,.24,.1,7.5,CL,tag,0),red))
    # night light pool on the platform
    q=[(2.6,TOP+.012,-29),(7.5,TOP+.012,-29),(7.5,TOP+.012,29),(2.6,TOP+.012,29)]
    o.append(polys('night wash',[(q,[(-29/3+.5,0),(-29/3+.5,1),(29/3+.5,1),(29/3+.5,0)],(0,1,0))],M['wash'],tag))
    for ob in o:
        if not ob.get('uv'):kit.uv_metres(ob)
    return o

# ------------------------------------------------------------------ train
def body_profile(w=3.8,y0=.5,y1=3.95,rt=.78,rb=.16):
    return rounded([(-w/2,y0,rb),(w/2,y0,rb),(w/2,y1,rt),(-w/2,y1,rt)],5)

NOSE_Y=[.3,.5,.72,1.6,2.1,2.42,3.3,3.62,3.95]
NOSE_Z=[6.70,6.74,6.80,6.79,6.73,6.66,6.36,6.20,5.95]
def nose_front(y):
    for i in range(len(NOSE_Y)-1):
        if NOSE_Y[i]<=y<=NOSE_Y[i+1]:return NOSE_Z[i]+(NOSE_Z[i+1]-NOSE_Z[i])*(y-NOSE_Y[i])/(NOSE_Y[i+1]-NOSE_Y[i])
    return NOSE_Z[0] if y<NOSE_Y[0] else NOSE_Z[-1]

def uv_body(p,n):
    if n.z>.5 and p.z>5.6:
        c,r,w,h,s=LT.FRONT;return px(c+min(abs(p.x),1.9)*s,r+(4.0-p.y)*s)
    if n.y>.72:
        c,r,w,h,s=LT.ROOF_R;return px(c+abs(p.z)*120,r+min(abs(p.x),1.9)*s)
    c,r,w,h,s=LT.WALL;return px(c+min(abs(p.z),6.8)*s,r+min(max(4.0-p.y,0),3.7)*s)

def surface(name,rings,m,tag,uvf,out,smooth=True):
    """Grid through rings of equal length [[(x,y,z)...]...]; faces between ring i and i+1."""
    items=[]
    for a,b in zip(rings,rings[1:]):
        for i in range(len(a)-1):
            q=[a[i],a[i+1],b[i+1],b[i]];c=Vector([sum(v[k] for v in q)/4 for k in range(3)])
            nq=newell([Vector(v) for v in q]).normalized();o_=out(c)
            if nq.dot(Vector(o_))<0:nq=-nq
            items.append((q,[uvf(Vector(v),nq) for v in q],o_))
    return polys(name,items,m,tag,smooth)

def sw(name):
    u=LT.swatch_uv(name);return lambda p,n:u

def coach(tag,cab):
    L=5.75;o=[];keep=[];TR=M['train']
    full=body_profile();n=len(full)
    k=min(range(n),key=lambda i:abs(full[i][1]-3.15) if full[i][0]>0 else 9)   # right wall top
    j=min(range(n),key=lambda i:abs(full[i][1]-3.15) if full[i][0]<0 else 9)   # left wall top
    # ring order: from the left wall top, down, under, up to the right wall top (walls); then over the roof
    walls=[full[(j+i)%n] for i in range((k-j)%n+1)]
    roofp=[full[(k+i)%n] for i in range((j-k)%n+1)]
    axis_out=lambda c:(c.x,c.y-2.1,0)
    zs=[-L,-3.82,-2.18,0,2.18,3.82,L]
    wall_rings=[[(x,y,z) for x,y in walls] for z in zs]
    o.append(surface('body',wall_rings,TR,tag,uv_body,axis_out))
    roof_parts=[surface('roof shell',[[(x,y,z) for x,y in roofp] for z in zs],TR,tag,uv_body,axis_out)]
    if cab:
        rings=[]
        for s in (0,.3,.55,.72,.84,.92,.965,.99,1.0):
            f=max(1-s**4,0)**.25
            rings.append([(x*f,y,L+(nose_front(y)-L)*s) for x,y in full]+[(full[0][0]*f,full[0][1],L+(nose_front(full[0][1])-L)*s)])
        o.append(surface('nose',rings,TR,tag,uv_body,lambda c:(c.x,c.y-2.1,c.z-L+.5)))
    # saloon lining, ceiling, end walls, floor
    left,right=[(-1.83,.86),(-1.83,3.13)],[(1.83,.86),(1.83,3.13)]
    c,r,w,h,s=LT.LINING
    lining_uv=lambda p,nn:px(c+min(abs(p.z),5.8)*s,r+min(max(3.2-p.y,0),2.25)*s)
    for side in (left,right):
        z1=L+(.55 if cab else -.02)
        o.append(surface('lining',[[(x,y,z) for x,y in side] for z in (-L+.02,0,z1)],TR,tag,lining_uv,lambda cc:(-cc.x,0,0),smooth=False))
    cc,cr,cw,chh,cs=LT.CEIL
    ceil_uv=lambda p,nn:px(cc+min(abs(p.x),1.9)*cs,cr+min(abs(p.z),6.5)*cs)
    roof_parts.append(surface('ceiling',[[(-1.8,3.13,z),(0,3.13,z),(1.8,3.13,z)] for z in (-L,0,L)],TR,tag,ceil_uv,lambda cc:(0,-1,0),smooth=False))
    for x,y,z,w_,h_,d in ((0,4.12,-2.6,2.2,.3,2.3),(0,4.12,2.6,2.2,.3,2.3)):
        ac=box('aircon',x,y,z,w_,h_,d,TR,tag,.08);uv_by(ac,sw('aircon'));roof_parts.append(ac)
    keep.append(join(roof_parts,'roof',keep='roof'))
    ends=[-L] if cab else [-L,L]
    for z in ends:
        ring=[(x*.995,y,z*.998) for x,y in full]
        o.append(polys('end wall',[(ring,[LT.swatch_uv('white')]*n,(0,0,math.copysign(1,z))),(ring,[LT.swatch_uv('grey')]*n,(0,0,-math.copysign(1,z)))],TR,tag))
        gw=box('gangway',0,2.05,math.copysign(L+.12,z),1.7,2.3,.24,TR,tag,0);uv_by(gw,sw('rubber'));o.append(gw)
    fc,fr,fw,fh,fs=LT.FLOOR
    fl=box('floor',0,.82,(.45 if cab else 0),3.68,.06,2*L+(.9 if cab else 0),TR,tag,0)
    uv_by(fl,lambda p,nn:px(fc+min(abs(p.z),6.9)*fs,fr+min(abs(p.x),1.7)*fs) if nn.y>.7 else LT.swatch_uv('grey'));o.append(fl)
    # seats: longitudinal benches between the doors, blue moquette on a stainless frame
    sc,sr,sw_,sh,ss=LT.SEAT
    seat_uv=lambda p,nn:px(sc+10+min(abs(p.z)%1.5,1.49)*110,sr+10+min(max(1.9-p.y,0),1.0)*100)
    for s in (-1,1):
        for z0,z1 in ((-5.45,-4.05),(-1.95,1.95),(4.05,5.45)):
            zc,zl=(z0+z1)/2,z1-z0
            o.append(uv_by(box('seat',s*1.48,1.24,zc,.56,.14,zl,TR,tag,.03),seat_uv))
            o.append(uv_by(box('seat back',s*1.76,1.62,zc,.1,.62,zl,TR,tag,0),seat_uv))
            o.append(uv_by(box('seat frame',s*1.5,.98,zc,.46,.34,zl-.1,TR,tag,0),sw('seatframe')))
        o.append(uv_by(cyl('grab rail',s*1.12,2.95,0,.022,10.8,TR,tag,axis='z',verts=6),sw('pole')))
        for z in (-3,3):o.append(uv_by(cyl('door pole',s*.72,1.98,z,.022,2.26,TR,tag,verts=6),sw('pole')))
    for z in (-4.1,-1.0,1.0,4.1):o.append(uv_by(cyl('stanchion',0,1.98,z,.024,2.26,TR,tag,verts=6),sw('pole')))
    if cab:
        for s in (-1,1):
            o.append(uv_by(box('front seat',s*.85,1.24,L+.35,1.2,.14,.55,TR,tag,0),seat_uv))
            o.append(uv_by(box('front seat back',s*.85,1.6,L+.08,1.2,.6,.1,TR,tag,0),seat_uv))
        o.append(uv_by(box('anticlimber',0,.5,L+1.02,1.3,.24,.2,TR,tag,0),sw('under')))
        o.append(uv_by(box('coupler',0,.42,L+1.12,.34,.18,.3,TR,tag,0),sw('bogie')))
    # running gear: two bogies with LIM motors between the wheels, shoes on the power rail side
    for z in (-4.1,4.1):
        for s in (-1,1):o.append(uv_by(box('bogie side frame',s*1.02,.36,z,.14,.22,2.3,TR,tag,0),sw('bogie')))
        o.append(uv_by(box('bogie bolster',0,.44,z,2.2,.16,.4,TR,tag,0),sw('bogie')))
        for s in (-1,1):
            for dz in (-.75,.75):o.append(uv_by(cyl('wheel',s*.7175,.33,z+dz,.33,.1,TR,tag,axis='x',verts=14),sw('wheel')))
        o.append(uv_by(box('LIM motor',0,.18,z,.8,.14,2.0,TR,tag,0),sw('under')))
        o.append(uv_by(box('collector arm',-1.25,.17,z+.9,.7,.05,.14,TR,tag,0),sw('bogie')))
        for x in (-1.35,-1.55):o.append(uv_by(box('collector shoe',x,.085,z+.9,.1,.04,.3,TR,tag,0),sw('under')))
    for z in (-1.6,1.6):o.append(uv_by(box('underframe equipment',0,.36,z,2.4,.3,2.2,TR,tag,0),sw('under')))
    # doors: two double-leaf doors per side at z=+-3; P is the platform side (+x)
    dc,dr,dw,dh,ds=LT.DOOR
    for s in (-1,1):
        for i,zc in enumerate((-3,3)):
            for part,letter in ((-1,'a'),(1,'b')):
                lz=zc+part*.42
                leaf=box(f"door_{'P' if s>0 else 'N'}_{i+1}_{letter}",s*1.915,2.25,lz,.08,2.55,.8,TR,tag,0)
                uv_by(leaf,lambda p,nn,zc=zc:px(dc+min(max(.82-abs(p.z-zc),0),.8)*ds,dr+min(max(3.55-p.y,0),2.66)*ds) if abs(nn.x)>.7 else LT.swatch_uv('white'))
                leaf['keep']='door';keep.append(leaf)
    return o+keep

# ------------------------------------------------------------------ build / export
def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    materials()
    parts={'cab':coach('cab',True),'mid':coach('mid',False),'station':station(),'girder':girder(),'pier':pier()}
    empties={}
    for tag,objs in parts.items():
        e=bpy.data.objects.new(tag,None);s.collection.objects.link(e);empties[tag]=e
        for ob in objs:ob.parent=e
    return empties

def export(empties):
    files={'LM_LRT_Train.glb':['cab','mid'],'LM_LRT_Station.glb':['station'],'LM_LRT_Viaduct.glb':['girder','pier']}
    report={}
    for tag,e in empties.items():
        batches={}
        for ob in [c for c in e.children if c.type=='MESH' and not c.get('keep')]:
            batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            j=join(objs,f'{tag} | {" + ".join(key)}')
            if not any(n.type=='TEX_IMAGE' for m in j.data.materials for n in m.node_tree.nodes):
                for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    for name,tags in files.items():
        bpy.ops.object.select_all(action='DESELECT')
        for tag in tags:
            empties[tag].select_set(True)
            for c in empties[tag].children:c.select_set(True)
        path=PUBLIC/name
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,
            export_cameras=False,export_lights=False,export_extras=False,export_image_format='WEBP',export_image_quality=84)
        meshes=[c for tag in tags for c in empties[tag].children if c.type=='MESH']
        report[name]={'nodes':tags,'triangles':sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in meshes),
            'bytes':path.stat().st_size,'draws':{tag:sum(len(c.data.materials) for c in empties[tag].children if c.type=='MESH') for tag in tags},
            'materials':sorted({m.name for c in meshes for m in c.data.materials})}
    report['textures']=sorted(kit.IMAGES)
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print('LRT WEB EXPORT',json.dumps(report),flush=True)

def main(args):
    empties=build();export(empties)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'lrt.blend'))
