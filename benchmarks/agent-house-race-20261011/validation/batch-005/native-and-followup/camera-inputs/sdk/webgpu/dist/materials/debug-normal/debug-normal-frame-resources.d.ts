import { type DebugNormalMaterialAsset, type MeshAsset, type MeshUploadPlanDiagnostic, type PackedSnapshotTransforms, type PackedSnapshotViewUniforms } from "@aperture-engine/render";
import type { WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
import { type DebugNormalMaterialBindGroupDescriptorDiagnostic, type DebugNormalMaterialBindGroupLayoutResource, type DebugNormalMaterialBindGroupResource, type DebugNormalMaterialBindGroupResourceDiagnostic } from "./debug-normal-bind-group.js";
import { type DebugNormalMaterialGpuBufferDiagnostic, type DebugNormalMaterialGpuBufferResource } from "./debug-normal-material-buffer-resource.js";
import { type DebugNormalMaterialBufferDescriptorDiagnostic, type DebugNormalMaterialPackingDiagnostic } from "./debug-normal-material-buffer.js";
import { type MeshUploadBufferDescriptorDiagnostic } from "../../resources/meshes/mesh-buffer-descriptors.js";
import { type MeshGpuBufferCreationDiagnostic, type MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import { type UnlitBindGroupDescriptorDiagnostic, type UnlitBindGroupLayoutResource, type UnlitBindGroupResource, type UnlitBindGroupResourceDiagnostic } from "../unlit/unlit-bind-group.js";
import { type ViewUniformBufferDescriptorDiagnostic } from "../../resources/views/view-uniform-buffer.js";
import { type ViewUniformGpuBufferDiagnostic, type ViewUniformGpuBufferResource } from "../../resources/views/view-uniform-buffer-resource.js";
import { type WorldTransformBufferDescriptorDiagnostic, type WorldTransformGpuBufferDiagnostic, type WorldTransformGpuBufferResource } from "../../resources/transforms/world-transform-buffer.js";
export type DebugNormalFrameGpuResourceDiagnosticCode = "debugNormalFrameResources.missingMesh" | "debugNormalFrameResources.missingViewUniforms" | "debugNormalFrameResources.missingWorldTransforms" | "debugNormalFrameResources.missingMaterial";
export interface DebugNormalFrameGpuResourceDiagnostic {
    readonly code: DebugNormalFrameGpuResourceDiagnosticCode;
    readonly message: string;
}
export type CreateDebugNormalFrameGpuResourcesDiagnostic = DebugNormalFrameGpuResourceDiagnostic | MeshUploadPlanDiagnostic | MeshUploadBufferDescriptorDiagnostic | MeshGpuBufferCreationDiagnostic | ViewUniformBufferDescriptorDiagnostic | ViewUniformGpuBufferDiagnostic | WorldTransformBufferDescriptorDiagnostic | WorldTransformGpuBufferDiagnostic | DebugNormalMaterialPackingDiagnostic | DebugNormalMaterialBufferDescriptorDiagnostic | DebugNormalMaterialGpuBufferDiagnostic | DebugNormalMaterialBindGroupDescriptorDiagnostic | DebugNormalMaterialBindGroupResourceDiagnostic | UnlitBindGroupDescriptorDiagnostic | UnlitBindGroupResourceDiagnostic;
export interface DebugNormalFrameGpuResourceDeviceLike extends WebGpuBufferDeviceLike {
    createBindGroup?: (descriptor: unknown) => unknown;
}
export interface PreparedDebugNormalFrameMaterialResources {
    readonly material: DebugNormalMaterialGpuBufferResource;
    readonly bindGroup: DebugNormalMaterialBindGroupResource;
}
export interface CreateDebugNormalFrameGpuResourcesOptions {
    readonly device: DebugNormalFrameGpuResourceDeviceLike;
    readonly mesh: MeshAsset | null;
    readonly preparedMesh?: MeshGpuBufferResource | undefined;
    readonly preparedViewUniform?: ViewUniformGpuBufferResource | undefined;
    readonly preparedWorldTransforms?: WorldTransformGpuBufferResource | undefined;
    readonly viewUniforms: PackedSnapshotViewUniforms | null;
    readonly worldTransforms: PackedSnapshotTransforms | null;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly material: DebugNormalMaterialAsset | null;
    readonly preparedMaterial?: PreparedDebugNormalFrameMaterialResources | undefined;
    readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
    readonly materialLayout: DebugNormalMaterialBindGroupLayoutResource | null;
    readonly bindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
}
export interface DebugNormalFrameGpuResources {
    readonly mesh: MeshGpuBufferResource;
    readonly viewUniform: ViewUniformGpuBufferResource;
    readonly worldTransforms: WorldTransformGpuBufferResource;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource;
    readonly material: DebugNormalMaterialGpuBufferResource;
    readonly materialBindGroup: DebugNormalMaterialBindGroupResource;
    readonly bindGroups: readonly (UnlitBindGroupResource | DebugNormalMaterialBindGroupResource)[];
}
export interface CreateDebugNormalFrameGpuResourcesResult {
    readonly valid: boolean;
    readonly resources: DebugNormalFrameGpuResources | null;
    readonly diagnostics: readonly CreateDebugNormalFrameGpuResourcesDiagnostic[];
}
export declare function createDebugNormalFrameGpuResources(options: CreateDebugNormalFrameGpuResourcesOptions): CreateDebugNormalFrameGpuResourcesResult;
//# sourceMappingURL=debug-normal-frame-resources.d.ts.map