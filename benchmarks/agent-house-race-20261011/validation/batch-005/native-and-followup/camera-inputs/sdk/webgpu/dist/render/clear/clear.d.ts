import type { WebGpuCanvasContextLike, WebGpuDeviceLike } from "../../gpu/initialize-webgpu.js";
export type WebGpuClearFailureReason = "queue-unavailable" | "encoder-unavailable" | "current-texture-unavailable" | "texture-view-unavailable";
export interface WebGpuClearFailure {
    readonly ok: false;
    readonly reason: WebGpuClearFailureReason;
    readonly message: string;
}
export interface WebGpuClearSuccess {
    readonly ok: true;
    readonly commandBuffer: unknown;
}
export type WebGpuClearResult = WebGpuClearSuccess | WebGpuClearFailure;
export interface WebGpuClearColor {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}
export interface WebGpuClearOptions {
    readonly device: WebGpuClearDeviceLike;
    readonly context: WebGpuClearContextLike;
    readonly color?: WebGpuClearColor;
    readonly depth?: number;
    readonly stencil?: number;
}
export interface WebGpuClearDeviceLike extends WebGpuDeviceLike {
    readonly queue?: {
        submit(commandBuffers: readonly unknown[]): void;
    };
    createCommandEncoder?: () => WebGpuCommandEncoderLike;
}
export interface WebGpuClearContextLike extends WebGpuCanvasContextLike {
    getCurrentTexture?: () => WebGpuTextureLike | null;
}
export interface WebGpuTextureLike {
    createView?: () => unknown;
}
export interface WebGpuCommandEncoderLike {
    beginRenderPass(descriptor: unknown): WebGpuRenderPassEncoderLike;
    finish(): unknown;
}
export interface WebGpuRenderPassEncoderLike {
    end(): void;
}
export declare function clearWebGpuCanvas(options: WebGpuClearOptions): WebGpuClearResult;
//# sourceMappingURL=clear.d.ts.map