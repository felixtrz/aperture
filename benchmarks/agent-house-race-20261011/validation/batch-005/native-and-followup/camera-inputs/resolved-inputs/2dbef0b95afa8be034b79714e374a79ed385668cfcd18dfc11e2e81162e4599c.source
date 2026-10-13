export function createShadowDepthResourceSummaryReport(options) {
    const status = determineStatus(options.depthTextureResources);
    const diagnostics = createDiagnostics(status);
    const validResources = options.depthTextureResources.resources.filter((resource) => resource.allocation.valid);
    return {
        ready: false,
        status,
        counts: {
            textureDescriptors: options.depthTextureResources.textureDescriptorCount,
            depthTextureResources: options.depthTextureResources.createdTextureCount,
        },
        sections: {
            textureDescriptors: options.depthTextureResources.sections.textureDescriptors,
            depthTextureResource: options.depthTextureResources.sections.depthTextureResource,
            gpuAllocation: options.depthTextureResources.sections.gpuAllocation,
            matrixUpload: false,
            passSubmission: false,
            shaderSampling: false,
        },
        resourceKeys: {
            textures: validResources.map((resource) => resource.textureKey).sort(),
            views: validResources.map((resource) => resource.viewKey).sort(),
        },
        diagnostics,
    };
}
export function shadowDepthResourceSummaryReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        counts: { ...report.counts },
        sections: { ...report.sections },
        resourceKeys: {
            textures: [...report.resourceKeys.textures],
            views: [...report.resourceKeys.views],
        },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowDepthResourceSummaryReportToJson(report) {
    return JSON.stringify(shadowDepthResourceSummaryReportToJsonValue(report));
}
function determineStatus(depthTextureResources) {
    if (depthTextureResources.status === "not-required") {
        return "not-required";
    }
    if (depthTextureResources.status !== "available") {
        return "missing";
    }
    return "deferred";
}
function createDiagnostics(status) {
    if (status === "not-required") {
        return [];
    }
    if (status === "missing") {
        return [
            {
                code: "shadowDepthResourceSummary.depthTextureResourceMissing",
                severity: "warning",
                message: "Shadow depth resource summary requires available shadow depth texture resources.",
            },
        ];
    }
    return [
        {
            code: "shadowDepthResourceSummary.matrixUploadDeferred",
            severity: "warning",
            message: "Shadow depth texture resources are available, but shadow matrix upload remains deferred.",
        },
        {
            code: "shadowDepthResourceSummary.passSubmissionDeferred",
            severity: "warning",
            message: "Shadow depth texture resources are available, but shadow pass submission remains deferred.",
        },
        {
            code: "shadowDepthResourceSummary.shaderSamplingDeferred",
            severity: "warning",
            message: "Shadow depth texture resources are available, but StandardMaterial shadow sampling remains deferred.",
        },
    ];
}
//# sourceMappingURL=shadow-depth-resource-summary.js.map