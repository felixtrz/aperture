import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
export type IblSamplerDescriptorStatus = "ready" | "deferred" | "missing" | "unsupported" | "not-required";
export type IblSamplerAllocationMode = "ready" | "deferred" | "unsupported";
export type IblSamplerDescriptorDiagnosticCode = "iblSamplerDescriptor.missingTexturePreparation" | "iblSamplerDescriptor.unsupportedTextureSlots" | "iblSamplerDescriptor.allocationDeferred" | "iblSamplerDescriptor.allocationUnsupported";
export interface IblSamplerDescriptorSlot {
    readonly environmentMapResourceKey: string;
    readonly environmentIds: readonly number[];
    readonly kind: "diffuse" | "specular";
    readonly sourceResourceKey: string;
    readonly samplerKey: string;
    readonly addressModeU: "clamp-to-edge";
    readonly addressModeV: "clamp-to-edge";
    readonly addressModeW: "clamp-to-edge";
    readonly magFilter: "linear";
    readonly minFilter: "linear";
    readonly mipmapFilter: "linear";
    readonly maxAnisotropy: 1;
    readonly allocation: IblSamplerAllocationMode;
}
export interface IblSamplerDescriptorDiagnostic {
    readonly code: IblSamplerDescriptorDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface IblSamplerDescriptorReadinessReport {
    readonly ready: boolean;
    readonly status: IblSamplerDescriptorStatus;
    readonly textureSlotCount: number;
    readonly samplerCount: number;
    readonly allocatedSamplerCount: number;
    readonly sections: {
        readonly texturePreparation: boolean;
        readonly samplerDescriptors: boolean;
        readonly gpuAllocation: boolean;
        readonly bindGroupLayout: false;
    };
    readonly samplers: readonly IblSamplerDescriptorSlot[];
    readonly diagnostics: readonly IblSamplerDescriptorDiagnostic[];
}
export type IblSamplerDescriptorReadinessReportJsonValue = IblSamplerDescriptorReadinessReport;
export interface IblSamplerDescriptorReadinessInput {
    readonly textures: IblTexturePreparationReport;
    readonly allocation?: IblSamplerAllocationMode;
}
export declare function createIblSamplerDescriptorReadinessReport(input: IblSamplerDescriptorReadinessInput): IblSamplerDescriptorReadinessReport;
export declare function iblSamplerDescriptorReadinessReportToJsonValue(report: IblSamplerDescriptorReadinessReport): IblSamplerDescriptorReadinessReportJsonValue;
export declare function iblSamplerDescriptorReadinessReportToJson(report: IblSamplerDescriptorReadinessReport): string;
//# sourceMappingURL=ibl-sampler-descriptor-readiness.d.ts.map