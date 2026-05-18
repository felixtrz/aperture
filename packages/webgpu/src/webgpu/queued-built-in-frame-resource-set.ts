import type {
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import {
  appendQueuedBuiltInFrameResourceViaAdapter,
  type CreateQueuedBuiltInFamilyFrameResourcesResult,
  type QueuedBuiltInFrameResource,
} from "./built-in-material-app-resource-adapter.js";
import type {
  QueuedBuiltInAppResourceItem,
  QueuedBuiltInAppResourceSet,
} from "./queued-built-in-app-resource-set.js";
import type { PreparedMaterialTextureSamplerDependencies } from "./prepared-material-texture-sampler-dependencies.js";
import type { DebugNormalFrameGpuResources } from "./debug-normal-frame-resources.js";
import type { MatcapFrameGpuResources } from "./matcap-frame-resources.js";
import type { StandardFrameGpuResources } from "./standard-frame-resources.js";
import type { UnlitFrameGpuResources } from "./unlit-frame-resources.js";
import {
  createQueuedMaterialFrameResourceScratch,
  prepareQueuedMaterialFrameResourceSet,
  resetQueuedMaterialFrameResourceScratch,
  type QueuedMaterialFrameResourceScratch,
  type QueuedMaterialPipelineResourceView,
} from "./queued-material-frame-resource-set.js";
import {
  appendQueuedMaterialFrameResourceBucket,
  createQueuedMaterialFrameResourceBuckets,
  createQueuedMaterialFrameResourceBucketSummary,
  resetQueuedMaterialFrameResourceBuckets,
  type QueuedMaterialFrameResourceBucketSummary,
  type QueuedMaterialFrameResourceBuckets,
} from "./queued-material-frame-resource-buckets.js";
import {
  createQueuedMaterialFrameResourceRouteShell,
  type QueuedMaterialFrameResourceResultLike,
  type QueuedMaterialFrameResourceRouteShell,
} from "./queued-material-frame-resource-route.js";

export interface QueuedBuiltInFrameResources {
  readonly mesh: UnlitFrameGpuResources["mesh"];
  readonly viewUniform: UnlitFrameGpuResources["viewUniform"];
  readonly worldTransforms: UnlitFrameGpuResources["worldTransforms"];
  readonly meshResources: readonly UnlitFrameGpuResources["mesh"][];
  readonly unlit: readonly UnlitFrameGpuResources[];
  readonly matcap: readonly MatcapFrameGpuResources[];
  readonly standard: readonly StandardFrameGpuResources[];
  readonly debugNormal: readonly DebugNormalFrameGpuResources[];
  readonly byFamily: QueuedMaterialFrameResourceBuckets<QueuedBuiltInFrameResource>;
  readonly byFamilySummary: readonly QueuedMaterialFrameResourceBucketSummary[];
  readonly bindGroups: readonly UnlitFrameGpuResources["bindGroups"][number][];
}

export interface CreateQueuedBuiltInFrameResourcesResult {
  readonly valid: boolean;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly diagnostics: readonly unknown[];
}

export interface QueuedBuiltInFrameResourceRouteDiagnostic {
  readonly code: "webGpuApp.frameResourceRoute";
  readonly message: string;
  readonly route: QueuedMaterialFrameResourceRouteShell;
}

export type QueuedBuiltInPipelineResourceView =
  QueuedMaterialPipelineResourceView;

export interface QueuedBuiltInFrameResourceScratch<
  TPipelinePlanResult,
> extends QueuedMaterialFrameResourceScratch<
  TPipelinePlanResult,
  UnlitFrameGpuResources["mesh"],
  UnlitFrameGpuResources["bindGroups"][number]
> {
  readonly unlit: UnlitFrameGpuResources[];
  readonly matcap: MatcapFrameGpuResources[];
  readonly standard: StandardFrameGpuResources[];
  readonly debugNormal: DebugNormalFrameGpuResources[];
  readonly byFamily: QueuedMaterialFrameResourceBuckets<QueuedBuiltInFrameResource>;
}

export interface PrepareQueuedBuiltInFrameResourceSetCallbacks<
  TPipelineResult,
  TPipelinePlanResult,
  TPipelineLayouts,
  TFrameOptions,
> {
  getPipeline(
    item: QueuedBuiltInAppResourceItem,
  ): Promise<TPipelineResult> | TPipelineResult;
  getPipelineView(pipeline: TPipelineResult): QueuedBuiltInPipelineResourceView;
  createPipelinePlanResult(input: {
    readonly item: QueuedBuiltInAppResourceItem;
    readonly pipeline: TPipelineResult;
  }): TPipelinePlanResult;
  getPipelineLayouts(input: {
    readonly item: QueuedBuiltInAppResourceItem;
    readonly pipeline: TPipelineResult;
    readonly getBindGroupLayout: (group: number) => unknown;
  }): TPipelineLayouts;
  prepareTextureSamplerDependencies(input: {
    readonly item: QueuedBuiltInAppResourceItem;
  }): PreparedMaterialTextureSamplerDependencies;
  createFrameResourceOptions(input: {
    readonly item: QueuedBuiltInAppResourceItem;
    readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly layouts: TPipelineLayouts;
  }): TFrameOptions;
}

export interface PrepareQueuedBuiltInFrameResourceSetOptions<
  TPipelineResult,
  TPipelinePlanResult,
  TPipelineLayouts,
  TFrameOptions,
> {
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly scratch: QueuedBuiltInFrameResourceScratch<TPipelinePlanResult>;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly callbacks: PrepareQueuedBuiltInFrameResourceSetCallbacks<
    TPipelineResult,
    TPipelinePlanResult,
    TPipelineLayouts,
    TFrameOptions
  >;
}

export interface PrepareQueuedBuiltInFrameResourceSetResult<
  TPipelineResult,
  TPipelinePlanResult,
> {
  readonly valid: boolean;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly resourcesResult: CreateQueuedBuiltInFrameResourcesResult;
  readonly diagnostics: readonly unknown[];
  readonly pipelineResults: readonly TPipelinePlanResult[];
  readonly firstPipeline: TPipelineResult | null;
  readonly meshResourceKeys: ReadonlyMap<string, string>;
  readonly materialResourceKeys: ReadonlyMap<string, string>;
}

export function createQueuedBuiltInFrameResourceScratch<
  TPipelinePlanResult,
>(): QueuedBuiltInFrameResourceScratch<TPipelinePlanResult> {
  return {
    ...createQueuedMaterialFrameResourceScratch<
      TPipelinePlanResult,
      UnlitFrameGpuResources["mesh"],
      UnlitFrameGpuResources["bindGroups"][number]
    >(),
    unlit: [],
    matcap: [],
    standard: [],
    debugNormal: [],
    byFamily:
      createQueuedMaterialFrameResourceBuckets<QueuedBuiltInFrameResource>(),
  };
}

export async function prepareQueuedBuiltInFrameResourceSet<
  TPipelineResult,
  TPipelinePlanResult,
  TPipelineLayouts,
  TFrameOptions,
>(
  options: PrepareQueuedBuiltInFrameResourceSetOptions<
    TPipelineResult,
    TPipelinePlanResult,
    TPipelineLayouts,
    TFrameOptions
  >,
): Promise<
  PrepareQueuedBuiltInFrameResourceSetResult<
    TPipelineResult,
    TPipelinePlanResult
  >
> {
  const scratch = resetQueuedBuiltInFrameResourceScratch(options.scratch);
  const prepared = await prepareQueuedMaterialFrameResourceSet<
    QueuedBuiltInAppResourceItem,
    TPipelineResult,
    TPipelinePlanResult,
    TPipelineLayouts,
    PreparedMaterialTextureSamplerDependencies,
    TFrameOptions,
    | UnlitFrameGpuResources
    | MatcapFrameGpuResources
    | StandardFrameGpuResources
    | DebugNormalFrameGpuResources,
    CreateQueuedBuiltInFamilyFrameResourcesResult,
    UnlitFrameGpuResources["mesh"],
    UnlitFrameGpuResources["bindGroups"][number]
  >({
    items: options.resourceSet.items,
    scratch,
    callbacks: {
      getPipelineKey: (item) => item.draw.batchKey.pipelineKey,
      getSourceMeshKey: (item) => item.sourceMeshKey,
      getSourceMaterialKey: (item) => item.sourceMaterialKey,
      getPipeline: options.callbacks.getPipeline,
      getPipelineView: options.callbacks.getPipelineView,
      createPipelinePlanResult: options.callbacks.createPipelinePlanResult,
      getPipelineLayouts: options.callbacks.getPipelineLayouts,
      prepareTextureSamplerDependencies:
        options.callbacks.prepareTextureSamplerDependencies,
      createFrameResourceOptions: (input) =>
        options.callbacks.createFrameResourceOptions({
          ...input,
          viewUniforms: options.viewUniforms,
          worldTransforms: options.worldTransforms,
        }),
      createFrameResources: ({ item, options: frameOptions }) =>
        item.adapter.createFrameResources(
          frameOptions,
        ) as CreateQueuedBuiltInFamilyFrameResourcesResult,
      appendFrameResources: ({ item, result }) => {
        if (result.resources !== null) {
          appendQueuedMaterialFrameResourceBucket(
            scratch.byFamily,
            item.adapter.kind,
            result.resources,
          );
        }
        appendQueuedBuiltInFrameResourceViaAdapter({
          adapter: item.adapter,
          result,
          buckets: {
            unlit: scratch.unlit,
            matcap: scratch.matcap,
            standard: scratch.standard,
            debugNormal: scratch.debugNormal,
          },
        });
      },
      createRouteDiagnostic: ({ item, result }) =>
        createQueuedBuiltInFrameResourceRouteDiagnostic(
          createQueuedBuiltInFrameResourceRouteShell({
            item,
            resources: result,
          }),
        ),
      getMeshResource: (resources) => resources.mesh,
      getMeshResourceKey: (resources) => resources.mesh.resourceKey,
      getMaterialResourceKey: (resources) => resources.material.resourceKey,
      getBindGroups: (resources) => resources.bindGroups,
    },
  });

  const resources = prepared.valid ? prepared.firstResources : null;
  const result: CreateQueuedBuiltInFrameResourcesResult = {
    valid: prepared.valid,
    resources: resources
      ? {
          mesh: resources.mesh,
          viewUniform: resources.viewUniform,
          worldTransforms: resources.worldTransforms,
          meshResources: prepared.meshResources,
          unlit: scratch.unlit,
          matcap: scratch.matcap,
          standard: scratch.standard,
          debugNormal: scratch.debugNormal,
          byFamily: scratch.byFamily,
          byFamilySummary: createQueuedMaterialFrameResourceBucketSummary(
            scratch.byFamily,
          ),
          bindGroups: prepared.bindGroups,
        }
      : null,
    diagnostics: prepared.diagnostics,
  };

  return {
    valid: result.valid,
    resources: result.resources,
    resourcesResult: result,
    diagnostics: prepared.diagnostics,
    pipelineResults: prepared.pipelineResults,
    firstPipeline: prepared.firstPipeline,
    meshResourceKeys: prepared.meshResourceKeys,
    materialResourceKeys: prepared.materialResourceKeys,
  };
}

export function createQueuedBuiltInFrameResourceRouteShell(input: {
  readonly item: QueuedBuiltInAppResourceItem;
  readonly resources: QueuedMaterialFrameResourceResultLike<unknown>;
}): QueuedMaterialFrameResourceRouteShell {
  return createQueuedMaterialFrameResourceRouteShell({
    prepareRoute: input.item.prepareRoute,
    backendMeshKey: input.item.meshKey,
    backendMaterialKey: input.item.materialKey,
    frameResources: input.resources,
  });
}

export function createQueuedBuiltInFrameResourceRouteDiagnostic(
  route: QueuedMaterialFrameResourceRouteShell,
): QueuedBuiltInFrameResourceRouteDiagnostic {
  return {
    code: "webGpuApp.frameResourceRoute",
    message: `WebGPU app frame resource preparation failed for '${route.family}' material route.`,
    route,
  };
}

function resetQueuedBuiltInFrameResourceScratch<TPipelinePlanResult>(
  scratch: QueuedBuiltInFrameResourceScratch<TPipelinePlanResult>,
): QueuedBuiltInFrameResourceScratch<TPipelinePlanResult> {
  resetQueuedMaterialFrameResourceScratch(scratch);
  scratch.unlit.length = 0;
  scratch.matcap.length = 0;
  scratch.standard.length = 0;
  scratch.debugNormal.length = 0;
  resetQueuedMaterialFrameResourceBuckets(scratch.byFamily);

  return scratch;
}
