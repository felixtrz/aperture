import { expect, it } from "vitest";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { disposeApertureApp } from "@aperture-engine/app/advanced";
import { defineApertureConfig } from "@aperture-engine/app/config";
import * as scene from "./fixtures/headless-contract.system.js";

// This file models a process that remains blocked after real cleanup failure.
// Keep it isolated, without resetting component registrations or safety state.
it("returns cleanup errors while still releasing features and blocks unsafe reuse", async () => {
  const failure = new Error("headless system cleanup failed");
  scene.lifecycle.destroy = async () => {
    throw failure;
  };
  let featureDisposed = 0;
  const config = defineApertureConfig({
    mode: "headless",
    systems: [],
    render: { defaultEnvironment: false },
    features: [
      {
        id: "headless-contract-cleanup-error",
        installRuntime() {
          return () => {
            featureDisposed += 1;
          };
        },
      },
    ],
  });
  const runner = await createApertureHeadlessRunner({
    config,
    systems: [scene],
  });
  const cleanup = disposeApertureApp(runner.app);
  const errors = await cleanup;
  expect(errors).toEqual([failure]);
  expect(featureDisposed).toBe(1);
  expect(scene.lifecycle.destroyed).toBe(1);
  expect(disposeApertureApp(runner.app)).toBe(cleanup);
  expect(await disposeApertureApp(runner.app)).toBe(errors);
  await expect(
    createApertureHeadlessRunner({ config, systems: [scene] }),
  ).rejects.toMatchObject({ code: "aperture.app.cleanupBlocked" });
});
