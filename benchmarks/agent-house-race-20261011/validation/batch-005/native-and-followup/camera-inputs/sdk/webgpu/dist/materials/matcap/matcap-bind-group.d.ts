import type { MatcapMaterialResourceDependencies } from "./matcap-material-buffer.js";
import { type MatcapMaterialBindGroupLayoutDescriptor } from "./matcap-bind-group-layout.js";
export type MatcapMaterialBindGroupResourceKind = "buffer" | "texture-view" | "sampler";
export type MatcapMaterialBindGroupDescriptorDiagnosticCode = "matcapMaterialBindGroup.missingMaterialResource" | "matcapMaterialBindGroup.missingTextureResource" | "matcapMaterialBindGroup.missingSamplerResource";
export interface MatcapMaterialBindGroupDescriptorDiagnostic {
    readonly code: MatcapMaterialBindGroupDescriptorDiagnosticCode;
    readonly message: string;
    readonly binding?: number;
}
export interface MatcapMaterialBindGroupResourceInput {
    readonly materialResourceKey: string | null;
    readonly dependencies: {
        readonly matcapTexture: {
            readonly textureKey: string | null;
            readonly samplerKey: string | null;
        };
    };
}
export interface MatcapMaterialBindGroupDescriptorEntry {
    readonly group: 2;
    readonly binding: number;
    readonly resourceKey: string;
    readonly resourceKind: MatcapMaterialBindGroupResourceKind;
}
export interface MatcapMaterialBindGroupDescriptorPlan {
    readonly valid: boolean;
    readonly group: 2;
    readonly resourceKey: string | null;
    readonly entries: readonly MatcapMaterialBindGroupDescriptorEntry[];
    readonly diagnostics: readonly MatcapMaterialBindGroupDescriptorDiagnostic[];
}
export type MatcapMaterialBindGroupResourceDiagnosticCode = "matcapMaterialBindGroupResource.nullDescriptorPlan" | "matcapMaterialBindGroupResource.invalidDescriptorPlan" | "matcapMaterialBindGroupResource.missingLayout" | "matcapMaterialBindGroupResource.invalidLayout" | "matcapMaterialBindGroupResource.missingDeviceSupport" | "matcapMaterialBindGroupResource.missingBufferResource" | "matcapMaterialBindGroupResource.missingTextureResource" | "matcapMaterialBindGroupResource.missingSamplerResource" | "matcapMaterialBindGroupResource.creationFailed";
export interface MatcapMaterialBindGroupResourceDiagnostic {
    readonly code: MatcapMaterialBindGroupResourceDiagnosticCode;
    readonly message: string;
    readonly group?: 2;
    readonly binding?: number;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface MatcapMaterialBindGroupLayoutResource {
    readonly group: number;
    readonly layoutKey: string;
    readonly layout: unknown;
    readonly descriptor?: MatcapMaterialBindGroupLayoutDescriptor;
}
export interface MatcapMaterialBindGroupBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
}
export interface MatcapMaterialBindGroupTextureResource {
    readonly resourceKey: string;
    readonly view: unknown;
}
export interface MatcapMaterialBindGroupSamplerResource {
    readonly resourceKey: string;
    readonly sampler: unknown;
}
export interface MatcapMaterialBindGroupCreationEntry {
    readonly binding: number;
    readonly resource: unknown;
}
export interface MatcapMaterialBindGroupCreationDescriptor {
    readonly label: string;
    readonly layout: unknown;
    readonly entries: readonly MatcapMaterialBindGroupCreationEntry[];
}
export interface MatcapMaterialBindGroupDeviceLike {
    createBindGroup?: (descriptor: MatcapMaterialBindGroupCreationDescriptor) => unknown;
}
export interface MatcapMaterialBindGroupResource {
    readonly group: 2;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface CreateMatcapMaterialBindGroupResourceOptions {
    readonly device: MatcapMaterialBindGroupDeviceLike;
    readonly plan: MatcapMaterialBindGroupDescriptorPlan | null;
    readonly layout: MatcapMaterialBindGroupLayoutResource | null;
    readonly buffers: readonly MatcapMaterialBindGroupBufferResource[];
    readonly textures: readonly MatcapMaterialBindGroupTextureResource[];
    readonly samplers: readonly MatcapMaterialBindGroupSamplerResource[];
}
export interface CreateMatcapMaterialBindGroupResourceResult {
    readonly valid: boolean;
    readonly resource: MatcapMaterialBindGroupResource | null;
    readonly diagnostics: readonly MatcapMaterialBindGroupResourceDiagnostic[];
}
export declare function createMatcapMaterialBindGroupDescriptorPlan(input: MatcapMaterialBindGroupResourceInput): MatcapMaterialBindGroupDescriptorPlan;
export declare function createMatcapMaterialBindGroupDescriptorPlanFromDependencies(materialResourceKey: string | null, dependencies: MatcapMaterialResourceDependencies): MatcapMaterialBindGroupDescriptorPlan;
export declare function createMatcapMaterialBindGroupResourceKey(entries: readonly MatcapMaterialBindGroupDescriptorEntry[]): string;
export declare function createMatcapMaterialBindGroupResource(options: CreateMatcapMaterialBindGroupResourceOptions): CreateMatcapMaterialBindGroupResourceResult;
//# sourceMappingURL=matcap-bind-group.d.ts.map