import { assetHandleKey, } from "@aperture-engine/simulation";
import { createStandardMaterialBindGroupDescriptorPlan, createStandardMaterialBindGroupResource, } from "./standard-bind-group.js";
import { createStandardMaterialGpuBuffer, } from "./standard-material-buffer-resource.js";
import { createStandardMaterialPreparationPlan, } from "./standard-material-buffer.js";
import { isBaseColorOnlyStandardMaterial, isClearcoatOnlyStandardMaterial, isClearcoatRoughnessOnlyStandardMaterial, isIridescenceOnlyStandardMaterial, isIridescenceThicknessOnlyStandardMaterial, isMetallicRoughnessOnlyStandardMaterial, isNormalOnlyStandardMaterial, isOcclusionEmissiveOnlyStandardMaterial, isSheenColorOnlyStandardMaterial, isSheenRoughnessOnlyStandardMaterial, isTransmissionOnlyStandardMaterial, } from "./prepared-standard-material-classification.js";
import { emptyStandardMaterialDependencies, preparedTexturedStandardMaterialCacheKey, } from "./prepared-standard-material-cache-helpers.js";
import { createPreparedStandardBaseColorTextureDependencyKeys, createPreparedStandardClearcoatRoughnessTextureDependencyKeys, createPreparedStandardClearcoatTextureDependencyKeys, createPreparedStandardIridescenceTextureDependencyKeys, createPreparedStandardIridescenceThicknessTextureDependencyKeys, createPreparedStandardMetallicRoughnessTextureDependencyKeys, createPreparedStandardNormalTextureDependencyKeys, createPreparedStandardSheenColorTextureDependencyKeys, createPreparedStandardSheenRoughnessTextureDependencyKeys, createPreparedStandardTextureBindingDependencyKeys, createPreparedStandardTextureDependencyKeys, createPreparedStandardTransmissionTextureDependencyKeys, standardTextureBinding, } from "./prepared-standard-material-dependencies.js";
export { preparedScalarStandardMaterialCacheKey, preparedTexturedStandardMaterialCacheKey, } from "./prepared-standard-material-cache-helpers.js";
export { createPreparedScalarStandardMaterialCache, prepareScalarStandardMaterialResource, } from "./prepared-standard-material-scalar.js";
export { createPreparedStandardBaseColorTextureDependencyKeys, createPreparedStandardClearcoatRoughnessTextureDependencyKeys, createPreparedStandardClearcoatTextureDependencyKeys, createPreparedStandardIridescenceTextureDependencyKeys, createPreparedStandardIridescenceThicknessTextureDependencyKeys, createPreparedStandardMetallicRoughnessTextureDependencyKeys, createPreparedStandardNormalTextureDependencyKeys, createPreparedStandardSheenColorTextureDependencyKeys, createPreparedStandardSheenRoughnessTextureDependencyKeys, createPreparedStandardTextureDependencyKeys, createPreparedStandardTransmissionTextureDependencyKeys, };
export function prepareBaseColorTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "baseColorTexture",
        acceptsMaterial: isBaseColorOnlyStandardMaterial,
        notTexturedCode: "preparedBaseColorTexturedStandardMaterial.notBaseColorTextured",
        missingLayoutCode: "preparedBaseColorTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedBaseColorTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Base-color textured StandardMaterial prepared caching requires exactly a base-color texture binding.",
        missingLayoutMessage: "Base-color textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Base-color textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        diagnostics: result.diagnostics,
    };
}
export function prepareMetallicRoughnessTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "metallicRoughnessTexture",
        acceptsMaterial: isMetallicRoughnessOnlyStandardMaterial,
        notTexturedCode: "preparedMetallicRoughnessTexturedStandardMaterial.notMetallicRoughnessTextured",
        missingLayoutCode: "preparedMetallicRoughnessTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedMetallicRoughnessTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Metallic-roughness textured StandardMaterial prepared caching requires exactly a metallic-roughness texture binding.",
        missingLayoutMessage: "Metallic-roughness textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Metallic-roughness textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        diagnostics: result.diagnostics,
    };
}
export function prepareNormalTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "normalTexture",
        acceptsMaterial: isNormalOnlyStandardMaterial,
        notTexturedCode: "preparedNormalTexturedStandardMaterial.notNormalTextured",
        missingLayoutCode: "preparedNormalTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedNormalTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Normal textured StandardMaterial prepared caching requires exactly a normal texture binding.",
        missingLayoutMessage: "Normal textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Normal textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        diagnostics: result.diagnostics,
    };
}
export function prepareClearcoatTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "clearcoatTexture",
        acceptsMaterial: isClearcoatOnlyStandardMaterial,
        notTexturedCode: "preparedClearcoatTexturedStandardMaterial.notClearcoatTextured",
        missingLayoutCode: "preparedClearcoatTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedClearcoatTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Clearcoat textured StandardMaterial prepared caching requires exactly a clearcoat texture binding.",
        missingLayoutMessage: "Clearcoat textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Clearcoat textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        resource: result.resource,
        diagnostics: result.diagnostics,
    };
}
export function prepareClearcoatRoughnessTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "clearcoatRoughnessTexture",
        acceptsMaterial: isClearcoatRoughnessOnlyStandardMaterial,
        notTexturedCode: "preparedClearcoatRoughnessTexturedStandardMaterial.notClearcoatRoughnessTextured",
        missingLayoutCode: "preparedClearcoatRoughnessTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedClearcoatRoughnessTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Clearcoat roughness textured StandardMaterial prepared caching requires exactly a clearcoat roughness texture binding.",
        missingLayoutMessage: "Clearcoat roughness textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Clearcoat roughness textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        resource: result.resource,
        diagnostics: result.diagnostics,
    };
}
export function prepareTransmissionTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "transmissionTexture",
        acceptsMaterial: isTransmissionOnlyStandardMaterial,
        notTexturedCode: "preparedTransmissionTexturedStandardMaterial.notTransmissionTextured",
        missingLayoutCode: "preparedTransmissionTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedTransmissionTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Transmission textured StandardMaterial prepared caching requires exactly a transmission texture binding.",
        missingLayoutMessage: "Transmission textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Transmission textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        resource: result.resource,
        diagnostics: result.diagnostics,
    };
}
export function prepareSheenColorTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "sheenColorTexture",
        acceptsMaterial: isSheenColorOnlyStandardMaterial,
        notTexturedCode: "preparedSheenColorTexturedStandardMaterial.notSheenColorTextured",
        missingLayoutCode: "preparedSheenColorTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedSheenColorTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Sheen color textured StandardMaterial prepared caching requires exactly a sheen color texture binding.",
        missingLayoutMessage: "Sheen color textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Sheen color textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        resource: result.resource,
        diagnostics: result.diagnostics,
    };
}
export function prepareSheenRoughnessTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "sheenRoughnessTexture",
        acceptsMaterial: isSheenRoughnessOnlyStandardMaterial,
        notTexturedCode: "preparedSheenRoughnessTexturedStandardMaterial.notSheenRoughnessTextured",
        missingLayoutCode: "preparedSheenRoughnessTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedSheenRoughnessTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Sheen roughness textured StandardMaterial prepared caching requires exactly a sheen roughness texture binding.",
        missingLayoutMessage: "Sheen roughness textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Sheen roughness textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        resource: result.resource,
        diagnostics: result.diagnostics,
    };
}
export function prepareIridescenceTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "iridescenceTexture",
        acceptsMaterial: isIridescenceOnlyStandardMaterial,
        notTexturedCode: "preparedIridescenceTexturedStandardMaterial.notIridescenceTextured",
        missingLayoutCode: "preparedIridescenceTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedIridescenceTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Iridescence textured StandardMaterial prepared caching requires exactly an iridescence texture binding.",
        missingLayoutMessage: "Iridescence textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Iridescence textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        resource: result.resource,
        diagnostics: result.diagnostics,
    };
}
export function prepareIridescenceThicknessTexturedStandardMaterialResource(options) {
    const result = prepareSingleTexturedStandardMaterialResource(options, {
        field: "iridescenceThicknessTexture",
        acceptsMaterial: isIridescenceThicknessOnlyStandardMaterial,
        notTexturedCode: "preparedIridescenceThicknessTexturedStandardMaterial.notIridescenceThicknessTextured",
        missingLayoutCode: "preparedIridescenceThicknessTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedIridescenceThicknessTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Iridescence thickness textured StandardMaterial prepared caching requires exactly an iridescence thickness texture binding.",
        missingLayoutMessage: "Iridescence thickness textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Iridescence thickness textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        resource: result.resource,
        diagnostics: result.diagnostics,
    };
}
export function prepareOcclusionEmissiveTexturedStandardMaterialResource(options) {
    const result = prepareTextureSetTexturedStandardMaterialResource(options, {
        acceptsMaterial: isOcclusionEmissiveOnlyStandardMaterial,
        createDependencies: createPreparedStandardTextureDependencyKeys,
        notTexturedCode: "preparedOcclusionEmissiveTexturedStandardMaterial.notOcclusionEmissiveTextured",
        missingLayoutCode: "preparedOcclusionEmissiveTexturedStandardMaterial.missingLayout",
        missingPreparedBindGroupCode: "preparedOcclusionEmissiveTexturedStandardMaterial.missingPreparedBindGroup",
        notTexturedMessage: "Occlusion/emissive textured StandardMaterial prepared caching requires occlusion and/or emissive texture bindings with no other texture families.",
        missingLayoutMessage: "Occlusion/emissive textured StandardMaterial prepared caching requires a group-2 material bind group layout.",
        missingPreparedBindGroupMessage: "Occlusion/emissive textured StandardMaterial prepared caching did not create a group-2 bind group.",
    });
    return {
        ...result,
        resource: result.resource,
        diagnostics: result.diagnostics,
    };
}
function prepareSingleTexturedStandardMaterialResource(options, config) {
    const result = prepareTextureSetTexturedStandardMaterialResource(options, {
        ...config,
        includeSingularResourceKeys: true,
        createDependencies: ({ registry, material }) => {
            const binding = standardTextureBinding(material, config.field);
            if (binding === null) {
                return { valid: true, dependencies: null, diagnostics: [] };
            }
            const single = createPreparedStandardTextureBindingDependencyKeys({
                registry,
                field: config.field,
                binding,
            });
            return single.dependencies === null
                ? {
                    valid: single.valid,
                    dependencies: null,
                    diagnostics: single.diagnostics,
                }
                : {
                    valid: single.valid,
                    dependencies: {
                        bindings: [single.dependencies],
                        cacheKeySegments: single.dependencies.cacheKeySegments,
                    },
                    diagnostics: single.diagnostics,
                };
        },
    });
    return {
        ...result,
        resource: result.resource,
    };
}
function prepareTextureSetTexturedStandardMaterialResource(options, config) {
    const sourceMaterialKey = assetHandleKey(options.handle);
    if (!config.acceptsMaterial(options.material)) {
        return {
            valid: true,
            status: "skipped",
            resource: null,
            diagnostics: [
                {
                    code: config.notTexturedCode,
                    materialKey: sourceMaterialKey,
                    message: config.notTexturedMessage,
                },
            ],
        };
    }
    if (options.layout === null) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: [
                {
                    code: config.missingLayoutCode,
                    materialKey: sourceMaterialKey,
                    message: config.missingLayoutMessage,
                },
            ],
        };
    }
    const dependencyResult = config.createDependencies({
        registry: options.registry,
        material: options.material,
    });
    if (!dependencyResult.valid || dependencyResult.dependencies === null) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: dependencyResult.diagnostics,
        };
    }
    const cacheKey = preparedTexturedStandardMaterialCacheKey({
        sourceMaterialKey,
        sourceVersion: options.sourceVersion,
        pipelineKey: options.pipelineKey,
        layoutKey: options.layout.layoutKey,
        dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
    });
    const cached = options.cache.resources.get(cacheKey);
    if (cached !== undefined) {
        cached.lastUsedFrame = options.frame ?? 0;
        return {
            valid: true,
            status: "reused",
            resource: cached,
            diagnostics: [],
        };
    }
    const preparation = createStandardMaterialPreparationPlan(options.material, {
        label: `prepared-material:${sourceMaterialKey}`,
    });
    const material = createStandardMaterialGpuBuffer({
        device: options.device,
        plan: preparation.plan?.materialBuffer ?? null,
    });
    const bindGroupPlan = createStandardMaterialBindGroupDescriptorPlan({
        materialResourceKey: material.resource?.resourceKey ?? null,
        dependencies: preparation.plan?.materialBuffer.dependencies ??
            emptyStandardMaterialDependencies(),
    });
    const bindGroup = createStandardMaterialBindGroupResource({
        device: options.device,
        plan: bindGroupPlan,
        layout: options.layout,
        buffers: material.resource === null
            ? []
            : [
                {
                    resourceKey: material.resource.resourceKey,
                    buffer: material.resource.uniformBuffer,
                },
            ],
        textures: options.textures,
        samplers: options.samplers,
    });
    const diagnostics = [
        ...preparation.diagnostics,
        ...material.diagnostics,
        ...bindGroupPlan.diagnostics,
        ...bindGroup.diagnostics,
    ];
    if (diagnostics.length > 0 ||
        !preparation.valid ||
        preparation.plan === null ||
        !material.valid ||
        material.resource === null ||
        !bindGroup.valid ||
        bindGroup.resource === null) {
        if (bindGroup.resource === null && diagnostics.length === 0) {
            diagnostics.push({
                code: config.missingPreparedBindGroupCode,
                materialKey: sourceMaterialKey,
                layoutKey: options.layout.layoutKey,
                message: config.missingPreparedBindGroupMessage,
            });
        }
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics,
        };
    }
    const textureResourceKeys = dependencyResult.dependencies.bindings.map((binding) => binding.texture.handleKey);
    const samplerResourceKeys = dependencyResult.dependencies.bindings.map((binding) => binding.sampler.handleKey);
    const resource = {
        cacheKey,
        sourceMaterialKey,
        sourceVersion: options.sourceVersion,
        lastUsedFrame: options.frame ?? 0,
        pipelineKey: options.pipelineKey,
        layoutKey: options.layout.layoutKey,
        dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
        textureResourceKeys,
        samplerResourceKeys,
        ...(config.includeSingularResourceKeys
            ? {
                textureResourceKey: textureResourceKeys[0] ?? "missing",
                samplerResourceKey: samplerResourceKeys[0] ?? "missing",
            }
            : {}),
        materialResourceKey: material.resource.resourceKey,
        bindGroupResourceKey: bindGroup.resource.resourceKey,
        material: material.resource,
        bindGroup: bindGroup.resource,
    };
    options.cache.resources.set(cacheKey, resource);
    return {
        valid: true,
        status: "created",
        resource,
        diagnostics: [],
    };
}
//# sourceMappingURL=prepared-standard-material-cache.js.map