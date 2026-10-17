import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readPngImage} from '../../../test/e2e/png.ts';
const root=path.resolve(import.meta.dirname,'../evidence');
const comparisons=[];
for(const dir of ['after/final','street/initial']){
 const a=readPngImage(fs.readFileSync(`${root}/${dir}/render.png`));
 const b=readPngImage(fs.readFileSync(`${root}/${dir}/dawn.png`));
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 let channels=0,pixels=0,max=0,sum=0;
 for(let i=0;i<a.width*a.height;i++){
  let changed=false;
  for(let c=0;c<4;c++){
   const x=c<a.bytesPerPixel?a.pixels[i*a.bytesPerPixel+c]:255;
   const y=c<b.bytesPerPixel?b.pixels[i*b.bytesPerPixel+c]:255;
   const d=Math.abs(x-y);if(d){channels++;changed=true;}max=Math.max(max,d);sum+=d;
  }
  if(changed)pixels++;
 }
 const dawn=JSON.parse(fs.readFileSync(`${root}/${dir}/dawn.json`));
 const headless=JSON.parse(fs.readFileSync(`${root}/${dir}/headless.json`));
 comparisons.push({scene:dir,width:a.width,height:a.height,differentPixels:pixels,differentChannels:channels,maxChannelDifference:max,meanAbsoluteChannelDifference:sum/(a.width*a.height*4),exact:pixels===0,dawnBackend:dawn.diagnostics.renderer.backend,dawnAdapter:dawn.diagnostics.renderer.dawn.adapterInfo.description,meshDraws:headless.lastSnapshot.counts.meshDraws,placeholders:headless.assets.placeholders.count,diagnostics:dawn.diagnostics.renderer.diagnostics});
}
const captures=[];
for(const dir of ['before/final','after/final','three/reference','street/initial','rear/final','side/final']){
 const p=JSON.parse(fs.readFileSync(`${root}/${dir}/report.json`));assert.equal(p.status,'passed');captures.push({scene:dir,status:p.status});
}
const report={comparisons,captures,tests:{files:8,passed:141,seed:1792221580524},scope:'Implementation follow-up, not a new timed authoring benchmark; original scores unchanged.'};
fs.writeFileSync(`${root}/validation.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
assert(comparisons.every(c=>c.exact&&c.placeholders===0&&c.diagnostics.length===0));
