import {
  assetHandleKey,
  createAssetHandle,
  type AssetHandle,
  type AssetKind,
  type SerializedAssetHandle,
} from "@aperture-engine/simulation";

import type { MeshTopology } from "../mesh/index.js";
import type { LightKind } from "./authoring.js";
import type {
  BoundsPacket,
  EnvironmentPacket,
  LightPacket,
  MeshDrawPacket,
  RenderQueue,
  RenderSnapshot,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";

export const SNAPSHOT_PACKET_ENCODING_MAGIC = 0x4150_5350; // "APSP"
export const SNAPSHOT_PACKET_ENCODING_VERSION = 1;

export const SNAPSHOT_PACKET_HEADER_WORDS = 8;
export const VIEW_PACKET_WORDS = 36;
export const MESH_DRAW_PACKET_WORDS = 30;
export const LIGHT_PACKET_WORDS = 26;
export const ENVIRONMENT_PACKET_WORDS = 13;
export const SHADOW_REQUEST_PACKET_WORDS = 5;
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

export interface SnapshotPacketRegistrySnapshot {
  readonly strings: readonly string[];
  readonly handles: readonly SerializedAssetHandle[];
}

export interface SnapshotPacketEncodingRegistry extends SnapshotPacketRegistrySnapshot {
  stringId(value: string): number;
  stringValue(id: number): string;
  handleId(handle: AssetHandle | null): number;
  handleValue(id: number): AssetHandle | null;
  snapshot(): SnapshotPacketRegistrySnapshot;
}

export interface CreateSnapshotPacketRegistryOptions {
  readonly strings?: readonly string[];
  readonly handles?: readonly SerializedAssetHandle[];
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

const OPTIONAL_UINT32_ABSENT = 0xffff_ffff;

const FLOAT64_SCRATCH = new Float64Array(1);
const FLOAT64_WORDS = new Uint32Array(FLOAT64_SCRATCH.buffer);

const QueueId = Object.freeze({
  Opaque: 1,
  AlphaTest: 2,
  Transparent: 3,
});

const LightKindId = Object.freeze({
  Ambient: 1,
  Environment: 2,
  Directional: 3,
  Point: 4,
  Spot: 5,
  RectArea: 6,
});

const TopologyId = Object.freeze({
  TriangleList: 1,
  TriangleStrip: 2,
  LineList: 3,
  LineStrip: 4,
  PointList: 5,
});

export function createSnapshotPacketRegistry(
  options: CreateSnapshotPacketRegistryOptions = {},
): SnapshotPacketEncodingRegistry {
  const strings = Array.from(options.strings ?? []);
  const stringIds = new Map<string, number>();

  strings.forEach((value, index) => {
    stringIds.set(value, index + 1);
  });

  const handles = Array.from(options.handles ?? []);
  const handleIds = new Map<string, number>();

  handles.forEach((handle, index) => {
    handleIds.set(serializedHandleKey(handle), index + 1);
  });

  return {
    strings,
    handles,
    stringId(value: string): number {
      const existing = stringIds.get(value);

      if (existing !== undefined) {
        return existing;
      }

      const id = strings.length + 1;

      strings.push(value);
      stringIds.set(value, id);

      return id;
    },
    stringValue(id: number): string {
      if (id <= 0 || id > strings.length) {
        throw new RangeError(`Unknown snapshot packet string id '${id}'.`);
      }

      return strings[id - 1] ?? "";
    },
    handleId(handle: AssetHandle | null): number {
      if (handle === null) {
        return 0;
      }

      const key = assetHandleKey(handle);
      const existing = handleIds.get(key);

      if (existing !== undefined) {
        return existing;
      }

      const id = handles.length + 1;

      handles.push({ kind: handle.kind, id: handle.id });
      handleIds.set(key, id);

      return id;
    },
    handleValue(id: number): AssetHandle | null {
      if (id === 0) {
        return null;
      }

      if (id < 0 || id > handles.length) {
        throw new RangeError(`Unknown snapshot packet handle id '${id}'.`);
      }

      const handle = handles[id - 1];

      if (handle === undefined) {
        throw new RangeError(`Unknown snapshot packet handle id '${id}'.`);
      }

      return createAssetHandle(handle.kind, handle.id);
    },
    snapshot(): SnapshotPacketRegistrySnapshot {
      return {
        strings: Array.from(strings),
        handles: handles.map((handle) => ({
          kind: handle.kind,
          id: handle.id,
        })),
      };
    },
  };
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
    writeLightPacket(words, offset, packet);
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
    lights.push(readLightPacket(words, offset));
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

function writeViewPacket(
  words: Uint32Array,
  offset: number,
  packet: ViewPacket,
  registry: SnapshotPacketEncodingRegistry,
): void {
  words[offset] = packet.viewId >>> 0;
  writeEntity(words, offset + 1, packet.camera);
  writeSigned32(words, offset + 3, packet.priority);
  words[offset + 4] = packet.layerMask >>> 0;
  words[offset + 5] = packet.viewMatrixOffset >>> 0;
  words[offset + 6] = packet.projectionMatrixOffset >>> 0;
  words[offset + 7] = packet.viewProjectionMatrixOffset >>> 0;
  writeVec4(words, offset + 8, packet.viewport);
  writeVec4(words, offset + 16, packet.scissor);
  writeVec4(words, offset + 24, packet.clearColor);
  writeFloat64(words, offset + 32, packet.clearDepth);
  writeSigned32(words, offset + 34, packet.clearStencil);
  words[offset + 35] = registry.handleId(packet.renderTarget) >>> 0;
}

function readViewPacket(
  words: Uint32Array,
  offset: number,
  registry: SnapshotPacketEncodingRegistry,
): ViewPacket {
  return {
    viewId: words[offset] ?? 0,
    camera: readEntity(words, offset + 1),
    priority: readSigned32(words, offset + 3),
    layerMask: words[offset + 4] ?? 0,
    viewMatrixOffset: words[offset + 5] ?? 0,
    projectionMatrixOffset: words[offset + 6] ?? 0,
    viewProjectionMatrixOffset: words[offset + 7] ?? 0,
    viewport: readVec4(words, offset + 8),
    scissor: readVec4(words, offset + 16),
    clearColor: readVec4(words, offset + 24),
    clearDepth: readFloat64(words, offset + 32),
    clearStencil: readSigned32(words, offset + 34),
    renderTarget: readNullableHandle(registry, words[offset + 35] ?? 0, [
      "render-target",
    ]),
  };
}

function writeMeshDrawPacket(
  words: Uint32Array,
  offset: number,
  packet: MeshDrawPacket,
  registry: SnapshotPacketEncodingRegistry,
): void {
  words[offset] = packet.renderId >>> 0;
  writeEntity(words, offset + 1, packet.entity);
  words[offset + 3] = registry.handleId(packet.mesh) >>> 0;
  words[offset + 4] = registry.handleId(packet.material) >>> 0;
  words[offset + 5] = packet.submesh >>> 0;
  words[offset + 6] = packet.materialSlot >>> 0;
  words[offset + 7] = packet.worldTransformOffset >>> 0;
  writeOptionalUint32(words, offset + 8, packet.instanceTintOffset);
  words[offset + 9] = packet.boundsIndex >>> 0;
  words[offset + 10] = packet.layerMask >>> 0;
  words[offset + 11] = boolState(packet.castsShadow);
  words[offset + 12] = boolState(packet.receivesShadow);
  words[offset + 13] = queueId(packet.sortKey.queue);
  words[offset + 14] = packet.sortKey.viewId >>> 0;
  writeSigned32(words, offset + 15, packet.sortKey.layer);
  writeSigned32(words, offset + 16, packet.sortKey.order);
  words[offset + 17] = registry.stringId(packet.sortKey.pipelineKey);
  words[offset + 18] = registry.stringId(packet.sortKey.materialKey);
  words[offset + 19] = registry.stringId(packet.sortKey.meshKey);
  writeFloat64(words, offset + 20, packet.sortKey.depth);
  words[offset + 22] = packet.sortKey.stableId >>> 0;
  words[offset + 23] = registry.stringId(packet.batchKey.pipelineKey);
  words[offset + 24] = registry.stringId(packet.batchKey.materialKey);
  words[offset + 25] = registry.stringId(packet.batchKey.meshLayoutKey);
  words[offset + 26] = topologyId(packet.batchKey.topology);
  words[offset + 27] = batchFlags(packet);
  writeOptionalUint32(words, offset + 28, packet.boneMatrixOffset);
  writeOptionalUint32(words, offset + 29, packet.boneMatrixCount);
}

function readMeshDrawPacket(
  words: Uint32Array,
  offset: number,
  registry: SnapshotPacketEncodingRegistry,
): MeshDrawPacket {
  const instanceTintOffset = readOptionalUint32(words, offset + 8);
  const castsShadow = readBoolState(words[offset + 11] ?? 0);
  const receivesShadow = readBoolState(words[offset + 12] ?? 0);
  const batchFlags = words[offset + 27] ?? 0;
  const boneMatrixOffset = readOptionalUint32(words, offset + 28);
  const boneMatrixCount = readOptionalUint32(words, offset + 29);
  const packet: MeshDrawPacket = {
    renderId: words[offset] ?? 0,
    entity: readEntity(words, offset + 1),
    mesh: readRequiredHandle(registry, words[offset + 3] ?? 0, "mesh"),
    material: readRequiredHandle(registry, words[offset + 4] ?? 0, "material"),
    submesh: words[offset + 5] ?? 0,
    materialSlot: words[offset + 6] ?? 0,
    worldTransformOffset: words[offset + 7] ?? 0,
    boundsIndex: words[offset + 9] ?? 0,
    layerMask: words[offset + 10] ?? 0,
    sortKey: {
      queue: queueValue(words[offset + 13] ?? 0),
      viewId: words[offset + 14] ?? 0,
      layer: readSigned32(words, offset + 15),
      order: readSigned32(words, offset + 16),
      pipelineKey: registry.stringValue(words[offset + 17] ?? 0),
      materialKey: registry.stringValue(words[offset + 18] ?? 0),
      meshKey: registry.stringValue(words[offset + 19] ?? 0),
      depth: readFloat64(words, offset + 20),
      stableId: words[offset + 22] ?? 0,
    },
    batchKey: {
      pipelineKey: registry.stringValue(words[offset + 23] ?? 0),
      materialKey: registry.stringValue(words[offset + 24] ?? 0),
      meshLayoutKey: registry.stringValue(words[offset + 25] ?? 0),
      topology: topologyValue(words[offset + 26] ?? 0),
      instanced: (batchFlags & 1) !== 0,
      skinned: (batchFlags & 2) !== 0,
      morphed: (batchFlags & 4) !== 0,
    },
  };

  return {
    ...packet,
    ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
    ...(boneMatrixOffset === undefined ? {} : { boneMatrixOffset }),
    ...(boneMatrixCount === undefined ? {} : { boneMatrixCount }),
    ...(castsShadow === undefined ? {} : { castsShadow }),
    ...(receivesShadow === undefined ? {} : { receivesShadow }),
  };
}

function writeLightPacket(
  words: Uint32Array,
  offset: number,
  packet: LightPacket,
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
  words[offset + 24] = packet.worldTransformOffset >>> 0;
  words[offset + 25] = packet.layerMask >>> 0;
}

function readLightPacket(words: Uint32Array, offset: number): LightPacket {
  return {
    lightId: words[offset] ?? 0,
    entity: readEntity(words, offset + 1),
    kind: lightKindValue(words[offset + 3] ?? 0),
    color: readVec4(words, offset + 4),
    intensity: readFloat64(words, offset + 12),
    range: readFloat64(words, offset + 14),
    innerConeAngle: readFloat64(words, offset + 16),
    outerConeAngle: readFloat64(words, offset + 18),
    width: readFloat64(words, offset + 20),
    height: readFloat64(words, offset + 22),
    worldTransformOffset: words[offset + 24] ?? 0,
    layerMask: words[offset + 25] ?? 0,
  };
}

function writeEnvironmentPacket(
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

function readEnvironmentPacket(
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

function writeShadowRequestPacket(
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
}

function readShadowRequestPacket(
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

  return {
    ...packet,
    ...(lightKind === 0 ? {} : { lightKind: lightKindValue(lightKind) }),
  };
}

function writeBoundsPacket(
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

function readBoundsPacket(words: Uint32Array, offset: number): BoundsPacket {
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

function writeEntity(
  words: Uint32Array,
  offset: number,
  entity: { readonly index: number; readonly generation: number },
): void {
  words[offset] = entity.index >>> 0;
  words[offset + 1] = entity.generation >>> 0;
}

function readEntity(
  words: Uint32Array,
  offset: number,
): { readonly index: number; readonly generation: number } {
  return {
    index: words[offset] ?? 0,
    generation: words[offset + 1] ?? 0,
  };
}

function writeVec3(
  words: Uint32Array,
  offset: number,
  value: ArrayLike<number>,
): void {
  writeFloat64(words, offset, value[0] ?? 0);
  writeFloat64(words, offset + 2, value[1] ?? 0);
  writeFloat64(words, offset + 4, value[2] ?? 0);
}

function readVec3(
  words: Uint32Array,
  offset: number,
): readonly [number, number, number] {
  return [
    readFloat64(words, offset),
    readFloat64(words, offset + 2),
    readFloat64(words, offset + 4),
  ];
}

function writeVec4(
  words: Uint32Array,
  offset: number,
  value: ArrayLike<number>,
): void {
  writeFloat64(words, offset, value[0] ?? 0);
  writeFloat64(words, offset + 2, value[1] ?? 0);
  writeFloat64(words, offset + 4, value[2] ?? 0);
  writeFloat64(words, offset + 6, value[3] ?? 0);
}

function readVec4(
  words: Uint32Array,
  offset: number,
): readonly [number, number, number, number] {
  return [
    readFloat64(words, offset),
    readFloat64(words, offset + 2),
    readFloat64(words, offset + 4),
    readFloat64(words, offset + 6),
  ];
}

function writeFloat64(words: Uint32Array, offset: number, value: number): void {
  FLOAT64_SCRATCH[0] = value;
  words[offset] = FLOAT64_WORDS[0] ?? 0;
  words[offset + 1] = FLOAT64_WORDS[1] ?? 0;
}

function readFloat64(words: Uint32Array, offset: number): number {
  FLOAT64_WORDS[0] = words[offset] ?? 0;
  FLOAT64_WORDS[1] = words[offset + 1] ?? 0;

  return FLOAT64_SCRATCH[0] ?? 0;
}

function writeSigned32(
  words: Uint32Array,
  offset: number,
  value: number,
): void {
  words[offset] = value >>> 0;
}

function readSigned32(words: Uint32Array, offset: number): number {
  return (words[offset] ?? 0) | 0;
}

function writeOptionalUint32(
  words: Uint32Array,
  offset: number,
  value: number | undefined,
): void {
  words[offset] = value === undefined ? OPTIONAL_UINT32_ABSENT : value >>> 0;
}

function readOptionalUint32(
  words: Uint32Array,
  offset: number,
): number | undefined {
  const value = words[offset] ?? OPTIONAL_UINT32_ABSENT;

  return value === OPTIONAL_UINT32_ABSENT ? undefined : value;
}

function boolState(value: boolean | undefined): number {
  return value === undefined ? 0 : value ? 2 : 1;
}

function readBoolState(value: number): boolean | undefined {
  switch (value) {
    case 0:
      return undefined;
    case 1:
      return false;
    case 2:
      return true;
    default:
      throw new RangeError(`Unknown snapshot packet boolean state '${value}'.`);
  }
}

function batchFlags(packet: MeshDrawPacket): number {
  return (
    (packet.batchKey.instanced ? 1 : 0) |
    (packet.batchKey.skinned ? 2 : 0) |
    (packet.batchKey.morphed ? 4 : 0)
  );
}

function queueId(queue: RenderQueue): number {
  switch (queue) {
    case "opaque":
      return QueueId.Opaque;
    case "alpha-test":
      return QueueId.AlphaTest;
    case "transparent":
      return QueueId.Transparent;
  }
}

function queueValue(id: number): RenderQueue {
  switch (id) {
    case QueueId.Opaque:
      return "opaque";
    case QueueId.AlphaTest:
      return "alpha-test";
    case QueueId.Transparent:
      return "transparent";
    default:
      throw new RangeError(`Unknown snapshot packet render queue id '${id}'.`);
  }
}

function lightKindId(kind: LightKind): number {
  switch (kind) {
    case "ambient":
      return LightKindId.Ambient;
    case "environment":
      return LightKindId.Environment;
    case "directional":
      return LightKindId.Directional;
    case "point":
      return LightKindId.Point;
    case "spot":
      return LightKindId.Spot;
    case "rect-area":
      return LightKindId.RectArea;
  }
}

function lightKindValue(id: number): LightKind {
  switch (id) {
    case LightKindId.Ambient:
      return "ambient";
    case LightKindId.Environment:
      return "environment";
    case LightKindId.Directional:
      return "directional";
    case LightKindId.Point:
      return "point";
    case LightKindId.Spot:
      return "spot";
    case LightKindId.RectArea:
      return "rect-area";
    default:
      throw new RangeError(`Unknown snapshot packet light kind id '${id}'.`);
  }
}

function topologyId(topology: MeshTopology): number {
  switch (topology) {
    case "triangle-list":
      return TopologyId.TriangleList;
    case "triangle-strip":
      return TopologyId.TriangleStrip;
    case "line-list":
      return TopologyId.LineList;
    case "line-strip":
      return TopologyId.LineStrip;
    case "point-list":
      return TopologyId.PointList;
  }
}

function topologyValue(id: number): MeshTopology {
  switch (id) {
    case TopologyId.TriangleList:
      return "triangle-list";
    case TopologyId.TriangleStrip:
      return "triangle-strip";
    case TopologyId.LineList:
      return "line-list";
    case TopologyId.LineStrip:
      return "line-strip";
    case TopologyId.PointList:
      return "point-list";
    default:
      throw new RangeError(`Unknown snapshot packet topology id '${id}'.`);
  }
}

function readRequiredHandle<TKind extends AssetKind>(
  registry: SnapshotPacketEncodingRegistry,
  id: number,
  expectedKind: TKind,
): AssetHandle<TKind> {
  const handle = registry.handleValue(id);

  if (handle === null) {
    throw new RangeError(
      `Expected ${expectedKind} handle id, received null handle id.`,
    );
  }

  assertHandleKind(handle, [expectedKind]);

  return handle as AssetHandle<TKind>;
}

function readNullableHandle<TKind extends AssetKind>(
  registry: SnapshotPacketEncodingRegistry,
  id: number,
  expectedKinds: readonly TKind[],
): AssetHandle<TKind> | null {
  const handle = registry.handleValue(id);

  if (handle === null) {
    return null;
  }

  assertHandleKind(handle, expectedKinds);

  return handle as AssetHandle<TKind>;
}

function assertHandleKind(
  handle: AssetHandle,
  expectedKinds: readonly AssetKind[],
): void {
  if (!expectedKinds.includes(handle.kind)) {
    throw new RangeError(
      `Expected ${expectedKinds.join(" or ")} handle, received '${assetHandleKey(
        handle,
      )}'.`,
    );
  }
}

function serializedHandleKey(handle: SerializedAssetHandle): string {
  return `${handle.kind}:${handle.id}`;
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
