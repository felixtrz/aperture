import { describe, expect, it } from "vitest";

import {
  packShadowAtlas,
  type ShadowAtlasAssignment,
} from "@aperture-engine/webgpu/test-support";

describe("shadow atlas packer", () => {
  it("packs four 512 shadows into a 1024x1024 atlas with non-overlapping in-bounds regions and drops the over-budget fifth", () => {
    const result = packShadowAtlas({
      atlasWidth: 1024,
      atlasHeight: 1024,
      requests: [
        { shadowId: 1, mapSize: 512 },
        { shadowId: 2, mapSize: 512 },
        { shadowId: 3, mapSize: 512 },
        { shadowId: 4, mapSize: 512 },
        { shadowId: 5, mapSize: 512 },
      ],
    });

    expect(result.assignments).toHaveLength(4);
    expect(result.dropped).toEqual([5]);

    // Every assigned region is in-bounds (passes the atlas bounds validation
    // normalizeAtlasRegion applies: origin + extent <= texture size).
    for (const { region } of result.assignments) {
      expect(region.width).toBe(512);
      expect(region.height).toBe(512);
      expect(region.originX + region.width).toBeLessThanOrEqual(1024);
      expect(region.originY + region.height).toBeLessThanOrEqual(1024);
      expect(Number.isInteger(region.originX)).toBe(true);
      expect(Number.isInteger(region.originY)).toBe(true);
    }

    // No two assigned regions overlap.
    expect(anyOverlap(result.assignments)).toBe(false);

    // Deterministic: the four fit exactly into the 2x2 grid.
    const origins = result.assignments
      .map(({ region }) => `${region.originX},${region.originY}`)
      .sort();
    expect(origins).toEqual(["0,0", "0,512", "512,0", "512,512"]);
  });

  it("packs mixed sizes deterministically by priority then size and drops what cannot fit", () => {
    const result = packShadowAtlas({
      atlasWidth: 1024,
      atlasHeight: 512,
      requests: [
        { shadowId: 1, mapSize: 256, priority: 1 },
        { shadowId: 2, mapSize: 512, priority: 5 },
        { shadowId: 3, mapSize: 512, priority: 0 },
        // 2048 is larger than the atlas — always dropped.
        { shadowId: 4, mapSize: 2048 },
      ],
    });

    // Highest priority (512) packs first at the origin.
    expect(result.assignments[0]).toMatchObject({
      shadowId: 2,
      region: { originX: 0, originY: 0, width: 512, height: 512 },
    });
    expect(result.dropped).toContain(4);
    expect(anyOverlap(result.assignments)).toBe(false);
    for (const { region } of result.assignments) {
      expect(region.originX + region.width).toBeLessThanOrEqual(1024);
      expect(region.originY + region.height).toBeLessThanOrEqual(512);
    }
  });
});

function anyOverlap(assignments: readonly ShadowAtlasAssignment[]): boolean {
  for (let i = 0; i < assignments.length; i += 1) {
    for (let j = i + 1; j < assignments.length; j += 1) {
      if (overlaps(assignments[i]!.region, assignments[j]!.region)) {
        return true;
      }
    }
  }
  return false;
}

function overlaps(
  a: { originX: number; originY: number; width: number; height: number },
  b: { originX: number; originY: number; width: number; height: number },
): boolean {
  return (
    a.originX < b.originX + b.width &&
    a.originX + a.width > b.originX &&
    a.originY < b.originY + b.height &&
    a.originY + a.height > b.originY
  );
}
