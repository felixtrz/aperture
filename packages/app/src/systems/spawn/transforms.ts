import {
  LocalTransform,
  Parent,
  WorldTransform,
  createRootTransform,
  type Entity,
  type LocalTransformInput,
  type Vec3Like,
} from "@aperture-engine/simulation";
import type { SystemTransformInput } from "./types.js";

export function addTransform(
  entity: Entity,
  input: SystemTransformInput = {},
): void {
  writeTransform(entity, input);
}

export function writeTransform(
  entity: Entity,
  input: SystemTransformInput = {},
): void {
  const resolvedRotation = input.rotation ?? rotationFromTransformInput(input);
  const localInput: LocalTransformInput = {
    ...(input.translation === undefined
      ? {}
      : { translation: input.translation }),
    ...(resolvedRotation === undefined ? {} : { rotation: resolvedRotation }),
    ...(input.scale === undefined ? {} : { scale: input.scale }),
  };
  const root = createRootTransform(localInput);
  const parent = createParentInput(input.parent ?? null);
  const local = {
    translation: root.local.translation ?? [0, 0, 0],
    rotation: root.local.rotation ?? [0, 0, 0, 1],
    scale: root.local.scale ?? [1, 1, 1],
  } as const;
  const world = {
    col0: root.world.col0 ?? [1, 0, 0, 0],
    col1: root.world.col1 ?? [0, 1, 0, 0],
    col2: root.world.col2 ?? [0, 0, 1, 0],
    col3: root.world.col3 ?? [0, 0, 0, 1],
  } as const;

  if (entity.hasComponent(LocalTransform)) {
    entity.getVectorView(LocalTransform, "translation").set(local.translation);
    entity.getVectorView(LocalTransform, "rotation").set(local.rotation);
    entity.getVectorView(LocalTransform, "scale").set(local.scale);
  } else {
    entity.addComponent(LocalTransform, local);
  }

  if (entity.hasComponent(Parent)) {
    entity.setValue(Parent, "entity", parent.entity);
  } else {
    entity.addComponent(Parent, parent);
  }

  if (entity.hasComponent(WorldTransform)) {
    entity.getVectorView(WorldTransform, "col0").set(world.col0);
    entity.getVectorView(WorldTransform, "col1").set(world.col1);
    entity.getVectorView(WorldTransform, "col2").set(world.col2);
    entity.getVectorView(WorldTransform, "col3").set(world.col3);
  } else {
    entity.addComponent(WorldTransform, world);
  }
}

function createParentInput(parent: Entity | null): {
  readonly entity: Entity | null;
} {
  return { entity: parent };
}

function rotationFromTransformInput(
  input: SystemTransformInput,
): readonly [number, number, number, number] | undefined {
  if (input.rotationEulerDegrees !== undefined) {
    return quatFromEulerDegrees(input.rotationEulerDegrees);
  }

  if (input.lookAt !== undefined && input.translation !== undefined) {
    return quatLookAt(input.translation, input.lookAt);
  }

  return undefined;
}

function quatFromEulerDegrees(
  degrees: Vec3Like,
): readonly [number, number, number, number] {
  const x = (read3(degrees, 0) * Math.PI) / 180;
  const y = (read3(degrees, 1) * Math.PI) / 180;
  const z = (read3(degrees, 2) * Math.PI) / 180;
  const sx = Math.sin(x / 2);
  const cx = Math.cos(x / 2);
  const sy = Math.sin(y / 2);
  const cy = Math.cos(y / 2);
  const sz = Math.sin(z / 2);
  const cz = Math.cos(z / 2);

  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

/**
 * Build the look-at orientation quaternion used by `spawn.camera({ transform:
 * { translation, lookAt } })`. Exported so reusable controllers (the orbit
 * camera) compose the camera rotation with the exact same convention (forward
 * down -Z, world-up [0,1,0]) as the spawn path.
 */
export function quatLookAt(
  translation: Vec3Like,
  target: Vec3Like,
): readonly [number, number, number, number] {
  const dx = read3(target, 0) - read3(translation, 0);
  const dy = read3(target, 1) - read3(translation, 1);
  const dz = read3(target, 2) - read3(translation, 2);
  const length = Math.hypot(dx, dy, dz);

  if (length <= 1e-6) {
    return [0, 0, 0, 1];
  }

  const forward: [number, number, number] = [
    dx / length,
    dy / length,
    dz / length,
  ];
  let right = normalize3(cross3([0, 1, 0], negate3(forward)));

  if (right === null) {
    right = [1, 0, 0];
  }

  const up = cross3(negate3(forward), right);
  const back = negate3(forward);

  return quatFromBasis(right, up, back);
}

function negate3(
  value: readonly [number, number, number],
): [number, number, number] {
  return [-value[0], -value[1], -value[2]];
}

function cross3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(
  value: readonly [number, number, number],
): [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= 1e-6) {
    return null;
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function quatFromBasis(
  right: readonly [number, number, number],
  up: readonly [number, number, number],
  back: readonly [number, number, number],
): readonly [number, number, number, number] {
  const m00 = right[0];
  const m01 = up[0];
  const m02 = back[0];
  const m10 = right[1];
  const m11 = up[1];
  const m12 = back[1];
  const m20 = right[2];
  const m21 = up[2];
  const m22 = back[2];
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  }

  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }

  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }

  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

function read3(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}
