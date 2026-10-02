import { expect, it, vi } from "vitest";
import { createSystem } from "@aperture-engine/app/systems";
import { getApertureCleanupFailures } from "@aperture-engine/app/advanced";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import {
  resetFeatureFixture,
  resetOptions,
} from "../helpers/reset-isolation-fixture.js";

vi.setConfig({ testTimeout: 60_000 });
it("keeps failed bootstrap primary and blocks retry when candidate cleanup also fails", async () => {
  const fixture = resetFeatureFixture((_entity, generation) => {
    if (generation === 2) throw new Error("secondary feature cleanup failed");
  });
  const destroyed: string[] = [];
  let owners = 0;
  let boots = 0;
  class AOwnsResources extends createSystem({ priority: 0 }) {
    #id = ++owners;
    override async destroy(): Promise<void> {
      await Promise.resolve();
      destroyed.push(`owner-${this.#id}`);
      if (this.#id === 2) throw new Error("secondary system cleanup failed");
    }
  }
  class BFails extends createSystem({ priority: 1 }) {
    #id = ++boots;
    override init(): void {
      if (this.#id === 2) throw new Error("primary bootstrap failed");
    }
    override async destroy(): Promise<void> {
      await Promise.resolve();
      destroyed.push(`initializer-${this.#id}`);
    }
  }
  const controller = await createHeadlessSessionController({
    ...resetOptions,
    config: fixture.config,
    systems: [{ default: AOwnsResources }, { default: BFails }],
  });
  try {
    const error = await controller.reset().then(
      () => undefined,
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("primary bootstrap failed");
    expect((error as Error).message).not.toContain("secondary");
    expect(destroyed).toEqual([
      "owner-1",
      "initializer-1",
      "owner-2",
      "initializer-2",
    ]);
    expect(fixture.events).toEqual([
      "boot-1",
      "dispose-1",
      "boot-2",
      "dispose-2",
    ]);
    expect(getApertureCleanupFailures()).toHaveLength(2);
    expect(JSON.stringify(controller.status())).toContain(
      "secondary system cleanup failed",
    );
    expect(JSON.stringify(controller.status())).toContain(
      "secondary feature cleanup failed",
    );
    expect(controller.status()).toMatchObject({
      lifecycle: "failed",
      retryable: false,
      cleanupBlocked: true,
    });
    await expect(controller.reset()).rejects.toThrow("Restart the process");
    expect(fixture.entities).toHaveLength(2);
  } finally {
    await controller.dispose();
  }
});
