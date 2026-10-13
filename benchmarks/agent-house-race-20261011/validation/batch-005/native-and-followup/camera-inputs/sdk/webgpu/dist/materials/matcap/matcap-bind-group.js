import { validateMatcapMaterialBindGroupLayout, } from "./matcap-bind-group-layout.js";
import { bindGroupResourceKey } from "../../resources/core/resource-keys.js";
export function createMatcapMaterialBindGroupDescriptorPlan(input) {
    const diagnostics = [];
    const entries = [];
    if (input.materialResourceKey === null) {
        diagnostics.push({
            code: "matcapMaterialBindGroup.missingMaterialResource",
            binding: 0,
            message: "Matcap material bind group planning requires a material uniform buffer resource.",
        });
    }
    else {
        entries.push({
            group: 2,
            binding: 0,
            resourceKey: input.materialResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.dependencies.matcapTexture.textureKey === null) {
        diagnostics.push({
            code: "matcapMaterialBindGroup.missingTextureResource",
            binding: 1,
            message: "Matcap material bind group planning requires a texture key.",
        });
    }
    else {
        entries.push({
            group: 2,
            binding: 1,
            resourceKey: input.dependencies.matcapTexture.textureKey,
            resourceKind: "texture-view",
        });
    }
    if (input.dependencies.matcapTexture.samplerKey === null) {
        diagnostics.push({
            code: "matcapMaterialBindGroup.missingSamplerResource",
            binding: 2,
            message: "Matcap material bind group planning requires a sampler key.",
        });
    }
    else {
        entries.push({
            group: 2,
            binding: 2,
            resourceKey: input.dependencies.matcapTexture.samplerKey,
            resourceKind: "sampler",
        });
    }
    return {
        valid: diagnostics.length === 0,
        group: 2,
        resourceKey: diagnostics.length === 0
            ? createMatcapMaterialBindGroupResourceKey(entries)
            : null,
        entries,
        diagnostics,
    };
}
export function createMatcapMaterialBindGroupDescriptorPlanFromDependencies(materialResourceKey, dependencies) {
    return createMatcapMaterialBindGroupDescriptorPlan({
        materialResourceKey,
        dependencies,
    });
}
export function createMatcapMaterialBindGroupResourceKey(entries) {
    return bindGroupResourceKey(`matcap/group-2/${entries
        .slice()
        .sort((a, b) => a.binding - b.binding)
        .map((entry) => `${entry.binding}:${entry.resourceKey}`)
        .join("/")}`);
}
export function createMatcapMaterialBindGroupResource(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "matcapMaterialBindGroupResource.nullDescriptorPlan",
                    message: "Cannot create a matcap material bind group from a null descriptor plan.",
                },
            ],
        };
    }
    const diagnostics = [];
    if (!options.plan.valid || options.plan.resourceKey === null) {
        diagnostics.push({
            code: "matcapMaterialBindGroupResource.invalidDescriptorPlan",
            message: "Cannot create a matcap material bind group from an invalid descriptor plan.",
        });
    }
    if (options.layout === null) {
        diagnostics.push({
            code: "matcapMaterialBindGroupResource.missingLayout",
            group: 2,
            message: "Matcap material bind group creation requires a group-2 layout resource.",
        });
    }
    else {
        diagnostics.push(...validateLayoutResource(options.layout));
    }
    if (options.device.createBindGroup === undefined) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...diagnostics,
                {
                    code: "matcapMaterialBindGroupResource.missingDeviceSupport",
                    message: "WebGPU device cannot create matcap material bind groups.",
                },
            ],
        };
    }
    if (diagnostics.length > 0 ||
        options.layout === null ||
        options.plan.resourceKey === null) {
        return { valid: false, resource: null, diagnostics };
    }
    const descriptor = createMatcapBindGroupCreationDescriptor(options.plan, options.layout, options, diagnostics);
    if (descriptor === null) {
        return { valid: false, resource: null, diagnostics };
    }
    try {
        return {
            valid: true,
            resource: {
                group: 2,
                resourceKey: options.plan.resourceKey,
                layoutKey: options.layout.layoutKey,
                bindGroup: options.device.createBindGroup(descriptor),
                entryResourceKeys: options.plan.entries.map((entry) => entry.resourceKey),
            },
            diagnostics,
        };
    }
    catch (cause) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...diagnostics,
                {
                    code: "matcapMaterialBindGroupResource.creationFailed",
                    group: 2,
                    resourceKey: options.plan.resourceKey,
                    layoutKey: options.layout.layoutKey,
                    message: `Failed to create matcap material bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
function validateLayoutResource(layout) {
    const diagnostics = [];
    if (layout.group !== 2) {
        diagnostics.push({
            code: "matcapMaterialBindGroupResource.invalidLayout",
            group: 2,
            layoutKey: layout.layoutKey,
            message: `Matcap material bind group layout resource must be group 2, not ${layout.group}.`,
        });
    }
    if (layout.descriptor !== undefined) {
        for (const diagnostic of validateMatcapMaterialBindGroupLayout(layout.descriptor)) {
            diagnostics.push({
                code: "matcapMaterialBindGroupResource.invalidLayout",
                group: 2,
                layoutKey: layout.layoutKey,
                message: diagnostic.message,
                ...(diagnostic.binding === undefined
                    ? {}
                    : { binding: diagnostic.binding }),
            });
        }
    }
    return diagnostics;
}
function createMatcapBindGroupCreationDescriptor(plan, layout, resources, diagnostics) {
    const buffers = new Map(resources.buffers.map((buffer) => [buffer.resourceKey, buffer.buffer]));
    const textures = new Map(resources.textures.map((texture) => [texture.resourceKey, texture.view]));
    const samplers = new Map(resources.samplers.map((sampler) => [sampler.resourceKey, sampler.sampler]));
    const entries = plan.entries.flatMap((entry) => {
        const resource = resolveMatcapMaterialResource(entry, buffers, textures, samplers, diagnostics);
        return resource === null ? [] : [{ binding: entry.binding, resource }];
    });
    if (entries.length !== plan.entries.length) {
        return null;
    }
    return {
        label: "matcap/group-2",
        layout: layout.layout,
        entries,
    };
}
function resolveMatcapMaterialResource(entry, buffers, textures, samplers, diagnostics) {
    switch (entry.resourceKind) {
        case "buffer": {
            const buffer = buffers.get(entry.resourceKey);
            if (buffer === undefined) {
                diagnostics.push({
                    code: "matcapMaterialBindGroupResource.missingBufferResource",
                    group: 2,
                    binding: entry.binding,
                    resourceKey: entry.resourceKey,
                    message: `Missing GPU buffer resource '${entry.resourceKey}' for matcap material group 2.`,
                });
                return null;
            }
            return { buffer };
        }
        case "texture-view": {
            const texture = textures.get(entry.resourceKey);
            if (texture === undefined) {
                diagnostics.push({
                    code: "matcapMaterialBindGroupResource.missingTextureResource",
                    group: 2,
                    binding: entry.binding,
                    resourceKey: entry.resourceKey,
                    message: `Missing GPU texture view resource '${entry.resourceKey}' for matcap material group 2.`,
                });
                return null;
            }
            return texture;
        }
        case "sampler": {
            const sampler = samplers.get(entry.resourceKey);
            if (sampler === undefined) {
                diagnostics.push({
                    code: "matcapMaterialBindGroupResource.missingSamplerResource",
                    group: 2,
                    binding: entry.binding,
                    resourceKey: entry.resourceKey,
                    message: `Missing GPU sampler resource '${entry.resourceKey}' for matcap material group 2.`,
                });
                return null;
            }
            return sampler;
        }
    }
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=matcap-bind-group.js.map