import type {
  MeshoptDecodeFilter,
  MeshoptDecodeMode,
} from "./meshopt-decoder.js";

export type GltfMeshoptCompressionExtensionName =
  | "EXT_meshopt_compression"
  | "KHR_meshopt_compression";

export interface GltfMeshoptBufferViewExtension {
  readonly extensionName: GltfMeshoptCompressionExtensionName;
  readonly buffer: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly byteStride: number;
  readonly count: number;
  readonly mode: MeshoptDecodeMode;
  readonly filter?: MeshoptDecodeFilter;
}

export function decodedMeshoptBufferView(
  source: unknown,
  bufferIndex: number,
  byteLength: number,
): Record<string, unknown> {
  const output = isRecord(source) ? { ...source } : {};
  output.buffer = bufferIndex;
  output.byteOffset = 0;
  output.byteLength = byteLength;

  const extensions = isRecord(output.extensions)
    ? { ...output.extensions }
    : null;
  if (extensions !== null) {
    delete extensions.EXT_meshopt_compression;
    delete extensions.KHR_meshopt_compression;
    if (Object.keys(extensions).length === 0) {
      delete output.extensions;
    } else {
      output.extensions = extensions;
    }
  }

  return output;
}

export function meshoptExtensionNameForBufferView(
  bufferView: unknown,
): GltfMeshoptCompressionExtensionName | null {
  if (!isRecord(bufferView) || !isRecord(bufferView.extensions)) {
    return null;
  }

  if (bufferView.extensions.EXT_meshopt_compression !== undefined) {
    return "EXT_meshopt_compression";
  }
  if (bufferView.extensions.KHR_meshopt_compression !== undefined) {
    return "KHR_meshopt_compression";
  }

  return null;
}

export function meshoptExtensionForBufferView(
  bufferView: unknown,
): GltfMeshoptBufferViewExtension | null {
  const extensionName = meshoptExtensionNameForBufferView(bufferView);
  if (
    !isRecord(bufferView) ||
    !isRecord(bufferView.extensions) ||
    extensionName === null
  ) {
    return null;
  }

  const extension = bufferView.extensions[extensionName];
  if (!isRecord(extension)) {
    return null;
  }

  const buffer = integerField(extension.buffer);
  const byteOffset = integerField(extension.byteOffset ?? 0);
  const byteLength = integerField(extension.byteLength);
  const byteStride = integerField(extension.byteStride);
  const count = integerField(extension.count);
  const mode = meshoptDecodeMode(extension.mode);
  const filter = meshoptDecodeFilter(extension.filter ?? "NONE");

  if (
    buffer === null ||
    buffer < 0 ||
    byteOffset === null ||
    byteOffset < 0 ||
    byteLength === null ||
    byteLength < 0 ||
    byteStride === null ||
    byteStride <= 0 ||
    count === null ||
    count <= 0 ||
    mode === null ||
    filter === null
  ) {
    return null;
  }

  return {
    extensionName,
    buffer,
    byteOffset,
    byteLength,
    byteStride,
    count,
    mode,
    ...(filter === "NONE" ? {} : { filter }),
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function bytesView(
  source: ArrayBuffer | ArrayBufferView | null | undefined,
): Uint8Array | null {
  if (source === null || source === undefined) {
    return null;
  }

  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function meshoptDecodeMode(value: unknown): MeshoptDecodeMode | null {
  return value === "ATTRIBUTES" || value === "TRIANGLES" || value === "INDICES"
    ? value
    : null;
}

function meshoptDecodeFilter(value: unknown): MeshoptDecodeFilter | null {
  return value === "NONE" ||
    value === "OCTAHEDRAL" ||
    value === "QUATERNION" ||
    value === "EXPONENTIAL" ||
    value === "COLOR"
    ? value
    : null;
}

function integerField(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" ? value : null;
}
