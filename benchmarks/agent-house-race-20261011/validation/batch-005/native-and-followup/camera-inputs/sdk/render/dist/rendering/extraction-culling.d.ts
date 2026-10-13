import type { Aabb, BoundingSphere, Mat4 } from "@aperture-engine/simulation";
import type { RenderEntityRef } from "./snapshot.js";
export interface FrustumPlane {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly constant: number;
}
interface MutableViewCullStats {
    viewId: number;
    camera: RenderEntityRef;
    tested: number;
    culled: number;
    included: number;
}
export interface ViewCullContext {
    readonly viewId: number;
    readonly camera: RenderEntityRef;
    readonly priority: number;
    readonly layerMask: number;
    readonly viewMatrix: Mat4;
    readonly frustumCulling: boolean;
    readonly planes: readonly FrustumPlane[];
    readonly stats: MutableViewCullStats;
}
export declare function isVisibleInAnyMatchingView(worldAabb: Aabb, layerMask: number, viewCullContexts: readonly ViewCullContext[]): boolean;
export declare function firstMatchingSortView(layerMask: number, viewCullContexts: readonly ViewCullContext[]): ViewCullContext | undefined;
export declare function computeViewDepth(viewMatrix: Mat4, worldCenter: BoundingSphere["center"]): number;
export declare function createFrustumPlanes(matrix: Mat4): readonly FrustumPlane[];
export declare function createViewCullSignature(viewCullContexts: readonly ViewCullContext[]): number;
export {};
//# sourceMappingURL=extraction-culling.d.ts.map