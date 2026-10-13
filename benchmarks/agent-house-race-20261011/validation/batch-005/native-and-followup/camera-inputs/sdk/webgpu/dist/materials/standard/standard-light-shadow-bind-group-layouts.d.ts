import type { WebGpuBindGroupLayoutDescriptor } from "../../gpu/bind-group-layout-cache.js";
type ClusteredLocalLightCookieTextureViewDimension = "2d" | "2d-array" | "cube";
export declare function createStandardLightShadowBindGroupLayoutDescriptor(options?: {
    readonly clusteredLocalLights?: boolean;
    readonly clusteredLocalLightCookies?: boolean;
    readonly clusteredLocalLightShadowCookies?: boolean;
    readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor;
export declare function createStandardLightCascadedShadowBindGroupLayoutDescriptor(options?: {
    readonly clusteredLocalLights?: boolean;
    readonly clusteredLocalLightCookies?: boolean;
    readonly clusteredLocalLightShadowCookies?: boolean;
    readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor;
export declare function createStandardLightPointShadowBindGroupLayoutDescriptor(options?: {
    readonly clusteredLocalLights?: boolean;
    readonly clusteredLocalLightPointArrayShadows?: boolean;
    readonly clusteredLocalLightCookies?: boolean;
    readonly clusteredLocalLightShadowCookies?: boolean;
    readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor;
export declare function createStandardLightMultiShadowBindGroupLayoutDescriptor(options?: {
    readonly iblDiffuse?: boolean;
    readonly iblSpecular?: boolean;
    readonly clusteredLocalLights?: boolean;
    readonly clusteredLocalLightArrayShadows?: boolean;
    readonly clusteredLocalLightPointArrayShadows?: boolean;
    readonly clusteredLocalLightCookies?: boolean;
    readonly clusteredLocalLightShadowCookies?: boolean;
    readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor;
export declare function createStandardLightIblBindGroupLayoutDescriptor(options?: {
    readonly shadowMap?: boolean;
    readonly cascadedShadowMap?: boolean;
    readonly specularProof?: boolean;
    readonly clusteredLocalLights?: boolean;
    readonly clusteredLocalLightCookies?: boolean;
    readonly clusteredLocalLightShadowCookies?: boolean;
    readonly clusteredLocalLightCookieTextureViewDimension?: ClusteredLocalLightCookieTextureViewDimension;
}): WebGpuBindGroupLayoutDescriptor;
export {};
//# sourceMappingURL=standard-light-shadow-bind-group-layouts.d.ts.map