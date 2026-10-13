import type { EnvironmentPacket, RenderSnapshot } from "@aperture-engine/render";
export type IblResourceDescriptorSlotStatus = "ready" | "unsupported";
export type IblResourceDescriptorDiagnosticCode = "iblResourceDescriptor.missingDescriptor" | "iblResourceDescriptor.diffuseSourceNotPrepared" | "iblResourceDescriptor.specularSourceNotPrepared";
export interface IblResourceDescriptorSlot {
    readonly status: IblResourceDescriptorSlotStatus;
    readonly resourceKey: string | null;
    readonly placeholder: string | null;
}
export interface IblResourceDescriptorSource {
    readonly environmentMapResourceKey: string;
    readonly diffuseResourceKey?: string;
    readonly specularResourceKey?: string;
}
export interface IblResourceDescriptor {
    readonly environmentMapResourceKey: string;
    readonly environmentIds: readonly number[];
    readonly ready: boolean;
    readonly diffuse: IblResourceDescriptorSlot;
    readonly specular: IblResourceDescriptorSlot;
}
export interface IblResourceDescriptorDiagnostic {
    readonly code: IblResourceDescriptorDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly environmentMapResourceKey: string;
    readonly environmentIds: readonly number[];
    readonly message: string;
}
export interface IblResourceDescriptorReport {
    readonly ready: boolean;
    readonly environmentCount: number;
    readonly requiredEnvironmentMapCount: number;
    readonly descriptorCount: number;
    readonly sections: {
        readonly environmentResourcePlanning: boolean;
        readonly iblDescriptors: boolean;
    };
    readonly descriptors: readonly IblResourceDescriptor[];
    readonly diagnostics: readonly IblResourceDescriptorDiagnostic[];
}
export type IblResourceDescriptorReportJsonValue = IblResourceDescriptorReport;
export interface IblResourceDescriptorInput {
    readonly snapshot: Pick<RenderSnapshot, "environments"> | readonly EnvironmentPacket[];
    readonly descriptors?: readonly IblResourceDescriptorSource[];
}
export declare function createIblResourceDescriptorReport(input: IblResourceDescriptorInput): IblResourceDescriptorReport;
export declare function iblResourceDescriptorReportToJsonValue(report: IblResourceDescriptorReport): IblResourceDescriptorReportJsonValue;
export declare function iblResourceDescriptorReportToJson(report: IblResourceDescriptorReport): string;
//# sourceMappingURL=ibl-resource-descriptor.d.ts.map