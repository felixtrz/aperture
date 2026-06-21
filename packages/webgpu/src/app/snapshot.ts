import {
  createRenderSnapshotChangeSet,
  createRenderSnapshotUpdateSchedule,
  type RenderSnapshot,
  type RenderSnapshotChangeSet,
  type RenderSnapshotUpdateSchedule,
} from "@aperture-engine/render";

export function createEmptyRenderSnapshot(frame: number): RenderSnapshot {
  return {
    frame,
    time: frame / 60,
    views: [],
    meshDraws: [],
    spriteDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    instanceTints: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      spriteDraws: 0,
      skyboxes: 0,
      proceduralSkies: 0,
      runtimeUniforms: 0,
      fogs: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

export function renderSnapshotTimeSeconds(snapshot: RenderSnapshot): number {
  return typeof snapshot.time === "number" && Number.isFinite(snapshot.time)
    ? snapshot.time
    : snapshot.frame / 60;
}

export function createWebGpuAppSnapshotUpdateMetadata(
  snapshot: RenderSnapshot,
  options: {
    readonly snapshot?: RenderSnapshot;
    readonly snapshotChangeSet?: RenderSnapshotChangeSet;
    readonly previousSnapshotForUpdate?: RenderSnapshot | null;
  },
): {
  readonly snapshotChangeSet: RenderSnapshotChangeSet;
  readonly snapshotUpdateSchedule: RenderSnapshotUpdateSchedule;
} {
  const snapshotChangeSet =
    options.snapshotChangeSet?.frame === snapshot.frame &&
    options.snapshot === snapshot
      ? options.snapshotChangeSet
      : createRenderSnapshotChangeSet(
          options.previousSnapshotForUpdate ?? null,
          snapshot,
          {
            includeKeys: false,
            includeUnchangedMeshDrawRenderIds: true,
          },
        );

  return {
    snapshotChangeSet,
    snapshotUpdateSchedule:
      createRenderSnapshotUpdateSchedule(snapshotChangeSet),
  };
}
