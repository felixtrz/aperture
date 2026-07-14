import { describe, expect, it } from "vitest";

import {
  AnimationMixer,
  makeAdditiveClip,
  type AnimationClip,
  type BlendedAnimationChannel,
} from "@aperture-engine/runtime";

const SQRT1_2 = Math.SQRT1_2;

/** A clip holding a constant translation on `target` across [0, duration]. */
function constantTranslation(
  name: string,
  target: string,
  value: readonly [number, number, number],
  duration = 1,
): AnimationClip {
  return {
    name,
    duration,
    channels: [
      {
        targetId: target,
        path: "translation",
        interpolation: "LINEAR",
        times: new Float32Array([0, duration]),
        values: new Float32Array([...value, ...value]),
        componentCount: 3,
      },
    ],
  };
}

/** A clip that animates a translation linearly from `from` to `to`. */
function rampTranslation(
  name: string,
  target: string,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  duration = 1,
): AnimationClip {
  return {
    name,
    duration,
    channels: [
      {
        targetId: target,
        path: "translation",
        interpolation: "LINEAR",
        times: new Float32Array([0, duration]),
        values: new Float32Array([...from, ...to]),
        componentCount: 3,
      },
    ],
  };
}

function constantRotation(
  name: string,
  target: string,
  value: readonly [number, number, number, number],
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
        values: new Float32Array([...value, ...value]),
        componentCount: 4,
      },
    ],
  };
}

function translationOf(
  channels: readonly BlendedAnimationChannel[],
  target = "hip",
): readonly number[] {
  const channel = channels.find(
    (entry) => entry.targetId === target && entry.path === "translation",
  );
  if (channel === undefined) {
    throw new Error(`expected a translation channel for ${target}`);
  }
  return channel.value;
}

function rotationOf(
  channels: readonly BlendedAnimationChannel[],
  target = "head",
): readonly number[] {
  const channel = channels.find(
    (entry) => entry.targetId === target && entry.path === "rotation",
  );
  if (channel === undefined) {
    throw new Error(`expected a rotation channel for ${target}`);
  }
  return channel.value;
}

describe("AnimationMixer v2 — N-lane weighted blending", () => {
  it("blends two weighted lanes (50/50 walk+run lands halfway)", () => {
    const mixer = new AnimationMixer([
      ["walk", constantTranslation("walk", "hip", [0, 0, 0])],
      ["run", constantTranslation("run", "hip", [10, 0, 0])],
    ]);
    mixer.playLane("walk", { weight: 0.5, loop: "repeat" });
    mixer.playLane("run", { weight: 0.5, loop: "repeat" });

    const channels = mixer.update(0);
    expect(translationOf(channels)[0]).toBeCloseTo(5, 6);
    expect(mixer.state.laneCount).toBe(2);
  });

  it("blends three lanes as a normalized weighted average (idle/walk/run)", () => {
    const mixer = new AnimationMixer([
      ["idle", constantTranslation("idle", "hip", [0, 0, 0])],
      ["walk", constantTranslation("walk", "hip", [1, 0, 0])],
      ["run", constantTranslation("run", "hip", [2, 0, 0])],
    ]);
    // 25% walk + 75% run → normalized average = 0.25*1 + 0.75*2 = 1.75.
    mixer.playLane("idle", { weight: 0 });
    mixer.playLane("walk", { weight: 0.25 });
    mixer.playLane("run", { weight: 0.75 });

    expect(translationOf(mixer.update(0))[0]).toBeCloseTo(1.75, 6);
  });

  it("advances each lane at its own speed and honors per-lane loop", () => {
    const mixer = new AnimationMixer([
      ["fast", rampTranslation("fast", "hip", [0, 0, 0], [10, 0, 0], 10)],
      ["once", rampTranslation("once", "torso", [0, 0, 0], [4, 0, 0], 1)],
    ]);
    const fast = mixer.playLane("fast", {
      weight: 1,
      speed: 2,
      loop: "repeat",
    });
    const once = mixer.playLane("once", { weight: 1, loop: "once" });

    mixer.update(1); // fast advances 2s of its 10s clip; once clamps at 1s.
    expect(fast.time).toBeCloseTo(2, 6);
    expect(once.time).toBeCloseTo(1, 6);
    expect(once.clamped).toBe(true);
  });
});

describe("AnimationMixer v2 — fade in/out", () => {
  it("ramps a lane's effective weight from 0 to its steady weight", () => {
    const mixer = new AnimationMixer([
      ["walk", constantTranslation("walk", "hip", [4, 0, 0])],
    ]);
    const lane = mixer.playLane("walk", { weight: 1, fadeInSeconds: 1 });

    mixer.update(0);
    expect(lane.effectiveWeight).toBeCloseTo(0, 6);
    mixer.update(0.5);
    expect(lane.effectiveWeight).toBeCloseTo(0.5, 6);
    mixer.update(0.5);
    expect(lane.effectiveWeight).toBeCloseTo(1, 6);
    expect(lane.fading).toBe(false);
  });

  it("fades a lane out and removes it once fully faded", () => {
    const mixer = new AnimationMixer([
      ["walk", constantTranslation("walk", "hip", [4, 0, 0])],
    ]);
    const lane = mixer.playLane("walk", { weight: 1 });
    mixer.update(0);
    lane.fadeOut(1);

    mixer.update(0.5);
    expect(lane.effectiveWeight).toBeCloseTo(0.5, 6);
    expect(mixer.lanes.length).toBe(1);

    mixer.update(0.6); // elapsed 1.1 ≥ 1.0 → removed.
    expect(mixer.lanes.length).toBe(0);
    expect(mixer.update(0)).toEqual([]);
  });

  it("keeps a lane at weight 0 after fadeOut with stopWhenFaded:false", () => {
    const mixer = new AnimationMixer([
      ["walk", constantTranslation("walk", "hip", [4, 0, 0])],
    ]);
    const lane = mixer.playLane("walk", { weight: 1 });
    mixer.update(0);
    lane.fadeOut(1, { stopWhenFaded: false });
    mixer.update(1.2);
    expect(mixer.lanes.length).toBe(1);
    expect(lane.effectiveWeight).toBeCloseTo(0, 6);
  });
});

describe("AnimationMixer v2 — additive lanes", () => {
  it("offsets the base pose by an additive translation delta", () => {
    const mixer = new AnimationMixer([
      ["walk", constantTranslation("walk", "hip", [1, 0, 0])],
    ]);
    // An additive clip that raises the hip by +2 in Y (delta relative to rest).
    const bobBase = constantTranslation("bob", "hip", [0, 2, 0]);
    const rest = constantTranslation("rest", "hip", [0, 0, 0]);
    mixer.addClip("bob", makeAdditiveClip(bobBase, { referenceClip: rest }));

    mixer.playLane("walk", { weight: 1 });
    const additive = mixer.playLane("bob", { additive: true, weight: 1 });

    // base [1, 0, 0] + delta [0, 2, 0] * weight 1 = [1, 2, 0].
    expect(translationOf(mixer.update(0))).toEqual([1, 2, 0]);

    additive.setWeight(0.5);
    // base [1, 0, 0] + delta [0, 2, 0] * 0.5 = [1, 1, 0].
    expect(translationOf(mixer.update(0))).toEqual([1, 1, 0]);
  });

  it("applies an additive head-look independent of locomotion", () => {
    // A 90°-about-Y look, built as a delta from an identity reference.
    const lookPose = constantRotation("look", "head", [0, SQRT1_2, 0, SQRT1_2]);
    const lookAdditive = makeAdditiveClip(lookPose, {
      referenceClip: constantRotation("rest", "head", [0, 0, 0, 1]),
    });

    // Two locomotion cases; the head bone is NOT animated by locomotion.
    for (const hip of [
      [0, 0, 0],
      [5, 0, 0],
    ] as const) {
      const mixer = new AnimationMixer([
        ["loco", constantTranslation("loco", "hip", hip)],
        ["look", lookAdditive],
      ]);
      mixer.playLane("loco", { weight: 1 });
      mixer.playLane("look", { additive: true, weight: 1 });

      const channels = mixer.update(0);
      // Locomotion drives the hip; the head-look is the same 90°-Y regardless.
      expect(translationOf(channels)[0]).toBeCloseTo(hip[0], 6);
      const head = rotationOf(channels);
      expect(head[1]).toBeCloseTo(SQRT1_2, 6);
      expect(head[3]).toBeCloseTo(SQRT1_2, 6);
    }
  });

  it("scales an additive rotation lane by its weight (slerp from identity)", () => {
    const lookAdditive = makeAdditiveClip(
      constantRotation("look", "head", [0, 0, SQRT1_2, SQRT1_2]),
      { referenceClip: constantRotation("rest", "head", [0, 0, 0, 1]) },
    );
    const mixer = new AnimationMixer([["look", lookAdditive]]);
    const lane = mixer.playLane("look", { additive: true, weight: 0.5 });

    // Half of a 90°-Z look is a 45°-Z rotation.
    const head = rotationOf(mixer.update(0));
    expect(head[2]).toBeCloseTo(Math.sin(Math.PI / 8), 6);
    expect(head[3]).toBeCloseTo(Math.cos(Math.PI / 8), 6);

    lane.setWeight(0);
    // Zero weight → the additive lane contributes nothing (no head channel).
    const rest = mixer.update(0);
    expect(rest.find((entry) => entry.targetId === "head")).toBeUndefined();
  });

  it("adds additive morph-weight deltas on top of the base weights", () => {
    const baseMorph: AnimationClip = {
      name: "baseMorph",
      duration: 1,
      channels: [
        {
          targetId: "face",
          path: "weights",
          interpolation: "LINEAR",
          times: new Float32Array([0, 1]),
          values: new Float32Array([0.2, 0.4, 0.2, 0.4]),
          componentCount: 2,
        },
      ],
    };
    const additiveMorph: AnimationClip = {
      name: "additiveMorph",
      duration: 1,
      channels: [
        {
          targetId: "face",
          path: "weights",
          interpolation: "LINEAR",
          times: new Float32Array([0, 1]),
          values: new Float32Array([0.5, 0, 0.5, 0]),
          componentCount: 2,
        },
      ],
    };
    const mixer = new AnimationMixer([
      ["base", baseMorph],
      ["blink", additiveMorph],
    ]);
    mixer.playLane("base", { weight: 1 });
    mixer.playLane("blink", { additive: true, weight: 1 });
    mixer.update(0);

    const weights = mixer.weightChannels;
    expect(weights).toHaveLength(1);
    // base [0.2, 0.4] + additive delta [0.5, 0] = [0.7, 0.4].
    expect(weights[0]?.value[0]).toBeCloseTo(0.7, 6);
    expect(weights[0]?.value[1]).toBeCloseTo(0.4, 6);
  });
});

describe("AnimationMixer v2 — determinism", () => {
  it("replays a fixed lane setup + step schedule bit-identically", () => {
    const clips: Array<[string, AnimationClip]> = [
      ["idle", rampTranslation("idle", "hip", [0, 0, 0], [0, 0.5, 0], 2)],
      ["walk", rampTranslation("walk", "hip", [0, 0, 0], [1, 0, 0], 2)],
      ["run", rampTranslation("run", "hip", [0, 0, 0], [2, 0, 0], 1.5)],
    ];
    const lookAdditive = makeAdditiveClip(
      constantRotation("look", "head", [0, SQRT1_2, 0, SQRT1_2]),
      { referenceClip: constantRotation("rest", "head", [0, 0, 0, 1]) },
    );

    const run = (): BlendedAnimationChannel[][] => {
      const mixer = new AnimationMixer([...clips, ["look", lookAdditive]]);
      mixer.playLane("idle", { weight: 0.5, loop: "repeat" });
      mixer.playLane("walk", { weight: 0.3, loop: "repeat", speed: 1.25 });
      mixer.playLane("run", { weight: 0.2, loop: "pingpong", speed: 0.75 });
      mixer.playLane("look", {
        additive: true,
        weight: 0.6,
        fadeInSeconds: 0.5,
      });

      const frames: BlendedAnimationChannel[][] = [];
      const schedule = [0, 1 / 60, 1 / 60, 0.25, 1 / 30, 0.5, 1 / 60, 0.4];
      for (const dt of schedule) {
        frames.push(mixer.update(dt));
      }
      return frames;
    };

    expect(run()).toStrictEqual(run());
  });

  it("produces identical morph-weight channels across replays", () => {
    const morph: AnimationClip = {
      name: "morph",
      duration: 2,
      channels: [
        {
          targetId: "face",
          path: "weights",
          interpolation: "LINEAR",
          times: new Float32Array([0, 2]),
          values: new Float32Array([0, 0, 0, 1, 0.5, 0.25]),
          componentCount: 3,
        },
      ],
    };
    const capture = (): unknown[] => {
      const mixer = new AnimationMixer([["morph", morph]]);
      mixer.playLane("morph", { weight: 1, loop: "repeat" });
      const out: unknown[] = [];
      for (const dt of [0.3, 0.3, 0.3, 0.3]) {
        mixer.update(dt);
        out.push(
          mixer.weightChannels.map((c) => ({ ...c, value: [...c.value] })),
        );
      }
      return out;
    };
    expect(capture()).toStrictEqual(capture());
  });
});

describe("AnimationMixer v2 — v1 API preserved", () => {
  it("play() clears existing lanes and runs a single clip at weight 1", () => {
    const mixer = new AnimationMixer([
      ["a", constantTranslation("a", "hip", [1, 0, 0])],
      ["b", constantTranslation("b", "hip", [9, 0, 0])],
    ]);
    // Compose an N-lane blend, then a v1 play() must reset to a single lane.
    mixer.playLane("a", { weight: 0.5 });
    mixer.playLane("b", { weight: 0.5 });
    expect(mixer.state.laneCount).toBe(2);

    mixer.play("b", { loop: "repeat" });
    expect(mixer.state.laneCount).toBe(1);
    expect(mixer.activeClipId).toBe("b");
    expect(translationOf(mixer.update(0))[0]).toBeCloseTo(9, 6);
  });

  it("crossFadeTo() blends both clips mid-fade then settles on the target", () => {
    const mixer = new AnimationMixer([
      ["A", constantTranslation("A", "node:0", [0, 0, 0])],
      ["B", constantTranslation("B", "node:0", [10, 0, 0])],
    ]);
    mixer.play("A", { loop: "repeat" });
    mixer.update(0);

    mixer.crossFadeTo("B", 1.0);
    const mid = mixer.update(0.5);
    const midChannel = mid.find(
      (entry) => entry.targetId === "node:0" && entry.path === "translation",
    )!;
    expect(midChannel.value[0]).toBeCloseTo(5, 5);
    expect(midChannel.contributors.length).toBe(2);
    expect(mixer.isCrossFading).toBe(true);

    const settled = mixer.update(0.6);
    const settledChannel = settled.find(
      (entry) => entry.targetId === "node:0" && entry.path === "translation",
    )!;
    expect(settledChannel.value[0]).toBeCloseTo(10, 5);
    expect(settledChannel.contributors.length).toBe(1);
    expect(settledChannel.contributors[0]?.clipId).toBe("B");
    expect(mixer.isCrossFading).toBe(false);
    expect(mixer.activeClipId).toBe("B");
  });
});
