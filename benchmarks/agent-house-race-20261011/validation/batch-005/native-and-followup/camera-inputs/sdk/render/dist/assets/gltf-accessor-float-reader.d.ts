/**
 * Standalone float accessor reader for non-primitive accessors — inverse-bind
 * matrices (skins, M2-T3) and animation sampler input/output (M2-T4). The
 * primitive accessor decoder (`decodeGltfPrimitiveAccessors`) is shaped for
 * vertex attributes (vec2/3/4) and cannot express MAT4 / SCALAR / dynamic-width
 * weights outputs, so this is the single engine reader those import paths share
 * — replacing the hand-rolled `readGltfFloatAccessorTuples` in the glb-viewer
 * worker rather than adding a second drifting decoder.
 */
/** Resolves a glTF buffer index to its backing bytes (e.g. the GLB BIN chunk). */
export type GltfBufferResolver = (bufferIndex: number) => ArrayBuffer | ArrayBufferView | null | undefined;
export interface GltfDecodedFloatAccessor {
    /** Flat output, length === `count * componentCount`. */
    readonly values: Float32Array;
    readonly count: number;
    readonly componentCount: number;
}
/**
 * Decode a glTF accessor (by index) into a flat `Float32Array`. Honors
 * bufferView byteStride, accessor byteOffset, and normalized integer
 * components. Returns `null` if the accessor/bufferView/buffer is malformed or
 * the component type is unsupported.
 */
export declare function decodeGltfFloatAccessor(input: {
    readonly root: unknown;
    readonly accessorIndex: number;
    readonly resolveBufferBytes: GltfBufferResolver;
}): GltfDecodedFloatAccessor | null;
//# sourceMappingURL=gltf-accessor-float-reader.d.ts.map