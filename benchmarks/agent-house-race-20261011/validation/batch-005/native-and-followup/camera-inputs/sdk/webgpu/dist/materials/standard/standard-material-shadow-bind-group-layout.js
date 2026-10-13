export function createStandardMaterialShadowBindGroupLayoutMetadata(layoutKey = "standard/shadow/group-5") {
    return {
        group: 5,
        name: "standardMaterialShadow",
        layoutKey,
        bindings: [
            bufferBinding(0, "directionalShadowMatrices"),
            textureBinding(1, "directionalShadowMap"),
            samplerBinding(2, "directionalShadowSampler"),
        ],
    };
}
export function createStandardMaterialShadowBindGroupLayoutPlan(layoutKey = "standard/shadow/group-5") {
    const metadata = createStandardMaterialShadowBindGroupLayoutMetadata(layoutKey);
    const layout = {
        group: 5,
        label: layoutKey,
        entries: metadata.bindings.map((binding) => ({
            binding: binding.binding,
            label: binding.name,
            resource: resourceKindToLayoutResource(binding.resourceKind),
        })),
        metadata,
    };
    const diagnostics = validateStandardMaterialShadowBindGroupLayout(layout);
    return {
        valid: diagnostics.length === 0,
        layout,
        diagnostics,
    };
}
export function validateStandardMaterialShadowBindGroupLayout(layout) {
    const diagnostics = [];
    const metadata = layout.metadata ?? createStandardMaterialShadowBindGroupLayoutMetadata();
    if (layout.group !== 5) {
        diagnostics.push({
            code: "standardMaterialShadowBindGroupLayout.invalidGroup",
            message: `Standard material shadow resources must use bind group 5; received group ${layout.group}.`,
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
                code: "standardMaterialShadowBindGroupLayout.missingBinding",
                binding: binding.binding,
                message: `Standard material shadow bind group layout is missing required binding ${binding.binding}.`,
            });
            continue;
        }
        const expected = resourceKindToLayoutResource(binding.resourceKind);
        if (entry.resource !== expected) {
            diagnostics.push({
                code: "standardMaterialShadowBindGroupLayout.resourceKindMismatch",
                binding: binding.binding,
                message: `Standard material shadow binding ${binding.binding} must be '${expected}', not '${entry.resource}'.`,
            });
        }
    }
    return diagnostics;
}
export function createStandardMaterialShadowBindGroupLayoutReadinessReport(input) {
    if (input.standardMaterialCount === 0) {
        return {
            ready: true,
            status: "not-required",
            standardMaterialCount: 0,
            group: 5,
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
    const plan = input.plan ??
        createStandardMaterialShadowBindGroupLayoutPlan(input.layoutKey);
    if (!plan.valid) {
        return {
            ready: false,
            status: "missing",
            standardMaterialCount: input.standardMaterialCount,
            group: 5,
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
                    code: "standardMaterialShadowBindGroupLayout.invalidLayout",
                    severity: "warning",
                    message: "StandardMaterial shadow bind-group layout metadata is invalid.",
                },
            ],
        };
    }
    return {
        ready: false,
        status: "deferred",
        standardMaterialCount: input.standardMaterialCount,
        group: 5,
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
                code: "standardMaterialShadowBindGroupLayout.bindGroupResourceDeferred",
                severity: "warning",
                message: "StandardMaterial shadow bind-group layout metadata is planned, but bind group resource creation is deferred.",
            },
            {
                code: "standardMaterialShadowBindGroupLayout.shaderSamplingDeferred",
                severity: "warning",
                message: "StandardMaterial shadow bind-group layout metadata is planned, but WGSL shader sampling is deferred.",
            },
        ],
    };
}
export function standardMaterialShadowBindGroupLayoutReadinessReportToJsonValue(report) {
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
export function standardMaterialShadowBindGroupLayoutReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialShadowBindGroupLayoutReadinessReportToJsonValue(report));
}
function bufferBinding(binding, name) {
    return {
        binding,
        name,
        resourceKind: "buffer",
        visibility: ["vertex", "fragment"],
        required: true,
    };
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
        case "buffer":
            return "read-only-storage-buffer";
        case "texture-view":
            return "texture";
        case "sampler":
            return "sampler";
    }
}
//# sourceMappingURL=standard-material-shadow-bind-group-layout.js.map