/** Internal opt-in observation; native GPU object identities remain unchanged. */
export interface WebGpuGeometryDeviceObserver {
    worldBufferCreated(buffer: unknown, resourceKey: string, capacity: number, initial: Float32Array): void;
    indirectBufferCreated(buffer: unknown, resourceKey: string, capacity: number): void;
    bufferWritten(buffer: unknown, offset: number, data: ArrayBufferLike | ArrayBufferView, dataOffset?: number, size?: number): void;
    bufferInvalidated(buffer: unknown): void;
    bufferDestroyed(buffer: unknown): void;
    bindGroupCreated(group: unknown, descriptor: unknown): void;
}
export declare function registerWebGpuGeometryDeviceObserver(device: object, observer: WebGpuGeometryDeviceObserver): () => void;
export declare function webGpuGeometryDeviceObserver(device: unknown): WebGpuGeometryDeviceObserver | undefined;
//# sourceMappingURL=geometry-observer.d.ts.map