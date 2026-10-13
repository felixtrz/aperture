import {
  createRoundedBoxMeshAsset,
  RoundedBoxMeshError,
  validateRoundedBoxMeshOptions,
  type MeshAsset,
  type RoundedBoxMeshOptions,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

export function validateRoundedBoxDescriptor(
  options: RoundedBoxMeshOptions,
): void {
  withRoundedBoxDiagnostic(() => validateRoundedBoxMeshOptions(options));
}

export function createRoundedBoxPrimitiveMeshAsset(
  options: RoundedBoxMeshOptions,
): MeshAsset {
  return withRoundedBoxDiagnostic(() => createRoundedBoxMeshAsset(options));
}

function withRoundedBoxDiagnostic<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (!(error instanceof RoundedBoxMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidRoundedBoxMesh",
      message: `mesh.roundedBox() ${error.message}`,
      suggestedFix:
        "Provide three positive finite halfExtents, radius from 0 through the smallest half-extent, and integer bevelSegments from 1 through 32. For tiny bevels, increase radius relative to the extents or reduce segments; use radius 0 for an exact flat box.",
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
      { cause: error },
    );
  }
}
