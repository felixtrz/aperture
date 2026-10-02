import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,dirname,basename} from "node:path";
import {fileURLToPath} from "node:url";
import {createExamplesRequestHandler} from "../../scripts/serve-examples.mjs";
import {runVerifiedScene} from "../../scripts/verified-webgpu.mjs";
const base=dirname(fileURLToPath(import.meta.url)),repo=resolve(base,"../..");
const [engine,attempt,view="front",edit="base"]=process.argv.slice(2);
if(!["a","b"].includes(engine)||!/^attempt-[0-9]{3}$/.test(attempt))throw Error("Invalid immutable attempt");
const out=resolve(base,"renders",engine,attempt);await mkdir(out,{recursive:true});
const fallback=createExamplesRequestHandler(repo);
const server=createServer(async(req,res)=>{
res.setHeader("Cross-Origin-Opener-Policy","same-origin");res.setHeader("Cross-Origin-Embedder-Policy","require-corp");
const pathname=new URL(req.url,"http://127.0.0.1").pathname;
if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return}
if(pathname.startsWith("/packages/")||pathname.startsWith("/node_modules/")||pathname.startsWith("/worker-modules/"))return fallback(req,res);
let target;
if(["three.webgpu.js","three.core.js"].includes(basename(pathname)))target=resolve(repo,"shadow-lab/src/compare",basename(pathname));
else{
const m=pathname.match(/^\/(a|b)\/([a-zA-Z0-9._-]+)$/);
if(!m||m[2].includes("..")){res.writeHead(404);res.end("Not found");return}
target=resolve(base,"sources",m[1]+"-v1",m[2]);
}
try{const bytes=await readFile(target);res.setHeader("Content-Type",target.endsWith(".html")?"text/html":target.endsWith(".json")?"application/json":"text/javascript");res.end(bytes)}
catch{res.writeHead(404);res.end("Missing immutable source")}
});
await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok)});
try{
const report=await runVerifiedScene({runtimeRoot:process.env.APERTURE_WEBGPU_RUNTIME,scratchRoot:process.env.APERTURE_TMP_RUN,url:`http://127.0.0.1:${server.address().port}/${engine}/index.html?view=${view}&edit=${edit}`,outputPath:resolve(out,"result.json"),screenshotPath:resolve(out,"render.png"),readyGlobal:"__COTTAGE_READY__",viewport:{width:800,height:800},timeout:240000});
console.log(JSON.stringify({status:report.status,proof:report.proof,scene:report.sceneStatus}));
}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok))}
