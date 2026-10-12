import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {createApertureHeadlessRunner} from '@aperture-engine/app/headless';
import {disposeApertureApp} from '@aperture-engine/app/advanced';
import {defineApertureConfig} from '@aperture-engine/app/config';
import {validateMaterialAsset,validateTextureAsset} from '@aperture-engine/render';
import {createMaterialHandle,createTextureHandle,createMeshHandle} from '@aperture-engine/simulation';
const input=await fs.readFile('src/systems/house.system.ts','utf8');
const js=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
await fs.writeFile('verify-house.generated.mjs',js);
const {default:Scene}=await import('./verify-house.generated.mjs');
const runner=await createApertureHeadlessRunner({config:defineApertureConfig({mode:'headless',render:{defaultCamera:false,defaultLight:false,defaultEnvironment:true}}),systems:[{default:Scene}]});
try{
 const result=runner.step(0,0);
 const status=result.status;
 console.log("Snapshot keys",Object.keys(result.snapshot));
 console.log("Extraction diagnostics",JSON.stringify(result.snapshot.diagnostics,null,2));
 console.log(JSON.stringify({counts:status.lastSnapshot?.counts,diagnostics:status.diagnostics},null,2));
 const registry=runner.app.context.assetsRegistry;
 const names=[...input.matchAll(/([A-Za-z][A-Za-z0-9]*):\["#/g)].map(m=>m[1]);
 let invalid=[];
 const hash=createHash('sha256');let vertexBytes=0,vertexCount=0;
 for(const name of names){
  const asset=registry.get(createMeshHandle('scene.'+name+'.geometry'))?.asset;
  if(!asset)throw new Error('Missing geometry '+name);
  hash.update(name);
  for(const stream of asset.vertexStreams){
   hash.update(new Uint8Array(stream.data.buffer,stream.data.byteOffset,stream.data.byteLength));
   vertexBytes+=stream.data.byteLength;
   if(stream.attributes.some(a=>a.semantic==='POSITION'))vertexCount+=stream.vertexCount;
  }
 }
 console.log('SOURCE_DIGEST',hash.digest('hex'),'VERTICES',vertexCount,'VERTEX_BYTES',vertexBytes);
 for(const name of names){
  const entry=registry.get(createMaterialHandle('scene.'+name+'.pbr'));
  if(entry?.asset){const r=validateMaterialAsset(entry.asset);if(!r.valid)invalid.push({name,r});}
 }
 for(const kind of ['stucco','stone','asphalt','lawn','tile'])for(const variant of ['color','normal']){
  const name='scene.'+kind+'.'+variant;
  const entry=registry.get(createTextureHandle(name));
  if(entry?.asset){const r=validateTextureAsset(entry.asset);if(!r.valid)invalid.push({name,r});if(!entry.asset.sourceData)invalid.push({name,error:'No texture source data'});}
 }
 console.log(JSON.stringify({materialNames:names.length,invalid},null,2));
 if(invalid.length)process.exitCode=1;
}finally{await disposeApertureApp(runner.app);}
