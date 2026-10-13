import {
  GLB_BINARY_CHUNK_TYPE,
  GLB_JSON_CHUNK_TYPE,
  type GlbChunkKind,
  type GlbContainerSource,
} from "./glb-container-types.js";

export function sourceToDataView(source: GlbContainerSource): DataView {
  if (source instanceof Uint8Array) {
    return new DataView(source.buffer, source.byteOffset, source.byteLength);
  }

  return new DataView(source);
}

export function sourceBytesForRange(
  source: GlbContainerSource,
  byteOffset: number,
  byteLength: number,
): Uint8Array {
  if (source instanceof Uint8Array) {
    return new Uint8Array(
      source.buffer,
      source.byteOffset + byteOffset,
      byteLength,
    );
  }

  return new Uint8Array(source, byteOffset, byteLength);
}

export function classifyChunkType(typeCode: number): GlbChunkKind {
  if (typeCode === GLB_JSON_CHUNK_TYPE) {
    return "json";
  }
  if (typeCode === GLB_BINARY_CHUNK_TYPE) {
    return "bin";
  }
  return "unknown";
}

export function decodeGlbJson(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function parseJsonObject(
  jsonText: string,
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(jsonText);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
