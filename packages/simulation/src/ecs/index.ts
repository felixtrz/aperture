import { ComponentRegistry, World } from "elics";
import type {
  AnyComponent,
  Component,
  DataType,
  Entity,
  QueryConfig,
  TypedSchema,
  WorldOptions,
} from "elics";

export {
  Types as EcsType,
  createComponent as defineComponent,
  createSystem,
} from "elics";
export type {
  ComponentInitialData,
  DataType,
  Entity,
  TypedSchema,
  WorldOptions,
} from "elics";

export type EcsEntity = Entity;
export type AnyEcsComponent = AnyComponent;
export type EcsComponent<
  Schema extends TypedSchema<DataType> = TypedSchema<DataType>,
> = Component<Schema>;

export interface EntityVersionTracking {
  entityVersion(entity: Entity): number;
  markEntityChanged(entity: Entity): number;
  /**
   * Number of entity keys currently retained by change tracking. Diagnostic:
   * under correct bookkeeping this stays proportional to the live entity set,
   * not to the total number of entities ever created.
   */
  entityVersionTrackingSize(): number;
  /**
   * Monotonic counter bumped on every tracked world mutation (entity create/
   * destroy, component add/remove, setValue, vector-view set). Consumers can
   * compare it across phases to skip work when nothing changed (AI-60).
   * Indexed vector-view writes (view[i] = x) are NOT tracked (AI-62).
   */
  worldChangeVersion(): number;
  /**
   * Transform-only change counter (AI-67): bumped for LocalTransform /
   * WorldTransform value writes and by transform resolution, separately from
   * the structural entityVersion, so consumers (render extraction) can take a
   * matrix-only fast path without rebuilding cached packets.
   */
  entityTransformVersion(entity: Entity): number;
  markEntityTransformChanged(entity: Entity): number;
}

export type VersionedEcsWorld = World & EntityVersionTracking;
export type EcsWorld = VersionedEcsWorld;

/**
 * elics allocates each component's storage as a dense array sized to
 * `entityCapacity` ONCE (no growth), and throws a cryptic "offset is out of
 * bounds" when an entity row exceeds it. elics' own default is only 1000, which
 * any non-trivial 3D scene blows past (a single glTF expands to several entities;
 * a decorated track is ~1000+). Default to a generous capacity so apps don't hit
 * that wall, while still allowing an explicit override (threaded from app config
 * via worldOptions.entityCapacity). See showcase/racing/docs/PORT_PROGRESS.md.
 */
export const DEFAULT_ENTITY_CAPACITY = 16384;

export function createWorld(options: Partial<WorldOptions> = {}): EcsWorld {
  return installEntityVersionTracking(
    installComponentReRegistration(
      new World({ entityCapacity: DEFAULT_ENTITY_CAPACITY, ...options }),
    ),
  );
}

/**
 * Look up a component by id in elics' process-global component registry
 * (populated by every `defineComponent` call). Used to pre-register app
 * components declared in a snapshot manifest before a scene decode.
 */
export function findDefinedComponent(id: string): AnyEcsComponent | undefined {
  return ComponentRegistry.getById(id);
}

/**
 * elics registers a component lazily and only when `component.bitmask` is
 * still null. A module-scope `defineComponent` singleton that was registered
 * by a PREVIOUS world in the same process keeps that world's typeId/bitmask,
 * so on the next world elics skips re-registration and ORs stale bits into
 * fresh entities (whose typeIds then resolve to `null` here) — crashing
 * summaries and silently corrupting queries after an in-process reset.
 * Consult the CURRENT world instead and re-register on first use, exactly
 * like `registerApertureAppComponents` already does for built-ins each boot.
 * (Worlds are sequential per process — reset disposes the old runner first.)
 */
function ensureWorldComponent(world: World, component: AnyComponent): void {
  if (
    component.bitmask !== null &&
    !world.componentManager.hasComponent(component)
  ) {
    world.registerComponent(component);
  }
}

function installComponentReRegistration(world: World): World {
  const registerQuery = world.queryManager.registerQuery.bind(
    world.queryManager,
  );

  world.queryManager.registerQuery = (query: QueryConfig) => {
    for (const component of query.required) {
      ensureWorldComponent(world, component);
    }
    for (const component of query.excluded ?? []) {
      ensureWorldComponent(world, component);
    }
    for (const predicate of query.where ?? []) {
      ensureWorldComponent(world, predicate.component);
    }
    return registerQuery(query);
  };

  return world;
}

type VectorView = {
  readonly length: number;
  set(values: ArrayLike<number>, offset?: number): void;
};

const TRANSFORM_COMPONENT_IDS = new Set([
  "aperture.transform.local",
  "aperture.transform.world",
]);

function installEntityVersionTracking(world: World): EcsWorld {
  const versionByEntityKey = new Map<string, number>();
  const transformVersionByEntityKey = new Map<string, number>();
  let worldChangeVersion = 0;
  const patchedEntities = new WeakSet<Entity>();
  const patchedVectorViews = new WeakSet<object>();
  const createEntity = world.createEntity.bind(world);

  const versionedWorld = world as EcsWorld;

  versionedWorld.entityVersion = (entity) =>
    versionByEntityKey.get(entityVersionKey(entity)) ?? 0;
  versionedWorld.markEntityChanged = (entity) => bumpEntityVersion(entity);
  versionedWorld.entityVersionTrackingSize = () => versionByEntityKey.size;
  versionedWorld.worldChangeVersion = () => worldChangeVersion;
  versionedWorld.entityTransformVersion = (entity) =>
    transformVersionByEntityKey.get(entityVersionKey(entity)) ?? 0;
  versionedWorld.markEntityTransformChanged = (entity) =>
    bumpEntityTransformVersion(entity);
  versionedWorld.createEntity = () => {
    const entity = createEntity();

    versionByEntityKey.set(entityVersionKey(entity), 0);
    patchEntity(entity);
    worldChangeVersion += 1;

    return entity;
  };

  return versionedWorld;

  function patchEntity(entity: Entity): void {
    if (patchedEntities.has(entity)) {
      return;
    }

    patchedEntities.add(entity);

    const addComponent = entity.addComponent;
    const removeComponent = entity.removeComponent;
    const setValue = entity.setValue;
    const getVectorView = entity.getVectorView;
    const destroy = entity.destroy;

    entity.addComponent = function patchedAddComponent(
      this: Entity,
      component: AnyComponent,
      initialData?: Record<string, unknown>,
    ) {
      // Re-register a component carrying a stale registration from a previous
      // world before elics ORs its old bitmask into this entity.
      ensureWorldComponent(world, component);
      const result = addComponent.call(this, component, initialData);

      if (this.active) {
        bumpEntityVersion(this);
      }

      return result;
    } as Entity["addComponent"];

    entity.removeComponent = function patchedRemoveComponent(
      this: Entity,
      component: AnyComponent,
    ) {
      // A component never registered in THIS world cannot be present on the
      // entity; its stale bitmask would clear an unrelated component's bit.
      if (
        component.bitmask !== null &&
        !world.componentManager.hasComponent(component)
      ) {
        return this;
      }
      const hadComponent =
        this.active &&
        component.bitmask !== null &&
        this.hasComponent(component);
      const result = removeComponent.call(this, component);

      if (hadComponent) {
        bumpEntityVersion(this);
      }

      return result;
    } as Entity["removeComponent"];

    entity.setValue = function patchedSetValue(
      this: Entity,
      component: AnyComponent,
      key: PropertyKey,
      value: unknown,
    ) {
      setValue.call(this, component, key as never, value as never);

      if (isTransformComponent(component)) {
        bumpEntityTransformVersion(this);
      } else {
        bumpEntityVersion(this);
      }
    } as Entity["setValue"];

    entity.getVectorView = function patchedGetVectorView(
      this: Entity,
      component: AnyComponent,
      key: PropertyKey,
    ) {
      const view = getVectorView.call(this, component, key as never);

      return patchVectorView(this, view as VectorView, component);
    } as Entity["getVectorView"];

    entity.destroy = function patchedDestroy(this: Entity) {
      const wasActive = this.active;
      const key = entityVersionKey(this);

      destroy.call(this);

      if (wasActive) {
        // Bound the tracking map under spawn/despawn churn. A recycled slot is
        // re-keyed by its incremented generation and restarts at version 0 via
        // createEntity, so retaining a destroyed entity's key only leaks memory;
        // no consumer reads entityVersion() of a destroyed (unqueried) entity.
        versionByEntityKey.delete(key);
        transformVersionByEntityKey.delete(key);
        worldChangeVersion += 1;
      }
    };
  }

  function patchVectorView(
    entity: Entity,
    view: VectorView,
    component: AnyComponent,
  ): VectorView {
    if (patchedVectorViews.has(view)) {
      return view;
    }

    const set = view.set;
    const transform = isTransformComponent(component);

    Object.defineProperty(view, "set", {
      configurable: true,
      value(values: ArrayLike<number>, offset?: number) {
        set.call(this, values, offset);

        if (transform) {
          bumpEntityTransformVersion(entity);
        } else {
          bumpEntityVersion(entity);
        }
      },
    });
    patchedVectorViews.add(view);

    return view;
  }

  function isTransformComponent(component: AnyComponent): boolean {
    return TRANSFORM_COMPONENT_IDS.has(
      (component as { readonly id?: string }).id ?? "",
    );
  }

  function bumpEntityVersion(entity: Entity): number {
    const key = entityVersionKey(entity);
    const next = (versionByEntityKey.get(key) ?? 0) + 1;

    versionByEntityKey.set(key, next);
    worldChangeVersion += 1;

    return next;
  }

  function bumpEntityTransformVersion(entity: Entity): number {
    const key = entityVersionKey(entity);
    const next = (transformVersionByEntityKey.get(key) ?? 0) + 1;

    transformVersionByEntityKey.set(key, next);
    worldChangeVersion += 1;

    return next;
  }
}

function entityVersionKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}
