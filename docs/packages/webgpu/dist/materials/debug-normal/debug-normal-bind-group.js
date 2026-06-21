import { validateDebugNormalMaterialBindGroupLayout, } from "./debug-normal-bind-group-layout.js";
import { bindGroupResourceKey } from "../../resources/core/resource-keys.js";
export function createDebugNormalMaterialBindGroupDescriptorPlan(input) {
    if (input.materialResourceKey === null) {
        return {
            valid: false,
            group: 2,
            resourceKey: null,
            entries: [],
            diagnostics: [
                {
                    code: "debugNormalMaterialBindGroup.missingMaterialResource",
                    binding: 0,
                    message: "DebugNormal material bind group planning requires a material uniform buffer resource.",
                },
            ],
        };
    }
    const entries = [
        {
            group: 2,
            binding: 0,
            resourceKey: input.materialResourceKey,
            resourceKind: "buffer",
        },
    ];
    return {
        valid: true,
        group: 2,
        resourceKey: createDebugNormalMaterialBindGroupResourceKey(entries),
        entries,
        diagnostics: [],
    };
}
export function createDebugNormalMaterialBindGroupResourceKey(entries) {
    return bindGroupResourceKey(`debug-normal/group-2/${entries
        .slice()
        .sort((a, b) => a.binding - b.binding)
        .map((entry) => `${entry.binding}:${entry.resourceKey}`)
        .join("/")}`);
}
export function createDebugNormalMaterialBindGroupResource(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "debugNormalMaterialBindGroupResource.nullDescriptorPlan",
                    message: "Cannot create a debug-normal material bind group from a null descriptor plan.",
                },
            ],
        };
    }
    const diagnostics = [];
    if (!options.plan.valid || options.plan.resourceKey === null) {
        diagnostics.push({
            code: "debugNormalMaterialBindGroupResource.invalidDescriptorPlan",
            message: "Cannot create a debug-normal material bind group from an invalid descriptor plan.",
        });
    }
    if (options.layout === null) {
        diagnostics.push({
            code: "debugNormalMaterialBindGroupResource.missingLayout",
            group: 2,
            message: "DebugNormal material bind group creation requires a group-2 layout resource.",
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
                    code: "debugNormalMaterialBindGroupResource.missingDeviceSupport",
                    message: "WebGPU device cannot create debug-normal material bind groups.",
                },
            ],
        };
    }
    if (diagnostics.length > 0 ||
        options.layout === null ||
        options.plan.resourceKey === null) {
        return { valid: false, resource: null, diagnostics };
    }
    const descriptor = createDebugNormalBindGroupCreationDescriptor(options.plan, options.layout, options.buffers, diagnostics);
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
                    code: "debugNormalMaterialBindGroupResource.creationFailed",
                    group: 2,
                    resourceKey: options.plan.resourceKey,
                    layoutKey: options.layout.layoutKey,
                    message: `Failed to create debug-normal material bind group '${options.plan.resourceKey}': ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
export function debugNormalMaterialBindGroupResourceToJsonValue(resource) {
    return {
        group: resource.group,
        resourceKey: resource.resourceKey,
        layoutKey: resource.layoutKey,
        entryResourceKeys: resource.entryResourceKeys,
    };
}
function validateLayoutResource(layout) {
    const diagnostics = [];
    if (layout.group !== 2) {
        diagnostics.push({
            code: "debugNormalMaterialBindGroupResource.invalidLayout",
            group: 2,
            layoutKey: layout.layoutKey,
            message: `DebugNormal material bind group layout resource must be group 2, not ${layout.group}.`,
        });
    }
    if (layout.descriptor !== undefined) {
        for (const diagnostic of validateDebugNormalMaterialBindGroupLayout(layout.descriptor)) {
            diagnostics.push({
                code: "debugNormalMaterialBindGroupResource.invalidLayout",
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
function createDebugNormalBindGroupCreationDescriptor(plan, layout, buffers, diagnostics) {
    const bufferMap = new Map(buffers.map((buffer) => [buffer.resourceKey, buffer.buffer]));
    const entries = plan.entries.flatMap((entry) => {
        const buffer = bufferMap.get(entry.resourceKey);
        if (buffer === undefined) {
            diagnostics.push({
                code: "debugNormalMaterialBindGroupResource.missingBufferResource",
                group: 2,
                binding: entry.binding,
                resourceKey: entry.resourceKey,
                message: `Missing GPU buffer resource '${entry.resourceKey}' for debug-normal material group 2.`,
            });
            return [];
        }
        return [{ binding: entry.binding, resource: { buffer } }];
    });
    if (entries.length !== plan.entries.length) {
        return null;
    }
    return {
        label: "debug-normal/group-2",
        layout: layout.layout,
        entries,
    };
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=debug-normal-bind-group.js.map