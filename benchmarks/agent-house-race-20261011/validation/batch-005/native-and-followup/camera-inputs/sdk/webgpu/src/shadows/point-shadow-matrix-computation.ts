import {
  makePerspective,
  multiplyMat4,
  toVec3Tuple,
  vec3Dot,
  type Mat4Like,
} from "@aperture-engine/simulation";

import type {
  PointShadowViewProjectionPlan,
  PointShadowViewProjectionPlanReport,
} from "./point-shadow-view-projection-plan.js";

export type PointShadowMatrixComputationStatus =
  | "ready"
  | "missing"
  | "unsupported"
  | "not-required";

export type PointShadowMatrixComputationDiagnosticCode =
  | "pointShadowMatrix.missingViewProjectionPlan"
  | "pointShadowMatrix.unsupportedViewProjectionPlan"
  | "pointShadowMatrix.missingLightTransform"
  | "pointShadowMatrix.invalidFace";

export interface PointShadowMatrixComputationDiagnostic {
  readonly code: PointShadowMatrixComputationDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly shadowId?: number;
  readonly lightId?: number;
  readonly message: string;
}

export interface PointShadowMatrixComputation {
  readonly shadowId: number;
  readonly lightId: number;
  readonly faceIndex: number;
  readonly faceLabel: PointShadowViewProjectionPlan["faceLabel"];
  readonly planKey: string;
  readonly passKey: string;
  readonly matrixKey: string;
  readonly lightTransformOffset: number;
  readonly lightPosition: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly fovYRadians: number;
  readonly near: number;
  readonly far: number;
  readonly viewMatrix: readonly number[];
  readonly projectionMatrix: readonly number[];
  readonly viewProjectionMatrix: readonly number[];
}

export interface PointShadowMatrixComputationReport {
  readonly ready: boolean;
  readonly status: PointShadowMatrixComputationStatus;
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
  readonly matrices: readonly PointShadowMatrixComputation[];
  readonly diagnostics: readonly PointShadowMatrixComputationDiagnostic[];
}

export type PointShadowMatrixComputationReportJsonValue =
  PointShadowMatrixComputationReport;

export interface PointShadowMatrixComputationInput {
  readonly viewProjection: PointShadowViewProjectionPlanReport;
  readonly transforms: Float32Array;
}

const EPSILON = 1e-6;
const FACE_TARGETS = [
  { target: [1, 0, 0], up: [0, -1, 0] },
  { target: [-1, 0, 0], up: [0, -1, 0] },
  { target: [0, 1, 0], up: [0, 0, 1] },
  { target: [0, -1, 0], up: [0, 0, -1] },
  { target: [0, 0, 1], up: [0, -1, 0] },
  { target: [0, 0, -1], up: [0, -1, 0] },
] as const;

export function createPointShadowMatrixComputationReport(
  input: PointShadowMatrixComputationInput,
): PointShadowMatrixComputationReport {
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

  const diagnostics: PointShadowMatrixComputationDiagnostic[] = [];

  if (input.viewProjection.status === "missing") {
    diagnostics.push({
      code: "pointShadowMatrix.missingViewProjectionPlan",
      severity: "warning",
      message:
        "Point shadow matrix computation requires cube-face view/projection planning.",
    });
  }

  if (input.viewProjection.status === "unsupported") {
    diagnostics.push({
      code: "pointShadowMatrix.unsupportedViewProjectionPlan",
      severity: "warning",
      message:
        "Point shadow matrix computation only supports point shadow plans.",
    });
  }

  const matrices: PointShadowMatrixComputation[] = [];

  if (diagnostics.length === 0) {
    for (const plan of input.viewProjection.plans) {
      const computed = computePointShadowMatrix(input, plan);

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
          diagnostic.code === "pointShadowMatrix.missingLightTransform",
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

export function pointShadowMatrixComputationReportToJsonValue(
  report: PointShadowMatrixComputationReport,
): PointShadowMatrixComputationReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    planCount: report.planCount,
    matrixCount: report.matrixCount,
    sections: { ...report.sections },
    matrices: report.matrices.map((matrix) => ({
      ...matrix,
      lightPosition: sanitizeTuple3(matrix.lightPosition),
      target: sanitizeTuple3(matrix.target),
      up: sanitizeTuple3(matrix.up),
      viewMatrix: matrix.viewMatrix.map(sanitizeNumber),
      projectionMatrix: matrix.projectionMatrix.map(sanitizeNumber),
      viewProjectionMatrix: matrix.viewProjectionMatrix.map(sanitizeNumber),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function pointShadowMatrixComputationReportToJson(
  report: PointShadowMatrixComputationReport,
): string {
  return JSON.stringify(pointShadowMatrixComputationReportToJsonValue(report));
}

function computePointShadowMatrix(
  input: PointShadowMatrixComputationInput,
  plan: PointShadowViewProjectionPlan,
):
  | { readonly matrix: PointShadowMatrixComputation }
  | { readonly diagnostic: PointShadowMatrixComputationDiagnostic } {
  if (!hasMatrix(input.transforms, plan.lightTransformOffset)) {
    return {
      diagnostic: {
        code: "pointShadowMatrix.missingLightTransform",
        severity: "warning",
        shadowId: plan.shadowId,
        lightId: plan.lightId,
        message: `Point shadow plan '${plan.planKey}' references missing light transform offset ${plan.lightTransformOffset}.`,
      },
    };
  }

  const face = FACE_TARGETS[plan.faceIndex];

  if (face === undefined) {
    return {
      diagnostic: {
        code: "pointShadowMatrix.invalidFace",
        severity: "warning",
        shadowId: plan.shadowId,
        lightId: plan.lightId,
        message: `Point shadow plan '${plan.planKey}' has invalid cube face '${plan.faceIndex}'.`,
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
  const target = toVec3Tuple([
    lightPosition[0] + face.target[0],
    lightPosition[1] + face.target[1],
    lightPosition[2] + face.target[2],
  ]);
  const up = toVec3Tuple(face.up);
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
      faceIndex: plan.faceIndex,
      faceLabel: plan.faceLabel,
      planKey: plan.planKey,
      passKey: plan.passKey,
      matrixKey: plan.viewProjectionMatrixKey,
      lightTransformOffset: plan.lightTransformOffset,
      lightPosition,
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
  readonly viewProjectionStatus: PointShadowViewProjectionPlanReport["status"];
  readonly matrixCount: number;
  readonly diagnostics: readonly PointShadowMatrixComputationDiagnostic[];
}): PointShadowMatrixComputationStatus {
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
