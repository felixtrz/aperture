import type { BuiltInShaderBindingResource } from "../materials/unlit/unlit-shader.js";
import type { WebGpuBindGroupLayoutDescriptor } from "../gpu/bind-group-layout-cache.js";
import type { RenderResourceSummaryDiagnostic } from "../resources/core/resource-summary.js";
export type LightShaderBindingId = "lightFloats" | "lightMetadata";
export interface LightShaderBindingMetadata {
    readonly id: LightShaderBindingId;
    readonly label: string;
    readonly group: number;
    readonly binding: number;
    readonly resource: BuiltInShaderBindingResource;
}
export interface LightShaderBindingMetadataContract {
    readonly group: number;
    readonly bindings: readonly LightShaderBindingMetadata[];
}
export interface LightShaderWgslStorageBinding {
    readonly id: LightShaderBindingId;
    readonly group: number;
    readonly binding: number;
    readonly addressSpace: "storage";
    readonly accessMode: "read";
    readonly elementType: "f32" | "i32";
}
export interface LightShaderWgslDeclarationContract {
    readonly group: number;
    readonly floatStride: number;
    readonly metadataStride: number;
    readonly bindings: readonly LightShaderWgslStorageBinding[];
    readonly source: string;
}
export interface LightShaderWgslDeclarationContractJsonValue {
    readonly group: number;
    readonly strides: {
        readonly floats: number;
        readonly metadata: number;
    };
    readonly bindings: readonly LightShaderWgslStorageBinding[];
    readonly source: string;
}
export declare const LIGHT_SHADER_BINDING_METADATA: LightShaderBindingMetadataContract;
export declare const LIGHT_SHADER_WGSL_DECLARATION: LightShaderWgslDeclarationContract;
export declare function createLightShaderWgslDeclarationContract(metadata?: LightShaderBindingMetadataContract): LightShaderWgslDeclarationContract;
export declare function lightShaderWgslDeclarationContractToJsonValue(contract?: LightShaderWgslDeclarationContract): LightShaderWgslDeclarationContractJsonValue;
export declare function lightShaderWgslDeclarationContractToJson(contract?: LightShaderWgslDeclarationContract): string;
export type LightShaderBindingValidationDiagnosticCode = "lightShaderBinding.missingBinding" | "lightShaderBinding.resourceMismatch";
export interface LightShaderBindingValidationDiagnostic {
    readonly code: LightShaderBindingValidationDiagnosticCode;
    readonly message: string;
    readonly bindingId?: LightShaderBindingId;
    readonly binding?: number;
}
export interface LightShaderBindingValidationReport {
    readonly valid: boolean;
    readonly diagnostics: readonly LightShaderBindingValidationDiagnostic[];
}
export type LightShaderResourceReadinessDiagnosticCode = "lightShaderReadiness.missingLightGpuBuffers" | "lightShaderReadiness.missingLayout" | "lightShaderReadiness.missingBindGroup" | "lightShaderReadiness.metadataInvalid";
export interface LightShaderResourceReadinessDiagnostic {
    readonly code: LightShaderResourceReadinessDiagnosticCode;
    readonly message: string;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface LightShaderResourceReadinessInput {
    readonly lightGpuBufferResourceKey: string | null;
    readonly layoutKey: string | null;
    readonly bindGroupResourceKey: string | null;
    readonly metadata: LightShaderBindingValidationReport;
}
export interface LightShaderResourceReadinessReport {
    readonly ready: boolean;
    readonly sections: {
        readonly lightGpuBuffers: boolean;
        readonly layout: boolean;
        readonly bindGroup: boolean;
        readonly metadata: boolean;
    };
    readonly diagnostics: readonly LightShaderResourceReadinessDiagnostic[];
}
export interface LightShaderResourceReadinessReportJsonValue {
    readonly ready: boolean;
    readonly sections: LightShaderResourceReadinessReport["sections"];
    readonly diagnostics: readonly LightShaderResourceReadinessDiagnostic[];
}
export declare function validateLightBindGroupLayoutMetadata(layout: WebGpuBindGroupLayoutDescriptor, metadata?: LightShaderBindingMetadataContract): LightShaderBindingValidationReport;
export declare function createLightShaderResourceReadinessReport(input: LightShaderResourceReadinessInput): LightShaderResourceReadinessReport;
export declare function lightShaderResourceReadinessReportToJsonValue(report: LightShaderResourceReadinessReport): LightShaderResourceReadinessReportJsonValue;
export declare function lightShaderResourceReadinessReportToJson(report: LightShaderResourceReadinessReport): string;
export declare function lightShaderReadinessToResourceSummaryDiagnostics(report: LightShaderResourceReadinessReport): readonly RenderResourceSummaryDiagnostic[];
//# sourceMappingURL=light-shader-metadata.d.ts.map