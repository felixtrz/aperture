import type { LightPacket, ShadowRequestPacket } from "@aperture-engine/render";

import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";

export type SpotShadowViewProjectionStatus =
  | "ready"
  | "deferred"
  | "unsupported"
  | "missing"
  | "not-required";

export type SpotShadowViewProjectionMode = "ready" | "deferred";

export type SpotShadowViewProjectionDiagnosticCode =
  | "spotShadowViewProjection.missingLight"
  | "spotShadowViewProjection.unsupportedLightKind"
  | "spotShadowViewProjection.missingPassPlan"
  | "spotShadowViewProjection.matrixDeferred";

export interface SpotShadowViewProjectionPlan {
  readonly shadowId: number;
  readonly lightId: number;
  readonly planKey: string;
  readonly passKey: string;
  readonly lightKind: "spot";
  readonly lightTransformOffset: number;
  readonly mapSize: number;
  readonly casterLayerMask: number;
  readonly receiverLayerMask: number;
  readonly projection: "perspective-spot";
  readonly fovYRadians: number;
  readonly near: number;
  readonly far: number;
  readonly viewMatrixKey: string;
  readonly projectionMatrixKey: string;
  readonly viewProjectionMatrixKey: string;
  readonly computation: SpotShadowViewProjectionMode;
}

export interface SpotShadowViewProjectionDiagnostic {
  readonly code: SpotShadowViewProjectionDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly shadowId: number;
  readonly lightId: number;
  readonly message: string;
}

export interface SpotShadowViewProjectionPlanReport {
  readonly ready: boolean;
  readonly status: SpotShadowViewProjectionStatus;
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
  readonly plans: readonly SpotShadowViewProjectionPlan[];
  readonly diagnostics: readonly SpotShadowViewProjectionDiagnostic[];
}

export type SpotShadowViewProjectionPlanReportJsonValue =
  SpotShadowViewProjectionPlanReport;

export interface SpotShadowViewProjectionPlanInput {
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly lights: readonly LightPacket[];
  readonly shadowPassPlan: ShadowPassPlanReport;
  readonly computation?: SpotShadowViewProjectionMode;
  readonly near?: number;
}

export function createSpotShadowViewProjectionPlanReport(
  input: SpotShadowViewProjectionPlanInput,
): SpotShadowViewProjectionPlanReport {
  const computation = input.computation ?? "deferred";
  const spotRequests = input.shadowRequests.filter(
    (request) => request.lightKind === "spot",
  );

  if (spotRequests.length === 0) {
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

  const diagnostics: SpotShadowViewProjectionDiagnostic[] = [];
  const lightsById = new Map(
    input.lights.map((light) => [light.lightId, light]),
  );
  const passesByKey = new Map(
    input.shadowPassPlan.passes.map((pass) => [
      `${pass.shadowId}:${pass.lightId}`,
      pass,
    ]),
  );
  const plans: SpotShadowViewProjectionPlan[] = [];

  for (const request of spotRequests) {
    const light = lightsById.get(request.lightId);
    const pass = passesByKey.get(`${request.shadowId}:${request.lightId}`);

    if (light === undefined) {
      diagnostics.push({
        code: "spotShadowViewProjection.missingLight",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Spot shadow request '${request.shadowId}' references missing light '${request.lightId}'.`,
      });
      continue;
    }

    if (light.kind !== "spot") {
      diagnostics.push({
        code: "spotShadowViewProjection.unsupportedLightKind",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Spot shadow request '${request.shadowId}' references unsupported light kind '${light.kind}'.`,
      });
      continue;
    }

    if (pass === undefined) {
      diagnostics.push({
        code: "spotShadowViewProjection.missingPassPlan",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Spot shadow request '${request.shadowId}' has no matching shadow pass plan.`,
      });
      continue;
    }

    plans.push({
      shadowId: request.shadowId,
      lightId: request.lightId,
      planKey: `spot-shadow-view-projection:${request.shadowId}:light:${request.lightId}`,
      passKey: pass.passKey,
      lightKind: "spot",
      lightTransformOffset: light.worldTransformOffset,
      mapSize: pass.width,
      casterLayerMask: request.casterLayerMask,
      receiverLayerMask: request.receiverLayerMask,
      projection: "perspective-spot",
      fovYRadians: Math.max(light.outerConeAngle * 2, 0.01),
      near: input.near ?? Math.max(light.range / 1000, 0.01),
      far: light.range,
      viewMatrixKey: `${pass.passKey}:view`,
      projectionMatrixKey: `${pass.passKey}:projection`,
      viewProjectionMatrixKey: `${pass.passKey}:view-projection`,
      computation,
    });
  }

  if (plans.length > 0 && computation === "deferred") {
    diagnostics.push({
      code: "spotShadowViewProjection.matrixDeferred",
      severity: "warning",
      shadowId: plans[0]?.shadowId ?? 0,
      lightId: plans[0]?.lightId ?? 0,
      message:
        "Spot shadow view/projection keys are planned, but matrix computation is not implemented yet.",
    });
  }

  const hasMissing = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "spotShadowViewProjection.missingLight" ||
      diagnostic.code === "spotShadowViewProjection.missingPassPlan",
  );
  const hasUnsupported = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "spotShadowViewProjection.unsupportedLightKind",
  );
  const status = determineStatus({ computation, hasMissing, hasUnsupported });

  return {
    ready: status === "ready",
    status,
    requestCount: spotRequests.length,
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

export function spotShadowViewProjectionPlanReportToJsonValue(
  report: SpotShadowViewProjectionPlanReport,
): SpotShadowViewProjectionPlanReportJsonValue {
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

export function spotShadowViewProjectionPlanReportToJson(
  report: SpotShadowViewProjectionPlanReport,
): string {
  return JSON.stringify(spotShadowViewProjectionPlanReportToJsonValue(report));
}

function determineStatus(input: {
  readonly computation: SpotShadowViewProjectionMode;
  readonly hasMissing: boolean;
  readonly hasUnsupported: boolean;
}): SpotShadowViewProjectionStatus {
  if (input.hasMissing) {
    return "missing";
  }

  if (input.hasUnsupported) {
    return "unsupported";
  }

  return input.computation;
}
