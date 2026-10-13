import { type EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import type { ApertureEntityLookupDiagnostic } from "../entities/lookup/types.js";
export interface HierarchyChildrenResult {
    readonly ok: boolean;
    readonly children: readonly EcsEntityRef[];
    readonly diagnostic?: ApertureEntityLookupDiagnostic;
}
export interface HierarchySetParentResult {
    readonly ok: boolean;
    readonly diagnostic?: ApertureEntityLookupDiagnostic;
}
export interface HierarchyDespawnResult {
    readonly ok: boolean;
    readonly despawned: number;
    readonly diagnostic?: ApertureEntityLookupDiagnostic;
}
export interface HierarchyAccess {
    /** Ordered, live children of `entity` (stale refs dropped). */
    children(entity: EcsEntityRef): HierarchyChildrenResult;
    /**
     * Reparent `child` under `parent` (or detach to a transform root when `parent`
     * is null) while preserving the child's world-space transform. Cycles and
     * missing/invalid world transforms are reported as diagnostics.
     */
    setParent(child: EcsEntityRef, parent: EcsEntityRef | null): HierarchySetParentResult;
    /** Destroy `entity` and its entire subtree; returns the count destroyed. */
    despawnRecursive(entity: EcsEntityRef): HierarchyDespawnResult;
}
export declare function createHierarchyAccess(world: EcsWorld): HierarchyAccess;
//# sourceMappingURL=hierarchy.d.ts.map