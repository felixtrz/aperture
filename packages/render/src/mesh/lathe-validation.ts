import type { LatheMeshOptions } from "./lathe-types.js";

/** Invalid lathe input, with a stable field, profile point, or segment path. */
export class LatheMeshError extends RangeError {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path} ${reason}`);
    this.name = "LatheMeshError";
    this.path = path;
  }
}

export function readLatheProfile(options: LatheMeshOptions): {
  readonly label: string;
  readonly profile: readonly (readonly [number, number])[];
  readonly radialSegments: number;
} {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new LatheMeshError(
      "options",
      "must be an object containing a profile array.",
    );
  }
  const label = options.label;
  if (label !== undefined && typeof label !== "string") {
    throw new LatheMeshError(
      "label",
      "must be a string; omit it to use the default label.",
    );
  }
  const requestedSegments = options.radialSegments;
  const radialSegments =
    requestedSegments === undefined ? 32 : requestedSegments;
  if (
    !Number.isInteger(radialSegments) ||
    radialSegments < 3 ||
    radialSegments > 128
  ) {
    throw new LatheMeshError(
      "radialSegments",
      "must be an integer from 3 through 128; omit it to use 32.",
    );
  }
  const source: unknown = options.profile;
  if (!Array.isArray(source) || source.length < 2) {
    throw new LatheMeshError(
      "profile",
      "must be an array of at least two [radius, y] points.",
    );
  }
  const profile: [number, number][] = [];
  for (let i = 0; i < source.length; i += 1) {
    const point: unknown = source[i];
    const path = `profile[${i}]`;
    if (!Array.isArray(point) || point.length !== 2) {
      throw new LatheMeshError(
        path,
        "must be an ordinary array containing exactly [radius, y].",
      );
    }
    const rawRadius: unknown = point[0];
    const radius = readFloat32(rawRadius, `${path}[0]`);
    const y = readFloat32(point[1], `${path}[1]`);
    if (
      (rawRadius as number) < 0 ||
      ((rawRadius as number) > 0 && radius === 0)
    ) {
      throw new LatheMeshError(
        `${path}[0]`,
        "must be nonnegative and a positive radius must remain positive after float32 conversion; increase tiny radii.",
      );
    }
    if (radius === 0 && i !== 0 && i !== source.length - 1) {
      throw new LatheMeshError(
        `${path}[0]`,
        "may be zero only at the first or last profile point; split surfaces that touch the axis internally.",
      );
    }
    const previous = profile[i - 1];
    if (previous !== undefined && radius === previous[0] && y === previous[1]) {
      throw new LatheMeshError(
        path,
        `duplicates profile[${i - 1}] after float32 conversion; separate or remove consecutive identical points.`,
      );
    }
    profile.push([radius, y]);
  }
  if (profile.every(([radius]) => radius === 0)) {
    throw new LatheMeshError(
      "profile",
      "must contain a positive radius; an all-axis profile has no surface.",
    );
  }
  return { label: label ?? "Lathe", profile, radialSegments };
}

function readFloat32(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isFinite(Math.fround(value))
  ) {
    throw new LatheMeshError(
      path,
      "must be a finite number representable as float32; use smaller local coordinates and a transform.",
    );
  }
  return Math.fround(value);
}
