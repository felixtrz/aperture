import { type BakeMeshAssetTransformOptions, type BakeMeshAssetTransformResult } from "./bake-transform-types.js";
/**
 * Bake a nonsingular affine transform into an owned static triangle-list asset.
 * Indexed sources remain indexed and can feed mergeMeshAssetsForBatch. Normals
 * use the inverse transpose; tangents are orthogonalized, with mirrored winding
 * and handedness corrected. Unsupported or invalid input produces diagnostics
 * and no partial mesh. See MESH_BAKE_TRANSFORM_LIMITS for fixed work/copy caps.
 */
export declare function bakeMeshAssetTransform(options: BakeMeshAssetTransformOptions): BakeMeshAssetTransformResult;
//# sourceMappingURL=bake-transform.d.ts.map