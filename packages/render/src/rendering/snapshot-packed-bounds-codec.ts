import type { BoundsPacket } from "./snapshot.js";
import {
  readEntity,
  readFloat64,
  readVec3,
  writeEntity,
  writeFloat64,
  writeVec3,
} from "./snapshot-packed-codec-utils.js";

export function writeBoundsPacket(
  words: Uint32Array,
  offset: number,
  packet: BoundsPacket,
): void {
  words[offset] = packet.boundsId >>> 0;
  writeEntity(words, offset + 1, packet.entity);
  writeVec3(words, offset + 3, packet.localAabb.min);
  writeVec3(words, offset + 9, packet.localAabb.max);
  writeVec3(words, offset + 15, packet.worldAabb.min);
  writeVec3(words, offset + 21, packet.worldAabb.max);
  writeVec3(words, offset + 27, packet.localSphere.center);
  writeFloat64(words, offset + 33, packet.localSphere.radius);
  writeVec3(words, offset + 35, packet.worldSphere.center);
  writeFloat64(words, offset + 41, packet.worldSphere.radius);
}

export function readBoundsPacket(
  words: Uint32Array,
  offset: number,
): BoundsPacket {
  return {
    boundsId: words[offset] ?? 0,
    entity: readEntity(words, offset + 1),
    localAabb: {
      min: readVec3(words, offset + 3),
      max: readVec3(words, offset + 9),
    },
    worldAabb: {
      min: readVec3(words, offset + 15),
      max: readVec3(words, offset + 21),
    },
    localSphere: {
      center: readVec3(words, offset + 27),
      radius: readFloat64(words, offset + 33),
    },
    worldSphere: {
      center: readVec3(words, offset + 35),
      radius: readFloat64(words, offset + 41),
    },
  };
}
