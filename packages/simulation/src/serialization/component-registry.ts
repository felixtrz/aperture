import type { AnyEcsComponent, EcsWorld } from "../ecs/index.js";

// A component.id -> component lookup used when reconstructing entities from a
// serialized document (M7-T3 codec, M7-T4 scene load, M7-T5 prefab instantiate).
// It is an explicit allow-list: deserialization only instantiates components the
// caller put in the registry, so an unknown/malicious component id in a document
// is reported as a diagnostic rather than silently materialized.

export interface ComponentRegistry {
  get(id: string): AnyEcsComponent | undefined;
  has(id: string): boolean;
  entityRefStringFields(id: string): readonly string[];
  readonly ids: readonly string[];
}

export interface ComponentRegistryOptions {
  /**
   * String fields that should be treated as serialized `index:generation`
   * entity-reference tokens during scene/prefab load. This keeps the generic
   * codec independent of domain packages whose public authoring still stores
   * refs as backend-friendly strings.
   */
  readonly entityRefStringFields?: Readonly<Record<string, readonly string[]>>;
}

export function createComponentRegistry(
  components: Iterable<AnyEcsComponent>,
  options: ComponentRegistryOptions = {},
): ComponentRegistry {
  const byId = new Map<string, AnyEcsComponent>();
  for (const component of components) {
    byId.set(component.id, component);
  }
  const entityRefStringFields = normalizeEntityRefStringFields(
    options.entityRefStringFields,
  );

  return {
    get(id) {
      return byId.get(id);
    },
    has(id) {
      return byId.has(id);
    },
    entityRefStringFields(id) {
      return entityRefStringFields.get(id) ?? [];
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
export function componentRegistryFromWorld(
  world: EcsWorld,
  options: ComponentRegistryOptions = {},
): ComponentRegistry {
  const components: AnyEcsComponent[] = [];
  // Scan the manager's dense typeId array directly when available so a hole
  // (a null typeId slot) skips that slot instead of silently truncating every
  // component registered after it (#64).
  const manager = world.componentManager as unknown as {
    readonly componentsByTypeId?: readonly (AnyEcsComponent | null)[];
  };
  if (Array.isArray(manager.componentsByTypeId)) {
    for (const component of manager.componentsByTypeId) {
      if (component !== null && component !== undefined) {
        components.push(component);
      }
    }
  } else {
    for (let typeId = 0; ; typeId += 1) {
      const component = world.componentManager.getComponentByTypeId(typeId);
      if (component === null) {
        break;
      }
      components.push(component);
    }
  }
  return createComponentRegistry(components, options);
}

function normalizeEntityRefStringFields(
  fields: Readonly<Record<string, readonly string[]>> | undefined,
): Map<string, readonly string[]> {
  const normalized = new Map<string, readonly string[]>();
  for (const [id, names] of Object.entries(fields ?? {})) {
    normalized.set(id, [...new Set(names)].sort());
  }
  return normalized;
}
