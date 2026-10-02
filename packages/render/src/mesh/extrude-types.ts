/** XY point on a straight extrusion boundary. */
export type ExtrudePoint = readonly [x: number, y: number];

/** A closed solid extending from z=0 to z=depth, without bevels or path sweeps. */
export interface ExtrudeMeshOptions {
  readonly label?: string;
  /** Simple boundary, at least three vertices; do not repeat the closing point. */
  readonly outline: readonly ExtrudePoint[];
  /** Disjoint simple rings strictly inside outline; nested/touching rings are invalid. */
  readonly holes?: readonly (readonly ExtrudePoint[])[];
  /** Positive finite float32 distance along +Z. */
  readonly depth: number;
}
