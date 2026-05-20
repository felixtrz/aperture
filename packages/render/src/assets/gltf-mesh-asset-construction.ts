import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";

import type {
  GltfAccessorDecodingReport,
  GltfDecodedAccessor,
  GltfDecodedPrimitiveAccessors,
} from "./gltf-accessor-decoding.js";
import type {
  MeshAsset,
  MeshIndexBufferDescriptor,
  MeshVertexAttributeDescriptor,
} from "../mesh/index.js";

export interface GltfMeshAssetConstructionDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly meshHandleKey?: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly semantic?: string;
  readonly indexValue?: number;
  readonly vertexCount?: number;
  readonly reason?: GltfMeshAssetTangentGenerationReason;
  readonly tangentPath?: "generated-mesh-attribute";
}

export interface GltfPlannedMeshSourceAsset {
  readonly handleKey: string;
  readonly registeredHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly mesh: MeshAsset | null;
}

export interface GltfMeshAssetConstructionReport {
  readonly valid: boolean;
  readonly meshes: readonly GltfPlannedMeshSourceAsset[];
  readonly diagnostics: readonly GltfMeshAssetConstructionDiagnostic[];
}

export interface GltfMeshAssetConstructionArrayJsonSummary {
  readonly type: "Float32Array" | "Uint8Array" | "Uint16Array" | "Uint32Array";
  readonly length: number;
}

export interface GltfMeshAssetConstructionVertexStreamJsonSummary extends Omit<
  MeshAsset["vertexStreams"][number],
  "data"
> {
  readonly data: GltfMeshAssetConstructionArrayJsonSummary;
}

export interface GltfMeshAssetConstructionIndexBufferJsonSummary extends Omit<
  MeshIndexBufferDescriptor,
  "data"
> {
  readonly data: GltfMeshAssetConstructionArrayJsonSummary;
}

export interface GltfMeshAssetConstructionMeshJsonSummary extends Omit<
  MeshAsset,
  "vertexStreams" | "indexBuffer"
> {
  readonly vertexStreams: readonly GltfMeshAssetConstructionVertexStreamJsonSummary[];
  readonly indexBuffer?: GltfMeshAssetConstructionIndexBufferJsonSummary;
}

export interface GltfPlannedMeshSourceAssetJsonValue extends Omit<
  GltfPlannedMeshSourceAsset,
  "mesh"
> {
  readonly mesh: GltfMeshAssetConstructionMeshJsonSummary | null;
}

export interface GltfMeshAssetConstructionReportJsonValue extends Omit<
  GltfMeshAssetConstructionReport,
  "meshes"
> {
  readonly meshes: readonly GltfPlannedMeshSourceAssetJsonValue[];
}

export type GltfMeshAssetTangentGenerationReason = "normalTexture";

export interface GltfMeshAssetTangentGenerationRequest {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly reason: GltfMeshAssetTangentGenerationReason;
}

export interface GltfMeshAssetConstructionOptions {
  readonly decodedReport: GltfAccessorDecodingReport;
  readonly generateMissingTangentsFor?: readonly GltfMeshAssetTangentGenerationRequest[];
}

interface AttributeSource {
  readonly decoded: GltfDecodedAccessor;
  readonly offset: number;
}

export function createMeshAssetsFromGltfDecodedAccessors(
  options: GltfMeshAssetConstructionOptions,
): GltfMeshAssetConstructionReport {
  const diagnostics: GltfMeshAssetConstructionDiagnostic[] = [];
  const meshes: GltfPlannedMeshSourceAsset[] = [];
  const tangentRequests = new Map(
    (options.generateMissingTangentsFor ?? []).map((request) => [
      primitiveRequestKey(request.meshIndex, request.primitiveIndex),
      request,
    ]),
  );

  for (const primitive of options.decodedReport.primitives) {
    const mesh = createMeshAssetFromPrimitive(
      primitive,
      diagnostics,
      tangentRequests.get(
        primitiveRequestKey(primitive.meshIndex, primitive.primitiveIndex),
      ),
    );
    meshes.push({
      handleKey: meshIdFromRegisteredHandleKey(primitive.meshHandleKey),
      registeredHandleKey: primitive.meshHandleKey,
      meshIndex: primitive.meshIndex,
      primitiveIndex: primitive.primitiveIndex,
      mesh,
    });
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    meshes,
    diagnostics,
  };
}

export function gltfMeshAssetConstructionReportToJsonValue(
  report: GltfMeshAssetConstructionReport,
): GltfMeshAssetConstructionReportJsonValue {
  return {
    valid: report.valid,
    meshes: report.meshes.map((mesh) => ({
      ...mesh,
      mesh: mesh.mesh === null ? null : meshAssetToJsonValue(mesh.mesh),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfMeshAssetConstructionReportToJson(
  report: GltfMeshAssetConstructionReport,
): string {
  return JSON.stringify(gltfMeshAssetConstructionReportToJsonValue(report));
}

function createMeshAssetFromPrimitive(
  primitive: GltfDecodedPrimitiveAccessors,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
  tangentRequest: GltfMeshAssetTangentGenerationRequest | undefined,
): MeshAsset | null {
  const position = primitive.attributes.find(
    (attribute) => attribute.semantic === "POSITION",
  );
  if (position === undefined || !(position.array instanceof Float32Array)) {
    diagnostics.push(
      diagnostic(primitive, "gltfMeshAsset.missingPosition", {
        semantic: "POSITION",
        message: `Primitive '${primitive.meshHandleKey}' cannot construct a MeshAsset without decoded POSITION data.`,
      }),
    );
    return null;
  }

  const attributes = collectAttributes(
    primitive,
    position,
    diagnostics,
    tangentRequest,
  );
  if (attributes === null) {
    return null;
  }

  const packed = packAttributes(primitive.vertexCount, attributes);
  const indices = createIndexBuffer(primitive, diagnostics);
  if (indices === null && primitive.indices !== null) {
    return null;
  }

  const bounds = computeBounds(position, primitive, diagnostics);
  if (bounds === null) {
    return null;
  }

  return {
    kind: "mesh",
    label: primitive.meshHandleKey,
    vertexStreams: [
      {
        id: "gltf-primitive-interleaved",
        arrayStride: packed.strideFloats * 4,
        vertexCount: primitive.vertexCount,
        attributes: packed.descriptors,
        data: packed.data,
      },
    ],
    ...(indices === null ? {} : { indexBuffer: indices }),
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: primitive.vertexCount,
        indexStart: 0,
        indexCount: indices?.data.length ?? 0,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  };
}

function collectAttributes(
  primitive: GltfDecodedPrimitiveAccessors,
  position: GltfDecodedAccessor,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
  tangentRequest: GltfMeshAssetTangentGenerationRequest | undefined,
): readonly AttributeSource[] | null {
  const sources: AttributeSource[] = [{ decoded: position, offset: 0 }];
  let offset = position.itemSize * 4;
  const decodedBySemantic = new Map(
    primitive.attributes.map((attribute) => [attribute.semantic, attribute]),
  );

  if (tangentRequest !== undefined && !decodedBySemantic.has("TANGENT")) {
    const generated = generateMissingTangents(
      primitive,
      position,
      decodedBySemantic.get("NORMAL"),
      decodedBySemantic.get("TEXCOORD_0"),
      diagnostics,
      tangentRequest,
    );

    if (generated !== null) {
      decodedBySemantic.set("TANGENT", generated);
    }
  }

  for (const semantic of [
    "NORMAL",
    "TEXCOORD_0",
    "TANGENT",
    "TEXCOORD_1",
    "COLOR_0",
  ] as const) {
    const decoded = decodedBySemantic.get(semantic);
    if (decoded === undefined) {
      continue;
    }

    const count = decoded.array.length / decoded.itemSize;
    if (
      count !== primitive.vertexCount ||
      !(decoded.array instanceof Float32Array)
    ) {
      diagnostics.push(
        diagnostic(primitive, "gltfMeshAsset.mismatchedAttributeCount", {
          semantic,
          vertexCount: primitive.vertexCount,
          message: `Primitive '${primitive.meshHandleKey}' ${semantic} attribute count does not match POSITION vertex count.`,
        }),
      );
      return null;
    }

    sources.push({ decoded, offset });
    offset += decoded.itemSize * 4;
  }

  return sources;
}

function generateMissingTangents(
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

function packAttributes(
  vertexCount: number,
  sources: readonly AttributeSource[],
): {
  readonly data: Float32Array;
  readonly descriptors: readonly MeshVertexAttributeDescriptor[];
  readonly strideFloats: number;
} {
  const strideFloats = sources.reduce(
    (sum, source) => sum + source.decoded.itemSize,
    0,
  );
  const data = new Float32Array(vertexCount * strideFloats);
  const descriptors: MeshVertexAttributeDescriptor[] = [];
  let floatOffset = 0;

  for (const source of sources) {
    descriptors.push({
      semantic: source.decoded.semantic as
        | "POSITION"
        | "NORMAL"
        | "TEXCOORD_0"
        | "TEXCOORD_1"
        | "TANGENT"
        | "COLOR_0",
      format:
        source.decoded.itemSize === 2
          ? "float32x2"
          : source.decoded.itemSize === 4
            ? "float32x4"
            : "float32x3",
      offset: source.offset,
    });
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      for (
        let component = 0;
        component < source.decoded.itemSize;
        component += 1
      ) {
        data[vertex * strideFloats + floatOffset + component] =
          source.decoded.array[vertex * source.decoded.itemSize + component] ??
          0;
      }
    }
    floatOffset += source.decoded.itemSize;
  }

  return { data, descriptors, strideFloats };
}

function createIndexBuffer(
  primitive: GltfDecodedPrimitiveAccessors,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
): MeshIndexBufferDescriptor | null {
  if (primitive.indices === null) {
    return null;
  }

  const source = primitive.indices.array;
  if (!(source instanceof Uint16Array) && !(source instanceof Uint32Array)) {
    diagnostics.push(
      diagnostic(primitive, "gltfMeshAsset.unsupportedSemantic", {
        semantic: "INDICES",
        message: `Primitive '${primitive.meshHandleKey}' has unsupported index array type.`,
      }),
    );
    return null;
  }

  for (const indexValue of source) {
    if (indexValue >= primitive.vertexCount) {
      diagnostics.push(
        diagnostic(primitive, "gltfMeshAsset.invalidIndexValue", {
          semantic: "INDICES",
          indexValue,
          vertexCount: primitive.vertexCount,
          message: `Primitive '${primitive.meshHandleKey}' index ${indexValue} is outside vertex count ${primitive.vertexCount}.`,
        }),
      );
      return null;
    }
  }

  return {
    format: source instanceof Uint16Array ? "uint16" : "uint32",
    data: source,
  };
}

function computeBounds(
  position: GltfDecodedAccessor,
  primitive: GltfDecodedPrimitiveAccessors,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
): { readonly aabb: Aabb; readonly sphere: BoundingSphere } | null {
  if (position.array.length < 3 || position.itemSize !== 3) {
    diagnostics.push(
      diagnostic(primitive, "gltfMeshAsset.missingBounds", {
        semantic: "POSITION",
        message: `Primitive '${primitive.meshHandleKey}' cannot compute bounds without float32x3 POSITION data.`,
      }),
    );
    return null;
  }

  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

  for (let i = 0; i < position.array.length; i += 3) {
    for (const axis of [0, 1, 2] as const) {
      const value = position.array[i + axis] ?? 0;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }

  if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) {
    diagnostics.push(
      diagnostic(primitive, "gltfMeshAsset.invalidBounds", {
        semantic: "POSITION",
        message: `Primitive '${primitive.meshHandleKey}' produced non-finite bounds.`,
      }),
    );
    return null;
  }

  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  let radius = 0;
  for (let i = 0; i < position.array.length; i += 3) {
    const dx = (position.array[i] ?? 0) - center[0];
    const dy = (position.array[i + 1] ?? 0) - center[1];
    const dz = (position.array[i + 2] ?? 0) - center[2];
    radius = Math.max(radius, Math.hypot(dx, dy, dz));
  }

  return {
    aabb: { min, max },
    sphere: { center, radius },
  };
}

function diagnostic(
  primitive: GltfDecodedPrimitiveAccessors,
  code: string,
  input: Omit<
    GltfMeshAssetConstructionDiagnostic,
    "code" | "severity" | "meshHandleKey" | "meshIndex" | "primitiveIndex"
  >,
): GltfMeshAssetConstructionDiagnostic {
  return {
    code,
    severity: "error",
    meshHandleKey: primitive.meshHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    ...input,
  };
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

function meshAssetToJsonValue(
  mesh: MeshAsset,
): GltfMeshAssetConstructionMeshJsonSummary {
  const { vertexStreams, indexBuffer, ...rest } = mesh;

  return {
    ...rest,
    vertexStreams: vertexStreams.map((stream) => ({
      ...stream,
      data: typedArrayToJsonSummary(stream.data),
    })),
    ...(indexBuffer === undefined
      ? {}
      : {
          indexBuffer: {
            format: indexBuffer.format,
            data: typedArrayToJsonSummary(indexBuffer.data),
          },
        }),
  };
}

function typedArrayToJsonSummary(
  array: Float32Array | Uint8Array | Uint16Array | Uint32Array,
): GltfMeshAssetConstructionArrayJsonSummary {
  if (array instanceof Float32Array) {
    return { type: "Float32Array", length: array.length };
  }

  if (array instanceof Uint8Array) {
    return { type: "Uint8Array", length: array.length };
  }

  if (array instanceof Uint16Array) {
    return { type: "Uint16Array", length: array.length };
  }

  return { type: "Uint32Array", length: array.length };
}

function meshIdFromRegisteredHandleKey(handleKey: string): string {
  const prefix = "mesh:";
  return handleKey.startsWith(prefix)
    ? handleKey.slice(prefix.length)
    : handleKey;
}

function primitiveRequestKey(
  meshIndex: number,
  primitiveIndex: number,
): string {
  return `${meshIndex}:${primitiveIndex}`;
}
