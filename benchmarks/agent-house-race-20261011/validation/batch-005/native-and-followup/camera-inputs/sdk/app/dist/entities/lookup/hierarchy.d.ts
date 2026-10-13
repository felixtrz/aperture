import { type EcsWorld } from "@aperture-engine/simulation";
import type { ApertureEntityHierarchyReport } from "./types.js";
/**
 * Build the entity hierarchy report consumed by the devtools/ECS tooling.
 *
 * When the M7-T1 `Children` index is in use (any active entity carries it), the
 * tree is assembled by walking the derived index from the transform
 * participants, validating its entries against authoritative Parent links,
 * instead of re-deriving parent->child links
 * by bucketing a full ALL-entities scan. The legacy full-scan path
 * (collectActiveEntities) remains as the fallback for worlds whose subtrees were
 * authored without `Children` (e.g. raw glTF replay) so existing tooling keeps
 * working unchanged.
 */
export declare function createApertureEntityHierarchy(world: EcsWorld): ApertureEntityHierarchyReport;
//# sourceMappingURL=hierarchy.d.ts.map