import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import type { ApertureConfig } from "../config.js";
import { type InputAction, type InputResourceBase } from "../input/state.js";
import { type SpatialQueries } from "../spatial/index.js";
import { type SystemDiagnostics } from "./diagnostics.js";
import { type ScheduledEffects } from "./effects.js";
import { type CommandAccess } from "./commands.js";
import { type ApertureAssetLoader, type SystemGltfAssetDecoderProvider, type SystemAssetAccess } from "./assets.js";
import { type ApertureRandom } from "./random.js";
import { type ApertureFrameTime } from "./frame-time.js";
import { type ApertureDeterminismDiagnostics, type ApertureDeterminismDiagnosticsOptions } from "./determinism.js";
import { type CameraAccess } from "./cameras.js";
import { type GltfInstanceAccess } from "./gltf.js";
import { type HierarchyAccess } from "./hierarchy.js";
import { type InteractionAccess } from "../interaction/access.js";
import { type MaterialAccess } from "./materials.js";
import { type MeshAccess } from "./meshes.js";
import { type PhysicsAccess } from "./physics.js";
import { type PrefabAccess } from "./prefabs.js";
import { type ParticleAccess } from "./particles.js";
import { type AudioAccess } from "./audio.js";
import { type TrailAccess } from "./trails.js";
import { type SignalStore } from "./signals.js";
import { type ResourceStore } from "./resources.js";
import { type StartOptionsAccess } from "./start-options.js";
import { type SpawnCommands } from "./spawn/index.js";
import { type FixedStepAccess, type FixedStepTaskRegistrar } from "./fixed-step.js";
import { type HtmlBridgeAccess } from "./html-bridge.js";
export interface ApertureGeneratedActionMap {
}
export type InputActions = ApertureGeneratedActionMap & Record<string, InputAction>;
export type InputSignals = Omit<InputResourceBase, "actions"> & {
    readonly actions: InputActions;
};
export interface ApertureSystemContext {
    readonly world: unknown;
    readonly assetsRegistry: AssetRegistry;
    /** Deterministic seeded RNG — use instead of Math.random() for replayability. */
    readonly random: ApertureRandom;
    /** Sanctioned sim-time — use instead of Date.now()/performance.now(). */
    readonly time: ApertureFrameTime;
    readonly signals: SignalStore;
    readonly resources: ResourceStore;
    readonly startOptions: StartOptionsAccess;
    readonly input: InputSignals;
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
    readonly determinism: ApertureDeterminismDiagnostics;
}
export interface CreateApertureSystemContextOptions {
    readonly world: EcsWorld;
    readonly assetsRegistry: AssetRegistry;
    readonly config?: ApertureConfig;
    readonly startOptions?: Readonly<Record<string, unknown>>;
    readonly assetLoader?: ApertureAssetLoader;
    readonly gltfAssetDecoders?: SystemGltfAssetDecoderProvider;
    readonly registerFixedStepTask?: FixedStepTaskRegistrar;
    /** Seed for the deterministic RNG (default 0) or a prebuilt RNG instance. */
    readonly random?: number | ApertureRandom;
    readonly determinism?: ApertureDeterminismDiagnosticsOptions;
}
export declare function installApertureSystemContext(world: EcsWorld, context: ApertureSystemContext): void;
export declare function createApertureSystemContext(options: CreateApertureSystemContextOptions): ApertureSystemContext;
export declare function getApertureSystemContext(world: EcsWorld): ApertureSystemContext;
//# sourceMappingURL=context.d.ts.map