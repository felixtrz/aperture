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
  createApertureHeadlessFailureStatus,
  createApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import { createApertureGeneratedDiagnosticsStatus } from "@aperture-engine/app/diagnostics";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { aperture as apertureFromAppVite } from "@aperture-engine/app/vite";
import {
  findApertureEntities,
  getApertureEntitySummary,
} from "@aperture-engine/app/entity-lookup";
import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
} from "@aperture-engine/runtime";
import {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
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
import {
  aperture as apertureFromVitePlugin,
  createApertureSystemManifest,
} from "@aperture-engine/vite-plugin";
import developerHeadlessConfig from "../../examples/developer-api/aperture.headless.config.js";
import SetupSystem, {
  schedule as setupSchedule,
} from "../../examples/developer-api/src/systems/setup.system.js";
import AssetCommandSystem, {
  schedule as assetCommandSchedule,
} from "../../examples/developer-api/src/systems/asset-command.system.js";
import SelectSystem, {
  schedule as selectSchedule,
} from "../../examples/developer-api/src/systems/select.system.js";
import SpinCrateSystem, {
  schedule as spinSchedule,
} from "../../examples/developer-api/src/systems/spin-crate.system.js";

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

  it("exposes the optional app/vite convenience subpath without changing the root app export", () => {
    const canonicalPlugin = apertureFromVitePlugin();
    const appVitePlugin = apertureFromAppVite();

    expect(appVitePlugin.name).toBe(canonicalPlugin.name);
    expect(appVitePlugin).toHaveProperty("resolveId");
    expect(appVitePlugin).toHaveProperty("load");
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
          this.spawn.light({
            key: "light.fill",
            name: "fill-light",
            kind: "ambient",
            intensity: 0.75,
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
        "light.fill",
        "level.crate.primary",
        "level.robot",
      ]),
    );

    const snapshot = app.stepAndExtract(1 / 60, 0.5, 0);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.report.cullStats ?? []).toHaveLength(1);
    expect(snapshot.report.cullStats?.[0]).toMatchObject({
      tested: 1,
      culled: 0,
      included: 1,
    });

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

  it("loads and replays config-declared GLB assets through the system spawn helper", async () => {
    const cubeBytes = await readFile("examples/assets/cube.glb");
    const cubeDataUrl = `data:model/gltf-binary;base64,${cubeBytes.toString(
      "base64",
    )}`;
    const config = defineApertureConfig({
      mode: "headless",
      systems: ["src/systems/**/*.system.ts"],
      assets: {
        robot: asset.gltf(cubeDataUrl, { preload: "blocking" }),
      },
      render: {
        defaultCamera: false,
        defaultLight: false,
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
          this.spawn.light({
            key: "light.fill",
            name: "fill-light",
            kind: "ambient",
            intensity: 0.75,
          });
          this.spawn.gltf(this.assets.gltf("robot"), {
            key: "level.robot",
            name: "robot",
            transform: { translation: [0, 0, 0] },
          });
        }
      },
      schedule: { priority: 0 },
    };

    const app = await createApertureApp({
      config,
      systems: [SetupSystemModule],
    });
    const robot = app.context.assets.gltf("robot");
    const loadedScene = robot.scene.value;

    expect(robot.ready.value).toBe(true);
    expect(loadedScene).not.toBeNull();
    expect(loadedScene?.meshRegistration.written.length ?? 0).toBeGreaterThan(
      0,
    );
    expect(loadedScene?.commandPlan.commands.length ?? 0).toBeGreaterThan(0);
    expect(
      app.lowLevel.assets.list({ kind: "mesh", status: "ready" }).length,
    ).toBeGreaterThan(0);

    const keys = app.lowLevel.world.queryManager.registerQuery({
      required: [AppEntityKey],
    });
    const keyValues = [...keys.entities].map((entity) =>
      entity.getValue(AppEntityKey, "value"),
    );
    expect(keyValues).toContain("level.robot");

    const snapshot = app.stepAndExtract(1 / 60, 0.5, 0);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.meshDraws.length).toBeGreaterThan(0);
    expect(snapshot.report.cullStats?.[0]).toMatchObject({
      tested: expect.any(Number),
      culled: 0,
      included: expect.any(Number),
    });
  });

  it("runs the developer API example systems through a config-driven headless runner", async () => {
    const loadedAssets: string[] = [];
    const runner = await createApertureHeadlessRunner({
      config: developerHeadlessConfig,
      systems: [
        { default: SetupSystem, schedule: setupSchedule },
        { default: AssetCommandSystem, schedule: assetCommandSchedule },
        { default: SelectSystem, schedule: selectSchedule },
        { default: SpinCrateSystem, schedule: spinSchedule },
      ],
      assetLoader: {
        async load(assetHandle) {
          loadedAssets.push(assetHandle.id);
        },
      },
    });

    expect(loadedAssets).toContain("robot");
    expect(runner.getStatus()).toMatchObject({
      mode: "headless",
      preload: {
        blocking: ["robot"],
        background: ["floorColor"],
        manual: ["decal"],
      },
      lastSnapshot: null,
    });

    const first = runner.step(1 / 60, 0.5);
    expect(first.snapshot.views).toHaveLength(1);
    expect(first.snapshot.meshDraws).toHaveLength(1);
    expect(first.status.lastSnapshot).toMatchObject({
      frame: 0,
      counts: {
        views: 1,
        meshDraws: 1,
        diagnostics: 0,
      },
    });

    runner.app.context.input.pointer.primary.position.value = [0.25, 0.5];
    runner.app.context.input.actions.select!.pressed.value = true;
    const selected = runner.step(1 / 60, 1);

    expect(selected.status.input.actions.select).toMatchObject({
      pressed: true,
      value: 0,
    });
    expect(selected.status.signals.selectedEntity).toMatchObject({
      index: expect.any(Number),
      generation: expect.any(Number),
    });
    expect(selected.status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "select.pressed",
          data: expect.objectContaining({
            selectedEntity: expect.objectContaining({
              index: expect.any(Number),
              generation: expect.any(Number),
            }),
            mutatedComponent: "aperture.metadata.debug",
          }),
        }),
      ]),
    );
    expect(JSON.stringify(selected.status)).not.toMatch(
      /navigator\.gpu|HTMLCanvasElement|createWebGpuApp/,
    );
  });

  it("publishes JSON-safe entity lookup summaries for developer API headless systems", async () => {
    const cubeBytes = await readFile("examples/assets/cube.glb");
    const cubeDataUrl = `data:model/gltf-binary;base64,${cubeBytes.toString(
      "base64",
    )}`;
    const config = defineApertureConfig({
      ...developerHeadlessConfig,
      assets: {
        ...developerHeadlessConfig.assets,
        robot: asset.gltf(cubeDataUrl, { preload: "blocking" }),
      },
    });
    const runner = await createApertureHeadlessRunner({
      config,
      systems: [
        { default: SetupSystem, schedule: setupSchedule },
        { default: AssetCommandSystem, schedule: assetCommandSchedule },
        { default: SelectSystem, schedule: selectSchedule },
        { default: SpinCrateSystem, schedule: spinSchedule },
      ],
    });

    runner.step(1 / 60, 0.5);

    const crate = runner.entities.find({
      key: "level.crate.primary",
      tags: ["interactive"],
      withComponents: [AppEntityTags.id],
    });
    expect(crate.diagnostics).toEqual([]);
    expect(crate.summaries).toHaveLength(1);
    expect(crate.summaries[0]).toMatchObject({
      key: "level.crate.primary",
      name: "crate",
      tags: expect.arrayContaining(["interactive", "crate"]),
      componentIds: expect.arrayContaining([
        "aperture.app.entityKey",
        "aperture.app.entityTags",
      ]),
    });

    const robot = runner.entities.find({
      key: "level.robot",
      withComponents: [AppEntitySource.id],
    });
    expect(robot.diagnostics).toEqual([]);
    expect(robot.summaries).toHaveLength(1);
    expect(robot.summaries[0]).toMatchObject({
      entity: {
        index: expect.any(Number),
        generation: expect.any(Number),
      },
      key: "level.robot",
      name: "robot",
      tags: expect.arrayContaining(["asset", "robot"]),
      source: {
        assetId: "robot",
        gltfNodePath: expect.stringMatching(/^scene:/),
      },
    });

    const robotPrimitives = findApertureEntities(runner.app.lowLevel.world, {
      source: { assetId: "robot" },
      withComponents: ["aperture.render.mesh", "aperture.render.material"],
    });
    expect(robotPrimitives.diagnostics).toEqual([]);
    expect(robotPrimitives.summaries.length).toBeGreaterThan(0);
    expect(robotPrimitives.summaries[0]).toMatchObject({
      componentIds: expect.arrayContaining([
        "aperture.render.mesh",
        "aperture.render.material",
      ]),
      source: {
        assetId: "robot",
        gltfNodeIndex: expect.any(Number),
        gltfNodePath: expect.stringContaining("nodes["),
      },
    });

    const byName = runner.entities.find({ namePattern: "^crate$" });
    expect(byName.summaries.map((summary) => summary.key)).toContain(
      "level.crate.primary",
    );

    const resolved = getApertureEntitySummary(
      runner.app.lowLevel.world,
      robot.summaries[0]!.entity,
    );
    expect(resolved).toMatchObject({
      ok: true,
      summary: {
        key: "level.robot",
      },
    });

    const stale = runner.entities.get({
      index: robot.summaries[0]!.entity.index,
      generation: robot.summaries[0]!.entity.generation + 1,
    });
    expect(stale).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.generationMismatch",
        suggestedFix: expect.stringContaining("aperture_entity_find"),
      },
    });

    expect(runner.getStatus().entities).toMatchObject({
      label: "headless",
      total: expect.any(Number),
      summaries: expect.arrayContaining([
        expect.objectContaining({ key: "level.robot" }),
      ]),
    });
    expect(JSON.stringify(runner.getStatus().entities)).not.toMatch(
      /navigator\.gpu|HTMLCanvasElement|createWebGpuApp/,
    );
  });

  it("drains generated command queues in systems and requests manual config assets", async () => {
    const loadedAssets: string[] = [];
    const runner = await createApertureHeadlessRunner({
      config: developerHeadlessConfig,
      systems: [
        { default: SetupSystem, schedule: setupSchedule },
        { default: AssetCommandSystem, schedule: assetCommandSchedule },
        { default: SelectSystem, schedule: selectSchedule },
        { default: SpinCrateSystem, schedule: spinSchedule },
      ],
      assetLoader: {
        async load(assetHandle) {
          loadedAssets.push(assetHandle.id);
        },
      },
    });

    expect(loadedAssets).toContain("robot");
    expect(loadedAssets).not.toContain("decal");
    expect(runner.app.context.assets.texture("decal").ready.value).toBe(false);

    runner.app.context.commands.queue("asset.request", { assetId: "decal" });
    runner.step(1 / 60, 0.5);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loadedAssets).toContain("decal");
    expect(runner.app.context.assets.texture("decal").ready.value).toBe(true);
    expect(runner.getStatus().diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "command.assetRequest.ready",
          data: expect.objectContaining({
            channel: "asset.request",
            asset: "decal",
            ready: true,
          }),
        }),
      ]),
    );
    expect(runner.app.context.commands.summary()).toMatchObject({
      enqueued: 1,
      drained: 1,
      requestedAssets: expect.arrayContaining([
        expect.objectContaining({
          id: "decal",
          status: "ready",
          ready: true,
        }),
      ]),
    });
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

  it("normalizes generated diagnostics for manifest, asset, and worker startup failures", async () => {
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
        path.join(root, "src/systems/missing-export.system.ts"),
        [`export const schedule = { priority: 0 };`, ""].join("\n"),
      );
      await writeFile(
        path.join(root, "src/systems/bad-schedule.system.ts"),
        [
          `import { createSystem } from "@aperture-engine/app/systems";`,
          `export const schedule = { priority: "late" };`,
          `export default class BadScheduleSystem extends createSystem() {}`,
          "",
        ].join("\n"),
      );

      const manifest = await createApertureSystemManifest({ root });
      const manifestStatus = createApertureGeneratedDiagnosticsStatus({
        status: "failed",
        diagnostics: manifest.diagnostics,
      });

      expect(manifestStatus).toMatchObject({
        status: "failed",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "aperture.system.missingDefaultExport",
            source: expect.objectContaining({
              file: expect.stringContaining("missing-export.system.ts"),
            }),
            suggestedFix: expect.stringContaining("Default-export"),
          }),
          expect.objectContaining({
            code: "aperture.system.invalidSchedule",
            source: expect.objectContaining({
              file: expect.stringContaining("bad-schedule.system.ts"),
            }),
            suggestedFix: expect.stringContaining("schedule"),
          }),
        ]),
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }

    const invalidAssetConfig = defineApertureConfig({
      mode: "headless",
      systems: [],
      assets: {
        robot: asset.gltf("/missing.glb", { preload: "blocking" }),
      },
    });

    let assetStatus = createApertureHeadlessFailureStatus(
      new Error("expected failure"),
    );
    try {
      await createApertureHeadlessRunner({ config: invalidAssetConfig });
    } catch (error: unknown) {
      assetStatus = createApertureHeadlessFailureStatus(error);
    }

    expect(assetStatus).toMatchObject({
      mode: "headless",
      status: "failed",
      diagnostics: [
        expect.objectContaining({
          code: "aperture.asset.invalidUrl",
          source: { asset: "robot" },
          data: expect.objectContaining({
            url: "/missing.glb",
            blocksStartup: true,
          }),
          suggestedFix: expect.stringContaining("absolute URL"),
        }),
      ],
    });

    const port = new InlineGeneratedWorkerPort();
    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ schedule: { priority: 0 } }],
      port,
    });
    port.dispatch({ type: SIMULATION_WORKER_PROTOCOL.start });

    const workerError = await port.nextPostedMessage((message) =>
      isSimulationWorkerErrorMessage(message),
    );

    expect(workerError).toMatchObject({
      type: SIMULATION_WORKER_PROTOCOL.error,
      reason: "aperture.system.missingDefaultExport",
      diagnostics: [
        expect.objectContaining({
          code: "aperture.system.missingDefaultExport",
          source: expect.objectContaining({
            worker: "generated-simulation",
            module: "systems[0]",
          }),
          suggestedFix: expect.stringContaining("Default-export"),
        }),
      ],
    });
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
    const commandsSource = await readFile(
      "packages/app/src/commands.ts",
      "utf8",
    );
    const diagnosticsSource = await readFile(
      "packages/app/src/diagnostics.ts",
      "utf8",
    );
    const entityLookupSource = await readFile(
      "packages/app/src/entity-lookup.ts",
      "utf8",
    );
    const rootSource = await readFile("packages/app/src/index.ts", "utf8");
    const headlessSafeSource = `${configSource}\n${systemsSource}\n${commandsSource}\n${diagnosticsSource}\n${entityLookupSource}\n${rootSource}`;

    expect(headlessSafeSource).not.toMatch(
      /@aperture-engine\/webgpu|navigator\.gpu|HTMLCanvasElement|createWebGpuApp|from "\.\/browser\.js"/,
    );
  });
});

class InlineGeneratedWorkerPort implements SimulationMessagePort {
  private listeners = new Set<(event: MessageEvent<unknown>) => void>();
  private posted: unknown[] = [];
  private waiters: {
    readonly predicate: (message: unknown) => boolean;
    readonly resolve: (message: unknown) => void;
  }[] = [];

  postMessage(message: unknown): void {
    this.posted.push(message);

    for (const waiter of [...this.waiters]) {
      if (waiter.predicate(message)) {
        this.waiters = this.waiters.filter((entry) => entry !== waiter);
        waiter.resolve(message);
      }
    }
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  start(): void {}

  dispatch(message: unknown): void {
    for (const listener of this.listeners) {
      listener({ data: message } as MessageEvent<unknown>);
    }
  }

  nextPostedMessage(
    predicate: (message: unknown) => boolean,
  ): Promise<unknown> {
    const existing = this.posted.find(predicate);

    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter(
          (waiter) => waiter.resolve !== resolve,
        );
        reject(new Error("Timed out waiting for generated worker message."));
      }, 1000);

      this.waiters.push({
        predicate,
        resolve(message) {
          clearTimeout(timeout);
          resolve(message);
        },
      });
    });
  }
}

function isSimulationWorkerErrorMessage(value: unknown): value is {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.error;
  readonly reason: string;
  readonly diagnostics?: readonly unknown[];
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.error
  );
}
