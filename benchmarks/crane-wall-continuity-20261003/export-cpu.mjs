import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const base=dirname(fileURLToPath(import.meta.url)),repo=resolve(base,'../..');
const cases=JSON.parse(await readFile(resolve(base,'cases.json'),'utf8'));
await mkdir(resolve(base,'cpu'),{recursive:true});
for(const c of cases){
 const file=resolve(base,'sources',c.id,c.engine==='a'?'scene.mjs':'scene-data.mjs');
 let source=await readFile(file,'utf8');
 source=source.replace("'/worker-modules/packages/render/dist/index.js'",JSON.stringify(pathToFileURL(resolve(repo,'packages/render/dist/index.js')).href));
 source=source.replace("'/three.core.js'",JSON.stringify(pathToFileURL(resolve(repo,'shadow-lab/src/compare/three.core.js')).href));
 const module=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const data=c.engine==='a'?module.constructScene(c.edit):module.buildScene(c.edit);
 await writeFile(resolve(base,'cpu',c.id+'.json'),JSON.stringify(data,(_k,v)=>ArrayBuffer.isView(v)?Array.from(v):v,null,2)+'\n');
 console.log(JSON.stringify({case:c.id,parts:(data.parts??data.meshes).length}));
}
