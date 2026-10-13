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
import { createWebGpuFeatureRealizerRegistry, } from "./feature-command-groups.js";
import { registerBuiltInWebGpuFeatureRealizers } from "./built-in-feature-realizers.js";
export function createWebGpuAppResourceCache(registerBuiltIns = true, geometryInspection) {
    const cache = {
        ...(geometryInspection === undefined ? {} : { geometryInspection }),
        featureRealizers: createWebGpuFeatureRealizerRegistry(),
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
        particleSoftParams: new Map(),
        skyboxPipelines: new Map(),
        proceduralSkyPipelines: new Map(),
        proceduralSkyUniforms: new Map(),
        customWgslRuntimeUniforms: new Map(),
        layouts: new Map(),
        textures: new Map(),
        samplers: new Map(),
        localLightCookieMatrices: new Map(),
        environmentResources: createWebGpuEnvironmentResourceCache(),
        preparedMeshes: createPreparedMeshGpuResourceCache(geometryInspection),
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
    if (registerBuiltIns)
        registerBuiltInWebGpuFeatureRealizers(cache);
    return cache;
}
/** Explicit cache schema reset; never traverses or destroys borrowed GPU objects. */
export function clearWebGpuAppResourceCache(cache) {
    for (const map of [
        cache.pipelines,
        cache.spritePipelines,
        cache.msdfTextPipelines,
        cache.uiPanelPipelines,
        cache.uiImagePipelines,
        cache.particleComputePipelines,
        cache.particleRenderPipelines,
        cache.particleEmitterStates,
        cache.particleBurstCpuStates,
        cache.particleBurstBatchStates,
        cache.particleSoftParams,
        cache.skyboxPipelines,
        cache.proceduralSkyPipelines,
        cache.proceduralSkyUniforms,
        cache.customWgslRuntimeUniforms,
        cache.layouts,
        cache.textures,
        cache.samplers,
        cache.localLightCookieMatrices,
        cache.idPickPipelines,
        cache.gpuTimings,
        cache.occlusionQueries,
        cache.depthByRenderTarget,
        cache.msaaColorByRenderTarget,
        cache.preparedMeshes.resources,
        cache.preparedMaterials.unlit.resources,
        cache.preparedMaterials.matcap.resources,
        cache.preparedMaterials.standard.resources,
        cache.preparedMaterials.debugNormal.resources,
        cache.renderBundles.entries,
        cache.drawOrderTransforms.bindGroupsByPipelineKey,
        cache.postPasses.previousViewProjectionByViewId,
        cache.postPasses.previousWorldTransformsByRenderId,
        cache.occlusionFeedback.lastTestedFrameByQueryKey,
        cache.environmentResources.equirectProjections,
        cache.environmentResources.diffuseTextures,
        cache.environmentResources.specularTextures,
        cache.environmentResources.samplers,
        cache.environmentResources.standardIblBindGroups,
        cache.environmentResources.shadowSamplers,
        cache.environmentResources.standardShadowBindGroups,
        cache.environmentResources.shadowCasterPipelines,
        cache.environmentResources.shadowCasterMatrixBindGroups,
        cache.environmentResources.shadowDepthTextures,
        cache.environmentResources.shadowMatrixBuffers,
        cache.environmentResources.shadowCasterPassMatrixBuffers,
        cache.environmentResources.shadowCasterWorldTransformBuffers,
        cache.environmentResources.shadowCasterCommandTopology,
    ])
        map.clear();
    cache.preparedMeshFacade.clear();
    cache.preparedMaterialFacade.clear();
    cache.occlusionFeedback.occludedQueryKeys.clear();
    // Drop typed scratch arrays, slots and CPU histories using the same typed
    // factory that defines the cache. No new feature callbacks are registered.
    Object.assign(cache, createWebGpuAppResourceCache(false));
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