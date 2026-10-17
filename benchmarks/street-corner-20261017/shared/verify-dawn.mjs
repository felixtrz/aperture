import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {readPngImage} from '../../../test/e2e/png.ts';

const root=path.resolve(import.meta.dirname,'..'), repo=path.resolve(root,'../..');
const result=JSON.parse(await fs.readFile(path.join(root,'authors/aperture/result.json'),'utf8'));
assert(result.finishedAt,'Freeze the author trial before supplementary validation');
const out=path.join(root,'evidence/dawn-verification');
await fs.mkdir(out); // Retain the first validation; never silently overwrite it.
const app=path.join(out,'app');
await fs.cp(path.join(root,'evidence/aperture',result.finalCaptureLabel,'source'),app,{recursive:true,filter:p=>!p.split(path.sep).some(x=>['dist','node_modules','.aperture'].includes(x))});
await fs.writeFile(path.join(app,'aperture.headless.config.ts'),"import original from './aperture.config.ts';\nexport default {...original,mode:'headless'};\n");
const cli=path.join(repo,'packages/cli/dist/bin/aperture.js');
const run=async (args,label,env=process.env)=>{
 const started=performance.now();
 const stdout=await fs.open(path.join(out,`${label}.json`),'w'),stderr=await fs.open(path.join(out,`${label}.stderr.log`),'w');
 try {
  await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[cli,...args],{cwd:repo,env,stdio:['ignore',stdout.fd,stderr.fd]});p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(`${label} exited ${code}; inspect retained logs`)));});
 } finally {await stdout.close();await stderr.close();}
 return performance.now()-started;
};
const bundle=path.join(out,'scene.bundle.json');
const extractionMs=await run(['headless',path.join(app,'aperture.headless.config.ts'),'--out',bundle,'--render-width','1200','--render-height','900','--asset-mode','strict','--json'],'extraction');
const renderMs=await run(['render',bundle,'--backend','dawn','--adapter','software','--out',path.join(out,'render.png'),'--json'],'render',{
 ...process.env,VK_ICD_FILENAMES:path.join(repo,'.aperture-env/dawn-runtime/vk_swiftshader_icd.json'),LD_LIBRARY_PATH:path.join(repo,'.aperture-env/dawn-runtime')+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'')
});
const a=readPngImage(await fs.readFile(path.join(root,'evidence/aperture',result.finalCaptureLabel,'render.png'))),b=readPngImage(await fs.readFile(path.join(out,'render.png')));
assert(a.width===b.width&&a.height===b.height,'Dimensions changed');
let sum=0,maximum=0,changedPixels=0;
for(let p=0;p<a.width*a.height;p++){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(a.pixels[p*a.bytesPerPixel+c]-b.pixels[p*b.bytesPerPixel+c]);sum+=d;maximum=Math.max(maximum,d);changed ||=d!==0;}if(changed)changedPixels++;}
const metadata=JSON.parse(await fs.readFile(path.join(out,'render.json'),'utf8'));
assert(metadata.ok&&metadata.diagnostics.renderer.backend==='dawn');
const summary={recordedAt:new Date().toISOString(),purpose:'Supplementary frozen-scene Dawn compatibility check, excluded from author time, capture budget and visual judging. Not a speed benchmark.',extractionMs,renderCommandMs:renderMs,pixelExact:changedPixels===0,changedPixels,meanAbsoluteRgbDifference:sum/(a.width*a.height*3),maximumChannelDifference:maximum,backend:metadata.diagnostics.renderer.backend};
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
