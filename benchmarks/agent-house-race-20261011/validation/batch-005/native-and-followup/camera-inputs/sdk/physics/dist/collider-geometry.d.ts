import type { SpatialTriangleMesh } from "@aperture-engine/simulation";
import type { PhysicsUnsupportedFeatureCode } from "./backend.js";
import type { PhysicsVec3 } from "./components.js";
export interface PhysicsTriangleMeshGeometry {
    readonly key: string;
    readonly sourceVersion?: number;
    readonly positions: Float32Array;
    readonly indices: Uint32Array;
    readonly vertexCount: number;
    readonly triangleCount: number;
}
export interface PhysicsHeightfieldGeometry {
    readonly key: string;
    readonly sourceVersion?: number;
    readonly rows: number;
    readonly columns: number;
    readonly heights: Float32Array;
    readonly scale: PhysicsVec3;
}
export interface PhysicsColliderGeometryError {
    readonly code: PhysicsUnsupportedFeatureCode;
    readonly feature: string;
    readonly message: string;
    readonly suggestedFix: string;
    readonly details?: Readonly<Record<string, unknown>>;
}
export type PhysicsColliderGeometryResult<TGeometry> = {
    readonly ok: true;
    readonly geometry: TGeometry;
} | {
    readonly ok: false;
    readonly error: PhysicsColliderGeometryError;
};
export interface PhysicsColliderGeometryProvider {
    triangleMesh(meshId: string): PhysicsColliderGeometryResult<PhysicsTriangleMeshGeometry>;
    heightfield(assetId: string): PhysicsColliderGeometryResult<PhysicsHeightfieldGeometry>;
}
export interface PhysicsTriangleMeshPackingOptions {
    readonly key: string;
    readonly sourceVersion?: number;
    readonly mesh: SpatialTriangleMesh;
}
export declare function createPhysicsTriangleMeshGeometryFromSpatialMesh(options: PhysicsTriangleMeshPackingOptions): PhysicsColliderGeometryResult<PhysicsTriangleMeshGeometry>;
export declare function validatePhysicsHeightfieldGeometry(geometry: PhysicsHeightfieldGeometry): PhysicsColliderGeometryResult<PhysicsHeightfieldGeometry>;
//# sourceMappingURL=collider-geometry.d.ts.map