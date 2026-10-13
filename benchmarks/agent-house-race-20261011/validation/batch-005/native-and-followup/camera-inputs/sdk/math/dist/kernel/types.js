// Storage types are always tight, monomorphic Float32Arrays — the layout the
// GPU, ECS columns, and worker snapshots all expect. They are typed as
// `Float32Array & <fixed-length tuple>` so that element access returns a precise
// `number` (not `number | undefined`) under the repo's `noUncheckedIndexedAccess`
// setting, and so a vector is assignable to `number[]`, while the runtime value
// is always a real `Float32Array`. Allocate through the `alloc.ts` helpers,
// which apply the single type-only cast from `Float32Array` to the branded type.
export {};
//# sourceMappingURL=types.js.map