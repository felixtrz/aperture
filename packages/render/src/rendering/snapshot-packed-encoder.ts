import { createSnapshotPacketRegistry } from "./snapshot-packed-registry.js";
import {
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
import { writeSnapshotPacketHeader } from "./snapshot-packed-encoding-header.js";
import type {
  EncodedSnapshotPackets,
  EncodeSnapshotPacketsOptions,
  SnapshotPacketBundle,
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
