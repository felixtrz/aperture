export declare const GLB_CONTAINER_MAGIC = 1179937895;
export declare const GLB_CONTAINER_VERSION = 2;
export declare const GLB_JSON_CHUNK_TYPE = 1313821514;
export declare const GLB_BINARY_CHUNK_TYPE = 5130562;
export declare const GLB_HEADER_BYTE_LENGTH = 12;
export declare const GLB_CHUNK_HEADER_BYTE_LENGTH = 8;
export type GlbChunkKind = "json" | "bin" | "unknown";
export type GlbContainerDiagnosticCode = "glb.tooShort" | "glb.invalidMagic" | "glb.unsupportedVersion" | "glb.lengthMismatch" | "glb.missingJsonChunk" | "glb.invalidChunkHeader" | "glb.chunkOutOfBounds" | "glb.emptyJsonChunk" | "glb.duplicateJsonChunk" | "glb.duplicateBinaryChunk" | "glb.invalidJson" | "glb.unknownChunk";
export type GlbContainerDiagnosticSeverity = "error" | "warning";
export interface GlbContainerDiagnostic {
    readonly code: GlbContainerDiagnosticCode;
    readonly message: string;
    readonly severity: GlbContainerDiagnosticSeverity;
    readonly byteOffset?: number;
    readonly byteLength?: number;
    readonly chunkType?: number;
}
export interface GlbChunkInfo {
    readonly type: GlbChunkKind;
    readonly typeCode: number;
    readonly byteOffset: number;
    readonly byteLength: number;
}
export interface GlbContainer {
    readonly version: typeof GLB_CONTAINER_VERSION;
    readonly byteLength: number;
    readonly json: Record<string, unknown>;
    readonly jsonText: string;
    readonly binaryChunk: Uint8Array | null;
    readonly chunks: readonly GlbChunkInfo[];
}
export interface GlbContainerParseResult {
    readonly ok: boolean;
    readonly container: GlbContainer | null;
    readonly diagnostics: readonly GlbContainerDiagnostic[];
}
export type GlbContainerSource = ArrayBuffer | Uint8Array;
export interface GlbContainerDiagnosticInput {
    readonly code: GlbContainerDiagnosticCode;
    readonly message: string;
    readonly severity: GlbContainerDiagnosticSeverity;
    readonly byteOffset?: number;
    readonly byteLength?: number;
    readonly chunkType?: number;
}
//# sourceMappingURL=glb-container-types.d.ts.map