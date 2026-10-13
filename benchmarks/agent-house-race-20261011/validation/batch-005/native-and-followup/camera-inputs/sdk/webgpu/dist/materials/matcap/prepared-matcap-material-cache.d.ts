import { type AssetRegistry, type AssetStatus, type MaterialHandle } from "@aperture-engine/simulation";
import { type MatcapMaterialAsset, type PreparedMaterialResourceDiagnostic } from "@aperture-engine/render";
import { type MatcapMaterialBindGroupDescriptorDiagnostic, type MatcapMaterialBindGroupLayoutResource, type MatcapMaterialBindGroupResource, type MatcapMaterialBindGroupResourceDiagnostic } from "./matcap-bind-group.js";
import { type MatcapMaterialGpuBufferDiagnostic, type MatcapMaterialGpuBufferResource } from "./matcap-material-buffer-resource.js";
import { type MatcapMaterialBufferDescriptorDiagnostic, type MatcapMaterialPackingDiagnostic } from "./matcap-material-buffer.js";
import type { MatcapFrameGpuResourceDeviceLike } from "./matcap-frame-resources.js";
import type { SamplerGpuResource, TextureGpuResource } from "../../resources/textures/texture-resources.js";
export type PreparedMatcapMaterialCacheStatus = "created" | "reused" | "failed";
export interface PreparedMatcapTextureDependencyVersionKey {
    readonly kind: "texture" | "sampler";
    readonly handleKey: string;
    readonly version: number;
    readonly versionKey: string;
}
export interface PreparedMatcapTextureDependencyKeys {
    readonly texture: PreparedMatcapTextureDependencyVersionKey;
    readonly sampler: PreparedMatcapTextureDependencyVersionKey;
    readonly cacheKeySegments: readonly string[];
}
export type PreparedMatcapTextureDependencyDiagnostic = {
    readonly code: "preparedMatcapTextureDependency.missingTextureHandle" | "preparedMatcapTextureDependency.missingSamplerHandle";
    readonly message: string;
    readonly field: "matcapTexture.texture" | "matcapTexture.sampler";
} | {
    readonly code: "preparedMatcapTextureDependency.textureSourceNotReady" | "preparedMatcapTextureDependency.samplerSourceNotReady";
    readonly message: string;
    readonly resourceKey: string;
    readonly status: AssetStatus | "missing";
};
export interface CreatePreparedMatcapTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: MatcapMaterialAsset;
}
export interface CreatePreparedMatcapTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedMatcapTextureDependencyKeys | null;
    readonly diagnostics: readonly PreparedMatcapTextureDependencyDiagnostic[];
}
export interface PreparedMatcapMaterialResource {
    readonly cacheKey: string;
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    lastUsedFrame: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
    readonly dependencyCacheKeySegments: readonly string[];
    readonly textureResourceKey: string;
    readonly samplerResourceKey: string;
    readonly materialResourceKey: string;
    readonly bindGroupResourceKey: string;
    readonly material: MatcapMaterialGpuBufferResource;
    readonly bindGroup: MatcapMaterialBindGroupResource;
}
export interface PreparedMatcapMaterialCache {
    readonly resources: Map<string, PreparedMatcapMaterialResource>;
}
export type PreparedMatcapMaterialDiagnostic = PreparedMaterialResourceDiagnostic | PreparedMatcapTextureDependencyDiagnostic | MatcapMaterialPackingDiagnostic | MatcapMaterialBufferDescriptorDiagnostic | MatcapMaterialGpuBufferDiagnostic | MatcapMaterialBindGroupDescriptorDiagnostic | MatcapMaterialBindGroupResourceDiagnostic | {
    readonly code: "preparedMatcapMaterial.missingLayout" | "preparedMatcapMaterial.missingPreparedBindGroup";
    readonly message: string;
    readonly materialKey?: string;
    readonly layoutKey?: string;
};
export interface PrepareMatcapMaterialResourceOptions {
    readonly registry: AssetRegistry;
    readonly device: MatcapFrameGpuResourceDeviceLike;
    readonly cache: PreparedMatcapMaterialCache;
    readonly handle: MaterialHandle;
    readonly material: MatcapMaterialAsset;
    readonly sourceVersion: number;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly layout: MatcapMaterialBindGroupLayoutResource | null;
    readonly textures: readonly TextureGpuResource[];
    readonly samplers: readonly SamplerGpuResource[];
}
export interface PrepareMatcapMaterialResourceResult {
    readonly valid: boolean;
    readonly status: PreparedMatcapMaterialCacheStatus;
    readonly resource: PreparedMatcapMaterialResource | null;
    readonly diagnostics: readonly PreparedMatcapMaterialDiagnostic[];
}
export declare function createPreparedMatcapMaterialCache(): PreparedMatcapMaterialCache;
export declare function createPreparedMatcapTextureDependencyKeys(options: CreatePreparedMatcapTextureDependencyKeysOptions): CreatePreparedMatcapTextureDependencyKeysResult;
export declare function prepareMatcapMaterialResource(options: PrepareMatcapMaterialResourceOptions): PrepareMatcapMaterialResourceResult;
export declare function preparedMatcapMaterialCacheKey(input: {
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
    readonly dependencyCacheKeySegments: readonly string[];
}): string;
//# sourceMappingURL=prepared-matcap-material-cache.d.ts.map