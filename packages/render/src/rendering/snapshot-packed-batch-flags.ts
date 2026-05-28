import type { MeshDrawPacket } from "./snapshot.js";

export function batchFlags(packet: MeshDrawPacket): number {
  return (
    (packet.batchKey.instanced ? 1 : 0) |
    (packet.batchKey.skinned ? 2 : 0) |
    (packet.batchKey.morphed ? 4 : 0) |
    (packet.occlusionQuery === true ? 8 : 0)
  );
}
