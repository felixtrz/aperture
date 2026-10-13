import { type PreparedResourceDependency } from "../../resources/core/prepared-resource-dependencies.js";
import type { AssetRegistry, MaterialHandle, MeshHandle } from "@aperture-engine/simulation";
import type { MatcapMaterialAsset, MeshAsset, PackedSnapshotTransforms, PackedSnapshotViewUniforms } from "@aperture-engine/render";
import { type VersionedUploadStamp } from "../../app/app-frame-resource-utils.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import { type PreparedAppMaterialFallbackDiagnostic } from "../core/prepared-app-material-resource.js";
import { type CreateMatcapFrameGpuResourcesResult } from "./matcap-frame-resources.js";
import type { MatcapMaterialBindGroupLayoutResource } from "./matcap-bind-group.js";
import { type PreparedMatcapMaterialCache } from "./prepared-matcap-material-cache.js";
import type { PreparedMaterialTextureSamplerDependencies } from "../core/prepared-material-texture-sampler-dependencies.js";
import { type PreparedMeshGpuResourceCache } from "../../resources/meshes/prepared-app-mesh-resource.js";
import type { UnlitBindGroupLayoutResource } from "../unlit/unlit-bind-group.js";
import type { UnlitBindGroupResource } from "../unlit/unlit-bind-group.js";
import { type ViewUniformBufferDescriptorScratch } from "../../resources/views/view-uniform-buffer.js";
import type { ViewUniformGpuBufferResource } from "../../resources/views/view-uniform-buffer-resource.js";
import { type WorldTransformBufferDescriptorScratch, type WorldTransformGpuBufferResource } from "../../resources/transforms/world-transform-buffer.js";
export interface CachedMatcapAppFrameResources {
    readonly preparedDependencies?: readonly PreparedResourceDependency[];
    readonly meshKey: string;
    readonly materialKey: string;
    readonly textureKeys: readonly string[];
    readonly samplerKeys: readonly string[];
    readonly previousWorldTransformResourceKey: string | null;
    readonly viewByteLength: number;
    readonly worldTransformByteLength: number;
    readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
    readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
    /** Last uploaded contentVersion per dynamic buffer (AI-64/AI-65). */
    readonly worldTransformUploadStamp: VersionedUploadStamp;
    readonly viewUploadStamp: VersionedUploadStamp;
    result: CreateMatcapFrameGpuResourcesResult;
}
export interface MatcapAppFrameResourceCacheSlot {
    current: CachedMatcapAppFrameResources | null;
}
export interface MatcapAppFrameResourceReuseReport {
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
export type CreateMatcapAppFrameResourcesDiagnostic = CreateMatcapFrameGpuResourcesResult["diagnostics"][number] | PreparedAppMaterialFallbackDiagnostic;
export interface CreateMatcapAppFrameResourcesResult {
    readonly valid: boolean;
    readonly resources: CreateMatcapFrameGpuResourcesResult["resources"];
    readonly diagnostics: readonly CreateMatcapAppFrameResourcesDiagnostic[];
}
export declare function createOrReuseMatcapAppFrameResources(options: {
    readonly device: unknown;
    readonly cache: MatcapAppFrameResourceCacheSlot;
    readonly mesh: MeshAsset | null;
    readonly meshHandle: MeshHandle;
    readonly meshKey: string;
    readonly material: MatcapMaterialAsset | null;
    readonly materialHandle: MaterialHandle;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly assets: AssetRegistry;
    readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly preparedViewUniform?: ViewUniformGpuBufferResource | undefined;
    readonly preparedWorldTransforms?: WorldTransformGpuBufferResource | undefined;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
    readonly materialLayout: MatcapMaterialBindGroupLayoutResource | null;
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
    readonly preparedMeshes: PreparedMeshGpuResourceCache;
    readonly preparedMatcapMaterials: PreparedMatcapMaterialCache;
    readonly reuse: MatcapAppFrameResourceReuseReport;
}): CreateMatcapAppFrameResourcesResult;
//# sourceMappingURL=matcap-app-frame-resources.d.ts.map