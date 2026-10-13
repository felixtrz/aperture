import type { ShadowAtlasRegion, ShadowMapDescriptorReport } from "./shadow-map-descriptor.js";
export type ShadowTextureResourceDiagnosticCode = "shadowTextureResource.missingDescriptors" | "shadowTextureResource.allocationDeferred";
export interface ShadowTextureResourceDescriptor {
    readonly shadowId: number;
    readonly lightId: number;
    readonly lightKind: "directional" | "point" | "spot" | "ambient" | "environment" | "rect-area";
    readonly resourceKey: string;
    readonly textureKey: string;
    readonly viewKey: string;
    readonly attachmentViewKeys: readonly string[];
    readonly width: number;
    readonly height: number;
    readonly depthFormat: "depth24plus";
    readonly filterRadiusTexels?: number;
    readonly cascadeCount?: number;
    readonly layerCount?: number;
    readonly layerBaseIndex?: number;
    readonly atlasRegion?: ShadowAtlasRegion;
    readonly faceCount: 1 | 6;
    readonly viewDimension: "2d" | "2d-array" | "cube";
    readonly usageIntent: "render-attachment";
    readonly allocation: "deferred";
}
export interface ShadowTextureResourceDiagnostic {
    readonly code: ShadowTextureResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface ShadowTextureResourceReport {
    readonly ready: boolean;
    readonly descriptorCount: number;
    readonly textureCount: number;
    readonly sections: {
        readonly shadowMapDescriptors: boolean;
        readonly textureDescriptors: boolean;
        readonly gpuAllocation: false;
    };
    readonly textures: readonly ShadowTextureResourceDescriptor[];
    readonly diagnostics: readonly ShadowTextureResourceDiagnostic[];
}
export type ShadowTextureResourceReportJsonValue = ShadowTextureResourceReport;
export interface ShadowTextureResourceInput {
    readonly descriptors: ShadowMapDescriptorReport;
}
export declare function createShadowTextureResourceReport(input: ShadowTextureResourceInput): ShadowTextureResourceReport;
export declare function shadowTextureResourceReportToJsonValue(report: ShadowTextureResourceReport): ShadowTextureResourceReportJsonValue;
export declare function shadowTextureResourceReportToJson(report: ShadowTextureResourceReport): string;
//# sourceMappingURL=shadow-texture-resource.d.ts.map