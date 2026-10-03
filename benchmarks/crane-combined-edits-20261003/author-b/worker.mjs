import { buildScene } from './scene-data.mjs';
import { inspectScene } from './checks.mjs';

// This single persistent worker owns the monotonic build revision. Requests may
// name only the next revision; an echoed request number is not used as evidence.
let revision = 0;
let parameters = null;
self.onmessage = ({ data: request }) => {
  try {
    if (request.type !== 'apply' || request.revision !== revision + 1) throw Error('Out-of-order worker revision');
    const scene = buildScene(request.edit);
    const checks = inspectScene(scene);
    if (!checks.ok) throw Error('Worker source geometry failed its inherited checks');
    parameters = { ...scene.parameters };
    revision++;
    const transfers = scene.meshes.flatMap(mesh => [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer]);
    self.postMessage({ type: 'scene', stateId: request.stateId, workerRevision: revision, parameters, scene, checks }, transfers);
  } catch (error) {
    self.postMessage({ type: 'error', stateId: request.stateId, workerRevision: revision, error: { name: error.name, message: error.message, stack: error.stack } });
  }
};
