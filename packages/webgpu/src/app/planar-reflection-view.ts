import { invertMat4, multiplyMat4 } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";

export {
  resolvePlanarReflectionOptions,
  type WebGpuPlanarReflectionOptions,
} from "@aperture-engine/render";

/** Derive a mirrored camera and oblique near clip; source snapshot stays immutable. */
export function createPlanarReflectionView(
  snapshot: RenderSnapshot,
  height: number,
  clipBias: number,
): {
  snapshot: RenderSnapshot;
  inverseViewProjection: Float32Array;
  reflectionViewProjection: Float32Array;
} {
  const view = snapshot.views[0];
  if (
    snapshot.views.length !== 1 ||
    view === undefined ||
    view.renderTarget !== null ||
    [0, 0, 1, 1].some((value, i) => view.viewport[i] !== value) ||
    [0, 0, 1, 1].some((value, i) => view.scissor[i] !== value)
  )
    throw new Error(
      "planarReflection requires one camera with a full viewport/scissor targeting the main output.",
    );
  const matrices = snapshot.viewMatrices;
  const cameraView = matrices.slice(
    view.viewMatrixOffset,
    view.viewMatrixOffset + 16,
  );
  const projection = matrices.slice(
    view.projectionMatrixOffset,
    view.projectionMatrixOffset + 16,
  );
  const inverseViewProjection = invertMat4(
    multiplyMat4(projection, cameraView),
  );
  if (inverseViewProjection === null)
    throw new Error(
      "planarReflection requires an invertible camera projection.",
    );
  const mirror = new Float32Array([
    1,
    0,
    0,
    0,
    0,
    -1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    2 * height,
    0,
    1,
  ]);
  const reflectedView = multiplyMat4(cameraView, mirror);
  // Reflection reverses handedness; flip camera X to preserve front-face winding.
  for (let col = 0; col < 4; col++)
    reflectedView[col * 4] = -reflectedView[col * 4]!;
  const inverseView = invertMat4(reflectedView);
  const inverseProjection = invertMat4(projection);
  if (inverseView === null || inverseProjection === null)
    throw new Error(
      "planarReflection requires invertible view and projection matrices.",
    );
  const plane = new Float32Array(4);
  for (let col = 0; col < 4; col++)
    plane[col] =
      inverseView[col * 4 + 1]! -
      (height + clipBias) * inverseView[col * 4 + 3]!;
  const corner = [Math.sign(plane[0]!) || 1, Math.sign(plane[1]!) || 1, 1, 1];
  const q = new Float32Array(4);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++)
      q[row] = q[row]! + inverseProjection[col * 4 + row]! * corner[col]!;
  const denominator = plane.reduce((sum, value, i) => sum + value * q[i]!, 0);
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-8)
    throw new Error(
      "planarReflection clip plane is degenerate for this camera.",
    );
  // WebGPU near is z=0 (not OpenGL z=-w): replace row 2 with the camera-space plane.
  for (let col = 0; col < 4; col++)
    projection[col * 4 + 2] = plane[col]! / denominator;
  const reflectionViewProjection = multiplyMat4(projection, reflectedView);
  const viewMatrices = matrices.slice();
  viewMatrices.set(reflectedView, view.viewMatrixOffset);
  viewMatrices.set(projection, view.projectionMatrixOffset);
  viewMatrices.set(reflectionViewProjection, view.viewProjectionMatrixOffset);
  // Include independently extracted off-camera shadow casters where available.
  // Disable camera frustum culling when non-shadow-casting offscreen objects matter.
  const draws = new Map(
    snapshot.meshDraws.map((draw) => [draw.renderId, draw]),
  );
  for (const draw of snapshot.shadowCasterDraws ?? [])
    draws.set(draw.renderId, draw);
  return {
    inverseViewProjection,
    reflectionViewProjection,
    snapshot: {
      ...snapshot,
      viewMatrices,
      meshDraws: [...draws.values()],
      views: [{ ...view, viewport: [0, 0, 1, 1], scissor: [0, 0, 1, 1] }],
      spriteDraws: [],
      particleEmitters: [],
      quadBatches: [],
      uiNodes: [],
      uiHitRegions: [],
    },
  };
}
