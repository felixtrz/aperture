import { describe, expect, it } from "vitest";

import {
  createStableRenderId,
  createWebGpuIdBufferEntries,
  createWebGpuIdBufferEntry,
  createWebGpuIdBufferIdForEntity,
  findWebGpuIdBufferEntry,
  WEBGPU_ID_BUFFER_EMPTY_ID,
  WEBGPU_ID_BUFFER_FORMAT,
  type MeshDrawPacket,
} from "@aperture-engine/webgpu";

describe("WebGPU ID buffer helpers", () => {
  it("derives stable pick IDs from ECS entity refs", () => {
    const entity = { index: 42, generation: 3 };

    expect(createWebGpuIdBufferIdForEntity(entity)).toBe(
      createStableRenderId(entity),
    );
  });

  it("creates draw lookup entries for ID-buffer readback", () => {
    const first = draw(7, { index: 11, generation: 1 });
    const second = draw(9, { index: 12, generation: 1 });
    const third = draw(13, { index: 13, generation: 1 });
    const draws = [first, second, third];
    const entries = createWebGpuIdBufferEntries(draws);

    expect(WEBGPU_ID_BUFFER_FORMAT).toBe("r32uint");
    expect(WEBGPU_ID_BUFFER_EMPTY_ID).toBe(0xffff_ffff);
    expect(entries).toEqual([
      createWebGpuIdBufferEntry(first),
      createWebGpuIdBufferEntry(second),
      createWebGpuIdBufferEntry(third),
    ]);
    expect(findWebGpuIdBufferEntry(entries, entries[1]?.id ?? 0)).toEqual(
      entries[1],
    );
    expect(
      findWebGpuIdBufferEntry(entries, WEBGPU_ID_BUFFER_EMPTY_ID),
    ).toBeNull();
  });
});

function draw(
  renderId: number,
  entity: { readonly index: number; readonly generation: number },
): Pick<MeshDrawPacket, "renderId" | "entity"> {
  return { renderId, entity };
}
