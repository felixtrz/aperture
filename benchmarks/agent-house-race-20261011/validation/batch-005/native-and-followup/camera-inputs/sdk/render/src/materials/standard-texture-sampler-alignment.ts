import type {
  StandardMaterialSamplerFidelityReportJsonValue,
  StandardMaterialSamplerFidelitySlot,
} from "./standard-sampler-fidelity.js";
import type {
  StandardMaterialTextureField,
  StandardMaterialTextureReadinessReportJsonValue,
  StandardMaterialTextureReadinessSlot,
} from "./standard-texture-readiness.js";

export interface StandardMaterialTextureSamplerAlignmentFieldSummary {
  readonly field: StandardMaterialTextureField;
  readonly textureSlotReady: boolean | null;
  readonly samplerWarningCount: number;
}

export interface StandardMaterialTextureSamplerAlignmentSummary {
  readonly materialKey: string;
  readonly textureReady: boolean;
  readonly samplerFidelityReady: boolean;
  readonly blockingTextureDiagnosticCount: number;
  readonly samplerWarningCount: number;
  readonly byField: readonly StandardMaterialTextureSamplerAlignmentFieldSummary[];
}

export type StandardMaterialTextureSamplerAlignmentSummaryJsonValue =
  StandardMaterialTextureSamplerAlignmentSummary;

const STANDARD_TEXTURE_SAMPLER_ALIGNMENT_FIELDS = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
] as const satisfies readonly StandardMaterialTextureField[];

export function createStandardMaterialTextureSamplerAlignmentSummary(input: {
  readonly textureReadiness: StandardMaterialTextureReadinessReportJsonValue;
  readonly samplerFidelity: StandardMaterialSamplerFidelityReportJsonValue;
}): StandardMaterialTextureSamplerAlignmentSummary {
  const textureSlots = new Map(
    input.textureReadiness.slots.map((slot) => [slot.field, slot]),
  );
  const samplerSlots = new Map(
    input.samplerFidelity.slots.map((slot) => [slot.field, slot]),
  );

  return {
    materialKey: input.textureReadiness.materialKey,
    textureReady: input.textureReadiness.ready,
    samplerFidelityReady: input.samplerFidelity.ready,
    blockingTextureDiagnosticCount: input.textureReadiness.ready
      ? 0
      : input.textureReadiness.diagnostics.length,
    samplerWarningCount: input.samplerFidelity.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning",
    ).length,
    byField: STANDARD_TEXTURE_SAMPLER_ALIGNMENT_FIELDS.map((field) =>
      fieldSummary(field, textureSlots.get(field), samplerSlots.get(field)),
    ),
  };
}

export function standardMaterialTextureSamplerAlignmentSummaryToJsonValue(
  summary: StandardMaterialTextureSamplerAlignmentSummary,
): StandardMaterialTextureSamplerAlignmentSummaryJsonValue {
  return {
    materialKey: summary.materialKey,
    textureReady: summary.textureReady,
    samplerFidelityReady: summary.samplerFidelityReady,
    blockingTextureDiagnosticCount: summary.blockingTextureDiagnosticCount,
    samplerWarningCount: summary.samplerWarningCount,
    byField: summary.byField.map((field) => ({ ...field })),
  };
}

function fieldSummary(
  field: StandardMaterialTextureField,
  textureSlot: StandardMaterialTextureReadinessSlot | undefined,
  samplerSlot: StandardMaterialSamplerFidelitySlot | undefined,
): StandardMaterialTextureSamplerAlignmentFieldSummary {
  return {
    field,
    textureSlotReady: textureSlot?.ready ?? null,
    samplerWarningCount: samplerSlot?.warningCount ?? 0,
  };
}
