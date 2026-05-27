import type { StandardMaterialIblShadowBindingReadinessReport } from "./standard-material-ibl-shadow-binding-readiness.js";

export type StandardMaterialIblShadowPipelineKeyStatus =
  | "deferred"
  | "missing"
  | "not-required";

export type StandardMaterialIblShadowPipelineFeature =
  | "ibl-diffuse-irradiance"
  | "ibl-specular-prefilter"
  | "shadow-view-projection"
  | "shadow-map";

export type StandardMaterialIblShadowPipelineKeyDiagnosticCode =
  | "standardMaterialIblShadowPipelineKey.missingBindingReadiness"
  | "standardMaterialIblShadowPipelineKey.deferredFeature"
  | "standardMaterialIblShadowPipelineKey.shaderSamplingDeferred";

export interface StandardMaterialIblShadowPipelineKeyFeature {
  readonly feature: StandardMaterialIblShadowPipelineFeature;
  readonly pipelineKeyToken: string;
  readonly source: "ibl" | "shadow";
  readonly requiredBySlotCount: number;
  readonly readiness: "deferred";
}

export interface StandardMaterialIblShadowPipelineKeyDiagnostic {
  readonly code: StandardMaterialIblShadowPipelineKeyDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly feature?: StandardMaterialIblShadowPipelineFeature;
}

export interface StandardMaterialIblShadowPipelineKeyReadinessReport {
  readonly ready: false | true;
  readonly status: StandardMaterialIblShadowPipelineKeyStatus;
  readonly standardMaterialCount: number;
  readonly featureCount: number;
  readonly sections: {
    readonly bindingReadiness: boolean;
    readonly pipelineKeyMetadata: boolean;
    readonly pipelineDescriptor: false;
    readonly bindGroupLayout: false;
    readonly shaderSampling: false;
  };
  readonly features: readonly StandardMaterialIblShadowPipelineKeyFeature[];
  readonly diagnostics: readonly StandardMaterialIblShadowPipelineKeyDiagnostic[];
}

export type StandardMaterialIblShadowPipelineKeyReadinessReportJsonValue =
  StandardMaterialIblShadowPipelineKeyReadinessReport;

export interface StandardMaterialIblShadowPipelineKeyReadinessInput {
  readonly standardMaterialCount: number;
  readonly bindingReadiness: StandardMaterialIblShadowBindingReadinessReport;
}

export function createStandardMaterialIblShadowPipelineKeyReadinessReport(
  input: StandardMaterialIblShadowPipelineKeyReadinessInput,
): StandardMaterialIblShadowPipelineKeyReadinessReport {
  if (input.standardMaterialCount === 0) {
    return {
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      featureCount: 0,
      sections: {
        bindingReadiness: true,
        pipelineKeyMetadata: true,
        pipelineDescriptor: false,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      features: [],
      diagnostics: [],
    };
  }

  if (input.bindingReadiness.status === "missing") {
    return {
      ready: false,
      status: "missing",
      standardMaterialCount: input.standardMaterialCount,
      featureCount: 0,
      sections: {
        bindingReadiness: false,
        pipelineKeyMetadata: false,
        pipelineDescriptor: false,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      features: [],
      diagnostics: [
        {
          code: "standardMaterialIblShadowPipelineKey.missingBindingReadiness",
          severity: "warning",
          message:
            "StandardMaterial IBL/shadow pipeline-key readiness requires binding readiness metadata.",
        },
      ],
    };
  }

  const features = summarizeFeatures(input.bindingReadiness);
  const diagnostics: StandardMaterialIblShadowPipelineKeyDiagnostic[] =
    features.flatMap((feature) => [
      {
        code: "standardMaterialIblShadowPipelineKey.deferredFeature" as const,
        severity: "warning" as const,
        feature: feature.feature,
        message: `${feature.pipelineKeyToken} is a deferred StandardMaterial pipeline-key feature for future IBL/shadow sampling.`,
      },
    ]);

  if (features.length > 0) {
    diagnostics.push({
      code: "standardMaterialIblShadowPipelineKey.shaderSamplingDeferred",
      severity: "warning",
      message:
        "StandardMaterial IBL/shadow pipeline-key metadata is planned, but WGSL, bind-group layouts, and shader sampling remain deferred.",
    });
  }

  return {
    ready: false,
    status: "deferred",
    standardMaterialCount: input.standardMaterialCount,
    featureCount: features.length,
    sections: {
      bindingReadiness: true,
      pipelineKeyMetadata: true,
      pipelineDescriptor: false,
      bindGroupLayout: false,
      shaderSampling: false,
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

function summarizeFeatures(
  bindingReadiness: StandardMaterialIblShadowBindingReadinessReport,
): StandardMaterialIblShadowPipelineKeyFeature[] {
  const counts = new Map<StandardMaterialIblShadowPipelineFeature, number>();

  for (const slot of bindingReadiness.slots) {
    counts.set(
      slotToFeature(slot.kind),
      (counts.get(slotToFeature(slot.kind)) ?? 0) + 1,
    );
  }

  return [...counts.entries()]
    .map(([feature, requiredBySlotCount]) => ({
      feature,
      pipelineKeyToken: pipelineKeyTokenForFeature(feature),
      source:
        feature === "ibl-diffuse-irradiance" ||
        feature === "ibl-specular-prefilter"
          ? ("ibl" as const)
          : ("shadow" as const),
      requiredBySlotCount,
      readiness: "deferred" as const,
    }))
    .sort((a, b) => a.pipelineKeyToken.localeCompare(b.pipelineKeyToken));
}

function slotToFeature(
  slotKind: StandardMaterialIblShadowBindingReadinessReport["slots"][number]["kind"],
): StandardMaterialIblShadowPipelineFeature {
  if (slotKind === "ibl-diffuse") {
    return "ibl-diffuse-irradiance";
  }

  if (slotKind === "ibl-specular") {
    return "ibl-specular-prefilter";
  }

  if (slotKind === "shadow-view-projection") {
    return "shadow-view-projection";
  }

  return "shadow-map";
}

function pipelineKeyTokenForFeature(
  feature: StandardMaterialIblShadowPipelineFeature,
): string {
  switch (feature) {
    case "ibl-diffuse-irradiance":
      return "iblDiffuseIrradiance";
    case "ibl-specular-prefilter":
      return "iblSpecularPrefilter";
    case "shadow-view-projection":
      return "shadowViewProjection";
    case "shadow-map":
      return "shadowMap";
  }
}
