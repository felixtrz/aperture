import type { IblResourceDescriptorDiagnostic, IblResourceDescriptorReport } from "./ibl-resource-descriptor.js";
export type IblTexturePreparationStatus = "ready" | "deferred" | "unsupported" | "missing" | "not-required";
export type IblTexturePreparationMode = "ready" | "deferred" | "unsupported";
export type IblTexturePreparationDiagnosticCode = "iblTexturePreparation.missingDescriptors" | "iblTexturePreparation.unsupportedSlots" | "iblTexturePreparation.preparationDeferred" | "iblTexturePreparation.preparationUnsupported";
export interface IblTexturePreparationSlot {
    readonly environmentMapResourceKey: string;
    readonly environmentIds: readonly number[];
    readonly kind: "diffuse" | "specular";
    readonly sourceResourceKey: string | null;
    readonly placeholder: string | null;
    readonly textureKey: string | null;
    readonly viewKey: string | null;
    readonly samplerKey: string | null;
    readonly dimension: "cube";
    readonly format: "rgba16float";
    readonly usageIntent: "texture-binding";
    readonly preparation: Exclude<IblTexturePreparationMode, "ready"> | "ready";
}
export interface IblTexturePreparationDiagnostic {
    readonly code: IblTexturePreparationDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly descriptorDiagnostics: readonly IblResourceDescriptorDiagnostic[];
}
export interface IblTexturePreparationReport {
    readonly ready: boolean;
    readonly status: IblTexturePreparationStatus;
    readonly descriptorCount: number;
    readonly slotCount: number;
    readonly preparedSlotCount: number;
    readonly sections: {
        readonly iblDescriptors: boolean;
        readonly texturePreparation: boolean;
        readonly textureUpload: boolean;
        readonly prefiltering: boolean;
    };
    readonly slots: readonly IblTexturePreparationSlot[];
    readonly diagnostics: readonly IblTexturePreparationDiagnostic[];
}
export type IblTexturePreparationReportJsonValue = IblTexturePreparationReport;
export interface IblTexturePreparationInput {
    readonly descriptors: IblResourceDescriptorReport;
    readonly preparation?: IblTexturePreparationMode;
}
export declare function createIblTexturePreparationReport(input: IblTexturePreparationInput): IblTexturePreparationReport;
export declare function iblTexturePreparationReportToJsonValue(report: IblTexturePreparationReport): IblTexturePreparationReportJsonValue;
export declare function iblTexturePreparationReportToJson(report: IblTexturePreparationReport): string;
//# sourceMappingURL=ibl-texture-preparation.d.ts.map