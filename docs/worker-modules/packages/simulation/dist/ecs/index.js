import { World } from "/aperture/worker-modules/node_modules/elics/lib/index.js";
export { Types as EcsType, createComponent as defineComponent, createSystem, } from "/aperture/worker-modules/node_modules/elics/lib/index.js";
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
    return installEntityVersionTracking(new World({ entityCapacity: DEFAULT_ENTITY_CAPACITY, ...options }));
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
        const setValue = entity.setValue;
        const getVectorView = entity.getVectorView;
        const destroy = entity.destroy;
        entity.addComponent = function patchedAddComponent(component, initialData) {
            const result = addComponent.call(this, component, initialData);
            if (this.active) {
                bumpEntityVersion(this);
            }
            return result;
        };
        entity.removeComponent = function patchedRemoveComponent(component) {
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