import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import type { ApertureConfig } from "../config.js";
import {
  createInputResource,
  type InputAction,
  type InputResourceBase,
} from "../input/state.js";
import {
  createSpatialQueries,
  type SpatialQueries,
} from "../spatial-queries.js";
import { createDiagnostics, type SystemDiagnostics } from "./diagnostics.js";
import { createScheduledEffects, type ScheduledEffects } from "./effects.js";
import { ApertureSystemError } from "./errors.js";
import { createCommandAccess, type CommandAccess } from "./commands.js";
import {
  createSystemAssetAccess,
  type ApertureAssetLoader,
  type SystemAssetAccess,
} from "./assets.js";
import { registerApertureAppComponents } from "./components.js";
import { createCameraAccess, type CameraAccess } from "./cameras.js";
import { createSignalStore, type SignalStore } from "./signals.js";
import { createSpawnCommands, type SpawnCommands } from "./spawn/index.js";

// This interface is intentionally empty so generated app-local declarations can
// augment it with kind-specific action properties.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApertureGeneratedActionMap {}

export type InputActions = ApertureGeneratedActionMap &
  Record<string, InputAction>;

export type InputSignals = Omit<InputResourceBase, "actions"> & {
  readonly actions: InputActions;
};

export interface ApertureSystemContext {
  readonly world: unknown;
  readonly assetsRegistry: AssetRegistry;
  readonly signals: SignalStore;
  readonly input: InputSignals;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly diagnostics: SystemDiagnostics;
  readonly effects: ScheduledEffects;
}

export interface CreateApertureSystemContextOptions {
  readonly world: EcsWorld;
  readonly assetsRegistry: AssetRegistry;
  readonly config?: ApertureConfig;
  readonly assetLoader?: ApertureAssetLoader;
}

const APERTURE_SYSTEM_CONTEXT_KEY = "aperture.systemContext";

export function installApertureSystemContext(
  world: EcsWorld,
  context: ApertureSystemContext,
): void {
  world.globals[APERTURE_SYSTEM_CONTEXT_KEY] = context;
}

export function createApertureSystemContext(
  options: CreateApertureSystemContextOptions,
): ApertureSystemContext {
  registerApertureAppComponents(options.world);

  const diagnostics = createDiagnostics();
  const signals = createSignalStore(options.config?.signals ?? {});
  const input = createInputSignals(options.config);
  const assets = createSystemAssetAccess({
    config: options.config,
    registry: options.assetsRegistry,
    diagnostics,
    loader: options.assetLoader,
  });
  const commands = createCommandAccess(assets);
  const spatial = createSpatialQueries();
  const spawn = createSpawnCommands({
    world: options.world,
    registry: options.assetsRegistry,
    diagnostics,
    get assets() {
      return assets;
    },
  });
  const cameras = createCameraAccess(options.world, {
    contextKey: APERTURE_SYSTEM_CONTEXT_KEY,
  });

  const context: ApertureSystemContext = {
    world: options.world,
    assetsRegistry: options.assetsRegistry,
    signals,
    input,
    assets,
    commands,
    spawn,
    spatial,
    cameras,
    diagnostics,
    effects: createScheduledEffects(),
  };

  installApertureSystemContext(options.world, context);
  return context;
}

export function getApertureSystemContext(
  world: EcsWorld,
): ApertureSystemContext {
  const context = world.globals[APERTURE_SYSTEM_CONTEXT_KEY];

  if (isApertureSystemContext(context)) {
    return context;
  }

  throw new ApertureSystemError(
    "aperture.systemContext.missing",
    "Aperture system context is not installed on the ECS world.",
    "Create the app through createApertureApp() or installApertureSystemContext() before registering app systems.",
  );
}

function isApertureSystemContext(
  value: unknown,
): value is ApertureSystemContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "signals" in value &&
    "spawn" in value &&
    "effects" in value
  );
}

function createInputSignals(config: ApertureConfig | undefined): InputSignals {
  return createInputResource(config) as InputSignals;
}
