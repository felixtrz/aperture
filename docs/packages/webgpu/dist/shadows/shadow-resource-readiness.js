export function createShadowResourceReadinessReport(input) {
    if (input.descriptors.requestCount === 0) {
        return {
            ready: true,
            status: "not-required",
            requestCount: 0,
            descriptorCount: 0,
            resourceKeys: [],
            sections: {
                shadowMapDescriptors: true,
                shadowMapResources: true,
                shadowPassSubmission: false,
            },
            diagnostics: [],
        };
    }
    const missingDescriptors = !input.descriptors.ready;
    const diagnostics = [];
    if (missingDescriptors) {
        diagnostics.push({
            code: "shadowResourceReadiness.missingDescriptors",
            severity: "warning",
            message: "Shadow resource readiness requires valid renderer-owned shadow-map descriptors.",
        });
    }
    diagnostics.push({
        code: "shadowResourceReadiness.passSubmissionDeferred",
        severity: "warning",
        message: "Shadow-map descriptors are available, but shadow texture allocation and pass submission are not implemented yet.",
    });
    return {
        ready: !missingDescriptors,
        status: missingDescriptors ? "missing" : "available",
        requestCount: input.descriptors.requestCount,
        descriptorCount: input.descriptors.descriptorCount,
        resourceKeys: input.descriptors.descriptors
            .filter((descriptor) => descriptor.ready)
            .map((descriptor) => descriptor.resourceKey)
            .sort(),
        sections: {
            shadowMapDescriptors: input.descriptors.ready,
            shadowMapResources: !missingDescriptors,
            shadowPassSubmission: false,
        },
        diagnostics,
    };
}
export function shadowResourceReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        requestCount: report.requestCount,
        descriptorCount: report.descriptorCount,
        resourceKeys: [...report.resourceKeys],
        sections: { ...report.sections },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowResourceReadinessReportToJson(report) {
    return JSON.stringify(shadowResourceReadinessReportToJsonValue(report));
}
//# sourceMappingURL=shadow-resource-readiness.js.map