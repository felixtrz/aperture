import { type MeshAsset, type PackedSnapshotTransforms, type PackedSnapshotViewUniforms, type PreparedCustomWgslMaterial, type RuntimeUniformPacket } from "@aperture-engine/render";
import { type WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
import { type MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import { type ViewUniformGpuBufferResource } from "../../resources/views/view-uniform-buffer-resource.js";
import { type WorldTransformGpuBufferResource } from "../../resources/transforms/world-transform-buffer.js";
import { type UnlitBindGroupResource } from "../unlit/unlit-bind-group.js";
import { type CustomWgslMaterialBindGroupResource, type CustomWgslMaterialDeviceLike, type CustomWgslMaterialGpuResource, type CustomWgslMaterialRenderPipelineResource, type CreateCustomWgslMaterialRenderPipelineResourceResult, type CustomWgslMaterialRenderResources } from "./custom-wgsl-material.js";
interface CustomWgslAppFrameResources {
    readonly mesh: MeshGpuBufferResource;
    readonly viewUniform: ViewUniformGpuBufferResource;
    readonly worldTransforms: WorldTransformGpuBufferResource;
    readonly material: CustomWgslMaterialBindGroupResource;
    readonly custom: CustomWgslMaterialRenderResources;
    readonly bindGroups: readonly (UnlitBindGroupResource | CustomWgslMaterialBindGroupResource)[];
}
export interface CustomWgslRuntimeUniformBufferResource {
    readonly key: string;
    readonly buffer: unknown;
    readonly byteLength: number;
    valueKey: string;
}
export interface CustomWgslRuntimeUniformReuseCounters {
    dynamicBufferWrites: number;
}
export interface CreateCustomWgslAppFrameResourcesResult {
    readonly valid: boolean;
    readonly resources: CustomWgslAppFrameResources | null;
    readonly pipelineResult: CreateCustomWgslMaterialRenderPipelineResourceResult | null;
    readonly pipeline: CustomWgslMaterialRenderPipelineResource | null;
    readonly diagnostics: readonly unknown[];
}
export declare function createCustomWgslAppFrameResources(options: {
    readonly device: WebGpuBufferDeviceLike & CustomWgslMaterialDeviceLike;
    readonly mesh: MeshAsset;
    readonly material: PreparedCustomWgslMaterial;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly colorFormat: string;
    readonly depthFormat?: string | null;
    readonly sampleCount?: number;
    readonly pipelineResult?: CreateCustomWgslMaterialRenderPipelineResourceResult;
    readonly bindingResources?: readonly CustomWgslMaterialGpuResource[];
    readonly bindingResourceDiagnostics?: readonly unknown[];
    readonly runtimeUniforms?: readonly RuntimeUniformPacket[];
    readonly runtimeUniformCache?: Map<string, CustomWgslRuntimeUniformBufferResource>;
    readonly reuse?: CustomWgslRuntimeUniformReuseCounters;
}): Promise<CreateCustomWgslAppFrameResourcesResult>;
export {};
//# sourceMappingURL=custom-wgsl-app-frame-resources.d.ts.map