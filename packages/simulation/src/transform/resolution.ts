import type { EcsWorld, Entity } from "../ecs/index.js";
import {
  composeTrsMatrix,
  multiplyMat4,
  type Mat4Like,
} from "../math/index.js";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  registerTransformComponents,
} from "./components.js";

export type TransformDiagnosticCode =
  | "stale-parent"
  | "missing-parent-transform"
  | "cycle"
  | "parent-unresolved";

export interface TransformDiagnostic {
  readonly code: TransformDiagnosticCode;
  readonly entity: number;
  readonly generation: number;
  readonly parent?: number;
  readonly parentGeneration?: number;
  readonly cycle?: readonly string[];
  readonly message: string;
}

export interface TransformResolutionReport {
  readonly resolved: number;
  readonly skipped: number;
  readonly diagnostics: readonly TransformDiagnostic[];
}

export function resolveWorldTransforms(
  world: EcsWorld,
): TransformResolutionReport {
  registerTransformComponents(world);

  const query = world.queryManager.registerQuery({
    required: [LocalTransform, WorldTransform],
  });
  const entities = [...query.entities].sort(compareEntities);
  const transformEntities = new Set(entities);
  const visiting = new Set<Entity>();
  const invalid = new Set<Entity>();
  const worldMatrices = new Map<Entity, Mat4Like>();
  const diagnostics: TransformDiagnostic[] = [];
  let resolved = 0;

  for (const entity of entities) {
    if (resolveEntity(entity, []) !== null) {
      resolved += 1;
    }
  }

  return {
    resolved,
    skipped: entities.length - resolved,
    diagnostics,
  };

  function resolveEntity(entity: Entity, stack: Entity[]): Mat4Like | null {
    if (invalid.has(entity)) {
      return null;
    }

    const existing = worldMatrices.get(entity);

    if (existing !== undefined) {
      return existing;
    }

    if (visiting.has(entity)) {
      diagnoseCycle(entity, stack);
      return null;
    }

    visiting.add(entity);

    const nextStack = [...stack, entity];
    const localMatrix = readLocalMatrix(entity);
    const parent = readParent(entity, diagnostics);
    let matrix = localMatrix;

    if (parent !== null) {
      if (!transformEntities.has(parent)) {
        diagnostics.push({
          code: "missing-parent-transform",
          entity: entity.index,
          generation: entity.generation,
          parent: parent.index,
          parentGeneration: parent.generation,
          message:
            "Parent entity is active but does not have LocalTransform and WorldTransform; resolved child as a root for this pass.",
        });
      } else {
        const parentWorld = resolveEntity(parent, nextStack);

        if (parentWorld === null) {
          invalid.add(entity);
          diagnostics.push({
            code: "parent-unresolved",
            entity: entity.index,
            generation: entity.generation,
            parent: parent.index,
            parentGeneration: parent.generation,
            message:
              "Parent world transform could not be resolved; skipped this entity for this pass.",
          });
          visiting.delete(entity);
          return null;
        }

        matrix = multiplyMat4(parentWorld, localMatrix);
      }
    }

    writeWorldTransform(world, entity, matrix);
    worldMatrices.set(entity, matrix);
    visiting.delete(entity);
    return matrix;
  }

  function diagnoseCycle(entity: Entity, stack: Entity[]): void {
    const cycleStart = stack.findIndex((candidate) => candidate === entity);
    const cycleEntities = cycleStart >= 0 ? stack.slice(cycleStart) : [entity];
    const cyclePath = [...cycleEntities, entity].map(entityKey);

    for (const cycleEntity of cycleEntities) {
      invalid.add(cycleEntity);
      diagnostics.push({
        code: "cycle",
        entity: cycleEntity.index,
        generation: cycleEntity.generation,
        cycle: cyclePath,
        message:
          "Transform parent cycle detected; skipped cycle members for this pass.",
      });
    }
  }
}

function readLocalMatrix(entity: Entity): Mat4Like {
  return composeTrsMatrix(
    entity.getVectorView(LocalTransform, "translation") as Float32Array,
    entity.getVectorView(LocalTransform, "rotation") as Float32Array,
    entity.getVectorView(LocalTransform, "scale") as Float32Array,
  );
}

function readParent(
  entity: Entity,
  diagnostics: TransformDiagnostic[],
): Entity | null {
  if (!entity.hasComponent(Parent)) {
    return null;
  }

  const parent = entity.getValue(Parent, "entity");

  if (parent !== null) {
    return parent;
  }

  const packedParent = readPackedParent(entity);

  if (packedParent !== -1) {
    diagnostics.push({
      code: "stale-parent",
      entity: entity.index,
      generation: entity.generation,
      message:
        "Parent reference no longer resolves, likely because the parent was destroyed; resolved entity as a root for this pass.",
    });
  }

  return null;
}

function readPackedParent(entity: Entity): number {
  const parentData = Parent.data.entity as Int32Array;
  const packed = parentData[entity.index];

  if (packed === undefined) {
    return -1;
  }

  return packed;
}

function writeWorldTransform(
  world: EcsWorld,
  entity: Entity,
  matrix: Mat4Like,
): void {
  const col0Changed = writeColumn(
    entity.getVectorView(WorldTransform, "col0"),
    matrix,
    0,
  );
  const col1Changed = writeColumn(
    entity.getVectorView(WorldTransform, "col1"),
    matrix,
    1,
  );
  const col2Changed = writeColumn(
    entity.getVectorView(WorldTransform, "col2"),
    matrix,
    2,
  );
  const col3Changed = writeColumn(
    entity.getVectorView(WorldTransform, "col3"),
    matrix,
    3,
  );
  const changed = col0Changed || col1Changed || col2Changed || col3Changed;

  if (changed) {
    world.markEntityChanged(entity);
  }
}

function writeColumn(
  out: ArrayLike<number> & { [index: number]: number },
  matrix: Mat4Like,
  column: number,
): boolean {
  const offset = column * 4;
  const next0 = read(matrix, offset);
  const next1 = read(matrix, offset + 1);
  const next2 = read(matrix, offset + 2);
  const next3 = read(matrix, offset + 3);

  if (
    out[0] === next0 &&
    out[1] === next1 &&
    out[2] === next2 &&
    out[3] === next3
  ) {
    return false;
  }

  out[0] = next0;
  out[1] = next1;
  out[2] = next2;
  out[3] = next3;

  return true;
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function compareEntities(a: Entity, b: Entity): number {
  return a.index - b.index || a.generation - b.generation;
}

function entityKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}
