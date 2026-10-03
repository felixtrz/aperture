import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createExamplesRequestHandler} from '../../scripts/serve-examples.mjs';
import {runVerifiedScene} from '../../scripts/verified-webgpu.mjs';
const base=dirname(fileURLToPath(import.meta.url)),repo=resolve(base,'../..');
const cases=JSON.parse(await readFile(resolve(base,'cases.json'),'utf8'));
const c=cases.find(c=>c.id===process.argv[2]);if(!c)throw Error('Unknown case');
const out=resolve(base,'renders',c.id);await mkdir(out,{recursive:false});
const source=resolve(repo,c.source),fallback=createExamplesRequestHandler(repo);
const server=createServer(async(req,res)=>{
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 if(pathname.startsWith('/packages/')||pathname.startsWith('/node_modules/')||pathname.startsWith('/worker-modules/'))return fallback(req,res);
 const m=pathname.match(/^\/scene\/([a-zA-Z0-9._-]+)$/);
 if(!m||m[1].includes('..')){res.writeHead(404);res.end('Not found');return;}
 const target=resolve(source,m[1]);
 try{const bytes=await readFile(target);res.setHeader('Content-Type',target.endsWith('.html')?'text/html':target.endsWith('.json')?'application/json':target.endsWith('.wgsl')?'text/plain':'text/javascript');res.end(bytes);}
 catch{res.writeHead(404);res.end('Missing source');}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
try{
 const report=await runVerifiedScene({runtimeRoot:process.env.APERTURE_WEBGPU_RUNTIME,scratchRoot:process.env.APERTURE_TMP_RUN,url:`http://127.0.0.1:${server.address().port}/scene/index.html?${c.query}`,outputPath:resolve(out,'result.json'),screenshotPath:resolve(out,'render.png'),readyGlobal:c.ready,viewport:{width:800,height:800},timeout:240000});
 console.log(JSON.stringify({case:c.id,status:report.status,proof:report.proof}));
}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));}
