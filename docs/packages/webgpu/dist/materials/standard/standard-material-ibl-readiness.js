export function createStandardMaterialIblReadinessReport(input) {
    if (input.standardMaterialCount === 0 ||
        input.iblDescriptors.requiredEnvironmentMapCount === 0) {
        return {
            ready: true,
            status: "not-required",
            standardMaterialCount: input.standardMaterialCount,
            descriptorCount: input.iblDescriptors.descriptorCount,
            sections: {
                iblDescriptors: true,
                diffuseIrradiance: null,
                specularPrefilter: null,
                shaderSampling: false,
            },
            diagnostics: [],
        };
    }
    const missingDescriptorDiagnostics = input.iblDescriptors.diagnostics.filter((diagnostic) => diagnostic.code === "iblResourceDescriptor.missingDescriptor");
    const unsupportedSlotDiagnostics = input.iblDescriptors.diagnostics.filter((diagnostic) => diagnostic.code === "iblResourceDescriptor.diffuseSourceNotPrepared" ||
        diagnostic.code === "iblResourceDescriptor.specularSourceNotPrepared");
    const diffuseReady = input.iblDescriptors.descriptors.every((descriptor) => descriptor.diffuse.status === "ready");
    const specularReady = input.iblDescriptors.descriptors.every((descriptor) => descriptor.specular.status === "ready");
    const diagnostics = [];
    if (missingDescriptorDiagnostics.length > 0) {
        diagnostics.push({
            code: "standardMaterialIbl.missingDescriptors",
            severity: "warning",
            descriptorDiagnostics: missingDescriptorDiagnostics,
            message: "StandardMaterial IBL requires renderer-owned IBL descriptors for extracted environment maps.",
        });
    }
    if (unsupportedSlotDiagnostics.length > 0) {
        diagnostics.push({
            code: "standardMaterialIbl.unsupportedSlots",
            severity: "warning",
            descriptorDiagnostics: unsupportedSlotDiagnostics,
            message: "StandardMaterial IBL has descriptors, but at least one diffuse or specular IBL slot is still an unsupported placeholder.",
        });
    }
    diagnostics.push({
        code: "standardMaterialIbl.shaderSamplingDeferred",
        severity: "warning",
        descriptorDiagnostics: [],
        message: "StandardMaterial IBL descriptors are reported for readiness, but shader sampling is not implemented yet.",
    });
    return {
        ready: missingDescriptorDiagnostics.length === 0 &&
            unsupportedSlotDiagnostics.length === 0,
        status: missingDescriptorDiagnostics.length > 0
            ? "missing"
            : unsupportedSlotDiagnostics.length > 0
                ? "unsupported"
                : "available",
        standardMaterialCount: input.standardMaterialCount,
        descriptorCount: input.iblDescriptors.descriptorCount,
        sections: {
            iblDescriptors: missingDescriptorDiagnostics.length === 0,
            diffuseIrradiance: diffuseReady,
            specularPrefilter: specularReady,
            shaderSampling: false,
        },
        diagnostics,
    };
}
export function standardMaterialIblReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        descriptorCount: report.descriptorCount,
        sections: { ...report.sections },
        diagnostics: report.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            descriptorDiagnostics: diagnostic.descriptorDiagnostics.map((descriptorDiagnostic) => ({
                ...descriptorDiagnostic,
                environmentIds: [...descriptorDiagnostic.environmentIds],
            })),
        })),
    };
}
export function standardMaterialIblReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialIblReadinessReportToJsonValue(report));
}
//# sourceMappingURL=standard-material-ibl-readiness.js.map