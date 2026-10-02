import { expect, it, vi } from "vitest";
import { createSystem as createEcsSystem } from "@aperture-engine/simulation";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { getApertureCleanupFailures } from "@aperture-engine/app/advanced";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import {
  resetOptions,
  resetRender,
} from "../helpers/reset-isolation-fixture.js";

vi.setConfig({ testTimeout: 60_000 });
it("preserves an unowned constructor error and blocks unsafe bootstrap retry", async () => {
  const primary = new Error("raw constructor failed");
  const Base = createEcsSystem();
  class RawOwner extends Base {
    constructor(...args: ConstructorParameters<typeof Base>) {
      super(...args);
      throw primary;
    }
  }
  const options = {
    ...resetOptions,
    config: defineApertureConfig({
      mode: "headless",
      render: resetRender,
      features: [
        {
          id: "raw-owner",
          installRuntime({ world }) {
            world.registerSystem(RawOwner);
          },
        },
      ],
    }),
    systems: [],
  };
  await expect(createHeadlessSessionController(options)).rejects.toMatchObject({
    cause: primary,
  });
  expect(getApertureCleanupFailures()).toHaveLength(1);
  expect((getApertureCleanupFailures()[0] as Error).cause).toBe(primary);
  await expect(createHeadlessSessionController(options)).rejects.toThrow(
    "Restart the process",
  );
});
