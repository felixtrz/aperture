import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
export declare function mergeBounds(meshes: readonly MeshAsset[]): {
    readonly localAabb?: Aabb;
    readonly localSphere?: BoundingSphere;
};
//# sourceMappingURL=mesh-merge-bounds.d.ts.map