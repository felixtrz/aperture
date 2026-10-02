import { expect, it, vi } from "vitest";
import { createSystem } from "@aperture-engine/app/systems";
import { createApertureSessionSnapshot } from "@aperture-engine/app/headless";
import { getApertureCleanupFailures } from "@aperture-engine/app/advanced";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";
import {
  resetFeatureFixture,
  resetOptions,
} from "../helpers/reset-isolation-fixture.js";

// This worker models a process that must stay blocked for the rest of its life.
// Keep the real circuit breaker and intentionally run one scenario per file.
vi.setConfig({ testTimeout: 60_000 });
it("blocks every managed headless reboot after old teardown fails, while attempting all owners once", async () => {
  const cleanup: string[] = [];
  const primary = new Error("old owner did not stop");
  const fixture = resetFeatureFixture(() => {
    cleanup.push("feature");
  });
  class BadOwner extends createSystem({ priority: 0 }) {
    override async destroy(): Promise<void> {
      await Promise.resolve();
      cleanup.push("bad-system");
      throw primary;
    }
  }
  class HealthyOwner extends createSystem({ priority: 1 }) {
    override async destroy(): Promise<void> {
      await Promise.resolve();
      cleanup.push("healthy-system");
    }
  }
  const options = {
    ...resetOptions,
    config: fixture.config,
    systems: [{ default: BadOwner }, { default: HealthyOwner }],
  };
  const controller = await createHeadlessSessionController(options);
  const snapshot = createApertureSessionSnapshot(controller.runner);
  const manager = new ApertureMcpSessionManager({ cwd: process.cwd() });
  try {
    await expect(controller.reset()).rejects.toThrow("Restart the process");
    expect(cleanup).toEqual(["bad-system", "healthy-system", "feature"]);
    expect(fixture.entities).toHaveLength(1);
    expect(getApertureCleanupFailures()).toContain(primary);
    expect(controller.status()).toMatchObject({
      lifecycle: "failed",
      running: false,
      retryable: false,
      cleanupBlocked: true,
    });
    expect(JSON.stringify(controller.status())).toContain(primary.message);
    expect(
      JSON.stringify(controller.callTool({ name: "logs_read" })),
    ).toContain(primary.message);
    expect(() => controller.step()).toThrow("restart the process");
    expect(() => controller.runner).toThrow("session is failed");
    await expect(controller.reset()).rejects.toThrow("Restart the process");
    await expect(
      controller.restoreSessionSnapshot({ snapshot }),
    ).rejects.toThrow("Restart the process");
    await expect(createHeadlessSessionController(options)).rejects.toThrow(
      "Restart the process",
    );
    const mcp = await manager.call({
      name: "app_start",
      args: { target: "headless", config: "unused.ts" },
    });
    expect(mcp).toMatchObject({ ok: false });
    expect(JSON.stringify(mcp)).toContain("Restart the process");
    expect(fixture.entities).toHaveLength(1);
    const first = controller.dispose();
    expect(controller.dispose()).toBe(first);
    await first;
    expect(cleanup).toEqual(["bad-system", "healthy-system", "feature"]);
  } finally {
    await controller.dispose();
    await manager.dispose();
  }
});
