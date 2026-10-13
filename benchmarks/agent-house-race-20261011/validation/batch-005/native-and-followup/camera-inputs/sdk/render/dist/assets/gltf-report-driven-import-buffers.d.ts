import type { GltfReportDrivenGlbImportDiagnostic, GltfReportDrivenImportOptions } from "./gltf-report-driven-import-types.js";
export declare function resolvedExternalBufferByteLengths(options: GltfReportDrivenImportOptions): {
    readonly externalBufferByteLengths?: ReadonlyMap<number, number>;
};
export declare function resolveGlbBufferBytes(bufferIndex: number, root: Record<string, unknown>, binaryChunk: Uint8Array | null, resolveExternalBufferBytes: ((bufferIndex: number) => ArrayBuffer | ArrayBufferView | null | undefined) | undefined, resolvedBuffers: Map<number, ArrayBuffer | ArrayBufferView | null>): ArrayBuffer | ArrayBufferView | null;
export declare function createGlbBufferSourceDiagnostics(root: Record<string, unknown>, binaryChunk: Uint8Array | null, resolveBufferBytes: (bufferIndex: number) => ArrayBuffer | ArrayBufferView | null): GltfReportDrivenGlbImportDiagnostic[];
//# sourceMappingURL=gltf-report-driven-import-buffers.d.ts.map