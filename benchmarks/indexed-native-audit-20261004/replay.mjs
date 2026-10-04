/** Retained native replay and adversarial in-memory corruptions; never launches a browser. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SESSION_IDS, statesFor } from '../indexed-shared-mesh-fanout-20261004/contract.mjs';
import { checkPins, readServedModule } from '../indexed-shared-mesh-fanout-20261004/run.mjs';
import { validateStateRecord, validateTransition } from '../indexed-shared-mesh-fanout-20261004/harness/checks.mjs';
import { expandNativeScope } from '../indexed-shared-mesh-fanout-20261004/native-observer.mjs';
import { decodeSubmittedDraw } from '../indexed-shared-mesh-fanout-20261004/indirect-evidence.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, '../indexed-shared-mesh-fanout-20261004');
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const output = process.argv[2];
assert(output && resolve(here, output).startsWith(here + '/') && !output.includes('/'));
const sessions = process.argv.slice(3).length ? process.argv.slice(3) : SESSION_IDS;
const freeze = await checkPins();
assert.equal(freeze.sha256, '1658813197a595f2505f3a66c87a7cc0d65aed8da87bc65ac4d580fb9041aa4d');
const replay = [];
let baseline, noop;
for (const session of sessions) {
  assert(SESSION_IDS.includes(session));
  const folder = resolve(fixture, 'renders/aperture', session, 'attempt-001');
  const loaded = await read(resolve(folder, 'loaded-inputs.json'));
  let modules = 0;
  for (const [route, actual] of Object.entries(loaded)) {
    assert.deepEqual(await readServedModule(route, session, freeze.pins).then(({body, ...rest}) => rest), actual);
    modules++;
  }
  let previous;
  const states = statesFor(session);
  for (const state of states) {
    const r = await read(resolve(folder, 'states', state.id + '.json'));
    validateStateRecord(r, state.index, states);
    validateTransition(r.evidence, state, previous);
    previous = r.evidence;
    replay.push({session, state: state.id, status: 'passed'});
    if (session === 'live' && state.index === 0) baseline = r;
    if (session === 'live' && state.index === 1) noop = r;
  }
  console.log(JSON.stringify({session, states: states.length, servedModules: modules, status: 'passed'}));
}
assert(baseline && noop);
const scope = r => r.evidence.nativeGeometry.submittedDraws;
const draw = r => scope(r).draws.find(d => d.method === 'drawIndexedIndirect' && d.indirect.offset === 20);
const buffer = (r, id) => scope(r).bufferSnapshots[`${draw(r).submissionSerial}:${id}`];
const argument = r => buffer(r, draw(r).indirect.buffer.id);
const pipe = r => r.evidence.nativeGeometry.meshes.find(m => m.name === 'pipe.hollow-elbow.outer.instance-1');
const mutations = [];
function reject(name, mutate, original = baseline) {
  const copy = structuredClone(original); mutate(copy);
  let error;
  try { validateStateRecord(copy, copy.state.index, statesFor('live')); }
  catch (e) { error = e.message; }
  assert(error, `Corruption accepted: ${name}`);
  mutations.push({name, rejected: true, message: error});
}
function word(r, offset, value) {
  const bytes = Buffer.from(argument(r).fullUploadBytes);
  bytes.writeInt32LE(value, draw(r).indirect.offset + offset);
  argument(r).fullUploadBytes = [...bytes];
}
reject('indexCount changed', r => word(r, 0, 1));
reject('instanceCount changed', r => word(r, 4, 2));
reject('firstIndex changed', r => word(r, 8, 1));
reject('signed negative baseVertex changed', r => word(r, 12, -1));
reject('positive baseVertex changed', r => word(r, 12, 1));
reject('firstInstance changed', r => word(r, 16, 0));
reject('nonzero firstInstance feature absent', r => argument(r).indirectFirstInstanceSupported = false);
reject('indirect STORAGE usage', r => argument(r).usage |= 128);
reject('indirect QUERY_RESOLVE usage', r => argument(r).usage |= 512);
reject('indirect CPU bytes absent', r => delete argument(r).fullUploadBytes);
reject('indirect initialized range missing', r => argument(r).writtenRanges = []);
reject('indirect unknown copy/clear destination', r => argument(r).uncertainRanges = [[20, 40]]);
reject('indirect stale submission', r => argument(r).submissionSerial--);
reject('indirect content version missing', r => argument(r).contentVersion = 0);
reject('indirect object ambiguity', r => draw(r).uploadSnapshotIds.push(`${draw(r).submissionSerial}:${draw(r).indirect.buffer.id}`));
reject('failed/unobserved command submission', r => scope(r).commands = []);
reject('forged direct arguments', r => draw(r).count = 864);
reject('wrong uint32 index binding', r => draw(r).index.format = 'uint32');
reject('stale index uploaded byte', r => buffer(r, draw(r).index.id).fullUploadBytes[0] ^= 1);
reject('unknown index upload', r => buffer(r, draw(r).index.id).uncertainRanges = [[0, 2]]);
reject('index STORAGE usage', r => buffer(r, draw(r).index.id).usage |= 128);
reject('wrong native identity index', r => pipe(r).indices[1] = 0);
reject('stale main-thread mirrored source version', r => r.evidence.nativeGeometry.mirroredAssets[0].assetVersion++);
reject('stale consumed frame', r => r.evidence.nativeGeometry.actualSubmittedSnapshot.frame--);
reject('second-instance transform corrupt', r => pipe(r).worldMatrix[12] += 1);
reject('prepared facade source version stale', r => r.evidence.resources.nativeRenderer.preparedMeshFacade.entries[0].sourceVersion++);
reject('no-op shadow cache miss', r => r.evidence.resources.nativeRenderer.autoShadowFrameCache.status = 'miss', noop);
reject('no-op geometry allocation', r => r.evidence.resources.nativeRenderer.meshBuffersCreated++, noop);
reject('sampled shadow revision stale', r => scope(r).shadowHistory[0].contentRevision++);
reject('shadow texture overwritten', r => {
  const h = scope(r).shadowHistory[0];
  scope(r).textureInvalidations.push({textureId: h.textureId, contentRevision: h.contentRevision + 1});
});
const signed = structuredClone(baseline); word(signed, 12, -1);
const expanded = expandNativeScope(scope(signed));
const decoded = decodeSubmittedDraw(expanded.draws.find(d => d.method === 'drawIndexedIndirect' && d.indirect.offset === 20), expanded.commands);
assert.equal(decoded.baseVertex, -1);
assert.equal(decoded.argumentSource, 'submit-time-upload-observation');
const result = {status: sessions.length === 7 ? 'passed' : 'partial-passed', sessions, sourcePinsSha256: freeze.sha256,
  replay, corruptions: mutations, signedBaseVertexDecode: decoded.baseVertex,
  scope: 'Corruptions are in-memory copies of actual retained native records. Native inputs remain unchanged. This replay does not launch a browser.'};
await writeFile(resolve(here, output), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: result.status, states: replay.length, rejectedCorruptions: mutations.length, signedBaseVertexDecode: -1, output}));
