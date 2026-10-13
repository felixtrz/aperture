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
    // Scan the manager's dense typeId array directly when available so a hole
    // (a null typeId slot) skips that slot instead of silently truncating every
    // component registered after it (#64).
    const manager = world.componentManager;
    if (Array.isArray(manager.componentsByTypeId)) {
        for (const component of manager.componentsByTypeId) {
            if (component !== null && component !== undefined) {
                components.push(component);
            }
        }
    }
    else {
        for (let typeId = 0;; typeId += 1) {
            const component = world.componentManager.getComponentByTypeId(typeId);
            if (component === null) {
                break;
            }
            components.push(component);
        }
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