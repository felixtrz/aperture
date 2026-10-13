import type { ViewPacket } from "./snapshot.js";
import {
  readEntity,
  readFloat64,
  readNullableHandle,
  readSigned32,
  readVec4,
  writeEntity,
  writeFloat64,
  writeSigned32,
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
