import type { Aabb, BoundingSphere, Mat4 } from "@aperture-engine/simulation";
import type { RenderEntityRef } from "./snapshot.js";

export interface FrustumPlane {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly constant: number;
}

export interface MutableViewCullStats {
  viewId: number;
  camera: RenderEntityRef;
  tested: number;
  culled: number;
  included: number;
}

export interface ViewCullContext {
  readonly viewId: number;
  readonly camera: RenderEntityRef;
  readonly priority: number;
  readonly layerMask: number;
  readonly viewMatrix: Mat4;
  readonly frustumCulling: boolean;
  readonly planes: readonly FrustumPlane[];
  readonly stats: MutableViewCullStats;
}

export function isVisibleInAnyMatchingView(
  worldAabb: Aabb,
  layerMask: number,
  viewCullContexts: readonly ViewCullContext[],
): boolean {
  let matchedView = false;
  let includedInAnyView = false;

  for (const context of viewCullContexts) {
    if ((context.layerMask & layerMask) === 0) {
      continue;
    }

    matchedView = true;

    if (!context.frustumCulling) {
      context.stats.included += 1;
      includedInAnyView = true;
      continue;
    }

    context.stats.tested += 1;

    if (aabbIntersectsFrustum(worldAabb, context.planes)) {
      context.stats.included += 1;
      includedInAnyView = true;
    } else {
      context.stats.culled += 1;
    }
  }

  return !matchedView || includedInAnyView;
}

export function firstMatchingSortView(
  layerMask: number,
  viewCullContexts: readonly ViewCullContext[],
): ViewCullContext | undefined {
  for (const context of viewCullContexts) {
    if ((context.layerMask & layerMask) !== 0) {
      return context;
    }
  }

  return undefined;
}

export function computeViewDepth(
  viewMatrix: Mat4,
  worldCenter: BoundingSphere["center"],
): number {
  const x = worldCenter[0] ?? 0;
  const y = worldCenter[1] ?? 0;
  const z = worldCenter[2] ?? 0;

  return -(
    x * (viewMatrix[2] ?? 0) +
    y * (viewMatrix[6] ?? 0) +
    z * (viewMatrix[10] ?? 0) +
    (viewMatrix[14] ?? 0)
  );
}

function aabbIntersectsFrustum(
  aabb: Aabb,
  planes: readonly FrustumPlane[],
): boolean {
  for (const plane of planes) {
    const x = plane.x > 0 ? readVec3(aabb.max, 0) : readVec3(aabb.min, 0);
    const y = plane.y > 0 ? readVec3(aabb.max, 1) : readVec3(aabb.min, 1);
    const z = plane.z > 0 ? readVec3(aabb.max, 2) : readVec3(aabb.min, 2);

    if (plane.x * x + plane.y * y + plane.z * z + plane.constant < 0) {
      return false;
    }
  }

  return true;
}

export function createFrustumPlanes(matrix: Mat4): readonly FrustumPlane[] {
  const m0 = readMat4(matrix, 0);
  const m1 = readMat4(matrix, 1);
  const m2 = readMat4(matrix, 2);
  const m3 = readMat4(matrix, 3);
  const m4 = readMat4(matrix, 4);
  const m5 = readMat4(matrix, 5);
  const m6 = readMat4(matrix, 6);
  const m7 = readMat4(matrix, 7);
  const m8 = readMat4(matrix, 8);
  const m9 = readMat4(matrix, 9);
  const m10 = readMat4(matrix, 10);
  const m11 = readMat4(matrix, 11);
  const m12 = readMat4(matrix, 12);
  const m13 = readMat4(matrix, 13);
  const m14 = readMat4(matrix, 14);
  const m15 = readMat4(matrix, 15);

  return [
    normalizePlane(m3 - m0, m7 - m4, m11 - m8, m15 - m12),
    normalizePlane(m3 + m0, m7 + m4, m11 + m8, m15 + m12),
    normalizePlane(m3 + m1, m7 + m5, m11 + m9, m15 + m13),
    normalizePlane(m3 - m1, m7 - m5, m11 - m9, m15 - m13),
    normalizePlane(m3 - m2, m7 - m6, m11 - m10, m15 - m14),
    normalizePlane(m2, m6, m10, m14),
  ];
}

function readMat4(matrix: Mat4, index: number): number {
  return matrix[index] ?? 0;
}

function normalizePlane(
  x: number | undefined,
  y: number | undefined,
  z: number | undefined,
  constant: number | undefined,
): FrustumPlane {
  const nx = x ?? 0;
  const ny = y ?? 0;
  const nz = z ?? 0;
  const d = constant ?? 0;
  const length = Math.hypot(nx, ny, nz);

  if (length === 0) {
    return { x: nx, y: ny, z: nz, constant: d };
  }

  return {
    x: nx / length,
    y: ny / length,
    z: nz / length,
    constant: d / length,
  };
}

export function createViewCullSignature(
  viewCullContexts: readonly ViewCullContext[],
): number {
  let hash = 2_166_136_261;

  for (const context of viewCullContexts) {
    hash = hashCullNumber(hash, context.viewId);
    hash = hashCullNumber(hash, context.priority);
    hash = hashCullNumber(hash, context.layerMask);
    hash = hashCullNumber(hash, context.frustumCulling ? 1 : 0);

    for (const plane of context.planes) {
      hash = hashCullNumber(hash, plane.x);
      hash = hashCullNumber(hash, plane.y);
      hash = hashCullNumber(hash, plane.z);
      hash = hashCullNumber(hash, plane.constant);
    }
  }

  return hash >>> 0;
}

function hashCullNumber(hash: number, value: number): number {
  const scaled = Number.isFinite(value) ? Math.trunc(value * 1_000_000) : 0;

  return Math.imul(hash ^ scaled, 16_777_619) >>> 0;
}

function readVec3(values: Aabb["min"], index: 0 | 1 | 2): number {
  return values[index] ?? 0;
}
