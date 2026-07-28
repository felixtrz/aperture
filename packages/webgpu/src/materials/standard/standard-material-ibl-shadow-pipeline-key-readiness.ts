import type { StandardMaterialIblShadowBindingReadinessReport } from "./standard-material-ibl-shadow-binding-readiness.js";

export type StandardMaterialIblShadowPipelineKeyStatus =
  | "available"
  | "inactive"
  | "missing"
  | "not-required";

export type StandardMaterialIblShadowPipelineFeature =
  | "ibl-diffuse-irradiance"
  | "ibl-specular-prefilter"
  | "shadow-view-projection"
  | "shadow-map";

export type StandardMaterialIblShadowPipelineKeyDiagnosticCode =
  | "standardMaterialIblShadowPipelineKey.missingBindingReadiness"
  | "standardMaterialIblShadowPipelineKey.featureInactive";

export interface StandardMaterialIblShadowPipelineKeyFeature {
  readonly feature: StandardMaterialIblShadowPipelineFeature;
  readonly pipelineKeyToken: string;
  readonly source: "ibl" | "shadow";
  readonly requiredBySlotCount: number;
  readonly readiness: "available" | "inactive";
}

export interface StandardMaterialIblShadowPipelineKeyDiagnostic {
  readonly code: StandardMaterialIblShadowPipelineKeyDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly feature?: StandardMaterialIblShadowPipelineFeature;
}

export interface StandardMaterialIblShadowPipelineKeyReadinessReport {
  readonly ready: boolean;
  readonly status: StandardMaterialIblShadowPipelineKeyStatus;
  readonly standardMaterialCount: number;
  readonly featureCount: number;
  readonly sections: {
    readonly bindingReadiness: boolean;
    readonly pipelineKeyMetadata: boolean;
    readonly pipelineDescriptor: boolean;
    readonly bindGroupLayout: boolean;
    readonly shaderSampling: boolean;
  };
  readonly features: readonly StandardMaterialIblShadowPipelineKeyFeature[];
  readonly diagnostics: readonly StandardMaterialIblShadowPipelineKeyDiagnostic[];
}

export type StandardMaterialIblShadowPipelineKeyReadinessReportJsonValue =
  StandardMaterialIblShadowPipelineKeyReadinessReport;

export interface StandardMaterialIblShadowPipelineKeyReadinessInput {
  readonly standardMaterialCount: number;
  readonly bindingReadiness: StandardMaterialIblShadowBindingReadinessReport;
  readonly submittedPipelineKeys?: readonly string[];
  readonly bindGroupAvailable?: boolean;
}

export function createStandardMaterialIblShadowPipelineKeyReadinessReport(
  input: StandardMaterialIblShadowPipelineKeyReadinessInput,
): StandardMaterialIblShadowPipelineKeyReadinessReport {
  if (input.standardMaterialCount === 0) {
    return emptyReport("not-required", input.standardMaterialCount, true);
  }

  if (input.bindingReadiness.status === "missing") {
    return {
      ...emptyReport("missing", input.standardMaterialCount, false),
      diagnostics: [
        {
          code: "standardMaterialIblShadowPipelineKey.missingBindingReadiness",
          severity: "warning",
          message:
            "StandardMaterial IBL/shadow pipeline readiness requires available binding metadata.",
        },
      ],
    };
  }

  const pipelineKeys = input.submittedPipelineKeys ?? [];
  const features = summarizeFeatures(input.bindingReadiness).map((feature) => {
    const token = selectedPipelineToken(feature.feature, pipelineKeys);
    const slotsReady = input.bindingReadiness.slots
      .filter((slot) => slotToFeature(slot.kind) === feature.feature)
      .every((slot) => slot.readiness === "available");
    const active =
      slotsReady && pipelineKeys.some((key) => hasPipelineToken(key, token));
    return {
      ...feature,
      pipelineKeyToken: token,
      readiness: active ? ("available" as const) : ("inactive" as const),
    };
  });
  const bindGroupAvailable =
    input.bindGroupAvailable ?? input.bindingReadiness.status === "available";
  const shaderSampling =
    features.length > 0 &&
    bindGroupAvailable &&
    features.every((feature) => feature.readiness === "available");
  const diagnostics = features.flatMap((feature) =>
    feature.readiness === "available"
      ? []
      : [
          {
            code: "standardMaterialIblShadowPipelineKey.featureInactive" as const,
            severity: "warning" as const,
            feature: feature.feature,
            message: `${feature.pipelineKeyToken} is required by binding state but is not active in the submitted StandardMaterial pipeline.`,
          },
        ],
  );

  return {
    ready: shaderSampling,
    status: shaderSampling ? "available" : "inactive",
    standardMaterialCount: input.standardMaterialCount,
    featureCount: features.length,
    sections: {
      bindingReadiness: input.bindingReadiness.ready,
      pipelineKeyMetadata: true,
      pipelineDescriptor: pipelineKeys.length > 0,
      bindGroupLayout: bindGroupAvailable,
      shaderSampling,
    },
    features,
    diagnostics,
  };
}

export function standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(
  report: StandardMaterialIblShadowPipelineKeyReadinessReport,
): StandardMaterialIblShadowPipelineKeyReadinessReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    standardMaterialCount: report.standardMaterialCount,
    featureCount: report.featureCount,
    sections: { ...report.sections },
    features: report.features.map((feature) => ({ ...feature })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialIblShadowPipelineKeyReadinessReportToJson(
  report: StandardMaterialIblShadowPipelineKeyReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(report),
  );
}

function emptyReport(
  status: "not-required" | "missing",
  standardMaterialCount: number,
  ready: boolean,
): StandardMaterialIblShadowPipelineKeyReadinessReport {
  return {
    ready,
    status,
    standardMaterialCount,
    featureCount: 0,
    sections: {
      bindingReadiness: ready,
      pipelineKeyMetadata: ready,
      pipelineDescriptor: ready,
      bindGroupLayout: ready,
      shaderSampling: false,
    },
    features: [],
    diagnostics: [],
  };
}

function summarizeFeatures(
  bindingReadiness: StandardMaterialIblShadowBindingReadinessReport,
): Omit<StandardMaterialIblShadowPipelineKeyFeature, "readiness">[] {
  const counts = new Map<StandardMaterialIblShadowPipelineFeature, number>();

  for (const slot of bindingReadiness.slots) {
    const feature = slotToFeature(slot.kind);
    counts.set(feature, (counts.get(feature) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([feature, requiredBySlotCount]) => ({
      feature,
      pipelineKeyToken: selectedPipelineToken(feature, []),
      source:
        feature === "ibl-diffuse-irradiance" ||
        feature === "ibl-specular-prefilter"
          ? ("ibl" as const)
          : ("shadow" as const),
      requiredBySlotCount,
    }))
    .sort((a, b) => a.feature.localeCompare(b.feature));
}

function slotToFeature(
  slotKind: StandardMaterialIblShadowBindingReadinessReport["slots"][number]["kind"],
): StandardMaterialIblShadowPipelineFeature {
  if (slotKind === "ibl-diffuse") return "ibl-diffuse-irradiance";
  if (slotKind === "ibl-specular") return "ibl-specular-prefilter";
  if (slotKind === "shadow-view-projection") return "shadow-view-projection";
  return "shadow-map";
}

function selectedPipelineToken(
  feature: StandardMaterialIblShadowPipelineFeature,
  keys: readonly string[],
): string {
  switch (feature) {
    case "ibl-diffuse-irradiance":
      return "iblDiffuse";
    case "ibl-specular-prefilter":
      return keys.some((key) => hasPipelineToken(key, "iblSpecularBrdf"))
        ? "iblSpecularBrdf"
        : "iblSpecularProof";
    case "shadow-view-projection":
    case "shadow-map":
      return "shadowMap";
  }
}

function hasPipelineToken(key: string, token: string): boolean {
  return `|${key}|`.includes(`|${token}|`);
}
