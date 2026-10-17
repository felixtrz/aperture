import type { MeshAsset } from "./types.js";
import type { PolygonMeshOptions, PolygonMeshPoint } from "./polygon-types.js";
import type { TriangleListUv } from "./triangle-list-types.js";
import { PolygonMeshError, preparePolygonFace } from "./polygon-validation.js";
import {
  createTriangleListMeshAsset,
  TriangleListMeshError,
} from "./primitives-triangle-list.js";

export { PolygonMeshError } from "./polygon-validation.js";

/**
 * Triangulate planar 3D faces, including concave boundaries and holes. Preserve
 * authored float32 positions and outward winding. Normals are flat per face;
 * UVs normalize each face's dominant-axis projected bounds to [0,1]^2. Output
 * buffers are owned copies, with shared indexed vertices within each face.
 */
export function createPolygonMeshAsset(options: PolygonMeshOptions): MeshAsset {
  if (options === null || typeof options !== "object" || Array.isArray(options))
    throw new PolygonMeshError("options", "must be an object.");
  if (options.label !== undefined && typeof options.label !== "string")
    throw new PolygonMeshError("label", "must be a string.");
  if (
    !Array.isArray(options.faces) ||
    options.faces.length === 0 ||
    options.faces.length > 4096
  )
    throw new PolygonMeshError(
      "faces",
      "must contain between 1 and 4096 planar faces.",
    );
  const positions: PolygonMeshPoint[] = [],
    normals: PolygonMeshPoint[] = [];
  const uvs: TriangleListUv[] = [],
    indices: number[] = [];
  for (let i = 0; i < options.faces.length; i++) {
    const face = preparePolygonFace(options.faces[i]!, `faces[${i}]`);
    const start = positions.length;
    if (start + face.positions.length > 65536)
      throw new PolygonMeshError(
        `faces[${i}]`,
        "exceeds 65536 total boundary vertices; split the asset.",
      );
    const xs = face.projected.map((p) => p[0]),
      ys = face.projected.map((p) => p[1]);
    const x0 = Math.min(...xs),
      y0 = Math.min(...ys),
      dx = Math.max(...xs) - x0,
      dy = Math.max(...ys) - y0;
    positions.push(...face.positions);
    for (const [x, y] of face.projected) {
      normals.push(face.normal);
      uvs.push([(x - x0) / dx, (y - y0) / dy]);
    }
    indices.push(...face.indices.map((index) => start + index));
  }
  try {
    return createTriangleListMeshAsset({
      label: options.label ?? "Polygons",
      positions,
      normals,
      uvs,
      indices,
    });
  } catch (error) {
    if (!(error instanceof TriangleListMeshError)) throw error;
    throw new PolygonMeshError(
      "faces",
      `cannot form finite nondegenerate surfaces: ${error.message}`,
    );
  }
}
