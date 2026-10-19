import { ApertureSystemError } from "../errors.js";
import type { SphereMeshDescriptorOptions } from "./types.js";

// The facade uses one segments control; the render factory has two axes.
const optionNames = [
  "radius",
  "segments",
] as const satisfies readonly (keyof SphereMeshDescriptorOptions)[];
const optionKeys = new Set<string>(optionNames);
const sphereSuggestedFix =
  "Use radius for the sphere size and segments for both width and height subdivisions. Accepted mesh.sphere() options: " +
  optionNames.join(", ") +
  ".";

/** Share actionable diagnostics between descriptor creation and raw CPU spawning. */
export function validateSpherePrimitiveOptions(options: unknown): void {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw invalidSphereOptions("options", "Sphere options must be an object.");
  }
  const unsupported = Object.keys(options).filter(
    (key) => !optionKeys.has(key),
  );
  if (unsupported.length > 0) {
    throw invalidSphereOptions(
      unsupported[0]!,
      `Unsupported sphere options: ${unsupported.map((key) => JSON.stringify(key)).join(", ")}.`,
    );
  }
}

function invalidSphereOptions(
  path: string,
  reason: string,
): ApertureSystemError {
  const diagnostic = {
    code: "aperture.spawn.invalidSphereMesh",
    message: `mesh.sphere() ${reason}`,
    suggestedFix: sphereSuggestedFix,
  };
  return new ApertureSystemError(
    diagnostic.code,
    diagnostic.message,
    diagnostic.suggestedFix,
    { path },
  );
}
