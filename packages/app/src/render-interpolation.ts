import type { RenderSnapshot } from "@aperture-engine/render";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  composeTrsMatrix,
  invertMat4,
  multiplyMat4,
  type EcsWorld,
  type Entity,
  type Mat4,
  type Mat4Like,
  type QuatLike,
  type Vec3Like,
} from "@aperture-engine/simulation";
import { slerpQuat } from "@aperture-engine/physics";
import { RenderInterpolation } from "./systems/components.js";
import type { FixedStepTaskRegistrar } from "./systems/fixed-step.js";
import { rewriteInterpolatedPacketBounds } from "./snapshot-interpolation-bounds.js";

export const RENDER_INTERPOLATION_PRE_PRIORITY = -1_000_000_000;
export const RENDER_INTERPOLATION_POST_PRIORITY = 1_000_000_000;

export interface RenderSnapshotInterpolationReport {
  readonly enabled: boolean;
  readonly alpha: number;
  readonly transformWrites: number;
  readonly boundsWrites: number;
  readonly viewWrites: number;
}

export function installRenderInterpolationFixedStep(options: {
  readonly world: EcsWorld;
  readonly registerFixedStepTask: FixedStepTaskRegistrar;
}): () => void {
  const unregisterPrepare = options.registerFixedStepTask(
    () => prepareRenderInterpolationFixedStep(options.world),
    { priority: RENDER_INTERPOLATION_PRE_PRIORITY },
  );
  const unregisterCommit = options.registerFixedStepTask(
    () => commitRenderInterpolationFixedStep(options.world),
    { priority: RENDER_INTERPOLATION_POST_PRIORITY },
  );

  return () => {
    unregisterPrepare();
    unregisterCommit();
  };
}

export function prepareRenderInterpolationFixedStep(world: EcsWorld): void {
  for (const entity of renderInterpolationEntities(world)) {
    if (!renderInterpolationEnabled(entity)) {
      continue;
    }

    if (entity.getValue(RenderInterpolation, "initialized") === true) {
      copyVectorField(entity, "currentTranslation", "previousTranslation");
      copyVectorField(entity, "currentRotation", "previousRotation");
      copyVectorField(entity, "currentScale", "previousScale");
    } else {
      copyLocalToInterpolation(entity, "previous");
      copyLocalToInterpolation(entity, "current");
      entity.setValue(RenderInterpolation, "initialized", true);
    }
  }
}

export function commitRenderInterpolationFixedStep(world: EcsWorld): void {
  for (const entity of renderInterpolationEntities(world)) {
    if (!renderInterpolationEnabled(entity)) {
      continue;
    }

    if (entity.getValue(RenderInterpolation, "initialized") !== true) {
      copyLocalToInterpolation(entity, "previous");
      entity.setValue(RenderInterpolation, "initialized", true);
    }

    copyLocalToInterpolation(entity, "current");
  }
}

export function applyRenderSnapshotInterpolation(options: {
  readonly snapshot: RenderSnapshot;
  readonly world: EcsWorld;
  readonly alpha: number;
}): RenderSnapshotInterpolationReport {
  const alpha = clampAlpha(options.alpha);
  const matrixCache = new Map<string, Mat4 | null>();
  const affectedCache = new Map<string, boolean>();
  const writtenOffsets = new Set<number>();
  const writtenBounds = new Set<number>();
  const affectedVisiting = new Set<string>();
  const matrixVisiting = new Set<string>();
  let transformWrites = 0;
  let boundsWrites = 0;
  let viewWrites = 0;

  for (const draw of options.snapshot.meshDraws) {
    const writes = writeInterpolatedPacketTransform({
      snapshot: options.snapshot,
      world: options.world,
      transforms: options.snapshot.transforms,
      entityRef: draw.entity,
      offset: draw.worldTransformOffset,
      boundsIndex: draw.boundsIndex,
      alpha,
      matrixCache,
      affectedCache,
      affectedVisiting,
      matrixVisiting,
      writtenOffsets,
      writtenBounds,
    });
    transformWrites += writes.transformWrites;
    boundsWrites += writes.boundsWrites;
  }

  for (const draw of options.snapshot.shadowCasterDraws ?? []) {
    const writes = writeInterpolatedPacketTransform({
      snapshot: options.snapshot,
      world: options.world,
      transforms: options.snapshot.transforms,
      entityRef: draw.entity,
      offset: draw.worldTransformOffset,
      boundsIndex: draw.boundsIndex,
      alpha,
      matrixCache,
      affectedCache,
      affectedVisiting,
      matrixVisiting,
      writtenOffsets,
      writtenBounds,
    });
    transformWrites += writes.transformWrites;
    boundsWrites += writes.boundsWrites;
  }

  for (const draw of options.snapshot.spriteDraws ?? []) {
    const writes = writeInterpolatedPacketTransform({
      snapshot: options.snapshot,
      world: options.world,
      transforms: options.snapshot.transforms,
      entityRef: draw.entity,
      offset: draw.worldTransformOffset,
      boundsIndex: draw.boundsIndex,
      alpha,
      matrixCache,
      affectedCache,
      affectedVisiting,
      matrixVisiting,
      writtenOffsets,
      writtenBounds,
    });
    transformWrites += writes.transformWrites;
    boundsWrites += writes.boundsWrites;
  }

  for (const emitter of options.snapshot.particleEmitters ?? []) {
    const writes = writeInterpolatedPacketTransform({
      snapshot: options.snapshot,
      world: options.world,
      transforms: options.snapshot.transforms,
      entityRef: emitter.entity,
      offset: emitter.worldTransformOffset,
      boundsIndex: emitter.boundsIndex,
      alpha,
      matrixCache,
      affectedCache,
      affectedVisiting,
      matrixVisiting,
      writtenOffsets,
      writtenBounds,
    });
    transformWrites += writes.transformWrites;
    boundsWrites += writes.boundsWrites;
  }

  for (const view of options.snapshot.views) {
    viewWrites += writeInterpolatedViewMatrices({
      world: options.world,
      viewMatrices: options.snapshot.viewMatrices,
      entityRef: view.camera,
      viewOffset: view.viewMatrixOffset,
      projectionOffset: view.projectionMatrixOffset,
      viewProjectionOffset: view.viewProjectionMatrixOffset,
      alpha,
      matrixCache,
      affectedCache,
      affectedVisiting,
      matrixVisiting,
    });
  }

  return {
    enabled: true,
    alpha,
    transformWrites,
    boundsWrites,
    viewWrites,
  };
}

interface PacketInterpolationWrites {
  readonly transformWrites: number;
  readonly boundsWrites: number;
}

function writeInterpolatedPacketTransform(options: {
  readonly snapshot: RenderSnapshot;
  readonly world: EcsWorld;
  readonly transforms: Float32Array;
  readonly entityRef: { readonly index: number; readonly generation: number };
  readonly offset: number;
  readonly boundsIndex: number;
  readonly alpha: number;
  readonly matrixCache: Map<string, Mat4 | null>;
  readonly affectedCache: Map<string, boolean>;
  readonly affectedVisiting: Set<string>;
  readonly matrixVisiting: Set<string>;
  readonly writtenOffsets: Set<number>;
  readonly writtenBounds: Set<number>;
}): PacketInterpolationWrites {
  if (!matrixOffsetValid(options.transforms, options.offset)) {
    return noPacketWrites();
  }

  const offsetWritten = options.writtenOffsets.has(options.offset);
  const boundsWritten = options.writtenBounds.has(options.boundsIndex);

  if (offsetWritten && boundsWritten) {
    return noPacketWrites();
  }

  const entity = resolveSnapshotEntity(options.world, options.entityRef);

  options.affectedVisiting.clear();
  if (
    entity === null ||
    !interpolationAffectsWorldMatrix(
      entity,
      options.affectedCache,
      options.affectedVisiting,
    )
  ) {
    options.affectedVisiting.clear();
    return noPacketWrites();
  }
  options.affectedVisiting.clear();

  options.matrixVisiting.clear();
  const matrix = interpolatedWorldMatrix(
    entity,
    options.alpha,
    options.matrixCache,
    options.affectedCache,
    options.affectedVisiting,
    options.matrixVisiting,
  );
  options.affectedVisiting.clear();
  options.matrixVisiting.clear();

  if (matrix === null) {
    return noPacketWrites();
  }

  let transformWrites = 0;

  if (!offsetWritten) {
    options.transforms.set(matrix, options.offset);
    options.writtenOffsets.add(options.offset);
    transformWrites = 1;
  }

  return {
    transformWrites,
    boundsWrites: rewriteInterpolatedPacketBounds({
      snapshot: options.snapshot,
      boundsIndex: options.boundsIndex,
      worldMatrix: matrix,
      writtenBounds: options.writtenBounds,
    }),
  };
}

function noPacketWrites(): PacketInterpolationWrites {
  return { transformWrites: 0, boundsWrites: 0 };
}

function writeInterpolatedViewMatrices(options: {
  readonly world: EcsWorld;
  readonly viewMatrices: Float32Array;
  readonly entityRef: { readonly index: number; readonly generation: number };
  readonly viewOffset: number;
  readonly projectionOffset: number;
  readonly viewProjectionOffset: number;
  readonly alpha: number;
  readonly matrixCache: Map<string, Mat4 | null>;
  readonly affectedCache: Map<string, boolean>;
  readonly affectedVisiting: Set<string>;
  readonly matrixVisiting: Set<string>;
}): number {
  if (
    !matrixOffsetValid(options.viewMatrices, options.viewOffset) ||
    !matrixOffsetValid(options.viewMatrices, options.projectionOffset) ||
    !matrixOffsetValid(options.viewMatrices, options.viewProjectionOffset)
  ) {
    return 0;
  }

  const entity = resolveSnapshotEntity(options.world, options.entityRef);

  options.affectedVisiting.clear();
  if (
    entity === null ||
    !interpolationAffectsWorldMatrix(
      entity,
      options.affectedCache,
      options.affectedVisiting,
    )
  ) {
    options.affectedVisiting.clear();
    return 0;
  }
  options.affectedVisiting.clear();

  options.matrixVisiting.clear();
  const worldMatrix = interpolatedWorldMatrix(
    entity,
    options.alpha,
    options.matrixCache,
    options.affectedCache,
    options.affectedVisiting,
    options.matrixVisiting,
  );
  options.affectedVisiting.clear();
  options.matrixVisiting.clear();
  const viewMatrix = worldMatrix === null ? null : invertMat4(worldMatrix);

  if (viewMatrix === null) {
    return 0;
  }

  const projectionMatrix = readMatrix(
    options.viewMatrices,
    options.projectionOffset,
  );
  const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);

  options.viewMatrices.set(viewMatrix, options.viewOffset);
  options.viewMatrices.set(viewProjectionMatrix, options.viewProjectionOffset);
  return 1;
}

function interpolatedWorldMatrix(
  entity: Entity,
  alpha: number,
  cache: Map<string, Mat4 | null>,
  affectedCache: Map<string, boolean>,
  affectedVisiting: Set<string>,
  matrixVisiting: Set<string>,
): Mat4 | null {
  const key = entityKey(entity);
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  if (matrixVisiting.has(key)) {
    cache.set(key, null);
    return null;
  }

  matrixVisiting.add(key);
  const localMatrix = renderInterpolationReady(entity)
    ? interpolatedLocalMatrix(entity, alpha)
    : currentLocalMatrix(entity);
  let worldMatrix: Mat4 | null = null;

  if (localMatrix !== null) {
    const parent = parentEntity(entity);
    if (parent !== null) {
      affectedVisiting.clear();
      const parentMatrix = interpolationAffectsWorldMatrix(
        parent,
        affectedCache,
        affectedVisiting,
      )
        ? interpolatedWorldMatrix(
            parent,
            alpha,
            cache,
            affectedCache,
            affectedVisiting,
            matrixVisiting,
          )
        : readWorldMatrix(parent);
      affectedVisiting.clear();
      worldMatrix =
        parentMatrix === null ? null : multiplyMat4(parentMatrix, localMatrix);
    } else {
      worldMatrix = localMatrix;
    }
  }

  matrixVisiting.delete(key);
  cache.set(key, worldMatrix);
  return worldMatrix;
}

function interpolationAffectsWorldMatrix(
  entity: Entity,
  cache: Map<string, boolean>,
  visiting: Set<string>,
): boolean {
  const key = entityKey(entity);
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  if (visiting.has(key)) {
    cache.set(key, false);
    return false;
  }

  visiting.add(key);
  const parent = parentEntity(entity);
  const affected =
    renderInterpolationReady(entity) ||
    (parent !== null &&
      interpolationAffectsWorldMatrix(parent, cache, visiting));
  visiting.delete(key);
  cache.set(key, affected);
  return affected;
}

function interpolatedLocalMatrix(entity: Entity, alpha: number): Mat4 {
  return composeTrsMatrix(
    lerpVec3(
      entity.getVectorView(RenderInterpolation, "previousTranslation"),
      entity.getVectorView(RenderInterpolation, "currentTranslation"),
      alpha,
    ),
    slerpQuat(
      entity.getVectorView(RenderInterpolation, "previousRotation"),
      entity.getVectorView(RenderInterpolation, "currentRotation"),
      alpha,
    ),
    lerpVec3(
      entity.getVectorView(RenderInterpolation, "previousScale"),
      entity.getVectorView(RenderInterpolation, "currentScale"),
      alpha,
    ),
  );
}

function currentLocalMatrix(entity: Entity): Mat4 | null {
  if (!entity.hasComponent(LocalTransform)) {
    return readWorldMatrix(entity);
  }

  return composeTrsMatrix(
    entity.getVectorView(LocalTransform, "translation"),
    entity.getVectorView(LocalTransform, "rotation"),
    entity.getVectorView(LocalTransform, "scale"),
  );
}

function readWorldMatrix(entity: Entity): Mat4 | null {
  if (!entity.hasComponent(WorldTransform)) {
    return null;
  }

  return readWorldTransformMatrix(entity);
}

function readWorldTransformMatrix(entity: Entity): Mat4 {
  return new Float32Array([
    ...entity.getVectorView(WorldTransform, "col0"),
    ...entity.getVectorView(WorldTransform, "col1"),
    ...entity.getVectorView(WorldTransform, "col2"),
    ...entity.getVectorView(WorldTransform, "col3"),
  ]) as Mat4;
}

function readMatrix(buffer: Float32Array, offset: number): Mat4 {
  return buffer.slice(offset, offset + 16) as Mat4;
}

function renderInterpolationEntities(world: EcsWorld): Iterable<Entity> {
  return world.queryManager.registerQuery({
    required: [RenderInterpolation, LocalTransform],
  }).entities;
}

function renderInterpolationReady(entity: Entity): boolean {
  return (
    entity.hasComponent(RenderInterpolation) &&
    renderInterpolationEnabled(entity) &&
    entity.getValue(RenderInterpolation, "initialized") === true
  );
}

function renderInterpolationEnabled(entity: Entity): boolean {
  return entity.getValue(RenderInterpolation, "enabled") !== false;
}

function copyLocalToInterpolation(
  entity: Entity,
  target: "previous" | "current",
): void {
  const translation =
    target === "previous" ? "previousTranslation" : "currentTranslation";
  const rotation =
    target === "previous" ? "previousRotation" : "currentRotation";
  const scale = target === "previous" ? "previousScale" : "currentScale";

  entity
    .getVectorView(RenderInterpolation, translation)
    .set(entity.getVectorView(LocalTransform, "translation"));
  entity
    .getVectorView(RenderInterpolation, rotation)
    .set(entity.getVectorView(LocalTransform, "rotation"));
  entity
    .getVectorView(RenderInterpolation, scale)
    .set(entity.getVectorView(LocalTransform, "scale"));
}

function copyVectorField(
  entity: Entity,
  source: keyof typeof RenderInterpolation.schema,
  target: keyof typeof RenderInterpolation.schema,
): void {
  entity
    .getVectorView(RenderInterpolation, target as "previousTranslation")
    .set(
      entity.getVectorView(RenderInterpolation, source as "currentTranslation"),
    );
}

function parentEntity(entity: Entity): Entity | null {
  if (!entity.hasComponent(Parent)) {
    return null;
  }

  const parent = entity.getValue(Parent, "entity") as Entity | null | undefined;
  return parent !== null && parent !== undefined && parent.active
    ? parent
    : null;
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

function matrixOffsetValid(buffer: Float32Array, offset: number): boolean {
  return offset >= 0 && offset + 16 <= buffer.length;
}

function entityKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}

function read(values: Mat4Like | QuatLike | Vec3Like, index: number): number {
  return values[index] ?? 0;
}
