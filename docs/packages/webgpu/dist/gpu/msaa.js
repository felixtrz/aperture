import { WEBGPU_TEXTURE_USAGE_FLAGS } from "../resources/textures/texture-resources.js";
// WebGPU core only guarantees sampleCount 1 and 4 (other counts are not exposed
// by any runtime capability query; three.js and PlayCanvas likewise use only 1/4
// on WebGPU). The real device check is texture-creation validation, handled by the
// try/catch in createOrReuseWebGpuMsaaColorTexture. Selection is data-driven from
// this set so a future device feature can widen it by editing the array + type
// without touching the selection logic.
const WEBGPU_SUPPORTED_MSAA_SAMPLE_COUNTS = [1, 4];
export function resolveWebGpuMsaaConfig(requestedSampleCount) {
    const requested = sanitizeRequestedSampleCount(requestedSampleCount);
    const sampleCount = nearestSupportedSampleCount(requested, WEBGPU_SUPPORTED_MSAA_SAMPLE_COUNTS);
    return {
        requestedSampleCount: requested,
        sampleCount,
        enabled: sampleCount > 1,
        clamped: requested !== sampleCount,
        supportedSampleCounts: WEBGPU_SUPPORTED_MSAA_SAMPLE_COUNTS,
    };
}
/**
 * Picks the supported sample count for a requested count: the smallest supported
 * value &gt;= the request (round up to the next supported quality so e.g. a request
 * of 2 enables 4x MSAA rather than disabling it), capped at the largest supported
 * value. With the current `[1, 4]` set this yields 1->1, 2..4->4, &gt;4->4.
 */
function nearestSupportedSampleCount(requested, supported) {
    const ascending = [...supported].sort((a, b) => a - b);
    const atLeastRequested = ascending.find((count) => count >= requested);
    // 1x (no MSAA) is always supported, so it is the safe fallback if the request
    // exceeds the largest supported count or the set is somehow empty.
    return atLeastRequested ?? ascending[ascending.length - 1] ?? 1;
}
export function createWebGpuMsaaColorTextureCacheSlot() {
    return { current: null };
}
export function createOrReuseWebGpuMsaaColorTexture(options) {
    if (options.sampleCount <= 1) {
        return {
            valid: true,
            status: "disabled",
            resource: null,
            diagnostics: [],
        };
    }
    const width = Math.max(1, Math.floor(options.width));
    const height = Math.max(1, Math.floor(options.height));
    const current = options.cache.current;
    if (current !== null &&
        current.width === width &&
        current.height === height &&
        current.format === options.format &&
        current.sampleCount === options.sampleCount) {
        return {
            valid: true,
            status: "reused",
            resource: current,
            diagnostics: [],
        };
    }
    if (options.device.createTexture === undefined) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: [
                {
                    code: "webGpuMsaaColorTexture.createTextureUnavailable",
                    message: "WebGPU MSAA color target creation requires createTexture.",
                },
            ],
        };
    }
    current?.texture.destroy?.();
    let texture;
    try {
        texture = options.device.createTexture({
            label: options.label,
            size: { width, height },
            format: options.format,
            sampleCount: options.sampleCount,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
        });
    }
    catch (cause) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: [
                {
                    code: "webGpuMsaaColorTexture.textureCreationFailed",
                    message: `WebGPU MSAA color texture creation failed: ${messageFromCause(cause)}`,
                },
            ],
        };
    }
    const view = texture.createView?.();
    if (view === undefined) {
        texture.destroy?.();
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: [
                {
                    code: "webGpuMsaaColorTexture.textureViewCreationFailed",
                    message: "WebGPU MSAA color texture did not provide a texture view.",
                },
            ],
        };
    }
    const resource = {
        texture,
        view,
        width,
        height,
        format: options.format,
        sampleCount: options.sampleCount,
        label: options.label,
    };
    options.cache.current = resource;
    return {
        valid: true,
        status: "created",
        resource,
        diagnostics: [],
    };
}
function sanitizeRequestedSampleCount(requestedSampleCount) {
    if (requestedSampleCount === undefined ||
        !Number.isFinite(requestedSampleCount)) {
        return 1;
    }
    return Math.max(1, Math.floor(requestedSampleCount));
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=msaa.js.map