export type WebGpuFailureReason = "navigator-gpu-unavailable" | "adapter-unavailable" | "device-request-failed" | "context-unavailable" | "context-configure-failed" | "device-lost";
export interface WebGpuFailure {
    readonly ok: false;
    readonly reason: WebGpuFailureReason;
    readonly message: string;
    readonly cause?: unknown;
}
export interface WebGpuSupportSuccess {
    readonly ok: true;
    readonly gpu: WebGpuLike;
}
export type WebGpuSupportResult = WebGpuSupportSuccess | WebGpuFailure;
export interface WebGpuInitializationSuccess {
    readonly ok: true;
    readonly gpu: WebGpuLike;
    readonly adapter: WebGpuAdapterLike;
    readonly device: WebGpuDeviceLike;
    readonly context: WebGpuCanvasContextLike;
    readonly format: string;
    readonly displayColorSpace: "srgb";
    readonly deviceLost: Promise<WebGpuFailure> | null;
}
export type WebGpuInitializationResult = WebGpuInitializationSuccess | WebGpuFailure;
export interface WebGpuEnvironment {
    readonly navigator?: WebGpuNavigatorLike;
}
export interface WebGpuNavigatorLike {
    readonly gpu?: WebGpuLike;
}
export interface WebGpuLike {
    requestAdapter(options?: unknown): Promise<WebGpuAdapterLike | null>;
    getPreferredCanvasFormat?: () => string;
}
export interface WebGpuAdapterLike {
    readonly features?: {
        readonly has?: (feature: string) => boolean;
    };
    requestDevice(descriptor?: unknown): Promise<WebGpuDeviceLike>;
}
export interface WebGpuDeviceLostInfoLike {
    readonly reason?: string;
    readonly message?: string;
}
export interface WebGpuDeviceLike {
    destroy?(): void;
    readonly features?: {
        readonly has?: (feature: string) => boolean;
    };
    readonly lost?: Promise<WebGpuDeviceLostInfoLike>;
}
export interface WebGpuCanvasLike {
    getContext(contextId: "webgpu"): WebGpuCanvasContextLike | null;
}
export interface WebGpuCanvasContextLike {
    configure(configuration: {
        readonly device: WebGpuDeviceLike;
        readonly format: string;
        readonly colorSpace?: "srgb";
        readonly alphaMode?: "opaque" | "premultiplied";
        readonly usage?: number;
    }): void;
}
export interface InitializeWebGpuOptions {
    readonly environment?: WebGpuEnvironment;
    readonly canvas?: WebGpuCanvasLike;
    readonly context?: WebGpuCanvasContextLike;
    readonly adapterOptions?: unknown;
    readonly deviceDescriptor?: unknown;
    readonly timestampQuery?: "auto" | boolean;
    readonly textureCompression?: "auto" | boolean;
    readonly indirectFirstInstance?: "auto" | boolean;
    readonly alphaMode?: "opaque" | "premultiplied";
    readonly textureUsage?: number;
    readonly displayColorSpace?: "srgb";
}
export declare const WEBGPU_FAILURE_MESSAGES: Record<WebGpuFailureReason, string>;
export declare function detectWebGpuSupport(environment?: WebGpuEnvironment): WebGpuSupportResult;
export declare function initializeWebGpu(options?: InitializeWebGpuOptions): Promise<WebGpuInitializationResult>;
//# sourceMappingURL=initialize-webgpu.d.ts.map