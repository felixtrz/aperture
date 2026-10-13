// Automatic IBL wiring for the snapshot render loop. Before this module,
// prepareWebGpuAppEnvironmentAssets was only reachable from hand-written
// harnesses (examples, the CLI render harness): a generated app that authored
// an environment light extracted an EnvironmentPacket but no
// standardMaterialIblResources ever reached the frame, so IBL silently never
// rendered. createWebGpuApp now resolves the active snapshot environment
// against ready environment-map registry entries through this preparer.
//
// Preparation dispatches GPU compute (equirect→cube projection, PMREM
// prefilter, irradiance convolution), so results are memoized by the active
// handle plus every ready environment entry's registry version. A frame with
// an unchanged environment never re-prepares; a version bump (asset mutation)
// re-runs the chain exactly once.
import { assetHandleKey, } from "@aperture-engine/simulation";
import { prepareWebGpuAppEnvironmentAssets, } from "./app-environment-resources.js";
export function firstSnapshotEnvironmentHandle(snapshot) {
    for (const environment of snapshot.environments ?? []) {
        if (environment?.handle !== null && environment?.handle !== undefined) {
            return environment.handle;
        }
    }
    return null;
}
export function environmentAssetInputsFromRegistry(registry) {
    const inputs = [];
    for (const entry of registry.list({
        kind: "environment-map",
        status: "ready",
    })) {
        const input = environmentAssetInputFromEntry(entry);
        if (input !== null) {
            inputs.push(input);
        }
    }
    return inputs;
}
export function createWebGpuAppEnvironmentFramePreparer(options) {
    let preparedKey = null;
    let preparedResources;
    return {
        dispose() {
            preparedKey = null;
            preparedResources = undefined;
        },
        resolve(snapshot) {
            const activeHandle = firstSnapshotEnvironmentHandle(snapshot);
            if (activeHandle === null) {
                return undefined;
            }
            const inputs = environmentAssetInputsFromRegistry(options.registry);
            if (inputs.length === 0) {
                return undefined;
            }
            const key = preparationKey(activeHandle, inputs);
            if (key === preparedKey) {
                return preparedResources;
            }
            const prepared = prepareWebGpuAppEnvironmentAssets({
                app: options.app,
                assets: inputs,
                activeHandle,
            });
            // Cache misses as well as hits: an environment that cannot become ready
            // (unsupported device, malformed source) must not re-dispatch the
            // preparation compute chain every frame.
            preparedKey = key;
            preparedResources =
                prepared.active !== null && prepared.active.ready
                    ? prepared.active.standardMaterialIblResources
                    : undefined;
            return preparedResources;
        },
    };
}
function preparationKey(activeHandle, inputs) {
    const parts = [`active:${assetHandleKey(activeHandle)}`];
    for (const input of inputs) {
        parts.push(`${assetHandleKey(input.handle)}@${input.version ?? 0}`);
    }
    return parts.join("|");
}
function environmentAssetInputFromEntry(entry) {
    if (entry.asset === null || typeof entry.asset !== "object") {
        return null;
    }
    const handle = entry.handle;
    const asset = entry.asset;
    const equirectSource = equirectSourceFromValue(asset.equirectSource);
    if (equirectSource === null) {
        return null;
    }
    return {
        handle,
        label: typeof asset.label === "string"
            ? asset.label
            : (entry.label ?? handle.id),
        version: entry.version,
        diffuseResourceKey: typeof asset.diffuseResourceKey === "string"
            ? asset.diffuseResourceKey
            : `environment-map:${handle.id}:diffuse`,
        specularResourceKey: typeof asset.specularResourceKey === "string"
            ? asset.specularResourceKey
            : `environment-map:${handle.id}:specular`,
        equirectSource,
        ...(typeof asset.standardMaterialCount === "number" &&
            Number.isInteger(asset.standardMaterialCount)
            ? { standardMaterialCount: asset.standardMaterialCount }
            : {}),
    };
}
function equirectSourceFromValue(value) {
    if (value === null || typeof value !== "object") {
        return null;
    }
    const source = value;
    if (!Number.isInteger(source.width) ||
        !Number.isInteger(source.height) ||
        !(source.data instanceof Uint8Array)) {
        return null;
    }
    return {
        width: source.width,
        height: source.height,
        data: source.data,
        ...(typeof source.label === "string" ? { label: source.label } : {}),
        ...(typeof source.resourceKey === "string"
            ? { resourceKey: source.resourceKey }
            : {}),
        ...(Number.isInteger(source.faceSize)
            ? { faceSize: source.faceSize }
            : {}),
        ...(source.format === "rgba8unorm" || source.format === "rgba16float"
            ? { format: source.format }
            : {}),
        ...(Number.isInteger(source.mipLevelCount)
            ? { mipLevelCount: source.mipLevelCount }
            : {}),
    };
}
//# sourceMappingURL=app-environment-frame.js.map