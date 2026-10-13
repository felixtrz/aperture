import type { GltfImageSourceRef } from "../materials/gltf-texture-types.js";
import type { LoadGltfFromUriDiagnostic, LoadGltfFromUriExternalImageSourceKind } from "./gltf-uri-loader.js";
import { isRecord } from "./gltf-uri-shared.js";
export type ImageSourceRefResult = {
    readonly ok: true;
    readonly source: GltfImageSourceRef;
} | {
    readonly ok: false;
    readonly message: string;
};
export declare function imageSourceRefFromImage(image: Record<string, unknown>): ImageSourceRefResult;
export type BytesForImageSourceResult = {
    readonly ok: true;
    readonly bytes?: ArrayBuffer | ArrayBufferView;
} | {
    readonly ok: false;
    readonly diagnostic: LoadGltfFromUriDiagnostic;
};
export declare function bytesForImageSource(input: {
    readonly root: Record<string, unknown>;
    readonly source: GltfImageSourceRef;
    readonly imageIndex: number;
    readonly externalBufferBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly externalImageBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
}): BytesForImageSourceResult;
export declare function externalImageSourceKind(source: GltfImageSourceRef): LoadGltfFromUriExternalImageSourceKind;
export declare function imageStatusUri(source: GltfImageSourceRef): string;
export declare function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number;
export { isRecord };
//# sourceMappingURL=gltf-uri-image-sources.d.ts.map