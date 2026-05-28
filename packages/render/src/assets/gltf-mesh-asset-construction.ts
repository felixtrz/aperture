import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";

import type {
  GltfAccessorDecodingReport,
  GltfDecodedAccessor,
  GltfDecodedPrimitiveAccessors,
} from "./gltf-accessor-decoding.js";
import type {
  MeshAsset,
  MeshIndexBufferDescriptor,
  MeshMorphTargetDescriptor,
  MeshVertexAttributeDescriptor,
} from "../mesh/index.js";
import { generateMissingTangents } from "./gltf-mesh-tangents.js";
import {
  createVertexStreams,
  decodedAttributeByteSize,
  isSupportedMeshAttributeArray,
  type GltfMeshAttributeSource,
} from "./gltf-mesh-asset-vertex-streams.js";

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

  const vertexStreams = createVertexStreams(primitive.vertexCount, attributes);
  const indices = createIndexBuffer(primitive, diagnostics);
  if (indices === null && primitive.indices !== null) {
    return null;
  }

  const bounds = computeBounds(position, primitive, diagnostics);
  if (bounds === null) {
    return null;
  }
  const descriptors = vertexStreams.flatMap((stream) => stream.attributes);
  const skinning = createMeshSkinningSchema(descriptors);
  const morphTargets = createMeshMorphTargetDescriptors(descriptors);

  return {
    kind: "mesh",
    label: primitive.meshHandleKey,
    vertexStreams,
    ...(indices === null ? {} : { indexBuffer: indices }),
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: primitive.vertexCount,
        indexStart: 0,
        indexCount: indices?.indexCount ?? indices?.data.length ?? 0,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
    ...(skinning === null ? {} : { skinning }),
    ...(morphTargets.length === 0 ? {} : { morphTargets }),
  };
}

function createMeshSkinningSchema(
  descriptors: readonly MeshVertexAttributeDescriptor[],
): NonNullable<MeshAsset["skinning"]> | null {
  const hasJoints0 = descriptors.some(
    (descriptor) => descriptor.semantic === "JOINTS_0",
  );
  const hasWeights0 = descriptors.some(
    (descriptor) => descriptor.semantic === "WEIGHTS_0",
  );

  return hasJoints0 && hasWeights0
    ? { joints0: "JOINTS_0", weights0: "WEIGHTS_0" }
    : null;
}

function createMeshMorphTargetDescriptors(
  descriptors: readonly MeshVertexAttributeDescriptor[],
): NonNullable<MeshAsset["morphTargets"]> {
  const semantics = new Set(
    descriptors.map((descriptor) => descriptor.semantic),
  );
  const targets: MeshMorphTargetDescriptor[] = [];

  if (semantics.has("MORPH_POSITION_0")) {
    targets.push({
      label: "target0",
      positionSemantic: "MORPH_POSITION_0",
      ...(semantics.has("MORPH_NORMAL_0")
        ? { normalSemantic: "MORPH_NORMAL_0" }
        : {}),
    });
  }

  if (semantics.has("MORPH_POSITION_1")) {
    targets.push({
      label: "target1",
      positionSemantic: "MORPH_POSITION_1",
      ...(semantics.has("MORPH_NORMAL_1")
        ? { normalSemantic: "MORPH_NORMAL_1" }
        : {}),
    });
  }

  return targets;
}

function collectAttributes(
  primitive: GltfDecodedPrimitiveAccessors,
  position: GltfDecodedAccessor,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
  tangentRequest: GltfMeshAssetTangentGenerationRequest | undefined,
): readonly GltfMeshAttributeSource[] | null {
  const sources: GltfMeshAttributeSource[] = [{ decoded: position, offset: 0 }];
  let offset = decodedAttributeByteSize(position);
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
    "JOINTS_0",
    "WEIGHTS_0",
    "MORPH_POSITION_0",
    "MORPH_NORMAL_0",
    "MORPH_POSITION_1",
    "MORPH_NORMAL_1",
    "TANGENT",
    "TEXCOORD_1",
    "COLOR_0",
  ] as const) {
    const decoded =
      decodedBySemantic.get(semantic) ??
      createZeroMorphAccessor(semantic, primitive, decodedBySemantic);
    if (decoded === undefined) {
      continue;
    }

    const count = decoded.array.length / decoded.itemSize;
    if (
      count !== primitive.vertexCount ||
      !isSupportedMeshAttributeArray(decoded)
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
    offset += decodedAttributeByteSize(decoded);
  }

  return sources;
}

function createZeroMorphAccessor(
  semantic: string,
  primitive: GltfDecodedPrimitiveAccessors,
  decodedBySemantic: ReadonlyMap<string, GltfDecodedAccessor>,
): GltfDecodedAccessor | undefined {
  const requiredByPosition =
    semantic === "MORPH_NORMAL_0"
      ? decodedBySemantic.has("MORPH_POSITION_0")
      : semantic === "MORPH_POSITION_1" || semantic === "MORPH_NORMAL_1"
        ? decodedBySemantic.has("MORPH_POSITION_0")
        : false;

  if (!requiredByPosition) {
    return undefined;
  }

  return {
    semantic: semantic as GltfDecodedAccessor["semantic"],
    accessorIndex: -1,
    bufferIndex: -1,
    sourceByteOffset: 0,
    sourceByteLength: 0,
    expectedFormat: "float32x3",
    itemSize: 3,
    array: new Float32Array(primitive.vertexCount * 3),
  };
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
