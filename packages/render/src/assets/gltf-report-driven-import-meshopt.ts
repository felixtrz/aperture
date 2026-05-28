import type { GltfAccessorDecodingDiagnostic } from "./gltf-accessor-decoding.js";
import {
  bytesView,
  decodedMeshoptBufferView,
  isRecord,
  meshoptExtensionForBufferView,
  meshoptExtensionNameForBufferView,
} from "./gltf-report-driven-import-meshopt-extension.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";

export interface DecodedGltfMeshoptBufferViews {
  readonly root: unknown;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
  readonly diagnostics: readonly GltfAccessorDecodingDiagnostic[];
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
