import type {
  GltfAccessorDecodingDiagnostic,
  GltfAccessorDecodingReport,
  GltfDecodedPrimitiveAccessors,
} from "./gltf-accessor-decoding.js";
import {
  createGltfDecodedPrimitiveAccessorsFromDraco,
  type DracoAttributeDecodeRequest,
  type DracoMeshDecoder,
} from "./draco-decoder.js";
import type {
  GltfMeshPrimitiveMappingReport,
  GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive.js";

export function decodeGltfDracoPrimitiveAccessors(input: {
  readonly root: unknown;
  readonly primitiveReport: GltfMeshPrimitiveMappingReport;
  readonly decoder: DracoMeshDecoder | undefined;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
}): GltfAccessorDecodingReport {
  const diagnostics: GltfAccessorDecodingDiagnostic[] = [];
  const primitives: GltfDecodedPrimitiveAccessors[] = [];

  if (input.decoder === undefined || !isRecord(input.root)) {
    return { valid: true, primitives, diagnostics };
  }

  for (const primitive of input.primitiveReport.meshes) {
    if (primitive.compression?.extensionName !== "KHR_draco_mesh_compression") {
      continue;
    }

    const source = resolveCompressedBufferViewBytes(
      {
        root: input.root,
        resolveBufferBytes: input.resolveBufferBytes,
      },
      primitive,
    );
    if (source === null) {
      diagnostics.push({
        code: "gltfDracoDecode.missingBufferBytes",
        severity: "error",
        message: `Draco bufferView ${primitive.compression.bufferView} bytes were not available for mesh ${primitive.meshIndex} primitive ${primitive.primitiveIndex}.`,
        meshHandleKey: primitive.registeredHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
      });
      continue;
    }

    try {
      const decoded = input.decoder.decode(source.bytes, {
        attributes: primitive.compression.attributes.map(
          dracoAttributeRequestForSemantic,
        ),
      });
      primitives.push(
        createGltfDecodedPrimitiveAccessorsFromDraco({
          meshHandleKey: primitive.registeredHandleKey,
          meshIndex: primitive.meshIndex,
          primitiveIndex: primitive.primitiveIndex,
          decoded,
        }),
      );
    } catch (error) {
      diagnostics.push({
        code: "gltfDracoDecode.failed",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : `Draco decode failed for mesh ${primitive.meshIndex} primitive ${primitive.primitiveIndex}.`,
        meshHandleKey: primitive.registeredHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
        bufferIndex: source.bufferIndex,
        byteOffset: source.byteOffset,
        byteLength: source.bytes.byteLength,
      });
    }
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    primitives,
    diagnostics,
  };
}

function resolveCompressedBufferViewBytes(
  input: {
    readonly root: Record<string, unknown>;
    readonly resolveBufferBytes: (
      bufferIndex: number,
    ) => ArrayBuffer | ArrayBufferView | null | undefined;
  },
  primitive: GltfPlannedMeshPrimitiveAsset,
): {
  readonly bytes: Uint8Array;
  readonly bufferIndex: number;
  readonly byteOffset: number;
} | null {
  const bufferViewIndex = primitive.compression?.bufferView;
  const bufferView =
    bufferViewIndex === undefined
      ? undefined
      : Array.isArray(input.root.bufferViews)
        ? input.root.bufferViews[bufferViewIndex]
        : undefined;

  if (!isRecord(bufferView)) {
    return null;
  }

  const bufferIndex = integerField(bufferView.buffer);
  const byteOffset = integerField(bufferView.byteOffset ?? 0);
  const byteLength = integerField(bufferView.byteLength);
  if (
    bufferIndex === null ||
    bufferIndex < 0 ||
    byteOffset === null ||
    byteOffset < 0 ||
    byteLength === null ||
    byteLength < 0
  ) {
    return null;
  }

  const sourceBytes = bytesView(input.resolveBufferBytes(bufferIndex));
  if (
    sourceBytes === null ||
    byteOffset + byteLength > sourceBytes.byteLength
  ) {
    return null;
  }

  return {
    bytes: sourceBytes.subarray(byteOffset, byteOffset + byteLength),
    bufferIndex,
    byteOffset,
  };
}

function dracoAttributeRequestForSemantic(input: {
  readonly semantic: string;
  readonly uniqueId: number;
}): DracoAttributeDecodeRequest {
  return {
    semantic: input.semantic,
    uniqueId: input.uniqueId,
    output: input.semantic === "JOINTS_0" ? "uint16" : "float32",
  };
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
