"""Photographic street furniture for the Lepak city: the DBKL street lamp, Malaysian traffic signals,
bus shelters, bins, bollards, the two Jalur Gemilang flags, the street-sign frames, the courtyard
bunting and the KLCC plaza fountain. Textures: furniture_textures.py (+ ground_textures concrete).

Two outputs share this kit:
  * LM_PROP_StreetLamp.glb  (run this file)      one node, two materials: 'Satin metal' body and
    'Lamp LED lens'. Base at the origin, arm along +x, lens centred on the head anchor (.85, 5.3, 0)
    that src/world.ts and src/mamak-streets.ts place the lit shell, halo and light pool around.
  * LM_ENV_Furniture.glb    (build_zoo.py --only=Furniture calls furniture())  absolute coordinates.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/furniture_models.py
node scripts/blender/compress-glb.mjs public/assets/models/props/LM_PROP_StreetLamp.glb

Material names are runtime contracts (src/brands.ts lightBrands):
  'Satin metal'            galvanised steel; reflects brands.ts's painted street
  'Night glow LED'         signal lenses: their own emission map, brighter at night
  'Night glow menu advert' the shelter lightbox poster
Geometry is authored in game coordinates (y up) into per-material triangle sets and flushed as one
Blender object per material. Every part gets outward faces (closed parts by signed volume, open
parts by a facing hint), metre UVs for tiled textures, and a linear vertex colour (tint, rust,
grime) so one draw carries a black signal housing and a green bin.
"""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt
import pbr_kit as kit
import pbr_textures as PT
import ground_textures as GT
import furniture_textures as FT

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/furniture';TEX=OUT/'textures'
TAU=math.tau

# ------------------------------------------------------------------ colour
def lin(h):return kit.srgb(h)
GALV=lin('#ffffff');BLACK=(.018,.019,.02);CHARCOAL=(.07,.075,.08);WHITE=(.86,.86,.84)
DBKL_GREEN=lin('#1c6a3c');YELLOW=lin('#f2c200');CONCRETE=(.82,.81,.78);RUST=(.30,.13,.05)

# ------------------------------------------------------------------ materials
def _in_tex(fn):
    old=kit.OUT;TEX.mkdir(parents=True,exist_ok=True);kit.OUT=TEX
    try:return fn()
    finally:kit.OUT=old

def tiled(name,kind,rough,tile,metal=0.0,strength=1.0,source=FT):
    m=_in_tex(lambda:kit.pbr(name,kind,'#ffffff',rough,tile,strength=strength,source=source))
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=metal
    return m

def picture(name,key,arr,rough=.5,emit=False,two_sided=False,normal=None,metal=0.0):
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF']
    im=_in_tex(lambda:kit.image(key,arr))
    tx=nt.nodes.new('ShaderNodeTexImage');tx.image=im;nt.links.new(tx.outputs['Color'],p.inputs['Base Color'])
    if emit:nt.links.new(tx.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=1.0
    if normal is not None:
        tn=nt.nodes.new('ShaderNodeTexImage');tn.image=_in_tex(lambda:kit.image(key+'_normal',normal,True))
        nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(tn.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    m.use_backface_culling=not two_sided;m['keep_uv']=True
    return m

class Lib:
    def __init__(self,lamp=False):
        if lamp:
            self.GALV=tiled('Satin metal','galvanised_lamp',.42,.6,metal=.55,strength=.6)
            self.LENS=picture('Lamp LED lens','led_lens',FT.led_lens(),rough=.18)
            return
        self.GALV=tiled('Satin metal','galvanised',.42,.6,metal=.55,strength=.6)
        self.POWDER=tiled('Street powder coat','powder',.55,.5,strength=.5)
        self.CONC=tiled('Street concrete','concrete',.9,2.0,source=GT)
        cloth,cloth_n=FT.cloth()
        self.CLOTH=picture('Flag cloth','flag_cloth',cloth,rough=.54,two_sided=True,normal=FT._half(cloth_n))
        # A flag is satin polyester: soft sheen over a fairly rough weave, with no metallic coat.
        fabric_bsdf=self.CLOTH.node_tree.nodes.get('Principled BSDF')
        if fabric_bsdf:
            for socket,value in (('Sheen Weight',.24),('Sheen Roughness',.28),('Specular IOR Level',.32)):
                if fabric_bsdf.inputs.get(socket): fabric_bsdf.inputs[socket].default_value=value
        self.CLOTH['surface']='polyester flag fabric'
        signs=FT.signs()
        self.SIGNS=picture('Road signs','road_signs',signs,rough=.35)
        self.ADVERT=picture('Night glow menu advert','road_signs',signs,rough=.2,emit=True)
        self.LENS=picture('Night glow LED','signal_lenses',FT.signal(),rough=.12,emit=True)
        self.TERRAZZO=tiled('Fountain terrazzo','terrazzo',.45,1.2,strength=.4)
        self.MOSAIC=tiled('Fountain mosaic','mosaic',.25,.8,strength=.5)
        w=bpy.data.materials.new('Fountain water');w.use_nodes=True;nt=w.node_tree;p=nt.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value=(.10,.30,.33,1);p.inputs['Roughness'].default_value=.04;p.inputs['Alpha'].default_value=.62
        tn=nt.nodes.new('ShaderNodeTexImage');tn.image=_in_tex(lambda:kit.image('fountain_water_normal',PT.water_normal(256),True))
        nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.6
        nt.links.new(tn.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
        w.surface_render_method='BLENDED';w.use_backface_culling=False;w['keep_uv']=True;self.WATER=w
        j=bpy.data.materials.new('Fountain jet');j.use_nodes=True;p=j.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value=(.85,.93,.95,1);p.inputs['Roughness'].default_value=.1;p.inputs['Alpha'].default_value=.55
        j.surface_render_method='BLENDED';j.use_backface_culling=False;self.JET=j

# ------------------------------------------------------------------ geometry sets
def _sub(a,b):return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def _dot(a,b):return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def _newell(P):
    n=[0.0,0.0,0.0]
    for i,a in enumerate(P):
        b=P[(i+1)%len(P)];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1])
    return tuple(n)

class Part:
    """Vertices, polygon faces and per-corner metre UVs in a local frame (game axes)."""
    def __init__(self,V=None,F=None,UV=None,smooth=False):
        self.V=list(V or []);self.F=list(F or []);self.UV=list(UV or []);self.smooth=smooth
    def face(self,idx,uvs):self.F.append(tuple(idx));self.UV.append(tuple(uvs))

class Geo:
    def __init__(self,tag):
        self.tag=tag;self.sets={};self.rng=random.Random(20260914)
    def add(self,m,part,col=(1,1,1),closed=True,hint=None,at=(0,0,0),yaw=0.0,scale=1.0,rust=0.0,grime=0.0,uv_raw=False):
        """Place a part: orient its faces, tile its UVs by the material's 'tile' (atlas UVs pass
        through), rotate by yaw about y, scale, translate, and paint vertex colour."""
        V,F,UV=part.V,list(part.F),list(part.UV)
        if closed and F:
            c=[sum(v[i] for v in V)/len(V) for i in range(3)];vol=0.0
            for f in F:
                P=[V[i] for i in f];n=_newell(P);fc=[sum(p[i] for p in P)/len(P) for i in range(3)]
                vol+=_dot(_sub(fc,c),n)
            if vol<0:F=[f[::-1] for f in F];UV=[u[::-1] for u in UV]
        elif hint is not None:
            for k,f in enumerate(F):
                P=[V[i] for i in f];h=hint(P) if callable(hint) else hint
                if _dot(_newell(P),h)<0:F[k]=f[::-1];UV[k]=UV[k][::-1]
        tile=m.get('tile') if not uv_raw else None
        off=(self.rng.random()*5,self.rng.random()*5) if tile else (0,0)
        if tile:UV=[tuple((u/tile+off[0],v/tile+off[1]) for u,v in f) for f in UV]
        s=self.sets.setdefault(m.name,{'m':m,'V':[],'F':[],'UV':[],'C':[],'S':[]})
        base=len(s['V']);cy,sy=math.cos(yaw),math.sin(yaw)
        for x,y,z in V:
            wx=at[0]+(x*cy+z*sy)*scale;wy=at[1]+y*scale;wz=at[2]+(-x*sy+z*cy)*scale
            k=1.0;r=0.0
            if grime:k*=1-grime*max(0.0,1-y/1.0)**2
            if rust:
                nz=.5+.5*noise.noise(Vector((wx*7.1,wy*9.3,wz*7.7)))
                r=rust*min(1.0,max(0.0,(.55-y)/.5)*(.35+.9*nz))
            cc=tuple(min(.95,(col[i]*(1-r)+RUST[i]*r)*k*(1+.05*noise.noise(Vector((wx*.9,wy*.9,wz*.9))))) for i in range(3))
            s['V'].append((wx,wy,wz));s['C'].append(cc)
        for f,u in zip(F,UV):s['F'].append(tuple(base+i for i in f));s['UV'].append(u);s['S'].append(part.smooth)
        return self
    def flush(self,prefix,only=None,skip=()):
        obs=[]
        for name,s in self.sets.items():
            if not s['F'] or name in skip or (only and name not in only):continue
            me=bpy.data.meshes.new(f'{prefix} {name}')
            # pt() is a rotation (game y up -> Blender z up), so game-space winding carries over as is
            me.from_pydata([pt(*v) for v in s['V']],[],s['F']);me.update()
            uv=me.uv_layers.new(name='UVMap')
            for poly,u in zip(me.polygons,s['UV']):
                for li,c in zip(poly.loop_indices,u):uv.data[li].uv=c
            attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT')
            for i,c in enumerate(s['C']):attr.data[i].color=(*c,1.0)
            me.color_attributes.active_color=attr
            for poly,sm in zip(me.polygons,s['S']):poly.use_smooth=sm
            me.set_sharp_from_angle(angle=math.radians(38))
            ob=bpy.data.objects.new(f'{prefix} {name}',me);bpy.context.scene.collection.objects.link(ob)
            me.materials.append(s['m']);ob['asset']=self.tag;ob['uv']=True;obs.append(ob)
        self.sets={}
        return obs

# ------------------------------------------------------------------ primitives (local frames)
def box(cx,cy,cz,w,h,d):
    p=Part();x0,x1,y0,y1,z0,z1=cx-w/2,cx+w/2,cy-h/2,cy+h/2,cz-d/2,cz+d/2
    quads=[((x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1),'xy'),((x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0),'xy'),
           ((x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1),'zy'),((x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0),'zy'),
           ((x0,y1,z1),(x1,y1,z1),(x1,y1,z0),(x0,y1,z0),'xz'),((x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1),'xz')]
    for q in quads:
        i=len(p.V);p.V+=q[:4];ax=q[4]
        uv=[(v[0],v[1]) if ax=='xy' else (v[2],v[1]) if ax=='zy' else (v[0],v[2]) for v in q[:4]]
        p.face((i,i+1,i+2,i+3),uv)
    return p

def rings(stations,n,cx=0.0,cz=0.0,cap0=True,cap1=True,phase=0.0,smooth=True,axis='y'):
    """Loft of circles: stations [(along, r)] along y (or x / z). UV u = arc length, v = along."""
    p=Part(smooth=smooth)
    def P(a,r,t):
        c,s=math.cos(t)*r,math.sin(t)*r
        return (cx+c,a,cz+s) if axis=='y' else (a,cx+c,cz+s) if axis=='x' else (cx+c,cz+s,a)
    for a,r in stations:
        for k in range(n+1):p.V.append(P(a,r,phase+TAU*k/n))
    for s in range(len(stations)-1):
        a0,r0=stations[s];a1,r1=stations[s+1]
        for k in range(n):
            i=s*(n+1)+k;j=i+n+1
            u0=TAU*k/n*(r0+r1)/2;u1=TAU*(k+1)/n*(r0+r1)/2
            p.face((i,i+1,j+1,j),[(u0,a0),(u1,a0),(u1,a1),(u0,a1)])
    for cap,(a,r),ring in ((cap0,stations[0],0),(cap1,stations[-1],len(stations)-1)):
        if cap and r>0:
            idx=[ring*(n+1)+k for k in range(n)]
            p.face(idx,[(math.cos(phase+TAU*k/n)*r,math.sin(phase+TAU*k/n)*r) for k in range(n)])
    return p

def tube(path,radius,n=8,cap0=True,cap1=True,smooth=True):
    """Tube through local points with parallel-transport rings; radius one number or per point."""
    rs=radius if isinstance(radius,(list,tuple)) else [radius]*len(path)
    P=[Vector(q) for q in path];p=Part(smooth=smooth);u=None;L=[0.0]
    for i in range(1,len(P)):L.append(L[-1]+(P[i]-P[i-1]).length)
    for i,c in enumerate(P):
        t=(P[min(i+1,len(P)-1)]-P[max(i-1,0)]).normalized()
        if u is None:u=t.cross(Vector((0,0,1)) if abs(t.z)<.9 else Vector((1,0,0))).normalized()
        else:u=(u-t*u.dot(t)).normalized()
        v=t.cross(u)
        for k in range(n+1):
            a=TAU*k/n;q=c+(u*math.cos(a)+v*math.sin(a))*rs[i];p.V.append((q.x,q.y,q.z))
    for s in range(len(P)-1):
        for k in range(n):
            i=s*(n+1)+k;j=i+n+1;r=(rs[s]+rs[s+1])/2
            p.face((i,i+1,j+1,j),[(TAU*k/n*r,L[s]),(TAU*(k+1)/n*r,L[s]),(TAU*(k+1)/n*r,L[s+1]),(TAU*k/n*r,L[s+1])])
    if cap0:p.face([k for k in range(n)],[(0,0)]*n)
    if cap1:p.face([(len(P)-1)*(n+1)+k for k in range(n)],[(0,0)]*n)
    return p

def prism(profile,s0,s1,axis='z',caps=True,smooth=False):
    """Extrude a convex outline (a,b) along an axis: 'z' -> (x=a,y=b), 'x' -> (z=a,y=b), 'y' -> (x=a,z=b)."""
    n=len(profile);p=Part(smooth=smooth)
    def P(a,b,s):return (a,b,s) if axis=='z' else (s,b,a) if axis=='x' else (a,s,b)
    per=[0.0]
    for i in range(n):a,b=profile[i];c,d=profile[(i+1)%n];per.append(per[-1]+math.hypot(c-a,d-b))
    for s in (s0,s1):
        for a,b in profile:p.V.append(P(a,b,s))
    for i in range(n):
        j=(i+1)%n;p.face((i,j,n+j,n+i),[(per[i],s0),(per[i+1],s0),(per[i+1],s1),(per[i],s1)])
    if caps:
        p.face(list(range(n)),list(profile));p.face([n+i for i in range(n)],list(profile))
    return p

def band(outer,inner,s0,s1,axis='z',front=True,back=False):
    """Extruded strip between two matching polylines (a visor hood, a curved roof sheet)."""
    n=len(outer);p=Part();ring=outer+inner[::-1]
    def P(a,b,s):return (a,b,s) if axis=='z' else (s,b,a) if axis=='x' else (a,s,b)
    for s in (s0,s1):
        for a,b in ring:p.V.append(P(a,b,s))
    m=len(ring);per=[0.0]
    for i in range(m):a,b=ring[i];c,d=ring[(i+1)%m];per.append(per[-1]+math.hypot(c-a,d-b))
    for i in range(m):
        j=(i+1)%m;p.face((i,j,m+j,m+i),[(per[i],s0),(per[i+1],s0),(per[i+1],s1),(per[i],s1)])
    for cap,off in ((back,0),(front,m)):
        if not cap:continue
        for i in range(n-1):
            a,b,c,d=off+i,off+i+1,off+m-2-i,off+m-1-i
            p.face((a,b,c,d),[ring[i],ring[i+1],ring[m-2-i],ring[m-1-i]])
    return p

def quad(P,uv):
    p=Part();p.V=list(P);p.face((0,1,2,3),uv);return p

def rrect(w,h,r,n=3,cx=0.0,cy=0.0):
    """Rounded rectangle outline, counter-clockwise."""
    pts=[]
    for qx,qy,a0 in ((1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)):
        ox,oy=cx+qx*(w/2-r),cy+qy*(h/2-r)
        for k in range(n+1):a=math.radians(a0+90*k/n);pts.append((ox+math.cos(a)*r,oy+math.sin(a)*r))
    return pts

def disc(cx,cy,cz,r,n,uvc,uvr,facing='+z'):
    """Flat round lens facing +z/-z/+x/-x/-y with UVs from an atlas circle."""
    p=Part();p.V.append((cx,cy,cz));uvs=[]
    for k in range(n):
        a=TAU*k/n;c,s=math.cos(a)*r,math.sin(a)*r
        if facing in('+z','-z'):p.V.append((cx+c,cy+s,cz))
        elif facing in('+x','-x'):p.V.append((cx,cy+s,cz+c))
        else:p.V.append((cx+c,cy,cz+s))
        uvs.append((uvc[0]+math.cos(a)*uvr*(1 if facing in('+z','-x','-y') else -1),uvc[1]+math.sin(a)*uvr))
    for k in range(n):p.face((0,1+k,1+(k+1)%n),[uvc,uvs[k],uvs[(k+1)%n]])
    return p

def cell_uv(rect,inset=0.0):
    u0,v0,u1,v1=rect;du,dv=(u1-u0)*inset,(v1-v0)*inset
    return [(u0+du,v0+dv),(u1-du,v0+dv),(u1-du,v1-dv),(u0+du,v1-dv)]

def upright(cx,cy,cz,w,h,facing,uv):
    """Quad centred at (cx,cy,cz) facing '+z','-z','+x','-x'; uv lists (bl,br,tr,tl) as seen from the front."""
    hw,hh=w/2,h/2
    if facing=='+z':P=[(cx-hw,cy-hh,cz),(cx+hw,cy-hh,cz),(cx+hw,cy+hh,cz),(cx-hw,cy+hh,cz)]
    elif facing=='-z':P=[(cx+hw,cy-hh,cz),(cx-hw,cy-hh,cz),(cx-hw,cy+hh,cz),(cx+hw,cy+hh,cz)]
    elif facing=='+x':P=[(cx,cy-hh,cz+hw),(cx,cy-hh,cz-hw),(cx,cy+hh,cz-hw),(cx,cy+hh,cz+hw)]
    else:P=[(cx,cy-hh,cz-hw),(cx,cy-hh,cz+hw),(cx,cy+hh,cz+hw),(cx,cy+hh,cz-hw)]
    return quad(P,uv)

FACING={'+z':(0,0,1),'-z':(0,0,-1),'+x':(1,0,0),'-x':(-1,0,0),'-y':(0,-1,0),'+y':(0,1,0)}

# ================================================================== street lamp
LAMP_ANCHOR=(.85,5.3,0.0)
def street_lamp(g,L,at=(0,0,0),yaw=0.0,scale=1.0):
    """DBKL tapered octagonal galvanised pole on a rusting base plate, a swan-neck outreach arm and a
    slim die-cast LED lantern whose lens sits on the head anchor."""
    kw=dict(at=at,yaw=yaw,scale=scale)
    g.add(L.GALV,box(0,.015,0,.36,.03,.36),col=GALV,rust=.9,**kw)
    g.add(L.GALV,rings([(.03,.112),(.16,.11),(.42,.106),(5.12,.066)],8,phase=TAU/16,cap0=False,smooth=False),col=GALV,rust=.8,grime=.25,**kw)
    g.add(L.GALV,rings([(2.86,.094),(2.94,.094)],8,phase=TAU/16,smooth=False),col=GALV,**kw)       # slip joint
    g.add(L.GALV,box(-.098,1.08,0,.022,.34,.105),col=(.9,.9,.88),**kw)                               # cable hatch
    arm=[(0,5.0,0),(0,5.28,0),(.04,5.39,0),(.14,5.44,0),(.28,5.43,0),(.42,5.37,0),(.52,5.32,0)]
    g.add(L.GALV,tube(arm,[.066,.056,.05,.046,.043,.04,.038],n=8),col=GALV,**kw)
    # lantern: rounded shell lofted along x, underside flat at the lens plane
    y0=LAMP_ANCHOR[1]-.052
    stations=[(.43,.12,.10),(.56,.28,.105),(.86,.33,.10),(1.14,.32,.085),(1.30,.24,.055)]
    def sect(w,h):return [(-w/2,0),(-w/2,h*.5),(-w*.38,h*.9),(-w*.14,h),(w*.14,h),(w*.38,h*.9),(w/2,h*.5),(w/2,0)]
    shell=Part(smooth=True);n=8;per=None
    for x,w,h in stations:
        for a,b in sect(w,h):shell.V.append((x,y0+b,a))
    for s in range(len(stations)-1):
        for k in range(n):
            i=s*n+k;j=s*n+(k+1)%n
            shell.face((i,j,j+n,i+n),[(stations[s][0],k*.05),(stations[s][0],(k+1)*.05),(stations[s+1][0],(k+1)*.05),(stations[s+1][0],k*.05)])
    shell.face(list(range(n)),[(a,b) for a,b in sect(*stations[0][1:])])
    shell.face([(len(stations)-1)*n+k for k in range(n)],[(a,b) for a,b in sect(*stations[-1][1:])])
    g.add(L.GALV,shell,col=(.78,.79,.8),**kw)
    # lens: an inset LED tray just under the shell, facing down
    lx0,lx1,lw=.58,1.18,.26
    lens=quad([(lx0,y0-.004,-lw/2),(lx1,y0-.004,-lw/2),(lx1,y0-.004,lw/2),(lx0,y0-.004,lw/2)],[(0,0),(1,0),(1,1),(0,1)])
    g.add(L.LENS,lens,closed=False,hint=(0,-1,0),**kw)

def build_lamp():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    kit.setup('street-lamp',TEX,20260914)
    L=Lib(lamp=True);g=Geo('street-lamp');street_lamp(g,L)
    obs=g.flush('lamp')
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join()
    ob=bpy.context.object;ob.name='LM_PROP_StreetLamp';ob['lm_head_anchor_m']=list(LAMP_ANCHOR)
    path=ROOT/'public/assets/models/props/LM_PROP_StreetLamp.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,
        export_cameras=False,export_lights=False,export_extras=True,export_image_format='WEBP',export_image_quality=82,
        export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    tris=sum(len(p.vertices)-2 for p in ob.data.polygons)
    print('LAMP EXPORT',json.dumps({'triangles':tris,'bytes':path.stat().st_size,'materials':[m.name for m in ob.data.materials]}),flush=True)

# ================================================================== traffic signals
ROAD_X=[0,76,-82];ROAD_Z=[-64,8,78]
def signal_head(g,L,kw,cx,cy,cz,lit):
    """Three-aspect 300 mm head facing local +z: black housing, backboard with a white border,
    tunnel visors, lenses. lit: 'red' | 'amber' | 'green'."""
    prof=[(x+cx,y+cy) for x,y in rrect(.34,1.0,.04,n=1)]
    g.add(L.POWDER,prism(prof,cz-.12,cz+.12,'z'),col=BLACK,**kw)
    g.add(L.POWDER,box(cx,cy,cz-.135,.56,1.22,.02),col=BLACK,**kw)
    for bx,by,bw,bh in ((0,.5925,.56,.035),(0,-.5925,.56,.035),(-.2625,0,.035,1.15),(.2625,0,.035,1.15)):
        g.add(L.POWDER,upright(cx+bx,cy+by,cz-.1245,bw,bh,'+z',[(0,0),(bw,0),(bw,bh),(0,bh)]),col=WHITE,closed=False,hint=(0,0,1),**kw)
    for k,(name,row) in enumerate((('red',0),('amber',1),('green',2))):
        y=cy+.31-k*.31
        cell=FT.signal_uv(0 if lit==name else 2,row);uvc=((cell[0]+cell[2])/2,(cell[1]+cell[3])/2)
        g.add(L.LENS,disc(cx,y,cz+.123,.118,14,uvc,.109),closed=False,hint=(0,0,1),**kw)
        outer=[(cx+math.cos(a)*.15,y+math.sin(a)*.15) for a in [math.radians(-25+230*i/5) for i in range(6)]]
        inner=[(cx+math.cos(a)*.138,y+math.sin(a)*.138) for a in [math.radians(-25+230*i/5) for i in range(6)]]
        g.add(L.POWDER,band(outer,inner,cz+.12,cz+.36,'z',front=True),col=BLACK,**kw)

def ped_head(g,L,kw,cx,cy,cz,walk):
    """Pedestrian head facing local +z: red man over green man, and a countdown box beside it."""
    prof=[(x+cx,y+cy) for x,y in rrect(.30,.62,.035,n=1)]
    g.add(L.POWDER,prism(prof,cz-.1,cz+.1,'z'),col=BLACK,**kw)
    for k,(row,col_) in enumerate(((1 if not walk else 3,0),(1 if walk else 3,1 if walk else 0))):
        y=cy+.15-k*.30
        cell=FT.signal_uv(row,col_);g.add(L.LENS,upright(cx,y,cz+.102,.23,.23,'+z',cell_uv(cell,.06)),closed=False,hint=(0,0,1),**kw)
        g.add(L.POWDER,box(cx,y+.135,cz+.17,.28,.018,.14),col=BLACK,**kw)
    bx=cx+.29
    g.add(L.POWDER,box(bx,cy+.05,cz,.24,.26,.18),col=BLACK,**kw)
    cell=FT.signal_uv(1,2) if walk else FT.signal_uv(3,1)
    g.add(L.LENS,upright(bx,cy+.05,cz+.092,.19,.19,'+z',cell_uv(cell,.08)),closed=False,hint=(0,0,1),**kw)

def signal_pole(g,L,x,z,yaw,phase_green,walk,ped_local):
    """Galvanised signal pole: concrete footing, near-side primary head facing traffic (local +z),
    a 6 m outreach arm with the overhead head, the pedestrian head and a yellow push-button box."""
    kw=dict(at=(x,0,z),yaw=yaw)
    lit='green' if phase_green else 'red'
    g.add(L.CONC,rings([(-.05,.24),(.1,.24),(.14,.2)],10,smooth=False),col=CONCRETE,grime=.3,**kw)
    g.add(L.GALV,rings([(.12,.105),(.2,.1),(5.75,.082)],10,cap0=False),col=GALV,rust=.7,grime=.2,**kw)
    g.add(L.GALV,rings([(5.75,.086),(5.82,.07),(5.85,0.0)],10),col=GALV,**kw)
    g.add(L.GALV,tube([(0,5.45,0),(1.5,5.52,0),(4.0,5.6,0),(6.0,5.64,0)],[.07,.062,.052,.045],n=8),col=GALV,**kw)
    g.add(L.GALV,tube([(0,4.75,0),(1.9,5.49,0)],.028,n=6),col=GALV,**kw)
    # overhead head hangs from the arm on a short bracket
    g.add(L.GALV,box(5.6,5.4,0,.08,.4,.08),col=GALV,**kw)
    signal_head(g,L,kw,5.6,4.72,.18,lit)
    # primary head on the pole, beside it on a bracket
    g.add(L.GALV,box(0,3.2,.14,.07,.07,.2),col=GALV,**kw);g.add(L.GALV,box(0,2.72,.14,.07,.07,.2),col=GALV,**kw)
    signal_head(g,L,kw,0,2.96,.34,lit)
    # pedestrian head faces across the crossing: ped_local is its facing in this pole's frame
    pyaw=yaw+math.atan2(ped_local[0],ped_local[1])
    g.add(L.GALV,box(0,2.1,.12,.06,.06,.16),col=GALV,at=(x,0,z),yaw=pyaw)
    ped_head(g,L,dict(at=(x,0,z),yaw=pyaw),0,2.1,.3,walk)
    g.add(L.POWDER,box(0,1.15,.13,.13,.2,.09),col=YELLOW,at=(x,0,z),yaw=pyaw+math.pi)
    g.add(L.POWDER,box(0,1.19,.18,.07,.07,.01),col=BLACK,at=(x,0,z),yaw=pyaw+math.pi)

def junction(g,L,ns_green):
    """One junction's furniture about its own centre, as src/street-furniture.ts instances it at
    every ROAD_X x ROAD_Z crossing: four poles on the near-left of each approach (Malaysia drives
    on the left) and a bollard at each end of the two zebras. ns_green picks the phase: the
    pedestrian heads for the zebras across the north-south road walk (and count down) only while
    that road is held at red."""
    for sx,sz,yaw,ns in ((-1,1,0.0,True),(1,-1,math.pi,True),(-1,-1,-math.pi/2,False),(1,1,math.pi/2,False)):
        world=(-sx,0.0)                                     # across the north-south road
        c,s_=math.cos(-yaw),math.sin(-yaw)
        ped=(world[0]*c+world[1]*s_,-world[0]*s_+world[1]*c)
        signal_pole(g,L,sx*10.5,sz*10.0,yaw,ns_green==ns,not ns_green,ped)
    for sz in(-1,1):
        for sx in(-1,1):
            bollard(g,L,(sx*10.15,0,sz*12.9))

def bollard(g,L,at):
    """Precast concrete bollard with a white retro-reflective band."""
    g.add(L.CONC,rings([(-.05,.15),(.56,.15)],10,cap0=False,cap1=False),col=CONCRETE,grime=.35,at=at)
    g.add(L.CONC,rings([(.56,.152),(.66,.152)],10,cap0=False,cap1=False),col=(.95,.95,.93),at=at)
    g.add(L.CONC,rings([(.66,.15),(.76,.14),(.82,0.0)],10,cap0=False),col=CONCRETE,at=at)

# ================================================================== bus shelters, bins
def bin240(g,L,kw):
    """DBKL green 240 l wheelie bin: tapered body, overhanging lid, handle bar and wheels."""
    body=Part();bot=(.46,.56);top=(.56,.70);h=.94
    outline=lambda w,d,y:[(-w/2,y,-d/2),(w/2,y,-d/2),(w/2,y,d/2),(-w/2,y,d/2)]
    body.V=outline(*bot,.06)+outline(*top,h)
    for k in range(4):
        a,b=k,(k+1)%4;body.face((a,b,4+b,4+a),[(k*.6,0),((k+1)*.6,0),((k+1)*.6,h),(k*.6,h)])
    body.face((0,1,2,3),[(0,0),(1,0),(1,1),(0,1)])
    g.add(L.POWDER,body,col=DBKL_GREEN,grime=.4,**kw)
    g.add(L.POWDER,box(0,h+.03,-.01,.60,.06,.76),col=DBKL_GREEN,**kw)
    g.add(L.POWDER,box(0,h-.06,-.36,.52,.05,.05),col=DBKL_GREEN,**kw)
    for sx in(-1,1):g.add(L.POWDER,rings([(sx*.22-.04,.1),(sx*.22+.04,.1)],10,cx=.1,cz=-.3,axis='x'),col=CHARCOAL,**kw)
    g.add(L.POWDER,box(0,.45,.285,.3,.12,.01),col=(.9,.9,.88),**kw)                                # white DBKL band label

def bus_stop(g,L,x,z,yaw):
    """DBKL-style cantilever shelter facing local +z (the road): precast pad, three charcoal posts
    with tapered roof beams, a curved perforated sheet roof and white fascia, a solid lower back
    panel, a perforated steel bench, the route board, a lit advert box at one end, the blue
    HENTIAN BAS plate on its own post at the kerb and a green wheelie bin."""
    kw=dict(at=(x,0,z),yaw=yaw)
    g.add(L.CONC,box(0,.0,0,4.9,.12,2.1),col=CONCRETE,grime=.2,**kw)
    for px in(-2.05,0,2.05):
        g.add(L.POWDER,box(px,1.33,-.78,.1,2.55,.1),col=CHARCOAL,grime=.3,**kw)
        beam=Part();beam.V=[(px-.04,2.52,-.86),(px+.04,2.52,-.86),(px+.04,2.62,.98),(px-.04,2.62,.98),(px-.04,2.78,-.86),(px+.04,2.78,-.86),(px+.04,2.72,.98),(px-.04,2.72,.98)]
        for f in((0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)):beam.face(f,[(0,0),(1,0),(1,1),(0,1)])
        g.add(L.POWDER,beam,col=CHARCOAL,**kw)
    arc=lambda r:[(-1.0+2.05*i/8,2.8+.09*math.sin(math.pi*i/8)+.06*i/8) for i in range(9)]
    top=arc(0);bot=[(a,b-.03) for a,b in top]
    roof=band(top[::-1],bot[::-1],-2.45,2.45,'x',front=True,back=True)
    g.add(L.POWDER,roof,col=(.62,.64,.65),**kw)
    g.add(L.POWDER,box(0,2.83,1.07,4.95,.22,.05),col=WHITE,**kw)
    g.add(L.POWDER,box(0,.55,-.8,4.2,.9,.04),col=(.2,.21,.22),grime=.3,**kw)
    g.add(L.POWDER,box(0,2.0,-.8,4.2,.06,.06),col=CHARCOAL,**kw)
    g.add(L.GALV,box(-.3,.47,-.52,2.6,.04,.42),col=GALV,**kw)
    for bx in(-1.45,-.3,.85):g.add(L.POWDER,box(bx,.23,-.55,.05,.46,.36),col=CHARCOAL,**kw)
    g.add(L.GALV,box(-.3,.8,-.76,2.6,.1,.04),col=GALV,**kw)
    # route board between the posts
    g.add(L.POWDER,box(-1.2,1.48,-.79,.68,1.08,.03),col=CHARCOAL,**kw)
    g.add(L.SIGNS,upright(-1.2,1.48,-.772,.6,1.0,'+z',cell_uv(FT.SIGN_UV['route'],.005)),closed=False,hint=(0,0,1),**kw)
    # lit advert box at the +x end, poster on both faces
    g.add(L.POWDER,box(2.25,1.2,.0,.18,2.1,1.3),col=CHARCOAL,**kw)
    for side in(1,-1):
        g.add(L.ADVERT,upright(2.25+side*.092,1.25,0,1.14,1.8,'+x' if side>0 else '-x',cell_uv((.4905,.004,.8845,.621))),closed=False,hint=(side,0,0),**kw)
    # HENTIAN BAS plate, perpendicular to the road so an approaching bus reads it
    sp=dict(at=(x+(-2.75*math.cos(yaw)+1.25*math.sin(yaw)),0,z+(2.75*math.sin(yaw)+1.25*math.cos(yaw))),yaw=yaw)
    g.add(L.GALV,rings([(-.04,.048),(3.0,.042)],8),col=GALV,rust=.6,**sp)
    g.add(L.GALV,rings([(3.0,.045),(3.04,0)],8),col=GALV,**sp)
    bus=FT.SIGN_UV['bus'];u0,v0,u1,v1=bus
    for side in(1,-1):
        face='+x' if side>0 else '-x'
        g.add(L.SIGNS,upright(side*.052,2.62,0,.8,.48,face,[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]),closed=False,hint=(side,0,0),**sp)
    g.add(L.GALV,box(0,2.62,0,.1,.5,.82),col=(.8,.8,.8),**sp)
    bin240(g,L,dict(at=(x+(3.0*math.cos(yaw)+.2*math.sin(yaw)),0,z+(-3.0*math.sin(yaw)+.2*math.cos(yaw))),yaw=yaw))


# ================================================================== flags, signs, bunting, fountain
def flag(g,L,x,z):
    """Satin aluminium flagpole on a concrete plinth with a gilt finial, halyard and cleat, and the
    Jalur Gemilang (1:2) as one rippling double-sided sheet off its truck.  The cloth keeps a
    shallow wind-driven fold field and three small hoist eyelets so its silhouette holds up at
    close range without adding a second draw."""
    kw=dict(at=(x,0,z))
    g.add(L.CONC,box(0,.04,0,.62,.18,.62),col=CONCRETE,grime=.3,**kw)
    g.add(L.GALV,rings([(.12,.075),(.3,.07),(4.0,.058),(7.92,.045)],10,cap0=False),col=(.93,.93,.92),**kw)
    g.add(L.GALV,rings([(7.92,.06),(7.98,.06),(8.0,0)],10),col=(.9,.9,.9),**kw)
    g.add(L.POWDER,rings([(8.0,0.0),(8.04,.06),(8.1,.07),(8.16,.06),(8.21,0.0)],10),col=lin('#d9a441'),**kw)
    g.add(L.GALV,box(.08,1.3,0,.14,.03,.03),col=GALV,**kw)
    g.add(L.POWDER,tube([(.07,1.32,.0),(.07,7.7,0)],.006,n=4),col=WHITE,**kw)
    W,H,TOP,NU,NV=2.4,1.2,7.8,24,9
    cloth=Part(smooth=True)
    def surf(u,v):
        phase=u*TAU*1.25+.18*math.sin(v*TAU)
        wave=(.095+.08*u)*math.sin(phase)+.032*math.sin(u*TAU*4.0+v*TAU*1.6)
        sag=.06*u*u*(.35+.65*v)
        return (.07+u*W,TOP-v*H-sag+.025*math.sin(u*TAU*2.2+v*TAU*.6),wave)
    for jv in range(NV+1):
        for iu in range(NU+1):cloth.V.append(surf(iu/NU,jv/NV))
    for jv in range(NV):
        for iu in range(NU):
            a=jv*(NU+1)+iu;b=a+1;c=a+NU+2;d=a+NU+1
            cloth.face((d,c,b,a),[(iu/NU,1-(jv+1)/NV*.5),((iu+1)/NU,1-(jv+1)/NV*.5),((iu+1)/NU,1-jv/NV*.5),(iu/NU,1-jv/NV*.5)])
    g.add(L.CLOTH,cloth,closed=False,hint=(0,0,1),uv_raw=True,**kw)
    for v in (.04,.5,.96):
        ex,ey,ez=surf(.01,v)
        g.add(L.GALV,rings([(-.018,.04),(.018,.04)],8),col=(.82,.83,.80),at=(x+ex,ey,z+ez))

def sign_frame(g,L,x,y,z,w,h,posts=None):
    """Frame behind a canvas street sign centred at (x,y,z) facing +z: an aluminium tray, a white
    retro-reflective rim round the canvas, rails and U-bolts to two galvanised posts (offsets from x)."""
    g.add(L.GALV,box(x,y,z-.022,w+.1,h+.1,.03),col=(.82,.83,.84))
    for bx,by,bw,bh in ((0,h/2+.03,w+.1,.06),(0,-h/2-.03,w+.1,.06),(-w/2-.03,0,.06,h),(w/2+.03,0,.06,h)):
        g.add(L.POWDER,box(x+bx,y+by,z-.006,bw,bh,.022),col=WHITE)
    for off in posts or (-(w/2-.55),w/2-.55):
        post=x+off
        g.add(L.GALV,rings([(-.05,.048),(y+h/2+.02,.044)],8),col=GALV,rust=.8,grime=.2,at=(post,0,z-.085))
        g.add(L.GALV,rings([(y+h/2+.02,.05),(y+h/2+.05,0)],8),col=GALV,at=(post,0,z-.085))
        g.add(L.CONC,rings([(-.05,.16),(.06,.16),(.09,.12)],10,smooth=False),col=CONCRETE,grime=.3,at=(post,0,z-.085))
        for ry in(y-h/2+.12,y+h/2-.12):g.add(L.GALV,box(post,ry,z-.055,.14,.05,.07),col=GALV)
    g.add(L.GALV,box(x,y+h/2-.12,z-.05,w-.2,.045,.02),col=GALV);g.add(L.GALV,box(x,y-h/2+.12,z-.05,w-.2,.045,.02),col=GALV)

def bunting(g,L):
    """Merdeka bunting over the courtyard: a cord between two slim poles, sagging through the game's
    18 hanging points, with little Jalur Gemilang flags between red, yellow, blue and white pennants."""
    z=49;nodes=[(-46+i*1.9,6.63-math.sin(i/17*math.pi)*1.1) for i in range(18)]
    for px in(-47.9,-12.1):
        g.add(L.GALV,rings([(-.05,.07),(3.6,.06),(7.25,.045)],8),col=GALV,rust=.6,at=(px,0,z))
        g.add(L.GALV,rings([(7.25,.055),(7.3,0)],8),col=GALV,at=(px,0,z))
        g.add(L.CONC,box(0,.04,0,.42,.16,.42),col=CONCRETE,grime=.3,at=(px,0,z))
    cord=[(-47.9,7.2,z)]+[(nx,ny+.06,z) for nx,ny in nodes]+[(-12.1,7.2,z)]
    g.add(L.POWDER,tube(cord,.012,n=4),col=(.9,.88,.82))
    for i,(nx,ny) in enumerate(nodes):
        lean=.05*math.cos(i*1.3)
        if i%2==0:
            fl=Part(smooth=True);w,h=.62,.31
            for jv in range(3):
                for iu in range(4):
                    u,v=iu/3,jv/2;fl.V.append((nx-w/2+u*w,ny-v*h,lean*v+.03*math.sin(u*3.1+i)))
            for jv in range(2):
                for iu in range(3):
                    a=jv*4+iu;fl.face((a+4,a+5,a+1,a),[(iu/3,1-(jv+1)/2*.5),((iu+1)/3,1-(jv+1)/2*.5),((iu+1)/3,1-jv/2*.5),(iu/3,1-jv/2*.5)])
            g.add(L.CLOTH,fl,closed=False,hint=(0,0,1),uv_raw=True,at=(0,0,z))
        else:
            q=(i//2)%4;u0=q/4;u1=(q+1)/4;um=(u0+u1)/2
            pen=Part()
            pen.V=[(nx-.3,ny,0),(nx+.3,ny,0),(nx+.12,ny-.3,lean),(nx-.12,ny-.3,lean),(nx,ny-.58,lean*1.6)]
            pen.face((3,2,1,0),[(um-.06,.2),(um+.06,.2),(u1-.01,.49),(u0+.01,.49)])
            pen.face((4,2,3),[(um,.02),(um+.06,.2),(um-.06,.2)])
            g.add(L.CLOTH,pen,closed=False,hint=(0,0,1),uv_raw=True,at=(0,0,z))

FOUNTAIN=[(.00,4.18),(.10,4.18),(.58,4.02),(.70,4.16),(.78,4.10),(.78,3.80),(.70,3.74),(.34,3.70),
          (.28,3.44),(.28,1.10),(.66,1.04),(.80,.70),(1.02,.56),(1.22,.52),(1.34,.74),(1.48,1.06),
          (1.58,1.22),(1.62,1.14),(1.52,.72),(1.44,.34),(1.48,.20),(1.68,.14),(1.74,.02)]
def fountain(g,L):
    """Low fountain on the KLCC delivery plaza (basin radius 4, bowl at 1.65 as world.ts draws it):
    polished terrazzo coping and pedestal, a blue glass-mosaic basin under clear rippled water, and
    a modest three-tier plume."""
    x,z=19,-87;n=32
    def lathe(prof):
        p=Part(smooth=True);L_=[0.0]
        for i in range(1,len(prof)):L_.append(L_[-1]+math.hypot(prof[i][0]-prof[i-1][0],prof[i][1]-prof[i-1][1]))
        for (y,r) in prof:
            for k in range(n+1):a=TAU*k/n;p.V.append((math.cos(a)*r,y,math.sin(a)*r))
        for s in range(len(prof)-1):
            for k in range(n):
                i=s*(n+1)+k;j=i+n+1;r=(prof[s][1]+prof[s+1][1])/2
                p.face((i,j,j+1,i+1),[(TAU*k/n*r,L_[s]),(TAU*k/n*r,L_[s+1]),(TAU*(k+1)/n*r,L_[s+1]),(TAU*(k+1)/n*r,L_[s])])
        return p
    # the section is walked outside-in, so faces point out of the solid; closed=False keeps that
    coping=FOUNTAIN[:8];basin=FOUNTAIN[7:12];pedestal=FOUNTAIN[11:]
    g.add(L.TERRAZZO,lathe(coping),closed=False,hint=None,col=(.9,.9,.88),at=(x,0,z))
    g.add(L.MOSAIC,lathe(basin),closed=False,hint=None,col=(.9,.9,.9),at=(x,0,z))
    g.add(L.TERRAZZO,lathe(pedestal),closed=False,hint=None,col=(.88,.88,.86),at=(x,0,z))
    for y,r in((.69,3.70),(1.54,1.08)):
        w=Part();w.V.append((0,y,0));m=40
        for k in range(m):a=TAU*k/m;w.V.append((math.cos(a)*r,y,math.sin(a)*r))
        for k in range(m):
            a0,a1=TAU*k/m,TAU*(k+1)/m
            w.face((0,1+(k+1)%m,1+k),[(0,0),(math.cos(a1)*r/1.5,math.sin(a1)*r/1.5),(math.cos(a0)*r/1.5,math.sin(a0)*r/1.5)])
        g.add(L.WATER,w,closed=False,hint=(0,1,0),uv_raw=True,at=(x,0,z))
    for y0,h,r in((1.55,.5,.12),(2.0,.35,.07),(2.3,.28,.035)):
        g.add(L.JET,rings([(y0,r),(y0+h*.6,r*.7),(y0+h,0.0)],10,cap0=False),closed=True,at=(x,0,z))

# ================================================================== the furniture set
def proto(name,children):
    """An empty that src/street-furniture.ts finds by name and instances, children one per material."""
    e=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(e);e['uv']=True
    for c in children:c.parent=e
    return e

def furniture(tag='furniture'):
    """Everything LM_ENV_Furniture carries except the hedges and seawall (build_zoo.py): the
    one-off pieces in absolute coordinates, and the repeated ones as prototypes at the origin -
    'junction' (poles, heads, bollards), 'junction_lens_ns_go' / 'junction_lens_ns_stop' (its
    lenses in each phase) and 'bus_stop' (facing +z)."""
    L=Lib();g=Geo(tag)
    flag(g,L,-13,54);flag(g,L,13,-77)
    sign_frame(g,L,-11,3.7,14,5,.8);sign_frame(g,L,11.5,3.6,-48,3.8,.9,posts=(-1.62,1.35))   # clear of the lamp post at (10.4, -48)
    bunting(g,L);fountain(g,L)
    obs=g.flush('street')
    lens=L.LENS.name
    junction(g,L,True);body=g.sets;g.sets={}
    g.sets={k:v for k,v in body.items() if k!=lens};obs.append(proto('junction',g.flush('junction')))
    g.sets={lens:body[lens]};obs.append(proto('junction_lens_ns_go',g.flush('junction_lens_ns_go')))
    junction(g,L,False);obs.append(proto('junction_lens_ns_stop',g.flush('junction_lens_ns_stop',only=(lens,))))
    bus_stop(g,L,0,0,0.0);obs.append(proto('bus_stop',g.flush('bus_stop')))
    return obs

if __name__=='__main__':
    build_lamp()
