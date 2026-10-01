import {
  createTriangleListMeshAsset,
  TriangleListMeshError,
  type MeshAsset,
  type TriangleListMeshOptions,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

export function createTriangleListPrimitiveMeshAsset(
  options: TriangleListMeshOptions,
): MeshAsset {
  try {
    return createTriangleListMeshAsset(options);
  } catch (error) {
    if (!(error instanceof TriangleListMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidTriangleListMesh",
      message: `mesh.triangleList() ${error.message}`,
      suggestedFix:
        "Provide finite float32 position tuples and complete, nondegenerate triangles. Match optional normals and uvs to source positions, and keep indices in range.",
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
    );
  }
}
