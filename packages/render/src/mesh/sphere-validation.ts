import type { SphereMeshOptions } from "./types.js";

const optionNames = [
  "label",
  "radius",
  "widthSegments",
  "heightSegments",
] as const satisfies readonly (keyof SphereMeshOptions)[];
const optionKeys = new Set<string>(optionNames);
const suggestedFix =
  "Use radius for the sphere size, widthSegments around the equator, and heightSegments from pole to pole. Optional label names the mesh. Accepted options: " +
  optionNames.join(", ") +
  ".";

/** Unsupported sphere authoring input, before any geometry is generated. */
export class SphereMeshError extends TypeError {
  readonly suggestedFix = suggestedFix;

  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(`${reason} ${suggestedFix}`);
    this.name = "SphereMeshError";
  }
}

/** Check option names without changing the factory's existing value normalization. */
export function validateSphereMeshOptionKeys(options: unknown): void {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new SphereMeshError("options", "Sphere options must be an object.");
  }
  // Match the descriptor's own enumerable string fields. Inherited Object
  // methods are not options; own JSON keys such as "__proto__" still are.
  const unsupported = Object.keys(options).filter(
    (key) => !optionKeys.has(key),
  );
  if (unsupported.length > 0) {
    throw new SphereMeshError(
      unsupported[0]!,
      `Unsupported sphere options: ${unsupported.map((key) => JSON.stringify(key)).join(", ")}.`,
    );
  }
}
