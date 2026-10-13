import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
export type ShadowDepthResourceSummaryStatus = "deferred" | "missing" | "not-required";
export interface ShadowDepthResourceSummaryDiagnostic {
    readonly code: "shadowDepthResourceSummary.depthTextureResourceMissing" | "shadowDepthResourceSummary.matrixUploadDeferred" | "shadowDepthResourceSummary.passSubmissionDeferred" | "shadowDepthResourceSummary.shaderSamplingDeferred";
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface CreateShadowDepthResourceSummaryOptions {
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
}
export interface ShadowDepthResourceSummaryReport {
    readonly ready: false;
    readonly status: ShadowDepthResourceSummaryStatus;
    readonly counts: {
        readonly textureDescriptors: number;
        readonly depthTextureResources: number;
    };
    readonly sections: {
        readonly textureDescriptors: boolean;
        readonly depthTextureResource: boolean;
        readonly gpuAllocation: boolean;
        readonly matrixUpload: false;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly resourceKeys: {
        readonly textures: readonly string[];
        readonly views: readonly string[];
    };
    readonly diagnostics: readonly ShadowDepthResourceSummaryDiagnostic[];
}
export type ShadowDepthResourceSummaryReportJsonValue = ShadowDepthResourceSummaryReport;
export declare function createShadowDepthResourceSummaryReport(options: CreateShadowDepthResourceSummaryOptions): ShadowDepthResourceSummaryReport;
export declare function shadowDepthResourceSummaryReportToJsonValue(report: ShadowDepthResourceSummaryReport): ShadowDepthResourceSummaryReportJsonValue;
export declare function shadowDepthResourceSummaryReportToJson(report: ShadowDepthResourceSummaryReport): string;
//# sourceMappingURL=shadow-depth-resource-summary.d.ts.map