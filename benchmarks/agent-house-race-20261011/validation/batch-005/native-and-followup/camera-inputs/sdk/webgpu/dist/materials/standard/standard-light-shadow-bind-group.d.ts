import { type BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import type { WebGpuBindGroupLayoutDescriptor } from "../../gpu/bind-group-layout-cache.js";
import type { IblSamplerResourceReport } from "../../lighting/ibl-sampler-resource.js";
import type { DiffuseIblTextureResourceReport, SpecularIblTextureResourceReport } from "../../lighting/ibl-texture-resource.js";
import type { LightGpuBufferResource } from "../../lighting/light-packing.js";
import type { ShadowDepthTextureResourceReport } from "../../shadows/shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "../../shadows/shadow-matrix-buffer-resource.js";
import type { StandardAreaLightLtcResources } from "./standard-area-light-ltc-resource.js";
import type { LocalLightClusterGpuResource } from "../../lighting/local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "../../lighting/local-light-cookie-resources.js";
import type { ShadowSamplerResourceReport } from "./standard-material-shadow-bind-group.js";
import { STANDARD_LIGHT_SHADOW_BIND_GROUP } from "./standard-light-shadow-bind-group-constants.js";
export { STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_POINT_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_SHADOW_BIND_GROUP, STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY, } from "./standard-light-shadow-bind-group-constants.js";
export { createStandardLightCascadedShadowBindGroupLayoutDescriptor, createStandardLightIblBindGroupLayoutDescriptor, createStandardLightMultiShadowBindGroupLayoutDescriptor, createStandardLightPointShadowBindGroupLayoutDescriptor, createStandardLightShadowBindGroupLayoutDescriptor, } from "./standard-light-shadow-bind-group-layouts.js";
export type StandardLightShadowBindGroupDiagnosticCode = "standardLightShadowBindGroup.missingLayoutKey" | "standardLightShadowBindGroup.missingLightGpuBufferResource" | "standardLightShadowBindGroup.missingMatrixBufferResource" | "standardLightShadowBindGroup.missingDepthTextureResource" | "standardLightShadowBindGroup.missingSamplerResource" | "standardLightShadowBindGroup.missingDiffuseIblTextureResource" | "standardLightShadowBindGroup.missingIblSamplerResource" | "standardLightShadowBindGroupResource.nullDescriptorPlan" | "standardLightShadowBindGroupResource.invalidDescriptorPlan" | "standardLightShadowBindGroupResource.missingLayout" | "standardLightShadowBindGroupResource.missingDeviceSupport" | "standardLightShadowBindGroupResource.creationFailed";
export interface StandardLightShadowBindGroupDiagnostic {
    readonly code: StandardLightShadowBindGroupDiagnosticCode;
    readonly message: string;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface StandardLightShadowBindGroupDescriptorEntry {
    readonly binding: number;
    readonly resourceKey: string;
    readonly resourceKind: "buffer" | "texture-view" | "sampler";
}
export interface StandardLightShadowBindGroupDescriptorPlan {
    readonly valid: boolean;
    readonly group: typeof STANDARD_LIGHT_SHADOW_BIND_GROUP;
    readonly label: string;
    readonly resourceKey: string | null;
    readonly layoutKey: string | null;
    readonly entries: readonly StandardLightShadowBindGroupDescriptorEntry[];
    readonly diagnostics: readonly StandardLightShadowBindGroupDiagnostic[];
}
export interface StandardLightShadowBindGroupResource {
    readonly group: typeof STANDARD_LIGHT_SHADOW_BIND_GROUP;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface CreateStandardLightShadowBindGroupResourceResult {
    readonly valid: boolean;
    readonly resource: StandardLightShadowBindGroupResource | null;
    readonly diagnostics: readonly StandardLightShadowBindGroupDiagnostic[];
}
export interface CreateStandardLightShadowBindGroupDescriptorPlanOptions {
    readonly lightGpuBufferResource: LightGpuBufferResource | null;
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource: ShadowSamplerResourceReport;
    readonly areaLightLtcResources?: StandardAreaLightLtcResources | null;
    readonly localLightClusterResources?: LocalLightClusterGpuResource | null;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
    readonly reuseShadowMatricesForLocalLightCookies?: boolean;
    readonly layoutKey?: string | null;
    readonly label?: string;
}
export interface CreateStandardLightMultiShadowBindGroupDescriptorPlanOptions {
    readonly lightGpuBufferResource: LightGpuBufferResource | null;
    readonly directionalShadowReceiverResources: StandardLightIblShadowReceiverResources;
    readonly spotShadowReceiverResources?: StandardLightIblShadowReceiverResources;
    readonly pointShadowReceiverResources: StandardLightIblShadowReceiverResources;
    readonly areaLightLtcResources?: StandardAreaLightLtcResources | null;
    readonly localLightClusterResources?: LocalLightClusterGpuResource | null;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
    readonly reuseShadowMatricesForLocalLightCookies?: boolean;
    readonly layoutKey?: string | null;
    readonly label?: string;
}
export interface CreateStandardLightIblBindGroupDescriptorPlanOptions {
    readonly lightGpuBufferResource: LightGpuBufferResource | null;
    readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
    readonly specularTextureResource?: SpecularIblTextureResourceReport;
    readonly samplerResource: IblSamplerResourceReport;
    readonly shadowReceiverResources?: StandardLightIblShadowReceiverResources;
    readonly pointShadowReceiverResources?: StandardLightIblShadowReceiverResources;
    readonly shadowRequired?: boolean;
    readonly cascadedShadowMap?: boolean;
    readonly areaLightLtcResources?: StandardAreaLightLtcResources | null;
    readonly localLightClusterResources?: LocalLightClusterGpuResource | null;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
    readonly reuseShadowMatricesForLocalLightCookies?: boolean;
    readonly layoutKey?: string | null;
    readonly label?: string;
}
export interface StandardLightIblShadowReceiverResources {
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource: ShadowSamplerResourceReport;
}
export interface StandardLightShadowBindGroupLayoutResource {
    readonly group: typeof STANDARD_LIGHT_SHADOW_BIND_GROUP;
    readonly layoutKey: string;
    readonly layout: unknown;
    readonly descriptor: WebGpuBindGroupLayoutDescriptor;
}
export interface StandardLightShadowBindGroupDeviceLike {
    createBindGroup?: (descriptor: {
        readonly label: string;
        readonly layout: unknown;
        readonly entries: readonly {
            readonly binding: number;
            readonly resource: unknown;
        }[];
    }) => unknown;
}
export declare function createStandardLightShadowBindGroupLayoutResource(createBindGroupLayout: (descriptor: WebGpuBindGroupLayoutDescriptor) => unknown, layoutKey?: string): StandardLightShadowBindGroupLayoutResource;
export declare function createStandardLightShadowBindGroupDescriptorPlan(options: CreateStandardLightShadowBindGroupDescriptorPlanOptions): StandardLightShadowBindGroupDescriptorPlan;
export declare function createStandardLightMultiShadowBindGroupDescriptorPlan(options: CreateStandardLightMultiShadowBindGroupDescriptorPlanOptions): StandardLightShadowBindGroupDescriptorPlan;
export declare function createStandardLightIblBindGroupDescriptorPlan(options: CreateStandardLightIblBindGroupDescriptorPlanOptions): StandardLightShadowBindGroupDescriptorPlan;
export declare function createStandardLightShadowBindGroupResource(options: {
    readonly device: StandardLightShadowBindGroupDeviceLike;
    readonly plan: StandardLightShadowBindGroupDescriptorPlan | null;
    readonly layout: StandardLightShadowBindGroupLayoutResource | null;
    readonly bindGroupCache?: BindGroupResourceCache<StandardLightShadowBindGroupResource> | undefined;
    readonly lightGpuBufferResource: LightGpuBufferResource | null;
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource: ShadowSamplerResourceReport;
    readonly additionalShadowReceiverResources?: readonly StandardLightIblShadowReceiverResources[];
    readonly diffuseTextureResource?: DiffuseIblTextureResourceReport;
    readonly specularTextureResource?: SpecularIblTextureResourceReport;
    readonly iblSamplerResource?: IblSamplerResourceReport;
    readonly areaLightLtcResources?: StandardAreaLightLtcResources | null;
    readonly localLightClusterResources?: LocalLightClusterGpuResource | null;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
}): CreateStandardLightShadowBindGroupResourceResult;
//# sourceMappingURL=standard-light-shadow-bind-group.d.ts.map