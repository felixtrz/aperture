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
  Children,
  DebugMetadata,
  EcsType,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  clamp,
  clamp01,
  createSystem as createElicsSystem,
  defineComponent,
  expSmoothingAlpha,
  hexColor,
  inverseLerp,
  lerp,
  lerpAngle,
  quatFromEuler,
  quatFromEulerYXZ,
  quatFromAxisAngle,
  quatLookAt,
  quatMultiply,
  quatNormalize,
  remap,
  remapClamped,
  rotateVec3ByQuat,
  serializeEntityRef,
  vec3Add,
  vec3AddScaled,
  vec3Cross,
  vec3Distance,
  vec3Dot,
  vec3Length,
  vec3LengthSq,
  vec3Normalize,
  vec3ProjectOnPlane,
  vec3Scale,
  vec3Subtract,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import type { SimulationFixedStepContext } from "@aperture-engine/runtime";
import type { SpatialQueries } from "./spatial/index.js";
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
import type { GltfInstanceAccess } from "./systems/gltf.js";
import type { HierarchyAccess } from "./systems/hierarchy.js";
import type { HtmlBridgeAccess } from "./systems/html-bridge.js";
import type { InteractionAccess } from "./interaction/access.js";
import type { MaterialAccess } from "./systems/materials.js";
import type { MeshAccess } from "./systems/meshes.js";
import type { ParticleAccess } from "./systems/particles.js";
import type { AudioAccess } from "./systems/audio.js";
import type { TrailAccess } from "./systems/trails.js";
import type { PhysicsAccess } from "./systems/physics.js";
import type { FixedStepAccess } from "./systems/fixed-step.js";
import type { PrefabAccess } from "./systems/prefabs.js";
import type { ResourceStore } from "./systems/resources.js";
import type { SignalStore } from "./systems/signals.js";
import type { StartOptionsAccess } from "./systems/start-options.js";
import type { SpawnCommands } from "./systems/spawn/index.js";
import {
  getApertureSystemContext,
  type ApertureSystemContext,
  type InputActions,
  type InputSignals,
} from "./systems/context.js";
import type { ApertureRandom } from "./systems/random.js";
import type { ApertureFrameTime } from "./systems/frame-time.js";
export {
  createFollowCameraController,
  writeFollowCameraPose,
} from "./controllers/follow-camera.js";
export type {
  FollowCameraController,
  FollowCameraControllerOptions,
  FollowCameraPose,
  FollowCameraUpdateInput,
} from "./controllers/follow-camera.js";

export { createSpatialQueries } from "./spatial/index.js";
export type {
  SimulationFixedStepContext,
  SimulationFixedStepTaskOptions,
} from "@aperture-engine/runtime";
export type {
  RayInput,
  SpatialClosestPointHit,
  SpatialClosestPointOptions,
  SpatialOverlapHit,
  SpatialOverlapOptions,
  SpatialPickableState,
  SpatialQueries,
  SpatialRaycastHit,
  SpatialRaycastOptions,
  SpatialRaycastableBounds,
  SpatialRaycastableMesh,
} from "./spatial/index.js";

export {
  Children,
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
  clamp,
  clamp01,
  expSmoothingAlpha,
  hexColor,
  inverseLerp,
  lerp,
  lerpAngle,
  quatFromAxisAngle,
  quatFromEuler,
  quatFromEulerYXZ,
  quatLookAt,
  quatMultiply,
  quatNormalize,
  remap,
  remapClamped,
  rotateVec3ByQuat,
  serializeEntityRef,
  vec3Add,
  vec3AddScaled,
  vec3Cross,
  vec3Distance,
  vec3Dot,
  vec3Length,
  vec3LengthSq,
  vec3Normalize,
  vec3ProjectOnPlane,
  vec3Scale,
  vec3Subtract,
};

export type {
  ColorTuple,
  Entity,
  EulerRotationOrder,
  Mat4,
  Mat4Like,
  Quat,
  QuatLike,
  QuatTuple,
  Vec2,
  Vec2Like,
  Vec2Tuple,
  Vec3,
  Vec3Like,
  Vec3Tuple,
  Vec4,
  Vec4Like,
  Vec4Tuple,
} from "@aperture-engine/simulation";

export {
  AudioSimulationSpace,
  ParticleSimulationSpace,
} from "@aperture-engine/render";
export type {
  AudioDistanceModel,
  AudioEmitterInput,
  AudioPanningModel,
  ParticleEmitterInput,
} from "@aperture-engine/render";

export type {
  ApertureGeneratedSignalMap,
  Signal,
  SignalStore,
  SignalSummary,
} from "./systems/signals.js";
export { createSignalSummary } from "./systems/signals.js";
export type {
  ApertureResourceDescriptor,
  ApertureResourceField,
  ApertureResourceFieldSummary,
  ApertureResourceState,
  ApertureResourceStateFromSchema,
  ApertureResourceStoreSummary,
  ApertureResourceSummaryEntry,
  ResourceStore,
} from "./systems/resources.js";
export {
  createResourceStore,
  defineResource,
  resource,
} from "./systems/resources.js";
export type {
  StartOptionsAccess,
  StartOptionsSummary,
} from "./systems/start-options.js";
export {
  createStartOptionsAccess,
  filterSystemStartOptions,
} from "./systems/start-options.js";

export type {
  ApertureDeterminismDiagnosticsMode,
  ApertureDeterminismDiagnosticsOptions,
  ApertureDeterminismRunPhase,
} from "./systems/determinism.js";

export type {
  ApertureSystemDiagnostic,
  SystemDiagnostics,
} from "./systems/diagnostics.js";

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
  ApertureAssetLoadContext,
  ApertureAssetLoader,
  ApertureAssetLoadResult,
  SystemGltfAssetDecoderProvider,
  SystemGltfAssetDecoderProviderOptions,
  SystemAssetAccess,
  SystemAssetHandle,
  SystemAssetKind,
  SystemAudioAssetHandle,
  SystemGltfAnimationClip,
  SystemGltfAssetHandle,
  SystemGltfLoadedScene,
  SystemParticleEffectAssetHandle,
  SystemShaderAssetHandle,
  SystemTextureAssetHandle,
} from "./systems/assets.js";
export { createDefaultSystemGltfAssetDecoderProvider } from "./systems/assets.js";
export { systemAssetReadyMetadata } from "./systems/assets.js";
export {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
  RenderInterpolation,
  registerApertureAppComponents,
} from "./systems/components.js";
export {
  ScreenSpaceFraming,
  ScreenSpaceFramingFit,
  createScreenSpaceFraming,
} from "./systems/screen-space-framing.js";
export type {
  ScreenSpaceFramingFrameReport,
  ScreenSpaceFramingInput,
} from "./systems/screen-space-framing.js";
export type { CameraAccess, CameraHandle } from "./systems/cameras.js";
export type {
  GltfInstanceAccess,
  GltfNodeFilter,
  GltfNodeLookupDiagnostic,
  GltfNodeLookupDiagnosticCode,
  GltfNodeLookupResult,
  GltfNodeRecord,
} from "./systems/gltf.js";
export { createGltfInstanceAccess } from "./systems/gltf.js";
export type {
  HierarchyAccess,
  HierarchyChildrenResult,
  HierarchyDespawnResult,
  HierarchySetParentResult,
} from "./systems/hierarchy.js";
export { createHierarchyAccess } from "./systems/hierarchy.js";
export {
  APERTURE_HTML_BRIDGE_COMMAND_CHANNEL,
  APERTURE_HTML_EVENT_CHANNEL_PREFIX,
  HtmlBridgeStateResource,
  createHtmlBridgeAccess,
  htmlEventChannel,
} from "./systems/html-bridge.js";
export type {
  HtmlBridgeAccess,
  HtmlBridgeCommand,
  HtmlBridgeRect,
  HtmlBridgeViewport,
  HtmlSlotSnapshot,
} from "./systems/html-bridge.js";
export type { PrefabAccess, PrefabRegisterOptions } from "./systems/prefabs.js";
export { createPrefabAccess } from "./systems/prefabs.js";
export type {
  ParticleAccess,
  ParticleEmitOptions,
} from "./systems/particles.js";
export { createParticleAccess } from "./systems/particles.js";
export type {
  AudioAccess,
  AudioAutomationNumber,
  AudioAutomationTarget,
  AudioClipDescriptorInput,
  AudioEmitterControlOptions,
  AudioLoopHandle,
  AudioLoopAutomationOptions,
  AudioLoopOptions,
  AudioLoopUpdateOptions,
  AudioLowpassAutomationOptions,
  AudioLowpassOptions,
  AudioOneShotOptions,
} from "./systems/audio.js";
export { createAudioAccess } from "./systems/audio.js";
export type {
  MaterialAccess,
  MaterialPatch,
  MaterialSetDiagnostic,
  MaterialSetResult,
} from "./systems/materials.js";
export { createMaterialAccess } from "./systems/materials.js";
export type {
  DynamicMesh,
  DynamicMeshOptions,
  MeshAccess,
  MeshPublishOptions,
  MeshPublishResult,
} from "./systems/meshes.js";
export { createMeshAccess } from "./systems/meshes.js";
export type {
  GroundRibbonTrail,
  GroundRibbonTrailOptions,
  GroundRibbonTrailTrackOptions,
  TrailAccess,
} from "./systems/trails.js";
export { createTrailAccess } from "./systems/trails.js";
export type {
  PhysicsApplyForceOptions,
  PhysicsApplyImpulseOptions,
  PhysicsAccess,
  PhysicsAccessSummary,
  PhysicsBackendSummary,
  PhysicsBreakJointOptions,
  PhysicsCharacterMoveInput,
  PhysicsEventAccess,
  PhysicsEventFamilySummary,
  PhysicsReadbackSummary,
  PhysicsStepSummary,
  PhysicsSyncSummary,
  PhysicsWritebackSummary,
  KinematicTargetTransform,
} from "./systems/physics.js";
export { createPhysicsAccess } from "./systems/physics.js";

// Re-export the common physics facade types so app authors can stay on
// `@aperture-engine/app/systems` (the package a scaffolded app depends on) for
// `this.physics.*` arguments and results, without importing the lower-level
// `@aperture-engine/physics` package (see GH #25).
export type {
  ColliderInput,
  PhysicsCharacterCollision,
  PhysicsCharacterControllerInput,
  PhysicsCharacterControllerSettings,
  PhysicsCharacterMoveResult,
  PhysicsEntityRef,
  PhysicsEvent,
  PhysicsOverlapHit,
  PhysicsPointProjection,
  PhysicsQuat,
  PhysicsQueryOptions,
  PhysicsRay,
  PhysicsRaycastHit,
  PhysicsShape,
  PhysicsShapeCast,
  PhysicsShapeCastHit,
  PhysicsTransform,
  PhysicsVec3,
  RigidBodyInput,
} from "@aperture-engine/physics";
export type {
  FixedStepAccess,
  FixedStepTaskRegistrar,
} from "./systems/fixed-step.js";
export { createFixedStepAccess } from "./systems/fixed-step.js";
export type {
  InteractionAccess,
  InteractionCallback,
  InteractionFilter,
  InteractionRuntime,
  InteractionUnsubscribe,
} from "./interaction/access.js";
export type {
  PointerFrameInput,
  PointerInteractionEvent,
  PointerInteractionEventType,
} from "./interaction/pointer-events.js";
// Re-export from the leaf interaction modules rather than the `interaction`
// barrel: the barrel's `export *` cannot be traced by rolldown (Vite's bundler)
// through the `systems -> interaction/access -> systems/components` cycle, which
// broke `vite build` for generated apps (see GH #24).
export { createInteractionAccess } from "./interaction/access.js";
export { PointerInteractionState } from "./interaction/pointer-events.js";
export { runInteractionFrame } from "./interaction/system.js";
export {
  runUiScrollFrame,
  UI_SCROLL_DISABLED_DIAGNOSTIC,
} from "./interaction/ui-scroll.js";
export { material, mesh, physics, shader } from "./systems/spawn/index.js";
export type {
  BoxMeshDescriptorOptions,
  CapsuleMeshDescriptorOptions,
  ConeMeshDescriptorOptions,
  CustomWgslMaterialDescriptor,
  CustomWgslSamplerBindingOptions,
  CustomWgslShaderDescriptor,
  CustomWgslTextureBindingOptions,
  CustomWgslUniformBindingOptions,
  CylinderMeshDescriptorOptions,
  LineListMeshDescriptorOptions,
  MaterialDescriptor,
  PlaneMeshDescriptorOptions,
  PrimitiveMeshDescriptor,
  PhysicsComponentDescriptor,
  PhysicsSpawnDescriptor,
  ParticleEffectDescriptorInput,
  SphereMeshDescriptorOptions,
  SpawnCameraOptions,
  SpawnCommands,
  SpawnFogOptions,
  SpawnGltfBatchInstance,
  SpawnGltfBatchOptions,
  SpawnGltfMaterialOverrides,
  SpawnGltfOptions,
  SpawnLightOptions,
  SpawnMeshOptions,
  SpawnMetadata,
  SpawnParticlesOptions,
  SpawnPhysicsOptions,
  SpawnPrefabOptions,
  SpawnSkyboxOptions,
  StandardMaterialDescriptor,
  StandardMaterialOptions,
  SystemTransformInput,
  SkyboxSamplerDescriptorInput,
  SkyboxTextureDescriptorInput,
  UnlitMaterialDescriptor,
  UnlitMaterialOptions,
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
export {
  createApertureRandom,
  restoreApertureRandom,
  snapshotApertureRandom,
  type ApertureRandom,
  type ApertureRandomState,
} from "./systems/random.js";
export {
  advanceApertureFrameTime,
  createApertureFrameTime,
  restoreApertureFrameTime,
  resetApertureFrameTime,
  snapshotApertureFrameTime,
  type ApertureFrameTime,
  type ApertureFrameTimeState,
} from "./systems/frame-time.js";
export type {
  SpatialIndexPopulationContext,
  SpatialIndexPopulationDiagnostic,
  SpatialIndexPopulationReport,
  SpatialIndexPopulationState,
} from "./systems/spatial-index-population.js";
export {
  createSpatialIndexPopulationState,
  populateSpatialIndexFromWorld,
} from "./systems/spatial-index-population.js";

export type {
  ApertureGeneratedGamepadInputEvent,
  ApertureGeneratedGamepadSnapshot,
  ApertureGeneratedInputEvent,
  ApertureGeneratedInputResetEvent,
  ApertureGeneratedKeyboardInputEvent,
  ApertureGeneratedPointerInputEvent,
  ApertureGeneratedPointerName,
  ApertureGeneratedVirtualActionInputEvent,
  ApertureGeneratedWheelInputEvent,
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
  readonly random: ApertureRandom;
  readonly time: ApertureFrameTime;
  readonly signals: SignalStore;
  readonly resources: ResourceStore;
  readonly startOptions: StartOptionsAccess;
  readonly input: InputSignals;
  readonly actions: InputActions;
  readonly keyboard: StatefulKeyboardState;
  readonly gamepads: StatefulGamepadsState;
  readonly assetsRegistry: AssetRegistry;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly gltf: GltfInstanceAccess;
  readonly hierarchy: HierarchyAccess;
  readonly prefabs: PrefabAccess;
  readonly particles: ParticleAccess;
  readonly audio: AudioAccess;
  readonly materials: MaterialAccess;
  readonly meshes: MeshAccess;
  readonly trails: TrailAccess;
  readonly physics: PhysicsAccess;
  readonly fixedStep: FixedStepAccess;
  readonly interaction: InteractionAccess;
  readonly html: HtmlBridgeAccess;
  readonly diagnostics: SystemDiagnostics;
  readonly effects: ScheduledEffects;
  readonly determinism: ApertureSystemContext["determinism"];
  createEntity(): Entity;
  init(): void;
  update(delta: number, time: number): void;
  fixedUpdate?(context: SimulationFixedStepContext): void;
  snapshotState?(context: ApertureSystemSnapshotContext): unknown;
  restoreState?(
    payload: unknown,
    context: ApertureSystemRestoreContext,
    remapEntityRef: (oldEntityRef: Entity | string) => Entity | undefined,
  ): void;
  afterRestore?(context: ApertureSystemRestoreContext): void;
  destroy(): void;
}

export interface ApertureSystemSnapshotContext {
  readonly world: EcsWorld;
  readonly context: ApertureSystemContext;
}

export interface ApertureSystemRestoreContext {
  readonly world: EcsWorld;
  readonly context: ApertureSystemContext;
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
    readonly #disposeFixedStep: (() => void) | null;

    constructor(...args: ConstructorParameters<typeof Base>) {
      super(...args);
      this.#context = getApertureSystemContext(this.world as EcsWorld);
      const systemName = this.#deterministicSystemName();
      this.#effects = createScheduledEffects({
        runCallback: ({ phase, callback }) =>
          this.#context.determinism.run(
            { system: systemName, phase: `effect:${phase}` },
            callback,
          ),
      });
      this.#wrapDeterministicLifecycle(systemName);
      registerSystemEffects(this, this.#effects);
      this.#disposeFixedStep = this.#registerFixedUpdate(args[2]);
    }

    get signals(): SignalStore {
      return this.#context.signals;
    }

    get random(): ApertureRandom {
      return this.#context.random;
    }

    get time(): ApertureFrameTime {
      return this.#context.time;
    }

    get resources(): ResourceStore {
      return this.#context.resources;
    }

    get startOptions(): StartOptionsAccess {
      return this.#context.startOptions;
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

    get assetsRegistry(): AssetRegistry {
      return this.#context.assetsRegistry;
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

    get gltf(): GltfInstanceAccess {
      return this.#context.gltf;
    }

    get hierarchy(): HierarchyAccess {
      return this.#context.hierarchy;
    }

    get prefabs(): PrefabAccess {
      return this.#context.prefabs;
    }

    get particles(): ParticleAccess {
      return this.#context.particles;
    }

    get audio(): AudioAccess {
      return this.#context.audio;
    }

    get materials(): MaterialAccess {
      return this.#context.materials;
    }

    get meshes(): MeshAccess {
      return this.#context.meshes;
    }

    get trails(): TrailAccess {
      return this.#context.trails;
    }

    get physics(): PhysicsAccess {
      return this.#context.physics;
    }

    get fixedStep(): FixedStepAccess {
      return this.#context.fixedStep;
    }

    get interaction(): InteractionAccess {
      return this.#context.interaction;
    }

    get html(): HtmlBridgeAccess {
      return this.#context.html;
    }

    get diagnostics(): SystemDiagnostics {
      return this.#context.diagnostics;
    }

    get effects(): ScheduledEffects {
      return this.#effects;
    }

    get determinism(): ApertureSystemContext["determinism"] {
      return this.#context.determinism;
    }

    override destroy(): void {
      this.#disposeFixedStep?.();
      this.#effects.dispose();
    }

    #deterministicSystemName(): string {
      return (
        (this.constructor as { readonly name?: string }).name ||
        "AnonymousApertureSystem"
      );
    }

    #wrapDeterministicLifecycle(systemName: string): void {
      this.#wrapDeterministicMethod("init", systemName);
      this.#wrapDeterministicMethod("update", systemName);
      this.#wrapDeterministicMethod("fixedUpdate", systemName);
    }

    #wrapDeterministicMethod(
      phase: "init" | "update" | "fixedUpdate",
      systemName: string,
    ): void {
      const original = (this as unknown as Record<string, unknown>)[phase];

      if (typeof original !== "function") {
        return;
      }

      Object.defineProperty(this, phase, {
        configurable: true,
        value: (...methodArgs: unknown[]) =>
          this.#context.determinism.run({ system: systemName, phase }, () =>
            runSystemLifecyclePhase(systemName, phase, () =>
              original.apply(this, methodArgs),
            ),
          ),
      });
    }

    #registerFixedUpdate(priorityArg: number | undefined): (() => void) | null {
      const fixedUpdate = (this as ApertureSystemInstance).fixedUpdate;

      if (
        typeof fixedUpdate !== "function" ||
        !this.#context.fixedStep.available
      ) {
        return null;
      }

      const taskPriority = Number.isFinite(priorityArg)
        ? (priorityArg as number)
        : priority;

      return this.#context.fixedStep.register(
        (context) => fixedUpdate.call(this, context),
        { priority: taskPriority },
      );
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

/**
 * Run one system lifecycle phase, attributing any thrown error to the system
 * and phase. Without this an exception in init()/update()/fixedUpdate() surfaces
 * as a bare, unattributed message (e.g. `aperture.cli.failed: <message>`), so a
 * consumer cannot tell which system failed (finding F9). Handles both
 * synchronous throws and rejected promises (async lifecycles).
 */
function runSystemLifecyclePhase(
  systemName: string,
  phase: "init" | "update" | "fixedUpdate",
  call: () => unknown,
): unknown {
  try {
    const result = call();

    if (
      result !== null &&
      typeof result === "object" &&
      typeof (result as PromiseLike<unknown>).then === "function"
    ) {
      return (result as Promise<unknown>).then(
        (value) => value,
        (error: unknown) => {
          throw attributeSystemLifecycleError(systemName, phase, error);
        },
      );
    }

    return result;
  } catch (error: unknown) {
    throw attributeSystemLifecycleError(systemName, phase, error);
  }
}

function attributeSystemLifecycleError(
  systemName: string,
  phase: "init" | "update" | "fixedUpdate",
  error: unknown,
): unknown {
  // Preserve errors that already carry structured Aperture attribution.
  if (error instanceof ApertureSystemError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const wrapped = new ApertureSystemError(
    "aperture.system.lifecycleFailed",
    `System '${systemName}' threw during ${phase}(): ${message}`,
    `Fix the exception raised in ${systemName}.${phase}(); the original stack is preserved below.`,
    { system: systemName, phase },
  );

  if (error instanceof Error && typeof error.stack === "string") {
    wrapped.stack = `${wrapped.stack ?? wrapped.message}\nCaused by: ${error.stack}`;
  }

  return wrapped;
}
