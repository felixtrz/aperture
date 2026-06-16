import type { Vec3Like } from "./types.js";

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

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function inverseLerp(
  value: number,
  inMin: number,
  inMax: number,
): number {
  const span = inMax - inMin;
  return span === 0 ? 0 : (value - inMin) / span;
}

export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, inverseLerp(value, inMin, inMax));
}

export function remapClamped(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, clamp01(inverseLerp(value, inMin, inMax)));
}

export function expSmoothingAlpha(delta: number, smoothing: number): number {
  return 1 - Math.exp(-Math.max(0, delta) * Math.max(0, smoothing));
}

export function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;

  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  return from + diff * t;
}

export function hexColor(
  hex: number,
  alpha = 1,
): [number, number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
    alpha,
  ];
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
