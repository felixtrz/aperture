/** One authored triangle vertex, in local mesh coordinates. */
export type TriangleListPosition = readonly [number, number, number];
export type TriangleListNormal = readonly [number, number, number];
export type TriangleListUv = readonly [number, number];
export type TriangleListTangent = readonly [number, number, number, number];
/**
 * A single-material triangle list for procedural roofs, ramps, and props.
 * Positions (or indices, when supplied) are consumed in consecutive triples.
 * Counterclockwise winding faces outward. All output buffers are owned copies.
 */
export interface TriangleListMeshOptions {
    readonly label?: string;
    /** Tuples or packed xyz float32 values (one consecutive triple per vertex). */
    readonly positions: readonly TriangleListPosition[] | Float32Array;
    readonly indices?: readonly number[] | Uint16Array | Uint32Array;
    /**
     * One nonzero normal per source position, normalized on construction. Omit
     * to generate flat face normals and expand indexed vertices into corners.
     * Supply authored normals to retain shared vertices and smooth shading.
     */
    readonly normals?: readonly TriangleListNormal[] | Float32Array;
    /** One UV per source position; defaults to [0, 0] at every vertex. */
    readonly uvs?: readonly TriangleListUv[] | Float32Array;
    /**
     * Tuples or packed xyzw values per source vertex. Requires explicit normals.
     * xyz is normalized and orthogonalized against the normal; w must be ±1.
     * Output uses a separate owned float32x4 TANGENT stream.
     */
    readonly tangents?: readonly TriangleListTangent[] | Float32Array;
}
//# sourceMappingURL=triangle-list-types.d.ts.map