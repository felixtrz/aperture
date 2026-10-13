import { type BindGroupResourceCache } from "../gpu/bind-group-resource-cache.js";
import type { LightGpuBufferResource } from "./light-packing.js";
import { type LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import { type StandardAreaLightLtcResources } from "../materials/standard/standard-area-light-ltc-resource.js";
import { type LocalLightClusterGpuResource } from "./local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "./local-light-cookie-resources.js";
export declare const STANDARD_TRANSMISSION_SCENE_COLOR_TEXTURE_BINDING = 14;
export declare const STANDARD_TRANSMISSION_SCENE_COLOR_SAMPLER_BINDING = 15;
export type LightBindGroupDescriptorDiagnosticCode = "lightBindGroup.missingLightGpuBufferResource" | "lightBindGroup.missingLayoutKey";
export interface LightBindGroupDescriptorDiagnostic {
    readonly code: LightBindGroupDescriptorDiagnosticCode;
    readonly message: string;
}
export interface CreateLightBindGroupDescriptorPlanOptions {
    readonly lightGpuBufferResource: LightGpuBufferResource | null;
    readonly areaLightLtcResources?: StandardAreaLightLtcResources | null;
    readonly transmissionSceneColorResources?: StandardTransmissionSceneColorResources | null;
    readonly localLightClusterResources?: LocalLightClusterGpuResource | null;
    readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
    readonly pipelineKey?: string | null;
    readonly layoutKey: string | null;
    readonly group?: number;
    readonly label?: string;
}
export interface StandardTransmissionSceneColorResources {
    readonly texture: {
        readonly resourceKey: string;
        readonly view: unknown;
    };
    readonly sampler: {
        readonly resourceKey: string;
        readonly sampler: unknown;
    };
}
export interface LightBindGroupDescriptorEntry {
    readonly binding: number;
    readonly resourceKey: string;
    readonly resource: {
        readonly buffer: unknown;
    } | {
        readonly textureView: unknown;
    } | {
        readonly sampler: unknown;
    };
}
export interface LightBindGroupDescriptorPlan {
    readonly valid: boolean;
    readonly group: number;
    readonly label: string;
    readonly resourceKey: string | null;
    readonly layoutKey: string | null;
    readonly pipelineKey?: string;
    readonly entries: readonly LightBindGroupDescriptorEntry[];
    readonly diagnostics: readonly LightBindGroupDescriptorDiagnostic[];
}
export interface LightBindGroupDescriptorPlanJsonValue {
    readonly valid: boolean;
    readonly group: number;
    readonly label: string;
    readonly resourceKey: string | null;
    readonly layoutKey: string | null;
    readonly pipelineKey?: string;
    readonly entries: readonly {
        readonly binding: number;
        readonly resourceKey: string;
        readonly resourceKind: "buffer" | "texture-view" | "sampler";
    }[];
    readonly diagnostics: readonly LightBindGroupDescriptorDiagnostic[];
}
export type LightBindGroupResourceDiagnosticCode = "lightBindGroupResource.nullDescriptorPlan" | "lightBindGroupResource.invalidDescriptorPlan" | "lightBindGroupResource.missingLayout" | "lightBindGroupResource.missingDeviceSupport" | "lightBindGroupResource.creationFailed";
export interface LightBindGroupResourceDiagnostic {
    readonly code: LightBindGroupResourceDiagnosticCode;
    readonly message: string;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface LightBindGroupCreationEntry {
    readonly binding: number;
    readonly resource: unknown;
}
export interface LightBindGroupCreationDescriptor {
    readonly label: string;
    readonly layout: unknown;
    readonly entries: readonly LightBindGroupCreationEntry[];
}
export interface LightBindGroupDeviceLike {
    createBindGroup?: (descriptor: LightBindGroupCreationDescriptor) => unknown;
}
export interface LightBindGroupResource {
    readonly group: number;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface CreateLightBindGroupResourceOptions {
    readonly device: LightBindGroupDeviceLike;
    readonly plan: LightBindGroupDescriptorPlan | null;
    readonly layout: LightBindGroupLayoutResource | null;
    readonly bindGroupCache?: BindGroupResourceCache<LightBindGroupResource> | undefined;
}
export interface CreateLightBindGroupResourceResult {
    readonly valid: boolean;
    readonly resource: LightBindGroupResource | null;
    readonly diagnostics: readonly LightBindGroupResourceDiagnostic[];
}
export interface LightBindGroupResourceJsonValue {
    readonly group: number;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly entryResourceKeys: readonly string[];
}
export interface CreateLightBindGroupResourceResultJsonValue {
    readonly valid: boolean;
    readonly resource: LightBindGroupResourceJsonValue | null;
    readonly counts: {
        readonly bindGroups: number;
        readonly entries: number;
        readonly diagnostics: number;
    };
    readonly diagnostics: readonly LightBindGroupResourceDiagnostic[];
}
export declare function lightBindGroupResourceKey(lightBufferResourceKey: string, group?: number, pipelineKey?: string | null): string;
export declare function createLightBindGroupDescriptorPlan(options: CreateLightBindGroupDescriptorPlanOptions): LightBindGroupDescriptorPlan;
export declare function lightBindGroupDescriptorPlanToJsonValue(plan: LightBindGroupDescriptorPlan): LightBindGroupDescriptorPlanJsonValue;
export declare function lightBindGroupDescriptorPlanToJson(plan: LightBindGroupDescriptorPlan): string;
export declare function createLightBindGroupResource(options: CreateLightBindGroupResourceOptions): CreateLightBindGroupResourceResult;
export declare function createLightBindGroupResourceResultToJsonValue(result: CreateLightBindGroupResourceResult): CreateLightBindGroupResourceResultJsonValue;
export declare function createLightBindGroupResourceResultToJson(result: CreateLightBindGroupResourceResult): string;
//# sourceMappingURL=light-bind-group.d.ts.map