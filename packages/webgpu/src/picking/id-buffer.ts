import {
  createStableRenderId,
  type MeshDrawPacket,
  type RenderEntityRef,
} from "@aperture-engine/render";

export const WEBGPU_ID_BUFFER_FORMAT = "r32uint";
export const WEBGPU_ID_BUFFER_EMPTY_ID = 0xffff_ffff;

export interface WebGpuIdBufferEntry {
  readonly renderId: number;
  readonly entity: RenderEntityRef;
  readonly id: number;
}

export function createWebGpuIdBufferIdForEntity(
  entity: RenderEntityRef,
): number {
  return createStableRenderId(entity) >>> 0;
}

export function createWebGpuIdBufferEntry(
  draw: Pick<MeshDrawPacket, "renderId" | "entity">,
): WebGpuIdBufferEntry {
  return {
    renderId: draw.renderId,
    entity: draw.entity,
    id: createWebGpuIdBufferIdForEntity(draw.entity),
  };
}

export function createWebGpuIdBufferEntries(
  draws: readonly Pick<MeshDrawPacket, "renderId" | "entity">[],
): readonly WebGpuIdBufferEntry[] {
  return draws.map((draw) => createWebGpuIdBufferEntry(draw));
}

export function findWebGpuIdBufferEntry(
  entries: readonly WebGpuIdBufferEntry[],
  id: number,
): WebGpuIdBufferEntry | null {
  for (const entry of entries) {
    if (entry.id === id) {
      return entry;
    }
  }

  return null;
}
