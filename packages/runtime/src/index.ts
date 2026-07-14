import { updateSkeletonPalettes } from "./skinning-palette-system.js";
import {
  createSimulationFixedStepRunner,
  type SimulationFixedStepCallback,
  type SimulationFixedStepClockState,
  type SimulationFixedStepFrameReport,
  type SimulationFixedStepOptions,
  type SimulationFixedStepTaskOptions,
} from "./fixed-step-schedule.js";
import {
  Animation,
  createAnimationDriverState,
  updateAnimationDrivers,
  type AnimationClipBinding,
} from "./animation-driver-system.js";
import {
  Ik,
  createIkSolverState,
  updateIkConstraints,
  type IkConstraintInput,
} from "./ik-system.js";
import {
  ParticleSimulationSpace as ParticleSimulationSpaceValue,
  type ParticleEmitterInput,
  type ParticleSimulationSpace as ParticleSimulationSpaceType,
} from "@aperture-engine/particles";

export type { SimulationFixedStepClockState } from "./fixed-step-schedule.js";
import {
  AssetRegistry,
  DebugMetadata,
  Enabled,
  EcsType,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  assetHandleKey,
  createParent,
  createRootTransform,
  createSystem,
  createWorld,
  defineComponent,
  quatFromAxisAngle,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
  type AnyEcsComponent,
  type ComponentInitialData,
  type EcsWorld,
  type EnvironmentMapHandle,
  type Entity,
  type LocalTransformInput,
  type MaterialHandle,
  type MeshHandle,
  type TransformResolutionReport,
  type TextureHandle,
  type Vec4Like,
  type WorldOptions,
} from "@aperture-engine/simulation";
import {
  Camera,
  CameraClipPlanes,
  Fog,
  InstanceData,
  InstanceTint,
  Light,
  LightCookie,
  LightKind,
  LightShadowSettings,
  AudioEmitter,
  AudioListener,
  Material,
  MaterialSlots,
  Mesh,
  MorphTargetWeights,
  OcclusionQuery,
  Decal,
  Line,
  Lod,
  ParticleEmitter,
  Points,
  ProceduralSky,
  RenderLayer,
  RenderOrder,
  RuntimeUniform,
  ShadowCaster,
  ShadowReceiver,
  Skin,
  Sprite,
  Skybox,
  UiHitTarget,
  UiImage,
  UiNode,
  UiPanel,
  UiScreen,
  UiScroll,
  UiText,
  Visibility,
  createCamera,
  createCameraClipPlanes,
  createDecal,
  createFog,
  createInstanceData,
  createInstanceTint,
  createLight,
  createLightCookie,
  createLightShadowSettings,
  createLine,
  createLod,
  createMaterialSlots,
  createMorphTargetWeights,
  createOcclusionQuery,
  createAudioEmitter,
  createAudioListener,
  createParticleEmitter,
  createPoints,
  createProceduralSky,
  createRuntimeUniform,
  createSkin,
  createSprite,
  createSkybox,
  createUiHitTarget,
  createUiImage,
  createUiNode,
  createUiPanel,
  createConfiguredDebugDrawAccumulator,
  createRenderExtractionCache,
  createUiScreen,
  createUiScroll,
  createUiText,
  extractRenderSnapshot,
  installDebugDrawAccumulator,
  type DebugDrawAccumulator,
  replayGltfEcsAuthoringCommands,
  registerRenderAuthoringComponents,
  type CameraInput,
  type DecalInput,
  type FogInput,
  type GltfEcsAuthoringCommandPlan,
  type GltfEcsCommandReplayReport,
  type InstanceDataValues,
  type LightCookieInput,
  type LightInput,
  type LightShadowSettingsInput,
  type LineInput,
  type LodInput,
  type MaterialSlotsInput,
  type MorphTargetWeightsInput,
  type AudioEmitterInput,
  type AudioListenerInput,
  type OcclusionQueryInput,
  type PointsInput,
  type ProceduralSkyInput,
  type RenderExtractionFeatureOptions,
  type RenderSnapshot,
  type RuntimeUniformInput,
  type SkinInput,
  type SpriteInput,
  type SkyboxInput,
  type UiHitTargetInput,
  type UiImageInput,
  type UiNodeInput,
  type UiPanelInput,
  type UiScreenInput,
  type UiScrollInput,
  type UiTextInput,
} from "@aperture-engine/render";
import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsCharacterController,
  PhysicsDebug,
  PhysicsGravity,
  PhysicsJoint,
  PhysicsMaterial,
  PhysicsVelocity,
  RigidBody,
  createCollider,
  createExternalForce,
  createExternalImpulse,
  createKinematicTarget,
  createPhysicsCharacterController,
  createPhysicsDebug,
  createPhysicsGravity,
  createPhysicsJoint,
  createPhysicsMaterial,
  createPhysicsVelocity,
  createRigidBody,
  registerPhysicsComponents,
  type ColliderInput,
  type ExternalForceInput,
  type ExternalImpulseInput,
  type KinematicTargetInput,
  type PhysicsCharacterControllerInput,
  type PhysicsDebugInput,
  type PhysicsGravityInput,
  type PhysicsJointInput,
  type PhysicsMaterialInput,
  type PhysicsVelocityInput,
  type RigidBodyInput,
} from "@aperture-engine/physics";

export * from "./simulation-worker.js";
export * from "./shared-snapshot-transport.js";
export * from "./animation-blending.js";
export * from "./animation-clip.js";
export * from "./animation-mixer.js";
export * from "./skinning-palette-system.js";
export * from "./animation-driver-system.js";
export * from "./ik-system.js";
export * from "./fixed-step-schedule.js";
export * from "@aperture-engine/physics";

export const ParticleSimulationSpace = ParticleSimulationSpaceValue;

export type ParticleSimulationSpace = ParticleSimulationSpaceType;

export type { ParticleEmitterInput };

// Re-export the most fundamental ECS types from the umbrella so a consumer can
// NAME them (they appear throughout the public spawn/component API above but
// were previously only importable from @aperture-engine/simulation directly).
export type {
  Entity,
  EcsWorld,
  AnyEcsComponent,
  ComponentInitialData,
  WorldOptions,
} from "@aperture-engine/simulation";

export interface SpawnContext {
  readonly app: SimulationApp;
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
}

export type SpawnEntityInitializer = (
  entity: Entity,
  context: SpawnContext,
) => void;

export interface RuntimeTransformInput extends LocalTransformInput {
  readonly parent?: Entity | null;
}

export interface SpinInput {
  readonly radiansPerSecond?: number;
  readonly axis?: readonly [number, number, number];
}

export const Spin = defineComponent(
  "aperture.runtime.spin",
  {
    radiansPerSecond: { type: EcsType.Float32, default: 1 },
    axis: { type: EcsType.Vec3, default: [0, 1, 0] },
  },
  "Simple runtime spin component for proof-point examples and tests.",
);

const SpinSystemBase = createSystem({
  spin: {
    required: [Spin, LocalTransform],
  },
});

export class SpinSystem extends SpinSystemBase {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.spin.entities) {
      const speed = entity.getValue(Spin, "radiansPerSecond") ?? 1;
      const axis = entity.getVectorView(Spin, "axis");
      const rotation = quatFromAxisAngle(
        [read(axis, 0), read(axis, 1), read(axis, 2)],
        time * speed,
      );

      entity.getVectorView(LocalTransform, "rotation").set(rotation);
    }
  }
}

export interface SimulationStepResult {
  readonly transform: TransformResolutionReport;
  readonly fixedStep: SimulationFixedStepFrameReport;
  readonly timing: SimulationStepTimingReport;
}

export interface SimulationStepTimingReport {
  readonly totalMilliseconds: number;
  readonly worldUpdateMilliseconds: number;
  readonly animationMilliseconds: number;
  readonly fixedStepMilliseconds: number;
  readonly transformMilliseconds: number;
  readonly ikMilliseconds: number;
  readonly skeletonMilliseconds: number;
}

export interface SimulationApp {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  spawn(...initializers: SpawnEntityInitializer[]): Entity;
  registerFixedStepTask(
    task: SimulationFixedStepCallback,
    options?: SimulationFixedStepTaskOptions,
  ): () => void;
  resetFixedStepClock(): void;
  snapshotFixedStepClock(): SimulationFixedStepClockState | null;
  restoreFixedStepClock(state: SimulationFixedStepClockState | null): boolean;
  registerSystem(
    system: Parameters<EcsWorld["registerSystem"]>[0],
  ): SimulationApp;
  step(delta?: number, time?: number): SimulationStepResult;
}

export interface ExtractionApp extends SimulationApp {
  /**
   * Immediate-mode debug-draw accumulator (E3). Systems (or the frame loop)
   * call `app.debugDraw.aabb(...)` etc. every frame; the accumulated primitives
   * drain into a transient overlay family on the next `extract`/`stepAndExtract`
   * and the accumulator clears. A no-op shared instance when debug draw is
   * disabled, so calls stay byte-identical to a debug-free frame.
   */
  readonly debugDraw: DebugDrawAccumulator;
  extract(frame?: number): RenderSnapshot;
  stepAndExtract(delta?: number, time?: number, frame?: number): RenderSnapshot;
  /**
   * Re-seed the time stamped into extracted snapshots. Extraction time
   * normally follows step(); a state restore replaces simulation time without
   * stepping, so the restorer must prime it or the first post-restore
   * extract reports time 0.
   */
  primeExtractionTime(time: number): void;
}

export interface CreateSimulationAppOptions {
  readonly world?: EcsWorld;
  readonly assets?: AssetRegistry;
  readonly worldOptions?: Partial<WorldOptions>;
  readonly fixedStep?: SimulationFixedStepOptions | false;
}

export type RenderExtractionFeatureResolver = () =>
  | RenderExtractionFeatureOptions
  | undefined;

export interface CreateExtractionAppOptions extends CreateSimulationAppOptions {
  readonly renderFeatures?:
    | RenderExtractionFeatureOptions
    | RenderExtractionFeatureResolver;
  /**
   * Enable the immediate-mode debug-draw overlay (E3). Defaults to `true`. Pass
   * `false` (production builds) to bind the shared no-op accumulator so
   * `app.debugDraw.*` accumulates nothing and every frame is byte-identical to
   * one without debug draw.
   */
  readonly debugDraw?: boolean;
}

export interface ApplyGltfEcsCommandPlanToAppOptions {
  readonly app: SimulationApp;
  readonly plan: GltfEcsAuthoringCommandPlan;
  readonly registerComponents?: boolean;
}

export function createSimulationApp(
  options: CreateSimulationAppOptions = {},
): SimulationApp {
  const world = options.world ?? createWorld(options.worldOptions);
  const assets = options.assets ?? new AssetRegistry();

  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRuntimeComponents(world);
  const fixedStep = createSimulationFixedStepRunner(options.fixedStep, {
    world,
    assets,
  });

  const app: SimulationApp = {
    world,
    assets,
    spawn(...initializers) {
      const entity = world.createEntity();
      const context: SpawnContext = { app, world, assets };

      for (const initializer of initializers) {
        initializer(entity, context);
      }

      return entity;
    },
    registerSystem(system) {
      world.registerSystem(system);
      return this;
    },
    registerFixedStepTask(task, taskOptions) {
      return fixedStep.registerTask(task, taskOptions);
    },
    resetFixedStepClock() {
      fixedStep.reset();
    },
    snapshotFixedStepClock() {
      return fixedStep.snapshot();
    },
    restoreFixedStepClock(state) {
      return fixedStep.restore(state);
    },
    step(delta = 0, time = 0) {
      const timingStartedAt = nowMilliseconds();
      let timingCursor = timingStartedAt;
      const markTiming = (): number => {
        const now = nowMilliseconds();
        const elapsed = Math.max(0, now - timingCursor);

        timingCursor = now;
        return elapsed;
      };

      world.update(delta, time);
      const worldUpdateMilliseconds = markTiming();
      // Advance animation drivers (write joint/node LocalTransforms from the
      // mixer) AFTER user systems and BEFORE world-transform resolution (M2-T8).
      updateAnimationDrivers(world, delta);
      const animationMilliseconds = markTiming();
      // Fixed-step work runs after frame-rate ECS updates and animation writes,
      // then before transform resolution so physics writeback can affect the
      // extracted render snapshot in the same frame.
      const fixedStepResult = fixedStep.step(delta, time);
      const fixedStepMilliseconds = markTiming();
      let transform = resolveWorldTransforms(world);
      const transformMilliseconds = markTiming();
      // F2: IK adjusts the animated base pose. It runs AFTER the animation
      // driver + transform resolution (it needs the joints' resolved WORLD
      // positions and the world-space target) and BEFORE the skinning palette,
      // writing corrected joint LOCAL rotations. When any constraint solves we
      // re-resolve so the corrected pose propagates into the world transforms
      // the palette + extraction read; a frame with no active constraint writes
      // nothing and skips the second resolve, staying byte-identical to pre-F2.
      const ikResult = updateIkConstraints(world);
      if (ikResult.solved > 0) {
        transform = resolveWorldTransforms(world);
      }
      const ikMilliseconds = markTiming();
      // Compute skin joint palettes from same-frame resolved world transforms,
      // after resolution and before any extraction (M2-T6).
      updateSkeletonPalettes(world);
      const skeletonMilliseconds = markTiming();
      return {
        transform,
        fixedStep: fixedStepResult,
        timing: {
          totalMilliseconds: Math.max(0, nowMilliseconds() - timingStartedAt),
          worldUpdateMilliseconds,
          animationMilliseconds,
          fixedStepMilliseconds,
          transformMilliseconds,
          ikMilliseconds,
          skeletonMilliseconds,
        },
      };
    },
  };

  return app;
}

function nowMilliseconds(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function createExtractionApp(
  options: CreateExtractionAppOptions = {},
): ExtractionApp {
  const app = createSimulationApp(options);

  registerRenderAuthoringComponents(app.world);

  // AI-13: one persistent extraction cache per app instance, threaded into
  // every extraction so unchanged entities are served from cached packets.
  // Output stays byte-identical to a cold extraction (writeback tracks entity
  // versions); the cache stores derived packet data only, never live ECS refs.
  const cache = createRenderExtractionCache();
  const resolveRenderFeatures = createRenderExtractionFeatureResolver(
    options.renderFeatures,
  );
  // E3: install the immediate-mode debug-draw accumulator on world globals so
  // `app.debugDraw` and the render extraction share exactly one per-frame
  // buffer. Extraction drains + clears it every frame.
  const debugDraw = installDebugDrawAccumulator(
    app.world,
    createConfiguredDebugDrawAccumulator(options.debugDraw !== false),
  );
  let currentTime = 0;

  return {
    ...app,
    debugDraw,
    step(delta = 0, time = 0) {
      currentTime = time;
      return app.step(delta, time);
    },
    extract(frame = 0) {
      const renderFeatures = resolveRenderFeatures();
      return extractRenderSnapshot(app.world, app.assets, {
        frame,
        time: currentTime,
        cache,
        ...(renderFeatures === undefined ? {} : { features: renderFeatures }),
      });
    },
    primeExtractionTime(time) {
      currentTime = time;
    },
    stepAndExtract(delta = 0, time = 0, frame = 0) {
      currentTime = time;
      app.step(delta, time);
      const renderFeatures = resolveRenderFeatures();
      return extractRenderSnapshot(app.world, app.assets, {
        frame,
        time,
        cache,
        ...(renderFeatures === undefined ? {} : { features: renderFeatures }),
      });
    },
  };
}

function createRenderExtractionFeatureResolver(
  renderFeatures: CreateExtractionAppOptions["renderFeatures"],
): RenderExtractionFeatureResolver {
  if (typeof renderFeatures === "function") {
    return renderFeatures;
  }

  return () => renderFeatures;
}

export function applyGltfEcsCommandPlanToApp(
  options: ApplyGltfEcsCommandPlanToAppOptions,
): GltfEcsCommandReplayReport {
  return replayGltfEcsAuthoringCommands({
    world: options.app.world,
    plan: options.plan,
    ...(options.registerComponents === undefined
      ? {}
      : { registerComponents: options.registerComponents }),
  });
}

export function registerRuntimeComponents(world: EcsWorld): EcsWorld {
  world.registerComponent(Spin);
  world.registerComponent(Animation);
  // Registered last so no existing component's type index shifts (F2 IK).
  world.registerComponent(Ik);
  return world;
}

export function withComponent<TComponent extends AnyEcsComponent>(
  component: TComponent,
  data?: ComponentInitialData<TComponent>,
): SpawnEntityInitializer {
  return (entity) => {
    if (data === undefined) {
      entity.addComponent(component);
    } else {
      entity.addComponent(component, data);
    }
  };
}

export function withTransform(
  input: RuntimeTransformInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerTransformComponents(context.world);
    const root = createRootTransform(input);

    entity.addComponent(LocalTransform, root.local);
    entity.addComponent(Parent, createParent(input.parent ?? null));
    entity.addComponent(WorldTransform, root.world);
  };
}

export function withMesh(handle: MeshHandle): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Mesh, { meshId: assetHandleKey(handle) });
  };
}

export function withMaterial(handle: MaterialHandle): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Material, { materialId: assetHandleKey(handle) });
  };
}

export function withMaterialSlots(
  input: MaterialSlotsInput | readonly MaterialHandle[],
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(
      MaterialSlots,
      createMaterialSlots(materialSlotsInput(input)),
    );
  };
}

export function withSprite(
  input: Omit<SpriteInput, "texture"> & { readonly texture: TextureHandle },
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Sprite, createSprite(input));
  };
}

export function withDecal(
  input: Omit<DecalInput, "texture"> & { readonly texture: TextureHandle },
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Decal, createDecal(input));
  };
}

export function withLine(input: LineInput): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Line, createLine(input));
  };
}

export function withPoints(input: PointsInput): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Points, createPoints(input));
  };
}

/**
 * Attach a `Lod` component (E2, three.js `THREE.LOD` analog) so this entity's
 * drawn mesh is selected each frame by camera distance. Pair with `withMesh`
 * (the base/fallback mesh) + `withMaterial`; extraction overrides the drawn mesh
 * with the selected level's handle. Levels must be ordered by strictly ascending
 * distance; `hysteresis` (world units) keeps the selection sticky near a
 * boundary so small camera nudges never pop between levels.
 */
export function withLod(input: LodInput): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Lod, createLod(input));
  };
}

export function withParticleEmitter(
  input: ParticleEmitterInput,
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(ParticleEmitter, createParticleEmitter(input));
  };
}

export function withAudioEmitter(
  input: AudioEmitterInput,
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(AudioEmitter, createAudioEmitter(input));
  };
}

export function withAudioListener(
  input: AudioListenerInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(AudioListener, createAudioListener(input));
  };
}

export function withUiScreen(
  input: UiScreenInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(UiScreen, createUiScreen(input));
  };
}

export function withUiNode(input: UiNodeInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(UiNode, createUiNode(input));
  };
}

export function withUiPanel(input: UiPanelInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(UiPanel, createUiPanel(input));
  };
}

export function withUiImage(input: UiImageInput): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(UiImage, createUiImage(input));
  };
}

export function withUiText(input: UiTextInput): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(UiText, createUiText(input));
  };
}

export function withUiHitTarget(
  input: UiHitTargetInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(UiHitTarget, createUiHitTarget(input));
  };
}

export function withUiScroll(
  input: UiScrollInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(UiScroll, createUiScroll(input));
  };
}

function materialSlotsInput(
  input: MaterialSlotsInput | readonly MaterialHandle[],
): MaterialSlotsInput {
  if ("slots" in input) {
    return input;
  }

  return {
    slots: input.map((material, slot) => ({ slot, material })),
  };
}

export function withSkybox(
  input: Omit<SkyboxInput, "texture"> & { readonly texture: TextureHandle },
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Skybox, createSkybox(input));
  };
}

export function withProceduralSky(
  input: ProceduralSkyInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(ProceduralSky, createProceduralSky(input));
  };
}

export function withRuntimeUniform(
  input: RuntimeUniformInput,
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(RuntimeUniform, createRuntimeUniform(input));
  };
}

export function withFog(input: FogInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Fog, createFog(input));
  };
}

export function withCamera(input: CameraInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Camera, createCamera(input));
    if (input.clipPlanes !== undefined) {
      entity.addComponent(
        CameraClipPlanes,
        createCameraClipPlanes({ planes: input.clipPlanes }),
      );
    }
  };
}

export function withLight(input: LightInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Light, createLight(input));
  };
}

export function withLightCookie(
  texture: TextureHandle,
  input: Omit<LightCookieInput, "texture"> = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(
      LightCookie,
      createLightCookie({
        ...input,
        texture,
      }),
    );
  };
}

export function withEnvironmentMap(
  handle: EnvironmentMapHandle,
  input: Omit<LightInput, "kind" | "environmentMap"> = {},
): SpawnEntityInitializer {
  return withLight({
    ...input,
    kind: LightKind.Environment,
    environmentMap: handle,
  });
}

export function withLightShadowSettings(
  input: LightShadowSettingsInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(LightShadowSettings, createLightShadowSettings(input));
  };
}

export function withShadowCaster(enabled = true): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(ShadowCaster, { enabled });
  };
}

export function withShadowReceiver(enabled = true): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(ShadowReceiver, { enabled });
  };
}

export function withVisibility(visible = true): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Visibility, { visible });
  };
}

export function withOcclusionQuery(
  input: OcclusionQueryInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(OcclusionQuery, createOcclusionQuery(input));
  };
}

export function withRenderLayer(mask = 1): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(RenderLayer, { mask });
  };
}

export function withRenderOrder(value = 0): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(RenderOrder, { value });
  };
}

export function withRigidBody(
  input: RigidBodyInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(RigidBody, createRigidBody(input));
  };
}

export function withCollider(
  input: ColliderInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(Collider, createCollider(input));
  };
}

export function withPhysicsVelocity(
  input: PhysicsVelocityInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(PhysicsVelocity, createPhysicsVelocity(input));
  };
}

export function withExternalForce(
  input: ExternalForceInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(ExternalForce, createExternalForce(input));
  };
}

export function withExternalImpulse(
  input: ExternalImpulseInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(ExternalImpulse, createExternalImpulse(input));
  };
}

export function withKinematicTarget(
  input: KinematicTargetInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(KinematicTarget, createKinematicTarget(input));
  };
}

export function withPhysicsGravity(
  input: PhysicsGravityInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(PhysicsGravity, createPhysicsGravity(input));
  };
}

export function withPhysicsCharacterController(
  input: PhysicsCharacterControllerInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(
      PhysicsCharacterController,
      createPhysicsCharacterController(input),
    );
  };
}

export function withPhysicsMaterial(
  input: PhysicsMaterialInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(PhysicsMaterial, createPhysicsMaterial(input));
  };
}

export function withPhysicsJoint(
  input: PhysicsJointInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(PhysicsJoint, createPhysicsJoint(input));
  };
}

export function withPhysicsDebug(
  input: PhysicsDebugInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerPhysicsComponents(context.world);
    entity.addComponent(PhysicsDebug, createPhysicsDebug(input));
  };
}

export function withInstanceTint(color: Vec4Like): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(InstanceTint, createInstanceTint({ color }));
  };
}

export function withInstanceData(
  materialKind: string,
  values: InstanceDataValues,
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(
      InstanceData,
      createInstanceData({ materialKind, values }),
    );
  };
}

export function withSkin(input: SkinInput): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Skin, createSkin(input));
  };
}

export function withAnimation(input: {
  readonly clips: Iterable<AnimationClipBinding>;
  readonly targets: ReadonlyMap<string, Entity>;
}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRuntimeComponents(context.world);
    entity.addComponent(Animation, {
      state: createAnimationDriverState(input),
    });
  };
}

export function withIk(input: {
  readonly constraints: Iterable<IkConstraintInput>;
}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRuntimeComponents(context.world);
    entity.addComponent(Ik, {
      state: createIkSolverState(input),
    });
  };
}

export function withMorphTargetWeights(
  input: MorphTargetWeightsInput,
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(MorphTargetWeights, createMorphTargetWeights(input));
  };
}

export function withEnabled(value = true): SpawnEntityInitializer {
  return (entity, context) => {
    registerMetadataComponents(context.world);
    entity.addComponent(Enabled, { value });
  };
}

export function withName(value: string): SpawnEntityInitializer {
  return (entity, context) => {
    registerMetadataComponents(context.world);
    entity.addComponent(Name, { value });
  };
}

export function withDebugMetadata(input: {
  readonly tag?: string;
  readonly note?: string;
}): SpawnEntityInitializer {
  return (entity, context) => {
    registerMetadataComponents(context.world);
    entity.addComponent(DebugMetadata, {
      tag: input.tag ?? "",
      note: input.note ?? "",
    });
  };
}

export function withSpin(input: SpinInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRuntimeComponents(context.world);
    entity.addComponent(Spin, {
      radiansPerSecond: input.radiansPerSecond ?? 1,
      axis:
        input.axis === undefined
          ? [0, 1, 0]
          : [input.axis[0], input.axis[1], input.axis[2]],
    });
  };
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Missing value at index ${index}.`);
  }

  return value;
}
