import { type RenderSnapshotChangeSet, type RenderSnapshotChangeSetFamily, type RenderSnapshotFamilyChangeCounts } from "./snapshot-change-set.js";
export declare const RENDER_SNAPSHOT_UPDATE_SCHEDULE_FAMILIES: readonly ["views", "meshDraws", "shadowCasterDraws", "lights", "environments", "proceduralSkies", "runtimeUniforms", "shadowRequests", "bounds"];
export type RenderSnapshotFamilyUpdateAction = "refresh" | "reuse" | "remove" | "mixed" | "skip";
export interface RenderSnapshotFamilyUpdateSchedule extends RenderSnapshotFamilyChangeCounts {
    readonly family: RenderSnapshotChangeSetFamily;
    readonly action: RenderSnapshotFamilyUpdateAction;
    readonly refreshes: number;
    readonly reuses: number;
    readonly removals: number;
    readonly packetWork: number;
}
export type RenderSnapshotUpdateScheduleByFamily = {
    readonly [Family in RenderSnapshotChangeSetFamily]: RenderSnapshotFamilyUpdateSchedule;
};
export interface RenderSnapshotUpdateScheduleTotals {
    readonly families: number;
    readonly refreshFamilies: number;
    readonly reuseFamilies: number;
    readonly removeFamilies: number;
    readonly mixedFamilies: number;
    readonly skipFamilies: number;
    readonly packetRefreshes: number;
    readonly packetReuses: number;
    readonly packetRemovals: number;
    readonly packetWork: number;
}
export interface RenderSnapshotUpdateSchedule {
    readonly previousFrame: number | null;
    readonly frame: number;
    readonly fullRefresh: boolean;
    readonly incremental: boolean;
    readonly families: readonly RenderSnapshotFamilyUpdateSchedule[];
    readonly byFamily: RenderSnapshotUpdateScheduleByFamily;
    readonly total: RenderSnapshotUpdateScheduleTotals;
}
export declare function createRenderSnapshotUpdateSchedule(changeSet: RenderSnapshotChangeSet): RenderSnapshotUpdateSchedule;
//# sourceMappingURL=snapshot-update-scheduler.d.ts.map