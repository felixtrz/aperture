import { EcsType, type AnyEcsComponent, type Entity } from "../ecs/index.js";
import type { EcsWorld } from "../ecs/index.js";
import {
  LocalTransform,
  Parent,
  registerTransformComponents,
} from "../transform/components.js";
import { resolveWorldTransforms } from "../transform/resolution.js";
import type { ComponentRegistry } from "./component-registry.js";
import type {
  ApertureSceneDocument,
  ApertureSceneEntity,
  SceneDocumentDiagnostic,
} from "./scene-document.js";
import { loadScene } from "./scene-document.js";

// M7-T5: instantiate a prefab — an ApertureSceneDocument-shaped subtree (M7-T3/T4
// codec) — into a live world as an independent clone, returning the subtree root
// and applying per-instance overrides. Each instantiate deep-clones the document
// first so instances never alias each other's component data.

export interface PrefabTransformOverride {
  readonly translation?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number, number];
  readonly scale?: readonly [number, number, number];
}

export interface PrefabFieldOverride {
  /** Prefab-local serialized id (the document record's `id`). */
  readonly id: string;
  readonly component: string;
  readonly field: string;
  readonly value: unknown;
}

export interface InstantiatePrefabOptions {
  readonly registry: ComponentRegistry;
  /** Override applied to the subtree root's LocalTransform (per provided field). */
  readonly transform?: PrefabTransformOverride;
  /** Per-instance component-field overrides addressed by prefab-local id. */
  readonly overrides?: readonly PrefabFieldOverride[];
}

export interface InstantiatePrefabResult {
  readonly ok: boolean;
  readonly root: Entity | null;
  readonly entities: readonly Entity[];
  readonly diagnostics: readonly SceneDocumentDiagnostic[];
}

export function instantiatePrefab(
  world: EcsWorld,
  document: ApertureSceneDocument,
  options: InstantiatePrefabOptions,
): InstantiatePrefabResult {
  // Deep-clone so two instances of the same prefab never share document arrays.
  const cloned = JSON.parse(JSON.stringify(document)) as ApertureSceneDocument;

  const loaded = loadScene(world, cloned, { registry: options.registry });
  if (loaded.entities.length === 0) {
    return {
      ok: loaded.ok,
      root: null,
      entities: [],
      diagnostics: loaded.diagnostics,
    };
  }

  const diagnostics: SceneDocumentDiagnostic[] = [...loaded.diagnostics];
  const idToEntity = new Map<string, Entity>();
  cloned.entities.forEach((record, index) => {
    const entity = loaded.entities[index];
    if (entity !== undefined) {
      idToEntity.set(record.id, entity);
    }
  });

  const rootRecord = findRootRecord(cloned);
  const root =
    rootRecord === null ? null : (idToEntity.get(rootRecord.id) ?? null);

  if (options.transform !== undefined && root !== null) {
    applyTransformOverride(root, options.transform);
  }

  for (const override of options.overrides ?? []) {
    applyFieldOverride(idToEntity, options.registry, override, diagnostics);
  }

  // Re-resolve so overrides (root placement, etc.) reach the world matrices.
  registerTransformComponents(world);
  resolveWorldTransforms(world);

  return {
    ok: diagnostics.length === 0,
    root,
    entities: loaded.entities,
    diagnostics,
  };
}

function findRootRecord(
  document: ApertureSceneDocument,
): ApertureSceneEntity | null {
  for (const record of document.entities) {
    const parent = record.components.find(
      (component) => component.id === Parent.id,
    );
    if (parent === undefined || parent.fields.entity == null) {
      return record;
    }
  }
  return document.entities[0] ?? null;
}

function applyTransformOverride(
  root: Entity,
  transform: PrefabTransformOverride,
): void {
  if (!root.hasComponent(LocalTransform)) {
    return;
  }
  if (transform.translation !== undefined) {
    root
      .getVectorView(LocalTransform, "translation")
      .set(transform.translation);
  }
  if (transform.rotation !== undefined) {
    root.getVectorView(LocalTransform, "rotation").set(transform.rotation);
  }
  if (transform.scale !== undefined) {
    root.getVectorView(LocalTransform, "scale").set(transform.scale);
  }
}

function applyFieldOverride(
  idToEntity: Map<string, Entity>,
  registry: ComponentRegistry,
  override: PrefabFieldOverride,
  diagnostics: SceneDocumentDiagnostic[],
): void {
  const entity = idToEntity.get(override.id);
  if (entity === undefined) {
    diagnostics.push({
      code: "aperture.prefab.unknownOverrideId",
      message: `Prefab override targets unknown prefab-local id '${override.id}'.`,
      data: { id: override.id },
    });
    return;
  }

  const component = registry.get(override.component);
  if (component === undefined) {
    diagnostics.push({
      code: "aperture.prefab.unknownOverrideComponent",
      message: `Prefab override targets unregistered component '${override.component}'.`,
      data: { id: override.id, component: override.component },
    });
    return;
  }

  if (!entity.hasComponent(component)) {
    diagnostics.push({
      code: "aperture.prefab.overrideComponentMissing",
      message: `Prefab instance '${override.id}' has no component '${override.component}' to override.`,
      data: { id: override.id, component: override.component },
    });
    return;
  }

  const type = fieldType(component, override.field);
  if (type === undefined) {
    diagnostics.push({
      code: "aperture.prefab.unknownOverrideField",
      message: `Component '${override.component}' has no field '${override.field}'.`,
      data: {
        id: override.id,
        component: override.component,
        field: override.field,
      },
    });
    return;
  }

  writeOverride(entity, component, override.field, type, override.value);
}

function fieldType(
  component: AnyEcsComponent,
  field: string,
): string | undefined {
  const schema = component.schema as Record<string, { readonly type: string }>;
  return schema[field]?.type;
}

function writeOverride(
  entity: Entity,
  component: AnyEcsComponent,
  field: string,
  type: string,
  value: unknown,
): void {
  const loose = entity as unknown as {
    getVectorView(
      component: AnyEcsComponent,
      key: string,
    ): { set(values: unknown): void };
    setValue(component: AnyEcsComponent, key: string, value: unknown): void;
  };
  switch (type) {
    case EcsType.Vec2:
    case EcsType.Vec3:
    case EcsType.Vec4:
    case EcsType.Color:
      loose.getVectorView(component, field).set(value);
      return;
    default:
      loose.setValue(component, field, value);
  }
}
