import { describe, expect, it } from "vitest";
import {
  cartesianFromCylindrical,
  cartesianFromSpherical,
  cylindricalFromCartesian,
  sphericalFromCartesian,
  vec3,
  type Vec3Like,
} from "@aperture-engine/math";

const CLOSE_TO = 5;
const HALF_PI = Math.PI / 2;

describe("spherical coordinates (orbit-camera convention)", () => {
  it("places azimuth zero on +Z, increasing toward +X", () => {
    // Matches createOrbitCameraController: azimuth 0 puts the eye on +Z.
    expectVec3(sphericalFromCartesian([0, 0, 5]), [5, 0, 0]);
    expectVec3(sphericalFromCartesian([5, 0, 0]), [5, HALF_PI, 0]);
    expectVec3(sphericalFromCartesian([0, 0, -5]), [5, Math.PI, 0]);
    expectVec3(sphericalFromCartesian([-5, 0, 0]), [5, -HALF_PI, 0]);

    expectVec3(cartesianFromSpherical(2, 0, 0), [0, 0, 2]);
    expectVec3(cartesianFromSpherical(2, HALF_PI, 0), [2, 0, 0]);
  });

  it("measures elevation as latitude above the XZ horizon", () => {
    expectVec3(sphericalFromCartesian([0, 5, 0]), [5, 0, HALF_PI]);
    expectVec3(sphericalFromCartesian([0, -2, 0]), [2, 0, -HALF_PI]);
    expectVec3(sphericalFromCartesian([3, 4, 0]), [
      5,
      HALF_PI,
      Math.asin(4 / 5),
    ]);
    expectVec3(cartesianFromSpherical(2, 0, HALF_PI), [0, 2, 0]);
  });

  it("maps the zero vector to all-zero coordinates", () => {
    expectVec3(sphericalFromCartesian([0, 0, 0]), [0, 0, 0]);
    expectVec3(cartesianFromSpherical(0, 1.2, -0.4), [0, 0, 0]);
  });

  it("round-trips over a grid of radii and angles", () => {
    for (const radius of [0.25, 1, 9]) {
      for (let azimuthStep = -3; azimuthStep <= 3; azimuthStep += 1) {
        for (let elevationStep = -4; elevationStep <= 4; elevationStep += 1) {
          const azimuth = azimuthStep * 1.01; // stays inside (-pi, pi]
          const elevation = elevationStep * 0.37; // stays inside (-pi/2, pi/2)
          const cartesian = cartesianFromSpherical(radius, azimuth, elevation);
          const spherical = sphericalFromCartesian(cartesian);

          expect(spherical[0]).toBeCloseTo(radius, CLOSE_TO);
          expect(spherical[1]).toBeCloseTo(azimuth, CLOSE_TO);
          expect(spherical[2]).toBeCloseTo(elevation, CLOSE_TO);

          const back = cartesianFromSpherical(
            spherical[0]!,
            spherical[1]!,
            spherical[2]!,
          );
          expectVec3(back, cartesian);
        }
      }
    }
  });

  it("preserves destinations and rejects non-finite inputs", () => {
    const out = vec3();
    expect(sphericalFromCartesian([0, 0, 5], out)).toBe(out);
    expect(cartesianFromSpherical(1, 0, 0, out)).toBe(out);

    expect(() => cartesianFromSpherical(Number.NaN, 0, 0)).toThrow(RangeError);
    expect(() =>
      cartesianFromSpherical(1, Number.POSITIVE_INFINITY, 0),
    ).toThrow(RangeError);
    expect(() => cartesianFromSpherical(1, 0, Number.NaN)).toThrow(RangeError);
  });
});

describe("cylindrical coordinates", () => {
  it("measures radius from the Y axis and passes height through", () => {
    expectVec3(cylindricalFromCartesian([3, 4, 0]), [3, HALF_PI, 4]);
    expectVec3(cylindricalFromCartesian([0, 2, 5]), [5, 0, 2]);
    expectVec3(cylindricalFromCartesian([0, 7, 0]), [0, 0, 7]);

    expectVec3(cartesianFromCylindrical(3, HALF_PI, 4), [3, 4, 0]);
    expectVec3(cartesianFromCylindrical(5, 0, 2), [0, 2, 5]);
  });

  it("round-trips over a grid of radii, angles, and heights", () => {
    for (const radius of [0.25, 1, 9]) {
      for (let azimuthStep = -3; azimuthStep <= 3; azimuthStep += 1) {
        for (const y of [-4, 0, 2.5]) {
          const azimuth = azimuthStep * 1.01;
          const cartesian = cartesianFromCylindrical(radius, azimuth, y);
          const cylindrical = cylindricalFromCartesian(cartesian);

          expect(cylindrical[0]).toBeCloseTo(radius, CLOSE_TO);
          expect(cylindrical[1]).toBeCloseTo(azimuth, CLOSE_TO);
          expect(cylindrical[2]).toBeCloseTo(y, CLOSE_TO);
        }
      }
    }
  });

  it("preserves destinations and rejects non-finite inputs", () => {
    const out = vec3();
    expect(cylindricalFromCartesian([1, 2, 3], out)).toBe(out);
    expect(cartesianFromCylindrical(1, 0, 0, out)).toBe(out);

    expect(() => cartesianFromCylindrical(Number.NaN, 0, 0)).toThrow(
      RangeError,
    );
    expect(() => cartesianFromCylindrical(1, 0, Number.NaN)).toThrow(
      RangeError,
    );
  });
});

function expectVec3(actual: Vec3Like, expected: Vec3Like): void {
  for (let axis = 0; axis < 3; axis += 1) {
    expect(actual[axis]).toBeCloseTo(Number(expected[axis]), CLOSE_TO);
  }
}
