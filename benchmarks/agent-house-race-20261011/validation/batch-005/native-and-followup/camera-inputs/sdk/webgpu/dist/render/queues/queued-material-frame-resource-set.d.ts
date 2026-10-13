import { type PipelineScopedBindGroupResource, type PipelineScopedBindGroupScratch } from "../../gpu/pipeline-scoped-bind-groups.js";
export interface QueuedMaterialPipelineResourceView {
    readonly valid: boolean;
    readonly resource: {
        readonly pipeline: unknown;
    } | null;
    readonly diagnostics: readonly unknown[];
}
export interface QueuedMaterialFrameResourceSetResultLike<TResources> {
    readonly valid: boolean;
    readonly resources: TResources | null;
    readonly diagnostics: readonly unknown[];
}
export interface QueuedMaterialTextureSamplerDependenciesLike {
    readonly valid: boolean;
    readonly diagnostics: readonly unknown[];
}
export interface QueuedMaterialFrameResourceScratch<TPipelinePlanResult, TMeshResource, TBindGroup extends PipelineScopedBindGroupResource> {
    readonly pipelineLookups: Map<string, unknown>;
    readonly pipelineResults: Map<string, TPipelinePlanResult>;
    readonly pipelineResultList: TPipelinePlanResult[];
    readonly textureSamplerDependencies: Map<string, unknown>;
    readonly pipelineKeysByRenderId: Map<number, string>;
    readonly meshResources: Map<string, TMeshResource>;
    readonly meshResourceList: TMeshResource[];
    readonly meshResourceKeys: Map<string, string>;
    readonly materialResourceKeys: Map<string, string>;
    readonly bindGroups: TBindGroup[];
    readonly pipelineScopedBindGroups: PipelineScopedBindGroupScratch;
}
export interface QueuedMaterialFrameResourceSetCallbacks<TItem, TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TTextureSamplerDependencies extends QueuedMaterialTextureSamplerDependenciesLike, TFrameOptions, TFrameResources, TFrameResourcesResult extends QueuedMaterialFrameResourceSetResultLike<TFrameResources>, TMeshResource, TBindGroup extends PipelineScopedBindGroupResource> {
    getPipelineKey(item: TItem): string;
    getPipelineLookupKey?(item: TItem): string;
    getPipelineResourceKey?(input: {
        readonly item: TItem;
        readonly pipeline: TPipelineResult;
    }): string;
    getRenderId?(item: TItem): number | null;
    getSourceMeshKey(item: TItem): string;
    getSourceMaterialKey(item: TItem): string;
    getPipeline(item: TItem): Promise<TPipelineResult> | TPipelineResult;
    onPipelineLookupReuse?(input: {
        readonly item: TItem;
        readonly pipeline: TPipelineResult;
        readonly pipelineKey: string;
        readonly pipelineLookupKey: string;
    }): void;
    getPipelineView(pipeline: TPipelineResult): QueuedMaterialPipelineResourceView;
    createPipelinePlanResult(input: {
        readonly item: TItem;
        readonly pipeline: TPipelineResult;
    }): TPipelinePlanResult;
    getPipelineLayouts(input: {
        readonly item: TItem;
        readonly pipeline: TPipelineResult;
        readonly getBindGroupLayout: (group: number) => unknown;
    }): TPipelineLayouts;
    prepareTextureSamplerDependencies(input: {
        readonly item: TItem;
    }): TTextureSamplerDependencies;
    getTextureSamplerDependenciesLookupKey?(item: TItem): string | null;
    onTextureSamplerDependenciesReuse?(input: {
        readonly item: TItem;
        readonly dependencies: TTextureSamplerDependencies;
        readonly lookupKey: string;
    }): void;
    createFrameResourceOptions(input: {
        readonly item: TItem;
        readonly textureSamplerDependencies: TTextureSamplerDependencies;
        readonly layouts: TPipelineLayouts;
    }): TFrameOptions;
    createFrameResources(input: {
        readonly item: TItem;
        readonly options: TFrameOptions;
    }): TFrameResourcesResult;
    appendFrameResources(input: {
        readonly item: TItem;
        readonly result: TFrameResourcesResult;
        readonly resources: TFrameResources;
    }): void;
    createRouteDiagnostic(input: {
        readonly item: TItem;
        readonly result: TFrameResourcesResult;
    }): unknown;
    getMeshResource(resources: TFrameResources): TMeshResource;
    getMeshResourceKey(resources: TFrameResources): string;
    getMaterialResourceKey(resources: TFrameResources): string;
    getBindGroups(resources: TFrameResources): readonly TBindGroup[];
}
export interface PrepareQueuedMaterialFrameResourceSetOptions<TItem, TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TTextureSamplerDependencies extends QueuedMaterialTextureSamplerDependenciesLike, TFrameOptions, TFrameResources, TFrameResourcesResult extends QueuedMaterialFrameResourceSetResultLike<TFrameResources>, TMeshResource, TBindGroup extends PipelineScopedBindGroupResource> {
    readonly items: readonly TItem[];
    readonly scratch: QueuedMaterialFrameResourceScratch<TPipelinePlanResult, TMeshResource, TBindGroup>;
    readonly callbacks: QueuedMaterialFrameResourceSetCallbacks<TItem, TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TTextureSamplerDependencies, TFrameOptions, TFrameResources, TFrameResourcesResult, TMeshResource, TBindGroup>;
}
export interface PrepareQueuedMaterialFrameResourceSetResult<TPipelineResult, TPipelinePlanResult, TFrameResources, TMeshResource, TBindGroup extends PipelineScopedBindGroupResource> {
    readonly valid: boolean;
    readonly diagnostics: readonly unknown[];
    readonly pipelineResults: readonly TPipelinePlanResult[];
    readonly firstPipeline: TPipelineResult | null;
    readonly firstResources: TFrameResources | null;
    readonly meshResources: readonly TMeshResource[];
    readonly bindGroups: readonly TBindGroup[];
    readonly pipelineKeysByRenderId: ReadonlyMap<number, string>;
    readonly meshResourceKeys: ReadonlyMap<string, string>;
    readonly materialResourceKeys: ReadonlyMap<string, string>;
}
export declare function createQueuedMaterialFrameResourceScratch<TPipelinePlanResult, TMeshResource, TBindGroup extends PipelineScopedBindGroupResource>(): QueuedMaterialFrameResourceScratch<TPipelinePlanResult, TMeshResource, TBindGroup>;
export declare function prepareQueuedMaterialFrameResourceSet<TItem, TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TTextureSamplerDependencies extends QueuedMaterialTextureSamplerDependenciesLike, TFrameOptions, TFrameResources, TFrameResourcesResult extends QueuedMaterialFrameResourceSetResultLike<TFrameResources>, TMeshResource, TBindGroup extends PipelineScopedBindGroupResource>(options: PrepareQueuedMaterialFrameResourceSetOptions<TItem, TPipelineResult, TPipelinePlanResult, TPipelineLayouts, TTextureSamplerDependencies, TFrameOptions, TFrameResources, TFrameResourcesResult, TMeshResource, TBindGroup>): Promise<PrepareQueuedMaterialFrameResourceSetResult<TPipelineResult, TPipelinePlanResult, TFrameResources, TMeshResource, TBindGroup>>;
export declare function resetQueuedMaterialFrameResourceScratch<TPipelinePlanResult, TMeshResource, TBindGroup extends PipelineScopedBindGroupResource>(scratch: QueuedMaterialFrameResourceScratch<TPipelinePlanResult, TMeshResource, TBindGroup>): QueuedMaterialFrameResourceScratch<TPipelinePlanResult, TMeshResource, TBindGroup>;
//# sourceMappingURL=queued-material-frame-resource-set.d.ts.map