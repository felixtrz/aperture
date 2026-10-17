import {
  createPolygonMeshAsset,
  PolygonMeshError,
  type PolygonMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

export function createPolygonPrimitiveMeshAsset(
  options: PolygonMeshOptions,
): MeshAsset {
  try {
    return createPolygonMeshAsset(options);
  } catch (error) {
    if (!(error instanceof PolygonMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidPolygonMesh",
      message: `mesh.polygons() ${error.message}`,
      suggestedFix:
        "Author planar faces with finite float32 corners and counterclockwise outer boundaries. Keep holes disjoint and strictly inside their face. Split bent surfaces into planar faces; omit duplicate and collinear corners.",
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
    );
  }
}
