import type { CircleMeshOptions, MeshAsset, RingMeshOptions } from "./types.js";
import {
  clampInteger,
  createPrimitiveMeshAsset,
  interleavePrimitiveVertexList,
  nonNegativeFinite,
  positiveFinite,
  type PrimitiveVertex,
} from "./primitives-builders.js";

const PLANE_NORMAL = [0, 0, 1] as const;

export function createCircleMeshAsset(
  options: CircleMeshOptions = {},
): MeshAsset {
  const radius = positiveFinite(options.radius, 1);
  const segments = clampInteger(options.segments ?? 32, 3, 128);
  const vertices: PrimitiveVertex[] = [
    { position: [0, 0, 0], normal: [...PLANE_NORMAL], uv: [0.5, 0.5] },
  ];
  const indices: number[] = [];

  for (let s = 0; s <= segments; s += 1) {
    const segment = (s / segments) * Math.PI * 2;
    const cos = Math.cos(segment);
    const sin = Math.sin(segment);

    vertices.push({
      position: [radius * cos, radius * sin, 0],
      normal: [...PLANE_NORMAL],
      uv: [(cos + 1) * 0.5, (sin + 1) * 0.5],
    });
  }

  for (let i = 1; i <= segments; i += 1) {
    indices.push(i, i + 1, 0);
  }

  return createPrimitiveMeshAsset({
    label: options.label ?? "Circle",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: { min: [-radius, -radius, 0], max: [radius, radius, 0] },
    localSphere: { center: [0, 0, 0], radius },
  });
}

export function createRingMeshAsset(options: RingMeshOptions = {}): MeshAsset {
  const outerRadius = positiveFinite(options.outerRadius, 1);
  const innerRadius = Math.min(
    nonNegativeFinite(options.innerRadius, outerRadius * 0.5),
    outerRadius,
  );
  const thetaSegments = clampInteger(options.thetaSegments ?? 32, 3, 128);
  const phiSegments = clampInteger(options.phiSegments ?? 1, 1, 128);
  const radiusStep = (outerRadius - innerRadius) / phiSegments;
  const vertices: PrimitiveVertex[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= phiSegments; j += 1) {
    const radius = innerRadius + j * radiusStep;

    for (let i = 0; i <= thetaSegments; i += 1) {
      const segment = (i / thetaSegments) * Math.PI * 2;
      const cos = Math.cos(segment);
      const sin = Math.sin(segment);

      vertices.push({
        position: [radius * cos, radius * sin, 0],
        normal: [...PLANE_NORMAL],
        uv: [
          ((radius * cos) / outerRadius + 1) * 0.5,
          ((radius * sin) / outerRadius + 1) * 0.5,
        ],
      });
    }
  }

  const rowStride = thetaSegments + 1;

  for (let j = 0; j < phiSegments; j += 1) {
    const level = j * rowStride;

    for (let i = 0; i < thetaSegments; i += 1) {
      const segment = level + i;
      const a = segment;
      const b = segment + rowStride;
      const c = segment + rowStride + 1;
      const d = segment + 1;

      indices.push(a, b, d, b, c, d);
    }
  }

  return createPrimitiveMeshAsset({
    label: options.label ?? "Ring",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: {
      min: [-outerRadius, -outerRadius, 0],
      max: [outerRadius, outerRadius, 0],
    },
    localSphere: { center: [0, 0, 0], radius: outerRadius },
  });
}
