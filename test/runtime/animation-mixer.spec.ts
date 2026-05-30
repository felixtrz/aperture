import { describe, expect, it } from "vitest";

import { AnimationMixer, type AnimationClip } from "@aperture-engine/runtime";

/** A clip with a single LINEAR translation channel on `node:0` over [0, D]. */
function translationClip(
  name: string,
  duration: number,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): AnimationClip {
  return {
    name,
    duration,
    channels: [
      {
        targetId: "node:0",
        path: "translation",
        interpolation: "LINEAR",
        times: new Float32Array([0, duration]),
        values: new Float32Array([...from, ...to]),
        componentCount: 3,
      },
    ],
  };
}

function translationOf(
  channels: ReturnType<AnimationMixer["update"]>,
): readonly number[] {
  const channel = channels.find(
    (entry) => entry.targetId === "node:0" && entry.path === "translation",
  );
  if (channel === undefined) {
    throw new Error("expected a translation channel for node:0");
  }
  return channel.value;
}

describe("AnimationMixer", () => {
  it("wraps a looping clip back to its start after a full duration", () => {
    const D = 4;
    const clip = translationClip("Loop", D, [0, 0, 0], [8, 0, 0]);
    const mixer = new AnimationMixer([["Loop", clip]]);
    mixer.play("Loop", { loop: "repeat" });

    let channels = mixer.update(0); // sample at t=0
    expect(translationOf(channels)).toEqual([0, 0, 0]);

    for (let i = 0; i < 4; i += 1) {
      channels = mixer.update(D * 0.25);
    }

    // Four quarter-steps wrap local time back to ~0 and the value to clip@0.
    expect(mixer.time).toBeCloseTo(0, 6);
    expect(translationOf(channels)[0]).toBeCloseTo(0, 6);
  });

  it("freezes on pause() and scrubs on seek()", () => {
    const clip = translationClip("Slide", 4, [0, 0, 0], [8, 0, 0]);
    const mixer = new AnimationMixer([["Slide", clip]]);
    mixer.play("Slide", { loop: "repeat" });

    mixer.update(1); // t=1 -> x=2
    expect(translationOf(mixer.update(0))[0]).toBeCloseTo(2, 6);

    mixer.pause();
    mixer.update(2);
    mixer.update(2);
    // Paused: time and value unchanged across updates.
    expect(mixer.time).toBeCloseTo(1, 6);
    expect(translationOf(mixer.update(0))[0]).toBeCloseTo(2, 6);

    mixer.seek(3); // x should be 6 at t=3
    expect(translationOf(mixer.update(0))[0]).toBeCloseTo(6, 6);
  });

  it("clamps loop:'once' at the end and reports finished", () => {
    const clip = translationClip("Once", 2, [0, 0, 0], [4, 0, 0]);
    const mixer = new AnimationMixer([["Once", clip]]);
    mixer.play("Once", { loop: "once" });

    mixer.update(5); // overshoot
    expect(mixer.time).toBeCloseTo(2, 6);
    expect(mixer.clamped).toBe(true);
    expect(translationOf(mixer.update(0))[0]).toBeCloseTo(4, 6);
  });

  it("plays backward with speed<0 and clamps at 0 under loop:'once'", () => {
    const clip = translationClip("Back", 2, [0, 0, 0], [4, 0, 0]);
    const mixer = new AnimationMixer([["Back", clip]]);
    mixer.play("Back", { loop: "once", speed: -1, startTime: 2 });

    mixer.update(5); // play backward past 0
    expect(mixer.time).toBeCloseTo(0, 6);
    expect(mixer.clamped).toBe(true);
    expect(translationOf(mixer.update(0))[0]).toBeCloseTo(0, 6);
  });

  it("crossFadeTo blends both clips mid-fade then settles on the target", () => {
    // A holds x=0 across its whole duration; B holds x=10. The blended x at
    // 50% fade must be the normalized average (5), then settle on B (10).
    const clipA = translationClip("A", 4, [0, 0, 0], [0, 0, 0]);
    const clipB = translationClip("B", 4, [10, 0, 0], [10, 0, 0]);
    const mixer = new AnimationMixer([
      ["A", clipA],
      ["B", clipB],
    ]);
    mixer.play("A", { loop: "repeat" });
    mixer.update(0);

    mixer.crossFadeTo("B", 1.0);
    let channels = mixer.update(0.5);

    const channel = channels.find(
      (entry) => entry.targetId === "node:0" && entry.path === "translation",
    )!;
    expect(channel.value[0]).toBeCloseTo(5, 5); // 0.5*0 + 0.5*10
    // Per-target contributor weights sum to ~1 after normalization.
    const sum = channel.contributors.reduce(
      (acc, c) => acc + c.normalizedWeight,
      0,
    );
    expect(sum).toBeCloseTo(1, 5);
    expect(channel.contributors.length).toBe(2);
    expect(mixer.isCrossFading).toBe(true);

    // Advance past the fade duration -> only B contributes (x=10).
    channels = mixer.update(0.6);
    const settled = channels.find(
      (entry) => entry.targetId === "node:0" && entry.path === "translation",
    )!;
    expect(settled.value[0]).toBeCloseTo(10, 5);
    expect(settled.contributors.length).toBe(1);
    expect(settled.contributors[0]!.clipId).toBe("B");
    expect(mixer.isCrossFading).toBe(false);
  });

  it("pingpong reverses direction at the clip endpoints", () => {
    const clip = translationClip("Pong", 2, [0, 0, 0], [4, 0, 0]);
    const mixer = new AnimationMixer([["Pong", clip]]);
    mixer.play("Pong", { loop: "pingpong" });

    mixer.update(1.5); // t=1.5
    expect(mixer.time).toBeCloseTo(1.5, 6);
    mixer.update(1.0); // would reach 2.5 -> reflect to 1.5
    expect(mixer.time).toBeCloseTo(1.5, 6);
    expect(translationOf(mixer.update(0))[0]).toBeCloseTo(3, 6); // x at t=1.5
  });

  it("blends morph-weight channels and exposes them via weightChannels", () => {
    const weightClip: AnimationClip = {
      name: "Morph",
      duration: 2,
      channels: [
        {
          targetId: "node:0",
          path: "weights",
          interpolation: "LINEAR",
          times: new Float32Array([0, 2]),
          // 3 morph targets per keyframe.
          values: new Float32Array([0, 0, 0, 1, 0.5, 0.25]),
          componentCount: 3,
        },
      ],
    };
    const mixer = new AnimationMixer([["Morph", weightClip]]);
    mixer.play("Morph", { loop: "once" });
    mixer.update(1); // mid -> weights = [0.5, 0.25, 0.125]

    const weights = mixer.weightChannels;
    expect(weights).toHaveLength(1);
    expect(weights[0]!.value.length).toBe(3);
    expect(weights[0]!.value[0]).toBeCloseTo(0.5, 5);
    expect(weights[0]!.value[2]).toBeCloseTo(0.125, 5);
  });
});
