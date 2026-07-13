import type { LinePacket, RenderSnapshot } from "@aperture-engine/render";

/**
 * Per-segment instance stride in floats (E1). Each fat-line segment instance is
 * five `vec4f`: `p0 (xyz world, w = arc length u0)`, `p1 (xyz world, w = u1)`,
 * `color0`, `color1`, and `params (width px, dashSize, gapSize, dashOffset)`.
 */
export const LINE_SEGMENT_FLOAT_STRIDE = 20;

/**
 * Per-line draw batch over the shared segment instance buffer: a run of
 * `instanceCount` consecutive segment instances starting at `firstInstance`.
 */
export interface LineSegmentBatch {
  readonly renderId: number;
  readonly firstInstance: number;
  readonly instanceCount: number;
  readonly sortKey: LinePacket["sortKey"];
}

export interface PackedLineSegments {
  readonly data: Float32Array;
  readonly batches: readonly LineSegmentBatch[];
  readonly segmentCount: number;
}

/**
 * Transform a point by a column-major `mat4` stored as a flat 16-float array at
 * `offset` (the snapshot `transforms` layout). Returns world xyz.
 */
export function transformPointByFlatMatrix(
  transforms: ArrayLike<number>,
  offset: number,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const m0 = transforms[offset] ?? 0;
  const m1 = transforms[offset + 1] ?? 0;
  const m2 = transforms[offset + 2] ?? 0;
  const m4 = transforms[offset + 4] ?? 0;
  const m5 = transforms[offset + 5] ?? 0;
  const m6 = transforms[offset + 6] ?? 0;
  const m8 = transforms[offset + 8] ?? 0;
  const m9 = transforms[offset + 9] ?? 0;
  const m10 = transforms[offset + 10] ?? 0;
  const m12 = transforms[offset + 12] ?? 0;
  const m13 = transforms[offset + 13] ?? 0;
  const m14 = transforms[offset + 14] ?? 0;

  return [
    m0 * x + m4 * y + m8 * z + m12,
    m1 * x + m5 * y + m9 * z + m13,
    m2 * x + m6 * y + m10 * z + m14,
  ];
}

/**
 * Cumulative arc length along a polyline whose vertices are supplied as flat
 * world-space xyz (`[x0,y0,z0, x1,...]`). `out[i]` is the distance from vertex
 * 0 to vertex i (out[0] === 0), so dash phase is world-continuous.
 */
export function cumulativeArcLengths(
  worldXyz: ArrayLike<number>,
  vertexCount: number,
): Float64Array {
  const out = new Float64Array(vertexCount);

  for (let index = 1; index < vertexCount; index += 1) {
    const ax = worldXyz[(index - 1) * 3] ?? 0;
    const ay = worldXyz[(index - 1) * 3 + 1] ?? 0;
    const az = worldXyz[(index - 1) * 3 + 2] ?? 0;
    const bx = worldXyz[index * 3] ?? 0;
    const by = worldXyz[index * 3 + 1] ?? 0;
    const bz = worldXyz[index * 3 + 2] ?? 0;

    out[index] = (out[index - 1] ?? 0) + Math.hypot(bx - ax, by - ay, bz - az);
  }

  return out;
}

// Per-corner selectors shared by the WGSL vertex shader (see LINE_WGSL). Corner
// order emits two triangles [A,B,C, A,C,D] covering the capsule bounding box of
// the segment: A/B sit at p0, C/D at p1; perp offsets ±halfWidth across the
// segment; along offsets ±halfWidth extend the round caps past each endpoint.
export const LINE_QUAD_ENDPOINT = [0, 0, 1, 0, 1, 1] as const;
export const LINE_QUAD_PERP = [-1, 1, 1, -1, 1, -1] as const;
export const LINE_QUAD_ALONG = [-1, -1, 1, -1, 1, 1] as const;

/**
 * Reference (CPU twin of the vertex shader) for the screen-space quad
 * expansion: given the two segment endpoints in pixel space, half the
 * screen-space width in pixels, and a corner index [0,6), return the corner's
 * pixel-space position. A degenerate (zero-length) segment falls back to the
 * +x axis so caps still render a round dot.
 */
export function expandSegmentQuadCornerPixels(
  p0: readonly [number, number],
  p1: readonly [number, number],
  halfWidthPx: number,
  cornerIndex: number,
): [number, number] {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const length = Math.hypot(dx, dy);
  const dirX = length > 1e-6 ? dx / length : 1;
  const dirY = length > 1e-6 ? dy / length : 0;
  const normalX = -dirY;
  const normalY = dirX;
  const endpoint = LINE_QUAD_ENDPOINT[cornerIndex] ?? 0;
  const perp = LINE_QUAD_PERP[cornerIndex] ?? 0;
  const along = LINE_QUAD_ALONG[cornerIndex] ?? 0;
  const base = endpoint === 0 ? p0 : p1;

  return [
    base[0] + normalX * perp * halfWidthPx + dirX * along * halfWidthPx,
    base[1] + normalY * perp * halfWidthPx + dirY * along * halfWidthPx,
  ];
}

/** Shortest distance from a pixel to a segment (the fragment-shader capsule SDF). */
export function distancePointToSegmentPixels(
  point: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const lengthSquared = abx * abx + aby * aby;

  if (lengthSquared < 1e-9) {
    return Math.hypot(point[0] - a[0], point[1] - a[1]);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - a[0]) * abx + (point[1] - a[1]) * aby) / lengthSquared,
    ),
  );

  return Math.hypot(point[0] - (a[0] + t * abx), point[1] - (a[1] + t * aby));
}

/**
 * Pack every fat-line packet into one shared per-segment instance buffer plus a
 * per-line draw batch. Vertices are transformed to world space (from the
 * snapshot `transforms` world matrix) so arc lengths — and therefore dashes —
 * are world-continuous.
 */
export function packLineSegmentInstances(
  snapshot: RenderSnapshot,
  lines: readonly LinePacket[],
): PackedLineSegments {
  const vertices = snapshot.lineVertices ?? new Float32Array(0);
  const transforms = snapshot.transforms;
  let totalSegments = 0;

  for (const line of lines) {
    totalSegments += Math.max(0, line.vertexCount - 1);
  }

  const data = new Float32Array(
    Math.max(1, totalSegments) * LINE_SEGMENT_FLOAT_STRIDE,
  );
  const batches: LineSegmentBatch[] = [];
  let segmentCursor = 0;

  for (const line of lines) {
    const segmentCount = Math.max(0, line.vertexCount - 1);

    if (segmentCount === 0) {
      continue;
    }

    const world = new Float64Array(line.vertexCount * 3);

    for (let index = 0; index < line.vertexCount; index += 1) {
      const source = (line.vertexOffset + index) * 3;
      const point = transformPointByFlatMatrix(
        transforms,
        line.worldTransformOffset,
        vertices[source] ?? 0,
        vertices[source + 1] ?? 0,
        vertices[source + 2] ?? 0,
      );

      world[index * 3] = point[0];
      world[index * 3 + 1] = point[1];
      world[index * 3 + 2] = point[2];
    }

    const arcLengths = cumulativeArcLengths(world, line.vertexCount);
    const firstInstance = segmentCursor;

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const target = segmentCursor * LINE_SEGMENT_FLOAT_STRIDE;

      data[target] = world[segment * 3] ?? 0;
      data[target + 1] = world[segment * 3 + 1] ?? 0;
      data[target + 2] = world[segment * 3 + 2] ?? 0;
      data[target + 3] = arcLengths[segment] ?? 0;
      data[target + 4] = world[(segment + 1) * 3] ?? 0;
      data[target + 5] = world[(segment + 1) * 3 + 1] ?? 0;
      data[target + 6] = world[(segment + 1) * 3 + 2] ?? 0;
      data[target + 7] = arcLengths[segment + 1] ?? 0;
      data[target + 8] = line.color[0] ?? 1;
      data[target + 9] = line.color[1] ?? 1;
      data[target + 10] = line.color[2] ?? 1;
      data[target + 11] = line.color[3] ?? 1;
      data[target + 12] = line.color[0] ?? 1;
      data[target + 13] = line.color[1] ?? 1;
      data[target + 14] = line.color[2] ?? 1;
      data[target + 15] = line.color[3] ?? 1;
      data[target + 16] = line.width;
      data[target + 17] = line.dashSize;
      data[target + 18] = line.gapSize;
      data[target + 19] = line.dashOffset;
      segmentCursor += 1;
    }

    batches.push({
      renderId: line.renderId,
      firstInstance,
      instanceCount: segmentCount,
      sortKey: line.sortKey,
    });
  }

  return { data, batches, segmentCount: totalSegments };
}
