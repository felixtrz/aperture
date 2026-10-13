import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {executeUploadScopeSmoke} from "./browser.mjs";
import {installNativeObserverV2} from "/workspace/aperture/tools/agent-benchmark/native-observer-v2.mjs";
import {rewriteRetainedSegmentsV2} from "/workspace/aperture/tools/agent-benchmark/upload-segments-v2.mjs";
import {createIndirectArgumentTrackerV2} from "/workspace/aperture/tools/agent-benchmark/indirect-args-v2.mjs";
import {validateTriangleArgumentProofV2} from "/workspace/aperture/tools/agent-benchmark/triangle-accounting-v2.mjs";
import {ARTIFACT_PROTOCOL_V2} from "/workspace/aperture/tools/agent-benchmark/protocol-v2.mjs";
import {verifyLifecycle} from "/workspace/aperture/tools/agent-benchmark/run.mjs";
import {sha256,writeImmutable,inspectPng} from "/workspace/aperture/tools/agent-benchmark/recorder.mjs";
import {runVerifiedScene} from "/workspace/aperture/scripts/verified-webgpu.mjs";

const schema="aperture.native-upload-scope-smoke.v1";
const options=Object.fromEntries(process.argv.slice(2).reduce((pairs,value,index,array)=>index%2?pairs:[...pairs,[value,array[index+1]]],[]));
const planPath=resolve(options["--plan"]), planBytes=await readFile(planPath), plan=JSON.parse(planBytes);
assert.equal(sha256(planBytes),options["--plan-sha256"]);
assert.equal(plan.schema,schema);
assert.equal(resolve(options["--output"]),plan.outputRoot);
assert.equal(fileURLToPath(import.meta.url),plan.runner);
async function checkPins() {
  for(const input of [...plan.sourcePins,...plan.resolvedInterruptionReceipts]) {
    const raw=await readFile(input.path);
    assert.equal(raw.length,input.bytes,input.path);assert.equal(sha256(raw),input.sha256,input.path);
  }
}
await checkPins();
const authorityBytes=await readFile(resolve(options["--authorization"])), authority=JSON.parse(authorityBytes);
assert.equal(sha256(authorityBytes),options["--authorization-sha256"]);
assert.equal(authority.schema,"aperture.native-upload-scope-smoke-authorization.v1");
assert.equal(authority.status,"authorized");assert.equal(authority.authorizedBy,"/root");
assert.equal(authority.planSha256,options["--plan-sha256"]);
assert.deepEqual(authority.resolvedInterruptionReceipts,plan.resolvedInterruptionReceipts);
const lifecycle=await verifyLifecycle();
assert.equal(lifecycle.root,plan.scratchRoot);
const output=plan.outputRoot;
assert(!output.startsWith(lifecycle.root+"/"));
await mkdir(output);await mkdir(resolve(output,"sources"));
for(const [index,input] of plan.sourcePins.entries()) await writeImmutable(resolve(output,"sources",`${index}.bin`),await readFile(input.path));
const limits={argumentWitnesses:ARTIFACT_PROTOCOL_V2.triangleAccounting.maxWitnesses,bytes:ARTIFACT_PROTOCOL_V2.limits.nativeBytes,buffers:ARTIFACT_PROTOCOL_V2.limits.nativeBuffers,segments:ARTIFACT_PROTOCOL_V2.limits.nativeSegments,perBuffer:ARTIFACT_PROTOCOL_V2.limits.nativeSegmentsPerBuffer};
assert.deepEqual(limits,plan.captureLimits);
const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><script>(${installNativeObserverV2.toString()})(${rewriteRetainedSegmentsV2.toString()},${JSON.stringify(limits)},${createIndirectArgumentTrackerV2.toString()});</script></head><body style="margin:0"><canvas id="proof" width="1024" height="768"></canvas><script type="module">(${executeUploadScopeSmoke.toString()})();</script></body></html>`;
await writeImmutable(resolve(output,"scene.html"),html);
await writeImmutable(resolve(output,"inputs.json"),JSON.stringify({schema,lifecycle:{root:lifecycle.root,run:lifecycle.run},plan:{path:planPath,bytes:planBytes.length,sha256:sha256(planBytes)},authorization:{path:resolve(options["--authorization"]),bytes:authorityBytes.length,sha256:sha256(authorityBytes)},sourcePins:plan.sourcePins,resolvedInterruptionReceipts:plan.resolvedInterruptionReceipts,captureLimits:limits,htmlSha256:sha256(Buffer.from(html))},null,2)+"\n");
const server=createServer((request,response)=>{
  const host=request.headers.host,expected=`127.0.0.1:${server.address().port}`;
  if(request.method!=="GET"||request.url!=="/"||host!==expected||(request.headers.origin&&request.headers.origin!==`http://${expected}`)) {response.writeHead(403);response.end();return;}
  response.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});response.end(html);
});
let report;
try {
  await new Promise((yes,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",yes);});
  report=await runVerifiedScene({runtimeRoot:lifecycle.runtimeRoot,scratchRoot:lifecycle.scratch,url:`http://127.0.0.1:${server.address().port}/`,outputPath:resolve(output,"verified-runner.json"),screenshotPath:resolve(output,"native-canvas.png"),readyGlobal:"__NATIVE_UPLOAD_SCOPE_SMOKE__",viewport:{width:1024,height:768},timeout:120000});
  const data=report.sceneStatus;
  await writeImmutable(resolve(output,"native-results.json"),JSON.stringify(data,null,2)+"\n");
  assert.equal(data.ok,true);assert.equal(data.samples.length,3);
  validateTriangleArgumentProofV2(data);
  assert.equal(data.workload.uniformBuffers*data.workload.disjointWritesPerBuffer,12000);
  assert(12000>limits.segments);
  const capture=data.observations.find(row=>row.phase==="before-geometry-seal").native.geometryCapture;
  assert.equal(capture.retainedBytes,92);assert.equal(capture.retainedSegments,3);
  assert.deepEqual(capture.incompleteBufferIds,[]);assert.equal(capture.skippedWrites,0);assert.equal(capture.omittedBufferRecords,0);
  assert.equal(capture.limitBytes,limits.bytes);assert.equal(capture.segmentLimit,limits.segments);assert.equal(capture.segmentLimitPerBuffer,limits.perBuffer);
  assert.equal(data.sealedBuffers.length,2);
  for(const source of data.sources) {
    const actual=data.sealedBuffers.find(record=>record.label===source.label);
    assert(actual);assert.equal(source.sourceByteOffset,4);assert.equal(actual.usage,source.usage);
    assert.deepEqual(actual.segments,[{offset:0,bytes:source.bytes}]);assert.equal(actual.requestedBytes,36);assert.equal(actual.captureTruncated,false);
  }
  for(const [index,sample] of data.samples.entries()) {
    assert.equal(sample.submissions,1);assert.equal(sample.drawCalls,2);assert.equal(sample.knownIndirectDrawCalls,2);assert.equal(sample.unknownIndirectDrawCalls,0);
    assert.equal(sample.submittedTriangles,[4,4,6][index]);assert.equal(sample.knownIndirectTriangles,[4,4,6][index]);
    assert.equal(sample.nativeIndirectArgumentReferences.length,1);assert.equal(sample.nativeIndirectArgumentReferences[0][1],2);
  }
  assert.equal(data.nativeIndirectArgumentProof.witnesses.length,2);
  assert.equal(data.nativeIndirectArgumentProof.witnesses[0].argumentBytesHex,"0300000002000000000000000000000000000000");
  assert.equal(data.nativeIndirectArgumentProof.witnesses[1].argumentBytesHex,"0300000003000000000000000000000000000000");
  const after=data.observations.at(-1).native;
  assert.equal(after.buffersCreated,16);assert.equal(after.buffersDestroyed,16);assert.equal(after.liveRequestedBufferBytes,0);
  const png=await readFile(resolve(output,"native-canvas.png"));inspectPng(png,{width:1024,height:768});
  await checkPins();
  await writeImmutable(resolve(output,"validation.json"),JSON.stringify({schema,status:"passed",scores:null,nativeUploadVertexBytes:72,nativeIndexUploadByteWitness:false,preSealRetainedBytes:92,preSealRetainedSegments:3,submittedTriangles:[4,4,6],uniformDisjointWritesFromExactFrozenWorkload:12000,sourceAndPositionByteParity:true,indirectBeforeAndAfterSealProof:true,ownedBuffersDestroyed:16,sourcePinsUnchanged:true,scope:"Actual native observer repair smoke; not an engine comparison, benchmark rerun or whole-scene ECS proof"},null,2)+"\n");
} catch(error) {
  if(!report) {try {report=JSON.parse(await readFile(resolve(output,"verified-runner.json")));} catch {}}
  if(report?.sceneStatus) {try {await writeImmutable(resolve(output,"native-partial-results.json"),JSON.stringify(report.sceneStatus,null,2)+"\n");} catch {}}
  await writeImmutable(resolve(output,"failure.json"),JSON.stringify({schema,status:"failed",scores:null,error:{name:error.name,message:error.message,stack:error.stack}},null,2)+"\n");
  throw error;
} finally {
  await new Promise(done=>server.close(done));
}
