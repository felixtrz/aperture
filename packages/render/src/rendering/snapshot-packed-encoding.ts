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
import type {
  BoundsPacket,
  EnvironmentPacket,
  LightPacket,
  MeshDrawPacket,
  RenderSnapshot,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";

export { createSnapshotPacketRegistry } from "./snapshot-packed-registry.js";
export type {
  CreateSnapshotPacketRegistryOptions,
  SnapshotPacketEncodingRegistry,
  SnapshotPacketRegistrySnapshot,
} from "./snapshot-packed-registry.js";

export const SNAPSHOT_PACKET_ENCODING_MAGIC = 0x4150_5350; // "APSP"
export const SNAPSHOT_PACKET_ENCODING_VERSION = 5;

export const SNAPSHOT_PACKET_HEADER_WORDS = 8;
export const VIEW_PACKET_WORDS = 36;
export const MESH_DRAW_PACKET_WORDS = 34;
export const LIGHT_PACKET_WORDS = 31;
export const ENVIRONMENT_PACKET_WORDS = 13;
export const SHADOW_REQUEST_PACKET_WORDS = 6;
export const BOUNDS_PACKET_WORDS = 43;

export const SNAPSHOT_PACKET_WORD_STRIDES = Object.freeze({
  header: SNAPSHOT_PACKET_HEADER_WORDS,
  view: VIEW_PACKET_WORDS,
  meshDraw: MESH_DRAW_PACKET_WORDS,
  light: LIGHT_PACKET_WORDS,
  environment: ENVIRONMENT_PACKET_WORDS,
  shadowRequest: SHADOW_REQUEST_PACKET_WORDS,
  bounds: BOUNDS_PACKET_WORDS,
});

export const SNAPSHOT_PACKET_BYTE_STRIDES = Object.freeze({
  header: SNAPSHOT_PACKET_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  view: VIEW_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  meshDraw: MESH_DRAW_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  light: LIGHT_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  environment: ENVIRONMENT_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  shadowRequest: SHADOW_REQUEST_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  bounds: BOUNDS_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
});

export const SNAPSHOT_PACKET_DIAGNOSTIC_TRANSPORT_NOTE =
  "RenderSnapshot diagnostics stay outside the SAB packet area; diagnostic strings are rare and remain transferable structured-clone payloads.";

export interface SnapshotPacketBundle {
  readonly views: readonly ViewPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
  readonly lights: readonly LightPacket[];
  readonly environments: readonly EnvironmentPacket[];
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly bounds: readonly BoundsPacket[];
}

export interface EncodeSnapshotPacketsOptions {
  readonly registry?: SnapshotPacketEncodingRegistry;
  readonly buffer?: Uint32Array;
}

export interface EncodedSnapshotPackets {
  readonly words: Uint32Array;
  readonly registry: SnapshotPacketEncodingRegistry;
  readonly counts: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly shadowRequests: number;
    readonly bounds: number;
  };
  readonly wordLength: number;
  readonly byteLength: number;
}

const enum HeaderWord {
  Magic = 0,
  Version = 1,
  Views = 2,
  MeshDraws = 3,
  Lights = 4,
  Environments = 5,
  ShadowRequests = 6,
  Bounds = 7,
}

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

  words[HeaderWord.Magic] = SNAPSHOT_PACKET_ENCODING_MAGIC;
  words[HeaderWord.Version] = SNAPSHOT_PACKET_ENCODING_VERSION;
  words[HeaderWord.Views] = packets.views.length;
  words[HeaderWord.MeshDraws] = packets.meshDraws.length;
  words[HeaderWord.Lights] = packets.lights.length;
  words[HeaderWord.Environments] = packets.environments.length;
  words[HeaderWord.ShadowRequests] = packets.shadowRequests.length;
  words[HeaderWord.Bounds] = packets.bounds.length;

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
  assertSnapshotPacketHeader(words);

  const viewCount = words[HeaderWord.Views] ?? 0;
  const meshDrawCount = words[HeaderWord.MeshDraws] ?? 0;
  const lightCount = words[HeaderWord.Lights] ?? 0;
  const environmentCount = words[HeaderWord.Environments] ?? 0;
  const shadowRequestCount = words[HeaderWord.ShadowRequests] ?? 0;
  const boundsCount = words[HeaderWord.Bounds] ?? 0;
  const expectedWords =
    SNAPSHOT_PACKET_HEADER_WORDS +
    viewCount * VIEW_PACKET_WORDS +
    meshDrawCount * MESH_DRAW_PACKET_WORDS +
    lightCount * LIGHT_PACKET_WORDS +
    environmentCount * ENVIRONMENT_PACKET_WORDS +
    shadowRequestCount * SHADOW_REQUEST_PACKET_WORDS +
    boundsCount * BOUNDS_PACKET_WORDS;

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

  for (let index = 0; index < viewCount; index += 1) {
    views.push(readViewPacket(words, offset, registry));
    offset += VIEW_PACKET_WORDS;
  }

  for (let index = 0; index < meshDrawCount; index += 1) {
    meshDraws.push(readMeshDrawPacket(words, offset, registry));
    offset += MESH_DRAW_PACKET_WORDS;
  }

  for (let index = 0; index < lightCount; index += 1) {
    lights.push(readLightPacket(words, offset, registry));
    offset += LIGHT_PACKET_WORDS;
  }

  for (let index = 0; index < environmentCount; index += 1) {
    environments.push(readEnvironmentPacket(words, offset, registry));
    offset += ENVIRONMENT_PACKET_WORDS;
  }

  for (let index = 0; index < shadowRequestCount; index += 1) {
    shadowRequests.push(readShadowRequestPacket(words, offset));
    offset += SHADOW_REQUEST_PACKET_WORDS;
  }

  for (let index = 0; index < boundsCount; index += 1) {
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

function assertSnapshotPacketHeader(words: Uint32Array): void {
  if (words.length < SNAPSHOT_PACKET_HEADER_WORDS) {
    throw new RangeError("Snapshot packet buffer is missing its header.");
  }

  if (words[HeaderWord.Magic] !== SNAPSHOT_PACKET_ENCODING_MAGIC) {
    throw new RangeError("Snapshot packet buffer has an unsupported magic.");
  }

  if (words[HeaderWord.Version] !== SNAPSHOT_PACKET_ENCODING_VERSION) {
    throw new RangeError(
      `Snapshot packet buffer version ${words[HeaderWord.Version]} is unsupported.`,
    );
  }
}

export type SnapshotPacketEncodingInput =
  | SnapshotPacketBundle
  | Pick<
      RenderSnapshot,
      | "views"
      | "meshDraws"
      | "lights"
      | "environments"
      | "shadowRequests"
      | "bounds"
    >;
