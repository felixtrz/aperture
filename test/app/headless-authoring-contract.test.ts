import { beforeEach, describe, expect, it } from "vitest";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { disposeApertureApp } from "@aperture-engine/app/advanced";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type { ApertureWorkerFeature } from "@aperture-engine/app/features";
import * as scene from "./fixtures/headless-contract.system.js";

const api = {
  createApertureHeadlessRunner,
  disposeApertureApp,
  defineApertureConfig,
  scene,
};
beforeEach(() => {
  scene.lifecycle.initialized = 0;
  scene.lifecycle.destroyed = 0;
  scene.lifecycle.destroy = async () => {};
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("public headless authoring contract", () => {
  it("recovers an already imported default class from the observed resolved-module mistake", async () => {
    const config = api.defineApertureConfig({
      mode: "headless",
      systems: [],
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
    });
    await expect(
      api.createApertureHeadlessRunner({
        config,
        // @ts-expect-error The public input is a module, not its resolved form.
        systems: [{ System: api.scene.default, priority: 0 }],
      }),
    ).rejects.toMatchObject({
      code: "aperture.system.missingDefaultExport",
      detail: { index: 0 },
      suggestedFix: expect.stringMatching(
        /systems: \[sceneModule\].*systems: \[\{ default: SceneSystem \}\].*createSystem\(\{ priority: 0 \}\)/u,
      ),
    });
    expect(api.scene.lifecycle.initialized).toBe(0);

    const runner = await api.createApertureHeadlessRunner({
      config,
      systems: [{ default: api.scene.default }],
    });
    try {
      expect(api.scene.lifecycle.initialized).toBe(1);
      const { snapshot } = runner.step(1 / 60, 0);
      expect(snapshot.meshDraws).toHaveLength(1);
      expect(snapshot.diagnostics).toEqual([]);
      expect(
        runner.entities.find({ key: "headless.contract.mesh" }).summaries,
      ).toHaveLength(1);
      expect(runner.sessionBootstrap.systemModules[0]).toMatchObject({
        exportName: "default",
        className: "ImportedScene",
        priority: 7,
      });
    } finally {
      expect(await api.disposeApertureApp(runner.app)).toEqual([]);
    }
    expect(api.scene.lifecycle.destroyed).toBe(1);
  });

  it("accepts a namespace module and awaits full system and feature ownership once", async () => {
    const systemStarted = deferred();
    const systemReleased = deferred();
    const featureStarted = deferred();
    const featureReleased = deferred();
    const events: string[] = [];
    api.scene.lifecycle.destroy = async () => {
      events.push("system:start");
      systemStarted.resolve();
      await systemReleased.promise;
      events.push("system:end");
    };
    const feature: ApertureWorkerFeature = {
      id: "headless-contract-owner",
      installRuntime() {
        return async () => {
          events.push("feature:start");
          featureStarted.resolve();
          await featureReleased.promise;
          events.push("feature:end");
        };
      },
    };
    const runner = await api.createApertureHeadlessRunner({
      config: api.defineApertureConfig({
        mode: "headless",
        systems: [],
        features: [feature],
        render: { defaultEnvironment: false },
      }),
      systems: [api.scene],
    });
    const cleanup = api.disposeApertureApp(runner.app);
    expect(api.disposeApertureApp(runner.app)).toBe(cleanup);
    let completed = false;
    void cleanup.then(() => {
      completed = true;
    });
    try {
      await systemStarted.promise;
      expect(events).toEqual(["system:start"]);
      expect(completed).toBe(false);
      systemReleased.resolve();
      await featureStarted.promise;
      expect(events).toEqual(["system:start", "system:end", "feature:start"]);
      expect(completed).toBe(false);
      featureReleased.resolve();
      expect(await cleanup).toEqual([]);
      expect(await api.disposeApertureApp(runner.app)).toEqual([]);
      expect(api.scene.lifecycle.destroyed).toBe(1);
      expect(events).toEqual([
        "system:start",
        "system:end",
        "feature:start",
        "feature:end",
      ]);
    } finally {
      systemReleased.resolve();
      featureReleased.resolve();
      await cleanup;
    }
  }, 15000);
});
