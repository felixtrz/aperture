import type { MaterialQueueFamily, RenderQueue } from "@aperture-engine/render";
import {
  createQueuedMaterialFrameResourceSetSummary,
  type QueuedMaterialFrameResourceFamilyBucketSummary,
  type QueuedMaterialFrameResourceFamilyPipelineBucketSummary,
  type QueuedMaterialFrameResourcePipelineBucketSummary,
  type QueuedMaterialFrameResourceSetSummary,
} from "./queued-material-frame-resource-set-summary.js";

export interface QueuedBuiltInResourceSetSummaryItem {
  readonly materialFamily: MaterialQueueFamily;
  readonly pipelineKey: string;
  readonly renderPhase: RenderQueue;
}

export type QueuedBuiltInResourceFamilyBucketSummary =
  QueuedMaterialFrameResourceFamilyBucketSummary;
export type QueuedBuiltInResourcePipelineBucketSummary =
  QueuedMaterialFrameResourcePipelineBucketSummary;
export type QueuedBuiltInResourceFamilyPipelineBucketSummary =
  QueuedMaterialFrameResourceFamilyPipelineBucketSummary;
export type QueuedBuiltInResourceSetSummary =
  QueuedMaterialFrameResourceSetSummary;

export interface CreateQueuedBuiltInResourceSetSummaryOptions {
  readonly byFamily?: readonly QueuedBuiltInResourceFamilyBucketSummary[];
}

export function createQueuedBuiltInResourceSetSummary(
  items: readonly QueuedBuiltInResourceSetSummaryItem[],
  options: CreateQueuedBuiltInResourceSetSummaryOptions = {},
): QueuedBuiltInResourceSetSummary {
  return createQueuedMaterialFrameResourceSetSummary(items, options);
}
