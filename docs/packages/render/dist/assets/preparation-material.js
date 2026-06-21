import { createPreparedMaterialResourceDescriptor, isCustomWgslMaterialAsset, } from "../materials/index.js";
import { createCustomWgslMaterialRenderAssetAdapter, } from "./custom-wgsl-material-preparation.js";
import { prepareRenderAsset } from "./preparation-core.js";
import { PreparedRenderAssetStore } from "./preparation-store.js";
export function createPreparedMaterialAssetStore() {
    return new PreparedRenderAssetStore();
}
export function createPreparedMaterialStore(options = {}) {
    const entries = options.entries ?? createPreparedMaterialAssetStore();
    const builtInAdapter = createMaterialMetadataRenderAssetAdapter();
    return {
        entries,
        get(handle) {
            return entries.get(handle);
        },
        list() {
            return entries.list();
        },
        prepare(prepareOptions) {
            const entry = prepareOptions.registry.get(prepareOptions.handle);
            const adapter = entry?.status === "ready" &&
                entry.asset !== null &&
                isCustomWgslMaterialAsset(entry.asset)
                ? createCustomWgslMaterialRenderAssetAdapter(entry.asset.familyKey)
                : builtInAdapter;
            return prepareRenderAsset({
                registry: prepareOptions.registry,
                adapter: adapter,
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
export function preparedMaterialStoreSummaryToJsonValue(store) {
    const entries = store
        .list()
        .map((entry) => preparedMaterialStoreEntryToJsonValue(entry));
    const families = createEmptyPreparedMaterialFamilySummary();
    for (const entry of entries) {
        const summary = families[entry.materialFamily] ?? { entries: 0 };
        families[entry.materialFamily] = {
            entries: summary.entries + 1,
        };
    }
    return {
        totalEntries: entries.length,
        families,
        entries,
    };
}
export function createMaterialMetadataRenderAssetAdapter() {
    return {
        kind: "material",
        family: "material.metadata",
        prepare(input) {
            if (!input.dependencyState.ready) {
                return {
                    status: "retry",
                    diagnostics: dependencyDiagnostics(input),
                };
            }
            const descriptorResult = createPreparedMaterialResourceDescriptor({
                registry: input.registry,
                material: input.handle,
            });
            if (!descriptorResult.valid || descriptorResult.descriptor === null) {
                return {
                    status: "failed",
                    diagnostics: descriptorResult.diagnostics.map((diagnostic) => ({
                        code: `renderAsset.${diagnostic.code}`,
                        message: diagnostic.message,
                        severity: "error",
                        assetKey: input.assetKey,
                        ...("dependencyKey" in diagnostic &&
                            diagnostic.dependencyKey !== undefined
                            ? { dependencyKey: diagnostic.dependencyKey }
                            : {}),
                    })),
                };
            }
            return {
                status: "prepared",
                prepared: descriptorResult.descriptor,
            };
        },
    };
}
function createEmptyPreparedMaterialFamilySummary() {
    return {
        unlit: { entries: 0 },
        matcap: { entries: 0 },
        standard: { entries: 0 },
        "debug-normal": { entries: 0 },
    };
}
function preparedMaterialStoreEntryToJsonValue(entry) {
    return {
        assetKey: entry.assetKey,
        sourceVersion: entry.sourceVersion,
        label: entry.prepared.label,
        materialFamily: entry.prepared.materialFamily,
        ...("materialKind" in entry.prepared
            ? { materialKind: entry.prepared.materialKind }
            : {}),
        pipelineKey: entry.prepared.pipelineKey,
        materialResourceKey: entry.prepared.materialResourceKey,
        bindGroupResourceKey: entry.prepared.bindGroupResourceKey,
        dependencyCount: "dependencies" in entry.prepared ? entry.prepared.dependencies.length : 0,
        textureBindingCount: "textureBindings" in entry.prepared
            ? entry.prepared.textureBindings.length
            : entry.prepared.bindGroup.entries.filter((binding) => binding.kind === "texture").length,
        diagnosticCount: entry.diagnostics.length,
    };
}
function dependencyDiagnostics(input) {
    return input.dependencyState.diagnostics.map((diagnostic) => ({
        code: `renderAsset.${diagnostic.code}`,
        message: diagnostic.message,
        severity: "warning",
        assetKey: input.assetKey,
        dependencyKey: diagnostic.dependencyKey,
    }));
}
//# sourceMappingURL=preparation-material.js.map