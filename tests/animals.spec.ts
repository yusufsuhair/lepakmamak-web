import {test,expect} from '@playwright/test';
test('street animals move, avoid buildings and call only within hearing range',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  // @ts-ignore Vite browser module.
  const {createStreetAnimals}=await import('/src/animals.ts');
  // @ts-ignore Vite browser module.
  const THREE=await import('/node_modules/three/build/three.module.js');
  const scene=new THREE.Scene(),solids=[{x:-12,z:49,hx:3,hz:3}];
  const pets=createStreetAnimals(scene,solids);let calls=0;const sound=()=>calls++;
  pets.update(1,{x:900,z:900},sound);const far=calls;const before=pets.animals[0].group.position.clone();
  pets.update(5,{x:900,z:900},sound);const moved=before.distanceTo(pets.animals[0].group.position)>1;
  let clear=true;for(let t=0;t<32;t+=.5){pets.update(t,{x:900,z:900},sound);for(const pet of pets.animals)for(const s of solids)if(Math.abs(pet.group.position.x-s.x)<s.hx+.3&&Math.abs(pet.group.position.z-s.z)<s.hz+.3)clear=false;}
  pets.update(40,pets.animals[0].group.position,sound);
  return {count:pets.animals.length,far,moved,clear,near:calls};
 });
 expect(result).toMatchObject({count:6,far:0,moved:true,clear:true});expect(result.near).toBeGreaterThan(0);
});
test('preview cat and dog models',async({page})=>{
 await page.goto('/');await page.evaluate(async()=>{
  // @ts-ignore Vite browser module.
  const {createAnimal}=await import('/src/animals.ts');
  // @ts-ignore Vite browser module.
  const THREE=await import('/node_modules/three/build/three.module.js');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#cbd6ba');scene.add(new THREE.HemisphereLight('#fff5df','#667865',3));
  const cat=createAnimal(true,'#e6a34e'),dog=createAnimal(false,'#c89c70');cat.group.position.x=-.75;dog.group.position.x=.75;scene.add(cat.group,dog.group);
  const camera=new THREE.PerspectiveCamera(40,2,.1,30);camera.position.set(2,1.8,4);camera.lookAt(0,.5,0);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(700,350);renderer.render(scene,camera);renderer.domElement.id='animal-preview';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);
 });await page.locator('#animal-preview').screenshot({path:'test-results/animal-preview.png'});
});
