import type { DiffuseIblTextureResourceReport, SpecularIblTextureResourceReport } from "../../lighting/ibl-texture-resource.js";
import type { IblSamplerResourceReport } from "../../lighting/ibl-sampler-resource.js";
import type { IblTexturePreparationReport } from "../../lighting/ibl-texture-preparation.js";
import type { StandardMaterialBindGroupDeviceLike, StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";
import { type StandardMaterialIblBindGroupLayoutPlan } from "./standard-material-ibl-bind-group-layout.js";
export type StandardMaterialIblBindGroupDescriptorStatus = "available" | "missing" | "not-required";
export type StandardMaterialIblBindGroupDescriptorDiagnosticCode = "standardMaterialIblBindGroup.invalidLayout" | "standardMaterialIblBindGroup.missingDiffuseTextureResource" | "standardMaterialIblBindGroup.missingSpecularTextureResource" | "standardMaterialIblBindGroup.missingSamplerResource";
export type StandardMaterialIblBindGroupResourceDiagnosticCode = "standardMaterialIblBindGroupResource.nullDescriptorPlan" | "standardMaterialIblBindGroupResource.invalidDescriptorPlan" | "standardMaterialIblBindGroupResource.invalidLayout" | "standardMaterialIblBindGroupResource.missingDeviceSupport" | "standardMaterialIblBindGroupResource.missingTextureResource" | "standardMaterialIblBindGroupResource.missingSamplerResource" | "standardMaterialIblBindGroupResource.creationFailed";
export interface StandardMaterialIblBindGroupDescriptorDiagnostic {
    readonly code: StandardMaterialIblBindGroupDescriptorDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly binding?: number;
    readonly resourceKey?: string;
}
export interface StandardMaterialIblBindGroupResourceDiagnostic {
    readonly code: StandardMaterialIblBindGroupResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly binding?: number;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface StandardMaterialIblBindGroupDescriptorEntry {
    readonly group: 4;
    readonly binding: 0 | 1 | 2;
    readonly resourceKey: string;
    readonly resourceKind: Extract<StandardMaterialBindGroupResourceKind, "texture-view" | "sampler">;
}
export interface StandardMaterialIblBindGroupDescriptorPlan {
    readonly valid: boolean;
    readonly group: 4;
    readonly resourceKey: string | null;
    readonly entries: readonly StandardMaterialIblBindGroupDescriptorEntry[];
    readonly diagnostics: readonly StandardMaterialIblBindGroupDescriptorDiagnostic[];
}
export interface StandardMaterialIblBindGroupLayoutResource {
    readonly group: 4;
    readonly layoutKey: string;
    readonly layout: unknown;
}
export interface StandardMaterialIblBindGroupResource {
    readonly group: 4;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface StandardMaterialIblBindGroupResourceReport {
    readonly ready: boolean;
    readonly status: "available" | "missing" | "not-required";
    readonly standardMaterialCount: number;
    readonly group: 4;
    readonly createdBindGroupCount: number;
    readonly reusedBindGroupCount: number;
    readonly sections: {
        readonly descriptorPlan: boolean;
        readonly layoutResource: boolean;
        readonly textureResources: boolean;
        readonly samplerResource: boolean;
        readonly bindGroupResource: boolean;
    };
    readonly resource: StandardMaterialIblBindGroupResource | null;
    readonly diagnostics: readonly StandardMaterialIblBindGroupResourceDiagnostic[];
}
export type StandardMaterialIblBindGroupResourceReportJsonValue = Omit<StandardMaterialIblBindGroupResourceReport, "resource"> & {
    readonly resource: {
        readonly group: 4;
        readonly resourceKey: string;
        readonly layoutKey: string;
        readonly entryResourceKeys: readonly string[];
    } | null;
};
export interface StandardMaterialIblBindGroupDescriptorReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialIblBindGroupDescriptorStatus;
    readonly standardMaterialCount: number;
    readonly group: 4;
    readonly entryCount: number;
    readonly sections: {
        readonly layoutMetadata: boolean;
        readonly descriptorPlan: boolean;
        readonly diffuseTextureResource: boolean;
        readonly specularTextureResource: boolean;
        readonly samplerResource: boolean;
    };
    readonly plan: StandardMaterialIblBindGroupDescriptorPlan | null;
    readonly diagnostics: readonly StandardMaterialIblBindGroupDescriptorDiagnostic[];
}
export type StandardMaterialIblBindGroupDescriptorReadinessReportJsonValue = StandardMaterialIblBindGroupDescriptorReadinessReport;
export interface CreateStandardMaterialIblBindGroupDescriptorPlanOptions {
    readonly layout?: StandardMaterialIblBindGroupLayoutPlan | null;
    readonly textures: IblTexturePreparationReport;
    readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
    readonly specularTextureResource?: SpecularIblTextureResourceReport;
    readonly samplers: IblSamplerResourceReport;
}
export interface CreateStandardMaterialIblBindGroupDescriptorReadinessOptions extends CreateStandardMaterialIblBindGroupDescriptorPlanOptions {
    readonly standardMaterialCount: number;
}
export interface CreateStandardMaterialIblBindGroupResourceReportOptions {
    readonly device: StandardMaterialBindGroupDeviceLike & {
        createBindGroupLayout?: (descriptor: unknown) => unknown;
    };
    readonly standardMaterialCount: number;
    readonly descriptor: StandardMaterialIblBindGroupDescriptorReadinessReport;
    readonly layout?: StandardMaterialIblBindGroupLayoutPlan;
    readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
    readonly specularTextureResource: SpecularIblTextureResourceReport;
    readonly samplers: IblSamplerResourceReport;
    readonly cache?: Map<string, StandardMaterialIblBindGroupResource>;
}
export declare function createStandardMaterialIblBindGroupDescriptorPlan(options: CreateStandardMaterialIblBindGroupDescriptorPlanOptions): StandardMaterialIblBindGroupDescriptorPlan;
export declare function createStandardMaterialIblBindGroupDescriptorReadinessReport(options: CreateStandardMaterialIblBindGroupDescriptorReadinessOptions): StandardMaterialIblBindGroupDescriptorReadinessReport;
export declare function createStandardMaterialIblBindGroupResourceReport(options: CreateStandardMaterialIblBindGroupResourceReportOptions): StandardMaterialIblBindGroupResourceReport;
export declare function standardMaterialIblBindGroupResourceReportToJsonValue(report: StandardMaterialIblBindGroupResourceReport): StandardMaterialIblBindGroupResourceReportJsonValue;
export declare function standardMaterialIblBindGroupResourceReportToJson(report: StandardMaterialIblBindGroupResourceReport): string;
export declare function standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue(report: StandardMaterialIblBindGroupDescriptorReadinessReport): StandardMaterialIblBindGroupDescriptorReadinessReportJsonValue;
export declare function standardMaterialIblBindGroupDescriptorReadinessReportToJson(report: StandardMaterialIblBindGroupDescriptorReadinessReport): string;
export declare function createStandardMaterialIblBindGroupResourceKey(entries: readonly StandardMaterialIblBindGroupDescriptorEntry[]): string;
//# sourceMappingURL=standard-material-ibl-bind-group.d.ts.map