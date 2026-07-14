import { describe, expect, it } from "vitest";
import {
  arcCurve,
  catmullRomCurve,
  cubicBezierCurve,
  getCurveLength,
  getCurvePoint,
  getCurveTangent,
  lineCurve,
  quadraticBezierCurve,
  vec3,
  type Curve,
  type Vec3Like,
} from "@aperture-engine/math";

const CLOSE_TO = 5;

describe("curve primitives — endpoints and points", () => {
  it("evaluates a line segment at its endpoints and midpoint", () => {
    const curve = lineCurve([1, 2, 3], [4, 6, 3]);

    expectVec3(getCurvePoint(curve, 0), [1, 2, 3]);
    expectVec3(getCurvePoint(curve, 1), [4, 6, 3]);
    expectVec3(getCurvePoint(curve, 0.5), [2.5, 4, 3]);
  });

  it("hits the first and last control point of a quadratic Bézier", () => {
    const curve = quadraticBezierCurve([0, 0, 0], [1, 2, 0], [2, 0, 0]);

    expectVec3(getCurvePoint(curve, 0), [0, 0, 0]);
    expectVec3(getCurvePoint(curve, 1), [2, 0, 0]);
    // Apex at t=0.5: (p0 + 2*p1 + p2) / 4.
    expectVec3(getCurvePoint(curve, 0.5), [1, 1, 0]);
  });

  it("hits the first and last control point of a cubic Bézier", () => {
    const curve = cubicBezierCurve([0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]);

    expectVec3(getCurvePoint(curve, 0), [0, 0, 0]);
    expectVec3(getCurvePoint(curve, 1), [1, 0, 0]);
    expectVec3(getCurvePoint(curve, 0.5), [0.5, 0.75, 0]);
  });

  it("passes a Catmull-Rom spline through its control points", () => {
    const points: Vec3Like[] = [
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 0],
      [3, 1, 0],
    ];
    const curve = catmullRomCurve(points);

    expectVec3(getCurvePoint(curve, 0), [0, 0, 0]);
    expectVec3(getCurvePoint(curve, 1), [3, 1, 0]);
    // Interior control points sit at the uniform segment boundaries.
    expectVec3(getCurvePoint(curve, 1 / 3), [1, 1, 0]);
    expectVec3(getCurvePoint(curve, 2 / 3), [2, 0, 0]);
  });

  it("wraps a closed Catmull-Rom spline back to its start", () => {
    const curve = catmullRomCurve(
      [
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ],
      { closed: true },
    );

    expectVec3(getCurvePoint(curve, 0), [0, 0, 0]);
    expectVec3(getCurvePoint(curve, 1), [0, 0, 0]);
    expectVec3(getCurvePoint(curve, 0.25), [2, 0, 0]);
  });

  it("places a circular arc on its radius", () => {
    const curve = arcCurve({ xRadius: 2 });

    expectVec3(getCurvePoint(curve, 0), [2, 0, 0]);
    expectVec3(getCurvePoint(curve, 0.25), [0, 2, 0]);
    expectVec3(getCurvePoint(curve, 0.5), [-2, 0, 0]);
    expectVec3(getCurvePoint(curve, 0.75), [0, -2, 0]);
  });
});

describe("curve primitives — tangents", () => {
  it("returns a unit tangent along a line", () => {
    const curve = lineCurve([0, 0, 0], [3, 4, 0]);
    const tangent = getCurveTangent(curve, 0.5);

    expectVec3(tangent, [0.6, 0.8, 0]);
    expectUnit(tangent);
  });

  it("returns unit tangents perpendicular to a circle's radius", () => {
    const curve = arcCurve({ xRadius: 1 });

    for (const t of [0, 0.1, 0.37, 0.75]) {
      const point = getCurvePoint(curve, t);
      const tangent = getCurveTangent(curve, t);

      expectUnit(tangent);
      // Tangent is orthogonal to the (centered) radius vector.
      expect(
        point[0] * tangent[0] + point[1] * tangent[1] + point[2] * tangent[2],
      ).toBeCloseTo(0, CLOSE_TO);
    }

    // A CCW arc's tangent at t=0 points +Y.
    expectVec3(getCurveTangent(curve, 0), [0, 1, 0]);
  });

  it("returns unit tangents along Bézier and Catmull-Rom curves", () => {
    const curves: Curve[] = [
      quadraticBezierCurve([0, 0, 0], [1, 3, 0], [2, 0, 1]),
      cubicBezierCurve([0, 0, 0], [0, 1, 1], [1, 1, 0], [2, 0, -1]),
      catmullRomCurve([
        [0, 0, 0],
        [1, 2, 0],
        [3, -1, 1],
        [4, 0, 0],
      ]),
    ];

    for (const curve of curves) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expectUnit(getCurveTangent(curve, t));
      }
    }
  });
});

describe("curve primitives — arc length", () => {
  it("measures a straight line as the distance between its endpoints", () => {
    expect(getCurveLength(lineCurve([0, 0, 0], [3, 4, 0]))).toBeCloseTo(5, 10);
  });

  it("measures a full circle as 2*PI*r within subdivision tolerance", () => {
    expect(getCurveLength(arcCurve({ xRadius: 2 }))).toBeCloseTo(
      2 * Math.PI * 2,
      2,
    );
    expect(getCurveLength(arcCurve({ xRadius: 1 }))).toBeCloseTo(
      2 * Math.PI,
      2,
    );
  });

  it("measures an elliptical arc's length numerically", () => {
    // Quarter ellipse a=3, b=1: analytic length ~= 3.34122 (fine-grid
    // reference); the 200-segment sum lands on it to 4 decimals.
    const curve = arcCurve({
      xRadius: 3,
      yRadius: 1,
      startAngle: 0,
      endAngle: Math.PI / 2,
    });

    expect(getCurveLength(curve)).toBeCloseTo(3.3412, 2);
  });

  it("collapses a collinear cubic Bézier onto its chord (degenerate line)", () => {
    // Evenly spaced collinear control points make the cubic trace the line at
    // constant speed, so it equals lineCurve([0,0,0],[3,0,0]).
    const bezier = cubicBezierCurve([0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]);
    const line = lineCurve([0, 0, 0], [3, 0, 0]);

    for (const t of [0, 0.2, 0.5, 0.9, 1]) {
      expectVec3(getCurvePoint(bezier, t), getCurvePoint(line, t));
    }

    expect(getCurveLength(bezier)).toBeCloseTo(3, 6);
  });
});

describe("curve primitives — determinism and out aliasing", () => {
  it("produces byte-identical outputs for identical inputs", () => {
    const build = (): Curve =>
      catmullRomCurve(
        [
          [0, 0, 0],
          [1, 2, 0.5],
          [3, -1, 1],
          [4, 0, 0],
        ],
        { alpha: 0.5 },
      );

    for (const t of [0, 0.3, 0.6, 1]) {
      expect(Array.from(getCurvePoint(build(), t))).toEqual(
        Array.from(getCurvePoint(build(), t)),
      );
      expect(Array.from(getCurveTangent(build(), t))).toEqual(
        Array.from(getCurveTangent(build(), t)),
      );
    }

    expect(getCurveLength(build())).toBe(getCurveLength(build()));
  });

  it("returns the provided out and is safe to reuse across calls", () => {
    const curve = cubicBezierCurve([0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]);
    const out = vec3();

    // The out already holds a previous result before the next evaluation: the
    // evaluator reads all control points into locals before writing, so a
    // pre-populated (aliased) destination yields the same values as a fresh one.
    expect(getCurvePoint(curve, 0.25, out)).toBe(out);
    const reused = getCurvePoint(curve, 0.75, out);
    const fresh = getCurvePoint(curve, 0.75);

    expect(Array.from(reused)).toEqual(Array.from(fresh));

    const tangentOut = getCurveTangent(curve, 0.5, out);
    expect(tangentOut).toBe(out);
    expectUnit(tangentOut);
  });
});

function expectVec3(actual: Vec3Like, expected: Vec3Like): void {
  for (let axis = 0; axis < 3; axis += 1) {
    expect(actual[axis]).toBeCloseTo(Number(expected[axis]), CLOSE_TO);
  }
}

function expectUnit(actual: Vec3Like): void {
  expect(
    Math.hypot(Number(actual[0]), Number(actual[1]), Number(actual[2])),
  ).toBeCloseTo(1, CLOSE_TO);
}
