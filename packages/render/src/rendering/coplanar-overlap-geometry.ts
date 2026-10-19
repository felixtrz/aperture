import type { CoplanarOverlapTolerances } from "./coplanar-overlap-types.js";

export type Point3 = readonly [number, number, number];
type Point2 = readonly [number, number];
export interface InspectionTriangle {
  readonly points: readonly [Point3, Point3, Point3];
  readonly offset: number;
  readonly normal: Point3;
  readonly extent: number;
  readonly min: Point3;
  readonly max: Point3;
  /** Conservative Number error from forming translated world coordinates. */
  readonly precision: number;
  readonly altitude: number;
}

export function subtract(a: Point3, b: Point3): Point3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: Point3, b: Point3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function inspectionTriangle(
  points: readonly [Point3, Point3, Point3],
  offset: number,
  transformPrecision = 0,
): InspectionTriangle | null {
  const u = subtract(points[1], points[0]),
    v = subtract(points[2], points[0]);
  const cross: Point3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...cross);
  const extent = Math.max(
    Math.hypot(...u),
    Math.hypot(...v),
    Math.hypot(...subtract(points[2], points[1])),
  );
  if (
    !Number.isFinite(length) ||
    !Number.isFinite(extent) ||
    length <= 128 * Number.EPSILON * extent * extent
  )
    return null;
  return {
    points,
    offset,
    extent,
    altitude: length / extent,
    precision: Math.max(
      transformPrecision,
      Math.max(...points.flat().map(Math.abs)) * Number.EPSILON * 16,
    ),
    normal: cross.map((n) => n / length) as unknown as Point3,
    min: [0, 1, 2].map((axis) =>
      Math.min(...points.map((p) => p[axis]!)),
    ) as unknown as Point3,
    max: [0, 1, 2].map((axis) =>
      Math.max(...points.map((p) => p[axis]!)),
    ) as unknown as Point3,
  };
}

export function boundsOverlap(
  a: { min: Point3; max: Point3 },
  b: { min: Point3; max: Point3 },
  margin: number,
): boolean {
  return [0, 1, 2].every(
    (axis) =>
      a.min[axis]! <= b.max[axis]! + margin &&
      b.min[axis]! <= a.max[axis]! + margin,
  );
}

function orient(a: Point2, b: Point2, p: Point2): number {
  const left = (b[0] - a[0]) * (p[1] - a[1]);
  const right = (b[1] - a[1]) * (p[0] - a[0]);
  const result = left - right;
  return Math.abs(result) <=
    (Math.abs(left) + Math.abs(right)) * Number.EPSILON * 16
    ? 0
    : result;
}

// Convex clipping uses numerical boundary error only, never the plane-distance
// tolerance: inflating half-planes would manufacture area along shared edges.
function clip(subject: Point2[], clipper: Point2[]): Point2[] {
  let polygon = subject;
  for (let i = 0; i < 3 && polygon.length > 0; i++) {
    const a = clipper[i]!,
      b = clipper[(i + 1) % 3]!;
    const next: Point2[] = [];
    let previous = polygon[polygon.length - 1]!,
      pd = orient(a, b, previous);
    for (const current of polygon) {
      const cd = orient(a, b, current);
      if ((pd < 0 && cd > 0) || (pd > 0 && cd < 0)) {
        const t = pd / (pd - cd);
        next.push([
          previous[0] + t * (current[0] - previous[0]),
          previous[1] + t * (current[1] - previous[1]),
        ]);
      }
      if (cd >= 0) next.push(current);
      previous = current;
      pd = cd;
    }
    polygon = next;
  }
  return polygon;
}

export function triangleOverlap(
  a: InspectionTriangle,
  b: InspectionTriangle,
  tolerance: Required<CoplanarOverlapTolerances>,
):
  | {
      readonly area: number;
      readonly distanceTolerance: number;
      readonly maxPlaneSeparation: number;
      readonly normalDot: number;
      readonly polygonWorld: readonly Point3[];
    }
  | "precision"
  | null {
  const extent = Math.max(a.extent, b.extent);
  const distanceTolerance = Math.max(
    tolerance.distance,
    tolerance.relativeDistance * extent,
  );
  if (!Number.isFinite(distanceTolerance)) return "precision";
  const normalUncertainty =
    Math.max(a.precision / a.altitude, b.precision / b.altitude) * 8;
  // Check conditioning before uncertain normals or distances can reject a pair.
  // Independent of the user distance tolerance: permissive plane distances
  // must not conceal uncertain normals or unresolved narrow intersections.
  if (
    Math.max(a.precision, b.precision) > extent * 1e-10 ||
    normalUncertainty > Math.max(tolerance.angleRadians * 0.01, 1e-7)
  )
    return "precision";
  const normalDot = Math.max(-1, Math.min(1, dot(a.normal, b.normal)));
  // atan2 retains small angles which dot/acos would round to zero.
  const normalCross = Math.hypot(
    a.normal[1] * b.normal[2] - a.normal[2] * b.normal[1],
    a.normal[2] * b.normal[0] - a.normal[0] * b.normal[2],
    a.normal[0] * b.normal[1] - a.normal[1] * b.normal[0],
  );
  const angle = Math.atan2(normalCross, Math.abs(normalDot));
  if (angle > tolerance.angleRadians)
    return angle - tolerance.angleRadians <= normalUncertainty
      ? "precision"
      : null;
  const maxPlaneSeparation = Math.max(
    ...b.points.map((p) => Math.abs(dot(subtract(p, a.points[0]), a.normal))),
    ...a.points.map((p) => Math.abs(dot(subtract(p, b.points[0]), b.normal))),
  );
  if (maxPlaneSeparation > distanceTolerance)
    return maxPlaneSeparation - distanceTolerance <=
      (a.precision + b.precision) * 4 + normalUncertainty * extent
      ? "precision"
      : null;
  let axis = 0;
  for (let i = 1; i < 3; i++)
    if (Math.abs(a.normal[i]!) > Math.abs(a.normal[axis]!)) axis = i;
  const u = (axis + 1) % 3,
    v = (axis + 2) % 3,
    origin = a.points[0];
  const project = (points: readonly Point3[]): Point2[] => {
    const result = points.map(
      (p): Point2 => [p[u]! - origin[u]!, p[v]! - origin[v]!],
    );
    if (orient(result[0]!, result[1]!, result[2]!) < 0) result.reverse();
    return result;
  };
  const polygon = clip(project(a.points), project(b.points));
  if (polygon.length < 3) return null;
  const first = polygon[0]!;
  let twiceArea = 0;
  for (let i = 1; i + 1 < polygon.length; i++) {
    const p = polygon[i]!,
      q = polygon[i + 1]!;
    twiceArea +=
      (p[0] - first[0]) * (q[1] - first[1]) -
      (p[1] - first[1]) * (q[0] - first[0]);
  }
  const area = Math.abs(twiceArea) / (2 * Math.abs(a.normal[axis]!));
  if (area === 0) return null;
  if (area <= 128 * Number.EPSILON * extent * extent) return "precision";
  if (area <= tolerance.minArea) return null;
  const polygonWorld = polygon.map((p): Point3 => {
    const result = [0, 0, 0];
    result[u] = p[0];
    result[v] = p[1];
    result[axis] =
      -(a.normal[u]! * p[0] + a.normal[v]! * p[1]) / a.normal[axis]!;
    return [
      result[0]! + origin[0],
      result[1]! + origin[1],
      result[2]! + origin[2],
    ];
  });
  return {
    area,
    distanceTolerance,
    maxPlaneSeparation,
    normalDot,
    polygonWorld,
  };
}
