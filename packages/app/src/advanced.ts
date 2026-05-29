import {
  createExtractionApp,
  type CreateExtractionAppOptions,
  type ExtractionApp,
} from "@aperture-engine/runtime";
import type { SystemConstructor, SystemQueries, SystemSchema } from "elics";
import {
  createApertureSystemContext,
  flushApertureSystemEffects,
  type ApertureAssetLoader,
  type SystemGltfAssetDecoderProvider,
  type ApertureSystemConstructor,
  type ApertureSystemContext,
} from "./systems.js";
import {
  defineApertureConfig,
  type ApertureConfig,
  type AssetPreloadPolicy,
} from "./config.js";

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
}

export interface AperturePreloadReport {
  readonly blocking: readonly string[];
  readonly background: readonly string[];
  readonly manual: readonly string[];
}

export interface ApertureApp {
  readonly mode: ApertureConfig["mode"];
  readonly config: ApertureConfig;
  readonly lowLevel: ExtractionApp;
  readonly context: ApertureSystemContext;
  readonly preload: AperturePreloadReport;
  step(delta?: number, time?: number): ReturnType<ExtractionApp["step"]>;
  extract(frame?: number): ReturnType<ExtractionApp["extract"]>;
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
  const lowLevel = createExtractionApp({
    ...(options.worldOptions === undefined
      ? {}
      : { worldOptions: options.worldOptions }),
  });
  const context = createApertureSystemContext({
    world: lowLevel.world,
    assetsRegistry: lowLevel.assets,
    config,
    ...(options.assetLoader === undefined
      ? {}
      : { assetLoader: options.assetLoader }),
    ...(options.gltfAssetDecoders === undefined
      ? {}
      : { gltfAssetDecoders: options.gltfAssetDecoders }),
  });
  const preload = preloadReport(config);

  await preloadAssets(context, "blocking");
  startBackgroundPreloads(context);
  installRenderDefaults(config, context);
  registerApertureSystemModules(lowLevel, options.systems ?? []);

  const apertureApp: ApertureApp = {
    mode: config.mode,
    config,
    lowLevel,
    context,
    preload,
    step(delta = 0, time = 0) {
      flushApertureSystemEffects(lowLevel.world, "input");
      const result = lowLevel.step(delta, time);
      flushApertureSystemEffects(lowLevel.world, "postUpdate");
      return result;
    },
    extract(frame = 0) {
      return lowLevel.extract(frame);
    },
    stepAndExtract(delta = 0, time = 0, frame = 0) {
      apertureApp.step(delta, time);
      return lowLevel.extract(frame);
    },
  };

  return apertureApp;
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
