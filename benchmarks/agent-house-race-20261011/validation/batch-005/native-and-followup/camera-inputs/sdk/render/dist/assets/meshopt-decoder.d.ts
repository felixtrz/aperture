export type MeshoptDecodeMode = "ATTRIBUTES" | "TRIANGLES" | "INDICES";
export type MeshoptDecodeFilter = "NONE" | "OCTAHEDRAL" | "QUATERNION" | "EXPONENTIAL" | "COLOR";
export interface MeshoptDecoderSource {
    readonly jsSource?: string;
    readonly jsUrl?: string;
    readonly fetchText?: (url: string) => PromiseLike<string>;
}
export interface MeshoptGltfBufferDecodeOptions {
    readonly count: number;
    readonly byteStride: number;
    readonly mode: MeshoptDecodeMode;
    readonly filter?: MeshoptDecodeFilter;
}
export interface MeshoptBufferDecoder {
    readonly decodeGltfBuffer: (source: ArrayBuffer | ArrayBufferView, options: MeshoptGltfBufferDecodeOptions) => Uint8Array;
}
export declare function createMeshoptDecoder(source: MeshoptDecoderSource): Promise<MeshoptBufferDecoder>;
//# sourceMappingURL=meshopt-decoder.d.ts.map