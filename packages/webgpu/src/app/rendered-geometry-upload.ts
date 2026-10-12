import type {
  MeshAsset,
  MeshBufferUpdateRange,
  MeshVertexAttributeDescriptor,
} from "@aperture-engine/render";

// Private receipts own bytes that matched a successful GPU upload. The public
// API only exports copies decoded from them, never these records or a registry.
export interface RenderedMeshUploadReceipt {
  readonly key: string;
  readonly sourceKey: string;
  readonly sourceVersion: number;
  readonly label: string;
  readonly streams: readonly {
    readonly id: string;
    readonly stride: number;
    readonly vertexCount: number;
    readonly attributes: readonly MeshVertexAttributeDescriptor[];
    readonly bytes: Uint8Array;
  }[];
  readonly indices: {
    readonly format: "uint16" | "uint32";
    readonly count: number;
    readonly bytes: Uint8Array;
  } | null;
  readonly bytes: number;
}

export function meshUploadReceiptByteLength(mesh: MeshAsset): number {
  return (
    mesh.vertexStreams.reduce(
      (sum, stream) => sum + stream.data.byteLength,
      0,
    ) + (mesh.indexBuffer?.data.byteLength ?? 0)
  );
}

/**
 * Call only after a successful upload. Fresh buffers receive all source bytes;
 * in-place reuse applies exactly the ranges sent to queue.writeBuffer. An empty
 * range list means no bytes changed, not a request for a full upload.
 */
export function createRenderedMeshUploadReceipt(input: {
  readonly key: string;
  readonly sourceKey: string;
  readonly sourceVersion: number;
  readonly mesh: MeshAsset;
  readonly reused: boolean;
  readonly previous?: RenderedMeshUploadReceipt;
}): RenderedMeshUploadReceipt {
  const streams = input.mesh.vertexStreams.map((stream) => {
    const prior = input.previous?.streams.find(
      (candidate) => candidate.id === stream.id,
    );
    return {
      id: stream.id,
      stride: stream.arrayStride,
      vertexCount: stream.vertexCount,
      attributes: stream.attributes.map((attribute) => ({ ...attribute })),
      bytes: uploadedBytes(
        stream.data,
        input.reused,
        stream.updateRanges,
        prior?.bytes,
      ),
    };
  });
  const sourceIndex = input.mesh.indexBuffer;
  const indices =
    sourceIndex === undefined
      ? null
      : {
          format: sourceIndex.format,
          count: sourceIndex.indexCount ?? sourceIndex.data.length,
          bytes: uploadedBytes(
            sourceIndex.data,
            input.reused,
            sourceIndex.updateRanges,
            input.previous?.indices?.format === sourceIndex.format
              ? input.previous.indices.bytes
              : undefined,
          ),
        };
  return {
    key: input.key,
    sourceKey: input.sourceKey,
    sourceVersion: input.sourceVersion,
    label: input.mesh.label,
    streams,
    indices,
    bytes: meshUploadReceiptByteLength(input.mesh),
  };
}

function uploadedBytes(
  source: ArrayBufferView,
  reused: boolean,
  ranges: readonly MeshBufferUpdateRange[] | undefined,
  previous: Uint8Array | undefined,
): Uint8Array {
  const bytes = new Uint8Array(
    source.buffer,
    source.byteOffset,
    source.byteLength,
  );
  if (!reused || ranges === undefined) return bytes.slice();
  if (previous === undefined || previous.byteLength !== bytes.byteLength)
    throw new Error(
      "A partial GPU upload requires its exact previous upload receipt.",
    );
  // Copy-on-write: earlier submitted frames can still refer to previous bytes.
  const output = previous.slice();
  for (const range of ranges) {
    if (
      !Number.isSafeInteger(range.byteOffset) ||
      range.byteOffset < 0 ||
      !Number.isSafeInteger(range.byteLength) ||
      range.byteLength < 0 ||
      range.byteOffset + range.byteLength > bytes.byteLength
    )
      throw new Error("A mesh upload receipt contains an invalid byte range.");
    output.set(
      bytes.subarray(range.byteOffset, range.byteOffset + range.byteLength),
      range.byteOffset,
    );
    // writeWebGpuBufferSubData pads a non-four-byte upload with zeros. Those
    // bytes can overwrite a following uint16 index inside the same buffer.
    const paddedLength = Math.ceil(range.byteLength / 4) * 4;
    if (paddedLength > range.byteLength)
      output.fill(
        0,
        range.byteOffset + range.byteLength,
        Math.min(output.length, range.byteOffset + paddedLength),
      );
  }
  return output;
}

export function findReceiptAttribute(
  receipt: RenderedMeshUploadReceipt,
  semantic: "POSITION" | "NORMAL",
) {
  for (const stream of receipt.streams) {
    const attribute = stream.attributes.find(
      (entry) => entry.semantic === semantic,
    );
    if (attribute !== undefined) return { stream, attribute };
  }
  return null;
}

export function validateReceiptAttribute(
  found: NonNullable<ReturnType<typeof findReceiptAttribute>>,
): void {
  const { stream, attribute } = found;
  if (
    !Number.isSafeInteger(stream.vertexCount) ||
    stream.vertexCount < 0 ||
    !Number.isSafeInteger(stream.stride) ||
    stream.stride < 12 ||
    !Number.isSafeInteger(attribute.offset) ||
    attribute.offset < 0 ||
    attribute.offset + 12 > stream.stride ||
    (stream.vertexCount > 0 &&
      (stream.vertexCount - 1) * stream.stride + attribute.offset + 12 >
        stream.bytes.byteLength)
  )
    throw new Error("A source attribute exceeds its uploaded vertex stream.");
}

export function copyReceiptAttribute(
  found: NonNullable<ReturnType<typeof findReceiptAttribute>>,
): Float32Array {
  validateReceiptAttribute(found);
  const output = new Float32Array(found.stream.vertexCount * 3);
  const view = new DataView(
    found.stream.bytes.buffer,
    found.stream.bytes.byteOffset,
    found.stream.bytes.byteLength,
  );
  for (let vertex = 0; vertex < found.stream.vertexCount; vertex += 1) {
    for (let component = 0; component < 3; component += 1) {
      const value = view.getFloat32(
        vertex * found.stream.stride + found.attribute.offset + component * 4,
        true,
      );
      if (!Number.isFinite(value))
        throw new Error(
          "A submitted source attribute contains a non-finite value.",
        );
      output[vertex * 3 + component] = value;
    }
  }
  return output;
}

export function copyReceiptIndices(
  receipt: RenderedMeshUploadReceipt,
): Uint16Array | Uint32Array | null {
  const index = receipt.indices;
  if (index === null) return null;
  const width = index.format === "uint16" ? 2 : 4;
  if (
    !Number.isSafeInteger(index.count) ||
    index.count < 0 ||
    index.count * width > index.bytes.byteLength
  )
    throw new Error("A submitted index count exceeds its uploaded bytes.");
  const output =
    index.format === "uint16"
      ? new Uint16Array(index.count)
      : new Uint32Array(index.count);
  const view = new DataView(
    index.bytes.buffer,
    index.bytes.byteOffset,
    index.bytes.byteLength,
  );
  for (let i = 0; i < index.count; i += 1)
    output[i] =
      width === 2
        ? view.getUint16(i * width, true)
        : view.getUint32(i * width, true);
  return output;
}
