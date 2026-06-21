import { assetHandleKey } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { createPreparedAppMaterialFallbackDiagnostic, } from "../core/prepared-app-material-resource.js";
import { prepareAppMeshResource, } from "../../resources/meshes/prepared-app-mesh-resource.js";
import { prepareBaseColorTexturedStandardMaterialResource, prepareClearcoatRoughnessTexturedStandardMaterialResource, prepareClearcoatTexturedStandardMaterialResource, prepareIridescenceThicknessTexturedStandardMaterialResource, prepareIridescenceTexturedStandardMaterialResource, prepareMetallicRoughnessTexturedStandardMaterialResource, prepareNormalTexturedStandardMaterialResource, prepareOcclusionEmissiveTexturedStandardMaterialResource, prepareScalarStandardMaterialResource, prepareSheenColorTexturedStandardMaterialResource, prepareSheenRoughnessTexturedStandardMaterialResource, prepareTransmissionTexturedStandardMaterialResource, } from "./prepared-standard-material-cache.js";
export function preparePreparedStandardMesh(options) {
    if (options.mesh === null || options.material === null) {
        return null;
    }
    return prepareAppMeshResource({
        device: options.device,
        mesh: options.mesh,
        meshHandle: options.meshHandle,
        meshKey: options.meshKey,
        frame: options.frame,
        preparedMeshes: options.preparedMeshes,
    });
}
export function preparePreparedStandardMaterial(options, fallbackDiagnostics) {
    if (options.material === null) {
        return null;
    }
    const sourceVersion = sourceVersionFromAssetKey(options.materialKey, options.sourceMaterialKey);
    if (sourceVersion === null) {
        return null;
    }
    const result = options.material.baseColorTexture !== null
        ? prepareBaseColorTexturedStandardMaterialResource({
            registry: options.assets,
            device: options.device,
            cache: options.preparedScalarMaterials,
            handle: options.materialHandle,
            material: options.material,
            sourceVersion,
            frame: options.frame,
            pipelineKey: options.pipelineKey,
            layout: options.materialLayout,
            textures: options.textureSamplerDependencies.textures,
            samplers: options.textureSamplerDependencies.samplers,
        })
        : options.material.metallicRoughnessTexture !== null
            ? prepareMetallicRoughnessTexturedStandardMaterialResource({
                registry: options.assets,
                device: options.device,
                cache: options.preparedScalarMaterials,
                handle: options.materialHandle,
                material: options.material,
                sourceVersion,
                frame: options.frame,
                pipelineKey: options.pipelineKey,
                layout: options.materialLayout,
                textures: options.textureSamplerDependencies.textures,
                samplers: options.textureSamplerDependencies.samplers,
            })
            : options.material.normalTexture !== null
                ? prepareNormalTexturedStandardMaterialResource({
                    registry: options.assets,
                    device: options.device,
                    cache: options.preparedScalarMaterials,
                    handle: options.materialHandle,
                    material: options.material,
                    sourceVersion,
                    frame: options.frame,
                    pipelineKey: options.pipelineKey,
                    layout: options.materialLayout,
                    textures: options.textureSamplerDependencies.textures,
                    samplers: options.textureSamplerDependencies.samplers,
                })
                : options.material.clearcoatTexture !== null
                    ? prepareClearcoatTexturedStandardMaterialResource({
                        registry: options.assets,
                        device: options.device,
                        cache: options.preparedScalarMaterials,
                        handle: options.materialHandle,
                        material: options.material,
                        sourceVersion,
                        frame: options.frame,
                        pipelineKey: options.pipelineKey,
                        layout: options.materialLayout,
                        textures: options.textureSamplerDependencies.textures,
                        samplers: options.textureSamplerDependencies.samplers,
                    })
                    : options.material.clearcoatRoughnessTexture !== null
                        ? prepareClearcoatRoughnessTexturedStandardMaterialResource({
                            registry: options.assets,
                            device: options.device,
                            cache: options.preparedScalarMaterials,
                            handle: options.materialHandle,
                            material: options.material,
                            sourceVersion,
                            frame: options.frame,
                            pipelineKey: options.pipelineKey,
                            layout: options.materialLayout,
                            textures: options.textureSamplerDependencies.textures,
                            samplers: options.textureSamplerDependencies.samplers,
                        })
                        : options.material.transmissionTexture !== null
                            ? prepareTransmissionTexturedStandardMaterialResource({
                                registry: options.assets,
                                device: options.device,
                                cache: options.preparedScalarMaterials,
                                handle: options.materialHandle,
                                material: options.material,
                                sourceVersion,
                                frame: options.frame,
                                pipelineKey: options.pipelineKey,
                                layout: options.materialLayout,
                                textures: options.textureSamplerDependencies.textures,
                                samplers: options.textureSamplerDependencies.samplers,
                            })
                            : options.material.sheenColorTexture !== null
                                ? prepareSheenColorTexturedStandardMaterialResource({
                                    registry: options.assets,
                                    device: options.device,
                                    cache: options.preparedScalarMaterials,
                                    handle: options.materialHandle,
                                    material: options.material,
                                    sourceVersion,
                                    frame: options.frame,
                                    pipelineKey: options.pipelineKey,
                                    layout: options.materialLayout,
                                    textures: options.textureSamplerDependencies.textures,
                                    samplers: options.textureSamplerDependencies.samplers,
                                })
                                : options.material.sheenRoughnessTexture !== null
                                    ? prepareSheenRoughnessTexturedStandardMaterialResource({
                                        registry: options.assets,
                                        device: options.device,
                                        cache: options.preparedScalarMaterials,
                                        handle: options.materialHandle,
                                        material: options.material,
                                        sourceVersion,
                                        frame: options.frame,
                                        pipelineKey: options.pipelineKey,
                                        layout: options.materialLayout,
                                        textures: options.textureSamplerDependencies.textures,
                                        samplers: options.textureSamplerDependencies.samplers,
                                    })
                                    : options.material.iridescenceTexture !== null
                                        ? prepareIridescenceTexturedStandardMaterialResource({
                                            registry: options.assets,
                                            device: options.device,
                                            cache: options.preparedScalarMaterials,
                                            handle: options.materialHandle,
                                            material: options.material,
                                            sourceVersion,
                                            frame: options.frame,
                                            pipelineKey: options.pipelineKey,
                                            layout: options.materialLayout,
                                            textures: options.textureSamplerDependencies.textures,
                                            samplers: options.textureSamplerDependencies.samplers,
                                        })
                                        : options.material.iridescenceThicknessTexture !== null
                                            ? prepareIridescenceThicknessTexturedStandardMaterialResource({
                                                registry: options.assets,
                                                device: options.device,
                                                cache: options.preparedScalarMaterials,
                                                handle: options.materialHandle,
                                                material: options.material,
                                                sourceVersion,
                                                frame: options.frame,
                                                pipelineKey: options.pipelineKey,
                                                layout: options.materialLayout,
                                                textures: options.textureSamplerDependencies.textures,
                                                samplers: options.textureSamplerDependencies.samplers,
                                            })
                                            : options.material.occlusionTexture !== null ||
                                                options.material.emissiveTexture !== null
                                                ? prepareOcclusionEmissiveTexturedStandardMaterialResource({
                                                    registry: options.assets,
                                                    device: options.device,
                                                    cache: options.preparedScalarMaterials,
                                                    handle: options.materialHandle,
                                                    material: options.material,
                                                    sourceVersion,
                                                    frame: options.frame,
                                                    pipelineKey: options.pipelineKey,
                                                    layout: options.materialLayout,
                                                    textures: options.textureSamplerDependencies.textures,
                                                    samplers: options.textureSamplerDependencies.samplers,
                                                })
                                                : prepareScalarStandardMaterialResource({
                                                    device: options.device,
                                                    cache: options.preparedScalarMaterials,
                                                    handle: options.materialHandle,
                                                    material: options.material,
                                                    sourceVersion,
                                                    frame: options.frame,
                                                    pipelineKey: options.pipelineKey,
                                                    layout: options.materialLayout,
                                                });
    if (result.valid &&
        result.resource !== null &&
        (result.status === "created" || result.status === "reused")) {
        return { status: result.status, resource: result.resource };
    }
    const diagnostic = createPreparedAppMaterialFallbackDiagnostic({
        materialFamily: "standard",
        materialKey: assetHandleKey(options.materialHandle),
        status: result.status,
        diagnostics: result.diagnostics,
    });
    if (diagnostic !== null) {
        fallbackDiagnostics.push(diagnostic);
    }
    return null;
}
function sourceVersionFromAssetKey(assetKey, sourceAssetKey) {
    const prefix = `${sourceAssetKey}@`;
    if (!assetKey.startsWith(prefix)) {
        return null;
    }
    const version = Number.parseInt(assetKey.slice(prefix.length), 10);
    return Number.isFinite(version) ? version : null;
}
//# sourceMappingURL=standard-app-prepared-resources.js.map