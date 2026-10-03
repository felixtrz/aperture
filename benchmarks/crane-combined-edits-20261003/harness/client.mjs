import { SCHEMA, STATES, READY_GLOBAL, PROGRESS_GLOBAL, LIMITS } from './contract.mjs';
import { canonical, geometryComparable, identityComparable, requireValue, validateEvidence, verifyNativeProof, validateTransition } from './checks.mjs';

let installed = false;
/** Transparent observation of actual native calls; never substitutes an API. */
export function installLiveEditTracking() {
  requireValue(!installed, 'Live edit tracking must be installed exactly once before boot');
  installed = true;
  const workers = [], devices = [], canvases = new Set();
  const counts = { workerTerminationCalls: 0, buffersCreated: 0, bufferDestroyCalls: 0, buffersExplicitlyDestroyed: 0, texturesCreated: 0, textureDestroyCalls: 0, texturesExplicitlyDestroyed: 0 };
  const originalWorker = globalThis.Worker;
  globalThis.Worker = new Proxy(originalWorker, { construct(Target, args, newTarget) {
    const worker = Reflect.construct(Target, args, newTarget);
    workers.push(worker);
    const terminate = worker.terminate;
    worker.terminate = function (...values) { counts.workerTerminationCalls++; return terminate.apply(this, values); };
    return worker;
  } });
  const requestDevice = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = async function (...args) {
    const device = await requestDevice.apply(this, args);
    devices.push(device);
    for (const [method, created, calls, destroyed] of [['createBuffer', 'buffersCreated', 'bufferDestroyCalls', 'buffersExplicitlyDestroyed'], ['createTexture', 'texturesCreated', 'textureDestroyCalls', 'texturesExplicitlyDestroyed']]) {
      const original = device[method];
      device[method] = function (...values) {
        const resource = original.apply(this, values);
        counts[created]++;
        let wasDestroyed = false;
        const destroy = resource.destroy;
        resource.destroy = function (...destroyArgs) {
          const result = destroy.apply(this, destroyArgs);
          counts[calls]++;
          if (!wasDestroyed) { counts[destroyed]++; wasDestroyed = true; }
          return result;
        };
        return resource;
      };
    }
    return device;
  };
  for (const proto of [globalThis.HTMLCanvasElement?.prototype, globalThis.OffscreenCanvas?.prototype]) {
    if (!proto) continue;
    const getContext = proto.getContext;
    proto.getContext = function (type, ...args) {
      const result = getContext.call(this, type, ...args);
      if (type === 'webgpu' && result) canvases.add(this);
      return result;
    };
  }
  return Object.freeze({ workers, devices, canvases, snapshot() {
    return { workerCount: workers.length, deviceCount: devices.length, webgpuCanvasCount: canvases.size, ...counts, resourceCounterDefinition: 'Observed successful createBuffer/createTexture calls and explicit destroy() calls since pre-boot installation. These are not GPU-memory measurements; resources reclaimed without explicit destroy are not inferred.' };
  } });
}
const clone = value => JSON.parse(JSON.stringify(value));
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
async function postArtifact(path, body, contentType, limit) {
  const bytes = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : new TextEncoder().encode(body);
  requireValue(bytes.byteLength > 0 && bytes.byteLength <= limit, `Bounded artifact limit exceeded: ${path}`);
  const sha256 = await digest(bytes);
  const response = await fetch(`/record/${path}`, { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes });
  const receipt = await response.json();
  requireValue(response.ok && receipt.ok && receipt.path === path && receipt.sha256 === sha256 && receipt.bytes === bytes.byteLength, `Artifact not acknowledged: ${path}: ${JSON.stringify(receipt)}`);
  return receipt;
}
function capture(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob && blob.type === 'image/png' ? resolve(blob) : reject(Error('Native canvas PNG extraction failed')), 'image/png'));
}

export async function runLiveEditHarness(adapter, { tracking }) {
  let currentState = null;
  let partialState = null;
  let baseline = null;
  let previousEvidence = null;
  const receipts = [];
  const progress = (phase, detail = {}) => { globalThis[PROGRESS_GLOBAL] = { schema: SCHEMA, phase, state: currentState, acknowledgedArtifacts: receipts.length, ...detail }; };
  try {
    requireValue(installed && tracking, 'Pre-boot tracking is required');
    requireValue(['aperture', 'threejs'].includes(adapter.engine), 'Unknown adapter engine');
    requireValue(adapter.canvas instanceof HTMLCanvasElement, 'Native display canvas missing');
    requireValue(globalThis.__APERTURE_WAIT_GPU__ && globalThis.__APERTURE_VERIFIED_GPU__, 'Approved verified runner required');
    const initialHandles = adapter.getRuntimeHandles();
    for (const key of ['renderer', 'scene', 'worker']) requireValue(initialHandles[key] && typeof initialHandles[key] === 'object', `Actual ${key} reference missing`);
    requireValue(initialHandles.worker === tracking.workers[0], 'Worker handle is not the observed native Worker');
    let previousSubmissions = globalThis.__APERTURE_VERIFIED_GPU__.submissions;
    for (const state of STATES) {
      currentState = state;
      partialState = { state };
      progress('applying');
      const receipt = await adapter.applyAndSubmit(state);
      partialState.receipt = clone(receipt);
      progress('fencing');
      const proof = clone(await globalThis.__APERTURE_WAIT_GPU__());
      partialState.proof = proof;
      verifyNativeProof(proof);
      requireValue(proof.submissions > previousSubmissions, 'No new native submission for this state');
      previousSubmissions = proof.submissions;
      // The approved fence already waits two presentation opportunities. This
      // capture reads the actual canvas; the server rejects blank/transparent PNGs.
      requireValue(adapter.canvas.width === 1024 && adapter.canvas.height === 1024 && document.querySelectorAll('canvas').length === 1, 'Exactly one 1024-square canvas is required');
      const handles = adapter.getRuntimeHandles();
      for (const key of ['renderer', 'scene', 'worker']) requireValue(handles[key] === initialHandles[key], `${key} recreated during persistent session`);
      requireValue(tracking.devices.length === 1 && tracking.workers.length === 1 && tracking.canvases.size === 1 && tracking.canvases.has(adapter.canvas), 'Device/worker/canvas recreated');
      const observations = { ...tracking.snapshot(), runtimeReferencesStable: true };
      partialState.observations = observations;
      requireValue(observations.workerTerminationCalls === 0, 'Persistent worker terminated');
      const evidence = clone(await adapter.readEvidence(state, receipt));
      partialState.evidence = evidence;
      validateEvidence(evidence, state, receipt);
      validateTransition(evidence, state, previousEvidence, adapter.engine);
      previousEvidence = evidence;
      const comparable = { identities: canonical(identityComparable(evidence)), camera: canonical(evidence.camera), appearance: canonical(evidence.appearance), geometry: canonical(geometryComparable(evidence)) };
      baseline ??= comparable;
      const sanity = { stableIdentities: comparable.identities === baseline.identities, frozenCamera: comparable.camera === baseline.camera, frozenAppearance: comparable.appearance === baseline.appearance, resetGeometryEquivalent: state.edit === 'baseline' ? comparable.geometry === baseline.geometry : null };
      requireValue(sanity.stableIdentities && sanity.frozenCamera && sanity.frozenAppearance && sanity.resetGeometryEquivalent !== false, 'Identity, appearance, camera or reset geometry changed');
      const record = { schema: SCHEMA, engine: adapter.engine, state, receipt: clone(receipt), evidence, proof, observations, sanity, capture: { method: 'HTMLCanvasElement.toBlob(image/png)', width: adapter.canvas.width, height: adapter.canvas.height, gpuFenceCompleted: true, presentationFrames: 2 }, recordedAt: new Date().toISOString() };
      progress('recording');
      // Preserve full evidence even if PNG extraction itself or validation fails.
      receipts.push(await postArtifact(`states/${state.id}.json`, JSON.stringify(record) + '\n', 'application/json', LIMITS.jsonBytes));
      progress('capturing');
      const png = await capture(adapter.canvas);
      receipts.push(await postArtifact(`states/${state.id}.png`, png, 'image/png', LIMITS.pngBytes));
      progress('state-acknowledged');
    }
    const finalProof = clone(await globalThis.__APERTURE_WAIT_GPU__());
    verifyNativeProof(finalProof);
    const completion = { schema: SCHEMA, engine: adapter.engine, states: STATES.length, artifacts: receipts, proof: finalProof, observations: tracking.snapshot(), scope: 'exploratory persistent native-WebGPU live edits; no score, GPU-memory or performance claim' };
    const completionReceipt = await postArtifact('complete.json', JSON.stringify(completion) + '\n', 'application/json', LIMITS.jsonBytes);
    globalThis[READY_GLOBAL] = { ok: true, schema: SCHEMA, engine: adapter.engine, states: STATES.length, acknowledgedArtifacts: receipts.length, completion: completionReceipt, proof: finalProof, limitations: ['Canvas capture follows native queue completion and two presentation opportunities; blank/transparent or failed captures fail and are retained.', 'Observed resource creation/destruction counters are not GPU-memory measurements.', 'Exact model identity and full authentic author transcripts are unavailable; exploratory only.'] };
    progress('ready');
  } catch (error) {
    progress('error', { error: { name: error.name, message: error.message, stack: error.stack } });
    const failure = { schema: SCHEMA, engine: adapter?.engine ?? null, state: currentState, partialState, artifacts: receipts, error: { name: error.name, message: error.message, stack: error.stack }, proof: clone(globalThis.__APERTURE_VERIFIED_GPU__ ?? null), observations: tracking?.snapshot() ?? null };
    try { await postArtifact('failure.json', JSON.stringify(failure) + '\n', 'application/json', LIMITS.jsonBytes); } catch (recordError) { console.error('Failure receipt could not be acknowledged:', recordError); }
    // Never publish a success-shaped READY value for an incomplete attempt.
    globalThis[READY_GLOBAL] = { ok: false, schema: SCHEMA, state: currentState, error: error.message, acknowledgedArtifacts: receipts.length };
    console.error(error);
    throw error;
  }
}
