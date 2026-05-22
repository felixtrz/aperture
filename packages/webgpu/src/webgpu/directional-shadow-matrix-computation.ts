import {
  makeOrthographic,
  multiplyMat4,
  type Mat4Like,
  type Vec3Like,
} from "@aperture-engine/simulation";

import type {
  DirectionalShadowViewProjectionPlan,
  DirectionalShadowViewProjectionPlanReport,
} from "./directional-shadow-view-projection-plan.js";

export type DirectionalShadowMatrixComputationStatus =
  | "ready"
  | "missing"
  | "unsupported"
  | "not-required";

export type DirectionalShadowMatrixComputationDiagnosticCode =
  | "directionalShadowMatrix.missingViewProjectionPlan"
  | "directionalShadowMatrix.unsupportedViewProjectionPlan"
  | "directionalShadowMatrix.missingLightTransform"
  | "directionalShadowMatrix.invalidLightDirection";

export interface DirectionalShadowMatrixComputationDiagnostic {
  readonly code: DirectionalShadowMatrixComputationDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly shadowId?: number;
  readonly lightId?: number;
  readonly message: string;
}

export interface DirectionalShadowMatrixComputation {
  readonly shadowId: number;
  readonly lightId: number;
  readonly planKey: string;
  readonly passKey: string;
  readonly matrixKey: string;
  readonly lightTransformOffset: number;
  readonly cascadeIndex?: number;
  readonly cascadeCount?: number;
  readonly cascadeNear?: number;
  readonly cascadeFar?: number;
  readonly center: readonly [number, number, number];
  readonly lightDirection: readonly [number, number, number];
  readonly lightPosition: readonly [number, number, number];
  readonly orthographicSize: number;
  readonly near: number;
  readonly far: number;
  readonly viewMatrix: readonly number[];
  readonly projectionMatrix: readonly number[];
  readonly viewProjectionMatrix: readonly number[];
}

export interface DirectionalShadowMatrixComputationReport {
  readonly ready: boolean;
  readonly status: DirectionalShadowMatrixComputationStatus;
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
  readonly matrices: readonly DirectionalShadowMatrixComputation[];
  readonly diagnostics: readonly DirectionalShadowMatrixComputationDiagnostic[];
}

export type DirectionalShadowMatrixComputationReportJsonValue =
  DirectionalShadowMatrixComputationReport;

export interface DirectionalShadowMatrixComputationInput {
  readonly viewProjection: DirectionalShadowViewProjectionPlanReport;
  readonly transforms: Float32Array;
  readonly center?: Vec3Like;
  readonly orthographicSize?: number;
  readonly near?: number;
  readonly far?: number;
  readonly lightDistance?: number;
}

const DEFAULT_CENTER = [0, 0, 0] as const;
const DEFAULT_ORTHOGRAPHIC_SIZE = 20;
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100;
const DEFAULT_LIGHT_DISTANCE = 50;
const EPSILON = 1e-6;

export function createDirectionalShadowMatrixComputationReport(
  input: DirectionalShadowMatrixComputationInput,
): DirectionalShadowMatrixComputationReport {
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

  const diagnostics: DirectionalShadowMatrixComputationDiagnostic[] = [];

  if (input.viewProjection.status === "missing") {
    diagnostics.push({
      code: "directionalShadowMatrix.missingViewProjectionPlan",
      severity: "warning",
      message:
        "Directional shadow matrix computation requires view/projection planning.",
    });
  }

  if (input.viewProjection.status === "unsupported") {
    diagnostics.push({
      code: "directionalShadowMatrix.unsupportedViewProjectionPlan",
      severity: "warning",
      message:
        "Directional shadow matrix computation only supports directional shadow plans.",
    });
  }

  const matrices: DirectionalShadowMatrixComputation[] = [];

  if (diagnostics.length === 0) {
    for (const plan of input.viewProjection.plans) {
      const computed = computeDirectionalShadowMatrix(input, plan);

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
          diagnostic.code === "directionalShadowMatrix.missingLightTransform",
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

export function directionalShadowMatrixComputationReportToJsonValue(
  report: DirectionalShadowMatrixComputationReport,
): DirectionalShadowMatrixComputationReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    planCount: report.planCount,
    matrixCount: report.matrixCount,
    sections: { ...report.sections },
    matrices: report.matrices.map((matrix) => ({
      ...matrix,
      cascadeIndex: matrix.cascadeIndex ?? 0,
      cascadeCount: matrix.cascadeCount ?? 1,
      cascadeNear: sanitizeNumber(matrix.cascadeNear ?? 0),
      cascadeFar: sanitizeNumber(matrix.cascadeFar ?? 1),
      center: sanitizeTuple3(matrix.center),
      lightDirection: sanitizeTuple3(matrix.lightDirection),
      lightPosition: sanitizeTuple3(matrix.lightPosition),
      viewMatrix: matrix.viewMatrix.map(sanitizeNumber),
      projectionMatrix: matrix.projectionMatrix.map(sanitizeNumber),
      viewProjectionMatrix: matrix.viewProjectionMatrix.map(sanitizeNumber),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function directionalShadowMatrixComputationReportToJson(
  report: DirectionalShadowMatrixComputationReport,
): string {
  return JSON.stringify(
    directionalShadowMatrixComputationReportToJsonValue(report),
  );
}

function computeDirectionalShadowMatrix(
  input: DirectionalShadowMatrixComputationInput,
  plan: DirectionalShadowViewProjectionPlan,
):
  | { readonly matrix: DirectionalShadowMatrixComputation }
  | { readonly diagnostic: DirectionalShadowMatrixComputationDiagnostic } {
  if (!hasMatrix(input.transforms, plan.lightTransformOffset)) {
    return {
      diagnostic: {
        code: "directionalShadowMatrix.missingLightTransform",
        severity: "warning",
        shadowId: plan.shadowId,
        lightId: plan.lightId,
        message: `Directional shadow plan '${plan.planKey}' references missing light transform offset ${plan.lightTransformOffset}.`,
      },
    };
  }

  const transform = input.transforms.subarray(
    plan.lightTransformOffset,
    plan.lightTransformOffset + 16,
  );
  const direction = normalize([
    -(transform[8] ?? 0),
    -(transform[9] ?? 0),
    -(transform[10] ?? 0),
  ]);

  if (direction === null) {
    return {
      diagnostic: {
        code: "directionalShadowMatrix.invalidLightDirection",
        severity: "warning",
        shadowId: plan.shadowId,
        lightId: plan.lightId,
        message: `Directional shadow plan '${plan.planKey}' has a zero-length light direction.`,
      },
    };
  }

  const center = tuple3(input.center ?? DEFAULT_CENTER);
  const distance = input.lightDistance ?? DEFAULT_LIGHT_DISTANCE;
  const lightPosition = tuple3([
    center[0] - direction[0] * distance,
    center[1] - direction[1] * distance,
    center[2] - direction[2] * distance,
  ]);
  const size =
    (input.orthographicSize ?? DEFAULT_ORTHOGRAPHIC_SIZE) *
    (plan.cascadeFar ?? 1);
  const halfSize = size * 0.5;
  const near = input.near ?? DEFAULT_NEAR;
  const far = input.far ?? DEFAULT_FAR;
  const viewMatrix = makeLookAt(lightPosition, center, [0, 1, 0]);
  const projectionMatrix = makeOrthographic(
    -halfSize,
    halfSize,
    -halfSize,
    halfSize,
    near,
    far,
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
      cascadeIndex: plan.cascadeIndex ?? 0,
      cascadeCount: plan.cascadeCount ?? 1,
      cascadeNear: plan.cascadeNear ?? 0,
      cascadeFar: plan.cascadeFar ?? 1,
      center,
      lightDirection: direction,
      lightPosition,
      orthographicSize: size,
      near,
      far,
      viewMatrix: Array.from(viewMatrix),
      projectionMatrix: Array.from(projectionMatrix),
      viewProjectionMatrix: Array.from(viewProjectionMatrix),
    },
  };
}

function determineStatus(input: {
  readonly viewProjectionStatus: DirectionalShadowViewProjectionPlanReport["status"];
  readonly matrixCount: number;
  readonly diagnostics: readonly DirectionalShadowMatrixComputationDiagnostic[];
}): DirectionalShadowMatrixComputationStatus {
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
  const xAxis = zAxis === null ? null : normalize(cross(tuple3(up), zAxis));
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
    -dot(xAxis, eye),
    -dot(yAxis, eye),
    -dot(zAxis, eye),
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

  return tuple3([value[0] / length, value[1] / length, value[2] / length]);
}

function tuple3(value: Vec3Like): readonly [number, number, number] {
  return [value[0], value[1], value[2]];
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

function dot(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
