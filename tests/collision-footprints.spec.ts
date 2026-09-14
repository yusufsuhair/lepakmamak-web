import {expect,test} from '@playwright/test';

test('the mosque courtyard is open until the prayer hall or a minaret is touched',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {createWorld}=await import('/src/world.ts');
    const {overlaps}=await import('/src/physics.ts');
    const {masjidSpots}=await import('/src/masjid.ts');
    const world=createWorld({add(){}} as any),spot=masjidSpots[0];
    const mosque=world.solids.filter((solid:any)=>solid.id?.startsWith('masjid-'));
    const clear={x:spot.x+14,z:spot.z+8.5};
    return{
      ids:mosque.map((solid:any)=>solid.id),
      courtyardBlocked:world.solids.some((solid:any)=>overlaps(clear,.46,solid)),
      hallBlocked:mosque.some((solid:any)=>overlaps({x:spot.x,z:spot.z+7.8},.46,solid)),
      minaretBlocked:mosque.some((solid:any)=>overlaps({x:spot.x+15,z:spot.z},.46,solid)),
    };
  });
  expect(result).toEqual({
    ids:['masjid-prayer-hall','masjid-minaret-west','masjid-minaret-east'],
    courtyardBlocked:false,
    hallBlocked:true,
    minaretBlocked:true,
  });
});

// The generic shophouse rows (src/shoplots.ts) have a covered five-foot-way on a 55 cm plinth in front of
// the shopfront. Its old 12 m block collider covered the arcade; now only the shops behind the shopfront
// and the columns are solid, the player walks the arcade on the tiles, and branded shops keep their block.
test('shophouse five-foot-ways are walkable while the shops and columns behind them stay solid',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {createWorld}=await import('/src/world.ts');
    const {overlaps,moveWithCollisions}=await import('/src/physics.ts');
    const url=((await (await fetch('/src/world.ts')).text()).match(/from\s*["'](\/src\/shoplots\.ts[^"']*)["']/)||[])[1]||'/src/shoplots.ts';
    const {shoplotFloorHeight,ARCADE}=await import(/* @vite-ignore */ url);
    const chairs=(await import('/shared/chairs.json')).default,tables=(await import('/shared/tables.json')).default;
    const world:any=createWorld({add(){}} as any),lots=world.shoplots.lots;
    // Known intrusion, not a shophouse collider: the KLCC park hedge at x -53 (world.ts, 55 m long, ending at
    // z -85.5) runs through the MR.DIY row at (-56,-90) and 70 cm into its arcade. It is set aside for the
    // walk and reported on its own below, so every other solid still counts.
    const hedge=(s:any)=>Math.abs(Math.abs(s.x)-53)<.01&&s.z===-113&&s.hz===27.5;
    const solids=world.solids.filter((s:any)=>!hedge(s));
    const blocked=(x:number,z:number,radius=.46)=>solids.some((s:any)=>overlaps({x,z},radius,s));
    const rows=lots.map((l:any)=>{
      const count=Math.max(1,Math.round(l.width/6.5)),bay=l.width/count,half=l.width/2,bays=[...Array(count).keys()].map(i=>l.x-half+bay*(i+.5));
      // Walk in from the street at the first bay, then along the whole arcade, as the game moves a player.
      const walker={x:bays[0],z:l.z+9};moveWithCollisions(walker,0,-5,.46,solids);
      const entered={x:+walker.x.toFixed(2),z:+walker.z.toFixed(2)};
      moveWithCollisions(walker,l.width-1.4,0,.46,solids);const along=+walker.x.toFixed(2);
      let laneBlocked=0;const hedgeAt:number[]=[];
      for(let x=l.x-half+.6;x<=l.x+half-.6;x+=.25){if(blocked(x,l.z+4.6))laneBlocked++;if(world.solids.some((s:any)=>hedge(s)&&overlaps({x,z:l.z+4.6},.46,s)))hedgeAt.push(x);}
      return {lot:`${l.x},${l.z}`,entered,along,end:+(l.x+half-.7).toFixed(2),laneBlocked,hedge:hedgeAt.length?[Math.min(...hedgeAt),Math.max(...hedgeAt)]:null,
        arcadeOpen:bays.filter(x=>!blocked(x,l.z+4.8)).length,bays:count,
        streetToArcade:bays.every(x=>[8,7,6.5,6,5.5,5,4.5].every(dz=>!blocked(x,l.z+dz))),
        interior:[[0,1],[0,-5],[1.5,3.5],[-half+.6,0]].every(([dx,dz])=>blocked(l.x+dx,l.z+dz)),
        columns:[...Array(count+1).keys()].every(k=>blocked(l.x-half+Math.min(Math.max(bay*k,.275),l.width-.275),l.z+5.72,.2)),
        floor:{arcade:shoplotFloorHeight(lots,{x:bays[0],z:l.z+4.8}),street:shoplotFloorHeight(lots,{x:bays[0],z:l.z+7}),inside:shoplotFloorHeight(lots,{x:l.x,z:l.z})}};
    });
    const zus={x:27,z:58};   // a branded LM_SHOP row keeps its whole block
    const shoplotSolids=world.solids.filter((s:any)=>String(s.id).startsWith('shoplot-'));
    return {rows,plinth:ARCADE.floor,brandedBlocked:blocked(zus.x,zus.z+4.8),
      seatsOnPlinth:chairs.filter((c:any)=>shoplotFloorHeight(lots,c)!==null).map((c:any)=>c.id),
      seatsBlocked:chairs.filter((c:any)=>shoplotSolids.some((s:any)=>overlaps(c,.35,s))).map((c:any)=>c.id),
      arrivalsBlocked:tables.filter((t:any)=>shoplotSolids.some((s:any)=>overlaps({x:t.arrivalX,z:t.arrivalZ},.48,s))).map((t:any)=>t.id)};
  });
  expect(result.rows).toHaveLength(9);
  for(const row of result.rows){
    expect(row.entered.z,row.lot).toBeLessThan(Number(row.lot.split(",")[1])+4.6);   // walked in under the arcade, up to the shopfront
    expect(row.along,row.lot).toBeGreaterThan(row.end-.05);                           // and along it to the far end
    expect(row.laneBlocked,row.lot).toBe(0);
    expect(row.arcadeOpen,row.lot).toBe(row.bays);expect(row.streetToArcade,row.lot).toBe(true);
    expect(row.interior,row.lot).toBe(true);expect(row.columns,row.lot).toBe(true);
    expect(row.floor,row.lot).toEqual({arcade:result.plinth,street:null,inside:null});
    if(row.lot==='-56,-90'){expect(row.hedge![0]).toBeGreaterThan(-54.6);expect(row.hedge![1]).toBeLessThan(-51.4);}   // only the hedge's own 2 m
    else expect(row.hedge,row.lot).toBeNull();
  }
  expect(result.plinth).toBe(.55);
  expect(result.brandedBlocked).toBe(true);
  expect(result.seatsOnPlinth).toEqual([]);expect(result.seatsBlocked).toEqual([]);expect(result.arrivalsBlocked).toEqual([]);
});

test('every car style exposes its real rotated footprint without an invisible side wall',async({page})=>{
  await page.goto('/');
  const {styles,footprints}=await page.evaluate(async()=>{
    const {carStyles,createDriveableCar,vehicleSolid}=await import('/src/world.ts');
    const {overlaps}=await import('/src/physics.ts');
    return {styles:carStyles as string[],footprints:carStyles.map((style:string)=>{
      const model=createDriveableCar(style as any),yaw=Math.PI/4;
      const solid=vehicleSolid(model.group,0,0,yaw);
      const point=(localX:number,localZ:number)=>({
        x:localX*Math.cos(yaw)+localZ*Math.sin(yaw),
        z:-localX*Math.sin(yaw)+localZ*Math.cos(yaw),
      });
      return{
        style,
        width:solid.hx*2,
        length:solid.hz*2,
        sideClear:!overlaps(point(solid.hx+.47,0),.46,solid),
        sideTouch:overlaps(point(solid.hx+.44,0),.46,solid),
      };
    })};
  });
  // Counting the styles by hand goes stale every time a car ships (gt3-rs made it 15). What the
  // count was guarding is that no style is listed twice and every one gets its own footprint.
  expect(new Set(styles).size,styles.join(',')).toBe(styles.length);
  expect(footprints).toHaveLength(styles.length);
  // Car-sized, not shell-sized: the revamped fleet's solid is the catalogue's real metres plus
  // the deliberate collision margin vehicle-assets.ts adds (+.4 wide, +.2 long), so it runs
  // 2.07–2.50 by 3.96–5.88, and the two hand-set Porsches sit inside that. The old 2.2/4.8
  // ceilings described the pre-revamp procedural shells; the stale length assert threw first,
  // so nothing said that most of the fleet had stopped fitting them.
  for(const footprint of footprints){
    expect(footprint.width,footprint.style).toBeGreaterThanOrEqual(1.9);
    expect(footprint.width,footprint.style).toBeLessThanOrEqual(2.6);
    expect(footprint.length,footprint.style).toBeGreaterThanOrEqual(3.8);
    expect(footprint.length,footprint.style).toBeLessThanOrEqual(6);
    expect(footprint.sideClear,footprint.style).toBe(true);
    expect(footprint.sideTouch,footprint.style).toBe(true);
  }
});
