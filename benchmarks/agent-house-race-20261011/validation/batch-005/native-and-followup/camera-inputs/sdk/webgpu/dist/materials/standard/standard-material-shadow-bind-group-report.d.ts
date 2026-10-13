import type { ShadowSamplerDescriptor, ShadowSamplerResourceReport, StandardMaterialShadowBindGroupDescriptorReadinessReport, StandardMaterialShadowBindGroupResourceReport } from "./standard-material-shadow-bind-group.js";
export type ShadowSamplerResourceReportJsonValue = Omit<ShadowSamplerResourceReport, "resource"> & {
    readonly resource: {
        readonly resourceKey: string;
        readonly descriptor: ShadowSamplerDescriptor;
    } | null;
};
export type StandardMaterialShadowBindGroupResourceReportJsonValue = Omit<StandardMaterialShadowBindGroupResourceReport, "resource"> & {
    readonly resource: {
        readonly group: 5;
        readonly resourceKey: string;
        readonly layoutKey: string;
        readonly entryResourceKeys: readonly string[];
    } | null;
};
export type StandardMaterialShadowBindGroupDescriptorReadinessReportJsonValue = StandardMaterialShadowBindGroupDescriptorReadinessReport;
export declare function shadowSamplerResourceReportToJsonValue(report: ShadowSamplerResourceReport): ShadowSamplerResourceReportJsonValue;
export declare function shadowSamplerResourceReportToJson(report: ShadowSamplerResourceReport): string;
export declare function standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(report: StandardMaterialShadowBindGroupDescriptorReadinessReport): StandardMaterialShadowBindGroupDescriptorReadinessReportJsonValue;
export declare function standardMaterialShadowBindGroupDescriptorReadinessReportToJson(report: StandardMaterialShadowBindGroupDescriptorReadinessReport): string;
export declare function standardMaterialShadowBindGroupResourceReportToJsonValue(report: StandardMaterialShadowBindGroupResourceReport): StandardMaterialShadowBindGroupResourceReportJsonValue;
export declare function standardMaterialShadowBindGroupResourceReportToJson(report: StandardMaterialShadowBindGroupResourceReport): string;
//# sourceMappingURL=standard-material-shadow-bind-group-report.d.ts.map