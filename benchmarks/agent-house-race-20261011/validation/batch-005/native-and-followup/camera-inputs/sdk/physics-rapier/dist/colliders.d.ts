import RAPIER from "@dimforge/rapier3d-compat";
import { type PhysicsColliderDescriptor, type PhysicsColliderGeometryProvider, type PhysicsCommand, type PhysicsUnsupportedFeature } from "@aperture-engine/physics";
import type { RapierBodyEntry, RapierColliderEntry, RapierColliderMatch } from "./types.js";
export interface RapierColliderDescOptions {
    readonly colliderGeometryProvider?: PhysicsColliderGeometryProvider;
}
export declare class RapierColliderSyncError extends Error {
    readonly feature: PhysicsUnsupportedFeature;
    constructor(feature: PhysicsUnsupportedFeature);
}
export declare function isRapierColliderSyncError(error: unknown): error is RapierColliderSyncError;
export declare function colliderDesc(collider: PhysicsColliderDescriptor, options?: RapierColliderDescOptions): RAPIER.ColliderDesc;
export declare function collidersForCommand(command: Extract<PhysicsCommand, {
    readonly kind: "upsertBody";
}>): readonly PhysicsColliderDescriptor[];
export declare function primaryCollider(entry: RapierBodyEntry): RapierColliderEntry | null;
export declare function colliderCount(bodies: ReadonlyMap<string, RapierBodyEntry>): number;
export declare function colliderEntries(bodies: ReadonlyMap<string, RapierBodyEntry>): readonly RapierColliderMatch[];
export declare function colliderMatchForCollider(bodies: ReadonlyMap<string, RapierBodyEntry>, collider: RAPIER.Collider): RapierColliderMatch | null;
export declare function entityForCollider(bodies: ReadonlyMap<string, RapierBodyEntry>, collider: RAPIER.Collider): string | null;
export declare function colliderKeyFor(colliders: readonly PhysicsColliderDescriptor[]): string;
export declare function colliderMatchForHandle(bodies: ReadonlyMap<string, RapierBodyEntry>, handle: number): RapierColliderMatch | null;
/**
 * Build a Rapier-collider-handle -> match index in a single pass over the body
 * store. Per-step event resolution previously ran a nested O(bodies x colliders)
 * scan (`colliderMatchForHandle`) up to four times per contact pair; building
 * this index once per step and looking up O(1) collapses that to one pass plus
 * O(1) per handle. Rebuilt every step from the live body store, so it can never
 * go stale across upsert/destroy.
 */
export declare function buildColliderHandleIndex(bodies: ReadonlyMap<string, RapierBodyEntry>): Map<number, RapierColliderMatch>;
export declare function compareColliderMatches(left: RapierColliderMatch, right: RapierColliderMatch): number;
//# sourceMappingURL=colliders.d.ts.map