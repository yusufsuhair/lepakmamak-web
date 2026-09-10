import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Photo-matched, game-scale 911: +Z is forward. All markings and the owner tag
// belong to the model, so fleet, local-driver and remote-player copies agree.
export const gt3Red = '#df0712';
export function createGt3Rs() {
  const group = new THREE.Group(), wheels: THREE.Group[] = [];
  group.userData = {model: 'gt3-rs', displayName: 'Porsche 911 GT3 RS', ownerLabel: 'Daddy Fizal', plate: 'SL45'};
  const paint = new THREE.MeshPhysicalMaterial({color: gt3Red, roughness: .30, metalness: .12, clearcoat: 1, clearcoatRoughness: .18});
  const carbon = new THREE.MeshStandardMaterial({color: '#171a1d', roughness: .38, metalness: .35});
  const rubber = new THREE.MeshStandardMaterial({color: '#121416', roughness: .85});
  const glass = new THREE.MeshPhysicalMaterial({color: '#18262f', roughness: .14, metalness: .38, clearcoat: 1, side: THREE.DoubleSide});
  const silver = new THREE.MeshStandardMaterial({color: '#8f969b', roughness: .34, metalness: .85});
  const yellow = new THREE.MeshStandardMaterial({color: '#f6bd16', roughness: .35, metalness: .25});
  const led = new THREE.MeshStandardMaterial({color: '#f1fcff', emissive: '#b9dfff', emissiveIntensity: .65});
  const tail = new THREE.MeshStandardMaterial({color: '#e33a40', emissive: '#fc1328', emissiveIntensity: .7});
  // Reuse primitive geometry within this model; merge the many stationary aero
  // parts and wheel details below to keep a detailed car affordable in the city.
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = group) {
    const m = new THREE.Mesh(geometry, material); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D = group) {
    const m = mesh(cube, mat, parent); m.position.set(x, y, z); m.scale.set(w, h, d); return m;
  }
  function ellipsoid(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D = group) {
    const m = mesh(new THREE.SphereGeometry(1, 20, 12), mat, parent); m.position.set(x, y, z); m.scale.set(w, h, d); return m;
  }
  function line(points: number[][], radius: number, mat: THREE.Material) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 20, radius, 5, false), mat);
  }
  function surface(rows: number[][], columns: number, point: (row: number[], u: number) => number[], mat: THREE.Material) {
    const vertices: number[] = [], indices: number[] = [];
    for (const row of rows) for (let j = 0; j <= columns; j++) vertices.push(...point(row, j / columns));
    for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < columns; j++) {
      const a = r * (columns + 1) + j, b = a + 1, c = b + columns + 1, d = a + columns + 1;
      indices.push(a, d, b, b, d, c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
    return mesh(g, mat);
  }
  function smoothRows(rows:number[][],steps=5){
    const result:number[][]=[];
    for(let i=0;i<rows.length-1;i++)for(let j=0;j<steps;j++){
      const t=j/steps;
      result.push(rows[i].map((v,k)=>{
        if(k===0)return v+(rows[i+1][k]-v)*t;
        const p=rows[Math.max(0,i-1)][k],n=rows[i+1][k],q=rows[Math.min(rows.length-1,i+2)][k];
        return .5*((2*v)+(-p+n)*t+(2*p-5*v+4*n-q)*t*t+(-p+3*v-3*n+q)*t*t*t);
      }));
    }
    result.push(rows.at(-1)!);return result;
  }
  // Center bonnet is lower than the rounded fender shoulders. Undersides lift
  // above the tyres at each wheel arch, leaving genuine open wheel wells.
  const bodyRows = [
    [-2.22, .78, .72, .75], [-2.10, .99, .84, .91], [-1.8, 1.08, .90, 1.00],
    [-1.45, 1.10, .94, 1.05], [-1.05, 1.04, .94, 1.00], [-.6, .96, .92, .96],
    [0, .95, .91, .95], [.6, .98, .84, .97], [1.05, 1.04, .78, 1.04],
    [1.4, 1.06, .76, 1.05], [1.75, 1.01, .73, .96], [2.06, .88, .66, .76], [2.22, .73, .62, .64],
  ];
  function archBottom(z: number) {
    let bottom = .31;
    for (const axle of [-1.4, 1.34]) { const dz = z - axle; if (Math.abs(dz) < .49) bottom = Math.max(bottom, .43 + Math.sqrt(.49 ** 2 - dz ** 2)); }
    return bottom;
  }
  surface(smoothRows(bodyRows), 48, ([z, w, top, shoulder], u) => {
    const a = u * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
    const x = Math.sign(s) * Math.pow(Math.abs(s), .7) * w;
    const upper = top + (shoulder - top) * Math.pow(Math.abs(s), 1.4) - .12 * Math.pow(Math.abs(s), 12);
    const bottom = Math.abs(s) > .65 ? archBottom(z) : .30;
    return [x, c >= 0 ? upper : upper + (bottom - upper) * Math.pow(-c, .5), z];
  }, paint);
  // Close the nose/tail under the skin with sculpted bumpers, not open tubes.
  ellipsoid(0, .52, 2.10, .89, .20, .17, paint);
  ellipsoid(0, .57, -2.10, 1.0, .24, .18, paint);
  box(0, .30, 0, 1.7, .08, 3.8, carbon);

  // Painted coupe canopy, with inset glazing following exactly the same curve.
  const cabinRows = [[-1.62,.55,.93,1.00],[-1.35,.65,.94,1.16],[-1.0,.74,.95,1.37],[-.65,.75,.95,1.48],[-.2,.74,.95,1.51],[.17,.72,.94,1.46],[.48,.72,.91,1.27],[.83,.72,.85,.93]];
  function canopy([z,w,b,t]: number[], u: number, offset = 0) {
    const a = (u - .5) * Math.PI;
    return [Math.sin(a) * (w + offset), b + Math.cos(a) ** .55 * (t - b) + offset, z];
  }
  const cabin=smoothRows(cabinRows,10);
  surface(cabin, 48, canopy, paint);
  surface(cabin.filter(r=>r[0]>=.17&&r[0]<=.79), 24, (r,u) => canopy(r,.16+u*.68,.010), glass);
  surface(cabin.filter(r=>r[0]>=-1.51&&r[0]<=-1.02), 24, (r,u) => canopy(r,.16+u*.68,.010), glass);
  for (const side of [-1,1]) {
    surface(cabin.filter(r=>r[0]>=-1.35&&r[0]<=.60), 12, (r,u) => {
      const taper=Math.min(1,(r[0]+1.35)/.25,(.65-r[0])/.24),span=.20*Math.max(.08,taper);
      return canopy(r,side<0?.03+u*span:.97-span+u*span,.012);
    },glass);
    const pillarRow=cabin.reduce((a,b)=>Math.abs(b[0]+.56)<Math.abs(a[0]+.56)?b:a);
    line(Array.from({length:8},(_,i)=>canopy(pillarRow,side<0?.03+i*.20/7:.77+i*.20/7,.024)),.012,carbon);
    // Door cutlines, recessed handles and mirrors on slender black stalks.
    line([[side*.947,.88,.55],[side*.955,.47,.42],[side*.977,.39,-.63],[side*1.012,.76,-.88]], .008, carbon);
    box(side*.966,.82,-.53,.023,.032,.20, paint);
    box(side*.88,1.02,.49,.24,.026,.038, carbon);
    ellipsoid(side*1.00,1.06,.47,.14,.065,.115,paint);
    ellipsoid(side*1.005,1.061,.405,.114,.045,.024,glass);
    box(side*.97,.31,0,.14,.09,2.14,carbon);
    // Open rear-side brake duct and tall front/rear wheel air curtains.
    const intake = ellipsoid(side*1.016,.755,-.92,.022,.15,.093,carbon); intake.rotation.x=-.42;
    for (const z of [.80,1.83,-1.93]) {
      const fin = box(side*1.037,.49,z,.075,.40,.16,carbon); fin.rotation.x=z>1?-.15:.20;
    }
    for (const z of [1.06,1.23,1.40]) {
      const vent = box(side*.84,1.007,z,.26,.026,.073,carbon);vent.rotation.z=side*-.18;
    }
    // Oval 911 lamps: dark gasket, smoked lens, four small projectors.
    const lamp = new THREE.Group();lamp.position.set(side*.765,.79,1.83);lamp.rotation.x=-.90;lamp.rotation.y=side*.18;group.add(lamp);
    ellipsoid(0,0,0,.206,.239,.026,carbon,lamp);
    ellipsoid(0,0,.018,.190,.223,.022,silver,lamp);
    ellipsoid(0,0,.036,.174,.205,.012,glass,lamp);
    for (const x of [-.073,.073]) for (const y of [-.086,.086]) ellipsoid(x,y,.047,.034,.034,.010,led,lamp);
    box(side*.77,.535,2.185,.30,.025,.024,led);
  }

  // Carbon bonnet insert (raised only millimetres from the body) and twin ducts.
  const bonnet=smoothRows(bodyRows).filter(r=>r[0]>=.72&&r[0]<=1.94);
  function bonnetPoint([z,w,top,shoulder]:number[],u:number,width:number){
    const x=(u*2-1)*width,s=Math.pow(Math.abs(x/w),1/.7);
    return[x,top+(shoulder-top)*Math.pow(s,1.4)-.12*Math.pow(s,12)+.014,z];
  }
  surface(bonnet,24,(r,u)=>bonnetPoint(r,u,r[0]>1.7?.50:.62),carbon);
  surface(bonnet,2,(r,u)=>{const p=bonnetPoint(r,u,.033);p[1]+=.004;return p;},paint);
  for (const side of [-1,1]) {
    const duct=box(side*.31,.854,1.07,.27,.085,.33,carbon);duct.rotation.x=.16;
    box(side*.31,.898,.955,.20,.012,.12,rubber);
  }
  const crest=mesh(new THREE.CircleGeometry(.035,5),new THREE.MeshStandardMaterial({color:'#cba657',metalness:.6,roughness:.28}));crest.rotation.x=-Math.PI/2;crest.position.set(0,.773,1.65);
  box(0,.255,2.11,1.92,.075,.27,carbon);
  ellipsoid(0,.422,2.225,.59,.135,.034,rubber);
  for(const side of [-1,1]) {
    ellipsoid(side*.78,.43,2.155,.14,.135,.04,carbon);
    for(let i=0;i<4;i++)box(side*.77,.35+i*.045,2.19,.20,.01,.012,carbon);
  }

  // Satin black center-lock wheels, independent rotating spokes and fixed PCCB
  // yellow calipers. Drilling uses a single instanced mesh on each brake disc.
  const holeGeometry = new THREE.CircleGeometry(.009,5);
  for (const side of [-1,1]) for (const z of [-1.4,1.34]) {
    const radius=z<0?.445:.423, axle=new THREE.Group();axle.position.set(side*1.01,.445,z);group.add(axle);wheels.push(axle);
    const tyre=mesh(new THREE.CylinderGeometry(radius,radius,.265,40),rubber,axle);tyre.rotation.z=Math.PI/2;
    const barrel=mesh(new THREE.CylinderGeometry(radius*.78,radius*.78,.275,40),carbon,axle);barrel.rotation.z=Math.PI/2;
    const disc=mesh(new THREE.CylinderGeometry(radius*.68,radius*.68,.016,40),silver,axle);disc.rotation.z=Math.PI/2;disc.position.x=side*.145;
    const holes=new THREE.InstancedMesh(holeGeometry,rubber,48);const dummy=new THREE.Object3D();
    for(let i=0;i<48;i++){const a=i/16*Math.PI*2+(Math.floor(i/16)*.08),r=.16+Math.floor(i/16)*.043;dummy.position.set(side*.155,Math.sin(a)*r,Math.cos(a)*r);dummy.rotation.y=side*Math.PI/2;dummy.updateMatrix();holes.setMatrixAt(i,dummy.matrix);}axle.add(holes);
    const lip=mesh(new THREE.TorusGeometry(radius*.80,.012,6,40),carbon,axle);lip.rotation.y=Math.PI/2;lip.position.x=side*.174;
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5;
      const spoke=box(side*.18,Math.sin(a)*.19,Math.cos(a)*.19,.026,.023,.31,carbon,axle);spoke.rotation.x=-a+.08;
    }
    const hub=mesh(new THREE.CylinderGeometry(.067,.067,.04,16),silver,axle);hub.rotation.z=Math.PI/2;hub.position.x=side*.182;
    const lock=mesh(new THREE.CylinderGeometry(.048,.048,.045,10),carbon,axle);lock.rotation.z=Math.PI/2;lock.position.x=side*.19;
    box(side*1.18,.445,z-.21,.048,.25,.095,yellow);
  }

  // Rear deck vents, uninterrupted tail-light strip, twin center exhausts.
  for(let i=-5;i<=5;i++)box(i*.095,1.006,-1.61,.035,.024,.28,carbon);
  box(0,.97,-1.90,1.54,.075,.21,paint);
  box(0,.80,-2.20,1.72,.08,.034,carbon);
  box(0,.82,-2.222,1.61,.017,.016,tail);
  box(0,.43,-2.195,1.84,.32,.12,carbon);
  for(const x of [-.77,-.53,.53,.77])box(x,.27,-2.13,.035,.18,.30,carbon);
  for(const side of [-1,1]){
    box(side*.78,.51,-2.267,.22,.025,.016,tail);
    const tip=mesh(new THREE.TorusGeometry(.075,.012,8,24),silver);tip.position.set(side*.10,.32,-2.29);
    const dark=mesh(new THREE.CircleGeometry(.070,24),rubber);dark.position.set(side*.10,.32,-2.282);dark.rotation.y=Math.PI;
  }

  // Lower the complete wing 34cm (including endplates below the roofline)
  // and shorten its supports, keeping the deck
  // mounting points fixed. The broad rear face carries
  // PORSCHE, red under-plane and RS endplates as in the reference photographs.
  const wingDrop=.34;
  for(const side of [-1,1]){
    line([[side*.54,.96,-1.73],[side*.54,1.54-wingDrop,-1.82],[side*.54,1.73-wingDrop,-2.02],[side*.54,1.70-wingDrop,-2.15]],.036,carbon);
    const support=box(side*.54,1.32-wingDrop/2,-1.82,.036,.55-wingDrop,.10,carbon);support.rotation.x=-.16;
  }
  const lower=box(0,1.59-wingDrop,-2.00,2.18,.065,.43,paint);lower.rotation.x=-.07;
  const upper=box(0,1.72-wingDrop,-2.03,2.18,.045,.36,carbon);upper.rotation.x=-.12;
  box(0,1.69-wingDrop,-2.226,2.16,.13,.025,carbon);
  for(const side of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(-.28,-.12);shape.lineTo(.24,-.08);shape.quadraticCurveTo(.34,.06,.23,.17);shape.lineTo(-.27,.14);shape.closePath();
    const end=mesh(new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.012,bevelThickness:.006,bevelSegments:2,curveSegments:8}),carbon);
    end.rotation.y=Math.PI/2;end.position.set(side*1.09,1.65-wingDrop,-2.00);
  }

  function textTexture(text: string, foreground: string, background?: string, italic = false) {
    const canvas=document.createElement('canvas');canvas.width=text==='SL45'?384:1024;canvas.height=192;const ctx=canvas.getContext('2d')!;
    if(background){ctx.fillStyle=background;ctx.fillRect(0,0,1024,192);}
    ctx.fillStyle=foreground;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${italic?'italic ':''}600 112px Arial`;
    if(text==='GT3 RS'||text==='RS'){ctx.save();ctx.translate(canvas.width/2,100);ctx.scale((canvas.width-90)/ctx.measureText(text).width,1);ctx.fillText(text,0,0);ctx.restore();}
    else ctx.fillText(text,canvas.width/2,100,canvas.width-40);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
  }
  function decal(text: string, w: number, h: number, x: number, y: number, z: number, ry: number, fg: string, bg?: string, italic=false) {
    const mat=new THREE.MeshBasicMaterial({map:textTexture(text,fg,bg,italic),transparent:!bg,depthWrite:!!bg,polygonOffset:true,polygonOffsetFactor:-1});
    const m=mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.rotation.y=ry;m.userData.text=text;m.castShadow=false;return m;
  }
  decal('SL45',.56,.21,0,.57,2.282,0,'#ffffff','#090b0e');
  decal('SL45',.56,.21,0,.56,-2.315,Math.PI,'#ffffff','#090b0e');
  decal('P O R S C H E',1.0,.065,0,.761,-2.228,Math.PI,'#c2c5c8');
  decal('GT3 RS',.35,.063,0,.694,-2.247,Math.PI,'#d9dcdd',undefined,true);
  decal('P O R S C H E',2.03,.16,0,1.698-wingDrop,-2.245,Math.PI,'#c3c6c8');
  for(const side of [-1,1]){
    decal('GT3 RS',1.55,.18,side*.988,.44,-.10,side*Math.PI/2,gt3Red,'#d8dcde',true);
    decal('RS',.32,.12,side*1.125,1.675-wingDrop,-2.00,side*Math.PI/2,'#eb2936',undefined,true);
  }
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture('Daddy Fizal','#ffffff','#202730'),depthTest:true,depthWrite:false,toneMapped:false}));
  tag.name='owner-label';tag.userData.text='Daddy Fizal';tag.position.set(0,2.42,0);tag.scale.set(1.85,.347,1);group.add(tag);
  // Batch by material, separately for the chassis and each rotating wheel.
  // Keep text meshes addressable and the drilled-disc instances intact.
  group.updateMatrixWorld(true);
  for(const parent of [group,...wheels]){
    const batches=new Map<THREE.Material,THREE.Mesh[]>();
    function collect(node:THREE.Object3D){for(const child of node.children){
      if(wheels.includes(child as THREE.Group))continue;
      if(child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh) && !child.userData.text && !Array.isArray(child.material)){
        const list=batches.get(child.material)??[];list.push(child);batches.set(child.material,list);
      }else collect(child);
    }}
    collect(parent);const inverse=parent.matrixWorld.clone().invert();
    for(const [mat,parts] of batches){
      if(parts.length<2)continue;
      const geometries=parts.map(part=>{
        const g=part.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,part.matrixWorld));
        // Surface geometry has no UVs; these solid-colour batches need none.
        g.deleteAttribute('uv');return g.index?g.toNonIndexed():g;
      });
      const merged=mergeGeometries(geometries);if(!merged)throw new Error('GT3 RS mesh batching failed');
      mesh(merged,mat,parent);for(const part of parts)part.removeFromParent();for(const g of geometries)g.dispose();
    }
  }
  return {group,wheels};
}
