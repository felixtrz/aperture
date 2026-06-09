import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  LocalTransform,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";
import type { Entity } from "@aperture-engine/simulation";

// AI-55 clock half (readiness roadmap R2.2): wall-clock delivery cadence must
// not leak into simulation results. Stepping the app with irregular wall
// deltas must produce exactly the same fixed-tick sequence and the same
// fixed-step-driven state as regular deltas of equal total time.

const FIXED_DELTA = 0.1;

// Both schedules sum to 1.2s => exactly 12 fixed ticks.
const REGULAR_DELTAS = Array.from({ length: 12 }, () => FIXED_DELTA);
const IRREGULAR_DELTAS = [0.05, 0.25, 0.1, 0.02, 0.08, 0.3, 0.15, 0.05, 0.2];

interface ClockRun {
  readonly ticks: readonly number[];
  readonly reportedFixedSteps: readonly number[];
  readonly moverX: number;
}

async function runClock(deltas: readonly number[]): Promise<ClockRun> {
  const refs: { mover: Entity | null } = { mover: null };
  const SetupSystem = class extends createSystem({ priority: 0 }) {
    override init(): void {
      refs.mover = this.spawn.mesh({
        key: "clock.mover",
        mesh: mesh.box({ size: 0.5 }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
    }
  };

  const ticks: number[] = [];
  const app = await createApertureApp({
    config: defineApertureConfig({ mode: "headless", systems: [] }),
    systems: [{ default: SetupSystem }],
    fixedStep: {
      fixedDelta: FIXED_DELTA,
      update(context) {
        ticks.push(context.fixedStep);
        const translation = refs.mover?.getVectorView(
          LocalTransform,
          "translation",
        );

        if (translation !== undefined) {
          // Advance by the fixed delta so the final pose encodes exactly how
          // many ticks ran and with which delta.
          translation[0] = Number(translation[0] ?? 0) + context.fixedDelta;
        }
      },
    },
  });

  const reportedFixedSteps: number[] = [];
  let time = 0;

  for (const delta of deltas) {
    time += delta;
    const report = app.step(delta, time);
    reportedFixedSteps.push(
      (report.fixedStep as { readonly substeps?: number }).substeps ?? 0,
    );
  }

  const moverX = Number(
    refs.mover?.getVectorView(LocalTransform, "translation")[0] ?? Number.NaN,
  );

  return { ticks, reportedFixedSteps, moverX };
}

describe("fixed-rate sim clock (AI-55 clock half)", () => {
  it("produces the same fixed-tick sequence for irregular and regular wall deltas of equal total", async () => {
    const regular = await runClock(REGULAR_DELTAS);
    const irregular = await runClock(IRREGULAR_DELTAS);

    // Exactly 12 ticks either way, numbered identically (0-indexed).
    expect(regular.ticks).toEqual(
      Array.from({ length: 12 }, (_, index) => index),
    );
    expect(irregular.ticks).toEqual(regular.ticks);

    // The total number of substeps reported by step() is identical
    // regardless of delivery cadence.
    const total = (steps: readonly number[]) =>
      steps.reduce((sum, count) => sum + count, 0);
    expect(total(irregular.reportedFixedSteps)).toBe(
      total(regular.reportedFixedSteps),
    );
    expect(total(regular.reportedFixedSteps)).toBe(12);

    // Fixed-step-driven state is bit-identical: 12 ticks x 0.1 each.
    expect(irregular.moverX).toBe(regular.moverX);
    expect(regular.moverX).toBeCloseTo(1.2, 5);
  });

  it("carries fractional accumulator remainders across steps instead of dropping them", async () => {
    // 0.15 + 0.15 = 0.3 => 3 ticks, even though each step alone only covers
    // one full tick plus a remainder.
    const run = await runClock([0.15, 0.15]);

    expect(run.ticks).toEqual([0, 1, 2]);
    expect(run.moverX).toBeCloseTo(0.3, 5);
  });
});
