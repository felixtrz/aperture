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
import {
  APERTURE_GENERATED_STATUS_GLOBAL,
  DEFAULT_GENERATED_MAX_PIXEL_RATIO,
  DEFAULT_GENERATED_MSAA_SAMPLE_COUNT,
  measureGeneratedCanvasResize,
  readGeneratedBrowserAppStatus,
  resolveGeneratedEffectiveRenderDefaults,
  resolveGeneratedRenderSettings,
  type GeneratedBrowserAppStatus,
} from "@aperture-engine/app/browser";
import {
  APERTURE_ENTITY_DIFF_COMMAND_CHANNEL,
  APERTURE_ENTITY_FIND_COMMAND_CHANNEL,
  APERTURE_ENTITY_GET_COMMAND_CHANNEL,
  APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL,
  APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
  APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL,
  APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
  createGeneratedCommandMessage,
} from "@aperture-engine/app/commands";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { aperture as apertureFromAppVite } from "@aperture-engine/app/vite";
import {
  findApertureEntities,
  getApertureEntitySummary,
} from "@aperture-engine/app/entity-lookup";
import {
  composeTrsMatrix,
  createMeshBvh,
  createShaderHandle,
  createTextureHandle,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import {
  Mesh,
  RenderLayer,
  ShadowCaster,
  ShadowReceiver,
  Sprite,
  createPlaneMeshAsset,
  createSprite,
  createSpatialTriangleMeshFromMeshAsset,
} from "@aperture-engine/render";
import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
} from "@aperture-engine/runtime";
import {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
  DebugMetadata,
  EcsType,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  createSystem,
  material,
  mesh,
  shader,
  type InputAction,
  type InputButtonAction,
} from "@aperture-engine/app/systems";
import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";
import {
  APERTURE_VITE_DEVTOOLS_WS_CHANNEL,
  aperture as apertureFromVitePlugin,
  createApertureSystemManifest,
  type ApertureViteDevServer,
} from "@aperture-engine/vite-plugin";
import { createGeneratedInputEventMessage } from "../../packages/app/src/input.js";
import developerHeadlessConfig from "../../examples/developer-api/aperture.headless.config.js";
import SetupSystem from "../../examples/developer-api/src/systems/setup.system.js";
import AssetCommandSystem from "../../examples/developer-api/src/systems/asset-command.system.js";
import SelectSystem from "../../examples/developer-api/src/systems/select.system.js";
import SpinCrateSystem from "../../examples/developer-api/src/systems/spin-crate.system.js";

function requireButtonAction(
  action: InputAction | undefined,
): InputButtonAction {
  if (action?.kind !== "button") {
    throw new Error("Expected configured button action.");
  }

  return action;
}

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
        water: asset.shader("/shaders/water.wgsl", {
          preload: "blocking",
        }),
      },
      signals: {
        selectedEntity: signal.ref(null),
        gameplayMode: signal.string("edit"),
      },
      render: {
        clearColor: [0.03, 0.035, 0.04, 1],
        defaultCamera: true,
        defaultLight: true,
        sampleCount: 4,
        pixelRatio: 1,
        maxPixelRatio: 2,
      },
    });

    expect(config.assets.robot).toMatchObject({
      kind: "gltf",
      url: "/assets/robot.glb",
      preload: "blocking",
    });
    expect(config.assets.water).toMatchObject({
      kind: "shader",
      url: "/shaders/water.wgsl",
      preload: "blocking",
    });
    expect(config.render?.sampleCount).toBe(4);
    expect(config.render?.pixelRatio).toBe(1);
    expect(config.render?.maxPixelRatio).toBe(2);
    expect("aperture" in appRoot).toBe(false);
  });

  it("exposes worker-safe custom WGSL material and shader builders", () => {
    const waterShader = createShaderHandle("water");
    const inlineShader = shader.inlineWgsl(
      "@vertex fn vs_main() -> @builtin(position) vec4f { return vec4f(); }\n@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }",
      { virtualPath: "inline-water.wgsl" },
    );
    const descriptor = material.customWgsl({
      familyKey: "app/water",
      label: "Water",
      shader: shader.asset(waterShader),
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      renderState: { cullMode: "none" },
      bindings: [
        material.uniform("water", {
          binding: 0,
          visibility: ["fragment"],
          fields: {
            color: { type: EcsType.Vec4, default: [0.02, 0.46, 0.9, 1] },
          },
        }),
      ],
    });

    expect(inlineShader).toMatchObject({
      kind: "inline-wgsl",
      virtualPath: "inline-water.wgsl",
    });
    expect(descriptor).toMatchObject({
      kind: "custom-wgsl",
      familyKey: "app/water",
      shader: { kind: "shader-asset", handle: waterShader },
      bindings: [
        {
          kind: "uniform-buffer",
          name: "water",
          binding: 0,
          visibility: ["fragment"],
        },
      ],
    });
  });

  it("loads shader config assets for system-authored custom WGSL materials", async () => {
    const source = [
      "@group(0) @binding(0) var<uniform> view: mat4x4f;",
      "struct VertexOut { @builtin(position) position: vec4f };",
      "@vertex fn vs_main(@location(0) position: vec3f) -> VertexOut {",
      "  var out: VertexOut;",
      "  out.position = vec4f(position, 1.0);",
      "  return out;",
      "}",
      "@fragment fn fs_main() -> @location(0) vec4f {",
      "  return vec4f(0.05, 0.45, 0.9, 1.0);",
      "}",
    ].join("\n");
    const waterShader = createShaderHandle("water");

    class CustomMaterialSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        const shaderAsset = this.assets.shader("water");

        this.spawn.camera({
          key: "camera.custom-material",
          transform: { translation: [0, 0, 4], lookAt: [0, 0, 0] },
          camera: { clearColor: [0.01, 0.02, 0.03, 1] },
        });
        this.spawn.mesh({
          key: "custom-material.water-plane",
          mesh: mesh.plane({ size: [2, 1] }),
          material: material.customWgsl({
            familyKey: "app/water",
            label: "Generated Water",
            shader: shader.asset(shaderAsset),
            entryPoints: { vertex: "vs_main", fragment: "fs_main" },
            renderState: { cullMode: "none" },
            bindings: [],
          }),
        });
      }
    }

    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        systems: ["src/systems/**/*.system.ts"],
        assets: {
          water: asset.shader(
            `data:text/plain;charset=utf-8,${encodeURIComponent(source)}`,
            { preload: "blocking" },
          ),
        },
      }),
      systems: [{ default: CustomMaterialSystem }],
    });

    const shaderEntry = runner.app.lowLevel.assets.get<
      "shader",
      {
        readonly kind: string;
        readonly language: string;
        readonly source: string;
        readonly virtualPath?: string;
      }
    >(waterShader);

    expect(shaderEntry).toMatchObject({
      status: "ready",
      asset: {
        kind: "shader",
        language: "wgsl",
        source,
      },
    });

    const report = runner.step(1 / 60, 0);
    const draw = report.snapshot.meshDraws[0];

    expect(report.snapshot.views).toHaveLength(1);
    expect(report.snapshot.meshDraws).toHaveLength(1);
    expect(draw?.batchKey.pipelineKey.startsWith("app/water|")).toBe(true);

    const materialEntry =
      draw === undefined
        ? undefined
        : runner.app.lowLevel.assets.get(draw.material);

    expect(materialEntry?.status).toBe("ready");
    expect(materialEntry?.asset).toMatchObject({
      sourceDiscriminator: "custom-material-source",
      shaderLanguage: "wgsl",
      familyKey: "app/water",
      shader: { kind: "shader-asset", handle: waterShader },
    });
    expect(JSON.stringify(materialEntry?.asset)).not.toContain("GPU");
  });

  it("defaults generated browser render quality to 4x MSAA and capped DPR", () => {
    const defaults = resolveGeneratedRenderSettings(undefined, 3);

    expect(defaults).toMatchObject({
      requestedSampleCount: DEFAULT_GENERATED_MSAA_SAMPLE_COUNT,
      sampleCountSource: "default",
      pixelRatio: DEFAULT_GENERATED_MAX_PIXEL_RATIO,
      devicePixelRatio: 3,
      maxPixelRatio: DEFAULT_GENERATED_MAX_PIXEL_RATIO,
      pixelRatioSource: "capped",
      diagnostics: [],
    });

    const optOut = resolveGeneratedRenderSettings(
      { sampleCount: 1, maxPixelRatio: 1 },
      2,
    );

    expect(optOut).toMatchObject({
      requestedSampleCount: 1,
      sampleCountSource: "config",
      pixelRatio: 1,
      devicePixelRatio: 2,
      maxPixelRatio: 1,
      pixelRatioSource: "capped",
      diagnostics: [],
    });
  });

  it("applies the first matching generated render device profile", () => {
    const resolution = resolveGeneratedEffectiveRenderDefaults(
      {
        sampleCount: 4,
        maxPixelRatio: 2,
        bloom: { threshold: 0.8, intensity: 0.06, levels: 5 },
        deviceProfiles: [
          {
            label: "desktop",
            minViewportWidth: 900,
            sampleCount: 4,
            maxPixelRatio: 2,
          },
          {
            label: "mobile",
            maxViewportWidth: 700,
            minDevicePixelRatio: 2,
            sampleCount: 1,
            maxPixelRatio: 1.5,
            bloom: { threshold: 0.86, intensity: 0.04, levels: 3 },
          },
        ],
      },
      { viewportWidth: 390, viewportHeight: 844, devicePixelRatio: 3 },
    );

    expect(resolution.profile).toBe("mobile");
    expect(resolution.render).toMatchObject({
      sampleCount: 1,
      maxPixelRatio: 1.5,
      bloom: { threshold: 0.86, intensity: 0.04, levels: 3 },
    });

    const settings = resolveGeneratedRenderSettings(
      resolution.render,
      3,
      resolution.profile,
    );
    expect(settings).toMatchObject({
      requestedSampleCount: 1,
      pixelRatio: 1.5,
      profile: "mobile",
    });
  });

  it("reports generated render default diagnostics for unsupported sample counts", () => {
    const settings = resolveGeneratedRenderSettings(
      { sampleCount: 8, pixelRatio: 1.5 },
      3,
    );

    expect(settings).toMatchObject({
      requestedSampleCount: 8,
      sampleCountSource: "config",
      pixelRatio: 1.5,
      devicePixelRatio: 3,
      pixelRatioSource: "configured",
      diagnostics: [
        expect.objectContaining({
          code: "aperture.render.sampleCount.clamped",
          requestedSampleCount: 8,
          resolvedSampleCount: 4,
        }),
      ],
    });
  });

  it("measures generated canvas backing size from effective pixel ratio", () => {
    const canvas = createCanvasMeasureElement({
      width: 640,
      height: 360,
      clientWidth: 320,
      clientHeight: 180,
    });

    const measured = measureGeneratedCanvasResize(canvas, {
      render: { maxPixelRatio: 2 },
      devicePixelRatio: 3,
      resizeSource: "initial",
    });

    expect(measured).toMatchObject({
      width: 1280,
      height: 720,
      displayWidth: 640,
      displayHeight: 360,
      pixelRatio: 2,
      devicePixelRatio: 3,
      maxPixelRatio: 2,
      pixelRatioSource: "capped",
      resizeSource: "initial",
      measurementSource: "css-box",
    });
    expect(measured.aspect).toBeCloseTo(16 / 9, 5);
  });

  it("exposes the optional app/vite convenience subpath without changing the root app export", () => {
    const canonicalPlugin = apertureFromVitePlugin();
    const appVitePlugin = apertureFromAppVite();

    expect(appVitePlugin.name).toBe(canonicalPlugin.name);
    expect(appVitePlugin).toHaveProperty("resolveId");
    expect(appVitePlugin).toHaveProperty("load");
    expect("aperture" in appRoot).toBe(false);
  });

  it("generates the browser AI bridge only for dev AI mode", async () => {
    const root = process.cwd();
    const enabledPlugin = apertureFromVitePlugin();
    enabledPlugin.configResolved?.({ root });
    const enabledId = enabledPlugin.resolveId?.(
      "virtual:aperture/browser-entry",
    );
    const enabledModule =
      enabledId === null || enabledId === undefined
        ? null
        : await enabledPlugin.load?.(enabledId);

    const disabledPlugin = apertureFromVitePlugin({ ai: { mode: "off" } });
    disabledPlugin.configResolved?.({ root });
    const disabledId = disabledPlugin.resolveId?.(
      "virtual:aperture/browser-entry",
    );
    const disabledModule =
      disabledId === null || disabledId === undefined
        ? null
        : await disabledPlugin.load?.(disabledId);

    expect(enabledModule).toContain(
      "const apertureDevtoolsEnabled = true && import.meta.env.DEV;",
    );
    expect(enabledModule).toContain(
      "devtools: { enabled: apertureDevtoolsEnabled },",
    );
    expect(disabledModule).toContain(
      "const apertureDevtoolsEnabled = false && import.meta.env.DEV;",
    );
  });

  it("registers a dev websocket bridge and writes AI session metadata in serve mode", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aperture-vite-ai-"));

    try {
      let listening = false;
      const callbacks: {
        listening?: () => void;
        bridge?: Parameters<NonNullable<ApertureViteDevServer["ws"]["on"]>>[1];
      } = {};
      const sentMessages: unknown[] = [];
      const server = {
        config: {
          root,
          server: { host: "127.0.0.1", port: 5199 },
        },
        httpServer: {
          address() {
            return listening
              ? ({ address: "127.0.0.1", family: "IPv4", port: 5199 } as const)
              : null;
          },
          once(event, listener) {
            if (event === "listening") {
              callbacks.listening = listener;
            }
          },
        },
        ws: {
          on(event, listener) {
            if (event === APERTURE_VITE_DEVTOOLS_WS_CHANNEL) {
              callbacks.bridge = listener;
            }
          },
        },
      } satisfies ApertureViteDevServer;
      const plugin = apertureFromVitePlugin({ ai: { mode: "agent" } });

      plugin.configResolved?.({
        root,
        command: "serve",
        server: { host: "127.0.0.1", port: 5199 },
      });
      await plugin.configureServer?.(server);
      expect(callbacks.bridge).toBeDefined();
      expect(callbacks.listening).toBeDefined();

      if (callbacks.bridge === undefined || callbacks.listening === undefined) {
        throw new Error("Aperture Vite dev bridge test server was not wired.");
      }

      listening = true;
      callbacks.listening();

      const session = JSON.parse(
        await readEventually(path.join(root, ".aperture/runtime/session.json")),
      ) as {
        readonly protocolVersion: number;
        readonly appRoot: string;
        readonly url: string;
        readonly server: { readonly state: string };
        readonly browser: { readonly state: string };
        readonly bridge: {
          readonly url: string;
          readonly channel: string;
          readonly runtimeGlobal: string;
        };
        readonly owned: boolean;
      };

      callbacks.bridge(
        {},
        {
          send(_event: string, payload: unknown) {
            sentMessages.push(payload);
          },
        },
      );

      expect(session).toMatchObject({
        protocolVersion: 1,
        appRoot: root,
        url: "http://127.0.0.1:5199/",
        server: { state: "running" },
        browser: { state: "unknown" },
        bridge: {
          url: "ws://127.0.0.1:5199/",
          channel: APERTURE_VITE_DEVTOOLS_WS_CHANNEL,
          runtimeGlobal: "__APERTURE_MCP_RUNTIME__",
        },
        owned: false,
      });
      expect(sentMessages).toEqual([
        expect.objectContaining({
          ok: true,
          protocolVersion: 1,
          bridge: expect.objectContaining({
            channel: APERTURE_VITE_DEVTOOLS_WS_CHANNEL,
          }),
        }),
      ]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("reads generated browser status through the typed browser helper", () => {
    const status = {
      status: "running",
      webgpuOk: true,
      snapshots: 2,
      mirroredSourceAssets: 1,
      skippedSourceAssets: 0,
      forwardedInputEvents: 1,
      forwardedInputFrames: 0,
      connectedGamepads: 0,
      lastInputReset: null,
      lastInputEvent: null,
      forwardedCommandEvents: 1,
      lastCommandEvent: null,
      lastFrame: 1,
      lastError: null,
      lastFailure: null,
      lastWorkerSummary: null,
      workerMessages: {
        snapshotDecisions: {
          total: 0,
          latest: null,
          postedMessages: {},
          postMessageReasons: {},
        },
        sidebandDecisions: {
          total: 0,
          latest: null,
          postedMessages: {},
          postMessageReasons: {},
        },
      },
      performance: null,
      diagnostics: null,
      render: null,
      canvas: null,
      systems: [],
    } satisfies GeneratedBrowserAppStatus;
    const scope = { [APERTURE_GENERATED_STATUS_GLOBAL]: status };

    expect(readGeneratedBrowserAppStatus(scope)).toBe(status);
    expect(readGeneratedBrowserAppStatus({})).toBeNull();
  });

  it("keeps descriptor priority static while preserving runtime config signals", async () => {
    const events: string[] = [];
    const SpeedConfigSystemModule: ApertureSystemModule = {
      default: class SpeedConfigSystem extends createSystem({
        priority: 20,
        config: {
          speed: { type: EcsType.Float32, default: 2 },
        },
      }) {
        override init(): void {
          const speed: number = this.config.speed.value;
          events.push(
            `speed:${this.priority}:${speed}:${String(
              "priority" in this.config,
            )}`,
          );
          this.config.speed.value = 3;
        }
      },
    };
    const RuntimePriorityConfigSystemModule: ApertureSystemModule = {
      default: class RuntimePriorityConfigSystem extends createSystem({
        priority: 30,
        config: {
          priority: { type: EcsType.Float32, default: 7 },
        },
      }) {
        override init(): void {
          const runtimePriority: number = this.config.priority.value;
          events.push(`runtime-priority:${this.priority}:${runtimePriority}`);
        }
      },
    };
    const EmptySystemModule: ApertureSystemModule = {
      default: class EmptySystem extends createSystem() {
        override init(): void {
          events.push(
            `empty:${this.priority}:${Object.keys(this.config).length}`,
          );
        }
      },
    };

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [
        RuntimePriorityConfigSystemModule,
        SpeedConfigSystemModule,
        EmptySystemModule,
      ],
    });

    expect(
      app.lowLevel.world.getSystems().map((system) => system.constructor.name),
    ).toEqual([
      "EmptySystem",
      "SpeedConfigSystem",
      "RuntimePriorityConfigSystem",
    ]);
    expect(events).toEqual([
      "empty:0:0",
      "speed:20:2:false",
      "runtime-priority:30:7",
    ]);
  });

  it("defaults query-only and config-only descriptors to priority zero", async () => {
    const events: string[] = [];
    const QueryOnlySystemModule: ApertureSystemModule = {
      default: class QueryOnlySystem extends createSystem({
        queries: {
          named: { required: [Name] },
        },
      }) {
        override init(): void {
          this.createEntity().addComponent(Name, { value: "crate" });
          events.push(
            `query:${this.priority}:${this.queries.named.entities.size}`,
          );
        }
      },
    };
    const ConfigOnlySystemModule: ApertureSystemModule = {
      default: class ConfigOnlySystem extends createSystem({
        config: {
          speed: { type: EcsType.Float32, default: 4 },
        },
      }) {
        override init(): void {
          const speed: number = this.config.speed.value;
          events.push(`config:${this.priority}:${speed}`);
        }
      },
    };
    const PriorityOnlySystemModule: ApertureSystemModule = {
      default: class PriorityOnlySystem extends createSystem({
        priority: 100,
      }) {
        override init(): void {
          events.push(`priority:${this.priority}`);
        }
      },
    };

    await createApertureApp({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [
        PriorityOnlySystemModule,
        QueryOnlySystemModule,
        ConfigOnlySystemModule,
      ],
    });

    expect(events).toEqual(["config:0:4", "query:0:1", "priority:100"]);
  });

  it("orders equal-priority descriptor systems deterministically", async () => {
    const events: string[] = [];
    const AlphaSystemModule: ApertureSystemModule = {
      default: class AlphaSystem extends createSystem({ priority: 10 }) {
        override init(): void {
          events.push("alpha");
        }
      },
    };
    const ZetaSystemModule: ApertureSystemModule = {
      default: class ZetaSystem extends createSystem({ priority: 10 }) {
        override init(): void {
          events.push("zeta");
        }
      },
    };

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [ZetaSystemModule, AlphaSystemModule],
    });

    expect(
      app.lowLevel.world.getSystems().map((system) => system.constructor.name),
    ).toEqual(["AlphaSystem", "ZetaSystem"]);
    expect(events).toEqual(["alpha", "zeta"]);
  });

  it("rejects non-finite descriptor priority before registration", () => {
    expect(() =>
      createSystem({
        priority: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(/priority must be a finite number/);
  });

  it("returns worker-owned entity snapshot and diff reports through generated commands", async () => {
    const port = new InlineGeneratedWorkerPort();
    const config = defineApertureConfig({
      mode: "headless",
      systems: ["src/systems/**/*.system.ts"],
    });
    const SetupSystemModule: ApertureSystemModule = {
      default: class SnapshotSetupSystem extends createSystem({
        priority: 0,
      }) {
        override init(): void {
          const entity = this.spawn.mesh({
            key: "level.crate.primary",
            name: "crate",
            tags: ["interactive", "crate"],
            mesh: mesh.box({ size: [1, 1, 1] }),
            material: material.standard({
              baseColor: [1, 0.55, 0.25, 1],
            }),
          });
          entity.addComponent(DebugMetadata, {
            tag: "tool",
            note: "before",
          });
        }
      },
    };

    startGeneratedSimulationWorker({
      config,
      systems: [SetupSystemModule],
      port,
    });
    port.dispatch(
      createGeneratedCommandMessage({
        channel: APERTURE_ENTITY_FIND_COMMAND_CHANNEL,
        payload: {
          key: "level.crate.primary",
          limit: 5,
        },
      }),
    );
    port.dispatch(
      createGeneratedCommandMessage({
        channel: APERTURE_ENTITY_GET_COMMAND_CHANNEL,
        payload: {},
      }),
    );
    port.dispatch(
      createGeneratedCommandMessage({
        channel: APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
        payload: {
          component: DebugMetadata.id,
          field: "note",
          value: "generated-worker.mutated",
        },
      }),
    );
    port.dispatch(
      createGeneratedCommandMessage({
        channel: APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL,
        payload: {
          label: "before",
          query: { key: "level.crate.primary" },
        },
      }),
    );
    port.dispatch(
      createGeneratedCommandMessage({
        channel: APERTURE_ENTITY_DIFF_COMMAND_CHANNEL,
        payload: {
          label: "after",
          query: { key: "level.crate.primary" },
        },
      }),
    );
    port.dispatch(
      createGeneratedCommandMessage({
        channel: APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL,
        payload: {},
      }),
    );
    port.dispatch({ type: SIMULATION_WORKER_PROTOCOL.start, stop: true });

    const snapshotMessage = await port.nextPostedMessage(
      isSimulationWorkerSnapshotMessage,
    );
    const workerSummary = readRecord(
      (snapshotMessage as { readonly workerSummary?: unknown }).workerSummary,
    );
    const entityTools = readRecord(workerSummary?.entityTools);

    expect(entityTools).toMatchObject({
      finds: 1,
      gets: 1,
      mutations: 1,
      snapshots: 2,
      diffs: 1,
      hierarchies: 1,
      lastFind: {
        total: 1,
        summaries: [
          expect.objectContaining({
            key: "level.crate.primary",
          }),
        ],
      },
      lastGet: {
        ok: true,
        summary: {
          key: "level.crate.primary",
        },
      },
      lastMutation: {
        ok: true,
        component: DebugMetadata.id,
        field: "note",
        value: "generated-worker.mutated",
      },
      lastSnapshot: {
        label: "after",
        total: 1,
        summaries: [
          expect.objectContaining({
            key: "level.crate.primary",
            tags: expect.arrayContaining(["interactive", "crate"]),
          }),
        ],
      },
      lastDiff: {
        fromLabel: "before",
        toLabel: "after",
        counts: {
          added: 0,
          removed: 0,
          changed: 0,
          unchanged: 1,
        },
        diagnostics: [],
      },
      lastHierarchy: {
        total: expect.any(Number),
        roots: expect.arrayContaining([
          expect.objectContaining({
            key: "level.crate.primary",
            name: "crate",
          }),
        ]),
        diagnostics: [],
      },
      diagnostics: [],
    });
    expect(JSON.stringify(entityTools)).not.toMatch(
      /navigator\.gpu|HTMLCanvasElement|createWebGpuApp/,
    );
  });

  it("applies generated viewport resize commands before the first camera snapshot", async () => {
    const port = new InlineGeneratedWorkerPort();
    const SetupSystemModule: ApertureSystemModule = {
      default: class ViewportResizeSetupSystem extends createSystem({
        priority: 0,
      }) {
        override init(): void {
          this.spawn.camera({
            key: "camera.main",
            name: "main-camera",
          });
        }
      },
    };

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [SetupSystemModule],
      port,
    });
    port.dispatch(
      createGeneratedCommandMessage({
        channel: APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
        payload: {
          width: 1600,
          height: 800,
          displayWidth: 800,
          displayHeight: 400,
          pixelRatio: 2,
          aspect: 2,
        },
      }),
    );
    port.dispatch({ type: SIMULATION_WORKER_PROTOCOL.start, stop: true });

    const snapshotMessage = await port.nextPostedMessage(
      isSimulationWorkerSnapshotMessage,
    );
    const snapshot = (
      snapshotMessage as {
        readonly snapshot: {
          readonly views: readonly {
            readonly projectionMatrixOffset: number;
          }[];
          readonly viewMatrices: Float32Array;
        };
      }
    ).snapshot;
    const projectionOffset = snapshot.views[0]?.projectionMatrixOffset ?? -1;
    const expectedHorizontalScale = 1 / Math.tan(Math.PI / 6) / 2;

    expect(snapshot.views).toHaveLength(1);
    expect(projectionOffset).toBeGreaterThanOrEqual(0);
    expect(snapshot.viewMatrices[projectionOffset]).toBeCloseTo(
      expectedHorizontalScale,
      5,
    );
  });

  it("advances generated worker input before effects and system updates", async () => {
    const port = new InlineGeneratedWorkerPort();
    const InputSystemModule: ApertureSystemModule = {
      default: class InputSystem extends createSystem({ priority: 0 }) {
        override update(): void {
          const jump = this.actions.jump;

          if (jump?.kind === "button" && jump.down()) {
            this.signals.jumped!.value = true;
          }
        }
      },
    };

    startGeneratedSimulationWorker({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        input: {
          actions: {
            jump: input.button([input.key("Space")]),
          },
        },
        signals: {
          jumped: signal.boolean(false),
        },
      }),
      systems: [InputSystemModule],
      port,
    });
    port.dispatch(
      createGeneratedInputEventMessage({
        kind: "keyboard",
        code: "Space",
        pressed: true,
      }),
    );
    port.dispatch({ type: SIMULATION_WORKER_PROTOCOL.start, stop: true });

    const snapshotMessage = await port.nextPostedMessage(
      isSimulationWorkerSnapshotMessage,
    );
    const workerSummary = readRecord(
      (snapshotMessage as { readonly workerSummary?: unknown }).workerSummary,
    );
    const inputSummary = readRecord(workerSummary?.input);
    const actionSummary = readRecord(readRecord(inputSummary?.actions)?.jump);
    const signals = readRecord(workerSummary?.signals);

    expect(actionSummary).toMatchObject({
      kind: "button",
      pressed: true,
      down: true,
    });
    expect(signals?.jumped).toBe(true);
  });

  it("registers generated worker systems using descriptor priority metadata", async () => {
    const events: string[] = [];
    const port = new InlineGeneratedWorkerPort();
    const EarlySystemModule: ApertureSystemModule = {
      default: class EarlySystem extends createSystem({
        priority: -10,
      }) {
        override init(): void {
          events.push("early");
        }
      },
    };
    const LateSystemModule: ApertureSystemModule = {
      default: class LateSystem extends createSystem({
        priority: 50,
      }) {
        override init(): void {
          events.push("late");
        }
      },
    };

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [LateSystemModule, EarlySystemModule],
      port,
    });
    port.dispatch({ type: SIMULATION_WORKER_PROTOCOL.start, stop: true });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);

    expect(events).toEqual(["early", "late"]);
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
      default: class SetupSystem extends createSystem({
        priority: 0,
      }) {
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
    };

    const ReactiveSystemModule: ApertureSystemModule = {
      default: class ReactiveSystem extends createSystem({
        priority: 50,
      }) {
        override init(): void {
          const select = requireButtonAction(this.input.actions.select);
          this.effects.watch(select.pressed, (pressed) => {
            if (pressed) {
              events.push("select");
            }
          });
        }
      },
    };

    const SpinSystemModule: ApertureSystemModule = {
      default: class SpinSystem extends createSystem({
        priority: 100,
        queries: {
          crates: {
            required: [Name, LocalTransform],
            where: [
              { component: Name, key: "value", op: "eq", value: "crate" },
            ],
          },
        },
      }) {
        override update(_delta: number, time: number): void {
          events.push(`spin:${time}`);
          for (const entity of this.queries.crates.entities) {
            entity.setValue(Name, "value", "crate");
          }
        }
      },
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

    requireButtonAction(app.context.input.actions.select).pressed.value = true;
    app.step(1 / 60, 1);
    expect(events).toContain("select");
    expect(events).toContain("spin:1");

    const reactive = app.lowLevel.world.getSystems()[1];
    app.lowLevel.world.unregisterSystem(reactive?.constructor as never);
    requireButtonAction(app.context.input.actions.select).pressed.value = false;
    app.step(1 / 60, 2);
    requireButtonAction(app.context.input.actions.select).pressed.value = true;
    app.step(1 / 60, 3);
    expect(events.filter((event) => event === "select")).toHaveLength(1);

    resolveBackground();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(app.context.assets.texture("floorColor").ready.value).toBe(true);

    await app.context.commands.requestAsset("decal");
    expect(events).toContain("load:decal");
    expect(app.context.assets.texture("decal").ready.value).toBe(true);
  });

  it("lets worker-safe systems raycast triangle-accurate mesh queries", async () => {
    const queryMeshReport = createSpatialTriangleMeshFromMeshAsset(
      createPlaneMeshAsset({ width: 2, height: 2 }),
    );
    const queryMesh = queryMeshReport.mesh;
    const hits: unknown[] = [];
    const allHits: unknown[][] = [];

    expect(queryMeshReport.diagnostics).toEqual([]);
    expect(queryMesh).not.toBeNull();

    const SpatialSystemModule: ApertureSystemModule = {
      default: class SpatialSystem extends createSystem({
        priority: 0,
      }) {
        override init(): void {
          if (queryMesh === null) {
            return;
          }

          const entity = this.spawn.mesh({
            key: "level.pick-plane",
            name: "pick-plane",
            mesh: mesh.plane({ size: [2, 2] }),
            material: material.standard(),
          });

          this.spatial.setBounds([
            {
              entity,
              worldAabb: { min: [-1, -1, 0], max: [1, 1, 0] },
              layerMask: 0b0010,
              pickable: { enabled: true, layerMask: 0b0010 },
            },
            {
              entity,
              worldAabb: { min: [-1, -1, 0], max: [1, 1, 0] },
              layerMask: 0b0100,
              pickable: { enabled: true, layerMask: 0b0100 },
            },
          ]);
          this.spatial.setMeshes([
            {
              entity,
              mesh: queryMesh,
              bvh: createMeshBvh(queryMesh),
              layerMask: 0b0010,
              pickable: {
                enabled: true,
                precision: "visual-mesh",
                layerMask: 0b0010,
              },
            },
            {
              entity,
              mesh: queryMesh,
              bvh: createMeshBvh(queryMesh),
              worldFromMesh: composeTrsMatrix(
                [0, 0, 0],
                [0, 0, 0, 1],
                [0.1, 0.1, 0.1],
              ),
              layerMask: 0b1000,
              pickable: {
                enabled: true,
                precision: "visual-mesh",
                layerMask: 0b1000,
              },
            },
            {
              entity,
              mesh: queryMesh,
              bvh: createMeshBvh(queryMesh),
              worldFromMesh: new Float32Array(16),
              layerMask: 0b10000,
              pickable: {
                enabled: true,
                precision: "visual-mesh",
                layerMask: 0b10000,
              },
            },
            {
              entity,
              mesh: queryMesh,
              bvh: createMeshBvh(queryMesh),
              meshFromWorld: composeTrsMatrix(
                [0, 0, 0],
                [0, 0, 0, 1],
                [10, 10, 10],
              ),
              layerMask: 0b100000,
              pickable: {
                enabled: true,
                precision: "visual-mesh",
                layerMask: 0b100000,
              },
            },
          ]);
          hits.push(
            this.spatial.raycastFirst(
              { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
              { source: "visual-mesh", layerMask: 0b0010 },
            ),
          );
          hits.push(
            this.spatial.raycastFirst(
              { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
              { source: "bounds", layerMask: 0b0010 },
            ),
          );
          hits.push(
            this.spatial.raycastFirst(
              { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
              { source: "visual-mesh", layerMask: 0b0100 },
            ),
          );
          hits.push(
            this.spatial.raycastFirst(
              { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
              { source: "visual-mesh", fallback: "bounds", layerMask: 0b0100 },
            ),
          );
          hits.push(
            this.spatial.raycastFirst(
              { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
              { source: "visual-mesh", layerMask: 0b0010, filter: () => false },
            ),
          );
          hits.push(
            this.spatial.raycastFirst(
              { origin: [0.025, 0.01, 1], direction: [0, 0, -1] },
              { source: "visual-mesh", layerMask: 0b1000, maxDistance: 2 },
            ),
          );
          hits.push(
            this.spatial.raycastFirst(
              { origin: [0.025, 0.01, 1], direction: [0, 0, -1] },
              { source: "visual-mesh", layerMask: 0b10000 },
            ),
          );
          hits.push(
            this.spatial.raycastFirst(
              { origin: [0.025, 0.01, 1], direction: [0, 0, -1] },
              { source: "visual-mesh", layerMask: 0b100000, maxDistance: 2 },
            ),
          );
          allHits.push([
            ...this.spatial.raycastAll(
              { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
              { source: "visual-mesh", layerMask: 0b0010 },
            ),
          ]);
          allHits.push([
            ...this.spatial.raycastAll(
              { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
              {
                source: "visual-mesh",
                fallback: "bounds",
                layerMask: 0b0100,
              },
            ),
          ]);
        }
      },
    };

    await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: ["src/systems/**/*.system.ts"],
      }),
      systems: [SpatialSystemModule],
    });

    expect(hits[0]).toMatchObject({
      source: "mesh-bvh",
      distance: 1,
      faceIndex: 0,
      materialSlot: 0,
      entity: {
        ref: expect.objectContaining({ index: expect.any(Number) }),
      },
    });
    expect(hits[1]).toMatchObject({
      source: "bounds",
      distance: 1,
    });
    expect(hits[2]).toBeNull();
    expect(hits[3]).toMatchObject({
      source: "bounds",
      distance: 1,
    });
    expect(hits[4]).toBeNull();
    expect(hits[5]).toMatchObject({
      source: "mesh-bvh",
      distance: 1,
      faceIndex: 0,
    });
    expect(hits[6]).toBeNull();
    expect(hits[7]).toMatchObject({
      source: "mesh-bvh",
      distance: 1,
      faceIndex: 0,
    });
    expect(allHits[0]).toEqual([
      expect.objectContaining({
        source: "mesh-bvh",
        distance: 1,
        faceIndex: 0,
      }),
    ]);
    expect(allHits[1]).toEqual([
      expect.objectContaining({
        source: "bounds",
        distance: 1,
      }),
    ]);
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
      default: class SetupSystem extends createSystem({
        priority: 0,
      }) {
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

  it("applies spawn-time GLB material render-state overrides to one instance subtree", async () => {
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
      default: class SetupSystem extends createSystem({
        priority: 0,
      }) {
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
          this.spawn.gltf(this.assets.gltf("robot"), {
            key: "level.robot.default",
            name: "robot-default",
            transform: { translation: [-1.25, 0, 0] },
          });
          this.spawn.gltf(this.assets.gltf("robot"), {
            key: "level.robot.override",
            name: "robot-override",
            materials: {
              renderState: { cullMode: "front" },
            },
            transform: { translation: [1.25, 0, 0] },
          });
        }
      },
    };

    const app = await createApertureApp({
      config,
      systems: [SetupSystemModule],
    });
    const robot = app.context.assets.gltf("robot");
    const loadedScene = robot.scene.value;
    const sourceMaterialKeys = new Set(
      loadedScene?.primitiveMaterials.resolved.map(
        (entry) => entry.materialHandleKey,
      ) ?? [],
    );

    expect(sourceMaterialKeys.size).toBeGreaterThan(0);
    for (const sourceMaterialKey of sourceMaterialKeys) {
      const sourceEntry = app.lowLevel.assets
        .list({ kind: "material", status: "ready" })
        .find((entry) => `material:${entry.handle.id}` === sourceMaterialKey);
      expect(materialCullMode(sourceEntry)).not.toBe("front");
    }

    const overrideEntries = app.lowLevel.assets
      .list({ kind: "material", status: "ready" })
      .filter(
        (entry) =>
          entry.handle.id.includes("robot:material:") &&
          entry.handle.id.includes(":override:"),
      );
    expect(overrideEntries).toHaveLength(sourceMaterialKeys.size);
    expect(overrideEntries.map(materialCullMode)).toEqual(
      new Array(sourceMaterialKeys.size).fill("front"),
    );

    const snapshot = app.stepAndExtract(1 / 60, 0.5, 0);
    const drawCullModes = snapshot.meshDraws.map((draw) =>
      materialCullMode(app.lowLevel.assets.get(draw.material)),
    );

    expect(snapshot.meshDraws.length).toBeGreaterThan(1);
    expect(drawCullModes).toContain("front");
    expect(drawCullModes.filter((mode) => mode === "front")).toHaveLength(
      overrideEntries.length,
    );
  });

  it("spawns repeated GLB instances with shared batch options as ECS subtrees", async () => {
    const cubeBytes = await readFile("examples/assets/cube.glb");
    const cubeDataUrl = `data:model/gltf-binary;base64,${cubeBytes.toString(
      "base64",
    )}`;
    const spawnedRootRefs: Array<{ index: number; generation: number }> = [];
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
      default: class SetupSystem extends createSystem({
        priority: 0,
      }) {
        override init(): void {
          this.spawn.camera({
            key: "camera.main",
            name: "main-camera",
            transform: { translation: [0, 1.5, 6], lookAt: [0, 0.5, 0] },
          });
          this.spawn.light({
            key: "light.key",
            name: "key-light",
            kind: "directional",
            illuminance: 4,
            transform: { rotationEulerDegrees: [-45, 35, 0] },
          });

          const roots = this.spawn.gltfBatch(this.assets.gltf("robot"), {
            tags: ["batch", "robot"],
            materials: {
              renderState: { cullMode: "front" },
            },
            castShadow: false,
            receiveShadow: true,
            instances: [
              {
                key: "level.robot.a",
                name: "robot-a",
                transform: { translation: [-1.5, 0, 0] },
              },
              {
                key: "level.robot.b",
                name: "robot-b",
                tags: ["variant"],
                transform: { translation: [1.5, 0, 0] },
              },
            ],
          });

          spawnedRootRefs.push(
            ...roots.map((root) => ({
              index: root.index,
              generation: root.generation,
            })),
          );
        }
      },
    };

    const app = await createApertureApp({
      config,
      systems: [SetupSystemModule],
    });
    const rootsByKey = new Map(
      [
        ...app.lowLevel.world.queryManager.registerQuery({
          required: [AppEntityKey],
        }).entities,
      ].map((entity) => [
        entity.getValue(AppEntityKey, "value") as string,
        entity,
      ]),
    );
    const firstRoot = rootsByKey.get("level.robot.a");
    const secondRoot = rootsByKey.get("level.robot.b");
    expect(spawnedRootRefs).toHaveLength(2);
    expect(firstRoot).toBeDefined();
    expect(secondRoot).toBeDefined();
    if (firstRoot === undefined || secondRoot === undefined) {
      throw new Error("Expected batched GLTF roots to exist.");
    }

    expect(firstRoot.getValue(Name, "value")).toBe("robot-a");
    expect(secondRoot.getValue(Name, "value")).toBe("robot-b");
    expect(readAppTags(firstRoot)).toEqual(["batch", "robot"]);
    expect(readAppTags(secondRoot)).toEqual(["batch", "robot", "variant"]);
    expect([...firstRoot.getVectorView(LocalTransform, "translation")]).toEqual(
      [-1.5, 0, 0],
    );
    expect([
      ...secondRoot.getVectorView(LocalTransform, "translation"),
    ]).toEqual([1.5, 0, 0]);

    const firstMeshEntities = meshEntitiesInSubtree(
      app.lowLevel.world,
      firstRoot,
    );
    const secondMeshEntities = meshEntitiesInSubtree(
      app.lowLevel.world,
      secondRoot,
    );
    expect(firstMeshEntities.length).toBeGreaterThan(0);
    expect(secondMeshEntities.length).toBeGreaterThan(0);
    for (const entity of [...firstMeshEntities, ...secondMeshEntities]) {
      expect(entity.hasComponent(ShadowCaster)).toBe(true);
      expect(entity.getValue(ShadowCaster, "enabled")).toBe(false);
      expect(entity.hasComponent(ShadowReceiver)).toBe(true);
      expect(entity.getValue(ShadowReceiver, "enabled")).toBe(true);
    }

    const sourceMaterialCount =
      app.context.assets.gltf("robot").scene.value?.primitiveMaterials.resolved
        .length ?? 0;
    const overrideEntries = app.lowLevel.assets
      .list({ kind: "material", status: "ready" })
      .filter(
        (entry) =>
          entry.handle.id.includes("robot:material:") &&
          entry.handle.id.includes(":override:"),
      );
    expect(overrideEntries).toHaveLength(sourceMaterialCount);
    expect(overrideEntries.map(materialCullMode)).toEqual(
      new Array(sourceMaterialCount).fill("front"),
    );

    const snapshot = app.stepAndExtract(1 / 60, 0.5, 0);
    expect(snapshot.meshDraws.length).toBeGreaterThanOrEqual(
      firstMeshEntities.length + secondMeshEntities.length,
    );
  });

  it("runs the developer API example systems through a config-driven headless runner", async () => {
    const loadedAssets: string[] = [];
    const runner = await createApertureHeadlessRunner({
      config: developerHeadlessConfig,
      systems: [
        { default: SetupSystem },
        { default: AssetCommandSystem },
        { default: SelectSystem },
        { default: SpinCrateSystem },
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
        manual: ["decal", "generatedWater"],
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

    // select.system now reacts to a pointer click (interaction.onClick): drive a
    // down+up over the crate to trigger the selection.
    runner.enqueueInputBatch([
      { kind: "pointer", pointer: "primary", position: [0.25, 0.5] },
      { kind: "pointer", pointer: "primary", pressed: true },
    ]);
    runner.step(1 / 60, 1);
    runner.enqueueInput({
      kind: "pointer",
      pointer: "primary",
      pressed: false,
    });
    const selected = runner.step(1 / 60, 1.05);

    expect(selected.status.input.actions.select).toMatchObject({
      kind: "button",
      pressed: false,
      value: false,
      up: true,
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
        { default: SetupSystem },
        { default: AssetCommandSystem },
        { default: SelectSystem },
        { default: SpinCrateSystem },
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

    const spriteEntity = runner.app.lowLevel.world.createEntity();
    spriteEntity.addComponent(AppEntityKey, { value: "effect.summary-sprite" });
    spriteEntity.addComponent(Enabled, { value: false });
    spriteEntity.addComponent(Name, { value: "Summary Sprite" });
    spriteEntity.addComponent(
      Sprite,
      createSprite({
        texture: createTextureHandle("entity-summary-sprite"),
        size: [2, 3],
        color: [0.25, 0.5, 0.75, 0.9],
        uvRect: [0.25, 0.5, 0.5, 0.25],
        pivot: [0.2, 0.8],
        rotation: 0.5,
        atlasFrame: 2,
        coordinateMode: "screen",
        billboardMode: "cylindrical",
        sizeMode: "screen-pixels",
        blendMode: "additive",
        depthMode: "disabled",
      }),
    );
    spriteEntity.addComponent(RenderLayer, { mask: 2 });
    const sprite = runner.entities.find({
      key: "effect.summary-sprite",
      withComponents: [Sprite.id],
    });
    expect(sprite.summaries).toHaveLength(1);
    expect(sprite.summaries[0]).toMatchObject({
      enabled: false,
      componentIds: expect.arrayContaining([Sprite.id]),
      renderLayer: {
        mask: 2,
      },
      renderSprite: {
        textureId: "texture:entity-summary-sprite",
        samplerId: "",
        color: [
          expect.closeTo(0.25),
          expect.closeTo(0.5),
          expect.closeTo(0.75),
          expect.closeTo(0.9),
        ],
        width: 2,
        height: 3,
        uvRect: [
          expect.closeTo(0.25),
          expect.closeTo(0.5),
          expect.closeTo(0.5),
          expect.closeTo(0.25),
        ],
        pivot: [expect.closeTo(0.2), expect.closeTo(0.8)],
        rotation: expect.closeTo(0.5),
        atlasFrame: 2,
        coordinateMode: "screen",
        billboardMode: "cylindrical",
        sizeMode: "screen-pixels",
        blendMode: "additive",
        depthMode: "disabled",
      },
    });

    const byName = runner.entities.find({ namePattern: "^crate$" });
    expect(byName.summaries.map((summary) => summary.key)).toContain(
      "level.crate.primary",
    );

    const beforeSelect = runner.entities.snapshot({
      label: "before-select",
      key: "level.crate.primary",
    });
    // select.system reacts to a pointer click now: drive a down+up over the crate.
    runner.enqueueInputBatch([
      { kind: "pointer", pointer: "primary", position: [0.25, 0.5] },
      { kind: "pointer", pointer: "primary", pressed: true },
    ]);
    runner.step(1 / 60, 1);
    runner.enqueueInput({
      kind: "pointer",
      pointer: "primary",
      pressed: false,
    });
    runner.step(1 / 60, 1.05);
    const afterSelect = runner.entities.snapshot({
      label: "after-select",
      key: "level.crate.primary",
    });
    const selectDiff = runner.entities.diff(beforeSelect, afterSelect);

    expect(selectDiff).toMatchObject({
      fromLabel: "before-select",
      toLabel: "after-select",
      counts: {
        added: 0,
        removed: 0,
        changed: 1,
        unchanged: 0,
      },
      diagnostics: [],
    });
    expect(selectDiff.changed[0]).toMatchObject({
      entity: beforeSelect.summaries[0]!.entity,
      fields: expect.arrayContaining(["componentIds"]),
      after: {
        componentIds: expect.arrayContaining([DebugMetadata.id]),
      },
    });
    const selectedCrate = afterSelect.summaries[0]!.entity;
    const mutation = runner.entities.setComponentField({
      entity: selectedCrate,
      component: DebugMetadata.id,
      field: "note",
      value: "tool.mutated",
    });
    expect(mutation).toMatchObject({
      ok: true,
      summary: {
        entity: selectedCrate,
        componentIds: expect.arrayContaining([DebugMetadata.id]),
      },
    });
    const mutatedEntity =
      runner.app.lowLevel.world.entityManager.getEntityByIndex(
        selectedCrate.index,
      );
    expect(mutatedEntity?.getValue(DebugMetadata, "note")).toBe("tool.mutated");
    expect(
      runner.entities.setComponentField({
        entity: selectedCrate,
        component: "aperture.render.mesh",
        field: "handle",
        value: "unsafe",
      }),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.componentMutationUnsupported",
        suggestedFix: expect.stringContaining("whitelist"),
      },
    });
    expect(
      runner.entities.setComponentField({
        entity: selectedCrate,
        component: DebugMetadata.id,
        field: "missing",
        value: "unsafe",
      }),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.componentFieldUnsupported",
      },
    });
    expect(
      runner.entities.setComponentField({
        entity: {
          index: selectedCrate.index,
          generation: selectedCrate.generation + 1,
        },
        component: DebugMetadata.id,
        field: "note",
        value: "stale",
      }),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.generationMismatch",
        suggestedFix: expect.stringContaining("aperture_entity_find"),
      },
    });

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

    const staleSnapshot = runner.entities.snapshot({
      label: "stale-ref",
      entities: [
        {
          index: robot.summaries[0]!.entity.index,
          generation: robot.summaries[0]!.entity.generation + 1,
        },
      ],
    });
    expect(staleSnapshot).toMatchObject({
      label: "stale-ref",
      summaries: [],
      total: 1,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.entityLookup.generationMismatch",
          suggestedFix: expect.stringContaining("aperture_entity_find"),
        }),
      ],
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
        { default: SetupSystem },
        { default: AssetCommandSystem },
        { default: SelectSystem },
        { default: SpinCrateSystem },
      ],
      assetLoader: {
        async load(assetHandle) {
          loadedAssets.push(assetHandle.id);
        },
      },
    });

    expect(loadedAssets).toContain("robot");
    expect(loadedAssets).not.toContain("decal");
    expect(loadedAssets).not.toContain("generatedWater");
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

  it("discovers worker system globs and records descriptor priority metadata without exposing classes to the main manifest", async () => {
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
          `export default class SpinCrateSystem extends createSystem({ priority: 100 }) {}`,
          "",
        ].join("\n"),
      );
      await writeFile(
        path.join(root, "src/systems/default-priority.system.ts"),
        [
          `import { createSystem } from "@aperture-engine/app/systems";`,
          `export default class DefaultPrioritySystem extends createSystem() {}`,
          "",
        ].join("\n"),
      );
      await writeFile(
        path.join(root, "src/systems/nested-config-priority.system.ts"),
        [
          `import { EcsType, createSystem } from "@aperture-engine/app/systems";`,
          `export default class NestedConfigPrioritySystem extends createSystem({`,
          `  config: {`,
          `    priority: { type: EcsType.Float32, default: 12 },`,
          `  },`,
          `}) {}`,
          "",
        ].join("\n"),
      );
      await writeFile(
        path.join(root, "src/systems/early-priority.system.ts"),
        [
          `import { createSystem } from "@aperture-engine/app/systems";`,
          `export default class EarlyPrioritySystem extends createSystem({ priority: -1.5 }) {}`,
          "",
        ].join("\n"),
      );

      const manifest = await createApertureSystemManifest({ root });
      const plugin = apertureFromVitePlugin();
      plugin.configResolved?.({ root });
      const workerSystemsId = plugin.resolveId?.(
        "virtual:aperture/worker-systems",
      );
      const workerSystemsModule =
        workerSystemsId === null || workerSystemsId === undefined
          ? null
          : await plugin.load?.(workerSystemsId);

      expect(manifest.diagnostics).toEqual([]);
      expect(
        manifest.systems.map((system) => path.basename(system.file)),
      ).toEqual([
        "early-priority.system.ts",
        "default-priority.system.ts",
        "nested-config-priority.system.ts",
        "spin-crate.system.ts",
      ]);
      expect(
        manifest.systems.map((system) => system.schedule.priority),
      ).toEqual([-1.5, 0, 0, 100]);
      expect(manifest.systems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            hasDefaultExport: true,
            schedule: { priority: 100 },
          }),
        ]),
      );
      expect(JSON.stringify(manifest.systems)).not.toContain("SpinCrateSystem");
      expect(workerSystemsModule).not.toBeNull();
      expect(workerSystemsModule).not.toContain("schedule");
      expect(workerSystemsModule).toContain(
        "{ default: SystemModule0.default }",
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("discovers worker systems from a local shared config factory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aperture-plugin-"));

    try {
      await mkdir(path.join(root, "src/systems"), { recursive: true });
      await writeFile(
        path.join(root, "aperture.config.ts"),
        [
          `import { createConfig } from "./aperture.shared-config.ts";`,
          `export default createConfig("browser");`,
          "",
        ].join("\n"),
      );
      await writeFile(
        path.join(root, "aperture.shared-config.ts"),
        [
          `import { defineApertureConfig } from "@aperture-engine/app/config";`,
          `export function createConfig(mode: "browser" | "headless") {`,
          `  return defineApertureConfig({`,
          `    mode,`,
          `    systems: ["src/systems/**/*.system.ts"],`,
          `  });`,
          `}`,
          "",
        ].join("\n"),
      );
      await writeFile(
        path.join(root, "src/systems/factory.system.ts"),
        [
          `import { createSystem } from "@aperture-engine/app/systems";`,
          `export default class FactorySystem extends createSystem({ priority: 3 }) {}`,
          "",
        ].join("\n"),
      );

      const manifest = await createApertureSystemManifest({ root });

      expect(manifest.diagnostics).toEqual([]);
      expect(manifest.systems).toEqual([
        expect.objectContaining({
          file: path.join(root, "src/systems/factory.system.ts"),
          schedule: { priority: 3 },
        }),
      ]);
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
        [`export const notASystem = true;`, ""].join("\n"),
      );
      await writeFile(
        path.join(root, "src/systems/bad-priority.system.ts"),
        [
          `import { createSystem } from "@aperture-engine/app/systems";`,
          `export default class BadPrioritySystem extends createSystem({ priority: "late" }) {}`,
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
            code: "aperture.system.invalidPriority",
            source: expect.objectContaining({
              file: expect.stringContaining("bad-priority.system.ts"),
            }),
            suggestedFix: expect.stringContaining("createSystem"),
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
      systems: [{}],
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
    expect(setupSystem).toContain("material.customWgsl");
    expect(setupSystem).toContain("shader.asset");

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

function isSimulationWorkerSnapshotMessage(value: unknown): value is {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
  readonly workerSummary?: unknown;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.snapshot
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function materialCullMode(entry: { readonly asset: unknown } | undefined) {
  const asset = readRecord(entry?.asset);
  const renderState = readRecord(asset?.renderState);
  const cullMode = renderState?.cullMode;
  return typeof cullMode === "string" ? cullMode : undefined;
}

function meshEntitiesInSubtree(world: EcsWorld, root: Entity): Entity[] {
  const childrenByParent = new Map<string, Entity[]>();
  const parentQuery = world.queryManager.registerQuery({
    required: [Parent],
  });

  for (const entity of parentQuery.entities) {
    const parent = entity.getValue(Parent, "entity");
    if (parent === null || parent === undefined || !parent.active) continue;
    const key = entityKey(parent);
    const children = childrenByParent.get(key) ?? [];
    children.push(entity);
    childrenByParent.set(key, children);
  }

  const result: Entity[] = [];
  const stack = [root];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const entity = stack.pop()!;
    const key = entityKey(entity);
    if (!entity.active || visited.has(key)) continue;
    visited.add(key);

    if (entity.hasComponent(Mesh)) {
      result.push(entity);
    }

    for (const child of childrenByParent.get(key) ?? []) {
      stack.push(child);
    }
  }

  return result;
}

function entityKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}

function readAppTags(entity: Entity): readonly string[] {
  if (!entity.hasComponent(AppEntityTags)) {
    return [];
  }

  const raw = entity.getValue(AppEntityTags, "valuesJson");
  if (typeof raw !== "string") {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((value): value is string => typeof value === "string")
    : [];
}

function createCanvasMeasureElement(input: {
  readonly width: number;
  readonly height: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
}): {
  readonly clientWidth: number;
  readonly clientHeight: number;
  getBoundingClientRect(): { readonly width: number; readonly height: number };
} {
  return {
    clientWidth: input.clientWidth,
    clientHeight: input.clientHeight,
    getBoundingClientRect() {
      return { width: input.width, height: input.height };
    },
  };
}

async function readEventually(file: string): Promise<string> {
  const deadline = Date.now() + 1000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      return await readFile(file, "utf8");
    } catch (error: unknown) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
