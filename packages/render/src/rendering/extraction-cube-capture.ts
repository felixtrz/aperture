// B2 (three.js parity plan): cube-capture camera support for extraction.
// A camera whose `renderTargetId` names a cube render target emits six
// 90-degree square face views per scheduled capture instead of one view. The
// faces are world-axis aligned at the camera's position (the entity rotation
// is intentionally ignored, like three.js CubeCamera) and follow the WebGPU
// cube-layer order +X, -X, +Y, -Y, +Z, -Z.
//
// Orientation convention: rendering into a cube face with a proper (non-
// mirroring) camera rotation cannot reproduce the GL/WebGPU cube-map texel
// layout exactly (the face bases are left-handed), so the captured cube stores
// the X-mirrored environment — face +X looks along world -X, etc. Consumers
// compensate by sampling with a flipped X direction (`sourceFlipX` on the IBL
// prefilter kernels), the same convention three.js uses for CubeCamera
// targets (`flipEnvMap`). This keeps triangle winding (and therefore
// back-face culling) correct in every face pass.

import { identityMat4, type Mat4 } from "@aperture-engine/simulation";
import type { RenderEntityRef } from "./snapshot-packet-types.js";
import type { CubeCaptureCacheEntry } from "./extraction-mesh-cache.js";

export const CUBE_CAPTURE_FACE_COUNT = 6;

interface CubeCaptureFaceBasis {
  readonly right: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly forward: readonly [number, number, number];
}

// Derived from the repo's cube-direction kernels (equirect-to-cube / PMREM /
// irradiance): face f texel (u, v) must hold the radiance along the X-mirror
// of `cubeDirection(f, uv)`. Each basis below is a proper rotation.
const CUBE_CAPTURE_FACE_BASES: readonly CubeCaptureFaceBasis[] = [
  // +X layer (captures world -X)
  { right: [0, 0, -1], up: [0, 1, 0], forward: [-1, 0, 0] },
  // -X layer (captures world +X)
  { right: [0, 0, 1], up: [0, 1, 0], forward: [1, 0, 0] },
  // +Y layer
  { right: [-1, 0, 0], up: [0, 0, -1], forward: [0, 1, 0] },
  // -Y layer
  { right: [-1, 0, 0], up: [0, 0, 1], forward: [0, -1, 0] },
  // +Z layer
  { right: [-1, 0, 0], up: [0, 1, 0], forward: [0, 0, 1] },
  // -Z layer
  { right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, -1] },
];

/**
 * Stable per-face view id: the camera's stable render id with the face index
 * folded into the generation byte. Distinct live entities always differ in
 * the index bits, so face ids can never collide across cameras; within one
 * camera the six generation offsets keep the faces distinct.
 */
export function createCubeCaptureFaceViewId(
  camera: RenderEntityRef,
  face: number,
): number {
  return (
    (((camera.generation + face) & 0xff) << 24) | (camera.index & 0x00ff_ffff)
  );
}

/**
 * Column-major world-to-view matrix for one cube face at `position` (world
 * translation of the capture camera; rotation is ignored by design).
 */
export function cubeCaptureFaceViewMatrix(
  position: readonly [number, number, number],
  face: number,
): Mat4 {
  const basis = CUBE_CAPTURE_FACE_BASES[face];

  if (basis === undefined) {
    throw new RangeError(
      `Cube capture face ${String(face)} must be in [0, ${String(CUBE_CAPTURE_FACE_COUNT - 1)}].`,
    );
  }

  const { right, up, forward } = basis;
  const matrix = identityMat4();

  matrix[0] = right[0];
  matrix[1] = up[0];
  matrix[2] = -forward[0];
  matrix[4] = right[1];
  matrix[5] = up[1];
  matrix[6] = -forward[1];
  matrix[8] = right[2];
  matrix[9] = up[2];
  matrix[10] = -forward[2];
  matrix[12] = -dot(right, position);
  matrix[13] = -dot(up, position);
  matrix[14] = dot(forward, position);
  return matrix;
}

export interface CubeCaptureScheduleInput {
  /** Extraction frame index (`RenderSnapshot.frame`). */
  readonly frame: number;
  /** `Camera.captureEvery`: capture when `frame % N === 0`; 0 = on-demand. */
  readonly captureEvery: number;
  /** `Camera.captureRequestFrame`: one-shot fire at `frame >= value`; -1 = none. */
  readonly captureRequestFrame: number;
  /** Stable view id of the capture camera (cache key). */
  readonly viewId: number;
  /** Persistent capture bookkeeping; `undefined` falls back to stateless gating. */
  readonly cubeCaptures: Map<number, CubeCaptureCacheEntry> | undefined;
}

/**
 * Decide whether a cube-capture camera emits its six face views this frame,
 * updating the capture bookkeeping when it fires. Fires when (a) the camera
 * has never captured (probe priming), (b) the periodic schedule hits
 * (`captureEvery > 0 && frame % captureEvery === 0`), or (c) a not-yet-honored
 * one-shot request is due. Without a cache, priming is unavailable and
 * requests fire on exact-frame match only.
 */
export function resolveCubeCaptureSchedule(
  input: CubeCaptureScheduleInput,
): boolean {
  const entry = input.cubeCaptures?.get(input.viewId);
  const scheduled =
    input.captureEvery > 0 && input.frame % input.captureEvery === 0;
  const prime = input.cubeCaptures !== undefined && entry === undefined;
  const requested =
    input.captureRequestFrame >= 0 &&
    input.frame >= input.captureRequestFrame &&
    (input.cubeCaptures === undefined
      ? input.frame === input.captureRequestFrame
      : (entry?.lastRequestFrame ?? -1) < input.captureRequestFrame);

  if (!scheduled && !prime && !requested) {
    return false;
  }

  input.cubeCaptures?.set(input.viewId, {
    lastCaptureFrame: input.frame,
    lastRequestFrame: requested
      ? input.captureRequestFrame
      : (entry?.lastRequestFrame ?? -1),
  });

  return true;
}

function dot(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
