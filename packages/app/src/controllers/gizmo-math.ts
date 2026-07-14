// Pure math shared by the rotate + scale transform gizmos (parity plan H2). Every
// function is a plain numeric transform — no ECS, no DOM — so the snapping,
// swept-angle, closest-point, and scale-factor logic can be unit-tested without a
// world. The gizmo controllers convert ECS/ray values into plain tuples and feed
// them here, then write the result back through `LocalTransform`.

export type GizmoVec3 = readonly [number, number, number];

/** Ray/axis or ray/plane projections below this become ill-conditioned. */
const PARALLEL_EPSILON = 1e-4;
/** Vectors shorter than this are treated as degenerate (no direction). */
const DIRECTION_EPSILON = 1e-9;

/** Smallest scale magnitude a scale gizmo will write (degenerate guard). */
export const MIN_GIZMO_SCALE = 1e-3;

/**
 * Quantize `value` to the nearest multiple of `increment`. Snapping is disabled
 * (the value passes through unchanged) when `increment` is `undefined`, not
 * finite, or non-positive — matching the `0`/undefined = off contract on the
 * gizmo options.
 */
export function snapToIncrement(
  value: number,
  increment: number | undefined,
): number {
  if (
    increment === undefined ||
    !Number.isFinite(increment) ||
    increment <= 0
  ) {
    return value;
  }
  return Math.round(value / increment) * increment;
}

/**
 * Signed angle (radians, right-handed about `axis`) that rotates `from` onto
 * `to`, measuring only the components in the plane perpendicular to `axis`. The
 * result is in `(-π, π]`; a zero-length projected input yields `0`.
 */
export function signedAngleOnPlane(
  axis: GizmoVec3,
  from: GizmoVec3,
  to: GizmoVec3,
): number {
  const a = normalize(axis);
  if (a === null) {
    return 0;
  }
  const f = projectOntoPlane(from, a);
  const t = projectOntoPlane(to, a);
  if (length(f) <= DIRECTION_EPSILON || length(t) <= DIRECTION_EPSILON) {
    return 0;
  }
  const sin = dot(a, cross(f, t));
  const cos = dot(f, t);
  return Math.atan2(sin, cos);
}

/**
 * World point where the ray `origin + t·direction` meets the plane through
 * `planePoint` with normal `planeNormal`, or `null` when the ray is (nearly)
 * parallel to the plane (ill-conditioned intersection — the gizmo skips the
 * frame). Used by the rotate rings and the uniform scale handle.
 */
export function rayPlaneIntersection(
  planePoint: GizmoVec3,
  planeNormal: GizmoVec3,
  origin: GizmoVec3,
  direction: GizmoVec3,
): GizmoVec3 | null {
  const n = normalize(planeNormal);
  const d = normalize(direction);
  if (n === null || d === null) {
    return null;
  }
  const denom = dot(n, d);
  if (Math.abs(denom) < PARALLEL_EPSILON) {
    return null;
  }
  const t = dot(sub(planePoint, origin), n) / denom;
  return [origin[0] + d[0] * t, origin[1] + d[1] * t, origin[2] + d[2] * t];
}

/**
 * Parameter `t` of the point `anchor + t·axis` (with `axis` treated as a unit
 * direction) closest to the ray `origin + s·direction`. Returns `null` when the
 * ray is nearly parallel to the axis (the projection is ill-conditioned). This
 * is the same closest-point-on-axis projection the translate gizmo uses; the
 * scale gizmo reuses it to turn pointer motion into an axis-parameter delta.
 */
export function closestPointParamOnAxis(
  anchor: GizmoVec3,
  axis: GizmoVec3,
  origin: GizmoVec3,
  direction: GizmoVec3,
): number | null {
  const a = normalize(axis);
  const d = normalize(direction);
  if (a === null || d === null) {
    return null;
  }
  const b = dot(a, d);
  const denom = 1 - b * b;
  if (denom < PARALLEL_EPSILON) {
    return null;
  }
  const w0 = sub(anchor, origin);
  const dCoeff = dot(a, w0);
  const eCoeff = dot(d, w0);
  return (b * eCoeff - dCoeff) / denom;
}

/**
 * Multiplicative scale factor for an axis-parameter delta: dragging the handle
 * out by `referenceLength` doubles the axis (factor `2`), pulling it in by the
 * same amount drives it toward `0`. A non-positive/degenerate `referenceLength`
 * returns `1` (no change). The factor is intentionally NOT clamped here — the
 * caller multiplies it into the start scale and clamps the result with
 * {@link guardScale}.
 */
export function scaleFactorFromDelta(
  delta: number,
  referenceLength: number,
): number {
  if (
    !Number.isFinite(delta) ||
    !Number.isFinite(referenceLength) ||
    referenceLength <= DIRECTION_EPSILON
  ) {
    return 1;
  }
  return 1 + delta / referenceLength;
}

/**
 * Clamp a computed scale component to a small positive minimum so a drag (or a
 * snap-to-zero) can never write a zero/negative/degenerate scale.
 */
export function guardScale(value: number, minScale = MIN_GIZMO_SCALE): number {
  if (!Number.isFinite(value) || value < minScale) {
    return minScale;
  }
  return value;
}

/**
 * A unit in-plane "right" axis for the plane with the given `normal`, formed as
 * `normalize(up × normal)`. Falls back to `world X × normal` when `up` is
 * parallel to `normal`, and `null` only for a degenerate normal. The uniform
 * scale handle uses this to measure horizontal pointer displacement on the
 * camera-facing drag plane.
 */
export function inPlaneRightAxis(
  normal: GizmoVec3,
  up: GizmoVec3 = [0, 1, 0],
): GizmoVec3 | null {
  const n = normalize(normal);
  if (n === null) {
    return null;
  }
  const right = normalize(cross(up, n));
  if (right !== null) {
    return right;
  }
  return normalize(cross([1, 0, 0], n));
}

function projectOntoPlane(vector: GizmoVec3, unitNormal: GizmoVec3): GizmoVec3 {
  const d = dot(vector, unitNormal);
  return [
    vector[0] - unitNormal[0] * d,
    vector[1] - unitNormal[1] * d,
    vector[2] - unitNormal[2] * d,
  ];
}

function dot(a: GizmoVec3, b: GizmoVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: GizmoVec3, b: GizmoVec3): GizmoVec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function sub(a: GizmoVec3, b: GizmoVec3): GizmoVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(a: GizmoVec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalize(a: GizmoVec3): GizmoVec3 | null {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (len <= DIRECTION_EPSILON) {
    return null;
  }
  return [a[0] / len, a[1] / len, a[2] / len];
}
