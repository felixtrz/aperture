import { type GlbChunkKind, type GlbContainerSource } from "./glb-container-types.js";
export declare function sourceToDataView(source: GlbContainerSource): DataView;
export declare function sourceBytesForRange(source: GlbContainerSource, byteOffset: number, byteLength: number): Uint8Array;
export declare function classifyChunkType(typeCode: number): GlbChunkKind;
export declare function decodeGlbJson(bytes: Uint8Array): string | null;
export declare function parseJsonObject(jsonText: string): Record<string, unknown> | null;
//# sourceMappingURL=glb-container-utils.d.ts.map