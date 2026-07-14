import { describe, expect, it } from "vitest";

import {
  rotateVec3ByQuat,
  shortestArcQuaternion,
  solveCcdChain,
  solveTwoBoneIk,
  vec3Distance,
  vec3Length,
  vec3Subtract,
  type QuatLike,
  type Vec3Like,
} from "@aperture-engine/math";

// F2 (three.js parity plan): pure IK solver math. Two-bone analytic solver
// (reach / over-reach clamp / pole direction) and the CCD chain solver
// (convergence / unreachable stretch), plus the shortest-arc helper they share.

const IDENTITY: readonly [number, number, number, number] = [0, 0, 0, 1];

/** A straight-up limb: root at the origin, mid at +1y, end at +2y (both unit bones). */
function straightLimb(): {
  rootPosition: Vec3Like;
  midPosition: Vec3Like;
  endPosition: Vec3Like;
} {
  return {
    rootPosition: [0, 0, 0],
    midPosition: [0, 1, 0],
    endPosition: [0, 2, 0],
  };
}

describe("shortestArcQuaternion", () => {
  it("rotates one direction onto another (applying it lands on the target dir)", () => {
    const rotation = shortestArcQuaternion([1, 0, 0], [0, 1, 0]);
    const rotated = rotateVec3ByQuat([1, 0, 0], rotation);
    expect(rotated[0]).toBeCloseTo(0, 5);
    expect(rotated[1]).toBeCloseTo(1, 5);
    expect(rotated[2]).toBeCloseTo(0, 5);
  });

  it("returns identity for parallel inputs", () => {
    const rotation = shortestArcQuaternion([0, 0, 2], [0, 0, 5]);
    expect(Array.from(rotation)).toEqual([0, 0, 0, 1]);
  });

  it("produces a valid 180° rotation for antiparallel inputs", () => {
    const rotation = shortestArcQuaternion([1, 0, 0], [-1, 0, 0]);
    const rotated = rotateVec3ByQuat([1, 0, 0], rotation);
    expect(rotated[0]).toBeCloseTo(-1, 5);
    expect(Math.hypot(rotated[1], rotated[2])).toBeLessThan(1e-5);
  });
});

describe("solveTwoBoneIk", () => {
  it("reaches a reachable target exactly", () => {
    const limb = straightLimb();
    const target: Vec3Like = [1, 1, 0]; // distance sqrt(2) < reach 2
    const result = solveTwoBoneIk({
      ...limb,
      targetPosition: target,
      rootWorldRotation: IDENTITY,
      midWorldRotation: IDENTITY,
    });

    expect(result.reached).toBe(true);
    expect(vec3Distance(result.endPosition, target)).toBeLessThan(1e-4);
    // The bones keep their lengths (rigid limb).
    expect(
      vec3Length(vec3Subtract(result.midPosition, limb.rootPosition)),
    ).toBeCloseTo(1, 4);
    expect(
      vec3Length(vec3Subtract(result.endPosition, result.midPosition)),
    ).toBeCloseTo(1, 4);
  });

  it("clamps an over-reaching target to a straight limb pointing at it", () => {
    const limb = straightLimb();
    const target: Vec3Like = [5, 0, 0]; // distance 5 > reach 2
    const result = solveTwoBoneIk({
      ...limb,
      targetPosition: target,
      rootWorldRotation: IDENTITY,
      midWorldRotation: IDENTITY,
    });

    expect(result.reached).toBe(false);
    // Effector planted at (just under) full extension, straight toward target.
    const reach = vec3Length(
      vec3Subtract(result.endPosition, limb.rootPosition),
    );
    expect(reach).toBeGreaterThan(1.99);
    expect(reach).toBeLessThanOrEqual(2);
    // Nearly straight: mid, end, and target are collinear along +x (a hair of
    // residual bend remains from the reach-clamp margin that keeps the limb off
    // its exact singular full extension).
    expect(result.endPosition[1]).toBeCloseTo(0, 5);
    expect(Math.abs(result.midPosition[1])).toBeLessThan(0.02);
    expect(result.midPosition[0]).toBeCloseTo(1, 2);
  });

  it("bends the limb toward the pole, and flipping the pole flips the bend", () => {
    const limb = straightLimb();
    const target: Vec3Like = [1.4, 0, 0]; // reachable, forces a bend

    const front = solveTwoBoneIk({
      ...limb,
      targetPosition: target,
      polePosition: [0.7, 0, 1], // +z pole
      rootWorldRotation: IDENTITY,
      midWorldRotation: IDENTITY,
    });
    const back = solveTwoBoneIk({
      ...limb,
      targetPosition: target,
      polePosition: [0.7, 0, -1], // -z pole
      rootWorldRotation: IDENTITY,
      midWorldRotation: IDENTITY,
    });

    // Both still reach the target...
    expect(vec3Distance(front.endPosition, target)).toBeLessThan(1e-4);
    expect(vec3Distance(back.endPosition, target)).toBeLessThan(1e-4);
    // ...but the knee/elbow points to opposite sides.
    expect(front.midPosition[2]).toBeGreaterThan(0.2);
    expect(back.midPosition[2]).toBeLessThan(-0.2);
    expect(Math.sign(front.midPosition[2])).toBe(
      -Math.sign(back.midPosition[2]),
    );
  });

  it("is deterministic: identical input → bit-identical output", () => {
    const limb = straightLimb();
    const input = {
      ...limb,
      targetPosition: [1.1, 0.6, 0.3] as Vec3Like,
      polePosition: [0.5, 0, 1] as Vec3Like,
      rootWorldRotation: IDENTITY,
      midWorldRotation: IDENTITY,
    };
    const a = solveTwoBoneIk(input);
    const b = solveTwoBoneIk(input);
    expect(Array.from(a.endPosition)).toEqual(Array.from(b.endPosition));
    expect(Array.from(a.midPosition)).toEqual(Array.from(b.midPosition));
    expect(Array.from(a.rootWorldRotation)).toEqual(
      Array.from(b.rootWorldRotation),
    );
    expect(Array.from(a.midWorldRotation)).toEqual(
      Array.from(b.midWorldRotation),
    );
  });
});

describe("solveCcdChain", () => {
  // Four joints along +x at 0,1,2,3 with the effector one bone beyond at x=4.
  function straightChain(): {
    jointPositions: Vec3Like[];
    jointWorldRotations: QuatLike[];
    endPosition: Vec3Like;
  } {
    return {
      jointPositions: [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
      ],
      jointWorldRotations: [IDENTITY, IDENTITY, IDENTITY, IDENTITY],
      endPosition: [4, 0, 0],
    };
  }

  it("converges a 4-joint chain onto a reachable target within tolerance", () => {
    const chain = straightChain();
    const target: Vec3Like = [1.5, 1.5, 0]; // distance ~2.12 < reach 4
    const result = solveCcdChain({
      ...chain,
      targetPosition: target,
      iterations: 32,
      tolerance: 1e-3,
    });

    expect(result.reached).toBe(true);
    expect(vec3Distance(result.endPosition, target)).toBeLessThanOrEqual(1e-3);
    expect(result.worldRotations).toHaveLength(4);
  });

  it("stretches straight toward an unreachable target", () => {
    // Start from an L-shaped chain so straightening is a real change.
    const result = solveCcdChain({
      jointPositions: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 2, 0],
        [1, 2, 0],
      ],
      jointWorldRotations: [IDENTITY, IDENTITY, IDENTITY, IDENTITY],
      endPosition: [2, 2, 0],
      targetPosition: [10, 0, 0], // distance 10 >> reach 4
      iterations: 48,
      tolerance: 1e-3,
    });

    expect(result.reached).toBe(false);
    // Fully extended toward the target: effector at ~reach distance along +x.
    const reach = vec3Length(vec3Subtract(result.endPosition, [0, 0, 0]));
    expect(reach).toBeGreaterThan(3.9);
    expect(reach).toBeLessThanOrEqual(4 + 1e-6);
    expect(result.endPosition[0]).toBeGreaterThan(3.9);
    expect(Math.abs(result.endPosition[1])).toBeLessThan(0.1);
  });

  it("is deterministic: identical input → bit-identical output", () => {
    const chain = straightChain();
    const input = {
      ...chain,
      targetPosition: [1.2, 1.8, 0.4] as Vec3Like,
      iterations: 20,
      tolerance: 1e-4,
    };
    const a = solveCcdChain(input);
    const b = solveCcdChain(input);
    expect(Array.from(a.endPosition)).toEqual(Array.from(b.endPosition));
    expect(a.iterations).toBe(b.iterations);
    a.worldRotations.forEach((rotation, index) => {
      expect(Array.from(rotation)).toEqual(
        Array.from(b.worldRotations[index]!),
      );
    });
  });
});
