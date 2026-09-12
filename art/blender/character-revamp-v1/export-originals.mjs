import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const out=resolve('art/blender/generated/character-revamp-v1');
const opts=JSON.parse(readFileSync('shared/appearance.json'));
const defs=[];
for(const gender of Object.values(opts.gender)) {
 for(const hairstyle of Object.values(opts.hairstyle)) defs.push({id:`${gender}-${hairstyle}`,gender,hairstyle,tudung:'none'});
 for(const tudung of Object.values(opts.tudung).filter(x=>x!=='none')) defs.push({id:`${gender}-tudung-${tudung}`,gender,hairstyle:'short',tudung});
}
const files=execFileSync('rg',['-l','createPerson\\(','src','--glob','*.ts'],{encoding:'utf8'}).trim().split('\n');
const roles=files.flatMap(file=>readFileSync(file,'utf8').split('\n').flatMap((text,i)=>text.includes('createPerson(')?[{file,line:i+1,text:text.trim()}]:[]));
writeFileSync(`${out}/references/inventory.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),options:opts,definitions:defs,createPersonCallSites:roles,note:'24 structural avatar combinations; colour swatches remain modular. NPCs reuse createPerson with role colours, props, poses and scale; attached role props are not separate avatar bodies.'},null,2));
const html=`<html><style>body{margin:0;background:#e9e2d5}canvas{display:block}</style><script type="module">
import * as T from 'three';
import {GLTFExporter} from '/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {createPerson} from '/src/world.ts';
import {defaultAppearance} from '/src/appearance.ts';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1600,1050);r.setPixelRatio(1);document.body.appendChild(r.domElement);
const s=new T.Scene();s.background=new T.Color('#e9e2d5');s.add(new T.HemisphereLight(0xffffff,0x66776c,3));const l=new T.DirectionalLight(0xffffff,3);l.position.set(-3,5,5);s.add(l);
const cam=new T.OrthographicCamera(-6.55,6.55,4.3,-4.3,.1,100);cam.position.set(0,4,20);cam.lookAt(0,3.6,0);
window.run=async defs=>{const results=[];for(let i=0;i<defs.length;i++){const d=defs[i],p=createPerson(defaultAppearance.shirt,false,{...defaultAppearance,...d});p.group.name=d.id;const glb=await new GLTFExporter().parseAsync(p.group,{binary:true,onlyVisible:true});results.push({id:d.id,bytes:Array.from(new Uint8Array(glb))});p.group.position.set((i%8-3.5)*1.4,(2-Math.floor(i/8))*2.55,0);s.add(p.group);}r.render(s,cam);return results;};window.ready=true;
</script></html>`;
writeFileSync(`${out}/references/index.html`,html);
const server=await createServer({configFile:false,root:process.cwd(),server:{host:'127.0.0.1',port:0}});let browser;
try{await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1050}});const origin=`http://127.0.0.1:${server.httpServer.address().port}`;await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());await page.goto(origin+'/art/blender/generated/character-revamp-v1/references/index.html');await page.waitForFunction(()=>window.ready);const results=await page.evaluate(defs=>window.run(defs),defs);for(const result of results)writeFileSync(`${out}/references/${result.id}.glb`,Buffer.from(result.bytes));await page.screenshot({path:`${out}/references/original-lineup.png`});console.log(`Exported ${results.length} full original avatars and ${roles.length} source call sites`);}finally{await browser?.close();await server.close();}
