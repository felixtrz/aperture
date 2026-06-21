import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export function readRequiredHandle(registry, id, expectedKind) {
    const handle = registry.handleValue(id);
    if (handle === null) {
        throw new RangeError(`Expected ${expectedKind} handle id, received null handle id.`);
    }
    assertHandleKind(handle, [expectedKind]);
    return handle;
}
export function readNullableHandle(registry, id, expectedKinds) {
    const handle = registry.handleValue(id);
    if (handle === null) {
        return null;
    }
    assertHandleKind(handle, expectedKinds);
    return handle;
}
function assertHandleKind(handle, expectedKinds) {
    if (!expectedKinds.includes(handle.kind)) {
        throw new RangeError(`Expected ${expectedKinds.join(" or ")} handle, received '${assetHandleKey(handle)}'.`);
    }
}
//# sourceMappingURL=snapshot-packed-handle-utils.js.map