import { startGeneratedBrowserApp } from '@aperture-engine/app/browser';
import config from '../aperture.config.ts';
const canvas=document.createElement('canvas'); canvas.id='aperture'; canvas.width=1024;canvas.height=768;canvas.style.width='1024px';canvas.style.height='768px';document.body.append(canvas);
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
let geometryResolve;const geometryReady=new Promise(r=>geometryResolve=r);
worker.addEventListener('message',e=>{if(e.data?.type==='authored-geometry')geometryResolve(e.data.meshes);});
const appPromise=startGeneratedBrowserApp({config,workerEntry:worker});
const ready=appPromise.then(async app=>{await app.ready;await geometryReady;});
globalThis.__AGENT_BENCHMARK__={
 engine:'aperture',canvas,ready,
 async setCamera(c){await ready;const app=await appPromise;await app.request('camera_look_at',{key:'camera.main',translation:c.position,lookAt:c.target});for(const [field,value] of [['fovYRadians',c.fovYDegrees*Math.PI/180],['near',c.near],['far',c.far]]){const r=await app.requestRaw('ecs_set_component_field',{key:'camera.main',component:'aperture.render.camera',field,value});if(!r.ok)throw new Error(JSON.stringify(r.diagnostics));}},
 async renderFrame(f){await ready;await (await appPromise).renderFrame({deltaSeconds:f.deltaSeconds,timeSeconds:f.timeSeconds});},
 async inspectGeometry(){await ready;return {meshes:await geometryReady};},
 async dispose(){await (await appPromise).dispose();}
};
