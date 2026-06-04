import type { AnyEcsComponent } from "../ecs/index.js";

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
