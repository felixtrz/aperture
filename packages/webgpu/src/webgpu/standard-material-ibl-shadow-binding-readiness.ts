import type { IblPreparationPassPlanReport } from "./ibl-preparation-pass-plan.js";
import type { DirectionalShadowViewProjectionPlanReport } from "./directional-shadow-view-projection-plan.js";
import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";

export type StandardMaterialIblShadowBindingStatus =
  | "available"
  | "deferred"
  | "missing"
  | "not-required";

export type StandardMaterialIblShadowBindingDiagnosticCode =
  | "standardMaterialIblShadowBinding.missingIblPlan"
  | "standardMaterialIblShadowBinding.missingShadowPlan"
  | "standardMaterialIblShadowBinding.bindGroupDeferred"
  | "standardMaterialIblShadowBinding.shaderSamplingDeferred";

export interface StandardMaterialIblShadowBindingSlot {
  readonly bindingKey: string;
  readonly resourceKey: string;
  readonly kind:
    | "ibl-diffuse"
    | "ibl-specular"
    | "shadow-view-projection"
    | "shadow-map";
  readonly source: "ibl" | "shadow";
  readonly readiness: "deferred" | "available";
}

export interface StandardMaterialIblShadowBindingDiagnostic {
  readonly code: StandardMaterialIblShadowBindingDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface StandardMaterialIblShadowBindingReadinessReport {
  readonly ready: boolean;
  readonly status: StandardMaterialIblShadowBindingStatus;
  readonly standardMaterialCount: number;
  readonly slotCount: number;
  readonly sections: {
    readonly iblPassPlanning: boolean;
    readonly shadowPlanning: boolean;
    readonly bindGroupLayout: false;
    readonly shaderSampling: false;
  };
  readonly slots: readonly StandardMaterialIblShadowBindingSlot[];
  readonly diagnostics: readonly StandardMaterialIblShadowBindingDiagnostic[];
}

export type StandardMaterialIblShadowBindingReadinessReportJsonValue =
  StandardMaterialIblShadowBindingReadinessReport;

export interface StandardMaterialIblShadowBindingReadinessInput {
  readonly standardMaterialCount: number;
  readonly iblPassPlan: IblPreparationPassPlanReport;
  readonly shadowViewProjection: DirectionalShadowViewProjectionPlanReport;
  readonly shadowCasterDrawList: ShadowCasterDrawListPlanReport;
}

export function createStandardMaterialIblShadowBindingReadinessReport(
  input: StandardMaterialIblShadowBindingReadinessInput,
): StandardMaterialIblShadowBindingReadinessReport {
  if (input.standardMaterialCount === 0) {
    return {
      ready: true,
      status: "not-required",
      standardMaterialCount: 0,
      slotCount: 0,
      sections: {
        iblPassPlanning: true,
        shadowPlanning: true,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      slots: [],
      diagnostics: [],
    };
  }

  const diagnostics: StandardMaterialIblShadowBindingDiagnostic[] = [];
  const slots: StandardMaterialIblShadowBindingSlot[] = [];

  if (input.iblPassPlan.status === "missing") {
    diagnostics.push({
      code: "standardMaterialIblShadowBinding.missingIblPlan",
      severity: "warning",
      message:
        "StandardMaterial IBL binding readiness requires IBL preparation pass planning.",
    });
  } else {
    for (const pass of input.iblPassPlan.passes) {
      slots.push({
        bindingKey: `standard-material:ibl:${pass.kind}`,
        resourceKey: pass.viewKey,
        kind: pass.kind === "diffuse" ? "ibl-diffuse" : "ibl-specular",
        source: "ibl",
        readiness: pass.submission === "ready" ? "available" : "deferred",
      });
    }
  }

  if (
    input.shadowViewProjection.status === "missing" ||
    input.shadowCasterDrawList.status === "missing"
  ) {
    diagnostics.push({
      code: "standardMaterialIblShadowBinding.missingShadowPlan",
      severity: "warning",
      message:
        "StandardMaterial shadow binding readiness requires shadow matrix and caster draw-list planning.",
    });
  } else {
    for (const plan of input.shadowViewProjection.plans) {
      slots.push({
        bindingKey: `standard-material:shadow:${plan.shadowId}:view-projection`,
        resourceKey: plan.viewProjectionMatrixKey,
        kind: "shadow-view-projection",
        source: "shadow",
        readiness: plan.computation === "ready" ? "available" : "deferred",
      });
      slots.push({
        bindingKey: `standard-material:shadow:${plan.shadowId}:map`,
        resourceKey: plan.passKey,
        kind: "shadow-map",
        source: "shadow",
        readiness: input.shadowCasterDrawList.ready ? "available" : "deferred",
      });
    }
  }

  if (slots.length > 0) {
    diagnostics.push({
      code: "standardMaterialIblShadowBinding.bindGroupDeferred",
      severity: "warning",
      message:
        "StandardMaterial IBL/shadow binding slots are planned, but bind group layout changes are deferred.",
    });
    diagnostics.push({
      code: "standardMaterialIblShadowBinding.shaderSamplingDeferred",
      severity: "warning",
      message:
        "StandardMaterial IBL/shadow binding slots are planned, but shader sampling is deferred.",
    });
  }

  const status = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "standardMaterialIblShadowBinding.missingIblPlan" ||
      diagnostic.code === "standardMaterialIblShadowBinding.missingShadowPlan",
  )
    ? "missing"
    : slots.some((slot) => slot.readiness === "deferred")
      ? "deferred"
      : "available";

  return {
    ready: status === "available",
    status,
    standardMaterialCount: input.standardMaterialCount,
    slotCount: slots.length,
    sections: {
      iblPassPlanning: input.iblPassPlan.status !== "missing",
      shadowPlanning:
        input.shadowViewProjection.status !== "missing" &&
        input.shadowCasterDrawList.status !== "missing",
      bindGroupLayout: false,
      shaderSampling: false,
    },
    slots,
    diagnostics,
  };
}

export function standardMaterialIblShadowBindingReadinessReportToJsonValue(
  report: StandardMaterialIblShadowBindingReadinessReport,
): StandardMaterialIblShadowBindingReadinessReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    standardMaterialCount: report.standardMaterialCount,
    slotCount: report.slotCount,
    sections: { ...report.sections },
    slots: report.slots.map((slot) => ({ ...slot })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function standardMaterialIblShadowBindingReadinessReportToJson(
  report: StandardMaterialIblShadowBindingReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialIblShadowBindingReadinessReportToJsonValue(report),
  );
}
