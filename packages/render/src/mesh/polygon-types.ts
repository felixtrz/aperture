/** A corner in mesh-local coordinates. */
export type PolygonMeshPoint = readonly [x: number, y: number, z: number];

/** A planar surface, optionally with openings, rather than a closed extrusion. */
export interface PolygonMeshFace {
  /** Simple boundary, counterclockwise when viewed from the visible outside. */
  readonly outline: readonly PolygonMeshPoint[];
  /** Disjoint openings strictly inside the outline; either winding is accepted. */
  readonly holes?: readonly (readonly PolygonMeshPoint[])[];
}

/**
 * Single-material polygon surfaces with flat normals and automatic triangulation.
 * Faces may meet at shared coordinates to form a shell, but need not be closed.
 * Use separate meshes with matching boundaries for adjacent material regions.
 */
export interface PolygonMeshOptions {
  readonly label?: string;
  readonly faces: readonly PolygonMeshFace[];
}
