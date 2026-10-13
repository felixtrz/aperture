import { assetHandleKey, } from "@aperture-engine/simulation";
import { createMatcapPreparedMaterialResourceDescriptor, } from "@aperture-engine/render";
import { createMatcapMaterialBindGroupDescriptorPlan, createMatcapMaterialBindGroupResource, } from "./matcap-bind-group.js";
import { createMatcapMaterialGpuBuffer, } from "./matcap-material-buffer-resource.js";
import { createMatcapMaterialGpuPreparationPlan, } from "./matcap-material-buffer.js";
export function createPreparedMatcapMaterialCache() {
    return { resources: new Map() };
}
export function createPreparedMatcapTextureDependencyKeys(options) {
    const binding = options.material.matcapTexture;
    const diagnostics = [];
    if (binding?.texture === null || binding?.texture === undefined) {
        diagnostics.push({
            code: "preparedMatcapTextureDependency.missingTextureHandle",
            field: "matcapTexture.texture",
            message: "Prepared Matcap material resources require a matcap texture handle.",
        });
    }
    if (binding?.sampler === null || binding?.sampler === undefined) {
        diagnostics.push({
            code: "preparedMatcapTextureDependency.missingSamplerHandle",
            field: "matcapTexture.sampler",
            message: "Prepared Matcap material resources require a matcap sampler handle.",
        });
    }
    const texture = binding?.texture === null || binding?.texture === undefined
        ? null
        : preparedTextureDependencyVersionKey({
            registry: options.registry,
            handle: binding.texture,
            diagnostics,
        });
    const sampler = binding?.sampler === null || binding?.sampler === undefined
        ? null
        : preparedSamplerDependencyVersionKey({
            registry: options.registry,
            handle: binding.sampler,
            diagnostics,
        });
    if (diagnostics.length > 0 || texture === null || sampler === null) {
        return { valid: false, dependencies: null, diagnostics };
    }
    return {
        valid: true,
        dependencies: {
            texture,
            sampler,
            cacheKeySegments: [
                `matcapTexture:texture:${texture.versionKey}`,
                `matcapTexture:sampler:${sampler.versionKey}`,
            ],
        },
        diagnostics: [],
    };
}
export function prepareMatcapMaterialResource(options) {
    const sourceMaterialKey = assetHandleKey(options.handle);
    if (options.layout === null) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: [
                {
                    code: "preparedMatcapMaterial.missingLayout",
                    materialKey: sourceMaterialKey,
                    message: "Matcap prepared material caching requires a group-2 material bind group layout.",
                },
            ],
        };
    }
    const dependencyResult = createPreparedMatcapTextureDependencyKeys({
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
    const descriptorResult = createMatcapPreparedMaterialResourceDescriptor({
        registry: options.registry,
        material: options.handle,
    });
    if (!descriptorResult.valid || descriptorResult.descriptor === null) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: descriptorResult.diagnostics,
        };
    }
    const cacheKey = preparedMatcapMaterialCacheKey({
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
    const preparation = createMatcapMaterialGpuPreparationPlan(options.material, {
        label: descriptorResult.descriptor.materialResourceKey,
    });
    const material = createMatcapMaterialGpuBuffer({
        device: options.device,
        plan: preparation.plan?.materialBuffer ?? null,
    });
    const bindGroupPlan = createMatcapMaterialBindGroupDescriptorPlan({
        materialResourceKey: material.resource?.resourceKey ?? null,
        dependencies: {
            matcapTexture: {
                textureKey: dependencyResult.dependencies.texture.handleKey,
                samplerKey: dependencyResult.dependencies.sampler.handleKey,
            },
        },
    });
    const bindGroup = createMatcapMaterialBindGroupResource({
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
                code: "preparedMatcapMaterial.missingPreparedBindGroup",
                materialKey: sourceMaterialKey,
                layoutKey: options.layout.layoutKey,
                message: "Matcap prepared material caching did not create a group-2 bind group.",
            });
        }
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics,
        };
    }
    const resource = {
        cacheKey,
        sourceMaterialKey,
        sourceVersion: options.sourceVersion,
        lastUsedFrame: options.frame ?? 0,
        pipelineKey: options.pipelineKey,
        layoutKey: options.layout.layoutKey,
        dependencyCacheKeySegments: dependencyResult.dependencies.cacheKeySegments,
        textureResourceKey: dependencyResult.dependencies.texture.handleKey,
        samplerResourceKey: dependencyResult.dependencies.sampler.handleKey,
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
export function preparedMatcapMaterialCacheKey(input) {
    return [
        input.sourceMaterialKey,
        `version:${input.sourceVersion}`,
        `pipeline:${input.pipelineKey}`,
        `layout:${input.layoutKey}`,
        ...input.dependencyCacheKeySegments,
    ].join("|");
}
function preparedTextureDependencyVersionKey(options) {
    const resourceKey = assetHandleKey(options.handle);
    const entry = options.registry.get(options.handle);
    if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
        options.diagnostics.push({
            code: "preparedMatcapTextureDependency.textureSourceNotReady",
            resourceKey,
            status: entry?.status ?? "missing",
            message: `Texture source asset '${resourceKey}' is not ready for prepared Matcap material resources.`,
        });
        return null;
    }
    return {
        kind: "texture",
        handleKey: resourceKey,
        version: entry.version,
        versionKey: preparedDependencyVersionKey(resourceKey, entry.version),
    };
}
function preparedSamplerDependencyVersionKey(options) {
    const resourceKey = assetHandleKey(options.handle);
    const entry = options.registry.get(options.handle);
    if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
        options.diagnostics.push({
            code: "preparedMatcapTextureDependency.samplerSourceNotReady",
            resourceKey,
            status: entry?.status ?? "missing",
            message: `Sampler source asset '${resourceKey}' is not ready for prepared Matcap material resources.`,
        });
        return null;
    }
    return {
        kind: "sampler",
        handleKey: resourceKey,
        version: entry.version,
        versionKey: preparedDependencyVersionKey(resourceKey, entry.version),
    };
}
function preparedDependencyVersionKey(resourceKey, version) {
    return `${resourceKey}@${version}`;
}
//# sourceMappingURL=prepared-matcap-material-cache.js.map