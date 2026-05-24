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
  createPackedSnapshotPreviousTransformsScratch,
  createPackedSnapshotInstanceTintsScratch,
  createPackedSnapshotViewUniformsScratch,
  createMaterialDependencyReadinessReport,
  createRenderSnapshotChangeSet,
  createRenderSnapshotUpdateSchedule,
  renderQueueSortPolicyForPhase,
  createSamplerAsset,
  materialDependencyReadinessReportToJsonValue,
  prepareSnapshotMeshes,
  prepareSnapshotMaterials,
  preparedMeshStoreSummaryToJsonValue,
  preparedMaterialStoreSummaryToJsonValue,
  writeMaterialQueueFromSnapshot,
  writePackedSnapshotPreviousTransforms,
  writePackedSnapshotTransforms,
  rememberPackedSnapshotTransformsByRenderId,
  writePackedSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotViewUniforms,
  type MaterialQueueScratch,
  type MaterialAssetDependencyReadinessReportJsonValue,
  type DebugNormalMaterialAsset,
  type MatcapMaterialAsset,
  type MaterialAsset,
  type MeshAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotPreviousTransforms,
  type PackedPreviousSnapshotTransformHistoryReport,
  type PackedSnapshotTransformHistoryUpdateReport,
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
  type RenderSnapshotChangeSet,
  type RenderSnapshotUpdateSchedule,
} from "@aperture-engine/render";
import { writeBufferData } from "./app-frame-resource-utils.js";
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
  createRenderBundleCache,
  createRenderBundleCommandKey,
  type RenderBundleCache,
  type RenderBundleExecutionReport,
} from "./render-bundle.js";
import {
  createIndirectDrawCommandCache,
  prepareIndirectDrawCommands,
  type IndirectDrawCommandCache,
  type IndirectDrawCommandReport,
} from "./indirect-draw-commands.js";
import {
  createGpuPassTimingReport,
  createGpuTimestampQueryResourcesChecked,
  readGpuTimestampQueryResults,
  type GpuPassTimingReport,
  type GpuTimestampQueryDiagnostic,
  type GpuTimestampQueryDeviceLike,
  type GpuTimestampQueryResources,
} from "./gpu-timing.js";
import {
  createGpuOcclusionFeedbackState,
  createGpuOcclusionQueryResources,
  planGpuOcclusionFeedbackCulling,
  readGpuOcclusionQueryResults,
  updateGpuOcclusionFeedbackState,
  type GpuOcclusionFeedbackFallbackReason,
  type GpuOcclusionFeedbackState,
  type GpuOcclusionQueryDiagnostic,
  type GpuOcclusionQueryDeviceLike,
  type GpuOcclusionQueryReadbackResult,
  type GpuOcclusionQueryResources,
} from "./occlusion-query.js";
import type { CurrentTextureLike } from "./current-texture-view.js";
import {
  createOrReuseWebGpuDepthTexture,
  createWebGpuDepthTextureCacheSlot,
  WEBGPU_APP_DEPTH_FORMAT,
  type CachedWebGpuDepthTextureResource,
  type WebGpuDepthTextureCacheSlot,
} from "./depth-texture-resource.js";
import {
  createOrReuseWebGpuMsaaColorTexture,
  createWebGpuMsaaColorTextureCacheSlot,
  resolveWebGpuMsaaConfig,
  type CachedWebGpuMsaaColorTextureResource,
  type WebGpuMsaaColorTextureCacheSlot,
  type WebGpuMsaaConfig,
} from "./msaa.js";
import { createWebGpuBuffer } from "./buffer.js";
import type { BindGroupResourceCache } from "./bind-group-resource-cache.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";
import { createLightBindGroupLayoutDescriptor } from "./light-bind-group-layout.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import type { LightBindGroupResource } from "./light-bind-group.js";
import {
  STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
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
  type StandardLightShadowBindGroupResource,
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
  readWebGpuAppSnapshotChangeSet,
  readWebGpuAppSharedSnapshot,
  type WebGpuAppSharedSnapshotTransportOptions,
  type WebGpuAppSnapshotTransportDiagnostics,
  type WebGpuAppSnapshotTransportMode,
} from "./app-snapshot-transport.js";
import {
  createDirectLightReadinessReport,
  directLightReadinessResourceStateFromStandardFrameResources,
} from "./direct-light-readiness.js";
import {
  CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
  CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE,
  createLocalLightClusterDescriptor,
  localLightClusterReportFromDescriptor,
  snapshotShouldUseClusteredLocalLights,
  type LocalLightClusterGpuResource,
  type LocalLightClusterReport,
} from "./local-light-clusters.js";
import {
  prepareLocalLightClusterCookieResources,
  type LocalLightClusterCookieMatrixResource,
  type LocalLightClusterCookieResources,
} from "./local-light-cookie-resources.js";
import { createStandardMaterialBindGroupLayoutPlan } from "./standard-bind-group-layout.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";
import {
  createOrReuseStandardAppFrameResources,
  createStandardAppFrameResourceCacheSlot,
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
  StandardFrameTransmissionSceneColorResources,
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
  type UnlitBindGroupResource,
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
  createRenderFrameQueueDiagnosticsSummary,
  createRenderFramePlanScratch,
  writeRenderFramePlanFromSnapshot,
  type PlanRenderFrameFromSnapshotResult,
  type RenderFramePlanScratch,
} from "./render-frame-plan.js";
import type {
  RenderPassCommand,
  RenderPassCommandPressureReport,
} from "./render-pass-commands.js";
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
  type WebGpuPostPassDepthTextureResource,
  type WebGpuPostPassTextureCacheSlot,
  type WebGpuPostPassTextureResource,
  type WebGpuPreparedPostEffectGraph,
} from "./post-pass.js";
import {
  createWorldTransformBufferDescriptorScratch,
  createWorldTransformGpuBuffer,
  writeWorldTransformBufferDescriptor,
  type WorldTransformBufferDescriptorScratch,
  type WorldTransformGpuBufferResource,
} from "./world-transform-buffer.js";
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
  readonly snapshotChangeSet?: RenderSnapshotChangeSet;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
}

interface WebGpuAppFrameRenderOptions extends WebGpuAppRenderOptions {
  readonly previousSnapshotForUpdate?: RenderSnapshot | null;
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
  readonly fogs: number;
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

export interface WebGpuAppMsaaReport {
  readonly requestedSampleCount: number;
  readonly sampleCount: number;
  readonly enabled: boolean;
  readonly clamped: boolean;
  readonly supportedSampleCounts: readonly number[];
  readonly colorTargets: number;
  readonly colorTexturesCreated: number;
  readonly colorTexturesReused: number;
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
  readonly msaaSampleCount?: number;
}

export interface WebGpuAppPostEffectSubmissionReport {
  readonly effectId: string;
  readonly label: string;
  readonly viewId: number;
  readonly input: string;
  readonly output: "swapchain" | "offscreen";
  readonly ok: boolean;
  readonly drawCalls: number;
  readonly graph?: WebGpuAppPostEffectGraphSubmissionReport;
}

export interface WebGpuAppPostEffectGraphSubmissionReport {
  readonly topology: "single-pass" | "downsample-upsample";
  readonly passCount: number;
  readonly resourceCount: number;
  readonly downsamplePasses: number;
  readonly upsamplePasses: number;
  readonly compositePasses: number;
  readonly levels: readonly {
    readonly width: number;
    readonly height: number;
  }[];
}

export interface WebGpuAppTransmissionGrabPassReport {
  readonly enabled: boolean;
  readonly ok: boolean;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly commands: number;
  readonly drawCalls: number;
  readonly textureResourceKey: string;
  readonly samplerResourceKey: string;
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
  queuedBindGroupsCreated: number;
  queuedBindGroupsReused: number;
  queuedBindGroupCacheSize: number;
  lightBuffersCreated: number;
  lightBuffersReused: number;
  localLightClusterBuffersCreated: number;
  localLightClusterBuffersReused: number;
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
  readonly snapshotChangeSet?: RenderSnapshotChangeSet;
  readonly snapshotUpdateSchedule?: RenderSnapshotUpdateSchedule;
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
  readonly transmissionGrabPass?: WebGpuAppTransmissionGrabPassReport;
  readonly msaa?: WebGpuAppMsaaReport;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readback?: FrameBoundaryReadbackResult;
  readonly gpuTimings?: GpuPassTimingReport;
  readonly commandPressure?: RenderPassCommandPressureReport;
  readonly renderBundles?: WebGpuAppRenderBundleReport;
  readonly indirectDraws?: IndirectDrawCommandReport;
  readonly motionVectors?: WebGpuAppMotionVectorReport;
  readonly localLightClusters?: LocalLightClusterReport;
  readonly occlusionQueries?: WebGpuAppOcclusionQueryReport;
}

export type WebGpuAppMotionVectorStatus =
  | "disabled"
  | "scene-attachment"
  | "fallback-clear";

export type WebGpuAppMotionVectorFallbackReason =
  | "not-required"
  | "msaa"
  | "unsupported-scene-packets"
  | "unsupported-target"
  | "missing-previous-object-transform-buffer";

export interface WebGpuAppMotionVectorObjectTransformHistoryReport {
  readonly available: boolean;
  readonly resourceKey: string | null;
  readonly total: number;
  readonly used: number;
  readonly fallback: number;
  readonly missing: readonly number[];
  readonly stored: number;
  readonly staleRemoved: number;
}

export interface WebGpuAppMotionVectorReport {
  readonly required: boolean;
  readonly status: WebGpuAppMotionVectorStatus;
  readonly colorFormat: string | null;
  readonly fallbackReason?: WebGpuAppMotionVectorFallbackReason;
  readonly objectTransforms: WebGpuAppMotionVectorObjectTransformHistoryReport;
}

export interface WebGpuAppOcclusionQueryReport {
  readonly status: "inactive" | "ready" | "unsupported";
  readonly queryCount: number;
  readonly queryCandidateDraws: number;
  readonly queriedDraws: number;
  readonly resolvedQueryResults: number;
  readonly skippedFromQuery: number;
  readonly skippedRenderIds: readonly number[];
  readonly forcedProbeDraws: number;
  readonly forcedProbeRenderIds: readonly number[];
  readonly fallbackReason: GpuOcclusionFeedbackFallbackReason | null;
  readonly testedRenderIds: readonly number[];
  readonly visibleRenderIds: readonly number[];
  readonly occludedRenderIds: readonly number[];
  readonly sampleCounts: readonly string[];
  readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
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
  readonly renderChangeSet?: WebGpuAppJsonValue;
  readonly renderUpdateSchedule?: WebGpuAppJsonValue;
  readonly counts: WebGpuAppRenderCounts;
  readonly diagnostics: readonly WebGpuAppJsonValue[];
  readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
  readonly resourceReuse: WebGpuAppResourceReuseReport;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly renderTargets?: readonly WebGpuAppRenderTargetSubmissionReport[];
  readonly postEffects?: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly transmissionGrabPass?: WebGpuAppTransmissionGrabPassReport;
  readonly msaa?: WebGpuAppMsaaReport;
  readonly readback?: WebGpuAppJsonValue;
  readonly gpuTimings?: GpuPassTimingReport;
  readonly commandPressure?: WebGpuAppJsonValue;
  readonly renderBundles?: WebGpuAppRenderBundleReport;
  readonly indirectDraws?: IndirectDrawCommandReport;
  readonly motionVectors?: WebGpuAppMotionVectorReport;
  readonly localLightClusters?: LocalLightClusterReport;
  readonly occlusionQueries?: WebGpuAppOcclusionQueryReport;
  readonly materialDependencyReadiness?: readonly MaterialAssetDependencyReadinessReportJsonValue[];
}

export interface WebGpuAppRenderBundleReport {
  readonly created: number;
  readonly reused: number;
  readonly unsupported: number;
  readonly failed: number;
  readonly disabled: number;
  readonly encodedCommands: number;
  readonly executedBundles: number;
  readonly drawCalls: number;
  readonly cacheSize: number;
  readonly reports: readonly WebGpuAppRenderBundleFrameReport[];
}

export interface WebGpuAppRenderBundleFrameReport {
  readonly valid: boolean;
  readonly status: RenderBundleExecutionReport["status"];
  readonly key: string | null;
  readonly commandCount: number;
  readonly encodedCommands: number;
  readonly executedBundles: number;
  readonly drawCalls: number;
  readonly cacheSize: number;
  readonly diagnostics: readonly WebGpuAppJsonValue[];
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
  readonly localLightCookieMatrices: Map<
    string,
    LocalLightClusterCookieMatrixResource
  >;
  readonly environmentResources: WebGpuEnvironmentResourceCache;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedMeshFacade: PreparedMeshStore;
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
  readonly preparedMaterialFacade: PreparedMaterialStore;
  readonly idPickPipelines: Map<string, WebGpuIdBufferPickPipelineResource>;
  readonly gpuTimings: Map<string, WebGpuAppGpuTimingCacheEntry>;
  readonly occlusionQueries: Map<string, GpuOcclusionQueryResources>;
  readonly occlusionFeedback: GpuOcclusionFeedbackState;
  readonly renderBundles: RenderBundleCache;
  readonly indirectDraws: IndirectDrawCommandCache;
  readonly postPasses: WebGpuAppPostPassCache;
  readonly frameScratch: WebGpuAppFrameScratch;
  readonly unlitFrame: UnlitAppFrameResourceCacheSlot;
  readonly matcapFrame: MatcapAppFrameResourceCacheSlot;
  readonly standardFrame: StandardAppFrameResourceCacheSlot;
  readonly debugNormalFrame: DebugNormalAppFrameResourceCacheSlot;
  readonly depth: WebGpuDepthTextureCacheSlot;
  readonly depthByRenderTarget: Map<string, WebGpuDepthTextureCacheSlot>;
  readonly msaaColor: WebGpuMsaaColorTextureCacheSlot;
  readonly msaaColorByRenderTarget: Map<
    string,
    WebGpuMsaaColorTextureCacheSlot
  >;
}

interface WebGpuAppPostPassCache {
  readonly scene: WebGpuPostPassTextureCacheSlot;
  readonly ping: WebGpuPostPassTextureCacheSlot;
  readonly pong: WebGpuPostPassTextureCacheSlot;
  readonly motionVector: WebGpuPostPassTextureCacheSlot;
  readonly transmissionGrab: WebGpuPostPassTextureCacheSlot;
  readonly previousViewProjectionByViewId: Map<number, Float32Array>;
  readonly previousWorldTransformsByRenderId: Map<number, Float32Array>;
  readonly previousWorldTransformsScratch: ReturnType<
    typeof createPackedSnapshotPreviousTransformsScratch
  >;
  readonly previousWorldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
  previousWorldTransformResource: WorldTransformGpuBufferResource | null;
  previousWorldTransformByteLength: number;
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
  readonly occlusionFallbackCommands: RenderPassCommand[];
  readonly occlusionCulledCommands: RenderPassCommand[];
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
  readonly msaa: WebGpuMsaaConfig;
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
  readonly msaa?: number;
  readonly msaaSampleCount?: number;
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
  const msaa = resolveWebGpuMsaaConfig(options.msaa ?? options.msaaSampleCount);
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
  let previousSnapshotForUpdate: RenderSnapshot | null = null;
  let latestPickReport: WebGpuAppPickReport | null = null;
  let latestWorkerError: WebGpuAppWorkerRenderErrorDiagnostic | null = null;

  const app: WebGpuApp = {
    canvas: options.canvas,
    initialization,
    renderWorld,
    tonemap,
    outputColorSpace,
    msaa,
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
            const snapshotChangeSet = readWebGpuAppSnapshotChangeSet(
              event.message,
            );

            await app.renderSnapshot(snapshot, {
              frame: snapshot.frame,
              ...(snapshotChangeSet === null ? {} : { snapshotChangeSet }),
            });
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
        {
          ...renderOptions,
          snapshot,
          previousSnapshotForUpdate,
        },
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
      previousSnapshotForUpdate = report.snapshot;
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
      skyboxes: 0,
      fogs: 0,
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
    localLightCookieMatrices: new Map(),
    environmentResources: createWebGpuEnvironmentResourceCache(),
    preparedMeshes: createPreparedMeshGpuResourceCache(),
    preparedMeshFacade: createPreparedMeshStore(),
    preparedMaterials: createPreparedBuiltInMaterialStore(),
    preparedMaterialFacade: createPreparedMaterialStore(),
    idPickPipelines: new Map(),
    gpuTimings: new Map(),
    occlusionQueries: new Map(),
    occlusionFeedback: createGpuOcclusionFeedbackState(),
    renderBundles: createRenderBundleCache(),
    indirectDraws: createIndirectDrawCommandCache(),
    postPasses: {
      scene: createWebGpuPostPassTextureCacheSlot(),
      ping: createWebGpuPostPassTextureCacheSlot(),
      pong: createWebGpuPostPassTextureCacheSlot(),
      motionVector: createWebGpuPostPassTextureCacheSlot(),
      transmissionGrab: createWebGpuPostPassTextureCacheSlot(),
      previousViewProjectionByViewId: new Map(),
      previousWorldTransformsByRenderId: new Map(),
      previousWorldTransformsScratch:
        createPackedSnapshotPreviousTransformsScratch(),
      previousWorldTransformDescriptorScratch:
        createWorldTransformBufferDescriptorScratch(),
      previousWorldTransformResource: null,
      previousWorldTransformByteLength: 0,
    },
    frameScratch: createWebGpuAppFrameScratch(),
    unlitFrame:
      createWebGpuAppFrameResourceCacheSlot<CachedUnlitAppFrameResources>(),
    matcapFrame:
      createWebGpuAppFrameResourceCacheSlot<CachedMatcapAppFrameResources>(),
    standardFrame: createStandardAppFrameResourceCacheSlot(),
    debugNormalFrame:
      createWebGpuAppFrameResourceCacheSlot<CachedDebugNormalAppFrameResources>(),
    depth: createWebGpuDepthTextureCacheSlot(),
    depthByRenderTarget: new Map(),
    msaaColor: createWebGpuMsaaColorTextureCacheSlot(),
    msaaColorByRenderTarget: new Map(),
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
    occlusionFallbackCommands: [],
    occlusionCulledCommands: [],
  };
}

async function getOrCreateWebGpuAppPipeline(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly kind: WebGpuAppMaterialKind;
  readonly pipelineKey: string;
  readonly batchKey: RenderSnapshot["meshDraws"][number]["batchKey"];
  readonly motionVectorColorFormat?: string | null;
}): Promise<WebGpuAppPipelineResourceResult> {
  const key = [
    options.kind,
    options.app.initialization.format,
    `motion:${options.motionVectorColorFormat ?? "none"}`,
    WEBGPU_APP_DEPTH_FORMAT,
    `samples:${options.app.msaa.sampleCount}`,
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
          ...(options.motionVectorColorFormat === undefined
            ? {}
            : { motionVectorColorFormat: options.motionVectorColorFormat }),
          depthFormat: WEBGPU_APP_DEPTH_FORMAT,
          sampleCount: options.app.msaa.sampleCount,
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
            ...(options.motionVectorColorFormat === undefined
              ? {}
              : { motionVectorColorFormat: options.motionVectorColorFormat }),
            depthFormat: WEBGPU_APP_DEPTH_FORMAT,
            sampleCount: options.app.msaa.sampleCount,
            batchKey: options.batchKey,
          })
        : options.kind === "matcap"
          ? await createMatcapRenderPipelineResource({
              device: options.app.initialization.device as Parameters<
                typeof createMatcapRenderPipelineResource
              >[0]["device"],
              colorFormat: options.app.initialization.format,
              ...(options.motionVectorColorFormat === undefined
                ? {}
                : { motionVectorColorFormat: options.motionVectorColorFormat }),
              depthFormat: WEBGPU_APP_DEPTH_FORMAT,
              sampleCount: options.app.msaa.sampleCount,
              batchKey: options.batchKey,
            })
          : await createUnlitRenderPipelineResource({
              device: options.app.initialization.device as Parameters<
                typeof createUnlitRenderPipelineResource
              >[0]["device"],
              colorFormat: options.app.initialization.format,
              ...(options.motionVectorColorFormat === undefined
                ? {}
                : { motionVectorColorFormat: options.motionVectorColorFormat }),
              depthFormat: WEBGPU_APP_DEPTH_FORMAT,
              sampleCount: options.app.msaa.sampleCount,
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
  const usesLightCascadedShadowIblGroup = pipelineResourceKey.includes(
    STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY,
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
  const usesClusteredLocalLights =
    pipelineResourceKey.includes("cluster-params@16");
  const usesClusteredLocalLightCookies =
    pipelineResourceKey.includes("cluster-cookie");
  const usesClusteredLocalLightShadowCookies =
    pipelineResourceKey.includes("clusteredLocalLightShadowCookies") ||
    pipelineResourceKey.includes("cluster-cookie-shadow-matrix@2");
  const usesClusteredLocalLightCubeCookies = pipelineResourceKey.includes(
    "cluster-cookie-cube-texture@20",
  );
  const usesClusteredLocalLightArrayCookies = pipelineResourceKey.includes(
    "cluster-cookie-array-texture@20",
  );
  const usesClusteredLocalLightArrayShadows =
    pipelineResourceKey.includes("clusteredLocalLightArrayShadows") ||
    pipelineResourceKey.includes("directional-depth-array@3");
  const usesClusteredLocalLightPointArrayShadows =
    pipelineResourceKey.includes("clusteredLocalLightPointArrayShadows") ||
    pipelineResourceKey.includes("point-depth-array@9") ||
    (usesLightPointShadowGroup &&
      pipelineResourceKey.includes("depth-array@3"));
  const autoLayoutKeySuffix =
    (usesLightShadowGroup ||
      usesLightShadowIblGroup ||
      usesLightCascadedShadowGroup ||
      usesLightCascadedShadowIblGroup ||
      usesLightPointShadowGroup ||
      usesLightMultiShadowGroup) &&
    usesClusteredLocalLights
      ? `/pipeline:${pipelineResourceKey}`
      : "";
  const baseLightLayoutKey = usesLightShadowIblGroup
    ? "webgpu-app/standard/lights-shadow-ibl/group-3"
    : usesLightCascadedShadowIblGroup
      ? "webgpu-app/standard/lights-cascaded-shadow-ibl/group-3"
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
  const lightLayoutKey = usesClusteredLocalLights
    ? `${baseLightLayoutKey}/${
        usesClusteredLocalLightCubeCookies
          ? "clustered-local-light-cube-cookies"
          : usesClusteredLocalLightArrayCookies
            ? "clustered-local-light-array-cookies"
            : usesClusteredLocalLightCookies
              ? "clustered-local-light-cookies"
              : "clustered-local-lights"
      }`
    : baseLightLayoutKey;

  return {
    kind: "standard",
    pipelineResourceKey,
    sharedLayouts: [0, 1].map((group) => ({
      group,
      layoutKey: `webgpu-app/standard/group-${group}${autoLayoutKeySuffix}`,
      layout: getBindGroupLayout(group),
      metadata: createUnlitBindGroupLayoutMetadata(
        group,
        `webgpu-app/standard/group-${group}${autoLayoutKeySuffix}`,
      ),
    })),
    materialLayout: {
      group: 2,
      layoutKey: `webgpu-app/standard/group-2${autoLayoutKeySuffix}`,
      layout: getBindGroupLayout(2),
      descriptor: createStandardMaterialBindGroupLayoutPlan(
        `webgpu-app/standard/group-2${autoLayoutKeySuffix}`,
      ).layout,
    },
    lightLayout: {
      group: 3,
      layoutKey: `${lightLayoutKey}${autoLayoutKeySuffix}`,
      layout: getBindGroupLayout(3),
      descriptor:
        usesLightShadowIblGroup ||
        usesLightCascadedShadowIblGroup ||
        usesLightIblGroup
          ? createStandardLightIblBindGroupLayoutDescriptor({
              shadowMap:
                usesLightShadowIblGroup || usesLightCascadedShadowIblGroup,
              cascadedShadowMap: usesLightCascadedShadowIblGroup,
              specularProof: usesSpecularIblProof,
              clusteredLocalLights: usesClusteredLocalLights,
              clusteredLocalLightCookies: usesClusteredLocalLightCookies,
              clusteredLocalLightShadowCookies:
                usesClusteredLocalLightShadowCookies,
              clusteredLocalLightCookieTextureViewDimension:
                usesClusteredLocalLightCubeCookies
                  ? "cube"
                  : usesClusteredLocalLightArrayCookies
                    ? "2d-array"
                    : "2d",
            })
          : usesLightMultiShadowGroup
            ? createStandardLightMultiShadowBindGroupLayoutDescriptor({
                clusteredLocalLights: usesClusteredLocalLights,
                clusteredLocalLightArrayShadows:
                  usesClusteredLocalLightArrayShadows,
                clusteredLocalLightPointArrayShadows:
                  usesClusteredLocalLightPointArrayShadows,
                clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                clusteredLocalLightShadowCookies:
                  usesClusteredLocalLightShadowCookies,
                clusteredLocalLightCookieTextureViewDimension:
                  usesClusteredLocalLightCubeCookies
                    ? "cube"
                    : usesClusteredLocalLightArrayCookies
                      ? "2d-array"
                      : "2d",
              })
            : usesLightCascadedShadowGroup
              ? createStandardLightCascadedShadowBindGroupLayoutDescriptor({
                  clusteredLocalLights: usesClusteredLocalLights,
                  clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                  clusteredLocalLightShadowCookies:
                    usesClusteredLocalLightShadowCookies,
                  clusteredLocalLightCookieTextureViewDimension:
                    usesClusteredLocalLightCubeCookies
                      ? "cube"
                      : usesClusteredLocalLightArrayCookies
                        ? "2d-array"
                        : "2d",
                })
              : usesLightShadowGroup
                ? createStandardLightShadowBindGroupLayoutDescriptor({
                    clusteredLocalLights: usesClusteredLocalLights,
                    clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                    clusteredLocalLightShadowCookies:
                      usesClusteredLocalLightShadowCookies,
                    clusteredLocalLightCookieTextureViewDimension:
                      usesClusteredLocalLightCubeCookies
                        ? "cube"
                        : usesClusteredLocalLightArrayCookies
                          ? "2d-array"
                          : "2d",
                  })
                : usesLightPointShadowGroup
                  ? createStandardLightPointShadowBindGroupLayoutDescriptor({
                      clusteredLocalLights: usesClusteredLocalLights,
                      clusteredLocalLightPointArrayShadows:
                        usesClusteredLocalLightPointArrayShadows,
                      clusteredLocalLightCookies:
                        usesClusteredLocalLightCookies,
                      clusteredLocalLightShadowCookies:
                        usesClusteredLocalLightShadowCookies,
                      clusteredLocalLightCookieTextureViewDimension:
                        usesClusteredLocalLightCubeCookies
                          ? "cube"
                          : usesClusteredLocalLightArrayCookies
                            ? "2d-array"
                            : "2d",
                    })
                  : createLightBindGroupLayoutDescriptor({
                      group: 3,
                      label: "webgpu-app/standard/group-3",
                      clusteredLocalLights: usesClusteredLocalLights,
                      clusteredLocalLightCookies:
                        usesClusteredLocalLightCookies,
                      clusteredLocalLightCookieTextureViewDimension:
                        usesClusteredLocalLightCubeCookies
                          ? "cube"
                          : usesClusteredLocalLightArrayCookies
                            ? "2d-array"
                            : "2d",
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
          ...(options.previousWorldTransforms === undefined
            ? {}
            : { previousWorldTransforms: options.previousWorldTransforms }),
          layouts: options.layouts.sharedLayouts,
          bindGroupCache: options.sharedBindGroupCache,
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
          ...(options.previousWorldTransforms === undefined
            ? {}
            : { previousWorldTransforms: options.previousWorldTransforms }),
          ...(options.instanceTints === undefined
            ? {}
            : { instanceTints: options.instanceTints }),
          sharedLayouts: options.layouts.sharedLayouts,
          materialLayout: options.layouts
            .materialLayout as MatcapMaterialBindGroupLayoutResource | null,
          bindGroupCache: options.sharedBindGroupCache,
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
          ...(options.previousWorldTransforms === undefined
            ? {}
            : { previousWorldTransforms: options.previousWorldTransforms }),
          ...(options.instanceTints === undefined
            ? {}
            : { instanceTints: options.instanceTints }),
          sharedLayouts: options.layouts.sharedLayouts,
          materialLayout: options.layouts
            .materialLayout as StandardMaterialBindGroupLayoutResource | null,
          lightLayout: options.layouts.lightLayout,
          sharedBindGroupCache: options.sharedBindGroupCache,
          lightBindGroupCache: options.lightBindGroupCache,
          standardLightShadowBindGroupCache:
            options.standardLightShadowBindGroupCache,
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
          ...(options.localLightCookieResources === undefined ||
          options.localLightCookieResources === null
            ? {}
            : {
                localLightCookieResources: options.localLightCookieResources,
              }),
          ...(options.transmissionSceneColorResources === undefined ||
          options.transmissionSceneColorResources === null
            ? {}
            : {
                transmissionSceneColorResources:
                  options.transmissionSceneColorResources,
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
          ...(options.previousWorldTransforms === undefined
            ? {}
            : { previousWorldTransforms: options.previousWorldTransforms }),
          sharedLayouts: options.layouts.sharedLayouts,
          materialLayout: options.layouts
            .materialLayout as DebugNormalMaterialBindGroupLayoutResource | null,
          bindGroupCache: options.sharedBindGroupCache,
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
  readonly transmissionGrabPass?: WebGpuAppTransmissionGrabPassReport;
  readonly msaa?: WebGpuAppMsaaReport;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly renderBundles?: WebGpuAppRenderBundleReport;
  readonly readbackBoundary: FrameBoundaryAssemblyReport | null;
  readonly gpuTimingReadbacks: readonly WebGpuAppGpuTimingReadback[];
  readonly gpuTimingDiagnostics: readonly GpuTimestampQueryDiagnostic[];
  readonly occlusionQueryReadbacks: readonly WebGpuAppOcclusionQueryReadback[];
  readonly occlusionQueryDiagnostics: readonly GpuOcclusionQueryDiagnostic[];
  readonly occlusionCulling: WebGpuAppOcclusionCullingReport;
  readonly occlusionQueryCount: number;
  readonly plannedCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: readonly unknown[];
}

interface WebGpuAppOcclusionCullingReport {
  queryCandidateDraws: number;
  queriedDraws: number;
  skippedFromQuery: number;
  readonly skippedRenderIds: number[];
  forcedProbeDraws: number;
  readonly forcedProbeRenderIds: number[];
  fallbackReason: GpuOcclusionFeedbackFallbackReason | null;
}

interface WebGpuAppGpuTimingReadback {
  readonly passName: string;
  readonly resources: GpuTimestampQueryResources;
}

interface WebGpuAppOcclusionQueryReadback {
  readonly passName: string;
  readonly viewId: number;
  readonly resources: GpuOcclusionQueryResources;
  readonly renderIds: readonly number[];
}

interface WebGpuAppMsaaColorTargetResult {
  readonly valid: boolean;
  readonly status: "created" | "reused" | "disabled" | "failed";
  readonly resource: CachedWebGpuMsaaColorTextureResource | null;
  readonly diagnostics: readonly unknown[];
}

interface WebGpuAppTransmissionGrabResourcesResult {
  readonly valid: boolean;
  readonly resources: StandardFrameTransmissionSceneColorResources | null;
  readonly diagnostics: readonly unknown[];
}

async function renderQueuedBuiltInWebGpuAppFrame(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly snapshotChangeSet: RenderSnapshotChangeSet;
  readonly snapshotUpdateSchedule: RenderSnapshotUpdateSchedule;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly localLightCookieResources?:
    | LocalLightClusterCookieResources
    | null
    | undefined;
}): Promise<WebGpuAppRenderReport> {
  const sceneMotionVectors = createWebGpuAppSceneMotionVectorPlan({
    app: options.app,
    assets: options.assets,
    snapshot: options.snapshot,
  });
  const packedViews = writePackedSnapshotViewUniforms(
    options.snapshot,
    options.cache.frameScratch.viewUniforms,
    {
      previousViewProjectionByViewId:
        options.cache.postPasses.previousViewProjectionByViewId,
    },
  );
  const packedTransforms = writePackedSnapshotTransforms(
    options.snapshot,
    options.cache.frameScratch.worldTransforms,
  );
  const previousObjectTransforms =
    prepareWebGpuAppPreviousObjectTransformResource({
      device: options.app.initialization.device,
      cache: options.cache.postPasses,
      currentTransforms: packedTransforms,
      required: sceneMotionVectors.colorFormat !== null,
    });
  const motionVectorColorFormat =
    sceneMotionVectors.colorFormat !== null &&
    previousObjectTransforms.resource === null
      ? null
      : sceneMotionVectors.colorFormat;
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
  const transmissionGrabResources = createWebGpuAppTransmissionGrabResources({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    required: snapshotUsesTransmission(options.snapshot),
  });

  if (!standardAreaLightLtc.valid || !transmissionGrabResources.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      resourceReuse: options.reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...previousObjectTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...standardAreaLightLtc.diagnostics,
        ...transmissionGrabResources.diagnostics,
      ],
    });
  }

  const prepared = await prepareQueuedBuiltInFrameResources({
    ...options,
    motionVectorColorFormat,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    ...(previousObjectTransforms.resource === null
      ? {}
      : { previousWorldTransforms: previousObjectTransforms.resource }),
    instanceTints: packedInstanceTints,
    standardAreaLightLtcResources: standardAreaLightLtc.resources,
    localLightCookieResources: options.localLightCookieResources,
    transmissionSceneColorResources: transmissionGrabResources.resources,
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
        ...previousObjectTransforms.diagnostics,
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
        ...previousObjectTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...queue.diagnostics,
      ],
    });
  }

  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot: options.snapshot,
    snapshotChangeSet: options.snapshotChangeSet,
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
  const frameDiagnosticsSummary = createQueuedBuiltInAppDiagnosticsSummary({
    snapshot: options.snapshot,
    resourceSet: options.resourceSet,
    resources: prepared.resources,
    framePlan,
  });
  const spriteFrame = await prepareSpriteFrameResourcesForSnapshot({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    reuse: options.reuse,
  });

  if (!spriteFrame.resources.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      resourceReuse: options.reuse,
      diagnosticsSummary: frameDiagnosticsSummary,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...spriteFrame.resources.diagnostics,
      ],
    });
  }

  const frameCommands =
    spriteFrame.resources.commands.length === 0
      ? framePlan.commandPlan.commands
      : [...framePlan.commandPlan.commands, ...spriteFrame.resources.commands];
  const indirectDraws = prepareWebGpuAppIndirectDrawCommands({
    app: options.app,
    cache: options.cache,
    commands: frameCommands,
    label: options.label ?? "aperture-webgpu-app",
  });
  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    commands: indirectDraws.commands,
    label: options.label ?? "aperture-webgpu-app",
    reuse: options.reuse,
    motionVectorColorFormat,
    transmissionSceneColorResources: transmissionGrabResources.resources,
    enableRenderBundles: shouldUseRenderBundlesForSnapshotSchedule(
      options.snapshotUpdateSchedule,
    ),
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
  });
  rememberCurrentViewProjectionMatrices(
    options.snapshot,
    options.cache.postPasses.previousViewProjectionByViewId,
  );
  const motionVectorHistoryUpdate =
    sceneMotionVectors.required && previousObjectTransforms.resource !== null
      ? rememberPackedSnapshotTransformsByRenderId(
          packedTransforms,
          options.cache.postPasses.previousWorldTransformsByRenderId,
        )
      : { stored: 0, staleRemoved: 0 };
  const motionVectorReport = createWebGpuAppMotionVectorReport({
    plan: sceneMotionVectors,
    objectHistory: previousObjectTransforms.history,
    resource: previousObjectTransforms.resource,
    update: motionVectorHistoryUpdate,
  });

  await waitForSubmittedWork(options.app.initialization.device);
  const gpuTimings = await readWebGpuAppGpuTimings({
    readbacks: boundaries.gpuTimingReadbacks,
    diagnostics: boundaries.gpuTimingDiagnostics,
  });
  const occlusionQueries = await readWebGpuAppOcclusionQueries({
    readbacks: boundaries.occlusionQueryReadbacks,
    diagnostics: boundaries.occlusionQueryDiagnostics,
    queryCount: boundaries.occlusionQueryCount,
    frame: options.snapshot.frame,
    feedbackState: options.cache.occlusionFeedback,
    culling: boundaries.occlusionCulling,
  });
  const finalDiagnosticsSummary =
    gpuTimings === undefined
      ? frameDiagnosticsSummary
      : createWebGpuAppDiagnosticsSummaryWithGpuTimings(
          frameDiagnosticsSummary,
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
    spriteFrame.resources.diagnostics.length === 0 &&
    boundaries.valid &&
    (occlusionQueries === undefined ||
      occlusionQueries.status !== "unsupported");
  const readback = await mapFrameBoundaryReadbackSamples(
    boundaries.readbackBoundary?.readback,
    frameOk,
  );

  return renderReport({
    ok: frameOk,
    snapshot: options.snapshot,
    snapshotChangeSet: options.snapshotChangeSet,
    snapshotUpdateSchedule: options.snapshotUpdateSchedule,
    pipeline: prepared.firstPipeline,
    resources: prepared.resourcesResult,
    boundary: boundaries.boundary,
    boundaries: boundaries.boundaries,
    renderTargets: boundaries.renderTargets,
    postEffects: boundaries.postEffects,
    motionVectors: motionVectorReport,
    ...(boundaries.renderBundles === undefined
      ? {}
      : { renderBundles: boundaries.renderBundles }),
    ...(boundaries.transmissionGrabPass === undefined
      ? {}
      : { transmissionGrabPass: boundaries.transmissionGrabPass }),
    ...(boundaries.msaa === undefined ? {} : { msaa: boundaries.msaa }),
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    ...(gpuTimings === undefined ? {} : { gpuTimings }),
    ...(occlusionQueries === undefined ? {} : { occlusionQueries }),
    ...(indirectDraws.report.status === "skipped"
      ? {}
      : { indirectDraws: indirectDraws.report }),
    resourceReuse: options.reuse,
    diagnosticsSummary: finalDiagnosticsSummary,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    commandPressure: framePlan.commandPlan.pressure,
    diagnostics: [
      ...options.snapshot.diagnostics,
      ...previousObjectTransforms.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...spriteFrame.resources.diagnostics,
      ...boundaries.diagnostics,
      ...newOcclusionQueryDiagnostics(
        occlusionQueries,
        boundaries.occlusionQueryDiagnostics,
      ),
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
  readonly motionVectorColorFormat?: string | null;
  readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null;
  readonly clearColor?: readonly number[];
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly enableRenderBundles?: boolean;
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
      occlusionQueryReadbacks: [],
      occlusionQueryDiagnostics: [],
      occlusionCulling: createWebGpuAppOcclusionCullingReport(),
      occlusionQueryCount: 0,
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
  const occlusionQueryReadbacks: WebGpuAppOcclusionQueryReadback[] = [];
  const occlusionQueryDiagnostics: GpuOcclusionQueryDiagnostic[] = [];
  const occlusionCulling = createWebGpuAppOcclusionCullingReport();
  let transmissionGrabPassReport:
    | WebGpuAppTransmissionGrabPassReport
    | undefined;
  let plannedCommands = 0;
  let drawCalls = 0;
  let occlusionQueryCount = 0;
  let msaaColorTargets = 0;
  let msaaColorTexturesCreated = 0;
  let msaaColorTexturesReused = 0;
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
    const commandsForView = writeCommandsForView(
      options.commands,
      options.snapshot,
      target.view,
      options.cache.frameScratch.viewCommands,
      skybox.commands,
    );
    const occlusionCandidateRenderIds =
      collectOcclusionQueryRenderIds(commandsForView);
    const occlusionCullingPlan = planGpuOcclusionFeedbackCulling({
      state: options.cache.occlusionFeedback,
      viewId: target.view.viewId,
      frame: options.snapshot.frame,
      candidateRenderIds: occlusionCandidateRenderIds,
    });
    appendWebGpuAppOcclusionCullingPlan(occlusionCulling, occlusionCullingPlan);
    const commands = commandsWithoutSkippedOcclusionDraws(
      commandsForView,
      occlusionCullingPlan.skippedRenderIds,
      options.cache.frameScratch.occlusionCulledCommands,
    );
    const occlusionRenderIds = normalizeOcclusionQueryCommands(commands);
    occlusionCulling.queriedDraws += occlusionRenderIds.length;
    const occlusionQueries =
      occlusionRenderIds.length === 0
        ? null
        : createWebGpuAppOcclusionQueryResources({
            app: options.app,
            cache: options.cache,
            label: options.label,
            target,
            queryCount: occlusionRenderIds.length,
          });
    const commandsForBoundary =
      occlusionRenderIds.length > 0 && occlusionQueries?.resources === null
        ? commandsWithoutOcclusionQueryCommands(
            commands,
            options.cache.frameScratch.occlusionFallbackCommands,
          )
        : commands;

    if (occlusionRenderIds.length > 0 && occlusionQueries?.resources === null) {
      recordWebGpuAppOcclusionCullingFallback(occlusionCulling, "unsupported");
    }
    occlusionQueryCount += occlusionRenderIds.length;
    occlusionQueryDiagnostics.push(...(occlusionQueries?.diagnostics ?? []));
    diagnostics.push(...(occlusionQueries?.diagnostics ?? []));
    allTargetsValid &&= occlusionQueries === null || occlusionQueries.valid;
    diagnostics.push(...skybox.diagnostics);
    allTargetsValid &&= skybox.valid;
    const depthAttachment = createWebGpuAppDepthAttachmentForTarget(
      options.app,
      options.cache,
      target,
    );
    const msaaColorTarget = createWebGpuAppMsaaColorTargetForTarget(
      options.app,
      options.cache,
      target,
    );
    diagnostics.push(...msaaColorTarget.diagnostics);
    allTargetsValid &&= msaaColorTarget.valid;

    if (msaaColorTarget.resource !== null) {
      msaaColorTargets += 1;

      if (msaaColorTarget.status === "created") {
        msaaColorTexturesCreated += 1;
      } else if (msaaColorTarget.status === "reused") {
        msaaColorTexturesReused += 1;
      }
    }

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
        commands: commandsForBoundary,
        depthAttachment,
        effects: activePostEffects,
        label: options.label,
        clearColor: options.clearColor ?? target.view.clearColor,
        ...(options.motionVectorColorFormat === undefined
          ? {}
          : { motionVectorColorFormat: options.motionVectorColorFormat }),
        ...(msaaColorTarget.resource === null
          ? {}
          : {
              msaaColorTarget: {
                view: msaaColorTarget.resource.view,
                sampleCount: msaaColorTarget.resource.sampleCount,
              },
            }),
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
        ...(occlusionQueries?.resources === undefined ||
        occlusionQueries.resources === null
          ? {}
          : {
              occlusionQueries: {
                resources: occlusionQueries.resources,
                queryCount: occlusionRenderIds.length,
              },
            }),
      });
      const sceneOcclusionQueries =
        postTarget.boundaries[0]?.occlusionQueries ?? null;

      for (const boundary of postTarget.boundaries) {
        occlusionQueryDiagnostics.push(
          ...(boundary.occlusionQueries?.diagnostics ?? []),
        );
      }

      if (
        occlusionQueries?.resources !== undefined &&
        occlusionQueries.resources !== null &&
        sceneOcclusionQueries?.valid === true
      ) {
        occlusionQueryReadbacks.push({
          passName: gpuTiming.passName,
          viewId: target.view.viewId,
          resources: occlusionQueries.resources,
          renderIds: [...occlusionRenderIds],
        });
      }

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

    const transmissionGrabPass =
      options.transmissionSceneColorResources === undefined ||
      options.transmissionSceneColorResources === null
        ? null
        : assembleWebGpuAppTransmissionGrabPass({
            app: options.app,
            target,
            commands: commandsForBoundary,
            depthAttachment,
            label: options.label,
            clearColor: options.clearColor ?? target.view.clearColor,
            resources: options.transmissionSceneColorResources,
          });

    if (transmissionGrabPass !== null) {
      firstBoundary ??= transmissionGrabPass.boundary;
      boundaries.push(transmissionGrabPass.boundary);
      plannedCommands += transmissionGrabPass.report.commands;
      drawCalls += transmissionGrabPass.report.drawCalls;
      allTargetsValid &&= transmissionGrabPass.boundary.valid;
      transmissionGrabPassReport = transmissionGrabPass.report;
      diagnostics.push(...transmissionGrabPass.diagnostics);
    }

    const sampleCount = msaaColorTarget.resource?.sampleCount ?? 1;
    const renderBundleDescriptor = {
      colorFormats: [target.format],
      depthStencilFormat: WEBGPU_APP_DEPTH_FORMAT,
      sampleCount,
    };
    const renderBundleKey = createRenderBundleCommandKey(
      {
        targetKey: createWebGpuAppRenderBundleTargetKey(target, sampleCount),
        ...renderBundleDescriptor,
        commands: commandsForBoundary,
      },
      options.cache.renderBundles,
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
      commands: commandsForBoundary,
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
      ...(commandsForBoundary.length === 0 ||
      options.enableRenderBundles === false ||
      occlusionRenderIds.length > 0
        ? {}
        : {
            renderBundle: {
              cache: options.cache.renderBundles,
              key: renderBundleKey,
              descriptor: renderBundleDescriptor,
            },
          }),
      ...(msaaColorTarget.resource === null
        ? {}
        : {
            msaaColorTarget: {
              view: msaaColorTarget.resource.view,
              sampleCount: msaaColorTarget.resource.sampleCount,
            },
          }),
      ...(gpuTiming.resources === null
        ? {}
        : {
            gpuTiming: {
              passName: gpuTiming.passName,
              resources: gpuTiming.resources,
            },
          }),
      ...(occlusionQueries?.resources === undefined ||
      occlusionQueries.resources === null
        ? {}
        : {
            occlusionQueries: {
              resources: occlusionQueries.resources,
              queryCount: occlusionRenderIds.length,
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
    occlusionQueryDiagnostics.push(
      ...(boundary.occlusionQueries?.diagnostics ?? []),
    );

    if (
      occlusionQueries?.resources !== undefined &&
      occlusionQueries.resources !== null &&
      boundary.occlusionQueries?.valid === true
    ) {
      occlusionQueryReadbacks.push({
        passName: gpuTiming.passName,
        viewId: target.view.viewId,
        resources: occlusionQueries.resources,
        renderIds: [...occlusionRenderIds],
      });
    }

    renderTargets.push({
      viewId: target.view.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      format: target.format,
      ok: boundary.valid,
      drawCalls: boundary.execution?.drawCalls ?? 0,
      ...(msaaColorTarget.resource === null
        ? {}
        : { msaaSampleCount: msaaColorTarget.resource.sampleCount }),
    });
    plannedCommands += commandsForBoundary.length;
    drawCalls += countDrawCommands(commandsForBoundary);
    diagnostics.push(
      ...boundary.texture.diagnostics,
      ...(boundary.attachments?.diagnostics ?? []),
      ...(boundary.encoder?.diagnostics ?? []),
      ...(boundary.begin?.diagnostics ?? []),
      ...(boundary.execution?.diagnostics ?? []),
      ...(boundary.renderBundle?.diagnostics ?? []),
      ...(boundary.end?.diagnostics ?? []),
      ...(boundary.occlusionQueries?.diagnostics ?? []),
      ...(boundary.finish?.diagnostics ?? []),
      ...(boundary.submit?.diagnostics ?? []),
    );
  }

  const renderBundleReport = createWebGpuAppRenderBundleReport(boundaries);

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
    ...(transmissionGrabPassReport === undefined
      ? {}
      : { transmissionGrabPass: transmissionGrabPassReport }),
    ...(!options.app.msaa.enabled && !options.app.msaa.clamped
      ? {}
      : {
          msaa: createWebGpuAppMsaaReport({
            config: options.app.msaa,
            colorTargets: msaaColorTargets,
            colorTexturesCreated: msaaColorTexturesCreated,
            colorTexturesReused: msaaColorTexturesReused,
          }),
        }),
    ...(firstDepthAttachment === undefined
      ? {}
      : { depthAttachment: firstDepthAttachment }),
    ...(renderBundleReport === undefined
      ? {}
      : { renderBundles: renderBundleReport }),
    readbackBoundary,
    gpuTimingReadbacks,
    gpuTimingDiagnostics,
    occlusionQueryReadbacks,
    occlusionQueryDiagnostics,
    occlusionCulling,
    occlusionQueryCount,
    plannedCommands,
    drawCalls,
    diagnostics,
  };
}

function createWebGpuAppRenderBundleTargetKey(
  target: WebGpuAppFrameBoundaryTarget,
  sampleCount: number,
): string {
  return [
    target.source,
    target.renderTargetKey ?? "swapchain",
    `view:${target.view.viewId}`,
    `size:${target.width}x${target.height}`,
    `color:${target.format}`,
    `depth:${WEBGPU_APP_DEPTH_FORMAT}`,
    `samples:${sampleCount}`,
  ].join("|");
}

function shouldUseRenderBundlesForSnapshotSchedule(
  schedule: RenderSnapshotUpdateSchedule,
): boolean {
  const meshDraws = schedule.byFamily.meshDraws.action;

  return (
    schedule.previousFrame === null ||
    meshDraws === "reuse" ||
    meshDraws === "skip"
  );
}

function prepareWebGpuAppIndirectDrawCommands(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly commands: readonly RenderPassCommand[];
  readonly label: string;
}): ReturnType<typeof prepareIndirectDrawCommands> {
  return prepareIndirectDrawCommands({
    device: options.app.initialization.device as Parameters<
      typeof prepareIndirectDrawCommands
    >[0]["device"],
    cache: options.cache.indirectDraws,
    commands: options.commands,
    label: options.label,
    supportsIndirectFirstInstance:
      options.app.initialization.adapter.features?.has?.(
        "indirect-first-instance",
      ) === true,
  });
}

function createWebGpuAppOcclusionQueryResources(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly label: string;
  readonly target: WebGpuAppFrameBoundaryTarget;
  readonly queryCount: number;
}): {
  readonly valid: boolean;
  readonly resources: GpuOcclusionQueryResources | null;
  readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
} {
  const cacheKey = [
    options.label,
    options.target.renderTargetKey ?? "swapchain",
    `view:${options.target.view.viewId}`,
  ].join(":");
  const cached = options.cache.occlusionQueries.get(cacheKey);

  if (cached !== undefined && cached.queryCount >= options.queryCount) {
    return { valid: true, resources: cached, diagnostics: [] };
  }

  const created = createGpuOcclusionQueryResources({
    device: options.app.initialization.device as GpuOcclusionQueryDeviceLike,
    label: `${options.label}:occlusion:${options.target.renderTargetKey ?? "swapchain"}:${options.target.view.viewId}`,
    queryCount: options.queryCount,
  });

  if (created.resources !== null) {
    options.cache.occlusionQueries.set(cacheKey, created.resources);
  }

  return {
    valid: created.resources !== null && created.diagnostics.length === 0,
    resources: created.resources,
    diagnostics: created.diagnostics,
  };
}

function createWebGpuAppRenderBundleReport(
  boundaries: readonly FrameBoundaryAssemblyReport[],
): WebGpuAppRenderBundleReport | undefined {
  const reports = boundaries
    .map((boundary) => boundary.renderBundle)
    .filter((report): report is RenderBundleExecutionReport => {
      return report !== undefined && report !== null;
    });

  if (
    reports.length === 0 ||
    reports.every(
      (report) =>
        (report.status === "unsupported" || report.status === "disabled") &&
        report.diagnostics.length === 0,
    )
  ) {
    return undefined;
  }

  return {
    created: countRenderBundleStatus(reports, "created"),
    reused: countRenderBundleStatus(reports, "reused"),
    unsupported: countRenderBundleStatus(reports, "unsupported"),
    failed: countRenderBundleStatus(reports, "failed"),
    disabled: countRenderBundleStatus(reports, "disabled"),
    encodedCommands: reports.reduce(
      (total, report) => total + report.encodedCommands,
      0,
    ),
    executedBundles: reports.reduce(
      (total, report) => total + report.executedBundles,
      0,
    ),
    drawCalls: reports.reduce((total, report) => total + report.drawCalls, 0),
    cacheSize: reports.reduce(
      (max, report) => Math.max(max, report.cacheSize),
      0,
    ),
    reports: reports.map((report) => ({
      valid: report.valid,
      status: report.status,
      key: report.key,
      commandCount: report.commandCount,
      encodedCommands: report.encodedCommands,
      executedBundles: report.executedBundles,
      drawCalls: report.drawCalls,
      cacheSize: report.cacheSize,
      diagnostics: report.diagnostics.map((diagnostic) =>
        toWebGpuAppJsonValue(diagnostic),
      ),
    })),
  };
}

function countRenderBundleStatus(
  reports: readonly RenderBundleExecutionReport[],
  status: RenderBundleExecutionReport["status"],
): number {
  return reports.filter((report) => report.status === status).length;
}

function assembleWebGpuAppTransmissionGrabPass(options: {
  readonly app: WebGpuApp;
  readonly target: WebGpuAppFrameBoundaryTarget;
  readonly commands: readonly RenderPassCommand[];
  readonly depthAttachment: CachedWebGpuDepthTextureResource;
  readonly label: string;
  readonly clearColor: readonly number[];
  readonly resources: StandardFrameTransmissionSceneColorResources;
}): {
  readonly boundary: FrameBoundaryAssemblyReport;
  readonly report: WebGpuAppTransmissionGrabPassReport;
  readonly diagnostics: readonly unknown[];
} {
  const commands = commandsWithoutOcclusionQueryCommands(
    commandsWithoutTransmissionDraws(options.commands),
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
    commands,
    label: `${options.label}:transmission-grab:${options.target.renderTargetKey ?? "swapchain"}`,
    colorTarget: {
      source: "offscreen-target",
      texture: options.resources.texture.texture,
    },
    clearColor: options.clearColor,
    depthTarget: {
      view: options.depthAttachment.view,
      depthClearValue: options.target.view.clearDepth,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });
  const diagnostics = [
    ...boundary.texture.diagnostics,
    ...(boundary.attachments?.diagnostics ?? []),
    ...(boundary.encoder?.diagnostics ?? []),
    ...(boundary.begin?.diagnostics ?? []),
    ...(boundary.execution?.diagnostics ?? []),
    ...(boundary.end?.diagnostics ?? []),
    ...(boundary.finish?.diagnostics ?? []),
    ...(boundary.submit?.diagnostics ?? []),
  ];

  return {
    boundary,
    report: {
      enabled: true,
      ok: boundary.valid,
      width: options.resources.texture.width,
      height: options.resources.texture.height,
      format: options.resources.texture.format,
      commands: commands.length,
      drawCalls: countDrawCommands(commands),
      textureResourceKey: options.resources.texture.resourceKey,
      samplerResourceKey: options.resources.sampler.resourceKey,
    },
    diagnostics,
  };
}

function commandsWithoutTransmissionDraws(
  commands: readonly RenderPassCommand[],
): readonly RenderPassCommand[] {
  const transmissionRenderIds = new Set<number>();

  for (const command of commands) {
    if (
      command.kind === "setPipeline" &&
      command.pipelineKey.split("|").includes("transmission")
    ) {
      transmissionRenderIds.add(command.renderId);
    }
  }

  if (transmissionRenderIds.size === 0) {
    return commands;
  }

  return commands.filter(
    (command) => !transmissionRenderIds.has(command.renderId),
  );
}

function createWebGpuAppOcclusionCullingReport(): WebGpuAppOcclusionCullingReport {
  return {
    queryCandidateDraws: 0,
    queriedDraws: 0,
    skippedFromQuery: 0,
    skippedRenderIds: [],
    forcedProbeDraws: 0,
    forcedProbeRenderIds: [],
    fallbackReason: null,
  };
}

function appendWebGpuAppOcclusionCullingPlan(
  report: WebGpuAppOcclusionCullingReport,
  plan: ReturnType<typeof planGpuOcclusionFeedbackCulling>,
): void {
  report.queryCandidateDraws += plan.candidateDraws;
  report.skippedFromQuery += plan.skippedRenderIds.length;
  report.skippedRenderIds.push(...plan.skippedRenderIds);
  report.forcedProbeDraws += plan.forcedProbeRenderIds.length;
  report.forcedProbeRenderIds.push(...plan.forcedProbeRenderIds);

  if (plan.fallbackReason !== null) {
    recordWebGpuAppOcclusionCullingFallback(report, plan.fallbackReason);
  }
}

function recordWebGpuAppOcclusionCullingFallback(
  report: WebGpuAppOcclusionCullingReport,
  fallbackReason: GpuOcclusionFeedbackFallbackReason,
): void {
  if (
    report.fallbackReason === null ||
    fallbackReason === "unsupported" ||
    report.fallbackReason !== "unsupported"
  ) {
    report.fallbackReason = fallbackReason;
  }
}

function collectOcclusionQueryRenderIds(
  commands: readonly RenderPassCommand[],
): readonly number[] {
  const renderIds: number[] = [];

  for (const command of commands) {
    if (command.kind === "beginOcclusionQuery") {
      renderIds.push(command.renderId);
    }
  }

  return renderIds;
}

function commandsWithoutSkippedOcclusionDraws(
  commands: readonly RenderPassCommand[],
  skippedRenderIds: readonly number[],
  target: RenderPassCommand[],
): readonly RenderPassCommand[] {
  if (skippedRenderIds.length === 0) {
    return commands;
  }

  const skipped = new Set(skippedRenderIds);
  target.length = 0;

  for (const command of commands) {
    if (
      skipped.has(command.renderId) &&
      (isOcclusionQueryCommand(command) || isDrawCommand(command))
    ) {
      continue;
    }

    target.push(command);
  }

  return target;
}

function commandsWithoutOcclusionQueryCommands(
  commands: readonly RenderPassCommand[],
  target?: RenderPassCommand[],
): readonly RenderPassCommand[] {
  if (!commands.some(isOcclusionQueryCommand)) {
    return commands;
  }

  if (target === undefined) {
    return commands.filter((command) => !isOcclusionQueryCommand(command));
  }

  target.length = 0;

  for (const command of commands) {
    if (!isOcclusionQueryCommand(command)) {
      target.push(command);
    }
  }

  return target;
}

function normalizeOcclusionQueryCommands(
  commands: readonly RenderPassCommand[],
): readonly number[] {
  const renderIds: number[] = [];
  let queryIndex = 0;
  let activeQueryIndex = -1;

  for (const command of commands) {
    if (command.kind === "beginOcclusionQuery") {
      (command as { queryIndex: number }).queryIndex = queryIndex;
      activeQueryIndex = queryIndex;
      renderIds.push(command.renderId);
      queryIndex += 1;
      continue;
    }

    if (command.kind === "endOcclusionQuery") {
      (command as { queryIndex: number }).queryIndex =
        activeQueryIndex >= 0 ? activeQueryIndex : Math.max(0, queryIndex - 1);
      activeQueryIndex = -1;
    }
  }

  return renderIds;
}

function isOcclusionQueryCommand(command: RenderPassCommand): boolean {
  return (
    command.kind === "beginOcclusionQuery" ||
    command.kind === "endOcclusionQuery"
  );
}

function isDrawCommand(command: RenderPassCommand): boolean {
  return (
    command.kind === "draw" ||
    command.kind === "drawIndexed" ||
    command.kind === "drawIndirect" ||
    command.kind === "drawIndexedIndirect"
  );
}

function snapshotUsesTransmission(snapshot: RenderSnapshot): boolean {
  return snapshot.meshDraws.some((draw) =>
    draw.batchKey.pipelineKey.split("|").includes("transmission"),
  );
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
    ...(boundaries.renderBundles === undefined
      ? {}
      : { renderBundles: boundaries.renderBundles }),
    ...(boundaries.msaa === undefined ? {} : { msaa: boundaries.msaa }),
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

interface PreparedSpriteFrameResources {
  readonly pipeline: CreateSpriteRenderPipelineResourceResult | null;
  readonly resources: SpriteFrameResources;
}

async function prepareSpriteFrameResourcesForSnapshot(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<PreparedSpriteFrameResources> {
  const spriteDraws = options.snapshot.spriteDraws ?? [];

  if (spriteDraws.length === 0) {
    return {
      pipeline: null,
      resources: {
        valid: true,
        commands: [],
        diagnostics: [],
      },
    };
  }

  const pipeline = await getOrCreateWebGpuAppSpritePipeline(
    options.app,
    options.cache,
  );

  if (!pipeline.valid || pipeline.resource === null) {
    return {
      pipeline,
      resources: {
        valid: false,
        commands: [],
        diagnostics: pipeline.diagnostics,
      },
    };
  }

  return {
    pipeline,
    resources: createSpriteFrameResources({
      app: options.app,
      assets: options.assets,
      cache: options.cache,
      snapshot: options.snapshot,
      spriteDraws,
      viewUniforms: options.viewUniforms,
      worldTransforms: options.worldTransforms,
      pipeline: pipeline.resource,
      reuse: options.reuse,
    }),
  };
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
    app.msaa.sampleCount,
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
    sampleCount: app.msaa.sampleCount,
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
    app.msaa.sampleCount,
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
    sampleCount: app.msaa.sampleCount,
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

interface WebGpuAppSceneMotionVectorPlan {
  readonly required: boolean;
  readonly colorFormat: string | null;
  readonly fallbackReason?: WebGpuAppMotionVectorFallbackReason;
}

function createWebGpuAppSceneMotionVectorPlan(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly snapshot: RenderSnapshot;
}): WebGpuAppSceneMotionVectorPlan {
  const needsMotionVectors = options.app.postEffects.some(
    (effect) =>
      effect.enabled !== false && effect.requiresMotionVectors === true,
  );

  if (!needsMotionVectors) {
    return {
      required: false,
      colorFormat: null,
      fallbackReason: "not-required",
    };
  }

  if (options.app.msaa.sampleCount > 1) {
    return { required: true, colorFormat: null, fallbackReason: "msaa" };
  }

  if (
    (options.snapshot.spriteDraws?.length ?? 0) > 0 ||
    (options.snapshot.skyboxes?.length ?? 0) > 0
  ) {
    return {
      required: true,
      colorFormat: null,
      fallbackReason: "unsupported-scene-packets",
    };
  }

  const targetPlan = createWebGpuAppFrameBoundaryTargets(
    options.app,
    options.assets,
    options.snapshot,
  );

  if (
    targetPlan.diagnostics.length > 0 ||
    targetPlan.targets.length !== 1 ||
    targetPlan.targets[0]?.source !== "swapchain"
  ) {
    return {
      required: true,
      colorFormat: null,
      fallbackReason: "unsupported-target",
    };
  }

  return { required: true, colorFormat: options.app.initialization.format };
}

interface WebGpuAppPreviousObjectTransformResourceResult {
  readonly resource: WorldTransformGpuBufferResource | null;
  readonly packed: PackedSnapshotPreviousTransforms | null;
  readonly history: PackedPreviousSnapshotTransformHistoryReport;
  readonly diagnostics: readonly unknown[];
}

function prepareWebGpuAppPreviousObjectTransformResource(options: {
  readonly device: unknown;
  readonly cache: WebGpuAppPostPassCache;
  readonly currentTransforms: PackedSnapshotTransforms;
  readonly required: boolean;
}): WebGpuAppPreviousObjectTransformResourceResult {
  if (!options.required) {
    return {
      resource: null,
      packed: null,
      history: emptyPreviousObjectTransformHistoryReport(),
      diagnostics: [],
    };
  }

  const packed = writePackedSnapshotPreviousTransforms(
    options.currentTransforms,
    options.cache.previousWorldTransformsByRenderId,
    options.cache.previousWorldTransformsScratch,
  );
  const descriptor = writeWorldTransformBufferDescriptor(
    packed,
    options.cache.previousWorldTransformDescriptorScratch,
    {
      label: previousWorldTransformBufferLabel(
        packed.floatCount ?? packed.data.length,
      ),
    },
  );
  const diagnostics: unknown[] = [
    ...packed.diagnostics,
    ...descriptor.diagnostics,
  ];

  if (descriptor.plan === null) {
    options.cache.previousWorldTransformResource = null;
    options.cache.previousWorldTransformByteLength = 0;
    return {
      resource: null,
      packed,
      history: packed.history,
      diagnostics,
    };
  }

  const byteLength = descriptor.plan.source.byteLength;
  const cached = options.cache.previousWorldTransformResource;

  if (
    cached !== null &&
    options.cache.previousWorldTransformByteLength === byteLength &&
    writeBufferData(options.device, cached.buffer, descriptor.plan.source)
  ) {
    return {
      resource: cached,
      packed,
      history: packed.history,
      diagnostics,
    };
  }

  const resource = createWorldTransformGpuBuffer({
    device: options.device as Parameters<
      typeof createWorldTransformGpuBuffer
    >[0]["device"],
    plan: descriptor.plan,
  });

  diagnostics.push(...resource.diagnostics);
  options.cache.previousWorldTransformResource = resource.resource;
  options.cache.previousWorldTransformByteLength =
    resource.resource === null ? 0 : byteLength;

  return {
    resource: resource.resource,
    packed,
    history: packed.history,
    diagnostics,
  };
}

function createWebGpuAppMotionVectorReport(options: {
  readonly plan: WebGpuAppSceneMotionVectorPlan;
  readonly objectHistory: PackedPreviousSnapshotTransformHistoryReport;
  readonly resource: WorldTransformGpuBufferResource | null;
  readonly update: PackedSnapshotTransformHistoryUpdateReport;
}): WebGpuAppMotionVectorReport {
  const missingPreviousBuffer =
    options.plan.required &&
    options.plan.colorFormat !== null &&
    options.resource === null;
  const fallbackReason = missingPreviousBuffer
    ? "missing-previous-object-transform-buffer"
    : options.plan.fallbackReason;
  const status: WebGpuAppMotionVectorStatus = !options.plan.required
    ? "disabled"
    : options.plan.colorFormat === null || missingPreviousBuffer
      ? "fallback-clear"
      : "scene-attachment";

  return {
    required: options.plan.required,
    status,
    colorFormat: missingPreviousBuffer ? null : options.plan.colorFormat,
    ...(fallbackReason === undefined ? {} : { fallbackReason }),
    objectTransforms: {
      available: options.resource !== null,
      resourceKey: options.resource?.resourceKey ?? null,
      total: options.objectHistory.total,
      used: options.objectHistory.used,
      fallback: options.objectHistory.fallback,
      missing: options.objectHistory.missing,
      stored: options.update.stored,
      staleRemoved: options.update.staleRemoved,
    },
  };
}

function emptyPreviousObjectTransformHistoryReport(): PackedPreviousSnapshotTransformHistoryReport {
  return { total: 0, used: 0, fallback: 0, missing: [] };
}

function previousWorldTransformBufferLabel(floatCount: number): string {
  return `PreviousWorldTransforms/storage/${floatCount}`;
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
  readonly motionVectorColorFormat?: string | null;
  readonly msaaColorTarget?: Parameters<
    typeof assembleFrameBoundary
  >[0]["msaaColorTarget"];
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly gpuTiming?: Parameters<typeof assembleFrameBoundary>[0]["gpuTiming"];
  readonly occlusionQueries?: Parameters<
    typeof assembleFrameBoundary
  >[0]["occlusionQueries"];
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
        ...(options.msaaColorTarget === undefined ||
        options.msaaColorTarget === null
          ? {}
          : { msaaSampleCount: options.msaaColorTarget.sampleCount }),
      },
      postEffects,
      readbackBoundary: null,
      plannedCommands: 0,
      drawCalls: 0,
      diagnostics,
    };
  }

  const requiresMotionVectors = options.effects.some(
    (effect) => effect.requiresMotionVectors === true,
  );
  let motionVectorTexture: WebGpuPostPassTextureResource | undefined;

  if (requiresMotionVectors) {
    const motionVector = createOrReuseWebGpuPostPassTexture({
      device: options.app.initialization.device as Parameters<
        typeof createOrReuseWebGpuPostPassTexture
      >[0]["device"],
      slot: options.cache.postPasses.motionVector,
      width: options.target.width,
      height: options.target.height,
      format: options.motionVectorColorFormat ?? options.target.format,
      label: `${options.label}:post:motion-vector`,
    });

    diagnostics.push(...motionVector.diagnostics);

    if (motionVector.valid && motionVector.resource !== null) {
      motionVectorTexture = motionVector.resource;
    }
  }

  const requiresDepthTexture = options.effects.some(
    (effect) => effect.requiresDepthTexture === true,
  );
  const depthTexture: WebGpuPostPassDepthTextureResource | undefined =
    requiresDepthTexture
      ? {
          texture: options.depthAttachment.texture,
          width: options.depthAttachment.width,
          height: options.depthAttachment.height,
          format: options.depthAttachment.format,
          sampleCount: options.depthAttachment.sampleCount,
          label: `${options.label}:post:depth`,
        }
      : undefined;

  const motionVectorAttachmentView =
    options.motionVectorColorFormat === undefined ||
    options.motionVectorColorFormat === null
      ? undefined
      : motionVectorTexture?.texture.createView?.();
  const useSceneMotionVectorAttachment =
    motionVectorTexture !== undefined &&
    motionVectorAttachmentView !== undefined;
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
    ...(options.msaaColorTarget === undefined
      ? {}
      : { msaaColorTarget: options.msaaColorTarget }),
    ...(useSceneMotionVectorAttachment
      ? {
          additionalColorTargets: [
            {
              view: motionVectorAttachmentView,
              clearColor: [0.5, 0.5, 0.5, 1],
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        }
      : {}),
    depthTarget: {
      view: options.depthAttachment.view,
      depthClearValue: options.target.view.clearDepth,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
    ...(options.gpuTiming === undefined
      ? {}
      : { gpuTiming: options.gpuTiming }),
    ...(options.occlusionQueries === undefined
      ? {}
      : { occlusionQueries: options.occlusionQueries }),
  });
  let input: WebGpuPostPassTextureResource = sceneTexture.resource;
  let readbackBoundary: FrameBoundaryAssemblyReport | null = null;
  let plannedCommands = options.commands.length;
  let drawCalls = countDrawCommands(options.commands);
  let valid = sceneBoundary.valid;

  boundaries.push(sceneBoundary);
  appendFrameBoundaryDiagnostics(diagnostics, sceneBoundary);

  if (requiresMotionVectors) {
    if (motionVectorTexture === undefined) {
      valid = false;
    } else if (!useSceneMotionVectorAttachment) {
      const motionBoundary = assembleFrameBoundary({
        context,
        device,
        queue,
        commands: [],
        label: `${options.label}:post:motion-vector`,
        colorTarget: {
          source: "offscreen-target",
          texture: motionVectorTexture.texture,
        },
        clearColor: encodePostPassMotionVectorClearColor({
          snapshot: options.snapshot,
          view: options.target.view,
          cache: options.cache.postPasses,
        }),
      });

      boundaries.push(motionBoundary);
      appendFrameBoundaryDiagnostics(diagnostics, motionBoundary);
      valid &&= motionBoundary.valid;
    }
  }

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
          (effectIndex + options.snapshot.frame) % 2 === 0
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
      isLast,
      ...(motionVectorTexture === undefined
        ? {}
        : { motionVector: motionVectorTexture }),
      ...(depthTexture === undefined ? {} : { depth: depthTexture }),
      ...(outputTexture === null ? {} : { output: outputTexture }),
      label: `${options.label}:post:${effect.id}`,
    });

    diagnostics.push(...prepared.diagnostics);

    if (prepared.graph !== undefined) {
      const graphResult = assembleWebGpuAppPreparedPostEffectGraph({
        context,
        device,
        queue,
        effectId: prepared.effectId,
        label: `${options.label}:post:${effectIndex}:${effect.id}`,
        graph: prepared.graph,
        isLast,
        outputFormat: options.target.format,
        ...(options.readbackSamples === undefined
          ? {}
          : { readbackSamples: options.readbackSamples }),
      });

      boundaries.push(...graphResult.boundaries);
      diagnostics.push(...graphResult.diagnostics);
      postEffects.push({
        effectId: prepared.effectId,
        label: prepared.label,
        viewId: options.target.view.viewId,
        input: input.label,
        output: graphResult.output,
        ok:
          graphResult.valid &&
          prepared.diagnostics.length === 0 &&
          (isLast || graphResult.outputResource !== null),
        drawCalls: graphResult.drawCalls,
        graph: prepared.graph.report,
      });
      plannedCommands += graphResult.plannedCommands;
      drawCalls += graphResult.drawCalls;
      valid &&=
        graphResult.valid &&
        prepared.diagnostics.length === 0 &&
        (isLast || graphResult.outputResource !== null);

      if (graphResult.readbackBoundary !== null) {
        readbackBoundary = graphResult.readbackBoundary;
      }

      if (!isLast) {
        if (graphResult.outputResource === null) {
          valid = false;
          break;
        }

        input = graphResult.outputResource;
      }

      continue;
    }

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
      ...(options.msaaColorTarget === undefined ||
      options.msaaColorTarget === null
        ? {}
        : { msaaSampleCount: options.msaaColorTarget.sampleCount }),
    },
    postEffects,
    readbackBoundary,
    plannedCommands,
    drawCalls,
    diagnostics,
  };
}

function assembleWebGpuAppPreparedPostEffectGraph(options: {
  readonly context: Parameters<typeof assembleFrameBoundary>[0]["context"];
  readonly device: Parameters<typeof assembleFrameBoundary>[0]["device"];
  readonly queue: Parameters<typeof assembleFrameBoundary>[0]["queue"];
  readonly effectId: string;
  readonly label: string;
  readonly graph: WebGpuPreparedPostEffectGraph;
  readonly isLast: boolean;
  readonly outputFormat: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
}): {
  readonly valid: boolean;
  readonly boundaries: readonly FrameBoundaryAssemblyReport[];
  readonly diagnostics: readonly unknown[];
  readonly readbackBoundary: FrameBoundaryAssemblyReport | null;
  readonly output: "swapchain" | "offscreen";
  readonly outputResource: WebGpuPostPassTextureResource | null;
  readonly plannedCommands: number;
  readonly drawCalls: number;
} {
  const boundaries: FrameBoundaryAssemblyReport[] = [];
  const diagnostics: unknown[] = [];
  let valid = options.graph.passes.length > 0;
  let readbackBoundary: FrameBoundaryAssemblyReport | null = null;
  let output: "swapchain" | "offscreen" = options.isLast
    ? "swapchain"
    : "offscreen";
  let outputResource: WebGpuPostPassTextureResource | null = null;
  let plannedCommands = 0;
  let drawCalls = 0;

  if (options.graph.passes.length === 0) {
    diagnostics.push({
      code: "webGpuPostPass.outputTextureUnavailable",
      effectId: options.effectId,
      message: `Post effect '${options.effectId}' prepared an empty post-effect graph.`,
    });
  }

  for (
    let graphPassIndex = 0;
    graphPassIndex < options.graph.passes.length;
    graphPassIndex += 1
  ) {
    const graphPass = options.graph.passes[graphPassIndex];

    if (graphPass === undefined) {
      continue;
    }

    diagnostics.push(...graphPass.diagnostics);
    plannedCommands += graphPass.commands.length;
    drawCalls += countDrawCommands(graphPass.commands);
    output = graphPass.output;
    outputResource =
      graphPass.output === "offscreen"
        ? (graphPass.outputResource ?? null)
        : null;

    const graphPassOutputResource = graphPass.outputResource;

    if (
      graphPass.output === "offscreen" &&
      graphPassOutputResource === undefined
    ) {
      diagnostics.push({
        code: "webGpuPostPass.outputTextureUnavailable",
        effectId: options.effectId,
        message: `Post effect '${options.effectId}' graph pass '${graphPass.label}' did not provide an off-screen output texture.`,
      });
      valid = false;
      continue;
    }

    const postBoundary =
      graphPass.output === "offscreen"
        ? assembleFrameBoundary({
            context: options.context,
            device: options.device,
            queue: options.queue,
            commands: graphPass.commands,
            label: `${options.label}:${graphPassIndex}:${graphPass.kind}`,
            colorTarget: {
              source: "offscreen-target" as const,
              texture: graphPassOutputResource!.texture,
            },
            clearColor: [0, 0, 0, 1],
          })
        : assembleFrameBoundary({
            context: options.context,
            device: options.device,
            queue: options.queue,
            commands: graphPass.commands,
            label: `${options.label}:${graphPassIndex}:${graphPass.kind}`,
            clearColor: [0, 0, 0, 1],
            ...(options.isLast && options.readbackSamples !== undefined
              ? {
                  readback: {
                    format: options.outputFormat,
                    width: graphPass.width,
                    height: graphPass.height,
                    samples: options.readbackSamples,
                  },
                }
              : {}),
          });

    boundaries.push(postBoundary);
    appendFrameBoundaryDiagnostics(diagnostics, postBoundary);
    valid &&= postBoundary.valid && graphPass.diagnostics.length === 0;

    if (postBoundary.readback !== null && postBoundary.readback !== undefined) {
      readbackBoundary = postBoundary;
    }
  }

  return {
    valid,
    boundaries,
    diagnostics,
    readbackBoundary,
    output,
    outputResource,
    plannedCommands,
    drawCalls,
  };
}

function encodePostPassMotionVectorClearColor(options: {
  readonly snapshot: RenderSnapshot;
  readonly view: RenderSnapshot["views"][number];
  readonly cache: Pick<
    WebGpuAppPostPassCache,
    "previousViewProjectionByViewId"
  >;
}): readonly [number, number, number, number] {
  const current = readSnapshotViewProjectionMatrix(
    options.snapshot,
    options.view,
  );

  if (current === null) {
    return [0.5, 0.5, 0.5, 1];
  }

  const previous = options.cache.previousViewProjectionByViewId.get(
    options.view.viewId,
  );
  const motion =
    previous === undefined
      ? [0, 0]
      : screenMotionForViewProjectionMatrices(current, previous);
  const stored = previous ?? new Float32Array(16);

  stored.set(current);
  options.cache.previousViewProjectionByViewId.set(options.view.viewId, stored);

  return [
    encodeSignedMotionComponent(motion[0] ?? 0),
    encodeSignedMotionComponent(motion[1] ?? 0),
    0.5,
    1,
  ];
}

function rememberCurrentViewProjectionMatrices(
  snapshot: RenderSnapshot,
  previousViewProjectionByViewId: Map<number, Float32Array>,
): void {
  for (const view of snapshot.views) {
    const current = readSnapshotViewProjectionMatrix(snapshot, view);

    if (current === null) {
      continue;
    }

    const stored =
      previousViewProjectionByViewId.get(view.viewId) ?? new Float32Array(16);

    stored.set(current);
    previousViewProjectionByViewId.set(view.viewId, stored);
  }
}

function readSnapshotViewProjectionMatrix(
  snapshot: RenderSnapshot,
  view: RenderSnapshot["views"][number],
): Float32Array | null {
  const offset = view.viewProjectionMatrixOffset;

  if (offset < 0 || offset + 16 > snapshot.viewMatrices.length) {
    return null;
  }

  return snapshot.viewMatrices.subarray(offset, offset + 16);
}

function screenMotionForViewProjectionMatrices(
  current: ArrayLike<number>,
  previous: ArrayLike<number>,
): readonly [number, number] {
  const currentNdc = projectWorldOriginToNdc(current);
  const previousNdc = projectWorldOriginToNdc(previous);

  return [
    (currentNdc[0] - previousNdc[0]) * 0.5,
    (currentNdc[1] - previousNdc[1]) * -0.5,
  ];
}

function projectWorldOriginToNdc(
  matrix: ArrayLike<number>,
): readonly [number, number] {
  const w = finiteNonZero(matrix[15] ?? 1);

  return [(matrix[12] ?? 0) / w, (matrix[13] ?? 0) / w];
}

function finiteNonZero(value: number): number {
  return Number.isFinite(value) && Math.abs(value) > 0.000001 ? value : 1;
}

function encodeSignedMotionComponent(value: number): number {
  const clamped = Number.isFinite(value) ? Math.min(Math.max(value, -1), 1) : 0;
  return clamped * 0.5 + 0.5;
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
    ...(boundary.occlusionQueries?.diagnostics ?? []),
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

async function readWebGpuAppOcclusionQueries(input: {
  readonly readbacks: readonly WebGpuAppOcclusionQueryReadback[];
  readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
  readonly queryCount: number;
  readonly frame: number;
  readonly feedbackState: GpuOcclusionFeedbackState;
  readonly culling: WebGpuAppOcclusionCullingReport;
}): Promise<WebGpuAppOcclusionQueryReport | undefined> {
  if (
    input.queryCount === 0 &&
    input.diagnostics.length === 0 &&
    input.culling.queryCandidateDraws === 0 &&
    input.culling.skippedFromQuery === 0 &&
    input.culling.forcedProbeDraws === 0 &&
    input.culling.fallbackReason === null
  ) {
    return undefined;
  }

  const readbackResults: {
    readonly viewId: number;
    readonly result: GpuOcclusionQueryReadbackResult;
  }[] = [];

  for (const readback of input.readbacks) {
    readbackResults.push({
      viewId: readback.viewId,
      result: await readGpuOcclusionQueryResults(
        readback.resources,
        readback.renderIds,
      ),
    });
  }

  const diagnostics = [
    ...input.diagnostics,
    ...readbackResults.flatMap((entry) => entry.result.diagnostics),
  ];
  const allReadbacksValid =
    readbackResults.length > 0 &&
    readbackResults.every((entry) => entry.result.valid);
  const status =
    input.queryCount === 0
      ? "inactive"
      : allReadbacksValid &&
          diagnostics.every((entry) => entry.severity !== "error")
        ? "ready"
        : "unsupported";

  if (status === "ready") {
    for (const readback of readbackResults) {
      updateGpuOcclusionFeedbackState({
        state: input.feedbackState,
        viewId: readback.viewId,
        frame: input.frame,
        status,
        testedRenderIds: readback.result.testedRenderIds,
        visibleRenderIds: readback.result.visibleRenderIds,
        occludedRenderIds: readback.result.occludedRenderIds,
      });
    }
  } else if (status === "unsupported") {
    updateGpuOcclusionFeedbackState({
      state: input.feedbackState,
      viewId: 0,
      frame: input.frame,
      status,
      testedRenderIds: [],
      visibleRenderIds: [],
      occludedRenderIds: [],
    });
  }

  return {
    status,
    queryCount: input.queryCount,
    queryCandidateDraws: input.culling.queryCandidateDraws,
    queriedDraws: input.culling.queriedDraws,
    resolvedQueryResults: readbackResults.reduce(
      (total, entry) =>
        total + (entry.result.valid ? entry.result.testedRenderIds.length : 0),
      0,
    ),
    skippedFromQuery: input.culling.skippedFromQuery,
    skippedRenderIds: [...input.culling.skippedRenderIds],
    forcedProbeDraws: input.culling.forcedProbeDraws,
    forcedProbeRenderIds: [...input.culling.forcedProbeRenderIds],
    fallbackReason:
      status === "unsupported" ? "unsupported" : input.culling.fallbackReason,
    testedRenderIds: readbackResults.flatMap(
      (entry) => entry.result.testedRenderIds,
    ),
    visibleRenderIds: readbackResults.flatMap(
      (entry) => entry.result.visibleRenderIds,
    ),
    occludedRenderIds: readbackResults.flatMap(
      (entry) => entry.result.occludedRenderIds,
    ),
    sampleCounts: readbackResults.flatMap((entry) => entry.result.sampleCounts),
    diagnostics,
  };
}

function newOcclusionQueryDiagnostics(
  report: WebGpuAppOcclusionQueryReport | undefined,
  existing: readonly GpuOcclusionQueryDiagnostic[],
): readonly GpuOcclusionQueryDiagnostic[] {
  if (report === undefined) {
    return [];
  }

  return report.diagnostics.filter(
    (diagnostic) => !existing.includes(diagnostic),
  );
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
  const pendingStateCommands: RenderPassCommand[] = [];

  for (const command of prefixCommands) {
    target.push(command);
  }

  for (const command of commands) {
    if (isRenderPassStateCommand(command)) {
      queuePendingRenderPassStateCommand(pendingStateCommands, command);
      continue;
    }

    if (isRenderPassCommandVisibleToView(command, snapshot, view)) {
      target.push(...pendingStateCommands);
      pendingStateCommands.length = 0;
      target.push(command);
    }
  }

  return target;
}

function isRenderPassStateCommand(command: RenderPassCommand): boolean {
  return (
    command.kind === "setPipeline" ||
    command.kind === "setBindGroup" ||
    command.kind === "setVertexBuffer" ||
    command.kind === "setIndexBuffer"
  );
}

function queuePendingRenderPassStateCommand(
  target: RenderPassCommand[],
  command: RenderPassCommand,
): void {
  const key = renderPassStateCommandKey(command);

  for (let index = 0; index < target.length; index += 1) {
    if (renderPassStateCommandKey(target[index] as RenderPassCommand) === key) {
      target[index] = command;
      return;
    }
  }

  target.push(command);
}

function renderPassStateCommandKey(command: RenderPassCommand): string {
  switch (command.kind) {
    case "setPipeline":
      return "pipeline";
    case "setBindGroup":
      return `bind-group:${String(command.index)}`;
    case "setVertexBuffer":
      return `vertex-buffer:${String(command.slot)}`;
    case "setIndexBuffer":
      return "index-buffer";
    default:
      return "non-state";
  }
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
    if (
      command.kind === "draw" ||
      command.kind === "drawIndexed" ||
      command.kind === "drawIndirect" ||
      command.kind === "drawIndexedIndirect"
    ) {
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
    sampleCount: app.msaa.sampleCount,
  }).resource;
}

function createWebGpuAppMsaaColorTargetForTarget(
  app: WebGpuApp,
  resourceCache: WebGpuAppResourceCache,
  target: WebGpuAppFrameBoundaryTarget,
): WebGpuAppMsaaColorTargetResult {
  const result = createOrReuseWebGpuMsaaColorTexture({
    device: app.initialization.device as Parameters<
      typeof createOrReuseWebGpuMsaaColorTexture
    >[0]["device"],
    cache: msaaColorCacheSlotForTarget(resourceCache, target),
    width: target.width,
    height: target.height,
    format: target.format,
    sampleCount: app.msaa.sampleCount,
    label:
      target.source === "swapchain"
        ? "aperture/webgpu-app/msaa/swapchain"
        : `aperture/webgpu-app/msaa/${target.renderTargetKey}`,
  });

  return {
    valid: result.valid,
    status: result.status,
    resource: result.resource,
    diagnostics: result.diagnostics,
  };
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

function msaaColorCacheSlotForTarget(
  resourceCache: WebGpuAppResourceCache,
  target: WebGpuAppFrameBoundaryTarget,
): WebGpuMsaaColorTextureCacheSlot {
  if (target.source === "swapchain") {
    return resourceCache.msaaColor;
  }

  let slot = resourceCache.msaaColorByRenderTarget.get(target.renderTargetKey);

  if (slot === undefined) {
    slot = createWebGpuMsaaColorTextureCacheSlot();
    resourceCache.msaaColorByRenderTarget.set(target.renderTargetKey, slot);
  }

  return slot;
}

function createWebGpuAppMsaaReport(input: {
  readonly config: WebGpuMsaaConfig;
  readonly colorTargets: number;
  readonly colorTexturesCreated: number;
  readonly colorTexturesReused: number;
}): WebGpuAppMsaaReport {
  return {
    requestedSampleCount: input.config.requestedSampleCount,
    sampleCount: input.config.sampleCount,
    enabled: input.config.enabled,
    clamped: input.config.clamped,
    supportedSampleCounts: input.config.supportedSampleCounts,
    colorTargets: input.colorTargets,
    colorTexturesCreated: input.colorTexturesCreated,
    colorTexturesReused: input.colorTexturesReused,
  };
}

function createQueuedBuiltInAppDiagnosticsSummary(input: {
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly framePlan?: Pick<
    PlanRenderFrameFromSnapshotResult,
    "readiness" | "packages"
  >;
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
    ...(input.framePlan === undefined
      ? {}
      : {
          renderFrameQueue: createRenderFrameQueueDiagnosticsSummary(
            input.framePlan,
          ),
        }),
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
    phases.push({
      phase: "opaque",
      recordCount: opaque,
      sortPolicy: renderQueueSortPolicyForPhase("opaque"),
    });
  }

  if (transparent > 0) {
    phases.push({
      phase: "transparent",
      recordCount: transparent,
      sortPolicy: renderQueueSortPolicyForPhase("transparent"),
    });
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

function createWebGpuAppTransmissionGrabResources(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly required: boolean;
}): WebGpuAppTransmissionGrabResourcesResult {
  if (!options.required) {
    return { valid: true, resources: null, diagnostics: [] };
  }

  const targetPlan = createWebGpuAppFrameBoundaryTargets(
    options.app,
    options.assets,
    options.snapshot,
  );
  const target = targetPlan.targets[0];

  if (target === undefined) {
    return {
      valid: false,
      resources: null,
      diagnostics: targetPlan.diagnostics,
    };
  }

  const texture = createOrReuseWebGpuPostPassTexture({
    device: options.app.initialization.device as Parameters<
      typeof createOrReuseWebGpuPostPassTexture
    >[0]["device"],
    slot: options.cache.postPasses.transmissionGrab,
    width: target.width,
    height: target.height,
    format: target.format,
    label: "aperture/standard-transmission-grab/scene-color",
  });
  const diagnostics: unknown[] = [
    ...targetPlan.diagnostics,
    ...texture.diagnostics,
  ];

  if (!texture.valid || texture.resource === null) {
    return { valid: false, resources: null, diagnostics };
  }

  const view = texture.resource.texture.createView?.();

  if (view === undefined) {
    diagnostics.push({
      code: "webGpuApp.transmissionGrabTextureViewUnavailable",
      message:
        "StandardMaterial transmission grab pass requires a scene color texture view.",
    });
    return { valid: false, resources: null, diagnostics };
  }

  const sampler = createOrReuseTransmissionGrabSampler(options);

  diagnostics.push(...sampler.diagnostics);

  if (sampler.resource === null) {
    return { valid: false, resources: null, diagnostics };
  }

  return {
    valid: diagnostics.length === 0,
    resources: {
      texture: {
        resourceKey: transmissionGrabTextureResourceKey(texture.resource),
        texture: texture.resource.texture,
        view,
        width: texture.resource.width,
        height: texture.resource.height,
        format: texture.resource.format,
      },
      sampler: {
        resourceKey: sampler.resource.resourceKey,
        sampler: sampler.resource.sampler,
      },
    },
    diagnostics,
  };
}

function createOrReuseTransmissionGrabSampler(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
}): {
  readonly resource: SamplerGpuResource | null;
  readonly diagnostics: readonly unknown[];
} {
  const resourceKey = "standard-transmission-grab:sampler";
  const cached = options.cache.samplers.get(resourceKey);

  if (cached !== undefined) {
    return { resource: cached, diagnostics: [] };
  }

  const result = createSamplerGpuResource({
    device: options.app.initialization.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey,
    sampler: createSamplerAsset({
      label: "Standard transmission scene color sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  });

  if (result.valid && result.resource !== null) {
    options.cache.samplers.set(resourceKey, result.resource);
  }

  return { resource: result.resource, diagnostics: result.diagnostics };
}

function transmissionGrabTextureResourceKey(
  resource: WebGpuPostPassTextureResource,
): string {
  return [
    "standard-transmission-grab:scene-color",
    resource.width,
    resource.height,
    resource.format,
  ].join(":");
}

async function prepareQueuedBuiltInFrameResources(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly motionVectorColorFormat?: string | null;
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
  const prepared = await prepareQueuedBuiltInFrameResourceSet({
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
          ...(options.motionVectorColorFormat === undefined
            ? {}
            : { motionVectorColorFormat: options.motionVectorColorFormat }),
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
    key: draw.batchKey.pipelineKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
}

function createWebGpuAppSnapshotUpdateMetadata(
  snapshot: RenderSnapshot,
  options: WebGpuAppFrameRenderOptions,
): {
  readonly snapshotChangeSet: RenderSnapshotChangeSet;
  readonly snapshotUpdateSchedule: RenderSnapshotUpdateSchedule;
} {
  const snapshotChangeSet =
    options.snapshotChangeSet?.frame === snapshot.frame &&
    options.snapshot === snapshot
      ? options.snapshotChangeSet
      : createRenderSnapshotChangeSet(
          options.previousSnapshotForUpdate ?? null,
          snapshot,
        );

  return {
    snapshotChangeSet,
    snapshotUpdateSchedule:
      createRenderSnapshotUpdateSchedule(snapshotChangeSet),
  };
}

async function renderWebGpuAppFrame(
  context: WebGpuAppRenderContext,
  resourceCache: WebGpuAppResourceCache,
  options: WebGpuAppFrameRenderOptions,
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

  const shadowSnapshot =
    options.standardMaterialShadowReceiverResources === undefined
      ? extractedSnapshot
      : withStandardShadowPipelineKeys(
          extractedSnapshot,
          standardShadowPipelineKind(
            options.standardMaterialShadowReceiverResources,
          ),
        );
  const iblSnapshot = hasReadyStandardDiffuseIblResources(
    options.standardMaterialIblResources,
  )
    ? withStandardIblPipelineKeys(
        shadowSnapshot,
        hasReadyStandardSpecularIblProofResources(
          options.standardMaterialIblResources,
        ),
      )
    : shadowSnapshot;
  const localLightCookieResources = prepareLocalLightClusterCookieResources({
    snapshot: iblSnapshot,
    assets: sourceAssets,
    device: app.initialization.device,
    cache: resourceCache,
    reuse,
    matrixCache: resourceCache.localLightCookieMatrices,
    ...(options.standardMaterialShadowReceiverResources === undefined
      ? {}
      : {
          shadowReceiverResources:
            options.standardMaterialShadowReceiverResources,
        }),
  });

  if (!localLightCookieResources.valid) {
    return renderReport({
      ok: false,
      snapshot: iblSnapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...iblSnapshot.diagnostics,
        ...localLightCookieResources.diagnostics,
      ],
    });
  }

  const snapshot = withStandardClusteredLocalLightPipelineKeys(iblSnapshot, {
    supportedCookieResources:
      localLightCookieResources.resources?.supportedResources ?? [],
    cookieTextureViewDimension:
      localLightCookieResources.resources?.textureViewDimension ?? null,
    reuseShadowMatricesForCookies:
      canReuseClusteredLocalLightShadowMatricesForCookies(
        options.standardMaterialShadowReceiverResources,
        localLightCookieResources.resources,
      ),
  });
  const updateMetadata = createWebGpuAppSnapshotUpdateMetadata(
    snapshot,
    options,
  );
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
      snapshotChangeSet: updateMetadata.snapshotChangeSet,
      snapshotUpdateSchedule: updateMetadata.snapshotUpdateSchedule,
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
      localLightCookieResources: localLightCookieResources.resources,
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
      localLightCookieResources: localLightCookieResources.resources,
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
    snapshotChangeSet: updateMetadata.snapshotChangeSet,
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
  const spriteFrame = await prepareSpriteFrameResourcesForSnapshot({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    reuse,
  });

  if (!spriteFrame.resources.valid) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resources,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...spriteFrame.resources.diagnostics,
      ],
    });
  }

  const frameCommands =
    spriteFrame.resources.commands.length === 0
      ? framePlan.commandPlan.commands
      : [...framePlan.commandPlan.commands, ...spriteFrame.resources.commands];
  const indirectDraws = prepareWebGpuAppIndirectDrawCommands({
    app,
    cache: resourceCache,
    commands: frameCommands,
    label: options.label ?? "aperture-webgpu-app",
  });
  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot,
    commands: indirectDraws.commands,
    label: options.label ?? "aperture-webgpu-app",
    reuse,
    enableRenderBundles: shouldUseRenderBundlesForSnapshotSchedule(
      updateMetadata.snapshotUpdateSchedule,
    ),
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
  });

  await waitForSubmittedWork(app.initialization.device);
  const occlusionQueries = await readWebGpuAppOcclusionQueries({
    readbacks: boundaries.occlusionQueryReadbacks,
    diagnostics: boundaries.occlusionQueryDiagnostics,
    queryCount: boundaries.occlusionQueryCount,
    frame: snapshot.frame,
    feedbackState: resourceCache.occlusionFeedback,
    culling: boundaries.occlusionCulling,
  });
  const frameOk =
    framePlan.apply.diagnostics.length === 0 &&
    framePlan.bindingPlan.diagnostics.length === 0 &&
    framePlan.packages.diagnostics.length === 0 &&
    framePlan.drawCommands.diagnostics.length === 0 &&
    framePlan.drawList.valid &&
    framePlan.resources.valid &&
    framePlan.commandPlan.valid &&
    spriteFrame.resources.diagnostics.length === 0 &&
    boundaries.valid &&
    (occlusionQueries === undefined ||
      occlusionQueries.status !== "unsupported");
  const readback = await mapFrameBoundaryReadbackSamples(
    boundaries.readbackBoundary?.readback,
    frameOk,
  );

  return renderReport({
    ok: frameOk,
    snapshot,
    snapshotChangeSet: updateMetadata.snapshotChangeSet,
    snapshotUpdateSchedule: updateMetadata.snapshotUpdateSchedule,
    pipeline,
    resources,
    boundary: boundaries.boundary,
    boundaries: boundaries.boundaries,
    renderTargets: boundaries.renderTargets,
    postEffects: boundaries.postEffects,
    ...(boundaries.renderBundles === undefined
      ? {}
      : { renderBundles: boundaries.renderBundles }),
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    ...(occlusionQueries === undefined ? {} : { occlusionQueries }),
    ...(indirectDraws.report.status === "skipped"
      ? {}
      : { indirectDraws: indirectDraws.report }),
    resourceReuse: reuse,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    commandPressure: framePlan.commandPlan.pressure,
    diagnostics: [
      ...snapshot.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...spriteFrame.resources.diagnostics,
      ...boundaries.diagnostics,
      ...newOcclusionQueryDiagnostics(
        occlusionQueries,
        boundaries.occlusionQueryDiagnostics,
      ),
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
    | "point-array"
    | "spot"
    | "spot-array"
    | "multi"
    | "multi-spot-array"
    | "multi-point-array"
    | "multi-spot-array-point-array" = "directional",
): RenderSnapshot {
  let changed = false;
  const shadowFeatures =
    shadowKind === "multi-spot-array-point-array"
      ? [
          "shadowMap",
          "pointShadowMap",
          CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
          CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
        ]
      : shadowKind === "multi-point-array"
        ? [
            "shadowMap",
            "pointShadowMap",
            CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
          ]
        : shadowKind === "multi-spot-array"
          ? [
              "shadowMap",
              "pointShadowMap",
              CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
            ]
          : shadowKind === "multi"
            ? ["shadowMap", "pointShadowMap"]
            : shadowKind === "point-array"
              ? [
                  "pointShadowMap",
                  CLUSTERED_LOCAL_LIGHT_POINT_ARRAY_SHADOW_PIPELINE_FEATURE,
                ]
              : shadowKind === "point"
                ? ["pointShadowMap"]
                : shadowKind === "directional-cascaded"
                  ? ["shadowMap", "cascadedShadowMap"]
                  : shadowKind === "spot-array"
                    ? [
                        "shadowMap",
                        CLUSTERED_LOCAL_LIGHT_ARRAY_SHADOW_PIPELINE_FEATURE,
                      ]
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
):
  | "directional"
  | "directional-cascaded"
  | "point"
  | "point-array"
  | "spot"
  | "spot-array"
  | "multi"
  | "multi-spot-array"
  | "multi-point-array"
  | "multi-spot-array-point-array" {
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

function canReuseClusteredLocalLightShadowMatricesForCookies(
  shadowResources: StandardFrameShadowReceiverResources | undefined,
  cookieResources: LocalLightClusterCookieResources | null,
): boolean {
  if (
    shadowResources === undefined ||
    cookieResources === null ||
    cookieResources.textureViewDimension !== "2d" ||
    cookieResources.supportedResources.length === 0
  ) {
    return false;
  }

  const spotResources = isMultiShadowKind(shadowResources.shadowKind)
    ? shadowResources.spotShadowReceiverResources
    : shadowResources.shadowKind === "spot" ||
        shadowResources.shadowKind === "spot-array"
      ? shadowResources
      : undefined;

  if (
    spotResources === undefined ||
    spotResources.matrixBufferResource.resource === null ||
    spotResources.samplerResource.resource === null
  ) {
    return false;
  }

  const supportedSpotLightIds = new Set(
    spotResources.depthTextureResources.resources
      .filter(
        (resource) =>
          (resource.viewDimension === "2d" ||
            resource.viewDimension === "2d-array") &&
          resource.allocation.resource !== null,
      )
      .map((resource) => resource.lightId),
  );

  return cookieResources.supportedResources.every(
    (resource) =>
      resource.textureViewDimension === "2d" &&
      supportedSpotLightIds.has(resource.lightId),
  );
}

function isMultiShadowKind(
  shadowKind: StandardFrameShadowReceiverResources["shadowKind"] | undefined,
): boolean {
  return (
    shadowKind === "multi" ||
    shadowKind === "multi-spot-array" ||
    shadowKind === "multi-point-array" ||
    shadowKind === "multi-spot-array-point-array"
  );
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

function withStandardClusteredLocalLightPipelineKeys(
  snapshot: RenderSnapshot,
  options: {
    readonly supportedCookieResources?: readonly {
      readonly lightId: number;
      readonly textureKey: string;
      readonly samplerKey: string;
      readonly textureViewDimension: "2d" | "2d-array" | "cube";
      readonly matrixBaseIndex?: number;
    }[];
    readonly cookieTextureViewDimension?: "2d" | "2d-array" | "cube" | null;
    readonly reuseShadowMatricesForCookies?: boolean;
  } = {},
): RenderSnapshot {
  const descriptor = createLocalLightClusterDescriptor(snapshot, {
    supportedCookieResources: options.supportedCookieResources ?? [],
  });

  if (!descriptor.enabled) {
    return snapshot;
  }

  const cookieSamplingReady =
    descriptor.shadowCookieMetadata.cookie.samplingSupported;
  let changed = false;
  const meshDraws = snapshot.meshDraws.map((draw) => {
    const pipelineKey = draw.batchKey.pipelineKey;

    if (!pipelineKey.startsWith("standard|")) {
      return draw;
    }

    const clusteredPipelineKey = standardClusteredLocalLightPipelineKey(
      pipelineKey,
      cookieSamplingReady,
      options.cookieTextureViewDimension ?? null,
      options.reuseShadowMatricesForCookies === true,
    );

    if (clusteredPipelineKey === pipelineKey) {
      return draw;
    }

    changed = true;

    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey: clusteredPipelineKey },
      sortKey: { ...draw.sortKey, pipelineKey: clusteredPipelineKey },
    };
  });

  return changed ? { ...snapshot, meshDraws } : snapshot;
}

function standardClusteredLocalLightPipelineKey(
  pipelineKey: string,
  cookieSamplingReady: boolean,
  cookieTextureViewDimension: "2d" | "2d-array" | "cube" | null = null,
  reuseShadowMatricesForCookies = false,
): string {
  const tokens = pipelineKey.split("|");
  const family = tokens[0];

  if (family !== "standard") {
    return pipelineKey;
  }

  const rest = tokens
    .slice(1)
    .filter(
      (token) =>
        token !== CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE &&
        token !== CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE &&
        token !== CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE &&
        token !== CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE &&
        token !== CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE,
    );
  const cookieSamplingSupportedForDraw =
    cookieSamplingReady && !rest.includes("cascadedShadowMap");
  const reuseShadowMatricesForCookiesForDraw =
    reuseShadowMatricesForCookies &&
    cookieTextureViewDimension === "2d" &&
    rest.includes("shadowMap") &&
    !rest.includes("cascadedShadowMap");
  const features = [
    CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
    ...(cookieSamplingSupportedForDraw
      ? [
          CLUSTERED_LOCAL_LIGHT_COOKIE_PIPELINE_FEATURE,
          ...(reuseShadowMatricesForCookiesForDraw
            ? [CLUSTERED_LOCAL_LIGHT_SHADOW_COOKIE_PIPELINE_FEATURE]
            : []),
          ...(cookieTextureViewDimension === "cube"
            ? [CLUSTERED_LOCAL_LIGHT_CUBE_COOKIE_PIPELINE_FEATURE]
            : cookieTextureViewDimension === "2d-array"
              ? [CLUSTERED_LOCAL_LIGHT_ARRAY_COOKIE_PIPELINE_FEATURE]
              : []),
        ]
      : []),
  ];

  return [family, ...features, ...rest].join("|");
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
    ...(report.snapshotChangeSet === undefined
      ? {}
      : { renderChangeSet: toWebGpuAppJsonValue(report.snapshotChangeSet) }),
    ...(report.snapshotUpdateSchedule === undefined
      ? {}
      : {
          renderUpdateSchedule: toWebGpuAppJsonValue(
            report.snapshotUpdateSchedule,
          ),
        }),
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
    ...(report.transmissionGrabPass === undefined
      ? {}
      : { transmissionGrabPass: report.transmissionGrabPass }),
    ...(report.msaa === undefined ? {} : { msaa: report.msaa }),
    ...(report.readback === undefined
      ? {}
      : { readback: toWebGpuAppJsonValue(report.readback) }),
    ...(report.gpuTimings === undefined
      ? {}
      : { gpuTimings: report.gpuTimings }),
    ...(report.commandPressure === undefined
      ? {}
      : { commandPressure: toWebGpuAppJsonValue(report.commandPressure) }),
    ...(report.renderBundles === undefined
      ? {}
      : { renderBundles: report.renderBundles }),
    ...(report.indirectDraws === undefined
      ? {}
      : { indirectDraws: report.indirectDraws }),
    ...(report.motionVectors === undefined
      ? {}
      : { motionVectors: report.motionVectors }),
    ...(report.localLightClusters === undefined
      ? {}
      : { localLightClusters: report.localLightClusters }),
    ...(report.occlusionQueries === undefined
      ? {}
      : { occlusionQueries: report.occlusionQueries }),
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
  readonly snapshotChangeSet?: RenderSnapshotChangeSet;
  readonly snapshotUpdateSchedule?: RenderSnapshotUpdateSchedule;
  readonly diagnostics: readonly unknown[];
  readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
  readonly resourceReuse?: WebGpuAppResourceReuseReport;
  readonly pipeline?: WebGpuAppPipelineResourceResult | null;
  readonly resources?: WebGpuAppFrameResourcesResult | null;
  readonly boundary?: FrameBoundaryAssemblyReport | null;
  readonly boundaries?: readonly FrameBoundaryAssemblyReport[];
  readonly renderTargets?: readonly WebGpuAppRenderTargetSubmissionReport[];
  readonly postEffects?: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly transmissionGrabPass?: WebGpuAppTransmissionGrabPassReport;
  readonly msaa?: WebGpuAppMsaaReport;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readback?: FrameBoundaryReadbackResult;
  readonly gpuTimings?: GpuPassTimingReport;
  readonly commandPressure?: RenderPassCommandPressureReport;
  readonly renderBundles?: WebGpuAppRenderBundleReport;
  readonly indirectDraws?: IndirectDrawCommandReport;
  readonly motionVectors?: WebGpuAppMotionVectorReport;
  readonly occlusionQueries?: WebGpuAppOcclusionQueryReport;
  readonly drawPackages?: number;
  readonly drawCommands?: number;
  readonly drawCalls?: number;
}): WebGpuAppRenderReport {
  const resourceReuse =
    input.resourceReuse ?? createWebGpuAppResourceReuseReport();
  const localLightClusters = createWebGpuAppLocalLightClusterReport(
    input.snapshot,
    input.resources ?? null,
    resourceReuse,
  );

  return {
    ok: input.ok,
    frame: input.snapshot.frame,
    snapshot: input.snapshot,
    ...(input.snapshotChangeSet === undefined
      ? {}
      : { snapshotChangeSet: input.snapshotChangeSet }),
    ...(input.snapshotUpdateSchedule === undefined
      ? {}
      : { snapshotUpdateSchedule: input.snapshotUpdateSchedule }),
    counts: {
      views: input.snapshot.views.length,
      meshDraws: input.snapshot.meshDraws.length,
      spriteDraws: input.snapshot.spriteDraws?.length ?? 0,
      skyboxes: input.snapshot.skyboxes?.length ?? 0,
      fogs: input.snapshot.fogs?.length ?? 0,
      drawPackages: input.drawPackages ?? 0,
      drawCommands: input.drawCommands ?? 0,
      drawCalls: input.drawCalls ?? 0,
      diagnostics: input.diagnostics.length,
    },
    diagnostics: input.diagnostics,
    ...(input.diagnosticsSummary === undefined
      ? {}
      : { diagnosticsSummary: input.diagnosticsSummary }),
    resourceReuse,
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
    ...(input.transmissionGrabPass === undefined
      ? {}
      : { transmissionGrabPass: input.transmissionGrabPass }),
    ...(input.msaa === undefined ? {} : { msaa: input.msaa }),
    ...(input.depthAttachment === undefined
      ? {}
      : { depthAttachment: input.depthAttachment }),
    ...(input.readback === undefined ? {} : { readback: input.readback }),
    ...(input.gpuTimings === undefined ? {} : { gpuTimings: input.gpuTimings }),
    ...(input.commandPressure === undefined
      ? {}
      : { commandPressure: input.commandPressure }),
    ...(input.renderBundles === undefined
      ? {}
      : { renderBundles: input.renderBundles }),
    ...(input.indirectDraws === undefined
      ? {}
      : { indirectDraws: input.indirectDraws }),
    ...(input.motionVectors === undefined
      ? {}
      : { motionVectors: input.motionVectors }),
    ...(localLightClusters === undefined ? {} : { localLightClusters }),
    ...(input.occlusionQueries === undefined
      ? {}
      : { occlusionQueries: input.occlusionQueries }),
  };
}

function createWebGpuAppLocalLightClusterReport(
  snapshot: RenderSnapshot,
  resources: WebGpuAppFrameResourcesResult | null,
  reuse: WebGpuAppResourceReuseReport,
): LocalLightClusterReport | undefined {
  const clusterResources =
    collectWebGpuAppLocalLightClusterResources(resources);
  const resource = clusterResources[0] ?? null;

  if (resource !== null) {
    const report = localLightClusterReportFromDescriptor(resource.descriptor, {
      resource,
      buffersCreated: reuse.localLightClusterBuffersCreated,
      buffersReused: reuse.localLightClusterBuffersReused,
    });

    if (clusterResources.length <= 1) {
      return report;
    }

    return {
      ...report,
      routes: clusterResources.map((routeResource) =>
        localLightClusterReportFromDescriptor(routeResource.descriptor, {
          resource: routeResource,
        }),
      ),
    };
  }

  if (!snapshotShouldUseClusteredLocalLights(snapshot)) {
    return undefined;
  }

  return localLightClusterReportFromDescriptor(
    createLocalLightClusterDescriptor(snapshot),
    {
      buffersCreated: reuse.localLightClusterBuffersCreated,
      buffersReused: reuse.localLightClusterBuffersReused,
    },
  );
}

function collectWebGpuAppLocalLightClusterResources(
  result: WebGpuAppFrameResourcesResult | null,
): readonly LocalLightClusterGpuResource[] {
  const resources = result?.resources;

  if (resources === null || resources === undefined) {
    return [];
  }

  if ("localLightClusters" in resources) {
    return resources.localLightClusters === undefined
      ? []
      : [resources.localLightClusters];
  }

  if ("standard" in resources) {
    const clusterResources: LocalLightClusterGpuResource[] = [];
    const seenResourceKeys = new Set<string>();

    for (const standardResources of resources.standard) {
      const localLightClusters = standardResources.localLightClusters;

      if (
        localLightClusters !== undefined &&
        !seenResourceKeys.has(localLightClusters.resourceKey)
      ) {
        seenResourceKeys.add(localLightClusters.resourceKey);
        clusterResources.push(localLightClusters);
      }
    }

    return clusterResources;
  }

  return [];
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
    queuedBindGroupsCreated: 0,
    queuedBindGroupsReused: 0,
    queuedBindGroupCacheSize: 0,
    lightBuffersCreated: 0,
    lightBuffersReused: 0,
    localLightClusterBuffersCreated: 0,
    localLightClusterBuffersReused: 0,
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
