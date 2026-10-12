import { appPromise } from "virtual:aperture/browser-entry";
const canvas=document.getElementById("aperture");
let app;
const ready=appPromise.then(async a=>{app=a;await a.ready;});
globalThis.__AGENT_BENCHMARK__={
 engine:"aperture",canvas,ready,
 async setCamera(c){
  await ready;
  await app.request("camera_look_at",{key:"camera.main",translation:c.position,lookAt:c.target},{timeoutMilliseconds:1800000});
  for(const [field,value] of [["fovYRadians",c.fovYDegrees*Math.PI/180],["near",c.near],["far",c.far]]) {
   const r=await app.requestRaw("ecs_set_component_field",{key:"camera.main",component:"aperture.render.camera",field,value},{timeoutMilliseconds:1800000});
   if(!r.ok)throw new Error(JSON.stringify(r.diagnostics));
  }
 },
 async renderFrame(f){await ready;await app.renderFrame({deltaSeconds:f.deltaSeconds,timeSeconds:f.timeSeconds,timeoutMilliseconds:1800000});},
 async inspectGeometry(){
  await ready;
  const g=app.inspectRenderedGeometry({maxBytes:128*1024*1024,maxMeshes:4096,maxVertices:2000000,maxIndices:6000000,maxDraws:10000,maxInstances:100000});
  if(g.status!=="complete")throw new Error("Geometry inspection: "+JSON.stringify(g.omissions));
  const byKey=new Map(g.meshes.map(m=>[m.key,m]));
  return {meshes:g.draws.map((d,i)=>{
   const m=byKey.get(d.meshKey), matrices=[];
   for(let j=0;j<d.worldMatrices.length;j+=16)matrices.push(d.worldMatrices.slice(j,j+16));
   const out={id:d.meshKey+"-draw-"+i,positions:m.positions.slice(),worldMatrix:matrices[0].slice()};
   if(m.normals)out.normals=m.normals.slice();
   if(d.indexed){
    const src=m.indices.subarray(d.firstIndex,d.firstIndex+d.indexCount);
    out.indices=d.baseVertex===0?src.slice():Uint32Array.from(src,v=>v+d.baseVertex);
   }else if(d.firstVertex!==0||d.vertexCount!==m.positions.length/3){
    out.positions=m.positions.slice(d.firstVertex*3,(d.firstVertex+d.vertexCount)*3);
    if(m.normals)out.normals=m.normals.slice(d.firstVertex*3,(d.firstVertex+d.vertexCount)*3);
   }
   if(matrices.length>1)out.instances=matrices;
   return out;
  })};
 },
 async dispose(){await ready;await app.dispose();}
};
