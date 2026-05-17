export const GLB_CONTAINER_MAGIC = 0x46546c67;
export const GLB_CONTAINER_VERSION = 2;
export const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;
export const GLB_BINARY_CHUNK_TYPE = 0x004e4942;
export const GLB_HEADER_BYTE_LENGTH = 12;
export const GLB_CHUNK_HEADER_BYTE_LENGTH = 8;

export type GlbChunkKind = "json" | "bin" | "unknown";

export type GlbContainerDiagnosticCode =
  | "glb.tooShort"
  | "glb.invalidMagic"
  | "glb.unsupportedVersion"
  | "glb.lengthMismatch"
  | "glb.missingJsonChunk"
  | "glb.invalidChunkHeader"
  | "glb.chunkOutOfBounds"
  | "glb.emptyJsonChunk"
  | "glb.invalidJson"
  | "glb.unknownChunk";

export type GlbContainerDiagnosticSeverity = "error" | "warning";

export interface GlbContainerDiagnostic {
  readonly code: GlbContainerDiagnosticCode;
  readonly message: string;
  readonly severity: GlbContainerDiagnosticSeverity;
  readonly byteOffset?: number;
  readonly byteLength?: number;
  readonly chunkType?: number;
}

export interface GlbChunkInfo {
  readonly type: GlbChunkKind;
  readonly typeCode: number;
  readonly byteOffset: number;
  readonly byteLength: number;
}

export interface GlbContainer {
  readonly version: typeof GLB_CONTAINER_VERSION;
  readonly byteLength: number;
  readonly json: Record<string, unknown>;
  readonly jsonText: string;
  readonly binaryChunk: Uint8Array | null;
  readonly chunks: readonly GlbChunkInfo[];
}

export interface GlbContainerParseResult {
  readonly ok: boolean;
  readonly container: GlbContainer | null;
  readonly diagnostics: readonly GlbContainerDiagnostic[];
}

export type GlbContainerSource = ArrayBuffer | Uint8Array;

interface DiagnosticInput {
  readonly code: GlbContainerDiagnosticCode;
  readonly message: string;
  readonly severity: GlbContainerDiagnosticSeverity;
  readonly byteOffset?: number;
  readonly byteLength?: number;
  readonly chunkType?: number;
}

function createGlbContainerDiagnostic(
  input: DiagnosticInput,
): GlbContainerDiagnostic {
  const diagnostic: {
    code: GlbContainerDiagnosticCode;
    message: string;
    severity: GlbContainerDiagnosticSeverity;
    byteOffset?: number;
    byteLength?: number;
    chunkType?: number;
  } = {
    code: input.code,
    message: input.message,
    severity: input.severity,
  };

  if (input.byteOffset !== undefined) {
    diagnostic.byteOffset = input.byteOffset;
  }
  if (input.byteLength !== undefined) {
    diagnostic.byteLength = input.byteLength;
  }
  if (input.chunkType !== undefined) {
    diagnostic.chunkType = input.chunkType;
  }

  return diagnostic;
}

function createErrorDiagnostic(
  input: Omit<DiagnosticInput, "severity">,
): GlbContainerDiagnostic {
  return createGlbContainerDiagnostic({ ...input, severity: "error" });
}

function createWarningDiagnostic(
  input: Omit<DiagnosticInput, "severity">,
): GlbContainerDiagnostic {
  return createGlbContainerDiagnostic({ ...input, severity: "warning" });
}

function sourceToDataView(source: GlbContainerSource): DataView {
  if (source instanceof Uint8Array) {
    return new DataView(source.buffer, source.byteOffset, source.byteLength);
  }

  return new DataView(source);
}

function sourceBytesForRange(
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

function classifyChunkType(typeCode: number): GlbChunkKind {
  if (typeCode === GLB_JSON_CHUNK_TYPE) {
    return "json";
  }
  if (typeCode === GLB_BINARY_CHUNK_TYPE) {
    return "bin";
  }
  return "unknown";
}

function hasErrorDiagnostics(
  diagnostics: readonly GlbContainerDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function decodeGlbJson(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function parseJsonObject(jsonText: string): Record<string, unknown> | null {
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
    } else if (chunkType === GLB_BINARY_CHUNK_TYPE && binaryChunk === null) {
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
