import type { MeshoptDecodeFilter, MeshoptDecodeMode } from "./meshopt-decoder.js";
export type GltfMeshoptCompressionExtensionName = "EXT_meshopt_compression" | "KHR_meshopt_compression";
export interface GltfMeshoptBufferViewExtension {
    readonly extensionName: GltfMeshoptCompressionExtensionName;
    readonly buffer: number;
    readonly byteOffset: number;
    readonly byteLength: number;
    readonly byteStride: number;
    readonly count: number;
    readonly mode: MeshoptDecodeMode;
    readonly filter?: MeshoptDecodeFilter;
}
export declare function decodedMeshoptBufferView(source: unknown, bufferIndex: number, byteLength: number): Record<string, unknown>;
export declare function meshoptExtensionNameForBufferView(bufferView: unknown): GltfMeshoptCompressionExtensionName | null;
export declare function meshoptExtensionForBufferView(bufferView: unknown): GltfMeshoptBufferViewExtension | null;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function bytesView(source: ArrayBuffer | ArrayBufferView | null | undefined): Uint8Array | null;
//# sourceMappingURL=gltf-report-driven-import-meshopt-extension.d.ts.map