/** Independent analytic camera expectations; no engine imports or browser work. */
import { VIEWS, viewFor } from './contract.mjs';
const requireValue = (ok, message) => { if (!ok) throw Error(message); };
const exact = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const unit = a => a.map(value => value / Math.hypot(...a));
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const MATRIX_TOLERANCE = 2e-5;
export function matrixNear(actual, expected) {
  return Array.isArray(actual) && actual.length === 16 && actual.every((n, i) => Number.isFinite(n) && Math.abs(n - expected[i]) <= MATRIX_TOLERANCE);
}
export function multiply(a, b) {
  return Array.from({ length: 16 }, (_, i) => {
    const row = i % 4, col = Math.floor(i / 4);
    return [0, 1, 2, 3].reduce((sum, k) => sum + a[k*4+row] * b[col*4+k], 0);
  });
}
export function expectedCamera(engine, name, coordinateSystem = 'webgpu') {
  requireValue(['aperture', 'threejs'].includes(engine) && Object.hasOwn(VIEWS, name), 'Unknown camera expectation');
  requireValue(['webgpu', 'webgl'].includes(coordinateSystem) && (engine !== 'aperture' || coordinateSystem === 'webgpu'), 'Unknown projection convention');
  const { position: p, target, verticalSpan } = VIEWS[name], near = .1, far = engine === 'aperture' ? 80 : 100;
  const z = unit(p.map((v, i) => v - target[i])), x = unit(cross([0, 1, 0], z)), y = cross(z, x);
  const worldMatrix = [...x, 0, ...y, 0, ...z, 0, ...p, 1];
  const viewMatrix = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x,p), -dot(y,p), -dot(z,p), 1];
  const webgpu = coordinateSystem === 'webgpu';
  const projectionMatrix = [2/verticalSpan,0,0,0, 0,2/verticalSpan,0,0, 0,0,(webgpu ? -1 : -2)/(far-near),0, 0,0,webgpu ? -near/(far-near) : -(far+near)/(far-near),1];
  return { name, position: [...p], target: [...target], verticalSpan, near, far, coordinateSystem, worldMatrix, viewMatrix, projectionMatrix, viewProjectionMatrix: multiply(projectionMatrix, viewMatrix) };
}
export function apertureCamera(snapshot) {
  requireValue(snapshot?.views?.length === 1, 'Exactly one consumed native camera required');
  const view = snapshot.views[0], data = snapshot.viewMatrices;
  requireValue(view.renderTarget === null && data, 'Consumed swapchain camera missing');
  const out = { provenance: 'Actual native renderSnapshot input after correlated method completion', frame: snapshot.frame, viewId: view.viewId, cameraEntity: view.camera };
  for (const name of ['viewMatrix', 'projectionMatrix', 'viewProjectionMatrix']) {
    const offset = view[name + 'Offset'];
    requireValue(Number.isSafeInteger(offset) && offset >= 0 && offset + 16 <= data.length, 'Invalid consumed camera matrix range');
    out[name] = Array.from(data.slice(offset, offset + 16));
  }
  return out;
}
export function threeCamera(camera) {
  return { cameraId: camera.id, name: camera.name, position: camera.position.toArray(), up: camera.up.toArray(), near: camera.near, far: camera.far, verticalSpan: camera.top - camera.bottom, coordinateSystem: camera.coordinateSystem === 2001 ? 'webgpu' : camera.coordinateSystem === 2000 ? 'webgl' : 'unknown', worldMatrix: camera.matrixWorld.toArray(), viewMatrix: camera.matrixWorldInverse.toArray(), projectionMatrix: camera.projectionMatrix.toArray(), viewProjectionMatrix: multiply(camera.projectionMatrix.toArray(), camera.matrixWorldInverse.toArray()) };
}
export function validateCameraMatrices(actual, engine, name, coordinateSystem = 'webgpu') {
  const expected = expectedCamera(engine, name, coordinateSystem);
  for (const key of ['viewMatrix', 'projectionMatrix', 'viewProjectionMatrix']) requireValue(matrixNear(actual?.[key], expected[key]), `Actual ${engine} ${key} differs from selected catalog camera`);
  requireValue(!matrixNear(actual.viewMatrix, expectedCamera(engine, 'front-quarter', coordinateSystem).viewMatrix), 'Native camera did not change from front-quarter');
}
export function validateCameraEvidence(evidence, state, receipt, engine) {
  const selected = viewFor(state), camera = evidence.camera;
  requireValue(camera?.name === selected.name && exact(camera.position, selected.position) && exact(camera.target, selected.target) && camera.verticalSpan === selected.verticalSpan, 'Selected catalog camera mismatch');
  requireValue(camera.near === .1 && camera.far === (engine === 'aperture' ? 80 : 100), 'Inherited camera clipping changed');
  if (engine === 'aperture') {
    const snapshot = evidence.nativeGeometry?.actualSubmittedSnapshot;
    requireValue(snapshot?.frame === receipt.nativeFrame && receipt.details?.actualRenderSnapshotFrame === snapshot.frame && receipt.details?.nativeRenderMethodCompletionObserved === true, 'Consumed camera/frame correspondence missing');
    const actual = apertureCamera(snapshot);
    requireValue(exact(camera.native, actual), 'Reported camera differs from actual consumed snapshot');
    validateCameraMatrices(actual, engine, selected.name);
  } else {
    const c = receipt.details?.correspondence;
    requireValue(c?.revision === receipt.revision && c?.cameraId === camera.native?.cameraId, 'Native camera/revision correspondence missing');
    requireValue(exact(c.cameraBefore, camera.native) && exact(c.cameraAfter, camera.native), 'Native camera changed between render callbacks/evidence');
    requireValue(camera.native.coordinateSystem === 'webgpu' && camera.native.name === selected.name && exact(camera.native.position, selected.position) && exact(camera.native.up, [0,1,0]) && camera.native.near === .1 && camera.native.far === 100 && camera.native.verticalSpan === 10.5, 'Native callback camera settings mismatch');
    validateCameraMatrices(camera.native, engine, selected.name);
    requireValue(matrixNear(camera.native.worldMatrix, expectedCamera(engine, selected.name).worldMatrix), 'Native camera world matrix mismatch');
  }
}
