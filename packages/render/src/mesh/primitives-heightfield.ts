import type { MeshAsset } from "./types.js";
import type { HeightfieldMeshOptions } from "./heightfield-types.js";
import type {
  TriangleListPosition,
  TriangleListUv,
} from "./triangle-list-types.js";
import {
  HeightfieldMeshError,
  readHeightfieldGrid,
} from "./heightfield-validation.js";
import {
  createTriangleListMeshAsset,
  TriangleListMeshError,
} from "./primitives-triangle-list.js";

export { HeightfieldMeshError } from "./heightfield-validation.js";

/**
 * Build an open, Y-up surface with owned buffers and flat face normals. For
 * each cell (r, c), its diagonal joins (r, c) to (r+1, c+1). Triangles are
 * [(r,c), (r+1,c), (r+1,c+1)] and [(r,c), (r+1,c+1), (r,c+1)], facing +Y.
 * UVs are [column / (columns - 1), row / (rows - 1)]. Each triangle owns three
 * corners; there is no index buffer, smoothing, skirt, collider, or hidden RNG.
 */
export function createHeightfieldMeshAsset(
  options: HeightfieldMeshOptions,
): MeshAsset {
  const { heights, x, z } = readHeightfieldGrid(options);
  const positions: TriangleListPosition[] = [];
  const uvs: TriangleListUv[] = [];
  const indices: number[] = [];
  for (let row = 0; row < z.length; row += 1) {
    for (let column = 0; column < x.length; column += 1) {
      positions.push([x[column]!, heights[row]![column]!, z[row]!]);
      uvs.push([column / (x.length - 1), row / (z.length - 1)]);
      if (row < z.length - 1 && column < x.length - 1) {
        const a = row * x.length + column;
        const b = a + 1;
        const c = a + x.length;
        const d = c + 1;
        indices.push(a, c, d, a, d, b);
      }
    }
  }
  try {
    // The triangle factory owns layout, normal generation, bounds, and buffer
    // copies. Heightfields use the same extraction/upload path as other meshes.
    return createTriangleListMeshAsset({
      label: options.label ?? "Heightfield",
      positions,
      indices,
      uvs,
    });
  } catch (error) {
    if (!(error instanceof TriangleListMeshError) || error.path !== "positions")
      throw error;
    throw new HeightfieldMeshError(
      "heights",
      "and width/depth span a bounding sphere too large for finite float32 storage; use smaller local coordinates and a transform.",
    );
  }
}
