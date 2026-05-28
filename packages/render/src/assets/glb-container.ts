import {
  GLB_BINARY_CHUNK_TYPE,
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
  type GlbChunkInfo,
  type GlbContainerDiagnostic,
  type GlbContainerParseResult,
  type GlbContainerSource,
} from "./glb-container-types.js";
import {
  createErrorDiagnostic,
  createWarningDiagnostic,
  hasErrorDiagnostics,
} from "./glb-container-diagnostics.js";
import {
  classifyChunkType,
  decodeGlbJson,
  parseJsonObject,
  sourceBytesForRange,
  sourceToDataView,
} from "./glb-container-utils.js";

export {
  GLB_BINARY_CHUNK_TYPE,
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
} from "./glb-container-types.js";
export type {
  GlbChunkInfo,
  GlbChunkKind,
  GlbContainer,
  GlbContainerDiagnostic,
  GlbContainerDiagnosticCode,
  GlbContainerDiagnosticSeverity,
  GlbContainerParseResult,
  GlbContainerSource,
} from "./glb-container-types.js";

export function parseGlbContainer(
  source: GlbContainerSource,
): GlbContainerParseResult {
  const data = sourceToDataView(source);
  const diagnostics: GlbContainerDiagnostic[] = [];

  if (data.byteLength < GLB_HEADER_BYTE_LENGTH) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "glb.tooShort",
        message: `GLB data must be at least ${GLB_HEADER_BYTE_LENGTH} bytes.`,
        byteOffset: 0,
        byteLength: data.byteLength,
      }),
    );

    return { ok: false, container: null, diagnostics };
  }

  const magic = data.getUint32(0, true);
  const version = data.getUint32(4, true);
  const declaredLength = data.getUint32(8, true);

  if (magic !== GLB_CONTAINER_MAGIC) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "glb.invalidMagic",
        message: `GLB magic must be 0x${GLB_CONTAINER_MAGIC.toString(16)}.`,
        byteOffset: 0,
        byteLength: 4,
      }),
    );
  }

  if (version !== GLB_CONTAINER_VERSION) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "glb.unsupportedVersion",
        message: `GLB version must be ${GLB_CONTAINER_VERSION}.`,
        byteOffset: 4,
        byteLength: 4,
      }),
    );
  }

  if (declaredLength !== data.byteLength) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "glb.lengthMismatch",
        message: `GLB declared length ${declaredLength} does not match source length ${data.byteLength}.`,
        byteOffset: 8,
        byteLength: 4,
      }),
    );
  }

  if (hasErrorDiagnostics(diagnostics)) {
    return { ok: false, container: null, diagnostics };
  }

  const chunks: GlbChunkInfo[] = [];
  let jsonBytes: Uint8Array | null = null;
  let binaryChunk: Uint8Array | null = null;
  let offset = GLB_HEADER_BYTE_LENGTH;

  while (offset < declaredLength) {
    const remainingHeaderBytes = declaredLength - offset;

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

    const chunkLength = data.getUint32(offset, true);
    const chunkType = data.getUint32(offset + 4, true);
    const chunkDataOffset = offset + GLB_CHUNK_HEADER_BYTE_LENGTH;
    const chunkEnd = chunkDataOffset + chunkLength;

    if (chunkEnd > declaredLength) {
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

      jsonBytes = sourceBytesForRange(source, chunkDataOffset, chunkLength);
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

      binaryChunk = sourceBytesForRange(source, chunkDataOffset, chunkLength);
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

  if (!hasErrorDiagnostics(diagnostics) && jsonBytes === null) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "glb.missingJsonChunk",
        message: "GLB JSON chunk is missing.",
        byteOffset: GLB_HEADER_BYTE_LENGTH,
      }),
    );
  }

  if (hasErrorDiagnostics(diagnostics) || jsonBytes === null) {
    return { ok: false, container: null, diagnostics };
  }

  const jsonChunk = chunks[0];

  if (jsonChunk === undefined) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "glb.missingJsonChunk",
        message: "GLB JSON chunk is missing.",
        byteOffset: GLB_HEADER_BYTE_LENGTH,
      }),
    );

    return { ok: false, container: null, diagnostics };
  }

  const jsonText = decodeGlbJson(jsonBytes);

  if (jsonText === null) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "glb.invalidJson",
        message: "GLB JSON chunk must be valid UTF-8.",
        byteOffset: jsonChunk.byteOffset,
        byteLength: jsonChunk.byteLength,
        chunkType: GLB_JSON_CHUNK_TYPE,
      }),
    );

    return { ok: false, container: null, diagnostics };
  }

  const json = parseJsonObject(jsonText);

  if (json === null) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "glb.invalidJson",
        message: "GLB JSON chunk must parse to a JSON object.",
        byteOffset: jsonChunk.byteOffset,
        byteLength: jsonChunk.byteLength,
        chunkType: GLB_JSON_CHUNK_TYPE,
      }),
    );

    return { ok: false, container: null, diagnostics };
  }

  return {
    ok: !hasErrorDiagnostics(diagnostics),
    container: {
      version: GLB_CONTAINER_VERSION,
      byteLength: declaredLength,
      json,
      jsonText,
      binaryChunk,
      chunks,
    },
    diagnostics,
  };
}
