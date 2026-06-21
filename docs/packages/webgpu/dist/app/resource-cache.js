import { createMaterialQueueScratch, createPackedSnapshotInstanceTintsScratch, createPackedSnapshotPreviousTransformsScratch, createPackedSnapshotTransformsScratch, createPackedSnapshotViewUniformsScratch, createPreparedMaterialStore, createPreparedMeshStore, } from "@aperture-engine/render";
import { createWebGpuAppRenderPhaseTimingHistory, } from "./app-phase-timing.js";
import { createWebGpuEnvironmentResourceCache, } from "./app-environment-resources.js";
import { createGpuOcclusionFeedbackState, } from "../gpu/occlusion-query.js";
import { createIndirectDrawCommandCache, } from "../render/draw/indirect-draw-commands.js";
import { createRenderBundleCache, } from "../render/draw/render-bundle.js";
import { createRenderFramePlanScratch, } from "../render/frame/render-frame-plan.js";
import { createDrawOrderTransformBufferCache, createDrawOrderTransformPackingScratch, } from "../render/frame/draw-order-transform-packing.js";
import { createQueuedBuiltInAppRouteCollectorScratch, } from "../render/queues/queued-built-in-app-resource-set.js";
import { createQueuedBuiltInFrameResourceScratch, } from "../render/queues/queued-built-in-frame-resource-set.js";
import { createWebGpuDepthTextureCacheSlot, } from "../resources/textures/depth-texture-resource.js";
import { createWebGpuMsaaColorTextureCacheSlot, } from "../gpu/msaa.js";
import { createPreparedMeshGpuResourceCache, } from "../resources/meshes/prepared-mesh-cache.js";
import { createPreparedBuiltInMaterialStore, } from "../materials/core/prepared-built-in-material-store.js";
import { createStandardAppFrameResourceCacheSlot, } from "../materials/standard/standard-app-frame-resources.js";
import { createWebGpuPostPassTextureCacheSlot, } from "../post/post-pass.js";
import { createWebGpuAppPostPassColorHistorySlot, } from "../post/post-color-history.js";
import { createWorldTransformBufferDescriptorScratch, } from "../resources/transforms/world-transform-buffer.js";
import { createQueuedBuiltInSharedFrameResourceCache, } from "./queued-frame-shared-resources.js";
export function createWebGpuAppResourceCache() {
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
        proceduralSkyPipelines: new Map(),
        proceduralSkyUniforms: new Map(),
        customWgslRuntimeUniforms: new Map(),
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
            previousWorldTransformsScratch: createPackedSnapshotPreviousTransformsScratch(),
            previousWorldTransformDescriptorScratch: createWorldTransformBufferDescriptorScratch(),
            previousWorldTransformResource: null,
            previousWorldTransformByteLength: 0,
        },
        frameScratch: createWebGpuAppFrameScratch(),
        drawOrderTransforms: createDrawOrderTransformBufferCache(),
        unlitFrame: createWebGpuAppFrameResourceCacheSlot(),
        matcapFrame: createWebGpuAppFrameResourceCacheSlot(),
        standardFrame: createStandardAppFrameResourceCacheSlot(),
        debugNormalFrame: createWebGpuAppFrameResourceCacheSlot(),
        depth: createWebGpuDepthTextureCacheSlot(),
        depthByRenderTarget: new Map(),
        msaaColor: createWebGpuMsaaColorTextureCacheSlot(),
        msaaColorByRenderTarget: new Map(),
    };
}
function createWebGpuAppFrameResourceCacheSlot() {
    return { current: null };
}
function createWebGpuAppFrameScratch() {
    return {
        viewUniforms: createPackedSnapshotViewUniformsScratch(),
        worldTransforms: createPackedSnapshotTransformsScratch(),
        meshWorldTransforms: createPackedSnapshotTransformsScratch(),
        instanceTints: createPackedSnapshotInstanceTintsScratch(),
        framePlan: createRenderFramePlanScratch(),
        materialQueue: createMaterialQueueScratch(),
        queueRoute: createQueuedBuiltInAppRouteCollectorScratch(),
        queuedBuiltInFrameResources: createQueuedBuiltInFrameResourceScratch(),
        drawOrderTransforms: createDrawOrderTransformPackingScratch(),
        viewCommands: [],
        skyboxCommands: [],
        occlusionFallbackCommands: [],
        occlusionCulledCommands: [],
        forwardGraphCommandLists: [],
    };
}
//# sourceMappingURL=resource-cache.js.map