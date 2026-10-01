import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as headless from "@aperture-engine/app/headless";
import { runHeadlessCommand } from "../../packages/cli/src/commands/headless.js";
import { disposeHeadlessRunner } from "../../packages/cli/src/headless/dispose-runner.js";
import { headlessLifecycleFixture } from "../helpers/headless-lifecycle-fixture.js";

const roots: string[] = [];
const runners: headless.ApertureHeadlessRunner[] = [];
vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  const create = headless.createApertureHeadlessRunner;
  vi.spyOn(headless, "createApertureHeadlessRunner").mockImplementation(
    async (options) => {
      const runner = await create(options);
      runners.push(runner);
      return runner;
    },
  );
});

afterEach(async () => {
  for (const runner of runners.splice(0)) await disposeHeadlessRunner(runner);
  vi.restoreAllMocks();
  for (const root of roots.splice(0))
    await rm(root, { force: true, recursive: true });
});

describe("CLI-owned headless runner disposal", () => {
  it("awaits every owner once and returns failures after completing cleanup", async () => {
    const order: string[] = [];
    const first = new Error("first destroy failed");
    const last = new Error("feature failed");
    const runner = {
      app: {
        lowLevel: {
          world: {
            getSystems: () => [
              {
                async destroy() {
                  await Promise.resolve();
                  order.push("first");
                  throw first;
                },
              },
              {
                async destroy() {
                  await Promise.resolve();
                  order.push("second");
                },
              },
            ],
          },
        },
        async dispose() {
          await Promise.resolve();
          order.push("feature");
          throw last;
        },
      },
    } as unknown as headless.ApertureHeadlessRunner;
    const pending = disposeHeadlessRunner(runner);
    expect(disposeHeadlessRunner(runner)).toBe(pending);
    expect(await pending).toEqual([first, last]);
    await disposeHeadlessRunner(runner);
    expect(order).toEqual(["first", "second", "feature"]);
  });

  it("retains cleanup ownership when a system unregisters itself", async () => {
    const order: string[] = [];
    const systems = [
      {
        destroy() {
          systems.shift();
          order.push("first");
        },
      },
      {
        destroy() {
          order.push("second");
        },
      },
    ];
    const runner = {
      app: {
        lowLevel: { world: { getSystems: () => systems } },
        async dispose() {
          order.push("feature");
        },
      },
    } as unknown as headless.ApertureHeadlessRunner;
    expect(await disposeHeadlessRunner(runner)).toEqual([]);
    expect(order).toEqual(["first", "second", "feature"]);
  });

  it("still disposes the app when system enumeration fails", async () => {
    const error = new Error("systems unavailable");
    const dispose = vi.fn(async () => {});
    const runner = {
      app: {
        lowLevel: {
          world: {
            getSystems() {
              throw error;
            },
          },
        },
        dispose,
      },
    } as unknown as headless.ApertureHeadlessRunner;
    expect(await disposeHeadlessRunner(runner)).toEqual([error]);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("cleans up when a one-shot stdout callback throws", async () => {
    const fixture = await headlessLifecycleFixture();
    roots.push(fixture.root);
    const primary = new Error("primary output failure");
    await expect(
      runHeadlessCommand({
        argv: [
          fixture.config,
          "--out",
          path.join(fixture.root, "frame.bundle.json"),
          "--frames",
          "1",
        ],
        cwd: fixture.root,
        stdout() {
          throw primary;
        },
      }),
    ).rejects.toBe(primary);
    expect(await readFile(fixture.marker, "utf8")).toBe("system\nfeature\n");
  });

  it("preserves the primary output error even if cleanup and diagnostic output fail", async () => {
    const fixture = await headlessLifecycleFixture(true);
    roots.push(fixture.root);
    const primary = new Error("primary output failure");
    await expect(
      runHeadlessCommand({
        argv: [
          fixture.config,
          "--out",
          path.join(fixture.root, "frame.bundle.json"),
          "--frames",
          "1",
        ],
        cwd: fixture.root,
        stdout() {
          throw primary;
        },
        stderr(text) {
          if (text.includes("runnerDisposeFailed"))
            throw new Error("diagnostic output failure");
        },
      }),
    ).rejects.toBe(primary);
    expect(await readFile(fixture.marker, "utf8")).toBe("system\nfeature\n");
  });

  it("reports cleanup-only failures instead of returning success", async () => {
    const fixture = await headlessLifecycleFixture(true);
    roots.push(fixture.root);
    await expect(
      runHeadlessCommand({
        argv: [
          fixture.config,
          "--out",
          path.join(fixture.root, "frame.bundle.json"),
          "--frames",
          "1",
        ],
        cwd: fixture.root,
        stdout() {},
      }),
    ).rejects.toThrow(
      "Failed to dispose the headless command runner: system cleanup failure",
    );
    expect(await readFile(fixture.marker, "utf8")).toBe("system\nfeature\n");
  });
});
