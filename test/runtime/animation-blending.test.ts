import { describe, expect, it } from "vitest";

import {
  applyAdditiveAnimationChannels,
  blendAnimationClipSamples,
  clampAnimationClipWeight,
  conjugateQuaternion,
  crossFadeTo,
  makeAdditiveClip,
  multiplyQuaternions,
  sampleAnimationCrossFade,
  scaleQuaternionRotation,
  type AnimationClip,
  type BlendedAnimationChannel,
} from "@aperture-engine/runtime";

const SQRT1_2 = Math.SQRT1_2;

describe("weighted animation clip blending", () => {
  it("blends two weighted translation samples on the same target", () => {
    const [channel] = blendAnimationClipSamples([
      {
        clipId: "SlideX",
        targetId: "entity:1",
        path: "translation",
        weight: 0.5,
        value: [0, 2, 4],
      },
      {
        clipId: "RiseY",
        targetId: "entity:1",
        path: "translation",
        weight: 0.5,
        value: [10, 12, 14],
      },
    ]);

    expect(channel).toBeDefined();
    expect(channel?.targetId).toBe("entity:1");
    expect(channel?.path).toBe("translation");
    expect(channel?.value).toEqual([5, 7, 9]);
    expect(channel?.contributors).toEqual([
      { clipId: "SlideX", weight: 0.5, normalizedWeight: 0.5 },
      { clipId: "RiseY", weight: 0.5, normalizedWeight: 0.5 },
    ]);
  });

  it("normalizes rotation samples with opposite quaternion signs", () => {
    const [channel] = blendAnimationClipSamples([
      {
        clipId: "Forward",
        targetId: "entity:1",
        path: "rotation",
        weight: 0.5,
        value: [0, 0.70710678, 0, 0.70710678],
      },
      {
        clipId: "Backward",
        targetId: "entity:1",
        path: "rotation",
        weight: 0.5,
        value: [0, -0.70710678, 0, -0.70710678],
      },
    ]);

    expect(channel?.value[0]).toBeCloseTo(0);
    expect(channel?.value[1]).toBeCloseTo(0.70710678);
    expect(channel?.value[2]).toBeCloseTo(0);
    expect(channel?.value[3]).toBeCloseTo(0.70710678);
  });

  it("clamps per-clip weights to the public 0-1 range", () => {
    expect(clampAnimationClipWeight(Number.NaN)).toBe(0);
    expect(clampAnimationClipWeight(-1)).toBe(0);
    expect(clampAnimationClipWeight(0.25)).toBe(0.25);
    expect(clampAnimationClipWeight(2)).toBe(1);
  });

  it("samples cross-fade weights halfway through a one-second transition", () => {
    const fade = crossFadeTo("Walk", "Run", 1);

    expect(sampleAnimationCrossFade(fade, 0)).toEqual([
      { clipId: "Walk", weight: 1 },
      { clipId: "Run", weight: 0 },
    ]);
    expect(sampleAnimationCrossFade(fade, 0.5)).toEqual([
      { clipId: "Walk", weight: 0.5 },
      { clipId: "Run", weight: 0.5 },
    ]);
    expect(sampleAnimationCrossFade(fade, 1)).toEqual([
      { clipId: "Walk", weight: 0 },
      { clipId: "Run", weight: 1 },
    ]);
  });
});

describe("additive blending primitives", () => {
  it("multiplies quaternions with the Hamilton product (a on the left)", () => {
    // 90° about Y ⊗ 90° about Y = 180° about Y.
    const yaw90: [number, number, number, number] = [0, SQRT1_2, 0, SQRT1_2];
    const [x, y, z, w] = multiplyQuaternions(yaw90, yaw90);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(1, 6);
    expect(z).toBeCloseTo(0, 6);
    expect(w).toBeCloseTo(0, 6);
  });

  it("conjugate of a unit quaternion inverts its rotation", () => {
    const q: [number, number, number, number] = [0, SQRT1_2, 0, SQRT1_2];
    const identity = multiplyQuaternions(q, conjugateQuaternion(q));
    expect(identity[0]).toBeCloseTo(0, 6);
    expect(identity[1]).toBeCloseTo(0, 6);
    expect(identity[2]).toBeCloseTo(0, 6);
    expect(identity[3]).toBeCloseTo(1, 6);
  });

  it("scales a rotation delta by slerp from identity", () => {
    const yaw90: [number, number, number, number] = [0, SQRT1_2, 0, SQRT1_2];
    expect(scaleQuaternionRotation(yaw90, 0)).toEqual([0, 0, 0, 1]);
    // Half of a 90° yaw is a 45° yaw.
    const half = scaleQuaternionRotation(yaw90, 0.5);
    expect(half[1]).toBeCloseTo(Math.sin(Math.PI / 8), 6);
    expect(half[3]).toBeCloseTo(Math.cos(Math.PI / 8), 6);
  });

  it("applies additive translation deltas on top of a base pose", () => {
    const base: BlendedAnimationChannel[] = [
      {
        targetId: "hip",
        path: "translation",
        value: [1, 0, 0],
        weight: 1,
        contributors: [{ clipId: "walk", weight: 1, normalizedWeight: 1 }],
      },
    ];
    const [channel] = applyAdditiveAnimationChannels(base, [
      {
        clipId: "bob",
        targetId: "hip",
        path: "translation",
        weight: 0.5,
        value: [0, 2, 0],
      },
    ]);
    // base + weight * delta = [1, 0, 0] + 0.5 * [0, 2, 0].
    expect(channel?.value).toEqual([1, 1, 0]);
    // The base input must not be mutated.
    expect(base[0]?.value).toEqual([1, 0, 0]);
  });

  it("synthesizes a rest pose for an additive-only target", () => {
    const [channel] = applyAdditiveAnimationChannels(
      [],
      [
        {
          clipId: "look",
          targetId: "head",
          path: "rotation",
          weight: 1,
          value: [0, SQRT1_2, 0, SQRT1_2],
        },
      ],
    );
    // No base channel for "head" → rest identity ⊗ full delta = the delta.
    expect(channel?.targetId).toBe("head");
    expect(channel?.value[1]).toBeCloseTo(SQRT1_2, 6);
    expect(channel?.value[3]).toBeCloseTo(SQRT1_2, 6);
  });
});

function rotationClip(
  name: string,
  target: string,
  from: readonly [number, number, number, number],
  to: readonly [number, number, number, number],
): AnimationClip {
  return {
    name,
    duration: 1,
    channels: [
      {
        targetId: target,
        path: "rotation",
        interpolation: "LINEAR",
        times: new Float32Array([0, 1]),
        values: new Float32Array([...from, ...to]),
        componentCount: 4,
      },
    ],
  };
}

function translationClip(
  name: string,
  target: string,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): AnimationClip {
  return {
    name,
    duration: 1,
    channels: [
      {
        targetId: target,
        path: "translation",
        interpolation: "LINEAR",
        times: new Float32Array([0, 1]),
        values: new Float32Array([...from, ...to]),
        componentCount: 3,
      },
    ],
  };
}

describe("makeAdditiveClip", () => {
  it("converts a rotation clip into inverse(reference) ⊗ sampled deltas", () => {
    // identity → 90° about Z, referenced against t=0 (identity).
    const clip = rotationClip(
      "Turn",
      "head",
      [0, 0, 0, 1],
      [0, 0, SQRT1_2, SQRT1_2],
    );
    const additive = makeAdditiveClip(clip);
    const channel = additive.channels[0]!;
    expect(channel.interpolation).toBe("LINEAR");
    // kf0: inverse(identity) ⊗ identity = identity.
    expect(Array.from(channel.values.slice(0, 4))).toEqual([0, 0, 0, 1]);
    // kf1: inverse(identity) ⊗ 90°Z = 90°Z.
    const kf1 = Array.from(channel.values.slice(4, 8));
    expect(kf1[2]).toBeCloseTo(SQRT1_2, 6);
    expect(kf1[3]).toBeCloseTo(SQRT1_2, 6);
  });

  it("converts a translation clip into sampled − reference deltas", () => {
    const clip = translationClip("Slide", "hip", [0, 0, 0], [4, 0, 0]);
    // Reference at t=0.5 is [2, 0, 0]; deltas subtract it.
    const additive = makeAdditiveClip(clip, { referenceTime: 0.5 });
    const channel = additive.channels[0]!;
    expect(Array.from(channel.values.slice(0, 3))).toEqual([-2, 0, 0]);
    expect(Array.from(channel.values.slice(3, 6))).toEqual([2, 0, 0]);
  });

  it("uses a separate reference clip's pose as the delta origin", () => {
    const target = translationClip("Pose", "hip", [5, 0, 0], [5, 0, 0]);
    const reference = translationClip("Rest", "hip", [1, 0, 0], [1, 0, 0]);
    const additive = makeAdditiveClip(target, { referenceClip: reference });
    const channel = additive.channels[0]!;
    // 5 − 1 = 4 on every keyframe.
    expect(Array.from(channel.values.slice(0, 3))).toEqual([4, 0, 0]);
  });
});
