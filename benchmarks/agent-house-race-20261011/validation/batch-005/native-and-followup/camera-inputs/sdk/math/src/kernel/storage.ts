// Mirrors how the previous backend typed its vectors and matrices. The generic
// identity alias `StorageType<Float32Array>` (resolved through the wider
// `NumberArray` constraint) keeps element access typed as plain `number` for
// callers across the engine under `noUncheckedIndexedAccess`, instead of the
// `number | undefined` a bare `Float32Array` alias would produce — while the
// runtime value is always a real `Float32Array`.
//
// This is a regular module (not a hand-authored `.d.ts`) so `tsc` emits
// `dist/kernel/storage.js` + `.d.ts` and published declarations that
// `import type { ... } from "./kernel/storage.js"` resolve for consumers that
// compile with `skipLibCheck: false`.

export interface NumberArray {
  readonly length: number;
  [index: number]: number;
}

export type StorageArg = Float32Array | Float64Array | NumberArray;

export type StorageType<T extends StorageArg> = T;

export type Float32 = StorageType<Float32Array>;
