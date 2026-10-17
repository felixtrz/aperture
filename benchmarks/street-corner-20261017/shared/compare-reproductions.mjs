import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {readPngImage} from '../../../test/e2e/png.ts';
const root=path.resolve(import.meta.dirname,'..');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const evidence=[];
for(const framework of ['aperture','vgpu','three']){
 const result=await read(path.join(root,'authors',framework,'result.json'));
 const originalBytes=await fs.readFile(path.join(root,'evidence',framework,result.finalCaptureLabel,'render.png'));
 const original=readPngImage(originalBytes);
 const dir=path.join(root,'evidence/reproductions',framework);
 for(const entry of await fs.readdir(dir)){
  const out=path.join(dir,entry);const proof=await read(path.join(out,'report.json'));
  const bytes=await fs.readFile(path.join(out,'render.png'));const actual=readPngImage(bytes);
  assert.equal(actual.width,original.width);assert.equal(actual.height,original.height);
  const sums=[0,0,0];let maximum=0,changedPixels=0;
  for(let p=0;p<actual.width*actual.height;p++){
   let changed=false;
   for(let c=0;c<3;c++){const d=Math.abs(actual.pixels[p*actual.bytesPerPixel+c]-original.pixels[p*original.bytesPerPixel+c]);sums[c]+=d;maximum=Math.max(maximum,d);changed ||=d!==0;}
   if(changed)changedPixels++;
  }
  const row={framework,report:path.relative(root,path.join(out,'report.json')),status:proof.status,native:proof.proof.native,webglAttempts:proof.proof.webglAttempts,errors:proof.errors,gpuErrors:proof.proof.errors,deviceLost:proof.proof.deviceLost,browserVersion:proof.browserVersion,pixelExact:changedPixels===0,meanAbsoluteChannelDifference:sums.map(v=>v/(actual.width*actual.height)),maximumChannelDifference:maximum,changedPixels,originalPngSha256:hash(originalBytes),reproducedPngSha256:hash(bytes),timings:proof.timings};
  assert(row.status==='passed'&&row.native&&row.webglAttempts===0&&row.errors.length===0&&row.gpuErrors.length===0&&row.deviceLost.length===0);
  evidence.push(row);
 }
}
await fs.writeFile(path.join(root,'evidence/reproducibility.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
