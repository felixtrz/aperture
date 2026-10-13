import type { Color, ColorTuple, Mat4, Mat4Like, Mat4Tuple, Quat, QuatTuple, TransformValues, Vec2, Vec2Tuple, Vec3, Vec3Tuple, Vec4, Vec4Tuple } from "./types.js";
export declare function vec2(x?: number, y?: number): Vec2;
export declare function vec3(x?: number, y?: number, z?: number): Vec3;
export declare function vec4(x?: number, y?: number, z?: number, w?: number): Vec4;
export declare function quat(x?: number, y?: number, z?: number, w?: number): Quat;
export declare function color(r?: number, g?: number, b?: number, a?: number): Color;
export declare function mat4(values?: Mat4Like): Mat4;
export declare function vec2Tuple(values: ArrayLike<number>): Vec2Tuple;
export declare function vec3Tuple(values: ArrayLike<number>): Vec3Tuple;
export declare function vec4Tuple(values: ArrayLike<number>): Vec4Tuple;
export declare function quatTuple(values: ArrayLike<number>): QuatTuple;
export declare function colorTuple(values: ArrayLike<number>): ColorTuple;
export declare function mat4Tuple(values: ArrayLike<number>): Mat4Tuple;
export declare function quatIdentity(): Quat;
export declare function identityMat4(out?: Mat4): Mat4;
export declare function identityTransformValues(): TransformValues;
//# sourceMappingURL=constructors.d.ts.map