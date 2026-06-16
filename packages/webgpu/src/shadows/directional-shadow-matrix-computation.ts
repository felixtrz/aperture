import {
  invertMat4,
  makeOrthographic,
  multiplyMat4,
  transformPoint,
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

export interface DirectionalShadowCasterBoundsInput {
  readonly passKey: string;
  readonly bounds: readonly DirectionalShadowCasterWorldAabb[];
}

export interface DirectionalShadowCasterWorldAabb {
  readonly min: Vec3Like;
  readonly max: Vec3Like;
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
  /**
   * Camera world->view matrix. When supplied together with
   * {@link cameraProjectionMatrix} (and the plan carries absolute cascade
   * near/far distances from M4-T2), each cascade ortho is FRUSTUM-FIT to the
   * camera view slice and TEXEL-SNAPPED for stability instead of using the
   * fixed {@link center} + globally-scaled {@link orthographicSize}. Consumed
   * read-only from the snapshot transforms; no scene graph is introduced.
   */
  readonly cameraViewMatrix?: Mat4Like | undefined;
  /** Camera view->clip projection matrix (pairs with {@link cameraViewMatrix}). */
  readonly cameraProjectionMatrix?: Mat4Like | undefined;
  /** Optional world up used to build the light view basis (defaults to +Y). */
  readonly up?: Vec3Like | undefined;
  /**
   * Optional caster bounds grouped by shadow pass. Frustum fitting uses these to
   * tighten the depth range like PlayCanvas does after culling visible casters.
   */
  readonly casterBounds?: readonly DirectionalShadowCasterBoundsInput[];
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

  const hasAuthoredFixedCamera =
    plan.orthographicSize !== undefined && plan.orthographicSize > 0;
  const fit = hasAuthoredFixedCamera
    ? null
    : tryFrustumFit(input, plan, direction);

  const center =
    fit?.center ?? tuple3(plan.center ?? input.center ?? DEFAULT_CENTER);
  const distance =
    plan.lightDistance ?? input.lightDistance ?? DEFAULT_LIGHT_DISTANCE;
  const lightPosition =
    fit?.lightPosition ??
    tuple3([
      center[0] - direction[0] * distance,
      center[1] - direction[1] * distance,
      center[2] - direction[2] * distance,
    ]);
  const authoredSize = plan.orthographicSize;
  const size =
    fit?.size ??
    (authoredSize !== undefined && authoredSize > 0
      ? authoredSize
      : (input.orthographicSize ?? DEFAULT_ORTHOGRAPHIC_SIZE) *
        (plan.cascadeFar ?? 1));
  const halfSize = size * 0.5;
  const near = fit?.near ?? plan.near ?? input.near ?? DEFAULT_NEAR;
  const far = fit?.far ?? plan.far ?? input.far ?? DEFAULT_FAR;
  const up = fit?.up ?? [0, 1, 0];
  const viewMatrix = makeLookAt(lightPosition, center, up);
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

interface FrustumFitResult {
  readonly center: readonly [number, number, number];
  readonly lightPosition: readonly [number, number, number];
  readonly size: number;
  readonly near: number;
  readonly far: number;
  readonly up: readonly [number, number, number];
}

/**
 * Per-cascade frustum-fit + texel-stabilized ortho derivation, adapted from
 * bevy `calculate_cascade` (references/bevy/crates/bevy_light/src/cascade.rs
 * lines 263-334): fit each cascade's camera-view slice into a light-space AABB,
 * size the ortho to the slice's largest diagonal (so the extent depends only on
 * the frustum SHAPE, not the camera position — shadows do not swim), and snap
 * the cascade center to integer texel multiples. Borrowed concept only; this
 * keeps Aperture's existing makeLookAt/makeOrthographic (non-reverse-Z)
 * convention so the shader's shadowClip.z*0.5+0.5 remap stays valid.
 *
 * Returns null (caller falls back to the static-center behavior, byte-identical
 * for existing examples) when no camera frustum is supplied, when the plan lacks
 * the absolute cascade distances (M4-T2), or on a degenerate frustum.
 */
function tryFrustumFit(
  input: DirectionalShadowMatrixComputationInput,
  plan: DirectionalShadowViewProjectionPlan,
  direction: readonly [number, number, number],
): FrustumFitResult | null {
  const cameraView = input.cameraViewMatrix;
  const cameraProjection = input.cameraProjectionMatrix;
  const sliceNear = plan.cascadeNearDistance;
  const sliceFar = plan.cascadeFarDistance;

  if (
    cameraView === undefined ||
    cameraView === null ||
    cameraProjection === undefined ||
    cameraProjection === null ||
    sliceNear === undefined ||
    sliceFar === undefined ||
    sliceFar <= sliceNear
  ) {
    return null;
  }

  // Light view basis: look along the light direction. zAxis points back toward
  // the light source (+zAxis = -direction), matching makeLookAt's basis so the
  // fitted center/eye stay consistent with the view matrix we hand back.
  const zAxis = negate(direction);
  const requestedUp = input.up ? tuple3(input.up) : ([0, 1, 0] as const);
  let up = requestedUp;
  let xAxis = normalize(cross(up, zAxis));
  if (xAxis === null) {
    up = [0, 0, 1];
    xAxis = normalize(cross(up, zAxis));
  }
  if (xAxis === null) {
    return null;
  }
  const yAxis = cross(zAxis, xAxis);

  const inverseViewProjection = invertMat4(
    multiplyMat4(cameraProjection, cameraView),
  );
  const inverseView = invertMat4(cameraView);
  if (inverseViewProjection === null || inverseView === null) {
    return null;
  }

  // Camera forward + position to convert the cascade's world-space split
  // distances into normalized depths along the near->far frustum edges.
  const cameraPosition: readonly [number, number, number] = [
    inverseView[12] ?? 0,
    inverseView[13] ?? 0,
    inverseView[14] ?? 0,
  ];
  const forward = normalize([
    -(inverseView[8] ?? 0),
    -(inverseView[9] ?? 0),
    -(inverseView[10] ?? 0),
  ]);
  if (forward === null) {
    return null;
  }

  // WebGPU clip space z in [0,1] (wgpu-matrix projections): near plane z=0,
  // far plane z=1. Corner xy order matches bevy: BR, TR, TL, BL.
  const ndcXy: readonly (readonly [number, number])[] = [
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ];
  const nearCorners = ndcXy.map((xy) =>
    asTuple3(transformPoint(inverseViewProjection, [xy[0], xy[1], 0])),
  );
  const farCorners = ndcXy.map((xy) =>
    asTuple3(transformPoint(inverseViewProjection, [xy[0], xy[1], 1])),
  );
  const nearCenter = asTuple3(transformPoint(inverseViewProjection, [0, 0, 0]));
  const farCenter = asTuple3(transformPoint(inverseViewProjection, [0, 0, 1]));

  const cameraNear = dot(forward, sub(nearCenter, cameraPosition));
  const cameraFar = dot(forward, sub(farCenter, cameraPosition));
  const depthRange = cameraFar - cameraNear;
  if (!(depthRange > EPSILON)) {
    return null;
  }

  const tNear = clamp01((sliceNear - cameraNear) / depthRange);
  const tFar = clamp01((sliceFar - cameraNear) / depthRange);
  if (tFar <= tNear) {
    return null;
  }

  // Eight world-space corners of this cascade's frustum slice.
  const corners: (readonly [number, number, number])[] = [];
  for (let i = 0; i < 4; i += 1) {
    corners.push(lerp(nearCorners[i]!, farCorners[i]!, tNear));
  }
  for (let i = 0; i < 4; i += 1) {
    corners.push(lerp(nearCorners[i]!, farCorners[i]!, tFar));
  }

  // Light-space AABB (projection onto the orthonormal light basis).
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  let minW = Infinity;
  let maxW = -Infinity;
  for (const corner of corners) {
    const u = dot(xAxis, corner);
    const v = dot(yAxis, corner);
    const w = dot(zAxis, corner);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
    minW = Math.min(minW, w);
    maxW = Math.max(maxW, w);
  }

  // Diameter from the largest world-space diagonal (body vs far-plane). Using
  // the original world corners (not the projected coords) for precision, and
  // ceil() for floating-point stability, exactly as bevy does. This is what
  // makes the extent depend only on the frustum shape (position-invariant).
  const bodyDiagonalSq = distanceSquared(corners[0]!, corners[6]!);
  const farDiagonalSq = distanceSquared(corners[4]!, corners[6]!);
  const diameter = Math.ceil(
    Math.sqrt(Math.max(bodyDiagonalSq, farDiagonalSq)),
  );
  if (!(diameter > EPSILON)) {
    return null;
  }

  const mapSize = plan.mapSize > 0 ? plan.mapSize : 1;
  const texelSize = diameter / mapSize;
  const halfSize = diameter * 0.5;

  // Snap the in-plane center to integer texel multiples for stability; the
  // depth (w) center is not snapped (it only shifts the ortho near/far range).
  const centerU = Math.floor((0.5 * (minU + maxU)) / texelSize) * texelSize;
  const centerV = Math.floor((0.5 * (minV + maxV)) / texelSize) * texelSize;
  const centerW = 0.5 * (minW + maxW);
  const center: readonly [number, number, number] = [
    centerU * xAxis[0] + centerV * yAxis[0] + centerW * zAxis[0],
    centerU * xAxis[1] + centerV * yAxis[1] + centerW * zAxis[1],
    centerU * xAxis[2] + centerV * yAxis[2] + centerW * zAxis[2],
  ];

  const casterDepth = fitCasterDepthRange({
    casterBounds: input.casterBounds,
    passKey: plan.passKey,
    xAxis,
    yAxis,
    zAxis,
    minU: centerU - halfSize,
    maxU: centerU + halfSize,
    minV: centerV - halfSize,
    maxV: centerV + halfSize,
  });
  const depthMinW = Math.min(minW, casterDepth?.minW ?? minW);
  const depthMaxW = Math.max(maxW, casterDepth?.maxW ?? maxW);
  const towardLight = Math.max(depthMaxW - centerW, EPSILON);
  const awayFromLight = Math.max(centerW - depthMinW, EPSILON);

  // Place the light eye behind the slice along +zAxis (toward the light). The
  // in-plane fit stays camera-frustum based, while depth is tightened to the
  // visible in-plane caster bounds like PlayCanvas' directional shadow pass.
  const near = 1;
  const distance = towardLight + near + 0.1;
  const far = distance + awayFromLight + 0.1;
  const lightPosition: readonly [number, number, number] = [
    center[0] + zAxis[0] * distance,
    center[1] + zAxis[1] * distance,
    center[2] + zAxis[2] * distance,
  ];

  return { center, lightPosition, size: diameter, near, far, up };
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

function fitCasterDepthRange(input: {
  readonly casterBounds:
    | readonly DirectionalShadowCasterBoundsInput[]
    | undefined;
  readonly passKey: string;
  readonly xAxis: readonly [number, number, number];
  readonly yAxis: readonly [number, number, number];
  readonly zAxis: readonly [number, number, number];
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
}): { readonly minW: number; readonly maxW: number } | null {
  const passBounds = input.casterBounds?.find(
    (entry) => entry.passKey === input.passKey,
  );

  if (passBounds === undefined || passBounds.bounds.length === 0) {
    return null;
  }

  let found = false;
  let minW = Infinity;
  let maxW = -Infinity;

  for (const bounds of passBounds.bounds) {
    const projected = projectAabbToLightSpace(bounds, {
      xAxis: input.xAxis,
      yAxis: input.yAxis,
      zAxis: input.zAxis,
    });

    if (
      projected.maxU < input.minU ||
      projected.minU > input.maxU ||
      projected.maxV < input.minV ||
      projected.minV > input.maxV
    ) {
      continue;
    }

    found = true;
    minW = Math.min(minW, projected.minW);
    maxW = Math.max(maxW, projected.maxW);
  }

  return found ? { minW, maxW } : null;
}

function projectAabbToLightSpace(
  bounds: DirectionalShadowCasterWorldAabb,
  basis: {
    readonly xAxis: readonly [number, number, number];
    readonly yAxis: readonly [number, number, number];
    readonly zAxis: readonly [number, number, number];
  },
): {
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
  readonly minW: number;
  readonly maxW: number;
} {
  const min = tuple3(bounds.min);
  const max = tuple3(bounds.max);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  let minW = Infinity;
  let maxW = -Infinity;

  for (let cx = 0; cx < 2; cx += 1) {
    for (let cy = 0; cy < 2; cy += 1) {
      for (let cz = 0; cz < 2; cz += 1) {
        const point: readonly [number, number, number] = [
          cx === 0 ? min[0] : max[0],
          cy === 0 ? min[1] : max[1],
          cz === 0 ? min[2] : max[2],
        ];
        const u = dot(basis.xAxis, point);
        const v = dot(basis.yAxis, point);
        const w = dot(basis.zAxis, point);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
        minW = Math.min(minW, w);
        maxW = Math.max(maxW, w);
      }
    }
  }

  return { minU, maxU, minV, maxV, minW, maxW };
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

function negate(
  value: readonly [number, number, number],
): readonly [number, number, number] {
  return [-value[0], -value[1], -value[2]];
}

function sub(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function lerp(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function distanceSquared(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function asTuple3(value: {
  readonly [index: number]: number;
}): readonly [number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}
