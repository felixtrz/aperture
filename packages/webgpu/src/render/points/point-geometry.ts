import type { PointsPacket, RenderSnapshot } from "@aperture-engine/render";
import { transformPointByFlatMatrix } from "../lines/line-geometry.js";

/**
 * Per-point instance stride in floats (E1): three `vec4f` — `position (xyz
 * world, w = size)`, `color`, and `params (attenuation flag, round flag, 0, 0)`.
 */
export const POINT_INSTANCE_FLOAT_STRIDE = 12;

export interface PointCloudBatch {
  readonly renderId: number;
  readonly firstInstance: number;
  readonly instanceCount: number;
  readonly sortKey: PointsPacket["sortKey"];
}

export interface PackedPointInstances {
  readonly data: Float32Array;
  readonly batches: readonly PointCloudBatch[];
  readonly pointCount: number;
}

/**
 * Perspective point size in pixels (E1, matching three.js `PointsMaterial`
 * `sizeAttenuation`): a world-space `worldSize` at clip depth `clipW`
 * (== -viewZ for a standard perspective) subtends `worldSize * 0.5 *
 * viewportHeight / clipW` pixels — nearer points (smaller `clipW`) are larger.
 * Falls back to the world size when `clipW` is non-positive (behind the eye).
 */
export function perspectivePointSizePixels(
  worldSize: number,
  viewportHeight: number,
  clipW: number,
): number {
  if (!(clipW > 0)) {
    return worldSize;
  }

  return (worldSize * 0.5 * viewportHeight) / clipW;
}

/**
 * Pack every point-cloud packet into one shared per-point instance buffer plus
 * a per-cloud draw batch. Positions are transformed to world space; colors come
 * from the snapshot `pointColors` family (uniform tint already folded per-point
 * at extraction).
 */
export function packPointInstances(
  snapshot: RenderSnapshot,
  points: readonly PointsPacket[],
): PackedPointInstances {
  const vertices = snapshot.pointVertices ?? new Float32Array(0);
  const colors = snapshot.pointColors ?? new Float32Array(0);
  const transforms = snapshot.transforms;
  let totalPoints = 0;

  for (const cloud of points) {
    totalPoints += cloud.vertexCount;
  }

  const data = new Float32Array(
    Math.max(1, totalPoints) * POINT_INSTANCE_FLOAT_STRIDE,
  );
  const batches: PointCloudBatch[] = [];
  let pointCursor = 0;

  for (const cloud of points) {
    const firstInstance = pointCursor;

    for (let index = 0; index < cloud.vertexCount; index += 1) {
      const pointIndex = cloud.vertexOffset + index;
      const source = pointIndex * 3;
      const world = transformPointByFlatMatrix(
        transforms,
        cloud.worldTransformOffset,
        vertices[source] ?? 0,
        vertices[source + 1] ?? 0,
        vertices[source + 2] ?? 0,
      );
      const target = pointCursor * POINT_INSTANCE_FLOAT_STRIDE;
      const colorBase = pointIndex * 4;

      data[target] = world[0];
      data[target + 1] = world[1];
      data[target + 2] = world[2];
      data[target + 3] = cloud.size;
      data[target + 4] = colors[colorBase] ?? cloud.color[0] ?? 1;
      data[target + 5] = colors[colorBase + 1] ?? cloud.color[1] ?? 1;
      data[target + 6] = colors[colorBase + 2] ?? cloud.color[2] ?? 1;
      data[target + 7] = colors[colorBase + 3] ?? cloud.color[3] ?? 1;
      data[target + 8] = cloud.sizeAttenuation ? 1 : 0;
      data[target + 9] = cloud.round ? 1 : 0;
      data[target + 10] = 0;
      data[target + 11] = 0;
      pointCursor += 1;
    }

    batches.push({
      renderId: cloud.renderId,
      firstInstance,
      instanceCount: cloud.vertexCount,
      sortKey: cloud.sortKey,
    });
  }

  return { data, batches, pointCount: totalPoints };
}
