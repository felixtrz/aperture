import { UNLIT_MESH_SHADER, } from "./unlit-shader.js";
import { createUnlitBindGroupLayoutMetadata, } from "./unlit-bind-group.js";
export function createUnlitBindGroupLayoutPlan(shader = UNLIT_MESH_SHADER) {
    const diagnostics = [];
    const required = ["viewProjection", "worldTransforms", "unlitMaterial"];
    const bindings = new Map(shader.bindings.map((binding) => [binding.id, binding]));
    const layouts = new Map();
    for (const id of required) {
        const binding = bindings.get(id);
        if (binding === undefined) {
            diagnostics.push({
                code: "unlitBindGroupLayout.missingBinding",
                bindingId: id,
                message: `Unlit shader metadata is missing '${id}' binding metadata.`,
            });
            continue;
        }
        addBindingLayout(binding, layouts, diagnostics);
    }
    for (const binding of shader.bindings) {
        if (required.includes(binding.id)) {
            continue;
        }
        addBindingLayout(binding, layouts, diagnostics);
    }
    return {
        valid: diagnostics.length === 0,
        layouts: [...layouts.values()]
            .sort((a, b) => a.group - b.group)
            .map((layout) => ({
            ...layout,
            metadata: createUnlitBindGroupLayoutMetadata(layout.group, layout.label),
        })),
        diagnostics,
    };
}
function addBindingLayout(binding, layouts, diagnostics) {
    if (!isSupportedBindGroupResource(binding.resource)) {
        diagnostics.push({
            code: "unlitBindGroupLayout.unsupportedResource",
            bindingId: binding.id,
            message: `Unsupported unlit binding resource '${String(binding.resource)}'.`,
        });
        return;
    }
    const current = layouts.get(binding.group) ??
        {
            group: binding.group,
            label: `unlit/group-${binding.group}`,
            entries: [],
            metadata: createUnlitBindGroupLayoutMetadata(binding.group, `unlit/group-${binding.group}`),
        };
    layouts.set(binding.group, {
        ...current,
        entries: [
            ...current.entries,
            {
                binding: binding.binding,
                label: binding.label,
                resource: binding.resource,
            },
        ].sort((a, b) => a.binding - b.binding),
    });
}
function isSupportedBindGroupResource(resource) {
    return (resource === "uniform-buffer" ||
        resource === "read-only-storage-buffer" ||
        resource === "texture" ||
        resource === "sampler");
}
//# sourceMappingURL=unlit-bind-group-layout.js.map