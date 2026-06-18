import type { RenderSnapshot } from "./snapshot.js";
import {
  comparePacketFamily,
  totalCounts,
  type ComparePacketFamilyOptions,
} from "./snapshot-change-set-compare.js";
import {
  boundsPackets,
  environmentPackets,
  lightPackets,
  meshDrawPackets,
  shadowCasterDrawPackets,
  shadowRequestPackets,
  viewPackets,
} from "./snapshot-change-set-packets.js";
import type { RenderSnapshotChangeSet } from "./snapshot-change-set-types.js";

export { RENDER_SNAPSHOT_CHANGE_SET_FAMILIES } from "./snapshot-change-set-types.js";
export type {
  RenderSnapshotChangeSet,
  RenderSnapshotChangeSetFamily,
  RenderSnapshotChangeSetKeys,
  RenderSnapshotFamilyChangeCounts,
  RenderSnapshotFamilyChangeKeys,
} from "./snapshot-change-set-types.js";

export function createRenderSnapshotChangeSet(
  previous: RenderSnapshot | null | undefined,
  next: RenderSnapshot,
  options: ComparePacketFamilyOptions = {},
): RenderSnapshotChangeSet {
  const views = comparePacketFamily(
    viewPackets(previous),
    viewPackets(next),
    options,
  );
  const meshDraws = comparePacketFamily(
    meshDrawPackets(previous),
    meshDrawPackets(next),
    options,
  );
  const shadowCasterDraws = comparePacketFamily(
    shadowCasterDrawPackets(previous),
    shadowCasterDrawPackets(next),
    options,
  );
  const lights = comparePacketFamily(
    lightPackets(previous),
    lightPackets(next),
    options,
  );
  const environments = comparePacketFamily(
    environmentPackets(previous),
    environmentPackets(next),
    options,
  );
  const shadowRequests = comparePacketFamily(
    shadowRequestPackets(previous),
    shadowRequestPackets(next),
    options,
  );
  const bounds = comparePacketFamily(
    boundsPackets(previous),
    boundsPackets(next),
    options,
  );
  const keys =
    views.keys === undefined ||
    meshDraws.keys === undefined ||
    shadowCasterDraws.keys === undefined ||
    lights.keys === undefined ||
    environments.keys === undefined ||
    shadowRequests.keys === undefined ||
    bounds.keys === undefined
      ? undefined
      : {
          views: views.keys,
          meshDraws: meshDraws.keys,
          shadowCasterDraws: shadowCasterDraws.keys,
          lights: lights.keys,
          environments: environments.keys,
          shadowRequests: shadowRequests.keys,
          bounds: bounds.keys,
        };

  return {
    previousFrame: previous?.frame ?? null,
    frame: next.frame,
    views: views.counts,
    meshDraws: meshDraws.counts,
    shadowCasterDraws: shadowCasterDraws.counts,
    lights: lights.counts,
    environments: environments.counts,
    shadowRequests: shadowRequests.counts,
    bounds: bounds.counts,
    total: totalCounts([
      views.counts,
      meshDraws.counts,
      shadowCasterDraws.counts,
      lights.counts,
      environments.counts,
      shadowRequests.counts,
      bounds.counts,
    ]),
    ...(keys === undefined ? {} : { keys }),
  };
}
