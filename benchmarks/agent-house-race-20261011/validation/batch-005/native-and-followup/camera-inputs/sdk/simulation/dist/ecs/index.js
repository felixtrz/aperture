import { ComponentRegistry, World } from "elics";
export { Types as EcsType, createComponent as defineComponent, createSystem, } from "elics";
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
export function createWorld(options = {}) {
    return installEntityVersionTracking(installComponentReRegistration(new World({ entityCapacity: DEFAULT_ENTITY_CAPACITY, ...options })));
}
/**
 * Look up a component by id in elics' process-global component registry
 * (populated by every `defineComponent` call). Used to pre-register app
 * components declared in a snapshot manifest before a scene decode.
 */
export function findDefinedComponent(id) {
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
function ensureWorldComponent(world, component) {
    if (component.bitmask !== null &&
        !world.componentManager.hasComponent(component)) {
        world.registerComponent(component);
    }
}
function installComponentReRegistration(world) {
    const registerQuery = world.queryManager.registerQuery.bind(world.queryManager);
    world.queryManager.registerQuery = (query) => {
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
const TRANSFORM_COMPONENT_IDS = new Set([
    "aperture.transform.local",
    "aperture.transform.world",
]);
function installEntityVersionTracking(world) {
    const versionByEntityKey = new Map();
    const transformVersionByEntityKey = new Map();
    let worldChangeVersion = 0;
    const patchedEntities = new WeakSet();
    const patchedVectorViews = new WeakSet();
    const createEntity = world.createEntity.bind(world);
    const versionedWorld = world;
    versionedWorld.entityVersion = (entity) => versionByEntityKey.get(entityVersionKey(entity)) ?? 0;
    versionedWorld.markEntityChanged = (entity) => bumpEntityVersion(entity);
    versionedWorld.entityVersionTrackingSize = () => versionByEntityKey.size;
    versionedWorld.worldChangeVersion = () => worldChangeVersion;
    versionedWorld.entityTransformVersion = (entity) => transformVersionByEntityKey.get(entityVersionKey(entity)) ?? 0;
    versionedWorld.markEntityTransformChanged = (entity) => bumpEntityTransformVersion(entity);
    versionedWorld.createEntity = () => {
        const entity = createEntity();
        versionByEntityKey.set(entityVersionKey(entity), 0);
        patchEntity(entity);
        worldChangeVersion += 1;
        return entity;
    };
    return versionedWorld;
    function patchEntity(entity) {
        if (patchedEntities.has(entity)) {
            return;
        }
        patchedEntities.add(entity);
        const addComponent = entity.addComponent;
        const removeComponent = entity.removeComponent;
        const hasComponent = entity.hasComponent;
        const setValue = entity.setValue;
        const getVectorView = entity.getVectorView;
        const destroy = entity.destroy;
        entity.hasComponent = function patchedHasComponent(component) {
            // A component never registered in THIS world cannot be present on the
            // entity. elics' raw hasComponent crashes on a null bitmask (component
            // never registered anywhere) and can false-positive on a stale bitmask
            // from a previous world whose typeId this world reassigned.
            if (component.bitmask === null ||
                !world.componentManager.hasComponent(component)) {
                return false;
            }
            return hasComponent.call(this, component);
        };
        entity.addComponent = function patchedAddComponent(component, initialData) {
            // Re-register a component carrying a stale registration from a previous
            // world before elics ORs its old bitmask into this entity.
            ensureWorldComponent(world, component);
            const result = addComponent.call(this, component, initialData);
            if (this.active) {
                bumpEntityVersion(this);
            }
            return result;
        };
        entity.removeComponent = function patchedRemoveComponent(component) {
            // A component never registered in THIS world cannot be present on the
            // entity; its stale bitmask would clear an unrelated component's bit.
            if (component.bitmask !== null &&
                !world.componentManager.hasComponent(component)) {
                return this;
            }
            const hadComponent = this.active &&
                component.bitmask !== null &&
                this.hasComponent(component);
            const result = removeComponent.call(this, component);
            if (hadComponent) {
                bumpEntityVersion(this);
            }
            return result;
        };
        entity.setValue = function patchedSetValue(component, key, value) {
            setValue.call(this, component, key, value);
            if (isTransformComponent(component)) {
                bumpEntityTransformVersion(this);
            }
            else {
                bumpEntityVersion(this);
            }
        };
        entity.getVectorView = function patchedGetVectorView(component, key) {
            const view = getVectorView.call(this, component, key);
            return patchVectorView(this, view, component);
        };
        entity.destroy = function patchedDestroy() {
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
    function patchVectorView(entity, view, component) {
        if (patchedVectorViews.has(view)) {
            return view;
        }
        const set = view.set;
        const transform = isTransformComponent(component);
        Object.defineProperty(view, "set", {
            configurable: true,
            value(values, offset) {
                set.call(this, values, offset);
                if (transform) {
                    bumpEntityTransformVersion(entity);
                }
                else {
                    bumpEntityVersion(entity);
                }
            },
        });
        patchedVectorViews.add(view);
        return view;
    }
    function isTransformComponent(component) {
        return TRANSFORM_COMPONENT_IDS.has(component.id ?? "");
    }
    function bumpEntityVersion(entity) {
        const key = entityVersionKey(entity);
        const next = (versionByEntityKey.get(key) ?? 0) + 1;
        versionByEntityKey.set(key, next);
        worldChangeVersion += 1;
        return next;
    }
    function bumpEntityTransformVersion(entity) {
        const key = entityVersionKey(entity);
        const next = (transformVersionByEntityKey.get(key) ?? 0) + 1;
        transformVersionByEntityKey.set(key, next);
        worldChangeVersion += 1;
        return next;
    }
}
function entityVersionKey(entity) {
    return `${entity.index}:${entity.generation}`;
}
//# sourceMappingURL=index.js.map