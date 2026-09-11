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

test('every car style exposes its real rotated footprint without an invisible side wall',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {carStyles,createDriveableCar,vehicleSolid}=await import('/src/world.ts');
    const {overlaps}=await import('/src/physics.ts');
    return carStyles.map((style:string)=>{
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
    });
  });
  expect(result).toHaveLength(14);
  for(const footprint of result){
    expect(footprint.width,footprint.style).toBeGreaterThanOrEqual(1.6);
    expect(footprint.width,footprint.style).toBeLessThanOrEqual(2.2);
    expect(footprint.length,footprint.style).toBeGreaterThanOrEqual(3.1);
    expect(footprint.length,footprint.style).toBeLessThanOrEqual(4.8);
    expect(footprint.sideClear,footprint.style).toBe(true);
    expect(footprint.sideTouch,footprint.style).toBe(true);
  }
});
