import { vec3 } from "./constructors.js";
import { assertFiniteNumber, clamp, v3 } from "./scalars.js";
import type { Vec3, Vec3Like } from "./types.js";

// Spherical and cylindrical coordinate conversions (decision 0007: array
// results, no coordinate classes). Both systems share the engine's orbit
// convention (see `createOrbitCameraController`):
//
//   - `azimuth` (theta) rotates around world +Y, is zero on +Z, and increases
//     toward +X — identical to three.js's `Spherical.theta` / `atan2(x, z)`.
//   - spherical `elevation` (phi) is the latitude above the XZ horizon in
//     `[-pi/2, +pi/2]` (NOT the three.js polar angle measured from +Y;
//     `elevation = pi/2 - polar`).
//
// so `cartesianFromSpherical(distance, azimuth, elevation)` reproduces the
// orbit controller's eye offset exactly:
//
//   x = radius * cos(elevation) * sin(azimuth)
//   y = radius * sin(elevation)
//   z = radius * cos(elevation) * cos(azimuth)

/**
 * Converts a cartesian vector to spherical coordinates, written as
 * `[radius, azimuth, elevation]` (see the module convention above). The zero
 * vector yields `[0, 0, 0]`, and points on the Y axis yield azimuth `0`.
 * Azimuth is in `(-pi, pi]`, elevation in `[-pi/2, pi/2]`.
 */
export function sphericalFromCartesian(
  value: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  const x = v3(value, 0);
  const y = v3(value, 1);
  const z = v3(value, 2);
  const radius = Math.hypot(x, y, z);

  out[0] = radius;
  out[1] = radius === 0 ? 0 : Math.atan2(x, z);
  out[2] = radius === 0 ? 0 : Math.asin(clamp(y / radius, -1, 1));
  return out;
}

/**
 * Converts spherical coordinates (see the module convention above) to a
 * cartesian vector. Angles outside the canonical ranges simply wrap; a
 * negative radius mirrors the point through the origin.
 */
export function cartesianFromSpherical(
  radius: number,
  azimuth: number,
  elevation: number,
  out: Vec3 = vec3(),
): Vec3 {
  assertFiniteNumber(radius, "radius");
  assertFiniteNumber(azimuth, "azimuth");
  assertFiniteNumber(elevation, "elevation");

  const cosElevation = Math.cos(elevation);

  out[0] = radius * cosElevation * Math.sin(azimuth);
  out[1] = radius * Math.sin(elevation);
  out[2] = radius * cosElevation * Math.cos(azimuth);
  return out;
}

/**
 * Converts a cartesian vector to cylindrical coordinates, written as
 * `[radius, azimuth, y]`: distance from the Y axis, azimuth per the module
 * convention above (matching three.js's `Cylindrical.theta`), and the
 * unchanged height. Points on the Y axis yield azimuth `0`.
 */
export function cylindricalFromCartesian(
  value: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  const x = v3(value, 0);
  const y = v3(value, 1);
  const z = v3(value, 2);
  const radius = Math.hypot(x, z);

  out[0] = radius;
  out[1] = radius === 0 ? 0 : Math.atan2(x, z);
  out[2] = y;
  return out;
}

/**
 * Converts cylindrical coordinates (see `cylindricalFromCartesian`) to a
 * cartesian vector: `x = radius * sin(azimuth)`, `z = radius * cos(azimuth)`,
 * `y` passes through unchanged.
 */
export function cartesianFromCylindrical(
  radius: number,
  azimuth: number,
  y: number,
  out: Vec3 = vec3(),
): Vec3 {
  assertFiniteNumber(radius, "radius");
  assertFiniteNumber(azimuth, "azimuth");
  assertFiniteNumber(y, "y");

  out[0] = radius * Math.sin(azimuth);
  out[1] = y;
  out[2] = radius * Math.cos(azimuth);
  return out;
}
