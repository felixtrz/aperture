import { type MeshAsset, type MeshUploadPlanDiagnostic } from "@aperture-engine/render";
import { type MaterialAsset, type UnlitMaterialPackingDiagnostic } from "@aperture-engine/render";
import type { PackedSnapshotTransforms, PackedSnapshotViewUniforms } from "@aperture-engine/render";
import { type MeshGpuBufferCreationDiagnostic, type MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import { type MeshUploadBufferDescriptorDiagnostic } from "../../resources/meshes/mesh-buffer-descriptors.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import { type CreateUnlitBindGroupsResult, type UnlitBindGroupDescriptorDiagnostic, type UnlitBindGroupLayoutResource, type UnlitBindGroupResource, type UnlitBindGroupResourceDiagnostic } from "./unlit-bind-group.js";
import { type UnlitMaterialBufferDescriptorDiagnostic } from "./unlit-material-buffer.js";
import { type UnlitMaterialGpuBufferDiagnostic, type UnlitMaterialGpuBufferResource } from "./unlit-material-buffer-resource.js";
import { type ViewUniformBufferDescriptorDiagnostic } from "../../resources/views/view-uniform-buffer.js";
import { type ViewUniformGpuBufferDiagnostic, type ViewUniformGpuBufferResource } from "../../resources/views/view-uniform-buffer-resource.js";
import type { WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
import { type WorldTransformBufferDescriptorDiagnostic, type WorldTransformGpuBufferDiagnostic, type WorldTransformGpuBufferResource } from "../../resources/transforms/world-transform-buffer.js";
import type { UnlitBindGroupDeviceLike } from "./unlit-bind-group.js";
import type { SamplerGpuResource, TextureGpuResource } from "../../resources/textures/texture-resources.js";
export type UnlitFrameGpuResourceDiagnosticCode = "unlitFrameResources.missingMesh" | "unlitFrameResources.missingViewUniforms" | "unlitFrameResources.missingWorldTransforms" | "unlitFrameResources.missingMaterials" | "unlitFrameResources.missingMaterial";
export interface UnlitFrameGpuResourceDiagnostic {
    readonly code: UnlitFrameGpuResourceDiagnosticCode;
    readonly message: string;
}
export type CreateUnlitFrameGpuResourcesDiagnostic = UnlitFrameGpuResourceDiagnostic | MeshUploadPlanDiagnostic | MeshUploadBufferDescriptorDiagnostic | MeshGpuBufferCreationDiagnostic | ViewUniformBufferDescriptorDiagnostic | ViewUniformGpuBufferDiagnostic | WorldTransformBufferDescriptorDiagnostic | WorldTransformGpuBufferDiagnostic | UnlitMaterialPackingDiagnostic | UnlitMaterialBufferDescriptorDiagnostic | UnlitMaterialGpuBufferDiagnostic | UnlitBindGroupDescriptorDiagnostic | UnlitBindGroupResourceDiagnostic;
export interface UnlitFrameGpuResourceDeviceLike extends WebGpuBufferDeviceLike, UnlitBindGroupDeviceLike {
}
export interface CreateUnlitFrameGpuResourcesOptions {
    readonly device: UnlitFrameGpuResourceDeviceLike;
    readonly mesh: MeshAsset | null;
    readonly preparedMesh?: MeshGpuBufferResource | undefined;
    readonly preparedViewUniform?: ViewUniformGpuBufferResource | undefined;
    readonly preparedWorldTransforms?: WorldTransformGpuBufferResource | undefined;
    readonly viewUniforms: PackedSnapshotViewUniforms | null;
    readonly worldTransforms: PackedSnapshotTransforms | null;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly material: MaterialAsset | null;
    readonly layouts: readonly UnlitBindGroupLayoutResource[];
    readonly preparedMaterial?: PreparedUnlitFrameMaterialResources | undefined;
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
    readonly textures?: readonly TextureGpuResource[];
    readonly samplers?: readonly SamplerGpuResource[];
}
export interface CreateMultiMaterialUnlitFrameGpuResourcesOptions {
    readonly device: UnlitFrameGpuResourceDeviceLike;
    readonly mesh: MeshAsset | null;
    readonly viewUniforms: PackedSnapshotViewUniforms | null;
    readonly worldTransforms: PackedSnapshotTransforms | null;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly materials: readonly (MaterialAsset | null)[] | null;
    readonly layouts: readonly UnlitBindGroupLayoutResource[];
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
    readonly materialLayouts?: readonly (readonly UnlitBindGroupLayoutResource[])[] | undefined;
    readonly textures?: readonly TextureGpuResource[];
    readonly samplers?: readonly SamplerGpuResource[];
}
export interface UnlitFrameGpuResources {
    readonly mesh: MeshGpuBufferResource;
    readonly viewUniform: ViewUniformGpuBufferResource;
    readonly worldTransforms: WorldTransformGpuBufferResource;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource;
    readonly material: UnlitMaterialGpuBufferResource;
    readonly bindGroups: CreateUnlitBindGroupsResult["resources"];
}
export interface PreparedUnlitFrameMaterialResources {
    readonly material: UnlitMaterialGpuBufferResource;
    readonly bindGroup: UnlitBindGroupResource;
}
export interface MultiMaterialUnlitFrameGpuResources {
    readonly mesh: MeshGpuBufferResource;
    readonly viewUniform: ViewUniformGpuBufferResource;
    readonly worldTransforms: WorldTransformGpuBufferResource;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource;
    readonly materials: readonly UnlitMaterialGpuBufferResource[];
    readonly bindGroups: CreateUnlitBindGroupsResult["resources"];
}
export interface CreateUnlitFrameGpuResourcesResult {
    readonly valid: boolean;
    readonly resources: UnlitFrameGpuResources | null;
    readonly diagnostics: readonly CreateUnlitFrameGpuResourcesDiagnostic[];
}
export interface CreateMultiMaterialUnlitFrameGpuResourcesResult {
    readonly valid: boolean;
    readonly resources: MultiMaterialUnlitFrameGpuResources | null;
    readonly diagnostics: readonly CreateUnlitFrameGpuResourcesDiagnostic[];
}
export declare function createUnlitFrameGpuResources(options: CreateUnlitFrameGpuResourcesOptions): CreateUnlitFrameGpuResourcesResult;
export declare function createMultiMaterialUnlitFrameGpuResources(options: CreateMultiMaterialUnlitFrameGpuResourcesOptions): CreateMultiMaterialUnlitFrameGpuResourcesResult;
//# sourceMappingURL=unlit-frame-resources.d.ts.map