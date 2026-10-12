import { appPromise } from 'virtual:aperture/browser-entry';
const canvas=document.querySelector('#aperture');
let app;
const ready=appPromise.then(async a=>{app=a;await a.ready;});
globalThis.__AGENT_BENCHMARK__={
 engine:'aperture',canvas,ready,
 async setCamera(c){
  await ready;
  const info=await app.request('camera_look_at',{key:'camera.main',translation:c.position,lookAt:c.target});
  for(const [field,value] of [['fovYRadians',c.fovYDegrees*Math.PI/180],['near',c.near],['far',c.far]]){
   const r=await app.requestRaw('ecs_set_component_field',{entity:info.entity,component:'aperture.render.camera',field,value});
   if(!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  }
 },
 async renderFrame(f){await ready;await app.renderFrame({deltaSeconds:f.deltaSeconds,timeSeconds:f.timeSeconds});},
 async inspectGeometry(){
  await ready;
  const g=app.inspectRenderedGeometry({maxBytes:96*1024*1024,maxMeshes:4096,maxVertices:2000000,maxIndices:6000000,maxDraws:10000,maxInstances:100000});
  if(g.status!=='complete')throw new Error('Geometry inspection incomplete: '+JSON.stringify(g.omissions));
  const map=new Map(g.meshes.map(m=>[m.key,m]));
  const out=[];
  for(let k=0;k<g.draws.length;k++){
   const d=g.draws[k],m=map.get(d.meshKey);
   let indices;
   if(d.indexed){indices=new Uint32Array(d.indexCount);for(let i=0;i<indices.length;i++)indices[i]=m.indices[d.firstIndex+i]+d.baseVertex;}
   else {indices=new Uint32Array(d.vertexCount);for(let i=0;i<indices.length;i++)indices[i]=d.firstVertex+i;}
   const matrices=[];for(let i=0;i<d.instances.length;i++)matrices.push(new Float32Array(d.worldMatrices.slice(i*16,i*16+16)));
   out.push({id:m.key+':draw'+k,positions:new Float32Array(m.positions),normals:m.normals?new Float32Array(m.normals):undefined,indices,worldMatrix:matrices[0]??new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),instances:matrices});
  }
  return {meshes:out};
 },
 async dispose(){await ready;await app.dispose();}
};
