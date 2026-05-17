import type { MaterialQueueFamily, RenderQueue } from "@aperture-engine/render";

export interface QueuedBuiltInResourceSetSummaryItem {
  readonly materialFamily: MaterialQueueFamily;
  readonly pipelineKey: string;
  readonly renderPhase: RenderQueue;
}

export interface QueuedBuiltInResourceFamilyBucketSummary {
  readonly family: MaterialQueueFamily;
  readonly itemCount: number;
}

export interface QueuedBuiltInResourcePipelineBucketSummary {
  readonly pipelineKey: string;
  readonly itemCount: number;
}

export interface QueuedBuiltInResourceFamilyPipelineBucketSummary {
  readonly family: MaterialQueueFamily;
  readonly pipelineKey: string;
  readonly itemCount: number;
}

export interface QueuedBuiltInResourceSetSummary {
  readonly itemCount: number;
  readonly byFamily: readonly QueuedBuiltInResourceFamilyBucketSummary[];
  readonly byPipeline: readonly QueuedBuiltInResourcePipelineBucketSummary[];
  readonly byFamilyAndPipeline: readonly QueuedBuiltInResourceFamilyPipelineBucketSummary[];
}

export function createQueuedBuiltInResourceSetSummary(
  items: readonly QueuedBuiltInResourceSetSummaryItem[],
): QueuedBuiltInResourceSetSummary {
  const familyCounts = new Map<MaterialQueueFamily, number>();
  const pipelineCounts = new Map<string, number>();
  const familyPipelineCounts = new Map<
    MaterialQueueFamily,
    Map<string, number>
  >();

  for (const item of items) {
    increment(familyCounts, item.materialFamily);
    increment(pipelineCounts, item.pipelineKey);

    let pipelineBuckets = familyPipelineCounts.get(item.materialFamily);

    if (pipelineBuckets === undefined) {
      pipelineBuckets = new Map<string, number>();
      familyPipelineCounts.set(item.materialFamily, pipelineBuckets);
    }

    increment(pipelineBuckets, item.pipelineKey);
  }

  return {
    itemCount: items.length,
    byFamily: materialFamilyEntries(familyCounts).map(
      ([family, itemCount]) => ({
        family,
        itemCount,
      }),
    ),
    byPipeline: stringEntries(pipelineCounts).map(
      ([pipelineKey, itemCount]) => ({
        pipelineKey,
        itemCount,
      }),
    ),
    byFamilyAndPipeline: materialFamilyEntries(familyPipelineCounts).flatMap(
      ([family, pipelineBuckets]) =>
        stringEntries(pipelineBuckets).map(([pipelineKey, itemCount]) => ({
          family,
          pipelineKey,
          itemCount,
        })),
    ),
  };
}

function increment<Key>(counts: Map<Key, number>, key: Key): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function materialFamilyEntries<Value>(
  counts: ReadonlyMap<MaterialQueueFamily, Value>,
): [MaterialQueueFamily, Value][] {
  return [...counts.entries()].sort(([a], [b]) => compareStrings(a, b));
}

function stringEntries<Value>(
  counts: ReadonlyMap<string, Value>,
): [string, Value][] {
  return [...counts.entries()].sort(([a], [b]) => compareStrings(a, b));
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
