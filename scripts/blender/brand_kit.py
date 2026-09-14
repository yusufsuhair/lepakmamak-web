"""Shared kit for the branded stops (build_shell.py, build_fastfood.py, build_shops.py).

One material library for every brand. Surfaces are near-white procedural PBR textures
(brand_textures.py) tinted per object with linear vertex colours, so one 'Painted panel'
draw carries every fascia colour of a shop, and the same names recur in every GLB.

Material names are the runtime contract with src/brands.ts:
  'Night glow LED' / 'Night glow sign'   emissive white x vertex colour; brands.ts sets the
                                          day and night intensity (a lightbox is dimmer by day)
  'Night glow menu <kind>', 'Night glow shelves'   emissive from their own image
  'Night wash'                            additive pools of light, only shown at night
  anything named '... glass' or 'Satin metal'      reflects brands.ts's local painted sky

Game coordinates in, metres, Y up (pt() mirrors z into Blender). Traps handled here:
  * every object gets a 'Color' FLOAT_COLOR point attribute so joins keep it; glTF clamps at 1
  * tiled materials get world-space UVs in metres so neighbouring pieces line up
"""
import bpy, bmesh, math, json
import numpy as np
from mathutils import Vector, noise
from build_lrt import pt, loft, join, rounded, box as lrt_box, cyl as lrt_cyl
import pbr_kit as kit
from pbr_kit import srgb
import brand_textures as BT

T='brand'
FONTS={}

def setup(tag,textures_dir,seed):
    global T
    T=tag;kit.setup(tag,textures_dir,seed)

def font(kind='bold'):
    paths={'bold':['/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Helvetica.ttc'],
           'italic':['/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf','/System/Library/Fonts/Supplemental/Arial Bold.ttf'],
           'rounded':['/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf','/System/Library/Fonts/Supplemental/Arial Bold.ttf']}[kind]
    if kind not in FONTS:
        for p in paths:
            try:FONTS[kind]=bpy.data.fonts.load(p);break
            except Exception:pass
    return FONTS.get(kind)

# ------------------------------------------------------------------ materials
def _principled(name,rough,metal=0.0,two_sided=False):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    m.use_backface_culling=not two_sided
    return m,p

def textured(name,kind,rough,tile,metal=0.0,strength=1.0,two_sided=False):
    m=kit.pbr(name,kind,'#ffffff',rough,tile,strength=strength,two_sided=two_sided,source=BT)
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=metal
    return m

def flat(name,rough=.5,metal=0.0,two_sided=False):
    return _principled(name,rough,metal,two_sided)[0]

def glow(name,rough=.4):
    """Emission 1 so the exporter writes emissiveFactor; brands.ts scales it and multiplies it by
    the vertex colour."""
    m,p=_principled(name,rough)
    p.inputs['Emission Color'].default_value=(1,1,1,1);p.inputs['Emission Strength'].default_value=1.0
    return m

def image_glow(name,arr,rough=.35):
    """An explicit-UV picture (menu board, stocked shelves) that is also its own emission map."""
    m,p=_principled(name,rough);im=kit.image(name.replace(' ','_'),arr);nt=m.node_tree
    tx=nt.nodes.new('ShaderNodeTexImage');tx.image=im
    nt.links.new(tx.outputs['Color'],p.inputs['Base Color']);nt.links.new(tx.outputs['Color'],p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value=1.0;m['keep_uv']=True
    return m

def glass(name,hexcolor,alpha=.28,rough=.05):
    m,p=_principled(name,rough,0.0,True)
    p.inputs['Base Color'].default_value=(*srgb(hexcolor),1);p.inputs['Alpha'].default_value=alpha
    m.surface_render_method='BLENDED'
    return m

def wash():
    m,p=_principled('Night wash',1.0,0.0,False);im=kit.image('night_wash',BT.wash());nt=m.node_tree
    p.inputs['Base Color'].default_value=(0,0,0,1)
    tx=nt.nodes.new('ShaderNodeTexImage');tx.image=im;nt.links.new(tx.outputs['Color'],p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value=1.0;m['keep_uv']=True
    return m

class Lib:
    """The shared set. Build once per asset scene; names are identical across GLBs."""
    def __init__(self):
        self.PANEL=textured('Painted panel','panel',.36,2.4,strength=.6)
        self.RENDER=textured('Render wall','render',.9,3.0,strength=.8)
        self.TILES=textured('Floor tiles','tiles',.22,1.2,strength=.4)
        self.METAL=textured('Satin metal','brushed',.32,.5,metal=.7,strength=.3)
        self.PLASTIC=flat('Plastic',.5)
        self.RUBBER=flat('Rubber',.92)
        self.GLASS=glass('Shopfront glass','#9fb8c0',.26)
        self.DARKGLASS=glass('Upper floor glass','#1d2b33',.82,.04)
        self.LED=glow('Night glow LED')
        self.SIGN=glow('Night glow sign')
        self._extra={}
    def get(self,key,maker):
        if key not in self._extra:self._extra[key]=maker()
        return self._extra[key]
    @property
    def SHELVES(self):return self.get('shelves',lambda:image_glow('Night glow shelves',BT.products()[0]))
    @property
    def WASH(self):return self.get('wash',wash)
    def menu(self,kind):return self.get('menu'+kind,lambda:image_glow(f'Night glow menu {kind}',BT.menu(kind)))

# ------------------------------------------------------------------ colour and uv
def lin(hexcolor):return srgb(hexcolor)

def paint(ob,hexcolor='#ffffff',grime=0.0):
    """Linear vertex colour; grime darkens towards the ground (splash-back) with a little noise."""
    me=ob.data;c=lin(hexcolor) if isinstance(hexcolor,str) else hexcolor
    attr=me.color_attributes.get('Color') or me.color_attributes.new('Color','FLOAT_COLOR','POINT')
    mw=ob.matrix_world
    for k,v in enumerate(me.vertices):
        g=1.0
        if grime:
            w=mw@v.co;y=w.z
            g=1-grime*max(0.0,1-y/1.2)**2
            g*=1+.04*grime*noise.noise(Vector((w.x*.7,w.y*.7,y*.9)))
        attr.data[k].color=(min(1,c[0]*g),min(1,c[1]*g),min(1,c[2]*g),1)
    me.color_attributes.active_color=attr
    return ob

def uv_world(ob):
    """Real-world box UVs in world space: walls take v up, floors x/z; neighbours line up."""
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

# ------------------------------------------------------------------ geometry (game coordinates)
def box(name,x,y,z,w,h,d,m,col='#ffffff',bevel=0.0,grime=0.0,ry=0.0):
    """Box with an optional one-segment chamfer (build_lrt's two-segment bevel quadruples the
    vertex count of every small part, which is most of a GLB's weight)."""
    o=lrt_box(name,x,y,z,w,h,d,m,T,0)
    bevel=min(bevel,w*.25,h*.25,d*.25)
    if bevel>0:
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        mod=o.modifiers.new('chamfer','BEVEL');mod.width=bevel;mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if ry:o.rotation_euler.z=ry
    bpy.context.view_layer.update();return paint(o,col,grime)

def frame(name,x,y,z,w,h,bar,depth,m,col='#ffffff',plane='z'):
    """Four bars round a w x h opening centred at (x,y,z), in a wall facing z (or x): a door or
    window surround that leaves its glass visible."""
    if plane=='z':
        return [box(name,x,y+h/2,z,w+bar*2,bar,depth,m,col),box(name,x,y-h/2,z,w+bar*2,bar,depth,m,col),
                box(name,x-w/2-bar/2,y,z,bar,h,depth,m,col),box(name,x+w/2+bar/2,y,z,bar,h,depth,m,col)]
    return [box(name,x,y+h/2,z,depth,bar,w+bar*2,m,col),box(name,x,y-h/2,z,depth,bar,w+bar*2,m,col),
            box(name,x,y,z-w/2-bar/2,depth,h,bar,m,col),box(name,x,y,z+w/2+bar/2,depth,h,bar,m,col)]

def cyl(name,x,y,z,r,h,m,col='#ffffff',axis='y',verts=16):
    o=lrt_cyl(name,x,y,z,r,h,m,T,axis=axis,verts=verts);bpy.context.view_layer.update();return paint(o,col)

def plate(name,profile,z,thick,m,col='#ffffff'):
    """A flat 2D outline (x,y) extruded from z towards +z by thick (negative: towards -z)."""
    o=loft(name,[(z,profile),(z+thick,profile)],m,T,closed=True);return paint(o,col)

def disc(name,cx,cy,r,z,thick,m,col='#ffffff',n=40):
    return plate(name,[(cx+r*math.cos(2*math.pi*i/n),cy+r*math.sin(2*math.pi*i/n)) for i in range(n)],z,thick,m,col)

def ring(name,cx,cy,r_out,r_in,z,thick,m,col='#ffffff',n=48):
    """An annulus as n quad segments (a loft of outer+inner points does not triangulate cleanly)."""
    parts=[]
    for i in range(n):
        a0=2*math.pi*i/n;a1=2*math.pi*(i+1)/n
        seg=[(cx+r_out*math.cos(a0),cy+r_out*math.sin(a0)),(cx+r_out*math.cos(a1),cy+r_out*math.sin(a1)),
             (cx+r_in*math.cos(a1),cy+r_in*math.sin(a1)),(cx+r_in*math.cos(a0),cy+r_in*math.sin(a0))]
        parts.append(loft('ring seg',[(z,seg),(z+thick,seg)],m,T,closed=True))
    return paint(join(parts,name),col)

def text(body,x,y,z,size,m,col='#ffffff',depth=.04,align='CENTER',kind='bold',facing='+z',spacing=1.0,width=None):
    """Extruded lettering standing on a wall that faces `facing` (+z,-z,+x,-x). `width` fits the
    line to a length in metres."""
    bpy.ops.object.text_add(location=pt(x,y,z));o=bpy.context.object;d=o.data
    # Lettering is most of a shopfront's triangles: small captions go flat and coarser, since
    # their extruded sides are sub-pixel anyway; only the big wordmarks keep relief.
    small=size<.5
    d.body=body;d.size=size;d.extrude=0 if small else depth/2;d.align_x=align;d.align_y='CENTER';d.resolution_u=1 if small else 2;d.space_character=spacing
    f=font(kind)
    if f:d.font=f
    # 'up' lies flat on the ground and reads for a driver heading -z
    o.rotation_euler=(0,0,0) if facing=='up' else (math.pi/2,0,{'+z':0,'-z':math.pi,'+x':math.pi/2,'-x':-math.pi/2}[facing])
    bpy.context.view_layer.update()
    if width:
        b=o.bound_box;tw=max(v[0] for v in b)-min(v[0] for v in b)
        if tw>width:o.scale=(width/tw,width/tw,1)
    bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.name='text '+body[:20]
    o.data.materials.append(m);o['asset']=T
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return paint(o,col)

def card(name,x,y,z,w,h,m,facing='+z',u_repeat=1.0):
    """An upright quad with 0..1 UVs (u across, v up) for pictures: menu boards, stocked shelves."""
    hw,hh=w/2,h/2
    if facing=='+z':c=[(x-hw,y-hh,z),(x+hw,y-hh,z),(x+hw,y+hh,z),(x-hw,y+hh,z)]
    elif facing=='-z':c=[(x+hw,y-hh,z),(x-hw,y-hh,z),(x-hw,y+hh,z),(x+hw,y+hh,z)]
    elif facing=='+x':c=[(x,y-hh,z+hw),(x,y-hh,z-hw),(x,y+hh,z-hw),(x,y+hh,z+hw)]
    else:c=[(x,y-hh,z-hw),(x,y-hh,z+hw),(x,y+hh,z+hw),(x,y+hh,z-hw)]
    me=bpy.data.meshes.new(name);me.from_pydata([pt(*p) for p in c],[],[(0,1,2,3)]);me.update()
    uv=me.uv_layers.new(name='UVMap')
    for li,co in enumerate([(0,0),(u_repeat,0),(u_repeat,1),(0,1)]):uv.data[li].uv=co
    o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);me.materials.append(m);o['asset']=T
    return paint(o)

def ground_quad(name,x,y,z,w,d,m,col='#ffffff'):
    me=bpy.data.meshes.new(name)
    me.from_pydata([pt(x-w/2,y,z+d/2),pt(x+w/2,y,z+d/2),pt(x+w/2,y,z-d/2),pt(x-w/2,y,z-d/2)],[],[(0,1,2,3)]);me.update()
    uv=me.uv_layers.new(name='UVMap')
    for li,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[li].uv=co
    o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);me.materials.append(m);o['asset']=T
    return paint(o,col)

def arrow(name,x,y,z,length,width,m,col='#f4f1e6',direction='+z'):
    """Painted lane arrow lying on the ground, pointing along +z or -z."""
    s=1 if direction=='+z' else -1;hw=width/2;shaft=length*.62
    P=[(-hw*.32,0),(hw*.32,0),(hw*.32,shaft),(hw,shaft),(0,length),(-hw,shaft),(-hw*.32,shaft)]
    verts=[pt(x+px,y,z+s*(pz-length/2)) for px,pz in P]
    # listed +x then +z the outline faces down (see pbr_kit), so reverse it unless z is negated
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[tuple(range(7))] if s<0 else [tuple(range(7))[::-1]]);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.triangulate(bm,faces=bm.faces[:]);bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);me.materials.append(m);o['asset']=T
    return paint(o,col)

def hose(name,points,r,m,col='#16181a',sides=6):
    return paint(kit.tube(name,points,r,m,sides),col)

# ------------------------------------------------------------------ export
def finalize(root,items):
    bpy.context.view_layer.update()
    for ob in items:
        if ob is None:continue
        ob.parent=root
        mats=[m for m in ob.data.materials if m]
        if mats and all('tile' in m for m in mats):uv_world(ob)
        if not ob.data.color_attributes:paint(ob)

def export(roots,path,report):
    """Join each root's children by material (small predictable draw count), keep UVs only where a
    texture needs them, and write one GLB with WebP images."""
    for root in roots:
        batches={}
        for ob in [c for c in root.children if c.type=='MESH']:batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            mats=[m for m in objs[0].data.materials if m]
            j=join(objs,f'{root.name} | {" + ".join(key)}')
            if not any(('tile' in m) or m.get('keep_uv') for m in mats):
                for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for c in root.children:c.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
        export_image_format='WEBP',export_image_quality=80,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    for root in roots:
        kids=[c for c in root.children if c.type=='MESH']
        report.setdefault('nodes',{})[root.name]={'triangles':sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in kids),'draws':len(kids),
            'materials':sorted(c.name.split(' | ',1)[1] for c in kids)}
    report['bytes']=path.stat().st_size
    return report
