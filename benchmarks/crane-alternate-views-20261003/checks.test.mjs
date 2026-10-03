/** Synthetic gate fixtures, using retained geometry; never native alternate-view proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { repo, here } from './cpu-loader.mjs';
import { SESSION_IDS, statesFor, SCHEMA, VIEWS } from './contract.mjs';
import { expectedCamera, apertureCamera, validateCameraEvidence } from './camera-proof.mjs';
import { validateStateRecord, validateTransport } from './harness/checks.mjs';
import { createRecorder, inspectCanvasPng, crc32 } from './harness/recorder.mjs';
import { selection, sessionContract, resolveModule } from './run.mjs';
import { readAttempt } from './compare.mjs';
const old=resolve(repo,'benchmarks/crane-combined-edits-20261003/renders');
async function synthetic(engine,session) {
  const state=statesFor(session)[0];
  const record=JSON.parse(await readFile(resolve(old,engine,'fresh-'+state.edit,'attempt-001','states',`s00-fresh-${state.edit}.json`)));
  record.schema=SCHEMA;record.state=state;record.evidence.stateId=state.id;record.receipt.stateId=state.id;
  record.syntheticUnitFixture='CPU camera evidence mutation only, not a native alternate-view artifact';
  const e=record.evidence,r=record.receipt,expected=expectedCamera(engine,state.view);
  e.camera={...e.camera,name:state.view,position:[...VIEWS[state.view].position]};
  if(engine==='aperture') {
    const snapshot=e.nativeGeometry.actualSubmittedSnapshot,view=snapshot.views[0];
    for(const key of ['viewMatrix','projectionMatrix','viewProjectionMatrix'])snapshot.viewMatrices.splice(view[key+'Offset'],16,...expected[key]);
    e.camera.native=apertureCamera(snapshot);
  } else {
    const c=r.details.correspondence,native={...expected,cameraId:c.cameraId,up:[0,1,0]};
    e.camera.native=native;c.cameraBefore=structuredClone(native);c.cameraAfter=structuredClone(native);
  }
  return record;
}
test('all eight synthetic records pass the independently applied actual-camera, pose, frame and raw gates',async()=>{
  for(const engine of ['aperture','threejs'])for(const session of SESSION_IDS) {const r=await synthetic(engine,session);validateStateRecord(r,0,statesFor(session));}
});
test('wrong selected view, label-only front camera, wrong pose, matrix, clipping and frame proof fail closed',async()=>{
  for(const engine of ['aperture','threejs']) {
    const session='rear-quarter-all',valid=await synthetic(engine,session);
    const changes=[
      r=>r.evidence.camera.name='high-oblique',
      r=>r.evidence.camera.position=[8,6.5,10],
      r=>r.evidence.parameters.shoulder_deg=50,
      r=>r.evidence.camera.far=1000,
      r=>r.evidence.camera.native.viewMatrix[0]+=.1,
      r=>r.evidence.camera.native.projectionMatrix[0]+=.1,
      r=>r.evidence.camera.native.viewProjectionMatrix[0]+=.1,
      r=>r.receipt.workerRevision++,
      r=>r.receipt.nativeFrame=-1,
      r=>r.state.view='high-oblique',
    ];
    if(engine==='aperture') changes.push(r=>r.evidence.transport.active='transferable',r=>r.evidence.transport.fallback='transferable',r=>r.evidence.nativeGeometry.actualSubmittedSnapshot.frame++,r=>r.evidence.nativeGeometry.actualSubmittedSnapshot.views=[],r=>{
      const snapshot=r.evidence.nativeGeometry.actualSubmittedSnapshot,v=snapshot.views[0],front=expectedCamera(engine,'front-quarter');
      for(const key of ['viewMatrix','projectionMatrix','viewProjectionMatrix'])snapshot.viewMatrices.splice(v[key+'Offset'],16,...front[key]);
      r.evidence.camera.native=apertureCamera(snapshot);
    });
    else changes.push(r=>r.receipt.details.correspondence.cameraBefore.viewMatrix[0]+=.1,r=>r.receipt.details.correspondence.cameraAfter.cameraId++,r=>{const front={...r.evidence.camera.native,...expectedCamera(engine,'front-quarter'),name:'rear-quarter',position:[-8,5,-9]};r.evidence.camera.native=front;r.receipt.details.correspondence.cameraBefore=structuredClone(front);r.receipt.details.correspondence.cameraAfter=structuredClone(front);});
    for(const change of changes) {const bad=structuredClone(valid);change(bad);assert.throws(()=>validateStateRecord(bad,0,statesFor(session)));}
  }
});
test('missing/fallback transport and camera convention are rejected',()=>{
  for(const bad of [null,{}, {active:'shared-array-buffer',fallback:'transfer',sharedArrayBuffer:{supported:true}}, {active:'shared-array-buffer',fallback:null,sharedArrayBuffer:{supported:false}}])assert.throws(()=>validateTransport(bad));
});
test('cold session routing and immutable literal substitution are fail closed',async()=>{
  for(const session of SESSION_IDS)for(const engine of ['aperture','threejs'])assert.equal(selection(engine,session,'attempt-001').length,1);
  for(const args of [['bad','rear-quarter-all','attempt-001'],['aperture','live','attempt-001'],['threejs','rear-quarter-all','old']])assert.throws(()=>selection(...args));
  const source=await readFile(resolve(here,'harness/contract.mjs'),'utf8');
  for(const session of SESSION_IDS)assert(sessionContract(source,session).includes(JSON.stringify(session)));
  assert.throws(()=>sessionContract('',SESSION_IDS[0]));assert.throws(()=>resolveModule('/author-a/../contract.mjs'));
  assert.equal(resolveModule('/etc/passwd'),null);assert(resolveModule('/camera-proof.mjs').endsWith('/camera-proof.mjs'));
});
function chunk(name,data) {const type=Buffer.from(name),bytes=Buffer.alloc(data.length+12);bytes.writeUInt32BE(data.length);type.copy(bytes,4);data.copy(bytes,8);bytes.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return bytes;}
function blank(alpha=255) {const raw=Buffer.alloc(1024*4097);for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const i=y*4097+1+x*4;raw[i]=64;raw[i+1]=80;raw[i+2]=100;raw[i+3]=alpha;}const h=Buffer.alloc(13);h.writeUInt32BE(1024);h.writeUInt32BE(1024,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
test('blank, transparent, translucent, corrupt and missing canvas data are rejected',async()=>{
  const good=await readFile(resolve(old,'threejs','fresh-baseline','attempt-001/states/s00-fresh-baseline.png'));assert.equal(inspectCanvasPng(good).blankCheck,'passed');
  const corrupt=Buffer.from(good);corrupt[100]^=1;
  for(const bytes of [blank(),blank(0),blank(128),corrupt,Buffer.alloc(0)])assert.throws(()=>inspectCanvasPng(bytes));
});
test('independent immutable recorder rejects a wrong-view record and keeps its rejected bytes',async()=>{
  assert(process.env.APERTURE_TMP_RUN);const directory=await mkdtemp(resolve(process.env.APERTURE_TMP_RUN,'views-recorder-'));let passed=false;
  try {const states=statesFor('rear-quarter-all'),r=await createRecorder(directory,{engine:'threejs',states}),bad=await synthetic('threejs','rear-quarter-all');bad.evidence.camera.name='front-quarter';const bytes=Buffer.from(JSON.stringify(bad));await assert.rejects(()=>r.record(`states/${states[0].id}.json`,bytes,'application/json'),/camera/);await r.flush();assert.deepEqual(await readFile(resolve(directory,`states/${states[0].id}.json`)),bytes);assert.equal(r.summary().complete,false);passed=true;}finally{if(passed)await rm(directory,{recursive:true});}
});
test('all selected synthetic sessions complete immutable recorder acknowledgments; these are unit tests only',async()=>{
  assert(process.env.APERTURE_TMP_RUN);
  for(const engine of ['aperture','threejs'])for(const session of SESSION_IDS) {
    const directory=await mkdtemp(resolve(process.env.APERTURE_TMP_RUN,'views-accepted-'));let passed=false;
    try {
      const states=statesFor(session),record=await synthetic(engine,session),recorder=await createRecorder(directory,{engine,states}),receipts=[];
      const image=await readFile(resolve(old,engine,'fresh-'+states[0].edit,'attempt-001','states',`s00-fresh-${states[0].edit}.png`));
      receipts.push(await recorder.record(`states/${states[0].id}.json`,Buffer.from(JSON.stringify(record)),'application/json'));
      receipts.push(await recorder.record(`states/${states[0].id}.png`,image,'image/png'));
      await recorder.record('complete.json',Buffer.from(JSON.stringify({schema:SCHEMA,engine,states:1,artifacts:receipts,proof:record.proof})),'application/json');
      await recorder.flush();assert.equal(recorder.summary().complete,true);assert.equal(recorder.summary().acknowledged.length,3);
      await assert.rejects(()=>recorder.record(`states/${states[0].id}.png`,image,'image/png'),/already acknowledged/);
      passed=true;
    }finally{if(passed)await rm(directory,{recursive:true});}
  }
});
test('offline native reader validates all four exact retained cold controls',async()=>{
  const {sha256}=await import('./harness/recorder.mjs'),oldContract=await import('../crane-combined-edits-20261003/contract.mjs'),oldChecks=await import('../crane-combined-edits-20261003/harness/checks.mjs');
  const pin=sha256(await readFile(resolve(old,'../source-pins.json')));
  for(const engine of ['aperture','threejs'])for(const pose of ['baseline','all']) {
    const session='fresh-'+pose;
    const result=await readAttempt(resolve(old,engine,session,'attempt-001'),engine,session,oldContract.statesFor(session),pin,oldChecks.validateStateRecord);
    assert.equal(result.rgb.length,1024*1024*3);
    await assert.rejects(()=>readAttempt(resolve(old,engine,session,'attempt-001'),engine,session,oldContract.statesFor(session),'wrong-source-pin',oldChecks.validateStateRecord),/Native session/);
  }
});
