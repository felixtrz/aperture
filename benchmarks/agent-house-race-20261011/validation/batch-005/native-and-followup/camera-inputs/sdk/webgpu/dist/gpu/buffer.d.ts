export type WebGpuBufferFailureReason = "invalid-size" | "create-buffer-unavailable" | "queue-write-buffer-unavailable" | "empty-initial-data";
export interface WebGpuBufferFailure {
    readonly ok: false;
    readonly reason: WebGpuBufferFailureReason;
    readonly message: string;
}
export interface WebGpuBufferSuccess {
    readonly ok: true;
    readonly buffer: unknown;
}
export type WebGpuBufferResult = WebGpuBufferSuccess | WebGpuBufferFailure;
export interface WebGpuBufferDescriptor {
    readonly label?: string;
    readonly size: number;
    readonly usage: number;
    readonly mappedAtCreation?: boolean;
    readonly initialData?: ArrayBufferView;
}
export interface WebGpuBufferCreateDescriptor {
    readonly label?: string;
    readonly size: number;
    readonly usage: number;
    readonly mappedAtCreation?: boolean;
}
export interface WebGpuBufferDeviceLike {
    readonly queue?: {
        writeBuffer?: (buffer: unknown, bufferOffset: number, data: ArrayBufferLike | ArrayBufferView, dataOffset?: number, size?: number) => void;
    };
    createBuffer?: (descriptor: WebGpuBufferCreateDescriptor) => unknown;
}
export interface CreateWebGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly descriptor: WebGpuBufferDescriptor;
}
export declare function createWebGpuBuffer(options: CreateWebGpuBufferOptions): WebGpuBufferResult;
export declare function writeWebGpuBufferData(device: Pick<WebGpuBufferDeviceLike, "queue">, buffer: unknown, data: ArrayBufferView): boolean;
export interface WebGpuBufferSubDataRange {
    readonly bufferOffset: number;
    readonly dataByteOffset: number;
    readonly byteLength: number;
}
export declare function writeWebGpuBufferSubData(device: Pick<WebGpuBufferDeviceLike, "queue">, buffer: unknown, data: ArrayBufferView, range: WebGpuBufferSubDataRange): boolean;
export declare function destroyWebGpuBuffer(buffer: unknown): void;
export declare function retireWebGpuBuffer(device: unknown, buffer: unknown): void;
//# sourceMappingURL=buffer.d.ts.map