import { createPrefabHandle, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export function createPrefabAccess(registry) {
    let counter = 0;
    return {
        register(document, options = {}) {
            counter += 1;
            const id = options.id ?? `aperture.prefab.${counter}`;
            const handle = createPrefabHandle(id);
            if (!registry.has(handle)) {
                registry.register(handle, options.label === undefined ? {} : { label: options.label });
            }
            registry.markReady(handle, document);
            return handle;
        },
    };
}
//# sourceMappingURL=prefabs.js.map