import type { MeshAsset } from "./types.js";
/** Hard work/copy bounds for the static source-mesh bake operation. */
export declare const MESH_BAKE_TRANSFORM_LIMITS: Readonly<{
    vertices: 2000000;
    indices: 6000000;
    triangleCorners: 6000000;
    bytes: number;
    streams: 16;
    attributesPerStream: 16;
    submeshes: 4096;
    materialSlots: 4096;
}>;
export interface BakeMeshAssetTransformOptions {
    readonly mesh: MeshAsset;
    /** Exactly 16 finite column-major values, with affine last row [0,0,0,1]. */
    readonly transform: ArrayLike<number>;
    readonly label?: string;
}
export type MeshBakeTransformDiagnosticCode = "meshBake.invalidTransform" | "meshBake.singularTransform" | "meshBake.invalidSourceMesh" | "meshBake.unsupportedLayout" | "meshBake.limitExceeded" | "meshBake.nonFiniteOutput" | "meshBake.degenerateTriangle";
export interface MeshBakeTransformDiagnostic {
    readonly code: MeshBakeTransformDiagnosticCode;
    readonly severity: "error";
    readonly path: string;
    readonly message: string;
}
export interface BakeMeshAssetTransformResult {
    readonly valid: boolean;
    /** New owned buffers and metadata. Never a partial mesh on failure. */
    readonly mesh: MeshAsset | null;
    readonly diagnostics: readonly MeshBakeTransformDiagnostic[];
}
export declare class MeshBakeFailure extends Error {
    readonly diagnostic: MeshBakeTransformDiagnostic;
    constructor(diagnostic: MeshBakeTransformDiagnostic);
}
export declare function bakeFailure(diagnostic: Omit<MeshBakeTransformDiagnostic, "severity">): never;
//# sourceMappingURL=bake-transform-types.d.ts.map