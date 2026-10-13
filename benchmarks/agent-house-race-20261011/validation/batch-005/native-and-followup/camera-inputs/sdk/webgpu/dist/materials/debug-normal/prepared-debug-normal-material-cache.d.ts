import { type AssetRegistry, type MaterialHandle } from "@aperture-engine/simulation";
import { type DebugNormalMaterialAsset, type PreparedMaterialResourceDiagnostic } from "@aperture-engine/render";
import { type DebugNormalMaterialBindGroupDescriptorDiagnostic, type DebugNormalMaterialBindGroupLayoutResource, type DebugNormalMaterialBindGroupResource, type DebugNormalMaterialBindGroupResourceDiagnostic } from "./debug-normal-bind-group.js";
import { type DebugNormalMaterialBufferDescriptorDiagnostic, type DebugNormalMaterialPackingDiagnostic } from "./debug-normal-material-buffer.js";
import { type DebugNormalMaterialGpuBufferDiagnostic, type DebugNormalMaterialGpuBufferResource } from "./debug-normal-material-buffer-resource.js";
import type { DebugNormalFrameGpuResourceDeviceLike } from "./debug-normal-frame-resources.js";
export type PreparedDebugNormalMaterialCacheStatus = "created" | "reused" | "failed";
export interface PreparedDebugNormalMaterialResource {
    readonly cacheKey: string;
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    lastUsedFrame: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
    readonly materialResourceKey: string;
    readonly bindGroupResourceKey: string;
    readonly material: DebugNormalMaterialGpuBufferResource;
    readonly bindGroup: DebugNormalMaterialBindGroupResource;
}
export interface PreparedDebugNormalMaterialCache {
    readonly resources: Map<string, PreparedDebugNormalMaterialResource>;
}
export type PreparedDebugNormalMaterialDiagnostic = PreparedMaterialResourceDiagnostic | DebugNormalMaterialPackingDiagnostic | DebugNormalMaterialBufferDescriptorDiagnostic | DebugNormalMaterialGpuBufferDiagnostic | DebugNormalMaterialBindGroupDescriptorDiagnostic | DebugNormalMaterialBindGroupResourceDiagnostic | {
    readonly code: "preparedDebugNormalMaterial.missingLayout" | "preparedDebugNormalMaterial.missingPreparedBindGroup";
    readonly message: string;
    readonly materialKey?: string;
    readonly layoutKey?: string;
};
export interface PrepareDebugNormalMaterialResourceOptions {
    readonly registry: AssetRegistry;
    readonly device: DebugNormalFrameGpuResourceDeviceLike;
    readonly cache: PreparedDebugNormalMaterialCache;
    readonly handle: MaterialHandle;
    readonly material: DebugNormalMaterialAsset;
    readonly sourceVersion: number;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly layout: DebugNormalMaterialBindGroupLayoutResource | null;
}
export interface PrepareDebugNormalMaterialResourceResult {
    readonly valid: boolean;
    readonly status: PreparedDebugNormalMaterialCacheStatus;
    readonly resource: PreparedDebugNormalMaterialResource | null;
    readonly diagnostics: readonly PreparedDebugNormalMaterialDiagnostic[];
}
export declare function createPreparedDebugNormalMaterialCache(): PreparedDebugNormalMaterialCache;
export declare function prepareDebugNormalMaterialResource(options: PrepareDebugNormalMaterialResourceOptions): PrepareDebugNormalMaterialResourceResult;
export declare function preparedDebugNormalMaterialCacheKey(input: {
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
}): string;
//# sourceMappingURL=prepared-debug-normal-material-cache.d.ts.map