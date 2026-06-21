import { decodeAttributes } from "./draco-mesh-attributes.js";
import { decodeIndices } from "./draco-mesh-indices.js";
import { bytesView } from "./draco-utils.js";
const DEFAULT_ATTRIBUTE_REQUESTS = [
    { semantic: "POSITION", attribute: "POSITION", output: "float32" },
    { semantic: "NORMAL", attribute: "NORMAL", output: "float32" },
    { semantic: "COLOR", attribute: "COLOR", output: "float32" },
    { semantic: "TEXCOORD_0", attribute: "TEX_COORD", output: "float32" },
];
export function decodeDracoMeshData(source, draco, options) {
    const bytes = bytesView(source);
    const decoder = new draco.Decoder();
    const mesh = new draco.Mesh();
    try {
        const signedBytes = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (decoder.GetEncodedGeometryType(signedBytes) !== draco.TRIANGULAR_MESH) {
            throw new Error("Draco payload is not a triangular mesh.");
        }
        const status = decoder.DecodeArrayToMesh(signedBytes, bytes.byteLength, mesh);
        if (!status.ok() || mesh.ptr === 0) {
            throw new Error(`Draco mesh decode failed: ${status.error_msg()}`);
        }
        return {
            vertexCount: mesh.num_points(),
            faceCount: mesh.num_faces(),
            indices: decodeIndices(draco, decoder, mesh),
            attributes: decodeAttributes(draco, decoder, mesh, options.attributes ?? DEFAULT_ATTRIBUTE_REQUESTS),
        };
    }
    finally {
        draco.destroy(mesh);
        draco.destroy(decoder);
    }
}
//# sourceMappingURL=draco-mesh-data.js.map