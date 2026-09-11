"""Reference-led Rembayung reconstruction. Blender 5.2, no external Python packages.

Run: Blender -b --factory-startup --python scripts/blender/build_rembayung.py
Optional args after --: --draft (fast renders), --no-render, --render-only.
Coordinates: metres; X across facade, Y towards rear, Z up. Entrance at Y=0.
Dimensions are photographic estimates, not an architectural survey.
"""
import bpy
import math
import random
import sys
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/rembayung'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'renders').mkdir(exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RNG = random.Random(2406)
WIDTH, DEPTH, EAVE, RIDGE = 18.0, 34.0, 7.5, 14.1
MATS = []


def material(name, color, rough=.5, metallic=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emission
    MATS.append(m)
    return len(MATS) - 1


def textured(name, a, b, scale, rough=.55, bump=.08, grain=(1, 1, 1)):
    idx = material(name, a, rough)
    nt = MATS[idx].node_tree
    p = nt.nodes.get('Principled BSDF')
    tex = nt.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = scale
    tex.inputs['Detail'].default_value = 3
    coords = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeVectorMath')
    mapping.operation = 'MULTIPLY'
    mapping.inputs[1].default_value = grain
    nt.links.new(coords.outputs['Generated'], mapping.inputs[0])
    nt.links.new(mapping.outputs[0], tex.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .15
    ramp.color_ramp.elements[0].color = (*a, 1)
    ramp.color_ramp.elements[1].position = .85
    ramp.color_ramp.elements[1].color = (*b, 1)
    nt.links.new(tex.outputs['Fac'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], p.inputs['Base Color'])
    bn = nt.nodes.new('ShaderNodeBump')
    bn.inputs['Strength'].default_value = bump
    bn.inputs['Distance'].default_value = .045
    nt.links.new(tex.outputs['Fac'], bn.inputs['Height'])
    nt.links.new(bn.outputs[0], p.inputs['Normal'])
    return idx


class Geo:
    """Accumulate mesh pieces efficiently, keeping named architectural assemblies."""
    def __init__(self, name):
        self.name, self.v, self.f, self.mi = name, [], [], []

    def mesh(self, verts, faces, mat):
        off = len(self.v)
        self.v.extend(verts)
        self.f.extend(tuple(off + i for i in f) for f in faces)
        self.mi.extend([mat] * len(faces))

    def box(self, center, size, mat, angle=0):
        x, y, z = center
        a, b, c = (s / 2 for s in size)
        co, si = math.cos(angle), math.sin(angle)
        verts = [(x + co*u-si*v, y+si*u+co*v, z+w)
                 for u,v,w in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),
                               (-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]]
        self.mesh(verts, [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)], mat)

    def beam(self, a, b, width, depth, mat):
        a, b = Vector(a), Vector(b)
        axis = (b-a).normalized()
        u = axis.cross(Vector((0,1,0)))
        if u.length < .01:
            u = axis.cross(Vector((1,0,0)))
        u.normalize()
        v = axis.cross(u).normalized()
        verts = [tuple(p + u*s*width/2 + v*t*depth/2)
                 for p in (a,b) for s,t in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        self.mesh(verts, [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)], mat)

    def tube(self, points, radius, mat, sides=8, radii=None):
        pts = [Vector(p) for p in points]
        verts=[]
        for i,p in enumerate(pts):
            tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
            axis=Vector((0,0,1)) if abs(tangent.z)<.95 else Vector((0,1,0))
            u=tangent.cross(axis).normalized()
            v=tangent.cross(u).normalized()
            r=radii[i] if radii else radius
            verts.extend(tuple(p+r*(math.cos(j*math.tau/sides)*u+math.sin(j*math.tau/sides)*v)) for j in range(sides))
        faces=[tuple(range(sides-1,-1,-1))]
        for k in range(len(pts)-1):
            faces.extend((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j) for j in range(sides))
        faces.append(tuple((len(pts)-1)*sides+j for j in range(sides)))
        self.mesh(verts,faces,mat)

    def cyl(self, center, r, height, mat, sides=20):
        x,y,z=center
        self.tube([(x,y,z-height/2),(x,y,z+height/2)],r,mat,sides)

    def lathe(self, center, profile, mat, sides=32):
        x,y,z=center
        verts=[(x+r*math.cos(a*math.tau/sides),y+r*math.sin(a*math.tau/sides),z+h) for r,h in profile for a in range(sides)]
        faces=[(k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j) for k in range(len(profile)-1) for j in range(sides)]
        self.mesh(verts,faces,mat)

    def finish(self, collection, bevel=0):
        if not self.v: return None
        mesh=bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.v,[],self.f)
        used=sorted(set(self.mi))
        for i in used: mesh.materials.append(MATS[i])
        lookup={m:i for i,m in enumerate(used)}
        for p,mi in zip(mesh.polygons,self.mi): p.material_index=lookup[mi]
        mesh.update()
        ob=bpy.data.objects.new(self.name,mesh)
        collection.objects.link(ob)
        if bevel:
            mod=ob.modifiers.new('Small crafted edges','BEVEL');mod.width=bevel;mod.segments=2
        return ob


def collection(name):
    c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c


def area(name, loc, target, watts, color=(1,.63,.32), size=3):
    d=bpy.data.lights.new(name,'AREA');d.energy=watts;d.color=color;d.shape='DISK';d.size=size
    ob=bpy.data.objects.new(name,d);LIGHTS.objects.link(ob);ob.location=loc
    ob.visible_camera=False;ob.visible_glossy=False;ob.visible_transmission=False
    d.specular_factor=0;d.transmission_factor=0
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob


def camera(name, loc, target, lens=28):
    d=bpy.data.cameras.new(name);d.lens=lens;d.clip_end=300
    ob=bpy.data.objects.new(name,d);CAMS.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob


def leaf(g, center, length, width, angle, tilt, mat):
    c=Vector(center)
    axis=Vector((math.cos(angle)*math.cos(tilt),math.sin(angle)*math.cos(tilt),math.sin(tilt)))
    side=Vector((-math.sin(angle),math.cos(angle),0))
    verts=[tuple(c-axis*length*.5),tuple(c+side*width*.5+Vector((0,0,.025))),tuple(c+axis*length*.5),tuple(c-side*width*.5+Vector((0,0,.025))),tuple(c+Vector((0,0,.07)))]
    g.mesh(verts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],mat)


def tropical(g,x,y,z=0,scale=1):
    for i in range(9):
        a=RNG.random()*math.tau;h=RNG.uniform(.65,1.55)*scale
        end=(x+math.cos(a)*.32*scale,y+math.sin(a)*.32*scale,z+h)
        g.tube([(x,y,z),end],.011*scale,GREEN[1],5)
        leaf(g,end,.75*scale,.29*scale,a,RNG.uniform(.2,.8),RNG.choice(GREEN))


def planter(g, plants, x,y,length=2.5,axis=0):
    g.box((x,y,.48),(length,.68,.9),WOOD,axis)
    g.box((x,y,.945),(length-.09,.57,.025),SOIL,axis)
    for t in range(int(length/.35)):
        d=-length*.45+t*.35
        tropical(plants,x+math.cos(axis)*d,y+math.sin(axis)*d,.95,.75)


def make_chair(square=False):
    g=Geo('Cane dining chair' if square else 'Bentwood dining chair')
    if square:
        g.box((0,0,.465),(.46,.47,.065),WOOD)
        g.box((0,-.01,.51),(.405,.415,.05),CUSHION)
        for x in [-.19,.19]:
            for y in [-.18,.18]:
                g.beam((x*1.1,y*1.1,.04),(x,y,.46 if y<0 else 1.02),.035,.035,WOOD)
        g.box((0,.18,.98),(.43,.045,.05),WOOD)
        g.box((0,.18,.67),(.4,.04,.04),WOOD)
        for i in range(18):
            x=-.18+i*.021
            g.beam((x,.181,.69),(x,.181,.95),.007,.008,CANE)
        for i in range(13):
            g.box((0,.177,.7+i*.02),(.36,.008,.005),CANE)
    else:
        g.cyl((0,0,.46),.225,.07,WOOD,32)
        g.cyl((0,0,.503),.196,.018,CANE,32)
        for x in [-.155,.155]:
            for y in [-.14,.14]:
                g.tube([(x*1.2,y*1.3,.035),(x,y,.44)],.023,WOOD,10)
        # Continuous steam-bent hoop, rising from rear legs.
        pts=[(-.19,.15,.38),(-.225,.17,.74)]
        pts.extend((.225*math.cos(a),.18,.75+.29*math.sin(a)) for a in [math.pi-i*math.pi/20 for i in range(21)])
        pts.append((.19,.15,.38));g.tube(pts,.022,WOOD,10)
        pts=[(.12*math.cos(a),.185,.74+.19*math.sin(a)) for a in [math.pi-i*math.pi/18 for i in range(19)]]
        g.tube(pts,.014,WOOD,8)
        g.tube([(.175*math.cos(i*math.tau/32),.175*math.sin(i*math.tau/32),.22) for i in range(33)],.014,WOOD,8)
    return g.finish(FURNITURE)


def instance(proto,name,loc,angle=0):
    ob=bpy.data.objects.new(name,proto.data);FURNITURE.objects.link(ob);ob.location=loc;ob.rotation_euler.z=angle
    return ob


def table(x,y,w=1.6,d=.85,square=False,angle=0):
    g=Geo('Dining table')
    g.box((0,0,.785),(w,d,.07),TABLE)
    g.box((0,0,.69),(w-.15,d-.15,.14),WOOD)
    for u in [-w/2+.12,w/2-.12]:
        for v in [-d/2+.11,d/2-.11]:
            g.box((u,v,.36),(.055,.055,.72),WOOD)
    ob=g.finish(FURNITURE,.009);ob.location=(x,y,0);ob.rotation_euler.z=angle
    proto=SQUARE if square else BENT
    n=max(2,int(w/.67))
    for side in [-1,1]:
        for j in range(n):
            u=(j-(n-1)/2)*(w-.45)/max(n-1,1);v=side*(d/2+.37)
            xx=x+u*math.cos(angle)-v*math.sin(angle);yy=y+u*math.sin(angle)+v*math.cos(angle)
            instance(proto,'Dining chair',(xx,yy,0),angle+(math.pi if side<0 else 0))
    # White folded napkins, stainless cutlery, small upright table number.
    props=Geo('Table settings')
    for side in [-1,1]:
        for j in range(n):
            u=(j-(n-1)/2)*(w-.45)/max(n-1,1);v=side*(d/2-.17)
            props.box((u,v,.829),(.115,.23,.008),LINEN)
            for dx in [-.027,.028]: props.box((u+dx,v,.837),(.011,.16,.006),SILVER)
    props.box((w*.36,0,.9),(.08,.025,.15),LINEN)
    ob=props.finish(DETAILS);ob.location=(x,y,0);ob.rotation_euler.z=angle


def pendant(g,x,y,top=3.5):
    g.tube([(x,y,top+.5),(x,y,top-.15)],.009,STEEL)
    profile=[(.08,-.18),(.19,-.23),(.27,-.4),(.25,-.62),(.15,-.76),(.075,-.79)]
    # Open basket weave, not a solid orange sphere.
    for j in range(24):
        a=j*math.tau/24
        g.tube([(x+r*math.cos(a),y+r*math.sin(a),top+h) for r,h in profile],.009,CANE,5)
    for k in range(15):
        h=-.22-k*.037
        r=.08+.185*math.sin((k+1)/16*math.pi)**.7
        g.tube([(x+r*math.cos(j*math.tau/32),y+r*math.sin(j*math.tau/32),top+h) for j in range(33)],.006,CANE,5)
    g.lathe((x,y,top-.51),[(0,-.12),(.065,-.09),(.08,0),(.065,.09),(0,.12)],BULB,16)
    area('Warm basket light',(x,y,top-.67),(x,y,0),48,(1,.68,.38),.5)


def pergola(g,x,y,w=3.35,d=4.8):
    for dx in [-w/2,w/2]:
        for dy in [-d/2,d/2]:
            g.box((x+dx,y+dy,1.6),(.075,.075,3.2),PALEWOOD)
        g.box((x+dx,y,3.13),(.09,d+.22,.13),PALEWOOD)
    for j in range(9):
        yy=y-d/2+j*d/8
        g.box((x,yy,3.21),(w+.22,.055,.09),PALEWOOD)
    # Partial privacy screen at one end, keeping circulation open.
    for j in range(8):
        g.box((x,y+d/2,1.95+j*.12),(w,.045,.075),PALEWOOD)
    for j in range(19):
        g.box((x-w/2+j*w/18,y+d/2,.57),(.018,.035,1.05),PALEWOOD)
    pendant(g,x,y,3.17)


def build():
    global LIGHTS,CAMS,FURNITURE,DETAILS,STEEL,WOOD,TABLE,CANE,CUSHION,LINEN,SILVER,GREEN,SOIL,PALEWOOD,BULB,BENT,SQUARE
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for c in list(bpy.data.collections):
        if c.users==0 or c.name=='Collection': bpy.data.collections.remove(c)
    SHELL=collection('01 | Architecture · estimated 18 × 34 m')
    ROOF=collection('02 | Standing seam roof & timber soffit')
    STRUCTURE=collection('03 | Exposed steel portal frames')
    GLAZING=collection('04 | Glazing & Rembayung wordmark')
    FURNITURE=collection('05 | Tables & two reference chair types')
    JOINERY=collection('06 | Pergolas · slats · blinds · kuih counter')
    PLANTS=collection('07 | Central tree & tropical planting')
    DETAILS=collection('08 | Tableware & services')
    LIGHTS=collection('09 | Warm architectural lighting')
    CAMS=collection('10 | Reference viewpoints')
    SITE=collection('11 | Forecourt & street context')

    STEEL=material('Charcoal powder-coated steel',(.027,.035,.037),.32,.68)
    METAL=material('Graphite standing seam roof',(.12,.16,.19),.37,.75)
    SILVER=material('Brushed stainless steel',(.5,.54,.56),.24,.86)
    WALL=textured('Warm off-white plaster',(.58,.57,.52),(.84,.82,.74),80,.8,.12)
    CONCRETE=textured('Mottled polished concrete',(.17,.19,.175),(.44,.45,.40),12,.5,.22)
    GROUT=material('Warm mortar grout',(.50,.40,.28),.8)
    TILES=[textured('Terracotta tone %02d'%i,(.27+i*.016,.065+i*.007,.032+i*.005),(.46+i*.01,.17+i*.004,.081+i*.005),55,.51,.12) for i in range(6)]
    WOOD=textured('Honey brown bentwood',(.11,.036,.009),(.40,.18,.051),4,.32,.08,(2,2,55))
    TABLE=textured('Polished wood tabletops',(.18,.065,.016),(.49,.23,.076),4,.28,.06,(1,48,6))
    PALEWOOD=textured('Natural timber partitions',(.34,.18,.066),(.68,.46,.22),5,.48,.08,(35,35,1))
    CEILING=textured('Golden timber ceiling',(.22,.09,.025),(.57,.29,.092),6,.42,.06,(1,65,5))
    CANE=material('Woven rattan',(.56,.35,.13),.63)
    CUSHION=material('Cream seat upholstery',(.75,.68,.52),.87)
    LINEN=material('Ivory linen',(.91,.89,.79),.86)
    SOIL=material('Dark potting soil',(.033,.023,.013),1)
    POT=textured('Chalk ceramic tree planter',(.49,.44,.33),(.79,.74,.62),50,.7,.17)
    BARK=textured('Tree bark',(.062,.032,.015),(.23,.12,.044),20,.9,.3,(12,12,1))
    GREEN=[material('Foliage %02d'%i,c,.7) for i,c in enumerate([(.022,.074,.014),(.035,.14,.021),(.077,.22,.039),(.13,.27,.057),(.052,.12,.026)])]
    BULB=material('2700K warm light', (1,.65,.27),.3,0,5)
    BRICKS=[material('Fired red brick %02d'%i,(.25+i*.018,.075+i*.009,.046+i*.008),.81) for i in range(6)]
    RED=material('Burgundy textile',(.20,.018,.025),.95)
    GOLD=material('Brass details',(.64,.36,.085),.28,.65)
    GLASS=material('Clear architectural glass',(.89,.95,.96),.035)
    p=MATS[GLASS].node_tree.nodes.get('Principled BSDF')
    p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.45

    floor=Geo('Floor slab, concrete walkways & individual terracotta tiles')
    floor.box((0,17,-.18),(18,34,.32),CONCRETE)
    # Continuous reddish central strip and dining strips, with two concrete aisles.
    for xi in range(40):
        x=-8.775+xi*.45
        for yi in range(76):
            y=.225+yi*.445
            if (3.0<abs(x)<4.65) or y>29: continue
            floor.box((x,y,-.012),(.441,.436,.026),RNG.choice(TILES))
    floor.finish(SHELL)
    walls=Geo('Side plaster walls, sills and rear service wall')
    for side in [-1,1]:
        x=side*9
        walls.box((x,17,.40),(.22,34,.8),WALL)
        walls.box((x,17,5.37),(.22,34,4.2),WALL)
        for y in [0,5.6,11.2,16.8,22.4,28,34]:
            walls.box((x,y,1.95),(.28,.24,2.3),WALL)
        walls.box((x,17,.84),(.32,34,.12),PALEWOOD)
    walls.box((0,33.95,2.0),(18,.23,4),WALL)
    walls.box((0,29.8,1.8),(18,.18,3.6),GROUT)
    walls.finish(SHELL)
    cladding=Geo('Dark external side cladding and rainwater downpipes')
    for side in [-1,1]:
        cladding.box((side*9.135,17,5.37),(.035,34,4.2),METAL)
        cladding.box((side*9.135,17,.40),(.035,34,.8),STEEL)
        for j in range(46):
            cladding.box((side*9.159,.2+j*.74,5.37),(.018,.016,4.2),STEEL)
        for y in [.18,33.8]:
            cladding.tube([(side*9.40,y,7.12),(side*9.27,y,6.8),(side*9.27,y,.2)],.06,STEEL,12)
    cladding.finish(SHELL)
    brick=Geo('Rear exposed red-brick wall')
    for iz in range(28):
        for ix in range(53):
            x=-8.8+ix*.34+(iz%2)*.17
            z=.07+iz*.14
            if abs(x)>8.8:continue
            if z<2.45 and (abs(x+6.7)<.78 or abs(x-2.5)<.95):continue
            brick.box((x,29.68,z),(.327,.10,.128),RNG.choice(BRICKS))
    brick.finish(SHELL)

    portals=Geo('Steel I-section portal frames, girts & bracing')
    for y in [0,5.6,11.2,16.8,22.4,28,34]:
        for side in [-1,1]:
            x=side*8.86
            portals.box((x,y,EAVE/2),(.21,.28,EAVE),STEEL)
            a=(x,y,EAVE);b=(0,y,RIDGE-.12)
            portals.beam(a,b,.20,.28,STEEL)
            portals.beam((side*.0,y,RIDGE-.37),(side*8.74,y,EAVE-.23),.035,.36,STEEL)
        # Horizontal tension tie and king rod visible in the reference interior.
        portals.tube([(-8.75,y,7.53),(8.75,y,7.53)],.018,SILVER)
        portals.tube([(0,y,7.53),(0,y,13.75)],.015,SILVER)
        for s in [-1,1]:portals.tube([(s*8.65,y,7.58),(s*2.2,y,12.2)],.011,SILVER)
    for side in [-1,1]:
        for z in [3.45,7.35]:portals.box((side*8.81,17,z),(.15,34,.17),STEEL)
        for f in [.2,.4,.6,.8]:
            x=side*9*f;z=RIDGE-(RIDGE-EAVE)*f-.12
            portals.box((x,17,z),(.06,34,.075),SILVER)
    portals.finish(STRUCTURE)

    roof=Geo('Two pitched metal roof planes with ridge cap & standing seams')
    soffit=Geo('Warm timber soffit panels')
    for side in [-1,1]:
        x=side*9.45;z=EAVE-(.45/9)*(RIDGE-EAVE)
        roof.mesh([(0,-.65,RIDGE+.12),(x,-.65,z+.12),(x,34.65,z+.12),(0,34.65,RIDGE+.12)],[(0,1,2,3)],METAL)
        for j in range(77):
            y=-.6+j*.46
            roof.beam((0,y,RIDGE+.145),(x,y,z+.145),.032,.035,METAL)
        roof.beam((0,-.7,RIDGE+.13),(x,-.7,z+.13),.23,.20,STEEL)
        roof.beam((0,34.7,RIDGE+.13),(x,34.7,z+.13),.23,.20,STEEL)
        roof.box((x,17,z),( .17,35.4,.28),STEEL)
        soffit.mesh([(0,-.6,RIDGE),(x,-.6,z),(x,34.6,z),(0,34.6,RIDGE)],[(3,2,1,0)],CEILING)
        # Fine soffit joints run lengthwise up each slope.
        for j in range(1,18):
            f=j/18;xx=x*f;zz=RIDGE+(z-RIDGE)*f-.017
            soffit.box((xx,17,zz),(.014,35.2,.016),PALEWOOD)
    roof.box((0,17,RIDGE+.14),(.17,35.5,.14),METAL)
    roof.finish(ROOF);soffit.finish(ROOF)

    glass=Geo('Facade and side window panes')
    mull=Geo('Black facade mullions, transoms & entrance doors')
    for y in [-.06,34.04]:
        # Individual planar panes; thickness kept small for glass transmission.
        for j in range(12):
            x1=-9+j*1.5;x2=x1+1.5
            h1=RIDGE-abs(x1)/9*(RIDGE-EAVE);h2=RIDGE-abs(x2)/9*(RIDGE-EAVE)
            bottom=2.72 if y<0 and j in [5,6] else .1
            glass.mesh([(x1,y,bottom),(x2,y,bottom),(x2,y,h2-.08),(x1,y,h1-.08)],[(0,1,2,3)],GLASS)
        for x in [-9+i*1.5 for i in range(13)]:
            h=RIDGE-abs(x)/9*(RIDGE-EAVE)
            bottom=2.72 if y<0 and x==0 else 0
            mull.box((x,y-.025,(h+bottom)/2),(.06,.105,h-bottom),STEEL)
        for z in [2.7,3.5,5.4,7.4,9.4,11.4,13.2]:
            w=min(18,18*(RIDGE-z)/(RIDGE-EAVE))
            mull.box((0,y-.028,z),(w,.11,.075),STEEL)
    mull.box((0,-.13,3.18),(18.2,.30,.65),STEEL)
    for side in [-1,1]:
        mull.beam((side*6,-.09,3.5),(side*6,-.09,9.5),.09,.11,STEEL)
        mull.tube([(side*6,-.11,5.4),(side*3,-.11,9.4)],.022,STEEL)
        mull.tube([(side*3,-.11,9.4),(0,-.11,13.9)],.022,STEEL)
        mull.tube([(side*6,-.11,9.5),(side*3,-.11,9.4)],.022,STEEL)
    for side in [-1,1]:
        for j in range(12):
            y=1.45+j*2.8
            glass.mesh([(side*8.96,y-1.34,.88),(side*8.96,y+1.34,.88),(side*8.96,y+1.34,3.24),(side*8.96,y-1.34,3.24)],[(0,1,2,3)],GLASS)
            mull.box((side*8.9,y-1.4,2.05),(.11,.055,2.55),STEEL)
        mull.box((side*8.9,17,3.21),(.12,34,.07),STEEL)
    # Open entrance: foreground door leaves visibly swung inward, separate mesh.
    # Facade remains glazing at ground level except doorway gap, removed below.
    for side in [-1,1]:
        x1=side*1.5;x2=side*.9;y2=1.3
        glass.mesh([(x1,0,.08),(x2,y2,.08),(x2,y2,2.68),(x1,0,2.68)],[(0,1,2,3)],GLASS)
        for z in [.08,2.68]:mull.beam((x1,0,z),(x2,y2,z),.035,.04,STEEL)
        mull.box((x2,y2,1.38),(.035,.04,2.6),STEEL)
        mull.tube([(x2+side*.10,y2-.15,1.0),(x2+side*.10,y2-.15,1.75)],.016,SILVER)
    glass_ob=glass.finish(GLAZING);glass_ob.visible_shadow=False
    mull.finish(GLAZING)
    # Authentic supplied project wordmark, UV mapped with transparent background.
    logo=material('Rembayung original illuminated wordmark',(1,.65,.22),.3,0,1)
    nt=MATS[logo].node_tree;p=nt.nodes.get('Principled BSDF')
    img=bpy.data.images.load(str(ROOT/'public/rembayung-wordmark.png'));img.pack()
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=img
    nt.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    nt.links.new(tex.outputs['Color'],p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value=1.4
    nt.links.new(tex.outputs['Alpha'],p.inputs['Alpha'])
    g=Geo('Rembayung • authentic facade wordmark')
    g.mesh([(-5.5,-.25,6.9),(5.5,-.25,6.9),(5.5,-.25,10.567),(-5.5,-.25,10.567)],[(0,1,2,3)],logo)
    ob=g.finish(GLAZING);uv=ob.data.uv_layers.new(name='Wordmark UV')
    for poly in ob.data.polygons:
        for loop,coord in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop].uv=coord
    ob.visible_shadow=False
    g=Geo('Rembayung • smaller right-side illuminated wordmark')
    g.mesh([(9.2,3.5,5.0),(9.2,8.5,5.0),(9.2,8.5,6.667),(9.2,3.5,6.667)],[(0,1,2,3)],logo)
    ob=g.finish(GLAZING);uv=ob.data.uv_layers.new(name='Wordmark UV')
    for poly in ob.data.polygons:
        for loop,coord in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop].uv=coord
    ob.visible_shadow=False

    # Rear mezzanine: open-front gallery and staircase against brick backdrop.
    mezz=Geo('Rear mezzanine, staircase & balustrade')
    mezz.box((0,31.65,3.89),(17.6,4.7,.22),STEEL)
    mezz.box((0,31.65,4.02),(17.55,4.65,.065),TABLE)
    for x in [-8.5,-4,0,4,8.5]:mezz.box((x,31.8,1.93),(.17,.18,3.86),STEEL)
    for j in range(61):
        x=-8.65+j*.286
        if -3.2<x<-2.0:continue
        mezz.box((x,29.30,4.56),(.025,.025,1.08),STEEL)
    for a,b in [(-8.8,-3.2),(-2.0,8.8)]:
        mezz.box(((a+b)/2,29.3,5.12),(b-a,.08,.075),WOOD)
        mezz.box(((a+b)/2,29.3,4.15),(b-a,.055,.045),STEEL)
    # Stair rises from right to left in the front-facing view of the rear wall.
    steps=24
    for j in range(steps):
        x=6.9-j*.39;z=(j+1)*4.02/steps
        mezz.box((x,28.35,z-.045),(.405,1.35,.09),STEEL)
        mezz.box((x,28.35,z+.008),(.37,1.31,.025),TABLE)
        for y in [27.69,29.01]:
            mezz.box((x,y,z+.51),(.025,.025,1.03),STEEL)
    for y in [27.67,29.03]:
        mezz.beam((7.12,y,.01),(-2.25,y,4.0),.16,.13,STEEL)
        mezz.beam((7.12,y,1.09),(-2.25,y,5.08),.075,.065,WOOD)
    mezz.box((-2.6,28.7,4.0),(1.1,2.0,.14),TABLE)
    mezz.finish(SHELL)
    BENT=make_chair(False);SQUARE=make_chair(True)
    # Prototype objects are moved below site, then unlinked after instantiation.
    BENT.location.z=-30;SQUARE.location.z=-30
    for x in [-6.6,-2.8,2,6]:
        before=set(bpy.data.objects)
        table(x,32,2,.8,True)
        for ob in set(bpy.data.objects)-before:ob.location.z+=4.06
    for side in [-1,1]:
        for j,y in enumerate([4.8,9.8,14.9,20.1,25.0]):
            table(side*6.55,y,2.05 if j%2 else 1.6,.88,j%2==1)
    table(0,5.2,2.7,.95)
    table(0,9.2,2.5,.9)
    table(0,12.4,2.3,.9)
    table(0,20.2,3.2,1.0)
    table(-1.4,24,1.6,.85);table(1.4,24,1.6,.85)
    perg=Geo('Timber pergolas, slatted dining partitions & pendant baskets')
    for side in [-1,1]:
        for y in [7.35,17.5]:pergola(perg,side*6.5,y,3.45,5.0)
    # The central planted pavilion beneath the main tree canopy.
    pergola(perg,0,12.9,4.25,6.0)
    for side in [-1,1]:
        for y in [3,12.3,22.6,26.2]:
            perg.box((side*4.8,y,1.8),(.055,.055,3.6),STEEL)
            perg.box((side*5.2,y,3.58),(.85,.055,.055),STEEL)
            pendant(perg,side*5.45,y,3.55)
    # Rear kampung-style decorative pavilion visible in the reverse interior photo.
    for x in [-2.25,2.25]:perg.box((x,26.35,1.65),(.085,.085,3.3),PALEWOOD)
    for z in [.2,2.58,3.24]:perg.box((0,26.35,z),(4.65,.09,.08),PALEWOOD)
    for j in range(67):
        x=-2.2+j*.067
        perg.box((x,26.49,1.40),(.042,.038,2.26),SILVER)
    for x in [-1.1,0,1.1]:perg.box((x,26.39,1.41),(.055,.055,2.34),PALEWOOD)
    # Curved burgundy valance with visible fabric folds.
    for j in range(44):
        x=-2.2+j*.10;sag=.24*(1-(x/2.2)**2)
        perg.box((x,26.31,2.91-sag),(.105,.045+.026*math.sin(j*1.5),.38),RED)
    for x in [-1.65,1.65]:pendant(perg,x,26.0,3.30)
    perg.finish(JOINERY)
    blinds=Geo('Bamboo roller blinds & wall mounted air conditioning')
    for side in [-1,1]:
        for y in [2.8,8.4,14,19.6,25.2,30.8]:
            for k in range(21):blinds.box((side*8.7,y,3.38-k*.049),(.023,4.9,.037),CANE)
            blinds.box((side*8.52,y,3.95),(.40,1.35,.26),LINEN)
            blinds.box((side*8.30,y,3.90),(.014,1.2,.065),STEEL)
    blinds.finish(JOINERY)
    pots=Geo('Timber planter boxes & ceramic tree pot');plants=Geo('Tropical broadleaf planting')
    for side in [-1,1]:
        for y in [4,10,16,22]:planter(pots,plants,side*8.2,y,3.8,math.pi/2)
        planter(pots,plants,side*5.3,1.3,5.2)
    pots.lathe((0,15.9,0),[(0,.03),(.62,.03),(.88,.2),(.93,.72),(.78,.88),(.70,.88),(.72,.75)],POT,64)
    pots.cyl((0,15.9,.76),.72,.04,SOIL,40)
    for j in range(56):
        a=j*math.tau/56
        pots.tube([(.90*math.cos(a),15.9+.9*math.sin(a),.27),(.91*math.cos(a),15.9+.91*math.sin(a),.64)],.009,POT,5)
    tree=Geo('Central indoor tree · branching trunk & individual leaves')
    tree.tube([(0,15.9,.7),(.03,15.92,2.3),(-.12,15.92,3.6),(.05,15.9,4.9)],.13,BARK,12,[.15,.12,.087,.028])
    for j in range(24):
        a=RNG.random()*math.tau;r=RNG.uniform(.6,2.1);h=RNG.uniform(3.8,5.7)
        c=(math.cos(a)*r,15.9+math.sin(a)*r,h)
        tree.tube([(0,15.9,2.8+j*.045),(c[0]*.55,15.9+(c[1]-15.9)*.55,h-.5),c],.035,BARK,7,[.055,.027,.008])
        for k in range(450):
            theta=RNG.random()*math.tau;u=RNG.uniform(-1,1);rad=RNG.random()**(1/3)
            pos=(c[0]+.92*rad*math.sqrt(1-u*u)*math.cos(theta),c[1]+.92*rad*math.sqrt(1-u*u)*math.sin(theta),h+.65*rad*u)
            leaf(tree,pos,RNG.uniform(.22,.37),.15,RNG.random()*math.tau,RNG.uniform(-.6,.6),RNG.choice(GREEN))
    pots.finish(PLANTS);plants.finish(PLANTS);tree.finish(PLANTS)

    # Traditional kuih display near entry, with lower textile shelves.
    counter=Geo('Kuih display cabinet · timber brass glass and colourful trays')
    cx,cy=-2.75,2.1
    counter.box((cx,cy,.57),(3.65,.83,1.14),WOOD)
    for z in [.15,.4,.66,1.13]:counter.box((cx,cy-.01,z),(3.72,.88,.045),TABLE)
    for x in [cx-1.83,cx,cx+1.83]:counter.box((x,cy-.44,.57),(.055,.065,1.1),WOOD)
    for x in [cx-1.81,cx+1.81]:
        counter.box((x,cy,1.48),(.055,.83,.67),WOOD)
    counter.box((cx,cy,1.81),(3.73,.88,.055),GOLD)
    counter.box((cx,cy-.42,1.48),(3.60,.012,.6),GLASS)
    counter.box((cx,cy,1.81),(3.55,.77,.012),GLASS)
    sweets=[material('Kuih '+n,c,.4) for n,c in [('pandan',(.18,.65,.018)),('lapis',(.85,.035,.22)),('talam',(.90,.81,.57)),('pulut',(.25,.30,.12))]]
    for j in range(6):
        xx=cx-1.47+j*.59
        counter.box((xx,cy,1.185),(.53,.67,.055),PALEWOOD)
        for a in range(3):
            for b in range(4):counter.box((xx-.16+a*.16,cy-.23+b*.15,1.25),(.135,.12,.075),sweets[j%4])
        for z in [.2,.45,.71]:
            counter.box((xx,cy-.15,z),(.48,.43,.075),[RED,PALEWOOD,LINEN][j%3])
    counter.finish(JOINERY)
    fans=Geo('Suspended large ceiling fans')
    for y in [8,20]:
        fans.tube([(0,y,13.7),(0,y,10.7)],.027,STEEL)
        fans.cyl((0,y,10.62),.18,.18,STEEL)
        for j in range(6):
            a=j*math.tau/6
            fans.box((math.cos(a)*1.15,y+math.sin(a)*1.15,10.6),(2.15,.17,.035),STEEL,a)
    fans.finish(DETAILS)
    # Warm roof washes, matching the highly recognisable illuminated rafters.
    for y in [1.2,6.0,11.5,17.0,22.5,28,32.5]:
        for side in [-1,1]:
            area('Amber soffit uplight',(side*8.3,y,7.1),(side*4.8,y,10.6),260,(1,.63,.30),1.4)
    for y in [4,12,21,30]:area('Soft interior bounce',(0,y,8.1),(0,y,0),420,(1,.79,.56),6)

    site=Geo('Paved forecourt, low curb, street and entrance benches')
    PAVING=textured('Forecourt paving',(.25,.27,.25),(.51,.50,.43),60,.78,.17)
    ROAD=textured('Asphalt',(.039,.046,.054),(.080,.087,.091),170,.91,.28)
    site.box((0,15,-.35),(23,40,.3),PAVING)
    site.box((0,-8.8,-.47),(65,9,.15),ROAD)
    site.box((0,-4.0,-.24),(25,.3,.28),PAVING)
    for x in [-25,-18,-11,-4,3,10,17,24]:site.box((x,-9,-.386),(3,.12,.009),LINEN)
    for x in [-6.4,6.4]:
        site.box((x,-.85,.47),(2.9,.47,.07),WOOD)
        for dx in [-1.1,1.1]:site.box((x+dx,-.85,.23),(.065,.42,.46),STEEL)
    for x in [-10.3,10.3]:
        for y in [-2,5,15,25]:
            site.box((x,y,.44),(.10,.10,.88),STEEL)
            site.box((x,y,.92),(.18,.18,.09),BULB)
    site.finish(SITE)
    # Move the upstairs table assemblies as a group, and keep ground floor templates clean.
    bpy.data.objects.remove(BENT,do_unlink=True);bpy.data.objects.remove(SQUARE,do_unlink=True)

    camera('01 Exterior · blue hour',(-15,-27,3.3),(0,3.0,6.6),37)
    camera('02 Interior · mid-hall towards mezzanine',(0,17.8,1.7),(0,30,5.2),18)
    camera('03 Interior · mezzanine towards facade',(0,28.2,5.9),(0,8.5,3.3),20)
    camera('04 Exterior · aerial',(29,-35,31),(0,14,5),42)
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC';scene.unit_settings.length_unit='METERS'
    scene['reference_status']='Photo-derived reconstruction; 18m width, 34m length, 7.5m eaves and 14.1m ridge are estimates.'
    scene['reference_basis']='4 user photographs and 35.92-second user video. Rear service rooms and invisible areas not surveyed.'
    scene['coordinates']='X facade width, +Y rear, +Z up; main entrance (0,0,0).'
    scene['asset_version']='Rembayung reference reconstruction v1'
    scene.camera=bpy.data.objects.get('01 Exterior · blue hour')
    return scene


def setup_render(scene):
    scene.render.engine='CYCLES'
    scene.cycles.samples=16 if '--draft' in ARGS else 32
    scene.cycles.adaptive_threshold=.06;scene.cycles.adaptive_min_samples=8
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8;scene.cycles.transmission_bounces=8
    scene.cycles.transparent_max_bounces=12
    scene.cycles.device='CPU'
    try:
        if '--metal' not in ARGS:raise RuntimeError('CPU is portable default; --metal opts into Metal')
        pref=bpy.context.preferences.addons['cycles'].preferences
        pref.compute_device_type='METAL';pref.get_devices()
        for device in pref.devices:device.use=device.type=='METAL'
        scene.cycles.device='GPU'
    except Exception: scene.cycles.device='CPU'
    scene.render.resolution_x=1400;scene.render.resolution_y=1100
    scene.render.resolution_percentage=55 if '--draft' in ARGS else 100
    scene.render.image_settings.file_format='PNG'
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.018,.041,.10,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.3
    scene.view_settings.view_transform='AgX'
    scene.view_settings.exposure=.7
    # Open the saved file directly in camera view with material preview colors.
    for screen in bpy.data.screens:
        for space in screen.areas:
            if space.type=='VIEW_3D':
                space.spaces.active.region_3d.view_perspective='CAMERA'
                space.spaces.active.clip_end=500


def export(scene):
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'rembayung.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in scene.objects:
        if ob.type=='MESH':ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'rembayung.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
    meshes=[ob for ob in scene.objects if ob.type=='MESH']
    stats={'estimated_dimensions_metres':{'width':WIDTH,'depth':DEPTH,'eave':EAVE,'ridge':RIDGE},'mesh_objects':len(meshes),'source_faces':sum(len(ob.data.polygons) for ob in meshes),'materials':len(bpy.data.materials),'cameras':[ob.name for ob in scene.objects if ob.type=='CAMERA'],'notes':['Photo-based estimated dimensions.','Native blend preserves procedural surface shaders. GLB uses portable base PBR values; procedural grain is not baked.','GLB includes site context; native scene collections allow site removal.','No deployment or game-world replacement performed.']}
    (OUT/'manifest.json').write_text(json.dumps(stats,indent=2)+'\n')


def render(scene):
    names=[('01 Exterior · blue hour','01-exterior-night'),('02 Interior · mid-hall towards mezzanine','02-interior-rear'),('03 Interior · mezzanine towards facade','03-interior-front'),('04 Exterior · aerial','04-exterior-aerial')]
    selected=next((a.split('=',1)[1].split(',') for a in ARGS if a.startswith('--views=')),None)
    world=scene.world.node_tree.nodes['Background']
    for name,filename in names:
        if selected and filename[:2] not in selected:continue
        scene.camera=bpy.data.objects[name]
        exterior='Exterior' in name
        world.inputs[0].default_value=(.018,.041,.10,1) if filename=='01-exterior-night' else (.65,.72,.8,1)
        world.inputs[1].default_value=.3 if filename=='01-exterior-night' else .55
        scene.view_settings.exposure=.7 if exterior else .35
        scene.render.resolution_x=1400 if exterior else 1200
        scene.render.resolution_y=1100 if exterior else 1400
        scene.render.filepath=str(OUT/'renders'/f'{filename}.png')
        print('RENDERING',filename,flush=True)
        bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    if '--render-only' in ARGS:
        bpy.ops.wm.open_mainfile(filepath=str(OUT/'rembayung.blend'))
        scene=bpy.context.scene;setup_render(scene)
    else:
        scene=build();setup_render(scene);export(scene)
    if '--no-render' not in ARGS:render(scene)
    print('REMBAYUNG COMPLETE',OUT,flush=True)
