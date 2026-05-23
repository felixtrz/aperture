import {
  assetHandleKey,
  type AssetRegistry,
  type AssetStatus,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import type {
  MaterialAsset,
  MaterialKind,
  MaterialTextureBinding,
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
} from "./types.js";
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

const STANDARD_SAMPLER_TEXTURE_FIELDS = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "clearcoatTexture",
  "transmissionTexture",
  "sheenColorTexture",
  "sheenRoughnessTexture",
  "iridescenceTexture",
  "iridescenceThicknessTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
] as const satisfies readonly StandardMaterialTextureField[];

export function createStandardMaterialSamplerFidelityReport(
  options: StandardMaterialSamplerFidelityOptions,
): StandardMaterialSamplerFidelityReport {
  const materialKey = assetHandleKey(options.material);
  const entry = options.registry.get<"material", MaterialAsset>(
    options.material,
  );

  if (entry === undefined) {
    return {
      ready: false,
      materialKey,
      materialStatus: "missing",
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialSampler.missingMaterial",
          severity: "error",
          materialKey,
          status: "missing",
          message: `StandardMaterial sampler fidelity requires registered material '${materialKey}'.`,
        },
      ],
    };
  }

  if (entry.status !== "ready" || entry.asset === null) {
    return {
      ready: false,
      materialKey,
      materialStatus: entry.status,
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialSampler.materialNotReady",
          severity: entry.status === "failed" ? "error" : "warning",
          materialKey,
          status: entry.status,
          message: `StandardMaterial sampler fidelity requires material '${materialKey}' to be ready, not '${entry.status}'.`,
        },
      ],
    };
  }

  if (entry.asset.kind !== "standard") {
    return {
      ready: false,
      materialKey,
      materialStatus: entry.status,
      materialKind: entry.asset.kind,
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialSampler.unsupportedMaterialKind",
          severity: "error",
          materialKey,
          materialKind: entry.asset.kind,
          message: `StandardMaterial sampler fidelity requires a StandardMaterial, not '${entry.asset.kind}'.`,
        },
      ],
    };
  }

  return inspectStandardMaterialSamplers(
    options.registry,
    materialKey,
    entry.asset,
  );
}

export function standardMaterialSamplerFidelityReportToJsonValue(
  report: StandardMaterialSamplerFidelityReport,
): StandardMaterialSamplerFidelityReportJsonValue {
  return {
    ...report,
    slots: report.slots.map((slot) => ({ ...slot })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialSamplerFidelityReportToJson(
  report: StandardMaterialSamplerFidelityReport,
): string {
  return JSON.stringify(
    standardMaterialSamplerFidelityReportToJsonValue(report),
  );
}

function inspectStandardMaterialSamplers(
  registry: AssetRegistry,
  materialKey: string,
  material: StandardMaterialAsset,
): StandardMaterialSamplerFidelityReport {
  const slots: StandardMaterialSamplerFidelitySlot[] = [];
  const diagnostics: StandardMaterialSamplerFidelityDiagnostic[] = [];

  for (const field of STANDARD_SAMPLER_TEXTURE_FIELDS) {
    inspectSamplerBinding({
      registry,
      materialKey,
      field,
      binding: material[field],
      slots,
      diagnostics,
    });
  }

  return {
    ready: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    materialKey,
    materialStatus: "ready",
    materialKind: material.kind,
    slots,
    diagnostics,
  };
}

function inspectSamplerBinding(input: {
  readonly registry: AssetRegistry;
  readonly materialKey: string;
  readonly field: StandardMaterialTextureField;
  readonly binding: MaterialTextureBinding | null;
  readonly slots: StandardMaterialSamplerFidelitySlot[];
  readonly diagnostics: StandardMaterialSamplerFidelityDiagnostic[];
}): void {
  if (input.binding === null) {
    return;
  }

  const textureKey =
    input.binding.texture === null
      ? undefined
      : assetHandleKey(input.binding.texture);
  const samplerKey =
    input.binding.sampler === null
      ? undefined
      : assetHandleKey(input.binding.sampler);

  if (input.binding.texture === null || input.binding.sampler === null) {
    return;
  }

  const readyTextureKey = assetHandleKey(input.binding.texture);
  const readySamplerKey = assetHandleKey(input.binding.sampler);

  const textureEntry = input.registry.get<"texture", TextureAsset>(
    input.binding.texture,
  );
  const samplerEntry = input.registry.get<"sampler", SamplerAsset>(
    input.binding.sampler,
  );

  if (textureEntry === undefined || textureEntry.asset === null) {
    const status = textureEntry?.status ?? "missing";
    input.diagnostics.push({
      code: "standardMaterialSampler.textureNotReady",
      severity: status === "failed" ? "error" : "warning",
      materialKey: input.materialKey,
      ...(textureKey === undefined ? {} : { textureKey }),
      ...(samplerKey === undefined ? {} : { samplerKey }),
      field: input.field,
      status,
      message: `StandardMaterial ${input.field} sampler fidelity requires texture '${textureKey}' to be ready, not '${status}'.`,
    });
    return;
  }

  if (samplerEntry === undefined || samplerEntry.asset === null) {
    const status = samplerEntry?.status ?? "missing";
    input.diagnostics.push({
      code: "standardMaterialSampler.samplerNotReady",
      severity: status === "failed" ? "error" : "warning",
      materialKey: input.materialKey,
      textureKey: readyTextureKey,
      samplerKey: readySamplerKey,
      field: input.field,
      status,
      message: `StandardMaterial ${input.field} sampler fidelity requires sampler '${readySamplerKey}' to be ready, not '${status}'.`,
    });
    return;
  }

  inspectReadySamplerPair({
    materialKey: input.materialKey,
    field: input.field,
    textureKey: readyTextureKey,
    samplerKey: readySamplerKey,
    texture: textureEntry.asset,
    sampler: samplerEntry.asset,
    slots: input.slots,
    diagnostics: input.diagnostics,
  });
}

function inspectReadySamplerPair(input: {
  readonly materialKey: string;
  readonly field: StandardMaterialTextureField;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly texture: TextureAsset;
  readonly sampler: SamplerAsset;
  readonly slots: StandardMaterialSamplerFidelitySlot[];
  readonly diagnostics: StandardMaterialSamplerFidelityDiagnostic[];
}): void {
  const diagnosticStart = input.diagnostics.length;
  const maxSupportedLod = Math.max(0, input.texture.mipLevelCount - 1);

  if (
    input.texture.mipLevelCount <= 1 &&
    input.sampler.mipmapFilter !== "nearest"
  ) {
    input.diagnostics.push({
      code: "standardMaterialSampler.mipmapFilterWithoutMips",
      severity: "warning",
      materialKey: input.materialKey,
      textureKey: input.textureKey,
      samplerKey: input.samplerKey,
      field: input.field,
      mipLevelCount: input.texture.mipLevelCount,
      mipmapFilter: input.sampler.mipmapFilter,
      message: `StandardMaterial ${input.field} sampler '${input.samplerKey}' requests '${input.sampler.mipmapFilter}' mip filtering, but texture '${input.textureKey}' has only ${input.texture.mipLevelCount} mip level.`,
    });
  }

  if (input.sampler.lodMaxClamp > maxSupportedLod) {
    input.diagnostics.push({
      code: "standardMaterialSampler.lodMaxExceedsMipRange",
      severity: "warning",
      materialKey: input.materialKey,
      textureKey: input.textureKey,
      samplerKey: input.samplerKey,
      field: input.field,
      mipLevelCount: input.texture.mipLevelCount,
      lodMaxClamp: input.sampler.lodMaxClamp,
      maxSupportedLod,
      message: `StandardMaterial ${input.field} sampler '${input.samplerKey}' uses lodMaxClamp ${input.sampler.lodMaxClamp}, but texture '${input.textureKey}' supports LOD 0 through ${maxSupportedLod}.`,
    });
  }

  if (input.sampler.maxAnisotropy > 1) {
    input.diagnostics.push({
      code: "standardMaterialSampler.anisotropyNotReported",
      severity: "warning",
      materialKey: input.materialKey,
      textureKey: input.textureKey,
      samplerKey: input.samplerKey,
      field: input.field,
      maxAnisotropy: input.sampler.maxAnisotropy,
      message: `StandardMaterial ${input.field} sampler '${input.samplerKey}' authors maxAnisotropy ${input.sampler.maxAnisotropy}, but current StandardMaterial diagnostics do not report anisotropic sampling readiness.`,
    });
  }

  input.slots.push({
    field: input.field,
    textureKey: input.textureKey,
    samplerKey: input.samplerKey,
    mipLevelCount: input.texture.mipLevelCount,
    magFilter: input.sampler.magFilter,
    minFilter: input.sampler.minFilter,
    mipmapFilter: input.sampler.mipmapFilter,
    lodMinClamp: input.sampler.lodMinClamp,
    lodMaxClamp: input.sampler.lodMaxClamp,
    maxAnisotropy: input.sampler.maxAnisotropy,
    warningCount: input.diagnostics.length - diagnosticStart,
  });
}
