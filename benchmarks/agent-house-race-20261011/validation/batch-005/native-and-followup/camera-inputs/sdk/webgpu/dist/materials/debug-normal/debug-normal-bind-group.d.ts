import { type DebugNormalMaterialBindGroupLayoutDescriptor } from "./debug-normal-bind-group-layout.js";
export type DebugNormalMaterialBindGroupResourceKind = "buffer";
export type DebugNormalMaterialBindGroupDescriptorDiagnosticCode = "debugNormalMaterialBindGroup.missingMaterialResource";
export interface DebugNormalMaterialBindGroupDescriptorDiagnostic {
    readonly code: DebugNormalMaterialBindGroupDescriptorDiagnosticCode;
    readonly message: string;
    readonly binding?: number;
}
export interface DebugNormalMaterialBindGroupResourceInput {
    readonly materialResourceKey: string | null;
}
export interface DebugNormalMaterialBindGroupDescriptorEntry {
    readonly group: 2;
    readonly binding: number;
    readonly resourceKey: string;
    readonly resourceKind: DebugNormalMaterialBindGroupResourceKind;
}
export interface DebugNormalMaterialBindGroupDescriptorPlan {
    readonly valid: boolean;
    readonly group: 2;
    readonly resourceKey: string | null;
    readonly entries: readonly DebugNormalMaterialBindGroupDescriptorEntry[];
    readonly diagnostics: readonly DebugNormalMaterialBindGroupDescriptorDiagnostic[];
}
export type DebugNormalMaterialBindGroupResourceDiagnosticCode = "debugNormalMaterialBindGroupResource.nullDescriptorPlan" | "debugNormalMaterialBindGroupResource.invalidDescriptorPlan" | "debugNormalMaterialBindGroupResource.missingLayout" | "debugNormalMaterialBindGroupResource.invalidLayout" | "debugNormalMaterialBindGroupResource.missingDeviceSupport" | "debugNormalMaterialBindGroupResource.missingBufferResource" | "debugNormalMaterialBindGroupResource.creationFailed";
export interface DebugNormalMaterialBindGroupResourceDiagnostic {
    readonly code: DebugNormalMaterialBindGroupResourceDiagnosticCode;
    readonly message: string;
    readonly group?: 2;
    readonly binding?: number;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface DebugNormalMaterialBindGroupLayoutResource {
    readonly group: number;
    readonly layoutKey: string;
    readonly layout: unknown;
    readonly descriptor?: DebugNormalMaterialBindGroupLayoutDescriptor;
}
export interface DebugNormalMaterialBindGroupBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
}
export interface DebugNormalMaterialBindGroupCreationEntry {
    readonly binding: number;
    readonly resource: unknown;
}
export interface DebugNormalMaterialBindGroupCreationDescriptor {
    readonly label: string;
    readonly layout: unknown;
    readonly entries: readonly DebugNormalMaterialBindGroupCreationEntry[];
}
export interface DebugNormalMaterialBindGroupDeviceLike {
    createBindGroup?: (descriptor: DebugNormalMaterialBindGroupCreationDescriptor) => unknown;
}
export interface DebugNormalMaterialBindGroupResource {
    readonly group: 2;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface DebugNormalMaterialBindGroupResourceJsonValue {
    readonly group: 2;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly entryResourceKeys: readonly string[];
}
export interface CreateDebugNormalMaterialBindGroupResourceOptions {
    readonly device: DebugNormalMaterialBindGroupDeviceLike;
    readonly plan: DebugNormalMaterialBindGroupDescriptorPlan | null;
    readonly layout: DebugNormalMaterialBindGroupLayoutResource | null;
    readonly buffers: readonly DebugNormalMaterialBindGroupBufferResource[];
}
export interface CreateDebugNormalMaterialBindGroupResourceResult {
    readonly valid: boolean;
    readonly resource: DebugNormalMaterialBindGroupResource | null;
    readonly diagnostics: readonly DebugNormalMaterialBindGroupResourceDiagnostic[];
}
export declare function createDebugNormalMaterialBindGroupDescriptorPlan(input: DebugNormalMaterialBindGroupResourceInput): DebugNormalMaterialBindGroupDescriptorPlan;
export declare function createDebugNormalMaterialBindGroupResourceKey(entries: readonly DebugNormalMaterialBindGroupDescriptorEntry[]): string;
export declare function createDebugNormalMaterialBindGroupResource(options: CreateDebugNormalMaterialBindGroupResourceOptions): CreateDebugNormalMaterialBindGroupResourceResult;
export declare function debugNormalMaterialBindGroupResourceToJsonValue(resource: DebugNormalMaterialBindGroupResource): DebugNormalMaterialBindGroupResourceJsonValue;
//# sourceMappingURL=debug-normal-bind-group.d.ts.map