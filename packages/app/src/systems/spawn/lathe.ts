import {
  createLatheMeshAsset,
  LatheMeshError,
  type LatheMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

export function createLathePrimitiveMeshAsset(
  options: LatheMeshOptions,
): MeshAsset {
  try {
    return createLatheMeshAsset(options);
  } catch (error) {
    if (!(error instanceof LatheMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidLatheMesh",
      message: `mesh.lathe() ${error.message}`,
      suggestedFix:
        "Provide at least two finite float32 [radius, y] profile points with nonnegative radii, axis points only at endpoints, and radialSegments from 3 through 128. Separate collapsed points or use fewer segments.",
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
    );
  }
}
