import type { ShadowRequestPacket } from "@aperture-engine/render";
export type ShadowMapDescriptorDiagnosticCode = "shadowMapDescriptor.missingDescriptor" | "shadowMapDescriptor.invalidMapSize";
export interface ShadowMapDescriptorSource {
    readonly shadowId: number;
    readonly lightId: number;
    readonly mapSize: number;
    readonly depthBias: number;
    readonly normalBias?: number;
    readonly filterRadiusTexels?: number;
    readonly cascadeCount?: number;
    readonly depthFormat?: "depth24plus";
    readonly faceCount?: 1 | 6;
    readonly viewDimension?: "2d" | "2d-array" | "cube";
    readonly textureWidth?: number;
    readonly textureHeight?: number;
    readonly layerCount?: number;
    readonly layerBaseIndex?: number;
    readonly atlasRegion?: ShadowAtlasRegion;
    readonly resourceKey?: string;
}
export interface ShadowAtlasRegion {
    readonly originX: number;
    readonly originY: number;
    readonly width: number;
    readonly height: number;
}
export interface ShadowMapDescriptor {
    readonly shadowId: number;
    readonly lightId: number;
    readonly lightKind: NonNullable<ShadowRequestPacket["lightKind"]>;
    readonly resourceKey: string;
    readonly depthFormat: "depth24plus";
    readonly mapSize: number;
    readonly textureWidth: number;
    readonly textureHeight: number;
    readonly depthBias: number;
    readonly normalBias: number;
    readonly filterRadiusTexels: number;
    readonly cascadeCount: number;
    readonly faceCount: 1 | 6;
    readonly viewDimension: "2d" | "2d-array" | "cube";
    readonly layerCount: number;
    readonly layerBaseIndex: number;
    readonly atlasRegion?: ShadowAtlasRegion;
    readonly casterLayerMask: number;
    readonly receiverLayerMask: number;
    readonly ready: boolean;
}
export interface ShadowMapDescriptorDiagnostic {
    readonly code: ShadowMapDescriptorDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly shadowId: number;
    readonly lightId: number;
    readonly message: string;
}
export interface ShadowMapDescriptorReport {
    readonly ready: boolean;
    readonly requestCount: number;
    readonly descriptorCount: number;
    readonly sections: {
        readonly shadowRequests: boolean;
        readonly shadowMapDescriptors: boolean;
        readonly shadowPassSubmission: false;
    };
    readonly descriptors: readonly ShadowMapDescriptor[];
    readonly diagnostics: readonly ShadowMapDescriptorDiagnostic[];
}
export type ShadowMapDescriptorReportJsonValue = ShadowMapDescriptorReport;
export interface ShadowMapDescriptorInput {
    readonly shadowRequests: readonly ShadowRequestPacket[];
    readonly descriptors?: readonly ShadowMapDescriptorSource[];
}
export declare function createShadowMapDescriptorReport(input: ShadowMapDescriptorInput): ShadowMapDescriptorReport;
export declare function shadowMapDescriptorReportToJsonValue(report: ShadowMapDescriptorReport): ShadowMapDescriptorReportJsonValue;
export declare function shadowMapDescriptorReportToJson(report: ShadowMapDescriptorReport): string;
//# sourceMappingURL=shadow-map-descriptor.d.ts.map