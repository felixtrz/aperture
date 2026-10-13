import type { HeightfieldMeshOptions } from "./heightfield-types.js";

/** Invalid heightfield input, with a stable field, row, or sample location. */
export class HeightfieldMeshError extends RangeError {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path} ${reason}`);
    this.name = "HeightfieldMeshError";
    this.path = path;
  }
}

export interface HeightfieldGrid {
  readonly heights: readonly (readonly number[])[];
  readonly x: readonly number[];
  readonly z: readonly number[];
}

export function readHeightfieldGrid(
  options: HeightfieldMeshOptions,
): HeightfieldGrid {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new HeightfieldMeshError("options", "must be an object.");
  }
  if (options.label !== undefined && typeof options.label !== "string") {
    throw new HeightfieldMeshError("label", "must be a string.");
  }
  const source: unknown = options.heights;
  if (!Array.isArray(source) || source.length < 2) {
    throw new HeightfieldMeshError(
      "heights",
      "must be a rectangular array with at least two rows and two columns.",
    );
  }
  const heights: number[][] = [];
  let columns = 0;
  for (let row = 0; row < source.length; row += 1) {
    const values: unknown = source[row];
    const path = `heights[${row}]`;
    if (!Array.isArray(values) || values.length < 2) {
      throw new HeightfieldMeshError(
        path,
        "must be an array with at least two height samples.",
      );
    }
    if (row === 0) columns = values.length;
    if (values.length !== columns) {
      throw new HeightfieldMeshError(
        path,
        `must have exactly ${columns} columns to match heights[0].`,
      );
    }
    const samples: number[] = [];
    for (let column = 0; column < columns; column += 1) {
      samples.push(readFloat32(values[column], `${path}[${column}]`));
    }
    heights.push(samples);
  }
  return {
    heights,
    x: readAxis(options.width, "width", columns, "columns"),
    z: readAxis(options.depth, "depth", heights.length, "rows"),
  };
}

function readFloat32(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isFinite(Math.fround(value))
  ) {
    throw new HeightfieldMeshError(
      path,
      "must be a finite number representable as float32.",
    );
  }
  return Math.fround(value);
}

function readAxis(
  value: unknown,
  path: "width" | "depth",
  count: number,
  entries: "columns" | "rows",
): number[] {
  const size = value === undefined ? 1 : value;
  const rounded = readFloat32(size, path);
  if (rounded <= 0) {
    throw new HeightfieldMeshError(
      path,
      "must be positive after float32 conversion.",
    );
  }
  const coordinates: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const coordinate = Math.fround((index / (count - 1) - 0.5) * rounded);
    if (index > 0 && coordinate <= coordinates[index - 1]!) {
      throw new HeightfieldMeshError(
        path,
        `collapses ${entries} ${index - 1} and ${index} after float32 conversion; use a larger extent or fewer samples.`,
      );
    }
    coordinates.push(coordinate);
  }
  return coordinates;
}
