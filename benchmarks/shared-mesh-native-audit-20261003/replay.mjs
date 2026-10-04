/** Replay frozen validators and served transformations; mutate in-memory copies only. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {checkPins,readServedModule} from '../shared-mesh-fanout-v2-20261003/run.mjs';
import {validateStateRecord,validateTransition} from '../shared-mesh-fanout-v2-20261003/harness/checks.mjs';
const here=dirname(fileURLToPath(import.meta.url)), source=resolve(here,'../shared-mesh-fanout-v2-20261003');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const freeze=await checkPins(), rows=[], negatives=[];
let baseline, baselineStates;
for(const [session,states] of Object.entries(freeze.pins.sessions)) {
  const dir=resolve(source,'renders/aperture',session,'attempt-001');
  const loaded=await read(resolve(dir,'loaded-inputs.json'));
  for(const [route,expected] of Object.entries(loaded)) {
    const {body,...actual}=await readServedModule(route,session,freeze.pins);
    assert.deepEqual(actual,expected,`served ${session} ${route}`);
    assert.equal(createHash('sha256').update(body).digest('hex'),expected.servedSha256);
  }
  let previous;
  for(const state of states){
    const r=await read(resolve(dir,'states',state.id+'.json'));
    validateStateRecord(r,state.index,states);validateTransition(r.evidence,state,previous);previous=r.evidence;
    if(session==='live'&&state.index===0){baseline=r;baselineStates=states;}
  }
  rows.push({session,states:states.length,servedBodiesRecomputed:Object.keys(loaded).length});
}
const cases={
  'wrong exact argument buffer object': (r,d,s)=>{d.indirect.buffer.id+=99999;},
  'stale submission snapshot join': (r,d,s)=>{d.submissionSerial+=1;},
  'wrong three-instance argument': (r,d,s)=>{s.bufferSnapshots[`${d.submissionSerial}:${d.indirect.buffer.id}`].fullUploadBytes[d.indirect.offset+4]=2;},
  'wrong active vertex count': (r,d,s)=>{s.bufferSnapshots[`${d.submissionSerial}:${d.indirect.buffer.id}`].fullUploadBytes[d.indirect.offset]^=1;},
  'unproven GPU argument mutation': (r,d,s)=>{s.bufferSnapshots[`${d.submissionSerial}:${d.indirect.buffer.id}`].uncertainRanges=[[d.indirect.offset,d.indirect.offset+16]];},
  'unproven GPU-writable usage': (r,d,s)=>{s.bufferSnapshots[`${d.submissionSerial}:${d.indirect.buffer.id}`].usage|=128;},
  'stale bound geometry bytes': (r,d,s)=>{s.bufferSnapshots[`${d.submissionSerial}:${d.vertices[0].id}`].fullUploadBytes[0]^=1;},
  'missing second native instance': r=>{r.evidence.nativeGeometry.meshes.splice(1,1);},
  'stale mirrored mesh version': r=>{r.evidence.nativeGeometry.mirroredAssets.find(m=>m.meshId.includes('pipe.')).assetVersion+=1;},
  'wrong consumed transform': r=>{r.evidence.nativeGeometry.meshes[1].worldMatrix[12]+=1;},
  'invalidated sampled shadow revision': (r,d,s)=>{const h=s.shadowHistory[0];s.textureInvalidations.push({textureId:h.textureId,contentRevision:h.contentRevision+1,reason:'audit in-memory negative control'});},
};
for(const [name,mutate] of Object.entries(cases)){
  const r=structuredClone(baseline),s=r.evidence.nativeGeometry.submittedDraws,d=s.draws.find(d=>d.method==='drawIndirect');
  mutate(r,d,s);let rejection=null;
  try{validateStateRecord(r,0,baselineStates);}catch(error){rejection=error.message;}
  assert(rejection,`corruption unexpectedly accepted: ${name}`);negatives.push({name,rejection});
}
const result={status:'passed',sourcePinsSha256:freeze.sha256,rows,actualNativeRecordNegativeControls:negatives,nativeExecutions:0,newBrowsers:0};
const name=process.argv[2];assert(/^replay-\d{3}\.json$/.test(name));
await writeFile(resolve(here,name),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'passed',states:rows.reduce((n,r)=>n+r.states,0),servedBodiesRecomputed:rows.reduce((n,r)=>n+r.servedBodiesRecomputed,0),actualRecordNegatives:negatives.length}));
