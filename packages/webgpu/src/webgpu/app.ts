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
  createPreparedMeshStore,
  createPreparedMeshQueueResourceKeyResolver,
  createPreparedMaterialStore,
  createPreparedMaterialQueueResourceKeyResolver,
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
  type MaterialQueueItem,
  type MaterialQueueScratch,
  type MaterialAssetDependencyReadinessReportJsonValue,
  type MatcapMaterialAsset,
  type MaterialAsset,
  type MeshDrawPacket,
  type MeshAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotTransformsScratch,
  type PackedSnapshotViewUniforms,
  type PackedSnapshotViewUniformsScratch,
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
  type FrameBoundaryAssemblyReport,
} from "./frame-boundary.js";
import { createLightBindGroupLayoutDescriptor } from "./light-bind-group-layout.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import { type MatcapFrameGpuResources } from "./matcap-frame-resources.js";
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
import type { BuiltInMaterialAsset } from "./built-in-material-queue-adapter.js";
import {
  appendQueuedBuiltInFrameResourceViaAdapter,
  createQueuedBuiltInAppResourceAdapterRegistry,
  createQueuedBuiltInAppResourceFamilyAdapterTable,
  type QueuedBuiltInAppResourceAdapter,
} from "./built-in-material-app-resource-adapter.js";
import {
  createWebGpuAppMaterialQueueRouteReportShell,
  webGpuAppMaterialQueueRouteReportShellToJsonValue,
  writeWebGpuAppMaterialQueueRouteReportShell,
  type WebGpuAppMaterialQueueRouteDiagnostic,
  type WebGpuAppMaterialQueueRouteDiagnosticSeverity,
  type WebGpuAppMaterialQueueRouteQueueItem,
  type WebGpuAppMaterialQueueRouteReportJsonValue,
  type WebGpuAppMaterialQueueRouteReportShell,
  type WebGpuAppMaterialQueueRouteRoutedItem,
} from "./material-queue-route-report.js";
import { createStandardMaterialBindGroupLayoutPlan } from "./standard-bind-group-layout.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";
import { type StandardFrameGpuResources } from "./standard-frame-resources.js";
import {
  createOrReuseStandardAppFrameResources,
  type CachedStandardAppFrameResources,
  type CreateStandardAppFrameResourcesResult,
  type StandardAppFrameResourceCacheSlot,
} from "./standard-app-frame-resources.js";
import {
  createStandardRenderPipelineResource,
  type CreateStandardRenderPipelineResourceResult,
} from "./standard-pipeline.js";
import {
  createMultiMaterialUnlitFrameGpuResources,
  type CreateMultiMaterialUnlitFrameGpuResourcesResult,
  type UnlitFrameGpuResources,
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
import {
  appendPipelineScopedBindGroups,
  createPipelineScopedBindGroupScratch,
  resetPipelineScopedBindGroupScratch,
  type PipelineScopedBindGroupScratch,
} from "./pipeline-scoped-bind-groups.js";
import {
  createReusableRouteCollector,
  resetReusableRouteCollector,
  type ReusableRouteCollector,
} from "./reusable-route-collector.js";
import {
  createQueuedMaterialFrameResourceRouteShell,
  type QueuedMaterialFrameResourceResultLike,
  type QueuedMaterialFrameResourceRouteShell,
} from "./queued-material-frame-resource-route.js";
import {
  createQueuedMaterialPrepareRouteResult,
  routeQueuedMaterialPrepare,
  type QueuedMaterialPrepareRouteResult,
} from "./queued-material-prepare-route.js";
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
}

export interface WebGpuAppRenderCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly drawPackages: number;
  readonly drawCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: number;
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

export interface WebGpuAppUnsupportedMaterialQueueDiagnostic {
  readonly code:
    | "webGpuApp.unsupportedMaterialQueueFamily"
    | "webGpuApp.unsupportedMaterialQueuePhase"
    | "webGpuApp.unsupportedMaterialQueueAlphaTestFamily"
    | "webGpuApp.unsupportedMaterialQueueTransparentFamily"
    | "webGpuApp.unsupportedMaterialQueueBlendPreset"
    | "webGpuApp.materialQueueAssetMismatch";
  readonly message: string;
  readonly renderId: number;
  readonly drawIndex: number;
  readonly materialFamily?: string;
  readonly materialKind?: string;
  readonly renderPhase?: string;
  readonly blendPreset?: string | null;
  readonly entity?: MeshDrawPacket["entity"];
}

export interface WebGpuAppMaterialQueueRouteReportDiagnostic {
  readonly code: "webGpuApp.materialQueueRouteReport";
  readonly message: string;
  readonly report: WebGpuAppMaterialQueueRouteReportJsonValue;
}

export interface WebGpuAppFrameResourceRouteDiagnostic {
  readonly code: "webGpuApp.frameResourceRoute";
  readonly message: string;
  readonly route: QueuedMaterialFrameResourceRouteShell;
}

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
  readonly resourceReuse: WebGpuAppResourceReuseReport;
  readonly pipeline: WebGpuAppPipelineResourceResult | null;
  readonly resources: WebGpuAppFrameResourcesResult | null;
  readonly boundary: FrameBoundaryAssemblyReport | null;
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
  readonly resourceReuse: WebGpuAppResourceReuseReport;
  readonly materialDependencyReadiness?: readonly MaterialAssetDependencyReadinessReportJsonValue[];
}

export type WebGpuAppPipelineResourceResult =
  | CreateUnlitRenderPipelineResourceResult
  | CreateMatcapRenderPipelineResourceResult
  | CreateStandardRenderPipelineResourceResult;

export type WebGpuAppFrameResourcesResult =
  | CreateUnlitAppFrameResourcesResult
  | CreateMultiMaterialUnlitFrameGpuResourcesResult
  | CreateMatcapAppFrameResourcesResult
  | CreateStandardAppFrameResourcesResult
  | CreateQueuedBuiltInFrameResourcesResult;

type WebGpuAppMaterialKind = BuiltInMaterialQueueFamily;

interface WebGpuAppResourceCache {
  readonly pipelines: Map<string, WebGpuAppPipelineResourceResult>;
  readonly layouts: Map<string, WebGpuAppPipelineLayouts>;
  readonly textures: Map<string, TextureGpuResource>;
  readonly samplers: Map<string, SamplerGpuResource>;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedMeshFacade: PreparedMeshStore;
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
  readonly preparedMaterialFacade: PreparedMaterialStore;
  readonly frameScratch: WebGpuAppFrameScratch;
  readonly unlitFrame: UnlitAppFrameResourceCacheSlot;
  readonly matcapFrame: MatcapAppFrameResourceCacheSlot;
  readonly standardFrame: StandardAppFrameResourceCacheSlot;
}

interface WebGpuAppFrameScratch {
  readonly viewUniforms: PackedSnapshotViewUniformsScratch;
  readonly worldTransforms: PackedSnapshotTransformsScratch;
  readonly framePlan: RenderFramePlanScratch;
  readonly materialQueue: MaterialQueueScratch;
  readonly queueRoute: QueuedBuiltInAppRouteScratch;
}

interface WebGpuAppPipelineLayouts {
  readonly kind: WebGpuAppMaterialKind;
  readonly pipelineResourceKey: string;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout:
    | MatcapMaterialBindGroupLayoutResource
    | StandardMaterialBindGroupLayoutResource
    | null;
  readonly lightLayout: LightBindGroupLayoutResource | null;
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

interface QueuedBuiltInAppResourceItem {
  readonly queueItem: MaterialQueueItem;
  readonly prepareRoute: QueuedMaterialPrepareRouteResult;
  readonly adapter: QueuedBuiltInMaterialAdapter;
  readonly draw: MeshDrawPacket;
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly sourceMeshKey: string;
  readonly material: BuiltInMaterialAsset;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
}

interface QueuedBuiltInAppResourceSet {
  readonly items: readonly QueuedBuiltInAppResourceItem[];
}

interface QueuedSourceMeshAsset {
  readonly asset: MeshAsset;
  readonly resourceKey: string;
}

interface QueuedSourceMaterialAsset {
  readonly asset: MaterialAsset;
  readonly kind: string;
  readonly resourceKey: string;
  readonly sourceVersion: number;
}

interface WebGpuAppPipelinePlanResult {
  readonly ok: true;
  readonly status: "miss";
  readonly key: string;
  readonly pipeline: unknown;
  readonly diagnostics: readonly [];
}

interface QueuedBuiltInAppRouteScratch {
  readonly sourceMeshAssets: Map<string, QueuedSourceMeshAsset>;
  readonly sourceMaterialAssets: Map<string, QueuedSourceMaterialAsset>;
  readonly pipelineResults: Map<string, WebGpuAppPipelinePlanResult>;
  readonly pipelineResultList: WebGpuAppPipelinePlanResult[];
  readonly meshResources: Map<string, UnlitFrameGpuResources["mesh"]>;
  readonly meshResourceList: UnlitFrameGpuResources["mesh"][];
  readonly meshResourceKeys: Map<string, string>;
  readonly materialResourceKeys: Map<string, string>;
  readonly bindGroups: UnlitFrameGpuResources["bindGroups"][number][];
  readonly pipelineScopedBindGroups: PipelineScopedBindGroupScratch;
  readonly unlit: UnlitFrameGpuResources[];
  readonly matcap: MatcapFrameGpuResources[];
  readonly standard: StandardFrameGpuResources[];
  readonly routeCollector: ReusableRouteCollector<
    QueuedBuiltInAppResourceItem,
    unknown
  >;
  readonly routeReport: WebGpuAppMaterialQueueRouteReportShell;
}

interface QueuedBuiltInFrameResources {
  readonly mesh: UnlitFrameGpuResources["mesh"];
  readonly viewUniform: UnlitFrameGpuResources["viewUniform"];
  readonly worldTransforms: UnlitFrameGpuResources["worldTransforms"];
  readonly meshResources: readonly UnlitFrameGpuResources["mesh"][];
  readonly unlit: readonly UnlitFrameGpuResources[];
  readonly matcap: readonly MatcapFrameGpuResources[];
  readonly standard: readonly StandardFrameGpuResources[];
  readonly bindGroups: readonly UnlitFrameGpuResources["bindGroups"][number][];
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
  readonly reuse: WebGpuAppResourceReuseReport;
}

type QueuedBuiltInAppResourcePreparationCache = Omit<
  WebGpuAppResourceCache,
  "preparedMaterials"
>;

type QueuedBuiltInMaterialAdapter = QueuedBuiltInAppResourceAdapter<
  QueuedBuiltInTextureSamplerPreparationOptions,
  QueuedBuiltInFrameResourcePreparationOptions
>;

interface CreateQueuedBuiltInFrameResourcesResult {
  readonly valid: boolean;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly diagnostics: readonly unknown[];
}

export interface WebGpuApp {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
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

  return { ok: true, app, initialization };
}

function createWebGpuAppResourceCache(): WebGpuAppResourceCache {
  return {
    pipelines: new Map(),
    layouts: new Map(),
    textures: new Map(),
    samplers: new Map(),
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
    queueRoute: createQueuedBuiltInAppRouteScratch(),
  };
}

function createQueuedBuiltInAppRouteScratch(): QueuedBuiltInAppRouteScratch {
  return {
    sourceMeshAssets: new Map(),
    sourceMaterialAssets: new Map(),
    pipelineResults: new Map(),
    pipelineResultList: [],
    meshResources: new Map(),
    meshResourceList: [],
    meshResourceKeys: new Map(),
    materialResourceKeys: new Map(),
    bindGroups: [],
    pipelineScopedBindGroups: createPipelineScopedBindGroupScratch(),
    unlit: [],
    matcap: [],
    standard: [],
    routeCollector: createReusableRouteCollector<
      QueuedBuiltInAppResourceItem,
      unknown
    >(),
    routeReport: createWebGpuAppMaterialQueueRouteReportShell(),
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
          batchKey: options.batchKey,
        })
      : options.kind === "matcap"
        ? await createMatcapRenderPipelineResource({
            device: options.app.initialization.device as Parameters<
              typeof createMatcapRenderPipelineResource
            >[0]["device"],
            colorFormat: options.app.initialization.format,
            batchKey: options.batchKey,
          })
        : await createUnlitRenderPipelineResource({
            device: options.app.initialization.device as Parameters<
              typeof createUnlitRenderPipelineResource
            >[0]["device"],
            colorFormat: options.app.initialization.format,
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
      layoutKey: "webgpu-app/standard/group-3",
      layout: getBindGroupLayout(3),
      descriptor: createLightBindGroupLayoutDescriptor({
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

function createSingleBuiltInAppResourceItem(options: {
  readonly draw: MeshDrawPacket;
  readonly drawIndex: number;
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly material: MaterialAsset;
  readonly materialKey: string;
  readonly materialVersion: number;
  readonly frame: number;
}): QueuedBuiltInAppResourceItem | null {
  const adapter = QUEUED_BUILT_IN_MATERIAL_ADAPTERS.get(options.material.kind);

  if (adapter === null || !adapter.isMaterialAsset(options.material)) {
    return null;
  }

  const sourceMeshKey = assetHandleKey(options.draw.mesh);
  const sourceMaterialKey = assetHandleKey(options.draw.material);
  const queueItem: MaterialQueueItem = {
    renderId: options.draw.renderId,
    drawIndex: options.drawIndex,
    entity: options.draw.entity,
    renderPhase: options.draw.sortKey.queue,
    materialFamily: adapter.kind,
    pipelineKey: options.draw.batchKey.pipelineKey,
    meshKey: sourceMeshKey,
    materialKey: sourceMaterialKey,
    meshResourceKey: options.meshKey,
    materialResourceKey: options.materialKey,
    meshLayoutKey: options.draw.batchKey.meshLayoutKey,
    topology: options.draw.batchKey.topology,
    depth: options.draw.sortKey.depth,
    sortKey: {
      renderPhase: options.draw.sortKey.queue,
      viewId: options.draw.sortKey.viewId,
      layer: options.draw.sortKey.layer,
      order: options.draw.sortKey.order,
      pipelineKey: options.draw.batchKey.pipelineKey,
      materialResourceKey: options.materialKey,
      meshResourceKey: options.meshKey,
      depth: options.draw.sortKey.depth,
      stableId: options.draw.sortKey.stableId,
      drawIndex: options.drawIndex,
    },
  };

  return {
    queueItem,
    prepareRoute: createQueuedMaterialPrepareRouteResult({
      queueItem,
      material: options.material as BuiltInMaterialAsset,
      sourceVersion: options.materialVersion,
      frame: options.frame,
    }),
    adapter,
    draw: options.draw,
    mesh: options.mesh,
    meshKey: options.meshKey,
    sourceMeshKey,
    material: options.material,
    materialKey: options.materialKey,
    sourceMaterialKey,
  };
}

function collectQueuedBuiltInAppResourceSet(options: {
  readonly app: WebGpuApp;
  readonly snapshot: RenderSnapshot;
  readonly frameScratch: WebGpuAppFrameScratch;
  readonly meshes: PreparedMeshStore;
  readonly materials: PreparedMaterialStore;
}): {
  readonly valid: boolean;
  readonly resourceSet: QueuedBuiltInAppResourceSet | null;
  readonly diagnostics: readonly unknown[];
} {
  const meshAssets = options.frameScratch.queueRoute.sourceMeshAssets;
  const materialAssets = options.frameScratch.queueRoute.sourceMaterialAssets;
  const routeCollector = resetReusableRouteCollector(
    options.frameScratch.queueRoute.routeCollector,
  );
  const resolvePreparedMeshResourceKey =
    createPreparedMeshQueueResourceKeyResolver(options.meshes);
  const resolvePreparedMaterialResourceKey =
    createPreparedMaterialQueueResourceKeyResolver(options.materials);

  indexQueuedSourceAssets(options.app, options.snapshot, {
    meshAssets,
    materialAssets,
  });

  const queue = writeMaterialQueueFromSnapshot(
    { meshDraws: options.snapshot.meshDraws, diagnostics: [] },
    {
      meshResourceKey: resolvePreparedMeshResourceKey,
      materialResourceKey: resolvePreparedMaterialResourceKey,
    },
    options.frameScratch.materialQueue,
  );
  const diagnostics = routeCollector.diagnostics;
  const items = routeCollector.items;

  diagnostics.push(...queue.diagnostics);

  for (const queueItem of queue.items) {
    const draw = options.snapshot.meshDraws[queueItem.drawIndex];

    if (draw === undefined) {
      continue;
    }

    const mesh = meshAssets.get(queueItem.meshKey);
    const material = materialAssets.get(queueItem.materialKey);

    if (mesh === undefined || material === undefined) {
      continue;
    }

    const route = routeQueuedMaterialPrepare(
      QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
      {
        queueItem,
        material: material.asset,
        sourceVersion: material.sourceVersion,
        frame: options.snapshot.frame,
      },
    );

    if (!route.valid) {
      diagnostics.push(
        ...route.diagnostics.map((diagnostic) =>
          queuedPrepareRouteDiagnosticToAppDiagnostic(diagnostic, queueItem),
        ),
      );
      continue;
    }

    if (route.meshResourceKey === null || route.materialResourceKey === null) {
      continue;
    }

    const adapter = QUEUED_BUILT_IN_MATERIAL_ADAPTERS.get(
      queueItem.materialFamily,
    );

    if (adapter === null || !adapter.isMaterialAsset(material.asset)) {
      continue;
    }

    items.push({
      queueItem,
      prepareRoute: route,
      adapter,
      draw,
      mesh: mesh.asset,
      meshKey: mesh.resourceKey,
      sourceMeshKey: queueItem.meshKey,
      material: material.asset,
      materialKey: material.resourceKey,
      sourceMaterialKey: queueItem.materialKey,
    });
  }

  const valid = diagnostics.length === 0 && items.length === queue.items.length;

  if (!valid) {
    diagnostics.push(
      createWebGpuAppMaterialQueueRouteReportDiagnostic({
        queueItems: queue.items,
        routedItems: items,
        diagnostics,
        shell: options.frameScratch.queueRoute.routeReport,
      }),
    );
  }

  return {
    valid,
    resourceSet: valid ? routeCollector.resourceSet : null,
    diagnostics,
  };
}

function createWebGpuAppMaterialQueueRouteReportDiagnostic(input: {
  readonly queueItems: readonly MaterialQueueItem[];
  readonly routedItems: readonly QueuedBuiltInAppResourceItem[];
  readonly diagnostics: readonly unknown[];
  readonly shell: WebGpuAppMaterialQueueRouteReportShell;
}): WebGpuAppMaterialQueueRouteReportDiagnostic {
  writeWebGpuAppMaterialQueueRouteReportShell(
    {
      queueItems: input.queueItems.map(materialQueueItemToRouteQueueItem),
      routedItems: input.routedItems.map(resourceItemToRouteRoutedItem),
      diagnostics: input.diagnostics.flatMap(unknownToRouteDiagnostic),
    },
    input.shell,
  );

  return {
    code: "webGpuApp.materialQueueRouteReport",
    message: "WebGPU app material queue routing failed.",
    report: webGpuAppMaterialQueueRouteReportShellToJsonValue(input.shell),
  };
}

function createWebGpuAppFrameResourceRouteDiagnostic(
  route: QueuedMaterialFrameResourceRouteShell,
): WebGpuAppFrameResourceRouteDiagnostic {
  return {
    code: "webGpuApp.frameResourceRoute",
    message: `WebGPU app frame resource preparation failed for '${route.family}' material route.`,
    route,
  };
}

function createQueuedBuiltInFrameResourceRouteShell(input: {
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

function materialQueueItemToRouteQueueItem(
  item: MaterialQueueItem,
): WebGpuAppMaterialQueueRouteQueueItem {
  return {
    renderId: item.renderId,
    drawIndex: item.drawIndex,
    materialFamily: item.materialFamily,
    renderPhase: item.renderPhase,
    entity: item.entity,
  };
}

function resourceItemToRouteRoutedItem(
  item: QueuedBuiltInAppResourceItem,
): WebGpuAppMaterialQueueRouteRoutedItem {
  return {
    renderId: item.queueItem.renderId,
    drawIndex: item.queueItem.drawIndex,
    materialFamily: item.queueItem.materialFamily,
    renderPhase: item.queueItem.renderPhase,
  };
}

function queuedPrepareRouteDiagnosticToAppDiagnostic(
  diagnostic: unknown,
  queueItem: MaterialQueueItem,
): unknown {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return diagnostic;
  }

  const candidate = diagnostic as {
    readonly code?: unknown;
    readonly materialKind?: unknown;
  };

  if (candidate.code === "queuedMaterialPrepareRoute.missingAdapter") {
    return {
      code: "webGpuApp.unsupportedMaterialQueueFamily",
      renderId: queueItem.renderId,
      drawIndex: queueItem.drawIndex,
      materialFamily: queueItem.materialFamily,
      entity: queueItem.entity,
      message: `WebGPU app material queue routing supports unlit, matcap, and standard materials, not '${queueItem.materialFamily}'.`,
    } satisfies WebGpuAppUnsupportedMaterialQueueDiagnostic;
  }

  if (candidate.code === "queuedMaterialPrepareRoute.materialMismatch") {
    return {
      code: "webGpuApp.materialQueueAssetMismatch",
      renderId: queueItem.renderId,
      drawIndex: queueItem.drawIndex,
      materialFamily: queueItem.materialFamily,
      ...optionalString("materialKind", candidate.materialKind),
      entity: queueItem.entity,
      message: `Render object ${queueItem.renderId} pipeline family '${queueItem.materialFamily}' does not match material asset kind '${String(candidate.materialKind)}'.`,
    } satisfies WebGpuAppUnsupportedMaterialQueueDiagnostic;
  }

  return diagnostic;
}

function unknownToRouteDiagnostic(
  diagnostic: unknown,
): WebGpuAppMaterialQueueRouteDiagnostic[] {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return [];
  }

  const candidate = diagnostic as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly severity?: unknown;
    readonly renderId?: unknown;
    readonly drawIndex?: unknown;
    readonly materialFamily?: unknown;
    readonly materialKind?: unknown;
    readonly renderPhase?: unknown;
    readonly blendPreset?: unknown;
    readonly entity?: unknown;
  };

  if (typeof candidate.code !== "string") {
    return [];
  }

  return [
    {
      code: candidate.code,
      message: typeof candidate.message === "string" ? candidate.message : "",
      ...optionalRouteSeverity(candidate.severity),
      ...optionalNumber("renderId", candidate.renderId),
      ...optionalNumber("drawIndex", candidate.drawIndex),
      ...optionalString("materialFamily", candidate.materialFamily),
      ...optionalString("materialKind", candidate.materialKind),
      ...optionalString("renderPhase", candidate.renderPhase),
      ...optionalBlendPreset(candidate.blendPreset),
      ...optionalRouteEntity(candidate.entity),
    },
  ];
}

function optionalRouteSeverity(value: unknown): {
  readonly severity?: WebGpuAppMaterialQueueRouteDiagnosticSeverity;
} {
  return value === "info" || value === "warning" || value === "error"
    ? { severity: value }
    : {};
}

function optionalNumber<Key extends "renderId" | "drawIndex">(
  key: Key,
  value: unknown,
): { readonly [Property in Key]?: number } {
  return typeof value === "number" && Number.isFinite(value)
    ? ({ [key]: value } as { readonly [Property in Key]?: number })
    : {};
}

function optionalString<
  Key extends "materialFamily" | "materialKind" | "renderPhase",
>(key: Key, value: unknown): { readonly [Property in Key]?: string } {
  return typeof value === "string"
    ? ({ [key]: value } as { readonly [Property in Key]?: string })
    : {};
}

function optionalBlendPreset(value: unknown): {
  readonly blendPreset?: string | null;
} {
  return typeof value === "string" || value === null
    ? { blendPreset: value }
    : {};
}

function optionalRouteEntity(value: unknown): {
  readonly entity?: NonNullable<
    WebGpuAppMaterialQueueRouteDiagnostic["entity"]
  >;
} {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const entity = value as {
    readonly index?: unknown;
    readonly generation?: unknown;
  };

  return typeof entity.index === "number" &&
    Number.isFinite(entity.index) &&
    typeof entity.generation === "number" &&
    Number.isFinite(entity.generation)
    ? {
        entity: {
          index: entity.index,
          generation: entity.generation,
        },
      }
    : {};
}

function indexQueuedSourceAssets(
  app: WebGpuApp,
  snapshot: RenderSnapshot,
  output: {
    readonly meshAssets: Map<string, QueuedSourceMeshAsset>;
    readonly materialAssets: Map<string, QueuedSourceMaterialAsset>;
  },
): void {
  output.meshAssets.clear();
  output.materialAssets.clear();

  for (const draw of snapshot.meshDraws) {
    const meshKey = assetHandleKey(draw.mesh);

    if (!output.meshAssets.has(meshKey)) {
      const meshEntry = app.assets.get<"mesh", MeshAsset>(draw.mesh);

      if (
        meshEntry !== undefined &&
        meshEntry.status === "ready" &&
        meshEntry.asset !== null
      ) {
        output.meshAssets.set(meshKey, {
          asset: meshEntry.asset,
          resourceKey: sourceAssetCacheKey(draw.mesh, meshEntry.version),
        });
      }
    }

    const materialKey = assetHandleKey(draw.material);

    if (output.materialAssets.has(materialKey)) {
      continue;
    }

    const materialEntry = app.assets.get<"material", MaterialAsset>(
      draw.material,
    );
    const material = materialEntry?.asset ?? null;

    if (
      materialEntry === undefined ||
      materialEntry.status !== "ready" ||
      material === null
    ) {
      continue;
    }

    output.materialAssets.set(materialKey, {
      asset: material,
      kind: material.kind,
      resourceKey: sourceAssetCacheKey(draw.material, materialEntry.version),
      sourceVersion: materialEntry.version,
    });
  }
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
          preparedMeshes: options.cache.preparedMeshes,
          preparedScalarMaterials: options.preparedMaterials.standard,
          reuse: options.reuse,
        }),
    }),
  });

async function renderQueuedBuiltInWebGpuAppFrame(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly clearColor?: readonly number[];
  readonly label?: string;
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
  });

  if (!prepared.valid || prepared.resources === null) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      resourceReuse: options.reuse,
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
  });

  await waitForSubmittedWork(options.app.initialization.device);

  return renderReport({
    ok:
      framePlan.apply.diagnostics.length === 0 &&
      framePlan.bindingPlan.diagnostics.length === 0 &&
      framePlan.packages.diagnostics.length === 0 &&
      framePlan.drawCommands.diagnostics.length === 0 &&
      framePlan.drawList.valid &&
      framePlan.resources.valid &&
      framePlan.commandPlan.valid &&
      boundary.valid,
    snapshot: options.snapshot,
    pipeline: prepared.firstPipeline,
    resources: prepared.resourcesResult,
    boundary,
    resourceReuse: options.reuse,
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

async function prepareQueuedBuiltInFrameResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
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
  const scratch = options.cache.frameScratch.queueRoute;
  const diagnostics: unknown[] = [];
  const pipelineResults = scratch.pipelineResults;
  const pipelineResultList = scratch.pipelineResultList;
  const meshResources = scratch.meshResources;
  const meshResourceList = scratch.meshResourceList;
  const meshResourceKeys = scratch.meshResourceKeys;
  const materialResourceKeys = scratch.materialResourceKeys;
  const bindGroups = scratch.bindGroups;
  const scopedBindGroups = scratch.pipelineScopedBindGroups;
  const unlit = scratch.unlit;
  const matcap = scratch.matcap;
  const standard = scratch.standard;
  let firstPipeline: WebGpuAppPipelineResourceResult | null = null;
  let firstResources:
    | UnlitFrameGpuResources
    | MatcapFrameGpuResources
    | StandardFrameGpuResources
    | null = null;

  pipelineResults.clear();
  pipelineResultList.length = 0;
  meshResources.clear();
  meshResourceList.length = 0;
  meshResourceKeys.clear();
  materialResourceKeys.clear();
  bindGroups.length = 0;
  resetPipelineScopedBindGroupScratch(scopedBindGroups);
  unlit.length = 0;
  matcap.length = 0;
  standard.length = 0;

  for (const item of options.resourceSet.items) {
    const adapter = item.adapter;
    const pipeline = await getOrCreateWebGpuAppPipeline({
      app: options.app,
      cache: options.cache,
      reuse: options.reuse,
      kind: adapter.kind,
      pipelineKey: item.draw.batchKey.pipelineKey,
      batchKey: item.draw.batchKey,
    });

    firstPipeline ??= pipeline;

    if (!pipeline.valid || pipeline.resource === null) {
      diagnostics.push(...pipeline.diagnostics);
      continue;
    }

    const pipelineHandle = pipeline.resource.pipeline as {
      getBindGroupLayout?: (group: number) => unknown;
    };

    if (pipelineHandle.getBindGroupLayout === undefined) {
      diagnostics.push({
        code: "webGpuApp.missingPipelineLayouts",
        message: "The WebGPU app pipeline does not expose bind group layouts.",
      });
      continue;
    }

    if (!pipelineResults.has(item.draw.batchKey.pipelineKey)) {
      const pipelineResult = createWebGpuAppPipelinePlanResult(
        item.draw,
        pipeline,
      );

      pipelineResults.set(item.draw.batchKey.pipelineKey, pipelineResult);
      pipelineResultList.push(pipelineResult);
    }

    const layouts = getWebGpuAppPipelineLayouts({
      cache: options.cache,
      kind: adapter.kind,
      pipeline,
      getBindGroupLayout:
        pipelineHandle.getBindGroupLayout.bind(pipelineHandle),
    });
    const textureSamplerDependencies =
      prepareQueuedBuiltInTextureSamplerDependencies({
        adapter,
        app: options.app,
        cache: options.cache,
        item,
        reuse: options.reuse,
      });

    if (!textureSamplerDependencies.valid) {
      diagnostics.push(...textureSamplerDependencies.diagnostics);
      continue;
    }

    const resources = adapter.createFrameResources(
      createQueuedBuiltInFrameResourceOptions({
        app: options.app,
        cache: options.cache,
        snapshot: options.snapshot,
        item,
        textureSamplerDependencies,
        viewUniforms: options.viewUniforms,
        worldTransforms: options.worldTransforms,
        layouts,
        reuse: options.reuse,
      }),
    );
    const frameResourceRoute = createQueuedBuiltInFrameResourceRouteShell({
      item,
      resources: resources as {
        readonly valid: boolean;
        readonly diagnostics: readonly unknown[];
      },
    });

    if (!resources.valid || resources.resources === null) {
      diagnostics.push(...resources.diagnostics);
      diagnostics.push(
        createWebGpuAppFrameResourceRouteDiagnostic(frameResourceRoute),
      );
      continue;
    }

    firstResources ??= resources.resources;
    appendQueuedBuiltInFrameResourceViaAdapter({
      adapter,
      result: resources,
      buckets: {
        unlit,
        matcap,
        standard,
      },
    });

    if (!meshResources.has(resources.resources.mesh.resourceKey)) {
      meshResources.set(
        resources.resources.mesh.resourceKey,
        resources.resources.mesh,
      );
      meshResourceList.push(resources.resources.mesh);
    }
    meshResourceKeys.set(
      item.sourceMeshKey,
      resources.resources.mesh.resourceKey,
    );
    materialResourceKeys.set(
      item.sourceMaterialKey,
      resources.resources.material.resourceKey,
    );
    appendPipelineScopedBindGroups(
      resources.resources.bindGroups,
      item.draw.batchKey.pipelineKey,
      bindGroups,
      scopedBindGroups,
    );
  }

  const result: CreateQueuedBuiltInFrameResourcesResult = {
    valid:
      diagnostics.length === 0 &&
      meshResources.size > 0 &&
      materialResourceKeys.size > 0 &&
      firstResources !== null,
    resources:
      diagnostics.length === 0 &&
      meshResources.size > 0 &&
      materialResourceKeys.size > 0 &&
      firstResources !== null
        ? {
            mesh: firstResources.mesh,
            viewUniform: firstResources.viewUniform,
            worldTransforms: firstResources.worldTransforms,
            meshResources: meshResourceList,
            unlit,
            matcap,
            standard,
            bindGroups,
          }
        : null,
    diagnostics,
  };

  return {
    valid: result.valid,
    resources: result.resources,
    resourcesResult: result,
    diagnostics,
    pipelineResults: pipelineResultList,
    firstPipeline,
    meshResourceKeys,
    materialResourceKeys,
  };
}

function prepareQueuedBuiltInTextureSamplerDependencies(input: {
  readonly adapter: QueuedBuiltInMaterialAdapter;
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly reuse: WebGpuAppResourceReuseReport;
}): PreparedMaterialTextureSamplerDependencies {
  return createPreparedMaterialTextureSamplerDependencies(
    input.adapter.prepareTextureSamplerResources({
      app: input.app,
      cache: input.cache,
      item: input.item,
      reuse: input.reuse,
    }),
  );
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
  const snapshot = options.snapshot ?? app.extract(options.frame ?? 0);
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
          message: `WebGPU app render supports unlit, matcap, and standard materials, not '${material.kind}'.`,
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
        app,
        snapshot,
        frameScratch: resourceCache.frameScratch,
        meshes: resourceCache.preparedMeshFacade,
        materials: resourceCache.preparedMaterialFacade,
      })
    : null;

  if (queuedBuiltIn !== null && !queuedBuiltIn.valid) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
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
      ? createSingleBuiltInAppResourceItem({
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
          message: `WebGPU app render supports unlit, matcap, and standard materials, not '${material.kind}'.`,
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
            message: `WebGPU app render supports unlit, matcap, and standard materials, not '${material.kind}'.`,
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
  });

  await waitForSubmittedWork(app.initialization.device);

  return renderReport({
    ok:
      framePlan.apply.diagnostics.length === 0 &&
      framePlan.bindingPlan.diagnostics.length === 0 &&
      framePlan.packages.diagnostics.length === 0 &&
      framePlan.drawCommands.diagnostics.length === 0 &&
      framePlan.drawList.valid &&
      framePlan.resources.valid &&
      framePlan.commandPlan.valid &&
      boundary.valid,
    snapshot,
    pipeline,
    resources,
    boundary,
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
    collectAppReportMaterialDependencyReadiness(report);

  return {
    ok: report.ok,
    frame: report.frame,
    counts: { ...report.counts },
    diagnostics: report.diagnostics.map((diagnostic) =>
      toWebGpuAppJsonValue(diagnostic),
    ),
    resourceReuse: { ...report.resourceReuse },
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

function collectAppReportMaterialDependencyReadiness(
  report: WebGpuAppRenderReport,
): MaterialAssetDependencyReadinessReportJsonValue[] {
  const readiness: MaterialAssetDependencyReadinessReportJsonValue[] = [];

  for (const diagnostic of report.diagnostics) {
    if (!isWebGpuAppMaterialDependencyDiagnostic(diagnostic)) {
      continue;
    }

    readiness.push(diagnostic.materialDependencyReadiness);
  }

  return readiness;
}

function isWebGpuAppMaterialDependencyDiagnostic(
  diagnostic: unknown,
): diagnostic is WebGpuAppMaterialDependencyDiagnostic {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return false;
  }

  const candidate = diagnostic as {
    readonly code?: unknown;
    readonly materialDependencyReadiness?: unknown;
  };

  return (
    candidate.code === "webGpuApp.materialDependenciesNotReady" &&
    typeof candidate.materialDependencyReadiness === "object" &&
    candidate.materialDependencyReadiness !== null
  );
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
  readonly resourceReuse?: WebGpuAppResourceReuseReport;
  readonly pipeline?: WebGpuAppPipelineResourceResult | null;
  readonly resources?: WebGpuAppFrameResourcesResult | null;
  readonly boundary?: FrameBoundaryAssemblyReport | null;
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
    resourceReuse: input.resourceReuse ?? createWebGpuAppResourceReuseReport(),
    pipeline: input.pipeline ?? null,
    resources: input.resources ?? null,
    boundary: input.boundary ?? null,
  };
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
