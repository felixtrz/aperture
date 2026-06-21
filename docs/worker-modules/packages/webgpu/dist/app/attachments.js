import { createOrReuseWebGpuMsaaColorTexture, createWebGpuMsaaColorTextureCacheSlot, } from "../gpu/msaa.js";
import { createOrReuseWebGpuDepthTexture, createWebGpuDepthTextureCacheSlot, WEBGPU_APP_DEPTH_FORMAT, } from "../resources/textures/depth-texture-resource.js";
export function createWebGpuAppDepthAttachmentForTarget(app, resourceCache, target) {
    return createOrReuseWebGpuDepthTexture({
        device: app.initialization.device,
        cache: depthCacheSlotForTarget(resourceCache, target),
        width: target.width,
        height: target.height,
        format: WEBGPU_APP_DEPTH_FORMAT,
        sampleCount: app.msaa.sampleCount,
    }).resource;
}
export function createWebGpuAppMsaaColorTargetForTarget(app, resourceCache, target) {
    const result = createOrReuseWebGpuMsaaColorTexture({
        device: app.initialization.device,
        cache: msaaColorCacheSlotForTarget(resourceCache, target),
        width: target.width,
        height: target.height,
        format: target.source === "swapchain" ? app.sceneRenderFormat : target.format,
        sampleCount: app.msaa.sampleCount,
        label: target.source === "swapchain"
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
export function createWebGpuAppMsaaReport(input) {
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
function depthCacheSlotForTarget(resourceCache, target) {
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
function msaaColorCacheSlotForTarget(resourceCache, target) {
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
//# sourceMappingURL=attachments.js.map