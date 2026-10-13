import { assetHandleKey, createMeshHandle, } from "@aperture-engine/simulation";
export function createMeshAccess(registry) {
    const access = {
        dynamic(id, options = {}) {
            const handle = meshHandleFrom(id);
            ensureRegistered(registry, handle, options.label);
            if (options.initial !== undefined) {
                publishMesh(registry, handle, options.initial, {
                    ...(options.label === undefined ? {} : { label: options.label }),
                    ...(options.diagnostics === undefined
                        ? {}
                        : { diagnostics: options.diagnostics }),
                });
            }
            return {
                handle,
                key: assetHandleKey(handle),
                get() {
                    return access.get(handle);
                },
                publish(mesh, publishOptions = {}) {
                    return access.publish(handle, mesh, publishOptions);
                },
            };
        },
        get(handle) {
            return registry.get(handle)?.asset ?? undefined;
        },
        publish(id, mesh, options = {}) {
            const handle = meshHandleFrom(id);
            ensureRegistered(registry, handle, options.label ?? mesh.label);
            return publishMesh(registry, handle, mesh, options);
        },
    };
    return access;
}
function meshHandleFrom(id) {
    return typeof id === "string" ? createMeshHandle(id) : id;
}
function ensureRegistered(registry, handle, label) {
    if (registry.has(handle)) {
        return;
    }
    registry.register(handle, {
        ...(label === undefined ? {} : { label }),
    });
}
function publishMesh(registry, handle, mesh, options) {
    const entry = registry.markReady(handle, mesh, options.diagnostics ?? []);
    return {
        handle,
        key: assetHandleKey(handle),
        version: entry.version,
    };
}
//# sourceMappingURL=meshes.js.map