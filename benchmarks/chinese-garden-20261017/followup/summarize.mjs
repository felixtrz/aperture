import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readPngImage} from '../../../test/e2e/png.ts';
const dir=import.meta.dirname;
const read=async file=>JSON.parse(await fs.readFile(`${dir}/${file}`,'utf8'));
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const stats=values=>({samples:values,median:median(values),min:Math.min(...values),max:Math.max(...values)});
const native=await read('optimized/native-summary.json');
const browser=await read('optimized/browser-summary.json');
const generated=await read('generated-summary.json');
const codec=await read('codec-bench.json');
const noAo=await read('no-ao/native-summary.json');
const profile=await read('gpu-phase-profile.json');
const summary={resolution:[1200,900],renderer:'SwiftShader Vulkan',samplesPerCondition:3,codec:{before:stats(codec.before),after:stats(codec.after),identical:codec.identical},native:{},browserBundle:{total:stats(browser.map(x=>x.timings.totalMs)),assetRestore:stats(browser.map(x=>x.sceneStatus.timings.restoreAssetsMs)),navigation:stats(browser.map(x=>x.timings.navigationMs))},generated:{total:stats(generated.map(x=>x.timings.totalMs)),frameCapture:stats(generated.map(x=>x.timings.frameCaptureMs)),stable:generated.every(x=>x.capture.presentationStable),submissions:generated.map(x=>x.proof.submissions),draws:generated.map(x=>x.proof.draws)},noAoWarm:stats(noAo.filter(x=>x.kind==='warm').map(x=>x.timeToPngMs)),gpuProfile:{environmentWait:stats(profile.map(x=>x.environmentGpuWaitMs)),frameWait:stats(profile.map(x=>x.frameGpuWaitMs))}};
for(const kind of ['cold','warm']) {const samples=native.filter(x=>x.kind===kind);summary.native[kind]={timeToPng:stats(samples.map(x=>x.timeToPngMs)),phases:Object.fromEntries(['prepareAndRenderMs','gpuCompletionMs','readbackMs','pngMs'].map(key=>[key,stats(samples.map(x=>x.metadata.cpuTimings[key]))])),assetRestore:stats(samples.map(x=>x.metadata.cpuTimings.portable.restoreAssetsMs))};}
const baseline=readPngImage(await fs.readFile(`${dir}/../diagnostics/outlines/fixed/render.png`));
const comparisons=[];
for(const file of ['generated-1.png','generated-2.png','generated-3.png',...Array.from({length:3},(_,i)=>`optimized/browser-${i+1}.png`),...Array.from({length:3},(_,i)=>`optimized/dawn-cold-${i+1}.png`),...Array.from({length:3},(_,i)=>`optimized/dawn-warm-${i+1}.png`),...Array.from({length:3},(_,i)=>`profile-${i+1}.png`)]) {
 const actual=readPngImage(await fs.readFile(`${dir}/${file}`));assert.equal(actual.width,baseline.width);assert.equal(actual.height,baseline.height);
 let max=0,total=0,changed=0;
 for(let p=0;p<baseline.width*baseline.height;p++){let diff=false;for(let c=0;c<3;c++){let d=Math.abs(actual.pixels[p*actual.bytesPerPixel+c]-baseline.pixels[p*baseline.bytesPerPixel+c]);max=Math.max(max,d);total+=d;diff ||= d!==0;}if(diff)changed++;}
 comparisons.push({file,max,mean:total/(baseline.width*baseline.height*3),changedPixels:changed});
}
summary.parity={tolerance:{mean:0.5,max:12},comparisons,passed:comparisons.every(x=>x.mean<=0.5&&x.max<=12)};
await fs.writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2));
assert(summary.parity.passed);
console.log(JSON.stringify(summary,null,2));
