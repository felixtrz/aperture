import type { TriangleListColor } from "./triangle-list-types.js";

/**
 * A rectangular Y-up terrain surface. Heights are local Y coordinates, not
 * normalized samples. Rows advance +Z; columns advance +X. At least two rows
 * and two columns are required, with the same number of columns in every row.
 */
export interface HeightfieldMeshOptions {
  readonly label?: string;
  readonly heights: readonly (readonly number[])[];
  /** Total X extent, centered on X = 0. Positive and finite; defaults to 1. */
  readonly width?: number;
  /** Total Z extent, centered on Z = 0. Positive and finite; defaults to 1. */
  readonly depth?: number;
  /**
   * Optional linear RGB(A) color per height sample, shaped exactly like
   * `heights` (colors[row][column]). Stored as COLOR_0 and multiplied into the
   * material base color — e.g. grass on slopes, dirt on paths, sand on shores.
   */
  readonly colors?: readonly (readonly TriangleListColor[])[];
}
