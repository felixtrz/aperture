import {
  makePerspective,
  multiplyMat4,
  toVec3Tuple,
  vec3Dot,
  type Mat4Like,
} from "@aperture-engine/simulation";

import type {
  SpotShadowViewProjectionPlan,
  SpotShadowViewProjectionPlanReport,
} from "./spot-shadow-view-projection-plan.js";

export type SpotShadowMatrixComputationStatus =
  | "ready"
  | "missing"
  | "unsupported"
  | "not-required";

export type SpotShadowMatrixComputationDiagnosticCode =
  | "spotShadowMatrix.missingViewProjectionPlan"
  | "spotShadowMatrix.unsupportedViewProjectionPlan"
  | "spotShadowMatrix.missingLightTransform"
  | "spotShadowMatrix.invalidLightDirection";

export interface SpotShadowMatrixComputationDiagnostic {
  readonly code: SpotShadowMatrixComputationDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly shadowId?: number;
  readonly lightId?: number;
  readonly message: string;
}

export interface SpotShadowMatrixComputation {
  readonly shadowId: number;
  readonly lightId: number;
  readonly planKey: string;
  readonly passKey: string;
  readonly matrixKey: string;
  readonly lightTransformOffset: number;
  readonly lightPosition: readonly [number, number, number];
  readonly lightDirection: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly fovYRadians: number;
  readonly near: number;
  readonly far: number;
  readonly viewMatrix: readonly number[];
  readonly projectionMatrix: readonly number[];
  readonly viewProjectionMatrix: readonly number[];
}

export interface SpotShadowMatrixComputationReport {
  readonly ready: boolean;
  readonly status: SpotShadowMatrixComputationStatus;
  readonly planCount: number;
  readonly matrixCount: number;
  readonly sections: {
    readonly viewProjectionPlanning: boolean;
    readonly transformData: boolean;
    readonly matrixComputation: boolean;
    readonly gpuBufferAllocation: false;
    readonly upload: false;
    readonly passSubmission: false;
  };
  readonly matrices: readonly SpotShadowMatrixComputation[];
  readonly diagnostics: readonly SpotShadowMatrixComputationDiagnostic[];
}

export type SpotShadowMatrixComputationReportJsonValue =
  SpotShadowMatrixComputationReport;

export interface SpotShadowMatrixComputationInput {
  readonly viewProjection: SpotShadowViewProjectionPlanReport;
  readonly transforms: Float32Array;
}

const EPSILON = 1e-6;

export function createSpotShadowMatrixComputationReport(
  input: SpotShadowMatrixComputationInput,
): SpotShadowMatrixComputationReport {
  if (input.viewProjection.status === "not-required") {
    return {
      ready: true,
      status: "not-required",
      planCount: 0,
      matrixCount: 0,
      sections: {
        viewProjectionPlanning: true,
        transformData: true,
        matrixComputation: true,
        gpuBufferAllocation: false,
        upload: false,
        passSubmission: false,
      },
      matrices: [],
      diagnostics: [],
    };
  }

  const diagnostics: SpotShadowMatrixComputationDiagnostic[] = [];

  if (input.viewProjection.status === "missing") {
    diagnostics.push({
      code: "spotShadowMatrix.missingViewProjectionPlan",
      severity: "warning",
      message:
        "Spot shadow matrix computation requires view/projection planning.",
    });
  }

  if (input.viewProjection.status === "unsupported") {
    diagnostics.push({
      code: "spotShadowMatrix.unsupportedViewProjectionPlan",
      severity: "warning",
      message:
        "Spot shadow matrix computation only supports spot shadow plans.",
    });
  }

  const matrices: SpotShadowMatrixComputation[] = [];

  if (diagnostics.length === 0) {
    for (const plan of input.viewProjection.plans) {
      const computed = computeSpotShadowMatrix(input, plan);

      if ("diagnostic" in computed) {
        diagnostics.push(computed.diagnostic);
      } else {
        matrices.push(computed.matrix);
      }
    }
  }

  const status = determineStatus({
    viewProjectionStatus: input.viewProjection.status,
    matrixCount: matrices.length,
    diagnostics,
  });

  return {
    ready: status === "ready" || status === "not-required",
    status,
    planCount: input.viewProjection.planCount,
    matrixCount: matrices.length,
    sections: {
      viewProjectionPlanning:
        input.viewProjection.status !== "missing" &&
        input.viewProjection.status !== "unsupported",
      transformData: !diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "spotShadowMatrix.missingLightTransform",
      ),
      matrixComputation: status === "ready",
      gpuBufferAllocation: false,
      upload: false,
      passSubmission: false,
    },
    matrices,
    diagnostics,
  };
}

export function spotShadowMatrixComputationReportToJsonValue(
  report: SpotShadowMatrixComputationReport,
): SpotShadowMatrixComputationReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    planCount: report.planCount,
    matrixCount: report.matrixCount,
    sections: { ...report.sections },
    matrices: report.matrices.map((matrix) => ({
      ...matrix,
      lightPosition: sanitizeTuple3(matrix.lightPosition),
      lightDirection: sanitizeTuple3(matrix.lightDirection),
      target: sanitizeTuple3(matrix.target),
      up: sanitizeTuple3(matrix.up),
      viewMatrix: matrix.viewMatrix.map(sanitizeNumber),
      projectionMatrix: matrix.projectionMatrix.map(sanitizeNumber),
      viewProjectionMatrix: matrix.viewProjectionMatrix.map(sanitizeNumber),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function spotShadowMatrixComputationReportToJson(
  report: SpotShadowMatrixComputationReport,
): string {
  return JSON.stringify(spotShadowMatrixComputationReportToJsonValue(report));
}

function computeSpotShadowMatrix(
  input: SpotShadowMatrixComputationInput,
  plan: SpotShadowViewProjectionPlan,
):
  | { readonly matrix: SpotShadowMatrixComputation }
  | { readonly diagnostic: SpotShadowMatrixComputationDiagnostic } {
  if (!hasMatrix(input.transforms, plan.lightTransformOffset)) {
    return {
      diagnostic: {
        code: "spotShadowMatrix.missingLightTransform",
        severity: "warning",
        shadowId: plan.shadowId,
        lightId: plan.lightId,
        message: `Spot shadow plan '${plan.planKey}' references missing light transform offset ${plan.lightTransformOffset}.`,
      },
    };
  }

  const transform = input.transforms.subarray(
    plan.lightTransformOffset,
    plan.lightTransformOffset + 16,
  );
  const lightPosition = toVec3Tuple([
    transform[12] ?? 0,
    transform[13] ?? 0,
    transform[14] ?? 0,
  ]);
  const lightDirection = normalize([
    -(transform[8] ?? 0),
    -(transform[9] ?? 0),
    -(transform[10] ?? 0),
  ]);

  if (lightDirection === null) {
    return {
      diagnostic: {
        code: "spotShadowMatrix.invalidLightDirection",
        severity: "warning",
        shadowId: plan.shadowId,
        lightId: plan.lightId,
        message: `Spot shadow plan '${plan.planKey}' has a zero-length light direction.`,
      },
    };
  }

  const target = toVec3Tuple([
    lightPosition[0] + lightDirection[0],
    lightPosition[1] + lightDirection[1],
    lightPosition[2] + lightDirection[2],
  ]);
  const up = toVec3Tuple([
    transform[4] ?? 0,
    transform[5] ?? 1,
    transform[6] ?? 0,
  ]);
  const viewMatrix = makeLookAt(lightPosition, target, up);
  const projectionMatrix = makePerspective(
    plan.fovYRadians,
    1,
    plan.near,
    plan.far,
  );
  const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);

  return {
    matrix: {
      shadowId: plan.shadowId,
      lightId: plan.lightId,
      planKey: plan.planKey,
      passKey: plan.passKey,
      matrixKey: plan.viewProjectionMatrixKey,
      lightTransformOffset: plan.lightTransformOffset,
      lightPosition,
      lightDirection,
      target,
      up,
      fovYRadians: plan.fovYRadians,
      near: plan.near,
      far: plan.far,
      viewMatrix: Array.from(viewMatrix),
      projectionMatrix: Array.from(projectionMatrix),
      viewProjectionMatrix: Array.from(viewProjectionMatrix),
    },
  };
}

function determineStatus(input: {
  readonly viewProjectionStatus: SpotShadowViewProjectionPlanReport["status"];
  readonly matrixCount: number;
  readonly diagnostics: readonly SpotShadowMatrixComputationDiagnostic[];
}): SpotShadowMatrixComputationStatus {
  if (input.viewProjectionStatus === "unsupported") {
    return "unsupported";
  }

  if (
    input.viewProjectionStatus === "missing" ||
    input.matrixCount === 0 ||
    input.diagnostics.length > 0
  ) {
    return "missing";
  }

  return "ready";
}

function makeLookAt(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
  up: readonly [number, number, number],
): Mat4Like {
  const zAxis = normalize([
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ]);
  const xAxis =
    zAxis === null ? null : normalize(cross(toVec3Tuple(up), zAxis));
  const yAxis = xAxis === null || zAxis === null ? null : cross(zAxis, xAxis);

  if (xAxis === null || yAxis === null || zAxis === null) {
    return makeLookAt(eye, target, [0, 0, 1]);
  }

  return [
    xAxis[0],
    yAxis[0],
    zAxis[0],
    0,
    xAxis[1],
    yAxis[1],
    zAxis[1],
    0,
    xAxis[2],
    yAxis[2],
    zAxis[2],
    0,
    -vec3Dot(xAxis, eye),
    -vec3Dot(yAxis, eye),
    -vec3Dot(zAxis, eye),
    1,
  ];
}

function hasMatrix(transforms: Float32Array, offset: number): boolean {
  return (
    Number.isInteger(offset) && offset >= 0 && offset + 16 <= transforms.length
  );
}

function normalize(
  value: readonly [number, number, number],
): readonly [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= EPSILON) {
    return null;
  }

  return toVec3Tuple([value[0] / length, value[1] / length, value[2] / length]);
}

function sanitizeTuple3(
  value: readonly [number, number, number],
): [number, number, number] {
  return [
    sanitizeNumber(value[0]),
    sanitizeNumber(value[1]),
    sanitizeNumber(value[2]),
  ];
}

function sanitizeNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
