import type { MeshDrawPacket } from "./snapshot.js";

export const PACKED_BATCH_FLAG_INSTANCED = 1;
export const PACKED_BATCH_FLAG_SKINNED = 2;
export const PACKED_BATCH_FLAG_MORPHED = 4;
export const PACKED_BATCH_FLAG_OCCLUSION_QUERY = 8;
export const PACKED_BATCH_FLAG_POST_TONEMAP_STAGE = 16;

export function batchFlags(packet: MeshDrawPacket): number {
  return (
    (packet.batchKey.instanced ? PACKED_BATCH_FLAG_INSTANCED : 0) |
    (packet.batchKey.skinned ? PACKED_BATCH_FLAG_SKINNED : 0) |
    (packet.batchKey.morphed ? PACKED_BATCH_FLAG_MORPHED : 0) |
    (packet.occlusionQuery === true ? PACKED_BATCH_FLAG_OCCLUSION_QUERY : 0) |
    (packet.renderStage === "post-tonemap"
      ? PACKED_BATCH_FLAG_POST_TONEMAP_STAGE
      : 0)
  );
}
