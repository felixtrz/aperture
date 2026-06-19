// Hand-authored declaration that mirrors how the previous backend typed its
// vectors and matrices. The generic identity alias `StorageType<Float32Array>`
// (resolved through the wider `NumberArray` constraint, and surfaced via a
// declaration file) keeps element access typed as plain `number` for callers
// across the engine under `noUncheckedIndexedAccess`, instead of the
// `number | undefined` a bare `Float32Array` alias would produce — while the
// runtime value is always a real `Float32Array`.

export interface NumberArray {
  readonly length: number;
  [index: number]: number;
}

export type StorageArg = Float32Array | Float64Array | NumberArray;

export type StorageType<T extends StorageArg> = T;

export type Float32 = StorageType<Float32Array>;
