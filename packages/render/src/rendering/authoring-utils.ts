import type { Vec4Like } from "@aperture-engine/simulation";
import type {
  RenderAuthoringDiagnostic,
  SpriteInput,
} from "./authoring-types.js";

export function validateRect(
  rect: readonly [number, number, number, number],
  field: string,
  diagnostics: RenderAuthoringDiagnostic[],
): void {
  if (
    rect.some((value) => !Number.isFinite(value)) ||
    rect[2] < 0 ||
    rect[3] < 0
  ) {
    diagnostics.push({
      code: "camera.invalidViewport",
      field,
      message: `${field} values must be finite with non-negative width and height.`,
    });
  }
}

export function toTuple4(values: Vec4Like): [number, number, number, number] {
  return [read(values, 0), read(values, 1), read(values, 2), read(values, 3)];
}

export function tuple4(
  x: number,
  y: number,
  z: number,
  w: number,
): [number, number, number, number] {
  return [x, y, z, w];
}

export function tuple2(x: number, y: number): [number, number] {
  return [x, y];
}

export function spriteSize(
  size: SpriteInput["size"],
): readonly [number, number] {
  if (size === undefined) {
    return [1, 1];
  }

  return typeof size === "number" ? [size, size] : [size[0] ?? 1, size[1] ?? 1];
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}
