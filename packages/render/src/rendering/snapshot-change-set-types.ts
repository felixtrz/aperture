export const RENDER_SNAPSHOT_CHANGE_SET_FAMILIES = [
  "views",
  "meshDraws",
  "shadowCasterDraws",
  "lights",
  "environments",
  "shadowRequests",
  "bounds",
] as const;

export type RenderSnapshotChangeSetFamily =
  (typeof RENDER_SNAPSHOT_CHANGE_SET_FAMILIES)[number];

export interface RenderSnapshotFamilyChangeCounts {
  readonly changed: number;
  readonly unchanged: number;
  readonly removed: number;
}

export interface RenderSnapshotFamilyChangeKeys {
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly removed: readonly string[];
}

export type RenderSnapshotChangeSetKeys = {
  readonly [Family in RenderSnapshotChangeSetFamily]: RenderSnapshotFamilyChangeKeys;
};

export interface RenderSnapshotChangeSet {
  readonly previousFrame: number | null;
  readonly frame: number;
  readonly views: RenderSnapshotFamilyChangeCounts;
  readonly meshDraws: RenderSnapshotFamilyChangeCounts;
  readonly shadowCasterDraws: RenderSnapshotFamilyChangeCounts;
  readonly lights: RenderSnapshotFamilyChangeCounts;
  readonly environments: RenderSnapshotFamilyChangeCounts;
  readonly shadowRequests: RenderSnapshotFamilyChangeCounts;
  readonly bounds: RenderSnapshotFamilyChangeCounts;
  readonly total: RenderSnapshotFamilyChangeCounts;
  readonly unchangedMeshDrawRenderIds?: readonly number[];
  readonly keys?: RenderSnapshotChangeSetKeys;
}
