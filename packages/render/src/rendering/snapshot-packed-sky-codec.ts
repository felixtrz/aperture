import type { ProceduralSkyPacket } from "./snapshot.js";
import {
  proceduralSkyModelId,
  proceduralSkyModelValue,
  readEntity,
  readFloat64,
  readSigned32,
  readVec3,
  writeEntity,
  writeFloat64,
  writeSigned32,
  writeVec3,
} from "./snapshot-packed-codec-utils.js";

export function writeProceduralSkyPacket(
  words: Uint32Array,
  offset: number,
  packet: ProceduralSkyPacket,
): void {
  words[offset] = packet.skyId >>> 0;
  writeEntity(words, offset + 1, packet.entity);
  words[offset + 3] = proceduralSkyModelId(packet.model);
  writeSigned32(words, offset + 4, packet.priority);
  writeVec3(words, offset + 5, packet.topColor);
  writeVec3(words, offset + 11, packet.horizonColor);
  writeVec3(words, offset + 17, packet.bottomColor);
  writeFloat64(words, offset + 23, packet.horizonPosition);
  writeFloat64(words, offset + 25, packet.horizonSoftness);
  writeFloat64(words, offset + 27, packet.intensity);
  writeVec3(words, offset + 29, packet.sunDirection);
  writeVec3(words, offset + 35, packet.sunColor);
  writeFloat64(words, offset + 41, packet.sunRadius);
  writeFloat64(words, offset + 43, packet.sunGlow);
  writeFloat64(words, offset + 45, packet.ditherStrength);
  words[offset + 47] = packet.layerMask >>> 0;
}

export function readProceduralSkyPacket(
  words: Uint32Array,
  offset: number,
): ProceduralSkyPacket {
  return {
    skyId: words[offset] ?? 0,
    entity: readEntity(words, offset + 1),
    model: proceduralSkyModelValue(words[offset + 3] ?? 0),
    priority: readSigned32(words, offset + 4),
    topColor: readVec3(words, offset + 5),
    horizonColor: readVec3(words, offset + 11),
    bottomColor: readVec3(words, offset + 17),
    horizonPosition: readFloat64(words, offset + 23),
    horizonSoftness: readFloat64(words, offset + 25),
    intensity: readFloat64(words, offset + 27),
    sunDirection: readVec3(words, offset + 29),
    sunColor: readVec3(words, offset + 35),
    sunRadius: readFloat64(words, offset + 41),
    sunGlow: readFloat64(words, offset + 43),
    ditherStrength: readFloat64(words, offset + 45),
    layerMask: words[offset + 47] ?? 0,
  };
}
