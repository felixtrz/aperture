// CPU-only regression using real pinned three.js objects. No browser, GPU,
// server, fixture files, modified engine file or external dependency is used.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../../../../', import.meta.url);
const core = new URL('shadow-lab/src/compare/three.core.js', root).href;
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const dataText = await readFile(new URL('./scene-data.mjs', import.meta.url), 'utf8');
const frozenText = await readFile(new URL('benchmarks/crane-wall-continuity-20261003/sources/b-continuous-front-quarter/scene-data.mjs', root), 'utf8');
assert.equal(dataText, frozenText, 'Scene construction must remain byte-identical to frozen source');
const dataModuleUrl = dataUrl(dataText.replace("'/three.core.js'", JSON.stringify(core)));
const { buildScene } = await import(dataModuleUrl);
const checksText = await readFile(new URL('./checks.mjs', import.meta.url), 'utf8');
assert.equal(checksText, await readFile(new URL('benchmarks/crane-wall-continuity-20261003/sources/b-continuous-front-quarter/checks.mjs', root), 'utf8'));
const checks = await import(dataUrl(checksText.replace("'./scene-data.mjs'", JSON.stringify(dataModuleUrl))));
assert(checks.checkEdits().ok, 'Inherited seven edit checks');
const updateText = await readFile(new URL('./native-meshes.mjs', import.meta.url), 'utf8');
const { createMeshStore } = await import(dataUrl(updateText.replace("'/three.core.js'", JSON.stringify(core))));
const THREE = await import(core);
const { STATES, parametersFor } = await import(new URL('../../harness/contract.mjs', import.meta.url));
const baseline = buildScene();
const materials = new Map(Object.keys(baseline.palette).map(name => { const material = new THREE.MeshStandardMaterial(); material.name = name; return [name, material]; }));
const scene = new THREE.Scene(), store = createMeshStore(scene, materials);
let initialMeshes, initialGeometries, initialAttributes;
const results = [];
for (const state of STATES) {
  const source = buildScene(state.edit);
  store.install(source, state.index + 1);
  assert.deepEqual(source.parameters, parametersFor(state.edit));
  initialMeshes ??= [...store.meshes];
  initialGeometries ??= store.meshes.map(mesh => mesh.geometry);
  initialAttributes ??= store.meshes.map(mesh => [mesh.geometry.getAttribute('position'), mesh.geometry.getAttribute('normal'), mesh.geometry.index]);
  const actual = store.cpuSnapshot(source);
  const inspected = checks.inspectScene(actual);
  assert(inspected.ok, state.id);
  for (let i = 0; i < store.meshes.length; i++) {
    assert.equal(store.meshes[i], initialMeshes[i], 'Genuine Mesh reference changed');
    assert.equal(store.meshes[i].geometry, initialGeometries[i], 'Native geometry reference changed');
    for (const [j, attribute] of [store.meshes[i].geometry.getAttribute('position'), store.meshes[i].geometry.getAttribute('normal'), store.meshes[i].geometry.index].entries()) assert.equal(attribute, initialAttributes[i][j], 'Native attribute reference changed');
    for (const key of ['positions', 'normals', 'indices']) assert.deepEqual(actual.meshes[i][key], Array.from(source.meshes[i][key]), `${state.id}:${source.meshes[i].name}:${key}`);
    // Native parent-matrix multiplication legitimately normalizes -0 to +0.
    assert(actual.meshes[i].matrix.every((value, j) => value === source.meshes[i].matrix[j]), `${state.id}:native world matrix numeric equality`);
  }
  results.push({ state: state.id, checks: inspected.checks.length, meshCount: store.meshes.length, geometryReplacements: store.counters.geometryReplacements });
}
assert.equal(results.length, 29);
const frozenScene = await readFile(new URL('benchmarks/crane-wall-continuity-20261003/sources/b-continuous-front-quarter/scene.mjs', root), 'utf8');
const expectedLighting = "import * as THREE from '/three.webgpu.js';\n" + frozenScene.slice(frozenScene.indexOf('const linearColor='), frozenScene.indexOf('async function main()')).replace('function lighting(scene)', 'export function lighting(scene)');
assert.equal(await readFile(new URL('./lighting.mjs', import.meta.url), 'utf8'), expectedLighting);
const checksModuleUrl = dataUrl(checksText.replace("'./scene-data.mjs'", JSON.stringify(dataModuleUrl)));
const workerText = (await readFile(new URL('./worker.mjs', import.meta.url), 'utf8')).replace("'./scene-data.mjs'", JSON.stringify(dataModuleUrl)).replace("'./checks.mjs'", JSON.stringify(checksModuleUrl));
const messages = [];
globalThis.self = { postMessage: (message, transfers = []) => messages.push(structuredClone(message, { transfer: transfers })) };
await import(dataUrl(workerText));
for (const state of STATES) {
  self.onmessage({ data: { type: 'apply', stateId: state.id, revision: state.index + 1, edit: state.edit } });
  const message = messages.at(-1);
  assert.equal(message.type, 'scene'); assert.equal(message.workerRevision, state.index + 1); assert.equal(message.stateId, state.id);
  assert.deepEqual(message.parameters, parametersFor(state.edit)); assert(checks.inspectScene(message.scene).ok);
}
self.onmessage({ data: { type: 'apply', stateId: 'out-of-order', revision: 31, edit: 'baseline' } });
assert.equal(messages.at(-1).type, 'error'); assert.equal(messages.at(-1).workerRevision, 29);
console.log(JSON.stringify({ ok: true, kind: 'CPU-only, not native rendering evidence', results, counters: store.counters, stableMeshReferences: true, workerProtocol: { syntheticCpuOnly: true, sequentialRevisions: 29, outOfOrderRejectedWithoutAdvancing: true }, lightingBodyByteIdentical: true,
  finalGeometryReferencesStable: store.meshes.every((mesh, i) => mesh.geometry === initialGeometries[i]),
  finalAttributeReferencesStable: store.meshes.every((mesh, i) => [mesh.geometry.getAttribute('position'), mesh.geometry.getAttribute('normal'), mesh.geometry.index].every((attribute, j) => attribute === initialAttributes[i][j])) }, null, 2));
