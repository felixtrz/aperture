import type { Entity, Vec2Like, Vec3Like } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";

export function entityRef(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}

export function tuple3(values: ArrayLike<number>): [number, number, number] {
  return [values[0]!, values[1]!, values[2]!];
}

export function tuple2(values: Vec2Like): [number, number] {
  return [values[0]!, values[1]!];
}

export function normalizeTuple3(
  values: ArrayLike<number>,
): [number, number, number] {
  const x = values[0]!;
  const y = values[1]!;
  const z = values[2]!;
  const length = Math.hypot(x, y, z);

  if (!Number.isFinite(length) || length <= 1e-8) {
    return [0, 0, 0];
  }

  return [x / length, y / length, z / length];
}

export function distanceBetween(a: Vec3Like, b: Vec3Like): number {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}
