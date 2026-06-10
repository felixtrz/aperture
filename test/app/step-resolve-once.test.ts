import { describe, expect, it, vi } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import type { Entity } from "@aperture-engine/simulation";

// AI-60 cheap half (readiness roadmap R5): steady-state steps run exactly one
// world-transform resolve (the one inside lowLevel.step, after fixed-step
// physics writeback); the pre-step resolve+refresh only repeats when the
// world changed between steps (spawns, devtools writes, postUpdate effects).

const resolveCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock("@aperture-engine/simulation", async (importOriginal) => {
  // vi.mock's importOriginal generic requires an inline import() type.
  /* eslint-disable @typescript-eslint/consistent-type-imports */
  const actual =
    await importOriginal<typeof import("@aperture-engine/simulation")>();
  /* eslint-enable @typescript-eslint/consistent-type-imports */

  return {
    ...actual,
    resolveWorldTransforms: (
      ...args: Parameters<typeof actual.resolveWorldTransforms>
    ) => {
      resolveCalls.count += 1;
      return actual.resolveWorldTransforms(...args);
    },
  };
});

async function createStepApp() {
  const refs: { mover: Entity | null } = { mover: null };
  const SetupSystem = class extends createSystem({ priority: 0 }) {
    override init(): void {
      this.spawn.camera({
        key: "camera.step",
        transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] },
      });
      refs.mover = this.spawn.mesh({
        key: "step.mover",
        mesh: mesh.box({ size: 0.5 }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
    }
  };

  const app = await createApertureApp({
    config: defineApertureConfig({ mode: "headless", systems: [] }),
    systems: [{ default: SetupSystem }],
  });

  return { app, refs };
}

describe("one resolve per steady-state step (AI-60 cheap half)", () => {
  it("resolves world transforms exactly once per unchanged step and re-resolves after external mutations", async () => {
    const { app } = await createStepApp();

    // Settle: the first step after creation sees the init spawns as external
    // changes and may pre-resolve once.
    app.step(1 / 60, 0);

    // Steady state: no mutations between steps -> exactly one resolve per
    // step (the internal post-fixed-step one) and the step still works.
    resolveCalls.count = 0;
    app.step(1 / 60, 1 / 60);
    expect(resolveCalls.count).toBe(1);

    resolveCalls.count = 0;
    app.step(1 / 60, 2 / 60);
    expect(resolveCalls.count).toBe(1);

    // An out-of-step mutation (the devtools/test pattern) bumps the world
    // change version, so the next step pre-resolves again before systems run.
    const spawned = app.context.spawn.mesh({
      key: "step.spawned",
      mesh: mesh.box({ size: 0.25 }),
      material: material.standard(),
      transform: { translation: [1, 0, 0] },
    });
    resolveCalls.count = 0;
    app.step(1 / 60, 3 / 60);
    expect(resolveCalls.count).toBe(2);

    // And the spawned entity is fully materialized in the extracted frame.
    const snapshot = app.extract(1);
    expect(
      snapshot.meshDraws.some((draw) => draw.entity.index === spawned.index),
    ).toBe(true);

    // Back to steady state afterwards.
    resolveCalls.count = 0;
    app.step(1 / 60, 4 / 60);
    expect(resolveCalls.count).toBe(1);
  });
});
