import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
import {
  readBoundsPacket,
  readEnvironmentPacket,
  readLightPacket,
  readMeshDrawPacket,
  readQuadBatchPacket,
  readShadowRequestPacket,
  readViewPacket,
} from "./snapshot-packed-codecs.js";
import {
  BOUNDS_PACKET_WORDS,
  ENVIRONMENT_PACKET_WORDS,
  LIGHT_PACKET_WORDS,
  MESH_DRAW_PACKET_WORDS,
  QUAD_BATCH_PACKET_WORDS,
  SHADOW_REQUEST_PACKET_WORDS,
  SNAPSHOT_PACKET_HEADER_WORDS,
  VIEW_PACKET_WORDS,
} from "./snapshot-packed-encoding-constants.js";
import { readSnapshotPacketHeaderCounts } from "./snapshot-packed-encoding-header.js";
import type { SnapshotPacketBundle } from "./snapshot-packed-encoding-types.js";
import type {
  BoundsPacket,
  EnvironmentPacket,
  LightPacket,
  MeshDrawPacket,
  QuadBatchPacket,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";

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
    counts.bounds * BOUNDS_PACKET_WORDS +
    counts.quadBatches * QUAD_BATCH_PACKET_WORDS;

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
  const quadBatches: QuadBatchPacket[] = [];
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

  for (let index = 0; index < counts.quadBatches; index += 1) {
    quadBatches.push(readQuadBatchPacket(words, offset, registry));
    offset += QUAD_BATCH_PACKET_WORDS;
  }

  return {
    views,
    meshDraws,
    lights,
    environments,
    shadowRequests,
    bounds,
    ...(quadBatches.length === 0 ? {} : { quadBatches }),
  };
}
