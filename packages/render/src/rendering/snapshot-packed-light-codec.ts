import type {
  EnvironmentPacket,
  LightPacket,
  ShadowRequestPacket,
} from "./snapshot.js";
import {
  DEFAULT_PACKED_AREA_LIGHT_SHAPE_ID,
  areaLightShapeId,
  areaLightShapeValue,
  lightKindId,
  lightKindValue,
  readEntity,
  readFloat64,
  readNullableHandle,
  readVec4,
  writeEntity,
  writeFloat64,
  writeVec4,
} from "./snapshot-packed-codec-utils.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";

export function writeLightPacket(
  words: Uint32Array,
  offset: number,
  packet: LightPacket,
  registry: SnapshotPacketEncodingRegistry,
): void {
  words[offset] = packet.lightId >>> 0;
  writeEntity(words, offset + 1, packet.entity);
  words[offset + 3] = lightKindId(packet.kind);
  writeVec4(words, offset + 4, packet.color);
  writeFloat64(words, offset + 12, packet.intensity);
  writeFloat64(words, offset + 14, packet.range);
  writeFloat64(words, offset + 16, packet.innerConeAngle);
  writeFloat64(words, offset + 18, packet.outerConeAngle);
  writeFloat64(words, offset + 20, packet.width ?? 0);
  writeFloat64(words, offset + 22, packet.height ?? 0);
  words[offset + 24] = areaLightShapeId(packet.shape);
  words[offset + 25] = packet.worldTransformOffset >>> 0;
  words[offset + 26] = packet.layerMask >>> 0;
  words[offset + 27] = registry.handleId(packet.cookieTexture ?? null) >>> 0;
  words[offset + 28] = registry.handleId(packet.cookieSampler ?? null) >>> 0;
  writeFloat64(words, offset + 29, packet.cookieIntensity ?? 1);
}

export function readLightPacket(
  words: Uint32Array,
  offset: number,
  registry: SnapshotPacketEncodingRegistry,
): LightPacket {
  const cookieTexture = readNullableHandle(registry, words[offset + 27] ?? 0, [
    "texture",
  ]);
  const cookieSampler = readNullableHandle(registry, words[offset + 28] ?? 0, [
    "sampler",
  ]);
  const packet: LightPacket = {
    lightId: words[offset] ?? 0,
    entity: readEntity(words, offset + 1),
    kind: lightKindValue(words[offset + 3] ?? 0),
    shape: areaLightShapeValue(
      words[offset + 24] ?? DEFAULT_PACKED_AREA_LIGHT_SHAPE_ID,
    ),
    color: readVec4(words, offset + 4),
    intensity: readFloat64(words, offset + 12),
    range: readFloat64(words, offset + 14),
    innerConeAngle: readFloat64(words, offset + 16),
    outerConeAngle: readFloat64(words, offset + 18),
    width: readFloat64(words, offset + 20),
    height: readFloat64(words, offset + 22),
    worldTransformOffset: words[offset + 25] ?? 0,
    layerMask: words[offset + 26] ?? 0,
  };

  return cookieTexture === null
    ? packet
    : {
        ...packet,
        cookieTexture,
        cookieSampler,
        cookieIntensity: readFloat64(words, offset + 29),
      };
}

export function writeEnvironmentPacket(
  words: Uint32Array,
  offset: number,
  packet: EnvironmentPacket,
  registry: SnapshotPacketEncodingRegistry,
): void {
  words[offset] = packet.environmentId >>> 0;
  words[offset + 1] = registry.handleId(packet.handle) >>> 0;
  writeVec4(words, offset + 2, packet.color);
  writeFloat64(words, offset + 10, packet.intensity);
  words[offset + 12] = packet.layerMask >>> 0;
}

export function readEnvironmentPacket(
  words: Uint32Array,
  offset: number,
  registry: SnapshotPacketEncodingRegistry,
): EnvironmentPacket {
  return {
    environmentId: words[offset] ?? 0,
    handle: readNullableHandle(registry, words[offset + 1] ?? 0, [
      "environment-map",
    ]),
    color: readVec4(words, offset + 2),
    intensity: readFloat64(words, offset + 10),
    layerMask: words[offset + 12] ?? 0,
  };
}

export function writeShadowRequestPacket(
  words: Uint32Array,
  offset: number,
  packet: ShadowRequestPacket,
): void {
  words[offset] = packet.shadowId >>> 0;
  words[offset + 1] = packet.lightId >>> 0;
  words[offset + 2] =
    packet.lightKind === undefined ? 0 : lightKindId(packet.lightKind);
  words[offset + 3] = packet.casterLayerMask >>> 0;
  words[offset + 4] = packet.receiverLayerMask >>> 0;
  words[offset + 5] = Math.max(1, Math.floor(packet.cascadeCount ?? 1)) >>> 0;
}

export function readShadowRequestPacket(
  words: Uint32Array,
  offset: number,
): ShadowRequestPacket {
  const lightKind = words[offset + 2] ?? 0;
  const packet: ShadowRequestPacket = {
    shadowId: words[offset] ?? 0,
    lightId: words[offset + 1] ?? 0,
    casterLayerMask: words[offset + 3] ?? 0,
    receiverLayerMask: words[offset + 4] ?? 0,
  };
  const cascadeCount = words[offset + 5] ?? 1;

  return {
    ...packet,
    ...(lightKind === 0 ? {} : { lightKind: lightKindValue(lightKind) }),
    ...(cascadeCount > 1 ? { cascadeCount } : {}),
  };
}
