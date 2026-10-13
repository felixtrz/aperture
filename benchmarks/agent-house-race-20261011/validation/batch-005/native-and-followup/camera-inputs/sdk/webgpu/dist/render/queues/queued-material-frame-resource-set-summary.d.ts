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
export interface CreateQueuedMaterialFrameResourceSetSummaryOptions {
    readonly byFamily?: readonly QueuedMaterialFrameResourceFamilyBucketSummary[];
}
export declare function createQueuedMaterialFrameResourceSetSummary(items: readonly QueuedMaterialFrameResourceSetSummaryItem[], options?: CreateQueuedMaterialFrameResourceSetSummaryOptions): QueuedMaterialFrameResourceSetSummary;
//# sourceMappingURL=queued-material-frame-resource-set-summary.d.ts.map