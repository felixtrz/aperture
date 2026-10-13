import type { WebGpuClearColor, WebGpuClearContextLike, WebGpuClearFailureReason, WebGpuClearResult, WebGpuCommandEncoderLike } from "./clear.js";
export type WebGpuClearReadbackFailureReason = WebGpuClearFailureReason | "texture-usage-unavailable" | "texture-size-invalid" | "unsupported-texture-format" | "buffer-usage-unavailable" | "map-mode-unavailable" | "create-buffer-unavailable" | "copy-texture-to-buffer-unavailable" | "map-read-unavailable" | "mapped-range-unavailable" | "readback-map-failed";
export interface WebGpuReadbackCanvasTextureUsageSuccess {
    readonly ok: true;
    readonly usage: number;
    readonly copySrc: number;
    readonly renderAttachment: number;
}
export interface WebGpuReadbackCanvasTextureUsageFailure {
    readonly ok: false;
    readonly reason: "texture-usage-unavailable";
    readonly message: string;
}
export type WebGpuReadbackCanvasTextureUsageResult = WebGpuReadbackCanvasTextureUsageSuccess | WebGpuReadbackCanvasTextureUsageFailure;
export interface WebGpuTextureUsageEnvironment {
    readonly GPUTextureUsage?: {
        readonly COPY_SRC?: number;
        readonly RENDER_ATTACHMENT?: number;
    };
}
export interface WebGpuBufferUsageEnvironment {
    readonly GPUBufferUsage?: {
        readonly MAP_READ?: number;
        readonly COPY_DST?: number;
    };
    readonly GPUMapMode?: {
        readonly READ?: number;
    };
}
export interface WebGpuReadbackBufferUsage {
    readonly mapRead: number;
    readonly copyDst: number;
}
export interface WebGpuReadbackPixel {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}
export interface WebGpuReadbackOrigin {
    readonly x: number;
    readonly y: number;
}
export interface WebGpuClearReadbackSuccess {
    readonly ok: true;
    readonly source: "current-texture";
    readonly format: string;
    readonly origin: WebGpuReadbackOrigin;
    readonly bytesPerRow: number;
    readonly pixel: WebGpuReadbackPixel;
}
export interface WebGpuClearReadbackFailure {
    readonly ok: false;
    readonly reason: WebGpuClearReadbackFailureReason;
    readonly message: string;
    readonly clearOk: boolean;
}
export type WebGpuClearReadbackResult = WebGpuClearReadbackSuccess | WebGpuClearReadbackFailure;
export interface ClearWebGpuCanvasWithReadbackResult {
    readonly clear: WebGpuClearResult;
    readonly readback: WebGpuClearReadbackResult;
}
export interface WebGpuClearReadbackBufferLike {
    mapAsync?: (mode: number) => Promise<void>;
    getMappedRange?: () => ArrayBuffer | ArrayBufferView;
    unmap?: () => void;
}
export interface WebGpuClearReadbackDeviceLike {
    readonly queue?: {
        submit(commandBuffers: readonly unknown[]): void;
    };
    createCommandEncoder?: () => WebGpuReadbackCommandEncoderLike;
    createBuffer?: (descriptor: unknown) => WebGpuClearReadbackBufferLike;
}
export interface WebGpuReadbackCommandEncoderLike extends WebGpuCommandEncoderLike {
    copyTextureToBuffer?: (source: unknown, destination: unknown, copySize: unknown) => void;
}
export interface ClearWebGpuCanvasWithReadbackOptions {
    readonly device: WebGpuClearReadbackDeviceLike;
    readonly context: WebGpuClearContextLike;
    readonly format: string;
    readonly width: number;
    readonly height: number;
    readonly color?: WebGpuClearColor;
    readonly depth?: number;
    readonly stencil?: number;
    readonly origin?: WebGpuReadbackOrigin;
    readonly bufferUsage?: WebGpuReadbackBufferUsage;
    readonly mapModeRead?: number;
    readonly environment?: WebGpuBufferUsageEnvironment;
}
export declare function createReadbackCanvasTextureUsage(environment?: WebGpuTextureUsageEnvironment): WebGpuReadbackCanvasTextureUsageResult;
export declare function clearWebGpuCanvasWithReadback(options: ClearWebGpuCanvasWithReadbackOptions): Promise<ClearWebGpuCanvasWithReadbackResult>;
//# sourceMappingURL=clear-readback.d.ts.map