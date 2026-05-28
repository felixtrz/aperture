import type {
  PlanRenderQueueOptions,
  RenderQueuePlan,
  RenderQueueScratch,
} from "./render-queue-types.js";
import {
  batchStaticRenderQueueRecords,
  sortRenderQueueRecords,
  writeRenderQueueSortPhases,
} from "./render-queue-sort.js";
import { writeUnsortedRenderQueueRecords } from "./render-queue.js";
import type { RenderWorldDrawReadinessReport } from "./render-world.js";
import type { PackedSnapshotTransforms } from "./transform-pack.js";

export const RENDER_FRAME_PHASE_ORDER = [
  "extract",
  "asset-change-collection",
  "prepare",
  "queue",
  "sort",
  "submit",
] as const;

export type RenderFramePhaseName = (typeof RENDER_FRAME_PHASE_ORDER)[number];

export interface RenderFramePhaseDescriptor {
  readonly name: RenderFramePhaseName;
  readonly summary: string;
  readonly consumes: readonly string[];
  readonly produces: readonly string[];
}

export interface RenderFrameQueuePhaseResult extends RenderQueuePlan {
  readonly phase: "queue";
}

export interface RenderFrameSortPhaseResult extends RenderQueuePlan {
  readonly phase: "sort";
}

export const RENDER_FRAME_PHASE_DESCRIPTORS: readonly RenderFramePhaseDescriptor[] =
  [
    {
      name: "extract",
      summary:
        "Copy render-relevant ECS state into a serializable render snapshot.",
      consumes: ["ECS world", "asset registry"],
      produces: ["RenderSnapshot"],
    },
    {
      name: "asset-change-collection",
      summary:
        "Identify source asset handles, versions, dependencies, and readiness changes.",
      consumes: ["RenderSnapshot", "asset registry"],
      produces: ["source asset change set"],
    },
    {
      name: "prepare",
      summary:
        "Prepare renderer-owned resources from ready source assets and extracted data.",
      consumes: ["source asset change set", "RenderSnapshot"],
      produces: ["prepared render resources"],
    },
    {
      name: "queue",
      summary:
        "Build view/pass-scoped queue records from ready render-world draws.",
      consumes: ["draw readiness", "packed transforms"],
      produces: ["unsorted queue records"],
    },
    {
      name: "sort",
      summary:
        "Order queued records deterministically for render phase submission.",
      consumes: ["unsorted queue records"],
      produces: ["sorted queue records"],
    },
    {
      name: "submit",
      summary:
        "Encode backend commands and submit them through the WebGPU queue.",
      consumes: ["sorted queue records", "prepared render resources"],
      produces: ["GPU command submission"],
    },
  ];

export function describeRenderFramePhases(): readonly RenderFramePhaseDescriptor[] {
  return RENDER_FRAME_PHASE_DESCRIPTORS;
}

export function writeRenderFrameQueuePhase(
  readiness: RenderWorldDrawReadinessReport,
  transforms: PackedSnapshotTransforms,
  scratch: RenderQueueScratch,
  options?: PlanRenderQueueOptions,
): RenderFrameQueuePhaseResult {
  const plan = writeUnsortedRenderQueueRecords(
    readiness,
    transforms,
    scratch,
    options,
  );

  return {
    phase: "queue",
    records: plan.records,
    diagnostics: plan.diagnostics,
    sortPhases: plan.sortPhases,
  };
}

export function writeRenderFrameSortPhase(
  scratch: RenderQueueScratch,
  options?: PlanRenderQueueOptions,
): RenderFrameSortPhaseResult {
  sortRenderQueueRecords(scratch.records);
  batchStaticRenderQueueRecords(scratch.records, options?.staticBatching);
  writeRenderQueueSortPhases(
    scratch.records,
    scratch.sortPhases,
    scratch.sortPhasePool,
  );

  return {
    phase: "sort",
    records: scratch.records,
    diagnostics: scratch.diagnostics,
    sortPhases: scratch.sortPhases,
  };
}
