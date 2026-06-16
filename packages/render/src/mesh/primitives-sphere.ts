import type { MeshAsset, SphereMeshOptions } from "./types.js";
import {
  clampInteger,
  createPrimitiveMeshAsset,
  interleavePrimitiveVertexList,
  positiveFinite,
  type PrimitivePosition,
  type PrimitiveVertex,
} from "./primitives-builders.js";

export function createSphereMeshAsset(
  options: SphereMeshOptions = {},
): MeshAsset {
  const radius = positiveFinite(options.radius, 1);
  const widthSegments = clampInteger(options.widthSegments ?? 32, 3, 128);
  const heightSegments = clampInteger(options.heightSegments ?? 16, 2, 128);
  const vertices: PrimitiveVertex[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x <= widthSegments; x += 1) {
      const u = x / widthSegments;
      const phi = u * Math.PI * 2;
      const normal: PrimitivePosition = [
        sinTheta * Math.cos(phi),
        cosTheta,
        sinTheta * Math.sin(phi),
      ];

      vertices.push({
        position: [normal[0] * radius, normal[1] * radius, normal[2] * radius],
        normal,
        uv: [u, v],
      });
    }
  }

  const rowStride = widthSegments + 1;

  for (let y = 0; y < heightSegments; y += 1) {
    for (let x = 0; x < widthSegments; x += 1) {
      const a = y * rowStride + x;
      const b = a + rowStride;
      const c = b + 1;
      const d = a + 1;

      if (y > 0) {
        indices.push(a, d, b);
      }

      if (y < heightSegments - 1) {
        indices.push(d, c, b);
      }
    }
  }

  return createPrimitiveMeshAsset({
    label: options.label ?? "Sphere",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: {
      min: [-radius, -radius, -radius],
      max: [radius, radius, radius],
    },
    localSphere: { center: [0, 0, 0], radius },
  });
}
