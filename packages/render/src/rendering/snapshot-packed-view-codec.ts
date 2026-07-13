import { MAX_CLIP_PLANES } from "./clip-planes.js";
import type { ViewPacket } from "./snapshot.js";
import {
  readEntity,
  readFloat32,
  readFloat64,
  readNullableHandle,
  readSigned32,
  readVec4,
  writeEntity,
  writeFloat32,
  writeFloat64,
  writeSigned32,
  writeVec4,
} from "./snapshot-packed-codec-utils.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";

// D2: clip block trails the render-target-face word. Word 37 holds the active
// plane count; words 38..(38 + MAX_CLIP_PLANES*4) hold up to MAX_CLIP_PLANES
// vec4 planes (zero-filled past the count).
const VIEW_CLIP_PLANE_COUNT_WORD = 37;
const VIEW_CLIP_PLANES_WORD = 38;

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
  writeSigned32(words, offset + 36, packet.renderTargetFace ?? -1);
  writeViewClipPlanes(words, offset, packet.clipPlanes);
}

export function readViewPacket(
  words: Uint32Array,
  offset: number,
  registry: SnapshotPacketEncodingRegistry,
): ViewPacket {
  const renderTargetFace = readSigned32(words, offset + 36);
  const clipPlanes = readViewClipPlanes(words, offset);

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
    // -1 is the "not a cube face" sentinel so decoded packets stay deep-equal
    // to their pre-encoding shape (the field is absent on ordinary views).
    ...(renderTargetFace < 0 ? {} : { renderTargetFace }),
    // Absent when the view has no clip planes so non-clip views decode
    // deep-equal to their pre-D2 shape (mirrors the renderTargetFace sentinel).
    ...(clipPlanes.length === 0 ? {} : { clipPlanes }),
  };
}

function writeViewClipPlanes(
  words: Uint32Array,
  offset: number,
  clipPlanes: ViewPacket["clipPlanes"],
): void {
  const planes = clipPlanes ?? [];
  const count = Math.min(planes.length, MAX_CLIP_PLANES);

  words[offset + VIEW_CLIP_PLANE_COUNT_WORD] = count >>> 0;

  for (let index = 0; index < MAX_CLIP_PLANES; index += 1) {
    const base = offset + VIEW_CLIP_PLANES_WORD + index * 4;
    const plane = index < count ? planes[index] : undefined;

    writeFloat32(words, base, plane?.[0] ?? 0);
    writeFloat32(words, base + 1, plane?.[1] ?? 0);
    writeFloat32(words, base + 2, plane?.[2] ?? 0);
    writeFloat32(words, base + 3, plane?.[3] ?? 0);
  }
}

function readViewClipPlanes(
  words: Uint32Array,
  offset: number,
): [number, number, number, number][] {
  const count = Math.min(
    words[offset + VIEW_CLIP_PLANE_COUNT_WORD] ?? 0,
    MAX_CLIP_PLANES,
  );
  const planes: [number, number, number, number][] = [];

  for (let index = 0; index < count; index += 1) {
    const base = offset + VIEW_CLIP_PLANES_WORD + index * 4;

    planes.push([
      readFloat32(words, base),
      readFloat32(words, base + 1),
      readFloat32(words, base + 2),
      readFloat32(words, base + 3),
    ]);
  }

  return planes;
}
