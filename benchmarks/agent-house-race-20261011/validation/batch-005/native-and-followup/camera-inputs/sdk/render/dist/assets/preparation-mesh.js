import { validateMeshAsset } from "../mesh/index.js";
import { prepareRenderAsset } from "./preparation-core.js";
import { PreparedRenderAssetStore } from "./preparation-store.js";
export function createPreparedMeshAssetStore() {
    return new PreparedRenderAssetStore();
}
export function createPreparedMeshStore(options = {}) {
    const entries = options.entries ?? createPreparedMeshAssetStore();
    const adapter = createMeshMetadataRenderAssetAdapter();
    return {
        entries,
        get(handle) {
            return entries.get(handle);
        },
        list() {
            return entries.list();
        },
        prepare(prepareOptions) {
            return prepareRenderAsset({
                registry: prepareOptions.registry,
                adapter,
                store: entries,
                handle: prepareOptions.handle,
            });
        },
        remove(handle) {
            return entries.remove(handle);
        },
        clear() {
            entries.clear();
        },
    };
}
export function preparedMeshStoreSummaryToJsonValue(store) {
    return {
        totalEntries: store.entries.size,
        entries: store
            .list()
            .map((entry) => preparedMeshStoreEntryToJsonValue(entry)),
    };
}
export function createMeshMetadataRenderAssetAdapter() {
    return {
        kind: "mesh",
        family: "mesh.metadata",
        prepare(input) {
            const validation = validateMeshAsset(input.source);
            if (!validation.valid) {
                return {
                    status: "failed",
                    diagnostics: validation.diagnostics.map((diagnostic) => ({
                        code: `renderAsset.${diagnostic.code}`,
                        message: diagnostic.message,
                        severity: "error",
                        assetKey: input.assetKey,
                    })),
                };
            }
            return {
                status: "prepared",
                prepared: {
                    resourceFamily: "mesh",
                    sourceMeshKey: input.assetKey,
                    meshResourceKey: `prepared-mesh:${input.assetKey}`,
                    label: input.source.label,
                    vertexStreams: input.source.vertexStreams.length,
                    submeshes: input.source.submeshes.length,
                    hasIndexBuffer: input.source.indexBuffer !== undefined,
                },
            };
        },
    };
}
function preparedMeshStoreEntryToJsonValue(entry) {
    return {
        assetKey: entry.assetKey,
        sourceVersion: entry.sourceVersion,
        label: entry.prepared.label,
        meshResourceKey: entry.prepared.meshResourceKey,
        vertexStreams: entry.prepared.vertexStreams,
        submeshes: entry.prepared.submeshes,
        hasIndexBuffer: entry.prepared.hasIndexBuffer,
        diagnosticCount: entry.diagnostics.length,
    };
}
//# sourceMappingURL=preparation-mesh.js.map