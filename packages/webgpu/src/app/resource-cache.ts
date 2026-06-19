import {
  createMaterialQueueScratch,
  createPackedSnapshotInstanceTintsScratch,
  createPackedSnapshotPreviousTransformsScratch,
  createPackedSnapshotTransformsScratch,
  createPackedSnapshotViewUniformsScratch,
  createPreparedMaterialStore,
  createPreparedMeshStore,
  type MaterialQueueScratch,
  type PreparedMaterialStore,
  type PreparedMeshStore,
} from "@aperture-engine/render";
import {
  createWebGpuAppRenderPhaseTimingHistory,
  type WebGpuAppRenderPhaseTimingHistory,
} from "./app-phase-timing.js";
import {
  createWebGpuEnvironmentResourceCache,
  type WebGpuEnvironmentResourceCache,
} from "./app-environment-resources.js";
import {
  createGpuOcclusionFeedbackState,
  type GpuOcclusionFeedbackState,
  type GpuOcclusionQueryResources,
} from "../gpu/occlusion-query.js";
import type {
  GpuTimestampBufferLike,
  GpuTimestampQueryDiagnostic,
  GpuTimestampQueryResources,
} from "../gpu/gpu-timing.js";
import {
  createIndirectDrawCommandCache,
  type IndirectDrawCommandCache,
} from "../render/draw/indirect-draw-commands.js";
import {
  createRenderBundleCache,
  type RenderBundleCache,
} from "../render/draw/render-bundle.js";
import {
  createRenderFramePlanScratch,
  type RenderFramePlanScratch,
} from "../render/frame/render-frame-plan.js";
import {
  createDrawOrderTransformBufferCache,
  createDrawOrderTransformPackingScratch,
  type DrawOrderTransformBufferCache,
  type DrawOrderTransformPackingScratch,
} from "../render/frame/draw-order-transform-packing.js";
import type { CreateSpriteRenderPipelineResourceResult } from "../render/sprites/sprite-pipeline.js";
import type { CreateMsdfTextRenderPipelineResourceResult } from "../render/text/msdf-text-pipeline.js";
import type { CreateUiQuadRenderPipelineResourceResult } from "../render/ui/ui-quad-pipeline.js";
import type {
  CreateParticleComputePipelineResourceResult,
  CreateParticleRenderPipelineResourceResult,
} from "../render/particles/particle-pipeline.js";
import type { CreateSkyboxRenderPipelineResourceResult } from "../render/skybox/skybox-pipeline.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import {
  createQueuedBuiltInAppRouteCollectorScratch,
  type QueuedBuiltInAppRouteCollectorScratch,
} from "../render/queues/queued-built-in-app-resource-set.js";
import {
  createQueuedBuiltInFrameResourceScratch,
  type QueuedBuiltInFrameResourceScratch,
} from "../render/queues/queued-built-in-frame-resource-set.js";
import {
  createWebGpuDepthTextureCacheSlot,
  type WebGpuDepthTextureCacheSlot,
} from "../resources/textures/depth-texture-resource.js";
import {
  createWebGpuMsaaColorTextureCacheSlot,
  type WebGpuMsaaColorTextureCacheSlot,
} from "../gpu/msaa.js";
import {
  createPreparedMeshGpuResourceCache,
  type PreparedMeshGpuResourceCache,
} from "../resources/meshes/prepared-mesh-cache.js";
import {
  createPreparedBuiltInMaterialStore,
  type PreparedBuiltInMaterialStore,
} from "../materials/core/prepared-built-in-material-store.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "../resources/textures/texture-resources.js";
import type { LocalLightClusterCookieMatrixResource } from "../lighting/local-light-cookie-resources.js";
import type { WebGpuIdBufferPickPipelineResource } from "../picking/id-buffer-pick.js";
import type {
  CachedUnlitAppFrameResources,
  UnlitAppFrameResourceCacheSlot,
} from "../materials/unlit/unlit-app-frame-resources.js";
import type {
  CachedMatcapAppFrameResources,
  MatcapAppFrameResourceCacheSlot,
} from "../materials/matcap/matcap-app-frame-resources.js";
import {
  createStandardAppFrameResourceCacheSlot,
  type StandardAppFrameResourceCacheSlot,
} from "../materials/standard/standard-app-frame-resources.js";
import type {
  CachedDebugNormalAppFrameResources,
  DebugNormalAppFrameResourceCacheSlot,
} from "../materials/debug-normal/debug-normal-app-frame-resources.js";
import type { StandardFrameShadowReceiverResources } from "../materials/standard/standard-frame-resources.js";
import {
  createWebGpuPostPassTextureCacheSlot,
  type WebGpuPostPassTextureCacheSlot,
} from "../post/post-pass.js";
import {
  createWebGpuAppPostPassColorHistorySlot,
  type WebGpuAppPostPassColorHistorySlot,
} from "../post/post-color-history.js";
import {
  createWorldTransformBufferDescriptorScratch,
  type WorldTransformBufferDescriptorScratch,
  type WorldTransformGpuBufferResource,
} from "../resources/transforms/world-transform-buffer.js";
import type { WebGpuAppPipelineResourceResult } from "./app.js";
import type { WebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import {
  createQueuedBuiltInSharedFrameResourceCache,
  type QueuedBuiltInSharedFrameResourceCache,
} from "./queued-frame-shared-resources.js";
import type { RenderShadowFrameReport } from "../shadows/render-shadow-frame.js";

export interface WebGpuAppResourceCache {
  readonly pipelines: Map<string, WebGpuAppPipelineResourceResult>;
  readonly spritePipelines: Map<
    string,
    CreateSpriteRenderPipelineResourceResult
  >;
  readonly msdfTextPipelines: Map<
    string,
    CreateMsdfTextRenderPipelineResourceResult
  >;
  readonly uiPanelPipelines: Map<
    string,
    CreateUiQuadRenderPipelineResourceResult
  >;
  readonly uiImagePipelines: Map<
    string,
    CreateUiQuadRenderPipelineResourceResult
  >;
  readonly particleComputePipelines: Map<
    string,
    CreateParticleComputePipelineResourceResult
  >;
  readonly particleRenderPipelines: Map<
    string,
    CreateParticleRenderPipelineResourceResult
  >;
  readonly particleEmitterStates: Map<string, ParticleEmitterGpuStateResource>;
  readonly particleBurstCpuStates: Map<string, ParticleEmitterCpuStateResource>;
  readonly particleBurstBatchStates: Map<
    string,
    ParticleBurstBatchGpuStateResource
  >;
  particleViewUniformBuffer: ParticleViewUniformBufferResource | null;
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
  readonly queuedBuiltInSharedFrame: QueuedBuiltInSharedFrameResourceCache;
  readonly idPickPipelines: Map<string, WebGpuIdBufferPickPipelineResource>;
  readonly gpuTimings: Map<string, WebGpuAppGpuTimingCacheEntry>;
  readonly phaseTimingHistory: WebGpuAppRenderPhaseTimingHistory;
  autoShadowFrame: CachedWebGpuAppAutoShadowFrame | null;
  readonly occlusionQueries: Map<string, GpuOcclusionQueryResources>;
  readonly occlusionFeedback: GpuOcclusionFeedbackState;
  readonly renderBundles: RenderBundleCache;
  readonly indirectDraws: IndirectDrawCommandCache;
  readonly postPasses: WebGpuAppPostPassCache;
  readonly frameScratch: WebGpuAppFrameScratch;
  readonly drawOrderTransforms: DrawOrderTransformBufferCache;
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

export interface CachedWebGpuAppAutoShadowFrame {
  readonly frame: number;
  readonly inputKey: string | null;
  readonly receiverResources: StandardFrameShadowReceiverResources;
  readonly report: RenderShadowFrameReport;
}

export interface ParticleEmitterGpuStateResource {
  readonly key: string;
  readonly emitterId: number;
  readonly effectVersion: number;
  readonly capacity: number;
  readonly resetEpoch: number;
  readonly particleBuffer: unknown;
  readonly byteLength: number;
  readonly cpu?: ParticleEmitterCpuStateResource;
}

export interface ParticleEmitterCpuStateResource {
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly ages: Float32Array;
  readonly lifetimes: Float32Array;
  readonly baseSizes: Float32Array;
  readonly bufferData: Float32Array;
  initialized: boolean;
  startTime: number;
  lastTime: number;
  liveCount: number;
  maxLifetime: number;
  uniformLifetime: boolean;
}

export interface ParticleBurstBatchSlot {
  readonly key: string;
  readonly offset: number;
  readonly capacity: number;
}

export interface ParticleBurstBatchFreeSlot {
  readonly offset: number;
  readonly capacity: number;
}

export interface ParticleBurstBatchGpuStateResource {
  readonly key: string;
  readonly capacity: number;
  readonly particleBuffer: unknown;
  readonly byteLength: number;
  readonly bufferData: Float32Array;
  readonly slotsByBurstKey: Map<string, ParticleBurstBatchSlot>;
  readonly freeSlots: ParticleBurstBatchFreeSlot[];
  nextParticleSlot: number;
  paramBuffer: unknown | null;
  paramByteLength: number;
  paramData: Float32Array | null;
}

export interface ParticleViewUniformBufferResource {
  readonly buffer: unknown;
  readonly byteLength: number;
}

export interface WebGpuAppPostPassCache {
  readonly scene: WebGpuPostPassTextureCacheSlot;
  readonly ping: WebGpuPostPassTextureCacheSlot;
  readonly pong: WebGpuPostPassTextureCacheSlot;
  readonly motionVector: WebGpuPostPassTextureCacheSlot;
  readonly indirectColor: WebGpuPostPassTextureCacheSlot;
  readonly transmissionGrab: WebGpuPostPassTextureCacheSlot;
  // M3-T6: TAA color history as a double-buffered FrameGraph history pool
  // (current/previous), replacing the per-effect ping/pong closure for the
  // graph post path. Motion-vector GEOMETRY history (the previous* fields
  // below) is intentionally left as-is — out of scope for T6.
  readonly taaColorHistory: WebGpuAppPostPassColorHistorySlot;
  readonly previousViewProjectionByViewId: Map<number, Float32Array>;
  readonly previousWorldTransformsByRenderId: Map<number, Float32Array>;
  readonly previousWorldTransformsScratch: ReturnType<
    typeof createPackedSnapshotPreviousTransformsScratch
  >;
  readonly previousWorldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
  previousWorldTransformResource: WorldTransformGpuBufferResource | null;
  previousWorldTransformByteLength: number;
}

export interface WebGpuAppFrameScratch {
  readonly viewUniforms: ReturnType<
    typeof createPackedSnapshotViewUniformsScratch
  >;
  readonly worldTransforms: ReturnType<
    typeof createPackedSnapshotTransformsScratch
  >;
  readonly meshWorldTransforms: ReturnType<
    typeof createPackedSnapshotTransformsScratch
  >;
  readonly instanceTints: ReturnType<
    typeof createPackedSnapshotInstanceTintsScratch
  >;
  readonly framePlan: RenderFramePlanScratch;
  readonly materialQueue: MaterialQueueScratch;
  readonly queueRoute: QueuedBuiltInAppRouteCollectorScratch;
  readonly queuedBuiltInFrameResources: QueuedBuiltInFrameResourceScratch<WebGpuAppPipelinePlanResult>;
  readonly drawOrderTransforms: DrawOrderTransformPackingScratch;
  readonly viewCommands: RenderPassCommand[];
  readonly skyboxCommands: RenderPassCommand[];
  readonly occlusionFallbackCommands: RenderPassCommand[];
  readonly occlusionCulledCommands: RenderPassCommand[];
  /**
   * Per-node command snapshots for the forward FrameGraph route. Graph nodes
   * encode AFTER the per-target assembly loop, so their payloads cannot alias
   * the per-view scratch above (every node would replay the last target's
   * commands); each registered node snapshots into its own reused list,
   * indexed by registration order.
   */
  readonly forwardGraphCommandLists: RenderPassCommand[][];
}

export interface WebGpuAppGpuTimingCacheEntry {
  readonly passName: string;
  readonly resources: GpuTimestampQueryResources | null;
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
  /**
   * Rotating readback buffers for the pass (slot 0 is
   * `resources.readbackBuffer`). A slot stays busy from the frame that encodes
   * a copy into it until that frame's CPU read unmaps it, so a later frame
   * never submits a copy into a buffer that is still mapped or pending map
   * ("used in submit while mapped"). Kept small — overlap deeper than the ring
   * skips GPU timing for that frame instead of growing unbounded.
   */
  readonly readbackRing: GpuTimestampBufferLike[];
  readonly busyReadbacks: Set<GpuTimestampBufferLike>;
}

export interface WebGpuAppFrameResourceCacheSlot<TCachedFrameResources> {
  current: TCachedFrameResources | null;
}

export interface WebGpuAppPipelinePlanResult {
  readonly ok: true;
  readonly status: "miss";
  readonly key: string;
  readonly pipeline: unknown;
  readonly diagnostics: readonly [];
}

export function createWebGpuAppResourceCache(): WebGpuAppResourceCache {
  return {
    pipelines: new Map(),
    spritePipelines: new Map(),
    msdfTextPipelines: new Map(),
    uiPanelPipelines: new Map(),
    uiImagePipelines: new Map(),
    particleComputePipelines: new Map(),
    particleRenderPipelines: new Map(),
    particleEmitterStates: new Map(),
    particleBurstCpuStates: new Map(),
    particleBurstBatchStates: new Map(),
    particleViewUniformBuffer: null,
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
    queuedBuiltInSharedFrame: createQueuedBuiltInSharedFrameResourceCache(),
    idPickPipelines: new Map(),
    gpuTimings: new Map(),
    phaseTimingHistory: createWebGpuAppRenderPhaseTimingHistory(),
    autoShadowFrame: null,
    occlusionQueries: new Map(),
    occlusionFeedback: createGpuOcclusionFeedbackState(),
    renderBundles: createRenderBundleCache(),
    indirectDraws: createIndirectDrawCommandCache(),
    postPasses: {
      scene: createWebGpuPostPassTextureCacheSlot(),
      ping: createWebGpuPostPassTextureCacheSlot(),
      pong: createWebGpuPostPassTextureCacheSlot(),
      motionVector: createWebGpuPostPassTextureCacheSlot(),
      indirectColor: createWebGpuPostPassTextureCacheSlot(),
      transmissionGrab: createWebGpuPostPassTextureCacheSlot(),
      taaColorHistory: createWebGpuAppPostPassColorHistorySlot(),
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
    drawOrderTransforms: createDrawOrderTransformBufferCache(),
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
    meshWorldTransforms: createPackedSnapshotTransformsScratch(),
    instanceTints: createPackedSnapshotInstanceTintsScratch(),
    framePlan: createRenderFramePlanScratch(),
    materialQueue: createMaterialQueueScratch(),
    queueRoute: createQueuedBuiltInAppRouteCollectorScratch(),
    queuedBuiltInFrameResources:
      createQueuedBuiltInFrameResourceScratch<WebGpuAppPipelinePlanResult>(),
    drawOrderTransforms: createDrawOrderTransformPackingScratch(),
    viewCommands: [],
    skyboxCommands: [],
    occlusionFallbackCommands: [],
    occlusionCulledCommands: [],
    forwardGraphCommandLists: [],
  };
}
