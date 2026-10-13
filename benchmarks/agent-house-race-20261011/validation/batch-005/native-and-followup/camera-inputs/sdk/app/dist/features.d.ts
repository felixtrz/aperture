import type { SimulationFixedStepCallback, SimulationFixedStepTaskOptions } from "@aperture-engine/runtime";
import { type AssetRegistry, type EcsWorld, type MaybePromise } from "@aperture-engine/simulation";
export type { MaybePromise };
export interface ApertureFeatureDescriptor {
    readonly id: string;
    /** Hard dependencies: install fails when one is missing, and a `requires` cycle is an error. */
    readonly requires?: readonly string[];
    /**
     * Soft ordering hints: install after these features when they are present.
     * Missing targets are ignored, and hints that would form a cycle are
     * dropped rather than failing resolution.
     */
    readonly optional?: readonly string[];
    /** Features that cannot be configured together with this one. */
    readonly conflictsWith?: readonly string[];
}
export type FeatureDisposer = () => MaybePromise<void>;
export interface FeatureInstallHandle {
    dispose(): MaybePromise<void>;
}
export type FeatureInstallResult = void | FeatureDisposer | FeatureInstallHandle;
export interface FeatureDiagnostic {
    readonly code: string;
    readonly severity: "info" | "warning" | "error";
    readonly featureId: string;
    readonly message: string;
    readonly suggestedFix?: string;
    readonly data?: Readonly<Record<string, unknown>>;
}
export interface FeatureDiagnosticsSink {
    report(diagnostic: FeatureDiagnostic): void;
    scoped(featureId: string): ScopedFeatureDiagnosticsSink;
    list(): readonly FeatureDiagnostic[];
}
export interface ScopedFeatureDiagnosticsSink {
    report(diagnostic: Omit<FeatureDiagnostic, "featureId"> & {
        readonly featureId?: string;
    }): void;
}
export interface FeatureComponentContext {
    readonly world: EcsWorld;
    readonly diagnostics: FeatureDiagnosticsSink;
}
export interface FeatureAssetContext {
    readonly registry: AssetRegistry;
    readonly diagnostics: FeatureDiagnosticsSink;
}
export interface FeatureRuntimeContext {
    readonly world: EcsWorld;
    readonly assets: AssetRegistry;
    readonly registerFixedStepTask: (task: SimulationFixedStepCallback, options?: SimulationFixedStepTaskOptions) => () => void;
    readonly diagnostics: FeatureDiagnosticsSink;
}
export interface ExtractionHook {
    readonly id: string;
    readonly packetFamilies: readonly string[];
}
export type RegisterExtractor = (hook: ExtractionHook) => FeatureDisposer;
export interface FeatureExtractionContext {
    readonly registerExtractor: RegisterExtractor;
    readonly diagnostics: FeatureDiagnosticsSink;
}
export interface ApertureWorkerFeature extends ApertureFeatureDescriptor {
    registerComponents?(context: FeatureComponentContext): void;
    registerAssets?(context: FeatureAssetContext): void;
    installRuntime?(context: FeatureRuntimeContext): MaybePromise<FeatureInstallResult>;
    installExtraction?(context: FeatureExtractionContext): MaybePromise<FeatureInstallResult>;
}
export interface InstallApertureWorkerFeaturesOptions {
    readonly features: readonly ApertureWorkerFeature[];
    readonly world: EcsWorld;
    readonly assets: AssetRegistry;
    readonly registerFixedStepTask: FeatureRuntimeContext["registerFixedStepTask"];
    readonly registerExtractor?: RegisterExtractor;
    readonly diagnostics?: FeatureDiagnosticsSink;
}
export interface InstalledApertureWorkerFeatures {
    readonly order: readonly string[];
    readonly diagnostics: FeatureDiagnosticsSink;
    dispose(): Promise<void>;
}
export declare class ApertureFeatureError extends Error {
    readonly code: string;
    readonly suggestedFix: string;
    readonly diagnostics: readonly FeatureDiagnostic[];
    constructor(input: {
        readonly code: string;
        readonly message: string;
        readonly suggestedFix: string;
        readonly diagnostics: readonly FeatureDiagnostic[];
        readonly cause?: unknown;
    });
}
export declare function createFeatureDiagnosticsSink(initial?: readonly FeatureDiagnostic[]): FeatureDiagnosticsSink;
export declare function installApertureWorkerFeatures(options: InstallApertureWorkerFeaturesOptions): Promise<InstalledApertureWorkerFeatures>;
export declare function resolveApertureWorkerFeatureOrder(features: readonly ApertureWorkerFeature[], diagnostics?: FeatureDiagnosticsSink): readonly ApertureWorkerFeature[];
//# sourceMappingURL=features.d.ts.map