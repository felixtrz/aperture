import {
  createHeightfieldMeshAsset,
  HeightfieldMeshError,
  type HeightfieldMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

export function createHeightfieldPrimitiveMeshAsset(
  options: HeightfieldMeshOptions,
): MeshAsset {
  try {
    return createHeightfieldMeshAsset(options);
  } catch (error) {
    if (!(error instanceof HeightfieldMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidHeightfieldMesh",
      message: `mesh.heightfield() ${error.message}`,
      suggestedFix:
        "Provide a rectangular heights array with at least two rows and two columns of finite float32 samples. Use positive finite width/depth with distinct float32 grid coordinates.",
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
    );
  }
}
