import type { RoundedBoxMeshOptions } from "./rounded-box-types.js";
export declare class RoundedBoxMeshError extends Error {
    readonly path: string;
    constructor(path: string, message: string);
}
/** Validate authoring parameters without allocating geometry. */
export declare function validateRoundedBoxMeshOptions(options?: RoundedBoxMeshOptions): void;
export declare function readRoundedBoxOptions(options: RoundedBoxMeshOptions): {
    halfExtents: [number, number, number];
    radius: number;
    bevelSegments: number;
    label: string | undefined;
};
//# sourceMappingURL=rounded-box-validation.d.ts.map