import type { IblPreparationPassPlanReport } from "./ibl-preparation-pass-plan.js";
import type { IblResourceDescriptorReport } from "./ibl-resource-descriptor.js";
import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
export type IblPreparationResourceSummaryStatus = "ready" | "deferred" | "unsupported" | "missing" | "not-required";
export type IblPreparationResourceSummaryDiagnosticCode = "iblPreparationResourceSummary.missingDescriptors" | "iblPreparationResourceSummary.missingTexturePreparation" | "iblPreparationResourceSummary.unsupportedTexturePreparation" | "iblPreparationResourceSummary.textureUploadDeferred" | "iblPreparationResourceSummary.missingPassPlan" | "iblPreparationResourceSummary.unsupportedPassPlan" | "iblPreparationResourceSummary.passSubmissionDeferred";
export interface IblPreparationResourceSummaryDiagnostic {
    readonly code: IblPreparationResourceSummaryDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface IblPreparationResourceSummaryReport {
    readonly ready: boolean;
    readonly status: IblPreparationResourceSummaryStatus;
    readonly counts: {
        readonly environmentMaps: number;
        readonly descriptors: number;
        readonly textureSlots: number;
        readonly plannedTextures: number;
        readonly plannedViews: number;
        readonly plannedSamplers: number;
        readonly preparationPasses: number;
    };
    readonly sections: {
        readonly iblDescriptors: boolean;
        readonly textureDescriptors: boolean;
        readonly textureUpload: boolean;
        readonly prefilterPassPlans: boolean;
        readonly passSubmission: boolean;
    };
    readonly resourceKeys: {
        readonly environmentMaps: readonly string[];
        readonly textures: readonly string[];
        readonly views: readonly string[];
        readonly samplers: readonly string[];
        readonly passes: readonly string[];
    };
    readonly diagnostics: readonly IblPreparationResourceSummaryDiagnostic[];
}
export type IblPreparationResourceSummaryReportJsonValue = IblPreparationResourceSummaryReport;
export interface IblPreparationResourceSummaryScratch {
    readonly environmentMapKeys: string[];
    readonly textureKeys: string[];
    readonly viewKeys: string[];
    readonly samplerKeys: string[];
    readonly passKeys: string[];
    readonly diagnostics: IblPreparationResourceSummaryDiagnostic[];
    readonly report: IblPreparationResourceSummaryReport;
}
export interface IblPreparationResourceSummaryInput {
    readonly descriptors: IblResourceDescriptorReport;
    readonly textures: IblTexturePreparationReport;
    readonly passPlan: IblPreparationPassPlanReport;
}
export declare function createIblPreparationResourceSummaryReport(input: IblPreparationResourceSummaryInput): IblPreparationResourceSummaryReport;
export declare function createIblPreparationResourceSummaryScratch(): IblPreparationResourceSummaryScratch;
export declare function writeIblPreparationResourceSummaryReport(input: IblPreparationResourceSummaryInput, scratch: IblPreparationResourceSummaryScratch): IblPreparationResourceSummaryReport;
export declare function iblPreparationResourceSummaryReportToJsonValue(report: IblPreparationResourceSummaryReport): IblPreparationResourceSummaryReportJsonValue;
export declare function iblPreparationResourceSummaryReportToJson(report: IblPreparationResourceSummaryReport): string;
//# sourceMappingURL=ibl-preparation-resource-summary.d.ts.map