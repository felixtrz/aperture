import type {
  BoundsPacket,
  EnvironmentPacket,
  LightPacket,
  MeshDrawPacket,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";
import {
  DEFAULT_PACKED_AREA_LIGHT_SHAPE_ID,
  areaLightShapeId,
  areaLightShapeValue,
  batchFlags,
  boolState,
  lightKindId,
  lightKindValue,
  queueId,
  queueValue,
  readBoolState,
  readEntity,
  readFloat64,
  readNullableHandle,
  readOptionalUint32,
  readRequiredHandle,
  readSigned32,
  readVec3,
  readVec4,
  topologyId,
  topologyValue,
  writeEntity,
  writeFloat64,
  writeOptionalUint32,
  writeSigned32,
  writeVec3,
  writeVec4,
} from "./snapshot-packed-codec-utils.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";

export function writeViewPacket(
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

export function readViewPacket(
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

export function writeMeshDrawPacket(
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
  writeOptionalUint32(words, offset + 30, packet.vertexStart);
  writeOptionalUint32(words, offset + 31, packet.vertexCount);
  writeOptionalUint32(words, offset + 32, packet.indexStart);
  writeOptionalUint32(words, offset + 33, packet.indexCount);
}

export function readMeshDrawPacket(
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
  const vertexStart = readOptionalUint32(words, offset + 30);
  const vertexCount = readOptionalUint32(words, offset + 31);
  const indexStart = readOptionalUint32(words, offset + 32);
  const indexCount = readOptionalUint32(words, offset + 33);
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
    ...(vertexStart === undefined ? {} : { vertexStart }),
    ...(vertexCount === undefined ? {} : { vertexCount }),
    ...(indexStart === undefined ? {} : { indexStart }),
    ...(indexCount === undefined ? {} : { indexCount }),
    ...(castsShadow === undefined ? {} : { castsShadow }),
    ...(receivesShadow === undefined ? {} : { receivesShadow }),
    ...((batchFlags & 8) === 0 ? {} : { occlusionQuery: true }),
  };
}

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

export function writeBoundsPacket(
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

export function readBoundsPacket(
  words: Uint32Array,
  offset: number,
): BoundsPacket {
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
