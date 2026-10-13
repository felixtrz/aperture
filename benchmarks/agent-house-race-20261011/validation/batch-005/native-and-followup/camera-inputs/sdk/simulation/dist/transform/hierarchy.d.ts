import type { EcsWorld, Entity } from "../ecs/index.js";
export type SetParentDiagnosticCode = "cycle" | "missing-world-transform" | "invalid-world-transform";
export interface SetParentDiagnostic {
    readonly code: SetParentDiagnosticCode;
    readonly child: string;
    readonly parent?: string;
    readonly cycle?: readonly string[];
    readonly message: string;
}
export interface SetParentResult {
    readonly ok: boolean;
    readonly diagnostic?: SetParentDiagnostic;
}
/**
 * Reparent `child` under `parent` (or detach to a transform root when `parent`
 * is null) while preserving the child's world-space transform. Updates Parent
 * (authoritative) and the old/new parents' Children index. Cycles are rejected
 * with a structured diagnostic and NO Parent write.
 */
export declare function setParent(world: EcsWorld, child: Entity, parent: Entity | null): SetParentResult;
/**
 * Resolve live children from authoritative Parent links. Valid Children entries
 * retain their insertion order; directly authored children follow in query order.
 * The Parent index is shared across reads until the world changes, so traversing
 * a hierarchy does not scan every entity once per parent.
 */
export declare function getChildren(world: EcsWorld, entity: Entity): Entity[];
/**
 * Depth-first destroy `entity` and its entire subtree. Children are discovered
 * from the authoritative `Parent` relationship, so subtrees parented *outside*
 * setParent — e.g. glTF scene
 * replay, which writes `Parent` directly and never populates `Children` — are
 * still fully torn down instead of leaking detached roots at the world origin.
 * Detaches the subtree root from its parent's Children first so no live entity
 * is left pointing at a destroyed one. Returns the number of entities destroyed.
 */
export declare function despawnRecursive(world: EcsWorld, entity: Entity): number;
//# sourceMappingURL=hierarchy.d.ts.map