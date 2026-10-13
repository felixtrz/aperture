import type {
  AssetRegistry,
  AssetStatus,
  MaterialHandle,
} from "@aperture-engine/simulation";
import type {
  MaterialKind,
  MaterialTextureTransform,
  TextureColorSpace,
  TextureFormat,
  TextureSemantic,
} from "./types.js";

export type StandardMaterialTextureField =
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

export type StandardMaterialTextureReadinessDiagnosticCode =
  | "standardMaterialTexture.missingMaterial"
  | "standardMaterialTexture.materialNotReady"
  | "standardMaterialTexture.unsupportedMaterialKind"
  | "standardMaterialTexture.missingTextureHandle"
  | "standardMaterialTexture.missingSamplerHandle"
  | "standardMaterialTexture.textureNotReady"
  | "standardMaterialTexture.samplerNotReady"
  | "standardMaterialTexture.unsupportedTexCoord"
  | "standardMaterialTexture.unsupportedTextureTransform"
  | "standardMaterialTexture.invalidSemantic"
  | "standardMaterialTexture.invalidColorSpace"
  | "standardMaterialTexture.invalidColorSpaceFormat";

export interface StandardMaterialTextureReadinessDiagnostic {
  readonly code: StandardMaterialTextureReadinessDiagnosticCode;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly materialKey: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly field?: StandardMaterialTextureField;
  readonly dependencyKind?: "texture" | "sampler";
  readonly status?: AssetStatus | "missing";
  readonly expectedSemantic?: TextureSemantic;
  readonly actualSemantic?: TextureSemantic;
  readonly expectedColorSpaces?: readonly TextureColorSpace[];
  readonly actualColorSpace?: TextureColorSpace;
  readonly expectedFormatSrgb?: boolean;
  readonly actualFormat?: TextureFormat;
  readonly texCoord?: number;
  readonly supportedTexCoords?: readonly number[];
  readonly textureTransform?: MaterialTextureTransform;
}

export interface StandardMaterialTextureReadinessSlot {
  readonly field: StandardMaterialTextureField;
  readonly textureKey: string;
  readonly expectedSemantic: TextureSemantic;
  readonly actualSemantic: TextureSemantic;
  readonly expectedColorSpaces: readonly TextureColorSpace[];
  readonly actualColorSpace: TextureColorSpace;
  readonly actualFormat: TextureFormat;
  readonly texCoord: number;
  readonly ready: boolean;
}

export interface StandardMaterialTextureReadinessReport {
  readonly ready: boolean;
  readonly materialKey: string;
  readonly materialStatus: AssetStatus | "missing";
  readonly materialKind?: MaterialKind;
  readonly slots: readonly StandardMaterialTextureReadinessSlot[];
  readonly diagnostics: readonly StandardMaterialTextureReadinessDiagnostic[];
}

export interface StandardMaterialTextureReadinessOptions {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
}

export type StandardMaterialTextureReadinessReportJsonValue =
  StandardMaterialTextureReadinessReport;

export interface StandardMaterialTextureExpectation {
  readonly field: StandardMaterialTextureField;
  readonly semantic: TextureSemantic;
  readonly colorSpaces: readonly TextureColorSpace[];
}
