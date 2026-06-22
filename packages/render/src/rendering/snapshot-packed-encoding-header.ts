import {
  SNAPSHOT_PACKET_ENCODING_MAGIC,
  SNAPSHOT_PACKET_ENCODING_VERSION,
  SNAPSHOT_PACKET_HEADER_WORDS,
  SNAPSHOT_PACKET_HEADER_WORD_INDEX,
} from "./snapshot-packed-encoding-constants.js";

export interface SnapshotPacketHeaderCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly shadowCasterDraws: number;
  readonly lights: number;
  readonly environments: number;
  readonly particleEmitters: number;
  readonly audioEmitters: number;
  readonly audioListeners: number;
  readonly shadowRequests: number;
  readonly bounds: number;
  readonly quadBatches: number;
  readonly fogs: number;
}

export function writeSnapshotPacketHeader(
  words: Uint32Array,
  counts: SnapshotPacketHeaderCounts,
): void {
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Magic] =
    SNAPSHOT_PACKET_ENCODING_MAGIC;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Version] =
    SNAPSHOT_PACKET_ENCODING_VERSION;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Views] = counts.views;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.MeshDraws] = counts.meshDraws;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.ShadowCasterDraws] =
    counts.shadowCasterDraws;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Lights] = counts.lights;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Environments] = counts.environments;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.ShadowRequests] =
    counts.shadowRequests;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Bounds] = counts.bounds;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.QuadBatches] = counts.quadBatches;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Fogs] = counts.fogs;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.ParticleEmitters] =
    counts.particleEmitters;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.AudioEmitters] = counts.audioEmitters;
  words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.AudioListeners] =
    counts.audioListeners;
}

export function readSnapshotPacketHeaderCounts(
  words: Uint32Array,
): SnapshotPacketHeaderCounts {
  assertSnapshotPacketHeader(words);

  return {
    views: words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Views] ?? 0,
    meshDraws: words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.MeshDraws] ?? 0,
    shadowCasterDraws:
      words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.ShadowCasterDraws] ?? 0,
    lights: words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Lights] ?? 0,
    environments: words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Environments] ?? 0,
    particleEmitters:
      words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.ParticleEmitters] ?? 0,
    audioEmitters: words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.AudioEmitters] ?? 0,
    audioListeners:
      words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.AudioListeners] ?? 0,
    shadowRequests:
      words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.ShadowRequests] ?? 0,
    bounds: words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Bounds] ?? 0,
    quadBatches: words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.QuadBatches] ?? 0,
    fogs: words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Fogs] ?? 0,
  };
}

function assertSnapshotPacketHeader(words: Uint32Array): void {
  if (words.length < SNAPSHOT_PACKET_HEADER_WORDS) {
    throw new RangeError("Snapshot packet buffer is missing its header.");
  }

  if (
    words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Magic] !==
    SNAPSHOT_PACKET_ENCODING_MAGIC
  ) {
    throw new RangeError("Snapshot packet buffer has an unsupported magic.");
  }

  if (
    words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Version] !==
    SNAPSHOT_PACKET_ENCODING_VERSION
  ) {
    throw new RangeError(
      `Snapshot packet buffer version ${words[SNAPSHOT_PACKET_HEADER_WORD_INDEX.Version]} is unsupported.`,
    );
  }
}
