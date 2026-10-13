import { type MeshAsset, type MeshDrawPacket, type MeshUploadPlanDiagnostic, type PackedSnapshotInstanceTints, type PackedSnapshotTransforms, type PackedSnapshotViewUniforms, type RenderSnapshot, type StandardMaterialAsset } from "@aperture-engine/render";
import type { WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import type { CurrentTextureLike } from "../../app/presentation/current-texture-view.js";
import { type LightBindGroupDescriptorDiagnostic, type LightBindGroupResource, type LightBindGroupResourceDiagnostic, type StandardTransmissionSceneColorResources } from "../../lighting/light-bind-group.js";
import type { LocalLightClusterDescriptor, LocalLightClusterGpuResource, LocalLightClusterGpuResourceDiagnostic } from "../../lighting/local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "../../lighting/local-light-cookie-resources.js";
import type { LightBindGroupLayoutResource } from "../../lighting/light-bind-group-layout.js";
import { type CreateSnapshotLightGpuBuffersDiagnostic, type CreateSnapshotLightGpuBuffersResult } from "../../lighting/lighting-resource-plan.js";
import type { InstanceTintBufferDescriptorDiagnostic, InstanceTintGpuBufferDiagnostic, InstanceTintGpuBufferResource } from "../../resources/attributes/instance-tint-buffer.js";
import type { SkinningJointBufferDescriptorDiagnostic, SkinningJointGpuBufferDiagnostic, SkinningJointGpuBufferResource } from "../../resources/attributes/skinning-joint-buffer.js";
import type { MorphTargetWeightBufferDescriptorDiagnostic, MorphTargetWeightGpuBufferDiagnostic, MorphTargetWeightGpuBufferResource } from "../../resources/attributes/morph-target-weight-buffer.js";
import type { MorphTargetDeltaBufferDescriptorDiagnostic, MorphTargetDeltaGpuBufferDiagnostic, MorphTargetDeltaGpuBufferResource } from "../../resources/attributes/morph-target-delta-buffer.js";
import type { MorphInstanceDescriptorBufferDescriptorDiagnostic, MorphInstanceDescriptorGpuBufferDiagnostic, MorphInstanceDescriptorGpuBufferResource } from "../../resources/attributes/morph-instance-descriptor-buffer.js";
import type { MeshGpuBufferCreationDiagnostic, MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import type { MeshUploadBufferDescriptorDiagnostic } from "../../resources/meshes/mesh-buffer-descriptors.js";
import { type StandardMaterialBindGroupDescriptorDiagnostic, type StandardMaterialBindGroupLayoutResource, type StandardMaterialBindGroupResource, type StandardMaterialBindGroupResourceDiagnostic } from "./standard-bind-group.js";
import type { StandardMaterialIblBindGroupResource, StandardMaterialIblBindGroupResourceReport } from "./standard-material-ibl-bind-group.js";
import type { IblSamplerResourceReport } from "../../lighting/ibl-sampler-resource.js";
import type { BrdfLutResourceReport } from "../../lighting/brdf-lut-resource.js";
import type { DiffuseIblTextureResourceReport, SpecularIblTextureResourceReport } from "../../lighting/ibl-texture-resource.js";
import { type StandardLightShadowBindGroupDiagnostic, type StandardLightShadowBindGroupLayoutResource, type StandardLightShadowBindGroupResource } from "./standard-light-shadow-bind-group.js";
import type { StandardAreaLightLtcResources } from "./standard-area-light-ltc-resource.js";
import type { StandardMaterialGpuBufferDiagnostic, StandardMaterialGpuBufferResource } from "./standard-material-buffer-resource.js";
import type { ShadowDepthTextureResourceReport } from "../../shadows/shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "../../shadows/shadow-matrix-buffer-resource.js";
import type { ShadowSamplerResourceReport } from "./standard-material-shadow-bind-group.js";
import type { StandardMaterialBufferDescriptorDiagnostic, StandardMaterialPackingDiagnostic } from "./standard-material-buffer.js";
import type { SamplerGpuResource, TextureGpuResource } from "../../resources/textures/texture-resources.js";
import { type UnlitBindGroupDescriptorDiagnostic, type UnlitBindGroupLayoutResource, type UnlitBindGroupResource, type UnlitBindGroupResourceDiagnostic } from "../unlit/unlit-bind-group.js";
import type { ViewUniformBufferDescriptorDiagnostic } from "../../resources/views/view-uniform-buffer.js";
import type { ViewUniformGpuBufferDiagnostic, ViewUniformGpuBufferResource } from "../../resources/views/view-uniform-buffer-resource.js";
import type { WorldTransformBufferDescriptorDiagnostic, WorldTransformGpuBufferDiagnostic, WorldTransformGpuBufferResource } from "../../resources/transforms/world-transform-buffer.js";
export type StandardFrameGpuResourceDiagnosticCode = "standardFrameResources.missingMesh" | "standardFrameResources.missingViewUniforms" | "standardFrameResources.missingWorldTransforms" | "standardFrameResources.missingInstanceTints" | "standardFrameResources.missingMaterial" | "standardFrameResources.missingLights";
export interface StandardFrameGpuResourceDiagnostic {
    readonly code: StandardFrameGpuResourceDiagnosticCode;
    readonly message: string;
}
export type CreateStandardFrameGpuResourcesDiagnostic = StandardFrameGpuResourceDiagnostic | MeshUploadPlanDiagnostic | MeshUploadBufferDescriptorDiagnostic | MeshGpuBufferCreationDiagnostic | ViewUniformBufferDescriptorDiagnostic | ViewUniformGpuBufferDiagnostic | WorldTransformBufferDescriptorDiagnostic | WorldTransformGpuBufferDiagnostic | SkinningJointBufferDescriptorDiagnostic | SkinningJointGpuBufferDiagnostic | MorphTargetWeightBufferDescriptorDiagnostic | MorphTargetWeightGpuBufferDiagnostic | MorphTargetDeltaBufferDescriptorDiagnostic | MorphTargetDeltaGpuBufferDiagnostic | MorphInstanceDescriptorBufferDescriptorDiagnostic | MorphInstanceDescriptorGpuBufferDiagnostic | InstanceTintBufferDescriptorDiagnostic | InstanceTintGpuBufferDiagnostic | StandardMaterialPackingDiagnostic | StandardMaterialBufferDescriptorDiagnostic | StandardMaterialGpuBufferDiagnostic | StandardMaterialBindGroupDescriptorDiagnostic | StandardMaterialBindGroupResourceDiagnostic | CreateSnapshotLightGpuBuffersDiagnostic | LightBindGroupDescriptorDiagnostic | LightBindGroupResourceDiagnostic | LocalLightClusterGpuResourceDiagnostic | StandardLightShadowBindGroupDiagnostic | UnlitBindGroupDescriptorDiagnostic | UnlitBindGroupResourceDiagnostic;
export interface StandardFrameGpuResourceDeviceLike extends WebGpuBufferDeviceLike {
    createBindGroup?: (descriptor: unknown) => unknown;
}
export interface CreateStandardFrameGpuResourcesOptions {
    readonly device: StandardFrameGpuResourceDeviceLike;
    readonly snapshot: RenderSnapshot;
    readonly draw?: MeshDrawPacket;
    readonly pipelineKey: string;
    readonly mesh: MeshAsset | null;
    readonly preparedMesh?: MeshGpuBufferResource | undefined;
    readonly viewUniforms: PackedSnapshotViewUniforms | null;
    readonly preparedViewUniform?: ViewUniformGpuBufferResource | undefined;
    readonly worldTransforms: PackedSnapshotTransforms | null;
    readonly preparedWorldTransforms?: WorldTransformGpuBufferResource | undefined;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
    readonly instanceTints?: PackedSnapshotInstanceTints | null;
    readonly material: StandardMaterialAsset | null;
    readonly preparedMaterial?: PreparedStandardFrameMaterialResources | undefined;
    readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
    readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
    readonly lightLayout: LightBindGroupLayoutResource | StandardLightShadowBindGroupLayoutResource | null;
    readonly sharedBindGroupCache?: BindGroupResourceCache<UnlitBindGroupResource> | undefined;
    readonly lightBindGroupCache?: BindGroupResourceCache<LightBindGroupResource> | undefined;
    readonly standardLightShadowBindGroupCache?: BindGroupResourceCache<StandardLightShadowBindGroupResource> | undefined;
    readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
    readonly standardMaterialIblResources?: StandardFrameIblResources;
    readonly standardAreaLightLtcResources?: StandardAreaLightLtcResources | null;
    readonly localLightClusterDescriptor?: LocalLightClusterDescriptor | null;
    readonly localLightClusterResources?: LocalLightClusterGpuResource | null;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
    readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null;
    readonly textures?: readonly TextureGpuResource[];
    readonly samplers?: readonly SamplerGpuResource[];
}
export interface StandardFrameTransmissionSceneColorResources extends StandardTransmissionSceneColorResources {
    readonly texture: StandardTransmissionSceneColorResources["texture"] & {
        readonly texture: CurrentTextureLike;
        readonly width: number;
        readonly height: number;
        readonly format: string;
    };
}
export interface StandardFrameShadowReceiverResourceSet {
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource: ShadowSamplerResourceReport;
}
export interface StandardFrameShadowReceiverResources extends StandardFrameShadowReceiverResourceSet {
    readonly shadowKind?: "directional" | "directional-cascaded" | "point" | "point-array" | "directional-point-array" | "spot" | "spot-array" | "multi" | "multi-spot-array" | "multi-point-array" | "multi-spot-array-point-array";
    readonly spotShadowReceiverResources?: StandardFrameShadowReceiverResourceSet;
    readonly pointShadowReceiverResources?: StandardFrameShadowReceiverResourceSet;
}
export interface StandardFrameIblResources {
    readonly bindGroupResource: StandardMaterialIblBindGroupResourceReport;
    readonly diffuseTextureResource?: DiffuseIblTextureResourceReport;
    readonly specularTextureResource?: SpecularIblTextureResourceReport;
    readonly samplerResource?: IblSamplerResourceReport;
    readonly brdfLutTextureResource?: BrdfLutResourceReport;
}
export interface StandardFrameGpuResources {
    readonly mesh: MeshGpuBufferResource;
    readonly viewUniform: ViewUniformGpuBufferResource;
    readonly worldTransforms: WorldTransformGpuBufferResource;
    readonly previousWorldTransforms?: WorldTransformGpuBufferResource;
    readonly instanceTints?: InstanceTintGpuBufferResource;
    readonly skinningJointMatrices?: SkinningJointGpuBufferResource;
    readonly morphTargetWeights?: MorphTargetWeightGpuBufferResource;
    readonly morphTargetDeltas?: MorphTargetDeltaGpuBufferResource;
    readonly morphInstanceDescriptors?: MorphInstanceDescriptorGpuBufferResource;
    readonly material: StandardMaterialGpuBufferResource;
    readonly lightGpuBuffers: CreateSnapshotLightGpuBuffersResult;
    readonly localLightClusters?: LocalLightClusterGpuResource;
    readonly materialBindGroup: StandardMaterialBindGroupResource;
    readonly lightBindGroup: LightBindGroupResource | StandardLightShadowBindGroupResource;
    readonly standardMaterialIblBindGroup?: StandardMaterialIblBindGroupResource;
    readonly bindGroups: readonly UnlitBindGroupResource[];
}
export interface PreparedStandardFrameMaterialResources {
    readonly material: StandardMaterialGpuBufferResource;
    readonly bindGroup: StandardMaterialBindGroupResource;
}
export interface CreateStandardFrameGpuResourcesResult {
    readonly valid: boolean;
    readonly resources: StandardFrameGpuResources | null;
    readonly diagnostics: readonly CreateStandardFrameGpuResourcesDiagnostic[];
}
export declare function createStandardFrameGpuResources(options: CreateStandardFrameGpuResourcesOptions): CreateStandardFrameGpuResourcesResult;
//# sourceMappingURL=standard-frame-resources.d.ts.map