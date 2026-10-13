import type { StandardMaterialResourceDependencies } from "./standard-material-buffer.js";
import { type StandardMaterialBindGroupLayoutDescriptor } from "./standard-bind-group-layout.js";
export type StandardMaterialBindGroupResourceKind = "buffer" | "texture-view" | "sampler";
export type StandardMaterialTextureSlot = "baseColor" | "metallicRoughness" | "normal" | "occlusion" | "emissive" | "clearcoat" | "clearcoatRoughness" | "transmission" | "sheenColor" | "sheenRoughness" | "iridescence" | "iridescenceThickness";
export type StandardMaterialBindGroupDescriptorDiagnosticCode = "standardMaterialBindGroup.missingMaterialResource" | "standardMaterialBindGroup.missingTextureResource" | "standardMaterialBindGroup.missingSamplerResource";
export interface StandardMaterialBindGroupDescriptorDiagnostic {
    readonly code: StandardMaterialBindGroupDescriptorDiagnosticCode;
    readonly message: string;
    readonly slot?: StandardMaterialTextureSlot;
    readonly binding?: number;
}
export interface StandardMaterialBindGroupResourceInput {
    readonly materialResourceKey: string | null;
    readonly dependencies: StandardMaterialResourceDependencies;
}
export interface StandardMaterialBindGroupDescriptorEntry {
    readonly group: 2;
    readonly binding: number;
    readonly resourceKey: string;
    readonly resourceKind: StandardMaterialBindGroupResourceKind;
}
export interface StandardMaterialBindGroupDescriptorPlan {
    readonly valid: boolean;
    readonly group: 2;
    readonly resourceKey: string | null;
    readonly entries: readonly StandardMaterialBindGroupDescriptorEntry[];
    readonly diagnostics: readonly StandardMaterialBindGroupDescriptorDiagnostic[];
}
export type StandardMaterialBindGroupResourceDiagnosticCode = "standardMaterialBindGroupResource.nullDescriptorPlan" | "standardMaterialBindGroupResource.invalidDescriptorPlan" | "standardMaterialBindGroupResource.missingLayout" | "standardMaterialBindGroupResource.invalidLayout" | "standardMaterialBindGroupResource.missingDeviceSupport" | "standardMaterialBindGroupResource.missingBufferResource" | "standardMaterialBindGroupResource.missingTextureResource" | "standardMaterialBindGroupResource.missingSamplerResource" | "standardMaterialBindGroupResource.creationFailed";
export interface StandardMaterialBindGroupResourceDiagnostic {
    readonly code: StandardMaterialBindGroupResourceDiagnosticCode;
    readonly message: string;
    readonly group?: 2;
    readonly binding?: number;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface StandardMaterialBindGroupLayoutResource {
    readonly group: number;
    readonly layoutKey: string;
    readonly layout: unknown;
    readonly descriptor?: StandardMaterialBindGroupLayoutDescriptor;
}
export interface StandardMaterialBindGroupBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
}
export interface StandardMaterialBindGroupTextureResource {
    readonly resourceKey: string;
    readonly view: unknown;
}
export interface StandardMaterialBindGroupSamplerResource {
    readonly resourceKey: string;
    readonly sampler: unknown;
}
export interface StandardMaterialBindGroupCreationEntry {
    readonly binding: number;
    readonly resource: unknown;
}
export interface StandardMaterialBindGroupCreationDescriptor {
    readonly label: string;
    readonly layout: unknown;
    readonly entries: readonly StandardMaterialBindGroupCreationEntry[];
}
export interface StandardMaterialBindGroupDeviceLike {
    createBindGroup?: (descriptor: StandardMaterialBindGroupCreationDescriptor) => unknown;
}
export interface StandardMaterialBindGroupResource {
    readonly group: 2;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface CreateStandardMaterialBindGroupResourceOptions {
    readonly device: StandardMaterialBindGroupDeviceLike;
    readonly plan: StandardMaterialBindGroupDescriptorPlan | null;
    readonly layout: StandardMaterialBindGroupLayoutResource | null;
    readonly buffers: readonly StandardMaterialBindGroupBufferResource[];
    readonly textures?: readonly StandardMaterialBindGroupTextureResource[];
    readonly samplers?: readonly StandardMaterialBindGroupSamplerResource[];
}
export interface CreateStandardMaterialBindGroupResourceResult {
    readonly valid: boolean;
    readonly resource: StandardMaterialBindGroupResource | null;
    readonly diagnostics: readonly StandardMaterialBindGroupResourceDiagnostic[];
}
export declare function createStandardMaterialBindGroupDescriptorPlan(input: StandardMaterialBindGroupResourceInput): StandardMaterialBindGroupDescriptorPlan;
export declare function createStandardMaterialBindGroupResourceKey(entries: readonly StandardMaterialBindGroupDescriptorEntry[]): string;
export declare function createStandardMaterialBindGroupResource(options: CreateStandardMaterialBindGroupResourceOptions): CreateStandardMaterialBindGroupResourceResult;
//# sourceMappingURL=standard-bind-group.d.ts.map