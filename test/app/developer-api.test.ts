import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as appRoot from "@aperture-engine/app";
import {
  createApertureApp,
  type ApertureSystemModule,
} from "@aperture-engine/app/advanced";
import {
  AppEntityKey,
  LocalTransform,
  Name,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";
import {
  asset,
  defineApertureConfig,
  signal,
} from "@aperture-engine/app/config";
import { createApertureSystemManifest } from "@aperture-engine/vite-plugin";

describe("developer-facing app API", () => {
  it("defines config assets and keeps the app root free of Vite plugin exports", () => {
    const config = defineApertureConfig({
      mode: "browser",
      canvas: "#aperture",
      systems: ["src/systems/**/*.system.ts"],
      assets: {
        robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
        floorColor: asset.texture("/assets/floor.png", {
          preload: "background",
        }),
        studio: asset.hdr("/assets/studio.hdr", { preload: "manual" }),
      },
      signals: {
        selectedEntity: signal.ref(null),
        gameplayMode: signal.string("edit"),
      },
      render: {
        clearColor: [0.03, 0.035, 0.04, 1],
        defaultCamera: true,
        defaultLight: true,
      },
    });

    expect(config.assets.robot).toMatchObject({
      kind: "gltf",
      url: "/assets/robot.glb",
      preload: "blocking",
    });
    expect("aperture" in appRoot).toBe(false);
  });

  it("runs config-declared systems through the headless app facade with priority and lifecycle effects", async () => {
    const events: string[] = [];
    let resolveBackground!: () => void;
    const backgroundLoaded = new Promise<void>((resolve) => {
      resolveBackground = resolve;
    });
    const config = defineApertureConfig({
      mode: "headless",
      systems: ["src/systems/**/*.system.ts"],
      assets: {
        robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
        floorColor: asset.texture("/assets/floor.png", {
          preload: "background",
        }),
        decal: asset.texture("/assets/decal.png", {
          preload: "manual",
        }),
      },
      signals: {
        selectedEntity: signal.ref(null),
      },
      input: {
        actions: {
          select: [{ pointer: "primary" }],
        },
      },
    });

    const SetupSystemModule: ApertureSystemModule = {
      default: class SetupSystem extends createSystem() {
        override init(): void {
          this.spawn.camera({
            key: "camera.main",
            name: "main-camera",
            transform: { translation: [0, 1.5, 5], lookAt: [0, 0.5, 0] },
          });
          this.spawn.light({
            key: "light.key",
            name: "key-light",
            kind: "directional",
            illuminance: 4,
            transform: { rotationEulerDegrees: [-45, 35, 0] },
          });
          this.spawn.mesh({
            key: "level.crate.primary",
            name: "crate",
            mesh: mesh.box({ size: [1, 1, 1] }),
            material: material.standard({
              baseColor: [1, 0.55, 0.25, 1],
              roughness: 0.55,
              metallic: 0.05,
            }),
            transform: { translation: [0, 0.5, 0] },
          });
          this.spawn.gltf(this.assets.gltf("robot"), {
            key: "level.robot",
            name: "robot",
            transform: { translation: [1, 0, 0] },
          });
        }
      },
      schedule: { priority: 0 },
    };

    const ReactiveSystemModule: ApertureSystemModule = {
      default: class ReactiveSystem extends createSystem() {
        override init(): void {
          this.effects.watch(this.input.actions.select!.pressed, (pressed) => {
            if (pressed) {
              events.push("select");
            }
          });
        }
      },
      schedule: { priority: 50 },
    };

    const SpinSystemModule: ApertureSystemModule = {
      default: class SpinSystem extends createSystem({
        crates: {
          required: [Name, LocalTransform],
          where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
        },
      }) {
        override update(_delta: number, time: number): void {
          events.push(`spin:${time}`);
          for (const entity of this.queries.crates.entities) {
            entity.setValue(Name, "value", "crate");
          }
        }
      },
      schedule: { priority: 100 },
    };

    const app = await createApertureApp({
      config,
      systems: [SpinSystemModule, ReactiveSystemModule, SetupSystemModule],
      assetLoader: {
        async load(assetHandle) {
          events.push(`load:${assetHandle.id}`);
          if (assetHandle.id === "floorColor") {
            await backgroundLoaded;
          }
        },
      },
    });

    expect(events).toContain("load:robot");
    expect(app.context.assets.gltf("robot").ready.value).toBe(true);
    expect(app.context.assets.texture("floorColor").ready.value).toBe(false);
    expect(app.context.assets.texture("decal").ready.value).toBe(false);

    const systemNames = app.lowLevel.world
      .getSystems()
      .map((system) => system.constructor.name);
    expect(systemNames).toEqual([
      "SetupSystem",
      "ReactiveSystem",
      "SpinSystem",
    ]);

    const keys = app.lowLevel.world.queryManager.registerQuery({
      required: [AppEntityKey],
    });
    const keyValues = [...keys.entities].map((entity) =>
      entity.getValue(AppEntityKey, "value"),
    );
    expect(keyValues).toEqual(
      expect.arrayContaining([
        "camera.main",
        "light.key",
        "level.crate.primary",
        "level.robot",
      ]),
    );

    app.context.input.actions.select!.pressed.value = true;
    app.step(1 / 60, 1);
    expect(events).toContain("select");
    expect(events).toContain("spin:1");

    const reactive = app.lowLevel.world.getSystems()[1];
    app.lowLevel.world.unregisterSystem(reactive?.constructor as never);
    app.context.input.actions.select!.pressed.value = false;
    app.step(1 / 60, 2);
    app.context.input.actions.select!.pressed.value = true;
    app.step(1 / 60, 3);
    expect(events.filter((event) => event === "select")).toHaveLength(1);

    resolveBackground();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(app.context.assets.texture("floorColor").ready.value).toBe(true);

    await app.context.commands.requestAsset("decal");
    expect(events).toContain("load:decal");
    expect(app.context.assets.texture("decal").ready.value).toBe(true);
  });

  it("discovers worker system globs and records schedule metadata without exposing classes to the main manifest", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aperture-plugin-"));

    try {
      await mkdir(path.join(root, "src/systems"), { recursive: true });
      await writeFile(
        path.join(root, "aperture.config.ts"),
        [
          `import { defineApertureConfig } from "@aperture-engine/app/config";`,
          `export default defineApertureConfig({`,
          `  mode: "headless",`,
          `  systems: ["src/systems/**/*.system.ts"],`,
          `});`,
          "",
        ].join("\n"),
      );
      await writeFile(
        path.join(root, "src/systems/spin-crate.system.ts"),
        [
          `import { createSystem } from "@aperture-engine/app/systems";`,
          `export const schedule = { priority: 100 };`,
          `export default class SpinCrateSystem extends createSystem() {}`,
          "",
        ].join("\n"),
      );

      const manifest = await createApertureSystemManifest({ root });

      expect(manifest.diagnostics).toEqual([]);
      expect(manifest.systems).toHaveLength(1);
      expect(manifest.systems[0]).toMatchObject({
        hasDefaultExport: true,
        schedule: { priority: 100 },
      });
      expect(JSON.stringify(manifest.systems)).not.toContain("SpinCrateSystem");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("keeps the developer API example on the config-plus-systems path", async () => {
    const exampleRoot = path.resolve("examples/developer-api");
    const viteConfig = await readFile(
      path.join(exampleRoot, "vite.config.ts"),
      "utf8",
    );
    const apertureConfig = await readFile(
      path.join(exampleRoot, "aperture.config.ts"),
      "utf8",
    );
    const setupSystem = await readFile(
      path.join(exampleRoot, "src/systems/setup.system.ts"),
      "utf8",
    );
    const headlessConfig = await readFile(
      path.join(exampleRoot, "aperture.headless.config.ts"),
      "utf8",
    );

    expect(viteConfig).toContain("plugins: [aperture()]");
    expect(apertureConfig).toContain('mode: "browser"');
    expect(apertureConfig).toContain('canvas: "#aperture"');
    expect(apertureConfig).toContain('systems: ["src/systems/**/*.system.ts"]');
    expect(headlessConfig).toContain('mode: "headless"');
    expect(headlessConfig).toContain('systems: ["src/systems/**/*.system.ts"]');
    expect(setupSystem).toContain("this.spawn.mesh");
    expect(setupSystem).toContain("this.spawn.gltf");

    const userCode = `${viteConfig}\n${apertureConfig}\n${headlessConfig}\n${setupSystem}`;
    expect(userCode).not.toMatch(
      /createWebGpuApp|createExtractionApp|stepAndExtract|postMessage|RenderSnapshot/,
    );
  });

  it("keeps config and system helpers headless-safe", async () => {
    const configSource = await readFile("packages/app/src/config.ts", "utf8");
    const systemsSource = await readFile("packages/app/src/systems.ts", "utf8");
    const rootSource = await readFile("packages/app/src/index.ts", "utf8");
    const headlessSafeSource = `${configSource}\n${systemsSource}\n${rootSource}`;

    expect(headlessSafeSource).not.toMatch(
      /@aperture-engine\/webgpu|navigator\.gpu|HTMLCanvasElement|createWebGpuApp|from "\.\/browser\.js"/,
    );
  });
});
