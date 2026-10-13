import type { DebugNormalMaterialBindGroupResourceKind } from "./debug-normal-bind-group.js";
export type DebugNormalMaterialShaderVisibility = "vertex" | "fragment" | "compute";
export interface DebugNormalMaterialBindGroupLayoutBindingMetadata {
    readonly binding: number;
    readonly name: string;
    readonly resourceKind: DebugNormalMaterialBindGroupResourceKind;
    readonly visibility: readonly DebugNormalMaterialShaderVisibility[];
    readonly required: boolean;
}
export interface DebugNormalMaterialBindGroupLayoutMetadata {
    readonly group: number;
    readonly name: string;
    readonly layoutKey: string;
    readonly bindings: readonly DebugNormalMaterialBindGroupLayoutBindingMetadata[];
}
export interface DebugNormalMaterialBindGroupLayoutEntry {
    readonly binding: number;
    readonly label: string;
    readonly resource: "uniform-buffer";
}
export interface DebugNormalMaterialBindGroupLayoutDescriptor {
    readonly group: 2;
    readonly label: string;
    readonly entries: readonly DebugNormalMaterialBindGroupLayoutEntry[];
    readonly metadata: DebugNormalMaterialBindGroupLayoutMetadata;
}
export type DebugNormalMaterialBindGroupLayoutDiagnosticCode = "debugNormalMaterialBindGroupLayout.invalidGroup" | "debugNormalMaterialBindGroupLayout.missingBinding" | "debugNormalMaterialBindGroupLayout.resourceKindMismatch";
export interface DebugNormalMaterialBindGroupLayoutDiagnostic {
    readonly code: DebugNormalMaterialBindGroupLayoutDiagnosticCode;
    readonly message: string;
    readonly binding?: number;
}
export interface DebugNormalMaterialBindGroupLayoutPlan {
    readonly valid: boolean;
    readonly layout: DebugNormalMaterialBindGroupLayoutDescriptor;
    readonly diagnostics: readonly DebugNormalMaterialBindGroupLayoutDiagnostic[];
}
export declare function createDebugNormalMaterialBindGroupLayoutMetadata(layoutKey?: string): DebugNormalMaterialBindGroupLayoutMetadata;
export declare function createDebugNormalMaterialBindGroupLayoutPlan(layoutKey?: string): DebugNormalMaterialBindGroupLayoutPlan;
export declare function validateDebugNormalMaterialBindGroupLayout(layout: {
    readonly group: number;
    readonly entries: readonly DebugNormalMaterialBindGroupLayoutEntry[];
    readonly metadata?: DebugNormalMaterialBindGroupLayoutMetadata;
}): readonly DebugNormalMaterialBindGroupLayoutDiagnostic[];
//# sourceMappingURL=debug-normal-bind-group-layout.d.ts.map