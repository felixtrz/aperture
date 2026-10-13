import { type PreparedResourceDependency } from "../../resources/core/prepared-resource-dependencies.js";
import type { AssetRegistry, MaterialHandle, MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset, MeshDrawPacket, PackedSnapshotInstanceTints, PackedSnapshotTransforms, PackedSnapshotViewUniforms, RenderSnapshot, StandardMaterialAsset } from "@aperture-engine/render";
import { type VersionedUploadStamp } from "../../app/app-frame-resource-utils.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import { type PreparedAppMaterialFallbackDiagnostic } from "../core/prepared-app-material-resource.js";
import type { PreparedMaterialTextureSamplerDependencies } from "../core/prepared-material-texture-sampler-dependencies.js";
import type { LightBindGroupLayoutResource } from "../../lighting/light-bind-group-layout.js";
import type { LightBindGroupResource } from "../../lighting/light-bind-group.js";
import type { LocalLightClusterCookieResources } from "../../lighting/local-light-cookie-resources.js";
import type { StandardLightShadowBindGroupLayoutResource, StandardLightShadowBindGroupResource } from "./standard-light-shadow-bind-group.js";
import { type LightBufferDescriptorPlanScratch, type LightBufferDescriptorScratch } from "../../lighting/light-packing.js";
import type { PreparedMeshGpuResourceCache } from "../../resources/meshes/prepared-app-mesh-resource.js";
import type { PreparedScalarStandardMaterialCache } from "./prepared-standard-material-cache.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";
import { type CreateStandardFrameGpuResourcesResult, type CreateStandardFrameGpuResourcesOptions, type StandardFrameIblResources, type StandardFrameShadowReceiverResources, type StandardFrameTransmissionSceneColorResources } from "./standard-frame-resources.js";
import type { UnlitBindGroupLayoutResource, UnlitBindGroupResource } from "../unlit/unlit-bind-group.js";
import { type ViewUniformBufferDescriptorScratch } from "../../resources/views/view-uniform-buffer.js";
import { type ViewUniformGpuBufferResource } from "../../resources/views/view-uniform-buffer-resource.js";
import { type WorldTransformBufferDescriptorScratch, type WorldTransformGpuBufferResource } from "../../resources/transforms/world-transform-buffer.js";
export interface CachedStandardAppFrameResources {
    readonly preparedDependencies?: readonly PreparedResourceDependency[];
    readonly meshKey: string;
    readonly materialKey: string;
    readonly pipelineKey: string;
    readonly materialLayoutKey: string | null;
    readonly lightLayoutKey: string | null;
    readonly standardMaterialIblBindGroupResourceKey: string | null;
    readonly standardMaterialShadowReceiverResourceKey: string | null;
    readonly transmissionSceneColorResourceKey: string | null;
    readonly previousWorldTransformResourceKey: string | null;
    readonly textureKeys: readonly string[];
    readonly samplerKeys: readonly string[];
    readonly viewByteLength: number;
    readonly worldTransformByteLength: number;
    readonly lightFloatByteLength: number;
    readonly lightMetadataByteLength: number;
    readonly localLightClusterParamsByteLength: number;
    readonly localLightClusterCellsByteLength: number;
    readonly localLightClusterIndicesByteLength: number;
    readonly localLightClusterMetadataByteLength: number;
    readonly localLightClusterContentKeys: LocalLightClusterContentKeys | null;
    readonly localLightClusterResourceKey: string | null;
    readonly localLightCookieTextureKey: string | null;
    readonly localLightCookieSamplerKey: string | null;
    readonly localLightCookieMatrixKey: string | null;
    readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
    readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
    readonly lightBufferDescriptorScratch: LightBufferDescriptorScratch;
    readonly lightBufferDescriptorPlanScratch: LightBufferDescriptorPlanScratch;
    /** Last uploaded contentVersion per dynamic buffer (AI-64/AI-65). */
    readonly worldTransformUploadStamp: VersionedUploadStamp;
    readonly viewUploadStamp: VersionedUploadStamp;
    result: CreateStandardFrameGpuResourcesResult;
}
interface StandardSharedViewUniformResource {
    readonly resource: ViewUniformGpuBufferResource;
    readonly byteLength: number;
    readonly uploadStamp: VersionedUploadStamp;
}
interface StandardSharedWorldTransformResource {
    readonly resource: WorldTransformGpuBufferResource;
    readonly byteLength: number;
    readonly uploadStamp: VersionedUploadStamp;
}
export interface StandardAppFrameResourceCacheSlot {
    current: CachedStandardAppFrameResources | null;
    readonly byRoute?: Map<string, CachedStandardAppFrameResources>;
    sharedViewUniform?: StandardSharedViewUniformResource | null;
    sharedWorldTransforms?: StandardSharedWorldTransformResource | null;
    readonly sharedViewDescriptorScratch?: ViewUniformBufferDescriptorScratch;
    readonly sharedWorldTransformDescriptorScratch?: WorldTransformBufferDescriptorScratch;
}
export declare function createStandardAppFrameResourceCacheSlot(): StandardAppFrameResourceCacheSlot;
export interface StandardAppFrameResourceReuseReport {
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
    lightBuffersCreated: number;
    lightBuffersReused: number;
    standardFrameResourceCacheHits: number;
    standardFrameResourceCacheMisses: number;
    standardFrameResourceCacheMissReasons: Record<string, number>;
    localLightClusterBuffersCreated: number;
    localLightClusterBuffersReused: number;
    localLightClusterBufferWrites: number;
    localLightClusterBufferWritesSkipped: number;
    dynamicBufferWrites: number;
}
interface LocalLightClusterContentKeys {
    readonly params: string;
    readonly cells: string;
    readonly indices: string;
    readonly metadata: string;
}
export type CreateStandardAppFrameResourcesDiagnostic = CreateStandardFrameGpuResourcesResult["diagnostics"][number] | PreparedAppMaterialFallbackDiagnostic;
export interface CreateStandardAppFrameResourcesResult {
    readonly valid: boolean;
    readonly resources: CreateStandardFrameGpuResourcesResult["resources"];
    readonly diagnostics: readonly CreateStandardAppFrameResourcesDiagnostic[];
}
export declare function createOrReuseStandardAppFrameResources(options: {
    readonly device: unknown;
    readonly cache: StandardAppFrameResourceCacheSlot;
    readonly snapshot: RenderSnapshot;
    readonly draw?: MeshDrawPacket;
    readonly mesh: MeshAsset | null;
    readonly meshHandle: MeshHandle;
    readonly meshKey: string;
    readonly material: StandardMaterialAsset | null;
    readonly materialHandle: MaterialHandle;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
    readonly resourceLifetimeFrame?: number;
    readonly pipelineKey: string;
    readonly assets: AssetRegistry;
    readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly preparedViewUniform?: ViewUniformGpuBufferResource | undefined;
    readonly preparedWorldTransforms?: WorldTransformGpuBufferResource | undefined;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly instanceTints?: PackedSnapshotInstanceTints | null;
    readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
    readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
    readonly lightLayout: LightBindGroupLayoutResource | StandardLightShadowBindGroupLayoutResource | null;
    readonly sharedBindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
    readonly lightBindGroupCache?: BindGroupResourceCache<LightBindGroupResource> | undefined;
    readonly standardLightShadowBindGroupCache?: BindGroupResourceCache<StandardLightShadowBindGroupResource> | undefined;
    readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
    readonly standardMaterialIblResources?: StandardFrameIblResources;
    readonly standardAreaLightLtcResources?: CreateStandardFrameGpuResourcesOptions["standardAreaLightLtcResources"];
    readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
    readonly preparedMeshes: PreparedMeshGpuResourceCache;
    readonly preparedScalarMaterials: PreparedScalarStandardMaterialCache;
    readonly reuse: StandardAppFrameResourceReuseReport;
}): CreateStandardAppFrameResourcesResult;
export {};
//# sourceMappingURL=standard-app-frame-resources.d.ts.map