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
  readFloat32,
  readFloat64,
  readNullableHandle,
  readVec4,
  writeEntity,
  writeFloat32,
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
  words[offset + 6] = (packet.shadowType ?? 1) >>> 0;
  writeFloat32(words, offset + 7, packet.strength ?? 1);
  writeFloat32(words, offset + 8, packet.filterRadius ?? 1);
  writeFloat32(words, offset + 9, packet.slopeBias ?? 0);
  writeFloat32(words, offset + 10, packet.depthBias ?? 0);
  writeFloat32(words, offset + 11, packet.normalBias ?? 0);
  words[offset + 12] = Math.max(0, Math.floor(packet.mapSize ?? 0)) >>> 0;
  writeFloat32(words, offset + 13, packet.center?.[0] ?? 0);
  writeFloat32(words, offset + 14, packet.center?.[1] ?? 0);
  writeFloat32(words, offset + 15, packet.center?.[2] ?? 0);
  writeFloat32(words, offset + 16, packet.orthographicSize ?? 0);
  writeFloat32(words, offset + 17, packet.near ?? 0);
  writeFloat32(words, offset + 18, packet.far ?? 0);
  writeFloat32(words, offset + 19, packet.lightDistance ?? 0);
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
  // Mirror the cascadeCount convention: only surface authored shadow params
  // when they differ from the defaults so default-authored packets round-trip
  // to a minimal shape (consumers read with their own `?? default`).
  const shadowType = words[offset + 6] ?? 1;
  const strength = readFloat32(words, offset + 7);
  const filterRadius = readFloat32(words, offset + 8);
  const slopeBias = readFloat32(words, offset + 9);
  const depthBias = readFloat32(words, offset + 10);
  const normalBias = readFloat32(words, offset + 11);
  const mapSize = words[offset + 12] ?? 0;
  const center = [
    readFloat32(words, offset + 13),
    readFloat32(words, offset + 14),
    readFloat32(words, offset + 15),
  ] as const;
  const orthographicSize = readFloat32(words, offset + 16);
  const near = readFloat32(words, offset + 17);
  const far = readFloat32(words, offset + 18);
  const lightDistance = readFloat32(words, offset + 19);

  return {
    ...packet,
    ...(lightKind === 0 ? {} : { lightKind: lightKindValue(lightKind) }),
    ...(cascadeCount > 1 ? { cascadeCount } : {}),
    ...(shadowType === 1 ? {} : { shadowType }),
    ...(strength === 1 ? {} : { strength }),
    ...(filterRadius === 1 ? {} : { filterRadius }),
    ...(slopeBias === 0 ? {} : { slopeBias }),
    ...(depthBias === 0 ? {} : { depthBias }),
    ...(normalBias === 0 ? {} : { normalBias }),
    ...(mapSize === 0 ? {} : { mapSize }),
    ...(orthographicSize <= 0
      ? {}
      : {
          center,
          orthographicSize,
          ...(near === 0 ? {} : { near }),
          ...(far === 0 ? {} : { far }),
          ...(lightDistance === 0 ? {} : { lightDistance }),
        }),
  };
}
