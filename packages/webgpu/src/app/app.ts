import { AssetRegistry, assetHandleKey } from "@aperture-engine/simulation";
import {
  RenderWorld,
  createMaterialDependencyReadinessReport,
  writeMaterialQueueFromSnapshot,
  writePackedSnapshotPreviousTransforms,
  writePackedSnapshotTransforms,
  rememberPackedSnapshotTransformsByRenderId,
  writePackedSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotViewUniforms,
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
  type PreparedMaterialStoreJsonValue,
  type PreparedMeshStoreJsonValue,
  type RenderEntityRef,
  type RenderSnapshot,
  type StandardMaterialAsset,
  type UnlitMaterialAsset,
  type RenderSnapshotChangeSet,
  type RenderSnapshotUpdateSchedule,
} from "@aperture-engine/render";
import { writeBufferData } from "./app-frame-resource-utils.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
import {
  countWebGpuAppFrameBoundaryTargetSubmissions,
  createWebGpuAppFrameBoundaryTargets,
  findLastSwapchainTargetIndex,
  resolveWebGpuAppTargetViewRectangles,
  webGpuAppFrameBoundaryTargetSubmissionKey,
  type WebGpuAppFrameBoundaryTarget,
} from "./frame-target.js";
import { createWebGpuAppDrawResourceSetPlan } from "./draw-resource-set.js";
import {
  prepareMatcapAppTextureSamplerResources,
  prepareStandardAppTextureSamplerResources,
  prepareUnlitAppTextureSamplerResources,
  emptyPreparedAppTextureSamplerResources,
  sourceAssetCacheKey,
  type AppTextureSamplerResourceCacheSummary,
} from "./app-texture-sampler-resources.js";
import { registerWebGpuAppEnvironmentResourceCache } from "./app-environment-resources.js";
import {
  createPreparedMaterialTextureSamplerDependencies,
  type PreparedMaterialTextureSamplerDependencies,
} from "../materials/core/prepared-material-texture-sampler-dependencies.js";
import type { PreparedBuiltInMaterialStore } from "../materials/core/prepared-built-in-material-store.js";
import type { PreparedAppMaterialCacheSummary } from "../materials/core/prepared-app-material-resource.js";
import type { PreparedMeshGpuResourceCacheSummary } from "../resources/meshes/prepared-mesh-cache.js";
import {
  assembleFrameBoundary,
  mapFrameBoundaryReadbackSamples,
  type FrameBoundaryAssemblyReport,
  type FrameBoundaryReadbackResult,
  type FrameBoundaryReadbackSampleRequest,
} from "../render/frame/frame-boundary.js";
import { type RenderBundleExecutionReport } from "../render/draw/render-bundle.js";
import { type IndirectDrawCommandReport } from "../render/draw/indirect-draw-commands.js";
import {
  type GpuPassTimingReport,
  type GpuTimestampQueryDiagnostic,
} from "../gpu/gpu-timing.js";
import {
  createWebGpuAppRenderPhaseTimer,
  type WebGpuAppRenderPhaseTimingReport,
  type WebGpuAppRenderPhaseTimingSamples,
  type WebGpuAppRenderPhaseTimer,
} from "./app-phase-timing.js";
import {
  planGpuOcclusionFeedbackCulling,
  type GpuOcclusionFeedbackFallbackReason,
  type GpuOcclusionQueryDiagnostic,
} from "../gpu/occlusion-query.js";
import type { CurrentTextureLike } from "./presentation/current-texture-view.js";
import {
  WEBGPU_APP_DEPTH_FORMAT,
  type CachedWebGpuDepthTextureResource,
} from "../resources/textures/depth-texture-resource.js";
import { resolveWebGpuMsaaConfig, type WebGpuMsaaConfig } from "../gpu/msaa.js";
import type { BindGroupResourceCache } from "../gpu/bind-group-resource-cache.js";
import type { LightBindGroupResource } from "../lighting/light-bind-group.js";
import type { StandardLightShadowBindGroupResource } from "../materials/standard/standard-light-shadow-bind-group.js";
import {
  createOrReuseDebugNormalAppFrameResources,
  type CreateDebugNormalAppFrameResourcesResult,
} from "../materials/debug-normal/debug-normal-app-frame-resources.js";
import type { DebugNormalMaterialBindGroupLayoutResource } from "../materials/debug-normal/debug-normal-bind-group.js";
import {
  createDebugNormalRenderPipelineResource,
  type CreateDebugNormalRenderPipelineResourceResult,
} from "../materials/debug-normal/debug-normal-pipeline.js";
import {
  createOrReuseMatcapAppFrameResources,
  type CreateMatcapAppFrameResourcesResult,
} from "../materials/matcap/matcap-app-frame-resources.js";
import { type MatcapMaterialBindGroupLayoutResource } from "../materials/matcap/matcap-bind-group.js";
import {
  createMatcapRenderPipelineResource,
  type CreateMatcapRenderPipelineResourceResult,
} from "../materials/matcap/matcap-pipeline.js";
import { isBuiltInMaterialQueueFamily } from "../materials/core/built-in-material-queue-family.js";
import {
  createQueuedBuiltInAppResourceAdapterRegistry,
  createQueuedBuiltInAppResourceFamilyAdapterTable,
  queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue,
  validateQueuedBuiltInAppResourceAdapterRegistry,
} from "../materials/core/built-in-material-app-resource-adapter.js";
import {
  collectQueuedBuiltInAppResourceSet,
  createSingleQueuedBuiltInAppResourceItem,
  type QueuedBuiltInAppResourceItem,
  type QueuedBuiltInAppResourceSet,
} from "../render/queues/queued-built-in-app-resource-set.js";
import {
  prepareQueuedBuiltInFrameResourceSet,
  type CreateQueuedBuiltInFrameResourcesResult,
  type QueuedBuiltInFrameResourceRouteDiagnostic,
  type QueuedBuiltInFrameResources,
} from "../render/queues/queued-built-in-frame-resource-set.js";
import { type WebGpuAppDiagnosticsSummary } from "./app-diagnostics-summary.js";
import {
  createWebGpuAppSnapshotTransport,
  createWebGpuAppSnapshotTransportStartPayload,
  readWebGpuAppSnapshotChangeSet,
  readWebGpuAppSharedSnapshot,
  type WebGpuAppSharedSnapshotTransportOptions,
  type WebGpuAppSnapshotTransportDiagnostics,
  type WebGpuAppSnapshotTransportMode,
} from "./app-snapshot-transport.js";
import type { LocalLightClusterReport } from "../lighting/local-light-clusters.js";
import {
  prepareLocalLightClusterCookieResources,
  type LocalLightClusterCookieAtlasUpdateReport,
  type LocalLightClusterCookieResources,
} from "../lighting/local-light-cookie-resources.js";
import type { StandardMaterialBindGroupLayoutResource } from "../materials/standard/standard-bind-group.js";
import {
  createOrReuseStandardAppFrameResources,
  type CreateStandardAppFrameResourcesResult,
} from "../materials/standard/standard-app-frame-resources.js";
import type { StandardAreaLightLtcResources } from "../materials/standard/standard-area-light-ltc-resource.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
  StandardFrameTransmissionSceneColorResources,
} from "../materials/standard/standard-frame-resources.js";
import {
  canReuseClusteredLocalLightShadowMatricesForCookies,
  hasReadyStandardDiffuseIblResources,
  hasReadyStandardSpecularIblProofResources,
  standardShadowPipelineKind,
  withStandardClusteredLocalLightPipelineKeys,
  withStandardIblPipelineKeys,
  withStandardShadowPipelineKeys,
} from "../materials/standard/standard-app-pipeline-keys.js";
import {
  createStandardRenderPipelineResource,
  type CreateStandardRenderPipelineResourceResult,
} from "../materials/standard/standard-pipeline.js";
import {
  createTonemapPipelineKey,
  resolveTonemapOperator,
  type TonemapOperator,
} from "../output/output-stage-tonemap.js";
import {
  createOutputColorSpacePipelineKey,
  resolveOutputColorSpace,
  type OutputColorSpace,
} from "../output/output-stage-color-space.js";
import { type CreateMultiMaterialUnlitFrameGpuResourcesResult } from "../materials/unlit/unlit-frame-resources.js";
import {
  createOrReuseUnlitAppFrameResources,
  type CreateUnlitAppFrameResourcesResult,
} from "../materials/unlit/unlit-app-frame-resources.js";
import type { UnlitBindGroupResource } from "../materials/unlit/unlit-bind-group.js";
import {
  createUnlitRenderPipelineResource,
  type CreateUnlitRenderPipelineResourceResult,
} from "../materials/unlit/unlit-pipeline.js";
import { type CreateSpriteRenderPipelineResourceResult } from "../render/sprites/sprite-pipeline.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import type {
  RenderPassCommand,
  RenderPassCommandPressureReport,
} from "../render/passes/render-pass-commands.js";
import type { RenderPassAttachmentLoadOp } from "../render/passes/render-pass-attachments.js";
import {
  createWebGpuIdBufferEntries,
  findWebGpuIdBufferEntry,
  WEBGPU_ID_BUFFER_EMPTY_ID,
} from "../picking/id-buffer.js";
import {
  createWebGpuIdBufferPickBindGroup,
  createWebGpuIdBufferPickCommands,
  createWebGpuIdBufferPickIdStorage,
  createWebGpuIdBufferPickTexture,
  readWebGpuIdBufferPickPixel,
  type WebGpuIdBufferPickReadbackResult,
} from "../picking/id-buffer-pick.js";
import {
  createOrReuseWebGpuPostPassTexture,
  type WebGpuPostEffect,
  type WebGpuPostPassDepthTextureResource,
  type WebGpuPostPassTextureResource,
  type WebGpuPreparedPostEffectGraph,
} from "../post/post-pass.js";
import {
  createWorldTransformGpuBuffer,
  writeWorldTransformBufferDescriptor,
  type WorldTransformGpuBufferResource,
} from "../resources/transforms/world-transform-buffer.js";
import {
  initializeWebGpu,
  type InitializeWebGpuOptions,
  type WebGpuCanvasLike,
  type WebGpuFailure,
  type WebGpuInitializationSuccess,
} from "../gpu/initialize-webgpu.js";
import {
  createWebGpuAppPickSharedBindGroups,
  getOrCreateWebGpuIdBufferPickPipelines,
  popWebGpuPickErrorScope,
  pushWebGpuPickErrorScope,
  webGpuAppPickPixel,
} from "./picking.js";
import {
  createWebGpuAppDepthAttachmentReport,
  createWebGpuAppPickReport,
  createWebGpuAppResourceReuseReport,
  renderReport,
  waitForSubmittedWork,
  webGpuAppPickReportToJsonValue,
  webGpuAppRenderReportToJsonValue,
} from "./report.js";
import { prepareWebGpuAppSourceAssetFacades } from "./source-assets.js";
import {
  createWebGpuAppMaterialDependencyDiagnostic,
  diagnoseSnapshotMaterialDependencies,
} from "./material-dependencies.js";
import {
  getWebGpuAppPipelineLayouts,
  type WebGpuAppMaterialKind,
  type WebGpuAppPipelineLayouts,
} from "./pipeline-layouts.js";
import {
  createWebGpuAppResourceCache,
  type WebGpuAppPipelinePlanResult,
  type WebGpuAppPostPassCache,
  type WebGpuAppResourceCache,
} from "./resource-cache.js";
import {
  createEmptyRenderSnapshot,
  createWebGpuAppSnapshotUpdateMetadata,
} from "./snapshot.js";
import {
  createWebGpuAppDepthAttachmentForTarget,
  createWebGpuAppMsaaColorTargetForTarget,
  createWebGpuAppMsaaReport,
  type WebGpuAppMsaaReport,
} from "./attachments.js";
import {
  createWebGpuAppDiagnosticsSummaryWithGpuTimings,
  createWebGpuAppGpuTimingForTarget,
  newOcclusionQueryDiagnostics,
  readWebGpuAppGpuTimings,
  readWebGpuAppOcclusionQueries,
  type WebGpuAppGpuTimingReadback,
  type WebGpuAppOcclusionQueryReadback,
} from "./gpu-readback.js";
import {
  assembleWebGpuAppTransmissionGrabPass,
  createWebGpuAppTransmissionGrabResources,
} from "./transmission-grab.js";
import {
  createWebGpuAppOcclusionQueryResources,
  createWebGpuAppRenderBundleCommandKey,
  createWebGpuAppRenderBundleReport,
  prepareWebGpuAppIndirectDrawCommands,
  shouldUseRenderBundlesForSnapshotSchedule,
} from "./frame-boundary-support.js";
import {
  appendWebGpuAppOcclusionCullingPlan,
  collectOcclusionQueryRenderIds,
  commandsWithoutOcclusionQueryCommands,
  commandsWithoutSkippedOcclusionDraws,
  createWebGpuAppOcclusionCullingReport,
  normalizeOcclusionQueryCommands,
  recordWebGpuAppOcclusionCullingFallback,
  type WebGpuAppOcclusionCullingReport,
} from "./occlusion-culling.js";
import { countDrawCommands, writeCommandsForView } from "./view-commands.js";
import {
  collectInstanceTintResources,
  createQueuedBuiltInAppDiagnosticsSummary,
  createQueuedBuiltInRouteFailureDiagnosticsSummary,
  queuedBuiltInResourceSetHasStandardMaterial,
  resolveStandardAreaLightLtcResources,
  snapshotUsesTransmission,
} from "./queued-built-in-support.js";
import { writeSkyboxCommandsForView } from "./skybox.js";
import {
  createSpriteFrameResources,
  getOrCreateWebGpuAppSpritePipeline,
  prepareSpriteFrameResourcesForSnapshot,
  type SpriteFrameResources,
} from "./sprites.js";
import {
  collectMultiUnlitAppResourceSet,
  createMultiUnlitAppFrameResources,
} from "./multi-unlit.js";

export type { WebGpuAppMsaaReport };

export interface WebGpuAppRenderOptions {
  readonly frame?: number;
  readonly snapshot?: RenderSnapshot;
  readonly snapshotChangeSet?: RenderSnapshotChangeSet;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
  readonly phaseTimingSamples?: WebGpuAppRenderPhaseTimingSamples;
}

interface WebGpuAppFrameRenderOptions extends WebGpuAppRenderOptions {
  readonly previousSnapshotForUpdate?: RenderSnapshot | null;
}

export {
  createWebGpuAppRenderTargetAsset,
  type WebGpuAppRenderTargetAsset,
  type WebGpuAppRenderTargetAssetInput,
} from "./render-target.js";
export {
  createWebGpuAppDrawResourceSetPlan,
  type WebGpuAppDrawResourceSet,
  type WebGpuAppDrawResourceSetPlan,
} from "./draw-resource-set.js";
export {
  webGpuAppPickReportToJsonValue,
  webGpuAppRenderReportToJson,
  webGpuAppRenderReportToJsonValue,
} from "./report.js";

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
  localLightClusterBufferWrites: number;
  localLightClusterBufferWritesSkipped: number;
  dynamicBufferWrites: number;
}

export type WebGpuAppFrameResourceRouteDiagnostic =
  QueuedBuiltInFrameResourceRouteDiagnostic;

export interface WebGpuAppMaterialDependencyDiagnostic {
  readonly code: "webGpuApp.materialDependenciesNotReady";
  readonly message: string;
  readonly materialDependencyReadiness: MaterialAssetDependencyReadinessReportJsonValue;
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
  readonly phaseTimings?: WebGpuAppRenderPhaseTimingReport;
  readonly commandPressure?: RenderPassCommandPressureReport;
  readonly renderBundles?: WebGpuAppRenderBundleReport;
  readonly indirectDraws?: IndirectDrawCommandReport;
  readonly motionVectors?: WebGpuAppMotionVectorReport;
  readonly localLightClusters?: LocalLightClusterReport;
  readonly localLightCookies?: WebGpuAppLocalLightCookieReport;
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
  readonly phaseTimings?: WebGpuAppRenderPhaseTimingReport;
  readonly commandPressure?: WebGpuAppJsonValue;
  readonly renderBundles?: WebGpuAppRenderBundleReport;
  readonly indirectDraws?: IndirectDrawCommandReport;
  readonly motionVectors?: WebGpuAppMotionVectorReport;
  readonly localLightClusters?: LocalLightClusterReport;
  readonly localLightCookies?: WebGpuAppLocalLightCookieReport;
  readonly occlusionQueries?: WebGpuAppOcclusionQueryReport;
  readonly materialDependencyReadiness?: readonly MaterialAssetDependencyReadinessReportJsonValue[];
}

export interface WebGpuAppLocalLightCookieReport {
  readonly textureLayout?: "single" | "array" | "atlas";
  readonly textureViewDimension: "2d" | "2d-array" | "cube";
  readonly shadowMatrixCompatible?: boolean;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly supportedLightCount: number;
  readonly atlasUpdate?: LocalLightClusterCookieAtlasUpdateReport;
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

interface WebGpuAppRenderContext {
  readonly app: WebGpuApp;
  readonly sourceAssets: AssetRegistry;
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

      prepareWebGpuAppSourceAssetFacades({
        registry: sourceAssets,
        snapshot: report.snapshot,
        cache: resourceCache,
        pruneUnreferenced: true,
        resourceReuse: report.resourceReuse,
      });

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
  readonly phaseTimer: WebGpuAppRenderPhaseTimer;
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
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
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
    adapterValidation: QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
  });
  options.phaseTimer.finish("prepare");

  if (!prepared.valid || prepared.resources === null) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
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

  options.phaseTimer.start("queue");
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
  options.phaseTimer.finish("queue");

  if (queue.diagnostics.length > 0) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
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

  options.phaseTimer.start("sort");
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
    pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
    pipelines: prepared.pipelineResults,
    bindGroups: prepared.resources.bindGroups,
    scratch: options.cache.frameScratch.framePlan,
  });
  options.phaseTimer.finish("sort");
  const frameDiagnosticsSummary = createQueuedBuiltInAppDiagnosticsSummary({
    snapshot: options.snapshot,
    resourceSet: options.resourceSet,
    resources: prepared.resources,
    adapterValidation: QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
    framePlan,
  });
  options.phaseTimer.start("prepare");
  const spriteFrame = await prepareSpriteFrameResourcesForSnapshot({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    reuse: options.reuse,
  });
  options.phaseTimer.finish("prepare");

  if (!spriteFrame.resources.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
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
  options.phaseTimer.start("submit");
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
  options.phaseTimer.finish("submit");

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
    phaseTimings: options.phaseTimer.report(
      options.cache.phaseTimingHistory,
      options.snapshot.frame,
    ),
    ...(occlusionQueries === undefined ? {} : { occlusionQueries }),
    ...(indirectDraws.report.status === "skipped"
      ? {}
      : { indirectDraws: indirectDraws.report }),
    localLightCookieResources: options.localLightCookieResources,
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
  const submittedTargetCounts = new Map<string, number>();
  const targetSubmissionTotals = countWebGpuAppFrameBoundaryTargetSubmissions(
    targetPlan.targets,
  );
  const lastSwapchainTargetIndex = findLastSwapchainTargetIndex(
    targetPlan.targets,
  );

  for (
    let targetIndex = 0;
    targetIndex < targetPlan.targets.length;
    targetIndex += 1
  ) {
    const target = targetPlan.targets[targetIndex];

    if (target === undefined) {
      continue;
    }

    const viewRectangles = resolveWebGpuAppTargetViewRectangles(target);

    diagnostics.push(...viewRectangles.diagnostics);
    allTargetsValid &&= viewRectangles.valid;

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

    const targetSubmissionKey =
      webGpuAppFrameBoundaryTargetSubmissionKey(target);
    const previousTargetSubmissions =
      submittedTargetCounts.get(targetSubmissionKey) ?? 0;
    const targetSubmissionTotal =
      targetSubmissionTotals.get(targetSubmissionKey) ?? 0;
    const loadExistingTarget = previousTargetSubmissions > 0;
    const storeMsaaColorForLaterLoad =
      msaaColorTarget.resource !== null &&
      previousTargetSubmissions + 1 < targetSubmissionTotal;
    const colorLoadOp: RenderPassAttachmentLoadOp = loadExistingTarget
      ? "load"
      : "clear";
    const depthLoadOp: RenderPassAttachmentLoadOp = loadExistingTarget
      ? "load"
      : "clear";

    const includeReadback =
      options.readbackSamples !== undefined &&
      readbackBoundary === null &&
      target.source === "swapchain" &&
      targetIndex === lastSwapchainTargetIndex;
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
      if (postTarget.valid) {
        submittedTargetCounts.set(
          targetSubmissionKey,
          previousTargetSubmissions + 1,
        );
      }
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
    const renderBundleKey = createWebGpuAppRenderBundleCommandKey({
      target,
      descriptor: renderBundleDescriptor,
      commands: commandsForBoundary,
      cache: options.cache.renderBundles,
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
      commands: commandsForBoundary,
      label: `${options.label}:${target.renderTargetKey ?? "swapchain"}`,
      colorLoadOp,
      viewport: viewRectangles.viewport,
      scissor: viewRectangles.scissor,
      ...(target.source === "offscreen"
        ? {
            colorTarget: {
              source: "offscreen-target" as const,
              texture: target.texture,
            },
          }
        : {}),
      ...(colorLoadOp === "clear"
        ? { clearColor: options.clearColor ?? target.view.clearColor }
        : {}),
      depthTarget: {
        view: depthAttachment.view,
        ...(depthLoadOp === "clear"
          ? { depthClearValue: target.view.clearDepth }
          : {}),
        depthLoadOp,
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
            ...(storeMsaaColorForLaterLoad
              ? { msaaColorStoreOp: "store" as const }
              : {}),
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
    if (boundary.valid) {
      submittedTargetCounts.set(
        targetSubmissionKey,
        previousTargetSubmissions + 1,
      );
    }
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
      ...(boundary.rectangle?.diagnostics ?? []),
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
  readonly pipelineKeysByRenderId: ReadonlyMap<number, string>;
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
      getPipelineResourceKey: ({ item, pipeline }) =>
        pipeline.resource?.cacheKey ?? item.draw.batchKey.pipelineKey,
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
    key: pipeline.resource.cacheKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
}

async function renderWebGpuAppFrame(
  context: WebGpuAppRenderContext,
  resourceCache: WebGpuAppResourceCache,
  options: WebGpuAppFrameRenderOptions,
): Promise<WebGpuAppRenderReport> {
  const { app, sourceAssets } = context;
  const reuse = createWebGpuAppResourceReuseReport();
  const phaseTimer = createWebGpuAppRenderPhaseTimer(
    options.phaseTimingSamples,
  );
  const extractedSnapshot = options.snapshot;

  phaseTimer.start("collect");

  if (extractedSnapshot === undefined) {
    const emptySnapshot = createEmptyRenderSnapshot(options.frame ?? 0);

    return renderReport({
      ok: false,
      snapshot: emptySnapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        emptySnapshot.frame,
      ),
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
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        iblSnapshot.frame,
      ),
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
    phaseTimer.finish("collect");
    phaseTimer.start("prepare");

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
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
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
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
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
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
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
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
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
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialKind",
          message: `WebGPU app render supports unlit, matcap, standard, and debug-normal materials, not '${material.kind}'.`,
        },
      ],
    });
  }

  const multiUnlit = collectMultiUnlitAppResourceSet({
    assets: sourceAssets,
    snapshot,
    plan: resourceSetPlan,
    firstDraw,
  });
  const shouldUseQueuedBuiltInRoute =
    multiUnlit === null &&
    (firstMaterialKindSupported || resourceSetPlan.sets.length > 1);

  if (shouldUseQueuedBuiltInRoute) {
    prepareWebGpuAppSourceAssetFacades({
      registry: sourceAssets,
      snapshot,
      cache: resourceCache,
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
        QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
      );

    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      ...(diagnosticsSummary === undefined ? {} : { diagnosticsSummary }),
      diagnostics: [...snapshot.diagnostics, ...queuedBuiltIn.diagnostics],
    });
  }

  phaseTimer.finish("collect");
  phaseTimer.start("prepare");

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
      phaseTimer,
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
  phaseTimer.finish("prepare");
  phaseTimer.start("queue");
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
  phaseTimer.finish("queue");
  phaseTimer.start("sort");
  phaseTimer.finish("sort");
  phaseTimer.start("prepare");
  const spriteFrame = await prepareSpriteFrameResourcesForSnapshot({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    reuse,
  });
  phaseTimer.finish("prepare");

  if (!spriteFrame.resources.valid) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resources,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
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
  phaseTimer.start("submit");
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
  phaseTimer.finish("submit");

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
    localLightCookieResources: localLightCookieResources.resources,
    resourceReuse: reuse,
    phaseTimings: phaseTimer.report(
      resourceCache.phaseTimingHistory,
      snapshot.frame,
    ),
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

  prepareWebGpuAppSourceAssetFacades({
    registry: context.sourceAssets,
    snapshot,
    cache: resourceCache,
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
    pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
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
