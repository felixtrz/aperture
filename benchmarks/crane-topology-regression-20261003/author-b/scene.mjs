import * as THREE from '/three.webgpu.js';
import { installLiveEditTracking, runLiveEditHarness } from '/harness/client.mjs';
import { parametersFor, STATES } from '/harness/contract.mjs';
import { inspectScene } from './checks.mjs';
import { createMeshStore, equalValues } from './native-meshes.mjs';
import { installTopologyDrawObserver } from '../topology-observer.mjs';
import { createGpuEvidence } from './gpu-evidence.mjs';
import { lighting } from './lighting.mjs';

const tracking = installLiveEditTracking();
const topologyDraws = installTopologyDrawObserver();
const jsonSafe = value => JSON.parse(JSON.stringify(value, (_, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
const requireValue = (condition, message) => { if (!condition) throw Error(message); };
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  requireValue(navigator.gpu, 'Native WebGPU is unavailable; WebGL fallback is prohibited.');
  const canvas = document.querySelector('#scene');
  const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  let waiting = null;
  worker.onmessage = ({ data }) => {
    if (!waiting) throw Error('Unsolicited worker response');
    const pending = waiting; waiting = null; clearTimeout(pending.timeout);
    if (data.type === 'error') pending.reject(Object.assign(new Error(data.error.message), data.error));
    else if (data.stateId !== pending.state.id || data.workerRevision !== pending.state.index + 1) pending.reject(Error('Worker state/revision mismatch'));
    else pending.resolve(data);
  };
  worker.onerror = event => { if (waiting) { clearTimeout(waiting.timeout); waiting.reject(Error(event.message)); waiting = null; } };
  function request(state) {
    requireValue(!waiting, 'Overlapping worker requests are prohibited');
    return new Promise((resolve, reject) => {
      waiting = { state, resolve, reject, timeout: setTimeout(() => { waiting = null; reject(Error('Persistent worker revision deadline exceeded')); }, 180000) };
      worker.postMessage({ type: 'apply', revision: state.index + 1, stateId: state.id, edit: state.edit });
    });
  }
  const initial = await request(STATES[0]);
  let currentData = initial.scene, installedRevision = 0;
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, samples: 4, alpha: false, forceWebGL: false });
  renderer._getFallback = null;
  renderer.setPixelRatio(1); renderer.setSize(1024, 1024, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();
  requireValue(renderer.backend.isWebGPUBackend === true, 'Unexpected renderer backend');
  const device = renderer.backend.device;
  const validationErrors = [], uncapturedErrors = [];
  device.addEventListener('uncapturederror', event => uncapturedErrors.push(event.error.message));
  const scene = new THREE.Scene(); scene.name = 'procedural-crane-courtyard'; scene.background = new THREE.Color('#5e6770');
  const materials = new Map(Object.entries(currentData.palette).map(([name, palette]) => {
    const material = new THREE.MeshStandardMaterial({ color: palette.srgb, roughness: palette.roughness, metalness: palette.metallic, flatShading: true });
    material.name = name;
    if (name === 'lamp') { material.emissive.set('#FFE1A3'); material.emissiveIntensity = 2.5; }
    return [name, material];
  }));
  const store = createMeshStore(scene, materials);
  store.install(currentData, initial.workerRevision); installedRevision = initial.workerRevision;
  lighting(scene);
  const settings = currentData.cameras['front-quarter'], halfSpan = settings.vertical_span / 2;
  const camera = new THREE.OrthographicCamera(-halfSpan, halfSpan, halfSpan, -halfSpan, .1, 100);
  camera.name = 'front-quarter'; camera.position.fromArray(settings.position); camera.up.set(0, 1, 0); camera.lookAt(...settings.target); camera.updateProjectionMatrix();
  scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  const gpuEvidence = createGpuEvidence(renderer, topologyDraws);
  device.pushErrorScope('validation');
  await renderer.compileAsync(scene, camera);
  const compileValidation = await device.popErrorScope();
  if (compileValidation) { validationErrors.push(compileValidation.message); throw Error(`Native compile validation: ${compileValidation.message}`); }

  let activeSubmission = null, completedSubmission = null, evidence = null;
  scene.onBeforeRender = (actualRenderer, actualScene, actualCamera) => {
    if (actualCamera !== camera) return;
    requireValue(activeSubmission && actualRenderer === renderer && actualScene === scene, 'Unexpected main-scene render');
    requireValue(store.meshes.every(mesh => mesh.userData.installedWorkerRevision === installedRevision), 'Partial native scene revision');
    activeSubmission.before = { revision: installedRevision, sceneId: scene.id, cameraId: camera.id, rendererFrame: renderer.info.frame, rendererCall: renderer.info.calls };
  };
  for (const mesh of store.meshes) mesh.onBeforeRender = (actualRenderer, actualScene, actualCamera, geometry) => {
    if (actualCamera !== camera) return;
    requireValue(activeSubmission && actualRenderer === renderer && actualScene === scene && geometry === mesh.geometry, 'Unexpected native mesh draw');
    requireValue(mesh.userData.installedWorkerRevision === installedRevision, 'Stale native mesh submitted');
    activeSubmission.drawn.set(mesh.id, { name: mesh.name, meshId: mesh.id, geometryId: geometry.id, workerRevision: mesh.userData.installedWorkerRevision, worldMatrix: mesh.matrixWorld.toArray(), positionAttributeId: geometry.getAttribute('position').id, positionAttributeVersion: geometry.getAttribute('position').version, indexAttributeId: geometry.index.id, indexAttributeVersion: geometry.index.version });
  };
  scene.onAfterRender = (actualRenderer, actualScene, actualCamera) => {
    if (actualCamera !== camera) return;
    requireValue(actualRenderer === renderer && actualScene === scene && activeSubmission?.before?.revision === installedRevision, 'Native frame lacks worker correspondence');
    completedSubmission = { ...activeSubmission.before, afterRendererFrame: renderer.info.frame, afterRendererCall: renderer.info.calls,
      drawnMeshes: [...activeSubmission.drawn.values()], callback: 'THREE.Scene.onAfterRender after WebGPUBackend.finishRender for the fixed native camera' };
  };

  function appearance() {
    return { renderer: 'THREE.WebGPURenderer', revision: THREE.REVISION, backend: renderer.backend.constructor.name, fallbackDisabled: renderer._getFallback === null,
      antialias: true, samples: renderer.samples, pixelRatio: renderer.getPixelRatio(), toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, outputColorSpace: renderer.outputColorSpace,
      shadowMap: { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type }, backgroundLinear: scene.background.toArray(),
      proceduralEnvironment: [.42 * .25, .54 * .25, .66 * .25],
      materials: [...materials.values()].map(material => ({ id: material.id, name: material.name, colorLinear: material.color.toArray(), roughness: material.roughness, metalness: material.metalness, flatShading: material.flatShading, emissiveLinear: material.emissive.toArray(), emissiveIntensity: material.emissiveIntensity })),
      lights: scene.children.filter(item => item.isLight).map(light => ({ id: light.id, name: light.name, type: light.type, position: light.position.toArray(), colorLinear: light.color.toArray(), intensity: light.intensity, distance: light.distance ?? null, decay: light.decay ?? null, castShadow: light.castShadow,
        shadow: light.castShadow ? { mapSize: light.shadow.mapSize.toArray(), bias: light.shadow.bias, normalBias: light.shadow.normalBias, radius: light.shadow.radius, camera: { left: light.shadow.camera.left, right: light.shadow.camera.right, top: light.shadow.camera.top, bottom: light.shadow.camera.bottom, near: light.shadow.camera.near, far: light.shadow.camera.far } } : null })) };
  }
  const adapter = {
    engine: 'threejs', canvas,
    getRuntimeHandles: () => ({ renderer, scene, worker }),
    async applyAndSubmit(state) {
      evidence = null; completedSubmission = null;
      const message = state.index === 0 ? initial : await request(state);
      requireValue(message.workerRevision === state.index + 1 && sameJson(message.parameters, parametersFor(state.edit)), 'Worker parameters differ from frozen contract');
      currentData = message.scene;
      store.install(currentData, message.workerRevision); installedRevision = message.workerRevision;
      let cpu = store.cpuSnapshot(currentData);
      const sourceChecks = [];
      for (let i = 0; i < cpu.meshes.length; i++) {
        const mesh = cpu.meshes[i], source = currentData.meshes[i];
        for (const key of ['positions', 'normals', 'indices', 'matrix']) sourceChecks.push({ name: `${mesh.name}:${key} installed native CPU equals current worker source`, ok: key === 'matrix' ? mesh[key].every((value, j) => value === source[key][j]) : equalValues(mesh[key], source[key]) });
      }
      requireValue(sourceChecks.every(check => check.ok), 'Native CPU state differs from actual worker output');
      activeSubmission = { before: null, drawn: new Map() };
      device.pushErrorScope('validation');
      let gpu, submittedDraws;
      const drawScope = topologyDraws.begin(installedRevision);
      try {
        try { renderer.render(scene, camera); }
        finally { submittedDraws = topologyDraws.end(drawScope); }
        requireValue(completedSubmission?.revision === message.workerRevision, 'Native renderer did not complete the worker revision');
        requireValue(completedSubmission.drawnMeshes.length === store.meshes.length, 'Not every genuine mesh was submitted for the fixed native camera');
        // These copies are queued after the actual render on the same device.
        // mapAsync fences the copy; the shared harness independently fences and captures.
        gpu = await gpuEvidence.read(store.meshes);
      } finally {
        activeSubmission = null;
        const error = await device.popErrorScope();
        if (error) validationErrors.push(error.message);
      }
      requireValue(validationErrors.length === 0 && uncapturedErrors.length === 0, 'Native WebGPU validation error');
      requireValue(gpu.comparisons.every(check => check.ok), 'Actual GPU buffers differ from installed worker revision');
      cpu = store.cpuSnapshot(currentData);
      for (const draw of completedSubmission.drawnMeshes) {
        const current = cpu.meshes.find(mesh => mesh.name === draw.name);
        sourceChecks.push({ name: `${draw.name}:evidence matrix equals actual native draw matrix`, ok: equalValues(current.matrix, draw.worldMatrix) });
      }
      const nativeMeshes = cpu.meshes.map(mesh => {
        const streams = gpu.streamsByMesh.get(mesh.name);
        return { ...mesh, worldMatrix: [...mesh.matrix], positions: streams.find(stream => stream.semantic === 'position').data,
          indices: streams.find(stream => stream.semantic === 'index').data,
          normals: streams.find(stream => stream.semantic === 'normal')?.data ?? mesh.normals,
          normalProvenance: streams.some(stream => stream.semantic === 'normal') ? 'Actual native GPU buffer readback' : 'Native CPU BufferAttribute; no GPU normal allocation because the flat-shaded material derives face normals', streams };
      });
      const nativeChecks = inspectScene({ ...cpu, meshes: nativeMeshes });
      nativeChecks.checks.push(...sourceChecks, ...gpu.comparisons,
        { name: 'Exact worker revision observed by native scene before/after-render callbacks and every native mesh draw', ok: completedSubmission.revision === installedRevision && completedSubmission.drawnMeshes.every(mesh => mesh.workerRevision === installedRevision) },
        { name: 'No WebGPU validation or uncaptured errors', ok: validationErrors.length === 0 && uncapturedErrors.length === 0 });
      nativeChecks.ok = nativeChecks.checks.every(check => check.ok);
      requireValue(nativeChecks.ok, 'Native geometry validation failed');
      let entityCount = 0; scene.traverse(() => entityCount++);
      evidence = {
        stateId: state.id, revision: installedRevision, parameters: { ...currentData.parameters },
        camera: { position: camera.position.toArray(), target: [...settings.target], verticalSpan: camera.top - camera.bottom, near: camera.near, far: camera.far, up: camera.up.toArray(), worldMatrix: camera.matrixWorld.toArray(), projectionMatrix: camera.projectionMatrix.toArray() },
        appearance: appearance(),
        identity: { sceneId: scene.id, entityCount, meshCount: store.meshes.length, meshes: store.meshes.map(mesh => ({ name: mesh.name, entityId: mesh.id, meshId: mesh.id })) },
        resources: { nativeObjects: { ...store.counters }, gpu: { ...gpu.counters }, stagingBufferSize: gpu.stagingBufferSize, inventory: gpu.inventory,
          definitions: { entityCount: 'Actual Object3D nodes traversed under the persistent THREE.Scene, including scene, native Mesh objects, lights and light target; camera is separate.', meshIdentity: 'entityId and meshId are the same genuine THREE.Mesh.id; no synthetic semantic IDs substitute for identities.', nativeObjects: 'Actual constructor, geometry assignment, dispose(), in-place typed-array write and matrix update operations performed by the adapter; no inferred GC counts.', gpu: 'Geometry GPUBuffer identities compared by object reference across every completed readback; observed identity numbers are WeakMap reference labels, not engine IDs. Readback counters count actual successful native calls. Engine internal buffers/textures are counted independently by the shared harness.', limitations: 'Counts and allocated buffer descriptors are not GPU memory, residency, performance, leak freedom or destruction by GC measurements.' } },
        sourceGeometry: jsonSafe({ ...currentData, meshes: currentData.meshes.map(mesh => ({ ...mesh, rawStreams: ['positions', 'normals', 'indices'].map(semantic => ({ semantic, arrayType: mesh[semantic].constructor.name, byteOffset: mesh[semantic].byteOffset, byteLength: mesh[semantic].byteLength, rawBytes: Array.from(new Uint8Array(mesh[semantic].buffer, mesh[semantic].byteOffset, mesh[semantic].byteLength)) })) })) }),
        nativeCpuGeometry: { provenance: 'Fresh actual THREE.BufferGeometry attributes and Mesh.matrixWorld after the correlated render/readback; matrices compared with those observed in actual native draw callbacks', ...cpu },
        nativeGeometry: { provenance: 'positions/indices and allocated normal streams are exact GPUBuffer readbacks after the correlated native frame; worldMatrix is the actual Mesh.matrixWorld submitted for that revision', meshes: nativeMeshes, submittedDraws },
        workerChecks: message.checks, nativeChecks, validationErrors: [...validationErrors], uncapturedErrors: [...uncapturedErrors],
      };
      return { stateId: state.id, revision: installedRevision, workerRevision: message.workerRevision, submittedRevision: completedSubmission.revision, nativeFrame: completedSubmission.afterRendererFrame,
        details: { nativeFrameDefinition: 'Actual renderer.info.frame at fixed-camera THREE.Scene.onAfterRender; renderer.info.calls disambiguates native render calls within an animation frame.', correspondence: completedSubmission, gpuReadback: { afterCorrelatedRender: true, comparedBytesExactly: true, streams: gpu.inventory.filter(stream => stream.gpuAllocated).length, readbackSubmission: gpu.counters.readbackSubmissions }, validationErrors: [...validationErrors] } };
    },
    async readEvidence(state, receipt) {
      requireValue(evidence?.stateId === state.id && evidence.revision === receipt.submittedRevision, 'Evidence does not correspond to requested native frame');
      return evidence;
    },
  };
  globalThis.__CRANE_LIVE_NATIVE__ = { adapter, renderer, scene, camera, worker, meshes: store.meshes };
  await runLiveEditHarness(adapter, { tracking });
}
main().catch(error => {
  if (!globalThis.__CRANE_LIVE_READY__) globalThis.__CRANE_LIVE_READY__ = { ok: false, error: error.message };
  globalThis.__CRANE_LIVE_ERROR__ = { name: error.name, message: error.message, stack: error.stack };
  const node = document.querySelector('#error'); node.style.display = 'block'; node.textContent = `Native live scene failed\n${error.stack ?? error.message}`;
  console.error(error);
});
