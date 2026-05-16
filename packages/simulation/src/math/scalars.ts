import type { Vec3Like, Vec4Like } from "./types.js";

export function read(
  values: ArrayLike<number>,
  index: number,
  label: string,
): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(
      `${label} is missing numeric value at index ${index}.`,
    );
  }

  return value;
}

export function v3(values: Vec3Like, index: number): number {
  return read(values, index, "Vec3Like");
}

export function v4(values: Vec4Like, index: number): number {
  return read(values, index, "Vec4Like");
}

export function assertFinitePositive(value: number, label: string): void {
  assertFiniteNumber(value, label);

  if (value <= 0) {
    throw new RangeError(`Expected ${label} to be greater than zero.`);
  }
}

export function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Expected ${label} to be finite.`);
  }
}
