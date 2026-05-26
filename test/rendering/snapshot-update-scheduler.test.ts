import { describe, expect, it } from "vitest";
import {
  createRenderSnapshotUpdateSchedule,
  type RenderSnapshotChangeSet,
  type RenderSnapshotFamilyChangeCounts,
} from "@aperture-engine/render";

describe("render snapshot update scheduler", () => {
  it("turns changed, unchanged, and removed packet families into renderer work", () => {
    const schedule = createRenderSnapshotUpdateSchedule(
      changeSet({
        previousFrame: 10,
        frame: 11,
        views: { changed: 0, unchanged: 1, removed: 0 },
        meshDraws: { changed: 2, unchanged: 3, removed: 1 },
        lights: { changed: 0, unchanged: 0, removed: 1 },
      }),
    );

    expect(schedule).toMatchObject({
      previousFrame: 10,
      frame: 11,
      fullRefresh: false,
      incremental: true,
      byFamily: {
        views: { family: "views", action: "reuse", reuses: 1 },
        meshDraws: {
          family: "meshDraws",
          action: "mixed",
          refreshes: 2,
          reuses: 3,
          removals: 1,
          packetWork: 3,
        },
        lights: { family: "lights", action: "remove", removals: 1 },
        environments: { family: "environments", action: "skip" },
      },
      total: {
        families: 6,
        reuseFamilies: 1,
        removeFamilies: 1,
        mixedFamilies: 1,
        skipFamilies: 3,
        packetRefreshes: 2,
        packetReuses: 4,
        packetRemovals: 2,
        packetWork: 4,
      },
    });
  });

  it("marks the first snapshot as full refresh work", () => {
    const schedule = createRenderSnapshotUpdateSchedule(
      changeSet({
        previousFrame: null,
        frame: 1,
        views: { changed: 1, unchanged: 0, removed: 0 },
        meshDraws: { changed: 1, unchanged: 0, removed: 0 },
      }),
    );

    expect(schedule.fullRefresh).toBe(true);
    expect(schedule.incremental).toBe(false);
    expect(schedule.total).toMatchObject({
      refreshFamilies: 2,
      packetRefreshes: 2,
      packetReuses: 0,
      packetRemovals: 0,
      packetWork: 2,
    });
  });
});

function changeSet(
  input: Partial<
    Pick<
      RenderSnapshotChangeSet,
      | "previousFrame"
      | "frame"
      | "views"
      | "meshDraws"
      | "lights"
      | "environments"
      | "shadowRequests"
      | "bounds"
    >
  >,
): RenderSnapshotChangeSet {
  const views = input.views ?? emptyCounts();
  const meshDraws = input.meshDraws ?? emptyCounts();
  const lights = input.lights ?? emptyCounts();
  const environments = input.environments ?? emptyCounts();
  const shadowRequests = input.shadowRequests ?? emptyCounts();
  const bounds = input.bounds ?? emptyCounts();

  return {
    previousFrame: input.previousFrame ?? null,
    frame: input.frame ?? 0,
    views,
    meshDraws,
    lights,
    environments,
    shadowRequests,
    bounds,
    total: totalCounts([
      views,
      meshDraws,
      lights,
      environments,
      shadowRequests,
      bounds,
    ]),
  };
}

function emptyCounts(): RenderSnapshotFamilyChangeCounts {
  return { changed: 0, unchanged: 0, removed: 0 };
}

function totalCounts(
  counts: readonly RenderSnapshotFamilyChangeCounts[],
): RenderSnapshotFamilyChangeCounts {
  return counts.reduce(
    (total, current) => ({
      changed: total.changed + current.changed,
      unchanged: total.unchanged + current.unchanged,
      removed: total.removed + current.removed,
    }),
    emptyCounts(),
  );
}
