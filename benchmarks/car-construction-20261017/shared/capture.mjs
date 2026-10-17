import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startApertureStaticServer} from '../../../packages/cli/dist/render/static-server.js';
import {runVerifiedScene} from '../../../scripts/verified-webgpu.mjs';
const root=path.resolve(import.meta.dirname,'..'),repo=path.resolve(root,'../..');
const [variant,label,mode]=process.argv.slice(2);
assert(['before','after','street','three','rear','side'].includes(variant));assert(/^[a-z0-9-]+$/.test(label));
const app=path.join(root,'apps',variant),out=path.join(root,'evidence',variant,label);
const run=(command,args,env=process.env)=>new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd:repo,env,stdio:'inherit'});p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(`${command} exited ${c}`)));});
if(mode!=='--inside'){
 await fs.mkdir(path.dirname(out),{recursive:true});await fs.mkdir(out);
 await fs.cp(app,path.join(out,'source'),{recursive:true,filter:p=>!p.split(path.sep).some(x=>['dist','.aperture','node_modules'].includes(x))});
 await fs.cp(path.join(repo,'examples/procedural-car/src'),path.join(out,'recipe-source'),{recursive:true});
 const start=performance.now();
 await run(process.execPath,[path.join(repo,'node_modules/vite/bin/vite.js'),'build',app,'--config',path.join(app,'vite.config.mjs'),'--outDir',path.join(app,'dist'),'--emptyOutDir']);
 const built=performance.now();
 await run('python3',['-B','tools/recovery/runtime_pressure.py','--root','/workspace/shared/aperture-tmp','--audit-dir',path.join(root,'evidence/audits'),'run','--job',`car-${variant}-${label}`,'--recreation','Rebuild retained car-construction scene','--',process.execPath,import.meta.filename,variant,label,'--inside'],{...process.env,APERTURE_WEBGPU_RUNTIME:path.join(repo,'.aperture-env/render-runtime')});
 await fs.writeFile(path.join(out,'timing.json'),JSON.stringify({variant,label,buildMs:built-start,renderAndCleanupMs:performance.now()-built},null,2));
}else{
 assert(process.env.APERTURE_TMP_RUN);
 const server=await startApertureStaticServer({mounts:[{prefix:'/',dir:path.join(app,'dist')}],index:await fs.readFile(path.join(app,'dist/index.html'),'utf8')});
 try{
  const report=await runVerifiedScene({runtimeRoot:path.join(repo,'.aperture-env/render-runtime'),scratchRoot:process.env.APERTURE_TMP_RUN,url:server.url+'/',outputPath:path.join(out,'report.json'),screenshotPath:path.join(out,'render.png'),viewport:{width:1200,height:900},timeout:120000,...(variant==='three'?{}:{captureTime:0})});
  assert.equal(report.status,'passed');
 }finally{await server.close();}
}
