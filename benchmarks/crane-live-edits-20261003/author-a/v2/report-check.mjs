/** CPU diagnosis: real generated worker loop and native MessagePort; no GPU. */
import {readFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../../');
const moduleUrl=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const engine=s=>s.replaceAll("'/worker-modules/",`'${pathToFileURL(repo).href}/`);
const sceneUrl=moduleUrl(engine(await readFile(resolve(here,'scene.mjs'),'utf8')));
const nativeUrl=moduleUrl(await readFile(resolve(here,'native-evidence.mjs'),'utf8'));
const contractUrl=pathToFileURL(resolve(repo,'benchmarks/crane-live-edits-20261003/harness/contract.mjs')).href;
const sourceDir=process.argv.includes('--v1')?resolve(here,'../v1'):here;
const systemUrl=moduleUrl(engine(await readFile(resolve(sourceDir,'scene-system.mjs'),'utf8')).replaceAll("'./scene.mjs'",`'${sceneUrl}'`).replaceAll("'./native-evidence.mjs'",`'${nativeUrl}'`).replaceAll("'/harness/contract.mjs'",`'${contractUrl}'`));
const system=await import(systemUrl),{CONFIG}=await import(sceneUrl),{STATES}=await import(contractUrl);
const imp=p=>import(pathToFileURL(resolve(repo,p)).href);

const {createApertureApp,disposeApertureApp}=await imp('packages/app/dist/advanced.js');
const {createWebGpuApp,createWebGpuBloomPostEffect,webGpuAppRenderReportToJsonValue}=await imp('packages/webgpu/dist/index.js');
const {transpileModule,ModuleKind,ScriptTarget}=await import('typescript');
const testSource=await readFile(resolve(repo,'test/webgpu/webgpu-app.test.ts'),'utf8');
const harnessSource=testSource.slice(testSource.indexOf('function webGpuHarness('),testSource.indexOf('function createReadyStandardIblFrameResources('));
const harnessModule=await import(moduleUrl(transpileModule(harnessSource+'\nexport {webGpuHarness};\nfunction bufferLabel(buffer){return buffer?.descriptor?.label??"unlabeled";}\n',{compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText));
const {inspectFrameCorrespondence,inspectConsumedSnapshot}=await import('./frame-proof.mjs');
const events=[],{canvas,environment}=harnessModule.webGpuHarness(events);canvas.width=1024;canvas.height=1024;
let app,renderer;const results={syntheticDevice:true,realEngineReportLogic:true,nativeGpu:false};
try {
  app=await createApertureApp({config:CONFIG,systems:[{default:system.CraneCourtyard}]});
  const worker={start(){},onSnapshot(){return()=>{};},onError(){return()=>{};}};
  const created=await createWebGpuApp({canvas,environment,simulationWorker:worker,sourceAssets:app.lowLevel.assets,autoStart:false,msaaSampleCount:4,useFrameGraph:true,presentationCadence:'snapshot',tonemap:'agx',exposure:1,postEffects:[createWebGpuBloomPostEffect(CONFIG.render.bloom)]});
  if(!created.ok)throw Error(JSON.stringify(created));renderer=created.app;
  app.context.commands.queue(system.LIVE_CHANNEL,{id:STATES[0].id,index:0,revision:1});app.step(1/60,0);const snapshot=app.extract(0);
  const report=await renderer.renderSnapshot(snapshot,{frame:snapshot.frame});
  results.report=webGpuAppRenderReportToJsonValue(report);results.diagnostics=renderer.getDiagnostics({detail:'full'});results.nativePublication=system.sceneOwner.evidenceAtNativePublication(snapshot.frame,snapshot).snapshotFrame;
  const frame=results.diagnostics.lastFrame;
  results.originalV1ReadyGate=frame.ok&&frame.counts.drawCalls>0&&frame.renderTargets?.some(t=>t.source==='swapchain'&&t.ok&&t.drawCalls>0&&t.width===1024&&t.height===1024);
  const evidence=system.sceneOwner.evidenceAtNativePublication(snapshot.frame,snapshot);
  const actualSnapshot=JSON.parse(JSON.stringify(snapshot,(_k,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
  const publications=new Map([[snapshot.frame,evidence]]);
  const completion={frame:results.report,snapshot:actualSnapshot};
  results.v2FrameGate=inspectFrameCorrespondence(STATES[0],publications,completion);
  results.consumedChecks=inspectConsumedSnapshot(evidence.nativeGeometry.meshes,actualSnapshot);
  results.rejectMissingPublication=!inspectFrameCorrespondence(STATES[0],new Map(),completion).ok;
  results.rejectWrongRevision=!inspectFrameCorrespondence(STATES[1],publications,completion).ok;
  results.rejectWrongRenderedFrame=!inspectFrameCorrespondence(STATES[0],publications,{...completion,snapshot:{...actualSnapshot,frame:999}}).ok;
  results.ok=results.v2FrameGate.ok&&results.consumedChecks.every(c=>c.ok)&&results.rejectMissingPublication&&results.rejectWrongRevision&&results.rejectWrongRenderedFrame;
  if(!results.ok)process.exitCode=1;
} catch(error){results.ok=false;results.error=String(error.stack??error);process.exitCode=1;}
finally{if(renderer)await renderer.dispose();if(app)await disposeApertureApp(app);results.disposed=true;}
console.log(JSON.stringify(results,null,2));
