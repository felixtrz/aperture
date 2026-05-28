import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";
import type {
  BoxMeshOptions,
  CapsuleMeshOptions,
  MeshAsset,
  PlaneMeshOptions,
  SphereMeshOptions,
  TorusMeshOptions,
} from "./types.js";
import {
  clampInteger,
  createPrimitiveMeshAsset,
  face,
  interleavePrimitiveVertices,
  interleavePrimitiveVertexList,
  positiveFinite,
  type PrimitivePosition,
  type PrimitiveVertex,
} from "./primitives-builders.js";

export {
  createConeMeshAsset,
  createCylinderMeshAsset,
} from "./primitives-frustum.js";
export { createLineListMeshAsset } from "./primitives-line-list.js";

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
        indices.push(a, b, d);
      }

      if (y < heightSegments - 1) {
        indices.push(d, b, c);
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

export function createCapsuleMeshAsset(
  options: CapsuleMeshOptions = {},
): MeshAsset {
  const radius = positiveFinite(options.radius, 0.5);
  const height = Math.max(
    positiveFinite(options.height, radius * 4),
    radius * 2,
  );
  const radialSegments = clampInteger(options.radialSegments ?? 32, 3, 128);
  const capSegments = clampInteger(options.capSegments ?? 8, 2, 64);
  const bodyHalfHeight = (height - radius * 2) * 0.5;
  const rings: PrimitiveVertex[][] = [];

  for (let y = 0; y <= capSegments; y += 1) {
    const theta = Math.PI - (y / capSegments) * (Math.PI * 0.5);
    const ringRadius = Math.sin(theta) * radius;
    const normalY = Math.cos(theta);

    rings.push(
      primitiveRing({
        y: -bodyHalfHeight + normalY * radius,
        radius: ringRadius,
        normalY,
        radialSegments,
        v: y / (capSegments * 2 + 1),
      }),
    );
  }

  if (bodyHalfHeight > 0) {
    rings.push(
      primitiveRing({
        y: bodyHalfHeight,
        radius,
        normalY: 0,
        radialSegments,
        v: (capSegments + 1) / (capSegments * 2 + 1),
      }),
    );
  }

  for (let y = 1; y <= capSegments; y += 1) {
    const theta = Math.PI * 0.5 - (y / capSegments) * (Math.PI * 0.5);
    const ringRadius = Math.sin(theta) * radius;
    const normalY = Math.cos(theta);

    rings.push(
      primitiveRing({
        y: bodyHalfHeight + normalY * radius,
        radius: ringRadius,
        normalY,
        radialSegments,
        v:
          (capSegments + (bodyHalfHeight > 0 ? 1 : 0) + y) /
          (capSegments * 2 + (bodyHalfHeight > 0 ? 1 : 0)),
      }),
    );
  }

  return createRingMeshAsset({
    label: options.label ?? "Capsule",
    rings,
    radialSegments,
    localAabb: {
      min: [-radius, -height * 0.5, -radius],
      max: [radius, height * 0.5, radius],
    },
    localSphere: { center: [0, 0, 0], radius: height * 0.5 },
  });
}

export function createTorusMeshAsset(
  options: TorusMeshOptions = {},
): MeshAsset {
  const majorRadius = positiveFinite(options.majorRadius, 0.75);
  const tubeRadius = positiveFinite(options.tubeRadius, 0.25);
  const radialSegments = clampInteger(options.radialSegments ?? 32, 3, 128);
  const tubeSegments = clampInteger(options.tubeSegments ?? 12, 3, 128);
  const vertices: PrimitiveVertex[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= radialSegments; y += 1) {
    const u = y / radialSegments;
    const phi = u * Math.PI * 2;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    for (let x = 0; x <= tubeSegments; x += 1) {
      const v = x / tubeSegments;
      const theta = v * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const ringRadius = majorRadius + tubeRadius * cosTheta;
      const normal: PrimitivePosition = [
        cosTheta * cosPhi,
        sinTheta,
        cosTheta * sinPhi,
      ];

      vertices.push({
        position: [
          ringRadius * cosPhi,
          tubeRadius * sinTheta,
          ringRadius * sinPhi,
        ],
        normal,
        uv: [u, v],
      });
    }
  }

  const rowStride = tubeSegments + 1;

  for (let y = 0; y < radialSegments; y += 1) {
    for (let x = 0; x < tubeSegments; x += 1) {
      const a = y * rowStride + x;
      const b = a + rowStride;
      const c = b + 1;
      const d = a + 1;

      indices.push(a, b, d, d, b, c);
    }
  }

  const outerRadius = majorRadius + tubeRadius;

  return createPrimitiveMeshAsset({
    label: options.label ?? "Torus",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: {
      min: [-outerRadius, -tubeRadius, -outerRadius],
      max: [outerRadius, tubeRadius, outerRadius],
    },
    localSphere: { center: [0, 0, 0], radius: outerRadius },
  });
}

interface PrimitiveRingInput {
  readonly y: number;
  readonly radius: number;
  readonly normalY: number;
  readonly radialSegments: number;
  readonly v: number;
}

function primitiveRing(input: PrimitiveRingInput): PrimitiveVertex[] {
  const radialNormal = Math.sqrt(Math.max(0, 1 - input.normalY ** 2));
  const vertices: PrimitiveVertex[] = [];

  for (let x = 0; x <= input.radialSegments; x += 1) {
    const u = x / input.radialSegments;
    const phi = u * Math.PI * 2;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);

    vertices.push({
      position: [cos * input.radius, input.y, sin * input.radius],
      normal: [cos * radialNormal, input.normalY, sin * radialNormal],
      uv: [u, input.v],
    });
  }

  return vertices;
}

interface RingMeshAssetInput {
  readonly label: string;
  readonly rings: readonly (readonly PrimitiveVertex[])[];
  readonly radialSegments: number;
  readonly localAabb: Aabb;
  readonly localSphere: BoundingSphere;
}

function createRingMeshAsset(input: RingMeshAssetInput): MeshAsset {
  const vertices = input.rings.flatMap((ring) => [...ring]);
  const indices: number[] = [];
  const rowStride = input.radialSegments + 1;

  for (let y = 0; y < input.rings.length - 1; y += 1) {
    const lowerRadius = ringRadius(input.rings[y]);
    const upperRadius = ringRadius(input.rings[y + 1]);

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

  return createPrimitiveMeshAsset({
    label: input.label,
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: input.localAabb,
    localSphere: input.localSphere,
  });
}

function ringRadius(ring: readonly PrimitiveVertex[] | undefined): number {
  const first = ring?.[0];

  if (first === undefined) {
    return 0;
  }

  const radius = Math.hypot(first.position[0], first.position[2]);

  return radius < 1e-8 ? 0 : radius;
}
