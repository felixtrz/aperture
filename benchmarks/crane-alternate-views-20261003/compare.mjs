/** Offline actual native artifacts only. Camera changes must not alter geometry. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { here, repo } from './cpu-loader.mjs';
import { SCHEMA, SESSION_IDS, ALTERNATE_VIEWS, POSES, statesFor } from './contract.mjs';
import { checkPins } from './run.mjs';
import { validateStateRecord, requireValue, canonical } from './harness/checks.mjs';
import { inspectCanvasPng, sha256, writeImmutable } from './harness/recorder.mjs';
import { exactGeometry, difference } from '../crane-combined-edits-20261003/compare.mjs';
import { statesFor as oldStates } from '../crane-combined-edits-20261003/contract.mjs';
import { validateStateRecord as validateOld } from '../crane-combined-edits-20261003/harness/checks.mjs';
const json=async path=>JSON.parse(await readFile(path));
function appearance(value) {
  if(Array.isArray(value))return value.map(appearance);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='id').map(([key,item])=>[key,appearance(item)]));
  return value;
}
export async function readAttempt(root,engine,session,states,pin,validate=validateStateRecord) {
  const outcome=await json(resolve(root,'outcome.json')), runner=await json(resolve(root,'verified-runner.json')), summary=await json(resolve(root,'recorder-summary.json'));
  requireValue(outcome.status==='passed'&&outcome.engine===engine&&outcome.session===session&&outcome.sourcePinsSha256===pin&&outcome.sourcePinsUnchanged===true&&outcome.serverClosed===true&&outcome.requestErrors.length===0&&runner.status==='passed'&&summary.complete&&summary.states===1,'Native session not passed, immutable or closed');
  const expected=[`states/${states[0].id}.json`,`states/${states[0].id}.png`,'complete.json'];
  requireValue(summary.acknowledged.length===expected.length,'Wrong native artifact count');
  for(const [i,receipt]of summary.acknowledged.entries()) {requireValue(receipt.path===expected[i],'Wrong native artifact order');const bytes=await readFile(resolve(root,receipt.path));requireValue(bytes.length===receipt.bytes&&sha256(bytes)===receipt.sha256,'Native acknowledged bytes changed');}
  const record=await json(resolve(root,expected[0]));requireValue(record.engine===engine&&!record.syntheticUnitFixture,'Wrong engine or synthetic native record');validate(record,0,states);
  const image=inspectCanvasPng(await readFile(resolve(root,expected[1])),{includePixels:true});
  return {record,rgb:image.rgb};
}
export async function compareAll(attempt='attempt-001') {
  requireValue(/^attempt-[0-9]{3}$/.test(attempt),'Expected immutable attempt-NNN');
  const freeze=await checkPins(),oldRoot=resolve(repo,'benchmarks/crane-combined-edits-20261003'),oldPin=sha256(await readFile(resolve(oldRoot,'source-pins.json')));
  const result={schema:SCHEMA+'.comparison',attempt,sourcePinsSha256:freeze.sha256,status:'passed',engines:{},scope:'Within-engine unchanged raw geometry, unchanged appearance and visible camera/pose changes; no cross-engine pixel equality, rankings, performance or scores.'};
  for(const engine of ['aperture','threejs']) {
    const controls={},sessions={},checks=[];
    for(const pose of POSES)controls[pose]=await readAttempt(resolve(oldRoot,'renders',engine,'fresh-'+pose,'attempt-001'),engine,'fresh-'+pose,oldStates('fresh-'+pose),oldPin,validateOld);
    for(const session of SESSION_IDS) {
      const states=statesFor(session),state=states[0],actual=await readAttempt(resolve(here,'renders',engine,session,attempt),engine,session,states,freeze.sha256),control=controls[state.edit];sessions[session]=actual;
      const geometryEqual=canonical(exactGeometry(actual.record.evidence))===canonical(exactGeometry(control.record.evidence));
      const appearanceEqual=canonical(appearance(actual.record.evidence.appearance))===canonical(appearance(control.record.evidence.appearance));
      const pixels=difference(actual.rgb,control.rgb);
      checks.push({session,control:`combined/fresh-${state.edit}/attempt-001`,expectation:'Exact geometry/raw bytes and authored appearance; visibly different selected camera',geometryEqual,appearanceEqual,...pixels,ok:geometryEqual&&appearanceEqual&&pixels.differentPixels>0});
    }
    for(const view of ALTERNATE_VIEWS) {const pixels=difference(sessions[`${view}-baseline`].rgb,sessions[`${view}-all`].rgb);checks.push({view,expectation:'Visible baseline-to-all pose difference at fixed camera',...pixels,ok:pixels.differentPixels>0});}
    for(const pose of POSES) {const pixels=difference(sessions[`rear-quarter-${pose}`].rgb,sessions[`high-oblique-${pose}`].rgb);checks.push({pose,expectation:'Visible difference between existing alternate cameras',...pixels,ok:pixels.differentPixels>0});}
    result.engines[engine]={status:checks.every(c=>c.ok)?'passed':'failed',checks};if(result.engines[engine].status==='failed')result.status='failed';
  }
  result.qualitativeReview='Separate independent inspection of all eight real native images is required; numerical differences establish no visual-quality score.';
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const [attempt,output,...extra]=process.argv.slice(2);requireValue(extra.length===0&&/^[a-z0-9-]+\.json$/.test(output??''),'Expected immutable attempt and new output basename');
  let result;try{result=await compareAll(attempt);}catch(error){result={schema:SCHEMA+'.comparison',attempt,status:'failed',error:error.stack??error.message};}
  await writeImmutable(resolve(here,output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(result.status!=='passed')process.exitCode=1;
}
