import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createApertureRenderSession} from '../../../packages/cli/dist/render/driver.js';
import {renderHarnessHtml} from '../../../packages/cli/dist/render/harness.js';
import {resolveEnginePackages} from '../../../packages/cli/dist/render/resolve-engine-packages.js';
import {startApertureStaticServer} from '../../../packages/cli/dist/render/static-server.js';
import {runVerifiedScene} from '../../../scripts/verified-webgpu.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
const fixture=import.meta.dirname;
const out=process.env.APERTURE_MEASURE_OUT??fixture;
await fs.mkdir(out,{recursive:true});
const width=1200,height=900;
const mode=process.argv[2];
const repetitions=Number(process.argv[3]??3);
const bundlePath=process.env.APERTURE_MEASURE_BUNDLE??path.join(fixture,'garden.bundle.json');
const bundle=JSON.parse(await fs.readFile(bundlePath,'utf8'));
if(!process.env.APERTURE_MEASURE_BUNDLE) assert(bundle.renderTarget.ssao, 'AO must survive bundle export');
const summaries=[];
if(mode==='native') {
  for(let i=1;i<=repetitions;i++) {
    const t=performance.now();
    const session=await createApertureRenderSession({backend:'dawn',adapter:'software'});
    const initialized=performance.now();
    try {
      const result=await session.render({bundle,width,height,timeoutMs:120000});
      const completed=performance.now();
      const summary={kind:'cold',repetition:i,initializeSessionMs:initialized-t,renderAndIpcMs:completed-initialized,timeToPngMs:completed-t,metadata:result.metadata};
      summaries.push(summary);
      await fs.writeFile(path.join(out,`dawn-cold-${i}.png`),result.png);
      await fs.writeFile(path.join(out,`dawn-cold-${i}.json`),JSON.stringify(summary,null,2));
      console.log(JSON.stringify({kind:summary.kind,repetition:i,timeToPngMs:summary.timeToPngMs,cpuTimings:result.metadata.cpuTimings}));
      if(i===repetitions) for(let j=1;j<=3;j++) {
        const wt=performance.now();
        const warm=await session.render({bundle,width,height,timeoutMs:120000});
        const ws={kind:'warm',repetition:j,timeToPngMs:performance.now()-wt,metadata:warm.metadata};
        summaries.push(ws);
        await fs.writeFile(path.join(out,`dawn-warm-${j}.png`),warm.png);
        await fs.writeFile(path.join(out,`dawn-warm-${j}.json`),JSON.stringify(ws,null,2));
        console.log(JSON.stringify({kind:ws.kind,repetition:j,timeToPngMs:ws.timeToPngMs,cpuTimings:warm.metadata.cpuTimings}));
      }
    } finally {await session.dispose();}
  }
} else {
  assert(process.env.APERTURE_TMP_RUN,'Use runtime-pressure wrapper');
  const engine=resolveEnginePackages();
  const generated=mode==='generated';
  const server=await startApertureStaticServer(generated?{
    mounts:[{prefix:'/',dir:path.join(fixture,'garden/dist')}],index:await fs.readFile(path.join(fixture,'garden/dist/index.html'),'utf8')
  }:{mounts:[...engine.mounts,{prefix:'/_harness/',dir:path.join(root,'packages/cli/assets/render-harness')}],index:()=>renderHarnessHtml(engine.importMap,{width,height})});
  try {
    for(let i=1;i<=repetitions;i++) {
      const report=await runVerifiedScene({runtimeRoot:process.env.APERTURE_WEBGPU_RUNTIME,scratchRoot:process.env.APERTURE_TMP_RUN,url:server.url+'/',outputPath:path.join(out,`${mode}-${i}.json`),screenshotPath:path.join(out,`${mode}-${i}.png`),viewport:{width,height},timeout:120000,...(generated?{captureTime:0}:{bundlePath})});
      summaries.push({kind:mode,repetition:i,timings:report.timings,sceneStatus:report.sceneStatus,proof:report.proof,capture:report.capture});
      console.log(JSON.stringify({mode,repetition:i,timings:report.timings,phases:report.sceneStatus.timings}));
    }
  } finally {await server.close();}
}
await fs.writeFile(path.join(out,`${mode}-summary.json`),JSON.stringify(summaries,null,2));
