import { describe, expect, it } from "vitest";
import {
  lineClosestPoint,
  lineClosestPointParameter,
  lineDelta,
  lineDistanceSq,
  segmentClosestPoints,
  vec3,
  type Vec3Like,
} from "@aperture-engine/math";

const CLOSE_TO = 5;

describe("segment delta and closest-point parameter", () => {
  it("computes end minus start and preserves destinations", () => {
    const out = vec3();
    expect(lineDelta([1, 2, 3], [4, 6, 8], out)).toBe(out);
    expectVec3(out, [3, 4, 5]);
  });

  it("allows out to alias an input", () => {
    const start = vec3(1, 2, 3);
    expectVec3(lineDelta(start, [4, 6, 8], start), [3, 4, 5]);
  });

  it("clamps the parameter to [0, 1]", () => {
    const start = [0, 0, 0] as const;
    const end = [4, 0, 0] as const;

    expect(lineClosestPointParameter([1, 7, -2], start, end)).toBeCloseTo(
      0.25,
      CLOSE_TO,
    );
    expect(lineClosestPointParameter([-3, 1, 0], start, end)).toBe(0);
    expect(lineClosestPointParameter([9, -1, 0], start, end)).toBe(1);
  });

  it("yields t = 0 for zero-length segments", () => {
    expect(lineClosestPointParameter([5, 5, 5], [1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe("segment closest point and distance", () => {
  it("projects onto the segment and clamps at the endpoints", () => {
    const start = [0, 0, 0] as const;
    const end = [4, 0, 0] as const;

    expectVec3(lineClosestPoint([1, 7, -2], start, end), [1, 0, 0]);
    expectVec3(lineClosestPoint([-3, 1, 0], start, end), [0, 0, 0]);
    expectVec3(lineClosestPoint([9, -1, 0], start, end), [4, 0, 0]);
    expectVec3(lineClosestPoint([9, 9, 9], [1, 2, 3], [1, 2, 3]), [1, 2, 3]);
  });

  it("allows out to alias the query point", () => {
    const point = vec3(1, 7, -2);
    expectVec3(lineClosestPoint(point, [0, 0, 0], [4, 0, 0], point), [1, 0, 0]);
  });

  it("measures squared distance to the clamped closest point", () => {
    const start = [0, 0, 0] as const;
    const end = [4, 0, 0] as const;

    expect(lineDistanceSq([2, 3, 0], start, end)).toBeCloseTo(9, CLOSE_TO);
    // Beyond the end: distance to the endpoint, not the infinite line.
    expect(lineDistanceSq([7, 4, 0], start, end)).toBeCloseTo(25, CLOSE_TO);
    expect(lineDistanceSq([5, 5, 5], [1, 2, 3], [1, 2, 3])).toBeCloseTo(
      29,
      CLOSE_TO,
    );
  });
});

describe("segment-segment closest points", () => {
  it("finds the crossing points of skew perpendicular segments", () => {
    const outA = vec3();
    const outB = vec3();
    const distanceSq = segmentClosestPoints(
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 1],
      [0, 1, 1],
      outA,
      outB,
    );

    expect(distanceSq).toBeCloseTo(1, CLOSE_TO);
    expectVec3(outA, [0, 0, 0]);
    expectVec3(outB, [0, 0, 1]);
  });

  it("clamps both parameters for separated collinear segments", () => {
    const outA = vec3();
    const outB = vec3();
    const distanceSq = segmentClosestPoints(
      [0, 0, 0],
      [1, 0, 0],
      [3, 0, 0],
      [4, 0, 0],
      outA,
      outB,
    );

    expect(distanceSq).toBeCloseTo(4, CLOSE_TO);
    expectVec3(outA, [1, 0, 0]);
    expectVec3(outB, [3, 0, 0]);
  });

  it("handles parallel segments (one valid pair among many)", () => {
    const outA = vec3();
    const outB = vec3();
    const distanceSq = segmentClosestPoints(
      [0, 0, 0],
      [2, 0, 0],
      [1, 1, 0],
      [3, 1, 0],
      outA,
      outB,
    );

    expect(distanceSq).toBeCloseTo(1, CLOSE_TO);
    // Whatever pair was chosen, it must realize the returned distance and lie
    // vertically opposed within the overlap.
    expect(outA[1]).toBeCloseTo(0, CLOSE_TO);
    expect(outB[1]).toBeCloseTo(1, CLOSE_TO);
    expect(outA[0]).toBeCloseTo(outB[0]!, CLOSE_TO);
    expect(outA[0]!).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(outA[0]!).toBeLessThanOrEqual(2 + 1e-6);
  });

  it("degrades to point queries for zero-length segments", () => {
    const outA = vec3();
    const outB = vec3();

    // Both degenerate: plain point-point distance.
    expect(
      segmentClosestPoints(
        [1, 2, 3],
        [1, 2, 3],
        [4, 6, 3],
        [4, 6, 3],
        outA,
        outB,
      ),
    ).toBeCloseTo(25, CLOSE_TO);
    expectVec3(outA, [1, 2, 3]);
    expectVec3(outB, [4, 6, 3]);

    // First degenerate: point-segment projection.
    expect(
      segmentClosestPoints(
        [2, 3, 0],
        [2, 3, 0],
        [0, 0, 0],
        [4, 0, 0],
        outA,
        outB,
      ),
    ).toBeCloseTo(9, CLOSE_TO);
    expectVec3(outA, [2, 3, 0]);
    expectVec3(outB, [2, 0, 0]);

    // Second degenerate: segment-point projection.
    expect(
      segmentClosestPoints(
        [0, 0, 0],
        [4, 0, 0],
        [2, 3, 0],
        [2, 3, 0],
        outA,
        outB,
      ),
    ).toBeCloseTo(9, CLOSE_TO);
    expectVec3(outA, [2, 0, 0]);
    expectVec3(outB, [2, 3, 0]);
  });

  it("returns the squared distance realized by the out points", () => {
    const outA = vec3();
    const outB = vec3();
    const distanceSq = segmentClosestPoints(
      [-2, 1, 4],
      [3, -1, 2],
      [0, 5, -3],
      [1, 2, 6],
      outA,
      outB,
    );
    const dx = outA[0]! - outB[0]!;
    const dy = outA[1]! - outB[1]!;
    const dz = outA[2]! - outB[2]!;

    expect(distanceSq).toBeCloseTo(dx * dx + dy * dy + dz * dz, CLOSE_TO);
  });

  it("allows out params to alias the inputs", () => {
    const p1 = vec3(-1, 0, 0);
    const p2 = vec3(0, -1, 1);
    const distanceSq = segmentClosestPoints(
      p1,
      [1, 0, 0],
      p2,
      [0, 1, 1],
      p1,
      p2,
    );

    expect(distanceSq).toBeCloseTo(1, CLOSE_TO);
    expectVec3(p1, [0, 0, 0]);
    expectVec3(p2, [0, 0, 1]);
  });
});

function expectVec3(actual: Vec3Like, expected: Vec3Like): void {
  for (let axis = 0; axis < 3; axis += 1) {
    expect(actual[axis]).toBeCloseTo(Number(expected[axis]), CLOSE_TO);
  }
}
