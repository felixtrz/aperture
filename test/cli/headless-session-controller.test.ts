import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import type { ApertureSessionSnapshot } from "@aperture-engine/app/headless";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";

describe("HeadlessSessionController", () => {
  it("advances multi-frame step time by one delta per frame", async () => {
    const times: number[] = [];
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class TimingSystem extends createSystem() {
            override update(): void {
              times.push(this.time.elapsed);
            }
          },
        },
      ],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });

    try {
      controller.step({ frames: 3, delta: 0.5 });
      expect(times).toEqual([0, 0.5, 1]);

      times.length = 0;
      controller.step({ frames: 3, delta: 0.5, time: 10 });
      expect(times).toEqual([10, 10.5, 11]);
    } finally {
      controller.dispose();
    }
  });

  it("exposes headless system metadata through ecs_list_systems", async () => {
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class ListedSystem extends createSystem({ priority: 7 }) {},
        },
      ],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });

    try {
      expect(
        controller.callTool({ name: "ecs_list_systems", arguments: {} }),
      ).toMatchObject({
        ok: true,
        result: {
          systems: [
            {
              className: "ListedSystem",
              // F14: a top-level numeric priority (sourced from the registered
              // system instance), plus the retained nested value.
              priority: 7,
              schedule: { priority: 7 },
            },
          ],
        },
      });
    } finally {
      controller.dispose();
    }
  });

  it("dispatches app commands onto the bus for systems to drain (F16)", async () => {
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class CommandSystem extends createSystem() {
            override update(): void {
              for (const command of this.commands.drain<{ key: string }>(
                "spawn",
              )) {
                this.spawn.mesh({
                  key: command.key,
                  mesh: mesh.box({ size: [1, 1, 1] }),
                  material: material.standard(),
                  transform: { translation: [0, 0, 0] },
                });
              }
            }
          },
        },
      ],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });

    try {
      const dispatch = controller.dispatchCommand({
        channel: "spawn",
        payload: { key: "fromCommand" },
      }) as { dispatched: boolean };
      expect(dispatch.dispatched).toBe(true);

      controller.step({ frames: 1 });

      const found = controller.callTool({
        name: "ecs_query",
        arguments: { key: "fromCommand" },
      }) as { result?: { summaries?: readonly { key?: string }[] } };
      expect((found.result?.summaries ?? []).map((s) => s.key)).toEqual([
        "fromCommand",
      ]);
    } finally {
      controller.dispose();
    }
  });

  it("fails a step under --determinism error and echoes violations (F11)", async () => {
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class NondeterministicSystem extends createSystem() {
            override update(): void {
              // Deliberate nondeterministic global use.
              void Math.random();
            }
          },
        },
      ],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "error",
    });

    try {
      expect(() => controller.step({ frames: 1 })).toThrowError(
        /determinismViolation|nondeterministic/i,
      );
    } finally {
      controller.dispose();
    }
  });

  it("echoes determinism violations without failing in warn mode (F11)", async () => {
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class NondeterministicSystem extends createSystem() {
            override update(): void {
              void Math.random();
            }
          },
        },
      ],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "warn",
    });

    try {
      const result = controller.step({ frames: 1 }) as {
        determinism?: { violations?: readonly unknown[] };
      };
      expect(result.determinism?.violations?.length ?? 0).toBeGreaterThan(0);
    } finally {
      controller.dispose();
    }
  });

  it("steps without extraction when extract:false (F18)", async () => {
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });

    try {
      const result = controller.step({ frames: 5, extract: false }) as {
        nextFrame: number;
        extracted: boolean;
      };
      expect(result.extracted).toBe(false);
      expect(result.nextFrame).toBe(5);
    } finally {
      controller.dispose();
    }
  });

  it("saves and restores a SessionSnapshot checkpoint (F15)", async () => {
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });

    const out = path.join(
      os.tmpdir(),
      `aperture-session-snapshot-${process.pid}.json`,
    );

    try {
      controller.step({ frames: 10 });
      const saved = (await controller.saveSessionSnapshot({ out })) as {
        frame: number;
      };
      expect(saved.frame).toBe(10);

      // Advance further, then restore back to the checkpoint.
      controller.step({ frames: 5 });
      const snapshot = JSON.parse(
        await readFile(out, "utf8"),
      ) as ApertureSessionSnapshot;
      const restored = (await controller.restoreSessionSnapshot({
        snapshot,
      })) as { ok: boolean; status: { nextFrame: number } };

      expect(restored.ok).toBe(true);
      expect(restored.status.nextFrame).toBe(10);
    } finally {
      controller.dispose();
      await rm(out, { force: true });
    }
  });
});
