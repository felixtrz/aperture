import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
import {
  readAudioEmitterPacket,
  readAudioListenerPacket,
  readBoundsPacket,
  readEnvironmentPacket,
  readFogPacket,
  readLightPacket,
  readMeshDrawPacket,
  readParticleEmitterPacket,
  readQuadBatchPacket,
  readShadowRequestPacket,
  readViewPacket,
} from "./snapshot-packed-codecs.js";
import {
  AUDIO_EMITTER_PACKET_WORDS,
  AUDIO_LISTENER_PACKET_WORDS,
  BOUNDS_PACKET_WORDS,
  ENVIRONMENT_PACKET_WORDS,
  FOG_PACKET_WORDS,
  LIGHT_PACKET_WORDS,
  MESH_DRAW_PACKET_WORDS,
  PARTICLE_EMITTER_PACKET_WORDS,
  QUAD_BATCH_PACKET_WORDS,
  SHADOW_REQUEST_PACKET_WORDS,
  SNAPSHOT_PACKET_HEADER_WORDS,
  VIEW_PACKET_WORDS,
} from "./snapshot-packed-encoding-constants.js";
import { readSnapshotPacketHeaderCounts } from "./snapshot-packed-encoding-header.js";
import type { SnapshotPacketBundle } from "./snapshot-packed-encoding-types.js";
import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  BoundsPacket,
  EnvironmentPacket,
  FogPacket,
  LightPacket,
  MeshDrawPacket,
  ParticleEmitterPacket,
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
    counts.shadowCasterDraws * MESH_DRAW_PACKET_WORDS +
    counts.lights * LIGHT_PACKET_WORDS +
    counts.environments * ENVIRONMENT_PACKET_WORDS +
    counts.fogs * FOG_PACKET_WORDS +
    counts.particleEmitters * PARTICLE_EMITTER_PACKET_WORDS +
    counts.audioEmitters * AUDIO_EMITTER_PACKET_WORDS +
    counts.audioListeners * AUDIO_LISTENER_PACKET_WORDS +
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
  const shadowCasterDraws: MeshDrawPacket[] = [];
  const lights: LightPacket[] = [];
  const environments: EnvironmentPacket[] = [];
  const fogs: FogPacket[] = [];
  const particleEmitters: ParticleEmitterPacket[] = [];
  const audioEmitters: AudioEmitterPacket[] = [];
  const audioListeners: AudioListenerPacket[] = [];
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

  for (let index = 0; index < counts.shadowCasterDraws; index += 1) {
    shadowCasterDraws.push(readMeshDrawPacket(words, offset, registry));
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

  for (let index = 0; index < counts.fogs; index += 1) {
    fogs.push(readFogPacket(words, offset));
    offset += FOG_PACKET_WORDS;
  }

  for (let index = 0; index < counts.particleEmitters; index += 1) {
    particleEmitters.push(readParticleEmitterPacket(words, offset, registry));
    offset += PARTICLE_EMITTER_PACKET_WORDS;
  }

  for (let index = 0; index < counts.audioEmitters; index += 1) {
    audioEmitters.push(readAudioEmitterPacket(words, offset, registry));
    offset += AUDIO_EMITTER_PACKET_WORDS;
  }

  for (let index = 0; index < counts.audioListeners; index += 1) {
    audioListeners.push(readAudioListenerPacket(words, offset));
    offset += AUDIO_LISTENER_PACKET_WORDS;
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
    ...(shadowCasterDraws.length === 0 ? {} : { shadowCasterDraws }),
    lights,
    environments,
    ...(fogs.length === 0 ? {} : { fogs }),
    ...(particleEmitters.length === 0 ? {} : { particleEmitters }),
    ...(audioEmitters.length === 0 ? {} : { audioEmitters }),
    ...(audioListeners.length === 0
      ? {}
      : { audioListener: audioListeners[0] }),
    shadowRequests,
    bounds,
    ...(quadBatches.length === 0 ? {} : { quadBatches }),
  };
}
