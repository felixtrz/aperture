import type { StandardMaterialBindGroupResourceKind } from "./standard-bind-group.js";
export type StandardMaterialShaderVisibility = "vertex" | "fragment" | "compute";
export interface StandardMaterialBindGroupLayoutBindingMetadata {
    readonly binding: number;
    readonly name: string;
    readonly resourceKind: StandardMaterialBindGroupResourceKind;
    readonly visibility: readonly StandardMaterialShaderVisibility[];
    readonly required: boolean;
}
export interface StandardMaterialBindGroupLayoutMetadata {
    readonly group: number;
    readonly name: string;
    readonly layoutKey: string;
    readonly bindings: readonly StandardMaterialBindGroupLayoutBindingMetadata[];
}
export interface StandardMaterialBindGroupLayoutEntry {
    readonly binding: number;
    readonly label: string;
    readonly resource: "uniform-buffer" | "texture" | "sampler";
}
export interface StandardMaterialBindGroupLayoutDescriptor {
    readonly group: 2;
    readonly label: string;
    readonly entries: readonly StandardMaterialBindGroupLayoutEntry[];
    readonly metadata: StandardMaterialBindGroupLayoutMetadata;
}
export type StandardMaterialBindGroupLayoutDiagnosticCode = "standardMaterialBindGroupLayout.invalidGroup" | "standardMaterialBindGroupLayout.missingBinding" | "standardMaterialBindGroupLayout.resourceKindMismatch";
export interface StandardMaterialBindGroupLayoutDiagnostic {
    readonly code: StandardMaterialBindGroupLayoutDiagnosticCode;
    readonly message: string;
    readonly binding?: number;
}
export interface StandardMaterialBindGroupLayoutPlan {
    readonly valid: boolean;
    readonly layout: StandardMaterialBindGroupLayoutDescriptor;
    readonly diagnostics: readonly StandardMaterialBindGroupLayoutDiagnostic[];
}
export declare function createStandardMaterialBindGroupLayoutMetadata(layoutKey?: string): StandardMaterialBindGroupLayoutMetadata;
export declare function createStandardMaterialBindGroupLayoutPlan(layoutKey?: string): StandardMaterialBindGroupLayoutPlan;
export declare function validateStandardMaterialBindGroupLayout(layout: {
    readonly group: number;
    readonly entries: readonly StandardMaterialBindGroupLayoutEntry[];
    readonly metadata?: StandardMaterialBindGroupLayoutMetadata;
}): readonly StandardMaterialBindGroupLayoutDiagnostic[];
//# sourceMappingURL=standard-bind-group-layout.d.ts.map