import type { LatheMeshOptions } from "./lathe-types.js";
/** Invalid lathe input, with a stable field, profile point, or segment path. */
export declare class LatheMeshError extends RangeError {
    readonly path: string;
    constructor(path: string, reason: string);
}
export declare function readLatheProfile(options: LatheMeshOptions): {
    readonly label: string;
    readonly profile: readonly (readonly [number, number])[];
    readonly radialSegments: number;
};
//# sourceMappingURL=lathe-validation.d.ts.map