export function createDebugNormalMaterialBindGroupLayoutMetadata(layoutKey = "debug-normal/group-2") {
    return {
        group: 2,
        name: "debugNormalMaterial",
        layoutKey,
        bindings: [
            {
                binding: 0,
                name: "debugNormalMaterial",
                resourceKind: "buffer",
                visibility: ["fragment"],
                required: true,
            },
        ],
    };
}
export function createDebugNormalMaterialBindGroupLayoutPlan(layoutKey = "debug-normal/group-2") {
    const metadata = createDebugNormalMaterialBindGroupLayoutMetadata(layoutKey);
    const layout = {
        group: 2,
        label: "debug-normal/group-2",
        entries: metadata.bindings.map((binding) => ({
            binding: binding.binding,
            label: binding.name,
            resource: "uniform-buffer",
        })),
        metadata,
    };
    const diagnostics = validateDebugNormalMaterialBindGroupLayout(layout);
    return {
        valid: diagnostics.length === 0,
        layout,
        diagnostics,
    };
}
export function validateDebugNormalMaterialBindGroupLayout(layout) {
    const diagnostics = [];
    const metadata = layout.metadata ?? createDebugNormalMaterialBindGroupLayoutMetadata();
    if (layout.group !== 2) {
        diagnostics.push({
            code: "debugNormalMaterialBindGroupLayout.invalidGroup",
            message: `DebugNormal material resources must use bind group 2; received group ${layout.group}.`,
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
                code: "debugNormalMaterialBindGroupLayout.missingBinding",
                binding: binding.binding,
                message: `DebugNormal material bind group layout is missing required binding ${binding.binding}.`,
            });
            continue;
        }
        if (entry.resource !== "uniform-buffer") {
            diagnostics.push({
                code: "debugNormalMaterialBindGroupLayout.resourceKindMismatch",
                binding: binding.binding,
                message: `DebugNormal material binding ${binding.binding} must be 'uniform-buffer', not '${entry.resource}'.`,
            });
        }
    }
    return diagnostics;
}
//# sourceMappingURL=debug-normal-bind-group-layout.js.map