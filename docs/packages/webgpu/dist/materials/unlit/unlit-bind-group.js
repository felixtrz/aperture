import { readCachedBindGroupResource, writeCachedBindGroupResource, } from "../../gpu/bind-group-resource-cache.js";
import { bindGroupResourceKey } from "../../resources/core/resource-keys.js";
export function createUnlitBindGroupDescriptorPlan(input) {
    const diagnostics = [];
    const entries = [];
    if (input.viewUniformResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingViewResource",
            message: "Unlit bind group planning requires a view uniform resource.",
        });
    }
    else {
        entries.push({
            group: 0,
            binding: 0,
            resourceKey: input.viewUniformResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.worldTransformResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingTransformResource",
            message: "Unlit bind group planning requires a world transform buffer resource.",
        });
    }
    else {
        entries.push({
            group: 1,
            binding: 0,
            resourceKey: input.worldTransformResourceKey,
            resourceKind: "buffer",
        });
    }
    if (input.previousWorldTransformResourceKey !== undefined) {
        if (input.previousWorldTransformResourceKey === null) {
            diagnostics.push({
                code: "unlitBindGroup.missingTransformResource",
                message: "Motion-vector bind group planning requires a previous world transform buffer resource.",
            });
        }
        else {
            entries.push({
                group: 1,
                binding: 3,
                resourceKey: input.previousWorldTransformResourceKey,
                resourceKind: "buffer",
            });
        }
    }
    if (input.materialResourceKey === null) {
        diagnostics.push({
            code: "unlitBindGroup.missingMaterialResource",
            message: "Unlit bind group planning requires a material uniform resource.",
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
    const textured = input.baseColorTextureResourceKey != null ||
        input.baseColorSamplerResourceKey != null;
    if (textured && input.baseColorTextureResourceKey == null) {
        diagnostics.push({
            code: "unlitBindGroup.missingBaseColorTextureResource",
            message: "Textured unlit bind group planning requires a base-color texture resource.",
        });
    }
    else if (input.baseColorTextureResourceKey != null) {
        entries.push({
            group: 2,
            binding: 1,
            resourceKey: input.baseColorTextureResourceKey,
            resourceKind: "texture-view",
        });
    }
    if (textured && input.baseColorSamplerResourceKey == null) {
        diagnostics.push({
            code: "unlitBindGroup.missingBaseColorSamplerResource",
            message: "Textured unlit bind group planning requires a base-color sampler resource.",
        });
    }
    else if (input.baseColorSamplerResourceKey != null) {
        entries.push({
            group: 2,
            binding: 2,
            resourceKey: input.baseColorSamplerResourceKey,
            resourceKind: "sampler",
        });
    }
    return {
        valid: diagnostics.length === 0,
        entries,
        diagnostics,
    };
}
export function createUnlitBindGroups(options) {
    return createUnlitBindGroupResources({
        device: options.device,
        plan: options.plan,
        layouts: options.layouts,
        bindGroupCache: options.bindGroupCache,
        ...(options.requiredGroups === undefined
            ? {}
            : { requiredGroups: options.requiredGroups }),
        resolveResource: (entry) => ({ resourceKey: entry.resourceKey }),
    });
}
export function createUnlitBindGroupsFromBuffers(options) {
    return createUnlitBindGroupsFromGpuResources(options);
}
export function createUnlitBindGroupsFromGpuResources(options) {
    const buffers = new Map(options.buffers.map((buffer) => [buffer.resourceKey, buffer.buffer]));
    const textures = new Map((options.textures ?? []).map((texture) => [
        texture.resourceKey,
        texture.view,
    ]));
    const samplers = new Map((options.samplers ?? []).map((sampler) => [
        sampler.resourceKey,
        sampler.sampler,
    ]));
    return createUnlitBindGroupResources({
        device: options.device,
        plan: options.plan,
        layouts: options.layouts,
        bindGroupCache: options.bindGroupCache,
        ...(options.requiredGroups === undefined
            ? {}
            : { requiredGroups: options.requiredGroups }),
        resolveResource: (entry, diagnostics) => {
            switch (entry.resourceKind) {
                case "buffer": {
                    const buffer = buffers.get(entry.resourceKey);
                    if (buffer === undefined) {
                        diagnostics.push({
                            code: "unlitBindGroupResource.missingBufferResource",
                            resourceKey: entry.resourceKey,
                            group: entry.group,
                            message: `Missing GPU buffer resource '${entry.resourceKey}' for unlit group ${entry.group}.`,
                        });
                        return null;
                    }
                    return { buffer };
                }
                case "texture-view": {
                    const texture = textures.get(entry.resourceKey);
                    if (texture === undefined) {
                        diagnostics.push({
                            code: "unlitBindGroupResource.missingTextureResource",
                            resourceKey: entry.resourceKey,
                            group: entry.group,
                            message: `Missing GPU texture view resource '${entry.resourceKey}' for unlit group ${entry.group}.`,
                        });
                        return null;
                    }
                    return texture;
                }
                case "sampler": {
                    const sampler = samplers.get(entry.resourceKey);
                    if (sampler === undefined) {
                        diagnostics.push({
                            code: "unlitBindGroupResource.missingSamplerResource",
                            resourceKey: entry.resourceKey,
                            group: entry.group,
                            message: `Missing GPU sampler resource '${entry.resourceKey}' for unlit group ${entry.group}.`,
                        });
                        return null;
                    }
                    return sampler;
                }
            }
        },
    });
}
function createUnlitBindGroupResources(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resources: [],
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            diagnostics: [
                {
                    code: "unlitBindGroupResource.nullDescriptorPlan",
                    message: "Cannot create unlit bind groups from a null descriptor plan.",
                },
            ],
        };
    }
    const diagnostics = [];
    if (!options.plan.valid) {
        diagnostics.push({
            code: "unlitBindGroupResource.invalidDescriptorPlan",
            message: "Cannot create complete unlit bind groups from an invalid descriptor plan.",
        });
    }
    if (options.device.createBindGroup === undefined) {
        return {
            valid: false,
            resources: [],
            createdBindGroupCount: 0,
            reusedBindGroupCount: 0,
            diagnostics: [
                ...diagnostics,
                {
                    code: "unlitBindGroupResource.missingDeviceSupport",
                    message: "WebGPU device cannot create bind groups.",
                },
            ],
        };
    }
    const layoutByGroup = new Map(options.layouts.map((layout) => [layout.group, layout]));
    const resources = [];
    let createdBindGroupCount = 0;
    let reusedBindGroupCount = 0;
    const entriesByGroup = groupPlanEntries(options.plan.entries);
    diagnostics.push(...validateRequiredBindGroupSequence(entriesByGroup, options.requiredGroups));
    for (const [group, entries] of entriesByGroup) {
        const layout = layoutByGroup.get(group);
        if (layout === undefined) {
            diagnostics.push({
                code: "unlitBindGroupResource.missingLayout",
                group,
                message: `Missing bind group layout resource for unlit group ${group}.`,
            });
            continue;
        }
        diagnostics.push(...validateBindGroupEntries(group, entries, layout));
        const descriptor = createBindGroupDescriptor(group, entries, layout.layout, options.resolveResource, diagnostics);
        if (descriptor === null) {
            continue;
        }
        const resourceKey = createUnlitBindGroupResourceKey(group, entries);
        const cacheKey = unlitBindGroupCacheKey(layout.layoutKey, resourceKey);
        const cached = readCachedBindGroupResource(options.bindGroupCache, cacheKey);
        if (cached !== null) {
            resources.push(cached);
            reusedBindGroupCount += 1;
            continue;
        }
        const resource = {
            group,
            resourceKey,
            layoutKey: layout.layoutKey,
            bindGroup: options.device.createBindGroup(descriptor),
            entryResourceKeys: entries.map((entry) => entry.resourceKey),
        };
        writeCachedBindGroupResource(options.bindGroupCache, cacheKey, resource);
        createdBindGroupCount += 1;
        resources.push(resource);
    }
    return {
        valid: diagnostics.length === 0,
        resources,
        createdBindGroupCount,
        reusedBindGroupCount,
        diagnostics,
    };
}
export function createUnlitBindGroupLayoutMetadata(group, layoutKey = `unlit/group-${group}`) {
    switch (group) {
        case 0:
            return {
                group,
                name: "view",
                layoutKey,
                bindings: [
                    {
                        binding: 0,
                        name: "viewUniform",
                        resourceKind: "buffer",
                        visibility: ["vertex"],
                        required: true,
                    },
                ],
            };
        case 1:
            return {
                group,
                name: "worldTransforms",
                layoutKey,
                bindings: [
                    {
                        binding: 0,
                        name: "worldTransforms",
                        resourceKind: "buffer",
                        visibility: ["vertex"],
                        required: true,
                    },
                    {
                        binding: 3,
                        name: "previousWorldTransforms",
                        resourceKind: "buffer",
                        visibility: ["vertex"],
                        required: false,
                    },
                ],
            };
        case 2:
            return {
                group,
                name: "material",
                layoutKey,
                bindings: [
                    {
                        binding: 0,
                        name: "unlitMaterial",
                        resourceKind: "buffer",
                        visibility: ["fragment"],
                        required: true,
                    },
                    {
                        binding: 1,
                        name: "baseColorTexture",
                        resourceKind: "texture-view",
                        visibility: ["fragment"],
                        required: false,
                    },
                    {
                        binding: 2,
                        name: "baseColorSampler",
                        resourceKind: "sampler",
                        visibility: ["fragment"],
                        required: false,
                    },
                ],
            };
        default:
            return {
                group,
                name: `group-${group}`,
                layoutKey,
                bindings: [],
            };
    }
}
function validateRequiredBindGroupSequence(entriesByGroup, requiredGroups) {
    if (requiredGroups === undefined) {
        return [];
    }
    return requiredGroups.flatMap((group) => entriesByGroup.has(group)
        ? []
        : [
            {
                code: "unlitBindGroupResource.skippedRequiredGroup",
                group,
                message: `Required unlit bind group ${group} has no descriptor entries.`,
            },
        ]);
}
function validateBindGroupEntries(group, entries, layout) {
    const diagnostics = [];
    const seen = new Set();
    const metadata = layout.metadata ??
        createUnlitBindGroupLayoutMetadata(group, layout.layoutKey);
    const metadataByBinding = new Map(metadata.bindings.map((binding) => [binding.binding, binding]));
    const entryByBinding = new Map(entries.map((entry) => [entry.binding, entry]));
    for (const entry of entries) {
        if (seen.has(entry.binding)) {
            diagnostics.push({
                code: "unlitBindGroupResource.duplicateBinding",
                group,
                binding: entry.binding,
                resourceKey: entry.resourceKey,
                message: `Duplicate unlit bind group binding ${entry.binding} in group ${group}.`,
            });
            continue;
        }
        seen.add(entry.binding);
        const expected = metadataByBinding.get(entry.binding);
        if (expected !== undefined &&
            expected.resourceKind !== entry.resourceKind) {
            diagnostics.push({
                code: "unlitBindGroupResource.resourceKindMismatch",
                group,
                binding: entry.binding,
                resourceKey: entry.resourceKey,
                message: `Unlit bind group ${group} binding ${entry.binding} expects ${expected.resourceKind}, received ${entry.resourceKind}.`,
            });
        }
    }
    for (const binding of metadata.bindings) {
        if (binding.required && !entryByBinding.has(binding.binding)) {
            diagnostics.push({
                code: "unlitBindGroupResource.missingRequiredBinding",
                group,
                binding: binding.binding,
                message: `Unlit bind group ${group} is missing required binding ${binding.binding} (${binding.name}).`,
            });
        }
    }
    return diagnostics;
}
function groupPlanEntries(entries) {
    const groups = new Map();
    for (const entry of entries) {
        const group = groups.get(entry.group) ?? [];
        group.push(entry);
        groups.set(entry.group, group);
    }
    return new Map([...groups]
        .sort(([a], [b]) => a - b)
        .map(([group, groupEntries]) => [
        group,
        groupEntries.sort((a, b) => a.binding - b.binding),
    ]));
}
function createBindGroupDescriptor(group, entries, layout, resolveResource, diagnostics) {
    const resolvedEntries = entries.flatMap((entry) => {
        const resource = resolveResource(entry, diagnostics);
        if (resource === null) {
            return [];
        }
        return [{ binding: entry.binding, resource }];
    });
    if (resolvedEntries.length !== entries.length) {
        return null;
    }
    return {
        label: `unlit/group-${group}`,
        layout,
        entries: resolvedEntries,
    };
}
function createUnlitBindGroupResourceKey(group, entries) {
    return bindGroupResourceKey([
        `unlit/group-${group}`,
        ...entries.map((entry) => `${entry.binding}:${entry.resourceKey}`),
    ].join("/"));
}
function unlitBindGroupCacheKey(layoutKey, resourceKey) {
    return `${layoutKey}|${resourceKey}`;
}
//# sourceMappingURL=unlit-bind-group.js.map