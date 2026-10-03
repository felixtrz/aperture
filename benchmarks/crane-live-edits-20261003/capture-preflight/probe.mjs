import { installLiveEditTracking } from '/harness/client.mjs';
const tracking=installLiveEditTracking();
try {
 await import('/scene/main.mjs');
 const deadline=performance.now()+90000;
 while(!globalThis.__CRANE_READY__){if(performance.now()>deadline)throw Error('Frozen scene readiness timed out');await new Promise(requestAnimationFrame);}
 if(!globalThis.__CRANE_READY__.ok)throw Error('Frozen scene failed');
 const proof=await globalThis.__APERTURE_WAIT_GPU__();
 const canvas=document.querySelector('canvas');
 const metadata={scope:'capture infrastructure preflight; not an author attempt',proof,tracking:tracking.snapshot(),width:canvas.width,height:canvas.height,method:'GPU fence, acknowledged metadata POST, then canvas.toBlob'};
 const meta=await fetch('/metadata',{method:'POST',body:JSON.stringify(metadata)});if(!meta.ok)throw Error('Metadata not retained');
 const png=await new Promise((ok,fail)=>canvas.toBlob(blob=>blob&&blob.type==='image/png'?ok(blob):fail(Error('Canvas extraction failed')),'image/png'));
 const saved=await fetch('/canvas-png',{method:'POST',body:png});if(!saved.ok)throw Error('PNG not retained');
 globalThis.__LIVE_CAPTURE_PREFLIGHT__={ok:true,proof,tracking:tracking.snapshot(),pngBytes:png.size};
}catch(e){globalThis.__LIVE_CAPTURE_PREFLIGHT__={ok:false,error:String(e.stack??e)};console.error(e);}
