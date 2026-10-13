import type {
  QuadBatchKind,
  QuadBillboardMode,
  QuadBlendMode,
  QuadCoordinateMode,
  QuadDepthMode,
  QuadPipelineVariant,
  QuadSizeMode,
} from "./quad-snapshot.js";
import type { QuadBatchPacket } from "./snapshot.js";
import {
  queueId,
  queueValue,
  readFloat64,
  readNullableHandle,
  readSigned32,
  writeFloat64,
  writeSigned32,
} from "./snapshot-packed-codec-utils.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";

export function writeQuadBatchPacket(
  words: Uint32Array,
  offset: number,
  packet: QuadBatchPacket,
  registry: SnapshotPacketEncodingRegistry,
): void {
  words[offset] = packet.batchId >>> 0;
  words[offset + 1] = quadBatchKindId(packet.kind);
  words[offset + 2] = registry.handleId(packet.texture ?? null);
  words[offset + 3] = registry.handleId(packet.sampler ?? null);
  words[offset + 4] = registry.stringId(packet.materialKey);
  words[offset + 5] = quadPipelineVariantId(packet.pipelineVariant);
  words[offset + 6] = quadCoordinateModeId(packet.coordinateMode);
  words[offset + 7] = quadBillboardModeId(packet.billboardMode);
  words[offset + 8] = quadSizeModeId(packet.sizeMode);
  words[offset + 9] = quadBlendModeId(packet.blendMode);
  words[offset + 10] = packet.firstInstance >>> 0;
  words[offset + 11] = packet.instanceCount >>> 0;
  words[offset + 12] = packet.layerMask >>> 0;
  words[offset + 13] = queueId(packet.sortKey.queue);
  words[offset + 14] = packet.sortKey.viewId >>> 0;
  writeSigned32(words, offset + 15, packet.sortKey.layer);
  writeSigned32(words, offset + 16, packet.sortKey.order);
  words[offset + 17] = registry.stringId(packet.sortKey.pipelineKey);
  words[offset + 18] = registry.stringId(packet.sortKey.materialKey);
  words[offset + 19] = registry.stringId(packet.sortKey.meshKey);
  writeFloat64(words, offset + 20, packet.sortKey.depth);
  words[offset + 22] = packet.sortKey.stableId >>> 0;
  words[offset + 23] = quadDepthModeId(packet.depthMode ?? "test");
}

export function readQuadBatchPacket(
  words: Uint32Array,
  offset: number,
  registry: SnapshotPacketEncodingRegistry,
): QuadBatchPacket {
  const texture = readNullableHandle(registry, words[offset + 2] ?? 0, [
    "texture",
  ]);
  const sampler = readNullableHandle(registry, words[offset + 3] ?? 0, [
    "sampler",
  ]);
  const depthMode = quadDepthModeValue(words[offset + 23] ?? 0);
  const packet: QuadBatchPacket = {
    batchId: words[offset] ?? 0,
    kind: quadBatchKindValue(words[offset + 1] ?? 0),
    materialKey: registry.stringValue(words[offset + 4] ?? 0),
    pipelineVariant: quadPipelineVariantValue(words[offset + 5] ?? 0),
    coordinateMode: quadCoordinateModeValue(words[offset + 6] ?? 0),
    billboardMode: quadBillboardModeValue(words[offset + 7] ?? 0),
    sizeMode: quadSizeModeValue(words[offset + 8] ?? 0),
    blendMode: quadBlendModeValue(words[offset + 9] ?? 0),
    ...(depthMode === "test" ? {} : { depthMode }),
    firstInstance: words[offset + 10] ?? 0,
    instanceCount: words[offset + 11] ?? 0,
    layerMask: words[offset + 12] ?? 0,
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
  };

  return {
    ...packet,
    ...(texture === null ? {} : { texture }),
    ...(sampler === null ? {} : { sampler }),
  };
}

function quadBatchKindId(kind: QuadBatchKind): number {
  switch (kind) {
    case "sprite":
      return 1;
    case "ui":
      return 2;
    case "glyph":
      return 3;
    case "particle":
      return 4;
  }
}

function quadBatchKindValue(id: number): QuadBatchKind {
  switch (id) {
    case 1:
      return "sprite";
    case 2:
      return "ui";
    case 3:
      return "glyph";
    case 4:
      return "particle";
    default:
      throw new RangeError(`Unknown quad batch kind id '${id}'.`);
  }
}

function quadPipelineVariantId(variant: QuadPipelineVariant): number {
  switch (variant) {
    case "sprite":
      return 1;
    case "ui-panel":
      return 2;
    case "ui-image":
      return 3;
    case "msdf-text":
      return 4;
    case "particle":
      return 5;
  }
}

function quadPipelineVariantValue(id: number): QuadPipelineVariant {
  switch (id) {
    case 1:
      return "sprite";
    case 2:
      return "ui-panel";
    case 3:
      return "ui-image";
    case 4:
      return "msdf-text";
    case 5:
      return "particle";
    default:
      throw new RangeError(`Unknown quad pipeline variant id '${id}'.`);
  }
}

function quadCoordinateModeId(mode: QuadCoordinateMode): number {
  switch (mode) {
    case "world":
      return 1;
    case "screen":
      return 2;
  }
}

function quadCoordinateModeValue(id: number): QuadCoordinateMode {
  switch (id) {
    case 1:
      return "world";
    case 2:
      return "screen";
    default:
      throw new RangeError(`Unknown quad coordinate mode id '${id}'.`);
  }
}

function quadBillboardModeId(mode: QuadBillboardMode): number {
  switch (mode) {
    case "none":
      return 0;
    case "spherical":
      return 1;
    case "cylindrical":
      return 2;
    case "axis-locked":
      return 3;
  }
}

function quadBillboardModeValue(id: number): QuadBillboardMode {
  switch (id) {
    case 0:
      return "none";
    case 1:
      return "spherical";
    case 2:
      return "cylindrical";
    case 3:
      return "axis-locked";
    default:
      throw new RangeError(`Unknown quad billboard mode id '${id}'.`);
  }
}

function quadSizeModeId(mode: QuadSizeMode): number {
  switch (mode) {
    case "world-units":
      return 1;
    case "screen-pixels":
      return 2;
  }
}

function quadSizeModeValue(id: number): QuadSizeMode {
  switch (id) {
    case 1:
      return "world-units";
    case 2:
      return "screen-pixels";
    default:
      throw new RangeError(`Unknown quad size mode id '${id}'.`);
  }
}

function quadBlendModeId(mode: QuadBlendMode): number {
  switch (mode) {
    case "opaque":
      return 1;
    case "alpha":
      return 2;
    case "additive":
      return 3;
    case "multiply":
      return 4;
  }
}

function quadBlendModeValue(id: number): QuadBlendMode {
  switch (id) {
    case 1:
      return "opaque";
    case 2:
      return "alpha";
    case 3:
      return "additive";
    case 4:
      return "multiply";
    default:
      throw new RangeError(`Unknown quad blend mode id '${id}'.`);
  }
}

function quadDepthModeId(mode: QuadDepthMode): number {
  switch (mode) {
    case "test":
      return 1;
    case "disabled":
      return 2;
  }
}

function quadDepthModeValue(id: number): QuadDepthMode {
  switch (id) {
    case 0:
    case 1:
      return "test";
    case 2:
      return "disabled";
    default:
      throw new RangeError(`Unknown quad depth mode id '${id}'.`);
  }
}
