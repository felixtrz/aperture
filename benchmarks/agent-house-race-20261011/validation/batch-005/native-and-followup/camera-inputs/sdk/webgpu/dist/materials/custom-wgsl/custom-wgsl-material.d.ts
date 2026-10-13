import type { PreparedCustomWgslMaterial } from "@aperture-engine/render";
import type { WebGpuRenderPipelineCreateDescriptor, WebGpuRenderPipelineDeviceLike } from "../../gpu/pipeline-cache.js";
import { type WebGpuShaderDeviceLike, type WebGpuShaderDiagnostic, type WebGpuShaderFailureReason } from "../../gpu/shader.js";
export type CustomWgslMaterialResourceDiagnosticCode = "customWgslMaterial.shaderDiagnostic" | "customWgslMaterial.shaderCreationFailed" | "customWgslMaterial.createRenderPipelineUnavailable" | "customWgslMaterial.pipelineCreationFailed" | "customWgslMaterial.missingPipelineLayout" | "customWgslMaterial.createBindGroupUnavailable" | "customWgslMaterial.missingBindingResource" | "customWgslMaterial.bindGroupCreationFailed";
export interface CustomWgslMaterialResourceDiagnostic {
    readonly code: CustomWgslMaterialResourceDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
    readonly binding?: number;
    readonly resourceKey?: string;
}
export interface CustomWgslMaterialGpuResource {
    readonly resourceKey: string;
    readonly resource: unknown;
}
export interface BrowserCustomWgslMaterialPipelineDescriptorInput {
    readonly material: PreparedCustomWgslMaterial;
    readonly shaderModule: unknown;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
}
export interface CreateCustomWgslMaterialRenderPipelineResourceOptions {
    readonly device: CustomWgslMaterialPipelineDeviceLike;
    readonly material: PreparedCustomWgslMaterial;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
}
export interface CustomWgslMaterialRenderPipelineResource {
    readonly cacheKey: string;
    readonly shaderModule: unknown;
    readonly pipeline: unknown;
    readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}
export interface CreateCustomWgslMaterialRenderPipelineResourceResult {
    readonly valid: boolean;
    readonly resource: CustomWgslMaterialRenderPipelineResource | null;
    readonly diagnostics: readonly CustomWgslMaterialResourceDiagnostic[];
}
export interface CustomWgslMaterialPipelineDeviceLike extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
}
export interface CustomWgslMaterialBindGroupLayoutEntryDescriptor {
    readonly binding: number;
    readonly visibility: number;
    readonly buffer?: {
        readonly type: "uniform" | "read-only-storage";
    };
    readonly texture?: {
        readonly sampleType: "float";
        readonly viewDimension: "2d";
        readonly multisampled: false;
    };
    readonly sampler?: {
        readonly type: "filtering";
    };
}
export interface CustomWgslMaterialBindGroupLayoutDescriptor {
    readonly label: string;
    readonly entries: readonly CustomWgslMaterialBindGroupLayoutEntryDescriptor[];
}
export interface CustomWgslMaterialBindGroupCreationEntry {
    readonly binding: number;
    readonly resource: unknown;
}
export interface CustomWgslMaterialBindGroupCreationDescriptor {
    readonly label: string;
    readonly layout: unknown;
    readonly entries: readonly CustomWgslMaterialBindGroupCreationEntry[];
}
export interface CustomWgslMaterialBindGroupDeviceLike {
    createBindGroup?: (descriptor: CustomWgslMaterialBindGroupCreationDescriptor) => unknown;
}
export interface CustomWgslMaterialPipelineLayoutProvider {
    getBindGroupLayout?: (group: number) => unknown;
}
export interface CreateCustomWgslMaterialBindGroupResourceOptions {
    readonly device: CustomWgslMaterialBindGroupDeviceLike;
    readonly material: PreparedCustomWgslMaterial;
    readonly pipeline: CustomWgslMaterialPipelineLayoutProvider;
    readonly resources: readonly CustomWgslMaterialGpuResource[];
}
export interface CustomWgslMaterialBindGroupResource {
    readonly group: 2;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
    readonly descriptor: CustomWgslMaterialBindGroupCreationDescriptor;
}
export interface CreateCustomWgslMaterialBindGroupResourceResult {
    readonly valid: boolean;
    readonly resource: CustomWgslMaterialBindGroupResource | null;
    readonly diagnostics: readonly CustomWgslMaterialResourceDiagnostic[];
}
export interface CustomWgslMaterialDeviceLike extends CustomWgslMaterialPipelineDeviceLike, CustomWgslMaterialBindGroupDeviceLike {
}
export interface CreateCustomWgslMaterialRenderResourcesOptions extends Omit<CreateCustomWgslMaterialRenderPipelineResourceOptions, "device"> {
    readonly device: CustomWgslMaterialDeviceLike;
    readonly resources: readonly CustomWgslMaterialGpuResource[];
}
export interface CustomWgslMaterialRenderResources {
    readonly pipeline: CustomWgslMaterialRenderPipelineResource;
    readonly bindGroup: CustomWgslMaterialBindGroupResource;
}
export interface CreateCustomWgslMaterialRenderResourcesResult {
    readonly valid: boolean;
    readonly resources: CustomWgslMaterialRenderResources | null;
    readonly pipeline: CreateCustomWgslMaterialRenderPipelineResourceResult;
    readonly bindGroup: CreateCustomWgslMaterialBindGroupResourceResult | null;
    readonly diagnostics: readonly CustomWgslMaterialResourceDiagnostic[];
}
export declare function createCustomWgslMaterialRenderPipelineResource(options: CreateCustomWgslMaterialRenderPipelineResourceOptions): Promise<CreateCustomWgslMaterialRenderPipelineResourceResult>;
export declare function createBrowserCustomWgslMaterialPipelineDescriptor(input: BrowserCustomWgslMaterialPipelineDescriptorInput): WebGpuRenderPipelineCreateDescriptor;
export declare function createCustomWgslMaterialBindGroupLayoutDescriptor(material: PreparedCustomWgslMaterial): CustomWgslMaterialBindGroupLayoutDescriptor;
export declare function createCustomWgslMaterialRenderResources(options: CreateCustomWgslMaterialRenderResourcesOptions): Promise<CreateCustomWgslMaterialRenderResourcesResult>;
export declare function createCustomWgslMaterialBindGroupResource(options: CreateCustomWgslMaterialBindGroupResourceOptions): CreateCustomWgslMaterialBindGroupResourceResult;
export declare function customWgslMaterialRenderPipelineCacheKey(input: {
    readonly material: PreparedCustomWgslMaterial;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
}): string;
//# sourceMappingURL=custom-wgsl-material.d.ts.map