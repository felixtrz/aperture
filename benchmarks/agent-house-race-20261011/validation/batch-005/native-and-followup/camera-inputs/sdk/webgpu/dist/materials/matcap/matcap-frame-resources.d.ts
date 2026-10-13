import { type MatcapMaterialAsset, type MeshAsset, type MeshUploadPlanDiagnostic, type PackedSnapshotTransforms, type PackedSnapshotViewUniforms } from "@aperture-engine/render";
import type { WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
import { type MatcapMaterialBindGroupDescriptorDiagnostic, type MatcapMaterialBindGroupLayoutResource, type MatcapMaterialBindGroupResource, type MatcapMaterialBindGroupResourceDiagnostic } from "./matcap-bind-group.js";
import { type MatcapMaterialGpuBufferDiagnostic, type MatcapMaterialGpuBufferResource } from "./matcap-material-buffer-resource.js";
import { type MatcapMaterialBufferDescriptorDiagnostic, type MatcapMaterialPackingDiagnostic } from "./matcap-material-buffer.js";
import { type MeshGpuBufferCreationDiagnostic, type MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import { type MeshUploadBufferDescriptorDiagnostic } from "../../resources/meshes/mesh-buffer-descriptors.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import type { SamplerGpuResource, TextureGpuResource } from "../../resources/textures/texture-resources.js";
import { type UnlitBindGroupDescriptorDiagnostic, type UnlitBindGroupLayoutResource, type UnlitBindGroupResource, type UnlitBindGroupResourceDiagnostic } from "../unlit/unlit-bind-group.js";
import { type ViewUniformBufferDescriptorDiagnostic } from "../../resources/views/view-uniform-buffer.js";
import { type ViewUniformGpuBufferDiagnostic, type ViewUniformGpuBufferResource } from "../../resources/views/view-uniform-buffer-resource.js";
import { type WorldTransformBufferDescriptorDiagnostic, type WorldTransformGpuBufferDiagnostic, type WorldTransformGpuBufferResource } from "../../resources/transforms/world-transform-buffer.js";
export type MatcapFrameGpuResourceDiagnosticCode = "matcapFrameResources.missingMesh" | "matcapFrameResources.missingViewUniforms" | "matcapFrameResources.missingWorldTransforms" | "matcapFrameResources.missingMaterial";
export interface MatcapFrameGpuResourceDiagnostic {
    readonly code: MatcapFrameGpuResourceDiagnosticCode;
    readonly message: string;
}
export type CreateMatcapFrameGpuResourcesDiagnostic = MatcapFrameGpuResourceDiagnostic | MeshUploadPlanDiagnostic | MeshUploadBufferDescriptorDiagnostic | MeshGpuBufferCreationDiagnostic | ViewUniformBufferDescriptorDiagnostic | ViewUniformGpuBufferDiagnostic | WorldTransformBufferDescriptorDiagnostic | WorldTransformGpuBufferDiagnostic | MatcapMaterialPackingDiagnostic | MatcapMaterialBufferDescriptorDiagnostic | MatcapMaterialGpuBufferDiagnostic | MatcapMaterialBindGroupDescriptorDiagnostic | MatcapMaterialBindGroupResourceDiagnostic | UnlitBindGroupDescriptorDiagnostic | UnlitBindGroupResourceDiagnostic;
export interface MatcapFrameGpuResourceDeviceLike extends WebGpuBufferDeviceLike {
    createBindGroup?: (descriptor: unknown) => unknown;
}
export interface CreateMatcapFrameGpuResourcesOptions {
    readonly device: MatcapFrameGpuResourceDeviceLike;
    readonly mesh: MeshAsset | null;
    readonly preparedMesh?: MeshGpuBufferResource | undefined;
    readonly preparedViewUniform?: ViewUniformGpuBufferResource | undefined;
    readonly preparedWorldTransforms?: WorldTransformGpuBufferResource | undefined;
    readonly viewUniforms: PackedSnapshotViewUniforms | null;
    readonly worldTransforms: PackedSnapshotTransforms | null;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly material: MatcapMaterialAsset | null;
    readonly preparedMaterial?: PreparedMatcapFrameMaterialResources | undefined;
    readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
    readonly materialLayout: MatcapMaterialBindGroupLayoutResource | null;
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
    readonly textures: readonly TextureGpuResource[];
    readonly samplers: readonly SamplerGpuResource[];
}
export interface MatcapFrameGpuResources {
    readonly mesh: MeshGpuBufferResource;
    readonly viewUniform: ViewUniformGpuBufferResource;
    readonly worldTransforms: WorldTransformGpuBufferResource;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource;
    readonly material: MatcapMaterialGpuBufferResource;
    readonly materialBindGroup: MatcapMaterialBindGroupResource;
    readonly bindGroups: readonly (UnlitBindGroupResource | MatcapMaterialBindGroupResource)[];
}
export interface PreparedMatcapFrameMaterialResources {
    readonly material: MatcapMaterialGpuBufferResource;
    readonly bindGroup: MatcapMaterialBindGroupResource;
}
export interface CreateMatcapFrameGpuResourcesResult {
    readonly valid: boolean;
    readonly resources: MatcapFrameGpuResources | null;
    readonly diagnostics: readonly CreateMatcapFrameGpuResourcesDiagnostic[];
}
export declare function createMatcapFrameGpuResources(options: CreateMatcapFrameGpuResourcesOptions): CreateMatcapFrameGpuResourcesResult;
//# sourceMappingURL=matcap-frame-resources.d.ts.map