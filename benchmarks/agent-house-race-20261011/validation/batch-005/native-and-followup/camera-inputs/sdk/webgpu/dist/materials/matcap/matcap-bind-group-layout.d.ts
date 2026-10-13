import type { MatcapMaterialBindGroupResourceKind } from "./matcap-bind-group.js";
export type MatcapMaterialShaderVisibility = "vertex" | "fragment" | "compute";
export interface MatcapMaterialBindGroupLayoutBindingMetadata {
    readonly binding: number;
    readonly name: string;
    readonly resourceKind: MatcapMaterialBindGroupResourceKind;
    readonly visibility: readonly MatcapMaterialShaderVisibility[];
    readonly required: boolean;
}
export interface MatcapMaterialBindGroupLayoutMetadata {
    readonly group: number;
    readonly name: string;
    readonly layoutKey: string;
    readonly bindings: readonly MatcapMaterialBindGroupLayoutBindingMetadata[];
}
export interface MatcapMaterialBindGroupLayoutEntry {
    readonly binding: number;
    readonly label: string;
    readonly resource: "uniform-buffer" | "texture" | "sampler";
}
export interface MatcapMaterialBindGroupLayoutDescriptor {
    readonly group: 2;
    readonly label: string;
    readonly entries: readonly MatcapMaterialBindGroupLayoutEntry[];
    readonly metadata: MatcapMaterialBindGroupLayoutMetadata;
}
export type MatcapMaterialBindGroupLayoutDiagnosticCode = "matcapMaterialBindGroupLayout.invalidGroup" | "matcapMaterialBindGroupLayout.missingBinding" | "matcapMaterialBindGroupLayout.resourceKindMismatch";
export interface MatcapMaterialBindGroupLayoutDiagnostic {
    readonly code: MatcapMaterialBindGroupLayoutDiagnosticCode;
    readonly message: string;
    readonly binding?: number;
}
export interface MatcapMaterialBindGroupLayoutPlan {
    readonly valid: boolean;
    readonly layout: MatcapMaterialBindGroupLayoutDescriptor;
    readonly diagnostics: readonly MatcapMaterialBindGroupLayoutDiagnostic[];
}
export declare function createMatcapMaterialBindGroupLayoutMetadata(layoutKey?: string): MatcapMaterialBindGroupLayoutMetadata;
export declare function createMatcapMaterialBindGroupLayoutPlan(layoutKey?: string): MatcapMaterialBindGroupLayoutPlan;
export declare function validateMatcapMaterialBindGroupLayout(layout: {
    readonly group: number;
    readonly entries: readonly MatcapMaterialBindGroupLayoutEntry[];
    readonly metadata?: MatcapMaterialBindGroupLayoutMetadata;
}): readonly MatcapMaterialBindGroupLayoutDiagnostic[];
//# sourceMappingURL=matcap-bind-group-layout.d.ts.map