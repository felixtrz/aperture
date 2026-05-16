import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";
import type {
  BoxMeshOptions,
  CapsuleMeshOptions,
  ConeMeshOptions,
  CylinderMeshOptions,
  MeshAsset,
  PlaneMeshOptions,
  SphereMeshOptions,
  TorusMeshOptions,
} from "./types.js";

const FLOATS_PER_PRIMITIVE_VERTEX = 8;
const PRIMITIVE_VERTEX_STRIDE_BYTES = FLOATS_PER_PRIMITIVE_VERTEX * 4;

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

interface PrimitiveMeshAssetInput {
  readonly label: string;
  readonly vertices: Float32Array;
  readonly vertexCount: number;
  readonly indices: Uint16Array;
  readonly localAabb: Aabb;
  readonly localSphere: BoundingSphere;
}

type PrimitivePosition = readonly [number, number, number];
type PrimitiveFace = readonly PrimitiveVertex[];

interface PrimitiveVertex {
  readonly position: PrimitivePosition;
  readonly normal: PrimitivePosition;
  readonly uv: readonly [number, number];
}

function createPrimitiveMeshAsset(input: PrimitiveMeshAssetInput): MeshAsset {
  return {
    kind: "mesh",
    label: input.label,
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: PRIMITIVE_VERTEX_STRIDE_BYTES,
        vertexCount: input.vertexCount,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: input.vertices,
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: input.indices,
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: input.vertexCount,
        indexStart: 0,
        indexCount: input.indices.length,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: input.localAabb,
    localSphere: input.localSphere,
  };
}

function face(
  positions: readonly [
    PrimitivePosition,
    PrimitivePosition,
    PrimitivePosition,
    PrimitivePosition,
  ],
  normal: PrimitivePosition,
): PrimitiveFace {
  return [
    { position: positions[0], normal, uv: [0, 0] },
    { position: positions[1], normal, uv: [1, 0] },
    { position: positions[2], normal, uv: [1, 1] },
    { position: positions[3], normal, uv: [0, 1] },
  ];
}

function interleavePrimitiveVertices(
  faces: readonly PrimitiveFace[],
): Float32Array {
  return interleavePrimitiveVertexList(
    faces.flatMap((primitiveFace) => [...primitiveFace]),
  );
}

function interleavePrimitiveVertexList(
  vertices: readonly PrimitiveVertex[],
): Float32Array {
  const values: number[] = [];

  for (const vertex of vertices) {
    values.push(
      vertex.position[0],
      vertex.position[1],
      vertex.position[2],
      vertex.normal[0],
      vertex.normal[1],
      vertex.normal[2],
      vertex.uv[0],
      vertex.uv[1],
    );
  }

  return new Float32Array(values);
}

function positiveFinite(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value <= 0
    ? fallback
    : value;
}

function nonNegativeFinite(
  value: number | undefined,
  fallback: number,
): number {
  return value === undefined || !Number.isFinite(value) || value < 0
    ? fallback
    : value;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalize(value: PrimitivePosition): PrimitivePosition {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length === 0) {
    return [0, 1, 0];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}
