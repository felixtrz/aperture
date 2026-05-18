export interface QueuedMaterialFrameResourceSetSummaryItem {
  readonly materialFamily: string;
  readonly pipelineKey: string;
  readonly renderPhase: string;
}

export interface QueuedMaterialFrameResourceFamilyBucketSummary {
  readonly family: string;
  readonly itemCount: number;
}

export interface QueuedMaterialFrameResourcePipelineBucketSummary {
  readonly pipelineKey: string;
  readonly itemCount: number;
}

export interface QueuedMaterialFrameResourceFamilyPipelineBucketSummary {
  readonly family: string;
  readonly pipelineKey: string;
  readonly itemCount: number;
}

export interface QueuedMaterialFrameResourceSetSummary {
  readonly itemCount: number;
  readonly byFamily: readonly QueuedMaterialFrameResourceFamilyBucketSummary[];
  readonly byPipeline: readonly QueuedMaterialFrameResourcePipelineBucketSummary[];
  readonly byFamilyAndPipeline: readonly QueuedMaterialFrameResourceFamilyPipelineBucketSummary[];
}

export function createQueuedMaterialFrameResourceSetSummary(
  items: readonly QueuedMaterialFrameResourceSetSummaryItem[],
): QueuedMaterialFrameResourceSetSummary {
  const familyCounts = new Map<string, number>();
  const pipelineCounts = new Map<string, number>();
  const familyPipelineCounts = new Map<string, Map<string, number>>();

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
    byFamily: stringEntries(familyCounts).map(([family, itemCount]) => ({
      family,
      itemCount,
    })),
    byPipeline: stringEntries(pipelineCounts).map(
      ([pipelineKey, itemCount]) => ({
        pipelineKey,
        itemCount,
      }),
    ),
    byFamilyAndPipeline: stringEntries(familyPipelineCounts).flatMap(
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

function stringEntries<Value>(
  counts: ReadonlyMap<string, Value>,
): [string, Value][] {
  return [...counts.entries()].sort(([a], [b]) => compareStrings(a, b));
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
