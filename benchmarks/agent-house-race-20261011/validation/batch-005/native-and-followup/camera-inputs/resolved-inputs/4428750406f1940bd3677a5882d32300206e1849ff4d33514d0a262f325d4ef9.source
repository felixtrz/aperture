import { assetHandleKey } from "@aperture-engine/simulation";
import { materialTextureBindings } from "./bindings.js";
import { inspectMaterialDependencySlot } from "./dependency-readiness-inspection.js";
import { isCustomWgslMaterialAsset } from "./family-key.js";
export function createMaterialAssetDependencyReadinessReport(options) {
    const materialKey = assetHandleKey(options.material);
    const materialEntry = options.registry.get(options.material);
    const diagnostics = [];
    const slots = [];
    if (materialEntry === undefined) {
        diagnostics.push({
            code: "materialDependency.missingMaterial",
            materialKey,
            message: `Material '${materialKey}' is not registered.`,
        });
        return {
            ready: false,
            materialKey,
            materialStatus: "missing",
            dependencies: slots,
            slots,
            diagnostics,
        };
    }
    if (materialEntry.status !== "ready" || materialEntry.asset === null) {
        diagnostics.push({
            code: "materialDependency.materialNotReady",
            materialKey,
            status: materialEntry.status,
            message: `Material '${materialKey}' is '${materialEntry.status}', not ready.`,
        });
        return {
            ready: false,
            materialKey,
            materialStatus: materialEntry.status,
            dependencies: slots,
            slots,
            diagnostics,
        };
    }
    if (isCustomWgslMaterialAsset(materialEntry.asset)) {
        for (const dependency of customMaterialDependencies(materialEntry.asset)) {
            inspectMaterialDependencySlot({
                registry: options.registry,
                materialKey,
                field: dependency.field,
                dependencyKind: dependency.kind,
                handle: dependency.handle,
                textureKey: dependency.kind === "texture"
                    ? assetHandleKey(dependency.handle)
                    : undefined,
                samplerKey: dependency.kind === "sampler"
                    ? assetHandleKey(dependency.handle)
                    : undefined,
                slots,
                diagnostics,
            });
        }
    }
    else {
        for (const [field, binding] of materialTextureBindings(materialEntry.asset)) {
            const textureKey = binding.texture === null ? undefined : assetHandleKey(binding.texture);
            const samplerKey = binding.sampler === null ? undefined : assetHandleKey(binding.sampler);
            inspectMaterialDependencySlot({
                registry: options.registry,
                materialKey,
                field,
                dependencyKind: "texture",
                handle: binding.texture,
                textureKey,
                samplerKey,
                slots,
                diagnostics,
            });
            inspectMaterialDependencySlot({
                registry: options.registry,
                materialKey,
                field,
                dependencyKind: "sampler",
                handle: binding.sampler,
                textureKey,
                samplerKey,
                slots,
                diagnostics,
            });
        }
    }
    return {
        ready: diagnostics.length === 0,
        materialKey,
        materialStatus: materialEntry.status,
        ...("kind" in materialEntry.asset
            ? { materialKind: materialEntry.asset.kind }
            : {}),
        dependencies: slots,
        slots,
        diagnostics,
    };
}
function customMaterialDependencies(material) {
    const dependencies = [];
    const seen = new Set();
    for (const dependency of material.dependencies) {
        appendCustomDependency({
            field: `${dependency.kind}:${assetHandleKey(dependency.handle)}`,
            kind: dependency.kind,
            handle: dependency.handle,
        }, dependencies, seen);
    }
    for (const binding of material.bindings) {
        if (binding.kind === "texture") {
            appendCustomDependency({
                field: binding.name,
                kind: "texture",
                handle: binding.texture,
            }, dependencies, seen);
        }
        if (binding.kind === "sampler") {
            appendCustomDependency({
                field: binding.name,
                kind: "sampler",
                handle: binding.sampler,
            }, dependencies, seen);
        }
    }
    return dependencies;
}
function appendCustomDependency(dependency, dependencies, seen) {
    const key = `${dependency.kind}:${assetHandleKey(dependency.handle)}`;
    if (seen.has(key)) {
        return;
    }
    seen.add(key);
    dependencies.push(dependency);
}
export function createMaterialDependencyReadinessReport(options) {
    return createMaterialAssetDependencyReadinessReport(options);
}
export function materialAssetDependencyReadinessReportToJsonValue(report) {
    const slots = report.slots.map((slot) => ({ ...slot }));
    return {
        ready: report.ready,
        materialKey: report.materialKey,
        materialStatus: report.materialStatus,
        ...(report.materialKind === undefined
            ? {}
            : { materialKind: report.materialKind }),
        dependencies: slots,
        slots,
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function materialDependencyReadinessReportToJsonValue(report) {
    return materialAssetDependencyReadinessReportToJsonValue(report);
}
export function materialAssetDependencyReadinessReportToJson(report) {
    return JSON.stringify(materialAssetDependencyReadinessReportToJsonValue(report));
}
export function materialDependencyReadinessReportToJson(report) {
    return materialAssetDependencyReadinessReportToJson(report);
}
//# sourceMappingURL=dependency-readiness.js.map