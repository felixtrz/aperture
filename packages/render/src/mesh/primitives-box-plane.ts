import type { BoxMeshOptions, MeshAsset, PlaneMeshOptions } from "./types.js";
import {
  createPrimitiveMeshAsset,
  face,
  interleavePrimitiveVertices,
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
