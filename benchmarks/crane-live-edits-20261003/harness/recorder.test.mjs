import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { SCHEMA, STATES, LIMITS, parametersFor } from './contract.mjs';
import { validateEvidence, validateStateRecord } from './checks.mjs';
import { createRecorder, crc32, inspectCanvasPng, readBoundedBody, writeImmutable } from './recorder.mjs';
import { installLiveEditTracking } from './client.mjs';
import { authorRootFor, verifyAuthorSourcePath, verifyLifecycleRoot } from './run.mjs';

assert.ok(process.env.APERTURE_TMP_RUN?.startsWith('/'), 'Tests require adopted cleanup.py lifecycle APERTURE_TMP_RUN');
function chunk(name, data) {
  const type = Buffer.from(name), bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length, 0); type.copy(bytes, 4); data.copy(bytes, 8); bytes.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8); return bytes;
}
function png({ blank = false, transparent = false, filter = 0 } = {}) {
  const width = 1024, height = 1024, stride = width * 4, raw = Buffer.alloc(height * (stride + 1));
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(stride), offset = y * (stride + 1); raw[offset] = filter;
    for (let x = 0; x < width; x++) {
      row[x * 4] = blank ? 50 : ((x >> 4) + (y >> 4)) % 2 ? 210 : 40;
      row[x * 4 + 1] = 80; row[x * 4 + 2] = 150; row[x * 4 + 3] = transparent ? 0 : 255;
    }
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? row[x - 4] : 0, up = previous[x], upperLeft = x >= 4 ? previous[x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = up;
      if (filter === 3) predictor = Math.floor((left + up) / 2);
      if (filter === 4) { const p = left + up - upperLeft, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft); predictor = a <= b && a <= c ? left : b <= c ? up : upperLeft; }
      raw[offset + 1 + x] = (row[x] - predictor) & 255;
    }
    previous = row;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const validPng = png();
const proof = submissions => ({ native: true, adapters: [{ description: 'SwiftShader' }], devices: [{ adapter: { description: 'SwiftShader' } }], canvasWebGPU: 1, webglAttempts: 0, submissions, draws: submissions, errors: [], deviceLost: [] });
function recordFor(index) {
  const state = STATES[index], positions = [0, 0, 0, 1, 0, 0, 0, state.edit === 'baseline' ? 1 : 1.25, 0];
  return {
    schema: SCHEMA, engine: 'aperture', state,
    receipt: { stateId: state.id, revision: index + 1, workerRevision: index + 1, submittedRevision: index + 1, nativeFrame: index + 1, details: { fixture: 'synthetic recorder unit test, never native-render evidence' } },
    evidence: { stateId: state.id, revision: index + 1, parameters: parametersFor(state.edit), camera: { position: [8, 6.5, 10], target: [0, 1.4, 0], verticalSpan: 10.5 }, appearance: { fixed: true }, identity: { sceneId: 'fixture-world', entityCount: 1, meshCount: 1, meshes: [{ name: 'triangle', entityId: 1, meshId: 'triangle.mesh' }] }, resources: { fixtureOnly: true }, sourceGeometry: { parts: [{ name: 'triangle', positions }] }, nativeGeometry: { meshes: [{ name: 'triangle', positions, indices: [0, 1, 2], worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], streams: [{ id: 'position', data: positions, dataType: 'Float32Array', arrayStride: 12, vertexCount: 3 }] }] }, nativeChecks: { ok: true, checks: [{ name: 'fixture', ok: true }] } },
    proof: proof(index + 1), observations: { workerCount: 1, workerTerminationCalls: 0, deviceCount: 1, webgpuCanvasCount: 1, runtimeReferencesStable: true }, sanity: { stableIdentities: true, frozenCamera: true, frozenAppearance: true, resetGeometryEquivalent: state.edit === 'baseline' ? true : null }, capture: { method: 'HTMLCanvasElement.toBlob(image/png)', width: 1024, height: 1024, gpuFenceCompleted: true, presentationFrames: 2 },
  };
}
const bytes = value => Buffer.from(JSON.stringify(value) + '\n');
function nonindexedRecord() {
  const record = recordFor(0), mesh = record.evidence.nativeGeometry.meshes[0];
  mesh.indexed = false; mesh.indices = []; mesh.indexBuffer = null;
  mesh.streams[0].attributes = [{ semantic: 'POSITION', format: 'float32x3', offset: 0 }];
  mesh.streams[0].byteLength = mesh.streams[0].data.length * 4;
  mesh.submeshes = [{ label: 'native-triangle', topology: 'triangle-list', materialSlot: 0, vertexStart: 0, vertexCount: 3, indexStart: 0, indexCount: 0 }];
  return record;
}
async function fixture(fn) {
  const root = await mkdtemp(resolve(process.env.APERTURE_TMP_RUN, 'recorder-fixture-'));
  try { return await fn(root, await createRecorder(root, { engine: 'aperture' })); }
  finally { await rm(root, { recursive: true, force: true }); }
}
test('frozen sequence has baseline plus two cycles of seven edit/reset pairs', () => {
  assert.equal(STATES.length, 29); assert.equal(STATES[0].edit, 'baseline');
  assert.equal(STATES.filter(state => state.reset).length, 14);
  assert.equal(new Set(STATES.map(state => state.id)).size, 29);
  for (const state of STATES) assert.ok(Object.isFrozen(state));
  assert.deepEqual(parametersFor('assembly'), { shoulder_deg: 50, elbow_deg: -35, hoist_length: 1.5, opening_width: 1.6, pipe_bend_radius: 0.8, top_tier_height: 0.18, assembly_yaw_deg: 20, assembly_dx: 0.55, assembly_dz: 0.4 });
});
test('source routing accepts actual admitted author v1 paths and rejects cross-engine/escaped paths', () => {
  const a = resolve(authorRootFor('aperture'), 'v1'), b = resolve(authorRootFor('threejs'), 'v1');
  assert.ok(a.endsWith('/benchmarks/crane-live-edits-20261003/author-a/v1'));
  assert.ok(b.endsWith('/benchmarks/crane-live-edits-20261003/author-b/v1'));
  assert.equal(verifyAuthorSourcePath('aperture', a), a); assert.equal(verifyAuthorSourcePath('threejs', b), b);
  assert.throws(() => verifyAuthorSourcePath('aperture', b), /admitted/);
  assert.throws(() => verifyAuthorSourcePath('threejs', a), /admitted/);
  assert.throws(() => verifyAuthorSourcePath('aperture', resolve(a, '../../sources')), /admitted/);
  assert.throws(() => verifyAuthorSourcePath('aperture', '/tmp/symlink-target'), /admitted/);
  assert.throws(() => verifyAuthorSourcePath('aperture', authorRootFor('aperture') + '-lookalike/v1'), /admitted/);
  assert.equal(verifyLifecycleRoot('/workspace/scratch/0190a8c72f8a/aperture-tmp'), process.env.APERTURE_TMP_ROOT);
  assert.throws(() => verifyLifecycleRoot('/workspace/shared/aperture-tmp'), /Only the adopted scratch/);
});
for (const filter of [0, 1, 2, 3, 4]) test(`actual PNG decoder handles filter ${filter}`, () => { assert.equal(inspectCanvasPng(filter === 0 ? validPng : png({ filter })).blankCheck, 'passed'); });
test('PNG decoder rejects blank, transparent, CRC-corrupt and truncated captures', () => {
  assert.throws(() => inspectCanvasPng(png({ blank: true })), /Blank/);
  assert.throws(() => inspectCanvasPng(png({ transparent: true })), /Blank/);
  const corrupt = Buffer.from(validPng); corrupt[40] ^= 1;
  assert.throws(() => inspectCanvasPng(corrupt), /CRC/);
  assert.throws(() => inspectCanvasPng(validPng.subarray(0, -1)), /chunk|Incomplete/);
});
test('all 29 full states and 58 immutable files are required and rehashed on completion', async () => fixture(async (root, recorder) => {
  const receipts = [];
  for (const state of STATES) {
    receipts.push(await recorder.record(`states/${state.id}.json`, bytes(recordFor(state.index)), 'application/json'));
    receipts.push(await recorder.record(`states/${state.id}.png`, validPng, 'image/png'));
  }
  const completion = { schema: SCHEMA, engine: 'aperture', states: 29, artifacts: receipts, proof: proof(29) };
  await recorder.record('complete.json', bytes(completion), 'application/json');
  assert.equal(recorder.summary().complete, true); assert.equal(recorder.summary().acknowledged.length, 59);
  assert.equal((await readdir(resolve(root, 'states'))).length, 58);
  assert.deepEqual(await readFile(resolve(root, `states/${STATES[0].id}.png`)), validPng);
}));
test('duplicate artifacts cannot overwrite surviving state bytes', async () => fixture(async (root, recorder) => {
  const path = `states/${STATES[0].id}.json`, original = bytes(recordFor(0));
  await recorder.record(path, original, 'application/json');
  await assert.rejects(recorder.record(path, Buffer.from('{}'), 'application/json'), /already acknowledged/);
  assert.deepEqual(await readFile(resolve(root, path)), original);
  assert.equal((await readdir(resolve(root, 'rejected'))).length, 2);
}));
test('blank capture fails but full geometry and failed PNG survive', async () => fixture(async (root, recorder) => {
  await recorder.record(`states/${STATES[0].id}.json`, bytes(recordFor(0)), 'application/json');
  const blank = png({ blank: true });
  await assert.rejects(recorder.record(`states/${STATES[0].id}.png`, blank, 'image/png'), /Blank/);
  assert.deepEqual(await readFile(resolve(root, `states/${STATES[0].id}.png`)), blank);
  assert.equal(recorder.summary().complete, false);
}));
test('out-of-order state, premature completion and path traversal are refused and retained', async () => fixture(async (root, recorder) => {
  await assert.rejects(recorder.record(`states/${STATES[1].id}.json`, bytes(recordFor(1)), 'application/json'), /sequence/);
  await assert.rejects(recorder.record('complete.json', bytes({ schema: SCHEMA, states: 29 }), 'application/json'), /Incomplete/);
  await assert.rejects(recorder.record('../escape.json', Buffer.from('{}'), 'application/json'), /Unknown artifact/);
  assert.equal(recorder.summary().complete, false); assert.equal((await readdir(resolve(root, 'rejected'))).length, 6);
}));
test('mismatched worker submission correlation, missing geometry, fallback and resource recreation fail', () => {
  const wrongRevision = recordFor(0); wrongRevision.receipt.submittedRevision = 9;
  assert.throws(() => validateStateRecord(wrongRevision, 0), /submittedRevision/);
  const hashOnly = recordFor(0); hashOnly.evidence.nativeGeometry.meshes[0].streams = [];
  assert.throws(() => validateStateRecord(hashOnly, 0), /stream bytes/);
  const fallback = recordFor(0); fallback.proof.webglAttempts = 1;
  assert.throws(() => validateStateRecord(fallback, 0), /WebGL/);
  const recreated = recordFor(0); recreated.observations.workerCount = 2;
  assert.throws(() => validateStateRecord(recreated, 0), /runtime identity/);
  const badIndex = recordFor(0); badIndex.evidence.nativeGeometry.meshes[0].indices[0] = 100;
  assert.throws(() => validateEvidence(badIndex.evidence, STATES[0], badIndex.receipt), /indices/);
});
test('explicit actual nonindexed native triangle-list streams and submesh ranges are accepted unchanged', async () => fixture(async (root, recorder) => {
  const record = nonindexedRecord();
  validateStateRecord(record, 0);
  const path = `states/${STATES[0].id}.json`;
  await recorder.record(path, bytes(record), 'application/json');
  const saved = JSON.parse(await readFile(resolve(root, path), 'utf8')).evidence.nativeGeometry.meshes[0];
  assert.equal(saved.indexed, false); assert.deepEqual(saved.indices, []); assert.equal(saved.submeshes[0].vertexCount, 3);
}));
test('nonindexed geometry requires explicit mode, real POSITION bytes and valid native triangle ranges', () => {
  const invalid = [
    ['implicit empty indices', mesh => { delete mesh.indexed; }],
    ['fabricated indices', mesh => { mesh.indices = [0, 1, 2]; }],
    ['unexpected native index buffer', mesh => { mesh.indexBuffer = { data: [0, 1, 2] }; }],
    ['missing ranges', mesh => { delete mesh.submeshes; }],
    ['line topology', mesh => { mesh.submeshes[0].topology = 'line-list'; }],
    ['range beyond native vertices', mesh => { mesh.submeshes[0].vertexStart = 1; }],
    ['partial triangle', mesh => { mesh.submeshes[0].vertexCount = 2; }],
    ['nonzero index range', mesh => { mesh.submeshes[0].indexCount = 3; }],
    ['wrong native vertex count', mesh => { mesh.streams[0].vertexCount = 4; }],
    ['short native stream', mesh => { mesh.streams[0].data = mesh.streams[0].data.slice(0, -1); }],
    ['byteLength mismatch', mesh => { mesh.streams[0].byteLength = 4; }],
    ['attribute beyond stride', mesh => { mesh.streams[0].attributes[0].offset = 8; }],
    ['missing POSITION', mesh => { mesh.streams[0].attributes[0].semantic = 'NORMAL'; }],
    ['synthetic positions do not match raw stream', mesh => { mesh.positions = [...mesh.positions]; mesh.positions[0] = 1; }],
  ];
  for (const [name, mutate] of invalid) {
    const record = nonindexedRecord(); mutate(record.evidence.nativeGeometry.meshes[0]);
    assert.throws(() => validateStateRecord(record, 0), undefined, name);
  }
});
test('nonindexed interleaved actual POSITION stream decodes with byte stride and offset', () => {
  const record = nonindexedRecord(), mesh = record.evidence.nativeGeometry.meshes[0];
  mesh.streams = [{ id: 'native-interleaved', dataType: 'Float32Array', vertexCount: 3, arrayStride: 24, byteLength: 72, attributes: [{ semantic: 'NORMAL', format: 'float32x3', offset: 0 }, { semantic: 'POSITION', format: 'float32x3', offset: 12 }], data: [0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0] }];
  validateStateRecord(record, 0);
});
test('indexed geometry validation remains strict after nonindexed support', () => {
  for (const indices of [[], [0, 1], [0, 1, 3], [0, 1, -1], [0, 1, 1.5]]) {
    const record = recordFor(0); record.evidence.nativeGeometry.meshes[0].indexed = true; record.evidence.nativeGeometry.meshes[0].indices = indices;
    assert.throws(() => validateStateRecord(record, 0), /indices invalid/);
  }
});
test('recorder independently rejects identity drift regardless of client sanity flags', async () => fixture(async (root, recorder) => {
  await recorder.record(`states/${STATES[0].id}.json`, bytes(recordFor(0)), 'application/json');
  await recorder.record(`states/${STATES[0].id}.png`, validPng, 'image/png');
  const changed = recordFor(1); changed.evidence.identity.meshes[0].entityId = 8;
  await assert.rejects(recorder.record(`states/${STATES[1].id}.json`, bytes(changed), 'application/json'), /identity\/camera\/appearance/);
}));
test('recorder independently rejects false baseline resets', async () => fixture(async (root, recorder) => {
  for (const index of [0, 1]) {
    await recorder.record(`states/${STATES[index].id}.json`, bytes(recordFor(index)), 'application/json');
    await recorder.record(`states/${STATES[index].id}.png`, validPng, 'image/png');
  }
  const reset = recordFor(2); reset.evidence.nativeGeometry.meshes[0].positions[0] = 0.3;
  await assert.rejects(recorder.record(`states/${STATES[2].id}.json`, bytes(reset), 'application/json'), /reset check/);
}));
test('bounded request reader retains only bounded bytes on overflow', async () => {
  assert.deepEqual(await readBoundedBody(Readable.from([Buffer.from('abc'), Buffer.from('def')]), 6), Buffer.from('abcdef'));
  await assert.rejects(readBoundedBody(Readable.from([Buffer.from('abc'), Buffer.from('defg')]), 6), error => error.partialBody.equals(Buffer.from('abcdef')));
});
test('wrong content type and oversized payloads are refused without state acknowledgment', async () => fixture(async (_root, recorder) => {
  await assert.rejects(recorder.record(`states/${STATES[0].id}.png`, validPng, 'text/plain'), /content type/);
  await assert.rejects(recorder.record(`states/${STATES[0].id}.png`, Buffer.alloc(LIMITS.pngBytes + 1), 'image/png'), /bounded size/);
  assert.equal(recorder.summary().acknowledged.length, 0);
}));
test('failure artifact preserves a partial attempt and never completes it', async () => fixture(async (root, recorder) => {
  await recorder.record(`states/${STATES[0].id}.json`, bytes(recordFor(0)), 'application/json');
  await recorder.record('failure.json', bytes({ schema: SCHEMA, error: { message: 'Synthetic unit-test failure' } }), 'application/json');
  assert.equal(recorder.summary().failed, true); assert.equal(recorder.summary().complete, false);
  assert.equal(JSON.parse(await readFile(resolve(root, 'failure.json'), 'utf8')).error.message, 'Synthetic unit-test failure');
}));
test('exclusive file writes never replace previous attempts', async () => fixture(async (root) => {
  const path = resolve(root, 'exclusive.bin'); await writeImmutable(path, 'first');
  await assert.rejects(writeImmutable(path, 'second'), { code: 'EEXIST' });
  assert.equal(await readFile(path, 'utf8'), 'first');
}));
test('native-call instrumentation forwards exact results and counts explicit resource lifecycle', async () => {
  const keys = ['Worker', 'GPUAdapter', 'HTMLCanvasElement', 'OffscreenCanvas'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let bufferDestroyed = 0, textureDestroyed = 0, terminated = 0;
  class FakeWorker { terminate() { terminated++; return 'terminated'; } }
  const buffer = { destroy() { bufferDestroyed++; return 'buffer-destroyed'; } }, texture = { destroy() { textureDestroyed++; return 'texture-destroyed'; } };
  const device = { createBuffer() { return buffer; }, createTexture() { return texture; } };
  class FakeAdapter { async requestDevice() { return device; } }
  const context = {};
  class FakeCanvas { getContext(type) { return type === 'webgpu' ? context : null; } }
  try {
    globalThis.Worker = FakeWorker; globalThis.GPUAdapter = FakeAdapter; globalThis.HTMLCanvasElement = FakeCanvas; globalThis.OffscreenCanvas = undefined;
    const tracking = installLiveEditTracking(), worker = new Worker(), canvas = new HTMLCanvasElement();
    assert.strictEqual(await new GPUAdapter().requestDevice(), device);
    assert.strictEqual(device.createBuffer(), buffer); assert.strictEqual(device.createTexture(), texture);
    assert.strictEqual(canvas.getContext('webgpu'), context); assert.strictEqual(canvas.getContext('webgpu'), context);
    assert.equal(buffer.destroy(), 'buffer-destroyed'); buffer.destroy(); texture.destroy();
    assert.equal(worker.terminate(), 'terminated');
    const result = tracking.snapshot();
    assert.equal(result.workerCount, 1); assert.equal(result.deviceCount, 1); assert.equal(result.webgpuCanvasCount, 1);
    assert.equal(result.bufferDestroyCalls, 2); assert.equal(result.buffersExplicitlyDestroyed, 1); assert.equal(result.texturesCreated, 1);
    assert.equal(bufferDestroyed, 2); assert.equal(textureDestroyed, 1); assert.equal(terminated, 1);
    assert.strictEqual(tracking.workers[0], worker); assert.strictEqual(tracking.devices[0], device);
    assert.throws(() => installLiveEditTracking(), /exactly once/);
  } finally {
    for (const key of keys) { if (saved[key]) Object.defineProperty(globalThis, key, saved[key]); else delete globalThis[key]; }
  }
});
