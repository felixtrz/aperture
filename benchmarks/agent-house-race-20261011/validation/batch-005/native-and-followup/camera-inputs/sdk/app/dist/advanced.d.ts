export { disposeApertureApp } from "./internal/app-lifecycle.js";
export { assertApertureBootstrapAllowed, getApertureCleanupFailures, } from "./internal/bootstrap-safety.js";
import { type CreateExtractionAppOptions, type ExtractionApp, type SimulationFixedStepClockState, type SimulationStepResult } from "@aperture-engine/runtime";
import { type ApertureAssetLoader, type ApertureDeterminismDiagnosticsOptions, type ApertureRandom, type SystemGltfAssetDecoderProvider, type ApertureSystemConstructor, type ApertureSystemContext } from "./systems.js";
import { type ApertureConfig } from "./config.js";
import { type AperturePhysicsConfig, type AperturePhysicsFacade } from "./physics-facade.js";
import { type InstalledApertureWorkerFeatures, type MaybePromise } from "./features.js";
export { DEFAULT_ENVIRONMENT_ASSET_ID, DEFAULT_ENVIRONMENT_IBL_COLORS, DEFAULT_ENVIRONMENT_IBL_INTENSITY, DEFAULT_ENVIRONMENT_LIGHT_KEY, DEFAULT_ENVIRONMENT_SKY_COLORS, DEFAULT_ENVIRONMENT_SKY_KEY, DEFAULT_ENVIRONMENT_SUN_ILLUMINANCE, DEFAULT_ENVIRONMENT_SUN_KEY, defaultEnvironmentEquirectRgba8, installDefaultEnvironment, } from "./default-environment.js";
/**
 * An imported system module. Wrap a default-imported class as
 * `{ default: SceneSystem }`; priority belongs to `createSystem({ priority })`.
 */
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
    /** Already imported modules; config.systems contains host discovery patterns. */
    readonly systems?: readonly ApertureSystemModule[];
    readonly assetLoader?: ApertureAssetLoader;
    readonly gltfAssetDecoders?: SystemGltfAssetDecoderProvider;
    readonly worldOptions?: CreateExtractionAppOptions["worldOptions"];
    readonly fixedStep?: CreateExtractionAppOptions["fixedStep"];
    readonly physics?: boolean | AperturePhysicsConfig;
    readonly physicsInterpolation?: boolean;
    readonly startOptions?: Readonly<Record<string, unknown>>;
    /** Seed for the deterministic RNG (default 0) or a prebuilt RNG instance. */
    readonly random?: number | ApertureRandom;
    readonly determinism?: ApertureDeterminismDiagnosticsOptions;
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
    readonly updateEffectsMilliseconds: number;
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
    readonly features: InstalledApertureWorkerFeatures;
    readonly physics: AperturePhysicsFacade | null;
    readonly preload: AperturePreloadReport;
    step(delta?: number, time?: number): ApertureAppStepResult;
    extract(frame?: number): ReturnType<ExtractionApp["extract"]>;
    registerFixedStepTask(task: Parameters<ExtractionApp["registerFixedStepTask"]>[0], options?: Parameters<ExtractionApp["registerFixedStepTask"]>[1]): () => void;
    resetFixedStepClock(): void;
    snapshotFixedStepClock(): SimulationFixedStepClockState | null;
    restoreFixedStepClock(state: SimulationFixedStepClockState | null): boolean;
    dispose(): MaybePromise<void>;
    stepAndExtract(delta?: number, time?: number, frame?: number): ReturnType<ExtractionApp["stepAndExtract"]>;
}
export declare class ApertureAppError extends Error {
    readonly code: string;
    readonly suggestedFix: string;
    readonly detail: Readonly<Record<string, unknown>> | undefined;
    constructor(input: {
        readonly code: string;
        readonly message: string;
        readonly suggestedFix: string;
        readonly detail?: Readonly<Record<string, unknown>>;
    });
}
/** Validate app configuration, feature dependencies, and modules without creating a world. */
export declare function preflightApertureApp(options: Pick<CreateApertureAppOptions, "config" | "systems" | "physics">): void;
export declare function createApertureApp(options: CreateApertureAppOptions): Promise<ApertureApp>;
export declare function resolveApertureSystemModules(modules: readonly ApertureSystemModule[]): ApertureResolvedSystemModule[];
export declare function registerApertureSystemModules(app: Pick<ExtractionApp, "world">, modules: readonly ApertureSystemModule[]): readonly ApertureResolvedSystemModule[];
export { findDefinedResource } from "./systems/resources.js";
//# sourceMappingURL=advanced.d.ts.map