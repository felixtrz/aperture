import type { GltfValidatedAccessorReference } from "./gltf-accessor-validation.js";
import {
  createOutputArray,
  createOutputArrayView,
  NATIVE_LITTLE_ENDIAN,
  outputComponentBytes,
  readComponent,
} from "./gltf-accessor-decoding-shape.js";
import type {
  DecodeShape,
  GltfAccessorDecodingOptions,
  GltfDecodedAccessor,
  GltfDecodedArray,
} from "./gltf-accessor-decoding-types.js";

export function sourceBytesView(
  source: ArrayBuffer | ArrayBufferView | null | undefined,
): Uint8Array | null {
  if (source === null || source === undefined) {
    return null;
  }

  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

export function createDirectSourceBinding(input: {
  readonly accessor: GltfValidatedAccessorReference;
  readonly elementByteSize: number;
  readonly shape: DecodeShape;
  readonly sourceBytes: Uint8Array;
  readonly storageMode: NonNullable<GltfAccessorDecodingOptions["storageMode"]>;
}): Pick<
  GltfDecodedAccessor,
  | "sourceBufferViewIndex"
  | "sourceView"
  | "sourceViewByteOffset"
  | "sourceByteStride"
  | "sourceElementByteSize"
> | null {
  if (
    input.storageMode !== "source-view" ||
    !NATIVE_LITTLE_ENDIAN ||
    input.shape.sourceItemSize !== input.shape.outputItemSize ||
    input.accessor.expectedFormat === "uint8-to-uint16"
  ) {
    return null;
  }

  return {
    sourceBufferViewIndex: input.accessor.bufferViewIndex,
    sourceView: new Uint8Array(
      input.sourceBytes.buffer,
      input.sourceBytes.byteOffset + input.accessor.bufferViewByteOffset,
      input.accessor.bufferViewByteLength,
    ),
    sourceViewByteOffset:
      input.accessor.byteOffset - input.accessor.bufferViewByteOffset,
    sourceByteStride: input.accessor.byteStride,
    sourceElementByteSize: input.elementByteSize,
  };
}

export function decodeTightlyPackedAccessor(input: {
  readonly accessor: GltfValidatedAccessorReference;
  readonly elementByteSize: number;
  readonly shape: DecodeShape;
  readonly sourceBytes: Uint8Array;
  readonly storageMode: NonNullable<GltfAccessorDecodingOptions["storageMode"]>;
}): GltfDecodedArray | null {
  if (
    !NATIVE_LITTLE_ENDIAN ||
    input.accessor.byteStride !== input.elementByteSize ||
    input.shape.sourceItemSize !== input.shape.outputItemSize ||
    input.accessor.expectedFormat === "uint8-to-uint16"
  ) {
    return null;
  }

  const length = input.accessor.count * input.shape.outputItemSize;
  const byteLength = length * outputComponentBytes(input.shape);
  const sourceByteOffset =
    input.sourceBytes.byteOffset + input.accessor.byteOffset;

  if (input.storageMode === "source-view") {
    if (sourceByteOffset % outputComponentBytes(input.shape) !== 0) {
      return null;
    }

    return createOutputArrayView(
      input.shape,
      input.sourceBytes.buffer,
      sourceByteOffset,
      length,
    );
  }

  const compact = input.sourceBytes
    .subarray(input.accessor.byteOffset, input.accessor.byteOffset + byteLength)
    .slice();

  return createOutputArrayView(
    input.shape,
    compact.buffer,
    compact.byteOffset,
    length,
  );
}

export function decodeStridedAccessor(
  sourceBytes: Uint8Array,
  accessor: GltfValidatedAccessorReference,
  shape: DecodeShape,
): GltfDecodedArray {
  const output = createOutputArray(
    shape,
    accessor.count * shape.outputItemSize,
  );
  const view = new DataView(
    sourceBytes.buffer,
    sourceBytes.byteOffset,
    sourceBytes.byteLength,
  );

  for (let element = 0; element < accessor.count; element += 1) {
    const elementOffset = accessor.byteOffset + element * accessor.byteStride;
    for (let component = 0; component < shape.outputItemSize; component += 1) {
      output[element * shape.outputItemSize + component] =
        component < shape.sourceItemSize
          ? readComponent(
              view,
              elementOffset + component * shape.sourceComponentBytes,
              accessor.expectedFormat,
            )
          : shape.paddingComponentValue;
    }
  }

  return output;
}
