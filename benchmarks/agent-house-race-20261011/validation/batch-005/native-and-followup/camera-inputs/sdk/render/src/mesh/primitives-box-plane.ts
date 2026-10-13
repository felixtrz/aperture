import type { BoxMeshOptions, MeshAsset, PlaneMeshOptions } from "./types.js";
import {
  createPrimitiveMeshAsset,
  clampInteger,
  face,
  interleavePrimitiveVertexList,
  interleavePrimitiveVertices,
  type PrimitiveVertex,
} from "./primitives-builders.js";

export function createBoxMeshAsset(options: BoxMeshOptions = {}): MeshAsset {
  const width = options.width ?? 1;
  const height = options.height ?? 1;
  const depth = options.depth ?? 1;
  const hx = width * 0.5;
  const hy = height * 0.5;
  const hz = depth * 0.5;
  const vertices = interleavePrimitiveVertices([
    face(
      [
        [-hx, -hy, hz],
        [hx, -hy, hz],
        [hx, hy, hz],
        [-hx, hy, hz],
      ],
      [0, 0, 1],
    ),
    face(
      [
        [hx, -hy, -hz],
        [-hx, -hy, -hz],
        [-hx, hy, -hz],
        [hx, hy, -hz],
      ],
      [0, 0, -1],
    ),
    face(
      [
        [hx, -hy, hz],
        [hx, -hy, -hz],
        [hx, hy, -hz],
        [hx, hy, hz],
      ],
      [1, 0, 0],
    ),
    face(
      [
        [-hx, -hy, -hz],
        [-hx, -hy, hz],
        [-hx, hy, hz],
        [-hx, hy, -hz],
      ],
      [-1, 0, 0],
    ),
    face(
      [
        [-hx, hy, hz],
        [hx, hy, hz],
        [hx, hy, -hz],
        [-hx, hy, -hz],
      ],
      [0, 1, 0],
    ),
    face(
      [
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [hx, -hy, hz],
        [-hx, -hy, hz],
      ],
      [0, -1, 0],
    ),
  ]);
  const indices = new Uint16Array(36);

  for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
    const vertexOffset = faceIndex * 4;
    const indexOffset = faceIndex * 6;
    indices.set(
      [
        vertexOffset,
        vertexOffset + 1,
        vertexOffset + 2,
        vertexOffset,
        vertexOffset + 2,
        vertexOffset + 3,
      ],
      indexOffset,
    );
  }

  return createPrimitiveMeshAsset({
    label: options.label ?? "Box",
    vertices,
    vertexCount: 24,
    indices,
    localAabb: { min: [-hx, -hy, -hz], max: [hx, hy, hz] },
    localSphere: { center: [0, 0, 0], radius: Math.hypot(hx, hy, hz) },
  });
}

export function createPlaneMeshAsset(
  options: PlaneMeshOptions = {},
): MeshAsset {
  const width = options.width ?? 1;
  const height = options.height ?? 1;
  const hx = width * 0.5;
  const hy = height * 0.5;
  const widthSegments = clampInteger(options.widthSegments ?? 1, 1, 128);
  const heightSegments = clampInteger(options.heightSegments ?? 1, 1, 128);
  if (widthSegments !== 1 || heightSegments !== 1) {
    const grid: PrimitiveVertex[] = [];
    for (let y = 0; y <= heightSegments; y += 1) {
      const v = y / heightSegments;
      for (let x = 0; x <= widthSegments; x += 1) {
        const u = x / widthSegments;
        grid.push({
          position: [u * width - hx, v * height - hy, 0],
          normal: [0, 0, 1],
          uv: [u, v],
        });
      }
    }
    const indices = new Uint16Array(widthSegments * heightSegments * 6);
    const rowStride = widthSegments + 1;
    for (let y = 0; y < heightSegments; y += 1) {
      for (let x = 0; x < widthSegments; x += 1) {
        const lowerLeft = y * rowStride + x;
        const upperLeft = lowerLeft + rowStride;
        indices.set(
          [
            lowerLeft,
            lowerLeft + 1,
            upperLeft + 1,
            lowerLeft,
            upperLeft + 1,
            upperLeft,
          ],
          (y * widthSegments + x) * 6,
        );
      }
    }
    return createPrimitiveMeshAsset({
      label: options.label ?? "Plane",
      vertices: interleavePrimitiveVertexList(grid),
      vertexCount: grid.length,
      indices,
      localAabb: { min: [-hx, -hy, 0], max: [hx, hy, 0] },
      localSphere: { center: [0, 0, 0], radius: Math.hypot(hx, hy) },
    });
  }
  // Keep the original four-vertex layout byte-for-byte for unsubdivided planes.
  const vertices = interleavePrimitiveVertices([
    face(
      [
        [-hx, -hy, 0],
        [hx, -hy, 0],
        [hx, hy, 0],
        [-hx, hy, 0],
      ],
      [0, 0, 1],
    ),
  ]);

  return createPrimitiveMeshAsset({
    label: options.label ?? "Plane",
    vertices,
    vertexCount: 4,
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    localAabb: { min: [-hx, -hy, 0], max: [hx, hy, 0] },
    localSphere: { center: [0, 0, 0], radius: Math.hypot(hx, hy) },
  });
}
