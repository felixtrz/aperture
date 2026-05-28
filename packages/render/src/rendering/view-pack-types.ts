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
}
