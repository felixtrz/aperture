import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineApertureConfig, input } from "@aperture-engine/app/config";
import {
  EcsType,
  createSystem,
  defineComponent,
  defineResource,
  material,
  mesh,
  resource,
} from "@aperture-engine/app/systems";
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

  it("supports input_inject and logs_read as headless tools (#71)", async () => {
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        input: {
          actions: {
            jump: input.button([input.key("Space")]),
          },
        },
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
      // input_inject is documented as part of the headless loop; it must not
      // return aperture.headless.toolUnavailable.
      const injected = controller.callTool({
        name: "input_inject",
        arguments: {
          actions: { jump: true },
          pointer: { position: [0.5, 0.5] },
        },
      });
      expect(injected.ok).toBe(true);
      expect(JSON.stringify(injected)).not.toContain("toolUnavailable");

      const logs = controller.callTool({
        name: "logs_read",
        arguments: { lines: 20 },
      }) as { ok: boolean; result?: { entries?: readonly unknown[] } };
      expect(logs.ok).toBe(true);
      expect(Array.isArray(logs.result?.entries)).toBe(true);

      // Genuinely unsupported tools now name the supported set in the hint.
      const missing = controller.callTool({ name: "browser_reload" });
      expect(missing.ok).toBe(false);
      expect(JSON.stringify(missing.diagnostics)).toContain("input_inject");
    } finally {
      controller.dispose();
    }
  });

  it("survives reset with a module-scope custom component (#63)", async () => {
    // Module singleton: the SAME component object is reused by the system on
    // every boot, exactly like an app module's defineComponent.
    const ResetProbe = defineComponent(
      "test.resetProbe63",
      { hits: { type: EcsType.Int32, default: 0 } },
      "Reset regression probe component.",
    );

    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class ProbeSystem extends createSystem() {
            #spawned = false;
            override update(): void {
              if (this.#spawned) {
                return;
              }
              this.#spawned = true;
              const entity = this.spawn.mesh({
                key: "probe",
                mesh: mesh.box({ size: [1, 1, 1] }),
                material: material.standard(),
                transform: { translation: [0, 0, 0] },
              });
              entity.addComponent(ResetProbe, { hits: 1 });
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
      controller.step({ frames: 1 });

      // Boot #2 in the same process. Before the fix the stale world-1
      // bitmask crashed the next entity-summary read with
      // "Cannot read properties of null (reading 'id')".
      await controller.reset({ seed: 0 });
      controller.step({ frames: 1 });

      const found = controller.callTool({
        name: "ecs_query",
        arguments: { key: "probe" },
      }) as {
        ok: boolean;
        result?: { summaries?: readonly { componentIds?: string[] }[] };
      };
      expect(found.ok).toBe(true);
      expect(found.result?.summaries?.[0]?.componentIds).toContain(
        "test.resetProbe63",
      );

      const value = controller.callTool({
        name: "ecs_get_entity",
        arguments: { key: "probe" },
      }) as { ok: boolean };
      expect(value.ok).toBe(true);
    } finally {
      controller.dispose();
    }
  });

  it("restores custom components, resources, and runtime schemas (#64, #65)", async () => {
    const Star = defineComponent(
      "test.star64",
      { value: { type: EcsType.Int32, default: 0 } },
      "Snapshot restore regression component.",
    );
    const Director = defineResource("test.director64", {
      spawned: resource.number(0),
    });

    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class DirectorSystem extends createSystem() {
            #spawned = false;
            override update(): void {
              // Spawn at runtime (frame >= 3), NOT at init: the schema
              // catalog and the restore world must still see the component.
              if (this.#spawned || this.time.elapsed < 3 / 60) {
                return;
              }
              this.#spawned = true;
              const entity = this.spawn.mesh({
                key: "star",
                mesh: mesh.box({ size: [1, 1, 1] }),
                material: material.standard(),
                transform: { translation: [0, 1, 0] },
              });
              entity.addComponent(Star, { value: 42 });
              this.resources.write(Director, (state) => {
                state.spawned += 1;
              });
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

    const out = path.join(
      os.tmpdir(),
      `aperture-session-snapshot-custom-${process.pid}.json`,
    );

    try {
      // Register the schema catalog's enumeration early, then spawn later:
      // runtime-spawned entities must still be visible (#65).
      controller.callTool({
        name: "ecs_get_component_schema",
        arguments: {},
      });

      controller.step({ frames: 10 });

      const schema = controller.callTool({
        name: "ecs_get_component_schema",
        arguments: { component: "test.star64" },
      }) as { ok: boolean; result?: { schemas?: readonly { id: string }[] } };
      expect(schema.ok).toBe(true);
      expect(schema.result?.schemas?.[0]?.id).toBe("test.star64");

      await controller.saveSessionSnapshot({ out });
      const snapshot = JSON.parse(
        await readFile(out, "utf8"),
      ) as ApertureSessionSnapshot;

      // Restore boots a FRESH runner whose world has never seen the custom
      // component or resource; both must come back from the snapshot (#64).
      const restored = (await controller.restoreSessionSnapshot({
        snapshot,
      })) as {
        ok: boolean;
        restore: {
          scene: { ok: boolean };
          resources: { restored: number; missing: readonly string[] };
        };
      };

      expect(restored.restore.resources.missing).toEqual([]);
      expect(restored.restore.scene.ok).toBe(true);
      expect(restored.ok).toBe(true);

      const star = controller.callTool({
        name: "ecs_query",
        arguments: { withComponents: ["test.star64"] },
      }) as { ok: boolean; result?: { summaries?: readonly unknown[] } };
      expect(star.ok).toBe(true);
      expect(star.result?.summaries?.length).toBe(1);

      const director = controller.callTool({
        name: "resource_get",
        arguments: { id: "test.director64" },
      }) as {
        ok: boolean;
        result?: { values?: { spawned?: number } } & {
          resource?: { values?: { spawned?: number } };
        };
      };
      expect(director.ok).toBe(true);
    } finally {
      controller.dispose();
      await rm(out, { force: true });
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
