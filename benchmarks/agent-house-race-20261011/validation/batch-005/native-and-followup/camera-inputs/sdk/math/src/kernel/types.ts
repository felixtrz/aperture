// Storage types are always tight, monomorphic Float32Arrays — the layout the
// GPU, ECS columns, and worker snapshots all expect. They are typed as
// `Float32Array & <fixed-length tuple>` so that element access returns a precise
// `number` (not `number | undefined`) under the repo's `noUncheckedIndexedAccess`
// setting, and so a vector is assignable to `number[]`, while the runtime value
// is always a real `Float32Array`. Allocate through the `alloc.ts` helpers,
// which apply the single type-only cast from `Float32Array` to the branded type.

export type Vec2 = Float32Array & [number, number];
export type Vec3 = Float32Array & [number, number, number];
export type Vec4 = Float32Array & [number, number, number, number];
export type Quat = Float32Array & [number, number, number, number];
// prettier-ignore
export type Mat4 = Float32Array & [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

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
