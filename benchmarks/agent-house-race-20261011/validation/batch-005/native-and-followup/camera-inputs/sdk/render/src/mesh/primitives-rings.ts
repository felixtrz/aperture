import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";
import type {
  CapsuleMeshOptions,
  MeshAsset,
  TorusMeshOptions,
} from "./types.js";
import {
  clampInteger,
  createPrimitiveMeshAsset,
  interleavePrimitiveVertexList,
  positiveFinite,
  type PrimitivePosition,
  type PrimitiveVertex,
} from "./primitives-builders.js";

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
