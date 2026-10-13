import type { ShadowDepthTextureResourceReport } from "../../shadows/shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "../../shadows/shadow-matrix-buffer-resource.js";
import type { StandardMaterialBindGroupDeviceLike, StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";
import { type StandardMaterialShadowBindGroupLayoutPlan } from "./standard-material-shadow-bind-group-layout.js";
export { shadowSamplerResourceReportToJson, shadowSamplerResourceReportToJsonValue, standardMaterialShadowBindGroupDescriptorReadinessReportToJson, standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue, standardMaterialShadowBindGroupResourceReportToJson, standardMaterialShadowBindGroupResourceReportToJsonValue, type ShadowSamplerResourceReportJsonValue, type StandardMaterialShadowBindGroupDescriptorReadinessReportJsonValue, type StandardMaterialShadowBindGroupResourceReportJsonValue, } from "./standard-material-shadow-bind-group-report.js";
export type StandardMaterialShadowBindGroupDescriptorStatus = "deferred" | "missing" | "not-required";
export type StandardMaterialShadowBindGroupDescriptorDiagnosticCode = "standardMaterialShadowBindGroup.invalidLayout" | "standardMaterialShadowBindGroup.missingMatrixBufferResource" | "standardMaterialShadowBindGroup.missingDepthTextureResource" | "standardMaterialShadowBindGroup.unsupportedDepthTextureView" | "standardMaterialShadowBindGroup.missingSamplerResource" | "standardMaterialShadowBindGroup.samplerResourceDeferred" | "standardMaterialShadowBindGroup.bindGroupCreationDeferred" | "standardMaterialShadowBindGroup.shaderSamplingDeferred";
export type ShadowSamplerResourceDiagnosticCode = "shadowSamplerResource.createSamplerUnavailable" | "shadowSamplerResource.creationFailed" | "shadowSamplerResource.bindGroupDeferred" | "shadowSamplerResource.shaderSamplingDeferred";
export type StandardMaterialShadowBindGroupResourceDiagnosticCode = "standardMaterialShadowBindGroupResource.nullDescriptorPlan" | "standardMaterialShadowBindGroupResource.invalidDescriptorPlan" | "standardMaterialShadowBindGroupResource.invalidLayout" | "standardMaterialShadowBindGroupResource.missingDeviceSupport" | "standardMaterialShadowBindGroupResource.missingBufferResource" | "standardMaterialShadowBindGroupResource.missingTextureResource" | "standardMaterialShadowBindGroupResource.missingSamplerResource" | "standardMaterialShadowBindGroupResource.creationFailed" | "standardMaterialShadowBindGroupResource.passSubmissionDeferred" | "standardMaterialShadowBindGroupResource.shaderSamplingDeferred";
export interface StandardMaterialShadowBindGroupDescriptorDiagnostic {
    readonly code: StandardMaterialShadowBindGroupDescriptorDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly binding?: number;
    readonly resourceKey?: string;
}
export interface ShadowSamplerResourceDiagnostic {
    readonly code: ShadowSamplerResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey?: string;
}
export interface StandardMaterialShadowBindGroupResourceDiagnostic {
    readonly code: StandardMaterialShadowBindGroupResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly binding?: number;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface StandardMaterialShadowBindGroupDescriptorEntry {
    readonly group: 5;
    readonly binding: 0 | 1 | 2;
    readonly resourceKey: string;
    readonly resourceKind: Extract<StandardMaterialBindGroupResourceKind, "buffer" | "texture-view" | "sampler">;
}
export interface StandardMaterialShadowBindGroupDescriptorPlan {
    readonly valid: boolean;
    readonly group: 5;
    readonly resourceKey: string | null;
    readonly entries: readonly StandardMaterialShadowBindGroupDescriptorEntry[];
    readonly diagnostics: readonly StandardMaterialShadowBindGroupDescriptorDiagnostic[];
}
export interface ShadowSamplerDescriptor {
    readonly label: string;
    readonly addressModeU: "clamp-to-edge";
    readonly addressModeV: "clamp-to-edge";
    readonly addressModeW: "clamp-to-edge";
    readonly magFilter: "nearest";
    readonly minFilter: "nearest";
    readonly mipmapFilter: "nearest";
    readonly lodMinClamp: 0;
    readonly lodMaxClamp: 32;
    readonly compare: "less-equal";
}
export interface ShadowSamplerResource {
    readonly resourceKey: string;
    readonly sampler: unknown;
    readonly descriptor: ShadowSamplerDescriptor;
}
export interface ShadowSamplerResourceReport {
    readonly ready: boolean;
    readonly status: "available" | "missing";
    readonly createdSamplerCount: number;
    readonly reusedSamplerCount: number;
    readonly sections: {
        readonly samplerDescriptor: true;
        readonly samplerResource: boolean;
        readonly bindGroupResource: false;
        readonly shaderSampling: false;
    };
    readonly resource: ShadowSamplerResource | null;
    readonly diagnostics: readonly ShadowSamplerResourceDiagnostic[];
}
export interface StandardMaterialShadowBindGroupLayoutResource {
    readonly group: 5;
    readonly layoutKey: string;
    readonly layout: unknown;
}
export interface StandardMaterialShadowBindGroupResource {
    readonly group: 5;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface StandardMaterialShadowBindGroupResourceReport {
    readonly ready: boolean;
    readonly status: "available" | "missing" | "not-required";
    readonly standardMaterialCount: number;
    readonly group: 5;
    readonly createdBindGroupCount: number;
    readonly reusedBindGroupCount: number;
    readonly sections: {
        readonly descriptorPlan: boolean;
        readonly layoutResource: boolean;
        readonly matrixBufferResource: boolean;
        readonly depthTextureResource: boolean;
        readonly samplerResource: boolean;
        readonly bindGroupResource: boolean;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly resource: StandardMaterialShadowBindGroupResource | null;
    readonly diagnostics: readonly StandardMaterialShadowBindGroupResourceDiagnostic[];
}
export interface StandardMaterialShadowBindGroupDescriptorReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialShadowBindGroupDescriptorStatus;
    readonly standardMaterialCount: number;
    readonly group: 5;
    readonly entryCount: number;
    readonly sections: {
        readonly layoutMetadata: boolean;
        readonly descriptorPlan: boolean;
        readonly matrixBufferResource: boolean;
        readonly depthTextureResource: boolean;
        readonly samplerResource: boolean;
        readonly bindGroupResource: false;
        readonly shaderSampling: false;
    };
    readonly plan: StandardMaterialShadowBindGroupDescriptorPlan | null;
    readonly diagnostics: readonly StandardMaterialShadowBindGroupDescriptorDiagnostic[];
}
export interface CreateStandardMaterialShadowBindGroupDescriptorPlanOptions {
    readonly layout?: StandardMaterialShadowBindGroupLayoutPlan | null;
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource?: ShadowSamplerResourceReport | null;
    readonly samplerResourceKey?: string;
}
export interface CreateStandardMaterialShadowBindGroupDescriptorReadinessOptions extends CreateStandardMaterialShadowBindGroupDescriptorPlanOptions {
    readonly standardMaterialCount: number;
}
export interface CreateShadowSamplerResourceReportOptions {
    readonly device: ShadowSamplerDeviceLike;
    readonly resourceKey?: string;
    readonly cache?: Map<string, ShadowSamplerResource>;
}
export interface ShadowSamplerDeviceLike {
    readonly createSampler?: (descriptor: ShadowSamplerDescriptor) => unknown;
}
export interface CreateStandardMaterialShadowBindGroupResourceReportOptions {
    readonly device: StandardMaterialBindGroupDeviceLike & {
        createBindGroupLayout?: (descriptor: unknown) => unknown;
    };
    readonly standardMaterialCount: number;
    readonly descriptor: StandardMaterialShadowBindGroupDescriptorReadinessReport;
    readonly layout?: StandardMaterialShadowBindGroupLayoutPlan;
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource: ShadowSamplerResourceReport;
    readonly cache?: Map<string, StandardMaterialShadowBindGroupResource>;
}
export declare function createShadowSamplerResourceReport(options: CreateShadowSamplerResourceReportOptions): ShadowSamplerResourceReport;
export declare function createStandardMaterialShadowBindGroupDescriptorPlan(options: CreateStandardMaterialShadowBindGroupDescriptorPlanOptions): StandardMaterialShadowBindGroupDescriptorPlan;
export declare function createStandardMaterialShadowBindGroupDescriptorReadinessReport(options: CreateStandardMaterialShadowBindGroupDescriptorReadinessOptions): StandardMaterialShadowBindGroupDescriptorReadinessReport;
export declare function createStandardMaterialShadowBindGroupResourceReport(options: CreateStandardMaterialShadowBindGroupResourceReportOptions): StandardMaterialShadowBindGroupResourceReport;
export declare function createStandardMaterialShadowBindGroupResourceKey(entries: readonly StandardMaterialShadowBindGroupDescriptorEntry[]): string;
//# sourceMappingURL=standard-material-shadow-bind-group.d.ts.map