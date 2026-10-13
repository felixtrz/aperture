/** A full turn around +Y, following an explicitly ordered radius/Y profile. */
export interface LatheMeshOptions {
  readonly label?: string;
  /** At least two [radius, local Y] points. Radius zero is allowed only at endpoints. */
  readonly profile: readonly (readonly [radius: number, y: number])[];
  /** Integer from 3 through 128. Defaults to 32. */
  readonly radialSegments?: number;
}
