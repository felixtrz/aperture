import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createExamplesRequestHandler} from '../../../scripts/serve-examples.mjs';
import {runVerifiedScene} from '../../../scripts/verified-webgpu.mjs';
const base=dirname(fileURLToPath(import.meta.url)),repo=resolve(base,'../../..'),source=resolve(repo,'benchmarks/crane-wall-continuity-20261003/sources/a-continuous-front-quarter'),harness=resolve(base,'../harness'),out=resolve(base,'attempt-001');
if(!process.env.APERTURE_TMP_RUN||!process.env.APERTURE_WEBGPU_RUNTIME)throw Error('Adopted lifecycle required');
await mkdir(out,{recursive:false});
const html=(await readFile(resolve(source,'index.html'),'utf8')).replace('src="./main.mjs"','src="/probe.mjs"');
if(!html.includes('src="/probe.mjs"'))throw Error('Expected immutable bootstrap not found');
await writeFile(resolve(out,'served-index.html'),html,{flag:'wx'});
const files=[...(await readdir(source)).map(n=>resolve(source,n)),...['client.mjs','checks.mjs','contract.mjs'].map(n=>resolve(harness,n)),resolve(base,'probe.mjs'),resolve(base,'run.mjs')];
const hash=b=>createHash('sha256').update(b).digest('hex');
async function pins(){return Object.fromEntries(await Promise.all(files.map(async p=>[p,hash(await readFile(p))])));}
const before=await pins();await writeFile(resolve(out,'pins.before.json'),JSON.stringify(before,null,2));
const fallback=createExamplesRequestHandler(repo);
const server=createServer(async(req,res)=>{
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cache-Control','no-store');
 try {
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='POST'&&['/metadata','/canvas-png'].includes(path)){
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024)throw Error('Payload too large');chunks.push(chunk);}const bytes=Buffer.concat(chunks);
   await writeFile(resolve(out,path==='/metadata'?'metadata.json':'canvas.png'),bytes,{flag:'wx'});res.end(JSON.stringify({ok:true,bytes:size,sha256:hash(bytes)}));return;
  }
  if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(path==='/scene/index.html'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  let target;
  if(path==='/probe.mjs')target=resolve(base,'probe.mjs');
  else if(/^\/harness\/(client|checks|contract)\.mjs$/.test(path))target=resolve(harness,path.split('/').pop());
  else if(/^\/scene\/[a-zA-Z0-9_-]+\.mjs$/.test(path))target=resolve(source,path.split('/').pop());
  else if(['/packages/','/node_modules/','/worker-modules/'].some(p=>path.startsWith(p)))return fallback(req,res);
  else{res.writeHead(404);res.end('Not found');return;}
  res.setHeader('Content-Type','text/javascript');res.end(await readFile(target));
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
try{const r=await runVerifiedScene({runtimeRoot:process.env.APERTURE_WEBGPU_RUNTIME,scratchRoot:process.env.APERTURE_TMP_RUN,url:`http://127.0.0.1:${server.address().port}/scene/index.html`,outputPath:resolve(out,'result.json'),screenshotPath:resolve(out,'page.png'),readyGlobal:'__LIVE_CAPTURE_PREFLIGHT__',viewport:{width:1024,height:1024},timeout:120000});console.log(JSON.stringify({status:r.status,proof:r.proof,scene:r.sceneStatus}));}
finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));const after=await pins();await writeFile(resolve(out,'pins.after.json'),JSON.stringify(after,null,2));if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Inputs changed during preflight');}
