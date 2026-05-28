import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";
import type {
  BoxMeshOptions,
  CapsuleMeshOptions,
  ConeMeshOptions,
  CylinderMeshOptions,
  LineListMeshOptions,
  LineListMeshSubmeshOptions,
  MeshAsset,
  MeshIndexBufferDescriptor,
  PlaneMeshOptions,
  SphereMeshOptions,
  TorusMeshOptions,
} from "./types.js";
import {
  PRIMITIVE_VERTEX_STRIDE_BYTES,
  boundsFromPositions,
  clampInteger,
  createPrimitiveMeshAsset,
  face,
  interleavePrimitiveVertexList,
  interleavePrimitiveVertices,
  nonNegativeFinite,
  normalize,
  positiveFinite,
  type PrimitivePosition,
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

export function createLineListMeshAsset(
  options: LineListMeshOptions,
): MeshAsset {
  const label = options.label ?? "LineList";
  const vertices = interleavePrimitiveVertexList(
    options.positions.map((position) => ({
      position,
      normal: [0, 0, 1] as const,
      uv: [0, 0] as const,
    })),
  );
  const indexBuffer = createLineListIndexBuffer(options.indices);
  const submeshes = createLineListSubmeshes({
    submeshes: options.submeshes,
    vertexCount: options.positions.length,
    indexCount: indexBuffer?.data.length ?? 0,
    indexed: indexBuffer !== undefined,
  });
  const materialSlotCount = Math.max(
    1,
    options.materialSlots?.length ?? 0,
    ...submeshes.map((submesh) => submesh.materialSlot + 1),
  );
  const bounds = boundsFromPositions(options.positions);

  return {
    kind: "mesh",
    label,
    vertexStreams: [
      {
        id: "line-list-interleaved",
        arrayStride: PRIMITIVE_VERTEX_STRIDE_BYTES,
        vertexCount: options.positions.length,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: vertices,
      },
    ],
    ...(indexBuffer === undefined ? {} : { indexBuffer }),
    submeshes,
    materialSlots: Array.from({ length: materialSlotCount }, (_, index) => ({
      index,
      label: options.materialSlots?.[index] ?? `slot-${index}`,
    })),
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  };
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

function createLineListIndexBuffer(
  indices: LineListMeshOptions["indices"],
): MeshIndexBufferDescriptor | undefined {
  if (indices === undefined) {
    return undefined;
  }

  if (indices instanceof Uint16Array) {
    return { format: "uint16", data: indices, indexCount: indices.length };
  }

  if (indices instanceof Uint32Array) {
    return { format: "uint32", data: indices, indexCount: indices.length };
  }

  const maxIndex = indices.reduce((max, index) => Math.max(max, index), 0);
  const data =
    maxIndex > 0xffff ? new Uint32Array(indices) : new Uint16Array(indices);

  return {
    format: data instanceof Uint32Array ? "uint32" : "uint16",
    data,
    indexCount: data.length,
  };
}

function createLineListSubmeshes(input: {
  readonly submeshes?: readonly LineListMeshSubmeshOptions[] | undefined;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly indexed: boolean;
}): MeshAsset["submeshes"] {
  const source =
    input.submeshes === undefined || input.submeshes.length === 0
      ? [
          {
            label: "default",
            materialSlot: 0,
            vertexStart: 0,
            vertexCount: input.vertexCount,
            indexStart: 0,
            indexCount: input.indexed ? input.indexCount : 0,
          },
        ]
      : input.submeshes;

  return source.map((submesh, index) => ({
    label: submesh.label ?? `line-list-${index}`,
    topology: "line-list",
    materialSlot: submesh.materialSlot ?? 0,
    vertexStart: submesh.vertexStart ?? 0,
    vertexCount: submesh.vertexCount ?? input.vertexCount,
    indexStart: submesh.indexStart ?? 0,
    indexCount: submesh.indexCount ?? (input.indexed ? input.indexCount : 0),
  }));
}
