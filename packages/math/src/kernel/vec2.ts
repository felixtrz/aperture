// Aperture in-house vec2 kernel.

import { allocVec2 } from "./alloc.js";
import type { NumArray, T2, Vec2 } from "./types.js";

export function create(x = 0, y = 0): Vec2 {
  const d = allocVec2();
  d[0] = x;
  d[1] = y;
  return d;
}

export function set(x: number, y: number, dst?: Float32Array): Vec2 {
  const d = allocVec2(dst);
  d[0] = x;
  d[1] = y;
  return d;
}

export function copy(vIn: NumArray, dst?: Float32Array): Vec2 {
  const v = vIn as unknown as T2;
  const d = allocVec2(dst);
  d[0] = v[0];
  d[1] = v[1];
  return d;
}

export function add(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec2 {
  const a = aIn as unknown as T2;
  const b = bIn as unknown as T2;
  const d = allocVec2(dst);
  d[0] = a[0] + b[0];
  d[1] = a[1] + b[1];
  return d;
}

export function subtract(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Vec2 {
  const a = aIn as unknown as T2;
  const b = bIn as unknown as T2;
  const d = allocVec2(dst);
  d[0] = a[0] - b[0];
  d[1] = a[1] - b[1];
  return d;
}

export { subtract as sub };

export function scale(vIn: NumArray, k: number, dst?: Float32Array): Vec2 {
  const v = vIn as unknown as T2;
  const d = allocVec2(dst);
  d[0] = v[0] * k;
  d[1] = v[1] * k;
  return d;
}

export function dot(aIn: NumArray, bIn: NumArray): number {
  const a = aIn as unknown as T2;
  const b = bIn as unknown as T2;
  return a[0] * b[0] + a[1] * b[1];
}

export function lengthSq(vIn: NumArray): number {
  const v = vIn as unknown as T2;
  const x = v[0];
  const y = v[1];
  return x * x + y * y;
}

export function length(v: NumArray): number {
  return Math.sqrt(lengthSq(v));
}

export { length as len };

export function normalize(vIn: NumArray, dst?: Float32Array): Vec2 {
  const v = vIn as unknown as T2;
  const d = allocVec2(dst);
  const x = v[0];
  const y = v[1];
  const lenSq = x * x + y * y;
  const s = lenSq > 0 ? 1 / Math.sqrt(lenSq) : 1;
  d[0] = x * s;
  d[1] = y * s;
  return d;
}
