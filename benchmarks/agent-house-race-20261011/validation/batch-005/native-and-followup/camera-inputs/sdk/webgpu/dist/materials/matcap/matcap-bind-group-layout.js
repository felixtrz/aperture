export function createMatcapMaterialBindGroupLayoutMetadata(layoutKey = "matcap/group-2") {
    return {
        group: 2,
        name: "matcapMaterial",
        layoutKey,
        bindings: [
            {
                binding: 0,
                name: "matcapMaterial",
                resourceKind: "buffer",
                visibility: ["fragment"],
                required: true,
            },
            {
                binding: 1,
                name: "matcapTexture",
                resourceKind: "texture-view",
                visibility: ["fragment"],
                required: true,
            },
            {
                binding: 2,
                name: "matcapSampler",
                resourceKind: "sampler",
                visibility: ["fragment"],
                required: true,
            },
        ],
    };
}
export function createMatcapMaterialBindGroupLayoutPlan(layoutKey = "matcap/group-2") {
    const metadata = createMatcapMaterialBindGroupLayoutMetadata(layoutKey);
    const layout = {
        group: 2,
        label: "matcap/group-2",
        entries: metadata.bindings.map((binding) => ({
            binding: binding.binding,
            label: binding.name,
            resource: resourceKindToLayoutResource(binding.resourceKind),
        })),
        metadata,
    };
    const diagnostics = validateMatcapMaterialBindGroupLayout(layout);
    return {
        valid: diagnostics.length === 0,
        layout,
        diagnostics,
    };
}
export function validateMatcapMaterialBindGroupLayout(layout) {
    const diagnostics = [];
    const metadata = layout.metadata ?? createMatcapMaterialBindGroupLayoutMetadata();
    if (layout.group !== 2) {
        diagnostics.push({
            code: "matcapMaterialBindGroupLayout.invalidGroup",
            message: `Matcap material resources must use bind group 2; received group ${layout.group}.`,
        });
    }
    const entryByBinding = new Map(layout.entries.map((entry) => [entry.binding, entry]));
    for (const binding of metadata.bindings) {
        if (!binding.required) {
            continue;
        }
        const entry = entryByBinding.get(binding.binding);
        if (entry === undefined) {
            diagnostics.push({
                code: "matcapMaterialBindGroupLayout.missingBinding",
                binding: binding.binding,
                message: `Matcap material bind group layout is missing required binding ${binding.binding}.`,
            });
            continue;
        }
        const expected = resourceKindToLayoutResource(binding.resourceKind);
        if (entry.resource !== expected) {
            diagnostics.push({
                code: "matcapMaterialBindGroupLayout.resourceKindMismatch",
                binding: binding.binding,
                message: `Matcap material binding ${binding.binding} must be '${expected}', not '${entry.resource}'.`,
            });
        }
    }
    return diagnostics;
}
function resourceKindToLayoutResource(kind) {
    switch (kind) {
        case "buffer":
            return "uniform-buffer";
        case "texture-view":
            return "texture";
        case "sampler":
            return "sampler";
    }
}
//# sourceMappingURL=matcap-bind-group-layout.js.map