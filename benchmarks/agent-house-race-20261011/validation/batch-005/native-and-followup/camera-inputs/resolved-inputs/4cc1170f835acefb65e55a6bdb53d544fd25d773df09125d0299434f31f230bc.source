import { findGltfPlannedTextureForSampler } from "./gltf-source-registration-dependencies.js";
import { createGltfSourceAssetRegistrationReport, gltfSourceAssetRegistrationReportToJson, gltfSourceAssetRegistrationReportToJsonValue, } from "./gltf-source-registration-report.js";
import { skipAllGltfSourceAssetsForInvalidRoot } from "./gltf-source-registration-skips.js";
import { registerGltfPlannedMaterialAsset, registerGltfPlannedSamplerAsset, registerGltfPlannedTextureAsset, } from "./gltf-source-registration-writers.js";
export { gltfSourceAssetRegistrationReportToJson, gltfSourceAssetRegistrationReportToJsonValue, };
export function registerGltfSourceAssetsFromMappingReport(options) {
    const diagnostics = [];
    const written = [];
    const skipped = [];
    if (!options.report.root.valid) {
        skipAllGltfSourceAssetsForInvalidRoot(options.report, diagnostics, skipped);
        return createGltfSourceAssetRegistrationReport({
            diagnostics,
            written,
            skipped,
        });
    }
    for (const texture of options.report.textures) {
        registerGltfPlannedTextureAsset({
            registry: options.registry,
            texture,
            diagnostics,
            written,
            skipped,
        });
    }
    for (const sampler of options.report.samplers) {
        registerGltfPlannedSamplerAsset({
            registry: options.registry,
            sampler,
            texture: findGltfPlannedTextureForSampler(options.report, sampler),
            diagnostics,
            written,
            skipped,
        });
    }
    for (const material of options.report.materials) {
        registerGltfPlannedMaterialAsset({
            registry: options.registry,
            material,
            diagnostics,
            written,
            skipped,
        });
    }
    return createGltfSourceAssetRegistrationReport({
        diagnostics,
        written,
        skipped,
    });
}
//# sourceMappingURL=gltf-source-registration.js.map