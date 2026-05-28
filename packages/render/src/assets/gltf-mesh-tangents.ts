import type {
  GltfDecodedAccessor,
  GltfDecodedPrimitiveAccessors,
} from "./gltf-accessor-decoding.js";
import type {
  GltfMeshAssetConstructionDiagnostic,
  GltfMeshAssetTangentGenerationRequest,
} from "./gltf-mesh-asset-construction.js";

export function generateMissingTangents(
  primitive: GltfDecodedPrimitiveAccessors,
  position: GltfDecodedAccessor,
  normal: GltfDecodedAccessor | undefined,
  texcoord: GltfDecodedAccessor | undefined,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
  request: GltfMeshAssetTangentGenerationRequest,
): GltfDecodedAccessor | null {
  const positions = position.array;
  const normals = normal?.array;
  const uvs = texcoord?.array;

  if (
    !(positions instanceof Float32Array) ||
    !(normals instanceof Float32Array) ||
    !(uvs instanceof Float32Array) ||
    position.itemSize !== 3 ||
    normal?.itemSize !== 3 ||
    texcoord?.itemSize !== 2
  ) {
    diagnostics.push(
      tangentDiagnostic(primitive, "gltfMeshAsset.tangentGenerationSkipped", {
        reason: request.reason,
        message: `Primitive '${primitive.meshHandleKey}' needs generated TANGENT data for ${request.reason}, but POSITION, NORMAL, and TEXCOORD_0 float attributes are not all available.`,
      }),
    );
    return null;
  }

  const indices = primitive.indices?.array ?? null;
  if (
    indices !== null &&
    !(indices instanceof Uint16Array) &&
    !(indices instanceof Uint32Array)
  ) {
    diagnostics.push(
      tangentDiagnostic(primitive, "gltfMeshAsset.tangentGenerationSkipped", {
        reason: request.reason,
        message: `Primitive '${primitive.meshHandleKey}' needs generated TANGENT data for ${request.reason}, but its index array type is unsupported.`,
      }),
    );
    return null;
  }

  const triangleIndexCount = indices?.length ?? primitive.vertexCount;
  const triangleCount = Math.floor(triangleIndexCount / 3);
  if (triangleCount === 0) {
    diagnostics.push(
      tangentDiagnostic(primitive, "gltfMeshAsset.tangentGenerationSkipped", {
        reason: request.reason,
        message: `Primitive '${primitive.meshHandleKey}' needs generated TANGENT data for ${request.reason}, but it has no complete triangles.`,
      }),
    );
    return null;
  }

  const tangents = calculateVertexTangents({
    positions,
    normals,
    uvs,
    indices,
    vertexCount: primitive.vertexCount,
    triangleCount,
  });

  diagnostics.push(
    tangentDiagnostic(primitive, "gltfMeshAsset.generatedTangents", {
      reason: request.reason,
      tangentPath: "generated-mesh-attribute",
      vertexCount: primitive.vertexCount,
      message: `Generated renderer-independent TANGENT vertex attributes for primitive '${primitive.meshHandleKey}' because its glTF material uses normalTexture without authored TANGENT data.`,
    }),
  );

  return {
    semantic: "TANGENT",
    accessorIndex: -1,
    bufferIndex: -1,
    sourceByteOffset: 0,
    sourceByteLength: 0,
    expectedFormat: "float32x4",
    itemSize: 4,
    array: tangents,
  };
}

function calculateVertexTangents(input: {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint16Array | Uint32Array | null;
  readonly vertexCount: number;
  readonly triangleCount: number;
}): Float32Array {
  const tan1 = new Float32Array(input.vertexCount * 3);
  const tan2 = new Float32Array(input.vertexCount * 3);
  const tangents = new Float32Array(input.vertexCount * 4);

  for (let triangle = 0; triangle < input.triangleCount; triangle += 1) {
    const i1 = vertexIndex(input.indices, triangle * 3);
    const i2 = vertexIndex(input.indices, triangle * 3 + 1);
    const i3 = vertexIndex(input.indices, triangle * 3 + 2);

    accumulateTriangleTangents(
      input.positions,
      input.uvs,
      tan1,
      tan2,
      i1,
      i2,
      i3,
    );
  }

  for (let vertex = 0; vertex < input.vertexCount; vertex += 1) {
    writeOrthogonalizedTangent(input.normals, tan1, tan2, tangents, vertex);
  }

  return tangents;
}

function accumulateTriangleTangents(
  positions: Float32Array,
  uvs: Float32Array,
  tan1: Float32Array,
  tan2: Float32Array,
  i1: number,
  i2: number,
  i3: number,
): void {
  const p1 = i1 * 3;
  const p2 = i2 * 3;
  const p3 = i3 * 3;
  const uv1 = i1 * 2;
  const uv2 = i2 * 2;
  const uv3 = i3 * 2;
  const x1 = (positions[p2] ?? 0) - (positions[p1] ?? 0);
  const x2 = (positions[p3] ?? 0) - (positions[p1] ?? 0);
  const y1 = (positions[p2 + 1] ?? 0) - (positions[p1 + 1] ?? 0);
  const y2 = (positions[p3 + 1] ?? 0) - (positions[p1 + 1] ?? 0);
  const z1 = (positions[p2 + 2] ?? 0) - (positions[p1 + 2] ?? 0);
  const z2 = (positions[p3 + 2] ?? 0) - (positions[p1 + 2] ?? 0);
  const s1 = (uvs[uv2] ?? 0) - (uvs[uv1] ?? 0);
  const s2 = (uvs[uv3] ?? 0) - (uvs[uv1] ?? 0);
  const t1 = (uvs[uv2 + 1] ?? 0) - (uvs[uv1 + 1] ?? 0);
  const t2 = (uvs[uv3 + 1] ?? 0) - (uvs[uv1 + 1] ?? 0);
  const determinant = s1 * t2 - s2 * t1;
  const [sdirX, sdirY, sdirZ, tdirX, tdirY, tdirZ] =
    Math.abs(determinant) <= Number.EPSILON
      ? [0, 1, 0, 1, 0, 0]
      : [
          (t2 * x1 - t1 * x2) / determinant,
          (t2 * y1 - t1 * y2) / determinant,
          (t2 * z1 - t1 * z2) / determinant,
          (s1 * x2 - s2 * x1) / determinant,
          (s1 * y2 - s2 * y1) / determinant,
          (s1 * z2 - s2 * z1) / determinant,
        ];

  for (const index of [i1, i2, i3]) {
    const offset = index * 3;
    tan1[offset] = (tan1[offset] ?? 0) + sdirX;
    tan1[offset + 1] = (tan1[offset + 1] ?? 0) + sdirY;
    tan1[offset + 2] = (tan1[offset + 2] ?? 0) + sdirZ;
    tan2[offset] = (tan2[offset] ?? 0) + tdirX;
    tan2[offset + 1] = (tan2[offset + 1] ?? 0) + tdirY;
    tan2[offset + 2] = (tan2[offset + 2] ?? 0) + tdirZ;
  }
}

function writeOrthogonalizedTangent(
  normals: Float32Array,
  tan1: Float32Array,
  tan2: Float32Array,
  tangents: Float32Array,
  vertex: number,
): void {
  const n = vertex * 3;
  const t = vertex * 3;
  const nx = normals[n] ?? 0;
  const ny = normals[n + 1] ?? 0;
  const nz = normals[n + 2] ?? 1;
  const tx = tan1[t] ?? 0;
  const ty = tan1[t + 1] ?? 0;
  const tz = tan1[t + 2] ?? 0;
  const dot = nx * tx + ny * ty + nz * tz;
  const ox = tx - nx * dot;
  const oy = ty - ny * dot;
  const oz = tz - nz * dot;
  const [tangentX, tangentY, tangentZ] = normalizeOrFallbackTangent(
    ox,
    oy,
    oz,
    nx,
    ny,
    nz,
  );
  const cx = ny * tangentZ - nz * tangentY;
  const cy = nz * tangentX - nx * tangentZ;
  const cz = nx * tangentY - ny * tangentX;
  const handedness =
    cx * (tan2[t] ?? 0) + cy * (tan2[t + 1] ?? 0) + cz * (tan2[t + 2] ?? 0) < 0
      ? -1
      : 1;
  const out = vertex * 4;

  tangents[out] = tangentX;
  tangents[out + 1] = tangentY;
  tangents[out + 2] = tangentZ;
  tangents[out + 3] = handedness;
}

function normalizeOrFallbackTangent(
  x: number,
  y: number,
  z: number,
  normalX: number,
  normalY: number,
  normalZ: number,
): readonly [number, number, number] {
  const length = Math.hypot(x, y, z);
  if (length > Number.EPSILON) {
    return [x / length, y / length, z / length];
  }

  const fallback =
    Math.abs(normalZ) < 0.9
      ? crossAndNormalize(0, 0, 1, normalX, normalY, normalZ)
      : crossAndNormalize(0, 1, 0, normalX, normalY, normalZ);

  return fallback;
}

function crossAndNormalize(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): readonly [number, number, number] {
  const x = ay * bz - az * by;
  const y = az * bx - ax * bz;
  const z = ax * by - ay * bx;
  const length = Math.hypot(x, y, z);

  return length > Number.EPSILON
    ? [x / length, y / length, z / length]
    : [1, 0, 0];
}

function vertexIndex(
  indices: Uint16Array | Uint32Array | null,
  triangleComponent: number,
): number {
  return indices === null
    ? triangleComponent
    : (indices[triangleComponent] ?? 0);
}

function tangentDiagnostic(
  primitive: GltfDecodedPrimitiveAccessors,
  code: string,
  input: Omit<
    GltfMeshAssetConstructionDiagnostic,
    | "code"
    | "severity"
    | "meshHandleKey"
    | "meshIndex"
    | "primitiveIndex"
    | "semantic"
  >,
): GltfMeshAssetConstructionDiagnostic {
  return {
    code,
    severity: "warning",
    meshHandleKey: primitive.meshHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    semantic: "TANGENT",
    ...input,
  };
}
