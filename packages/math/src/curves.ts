import { vec3 } from "./constructors.js";
import { clamp01, v3 } from "./scalars.js";
import type { Vec3, Vec3Like, Vec3Tuple } from "./types.js";

// Kernel-style curve primitives over array vectors (decision 0007: no math
// classes). A curve is a small readonly tagged-union data record; the free
// functions `getCurvePoint` / `getCurveTangent` / `getCurveLength` dispatch on
// `curve.kind`, so any curve feeds a downstream consumer (e.g. the render tube
// builder) uniformly. Every evaluator reads its inputs into scalar locals
// before writing the destination, so `out` may alias any control point. The
// control points are copied into plain number tuples at construction time, so
// evaluation is allocation-light: a call allocates only when `out` is omitted.
//
// Parameters use `t in [0, 1]` spanning the whole curve (clamped). Catmull-Rom
// splines default to the CENTRIPETAL parametrization (`alpha = 0.5`), matching
// three.js `CatmullRomCurve3`'s default; `alpha = 0` is uniform and `alpha = 1`
// is chordal. Arc-length is a deterministic fixed-subdivision sum (see
// `CURVE_LENGTH_SAMPLES`).

/** Number of uniform-parameter segments summed by `getCurveLength`. */
export const CURVE_LENGTH_SAMPLES = 200;

/** Linear segment between two control points. */
export interface LineCurve {
  readonly kind: "line";
  /** `[p0, p1]`. */
  readonly points: readonly [Vec3Tuple, Vec3Tuple];
}

/** Quadratic Bézier curve (three control points). */
export interface QuadraticBezierCurve {
  readonly kind: "quadratic-bezier";
  /** `[p0, p1, p2]`. */
  readonly points: readonly [Vec3Tuple, Vec3Tuple, Vec3Tuple];
}

/** Cubic Bézier curve (four control points). */
export interface CubicBezierCurve {
  readonly kind: "cubic-bezier";
  /** `[p0, p1, p2, p3]`. */
  readonly points: readonly [Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple];
}

/**
 * Catmull-Rom spline through `points`. `alpha` selects the parametrization
 * (0 uniform, 0.5 centripetal — the default matching three.js, 1 chordal);
 * `closed` wraps the spline into a loop (so `getCurvePoint(curve, 1)` returns
 * the first point again).
 */
export interface CatmullRomCurve {
  readonly kind: "catmull-rom";
  readonly points: readonly Vec3Tuple[];
  readonly closed: boolean;
  readonly alpha: number;
}

/**
 * Circular/elliptical arc in the plane spanned by the orthonormal `xAxis` and
 * `yAxis` (defaults `+X`/`+Y`), swept from `startAngle` to `endAngle`:
 * `center + xRadius*cos(angle)*xAxis + yRadius*sin(angle)*yAxis`.
 */
export interface ArcCurve {
  readonly kind: "arc";
  readonly center: Vec3Tuple;
  readonly xRadius: number;
  readonly yRadius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly xAxis: Vec3Tuple;
  readonly yAxis: Vec3Tuple;
}

export type Curve =
  | LineCurve
  | QuadraticBezierCurve
  | CubicBezierCurve
  | CatmullRomCurve
  | ArcCurve;

export interface CatmullRomCurveOptions {
  readonly closed?: boolean;
  /** Parametrization exponent: 0 uniform, 0.5 centripetal (default), 1 chordal. */
  readonly alpha?: number;
}

export interface ArcCurveOptions {
  readonly center?: Vec3Like;
  readonly xRadius: number;
  /** Ellipse minor radius; defaults to `xRadius` (a circle). */
  readonly yRadius?: number;
  readonly startAngle?: number;
  /** Defaults to `startAngle + 2*PI` (a full turn). */
  readonly endAngle?: number;
  readonly xAxis?: Vec3Like;
  readonly yAxis?: Vec3Like;
}

function tuple(value: Vec3Like): Vec3Tuple {
  return [v3(value, 0), v3(value, 1), v3(value, 2)];
}

/** Linear curve from `p0` to `p1`. */
export function lineCurve(p0: Vec3Like, p1: Vec3Like): LineCurve {
  return { kind: "line", points: [tuple(p0), tuple(p1)] };
}

/** Quadratic Bézier through control points `p0`, `p1`, `p2`. */
export function quadraticBezierCurve(
  p0: Vec3Like,
  p1: Vec3Like,
  p2: Vec3Like,
): QuadraticBezierCurve {
  return {
    kind: "quadratic-bezier",
    points: [tuple(p0), tuple(p1), tuple(p2)],
  };
}

/** Cubic Bézier through control points `p0`, `p1`, `p2`, `p3`. */
export function cubicBezierCurve(
  p0: Vec3Like,
  p1: Vec3Like,
  p2: Vec3Like,
  p3: Vec3Like,
): CubicBezierCurve {
  return {
    kind: "cubic-bezier",
    points: [tuple(p0), tuple(p1), tuple(p2), tuple(p3)],
  };
}

/**
 * Catmull-Rom spline through `points`. Defaults to a centripetal (`alpha 0.5`),
 * open spline; pass `{ closed: true }` for a loop or `{ alpha }` to switch
 * parametrization. Requires at least two points.
 */
export function catmullRomCurve(
  points: readonly Vec3Like[],
  options: CatmullRomCurveOptions = {},
): CatmullRomCurve {
  if (points.length < 2) {
    throw new RangeError(
      "catmullRomCurve requires at least two control points.",
    );
  }

  return {
    kind: "catmull-rom",
    points: points.map(tuple),
    closed: options.closed ?? false,
    alpha: options.alpha ?? 0.5,
  };
}

/**
 * Circular/elliptical arc. `xRadius` is required; `yRadius` defaults to it (a
 * circle), the sweep defaults to a full turn, and `xAxis`/`yAxis` default to
 * the world `+X`/`+Y` axes (both normalized on construction).
 */
export function arcCurve(options: ArcCurveOptions): ArcCurve {
  const startAngle = options.startAngle ?? 0;

  return {
    kind: "arc",
    center: options.center === undefined ? [0, 0, 0] : tuple(options.center),
    xRadius: options.xRadius,
    yRadius: options.yRadius ?? options.xRadius,
    startAngle,
    endAngle: options.endAngle ?? startAngle + Math.PI * 2,
    xAxis: normalizeTuple(
      options.xAxis === undefined ? [1, 0, 0] : tuple(options.xAxis),
    ),
    yAxis: normalizeTuple(
      options.yAxis === undefined ? [0, 1, 0] : tuple(options.yAxis),
    ),
  };
}

/** Point on `curve` at parameter `t in [0, 1]` (clamped). */
export function getCurvePoint(
  curve: Curve,
  t: number,
  out: Vec3 = vec3(),
): Vec3 {
  const u = clamp01(t);

  switch (curve.kind) {
    case "line":
      return linePoint(curve, u, out);
    case "quadratic-bezier":
      return quadraticPoint(curve, u, out);
    case "cubic-bezier":
      return cubicPoint(curve, u, out);
    case "catmull-rom":
      return catmullRomPoint(curve, u, out);
    case "arc":
      return arcPoint(curve, u, out);
  }
}

/** Unit tangent of `curve` at parameter `t in [0, 1]` (clamped). */
export function getCurveTangent(
  curve: Curve,
  t: number,
  out: Vec3 = vec3(),
): Vec3 {
  const u = clamp01(t);

  switch (curve.kind) {
    case "line":
      return lineTangent(curve, out);
    case "quadratic-bezier":
      return quadraticTangent(curve, u, out);
    case "cubic-bezier":
      return cubicTangent(curve, u, out);
    case "catmull-rom":
      return numericTangent(curve, u, out);
    case "arc":
      return arcTangent(curve, u, out);
  }
}

/**
 * Arc length of `curve` as the summed length of a `CURVE_LENGTH_SAMPLES`-segment
 * uniform-parameter polyline. Exact for a line; converges to the analytic length
 * (a full circle of radius `r` is within ~4e-5 relative error of `2*PI*r`).
 */
export function getCurveLength(curve: Curve): number {
  const previous = vec3();
  const current = vec3();
  let length = 0;

  getCurvePoint(curve, 0, previous);

  for (let i = 1; i <= CURVE_LENGTH_SAMPLES; i += 1) {
    getCurvePoint(curve, i / CURVE_LENGTH_SAMPLES, current);
    length += Math.hypot(
      current[0] - previous[0],
      current[1] - previous[1],
      current[2] - previous[2],
    );
    previous[0] = current[0];
    previous[1] = current[1];
    previous[2] = current[2];
  }

  return length;
}

function linePoint(curve: LineCurve, t: number, out: Vec3): Vec3 {
  const [p0, p1] = curve.points;

  out[0] = p0[0] + (p1[0] - p0[0]) * t;
  out[1] = p0[1] + (p1[1] - p0[1]) * t;
  out[2] = p0[2] + (p1[2] - p0[2]) * t;
  return out;
}

function lineTangent(curve: LineCurve, out: Vec3): Vec3 {
  const [p0, p1] = curve.points;

  return normalizeInto(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2], out);
}

function quadraticPoint(
  curve: QuadraticBezierCurve,
  t: number,
  out: Vec3,
): Vec3 {
  const [p0, p1, p2] = curve.points;
  const mt = 1 - t;
  const a = mt * mt;
  const b = 2 * mt * t;
  const c = t * t;

  out[0] = a * p0[0] + b * p1[0] + c * p2[0];
  out[1] = a * p0[1] + b * p1[1] + c * p2[1];
  out[2] = a * p0[2] + b * p1[2] + c * p2[2];
  return out;
}

function quadraticTangent(
  curve: QuadraticBezierCurve,
  t: number,
  out: Vec3,
): Vec3 {
  const [p0, p1, p2] = curve.points;
  const a = 2 * (1 - t);
  const b = 2 * t;

  return normalizeInto(
    a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]),
    a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]),
    a * (p1[2] - p0[2]) + b * (p2[2] - p1[2]),
    out,
  );
}

function cubicPoint(curve: CubicBezierCurve, t: number, out: Vec3): Vec3 {
  const [p0, p1, p2, p3] = curve.points;
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;

  out[0] = a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0];
  out[1] = a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1];
  out[2] = a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2];
  return out;
}

function cubicTangent(curve: CubicBezierCurve, t: number, out: Vec3): Vec3 {
  const [p0, p1, p2, p3] = curve.points;
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;

  return normalizeInto(
    a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]) + c * (p3[0] - p2[0]),
    a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]) + c * (p3[1] - p2[1]),
    a * (p1[2] - p0[2]) + b * (p2[2] - p1[2]) + c * (p3[2] - p2[2]),
    out,
  );
}

function arcPoint(curve: ArcCurve, t: number, out: Vec3): Vec3 {
  const angle = curve.startAngle + (curve.endAngle - curve.startAngle) * t;
  const cx = curve.xRadius * Math.cos(angle);
  const sy = curve.yRadius * Math.sin(angle);

  out[0] = curve.center[0] + cx * curve.xAxis[0] + sy * curve.yAxis[0];
  out[1] = curve.center[1] + cx * curve.xAxis[1] + sy * curve.yAxis[1];
  out[2] = curve.center[2] + cx * curve.xAxis[2] + sy * curve.yAxis[2];
  return out;
}

function arcTangent(curve: ArcCurve, t: number, out: Vec3): Vec3 {
  const angle = curve.startAngle + (curve.endAngle - curve.startAngle) * t;
  const dCos = -curve.xRadius * Math.sin(angle);
  const dSin = curve.yRadius * Math.cos(angle);

  return normalizeInto(
    dCos * curve.xAxis[0] + dSin * curve.yAxis[0],
    dCos * curve.xAxis[1] + dSin * curve.yAxis[1],
    dCos * curve.xAxis[2] + dSin * curve.yAxis[2],
    out,
  );
}

// Barry-Goldman pyramidal evaluation of a non-uniform Catmull-Rom spline: the
// segment's four control points are re-parametrized by knot spacing
// `dt = |p_{i+1} - p_i|^alpha` (alpha 0.5 = centripetal). Endpoints of an open
// spline reflect the neighbouring point; a closed spline wraps.
function catmullRomPoint(curve: CatmullRomCurve, t: number, out: Vec3): Vec3 {
  const points = curve.points;
  const count = points.length;
  const segments = curve.closed ? count : count - 1;
  const scaled = t * segments;
  let index = Math.floor(scaled);
  let local = scaled - index;

  if (index >= segments) {
    index = segments - 1;
    local = 1;
  }

  const p1 = points[index] as Vec3Tuple;
  const p2 = wrapPoint(points, index + 1, curve.closed);
  const p0 = wrapPoint(points, index - 1, curve.closed);
  const p3 = wrapPoint(points, index + 2, curve.closed);

  const dt0 = knot(p0, p1, curve.alpha);
  const dt1 = knot(p1, p2, curve.alpha);
  const dt2 = knot(p2, p3, curve.alpha);

  out[0] = barryGoldman(p0[0], p1[0], p2[0], p3[0], dt0, dt1, dt2, local);
  out[1] = barryGoldman(p0[1], p1[1], p2[1], p3[1], dt0, dt1, dt2, local);
  out[2] = barryGoldman(p0[2], p1[2], p2[2], p3[2], dt0, dt1, dt2, local);
  return out;
}

// Evaluates one axis of the Barry-Goldman recurrence over knots
// t0=0, t1=dt0, t2=dt0+dt1, t3=dt0+dt1+dt2 at t = t1 + s*dt1.
function barryGoldman(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  dt0: number,
  dt1: number,
  dt2: number,
  s: number,
): number {
  const t0 = 0;
  const t1 = dt0;
  const t2 = dt0 + dt1;
  const t3 = dt0 + dt1 + dt2;
  const t = t1 + s * dt1;

  const a1 = lerpKnot(p0, p1, t0, t1, t);
  const a2 = lerpKnot(p1, p2, t1, t2, t);
  const a3 = lerpKnot(p2, p3, t2, t3, t);
  const b1 = lerpKnot(a1, a2, t0, t2, t);
  const b2 = lerpKnot(a2, a3, t1, t3, t);

  return lerpKnot(b1, b2, t1, t2, t);
}

function lerpKnot(
  a: number,
  b: number,
  ta: number,
  tb: number,
  t: number,
): number {
  const span = tb - ta;

  if (span === 0) {
    return a;
  }

  const w = (t - ta) / span;
  return a + (b - a) * w;
}

function knot(a: Vec3Tuple, b: Vec3Tuple, alpha: number): number {
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  // Guard coincident points so a knot interval never collapses to zero (which
  // would divide by zero in the recurrence).
  const dt = Math.pow(distance, alpha);
  return dt > 0 ? dt : 1;
}

function wrapPoint(
  points: readonly Vec3Tuple[],
  index: number,
  closed: boolean,
): Vec3Tuple {
  const count = points.length;

  if (closed) {
    return points[((index % count) + count) % count] as Vec3Tuple;
  }

  if (index < 0) {
    // Reflect the first point across p0: 2*p0 - p1.
    const p0 = points[0] as Vec3Tuple;
    const p1 = points[1] as Vec3Tuple;
    return [2 * p0[0] - p1[0], 2 * p0[1] - p1[1], 2 * p0[2] - p1[2]];
  }

  if (index >= count) {
    const last = points[count - 1] as Vec3Tuple;
    const prev = points[count - 2] as Vec3Tuple;
    return [
      2 * last[0] - prev[0],
      2 * last[1] - prev[1],
      2 * last[2] - prev[2],
    ];
  }

  return points[index] as Vec3Tuple;
}

// Central-difference tangent for curves without a cheap closed-form derivative
// (Catmull-Rom). The step shrinks near the endpoints so the difference stays
// inside `[0, 1]`, matching three.js `Curve.getTangent`.
function numericTangent(curve: Curve, t: number, out: Vec3): Vec3 {
  const delta = 1e-4;
  const t1 = t - delta < 0 ? 0 : t - delta;
  const t2 = t + delta > 1 ? 1 : t + delta;
  const a = getCurvePoint(curve, t1, vec3());
  const b = getCurvePoint(curve, t2, vec3());

  return normalizeInto(b[0] - a[0], b[1] - a[1], b[2] - a[2], out);
}

function normalizeInto(x: number, y: number, z: number, out: Vec3): Vec3 {
  const lengthSq = x * x + y * y + z * z;
  const scale = lengthSq > 0 ? 1 / Math.sqrt(lengthSq) : 0;

  out[0] = x * scale;
  out[1] = y * scale;
  out[2] = z * scale;
  return out;
}

function normalizeTuple(value: Vec3Tuple): Vec3Tuple {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length === 0) {
    return [0, 0, 0];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}
