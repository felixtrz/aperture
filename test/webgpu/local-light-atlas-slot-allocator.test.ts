import { describe, expect, it } from "vitest";

import {
  allocateLocalLightAtlasSlots,
  createLocalLightAtlasSlotAllocatorState,
  type LocalLightAtlasSlotRequest,
} from "@aperture-engine/webgpu/test-support";

describe("local light atlas slot allocator", () => {
  it("preserves per-light slots across reorder and one-frame toggles", () => {
    const state = createLocalLightAtlasSlotAllocatorState({
      atlasWidth: 512,
      atlasHeight: 256,
      maxStaleGenerations: 1,
    });
    const first = allocateLocalLightAtlasSlots({
      state,
      requests: [
        request("spot-a", 100, 256),
        request("spot-b", 101, 128),
        request("spot-c", 102, 128),
        request("spot-d", 103, 64),
      ],
    });
    const firstRegions = regionByKey(first.tiles);

    expect(first).toMatchObject({
      ready: true,
      assignedSlotCount: 4,
      reusedSlotCount: 0,
      staleSlotCount: 0,
      evictedSlotCount: 0,
    });

    const second = allocateLocalLightAtlasSlots({
      state,
      requests: [
        request("spot-d", 103, 64),
        request("spot-b", 101, 128),
        request("spot-a", 100, 256),
      ],
    });

    expect(second).toMatchObject({
      ready: true,
      assignedSlotCount: 3,
      reusedSlotCount: 3,
      staleSlotCount: 1,
      evictedSlotCount: 0,
    });
    expect(regionByKey(second.tiles).get("spot-a")).toEqual(
      firstRegions.get("spot-a"),
    );
    expect(regionByKey(second.tiles).get("spot-b")).toEqual(
      firstRegions.get("spot-b"),
    );
    expect(regionByKey(second.tiles).get("spot-d")).toEqual(
      firstRegions.get("spot-d"),
    );

    const third = allocateLocalLightAtlasSlots({
      state,
      requests: [
        request("spot-d", 103, 64),
        request("spot-c", 102, 128),
        request("spot-b", 101, 128),
        request("spot-a", 100, 256),
      ],
    });

    expect(third).toMatchObject({
      ready: true,
      assignedSlotCount: 4,
      reusedSlotCount: 4,
      staleSlotCount: 0,
      evictedSlotCount: 0,
    });
    expect(regionByKey(third.tiles).get("spot-c")).toEqual(
      firstRegions.get("spot-c"),
    );
  });

  it("evicts only resized slots and reuses unchanged light slots", () => {
    const state = createLocalLightAtlasSlotAllocatorState({
      atlasWidth: 512,
      atlasHeight: 256,
    });
    const first = allocateLocalLightAtlasSlots({
      state,
      requests: [
        request("spot-a", 100, 256),
        request("spot-b", 101, 128),
        request("spot-c", 102, 128),
        request("spot-d", 103, 64),
      ],
    });
    const firstRegions = regionByKey(first.tiles);
    const resized = allocateLocalLightAtlasSlots({
      state,
      requests: [
        request("spot-a", 100, 128),
        request("spot-b", 101, 128),
        request("spot-c", 102, 128),
        request("spot-d", 103, 64),
      ],
    });
    const resizedRegions = regionByKey(resized.tiles);

    expect(resized).toMatchObject({
      ready: true,
      assignedSlotCount: 4,
      reusedSlotCount: 3,
      reassignedSlotCount: 1,
      evictedSlotCount: 1,
    });
    expect(resizedRegions.get("spot-a")).not.toEqual(
      firstRegions.get("spot-a"),
    );
    expect(resizedRegions.get("spot-b")).toEqual(firstRegions.get("spot-b"));
    expect(resizedRegions.get("spot-c")).toEqual(firstRegions.get("spot-c"));
    expect(resizedRegions.get("spot-d")).toEqual(firstRegions.get("spot-d"));
  });

  it("reports an unavailable slot when requests exceed the atlas", () => {
    const state = createLocalLightAtlasSlotAllocatorState({
      atlasWidth: 128,
      atlasHeight: 128,
    });
    const result = allocateLocalLightAtlasSlots({
      state,
      requests: [request("spot-a", 100, 128), request("spot-b", 101, 128)],
    });

    expect(result.ready).toBe(false);
    expect(result.assignedSlotCount).toBe(1);
    expect(result.diagnostics).toMatchObject([
      {
        code: "localLightAtlasSlot.slotUnavailable",
        allocationKey: "spot-b",
      },
    ]);
  });
});

function request(
  allocationKey: string,
  lightId: number,
  size: number,
): LocalLightAtlasSlotRequest {
  return {
    allocationKey,
    lightId,
    shadowId: lightId,
    width: size,
    height: size,
  };
}

function regionByKey(
  tiles: readonly {
    readonly allocationKey: string;
    readonly originX: number;
    readonly originY: number;
    readonly width: number;
    readonly height: number;
  }[],
): Map<string, unknown> {
  return new Map(
    tiles.map((tile) => [
      tile.allocationKey,
      {
        originX: tile.originX,
        originY: tile.originY,
        width: tile.width,
        height: tile.height,
      },
    ]),
  );
}
