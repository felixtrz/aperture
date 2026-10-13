import { createOutputArray, createOutputArrayView, NATIVE_LITTLE_ENDIAN, outputComponentBytes, readComponent, } from "./gltf-accessor-decoding-shape.js";
export function sourceBytesView(source) {
    if (source === null || source === undefined) {
        return null;
    }
    return source instanceof ArrayBuffer
        ? new Uint8Array(source)
        : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}
export function createDirectSourceBinding(input) {
    if (input.storageMode !== "source-view" ||
        !NATIVE_LITTLE_ENDIAN ||
        input.shape.sourceItemSize !== input.shape.outputItemSize ||
        input.shape.sourceComponentBytes !== outputComponentBytes(input.shape) ||
        input.shape.sourceComponentType !== input.shape.output ||
        input.accessor.expectedFormat === "uint8-to-uint16") {
        return null;
    }
    return {
        sourceBufferViewIndex: input.accessor.bufferViewIndex,
        sourceView: new Uint8Array(input.sourceBytes.buffer, input.sourceBytes.byteOffset + input.accessor.bufferViewByteOffset, input.accessor.bufferViewByteLength),
        sourceViewByteOffset: input.accessor.byteOffset - input.accessor.bufferViewByteOffset,
        sourceByteStride: input.accessor.byteStride,
        sourceElementByteSize: input.elementByteSize,
    };
}
export function decodeTightlyPackedAccessor(input) {
    if (!NATIVE_LITTLE_ENDIAN ||
        input.accessor.byteStride !== input.elementByteSize ||
        input.shape.sourceItemSize !== input.shape.outputItemSize ||
        input.shape.sourceComponentBytes !== outputComponentBytes(input.shape) ||
        input.shape.sourceComponentType !== input.shape.output ||
        input.accessor.expectedFormat === "uint8-to-uint16") {
        return null;
    }
    const length = input.accessor.count * input.shape.outputItemSize;
    const byteLength = length * outputComponentBytes(input.shape);
    const sourceByteOffset = input.sourceBytes.byteOffset + input.accessor.byteOffset;
    if (input.storageMode === "source-view") {
        if (sourceByteOffset % outputComponentBytes(input.shape) !== 0) {
            return null;
        }
        return createOutputArrayView(input.shape, input.sourceBytes.buffer, sourceByteOffset, length);
    }
    const compact = input.sourceBytes
        .subarray(input.accessor.byteOffset, input.accessor.byteOffset + byteLength)
        .slice();
    return createOutputArrayView(input.shape, compact.buffer, compact.byteOffset, length);
}
export function decodeStridedAccessor(sourceBytes, accessor, shape) {
    const output = createOutputArray(shape, accessor.count * shape.outputItemSize);
    const view = new DataView(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength);
    for (let element = 0; element < accessor.count; element += 1) {
        const elementOffset = accessor.byteOffset + element * accessor.byteStride;
        for (let component = 0; component < shape.outputItemSize; component += 1) {
            output[element * shape.outputItemSize + component] =
                component < shape.sourceItemSize
                    ? readComponent(view, elementOffset + component * shape.sourceComponentBytes, shape)
                    : shape.paddingComponentValue;
        }
    }
    return output;
}
//# sourceMappingURL=gltf-accessor-decoding-source.js.map