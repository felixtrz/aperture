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
  /**
   * Absolute world-space near distance of this cascade's camera-frustum slice.
   * Emitted alongside the normalized {@link cascadeNear} fraction so the matrix
   * fit (M4-T1) can build the frustum slice and so the matrix-side splits agree
   * with the shader-side selection bounds (light-packing directionalCascadeFarBounds).
   */
  readonly cascadeNearDistance?: number;
  /** Absolute world-space far distance of this cascade's camera-frustum slice. */
  readonly cascadeFarDistance?: number;
  readonly lightTransformOffset: number;
  readonly mapSize: number;
  readonly casterLayerMask: number;
  readonly receiverLayerMask: number;
  readonly center?: readonly [number, number, number];
  readonly orthographicSize?: number;
  readonly near?: number;
  readonly far?: number;
  readonly lightDistance?: number;
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
  /**
   * Camera near plane distance feeding the practical cascade-split scheme. When
   * omitted the nearest cascade bound falls back to the same minimum the
   * light-packing far-bounds use, preserving prior behavior.
   */
  readonly cameraNear?: number;
  /** Camera far plane distance; defaults to the per-light shadow max distance. */
  readonly cameraFar?: number;
  /**
   * Shadow max distance for the cascade split. Defaults per-light to
   * {@link LightPacket.range} so the matrix-side splits use the SAME source as
   * the shader-side selection bounds (light-packing directionalCascadeFarBounds).
   */
  readonly shadowMaxDistance?: number;
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

    const shadowMaxDistance = input.shadowMaxDistance ?? light.range;

    for (const pass of passes) {
      const cascadeIndex = pass.cascadeIndex ?? 0;
      const cascadeCount = pass.cascadeCount ?? 1;
      const split = cascadeSplit(cascadeIndex, cascadeCount, {
        cameraNear: input.cameraNear,
        cameraFar: input.cameraFar,
        shadowMaxDistance,
      });

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
        cascadeNearDistance: split.nearDistance,
        cascadeFarDistance: split.farDistance,
        lightTransformOffset: light.worldTransformOffset,
        mapSize: pass.width,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
        ...(request.center === undefined
          ? {}
          : { center: tuple3(request.center) }),
        ...(request.orthographicSize === undefined
          ? {}
          : { orthographicSize: request.orthographicSize }),
        ...(request.near === undefined ? {} : { near: request.near }),
        ...(request.far === undefined ? {} : { far: request.far }),
        ...(request.lightDistance === undefined
          ? {}
          : { lightDistance: request.lightDistance }),
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

function tuple3(
  value: readonly [number, number, number] | readonly number[],
): readonly [number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
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

interface CascadeSplitOptions {
  readonly cameraNear?: number | undefined;
  readonly cameraFar?: number | undefined;
  readonly shadowMaxDistance?: number | undefined;
}

interface CascadeSplitResult {
  /** Normalized near fraction (back-compat with the prior linear scheme). */
  readonly near: number;
  /** Normalized far fraction (back-compat with the prior linear scheme). */
  readonly far: number;
  /** Absolute world-space near distance of the cascade slice. */
  readonly nearDistance: number;
  /** Absolute world-space far distance of the cascade slice. */
  readonly farDistance: number;
}

function cascadeSplit(
  cascadeIndex: number,
  cascadeCount: number,
  options: CascadeSplitOptions = {},
): CascadeSplitResult {
  const clampedCount = Math.max(1, cascadeCount);
  // Back-compat normalized fractions (still consumed by the matrix computation
  // until M4-T1 switches to the absolute distances below).
  const near = cascadeIndex / clampedCount;
  const far = (cascadeIndex + 1) / clampedCount;

  const bounds = practicalCascadeBounds(clampedCount, options);
  const clampedIndex = Math.min(Math.max(cascadeIndex, 0), clampedCount - 1);

  return {
    near,
    far,
    nearDistance: bounds[clampedIndex]?.near ?? 0,
    farDistance: bounds[clampedIndex]?.far ?? 0,
  };
}

/**
 * Practical (linear/logarithmic blended) cascade split distances. Uses the same
 * minimum/maximum and per-cascade blend formula as light-packing
 * `directionalCascadeFarBounds`, so the cascade the shader SELECTS matches the
 * cascade the matrix was FIT for. Adapted from bevy `calculate_cascade_bounds`
 * (references/bevy/crates/bevy_light/src/cascade.rs lines 41-56) which uses a
 * pure exponential split; we keep the existing linear/log average to stay
 * byte-compatible with the already-shipped selection bounds.
 */
function practicalCascadeBounds(
  cascadeCount: number,
  options: CascadeSplitOptions,
): readonly { readonly near: number; readonly far: number }[] {
  const maximumDistance = Math.max(
    1,
    options.shadowMaxDistance ?? options.cameraFar ?? 0,
  );
  const minimumDistance = Math.min(0.1, maximumDistance * 0.5);
  const cameraNear = options.cameraNear ?? minimumDistance;

  const result: { near: number; far: number }[] = [];
  let previousFar = cameraNear;

  for (let index = 0; index < cascadeCount; index += 1) {
    const fraction = (index + 1) / cascadeCount;
    const linear =
      minimumDistance + (maximumDistance - minimumDistance) * fraction;
    const logarithmic =
      minimumDistance * Math.pow(maximumDistance / minimumDistance, fraction);
    const far =
      index + 1 === cascadeCount
        ? maximumDistance
        : (linear + logarithmic) * 0.5;

    result.push({ near: previousFar, far });
    previousFar = far;
  }

  return result;
}
