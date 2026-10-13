import { type AssetRegistry, type AssetStatus, type MaterialHandle } from "@aperture-engine/simulation";
import { type UnlitMaterialAsset, type PreparedMaterialResourceDiagnostic } from "@aperture-engine/render";
import { type UnlitBindGroupLayoutResource, type UnlitBindGroupResource, type UnlitBindGroupResourceDiagnostic } from "./unlit-bind-group.js";
import { type UnlitMaterialBufferDescriptorDiagnostic } from "./unlit-material-buffer.js";
import { type UnlitMaterialGpuBufferDiagnostic, type UnlitMaterialGpuBufferResource } from "./unlit-material-buffer-resource.js";
import type { SamplerGpuResource, TextureGpuResource } from "../../resources/textures/texture-resources.js";
import type { UnlitFrameGpuResourceDeviceLike } from "./unlit-frame-resources.js";
import type { UnlitMaterialPackingDiagnostic } from "@aperture-engine/render";
export type PreparedScalarUnlitMaterialCacheStatus = "created" | "reused" | "skipped" | "failed";
export interface PreparedUnlitTextureDependencyVersionKey {
    readonly handleKey: string;
    readonly version: number;
    readonly versionKey: string;
}
export interface PreparedUnlitTextureDependencyKeys {
    readonly texture: PreparedUnlitTextureDependencyVersionKey;
    readonly sampler: PreparedUnlitTextureDependencyVersionKey;
    readonly cacheKeySegments: readonly string[];
}
export type PreparedUnlitTextureDependencyDiagnostic = {
    readonly code: "preparedUnlitTextureDependency.missingTextureHandle" | "preparedUnlitTextureDependency.missingSamplerHandle";
    readonly message: string;
    readonly field: "baseColorTexture.texture" | "baseColorTexture.sampler";
} | {
    readonly code: "preparedUnlitTextureDependency.textureSourceNotReady" | "preparedUnlitTextureDependency.samplerSourceNotReady";
    readonly message: string;
    readonly resourceKey: string;
    readonly status: AssetStatus | "missing";
};
export interface CreatePreparedUnlitTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: UnlitMaterialAsset;
}
export interface CreatePreparedUnlitTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedUnlitTextureDependencyKeys | null;
    readonly diagnostics: readonly PreparedUnlitTextureDependencyDiagnostic[];
}
export interface PreparedScalarUnlitMaterialResource {
    readonly cacheKey: string;
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    lastUsedFrame: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
    readonly dependencyCacheKeySegments?: readonly string[];
    readonly textureResourceKey?: string;
    readonly samplerResourceKey?: string;
    readonly materialResourceKey: string;
    readonly bindGroupResourceKey: string;
    readonly material: UnlitMaterialGpuBufferResource;
    readonly bindGroup: UnlitBindGroupResource;
}
export type PreparedTexturedUnlitMaterialResource = PreparedScalarUnlitMaterialResource & {
    readonly dependencyCacheKeySegments: readonly string[];
    readonly textureResourceKey: string;
    readonly samplerResourceKey: string;
};
export interface PreparedScalarUnlitMaterialCache {
    readonly resources: Map<string, PreparedScalarUnlitMaterialResource>;
}
export type PreparedScalarUnlitMaterialDiagnostic = PreparedMaterialResourceDiagnostic | UnlitMaterialPackingDiagnostic | UnlitMaterialBufferDescriptorDiagnostic | UnlitMaterialGpuBufferDiagnostic | UnlitBindGroupResourceDiagnostic | {
    readonly code: "preparedScalarUnlitMaterial.notScalar" | "preparedScalarUnlitMaterial.missingLayout" | "preparedScalarUnlitMaterial.missingPreparedBindGroup";
    readonly message: string;
    readonly materialKey?: string;
    readonly layoutKey?: string;
};
export type PreparedTexturedUnlitMaterialDiagnostic = PreparedMaterialResourceDiagnostic | PreparedUnlitTextureDependencyDiagnostic | UnlitMaterialPackingDiagnostic | UnlitMaterialBufferDescriptorDiagnostic | UnlitMaterialGpuBufferDiagnostic | UnlitBindGroupResourceDiagnostic | {
    readonly code: "preparedTexturedUnlitMaterial.notTextured" | "preparedTexturedUnlitMaterial.missingLayout" | "preparedTexturedUnlitMaterial.missingPreparedBindGroup";
    readonly message: string;
    readonly materialKey?: string;
    readonly layoutKey?: string;
};
export interface PrepareScalarUnlitMaterialResourceOptions {
    readonly registry: AssetRegistry;
    readonly device: UnlitFrameGpuResourceDeviceLike;
    readonly cache: PreparedScalarUnlitMaterialCache;
    readonly handle: MaterialHandle;
    readonly material: UnlitMaterialAsset;
    readonly sourceVersion: number;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly layout: UnlitBindGroupLayoutResource | null;
}
export interface PrepareScalarUnlitMaterialResourceResult {
    readonly valid: boolean;
    readonly status: PreparedScalarUnlitMaterialCacheStatus;
    readonly resource: PreparedScalarUnlitMaterialResource | null;
    readonly diagnostics: readonly PreparedScalarUnlitMaterialDiagnostic[];
}
export interface PrepareTexturedUnlitMaterialResourceOptions {
    readonly registry: AssetRegistry;
    readonly device: UnlitFrameGpuResourceDeviceLike;
    readonly cache: PreparedScalarUnlitMaterialCache;
    readonly handle: MaterialHandle;
    readonly material: UnlitMaterialAsset;
    readonly sourceVersion: number;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly layout: UnlitBindGroupLayoutResource | null;
    readonly textures: readonly TextureGpuResource[];
    readonly samplers: readonly SamplerGpuResource[];
}
export interface PrepareTexturedUnlitMaterialResourceResult {
    readonly valid: boolean;
    readonly status: PreparedScalarUnlitMaterialCacheStatus;
    readonly resource: PreparedTexturedUnlitMaterialResource | null;
    readonly diagnostics: readonly PreparedTexturedUnlitMaterialDiagnostic[];
}
export declare function createPreparedScalarUnlitMaterialCache(): PreparedScalarUnlitMaterialCache;
export declare function createPreparedUnlitTextureDependencyKeys(options: CreatePreparedUnlitTextureDependencyKeysOptions): CreatePreparedUnlitTextureDependencyKeysResult;
export declare function prepareScalarUnlitMaterialResource(options: PrepareScalarUnlitMaterialResourceOptions): PrepareScalarUnlitMaterialResourceResult;
export declare function prepareTexturedUnlitMaterialResource(options: PrepareTexturedUnlitMaterialResourceOptions): PrepareTexturedUnlitMaterialResourceResult;
export declare function preparedScalarUnlitMaterialCacheKey(input: {
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
}): string;
export declare function preparedTexturedUnlitMaterialCacheKey(input: {
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
    readonly dependencyCacheKeySegments: readonly string[];
}): string;
//# sourceMappingURL=prepared-unlit-material-cache.d.ts.map