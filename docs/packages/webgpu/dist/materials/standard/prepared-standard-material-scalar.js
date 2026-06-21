import { assetHandleKey } from "@aperture-engine/simulation";
import { createStandardMaterialBindGroupDescriptorPlan, createStandardMaterialBindGroupResource, } from "./standard-bind-group.js";
import { createStandardMaterialGpuBuffer } from "./standard-material-buffer-resource.js";
import { createStandardMaterialPreparationPlan } from "./standard-material-buffer.js";
import { isScalarStandardMaterial } from "./prepared-standard-material-classification.js";
import { emptyStandardMaterialDependencies, preparedScalarStandardMaterialCacheKey, } from "./prepared-standard-material-cache-helpers.js";
export function createPreparedScalarStandardMaterialCache() {
    return { resources: new Map() };
}
export function prepareScalarStandardMaterialResource(options) {
    const sourceMaterialKey = assetHandleKey(options.handle);
    if (!isScalarStandardMaterial(options.material)) {
        return {
            valid: true,
            status: "skipped",
            resource: null,
            diagnostics: [
                {
                    code: "preparedScalarStandardMaterial.notScalar",
                    materialKey: sourceMaterialKey,
                    message: "Scalar StandardMaterial prepared caching does not handle textured StandardMaterial variants.",
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
                    code: "preparedScalarStandardMaterial.missingLayout",
                    materialKey: sourceMaterialKey,
                    message: "Scalar StandardMaterial prepared caching requires a group-2 material bind group layout.",
                },
            ],
        };
    }
    const cacheKey = preparedScalarStandardMaterialCacheKey({
        sourceMaterialKey,
        sourceVersion: options.sourceVersion,
        pipelineKey: options.pipelineKey,
        layoutKey: options.layout.layoutKey,
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
    });
    const diagnostics = [
        ...preparation.diagnostics,
        ...material.diagnostics,
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
                code: "preparedScalarStandardMaterial.missingPreparedBindGroup",
                materialKey: sourceMaterialKey,
                layoutKey: options.layout.layoutKey,
                message: "Scalar StandardMaterial prepared caching did not create a group-2 bind group.",
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
//# sourceMappingURL=prepared-standard-material-scalar.js.map