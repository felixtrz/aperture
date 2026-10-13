export declare const QUAD_SNAPSHOT_ABI_VERSION = 1;
export declare const QUAD_INSTANCE_FLOAT_STRIDE = 24;
export declare const QUAD_INSTANCE_WORD_STRIDE = 8;
export type QuadCoordinateMode = "world" | "screen";
export type QuadBillboardMode = "none" | "spherical" | "cylindrical" | "axis-locked";
export type QuadSizeMode = "world-units" | "screen-pixels";
export type QuadBatchKind = "sprite" | "ui" | "glyph" | "particle";
export type QuadPipelineVariant = "sprite" | "ui-panel" | "ui-image" | "msdf-text" | "particle";
export type QuadBlendMode = "opaque" | "alpha" | "additive" | "multiply";
export type QuadDepthMode = "test" | "disabled";
export interface QuadSnapshotBuffers {
    readonly version: typeof QUAD_SNAPSHOT_ABI_VERSION;
    readonly instanceFloatStride: typeof QUAD_INSTANCE_FLOAT_STRIDE;
    readonly instanceWordStride: typeof QUAD_INSTANCE_WORD_STRIDE;
    readonly instanceFloats: Float32Array;
    readonly instanceWords: Uint32Array;
}
export interface QuadInstanceFlagsInput {
    readonly coordinateMode: QuadCoordinateMode;
    readonly billboardMode: QuadBillboardMode;
    readonly sizeMode: QuadSizeMode;
}
export declare const QUAD_INSTANCE_FLAG_MASKS: Readonly<{
    coordinateMode: 3;
    billboardMode: 60;
    sizeMode: 192;
}>;
export declare function createQuadSnapshotBuffers(options?: {
    readonly instanceFloats?: Float32Array;
    readonly instanceWords?: Uint32Array;
}): QuadSnapshotBuffers;
export declare function quadInstanceCount(buffers: QuadSnapshotBuffers): number;
export declare function assertQuadSnapshotBuffers(buffers: QuadSnapshotBuffers): asserts buffers is QuadSnapshotBuffers;
export declare function encodeQuadInstanceFlags(input: QuadInstanceFlagsInput): number;
export declare function decodeQuadInstanceFlags(flags: number): QuadInstanceFlagsInput;
//# sourceMappingURL=quad-snapshot.d.ts.map