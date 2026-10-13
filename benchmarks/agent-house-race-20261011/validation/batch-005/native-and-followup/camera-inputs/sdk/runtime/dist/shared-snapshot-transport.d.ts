export interface CreateSharedSnapshotTransportOptions {
    readonly maxEntities: number;
    readonly maxViews: number;
    readonly maxInstanceTints?: number;
    readonly maxQuadInstances?: number;
    readonly maxPacketWords?: number;
    readonly requireCrossOriginIsolated?: boolean;
    readonly crossOriginIsolated?: boolean;
    readonly sharedArrayBufferConstructor?: SharedArrayBufferConstructor | null;
}
export interface SharedSnapshotTransportLayout {
    readonly buffers: number;
    readonly headerInt32Count: number;
    readonly transformFloatsPerEntity: number;
    readonly instanceTintFloatsPerTint: number;
    readonly viewMatrixFloatsPerView: number;
    readonly quadInstanceFloatsPerInstance: number;
    readonly quadInstanceWordsPerInstance: number;
    readonly maxEntities: number;
    readonly maxViews: number;
    readonly maxInstanceTints: number;
    readonly maxQuadInstances: number;
    readonly transformFloatsPerBuffer: number;
    readonly instanceTintFloatsPerBuffer: number;
    readonly viewMatrixFloatsPerBuffer: number;
    readonly quadInstanceFloatsPerBuffer: number;
    readonly quadInstanceWordsPerBuffer: number;
    readonly packetWordsPerBuffer: number;
}
export interface SharedSnapshotFrameInput {
    readonly frame: number;
    readonly time?: number;
    readonly transforms: ArrayLike<number>;
    readonly instanceTints?: ArrayLike<number>;
    readonly viewMatrices: ArrayLike<number>;
    readonly quadInstanceFloats?: ArrayLike<number>;
    readonly quadInstanceWords?: ArrayLike<number>;
    readonly packetWords?: ArrayLike<number>;
}
export interface SharedSnapshotWriteReport {
    readonly frame: number;
    readonly time: number;
    readonly sequence: number;
    readonly bufferIndex: number;
    readonly transformFloats: number;
    readonly instanceTintFloats: number;
    readonly viewMatrixFloats: number;
    readonly quadInstanceFloats: number;
    readonly quadInstanceWords: number;
    readonly packetWords: number;
}
export interface SharedSnapshotReadFrame {
    readonly frame: number;
    readonly time: number;
    readonly sequence: number;
    readonly bufferIndex: number;
    readonly transforms: Float32Array;
    readonly instanceTints: Float32Array;
    readonly viewMatrices: Float32Array;
    readonly quadInstanceFloats: Float32Array;
    readonly quadInstanceWords: Uint32Array;
    readonly packetWords: Uint32Array;
}
export interface SharedSnapshotTransportWriter {
    readonly header: Int32Array;
    readonly transforms: Float32Array;
    readonly instanceTints: Float32Array;
    readonly viewMatrices: Float32Array;
    readonly quadInstanceFloats: Float32Array;
    readonly quadInstanceWords: Uint32Array;
    readonly packetWords: Uint32Array;
    writeFrame(frame: SharedSnapshotFrameInput): SharedSnapshotWriteReport;
}
export interface SharedSnapshotTransportReader {
    readonly header: Int32Array;
    readonly transforms: Float32Array;
    readonly instanceTints: Float32Array;
    readonly viewMatrices: Float32Array;
    readonly quadInstanceFloats: Float32Array;
    readonly quadInstanceWords: Uint32Array;
    readonly packetWords: Uint32Array;
    readLatestFrame(): SharedSnapshotReadFrame | null;
}
export interface SharedSnapshotTransport {
    readonly mode: "shared-array-buffer";
    readonly layout: SharedSnapshotTransportLayout;
    readonly headerBuffer: SharedArrayBuffer;
    readonly transformBuffer: SharedArrayBuffer;
    readonly instanceTintBuffer: SharedArrayBuffer;
    readonly viewMatrixBuffer: SharedArrayBuffer;
    readonly quadInstanceFloatBuffer: SharedArrayBuffer;
    readonly quadInstanceWordBuffer: SharedArrayBuffer;
    readonly packetBuffer: SharedArrayBuffer;
    readonly writer: SharedSnapshotTransportWriter;
    readonly reader: SharedSnapshotTransportReader;
}
export interface SharedSnapshotTransportBuffers {
    readonly layout: SharedSnapshotTransportLayout;
    readonly headerBuffer: SharedArrayBuffer;
    readonly transformBuffer: SharedArrayBuffer;
    readonly instanceTintBuffer: SharedArrayBuffer;
    readonly viewMatrixBuffer: SharedArrayBuffer;
    readonly quadInstanceFloatBuffer: SharedArrayBuffer;
    readonly quadInstanceWordBuffer: SharedArrayBuffer;
    readonly packetBuffer: SharedArrayBuffer;
}
export type SharedSnapshotTransportUnsupportedReason = "shared-array-buffer-unavailable" | "cross-origin-isolation-required";
export declare class SharedSnapshotTransportUnsupportedError extends Error {
    readonly code = "shared-snapshot-transport-unsupported";
    readonly reason: SharedSnapshotTransportUnsupportedReason;
    constructor(reason: SharedSnapshotTransportUnsupportedReason, message: string);
}
export declare function createSharedSnapshotTransport(options: CreateSharedSnapshotTransportOptions): SharedSnapshotTransport;
export declare function createSharedSnapshotTransportViews(input: SharedSnapshotTransportBuffers): SharedSnapshotTransport;
//# sourceMappingURL=shared-snapshot-transport.d.ts.map