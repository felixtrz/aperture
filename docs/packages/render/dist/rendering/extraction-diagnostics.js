import { assetHandleKey } from "@aperture-engine/simulation";
export function entityRef(entity) {
    return { index: entity.index, generation: entity.generation };
}
export function diagnostic(code, entity, handle) {
    const result = {
        code,
        severity: "warning",
        entity: entityRef(entity),
        message: code,
    };
    if (handle !== undefined) {
        return { ...result, assetKey: assetHandleKey(handle) };
    }
    return result;
}
//# sourceMappingURL=extraction-diagnostics.js.map