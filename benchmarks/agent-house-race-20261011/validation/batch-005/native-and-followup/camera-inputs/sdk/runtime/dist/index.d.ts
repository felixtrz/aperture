import { type SimulationFixedStepCallback, type SimulationFixedStepClockState, type SimulationFixedStepFrameReport, type SimulationFixedStepOptions, type SimulationFixedStepTaskOptions } from "./fixed-step-schedule.js";
import { type AnimationClipBinding } from "./animation-driver-system.js";
import { type ParticleEmitterInput, type ParticleSimulationSpace as ParticleSimulationSpaceType } from "@aperture-engine/particles";
export type { SimulationFixedStepClockState } from "./fixed-step-schedule.js";
import { AssetRegistry, EcsType, type AnyEcsComponent, type ComponentInitialData, type EcsWorld, type EnvironmentMapHandle, type Entity, type LocalTransformInput, type MaterialHandle, type MeshHandle, type TransformResolutionReport, type TextureHandle, type Vec4Like, type WorldOptions } from "@aperture-engine/simulation";
import { type CameraInput, type FogInput, type GltfEcsAuthoringCommandPlan, type GltfEcsCommandReplayReport, type InstanceDataValues, type LightCookieInput, type LightInput, type LightShadowSettingsInput, type MaterialSlotsInput, type MorphTargetWeightsInput, type AudioEmitterInput, type AudioListenerInput, type OcclusionQueryInput, type ProceduralSkyInput, type RenderExtractionFeatureOptions, type RenderSnapshot, type RuntimeUniformInput, type SkinInput, type SpriteInput, type SkyboxInput, type UiHitTargetInput, type UiImageInput, type UiNodeInput, type UiPanelInput, type UiScreenInput, type UiScrollInput, type UiTextInput } from "@aperture-engine/render";
import { type ColliderInput, type ExternalForceInput, type ExternalImpulseInput, type KinematicTargetInput, type PhysicsCharacterControllerInput, type PhysicsDebugInput, type PhysicsGravityInput, type PhysicsJointInput, type PhysicsMaterialInput, type PhysicsVelocityInput, type RigidBodyInput } from "@aperture-engine/physics";
export * from "./simulation-worker.js";
export * from "./shared-snapshot-transport.js";
export * from "./animation-blending.js";
export * from "./animation-clip.js";
export * from "./animation-mixer.js";
export * from "./skinning-palette-system.js";
export * from "./animation-driver-system.js";
export * from "./fixed-step-schedule.js";
export * from "@aperture-engine/physics";
export declare const ParticleSimulationSpace: {
    readonly World: "world";
    readonly Local: "local";
};
export type ParticleSimulationSpace = ParticleSimulationSpaceType;
export type { ParticleEmitterInput };
export type { Entity, EcsWorld, AnyEcsComponent, ComponentInitialData, WorldOptions, } from "@aperture-engine/simulation";
export interface SpawnContext {
    readonly app: SimulationApp;
    readonly world: EcsWorld;
    readonly assets: AssetRegistry;
}
export type SpawnEntityInitializer = (entity: Entity, context: SpawnContext) => void;
export interface RuntimeTransformInput extends LocalTransformInput {
    readonly parent?: Entity | null;
}
export interface SpinInput {
    readonly radiansPerSecond?: number;
    readonly axis?: readonly [number, number, number];
}
export declare const Spin: import("elics").Component<{
    radiansPerSecond: {
        type: EcsType.Float32;
        default: number;
    };
    axis: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>;
declare const SpinSystemBase: import("elics").SystemConstructor<import("elics").SystemSchema, {
    spin: {
        required: (import("elics").Component<{
            translation: {
                type: EcsType.Vec3;
                default: [number, number, number];
            };
            rotation: {
                type: EcsType.Vec4;
                default: [number, number, number, number];
            };
            scale: {
                type: EcsType.Vec3;
                default: [number, number, number];
            };
        }> | import("elics").Component<{
            radiansPerSecond: {
                type: EcsType.Float32;
                default: number;
            };
            axis: {
                type: EcsType.Vec3;
                default: [number, number, number];
            };
        }>)[];
    };
}, import("elics").World, import("elics").System<import("elics").SystemSchema, {
    spin: {
        required: (import("elics").Component<{
            translation: {
                type: EcsType.Vec3;
                default: [number, number, number];
            };
            rotation: {
                type: EcsType.Vec4;
                default: [number, number, number, number];
            };
            scale: {
                type: EcsType.Vec3;
                default: [number, number, number];
            };
        }> | import("elics").Component<{
            radiansPerSecond: {
                type: EcsType.Float32;
                default: number;
            };
            axis: {
                type: EcsType.Vec3;
                default: [number, number, number];
            };
        }>)[];
    };
}>>;
export declare class SpinSystem extends SpinSystemBase {
    update(_delta: number, time: number): void;
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
    readonly skeletonMilliseconds: number;
}
export interface SimulationApp {
    readonly world: EcsWorld;
    readonly assets: AssetRegistry;
    spawn(...initializers: SpawnEntityInitializer[]): Entity;
    registerFixedStepTask(task: SimulationFixedStepCallback, options?: SimulationFixedStepTaskOptions): () => void;
    resetFixedStepClock(): void;
    snapshotFixedStepClock(): SimulationFixedStepClockState | null;
    restoreFixedStepClock(state: SimulationFixedStepClockState | null): boolean;
    registerSystem(system: Parameters<EcsWorld["registerSystem"]>[0]): SimulationApp;
    step(delta?: number, time?: number): SimulationStepResult;
}
export interface ExtractionApp extends SimulationApp {
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
export type RenderExtractionFeatureResolver = () => RenderExtractionFeatureOptions | undefined;
export interface CreateExtractionAppOptions extends CreateSimulationAppOptions {
    readonly renderFeatures?: RenderExtractionFeatureOptions | RenderExtractionFeatureResolver;
}
export interface ApplyGltfEcsCommandPlanToAppOptions {
    readonly app: SimulationApp;
    readonly plan: GltfEcsAuthoringCommandPlan;
    readonly registerComponents?: boolean;
}
export declare function createSimulationApp(options?: CreateSimulationAppOptions): SimulationApp;
export declare function createExtractionApp(options?: CreateExtractionAppOptions): ExtractionApp;
export declare function applyGltfEcsCommandPlanToApp(options: ApplyGltfEcsCommandPlanToAppOptions): GltfEcsCommandReplayReport;
export declare function registerRuntimeComponents(world: EcsWorld): EcsWorld;
export declare function withComponent<TComponent extends AnyEcsComponent>(component: TComponent, data?: ComponentInitialData<TComponent>): SpawnEntityInitializer;
export declare function withTransform(input?: RuntimeTransformInput): SpawnEntityInitializer;
export declare function withMesh(handle: MeshHandle): SpawnEntityInitializer;
export declare function withMaterial(handle: MaterialHandle): SpawnEntityInitializer;
export declare function withMaterialSlots(input: MaterialSlotsInput | readonly MaterialHandle[]): SpawnEntityInitializer;
export declare function withSprite(input: Omit<SpriteInput, "texture"> & {
    readonly texture: TextureHandle;
}): SpawnEntityInitializer;
export declare function withParticleEmitter(input: ParticleEmitterInput): SpawnEntityInitializer;
export declare function withAudioEmitter(input: AudioEmitterInput): SpawnEntityInitializer;
export declare function withAudioListener(input?: AudioListenerInput): SpawnEntityInitializer;
export declare function withUiScreen(input?: UiScreenInput): SpawnEntityInitializer;
export declare function withUiNode(input?: UiNodeInput): SpawnEntityInitializer;
export declare function withUiPanel(input?: UiPanelInput): SpawnEntityInitializer;
export declare function withUiImage(input: UiImageInput): SpawnEntityInitializer;
export declare function withUiText(input: UiTextInput): SpawnEntityInitializer;
export declare function withUiHitTarget(input?: UiHitTargetInput): SpawnEntityInitializer;
export declare function withUiScroll(input?: UiScrollInput): SpawnEntityInitializer;
export declare function withSkybox(input: Omit<SkyboxInput, "texture"> & {
    readonly texture: TextureHandle;
}): SpawnEntityInitializer;
export declare function withProceduralSky(input?: ProceduralSkyInput): SpawnEntityInitializer;
export declare function withRuntimeUniform(input: RuntimeUniformInput): SpawnEntityInitializer;
export declare function withFog(input?: FogInput): SpawnEntityInitializer;
export declare function withCamera(input?: CameraInput): SpawnEntityInitializer;
export declare function withLight(input?: LightInput): SpawnEntityInitializer;
export declare function withLightCookie(texture: TextureHandle, input?: Omit<LightCookieInput, "texture">): SpawnEntityInitializer;
export declare function withEnvironmentMap(handle: EnvironmentMapHandle, input?: Omit<LightInput, "kind" | "environmentMap">): SpawnEntityInitializer;
export declare function withLightShadowSettings(input?: LightShadowSettingsInput): SpawnEntityInitializer;
export declare function withShadowCaster(enabled?: boolean): SpawnEntityInitializer;
export declare function withShadowReceiver(enabled?: boolean): SpawnEntityInitializer;
export declare function withVisibility(visible?: boolean): SpawnEntityInitializer;
export declare function withOcclusionQuery(input?: OcclusionQueryInput): SpawnEntityInitializer;
export declare function withRenderLayer(mask?: number): SpawnEntityInitializer;
export declare function withRenderOrder(value?: number): SpawnEntityInitializer;
export declare function withRigidBody(input?: RigidBodyInput): SpawnEntityInitializer;
export declare function withCollider(input?: ColliderInput): SpawnEntityInitializer;
export declare function withPhysicsVelocity(input?: PhysicsVelocityInput): SpawnEntityInitializer;
export declare function withExternalForce(input?: ExternalForceInput): SpawnEntityInitializer;
export declare function withExternalImpulse(input?: ExternalImpulseInput): SpawnEntityInitializer;
export declare function withKinematicTarget(input?: KinematicTargetInput): SpawnEntityInitializer;
export declare function withPhysicsGravity(input?: PhysicsGravityInput): SpawnEntityInitializer;
export declare function withPhysicsCharacterController(input?: PhysicsCharacterControllerInput): SpawnEntityInitializer;
export declare function withPhysicsMaterial(input?: PhysicsMaterialInput): SpawnEntityInitializer;
export declare function withPhysicsJoint(input?: PhysicsJointInput): SpawnEntityInitializer;
export declare function withPhysicsDebug(input?: PhysicsDebugInput): SpawnEntityInitializer;
export declare function withInstanceTint(color: Vec4Like): SpawnEntityInitializer;
export declare function withInstanceData(materialKind: string, values: InstanceDataValues): SpawnEntityInitializer;
export declare function withSkin(input: SkinInput): SpawnEntityInitializer;
export declare function withAnimation(input: {
    readonly clips: Iterable<AnimationClipBinding>;
    readonly targets: ReadonlyMap<string, Entity>;
}): SpawnEntityInitializer;
export declare function withMorphTargetWeights(input: MorphTargetWeightsInput): SpawnEntityInitializer;
export declare function withEnabled(value?: boolean): SpawnEntityInitializer;
export declare function withName(value: string): SpawnEntityInitializer;
export declare function withDebugMetadata(input: {
    readonly tag?: string;
    readonly note?: string;
}): SpawnEntityInitializer;
export declare function withSpin(input?: SpinInput): SpawnEntityInitializer;
//# sourceMappingURL=index.d.ts.map