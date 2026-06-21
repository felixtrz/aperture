import { bindGroupResourceKey } from "../../resources/core/resource-keys.js";
import { validateStandardMaterialBindGroupLayout, } from "./standard-bind-group-layout.js";
export function createStandardMaterialBindGroupDescriptorPlan(input) {
    const diagnostics = [];
    const entries = [];
    if (input.materialResourceKey === null) {
        diagnostics.push({
            code: "standardMaterialBindGroup.missingMaterialResource",
            binding: 0,
            message: "Standard material bind group planning requires a material uniform buffer resource.",
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
    addTexturePair(entries, diagnostics, "baseColor", 1, 2, input.dependencies.baseColor);
    addTexturePair(entries, diagnostics, "metallicRoughness", 3, 4, input.dependencies.metallicRoughness);
    addTexturePair(entries, diagnostics, "normal", 5, 6, input.dependencies.normal);
    addTexturePair(entries, diagnostics, "occlusion", 7, 8, input.dependencies.occlusion);
    addTexturePair(entries, diagnostics, "emissive", 9, 10, input.dependencies.emissive);
    addTexturePair(entries, diagnostics, "clearcoat", 11, 12, input.dependencies.clearcoat);
    addTexturePair(entries, diagnostics, "clearcoatRoughness", 23, 24, input.dependencies.clearcoatRoughness);
    addTexturePair(entries, diagnostics, "transmission", 13, 14, input.dependencies.transmission);
    addTexturePair(entries, diagnostics, "sheenColor", 15, 16, input.dependencies.sheenColor);
    addTexturePair(entries, diagnostics, "iridescence", 17, 18, input.dependencies.iridescence);
    addTexturePair(entries, diagnostics, "sheenRoughness", 19, 20, input.dependencies.sheenRoughness);
    addTexturePair(entries, diagnostics, "iridescenceThickness", 21, 22, input.dependencies.iridescenceThickness);
    return {
        valid: diagnostics.length === 0,
        group: 2,
        resourceKey: diagnostics.length === 0
            ? createStandardMaterialBindGroupResourceKey(entries)
            : null,
        entries,
        diagnostics,
    };
}
export function createStandardMaterialBindGroupResourceKey(entries) {
    return bindGroupResourceKey(`standard/group-2/${entries
        .slice()
        .sort((a, b) => a.binding - b.binding)
        .map((entry) => `${entry.binding}:${entry.resourceKey}`)
        .join("/")}`);
}
export function createStandardMaterialBindGroupResource(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "standardMaterialBindGroupResource.nullDescriptorPlan",
                    message: "Cannot create a standard material bind group from a null descriptor plan.",
                },
            ],
        };
    }
    const diagnostics = [];
    if (!options.plan.valid || options.plan.resourceKey === null) {
        diagnostics.push({
            code: "standardMaterialBindGroupResource.invalidDescriptorPlan",
            message: "Cannot create a standard material bind group from an invalid descriptor plan.",
        });
    }
    if (options.layout === null) {
        diagnostics.push({
            code: "standardMaterialBindGroupResource.missingLayout",
            group: 2,
            message: "Standard material bind group creation requires a group-2 layout resource.",
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
                    code: "standardMaterialBindGroupResource.missingDeviceSupport",
                    message: "WebGPU device cannot create standard material bind groups.",
                },
            ],
        };
    }
    if (diagnostics.length > 0 ||
        options.layout === null ||
        options.plan.resourceKey === null) {
        return { valid: false, resource: null, diagnostics };
    }
    const descriptor = createStandardBindGroupCreationDescriptor(options.plan, options.layout, options, diagnostics);
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
                    code: "standardMaterialBindGroupResource.creationFailed",
                    group: 2,
                    resourceKey: options.plan.resourceKey,
                    layoutKey: options.layout.layoutKey,
                    message: `Failed to create standard material bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
function validateLayoutResource(layout) {
    const diagnostics = [];
    if (layout.group !== 2) {
        diagnostics.push({
            code: "standardMaterialBindGroupResource.invalidLayout",
            group: 2,
            layoutKey: layout.layoutKey,
            message: `Standard material bind group layout resource must be group 2, not ${layout.group}.`,
        });
    }
    if (layout.descriptor !== undefined) {
        for (const diagnostic of validateStandardMaterialBindGroupLayout(layout.descriptor)) {
            diagnostics.push({
                code: "standardMaterialBindGroupResource.invalidLayout",
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
function createStandardBindGroupCreationDescriptor(plan, layout, resources, diagnostics) {
    const buffers = new Map(resources.buffers.map((buffer) => [buffer.resourceKey, buffer.buffer]));
    const textures = new Map((resources.textures ?? []).map((texture) => [
        texture.resourceKey,
        texture.view,
    ]));
    const samplers = new Map((resources.samplers ?? []).map((sampler) => [
        sampler.resourceKey,
        sampler.sampler,
    ]));
    const entries = plan.entries.flatMap((entry) => {
        const resource = resolveStandardMaterialResource(entry, buffers, textures, samplers, diagnostics);
        return resource === null ? [] : [{ binding: entry.binding, resource }];
    });
    if (entries.length !== plan.entries.length) {
        return null;
    }
    return {
        label: "standard/group-2",
        layout: layout.layout,
        entries,
    };
}
function resolveStandardMaterialResource(entry, buffers, textures, samplers, diagnostics) {
    switch (entry.resourceKind) {
        case "buffer": {
            const buffer = buffers.get(entry.resourceKey);
            if (buffer === undefined) {
                diagnostics.push({
                    code: "standardMaterialBindGroupResource.missingBufferResource",
                    group: 2,
                    binding: entry.binding,
                    resourceKey: entry.resourceKey,
                    message: `Missing GPU buffer resource '${entry.resourceKey}' for standard material group 2.`,
                });
                return null;
            }
            return { buffer };
        }
        case "texture-view": {
            const texture = textures.get(entry.resourceKey);
            if (texture === undefined) {
                diagnostics.push({
                    code: "standardMaterialBindGroupResource.missingTextureResource",
                    group: 2,
                    binding: entry.binding,
                    resourceKey: entry.resourceKey,
                    message: `Missing GPU texture view resource '${entry.resourceKey}' for standard material group 2.`,
                });
                return null;
            }
            return texture;
        }
        case "sampler": {
            const sampler = samplers.get(entry.resourceKey);
            if (sampler === undefined) {
                diagnostics.push({
                    code: "standardMaterialBindGroupResource.missingSamplerResource",
                    group: 2,
                    binding: entry.binding,
                    resourceKey: entry.resourceKey,
                    message: `Missing GPU sampler resource '${entry.resourceKey}' for standard material group 2.`,
                });
                return null;
            }
            return sampler;
        }
    }
}
function addTexturePair(entries, diagnostics, slot, textureBinding, samplerBinding, dependency) {
    const textured = dependency.textureKey !== null || dependency.samplerKey !== null;
    if (!textured) {
        return;
    }
    if (dependency.textureKey === null) {
        diagnostics.push({
            code: "standardMaterialBindGroup.missingTextureResource",
            slot,
            binding: textureBinding,
            message: `${slot} texture binding requires a texture resource key.`,
        });
    }
    else {
        entries.push({
            group: 2,
            binding: textureBinding,
            resourceKey: dependency.textureKey,
            resourceKind: "texture-view",
        });
    }
    if (dependency.samplerKey === null) {
        diagnostics.push({
            code: "standardMaterialBindGroup.missingSamplerResource",
            slot,
            binding: samplerBinding,
            message: `${slot} texture binding requires a sampler resource key.`,
        });
    }
    else {
        entries.push({
            group: 2,
            binding: samplerBinding,
            resourceKey: dependency.samplerKey,
            resourceKind: "sampler",
        });
    }
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=standard-bind-group.js.map