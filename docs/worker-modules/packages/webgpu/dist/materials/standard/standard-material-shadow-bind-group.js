import { bindGroupResourceKey } from "../../resources/core/resource-keys.js";
import { createStandardMaterialShadowBindGroupLayoutPlan, validateStandardMaterialShadowBindGroupLayout, } from "./standard-material-shadow-bind-group-layout.js";
export { shadowSamplerResourceReportToJson, shadowSamplerResourceReportToJsonValue, standardMaterialShadowBindGroupDescriptorReadinessReportToJson, standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue, standardMaterialShadowBindGroupResourceReportToJson, standardMaterialShadowBindGroupResourceReportToJsonValue, } from "./standard-material-shadow-bind-group-report.js";
export function createShadowSamplerResourceReport(options) {
    const resourceKey = options.resourceKey ?? "shadow-sampler:directional";
    const cached = options.cache?.get(resourceKey);
    if (cached !== undefined) {
        return shadowSamplerReport({
            status: "available",
            createdSamplerCount: 0,
            reusedSamplerCount: 1,
            resource: cached,
            diagnostics: shadowSamplerDeferredDiagnostics(),
        });
    }
    if (options.device.createSampler === undefined) {
        return shadowSamplerReport({
            status: "missing",
            createdSamplerCount: 0,
            reusedSamplerCount: 0,
            resource: null,
            diagnostics: [
                {
                    code: "shadowSamplerResource.createSamplerUnavailable",
                    severity: "warning",
                    resourceKey,
                    message: "WebGPU device cannot create shadow samplers.",
                },
            ],
        });
    }
    const descriptor = createShadowSamplerDescriptor(resourceKey);
    try {
        const resource = {
            resourceKey,
            sampler: options.device.createSampler(descriptor),
            descriptor,
        };
        options.cache?.set(resourceKey, resource);
        return shadowSamplerReport({
            status: "available",
            createdSamplerCount: 1,
            reusedSamplerCount: 0,
            resource,
            diagnostics: shadowSamplerDeferredDiagnostics(),
        });
    }
    catch (cause) {
        return shadowSamplerReport({
            status: "missing",
            createdSamplerCount: 0,
            reusedSamplerCount: 0,
            resource: null,
            diagnostics: [
                {
                    code: "shadowSamplerResource.creationFailed",
                    severity: "warning",
                    resourceKey,
                    message: `Failed to create shadow sampler '${resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        });
    }
}
export function createStandardMaterialShadowBindGroupDescriptorPlan(options) {
    const layout = options.layout ?? createStandardMaterialShadowBindGroupLayoutPlan();
    const diagnostics = [];
    const entries = [];
    if (!layout.valid) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroup.invalidLayout",
            severity: "warning",
            message: "StandardMaterial shadow bind-group descriptor planning requires valid group 5 layout metadata.",
        });
    }
    if (options.matrixBufferResource.resource === null) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroup.missingMatrixBufferResource",
            severity: "warning",
            binding: 0,
            message: "StandardMaterial shadow bind-group descriptor planning requires an available shadow matrix buffer resource.",
        });
    }
    else {
        entries.push({
            group: 5,
            binding: 0,
            resourceKey: options.matrixBufferResource.resource.resourceKey,
            resourceKind: "buffer",
        });
    }
    const depthTexture = firstValidDepthTextureResource(options.depthTextureResources);
    if (depthTexture === null) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroup.missingDepthTextureResource",
            severity: "warning",
            binding: 1,
            message: "StandardMaterial shadow bind-group descriptor planning requires an available shadow depth texture resource.",
        });
    }
    else if (!isSupportedDirectionalShadowDepthView(depthTexture)) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroup.unsupportedDepthTextureView",
            severity: "warning",
            binding: 1,
            resourceKey: depthTexture.textureKey,
            message: "StandardMaterial shadow bind-group descriptor planning supports one 2D directional shadow map or a 2D-array cascaded directional shadow map.",
        });
    }
    else {
        entries.push({
            group: 5,
            binding: 1,
            resourceKey: depthTexture.textureKey,
            resourceKind: "texture-view",
        });
    }
    const samplerResource = options.samplerResource ?? null;
    if (samplerResource === null) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroup.samplerResourceDeferred",
            severity: "warning",
            binding: 2,
            resourceKey: options.samplerResourceKey ?? "shadow-sampler:directional",
            message: "StandardMaterial shadow bind-group descriptor planning requires a live shadow sampler resource, which is deferred.",
        });
    }
    else if (samplerResource.resource === null) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroup.missingSamplerResource",
            severity: "warning",
            binding: 2,
            resourceKey: options.samplerResourceKey ?? "shadow-sampler:directional",
            message: "StandardMaterial shadow bind-group descriptor planning requires an available shadow sampler resource.",
        });
    }
    else {
        entries.push({
            group: 5,
            binding: 2,
            resourceKey: samplerResource.resource.resourceKey,
            resourceKind: "sampler",
        });
    }
    return {
        valid: diagnostics.length === 0,
        group: 5,
        resourceKey: diagnostics.length === 0
            ? createStandardMaterialShadowBindGroupResourceKey(entries)
            : null,
        entries,
        diagnostics,
    };
}
export function createStandardMaterialShadowBindGroupDescriptorReadinessReport(options) {
    if (options.standardMaterialCount === 0) {
        return {
            ready: true,
            status: "not-required",
            standardMaterialCount: 0,
            group: 5,
            entryCount: 0,
            sections: {
                layoutMetadata: true,
                descriptorPlan: true,
                matrixBufferResource: true,
                depthTextureResource: true,
                samplerResource: false,
                bindGroupResource: false,
                shaderSampling: false,
            },
            plan: null,
            diagnostics: [],
        };
    }
    const plan = createStandardMaterialShadowBindGroupDescriptorPlan(options);
    const hasBlockingMissingResources = plan.diagnostics.some((diagnostic) => diagnostic.code === "standardMaterialShadowBindGroup.invalidLayout" ||
        diagnostic.code ===
            "standardMaterialShadowBindGroup.missingMatrixBufferResource" ||
        diagnostic.code ===
            "standardMaterialShadowBindGroup.missingDepthTextureResource" ||
        diagnostic.code ===
            "standardMaterialShadowBindGroup.unsupportedDepthTextureView" ||
        diagnostic.code ===
            "standardMaterialShadowBindGroup.missingSamplerResource");
    const diagnostics = [
        ...plan.diagnostics,
    ];
    if (!hasBlockingMissingResources) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroup.bindGroupCreationDeferred",
            severity: "warning",
            message: "StandardMaterial shadow bind-group descriptor keys are planned, but live bind-group creation is deferred.",
        }, {
            code: "standardMaterialShadowBindGroup.shaderSamplingDeferred",
            severity: "warning",
            message: "StandardMaterial shadow bind-group descriptor keys are planned, but WGSL shadow sampling is deferred.",
        });
    }
    return {
        ready: false,
        status: hasBlockingMissingResources ? "missing" : "deferred",
        standardMaterialCount: options.standardMaterialCount,
        group: 5,
        entryCount: plan.entries.length,
        sections: {
            layoutMetadata: options.layout?.valid ?? true,
            descriptorPlan: true,
            matrixBufferResource: plan.entries.some((entry) => entry.binding === 0),
            depthTextureResource: plan.entries.some((entry) => entry.binding === 1),
            samplerResource: plan.entries.some((entry) => entry.binding === 2),
            bindGroupResource: false,
            shaderSampling: false,
        },
        plan,
        diagnostics,
    };
}
export function createStandardMaterialShadowBindGroupResourceReport(options) {
    if (options.standardMaterialCount === 0) {
        return shadowBindGroupResourceReport({
            status: "not-required",
            standardMaterialCount: 0,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resource: null,
            diagnostics: [],
        });
    }
    const diagnostics = [];
    const plan = options.descriptor.plan;
    const layoutPlan = options.layout ?? createStandardMaterialShadowBindGroupLayoutPlan();
    if (plan === null) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroupResource.nullDescriptorPlan",
            severity: "warning",
            message: "StandardMaterial shadow bind-group creation requires a descriptor plan.",
        });
    }
    else if (!plan.valid || plan.resourceKey === null) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroupResource.invalidDescriptorPlan",
            severity: "warning",
            message: "StandardMaterial shadow bind-group creation requires a valid descriptor plan.",
        });
    }
    for (const diagnostic of validateStandardMaterialShadowBindGroupLayout(layoutPlan.layout)) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroupResource.invalidLayout",
            severity: "warning",
            message: diagnostic.message,
            ...(diagnostic.binding === undefined
                ? {}
                : { binding: diagnostic.binding }),
        });
    }
    if (options.device.createBindGroupLayout === undefined) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroupResource.missingDeviceSupport",
            severity: "warning",
            message: "WebGPU device cannot create StandardMaterial shadow bind group layouts.",
        });
    }
    if (options.device.createBindGroup === undefined) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroupResource.missingDeviceSupport",
            severity: "warning",
            message: "WebGPU device cannot create StandardMaterial shadow bind groups.",
        });
    }
    if (diagnostics.length > 0 ||
        plan === null ||
        !plan.valid ||
        plan.resourceKey === null ||
        options.device.createBindGroupLayout === undefined ||
        options.device.createBindGroup === undefined) {
        return shadowBindGroupResourceReport({
            status: "missing",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resource: null,
            diagnostics,
        });
    }
    const cached = options.cache?.get(plan.resourceKey);
    if (cached !== undefined) {
        return shadowBindGroupResourceReport({
            status: "available",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 1,
            resource: cached,
            diagnostics: shadowBindGroupDeferredDiagnostics(),
        });
    }
    const creationEntries = createShadowBindGroupEntries(plan, options, diagnostics);
    if (creationEntries.length !== plan.entries.length) {
        return shadowBindGroupResourceReport({
            status: "missing",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resource: null,
            diagnostics,
        });
    }
    const layoutResource = createStandardMaterialShadowBindGroupLayoutResource((descriptor) => options.device.createBindGroupLayout?.(descriptor), layoutPlan);
    try {
        const resource = {
            group: 5,
            resourceKey: plan.resourceKey,
            layoutKey: layoutResource.layoutKey,
            bindGroup: options.device.createBindGroup({
                label: "standard/shadow/group-5",
                layout: layoutResource.layout,
                entries: creationEntries,
            }),
            entryResourceKeys: plan.entries.map((entry) => entry.resourceKey),
        };
        options.cache?.set(plan.resourceKey, resource);
        return shadowBindGroupResourceReport({
            status: "available",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 1,
            reusedBindGroupCount: 0,
            resource,
            diagnostics: shadowBindGroupDeferredDiagnostics(),
        });
    }
    catch (cause) {
        return shadowBindGroupResourceReport({
            status: "missing",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resource: null,
            diagnostics: [
                ...diagnostics,
                {
                    code: "standardMaterialShadowBindGroupResource.creationFailed",
                    severity: "warning",
                    resourceKey: plan.resourceKey,
                    layoutKey: layoutResource.layoutKey,
                    message: `Failed to create StandardMaterial shadow bind group '${plan.resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        });
    }
}
export function createStandardMaterialShadowBindGroupResourceKey(entries) {
    return bindGroupResourceKey(`standard/shadow/group-5/${entries
        .slice()
        .sort((a, b) => a.binding - b.binding)
        .map((entry) => `${entry.binding}:${entry.resourceKey}`)
        .join("/")}`);
}
function firstValidDepthTextureResource(report) {
    return report.resources.find((resource) => resource.allocation.valid) ?? null;
}
function shadowDepthLayerCount(resource) {
    return resource.layerCount ?? resource.faceCount;
}
function isSupportedDirectionalShadowDepthView(resource) {
    if (resource.viewDimension === "2d") {
        return shadowDepthLayerCount(resource) === 1;
    }
    return (resource.viewDimension === "2d-array" &&
        shadowDepthLayerCount(resource) >= 1 &&
        shadowDepthLayerCount(resource) <= 4);
}
function createShadowSamplerDescriptor(resourceKey) {
    return {
        label: resourceKey,
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        // The shader owns PCF/PCFSoft/PCSS taps explicitly. Keep the comparison
        // sampler nearest so hardware interpolation does not add extra blur.
        magFilter: "nearest",
        minFilter: "nearest",
        mipmapFilter: "nearest",
        lodMinClamp: 0,
        lodMaxClamp: 32,
        compare: "less-equal",
    };
}
function shadowSamplerReport(input) {
    const available = input.status === "available";
    return {
        ready: available,
        status: input.status,
        createdSamplerCount: input.createdSamplerCount,
        reusedSamplerCount: input.reusedSamplerCount,
        sections: {
            samplerDescriptor: true,
            samplerResource: available,
            bindGroupResource: false,
            shaderSampling: false,
        },
        resource: input.resource,
        diagnostics: input.diagnostics,
    };
}
function createStandardMaterialShadowBindGroupLayoutResource(createBindGroupLayout, plan) {
    return {
        group: 5,
        layoutKey: plan.layout.metadata.layoutKey,
        layout: createBindGroupLayout({
            label: plan.layout.label,
            entries: plan.layout.entries.map((entry) => ({
                binding: entry.binding,
                visibility: entry.binding === 0 ? 3 : 2,
                ...(entry.resource === "sampler"
                    ? { sampler: { type: "comparison" } }
                    : entry.resource === "texture"
                        ? {
                            texture: {
                                sampleType: "depth",
                                viewDimension: "2d",
                                multisampled: false,
                            },
                        }
                        : { buffer: { type: "read-only-storage" } }),
            })),
        }),
    };
}
function createShadowBindGroupEntries(plan, resources, diagnostics) {
    const buffers = new Map();
    if (resources.matrixBufferResource.resource !== null) {
        buffers.set(resources.matrixBufferResource.resource.resourceKey, resources.matrixBufferResource.resource.buffer);
    }
    const textures = new Map();
    for (const resource of resources.depthTextureResources.resources) {
        if (resource.allocation.resource !== null) {
            textures.set(resource.textureKey, resource.allocation.resource.view);
        }
    }
    const samplers = new Map();
    if (resources.samplerResource.resource !== null) {
        samplers.set(resources.samplerResource.resource.resourceKey, resources.samplerResource.resource.sampler);
    }
    return plan.entries.flatMap((entry) => {
        switch (entry.resourceKind) {
            case "buffer": {
                const buffer = buffers.get(entry.resourceKey);
                if (buffer === undefined) {
                    diagnostics.push({
                        code: "standardMaterialShadowBindGroupResource.missingBufferResource",
                        severity: "warning",
                        binding: entry.binding,
                        resourceKey: entry.resourceKey,
                        message: `Missing StandardMaterial shadow buffer resource '${entry.resourceKey}' for binding ${entry.binding}.`,
                    });
                    return [];
                }
                return [{ binding: entry.binding, resource: { buffer } }];
            }
            case "texture-view": {
                const texture = textures.get(entry.resourceKey);
                if (texture === undefined) {
                    diagnostics.push({
                        code: "standardMaterialShadowBindGroupResource.missingTextureResource",
                        severity: "warning",
                        binding: entry.binding,
                        resourceKey: entry.resourceKey,
                        message: `Missing StandardMaterial shadow texture view resource '${entry.resourceKey}' for binding ${entry.binding}.`,
                    });
                    return [];
                }
                return [{ binding: entry.binding, resource: texture }];
            }
            case "sampler": {
                const sampler = samplers.get(entry.resourceKey);
                if (sampler === undefined) {
                    diagnostics.push({
                        code: "standardMaterialShadowBindGroupResource.missingSamplerResource",
                        severity: "warning",
                        binding: entry.binding,
                        resourceKey: entry.resourceKey,
                        message: `Missing StandardMaterial shadow sampler resource '${entry.resourceKey}' for binding ${entry.binding}.`,
                    });
                    return [];
                }
                return [{ binding: entry.binding, resource: sampler }];
            }
        }
    });
}
function shadowBindGroupResourceReport(input) {
    const available = input.status === "available";
    return {
        ready: input.status === "available" || input.status === "not-required",
        status: input.status,
        standardMaterialCount: input.standardMaterialCount,
        group: 5,
        createdBindGroupCount: input.createdBindGroupCount,
        reusedBindGroupCount: input.reusedBindGroupCount,
        sections: {
            descriptorPlan: input.status !== "missing",
            layoutResource: available,
            matrixBufferResource: available,
            depthTextureResource: available,
            samplerResource: available,
            bindGroupResource: available,
            passSubmission: false,
            shaderSampling: false,
        },
        resource: input.resource,
        diagnostics: input.diagnostics,
    };
}
function shadowSamplerDeferredDiagnostics() {
    return [
        {
            code: "shadowSamplerResource.bindGroupDeferred",
            severity: "warning",
            message: "Shadow sampler resources are live, but StandardMaterial shadow bind-group creation is tracked separately.",
        },
        {
            code: "shadowSamplerResource.shaderSamplingDeferred",
            severity: "warning",
            message: "Shadow sampler resources are live, but WGSL shadow sampling is deferred.",
        },
    ];
}
function shadowBindGroupDeferredDiagnostics() {
    return [
        {
            code: "standardMaterialShadowBindGroupResource.passSubmissionDeferred",
            severity: "warning",
            message: "StandardMaterial shadow bind-group resources are live, but shadow pass submission is deferred.",
        },
        {
            code: "standardMaterialShadowBindGroupResource.shaderSamplingDeferred",
            severity: "warning",
            message: "StandardMaterial shadow bind-group resources are live, but WGSL shadow sampling is deferred.",
        },
    ];
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : "Unknown error.";
}
//# sourceMappingURL=standard-material-shadow-bind-group.js.map