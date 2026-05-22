import type { LightPacket, ShadowRequestPacket } from "@aperture-engine/render";

import type {
  ShadowPassPlan,
  ShadowPassPlanReport,
} from "./shadow-pass-plan.js";

export type DirectionalShadowViewProjectionStatus =
  | "ready"
  | "deferred"
  | "unsupported"
  | "missing"
  | "not-required";

export type DirectionalShadowViewProjectionMode = "ready" | "deferred";

export type DirectionalShadowViewProjectionDiagnosticCode =
  | "directionalShadowViewProjection.missingLight"
  | "directionalShadowViewProjection.unsupportedLightKind"
  | "directionalShadowViewProjection.missingPassPlan"
  | "directionalShadowViewProjection.matrixDeferred";

export interface DirectionalShadowViewProjectionPlan {
  readonly shadowId: number;
  readonly lightId: number;
  readonly planKey: string;
  readonly passKey: string;
  readonly lightKind: "directional";
  readonly cascadeIndex?: number;
  readonly cascadeCount?: number;
  readonly cascadeNear?: number;
  readonly cascadeFar?: number;
  readonly lightTransformOffset: number;
  readonly mapSize: number;
  readonly casterLayerMask: number;
  readonly receiverLayerMask: number;
  readonly projection: "orthographic";
  readonly viewMatrixKey: string;
  readonly projectionMatrixKey: string;
  readonly viewProjectionMatrixKey: string;
  readonly computation: DirectionalShadowViewProjectionMode;
}

export interface DirectionalShadowViewProjectionDiagnostic {
  readonly code: DirectionalShadowViewProjectionDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly shadowId: number;
  readonly lightId: number;
  readonly message: string;
}

export interface DirectionalShadowViewProjectionPlanReport {
  readonly ready: boolean;
  readonly status: DirectionalShadowViewProjectionStatus;
  readonly requestCount: number;
  readonly passCount: number;
  readonly planCount: number;
  readonly sections: {
    readonly shadowRequests: boolean;
    readonly lightPackets: boolean;
    readonly passPlans: boolean;
    readonly matrixPlanning: boolean;
    readonly gpuResources: false;
  };
  readonly plans: readonly DirectionalShadowViewProjectionPlan[];
  readonly diagnostics: readonly DirectionalShadowViewProjectionDiagnostic[];
}

export type DirectionalShadowViewProjectionPlanReportJsonValue =
  DirectionalShadowViewProjectionPlanReport;

export interface DirectionalShadowViewProjectionPlanInput {
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly lights: readonly LightPacket[];
  readonly shadowPassPlan: ShadowPassPlanReport;
  readonly computation?: DirectionalShadowViewProjectionMode;
}

export function createDirectionalShadowViewProjectionPlanReport(
  input: DirectionalShadowViewProjectionPlanInput,
): DirectionalShadowViewProjectionPlanReport {
  const computation = input.computation ?? "deferred";

  if (input.shadowRequests.length === 0) {
    return {
      ready: true,
      status: "not-required",
      requestCount: 0,
      passCount: input.shadowPassPlan.passCount,
      planCount: 0,
      sections: {
        shadowRequests: true,
        lightPackets: true,
        passPlans: true,
        matrixPlanning: true,
        gpuResources: false,
      },
      plans: [],
      diagnostics: [],
    };
  }

  const diagnostics: DirectionalShadowViewProjectionDiagnostic[] = [];
  const lightsById = new Map(
    input.lights.map((light) => [light.lightId, light]),
  );
  const passesByKey = groupPassesByShadowRequest(input.shadowPassPlan.passes);
  const plans: DirectionalShadowViewProjectionPlan[] = [];

  for (const request of input.shadowRequests) {
    const light = lightsById.get(request.lightId);
    const passes = passesByKey.get(
      shadowInputKey(request.shadowId, request.lightId),
    );

    if (light === undefined) {
      diagnostics.push({
        code: "directionalShadowViewProjection.missingLight",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Shadow request '${request.shadowId}' references missing light '${request.lightId}'.`,
      });
      continue;
    }

    if (light.kind !== "directional") {
      diagnostics.push({
        code: "directionalShadowViewProjection.unsupportedLightKind",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Shadow request '${request.shadowId}' references unsupported light kind '${light.kind}'.`,
      });
      continue;
    }

    if (passes === undefined || passes.length === 0) {
      diagnostics.push({
        code: "directionalShadowViewProjection.missingPassPlan",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Shadow request '${request.shadowId}' has no matching shadow pass plan.`,
      });
      continue;
    }

    for (const pass of passes) {
      const cascadeIndex = pass.cascadeIndex ?? 0;
      const cascadeCount = pass.cascadeCount ?? 1;
      const split = cascadeSplit(cascadeIndex, cascadeCount);

      plans.push({
        shadowId: request.shadowId,
        lightId: request.lightId,
        planKey:
          cascadeCount === 1
            ? `directional-shadow-view-projection:${request.shadowId}:light:${request.lightId}`
            : `directional-shadow-view-projection:${request.shadowId}:light:${request.lightId}:cascade:${cascadeIndex}`,
        passKey: pass.passKey,
        lightKind: "directional",
        cascadeIndex,
        cascadeCount,
        cascadeNear: split.near,
        cascadeFar: split.far,
        lightTransformOffset: light.worldTransformOffset,
        mapSize: pass.width,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
        projection: "orthographic",
        viewMatrixKey: `${pass.passKey}:view`,
        projectionMatrixKey: `${pass.passKey}:projection`,
        viewProjectionMatrixKey: `${pass.passKey}:view-projection`,
        computation,
      });
    }
  }

  if (plans.length > 0 && computation === "deferred") {
    diagnostics.push({
      code: "directionalShadowViewProjection.matrixDeferred",
      severity: "warning",
      shadowId: plans[0]?.shadowId ?? 0,
      lightId: plans[0]?.lightId ?? 0,
      message:
        "Directional shadow view/projection keys are planned, but matrix computation is not implemented yet.",
    });
  }

  const hasMissing = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "directionalShadowViewProjection.missingLight" ||
      diagnostic.code === "directionalShadowViewProjection.missingPassPlan",
  );
  const hasUnsupported = diagnostics.some(
    (diagnostic) =>
      diagnostic.code ===
      "directionalShadowViewProjection.unsupportedLightKind",
  );
  const status = determineStatus({ computation, hasMissing, hasUnsupported });

  return {
    ready: status === "ready",
    status,
    requestCount: input.shadowRequests.length,
    passCount: input.shadowPassPlan.passCount,
    planCount: plans.length,
    sections: {
      shadowRequests: true,
      lightPackets: !hasMissing,
      passPlans: !hasMissing,
      matrixPlanning: status === "ready",
      gpuResources: false,
    },
    plans,
    diagnostics,
  };
}

export function directionalShadowViewProjectionPlanReportToJsonValue(
  report: DirectionalShadowViewProjectionPlanReport,
): DirectionalShadowViewProjectionPlanReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    requestCount: report.requestCount,
    passCount: report.passCount,
    planCount: report.planCount,
    sections: { ...report.sections },
    plans: report.plans.map((plan) => ({ ...plan })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function directionalShadowViewProjectionPlanReportToJson(
  report: DirectionalShadowViewProjectionPlanReport,
): string {
  return JSON.stringify(
    directionalShadowViewProjectionPlanReportToJsonValue(report),
  );
}

function determineStatus(input: {
  readonly computation: DirectionalShadowViewProjectionMode;
  readonly hasMissing: boolean;
  readonly hasUnsupported: boolean;
}): DirectionalShadowViewProjectionStatus {
  if (input.hasMissing) {
    return "missing";
  }

  if (input.hasUnsupported) {
    return "unsupported";
  }

  return input.computation;
}

function shadowInputKey(shadowId: number, lightId: number): string {
  return `${shadowId}:${lightId}`;
}

function groupPassesByShadowRequest(
  passes: readonly ShadowPassPlan[],
): Map<string, readonly ShadowPassPlan[]> {
  const grouped = new Map<string, readonly ShadowPassPlan[]>();

  for (const pass of passes) {
    const key = shadowInputKey(pass.shadowId, pass.lightId);
    const existing = grouped.get(key) ?? [];

    grouped.set(key, [...existing, pass]);
  }

  return grouped;
}

function cascadeSplit(
  cascadeIndex: number,
  cascadeCount: number,
): { readonly near: number; readonly far: number } {
  const clampedCount = Math.max(1, cascadeCount);
  const near = cascadeIndex / clampedCount;
  const far = (cascadeIndex + 1) / clampedCount;

  return { near, far };
}
