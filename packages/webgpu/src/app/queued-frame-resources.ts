import type { AssetRegistry } from "@aperture-engine/simulation";
import type {
  PackedSnapshotInstanceTints,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
  RenderSnapshot,
} from "@aperture-engine/render";
import type { BindGroupResourceCache } from "../gpu/bind-group-resource-cache.js";
import type { LightBindGroupResource } from "../lighting/light-bind-group.js";
import type { PreparedBuiltInMaterialStore } from "../materials/core/prepared-built-in-material-store.js";
import {
  createPreparedMaterialTextureSamplerDependencies,
  type PreparedMaterialTextureSamplerDependencies,
} from "../materials/core/prepared-material-texture-sampler-dependencies.js";
import type { StandardAreaLightLtcResources } from "../materials/standard/standard-area-light-ltc-resource.js";
import type { StandardLightShadowBindGroupResource } from "../materials/standard/standard-light-shadow-bind-group.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
  StandardFrameTransmissionSceneColorResources,
} from "../materials/standard/standard-frame-resources.js";
import type { UnlitBindGroupResource } from "../materials/unlit/unlit-bind-group.js";
import type { LocalLightClusterCookieResources } from "../lighting/local-light-cookie-resources.js";
import type { WorldTransformGpuBufferResource } from "../resources/transforms/world-transform-buffer.js";
import type {
  QueuedBuiltInAppResourceItem,
  QueuedBuiltInAppResourceSet,
} from "../render/queues/queued-built-in-app-resource-set.js";
import {
  prepareQueuedBuiltInFrameResourceSet,
  type CreateQueuedBuiltInFrameResourcesResult,
  type QueuedBuiltInFrameResources,
} from "../render/queues/queued-built-in-frame-resource-set.js";
import type {
  WebGpuAppResourceCache,
  WebGpuAppPipelinePlanResult,
} from "./resource-cache.js";
import type { WebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import type {
  WebGpuApp,
  WebGpuAppPipelineResourceResult,
  WebGpuAppResourceReuseReport,
} from "./app.js";

export type QueuedBuiltInAppResourcePreparationCache = Omit<
  WebGpuAppResourceCache,
  "preparedMaterials"
>;

export interface QueuedBuiltInFrameResourcePreparationOptions {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: QueuedBuiltInAppResourcePreparationCache;
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
  readonly snapshot: RenderSnapshot;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly sharedBindGroupCache: BindGroupResourceCache<UnlitBindGroupResource>;
  readonly lightBindGroupCache: BindGroupResourceCache<LightBindGroupResource>;
  readonly standardLightShadowBindGroupCache: BindGroupResourceCache<StandardLightShadowBindGroupResource>;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly standardAreaLightLtcResources?:
    | StandardAreaLightLtcResources
    | null
    | undefined;
  readonly localLightCookieResources?:
    | LocalLightClusterCookieResources
    | null
    | undefined;
  readonly transmissionSceneColorResources?:
    | StandardFrameTransmissionSceneColorResources
    | null
    | undefined;
  readonly reuse: WebGpuAppResourceReuseReport;
}

export interface PrepareQueuedBuiltInFrameResourcesOptions {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly standardAreaLightLtcResources?:
    | StandardAreaLightLtcResources
    | null
    | undefined;
  readonly localLightCookieResources?:
    | LocalLightClusterCookieResources
    | null
    | undefined;
  readonly transmissionSceneColorResources?:
    | StandardFrameTransmissionSceneColorResources
    | null
    | undefined;
  getPipeline(
    item: QueuedBuiltInAppResourceItem,
  ): Promise<WebGpuAppPipelineResourceResult> | WebGpuAppPipelineResourceResult;
  getPipelineLayouts(input: {
    readonly item: QueuedBuiltInAppResourceItem;
    readonly pipeline: WebGpuAppPipelineResourceResult;
    readonly getBindGroupLayout: (group: number) => unknown;
  }): WebGpuAppPipelineLayouts;
}

export interface PrepareQueuedBuiltInFrameResourcesResult {
  readonly valid: boolean;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly resourcesResult: CreateQueuedBuiltInFrameResourcesResult;
  readonly diagnostics: readonly unknown[];
  readonly pipelineResults: readonly WebGpuAppPipelinePlanResult[];
  readonly firstPipeline: WebGpuAppPipelineResourceResult | null;
  readonly pipelineKeysByRenderId: ReadonlyMap<number, string>;
  readonly meshResourceKeys: ReadonlyMap<string, string>;
  readonly materialResourceKeys: ReadonlyMap<string, string>;
}

export async function prepareQueuedBuiltInFrameResources(
  options: PrepareQueuedBuiltInFrameResourcesOptions,
): Promise<PrepareQueuedBuiltInFrameResourcesResult> {
  const prepared = await prepareQueuedBuiltInFrameResourceSet({
    resourceSet: options.resourceSet,
    scratch: options.cache.frameScratch.queuedBuiltInFrameResources,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    ...(options.instanceTints === undefined
      ? {}
      : { instanceTints: options.instanceTints }),
    callbacks: {
      getPipeline: options.getPipeline,
      onPipelineLookupReuse: ({ pipeline }) => {
        if (pipeline.valid && pipeline.resource !== null) {
          options.reuse.pipelineHits += 1;
        }
      },
      getPipelineView: (pipeline) => pipeline,
      getPipelineResourceKey: ({ item, pipeline }) =>
        pipeline.resource?.cacheKey ?? item.draw.batchKey.pipelineKey,
      createPipelinePlanResult: ({ item, pipeline }) =>
        createWebGpuAppPipelinePlanResult(item.draw, pipeline),
      getPipelineLayouts: options.getPipelineLayouts,
      prepareTextureSamplerDependencies: ({ item }) =>
        createPreparedMaterialTextureSamplerDependencies(
          item.adapter.prepareTextureSamplerResources({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            item,
            reuse: options.reuse,
          }),
        ),
      createFrameResourceOptions: ({
        item,
        textureSamplerDependencies,
        viewUniforms,
        worldTransforms,
        instanceTints,
        layouts,
        sharedBindGroupCache,
        lightBindGroupCache,
        standardLightShadowBindGroupCache,
      }) =>
        createQueuedBuiltInFrameResourceOptions({
          app: options.app,
          assets: options.assets,
          cache: options.cache,
          snapshot: options.snapshot,
          item,
          textureSamplerDependencies,
          viewUniforms,
          worldTransforms,
          ...(options.previousWorldTransforms === undefined
            ? {}
            : { previousWorldTransforms: options.previousWorldTransforms }),
          ...(instanceTints === undefined ? {} : { instanceTints }),
          layouts,
          sharedBindGroupCache,
          lightBindGroupCache,
          standardLightShadowBindGroupCache,
          ...(options.standardMaterialShadowReceiverResources === undefined
            ? {}
            : {
                standardMaterialShadowReceiverResources:
                  options.standardMaterialShadowReceiverResources,
              }),
          ...(options.standardMaterialIblResources === undefined
            ? {}
            : {
                standardMaterialIblResources:
                  options.standardMaterialIblResources,
              }),
          ...(options.standardAreaLightLtcResources === undefined
            ? {}
            : {
                standardAreaLightLtcResources:
                  options.standardAreaLightLtcResources,
              }),
          ...(options.localLightCookieResources === undefined ||
          options.localLightCookieResources === null
            ? {}
            : {
                localLightCookieResources: options.localLightCookieResources,
              }),
          ...(options.transmissionSceneColorResources === undefined
            ? {}
            : {
                transmissionSceneColorResources:
                  options.transmissionSceneColorResources,
              }),
          reuse: options.reuse,
        }),
    },
  });

  options.reuse.queuedBindGroupsCreated +=
    prepared.resourcesResult.bindGroupReuse.created;
  options.reuse.queuedBindGroupsReused +=
    prepared.resourcesResult.bindGroupReuse.reused;
  options.reuse.queuedBindGroupCacheSize +=
    prepared.resourcesResult.bindGroupReuse.cached;

  return prepared;
}

function createQueuedBuiltInFrameResourceOptions(input: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly sharedBindGroupCache: BindGroupResourceCache<UnlitBindGroupResource>;
  readonly lightBindGroupCache: BindGroupResourceCache<LightBindGroupResource>;
  readonly standardLightShadowBindGroupCache: BindGroupResourceCache<StandardLightShadowBindGroupResource>;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly standardAreaLightLtcResources?:
    | StandardAreaLightLtcResources
    | null
    | undefined;
  readonly localLightCookieResources?:
    | LocalLightClusterCookieResources
    | null
    | undefined;
  readonly transmissionSceneColorResources?:
    | StandardFrameTransmissionSceneColorResources
    | null
    | undefined;
  readonly reuse: WebGpuAppResourceReuseReport;
}): QueuedBuiltInFrameResourcePreparationOptions {
  return {
    app: input.app,
    assets: input.assets,
    cache: input.cache,
    preparedMaterials: input.cache.preparedMaterials,
    snapshot: input.snapshot,
    item: input.item,
    textureSamplerDependencies: input.textureSamplerDependencies,
    viewUniforms: input.viewUniforms,
    worldTransforms: input.worldTransforms,
    ...(input.previousWorldTransforms === undefined
      ? {}
      : { previousWorldTransforms: input.previousWorldTransforms }),
    ...(input.instanceTints === undefined
      ? {}
      : { instanceTints: input.instanceTints }),
    layouts: input.layouts,
    sharedBindGroupCache: input.sharedBindGroupCache,
    lightBindGroupCache: input.lightBindGroupCache,
    standardLightShadowBindGroupCache: input.standardLightShadowBindGroupCache,
    ...(input.standardMaterialShadowReceiverResources === undefined
      ? {}
      : {
          standardMaterialShadowReceiverResources:
            input.standardMaterialShadowReceiverResources,
        }),
    ...(input.standardMaterialIblResources === undefined
      ? {}
      : {
          standardMaterialIblResources: input.standardMaterialIblResources,
        }),
    ...(input.standardAreaLightLtcResources === undefined
      ? {}
      : {
          standardAreaLightLtcResources: input.standardAreaLightLtcResources,
        }),
    ...(input.localLightCookieResources === undefined ||
    input.localLightCookieResources === null
      ? {}
      : {
          localLightCookieResources: input.localLightCookieResources,
        }),
    ...(input.transmissionSceneColorResources === undefined
      ? {}
      : {
          transmissionSceneColorResources:
            input.transmissionSceneColorResources,
        }),
    reuse: input.reuse,
  };
}

function createWebGpuAppPipelinePlanResult(
  draw: RenderSnapshot["meshDraws"][number],
  pipeline: WebGpuAppPipelineResourceResult,
): WebGpuAppPipelinePlanResult {
  if (pipeline.resource === null) {
    throw new Error(
      "Cannot create a WebGPU app pipeline plan result without a pipeline resource.",
    );
  }

  return {
    ok: true as const,
    status: "miss" as const,
    key: pipeline.resource.cacheKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
}
