import type { GltfAccessorDecodingDiagnostic } from "./gltf-accessor-decoding.js";
import type {
  MeshoptBufferDecoder,
  MeshoptDecodeFilter,
  MeshoptDecodeMode,
} from "./meshopt-decoder.js";

type GltfMeshoptCompressionExtensionName =
  | "EXT_meshopt_compression"
  | "KHR_meshopt_compression";

export interface DecodedGltfMeshoptBufferViews {
  readonly root: unknown;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
  readonly diagnostics: readonly GltfAccessorDecodingDiagnostic[];
}

interface GltfMeshoptBufferViewExtension {
  readonly extensionName: GltfMeshoptCompressionExtensionName;
  readonly buffer: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly byteStride: number;
  readonly count: number;
  readonly mode: MeshoptDecodeMode;
  readonly filter?: MeshoptDecodeFilter;
}

export function decodeGltfMeshoptBufferViews(input: {
  readonly root: unknown;
  readonly decoder: MeshoptBufferDecoder | undefined;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
}): DecodedGltfMeshoptBufferViews {
  const passthrough: DecodedGltfMeshoptBufferViews = {
    root: input.root,
    resolveBufferBytes: input.resolveBufferBytes,
    diagnostics: [],
  };

  if (!isRecord(input.root) || !Array.isArray(input.root.bufferViews)) {
    return passthrough;
  }

  const compressedBufferViewIndexes = input.root.bufferViews
    .map((bufferView, bufferViewIndex) =>
      meshoptExtensionNameForBufferView(bufferView) === null
        ? null
        : bufferViewIndex,
    )
    .filter(
      (bufferViewIndex): bufferViewIndex is number => bufferViewIndex !== null,
    );

  if (compressedBufferViewIndexes.length === 0) {
    return passthrough;
  }

  const diagnostics: GltfAccessorDecodingDiagnostic[] = [];
  if (input.decoder === undefined) {
    for (const bufferViewIndex of compressedBufferViewIndexes) {
      diagnostics.push({
        code: "gltfMeshoptDecode.decoderRequired",
        severity: "error",
        message: `Meshopt-compressed bufferView ${bufferViewIndex} requires a Meshopt decoder.`,
        bufferViewIndex,
      });
    }

    return {
      ...passthrough,
      diagnostics,
    };
  }

  const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
  const transformedBuffers = buffers.map((buffer) =>
    isRecord(buffer) ? { ...buffer } : buffer,
  );
  const transformedBufferViews = input.root.bufferViews.map((bufferView) =>
    isRecord(bufferView) ? { ...bufferView } : bufferView,
  );
  const decodedBuffers = new Map<number, Uint8Array>();

  for (const bufferViewIndex of compressedBufferViewIndexes) {
    const bufferView = input.root.bufferViews[bufferViewIndex];
    const extension = meshoptExtensionForBufferView(bufferView);

    if (extension === null) {
      diagnostics.push({
        code: "gltfMeshoptDecode.malformedExtension",
        severity: "error",
        message: `Meshopt-compressed bufferView ${bufferViewIndex} has a malformed compression extension.`,
        bufferViewIndex,
      });
      continue;
    }

    const sourceBytes = bytesView(input.resolveBufferBytes(extension.buffer));
    if (
      sourceBytes === null ||
      extension.byteOffset + extension.byteLength > sourceBytes.byteLength
    ) {
      diagnostics.push({
        code: "gltfMeshoptDecode.missingBufferBytes",
        severity: "error",
        message: `Meshopt-compressed bufferView ${bufferViewIndex} source bytes were not available.`,
        bufferViewIndex,
        bufferIndex: extension.buffer,
        byteOffset: extension.byteOffset,
        byteLength: extension.byteLength,
      });
      continue;
    }

    try {
      const decoded = input.decoder.decodeGltfBuffer(
        sourceBytes.subarray(
          extension.byteOffset,
          extension.byteOffset + extension.byteLength,
        ),
        {
          count: extension.count,
          byteStride: extension.byteStride,
          mode: extension.mode,
          ...(extension.filter === undefined
            ? {}
            : { filter: extension.filter }),
        },
      );
      const decodedBufferIndex = transformedBuffers.length;
      transformedBuffers.push({ byteLength: decoded.byteLength });
      decodedBuffers.set(decodedBufferIndex, decoded);
      transformedBufferViews[bufferViewIndex] = decodedMeshoptBufferView(
        bufferView,
        decodedBufferIndex,
        decoded.byteLength,
      );
    } catch (error) {
      diagnostics.push({
        code: "gltfMeshoptDecode.failed",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : `Meshopt decode failed for bufferView ${bufferViewIndex}.`,
        bufferViewIndex,
        bufferIndex: extension.buffer,
        byteOffset: extension.byteOffset,
        byteLength: extension.byteLength,
      });
    }
  }

  return {
    root: {
      ...input.root,
      buffers: transformedBuffers,
      bufferViews: transformedBufferViews,
    },
    resolveBufferBytes: (bufferIndex) =>
      decodedBuffers.get(bufferIndex) ?? input.resolveBufferBytes(bufferIndex),
    diagnostics,
  };
}

function decodedMeshoptBufferView(
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

function meshoptExtensionNameForBufferView(
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

function meshoptExtensionForBufferView(
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function bytesView(
  source: ArrayBuffer | ArrayBufferView | null | undefined,
): Uint8Array | null {
  if (source === null || source === undefined) {
    return null;
  }

  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function integerField(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" ? value : null;
}
