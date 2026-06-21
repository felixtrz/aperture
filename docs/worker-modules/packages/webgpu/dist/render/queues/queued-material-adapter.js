export function createQueuedMaterialAdapterRegistry(adapters) {
    return {
        adapters,
        diagnostics: collectRegistryDiagnostics(adapters),
        get: (materialKind) => {
            for (const adapter of adapters) {
                if (adapter.kind === materialKind) {
                    return adapter;
                }
            }
            return null;
        },
    };
}
export function validateQueuedMaterialAdapterRegistry(registry, options = {}) {
    const expectedFamilies = [...(options.expectedFamilies ?? [])];
    const registeredFamilies = registry.adapters.map((adapter) => adapter.kind);
    const registeredFamilySet = new Set(registeredFamilies);
    const diagnostics = [
        ...registry.diagnostics,
    ];
    for (const family of expectedFamilies) {
        if (registeredFamilySet.has(family)) {
            continue;
        }
        diagnostics.push({
            code: "queuedMaterialAdapter.missingExpectedFamily",
            severity: "error",
            family,
            message: `Expected material adapter family '${family}' is not registered.`,
        });
    }
    return {
        valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        expectedFamilies,
        registeredFamilies,
        diagnostics,
    };
}
export function queuedMaterialAdapterRegistryValidationReportToJsonValue(report) {
    return {
        valid: report.valid,
        expectedFamilies: [...report.expectedFamilies],
        registeredFamilies: [...report.registeredFamilies],
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function queuedMaterialAdapterRegistryValidationReportToJson(report) {
    return JSON.stringify(queuedMaterialAdapterRegistryValidationReportToJsonValue(report));
}
export function queuedMaterialAdapterRegistryToJsonValue(registry) {
    return {
        adapterCount: registry.adapters.length,
        families: registry.adapters.map((adapter) => adapter.kind),
        diagnostics: registry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function queuedMaterialAdapterRegistryToJson(registry) {
    return JSON.stringify(queuedMaterialAdapterRegistryToJsonValue(registry));
}
function collectRegistryDiagnostics(adapters) {
    const firstIndexByFamily = new Map();
    const diagnostics = [];
    adapters.forEach((adapter, index) => {
        const firstIndex = firstIndexByFamily.get(adapter.kind);
        if (firstIndex === undefined) {
            firstIndexByFamily.set(adapter.kind, index);
            return;
        }
        diagnostics.push({
            code: "queuedMaterialAdapter.duplicateFamily",
            severity: "warning",
            family: adapter.kind,
            firstIndex,
            duplicateIndex: index,
            message: `Material adapter family '${adapter.kind}' is registered more than once; the first adapter at index ${firstIndex} will be used.`,
        });
    });
    return diagnostics;
}
//# sourceMappingURL=queued-material-adapter.js.map