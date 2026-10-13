export function createStandardMaterialBindGroupLayoutMetadata(layoutKey = "standard/group-2") {
    return {
        group: 2,
        name: "standardMaterial",
        layoutKey,
        bindings: [
            {
                binding: 0,
                name: "standardMaterial",
                resourceKind: "buffer",
                visibility: ["fragment"],
                required: true,
            },
            textureBinding(1, "baseColorTexture"),
            samplerBinding(2, "baseColorSampler"),
            textureBinding(3, "metallicRoughnessTexture"),
            samplerBinding(4, "metallicRoughnessSampler"),
            textureBinding(5, "normalTexture"),
            samplerBinding(6, "normalSampler"),
            textureBinding(7, "occlusionTexture"),
            samplerBinding(8, "occlusionSampler"),
            textureBinding(9, "emissiveTexture"),
            samplerBinding(10, "emissiveSampler"),
            textureBinding(11, "clearcoatTexture"),
            samplerBinding(12, "clearcoatSampler"),
            textureBinding(13, "transmissionTexture"),
            samplerBinding(14, "transmissionSampler"),
            textureBinding(15, "sheenColorTexture"),
            samplerBinding(16, "sheenColorSampler"),
            textureBinding(17, "iridescenceTexture"),
            samplerBinding(18, "iridescenceSampler"),
            textureBinding(19, "sheenRoughnessTexture"),
            samplerBinding(20, "sheenRoughnessSampler"),
            textureBinding(21, "iridescenceThicknessTexture"),
            samplerBinding(22, "iridescenceThicknessSampler"),
            textureBinding(23, "clearcoatRoughnessTexture"),
            samplerBinding(24, "clearcoatRoughnessSampler"),
        ],
    };
}
export function createStandardMaterialBindGroupLayoutPlan(layoutKey = "standard/group-2") {
    const metadata = createStandardMaterialBindGroupLayoutMetadata(layoutKey);
    const layout = {
        group: 2,
        label: "standard/group-2",
        entries: metadata.bindings.map((binding) => ({
            binding: binding.binding,
            label: binding.name,
            resource: resourceKindToLayoutResource(binding.resourceKind),
        })),
        metadata,
    };
    const diagnostics = validateStandardMaterialBindGroupLayout(layout);
    return {
        valid: diagnostics.length === 0,
        layout,
        diagnostics,
    };
}
export function validateStandardMaterialBindGroupLayout(layout) {
    const diagnostics = [];
    const metadata = layout.metadata ?? createStandardMaterialBindGroupLayoutMetadata();
    if (layout.group !== 2) {
        diagnostics.push({
            code: "standardMaterialBindGroupLayout.invalidGroup",
            message: `Standard material resources must use bind group 2; received group ${layout.group}.`,
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
                code: "standardMaterialBindGroupLayout.missingBinding",
                binding: binding.binding,
                message: `Standard material bind group layout is missing required binding ${binding.binding}.`,
            });
            continue;
        }
        const expected = resourceKindToLayoutResource(binding.resourceKind);
        if (entry.resource !== expected) {
            diagnostics.push({
                code: "standardMaterialBindGroupLayout.resourceKindMismatch",
                binding: binding.binding,
                message: `Standard material binding ${binding.binding} must be '${expected}', not '${entry.resource}'.`,
            });
        }
    }
    return diagnostics;
}
function textureBinding(binding, name) {
    return {
        binding,
        name,
        resourceKind: "texture-view",
        visibility: ["fragment"],
        required: false,
    };
}
function samplerBinding(binding, name) {
    return {
        binding,
        name,
        resourceKind: "sampler",
        visibility: ["fragment"],
        required: false,
    };
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
//# sourceMappingURL=standard-bind-group-layout.js.map