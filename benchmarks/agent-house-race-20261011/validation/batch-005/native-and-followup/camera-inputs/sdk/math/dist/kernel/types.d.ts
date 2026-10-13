export type Vec2 = Float32Array & [number, number];
export type Vec3 = Float32Array & [number, number, number];
export type Vec4 = Float32Array & [number, number, number, number];
export type Quat = Float32Array & [number, number, number, number];
export type Mat4 = Float32Array & [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
/**
 * Read-only numeric input. Accepts Float32Array storage, plain `number[]`, and
 * readonly tuples so authoring code can pass literals like `[0, 1, 0]` without
 * a copy. Outputs are always {@link Vec3}/{@link Mat4} etc.
 */
export type NumArray = ArrayLike<number>;
export type T2 = readonly [number, number];
export type T3 = readonly [number, number, number];
export type T4 = readonly [number, number, number, number];
export type T16 = readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
//# sourceMappingURL=types.d.ts.map