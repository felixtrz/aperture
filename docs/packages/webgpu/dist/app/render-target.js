import { assetHandleKey, } from "@aperture-engine/simulation";
export function createWebGpuAppRenderTargetAsset(input) {
    if (!Number.isInteger(input.width) || input.width <= 0) {
        throw new RangeError("WebGPU app render target width must be positive.");
    }
    if (!Number.isInteger(input.height) || input.height <= 0) {
        throw new RangeError("WebGPU app render target height must be positive.");
    }
    return Object.freeze({
        texture: input.texture,
        width: input.width,
        height: input.height,
        ...(input.format === undefined ? {} : { format: input.format }),
        ...(input.label === undefined ? {} : { label: input.label }),
    });
}
export function createWebGpuAppRenderTargetDiagnostic(input) {
    return {
        code: input.code,
        message: input.message,
        viewId: input.viewId,
        renderTargetKey: assetHandleKey(input.renderTarget),
        ...(input.status === undefined ? {} : { status: input.status }),
    };
}
export function isWebGpuAppRenderTargetAsset(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const asset = value;
    const width = asset.width;
    const height = asset.height;
    return (typeof asset.texture === "object" &&
        asset.texture !== null &&
        typeof asset.texture.createView === "function" &&
        width !== undefined &&
        Number.isInteger(width) &&
        width > 0 &&
        height !== undefined &&
        Number.isInteger(height) &&
        height > 0 &&
        (asset.format === undefined || typeof asset.format === "string"));
}
//# sourceMappingURL=render-target.js.map