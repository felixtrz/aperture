import type { HeightfieldMeshOptions } from "./heightfield-types.js";
/** Invalid heightfield input, with a stable field, row, or sample location. */
export declare class HeightfieldMeshError extends RangeError {
    readonly path: string;
    constructor(path: string, reason: string);
}
export interface HeightfieldGrid {
    readonly heights: readonly (readonly number[])[];
    readonly x: readonly number[];
    readonly z: readonly number[];
}
export declare function readHeightfieldGrid(options: HeightfieldMeshOptions): HeightfieldGrid;
//# sourceMappingURL=heightfield-validation.d.ts.map