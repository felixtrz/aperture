import type { TorusMeshOptions } from "./types.js";

const optionNames = [
  "label",
  "majorRadius",
  "tubeRadius",
  "radialSegments",
  "tubeSegments",
] as const satisfies readonly (keyof TorusMeshOptions)[];
const optionKeys = new Set<string>(optionNames);
const suggestedFix =
  "Use majorRadius for the main ring radius, tubeRadius for tube thickness, radialSegments around the main ring, and tubeSegments around the tube cross-section. Optional label names the mesh. Accepted options: " +
  optionNames.join(", ") +
  ".";

/** Unsupported torus authoring input, before any geometry is generated. */
export class TorusMeshError extends TypeError {
  readonly suggestedFix = suggestedFix;

  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(`${reason} ${suggestedFix}`);
    this.name = "TorusMeshError";
  }
}

/** Check option names without changing the factory's existing value normalization. */
export function validateTorusMeshOptionKeys(options: unknown): void {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new TorusMeshError("options", "Torus options must be an object.");
  }
  // Match the descriptor's own enumerable string fields. Inherited Object
  // methods are not options; own JSON keys such as "__proto__" still are.
  const unsupported = Object.keys(options).filter(
    (key) => !optionKeys.has(key),
  );
  if (unsupported.length > 0) {
    throw new TorusMeshError(
      unsupported[0]!,
      `Unsupported torus options: ${unsupported.map((key) => JSON.stringify(key)).join(", ")}.`,
    );
  }
}
