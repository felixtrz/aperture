import {startGeneratedBrowserApp} from '@aperture-engine/app/browser';
import config from './config.js';
const canvas=document.querySelector('canvas');
const app=await startGeneratedBrowserApp({config,workerEntry:new Worker(new URL('./worker.js',import.meta.url),{type:'module'})});
globalThis.__AGENT_BENCHMARK__={
 engine:'aperture',canvas,ready:app.ready,
 async setCamera(c){
  await app.request('camera_look_at',{key:'camera.main',translation:c.position,lookAt:c.target});
  for(const [field,value] of [['fovYRadians',c.fovYDegrees*Math.PI/180],['near',c.near],['far',c.far]]){
   const r=await app.requestRaw('ecs_set_component_field',{key:'camera.main',component:'aperture.render.camera',field,value});
   if(!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  }
 },
 async renderFrame(f){await app.renderFrame({deltaSeconds:f.deltaSeconds,timeSeconds:f.timeSeconds});},
 async inspectGeometry(){
  const g=app.inspectRenderedGeometry({maxBytes:64*1024*1024,maxVertices:2000000,maxIndices:6000000,maxInstances:100000,maxMeshes:4096,maxDraws:10000});
  if(g.status!=='complete')throw new Error('Geometry inspection incomplete: '+JSON.stringify(g.omissions));
  const byKey=new Map(g.meshes.map(m=>[m.key,m]));
  const meshes=[];
  for(let i=0;i<g.draws.length;i++){
   const d=g.draws[i],m=byKey.get(d.meshKey);
   let indices;
   if(d.indexed){indices=new Uint32Array(d.indexCount);for(let j=0;j<indices.length;j++)indices[j]=m.indices[d.firstIndex+j]+d.baseVertex;}
   else {indices=new Uint32Array(d.vertexCount);for(let j=0;j<indices.length;j++)indices[j]=d.firstVertex+j;}
   const instances=[];
   for(let j=0;j<d.worldMatrices.length;j+=16)instances.push(new Float32Array(d.worldMatrices.slice(j,j+16)));
   meshes.push({id:'submitted-'+i,positions:new Float32Array(m.positions),normals:m.normals?new Float32Array(m.normals):undefined,indices,worldMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],instances});
  }
  return {meshes};
 },
 async dispose(){await app.dispose();}
};
app.ready.catch(e=>{console.error(e);document.body.dataset.error=String(e);});
