import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
  type EcsWorld,
  type Entity,
  type TransformResolutionReport,
  type WorldOptions,
} from "@aperture-engine/simulation";
import {
  RenderWorld,
  createMaterialQueuePhaseSummary,
  createPreparedMeshStore,
  createPreparedMaterialStore,
  createMaterialQueueScratch,
  createPackedSnapshotTransformsScratch,
  createPackedSnapshotViewUniformsScratch,
  createMaterialDependencyReadinessReport,
  extractRenderSnapshot,
  Material,
  materialDependencyReadinessReportToJsonValue,
  prepareSnapshotMeshes,
  prepareSnapshotMaterials,
  preparedMeshStoreSummaryToJsonValue,
  preparedMaterialStoreSummaryToJsonValue,
  writeMaterialQueueFromSnapshot,
  registerRenderAuthoringComponents,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type MaterialQueueScratch,
  type MaterialAssetDependencyReadinessReportJsonValue,
  type DebugNormalMaterialAsset,
  type MatcapMaterialAsset,
  type MaterialAsset,
  type MeshAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type PreparedMaterialStore,
  type PreparedMaterialStoreJsonValue,
  type PreparedMeshStore,
  type PreparedMeshStoreJsonValue,
  type RenderSnapshot,
  type StandardMaterialAsset,
  type UnlitMaterialAsset,
} from "@aperture-engine/render";
import {
  createAppTextureSamplerResourceCacheSummary,
  prepareMatcapAppTextureSamplerResources,
  prepareStandardAppTextureSamplerResources,
  prepareUnlitAppTextureSamplerResources,
  emptyPreparedAppTextureSamplerResources,
  sourceAssetCacheKey,
  writeAppTextureSamplerResourceCacheSummary,
  type AppTextureSamplerResourceCacheSummary,
} from "./app-texture-sampler-resources.js";
import {
  createWebGpuEnvironmentResourceCache,
  registerWebGpuAppEnvironmentResourceCache,
  type WebGpuEnvironmentResourceCache,
} from "./app-environment-resources.js";
import {
  createPreparedMaterialTextureSamplerDependencies,
  type PreparedMaterialTextureSamplerDependencies,
} from "./prepared-material-texture-sampler-dependencies.js";
import {
  createPreparedBuiltInMaterialStore,
  writePreparedBuiltInMaterialStoreSummary,
  type PreparedBuiltInMaterialStore,
} from "./prepared-built-in-material-store.js";
import {
  createPreparedAppMaterialCacheSummary,
  type PreparedAppMaterialCacheSummary,
} from "./prepared-app-material-resource.js";
import {
  createPreparedMeshGpuResourceCache,
  createPreparedMeshGpuResourceCacheSummary,
  writePreparedMeshGpuResourceCacheSummary,
  type PreparedMeshGpuResourceCache,
  type PreparedMeshGpuResourceCacheSummary,
} from "./prepared-mesh-cache.js";
import {
  assembleFrameBoundary,
  mapFrameBoundaryReadbackSamples,
  type FrameBoundaryAssemblyReport,
  type FrameBoundaryReadbackResult,
  type FrameBoundaryReadbackSampleRequest,
} from "./frame-boundary.js";
import {
  createOrReuseWebGpuDepthTexture,
  createWebGpuDepthTextureCacheSlot,
  WEBGPU_APP_DEPTH_FORMAT,
  type CachedWebGpuDepthTextureResource,
  type WebGpuDepthTextureCacheSlot,
} from "./depth-texture-resource.js";
import { createLightBindGroupLayoutDescriptor } from "./light-bind-group-layout.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import {
  STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
  createStandardLightIblBindGroupLayoutDescriptor,
  createStandardLightShadowBindGroupLayoutDescriptor,
  type StandardLightShadowBindGroupLayoutResource,
} from "./standard-light-shadow-bind-group.js";
import {
  createOrReuseDebugNormalAppFrameResources,
  type CachedDebugNormalAppFrameResources,
  type CreateDebugNormalAppFrameResourcesResult,
  type DebugNormalAppFrameResourceCacheSlot,
} from "./debug-normal-app-frame-resources.js";
import { createDebugNormalMaterialBindGroupLayoutPlan } from "./debug-normal-bind-group-layout.js";
import type { DebugNormalMaterialBindGroupLayoutResource } from "./debug-normal-bind-group.js";
import {
  createDebugNormalRenderPipelineResource,
  type CreateDebugNormalRenderPipelineResourceResult,
} from "./debug-normal-pipeline.js";
import {
  createOrReuseMatcapAppFrameResources,
  type CachedMatcapAppFrameResources,
  type CreateMatcapAppFrameResourcesResult,
  type MatcapAppFrameResourceCacheSlot,
} from "./matcap-app-frame-resources.js";
import { type MatcapMaterialBindGroupLayoutResource } from "./matcap-bind-group.js";
import { createMatcapMaterialBindGroupLayoutPlan } from "./matcap-bind-group-layout.js";
import {
  createMatcapRenderPipelineResource,
  type CreateMatcapRenderPipelineResourceResult,
} from "./matcap-pipeline.js";
import {
  isBuiltInMaterialQueueFamily,
  type BuiltInMaterialQueueFamily,
} from "./built-in-material-queue-family.js";
import {
  createQueuedBuiltInAppResourceAdapterRegistry,
  createQueuedBuiltInAppResourceFamilyAdapterTable,
  queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue,
  validateQueuedBuiltInAppResourceAdapterRegistry,
} from "./built-in-material-app-resource-adapter.js";
import {
  collectQueuedBuiltInAppResourceSet,
  createQueuedBuiltInAppRouteCollectorScratch,
  createSingleQueuedBuiltInAppResourceItem,
  type QueuedBuiltInAppResourceItem,
  type QueuedBuiltInAppResourceSet,
  type QueuedBuiltInAppRouteCollectorScratch,
} from "./queued-built-in-app-resource-set.js";
import {
  createQueuedBuiltInFrameResourceScratch,
  prepareQueuedBuiltInFrameResourceSet,
  type CreateQueuedBuiltInFrameResourcesResult,
  type QueuedBuiltInFrameResourceRouteDiagnostic,
  type QueuedBuiltInFrameResourceScratch,
  type QueuedBuiltInFrameResources,
} from "./queued-built-in-frame-resource-set.js";
import { createQueuedMaterialFrameResourceSetSummary } from "./queued-material-frame-resource-set-summary.js";
import {
  collectWebGpuAppMaterialDependencyReadiness,
  collectWebGpuAppMaterialQueueRouteReport,
  createWebGpuAppDiagnosticsSummary,
  type WebGpuAppDiagnosticsSummary,
} from "./app-diagnostics-summary.js";
import {
  createDirectLightReadinessReport,
  directLightReadinessResourceStateFromStandardFrameResources,
} from "./direct-light-readiness.js";
import { createStandardMaterialBindGroupLayoutPlan } from "./standard-bind-group-layout.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";
import {
  createOrReuseStandardAppFrameResources,
  type CachedStandardAppFrameResources,
  type CreateStandardAppFrameResourcesResult,
  type StandardAppFrameResourceCacheSlot,
} from "./standard-app-frame-resources.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
} from "./standard-frame-resources.js";
import {
  createStandardRenderPipelineResource,
  type CreateStandardRenderPipelineResourceResult,
} from "./standard-pipeline.js";
import {
  createMultiMaterialUnlitFrameGpuResources,
  type CreateMultiMaterialUnlitFrameGpuResourcesResult,
} from "./unlit-frame-resources.js";
import {
  createOrReuseUnlitAppFrameResources,
  type CachedUnlitAppFrameResources,
  type CreateUnlitAppFrameResourcesResult,
  type UnlitAppFrameResourceCacheSlot,
} from "./unlit-app-frame-resources.js";
import {
  createUnlitBindGroupLayoutMetadata,
  type UnlitBindGroupLayoutResource,
} from "./unlit-bind-group.js";
import {
  createUnlitRenderPipelineResource,
  type CreateUnlitRenderPipelineResourceResult,
} from "./unlit-pipeline.js";
import {
  type SamplerGpuResource,
  type TextureGpuResource,
} from "./texture-resources.js";
import {
  createRenderFramePlanScratch,
  writeRenderFramePlanFromSnapshot,
  type RenderFramePlanScratch,
} from "./render-frame-plan.js";
import { parseMaterialPipelineRenderStateTokens } from "./material-render-state.js";
import {
  initializeWebGpu,
  type InitializeWebGpuOptions,
  type WebGpuCanvasLike,
  type WebGpuFailure,
  type WebGpuInitializationSuccess,
} from "./index.js";

export interface WebGpuAppStepResult {
  readonly transform: TransformResolutionReport;
}

export interface WebGpuAppSpawnContext {
  readonly app: WebGpuApp;
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
}

export type WebGpuAppEntityInitializer = (
  entity: Entity,
  context: WebGpuAppSpawnContext,
) => void;

export interface WebGpuAppRenderOptions {
  readonly frame?: number;
  readonly snapshot?: RenderSnapshot;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
}

export interface WebGpuAppRenderCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly drawPackages: number;
  readonly drawCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: number;
}

export interface WebGpuAppDepthAttachmentReport {
  readonly format: string;
  readonly attached: boolean;
  readonly width: number;
  readonly height: number;
  readonly opaquePipelineDepthWriteCount: number;
}

export interface WebGpuAppResourceReuseReport {
  pipelineHits: number;
  pipelineMisses: number;
  meshBuffersCreated: number;
  meshBuffersReused: number;
  preparedMeshBuffersCreated: number;
  preparedMeshBuffersReused: number;
  preparedMeshCache: PreparedMeshGpuResourceCacheSummary;
  preparedMeshFacade: PreparedMeshStoreJsonValue;
  materialBuffersCreated: number;
  materialBuffersReused: number;
  preparedMaterialBuffersCreated: number;
  preparedMaterialBuffersReused: number;
  preparedMaterialBindGroupsCreated: number;
  preparedMaterialBindGroupsReused: number;
  preparedMaterialCache: PreparedAppMaterialCacheSummary;
  preparedMaterialFacade: PreparedMaterialStoreJsonValue;
  textureResourcesCreated: number;
  textureResourcesReused: number;
  textureSamplerCache: AppTextureSamplerResourceCacheSummary;
  samplerResourcesCreated: number;
  samplerResourcesReused: number;
  bindGroupsCreated: number;
  bindGroupsReused: number;
  lightBuffersCreated: number;
  lightBuffersReused: number;
  dynamicBufferWrites: number;
}

export type WebGpuAppFrameResourceRouteDiagnostic =
  QueuedBuiltInFrameResourceRouteDiagnostic;

export interface WebGpuAppMaterialDependencyDiagnostic {
  readonly code: "webGpuApp.materialDependenciesNotReady";
  readonly message: string;
  readonly materialDependencyReadiness: MaterialAssetDependencyReadinessReportJsonValue;
}

export interface WebGpuAppDrawResourceSet {
  readonly index: number;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly drawIndices: readonly number[];
  readonly renderIds: readonly number[];
}

export interface WebGpuAppDrawResourceSetPlan {
  readonly sets: readonly WebGpuAppDrawResourceSet[];
  readonly drawCount: number;
}

export interface WebGpuAppRenderReport {
  readonly ok: boolean;
  readonly frame: number;
  readonly snapshot: RenderSnapshot;
  readonly counts: WebGpuAppRenderCounts;
  readonly diagnostics: readonly unknown[];
  readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
  readonly resourceReuse: WebGpuAppResourceReuseReport;
  readonly pipeline: WebGpuAppPipelineResourceResult | null;
  readonly resources: WebGpuAppFrameResourcesResult | null;
  readonly boundary: FrameBoundaryAssemblyReport | null;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readback?: FrameBoundaryReadbackResult;
}

export type WebGpuAppJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly WebGpuAppJsonValue[]
  | { readonly [key: string]: WebGpuAppJsonValue };

export interface WebGpuAppRenderReportJsonValue {
  readonly ok: boolean;
  readonly frame: number;
  readonly counts: WebGpuAppRenderCounts;
  readonly diagnostics: readonly WebGpuAppJsonValue[];
  readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
  readonly resourceReuse: WebGpuAppResourceReuseReport;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readback?: WebGpuAppJsonValue;
  readonly materialDependencyReadiness?: readonly MaterialAssetDependencyReadinessReportJsonValue[];
}

export type WebGpuAppPipelineResourceResult =
  | CreateUnlitRenderPipelineResourceResult
  | CreateMatcapRenderPipelineResourceResult
  | CreateStandardRenderPipelineResourceResult
  | CreateDebugNormalRenderPipelineResourceResult;

export type WebGpuAppFrameResourcesResult =
  | CreateUnlitAppFrameResourcesResult
  | CreateMultiMaterialUnlitFrameGpuResourcesResult
  | CreateMatcapAppFrameResourcesResult
  | CreateStandardAppFrameResourcesResult
  | CreateDebugNormalAppFrameResourcesResult
  | CreateQueuedBuiltInFrameResourcesResult;

type WebGpuAppMaterialKind = BuiltInMaterialQueueFamily;

interface WebGpuAppResourceCache {
  readonly pipelines: Map<string, WebGpuAppPipelineResourceResult>;
  readonly layouts: Map<string, WebGpuAppPipelineLayouts>;
  readonly textures: Map<string, TextureGpuResource>;
  readonly samplers: Map<string, SamplerGpuResource>;
  readonly environmentResources: WebGpuEnvironmentResourceCache;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedMeshFacade: PreparedMeshStore;
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
  readonly preparedMaterialFacade: PreparedMaterialStore;
  readonly frameScratch: WebGpuAppFrameScratch;
  readonly unlitFrame: UnlitAppFrameResourceCacheSlot;
  readonly matcapFrame: MatcapAppFrameResourceCacheSlot;
  readonly standardFrame: StandardAppFrameResourceCacheSlot;
  readonly debugNormalFrame: DebugNormalAppFrameResourceCacheSlot;
  readonly depth: WebGpuDepthTextureCacheSlot;
}

interface WebGpuAppFrameScratch {
  readonly viewUniforms: ReturnType<
    typeof createPackedSnapshotViewUniformsScratch
  >;
  readonly worldTransforms: ReturnType<
    typeof createPackedSnapshotTransformsScratch
  >;
  readonly framePlan: RenderFramePlanScratch;
  readonly materialQueue: MaterialQueueScratch;
  readonly queueRoute: QueuedBuiltInAppRouteCollectorScratch;
  readonly queuedBuiltInFrameResources: QueuedBuiltInFrameResourceScratch<WebGpuAppPipelinePlanResult>;
}

interface WebGpuAppPipelineLayouts {
  readonly kind: WebGpuAppMaterialKind;
  readonly pipelineResourceKey: string;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout:
    | MatcapMaterialBindGroupLayoutResource
    | StandardMaterialBindGroupLayoutResource
    | DebugNormalMaterialBindGroupLayoutResource
    | null;
  readonly lightLayout:
    | LightBindGroupLayoutResource
    | StandardLightShadowBindGroupLayoutResource
    | null;
}

interface WebGpuAppFrameResourceCacheSlot<TCachedFrameResources> {
  current: TCachedFrameResources | null;
}

interface MultiUnlitAppResourceSet {
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly materials: readonly UnlitMaterialAsset[];
  readonly materialKeys: readonly string[];
}

interface WebGpuAppPipelinePlanResult {
  readonly ok: true;
  readonly status: "miss";
  readonly key: string;
  readonly pipeline: unknown;
  readonly diagnostics: readonly [];
}

interface QueuedBuiltInTextureSamplerPreparationOptions {
  readonly app: WebGpuApp;
  readonly cache: QueuedBuiltInAppResourcePreparationCache;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly reuse: WebGpuAppResourceReuseReport;
}

interface QueuedBuiltInFrameResourcePreparationOptions {
  readonly app: WebGpuApp;
  readonly cache: QueuedBuiltInAppResourcePreparationCache;
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
  readonly snapshot: RenderSnapshot;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly reuse: WebGpuAppResourceReuseReport;
}

type QueuedBuiltInAppResourcePreparationCache = Omit<
  WebGpuAppResourceCache,
  "preparedMaterials"
>;

export interface WebGpuApp {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  readonly canvas: WebGpuCanvasLike;
  readonly initialization: WebGpuInitializationSuccess;
  readonly renderWorld: RenderWorld;
  spawn(...initializers: WebGpuAppEntityInitializer[]): Entity;
  registerSystem(system: Parameters<EcsWorld["registerSystem"]>[0]): WebGpuApp;
  step(delta?: number, time?: number): WebGpuAppStepResult;
  extract(frame?: number): RenderSnapshot;
  render(options?: WebGpuAppRenderOptions): Promise<WebGpuAppRenderReport>;
  stepAndRender(
    delta?: number,
    time?: number,
    frame?: number,
  ): Promise<WebGpuAppRenderReport>;
}

export interface CreateWebGpuAppOptions extends Omit<
  InitializeWebGpuOptions,
  "canvas"
> {
  readonly canvas: WebGpuCanvasLike;
  readonly assets?: AssetRegistry;
  readonly world?: EcsWorld;
  readonly worldOptions?: Partial<WorldOptions>;
}

export interface CreateWebGpuAppSuccess {
  readonly ok: true;
  readonly app: WebGpuApp;
  readonly initialization: WebGpuInitializationSuccess;
}

export type CreateWebGpuAppResult = CreateWebGpuAppSuccess | WebGpuFailure;

export async function createWebGpuApp(
  options: CreateWebGpuAppOptions,
): Promise<CreateWebGpuAppResult> {
  const initialization = await initializeWebGpu(options);

  if (!initialization.ok) {
    return initialization;
  }

  const world = options.world ?? createWorld(options.worldOptions);
  const assets = options.assets ?? new AssetRegistry();
  const renderWorld = new RenderWorld();
  const resourceCache = createWebGpuAppResourceCache();

  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);

  const app: WebGpuApp = {
    world,
    assets,
    canvas: options.canvas,
    initialization,
    renderWorld,
    spawn(...initializers) {
      const entity = world.createEntity();
      const context: WebGpuAppSpawnContext = { app, world, assets };

      for (const initializer of initializers) {
        initializer(entity, context);
      }

      return entity;
    },
    registerSystem(system) {
      world.registerSystem(system);
      return this;
    },
    step(delta = 0, time = 0) {
      world.update(delta, time);
      return { transform: resolveWorldTransforms(world) };
    },
    extract(frame = 0) {
      return extractRenderSnapshot(world, assets, { frame });
    },
    async render(renderOptions = {}) {
      const report = await renderWebGpuAppFrame(
        app,
        resourceCache,
        renderOptions,
      );

      prepareSnapshotMeshes({
        registry: assets,
        snapshot: report.snapshot,
        meshes: resourceCache.preparedMeshFacade,
        pruneUnreferenced: true,
      });
      report.resourceReuse.preparedMeshFacade =
        preparedMeshStoreSummaryToJsonValue(resourceCache.preparedMeshFacade);
      writeWebGpuAppPreparedMeshCacheSummary(
        report.resourceReuse.preparedMeshCache,
        resourceCache,
      );
      prepareSnapshotMaterials({
        registry: assets,
        snapshot: report.snapshot,
        materials: resourceCache.preparedMaterialFacade,
        pruneUnreferenced: true,
      });
      report.resourceReuse.preparedMaterialFacade =
        preparedMaterialStoreSummaryToJsonValue(
          resourceCache.preparedMaterialFacade,
        );
      writeWebGpuAppPreparedMaterialCacheSummary(
        report.resourceReuse.preparedMaterialCache,
        resourceCache,
      );
      writeWebGpuAppTextureSamplerCacheSummary(
        report.resourceReuse.textureSamplerCache,
        resourceCache,
      );

      return report;
    },
    async stepAndRender(delta = 0, time = 0, frame = 0) {
      this.step(delta, time);
      return this.render({ frame });
    },
  };

  registerWebGpuAppEnvironmentResourceCache(
    app,
    resourceCache.environmentResources,
  );

  return { ok: true, app, initialization };
}

function createWebGpuAppResourceCache(): WebGpuAppResourceCache {
  return {
    pipelines: new Map(),
    layouts: new Map(),
    textures: new Map(),
    samplers: new Map(),
    environmentResources: createWebGpuEnvironmentResourceCache(),
    preparedMeshes: createPreparedMeshGpuResourceCache(),
    preparedMeshFacade: createPreparedMeshStore(),
    preparedMaterials: createPreparedBuiltInMaterialStore(),
    preparedMaterialFacade: createPreparedMaterialStore(),
    frameScratch: createWebGpuAppFrameScratch(),
    unlitFrame:
      createWebGpuAppFrameResourceCacheSlot<CachedUnlitAppFrameResources>(),
    matcapFrame:
      createWebGpuAppFrameResourceCacheSlot<CachedMatcapAppFrameResources>(),
    standardFrame:
      createWebGpuAppFrameResourceCacheSlot<CachedStandardAppFrameResources>(),
    debugNormalFrame:
      createWebGpuAppFrameResourceCacheSlot<CachedDebugNormalAppFrameResources>(),
    depth: createWebGpuDepthTextureCacheSlot(),
  };
}

function createWebGpuAppFrameResourceCacheSlot<
  TCachedFrameResources,
>(): WebGpuAppFrameResourceCacheSlot<TCachedFrameResources> {
  return { current: null };
}

function createWebGpuAppFrameScratch(): WebGpuAppFrameScratch {
  return {
    viewUniforms: createPackedSnapshotViewUniformsScratch(),
    worldTransforms: createPackedSnapshotTransformsScratch(),
    framePlan: createRenderFramePlanScratch(),
    materialQueue: createMaterialQueueScratch(),
    queueRoute: createQueuedBuiltInAppRouteCollectorScratch(),
    queuedBuiltInFrameResources:
      createQueuedBuiltInFrameResourceScratch<WebGpuAppPipelinePlanResult>(),
  };
}

async function getOrCreateWebGpuAppPipeline(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly kind: WebGpuAppMaterialKind;
  readonly pipelineKey: string;
  readonly batchKey: RenderSnapshot["meshDraws"][number]["batchKey"];
}): Promise<WebGpuAppPipelineResourceResult> {
  const key = [
    options.kind,
    options.app.initialization.format,
    WEBGPU_APP_DEPTH_FORMAT,
    options.pipelineKey,
  ].join("|");
  const cached = options.cache.pipelines.get(key);

  if (cached !== undefined) {
    options.reuse.pipelineHits += 1;
    return cached;
  }

  options.reuse.pipelineMisses += 1;

  const pipeline =
    options.kind === "standard"
      ? await createStandardRenderPipelineResource({
          device: options.app.initialization.device as Parameters<
            typeof createStandardRenderPipelineResource
          >[0]["device"],
          colorFormat: options.app.initialization.format,
          depthFormat: WEBGPU_APP_DEPTH_FORMAT,
          batchKey: options.batchKey,
        })
      : options.kind === "debug-normal"
        ? await createDebugNormalRenderPipelineResource({
            device: options.app.initialization.device as Parameters<
              typeof createDebugNormalRenderPipelineResource
            >[0]["device"],
            colorFormat: options.app.initialization.format,
            depthFormat: WEBGPU_APP_DEPTH_FORMAT,
            batchKey: options.batchKey,
          })
        : options.kind === "matcap"
          ? await createMatcapRenderPipelineResource({
              device: options.app.initialization.device as Parameters<
                typeof createMatcapRenderPipelineResource
              >[0]["device"],
              colorFormat: options.app.initialization.format,
              depthFormat: WEBGPU_APP_DEPTH_FORMAT,
              batchKey: options.batchKey,
            })
          : await createUnlitRenderPipelineResource({
              device: options.app.initialization.device as Parameters<
                typeof createUnlitRenderPipelineResource
              >[0]["device"],
              colorFormat: options.app.initialization.format,
              depthFormat: WEBGPU_APP_DEPTH_FORMAT,
              batchKey: options.batchKey,
            });

  if (pipeline.valid && pipeline.resource !== null) {
    options.cache.pipelines.set(key, pipeline);
  }

  return pipeline;
}

function getWebGpuAppPipelineLayouts(options: {
  readonly cache: WebGpuAppResourceCache;
  readonly kind: WebGpuAppMaterialKind;
  readonly pipeline: WebGpuAppPipelineResourceResult;
  readonly getBindGroupLayout: (group: number) => unknown;
}): WebGpuAppPipelineLayouts {
  const pipelineResourceKey = options.pipeline.resource?.cacheKey ?? "missing";
  const key = `${options.kind}|${pipelineResourceKey}`;
  const cached = options.cache.layouts.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const layouts =
    options.kind === "standard"
      ? createStandardAppPipelineLayouts(
          pipelineResourceKey,
          options.getBindGroupLayout,
        )
      : options.kind === "debug-normal"
        ? createDebugNormalAppPipelineLayouts(
            pipelineResourceKey,
            options.getBindGroupLayout,
          )
        : options.kind === "matcap"
          ? createMatcapAppPipelineLayouts(
              pipelineResourceKey,
              options.getBindGroupLayout,
            )
          : createUnlitAppPipelineLayouts(
              pipelineResourceKey,
              options.getBindGroupLayout,
            );

  options.cache.layouts.set(key, layouts);
  return layouts;
}

function createUnlitAppPipelineLayouts(
  pipelineResourceKey: string,
  getBindGroupLayout: (group: number) => unknown,
): WebGpuAppPipelineLayouts {
  return {
    kind: "unlit",
    pipelineResourceKey,
    sharedLayouts: [0, 1, 2].map((group) => ({
      group,
      layoutKey: `webgpu-app/unlit/group-${group}`,
      layout: getBindGroupLayout(group),
    })),
    materialLayout: null,
    lightLayout: null,
  };
}

function createStandardAppPipelineLayouts(
  pipelineResourceKey: string,
  getBindGroupLayout: (group: number) => unknown,
): WebGpuAppPipelineLayouts {
  const usesLightShadowIblGroup = pipelineResourceKey.includes(
    STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
  );
  const usesLightIblGroup = pipelineResourceKey.includes(
    STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY,
  );
  const usesSpecularIblProof = pipelineResourceKey.includes(
    "specular-ibl-proof@7",
  );
  const usesLightShadowGroup = pipelineResourceKey.includes(
    STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  );
  const lightLayoutKey = usesLightShadowIblGroup
    ? "webgpu-app/standard/lights-shadow-ibl/group-3"
    : usesLightIblGroup
      ? "webgpu-app/standard/lights-ibl/group-3"
      : usesLightShadowGroup
        ? "webgpu-app/standard/lights-shadow/group-3"
        : "webgpu-app/standard/group-3";

  return {
    kind: "standard",
    pipelineResourceKey,
    sharedLayouts: [0, 1].map((group) => ({
      group,
      layoutKey: `webgpu-app/standard/group-${group}`,
      layout: getBindGroupLayout(group),
      metadata: createUnlitBindGroupLayoutMetadata(
        group,
        `webgpu-app/standard/group-${group}`,
      ),
    })),
    materialLayout: {
      group: 2,
      layoutKey: "webgpu-app/standard/group-2",
      layout: getBindGroupLayout(2),
      descriptor: createStandardMaterialBindGroupLayoutPlan(
        "webgpu-app/standard/group-2",
      ).layout,
    },
    lightLayout: {
      group: 3,
      layoutKey: lightLayoutKey,
      layout: getBindGroupLayout(3),
      descriptor:
        usesLightShadowIblGroup || usesLightIblGroup
          ? createStandardLightIblBindGroupLayoutDescriptor({
              shadowMap: usesLightShadowIblGroup,
              specularProof: usesSpecularIblProof,
            })
          : usesLightShadowGroup
            ? createStandardLightShadowBindGroupLayoutDescriptor()
            : createLightBindGroupLayoutDescriptor({
                group: 3,
                label: "webgpu-app/standard/group-3",
              }),
    },
  };
}

function createMatcapAppPipelineLayouts(
  pipelineResourceKey: string,
  getBindGroupLayout: (group: number) => unknown,
): WebGpuAppPipelineLayouts {
  return {
    kind: "matcap",
    pipelineResourceKey,
    sharedLayouts: [0, 1].map((group) => ({
      group,
      layoutKey: `webgpu-app/matcap/group-${group}`,
      layout: getBindGroupLayout(group),
      metadata: createUnlitBindGroupLayoutMetadata(
        group,
        `webgpu-app/matcap/group-${group}`,
      ),
    })),
    materialLayout: {
      group: 2,
      layoutKey: "webgpu-app/matcap/group-2",
      layout: getBindGroupLayout(2),
      descriptor: createMatcapMaterialBindGroupLayoutPlan(
        "webgpu-app/matcap/group-2",
      ).layout,
    },
    lightLayout: null,
  };
}

function createDebugNormalAppPipelineLayouts(
  pipelineResourceKey: string,
  getBindGroupLayout: (group: number) => unknown,
): WebGpuAppPipelineLayouts {
  return {
    kind: "debug-normal",
    pipelineResourceKey,
    sharedLayouts: [0, 1].map((group) => ({
      group,
      layoutKey: `webgpu-app/debug-normal/group-${group}`,
      layout: getBindGroupLayout(group),
      metadata: createUnlitBindGroupLayoutMetadata(
        group,
        `webgpu-app/debug-normal/group-${group}`,
      ),
    })),
    materialLayout: {
      group: 2,
      layoutKey: "webgpu-app/debug-normal/group-2",
      layout: getBindGroupLayout(2),
      descriptor: createDebugNormalMaterialBindGroupLayoutPlan(
        "webgpu-app/debug-normal/group-2",
      ).layout,
    },
    lightLayout: null,
  };
}

function createMultiUnlitAppFrameResources(options: {
  readonly app: WebGpuApp;
  readonly mesh: MeshAsset | null;
  readonly materials: readonly UnlitMaterialAsset[];
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly reuse: WebGpuAppResourceReuseReport;
}): CreateMultiMaterialUnlitFrameGpuResourcesResult {
  const result = createMultiMaterialUnlitFrameGpuResources({
    device: options.app.initialization.device as Parameters<
      typeof createMultiMaterialUnlitFrameGpuResources
    >[0]["device"],
    mesh: options.mesh,
    materials: options.materials,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    layouts: options.layouts.sharedLayouts,
  });

  if (result.valid && result.resources !== null) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += result.resources.materials.length;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
  }

  return result;
}

function collectMultiUnlitAppResourceSet(options: {
  readonly app: WebGpuApp;
  readonly snapshot: RenderSnapshot;
  readonly plan: WebGpuAppDrawResourceSetPlan;
  readonly firstDraw: RenderSnapshot["meshDraws"][number];
}): MultiUnlitAppResourceSet | null {
  if (options.plan.sets.length <= 1) {
    return null;
  }

  const meshKey = options.plan.sets[0]?.meshKey;
  const pipelineKey = options.firstDraw.batchKey.pipelineKey;
  const materials: UnlitMaterialAsset[] = [];
  const materialKeys: string[] = [];

  if (meshKey === undefined) {
    return null;
  }

  for (const set of options.plan.sets) {
    if (set.meshKey !== meshKey) {
      return null;
    }

    const firstDrawIndex = set.drawIndices[0];
    const draw =
      firstDrawIndex === undefined
        ? undefined
        : options.snapshot.meshDraws[firstDrawIndex];

    if (draw === undefined || draw.batchKey.pipelineKey !== pipelineKey) {
      return null;
    }

    const entry = options.app.assets.get<"material", MaterialAsset>(
      draw.material,
    );

    if (
      entry === undefined ||
      entry.status !== "ready" ||
      entry.asset === null ||
      entry.asset.kind !== "unlit" ||
      entry.asset.baseColorTexture !== null
    ) {
      return null;
    }

    materials.push(entry.asset);
    materialKeys.push(assetHandleKey(draw.material));
  }

  const meshEntry = options.app.assets.get<"mesh", MeshAsset>(
    options.firstDraw.mesh,
  );

  if (
    meshEntry === undefined ||
    meshEntry.status !== "ready" ||
    meshEntry.asset === null
  ) {
    return null;
  }

  return {
    mesh: meshEntry.asset,
    meshKey: sourceAssetCacheKey(options.firstDraw.mesh, meshEntry.version),
    materials,
    materialKeys,
  };
}

const QUEUED_BUILT_IN_MATERIAL_ADAPTERS =
  createQueuedBuiltInAppResourceAdapterRegistry<
    QueuedBuiltInTextureSamplerPreparationOptions,
    QueuedBuiltInFrameResourcePreparationOptions
  >({
    families: createQueuedBuiltInAppResourceFamilyAdapterTable({
      prepareUnlitTextureSamplerResources: (options) =>
        prepareUnlitAppTextureSamplerResources({
          assets: options.app.assets,
          device: options.app.initialization.device,
          cache: options.cache,
          material: options.item.material as UnlitMaterialAsset,
          reuse: options.reuse,
        }),
      prepareMatcapTextureSamplerResources: (options) =>
        prepareMatcapAppTextureSamplerResources({
          assets: options.app.assets,
          device: options.app.initialization.device,
          cache: options.cache,
          material: options.item.material as MatcapMaterialAsset,
          reuse: options.reuse,
        }),
      prepareStandardTextureSamplerResources: (options) =>
        prepareStandardAppTextureSamplerResources({
          assets: options.app.assets,
          device: options.app.initialization.device,
          cache: options.cache,
          material: options.item.material as StandardMaterialAsset,
          reuse: options.reuse,
        }),
      prepareDebugNormalTextureSamplerResources: () =>
        emptyPreparedAppTextureSamplerResources(),
      createUnlitFrameResources: (options) =>
        createOrReuseUnlitAppFrameResources({
          device: options.app.initialization.device,
          cache: options.cache.unlitFrame,
          mesh: options.item.mesh,
          meshHandle: options.item.draw.mesh,
          meshKey: options.item.meshKey,
          material: options.item.material as UnlitMaterialAsset,
          materialHandle: options.item.draw.material,
          materialKey: options.item.materialKey,
          sourceMaterialKey: options.item.sourceMaterialKey,
          frame: options.snapshot.frame,
          pipelineKey: options.item.draw.batchKey.pipelineKey,
          preparedMeshes: options.cache.preparedMeshes,
          preparedScalarMaterials: options.preparedMaterials.unlit,
          assets: options.app.assets,
          textureSamplerDependencies: options.textureSamplerDependencies,
          viewUniforms: options.viewUniforms,
          worldTransforms: options.worldTransforms,
          layouts: options.layouts.sharedLayouts,
          reuse: options.reuse,
        }),
      createMatcapFrameResources: (options) =>
        createOrReuseMatcapAppFrameResources({
          device: options.app.initialization.device,
          cache: options.cache.matcapFrame,
          mesh: options.item.mesh,
          meshHandle: options.item.draw.mesh,
          meshKey: options.item.meshKey,
          material: options.item.material as MatcapMaterialAsset,
          materialHandle: options.item.draw.material,
          materialKey: options.item.materialKey,
          sourceMaterialKey: options.item.sourceMaterialKey,
          frame: options.snapshot.frame,
          pipelineKey: options.item.draw.batchKey.pipelineKey,
          assets: options.app.assets,
          textureSamplerDependencies: options.textureSamplerDependencies,
          viewUniforms: options.viewUniforms,
          worldTransforms: options.worldTransforms,
          sharedLayouts: options.layouts.sharedLayouts,
          materialLayout: options.layouts
            .materialLayout as MatcapMaterialBindGroupLayoutResource | null,
          preparedMeshes: options.cache.preparedMeshes,
          preparedMatcapMaterials: options.preparedMaterials.matcap,
          reuse: options.reuse,
        }),
      createStandardFrameResources: (options) =>
        createOrReuseStandardAppFrameResources({
          device: options.app.initialization.device,
          cache: options.cache.standardFrame,
          snapshot: options.snapshot,
          mesh: options.item.mesh,
          meshHandle: options.item.draw.mesh,
          meshKey: options.item.meshKey,
          material: options.item.material as StandardMaterialAsset,
          materialHandle: options.item.draw.material,
          materialKey: options.item.materialKey,
          sourceMaterialKey: options.item.sourceMaterialKey,
          pipelineKey: options.item.draw.batchKey.pipelineKey,
          assets: options.app.assets,
          textureSamplerDependencies: options.textureSamplerDependencies,
          viewUniforms: options.viewUniforms,
          worldTransforms: options.worldTransforms,
          sharedLayouts: options.layouts.sharedLayouts,
          materialLayout: options.layouts
            .materialLayout as StandardMaterialBindGroupLayoutResource | null,
          lightLayout: options.layouts.lightLayout,
          ...(options.standardMaterialShadowReceiverResources === undefined
            ? {}
            : {
                shadowReceiverResources:
                  options.standardMaterialShadowReceiverResources,
              }),
          ...(options.standardMaterialIblResources === undefined
            ? {}
            : {
                standardMaterialIblResources:
                  options.standardMaterialIblResources,
              }),
          preparedMeshes: options.cache.preparedMeshes,
          preparedScalarMaterials: options.preparedMaterials.standard,
          reuse: options.reuse,
        }),
      createDebugNormalFrameResources: (options) =>
        createOrReuseDebugNormalAppFrameResources({
          device: options.app.initialization.device,
          cache: options.cache.debugNormalFrame,
          mesh: options.item.mesh,
          meshHandle: options.item.draw.mesh,
          meshKey: options.item.meshKey,
          material: options.item.material as DebugNormalMaterialAsset,
          materialHandle: options.item.draw.material,
          materialKey: options.item.materialKey,
          sourceMaterialKey: options.item.sourceMaterialKey,
          frame: options.snapshot.frame,
          pipelineKey: options.item.draw.batchKey.pipelineKey,
          assets: options.app.assets,
          viewUniforms: options.viewUniforms,
          worldTransforms: options.worldTransforms,
          sharedLayouts: options.layouts.sharedLayouts,
          materialLayout: options.layouts
            .materialLayout as DebugNormalMaterialBindGroupLayoutResource | null,
          preparedMeshes: options.cache.preparedMeshes,
          preparedDebugNormalMaterials: options.preparedMaterials.debugNormal,
          reuse: options.reuse,
        }),
    }),
  });
const QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION =
  queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(
    validateQueuedBuiltInAppResourceAdapterRegistry(
      QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
    ),
  );

async function renderQueuedBuiltInWebGpuAppFrame(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
}): Promise<WebGpuAppRenderReport> {
  const packedViews = writePackedSnapshotViewUniforms(
    options.snapshot,
    options.cache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    options.snapshot,
    options.cache.frameScratch.worldTransforms,
  );
  const prepared = await prepareQueuedBuiltInFrameResources({
    ...options,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    ...(options.standardMaterialShadowReceiverResources === undefined
      ? {}
      : {
          standardMaterialShadowReceiverResources:
            options.standardMaterialShadowReceiverResources,
        }),
    ...(options.standardMaterialIblResources === undefined
      ? {}
      : {
          standardMaterialIblResources: options.standardMaterialIblResources,
        }),
  });
  const diagnosticsSummary = createQueuedBuiltInAppDiagnosticsSummary({
    snapshot: options.snapshot,
    resourceSet: options.resourceSet,
    resources: prepared.resources,
  });

  if (!prepared.valid || prepared.resources === null) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      resourceReuse: options.reuse,
      diagnosticsSummary,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...prepared.diagnostics,
      ],
    });
  }

  const queue = writeMaterialQueueFromSnapshot(
    { meshDraws: options.snapshot.meshDraws, diagnostics: [] },
    {
      meshResourceKey: (input) =>
        prepared.meshResourceKeys.get(input.meshKey) ?? null,
      materialResourceKey: (input) =>
        prepared.materialResourceKeys.get(input.materialKey) ?? null,
    },
    options.cache.frameScratch.materialQueue,
  );

  if (queue.diagnostics.length > 0) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      resourceReuse: options.reuse,
      diagnosticsSummary,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...queue.diagnostics,
      ],
    });
  }

  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot: options.snapshot,
    renderWorld: options.app.renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      prepared.meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
    resolveMaterialResourceKey: (draw) =>
      prepared.materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
    meshResources: prepared.resources.meshResources,
    pipelines: prepared.pipelineResults,
    bindGroups: prepared.resources.bindGroups,
    scratch: options.cache.frameScratch.framePlan,
  });
  const depthAttachment = createWebGpuAppDepthAttachment(
    options.app,
    options.cache,
  );
  const boundary = assembleFrameBoundary({
    context: options.app.initialization.context as Parameters<
      typeof assembleFrameBoundary
    >[0]["context"],
    device: options.app.initialization.device as Parameters<
      typeof assembleFrameBoundary
    >[0]["device"],
    queue: (options.app.initialization.device as { readonly queue: unknown })
      .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
    commands: framePlan.commandPlan.commands,
    label: options.label ?? "aperture-webgpu-app",
    clearColor: options.clearColor ?? [0, 0, 0, 1],
    depthTarget: {
      view: depthAttachment.view,
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
    ...(options.readbackSamples === undefined
      ? {}
      : {
          readback: {
            format: options.app.initialization.format,
            ...webGpuAppCanvasDimensions(options.app.canvas),
            samples: options.readbackSamples,
          },
        }),
  });

  await waitForSubmittedWork(options.app.initialization.device);
  const frameOk =
    framePlan.apply.diagnostics.length === 0 &&
    framePlan.bindingPlan.diagnostics.length === 0 &&
    framePlan.packages.diagnostics.length === 0 &&
    framePlan.drawCommands.diagnostics.length === 0 &&
    framePlan.drawList.valid &&
    framePlan.resources.valid &&
    framePlan.commandPlan.valid &&
    boundary.valid;
  const readback = await mapFrameBoundaryReadbackSamples(
    boundary.readback,
    frameOk,
  );

  return renderReport({
    ok: frameOk,
    snapshot: options.snapshot,
    pipeline: prepared.firstPipeline,
    resources: prepared.resourcesResult,
    boundary,
    depthAttachment: createWebGpuAppDepthAttachmentReport(
      options.snapshot,
      depthAttachment,
    ),
    ...(readback === undefined ? {} : { readback }),
    resourceReuse: options.reuse,
    diagnosticsSummary,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: framePlan.commandPlan.commands.length,
    drawCalls: framePlan.commandPlan.drawCount,
    diagnostics: [
      ...options.snapshot.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...boundary.texture.diagnostics,
      ...(boundary.attachments?.diagnostics ?? []),
      ...(boundary.encoder?.diagnostics ?? []),
      ...(boundary.begin?.diagnostics ?? []),
      ...(boundary.execution?.diagnostics ?? []),
      ...(boundary.end?.diagnostics ?? []),
      ...(boundary.finish?.diagnostics ?? []),
      ...(boundary.submit?.diagnostics ?? []),
    ],
  });
}

function createQueuedBuiltInAppDiagnosticsSummary(input: {
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly resources: QueuedBuiltInFrameResources | null;
}): WebGpuAppDiagnosticsSummary {
  const hasStandardRoute = input.resourceSet.items.some(
    (item) => item.queueItem.materialFamily === "standard",
  );

  return createWebGpuAppDiagnosticsSummary({
    materialQueue: createMaterialQueuePhaseSummary(
      input.resourceSet.items.map((item) => item.queueItem),
    ),
    routedResourceSet: createQueuedMaterialFrameResourceSetSummary(
      input.resourceSet.items.map((item) => ({
        materialFamily: item.queueItem.materialFamily,
        pipelineKey: item.draw.batchKey.pipelineKey,
        renderPhase: item.queueItem.renderPhase,
      })),
      input.resources === null
        ? {}
        : { byFamily: input.resources.byFamilySummary },
    ),
    builtInAppResourceAdapters: QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
    ...(hasStandardRoute
      ? {
          directLighting: createDirectLightReadinessReport({
            snapshot: input.snapshot,
            resources:
              input.resources === null
                ? null
                : directLightReadinessResourceStateFromStandardFrameResources(
                    input.resources.standard[0] ?? null,
                  ),
          }),
        }
      : {}),
  });
}

function createQueuedBuiltInRouteFailureDiagnosticsSummary(
  diagnostics: readonly unknown[],
): WebGpuAppDiagnosticsSummary | undefined {
  const materialQueueRoute =
    collectWebGpuAppMaterialQueueRouteReport(diagnostics);

  return materialQueueRoute === null
    ? undefined
    : createWebGpuAppDiagnosticsSummary({
        materialQueueRoute,
        builtInAppResourceAdapters:
          QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
      });
}

async function prepareQueuedBuiltInFrameResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
}): Promise<{
  readonly valid: boolean;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly resourcesResult: CreateQueuedBuiltInFrameResourcesResult;
  readonly diagnostics: readonly unknown[];
  readonly pipelineResults: readonly WebGpuAppPipelinePlanResult[];
  readonly firstPipeline: WebGpuAppPipelineResourceResult | null;
  readonly meshResourceKeys: ReadonlyMap<string, string>;
  readonly materialResourceKeys: ReadonlyMap<string, string>;
}> {
  return prepareQueuedBuiltInFrameResourceSet({
    resourceSet: options.resourceSet,
    scratch: options.cache.frameScratch.queuedBuiltInFrameResources,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    callbacks: {
      getPipeline: (item) =>
        getOrCreateWebGpuAppPipeline({
          app: options.app,
          cache: options.cache,
          reuse: options.reuse,
          kind: item.adapter.kind,
          pipelineKey: item.draw.batchKey.pipelineKey,
          batchKey: item.draw.batchKey,
        }),
      getPipelineView: (pipeline) => pipeline,
      createPipelinePlanResult: ({ item, pipeline }) =>
        createWebGpuAppPipelinePlanResult(item.draw, pipeline),
      getPipelineLayouts: ({ item, pipeline, getBindGroupLayout }) =>
        getWebGpuAppPipelineLayouts({
          cache: options.cache,
          kind: item.adapter.kind,
          pipeline,
          getBindGroupLayout,
        }),
      prepareTextureSamplerDependencies: ({ item }) =>
        createPreparedMaterialTextureSamplerDependencies(
          item.adapter.prepareTextureSamplerResources({
            app: options.app,
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
        layouts,
      }) =>
        createQueuedBuiltInFrameResourceOptions({
          app: options.app,
          cache: options.cache,
          snapshot: options.snapshot,
          item,
          textureSamplerDependencies,
          viewUniforms,
          worldTransforms,
          layouts,
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
          reuse: options.reuse,
        }),
    },
  });
}

function createQueuedBuiltInFrameResourceOptions(input: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly reuse: WebGpuAppResourceReuseReport;
}): QueuedBuiltInFrameResourcePreparationOptions {
  return {
    app: input.app,
    cache: input.cache,
    preparedMaterials: input.cache.preparedMaterials,
    snapshot: input.snapshot,
    item: input.item,
    textureSamplerDependencies: input.textureSamplerDependencies,
    viewUniforms: input.viewUniforms,
    worldTransforms: input.worldTransforms,
    layouts: input.layouts,
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
    key: draw.batchKey.pipelineKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
}

async function renderWebGpuAppFrame(
  app: WebGpuApp,
  resourceCache: WebGpuAppResourceCache,
  options: WebGpuAppRenderOptions,
): Promise<WebGpuAppRenderReport> {
  const reuse = createWebGpuAppResourceReuseReport();
  const extractedSnapshot = options.snapshot ?? app.extract(options.frame ?? 0);
  const shadowSnapshot = hasReadyStandardShadowReceiverResources(
    options.standardMaterialShadowReceiverResources,
  )
    ? withStandardShadowPipelineKeys(extractedSnapshot)
    : extractedSnapshot;
  const snapshot = hasReadyStandardDiffuseIblResources(
    options.standardMaterialIblResources,
  )
    ? withStandardIblPipelineKeys(
        shadowSnapshot,
        hasReadyStandardSpecularIblProofResources(
          options.standardMaterialIblResources,
        ),
      )
    : shadowSnapshot;
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];
  const resourceSetPlan = createWebGpuAppDrawResourceSetPlan(snapshot);

  if (firstDraw === undefined || firstView === undefined) {
    const materialDependencyDiagnostics = diagnoseSnapshotMaterialDependencies(
      app,
      snapshot,
    );

    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...materialDependencyDiagnostics,
        {
          code: "webGpuApp.emptySnapshot",
          message:
            "WebGPU app render requires at least one view and one mesh draw.",
        },
      ],
    });
  }

  const snapshotMaterialDependencyDiagnostics =
    diagnoseSnapshotMaterialDependencies(app, snapshot);

  if (snapshotMaterialDependencyDiagnostics.length > 0) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...snapshotMaterialDependencyDiagnostics,
      ],
    });
  }

  const meshEntry = app.assets.get<"mesh", MeshAsset>(firstDraw.mesh);
  const materialEntry = app.assets.get<"material", MaterialAsset>(
    firstDraw.material,
  );
  const mesh = meshEntry?.asset ?? null;
  const material = materialEntry?.asset ?? null;

  if (mesh === null || material === null) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.missingSourceAsset",
          message: "WebGPU app render requires ready mesh and material assets.",
        },
      ],
    });
  }

  const materialDependencyReadiness = createMaterialDependencyReadinessReport({
    registry: app.assets,
    material: firstDraw.material,
  });

  if (!materialDependencyReadiness.ready) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        createWebGpuAppMaterialDependencyDiagnostic(
          materialDependencyReadiness,
        ),
      ],
    });
  }

  const firstMaterialKindSupported = isBuiltInMaterialQueueFamily(
    material.kind,
  );

  if (!firstMaterialKindSupported && resourceSetPlan.sets.length <= 1) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialKind",
          message: `WebGPU app render supports unlit, matcap, standard, and debug-normal materials, not '${material.kind}'.`,
        },
      ],
    });
  }

  const multiUnlit = collectMultiUnlitAppResourceSet({
    app,
    snapshot,
    plan: resourceSetPlan,
    firstDraw,
  });
  const shouldUseQueuedBuiltInRoute =
    multiUnlit === null &&
    (firstMaterialKindSupported || resourceSetPlan.sets.length > 1);

  if (shouldUseQueuedBuiltInRoute) {
    prepareSnapshotMeshes({
      registry: app.assets,
      snapshot,
      meshes: resourceCache.preparedMeshFacade,
    });
    prepareSnapshotMaterials({
      registry: app.assets,
      snapshot,
      materials: resourceCache.preparedMaterialFacade,
    });
  }

  const queuedBuiltIn = shouldUseQueuedBuiltInRoute
    ? collectQueuedBuiltInAppResourceSet({
        assets: app.assets,
        snapshot,
        materialQueueScratch: resourceCache.frameScratch.materialQueue,
        routeScratch: resourceCache.frameScratch.queueRoute,
        meshes: resourceCache.preparedMeshFacade,
        materials: resourceCache.preparedMaterialFacade,
        adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
      })
    : null;

  if (queuedBuiltIn !== null && !queuedBuiltIn.valid) {
    const diagnosticsSummary =
      createQueuedBuiltInRouteFailureDiagnosticsSummary(
        queuedBuiltIn.diagnostics,
      );

    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      ...(diagnosticsSummary === undefined ? {} : { diagnosticsSummary }),
      diagnostics: [...snapshot.diagnostics, ...queuedBuiltIn.diagnostics],
    });
  }

  if (queuedBuiltIn !== null && queuedBuiltIn.resourceSet !== null) {
    return renderQueuedBuiltInWebGpuAppFrame({
      app,
      cache: resourceCache,
      snapshot,
      resourceSet: queuedBuiltIn.resourceSet,
      reuse,
      ...(options.clearColor === undefined
        ? {}
        : { clearColor: options.clearColor }),
      ...(options.label === undefined ? {} : { label: options.label }),
      ...(options.readbackSamples === undefined
        ? {}
        : { readbackSamples: options.readbackSamples }),
      ...(options.standardMaterialShadowReceiverResources === undefined
        ? {}
        : {
            standardMaterialShadowReceiverResources:
              options.standardMaterialShadowReceiverResources,
          }),
      ...(options.standardMaterialIblResources === undefined
        ? {}
        : {
            standardMaterialIblResources: options.standardMaterialIblResources,
          }),
    });
  }

  const materialKind =
    multiUnlit === null && firstMaterialKindSupported ? material.kind : "unlit";
  const pipeline = await getOrCreateWebGpuAppPipeline({
    app,
    cache: resourceCache,
    reuse,
    kind: materialKind,
    pipelineKey: firstDraw.batchKey.pipelineKey,
    batchKey: firstDraw.batchKey,
  });

  if (!pipeline.valid || pipeline.resource === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: pipeline.diagnostics,
    });
  }

  const pipelineHandle = pipeline.resource.pipeline as {
    getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipelineHandle.getBindGroupLayout === undefined) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.missingPipelineLayouts",
          message:
            "The WebGPU app pipeline does not expose bind group layouts.",
        },
      ],
    });
  }

  const getBindGroupLayout =
    pipelineHandle.getBindGroupLayout.bind(pipelineHandle);
  const layouts = getWebGpuAppPipelineLayouts({
    cache: resourceCache,
    kind: materialKind,
    pipeline,
    getBindGroupLayout,
  });
  const packedViews = writePackedSnapshotViewUniforms(
    snapshot,
    resourceCache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    snapshot,
    resourceCache.frameScratch.worldTransforms,
  );
  const meshKey = sourceAssetCacheKey(firstDraw.mesh, meshEntry?.version ?? -1);
  const materialKey = sourceAssetCacheKey(
    firstDraw.material,
    materialEntry?.version ?? -1,
  );
  const singleBuiltInItem =
    multiUnlit === null
      ? createSingleQueuedBuiltInAppResourceItem({
          adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
          draw: firstDraw,
          drawIndex: 0,
          mesh,
          meshKey,
          material,
          materialKey,
          materialVersion: materialEntry?.version ?? -1,
          frame: snapshot.frame,
        })
      : null;

  if (multiUnlit === null && singleBuiltInItem === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialKind",
          message: `WebGPU app render supports unlit, matcap, standard, and debug-normal materials, not '${material.kind}'.`,
        },
      ],
    });
  }

  const preparedTextures =
    singleBuiltInItem === null
      ? emptyPreparedAppTextureSamplerResources()
      : singleBuiltInItem.adapter.prepareTextureSamplerResources({
          app,
          cache: resourceCache,
          item: singleBuiltInItem,
          reuse,
        });

  if (!preparedTextures.valid) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...preparedTextures.diagnostics,
      ],
    });
  }

  let resources: WebGpuAppFrameResourcesResult;

  if (multiUnlit !== null) {
    resources = createMultiUnlitAppFrameResources({
      app,
      mesh: multiUnlit.mesh,
      materials: multiUnlit.materials,
      viewUniforms: packedViews,
      worldTransforms: packedTransforms,
      layouts,
      reuse,
    });
  } else {
    const item = singleBuiltInItem;

    if (item === null) {
      return renderReport({
        ok: false,
        snapshot,
        pipeline,
        resourceReuse: reuse,
        diagnostics: [
          {
            code: "webGpuApp.unsupportedMaterialKind",
            message: `WebGPU app render supports unlit, matcap, standard, and debug-normal materials, not '${material.kind}'.`,
          },
        ],
      });
    }

    const textureSamplerDependencies =
      createPreparedMaterialTextureSamplerDependencies(preparedTextures);

    resources = item.adapter.createFrameResources({
      app,
      cache: resourceCache,
      preparedMaterials: resourceCache.preparedMaterials,
      snapshot,
      item,
      textureSamplerDependencies,
      viewUniforms: packedViews,
      worldTransforms: packedTransforms,
      layouts,
      ...(options.standardMaterialShadowReceiverResources === undefined
        ? {}
        : {
            standardMaterialShadowReceiverResources:
              options.standardMaterialShadowReceiverResources,
          }),
      ...(options.standardMaterialIblResources === undefined
        ? {}
        : {
            standardMaterialIblResources: options.standardMaterialIblResources,
          }),
      reuse,
    });
  }

  if (!resources.valid || resources.resources === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resources,
      resourceReuse: reuse,
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...resources.diagnostics,
      ],
    });
  }

  const frameResources = resources.resources;
  const meshResourceKeys = new Map<string, string>();
  const materialResourceKeys = new Map<string, string>();

  meshResourceKeys.set(
    assetHandleKey(firstDraw.mesh),
    frameResources.mesh.resourceKey,
  );

  if ("materials" in frameResources && multiUnlit !== null) {
    for (let index = 0; index < multiUnlit.materialKeys.length; index += 1) {
      const materialResource = frameResources.materials[index];
      const materialHandleKey = multiUnlit.materialKeys[index];

      if (materialResource !== undefined && materialHandleKey !== undefined) {
        materialResourceKeys.set(
          materialHandleKey,
          materialResource.resourceKey,
        );
      }
    }
  } else if ("material" in frameResources) {
    materialResourceKeys.set(
      assetHandleKey(firstDraw.material),
      frameResources.material.resourceKey,
    );
  }

  const pipelineResult = {
    ok: true as const,
    status: "miss" as const,
    key: firstDraw.batchKey.pipelineKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot,
    renderWorld: app.renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
    resolveMaterialResourceKey: (draw) =>
      materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
    meshResources: [frameResources.mesh],
    pipelines: [pipelineResult],
    bindGroups: frameResources.bindGroups,
    scratch: resourceCache.frameScratch.framePlan,
  });
  const depthAttachment = createWebGpuAppDepthAttachment(app, resourceCache);
  const boundary = assembleFrameBoundary({
    context: app.initialization.context as Parameters<
      typeof assembleFrameBoundary
    >[0]["context"],
    device: app.initialization.device as Parameters<
      typeof assembleFrameBoundary
    >[0]["device"],
    queue: (app.initialization.device as { readonly queue: unknown })
      .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
    commands: framePlan.commandPlan.commands,
    label: options.label ?? "aperture-webgpu-app",
    clearColor: options.clearColor ?? [0, 0, 0, 1],
    depthTarget: {
      view: depthAttachment.view,
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
    ...(options.readbackSamples === undefined
      ? {}
      : {
          readback: {
            format: app.initialization.format,
            ...webGpuAppCanvasDimensions(app.canvas),
            samples: options.readbackSamples,
          },
        }),
  });

  await waitForSubmittedWork(app.initialization.device);
  const frameOk =
    framePlan.apply.diagnostics.length === 0 &&
    framePlan.bindingPlan.diagnostics.length === 0 &&
    framePlan.packages.diagnostics.length === 0 &&
    framePlan.drawCommands.diagnostics.length === 0 &&
    framePlan.drawList.valid &&
    framePlan.resources.valid &&
    framePlan.commandPlan.valid &&
    boundary.valid;
  const readback = await mapFrameBoundaryReadbackSamples(
    boundary.readback,
    frameOk,
  );

  return renderReport({
    ok: frameOk,
    snapshot,
    pipeline,
    resources,
    boundary,
    depthAttachment: createWebGpuAppDepthAttachmentReport(
      snapshot,
      depthAttachment,
    ),
    ...(readback === undefined ? {} : { readback }),
    resourceReuse: reuse,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: framePlan.commandPlan.commands.length,
    drawCalls: framePlan.commandPlan.drawCount,
    diagnostics: [
      ...snapshot.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...boundary.texture.diagnostics,
      ...(boundary.attachments?.diagnostics ?? []),
      ...(boundary.encoder?.diagnostics ?? []),
      ...(boundary.begin?.diagnostics ?? []),
      ...(boundary.execution?.diagnostics ?? []),
      ...(boundary.end?.diagnostics ?? []),
      ...(boundary.finish?.diagnostics ?? []),
      ...(boundary.submit?.diagnostics ?? []),
    ],
  });
}

function hasReadyStandardShadowReceiverResources(
  resources: StandardFrameShadowReceiverResources | undefined,
): resources is StandardFrameShadowReceiverResources {
  return (
    resources !== undefined &&
    resources.matrixBufferResource.resource !== null &&
    resources.depthTextureResources.resources.some(
      (resource) => resource.allocation.resource !== null,
    ) &&
    resources.samplerResource.resource !== null
  );
}

function hasReadyStandardDiffuseIblResources(
  resources: StandardFrameIblResources | undefined,
): resources is StandardFrameIblResources {
  return (
    resources !== undefined &&
    resources.bindGroupResource.status === "available" &&
    resources.bindGroupResource.resource !== null &&
    resources.diffuseTextureResource?.resources.some(
      (resource) => resource.valid && resource.resource !== null,
    ) === true &&
    resources.samplerResource?.resources.some(
      (resource) => resource.valid && resource.resource !== null,
    ) === true
  );
}

function hasReadyStandardSpecularIblProofResources(
  resources: StandardFrameIblResources | undefined,
): boolean {
  return (
    hasReadyStandardDiffuseIblResources(resources) &&
    resources.specularTextureResource?.resources.some(
      (resource) => resource.valid && resource.resource !== null,
    ) === true &&
    resources.specularTextureResource.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "iblTextureResource.specularProofUploadPlaceholder",
    )
  );
}

function withStandardShadowPipelineKeys(
  snapshot: RenderSnapshot,
): RenderSnapshot {
  let changed = false;
  const meshDraws = snapshot.meshDraws.map((draw) => {
    const pipelineKey = draw.batchKey.pipelineKey;

    if (
      !pipelineKey.startsWith("standard|") ||
      pipelineKey.includes("|shadowMap|")
    ) {
      return draw;
    }

    changed = true;
    const shadowPipelineKey = pipelineKey.replace(
      /^standard\|/,
      "standard|shadowMap|",
    );

    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey: shadowPipelineKey },
      sortKey: { ...draw.sortKey, pipelineKey: shadowPipelineKey },
    };
  });

  return changed ? { ...snapshot, meshDraws } : snapshot;
}

function withStandardIblPipelineKeys(
  snapshot: RenderSnapshot,
  includeSpecularProof: boolean,
): RenderSnapshot {
  let changed = false;
  const meshDraws = snapshot.meshDraws.map((draw) => {
    const pipelineKey = draw.batchKey.pipelineKey;

    if (
      !pipelineKey.startsWith("standard|") ||
      pipelineKey.includes("|iblDiffuse|")
    ) {
      return draw;
    }

    changed = true;
    const iblPipelineKey = pipelineKey.replace(
      /^standard\|/,
      includeSpecularProof
        ? "standard|iblDiffuse|iblSpecularProof|"
        : "standard|iblDiffuse|",
    );

    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey: iblPipelineKey },
      sortKey: { ...draw.sortKey, pipelineKey: iblPipelineKey },
    };
  });

  return changed ? { ...snapshot, meshDraws } : snapshot;
}

export function createWebGpuAppDrawResourceSetPlan(
  snapshot: RenderSnapshot,
): WebGpuAppDrawResourceSetPlan {
  const mutableSets: {
    readonly index: number;
    readonly meshKey: string;
    readonly materialKey: string;
    readonly drawIndices: number[];
    readonly renderIds: number[];
  }[] = [];
  const setByKey = new Map<string, (typeof mutableSets)[number]>();

  for (
    let drawIndex = 0;
    drawIndex < snapshot.meshDraws.length;
    drawIndex += 1
  ) {
    const draw = snapshot.meshDraws[drawIndex];

    if (draw === undefined) {
      continue;
    }

    const meshKey = assetHandleKey(draw.mesh);
    const materialKey = assetHandleKey(draw.material);
    const setKey = `${meshKey}|${materialKey}`;
    let set = setByKey.get(setKey);

    if (set === undefined) {
      set = {
        index: mutableSets.length,
        meshKey,
        materialKey,
        drawIndices: [],
        renderIds: [],
      };
      mutableSets.push(set);
      setByKey.set(setKey, set);
    }

    set.drawIndices.push(drawIndex);
    set.renderIds.push(draw.renderId);
  }

  return {
    drawCount: snapshot.meshDraws.length,
    sets: mutableSets.map((set) => ({
      index: set.index,
      meshKey: set.meshKey,
      materialKey: set.materialKey,
      drawIndices: [...set.drawIndices],
      renderIds: [...set.renderIds],
    })),
  };
}

function diagnoseSnapshotMaterialDependencies(
  app: WebGpuApp,
  snapshot: RenderSnapshot,
): WebGpuAppMaterialDependencyDiagnostic[] {
  const blockedEntities = new Set(
    snapshot.diagnostics
      .filter((diagnostic) => isMaterialDependencyRenderDiagnostic(diagnostic))
      .map((diagnostic) => renderEntityRefKey(diagnostic.entity))
      .filter((key) => key !== null),
  );

  if (blockedEntities.size === 0) {
    return [];
  }

  const query = app.world.queryManager.registerQuery({ required: [Material] });
  const diagnostics: WebGpuAppMaterialDependencyDiagnostic[] = [];
  const seenMaterialKeys = new Set<string>();

  for (const entity of query.entities) {
    const entityKey = `${entity.index}:${entity.generation}`;

    if (!blockedEntities.has(entityKey)) {
      continue;
    }

    const material = parseAppMaterialHandle(
      entity.getValue(Material, "materialId") ?? "",
    );

    if (material === null) {
      continue;
    }

    const report = createMaterialDependencyReadinessReport({
      registry: app.assets,
      material,
    });

    if (report.ready || seenMaterialKeys.has(report.materialKey)) {
      continue;
    }

    seenMaterialKeys.add(report.materialKey);
    diagnostics.push(createWebGpuAppMaterialDependencyDiagnostic(report));
  }

  return diagnostics;
}

function createWebGpuAppMaterialDependencyDiagnostic(
  materialDependencyReadiness: Parameters<
    typeof materialDependencyReadinessReportToJsonValue
  >[0],
): WebGpuAppMaterialDependencyDiagnostic {
  const json = materialDependencyReadinessReportToJsonValue(
    materialDependencyReadiness,
  );

  return {
    code: "webGpuApp.materialDependenciesNotReady",
    materialDependencyReadiness: json,
    message: `Material '${json.materialKey}' has source asset dependencies that are not ready for app rendering.`,
  };
}

function isMaterialDependencyRenderDiagnostic(
  diagnostic: unknown,
): diagnostic is {
  readonly code: string;
  readonly entity?: { readonly index: number; readonly generation: number };
} {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return false;
  }

  const code = (diagnostic as { readonly code?: unknown }).code;

  return (
    typeof code === "string" &&
    (code === "render.material.missingTextureHandle" ||
      code === "render.material.missingSamplerHandle" ||
      code.startsWith("render.standardMaterialTexture.") ||
      code.startsWith("render.texture.") ||
      code.startsWith("render.sampler."))
  );
}

function renderEntityRefKey(
  entity: { readonly index: number; readonly generation: number } | undefined,
): string | null {
  return entity === undefined ? null : `${entity.index}:${entity.generation}`;
}

function parseAppMaterialHandle(value: string) {
  const prefix = "material:";

  return value.startsWith(prefix) && value.length > prefix.length
    ? createMaterialHandle(value.slice(prefix.length))
    : null;
}

export function webGpuAppRenderReportToJsonValue(
  report: WebGpuAppRenderReport,
): WebGpuAppRenderReportJsonValue {
  const materialDependencyReadiness =
    collectWebGpuAppMaterialDependencyReadiness(report.diagnostics);

  return {
    ok: report.ok,
    frame: report.frame,
    counts: { ...report.counts },
    diagnostics: report.diagnostics.map((diagnostic) =>
      toWebGpuAppJsonValue(diagnostic),
    ),
    ...(report.diagnosticsSummary === undefined
      ? {}
      : { diagnosticsSummary: report.diagnosticsSummary }),
    resourceReuse: { ...report.resourceReuse },
    ...(report.depthAttachment === undefined
      ? {}
      : { depthAttachment: report.depthAttachment }),
    ...(report.readback === undefined
      ? {}
      : { readback: toWebGpuAppJsonValue(report.readback) }),
    ...(materialDependencyReadiness.length === 0
      ? {}
      : { materialDependencyReadiness }),
  };
}

export function webGpuAppRenderReportToJson(
  report: WebGpuAppRenderReport,
): string {
  return JSON.stringify(webGpuAppRenderReportToJsonValue(report));
}

function toWebGpuAppJsonValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): WebGpuAppJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toWebGpuAppJsonValue(entry, seen));
  }

  if (typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  const result: Record<string, WebGpuAppJsonValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (
      entry === undefined ||
      typeof entry === "function" ||
      typeof entry === "symbol" ||
      typeof entry === "bigint"
    ) {
      continue;
    }

    result[key] = toWebGpuAppJsonValue(entry, seen);
  }

  return result;
}

function renderReport(input: {
  readonly ok: boolean;
  readonly snapshot: RenderSnapshot;
  readonly diagnostics: readonly unknown[];
  readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
  readonly resourceReuse?: WebGpuAppResourceReuseReport;
  readonly pipeline?: WebGpuAppPipelineResourceResult | null;
  readonly resources?: WebGpuAppFrameResourcesResult | null;
  readonly boundary?: FrameBoundaryAssemblyReport | null;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readback?: FrameBoundaryReadbackResult;
  readonly drawPackages?: number;
  readonly drawCommands?: number;
  readonly drawCalls?: number;
}): WebGpuAppRenderReport {
  return {
    ok: input.ok,
    frame: input.snapshot.frame,
    snapshot: input.snapshot,
    counts: {
      views: input.snapshot.views.length,
      meshDraws: input.snapshot.meshDraws.length,
      drawPackages: input.drawPackages ?? 0,
      drawCommands: input.drawCommands ?? 0,
      drawCalls: input.drawCalls ?? 0,
      diagnostics: input.diagnostics.length,
    },
    diagnostics: input.diagnostics,
    ...(input.diagnosticsSummary === undefined
      ? {}
      : { diagnosticsSummary: input.diagnosticsSummary }),
    resourceReuse: input.resourceReuse ?? createWebGpuAppResourceReuseReport(),
    pipeline: input.pipeline ?? null,
    resources: input.resources ?? null,
    boundary: input.boundary ?? null,
    ...(input.depthAttachment === undefined
      ? {}
      : { depthAttachment: input.depthAttachment }),
    ...(input.readback === undefined ? {} : { readback: input.readback }),
  };
}

function createWebGpuAppDepthAttachment(
  app: WebGpuApp,
  resourceCache: WebGpuAppResourceCache,
): CachedWebGpuDepthTextureResource {
  return createOrReuseWebGpuDepthTexture({
    device: app.initialization.device as Parameters<
      typeof createOrReuseWebGpuDepthTexture
    >[0]["device"],
    cache: resourceCache.depth,
    ...webGpuAppCanvasDimensions(app.canvas),
    format: WEBGPU_APP_DEPTH_FORMAT,
  }).resource;
}

function createWebGpuAppDepthAttachmentReport(
  snapshot: RenderSnapshot,
  resource: CachedWebGpuDepthTextureResource,
): WebGpuAppDepthAttachmentReport {
  return {
    format: resource.format,
    attached: true,
    width: resource.width,
    height: resource.height,
    opaquePipelineDepthWriteCount: countOpaqueDepthWritePipelineKeys(snapshot),
  };
}

function countOpaqueDepthWritePipelineKeys(snapshot: RenderSnapshot): number {
  const pipelineKeys = new Set<string>();

  for (const draw of snapshot.meshDraws) {
    const tokens = parseMaterialPipelineRenderStateTokens(
      draw.batchKey.pipelineKey,
    );

    if ((tokens.alphaMode ?? "opaque") !== "blend") {
      pipelineKeys.add(draw.batchKey.pipelineKey);
    }
  }

  return pipelineKeys.size;
}

function webGpuAppCanvasDimensions(canvas: WebGpuCanvasLike): {
  readonly width: number;
  readonly height: number;
} {
  const dimensions = canvas as {
    readonly width?: unknown;
    readonly height?: unknown;
  };
  const width = typeof dimensions.width === "number" ? dimensions.width : 0;
  const height = typeof dimensions.height === "number" ? dimensions.height : 0;

  return { width, height };
}

function createWebGpuAppResourceReuseReport(): WebGpuAppResourceReuseReport {
  return {
    pipelineHits: 0,
    pipelineMisses: 0,
    meshBuffersCreated: 0,
    meshBuffersReused: 0,
    preparedMeshBuffersCreated: 0,
    preparedMeshBuffersReused: 0,
    preparedMeshCache: createPreparedMeshGpuResourceCacheSummary(),
    preparedMeshFacade: preparedMeshStoreSummaryToJsonValue(
      createPreparedMeshStore(),
    ),
    materialBuffersCreated: 0,
    materialBuffersReused: 0,
    preparedMaterialBuffersCreated: 0,
    preparedMaterialBuffersReused: 0,
    preparedMaterialBindGroupsCreated: 0,
    preparedMaterialBindGroupsReused: 0,
    preparedMaterialCache: createPreparedAppMaterialCacheSummary(),
    preparedMaterialFacade: preparedMaterialStoreSummaryToJsonValue(
      createPreparedMaterialStore(),
    ),
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    textureSamplerCache: createAppTextureSamplerResourceCacheSummary(),
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
    bindGroupsCreated: 0,
    bindGroupsReused: 0,
    lightBuffersCreated: 0,
    lightBuffersReused: 0,
    dynamicBufferWrites: 0,
  };
}

function writeWebGpuAppPreparedMaterialCacheSummary(
  summary: PreparedAppMaterialCacheSummary,
  cache: WebGpuAppResourceCache,
): PreparedAppMaterialCacheSummary {
  return writePreparedBuiltInMaterialStoreSummary(
    summary,
    cache.preparedMaterials,
  );
}

function writeWebGpuAppPreparedMeshCacheSummary(
  summary: PreparedMeshGpuResourceCacheSummary,
  cache: WebGpuAppResourceCache,
): PreparedMeshGpuResourceCacheSummary {
  return writePreparedMeshGpuResourceCacheSummary(
    summary,
    cache.preparedMeshes,
  );
}

function writeWebGpuAppTextureSamplerCacheSummary(
  summary: AppTextureSamplerResourceCacheSummary,
  cache: WebGpuAppResourceCache,
): AppTextureSamplerResourceCacheSummary {
  return writeAppTextureSamplerResourceCacheSummary(summary, cache);
}

async function waitForSubmittedWork(device: unknown): Promise<void> {
  const queue = (
    device as { readonly queue?: { onSubmittedWorkDone?: () => Promise<void> } }
  ).queue;

  if (typeof queue?.onSubmittedWorkDone === "function") {
    await queue.onSubmittedWorkDone();
  }
}
