import { createGltfMeshAssetDiagnostic } from "./gltf-mesh-asset-construction-diagnostics.js";
import { generateMissingTangents } from "./gltf-mesh-tangents.js";
import { generateMissingNormals } from "./gltf-mesh-normals.js";
import { decodedAttributeByteSize, isSupportedMeshAttributeArray, } from "./gltf-mesh-asset-vertex-streams.js";
export function collectGltfMeshAttributeSources(primitive, position, diagnostics, tangentRequest, generateNormals = false) {
    const sources = [{ decoded: position, offset: 0 }];
    let offset = decodedAttributeByteSize(position);
    const decodedBySemantic = new Map(primitive.attributes.map((attribute) => [attribute.semantic, attribute]));
    // Synthesize normals BEFORE tangents — tangent generation consumes NORMAL.
    if (generateNormals && !decodedBySemantic.has("NORMAL")) {
        const generated = generateMissingNormals(primitive, position);
        if (generated !== null) {
            decodedBySemantic.set("NORMAL", generated);
        }
    }
    if (tangentRequest !== undefined && !decodedBySemantic.has("TANGENT")) {
        const generated = generateMissingTangents(primitive, position, decodedBySemantic.get("NORMAL"), decodedBySemantic.get("TEXCOORD_0"), diagnostics, tangentRequest);
        if (generated !== null) {
            decodedBySemantic.set("TANGENT", generated);
        }
    }
    for (const semantic of [
        "NORMAL",
        "TEXCOORD_0",
        "JOINTS_0",
        "WEIGHTS_0",
        "MORPH_POSITION_0",
        "MORPH_NORMAL_0",
        "MORPH_POSITION_1",
        "MORPH_NORMAL_1",
        "TANGENT",
        "TEXCOORD_1",
        "COLOR_0",
    ]) {
        const decoded = decodedBySemantic.get(semantic) ??
            createZeroMorphAccessor(semantic, primitive, decodedBySemantic);
        if (decoded === undefined) {
            continue;
        }
        const count = decoded.array.length / decoded.itemSize;
        if (count !== primitive.vertexCount ||
            !isSupportedMeshAttributeArray(decoded)) {
            diagnostics.push(createGltfMeshAssetDiagnostic(primitive, "gltfMeshAsset.mismatchedAttributeCount", {
                semantic,
                vertexCount: primitive.vertexCount,
                message: `Primitive '${primitive.meshHandleKey}' ${semantic} attribute count does not match POSITION vertex count.`,
            }));
            return null;
        }
        sources.push({ decoded, offset });
        offset += decodedAttributeByteSize(decoded);
    }
    return sources;
}
function createZeroMorphAccessor(semantic, primitive, decodedBySemantic) {
    const requiredByPosition = semantic === "MORPH_NORMAL_0"
        ? decodedBySemantic.has("MORPH_POSITION_0")
        : semantic === "MORPH_POSITION_1" || semantic === "MORPH_NORMAL_1"
            ? decodedBySemantic.has("MORPH_POSITION_0")
            : false;
    if (!requiredByPosition) {
        return undefined;
    }
    return {
        semantic: semantic,
        accessorIndex: -1,
        bufferIndex: -1,
        sourceByteOffset: 0,
        sourceByteLength: 0,
        expectedFormat: "float32x3",
        itemSize: 3,
        array: new Float32Array(primitive.vertexCount * 3),
    };
}
//# sourceMappingURL=gltf-mesh-asset-construction-attributes.js.map