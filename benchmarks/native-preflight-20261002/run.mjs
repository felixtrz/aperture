import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {runVerifiedScene} from "../../scripts/verified-webgpu.mjs";
const dir=dirname(fileURLToPath(import.meta.url));
const repo=resolve(dir,"../..");
const out=resolve(dir,"attempt-001");await mkdir(out,{recursive:true});
const routes=new Map([
["/scene.mjs",[resolve(dir,"scene.mjs"),"text/javascript"]],
["/three.webgpu.js",[resolve(repo,"shadow-lab/src/compare/three.webgpu.js"),"text/javascript"]],
["/three.core.js",[resolve(repo,"shadow-lab/src/compare/three.core.js"),"text/javascript"]]
]);
const server=createServer(async(req,res)=>{
res.setHeader("Cross-Origin-Opener-Policy","same-origin");res.setHeader("Cross-Origin-Embedder-Policy","require-corp");
if(req.url==="/favicon.ico"){res.writeHead(204);res.end();return}
if(req.url==="/"){res.setHeader("Content-Type","text/html");res.end('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body><script type="module" src="/scene.mjs"></script></body></html>');return}
const entry=routes.get(req.url);
if(!entry){res.writeHead(404);res.end("Not found");return}
try{res.setHeader("Content-Type",entry[1]);res.end(await readFile(entry[0]));}catch{res.writeHead(500);res.end("Read error")}
});
await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok)});
try{
const r=await runVerifiedScene({runtimeRoot:process.env.APERTURE_WEBGPU_RUNTIME,scratchRoot:process.env.APERTURE_TMP_RUN,url:`http://127.0.0.1:${server.address().port}/`,outputPath:resolve(out,"result.json"),screenshotPath:resolve(out,"render.png"),readyGlobal:"__BENCHMARK_NATIVE_READY__",viewport:{width:800,height:800}});
console.log(JSON.stringify({status:r.status,scene:r.sceneStatus,proof:r.proof}));
}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok))}
