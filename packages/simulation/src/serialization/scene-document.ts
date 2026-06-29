import type { EcsWorld, Entity } from "../ecs/index.js";
import {
  Children,
  LocalTransform,
  Parent,
  WorldTransform,
  registerTransformComponents,
} from "../transform/components.js";
import { resolveWorldTransforms } from "../transform/resolution.js";
import {
  deserializeEntityComponents,
  DERIVED_COMPONENT_IDS,
  serializeEntityComponents,
  serializeEntityRef,
  type ComponentCodecDiagnostic,
  type SerializeEntityComponentsOptions,
  type SerializedComponent,
} from "./component-codec.js";
import type { ComponentRegistry } from "./component-registry.js";

// M7-T4: a whole-world scene document built on the M7-T3 component codec.
// saveScene serializes every active entity (each keyed by a stable
// index:generation id, with Entity-typed fields stored as the same id tokens);
// loadScene instantiates the document into a (typically fresh) world, remapping
// those tokens through an old-id -> new-entity map so the hierarchy survives the
// round-trip, then regenerates derived WorldTransforms via the resolver.
//
// Pure ECS state only — never snapshots or GPU resources (simulation invariant).

export const APERTURE_SCENE_FORMAT_VERSION = 1;

// Components excluded from a scene document because they are derived:
// WorldTransform is recomputed by the resolver, physics body state is produced
// by a backend/runtime, and Children is a derived index whose stored
// index:generation refs would be stale in a reloaded world — it is rebuilt from
// the authoritative Parent links on load instead.
const SCENE_DERIVED_COMPONENT_IDS: readonly string[] = [
  ...DERIVED_COMPONENT_IDS,
  Children.id,
];

export interface ApertureSceneEntity {
  /** Stable serialized id (`index:generation`) used to remap Entity-typed fields. */
  readonly id: string;
  readonly components: readonly SerializedComponent[];
}

export interface ApertureSceneDocument {
  readonly formatVersion: number;
  readonly entities: readonly ApertureSceneEntity[];
}

export type SceneDocumentDiagnostic = ComponentCodecDiagnostic;

export type SaveSceneOptions = SerializeEntityComponentsOptions;

export interface LoadSceneOptions {
  /** Allow-list of components the document is permitted to instantiate. */
  readonly registry: ComponentRegistry;
}

export interface LoadSceneResult {
  readonly ok: boolean;
  readonly entities: readonly Entity[];
  readonly diagnostics: readonly SceneDocumentDiagnostic[];
}

/** Serialize every active entity in `world` into a versioned scene document. */
export function saveScene(
  world: EcsWorld,
  options: SaveSceneOptions = {},
): ApertureSceneDocument {
  const exclude = options.exclude ?? SCENE_DERIVED_COMPONENT_IDS;
  return {
    formatVersion: APERTURE_SCENE_FORMAT_VERSION,
    entities: activeEntities(world).map((entity) => ({
      id: serializeEntityRef(entity),
      components: serializeEntityComponents(entity, { exclude }),
    })),
  };
}

/**
 * Instantiate `document` into `world`. Creates one entity per record, builds an
 * old-id -> new-entity map, deserializes components, remaps Entity-typed fields
 * through that map, then runs resolveWorldTransforms to regenerate WorldTransform.
 * An unknown formatVersion instantiates nothing and returns a diagnostic.
 */
export function loadScene(
  world: EcsWorld,
  document: ApertureSceneDocument,
  options: LoadSceneOptions,
): LoadSceneResult {
  if (!isSupportedDocument(document)) {
    return {
      ok: false,
      entities: [],
      diagnostics: [unknownFormatVersionDiagnostic(document)],
    };
  }

  const diagnostics: SceneDocumentDiagnostic[] = [];

  // Bind every referenced component's storage to THIS world before attaching:
  // elics binds component storage to the most recently registering world, so a
  // module-level component reused from another world must be (re)registered here.
  registerTransformComponents(world);
  for (const id of uniqueComponentIds(document)) {
    const component = options.registry.get(id);
    if (component !== undefined) {
      world.registerComponent(component);
    }
  }

  // Pass 1: create every entity so all Entity-typed refs are resolvable in pass 2.
  const oldIdToEntity = new Map<string, Entity>();
  const created: Entity[] = document.entities.map((record) => {
    const entity = world.createEntity();
    oldIdToEntity.set(record.id, entity);
    return entity;
  });
  const resolveEntity = (token: string) => oldIdToEntity.get(token) ?? null;

  // Pass 2: deserialize, remapping Entity-typed fields through the id map.
  document.entities.forEach((record, index) => {
    const result = deserializeEntityComponents(
      created[index]!,
      record.components,
      { registry: options.registry, resolveEntity },
    );
    diagnostics.push(...result.diagnostics);
  });

  // Regenerate the derived components the document omitted: rebuild the Children
  // index from the (remapped) authoritative Parent links, and re-attach a
  // WorldTransform for the resolver to fill.
  rebuildChildrenIndex(created);
  for (const entity of created) {
    if (
      entity.hasComponent(LocalTransform) &&
      !entity.hasComponent(WorldTransform)
    ) {
      entity.addComponent(WorldTransform);
    }
  }
  const report = resolveWorldTransforms(world);
  for (const diagnostic of report.diagnostics) {
    diagnostics.push({
      code: `aperture.scene.transform.${diagnostic.code}`,
      message: diagnostic.message,
      data: { ...diagnostic },
    });
  }

  return { ok: diagnostics.length === 0, entities: created, diagnostics };
}

function activeEntities(world: EcsWorld): Entity[] {
  const manager = world.entityManager as unknown as {
    readonly entityIndex?: number;
    getEntityByIndex(index: number): Entity | null;
  };
  const entities: Entity[] = [];
  const count = manager.entityIndex ?? 0;

  for (let index = 0; index < count; index += 1) {
    const entity = manager.getEntityByIndex(index);

    if (entity !== null) {
      entities.push(entity);
    }
  }

  return entities
    .filter((entity) => entity.active)
    .sort((a, b) => a.index - b.index || a.generation - b.generation);
}

// Rebuild the derived Children index from the authoritative Parent links so a
// reloaded world's getChildren matches the original. Child order is the document
// (stable index) order, which the hierarchy view re-sorts anyway.
function rebuildChildrenIndex(created: readonly Entity[]): void {
  const childRefsByParent = new Map<Entity, string[]>();
  for (const entity of created) {
    if (!entity.hasComponent(Parent)) {
      continue;
    }
    const parent = entity.getValue(Parent, "entity");
    if (parent === null) {
      continue;
    }
    const refs = childRefsByParent.get(parent) ?? [];
    refs.push(serializeEntityRef(entity));
    childRefsByParent.set(parent, refs);
  }

  for (const [parent, refs] of childRefsByParent) {
    const value = JSON.stringify(refs);
    if (parent.hasComponent(Children)) {
      parent.setValue(Children, "refs", value);
    } else {
      parent.addComponent(Children, { refs: value });
    }
  }
}

function uniqueComponentIds(document: ApertureSceneDocument): string[] {
  const ids = new Set<string>();
  for (const entity of document.entities) {
    for (const component of entity.components) {
      ids.add(component.id);
    }
  }
  return [...ids];
}

function isSupportedDocument(
  document: ApertureSceneDocument | null | undefined,
): document is ApertureSceneDocument {
  return (
    document !== null &&
    document !== undefined &&
    document.formatVersion === APERTURE_SCENE_FORMAT_VERSION &&
    Array.isArray(document.entities)
  );
}

function unknownFormatVersionDiagnostic(
  document: ApertureSceneDocument | null | undefined,
): SceneDocumentDiagnostic {
  return {
    code: "aperture.scene.unknownFormatVersion",
    message: `Unsupported scene document formatVersion '${String(
      document?.formatVersion,
    )}'; expected ${APERTURE_SCENE_FORMAT_VERSION}. Nothing was instantiated.`,
    data: {
      formatVersion: document?.formatVersion ?? null,
      expected: APERTURE_SCENE_FORMAT_VERSION,
    },
  };
}
