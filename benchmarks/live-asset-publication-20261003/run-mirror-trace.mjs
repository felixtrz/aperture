/** CPU diagnosis: real generated worker loop and native MessagePort; no GPU. */
import {readFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const realPerformance=globalThis.performance;
if(process.argv.includes('--fixed-clock')) globalThis.performance={now:()=>0};
const testingV1=process.argv.includes('--v1');
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),here=resolve(repo,'benchmarks/crane-live-edits-20261003/author-a/post-author-byte-diagnostic');
const moduleUrl=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const engine=s=>s.replaceAll("'/worker-modules/",`'${pathToFileURL(repo).href}/`);
const sceneUrl=moduleUrl(engine(await readFile(resolve(here,'scene.mjs'),'utf8')));
const nativeUrl=moduleUrl(await readFile(resolve(here,'native-evidence.mjs'),'utf8'));
const contractUrl=pathToFileURL(resolve(repo,'benchmarks/crane-live-edits-20261003/harness/contract.mjs')).href;
const sourceDir=process.argv.includes('--v1')?resolve(here,'../v1'):here;
const systemUrl=moduleUrl(engine(await readFile(resolve(sourceDir,'scene-system.mjs'),'utf8')).replaceAll("'./scene.mjs'",`'${sceneUrl}'`).replaceAll("'./native-evidence.mjs'",`'${nativeUrl}'`).replaceAll("'/harness/contract.mjs'",`'${contractUrl}'`));
const system=await import(systemUrl),{CONFIG}=await import(sceneUrl),{STATES}=await import(contractUrl);
const imp=p=>import(pathToFileURL(resolve(repo,p)).href);
const {runGeneratedWorkerLoop}=await imp('packages/app/dist/worker/loop.js');
const {createGeneratedEntityToolBridge}=await imp('packages/app/dist/devtools/entities.js');
const {createApertureDevtoolsRequest}=await imp('packages/app/dist/commands.js');
const {disposeApertureApp}=await imp('packages/app/dist/advanced.js');
const channels=[],NativeMessageChannel=globalThis.MessageChannel;
globalThis.MessageChannel=class extends NativeMessageChannel{constructor(){super();channels.push(this);}};
const {AssetRegistry,createMeshHandle}=await imp('packages/simulation/dist/index.js');
const {mirrorSourceAssetRegistryFromMessage}=await imp('packages/app/dist/asset-mirror.js');
const mainRegistry=new AssetRegistry(),mirrorReports=[];
const channel=new MessageChannel(),messages=[],pending=new Map();
channel.port1.addEventListener('message',({data})=>{messages.push(data); if(data.sourceAssets){const report=mirrorSourceAssetRegistryFromMessage(mainRegistry,data);mirrorReports.push({frame:data.frame,report,entries:data.sourceAssets.entries.filter(e=>e.handle.kind==='mesh').map(e=>({id:e.handle.id,sent:e.version,mirrored:mainRegistry.get(createMeshHandle(e.handle.id))?.version,kind:e.asset.kind,patchBytes:e.asset.vertexStreams?.reduce((s,x)=>s+(x.updates?.reduce((n,u)=>n+u.data.byteLength,0)??x.data.byteLength),0)}))});} if(data.type==='aperture.devtools.response'){pending.get(data.requestId)?.(data);pending.delete(data.requestId);}});channel.port1.start();
const observedPort={
  postMessage(message,transfer){let outgoing=message;if(system.sceneOwner?.revision>0&&message.type==='aperture.simulation.snapshot') outgoing={...message,craneLive:system.sceneOwner.evidenceAtNativePublication(message.frame,message.snapshot)}; channel.port2.postMessage(outgoing,transfer??[]);},
  addEventListener:(...a)=>channel.port2.addEventListener(...a),removeEventListener:(...a)=>channel.port2.removeEventListener(...a),start:()=>channel.port2.start()
};
const {createWebGpuAppSnapshotTransport,createWebGpuAppSnapshotTransportStartPayload}=await imp('packages/webgpu/dist/app/app-snapshot-transport.js');
const transport=process.argv.includes('--shared')?createWebGpuAppSnapshotTransportStartPayload(createWebGpuAppSnapshotTransport({mode:'shared-array-buffer'})):null;
let app,bridge;
const results={syntheticTransportTest:true,realGeneratedWorkerLoop:true,realMessagePort:true,shared:!!transport,fixedClock:process.argv.includes('--fixed-clock'),renderer:false,source:sourceDir,states:[],mirrorReports};
try{
  await runGeneratedWorkerLoop({port:observedPort,config:CONFIG,systems:[{default:system.CraneCourtyard}],start:{simulationPaused:true,sharedSnapshotMessageRateHz:testingV1?1000:240,sourceAssetsMessageRateHz:testingV1?1000:240,...(testingV1?{}:{workerFullSummaryIntervalMilliseconds:16}),...(transport?{transport}:{})},pendingInput:[],createEntityTools:createGeneratedEntityToolBridge,setApp(a,_entityTools,d){app=a;bridge=d;}});
  if(process.argv.includes('--shared')) { const requestId='boot-step';const done=new Promise(resolve=>pending.set(requestId,resolve));bridge.handle(createApertureDevtoolsRequest({requestId,tool:'ecs_step',payload:{delta:1/60}}));await done;}
  for(const state of STATES){
    app.context.commands.queue(system.LIVE_CHANNEL,{id:state.id,index:state.index,revision:state.index+1});
    const requestId=`crane-live-${state.index+1}`;
    const response=new Promise(resolve=>pending.set(requestId,resolve));
    bridge.handle(createApertureDevtoolsRequest({requestId,tool:'ecs_step',payload:{delta:1/60,...(testingV1?{}:{time:(state.index+1)/60})}}));
    const ack=await response;
    const snapshot=messages.findLast(m=>m.type==='aperture.simulation.snapshot');
    const entry={id:state.id,ack:ack.ok,frame:snapshot?.frame,snapshotFrame:snapshot?.snapshot?.frame,revision:snapshot?.craneLive?.revision,stateId:snapshot?.craneLive?.stateId,checks:snapshot?.craneLive?.nativeChecks?.ok};
    entry.ok=entry.ack&&entry.frame===entry.snapshotFrame&&entry.revision===state.index+1&&entry.stateId===state.id&&entry.checks;results.states.push(entry); if(state.index===1){const id='crane.boom.lower.mesh',handle=createMeshHandle(id),source=app.lowLevel.assets.get(handle),mirrored=mainRegistry.get(handle); const a=source.asset.vertexStreams[0].data,b=mirrored.asset.vertexStreams[0].data; results.shoulderComparison={sourceVersion:source.version,mirrorVersion:mirrored.version,bytesEqual:Buffer.from(a.buffer,a.byteOffset,a.byteLength).equals(Buffer.from(b.buffer,b.byteOffset,b.byteLength))};if(!results.shoulderComparison.bytesEqual)throw Error('Real crane worker mesh differs from delivered mirror');}
    if(!entry.ok)throw Error(`Publication failed: ${JSON.stringify(entry)}`);
    const mirrorMismatches=[];
    for(const [name,meshEntry] of system.sceneOwner.entries){const handle=meshEntry.handle,source=app.lowLevel.assets.get(handle),mirrored=mainRegistry.get(handle); const equal=(a,b)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).equals(Buffer.from(b.buffer,b.byteOffset,b.byteLength));if(!mirrored||source.version!==mirrored.version||source.asset.vertexStreams.some((v,i)=>!equal(v.data,mirrored.asset.vertexStreams[i].data))||(source.asset.indexBuffer&&!equal(source.asset.indexBuffer.data,mirrored.asset.indexBuffer.data)))mirrorMismatches.push(name);}
    entry.mirror={checked:system.sceneOwner.entries.size,mismatches:mirrorMismatches};
    if(mirrorMismatches.length)throw Error(`Source/mirror mismatch at ${state.id}: ${mirrorMismatches.join(', ')}`);
  }
  results.ok=true;
}catch(error){results.ok=false;results.error=String(error.stack??error);process.exitCode=1;}
finally{if(app)await disposeApertureApp(app);for(const c of channels){c.port1.close();c.port2.close();}globalThis.MessageChannel=NativeMessageChannel;globalThis.performance=realPerformance;results.disposed=true;}
console.log(JSON.stringify(results,null,2));
