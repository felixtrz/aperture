import type {
  GltfReportDrivenGlbImportDiagnostic,
  GltfReportDrivenImportOptions,
} from "./gltf-report-driven-import.js";

export function resolvedExternalBufferByteLengths(
  options: GltfReportDrivenImportOptions,
): { readonly externalBufferByteLengths?: ReadonlyMap<number, number> } {
  if (!isRecord(options.root) || !Array.isArray(options.root.buffers)) {
    return {};
  }

  const byteLengths = new Map<number, number>();

  for (const [bufferIndex, buffer] of options.root.buffers.entries()) {
    if (!isRecord(buffer) || typeof buffer.uri !== "string") {
      continue;
    }

    const bytes = options.resolveBufferBytes?.(bufferIndex) ?? null;

    if (bytes !== null) {
      byteLengths.set(bufferIndex, byteLengthOf(bytes));
    }
  }

  return byteLengths.size === 0
    ? {}
    : { externalBufferByteLengths: byteLengths };
}

export function resolveGlbBufferBytes(
  bufferIndex: number,
  root: Record<string, unknown>,
  binaryChunk: Uint8Array | null,
  resolveExternalBufferBytes:
    | ((
        bufferIndex: number,
      ) => ArrayBuffer | ArrayBufferView | null | undefined)
    | undefined,
  resolvedBuffers: Map<number, ArrayBuffer | ArrayBufferView | null>,
): ArrayBuffer | ArrayBufferView | null {
  if (resolvedBuffers.has(bufferIndex)) {
    return resolvedBuffers.get(bufferIndex) ?? null;
  }

  const buffer = Array.isArray(root.buffers)
    ? root.buffers[bufferIndex]
    : undefined;
  const isExternalBuffer = isRecord(buffer) && typeof buffer.uri === "string";
  const resolved =
    (isExternalBuffer
      ? resolveExternalBufferBytes?.(bufferIndex)
      : bufferIndex === 0
        ? binaryChunk
        : null) ?? null;
  const normalized = resolved ?? null;

  resolvedBuffers.set(bufferIndex, normalized);

  return normalized;
}

export function createGlbBufferSourceDiagnostics(
  root: Record<string, unknown>,
  binaryChunk: Uint8Array | null,
  resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null,
): GltfReportDrivenGlbImportDiagnostic[] {
  const buffers = Array.isArray(root.buffers) ? root.buffers : [];
  const diagnostics: GltfReportDrivenGlbImportDiagnostic[] = [];

  buffers.forEach((buffer, bufferIndex) => {
    if (!isRecord(buffer)) {
      return;
    }

    if (resolveBufferBytes(bufferIndex) !== null) {
      return;
    }

    if (typeof buffer.uri === "string") {
      diagnostics.push({
        code: "glbImport.externalBufferUnsupported",
        severity: "error",
        bufferIndex,
        uri: buffer.uri,
        message: `GLB buffer ${bufferIndex} uses external URI '${buffer.uri}', but no caller-provided bytes were resolved.`,
      });
      return;
    }

    if (bufferIndex === 0 && binaryChunk === null) {
      diagnostics.push({
        code: "glbImport.missingBinaryChunk",
        severity: "error",
        bufferIndex,
        message:
          "GLB buffer 0 requires bytes, but the container has no BIN chunk.",
      });
    }
  });

  return diagnostics;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number {
  return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}
