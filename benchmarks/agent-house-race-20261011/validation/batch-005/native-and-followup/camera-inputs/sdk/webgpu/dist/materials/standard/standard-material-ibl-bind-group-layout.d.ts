import type { StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";
export type StandardMaterialIblShaderVisibility = "vertex" | "fragment" | "compute";
export type StandardMaterialIblBindGroupLayoutStatus = "available" | "missing" | "not-required";
export interface StandardMaterialIblBindGroupLayoutBindingMetadata {
    readonly binding: number;
    readonly name: string;
    readonly resourceKind: StandardMaterialBindGroupResourceKind;
    readonly visibility: readonly StandardMaterialIblShaderVisibility[];
    readonly required: boolean;
}
export interface StandardMaterialIblBindGroupLayoutMetadata {
    readonly group: 4;
    readonly name: "standardMaterialIbl";
    readonly layoutKey: string;
    readonly bindings: readonly StandardMaterialIblBindGroupLayoutBindingMetadata[];
}
export interface StandardMaterialIblBindGroupLayoutEntry {
    readonly binding: number;
    readonly label: string;
    readonly resource: "uniform-buffer" | "texture" | "sampler";
}
export interface StandardMaterialIblBindGroupLayoutDescriptor {
    readonly group: 4;
    readonly label: string;
    readonly entries: readonly StandardMaterialIblBindGroupLayoutEntry[];
    readonly metadata: StandardMaterialIblBindGroupLayoutMetadata;
}
export type StandardMaterialIblBindGroupLayoutDiagnosticCode = "standardMaterialIblBindGroupLayout.invalidGroup" | "standardMaterialIblBindGroupLayout.missingBinding" | "standardMaterialIblBindGroupLayout.resourceKindMismatch";
export interface StandardMaterialIblBindGroupLayoutDiagnostic {
    readonly code: StandardMaterialIblBindGroupLayoutDiagnosticCode;
    readonly message: string;
    readonly binding?: number;
}
export interface StandardMaterialIblBindGroupLayoutPlan {
    readonly valid: boolean;
    readonly layout: StandardMaterialIblBindGroupLayoutDescriptor;
    readonly diagnostics: readonly StandardMaterialIblBindGroupLayoutDiagnostic[];
}
export interface StandardMaterialIblBindGroupLayoutReadinessDiagnostic {
    readonly code: "standardMaterialIblBindGroupLayout.invalidLayout";
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface StandardMaterialIblBindGroupLayoutReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialIblBindGroupLayoutStatus;
    readonly standardMaterialCount: number;
    readonly group: 4;
    readonly bindingCount: number;
    readonly sections: {
        readonly layoutMetadata: boolean;
        readonly layoutDescriptor: boolean;
    };
    readonly layout: StandardMaterialIblBindGroupLayoutDescriptor | null;
    readonly diagnostics: readonly StandardMaterialIblBindGroupLayoutReadinessDiagnostic[];
}
export type StandardMaterialIblBindGroupLayoutReadinessReportJsonValue = StandardMaterialIblBindGroupLayoutReadinessReport;
export interface StandardMaterialIblBindGroupLayoutReadinessInput {
    readonly standardMaterialCount: number;
    readonly layoutKey?: string;
    readonly plan?: StandardMaterialIblBindGroupLayoutPlan;
}
export declare function createStandardMaterialIblBindGroupLayoutMetadata(layoutKey?: string): StandardMaterialIblBindGroupLayoutMetadata;
export declare function createStandardMaterialIblBindGroupLayoutPlan(layoutKey?: string): StandardMaterialIblBindGroupLayoutPlan;
export declare function validateStandardMaterialIblBindGroupLayout(layout: {
    readonly group: number;
    readonly entries: readonly StandardMaterialIblBindGroupLayoutEntry[];
    readonly metadata?: StandardMaterialIblBindGroupLayoutMetadata;
}): readonly StandardMaterialIblBindGroupLayoutDiagnostic[];
export declare function createStandardMaterialIblBindGroupLayoutReadinessReport(input: StandardMaterialIblBindGroupLayoutReadinessInput): StandardMaterialIblBindGroupLayoutReadinessReport;
export declare function standardMaterialIblBindGroupLayoutReadinessReportToJsonValue(report: StandardMaterialIblBindGroupLayoutReadinessReport): StandardMaterialIblBindGroupLayoutReadinessReportJsonValue;
export declare function standardMaterialIblBindGroupLayoutReadinessReportToJson(report: StandardMaterialIblBindGroupLayoutReadinessReport): string;
//# sourceMappingURL=standard-material-ibl-bind-group-layout.d.ts.map