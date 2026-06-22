import type { PackedTransformDirtyRange } from "./transform-pack-types.js";

export const VIEW_PROJECTION_FLOAT_COUNT = 16;
export const VIEW_CAMERA_POSITION_FLOAT_OFFSET = 16;
export const VIEW_PREVIOUS_VIEW_PROJECTION_FLOAT_OFFSET = 20;
export const VIEW_FOG_COLOR_FLOAT_OFFSET = 36;
export const VIEW_FOG_PARAMS_FLOAT_OFFSET = 40;
export const PACKED_VIEW_UNIFORM_FLOAT_STRIDE = 44;

export type SnapshotViewUniformPackDiagnosticCode =
  | "viewUniform.emptySnapshot"
  | "viewUniform.duplicateViewId"
  | "viewUniform.missingMatrixData"
  | "viewUniform.matrixOutOfRange";

export interface SnapshotViewUniformPackDiagnostic {
  readonly code: SnapshotViewUniformPackDiagnosticCode;
  readonly message: string;
  readonly viewId?: number;
  readonly sourceOffset?: number;
}

export interface PackedSnapshotViewUniformRecord {
  readonly viewId: number;
  readonly sourceOffset: number;
  readonly packedOffset: number;
}

export interface PackedSnapshotViewUniforms {
  readonly data: Float32Array;
  readonly floatCount?: number;
  readonly views: readonly PackedSnapshotViewUniformRecord[];
  readonly diagnostics: readonly SnapshotViewUniformPackDiagnostic[];
  /** Monotonic content version of the persistent scratch (AI-65). */
  readonly contentVersion?: number;
  /**
   * Changed float window vs the previous frame written through the same
   * scratch: null when byte-identical, full when history is unavailable.
   */
  readonly dirtyRange?: PackedTransformDirtyRange | null;
}

export interface SnapshotViewUniformPackOptions {
  readonly previousViewProjectionByViewId?: ReadonlyMap<number, Float32Array>;
}

export interface PackedSnapshotViewUniformsScratch {
  data: Float32Array;
  readonly views: PackedSnapshotViewUniformRecord[];
  readonly diagnostics: SnapshotViewUniformPackDiagnostic[];
  readonly viewPool: PackedSnapshotViewUniformRecord[];
  readonly seenViewIds: Set<number>;
  readonly result: PackedSnapshotViewUniforms;
  /** Copy of the previous frame's packed floats for dirty diffing (AI-65). */
  previous: Float32Array;
  /** Float count written on the previous frame (-1 before the first write). */
  lastFloatCount: number;
  /** Monotonic version of the scratch content; bumps on every byte change. */
  contentVersion: number;
}

export interface MutablePackedSnapshotViewUniformRecord {
  viewId: number;
  sourceOffset: number;
  packedOffset: number;
}

export interface MutablePackedSnapshotViewUniforms {
  data: Float32Array;
  floatCount: number;
  views: readonly PackedSnapshotViewUniformRecord[];
  diagnostics: readonly SnapshotViewUniformPackDiagnostic[];
  contentVersion: number | undefined;
  dirtyRange: PackedTransformDirtyRange | null | undefined;
}
