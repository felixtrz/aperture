import type { TriangleListPosition as Point } from "./triangle-list-types.js";

export const dot = (a: Point, b: Point): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const subtract = (a: Point, b: Point): Point => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export function unit(p: Point, field: string): Point {
  const length = Math.hypot(...p);
  if (!Number.isFinite(length) || length < 1e-12)
    throw new Error(`${field} must define a nonzero finite direction.`);
  return [p[0] / length, p[1] / length, p[2] / length];
}
export function readPoint(p: Point, field: string): Point {
  if (
    !Array.isArray(p) ||
    p.length !== 3 ||
    p.some((v) => typeof v !== "number" || !Number.isFinite(Math.fround(v)))
  )
    throw new Error(`${field} must be a finite float32 [x, y, z] tuple.`);
  return [Math.fround(p[0]), Math.fround(p[1]), Math.fround(p[2])];
}
/** Orthonormal basis: profile +Y follows projected up; +Z follows direction. */
export function profileFrame(
  direction: Point,
  up?: Point,
): readonly [Point, Point] {
  const reference =
    up === undefined
      ? Math.abs(direction[1]) < 0.99
        ? ([0, 1, 0] as const)
        : ([0, 0, 1] as const)
      : unit(readPoint(up, "up"), "up");
  const right = unit(
    cross(reference, direction),
    "up (must not be parallel to the path)",
  );
  return [right, cross(direction, right)];
}
