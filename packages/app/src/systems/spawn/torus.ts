import {
  TorusMeshError,
  validateTorusMeshOptionKeys,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

/** Share actionable diagnostics between descriptor creation and raw CPU spawning. */
export function validateTorusPrimitiveOptions(options: unknown): void {
  try {
    validateTorusMeshOptionKeys(options);
  } catch (error) {
    if (!(error instanceof TorusMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidTorusMesh",
      message: `mesh.torus() ${error.reason}`,
      suggestedFix: error.suggestedFix,
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
    );
  }
}
