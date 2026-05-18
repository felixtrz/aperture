import {
  appendPipelineScopedBindGroups,
  createPipelineScopedBindGroupScratch,
  resetPipelineScopedBindGroupScratch,
  type PipelineScopedBindGroupResource,
  type PipelineScopedBindGroupScratch,
} from "./pipeline-scoped-bind-groups.js";

export interface QueuedMaterialPipelineResourceView {
  readonly valid: boolean;
  readonly resource: { readonly pipeline: unknown } | null;
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

export interface QueuedMaterialFrameResourceScratch<
  TPipelinePlanResult,
  TMeshResource,
  TBindGroup extends PipelineScopedBindGroupResource,
> {
  readonly pipelineResults: Map<string, TPipelinePlanResult>;
  readonly pipelineResultList: TPipelinePlanResult[];
  readonly meshResources: Map<string, TMeshResource>;
  readonly meshResourceList: TMeshResource[];
  readonly meshResourceKeys: Map<string, string>;
  readonly materialResourceKeys: Map<string, string>;
  readonly bindGroups: TBindGroup[];
  readonly pipelineScopedBindGroups: PipelineScopedBindGroupScratch;
}

export interface QueuedMaterialFrameResourceSetCallbacks<
  TItem,
  TPipelineResult,
  TPipelinePlanResult,
  TPipelineLayouts,
  TTextureSamplerDependencies extends
    QueuedMaterialTextureSamplerDependenciesLike,
  TFrameOptions,
  TFrameResources,
  TFrameResourcesResult extends
    QueuedMaterialFrameResourceSetResultLike<TFrameResources>,
  TMeshResource,
  TBindGroup extends PipelineScopedBindGroupResource,
> {
  getPipelineKey(item: TItem): string;
  getSourceMeshKey(item: TItem): string;
  getSourceMaterialKey(item: TItem): string;
  getPipeline(item: TItem): Promise<TPipelineResult> | TPipelineResult;
  getPipelineView(
    pipeline: TPipelineResult,
  ): QueuedMaterialPipelineResourceView;
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

export interface PrepareQueuedMaterialFrameResourceSetOptions<
  TItem,
  TPipelineResult,
  TPipelinePlanResult,
  TPipelineLayouts,
  TTextureSamplerDependencies extends
    QueuedMaterialTextureSamplerDependenciesLike,
  TFrameOptions,
  TFrameResources,
  TFrameResourcesResult extends
    QueuedMaterialFrameResourceSetResultLike<TFrameResources>,
  TMeshResource,
  TBindGroup extends PipelineScopedBindGroupResource,
> {
  readonly items: readonly TItem[];
  readonly scratch: QueuedMaterialFrameResourceScratch<
    TPipelinePlanResult,
    TMeshResource,
    TBindGroup
  >;
  readonly callbacks: QueuedMaterialFrameResourceSetCallbacks<
    TItem,
    TPipelineResult,
    TPipelinePlanResult,
    TPipelineLayouts,
    TTextureSamplerDependencies,
    TFrameOptions,
    TFrameResources,
    TFrameResourcesResult,
    TMeshResource,
    TBindGroup
  >;
}

export interface PrepareQueuedMaterialFrameResourceSetResult<
  TPipelineResult,
  TPipelinePlanResult,
  TFrameResources,
  TMeshResource,
  TBindGroup extends PipelineScopedBindGroupResource,
> {
  readonly valid: boolean;
  readonly diagnostics: readonly unknown[];
  readonly pipelineResults: readonly TPipelinePlanResult[];
  readonly firstPipeline: TPipelineResult | null;
  readonly firstResources: TFrameResources | null;
  readonly meshResources: readonly TMeshResource[];
  readonly bindGroups: readonly TBindGroup[];
  readonly meshResourceKeys: ReadonlyMap<string, string>;
  readonly materialResourceKeys: ReadonlyMap<string, string>;
}

export function createQueuedMaterialFrameResourceScratch<
  TPipelinePlanResult,
  TMeshResource,
  TBindGroup extends PipelineScopedBindGroupResource,
>(): QueuedMaterialFrameResourceScratch<
  TPipelinePlanResult,
  TMeshResource,
  TBindGroup
> {
  return {
    pipelineResults: new Map(),
    pipelineResultList: [],
    meshResources: new Map(),
    meshResourceList: [],
    meshResourceKeys: new Map(),
    materialResourceKeys: new Map(),
    bindGroups: [],
    pipelineScopedBindGroups: createPipelineScopedBindGroupScratch(),
  };
}

export async function prepareQueuedMaterialFrameResourceSet<
  TItem,
  TPipelineResult,
  TPipelinePlanResult,
  TPipelineLayouts,
  TTextureSamplerDependencies extends
    QueuedMaterialTextureSamplerDependenciesLike,
  TFrameOptions,
  TFrameResources,
  TFrameResourcesResult extends
    QueuedMaterialFrameResourceSetResultLike<TFrameResources>,
  TMeshResource,
  TBindGroup extends PipelineScopedBindGroupResource,
>(
  options: PrepareQueuedMaterialFrameResourceSetOptions<
    TItem,
    TPipelineResult,
    TPipelinePlanResult,
    TPipelineLayouts,
    TTextureSamplerDependencies,
    TFrameOptions,
    TFrameResources,
    TFrameResourcesResult,
    TMeshResource,
    TBindGroup
  >,
): Promise<
  PrepareQueuedMaterialFrameResourceSetResult<
    TPipelineResult,
    TPipelinePlanResult,
    TFrameResources,
    TMeshResource,
    TBindGroup
  >
> {
  const scratch = resetQueuedMaterialFrameResourceScratch(options.scratch);
  const diagnostics: unknown[] = [];
  let firstPipeline: TPipelineResult | null = null;
  let firstResources: TFrameResources | null = null;

  for (const item of options.items) {
    const pipelineKey = options.callbacks.getPipelineKey(item);
    const pipeline = await options.callbacks.getPipeline(item);
    const pipelineView = options.callbacks.getPipelineView(pipeline);

    firstPipeline ??= pipeline;

    if (!pipelineView.valid || pipelineView.resource === null) {
      diagnostics.push(...pipelineView.diagnostics);
      continue;
    }

    const pipelineHandle = pipelineView.resource.pipeline as {
      getBindGroupLayout?: (group: number) => unknown;
    };

    if (pipelineHandle.getBindGroupLayout === undefined) {
      diagnostics.push({
        code: "webGpuApp.missingPipelineLayouts",
        message: "The WebGPU app pipeline does not expose bind group layouts.",
      });
      continue;
    }

    if (!scratch.pipelineResults.has(pipelineKey)) {
      const pipelineResult = options.callbacks.createPipelinePlanResult({
        item,
        pipeline,
      });

      scratch.pipelineResults.set(pipelineKey, pipelineResult);
      scratch.pipelineResultList.push(pipelineResult);
    }

    const layouts = options.callbacks.getPipelineLayouts({
      item,
      pipeline,
      getBindGroupLayout:
        pipelineHandle.getBindGroupLayout.bind(pipelineHandle),
    });
    const textureSamplerDependencies =
      options.callbacks.prepareTextureSamplerDependencies({ item });

    if (!textureSamplerDependencies.valid) {
      diagnostics.push(...textureSamplerDependencies.diagnostics);
      continue;
    }

    const resourcesResult = options.callbacks.createFrameResources({
      item,
      options: options.callbacks.createFrameResourceOptions({
        item,
        textureSamplerDependencies,
        layouts,
      }),
    });

    if (!resourcesResult.valid || resourcesResult.resources === null) {
      diagnostics.push(...resourcesResult.diagnostics);
      diagnostics.push(
        options.callbacks.createRouteDiagnostic({
          item,
          result: resourcesResult,
        }),
      );
      continue;
    }

    const resources = resourcesResult.resources;

    firstResources ??= resources;
    options.callbacks.appendFrameResources({
      item,
      result: resourcesResult,
      resources,
    });

    const meshResourceKey = options.callbacks.getMeshResourceKey(resources);

    if (!scratch.meshResources.has(meshResourceKey)) {
      scratch.meshResources.set(
        meshResourceKey,
        options.callbacks.getMeshResource(resources),
      );
      scratch.meshResourceList.push(
        options.callbacks.getMeshResource(resources),
      );
    }

    scratch.meshResourceKeys.set(
      options.callbacks.getSourceMeshKey(item),
      meshResourceKey,
    );
    scratch.materialResourceKeys.set(
      options.callbacks.getSourceMaterialKey(item),
      options.callbacks.getMaterialResourceKey(resources),
    );
    appendPipelineScopedBindGroups(
      options.callbacks.getBindGroups(resources),
      pipelineKey,
      scratch.bindGroups,
      scratch.pipelineScopedBindGroups,
    );
  }

  return {
    valid:
      diagnostics.length === 0 &&
      scratch.meshResources.size > 0 &&
      scratch.materialResourceKeys.size > 0 &&
      firstResources !== null,
    diagnostics,
    pipelineResults: scratch.pipelineResultList,
    firstPipeline,
    firstResources,
    meshResources: scratch.meshResourceList,
    bindGroups: scratch.bindGroups,
    meshResourceKeys: scratch.meshResourceKeys,
    materialResourceKeys: scratch.materialResourceKeys,
  };
}

export function resetQueuedMaterialFrameResourceScratch<
  TPipelinePlanResult,
  TMeshResource,
  TBindGroup extends PipelineScopedBindGroupResource,
>(
  scratch: QueuedMaterialFrameResourceScratch<
    TPipelinePlanResult,
    TMeshResource,
    TBindGroup
  >,
): QueuedMaterialFrameResourceScratch<
  TPipelinePlanResult,
  TMeshResource,
  TBindGroup
> {
  scratch.pipelineResults.clear();
  scratch.pipelineResultList.length = 0;
  scratch.meshResources.clear();
  scratch.meshResourceList.length = 0;
  scratch.meshResourceKeys.clear();
  scratch.materialResourceKeys.clear();
  scratch.bindGroups.length = 0;
  resetPipelineScopedBindGroupScratch(scratch.pipelineScopedBindGroups);

  return scratch;
}
