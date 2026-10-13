import type {
  AssetRegistry,
  AssetStatus,
  MaterialHandle,
} from "@aperture-engine/simulation";
import type { MaterialKind, SamplerAsset } from "./types.js";
import type { StandardMaterialTextureField } from "./standard-texture-readiness.js";

export type StandardMaterialSamplerFidelityDiagnosticCode =
  | "standardMaterialSampler.missingMaterial"
  | "standardMaterialSampler.materialNotReady"
  | "standardMaterialSampler.unsupportedMaterialKind"
  | "standardMaterialSampler.textureNotReady"
  | "standardMaterialSampler.samplerNotReady"
  | "standardMaterialSampler.mipmapFilterWithoutMips"
  | "standardMaterialSampler.lodMaxExceedsMipRange"
  | "standardMaterialSampler.anisotropyNotReported";

export interface StandardMaterialSamplerFidelityDiagnostic {
  readonly code: StandardMaterialSamplerFidelityDiagnosticCode;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly materialKey: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly field?: StandardMaterialTextureField;
  readonly materialKind?: MaterialKind;
  readonly status?: AssetStatus | "missing";
  readonly mipLevelCount?: number;
  readonly mipmapFilter?: SamplerAsset["mipmapFilter"];
  readonly lodMaxClamp?: number;
  readonly maxSupportedLod?: number;
  readonly maxAnisotropy?: number;
}

export interface StandardMaterialSamplerFidelitySlot {
  readonly field: StandardMaterialTextureField;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly mipLevelCount: number;
  readonly magFilter: SamplerAsset["magFilter"];
  readonly minFilter: SamplerAsset["minFilter"];
  readonly mipmapFilter: SamplerAsset["mipmapFilter"];
  readonly lodMinClamp: number;
  readonly lodMaxClamp: number;
  readonly maxAnisotropy: number;
  readonly warningCount: number;
}

export interface StandardMaterialSamplerFidelityReport {
  readonly ready: boolean;
  readonly materialKey: string;
  readonly materialStatus: AssetStatus | "missing";
  readonly materialKind?: MaterialKind;
  readonly slots: readonly StandardMaterialSamplerFidelitySlot[];
  readonly diagnostics: readonly StandardMaterialSamplerFidelityDiagnostic[];
}

export interface StandardMaterialSamplerFidelityOptions {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
}

export type StandardMaterialSamplerFidelityReportJsonValue =
  StandardMaterialSamplerFidelityReport;
