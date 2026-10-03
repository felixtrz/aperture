import { startGeneratedBrowserApp } from '/worker-modules/packages/app/dist/browser.js';
import { CONFIG, CAMERAS, EDITS } from './scene.mjs';
const query=new URLSearchParams(location.search),view=query.get('view')??'front-quarter',edit=query.get('edit')??'baseline';
if(!Object.hasOwn(CAMERAS,view)||!Object.hasOwn(EDITS,edit))throw Error('Invalid crane view/edit');
window.__CRANE_PROGRESS__={phase:'boot',view,edit};
window.addEventListener('error',event=>{window.__CRANE_PROGRESS__={phase:'error',message:event.message,view,edit};});
window.addEventListener('unhandledrejection',event=>{window.__CRANE_PROGRESS__={phase:'error',message:String(event.reason?.stack??event.reason),view,edit};});
try{
 const app=await startGeneratedBrowserApp({config:CONFIG,workerEntry:new URL('./worker.mjs',import.meta.url),workerStartOptions:{craneView:view,craneEdit:edit},workerFactory:(url,options)=>{
  const worker=new Worker(url,options);
  worker.addEventListener('message',event=>{if(event.data?.type==='crane-geometry'){window.__CRANE_GEOMETRY__=event.data;window.__CRANE_PROGRESS__={phase:'geometry-published',view,edit,parts:event.data.nativeMeshes.length};}});
  return worker;
 }});
 window.__CRANE_APP__=app;
 if(!app.webgpu.ok)throw Error(`Native WebGPU initialization failed: ${JSON.stringify(app.webgpu)}`);
 app.worker.onSnapshot(event=>{window.__CRANE_SNAPSHOT__={frame:event.frame,snapshot:event.snapshot};});
 function verifySubmittedFrame(){
  const diagnostics=app.webgpu.app.getDiagnostics({detail:'full'}),frame=diagnostics.lastFrame,canvas=document.querySelector('#scene');
  window.__CRANE_DIAGNOSTICS__=diagnostics;
  const submitted=frame?.ok===true&&frame.counts?.drawCalls>0&&frame.renderTargets?.some(target=>target.source==='swapchain'&&target.ok&&target.drawCalls>0&&target.width===1024&&target.height===1024);
  if(submitted&&window.__CRANE_GEOMETRY__){
   // lastFrame is populated after native submission; another animation frame
   // ensures the browser has had its presentation opportunity before readiness.
   requestAnimationFrame(()=>{window.__CRANE_READY__={ok:true,width:canvas.width,height:canvas.height,dimensions:[canvas.width,canvas.height],engine:'Aperture',backend:'native-webgpu',view,edit,frame:frame.frame,sceneState:{parameters:window.__CRANE_GEOMETRY__.scene.parameters,partCount:window.__CRANE_GEOMETRY__.nativeMeshes.length},nativeSubmittedFrame:frame};window.__CRANE_PROGRESS__={phase:'ready',view,edit};});
  }else if(diagnostics.lastError){window.__CRANE_PROGRESS__={phase:'error',view,edit,error:diagnostics.lastError};}
  else requestAnimationFrame(verifySubmittedFrame);
 }
 requestAnimationFrame(verifySubmittedFrame);
}catch(error){window.__CRANE_PROGRESS__={phase:'error',message:String(error.stack??error),view,edit};console.error(error);}
