export function createGltfDecodedPrimitiveAccessorsFromDraco(input) {
    return {
        meshHandleKey: input.meshHandleKey,
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        vertexCount: input.decoded.vertexCount,
        attributes: input.decoded.attributes.map(dracoAttributeToGltfAccessor),
        indices: {
            semantic: "INDICES",
            accessorIndex: -1,
            bufferIndex: -1,
            sourceByteOffset: 0,
            sourceByteLength: input.decoded.indices.byteLength,
            expectedFormat: input.decoded.indices instanceof Uint16Array ? "uint16" : "uint32",
            itemSize: 1,
            array: input.decoded.indices,
        },
    };
}
function dracoAttributeToGltfAccessor(attribute) {
    if (!(attribute.array instanceof Float32Array) &&
        !(attribute.array instanceof Uint16Array) &&
        !(attribute.array instanceof Uint32Array)) {
        throw new Error(`Draco attribute '${attribute.semantic}' uses unsupported glTF output type '${attribute.dataType}'.`);
    }
    return {
        semantic: attribute.semantic,
        accessorIndex: -1,
        bufferIndex: -1,
        sourceByteOffset: 0,
        sourceByteLength: attribute.array.byteLength,
        expectedFormat: gltfExpectedFormatForDracoAttribute(attribute),
        itemSize: attribute.itemSize,
        array: attribute.array,
    };
}
function gltfExpectedFormatForDracoAttribute(attribute) {
    if (attribute.array instanceof Float32Array) {
        switch (attribute.itemSize) {
            case 2:
                return "float32x2";
            case 3:
                return "float32x3";
            case 4:
                return "float32x4";
        }
    }
    if (attribute.array instanceof Uint16Array) {
        return "uint16";
    }
    if (attribute.array instanceof Uint32Array) {
        return "uint32";
    }
    throw new Error(`Draco attribute '${attribute.semantic}' has unsupported item size ${attribute.itemSize}.`);
}
//# sourceMappingURL=draco-gltf-accessors.js.map