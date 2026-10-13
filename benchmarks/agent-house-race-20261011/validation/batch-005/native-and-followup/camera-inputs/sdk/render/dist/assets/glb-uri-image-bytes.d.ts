import type { GltfImageSourceRef } from "../materials/gltf-texture-types.js";
import type { LoadGlbFromUriDiagnostic } from "./glb-uri-loader.js";
export type BytesForImageSourceResult = {
    readonly ok: true;
    readonly bytes?: ArrayBuffer | ArrayBufferView;
} | {
    readonly ok: false;
    readonly diagnostic: LoadGlbFromUriDiagnostic;
};
export declare function bytesForImageSource(input: {
    readonly root: Record<string, unknown>;
    readonly binary: Uint8Array | null;
    readonly source: GltfImageSourceRef;
    readonly imageIndex: number;
    readonly externalBufferBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly externalImageBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
}): BytesForImageSourceResult;
export declare function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number;
//# sourceMappingURL=glb-uri-image-bytes.d.ts.map