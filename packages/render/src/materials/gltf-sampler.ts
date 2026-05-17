import { createSamplerAsset } from "./factories.js";
import type {
  SamplerAddressMode,
  SamplerAsset,
  SamplerFilterMode,
} from "./types.js";

export const GLTF_SAMPLER_WRAP = {
  CLAMP_TO_EDGE: 33071,
  MIRRORED_REPEAT: 33648,
  REPEAT: 10497,
} as const;

export const GLTF_SAMPLER_FILTER = {
  NEAREST: 9728,
  LINEAR: 9729,
  NEAREST_MIPMAP_NEAREST: 9984,
  LINEAR_MIPMAP_NEAREST: 9985,
  NEAREST_MIPMAP_LINEAR: 9986,
  LINEAR_MIPMAP_LINEAR: 9987,
} as const;

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

const GLTF_WRAP_VALUES = [
  GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
  GLTF_SAMPLER_WRAP.MIRRORED_REPEAT,
  GLTF_SAMPLER_WRAP.REPEAT,
] as const;

const GLTF_MAG_FILTER_VALUES = [
  GLTF_SAMPLER_FILTER.NEAREST,
  GLTF_SAMPLER_FILTER.LINEAR,
] as const;

const GLTF_MIN_FILTER_VALUES = [
  GLTF_SAMPLER_FILTER.NEAREST,
  GLTF_SAMPLER_FILTER.LINEAR,
  GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_NEAREST,
  GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_NEAREST,
  GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_LINEAR,
  GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
] as const;

interface MinFilterMapping {
  readonly minFilter?: SamplerFilterMode;
  readonly mipmapFilter?: SamplerFilterMode;
}

export function createSamplerAssetFromGltfSampler(
  source: GltfSamplerSource | null | undefined,
  options: GltfSamplerMappingOptions = {},
): GltfSamplerMappingReport {
  const diagnostics: GltfSamplerMappingDiagnostic[] = [];
  const samplerSource = source ?? {};
  const label =
    options.label ??
    (typeof samplerSource.name === "string" && samplerSource.name.length > 0
      ? samplerSource.name
      : "glTF Sampler");
  const addressModeU = mapWrapMode({
    field: "wrapS",
    value: samplerSource.wrapS,
    diagnostics,
  });
  const addressModeV = mapWrapMode({
    field: "wrapT",
    value: samplerSource.wrapT,
    diagnostics,
  });
  const magFilter = mapMagFilter(samplerSource.magFilter, diagnostics);
  const minFilter = mapMinFilter(samplerSource.minFilter, diagnostics);
  const samplerInput: Parameters<typeof createSamplerAsset>[0] = {
    label,
    ...(addressModeU === undefined ? {} : { addressModeU }),
    ...(addressModeV === undefined ? {} : { addressModeV }),
    ...(magFilter === undefined ? {} : { magFilter }),
    ...minFilter,
  };

  return {
    valid: diagnostics.length === 0,
    sampler: createSamplerAsset(samplerInput),
    diagnostics,
  };
}

export function gltfSamplerMappingReportToJsonValue(
  report: GltfSamplerMappingReport,
): GltfSamplerMappingReportJsonValue {
  return {
    valid: report.valid,
    sampler: { ...report.sampler },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfSamplerMappingReportToJson(
  report: GltfSamplerMappingReport,
): string {
  return JSON.stringify(gltfSamplerMappingReportToJsonValue(report));
}

function mapWrapMode(input: {
  readonly field: "wrapS" | "wrapT";
  readonly value: unknown;
  readonly diagnostics: GltfSamplerMappingDiagnostic[];
}): SamplerAddressMode | undefined {
  if (input.value === undefined) {
    return undefined;
  }

  switch (input.value) {
    case GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE:
      return "clamp-to-edge";
    case GLTF_SAMPLER_WRAP.MIRRORED_REPEAT:
      return "mirror-repeat";
    case GLTF_SAMPLER_WRAP.REPEAT:
      return "repeat";
    default:
      input.diagnostics.push({
        code: "gltfSampler.invalidWrapMode",
        field: input.field,
        value: toDiagnosticValue(input.value),
        expected: GLTF_WRAP_VALUES,
        message: `${input.field} must be a glTF sampler wrap enum value.`,
      });
      return undefined;
  }
}

function mapMagFilter(
  value: unknown,
  diagnostics: GltfSamplerMappingDiagnostic[],
): SamplerFilterMode | undefined {
  if (value === undefined) {
    return undefined;
  }

  switch (value) {
    case GLTF_SAMPLER_FILTER.NEAREST:
      return "nearest";
    case GLTF_SAMPLER_FILTER.LINEAR:
      return "linear";
    default:
      diagnostics.push({
        code: "gltfSampler.invalidMagFilter",
        field: "magFilter",
        value: toDiagnosticValue(value),
        expected: GLTF_MAG_FILTER_VALUES,
        message: "magFilter must be NEAREST or LINEAR.",
      });
      return undefined;
  }
}

function mapMinFilter(
  value: unknown,
  diagnostics: GltfSamplerMappingDiagnostic[],
): MinFilterMapping {
  if (value === undefined) {
    return {};
  }

  switch (value) {
    case GLTF_SAMPLER_FILTER.NEAREST:
    case GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_NEAREST:
      return { minFilter: "nearest", mipmapFilter: "nearest" };
    case GLTF_SAMPLER_FILTER.LINEAR:
    case GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_NEAREST:
      return { minFilter: "linear", mipmapFilter: "nearest" };
    case GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_LINEAR:
      return { minFilter: "nearest", mipmapFilter: "linear" };
    case GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR:
      return { minFilter: "linear", mipmapFilter: "linear" };
    default:
      diagnostics.push({
        code: "gltfSampler.invalidMinFilter",
        field: "minFilter",
        value: toDiagnosticValue(value),
        expected: GLTF_MIN_FILTER_VALUES,
        message: "minFilter must be a glTF sampler filter enum value.",
      });
      return {};
  }
}

function toDiagnosticValue(value: unknown): GltfSamplerDiagnosticValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "undefined":
      return "undefined";
    case "bigint":
    case "symbol":
    case "function":
    case "object":
      return Object.prototype.toString.call(value);
  }

  return String(value);
}
