import type { IblSamplerResourceReport } from "./ibl-sampler-resource.js";
import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
import type { DiffuseIblTextureResourceReport } from "./ibl-texture-resource.js";
export type DiffuseIblResourceSummaryStatus = "deferred" | "missing" | "unsupported" | "not-required";
export interface DiffuseIblResourceSummaryDiagnostic {
    readonly code: "diffuseIblResourceSummary.textureResourceMissing" | "diffuseIblResourceSummary.samplerResourceMissing" | "diffuseIblResourceSummary.resourceUnsupported";
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface CreateDiffuseIblResourceSummaryOptions {
    readonly textures: IblTexturePreparationReport;
    readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
    readonly samplers: IblSamplerResourceReport;
}
export interface DiffuseIblResourceSummaryReport {
    readonly ready: false;
    readonly status: DiffuseIblResourceSummaryStatus;
    readonly counts: {
        readonly textureSlots: number;
        readonly diffuseTextureResources: number;
        readonly samplerResources: number;
        readonly deferredSpecularSlots: number;
    };
    readonly sections: {
        readonly texturePreparation: boolean;
        readonly diffuseTextureResource: boolean;
        readonly samplerResources: boolean;
        readonly specularPrefiltering: false;
        readonly bindGroupLayout: false;
    };
    readonly resourceKeys: {
        readonly diffuseTextures: readonly string[];
        readonly samplers: readonly string[];
        readonly deferredSpecularTextures: readonly string[];
    };
    readonly diagnostics: readonly DiffuseIblResourceSummaryDiagnostic[];
}
export type DiffuseIblResourceSummaryReportJsonValue = DiffuseIblResourceSummaryReport;
export declare function createDiffuseIblResourceSummaryReport(options: CreateDiffuseIblResourceSummaryOptions): DiffuseIblResourceSummaryReport;
export declare function diffuseIblResourceSummaryReportToJsonValue(report: DiffuseIblResourceSummaryReport): DiffuseIblResourceSummaryReportJsonValue;
export declare function diffuseIblResourceSummaryReportToJson(report: DiffuseIblResourceSummaryReport): string;
//# sourceMappingURL=diffuse-ibl-resource-summary.d.ts.map