import {
  RENDER_SNAPSHOT_CHANGE_SET_FAMILIES,
  type RenderSnapshotChangeSet,
  type RenderSnapshotChangeSetFamily,
  type RenderSnapshotFamilyChangeCounts,
} from "./snapshot-change-set.js";

export const RENDER_SNAPSHOT_UPDATE_SCHEDULE_FAMILIES =
  RENDER_SNAPSHOT_CHANGE_SET_FAMILIES;

export type RenderSnapshotFamilyUpdateAction =
  | "refresh"
  | "reuse"
  | "remove"
  | "mixed"
  | "skip";

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

export function createRenderSnapshotUpdateSchedule(
  changeSet: RenderSnapshotChangeSet,
): RenderSnapshotUpdateSchedule {
  const families = RENDER_SNAPSHOT_UPDATE_SCHEDULE_FAMILIES.map((family) =>
    createFamilyUpdateSchedule(family, changeSet[family]),
  );
  const total = totalSchedule(families);
  const fullRefresh =
    changeSet.previousFrame === null ||
    (total.packetRefreshes > 0 &&
      total.packetReuses === 0 &&
      total.packetRemovals === 0);

  return {
    previousFrame: changeSet.previousFrame,
    frame: changeSet.frame,
    fullRefresh,
    incremental: !fullRefresh,
    families,
    byFamily: Object.fromEntries(
      families.map((schedule) => [schedule.family, { ...schedule }]),
    ) as RenderSnapshotUpdateScheduleByFamily,
    total,
  };
}

function createFamilyUpdateSchedule(
  family: RenderSnapshotChangeSetFamily,
  counts: RenderSnapshotFamilyChangeCounts,
): RenderSnapshotFamilyUpdateSchedule {
  const action = updateAction(counts);

  return {
    family,
    action,
    changed: counts.changed,
    unchanged: counts.unchanged,
    removed: counts.removed,
    refreshes: counts.changed,
    reuses: counts.unchanged,
    removals: counts.removed,
    packetWork: counts.changed + counts.removed,
  };
}

function updateAction(
  counts: RenderSnapshotFamilyChangeCounts,
): RenderSnapshotFamilyUpdateAction {
  if (counts.changed === 0 && counts.unchanged === 0 && counts.removed === 0) {
    return "skip";
  }

  if (counts.changed > 0 && counts.unchanged === 0 && counts.removed === 0) {
    return "refresh";
  }

  if (counts.changed === 0 && counts.unchanged > 0 && counts.removed === 0) {
    return "reuse";
  }

  if (counts.changed === 0 && counts.unchanged === 0 && counts.removed > 0) {
    return "remove";
  }

  return "mixed";
}

function totalSchedule(
  families: readonly RenderSnapshotFamilyUpdateSchedule[],
): RenderSnapshotUpdateScheduleTotals {
  return families.reduce(
    (total, family) => ({
      families: total.families + 1,
      refreshFamilies:
        total.refreshFamilies + (family.action === "refresh" ? 1 : 0),
      reuseFamilies: total.reuseFamilies + (family.action === "reuse" ? 1 : 0),
      removeFamilies:
        total.removeFamilies + (family.action === "remove" ? 1 : 0),
      mixedFamilies: total.mixedFamilies + (family.action === "mixed" ? 1 : 0),
      skipFamilies: total.skipFamilies + (family.action === "skip" ? 1 : 0),
      packetRefreshes: total.packetRefreshes + family.refreshes,
      packetReuses: total.packetReuses + family.reuses,
      packetRemovals: total.packetRemovals + family.removals,
      packetWork: total.packetWork + family.packetWork,
    }),
    {
      families: 0,
      refreshFamilies: 0,
      reuseFamilies: 0,
      removeFamilies: 0,
      mixedFamilies: 0,
      skipFamilies: 0,
      packetRefreshes: 0,
      packetReuses: 0,
      packetRemovals: 0,
      packetWork: 0,
    },
  );
}
