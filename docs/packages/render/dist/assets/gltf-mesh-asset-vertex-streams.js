import { packVertexAttributes } from "./gltf-mesh-asset-packed-streams.js";
import { createSourceVertexStreams } from "./gltf-mesh-asset-source-streams.js";
export { decodedAttributeByteSize, isSupportedMeshAttributeArray, } from "./gltf-mesh-asset-vertex-formats.js";
export function createVertexStreams(vertexCount, sources) {
    const sourceStreams = createSourceVertexStreams(vertexCount, sources);
    if (sourceStreams !== null) {
        return sourceStreams;
    }
    const packed = packVertexAttributes(vertexCount, sources);
    return [
        {
            id: "gltf-primitive-interleaved",
            arrayStride: packed.strideBytes,
            vertexCount,
            attributes: packed.descriptors,
            data: packed.data,
        },
    ];
}
//# sourceMappingURL=gltf-mesh-asset-vertex-streams.js.map