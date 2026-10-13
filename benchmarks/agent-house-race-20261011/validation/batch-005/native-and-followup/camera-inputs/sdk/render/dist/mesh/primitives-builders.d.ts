import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";
import type { MeshAsset } from "./types.js";
export declare const PRIMITIVE_VERTEX_STRIDE_BYTES: number;
export interface PrimitiveMeshAssetInput {
    readonly label: string;
    readonly vertices: Float32Array;
    readonly vertexCount: number;
    readonly indices: Uint16Array;
    readonly localAabb: Aabb;
    readonly localSphere: BoundingSphere;
}
export type PrimitivePosition = readonly [number, number, number];
export type PrimitiveFace = readonly PrimitiveVertex[];
export type PrimitiveBounds = {
    readonly aabb: Aabb;
    readonly sphere: BoundingSphere;
};
export interface PrimitiveVertex {
    readonly position: PrimitivePosition;
    readonly normal: PrimitivePosition;
    readonly uv: readonly [number, number];
}
export declare function boundsFromPositions(positions: readonly PrimitivePosition[]): PrimitiveBounds;
export declare function createPrimitiveMeshAsset(input: PrimitiveMeshAssetInput): MeshAsset;
export declare function face(positions: readonly [
    PrimitivePosition,
    PrimitivePosition,
    PrimitivePosition,
    PrimitivePosition
], normal: PrimitivePosition): PrimitiveFace;
export declare function interleavePrimitiveVertices(faces: readonly PrimitiveFace[]): Float32Array;
export declare function interleavePrimitiveVertexList(vertices: readonly PrimitiveVertex[]): Float32Array;
export declare function positiveFinite(value: number | undefined, fallback: number): number;
export declare function nonNegativeFinite(value: number | undefined, fallback: number): number;
export declare function clampInteger(value: number, min: number, max: number): number;
export declare function normalize(value: PrimitivePosition): PrimitivePosition;
//# sourceMappingURL=primitives-builders.d.ts.map