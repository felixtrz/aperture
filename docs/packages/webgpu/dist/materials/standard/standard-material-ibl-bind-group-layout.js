export function createStandardMaterialIblBindGroupLayoutMetadata(layoutKey = "standard/ibl/group-4") {
    return {
        group: 4,
        name: "standardMaterialIbl",
        layoutKey,
        bindings: [
            textureBinding(0, "diffuseIrradianceTexture"),
            textureBinding(1, "specularPrefilterTexture"),
            samplerBinding(2, "iblSampler"),
        ],
    };
}
export function createStandardMaterialIblBindGroupLayoutPlan(layoutKey = "standard/ibl/group-4") {
    const metadata = createStandardMaterialIblBindGroupLayoutMetadata(layoutKey);
    const layout = {
        group: 4,
        label: layoutKey,
        entries: metadata.bindings.map((binding) => ({
            binding: binding.binding,
            label: binding.name,
            resource: resourceKindToLayoutResource(binding.resourceKind),
        })),
        metadata,
    };
    const diagnostics = validateStandardMaterialIblBindGroupLayout(layout);
    return {
        valid: diagnostics.length === 0,
        layout,
        diagnostics,
    };
}
export function validateStandardMaterialIblBindGroupLayout(layout) {
    const diagnostics = [];
    const metadata = layout.metadata ?? createStandardMaterialIblBindGroupLayoutMetadata();
    if (layout.group !== 4) {
        diagnostics.push({
            code: "standardMaterialIblBindGroupLayout.invalidGroup",
            message: `Standard material IBL resources must use bind group 4; received group ${layout.group}.`,
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
                code: "standardMaterialIblBindGroupLayout.missingBinding",
                binding: binding.binding,
                message: `Standard material IBL bind group layout is missing required binding ${binding.binding}.`,
            });
            continue;
        }
        const expected = resourceKindToLayoutResource(binding.resourceKind);
        if (entry.resource !== expected) {
            diagnostics.push({
                code: "standardMaterialIblBindGroupLayout.resourceKindMismatch",
                binding: binding.binding,
                message: `Standard material IBL binding ${binding.binding} must be '${expected}', not '${entry.resource}'.`,
            });
        }
    }
    return diagnostics;
}
export function createStandardMaterialIblBindGroupLayoutReadinessReport(input) {
    if (input.standardMaterialCount === 0) {
        return {
            ready: true,
            status: "not-required",
            standardMaterialCount: 0,
            group: 4,
            bindingCount: 0,
            sections: {
                layoutMetadata: true,
                layoutDescriptor: true,
                bindGroupResource: false,
                shaderSampling: false,
            },
            layout: null,
            diagnostics: [],
        };
    }
    const plan = input.plan ?? createStandardMaterialIblBindGroupLayoutPlan(input.layoutKey);
    if (!plan.valid) {
        return {
            ready: false,
            status: "missing",
            standardMaterialCount: input.standardMaterialCount,
            group: 4,
            bindingCount: plan.layout.entries.length,
            sections: {
                layoutMetadata: true,
                layoutDescriptor: false,
                bindGroupResource: false,
                shaderSampling: false,
            },
            layout: plan.layout,
            diagnostics: [
                {
                    code: "standardMaterialIblBindGroupLayout.invalidLayout",
                    severity: "warning",
                    message: "StandardMaterial IBL bind-group layout metadata is invalid.",
                },
            ],
        };
    }
    return {
        ready: false,
        status: "deferred",
        standardMaterialCount: input.standardMaterialCount,
        group: 4,
        bindingCount: plan.layout.entries.length,
        sections: {
            layoutMetadata: true,
            layoutDescriptor: true,
            bindGroupResource: false,
            shaderSampling: false,
        },
        layout: plan.layout,
        diagnostics: [
            {
                code: "standardMaterialIblBindGroupLayout.bindGroupResourceDeferred",
                severity: "warning",
                message: "StandardMaterial IBL bind-group layout metadata is planned, but bind group resource creation is deferred.",
            },
            {
                code: "standardMaterialIblBindGroupLayout.shaderSamplingDeferred",
                severity: "warning",
                message: "StandardMaterial IBL bind-group layout metadata is planned, but WGSL shader sampling is deferred.",
            },
        ],
    };
}
export function standardMaterialIblBindGroupLayoutReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        group: report.group,
        bindingCount: report.bindingCount,
        sections: { ...report.sections },
        layout: report.layout === null
            ? null
            : {
                ...report.layout,
                entries: report.layout.entries.map((entry) => ({ ...entry })),
                metadata: {
                    ...report.layout.metadata,
                    bindings: report.layout.metadata.bindings.map((binding) => ({
                        ...binding,
                        visibility: [...binding.visibility],
                    })),
                },
            },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function standardMaterialIblBindGroupLayoutReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialIblBindGroupLayoutReadinessReportToJsonValue(report));
}
function textureBinding(binding, name) {
    return {
        binding,
        name,
        resourceKind: "texture-view",
        visibility: ["fragment"],
        required: true,
    };
}
function samplerBinding(binding, name) {
    return {
        binding,
        name,
        resourceKind: "sampler",
        visibility: ["fragment"],
        required: true,
    };
}
function resourceKindToLayoutResource(kind) {
    switch (kind) {
        case "texture-view":
            return "texture";
        case "sampler":
            return "sampler";
        case "buffer":
            return "uniform-buffer";
    }
}
//# sourceMappingURL=standard-material-ibl-bind-group-layout.js.map