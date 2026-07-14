import { describe, expect, it } from "vitest";
import {
  MIN_GIZMO_SCALE,
  closestPointParamOnAxis,
  guardScale,
  inPlaneRightAxis,
  rayPlaneIntersection,
  scaleFactorFromDelta,
  signedAngleOnPlane,
  snapToIncrement,
} from "@aperture-engine/app";

// H2 (transform gizmo completion): the rotate + scale gizmos factor their
// snapping / swept-angle / closest-point / scale-factor logic into pure numeric
// functions so the tricky math is proved here without a world (the drag routes
// through the interaction frame are proved by the e2e specs).

describe("snapToIncrement (rotate snapAngle / scale snapIncrement)", () => {
  it("quantizes to the nearest multiple", () => {
    expect(snapToIncrement(2.64, 0.5)).toBeCloseTo(2.5, 12);
    expect(snapToIncrement(2.8, 0.5)).toBeCloseTo(3.0, 12);
    expect(snapToIncrement(0.24, 0.1)).toBeCloseTo(0.2, 12);
    expect(snapToIncrement(0.26, 0.1)).toBeCloseTo(0.3, 12);
    // Negative values snap symmetrically.
    expect(snapToIncrement(-0.26, 0.1)).toBeCloseTo(-0.3, 12);
    // An angle in the π/4 bucket collapses to exactly π/4.
    expect(snapToIncrement(0.6, Math.PI / 4)).toBeCloseTo(Math.PI / 4, 12);
    expect(snapToIncrement(0.9, Math.PI / 4)).toBeCloseTo(Math.PI / 4, 12);
  });

  it("is a no-op for a zero / undefined / negative increment", () => {
    expect(snapToIncrement(0.6, 0)).toBe(0.6);
    expect(snapToIncrement(0.6, undefined)).toBe(0.6);
    expect(snapToIncrement(0.6, -1)).toBe(0.6);
    expect(snapToIncrement(0.6, Number.NaN)).toBe(0.6);
  });
});

describe("signedAngleOnPlane (rotate swept angle)", () => {
  it("returns a right-handed signed angle about the axis", () => {
    // +X onto +Y about +Z is +90°.
    expect(signedAngleOnPlane([0, 0, 1], [1, 0, 0], [0, 1, 0])).toBeCloseTo(
      Math.PI / 2,
      10,
    );
    // The opposite sweep is negative.
    expect(signedAngleOnPlane([0, 0, 1], [1, 0, 0], [0, -1, 0])).toBeCloseTo(
      -Math.PI / 2,
      10,
    );
    // 45° magnitude.
    expect(
      signedAngleOnPlane([0, 0, 1], [1, 0, 0], [Math.SQRT1_2, Math.SQRT1_2, 0]),
    ).toBeCloseTo(Math.PI / 4, 10);
    // Same direction → no rotation. The axis component of the inputs is ignored.
    expect(signedAngleOnPlane([0, 0, 1], [1, 0, 5], [1, 0, -3])).toBeCloseTo(
      0,
      10,
    );
  });

  it("returns 0 for a degenerate (zero-length projected) input", () => {
    expect(signedAngleOnPlane([0, 0, 1], [0, 0, 4], [0, 1, 0])).toBe(0);
    expect(signedAngleOnPlane([0, 0, 0], [1, 0, 0], [0, 1, 0])).toBe(0);
  });
});

describe("closestPointParamOnAxis (scale axis projection)", () => {
  it("returns the axis parameter of the closest point", () => {
    // A vertical ray at x=2 is closest to the X axis at (2,0,0) → param 2.
    expect(
      closestPointParamOnAxis([0, 0, 0], [1, 0, 0], [2, 1, 0], [0, -1, 0]),
    ).toBeCloseTo(2, 10);
  });

  it("returns null when the ray is parallel to the axis", () => {
    expect(
      closestPointParamOnAxis([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 0, 0]),
    ).toBeNull();
  });
});

describe("rayPlaneIntersection (rotate ring / uniform scale plane)", () => {
  it("intersects the ray with the plane", () => {
    const hit = rayPlaneIntersection(
      [0, 0, 0],
      [0, 0, 1],
      [1, 2, 5],
      [0, 0, -1],
    );
    expect(hit).not.toBeNull();
    const point = hit as readonly [number, number, number];
    expect(point[0]).toBeCloseTo(1, 10);
    expect(point[1]).toBeCloseTo(2, 10);
    expect(point[2]).toBeCloseTo(0, 10);
  });

  it("returns null for a ray parallel to the plane", () => {
    expect(
      rayPlaneIntersection([0, 0, 0], [0, 0, 1], [1, 2, 5], [1, 0, 0]),
    ).toBeNull();
  });
});

describe("scaleFactorFromDelta + guardScale (scale mapping)", () => {
  it("maps a delta of one reference length to a doubling", () => {
    expect(scaleFactorFromDelta(1.5, 1.5)).toBeCloseTo(2, 12);
    expect(scaleFactorFromDelta(0.75, 1.5)).toBeCloseTo(1.5, 12);
    expect(scaleFactorFromDelta(0, 1.5)).toBeCloseTo(1, 12);
    // Pulling in by a full reference length drives the factor to zero.
    expect(scaleFactorFromDelta(-1.5, 1.5)).toBeCloseTo(0, 12);
  });

  it("is a no-op factor for a degenerate reference length", () => {
    expect(scaleFactorFromDelta(2, 0)).toBe(1);
    expect(scaleFactorFromDelta(2, -1)).toBe(1);
    expect(scaleFactorFromDelta(Number.NaN, 1.5)).toBe(1);
  });

  it("guards the resulting scale against non-positive / degenerate values", () => {
    expect(guardScale(2.5)).toBeCloseTo(2.5, 12);
    expect(guardScale(0)).toBe(MIN_GIZMO_SCALE);
    expect(guardScale(-3)).toBe(MIN_GIZMO_SCALE);
    expect(guardScale(Number.NaN)).toBe(MIN_GIZMO_SCALE);
    // A snap-to-zero (factor pulled negative then snapped) is clamped, not written.
    expect(guardScale(snapToIncrement(1 * 0.1, 0.5))).toBe(MIN_GIZMO_SCALE);
  });
});

describe("inPlaneRightAxis (uniform scale in-plane basis)", () => {
  it("is perpendicular to the normal, in the up/normal frame", () => {
    const right = inPlaneRightAxis([0, 0, 1]);
    expect(right).not.toBeNull();
    const r = right as readonly [number, number, number];
    expect(r[0]).toBeCloseTo(1, 10);
    expect(r[1]).toBeCloseTo(0, 10);
    expect(r[2]).toBeCloseTo(0, 10);
  });

  it("falls back when up is parallel to the normal", () => {
    const right = inPlaneRightAxis([0, 1, 0]);
    expect(right).not.toBeNull();
    const r = right as readonly [number, number, number];
    // A unit vector perpendicular to the +Y normal (not NaN from the 0×N case).
    expect(Math.hypot(r[0], r[1], r[2])).toBeCloseTo(1, 10);
    expect(r[1]).toBeCloseTo(0, 10);
  });
});
