import type { RenderSnapshot } from "../rendering/index.js";
import {
  createLightBufferDescriptor,
  type CreateLightBufferDescriptorOptions,
  type LightBufferDescriptor,
} from "./light-packing.js";
import {
  planEnvironmentResources,
  type EnvironmentResourcePlan,
} from "./environment-resource-planning.js";
import type { RenderResourceSummaryInput } from "./resource-summary.js";

export interface SnapshotLightingResourcePlan {
  readonly lightBuffer: LightBufferDescriptor;
  readonly environments: EnvironmentResourcePlan;
}

export interface PlanSnapshotLightingResourcesOptions {
  readonly lightBuffer?: CreateLightBufferDescriptorOptions;
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

export function planSnapshotLightingResources(
  snapshot: RenderSnapshot,
  options: PlanSnapshotLightingResourcesOptions = {},
): SnapshotLightingResourcePlan {
  return {
    lightBuffer: createLightBufferDescriptor(snapshot, options.lightBuffer),
    environments: planEnvironmentResources(snapshot),
  };
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
