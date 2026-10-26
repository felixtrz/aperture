/** One authored triangle vertex, in local mesh coordinates. */
export type TriangleListPosition = readonly [number, number, number];
export type TriangleListNormal = readonly [number, number, number];
export type TriangleListUv = readonly [number, number];
/** Linear RGB or RGBA vertex color; alpha defaults to 1. */
export type TriangleListColor =
  | readonly [number, number, number]
  | readonly [number, number, number, number];

/**
 * A single-material triangle list for procedural roofs, ramps, and props.
 * Positions (or indices, when supplied) are consumed in consecutive triples.
 * Counterclockwise winding faces outward. All output buffers are owned copies.
 */
export interface TriangleListMeshOptions {
  readonly label?: string;
  readonly positions: readonly TriangleListPosition[];
  readonly indices?: readonly number[] | Uint16Array | Uint32Array;
  /**
   * One nonzero normal per source position, normalized on construction. Omit
   * to generate flat face normals and expand indexed vertices into corners.
   * Supply authored normals to retain shared vertices and smooth shading.
   */
  readonly normals?: readonly TriangleListNormal[];
  /** One UV per source position; defaults to [0, 0] at every vertex. */
  readonly uvs?: readonly TriangleListUv[];
  /**
   * One linear RGB(A) color per source position, stored as COLOR_0 and
   * multiplied into the material base color (like three.js `vertexColors`).
   * Flat-normal expansion copies each source color to its face corners, so
   * give a face's three positions the same color for crisp per-face color.
   */
  readonly colors?: readonly TriangleListColor[];
}
