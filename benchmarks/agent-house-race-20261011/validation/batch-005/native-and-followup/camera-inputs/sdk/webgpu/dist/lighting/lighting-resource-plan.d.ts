import type { RenderSnapshot } from "@aperture-engine/render";
import { type CreateLightBufferDescriptorOptions, type CreateLightBufferDescriptorPlanOptions, type LightBufferDescriptorPlan, type LightBufferDescriptorPlanDiagnostic, type LightGpuBufferDiagnostic, type LightGpuBufferResource, type LightGpuBufferResourceJsonValue, type LightBufferDescriptor } from "./light-packing.js";
import type { WebGpuBufferDeviceLike } from "../gpu/buffer.js";
import { type CreateLightBindGroupLayoutResourceOptions, type CreateLightBindGroupLayoutResourceResult, type LightBindGroupLayoutDiagnostic } from "./light-bind-group-layout.js";
import { type CreateLightBindGroupDescriptorPlanOptions, type CreateLightBindGroupResourceResult, type CreateLightBindGroupResourceResultJsonValue, type LightBindGroupDescriptorDiagnostic, type LightBindGroupDescriptorPlan, type LightBindGroupDescriptorPlanJsonValue, type LightBindGroupDeviceLike, type LightBindGroupResourceDiagnostic } from "./light-bind-group.js";
import type { WebGpuBindGroupLayoutDeviceLike } from "../gpu/bind-group-layout-cache.js";
import { type EnvironmentResourcePlan } from "./environment-resource-planning.js";
import { type RenderResourceSummaryInput, type RenderResourceSummaryReportJsonValue, type RenderResourceSummaryReport } from "../resources/core/resource-summary.js";
export interface SnapshotLightingResourcePlan {
    readonly lightBuffer: LightBufferDescriptor;
    readonly environments: EnvironmentResourcePlan;
}
export interface PlanSnapshotLightingResourcesOptions {
    readonly lightBuffer?: CreateLightBufferDescriptorOptions;
}
export interface CreateSnapshotLightGpuBuffersOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly lightBuffer?: CreateLightBufferDescriptorOptions;
    readonly descriptorPlan?: CreateLightBufferDescriptorPlanOptions;
}
export interface SnapshotLightBindGroupDeviceLike extends WebGpuBufferDeviceLike, WebGpuBindGroupLayoutDeviceLike, LightBindGroupDeviceLike {
}
export interface CreateSnapshotLightBindGroupResourcesOptions {
    readonly device: SnapshotLightBindGroupDeviceLike;
    readonly lightBuffer?: CreateLightBufferDescriptorOptions;
    readonly lightBufferDescriptorPlan?: CreateLightBufferDescriptorPlanOptions;
    readonly layout?: Omit<CreateLightBindGroupLayoutResourceOptions, "device">;
    readonly bindGroup?: Pick<CreateLightBindGroupDescriptorPlanOptions, "group" | "label">;
}
export type CreateSnapshotLightGpuBuffersDiagnostic = LightBufferDescriptorPlanDiagnostic | LightGpuBufferDiagnostic;
export interface CreateSnapshotLightGpuBuffersResult {
    readonly valid: boolean;
    readonly lightBuffer: LightBufferDescriptor;
    readonly descriptorPlan: LightBufferDescriptorPlan | null;
    readonly resource: LightGpuBufferResource | null;
    readonly diagnostics: readonly CreateSnapshotLightGpuBuffersDiagnostic[];
}
export type CreateSnapshotLightBindGroupResourcesDiagnostic = CreateSnapshotLightGpuBuffersDiagnostic | LightBindGroupLayoutDiagnostic | LightBindGroupDescriptorDiagnostic | LightBindGroupResourceDiagnostic;
export interface CreateSnapshotLightBindGroupResourcesResult {
    readonly valid: boolean;
    readonly lightGpuBuffers: CreateSnapshotLightGpuBuffersResult;
    readonly layout: CreateLightBindGroupLayoutResourceResult | null;
    readonly descriptorPlan: LightBindGroupDescriptorPlan | null;
    readonly bindGroup: CreateLightBindGroupResourceResult | null;
    readonly diagnostics: readonly CreateSnapshotLightBindGroupResourcesDiagnostic[];
}
export interface SnapshotLightGpuBufferDiagnosticJsonValue {
    readonly code: CreateSnapshotLightGpuBuffersDiagnostic["code"];
    readonly message: string;
    readonly field?: string;
    readonly reason?: string;
    readonly resourceKey?: string;
}
export interface CreateSnapshotLightGpuBuffersResultJsonValue {
    readonly valid: boolean;
    readonly lightBuffer: {
        readonly resourceKey: string;
        readonly usageIntent: LightBufferDescriptor["usageIntent"];
        readonly count: number;
        readonly byteLength: number;
        readonly floatByteLength: number;
        readonly metadataByteLength: number;
    };
    readonly descriptorPlan: {
        readonly present: boolean;
        readonly resourceKey?: string;
        readonly floatByteLength?: number;
        readonly metadataByteLength?: number;
    };
    readonly resource: LightGpuBufferResourceJsonValue | null;
    readonly counts: {
        readonly plannedLights: number;
        readonly plannedGpuBuffers: number;
        readonly createdLights: number;
        readonly createdGpuBuffers: number;
        readonly diagnostics: number;
    };
    readonly diagnostics: readonly SnapshotLightGpuBufferDiagnosticJsonValue[];
}
export interface SnapshotLightBindGroupDiagnosticJsonValue {
    readonly code: string;
    readonly message: string;
    readonly field?: string;
    readonly reason?: string;
    readonly resourceKey?: string;
    readonly layoutKey?: string;
}
export interface SnapshotLightBindGroupLayoutResultJsonValue {
    readonly valid: boolean;
    readonly resource: {
        readonly group: number;
        readonly layoutKey: string;
    } | null;
    readonly counts: {
        readonly layouts: number;
        readonly diagnostics: number;
    };
    readonly diagnostics: readonly SnapshotLightBindGroupDiagnosticJsonValue[];
}
export interface CreateSnapshotLightBindGroupResourcesResultJsonValue {
    readonly valid: boolean;
    readonly phases: {
        readonly lightGpuBuffers: boolean;
        readonly layout: boolean | null;
        readonly descriptorPlan: boolean | null;
        readonly bindGroup: boolean | null;
    };
    readonly lightGpuBuffers: CreateSnapshotLightGpuBuffersResultJsonValue;
    readonly layout: SnapshotLightBindGroupLayoutResultJsonValue | null;
    readonly descriptorPlan: LightBindGroupDescriptorPlanJsonValue | null;
    readonly bindGroup: CreateLightBindGroupResourceResultJsonValue | null;
    readonly counts: {
        readonly plannedLights: number;
        readonly lightGpuBuffers: number;
        readonly layouts: number;
        readonly bindGroups: number;
        readonly diagnostics: number;
    };
    readonly diagnostics: readonly SnapshotLightBindGroupDiagnosticJsonValue[];
}
export interface SnapshotLightingResourcePlanJsonValue {
    readonly lightBuffer: {
        readonly resourceKey: string;
        readonly usageIntent: LightBufferDescriptor["usageIntent"];
        readonly count: number;
        readonly byteLength: number;
        readonly floatByteLength: number;
        readonly metadataByteLength: number;
    };
    readonly environments: {
        readonly environmentCount: number;
        readonly nullHandleCount: number;
        readonly resourceKeys: readonly string[];
    };
}
export type SnapshotLightingResourceSummaryInput = Pick<RenderResourceSummaryInput, "lightBuffers" | "environmentResources">;
export type SnapshotLightGpuBuffersSummaryInput = Pick<RenderResourceSummaryInput, "lightBuffers" | "lightGpuBufferResources">;
export type SnapshotLightBindGroupResourcesSummaryInput = Pick<RenderResourceSummaryInput, "lightBuffers" | "lightGpuBufferResources" | "lightBindGroupResources">;
export declare function planSnapshotLightingResources(snapshot: RenderSnapshot, options?: PlanSnapshotLightingResourcesOptions): SnapshotLightingResourcePlan;
export declare function createSnapshotLightGpuBuffers(snapshot: RenderSnapshot, options: CreateSnapshotLightGpuBuffersOptions): CreateSnapshotLightGpuBuffersResult;
export declare function createSnapshotLightBindGroupResources(snapshot: RenderSnapshot, options: CreateSnapshotLightBindGroupResourcesOptions): CreateSnapshotLightBindGroupResourcesResult;
export declare function createSnapshotLightGpuBuffersResultToJsonValue(result: CreateSnapshotLightGpuBuffersResult): CreateSnapshotLightGpuBuffersResultJsonValue;
export declare function createSnapshotLightGpuBuffersResultToJson(result: CreateSnapshotLightGpuBuffersResult): string;
export declare function createSnapshotLightBindGroupResourcesResultToJsonValue(result: CreateSnapshotLightBindGroupResourcesResult): CreateSnapshotLightBindGroupResourcesResultJsonValue;
export declare function createSnapshotLightBindGroupResourcesResultToJson(result: CreateSnapshotLightBindGroupResourcesResult): string;
export declare function snapshotLightingResourcePlanToJsonValue(plan: SnapshotLightingResourcePlan): SnapshotLightingResourcePlanJsonValue;
export declare function snapshotLightingResourcePlanToJson(plan: SnapshotLightingResourcePlan): string;
export declare function snapshotLightingResourcePlanToSummaryInput(plan: SnapshotLightingResourcePlan): SnapshotLightingResourceSummaryInput;
export declare function snapshotLightGpuBuffersToSummaryInput(result: CreateSnapshotLightGpuBuffersResult): SnapshotLightGpuBuffersSummaryInput;
export declare function snapshotLightBindGroupResourcesToSummaryInput(result: CreateSnapshotLightBindGroupResourcesResult): SnapshotLightBindGroupResourcesSummaryInput;
export declare function createSnapshotLightResourceSummaryReport(result: CreateSnapshotLightBindGroupResourcesResult): RenderResourceSummaryReport;
export declare function snapshotLightResourceSummaryReportToJsonValue(result: CreateSnapshotLightBindGroupResourcesResult): RenderResourceSummaryReportJsonValue;
export declare function snapshotLightResourceSummaryReportToJson(result: CreateSnapshotLightBindGroupResourcesResult): string;
//# sourceMappingURL=lighting-resource-plan.d.ts.map