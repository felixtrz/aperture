import { bindGroupResourceKey } from "../../resources/core/resource-keys.js";
import { createStandardMaterialIblBindGroupLayoutPlan, validateStandardMaterialIblBindGroupLayout, } from "./standard-material-ibl-bind-group-layout.js";
export function createStandardMaterialIblBindGroupDescriptorPlan(options) {
    const layout = options.layout ?? createStandardMaterialIblBindGroupLayoutPlan();
    const diagnostics = [];
    const entries = [];
    if (!layout.valid) {
        diagnostics.push({
            code: "standardMaterialIblBindGroup.invalidLayout",
            severity: "warning",
            message: "StandardMaterial IBL bind-group descriptor planning requires valid group 4 layout metadata.",
        });
    }
    const diffuseResourceKey = firstValidTextureResourceKey(options.diffuseTextureResource);
    if (diffuseResourceKey === null) {
        diagnostics.push({
            code: "standardMaterialIblBindGroup.missingDiffuseTextureResource",
            severity: "warning",
            binding: 0,
            message: "StandardMaterial IBL bind-group descriptor planning requires an available diffuse irradiance texture resource.",
        });
    }
    else {
        entries.push({
            group: 4,
            binding: 0,
            resourceKey: diffuseResourceKey,
            resourceKind: "texture-view",
        });
    }
    const specularResourceKey = options.specularTextureResource === undefined
        ? null
        : firstValidSpecularTextureResourceKey(options.specularTextureResource);
    if (specularResourceKey === null) {
        const plannedSpecularResourceKey = firstSpecularTextureKey(options.textures);
        diagnostics.push({
            code: "standardMaterialIblBindGroup.specularTextureResourceDeferred",
            severity: "warning",
            binding: 1,
            ...(plannedSpecularResourceKey === null
                ? {}
                : { resourceKey: plannedSpecularResourceKey }),
            message: "StandardMaterial IBL bind-group descriptor planning requires a renderer-owned specular prefilter texture resource, which is still deferred.",
        });
    }
    else {
        entries.push({
            group: 4,
            binding: 1,
            resourceKey: specularResourceKey,
            resourceKind: "texture-view",
        });
    }
    const samplerResourceKey = firstValidSamplerResourceKey(options.samplers);
    if (samplerResourceKey === null) {
        diagnostics.push({
            code: "standardMaterialIblBindGroup.missingSamplerResource",
            severity: "warning",
            binding: 2,
            message: "StandardMaterial IBL bind-group descriptor planning requires an available IBL sampler resource.",
        });
    }
    else {
        entries.push({
            group: 4,
            binding: 2,
            resourceKey: samplerResourceKey,
            resourceKind: "sampler",
        });
    }
    return {
        valid: diagnostics.length === 0,
        group: 4,
        resourceKey: diagnostics.length === 0
            ? createStandardMaterialIblBindGroupResourceKey(entries)
            : null,
        entries,
        diagnostics,
    };
}
export function createStandardMaterialIblBindGroupDescriptorReadinessReport(options) {
    if (options.standardMaterialCount === 0) {
        return {
            ready: true,
            status: "not-required",
            standardMaterialCount: 0,
            group: 4,
            entryCount: 0,
            sections: {
                layoutMetadata: true,
                descriptorPlan: true,
                diffuseTextureResource: true,
                specularTextureResource: false,
                samplerResource: true,
                bindGroupResource: false,
                shaderSampling: false,
            },
            plan: null,
            diagnostics: [],
        };
    }
    const plan = createStandardMaterialIblBindGroupDescriptorPlan(options);
    const hasBlockingMissingResources = plan.diagnostics.some((diagnostic) => diagnostic.code === "standardMaterialIblBindGroup.invalidLayout" ||
        diagnostic.code ===
            "standardMaterialIblBindGroup.missingDiffuseTextureResource" ||
        diagnostic.code === "standardMaterialIblBindGroup.missingSamplerResource");
    const diagnostics = [
        ...plan.diagnostics,
    ];
    if (!hasBlockingMissingResources) {
        diagnostics.push({
            code: "standardMaterialIblBindGroup.shaderSamplingDeferred",
            severity: "warning",
            message: "StandardMaterial IBL bind-group descriptor keys are planned, but WGSL shader sampling is deferred.",
        });
    }
    return {
        ready: false,
        status: hasBlockingMissingResources ? "missing" : "deferred",
        standardMaterialCount: options.standardMaterialCount,
        group: 4,
        entryCount: plan.entries.length,
        sections: {
            layoutMetadata: options.layout?.valid ?? true,
            descriptorPlan: true,
            diffuseTextureResource: plan.entries.some((entry) => entry.binding === 0),
            specularTextureResource: plan.entries.some((entry) => entry.binding === 1),
            samplerResource: plan.entries.some((entry) => entry.binding === 2),
            bindGroupResource: false,
            shaderSampling: false,
        },
        plan,
        diagnostics,
    };
}
export function createStandardMaterialIblBindGroupResourceReport(options) {
    if (options.standardMaterialCount === 0) {
        return bindGroupResourceReport({
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
    const layoutPlan = options.layout ?? createStandardMaterialIblBindGroupLayoutPlan();
    if (plan === null) {
        diagnostics.push({
            code: "standardMaterialIblBindGroupResource.nullDescriptorPlan",
            severity: "warning",
            message: "StandardMaterial IBL bind-group creation requires a descriptor plan.",
        });
    }
    else if (!plan.valid || plan.resourceKey === null) {
        diagnostics.push({
            code: "standardMaterialIblBindGroupResource.invalidDescriptorPlan",
            severity: "warning",
            message: "StandardMaterial IBL bind-group creation requires a valid descriptor plan.",
        });
    }
    for (const diagnostic of validateStandardMaterialIblBindGroupLayout(layoutPlan.layout)) {
        diagnostics.push({
            code: "standardMaterialIblBindGroupResource.invalidLayout",
            severity: "warning",
            message: diagnostic.message,
            ...(diagnostic.binding === undefined
                ? {}
                : { binding: diagnostic.binding }),
        });
    }
    if (options.device.createBindGroupLayout === undefined) {
        diagnostics.push({
            code: "standardMaterialIblBindGroupResource.missingDeviceSupport",
            severity: "warning",
            message: "WebGPU device cannot create StandardMaterial IBL bind group layouts.",
        });
    }
    if (options.device.createBindGroup === undefined) {
        diagnostics.push({
            code: "standardMaterialIblBindGroupResource.missingDeviceSupport",
            severity: "warning",
            message: "WebGPU device cannot create StandardMaterial IBL bind groups.",
        });
    }
    if (diagnostics.length > 0 ||
        plan === null ||
        !plan.valid ||
        plan.resourceKey === null ||
        options.device.createBindGroupLayout === undefined ||
        options.device.createBindGroup === undefined) {
        return bindGroupResourceReport({
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
        return bindGroupResourceReport({
            status: "available",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 1,
            resource: cached,
            diagnostics: shaderSamplingDiagnostics(),
        });
    }
    const textureViews = textureViewResourcesByKey(options.diffuseTextureResource, options.specularTextureResource);
    const samplers = samplerResourcesByKey(options.samplers);
    const creationEntries = plan.entries.flatMap((entry) => {
        const resource = entry.resourceKind === "texture-view"
            ? textureViews.get(entry.resourceKey)
            : samplers.get(entry.resourceKey);
        if (resource === undefined) {
            diagnostics.push({
                code: entry.resourceKind === "texture-view"
                    ? "standardMaterialIblBindGroupResource.missingTextureResource"
                    : "standardMaterialIblBindGroupResource.missingSamplerResource",
                severity: "warning",
                binding: entry.binding,
                resourceKey: entry.resourceKey,
                message: `Missing StandardMaterial IBL ${entry.resourceKind} resource '${entry.resourceKey}' for binding ${entry.binding}.`,
            });
            return [];
        }
        return [{ binding: entry.binding, resource }];
    });
    if (creationEntries.length !== plan.entries.length) {
        return bindGroupResourceReport({
            status: "missing",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resource: null,
            diagnostics,
        });
    }
    const layoutResource = createStandardMaterialIblBindGroupLayoutResource((descriptor) => options.device.createBindGroupLayout?.(descriptor), layoutPlan);
    try {
        const resource = {
            group: 4,
            resourceKey: plan.resourceKey,
            layoutKey: layoutResource.layoutKey,
            bindGroup: options.device.createBindGroup({
                label: "standard/ibl/group-4",
                layout: layoutResource.layout,
                entries: creationEntries,
            }),
            entryResourceKeys: plan.entries.map((entry) => entry.resourceKey),
        };
        options.cache?.set(plan.resourceKey, resource);
        return bindGroupResourceReport({
            status: "available",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 1,
            reusedBindGroupCount: 0,
            resource,
            diagnostics: shaderSamplingDiagnostics(),
        });
    }
    catch (cause) {
        return bindGroupResourceReport({
            status: "missing",
            standardMaterialCount: options.standardMaterialCount,
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            resource: null,
            diagnostics: [
                ...diagnostics,
                {
                    code: "standardMaterialIblBindGroupResource.creationFailed",
                    severity: "warning",
                    resourceKey: plan.resourceKey,
                    layoutKey: layoutResource.layoutKey,
                    message: `Failed to create StandardMaterial IBL bind group '${plan.resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        });
    }
}
export function standardMaterialIblBindGroupResourceReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        group: report.group,
        createdBindGroupCount: report.createdBindGroupCount,
        reusedBindGroupCount: report.reusedBindGroupCount,
        sections: { ...report.sections },
        resource: report.resource === null
            ? null
            : {
                group: report.resource.group,
                resourceKey: report.resource.resourceKey,
                layoutKey: report.resource.layoutKey,
                entryResourceKeys: [...report.resource.entryResourceKeys],
            },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function standardMaterialIblBindGroupResourceReportToJson(report) {
    return JSON.stringify(standardMaterialIblBindGroupResourceReportToJsonValue(report));
}
function firstValidSpecularTextureResourceKey(report) {
    return (report.resources.find((resource) => resource.valid)?.resource
        ?.resourceKey ?? null);
}
export function standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        group: report.group,
        entryCount: report.entryCount,
        sections: { ...report.sections },
        plan: report.plan === null
            ? null
            : {
                valid: report.plan.valid,
                group: report.plan.group,
                resourceKey: report.plan.resourceKey,
                entries: report.plan.entries.map((entry) => ({ ...entry })),
                diagnostics: report.plan.diagnostics.map((diagnostic) => ({
                    ...diagnostic,
                })),
            },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function standardMaterialIblBindGroupDescriptorReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue(report));
}
export function createStandardMaterialIblBindGroupResourceKey(entries) {
    return bindGroupResourceKey(`standard/ibl/group-4/${entries
        .slice()
        .sort((a, b) => a.binding - b.binding)
        .map((entry) => `${entry.binding}:${entry.resourceKey}`)
        .join("/")}`);
}
function firstValidTextureResourceKey(report) {
    return (report.resources.find((resource) => resource.valid)?.resource
        ?.resourceKey ?? null);
}
function firstValidSamplerResourceKey(report) {
    return (report.resources.find((resource) => resource.valid)?.resource
        ?.resourceKey ?? null);
}
function firstSpecularTextureKey(report) {
    return (report.slots.find((slot) => slot.kind === "specular")?.textureKey ?? null);
}
function createStandardMaterialIblBindGroupLayoutResource(createBindGroupLayout, plan) {
    return {
        group: 4,
        layoutKey: plan.layout.metadata.layoutKey,
        layout: createBindGroupLayout({
            label: plan.layout.label,
            entries: plan.layout.entries.map((entry) => ({
                binding: entry.binding,
                visibility: 2,
                ...(entry.resource === "sampler"
                    ? { sampler: { type: "filtering" } }
                    : {
                        texture: {
                            sampleType: "float",
                            viewDimension: "cube",
                            multisampled: false,
                        },
                    }),
            })),
        }),
    };
}
function textureViewResourcesByKey(diffuse, specular) {
    const resources = new Map();
    for (const result of [...diffuse.resources, ...specular.resources]) {
        if (result.resource !== null) {
            resources.set(result.resource.resourceKey, result.resource.view);
        }
    }
    return resources;
}
function samplerResourcesByKey(report) {
    const resources = new Map();
    for (const result of report.resources) {
        if (result.resource !== null) {
            resources.set(result.resource.resourceKey, result.resource.sampler);
        }
    }
    return resources;
}
function bindGroupResourceReport(input) {
    const available = input.status === "available";
    return {
        ready: input.status === "available" || input.status === "not-required",
        status: input.status,
        standardMaterialCount: input.standardMaterialCount,
        group: 4,
        createdBindGroupCount: input.createdBindGroupCount,
        reusedBindGroupCount: input.reusedBindGroupCount,
        sections: {
            descriptorPlan: input.status !== "missing",
            layoutResource: available,
            textureResources: available,
            samplerResource: available,
            bindGroupResource: available,
            shaderSampling: false,
        },
        resource: input.resource,
        diagnostics: input.diagnostics,
    };
}
function shaderSamplingDiagnostics() {
    return [
        {
            code: "standardMaterialIblBindGroupResource.shaderSamplingDeferred",
            severity: "warning",
            message: "StandardMaterial IBL bind-group resources are live, but WGSL shader sampling is deferred.",
        },
    ];
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : "Unknown error.";
}
//# sourceMappingURL=standard-material-ibl-bind-group.js.map