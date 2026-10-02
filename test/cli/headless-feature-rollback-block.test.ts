import { expect, it, vi } from "vitest";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import { getApertureCleanupFailures } from "@aperture-engine/app/advanced";
import {
  resetOptions,
  resetRender,
} from "../helpers/reset-isolation-fixture.js";

vi.setConfig({ testTimeout: 60_000 });
it("preserves feature installation failure and records failed rollback before forbidding another boot", async () => {
  const events: string[] = [];
  const primary = new Error("primary feature failed");
  const options = {
    ...resetOptions,
    systems: [],
    config: defineApertureConfig({
      mode: "headless",
      render: resetRender,
      features: [
        {
          id: "first",
          installRuntime() {
            events.push("first-installed");
            return async () => {
              await Promise.resolve();
              events.push("first-disposed");
              throw new Error("secondary rollback failed");
            };
          },
        },
        {
          id: "second",
          requires: ["first"],
          installRuntime() {
            throw primary;
          },
        },
      ],
    }),
  };
  const error = await createHeadlessSessionController(options).then(
    () => undefined,
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).cause).toBe(primary);
  expect((error as Error).message).not.toContain("secondary rollback failed");
  expect(getApertureCleanupFailures()).toHaveLength(1);
  expect(events).toEqual(["first-installed", "first-disposed"]);
  await expect(createHeadlessSessionController(options)).rejects.toThrow(
    "Restart the process",
  );
  expect(events).toEqual(["first-installed", "first-disposed"]);
});
