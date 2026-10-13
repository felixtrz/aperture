import { type SamplerGpuResource, type TextureGpuDeviceLike, type TextureGpuResource, type TextureGpuResourceDiagnostic } from "../../resources/textures/texture-resources.js";
export declare const STANDARD_AREA_LIGHT_LTC_MATRIX_BINDING = 11;
export declare const STANDARD_AREA_LIGHT_LTC_FRESNEL_BINDING = 12;
export declare const STANDARD_AREA_LIGHT_LTC_SAMPLER_BINDING = 13;
export declare const STANDARD_AREA_LIGHT_LTC_MATRIX_RESOURCE_KEY = "standard-area-light-ltc:matrix";
export declare const STANDARD_AREA_LIGHT_LTC_FRESNEL_RESOURCE_KEY = "standard-area-light-ltc:fresnel";
export declare const STANDARD_AREA_LIGHT_LTC_SAMPLER_RESOURCE_KEY = "standard-area-light-ltc:sampler";
export interface StandardAreaLightLtcResources {
    readonly matrixTexture: TextureGpuResource;
    readonly fresnelTexture: TextureGpuResource;
    readonly sampler: SamplerGpuResource;
}
export interface CreateStandardAreaLightLtcResourcesOptions {
    readonly device: TextureGpuDeviceLike;
    readonly textureCache?: Map<string, TextureGpuResource>;
    readonly samplerCache?: Map<string, SamplerGpuResource>;
}
export interface CreateStandardAreaLightLtcResourcesResult {
    readonly valid: boolean;
    readonly resources: StandardAreaLightLtcResources | null;
    readonly diagnostics: readonly TextureGpuResourceDiagnostic[];
    readonly createdTextureCount: number;
    readonly reusedTextureCount: number;
    readonly createdSamplerCount: number;
    readonly reusedSamplerCount: number;
}
export declare function createStandardAreaLightLtcResources(options: CreateStandardAreaLightLtcResourcesOptions): CreateStandardAreaLightLtcResourcesResult;
//# sourceMappingURL=standard-area-light-ltc-resource.d.ts.map