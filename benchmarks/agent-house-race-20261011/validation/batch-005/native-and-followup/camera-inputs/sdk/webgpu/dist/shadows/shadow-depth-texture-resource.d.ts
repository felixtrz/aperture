import type { ShadowAtlasRegion } from "./shadow-map-descriptor.js";
import type { ShadowTextureResourceReport } from "./shadow-texture-resource.js";
import { type CreateTextureGpuResourceResult, type TextureGpuDeviceLike, type TextureGpuResourceDiagnostic } from "../resources/textures/texture-resources.js";
export type ShadowDepthTextureResourceStatus = "available" | "missing" | "not-required";
export type ShadowDepthTextureResourceDiagnostic = TextureGpuResourceDiagnostic | {
    readonly code: "shadowDepthTextureResource.missingTextureDescriptors";
    readonly severity: "warning" | "error";
    readonly message: string;
} | {
    readonly code: "shadowDepthTextureResource.faceViewCreationFailed";
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey: string;
    readonly faceIndex: number;
};
export interface CreateShadowDepthTextureResourceOptions {
    readonly device: TextureGpuDeviceLike;
    readonly textures: ShadowTextureResourceReport;
    readonly cache?: ShadowDepthTextureResourceCache;
}
export type ShadowDepthTextureResourceCache = Map<string, ShadowDepthTextureResourceCacheEntry>;
export interface ShadowDepthTextureResourceCacheEntry {
    readonly descriptorKey: string;
    readonly allocation: CreateTextureGpuResourceResult;
}
export interface ShadowDepthTextureResource {
    readonly shadowId: number;
    readonly lightId: number;
    readonly resourceKey: string;
    readonly textureKey: string;
    readonly viewKey: string;
    readonly layerCount?: number;
    readonly layerBaseIndex?: number;
    readonly attachmentLayerCount?: number;
    readonly atlasRegion?: ShadowAtlasRegion;
    readonly filterRadiusTexels?: number;
    readonly faceCount: 1 | 6;
    readonly viewDimension: "2d" | "2d-array" | "cube";
    readonly attachmentViews: readonly ShadowDepthTextureAttachmentView[];
    readonly allocation: CreateTextureGpuResourceResult;
}
export interface ShadowDepthTextureAttachmentView {
    readonly faceIndex: number;
    readonly viewKey: string;
    readonly view: unknown;
}
export interface ShadowDepthTextureResourceReport {
    readonly ready: boolean;
    readonly status: ShadowDepthTextureResourceStatus;
    readonly textureDescriptorCount: number;
    readonly createdTextureCount: number;
    readonly reusedTextureCount: number;
    readonly sections: {
        readonly textureDescriptors: boolean;
        readonly depthTextureResource: boolean;
        readonly gpuAllocation: boolean;
        readonly matrixUpload: false;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly resources: readonly ShadowDepthTextureResource[];
    readonly diagnostics: readonly ShadowDepthTextureResourceDiagnostic[];
}
export interface ShadowDepthTextureResourceReportJsonValue {
    readonly ready: boolean;
    readonly status: ShadowDepthTextureResourceStatus;
    readonly textureDescriptorCount: number;
    readonly createdTextureCount: number;
    readonly reusedTextureCount: number;
    readonly sections: ShadowDepthTextureResourceReport["sections"];
    readonly resources: readonly {
        readonly valid: boolean;
        readonly shadowId: number;
        readonly lightId: number;
        readonly resourceKey: string;
        readonly textureKey: string;
        readonly viewKey: string;
        readonly layerCount?: number;
        readonly layerBaseIndex?: number;
        readonly atlasRegion?: ShadowAtlasRegion;
        readonly filterRadiusTexels: number;
        readonly faceCount: 1 | 6;
        readonly viewDimension: "2d" | "2d-array" | "cube";
        readonly attachmentViewKeys: readonly string[];
        readonly descriptor: {
            readonly label?: string;
            readonly size: readonly [number, number, number];
            readonly format: string;
            readonly usage: number;
            readonly mipLevelCount?: number;
        } | null;
    }[];
    readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: "warning" | "error";
        readonly message: string;
        readonly resourceKey?: string;
    }[];
}
export declare function createShadowDepthTextureResourceReport(options: CreateShadowDepthTextureResourceOptions): ShadowDepthTextureResourceReport;
export declare function shadowDepthTextureResourceReportToJsonValue(report: ShadowDepthTextureResourceReport): ShadowDepthTextureResourceReportJsonValue;
export declare function shadowDepthTextureResourceReportToJson(report: ShadowDepthTextureResourceReport): string;
export declare function resolveShadowDepthTextureAttachmentView(report: ShadowDepthTextureResourceReport, attachment: {
    readonly shadowId: number;
    readonly lightId: number;
    readonly viewKey: string;
}): unknown | null;
//# sourceMappingURL=shadow-depth-texture-resource.d.ts.map