import { type PreparedResourceDependency } from "../../resources/core/prepared-resource-dependencies.js";
import { type AssetRegistry, type MaterialHandle, type MeshHandle } from "@aperture-engine/simulation";
import type { DebugNormalMaterialAsset, MeshAsset, PackedSnapshotTransforms, PackedSnapshotViewUniforms } from "@aperture-engine/render";
import { type VersionedUploadStamp } from "../../app/app-frame-resource-utils.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import type { DebugNormalMaterialBindGroupLayoutResource } from "./debug-normal-bind-group.js";
import { type CreateDebugNormalFrameGpuResourcesResult } from "./debug-normal-frame-resources.js";
import { type PreparedMeshGpuResourceCache } from "../../resources/meshes/prepared-app-mesh-resource.js";
import { type PreparedAppMaterialFallbackDiagnostic } from "../core/prepared-app-material-resource.js";
import { type PreparedDebugNormalMaterialCache } from "./prepared-debug-normal-material-cache.js";
import type { UnlitBindGroupLayoutResource, UnlitBindGroupResource } from "../unlit/unlit-bind-group.js";
import { type ViewUniformBufferDescriptorScratch } from "../../resources/views/view-uniform-buffer.js";
import type { ViewUniformGpuBufferResource } from "../../resources/views/view-uniform-buffer-resource.js";
import { type WorldTransformBufferDescriptorScratch, type WorldTransformGpuBufferResource } from "../../resources/transforms/world-transform-buffer.js";
export interface CachedDebugNormalAppFrameResources {
    readonly preparedDependencies?: readonly PreparedResourceDependency[];
    readonly meshKey: string;
    readonly materialKey: string;
    readonly previousWorldTransformResourceKey: string | null;
    readonly viewByteLength: number;
    readonly worldTransformByteLength: number;
    readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
    readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
    /** Last uploaded contentVersion per dynamic buffer (AI-64/AI-65). */
    readonly worldTransformUploadStamp: VersionedUploadStamp;
    readonly viewUploadStamp: VersionedUploadStamp;
    result: CreateDebugNormalFrameGpuResourcesResult;
}
export interface DebugNormalAppFrameResourceCacheSlot {
    current: CachedDebugNormalAppFrameResources | null;
}
export interface DebugNormalAppFrameResourceReuseReport {
    meshBuffersCreated: number;
    meshBuffersReused: number;
    preparedMeshBuffersCreated: number;
    preparedMeshBuffersReused: number;
    materialBuffersCreated: number;
    materialBuffersReused: number;
    preparedMaterialBuffersCreated: number;
    preparedMaterialBuffersReused: number;
    preparedMaterialBindGroupsCreated: number;
    preparedMaterialBindGroupsReused: number;
    bindGroupsCreated: number;
    bindGroupsReused: number;
    dynamicBufferWrites: number;
}
export type CreateDebugNormalAppFrameResourcesDiagnostic = CreateDebugNormalFrameGpuResourcesResult["diagnostics"][number] | PreparedAppMaterialFallbackDiagnostic;
export interface CreateDebugNormalAppFrameResourcesResult {
    readonly valid: boolean;
    readonly resources: CreateDebugNormalFrameGpuResourcesResult["resources"];
    readonly diagnostics: readonly CreateDebugNormalAppFrameResourcesDiagnostic[];
}
export declare function createOrReuseDebugNormalAppFrameResources(options: {
    readonly device: unknown;
    readonly cache: DebugNormalAppFrameResourceCacheSlot;
    readonly mesh: MeshAsset | null;
    readonly meshHandle: MeshHandle;
    readonly meshKey: string;
    readonly material: DebugNormalMaterialAsset | null;
    readonly materialHandle: MaterialHandle;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly assets: AssetRegistry;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly preparedViewUniform?: ViewUniformGpuBufferResource | undefined;
    readonly preparedWorldTransforms?: WorldTransformGpuBufferResource | undefined;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
    readonly materialLayout: DebugNormalMaterialBindGroupLayoutResource | null;
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
    readonly preparedMeshes: PreparedMeshGpuResourceCache;
    readonly preparedDebugNormalMaterials: PreparedDebugNormalMaterialCache;
    readonly reuse: DebugNormalAppFrameResourceReuseReport;
}): CreateDebugNormalAppFrameResourcesResult;
//# sourceMappingURL=debug-normal-app-frame-resources.d.ts.map