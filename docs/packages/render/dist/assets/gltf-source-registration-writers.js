import { assetHandleKey, createMaterialHandle, createSamplerHandle, createTextureHandle, } from "@aperture-engine/simulation";
import { assetDiagnosticsFromGltfMappingDiagnostics, gltfMaterialDependencyHandles, materialIdFromGltfPlannedHandleKey, } from "./gltf-source-registration-dependencies.js";
import { skipDuplicateGltfSourceAsset, skipGltfSourceAssetRegistration, } from "./gltf-source-registration-skips.js";
export function registerGltfPlannedTextureAsset(input) {
    const handle = createTextureHandle(input.texture.handleKey);
    const registeredHandleKey = assetHandleKey(handle);
    if (!input.texture.report.valid || input.texture.texture === null) {
        skipGltfSourceAssetRegistration({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            entry: {
                kind: "texture",
                plannedHandleKey: input.texture.handleKey,
                registeredHandleKey,
                textureIndex: input.texture.textureIndex,
                slot: input.texture.slot,
            },
            code: "gltfRegistration.invalidPlannedAsset",
            message: `Texture '${registeredHandleKey}' was not registered because its planned source asset is invalid.`,
        });
        return;
    }
    const existingEntry = input.registry.get(handle);
    if (existingEntry !== undefined && existingEntry.status !== "loading") {
        skipDuplicateGltfSourceAsset({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            kind: "texture",
            plannedHandleKey: input.texture.handleKey,
            registeredHandleKey,
            textureIndex: input.texture.textureIndex,
            slot: input.texture.slot,
        });
        return;
    }
    const registryDiagnostics = assetDiagnosticsFromGltfMappingDiagnostics(input.texture.report.diagnostics);
    if (existingEntry === undefined) {
        input.registry.register(handle, {
            label: input.texture.texture.label,
            diagnostics: registryDiagnostics,
        });
    }
    input.registry.markReady(handle, input.texture.texture, registryDiagnostics);
    input.written.push({
        kind: "texture",
        plannedHandleKey: input.texture.handleKey,
        registeredHandleKey,
        textureIndex: input.texture.textureIndex,
        slot: input.texture.slot,
        diagnostics: registryDiagnostics,
    });
}
export function registerGltfPlannedSamplerAsset(input) {
    const handle = createSamplerHandle(input.sampler.handleKey);
    const registeredHandleKey = assetHandleKey(handle);
    if (input.texture === undefined ||
        !input.texture.report.valid ||
        input.sampler.sampler === null) {
        skipGltfSourceAssetRegistration({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            entry: {
                kind: "sampler",
                plannedHandleKey: input.sampler.handleKey,
                registeredHandleKey,
                textureIndex: input.sampler.textureIndex,
                slot: input.sampler.slot,
            },
            code: "gltfRegistration.invalidPlannedAsset",
            message: `Sampler '${registeredHandleKey}' was not registered because its planned source asset is invalid.`,
        });
        return;
    }
    if (input.registry.has(handle)) {
        skipDuplicateGltfSourceAsset({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            kind: "sampler",
            plannedHandleKey: input.sampler.handleKey,
            registeredHandleKey,
            textureIndex: input.sampler.textureIndex,
            slot: input.sampler.slot,
        });
        return;
    }
    const registryDiagnostics = assetDiagnosticsFromGltfMappingDiagnostics(input.texture.report.diagnostics);
    input.registry.register(handle, {
        label: input.sampler.sampler.label,
        diagnostics: registryDiagnostics,
    });
    input.registry.markReady(handle, input.sampler.sampler, registryDiagnostics);
    input.written.push({
        kind: "sampler",
        plannedHandleKey: input.sampler.handleKey,
        registeredHandleKey,
        textureIndex: input.sampler.textureIndex,
        slot: input.sampler.slot,
        diagnostics: registryDiagnostics,
    });
}
export function registerGltfPlannedMaterialAsset(input) {
    const handle = createMaterialHandle(materialIdFromGltfPlannedHandleKey(input.material.handleKey));
    const registeredHandleKey = assetHandleKey(handle);
    if (!input.material.report.valid || input.material.material === null) {
        skipGltfSourceAssetRegistration({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            entry: {
                kind: "material",
                plannedHandleKey: input.material.handleKey,
                registeredHandleKey,
                materialIndex: input.material.materialIndex,
            },
            code: "gltfRegistration.invalidPlannedAsset",
            message: `Material '${registeredHandleKey}' was not registered because its planned source asset is invalid.`,
        });
        return;
    }
    if (input.registry.has(handle)) {
        skipDuplicateGltfSourceAsset({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            kind: "material",
            plannedHandleKey: input.material.handleKey,
            registeredHandleKey,
            materialIndex: input.material.materialIndex,
        });
        return;
    }
    const dependencies = gltfMaterialDependencyHandles(input.material.material);
    const missingDependency = dependencies.find((dependency) => !input.registry.has(dependency));
    if (missingDependency !== undefined) {
        const dependencyKey = assetHandleKey(missingDependency);
        skipGltfSourceAssetRegistration({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            entry: {
                kind: "material",
                plannedHandleKey: input.material.handleKey,
                registeredHandleKey,
                materialIndex: input.material.materialIndex,
                dependencyKey,
            },
            code: "gltfRegistration.missingDependency",
            message: `Material '${registeredHandleKey}' was not registered because dependency '${dependencyKey}' is missing.`,
        });
        return;
    }
    const registryDiagnostics = assetDiagnosticsFromGltfMappingDiagnostics(input.material.report.diagnostics);
    input.registry.register(handle, {
        label: input.material.material.label,
        dependencies,
        diagnostics: registryDiagnostics,
    });
    input.registry.markReady(handle, input.material.material, registryDiagnostics);
    input.written.push({
        kind: "material",
        plannedHandleKey: input.material.handleKey,
        registeredHandleKey,
        materialIndex: input.material.materialIndex,
        dependencyHandleKeys: dependencies.map((dependency) => assetHandleKey(dependency)),
        diagnostics: registryDiagnostics,
    });
}
//# sourceMappingURL=gltf-source-registration-writers.js.map