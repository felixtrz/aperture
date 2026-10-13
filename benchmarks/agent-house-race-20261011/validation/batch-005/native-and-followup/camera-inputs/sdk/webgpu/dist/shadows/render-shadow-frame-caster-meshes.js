import { meshBufferResourceKey } from "../resources/core/resource-keys.js";
export function createShadowCasterMeshViewsFromAppReport(report) {
    return {
        preparedMeshes: createShadowCasterPreparedMeshViews(report),
        executableMeshes: createShadowCasterExecutableMeshViews(report),
    };
}
export function createShadowCasterPreparedMeshViews(report) {
    const meshResourceByLabel = createMeshResourceByLabel(report);
    const meshResourceByKey = new Map();
    for (const entry of preparedMeshFacadeEntries(report)) {
        const resource = resolvePreparedMeshResource(meshResourceByLabel, entry);
        if (resource === undefined) {
            continue;
        }
        meshResourceByKey.set(entry.assetKey, {
            meshKey: entry.assetKey,
            meshResourceKey: resource.resourceKey,
            vertexBufferResourceKeys: resource.vertexBuffers.map((buffer) => buffer.resourceKey),
            indexBufferResourceKey: resource.indexBuffer?.resourceKey ?? null,
        });
    }
    return [...meshResourceByKey.values()];
}
export function createShadowCasterExecutableMeshViews(report) {
    const meshResourceByLabel = createMeshResourceByLabel(report);
    const meshResourceByKey = new Map();
    for (const entry of preparedMeshFacadeEntries(report)) {
        const resource = resolvePreparedMeshResource(meshResourceByLabel, entry);
        if (resource === undefined) {
            continue;
        }
        meshResourceByKey.set(entry.assetKey, {
            meshKey: entry.assetKey,
            meshResourceKey: resource.resourceKey,
            vertexBuffers: resource.vertexBuffers.map(toExecutableVertexBuffer),
            indexBuffer: resource.indexBuffer === undefined || resource.indexBuffer === null
                ? null
                : toExecutableIndexBuffer(resource.indexBuffer),
        });
    }
    return [...meshResourceByKey.values()];
}
function createMeshResourceByLabel(report) {
    return new Map((report.resources?.resources?.meshResources ?? []).map((resource) => [
        resource.resourceKey,
        resource,
    ]));
}
function resolvePreparedMeshResource(resources, entry) {
    for (const key of preparedMeshResourceCandidateKeys(entry)) {
        const resource = resources.get(key);
        if (resource !== undefined) {
            return resource;
        }
    }
    return undefined;
}
function preparedMeshResourceCandidateKeys(entry) {
    return [
        ...(entry.meshResourceKey === undefined ? [] : [entry.meshResourceKey]),
        ...(entry.sourceVersion === undefined
            ? []
            : [meshBufferResourceKey(`${entry.assetKey}@v${entry.sourceVersion}`)]),
        meshBufferResourceKey(entry.label),
    ];
}
function preparedMeshFacadeEntries(report) {
    return report.resourceReuse?.preparedMeshFacade?.entries ?? [];
}
function toExecutableVertexBuffer(buffer) {
    return {
        resourceKey: buffer.resourceKey,
        buffer: buffer.buffer ?? null,
        vertexCount: buffer.vertexCount ?? 0,
    };
}
function toExecutableIndexBuffer(buffer) {
    return {
        resourceKey: buffer.resourceKey,
        buffer: buffer.buffer ?? null,
        format: buffer.format ?? "uint32",
        indexCount: buffer.indexCount ?? 0,
    };
}
//# sourceMappingURL=render-shadow-frame-caster-meshes.js.map