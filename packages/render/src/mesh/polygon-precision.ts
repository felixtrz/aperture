import type { PolygonMeshPoint } from "./polygon-types.js";

type Vector = PolygonMeshPoint;

interface BoundedVector {
  readonly value: Vector;
  /** Upper bound on the L1 error from binary64 arithmetic. */
  readonly error: number;
}

const UNIT_ROUNDOFF = Number.EPSILON / 2;
// A conservative lower bound for sin(0.001), a 0.0573-degree normal budget.
const NORMAL_SINE_LIMIT = 0.000999999833333333;

/**
 * A fallback only for a failed Float32 coplanarity check. This does not validate
 * rings, holes or triangulation, and never repairs or changes a coordinate.
 *
 * Bounds assume IEEE-754 binary64 round-to-nearest basic arithmetic. Positive
 * bound calculations are inflated, with an absolute underflow allowance.
 * L1 upper bounds and max-component lower bounds avoid depending on the
 * implementation accuracy of Math.hypot, normalization or trigonometry.
 */
export function isPlanarFloat32Rounding(
  sourceRings: readonly (readonly PolygonMeshPoint[])[],
  roundedRings: readonly (readonly PolygonMeshPoint[])[],
  roundedNormal: PolygonMeshPoint,
  roundedExtent: number,
): boolean {
  if (
    sourceRings.length === 0 ||
    sourceRings.length !== roundedRings.length ||
    !finitePoint(roundedNormal) ||
    !Number.isFinite(roundedExtent) ||
    roundedExtent <= 0
  )
    return false;

  const sourceOrigin = sourceRings[0]?.[0];
  const roundedOrigin = roundedRings[0]?.[0];
  if (
    !sourceOrigin ||
    !roundedOrigin ||
    !finitePoint(sourceOrigin) ||
    !finitePoint(roundedOrigin)
  )
    return false;

  const budget = lower(roundedExtent * 1e-5, 1);
  const squaredBudget = lower(budget * budget, 1);
  if (!(squaredBudget > 0) || !Number.isFinite(squaredBudget)) return false;
  const source: BoundedVector[][] = [];
  const rounded: BoundedVector[][] = [];
  const displacement: BoundedVector[][] = [];
  let count = 0;
  for (let ring = 0; ring < sourceRings.length; ring++) {
    const p = sourceRings[ring]!;
    const q = roundedRings[ring]!;
    if (p.length < 3 || p.length !== q.length) return false;
    count += p.length;
    if (count > 2048) return false;
    const sourceRow: BoundedVector[] = [];
    const roundedRow: BoundedVector[] = [];
    const displacementRow: BoundedVector[] = [];
    for (let i = 0; i < p.length; i++) {
      const original = p[i]!;
      const uploaded = q[i]!;
      if (
        !finitePoint(original) ||
        !finitePoint(uploaded) ||
        original.some((v, axis) => Math.fround(v) !== uploaded[axis])
      )
        return false;
      const shift = difference(uploaded, original);
      const shiftSquared = sumUpper([
        upper(dot(shift.value, shift.value), 5),
        upper(2 * l1(shift.value) * shift.error, 2),
        upper(shift.error * shift.error, 1),
      ]);
      if (!Number.isFinite(shiftSquared) || shiftSquared > squaredBudget)
        return false;
      sourceRow.push(difference(original, sourceOrigin));
      roundedRow.push(difference(uploaded, roundedOrigin));
      displacementRow.push(shift);
    }
    source.push(sourceRow);
    rounded.push(roundedRow);
    displacement.push(displacementRow);
  }

  const outline = source[0]!;
  const sourceArea = fanArea(outline);
  const roundedArea = fanArea(rounded[0]!);
  const areaLower = magnitudeLower(sourceArea);
  if (
    !(areaLower > 0) ||
    !(magnitudeLower(roundedArea) > 0) ||
    !positiveDot(sourceArea, roundedArea)
  )
    return false;

  // Expansion of (d_i + delta_i) x (d_j + delta_j) bounds the change of
  // the entire area vector, even when observed normal changes cancel out.
  const shifts = displacement[0]!;
  const delta = shifts.map((v) => boundedDifference(v, shifts[0]!));
  const terms: number[] = [];
  for (let i = 1; i < outline.length - 1; i++) {
    const a = magnitudeUpper(outline[i]!);
    const b = magnitudeUpper(outline[i + 1]!);
    const da = magnitudeUpper(delta[i]!);
    const db = magnitudeUpper(delta[i + 1]!);
    terms.push(upper(da * b, 1), upper(a * db, 1), upper(da * db, 1));
  }
  const perturbation = sumUpper([
    ...terms,
    sourceArea.error,
    roundedArea.error,
  ]);
  if (
    !Number.isFinite(perturbation) ||
    perturbation > lower(areaLower * NORMAL_SINE_LIMIT, 1)
  )
    return false;

  // Use the largest computed fan-triangle area, rather than the first three
  // corners, for the original plane. Squared areas need no square root.
  let reference: BoundedVector | undefined;
  let largestAreaSquared = 0;
  for (let i = 1; i < outline.length - 1; i++) {
    const triangle = boundedCross(outline[i]!, outline[i + 1]!);
    const squared = dot(triangle.value, triangle.value);
    if (!Number.isFinite(squared)) return false;
    if (squared > largestAreaSquared) {
      largestAreaSquared = squared;
      reference = triangle;
    }
  }
  if (
    !reference ||
    !(magnitudeLower(reference) > 0) ||
    reference.error > lower(magnitudeLower(reference) * NORMAL_SINE_LIMIT, 1)
  )
    return false;

  // The exact scalar triple product of points in the original plane is zero.
  // Its arithmetic error is the strict source-planarity allowance: it scales
  // with coordinate subtraction and plane conditioning, not the 1e-5 budget.
  for (const ring of source)
    for (const point of ring) {
      const residual = Math.abs(dot(point.value, reference.value));
      const error = dotError(point, reference);
      if (
        !Number.isFinite(error) ||
        !Number.isFinite(residual) ||
        residual > error
      )
        return false;
    }

  // The caller retains its rounded normal and projection. Verify that it is
  // parallel to, and faces with, our independently recomputed rounded area.
  const normal: BoundedVector = { value: roundedNormal, error: 0 };
  const parallel = cross(roundedArea.value, roundedNormal);
  const parallelError = upper(
    gamma(8) * l1(roundedArea.value) * l1(roundedNormal),
    2,
  );
  return (
    Number.isFinite(parallelError) &&
    l1(parallel) <= parallelError &&
    positiveDot(roundedArea, normal)
  );
}

function finitePoint(point: Vector): boolean {
  return point.length === 3 && point.every(Number.isFinite);
}

function gamma(operations: number): number {
  const product = operations * UNIT_ROUNDOFF;
  return product / (1 - product);
}

/** Outward padding also covers computing the bound itself. */
function upper(value: number, operations: number): number {
  const count = operations + 4;
  return (value + count * Number.MIN_VALUE) / (1 - gamma(count));
}

function lower(value: number, operations: number): number {
  const count = operations + 4;
  return Math.max(0, (value - count * Number.MIN_VALUE) / (1 + gamma(count)));
}

function sumUpper(values: readonly number[]): number {
  return upper(
    values.reduce((sum, value) => sum + value, 0),
    values.length,
  );
}

function l1(value: Vector): number {
  return sumUpper(value.map(Math.abs));
}

function magnitudeUpper(value: BoundedVector): number {
  return sumUpper([l1(value.value), value.error]);
}

function magnitudeLower(value: BoundedVector): number {
  return lower(Math.max(...value.value.map(Math.abs)) - value.error, 1);
}

function difference(a: Vector, b: Vector): BoundedVector {
  return {
    value: [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    error: upper(gamma(1) * sumUpper([l1(a), l1(b)]), 1),
  };
}

function boundedDifference(a: BoundedVector, b: BoundedVector): BoundedVector {
  const result = difference(a.value, b.value);
  return {
    value: result.value,
    error: sumUpper([result.error, a.error, b.error]),
  };
}

function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function boundedCross(a: BoundedVector, b: BoundedVector): BoundedVector {
  const products = sumUpper([
    Math.abs(a.value[1] * b.value[2]),
    Math.abs(a.value[2] * b.value[1]),
    Math.abs(a.value[2] * b.value[0]),
    Math.abs(a.value[0] * b.value[2]),
    Math.abs(a.value[0] * b.value[1]),
    Math.abs(a.value[1] * b.value[0]),
  ]);
  return {
    value: cross(a.value, b.value),
    error: sumUpper([
      upper(l1(a.value) * b.error, 1),
      upper(l1(b.value) * a.error, 1),
      upper(a.error * b.error, 1),
      upper(gamma(2) * products, 1),
    ]),
  };
}

function fanArea(outline: readonly BoundedVector[]): BoundedVector {
  const value: [number, number, number] = [0, 0, 0];
  const errors: number[] = [];
  const magnitudes: number[] = [];
  for (let i = 1; i < outline.length - 1; i++) {
    const term = boundedCross(outline[i]!, outline[i + 1]!);
    for (let axis = 0; axis < 3; axis++) value[axis]! += term.value[axis]!;
    errors.push(term.error);
    magnitudes.push(l1(term.value));
  }
  return {
    value,
    error: sumUpper([
      ...errors,
      upper(gamma(magnitudes.length) * sumUpper(magnitudes), 1),
    ]),
  };
}

function dot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function dotError(a: BoundedVector, b: BoundedVector): number {
  return sumUpper([
    upper(l1(a.value) * b.error, 1),
    upper(l1(b.value) * a.error, 1),
    upper(a.error * b.error, 1),
    upper(
      gamma(3) *
        sumUpper(a.value.map((v, axis) => Math.abs(v * b.value[axis]!))),
      1,
    ),
  ]);
}

function positiveDot(a: BoundedVector, b: BoundedVector): boolean {
  const value = dot(a.value, b.value);
  const error = dotError(a, b);
  return Number.isFinite(value) && Number.isFinite(error) && value > error;
}
