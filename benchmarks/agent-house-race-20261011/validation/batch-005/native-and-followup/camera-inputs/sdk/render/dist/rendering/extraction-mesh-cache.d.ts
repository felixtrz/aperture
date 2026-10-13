import { type Entity, type Mat4 } from "@aperture-engine/simulation";
import type { BoundsPacket, MeshDrawPacket } from "./snapshot.js";
export interface RenderExtractionCache {
    readonly meshDrawEntities: Map<string, CachedMeshDrawEntity>;
    readonly shadowCasterDrawEntities: Map<string, CachedMeshDrawEntity>;
    /**
     * Persistent numeric accumulators reused across frames (AI-30): reset to
     * length 0 at the start of each extraction and copied into fresh per-frame
     * typed arrays before the snapshot is returned, so reuse can never alias a
     * previously returned snapshot.
     */
    readonly scratch: RenderExtractionScratch;
    /**
     * Feature families already reported as gated-off-with-live-entities, so the
     * warning fires once per family per cache lifetime instead of every frame.
     */
    readonly gatedFeatureFamiliesReported: Set<string>;
    clear(): void;
}
export type MeshDrawEntityCacheScope = "mesh" | "shadow-caster";
interface RenderExtractionScratch {
    readonly transforms: number[];
    readonly bones: number[];
    readonly morphTargetWeights: number[];
    readonly morphTargetDeltas: number[];
    readonly morphInstanceDescriptors: number[];
    readonly instanceTints: number[];
    readonly instanceAttributes: number[];
    readonly quadInstanceFloats: number[];
    readonly quadInstanceWords: number[];
    readonly viewMatrices: number[];
}
type MeshDrawPacketTemplate = Omit<MeshDrawPacket, "worldTransformOffset" | "boundsIndex" | "instanceAttributePacketIndex">;
interface CachedMeshDrawEntity {
    readonly entityVersion: number;
    readonly transformVersion: number;
    readonly assetSignature: string;
    readonly cameraLayerMask: number;
    readonly viewCullSignature: number;
    readonly layerMask: number;
    readonly worldMatrix: readonly number[];
    readonly instanceTint: readonly number[] | null;
    readonly bounds: Omit<BoundsPacket, "boundsId">;
    readonly draws: readonly MeshDrawPacketTemplate[];
}
export declare function createRenderExtractionCache(): RenderExtractionCache;
export declare function meshDrawEntityCacheForScope(cache: RenderExtractionCache, scope: MeshDrawEntityCacheScope): Map<string, CachedMeshDrawEntity>;
export declare function appendCachedMeshDrawEntity(cached: CachedMeshDrawEntity, transforms: number[], instanceTints: number[], bounds: BoundsPacket[], draws: MeshDrawPacket[], sort?: {
    readonly viewId: number;
    readonly depth: number;
}): void;
export declare function createMeshDrawPacketTemplate(draw: MeshDrawPacket): MeshDrawPacketTemplate;
/**
 * Transform-only fast path (AI-67): rebuild a cached entry's world matrix and
 * derived bounds from the entity's current transform without touching the
 * packet templates. Yields bounds byte-identical to a cold createBoundsPacket
 * run (same transformAabb/transformPoint/maxScaleOnAxis math), so the fast
 * path cannot perturb deterministic snapshots.
 */
export declare function refreshCachedMeshDrawEntityTransform(cached: CachedMeshDrawEntity, worldMatrix: Mat4, transformVersion: number): CachedMeshDrawEntity;
export declare function entityCacheKey(entity: Entity): string;
export {};
//# sourceMappingURL=extraction-mesh-cache.d.ts.map