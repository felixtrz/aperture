import { patchMatcapMaterial, patchStandardMaterial, patchUnlitMaterial, } from "@aperture-engine/render";
export function createMaterialAccess(registry) {
    return {
        get(handle) {
            return (registry.get(handle)?.asset ?? undefined);
        },
        set(handle, patch) {
            const entry = registry.get(handle);
            if (entry === undefined || entry.asset === null) {
                return {
                    ok: false,
                    diagnostic: {
                        code: "aperture.materials.notReady",
                        message: `Material '${handle.id}' is not registered with a ready asset.`,
                        data: { handle: handle.id },
                    },
                };
            }
            const asset = entry.asset;
            const next = patchByKind(asset, patch);
            if (next === null) {
                return {
                    ok: false,
                    diagnostic: {
                        code: "aperture.materials.unsupportedKind",
                        message: `Material '${handle.id}' of kind '${asset.kind}' does not support runtime parameter mutation.`,
                        data: { handle: handle.id, kind: asset.kind },
                    },
                };
            }
            const updated = registry.markReady(handle, next);
            return { ok: true, version: updated.version, kind: asset.kind };
        },
    };
}
function patchByKind(asset, patch) {
    switch (asset.kind) {
        case "standard":
            return patchStandardMaterial(asset, patch);
        case "unlit":
            return patchUnlitMaterial(asset, patch);
        case "matcap":
            return patchMatcapMaterial(asset, patch);
        default:
            return null;
    }
}
//# sourceMappingURL=materials.js.map