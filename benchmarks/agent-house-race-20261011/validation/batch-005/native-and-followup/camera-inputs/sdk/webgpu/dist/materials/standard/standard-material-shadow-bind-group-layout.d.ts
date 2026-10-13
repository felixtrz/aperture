import type { StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";
export type StandardMaterialShadowShaderVisibility = "vertex" | "fragment" | "compute";
export type StandardMaterialShadowBindGroupLayoutStatus = "deferred" | "missing" | "not-required";
export interface StandardMaterialShadowBindGroupLayoutBindingMetadata {
    readonly binding: number;
    readonly name: string;
    readonly resourceKind: StandardMaterialBindGroupResourceKind;
    readonly visibility: readonly StandardMaterialShadowShaderVisibility[];
    readonly required: boolean;
}
export interface StandardMaterialShadowBindGroupLayoutMetadata {
    readonly group: 5;
    readonly name: "standardMaterialShadow";
    readonly layoutKey: string;
    readonly bindings: readonly StandardMaterialShadowBindGroupLayoutBindingMetadata[];
}
export interface StandardMaterialShadowBindGroupLayoutEntry {
    readonly binding: number;
    readonly label: string;
    readonly resource: "read-only-storage-buffer" | "texture" | "sampler";
}
export interface StandardMaterialShadowBindGroupLayoutDescriptor {
    readonly group: 5;
    readonly label: string;
    readonly entries: readonly StandardMaterialShadowBindGroupLayoutEntry[];
    readonly metadata: StandardMaterialShadowBindGroupLayoutMetadata;
}
export type StandardMaterialShadowBindGroupLayoutDiagnosticCode = "standardMaterialShadowBindGroupLayout.invalidGroup" | "standardMaterialShadowBindGroupLayout.missingBinding" | "standardMaterialShadowBindGroupLayout.resourceKindMismatch";
export interface StandardMaterialShadowBindGroupLayoutDiagnostic {
    readonly code: StandardMaterialShadowBindGroupLayoutDiagnosticCode;
    readonly message: string;
    readonly binding?: number;
}
export interface StandardMaterialShadowBindGroupLayoutPlan {
    readonly valid: boolean;
    readonly layout: StandardMaterialShadowBindGroupLayoutDescriptor;
    readonly diagnostics: readonly StandardMaterialShadowBindGroupLayoutDiagnostic[];
}
export interface StandardMaterialShadowBindGroupLayoutReadinessDiagnostic {
    readonly code: "standardMaterialShadowBindGroupLayout.invalidLayout" | "standardMaterialShadowBindGroupLayout.bindGroupResourceDeferred" | "standardMaterialShadowBindGroupLayout.shaderSamplingDeferred";
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface StandardMaterialShadowBindGroupLayoutReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialShadowBindGroupLayoutStatus;
    readonly standardMaterialCount: number;
    readonly group: 5;
    readonly bindingCount: number;
    readonly sections: {
        readonly layoutMetadata: boolean;
        readonly layoutDescriptor: boolean;
        readonly bindGroupResource: false;
        readonly shaderSampling: false;
    };
    readonly layout: StandardMaterialShadowBindGroupLayoutDescriptor | null;
    readonly diagnostics: readonly StandardMaterialShadowBindGroupLayoutReadinessDiagnostic[];
}
export type StandardMaterialShadowBindGroupLayoutReadinessReportJsonValue = StandardMaterialShadowBindGroupLayoutReadinessReport;
export interface StandardMaterialShadowBindGroupLayoutReadinessInput {
    readonly standardMaterialCount: number;
    readonly layoutKey?: string;
    readonly plan?: StandardMaterialShadowBindGroupLayoutPlan;
}
export declare function createStandardMaterialShadowBindGroupLayoutMetadata(layoutKey?: string): StandardMaterialShadowBindGroupLayoutMetadata;
export declare function createStandardMaterialShadowBindGroupLayoutPlan(layoutKey?: string): StandardMaterialShadowBindGroupLayoutPlan;
export declare function validateStandardMaterialShadowBindGroupLayout(layout: {
    readonly group: number;
    readonly entries: readonly StandardMaterialShadowBindGroupLayoutEntry[];
    readonly metadata?: StandardMaterialShadowBindGroupLayoutMetadata;
}): readonly StandardMaterialShadowBindGroupLayoutDiagnostic[];
export declare function createStandardMaterialShadowBindGroupLayoutReadinessReport(input: StandardMaterialShadowBindGroupLayoutReadinessInput): StandardMaterialShadowBindGroupLayoutReadinessReport;
export declare function standardMaterialShadowBindGroupLayoutReadinessReportToJsonValue(report: StandardMaterialShadowBindGroupLayoutReadinessReport): StandardMaterialShadowBindGroupLayoutReadinessReportJsonValue;
export declare function standardMaterialShadowBindGroupLayoutReadinessReportToJson(report: StandardMaterialShadowBindGroupLayoutReadinessReport): string;
//# sourceMappingURL=standard-material-shadow-bind-group-layout.d.ts.map