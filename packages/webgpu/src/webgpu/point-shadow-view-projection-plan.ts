import type { LightPacket, ShadowRequestPacket } from "@aperture-engine/render";

import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";

export type PointShadowViewProjectionStatus =
  | "ready"
  | "deferred"
  | "unsupported"
  | "missing"
  | "not-required";

export type PointShadowViewProjectionMode = "ready" | "deferred";

export type PointShadowViewProjectionDiagnosticCode =
  | "pointShadowViewProjection.missingLight"
  | "pointShadowViewProjection.unsupportedLightKind"
  | "pointShadowViewProjection.missingPassPlan"
  | "pointShadowViewProjection.matrixDeferred";

export interface PointShadowViewProjectionPlan {
  readonly shadowId: number;
  readonly lightId: number;
  readonly faceIndex: number;
  readonly faceLabel: "+x" | "-x" | "+y" | "-y" | "+z" | "-z";
  readonly planKey: string;
  readonly passKey: string;
  readonly lightKind: "point";
  readonly lightTransformOffset: number;
  readonly mapSize: number;
  readonly casterLayerMask: number;
  readonly receiverLayerMask: number;
  readonly projection: "perspective-cube-face";
  readonly fovYRadians: number;
  readonly near: number;
  readonly far: number;
  readonly viewMatrixKey: string;
  readonly projectionMatrixKey: string;
  readonly viewProjectionMatrixKey: string;
  readonly computation: PointShadowViewProjectionMode;
}

export interface PointShadowViewProjectionDiagnostic {
  readonly code: PointShadowViewProjectionDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly shadowId: number;
  readonly lightId: number;
  readonly message: string;
}

export interface PointShadowViewProjectionPlanReport {
  readonly ready: boolean;
  readonly status: PointShadowViewProjectionStatus;
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
  readonly plans: readonly PointShadowViewProjectionPlan[];
  readonly diagnostics: readonly PointShadowViewProjectionDiagnostic[];
}

export type PointShadowViewProjectionPlanReportJsonValue =
  PointShadowViewProjectionPlanReport;

export interface PointShadowViewProjectionPlanInput {
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly lights: readonly LightPacket[];
  readonly shadowPassPlan: ShadowPassPlanReport;
  readonly computation?: PointShadowViewProjectionMode;
  readonly near?: number;
}

const FACE_LABELS = ["+x", "-x", "+y", "-y", "+z", "-z"] as const;

export function createPointShadowViewProjectionPlanReport(
  input: PointShadowViewProjectionPlanInput,
): PointShadowViewProjectionPlanReport {
  const computation = input.computation ?? "deferred";
  const pointRequests = input.shadowRequests.filter(
    (request) => request.lightKind === "point",
  );

  if (pointRequests.length === 0) {
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

  const diagnostics: PointShadowViewProjectionDiagnostic[] = [];
  const lightsById = new Map(
    input.lights.map((light) => [light.lightId, light]),
  );
  const passesByKey = new Map(
    input.shadowPassPlan.passes.map((pass) => [
      `${pass.shadowId}:${pass.lightId}:${pass.faceIndex}`,
      pass,
    ]),
  );
  const plans: PointShadowViewProjectionPlan[] = [];

  for (const request of pointRequests) {
    const light = lightsById.get(request.lightId);

    if (light === undefined) {
      diagnostics.push({
        code: "pointShadowViewProjection.missingLight",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Point shadow request '${request.shadowId}' references missing light '${request.lightId}'.`,
      });
      continue;
    }

    if (light.kind !== "point") {
      diagnostics.push({
        code: "pointShadowViewProjection.unsupportedLightKind",
        severity: "warning",
        shadowId: request.shadowId,
        lightId: request.lightId,
        message: `Point shadow request '${request.shadowId}' references unsupported light kind '${light.kind}'.`,
      });
      continue;
    }

    for (let faceIndex = 0; faceIndex < FACE_LABELS.length; faceIndex += 1) {
      const pass = passesByKey.get(
        `${request.shadowId}:${request.lightId}:${faceIndex}`,
      );

      if (pass === undefined) {
        diagnostics.push({
          code: "pointShadowViewProjection.missingPassPlan",
          severity: "warning",
          shadowId: request.shadowId,
          lightId: request.lightId,
          message: `Point shadow request '${request.shadowId}' has no pass plan for face ${faceIndex}.`,
        });
        continue;
      }

      plans.push({
        shadowId: request.shadowId,
        lightId: request.lightId,
        faceIndex,
        faceLabel: FACE_LABELS[faceIndex] ?? "+x",
        planKey: `point-shadow-view-projection:${request.shadowId}:light:${request.lightId}:face:${faceIndex}`,
        passKey: pass.passKey,
        lightKind: "point",
        lightTransformOffset: light.worldTransformOffset,
        mapSize: pass.width,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
        projection: "perspective-cube-face",
        fovYRadians: Math.PI / 2,
        near: input.near ?? Math.max(light.range / 1000, 0.01),
        far: light.range,
        viewMatrixKey: `${pass.passKey}:view`,
        projectionMatrixKey: `${pass.passKey}:projection`,
        viewProjectionMatrixKey: `${pass.passKey}:view-projection`,
        computation,
      });
    }
  }

  if (plans.length > 0 && computation === "deferred") {
    diagnostics.push({
      code: "pointShadowViewProjection.matrixDeferred",
      severity: "warning",
      shadowId: plans[0]?.shadowId ?? 0,
      lightId: plans[0]?.lightId ?? 0,
      message:
        "Point shadow cube-face view/projection keys are planned, but matrix computation is not implemented yet.",
    });
  }

  const hasMissing = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "pointShadowViewProjection.missingLight" ||
      diagnostic.code === "pointShadowViewProjection.missingPassPlan",
  );
  const hasUnsupported = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "pointShadowViewProjection.unsupportedLightKind",
  );
  const status = determineStatus({ computation, hasMissing, hasUnsupported });

  return {
    ready: status === "ready",
    status,
    requestCount: pointRequests.length,
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

export function pointShadowViewProjectionPlanReportToJsonValue(
  report: PointShadowViewProjectionPlanReport,
): PointShadowViewProjectionPlanReportJsonValue {
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

export function pointShadowViewProjectionPlanReportToJson(
  report: PointShadowViewProjectionPlanReport,
): string {
  return JSON.stringify(pointShadowViewProjectionPlanReportToJsonValue(report));
}

function determineStatus(input: {
  readonly computation: PointShadowViewProjectionMode;
  readonly hasMissing: boolean;
  readonly hasUnsupported: boolean;
}): PointShadowViewProjectionStatus {
  if (input.hasMissing) {
    return "missing";
  }

  if (input.hasUnsupported) {
    return "unsupported";
  }

  return input.computation;
}
