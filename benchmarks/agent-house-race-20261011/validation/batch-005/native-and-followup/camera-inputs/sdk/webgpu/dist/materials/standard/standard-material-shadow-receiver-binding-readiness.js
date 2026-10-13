export function createStandardMaterialShadowReceiverBindingReadinessReport(options) {
    if (options.standardMaterialCount === 0) {
        return report({
            status: "not-required",
            standardMaterialCount: 0,
            records: [],
            diagnostics: [],
            sections: sections(options),
        });
    }
    const diagnostics = [];
    const matrixResource = options.matrixBufferResource.resource;
    const depthResource = options.depthTextureResources.resources[0] ?? null;
    const samplerResource = options.samplerResource.resource;
    const bindGroupResource = options.bindGroupResource.resource;
    if (matrixResource === null) {
        diagnostics.push({
            code: "standardMaterialShadowReceiverBinding.missingMatrixBufferResource",
            severity: "warning",
            message: "StandardMaterial shadow receiver binding requires a live shadow matrix buffer resource.",
        });
    }
    if (depthResource === null || !depthResource.allocation.valid) {
        diagnostics.push({
            code: "standardMaterialShadowReceiverBinding.missingDepthTextureResource",
            severity: "warning",
            message: "StandardMaterial shadow receiver binding requires a live shadow depth texture view.",
        });
    }
    if (samplerResource === null) {
        diagnostics.push({
            code: "standardMaterialShadowReceiverBinding.missingSamplerResource",
            severity: "warning",
            message: "StandardMaterial shadow receiver binding requires a live shadow sampler resource.",
        });
    }
    if (bindGroupResource === null) {
        diagnostics.push({
            code: "standardMaterialShadowReceiverBinding.missingBindGroupResource",
            severity: "warning",
            message: "StandardMaterial shadow receiver binding requires a live group 5 bind group resource.",
        });
    }
    if (!options.commandBufferSubmission.ready) {
        diagnostics.push({
            code: "standardMaterialShadowReceiverBinding.commandBufferNotReady",
            severity: "warning",
            message: "StandardMaterial shadow receiver binding requires a finished or submitted shadow command buffer.",
        });
    }
    const records = diagnostics.length > 0 ||
        matrixResource === null ||
        depthResource === null ||
        !depthResource.allocation.valid ||
        samplerResource === null ||
        bindGroupResource === null
        ? []
        : Array.from({ length: options.standardMaterialCount }, (_, index) => ({
            receiverKey: `standard-material-shadow-receiver:${index}`,
            group: 5,
            matrixResourceKey: matrixResource.resourceKey,
            depthTextureResourceKey: depthResource.resourceKey,
            depthViewKey: depthResource.viewKey,
            samplerResourceKey: samplerResource.resourceKey,
            bindGroupResourceKey: bindGroupResource.resourceKey,
            commandBufferStatus: options.commandBufferSubmission.status,
        }));
    return report({
        status: records.length > 0 ? "ready" : "missing",
        standardMaterialCount: options.standardMaterialCount,
        records,
        diagnostics,
        sections: sections(options),
    });
}
export function standardMaterialShadowReceiverBindingReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        receiverCount: report.receiverCount,
        sections: { ...report.sections },
        records: report.records.map((record) => ({ ...record })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function standardMaterialShadowReceiverBindingReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialShadowReceiverBindingReadinessReportToJsonValue(report));
}
function sections(options) {
    return {
        matrixBufferResource: options.matrixBufferResource.resource !== null,
        depthTextureResource: options.depthTextureResources.resources.some((resource) => resource.allocation.valid),
        samplerResource: options.samplerResource.resource !== null,
        bindGroupResource: options.bindGroupResource.resource !== null,
        commandBufferSubmission: options.commandBufferSubmission.ready,
        shaderSampling: options.matrixBufferResource.resource !== null &&
            options.depthTextureResources.resources.some((resource) => resource.allocation.valid) &&
            options.samplerResource.resource !== null &&
            options.bindGroupResource.resource !== null &&
            options.commandBufferSubmission.ready,
    };
}
function report(input) {
    return {
        ready: input.status === "ready" || input.status === "not-required",
        status: input.status,
        standardMaterialCount: input.standardMaterialCount,
        receiverCount: input.records.length,
        sections: input.sections,
        records: input.records,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=standard-material-shadow-receiver-binding-readiness.js.map