import { AssetRegistry, assetHandleKey } from "@aperture-engine/simulation";
import {
  RenderWorld,
  createMaterialDependencyReadinessReport,
  writeMaterialQueueFromSnapshot,
  writePackedSnapshotTransforms,
  rememberPackedSnapshotTransformsByRenderId,
  writePackedSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotViewUniforms,
  type MaterialAssetDependencyReadinessReportJsonValue,
  type MaterialAsset,
  type MeshAsset,
  type PreparedMaterialStoreJsonValue,
  type PreparedMeshStoreJsonValue,
  type RenderEntityRef,
  type RenderSnapshot,
  type RenderSnapshotChangeSet,
  type RenderSnapshotUpdateSchedule,
} from "@aperture-engine/render";
import { createWebGpuAppDrawResourceSetPlan } from "./draw-resource-set.js";
import {
  emptyPreparedAppTextureSamplerResources,
  sourceAssetCacheKey,
  type AppTextureSamplerResourceCacheSummary,
} from "./app-texture-sampler-resources.js";
import { registerWebGpuAppEnvironmentResourceCache } from "./app-environment-resources.js";
import { createPreparedMaterialTextureSamplerDependencies } from "../materials/core/prepared-material-texture-sampler-dependencies.js";
import type { PreparedAppMaterialCacheSummary } from "../materials/core/prepared-app-material-resource.js";
import type { PreparedMeshGpuResourceCacheSummary } from "../resources/meshes/prepared-mesh-cache.js";
import {
  mapFrameBoundaryReadbackSamples,
  type FrameBoundaryAssemblyReport,
  type FrameBoundaryReadbackResult,
  type FrameBoundaryReadbackSampleRequest,
} from "../render/frame/frame-boundary.js";
import { type RenderBundleExecutionReport } from "../render/draw/render-bundle.js";
import { type IndirectDrawCommandReport } from "../render/draw/indirect-draw-commands.js";
import { type GpuPassTimingReport } from "../gpu/gpu-timing.js";
import {
  createWebGpuAppRenderPhaseTimer,
  type WebGpuAppRenderPhaseTimingReport,
  type WebGpuAppRenderPhaseTimingSamples,
  type WebGpuAppRenderPhaseTimer,
} from "./app-phase-timing.js";
import {
  type GpuOcclusionFeedbackFallbackReason,
  type GpuOcclusionQueryDiagnostic,
} from "../gpu/occlusion-query.js";
import { resolveWebGpuMsaaConfig, type WebGpuMsaaConfig } from "../gpu/msaa.js";
import { type CreateDebugNormalAppFrameResourcesResult } from "../materials/debug-normal/debug-normal-app-frame-resources.js";
import { type CreateMatcapAppFrameResourcesResult } from "../materials/matcap/matcap-app-frame-resources.js";
import { isBuiltInMaterialQueueFamily } from "../materials/core/built-in-material-queue-family.js";
import {
  collectQueuedBuiltInAppResourceSet,
  createSingleQueuedBuiltInAppResourceItem,
  type QueuedBuiltInAppResourceSet,
} from "../render/queues/queued-built-in-app-resource-set.js";
import {
  type CreateQueuedBuiltInFrameResourcesResult,
  type QueuedBuiltInFrameResourceRouteDiagnostic,
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
import { type CreateStandardAppFrameResourcesResult } from "../materials/standard/standard-app-frame-resources.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
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
  resolveTonemapOperator,
  type TonemapOperator,
} from "../output/output-stage-tonemap.js";
import {
  resolveOutputColorSpace,
  type OutputColorSpace,
} from "../output/output-stage-color-space.js";
import { type CreateMultiMaterialUnlitFrameGpuResourcesResult } from "../materials/unlit/unlit-frame-resources.js";
import { type CreateUnlitAppFrameResourcesResult } from "../materials/unlit/unlit-app-frame-resources.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import type { RenderPassCommandPressureReport } from "../render/passes/render-pass-commands.js";
import { type WebGpuIdBufferPickReadbackResult } from "../picking/id-buffer-pick.js";
import { type WebGpuPostEffect } from "../post/post-pass.js";
import {
  initializeWebGpu,
  type InitializeWebGpuOptions,
  type WebGpuCanvasLike,
  type WebGpuFailure,
  type WebGpuInitializationSuccess,
} from "../gpu/initialize-webgpu.js";
import {
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
import { getWebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import {
  createWebGpuAppResourceCache,
  type WebGpuAppResourceCache,
} from "./resource-cache.js";
import {
  getOrCreateWebGpuAppPipeline,
  type WebGpuAppPipelineResourceResult,
} from "./pipeline-resources.js";
import {
  createEmptyRenderSnapshot,
  createWebGpuAppSnapshotUpdateMetadata,
} from "./snapshot.js";
import { type WebGpuAppMsaaReport } from "./attachments.js";
import {
  createWebGpuAppDiagnosticsSummaryWithGpuTimings,
  newOcclusionQueryDiagnostics,
  readWebGpuAppGpuTimings,
  readWebGpuAppOcclusionQueries,
} from "./gpu-readback.js";
import { createWebGpuAppTransmissionGrabResources } from "./transmission-grab.js";
import {
  prepareWebGpuAppIndirectDrawCommands,
  shouldUseRenderBundlesForSnapshotSchedule,
} from "./frame-boundary-support.js";
import {
  collectInstanceTintResources,
  createQueuedBuiltInAppDiagnosticsSummary,
  createQueuedBuiltInRouteFailureDiagnosticsSummary,
  queuedBuiltInResourceSetHasStandardMaterial,
  resolveStandardAreaLightLtcResources,
  snapshotUsesTransmission,
} from "./queued-built-in-support.js";
import { prepareSpriteFrameResourcesForSnapshot } from "./sprites.js";
import {
  collectMultiUnlitAppResourceSet,
  createMultiUnlitAppFrameResources,
} from "./multi-unlit.js";
import { prepareQueuedBuiltInFrameResources } from "./queued-frame-resources.js";
import {
  QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
  QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
} from "./queued-built-in-adapters.js";
import {
  createWebGpuAppMotionVectorReport,
  createWebGpuAppSceneMotionVectorPlan,
  prepareWebGpuAppPreviousObjectTransformResource,
  rememberCurrentViewProjectionMatrices,
} from "./motion-vectors.js";
import { pickWebGpuAppEntity } from "./picking-frame.js";
import { assembleWebGpuAppFrameBoundaries } from "./frame-boundaries.js";
import { renderSpriteOnlyWebGpuAppFrame } from "./sprite-frame.js";

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
export type { WebGpuAppPipelineResourceResult } from "./pipeline-resources.js";

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
        {
          adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
          getPipeline: ({ item, reuse }) =>
            getOrCreateWebGpuAppPipeline({
              app,
              cache: resourceCache,
              reuse,
              kind: item.adapter.kind,
              pipelineKey: item.draw.batchKey.pipelineKey,
              batchKey: item.draw.batchKey,
            }),
          getPipelineLayouts: ({ item, pipeline, getBindGroupLayout }) =>
            getWebGpuAppPipelineLayouts({
              cache: resourceCache,
              kind: item.adapter.kind,
              pipeline,
              getBindGroupLayout,
            }),
        },
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
    getPipeline: (item) =>
      getOrCreateWebGpuAppPipeline({
        app: options.app,
        cache: options.cache,
        reuse: options.reuse,
        kind: item.adapter.kind,
        pipelineKey: item.draw.batchKey.pipelineKey,
        batchKey: item.draw.batchKey,
        motionVectorColorFormat,
      }),
    getPipelineLayouts: ({ item, pipeline, getBindGroupLayout }) =>
      getWebGpuAppPipelineLayouts({
        cache: options.cache,
        kind: item.adapter.kind,
        pipeline,
        getBindGroupLayout,
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
