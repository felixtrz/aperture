import { describe, expect, it } from "vitest";
import {
  advanceFixedStepClock,
  createFixedStepClock,
  resetFixedStepClock,
} from "@aperture-engine/physics";

describe("fixed-step clock", () => {
  it("runs zero, one, and many fixed substeps deterministically", () => {
    const clock = createFixedStepClock({
      fixedDelta: 0.1,
      maxSubsteps: 4,
    });

    expect(advanceFixedStepClock(clock, 0.05)).toMatchObject({
      substeps: 0,
      fixedStepStart: 0,
      fixedStepEnd: 0,
      overstepAlpha: 0.5,
    });

    expect(advanceFixedStepClock(clock, 0.05)).toMatchObject({
      substeps: 1,
      fixedStepStart: 0,
      fixedStepEnd: 1,
      overstepAlpha: 0,
    });

    const many = advanceFixedStepClock(clock, 0.35);
    expect(many).toMatchObject({
      substeps: 3,
      fixedStepStart: 1,
      fixedStepEnd: 4,
    });
    expect(many.overstepAlpha).toBeCloseTo(0.5);
  });

  it("clamps accumulated time and reports dropped time", () => {
    const clock = createFixedStepClock({
      fixedDelta: 0.1,
      maxSubsteps: 2,
      maxAccumulatedTime: 0.2,
    });

    const result = advanceFixedStepClock(clock, 1);

    expect(result.substeps).toBe(2);
    expect(result.clamped).toBe(true);
    expect(result.droppedTime).toBeCloseTo(0.8);
    expect(clock.fixedStepIndex).toBe(2);
    expect(clock.accumulator).toBeCloseTo(0);
  });

  it("can reset deterministic clock state", () => {
    const clock = createFixedStepClock({ fixedDelta: 0.1 });
    advanceFixedStepClock(clock, 0.25);

    resetFixedStepClock(clock);

    expect(clock).toMatchObject({
      accumulator: 0,
      fixedStepIndex: 0,
      overstepAlpha: 0,
      droppedTime: 0,
    });
  });

  it("rejects accumulator settings the substep cap cannot drain", () => {
    expect(() =>
      createFixedStepClock({
        fixedDelta: 0.1,
        maxSubsteps: 2,
        maxAccumulatedTime: 0.05,
      }),
    ).toThrow("maxAccumulatedTime must be at least fixedDelta");

    expect(() =>
      createFixedStepClock({
        fixedDelta: 0.1,
        maxSubsteps: 2,
        maxAccumulatedTime: 0.3,
      }),
    ).toThrow("maxAccumulatedTime must not exceed fixedDelta * maxSubsteps");
  });
});
