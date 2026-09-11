/** Lossless EXT_meshopt_compression with byte-for-byte verification of every stream. */
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';

await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const file=fileURLToPath(new URL('../../public/assets/models/environment/LM_ENV_Petronas.glb',import.meta.url));
const raw=await fs.readFile(file),jsonSize=raw.readUInt32LE(12);
const doc=JSON.parse(raw.subarray(20,20+jsonSize));
if(doc.extensionsRequired?.includes('EXT_meshopt_compression'))throw new Error('Already compressed; run the Blender web export first.');
const bin=raw.subarray(28+jsonSize);
const pieces=[];let offset=0,fallbackOffset=0,streams=0;
const append=data=>{const start=offset;pieces.push(Buffer.from(data));offset+=data.length;const padding=(4-offset%4)%4;if(padding){pieces.push(Buffer.alloc(padding));offset+=padding;}return start;};
const widths={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
for(let i=0;i<doc.bufferViews.length;i++){
  const view=doc.bufferViews[i],source=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  const accessor=doc.accessors.find(a=>a.bufferView===i);
  if(!accessor || ![34962,34963].includes(view.target)){
    view.buffer=0;view.byteOffset=append(source);continue;
  }
  const stride=view.byteStride??widths[accessor.componentType]*components[accessor.type];
  const count=view.byteLength/stride,mode=view.target===34963?'INDICES':'ATTRIBUTES';
  if(!Number.isInteger(count))throw new Error(`Non-integral stream ${i}`);
  const compressed=MeshoptEncoder.encodeGltfBuffer(source,count,stride,mode,0);
  const decoded=new Uint8Array(source.length);MeshoptDecoder.decodeGltfBuffer(decoded,count,stride,compressed,mode);
  if(!source.equals(Buffer.from(decoded)))throw new Error(`Compression round trip failed for stream ${i}`);
  view.extensions={...view.extensions,EXT_meshopt_compression:{buffer:0,byteOffset:append(compressed),byteLength:compressed.length,byteStride:stride,count,mode,filter:'NONE'}};
  view.buffer=1;view.byteOffset=fallbackOffset;fallbackOffset+=view.byteLength;fallbackOffset=(fallbackOffset+3)&~3;
  streams++;
}
doc.extensionsUsed=[...new Set([...(doc.extensionsUsed||[]),'EXT_meshopt_compression'])];
doc.extensionsRequired=[...new Set([...(doc.extensionsRequired||[]),'EXT_meshopt_compression'])];
doc.buffers=[{byteLength:offset},{byteLength:fallbackOffset,extensions:{EXT_meshopt_compression:{fallback:true}}}];
const encoded=Buffer.from(JSON.stringify(doc));const json=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,0x20)]);
const binary=Buffer.concat(pieces),header=Buffer.alloc(20),binaryHeader=Buffer.alloc(8);
header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
binaryHeader.writeUInt32LE(binary.length);binaryHeader.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,json,binaryHeader,binary]);await fs.writeFile(file,output);
const report={inputBytes:raw.length,outputBytes:output.length,compressedStreams:streams,losslessRoundTrip:'PASS',reductionPercent:Number(((1-output.length/raw.length)*100).toFixed(1))};
await fs.writeFile(new URL('../../assets/petronas/web-compression.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(report);
