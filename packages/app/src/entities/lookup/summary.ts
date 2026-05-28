import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../../config.js";
import type {
  ApertureEntitySourceSummary,
  ApertureEntitySummary,
  ApertureLocalTransformSummary,
  ApertureWorldTransformSummary,
} from "./types.js";
import {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
} from "../../systems.js";

export function entitySummary(entity: Entity): ApertureEntitySummary {
  const key = entity.hasComponent(AppEntityKey)
    ? entity.getValue(AppEntityKey, "value")
    : null;
  const name = entity.hasComponent(Name)
    ? entity.getValue(Name, "value")
    : null;
  const tags = entity.hasComponent(AppEntityTags)
    ? parseTags(entity.getValue(AppEntityTags, "valuesJson"))
    : [];
  const source = entity.hasComponent(AppEntitySource)
    ? sourceSummary(entity)
    : null;
  const parent = entity.hasComponent(Parent)
    ? entityRefFromEntity(entity.getValue(Parent, "entity"))
    : null;
  const localTransform = entity.hasComponent(LocalTransform)
    ? localTransformSummary(entity)
    : null;
  const worldTransform = entity.hasComponent(WorldTransform)
    ? worldTransformSummary(entity)
    : null;

  return {
    entity: {
      index: entity.index,
      generation: entity.generation,
    },
    ...(typeof key === "string" && key.length > 0 ? { key } : {}),
    name:
      typeof name === "string" && name.length > 0
        ? name
        : `Entity ${entity.index}`,
    componentIds: entity
      .getComponents()
      .map((component) => component.id)
      .sort((a, b) => a.localeCompare(b)),
    ...(tags.length === 0 ? {} : { tags }),
    ...(source === null ? {} : { source }),
    ...(parent === null ? {} : { parent }),
    ...(localTransform === null ? {} : { localTransform }),
    ...(worldTransform === null ? {} : { worldTransform }),
  };
}

export function collectActiveEntities(world: EcsWorld): Entity[] {
  const entityManager = world.entityManager as unknown as {
    readonly indexLookup?: readonly (Entity | null | undefined)[];
  };

  if (Array.isArray(entityManager.indexLookup)) {
    return entityManager.indexLookup.filter(
      (entity): entity is Entity => entity !== null && entity?.active === true,
    );
  }

  return [
    ...world.queryManager.registerQuery({ required: [] }).entities,
  ].filter((entity) => entity.active);
}

export function compareEntitySummaries(
  a: ApertureEntitySummary,
  b: ApertureEntitySummary,
): number {
  return (
    a.entity.index - b.entity.index || a.entity.generation - b.entity.generation
  );
}

export function entityRefKey(ref: EcsEntityRef): string {
  return `${ref.index}:${ref.generation}`;
}

export function validEntityRef(ref: EcsEntityRef): boolean {
  return (
    Number.isInteger(ref.index) &&
    Number.isInteger(ref.generation) &&
    ref.index >= 0 &&
    ref.generation >= 0
  );
}

export function jsonSafeValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

function localTransformSummary(entity: Entity): ApertureLocalTransformSummary {
  return {
    translation: tuple3FromView(
      entity.getVectorView(LocalTransform, "translation"),
    ),
    rotation: tuple4FromView(entity.getVectorView(LocalTransform, "rotation")),
    scale: tuple3FromView(entity.getVectorView(LocalTransform, "scale")),
  };
}

function worldTransformSummary(entity: Entity): ApertureWorldTransformSummary {
  return {
    matrix: [
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col0")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col1")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col2")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col3")),
    ],
  };
}

function entityRefFromEntity(entity: Entity | null): EcsEntityRef | null {
  return entity === null
    ? null
    : { index: entity.index, generation: entity.generation };
}

function tuple3FromView(
  view: ArrayLike<number>,
): readonly [number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0];
}

function tuple4FromView(
  view: ArrayLike<number>,
): readonly [number, number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0, view[3] ?? 0];
}

function sourceSummary(entity: Entity): ApertureEntitySourceSummary | null {
  const kind = entity.getValue(AppEntitySource, "kind");
  const assetId = entity.getValue(AppEntitySource, "assetId");
  const gltfNodeIndex = entity.getValue(AppEntitySource, "gltfNodeIndex");
  const gltfNodePath = entity.getValue(AppEntitySource, "gltfNodePath");

  if (kind !== "gltf") {
    return null;
  }

  return {
    ...(typeof assetId === "string" && assetId.length > 0 ? { assetId } : {}),
    ...(typeof gltfNodeIndex === "number" && gltfNodeIndex >= 0
      ? { gltfNodeIndex }
      : {}),
    ...(typeof gltfNodePath === "string" && gltfNodePath.length > 0
      ? { gltfNodePath }
      : {}),
  };
}

function parseTags(value: string | null): readonly string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}
