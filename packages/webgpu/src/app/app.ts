import type { AssetRegistry } from "@aperture-engine/simulation";
import type {
  RenderWorld,
  MaterialAssetDependencyReadinessReportJsonValue,
  PreparedMaterialStoreJsonValue,
  PreparedMeshStoreJsonValue,
  RenderEntityRef,
  RenderSnapshot,
  RenderSnapshotChangeSet,
  RenderSnapshotUpdateSchedule,
} from "@aperture-engine/render";
import { type AppTextureSamplerResourceCacheSummary } from "./app-texture-sampler-resources.js";
import type { PreparedAppMaterialCacheSummary } from "../materials/core/prepared-app-material-resource.js";
import type { PreparedMeshGpuResourceCacheSummary } from "../resources/meshes/prepared-mesh-cache.js";
import {
  type FrameBoundaryAssemblyReport,
  type FrameBoundaryReadbackResult,
  type FrameBoundaryReadbackSampleRequest,
} from "../render/frame/frame-boundary.js";
import { type RenderBundleExecutionReport } from "../render/draw/render-bundle.js";
import { type IndirectDrawCommandReport } from "../render/draw/indirect-draw-commands.js";
import { type GpuPassTimingReport } from "../gpu/gpu-timing.js";
import {
  type WebGpuAppRenderPhaseTimingReport,
  type WebGpuAppRenderPhaseTimingSamples,
} from "./app-phase-timing.js";
import {
  type GpuOcclusionFeedbackFallbackReason,
  type GpuOcclusionQueryDiagnostic,
} from "../gpu/occlusion-query.js";
import { type WebGpuMsaaConfig } from "../gpu/msaa.js";
import { type CreateDebugNormalAppFrameResourcesResult } from "../materials/debug-normal/debug-normal-app-frame-resources.js";
import { type CreateMatcapAppFrameResourcesResult } from "../materials/matcap/matcap-app-frame-resources.js";
import {
  type CreateQueuedBuiltInFrameResourcesResult,
  type QueuedBuiltInFrameResourceRouteDiagnostic,
} from "../render/queues/queued-built-in-frame-resource-set.js";
import { type WebGpuAppDiagnosticsSummary } from "./app-diagnostics-summary.js";
import {
  type WebGpuAppSharedSnapshotTransportOptions,
  type WebGpuAppSnapshotTransportDiagnostics,
  type WebGpuAppSnapshotTransportMode,
} from "./app-snapshot-transport.js";
import type { LocalLightClusterReport } from "../lighting/local-light-clusters.js";
import { type LocalLightClusterCookieAtlasUpdateReport } from "../lighting/local-light-cookie-resources.js";
import { type CreateStandardAppFrameResourcesResult } from "../materials/standard/standard-app-frame-resources.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
} from "../materials/standard/standard-frame-resources.js";
import { type TonemapOperator } from "../output/output-stage-tonemap.js";
import { type OutputColorSpace } from "../output/output-stage-color-space.js";
import { type CreateMultiMaterialUnlitFrameGpuResourcesResult } from "../materials/unlit/unlit-frame-resources.js";
import { type CreateUnlitAppFrameResourcesResult } from "../materials/unlit/unlit-app-frame-resources.js";
import { type CreateCustomWgslAppFrameResourcesResult } from "../materials/custom-wgsl/custom-wgsl-app-frame-resources.js";
import { type MixedCustomWgslAppFrameResourcesResult } from "./mixed-custom-wgsl-frame.js";
import type { RenderPassCommandPressureReport } from "../render/passes/render-pass-commands.js";
import { type WebGpuIdBufferPickReadbackResult } from "../picking/id-buffer-pick.js";
import { type WebGpuPostEffect } from "../post/post-pass.js";
import {
  type WebGpuAppComputePassDescriptor,
  type WebGpuAppRenderPassDescriptor,
  type WebGpuAppUserPassRegistry,
} from "./user-pass.js";
import {
  type InitializeWebGpuOptions,
  type WebGpuCanvasLike,
  type WebGpuFailure,
  type WebGpuInitializationSuccess,
} from "../gpu/initialize-webgpu.js";
import { type WebGpuAppPipelineResourceResult } from "./pipeline-resources.js";
import { type WebGpuAppMsaaReport } from "./attachments.js";
import type { RenderShadowFrameReport } from "../shadows/render-shadow-frame.js";

export type { WebGpuAppMsaaReport };

export interface WebGpuAppRenderOptions {
  readonly frame?: number;
  readonly snapshot?: RenderSnapshot;
  readonly snapshotChangeSet?: RenderSnapshotChangeSet;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly autoStandardMaterialShadowReceiverResources?: boolean;
  readonly standardMaterialShadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
  readonly phaseTimingSamples?: WebGpuAppRenderPhaseTimingSamples;
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
export { createWebGpuApp } from "./create-webgpu-app.js";
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
  readonly shadow?: RenderShadowFrameReport;
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
  readonly shadow?: WebGpuAppJsonValue;
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
  | CreateQueuedBuiltInFrameResourcesResult
  | CreateCustomWgslAppFrameResourcesResult
  | MixedCustomWgslAppFrameResourcesResult;

export interface WebGpuApp {
  readonly canvas: WebGpuCanvasLike;
  readonly initialization: WebGpuInitializationSuccess;
  readonly renderWorld: RenderWorld;
  readonly tonemap: TonemapOperator;
  readonly outputColorSpace: OutputColorSpace;
  // Exposure scalar applied over the linear HDR scene buffer in the final
  // tonemap post stage (M5-T4). 1 when no HDR scene buffer is configured.
  readonly exposure: number;
  // Color format the lit scene is rendered into. Equals initialization.format
  // (8-bit swapchain) by default; "rgba16float" when an `exposure` option opts
  // into the persistent HDR scene buffer + final tonemap post stage.
  readonly sceneRenderFormat: string;
  readonly msaa: WebGpuMsaaConfig;
  readonly postEffects: readonly WebGpuPostEffect[];
  // M3-T3: route the swapchain post target through the single-encoder FrameGraph
  // path. False by default (legacy N-submit path); the graph path falls back to
  // legacy for routes it does not yet cover, so this is a safe opt-in.
  readonly useFrameGraph: boolean;
  // M3-T7: registry backing the public addRenderPass/addComputePass/removePass
  // API. The graph route reads it each frame to insert user passes (read here so
  // post/forward route code can pull registered passes without new threading).
  readonly userPassRegistry: WebGpuAppUserPassRegistry;
  start(options?: WebGpuAppStartOptions): void;
  stop(): void;
  getDiagnostics(): WebGpuAppDiagnostics;
  pick(x: number, y: number): Promise<RenderEntityRef | null>;
  renderSnapshot(
    snapshot: RenderSnapshot,
    options?: Omit<WebGpuAppRenderOptions, "snapshot">,
  ): Promise<WebGpuAppRenderReport>;
  // M3-T7: insert a user render/compute pass into the frame graph (signed-off
  // D1 shape). Runs only on the single-encoder graph path (useFrameGraph).
  addRenderPass(descriptor: WebGpuAppRenderPassDescriptor): void;
  addComputePass(descriptor: WebGpuAppComputePassDescriptor): void;
  /** Remove a user pass by name; returns true if one was registered. */
  removePass(name: string): boolean;
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
  // Opt into a persistent rgba16float linear HDR scene buffer: the lit scene is
  // rendered into rgba16float (in-material tonemap skipped) and exposure +
  // tonemap + sRGB encode run as a final post stage over that buffer. When
  // omitted the legacy 8-bit-swapchain in-material tonemap path is unchanged.
  readonly exposure?: number;
  readonly postEffects?: readonly WebGpuPostEffect[];
  // M3-T3: opt the swapchain post target into the single-encoder FrameGraph path.
  readonly useFrameGraph?: boolean;
}

export interface CreateWebGpuAppSuccess {
  readonly ok: true;
  readonly app: WebGpuApp;
  readonly initialization: WebGpuInitializationSuccess;
}

export type CreateWebGpuAppResult = CreateWebGpuAppSuccess | WebGpuFailure;
