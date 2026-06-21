import { calculateVertexTangents } from "./gltf-mesh-tangent-calculation.js";
export function generateMissingTangents(primitive, position, normal, texcoord, diagnostics, request) {
    const positions = position.array;
    const normals = normal?.array;
    const uvs = texcoord?.array;
    if (!(positions instanceof Float32Array) ||
        !(normals instanceof Float32Array) ||
        !(uvs instanceof Float32Array) ||
        position.itemSize !== 3 ||
        normal?.itemSize !== 3 ||
        texcoord?.itemSize !== 2) {
        diagnostics.push(tangentDiagnostic(primitive, "gltfMeshAsset.tangentGenerationSkipped", {
            reason: request.reason,
            message: `Primitive '${primitive.meshHandleKey}' needs generated TANGENT data for ${request.reason}, but POSITION, NORMAL, and TEXCOORD_0 float attributes are not all available.`,
        }));
        return null;
    }
    const indices = primitive.indices?.array ?? null;
    if (indices !== null &&
        !(indices instanceof Uint16Array) &&
        !(indices instanceof Uint32Array)) {
        diagnostics.push(tangentDiagnostic(primitive, "gltfMeshAsset.tangentGenerationSkipped", {
            reason: request.reason,
            message: `Primitive '${primitive.meshHandleKey}' needs generated TANGENT data for ${request.reason}, but its index array type is unsupported.`,
        }));
        return null;
    }
    const triangleIndexCount = indices?.length ?? primitive.vertexCount;
    const triangleCount = Math.floor(triangleIndexCount / 3);
    if (triangleCount === 0) {
        diagnostics.push(tangentDiagnostic(primitive, "gltfMeshAsset.tangentGenerationSkipped", {
            reason: request.reason,
            message: `Primitive '${primitive.meshHandleKey}' needs generated TANGENT data for ${request.reason}, but it has no complete triangles.`,
        }));
        return null;
    }
    const tangents = calculateVertexTangents({
        positions,
        normals,
        uvs,
        indices,
        vertexCount: primitive.vertexCount,
        triangleCount,
    });
    diagnostics.push(tangentDiagnostic(primitive, "gltfMeshAsset.generatedTangents", {
        reason: request.reason,
        tangentPath: "generated-mesh-attribute",
        vertexCount: primitive.vertexCount,
        message: `Generated renderer-independent TANGENT vertex attributes for primitive '${primitive.meshHandleKey}' because its glTF material uses normalTexture without authored TANGENT data.`,
    }));
    return {
        semantic: "TANGENT",
        accessorIndex: -1,
        bufferIndex: -1,
        sourceByteOffset: 0,
        sourceByteLength: 0,
        expectedFormat: "float32x4",
        itemSize: 4,
        array: tangents,
    };
}
function tangentDiagnostic(primitive, code, input) {
    return {
        code,
        severity: "warning",
        meshHandleKey: primitive.meshHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
        semantic: "TANGENT",
        ...input,
    };
}
//# sourceMappingURL=gltf-mesh-tangents.js.map