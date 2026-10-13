import {
  GLB_BINARY_CHUNK_TYPE,
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
  type GlbChunkInfo,
  type GlbContainerDiagnostic,
  type GlbContainerSource,
} from "./glb-container-types.js";
import {
  createErrorDiagnostic,
  createWarningDiagnostic,
} from "./glb-container-diagnostics.js";
import {
  classifyChunkType,
  sourceBytesForRange,
} from "./glb-container-utils.js";

export interface GlbContainerChunkScanResult {
  readonly chunks: readonly GlbChunkInfo[];
  readonly jsonBytes: Uint8Array | null;
  readonly binaryChunk: Uint8Array | null;
  readonly diagnostics: readonly GlbContainerDiagnostic[];
}

export function scanGlbContainerChunks(input: {
  readonly source: GlbContainerSource;
  readonly data: DataView;
  readonly declaredLength: number;
}): GlbContainerChunkScanResult {
  const chunks: GlbChunkInfo[] = [];
  const diagnostics: GlbContainerDiagnostic[] = [];
  let jsonBytes: Uint8Array | null = null;
  let binaryChunk: Uint8Array | null = null;
  let offset = GLB_HEADER_BYTE_LENGTH;

  while (offset < input.declaredLength) {
    const remainingHeaderBytes = input.declaredLength - offset;

    if (remainingHeaderBytes < GLB_CHUNK_HEADER_BYTE_LENGTH) {
      diagnostics.push(
        createErrorDiagnostic({
          code: "glb.invalidChunkHeader",
          message: "GLB chunk header is truncated.",
          byteOffset: offset,
          byteLength: remainingHeaderBytes,
        }),
      );
      break;
    }

    const chunkLength = input.data.getUint32(offset, true);
    const chunkType = input.data.getUint32(offset + 4, true);
    const chunkDataOffset = offset + GLB_CHUNK_HEADER_BYTE_LENGTH;
    const chunkEnd = chunkDataOffset + chunkLength;

    if (chunkEnd > input.declaredLength) {
      diagnostics.push(
        createErrorDiagnostic({
          code: "glb.chunkOutOfBounds",
          message:
            "GLB chunk byte range exceeds the declared container length.",
          byteOffset: chunkDataOffset,
          byteLength: chunkLength,
          chunkType,
        }),
      );
      break;
    }

    const chunkInfo: GlbChunkInfo = {
      type: classifyChunkType(chunkType),
      typeCode: chunkType,
      byteOffset: chunkDataOffset,
      byteLength: chunkLength,
    };
    chunks.push(chunkInfo);

    if (chunks.length === 1 && chunkType !== GLB_JSON_CHUNK_TYPE) {
      diagnostics.push(
        createErrorDiagnostic({
          code: "glb.missingJsonChunk",
          message: "GLB first chunk must be the JSON chunk.",
          byteOffset: offset,
          byteLength: GLB_CHUNK_HEADER_BYTE_LENGTH,
          chunkType,
        }),
      );
      break;
    }

    if (chunkType === GLB_JSON_CHUNK_TYPE) {
      if (jsonBytes !== null) {
        diagnostics.push(
          createErrorDiagnostic({
            code: "glb.duplicateJsonChunk",
            message: "GLB must contain only one JSON chunk.",
            byteOffset: offset,
            byteLength: GLB_CHUNK_HEADER_BYTE_LENGTH + chunkLength,
            chunkType,
          }),
        );
        break;
      }

      if (chunkLength === 0) {
        diagnostics.push(
          createErrorDiagnostic({
            code: "glb.emptyJsonChunk",
            message: "GLB JSON chunk must not be empty.",
            byteOffset: chunkDataOffset,
            byteLength: chunkLength,
            chunkType,
          }),
        );
        break;
      }

      jsonBytes = sourceBytesForRange(
        input.source,
        chunkDataOffset,
        chunkLength,
      );
    } else if (chunkType === GLB_BINARY_CHUNK_TYPE) {
      if (binaryChunk !== null) {
        diagnostics.push(
          createErrorDiagnostic({
            code: "glb.duplicateBinaryChunk",
            message: "GLB must contain at most one BIN chunk.",
            byteOffset: offset,
            byteLength: GLB_CHUNK_HEADER_BYTE_LENGTH + chunkLength,
            chunkType,
          }),
        );
        break;
      }

      binaryChunk = sourceBytesForRange(
        input.source,
        chunkDataOffset,
        chunkLength,
      );
    } else if (chunkType !== GLB_BINARY_CHUNK_TYPE) {
      diagnostics.push(
        createWarningDiagnostic({
          code: "glb.unknownChunk",
          message:
            "GLB contains an unknown chunk type; preserving metadata only.",
          byteOffset: offset,
          byteLength: GLB_CHUNK_HEADER_BYTE_LENGTH + chunkLength,
          chunkType,
        }),
      );
    }

    offset = chunkEnd;
  }

  return { chunks, jsonBytes, binaryChunk, diagnostics };
}
