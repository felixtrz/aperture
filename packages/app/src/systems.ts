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
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import type { SpatialQueries } from "./spatial-queries.js";
import {
  type StatefulGamepadsState,
  type StatefulKeyboardState,
} from "./input/state.js";
import {
  createScheduledEffects,
  registerSystemEffects,
  type ScheduledEffects,
} from "./systems/effects.js";
import { type SystemDiagnostics } from "./systems/diagnostics.js";
import { ApertureSystemError } from "./systems/errors.js";
import type { CommandAccess } from "./systems/commands.js";
import type { SystemAssetAccess } from "./systems/assets.js";
import type { CameraAccess } from "./systems/cameras.js";
import type { SignalStore } from "./systems/signals.js";
import type { SpawnCommands } from "./systems/spawn/index.js";
import {
  getApertureSystemContext,
  type ApertureSystemContext,
  type InputActions,
  type InputSignals,
} from "./systems/context.js";

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

export type { SignalStore, SignalSummary } from "./systems/signals.js";
export { createSignalSummary } from "./systems/signals.js";

export type {
  ApertureSystemDiagnostic,
  SystemDiagnostics,
} from "./systems/diagnostics.js";
export { assetDiagnosticFromSystemDiagnostic } from "./systems/diagnostics.js";

export type {
  ApertureEffectHandle,
  ApertureEffectOptions,
  ApertureEffectPhase,
  ApertureEffects,
  ApertureQuery,
  ScheduledEffects,
} from "./systems/effects.js";
export { flushApertureSystemEffects } from "./systems/effects.js";
export type {
  CommandAccess,
  CommandAccessSummary,
  CommandAssetRequestSummary,
  CommandChannelEntry,
} from "./systems/commands.js";
export type {
  ApertureAssetLoader,
  SystemAssetAccess,
  SystemAssetHandle,
  SystemAssetKind,
  SystemGltfAssetHandle,
  SystemGltfLoadedScene,
} from "./systems/assets.js";
export {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
  registerApertureAppComponents,
} from "./systems/components.js";
export type { CameraAccess, CameraHandle } from "./systems/cameras.js";
export { material, mesh } from "./systems/spawn/index.js";
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
} from "./systems/spawn/index.js";

export type {
  ApertureGeneratedActionMap,
  ApertureSystemContext,
  CreateApertureSystemContextOptions,
  InputActions,
  InputSignals,
} from "./systems/context.js";
export {
  createApertureSystemContext,
  installApertureSystemContext,
} from "./systems/context.js";

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
} from "./input/state.js";

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
