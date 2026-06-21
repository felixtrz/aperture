import { createSamplerAsset } from "@aperture-engine/render";
import { createSamplerGpuResource, } from "../resources/textures/texture-resources.js";
export function createIblSamplerResourceReport(options) {
    const diagnostics = [];
    if (options.samplers.status === "not-required") {
        return report({
            status: "not-required",
            samplerDescriptorCount: 0,
            resources: [],
            diagnostics,
        });
    }
    if (options.samplers.status === "missing" ||
        options.samplers.status === "deferred") {
        diagnostics.push({
            code: "iblSamplerResource.missingSamplerDescriptors",
            severity: "warning",
            message: "IBL sampler resource allocation requires ready IBL sampler descriptors.",
        });
        return report({
            status: "missing",
            samplerDescriptorCount: options.samplers.samplerCount,
            resources: [],
            diagnostics,
        });
    }
    if (options.samplers.status === "unsupported") {
        diagnostics.push({
            code: "iblSamplerResource.unsupportedSamplerDescriptors",
            severity: "warning",
            message: "IBL sampler resource allocation cannot proceed while IBL sampler descriptors are unsupported.",
        });
        return report({
            status: "unsupported",
            samplerDescriptorCount: options.samplers.samplerCount,
            resources: [],
            diagnostics,
        });
    }
    let createdSamplerCount = 0;
    let reusedSamplerCount = 0;
    const resources = options.samplers.samplers.map((sampler) => {
        const cached = options.cache?.get(sampler.samplerKey);
        if (cached !== undefined) {
            reusedSamplerCount += 1;
            return {
                valid: true,
                resource: cached,
                diagnostics: [],
            };
        }
        const result = createSamplerGpuResource({
            device: options.device,
            resourceKey: sampler.samplerKey,
            sampler: createSamplerAsset({
                label: `${sampler.environmentMapResourceKey}:${sampler.kind}:ibl-sampler`,
                addressModeU: sampler.addressModeU,
                addressModeV: sampler.addressModeV,
                addressModeW: sampler.addressModeW,
                magFilter: sampler.magFilter,
                minFilter: sampler.minFilter,
                mipmapFilter: sampler.mipmapFilter,
                maxAnisotropy: sampler.maxAnisotropy,
            }),
        });
        if (result.valid && result.resource !== null) {
            options.cache?.set(sampler.samplerKey, result.resource);
            createdSamplerCount += 1;
        }
        return result;
    });
    for (const resource of resources) {
        diagnostics.push(...resource.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            severity: "warning",
        })));
    }
    return report({
        status: resources.every((resource) => resource.valid)
            ? "available"
            : "missing",
        samplerDescriptorCount: options.samplers.samplerCount,
        createdSamplerCount,
        reusedSamplerCount,
        resources,
        diagnostics,
    });
}
export function iblSamplerResourceReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        samplerDescriptorCount: report.samplerDescriptorCount,
        createdSamplerCount: report.createdSamplerCount,
        reusedSamplerCount: report.reusedSamplerCount,
        sections: { ...report.sections },
        resources: report.resources.map((resource) => ({
            valid: resource.valid,
            resourceKey: resource.resource?.resourceKey ??
                resource.diagnostics[0]?.resourceKey ??
                "",
            descriptor: resource.resource === null ? null : { ...resource.resource.descriptor },
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: "severity" in diagnostic ? diagnostic.severity : "warning",
            message: diagnostic.message,
            ...("resourceKey" in diagnostic && diagnostic.resourceKey !== undefined
                ? { resourceKey: diagnostic.resourceKey }
                : {}),
        })),
    };
}
export function iblSamplerResourceReportToJson(report) {
    return JSON.stringify(iblSamplerResourceReportToJsonValue(report));
}
function report(input) {
    const createdSamplerCount = input.createdSamplerCount ??
        input.resources.filter((resource) => resource.valid).length;
    const reusedSamplerCount = input.reusedSamplerCount ?? 0;
    return {
        ready: input.status === "available" || input.status === "not-required",
        status: input.status,
        samplerDescriptorCount: input.samplerDescriptorCount,
        createdSamplerCount,
        reusedSamplerCount,
        sections: {
            samplerDescriptors: input.status !== "missing" && input.status !== "unsupported",
            gpuAllocation: input.status === "available",
            bindGroupLayout: false,
            shaderSampling: false,
        },
        resources: input.resources,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=ibl-sampler-resource.js.map