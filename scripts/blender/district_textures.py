"""Procedural textures for the photographic districts: Kampung Durian Runtuh (build_kampung.py),
Zoo Negara Mini (build_zoo_negara.py) and the Basket/Pickleball courts (build_courts.py).

Same conventions as pbr_textures.py: colour is sRGB, normals are OpenGL tangent space, array row 0
is the top of the image (v=1 once loaded), and tiled fields wrap by construction. Surfaces the
builders tint per object (acrylic, papan, soil, coats) are painted near white or mid-tone so one
material carries every colour through linear vertex colours. RGBA generators (chain link, nets,
kerawang, foliage) carry coverage in alpha for glTF MASK materials.
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, worley_edges, rgb, band, footprints
from brand_textures import _uv, _smooth, _half, _blobs
from tree_textures import Canvas, _vary, _tile, SS

def _cells(n,count,seed,aspect=1.0):
    """Periodic Voronoi: nearest-site id, F1 and F2-F1 (px). aspect>1 stretches cells along u."""
    r=np.random.default_rng(seed);p=r.random((count,2))*n
    yy,xx=np.mgrid[0:n,0:n].astype(np.float32);f1=np.full((n,n),1e9,np.float32);f2=f1.copy();ids=np.zeros((n,n),np.int32)
    for i,(px,py) in enumerate(p):
        dx=np.abs(xx-px);dx=np.minimum(dx,n-dx)/aspect;dy=np.abs(yy-py);dy=np.minimum(dy,n-dy)
        d=np.sqrt(dx*dx+dy*dy);near=d<f1
        f2=np.where(near,f1,np.minimum(f2,d));ids=np.where(near,i,ids);f1=np.minimum(f1,d)
    return ids,f1,f2-f1

def _wrapdist(a,b,n):
    d=np.abs(a-b);return np.minimum(d,n-d)

# ------------------------------------------------------------------------------ courts
def acrylic(n=512):
    """Acrylic hard-court coating on a 3 m tile, near white (vertex colour paints the zones): sand
    grit in the coating, faint squeegee arcs, chalky sun-faded patches, black shoe scuffs and the
    grey rings a bouncing ball leaves."""
    grit=blur(white(n,501),1);arcs=band(n,n/5,502,.6,spread=1.2,width=.9);arcs=arcs/np.abs(arcs).max()
    fade=fractal(n,2.2,503);mott=fractal(n,1.6,504)
    col=rgb((.93,.93,.92),.9+(grit-.5)*.07+arcs*.018+(fade-.5)*.1+(mott-.5)*.05)
    scuff=_smooth(.8,.95,fractal(n,1.1,505,stretch=(22,1)))*_smooth(.45,.7,fractal(n,1.8,506))
    col*=(1-scuff*.3)[...,None]
    r=np.random.default_rng(507);yy,xx=np.mgrid[0:n,0:n].astype(np.float32);marks=np.zeros((n,n),np.float32)
    for _ in range(30):
        cx,cy=r.random(2)*n;rad=n/3*.035*(.8+.4*r.random())
        d=np.sqrt(_wrapdist(xx,cx,n)**2+_wrapdist(yy,cy,n)**2)/rad
        marks=np.maximum(marks,np.exp(-(d/.9)**2)*(.3+.5*r.random()))
    col*=(1-marks*.22)[...,None]
    return np.clip(col,0,1),_half(normal_from_height(grit*.5+arcs*.15-scuff*.1,n/90))

def chainlink(n=256):
    """Galvanised chain-link diamonds (RGBA), 8 x 8 diamonds on a 0.4 m tile: 50 mm mesh, 3 mm wire,
    with the knuckles where the zig-zag wires hook into each other."""
    u,v=_uv(n);k=8
    a=np.abs(((u+v)*k)%1-.5);b=np.abs(((u-v)*k)%1-.5)
    w=.5-1.6/(n/k)
    wire=np.maximum(_smooth(w-.035,w,a),_smooth(w-.035,w,b))
    knuckle=np.exp(-((a-.5)**2+(b-.5)**2)/.004)
    alpha=np.clip(wire+knuckle,0,1)
    shine=.72+.2*np.maximum(np.sin(a*np.pi*2),np.sin(b*np.pi*2))+(fractal(n,1.5,511)-.5)*.2
    rust=_smooth(.7,.9,fractal(n,1.7,512))*.35
    col=rgb((.78,.80,.79),shine);col=col*(1-rust[...,None])+np.array([.45,.33,.22])*rust[...,None]
    return np.concatenate([np.clip(col,0,1),alpha[...,None]],-1),normal_from_height(wire*1.0+knuckle,n/40)

def netting(n=256,cells=4,cord=5.0,colour=(.95,.94,.9),knots=True,seed=521):
    """Knotted netting (RGBA): cells x cells square meshes on the tile, cord `cord` px wide, a knot
    where cords cross, cord colour a touch uneven."""
    u,v=_uv(n);p=n/cells
    du=np.abs(((u*cells)%1)-.5)*p;dv=np.abs(((v*cells)%1)-.5)*p
    edge=p/2-cord/2
    cordm=np.maximum(_smooth(edge-1,edge,du),_smooth(edge-1,edge,dv))
    knot=np.exp(-((p/2-du)**2+(p/2-dv)**2)/(cord*cord*.9)) if knots else 0
    alpha=np.clip(cordm+knot,0,1)
    col=rgb(colour,.85+(fractal(n,1.4,seed)-.5)*.2)
    return np.concatenate([np.clip(col,0,1),alpha[...,None]],-1),normal_from_height(alpha,n/30)

# ------------------------------------------------------------------------------ kampung
def papan(n=512):
    """Rumah kampung wall boards on a 2.4 m tile: twelve 20 cm boards running along v, a dark gap
    between each, sawn grain, nail heads at the rails, and paint worn back to grey weathered wood
    along the grain and at the gaps. Painted areas are near white: the house colour is the vertex
    colour, so worn timber shows through as a darker tone of it."""
    u,v=_uv(n);k=12;board=np.floor(u*k).astype(int)%k;s=(u*k)%1
    r=np.random.default_rng(531);tone=(1+(r.random(k)-.5)*.1)[board];wear=(r.random(k)**2*.26+.02)[board]
    shift=(r.random(k)*n).astype(int)[board]
    grain=fractal(n,1.8,532,stretch=(1,14));grain=grain[(np.arange(n)[:,None]+shift)%n,np.arange(n)[None,:]]
    streak=fractal(n,1.2,533,stretch=(1,30))
    gap=1-_smooth(.0,.035,np.minimum(s,1-s))
    edge=1-_smooth(.02,.16,np.minimum(s,1-s))
    peel=_smooth(.58-wear*.5,.72-wear*.5,fractal(n,1.7,534,stretch=(1,5))*.7+grain*.3+edge*.25)
    paint=np.array([.93,.92,.88])*(tone*(.95+(streak-.5)*.08))[...,None]
    wood=np.array([.52,.47,.40])*(.8+grain*.35)[...,None]
    col=paint*(1-peel[...,None])+wood*peel[...,None]
    col*=(1-gap*.82)[...,None];col*=(1-_smooth(.55,.9,streak)*.1)[...,None]
    nails=np.exp(-(((s-.5)*n/k)**2+((((v*2.4/1.2)%1)-.08)*n/2)**2)/6)
    col*=(1-nails*.6)[...,None]
    height=-gap*1.2+peel*.25-edge*.15+grain*.2
    return np.clip(col,0,1),normal_from_height(height,n/60)

def kerawang(n=512):
    """Kerawang (RGBA): a carved fretwork panel of awan larat cloud scrolls and a four-petal bunga
    in a moulded frame, pierced right through so light shows behind it. Fills the whole card: map
    0..1 across a vent or a fanlight. Timber colour is near white for vertex tint."""
    u,v=_uv(n);x=np.abs(u-.5)*2;y=np.abs(v-.5)*2
    frame=np.maximum(x,y)>.84
    # central bunga: four petals and a pierced centre ring
    r=np.hypot(u-.5,v-.5)*2;th=np.arctan2(v-.5,u-.5)
    petal=r<.34*(.55+.45*np.abs(np.cos(2*th)))
    bud=r<.07
    # awan larat: arcs of rings mirrored into the four quadrants
    solid=np.zeros((n,n),bool)
    for cx,cy,rad in ((.62,.25,.2),(.82,.52,.14),(.36,.7,.16),(.58,.62,.1),(.2,.35,.12)):
        d=np.hypot(x-cx,y-cy);ring=np.abs(d-rad)<.035
        ang=np.arctan2(y-cy,x-cx);ring&=np.sin(ang*1.5+cx*6)>-.4
        solid|=ring
    stems=(np.abs(y-(.45+.25*np.sin(x*5.2)))<.03)&(x>.3)&(x<.84)
    solid|=frame|petal&~(r<.18)&(r>.05)|bud|stems|(np.abs(r-.4)<.025)
    # a pierced panel keeps thin ties so it stays one piece
    solid|=(np.abs(u-.5)<.012)|(np.abs(v-.5)<.012)&(r>.3)
    a=blur(solid.astype(np.float32),1)
    grain=fractal(n,1.6,541,stretch=(8,1))
    col=rgb((.90,.86,.80),.85+(grain-.5)*.2)
    col*=(.8+.2*np.clip(blur(a,3),0,1))[...,None]
    return np.concatenate([np.clip(col,0,1),np.clip(a*1.4-.2,0,1)[...,None]],-1),normal_from_height(blur(a,2)*1.5+grain*.2,n/50)

def tiles(n=512):
    """Tangga batu riser tiles on a 0.6 m tile: 4 x 4 15 cm glazed tiles with a Peranakan-style
    quatrefoil (a rosette in blue and green, amber corner fans, a maroon ring), grout lines, a glaze
    that is not quite even, and chipped corners filled with dirty grout."""
    u,v=_uv(n);k=4;s=(u*k)%1;t=(v*k)%1;tu,tv=np.floor(u*k).astype(int),np.floor(v*k).astype(int)
    x=s-.5;y=t-.5;r=np.hypot(x,y);th=np.arctan2(y,x)
    col=np.ones((n,n,3))*np.array([.93,.91,.85])
    petal=r<.3*(.6+.4*np.abs(np.cos(2*th)))
    col[petal]=(.16,.36,.55)
    inner=r<.3*(.6+.4*np.abs(np.cos(2*th)))*.62;col[inner]=(.24,.52,.40)
    col[r<.07]=(.93,.74,.25)
    ring=np.abs(r-.42)<.018;col[ring]=(.55,.16,.18)
    cx=np.minimum(s,1-s);cy=np.minimum(t,1-t);corner=np.hypot(cx,cy)<.17;col[corner]=(.9,.62,.2)
    col[np.hypot(cx,cy)<.07]=(.55,.16,.18)
    glaze=(fractal(n,2.0,551)-.5)*.08+(blur(white(n,552),1)-.5)*.03
    col*=(1+glaze)[...,None]
    grout=np.minimum(np.minimum(s,1-s),np.minimum(t,1-t))<.02
    chip=(np.random.default_rng(553).random((k,k))<.3)[tv%k,tu%k]&(np.hypot(cx,cy)<.05)
    col[grout|chip]=(.55,.53,.49)
    dirt=_smooth(.55,.9,fractal(n,1.5,554))*.25;col*=(1-dirt)[...,None]
    height=np.where(grout|chip,0,1)+glaze*2
    return np.clip(col,0,1),_half(normal_from_height(blur(height.astype(np.float32),1),n/80))

def batik(n=512):
    """Kain batik on a 1 m tile, mid tone so vertex colour shifts each sarong's hue: a ground of
    crackle (wax veins) under a lattice of bunga raya motifs and paisley leaves in cream and amber,
    with the canting line work dark around every shape."""
    u,v=_uv(n);col=np.ones((n,n,3))*np.array([.38,.26,.42])
    _,_,e=_cells(n,90,561);vein=np.exp(-(e/1.1)**2)*.5;col=col*(1-vein[...,None]*.5)+np.array([.62,.5,.64])*vein[...,None]*.5
    k=3
    for off in (0,.5):
        s=((u*k+off)%1)-.5;t=((v*k+off)%1)-.5;r=np.hypot(s,t);th=np.arctan2(t,s)
        flower=r<.2*(.55+.45*np.abs(np.cos(2.5*th+off*3)))
        line=np.abs(r-.2*(.55+.45*np.abs(np.cos(2.5*th+off*3))))<.012
        if off==0:
            col[flower]=(.94,.84,.62);col[r<.05]=(.82,.42,.16)
        else:
            leaf=(np.abs(s*np.cos(.8)+t*np.sin(.8))<.12*(1-np.abs(-s*np.sin(.8)+t*np.cos(.8))/.3))&(r<.3)
            col[leaf]=(.86,.58,.22);line|=(np.abs(s*np.cos(.8)+t*np.sin(.8))<.008)&(r<.26)
        col[line]=(.13,.08,.12)
    dots=np.exp(-((((u*18)%1)-.5)**2+(((v*18)%1)-.5)**2)/.004)*.6
    col=col*(1-dots[...,None])+np.array([.88,.8,.62])*dots[...,None]
    col*=(.93+.12*fractal(n,1.4,562))[...,None]
    weave=np.sin(u*2*np.pi*160)*np.sin(v*2*np.pi*160)
    return np.clip(col,0,1),_half(normal_from_height(weave*.4+fractal(n,1.5,563)*.4,n/50))

def halaman(n=512):
    """A swept Malay house compound on a 4 m tile: pale sandy laterite, broom sweep arcs, pebbles,
    footprints, and dry leaves raked into the corners."""
    mott=fractal(n,1.8,571)*.6+fractal(n,2.6,572)*.4;grain=blur(white(n,573),1)
    col=rgb((.80,.70,.55),.86+(mott-.5)*.26+(grain-.5)*.16)
    sweep=band(n,n/60,574,.9,spread=.35,width=.5);sweep=sweep/np.abs(sweep).max()
    sweep*=_smooth(.35,.6,fractal(n,2.4,575))
    red=_smooth(.5,.8,fractal(n,2.2,576));col=col*(1-red[...,None]*.25)+np.array([.66,.43,.3])*red[...,None]*.25
    feet=footprints(n,577,20)
    col*=(1-feet*.12+sweep*.03)[...,None]
    peb=white(n,578)>.992;col[peb]*=np.array([.62,.6,.58]);col[white(n,579)>.995]=(.9,.88,.84)
    cover,rim=_blobs(n,36,580,n*.004,n*.009,wobble=.6)
    leaves=cover>.4;col[leaves]=col[leaves]*.45+np.array([.52,.34,.16])*.55
    height=grain*.35+sweep*.25-feet*.5+cover*.4+mott*.3
    return np.clip(col,0,1),_half(normal_from_height(height,n/110))

def lawn(n=512):
    """ground_textures.grass (the city's cow grass verge) at half the city's size: a district's own
    lawn is seen from walking height over a few dozen metres, and it halves the download."""
    import ground_textures
    return ground_textures.grass(n)

# ------------------------------------------------------------------------------ zoo
def soil(n=512):
    """Habitat earth on a 4 m tile: Zoo Negara's red-brown laterite, trampled flat, hoof and pad
    prints, dried grass stems, gravel. Mid tone so vertex colour can pale it to savanna dust."""
    mott=fractal(n,1.9,601)*.6+fractal(n,2.6,602)*.4;grain=blur(white(n,603),1)
    col=rgb((.84,.74,.62),.86+(mott-.5)*.28+(grain-.5)*.18)
    prints=footprints(n,604,40)
    col*=(1-prints*.18)[...,None]
    straw=_smooth(.86,.95,fractal(n,1.0,605,stretch=(10,1)))*_smooth(.5,.7,fractal(n,2,606))
    col=col*(1-straw[...,None]*.6)+np.array([.78,.68,.46])*straw[...,None]*.6
    g=white(n,607);col[g>.985]*=np.array([.55,.52,.5]);col[g<.008]=(.86,.82,.76)
    crack=np.clip(1-worley_edges(n,40,608)/2.4,0,1)**3*_smooth(.55,.8,fractal(n,1.6,609))
    col*=(1-crack*.3)[...,None]
    return np.clip(col,0,1),_half(normal_from_height(grain*.4+mott*.4-prints*.6-crack*.5+straw*.2,n/100))

def hide(n=512):
    """Asian elephant skin on a 1.5 m tile: grey, a network of deep creases around finer wrinkles,
    folds running around the limb (along u), and the red laterite dust elephants throw on their
    backs."""
    _,_,e=_cells(n,260,621,aspect=1.6);crease=blur(np.exp(-(e/1.6)**2),2)*.6*_smooth(.2,.7,fractal(n,1.5,627))
    _,_,e2=_cells(n,1400,622);fine=np.exp(-(e2/.9)**2)*.7
    folds=np.abs(band(n,n/26,623,0,spread=.25,width=.5));folds=folds/folds.max()
    mott=fractal(n,1.7,624)
    col=rgb((.47,.45,.43),.82+(mott-.5)*.28-crease*.25-fine*.08)
    dust=_smooth(.5,.75,fractal(n,2.2,625));col=col*(1-dust[...,None]*.35)+np.array([.55,.4,.3])*dust[...,None]*.35
    hair=white(n,626)>.997;col[hair]*=.4
    height=-crease*1.0-fine*.35+folds*.5+mott*.3
    return np.clip(col,0,1),_half(normal_from_height(height,n/40))

def giraffe(n=512):
    """Reticulated giraffe coat on a 1 m tile: liver-brown polygonal patches, each its own shade,
    parted by crisp cream lines, with short hair grain along v."""
    ids,f1,e=_cells(n,34,631)
    r=np.random.default_rng(632);shade=(.8+.35*r.random(34))[ids]
    hairs=fractal(n,1.2,633,stretch=(1,14))
    patch=np.array([.55,.30,.15])*(shade*(.82+hairs*.25)*(.88+.14*_smooth(0,26,f1)))[...,None]
    line=1-_smooth(3.0,5.5,e)
    cream=np.array([.90,.82,.64])*(.9+hairs*.15)[...,None]
    col=patch*(1-line[...,None])+cream*line[...,None]
    return np.clip(col,0,1),_half(normal_from_height(hairs*.5+line*.2,n/60))

def zebra(n=512):
    """Plains zebra coat on a 1.2 m tile: bold black stripes that ring the limb (varying along v),
    forking and wandering around it (u), off-white between, with hair grain."""
    u,v=_uv(n);warp=(fractal(n,2.6,641)-.5)*.5+(fractal(n,1.8,642)-.5)*.12
    phase=(v*9+warp+np.sin(u*2*np.pi)*.18)%1
    fork=_smooth(.62,.8,fractal(n,2.2,643))
    stripe=np.maximum(_smooth(.02,.06,np.abs(phase-.5)-.2),fork*_smooth(.0,.04,np.abs(((phase*2)%1)-.5)-.36))
    black=1-stripe
    hairs=fractal(n,1.2,644,stretch=(1,12))
    col=rgb((.86,.84,.78),.9+(hairs-.5)*.16)*(1-black[...,None])+np.array([.07,.07,.08])*black[...,None]
    return np.clip(col,0,1),_half(normal_from_height(hairs*.6,n/70))

def fur(n=512):
    """Lion coat on a 1 m tile: tawny short hair laid along v with darker tips in tufts. Mane and
    muzzle are vertex tints of the same fur."""
    strands=fractal(n,.7,651,stretch=(1,5))*.5+fractal(n,1.4,652,stretch=(1,3))*.5
    tuft=fractal(n,2.0,653);grain=blur(white(n,654),1)
    col=rgb((.78,.62,.42),.84+(strands-.5)*.16+(tuft-.5)*.2+(grain-.5)*.08)
    tips=_smooth(.72,.92,strands*tuft*1.6);col*=(1-tips*.15)[...,None]
    return np.clip(col,0,1),_half(normal_from_height(strands*1.2+tuft*.3,n/45))

def feather(n=256):
    """Flamingo plumage on a 0.4 m tile: overlapping contour feathers in rows (scale arcs), soft
    pink, each feather edge a shade paler. Near white-pink: vertex colour deepens wings."""
    u,v=_uv(n);k=10;s=(u*k+np.floor(v*k)*.5)%1;t=(v*k)%1
    arc=np.hypot(s-.5,(t-1.1)*1.3);edge=_smooth(.42,.5,arc)
    col=rgb((.97,.72,.74),.9+edge*.05+(fractal(n,1.6,661)-.5)*.1)
    return np.clip(col,0,1),_half(normal_from_height(1-arc,n/40))

def water(n=512):
    """Pond water normal from pbr_textures plus a dark, faintly green colour with suspended silt."""
    from pbr_textures import water_normal
    col=rgb((.22,.30,.26),.8+(fractal(n,2.2,671)-.5)*.3)
    return np.clip(col,0,1),water_normal(n)

def wash(n=128):
    """Soft round pool of light, brightest in the middle (greyscale; the runtime adds it)."""
    u,v=_uv(n);d=np.sqrt((u-.5)**2+(v-.5)**2)*2
    c=np.exp(-d*d*2.2)*(1-_smooth(.82,1,d))
    return np.clip(np.stack([c]*3,-1)/c.max(),0,1)

# ------------------------------------------------------------------------------ foliage atlas
DURIAN_TOP,DURIAN_UNDER=(.17,.27,.09),(.52,.42,.22)
RAMBUTAN=(.30,.45,.14);FRUIT=(.70,.10,.08)

def _spray(cv,R,x,y,angle,size,leaf,under,leaflets,width=.34,lift=0.0):
    """A twig with alternate simple leaves drooping outward; some show the bronze underside."""
    ca,sa=np.cos(angle),np.sin(angle)
    cv.stem([(x,y),(x+ca*size,y+sa*size)],size*.018,(.30,.24,.14),lift)
    for j in range(leaflets):
        t=.15+.85*j/max(1,leaflets-1);px,py=x+ca*size*t,y+sa*size*t
        side=1 if j%2 else -1;la=angle+side*R.uniform(.5,1.0)+R.uniform(-.15,.15)
        ll=size*R.uniform(.34,.48)*(1.05-.3*t)
        c=_vary(R,under if R.random()<.18 else leaf,.14,R.uniform(-.3,.4))
        cv.blade(px,py,ll,ll*width,la,c,lift+t,bend=R.uniform(-.12,.12),shape='oval',rib=.2)

def _tree_cell(R,n,leaf,under,fruit=None,width=.34):
    cv=Canvas(n,n);cx,cy=n*.5,n*.5
    for depth,(count,shade) in enumerate([(26,.75),(24,.95),(16,1.12)]):
        for i in range(count):
            ray=R.uniform(0,2*np.pi);d=n*.27*np.sqrt(R.random())
            a=ray+R.uniform(-.7,.7) if R.random()<.6 else R.uniform(0,2*np.pi);size=n*R.uniform(.2,.28)
            x,y=cx+np.cos(ray)*d-np.cos(a)*size*.5,cy+np.sin(ray)*d-np.sin(a)*size*.5
            while size>n*.06 and np.hypot(x+np.cos(a)*size*1.2-cx,y+np.sin(a)*size*1.2-cy)>n*.45:size*=.85
            _spray(cv,R,x,y,a,size,np.clip(np.array(leaf)*shade,0,1),under,int(R.integers(6,10)),width,depth*2.0)
        if fruit and depth==1:
            for _ in range(7):
                ray=R.uniform(0,2*np.pi);d=n*.2*np.sqrt(R.random());fx,fy=cx+np.cos(ray)*d,cy+np.sin(ray)*d
                for k in range(int(R.integers(4,9))):
                    ox,oy=fx+R.uniform(-1,1)*n*.03,fy+R.uniform(-1,1)*n*.03;rad=n*.018*R.uniform(.85,1.15)
                    c=_vary(R,fruit,.15,R.uniform(-.2,.6))
                    cv.blade(ox-rad,oy,rad*2,rad*2,0,c,lift=5,shape='oval',rib=0)
                    for h in range(10):
                        ha=R.uniform(0,2*np.pi);cv.blade(ox+np.cos(ha)*rad*.8,oy+np.sin(ha)*rad*.8,rad*.7,rad*.18,ha,np.clip(np.array(c)*1.1,0,1),lift=5.5,shape='lance',rib=0)
    return cv

def _shrub_cell(R,n):
    """A clipped tropical shrub (ixora / hibiscus mix): dense ovate leaves and a few red blooms."""
    cv=Canvas(n,n);cx,cy=n*.5,n*.55
    for depth,(count,col) in enumerate([(90,(.15,.25,.08)),(80,(.24,.38,.12)),(50,(.34,.48,.16))]):
        for i in range(count):
            ray=R.uniform(0,2*np.pi);d=n*.3*np.sqrt(R.random());x,y=cx+np.cos(ray)*d,cy+np.sin(ray)*d*.8
            ll=n*R.uniform(.05,.08);a=ray+R.uniform(-.8,.8);x-=np.cos(a)*ll*.5;y-=np.sin(a)*ll*.5;cv.blade(x,y,ll,ll*.5,a,_vary(R,col,.12,R.uniform(-.3,.5)),depth*2,bend=R.uniform(-.1,.1),shape='oval',rib=.18)
    for i in range(12):
        ray=R.uniform(0,2*np.pi);d=n*.26*np.sqrt(R.random());x,y=cx+np.cos(ray)*d,cy+np.sin(ray)*d*.8
        for p in range(5):cv.blade(x,y,n*.022,n*.018,p*1.2566+R.uniform(0,.3),_vary(R,(.80,.14,.10),.1),7,shape='oval',rib=0)
    return cv

def _grass_cell(R,n):
    """A clump of lalang / reeds from the bottom centre: lance blades fanning up, some bent over,
    dry tips, and a few seed plumes."""
    cv=Canvas(n,n)
    for i in range(70):
        f=R.random();a=-np.pi/2+(f-.5)*1.7+R.uniform(-.1,.1);L=n*R.uniform(.45,.92)*(1-.35*abs(f-.5))
        col=_vary(R,(.36,.48,.16) if R.random()<.75 else (.62,.58,.32),.12,R.uniform(-.2,.5))
        tip=(R.uniform(.7,.9),(.66,.58,.36)) if R.random()<.4 else None
        cv.blade(n*.5+R.uniform(-n*.06,n*.06),n*.99,L,n*R.uniform(.012,.022),a,col,lift=R.uniform(0,3),bend=(f-.5)*R.uniform(.1,.5),shape='lance',rib=.15,tip=tip)
    for i in range(5):
        a=-np.pi/2+R.uniform(-.3,.3);L=n*R.uniform(.7,.95);x0=n*.5+R.uniform(-n*.04,n*.04)
        cv.stem([(x0,n*.99),(x0+np.cos(a)*L,n*.99+np.sin(a)*L)],n*.004,(.55,.5,.3),4)
        ex,ey=x0+np.cos(a)*L,n*.99+np.sin(a)*L
        for k in range(14):cv.blade(ex,ey+k*n*.008,n*.05,n*.01,a+R.uniform(-.6,.6),(.86,.83,.74),5,shape='lance',rib=0)
    return cv

def foliage(n=1024):
    """2 x 2 atlas: [0,0] durian spray (glossy dark leaves, bronze undersides), [1,0] rambutan with
    red hairy fruit, [0,1] flowering shrub, [1,1] lalang / reed clump (base at the cell's bottom)."""
    R=np.random.default_rng(20260914);h=n//2*SS
    cells=[_tree_cell(R,h,DURIAN_TOP,DURIAN_UNDER,width=.3),_tree_cell(R,h,RAMBUTAN,(.45,.52,.3),FRUIT,width=.42),_shrub_cell(R,h),_grass_cell(R,h)]
    outs=[c.finish(h/SS/90) for c in cells]
    return _tile([o[0] for o in outs]),_half(_tile([o[1] for o in outs]))
