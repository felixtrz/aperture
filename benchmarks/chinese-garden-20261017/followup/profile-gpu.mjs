import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createNodeDevice,createOffscreenOutput} from '../../../packages/adapter-node/dist/index.js';
import {AssetRegistry} from '../../../packages/simulation/dist/index.js';
import {decodeTypedArrayTree,renderSnapshotFromJsonValue} from '../../../packages/render/dist/index.js';
import {mirrorSourceAssetRegistryFromMessage} from '../../../packages/app/dist/asset-mirror.js';
import {createWebGpuApp,createWebGpuSsaoPostEffect,createWebGpuBloomPostEffect,firstSnapshotEnvironmentHandle,environmentAssetInputsFromRegistry,prepareWebGpuAppEnvironmentAssets} from '../../../packages/webgpu/dist/index.js';
import {encodeRenderPng} from '../../../packages/cli/dist/render/png.js';
const dir=import.meta.dirname;
const bundle=JSON.parse(await fs.readFile(`${dir}/garden.bundle.json`,'utf8'));
const native=await createNodeDevice({adapter:'software'});
const samples=[];
try {
for(let repetition=1;repetition<=3;repetition++) {
  const assets=new AssetRegistry();
  mirrorSourceAssetRegistryFromMessage(assets,{sourceAssets:decodeTypedArrayTree({entries:bundle.assets.entries})});
  const snapshot=renderSnapshotFromJsonValue(bundle.snapshot.value);
  const target=bundle.renderTarget;
  const output=createOffscreenOutput(native.device,{width:1200,height:900});
  let app;
  try {
    const created=await createWebGpuApp({deviceContext:native,output,sourceAssets:assets,autoStart:false,msaaSampleCount:target.sampleCount,tonemap:target.toneMapping,exposure:target.exposure,postEffects:[createWebGpuSsaoPostEffect(target.ssao),createWebGpuBloomPostEffect(target.bloom)]});
    assert(created.ok); app=created.app;
    const before=performance.now();
    const prepared=prepareWebGpuAppEnvironmentAssets({app,assets:environmentAssetInputsFromRegistry(assets),activeHandle:firstSnapshotEnvironmentHandle(snapshot)});
    assert(prepared.active.ready);
    const preparedAt=performance.now();
    await native.device.queue.onSubmittedWorkDone();
    const environmentAt=performance.now();
    const report=await app.renderSnapshot(snapshot,{standardMaterialIblResources:prepared.active.standardMaterialIblResources});
    assert(report.ok);
    const submitted=performance.now();
    await native.device.queue.onSubmittedWorkDone();
    const rendered=performance.now();
    const rgba=await output.readRgba();
    const read=performance.now();
    const png=encodeRenderPng(1200,900,rgba);
    const timings={repetition,environmentCpuMs:preparedAt-before,environmentGpuWaitMs:environmentAt-preparedAt,frameCpuMs:submitted-environmentAt,frameGpuWaitMs:rendered-submitted,readbackMs:read-rendered,pngMs:performance.now()-read};
    samples.push(timings); console.log(JSON.stringify(timings));
    await fs.writeFile(`${dir}/profile-${repetition}.png`,png);
  } finally {await app?.dispose();await output.dispose();}
}
}finally{await native.dispose();await fs.writeFile(`${dir}/gpu-phase-profile.json`,JSON.stringify(samples,null,2));}
