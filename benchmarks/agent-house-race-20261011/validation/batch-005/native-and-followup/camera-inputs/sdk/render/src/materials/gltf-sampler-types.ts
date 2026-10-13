import type { SamplerAsset } from "./types.js";

export interface GltfSamplerSource {
  readonly name?: unknown;
  readonly wrapS?: unknown;
  readonly wrapT?: unknown;
  readonly magFilter?: unknown;
  readonly minFilter?: unknown;
}

export type GltfSamplerMappingDiagnosticCode =
  | "gltfSampler.invalidWrapMode"
  | "gltfSampler.invalidMagFilter"
  | "gltfSampler.invalidMinFilter";

export type GltfSamplerDiagnosticValue = string | number | boolean | null;

export interface GltfSamplerMappingDiagnostic {
  readonly code: GltfSamplerMappingDiagnosticCode;
  readonly message: string;
  readonly field: keyof GltfSamplerSource;
  readonly value: GltfSamplerDiagnosticValue;
  readonly expected: readonly number[];
}

export interface GltfSamplerMappingReport {
  readonly valid: boolean;
  readonly sampler: SamplerAsset;
  readonly diagnostics: readonly GltfSamplerMappingDiagnostic[];
}

export interface GltfSamplerMappingOptions {
  readonly label?: string;
}

export type GltfSamplerMappingReportJsonValue = GltfSamplerMappingReport;
