import type { RenderSnapshot } from "@aperture-engine/render";
import {
  composeTrsMatrix,
  decomposeTrsMatrix,
  LocalTransform,
  type EcsWorld,
  type Entity,
  type Mat4Like,
  type Vec3Like,
} from "@aperture-engine/simulation";
import { PhysicsBodyState, slerpQuat } from "@aperture-engine/physics";

export interface PhysicsSnapshotInterpolationReport {
  readonly enabled: boolean;
  readonly alpha: number;
  readonly transformWrites: number;
}

export function applyPhysicsSnapshotInterpolation(options: {
  readonly snapshot: RenderSnapshot;
  readonly world: EcsWorld;
  readonly alpha: number;
}): PhysicsSnapshotInterpolationReport {
  const alpha = clampAlpha(options.alpha);
  let transformWrites = 0;
  const writtenOffsets = new Set<number>();

  for (const draw of options.snapshot.meshDraws) {
    transformWrites += writeInterpolatedPacketTransform({
      world: options.world,
      transforms: options.snapshot.transforms,
      entityRef: draw.entity,
      offset: draw.worldTransformOffset,
      alpha,
      writtenOffsets,
    });
  }

  for (const draw of options.snapshot.spriteDraws ?? []) {
    transformWrites += writeInterpolatedPacketTransform({
      world: options.world,
      transforms: options.snapshot.transforms,
      entityRef: draw.entity,
      offset: draw.worldTransformOffset,
      alpha,
      writtenOffsets,
    });
  }

  for (const emitter of options.snapshot.particleEmitters ?? []) {
    transformWrites += writeInterpolatedPacketTransform({
      world: options.world,
      transforms: options.snapshot.transforms,
      entityRef: emitter.entity,
      offset: emitter.worldTransformOffset,
      alpha,
      writtenOffsets,
    });
  }

  return {
    enabled: true,
    alpha,
    transformWrites,
  };
}

function writeInterpolatedPacketTransform(options: {
  readonly world: EcsWorld;
  readonly transforms: Float32Array;
  readonly entityRef: { readonly index: number; readonly generation: number };
  readonly offset: number;
  readonly alpha: number;
  readonly writtenOffsets: Set<number>;
}): number {
  if (
    options.writtenOffsets.has(options.offset) ||
    options.offset < 0 ||
    options.offset + 16 > options.transforms.length
  ) {
    return 0;
  }

  const entity = resolveSnapshotEntity(options.world, options.entityRef);

  if (entity === null || !entity.hasComponent(PhysicsBodyState)) {
    return 0;
  }

  const currentMatrix = Array.from(
    options.transforms.slice(options.offset, options.offset + 16),
  );
  const decomposed = decomposeTrsMatrix(currentMatrix);

  if (decomposed === null) {
    return 0;
  }

  const translation = lerpVec3(
    entity.getVectorView(PhysicsBodyState, "previousTranslation"),
    entity.getVectorView(PhysicsBodyState, "currentTranslation"),
    options.alpha,
  );
  const rotation = slerpQuat(
    entity.getVectorView(PhysicsBodyState, "previousRotation"),
    entity.getVectorView(PhysicsBodyState, "currentRotation"),
    options.alpha,
  );
  const matrix = composeTrsMatrix(
    translation,
    rotation,
    entity.hasComponent(LocalTransform)
      ? entity.getVectorView(LocalTransform, "scale")
      : decomposed.scale,
  );

  options.transforms.set(matrix, options.offset);
  options.writtenOffsets.add(options.offset);
  return 1;
}

function resolveSnapshotEntity(
  world: EcsWorld,
  ref: { readonly index: number; readonly generation: number },
): Entity | null {
  if (
    !Number.isInteger(ref.index) ||
    !Number.isInteger(ref.generation) ||
    ref.index < 0 ||
    ref.generation < 0
  ) {
    return null;
  }

  const entity = world.entityManager.getEntityByIndex(ref.index);

  if (
    entity === null ||
    !entity.active ||
    entity.generation !== ref.generation
  ) {
    return null;
  }

  return entity;
}

function lerpVec3(
  previous: Vec3Like,
  current: Vec3Like,
  alpha: number,
): [number, number, number] {
  return [
    lerp(read(previous, 0), read(current, 0), alpha),
    lerp(read(previous, 1), read(current, 1), alpha),
    lerp(read(previous, 2), read(current, 2), alpha),
  ];
}

function lerp(left: number, right: number, alpha: number): number {
  return left + (right - left) * alpha;
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function read(values: Mat4Like | Vec3Like, index: number): number {
  return values[index] ?? 0;
}
