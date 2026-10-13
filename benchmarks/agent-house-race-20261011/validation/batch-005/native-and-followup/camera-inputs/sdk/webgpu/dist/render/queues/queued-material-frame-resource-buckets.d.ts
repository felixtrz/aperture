export interface QueuedMaterialFrameResourceBuckets<TResource> {
    readonly byFamily: Map<string, TResource[]>;
}
export interface QueuedMaterialFrameResourceBucketSummary {
    readonly family: string;
    readonly itemCount: number;
}
export declare function createQueuedMaterialFrameResourceBuckets<TResource>(): QueuedMaterialFrameResourceBuckets<TResource>;
export declare function resetQueuedMaterialFrameResourceBuckets<TResource>(buckets: QueuedMaterialFrameResourceBuckets<TResource>): QueuedMaterialFrameResourceBuckets<TResource>;
export declare function appendQueuedMaterialFrameResourceBucket<TResource>(buckets: QueuedMaterialFrameResourceBuckets<TResource>, family: string, resource: TResource): readonly TResource[];
export declare function getQueuedMaterialFrameResourceBucket<TResource>(buckets: QueuedMaterialFrameResourceBuckets<TResource>, family: string): readonly TResource[];
export declare function createQueuedMaterialFrameResourceBucketSummary<TResource>(buckets: QueuedMaterialFrameResourceBuckets<TResource>): readonly QueuedMaterialFrameResourceBucketSummary[];
//# sourceMappingURL=queued-material-frame-resource-buckets.d.ts.map