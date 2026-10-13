import type { GltfDecodedImageData, GltfImageDataResolverReport, GltfTextureDiagnosticValue } from "./gltf-texture-types.js";
export declare function bytesView(bytes: ArrayBuffer | ArrayBufferView): Uint8Array;
export declare function mimeTypeFromUri(uri: string): string | undefined;
export declare function recordField(source: Record<string, unknown>, field: string): Record<string, unknown> | undefined;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function isNonNegativeInteger(value: unknown): value is number;
export declare function isDecodedImageData(value: unknown): value is GltfDecodedImageData;
export declare function isImageDataResolverReport(value: unknown): value is GltfImageDataResolverReport;
export declare function isPromiseLike<T>(value: unknown): value is PromiseLike<T>;
export declare function validDecodedImage(image: GltfDecodedImageData): boolean;
export declare function toDiagnosticValue(value: unknown): GltfTextureDiagnosticValue;
//# sourceMappingURL=gltf-texture-utils.d.ts.map