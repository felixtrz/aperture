import { type RenderSnapshot, type RenderSnapshotChangeSet, type RenderSnapshotUpdateSchedule } from "@aperture-engine/render";
export declare function createEmptyRenderSnapshot(frame: number): RenderSnapshot;
export declare function renderSnapshotTimeSeconds(snapshot: RenderSnapshot): number;
export declare function createWebGpuAppSnapshotUpdateMetadata(snapshot: RenderSnapshot, options: {
    readonly snapshot?: RenderSnapshot;
    readonly snapshotChangeSet?: RenderSnapshotChangeSet;
    readonly previousSnapshotForUpdate?: RenderSnapshot | null;
}): {
    readonly snapshotChangeSet: RenderSnapshotChangeSet;
    readonly snapshotUpdateSchedule: RenderSnapshotUpdateSchedule;
};
//# sourceMappingURL=snapshot.d.ts.map