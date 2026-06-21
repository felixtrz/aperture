import { assetHandleKey } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { prepareMeshGpuResource, } from "./prepared-mesh-cache.js";
export function prepareAppMeshResource(options) {
    if (options.mesh === null) {
        return null;
    }
    const sourceVersion = sourceVersionFromAssetKey(options.meshKey, assetHandleKey(options.meshHandle));
    if (sourceVersion === null) {
        return null;
    }
    const result = prepareMeshGpuResource({
        device: options.device,
        cache: options.preparedMeshes,
        handle: options.meshHandle,
        mesh: options.mesh,
        sourceVersion,
        frame: options.frame,
    });
    return result.valid &&
        result.resource !== null &&
        (result.status === "created" || result.status === "reused")
        ? { status: result.status, resource: result.resource }
        : null;
}
function sourceVersionFromAssetKey(assetKey, sourceAssetKey) {
    const prefix = `${sourceAssetKey}@`;
    if (!assetKey.startsWith(prefix)) {
        return null;
    }
    const version = Number.parseInt(assetKey.slice(prefix.length), 10);
    return Number.isFinite(version) ? version : null;
}
//# sourceMappingURL=prepared-app-mesh-resource.js.map