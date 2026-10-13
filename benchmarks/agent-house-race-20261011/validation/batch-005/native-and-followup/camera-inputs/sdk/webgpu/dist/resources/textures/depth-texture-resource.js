import { WEBGPU_TEXTURE_USAGE_FLAGS } from "./texture-resources.js";
export const WEBGPU_APP_DEPTH_FORMAT = "depth24plus";
export function createWebGpuDepthTextureCacheSlot() {
    return { current: null };
}
export function createOrReuseWebGpuDepthTexture(options) {
    const format = options.format ?? WEBGPU_APP_DEPTH_FORMAT;
    const width = Math.max(1, Math.floor(options.width));
    const height = Math.max(1, Math.floor(options.height));
    const sampleCount = Math.max(1, Math.floor(options.sampleCount ?? 1));
    const current = options.cache.current;
    if (current !== null &&
        current.format === format &&
        current.width === width &&
        current.height === height &&
        current.sampleCount === sampleCount) {
        return { status: "reused", resource: current };
    }
    current?.texture.destroy?.();
    const texture = options.device.createTexture({
        label: options.label ?? "aperture/webgpu-app/depth",
        size: [width, height, 1],
        format,
        sampleCount,
        usage: webGpuRenderAttachmentUsage(),
    });
    const resource = {
        format,
        width,
        height,
        sampleCount,
        texture,
        view: texture.createView(),
    };
    options.cache.current = resource;
    return { status: "created", resource };
}
function webGpuRenderAttachmentUsage() {
    const usage = globalThis.GPUTextureUsage;
    return ((usage?.RENDER_ATTACHMENT ?? WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT) |
        (usage?.TEXTURE_BINDING ?? WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING));
}
//# sourceMappingURL=depth-texture-resource.js.map