import type {
  GltfImageDataResolver,
  GltfMaterialDiagnosticValue,
  GltfMaterialMappingDiagnosticSeverity,
  GltfMaterialMappingReportJsonValue,
  GltfMaterialTextureDependencyKind,
  GltfMaterialTextureSlot,
  GltfTextureMappingReport,
  GltfTextureMappingReportJsonValue,
  MaterialAsset,
  SamplerAsset,
  TextureAsset,
} from "../materials/index.js";
import type { GltfRootValidationReportJsonValue } from "./gltf-root.js";

export type GltfAssetMappingLayer = "root" | "texture" | "material";

export interface GltfAssetMappingDiagnostic {
  readonly layer: GltfAssetMappingLayer;
  readonly code: string;
  readonly severity: GltfMaterialMappingDiagnosticSeverity;
  readonly message: string;
  readonly materialIndex?: number;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly slot?: GltfMaterialTextureSlot;
  readonly field?: string;
  readonly extensionName?: string;
  readonly dependencyKind?: GltfMaterialTextureDependencyKind;
  readonly value?: GltfMaterialDiagnosticValue;
}

export interface GltfPlannedTextureAsset {
  readonly handleKey: string;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly texture: TextureAsset | null;
  readonly report: GltfTextureMappingReportJsonValue;
}

export interface GltfPlannedSamplerAsset {
  readonly handleKey: string;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly source: Record<string, unknown> | null;
  readonly sampler: SamplerAsset | null;
}

export interface GltfPlannedMaterialAsset {
  readonly handleKey: string;
  readonly materialIndex: number;
  readonly material: MaterialAsset | null;
  readonly report: GltfMaterialMappingReportJsonValue;
}

export interface GltfAssetMappingOptions {
  readonly root: unknown;
  readonly resolveImageData: GltfImageDataResolver;
  readonly materialIndices?: readonly number[];
  readonly keyPrefix?: string;
}

export interface GltfAssetMappingReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly textures: readonly GltfPlannedTextureAsset[];
  readonly samplers: readonly GltfPlannedSamplerAsset[];
  readonly materials: readonly GltfPlannedMaterialAsset[];
  readonly diagnostics: readonly GltfAssetMappingDiagnostic[];
}

export interface GltfPlannedTextureAssetJsonValue {
  readonly handleKey: string;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly texture: Record<string, unknown> | null;
  readonly report: GltfTextureMappingReportJsonValue;
}

export interface GltfPlannedMaterialAssetJsonValue {
  readonly handleKey: string;
  readonly materialIndex: number;
  readonly material: Record<string, unknown> | null;
  readonly report: GltfMaterialMappingReportJsonValue;
}

export interface GltfAssetMappingReportJsonValue {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly textures: readonly GltfPlannedTextureAssetJsonValue[];
  readonly samplers: readonly GltfPlannedSamplerAsset[];
  readonly materials: readonly GltfPlannedMaterialAssetJsonValue[];
  readonly diagnostics: readonly GltfAssetMappingDiagnostic[];
}

export interface TextureReportEntry {
  readonly key: string;
  readonly report: GltfTextureMappingReport;
  readonly textureHandleKey: string;
  readonly samplerHandleKey: string;
}
