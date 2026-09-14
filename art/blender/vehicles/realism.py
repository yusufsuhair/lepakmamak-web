"""Second-pass original Blender geometry. Executed in the builder's helper namespace.

Profiles are authored separately for every silhouette, in metres, rather than scaling
one hatchback into every badge. No external meshes/textures are used.
"""
import bmesh
legacy_trim=trim_and_lights
legacy_wheel=wheel
legacy_formula=formula

# rear glass base / rear roof / front roof / windscreen base, fraction of length;
# roof half width, belt height fraction, rear/front deck height fraction.
PROFILES={
 'axia':(-.455,-.30,.125,.285,.365,.645,.97,.94),
 'myvi':(-.445,-.285,.120,.295,.372,.650,.98,.94),
 'emas':(-.435,-.26,.130,.305,.384,.625,1.00,.91),
 'avanza':(-.455,-.335,.150,.305,.390,.625,1.00,.94),
 'vellfire':(-.465,-.395,.225,.345,.420,.625,1.00,.96),
 'suv':(-.450,-.300,.140,.295,.385,.630,1.00,.95),
 'sport':(-.280,-.125,.050,.270,.345,.640,1.08,.91),
 'ferrari':(-.265,-.115,.045,.260,.337,.660,1.06,.88),
 'lamborghini':(-.235,-.110,.035,.255,.335,.680,1.08,.84),
 'model-y':(-.420,-.190,.120,.300,.358,.625,.99,.85),
 'cybertruck':(-.290,-.025,.018,.335,.400,.645,1.00,.99),
 'police':(-.450,-.300,.140,.295,.385,.630,1.00,.95),
}

def surface_width(s,z):
 t=z/(s['l']/2);end=max(0,(abs(t)-.70)/.30)
 taper=.050 if s['kind']=='truck' else (.115 if s['kind'] in ['super','svj','coupe'] else .075)
 waist=.035*math.exp(-(z/.55)**2) if s['kind'] in ['super','svj','coupe'] else .010*math.exp(-(z/.75)**2)
 return s['w']/2*(1-taper*end**2-waist)

def finish_panels(s):
 # A single continuous deformation applies to the body AND mounted details. This
 # rounds bumper corners without leaving lights, panel seams or plates floating.
 if s['kind'] in ['truck','formula']:return
 l,w,h=s['l'],s['w'],s['h'];belt=s['_belt']
 for o in bpy.context.scene.objects:
  if o.type!='MESH' or o.parent:continue
  # Wide grille/bumper faces need interior vertices before being curved. Bending
  # only their four corners otherwise lets the body poke through the centre.
  bm=bmesh.new();bm.from_mesh(o.data)
  large=[f for f in bm.faces if len(f.verts)>4 and abs((o.matrix_world@f.calc_center_median()).y)>l*.33]
  if large:bmesh.ops.triangulate(bm,faces=large)
  edges=[e for e in bm.edges if e.calc_length()>.20 and abs((o.matrix_world@((e.verts[0].co+e.verts[1].co)/2)).y)>l*.33]
  if edges:bmesh.ops.subdivide_edges(bm,edges=edges,cuts=4,use_grid_fill=True)
  bm.to_mesh(o.data);bm.free()
  inv=o.matrix_world.inverted()
  for vertex in o.data.vertices:
   p=o.matrix_world@vertex.co;x,y,z=p.x,p.z,-p.y
   edge=min(1,abs(x)/(w*.5));end=max(0,min(1,(abs(z)/(l*.5)-.66)/.34))
   z-=math.copysign(.16*end*end*edge**2,z)
   # The lower door skin rolls into the sill, with a crease at the beltline.
   lower=max(0,min(1,(belt-.13-y)/max(.1,belt-.35)))
   mid=max(0,1-(abs(z)/(l*.5))**6)
   if abs(x)>w*.40 and y>.22:
    x*=1-.045*lower*lower*mid
   vertex.co=inv@Vector(coord((x,y,z)))
  o.data.update()

def body_shell(s):
 pr=PROFILES[style];belt=s['h']*pr[5];s['_belt']=belt
 l,w,h=s['l'],s['w'],s['h'];sport=s['kind'] in ['super','svj','coupe'];truck=s['kind']=='truck'
 vs=[];fs=[];n=64 if not truck else 24
 for i in range(n+1):
  t=-1+2*i/n;z=t*l/2;ww=surface_width(s,z)
  # Fender volumes stay broad over the axles and pinch at the door sill.
  front=max(0,(t-.46)/.54);rear=max(0,(-t-.55)/.45)
  top=belt*(1-(1-pr[7])*front**1.4+(pr[6]-1)*rear)
  arch=max(math.exp(-((z-az)/.44)**2) for az in [-s['wb']/2,s['wb']/2])
  shoulder=top+(max(0,s['r']*2+.075-top)*arch if sport else .014*arch)
  low=.20 if not sport else .16
  section=[(-ww*.88,low),(-ww*.98,low+.09),(-ww,shoulder-.15),(-ww*.98,shoulder-.045),
   (-ww*.88,shoulder),(-ww*.65,top+.025),(0,top+.045),(ww*.65,top+.025),
   (ww*.88,shoulder),(ww*.98,shoulder-.045),(ww,shoulder-.15),(ww*.98,low+.09),(ww*.88,low)]
  vs.extend((x,y,z) for x,y in section)
  if i:
   for j in range(13):fs.append(((i-1)*13+j,(i-1)*13+(j+1)%13,i*13+(j+1)%13,i*13+j))
 fs.extend([tuple(reversed(range(13))),tuple(n*13+j for j in range(13))])
 o=mesh('V2 sculpted fenders hood and quarter panels',vs,fs,M['paint'],not truck)
 bpy.context.view_layer.objects.active=o
 if not truck:
  mod=o.modifiers.new('Continuous compound curvature','SUBSURF');mod.levels=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 for az in [-s['wb']/2,s['wb']/2]:
  for side in [-1,1]:
   cut=cyl('Arch tool',(side*w/2,s['r']+.012,az),s['r']+.052,.49,M['trim'],n=56)
   bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Open wheel well','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
   bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
 bevel(o,.009,2)
 return belt

def ribbon(name,a,b,width,m):
 # Solid optical/panel ribbons with a deliberate finite thickness.
 path(name,[a,b],width,m)

def cabin(s,belt):
 pr=PROFILES[style];l,w,h=s['l'],s['w'],s['h'];truck=s['kind']=='truck';sport=s['kind'] in ['super','svj','coupe']
 stations=[(pr[0]*l,belt+.045,w*.433),(pr[1]*l,h-.035,w*pr[4]),(pr[2]*l,h-.035,w*(pr[4]-.008)),(pr[3]*l,belt+.035,w*.435)]
 back,rb,rf,front=stations
 # Curved roof only: an open greenhouse leaves real depth behind glazing.
 vs=[];fs=[];nx=12;nz=10
 for j in range(nz+1):
  v=j/nz;z=rb[0]*(1-v)+rf[0]*v;ww=rb[2]*(1-v)+rf[2]*v
  for i in range(nx+1):
   u=-1+2*i/nx;y=h-.062+(.055*(1-u*u)+.012*sin(v*pi) if not truck else 0)
   vs.append((u*ww,y,z))
 for j in range(nz):
  for i in range(nx):k=j*(nx+1)+i;fs.append((k,k+1,k+nx+2,k+nx+1))
 roof=mesh('Compound crown roof panel',vs,fs,M['glass'] if s['kind'] in ['ev','fastback'] else M['paint'],not truck)
 mod=roof.modifiers.new('Roof panel thickness','SOLIDIFY');mod.thickness=.023;bpy.context.view_layer.objects.active=roof;bpy.ops.object.modifier_apply(modifier=mod.name)
 for side in [-1,1]:
  points=[(side*back[2],belt+.048,back[0]),(side*front[2],belt+.048,front[0]),(side*rf[2],rf[1]-.032,rf[0]),(side*rb[2],rb[1]-.032,rb[0])]
  glazing('Curved side solar glass',points,M['glass'],0,side)
  path('Continuous window gasket',points+[points[0]],.011,M['trim'])
  # A/C pillars are structural painted strips, the B pillar is blacked out.
  for lo,hi,width in [(points[0],points[3],.045 if not sport else .035),(points[1],points[2],.032)]:
   ribbon('Painted cabin pillar',lo,hi,width,M['paint'])
  if not sport:
   for f in ([.35,.68] if s['kind'] in ['van','mpv'] else [.53]):
    lo=tuple(points[0][k]*(1-f)+points[1][k]*f for k in range(3))
    hi=tuple(points[3][k]*(1-f)+points[2][k]*f for k in range(3))
    ribbon('Gloss B pillar',lo,hi,.025,M['trim'])
  path('Chrome belt trim',points[:2],.006,M['metal'] if s['kind'] in ['van','suv','mpv'] else M['trim'])
  mx=side*(w/2+.060);mz=front[0]-.21;my=belt+.13
  path('Mirror pedestal',[(side*w*.425,my-.04,mz-.015),(mx,my-.01,mz)],.025,M['trim'])
  box('Aerodynamic mirror housing',(mx,my,mz),(.205,.102,.205),M['paint'],.044)
  box('Mirror optical surface',(mx,my,mz-.102),(.163,.065,.008),M['metal'],.018)
  box('Mirror turn repeater',(mx,my-.015,mz+.103),(.145,.013,.009),M['indicatorR' if side>0 else 'indicatorL'],.004)
 for rear,lo,hi in [(False,front,rf),(True,back,rb)]:
  sg=-1 if rear else 1
  pts=[(-lo[2]+.052,lo[1]+.01,lo[0]+.018*sg),(lo[2]-.052,lo[1]+.01,lo[0]+.018*sg),(hi[2]-.027,hi[1]+.004,hi[0]),(-hi[2]+.027,hi[1]+.004,hi[0])]
  glazing('Rear panoramic glazing' if rear else 'Deep curved windscreen',pts,M['glass'],2,sg)
  path('Windscreen ceramic border',pts+[pts[0]],.014,M['trim'])
  if not rear:
   for x,zz in [(-.31,.024),(.29,.018)]:
    path('Wiper arm',[(x,belt+.075,lo[0]-.01),(x-.15,belt+.12,lo[0]-.12)],.007,M['trim'])
    path('Wiper blade',[(x-.36,belt+.135,lo[0]-.13),(x+.08,belt+.135,lo[0]-.13)],.010,M['trim'])
  elif not sport and not truck:
   path('Rear window wiper',[(-.24,belt+.15,lo[0]-.025),(.15,belt+.15,lo[0]-.025)],.009,M['trim'])
 # Deep upholstered cabin and RHD instruments visible through solar glazing.
 box('Cabin floor',(0,.38,(front[0]+back[0])/2),(w*.72,.045,front[0]-back[0]),M['trim'])
 box('Dashboard leather',(0,belt-.025,front[0]-.22),(w*.75,.15,.30),M['leather'],.05)
 for side in [-1,1]:
  sx=side*w*.20;seatZ=front[0]-.82
  box('Seat cushion',(sx,belt-.29,seatZ),(.43,.12,.46),M['leather'],.045)
  box('Sculpted seat back',(sx,belt-.04,seatZ-.21),(.42,.48,.135),M['leather'],.054)
  box('Headrest',(sx,belt+.24,seatZ-.21),(.21,.16,.10),M['leather'],.033)
  for dx in [-.17,.17]:box('Seat side bolster',(sx+dx,belt-.025,seatZ-.17),(.07,.37,.10),M['trim'],.022)
 if not sport:box('Rear seatbacks',(0,belt-.04,back[0]+.33),(w*.7,.43,.14),M['leather'],.04)
 sy=belt+.09;sz=front[0]-.40;sx=w*.20
 path('RHD steering rim',[(sx+.13*cos(t*2*pi/32),sy+.13*sin(t*2*pi/32),sz) for t in range(33)],.017,M['trim'])
 for t in [0,pi,1.5*pi]:path('Steering satin spoke',[(sx,sy,sz),(sx+.115*cos(t),sy+.115*sin(t),sz)],.016,M['darkmetal'])
 box('Driver instrument binnacle',(sx,belt+.075,front[0]-.29),(.30,.15,.035),M['trim'])
 box('Centre screen',(0,belt+.09,front[0]-.28),(.30,.18,.022),M['glass'])
 box('Centre tunnel',(0,belt-.25,front[0]-.77),(.17,.19,.59),M['trim'],.025)
 return stations

def trim_and_lights(style,s,belt,stations):
 before=set(bpy.context.scene.objects);legacy_trim(style,s,belt,stations)
 remove=['Door shut line','Shoulder crease','Fender arch lip','Headlamp smoked housing','LED daytime signature','Projector optic','Swept headlamp lens','Swept white light guide','Chrome lamp blade','LED projector','SVJ Y signature','Bonnet central crease']
 for o in set(bpy.context.scene.objects)-before:
  if any(o.name.startswith(prefix) for prefix in remove):bpy.data.objects.remove(o,do_unlink=True)
 l,w,h=s['l'],s['w'],s['h'];z=l/2;sport=s['kind'] in ['super','svj','coupe']
 # Tailor the optical outline: long blade EV, steep berlinetta, angular SVJ,
 # paired Vellfire, and swept compact Perodua clusters.
 lamp={
  'myvi':(.19,.44,.018,.143,.020), 'axia':(.205,.45,.032,.126,.005),
  'emas':(.22,.445,.050,.073,.10), 'avanza':(.21,.45,.060,.125,.015),
  'vellfire':(.255,.455,.005,.145,.01),'suv':(.22,.45,.04,.135,.035),
  'police':(.22,.45,.04,.135,.035),'sport':(.255,.447,.052,.13,.10),
  'ferrari':(.30,.435,.010,.17,.30),'lamborghini':(.27,.445,.035,.125,.18),
  'model-y':(.265,.445,.065,.070,.12),
 }
 for side in [-1,1]:
  # Panel edges conform to the loft instead of sitting on a flat plane outside it.
  for az in [-s['wb']/2,s['wb']/2]:
   rr=s['r']+.057;pts=[]
   for i in range(33):
    t=i*pi/32;zz=az+rr*cos(t);pts.append((side*(surface_width(s,zz)+.002),s['r']+.012+rr*sin(t),zz))
   path('Contour wheel arch moulding',pts,.012 if s['kind'] in ['suv','ev','truck'] else .006,M['trim'] if s['kind'] in ['suv','ev','truck'] else M['paint'])
  for dz in ([-.36] if sport else [-.72,.50]):
   pts=[(side*(surface_width(s,dz)*f+.002),yy,dz) for f,yy in [(.985,.36),(1,belt-.19),(.978,belt-.04)]]
   path('Recessed door panel seam',pts,.0026,M['trim'])
  # Bonnet seam follows the smooth shoulder into the nose.
  path('Bonnet perimeter',[(side*w*.31,belt+.036,stations[3][0]+.07),(side*w*.33,belt+.021,l*.37),(side*w*.30,belt*PROFILES[style][7]+.046,l*.47)],.0025,M['trim'])
  if style!='cybertruck':
   inn,out,drop,deep,sweep=lamp[style];yy=belt*PROFILES[style][7]-.015
   # Mount on the bumper's surface before finish_panels curves both together.
   # Recessing a lamp by its swept length would bury it in the closed body shell.
   pts=[(side*w*inn,yy-drop,z+.021),(side*w*out,yy+.025,z+.021),(side*w*out,yy-deep*.7,z+.021),(side*w*inn,yy-deep,z+.021)]
   quad('Inset optical reflector well',pts,M['trim'])
   path('Lamp rubber seal',pts+[pts[0]],.009,M['trim'])
   path('LED light guide',[tuple(p[k]+(.013 if k==2 else 0) for k in range(3)) for p in pts[:2]],.009,M['white'])
   for f in [.36,.69]:
    xx=side*w*(inn+(out-inn)*f);zz=z+.035;y=yy-drop*(1-f)-.035
    cyl('Aluminium projector reflector',(xx,y,zz),.024,.012,M['metal'],axis='z',n=20)
    cyl('Projector lens',(xx,y,zz+.009),.019,.008,M['white'],axis='z',n=20)
   if style=='lamborghini':
    for f in [.32,.7]:
     xx=side*w*(inn+(out-inn)*f);zz=z+.046;y=yy-.025
     path('SVJ Y optical blade',[(xx-side*.04,y+.018,zz),(xx,y-.018,zz),(xx+side*.028,y+.013,zz-.014)],.008,M['white'])
   if style=='vellfire':path('Vellfire lower optical tier',[(side*w*inn,yy-.17,z+.027),(side*w*out,yy-.16,z+.010)],.014,M['white'])
   ind=M['indicatorR' if side>0 else 'indicatorL']
   path('Front amber indicator',[(side*w*(out-.06),yy-deep*.75,z+.041),(side*w*out,yy-deep*.7,z+.041)],.009,ind)
  else:ind=M['indicatorR' if side>0 else 'indicatorL']
  box('Rear turn signal',(side*w*.345,belt-.12,-z-.042),(w*.17,.022,.016),ind,.006)
  box('Reverse light',(side*w*.275,belt-.17,-z-.04),(.075,.024,.016),M['reverse'],.004)
  # Fuel/charge door, inset ring and parking sensors are model scale details.
  if side>0:
   zz=-s['wb']*.32;xx=side*(surface_width(s,zz)+.005)
   path('Fuel or charge flap',[(xx,belt-.12,zz-.09),(xx,belt-.12,zz+.09),(xx,belt-.27,zz+.09),(xx,belt-.27,zz-.09),(xx,belt-.12,zz-.09)],.0025,M['trim'])
  for f in [.2,.40]:
   for sg in [-1,1]:cyl('Ultrasonic parking sensor',(side*w*f,.36,sg*(z+.022)),.012,.006,M['darkmetal'],axis='z',n=12)
 # Honeycomb depth inside the lower grille, with broad painted bumper surround.
 if s['kind'] not in ['truck','ev','fastback']:
  if style in ['avanza','suv','police','vellfire']:
   box('Lower grille dark backing',(0,.46,z+.049),(w*.55,.125,.018),M['trim'],.006)
  for row in range(3):
   for col in range(14):
    xx=(col-6.5)*w*.034+(row%2)*w*.017;yy=.43+row*.031
    path('Grille honeycomb cell',[(xx+.025*cos(k*pi/3),yy+.017*sin(k*pi/3),z+.049) for k in range(7)],.0025,M['darkmetal'])
 # Distinct aero surfaces follow each sports silhouette.
 if sport:
  for side in [-1,1]:
   quad('Quarter intake depth',[(side*w*.497,.36,-.58),(side*w*.486,belt+.025,-.93),(side*w*.464,belt+.035,-.45),(side*w*.481,.46,-.22)],M['carbon'])
   path('Quarter intake painted blade',[(side*w*.498,.36,-.58),(side*w*.47,belt+.014,-.46),(side*w*.478,.46,-.22)],.016,M['paint'])
 if style=='ferrari':
  for side in [-1,1]:
   cyl('Circular rear lamp housing',(side*w*.36,belt-.07,-z-.033),.085,.014,M['trim'],axis='z',n=32)
   path('Circular rear LED',[(side*w*.36+.061*cos(t*2*pi/32),belt-.07+.061*sin(t*2*pi/32),-z-.046) for t in range(33)],.012,M['red'])
 if style in ['avanza','suv','police']:
  for side in [-1,1]:path('Roof rail',[(side*w*.34,h+.018,-l*.29),(side*w*.34,h+.039,-l*.23),(side*w*.34,h+.039,l*.06),(side*w*.34,h+.018,l*.12)],.014,M['metal'])

def wheel(style,s,side,z,front):
 pivot=legacy_wheel(style,s,side,z,front);r=s['r'];x=side*(s['w']/2-.07);y=r+.012
 # Replace the shared ten-spoke face with independent cast/forged/aero designs.
 for o in list(pivot.children):
  if o.name.startswith('Machined split spoke'):bpy.data.objects.remove(o,do_unlink=True)
 before=set(bpy.context.scene.objects)
 count={'axia':7,'myvi':5,'emas':5,'avanza':5,'vellfire':10,'suv':6,'sport':6,'ferrari':5,'lamborghini':7,'model-y':7,'cybertruck':7,'police':6,'f1':8}[style]
 aero=style in ['emas','model-y','cybertruck','f1'];fork=style in ['myvi','avanza','vellfire','ferrari','lamborghini','sport']
 for k in range(count):
  t=2*pi*k/count
  for branch in ([-1,1] if fork else [0]):
   angle=t+branch*.075
   angles=[angle-.055,angle-.035,angle+(.31 if aero else .045),angle+.09]
   radii=[r*.17,r*.69,r*.69,r*.17]
   pts=[(x+side*(.146 if i in [0,3] else .153),y+rad*cos(an),z+rad*sin(an)) for i,(rad,an) in enumerate(zip(radii,angles))]
   o=quad('Specific forged or aero spoke',pts,M['darkmetal'] if aero else M['metal'])
   mod=o.modifiers.new('Spoke casting depth','SOLIDIFY');mod.thickness=.018;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
  # Drilled rotor holes now live in the shared atlas disc texture (atlas_pass), not in geometry.
 path('Rim valve stem',[(x+side*.15,y+r*.61,z),(x+side*.173,y+r*.61,z)],.007,M['trim'])
 for o in set(bpy.context.scene.objects)-before:
  mw=o.matrix_world.copy();o.parent=pivot;o.matrix_world=mw
 if style=='f1':
  # Slicks have distinct front/rear widths, with all face geometry on the axle.
  bpy.context.view_layer.update()
  for o in pivot.children:
   inv=o.matrix_world.inverted()
   if o.type=='MESH':
    for v in o.data.vertices:
     p=o.matrix_world@v.co;p.x=x+(p.x-x)*(1.18 if front else 1.5);v.co=inv@p
 return pivot

def formula(s):
 legacy_formula(s)
 # An airfoil cross-section creates a real leading/trailing edge on the front wing.
 for o in list(bpy.context.scene.objects):
  if o.name.startswith('Front multi element wing'):bpy.data.objects.remove(o,do_unlink=True)
 for element in range(3):
  vs=[];fs=[];n=28
  for j in range(n+1):
   x=-.92+1.84*j/n;dihedral=.042*(abs(x)/.92)**2;z=2.16+element*.12-.12*(abs(x)/.92)**2
   for yy,zz in [(0,-.07),(.021,-.055),(.025,.005),(.01,.07),(-.004,.07),(-.009,-.04)]:vs.append((x,.24+element*.026+dihedral+yy,z+zz))
   if j:
    for k in range(6):fs.append(((j-1)*6+k,(j-1)*6+(k+1)%6,j*6+(k+1)%6,j*6+k))
  fs.extend([tuple(reversed(range(6))),tuple(n*6+k for k in range(6))])
  mesh('Curved carbon wing airfoil',vs,fs,M['carbon'],True)
 # Roll-hoop intake, tapered engine spine and brake cooling ducts.
 box('Formula airbox surround',(0,.98,-.96),(.27,.20,.25),M['paint'],.085)
 box('Airbox intake darkness',(0,.98,-.826),(.18,.12,.012),M['trim'],.04)
 quad('Engine cover spine',[(-.012,.63,-1.85),(-.012,1.07,-1.07),(-.012,.94,-.91),(-.012,.63,-.8)],M['paint'])
 for side in [-1,1]:
  for i in range(8):path('Sidepod cooling slot',[(side*.36,.665,-.7-i*.065),(side*.64,.655,-.72-i*.065)],.009,M['trim'])
  for z in [-s['wb']/2,s['wb']/2]:box('Brake cooling scoop',(side*.77,.38,z+.04),(.08,.12,.16),M['carbon'],.02)
  for x in [.3,.5,.7]:box('Rear floor diffuser channel',(side*x,.23,-1.78),(.018,.13,.46),M['carbon'],.004)
