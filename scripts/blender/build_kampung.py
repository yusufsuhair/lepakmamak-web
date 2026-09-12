"""Kampung Durian Runtuh: the Upin & Ipin village at world (122,-132), authored in
village-local coordinates so the GLB drops straight onto the durian-village.ts group.

The win here is the rumah kampung itself - five stilt houses with timber tiang on
concrete footings, a raised deck and papan pemeleh skirt, board-and-batten walls,
outward-swinging louvred tingkap, a serambi with balusters, a tangga down to the
ground, a steep bumbung panjang gable roof and a tebar layar vent at the gable.
Around them: the timber pintu gerbang, the swing frame, the raised vegetable beds,
the badminton court and net, trestle tables, benches, the washing line, the laundry
basket, the bike track and four durian trees.

Footprints, collision boxes and coordinates match the procedural fallback exactly;
the game keeps drawing its own canvas name signs (village name, house labels,
badminton sign) on top, so only the skin changes.

/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_kampung.py -- --no-render

Output: public/assets/models/environment/LM_ENV_Kampung.glb, node 'kampung' at the
village origin (villageOrigin in src/durian-village.ts).
"""
import bpy, math, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_lrt import pt,mat,box,cyl,loft,join,finish
from build_klcc import vloft,sphere

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/kampung'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/assets/models/environment'; PUBLIC.mkdir(parents=True,exist_ok=True)
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
T='kampung'

def srgb(h):
    """Hex the game already uses -> Blender linear base colour, so the swap keeps the palette."""
    c=[int(h.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)

GRASS =mat('Kampung grass',   srgb('#93ad76'),.95)
DIRT  =mat('Kampung dirt',    srgb('#ddc69e'),.95)
TRACK =mat('Bike track dirt', srgb('#d4bf90'),.95,two_sided=True)
RUT   =mat('Bike track rut',  srgb('#c0a677'),.95,two_sided=True)
STONE =mat('Footing concrete',srgb('#b5aea0'),.90)
TIMBER=mat('Structural timber',srgb('#8a6a46'),.75)
DECK  =mat('Planed timber',   srgb('#c2a06c'),.65)
ROOF  =mat('Roof sheet',      srgb('#784e3a'),.60)
RIDGE =mat('Ridge cap',       srgb('#5d3a2a'),.55)
GABLE =mat('Tebar layar board',srgb('#e8dcbc'),.70)
DOOR  =mat('Door timber',     srgb('#745136'),.55)
DARK  =mat('Opening shadow',  srgb('#211a15'),.85)
SHUT  =mat('Shutter teal',    srgb('#3c655f'),.60)
PANE  =mat('Window pane',     srgb('#ede1b8'),.35)
ARCHG =mat('Gerbang green',   srgb('#366348'),.60)
COURT =mat('Court surface',   srgb('#527f71'),.80)
LINE  =mat('Court line',      srgb('#f6ebc8'),.70)
NET   =mat('Net cord',        srgb('#e8e2cf'),.65)
WHITEP=mat('Net post white',  srgb('#eee0b9'),.50)
SOIL  =mat('Garden soil',     srgb('#7c6246'),.95)
LEAF  =mat('Vegetable leaf',  srgb('#527942'),.70)
TRUNK =mat('Durian trunk',    srgb('#846340'),.85)
CROWN =mat('Durian canopy',   srgb('#5c853e'),.75)
FRUIT =mat('Durian fruit',    srgb('#8b9445'),.70)
SWING =mat('Swing frame',     srgb('#b87043'),.70)
BASKET=mat('Laundry basket',  srgb('#b88960'),.80)

# Wall colours are the same hexes durian-village.ts hands the minimap.
WALLS={h:mat(f'Wall {h}',srgb(h),.80) for h in ('#bc9157','#8aab80','#edc766','#e5a681','#b3c092')}

def rect(cx,cz,w,d):return [(cx-w/2,cz-d/2),(cx+w/2,cz-d/2),(cx+w/2,cz+d/2),(cx-w/2,cz+d/2)]
def circle(cx,cz,r,n=12):return [(cx+r*math.cos(2*math.pi*i/n),cz+r*math.sin(2*math.pi*i/n)) for i in range(n)]
def ellipse(cx,cz,rx,rz,n):return [(cx+rx*math.cos(2*math.pi*i/n),-(cz+rz*math.sin(2*math.pi*i/n))) for i in range(n)]

def slant(name,x0,y0,z0,x1,y1,z1,w,d,m):
    """Leaning prism between two points: legs, braces, stringers and handrails."""
    return vloft(name,[(y0,rect(x0,-z0,w,d)),(y1,rect(x1,-z1,w,d))],[m],T)

def cone(name,x,y,z,r,h,m,verts=6):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=0,depth=h,location=pt(x,y+h/2,z))
    return finish(bpy.context.object,name,m,T)

def blob(name,x,y,z,r,m,n=8):
    """Cheap fruit-sized ellipsoid: three rings, no bevel, no UV sphere cost."""
    return vloft(name,[(y-r,circle(x,-z,r*.45,n)),(y-r*.35,circle(x,-z,r*.98,n)),
                       (y+r*.45,circle(x,-z,r*.80,n)),(y+r,circle(x,-z,r*.2,n))],[m]*3,T)

# ---------------------------------------------------------------- rumah kampung
FLOOR=1.50    # raised deck top; the old procedural body started at y=.1
WALLTOP=4.30  # eave line, unchanged, so the game's label sign at y=4.05 still sits under the gable

def house(o,x,z,w,d,wall,nx=3,nz=3):
    hw,hd=w/2,d/2;fz=z+hd;m=WALLS[wall]
    # tiang on concrete footings under the floor, the whole point of a stilt house
    xs=[x-hw+.9+i*(w-1.8)/(nx-1) for i in range(nx)]
    zs=[z-hd+.9+i*(d-1.8)/(nz-1) for i in range(nz)]
    for px in xs:
        for pz in zs:
            o.append(box('footing',px,.15,pz,.60,.30,.60,STONE,T,0))
            o.append(box('tiang',px,.81,pz,.26,1.02,.26,TIMBER,T,0))
    # floor deck, oversized so its edge and skirt read as a raised platform
    o.append(box('floor deck',x,FLOOR-.08,z,w+.40,.16,d+.40,DECK,T,0))
    for s in (-1,1):
        o.append(box('papan pemeleh',x+s*(hw+.20),FLOOR-.26,z,.10,.20,d+.40,DECK,T,0))
        o.append(box('papan pemeleh',x,FLOOR-.26,z+s*(hd+.20),w+.40,.20,.10,DECK,T,0))
    # walls
    o.append(box('wall',x,(FLOOR+WALLTOP)/2,z,w,WALLTOP-FLOOR,d,m,T,.03))
    o.append(box('sill plate',x,FLOOR+.10,z,w+.10,.16,d+.10,TIMBER,T,0))
    o.append(box('top plate',x,WALLTOP-.13,z,w+.10,.22,d+.10,TIMBER,T,0))
    # board-and-batten: the only cue that an untextured wall is sawn timber
    door=1.05;wins=[x-w*.3,x+w*.3]
    for i in range(int(w/1.15)):
        px=x-hw+.55+i*(w-1.1)/max(1,int(w/1.15)-1)
        o.append(box('batten',px,(FLOOR+WALLTOP)/2,z-hd-.03,.08,WALLTOP-FLOOR-.20,.06,TIMBER,T,0))
        if abs(px-x)<door or any(abs(px-wx)<.85 for wx in wins):continue
        o.append(box('batten',px,(FLOOR+WALLTOP)/2,fz+.03,.08,WALLTOP-FLOOR-.20,.06,TIMBER,T,0))
    for i in range(int(d/1.15)):
        pz=z-hd+.55+i*(d-1.1)/max(1,int(d/1.15)-1)
        for s in (-1,1):o.append(box('batten',x+s*(hw+.03),(FLOOR+WALLTOP)/2,pz,.06,WALLTOP-FLOOR-.20,.08,TIMBER,T,0))
    # bumbung panjang: one loft along the ridge, which runs front-to-back like the boxes it replaces
    ov=.95;half=hw+ov;ey=WALLTOP-.05;rise=max(w*.36,3.8);ry=WALLTOP+rise;t=.20
    prof=[(x-half,ey),(x,ry),(x+half,ey),(x+half,ey-t),(x,ry-t),(x-half,ey-t)]
    o.append(loft('roof',[(z-hd-.95,prof),(fz+1.60,prof)],ROOF,T))
    cw=.78;sy=ey+(ry-ey)*(1-cw/half)
    cap=[(x-cw,sy+.03),(x,ry+.17),(x+cw,sy+.03),(x+cw,sy-.15),(x,ry-.01),(x-cw,sy-.15)]
    o.append(loft('ridge cap',[(z-hd-1.05,cap),(fz+1.70,cap)],RIDGE,T))
    for s in (-1,1):o.append(box('eave fascia',x+s*half,ey-.17,z+.32,.08,.28,d+2.55,RIDGE,T,0))
    # tebar layar at both gable ends, with a fretwork vent under the apex
    for gz,face in ((fz,.06),(z-hd,-.06)):
        tri=[(x-hw+.06,WALLTOP-.16),(x,ry-t-.10),(x+hw-.06,WALLTOP-.16)]
        o.append(loft('tebar layar',[(gz,tri),(gz+face,tri)],GABLE,T))
        o.append(box('gable vent',x,WALLTOP+rise*.44,gz+face*1.4,w*.34,.34,.05,DARK,T,0))
        for i in range(5):
            o.append(box('vent slat',x-w*.13+i*w*.065,WALLTOP+rise*.44,gz+face*2.6,.06,.34,.05,GABLE,T,0))
    # front door: dark opening, two leaves, jambs and a head - no rail across the threshold
    dw,dh=1.60,1.95
    o.append(box('doorway',x,FLOOR+dh/2,fz+.01,dw,dh,.03,DARK,T,0))
    for s in (-1,1):o.append(box('door leaf',x+s*dw/4,FLOOR+dh/2,fz+.05,dw/2-.05,dh-.08,.05,DOOR,T,0))
    for s in (-1,1):o.append(box('door jamb',x+s*(dw/2+.08),FLOOR+dh/2+.07,fz+.07,.15,dh+.20,.10,DECK,T,0))
    o.append(box('door head',x,FLOOR+dh+.12,fz+.07,dw+.46,.14,.10,DECK,T,0))
    # tingkap: pane and frame proud of the wall, shutters swung right out in front of it
    ww,wh,wy=1.25,1.45,FLOOR+1.22
    for px in wins:
        o.append(box('window opening',px,wy,fz+.01,ww,wh,.03,DARK,T,0))
        for i in range(6):o.append(box('window louvre',px,wy-wh/2+.14+i*(wh-.28)/5,fz+.05,ww-.10,.11,.05,PANE,T,0))
        o.append(box('window sill',px,wy-wh/2-.09,fz+.12,ww+.48,.11,.34,DECK,T,0))
        for s in (-1,1):o.append(box('window jamb',px+s*(ww/2+.07),wy,fz+.08,.13,wh+.22,.11,DECK,T,0))
        o.append(box('window head',px,wy+wh/2+.11,fz+.08,ww+.40,.13,.15,DECK,T,0))
        o.append(box('window mullion',px,wy,fz+.07,.07,wh,.07,DECK,T,0))
        for s in (-1,1):
            sx=px+s*(ww/2+.32)
            o.append(box('shutter',sx,wy,fz+.24,.48,wh,.06,SHUT,T,0))
            for i in range(4):o.append(box('shutter louvre',sx,wy-wh/2+.22+i*(wh-.44)/3,fz+.28,.42,.07,.05,PANE,T,0))
    for s in (-1,1):
        o.append(box('side opening',x+s*(hw+.01),wy,z-hd*.35,.03,wh,ww,DARK,T,0))
        for i in range(4):o.append(box('side louvre',x+s*(hw+.05),wy-wh/2+.20+i*(wh-.40)/3,z-hd*.35,.05,.11,ww-.10,PANE,T,0))
        o.append(box('side sill',x+s*(hw+.12),wy-wh/2-.09,z-hd*.35,.34,.11,ww+.48,DECK,T,0))
    # serambi: deck, posts to the ground, balusters either side of the stair opening
    vd=2.10;vz=fz+vd/2
    for px in (x-hw+.5,x,x+hw-.5):
        o.append(box('serambi footing',px,.15,fz+vd-.35,.50,.30,.50,STONE,T,0))
        o.append(box('serambi post',px,.685,fz+vd-.35,.22,.77,.22,TIMBER,T,0))
    o.append(box('serambi deck',x,FLOOR-.08,vz,w+.40,.16,vd,DECK,T,0))
    o.append(box('serambi skirt',x,FLOOR-.33,fz+vd,w+.40,.34,.10,DECK,T,0))
    rw=w/2-1.3
    for s in (-1,1):
        cx=x+s*(w/4+.45)
        o.append(box('rail top',cx,FLOOR+.94,fz+vd-.10,rw,.11,.13,DECK,T,0))
        o.append(box('rail bottom',cx,FLOOR+.22,fz+vd-.10,rw,.09,.11,DECK,T,0))
        for i in range(6):o.append(box('baluster',cx-rw/2+.14+i*(rw-.28)/5,FLOOR+.58,fz+vd-.10,.07,.72,.07,DECK,T,0))
        o.append(box('rail newel',cx+s*rw/2,FLOOR+.56,fz+vd-.10,.15,1.14,.15,TIMBER,T,0))
    # tangga down to the yard
    sw=2.30;run=.34
    for i in range(5):
        o.append(box('tread',x,FLOOR-(i+1)*FLOOR/5-.05,fz+vd+.06+i*run,sw,.12,run,DECK,T,0))
    for s in (-1,1):
        o.append(slant('stringer',x+s*(sw/2+.10),.02,fz+vd+1.72,x+s*(sw/2+.10),FLOOR-.14,fz+vd+.02,.12,.12,TIMBER))
        o.append(slant('stair rail',x+s*(sw/2+.12),.95,fz+vd+1.76,x+s*(sw/2+.12),FLOOR+.95,fz+vd-.04,.09,.09,DECK))
    return o

# ---------------------------------------------------------------- the rest of the yard
def village():
    o=[box('grass pad',0,.05,0,56,.1,40,GRASS,T,0)]
    o.append(box('path east-west',0,.13,8,51,.08,5,DIRT,T,0))
    o.append(box('path north-south',0,.13,0,5,.08,37,DIRT,T,0))
    # loose kerb stones give the beaten-earth paths an edge instead of a printed rectangle
    for i in range(11):
        px=-24+i*4.8
        for s in (-1,1):o.append(box('path stone',px,.15,8+s*2.62,.9,.10,.34,STONE,T,0))
    for i in range(8):
        pz=-16+i*4.6
        for s in (-1,1):o.append(box('path stone',s*2.62,.15,pz,.34,.10,.9,STONE,T,0))

    house(o,-16,-11,12,9,'#bc9157');house(o,16,-11,12,9,'#8aab80')
    house(o,0,-12,12,10,'#edc766')
    house(o,-19,1,10,6,'#e5a681',3,2);house(o,20,1,10,6,'#b3c092',3,2)

    # pintu gerbang: posts stay on their colliders at x=+-5, z=18, and everything above the
    # crossbeam clears the canvas KAMPUNG DURIAN RUNTUH sign that hangs at z=18.22, y=4.45-5.55
    for s in (-1,1):
        px=s*5
        o.append(box('gerbang footing',px,.20,18,.92,.40,.92,STONE,T,0))
        o.append(box('gerbang post',px,2.75,18,.40,4.70,.40,TIMBER,T,.03))
        o.append(box('gerbang cap',px,5.22,18,.62,.24,.40,DECK,T,.02))
        o.append(box('gerbang bracket',s*4.35,4.02,18,1.10,.14,.16,DECK,T,0))
        o.append(slant('gerbang brace',s*4.78,3.30,18,s*4.05,4.00,18,.13,.15,DECK))
    o.append(box('gerbang beam',0,5.00,18,11,1.50,.35,ARCHG,T,.03))
    o.append(box('gerbang beam cap',0,5.86,18,11.4,.22,.52,DECK,T,.02))
    gp=[(-6.2,6.08),(0,7.06),(6.2,6.08),(6.2,5.92),(0,6.90),(-6.2,5.92)]
    o.append(loft('gerbang roof',[(17.10,gp),(18.90,gp)],ROOF,T))
    o.append(box('gerbang ridge',0,7.12,18,.56,.16,1.94,RIDGE,T,0))

    # swing frame; posts and their colliders stay at x=-22 and -17, z=15
    for px in (-22,-17):
        o.append(box('swing footing',px,.14,15,.48,.28,.48,STONE,T,0))
        o.append(box('swing post',px,1.10,15,.20,1.92,.20,SWING,T,.02))
        for s in (-1,1):o.append(slant('swing brace',px,.16,15+s*.85,px,1.84,15,.11,.11,SWING))
    o.append(box('swing beam',-19.5,2,15,5.2,.2,.2,SWING,T,.02))
    for px in (-20.5,-18.5):
        for s in (-1,1):
            for i in range(7):o.append(box('chain link',px+s*.30,.78+i*.20,15,.05,.15,.05,WHITEP,T,0))
        o.append(box('swing seat',px,.65,15,.92,.09,.46,DECK,T,0))
        for s in (-1,1):o.append(box('seat cleat',px,.72,15+s*.20,.92,.07,.07,TIMBER,T,0))

    # raised vegetable beds on the same six spots the boxes used
    for bx in (13,16,19):
        for bz in (-18,-16):
            for s in (-1,1):
                o.append(box('bed board',bx+s*1.0,.22,bz,.08,.36,1.40,TIMBER,T,0))
                o.append(box('bed board',bx,.22,bz+s*.70,2.00,.36,.08,TIMBER,T,0))
            o.append(box('soil',bx,.31,bz,1.86,.20,1.26,SOIL,T,0))
            for dx,dz in ((-.58,-.26),(0,.22),(.58,-.20)):
                o.append(cone('sayur',bx+dx,.40,bz+dz,.34,.42,LEAF,7))

    # trestle tables, inside the 2.2 x 1.4 collider they already had
    for tx in (14,21):
        for i in range(4):o.append(box('table plank',tx,.90,12-.53+i*.35,2.20,.12,.31,DECK,T,0))
        o.append(box('table rail',tx,.77,12,2.00,.10,.14,TIMBER,T,0))
        for s in (-1,1):
            o.append(slant('table leg',tx+s*.85,.02,11.45,tx+s*.85,.84,12.10,.12,.12,TIMBER))
            o.append(slant('table leg',tx+s*.85,.02,12.55,tx+s*.85,.84,11.90,.12,.12,TIMBER))

    # slatted benches, inside the 3 x .7 collider
    for bx in (-6,6):
        for i in range(3):o.append(box('bench slat',bx,.55,17-.24+i*.24,3.00,.09,.20,DECK,T,0))
        for s in (-1,1):
            o.append(box('bench apron',bx,.44,17+s*.29,3.00,.10,.08,TIMBER,T,0))
            for dz in (-.22,.22):o.append(box('bench leg',bx+s*1.2,.27,17+dz,.13,.54,.15,TIMBER,T,0))
            o.append(box('bench stretcher',bx+s*1.2,.20,17,.11,.11,.58,TIMBER,T,0))

    # four durian trees on the corner colliders the village already owns
    for tx in (-25,25):
        for tz in (-17,16):
            o.append(vloft('tree apron',[(.02,circle(tx,-tz,1.05,8)),(.22,circle(tx,-tz,.70,8))],[SOIL],T))
            o.append(vloft('trunk',[(.16,circle(tx,-tz,.36,8)),(2.2,circle(tx,-tz,.27,8)),
                                    (4.4,circle(tx,-tz,.21,8)),(6.2,circle(tx,-tz,.15,8))],[TRUNK]*3,T))
            for a in range(4):
                ang=a*math.pi/2+.5
                o.append(slant('branch',tx,4.30,tz,tx+math.cos(ang)*1.6,5.40,tz+math.sin(ang)*1.6,.14,.14,TRUNK))
            for cx,cy,cz,r in ((0,5.95,0,2.30),(-1.55,5.35,.55,1.55),(1.45,5.55,-.70,1.65),
                               (.55,7.10,.50,1.50),(-.70,7.30,-.55,1.30),(0,8.30,0,1.00)):
                o.append(blob('canopy',tx+cx,cy,tz+cz,r,CROWN,9))
            for dx,dy,dz in ((-1.55,4.75,.55),(1.45,4.95,-.70),(.55,6.45,.50),(-.70,6.65,-.55)):
                o.append(blob('durian',tx+dx,dy,tz+dz,.30,FRUIT))

    # badminton court: same pad, same painted lines, same post and net heights
    o.append(box('court',0,.19,9,8,.08,14,COURT,T,0))
    for s in (-1,1):
        o.append(box('court kerb',s*4.06,.16,9,.14,.12,14.28,STONE,T,0))
        o.append(box('court kerb',0,.16,9+s*7.07,8.28,.12,.14,STONE,T,0))
    for lx in (-3.5,3.5):o.append(box('side line',lx,.24,9,.06,.015,13,LINE,T,0))
    for lz in (2.5,7,11,15.5):o.append(box('cross line',0,.24,lz,7,.015,.06,LINE,T,0))
    for lz in (4.75,13.25):o.append(box('centre line',0,.24,lz,.06,.015,4.5,LINE,T,0))
    for px in (-3.8,3.8):
        o.append(box('post base',px,.27,9,.36,.16,.36,STONE,T,0))
        o.append(cyl('net post',px,1.12,9,.055,1.60,WHITEP,T,verts=8))
        o.append(cyl('post cap',px,1.94,9,.075,.07,WHITEP,T,verts=8))
    for i in range(6):o.append(box('net cord',0,.90+i*.16,9,7.60,.018,.025,NET,T,0))
    for i in range(31):o.append(box('net cord',-3.75+i*.25,1.30,9,.015,.80,.025,NET,T,0))
    o.append(box('net tape',0,1.73,9,7.60,.065,.045,WHITEP,T,0))
    o.append(box('net skirt',0,.86,9,7.60,.05,.03,WHITEP,T,0))

    # washing line: the wire stays at y=2.35 so Opah's pegged towels still grip it
    for px in (-13,-7):
        o.append(box('line footing',px,.14,-2.5,.42,.28,.42,STONE,T,0))
        o.append(box('line post',px,1.30,-2.5,.11,2.40,.11,TIMBER,T,0))
        for s in (-1,1):o.append(slant('fork',px,2.28,-2.5,px,2.64,-2.5-s*.24,.08,.08,TIMBER))
    o.append(box('washing line',-10,2.35,-2.5,6,.025,.025,NET,T,0))
    # laundry basket on its own small collider
    o.append(vloft('basket',[(.10,rect(-11,3.7,.68,.50)),(.56,rect(-11,3.7,.82,.62))],[BASKET],T,cap=False))
    o.append(box('basket base',-11,.12,-3.7,.68,.06,.50,BASKET,T,0))
    o.append(box('basket rim',-11,.57,-3.7,.88,.08,.68,DECK,T,0))
    o.append(box('folded cloth',-11,.59,-3.7,.62,.14,.44,PANE,T,0))

    # bike track: two flat rings on the exact ellipse the cyclists ride, replacing 48 boxes
    o.append(vloft('bike track',[(.17,ellipse(18,16.8,5.60,2.55,28)),(.17,ellipse(18,16.8,3.80,.75,28))],[TRACK],T,cap=False))
    o.append(vloft('bike rut',[(.175,ellipse(18,16.8,4.95,1.90,28)),(.175,ellipse(18,16.8,4.45,1.40,28))],[RUT],T,cap=False))
    return o

def build():
    s=bpy.context.scene
    for ob in list(s.objects):bpy.data.objects.remove(ob,do_unlink=True)
    root=bpy.data.objects.new(T,None);s.collection.objects.link(root)
    for ob in village():ob.parent=root
    return root

def export(root):
    batches={}
    for ob in [c for c in root.children if c.type=='MESH']:
        batches.setdefault(tuple(m.name for m in ob.data.materials),[]).append(ob)
    for key,objs in batches.items():
        j=join(objs,f'kampung | {" + ".join(key)}')
        for uv in list(j.data.uv_layers):j.data.uv_layers.remove(uv)
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for c in root.children:c.select_set(True)
    path=PUBLIC/'LM_ENV_Kampung.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,
                              export_apply=True,export_cameras=False,export_lights=False,export_extras=False)
    tris=sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in root.children if c.type=='MESH')
    report={'Kampung':{'asset':'LM_ENV_Kampung','origin':[122,0,-132],'triangles':tris,
                       'bytes':path.stat().st_size,'draws':len(root.children)}}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print('KAMPUNG WEB EXPORT',json.dumps(report),flush=True)

SHOTS={'village':((-38,28,52),(0,5,0)),
       'house':((-32,12,14),(-16,3.2,-9)),
       'gerbang':((-7,7,35),(0,4.8,18)),
       'yard':((-32,9,27),(-18,1.8,14)),
       'garden':((28,11,-29),(16,.8,-17))}

def render(root):
    s=bpy.context.scene
    engines=[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine=next(e for e in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH') if e in engines)
    s.render.resolution_x=1400;s.render.resolution_y=1000;s.view_settings.view_transform='AgX'
    w=bpy.data.worlds.new('sky');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.55,.7,.9,1)
    sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));s.collection.objects.link(sun)
    sun.data.energy=4;sun.rotation_euler=(math.radians(50),math.radians(20),math.radians(-35))
    bpy.ops.mesh.primitive_plane_add(size=400,location=(0,0,-.01));bpy.context.object.data.materials.append(mat('Ground',(.30,.36,.24),.95))
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));s.collection.objects.link(cam);s.camera=cam;cam.data.lens=32
    from mathutils import Vector
    for name,(eye,at) in SHOTS.items():
        cam.location=pt(*eye);d=Vector(pt(*at))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/f'preview-{name}.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    root=build();export(root)
    if '--no-render' not in ARGS:render(root)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'kampung.blend'))
