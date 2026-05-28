import type {
  ConeMeshOptions,
  CylinderMeshOptions,
  MeshAsset,
} from "./types.js";
import {
  clampInteger,
  createPrimitiveMeshAsset,
  interleavePrimitiveVertexList,
  nonNegativeFinite,
  normalize,
  positiveFinite,
  type PrimitivePosition,
  type PrimitiveVertex,
} from "./primitives-builders.js";

export function createCylinderMeshAsset(
  options: CylinderMeshOptions = {},
): MeshAsset {
  const radius = positiveFinite(options.radius, 0.5);
  const radiusTop = nonNegativeFinite(options.radiusTop, radius);
  const radiusBottom = nonNegativeFinite(options.radiusBottom, radius);

  return createFrustumMeshAsset({
    label: options.label ?? "Cylinder",
    radiusTop: radiusTop === 0 && radiusBottom === 0 ? radius : radiusTop,
    radiusBottom: radiusTop === 0 && radiusBottom === 0 ? radius : radiusBottom,
    height: positiveFinite(options.height, 1),
    radialSegments: clampInteger(options.radialSegments ?? 32, 3, 128),
    heightSegments: clampInteger(options.heightSegments ?? 1, 1, 128),
  });
}

export function createConeMeshAsset(options: ConeMeshOptions = {}): MeshAsset {
  return createFrustumMeshAsset({
    label: options.label ?? "Cone",
    radiusTop: 0,
    radiusBottom: positiveFinite(options.radius, 0.5),
    height: positiveFinite(options.height, 1),
    radialSegments: clampInteger(options.radialSegments ?? 32, 3, 128),
    heightSegments: clampInteger(options.heightSegments ?? 1, 1, 128),
  });
}

interface FrustumMeshAssetInput {
  readonly label: string;
  readonly radiusTop: number;
  readonly radiusBottom: number;
  readonly height: number;
  readonly radialSegments: number;
  readonly heightSegments: number;
}

function createFrustumMeshAsset(input: FrustumMeshAssetInput): MeshAsset {
  const halfHeight = input.height * 0.5;
  const maxRadius = Math.max(input.radiusTop, input.radiusBottom);
  const vertices: PrimitiveVertex[] = [];
  const indices: number[] = [];
  const slope = (input.radiusBottom - input.radiusTop) / input.height;

  for (let y = 0; y <= input.heightSegments; y += 1) {
    const v = y / input.heightSegments;
    const radius =
      input.radiusBottom + (input.radiusTop - input.radiusBottom) * v;
    const py = -halfHeight + input.height * v;

    for (let x = 0; x <= input.radialSegments; x += 1) {
      const u = x / input.radialSegments;
      const phi = u * Math.PI * 2;
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);
      const normal = normalize([cos, slope, sin]);

      vertices.push({
        position: [cos * radius, py, sin * radius],
        normal,
        uv: [u, v],
      });
    }
  }

  const rowStride = input.radialSegments + 1;

  for (let y = 0; y < input.heightSegments; y += 1) {
    const lowerV = y / input.heightSegments;
    const upperV = (y + 1) / input.heightSegments;
    const lowerRadius =
      input.radiusBottom + (input.radiusTop - input.radiusBottom) * lowerV;
    const upperRadius =
      input.radiusBottom + (input.radiusTop - input.radiusBottom) * upperV;

    for (let x = 0; x < input.radialSegments; x += 1) {
      const a = y * rowStride + x;
      const b = a + rowStride;
      const c = b + 1;
      const d = a + 1;

      if (lowerRadius > 0) {
        indices.push(a, b, d);
      }

      if (upperRadius > 0) {
        indices.push(d, b, c);
      }
    }
  }

  if (input.radiusTop > 0) {
    appendCap({
      vertices,
      indices,
      radius: input.radiusTop,
      y: halfHeight,
      normal: [0, 1, 0],
      radialSegments: input.radialSegments,
      top: true,
    });
  }

  if (input.radiusBottom > 0) {
    appendCap({
      vertices,
      indices,
      radius: input.radiusBottom,
      y: -halfHeight,
      normal: [0, -1, 0],
      radialSegments: input.radialSegments,
      top: false,
    });
  }

  return createPrimitiveMeshAsset({
    label: input.label,
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: {
      min: [-maxRadius, -halfHeight, -maxRadius],
      max: [maxRadius, halfHeight, maxRadius],
    },
    localSphere: {
      center: [0, 0, 0],
      radius: Math.hypot(maxRadius, halfHeight),
    },
  });
}

interface CapInput {
  readonly vertices: PrimitiveVertex[];
  readonly indices: number[];
  readonly radius: number;
  readonly y: number;
  readonly normal: PrimitivePosition;
  readonly radialSegments: number;
  readonly top: boolean;
}

function appendCap(input: CapInput): void {
  const centerIndex = input.vertices.length;

  input.vertices.push({
    position: [0, input.y, 0],
    normal: input.normal,
    uv: [0.5, 0.5],
  });

  for (let x = 0; x <= input.radialSegments; x += 1) {
    const u = x / input.radialSegments;
    const phi = u * Math.PI * 2;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);

    input.vertices.push({
      position: [cos * input.radius, input.y, sin * input.radius],
      normal: input.normal,
      uv: [cos * 0.5 + 0.5, sin * 0.5 + 0.5],
    });
  }

  for (let x = 0; x < input.radialSegments; x += 1) {
    const current = centerIndex + 1 + x;
    const next = current + 1;

    if (input.top) {
      input.indices.push(centerIndex, next, current);
    } else {
      input.indices.push(centerIndex, current, next);
    }
  }
}
