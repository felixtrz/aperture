export interface QueuedMaterialFrameResourceBuckets<TResource> {
  readonly byFamily: Map<string, TResource[]>;
}

export interface QueuedMaterialFrameResourceBucketSummary {
  readonly family: string;
  readonly itemCount: number;
}

export function createQueuedMaterialFrameResourceBuckets<
  TResource,
>(): QueuedMaterialFrameResourceBuckets<TResource> {
  return { byFamily: new Map() };
}

export function resetQueuedMaterialFrameResourceBuckets<TResource>(
  buckets: QueuedMaterialFrameResourceBuckets<TResource>,
): QueuedMaterialFrameResourceBuckets<TResource> {
  buckets.byFamily.clear();

  return buckets;
}

export function appendQueuedMaterialFrameResourceBucket<TResource>(
  buckets: QueuedMaterialFrameResourceBuckets<TResource>,
  family: string,
  resource: TResource,
): readonly TResource[] {
  const bucket = getOrCreateFamilyBucket(buckets, family);

  bucket.push(resource);

  return bucket;
}

export function getQueuedMaterialFrameResourceBucket<TResource>(
  buckets: QueuedMaterialFrameResourceBuckets<TResource>,
  family: string,
): readonly TResource[] {
  return buckets.byFamily.get(family) ?? [];
}

export function createQueuedMaterialFrameResourceBucketSummary<TResource>(
  buckets: QueuedMaterialFrameResourceBuckets<TResource>,
): readonly QueuedMaterialFrameResourceBucketSummary[] {
  return [...buckets.byFamily.entries()]
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([family, resources]) => ({
      family,
      itemCount: resources.length,
    }));
}

function getOrCreateFamilyBucket<TResource>(
  buckets: QueuedMaterialFrameResourceBuckets<TResource>,
  family: string,
): TResource[] {
  let bucket = buckets.byFamily.get(family);

  if (bucket === undefined) {
    bucket = [];
    buckets.byFamily.set(family, bucket);
  }

  return bucket;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
