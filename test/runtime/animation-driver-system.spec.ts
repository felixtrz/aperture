import { describe, expect, it, vi } from "vitest";

import {
  LocalTransform,
  registerTransformComponents,
  type Entity,
  type EcsWorld,
} from "@aperture-engine/simulation";
import {
  createAnimationAccess,
  createSimulationApp,
  withAnimation,
  type AnimationClip,
} from "@aperture-engine/runtime";

function translationClip(
  name: string,
  to: readonly [number, number, number],
): AnimationClip {
  return {
    name,
    duration: 1,
    channels: [
      {
        targetId: "joint",
        path: "translation",
        interpolation: "LINEAR",
        times: new Float32Array([0, 1]),
        values: new Float32Array([0, 0, 0, ...to]),
        componentCount: 3,
      },
    ],
  };
}

function jointTranslation(joint: Entity): readonly number[] {
  return Array.from(joint.getVectorView(LocalTransform, "translation"));
}

describe("withAnimation + animation driver", () => {
  it("returns no-op animation controls for entities without driver state", () => {
    const app = createSimulationApp();
    const root = app.world.createEntity();
    const animation = createAnimationAccess(root);

    expect(animation.clipIds).toEqual([]);
    expect(animation.activeClipId).toBeNull();
    expect(animation.time).toBe(0);
    expect(animation.isCrossFading).toBe(false);
    expect(() => animation.playClip("Missing")).not.toThrow();
    expect(() => animation.crossFade("Idle", "Run", 0.25)).not.toThrow();
    expect(() => animation.pause()).not.toThrow();
    expect(() => animation.resume()).not.toThrow();
    expect(() => animation.seek(1)).not.toThrow();
  });

  it("no-ops with a warning on unknown clip ids instead of throwing (#60)", () => {
    const app = createSimulationApp();
    const world: EcsWorld = app.world;
    registerTransformComponents(world);

    const joint = world.createEntity();
    joint.addComponent(LocalTransform, {
      translation: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });

    const targets = new Map<string, Entity>([["joint", joint]]);
    const root = app.spawn(
      withAnimation({
        clips: [{ id: "Idle", clip: translationClip("Idle", [0, 1, 0]) }],
        targets,
      }),
    );

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const animation = createAnimationAccess(root);

      // A rig WITH clips + a typo'd id must not abort the run — it no-ops
      // with a diagnostic, mirroring the graceful empty-rig path.
      expect(() => animation.playClip("Bogus")).not.toThrow();
      expect(animation.activeClipId).toBeNull();
      expect(() => animation.crossFade("Idle", "Bogus", 0.2)).not.toThrow();
      expect(() => animation.crossFade("Missing", "Idle", 0.2)).not.toThrow();
      expect(warn).toHaveBeenCalledTimes(3);
      expect(warn.mock.calls[0]?.[0]).toContain('unknown clip id "Bogus"');
      expect(warn.mock.calls[0]?.[0]).toContain("Idle");

      // Repeated misuse of the same id (a per-frame update loop) warns once.
      animation.playClip("Bogus");
      createAnimationAccess(root).playClip("Bogus");
      expect(warn).toHaveBeenCalledTimes(3);

      // A valid id still plays.
      animation.playClip("Idle");
      expect(animation.activeClipId).toBe("Idle");
    } finally {
      warn.mockRestore();
    }
  });

  it("drives a bound target's LocalTransform through the engine driver each step", () => {
    const app = createSimulationApp();
    const world: EcsWorld = app.world;
    registerTransformComponents(world);

    // A standalone joint target with a LocalTransform.
    const joint = world.createEntity();
    joint.addComponent(LocalTransform, {
      translation: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });

    const targets = new Map<string, Entity>([["joint", joint]]);
    const root = app.spawn(
      withAnimation({
        clips: [{ id: "Walk", clip: translationClip("Walk", [0, 4, 0]) }],
        targets,
      }),
    );

    const animation = createAnimationAccess(root);
    expect(animation.clipIds).toEqual(["Walk"]);

    animation.playClip("Walk", { loop: "once" });
    app.step(0.5);

    // At t=0.5 the driver wrote the sampled clip value into the joint.
    expect(jointTranslation(joint)[1]).toBeCloseTo(2, 4);

    app.step(0.5);
    expect(jointTranslation(joint)[1]).toBeCloseTo(4, 4);
  });
});
