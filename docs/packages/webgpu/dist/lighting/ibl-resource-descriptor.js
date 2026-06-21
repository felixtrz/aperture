import { planEnvironmentResources } from "./environment-resource-planning.js";
export function createIblResourceDescriptorReport(input) {
    const plan = planEnvironmentResources(input.snapshot);
    const descriptorsByKey = new Map((input.descriptors ?? []).map((descriptor) => [
        descriptor.environmentMapResourceKey,
        descriptor,
    ]));
    const diagnostics = [];
    const descriptors = plan.requirements.map((requirement) => {
        const source = descriptorsByKey.get(requirement.resourceKey);
        if (source === undefined) {
            diagnostics.push({
                code: "iblResourceDescriptor.missingDescriptor",
                severity: "warning",
                environmentMapResourceKey: requirement.resourceKey,
                environmentIds: [...requirement.environmentIds],
                message: `IBL resource descriptor '${requirement.resourceKey}' is required by extracted environment packets but was not provided by renderer resource state.`,
            });
        }
        const diffuse = createSlot({
            kind: "diffuse",
            resourceKey: source?.diffuseResourceKey,
            environmentMapResourceKey: requirement.resourceKey,
            environmentIds: requirement.environmentIds,
            diagnostics,
        });
        const specular = createSlot({
            kind: "specular",
            resourceKey: source?.specularResourceKey,
            environmentMapResourceKey: requirement.resourceKey,
            environmentIds: requirement.environmentIds,
            diagnostics,
        });
        return {
            environmentMapResourceKey: requirement.resourceKey,
            environmentIds: [...requirement.environmentIds],
            ready: source !== undefined,
            diffuse,
            specular,
        };
    });
    return {
        ready: diagnostics.every((diagnostic) => diagnostic.code !== "iblResourceDescriptor.missingDescriptor"),
        environmentCount: plan.environmentCount,
        requiredEnvironmentMapCount: plan.requirements.length,
        descriptorCount: descriptors.filter((descriptor) => descriptor.ready)
            .length,
        sections: {
            environmentResourcePlanning: true,
            iblDescriptors: diagnostics.every((diagnostic) => diagnostic.code !== "iblResourceDescriptor.missingDescriptor"),
            shaderSampling: false,
        },
        descriptors,
        diagnostics,
    };
}
export function iblResourceDescriptorReportToJsonValue(report) {
    return {
        ready: report.ready,
        environmentCount: report.environmentCount,
        requiredEnvironmentMapCount: report.requiredEnvironmentMapCount,
        descriptorCount: report.descriptorCount,
        sections: { ...report.sections },
        descriptors: report.descriptors.map((descriptor) => ({
            environmentMapResourceKey: descriptor.environmentMapResourceKey,
            environmentIds: [...descriptor.environmentIds],
            ready: descriptor.ready,
            diffuse: { ...descriptor.diffuse },
            specular: { ...descriptor.specular },
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            environmentIds: [...diagnostic.environmentIds],
        })),
    };
}
export function iblResourceDescriptorReportToJson(report) {
    return JSON.stringify(iblResourceDescriptorReportToJsonValue(report));
}
function createSlot(input) {
    if (input.resourceKey !== undefined) {
        return {
            status: "ready",
            resourceKey: input.resourceKey,
            placeholder: null,
        };
    }
    const placeholder = `${input.environmentMapResourceKey}:ibl:${input.kind}:unsupported`;
    input.diagnostics.push({
        code: input.kind === "diffuse"
            ? "iblResourceDescriptor.diffuseSourceNotPrepared"
            : "iblResourceDescriptor.specularSourceNotPrepared",
        severity: "warning",
        environmentMapResourceKey: input.environmentMapResourceKey,
        environmentIds: [...input.environmentIds],
        message: `IBL ${input.kind} resource for '${input.environmentMapResourceKey}' has no prepared source from renderer resource state; the slot is planned as a placeholder until a source is provided.`,
    });
    return {
        status: "unsupported",
        resourceKey: null,
        placeholder,
    };
}
//# sourceMappingURL=ibl-resource-descriptor.js.map