import { describe, expect, it } from "vitest";

import {
  blendAnimationClipSamples,
  clampAnimationClipWeight,
  crossFadeTo,
  sampleAnimationCrossFade,
} from "@aperture-engine/runtime";

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
