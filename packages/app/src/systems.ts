import {
  computed,
  signal as createSignal,
  type Signal,
} from "@preact/signals-core";
import type {
  Query,
  SystemQueries,
  SystemSchema,
  TypeValueToType,
} from "elics";
import {
  DebugMetadata,
  EcsType,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createSystem as createElicsSystem,
  defineComponent,
  quatFromAxisAngle,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import type { ApertureConfig, ApertureSignalDescriptor } from "./config.js";
import {
  createSpatialQueries,
  type SpatialQueries,
} from "./spatial-queries.js";
import {
  createInputResource,
  type InputAction,
  type InputResourceBase,
  type StatefulGamepadsState,
  type StatefulKeyboardState,
} from "./input-state.js";
import {
  createScheduledEffects,
  registerSystemEffects,
  type ScheduledEffects,
} from "./systems-effects.js";
import {
  createDiagnostics,
  type SystemDiagnostics,
} from "./systems-diagnostics.js";
import { ApertureSystemError } from "./systems-error.js";
import { jsonSafeValue } from "./systems-json.js";
import { createCommandAccess, type CommandAccess } from "./systems-commands.js";
import {
  createSystemAssetAccess,
  type ApertureAssetLoader,
  type SystemAssetAccess,
} from "./systems-assets.js";
import { registerApertureAppComponents } from "./systems-components.js";
import { createCameraAccess, type CameraAccess } from "./systems-cameras.js";
import { createSpawnCommands, type SpawnCommands } from "./systems-spawn.js";

export { createSpatialQueries } from "./spatial-queries.js";
export type {
  RayInput,
  SpatialPickableState,
  SpatialQueries,
  SpatialRaycastHit,
  SpatialRaycastOptions,
  SpatialRaycastableBounds,
  SpatialRaycastableMesh,
} from "./spatial-queries.js";

export {
  DebugMetadata,
  Enabled,
  EcsType,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  computed,
  createSignal as signal,
  defineComponent,
  quatFromAxisAngle,
};

export type SignalStore = Record<string, Signal<unknown>>;
export type SignalSummary = Readonly<Record<string, unknown>>;

export function createSignalSummary(signals: SignalStore): SignalSummary {
  const summary: Record<string, unknown> = {};

  for (const [key, signal] of Object.entries(signals)) {
    summary[key] = jsonSafeValue(signal.value);
  }

  return summary;
}

export type {
  ApertureSystemDiagnostic,
  SystemDiagnostics,
} from "./systems-diagnostics.js";
export { assetDiagnosticFromSystemDiagnostic } from "./systems-diagnostics.js";

export type {
  ApertureEffectHandle,
  ApertureEffectOptions,
  ApertureEffectPhase,
  ApertureEffects,
  ApertureQuery,
  ScheduledEffects,
} from "./systems-effects.js";
export { flushApertureSystemEffects } from "./systems-effects.js";
export type {
  CommandAccess,
  CommandAccessSummary,
  CommandAssetRequestSummary,
  CommandChannelEntry,
} from "./systems-commands.js";
export type {
  ApertureAssetLoader,
  SystemAssetAccess,
  SystemAssetHandle,
  SystemAssetKind,
  SystemGltfAssetHandle,
  SystemGltfLoadedScene,
} from "./systems-assets.js";
export {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
  registerApertureAppComponents,
} from "./systems-components.js";
export type { CameraAccess, CameraHandle } from "./systems-cameras.js";
export { material, mesh } from "./systems-spawn.js";
export type {
  PrimitiveMeshDescriptor,
  SpawnCameraOptions,
  SpawnCommands,
  SpawnGltfOptions,
  SpawnLightOptions,
  SpawnMeshOptions,
  SpawnMetadata,
  StandardMaterialDescriptor,
  StandardMaterialOptions,
  SystemTransformInput,
} from "./systems-spawn.js";

export type {
  ApertureGeneratedGamepadInputEvent,
  ApertureGeneratedGamepadSnapshot,
  ApertureGeneratedInputEvent,
  ApertureGeneratedInputResetEvent,
  ApertureGeneratedKeyboardInputEvent,
  ApertureGeneratedPointerInputEvent,
  ApertureGeneratedPointerName,
  ApertureGeneratedVirtualActionInputEvent,
  ApertureInputDiagnostic,
  ApertureInputSummary,
  GamepadButtonState,
  InputAction,
  InputActionKind,
  InputActionSignals,
  InputAxis1dAction,
  InputAxis2dAction,
  InputButtonAction,
  InputButtonPressedSignal,
  InputVec2Like,
  StatefulGamepadDevice,
  StatefulGamepadDeviceSummary,
  StatefulGamepadsState,
  StatefulGamepadsSummary,
  StatefulGamepadStickState,
  StatefulKeyboardState,
  StatefulKeyboardSummary,
} from "./input-state.js";

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

export interface ApertureSystemInstance {
  readonly world: unknown;
  readonly queries: Record<string, Query>;
  readonly config: Record<string, Signal<unknown>>;
  readonly priority: number;
  readonly signals: SignalStore;
  readonly input: InputSignals;
  readonly actions: InputActions;
  readonly keyboard: StatefulKeyboardState;
  readonly gamepads: StatefulGamepadsState;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly diagnostics: SystemDiagnostics;
  readonly effects: ScheduledEffects;
  createEntity(): Entity;
  init(): void;
  update(delta: number, time: number): void;
  destroy(): void;
}

export type ApertureSystemConfigSignals<TSchema extends SystemSchema> = {
  [K in keyof TSchema]: Signal<TypeValueToType<TSchema[K]["type"]>>;
};

export interface ApertureSystemScheduleMetadata {
  readonly priority: number;
}

export interface ApertureSystemMetadata {
  readonly schedule: ApertureSystemScheduleMetadata;
}

export interface ApertureSystemDescriptor<
  TQueries extends SystemQueries = Record<string, never>,
  TSchema extends SystemSchema = Record<string, never>,
> {
  readonly priority?: number;
  readonly queries?: TQueries;
  readonly config?: TSchema;
}

export type ApertureSystemConstructor<
  TSchema extends SystemSchema = SystemSchema,
  TQueries extends SystemQueries = SystemQueries,
> = {
  readonly schema: TSchema;
  readonly isSystem: boolean;
  readonly queries: TQueries;
  readonly aperture?: ApertureSystemMetadata;
  new (
    world: EcsWorld,
    queryManager: unknown,
    priority: number,
  ): ApertureSystemInstance & {
    readonly queries: Record<keyof TQueries, Query>;
    readonly config: ApertureSystemConfigSignals<TSchema>;
  };
};

const APERTURE_SYSTEM_CONTEXT_KEY = "aperture.systemContext";

export function createSystem<
  TQueries extends SystemQueries = Record<string, never>,
  TSchema extends SystemSchema = Record<string, never>,
>(
  descriptor: ApertureSystemDescriptor<TQueries, TSchema> = {},
): ApertureSystemConstructor<TSchema, TQueries> {
  const priority = normalizeSystemPriority(descriptor.priority);
  const queries = descriptor.queries ?? ({} as TQueries);
  const schema = descriptor.config ?? ({} as TSchema);
  const aperture = Object.freeze({
    schedule: Object.freeze({ priority }),
  }) satisfies ApertureSystemMetadata;
  const Base = createElicsSystem(queries, schema);

  class ApertureSystemBase extends Base implements ApertureSystemInstance {
    static readonly aperture = aperture;

    readonly #context: ApertureSystemContext;
    readonly #effects: ScheduledEffects;

    constructor(...args: ConstructorParameters<typeof Base>) {
      super(...args);
      this.#context = getApertureSystemContext(this.world as EcsWorld);
      this.#effects = createScheduledEffects();
      registerSystemEffects(this, this.#effects);
    }

    get signals(): SignalStore {
      return this.#context.signals;
    }

    get input(): InputSignals {
      return this.#context.input;
    }

    get actions(): InputActions {
      return this.#context.input.actions;
    }

    get keyboard(): StatefulKeyboardState {
      return this.#context.input.keyboard;
    }

    get gamepads(): StatefulGamepadsState {
      return this.#context.input.gamepads;
    }

    get assets(): SystemAssetAccess {
      return this.#context.assets;
    }

    get commands(): CommandAccess {
      return this.#context.commands;
    }

    get spawn(): SpawnCommands {
      return this.#context.spawn;
    }

    get spatial(): SpatialQueries {
      return this.#context.spatial;
    }

    get cameras(): CameraAccess {
      return this.#context.cameras;
    }

    get diagnostics(): SystemDiagnostics {
      return this.#context.diagnostics;
    }

    get effects(): ScheduledEffects {
      return this.#effects;
    }

    override destroy(): void {
      this.#effects.dispose();
    }
  }

  return ApertureSystemBase as unknown as ApertureSystemConstructor<
    TSchema,
    TQueries
  >;
}

function normalizeSystemPriority(priority: number | undefined): number {
  const normalized = priority ?? 0;

  if (!Number.isFinite(normalized)) {
    throw new ApertureSystemError(
      "aperture.system.invalidPriority",
      "System descriptor priority must be a finite number.",
      "Use createSystem({ priority: 0 }) or omit priority.",
      { priority: normalized },
    );
  }

  return normalized;
}

export function installApertureSystemContext(
  world: EcsWorld,
  context: ApertureSystemContext,
): void {
  world.globals[APERTURE_SYSTEM_CONTEXT_KEY] = context;
}

export function createApertureSystemContext(options: {
  readonly world: EcsWorld;
  readonly assetsRegistry: AssetRegistry;
  readonly config?: ApertureConfig;
  readonly assetLoader?: ApertureAssetLoader;
}): ApertureSystemContext {
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

function getApertureSystemContext(world: EcsWorld): ApertureSystemContext {
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

function createSignalStore(
  descriptors: Readonly<Record<string, ApertureSignalDescriptor>>,
): SignalStore {
  const output: SignalStore = {};

  for (const [key, descriptor] of Object.entries(descriptors)) {
    output[key] = createSignal(descriptor.initial);
  }

  return output;
}

function createInputSignals(config: ApertureConfig | undefined): InputSignals {
  return createInputResource(config) as InputSignals;
}
