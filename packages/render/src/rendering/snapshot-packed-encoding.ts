import {
  createSnapshotPacketRegistry,
  type SnapshotPacketEncodingRegistry,
} from "./snapshot-packed-registry.js";
import {
  readBoundsPacket,
  readEnvironmentPacket,
  readLightPacket,
  readMeshDrawPacket,
  readShadowRequestPacket,
  readViewPacket,
  writeBoundsPacket,
  writeEnvironmentPacket,
  writeLightPacket,
  writeMeshDrawPacket,
  writeShadowRequestPacket,
  writeViewPacket,
} from "./snapshot-packed-codecs.js";
import {
  BOUNDS_PACKET_WORDS,
  ENVIRONMENT_PACKET_WORDS,
  LIGHT_PACKET_WORDS,
  MESH_DRAW_PACKET_WORDS,
  SHADOW_REQUEST_PACKET_WORDS,
  SNAPSHOT_PACKET_HEADER_WORDS,
  VIEW_PACKET_WORDS,
} from "./snapshot-packed-encoding-constants.js";
import {
  readSnapshotPacketHeaderCounts,
  writeSnapshotPacketHeader,
} from "./snapshot-packed-encoding-header.js";
import type {
  EncodedSnapshotPackets,
  EncodeSnapshotPacketsOptions,
  SnapshotPacketBundle,
} from "./snapshot-packed-encoding-types.js";
import type {
  BoundsPacket,
  EnvironmentPacket,
  LightPacket,
  MeshDrawPacket,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";

export { createSnapshotPacketRegistry } from "./snapshot-packed-registry.js";
export type {
  CreateSnapshotPacketRegistryOptions,
  SnapshotPacketEncodingRegistry,
  SnapshotPacketRegistrySnapshot,
} from "./snapshot-packed-registry.js";
export {
  BOUNDS_PACKET_WORDS,
  ENVIRONMENT_PACKET_WORDS,
  LIGHT_PACKET_WORDS,
  MESH_DRAW_PACKET_WORDS,
  SHADOW_REQUEST_PACKET_WORDS,
  SNAPSHOT_PACKET_BYTE_STRIDES,
  SNAPSHOT_PACKET_DIAGNOSTIC_TRANSPORT_NOTE,
  SNAPSHOT_PACKET_ENCODING_MAGIC,
  SNAPSHOT_PACKET_ENCODING_VERSION,
  SNAPSHOT_PACKET_HEADER_WORDS,
  SNAPSHOT_PACKET_WORD_STRIDES,
  VIEW_PACKET_WORDS,
} from "./snapshot-packed-encoding-constants.js";
export type {
  EncodedSnapshotPackets,
  EncodeSnapshotPacketsOptions,
  SnapshotPacketBundle,
  SnapshotPacketEncodingInput,
} from "./snapshot-packed-encoding-types.js";

export function snapshotPacketWordLength(
  packets: SnapshotPacketBundle,
): number {
  return (
    SNAPSHOT_PACKET_HEADER_WORDS +
    packets.views.length * VIEW_PACKET_WORDS +
    packets.meshDraws.length * MESH_DRAW_PACKET_WORDS +
    packets.lights.length * LIGHT_PACKET_WORDS +
    packets.environments.length * ENVIRONMENT_PACKET_WORDS +
    packets.shadowRequests.length * SHADOW_REQUEST_PACKET_WORDS +
    packets.bounds.length * BOUNDS_PACKET_WORDS
  );
}

export function encodeSnapshotPackets(
  packets: SnapshotPacketBundle,
  options: EncodeSnapshotPacketsOptions = {},
): EncodedSnapshotPackets {
  const registry = options.registry ?? createSnapshotPacketRegistry();
  const wordLength = snapshotPacketWordLength(packets);
  const buffer = options.buffer ?? new Uint32Array(wordLength);

  if (buffer.length < wordLength) {
    throw new RangeError(
      `Snapshot packet buffer is too small: requires ${wordLength} words, received ${buffer.length}.`,
    );
  }

  const words = buffer.subarray(0, wordLength);
  let offset = SNAPSHOT_PACKET_HEADER_WORDS;

  writeSnapshotPacketHeader(words, {
    views: packets.views.length,
    meshDraws: packets.meshDraws.length,
    lights: packets.lights.length,
    environments: packets.environments.length,
    shadowRequests: packets.shadowRequests.length,
    bounds: packets.bounds.length,
  });

  for (const packet of packets.views) {
    writeViewPacket(words, offset, packet, registry);
    offset += VIEW_PACKET_WORDS;
  }

  for (const packet of packets.meshDraws) {
    writeMeshDrawPacket(words, offset, packet, registry);
    offset += MESH_DRAW_PACKET_WORDS;
  }

  for (const packet of packets.lights) {
    writeLightPacket(words, offset, packet, registry);
    offset += LIGHT_PACKET_WORDS;
  }

  for (const packet of packets.environments) {
    writeEnvironmentPacket(words, offset, packet, registry);
    offset += ENVIRONMENT_PACKET_WORDS;
  }

  for (const packet of packets.shadowRequests) {
    writeShadowRequestPacket(words, offset, packet);
    offset += SHADOW_REQUEST_PACKET_WORDS;
  }

  for (const packet of packets.bounds) {
    writeBoundsPacket(words, offset, packet);
    offset += BOUNDS_PACKET_WORDS;
  }

  return {
    words,
    registry,
    counts: {
      views: packets.views.length,
      meshDraws: packets.meshDraws.length,
      lights: packets.lights.length,
      environments: packets.environments.length,
      shadowRequests: packets.shadowRequests.length,
      bounds: packets.bounds.length,
    },
    wordLength,
    byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT,
  };
}

export function decodeSnapshotPackets(
  words: Uint32Array,
  registry: SnapshotPacketEncodingRegistry,
): SnapshotPacketBundle {
  const counts = readSnapshotPacketHeaderCounts(words);
  const expectedWords =
    SNAPSHOT_PACKET_HEADER_WORDS +
    counts.views * VIEW_PACKET_WORDS +
    counts.meshDraws * MESH_DRAW_PACKET_WORDS +
    counts.lights * LIGHT_PACKET_WORDS +
    counts.environments * ENVIRONMENT_PACKET_WORDS +
    counts.shadowRequests * SHADOW_REQUEST_PACKET_WORDS +
    counts.bounds * BOUNDS_PACKET_WORDS;

  if (words.length < expectedWords) {
    throw new RangeError(
      `Snapshot packet buffer is truncated: requires ${expectedWords} words, received ${words.length}.`,
    );
  }

  const views: ViewPacket[] = [];
  const meshDraws: MeshDrawPacket[] = [];
  const lights: LightPacket[] = [];
  const environments: EnvironmentPacket[] = [];
  const shadowRequests: ShadowRequestPacket[] = [];
  const bounds: BoundsPacket[] = [];
  let offset = SNAPSHOT_PACKET_HEADER_WORDS;

  for (let index = 0; index < counts.views; index += 1) {
    views.push(readViewPacket(words, offset, registry));
    offset += VIEW_PACKET_WORDS;
  }

  for (let index = 0; index < counts.meshDraws; index += 1) {
    meshDraws.push(readMeshDrawPacket(words, offset, registry));
    offset += MESH_DRAW_PACKET_WORDS;
  }

  for (let index = 0; index < counts.lights; index += 1) {
    lights.push(readLightPacket(words, offset, registry));
    offset += LIGHT_PACKET_WORDS;
  }

  for (let index = 0; index < counts.environments; index += 1) {
    environments.push(readEnvironmentPacket(words, offset, registry));
    offset += ENVIRONMENT_PACKET_WORDS;
  }

  for (let index = 0; index < counts.shadowRequests; index += 1) {
    shadowRequests.push(readShadowRequestPacket(words, offset));
    offset += SHADOW_REQUEST_PACKET_WORDS;
  }

  for (let index = 0; index < counts.bounds; index += 1) {
    bounds.push(readBoundsPacket(words, offset));
    offset += BOUNDS_PACKET_WORDS;
  }

  return { views, meshDraws, lights, environments, shadowRequests, bounds };
}

export function encodePackets(
  packets: SnapshotPacketBundle,
  buffer?: Uint32Array,
  registry?: SnapshotPacketEncodingRegistry,
): EncodedSnapshotPackets {
  if (buffer !== undefined && registry !== undefined) {
    return encodeSnapshotPackets(packets, { buffer, registry });
  }

  if (buffer !== undefined) {
    return encodeSnapshotPackets(packets, { buffer });
  }

  if (registry !== undefined) {
    return encodeSnapshotPackets(packets, { registry });
  }

  return encodeSnapshotPackets(packets);
}

export function decodePackets(
  words: Uint32Array,
  registry: SnapshotPacketEncodingRegistry,
): SnapshotPacketBundle {
  return decodeSnapshotPackets(words, registry);
}
