import {
  createExtrudeMeshAsset,
  ExtrudeMeshError,
  type ExtrudeMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

export function createExtrudePrimitiveMeshAsset(
  options: ExtrudeMeshOptions,
): MeshAsset {
  try {
    return createExtrudeMeshAsset(options);
  } catch (error) {
    if (!(error instanceof ExtrudeMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidExtrudeMesh",
      message: `mesh.extrude() ${error.message}`,
      suggestedFix:
        "Provide a simple XY outline and disjoint holes strictly inside it, with at least three non-collinear finite float32 vertices per ring and positive depth. Omit repeated closing vertices; use at most 2048 total vertices.",
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
    );
  }
}
