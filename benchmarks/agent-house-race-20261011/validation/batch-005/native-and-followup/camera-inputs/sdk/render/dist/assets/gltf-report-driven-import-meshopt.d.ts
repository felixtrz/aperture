import type { GltfAccessorDecodingDiagnostic } from "./gltf-accessor-decoding.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";
export interface DecodedGltfMeshoptBufferViews {
    readonly root: unknown;
    readonly resolveBufferBytes: (bufferIndex: number) => ArrayBuffer | ArrayBufferView | null | undefined;
    readonly diagnostics: readonly GltfAccessorDecodingDiagnostic[];
}
export declare function decodeGltfMeshoptBufferViews(input: {
    readonly root: unknown;
    readonly decoder: MeshoptBufferDecoder | undefined;
    readonly resolveBufferBytes: (bufferIndex: number) => ArrayBuffer | ArrayBufferView | null | undefined;
}): DecodedGltfMeshoptBufferViews;
//# sourceMappingURL=gltf-report-driven-import-meshopt.d.ts.map