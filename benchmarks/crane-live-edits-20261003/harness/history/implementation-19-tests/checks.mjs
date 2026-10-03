import { SCHEMA, STATES, parametersFor } from './contract.mjs';

export function requireValue(condition, message) { if (!condition) throw Error(message); }
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const finiteArray = (value, length) => Array.isArray(value) && (length === undefined || value.length === length) && value.every(Number.isFinite);
const identityValue = value => typeof value === 'string' && value.length > 0 || Number.isSafeInteger(value);
export function geometryComparable(evidence) {
  return evidence.nativeGeometry.meshes.map(mesh => ({ name: mesh.name, positions: mesh.positions, indices: mesh.indices, worldMatrix: mesh.worldMatrix, streams: mesh.streams, submeshes: mesh.submeshes ?? null, groups: mesh.groups ?? null, materials: mesh.materials ?? null })).sort((a, b) => a.name.localeCompare(b.name));
}
export function identityComparable(evidence) {
  return { ...evidence.identity, meshes: [...evidence.identity.meshes].sort((a, b) => a.name.localeCompare(b.name)) };
}
export function verifyNativeProof(proof) {
  requireValue(proof?.native === true, 'Native WebGPU proof missing');
  requireValue(proof.adapters?.length > 0 && proof.adapters.every(info => /swiftshader/i.test(Object.values(info).join(' '))), 'SwiftShader adapter proof missing');
  requireValue(proof.devices?.length === 1 && /swiftshader/i.test(Object.values(proof.devices[0].adapter ?? {}).join(' ')), 'Exactly one native SwiftShader device required');
  requireValue(proof.canvasWebGPU > 0 && proof.webglAttempts === 0, 'Native WebGPU canvas required; WebGL is forbidden');
  requireValue(proof.submissions > 0 && proof.draws > 0, 'No genuine native submission/draw observed');
  requireValue(Array.isArray(proof.errors) && proof.errors.length === 0 && Array.isArray(proof.deviceLost) && proof.deviceLost.length === 0, 'Native GPU errors or device loss');
}
export function validateEvidence(evidence, state, receipt) {
  requireValue(evidence?.stateId === state.id && evidence.revision === state.index + 1, 'Evidence state/revision mismatch');
  for (const key of ['revision', 'workerRevision', 'submittedRevision']) requireValue(receipt?.[key] === state.index + 1, `Receipt ${key} mismatch`);
  requireValue(receipt.stateId === state.id && Number.isSafeInteger(receipt.nativeFrame) && receipt.nativeFrame >= 0 && receipt.details && typeof receipt.details === 'object', 'Native frame receipt missing');
  requireValue(canonical(evidence.parameters) === canonical(parametersFor(state.edit)), 'Frozen edit parameter mismatch');
  requireValue(canonical(evidence.camera?.position) === canonical([8, 6.5, 10]) && canonical(evidence.camera?.target) === canonical([0, 1.4, 0]) && evidence.camera.verticalSpan === 10.5, 'Fixed front-quarter camera mismatch');
  requireValue(evidence.appearance && typeof evidence.appearance === 'object', 'Frozen appearance missing');
  const identity = evidence.identity;
  requireValue(identity && identityValue(identity.sceneId) && Number.isSafeInteger(identity.entityCount) && identity.entityCount > 0 && Number.isSafeInteger(identity.meshCount) && identity.meshCount > 0, 'Native scene identity/counts missing');
  requireValue(Array.isArray(identity.meshes) && identity.meshes.length === identity.meshCount, 'Native identity inventory mismatch');
  const names = new Set();
  for (const mesh of identity.meshes) {
    requireValue(typeof mesh.name === 'string' && !names.has(mesh.name) && identityValue(mesh.entityId) && identityValue(mesh.meshId), 'Native mesh identity missing/duplicate');
    names.add(mesh.name);
  }
  requireValue(evidence.resources && typeof evidence.resources === 'object' && Object.keys(evidence.resources).length > 0, 'Measured resource counters missing');
  const source = evidence.sourceGeometry;
  requireValue(source && typeof source === 'object' && (Array.isArray(source.parts) && source.parts.length > 0 || Array.isArray(source.meshes) && source.meshes.length > 0), 'Full source geometry missing');
  const meshes = evidence.nativeGeometry?.meshes;
  requireValue(Array.isArray(meshes) && meshes.length === identity.meshCount, 'Full native mesh inventory missing');
  const geometryNames = new Set();
  for (const mesh of meshes) {
    requireValue(names.has(mesh.name) && !geometryNames.has(mesh.name), 'Native geometry name mismatch/duplicate');
    geometryNames.add(mesh.name);
    requireValue(finiteArray(mesh.positions) && mesh.positions.length >= 9 && mesh.positions.length % 3 === 0, `Native positions missing: ${mesh.name}`);
    requireValue(Array.isArray(mesh.indices) && mesh.indices.length >= 3 && mesh.indices.length % 3 === 0 && mesh.indices.every(index => Number.isSafeInteger(index) && index >= 0 && index < mesh.positions.length / 3), `Native indices invalid: ${mesh.name}`);
    requireValue(finiteArray(mesh.worldMatrix, 16), `Native matrix missing: ${mesh.name}`);
    requireValue(Array.isArray(mesh.streams) && mesh.streams.length > 0 && mesh.streams.every(stream => finiteArray(stream.data) && stream.data.length > 0), `Full native stream bytes missing: ${mesh.name}`);
  }
  requireValue(evidence.nativeChecks?.ok === true && Array.isArray(evidence.nativeChecks.checks) && evidence.nativeChecks.checks.length > 0 && evidence.nativeChecks.checks.every(check => check.ok !== false), 'Native geometry verification failed/missing');
  return evidence;
}
export function validateStateRecord(record, expectedIndex) {
  const state = STATES[expectedIndex];
  requireValue(state && record?.schema === SCHEMA && canonical(record.state) === canonical(state), 'Unexpected state/order/schema');
  requireValue(['aperture', 'threejs'].includes(record.engine), 'Unknown engine');
  validateEvidence(record.evidence, state, record.receipt);
  verifyNativeProof(record.proof);
  requireValue(record.capture?.width === 1024 && record.capture?.height === 1024 && record.capture?.method === 'HTMLCanvasElement.toBlob(image/png)' && record.capture?.gpuFenceCompleted === true && record.capture?.presentationFrames >= 2, 'Canvas capture provenance missing');
  requireValue(record.observations?.workerCount === 1 && record.observations?.workerTerminationCalls === 0 && record.observations?.deviceCount === 1 && record.observations?.webgpuCanvasCount === 1 && record.observations?.runtimeReferencesStable === true, 'Persistent native runtime identity failed');
  requireValue(record.sanity?.stableIdentities === true && record.sanity?.frozenCamera === true && record.sanity?.frozenAppearance === true, 'Persistent state sanity failed');
  if (state.reset) requireValue(record.sanity?.resetGeometryEquivalent === true, 'Baseline reset geometry differs');
  return record;
}
