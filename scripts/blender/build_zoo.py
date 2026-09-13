"""Zoo Negara Mini Lepak and the city's static street furniture.

Players walk right up to the zoo animals, so the elephants, giraffes, zebras, the lion and
the flamingos are lathed along a centreline instead of being stacks of boxes and balls: a
barrel body, a tapering neck, a curling trunk, flat fan ears. The zebra's stripes are the
body loft's own material strips, so the pattern wraps the barrel for free. Everything else
in the park (paths, rails, the eastern leaf gateway, the flamingo pond and the lion rock)
keeps the footprints world.ts already draws, and the game keeps painting its own canvas
signs (ZOO NEGARA MINI LEPAK, GAJAH, SAVANA, KOLAM FLAMINGO) on top.

The second asset is the city furniture world.ts scatters by hand: the two Malaysian flags,
the two street signs, the courtyard bunting, the boundary hedges (clipped kemuning on a concrete
planter kerb), the seawall with its granite rock armour where the city meets the sea, and the
low fountain on the KLCC delivery plaza. Skin only - no collision box, seat or coordinate moves.
The hedge, seawall and rock carry PBR textures (pbr_kit + ground_textures.py), embedded as WebP.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_zoo.py -- --no-render
  add --only=Furniture (or --only=Zoo) to rebuild one asset; then node scripts/blender/compress-glb.mjs <glb>

Outputs (public/assets/models/environment):
  LM_ENV_Zoo.glb       node 'zoo', origin at the park pad (game -123, -112)
  LM_ENV_Furniture.glb node 'furniture', origin at the world origin (absolute coordinates)
"""
import bpy, bmesh, math, json, sys, random
from pathlib import Path
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import vloft,sphere
import pbr_kit as kit
import ground_textures as GT

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/zoo'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ONLY=[a.split('=',1)[1] for a in ARGS if a.startswith('--only=')]   # e.g. --only=Furniture

# ---------------------------------------------------------------- materials
GRASS=mat('Zoo grass',(.55,.64,.42),.95);SCRUB=mat('Zoo scrub',(.72,.66,.46),.95)
PATH=mat('Zoo path',(.84,.79,.65),.9);KERB=mat('Zoo kerb',(.74,.72,.63),.85)
STONE=mat('Zoo stone',(.68,.66,.58),.9);DARK=mat('Zoo dark',(.12,.13,.12),.55)
TIMBER=mat('Zoo rail timber',(.33,.42,.33),.75);POSTW=mat('Zoo rail post',(.40,.35,.26),.8)
GATE=mat('Zoo gate green',(.19,.37,.28),.7);GATE2=mat('Zoo gate trim',(.25,.46,.34),.6)
LEAF=mat('Zoo leaf',(.46,.64,.31),.6);LEAF2=mat('Zoo leaf pale',(.58,.73,.38),.6)
SIGNBOARD=mat('Zoo sign board',(.13,.30,.23),.7)
HIDE=mat('Elephant hide',(.52,.54,.53),.85);HIDE2=mat('Elephant ear',(.45,.47,.46),.85)
TUSK=mat('Elephant tusk',(.93,.90,.79),.4)
GIR=mat('Giraffe coat',(.84,.66,.33),.75);GIRSPOT=mat('Giraffe patch',(.46,.32,.22),.75)
ZEB=mat('Zebra white',(.93,.92,.86),.7);ZEBD=mat('Zebra black',(.17,.19,.19),.65)
LION=mat('Lion coat',(.79,.60,.31),.75);MANE=mat('Lion mane',(.45,.29,.17),.8)
LIONPALE=mat('Lion muzzle',(.91,.85,.70),.7)
FLAM=mat('Flamingo pink',(.93,.56,.61),.65);FLAMD=mat('Flamingo deep',(.85,.38,.45),.65)
WATER=mat('Zoo water',(.30,.56,.58),.12,alpha=.88,two_sided=True)
ROCK=mat('Zoo rock',(.55,.47,.36),.92);ROCK2=mat('Zoo rock shade',(.47,.40,.31),.92)
REED=mat('Zoo reed',(.42,.55,.32),.8)
# furniture
POLE=mat('Flagpole',(.86,.87,.83),.35);FLAGR=mat('Flag red',(.78,.16,.16),.6,two_sided=True)
FLAGW=mat('Flag cream',(.96,.94,.88),.6,two_sided=True);FLAGB=mat('Flag navy',(.06,.15,.42),.6,two_sided=True)
STREET=mat('Street post',(.45,.52,.45),.5);BOARD=mat('Street board',(.14,.36,.29),.7)
BUNT1=mat('Bunting gold',(.89,.71,.30),.6,two_sided=True);BUNT2=mat('Bunting red',(.73,.32,.25),.6,two_sided=True)
BUNT3=mat('Bunting teal',(.34,.55,.46),.6,two_sided=True);CORD=mat('Bunting cord',(.30,.30,.26),.7)
kit.setup('furniture',ROOT/'assets/ground/textures',20260914)
HEDGE=kit.pbr('Hedge leaves','hedge','#e8eedf',.72,1.5,strength=1.3,source=GT)
HEDGEB=kit.pbr('Hedge planter kerb','concrete','#bdbab2',.9,2.0,source=GT)
SEAWALL=kit.pbr('Seawall concrete','concrete','#d8d5cc',.9,2.0,source=GT)
ARMOUR=kit.pbr('Armour granite','granite','#a7abad',.86,1.6,strength=1.4)
FSTONE=mat('Fountain stone',(.76,.76,.68),.85);FTRIM=mat('Fountain trim',(.66,.67,.60),.8)
FWATER=mat('Fountain water',(.42,.68,.68),.1,alpha=.8,two_sided=True)
JET=mat('Fountain jet',(.80,.90,.90),.15,alpha=.6,two_sided=True)

# ---------------------------------------------------------------- lathe helpers
def L_of(x=0.0,z=0.0,yaw=0.0,s=1.0):
    """Local -> game transform: uniform scale, then the game's own Y rotation, then offset."""
    c,sn=math.cos(yaw),math.sin(yaw)
    def L(p):
        px,py,pz=p[0]*s,p[1]*s,p[2]*s
        return (x+px*c+pz*sn,py,z-px*sn+pz*c)
    return L
IDENT=L_of()

def shell(name,verts,faces,m,tag,smooth,strips,n,caps):
    """Mesh from ring verts. Winding is built outward, so no normal repair pass is needed."""
    mats=list(m) if isinstance(m,(list,tuple)) else [m]*max(strips,1)
    order=[]
    for mm in mats:
        if mm not in order:order.append(mm)
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob)
    for mm in order:ob.data.materials.append(mm)
    side=strips*n
    for f in me.polygons:
        if f.index<side:f.material_index=order.index(mats[f.index//n]);f.use_smooth=smooth
        else:f.material_index=order.index(mats[0] if caps[0] and f.index==side else mats[-1]);f.use_smooth=False
    ob['asset']=tag;return ob

def limb(name,path,m,tag,n=8,L=IDENT,smooth=True,caps=(True,True)):
    """Lathe along a centreline. path: [(x,y,z,r)] or [(x,y,z,rx,ry)] in local coords.

    Rings sit perpendicular to the path, so one helper covers legs, necks, a curling trunk,
    a flat ear and a barrel body. Pass a list of materials to band the strips (zebra).
    """
    P=[Vector((p[0],p[1],p[2])) for p in path]
    R=[(p[3],p[3] if len(p)<5 else p[4]) for p in path]
    verts=[];faces=[];u=None
    for i,c in enumerate(P):
        t=P[min(i+1,len(P)-1)]-P[max(i-1,0)]
        t=t.normalized() if t.length>1e-6 else Vector((0,0,1))
        if u is None:
            ref=Vector((0,1,0)) if abs(t.y)<.9 else Vector((0,0,1))
            u=t.cross(ref).normalized()
        else:
            u=u-t*u.dot(t)
            u=u.normalized() if u.length>1e-5 else t.cross(Vector((0,0,1))).normalized()
        v=t.cross(u).normalized()
        rx,ry=R[i]
        for k in range(n):
            a=2*math.pi*k/n;q=c+u*(rx*math.cos(a))+v*(ry*math.sin(a))
            verts.append(pt(*L((q.x,q.y,q.z))))
    strips=len(P)-1
    for s in range(strips):
        for k in range(n):
            a=s*n+k;b=s*n+(k+1)%n;faces.append((a,b,b+n,a+n))
    if caps[0]:faces.append(tuple(range(n-1,-1,-1)))
    if caps[1]:faces.append(tuple(strips*n+k for k in range(n)))
    return shell(name,verts,faces,m,tag,smooth,strips,n,caps)

def disc(name,c,rx,ry,m,tag,n=10,L=IDENT,axis=(0,0,1),thick=.05,smooth=True):
    """Flat lens: ears, eyes, a lion's mane ruff, a water surface."""
    a=Vector(axis).normalized()*thick*.5
    return limb(name,[(c[0]-a.x,c[1]-a.y,c[2]-a.z,rx,ry),(c[0]+a.x,c[1]+a.y,c[2]+a.z,rx,ry)],m,tag,n=n,L=L,smooth=smooth)

def patch(name,x,y,z,r,m,tag,L=IDENT,n=6,side=1):
    """A coat marking sitting flush on a rounded flank: a flat facet on the surface, not a
    box bolted to it. x must be the body's own radius at that point, or it floats."""
    return disc(name,(x,y,z),r,r*.86,m,tag,n=n,L=L,axis=(side,0,0),thick=.05)

def run(name,axis,fixed,a0,a1,profile,m,tag,step=6.0,vary=None,smooth=False):
    """Long extrusion along a world axis with a per-station profile. profile: [(across,y)].

    axis 'z' runs along +z with across = +x; axis 'x' runs along +x with across = -z, which
    is what keeps the ring winding (and therefore the normals) facing outward in both cases.
    """
    n=len(profile);verts=[];faces=[];mats=[]
    count=max(2,int(round(abs(a1-a0)/step))+1)
    for i in range(count):
        t=i/(count-1);station=a0+(a1-a0)*t
        prof=vary(station,profile) if vary else profile
        for across,y in prof:
            if axis=='z':verts.append(pt(fixed+across,y,station))
            else:verts.append(pt(station,y,fixed-across))
        if i:mats.append(m[i%len(m)] if isinstance(m,(list,tuple)) else m)
    for s in range(count-1):
        for k in range(n):
            a=s*n+k;b=s*n+(k+1)%n;faces.append((a,b,b+n,a+n))
    faces.append(tuple(range(n-1,-1,-1)));faces.append(tuple((count-1)*n+k for k in range(n)))
    return shell(name,verts,faces,mats if isinstance(m,(list,tuple)) else m,tag,smooth,count-1,n,(True,True))

def ellipse(cx,cy,rx,ry,n=20):
    """Counter-clockwise in Blender XY, which is what vloft needs for outward normals."""
    return [(cx+rx*math.cos(2*math.pi*i/n),cy+ry*math.sin(2*math.pi*i/n)) for i in range(n)]

def rect(cx,cz,w,d):return [(cx-w/2,cz-d/2),(cx+w/2,cz-d/2),(cx+w/2,cz+d/2),(cx-w/2,cz+d/2)]

def lathe(name,x,z,profile,m,tag,n=20):
    """Revolve a cross-section around a vertical axis. profile: [(height,radius)] walked from
    the outside, over the top and back down the inside, which is the order that keeps every
    face pointing out of the solid."""
    return vloft(name,[(h,ellipse(x,-z,r,r,n)) for h,r in profile],[m]*(len(profile)-1),tag)

def boulder(name,x,y0,z,rx,rz,h,m,tag,seed=0,n=9):
    """Low-poly rock: a jittered polygon lofted to a smaller, jittered cap."""
    def ring(scale,jitter):
        return [(x+rx*scale*(1+jitter*math.sin(seed+i*2.1))*math.cos(2*math.pi*i/n),
                 -z+rz*scale*(1+jitter*math.cos(seed+i*1.7))*math.sin(2*math.pi*i/n)) for i in range(n)]
    return vloft(name,[(y0,ring(1.0,.16)),(y0+h*.55,ring(.86,.20)),(y0+h,ring(.42,.24))],[m,m],tag)

# ================================================================ zoo animals
T='zoo'

def elephant(x,z,s=1.0,yaw=0.0):
    """Adult at s=1.1 stands 2.6 m at the shoulder, as the boxes it replaces did."""
    L=L_of(x,z,yaw,s);o=[]
    o.append(limb('elephant body',[(0,1.44,-1.48,.12),(0,1.52,-1.22,.64,.70),(0,1.55,-.78,.90,.96),
        (0,1.54,-.22,.98,1.02),(0,1.56,.34,.96,.98),(0,1.62,.84,.84,.88),(0,1.66,1.12,.64,.70)],HIDE,T,n=12,L=L))
    o.append(limb('elephant head',[(0,1.76,1.02,.50,.58),(0,1.86,1.26,.64,.70),(0,1.84,1.52,.62,.66),
        (0,1.72,1.76,.50,.52),(0,1.58,1.92,.30,.30)],HIDE,T,n=10,L=L))
    o.append(limb('elephant trunk',[(0,1.54,1.90,.23),(0,1.22,2.06,.20),(0,.86,2.14,.17),
        (0,.52,2.10,.145),(0,.26,1.96,.12),(0,.14,1.80,.085)],HIDE,T,n=8,L=L))
    for side in (-1,1):
        # The attachment ring starts inside the skull, so the ear grows out of the head
        # rather than butting against it with a visible seam.
        o.append(limb('elephant ear',[(side*.40,1.88,1.26,.28,.24),(side*.56,1.84,1.10,.54,.45),
            (side*.70,1.80,.98,.57,.47),(side*.77,1.78,.92,.34,.28)],HIDE2,T,n=10,L=L))
        o.append(disc('elephant eye',(side*.40,1.86,1.46),.075,.075,DARK,T,n=6,L=L,axis=(side*.9,.1,.42),thick=.06))
        for zz in (.78,-1.02):
            o.append(limb('elephant leg',[(side*.56,1.42,zz,.31,.33),(side*.56,.80,zz,.275,.29),
                (side*.56,.20,zz,.29,.30),(side*.56,.04,zz,.33,.34)],HIDE,T,n=8,L=L))
        if s>.85:
            o.append(limb('elephant tusk',[(side*.26,1.44,1.84,.055),(side*.31,1.28,2.12,.042),
                (side*.35,1.22,2.32,.016)],TUSK,T,n=6,L=L))
    o.append(limb('elephant tail',[(0,1.46,-1.48,.09),(0,1.06,-1.62,.07),(0,.74,-1.64,.05)],HIDE,T,n=6,L=L))
    o.append(disc('elephant tail tuft',(0,.68,-1.64),.09,.09,DARK,T,n=6,L=L,axis=(0,1,.2),thick=.14))
    return o

def giraffe(x,z,yaw=0.0,s=1.0):
    L=L_of(x,z,yaw,s);o=[]
    o.append(limb('giraffe body',[(0,1.78,-1.08,.10),(0,1.88,-.88,.44,.48),(0,1.94,-.42,.54,.58),
        (0,2.02,.14,.58,.60),(0,2.14,.62,.52,.56),(0,2.22,.96,.34,.40)],GIR,T,n=10,L=L))
    o.append(limb('giraffe neck',[(0,2.26,.84,.36,.40),(0,2.92,1.00,.31,.35),(0,3.60,1.13,.275,.30),
        (0,4.26,1.23,.245,.27),(0,4.78,1.31,.225,.25)],GIR,T,n=8,L=L))
    o.append(limb('giraffe head',[(0,4.88,1.32,.21,.23),(0,5.04,1.54,.20,.21),(0,5.00,1.78,.155,.145),
        (0,4.90,1.94,.105,.095)],GIR,T,n=8,L=L))
    o.append(limb('giraffe mane',[(0,2.44,.68,.05,.16),(0,3.05,.84,.05,.15),(0,3.72,.97,.05,.14),
        (0,4.38,1.06,.05,.12),(0,4.86,1.14,.05,.09)],GIRSPOT,T,n=5,L=L))
    for side in (-1,1):
        o.append(disc('giraffe ear',(side*.21,5.06,1.42),.19,.11,GIR,T,n=6,L=L,axis=(side*.9,.3,-.2),thick=.05))
        o.append(disc('giraffe eye',(side*.18,5.02,1.60),.05,.05,DARK,T,n=5,L=L,axis=(side*.9,.1,.3),thick=.05))
        o.append(limb('giraffe ossicone',[(side*.10,5.12,1.44,.045),(side*.115,5.34,1.46,.036),
            (side*.12,5.42,1.47,.058)],GIRSPOT,T,n=5,L=L))
        for zz in (.62,-.78):
            o.append(limb('giraffe leg',[(side*.44,2.00,zz,.20),(side*.44,1.24,zz,.135),
                (side*.44,.62,zz,.115),(side*.44,.05,zz,.135)],GIR,T,n=6,L=L))
        # reticulated patches, each sat on the body's own radius at that point
        for py,pz,pr,pw in ((1.90,-.62,.47,.16),(2.00,-.12,.56,.19),(2.06,.34,.58,.19),
                            (1.80,.12,.55,.15),(2.16,.70,.52,.15)):
            o.append(patch('giraffe patch',side*pr,py,pz,pw,GIRSPOT,T,L=L,side=side))
        for py,pz,pr,pw in ((2.92,.98,.31,.12),(3.60,1.12,.275,.11),(4.26,1.22,.245,.10)):
            o.append(patch('giraffe patch',side*pr,py,pz,pw,GIRSPOT,T,L=L,side=side))
    o.append(limb('giraffe tail',[(0,1.92,-1.10,.05),(0,1.52,-1.24,.04),(0,1.22,-1.28,.034)],GIR,T,n=5,L=L))
    o.append(disc('giraffe tail tuft',(0,1.14,-1.29),.07,.07,GIRSPOT,T,n=5,L=L,axis=(0,1,.2),thick=.16))
    return o

ZSTRIPE=[ZEB,ZEBD,ZEB,ZEBD,ZEB,ZEBD,ZEB,ZEBD,ZEB,ZEBD,ZEB,ZEBD,ZEB]
def zebra(x,z,yaw=0.0,s=1.0):
    """Stripes are the body loft's own material strips, so the pattern wraps for free."""
    L=L_of(x,z,yaw,s);o=[]
    spine=[(-.84,.88,.10),(-.68,.94,.30),(-.55,.96,.36),(-.42,.97,.39),(-.28,.98,.41),(-.14,.99,.42),
           (0,1.00,.42),(.14,1.01,.41),(.28,1.02,.40),(.40,1.02,.38),(.52,1.03,.34),(.64,1.04,.29),
           (.74,1.05,.24),(.82,1.06,.16)]
    o.append(limb('zebra body',[(0,y,zz,r,r*1.06) for zz,y,r in spine],ZSTRIPE,T,n=9,L=L))
    neck=[(.76,1.08,.24),(.86,1.20,.22),(.96,1.32,.205),(1.05,1.44,.19),(1.12,1.55,.175),(1.16,1.62,.165)]
    o.append(limb('zebra neck',[(0,y,zz,r,r*1.1) for zz,y,r in neck],[ZEB,ZEBD,ZEB,ZEBD,ZEB],T,n=8,L=L))
    o.append(limb('zebra head',[(0,1.63,1.16,.165,.18),(0,1.62,1.36,.145,.155),(0,1.54,1.54,.115,.115),
        (0,1.47,1.64,.085,.08)],ZEB,T,n=8,L=L))
    o.append(limb('zebra muzzle',[(0,1.48,1.62,.10,.095),(0,1.45,1.70,.085,.08)],ZEBD,T,n=6,L=L))
    o.append(limb('zebra mane',[(0,1.24,.80,.04,.11),(0,1.36,.92,.04,.10),(0,1.50,1.05,.04,.09),
        (0,1.62,1.14,.04,.07)],ZEBD,T,n=5,L=L))
    for side in (-1,1):
        o.append(disc('zebra ear',(side*.12,1.70,1.18),.11,.055,ZEB,T,n=5,L=L,axis=(side*.7,.6,-.2),thick=.05))
        o.append(disc('zebra eye',(side*.14,1.63,1.30),.05,.05,DARK,T,n=5,L=L,axis=(side*.9,.1,.3),thick=.05))
        for zz in (.52,-.58):
            # a shoulder/haunch flare at the top, so the leg grows out of the body instead
            # of being a cylinder bolted under it
            o.append(limb('zebra leg',[(side*.32,1.00,zz,.17),(side*.33,.72,zz,.105),
                (side*.34,.40,zz,.075),(side*.34,.14,zz,.072)],ZEB,T,n=6,L=L))
            o.append(limb('zebra hoof',[(side*.34,.13,zz,.085),(side*.34,.02,zz,.092)],ZEBD,T,n=6,L=L))
    o.append(limb('zebra tail',[(0,1.02,-.84,.06),(0,.74,-.98,.042),(0,.54,-1.03,.032)],ZEB,T,n=5,L=L))
    o.append(limb('zebra tail tuft',[(0,.58,-1.02,.055),(0,.42,-1.06,.085),(0,.26,-1.08,.045)],ZEBD,T,n=6,L=L))
    return o

def lion(x,z,yaw=0.0,s=1.0):
    L=L_of(x,z,yaw,s);o=[]
    o.append(limb('lion body',[(0,.62,-.82,.09),(0,.70,-.62,.30,.32),(0,.74,-.26,.35,.37),
        (0,.76,.14,.35,.36),(0,.78,.48,.30,.32),(0,.80,.70,.20,.22)],LION,T,n=10,L=L))
    o.append(limb('lion neck',[(0,.80,.64,.22,.24),(0,.92,.90,.23,.24),(0,.98,1.16,.22,.21),
        (0,.94,1.34,.16,.15)],LION,T,n=8,L=L))
    # The mane is a tapering ruff that closes toward the face, not a lens on the neck: a flat
    # disc here rendered as a lifebuoy with the head inside it.
    o.append(limb('lion mane',[(0,.84,.58,.26,.28),(0,.90,.76,.40,.41),(0,.94,.96,.42,.42),
        (0,.96,1.14,.31,.31),(0,.96,1.24,.22,.22)],MANE,T,n=12,L=L))
    o.append(limb('lion muzzle',[(0,.92,1.28,.145,.13),(0,.88,1.42,.105,.09)],LIONPALE,T,n=6,L=L))
    o.append(disc('lion nose',(0,.90,1.45),.048,.036,DARK,T,n=5,L=L,axis=(0,.15,1),thick=.05))
    for side in (-1,1):
        o.append(disc('lion ear',(side*.15,1.13,1.12),.095,.085,LION,T,n=5,L=L,axis=(side*.6,.7,.1),thick=.05))
        o.append(disc('lion eye',(side*.12,1.01,1.28),.04,.04,DARK,T,n=5,L=L,axis=(side*.7,.1,.7),thick=.05))
        for zz in (.44,-.52):
            o.append(limb('lion leg',[(side*.32,.74,zz,.125),(side*.32,.42,zz,.10),
                (side*.32,.08,zz,.095),(side*.32,.03,zz,.115)],LION,T,n=6,L=L))
    o.append(limb('lion tail',[(0,.74,-.84,.05),(0,.58,-1.08,.042),(0,.44,-1.28,.036)],LION,T,n=5,L=L))
    o.append(disc('lion tail tuft',(0,.40,-1.32),.085,.085,MANE,T,n=6,L=L,axis=(0,.5,-.9),thick=.16))
    return o

def flamingo(x,z,yaw=0.0,s=1.0,tuck=False):
    L=L_of(x,z,yaw,s);o=[]
    o.append(limb('flamingo body',[(0,1.06,-.36,.05),(0,1.13,-.22,.17,.16),(0,1.16,0,.21,.19),
        (0,1.13,.20,.16,.15),(0,1.08,.33,.07,.065)],FLAM,T,n=8,L=L))
    for side in (-1,1):  # folded wing coverts, flush on the flank
        o.append(disc('flamingo wing',(side*.185,1.16,-.02),.135,.10,FLAMD,T,n=6,L=L,axis=(side,0,-.15),thick=.05))
    o.append(limb('flamingo neck',[(0,1.18,.24,.075),(0,1.44,.34,.065),(0,1.66,.32,.058),
        (0,1.78,.40,.052)],FLAM,T,n=6,L=L))
    o.append(limb('flamingo head',[(0,1.79,.42,.075),(0,1.78,.55,.062)],FLAM,T,n=6,L=L))
    o.append(limb('flamingo beak',[(0,1.77,.56,.048),(0,1.70,.70,.018)],DARK,T,n=5,L=L))
    o.append(limb('flamingo leg',[(-.07,1.02,-.02,.035),(-.07,.52,-.02,.029),(-.07,.03,-.02,.036)],FLAMD,T,n=5,L=L))
    if tuck:
        o.append(limb('flamingo leg',[(.07,1.00,-.04,.034),(.16,.86,.10,.028),(.06,.78,.22,.03)],FLAMD,T,n=5,L=L))
    else:
        o.append(limb('flamingo leg',[(.07,1.02,-.02,.035),(.07,.52,-.02,.029),(.07,.03,-.02,.036)],FLAMD,T,n=5,L=L))
    return o

# ================================================================ zoo grounds
def grounds():
    o=[box('park ground',0,.06,0,56,.12,62,GRASS,T,0)]
    # Visitor paths keep world.ts's footprints; kerbs give them an edge to read against.
    paths=[(0,0,5,57),(0,-25,47,4.5),(0,25,47,4.5),(-21,0,4.5,54),(21,0,4.5,54)]
    for i,(px,pz,pw,pd) in enumerate(paths):
        top=.14 if i==0 else .15
        o.append(box('visitor path',px,top+.005,pz,pw,.09,pd,PATH,T,0))
        if pw>pd:
            for s in (-1,1):o.append(box('path kerb',px,top+.015,pz+s*pd/2,pw,.11,.22,KERB,T,0))
        else:
            for s in (-1,1):o.append(box('path kerb',px+s*pw/2,top+.015,pz,.22,.11,pd,KERB,T,0))
    # Dry savanna and a dusty elephant yard. They sit at .155, above the lawn and under the
    # paths, so a habitat that reaches a path slips beneath it instead of fighting it.
    o.append(disc('savanna scrub',(13,.155,-2),10,8,SCRUB,T,n=14,axis=(0,1,0),thick=.05,smooth=False))
    o.append(disc('elephant yard',(-11,.155,-12),7,6,SCRUB,T,n=12,axis=(0,1,0),thick=.05,smooth=False))
    return o

def rails():
    """Perimeter and habitat rails: a stone kerb, timber posts and three horizontal rails."""
    o=[];runs=[(0,-30.5,56,.15),(0,30.5,56,.15),(-27.5,0,.15,61),(27.5,-18,.15,25),(27.5,18,.15,25)]
    for rx,rz,rw,rd in runs:
        along='x' if rw>rd else 'z'
        length=rw if along=='x' else rd
        o.append(box('rail kerb',rx,.11,rz,rw+.5 if along=='x' else .5,.22,.5 if along=='x' else rd+.5,STONE,T,0))
        for y,t in ((.55,.12),(1.12,.10),(1.60,.16)):
            o.append(box('rail',rx,y,rz,rw if along=='x' else t,t,t if along=='x' else rd,TIMBER,T,0))
        count=max(2,int(length/6)+1)
        for i in range(count):
            d=-length/2+length*i/(count-1)
            px,pz=(rx+d,rz) if along=='x' else (rx,rz+d)
            o.append(limb('rail post',[(px,1.78,pz,.10),(px,.90,pz,.115),(px,.06,pz,.13)],POSTW,T,n=6))
    return o

def gateway():
    """Twin leaf towers either side of the open eastern entrance, plus the sign lintel."""
    o=[]
    for z in (-8,8):
        o.append(box('gate plinth',27.5,.30,z,3.3,.60,3.3,STONE,T,.03))
        o.append(vloft('gate pylon',[(.55,rect(27.5,-z,3.15,3.15)),(3.4,rect(27.5,-z,3.0,3.0)),
            (6.3,rect(27.5,-z,2.8,2.8))],[GATE,GATE],T))
        o.append(box('gate capital',27.5,6.5,z,3.2,.42,3.2,GATE2,T,.04))
        o.append(box('gate collar',27.5,3.45,z,3.15,.24,3.15,GATE2,T,.03))
        for s in (-1,1):  # vertical grooves so the pylon is not a plain slab
            o.append(box('gate groove',27.5+s*1.5,3.4,z,.14,5.4,.5,GATE2,T,0))
            o.append(box('gate groove',27.5,3.4,z+s*1.5,.5,5.4,.14,GATE2,T,0))
        # A leaf tower, not a canopy: the blades climb to 10.3, above the sign lintel's cap,
        # so the crown reads against the sky from anywhere on the eastern approach.
        for i in range(9):
            a=2*math.pi*i/9;ux,uz=math.cos(a),math.sin(a)
            o.append(limb('gate leaf',[(27.5+ux*.30,6.80,z+uz*.30,.07,.10),
                (27.5+ux*.75,7.80,z+uz*.75,.07,.32),(27.5+ux*1.25,8.80,z+uz*1.25,.06,.38),
                (27.5+ux*1.62,9.70,z+uz*1.62,.05,.28),(27.5+ux*1.78,10.30,z+uz*1.78,.02,.06)],
                LEAF if i%2 else LEAF2,T,n=6))
        o.append(limb('gate bud',[(27.5,6.60,z,.30),(27.5,7.60,z,.34),(27.5,8.70,z,.22),
            (27.5,9.30,z,.06)],GATE2,T,n=8))
    # Lintel: front face stays at x = 29.00 so the game's canvas sign at 29.05 sits clear.
    o.append(box('gate lintel',27.5,7.40,0,3.0,2.20,15,GATE,T,.05))
    o.append(box('gate lintel cap',27.5,8.62,0,3.4,.30,15.5,GATE2,T,.04))
    o.append(box('gate lintel sill',27.5,6.22,0,3.3,.26,15.3,GATE2,T,.04))
    for y in (6.52,8.38):o.append(box('sign frame',28.99,y,0,.06,.14,14.4,GATE2,T,0))
    for z in (-7.15,7.15):o.append(box('sign frame',28.99,7.45,z,.06,2.0,.14,GATE2,T,0))
    for z in (-4.4,0,4.4):o.append(box('lintel bracket',27.5,5.95,z,3.2,.3,.8,GATE2,T,.03))
    return o

def habitat_signs():
    """Board, frame and posts behind each canvas sign the game keeps drawing."""
    o=[]
    for sx,sz,w in ((-15,-2,5.0),(13,-1,5.0),(-12,23,8.0)):
        o.append(box('habitat board',sx,2.40,sz-.08,w+.34,1.06,.12,SIGNBOARD,T,.02))
        o.append(box('habitat board cap',sx,2.99,sz-.08,w+.5,.14,.24,GATE2,T,.02))
        for s in (-1,1):
            px=sx+s*(w/2+.02)
            o.append(limb('habitat post',[(px,2.9,sz-.15,.09),(px,1.5,sz-.15,.10),(px,.05,sz-.15,.12)],POSTW,T,n=6))
    return o

def pond():
    """Flamingo pond: one lathed basin, a water surface, boulders and reed clumps."""
    o=[];cx,cz=-12,14
    # Cross-section from the outer kerb over the rim and down to the pond floor.
    prof=[(.02,1.00),(.22,1.00),(.30,1.01),(.30,.94),(.24,.92),(.06,.90),(.02,.60),(.02,.02)]
    o.append(vloft('pond basin',[(h,ellipse(cx,-cz,6.0*r,4.2*r,22)) for h,r in prof],[STONE]*(len(prof)-1),T))
    o.append(disc('pond water',(cx,.20,cz),6.0*.90,4.2*.90,WATER,T,n=22,axis=(0,1,0),thick=.04,smooth=False))
    for i,(bx,bz,br) in enumerate(((-16.6,11.6,.9),(-7.8,16.3,.75),(-13.2,17.9,.6),(-9.4,10.9,.7))):
        o.append(boulder('pond rock',bx,.1,bz,br,br*.8,br*.75,ROCK if i%2 else ROCK2,T,seed=i*1.7))
    for i,(rxx,rzz) in enumerate(((-17.4,15.6),(-15.0,18.2),(-6.6,13.2),(-8.2,17.6),(-16.8,10.8),(-10.4,18.4))):
        for j in range(5):
            a=j*1.9+i;px,pz=rxx+math.cos(a)*.34,rzz+math.sin(a)*.34
            o.append(limb('reed',[(px,.14,pz,.075),(px+math.cos(a)*.14,.55+j*.07,pz+math.sin(a)*.14,.045),
                (px+math.cos(a)*.26,.92+j*.09,pz+math.sin(a)*.26,.014)],REED,T,n=4))
    return o

def lion_habitat():
    """Rock outcrop and the flat basking ledge, on the footprints world.ts already draws."""
    o=[]
    o.append(boulder('lion rock',16,0,21,4.3,1.8,2.65,ROCK,T,seed=.6,n=10))
    o.append(boulder('lion rock shoulder',18.4,0,19.6,1.9,1.4,1.7,ROCK2,T,seed=2.4))
    o.append(boulder('lion rock shoulder',13.6,0,22.6,1.7,1.3,1.35,ROCK2,T,seed=4.1))
    # The ledge world.ts draws is a slab in mid air. Same footprint and top, but carried down
    # to the ground on a widening rock shelf so it is a terrace off the outcrop.
    o.append(vloft('basking ledge',[(0,rect(17.1,-19.2,3.0,3.8)),(.70,rect(15.8,-19.2,4.2,3.6)),
        (1.15,rect(14.2,-19.2,4.9,3.5)),(1.33,rect(14.0,-19.2,5.0,3.5))],[ROCK2,ROCK2,ROCK2],T))
    o.append(box('ledge lip',14,1.30,17.5,5.2,.16,.35,ROCK,T,.03))
    o.append(disc('lion dust',(11.5,.155,20),3.4,2.8,SCRUB,T,n=10,axis=(0,1,0),thick=.05,smooth=False))
    for i,(bx,bz,br) in enumerate(((9.4,17.2,.8),(10.2,23.4,.65))):
        o.append(boulder('habitat rock',bx,.1,bz,br,br*.85,br*.8,ROCK,T,seed=i*3.3))
    return o

def zoo():
    o=grounds()+rails()+gateway()+habitat_signs()+pond()+lion_habitat()
    o+=elephant(-12,-14,1.1,-.22)+elephant(-8,-9,.72,.9)
    o+=giraffe(11,-15,-.4)+giraffe(16,-10,.35)
    o+=zebra(9,3,.4)+zebra(15,6,-.55)+zebra(11,10,.1)
    o+=lion(12,20,.35)
    o+=flamingo(-15,13,.7)+flamingo(-11,15,-1.3,tuck=True)+flamingo(-8,12,2.4)
    return o

# ================================================================ street furniture
F='furniture'

def flag(x,z):
    """Pole, and the 14-stripe Jalan Merdeka flag as one rippling sheet.

    Every point of the sheet stays behind z (the game's canvas crescent sits at z+.04), so
    the ripple never fights the sign it has to live with.
    """
    o=[]
    o.append(limb('flagpole',[(x,.05,z,.13),(x,.3,z,.075),(x,4.0,z,.062),(x,7.9,z,.05)],POLE,F,n=8))
    o.append(disc('pole finial',(x,8.0,z),.085,.085,POLE,F,n=8,axis=(0,1,0),thick=.16))
    o.append(box('pole base',x,.09,z,.62,.18,.62,FSTONE,F,.03))
    o.append(box('pole cleat',x+.09,2.1,z,.16,.05,.05,POLE,F,0))
    W,H,TOP,SEG=2.4,1.4,7.75,6
    def surf(u,v,off=0.0):
        wave=-.18*u*u*(1-.55*math.cos(math.pi*3*u))
        return (x+.02+u*W,TOP-v*H-.06*u*u,z+wave+off)
    for i in range(14):
        v0,v1=i/14,(i+1)/14;m=FLAGW if i%2 else FLAGR
        verts=[];faces=[]
        for j in range(SEG+1):
            u=j/SEG
            verts.append(pt(*surf(u,v0)));verts.append(pt(*surf(u,v1)))
        for j in range(SEG):
            a=j*2;faces.append((a,a+2,a+3,a+1))
        o.append(shell('flag stripe',verts,faces,m,F,False,SEG,1,(False,False)))
    verts=[];faces=[]
    for j in range(4):
        u=j/3*(1.05/W)
        verts.append(pt(*surf(u,0,.022)));verts.append(pt(*surf(u,.75/H,.022)))
    for j in range(3):
        a=j*2;faces.append((a,a+2,a+3,a+1))
    o.append(shell('flag canton',verts,faces,FLAGB,F,False,3,1,(False,False)))
    return o

def street_sign(x,z,w,h):
    """Galvanised post with a base flange, and a backing board behind the canvas face."""
    o=[]
    o.append(limb('sign post',[(x,3.75,z-.13,.06),(x,2.0,z-.13,.075),(x,.16,z-.13,.095),(x,.03,z-.13,.16)],STREET,F,n=8))
    o.append(box('sign post base',x,.06,z-.13,.5,.12,.5,FSTONE,F,.02))
    o.append(box('sign backing',x,3.7 if h<.85 else 3.6,z-.06,w+.24,h+.22,.11,BOARD,F,.02))
    for s in (-1,1):o.append(box('sign edge',x+s*(w/2+.12),3.7 if h<.85 else 3.6,z-.06,.06,h+.22,.14,STREET,F,0))
    o.append(disc('post cap',(x,3.94 if h<.85 else 3.86,z-.13),.075,.075,STREET,F,n=8,axis=(0,1,0),thick=.05))
    return o

def bunting():
    """Cord on two slim poles, with the game's 18 pennants hanging from its sag."""
    o=[];z=49
    nodes=[(-46+i*1.9,6.63-math.sin(i/17*math.pi)*1.1) for i in range(18)]
    for px in (-47.9,-12.1):
        o.append(limb('bunting pole',[(px,7.2,z,.05),(px,3.6,z,.07),(px,.1,z,.09)],STREET,F,n=6))
        o.append(box('bunting pole base',px,.07,z,.42,.14,.42,FSTONE,F,.02))
    cord=[(-47.9,6.72,z,.035)]+[(nx,ny+.09,z,.03) for nx,ny in nodes]+[(-12.1,6.72,z,.035)]
    o.append(limb('bunting cord',cord,CORD,F,n=4))
    for i,(nx,ny) in enumerate(nodes):
        m=(BUNT1,BUNT2,BUNT3)[i%3];lean=.12*math.cos(i*1.3)
        verts=[pt(nx-.35,ny,z),pt(nx+.35,ny,z),pt(nx+.12,ny-.32,z+lean),pt(nx-.12,ny-.32,z+lean),
               pt(nx,ny-.62,z+lean*1.6)]
        faces=[(0,1,2,3),(3,2,4)]
        o.append(shell('pennant',verts,faces,m,F,False,0,1,(False,False)))
    return o

HEDGE_PROFILE=[(-1.38,0),(1.38,0),(1.5,1.3),(1.34,1.95),(.75,2.2),(-.75,2.2),(-1.34,1.95),(-1.5,1.3)]
def hedge_vary(station,profile):
    """Uneven clipping: the crown dips and bulges along the run instead of a regular scallop."""
    k=.92+.06*noise.noise(Vector((station*.21,.5,1.7)))+.03*noise.noise(Vector((station*.7,2.5,.3)))
    wide=.95+.05*noise.noise(Vector((station*.33,4.1,2.2)))
    return [(a*wide,y*k) for a,y in profile]

def leafy(ob):
    """Clumps of lighter and darker growth, and the shaded, sparser foot of the hedge."""
    me=ob.data;attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT')
    for v in me.vertices:
        c=.9*(.84+.16*noise.noise(Vector((v.co.x*.35,v.co.y*.35,v.co.z*.6))))*(.62+.38*min(v.co.z/1.2,1))
        attr.data[v.index].color=(c,c,c,1)
    me.color_attributes.active_color=attr
    return ob

# Where the city meets the sea the hedge gives way to a Malaysian coastal bund: a battered
# concrete seawall with a coping, cast in 6 m panels, its sea face armoured with granite rock.
# The south edge runs the whole way (the sea is behind it from x -157.5 to the beach); on the
# east edge the wall takes over beside Pantai Senja and ends in a rock head at the waterline,
# where the beach's own boulders already sit. Across is measured inward (toward the city).
SEAWALL_FIXED=156;SEAWALL_EAST_FROM=125.5;SEAWALL_EAST_TO=150.0
WALL_PROFILE=[(-.30,-.55),(.85,-.55),(.85,.98),(.92,.98),(.92,1.08),(.86,1.14),(.26,1.14),(.20,1.08),(.20,.98),(.27,.98)]

def hedges():
    """Boundary hedges with a scalloped top; the two greens alternate so it reads clumpy. They
    stop at the seawall's city face on the south edge and where the beach wall begins."""
    o=[];inner=SEAWALL_FIXED-.8
    o.append(leafy(run('boundary hedge','z',-156,-157.5,inner,HEDGE_PROFILE,HEDGE,F,vary=hedge_vary,step=2.25,smooth=True)))
    o.append(box('hedge base',-156,.10,(inner-157.5)/2,3.1,.2,inner+157.5,HEDGEB,F,0))
    o.append(leafy(run('boundary hedge','z',156,-157.5,SEAWALL_EAST_FROM+.4,HEDGE_PROFILE,HEDGE,F,vary=hedge_vary,step=2.25,smooth=True)))
    o.append(box('hedge base',156,.10,(SEAWALL_EAST_FROM+.4-157.5)/2,3.1,.2,SEAWALL_EAST_FROM+.4+157.5,HEDGEB,F,0))
    o.append(leafy(run('boundary hedge','x',-156,-157.5,157.5,HEDGE_PROFILE,HEDGE,F,vary=hedge_vary,step=2.25,smooth=True)))
    o.append(box('hedge base',0,.10,-156,315,.2,3.1,HEDGEB,F,0))
    return o

def armour(rocks,x,y,z,r,R):
    """One angular granite armour stone: a tumbled, noise-pushed icosahedron, flat shaded like
    quarried rock and vertex-tinted wet and weedy below the tide mark. Faces wholly under the
    city ground are dropped: they could never be seen."""
    o=kit.rock('armour stone',x,y,z,r,ARMOUR,squash=R.uniform(.7,.95),sub=1,rough=.3,seed=R.randint(0,999))
    o.scale=(R.uniform(.9,1.35),R.uniform(.8,1.15),R.uniform(.85,1.0))
    o.rotation_euler=(R.uniform(-.6,.6),R.uniform(-.6,.6),R.uniform(0,6.28))
    mw=o.matrix_basis.copy();me=o.data;bm=bmesh.new();bm.from_mesh(me)
    floor=-.06 if z<159 else -.14
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if all((mw@v.co).z<floor for v in f.verts)],context='FACES')
    bm.to_mesh(me);bm.free();me.update()
    attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT');tone=R.uniform(.72,1.0)
    for v in me.vertices:
        wet=1-min(max(((mw@v.co).z-.02)/.32,0),1)
        c=.9*tone*(1-.55*wet)
        attr.data[v.index].color=(c*(1-.18*wet),c*(1-.04*wet),c*(1-.3*wet),1)
    me.color_attributes.active_color=attr
    for f in me.polygons:f.use_smooth=False
    rocks.append(o)

def weather(ob,paint=1.0):
    """Splash and grime darken a wall toward its foot (linear vertex colour, .9 headroom).
    `paint` scales it, so joint sealant can ride on the wall's own material."""
    me=ob.data;attr=me.color_attributes.new('Color','FLOAT_COLOR','POINT');mw=ob.matrix_basis
    for v in me.vertices:
        t=min(max(((mw@v.co).z+.1)/1.1,0),1);c=.9*(.7+.3*t*t)*paint
        attr.data[v.index].color=(c,c,c*.98,1)
    me.color_attributes.active_color=attr
    return ob

def seawall():
    o=[];R=random.Random(20260914)
    o.append(weather(run('seawall','x',SEAWALL_FIXED,-157.5,97.0,WALL_PROFILE,SEAWALL,F,step=6.0)))
    # east: across runs +x (outward) on a z run, so mirror the profile and keep its winding
    east=[(-a,y) for a,y in WALL_PROFILE][::-1]
    o.append(weather(run('seawall','z',SEAWALL_FIXED,SEAWALL_EAST_FROM,SEAWALL_EAST_TO,east,SEAWALL,F,step=6.0)))
    # expansion joints every 6 m on the city face: the wall's own material, vertex-painted black,
    # so the joints, the wall and the end pier share one draw
    for x in [x0*6.0-157.5 for x0 in range(1,43)]:
        o.append(weather(box('seawall joint',x,.5,SEAWALL_FIXED-.86,.035,1.0,.03,SEAWALL,F,0),.12))
    for z in [SEAWALL_EAST_FROM+6*k for k in range(1,5)]:
        o.append(weather(box('seawall joint',SEAWALL_FIXED-.86,.5,z,.03,1.0,.035,SEAWALL,F,0),.12))
    o.append(weather(box('seawall pier',SEAWALL_FIXED-.35,.7,SEAWALL_EAST_FROM,1.5,1.4,.9,SEAWALL,F,.03)))
    # rock armour along the whole south face: two packed rows and a looser toe
    rocks=[]
    for row,(z0,y0,r0,r1,step,keep) in enumerate([(156.95,.3,.6,.9,1.1,1),(158.1,.0,.65,1.0,1.25,1),(159.25,-.22,.5,.8,1.5,.7)]):
        x=-157.2+R.uniform(0,step)
        while x<97.5-row*.8:
            if R.random()<keep:armour(rocks,x,y0+R.uniform(-.08,.1),z0+R.uniform(-.3,.3),R.uniform(r0,r1),R)
            x+=step*R.uniform(.8,1.15)
    # the rock head that closes the east wall at the waterline
    for i in range(34):
        z=R.uniform(SEAWALL_EAST_TO-4,160.5);x=SEAWALL_FIXED+R.uniform(.1,2.8)+max(0,z-156)*.25
        armour(rocks,x,.35-max(0,z-SEAWALL_EAST_TO)*.06+R.uniform(-.1,.1),z,R.uniform(.55,.95),R)
    return o+rocks

# One cross-section, walked from the outer footing up over the rim, down the inside, across
# the floor and back up the pedestal to the finial: a single watertight solid whose faces all
# end up pointing out of it. Basin radius 4 and centre height 1.65 match the tubes in world.ts.
FOUNTAIN=[(.00,4.18),(.10,4.18),(.58,4.02),(.70,4.16),(.78,4.10),(.78,3.80),(.70,3.74),(.34,3.70),
          (.28,3.44),(.28,1.10),(.66,1.04),(.80,.70),(1.02,.56),(1.22,.52),(1.34,.74),(1.48,1.06),
          (1.58,1.22),(1.62,1.14),(1.52,.72),(1.44,.34),(1.48,.20),(1.68,.14),(1.74,.02)]
def fountain():
    """Low fountain on the KLCC delivery plaza: basin, rim, dished bowl and water arcs."""
    o=[];x,z=19,-87
    o.append(lathe('fountain',x,z,FOUNTAIN,FSTONE,F,n=24))
    o.append(disc('fountain water',(x,.70,z),3.68,3.68,FWATER,F,n=24,axis=(0,1,0),thick=.04,smooth=False))
    o.append(disc('fountain bowl water',(x,1.54,z),1.08,1.08,FWATER,F,n=16,axis=(0,1,0),thick=.03,smooth=False))
    # Just a modest plume. Arcing jets rendered as spider legs whatever the taper, and a
    # spill veil off the bowl rim looked fine from above but became a milky tent at the eye
    # height a player actually walks past it at.
    o.append(limb('fountain plume',[(x,1.62,z,.115),(x,1.88,z,.06),(x,2.06,z,.02)],JET,F,n=8))
    return o

def furniture():
    return flag(-13,54)+flag(13,-77)+street_sign(-11,14,5,.8)+street_sign(11.5,-48,3.8,.9)+bunting()+hedges()+seawall()+fountain()

# ================================================================ build / export
SETS={'Zoo':('zoo',zoo),'Furniture':('furniture',furniture)}

def build():
    s=bpy.context.scene;s.unit_settings.system='METRIC'
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    roots={}
    for name,(node,fn) in SETS.items():
        if ONLY and name not in ONLY:continue
        e=bpy.data.objects.new(node,None);s.collection.objects.link(e)
        for ob in fn():
            ob.parent=e;kit.uv_metres(ob)   # only the seawall's PBR materials carry a tile size
        roots[name]=e
    return roots

def export(roots):
    report={}
    for name,e in roots.items():
        batches={}
        for ob in [c for c in e.children if c.type=='MESH']:
            batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
        for key,objs in batches.items():
            j=join(objs,f'{name} | {" + ".join(key)}')
            if not any('tile' in m for m in j.data.materials if m):
                for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
        bpy.ops.object.select_all(action='DESELECT');e.select_set(True)
        for c in e.children:c.select_set(True)
        path=PUBLIC/f'LM_ENV_{name}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,
            export_yup=True,export_cameras=False,export_lights=False,export_extras=False,
            export_image_format='WEBP',export_image_quality=82,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
        tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in e.children if c.type=='MESH')
        report[name]={'asset':f'LM_ENV_{name}','node':e.name,'triangles':tris,'bytes':path.stat().st_size,
                      'draws':len([c for c in e.children if c.type=='MESH'])}
    if 'Zoo' in report:report['Zoo']['origin']=[-123,0,-112]
    if 'Furniture' in report:report['Furniture']['origin']=[0,0,0]
    manifest=OUT/'manifest.json';report={**(json.loads(manifest.read_text()) if manifest.exists() else {}),**report}
    manifest.write_text(json.dumps(report,indent=2)+'\n')
    print('ZOO WEB EXPORT',json.dumps(report),flush=True)

def render(roots):
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1500;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun)
    sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=500,location=(0,0,-.02));bpy.context.object.data.materials.append(mat('Preview ground',(.35,.4,.3),.9))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=42
    views={
      'gateway':('Zoo',(58,13,24),(27.5,6,0)),
      'gateway-inside':('Zoo',(16,7,-1),(27.5,7,4)),
      'elephants':('Zoo',(-5,3.2,-6),(-11.5,1.8,-13)),
      'giraffes':('Zoo',(22,5.5,-2),(13,3.2,-13)),
      'zebras':('Zoo',(3,3.0,12),(12,1.2,6)),
      'pond':('Zoo',(-3,4.5,26),(-13,1.0,14)),
      'lion':('Zoo',(9,2.4,29),(13,1.0,20)),
      'park':('Zoo',(-48,34,58),(0,2,0)),
      'flag':('Furniture',(-19,6.0,63),(-12.6,6.6,54)),
      'bunting':('Furniture',(-30,7.0,60),(-29,6.2,49)),
      'fountain':('Furniture',(11,3.4,-79),(19,.9,-87)),
      'signpost':('Furniture',(-7,3.4,22),(-11,3.3,14)),
      'hedge':('Furniture',(-148,6,22),(-156,1.4,-8)),
    }
    for label,(which,eye,at) in views.items():
        for nm,e in roots.items():
            for c in e.children:c.hide_render=nm!=which
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{label}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    roots=build();export(roots)
    if '--no-render' not in ARGS:render(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'zoo.blend'))
