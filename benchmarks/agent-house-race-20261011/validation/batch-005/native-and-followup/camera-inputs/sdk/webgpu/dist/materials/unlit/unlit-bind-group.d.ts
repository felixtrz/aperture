import { type BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
export type UnlitBindGroupDescriptorDiagnosticCode = "unlitBindGroup.missingViewResource" | "unlitBindGroup.missingTransformResource" | "unlitBindGroup.missingMaterialResource" | "unlitBindGroup.missingBaseColorTextureResource" | "unlitBindGroup.missingBaseColorSamplerResource";
export interface UnlitBindGroupDescriptorDiagnostic {
    readonly code: UnlitBindGroupDescriptorDiagnosticCode;
    readonly message: string;
}
export interface UnlitBindGroupResourceInput {
    readonly viewUniformResourceKey: string | null;
    readonly worldTransformResourceKey: string | null;
    readonly previousWorldTransformResourceKey?: string | null;
    readonly materialResourceKey: string | null;
    readonly baseColorTextureResourceKey?: string | null;
    readonly baseColorSamplerResourceKey?: string | null;
}
export type UnlitBindGroupResourceKind = "buffer" | "texture-view" | "sampler";
export type UnlitBindGroupShaderVisibility = "vertex" | "fragment" | "compute";
export interface UnlitBindGroupLayoutBindingMetadata {
    readonly binding: number;
    readonly name: string;
    readonly resourceKind: UnlitBindGroupResourceKind;
    readonly visibility: readonly UnlitBindGroupShaderVisibility[];
    readonly required: boolean;
}
export interface UnlitBindGroupLayoutMetadata {
    readonly group: number;
    readonly name: string;
    readonly layoutKey: string;
    readonly bindings: readonly UnlitBindGroupLayoutBindingMetadata[];
}
export interface UnlitBindGroupDescriptorEntry {
    readonly group: number;
    readonly binding: number;
    readonly resourceKey: string;
    readonly resourceKind: UnlitBindGroupResourceKind;
}
export interface UnlitBindGroupDescriptorPlan {
    readonly valid: boolean;
    readonly entries: readonly UnlitBindGroupDescriptorEntry[];
    readonly diagnostics: readonly UnlitBindGroupDescriptorDiagnostic[];
}
export type UnlitBindGroupResourceDiagnosticCode = "unlitBindGroupResource.nullDescriptorPlan" | "unlitBindGroupResource.invalidDescriptorPlan" | "unlitBindGroupResource.missingLayout" | "unlitBindGroupResource.skippedRequiredGroup" | "unlitBindGroupResource.duplicateBinding" | "unlitBindGroupResource.missingRequiredBinding" | "unlitBindGroupResource.resourceKindMismatch" | "unlitBindGroupResource.missingDeviceSupport" | "unlitBindGroupResource.missingBufferResource" | "unlitBindGroupResource.missingTextureResource" | "unlitBindGroupResource.missingSamplerResource";
export interface UnlitBindGroupResourceDiagnostic {
    readonly code: UnlitBindGroupResourceDiagnosticCode;
    readonly message: string;
    readonly group?: number;
    readonly binding?: number;
    readonly resourceKey?: string;
}
export interface UnlitBindGroupLayoutResource {
    readonly group: number;
    readonly layoutKey: string;
    readonly layout: unknown;
    readonly metadata?: UnlitBindGroupLayoutMetadata;
}
export interface UnlitBindGroupCreationEntry {
    readonly binding: number;
    readonly resource: unknown;
}
export interface UnlitBindGroupCreationDescriptor {
    readonly label: string;
    readonly layout: unknown;
    readonly entries: readonly UnlitBindGroupCreationEntry[];
}
export interface UnlitBindGroupDeviceLike {
    createBindGroup?: (descriptor: UnlitBindGroupCreationDescriptor) => unknown;
}
export interface UnlitBindGroupResource {
    readonly group: number;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface CreateUnlitBindGroupsOptions {
    readonly device: UnlitBindGroupDeviceLike;
    readonly plan: UnlitBindGroupDescriptorPlan | null;
    readonly layouts: readonly UnlitBindGroupLayoutResource[];
    readonly requiredGroups?: readonly number[];
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
}
export interface UnlitBindGroupBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
}
export interface UnlitBindGroupTextureResource {
    readonly resourceKey: string;
    readonly view: unknown;
}
export interface UnlitBindGroupSamplerResource {
    readonly resourceKey: string;
    readonly sampler: unknown;
}
export interface CreateUnlitBindGroupsFromBuffersOptions {
    readonly device: UnlitBindGroupDeviceLike;
    readonly plan: UnlitBindGroupDescriptorPlan | null;
    readonly layouts: readonly UnlitBindGroupLayoutResource[];
    readonly buffers: readonly UnlitBindGroupBufferResource[];
    readonly requiredGroups?: readonly number[];
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
}
export interface CreateUnlitBindGroupsFromGpuResourcesOptions extends CreateUnlitBindGroupsFromBuffersOptions {
    readonly textures?: readonly UnlitBindGroupTextureResource[] | undefined;
    readonly samplers?: readonly UnlitBindGroupSamplerResource[] | undefined;
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
}
export interface CreateUnlitBindGroupsResult {
    readonly valid: boolean;
    readonly resources: readonly UnlitBindGroupResource[];
    readonly createdBindGroupCount: number;
    readonly reusedBindGroupCount: number;
    readonly diagnostics: readonly UnlitBindGroupResourceDiagnostic[];
}
export declare function createUnlitBindGroupDescriptorPlan(input: UnlitBindGroupResourceInput): UnlitBindGroupDescriptorPlan;
export declare function createUnlitBindGroups(options: CreateUnlitBindGroupsOptions): CreateUnlitBindGroupsResult;
export declare function createUnlitBindGroupsFromBuffers(options: CreateUnlitBindGroupsFromBuffersOptions): CreateUnlitBindGroupsResult;
export declare function createUnlitBindGroupsFromGpuResources(options: CreateUnlitBindGroupsFromGpuResourcesOptions): CreateUnlitBindGroupsResult;
export declare function createUnlitBindGroupLayoutMetadata(group: number, layoutKey?: string): UnlitBindGroupLayoutMetadata;
//# sourceMappingURL=unlit-bind-group.d.ts.map