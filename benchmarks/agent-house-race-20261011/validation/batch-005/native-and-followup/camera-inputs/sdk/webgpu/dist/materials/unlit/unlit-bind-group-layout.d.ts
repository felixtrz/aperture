import { type BuiltInShaderBindingMetadata, type BuiltInShaderSourceModule } from "./unlit-shader.js";
import { type UnlitBindGroupLayoutMetadata } from "./unlit-bind-group.js";
export type UnlitBindGroupLayoutDiagnosticCode = "unlitBindGroupLayout.missingBinding" | "unlitBindGroupLayout.unsupportedResource";
export interface UnlitBindGroupLayoutDiagnostic {
    readonly code: UnlitBindGroupLayoutDiagnosticCode;
    readonly message: string;
    readonly bindingId?: string;
}
export interface UnlitBindGroupLayoutEntry {
    readonly binding: number;
    readonly label: string;
    readonly resource: BuiltInShaderBindingMetadata["resource"];
}
export interface UnlitBindGroupLayoutDescriptor {
    readonly group: number;
    readonly label: string;
    readonly entries: readonly UnlitBindGroupLayoutEntry[];
    readonly metadata: UnlitBindGroupLayoutMetadata;
}
export interface UnlitBindGroupLayoutPlan {
    readonly layouts: readonly UnlitBindGroupLayoutDescriptor[];
    readonly diagnostics: readonly UnlitBindGroupLayoutDiagnostic[];
    readonly valid: boolean;
}
export declare function createUnlitBindGroupLayoutPlan(shader?: BuiltInShaderSourceModule): UnlitBindGroupLayoutPlan;
//# sourceMappingURL=unlit-bind-group-layout.d.ts.map