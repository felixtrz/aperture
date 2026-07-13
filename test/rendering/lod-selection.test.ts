import { describe, expect, it } from "vitest";

import { createMeshHandle } from "@aperture-engine/simulation";
import {
  clampLevel,
  createLod,
  lodDistance,
  selectLodLevel,
  validateLodInput,
} from "@aperture-engine/render";

// Pure, deterministic mesh-LOD level selection (E2): the distance → level-index
// math with a symmetric hysteresis band. No ECS, no camera — exactly what runs
// worker-side under extraction and in replay.
describe("selectLodLevel", () => {
  const thresholds = [0, 10, 20];

  it("picks the highest level whose threshold the distance has passed (no hysteresis)", () => {
    expect(selectLodLevel(0, thresholds, 0, 0)).toBe(0);
    expect(selectLodLevel(5, thresholds, 0, 0)).toBe(0);
    expect(selectLodLevel(10, thresholds, 0, 0)).toBe(1);
    expect(selectLodLevel(15, thresholds, 0, 0)).toBe(1);
    expect(selectLodLevel(20, thresholds, 0, 0)).toBe(2);
    expect(selectLodLevel(1000, thresholds, 0, 0)).toBe(2);
  });

  it("resolves to the correct band from any stale current level when hysteresis is 0", () => {
    // Coming from a coarser level, a near distance drops all the way to level 0.
    expect(selectLodLevel(3, thresholds, 2, 0)).toBe(0);
    // Coming from a finer level, a far distance climbs to the last level.
    expect(selectLodLevel(25, thresholds, 0, 0)).toBe(2);
  });

  it("switches up only past threshold + hysteresis (climbing away)", () => {
    // Boundary between level 0 and 1 is at distance 10; band half-width 2.
    expect(selectLodLevel(11, thresholds, 0, 2)).toBe(0); // < 10 + 2 → stays
    expect(selectLodLevel(12, thresholds, 0, 2)).toBe(1); // >= 10 + 2 → switches
  });

  it("switches down only below threshold - hysteresis (coming nearer)", () => {
    // From level 1 the boundary back to 0 is at 10; must drop below 10 - 2 = 8.
    expect(selectLodLevel(9, thresholds, 1, 2)).toBe(1); // >= 8 → stays
    expect(selectLodLevel(7, thresholds, 1, 2)).toBe(0); // < 8 → switches
  });

  it("keeps the current level for any distance inside the hysteresis band (no popping, both directions)", () => {
    // Band around the 10 boundary is [8, 12). Inside it the level is sticky.
    for (const distance of [8, 9, 10, 11, 11.999]) {
      expect(selectLodLevel(distance, thresholds, 0, 2)).toBe(0);
      expect(selectLodLevel(distance, thresholds, 1, 2)).toBe(1);
    }
  });

  it("does not pop when a small nudge straddles the raw threshold within the band", () => {
    // The e2e's no-popping proof in miniature: distance crosses the raw
    // boundary (10) but stays inside the band, so the level never changes.
    expect(selectLodLevel(9.5, thresholds, 0, 2)).toBe(0);
    expect(selectLodLevel(10.5, thresholds, 0, 2)).toBe(0);
  });

  it("clamps an out-of-range current level before selecting", () => {
    expect(selectLodLevel(5, thresholds, 99, 0)).toBe(0);
    expect(selectLodLevel(5, thresholds, -3, 0)).toBe(0);
    expect(selectLodLevel(25, thresholds, 99, 0)).toBe(2);
  });

  it("treats a non-finite hysteresis as no band and a non-finite distance as 0", () => {
    expect(selectLodLevel(15, thresholds, 0, Number.NaN)).toBe(1);
    expect(selectLodLevel(Number.NaN, thresholds, 0, 0)).toBe(0);
    expect(selectLodLevel(15, thresholds, 0, -5)).toBe(1); // negative → 0 band
  });

  it("returns level 0 for an empty threshold list", () => {
    expect(selectLodLevel(100, [], 0, 0)).toBe(0);
  });

  it("handles a single level (always 0)", () => {
    expect(selectLodLevel(0, [0], 0, 1)).toBe(0);
    expect(selectLodLevel(9999, [0], 0, 1)).toBe(0);
  });
});

describe("clampLevel", () => {
  it("clamps into [0, count - 1]", () => {
    expect(clampLevel(-1, 3)).toBe(0);
    expect(clampLevel(0, 3)).toBe(0);
    expect(clampLevel(2, 3)).toBe(2);
    expect(clampLevel(5, 3)).toBe(2);
    expect(clampLevel(1.9, 3)).toBe(1);
    expect(clampLevel(Number.NaN, 3)).toBe(0);
    expect(clampLevel(0, 0)).toBe(0);
  });
});

describe("lodDistance", () => {
  it("is the euclidean distance between two points", () => {
    expect(lodDistance([0, 0, 0], [0, 0, 10])).toBe(10);
    expect(lodDistance([0, 0, 0], [3, 4, 0])).toBe(5);
    expect(lodDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe("createLod / validateLodInput", () => {
  const near = createMeshHandle("rock-hi");
  const far = createMeshHandle("rock-lo");

  it("resolves levels verbatim (order preserved) with currentLevel 0", () => {
    const data = createLod({
      levels: [
        { mesh: near, distance: 0 },
        { mesh: far, distance: 20 },
      ],
      hysteresis: 2,
    });

    expect(data).toEqual({
      levels: [
        { meshId: "mesh:rock-hi", distance: 0 },
        { meshId: "mesh:rock-lo", distance: 20 },
      ],
      hysteresis: 2,
      currentLevel: 0,
    });
  });

  it("accepts a well-formed LOD", () => {
    expect(
      validateLodInput({
        levels: [
          { mesh: near, distance: 0 },
          { mesh: far, distance: 20 },
        ],
        hysteresis: 2,
      }).valid,
    ).toBe(true);
  });

  it("flags empty levels", () => {
    const report = validateLodInput({ levels: [] });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "lod.emptyLevels",
    );
  });

  it("flags out-of-order thresholds", () => {
    const report = validateLodInput({
      levels: [
        { mesh: near, distance: 20 },
        { mesh: far, distance: 5 },
      ],
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "lod.thresholdsNotAscending",
    );
  });

  it("flags a negative hysteresis", () => {
    const report = validateLodInput({
      levels: [{ mesh: near, distance: 0 }],
      hysteresis: -1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "lod.invalidHysteresis",
    );
  });
});
