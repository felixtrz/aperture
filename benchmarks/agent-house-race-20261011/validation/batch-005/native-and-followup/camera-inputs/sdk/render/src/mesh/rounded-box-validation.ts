import type { RoundedBoxMeshOptions } from "./rounded-box-types.js";

export class RoundedBoxMeshError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`Rounded box ${path} ${message}`);
    this.name = "RoundedBoxMeshError";
    this.path = path;
  }
}

/** Validate authoring parameters without allocating geometry. */
export function validateRoundedBoxMeshOptions(
  options: RoundedBoxMeshOptions = {},
): void {
  readRoundedBoxOptions(options);
}

export function readRoundedBoxOptions(options: RoundedBoxMeshOptions) {
  if (typeof options !== "object" || options === null) {
    throw new RoundedBoxMeshError("options", "must be an options object.");
  }
  const extents =
    options.halfExtents === undefined ? [0.5, 0.5, 0.5] : options.halfExtents;
  if (
    !(Array.isArray(extents) || ArrayBuffer.isView(extents)) ||
    extents.length !== 3
  ) {
    throw new RoundedBoxMeshError(
      "halfExtents",
      "must contain exactly three positive finite local dimensions.",
    );
  }
  const halfExtents: [number, number, number] = [
    extents[0],
    extents[1],
    extents[2],
  ];
  for (let axis = 0; axis < 3; axis++) {
    const value = halfExtents[axis]!;
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      !Number.isFinite(Math.fround(value)) ||
      Math.fround(value) === 0
    ) {
      throw new RoundedBoxMeshError(
        `halfExtents[${axis}]`,
        "must be positive, finite and representable in float32 geometry.",
      );
    }
  }
  if (!Number.isFinite(Math.fround(Math.hypot(...halfExtents)))) {
    throw new RoundedBoxMeshError(
      "halfExtents",
      "span a bounding sphere too large for finite float32 storage; use smaller local dimensions and a transform.",
    );
  }
  const minimum = Math.min(...halfExtents);
  const radius = options.radius === undefined ? minimum * 0.1 : options.radius;
  if (
    !Number.isFinite(radius) ||
    radius < 0 ||
    radius > minimum ||
    (radius > 0 && Math.fround(radius) === 0)
  ) {
    throw new RoundedBoxMeshError(
      "radius",
      "must be finite, nonnegative, no larger than the smallest half-extent, and representable in float32 geometry.",
    );
  }
  const bevelSegments =
    options.bevelSegments === undefined ? 3 : options.bevelSegments;
  if (
    !Number.isInteger(bevelSegments) ||
    bevelSegments < 1 ||
    bevelSegments > 32
  ) {
    throw new RoundedBoxMeshError(
      "bevelSegments",
      "must be an integer from 1 through 32.",
    );
  }
  return { halfExtents, radius, bevelSegments, label: options.label };
}
