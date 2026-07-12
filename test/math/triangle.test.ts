import { describe, expect, it } from "vitest";
import {
  triangleArea,
  triangleBarycentric,
  triangleCentroid,
  triangleClosestPoint,
  triangleContainsPoint,
  triangleNormal,
  vec3,
  type Vec3Like,
} from "@aperture-engine/math";

const CLOSE_TO = 5;

// Canonical right triangle in the XY plane used across the region tests.
const A = [0, 0, 0] as const;
const B = [4, 0, 0] as const;
const C = [0, 4, 0] as const;

describe("triangle area, normal, centroid", () => {
  it("computes the area of hand-checked triangles", () => {
    expect(triangleArea([0, 0, 0], [2, 0, 0], [0, 3, 0])).toBeCloseTo(
      3,
      CLOSE_TO,
    );
    expect(triangleArea(A, B, C)).toBeCloseTo(8, CLOSE_TO);
    // Winding does not affect area.
    expect(triangleArea(A, C, B)).toBeCloseTo(8, CLOSE_TO);
  });

  it("returns zero area for degenerate triangles", () => {
    expect(triangleArea([0, 0, 0], [1, 1, 1], [2, 2, 2])).toBe(0);
    expect(triangleArea([3, 2, 1], [3, 2, 1], [3, 2, 1])).toBe(0);
  });

  it("computes counter-clockwise unit normals", () => {
    expectVec3(triangleNormal(A, B, C), [0, 0, 1]);
    // Flipped winding flips the normal.
    expectVec3(triangleNormal(A, C, B), [0, 0, -1]);
    // Normalized even for large, non-axis-aligned triangles.
    const normal = triangleNormal([1, 0, 0], [0, 30, 0], [0, 0, 50]);
    expect(Math.hypot(normal[0]!, normal[1]!, normal[2]!)).toBeCloseTo(
      1,
      CLOSE_TO,
    );
  });

  it("yields the zero vector for degenerate-triangle normals", () => {
    expectVec3(triangleNormal([0, 0, 0], [1, 1, 1], [2, 2, 2]), [0, 0, 0]);
  });

  it("computes centroids and preserves destinations", () => {
    const out = vec3();
    expect(triangleCentroid([0, 0, 0], [3, 0, 0], [0, 3, 3], out)).toBe(out);
    expectVec3(out, [1, 1, 1]);
  });

  it("allows out to alias an input", () => {
    const a = vec3(0, 0, 0);
    expectVec3(triangleCentroid(a, [3, 0, 0], [0, 3, 3], a), [1, 1, 1]);

    const b = vec3(4, 0, 0);
    expectVec3(triangleNormal([0, 0, 0], b, [0, 4, 0], b), [0, 0, 1]);
  });
});

describe("triangle barycentric coordinates", () => {
  it("recovers vertices, edge midpoints, and the centroid", () => {
    expectVec3(triangleBarycentric(A, A, B, C)!, [1, 0, 0]);
    expectVec3(triangleBarycentric(B, A, B, C)!, [0, 1, 0]);
    expectVec3(triangleBarycentric(C, A, B, C)!, [0, 0, 1]);
    expectVec3(triangleBarycentric([2, 0, 0], A, B, C)!, [0.5, 0.5, 0]);
    expectVec3(triangleBarycentric(triangleCentroid(A, B, C), A, B, C)!, [
      1 / 3,
      1 / 3,
      1 / 3,
    ]);
  });

  it("projects off-plane points onto the triangle plane", () => {
    const onPlane = triangleBarycentric([1, 1, 0], A, B, C);
    const offPlane = triangleBarycentric([1, 1, 9], A, B, C);
    expect(onPlane).not.toBeNull();
    expect(offPlane).not.toBeNull();
    expectVec3(offPlane!, [
      onPlane![0]!,
      onPlane![1]!,
      onPlane![2]!,
    ] as Vec3Like);
  });

  it("sums to one and reconstructs in-plane points", () => {
    const a = [0.5, -1, 2] as const;
    const b = [3, 0.25, -1] as const;
    const c = [-2, 4, 0.5] as const;
    const point = [0.6, 0.9, 0.4] as const;
    const weights = triangleBarycentric(point, a, b, c);

    expect(weights).not.toBeNull();
    const [u, v, w] = [weights![0]!, weights![1]!, weights![2]!];
    expect(u + v + w).toBeCloseTo(1, CLOSE_TO);

    // Reconstruction lands on the projection of `point`; for a point built on
    // the plane the reconstruction is the point itself.
    const inPlane = [
      u * a[0] + v * b[0] + w * c[0],
      u * a[1] + v * b[1] + w * c[1],
      u * a[2] + v * b[2] + w * c[2],
    ] as const;
    const again = triangleBarycentric(inPlane, a, b, c);
    expectVec3(again!, [u, v, w] as Vec3Like);
  });

  it("returns null for degenerate triangles and leaves out untouched", () => {
    const out = vec3(7, 8, 9);
    expect(
      triangleBarycentric([1, 0, 0], [0, 0, 0], [1, 1, 1], [2, 2, 2], out),
    ).toBeNull();
    expect(
      triangleBarycentric([1, 0, 0], [3, 3, 3], [3, 3, 3], [3, 3, 3], out),
    ).toBeNull();
    expectVec3(out, [7, 8, 9]);
  });

  it("does not misclassify small but well-conditioned triangles", () => {
    // cm-scale content: an absolute area threshold would reject this.
    const scale = 0.01;
    const weights = triangleBarycentric(
      [scale / 3, scale / 3, 0],
      [0, 0, 0],
      [scale, 0, 0],
      [0, scale, 0],
    );
    expect(weights).not.toBeNull();
    expectVec3(weights!, [1 / 3, 1 / 3, 1 / 3]);
  });
});

describe("triangle closest point", () => {
  it("projects interior points onto the face", () => {
    expectVec3(triangleClosestPoint([1, 1, 5], A, B, C), [1, 1, 0]);
    expectVec3(triangleClosestPoint([1, 1, -5], A, B, C), [1, 1, 0]);
  });

  it("clamps to each vertex region", () => {
    expectVec3(triangleClosestPoint([-1, -1, 2], A, B, C), [0, 0, 0]);
    expectVec3(triangleClosestPoint([6, -1, -2], A, B, C), [4, 0, 0]);
    expectVec3(triangleClosestPoint([-1, 6, 2], A, B, C), [0, 4, 0]);
  });

  it("clamps to each edge region", () => {
    expectVec3(triangleClosestPoint([2, -3, 1], A, B, C), [2, 0, 0]);
    expectVec3(triangleClosestPoint([-2, 2, 0], A, B, C), [0, 2, 0]);
    expectVec3(triangleClosestPoint([4, 4, 0], A, B, C), [2, 2, 0]);
  });

  it("falls back to the boundary for degenerate triangles", () => {
    // Collinear "triangle": behaves like the segment (0,0,0)-(2,0,0).
    expectVec3(
      triangleClosestPoint([0.5, 1, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]),
      [0.5, 0, 0],
    );
    expectVec3(
      triangleClosestPoint([5, 1, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]),
      [2, 0, 0],
    );
    // Fully collapsed triangle: the shared vertex.
    expectVec3(
      triangleClosestPoint([9, 9, 9], [3, 2, 1], [3, 2, 1], [3, 2, 1]),
      [3, 2, 1],
    );
  });

  it("preserves destinations and allows out to alias the query point", () => {
    const out = vec3();
    expect(triangleClosestPoint([1, 1, 5], A, B, C, out)).toBe(out);
    expectVec3(out, [1, 1, 0]);

    const point = vec3(2, -3, 1);
    expectVec3(triangleClosestPoint(point, A, B, C, point), [2, 0, 0]);
  });
});

describe("triangle contains point", () => {
  it("accepts interior, vertex, and edge points", () => {
    expect(triangleContainsPoint([1, 1, 0], A, B, C)).toBe(true);
    expect(triangleContainsPoint(A, A, B, C)).toBe(true);
    expect(triangleContainsPoint([2, 0, 0], A, B, C)).toBe(true);
    expect(triangleContainsPoint([2, 2, 0], A, B, C)).toBe(true);
  });

  it("rejects coplanar points outside the triangle", () => {
    expect(triangleContainsPoint([-0.1, 1, 0], A, B, C)).toBe(false);
    expect(triangleContainsPoint([3, 3, 0], A, B, C)).toBe(false);
  });

  it("applies the epsilon to the plane distance", () => {
    expect(triangleContainsPoint([1, 1, 0.5], A, B, C)).toBe(false);
    expect(triangleContainsPoint([1, 1, 0.5], A, B, C, 0.6)).toBe(true);
    expect(triangleContainsPoint([1, 1, 1e-8], A, B, C)).toBe(true);
  });

  it("returns false for degenerate triangles", () => {
    expect(
      triangleContainsPoint([1, 0, 0], [0, 0, 0], [1, 1, 1], [2, 2, 2]),
    ).toBe(false);
  });
});

function expectVec3(actual: Vec3Like, expected: Vec3Like): void {
  for (let axis = 0; axis < 3; axis += 1) {
    expect(actual[axis]).toBeCloseTo(Number(expected[axis]), CLOSE_TO);
  }
}
