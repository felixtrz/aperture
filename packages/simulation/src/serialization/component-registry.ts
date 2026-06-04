import type { AnyEcsComponent, EcsWorld } from "../ecs/index.js";

// A component.id -> component lookup used when reconstructing entities from a
// serialized document (M7-T3 codec, M7-T4 scene load, M7-T5 prefab instantiate).
// It is an explicit allow-list: deserialization only instantiates components the
// caller put in the registry, so an unknown/malicious component id in a document
// is reported as a diagnostic rather than silently materialized.

export interface ComponentRegistry {
  get(id: string): AnyEcsComponent | undefined;
  has(id: string): boolean;
  readonly ids: readonly string[];
}

export function createComponentRegistry(
  components: Iterable<AnyEcsComponent>,
): ComponentRegistry {
  const byId = new Map<string, AnyEcsComponent>();
  for (const component of components) {
    byId.set(component.id, component);
  }

  return {
    get(id) {
      return byId.get(id);
    },
    has(id) {
      return byId.has(id);
    },
    get ids() {
      return [...byId.keys()];
    },
  };
}

/**
 * Build a registry from every component registered in `world` (scanned via the
 * public getComponentByTypeId, typeIds are sequential). Convenient for
 * instantiating documents into the SAME world that authored them — e.g. prefab
 * instantiation — where every needed component is already registered.
 */
export function componentRegistryFromWorld(world: EcsWorld): ComponentRegistry {
  const components: AnyEcsComponent[] = [];
  for (let typeId = 0; ; typeId += 1) {
    const component = world.componentManager.getComponentByTypeId(typeId);
    if (component === null) {
      break;
    }
    components.push(component);
  }
  return createComponentRegistry(components);
}
