import { type GlbChunkInfo, type GlbContainerDiagnostic, type GlbContainerSource } from "./glb-container-types.js";
export interface GlbContainerChunkScanResult {
    readonly chunks: readonly GlbChunkInfo[];
    readonly jsonBytes: Uint8Array | null;
    readonly binaryChunk: Uint8Array | null;
    readonly diagnostics: readonly GlbContainerDiagnostic[];
}
export declare function scanGlbContainerChunks(input: {
    readonly source: GlbContainerSource;
    readonly data: DataView;
    readonly declaredLength: number;
}): GlbContainerChunkScanResult;
//# sourceMappingURL=glb-container-chunks.d.ts.map