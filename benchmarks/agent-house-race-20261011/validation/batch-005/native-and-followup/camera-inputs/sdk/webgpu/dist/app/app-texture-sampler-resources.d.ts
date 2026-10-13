import { assetHandleKey, type SamplerHandle, type TextureHandle, type AssetRegistry } from "@aperture-engine/simulation";
import type { MatcapMaterialAsset, StandardMaterialAsset, UnlitMaterialAsset } from "@aperture-engine/render";
import { type SamplerGpuResource, type TextureGpuResource, type TextureGpuResourceDiagnostic } from "../resources/textures/texture-resources.js";
export interface WebGpuAppPreparedTextureSamplerDiagnostic {
    readonly code: "webGpuApp.textureSourceNotReady" | "webGpuApp.samplerSourceNotReady";
    readonly message: string;
    readonly resourceKey: string;
    readonly status: string;
}
export type WebGpuAppTextureSamplerPreparationDiagnostic = WebGpuAppPreparedTextureSamplerDiagnostic | TextureGpuResourceDiagnostic;
export interface PreparedAppTextureSamplerResources {
    readonly valid: boolean;
    readonly textures: readonly TextureGpuResource[];
    readonly samplers: readonly SamplerGpuResource[];
    readonly textureKeys: readonly string[];
    readonly samplerKeys: readonly string[];
    readonly diagnostics: readonly WebGpuAppTextureSamplerPreparationDiagnostic[];
}
export interface AppTextureSamplerResourceCache {
    readonly textures: Map<string, TextureGpuResource>;
    readonly samplers: Map<string, SamplerGpuResource>;
}
export interface AppTextureSamplerResourceCacheSummary {
    textureEntries: number;
    samplerEntries: number;
    totalEntries: number;
}
export interface AppTextureSamplerResourceReuseReport {
    textureResourcesCreated: number;
    textureResourcesReused: number;
    samplerResourcesCreated: number;
    samplerResourcesReused: number;
}
export interface AppTextureSamplerPreparationOptions {
    readonly assets: AssetRegistry;
    readonly device: unknown;
    readonly cache: AppTextureSamplerResourceCache;
    readonly reuse: AppTextureSamplerResourceReuseReport;
}
export declare function prepareUnlitAppTextureSamplerResources(options: AppTextureSamplerPreparationOptions & {
    readonly material: UnlitMaterialAsset;
}): PreparedAppTextureSamplerResources;
export declare function prepareMatcapAppTextureSamplerResources(options: AppTextureSamplerPreparationOptions & {
    readonly material: MatcapMaterialAsset;
}): PreparedAppTextureSamplerResources;
export declare function prepareStandardAppTextureSamplerResources(options: AppTextureSamplerPreparationOptions & {
    readonly material: StandardMaterialAsset;
}): PreparedAppTextureSamplerResources;
export declare function emptyPreparedAppTextureSamplerResources(): PreparedAppTextureSamplerResources;
export declare function createAppTextureSamplerResourceCacheSummary(): AppTextureSamplerResourceCacheSummary;
export declare function writeAppTextureSamplerResourceCacheSummary(summary: AppTextureSamplerResourceCacheSummary, cache: AppTextureSamplerResourceCache): AppTextureSamplerResourceCacheSummary;
export declare function sourceAssetCacheKey(handle: Parameters<typeof assetHandleKey>[0], version: number): string;
export declare function prepareAppTextureResource(options: {
    readonly assets: AssetRegistry;
    readonly device: unknown;
    readonly cache: AppTextureSamplerResourceCache;
    readonly handle: TextureHandle;
    readonly reuse: AppTextureSamplerResourceReuseReport;
    readonly diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[];
    readonly viewDescriptor?: unknown;
    readonly viewDescriptorKey?: string;
}): {
    readonly cacheKey: string;
    readonly resource: TextureGpuResource;
} | null;
export declare function prepareAppSamplerResource(options: {
    readonly assets: AssetRegistry;
    readonly device: unknown;
    readonly cache: AppTextureSamplerResourceCache;
    readonly handle: SamplerHandle;
    readonly reuse: AppTextureSamplerResourceReuseReport;
    readonly diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[];
}): {
    readonly cacheKey: string;
    readonly resource: SamplerGpuResource;
} | null;
//# sourceMappingURL=app-texture-sampler-resources.d.ts.map