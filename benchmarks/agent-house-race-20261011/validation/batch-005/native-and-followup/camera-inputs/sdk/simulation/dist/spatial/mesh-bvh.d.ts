import { type Aabb, type BoundingSphere, type Frustum, type Mat4Like, type Ray, type Vec2, type Vec3, type Vec3Like } from "@aperture-engine/math";
export type MeshBvhBuildStrategy = "center" | "average" | "sah";
export type BvhShapeIntersection = "not-intersected" | "intersected" | "contained";
export type MeshRaycastHitSource = "mesh-linear" | "mesh-bvh";
export interface SpatialMeshAttribute {
    readonly data: ArrayLike<number>;
    readonly offset?: number;
    readonly stride: number;
}
export interface SpatialMeshSubmesh {
    readonly label?: string;
    readonly topology?: "triangle-list";
    readonly materialSlot?: number;
    readonly vertexStart?: number;
    readonly vertexCount?: number;
    readonly indexStart?: number;
    readonly indexCount?: number;
}
export interface SpatialTriangleMesh {
    readonly positions: SpatialMeshAttribute;
    readonly vertexCount: number;
    readonly indices?: ArrayLike<number>;
    readonly normals?: SpatialMeshAttribute;
    readonly uvs?: SpatialMeshAttribute;
    readonly submeshes?: readonly SpatialMeshSubmesh[];
}
export interface MeshTriangleRaycastOptions {
    readonly maxDistance?: number;
    readonly includeBackfaces?: boolean;
    readonly includeUv?: boolean;
    readonly includeNormal?: boolean;
    readonly stats?: MeshTriangleQueryStats;
}
export interface MeshBvhRaycastOptions extends Omit<MeshTriangleRaycastOptions, "stats"> {
    readonly firstHitOnly?: boolean;
    readonly stats?: MeshBvhTraversalStats;
}
export interface MeshTriangleQueryStats {
    testedPrimitiveCount: number;
}
export interface MeshBvhTraversalStats extends MeshTriangleQueryStats {
    visitedNodeCount: number;
}
export interface MeshTriangleHit {
    readonly distance: number;
    readonly point: Vec3;
    readonly normal: Vec3;
    readonly uv?: Vec2;
    readonly barycentric: Vec3;
    readonly faceIndex: number;
    readonly submeshIndex: number;
    readonly materialSlot: number;
    readonly source: MeshRaycastHitSource;
}
export interface MeshBvhBuildOptions {
    readonly strategy?: MeshBvhBuildStrategy;
    readonly maxDepth?: number;
    readonly maxLeafSize?: number;
    readonly indirect?: boolean;
}
export interface MeshBvhBuildStats {
    readonly nodeCount: number;
    readonly leafCount: number;
    readonly maxDepth: number;
    readonly primitiveCount: number;
    readonly buildStrategy: MeshBvhBuildStrategy;
    readonly maxLeafSize: number;
    readonly indirect: boolean;
    readonly memoryBytes: number;
}
export type MeshBvhDynamicPolicy = "static" | "refit" | "rebuild";
export interface MeshBvhCacheBuildInput {
    readonly meshKey: string;
    readonly version: number | string;
    readonly mesh: SpatialTriangleMesh;
    readonly primitiveRangesKey?: string;
    readonly options?: MeshBvhBuildOptions;
    readonly dynamicPolicy?: MeshBvhDynamicPolicy;
    readonly unsupportedTopology?: boolean;
    readonly unsupportedSkinned?: boolean;
    readonly unsupportedMorphed?: boolean;
}
export interface MeshBvhCacheReport {
    readonly cacheKey: string;
    readonly bvh: MeshBvh | null;
    readonly reused: boolean;
    readonly refit: boolean;
    readonly built: boolean;
    readonly buildTimeMs: number;
    readonly memoryEstimateBytes: number;
    readonly stats: MeshBvhBuildStats | null;
    readonly diagnostics: readonly SpatialDiagnostic[];
}
export interface SerializedMeshBvh {
    readonly nodeBounds: Float32Array;
    readonly nodeData: Uint32Array;
    readonly primitiveIndices: Uint32Array;
    readonly stats: MeshBvhBuildStats;
}
export interface TriangleView {
    readonly a: Vec3;
    readonly b: Vec3;
    readonly c: Vec3;
    readonly normal: Vec3;
    readonly uvA?: Vec2;
    readonly uvB?: Vec2;
    readonly uvC?: Vec2;
    readonly faceIndex: number;
    readonly submeshIndex: number;
    readonly materialSlot: number;
}
export interface TriangleHitScratch {
    distance: number;
    point: Vec3;
    normal: Vec3;
    barycentric: Vec3;
}
export interface MeshBvhVisitCallbacks {
    intersectsBounds(bounds: Aabb, info: {
        readonly isLeaf: boolean;
        readonly depth: number;
        readonly nodeIndex: number;
        readonly score?: number;
    }): BvhShapeIntersection | boolean;
    boundsTraverseOrder?(bounds: Aabb): number;
    intersectsRange?(range: {
        readonly offset: number;
        readonly count: number;
        readonly contained: boolean;
        readonly depth: number;
        readonly nodeIndex: number;
        readonly bounds: Aabb;
    }): boolean;
    intersectsTriangle?(triangle: TriangleView, hit: TriangleHitScratch): boolean | void;
}
export interface ClosestPointOptions {
    readonly maxDistance?: number;
    readonly stats?: MeshBvhTraversalStats;
}
export interface MeshBvhClosestPoint {
    readonly point: Vec3;
    readonly distance: number;
    readonly faceIndex: number;
    readonly submeshIndex: number;
    readonly materialSlot: number;
}
export interface Capsule {
    readonly start: Vec3Like;
    readonly end: Vec3Like;
    readonly radius: number;
}
export interface MeshBvhPrimitivePair {
    readonly aFaceIndex: number;
    readonly bFaceIndex: number;
    readonly aSubmeshIndex: number;
    readonly bSubmeshIndex: number;
}
export interface MeshBvhCastOptions {
    readonly maxPairs?: number;
}
export type SpatialDiagnosticCode = "spatial.ray.invalid" | "spatial.mesh-bvh.missing" | "spatial.mesh-bvh.stale" | "spatial.mesh-bvh.unsupported-topology" | "spatial.mesh-bvh.unsupported-skinned" | "spatial.mesh-bvh.unsupported-morphed" | "spatial.mesh-bvh.build-failed" | "spatial.query.no-pickable";
export interface SpatialDiagnostic {
    readonly code: SpatialDiagnosticCode;
    readonly severity: "info" | "warning" | "error";
    readonly message: string;
    readonly suggestedFix?: string;
    readonly data?: Readonly<Record<string, unknown>>;
}
export interface SpatialQueryReport {
    readonly queryId: string;
    readonly source: "bounds" | "mesh-bvh" | "id-buffer" | "physics";
    readonly fallback: "none" | "bounds";
    readonly candidateEntityCount: number;
    readonly testedEntityCount: number;
    readonly testedPrimitiveCount: number;
    readonly visitedNodeCount: number;
    readonly hitCount: number;
    readonly firstHitDistance: number | null;
    readonly diagnostics: readonly SpatialDiagnostic[];
}
export declare function createMeshTriangleQuery(mesh: SpatialTriangleMesh): {
    raycast(ray: Ray, options?: MeshTriangleRaycastOptions): readonly MeshTriangleHit[];
    raycastFirst(ray: Ray, options?: MeshTriangleRaycastOptions): MeshTriangleHit | null;
};
export declare function raycastMeshTriangles(mesh: SpatialTriangleMesh, ray: Ray, options?: MeshTriangleRaycastOptions): readonly MeshTriangleHit[];
export declare function raycastFirstMeshTriangle(mesh: SpatialTriangleMesh, ray: Ray, options?: MeshTriangleRaycastOptions): MeshTriangleHit | null;
export declare function createMeshBvh(mesh: SpatialTriangleMesh, options?: MeshBvhBuildOptions): MeshBvh;
export declare function deserializeMeshBvh(mesh: SpatialTriangleMesh, serialized: SerializedMeshBvh): MeshBvh;
export declare function createMeshTriangleQueryStats(): MeshTriangleQueryStats;
export declare function createMeshBvhTraversalStats(): MeshBvhTraversalStats;
export declare function createSpatialQueryReport(report: SpatialQueryReport): SpatialQueryReport;
export declare function createMeshBvhCache(): MeshBvhCache;
export declare function createMeshBvhCacheKey(input: MeshBvhCacheBuildInput): string;
export declare class MeshBvhCache {
    private readonly entries;
    private readonly latestKeyByMesh;
    private readonly keysByMesh;
    private readonly versionByMesh;
    getOrBuild(input: MeshBvhCacheBuildInput): MeshBvhCacheReport;
    invalidate(meshKey: string): void;
    /**
     * Drop cached BVH entries for any mesh key NOT in `liveMeshKeys` — called after a
     * spatial-index population pass to reclaim BVHs for despawned/removed meshes.
     */
    prune(liveMeshKeys: ReadonlySet<string>): void;
    private finishGetOrBuild;
    private storeBuiltBvh;
    private buildFailedReport;
    private rememberKey;
}
export declare class MeshBvh {
    private readonly mesh;
    readonly nodeBounds: Float32Array;
    readonly nodeData: Uint32Array;
    readonly primitiveIndices: Uint32Array;
    readonly stats: MeshBvhBuildStats;
    static build(mesh: SpatialTriangleMesh, options?: MeshBvhBuildOptions): MeshBvh;
    private readonly triangles;
    constructor(mesh: SpatialTriangleMesh, nodeBounds: Float32Array, nodeData: Uint32Array, primitiveIndices: Uint32Array, stats: MeshBvhBuildStats);
    raycast(ray: Ray, options?: MeshBvhRaycastOptions): readonly MeshTriangleHit[];
    raycastFirst(ray: Ray, options?: MeshBvhRaycastOptions): MeshTriangleHit | null;
    visitMeshBvh(callbacks: MeshBvhVisitCallbacks): boolean;
    intersectsSphere(sphere: BoundingSphere): boolean;
    intersectsBox(box: Aabb, boxToMesh?: Mat4Like): boolean;
    intersectsCapsule(capsule: Capsule): boolean;
    intersectsFrustum(frustum: Frustum): boolean;
    closestPointToPoint(point: Vec3Like, options?: ClosestPointOptions): MeshBvhClosestPoint | null;
    closestPointToSegment(start: Vec3Like, end: Vec3Like, options?: ClosestPointOptions): MeshBvhClosestPoint | null;
    bvhcast(other: MeshBvh, options?: MeshBvhCastOptions): readonly MeshBvhPrimitivePair[];
    refit(_nodeIndices?: Iterable<number>): void;
    serialize(): SerializedMeshBvh;
    private raycastLeaf;
    private raycastLeafFirst;
    private refitNode;
    private readNodeBounds;
    private isLeaf;
    private leftChild;
    private rightChild;
    private primitiveOffset;
    private primitiveCount;
    private nodeDepth;
}
//# sourceMappingURL=mesh-bvh.d.ts.map