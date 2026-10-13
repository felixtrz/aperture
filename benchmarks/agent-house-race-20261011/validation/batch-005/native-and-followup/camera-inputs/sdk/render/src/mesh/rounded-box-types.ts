/** A centered closed box with circular edge bevels and spherical corners. */
export interface RoundedBoxMeshOptions {
  readonly label?: string;
  /** Positive local half-width/half-height/half-depth. Defaults to [0.5, 0.5, 0.5]. */
  readonly halfExtents?: readonly [number, number, number];
  /** 0 through the smallest half-extent. Defaults to 10% of that half-extent. */
  readonly radius?: number;
  /** Integer subdivisions per half-bevel, from 1 through 32. Defaults to 3. */
  readonly bevelSegments?: number;
}
