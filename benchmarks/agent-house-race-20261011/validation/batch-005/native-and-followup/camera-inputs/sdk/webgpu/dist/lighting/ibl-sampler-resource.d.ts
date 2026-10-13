import type { IblSamplerDescriptorReadinessReport } from "./ibl-sampler-descriptor-readiness.js";
import { type CreateSamplerGpuResourceResult, type SamplerGpuResource, type SamplerDescriptorInput, type TextureGpuDeviceLike, type TextureGpuResourceDiagnostic } from "../resources/textures/texture-resources.js";
export type IblSamplerResourceStatus = "available" | "missing" | "unsupported" | "not-required";
export type IblSamplerResourceDiagnostic = TextureGpuResourceDiagnostic | {
    readonly code: "iblSamplerResource.missingSamplerDescriptors" | "iblSamplerResource.unsupportedSamplerDescriptors";
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey?: string;
};
export interface CreateIblSamplerResourceOptions {
    readonly device: TextureGpuDeviceLike;
    readonly samplers: IblSamplerDescriptorReadinessReport;
    readonly cache?: Map<string, SamplerGpuResource>;
}
export interface IblSamplerResourceReport {
    readonly ready: boolean;
    readonly status: IblSamplerResourceStatus;
    readonly samplerDescriptorCount: number;
    readonly createdSamplerCount: number;
    readonly reusedSamplerCount: number;
    readonly sections: {
        readonly samplerDescriptors: boolean;
        readonly gpuAllocation: boolean;
        readonly bindGroupLayout: false;
    };
    readonly resources: readonly CreateSamplerGpuResourceResult[];
    readonly diagnostics: readonly IblSamplerResourceDiagnostic[];
}
export interface IblSamplerResourceReportJsonValue {
    readonly ready: boolean;
    readonly status: IblSamplerResourceStatus;
    readonly samplerDescriptorCount: number;
    readonly createdSamplerCount: number;
    readonly reusedSamplerCount: number;
    readonly sections: IblSamplerResourceReport["sections"];
    readonly resources: readonly {
        readonly valid: boolean;
        readonly resourceKey: string;
        readonly descriptor: SamplerDescriptorInput | null;
    }[];
    readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: "warning" | "error";
        readonly message: string;
        readonly resourceKey?: string;
    }[];
}
export declare function createIblSamplerResourceReport(options: CreateIblSamplerResourceOptions): IblSamplerResourceReport;
export declare function iblSamplerResourceReportToJsonValue(report: IblSamplerResourceReport): IblSamplerResourceReportJsonValue;
export declare function iblSamplerResourceReportToJson(report: IblSamplerResourceReport): string;
//# sourceMappingURL=ibl-sampler-resource.d.ts.map