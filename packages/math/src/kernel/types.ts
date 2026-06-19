// Storage types are always tight, monomorphic Float32Arrays — the layout the
// GPU, ECS columns, and worker snapshots all expect. Keeping a single concrete
// output type is what lets V8 keep these functions monomorphic and fast. The
// `Float32` alias (see `storage.d.ts`) is exactly `Float32Array` at runtime; it
// only adjusts how element access is typed for callers.
import type { Float32 } from "./storage.js";

export type Vec2 = Float32;
export type Vec3 = Float32;
export type Vec4 = Float32;
export type Quat = Float32;
export type Mat4 = Float32;

/**
 * Read-only numeric input. Accepts Float32Array storage, plain `number[]`, and
 * readonly tuples so authoring code can pass literals like `[0, 1, 0]` without
 * a copy. Outputs are always {@link Vec3}/{@link Mat4} etc.
 */
export type NumArray = ArrayLike<number>;

// Fixed-length tuple views used internally to read inputs. Casting a NumArray
// to one of these (a type-only, zero-cost cast) lets the kernel index by
// literal offsets and get a precise `number` back under the repo's
// `noUncheckedIndexedAccess` setting, instead of `number | undefined`.
export type T2 = readonly [number, number];
export type T3 = readonly [number, number, number];
export type T4 = readonly [number, number, number, number];
// prettier-ignore
export type T16 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];
