const scope=globalThis as any;
window.addEventListener('error', e=>{scope.__APERTURE_RENDER_STATUS__={ok:false,error:String(e.error||e.message)}});
window.addEventListener('unhandledrejection', e=>{scope.__APERTURE_RENDER_STATUS__={ok:false,error:String(e.reason)}});
async function ready(){
 const s=scope.__APERTURE_GENERATED_APP__;
 if(s?.status==='worker-error'||s?.status==='webgpu-failed'){scope.__APERTURE_RENDER_STATUS__={ok:false,error:s.lastError};return;}
 const d=s?.__apertureRenderDiagnostics?.getDiagnostics({detail:'status'})??s?.diagnostics;
 if(d?.lastError){scope.__APERTURE_RENDER_STATUS__={ok:false,error:d.lastError};return;}
 if(s?.snapshots>0 && d?.lastFrame?.ok && d.lastFrame.counts.meshDraws>0){
  await scope.__APERTURE_WAIT_GPU__?.();
  scope.__APERTURE_RENDER_STATUS__={ok:true,frame:d.lastFrame.frame};return;
 }
 requestAnimationFrame(ready);
}
requestAnimationFrame(ready);
