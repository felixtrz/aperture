import type { RenderSnapshot } from "@aperture-engine/render";
import { type LightShaderBindingValidationReport, type LightShaderResourceReadinessDiagnostic } from "./light-shader-metadata.js";
import type { StandardFrameGpuResources } from "../materials/standard/standard-frame-resources.js";
export interface DirectLightKindCounts {
    readonly total: number;
    readonly direct: number;
    readonly ambient: number;
    readonly directional: number;
    readonly point: number;
    readonly spot: number;
    readonly rectArea: number;
    readonly environment: number;
    readonly areaShapes: DirectAreaLightShapeCounts;
}
export interface DirectAreaLightShapeCounts {
    readonly rect: number;
    readonly disk: number;
    readonly sphere: number;
}
export interface DirectLightReadinessResourceState {
    readonly lightGpuBufferResourceKey: string | null;
    readonly lightBindGroupLayoutKey: string | null;
    readonly lightBindGroupResourceKey: string | null;
}
export interface DirectLightReadinessInput {
    readonly snapshot: Pick<RenderSnapshot, "lights">;
    readonly resources?: DirectLightReadinessResourceState | null;
    readonly metadata?: LightShaderBindingValidationReport;
}
export interface DirectLightShaderMetadataReadiness {
    readonly valid: boolean;
    readonly diagnostics: LightShaderBindingValidationReport["diagnostics"];
}
export interface DirectLightReadinessReport {
    readonly ready: boolean;
    readonly lightCounts: DirectLightKindCounts;
    readonly sections: {
        readonly lightGpuBuffers: boolean;
        readonly lightBindGroupLayout: boolean;
        readonly lightBindGroup: boolean;
        readonly shaderMetadata: boolean;
    };
    readonly resources: {
        readonly lightGpuBufferResourceKey: string | null;
        readonly lightBindGroupLayoutKey: string | null;
        readonly lightBindGroupResourceKey: string | null;
    };
    readonly shaderMetadata: DirectLightShaderMetadataReadiness;
    readonly diagnostics: readonly LightShaderResourceReadinessDiagnostic[];
}
export type DirectLightReadinessReportJsonValue = DirectLightReadinessReport;
export declare function createDirectLightReadinessReport(input: DirectLightReadinessInput): DirectLightReadinessReport;
export declare function directLightReadinessResourceStateFromStandardFrameResources(resources: Pick<StandardFrameGpuResources, "lightGpuBuffers" | "lightBindGroup"> | null): DirectLightReadinessResourceState;
export declare function directLightReadinessReportToJsonValue(report: DirectLightReadinessReport): DirectLightReadinessReportJsonValue;
export declare function directLightReadinessReportToJson(report: DirectLightReadinessReport): string;
//# sourceMappingURL=direct-light-readiness.d.ts.map