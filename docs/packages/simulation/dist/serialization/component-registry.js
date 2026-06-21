export function createComponentRegistry(components, options = {}) {
    const byId = new Map();
    for (const component of components) {
        byId.set(component.id, component);
    }
    const entityRefStringFields = normalizeEntityRefStringFields(options.entityRefStringFields);
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
export function componentRegistryFromWorld(world, options = {}) {
    const components = [];
    for (let typeId = 0;; typeId += 1) {
        const component = world.componentManager.getComponentByTypeId(typeId);
        if (component === null) {
            break;
        }
        components.push(component);
    }
    return createComponentRegistry(components, options);
}
function normalizeEntityRefStringFields(fields) {
    const normalized = new Map();
    for (const [id, names] of Object.entries(fields ?? {})) {
        normalized.set(id, [...new Set(names)].sort());
    }
    return normalized;
}
//# sourceMappingURL=component-registry.js.map