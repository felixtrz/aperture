import type { MeshAsset } from "../mesh/index.js";
import type { GltfRootValidationReportJsonValue } from "./gltf-root.js";

export type GltfMeshPrimitiveMappingDiagnosticSeverity = "error" | "warning";

export type GltfMeshPrimitiveMappingLayer = "root" | "mesh";

export type GltfMeshPrimitiveMappingDiagnosticCode =
  | "gltfMesh.malformedMeshes"
  | "gltfMesh.missingMesh"
  | "gltfMesh.malformedPrimitives"
  | "gltfMesh.missingPrimitive"
  | "gltfMesh.malformedPrimitive"
  | "gltfMesh.missingPosition"
  | "gltfMesh.invalidAccessorReference"
  | "gltfMesh.invalidCompressedPrimitive"
  | "gltfMesh.unsupportedPrimitiveMode"
  | "gltfMesh.unsupportedCompressedPrimitive"
  | "gltfMesh.unresolvedAccessorData";

export type GltfMeshPrimitiveDiagnosticValue = string | number | boolean | null;

export type GltfMeshPrimitiveAttributeSemantic =
  | "POSITION"
  | "NORMAL"
  | "TEXCOORD_0"
  | "TEXCOORD_1"
  | "TANGENT"
  | "COLOR_0"
  | "JOINTS_0"
  | "WEIGHTS_0"
  | "MORPH_POSITION_0"
  | "MORPH_NORMAL_0"
  | "MORPH_POSITION_1"
  | "MORPH_NORMAL_1";

export interface GltfMeshPrimitiveMappingDiagnostic {
  readonly layer: GltfMeshPrimitiveMappingLayer;
  readonly code: string;
  readonly severity: GltfMeshPrimitiveMappingDiagnosticSeverity;
  readonly message: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly accessorIndex?: number;
  readonly attribute?: GltfMeshPrimitiveAttributeSemantic;
  readonly field?: string;
  readonly mode?: number;
  readonly extensionName?: string;
  readonly value?: GltfMeshPrimitiveDiagnosticValue;
}

export type GltfSupportedCompressedPrimitiveExtension =
  "KHR_draco_mesh_compression";

export interface GltfMeshPrimitiveSelection {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
}

export interface GltfMeshPrimitiveMappingOptions {
  readonly root: unknown;
  readonly meshPrimitiveIndices?: readonly GltfMeshPrimitiveSelection[];
  readonly keyPrefix?: string;
  readonly supportedCompressedPrimitiveExtensions?: readonly GltfSupportedCompressedPrimitiveExtension[];
}

export interface GltfMeshPrimitiveAttributeReference {
  readonly semantic: GltfMeshPrimitiveAttributeSemantic;
  readonly accessorIndex: number;
}

export interface GltfMeshPrimitiveAttributeReferences {
  readonly position: GltfMeshPrimitiveAttributeReference;
  readonly normal?: GltfMeshPrimitiveAttributeReference;
  readonly texcoord0?: GltfMeshPrimitiveAttributeReference;
  readonly texcoord1?: GltfMeshPrimitiveAttributeReference;
  readonly tangent?: GltfMeshPrimitiveAttributeReference;
  readonly color0?: GltfMeshPrimitiveAttributeReference;
  readonly joints0?: GltfMeshPrimitiveAttributeReference;
  readonly weights0?: GltfMeshPrimitiveAttributeReference;
  readonly morphPosition0?: GltfMeshPrimitiveAttributeReference;
  readonly morphNormal0?: GltfMeshPrimitiveAttributeReference;
  readonly morphPosition1?: GltfMeshPrimitiveAttributeReference;
  readonly morphNormal1?: GltfMeshPrimitiveAttributeReference;
}

export interface GltfMeshPrimitiveIndexReference {
  readonly accessorIndex: number;
}

export interface GltfCompressedMeshPrimitiveAttributeReference {
  readonly semantic: GltfMeshPrimitiveAttributeSemantic;
  readonly uniqueId: number;
}

export interface GltfCompressedMeshPrimitiveReference {
  readonly extensionName: GltfSupportedCompressedPrimitiveExtension;
  readonly bufferView: number;
  readonly attributes: readonly GltfCompressedMeshPrimitiveAttributeReference[];
}

export interface GltfPlannedMeshPrimitiveAsset {
  readonly handleKey: string;
  readonly registeredHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly label: string;
  readonly topology: "triangle-list";
  readonly attributes: GltfMeshPrimitiveAttributeReferences;
  readonly indices: GltfMeshPrimitiveIndexReference | null;
  readonly compression: GltfCompressedMeshPrimitiveReference | null;
  readonly materialIndex: number | null;
  readonly mesh: MeshAsset | null;
}

export interface GltfMeshPrimitiveMappingReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly meshes: readonly GltfPlannedMeshPrimitiveAsset[];
  readonly diagnostics: readonly GltfMeshPrimitiveMappingDiagnostic[];
}

export interface GltfMeshAssetJsonSummary {
  readonly kind: "mesh";
  readonly label: string;
  readonly vertexStreams: number;
  readonly submeshes: number;
  readonly materialSlots: number;
  readonly indexFormat?: "uint16" | "uint32";
  readonly indexCount?: number;
  readonly hasLocalAabb: boolean;
  readonly hasLocalSphere: boolean;
}

export interface GltfPlannedMeshPrimitiveAssetJsonValue extends Omit<
  GltfPlannedMeshPrimitiveAsset,
  "mesh"
> {
  readonly mesh: GltfMeshAssetJsonSummary | null;
}

export interface GltfMeshPrimitiveMappingReportJsonValue {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly meshes: readonly GltfPlannedMeshPrimitiveAssetJsonValue[];
  readonly diagnostics: readonly GltfMeshPrimitiveMappingDiagnostic[];
}
