import type { MeshAsset, MeshIndexBufferDescriptor } from "./types.js";
import type {
  TriangleListMeshOptions,
  TriangleListPosition,
  TriangleListTangent,
  TriangleListUv,
} from "./triangle-list-types.js";
import {
  PRIMITIVE_VERTEX_STRIDE_BYTES,
  boundsFromPositions,
  interleavePrimitiveVertexList,
  type PrimitiveVertex,
} from "./primitives-builders.js";

/** An invalid triangle-list input, with the offending field or face location. */
export class TriangleListMeshError extends RangeError {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path} ${reason}`);
    this.name = "TriangleListMeshError";
    this.path = path;
  }
}

/**
 * Construct a validated triangle-list asset using the standard POSITION,
 * NORMAL, TEXCOORD_0 layout. Zero-area faces after float32 conversion are
 * rejected rather than publishing NaN normals or silently removing faces.
 */
export function createTriangleListMeshAsset(
  options: TriangleListMeshOptions,
): MeshAsset {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new TriangleListMeshError("options", "must be an object.");
  }
  if (options.label !== undefined && typeof options.label !== "string") {
    throw new TriangleListMeshError("label", "must be a string.");
  }

  const positions = readPositions(options.positions);
  const indices = readIndices(options.indices, positions.length);
  const cornerCount = indices?.length ?? positions.length;
  if (cornerCount < 3 || cornerCount % 3 !== 0) {
    throw new TriangleListMeshError(
      indices === undefined ? "positions" : "indices",
      "must contain a positive multiple of three entries (one triple per triangle).",
    );
  }
  const normals = readNormals(options.normals, positions.length);
  const uvs = readUvs(options.uvs, positions.length);
  const tangents = readTangents(options.tangents, normals, positions.length);
  const vertices: PrimitiveVertex[] = [];

  if (normals !== undefined) {
    for (let index = 0; index < positions.length; index += 1) {
      vertices.push({
        position: positions[index]!,
        normal: normals[index]!,
        uv: uvs?.[index] ?? [0, 0],
      });
    }
  }

  for (let corner = 0; corner < cornerCount; corner += 3) {
    const a = indices?.[corner] ?? corner;
    const b = indices?.[corner + 1] ?? corner + 1;
    const c = indices?.[corner + 2] ?? corner + 2;
    const normal = faceNormal(positions[a]!, positions[b]!, positions[c]!, {
      corner,
      indexed: indices !== undefined,
      a,
      b,
      c,
    });
    if (normals === undefined) {
      for (const index of [a, b, c]) {
        vertices.push({
          position: positions[index]!,
          normal,
          uv: uvs?.[index] ?? [0, 0],
        });
      }
    }
  }

  // Bounds cover the actual stored float32 positions, including unused source
  // vertices when explicit normals retain the authored indexed layout.
  const bounds = boundsFromPositions(vertices.map((vertex) => vertex.position));
  if (!Number.isFinite(Math.fround(bounds.sphere.radius))) {
    throw new TriangleListMeshError(
      "positions",
      "span a bounding sphere too large for finite float32 storage; use smaller local coordinates and a transform.",
    );
  }
  const indexBuffer =
    normals === undefined ? undefined : createIndexBuffer(indices);

  return {
    kind: "mesh",
    label: options.label ?? "TriangleList",
    vertexStreams: [
      {
        id: "triangle-list-interleaved",
        arrayStride: PRIMITIVE_VERTEX_STRIDE_BYTES,
        vertexCount: vertices.length,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: interleavePrimitiveVertexList(vertices),
      },
      ...(tangents === undefined
        ? []
        : [
            {
              id: "triangle-list-tangents",
              arrayStride: 16,
              vertexCount: vertices.length,
              attributes: [
                {
                  semantic: "TANGENT" as const,
                  format: "float32x4" as const,
                  offset: 0,
                },
              ],
              data: new Float32Array(tangents.flat()),
            },
          ]),
    ],
    ...(indexBuffer === undefined ? {} : { indexBuffer }),
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: vertices.length,
        indexStart: 0,
        indexCount: indexBuffer?.data.length ?? 0,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  };
}

function readPositions(value: unknown): TriangleListPosition[] {
  const source = readTupleArray(value, "positions", 3);
  if (source.length < 3) {
    throw new TriangleListMeshError(
      "positions",
      "must contain at least three vertices.",
    );
  }
  const positions: TriangleListPosition[] = [];
  for (let index = 0; index < source.length; index += 1) {
    positions.push(readVector3(source[index], `positions[${index}]`));
  }
  return positions;
}

function readIndices(
  value: unknown,
  vertexCount: number,
): number[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) &&
    !(value instanceof Uint16Array) &&
    !(value instanceof Uint32Array)
  ) {
    throw new TriangleListMeshError(
      "indices",
      "must be a number array, Uint16Array, or Uint32Array.",
    );
  }
  const indices: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item: unknown = value[index];
    if (
      typeof item !== "number" ||
      !Number.isInteger(item) ||
      item < 0 ||
      item >= vertexCount
    ) {
      throw new TriangleListMeshError(
        `indices[${index}]`,
        `must be an integer from 0 to ${vertexCount - 1}.`,
      );
    }
    indices.push(item);
  }
  return indices;
}

function readNormals(
  value: unknown,
  vertexCount: number,
): TriangleListPosition[] | undefined {
  if (value === undefined) return undefined;
  const source = readAttributeArray(value, "normals", vertexCount, 3);
  const normals: TriangleListPosition[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const path = `normals[${index}]`;
    const normal = readVector3(source[index], path);
    const length = Math.hypot(...normal);
    if (length === 0) {
      throw new TriangleListMeshError(
        path,
        "must be nonzero after float32 conversion.",
      );
    }
    normals.push([normal[0] / length, normal[1] / length, normal[2] / length]);
  }
  return normals;
}

function readUvs(
  value: unknown,
  vertexCount: number,
): TriangleListUv[] | undefined {
  if (value === undefined) return undefined;
  const source = readAttributeArray(value, "uvs", vertexCount, 2);
  const uvs: TriangleListUv[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const path = `uvs[${index}]`;
    const tuple = readTuple(source[index], path, 2);
    uvs.push([
      float32(tuple[0], `${path}[0]`),
      float32(tuple[1], `${path}[1]`),
    ]);
  }
  return uvs;
}

function readAttributeArray(
  value: unknown,
  path: string,
  vertexCount: number,
  size: number,
): readonly unknown[] {
  const source = readTupleArray(value, path, size);
  if (source.length !== vertexCount) {
    throw new TriangleListMeshError(
      path,
      `must have exactly ${vertexCount} entries (one per source position).`,
    );
  }
  return source;
}

function readTupleArray(
  value: unknown,
  path: string,
  size: number,
): readonly unknown[] {
  if (value instanceof Float32Array) {
    if (!(value.buffer instanceof ArrayBuffer)) {
      throw new TriangleListMeshError(
        path,
        "packed input must use an owned ArrayBuffer, not shared storage.",
      );
    }
    if (value.length % size !== 0) {
      throw new TriangleListMeshError(
        path,
        `packed input must contain a multiple of ${size} float32 values.`,
      );
    }
    return Array.from({ length: value.length / size }, (_, index) =>
      Array.from(value.subarray(index * size, (index + 1) * size)),
    );
  }
  if (!Array.isArray(value)) {
    throw new TriangleListMeshError(
      path,
      "must be an array of tuples or a packed Float32Array.",
    );
  }
  return value;
}

function readTangents(
  value: unknown,
  normals: readonly TriangleListPosition[] | undefined,
  vertexCount: number,
): TriangleListTangent[] | undefined {
  if (value === undefined) return undefined;
  if (normals === undefined) {
    throw new TriangleListMeshError(
      "tangents",
      "require explicit normals to preserve the authored tangent basis.",
    );
  }
  const source = readAttributeArray(value, "tangents", vertexCount, 4);
  return source.map((entry, index) => {
    const path = `tangents[${index}]`;
    const tuple = readTuple(entry, path, 4);
    const t: TriangleListPosition = [
      float32(tuple[0], `${path}[0]`),
      float32(tuple[1], `${path}[1]`),
      float32(tuple[2], `${path}[2]`),
    ];
    const handedness = float32(tuple[3], `${path}[3]`);
    if (tuple[3] !== 1 && tuple[3] !== -1) {
      throw new TriangleListMeshError(
        `${path}[3]`,
        "must be +1 or -1 for tangent handedness.",
      );
    }
    const n = normals[index]!;
    const cross = [
      t[1] * n[2] - t[2] * n[1],
      t[2] * n[0] - t[0] * n[2],
      t[0] * n[1] - t[1] * n[0],
    ] as const;
    const projected = [
      n[1] * cross[2] - n[2] * cross[1],
      n[2] * cross[0] - n[0] * cross[2],
      n[0] * cross[1] - n[1] * cross[0],
    ] as const;
    const length = Math.hypot(...projected);
    if (length === 0) {
      throw new TriangleListMeshError(
        path,
        "xyz must be nonzero and not parallel to its normal after float32 conversion.",
      );
    }
    return [
      projected[0] === 0 ? 0 : projected[0] / length,
      projected[1] === 0 ? 0 : projected[1] / length,
      projected[2] === 0 ? 0 : projected[2] / length,
      handedness,
    ];
  });
}

function readTuple(
  value: unknown,
  path: string,
  size: number,
): readonly unknown[] {
  if (!Array.isArray(value) || value.length !== size) {
    throw new TriangleListMeshError(path, `must be a ${size}-number tuple.`);
  }
  return value;
}

function readVector3(value: unknown, path: string): TriangleListPosition {
  const tuple = readTuple(value, path, 3);
  return [
    float32(tuple[0], `${path}[0]`),
    float32(tuple[1], `${path}[1]`),
    float32(tuple[2], `${path}[2]`),
  ];
}

function float32(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isFinite(Math.fround(value))
  ) {
    throw new TriangleListMeshError(
      path,
      "must be a finite number representable as float32.",
    );
  }
  return Math.fround(value);
}

function faceNormal(
  a: TriangleListPosition,
  b: TriangleListPosition,
  c: TriangleListPosition,
  face: {
    readonly corner: number;
    readonly indexed: boolean;
    readonly a: number;
    readonly b: number;
    readonly c: number;
  },
): TriangleListPosition {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ] as const;
  const length = Math.hypot(...cross);
  if (length === 0) {
    const source = face.indexed ? "indices" : "positions";
    throw new TriangleListMeshError(
      `${source}[${face.corner}..${face.corner + 2}]`,
      `form zero-area triangle ${face.corner / 3} (vertices ${face.a}, ${face.b}, ${face.c}) after float32 conversion; remove the face or separate its vertices.`,
    );
  }
  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

function createIndexBuffer(
  indices: readonly number[] | undefined,
): MeshIndexBufferDescriptor | undefined {
  if (indices === undefined) return undefined;
  const maxIndex = indices.reduce((max, index) => Math.max(max, index), 0);
  const data =
    maxIndex > 0xffff ? new Uint32Array(indices) : new Uint16Array(indices);
  return {
    format: data instanceof Uint32Array ? "uint32" : "uint16",
    data,
    indexCount: data.length,
  };
}
