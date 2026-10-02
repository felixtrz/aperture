import { triangulateExtrudeCaps } from "./extrude-triangulation.js";
import type { MeshAsset } from "./types.js";
import type { ExtrudeMeshOptions } from "./extrude-types.js";
import type {
  TriangleListPosition,
  TriangleListNormal,
  TriangleListUv,
} from "./triangle-list-types.js";
import { ExtrudeMeshError, readExtrudeRings } from "./extrude-validation.js";
import {
  createTriangleListMeshAsset,
  TriangleListMeshError,
} from "./primitives-triangle-list.js";

export { ExtrudeMeshError } from "./extrude-validation.js";

/**
 * Indexed closed XY polygon extruded along +Z. Caps have normals -Z/+Z;
 * walls have per-edge outward normals, with independent cap/wall vertices.
 * Cap UVs map the outline bounding box to [0,1]^2. Wall U is normalized
 * distance around each ring (seam at its lexicographically first point), V
 * is z/depth. Earcut triangulates caps only; no Three runtime is used.
 */
export function createExtrudeMeshAsset(options: ExtrudeMeshOptions): MeshAsset {
  const { label, rings, depth } = readExtrudeRings(options);
  const points = rings.flat();
  const caps = triangulateExtrudeCaps(rings);
  const positions: TriangleListPosition[] = [];
  const normals: TriangleListNormal[] = [];
  const uvs: TriangleListUv[] = [];
  const indices: number[] = [];
  const xs = rings[0]!.map((p) => p[0]),
    ys = rings[0]!.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  for (const z of [0, depth]) {
    for (const [x, y] of points) {
      positions.push([x, y, z]);
      normals.push([0, 0, z === 0 ? -1 : 1]);
      uvs.push([(x - minX) / (maxX - minX), (y - minY) / (maxY - minY)]);
    }
  }
  for (let i = 0; i < caps.length; i += 3) {
    const a = caps[i]!,
      b = caps[i + 1]!,
      c = caps[i + 2]!;
    indices.push(
      a,
      c,
      b,
      a + points.length,
      b + points.length,
      c + points.length,
    );
  }
  for (const ring of rings) {
    const lengths = ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      return Math.hypot(b[0] - a[0], b[1] - a[1]);
    });
    const perimeter = lengths.reduce((a, b) => a + b, 0);
    let distance = 0;
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i]!;
      const [bx, by] = ring[(i + 1) % ring.length]!;
      const length = lengths[i]!;
      const normal: TriangleListNormal = [
        (by - ay) / length,
        (ax - bx) / length,
        0,
      ];
      const start = positions.length;
      positions.push(
        [ax, ay, 0],
        [bx, by, 0],
        [bx, by, depth],
        [ax, ay, depth],
      );
      normals.push(normal, normal, normal, normal);
      const u0 = distance / perimeter,
        u1 = (distance + length) / perimeter;
      uvs.push([u0, 0], [u1, 0], [u1, 1], [u0, 1]);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      distance += length;
    }
  }
  try {
    return createTriangleListMeshAsset({
      label,
      positions,
      indices,
      normals,
      uvs,
    });
  } catch (error) {
    if (!(error instanceof TriangleListMeshError)) throw error;
    throw new ExtrudeMeshError(
      "outline",
      `cannot form a finite nondegenerate solid: ${error.message}`,
    );
  }
}
