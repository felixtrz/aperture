import type { RenderSnapshot } from "./snapshot.js";
import { type ComparePacketFamilyOptions } from "./snapshot-change-set-compare.js";
import type { RenderSnapshotChangeSet } from "./snapshot-change-set-types.js";
export { RENDER_SNAPSHOT_CHANGE_SET_FAMILIES } from "./snapshot-change-set-types.js";
export type { RenderSnapshotChangeSet, RenderSnapshotChangeSetFamily, RenderSnapshotChangeSetKeys, RenderSnapshotFamilyChangeCounts, RenderSnapshotFamilyChangeKeys, } from "./snapshot-change-set-types.js";
export interface CreateRenderSnapshotChangeSetOptions extends ComparePacketFamilyOptions {
    readonly includeUnchangedMeshDrawRenderIds?: boolean;
}
export declare function createRenderSnapshotChangeSet(previous: RenderSnapshot | null | undefined, next: RenderSnapshot, options?: CreateRenderSnapshotChangeSetOptions): RenderSnapshotChangeSet;
//# sourceMappingURL=snapshot-change-set.d.ts.map