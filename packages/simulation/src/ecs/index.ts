import { World } from "elics";
import type {
  AnyComponent,
  Component,
  DataType,
  Entity,
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
}

export type VersionedEcsWorld = World & EntityVersionTracking;
export type EcsWorld = VersionedEcsWorld;

export function createWorld(options: Partial<WorldOptions> = {}): EcsWorld {
  return installEntityVersionTracking(new World(options));
}

type VectorView = {
  readonly length: number;
  set(values: ArrayLike<number>, offset?: number): void;
};

function installEntityVersionTracking(world: World): EcsWorld {
  const versionByEntityKey = new Map<string, number>();
  const patchedEntities = new WeakSet<Entity>();
  const patchedVectorViews = new WeakSet<object>();
  const createEntity = world.createEntity.bind(world);

  const versionedWorld = world as EcsWorld;

  versionedWorld.entityVersion = (entity) =>
    versionByEntityKey.get(entityVersionKey(entity)) ?? 0;
  versionedWorld.markEntityChanged = (entity) => bumpEntityVersion(entity);
  versionedWorld.createEntity = () => {
    const entity = createEntity();

    versionByEntityKey.set(entityVersionKey(entity), 0);
    patchEntity(entity);

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
      bumpEntityVersion(this);
    } as Entity["setValue"];

    entity.getVectorView = function patchedGetVectorView(
      this: Entity,
      component: AnyComponent,
      key: PropertyKey,
    ) {
      const view = getVectorView.call(this, component, key as never);

      return patchVectorView(this, view as VectorView);
    } as Entity["getVectorView"];

    entity.destroy = function patchedDestroy(this: Entity) {
      const wasActive = this.active;

      destroy.call(this);

      if (wasActive) {
        bumpEntityVersion(this);
      }
    };
  }

  function patchVectorView(entity: Entity, view: VectorView): VectorView {
    if (patchedVectorViews.has(view)) {
      return view;
    }

    const set = view.set;

    Object.defineProperty(view, "set", {
      configurable: true,
      value(values: ArrayLike<number>, offset?: number) {
        set.call(this, values, offset);
        bumpEntityVersion(entity);
      },
    });
    patchedVectorViews.add(view);

    return view;
  }

  function bumpEntityVersion(entity: Entity): number {
    const key = entityVersionKey(entity);
    const next = (versionByEntityKey.get(key) ?? 0) + 1;

    versionByEntityKey.set(key, next);

    return next;
  }
}

function entityVersionKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}
