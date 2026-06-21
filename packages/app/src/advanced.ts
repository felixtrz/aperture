import {
  createExtractionApp,
  type CreateExtractionAppOptions,
  type ExtractionApp,
  type SimulationStepResult,
} from "@aperture-engine/runtime";
import type { SystemConstructor, SystemQueries, SystemSchema } from "elics";
import { resolveWorldTransforms } from "@aperture-engine/simulation";
import {
  createApertureSystemContext,
  flushApertureSystemEffects,
  type ApertureAssetLoader,
  type SystemGltfAssetDecoderProvider,
  type ApertureSystemConstructor,
  type ApertureSystemContext,
} from "./systems.js";
import {
  createSpatialIndexPopulationState,
  populateSpatialIndexFromWorld,
} from "./systems/spatial-index-population.js";
import { applyPhysicsSnapshotInterpolation } from "./physics-interpolation.js";
import {
  applyRenderSnapshotInterpolation,
  installRenderInterpolationFixedStep,
} from "./render-interpolation.js";
import { runInteractionFrame } from "./interaction/system.js";
import { runHtmlBridgeFrame } from "./systems/html-bridge.js";
import { runScreenSpaceFramingFrame } from "./systems/screen-space-framing.js";
import {
  defineApertureConfig,
  type ApertureConfig,
  type AssetPreloadPolicy,
} from "./config.js";
import {
  installApertureAppPhysics,
  type AperturePhysicsConfig,
  type AperturePhysicsFacade,
} from "./physics-facade.js";

export interface ApertureSystemModule {
  readonly default?: ApertureSystemConstructor;
  readonly configData?: Record<string, unknown>;
}

export interface ApertureResolvedSystemModule {
  readonly moduleId: string;
  readonly System: ApertureSystemConstructor;
  readonly priority: number;
  readonly configData?: Record<string, unknown>;
}

export interface CreateApertureAppOptions {
  readonly config: ApertureConfig;
  readonly systems?: readonly ApertureSystemModule[];
  readonly assetLoader?: ApertureAssetLoader;
  readonly gltfAssetDecoders?: SystemGltfAssetDecoderProvider;
  readonly worldOptions?: CreateExtractionAppOptions["worldOptions"];
  readonly fixedStep?: CreateExtractionAppOptions["fixedStep"];
  readonly physics?: boolean | AperturePhysicsConfig;
  readonly physicsInterpolation?: boolean;
  readonly startOptions?: Readonly<Record<string, unknown>>;
}

export interface AperturePreloadReport {
  readonly blocking: readonly string[];
  readonly background: readonly string[];
  readonly manual: readonly string[];
}

export interface ApertureAppStepResult {
  readonly transform: SimulationStepResult["transform"];
  readonly fixedStep: SimulationStepResult["fixedStep"];
  readonly timing: ApertureAppStepTimingReport;
}

export interface ApertureAppStepTimingReport {
  readonly totalMilliseconds: number;
  readonly preStepResolveSpatialMilliseconds: number;
  readonly inputEffectsMilliseconds: number;
  readonly lowLevelStepMilliseconds: number;
  readonly postStepSpatialMilliseconds: number;
  readonly interactionMilliseconds: number;
  readonly postUpdateEffectsMilliseconds: number;
  readonly preStepWorldChanged: boolean;
  readonly lowLevel: SimulationStepResult["timing"];
}

export interface ApertureApp {
  readonly mode: ApertureConfig["mode"];
  readonly config: ApertureConfig;
  readonly lowLevel: ExtractionApp;
  readonly context: ApertureSystemContext;
  readonly physics: AperturePhysicsFacade | null;
  readonly preload: AperturePreloadReport;
  step(delta?: number, time?: number): ApertureAppStepResult;
  extract(frame?: number): ReturnType<ExtractionApp["extract"]>;
  registerFixedStepTask(
    task: Parameters<ExtractionApp["registerFixedStepTask"]>[0],
    options?: Parameters<ExtractionApp["registerFixedStepTask"]>[1],
  ): () => void;
  resetFixedStepClock(): void;
  stepAndExtract(
    delta?: number,
    time?: number,
    frame?: number,
  ): ReturnType<ExtractionApp["stepAndExtract"]>;
}

export class ApertureAppError extends Error {
  readonly code: string;
  readonly suggestedFix: string;
  readonly detail: Readonly<Record<string, unknown>> | undefined;

  constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly suggestedFix: string;
    readonly detail?: Readonly<Record<string, unknown>>;
  }) {
    super(`${input.message} Suggested fix: ${input.suggestedFix}`);
    this.name = "ApertureAppError";
    this.code = input.code;
    this.suggestedFix = input.suggestedFix;
    this.detail = input.detail;
  }
}

export async function createApertureApp(
  options: CreateApertureAppOptions,
): Promise<ApertureApp> {
  const config = defineApertureConfig(options.config);
  const physicsConfig = normalizePhysicsConfig(options.physics);

  if (physicsConfig !== null && options.fixedStep === false) {
    throw new ApertureAppError({
      code: "aperture.physics.fixedStepDisabled",
      message: "Aperture physics requires an enabled fixed-step clock.",
      suggestedFix:
        "Omit fixedStep to use the default clock, pass fixedStep options, or disable the physics config.",
    });
  }

  const fixedStep =
    options.fixedStep === undefined && physicsConfig !== null
      ? {}
      : options.fixedStep;
  const lowLevel = createExtractionApp({
    ...(options.worldOptions === undefined
      ? {}
      : { worldOptions: options.worldOptions }),
    ...(fixedStep === undefined ? {} : { fixedStep }),
  });
  const context = createApertureSystemContext({
    world: lowLevel.world,
    assetsRegistry: lowLevel.assets,
    config,
    registerFixedStepTask: (task, taskOptions) =>
      lowLevel.registerFixedStepTask(task, taskOptions),
    ...(options.startOptions === undefined
      ? {}
      : { startOptions: options.startOptions }),
    ...(options.assetLoader === undefined
      ? {}
      : { assetLoader: options.assetLoader }),
    ...(options.gltfAssetDecoders === undefined
      ? {}
      : { gltfAssetDecoders: options.gltfAssetDecoders }),
  });
  const preload = preloadReport(config);
  const spatialIndexPopulation = createSpatialIndexPopulationState();
  installRenderInterpolationFixedStep({
    world: lowLevel.world,
    registerFixedStepTask: (task, taskOptions) =>
      lowLevel.registerFixedStepTask(task, taskOptions),
  });
  const physicsInterpolation = options.physicsInterpolation === true;
  const physicsFacade =
    physicsConfig === null
      ? null
      : await installApertureAppPhysics({
          world: lowLevel.world,
          assets: lowLevel.assets,
          physics: context.physics,
          config: physicsConfig,
          registerFixedStepTask: (task, taskOptions) =>
            lowLevel.registerFixedStepTask(task, taskOptions),
        });
  let lastFixedStep: ReturnType<ExtractionApp["step"]>["fixedStep"] | null =
    null;
  const refreshSpatialIndex = () =>
    populateSpatialIndexFromWorld(
      {
        world: lowLevel.world,
        assetsRegistry: context.assetsRegistry,
        spatial: context.spatial,
      },
      spatialIndexPopulation,
    );

  await preloadAssets(context, "blocking");
  startBackgroundPreloads(context);
  installRenderDefaults(config, context);
  registerApertureSystemModules(lowLevel, options.systems ?? []);
  resolveWorldTransforms(lowLevel.world);
  refreshSpatialIndex();
  // AI-60 (cheap half): the pre-step resolve + spatial refresh only repeat
  // when the world actually changed since the post-step refresh (between-step
  // spawns, devtools writes, interaction or postUpdate effects). Steady-state
  // frames run exactly one resolve (inside lowLevel.step, after fixed-step
  // physics writeback) and one spatial refresh per step.
  let worldVersionAtRefresh = lowLevel.world.worldChangeVersion();

  const apertureApp: ApertureApp = {
    mode: config.mode,
    config,
    lowLevel,
    context,
    physics: physicsFacade,
    preload,
    step(delta = 0, time = 0) {
      const timingStartedAt = nowMilliseconds();
      let timingCursor = timingStartedAt;
      const markTiming = (): number => {
        const now = nowMilliseconds();
        const elapsed = Math.max(0, now - timingCursor);

        timingCursor = now;
        return elapsed;
      };
      const preStepWorldChanged =
        lowLevel.world.worldChangeVersion() !== worldVersionAtRefresh;

      runHtmlBridgeFrame({
        commands: context.commands,
        resources: context.resources,
      });

      if (preStepWorldChanged) {
        resolveWorldTransforms(lowLevel.world);
        refreshSpatialIndex();
      }
      const preStepResolveSpatialMilliseconds = markTiming();
      flushApertureSystemEffects(lowLevel.world, "input");
      const inputEffectsMilliseconds = markTiming();
      const result = lowLevel.step(delta, time);
      const lowLevelStepMilliseconds = markTiming();
      lastFixedStep = result.fixedStep;
      const framing = runScreenSpaceFramingFrame(context, delta);
      if (framing.updated > 0) {
        resolveWorldTransforms(lowLevel.world);
      }
      refreshSpatialIndex();
      const postStepSpatialMilliseconds = markTiming();
      worldVersionAtRefresh = lowLevel.world.worldChangeVersion();
      // Synthesize pointer-on-object events from post-update world state, after
      // fixed-step physics writeback has refreshed transforms and picking data.
      runInteractionFrame(context, time);
      const interactionMilliseconds = markTiming();
      flushApertureSystemEffects(lowLevel.world, "postUpdate");
      const postUpdateEffectsMilliseconds = markTiming();
      return {
        ...result,
        timing: {
          totalMilliseconds: Math.max(0, nowMilliseconds() - timingStartedAt),
          preStepResolveSpatialMilliseconds,
          inputEffectsMilliseconds,
          lowLevelStepMilliseconds,
          postStepSpatialMilliseconds,
          interactionMilliseconds,
          postUpdateEffectsMilliseconds,
          preStepWorldChanged,
          lowLevel: result.timing,
        },
      };
    },
    extract(frame = 0) {
      const snapshot = lowLevel.extract(frame);

      if (physicsInterpolation && lastFixedStep !== null) {
        applyPhysicsSnapshotInterpolation({
          snapshot,
          world: lowLevel.world,
          alpha: lastFixedStep.overstepAlpha,
        });
      }

      if (lastFixedStep !== null) {
        applyRenderSnapshotInterpolation({
          snapshot,
          world: lowLevel.world,
          alpha: lastFixedStep.overstepAlpha,
        });
      }

      return snapshot;
    },
    registerFixedStepTask(task, taskOptions) {
      return lowLevel.registerFixedStepTask(task, taskOptions);
    },
    resetFixedStepClock() {
      lowLevel.resetFixedStepClock();
    },
    stepAndExtract(delta = 0, time = 0, frame = 0) {
      apertureApp.step(delta, time);
      return apertureApp.extract(frame);
    },
  };

  return apertureApp;
}

function normalizePhysicsConfig(
  config: CreateApertureAppOptions["physics"],
): AperturePhysicsConfig | null {
  if (config === undefined || config === false) {
    return null;
  }

  return config === true ? {} : config;
}

export function resolveApertureSystemModules(
  modules: readonly ApertureSystemModule[],
): ApertureResolvedSystemModule[] {
  return modules
    .map((moduleValue, index) => resolveSystemModule(moduleValue, index))
    .sort(
      (a, b) => a.priority - b.priority || a.moduleId.localeCompare(b.moduleId),
    );
}

export function registerApertureSystemModules(
  app: Pick<ExtractionApp, "world">,
  modules: readonly ApertureSystemModule[],
): readonly ApertureResolvedSystemModule[] {
  const resolved = resolveApertureSystemModules(modules);

  for (const moduleValue of resolved) {
    app.world.registerSystem(
      moduleValue.System as unknown as SystemConstructor<
        SystemSchema,
        SystemQueries
      >,
      {
        priority: moduleValue.priority,
        ...(moduleValue.configData === undefined
          ? {}
          : { configData: moduleValue.configData }),
      },
    );
  }

  return resolved;
}

function resolveSystemModule(
  moduleValue: ApertureSystemModule,
  index: number,
): ApertureResolvedSystemModule {
  if (moduleValue.default === undefined) {
    throw new ApertureAppError({
      code: "aperture.system.missingDefaultExport",
      message: `Discovered system module at index ${index} has no default export.`,
      suggestedFix:
        "Default-export a class that extends createSystem() from @aperture-engine/app/systems.",
      detail: { index },
    });
  }

  if (!isSystemConstructor(moduleValue.default)) {
    throw new ApertureAppError({
      code: "aperture.system.invalidDefaultExport",
      message: `Discovered system module at index ${index} does not export an EliCS system class.`,
      suggestedFix:
        "Use export default class MySystem extends createSystem(...) { ... }.",
      detail: { index },
    });
  }

  const priority = moduleValue.default.aperture?.schedule.priority ?? 0;

  if (!Number.isFinite(priority)) {
    throw new ApertureAppError({
      code: "aperture.system.invalidPriority",
      message: `Discovered system module at index ${index} has an invalid createSystem descriptor priority.`,
      suggestedFix: "Use createSystem({ priority: 0 }) or omit priority.",
      detail: { index, priority },
    });
  }

  return {
    moduleId: moduleValue.default.name || `system:${index}`,
    System: moduleValue.default,
    priority,
    ...(moduleValue.configData === undefined
      ? {}
      : { configData: moduleValue.configData }),
  };
}

function isSystemConstructor(
  value: unknown,
): value is ApertureSystemConstructor {
  return (
    typeof value === "function" &&
    "isSystem" in value &&
    (value as { readonly isSystem?: unknown }).isSystem === true
  );
}

async function preloadAssets(
  context: ApertureSystemContext,
  policy: AssetPreloadPolicy,
): Promise<void> {
  const matching = context.assets
    .list()
    .filter((asset) => asset.preload === policy);

  await Promise.all(matching.map((asset) => context.assets.request(asset)));
}

function startBackgroundPreloads(context: ApertureSystemContext): void {
  for (const asset of context.assets.list()) {
    if (asset.preload !== "background") {
      continue;
    }

    void context.assets.request(asset).catch(() => undefined);
  }
}

function preloadReport(config: ApertureConfig): AperturePreloadReport {
  const byPolicy: Record<AssetPreloadPolicy, string[]> = {
    blocking: [],
    background: [],
    manual: [],
  };

  for (const [id, descriptor] of Object.entries(config.assets ?? {})) {
    byPolicy[descriptor.preload].push(id);
  }

  return {
    blocking: byPolicy.blocking,
    background: byPolicy.background,
    manual: byPolicy.manual,
  };
}

function nowMilliseconds(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function installRenderDefaults(
  config: ApertureConfig,
  context: ApertureSystemContext,
): void {
  if (config.render?.defaultCamera === true) {
    context.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [0, 1.5, 5],
        lookAt: [0, 0.75, 0],
      },
      fovYDegrees: 60,
    });
  }

  if (config.render?.defaultLight === true) {
    context.spawn.light({
      key: "light.default",
      name: "default-light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });
  }
}
