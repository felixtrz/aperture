import { createTriangleListMeshAsset, TriangleListMeshError, } from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";
export function createTriangleListPrimitiveMeshAsset(options) {
    try {
        return createTriangleListMeshAsset(options);
    }
    catch (error) {
        if (!(error instanceof TriangleListMeshError))
            throw error;
        const diagnostic = {
            code: "aperture.spawn.invalidTriangleListMesh",
            message: `mesh.triangleList() ${error.message}`,
            suggestedFix: "Provide finite position tuples or packed Float32Array coordinates and complete, nondegenerate triangles. Match optional normals, uvs and tangents to source positions, and keep indices in range. Tangents require explicit normals, a nonzero nonparallel direction and handedness +1 or -1.",
        };
        throw new ApertureSystemError(diagnostic.code, diagnostic.message, diagnostic.suggestedFix, { path: error.path });
    }
}
//# sourceMappingURL=triangle-list.js.map