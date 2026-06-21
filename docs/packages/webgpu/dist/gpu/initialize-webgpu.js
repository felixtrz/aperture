const WEBGPU_TEXTURE_COMPRESSION_FEATURES = [
    "texture-compression-astc",
    "texture-compression-bc",
    "texture-compression-etc2",
];
export const WEBGPU_FAILURE_MESSAGES = {
    "navigator-gpu-unavailable": "WebGPU is unavailable because navigator.gpu is missing.",
    "adapter-unavailable": "WebGPU adapter request returned no adapter.",
    "device-request-failed": "WebGPU device request failed.",
    "context-unavailable": "WebGPU canvas context is unavailable.",
    "context-configure-failed": "WebGPU canvas context configuration failed.",
    "device-lost": "WebGPU device was lost.",
};
export function detectWebGpuSupport(environment = defaultEnvironment()) {
    const gpu = environment.navigator?.gpu;
    if (gpu === undefined) {
        return failure("navigator-gpu-unavailable");
    }
    return { ok: true, gpu };
}
export async function initializeWebGpu(options = {}) {
    const support = detectWebGpuSupport(options.environment);
    if (!support.ok) {
        return support;
    }
    const adapter = await support.gpu.requestAdapter(options.adapterOptions);
    if (adapter === null) {
        return failure("adapter-unavailable");
    }
    let device;
    try {
        device = await adapter.requestDevice(deviceDescriptorWithOptionalFeatures(adapter, options.deviceDescriptor, {
            timestampQuery: options.timestampQuery ?? "auto",
            textureCompression: options.textureCompression ?? "auto",
            indirectFirstInstance: options.indirectFirstInstance ?? "auto",
        }));
    }
    catch (cause) {
        return failure("device-request-failed", cause);
    }
    const context = options.context ?? options.canvas?.getContext("webgpu") ?? null;
    if (context === null) {
        return failure("context-unavailable");
    }
    const format = support.gpu.getPreferredCanvasFormat?.() ?? "bgra8unorm";
    try {
        context.configure({
            device,
            format,
            colorSpace: options.displayColorSpace ?? "srgb",
            alphaMode: options.alphaMode ?? "opaque",
            ...(options.textureUsage === undefined
                ? {}
                : { usage: options.textureUsage }),
        });
    }
    catch (cause) {
        return failure("context-configure-failed", cause);
    }
    return {
        ok: true,
        gpu: support.gpu,
        adapter,
        device,
        context,
        format,
        displayColorSpace: options.displayColorSpace ?? "srgb",
        deviceLost: device.lost === undefined
            ? null
            : device.lost.then((info) => failure("device-lost", info, info.message ?? WEBGPU_FAILURE_MESSAGES["device-lost"])),
    };
}
function defaultEnvironment() {
    return globalThis;
}
function deviceDescriptorWithOptionalFeatures(adapter, descriptor, options) {
    const features = [];
    if (options.timestampQuery !== false) {
        const timestampSupported = adapter.features?.has?.("timestamp-query") === true;
        if (timestampSupported || options.timestampQuery === true) {
            features.push("timestamp-query");
        }
    }
    if (options.textureCompression !== false) {
        for (const feature of WEBGPU_TEXTURE_COMPRESSION_FEATURES) {
            if (adapter.features?.has?.(feature) === true) {
                features.push(feature);
            }
        }
    }
    if (options.indirectFirstInstance !== false) {
        const indirectFirstInstanceSupported = adapter.features?.has?.("indirect-first-instance") === true;
        if (indirectFirstInstanceSupported ||
            options.indirectFirstInstance === true) {
            features.push("indirect-first-instance");
        }
    }
    return deviceDescriptorWithRequiredFeatures(descriptor, features);
}
function deviceDescriptorWithRequiredFeatures(descriptor, features) {
    if (features.length === 0) {
        return descriptor;
    }
    const source = typeof descriptor === "object" && descriptor !== null ? descriptor : {};
    const requiredFeatures = requiredFeatureList(source);
    const mergedFeatures = [...requiredFeatures];
    for (const feature of features) {
        if (!mergedFeatures.includes(feature)) {
            mergedFeatures.push(feature);
        }
    }
    if (mergedFeatures.length === requiredFeatures.length) {
        return descriptor;
    }
    return {
        ...source,
        requiredFeatures: mergedFeatures,
    };
}
function requiredFeatureList(descriptor) {
    const candidate = descriptor
        .requiredFeatures;
    if (Array.isArray(candidate)) {
        return candidate.filter((feature) => typeof feature === "string");
    }
    if (candidate !== null &&
        typeof candidate === "object" &&
        Symbol.iterator in candidate) {
        return Array.from(candidate).filter((feature) => typeof feature === "string");
    }
    return [];
}
function failure(reason, cause, message = WEBGPU_FAILURE_MESSAGES[reason]) {
    const result = { ok: false, reason, message };
    if (cause !== undefined) {
        return { ...result, cause };
    }
    return result;
}
//# sourceMappingURL=initialize-webgpu.js.map