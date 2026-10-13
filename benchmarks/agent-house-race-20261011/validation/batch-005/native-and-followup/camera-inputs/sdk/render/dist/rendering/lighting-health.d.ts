import { type AssetRegistry } from "@aperture-engine/simulation";
import type { RenderEntityRef } from "./snapshot-packet-types.js";
import type { RenderSnapshot } from "./snapshot-core-types.js";
export declare const HIGH_METALLIC_FACTOR_THRESHOLD = 0.8;
export declare const DEFAULT_HIGH_RANGE_LUMINANCE_THRESHOLD = 1;
export type LightingHealthTonemapOperator = "none" | "linear" | "reinhard" | "aces" | "agx" | "neutral";
export type LightingHealthOutputColorSpace = "linear" | "srgb";
export interface LightingHealthOutputState {
    readonly tonemap: LightingHealthTonemapOperator;
    readonly exposure: number;
    readonly hdr: boolean;
    readonly colorSpace: LightingHealthOutputColorSpace;
}
export interface LightingHealthIblState {
    readonly diffuseReady?: boolean;
    readonly specularReady?: boolean;
    /**
     * Whether the submitted StandardMaterial pipeline for this snapshot samples
     * diffuse IBL. When omitted, the analyzer derives it from visible draw keys.
     */
    readonly diffuseActive?: boolean;
    /**
     * Whether the submitted StandardMaterial pipeline for this snapshot samples
     * specular IBL. When omitted, the analyzer derives it from visible draw keys.
     */
    readonly specularActive?: boolean;
    readonly preparationStatus?: "not-requested" | "source-missing" | "preparation-failed" | "diffuse-ready" | "diffuse-specular-ready";
}
export interface LightingHealthLuminanceMeasurement {
    readonly maximumPreOutputLuminance: number;
    readonly clippingRiskThreshold?: number;
}
export interface LightingHealthDiagnostic {
    readonly code: "render.material.metalWithoutSpecularIbl" | "render.output.untoneMappedHighRange" | "render.environment.requestedButInactive";
    readonly severity: "warning";
    readonly message: string;
    readonly suggestions: readonly string[];
    readonly materialCount?: number;
    readonly entityCount?: number;
    readonly maximumMetallicFactor?: number;
    readonly activeEnvironmentCount?: number;
    readonly materialKeys?: readonly string[];
    readonly entities?: readonly RenderEntityRef[];
    readonly maximumPreOutputLuminance?: number;
    readonly clippingRiskThreshold?: number;
}
export interface LightingHealthReport {
    readonly output: LightingHealthOutputState;
    readonly lighting: {
        readonly ambient: number;
        readonly directional: number;
        readonly point: number;
        readonly spot: number;
        readonly area: number;
        readonly environment: number;
        readonly diffuseIblReady: boolean;
        readonly specularIblReady: boolean;
        readonly diffuseIblActive: boolean;
        readonly specularIblActive: boolean;
        readonly environmentPreparationStatus: "not-requested" | "source-missing" | "preparation-failed" | "diffuse-ready" | "diffuse-specular-ready";
    };
    readonly materials: {
        readonly visible: number;
        readonly highMetallic: number;
        readonly highMetallicWithoutIbl: number;
        readonly maximumMetallicFactor: number;
        readonly unresolved: number;
    };
    readonly warnings: readonly LightingHealthDiagnostic[];
}
export interface AnalyzeLightingHealthInput {
    readonly snapshot: RenderSnapshot;
    readonly assets: AssetRegistry;
    readonly output: LightingHealthOutputState;
    readonly ibl?: LightingHealthIblState;
    readonly luminance?: LightingHealthLuminanceMeasurement;
}
/**
 * Analyze presentation compatibility without touching a GPU. The function is
 * intentionally side-effect free and only considers visible mesh draws, so
 * culled or hidden materials do not create scene-health warnings.
 */
export declare function analyzeLightingHealth(input: AnalyzeLightingHealthInput): LightingHealthReport;
export declare function lightingHealthReportToJsonValue(report: LightingHealthReport): LightingHealthReport;
export declare function lightingHealthReportToJson(report: LightingHealthReport): string;
/**
 * Allocation-free fingerprint of the snapshot/material facts consumed by the
 * analyzer. Frame/time and transforms are intentionally excluded: a static
 * visible material/lighting set can reuse its previous report across frames.
 */
export declare function lightingHealthInputFingerprint(snapshot: RenderSnapshot, assets: AssetRegistry): number;
//# sourceMappingURL=lighting-health.d.ts.map