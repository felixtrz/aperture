import type {
  BatchCompatibilityKey,
  RenderQueue,
  RenderSortKey,
} from "./snapshot.js";

export const OPAQUE_STATE_SORT_POLICY_NAME =
  "opaque-state-resource-front-to-back-stable";

export interface RenderStateSortRecord {
  readonly renderId: number;
  readonly sortKey: RenderSortKey;
  readonly batchKey: BatchCompatibilityKey;
  readonly materialResourceKey: string;
  readonly meshResourceKey: string;
}

export interface RenderStateSwitchCounts {
  readonly pipeline: number;
  readonly materialResource: number;
  readonly meshLayout: number;
  readonly meshResource: number;
  readonly total: number;
}

export interface OpaqueRenderStateSortPressureReport {
  readonly phase: "opaque";
  readonly policy: typeof OPAQUE_STATE_SORT_POLICY_NAME;
  readonly recordCount: number;
  readonly stableOrder: RenderStateSwitchCounts;
  readonly stateAwareOrder: RenderStateSwitchCounts;
  readonly delta: RenderStateSwitchCounts;
}

interface MutableRenderStateSwitchCounts {
  pipeline: number;
  materialResource: number;
  meshLayout: number;
  meshResource: number;
  total: number;
}

export function compareStableRenderRecords(
  a: RenderStateSortRecord,
  b: RenderStateSortRecord,
): number {
  const phaseOrder =
    stableRenderQueuePhaseRank(a.sortKey.queue) -
    stableRenderQueuePhaseRank(b.sortKey.queue);

  if (phaseOrder !== 0) {
    return phaseOrder;
  }

  const authorOrder =
    a.sortKey.viewId - b.sortKey.viewId ||
    a.sortKey.layer - b.sortKey.layer ||
    a.sortKey.order - b.sortKey.order;

  if (authorOrder !== 0) {
    return authorOrder;
  }

  if (a.sortKey.queue === "transparent" && b.sortKey.queue === "transparent") {
    return (
      compareDepth(a.sortKey, b.sortKey) ||
      a.sortKey.stableId - b.sortKey.stableId ||
      a.renderId - b.renderId
    );
  }

  return (
    a.sortKey.stableId - b.sortKey.stableId ||
    a.renderId - b.renderId ||
    compareDepth(a.sortKey, b.sortKey)
  );
}

export function compareStateAwareRenderRecords(
  a: RenderStateSortRecord,
  b: RenderStateSortRecord,
): number {
  const phaseOrder =
    renderQueuePhaseRank(a.sortKey.queue) -
    renderQueuePhaseRank(b.sortKey.queue);

  if (phaseOrder !== 0) {
    return phaseOrder;
  }

  const authorOrder =
    a.sortKey.viewId - b.sortKey.viewId ||
    a.sortKey.layer - b.sortKey.layer ||
    a.sortKey.order - b.sortKey.order;

  if (authorOrder !== 0) {
    return authorOrder;
  }

  if (a.sortKey.queue === "transparent" && b.sortKey.queue === "transparent") {
    return (
      b.sortKey.depth - a.sortKey.depth ||
      a.sortKey.stableId - b.sortKey.stableId ||
      compareStrings(a.batchKey.pipelineKey, b.batchKey.pipelineKey) ||
      compareStrings(a.materialResourceKey, b.materialResourceKey) ||
      compareStrings(a.batchKey.meshLayoutKey, b.batchKey.meshLayoutKey) ||
      compareStrings(a.meshResourceKey, b.meshResourceKey) ||
      a.renderId - b.renderId
    );
  }

  return (
    compareStrings(a.batchKey.pipelineKey, b.batchKey.pipelineKey) ||
    compareStrings(a.materialResourceKey, b.materialResourceKey) ||
    compareStrings(a.batchKey.meshLayoutKey, b.batchKey.meshLayoutKey) ||
    compareStrings(a.meshResourceKey, b.meshResourceKey) ||
    a.sortKey.depth - b.sortKey.depth ||
    a.sortKey.stableId - b.sortKey.stableId ||
    a.renderId - b.renderId
  );
}

export function createOpaqueRenderStateSortPressureReport(input: {
  readonly stableOrder: RenderStateSwitchCounts;
  readonly stateAwareOrder: RenderStateSwitchCounts;
  readonly recordCount: number;
}): OpaqueRenderStateSortPressureReport {
  return {
    phase: "opaque",
    policy: OPAQUE_STATE_SORT_POLICY_NAME,
    recordCount: input.recordCount,
    stableOrder: input.stableOrder,
    stateAwareOrder: input.stateAwareOrder,
    delta: subtractSwitchCounts(input.stableOrder, input.stateAwareOrder),
  };
}

export function emptyOpaqueRenderStateSortPressureReport(): OpaqueRenderStateSortPressureReport {
  const empty = emptySwitchCounts();

  return createOpaqueRenderStateSortPressureReport({
    stableOrder: empty,
    stateAwareOrder: empty,
    recordCount: 0,
  });
}

export function countOpaqueRenderStateSwitches(
  records: readonly RenderStateSortRecord[],
): RenderStateSwitchCounts {
  const counts: MutableRenderStateSwitchCounts = {
    pipeline: 0,
    materialResource: 0,
    meshLayout: 0,
    meshResource: 0,
    total: 0,
  };
  let lastPipeline: string | null = null;
  let lastMaterialResource: string | null = null;
  let lastMeshLayout: string | null = null;
  let lastMeshResource: string | null = null;

  for (const record of records) {
    if (record.sortKey.queue === "transparent") {
      continue;
    }

    if (record.batchKey.pipelineKey !== lastPipeline) {
      counts.pipeline += 1;
      lastPipeline = record.batchKey.pipelineKey;
    }

    if (record.materialResourceKey !== lastMaterialResource) {
      counts.materialResource += 1;
      lastMaterialResource = record.materialResourceKey;
    }

    if (record.batchKey.meshLayoutKey !== lastMeshLayout) {
      counts.meshLayout += 1;
      lastMeshLayout = record.batchKey.meshLayoutKey;
    }

    if (record.meshResourceKey !== lastMeshResource) {
      counts.meshResource += 1;
      lastMeshResource = record.meshResourceKey;
    }
  }

  counts.total =
    counts.pipeline +
    counts.materialResource +
    counts.meshLayout +
    counts.meshResource;

  return counts;
}

export function countOpaqueRenderStateRecords(
  records: readonly RenderStateSortRecord[],
): number {
  let count = 0;

  for (const record of records) {
    if (record.sortKey.queue !== "transparent") {
      count += 1;
    }
  }

  return count;
}

function subtractSwitchCounts(
  stableOrder: RenderStateSwitchCounts,
  stateAwareOrder: RenderStateSwitchCounts,
): RenderStateSwitchCounts {
  return {
    pipeline: stableOrder.pipeline - stateAwareOrder.pipeline,
    materialResource:
      stableOrder.materialResource - stateAwareOrder.materialResource,
    meshLayout: stableOrder.meshLayout - stateAwareOrder.meshLayout,
    meshResource: stableOrder.meshResource - stateAwareOrder.meshResource,
    total: stableOrder.total - stateAwareOrder.total,
  };
}

function emptySwitchCounts(): RenderStateSwitchCounts {
  return {
    pipeline: 0,
    materialResource: 0,
    meshLayout: 0,
    meshResource: 0,
    total: 0,
  };
}

function renderQueuePhaseRank(phase: RenderQueue): number {
  switch (phase) {
    case "opaque":
      return 0;
    case "alpha-test":
      return 1;
    case "transparent":
      return 2;
  }
}

function stableRenderQueuePhaseRank(phase: RenderQueue): number {
  return phase === "transparent" ? 1 : 0;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareDepth(a: RenderSortKey, b: RenderSortKey): number {
  return a.queue === "transparent" || b.queue === "transparent"
    ? b.depth - a.depth
    : a.depth - b.depth;
}
