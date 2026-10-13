import type {
  MaterialAsset,
  MaterialTextureBinding,
  MaterialTextureTransform,
} from "./types.js";

export type GltfMaterialTextureSlot =
  | "baseColorTexture"
  | "metallicRoughnessTexture"
  | "clearcoatTexture"
  | "clearcoatRoughnessTexture"
  | "transmissionTexture"
  | "sheenColorTexture"
  | "sheenRoughnessTexture"
  | "iridescenceTexture"
  | "iridescenceThicknessTexture"
  | "normalTexture"
  | "occlusionTexture"
  | "emissiveTexture";

export type GltfMaterialTextureDependencyKind = "texture" | "sampler";

export type GltfMaterialMappingDiagnosticSeverity = "error" | "warning";

export type GltfMaterialMappingDiagnosticCode =
  | "gltfMaterial.unsupportedRequiredExtension"
  | "gltfMaterial.unsupportedOptionalExtension"
  | "gltfMaterial.malformedMaterial"
  | "gltfMaterial.invalidField"
  | "gltfMaterial.invalidTextureInfo"
  | "gltfMaterial.unresolvedTextureBinding"
  | "gltfMaterial.unsupportedUnlitField"
  | "gltfMaterial.unsupportedTextureTransform";

export type GltfMaterialDiagnosticValue = string | number | boolean | null;

export interface GltfMaterialMappingDiagnostic {
  readonly code: GltfMaterialMappingDiagnosticCode;
  readonly severity: GltfMaterialMappingDiagnosticSeverity;
  readonly message: string;
  readonly materialKey: string;
  readonly field?: string;
  readonly slot?: GltfMaterialTextureSlot;
  readonly extensionName?: string;
  readonly dependencyKind?: GltfMaterialTextureDependencyKind;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly value?: GltfMaterialDiagnosticValue;
}

export interface GltfMaterialTextureBindingResolverInput {
  readonly materialKey: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly field: string;
  readonly textureInfo: Record<string, unknown>;
  readonly textureIndex: number;
  readonly texCoord: number;
  readonly transform?: MaterialTextureTransform;
}

export interface GltfMaterialTextureBindingResolverDiagnostic {
  readonly code?: GltfMaterialMappingDiagnosticCode;
  readonly severity?: GltfMaterialMappingDiagnosticSeverity;
  readonly message: string;
  readonly field?: string;
  readonly dependencyKind?: GltfMaterialTextureDependencyKind;
  readonly textureIndex?: number;
  readonly samplerIndex?: number;
  readonly value?: GltfMaterialDiagnosticValue;
}

export interface GltfMaterialTextureBindingResolverReport {
  readonly binding?: MaterialTextureBinding | null;
  readonly diagnostics?: readonly GltfMaterialTextureBindingResolverDiagnostic[];
}

export type GltfMaterialTextureBindingResolverResult =
  | MaterialTextureBinding
  | GltfMaterialTextureBindingResolverReport
  | null
  | undefined;

export type GltfMaterialTextureBindingResolver = (
  input: GltfMaterialTextureBindingResolverInput,
) => GltfMaterialTextureBindingResolverResult;

export interface GltfMaterialMappingOptions {
  readonly materialKey?: string;
  readonly extensionsRequired?: readonly string[];
  readonly resolveTextureBinding?: GltfMaterialTextureBindingResolver;
}

export interface GltfMaterialMappingReport {
  readonly valid: boolean;
  readonly material: MaterialAsset | null;
  readonly diagnostics: readonly GltfMaterialMappingDiagnostic[];
}

export interface GltfMaterialMappingReportJsonValue {
  readonly valid: boolean;
  readonly material: Record<string, unknown> | null;
  readonly diagnostics: readonly GltfMaterialMappingDiagnostic[];
}
