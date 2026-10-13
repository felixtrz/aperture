import type { ExtrudeMeshOptions, ExtrudePoint } from "./extrude-types.js";
/** Invalid extrusion input with a stable field or boundary path. */
export declare class ExtrudeMeshError extends RangeError {
    readonly path: string;
    constructor(path: string, reason: string);
}
export declare function readExtrudeRings(options: ExtrudeMeshOptions): {
    label: string;
    rings: ExtrudePoint[][];
    depth: number;
};
export declare function signedArea(ring: readonly ExtrudePoint[]): number;
//# sourceMappingURL=extrude-validation.d.ts.map