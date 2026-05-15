import type { MaterialHandle } from "../assets/index.js";
import type { Aabb, BoundingSphere } from "../math/index.js";
import type { BoxMeshOptions, MeshAsset, PlaneMeshOptions } from "./types.js";

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
    material: options.material ?? null,
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
    material: options.material ?? null,
    localAabb: { min: [-hx, -hy, 0], max: [hx, hy, 0] },
    localSphere: { center: [0, 0, 0], radius: Math.hypot(hx, hy) },
  });
}

interface PrimitiveMeshAssetInput {
  readonly label: string;
  readonly vertices: Float32Array;
  readonly vertexCount: number;
  readonly indices: Uint16Array;
  readonly material: MaterialHandle | null;
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
    materialSlots: [{ index: 0, label: "default", material: input.material }],
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
  const values: number[] = [];

  for (const primitiveFace of faces) {
    for (const vertex of primitiveFace) {
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
  }

  return new Float32Array(values);
}
