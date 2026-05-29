import { describe, expect, it } from "vitest";

import {
  sampleAnimationChannel,
  type AnimationKeyframeChannel,
} from "@aperture-engine/runtime";

describe("AnimationClip keyframe sampler", () => {
  it("lerps a 2-keyframe LINEAR translation channel at t=0, mid, end", () => {
    const channel: AnimationKeyframeChannel = {
      targetId: "node:0",
      path: "translation",
      interpolation: "LINEAR",
      times: new Float32Array([0, 2]),
      values: new Float32Array([0, 0, 0, 10, -4, 6]),
      componentCount: 3,
    };

    expect(sampleAnimationChannel(channel, 0)).toEqual([0, 0, 0]);
    expect(sampleAnimationChannel(channel, 1)).toEqual([5, -2, 3]);
    expect(sampleAnimationChannel(channel, 2)).toEqual([10, -4, 6]);
  });

  it("clamps a LINEAR channel past its endpoints", () => {
    const channel: AnimationKeyframeChannel = {
      targetId: "node:0",
      path: "translation",
      interpolation: "LINEAR",
      times: new Float32Array([0, 2]),
      values: new Float32Array([0, 0, 0, 10, -4, 6]),
      componentCount: 3,
    };

    expect(sampleAnimationChannel(channel, -5)).toEqual([0, 0, 0]);
    expect(sampleAnimationChannel(channel, 99)).toEqual([10, -4, 6]);
  });

  it("STEP rotation returns the previous keyframe before the next time and the next at/after it", () => {
    // q0 = identity, q1 = 90deg about Z stored un-normalized to prove renormalization.
    const channel: AnimationKeyframeChannel = {
      targetId: "node:0",
      path: "rotation",
      interpolation: "STEP",
      times: new Float32Array([0, 1]),
      values: new Float32Array([
        0, 0, 0, 2, /* q0 = (0,0,0,2) -> normalizes to identity */ 0, 0, 0.7071,
        0.7071,
      ]),
      componentCount: 4,
    };

    const beforeNext = sampleAnimationChannel(channel, 0.5);
    expect(beforeNext[0]).toBeCloseTo(0, 6);
    expect(beforeNext[1]).toBeCloseTo(0, 6);
    expect(beforeNext[2]).toBeCloseTo(0, 6);
    expect(beforeNext[3]).toBeCloseTo(1, 6); // (0,0,0,2) renormalized -> identity

    const atNext = sampleAnimationChannel(channel, 1);
    expect(atNext[2]).toBeCloseTo(0.7071, 4);
    expect(atNext[3]).toBeCloseTo(0.7071, 4);
  });

  it("matches a hand-computed CUBICSPLINE scalar Hermite value at t=0.5", () => {
    // One scalar channel (componentCount 1), keyframes at t=0 and t=1.
    // Layout per keyframe: [inTangent, value, outTangent].
    // k0: in=0, value=0, out=1   k1: in=2, value=1, out=0
    const channel: AnimationKeyframeChannel = {
      targetId: "node:0",
      path: "weights",
      interpolation: "CUBICSPLINE",
      times: new Float32Array([0, 1]),
      values: new Float32Array([0, 0, 1, /* k0 */ 2, 1, 0 /* k1 */]),
      componentCount: 1,
    };

    // Hermite with p0=0, m0=out0*td=1*1=1, p1=1, m1=in1*td=2*1=2 at p=0.5:
    //   s0=2p^3-3p^2+1=0.5, s1=p^3-2p^2+p=0.125, s2=-2p^3+3p^2=0.5, s3=p^3-p^2=-0.125
    //   value = 0.5*0 + 0.125*1 + 0.5*1 + (-0.125)*2 = 0.375
    const sampled = sampleAnimationChannel(channel, 0.5);
    expect(sampled[0]).toBeCloseTo(0.375, 6);
  });

  it("LINEAR rotation crossing a hemisphere boundary returns a shortest-path unit quaternion", () => {
    // q0 ~ identity, q1 has a negative w so dot(q0,q1) < 0 -> must flip.
    const channel: AnimationKeyframeChannel = {
      targetId: "node:0",
      path: "rotation",
      interpolation: "LINEAR",
      times: new Float32Array([0, 1]),
      values: new Float32Array([
        0, 0, 0, 1, /* q0 identity */ 0, 0, -0.7071, -0.7071 /* q1 */,
      ]),
      componentCount: 4,
    };

    const mid = sampleAnimationChannel(channel, 0.5);
    const length = Math.hypot(mid[0]!, mid[1]!, mid[2]!, mid[3]!);
    expect(length).toBeCloseTo(1, 6);
    // Shortest path keeps w positive (flipped q1 -> (0,0,0.7071,0.7071)).
    expect(mid[3]!).toBeGreaterThan(0);
    expect(mid[2]!).toBeGreaterThan(0);
  });

  it("reuses a correctly-sized out array without allocating", () => {
    const channel: AnimationKeyframeChannel = {
      targetId: "node:0",
      path: "translation",
      interpolation: "LINEAR",
      times: new Float32Array([0, 1]),
      values: new Float32Array([0, 0, 0, 2, 4, 6]),
      componentCount: 3,
    };

    const scratch = [0, 0, 0];
    const result = sampleAnimationChannel(channel, 0.5, scratch);
    expect(result).toBe(scratch);
    expect(result).toEqual([1, 2, 3]);
  });
});
