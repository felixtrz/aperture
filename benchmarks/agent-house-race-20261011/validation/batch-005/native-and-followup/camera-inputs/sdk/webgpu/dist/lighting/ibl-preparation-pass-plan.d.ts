import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
export type IblPreparationPassStatus = "ready" | "deferred" | "unsupported" | "missing" | "not-required";
export type IblPreparationPassMode = "ready" | "deferred" | "unsupported";
export type IblPreparationPassDiagnosticCode = "iblPreparationPass.missingTexturePreparation" | "iblPreparationPass.unsupportedSlots" | "iblPreparationPass.submissionDeferred" | "iblPreparationPass.submissionUnsupported";
export interface IblPreparationPass {
    readonly passKey: string;
    readonly environmentMapResourceKey: string;
    readonly environmentIds: readonly number[];
    readonly kind: "diffuse" | "specular";
    readonly sourceResourceKey: string;
    readonly textureKey: string;
    readonly viewKey: string;
    readonly samplerKey: string;
    readonly operation: "irradiance-convolution" | "specular-prefilter";
    readonly submission: IblPreparationPassMode;
}
export interface IblPreparationPassDiagnostic {
    readonly code: IblPreparationPassDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface IblPreparationPassPlanReport {
    readonly ready: boolean;
    readonly status: IblPreparationPassStatus;
    readonly slotCount: number;
    readonly passCount: number;
    readonly sections: {
        readonly texturePreparation: boolean;
        readonly passPlans: boolean;
        readonly passSubmission: boolean;
    };
    readonly passes: readonly IblPreparationPass[];
    readonly diagnostics: readonly IblPreparationPassDiagnostic[];
}
export type IblPreparationPassPlanReportJsonValue = IblPreparationPassPlanReport;
export interface IblPreparationPassPlanInput {
    readonly textures: IblTexturePreparationReport;
    readonly submission?: IblPreparationPassMode;
}
export declare function createIblPreparationPassPlanReport(input: IblPreparationPassPlanInput): IblPreparationPassPlanReport;
export declare function iblPreparationPassPlanReportToJsonValue(report: IblPreparationPassPlanReport): IblPreparationPassPlanReportJsonValue;
export declare function iblPreparationPassPlanReportToJson(report: IblPreparationPassPlanReport): string;
//# sourceMappingURL=ibl-preparation-pass-plan.d.ts.map