import { type EnvironmentMapHandle } from "@aperture-engine/simulation";
import { type DiffuseIblCubeSource, type DiffuseIblTextureResourceReport, type SpecularIblPmremSource, type SpecularIblTextureResourceReport } from "../lighting/ibl-texture-resource.js";
import type { EquirectToCubeStorageFormat } from "../lighting/equirect-to-cube-compute-pipeline.js";
import { type EquirectSource, type EquirectToCubeResourceReport } from "../lighting/equirect-to-cube-resource.js";
import { type IblSamplerResourceReport } from "../lighting/ibl-sampler-resource.js";
import { type IblSamplerDescriptorReadinessReport } from "../lighting/ibl-sampler-descriptor-readiness.js";
import { type IblTexturePreparationReport } from "../lighting/ibl-texture-preparation.js";
import { type IblResourceDescriptorReport } from "../lighting/ibl-resource-descriptor.js";
import type { SamplerGpuResource, TextureGpuDeviceLike, TextureGpuResource } from "../resources/textures/texture-resources.js";
import { type StandardMaterialIblBindGroupDescriptorReadinessReport, type StandardMaterialIblBindGroupResource, type StandardMaterialIblBindGroupResourceReport } from "../materials/standard/standard-material-ibl-bind-group.js";
import type { ShadowSamplerResource, StandardMaterialShadowBindGroupResource } from "../materials/standard/standard-material-shadow-bind-group.js";
import type { ShadowCasterPipelineResource } from "../shadows/shadow-caster-pipeline-resource.js";
import type { ShadowCasterMatrixBindGroupResource } from "../shadows/shadow-caster-matrix-bind-group-resource.js";
import type { ShadowDepthTextureResourceCache } from "../shadows/shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResource } from "../shadows/shadow-matrix-buffer-resource.js";
import type { StandardFrameIblResources } from "../materials/standard/standard-frame-resources.js";
import type { ShadowCasterCommandTopologyCacheEntry, ShadowCasterPassMatrixBufferResource, ShadowCasterWorldTransformBufferResource, ShadowCasterWorldTransformScratch } from "../shadows/render-shadow-frame.js";
export interface WebGpuEnvironmentResourceCache {
    readonly equirectProjections: Map<string, EquirectToCubeResourceReport>;
    readonly diffuseTextures: Map<string, TextureGpuResource>;
    readonly specularTextures: Map<string, TextureGpuResource>;
    readonly samplers: Map<string, SamplerGpuResource>;
    readonly standardIblBindGroups: Map<string, StandardMaterialIblBindGroupResource>;
    readonly shadowSamplers: Map<string, ShadowSamplerResource>;
    readonly standardShadowBindGroups: Map<string, StandardMaterialShadowBindGroupResource>;
    readonly shadowCasterPipelines: Map<string, ShadowCasterPipelineResource>;
    readonly shadowCasterMatrixBindGroups: Map<string, ShadowCasterMatrixBindGroupResource>;
    readonly shadowDepthTextures: ShadowDepthTextureResourceCache;
    readonly shadowMatrixBuffers: Map<string, ShadowMatrixBufferResource>;
    readonly shadowCasterPassMatrixBuffers: Map<string, ShadowCasterPassMatrixBufferResource>;
    readonly shadowCasterWorldTransformBuffers: Map<string, ShadowCasterWorldTransformBufferResource>;
    readonly shadowCasterWorldTransformScratch: ShadowCasterWorldTransformScratch;
    readonly shadowCasterCommandTopology: Map<string, ShadowCasterCommandTopologyCacheEntry>;
}
export interface WebGpuEnvironmentResourceCacheSummary {
    equirectProjectionEntries: number;
    diffuseTextureEntries: number;
    specularTextureEntries: number;
    samplerEntries: number;
    standardIblBindGroupEntries: number;
    shadowSamplerEntries: number;
    standardShadowBindGroupEntries: number;
    shadowCasterPipelineEntries: number;
    shadowCasterMatrixBindGroupEntries: number;
    shadowCasterCommandTopologyEntries: number;
    shadowDepthTextureEntries: number;
    shadowMatrixBufferEntries: number;
    totalEntries: number;
}
export interface WebGpuEnvironmentResourceReuseReport {
    diffuseTextureResourcesCreated: number;
    diffuseTextureResourcesReused: number;
    specularTextureResourcesCreated: number;
    specularTextureResourcesReused: number;
    samplerResourcesCreated: number;
    samplerResourcesReused: number;
}
export interface WebGpuAppIblResourceReports {
    readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
    readonly specularTextureResource: SpecularIblTextureResourceReport;
    readonly samplerResources: IblSamplerResourceReport;
    readonly reuse: WebGpuEnvironmentResourceReuseReport;
    readonly cacheSummary: WebGpuEnvironmentResourceCacheSummary;
}
export interface WebGpuAppEnvironmentEquirectSource extends EquirectSource {
    readonly faceSize?: number;
    readonly format?: EquirectToCubeStorageFormat;
    readonly resourceKey?: string;
    readonly label?: string;
    readonly mipLevelCount?: number;
}
export interface PrepareWebGpuAppIblResourceReportsOptions {
    readonly app: object;
    readonly device?: TextureGpuDeviceLike;
    readonly textures: IblTexturePreparationReport;
    readonly samplers: IblSamplerDescriptorReadinessReport;
    readonly diffuseSources?: readonly DiffuseIblCubeSource[];
    readonly specularPmremSources?: readonly SpecularIblPmremSource[];
}
export interface WebGpuAppEnvironmentAssetInput {
    readonly handle: EnvironmentMapHandle;
    readonly label?: string;
    readonly version?: string | number;
    readonly diffuseResourceKey: string;
    readonly specularResourceKey: string;
    readonly equirectSource?: WebGpuAppEnvironmentEquirectSource;
    readonly diffuseSource?: DiffuseIblCubeSource;
    readonly specularPmremSource?: SpecularIblPmremSource;
    readonly standardMaterialCount?: number;
}
export interface PrepareWebGpuAppEnvironmentAssetsOptions {
    readonly app: object;
    readonly device?: TextureGpuDeviceLike;
    readonly assets: readonly WebGpuAppEnvironmentAssetInput[];
    readonly activeHandle?: EnvironmentMapHandle | null;
    readonly activeEnvironmentMapResourceKey?: string | null;
}
export interface WebGpuPreparedEnvironmentAssetReuseReport extends WebGpuEnvironmentResourceReuseReport {
    readonly standardIblBindGroupsCreated: number;
    readonly standardIblBindGroupsReused: number;
}
export interface WebGpuPreparedEnvironmentAsset {
    readonly handle: EnvironmentMapHandle;
    readonly environmentMapResourceKey: string;
    readonly label?: string;
    readonly version: string | null;
    readonly ready: boolean;
    readonly standardMaterialCount: number;
    readonly diffuseResourceKey: string;
    readonly diffuseTextureKey: string;
    readonly specularResourceKey: string;
    readonly specularTextureKey: string;
    readonly samplerKeys: readonly string[];
    readonly descriptorReport: IblResourceDescriptorReport;
    readonly texturePreparation: IblTexturePreparationReport;
    readonly samplerDescriptors: IblSamplerDescriptorReadinessReport;
    readonly equirectProjection?: EquirectToCubeResourceReport;
    readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
    readonly specularTextureResource: SpecularIblTextureResourceReport;
    readonly samplerResources: IblSamplerResourceReport;
    readonly bindGroupDescriptor: StandardMaterialIblBindGroupDescriptorReadinessReport;
    readonly bindGroupResource: StandardMaterialIblBindGroupResourceReport;
    readonly standardMaterialIblResources: StandardFrameIblResources;
    readonly reuse: WebGpuPreparedEnvironmentAssetReuseReport;
    readonly cacheSummary: WebGpuEnvironmentResourceCacheSummary;
}
export interface WebGpuPreparedEnvironmentAssetSetTotals {
    readonly assetCount: number;
    readonly readyAssetCount: number;
    readonly diffuseTextureResourcesCreated: number;
    readonly diffuseTextureResourcesReused: number;
    readonly specularTextureResourcesCreated: number;
    readonly specularTextureResourcesReused: number;
    readonly samplerResourcesCreated: number;
    readonly samplerResourcesReused: number;
    readonly standardIblBindGroupsCreated: number;
    readonly standardIblBindGroupsReused: number;
}
export interface WebGpuPreparedEnvironmentAssetSet {
    readonly assets: readonly WebGpuPreparedEnvironmentAsset[];
    readonly activeEnvironmentMapResourceKey: string | null;
    readonly active: WebGpuPreparedEnvironmentAsset | null;
    readonly totals: WebGpuPreparedEnvironmentAssetSetTotals;
    readonly cacheSummary: WebGpuEnvironmentResourceCacheSummary;
}
export declare function createWebGpuEnvironmentResourceCache(): WebGpuEnvironmentResourceCache;
export declare function registerWebGpuAppEnvironmentResourceCache(app: object, cache: WebGpuEnvironmentResourceCache): void;
export declare function getOrCreateWebGpuAppEnvironmentResourceCache(app: object): WebGpuEnvironmentResourceCache;
export declare function createWebGpuEnvironmentResourceCacheSummary(): WebGpuEnvironmentResourceCacheSummary;
export declare function writeWebGpuEnvironmentResourceCacheSummary(summary: WebGpuEnvironmentResourceCacheSummary, cache: WebGpuEnvironmentResourceCache): WebGpuEnvironmentResourceCacheSummary;
export declare function createWebGpuEnvironmentResourceReuseReport(): WebGpuEnvironmentResourceReuseReport;
export declare function prepareWebGpuAppIblResourceReports(options: PrepareWebGpuAppIblResourceReportsOptions): WebGpuAppIblResourceReports;
export declare function prepareWebGpuAppEnvironmentAssets(options: PrepareWebGpuAppEnvironmentAssetsOptions): WebGpuPreparedEnvironmentAssetSet;
export declare function webGpuPreparedEnvironmentAssetSetToJsonValue(set: WebGpuPreparedEnvironmentAssetSet): {
    activeEnvironmentMapResourceKey: string | null;
    activeReady: boolean;
    totals: {
        assetCount: number;
        readyAssetCount: number;
        diffuseTextureResourcesCreated: number;
        diffuseTextureResourcesReused: number;
        specularTextureResourcesCreated: number;
        specularTextureResourcesReused: number;
        samplerResourcesCreated: number;
        samplerResourcesReused: number;
        standardIblBindGroupsCreated: number;
        standardIblBindGroupsReused: number;
    };
    cacheSummary: {
        equirectProjectionEntries: number;
        diffuseTextureEntries: number;
        specularTextureEntries: number;
        samplerEntries: number;
        standardIblBindGroupEntries: number;
        shadowSamplerEntries: number;
        standardShadowBindGroupEntries: number;
        shadowCasterPipelineEntries: number;
        shadowCasterMatrixBindGroupEntries: number;
        shadowCasterCommandTopologyEntries: number;
        shadowDepthTextureEntries: number;
        shadowMatrixBufferEntries: number;
        totalEntries: number;
    };
    assets: {
        version: string | null;
        ready: boolean;
        standardMaterialCount: number;
        resourceKeys: {
            diffuseResourceKey: string;
            diffuseTextureKey: string;
            specularResourceKey: string;
            specularTextureKey: string;
            samplerKeys: string[];
            bindGroupResourceKey: string | null;
        };
        reuse: {
            standardIblBindGroupsCreated: number;
            standardIblBindGroupsReused: number;
            diffuseTextureResourcesCreated: number;
            diffuseTextureResourcesReused: number;
            specularTextureResourcesCreated: number;
            specularTextureResourcesReused: number;
            samplerResourcesCreated: number;
            samplerResourcesReused: number;
        };
        cacheSummary: {
            equirectProjectionEntries: number;
            diffuseTextureEntries: number;
            specularTextureEntries: number;
            samplerEntries: number;
            standardIblBindGroupEntries: number;
            shadowSamplerEntries: number;
            standardShadowBindGroupEntries: number;
            shadowCasterPipelineEntries: number;
            shadowCasterMatrixBindGroupEntries: number;
            shadowCasterCommandTopologyEntries: number;
            shadowDepthTextureEntries: number;
            shadowMatrixBufferEntries: number;
            totalEntries: number;
        };
        reports: {
            diffuseTexture: import("../lighting/ibl-texture-resource-types.js").DiffuseIblTextureResourceReportJsonValue;
            specularTexture: import("../lighting/ibl-texture-resource-types.js").SpecularIblTextureResourceReportJsonValue;
            samplerResources: import("../lighting/ibl-sampler-resource.js").IblSamplerResourceReportJsonValue;
            bindGroupDescriptor: StandardMaterialIblBindGroupDescriptorReadinessReport;
            bindGroupResource: import("../materials/standard/standard-material-ibl-bind-group.js").StandardMaterialIblBindGroupResourceReportJsonValue;
            equirectProjection?: {
                ready: boolean;
                faceSize: number;
                faceCount: 6;
                format: EquirectToCubeStorageFormat;
                projection: "equirect-to-cube";
                resourceKey: string | null;
                diagnostics: {
                    code: import("../lighting/equirect-to-cube-resource.js").EquirectToCubeResourceDiagnosticCode;
                    severity: "warning" | "error";
                    message: string;
                }[];
            };
            descriptors: IblResourceDescriptorReport;
            texturePreparation: IblTexturePreparationReport;
            samplerDescriptors: IblSamplerDescriptorReadinessReport;
        };
        label?: string;
        environmentMapResourceKey: string;
    }[];
};
//# sourceMappingURL=app-environment-resources.d.ts.map