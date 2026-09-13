"""Masjid Kampung Maju, photographic pass: a neighbourhood masjid in the Malaysian manner, in
white render and marble, with a glazed star-and-cross onion dome, two minarets and a serambi.

What is here (local frame: +z is the entrance; world.ts turns the group to face the promenade)
  * prayer hall on a granite skirting: pointed-arch jali windows between pilasters, a green
    glazed frieze, marble cornice, merloned parapet, four corner cupolas and a qibla bay
  * serambi: marble floor, octagonal columns and pointed arches, a wide central bay under a
    raised portal with blind arcading and guldasta turrets, so the game's canvas name sign on
    the hall front stays readable; open teak doors onto a lit hall interior
  * dome: octagonal podium, sixteen-sided drum with jali clerestory windows, onion dome in
    glazed star-and-cross tiles below and plain teal glaze above, brass finial and crescent
  * minarets: square base, octagonal shaft, two corbelled balconies, an open chhatri lantern
    and a small tiled cupola with its crescent
  * grounds: polished granite plaza with a border inlay and a star medallion, a covered wuduk
    (ablution) area with taps, stools and a trough, shoe racks and slippers, glazed pots with
    palms, clipped ixora hedges and lanterns
  * night: materials named 'Night ...' are the contract with src/masjid.ts. LED green and
    lanterns/jali/interior emit only at night; 'Night wash warm|green' planes become additive
    uplight (walls) and green floodlight (domes) and are hidden by day
  * textures: procedural and tileable (masjid_textures.py over pbr_textures.py), WebP in the GLB

Same footprint as the procedural landmark in world.ts: plaza x +-19, z -11..17, top y .24, hall
x +-12.5, z +-7.5, minarets on 2.5 m bases at x +-15. Colliders stay in world.ts and the name
sign (0, 5.25, 7.7, 17 x .8) stays the game's canvas: this model only frames it.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_masjid.py
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Masjid.glb

Output: public/assets/models/environment/LM_ENV_Masjid.glb, node 'masjid' at the landmark origin.
"""
import bpy, bmesh, math, json, sys, random
from pathlib import Path
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,cyl,join,finish,box as lrt_box

import pbr_kit as kit
from pbr_kit import srgb,hmat,pbr,mesh
import masjid_textures as MT

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/masjid'; (OUT/'textures').mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
T='masjid'
kit.setup(T,OUT/'textures',20260914)

# ------------------------------------------------------------------ materials
def P(name,kind,tint,rough,tile,**kw):return pbr(name,kind,tint,rough,tile,source=MT,**kw)
RENDER=P('Render white','render','#ffffff',.88,2.5)
MARBLE=P('Marble white','marble','#ffffff',.32,1.6,strength=.6)
FLOOR=P('Serambi marble','marble_tiles','#fbfaf7',.18,1.2)
PLAZA=P('Plaza granite','granite_tiles','#eeeae2',.3,2.4)
GRANITE=P('Granite dark','granite_tiles','#8e8a84',.34,2.4)
GIRIH=P('Dome girih tiles','girih','#ffffff',.2,1.0);GIRIH['keep_uv']=True;del GIRIH['tile']
GLAZE=P('Dome glaze teal','glaze','#3d8e9c',.2,.8);GLAZE['keep_uv']=True;del GLAZE['tile']
GREEN=P('Green glazed tile','glaze','#3f8a5b',.28,.6)
WUDUK=P('Wuduk wall tile','glaze','#e2efe7',.3,.45)
TEAK=P('Teak','wood_small','#96633c',.55,.9)
JALI=P('Night glow jali','jali','#ffffff',.72,.5)
GOLD=hmat('Brass gold','#c9a24f',.3);STEEL=hmat('Stainless steel','#bfc4c7',.25);DARK=hmat('Lamp iron','#2b2a28',.6)
POT=hmat('Glazed pot','#2d5550',.3);SOIL=hmat('Soil','#3a2b20',.95)
LEAF=hmat('Palm leaf','#4f7d34',.6,two_sided=True);HEDGE=P('Ixora hedge','foliage','#ffffff',.7,1.1)
SLIPPER=hmat('Slippers dark','#2e2b2a',.7);SLIPPER2=hmat('Slippers blue','#2f5f9e',.6)
for m in (GOLD,):m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.35

def emissive(m,image=None,color=None):
    """Emission the runtime scales: a texture (jali openings, the lit interior) or a flat colour.
    Strength 1 in Blender so the exporter writes the emissive texture/factor; masjid.ts sets the
    real intensity (0 by day)."""
    nt=m.node_tree;p=nt.nodes['Principled BSDF']
    if image is not None:
        tx=nt.nodes.new('ShaderNodeTexImage');tx.image=image;nt.links.new(tx.outputs['Color'],p.inputs['Emission Color'])
    else:p.inputs['Emission Color'].default_value=(*srgb(color),1)
    p.inputs['Emission Strength'].default_value=1.0
    return m

def flat_textured(name,image,rough=.9,emit=False):
    """A colour image on explicit UVs, no normal map: the interior card and the wash planes."""
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF']
    tx=nt.nodes.new('ShaderNodeTexImage');tx.image=image;nt.links.new(tx.outputs['Color'],p.inputs['Base Color'])
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=0
    if emit:emissive(m,image)
    m['keep_uv']=True;m.use_backface_culling=True
    return m

emissive(JALI,kit.image('jali_glow',MT.jali_glow()))
INTERIOR=flat_textured('Night glow interior',kit.image('interior',MT.interior()),emit=True)
WASH_IMG=kit.image('wash',MT.wash())
WASH=flat_textured('Night wash warm',WASH_IMG);WASH_G=flat_textured('Night wash green',WASH_IMG)
LED=emissive(hmat('Night LED green','#dfe9e2',.4),color='#2ee07a')
LANTERN=emissive(hmat('Night lantern','#f4e7c6',.35),color='#ffc27a')

# ------------------------------------------------------------------ geometry helpers
def box(name,x,y,z,w,h,d,m,tag,bevel=0,rx=0):
    """build_lrt.box, bevelled only where an edge is big enough to catch the light: every bevel is
    two segments round all twelve edges, and on slippers and fixtures that is pure vertex cost."""
    return lrt_box(name,x,y,z,w,h,d,m,tag,bevel if min(w,h,d)>=.3 and max(w,h,d)>=1.2 else 0,rx)

def facing(ox,oz,nx,nz,y0=0.0):
    """Frame on a wall face: s runs to the viewer's right, y up, d out of the wall along (nx,nz)."""
    rx,rz=nz,-nx
    return lambda s,y,d:(ox+rx*s+nx*d,y0+y,oz+rz*s+nz*d)

def orient(ob,n):
    """Turn every face of a flat or open mesh toward the game-space direction n."""
    bn=Vector((n[0],-n[2],n[1]));bm=bmesh.new();bm.from_mesh(ob.data);bm.normal_update()
    flip=[f for f in bm.faces if f.normal.dot(bn)<0]
    if flip:bmesh.ops.reverse_faces(bm,faces=flip)
    bm.to_mesh(ob.data);bm.free();ob.data.update();return ob

def set_uv(ob,fn):
    """Explicit UVs from game-space vertex positions."""
    me=ob.data;uv=me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
    for li,loop in enumerate(me.loops):
        c=me.vertices[loop.vertex_index].co;uv.data[li].uv=fn(c.x,c.z,-c.y)
    return ob

def arch(a,R,n=7):
    """Two-centred pointed arch of half-span a and rise R: left springing -> apex -> right springing."""
    rho=(a*a+R*R)/(2*a);cx=a-rho;phi=math.atan2(R,rho-a)
    right=[(cx+rho*math.cos(phi*i/n),rho*math.sin(phi*i/n)) for i in range(n+1)]   # spring -> apex
    return [(-x,y) for x,y in right]+[(x,y) for x,y in right[::-1][1:]]

def opening(a,h,R,n=4):
    """Window/door outline: straight jambs of height h below the springing, then the arch."""
    return [(-a,-h)]+arch(a,R,n)+[(a,-h)]

def extrude(name,prof,F,d0,d1,m):
    """Prism of a 2D (s,y) outline between depths d0 and d1 of a wall frame F."""
    n=len(prof);verts=[pt(*F(s,y,d0)) for s,y in prof]+[pt(*F(s,y,d1)) for s,y in prof]
    faces=[(k,(k+1)%n,n+(k+1)%n,n+k) for k in range(n)]+[tuple(range(n))[::-1],tuple(range(n,2*n))]
    return mesh(name,verts,faces,m,smooth=False,closed=True)

def frame(name,path,width,F,d0,d1,m):
    """Moulding swept along an open outline (a window surround): `width` outward, d0..d1 deep."""
    n=len(path);norms=[]
    for i in range(n):
        p0=path[max(i-1,0)];p1=path[min(i+1,n-1)];tx,ty=p1[0]-p0[0],p1[1]-p0[1];l=math.hypot(tx,ty) or 1
        nx,ny=-ty/l,tx/l
        if 0<i<n-1:   # mitre at the apex cusp and corners
            a0=path[i-1];a1=path[i];ex,ey=a1[0]-a0[0],a1[1]-a0[1];el=math.hypot(ex,ey) or 1
            k=max(.35,abs(nx*(-ey/el)+ny*(ex/el)));nx,ny=nx/k,ny/k
        norms.append((nx,ny))
    verts=[]
    for (s,y),(nx,ny) in zip(path,norms):
        for ss,yy,d in ((s,y,d1),(s+nx*width,y+ny*width,d1),(s+nx*width,y+ny*width,d0),(s,y,d0)):verts.append(pt(*F(ss,yy,d)))
    faces=[]
    for i in range(n-1):
        a,b=4*i,4*(i+1)
        faces+=[(a+k,a+(k+1)%4,b+(k+1)%4,b+k) for k in range(4)]
    faces+=[(0,1,2,3),(4*(n-1)+3,4*(n-1)+2,4*(n-1)+1,4*(n-1))]
    return mesh(name,verts,faces,m,smooth=False,closed=True)

def panel(name,prof,F,d,m,normal,uv=None):
    ob=mesh(name,[pt(*F(s,y,d)) for s,y in prof],[tuple(range(len(prof)))],m,smooth=False)
    orient(ob,normal)
    if uv:set_uv(ob,uv)
    return ob

def revolve(name,prof,cx,cz,m,segs=24,urep=None,vlen=None,v0=0.0,closed=False,rot=0.0,conformal=False):
    """Surface of revolution through (r,y) profile points, seam duplicated so UVs can wrap:
    u = around x urep, v = arc length / vlen. conformal=True keeps texels square instead (v grows
    by ds x urep / 2 pi r), so tile patterns shrink toward a dome's tip the way laid tiles do.
    Open profiles face outward; closed ones are solids."""
    verts=[];uvs=[];arc=[0.0]
    for j in range(1,len(prof)):
        ds=math.hypot(prof[j][0]-prof[j-1][0],prof[j][1]-prof[j-1][1])
        arc.append(arc[-1]+(ds*urep/(2*math.pi*max((prof[j][0]+prof[j-1][0])/2,.05))*(vlen or 1) if conformal else ds))
    for j,(r,y) in enumerate(prof):
        for i in range(segs+1):
            t=rot+2*math.pi*i/segs;verts.append(pt(cx+r*math.cos(t),y,cz+r*math.sin(t)))
            uvs.append((i/segs*(urep or 1),v0+arc[j]/(vlen or 1)))
    W=segs+1;faces=[];rings=len(prof)
    for j in range(rings if closed else rings-1):   # a closed profile also bands its last point back to the first
        for i in range(segs):
            k=(j+1)%rings;a,b,c,d=j*W+i,j*W+i+1,k*W+i+1,k*W+i
            if prof[k][0]<1e-6:faces.append((a,d,b))
            elif prof[j][0]<1e-6:faces.append((a,d,c))
            else:faces.append((a,d,c,b))
    ob=mesh(name,verts,faces,m,smooth=True)
    # Outward, decided per face: open profiles face away from the axis; closed ones (rings, slabs)
    # away from the profile's centroid circle. recalc_face_normals is not used: the duplicated UV
    # seam leaves the ring non-manifold and it turned the inner walls of balcony parapets inside out.
    rc=sum(r for r,_ in prof)/len(prof) if closed else 0.0;yc=sum(y for _,y in prof)/len(prof)
    bm=bmesh.new();bm.from_mesh(ob.data);bm.normal_update();flip=[]
    for f in bm.faces:
        c=f.calc_center_median();dx,dy=c.x-cx,c.y+cz;d=math.hypot(dx,dy) or 1
        ref=Vector((cx+dx/d*rc,-cz+dy/d*rc,yc if closed else c.z))
        if f.normal.dot(c-ref)<0:flip.append(f)
    if flip:bmesh.ops.reverse_faces(bm,faces=flip)
    bm.to_mesh(ob.data);bm.free();ob.data.update()
    if urep:
        me=ob.data;uv=me.uv_layers.new(name='UVMap')
        for li,loop in enumerate(me.loops):uv.data[li].uv=uvs[loop.vertex_index]
    return ob

def prism(name,cx,cz,r,y0,y1,sides,m,flat_front=True):
    """Regular prism (octagonal shafts, the drum). flat_front puts a face, not an edge, toward +z."""
    rot=math.pi/sides if flat_front else 0
    ring=[(cx+r*math.cos(rot+2*math.pi*k/sides),cz+r*math.sin(rot+2*math.pi*k/sides)) for k in range(sides)]
    verts=[pt(x,y0,z) for x,z in ring]+[pt(x,y1,z) for x,z in ring];n=sides
    faces=[(k,(k+1)%n,n+(k+1)%n,n+k) for k in range(n)]+[tuple(range(n)),tuple(range(n,2*n))]
    return mesh(name,verts,faces,m,smooth=False,closed=True)

def ring_band(name,cx,cz,r,y,h,m,segs=32):
    """Open outward band: LED strips and brass bands."""
    return revolve(name,[(r,y),(r,y+h)],cx,cz,m,segs)

def annulus(name,cx,cz,r0,r1,y0,y1,m,segs=24):
    return revolve(name,[(r0,y0),(r1,y0),(r1,y1),(r0,y1)],cx,cz,m,segs,closed=True)

def wall(name,F,s0,s1,y0,y1,m,normal,step=.75):
    """A wall face as a grid, so vertex grime has somewhere to live."""
    nx=max(1,round((s1-s0)/step));ny=max(1,round((y1-y0)/step));verts=[]
    for j in range(ny+1):
        for i in range(nx+1):verts.append(pt(*F(s0+(s1-s0)*i/nx,y0+(y1-y0)*j/ny,0)))
    faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
    return orient(mesh(name,verts,faces,m,smooth=False),normal)

def onion_profile(R,H,y0,t0=0.0,t1=1.0):
    """Malaysian onion dome: base .86R, bulge R a quarter of the way up, a full shoulder, then an
    ogee neck drawn in to the finial."""
    key=[(0,.86),(.06,.94),(.14,.99),(.24,1.0),(.34,.975),(.44,.93),(.54,.84),(.63,.72),(.71,.57),(.78,.42),(.84,.28),(.89,.17),(.93,.10),(.965,.05),(1.0,0)]
    return [(R*f,y0+H*t) for t,f in key if t0-1e-9<=t<=t1+1e-9]

def cone(name,x,y,z,r1,r2,h,m,verts=8):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=h,location=pt(x,y,z))
    o=bpy.context.object;finish(o,name,m,T)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o

def crescent(name,x,y,z,r,m,th=.08,n=14):
    """Upright crescent seen from the front and back, horns up: the outer circle's lower arc
    between the tips at 55 and 125 degrees, and an inner circle (centre .262r, radius .8r) through
    the same tips."""
    outer=[(r*math.cos(t),r*math.sin(t)) for t in [math.radians(125+290*i/n) for i in range(n+1)]]
    q,c=.8*r,.262*r;a0,a1=math.radians(44.1),math.radians(-224.1)
    inner=[(q*math.cos(t),c+q*math.sin(t)) for t in [a0+(a1-a0)*i/n for i in range(1,n)]]
    F=lambda s,yy,d:(x+s,y+yy,z+d)
    return extrude(name,outer+inner,F,-th/2,th/2,m)

def finial(o,x,y,z,s=1.0,moon=True):
    """Brass finial: collar, stacked bulbs on a rod, crescent on top (Malaysian mastaka)."""
    sub=2 if s>1 else 1
    o.append(cone('finial collar',x,y+.12*s,z,.32*s,.12*s,.24*s,GOLD,12))
    o.append(kit.ico('finial bulb',x,y+.42*s,z,.26*s,GOLD,1.0,sub))
    o.append(cyl('finial rod',x,y+1.0*s,z,.045*s,1.2*s,GOLD,T,verts=8))
    o.append(kit.ico('finial bulb',x,y+.95*s,z,.16*s,GOLD,1.0,sub))
    o.append(kit.ico('finial bulb',x,y+1.35*s,z,.11*s,GOLD,1.0,1))
    if moon:o.append(crescent('crescent',x,y+1.95*s,z,.42*s,GOLD,.06*s))

def wash(o,F,s,y0,w,h,normal,green=False,d=.03):
    """Night uplight plane: u across, v up; the fixture is at the bottom (v=0)."""
    prof=[(s-w/2,0),(s+w/2,0),(s+w/2,h),(s-w/2,h)]
    ob=mesh('uplight wash',[pt(*F(px,y0+py,d)) for px,py in prof],[(0,1,2,3)],WASH_G if green else WASH,smooth=False)
    orient(ob,normal);me=ob.data;uv=me.uv_layers.new(name='UVMap')
    for li,loop in enumerate(me.loops):
        k=loop.vertex_index;uv.data[li].uv=((0,0),(1,0),(1,1),(0,1))[k]
    o.append(ob)
    fx,fy,fz=F(s,y0+.05,.12);o.append(box('uplight fixture',fx,fy,fz,.22,.1,.18,DARK,T,.01))

# ------------------------------------------------------------------ openings
def window(o,F,normal,s,sill,a,h,R,frame_w=.15,depth=.14,glow=True):
    prof=opening(a,h,R);F2=lambda ss,yy,d:F(s+ss,sill+h+yy,d)
    o.append(panel('jali window',prof,F2,.012,JALI,normal))
    o.append(frame('window surround',prof,frame_w,F2,0,depth,MARBLE))
    o.append(extrude('window sill',[(-a-frame_w-.08,-h-.1),(a+frame_w+.08,-h-.1),(a+frame_w+.08,-h),(-a-frame_w-.08,-h)],F2,0,depth+.06,MARBLE))

def doorway(o,F,normal,s,a,h,R,floor=.27):
    prof=opening(a,h,R);F2=lambda ss,yy,d:F(s+ss,floor+h+yy,d)
    o.append(panel('hall interior',prof,F2,.01,INTERIOR,normal,uv=None))
    ob=o[-1];me=ob.data;uv=me.uv_layers.new(name='UVMap')
    for li,loop in enumerate(me.loops):
        ss,yy=prof[loop.vertex_index];uv.data[li].uv=((ss+a)/(2*a),(yy+h)/(h+R))
    o.append(frame('door surround',prof,.28,F2,0,.32,MARBLE))
    for side in (-1,1):   # teak leaves swung right back against the wall, beside the surround
        x,_,z=F(s+side*(a+.72),0,.05)
        o.append(box('door leaf',x,floor+h/2,z,.8 if normal[2] else .06,h-.05,.06 if normal[2] else .8,TEAK,T))
        x,_,z=F(s+side*(a+.72),0,.09)
        for yy in (floor+.9,floor+h-.5):o.append(box('door panel moulding',x,yy,z,.6 if normal[2] else .02,.5,.02 if normal[2] else .6,TEAK,T))

# ------------------------------------------------------------------ plaza and grounds
def plaza():
    o=[box('plaza rim',0,.06,3,38,.12,28,GRANITE,T,.02),box('plaza',0,.12,3,37.1,.24,27.1,PLAZA,T,.01)]
    # border inlay of dark granite, and the approach band to the portal
    for x0,x1,z0,z1 in ((-17.6,17.6,15.35,15.8),(-17.6,17.6,-9.8,-9.35),(-17.6,-17.15,-9.8,15.8),(17.15,17.6,-9.8,15.8)):
        o.append(box('border inlay',(x0+x1)/2,.245,(z0+z1)/2,x1-x0,.012,z1-z0,GRANITE,T,0))
    for s in (-1,1):o.append(box('approach band',s*3.4,.245,13.6,.35,.012,4.1,GRANITE,T,0))
    # eight-point star medallion on the approach
    star=[];
    for k in range(16):
        r=2.0 if k%2==0 else 2.0*.62;t=math.pi*2*k/16;star.append((r*math.cos(t),r*math.sin(t)))
    inner=[(x*.55,z*.55) for x,z in star]
    for prof,m,y,name in ((star,MARBLE,.252,'medallion'),(inner,GRANITE,.256,'medallion core')):
        ob=mesh(name,[pt(x,y,13.6+z) for x,z in prof],[tuple(range(16))],m,smooth=False);orient(ob,(0,1,0));o.append(ob)
    return o

def hedge(x0,x1,z):
    """Clipped ixora in a granite planter: a rounded block carrying the foliage texture."""
    return [box('planter curb',(x0+x1)/2,.47,z,x1-x0,.46,.95,GRANITE,T,.03),
            box('ixora hedge',(x0+x1)/2,.98,z,x1-x0-.1,.62,.82,HEDGE,T,.2)]

def potted_palm(x,z,seed=0):
    """Glazed urn with an areca palm: arching pinnate fronds from a short clump."""
    R=random.Random(seed);o=[]
    prof=[(0,.24),(.30,.26),(.40,.40),(.46,.62),(.42,.84),(.36,.95),(.40,1.0)]
    o.append(revolve('pot',prof,x,z,POT,20))
    o.append(kit.mesh('pot soil',[pt(x+.37*math.cos(2*math.pi*k/12),.95,z+.37*math.sin(2*math.pi*k/12)) for k in range(12)],[tuple(range(12))],SOIL,smooth=False))
    orient(o[-1],(0,1,0))
    verts=[];faces=[]
    for f in range(9):
        a=f*2.4+R.uniform(-.2,.2);L=R.uniform(1.1,1.5);elev=math.radians(R.uniform(45,75))
        base=Vector((x+math.cos(a)*.05,.95,z+math.sin(a)*.05));hx,hz=math.cos(a),math.sin(a)
        rach=[base+Vector((hx*L*t*math.cos(elev),L*t*math.sin(elev)-L*.75*t*t,hz*L*t*math.cos(elev))) for t in [i/6 for i in range(7)]]
        across=Vector((-hz,0,hx))
        for q in range(12):
            t=.15+.8*q/11;si=min(int(t*6),5);u=t*6-si;p=rach[si].lerp(rach[si+1],u);along=(rach[si+1]-rach[si]).normalized()
            ll=.32*math.sin(math.pi*min(1,t*1.1))+.08
            for sgn in (-1,1):
                tip=p+(across*sgn*.8+Vector((0,-.45,0))+along*.5).normalized()*ll;b=len(verts)
                verts+=[p-along*.025,p+along*.025,tip];faces.append((b,b+1,b+2))
        for i in range(6):
            b=len(verts);p0,p1=rach[i],rach[i+1];w=across*.012
            verts+=[p0+w,p0-w,p1-w,p1+w];faces.append((b,b+1,b+2,b+3))
    o.append(kit.mesh('areca fronds',[(v.x,-v.z,v.y) for v in verts],faces,LEAF))
    return o

def lamp_post(x,z):
    o=[box('lamp plinth',x,.45,z,.45,.42,.45,GRANITE,T,.03),cyl('lamp post',x,2.1,z,.07,3.0,DARK,T,verts=10)]
    o.append(prism('lamp lantern',x,z,.2,3.6,4.1,8,LANTERN))
    o.append(cone('lamp cap',x,4.25,z,.28,.02,.32,DARK,8));o.append(box('lamp collar',x,3.56,z,.34,.08,.34,DARK,T,.01))
    return o

def shoe_rack(x,z):
    """Teak rack of three shelves facing the plaza, slippers on it and a few pairs left by it."""
    o=[];w=2.2;R=random.Random(int(x*13))
    for s in (-1,1):o.append(box('rack side',x+s*(w/2-.02),.72,z,.04,.96,.4,TEAK,T,.005))
    for y in (.36,.66,.96,1.18):o.append(box('rack shelf',x,y,z,w,.03,.4,TEAK,T,.005))
    o.append(box('rack back',x,.77,z-.19,w,.82,.02,TEAK,T,0))
    for y in (.39,.69,.99):
        px=x-w/2+.2
        while px<x+w/2-.2:
            if R.random()<.45:
                m=SLIPPER if R.random()<.7 else SLIPPER2
                for d in (-.06,.06):o.append(box('slipper',px+d,y+.02,z+.02,.1,.03,.26,m,T,.01))
            px+=R.uniform(.28,.36)
    for _ in range(3):
        px,pz=x+R.uniform(-1.2,1.2),z+R.uniform(.45,1.1);a=R.uniform(-.6,.6);m=SLIPPER if R.random()<.6 else SLIPPER2
        for d in (-.07,.07):
            ob=box('slipper',px+d*math.cos(a),.265,pz-d*math.sin(a),.1,.03,.26,m,T,.01);ob.rotation_euler.z=a;o.append(ob)
    return o

def wuduk():
    """Covered ablution area on the east side: tiled tap wall over a steel trough, stools, a slab
    roof on four columns with a green fascia and two downlights."""
    o=[];x0,x1,z0,z1=-18.9,-13.4,-10.5,-2.2;cx,cz=(x0+x1)/2,(z0+z1)/2
    o.append(box('wuduk platform',cx,.27,cz,x1-x0,.06,z1-z0,GRANITE,T,.01))
    wx=-18.35
    o.append(box('tap wall',wx,.78,cz,.3,.96,7.6,WUDUK,T,.02));o.append(box('tap wall coping',wx,1.29,cz,.4,.06,7.7,MARBLE,T,.01))
    o.append(box('trough',wx+.42,.36,cz,.52,.12,7.6,STEEL,T,.02));o.append(box('trough lip',wx+.66,.44,cz,.05,.1,7.6,STEEL,T,0))
    for i in range(8):
        tz=z0+.95+i*.93
        o.append(cyl('tap arm',wx+.25,1.0,tz,.022,.22,STEEL,T,axis='x',verts=8))
        o.append(cyl('tap spout',wx+.35,.95,tz,.018,.12,STEEL,T,verts=8))
        o.append(box('tap handle',wx+.24,1.06,tz,.03,.05,.12,STEEL,T,0))
        o.append(cyl('wuduk stool',wx+1.15,.49,tz,.17,.4,GRANITE,T,verts=12))
    for x in (x0+.3,x1-.3):
        for z in (z0+.3,z1-.3):o.append(prism('canopy column',x,z,.14,.3,3.2,8,RENDER))
    o.append(box('canopy roof',cx,3.33,cz,x1-x0+.4,.26,z1-z0+.4,RENDER,T,.02))
    for xx,zz,w,d in ((cx,z0-.21,x1-x0+.44,.04),(cx,z1+.21,x1-x0+.44,.04),(x0-.21,cz,.04,z1-z0+.44),(x1+.21,cz,.04,z1-z0+.44)):
        o.append(box('canopy fascia',xx,3.3,zz,w,.2,d,GREEN,T,0))
    for zz in (cz-2.2,cz+2.2):o.append(cyl('canopy downlight',cx,3.19,zz,.14,.03,LANTERN,T,verts=12))
    return o

# ------------------------------------------------------------------ prayer hall
HX,HZ,WALL0,WALL1=12.5,7.5,1.1,6.15
def hall():
    o=[box('hall skirting',0,.67,0,25.24,.86,15.24,GRANITE,T,.02)]
    front=facing(0,HZ,0,1);rear=facing(0,-HZ,0,-1);east=facing(-HX,0,-1,0);west=facing(HX,0,1,0)
    o.append(wall('hall wall',front,-HX,HX,WALL0,WALL1,RENDER,(0,0,1)))   # sheltered: no streaks
    o.append(wall('hall wall',rear,-HX,HX,WALL0,WALL1,RENDER,(0,0,-1)));o[-1]['ledges']=[6.15]
    o.append(wall('hall wall',east,-HZ,HZ,WALL0,WALL1,RENDER,(-1,0,0)));o[-1]['ledges']=[6.15]
    o.append(wall('hall wall',west,-HZ,HZ,WALL0,WALL1,RENDER,(1,0,0)));o[-1]['ledges']=[6.15]
    o.append(box('hall cornice',0,6.25,0,25.5,.2,15.5,MARBLE,T,.03))
    o.append(box('hall roof',0,6.55,0,25.3,.4,15.3,RENDER,T,.02))
    # green glazed frieze under the cornice, sides and rear
    o.append(box('frieze',0,5.8,-HZ-.03,24.2,.3,.06,GREEN,T,0))
    for s in (-1,1):o.append(box('frieze',s*(HX+.03),5.8,-.4,.06,.3,14.2,GREEN,T,0))
    # parapet with pointed merlons
    for x,z,w,d in ((0,7.525,25.3,.25),(0,-7.525,25.3,.25),(12.525,0,.25,14.8),(-12.525,0,.25,14.8)):
        o.append(box('parapet',x,7.0,z,w,.5,d,RENDER,T,.02));o.append(box('parapet coping',x,7.28,z,w+.08 if w>1 else .33,.06,d+.08 if d>1 else .33,MARBLE,T,.01))
    merlon=[(-.17,0),(.17,0),(.17,.2),(0,.46),(-.17,.2)]
    def merlons(F,s0,s1):
        k=int((s1-s0)/1.0)
        for i in range(k):o.append(extrude('merlon',merlon,lambda s,y,d,c=s0+(i+.5)*(s1-s0)/k:F(c+s,7.31+y,d),-.08,.08,RENDER))
    merlons(facing(0,7.525,0,1),-12.4,12.4);merlons(facing(0,-7.525,0,-1),-12.4,12.4)
    merlons(facing(12.525,0,1,0),-7.0,7.0);merlons(facing(-12.525,0,-1,0),-7.0,7.0)
    # corner piers carrying small cupolas
    for sx in (-1,1):
        for sz in (-1,1):
            x,z=sx*12.3,sz*7.3
            o.append(box('corner pier',x,3.62,z,.9,5.05,.9,RENDER,T,.02));o[-1]['ledges']=[6.15]
            o.append(prism('cupola drum',x,z,.55,6.75,7.85,8,RENDER))
            o.append(prism('cupola coping',x,z,.64,7.85,7.97,8,MARBLE))
            o.append(ring_band('cupola led',x,z,.645,7.9,.05,LED,16))
            o.append(revolve('cupola dome',onion_profile(.66,1.3,7.97),x,z,GLAZE,12,urep=6,vlen=.5))
            finial(o,x,9.2,z,.5)
    # pilasters and windows: rear wall (qibla bay in the middle), both side walls
    for s in (-7.05,-2.35,2.35,7.05):o.append(box('pilaster',s,3.62,-HZ-.06,.45,5.05,.12,RENDER,T,.01))
    for s in (-2.45,2.45):
        for sx in (-1,1):o.append(box('pilaster',sx*(HX+.06),3.62,s,.12,5.05,.45,RENDER,T,.01))
    for s in (-9.4,-4.7,4.7,9.4):window(o,rear,(0,0,-1),s,1.6,.75,2.4,.95)
    o.append(box('qibla bay',0,3.62,-HZ-.25,3.3,5.05,.5,RENDER,T,.02));o[-1]['ledges']=[6.15]
    o.append(box('qibla bay frieze',0,5.8,-HZ-.52,3.3,.3,.06,GREEN,T,0))
    window(o,facing(0,-HZ-.5,0,-1),(0,0,-1),0,1.4,.9,2.8,1.15)
    for sx,F,n in ((-1,east,(-1,0,0)),(1,west,(1,0,0))):
        for s in (-4.9,4.9):window(o,F,n,s,1.6,.75,2.4,.95)
    # front, under the serambi: three doors, two windows, the frame for the game's name sign
    for s in (-4.4,0,4.4):doorway(o,front,(0,0,1),s,1.0,2.63,1.25)
    for s in (-9.2,9.2):window(o,front,(0,0,1),s,1.3,.72,1.7,.85)
    o.append(box('sign frame',0,5.25,7.56,18.0,1.5,.12,MARBLE,T,.02))
    o.append(box('sign border',0,5.25,7.64,17.5,1.06,.04,GREEN,T,0))
    return o

# ------------------------------------------------------------------ serambi
COL_Z=11.0;SPRING=3.85;ROOF0,ROOF1=6.0,6.4
def column(o,x,z):
    o.append(box('column base',x,.5,z,.6,.46,.6,MARBLE,T,.03))
    o.append(prism('column shaft',x,z,.22,.73,3.37,8,MARBLE))
    o.append(cone('column capital',x,3.52,z,.24,.37,.3,MARBLE,8))
    o.append(box('column impost',x,3.76,z,.64,.18,.64,MARBLE,T,.02))

def serambi():
    o=[box('serambi floor',0,.255,9.55,26.9,.03,4.1,FLOOR,T,0)]
    front=facing(0,COL_Z,0,1)
    for sx in (-1,1):
        column(o,sx*9.7,COL_Z)
        o.append(box('portal pier',sx*6.5,3.13,COL_Z,.9,5.72,.9,RENDER,T,.02));o[-1]['ledges']=[6.0]
        o.append(box('pier base',sx*6.5,.52,COL_Z,1.02,.5,1.02,MARBLE,T,.03))
        o.append(box('pier capital',sx*6.5,3.75,COL_Z,1.02,.2,1.02,MARBLE,T,.02))
        o.append(box('corner pier',sx*12.95,3.13,COL_Z,.8,5.72,.8,RENDER,T,.02));o[-1]['ledges']=[6.0]
        o.append(box('pier base',sx*12.95,.52,COL_Z,.92,.5,.92,MARBLE,T,.03))
        # two pointed bays each side between the portal pier, the column and the corner pier
        for xa,xb,ia,ib in ((6.5,9.7,.45,.32),(9.7,12.95,.32,.4)):
            xa,xb=sx*xa,sx*xb
            lo,hi=min(xa,xb),max(xa,xb);l_in=lo+(ia if sx>0 else ib);r_in=hi-(ib if sx>0 else ia)
            a=(r_in-l_in)/2;c=(r_in+l_in)/2;R=a*1.35
            prof=[(lo-c,0)]+arch(a,R)+[(hi-c,0),(hi-c,ROOF0-SPRING),(lo-c,ROOF0-SPRING)]
            F=lambda s,y,d,c=c:front(c+s,SPRING+y,d)
            o.append(extrude('spandrel',prof,F,-.22,.22,RENDER));o[-1]['ledges']=[6.0]
            o.append(frame('archivolt',arch(a,R),.13,F,.22,.27,GREEN))
    # side ends of the serambi: one arch each between the hall corner and the corner pier
    for sx in (-1,1):
        a=(10.6-7.95)/2;cz=9.27
        F=lambda s,y,d,sx=sx:(sx*12.95+sx*d,SPRING+y,cz-sx*s)   # s along -z on the +x end, +z on the -x end
        R=a*1.35;prof=[(-a-.4,0)]+arch(a,R)+[(a+.4,0),(a+.4,ROOF0-SPRING),(-a-.4,ROOF0-SPRING)]
        o.append(extrude('end spandrel',prof,F,-.22,.22,RENDER))
        o.append(frame('archivolt',arch(a,R),.13,F,.22,.27,GREEN))
    o.append(box('serambi roof',0,6.2,9.5,27.3,.4,4.2,RENDER,T,.02))
    o.append(box('serambi fascia',0,6.22,11.62,27.4,.36,.1,MARBLE,T,.01))
    o.append(box('serambi frieze',0,6.1,11.68,27.1,.14,.03,GREEN,T,0))
    for x in (-12.95,-9.7,-6.5,6.5,9.7,12.95):o.append(box('soffit beam',x,5.83,9.37,.34,.34,3.34,RENDER,T))
    for x in (-11.3,-8.1,-3.4,0,3.4,8.1,11.3):o.append(cyl('soffit downlight',x,5.985,9.6,.12,.03,LANTERN,T,verts=12))
    # parapets either side of the portal
    for sx in (-1,1):
        o.append(box('serambi parapet',sx*10.2,6.65,11.45,6.5,.5,.22,RENDER,T,.02))
        o.append(box('serambi parapet',sx*13.53,6.65,9.5,.22,.5,4.1,RENDER,T,.02))
        o.append(box('parapet coping',sx*10.2,6.93,11.45,6.58,.06,.3,MARBLE,T,.01))
        merlon=[(-.15,0),(.15,0),(.15,.16),(0,.38),(-.15,.16)]
        for i in range(8):
            c=sx*(7.35+i*.78);o.append(extrude('merlon',merlon,lambda s,y,d,c=c:(c+s,6.96+y,11.45+d),-.07,.07,RENDER))
    # the portal: a raised frontispiece over the wide central bay, blind arcading, guldasta turrets
    o.append(box('portal wall',0,7.35,COL_Z+.05,13.9,2.7,.62,RENDER,T,.02));o[-1]['ledges']=[8.7]
    o.append(box('portal beam fascia',0,6.2,COL_Z+.38,13.0,.4,.06,MARBLE,T,.01))
    o.append(box('portal cornice',0,8.75,COL_Z+.05,14.2,.2,.8,MARBLE,T,.02))
    o.append(box('portal frieze',0,8.5,COL_Z+.37,13.0,.22,.03,GREEN,T,0))
    pF=facing(0,COL_Z+.36,0,1)
    for i in range(5):
        s=-4.8+i*2.4;a=.62;R=.8;prof=opening(a,.55,R);F2=lambda ss,yy,d,s=s:pF(s+ss,6.8+.55+yy,d)
        o.append(panel('portal jali',prof,F2,.01,JALI,(0,0,1)))
        o.append(frame('blind arch surround',prof,.1,F2,0,.08,MARBLE))
    crest=[(-.2,0),(.2,0),(.2,.18)]+[(x,y+.18) for x,y in arch(.2,.3,2)][::-1][1:-1]+[(-.2,.18)]
    for i in range(15):
        c=-6.3+i*.9;o.append(extrude('portal merlon',crest,lambda s,y,d,c=c:(c+s,8.85+y,COL_Z+.05+d),-.09,.09,RENDER))
    o.append(box('portal led',0,8.86,COL_Z+.46,13.4,.05,.04,LED,T,0))
    for sx in (-1,1):
        x=sx*6.95
        o.append(prism('guldasta',x,COL_Z+.05,.4,6.0,9.5,8,RENDER))
        for y in (7.2,8.3):o.append(prism('guldasta band',x,COL_Z+.05,.44,y,y+.12,8,MARBLE))
        o.append(prism('guldasta coping',x,COL_Z+.05,.5,9.5,9.62,8,MARBLE))
        o.append(ring_band('guldasta led',x,COL_Z+.05,.505,9.56,.05,LED,16))
        o.append(revolve('guldasta dome',onion_profile(.5,1.05,9.62),x,COL_Z+.05,GLAZE,12,urep=5,vlen=.45))
        finial(o,x,10.62,COL_Z+.05,.42)
    return o

# ------------------------------------------------------------------ main dome
DOME_R,DOME_H,DOME_Y=5.7,7.3,10.85
def dome():
    o=[prism('dome podium',0,0,6.45,6.75,7.3,8,RENDER),prism('podium coping',0,0,6.55,7.3,7.38,8,MARBLE)]
    o.append(prism('drum',0,0,5.15,7.38,10.45,16,RENDER));o[-1]['ledges']=[10.45]
    ap=5.15*math.cos(math.pi/16)
    for k in range(16):
        t=2*math.pi*k/16;nx,nz=math.cos(t),math.sin(t);F=facing(nx*ap,nz*ap,nx,nz)
        if k%2==0:window(o,F,(nx,0,nz),0,8.05,.4,1.25,.58,frame_w=.1,depth=.09)
        else:o.append(box('drum pilaster',nx*(ap+.05),8.9,nz*(ap+.05),.26,3.05,.26,MARBLE,T,.01));o[-1].rotation_euler.z=-t
    o.append(prism('drum frieze',0,0,5.19,10.05,10.32,16,GREEN))
    o.append(prism('drum cornice',0,0,5.45,10.45,10.68,16,MARBLE))
    o.append(ring_band('drum led',0,0,5.47,10.6,.05,LED,48))
    o.append(revolve('dome collar',[(5.05,10.68),(4.95,10.85)],0,0,GOLD,48))
    cut=.84;lower=onion_profile(DOME_R,DOME_H,DOME_Y,0,cut);upper=onion_profile(DOME_R,DOME_H,DOME_Y,cut,1)
    o.append(revolve('dome tiles',lower,0,0,GIRIH,48,urep=20,conformal=True))
    o.append(revolve('dome glaze',upper,0,0,GLAZE,24,urep=12,vlen=.4))
    o.append(ring_band('dome band',0,0,DOME_R*.28,DOME_Y+DOME_H*cut-.06,.12,GOLD,24))
    finial(o,0,DOME_Y+DOME_H-.25,0,1.15)
    # green floodlight shell over the dome, lit from the roof (hidden by day)
    shell=[(r*1.012,y) for r,y in onion_profile(DOME_R,DOME_H,DOME_Y,0,.93)]
    ob=revolve('dome floodlight',shell,0,0,WASH_G,48);me=ob.data;uv=me.uv_layers.new(name='UVMap')
    for li,loop in enumerate(me.loops):
        i,j=loop.vertex_index%49,loop.vertex_index//49;uv.data[li].uv=(.5+.03*math.sin(i/48*2*math.pi*6),.08+j/(len(shell)-1)*.87)   # an even wash from the roof, brightest low
    o.append(ob)
    return o

# ------------------------------------------------------------------ minarets
def minaret(sx):
    x=sx*15.0;o=[]
    o.append(box('minaret plinth',x,.55,0,2.5,1.1,2.5,GRANITE,T,.03))
    o.append(box('minaret base',x,3.72,0,2.3,5.25,2.3,RENDER,T,.02));o[-1]['ledges']=[6.35]
    o.append(box('minaret frieze',x,6.05,0,2.36,.28,2.36,GREEN,T,0))
    o.append(box('minaret cornice',x,6.45,0,2.6,.2,2.6,MARBLE,T,.02))
    for F,n in ((facing(x+sx*1.15,0,sx,0),(sx,0,0)),(facing(x,1.15,0,1),(0,0,1)),(facing(x,-1.15,0,-1),(0,0,-1))):
        window(o,F,n,0,3.3,.36,.9,.5,frame_w=.1,depth=.1)
    o.append(cone('minaret chamfer',x,6.78,0,1.4,1.08,.46,RENDER,8));o[-1].rotation_euler.z=math.pi/8
    U=1.5   # the shaft is lifted so the lantern clears the raised main dome's finial
    o.append(prism('minaret shaft',x,0,1.08,7.0,13.0+U,8,RENDER));o[-1]['ledges']=[12.6+U]
    for y in (9.6,12.2+U):o.append(prism('shaft band',x,0,1.12,y,y+.15,8,MARBLE))
    o.append(prism('shaft frieze',x,0,1.1,11.6+U,11.9+U,8,GREEN))
    def balcony(y,rs,rb,h):
        o.append(revolve('balcony corbel',[(rs,y-.7),(rb,y)],x,0,RENDER,16))
        o.append(annulus('balcony floor',x,0,.1,rb+.06,y,y+.15,MARBLE,16))
        o.append(annulus('balcony parapet',x,0,rb-.12,rb,y+.15,y+.15+h,RENDER,16))
        o.append(annulus('balcony coping',x,0,rb-.16,rb+.04,y+.15+h,y+.22+h,MARBLE,16))
        o.append(ring_band('balcony led',x,0,rb+.045,y+.16+h,.05,LED,32))
    balcony(13.3+U,1.1,1.72,.85)
    o.append(prism('upper shaft',x,0,.9,13.45+U,17.6+U,8,RENDER));o[-1]['ledges']=[17.0+U]
    o.append(prism('shaft band',x,0,.94,15.8+U,15.95+U,8,MARBLE))
    balcony(17.6+U,.92,1.36,.72)
    # open chhatri: eight slender columns round a lantern, ring beam, tiled cupola
    for k in range(8):
        t=2*math.pi*(k+.5)/8;o.append(prism('chhatri column',x+.72*math.cos(t),.72*math.sin(t),.06,18.47+U,20.0+U,6,MARBLE))
    o.append(prism('chhatri lantern',x,0,.34,18.47+U,19.9+U,8,LANTERN))
    o.append(annulus('chhatri beam',x,0,.2,.92,20.0+U,20.24+U,MARBLE,16))
    o.append(ring_band('chhatri led',x,0,.925,20.08+U,.05,LED,24))
    o.append(revolve('minaret cupola',onion_profile(1.0,2.0,20.24+U),x,0,GLAZE,20,urep=8,vlen=.55))
    finial(o,x,22.1+U,0,.62)
    shell=[(r*1.02,y) for r,y in onion_profile(1.0,2.0,20.24+U,0,.9)]
    ob=revolve('cupola floodlight',shell,x,0,WASH_G,20);me=ob.data;uv=me.uv_layers.new(name='UVMap')
    for li,loop in enumerate(me.loops):
        i,j=loop.vertex_index%21,loop.vertex_index//21;uv.data[li].uv=(.5+.03*math.sin(i/20*2*math.pi*4),.08+j/(len(shell)-1)*.87)
    o.append(ob)
    return o

# ------------------------------------------------------------------ night uplights
def washes():
    o=[];front=facing(0,HZ,0,1);rear=facing(0,-HZ,0,-1)
    for s in (-11.2,11.2):wash(o,front,s,.27,2.2,5.6,(0,0,1))
    for sx in (-1,1):
        wash(o,facing(sx*6.5,COL_Z+.45,0,1),0,.27,1.8,8.6,(0,0,1))
        wash(o,facing(sx*12.95,COL_Z+.4,0,1),0,.27,1.5,5.6,(0,0,1))
        side=facing(sx*HX,0,sx,0)
        for s in (-4.9,4.9):wash(o,side,s,1.1,2.8,5.0,(sx,0,0))
        mx=sx*15.0
        wash(o,facing(mx+sx*1.15,0,sx,0),0,1.1,2.2,5.3,(sx,0,0))
        wash(o,facing(mx,1.15,0,1),0,1.1,2.2,5.3,(0,0,1))
        ap=1.08*math.cos(math.pi/8)
        wash(o,facing(mx+sx*ap,0,sx,0),0,7.0,.85,5.8,(sx,0,0),d=.02)
    for s in (-9.4,-4.7,4.7,9.4):wash(o,rear,s,1.1,2.8,5.0,(0,0,-1))
    wash(o,facing(0,-HZ-.5,0,-1),0,1.1,3.2,5.0,(0,0,-1))
    return o

# ------------------------------------------------------------------ grime, UVs, build, export
def uv_world(ob):
    """Real-world box UVs in world space: walls take v up, floors take x/z, and every face of one
    material lines up with its neighbours."""
    me=ob.data;mw=ob.matrix_world;nm=mw.to_3x3().inverted_safe().transposed()
    uv=me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        mm=me.materials[f.material_index];tile=mm['tile'];n=(nm@f.normal).normalized()
        for li in f.loop_indices:
            c=mw@me.vertices[me.loops[li].vertex_index].co
            if abs(n.z)>=max(abs(n.x),abs(n.y)):u,v=c.x,c.y
            elif abs(n.x)>abs(n.y):u,v=(c.y if n.x>0 else -c.y),c.z
            else:u,v=(-c.x if n.y>0 else c.x),c.z
            uv.data[li].uv=(u/tile,v/tile)

def grime(ob):
    """Linear vertex colour for render: splash-back at the foot, rain streaks under ledges that
    wander along the wall, broad unevenness. 1.0 is clean (glTF clamps there)."""
    me=ob.data;mw=ob.matrix_world;ledges=list(ob.get('ledges',[]))
    attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT')
    for k,v in enumerate(me.vertices):
        c=mw@v.co;x,y,z=c.x,c.z,-c.y
        g=1-.15*max(0.0,1-(y-.25)/1.1)**2
        for top in ledges:
            d=top-y
            if 0<=d<3.4:
                s=noise.noise(Vector((x*.9+z*.9,top*3.1,.37)))+.35*noise.noise(Vector((x*3.1+z*3.1,top,1.7)))
                g*=1-.11*min(1.0,max(0.0,s+.1)*1.6)*(1-d/3.4)**1.5
        g*=1+.025*noise.noise(Vector((x*.23,y*.31,z*.23)))
        g=min(1.0,g);attr.data[k].color=(g,g*.995,g*.985,1)
    me.color_attributes.active_color=attr

def props():
    return plaza()+hall()+serambi()+dome()+minaret(-1)+minaret(1)+wuduk()+washes()+ \
        shoe_rack(-10.4,12.25)+shoe_rack(10.4,12.25)+potted_palm(-5.3,12.5,1)+potted_palm(5.3,12.5,2)+ \
        potted_palm(-17.6,-1.6,3)+potted_palm(17.6,-1.6,4)+hedge(-17.8,-8.4,16.25)+hedge(8.4,17.8,16.25)+ \
        lamp_post(-17.9,13.2)+lamp_post(17.9,13.2)+lamp_post(17.9,-10.1)+lamp_post(-12.0,-10.1)

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    e=bpy.data.objects.new(T,None);s.collection.objects.link(e)
    items=[p for p in props() if p]
    bpy.context.view_layer.update()
    for ob in items:
        ob.parent=e
        mats=[m for m in ob.data.materials if m]
        if mats and all('tile' in m for m in mats):uv_world(ob)
        if mats and mats[0].name==RENDER.name:grime(ob)
    return e

def export(e):
    batches={}
    for ob in [c for c in e.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        mats=[m for m in objs[0].data.materials if m]
        if any(o.data.color_attributes for o in objs):
            for o in objs:
                if not o.data.color_attributes:
                    a=o.data.color_attributes.new('Color','FLOAT_COLOR','POINT')
                    for d in a.data:d.color=(1,1,1,1)
                    o.data.color_attributes.active_color=a
        j=join(objs,f'masjid | {" + ".join(key)}')
        if not any(('tile' in m) or m.get('keep_uv') for m in mats):
            for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
    for c in e.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Masjid.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
        export_image_format='WEBP',export_image_quality=82,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
    night=sorted(c.name.split(' | ')[1] for c in e.children if c.type=='MESH' and 'Night' in c.name)
    report={'asset':'LM_ENV_Masjid','origin':[0,0,0],'footprint':{'plaza':[[-19,19],[-11,17]],'hall':[[-12.5,12.5],[-7.5,7.5]],'minarets':[-15,15]},
        'sign':{'x':0,'y':5.25,'z':7.7,'w':17,'h':.8},'night_materials':night,
        'textures':sorted(kit.IMAGES),'triangles':tris,'bytes':path.stat().st_size,'draws':len(e.children)}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('MASJID WEB EXPORT',json.dumps(report),flush=True)

if __name__=='__main__':
    e=build();export(e)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'masjid.blend'))
