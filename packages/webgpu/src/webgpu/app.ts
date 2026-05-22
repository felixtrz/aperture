import {
  AssetRegistry,
  assetHandleKey,
  invertMat4,
  type RenderTargetHandle,
} from "@aperture-engine/simulation";
import {
  RenderWorld,
  createMaterialQueuePhaseSummary,
  createPreparedMeshStore,
  createPreparedMaterialStore,
  createMaterialQueueScratch,
  createPackedSnapshotTransformsScratch,
  createPackedSnapshotInstanceTintsScratch,
  createPackedSnapshotViewUniformsScratch,
  createMaterialDependencyReadinessReport,
  createSamplerAsset,
  materialDependencyReadinessReportToJsonValue,
  prepareSnapshotMeshes,
  prepareSnapshotMaterials,
  preparedMeshStoreSummaryToJsonValue,
  preparedMaterialStoreSummaryToJsonValue,
  writeMaterialQueueFromSnapshot,
  writePackedSnapshotTransforms,
  writePackedSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotViewUniforms,
  type MaterialQueueScratch,
  type MaterialAssetDependencyReadinessReportJsonValue,
  type DebugNormalMaterialAsset,
  type MatcapMaterialAsset,
  type MaterialAsset,
  type MeshAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotInstanceTints,
  type PackedSnapshotViewUniforms,
  type PreparedMaterialStore,
  type PreparedMaterialStoreJsonValue,
  type PreparedMeshStore,
  type PreparedMeshStoreJsonValue,
  type RenderEntityRef,
  type RenderSnapshot,
  type RenderQueueSortPhaseReport,
  type SkyboxPacket,
  type SpriteDrawPacket,
  type StandardMaterialAsset,
  type UnlitMaterialAsset,
} from "@aperture-engine/render";
import {
  createAppTextureSamplerResourceCacheSummary,
  prepareAppTextureResource,
  prepareMatcapAppTextureSamplerResources,
  prepareStandardAppTextureSamplerResources,
  prepareUnlitAppTextureSamplerResources,
  prepareAppSamplerResource,
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
  createGpuPassTimingReport,
  createGpuTimestampQueryResourcesChecked,
  readGpuTimestampQueryResults,
  type GpuPassTimingReport,
  type GpuTimestampQueryDiagnostic,
  type GpuTimestampQueryDeviceLike,
  type GpuTimestampQueryResources,
} from "./gpu-timing.js";
import type { CurrentTextureLike } from "./current-texture-view.js";
import {
  createOrReuseWebGpuDepthTexture,
  createWebGpuDepthTextureCacheSlot,
  WEBGPU_APP_DEPTH_FORMAT,
  type CachedWebGpuDepthTextureResource,
  type WebGpuDepthTextureCacheSlot,
} from "./depth-texture-resource.js";
import { createWebGpuBuffer } from "./buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";
import { createLightBindGroupLayoutDescriptor } from "./light-bind-group-layout.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import {
  STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_POINT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
  createStandardLightCascadedShadowBindGroupLayoutDescriptor,
  createStandardLightIblBindGroupLayoutDescriptor,
  createStandardLightMultiShadowBindGroupLayoutDescriptor,
  createStandardLightPointShadowBindGroupLayoutDescriptor,
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
  createWebGpuAppSnapshotTransport,
  createWebGpuAppSnapshotTransportStartPayload,
  readWebGpuAppSharedSnapshot,
  type WebGpuAppSharedSnapshotTransportOptions,
  type WebGpuAppSnapshotTransportDiagnostics,
  type WebGpuAppSnapshotTransportMode,
} from "./app-snapshot-transport.js";
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
import {
  createStandardAreaLightLtcResources,
  type StandardAreaLightLtcResources,
} from "./standard-area-light-ltc-resource.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
} from "./standard-frame-resources.js";
import {
  createStandardRenderPipelineResource,
  type CreateStandardRenderPipelineResourceResult,
} from "./standard-pipeline.js";
import {
  createTonemapPipelineKey,
  resolveTonemapOperator,
  type TonemapOperator,
} from "./output-stage-tonemap.js";
import {
  createOutputColorSpacePipelineKey,
  resolveOutputColorSpace,
  type OutputColorSpace,
} from "./output-stage-color-space.js";
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
  createSamplerGpuResource,
  type SamplerGpuResource,
  type TextureGpuResource,
} from "./texture-resources.js";
import {
  createSpriteRenderPipelineResource,
  spritePipelineCacheKey,
  type CreateSpriteRenderPipelineResourceResult,
  type SpriteRenderPipelineResource,
} from "./sprite-pipeline.js";
import {
  createSkyboxRenderPipelineResource,
  skyboxPipelineCacheKey,
  type CreateSkyboxRenderPipelineResourceResult,
} from "./skybox-pipeline.js";
import {
  createRenderFramePlanScratch,
  writeRenderFramePlanFromSnapshot,
  type RenderFramePlanScratch,
} from "./render-frame-plan.js";
import type { RenderPassCommand } from "./render-pass-commands.js";
import {
  createWebGpuIdBufferEntries,
  findWebGpuIdBufferEntry,
  WEBGPU_ID_BUFFER_EMPTY_ID,
} from "./id-buffer.js";
import {
  createWebGpuIdBufferPickBindGroup,
  createWebGpuIdBufferPickCommands,
  createWebGpuIdBufferPickIdStorage,
  createWebGpuIdBufferPickPipelineResource,
  createWebGpuIdBufferPickTexture,
  readWebGpuIdBufferPickPixel,
  webGpuIdBufferPickPipelineCacheKey,
  type WebGpuIdBufferPickBindGroupResource,
  type WebGpuIdBufferPickPipelineResource,
  type WebGpuIdBufferPickReadbackResult,
} from "./id-buffer-pick.js";
import {
  createOrReuseWebGpuPostPassTexture,
  createWebGpuPostPassTextureCacheSlot,
  type WebGpuPostEffect,
  type WebGpuPostPassTextureCacheSlot,
  type WebGpuPostPassTextureResource,
} from "./post-pass.js";
import { parseMaterialPipelineRenderStateTokens } from "./material-render-state.js";
import {
  initializeWebGpu,
  type InitializeWebGpuOptions,
  type WebGpuCanvasLike,
  type WebGpuFailure,
  type WebGpuInitializationSuccess,
} from "./index.js";

export interface WebGpuAppRenderOptions {
  readonly frame?: number;
  readonly snapshot?: RenderSnapshot;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
}

export interface WebGpuAppRenderTargetAssetInput {
  readonly texture: CurrentTextureLike;
  readonly width: number;
  readonly height: number;
  readonly format?: string;
  readonly label?: string;
}

export interface WebGpuAppRenderTargetAsset {
  readonly texture: CurrentTextureLike;
  readonly width: number;
  readonly height: number;
  readonly format?: string;
  readonly label?: string;
}

export interface WebGpuAppRenderCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly spriteDraws: number;
  readonly skyboxes: number;
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

export interface WebGpuAppRenderTargetSubmissionReport {
  readonly viewId: number;
  readonly source: "swapchain" | "offscreen";
  readonly renderTargetKey: string | null;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly ok: boolean;
  readonly drawCalls: number;
}

export interface WebGpuAppPostEffectSubmissionReport {
  readonly effectId: string;
  readonly label: string;
  readonly viewId: number;
  readonly input: string;
  readonly output: "swapchain" | "offscreen";
  readonly ok: boolean;
  readonly drawCalls: number;
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

export interface WebGpuAppSimulationWorkerSnapshotEvent {
  readonly snapshot: RenderSnapshot;
  readonly frame: number;
  readonly message?: unknown;
}

export interface WebGpuAppSimulationWorkerErrorEvent {
  readonly reason: string;
  readonly message: string;
  readonly source?: string;
  readonly raw?: unknown;
}

export type WebGpuAppSimulationWorkerSnapshotCallback = (
  event: WebGpuAppSimulationWorkerSnapshotEvent,
) => void;

export type WebGpuAppSimulationWorkerErrorCallback = (
  event: WebGpuAppSimulationWorkerErrorEvent,
) => void;

export interface WebGpuAppSimulationWorker {
  start(options?: Record<string, unknown>): void;
  onSnapshot(callback: WebGpuAppSimulationWorkerSnapshotCallback): () => void;
  onError(callback: WebGpuAppSimulationWorkerErrorCallback): () => void;
}

export type WebGpuAppStartOptions = Record<string, unknown>;

export interface WebGpuAppWorkerRenderErrorDiagnostic {
  readonly code: "webGpuApp.workerSnapshotRenderFailed";
  readonly message: string;
  readonly reason: string;
}

export interface WebGpuAppDiagnostics {
  readonly lastFrame: WebGpuAppRenderReportJsonValue | null;
  readonly lastPick: WebGpuAppPickReportJsonValue | null;
  readonly lastError: WebGpuAppWorkerRenderErrorDiagnostic | null;
  readonly transport: WebGpuAppSnapshotTransportDiagnostics;
}

export interface WebGpuAppPickReport {
  readonly ok: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly id: number | null;
  readonly entity: RenderEntityRef | null;
  readonly diagnostics: readonly unknown[];
  readonly readback?: WebGpuIdBufferPickReadbackResult;
}

export interface WebGpuAppPickReportJsonValue {
  readonly ok: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly id: number | null;
  readonly entity: RenderEntityRef | null;
  readonly diagnostics: readonly WebGpuAppJsonValue[];
  readonly readback?: WebGpuAppJsonValue;
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
  readonly boundaries?: readonly FrameBoundaryAssemblyReport[];
  readonly renderTargets?: readonly WebGpuAppRenderTargetSubmissionReport[];
  readonly postEffects?: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readback?: FrameBoundaryReadbackResult;
  readonly gpuTimings?: GpuPassTimingReport;
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
  readonly renderTargets?: readonly WebGpuAppRenderTargetSubmissionReport[];
  readonly postEffects?: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly readback?: WebGpuAppJsonValue;
  readonly gpuTimings?: GpuPassTimingReport;
  readonly materialDependencyReadiness?: readonly MaterialAssetDependencyReadinessReportJsonValue[];
}

export type WebGpuAppPipelineResourceResult =
  | CreateUnlitRenderPipelineResourceResult
  | CreateMatcapRenderPipelineResourceResult
  | CreateStandardRenderPipelineResourceResult
  | CreateDebugNormalRenderPipelineResourceResult
  | CreateSpriteRenderPipelineResourceResult;

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
  readonly spritePipelines: Map<
    string,
    CreateSpriteRenderPipelineResourceResult
  >;
  readonly skyboxPipelines: Map<
    string,
    CreateSkyboxRenderPipelineResourceResult
  >;
  readonly layouts: Map<string, WebGpuAppPipelineLayouts>;
  readonly textures: Map<string, TextureGpuResource>;
  readonly samplers: Map<string, SamplerGpuResource>;
  readonly environmentResources: WebGpuEnvironmentResourceCache;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedMeshFacade: PreparedMeshStore;
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
  readonly preparedMaterialFacade: PreparedMaterialStore;
  readonly idPickPipelines: Map<string, WebGpuIdBufferPickPipelineResource>;
  readonly gpuTimings: Map<string, WebGpuAppGpuTimingCacheEntry>;
  readonly postPasses: WebGpuAppPostPassCache;
  readonly frameScratch: WebGpuAppFrameScratch;
  readonly unlitFrame: UnlitAppFrameResourceCacheSlot;
  readonly matcapFrame: MatcapAppFrameResourceCacheSlot;
  readonly standardFrame: StandardAppFrameResourceCacheSlot;
  readonly debugNormalFrame: DebugNormalAppFrameResourceCacheSlot;
  readonly depth: WebGpuDepthTextureCacheSlot;
  readonly depthByRenderTarget: Map<string, WebGpuDepthTextureCacheSlot>;
}

interface WebGpuAppPostPassCache {
  readonly scene: WebGpuPostPassTextureCacheSlot;
  readonly ping: WebGpuPostPassTextureCacheSlot;
  readonly pong: WebGpuPostPassTextureCacheSlot;
}

interface WebGpuAppFrameScratch {
  readonly viewUniforms: ReturnType<
    typeof createPackedSnapshotViewUniformsScratch
  >;
  readonly worldTransforms: ReturnType<
    typeof createPackedSnapshotTransformsScratch
  >;
  readonly instanceTints: ReturnType<
    typeof createPackedSnapshotInstanceTintsScratch
  >;
  readonly framePlan: RenderFramePlanScratch;
  readonly materialQueue: MaterialQueueScratch;
  readonly queueRoute: QueuedBuiltInAppRouteCollectorScratch;
  readonly queuedBuiltInFrameResources: QueuedBuiltInFrameResourceScratch<WebGpuAppPipelinePlanResult>;
  readonly viewCommands: RenderPassCommand[];
  readonly skyboxCommands: RenderPassCommand[];
}

interface WebGpuAppGpuTimingCacheEntry {
  readonly passName: string;
  readonly resources: GpuTimestampQueryResources | null;
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
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

interface WebGpuAppRenderContext {
  readonly app: WebGpuApp;
  readonly sourceAssets: AssetRegistry;
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
  readonly assets: AssetRegistry;
  readonly cache: QueuedBuiltInAppResourcePreparationCache;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly reuse: WebGpuAppResourceReuseReport;
}

interface QueuedBuiltInFrameResourcePreparationOptions {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: QueuedBuiltInAppResourcePreparationCache;
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
  readonly snapshot: RenderSnapshot;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly standardAreaLightLtcResources?:
    | StandardAreaLightLtcResources
    | null
    | undefined;
  readonly reuse: WebGpuAppResourceReuseReport;
}

type QueuedBuiltInAppResourcePreparationCache = Omit<
  WebGpuAppResourceCache,
  "preparedMaterials"
>;

export interface WebGpuApp {
  readonly canvas: WebGpuCanvasLike;
  readonly initialization: WebGpuInitializationSuccess;
  readonly renderWorld: RenderWorld;
  readonly tonemap: TonemapOperator;
  readonly outputColorSpace: OutputColorSpace;
  readonly postEffects: readonly WebGpuPostEffect[];
  start(options?: WebGpuAppStartOptions): void;
  stop(): void;
  getDiagnostics(): WebGpuAppDiagnostics;
  pick(x: number, y: number): Promise<RenderEntityRef | null>;
  renderSnapshot(
    snapshot: RenderSnapshot,
    options?: Omit<WebGpuAppRenderOptions, "snapshot">,
  ): Promise<WebGpuAppRenderReport>;
}

export interface CreateWebGpuAppOptions extends Omit<
  InitializeWebGpuOptions,
  "canvas"
> {
  readonly canvas: WebGpuCanvasLike;
  readonly simulationWorker: WebGpuAppSimulationWorker;
  readonly sourceAssets?: AssetRegistry;
  readonly autoStart?: boolean;
  readonly workerStartOptions?: WebGpuAppStartOptions;
  readonly transport?: WebGpuAppSnapshotTransportMode;
  readonly sharedSnapshotTransport?: WebGpuAppSharedSnapshotTransportOptions;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
  readonly postEffects?: readonly WebGpuPostEffect[];
}

export interface CreateWebGpuAppSuccess {
  readonly ok: true;
  readonly app: WebGpuApp;
  readonly initialization: WebGpuInitializationSuccess;
}

export type CreateWebGpuAppResult = CreateWebGpuAppSuccess | WebGpuFailure;

export function createWebGpuAppRenderTargetAsset(
  input: WebGpuAppRenderTargetAssetInput,
): WebGpuAppRenderTargetAsset {
  if (!Number.isInteger(input.width) || input.width <= 0) {
    throw new RangeError("WebGPU app render target width must be positive.");
  }

  if (!Number.isInteger(input.height) || input.height <= 0) {
    throw new RangeError("WebGPU app render target height must be positive.");
  }

  return Object.freeze({
    texture: input.texture,
    width: input.width,
    height: input.height,
    ...(input.format === undefined ? {} : { format: input.format }),
    ...(input.label === undefined ? {} : { label: input.label }),
  });
}

export async function createWebGpuApp(
  options: CreateWebGpuAppOptions,
): Promise<CreateWebGpuAppResult> {
  const initialization = await initializeWebGpu(options);

  if (!initialization.ok) {
    return initialization;
  }

  const sourceAssets = options.sourceAssets ?? new AssetRegistry();
  const renderWorld = new RenderWorld();
  const tonemap = resolveTonemapOperator(options.tonemap);
  const outputColorSpace = resolveOutputColorSpace(options.outputColorSpace);
  const postEffects = [...(options.postEffects ?? [])];
  const resourceCache = createWebGpuAppResourceCache();
  const snapshotTransport = createWebGpuAppSnapshotTransport({
    ...(options.transport === undefined ? {} : { mode: options.transport }),
    ...(options.sharedSnapshotTransport === undefined
      ? {}
      : { sharedSnapshotTransport: options.sharedSnapshotTransport }),
  });
  let running = false;
  let unsubscribeSnapshot: (() => void) | null = null;
  let unsubscribeError: (() => void) | null = null;
  let renderQueue: Promise<void> = Promise.resolve();
  let latestReport: WebGpuAppRenderReport | null = null;
  let latestPickReport: WebGpuAppPickReport | null = null;
  let latestWorkerError: WebGpuAppWorkerRenderErrorDiagnostic | null = null;

  const app: WebGpuApp = {
    canvas: options.canvas,
    initialization,
    renderWorld,
    tonemap,
    outputColorSpace,
    postEffects,
    start(startOptions = {}) {
      if (running) {
        return;
      }

      running = true;
      unsubscribeSnapshot = options.simulationWorker.onSnapshot((event) => {
        renderQueue = renderQueue
          .then(async () => {
            const sharedSnapshot = readWebGpuAppSharedSnapshot(
              snapshotTransport,
              event.message,
            );
            const snapshot = sharedSnapshot ?? event.snapshot;

            await app.renderSnapshot(snapshot, { frame: snapshot.frame });
          })
          .catch((error: unknown) => {
            latestWorkerError = {
              code: "webGpuApp.workerSnapshotRenderFailed",
              reason: "webgpu-app.render-snapshot-failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Rendering a worker-produced snapshot failed.",
            };
          });
      });
      unsubscribeError = options.simulationWorker.onError((event) => {
        latestWorkerError = {
          code: "webGpuApp.workerSnapshotRenderFailed",
          reason: event.reason,
          message: event.message,
        };
      });
      const transportStartPayload =
        createWebGpuAppSnapshotTransportStartPayload(snapshotTransport);

      options.simulationWorker.start({
        ...(options.workerStartOptions ?? {}),
        ...startOptions,
        ...(transportStartPayload === null
          ? {}
          : { transport: transportStartPayload }),
      });
    },
    stop() {
      if (!running) {
        return;
      }

      running = false;
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      unsubscribeError?.();
      unsubscribeError = null;
    },
    getDiagnostics() {
      return {
        lastFrame:
          latestReport === null
            ? null
            : webGpuAppRenderReportToJsonValue(latestReport),
        lastPick:
          latestPickReport === null
            ? null
            : webGpuAppPickReportToJsonValue(latestPickReport),
        lastError: latestWorkerError,
        transport: snapshotTransport.diagnostics,
      };
    },
    async pick(x, y) {
      const report = await pickWebGpuAppEntity(
        { app, sourceAssets },
        resourceCache,
        latestReport,
        x,
        y,
      );

      latestPickReport = report;
      return report.entity;
    },
    async renderSnapshot(snapshot, renderOptions = {}) {
      const report = await renderWebGpuAppFrame(
        { app, sourceAssets },
        resourceCache,
        { ...renderOptions, snapshot },
      );

      prepareSnapshotMeshes({
        registry: sourceAssets,
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
        registry: sourceAssets,
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

      latestReport = report;
      latestWorkerError = null;
      return report;
    },
  };

  registerWebGpuAppEnvironmentResourceCache(
    app,
    resourceCache.environmentResources,
  );

  if (options.autoStart === true) {
    app.start(options.workerStartOptions);
  }

  return { ok: true, app, initialization };
}

function createEmptyRenderSnapshot(frame: number): RenderSnapshot {
  return {
    frame,
    views: [],
    meshDraws: [],
    spriteDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    instanceTints: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      spriteDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function createWebGpuAppResourceCache(): WebGpuAppResourceCache {
  return {
    pipelines: new Map(),
    spritePipelines: new Map(),
    skyboxPipelines: new Map(),
    layouts: new Map(),
    textures: new Map(),
    samplers: new Map(),
    environmentResources: createWebGpuEnvironmentResourceCache(),
    preparedMeshes: createPreparedMeshGpuResourceCache(),
    preparedMeshFacade: createPreparedMeshStore(),
    preparedMaterials: createPreparedBuiltInMaterialStore(),
    preparedMaterialFacade: createPreparedMaterialStore(),
    idPickPipelines: new Map(),
    gpuTimings: new Map(),
    postPasses: {
      scene: createWebGpuPostPassTextureCacheSlot(),
      ping: createWebGpuPostPassTextureCacheSlot(),
      pong: createWebGpuPostPassTextureCacheSlot(),
    },
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
    depthByRenderTarget: new Map(),
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
    instanceTints: createPackedSnapshotInstanceTintsScratch(),
    framePlan: createRenderFramePlanScratch(),
    materialQueue: createMaterialQueueScratch(),
    queueRoute: createQueuedBuiltInAppRouteCollectorScratch(),
    queuedBuiltInFrameResources:
      createQueuedBuiltInFrameResourceScratch<WebGpuAppPipelinePlanResult>(),
    viewCommands: [],
    skyboxCommands: [],
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
    options.kind === "standard"
      ? createTonemapPipelineKey(options.app.tonemap)
      : "tonemap:none",
    options.kind === "standard"
      ? createOutputColorSpacePipelineKey(options.app.outputColorSpace)
      : createOutputColorSpacePipelineKey("linear"),
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
          tonemap: options.app.tonemap,
          outputColorSpace: options.app.outputColorSpace,
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
  const usesLightCascadedShadowGroup = pipelineResourceKey.includes(
    STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
  );
  const usesLightPointShadowGroup = pipelineResourceKey.includes(
    STANDARD_LIGHT_POINT_SHADOW_BIND_GROUP_LAYOUT_KEY,
  );
  const usesLightMultiShadowGroup = pipelineResourceKey.includes(
    STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY,
  );
  const lightLayoutKey = usesLightShadowIblGroup
    ? "webgpu-app/standard/lights-shadow-ibl/group-3"
    : usesLightIblGroup
      ? "webgpu-app/standard/lights-ibl/group-3"
      : usesLightMultiShadowGroup
        ? "webgpu-app/standard/lights-multi-shadow/group-3"
        : usesLightCascadedShadowGroup
          ? "webgpu-app/standard/lights-cascaded-shadow/group-3"
          : usesLightPointShadowGroup
            ? "webgpu-app/standard/lights-point-shadow/group-3"
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
          : usesLightMultiShadowGroup
            ? createStandardLightMultiShadowBindGroupLayoutDescriptor()
            : usesLightCascadedShadowGroup
              ? createStandardLightCascadedShadowBindGroupLayoutDescriptor()
              : usesLightShadowGroup
                ? createStandardLightShadowBindGroupLayoutDescriptor()
                : usesLightPointShadowGroup
                  ? createStandardLightPointShadowBindGroupLayoutDescriptor()
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
  readonly assets: AssetRegistry;
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

    const entry = options.assets.get<"material", MaterialAsset>(draw.material);

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

  const meshEntry = options.assets.get<"mesh", MeshAsset>(
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
          assets: options.assets,
          device: options.app.initialization.device,
          cache: options.cache,
          material: options.item.material as UnlitMaterialAsset,
          reuse: options.reuse,
        }),
      prepareMatcapTextureSamplerResources: (options) =>
        prepareMatcapAppTextureSamplerResources({
          assets: options.assets,
          device: options.app.initialization.device,
          cache: options.cache,
          material: options.item.material as MatcapMaterialAsset,
          reuse: options.reuse,
        }),
      prepareStandardTextureSamplerResources: (options) =>
        prepareStandardAppTextureSamplerResources({
          assets: options.assets,
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
          assets: options.assets,
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
          assets: options.assets,
          textureSamplerDependencies: options.textureSamplerDependencies,
          viewUniforms: options.viewUniforms,
          worldTransforms: options.worldTransforms,
          ...(options.instanceTints === undefined
            ? {}
            : { instanceTints: options.instanceTints }),
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
          draw: options.item.draw,
          mesh: options.item.mesh,
          meshHandle: options.item.draw.mesh,
          meshKey: options.item.meshKey,
          material: options.item.material as StandardMaterialAsset,
          materialHandle: options.item.draw.material,
          materialKey: options.item.materialKey,
          sourceMaterialKey: options.item.sourceMaterialKey,
          pipelineKey: options.item.draw.batchKey.pipelineKey,
          assets: options.assets,
          textureSamplerDependencies: options.textureSamplerDependencies,
          viewUniforms: options.viewUniforms,
          worldTransforms: options.worldTransforms,
          ...(options.instanceTints === undefined
            ? {}
            : { instanceTints: options.instanceTints }),
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
          ...(options.standardAreaLightLtcResources === undefined
            ? {}
            : {
                standardAreaLightLtcResources:
                  options.standardAreaLightLtcResources,
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
          assets: options.assets,
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

type WebGpuAppFrameBoundaryTarget =
  | {
      readonly source: "swapchain";
      readonly view: RenderSnapshot["views"][number];
      readonly renderTargetKey: null;
      readonly width: number;
      readonly height: number;
      readonly format: string;
    }
  | {
      readonly source: "offscreen";
      readonly view: RenderSnapshot["views"][number];
      readonly renderTargetKey: string;
      readonly texture: CurrentTextureLike;
      readonly width: number;
      readonly height: number;
      readonly format: string;
    };

interface WebGpuAppFrameBoundaryAssemblyResult {
  readonly valid: boolean;
  readonly boundary: FrameBoundaryAssemblyReport | null;
  readonly boundaries: readonly FrameBoundaryAssemblyReport[];
  readonly renderTargets: readonly WebGpuAppRenderTargetSubmissionReport[];
  readonly postEffects: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readbackBoundary: FrameBoundaryAssemblyReport | null;
  readonly gpuTimingReadbacks: readonly WebGpuAppGpuTimingReadback[];
  readonly gpuTimingDiagnostics: readonly GpuTimestampQueryDiagnostic[];
  readonly plannedCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: readonly unknown[];
}

interface WebGpuAppGpuTimingReadback {
  readonly passName: string;
  readonly resources: GpuTimestampQueryResources;
}

async function renderQueuedBuiltInWebGpuAppFrame(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
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
  const packedInstanceTints = writePackedSnapshotInstanceTintsForVertexBuffer(
    options.snapshot,
    packedTransforms,
    options.cache.frameScratch.instanceTints,
  );
  const standardAreaLightLtc = resolveStandardAreaLightLtcResources({
    app: options.app,
    cache: options.cache,
    required: queuedBuiltInResourceSetHasStandardMaterial(options.resourceSet),
  });

  if (!standardAreaLightLtc.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      resourceReuse: options.reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...standardAreaLightLtc.diagnostics,
      ],
    });
  }

  const prepared = await prepareQueuedBuiltInFrameResources({
    ...options,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    instanceTints: packedInstanceTints,
    standardAreaLightLtcResources: standardAreaLightLtc.resources,
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
        ...packedInstanceTints.diagnostics,
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
        ...packedInstanceTints.diagnostics,
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
    instanceTintResources: collectInstanceTintResources(prepared.resources),
    pipelines: prepared.pipelineResults,
    bindGroups: prepared.resources.bindGroups,
    scratch: options.cache.frameScratch.framePlan,
  });
  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    commands: framePlan.commandPlan.commands,
    label: options.label ?? "aperture-webgpu-app",
    reuse: options.reuse,
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
  });

  await waitForSubmittedWork(options.app.initialization.device);
  const gpuTimings = await readWebGpuAppGpuTimings({
    readbacks: boundaries.gpuTimingReadbacks,
    diagnostics: boundaries.gpuTimingDiagnostics,
  });
  const frameDiagnosticsSummary =
    gpuTimings === undefined
      ? diagnosticsSummary
      : createWebGpuAppDiagnosticsSummaryWithGpuTimings(
          diagnosticsSummary,
          gpuTimings,
        );
  const frameOk =
    framePlan.apply.diagnostics.length === 0 &&
    framePlan.bindingPlan.diagnostics.length === 0 &&
    framePlan.packages.diagnostics.length === 0 &&
    framePlan.drawCommands.diagnostics.length === 0 &&
    framePlan.drawList.valid &&
    framePlan.resources.valid &&
    framePlan.commandPlan.valid &&
    boundaries.valid;
  const readback = await mapFrameBoundaryReadbackSamples(
    boundaries.readbackBoundary?.readback,
    frameOk,
  );

  return renderReport({
    ok: frameOk,
    snapshot: options.snapshot,
    pipeline: prepared.firstPipeline,
    resources: prepared.resourcesResult,
    boundary: boundaries.boundary,
    boundaries: boundaries.boundaries,
    renderTargets: boundaries.renderTargets,
    postEffects: boundaries.postEffects,
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    ...(gpuTimings === undefined ? {} : { gpuTimings }),
    resourceReuse: options.reuse,
    diagnosticsSummary: frameDiagnosticsSummary,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    diagnostics: [
      ...options.snapshot.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...boundaries.diagnostics,
    ],
  });
}

async function assembleWebGpuAppFrameBoundaries(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly commands: readonly RenderPassCommand[];
  readonly label: string;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly clearColor?: readonly number[];
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
}): Promise<WebGpuAppFrameBoundaryAssemblyResult> {
  const targetPlan = createWebGpuAppFrameBoundaryTargets(
    options.app,
    options.assets,
    options.snapshot,
  );

  if (targetPlan.diagnostics.length > 0) {
    return {
      valid: false,
      boundary: null,
      boundaries: [],
      renderTargets: [],
      postEffects: [],
      readbackBoundary: null,
      gpuTimingReadbacks: [],
      gpuTimingDiagnostics: [],
      plannedCommands: 0,
      drawCalls: 0,
      diagnostics: targetPlan.diagnostics,
    };
  }

  const boundaries: FrameBoundaryAssemblyReport[] = [];
  const renderTargets: WebGpuAppRenderTargetSubmissionReport[] = [];
  const postEffects: WebGpuAppPostEffectSubmissionReport[] = [];
  const diagnostics: unknown[] = [];
  const activePostEffects = options.app.postEffects.filter(
    (effect) => effect.enabled !== false,
  );
  let firstBoundary: FrameBoundaryAssemblyReport | null = null;
  let firstDepthAttachment: WebGpuAppDepthAttachmentReport | undefined;
  let readbackBoundary: FrameBoundaryAssemblyReport | null = null;
  const gpuTimingReadbacks: WebGpuAppGpuTimingReadback[] = [];
  const gpuTimingDiagnostics: GpuTimestampQueryDiagnostic[] = [];
  let plannedCommands = 0;
  let drawCalls = 0;
  let allTargetsValid = true;

  for (const target of targetPlan.targets) {
    const skybox = await writeSkyboxCommandsForView({
      app: options.app,
      assets: options.assets,
      cache: options.cache,
      snapshot: options.snapshot,
      view: target.view,
      target: options.cache.frameScratch.skyboxCommands,
      reuse: options.reuse,
    });
    const commands = writeCommandsForView(
      options.commands,
      options.snapshot,
      target.view,
      options.cache.frameScratch.viewCommands,
      skybox.commands,
    );
    diagnostics.push(...skybox.diagnostics);
    allTargetsValid &&= skybox.valid;
    const depthAttachment = createWebGpuAppDepthAttachmentForTarget(
      options.app,
      options.cache,
      target,
    );
    const includeReadback =
      options.readbackSamples !== undefined &&
      readbackBoundary === null &&
      target.source === "swapchain";
    const gpuTiming = await createWebGpuAppGpuTimingForTarget(
      options.app,
      options.cache,
      options.label,
      target,
    );
    gpuTimingDiagnostics.push(...gpuTiming.diagnostics);

    if (gpuTiming.resources !== null) {
      gpuTimingReadbacks.push({
        passName: gpuTiming.passName,
        resources: gpuTiming.resources,
      });
    }

    if (target.source === "swapchain" && activePostEffects.length > 0) {
      const postTarget = assembleWebGpuAppPostProcessedSwapchainTarget({
        app: options.app,
        cache: options.cache,
        snapshot: options.snapshot,
        target,
        commands,
        depthAttachment,
        effects: activePostEffects,
        label: options.label,
        clearColor: options.clearColor ?? target.view.clearColor,
        ...(includeReadback
          ? { readbackSamples: options.readbackSamples }
          : {}),
        ...(gpuTiming.resources === null
          ? {}
          : {
              gpuTiming: {
                passName: gpuTiming.passName,
                resources: gpuTiming.resources,
              },
            }),
      });

      firstBoundary ??= postTarget.boundaries[0] ?? null;
      firstDepthAttachment ??= createWebGpuAppDepthAttachmentReport(
        options.snapshot,
        depthAttachment,
      );
      readbackBoundary ??= postTarget.readbackBoundary;
      boundaries.push(...postTarget.boundaries);
      renderTargets.push(postTarget.renderTarget);
      postEffects.push(...postTarget.postEffects);
      plannedCommands += postTarget.plannedCommands;
      drawCalls += postTarget.drawCalls;
      allTargetsValid &&= postTarget.valid;
      diagnostics.push(...postTarget.diagnostics);
      continue;
    }

    const boundary = assembleFrameBoundary({
      context: options.app.initialization.context as Parameters<
        typeof assembleFrameBoundary
      >[0]["context"],
      device: options.app.initialization.device as Parameters<
        typeof assembleFrameBoundary
      >[0]["device"],
      queue: (options.app.initialization.device as { readonly queue: unknown })
        .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
      commands,
      label: `${options.label}:${target.renderTargetKey ?? "swapchain"}`,
      ...(target.source === "offscreen"
        ? {
            colorTarget: {
              source: "offscreen-target" as const,
              texture: target.texture,
            },
          }
        : {}),
      clearColor: options.clearColor ?? target.view.clearColor,
      depthTarget: {
        view: depthAttachment.view,
        depthClearValue: target.view.clearDepth,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
      ...(gpuTiming.resources === null
        ? {}
        : {
            gpuTiming: {
              passName: gpuTiming.passName,
              resources: gpuTiming.resources,
            },
          }),
      ...(includeReadback
        ? {
            readback: {
              format: target.format,
              width: target.width,
              height: target.height,
              samples: options.readbackSamples,
            },
          }
        : {}),
    });

    firstBoundary ??= boundary;
    firstDepthAttachment ??= createWebGpuAppDepthAttachmentReport(
      options.snapshot,
      depthAttachment,
    );

    if (boundary.readback !== null && boundary.readback !== undefined) {
      readbackBoundary = boundary;
    }

    boundaries.push(boundary);
    allTargetsValid &&= boundary.valid;
    renderTargets.push({
      viewId: target.view.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      format: target.format,
      ok: boundary.valid,
      drawCalls: boundary.execution?.drawCalls ?? 0,
    });
    plannedCommands += commands.length;
    drawCalls += countDrawCommands(commands);
    diagnostics.push(
      ...boundary.texture.diagnostics,
      ...(boundary.attachments?.diagnostics ?? []),
      ...(boundary.encoder?.diagnostics ?? []),
      ...(boundary.begin?.diagnostics ?? []),
      ...(boundary.execution?.diagnostics ?? []),
      ...(boundary.end?.diagnostics ?? []),
      ...(boundary.finish?.diagnostics ?? []),
      ...(boundary.submit?.diagnostics ?? []),
    );
  }

  return {
    valid:
      targetPlan.targets.length > 0 &&
      allTargetsValid &&
      boundaries.every((boundary) => boundary.valid) &&
      postEffects.every((effect) => effect.ok),
    boundary: firstBoundary,
    boundaries,
    renderTargets,
    postEffects,
    ...(firstDepthAttachment === undefined
      ? {}
      : { depthAttachment: firstDepthAttachment }),
    readbackBoundary,
    gpuTimingReadbacks,
    gpuTimingDiagnostics,
    plannedCommands,
    drawCalls,
    diagnostics,
  };
}

async function renderSpriteOnlyWebGpuAppFrame(
  context: WebGpuAppRenderContext,
  resourceCache: WebGpuAppResourceCache,
  options: WebGpuAppRenderOptions & { readonly snapshot: RenderSnapshot },
): Promise<WebGpuAppRenderReport> {
  const { app, sourceAssets } = context;
  const reuse = createWebGpuAppResourceReuseReport();
  const spriteDraws = options.snapshot.spriteDraws ?? [];
  const packedViews = writePackedSnapshotViewUniforms(
    options.snapshot,
    resourceCache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    options.snapshot,
    resourceCache.frameScratch.worldTransforms,
  );
  let pipeline: CreateSpriteRenderPipelineResourceResult | null = null;
  let spriteResources: SpriteFrameResources = {
    valid: true,
    commands: [],
    diagnostics: [],
  };

  if (spriteDraws.length > 0) {
    pipeline = await getOrCreateWebGpuAppSpritePipeline(app, resourceCache);

    if (!pipeline.valid || pipeline.resource === null) {
      return renderReport({
        ok: false,
        snapshot: options.snapshot,
        pipeline,
        resourceReuse: reuse,
        diagnostics: [
          ...options.snapshot.diagnostics,
          ...packedViews.diagnostics,
          ...packedTransforms.diagnostics,
          ...pipeline.diagnostics,
        ],
      });
    }

    spriteResources = createSpriteFrameResources({
      app,
      assets: sourceAssets,
      cache: resourceCache,
      snapshot: options.snapshot,
      spriteDraws,
      viewUniforms: packedViews,
      worldTransforms: packedTransforms,
      pipeline: pipeline.resource,
      reuse,
    });
  }

  if (!spriteResources.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...spriteResources.diagnostics,
      ],
    });
  }

  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot: options.snapshot,
    commands: spriteResources.commands,
    label: options.label ?? "aperture-webgpu-sprite-app",
    reuse,
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
  });

  await waitForSubmittedWork(app.initialization.device);

  const frameOk =
    packedViews.diagnostics.length === 0 &&
    packedTransforms.diagnostics.length === 0 &&
    spriteResources.diagnostics.length === 0 &&
    boundaries.valid;
  const readback = await mapFrameBoundaryReadbackSamples(
    boundaries.readbackBoundary?.readback,
    frameOk,
  );

  return renderReport({
    ok: frameOk,
    snapshot: options.snapshot,
    pipeline,
    boundary: boundaries.boundary,
    boundaries: boundaries.boundaries,
    renderTargets: boundaries.renderTargets,
    postEffects: boundaries.postEffects,
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    resourceReuse: reuse,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    diagnostics: [
      ...options.snapshot.diagnostics,
      ...packedViews.diagnostics,
      ...packedTransforms.diagnostics,
      ...spriteResources.diagnostics,
      ...boundaries.diagnostics,
    ],
  });
}

interface SpriteFrameResources {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
}

function createSpriteFrameResources(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly spriteDraws: readonly SpriteDrawPacket[];
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly pipeline: SpriteRenderPipelineResource;
  readonly reuse: WebGpuAppResourceReuseReport;
}): SpriteFrameResources {
  const diagnostics: unknown[] = [];
  const commands: RenderPassCommand[] = [];
  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];
  const pipeline = options.pipeline.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };
  const viewUniformData = options.viewUniforms.data.subarray(
    0,
    options.viewUniforms.floatCount ?? options.viewUniforms.data.length,
  );
  const worldTransformData = options.worldTransforms.data.subarray(
    0,
    options.worldTransforms.floatCount ?? options.worldTransforms.data.length,
  );

  if (pipeline.getBindGroupLayout === undefined) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "spriteFrame.missingPipelineLayouts",
          message: "Sprite pipeline does not expose bind group layouts.",
        },
      ],
    };
  }

  if (device.createBindGroup === undefined) {
    return {
      valid: false,
      commands,
      diagnostics: [
        {
          code: "spriteFrame.createBindGroupUnavailable",
          message: "WebGPU device cannot create sprite bind groups.",
        },
      ],
    };
  }

  const viewBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Sprite/ViewUniforms",
      size: viewUniformData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: viewUniformData,
    },
  });
  const transformBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Sprite/WorldTransforms",
      size: worldTransformData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: worldTransformData,
    },
  });
  const spriteData = packSpriteData(options.snapshot, options.spriteDraws);
  const spriteBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: "Sprite/Data",
      size: spriteData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: spriteData,
    },
  });

  if (!viewBuffer.ok) {
    diagnostics.push(
      bufferDiagnostic("spriteFrame.viewBufferFailed", viewBuffer.message),
    );
  }

  if (!transformBuffer.ok) {
    diagnostics.push(
      bufferDiagnostic(
        "spriteFrame.transformBufferFailed",
        transformBuffer.message,
      ),
    );
  }

  if (!spriteBuffer.ok) {
    diagnostics.push(
      bufferDiagnostic("spriteFrame.spriteBufferFailed", spriteBuffer.message),
    );
  }

  if (!viewBuffer.ok || !transformBuffer.ok || !spriteBuffer.ok) {
    return { valid: false, commands, diagnostics };
  }

  const defaultSampler = getOrCreateSpriteDefaultSampler(
    options.app,
    options.cache,
    options.reuse,
    diagnostics,
  );

  if (defaultSampler === null) {
    return { valid: false, commands, diagnostics };
  }

  const viewBindGroup = device.createBindGroup({
    label: "Sprite/ViewBindGroup",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer.buffer } }],
  });
  const transformBindGroup = device.createBindGroup({
    label: "Sprite/TransformBindGroup",
    layout: pipeline.getBindGroupLayout(1),
    entries: [{ binding: 0, resource: { buffer: transformBuffer.buffer } }],
  });

  for (const draw of options.spriteDraws) {
    const sampler =
      draw.sampler === undefined || draw.sampler === null
        ? {
            cacheKey: "sprite:default-sampler",
            resource: defaultSampler,
          }
        : prepareAppSamplerResource({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            handle: draw.sampler,
            reuse: options.reuse,
            diagnostics: diagnostics as Parameters<
              typeof prepareAppSamplerResource
            >[0]["diagnostics"],
          });

    if (sampler === null) {
      continue;
    }

    const texture = prepareAppTextureResource({
      assets: options.assets,
      device: options.app.initialization.device,
      cache: options.cache,
      handle: draw.texture,
      reuse: options.reuse,
      diagnostics: diagnostics as Parameters<
        typeof prepareAppTextureResource
      >[0]["diagnostics"],
    });

    if (texture === null) {
      continue;
    }

    const spriteBindGroup = device.createBindGroup({
      label: `Sprite/TextureBindGroup/${draw.renderId}`,
      layout: pipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: { buffer: spriteBuffer.buffer } },
        { binding: 1, resource: texture.resource.view },
        { binding: 2, resource: sampler.resource.sampler },
      ],
    });

    commands.push(
      {
        kind: "setPipeline",
        renderId: draw.renderId,
        pipelineKey: options.pipeline.cacheKey,
        pipeline: options.pipeline.pipeline,
      },
      {
        kind: "setBindGroup",
        renderId: draw.renderId,
        index: 0,
        resourceKey: "sprite:view",
        bindGroup: viewBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: draw.renderId,
        index: 1,
        resourceKey: "sprite:transforms",
        bindGroup: transformBindGroup,
      },
      {
        kind: "setBindGroup",
        renderId: draw.renderId,
        index: 2,
        resourceKey: `sprite:${texture.cacheKey}:${sampler.cacheKey}`,
        bindGroup: spriteBindGroup,
      },
      {
        kind: "draw",
        renderId: draw.renderId,
        vertexCount: 6,
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: draw.worldTransformOffset / 16,
      },
    );
  }

  return {
    valid: diagnostics.length === 0 && commands.length > 0,
    commands,
    diagnostics,
  };
}

async function getOrCreateWebGpuAppSpritePipeline(
  app: WebGpuApp,
  cache: WebGpuAppResourceCache,
): Promise<CreateSpriteRenderPipelineResourceResult> {
  const key = spritePipelineCacheKey(
    app.initialization.format,
    WEBGPU_APP_DEPTH_FORMAT,
  );
  const cached = cache.spritePipelines.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await createSpriteRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createSpriteRenderPipelineResource
    >[0]["device"],
    colorFormat: app.initialization.format,
    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
  });

  cache.spritePipelines.set(key, result);
  return result;
}

function packSpriteData(
  snapshot: RenderSnapshot,
  spriteDraws: readonly SpriteDrawPacket[],
): Float32Array {
  const transformCount = Math.max(
    1,
    Math.ceil(snapshot.transforms.length / 16),
  );
  const data = new Float32Array(transformCount * 8);

  for (const draw of spriteDraws) {
    const index = Math.floor(draw.worldTransformOffset / 16);
    const offset = index * 8;

    data.set(draw.color, offset);
    data[offset + 4] = draw.width;
    data[offset + 5] = draw.height;
  }

  return data;
}

function getOrCreateSpriteDefaultSampler(
  app: WebGpuApp,
  cache: WebGpuAppResourceCache,
  reuse: WebGpuAppResourceReuseReport,
  diagnostics: unknown[],
): SamplerGpuResource | null {
  const cacheKey = "sprite:default-sampler";
  const cached = cache.samplers.get(cacheKey);

  if (cached !== undefined) {
    reuse.samplerResourcesReused += 1;
    return cached;
  }

  const sampler = createSamplerGpuResource({
    device: app.initialization.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey: cacheKey,
    sampler: createSamplerAsset({
      label: "SpriteDefaultSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  });

  diagnostics.push(...sampler.diagnostics);

  if (!sampler.valid || sampler.resource === null) {
    return null;
  }

  cache.samplers.set(cacheKey, sampler.resource);
  reuse.samplerResourcesCreated += 1;
  return sampler.resource;
}

function bufferDiagnostic(code: string, message: string): unknown {
  return { code, message };
}

interface SkyboxFrameCommands {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly unknown[];
}

async function writeSkyboxCommandsForView(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly view: RenderSnapshot["views"][number];
  readonly target: RenderPassCommand[];
  readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<SkyboxFrameCommands> {
  options.target.length = 0;

  const skybox = selectSkyboxForView(
    options.snapshot.skyboxes ?? [],
    options.view,
  );

  if (skybox === null) {
    return { valid: true, commands: options.target, diagnostics: [] };
  }

  const diagnostics: unknown[] = [];
  const pipeline = await getOrCreateWebGpuAppSkyboxPipeline(
    options.app,
    options.cache,
    options.reuse,
  );

  diagnostics.push(...pipeline.diagnostics);

  if (!pipeline.valid || pipeline.resource === null) {
    return { valid: false, commands: options.target, diagnostics };
  }

  const device = options.app.initialization.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  } & Parameters<typeof createWebGpuBuffer>[0]["device"];
  const pipelineHandle = pipeline.resource.pipeline as {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipelineHandle.getBindGroupLayout === undefined) {
    diagnostics.push({
      code: "skyboxFrame.missingPipelineLayouts",
      message: "Skybox pipeline does not expose bind group layouts.",
    });
    return { valid: false, commands: options.target, diagnostics };
  }

  if (device.createBindGroup === undefined) {
    diagnostics.push({
      code: "skyboxFrame.createBindGroupUnavailable",
      message: "WebGPU device cannot create skybox bind groups.",
    });
    return { valid: false, commands: options.target, diagnostics };
  }

  const uniformData = createSkyboxViewUniformData({
    snapshot: options.snapshot,
    view: options.view,
    skybox,
    diagnostics,
  });

  if (uniformData === null) {
    return { valid: false, commands: options.target, diagnostics };
  }

  const uniformBuffer = createWebGpuBuffer({
    device,
    descriptor: {
      label: `Skybox/View/${String(options.view.viewId)}`,
      size: uniformData.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: uniformData,
    },
  });

  if (!uniformBuffer.ok) {
    diagnostics.push(
      bufferDiagnostic("skyboxFrame.viewBufferFailed", uniformBuffer.message),
    );
    return { valid: false, commands: options.target, diagnostics };
  }

  const texture = prepareAppTextureResource({
    assets: options.assets,
    device: options.app.initialization.device,
    cache: options.cache,
    handle: skybox.texture,
    reuse: options.reuse,
    diagnostics: diagnostics as Parameters<
      typeof prepareAppTextureResource
    >[0]["diagnostics"],
    viewDescriptor: { dimension: "cube" },
    viewDescriptorKey: "cube",
  });

  if (texture === null) {
    return { valid: false, commands: options.target, diagnostics };
  }

  const sampler =
    skybox.sampler === undefined || skybox.sampler === null
      ? {
          cacheKey: "skybox:default-sampler",
          resource: getOrCreateSkyboxDefaultSampler(
            options.app,
            options.cache,
            options.reuse,
            diagnostics,
          ),
        }
      : prepareAppSamplerResource({
          assets: options.assets,
          device: options.app.initialization.device,
          cache: options.cache,
          handle: skybox.sampler,
          reuse: options.reuse,
          diagnostics: diagnostics as Parameters<
            typeof prepareAppSamplerResource
          >[0]["diagnostics"],
        });

  if (sampler === null || sampler.resource === null) {
    return { valid: false, commands: options.target, diagnostics };
  }

  const viewBindGroup = device.createBindGroup({
    label: `Skybox/ViewBindGroup/${String(options.view.viewId)}`,
    layout: pipelineHandle.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer.buffer } }],
  });
  const textureBindGroup = device.createBindGroup({
    label: `Skybox/TextureBindGroup/${skybox.skyboxId}`,
    layout: pipelineHandle.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: texture.resource.view },
      { binding: 1, resource: sampler.resource.sampler },
    ],
  });

  options.target.push(
    {
      kind: "setPipeline",
      renderId: skybox.skyboxId,
      pipelineKey: pipeline.resource.cacheKey,
      pipeline: pipeline.resource.pipeline,
    },
    {
      kind: "setBindGroup",
      renderId: skybox.skyboxId,
      index: 0,
      resourceKey: `skybox:view:${String(options.view.viewId)}`,
      bindGroup: viewBindGroup,
    },
    {
      kind: "setBindGroup",
      renderId: skybox.skyboxId,
      index: 1,
      resourceKey: `skybox:${texture.cacheKey}:${sampler.cacheKey}`,
      bindGroup: textureBindGroup,
    },
    {
      kind: "draw",
      renderId: skybox.skyboxId,
      vertexCount: 3,
      instanceCount: 1,
      firstVertex: 0,
      firstInstance: 0,
    },
  );

  return {
    valid: diagnostics.length === 0,
    commands: options.target,
    diagnostics,
  };
}

function selectSkyboxForView(
  skyboxes: readonly SkyboxPacket[],
  view: RenderSnapshot["views"][number],
): SkyboxPacket | null {
  for (const skybox of skyboxes) {
    if ((skybox.layerMask & view.layerMask) !== 0) {
      return skybox;
    }
  }

  return null;
}

async function getOrCreateWebGpuAppSkyboxPipeline(
  app: WebGpuApp,
  cache: WebGpuAppResourceCache,
  reuse: WebGpuAppResourceReuseReport,
): Promise<CreateSkyboxRenderPipelineResourceResult> {
  const key = skyboxPipelineCacheKey(
    app.initialization.format,
    WEBGPU_APP_DEPTH_FORMAT,
  );
  const cached = cache.skyboxPipelines.get(key);

  if (cached !== undefined) {
    reuse.pipelineHits += 1;
    return cached;
  }

  reuse.pipelineMisses += 1;

  const result = await createSkyboxRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createSkyboxRenderPipelineResource
    >[0]["device"],
    colorFormat: app.initialization.format,
    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
  });

  cache.skyboxPipelines.set(key, result);
  return result;
}

function createSkyboxViewUniformData(input: {
  readonly snapshot: RenderSnapshot;
  readonly view: RenderSnapshot["views"][number];
  readonly skybox: SkyboxPacket;
  readonly diagnostics: unknown[];
}): Float32Array | null {
  const viewProjectionOffset = input.view.viewProjectionMatrixOffset;
  const viewMatrixOffset = input.view.viewMatrixOffset;

  if (!hasMatrixRange(input.snapshot.viewMatrices, viewProjectionOffset)) {
    input.diagnostics.push({
      code: "skyboxFrame.viewProjectionOutOfRange",
      message: `Skybox view ${String(input.view.viewId)} view-projection matrix offset ${String(viewProjectionOffset)} is outside snapshot view matrix data.`,
    });
    return null;
  }

  if (!hasMatrixRange(input.snapshot.viewMatrices, viewMatrixOffset)) {
    input.diagnostics.push({
      code: "skyboxFrame.viewMatrixOutOfRange",
      message: `Skybox view ${String(input.view.viewId)} view matrix offset ${String(viewMatrixOffset)} is outside snapshot view matrix data.`,
    });
    return null;
  }

  const viewProjection = input.snapshot.viewMatrices.subarray(
    viewProjectionOffset,
    viewProjectionOffset + 16,
  );
  const inverseViewProjection = invertMat4(viewProjection);

  if (inverseViewProjection === null) {
    input.diagnostics.push({
      code: "skyboxFrame.viewProjectionNotInvertible",
      message: `Skybox view ${String(input.view.viewId)} has a non-invertible view-projection matrix.`,
    });
    return null;
  }

  if (!Number.isFinite(input.skybox.intensity) || input.skybox.intensity < 0) {
    input.diagnostics.push({
      code: "skyboxFrame.invalidIntensity",
      message: `Skybox ${String(input.skybox.skyboxId)} intensity must be finite and non-negative.`,
    });
    return null;
  }

  const data = new Float32Array(24);

  data.set(inverseViewProjection, 0);
  writeCameraPositionFromViewMatrix(
    data,
    16,
    input.snapshot.viewMatrices,
    viewMatrixOffset,
  );
  data[20] = input.skybox.intensity;
  data[21] = 0;
  data[22] = 0;
  data[23] = 0;
  return data;
}

function hasMatrixRange(values: Float32Array, sourceOffset: number): boolean {
  return sourceOffset >= 0 && sourceOffset + 16 <= values.length;
}

function writeCameraPositionFromViewMatrix(
  target: Float32Array,
  targetOffset: number,
  viewMatrices: Float32Array,
  viewMatrixOffset: number,
): void {
  const tx = viewMatrices[viewMatrixOffset + 12] ?? 0;
  const ty = viewMatrices[viewMatrixOffset + 13] ?? 0;
  const tz = viewMatrices[viewMatrixOffset + 14] ?? 0;

  target[targetOffset] = -(
    (viewMatrices[viewMatrixOffset] ?? 1) * tx +
    (viewMatrices[viewMatrixOffset + 1] ?? 0) * ty +
    (viewMatrices[viewMatrixOffset + 2] ?? 0) * tz
  );
  target[targetOffset + 1] = -(
    (viewMatrices[viewMatrixOffset + 4] ?? 0) * tx +
    (viewMatrices[viewMatrixOffset + 5] ?? 1) * ty +
    (viewMatrices[viewMatrixOffset + 6] ?? 0) * tz
  );
  target[targetOffset + 2] = -(
    (viewMatrices[viewMatrixOffset + 8] ?? 0) * tx +
    (viewMatrices[viewMatrixOffset + 9] ?? 0) * ty +
    (viewMatrices[viewMatrixOffset + 10] ?? 1) * tz
  );
  target[targetOffset + 3] = 1;
}

function getOrCreateSkyboxDefaultSampler(
  app: WebGpuApp,
  cache: WebGpuAppResourceCache,
  reuse: WebGpuAppResourceReuseReport,
  diagnostics: unknown[],
): SamplerGpuResource | null {
  const cacheKey = "skybox:default-sampler";
  const cached = cache.samplers.get(cacheKey);

  if (cached !== undefined) {
    reuse.samplerResourcesReused += 1;
    return cached;
  }

  const sampler = createSamplerGpuResource({
    device: app.initialization.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey: cacheKey,
    sampler: createSamplerAsset({
      label: "SkyboxDefaultSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
    }),
  });

  diagnostics.push(...sampler.diagnostics);

  if (!sampler.valid || sampler.resource === null) {
    return null;
  }

  cache.samplers.set(cacheKey, sampler.resource);
  reuse.samplerResourcesCreated += 1;
  return sampler.resource;
}

interface WebGpuAppPostProcessedSwapchainTargetResult {
  readonly valid: boolean;
  readonly boundaries: readonly FrameBoundaryAssemblyReport[];
  readonly renderTarget: WebGpuAppRenderTargetSubmissionReport;
  readonly postEffects: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly readbackBoundary: FrameBoundaryAssemblyReport | null;
  readonly plannedCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: readonly unknown[];
}

function assembleWebGpuAppPostProcessedSwapchainTarget(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly target: Extract<
    WebGpuAppFrameBoundaryTarget,
    { source: "swapchain" }
  >;
  readonly commands: readonly RenderPassCommand[];
  readonly depthAttachment: CachedWebGpuDepthTextureResource;
  readonly effects: readonly WebGpuPostEffect[];
  readonly label: string;
  readonly clearColor?: readonly number[];
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly gpuTiming?: Parameters<typeof assembleFrameBoundary>[0]["gpuTiming"];
}): WebGpuAppPostProcessedSwapchainTargetResult {
  const boundaries: FrameBoundaryAssemblyReport[] = [];
  const postEffects: WebGpuAppPostEffectSubmissionReport[] = [];
  const diagnostics: unknown[] = [];
  const device = options.app.initialization.device as Parameters<
    typeof assembleFrameBoundary
  >[0]["device"];
  const queue = (
    options.app.initialization.device as { readonly queue: unknown }
  ).queue as Parameters<typeof assembleFrameBoundary>[0]["queue"];
  const context = options.app.initialization.context as Parameters<
    typeof assembleFrameBoundary
  >[0]["context"];
  const sceneTexture = createOrReuseWebGpuPostPassTexture({
    device: options.app.initialization.device as Parameters<
      typeof createOrReuseWebGpuPostPassTexture
    >[0]["device"],
    slot: options.cache.postPasses.scene,
    width: options.target.width,
    height: options.target.height,
    format: options.target.format,
    label: `${options.label}:post:scene`,
  });

  diagnostics.push(...sceneTexture.diagnostics);

  if (!sceneTexture.valid || sceneTexture.resource === null) {
    return {
      valid: false,
      boundaries,
      renderTarget: {
        viewId: options.target.view.viewId,
        source: "swapchain",
        renderTargetKey: null,
        width: options.target.width,
        height: options.target.height,
        format: options.target.format,
        ok: false,
        drawCalls: 0,
      },
      postEffects,
      readbackBoundary: null,
      plannedCommands: 0,
      drawCalls: 0,
      diagnostics,
    };
  }

  const sceneBoundary = assembleFrameBoundary({
    context,
    device,
    queue,
    commands: options.commands,
    label: `${options.label}:swapchain:scene`,
    colorTarget: {
      source: "offscreen-target",
      texture: sceneTexture.resource.texture,
    },
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    depthTarget: {
      view: options.depthAttachment.view,
      depthClearValue: options.target.view.clearDepth,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
    ...(options.gpuTiming === undefined
      ? {}
      : { gpuTiming: options.gpuTiming }),
  });
  let input: WebGpuPostPassTextureResource = sceneTexture.resource;
  let readbackBoundary: FrameBoundaryAssemblyReport | null = null;
  let plannedCommands = options.commands.length;
  let drawCalls = countDrawCommands(options.commands);
  let valid = sceneBoundary.valid;

  boundaries.push(sceneBoundary);
  appendFrameBoundaryDiagnostics(diagnostics, sceneBoundary);

  for (
    let effectIndex = 0;
    effectIndex < options.effects.length;
    effectIndex += 1
  ) {
    const effect = options.effects[effectIndex];

    if (effect === undefined) {
      continue;
    }

    const isLast = effectIndex === options.effects.length - 1;
    let outputTexture: WebGpuPostPassTextureResource | null = null;

    if (!isLast) {
      const intermediate = createOrReuseWebGpuPostPassTexture({
        device: options.app.initialization.device as Parameters<
          typeof createOrReuseWebGpuPostPassTexture
        >[0]["device"],
        slot:
          effectIndex % 2 === 0
            ? options.cache.postPasses.ping
            : options.cache.postPasses.pong,
        width: options.target.width,
        height: options.target.height,
        format: options.target.format,
        label: `${options.label}:post:${effectIndex}:intermediate`,
      });

      diagnostics.push(...intermediate.diagnostics);
      outputTexture = intermediate.resource;

      if (!intermediate.valid || outputTexture === null) {
        valid = false;
        break;
      }
    }

    const prepared = effect.prepare({
      device: options.app.initialization.device as Parameters<
        WebGpuPostEffect["prepare"]
      >[0]["device"],
      input,
      outputFormat: options.target.format,
      width: options.target.width,
      height: options.target.height,
      frame: options.snapshot.frame,
      passIndex: effectIndex,
      label: `${options.label}:post:${effect.id}`,
    });

    diagnostics.push(...prepared.diagnostics);

    const postBoundary = assembleFrameBoundary({
      context,
      device,
      queue,
      commands: prepared.commands,
      label: `${options.label}:post:${effectIndex}:${effect.id}`,
      ...(isLast
        ? {}
        : {
            colorTarget: {
              source: "offscreen-target" as const,
              texture: outputTexture?.texture,
            },
          }),
      clearColor: [0, 0, 0, 1],
      ...(isLast && options.readbackSamples !== undefined
        ? {
            readback: {
              format: options.target.format,
              width: options.target.width,
              height: options.target.height,
              samples: options.readbackSamples,
            },
          }
        : {}),
    });

    const postOk =
      postBoundary.valid &&
      prepared.diagnostics.length === 0 &&
      (isLast || outputTexture !== null);

    postEffects.push({
      effectId: prepared.effectId,
      label: prepared.label,
      viewId: options.target.view.viewId,
      input: input.label,
      output: isLast ? "swapchain" : "offscreen",
      ok: postOk,
      drawCalls: postBoundary.execution?.drawCalls ?? 0,
    });
    boundaries.push(postBoundary);
    appendFrameBoundaryDiagnostics(diagnostics, postBoundary);
    plannedCommands += prepared.commands.length;
    drawCalls += countDrawCommands(prepared.commands);
    valid &&= postOk;

    if (postBoundary.readback !== null && postBoundary.readback !== undefined) {
      readbackBoundary = postBoundary;
    }

    if (!isLast && outputTexture !== null) {
      input = outputTexture;
    }
  }

  return {
    valid,
    boundaries,
    renderTarget: {
      viewId: options.target.view.viewId,
      source: "swapchain",
      renderTargetKey: null,
      width: options.target.width,
      height: options.target.height,
      format: options.target.format,
      ok: valid,
      drawCalls: sceneBoundary.execution?.drawCalls ?? 0,
    },
    postEffects,
    readbackBoundary,
    plannedCommands,
    drawCalls,
    diagnostics,
  };
}

function appendFrameBoundaryDiagnostics(
  diagnostics: unknown[],
  boundary: FrameBoundaryAssemblyReport,
): void {
  diagnostics.push(
    ...boundary.texture.diagnostics,
    ...(boundary.attachments?.diagnostics ?? []),
    ...(boundary.encoder?.diagnostics ?? []),
    ...(boundary.begin?.diagnostics ?? []),
    ...(boundary.execution?.diagnostics ?? []),
    ...(boundary.end?.diagnostics ?? []),
    ...(boundary.finish?.diagnostics ?? []),
    ...(boundary.submit?.diagnostics ?? []),
  );
}

async function createWebGpuAppGpuTimingForTarget(
  app: WebGpuApp,
  cache: WebGpuAppResourceCache,
  label: string,
  target: WebGpuAppFrameBoundaryTarget,
): Promise<{
  readonly passName: string;
  readonly resources: GpuTimestampQueryResources | null;
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}> {
  const passName =
    target.renderTargetKey === null ? "main" : `main:${target.renderTargetKey}`;
  const cacheKey = `${passName}:2`;
  const cached = cache.gpuTimings.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const created = await createGpuTimestampQueryResourcesChecked({
    device: app.initialization.device as GpuTimestampQueryDeviceLike,
    label: `${label}:${passName}:gpu-timing`,
    queryCount: 2,
  });
  const entry = {
    passName,
    resources: created.resources,
    diagnostics: created.diagnostics,
  };

  cache.gpuTimings.set(cacheKey, entry);
  return entry;
}

async function readWebGpuAppGpuTimings(input: {
  readonly readbacks: readonly WebGpuAppGpuTimingReadback[];
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}): Promise<GpuPassTimingReport | undefined> {
  if (input.readbacks.length === 0) {
    return undefined;
  }

  if (input.readbacks.length === 1) {
    const readback = input.readbacks[0];

    if (readback === undefined) {
      return undefined;
    }

    return createGpuPassTimingReport({
      passNames: [readback.passName],
      readback: await readGpuTimestampQueryResults(readback.resources),
      diagnostics: input.diagnostics,
    });
  }

  const passReports: GpuPassTimingReport[] = [];

  for (const readback of input.readbacks) {
    passReports.push(
      createGpuPassTimingReport({
        passNames: [readback.passName],
        readback: await readGpuTimestampQueryResults(readback.resources),
      }),
    );
  }

  return {
    ready:
      input.diagnostics.length === 0 &&
      passReports.every((report) => report.ready),
    supported: passReports.some((report) => report.supported),
    queryCount: passReports.reduce((sum, report) => sum + report.queryCount, 0),
    passes: passReports.flatMap((report) => report.passes),
    diagnostics: [
      ...input.diagnostics,
      ...passReports.flatMap((report) => report.diagnostics),
    ],
  };
}

function createWebGpuAppDiagnosticsSummaryWithGpuTimings(
  summary: WebGpuAppDiagnosticsSummary,
  gpuTimings: GpuPassTimingReport,
): WebGpuAppDiagnosticsSummary {
  return createWebGpuAppDiagnosticsSummary({
    ...(summary.materialQueue === undefined
      ? {}
      : { materialQueue: summary.materialQueue }),
    ...(summary.materialQueueRoute === undefined
      ? {}
      : { materialQueueRoute: summary.materialQueueRoute }),
    ...(summary.routedResourceSet === undefined
      ? {}
      : { routedResourceSet: summary.routedResourceSet }),
    ...(summary.builtInAppResourceAdapters === undefined
      ? {}
      : { builtInAppResourceAdapters: summary.builtInAppResourceAdapters }),
    ...(summary.renderFrameQueue === undefined
      ? {}
      : { renderFrameQueue: summary.renderFrameQueue }),
    ...(summary.renderQueueSortPhases === undefined
      ? {}
      : { renderQueueSortPhases: summary.renderQueueSortPhases }),
    gpuTimings,
    ...(summary.directLighting === undefined
      ? {}
      : { directLighting: summary.directLighting }),
  });
}

function createWebGpuAppFrameBoundaryTargets(
  app: WebGpuApp,
  assets: AssetRegistry,
  snapshot: RenderSnapshot,
): {
  readonly targets: readonly WebGpuAppFrameBoundaryTarget[];
  readonly diagnostics: readonly unknown[];
} {
  const targets: WebGpuAppFrameBoundaryTarget[] = [];
  const diagnostics: unknown[] = [];
  const canvasDimensions = webGpuAppCanvasDimensions(app.canvas);

  for (const view of snapshot.views) {
    if (view.renderTarget === null) {
      targets.push({
        source: "swapchain",
        view,
        renderTargetKey: null,
        ...canvasDimensions,
        format: app.initialization.format,
      });
      continue;
    }

    const renderTargetKey = assetHandleKey(view.renderTarget);
    const entry = assets.get<"render-target", WebGpuAppRenderTargetAsset>(
      view.renderTarget,
    );

    if (entry === undefined) {
      diagnostics.push(
        createWebGpuAppRenderTargetDiagnostic({
          code: "webGpuApp.renderTargetMissing",
          viewId: view.viewId,
          renderTarget: view.renderTarget,
          message: `View ${view.viewId} targets missing render target asset '${renderTargetKey}'.`,
        }),
      );
      continue;
    }

    if (entry.status !== "ready" || entry.asset === null) {
      diagnostics.push(
        createWebGpuAppRenderTargetDiagnostic({
          code: "webGpuApp.renderTargetNotReady",
          viewId: view.viewId,
          renderTarget: view.renderTarget,
          status: entry.status,
          message: `View ${view.viewId} targets render target '${renderTargetKey}' with status '${entry.status}', expected 'ready'.`,
        }),
      );
      continue;
    }

    const asset = entry.asset;

    if (!isWebGpuAppRenderTargetAsset(asset)) {
      diagnostics.push(
        createWebGpuAppRenderTargetDiagnostic({
          code: "webGpuApp.renderTargetInvalid",
          viewId: view.viewId,
          renderTarget: view.renderTarget,
          message: `View ${view.viewId} targets render target '${renderTargetKey}' without a valid WebGPU texture and dimensions.`,
        }),
      );
      continue;
    }

    const assetFormat = asset.format ?? app.initialization.format;

    if (assetFormat !== app.initialization.format) {
      diagnostics.push(
        createWebGpuAppRenderTargetDiagnostic({
          code: "webGpuApp.renderTargetFormatMismatch",
          viewId: view.viewId,
          renderTarget: view.renderTarget,
          message: `View ${view.viewId} targets render target '${renderTargetKey}' with format '${assetFormat}', but the app pipeline format is '${app.initialization.format}'.`,
        }),
      );
      continue;
    }

    targets.push({
      source: "offscreen",
      view,
      renderTargetKey,
      texture: asset.texture,
      width: asset.width,
      height: asset.height,
      format: assetFormat,
    });
  }

  return { targets, diagnostics };
}

function createWebGpuAppRenderTargetDiagnostic(input: {
  readonly code:
    | "webGpuApp.renderTargetMissing"
    | "webGpuApp.renderTargetNotReady"
    | "webGpuApp.renderTargetInvalid"
    | "webGpuApp.renderTargetFormatMismatch";
  readonly viewId: number;
  readonly renderTarget: RenderTargetHandle;
  readonly message: string;
  readonly status?: string;
}): {
  readonly code: typeof input.code;
  readonly message: string;
  readonly viewId: number;
  readonly renderTargetKey: string;
  readonly status?: string;
} {
  return {
    code: input.code,
    message: input.message,
    viewId: input.viewId,
    renderTargetKey: assetHandleKey(input.renderTarget),
    ...(input.status === undefined ? {} : { status: input.status }),
  };
}

function isWebGpuAppRenderTargetAsset(
  value: unknown,
): value is WebGpuAppRenderTargetAsset {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const asset = value as Partial<WebGpuAppRenderTargetAsset>;
  const width = asset.width;
  const height = asset.height;

  return (
    typeof asset.texture === "object" &&
    asset.texture !== null &&
    typeof asset.texture.createView === "function" &&
    width !== undefined &&
    Number.isInteger(width) &&
    width > 0 &&
    height !== undefined &&
    Number.isInteger(height) &&
    height > 0 &&
    (asset.format === undefined || typeof asset.format === "string")
  );
}

function writeCommandsForView(
  commands: readonly RenderPassCommand[],
  snapshot: RenderSnapshot,
  view: RenderSnapshot["views"][number],
  target: RenderPassCommand[],
  prefixCommands: readonly RenderPassCommand[] = [],
): readonly RenderPassCommand[] {
  target.length = 0;

  for (const command of prefixCommands) {
    target.push(command);
  }

  for (const command of commands) {
    if (isRenderPassCommandVisibleToView(command, snapshot, view)) {
      target.push(command);
    }
  }

  return target;
}

function isRenderPassCommandVisibleToView(
  command: RenderPassCommand,
  snapshot: RenderSnapshot,
  view: RenderSnapshot["views"][number],
): boolean {
  const draw = snapshot.meshDraws.find(
    (packet) => packet.renderId === command.renderId,
  );

  if (draw !== undefined) {
    return (draw.layerMask & view.layerMask) !== 0;
  }

  const sprite = snapshot.spriteDraws?.find(
    (packet) => packet.renderId === command.renderId,
  );

  return sprite === undefined || (sprite.layerMask & view.layerMask) !== 0;
}

function countDrawCommands(commands: readonly RenderPassCommand[]): number {
  let count = 0;

  for (const command of commands) {
    if (command.kind === "draw" || command.kind === "drawIndexed") {
      count += 1;
    }
  }

  return count;
}

function createWebGpuAppDepthAttachmentForTarget(
  app: WebGpuApp,
  resourceCache: WebGpuAppResourceCache,
  target: WebGpuAppFrameBoundaryTarget,
): CachedWebGpuDepthTextureResource {
  return createOrReuseWebGpuDepthTexture({
    device: app.initialization.device as Parameters<
      typeof createOrReuseWebGpuDepthTexture
    >[0]["device"],
    cache: depthCacheSlotForTarget(resourceCache, target),
    width: target.width,
    height: target.height,
    format: WEBGPU_APP_DEPTH_FORMAT,
  }).resource;
}

function depthCacheSlotForTarget(
  resourceCache: WebGpuAppResourceCache,
  target: WebGpuAppFrameBoundaryTarget,
): WebGpuDepthTextureCacheSlot {
  if (target.source === "swapchain") {
    return resourceCache.depth;
  }

  let slot = resourceCache.depthByRenderTarget.get(target.renderTargetKey);

  if (slot === undefined) {
    slot = createWebGpuDepthTextureCacheSlot();
    resourceCache.depthByRenderTarget.set(target.renderTargetKey, slot);
  }

  return slot;
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
    renderQueueSortPhases: createQueuedBuiltInAppSortPhaseSummary(
      input.resourceSet.items,
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

function collectInstanceTintResources(
  resources: QueuedBuiltInFrameResources,
): NonNullable<
  QueuedBuiltInFrameResources["standard"][number]["instanceTints"]
>[] {
  const result: NonNullable<
    QueuedBuiltInFrameResources["standard"][number]["instanceTints"]
  >[] = [];
  const seen = new Set<string>();

  for (const standard of resources.standard) {
    const instanceTints = standard.instanceTints;

    if (instanceTints === undefined || seen.has(instanceTints.resourceKey)) {
      continue;
    }

    seen.add(instanceTints.resourceKey);
    result.push(instanceTints);
  }

  return result;
}

function createQueuedBuiltInAppSortPhaseSummary(
  items: readonly QueuedBuiltInAppResourceItem[],
): readonly RenderQueueSortPhaseReport[] {
  let opaque = 0;
  let transparent = 0;

  for (const item of items) {
    if (item.queueItem.renderPhase === "transparent") {
      transparent += 1;
    } else {
      opaque += 1;
    }
  }

  const phases: RenderQueueSortPhaseReport[] = [];

  if (opaque > 0) {
    phases.push({ phase: "opaque", recordCount: opaque });
  }

  if (transparent > 0) {
    phases.push({ phase: "transparent", recordCount: transparent });
  }

  return phases;
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

function queuedBuiltInResourceSetHasStandardMaterial(
  resourceSet: QueuedBuiltInAppResourceSet,
): boolean {
  return resourceSet.items.some((item) => item.adapter.kind === "standard");
}

function resolveStandardAreaLightLtcResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly required: boolean;
}): {
  readonly valid: boolean;
  readonly resources: StandardAreaLightLtcResources | null;
  readonly diagnostics: readonly unknown[];
} {
  if (!options.required) {
    return { valid: true, resources: null, diagnostics: [] };
  }

  const result = createStandardAreaLightLtcResources({
    device: options.app.initialization.device as Parameters<
      typeof createStandardAreaLightLtcResources
    >[0]["device"],
    textureCache: options.cache.textures,
    samplerCache: options.cache.samplers,
  });

  return {
    valid: result.valid,
    resources: result.resources,
    diagnostics: result.diagnostics,
  };
}

async function prepareQueuedBuiltInFrameResources(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly standardAreaLightLtcResources?:
    | StandardAreaLightLtcResources
    | null
    | undefined;
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
    ...(options.instanceTints === undefined
      ? {}
      : { instanceTints: options.instanceTints }),
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
          ...(instanceTints === undefined ? {} : { instanceTints }),
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
          ...(options.standardAreaLightLtcResources === undefined
            ? {}
            : {
                standardAreaLightLtcResources:
                  options.standardAreaLightLtcResources,
              }),
          reuse: options.reuse,
        }),
    },
  });
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
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly standardAreaLightLtcResources?:
    | StandardAreaLightLtcResources
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
    ...(input.instanceTints === undefined
      ? {}
      : { instanceTints: input.instanceTints }),
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
    ...(input.standardAreaLightLtcResources === undefined
      ? {}
      : {
          standardAreaLightLtcResources: input.standardAreaLightLtcResources,
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
  context: WebGpuAppRenderContext,
  resourceCache: WebGpuAppResourceCache,
  options: WebGpuAppRenderOptions,
): Promise<WebGpuAppRenderReport> {
  const { app, sourceAssets } = context;
  const reuse = createWebGpuAppResourceReuseReport();
  const extractedSnapshot = options.snapshot;

  if (extractedSnapshot === undefined) {
    return renderReport({
      ok: false,
      snapshot: createEmptyRenderSnapshot(options.frame ?? 0),
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.missingSnapshot",
          message:
            "Renderer-only WebGPU app rendering requires a RenderSnapshot from the simulation worker.",
        },
      ],
    });
  }

  const shadowSnapshot = hasReadyStandardShadowReceiverResources(
    options.standardMaterialShadowReceiverResources,
  )
    ? withStandardShadowPipelineKeys(
        extractedSnapshot,
        standardShadowPipelineKind(
          options.standardMaterialShadowReceiverResources,
        ),
      )
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
  const spriteDraws = snapshot.spriteDraws ?? [];
  const skyboxes = snapshot.skyboxes ?? [];
  const resourceSetPlan = createWebGpuAppDrawResourceSetPlan(snapshot);

  if (
    firstDraw === undefined &&
    firstView !== undefined &&
    (spriteDraws.length > 0 || skyboxes.length > 0)
  ) {
    return renderSpriteOnlyWebGpuAppFrame(context, resourceCache, {
      ...options,
      snapshot,
    });
  }

  if (firstDraw === undefined || firstView === undefined) {
    const materialDependencyDiagnostics = diagnoseSnapshotMaterialDependencies(
      sourceAssets,
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
    diagnoseSnapshotMaterialDependencies(sourceAssets, snapshot);

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

  const meshEntry = sourceAssets.get<"mesh", MeshAsset>(firstDraw.mesh);
  const materialEntry = sourceAssets.get<"material", MaterialAsset>(
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
    registry: sourceAssets,
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
    assets: sourceAssets,
    snapshot,
    plan: resourceSetPlan,
    firstDraw,
  });
  const shouldUseQueuedBuiltInRoute =
    multiUnlit === null &&
    (firstMaterialKindSupported || resourceSetPlan.sets.length > 1);

  if (shouldUseQueuedBuiltInRoute) {
    prepareSnapshotMeshes({
      registry: sourceAssets,
      snapshot,
      meshes: resourceCache.preparedMeshFacade,
    });
    prepareSnapshotMaterials({
      registry: sourceAssets,
      snapshot,
      materials: resourceCache.preparedMaterialFacade,
    });
  }

  const queuedBuiltIn = shouldUseQueuedBuiltInRoute
    ? collectQueuedBuiltInAppResourceSet({
        assets: sourceAssets,
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
      assets: sourceAssets,
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
  const packedInstanceTints = writePackedSnapshotInstanceTintsForVertexBuffer(
    snapshot,
    packedTransforms,
    resourceCache.frameScratch.instanceTints,
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
          assets: sourceAssets,
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
        ...packedInstanceTints.diagnostics,
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

    const standardAreaLightLtc = resolveStandardAreaLightLtcResources({
      app,
      cache: resourceCache,
      required: item.adapter.kind === "standard",
    });

    if (!standardAreaLightLtc.valid) {
      return renderReport({
        ok: false,
        snapshot,
        pipeline,
        resourceReuse: reuse,
        diagnostics: [
          ...snapshot.diagnostics,
          ...packedViews.diagnostics,
          ...packedTransforms.diagnostics,
          ...packedInstanceTints.diagnostics,
          ...standardAreaLightLtc.diagnostics,
        ],
      });
    }

    const textureSamplerDependencies =
      createPreparedMaterialTextureSamplerDependencies(preparedTextures);

    resources = item.adapter.createFrameResources({
      app,
      assets: sourceAssets,
      cache: resourceCache,
      preparedMaterials: resourceCache.preparedMaterials,
      snapshot,
      item,
      textureSamplerDependencies,
      viewUniforms: packedViews,
      worldTransforms: packedTransforms,
      instanceTints: packedInstanceTints,
      layouts,
      standardAreaLightLtcResources: standardAreaLightLtc.resources,
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
        ...packedInstanceTints.diagnostics,
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
    ...("instanceTints" in frameResources
      ? { instanceTintResources: [frameResources.instanceTints] }
      : {}),
    pipelines: [pipelineResult],
    bindGroups: frameResources.bindGroups,
    scratch: resourceCache.frameScratch.framePlan,
  });
  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot,
    commands: framePlan.commandPlan.commands,
    label: options.label ?? "aperture-webgpu-app",
    reuse,
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
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
    boundaries.valid;
  const readback = await mapFrameBoundaryReadbackSamples(
    boundaries.readbackBoundary?.readback,
    frameOk,
  );

  return renderReport({
    ok: frameOk,
    snapshot,
    pipeline,
    resources,
    boundary: boundaries.boundary,
    boundaries: boundaries.boundaries,
    renderTargets: boundaries.renderTargets,
    postEffects: boundaries.postEffects,
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    resourceReuse: reuse,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    diagnostics: [
      ...snapshot.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...boundaries.diagnostics,
    ],
  });
}

async function pickWebGpuAppEntity(
  context: WebGpuAppRenderContext,
  resourceCache: WebGpuAppResourceCache,
  latestReport: WebGpuAppRenderReport | null,
  x: number,
  y: number,
): Promise<WebGpuAppPickReport> {
  const dimensions = webGpuAppCanvasDimensions(context.app.canvas);
  const pixel = webGpuAppPickPixel(dimensions, x, y);

  if (pixel === null) {
    return createWebGpuAppPickReport({
      x,
      y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: [
        {
          code: "webGpuApp.pickInvalidCoordinates",
          message: `Pick coordinates ${String(x)},${String(y)} are outside the ${dimensions.width}x${dimensions.height} canvas.`,
        },
      ],
    });
  }

  if (latestReport === null) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: [
        {
          code: "webGpuApp.pickMissingFrame",
          message: "WebGPU app picking requires a previously rendered frame.",
        },
      ],
    });
  }

  if (!latestReport.ok) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: [
        {
          code: "webGpuApp.pickLastFrameNotReady",
          message:
            "WebGPU app picking requires the latest rendered frame to be ready.",
        },
        ...latestReport.diagnostics,
      ],
    });
  }

  const snapshot = latestReport.snapshot;
  const prepared = await prepareWebGpuAppPickFrameResources(
    context,
    resourceCache,
    snapshot,
  );

  if (
    !prepared.valid ||
    prepared.framePlan === null ||
    prepared.resources === null
  ) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: prepared.diagnostics,
    });
  }

  const pipelines = await getOrCreateWebGpuIdBufferPickPipelines({
    app: context.app,
    cache: resourceCache,
    snapshot,
    pipelineResults: prepared.pipelineResults,
  });

  if (!pipelines.valid) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: pipelines.diagnostics,
    });
  }

  const idStorage = createWebGpuIdBufferPickIdStorage({
    device: context.app.initialization.device as Parameters<
      typeof createWebGpuIdBufferPickIdStorage
    >[0]["device"],
    snapshot,
  });

  if (!idStorage.valid || idStorage.resource === null) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: idStorage.diagnostics,
    });
  }

  const firstPickPipeline = pipelines.pipelines.values().next().value;

  if (firstPickPipeline === undefined) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: [
        {
          code: "webGpuApp.pickMissingPipeline",
          message: "WebGPU app picking could not create an ID-buffer pipeline.",
        },
      ],
    });
  }

  const idBindGroup = createWebGpuIdBufferPickBindGroup({
    device: context.app.initialization.device as Parameters<
      typeof createWebGpuIdBufferPickBindGroup
    >[0]["device"],
    pipeline: firstPickPipeline,
    ids: idStorage.resource,
  });

  if (!idBindGroup.valid || idBindGroup.resource === null) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: idBindGroup.diagnostics,
    });
  }

  const sharedBindGroups = createWebGpuAppPickSharedBindGroups({
    device: context.app.initialization.device,
    pipeline: firstPickPipeline,
    viewUniformBuffer: prepared.resources.viewUniform.buffer,
    worldTransformBuffer: prepared.resources.worldTransforms.buffer,
  });

  if (!sharedBindGroups.valid) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: sharedBindGroups.diagnostics,
    });
  }

  const pickCommands = createWebGpuIdBufferPickCommands({
    commands: prepared.framePlan.commandPlan.commands,
    pipelineByKey: pipelines.pipelines,
    viewBindGroup: sharedBindGroups.viewBindGroup,
    worldTransformBindGroup: sharedBindGroups.worldTransformBindGroup,
    idBindGroup: idBindGroup.resource,
  });

  if (!pickCommands.valid) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: pickCommands.diagnostics,
    });
  }

  const texture = createWebGpuIdBufferPickTexture({
    device: context.app.initialization.device as Parameters<
      typeof createWebGpuIdBufferPickTexture
    >[0]["device"],
    width: dimensions.width,
    height: dimensions.height,
  });

  if (!texture.valid || texture.resource === null) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: texture.diagnostics,
    });
  }

  try {
    pushWebGpuPickErrorScope(context.app.initialization.device);
    const target = {
      source: "swapchain" as const,
      view: snapshot.views[0] as RenderSnapshot["views"][number],
      renderTargetKey: null,
      width: dimensions.width,
      height: dimensions.height,
      format: context.app.initialization.format,
    };
    const depthAttachment = createWebGpuAppDepthAttachmentForTarget(
      context.app,
      resourceCache,
      target,
    );
    const boundary = assembleFrameBoundary({
      context: context.app.initialization.context as Parameters<
        typeof assembleFrameBoundary
      >[0]["context"],
      device: context.app.initialization.device as Parameters<
        typeof assembleFrameBoundary
      >[0]["device"],
      queue: (context.app.initialization.device as { readonly queue: unknown })
        .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
      commands: pickCommands.commands,
      label: "aperture-webgpu-app:pick-id-buffer",
      colorTarget: {
        source: "offscreen-target",
        texture: texture.resource.texture as CurrentTextureLike,
      },
      clearColor: [WEBGPU_ID_BUFFER_EMPTY_ID, 0, 0, 0],
      depthTarget: {
        view: depthAttachment.view,
        depthClearValue: snapshot.views[0]?.clearDepth ?? 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    await waitForSubmittedWork(context.app.initialization.device);
    const validationMessage = await popWebGpuPickErrorScope(
      context.app.initialization.device,
    );

    if (!boundary.valid || validationMessage !== null) {
      return createWebGpuAppPickReport({
        x: pixel.x,
        y: pixel.y,
        dimensions,
        id: null,
        entity: null,
        diagnostics: [
          ...(validationMessage === null
            ? []
            : [
                {
                  code: "webGpuApp.pickGpuValidationError",
                  message: validationMessage,
                },
              ]),
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

    const readback = await readWebGpuIdBufferPickPixel({
      device: context.app.initialization.device as Parameters<
        typeof readWebGpuIdBufferPickPixel
      >[0]["device"],
      texture: texture.resource.texture,
      width: dimensions.width,
      height: dimensions.height,
      x: pixel.x,
      y: pixel.y,
    });

    if (!readback.ok) {
      return createWebGpuAppPickReport({
        x: pixel.x,
        y: pixel.y,
        dimensions,
        id: null,
        entity: null,
        readback,
        diagnostics: [
          {
            code: readback.reason,
            message: readback.message,
          },
        ],
      });
    }

    const id = readback.id;
    const entry =
      id === WEBGPU_ID_BUFFER_EMPTY_ID
        ? null
        : findWebGpuIdBufferEntry(
            createWebGpuIdBufferEntries(snapshot.meshDraws),
            id,
          );

    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id,
      entity: entry?.entity ?? null,
      readback,
      diagnostics: [],
    });
  } finally {
    texture.resource.destroy?.();
  }
}

function pushWebGpuPickErrorScope(device: unknown): void {
  const scoped = device as {
    readonly pushErrorScope?: (filter: "validation") => void;
  };

  try {
    scoped.pushErrorScope?.("validation");
  } catch {
    // Error scopes are diagnostic-only; picking still returns readback results.
  }
}

async function popWebGpuPickErrorScope(
  device: unknown,
): Promise<string | null> {
  const scoped = device as {
    readonly popErrorScope?: () => Promise<{
      readonly message?: string;
    } | null>;
  };

  if (scoped.popErrorScope === undefined) {
    return null;
  }

  try {
    const error = await scoped.popErrorScope();

    return error?.message ?? null;
  } catch {
    return null;
  }
}

function createWebGpuAppPickSharedBindGroups(options: {
  readonly device: unknown;
  readonly pipeline: WebGpuIdBufferPickPipelineResource;
  readonly viewUniformBuffer: unknown;
  readonly worldTransformBuffer: unknown;
}): {
  readonly valid: boolean;
  readonly viewBindGroup: WebGpuIdBufferPickBindGroupResource;
  readonly worldTransformBindGroup: WebGpuIdBufferPickBindGroupResource;
  readonly diagnostics: readonly unknown[];
} {
  const device = options.device as {
    readonly createBindGroup?: (descriptor: unknown) => unknown;
  };

  if (device.createBindGroup === undefined) {
    return {
      valid: false,
      viewBindGroup: missingPickBindGroup(0),
      worldTransformBindGroup: missingPickBindGroup(1),
      diagnostics: [
        {
          code: "webGpuApp.pickCreateBindGroupUnavailable",
          message:
            "WebGPU app picking requires createBindGroup for view and transform resources.",
        },
      ],
    };
  }

  return {
    valid: true,
    viewBindGroup: {
      group: 0,
      resourceKey: "id-buffer-pick/view",
      bindGroup: device.createBindGroup({
        label: "aperture/id-buffer-pick/view",
        layout: options.pipeline.layouts.view,
        entries: [
          {
            binding: 0,
            resource: { buffer: options.viewUniformBuffer },
          },
        ],
      }),
    },
    worldTransformBindGroup: {
      group: 1,
      resourceKey: "id-buffer-pick/world-transforms",
      bindGroup: device.createBindGroup({
        label: "aperture/id-buffer-pick/world-transforms",
        layout: options.pipeline.layouts.worldTransforms,
        entries: [
          {
            binding: 0,
            resource: { buffer: options.worldTransformBuffer },
          },
        ],
      }),
    },
    diagnostics: [],
  };
}

function missingPickBindGroup(
  group: number,
): WebGpuIdBufferPickBindGroupResource {
  return { group, resourceKey: "missing", bindGroup: null };
}

async function prepareWebGpuAppPickFrameResources(
  context: WebGpuAppRenderContext,
  resourceCache: WebGpuAppResourceCache,
  snapshot: RenderSnapshot,
): Promise<{
  readonly valid: boolean;
  readonly framePlan: ReturnType<
    typeof writeRenderFramePlanFromSnapshot
  > | null;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly pipelineResults: readonly WebGpuAppPipelinePlanResult[];
  readonly diagnostics: readonly unknown[];
}> {
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return {
      valid: false,
      framePlan: null,
      resources: null,
      pipelineResults: [],
      diagnostics: [
        {
          code: "webGpuApp.pickEmptySnapshot",
          message:
            "WebGPU app picking requires at least one view and one mesh draw.",
        },
      ],
    };
  }

  prepareSnapshotMeshes({
    registry: context.sourceAssets,
    snapshot,
    meshes: resourceCache.preparedMeshFacade,
  });
  prepareSnapshotMaterials({
    registry: context.sourceAssets,
    snapshot,
    materials: resourceCache.preparedMaterialFacade,
  });

  const queuedBuiltIn = collectQueuedBuiltInAppResourceSet({
    assets: context.sourceAssets,
    snapshot,
    materialQueueScratch: resourceCache.frameScratch.materialQueue,
    routeScratch: resourceCache.frameScratch.queueRoute,
    meshes: resourceCache.preparedMeshFacade,
    materials: resourceCache.preparedMaterialFacade,
    adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
  });

  if (!queuedBuiltIn.valid || queuedBuiltIn.resourceSet === null) {
    return {
      valid: false,
      framePlan: null,
      resources: null,
      pipelineResults: [],
      diagnostics: queuedBuiltIn.diagnostics,
    };
  }

  const packedViews = writePackedSnapshotViewUniforms(
    snapshot,
    resourceCache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    snapshot,
    resourceCache.frameScratch.worldTransforms,
  );
  const packedInstanceTints = writePackedSnapshotInstanceTintsForVertexBuffer(
    snapshot,
    packedTransforms,
    resourceCache.frameScratch.instanceTints,
  );
  const standardAreaLightLtc = resolveStandardAreaLightLtcResources({
    app: context.app,
    cache: resourceCache,
    required: queuedBuiltInResourceSetHasStandardMaterial(
      queuedBuiltIn.resourceSet,
    ),
  });

  if (!standardAreaLightLtc.valid) {
    return {
      valid: false,
      framePlan: null,
      resources: null,
      pipelineResults: [],
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...standardAreaLightLtc.diagnostics,
      ],
    };
  }

  const prepared = await prepareQueuedBuiltInFrameResources({
    app: context.app,
    assets: context.sourceAssets,
    cache: resourceCache,
    snapshot,
    resourceSet: queuedBuiltIn.resourceSet,
    reuse: createWebGpuAppResourceReuseReport(),
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    instanceTints: packedInstanceTints,
    standardAreaLightLtcResources: standardAreaLightLtc.resources,
  });

  if (!prepared.valid || prepared.resources === null) {
    return {
      valid: false,
      framePlan: null,
      resources: null,
      pipelineResults: prepared.pipelineResults,
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...prepared.diagnostics,
      ],
    };
  }

  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot,
    renderWorld: context.app.renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      prepared.meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
    resolveMaterialResourceKey: (draw) =>
      prepared.materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
    meshResources: prepared.resources.meshResources,
    instanceTintResources: collectInstanceTintResources(prepared.resources),
    pipelines: prepared.pipelineResults,
    bindGroups: prepared.resources.bindGroups,
    scratch: resourceCache.frameScratch.framePlan,
  });
  const diagnostics = [
    ...packedViews.diagnostics,
    ...packedTransforms.diagnostics,
    ...packedInstanceTints.diagnostics,
    ...framePlan.bindingPlan.diagnostics,
    ...framePlan.readiness.diagnostics,
    ...framePlan.packages.diagnostics,
    ...framePlan.drawCommands.diagnostics,
    ...framePlan.drawList.diagnostics,
    ...framePlan.resources.diagnostics,
    ...framePlan.commandPlan.diagnostics,
  ];

  return {
    valid:
      diagnostics.length === 0 &&
      framePlan.drawList.valid &&
      framePlan.resources.valid &&
      framePlan.commandPlan.valid,
    framePlan,
    resources: prepared.resources,
    pipelineResults: prepared.pipelineResults,
    diagnostics,
  };
}

async function getOrCreateWebGpuIdBufferPickPipelines(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly pipelineResults: readonly WebGpuAppPipelinePlanResult[];
}): Promise<{
  readonly valid: boolean;
  readonly pipelines: ReadonlyMap<string, WebGpuIdBufferPickPipelineResource>;
  readonly diagnostics: readonly unknown[];
}> {
  const pipelines = new Map<string, WebGpuIdBufferPickPipelineResource>();
  const diagnostics: unknown[] = [];

  for (const draw of options.snapshot.meshDraws) {
    if (pipelines.has(draw.batchKey.pipelineKey)) {
      continue;
    }

    const cacheKey = webGpuIdBufferPickPipelineCacheKey(draw.batchKey);
    const cached = options.cache.idPickPipelines.get(cacheKey);

    if (cached !== undefined) {
      pipelines.set(draw.batchKey.pipelineKey, cached);
      continue;
    }

    const created = await createWebGpuIdBufferPickPipelineResource({
      device: options.app.initialization.device as Parameters<
        typeof createWebGpuIdBufferPickPipelineResource
      >[0]["device"],
      batchKey: draw.batchKey,
      depthFormat: WEBGPU_APP_DEPTH_FORMAT,
    });

    diagnostics.push(...created.diagnostics);

    if (created.valid && created.resource !== null) {
      options.cache.idPickPipelines.set(cacheKey, created.resource);
      pipelines.set(draw.batchKey.pipelineKey, created.resource);
    }
  }

  return {
    valid: diagnostics.length === 0,
    pipelines,
    diagnostics,
  };
}

function webGpuAppPickPixel(
  dimensions: { readonly width: number; readonly height: number },
  x: number,
  y: number,
): { readonly x: number; readonly y: number } | null {
  const pixel = { x: Math.floor(x), y: Math.floor(y) };

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    pixel.x < 0 ||
    pixel.y < 0 ||
    pixel.x >= dimensions.width ||
    pixel.y >= dimensions.height
  ) {
    return null;
  }

  return pixel;
}

function createWebGpuAppPickReport(input: {
  readonly x: number;
  readonly y: number;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly id: number | null;
  readonly entity: RenderEntityRef | null;
  readonly diagnostics: readonly unknown[];
  readonly readback?: WebGpuIdBufferPickReadbackResult;
}): WebGpuAppPickReport {
  return {
    ok: input.entity !== null && input.diagnostics.length === 0,
    x: input.x,
    y: input.y,
    width: input.dimensions.width,
    height: input.dimensions.height,
    id: input.id,
    entity: input.entity,
    diagnostics: input.diagnostics,
    ...(input.readback === undefined ? {} : { readback: input.readback }),
  };
}

function hasReadyStandardShadowReceiverResources(
  resources: StandardFrameShadowReceiverResources | undefined,
): resources is StandardFrameShadowReceiverResources {
  if (resources?.shadowKind === "multi") {
    return (
      hasReadyStandardShadowReceiverResourceSet(resources) &&
      hasReadyStandardShadowReceiverResourceSet(
        resources.spotShadowReceiverResources,
      ) &&
      hasReadyStandardShadowReceiverResourceSet(
        resources.pointShadowReceiverResources,
      )
    );
  }

  return hasReadyStandardShadowReceiverResourceSet(resources);
}

function hasReadyStandardShadowReceiverResourceSet(
  resources:
    | Pick<
        StandardFrameShadowReceiverResources,
        "matrixBufferResource" | "depthTextureResources" | "samplerResource"
      >
    | undefined,
): boolean {
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
    ) === true
  );
}

function withStandardShadowPipelineKeys(
  snapshot: RenderSnapshot,
  shadowKind:
    | "directional"
    | "directional-cascaded"
    | "point"
    | "spot"
    | "multi" = "directional",
): RenderSnapshot {
  let changed = false;
  const shadowFeatures =
    shadowKind === "multi"
      ? ["shadowMap", "pointShadowMap"]
      : shadowKind === "point"
        ? ["pointShadowMap"]
        : shadowKind === "directional-cascaded"
          ? ["shadowMap", "cascadedShadowMap"]
          : ["shadowMap"];
  const meshDraws = snapshot.meshDraws.map((draw) => {
    let pipelineKey = draw.batchKey.pipelineKey;

    if (
      draw.receivesShadow === false ||
      !pipelineKey.startsWith("standard|") ||
      shadowFeatures.every((feature) => pipelineKey.includes(`|${feature}|`))
    ) {
      return draw;
    }

    changed = true;

    for (const shadowFeature of shadowFeatures) {
      if (!pipelineKey.includes(`|${shadowFeature}|`)) {
        pipelineKey = pipelineKey.replace(
          /^standard\|/,
          `standard|${shadowFeature}|`,
        );
      }
    }

    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey },
      sortKey: { ...draw.sortKey, pipelineKey },
    };
  });

  return changed ? { ...snapshot, meshDraws } : snapshot;
}

function standardShadowPipelineKind(
  resources: StandardFrameShadowReceiverResources,
): "directional" | "directional-cascaded" | "point" | "spot" | "multi" {
  if (resources.shadowKind !== undefined) {
    return resources.shadowKind;
  }

  return resources.depthTextureResources.resources.some(
    (resource) =>
      resource.viewDimension === "2d-array" &&
      (resource.layerCount ?? resource.faceCount) > 1,
  )
    ? "directional-cascaded"
    : "directional";
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
  assets: AssetRegistry,
  snapshot: RenderSnapshot,
): WebGpuAppMaterialDependencyDiagnostic[] {
  const diagnostics: WebGpuAppMaterialDependencyDiagnostic[] = [];
  const seenMaterialKeys = new Set<string>();

  for (const draw of snapshot.meshDraws) {
    pushMaterialDependencyDiagnostic(assets, draw.material, {
      diagnostics,
      seenMaterialKeys,
    });
  }

  if (
    diagnostics.length === 0 &&
    snapshot.diagnostics.some(isMaterialDependencyRenderDiagnostic)
  ) {
    for (const entry of assets.list({ kind: "material", status: "ready" })) {
      if (entry.asset === null) {
        continue;
      }

      pushMaterialDependencyDiagnostic(
        assets,
        entry.handle as Parameters<
          typeof createMaterialDependencyReadinessReport
        >[0]["material"],
        { diagnostics, seenMaterialKeys },
      );
    }
  }

  return diagnostics;
}

function pushMaterialDependencyDiagnostic(
  assets: AssetRegistry,
  material: Parameters<
    typeof createMaterialDependencyReadinessReport
  >[0]["material"],
  output: {
    readonly diagnostics: WebGpuAppMaterialDependencyDiagnostic[];
    readonly seenMaterialKeys: Set<string>;
  },
): void {
  const report = createMaterialDependencyReadinessReport({
    registry: assets,
    material,
  });

  if (report.ready || output.seenMaterialKeys.has(report.materialKey)) {
    return;
  }

  output.seenMaterialKeys.add(report.materialKey);
  output.diagnostics.push(createWebGpuAppMaterialDependencyDiagnostic(report));
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
    ...(report.renderTargets === undefined
      ? {}
      : { renderTargets: report.renderTargets }),
    ...(report.postEffects === undefined
      ? {}
      : { postEffects: report.postEffects }),
    ...(report.readback === undefined
      ? {}
      : { readback: toWebGpuAppJsonValue(report.readback) }),
    ...(report.gpuTimings === undefined
      ? {}
      : { gpuTimings: report.gpuTimings }),
    ...(materialDependencyReadiness.length === 0
      ? {}
      : { materialDependencyReadiness }),
  };
}

export function webGpuAppPickReportToJsonValue(
  report: WebGpuAppPickReport,
): WebGpuAppPickReportJsonValue {
  return {
    ok: report.ok,
    x: report.x,
    y: report.y,
    width: report.width,
    height: report.height,
    id: report.id,
    entity: report.entity,
    diagnostics: report.diagnostics.map((diagnostic) =>
      toWebGpuAppJsonValue(diagnostic),
    ),
    ...(report.readback === undefined
      ? {}
      : { readback: toWebGpuAppJsonValue(report.readback) }),
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
  readonly boundaries?: readonly FrameBoundaryAssemblyReport[];
  readonly renderTargets?: readonly WebGpuAppRenderTargetSubmissionReport[];
  readonly postEffects?: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readback?: FrameBoundaryReadbackResult;
  readonly gpuTimings?: GpuPassTimingReport;
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
      spriteDraws: input.snapshot.spriteDraws?.length ?? 0,
      skyboxes: input.snapshot.skyboxes?.length ?? 0,
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
    ...(input.boundaries === undefined ? {} : { boundaries: input.boundaries }),
    ...(input.renderTargets === undefined
      ? {}
      : { renderTargets: input.renderTargets }),
    ...(input.postEffects === undefined
      ? {}
      : { postEffects: input.postEffects }),
    ...(input.depthAttachment === undefined
      ? {}
      : { depthAttachment: input.depthAttachment }),
    ...(input.readback === undefined ? {} : { readback: input.readback }),
    ...(input.gpuTimings === undefined ? {} : { gpuTimings: input.gpuTimings }),
  };
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
  const width = typeof dimensions.width === "number" ? dimensions.width : 1;
  const height = typeof dimensions.height === "number" ? dimensions.height : 1;

  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
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
