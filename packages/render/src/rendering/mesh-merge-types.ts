import type { MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset, MeshVertexStreamDescriptor } from "../mesh/index.js";

export type MeshMergeDiagnosticCode =
  | "meshMerge.emptyInput"
  | "meshMerge.invalidSourceMesh"
  | "meshMerge.incompatibleVertexStreamCount"
  | "meshMerge.incompatibleVertexStreamLayout"
  | "meshMerge.incompatibleVertexStreamData"
  | "meshMerge.incompatibleIndexPresence"
  | "meshMerge.invalidIndexRange"
  | "meshMerge.incompatibleTopology"
  | "meshMerge.incompatibleMaterialSlots";

export interface MeshMergeDiagnostic {
  readonly code: MeshMergeDiagnosticCode;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly meshKey?: string;
  readonly streamId?: string;
  readonly submesh?: number;
}

export interface MeshMergeSource {
  readonly handle: MeshHandle;
  readonly mesh: MeshAsset;
}

export interface MergedMeshSubmeshRange {
  readonly sourceMeshKey: string;
  readonly sourceMeshLabel: string;
  readonly sourceSubmesh: number;
  readonly mergedSubmesh: number;
  readonly vertexStart: number;
  readonly vertexCount: number;
  readonly indexStart: number;
  readonly indexCount: number;
}

export interface MergeMeshAssetsForBatchOptions {
  readonly label?: string;
  readonly sources: readonly MeshMergeSource[];
}

export interface MergeMeshAssetsForBatchResult {
  readonly valid: boolean;
  readonly mesh: MeshAsset | null;
  readonly ranges: readonly MergedMeshSubmeshRange[];
  readonly diagnostics: readonly MeshMergeDiagnostic[];
}

export type MeshVertexDataArray = MeshVertexStreamDescriptor["data"];

export interface SourceLayout {
  readonly meshKey: string;
  readonly mesh: MeshAsset;
  readonly vertexCount: number;
  readonly vertexBase: number;
  readonly indexBase: number;
}
