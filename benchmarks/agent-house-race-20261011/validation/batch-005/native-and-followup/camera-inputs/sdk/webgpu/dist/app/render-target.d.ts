import { type RenderTargetHandle } from "@aperture-engine/simulation";
import type { CurrentTextureLike } from "./presentation/current-texture-view.js";
export interface WebGpuAppRenderTargetAssetInput {
    readonly texture: CurrentTextureLike;
    readonly width: number;
    readonly height: number;
    readonly format?: string;
    readonly label?: string;
}
export interface WebGpuAppRenderTargetAsset {
    readonly texture: CurrentTextureLike;
    readonly width: number;
    readonly height: number;
    readonly format?: string;
    readonly label?: string;
}
export declare function createWebGpuAppRenderTargetAsset(input: WebGpuAppRenderTargetAssetInput): WebGpuAppRenderTargetAsset;
export declare function createWebGpuAppRenderTargetDiagnostic(input: {
    readonly code: "webGpuApp.renderTargetMissing" | "webGpuApp.renderTargetNotReady" | "webGpuApp.renderTargetInvalid" | "webGpuApp.renderTargetFormatMismatch";
    readonly viewId: number;
    readonly renderTarget: RenderTargetHandle;
    readonly message: string;
    readonly status?: string;
}): {
    readonly code: typeof input.code;
    readonly message: string;
    readonly viewId: number;
    readonly renderTargetKey: string;
    readonly status?: string;
};
export declare function isWebGpuAppRenderTargetAsset(value: unknown): value is WebGpuAppRenderTargetAsset;
//# sourceMappingURL=render-target.d.ts.map