import type { GltfAccessorDecodingReport } from "./gltf-accessor-decoding.js";
import type {
  MeshAsset,
  MeshIndexBufferDescriptor,
  MeshMorphTargetData,
} from "../mesh/index.js";

export type GltfMeshAssetTangentGenerationReason = "normalTexture";

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

export interface GltfMeshAssetConstructionMorphTargetDataJsonSummary extends Omit<
  MeshMorphTargetData,
  "positionDeltas" | "normalDeltas"
> {
  readonly positionDeltas: GltfMeshAssetConstructionArrayJsonSummary;
  readonly normalDeltas: GltfMeshAssetConstructionArrayJsonSummary;
}

export interface GltfMeshAssetConstructionMeshJsonSummary extends Omit<
  MeshAsset,
  "vertexStreams" | "indexBuffer" | "morphTargetData"
> {
  readonly vertexStreams: readonly GltfMeshAssetConstructionVertexStreamJsonSummary[];
  readonly indexBuffer?: GltfMeshAssetConstructionIndexBufferJsonSummary;
  readonly morphTargetData?: GltfMeshAssetConstructionMorphTargetDataJsonSummary;
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

export interface GltfMeshAssetTangentGenerationRequest {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly reason: GltfMeshAssetTangentGenerationReason;
}

export interface GltfMeshAssetConstructionOptions {
  readonly decodedReport: GltfAccessorDecodingReport;
  readonly generateMissingTangentsFor?: readonly GltfMeshAssetTangentGenerationRequest[];
  /**
   * All-N morph-target deltas keyed by `${meshIndex}:${primitiveIndex}`, decoded
   * upstream by `importGltfMorphTargets`. Attached to the constructed mesh asset
   * as {@link MeshAsset.morphTargetData} for the storage-buffer GPU render path.
   */
  readonly morphTargetDataFor?: ReadonlyMap<string, MeshMorphTargetData>;
}
