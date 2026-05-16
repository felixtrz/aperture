import type { RenderSnapshot } from "../rendering/index.js";
import {
  createLightBufferDescriptor,
  createLightBufferDescriptorPlan,
  createLightGpuBuffers,
  type CreateLightBufferDescriptorOptions,
  type CreateLightBufferDescriptorPlanOptions,
  type LightBufferDescriptorPlan,
  type LightBufferDescriptorPlanDiagnostic,
  type LightGpuBufferDiagnostic,
  type LightGpuBufferResource,
  type LightGpuBufferResourceJsonValue,
  type LightBufferDescriptor,
} from "./light-packing.js";
import type { WebGpuBufferDeviceLike } from "./buffer.js";
import {
  createLightBindGroupLayoutResource,
  type CreateLightBindGroupLayoutResourceOptions,
  type CreateLightBindGroupLayoutResourceResult,
  type LightBindGroupLayoutDiagnostic,
} from "./light-bind-group-layout.js";
import {
  createLightBindGroupDescriptorPlan,
  createLightBindGroupResource,
  createLightBindGroupResourceResultToJsonValue,
  lightBindGroupDescriptorPlanToJsonValue,
  type CreateLightBindGroupDescriptorPlanOptions,
  type CreateLightBindGroupResourceResult,
  type CreateLightBindGroupResourceResultJsonValue,
  type LightBindGroupDescriptorDiagnostic,
  type LightBindGroupDescriptorPlan,
  type LightBindGroupDescriptorPlanJsonValue,
  type LightBindGroupDeviceLike,
  type LightBindGroupResourceDiagnostic,
} from "./light-bind-group.js";
import type { WebGpuBindGroupLayoutDeviceLike } from "./bind-group-layout-cache.js";
import {
  planEnvironmentResources,
  type EnvironmentResourcePlan,
} from "./environment-resource-planning.js";
import {
  createRenderResourceSummaryReport,
  renderResourceSummaryReportToJson,
  renderResourceSummaryReportToJsonValue,
  type RenderResourceSummaryInput,
  type RenderResourceSummaryReportJsonValue,
  type RenderResourceSummaryReport,
} from "./resource-summary.js";

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

export interface SnapshotLightBindGroupDeviceLike
  extends
    WebGpuBufferDeviceLike,
    WebGpuBindGroupLayoutDeviceLike,
    LightBindGroupDeviceLike {}

export interface CreateSnapshotLightBindGroupResourcesOptions {
  readonly device: SnapshotLightBindGroupDeviceLike;
  readonly lightBuffer?: CreateLightBufferDescriptorOptions;
  readonly lightBufferDescriptorPlan?: CreateLightBufferDescriptorPlanOptions;
  readonly layout?: Omit<CreateLightBindGroupLayoutResourceOptions, "device">;
  readonly bindGroup?: Pick<
    CreateLightBindGroupDescriptorPlanOptions,
    "group" | "label"
  >;
}

export type CreateSnapshotLightGpuBuffersDiagnostic =
  | LightBufferDescriptorPlanDiagnostic
  | LightGpuBufferDiagnostic;

export interface CreateSnapshotLightGpuBuffersResult {
  readonly valid: boolean;
  readonly lightBuffer: LightBufferDescriptor;
  readonly descriptorPlan: LightBufferDescriptorPlan | null;
  readonly resource: LightGpuBufferResource | null;
  readonly diagnostics: readonly CreateSnapshotLightGpuBuffersDiagnostic[];
}

export type CreateSnapshotLightBindGroupResourcesDiagnostic =
  | CreateSnapshotLightGpuBuffersDiagnostic
  | LightBindGroupLayoutDiagnostic
  | LightBindGroupDescriptorDiagnostic
  | LightBindGroupResourceDiagnostic;

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

export type SnapshotLightingResourceSummaryInput = Pick<
  RenderResourceSummaryInput,
  "lightBuffers" | "environmentResources"
>;

export type SnapshotLightGpuBuffersSummaryInput = Pick<
  RenderResourceSummaryInput,
  "lightBuffers" | "lightGpuBufferResources"
>;

export type SnapshotLightBindGroupResourcesSummaryInput = Pick<
  RenderResourceSummaryInput,
  "lightBuffers" | "lightGpuBufferResources" | "lightBindGroupResources"
>;

export function planSnapshotLightingResources(
  snapshot: RenderSnapshot,
  options: PlanSnapshotLightingResourcesOptions = {},
): SnapshotLightingResourcePlan {
  return {
    lightBuffer: createLightBufferDescriptor(snapshot, options.lightBuffer),
    environments: planEnvironmentResources(snapshot),
  };
}

export function createSnapshotLightGpuBuffers(
  snapshot: RenderSnapshot,
  options: CreateSnapshotLightGpuBuffersOptions,
): CreateSnapshotLightGpuBuffersResult {
  const lightBuffer = createLightBufferDescriptor(
    snapshot,
    options.lightBuffer,
  );
  const descriptorPlan = createLightBufferDescriptorPlan(
    lightBuffer,
    options.descriptorPlan,
  );
  const diagnostics: CreateSnapshotLightGpuBuffersDiagnostic[] = [
    ...descriptorPlan.diagnostics,
  ];

  if (!descriptorPlan.valid) {
    return {
      valid: false,
      lightBuffer,
      descriptorPlan: null,
      resource: null,
      diagnostics,
    };
  }

  if (descriptorPlan.plan === null) {
    return {
      valid: true,
      lightBuffer,
      descriptorPlan: null,
      resource: null,
      diagnostics,
    };
  }

  const resource = createLightGpuBuffers({
    device: options.device,
    plan: descriptorPlan.plan,
  });

  diagnostics.push(...resource.diagnostics);

  return {
    valid: resource.valid,
    lightBuffer,
    descriptorPlan: descriptorPlan.plan,
    resource: resource.resource,
    diagnostics,
  };
}

export function createSnapshotLightBindGroupResources(
  snapshot: RenderSnapshot,
  options: CreateSnapshotLightBindGroupResourcesOptions,
): CreateSnapshotLightBindGroupResourcesResult {
  const diagnostics: CreateSnapshotLightBindGroupResourcesDiagnostic[] = [];
  const lightGpuBuffers = createSnapshotLightGpuBuffers(snapshot, {
    device: options.device,
    ...(options.lightBuffer === undefined
      ? {}
      : { lightBuffer: options.lightBuffer }),
    ...(options.lightBufferDescriptorPlan === undefined
      ? {}
      : { descriptorPlan: options.lightBufferDescriptorPlan }),
  });

  diagnostics.push(...lightGpuBuffers.diagnostics);

  if (
    lightGpuBuffers.valid &&
    lightGpuBuffers.lightBuffer.count === 0 &&
    lightGpuBuffers.resource === null
  ) {
    return {
      valid: true,
      lightGpuBuffers,
      layout: null,
      descriptorPlan: null,
      bindGroup: null,
      diagnostics,
    };
  }

  if (!lightGpuBuffers.valid || lightGpuBuffers.resource === null) {
    return {
      valid: false,
      lightGpuBuffers,
      layout: null,
      descriptorPlan: null,
      bindGroup: null,
      diagnostics,
    };
  }

  const layout = createLightBindGroupLayoutResource({
    device: options.device,
    ...options.layout,
  });

  diagnostics.push(...layout.diagnostics);

  if (!layout.valid || layout.resource === null) {
    return {
      valid: false,
      lightGpuBuffers,
      layout,
      descriptorPlan: null,
      bindGroup: null,
      diagnostics,
    };
  }

  const descriptorPlan = createLightBindGroupDescriptorPlan({
    lightGpuBufferResource: lightGpuBuffers.resource,
    layoutKey: layout.resource.layoutKey,
    group: options.bindGroup?.group ?? layout.resource.group,
    ...(options.bindGroup?.label === undefined
      ? {}
      : { label: options.bindGroup.label }),
  });

  diagnostics.push(...descriptorPlan.diagnostics);

  if (!descriptorPlan.valid) {
    return {
      valid: false,
      lightGpuBuffers,
      layout,
      descriptorPlan,
      bindGroup: null,
      diagnostics,
    };
  }

  const bindGroup = createLightBindGroupResource({
    device: options.device,
    plan: descriptorPlan,
    layout: layout.resource,
  });

  diagnostics.push(...bindGroup.diagnostics);

  return {
    valid: bindGroup.valid,
    lightGpuBuffers,
    layout,
    descriptorPlan,
    bindGroup,
    diagnostics,
  };
}

export function createSnapshotLightGpuBuffersResultToJsonValue(
  result: CreateSnapshotLightGpuBuffersResult,
): CreateSnapshotLightGpuBuffersResultJsonValue {
  return {
    valid: result.valid,
    lightBuffer: {
      resourceKey: result.lightBuffer.resourceKey,
      usageIntent: result.lightBuffer.usageIntent,
      count: result.lightBuffer.count,
      byteLength: result.lightBuffer.byteLength,
      floatByteLength: result.lightBuffer.floatByteLength,
      metadataByteLength: result.lightBuffer.metadataByteLength,
    },
    descriptorPlan:
      result.descriptorPlan === null
        ? { present: false }
        : {
            present: true,
            resourceKey: result.descriptorPlan.resourceKey,
            floatByteLength: result.descriptorPlan.floatDescriptor.size,
            metadataByteLength: result.descriptorPlan.metadataDescriptor.size,
          },
    resource:
      result.resource === null
        ? null
        : {
            resourceKey: result.resource.resourceKey,
            floatResourceKey: result.resource.floatResourceKey,
            metadataResourceKey: result.resource.metadataResourceKey,
            count: result.resource.count,
          },
    counts: {
      plannedLights: result.lightBuffer.count,
      plannedGpuBuffers: result.descriptorPlan === null ? 0 : 2,
      createdLights: result.resource?.count ?? 0,
      createdGpuBuffers: result.resource === null ? 0 : 2,
      diagnostics: result.diagnostics.length,
    },
    diagnostics: result.diagnostics.map(snapshotLightDiagnosticToJsonValue),
  };
}

export function createSnapshotLightGpuBuffersResultToJson(
  result: CreateSnapshotLightGpuBuffersResult,
): string {
  return JSON.stringify(createSnapshotLightGpuBuffersResultToJsonValue(result));
}

export function createSnapshotLightBindGroupResourcesResultToJsonValue(
  result: CreateSnapshotLightBindGroupResourcesResult,
): CreateSnapshotLightBindGroupResourcesResultJsonValue {
  return {
    valid: result.valid,
    phases: {
      lightGpuBuffers: result.lightGpuBuffers.valid,
      layout: result.layout?.valid ?? null,
      descriptorPlan: result.descriptorPlan?.valid ?? null,
      bindGroup: result.bindGroup?.valid ?? null,
    },
    lightGpuBuffers: createSnapshotLightGpuBuffersResultToJsonValue(
      result.lightGpuBuffers,
    ),
    layout: snapshotLightBindGroupLayoutResultToJsonValue(result.layout),
    descriptorPlan:
      result.descriptorPlan === null
        ? null
        : lightBindGroupDescriptorPlanToJsonValue(result.descriptorPlan),
    bindGroup:
      result.bindGroup === null
        ? null
        : createLightBindGroupResourceResultToJsonValue(result.bindGroup),
    counts: {
      plannedLights: result.lightGpuBuffers.lightBuffer.count,
      lightGpuBuffers: result.lightGpuBuffers.resource === null ? 0 : 1,
      layouts: result.layout?.resource == null ? 0 : 1,
      bindGroups: result.bindGroup?.resource == null ? 0 : 1,
      diagnostics: result.diagnostics.length,
    },
    diagnostics: result.diagnostics.map(
      snapshotLightBindGroupDiagnosticToJsonValue,
    ),
  };
}

export function createSnapshotLightBindGroupResourcesResultToJson(
  result: CreateSnapshotLightBindGroupResourcesResult,
): string {
  return JSON.stringify(
    createSnapshotLightBindGroupResourcesResultToJsonValue(result),
  );
}

export function snapshotLightingResourcePlanToJsonValue(
  plan: SnapshotLightingResourcePlan,
): SnapshotLightingResourcePlanJsonValue {
  return {
    lightBuffer: {
      resourceKey: plan.lightBuffer.resourceKey,
      usageIntent: plan.lightBuffer.usageIntent,
      count: plan.lightBuffer.count,
      byteLength: plan.lightBuffer.byteLength,
      floatByteLength: plan.lightBuffer.floatByteLength,
      metadataByteLength: plan.lightBuffer.metadataByteLength,
    },
    environments: {
      environmentCount: plan.environments.environmentCount,
      nullHandleCount: plan.environments.nullHandleCount,
      resourceKeys: plan.environments.requirements.map(
        (requirement) => requirement.resourceKey,
      ),
    },
  };
}

export function snapshotLightingResourcePlanToJson(
  plan: SnapshotLightingResourcePlan,
): string {
  return JSON.stringify(snapshotLightingResourcePlanToJsonValue(plan));
}

export function snapshotLightingResourcePlanToSummaryInput(
  plan: SnapshotLightingResourcePlan,
): SnapshotLightingResourceSummaryInput {
  return {
    lightBuffers: [plan.lightBuffer],
    environmentResources: [plan.environments],
  };
}

export function snapshotLightGpuBuffersToSummaryInput(
  result: CreateSnapshotLightGpuBuffersResult,
): SnapshotLightGpuBuffersSummaryInput {
  return {
    lightBuffers: [result.lightBuffer],
    lightGpuBufferResources:
      result.descriptorPlan === null
        ? []
        : [
            {
              valid: result.valid && result.resource !== null,
              resource: result.resource,
              diagnostics: result.diagnostics.filter(
                isLightGpuBufferDiagnostic,
              ),
            },
          ],
  };
}

export function snapshotLightBindGroupResourcesToSummaryInput(
  result: CreateSnapshotLightBindGroupResourcesResult,
): SnapshotLightBindGroupResourcesSummaryInput {
  return {
    lightBuffers: [result.lightGpuBuffers.lightBuffer],
    lightGpuBufferResources:
      result.lightGpuBuffers.descriptorPlan === null
        ? []
        : [
            {
              valid:
                result.lightGpuBuffers.valid &&
                result.lightGpuBuffers.resource !== null,
              resource: result.lightGpuBuffers.resource,
              diagnostics: result.lightGpuBuffers.diagnostics.filter(
                isLightGpuBufferDiagnostic,
              ),
            },
          ],
    lightBindGroupResources:
      result.bindGroup === null ? [] : [result.bindGroup],
  };
}

export function createSnapshotLightResourceSummaryReport(
  result: CreateSnapshotLightBindGroupResourcesResult,
): RenderResourceSummaryReport {
  return createRenderResourceSummaryReport({
    meshResources: [],
    materialResources: [],
    viewUniformResources: [],
    shaderResources: [],
    pipelines: [],
    ...snapshotLightBindGroupResourcesToSummaryInput(result),
  });
}

export function snapshotLightResourceSummaryReportToJsonValue(
  result: CreateSnapshotLightBindGroupResourcesResult,
): RenderResourceSummaryReportJsonValue {
  return renderResourceSummaryReportToJsonValue(
    createSnapshotLightResourceSummaryReport(result),
  );
}

export function snapshotLightResourceSummaryReportToJson(
  result: CreateSnapshotLightBindGroupResourcesResult,
): string {
  return renderResourceSummaryReportToJson(
    createSnapshotLightResourceSummaryReport(result),
  );
}

function snapshotLightDiagnosticToJsonValue(
  diagnostic: CreateSnapshotLightGpuBuffersDiagnostic,
): SnapshotLightGpuBufferDiagnosticJsonValue {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    ...("field" in diagnostic && diagnostic.field === undefined
      ? {}
      : "field" in diagnostic
        ? { field: diagnostic.field }
        : {}),
    ...("reason" in diagnostic && diagnostic.reason === undefined
      ? {}
      : "reason" in diagnostic
        ? { reason: diagnostic.reason }
        : {}),
    ...("resourceKey" in diagnostic && diagnostic.resourceKey === undefined
      ? {}
      : "resourceKey" in diagnostic
        ? { resourceKey: diagnostic.resourceKey }
        : {}),
  };
}

function isLightGpuBufferDiagnostic(
  diagnostic: CreateSnapshotLightGpuBuffersDiagnostic,
): diagnostic is LightGpuBufferDiagnostic {
  return diagnostic.code.startsWith("lightGpuBuffer.");
}

function snapshotLightBindGroupLayoutResultToJsonValue(
  result: CreateLightBindGroupLayoutResourceResult | null,
): SnapshotLightBindGroupLayoutResultJsonValue | null {
  if (result === null) {
    return null;
  }

  return {
    valid: result.valid,
    resource:
      result.resource === null
        ? null
        : {
            group: result.resource.group,
            layoutKey: result.resource.layoutKey,
          },
    counts: {
      layouts: result.resource === null ? 0 : 1,
      diagnostics: result.diagnostics.length,
    },
    diagnostics: result.diagnostics.map(
      snapshotLightBindGroupDiagnosticToJsonValue,
    ),
  };
}

function snapshotLightBindGroupDiagnosticToJsonValue(
  diagnostic: CreateSnapshotLightBindGroupResourcesDiagnostic,
): SnapshotLightBindGroupDiagnosticJsonValue {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    ...("field" in diagnostic && diagnostic.field === undefined
      ? {}
      : "field" in diagnostic
        ? { field: diagnostic.field }
        : {}),
    ...("reason" in diagnostic && diagnostic.reason === undefined
      ? {}
      : "reason" in diagnostic
        ? { reason: diagnostic.reason }
        : {}),
    ...("resourceKey" in diagnostic && diagnostic.resourceKey === undefined
      ? {}
      : "resourceKey" in diagnostic
        ? { resourceKey: diagnostic.resourceKey }
        : {}),
    ...("layoutKey" in diagnostic && diagnostic.layoutKey === undefined
      ? {}
      : "layoutKey" in diagnostic
        ? { layoutKey: diagnostic.layoutKey }
        : {}),
  };
}
