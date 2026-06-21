export function createDiffuseIblResourceSummaryReport(options) {
    const status = determineStatus(options);
    const diagnostics = createDiagnostics(status, options);
    const diffuseTextures = options.diffuseTextureResource.resources.flatMap((resource) => resource.resource === null ? [] : [resource.resource.resourceKey]);
    const samplers = options.samplers.resources.flatMap((resource) => resource.resource === null ? [] : [resource.resource.resourceKey]);
    const deferredSpecularTextures = options.textures.slots.flatMap((slot) => slot.kind === "specular" && slot.textureKey !== null
        ? [slot.textureKey]
        : []);
    return {
        ready: false,
        status,
        counts: {
            textureSlots: options.textures.slotCount,
            diffuseTextureResources: diffuseTextures.length,
            samplerResources: samplers.length,
            deferredSpecularSlots: deferredSpecularTextures.length,
        },
        sections: {
            texturePreparation: options.textures.status === "ready" ||
                options.textures.status === "deferred",
            diffuseTextureResource: options.diffuseTextureResource.status === "available",
            samplerResources: options.samplers.status === "available",
            specularPrefiltering: false,
            bindGroupLayout: false,
            shaderSampling: false,
        },
        resourceKeys: {
            diffuseTextures,
            samplers,
            deferredSpecularTextures,
        },
        diagnostics,
    };
}
export function diffuseIblResourceSummaryReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        counts: { ...report.counts },
        sections: { ...report.sections },
        resourceKeys: {
            diffuseTextures: [...report.resourceKeys.diffuseTextures],
            samplers: [...report.resourceKeys.samplers],
            deferredSpecularTextures: [
                ...report.resourceKeys.deferredSpecularTextures,
            ],
        },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function diffuseIblResourceSummaryReportToJson(report) {
    return JSON.stringify(diffuseIblResourceSummaryReportToJsonValue(report));
}
function determineStatus(options) {
    if (options.textures.status === "not-required" ||
        options.diffuseTextureResource.status === "not-required" ||
        options.samplers.status === "not-required") {
        return "not-required";
    }
    if (options.textures.status === "unsupported" ||
        options.diffuseTextureResource.status === "unsupported" ||
        options.samplers.status === "unsupported") {
        return "unsupported";
    }
    if (options.diffuseTextureResource.status !== "available" ||
        options.samplers.status !== "available") {
        return "missing";
    }
    return "deferred";
}
function createDiagnostics(status, options) {
    if (status === "not-required") {
        return [];
    }
    if (status === "unsupported") {
        return [
            {
                code: "diffuseIblResourceSummary.resourceUnsupported",
                severity: "warning",
                message: "Diffuse IBL resource summary cannot proceed while an IBL resource input is unsupported.",
            },
        ];
    }
    const diagnostics = [];
    if (options.diffuseTextureResource.status !== "available") {
        diagnostics.push({
            code: "diffuseIblResourceSummary.textureResourceMissing",
            severity: "warning",
            message: "Diffuse IBL resource summary requires an available diffuse texture resource.",
        });
    }
    if (options.samplers.status !== "available") {
        diagnostics.push({
            code: "diffuseIblResourceSummary.samplerResourceMissing",
            severity: "warning",
            message: "Diffuse IBL resource summary requires available IBL sampler resources.",
        });
    }
    // status === "deferred" means every summarized resource is available;
    // specular prefiltering, bind-group layouts, and shader sampling are real,
    // so no stale "deferred" diagnostics are emitted for it.
    return diagnostics;
}
//# sourceMappingURL=diffuse-ibl-resource-summary.js.map