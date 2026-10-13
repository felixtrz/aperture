import type { NumArray, Vec4 } from "./types.js";
export declare function create(x?: number, y?: number, z?: number, w?: number): Vec4;
export declare function set(x: number, y: number, z: number, w: number, dst?: Float32Array): Vec4;
export declare function copy(vIn: NumArray, dst?: Float32Array): Vec4;
export declare function add(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec4;
export declare function subtract(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec4;
export { subtract as sub };
export declare function scale(vIn: NumArray, k: number, dst?: Float32Array): Vec4;
export declare function dot(aIn: NumArray, bIn: NumArray): number;
export declare function lengthSq(vIn: NumArray): number;
export declare function length(v: NumArray): number;
export { length as len };
export declare function normalize(vIn: NumArray, dst?: Float32Array): Vec4;
//# sourceMappingURL=vec4.d.ts.map