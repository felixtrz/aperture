import { decodedAttributeByteSize, decodedComponentByteSize, meshVertexFormatForDecodedAccessor, } from "./gltf-mesh-asset-vertex-formats.js";
export function packVertexAttributes(vertexCount, sources) {
    const strideBytes = sources.reduce((sum, source) => sum + decodedAttributeByteSize(source.decoded), 0);
    const descriptors = [];
    const floatOnly = sources.every((source) => source.decoded.array instanceof Float32Array);
    for (const source of sources) {
        descriptors.push({
            semantic: source.decoded
                .semantic,
            format: meshVertexFormatForDecodedAccessor(source.decoded),
            offset: source.offset,
        });
    }
    if (sources.length === 1) {
        const source = sources[0];
        if (source !== undefined &&
            source.offset === 0 &&
            (source.decoded.array instanceof Float32Array ||
                source.decoded.array instanceof Uint8Array ||
                source.decoded.array instanceof Uint16Array) &&
            source.decoded.array.byteLength >= vertexCount * strideBytes) {
            return { data: source.decoded.array, descriptors, strideBytes };
        }
    }
    if (floatOnly) {
        const strideFloats = strideBytes / 4;
        const data = new Float32Array(vertexCount * strideFloats);
        for (const source of sources) {
            for (let vertex = 0; vertex < vertexCount; vertex += 1) {
                const targetFloatOffset = vertex * strideFloats + source.offset / 4;
                for (let component = 0; component < source.decoded.itemSize; component += 1) {
                    data[targetFloatOffset + component] =
                        source.decoded.array[vertex * source.decoded.itemSize + component] ?? 0;
                }
            }
        }
        return { data, descriptors, strideBytes };
    }
    const data = new Uint8Array(vertexCount * strideBytes);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (const source of sources) {
        for (let vertex = 0; vertex < vertexCount; vertex += 1) {
            const targetByteOffset = vertex * strideBytes + source.offset;
            for (let component = 0; component < source.decoded.itemSize; component += 1) {
                writeDecodedComponent(view, targetByteOffset, source, vertex, component);
            }
        }
    }
    return { data, descriptors, strideBytes };
}
function writeDecodedComponent(view, targetByteOffset, source, vertex, component) {
    const sourceIndex = vertex * source.decoded.itemSize + component;
    const byteOffset = targetByteOffset + component * decodedComponentByteSize(source.decoded);
    const value = source.decoded.array[sourceIndex] ?? 0;
    if (source.decoded.array instanceof Uint8Array) {
        view.setUint8(byteOffset, value);
        return;
    }
    if (source.decoded.array instanceof Uint16Array) {
        view.setUint16(byteOffset, value, true);
        return;
    }
    view.setFloat32(byteOffset, value, true);
}
//# sourceMappingURL=gltf-mesh-asset-packed-streams.js.map